// Turns raw FMSWeb sheet rows into node records + an equipment index.
//
// Two rules of the FMS export that drive everything here:
//   1. EQ rows are self-parented (ID === PARENTID) and that value is the *owning*
//      BL/CR/UN node's ID. So equipment is attached by ID lookup, and EQ IDs are
//      not unique across rows.
//   2. CR (crew/vehicle) rows are containers, not equipment -- they hold BL
//      soldiers and their own EQ.

export const REQUIRED_COLUMNS = ['ID', 'PARENTID', 'ORGTYPE', 'TITLE'];

const COLUMNS = [
  'ID', 'PARENTID', 'ORGTYPE', 'UIC', 'SUBUNIT', 'LDUIC', 'TITLE', 'PARNO',
  'GRADE', 'POSCO', 'ERC', 'OFF', 'WO', 'ENL', 'MIL', 'CIV', 'AUTHEQP', 'RUNDATE',
];

export class ParseError extends Error { }

const str = (v) => (v == null ? '' : String(v).trim());

/**
 * RUNDATE arrives as an Excel serial when cells are read raw. Excel's epoch is
 * 1899-12-30 (its 1900 leap-year bug baked in), days since then.
 */
export function formatRunDate(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 16).replace('T', ' ');
  const n = typeof v === 'number' ? v : Number(str(v));
  if (Number.isFinite(n) && n > 20000 && n < 100000) {
    const ms = Math.round((n - 25569) * 86400 * 1000); // 25569 = 1970-01-01 as a serial
    return new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
  }
  return str(v);
}
const num = (v) => {
  if (typeof v === 'number') return v;
  const n = parseInt(str(v), 10);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Build a header-name -> column-index map. Matching is by trimmed, upper-cased
 * name rather than position, so column reordering in a future export is fine.
 */
export function mapHeaders(headerRow) {
  const index = {};
  (headerRow || []).forEach((cell, i) => {
    const key = str(cell).toUpperCase();
    if (key && !(key in index)) index[key] = i;
  });

  const missing = REQUIRED_COLUMNS.filter((c) => !(c in index));
  if (missing.length) {
    const found = Object.keys(index).join(', ') || '(none)';
    throw new ParseError(
      `Spreadsheet is missing required column(s): ${missing.join(', ')}. Found: ${found}`,
    );
  }
  return index;
}

/** MOS is the first three characters of POSCO on a billet row. */
export function mosOf(poscode) {
  const p = str(poscode);
  return p.length >= 3 ? p.slice(0, 3).toUpperCase() : p.toUpperCase();
}

/**
 * @param rows      array-of-arrays, row 0 being the header
 * @param onProgress (fractionComplete) => void, called periodically
 * @returns { nodes: Map<id, node>, equipment: Map<ownerId, line[]>, meta }
 */
export function parseRows(rows, onProgress = () => { }) {
  if (!rows || rows.length < 2) throw new ParseError('Spreadsheet has no data rows.');
  if (isAlternateFormat(rows[0])) return parseAlternateRows(rows, onProgress);

  const col = mapHeaders(rows[0]);
  const has = (name) => name in col;
  const get = (row, name) => (has(name) ? row[col[name]] : undefined);

  const nodes = new Map();
  const equipment = new Map();
  const meta = { uic: '', runDate: '', rowCount: rows.length - 1, skipped: 0 };

  const total = rows.length - 1;
  const step = Math.max(1, Math.floor(total / 50));

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;

    const id = str(get(row, 'ID'));
    if (!id) { meta.skipped++; continue; }

    const kind = str(get(row, 'ORGTYPE')).toUpperCase();
    const title = str(get(row, 'TITLE'));

    if (kind === 'EQ') {
      // Self-parented: `id` identifies the owner, not this row.
      const lin = str(get(row, 'POSCO'));
      const qty = Math.max(1, num(get(row, 'AUTHEQP')));
      let lines = equipment.get(id);
      if (!lines) { lines = []; equipment.set(id, lines); }

      // Same LIN can appear twice under one owner -- merge and sum quantity.
      const dupe = lin && lines.find((l) => l.lin === lin && l.name === title);
      if (dupe) dupe.qty += qty;
      else lines.push({ lin, name: title, erc: str(get(row, 'ERC')), qty });
    } else if (kind === 'UN' || kind === 'CR' || kind === 'BL') {
      if (nodes.has(id)) { meta.skipped++; continue; }
      const grade = str(get(row, 'GRADE'));
      const poscode = str(get(row, 'POSCO'));
      nodes.set(id, {
        id,
        parentId: str(get(row, 'PARENTID')),
        kind,
        title,
        uic: str(get(row, 'UIC')),
        parno: str(get(row, 'PARNO')),
        grade,
        poscode,
        mos: kind === 'BL' ? mosOf(poscode) : '',
        // Strength as stated by the sheet. UN rows carry pre-summed rollups; we
        // keep them for cross-checking but compute our own in rollups.js.
        sheet: {
          off: num(get(row, 'OFF')),
          wo: num(get(row, 'WO')),
          enl: num(get(row, 'ENL')),
          mil: num(get(row, 'MIL')),
          civ: num(get(row, 'CIV')),
        },
        childIds: [],
        equipment: [],
      });

      if (!meta.uic && has('UIC')) meta.uic = str(get(row, 'UIC'));
      if (!meta.runDate && has('RUNDATE')) meta.runDate = formatRunDate(get(row, 'RUNDATE'));
    } else {
      meta.skipped++;
    }

    if (r % step === 0) onProgress(r / total);
  }

  if (nodes.size === 0) throw new ParseError('No unit, crew or billet rows (ORGTYPE UN/CR/BL) were found.');

  // Attach equipment to its owner; equipment whose owner is absent is dropped.
  for (const [ownerId, lines] of equipment) {
    const owner = nodes.get(ownerId);
    if (owner) owner.equipment = lines;
  }

  onProgress(1);
  return { nodes, equipment, meta, columns: COLUMNS.filter(has) };
}

