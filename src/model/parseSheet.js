// Turns raw FMS Web sheet rows into node records + an equipment index.
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

export class ParseError extends Error {}

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
export function parseRows(rows, onProgress = () => {}) {
  if (!rows || rows.length < 2) throw new ParseError('Spreadsheet has no data rows.');

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