// --------------------------------------------------------------------------
// Alternate export format.
//
// Same rows (UN / CR / BL / EQ, and EQ rows keyed by their owner's ID), but
// with ORG in place of ORGTYPE, LIN and AUTHQTY columns, and -- the hard part
// -- no PARENTID. The hierarchy is rebuilt from paragraph numbers and titles,
// following the MTOE conventions the export itself follows:
//   * A UN with no PARNO is the company (the first one) or a platoon (the rest).
//   * Each paragraph's first UN is its section; any further UNs in the
//     paragraph are sub-sections of it, and its crews and billets hang off it.
//   * A paragraph whose section is a "... Headquarters" opens the platoon its
//     title best matches, and the paragraphs after it belong to that platoon
//     until the next headquarters paragraph. "Company Headquarters" matches no
//     platoon, so it and anything after it sit directly under the company.
// What can't be recovered is which sub-section or crew inside a paragraph a
// soldier belongs to, so billets and crews are placed at the section.

const ALT_REQUIRED = ['ID', 'ORG', 'TITLE', 'PARNO'];

export function isAlternateFormat(headerRow) {
  const names = new Set((headerRow || []).map((c) => str(c).toUpperCase()));
  return !names.has('PARENTID') && ALT_REQUIRED.every((c) => names.has(c));
}

const HQ_TITLE = /head\s*quarters|\bhqs?\b/i;
// Words that say what kind of element something is rather than which one.
const GENERIC_WORDS = new Set([
  'and', 'of', 'the', 'for', 'headquarters', 'hq', 'hqs', 'section', 'platoon', 'plt', 'team', 'element',
]);
const titleWords = (title) => new Set(
  String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ')
    .filter((w) => w && !GENERIC_WORDS.has(w)),
);

/**
 * Best-matching platoon for a headquarters title: platoons not yet taken
 * first, then most shared words, then the closest overall match.
 */
function matchPlatoon(title, platoons, taken) {
  const words = titleWords(title);
  let best = null;
  let bestScore = null;
  for (const p of platoons) {
    const pw = titleWords(p.title);
    let overlap = 0;
    for (const w of words) if (pw.has(w)) overlap++;
    if (!overlap) continue;
    const score = [taken.has(p.id) ? 0 : 1, overlap, overlap / (words.size + pw.size - overlap)];
    const better = !bestScore || score[0] - bestScore[0] || score[1] - bestScore[1] || score[2] - bestScore[2];
    if (!bestScore || better > 0) { best = p; bestScore = score; }
  }
  return best;
}

const emptyNode = (id, fields) => ({
  id,
  parentId: '',
  kind: 'UN',
  title: '',
  uic: '',
  parno: '',
  grade: '',
  poscode: '',
  mos: '',
  sheet: { off: 0, wo: 0, enl: 0, mil: 0, civ: 0 },
  childIds: [],
  equipment: [],
  ...fields,
});

function parseAlternateRows(rows, onProgress) {
  const col = {};
  rows[0].forEach((cell, i) => {
    const key = str(cell).toUpperCase();
    if (key && !(key in col)) col[key] = i;
  });
  const has = (name) => name in col;
  const get = (row, name) => (has(name) ? row[col[name]] : undefined);

  const nodes = new Map();
  const equipment = new Map();
  const meta = {
    uic: '', runDate: '', rowCount: rows.length - 1, skipped: 0, format: 'alternate',
    warnings: [
      'This sheet is in the alternate FMS format, which has no parent links. The hierarchy was rebuilt '
      + 'from paragraph numbers and titles; soldiers and vehicles are shown at their section, since the '
      + 'sheet does not say which crew or sub-section they belong to.',
    ],
  };
  const total = rows.length - 1;
  const step = Math.max(1, Math.floor(total / 50));

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const id = str(get(row, 'ID'));
    if (!id) { meta.skipped++; continue; }
    const kind = str(get(row, 'ORG')).toUpperCase();
    const title = str(get(row, 'TITLE'));
    const qty = Math.max(1, num(get(row, 'AUTHQTY')));

    if (kind === 'EQ') {
      const lin = str(get(row, 'LIN'));
      let lines = equipment.get(id);
      if (!lines) { lines = []; equipment.set(id, lines); }
      const dupe = lin && lines.find((l) => l.lin === lin && l.name === title);
      if (dupe) dupe.qty += qty;
      else lines.push({ lin, name: title, erc: str(get(row, 'ERC')), qty });
    } else if (kind === 'UN' || kind === 'CR' || kind === 'BL') {
      if (nodes.has(id)) { meta.skipped++; continue; }
      const uic = str(get(row, 'UIC'));
      const fields = { kind, title, uic, parno: str(get(row, 'PARNO')) };
      if (kind === 'BL') {
        fields.grade = str(get(row, 'GRADE'));
        fields.poscode = str(get(row, 'POSCO'));
        fields.mos = mosOf(fields.poscode);
      }
      nodes.set(id, emptyNode(id, fields));
      // A billet line authorising several soldiers becomes that many billets.
      if (kind === 'BL') for (let k = 2; k <= qty; k++) nodes.set(`${id}#${k}`, emptyNode(`${id}#${k}`, fields));
      if (!meta.uic && uic) meta.uic = uic;
    } else {
      meta.skipped++;
    }
    if (r % step === 0) onProgress(r / total);
  }

  if (nodes.size === 0) throw new ParseError('No unit, crew or billet rows (ORG UN/CR/BL) were found.');

  // Rebuild the hierarchy one UIC at a time.
  const byUic = new Map();
  for (const n of nodes.values()) {
    let list = byUic.get(n.uic);
    if (!list) { list = []; byUic.set(n.uic, list); }
    list.push(n);
  }

  for (const [uic, list] of byUic) {
    const tops = list.filter((n) => n.kind === 'UN' && !n.parno);
    let company = tops[0];
    if (!company) {
      company = emptyNode(`__company__${uic}`, { title: uic || 'Unit', uic, synthetic: true });
      nodes.set(company.id, company);
    }
    const platoons = tops.slice(1);
    for (const p of platoons) p.parentId = company.id;

    const paragraphs = new Map();
    for (const n of list) {
      if (!n.parno) continue;
      let para = paragraphs.get(n.parno);
      if (!para) { para = []; paragraphs.set(n.parno, para); }
      para.push(n);
    }
    const parnos = [...paragraphs.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const taken = new Set();
    let platoon = null;
    for (const parno of parnos) {
      const members = paragraphs.get(parno);
      let section = members.find((n) => n.kind === 'UN') || members.find((n) => n.kind === 'CR');
      if (!section) {
        section = emptyNode(`__para__${uic}__${parno}`, { title: `Paragraph ${parno}`, uic, parno, synthetic: true });
        nodes.set(section.id, section);
      }
      for (const n of members) if (n !== section) n.parentId = section.id;

      if (HQ_TITLE.test(section.title)) {
        platoon = matchPlatoon(section.title, platoons, taken);
        if (platoon) taken.add(platoon.id);
      }
      section.parentId = (platoon || company).id;
    }
  }

  for (const [ownerId, lines] of equipment) {
    const owner = nodes.get(ownerId);
    if (owner) owner.equipment = lines;
  }

  onProgress(1);
  return { nodes, equipment, meta, columns: Object.keys(col) };
}
