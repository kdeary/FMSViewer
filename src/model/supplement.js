// The Supplement Table: details the FMS export doesn't carry, for each LIN (a
// short "M"-series nomenclature and a description) and each MOS (a title and
// a description). The user gets them by pasting a generated prompt into any
// LLM and importing the CSV it hands back, then can edit them cell by cell.
// The table travels inside the .fmsmodel.json export.
//
// Rows: { id, type: 'LIN' | 'MOS', code, name, tag, description }
// `tag` is a LIN's general category (one of TAGS), or '' to fall back on the
// keyword guess from its name; MOS rows leave it empty.

import { TAGS, normalizeTag } from './equipmentTags.js';

export const TYPES = ['LIN', 'MOS'];
export const CSV_COLUMNS = ['TYPE', 'CODE', 'NAME', 'TAG', 'DESCRIPTION'];

export const normCode = (code) => String(code || '').trim().toUpperCase();

let nextId = 1;
export function makeRow({ type = 'LIN', code = '', name = '', tag = '', description = '' } = {}) {
  const t = normCode(type) === 'MOS' ? 'MOS' : 'LIN';
  return {
    id: `s${nextId++}`, type: t, code: normCode(code), name, tag: t === 'LIN' ? normalizeTag(tag) : '', description,
  };
}

/** Lookups by code, one per type. Later rows win when a code repeats. */
export function indexSupplement(rows) {
  const lin = new Map();
  const mos = new Map();
  for (const r of rows || []) {
    if (!r.code) continue;
    (r.type === 'MOS' ? mos : lin).set(r.code, r);
  }
  return { rows: rows || [], lin, mos };
}

/** Incoming rows overwrite same type+code rows in place; the rest are appended. */
export function amendRows(current, incoming) {
  const key = (r) => `${r.type}|${r.code}`;
  const byKey = new Map(incoming.map((r) => [key(r), r]));
  const out = current.map((r) => {
    const hit = byKey.get(key(r));
    if (!hit) return r;
    byKey.delete(key(r));
    return { ...hit, id: r.id };
  });
  return [...out, ...byKey.values()];
}

/** Serializable form for the model file (no ids). */
export function packRows(rows) {
  return rows.map(({ type, code, name, tag, description }) => ({ type, code, name, tag, description }));
}

export function unpackRows(list) {
  return Array.isArray(list) ? list.filter((r) => r && r.code).map(makeRow) : [];
}

/** Every distinct LIN in the structure, with the name the FMS gives it. */
export function uniqueLins(root) {
  const seen = new Map();
  for (const item of root?.allEq || []) {
    const lin = normCode(item.lin);
    if (lin && !seen.has(lin)) seen.set(lin, { code: lin, name: item.name || '' });
  }
  return [...seen.values()].sort((a, b) => a.code.localeCompare(b.code));
}

/** Every distinct MOS, with whatever title is already known for it (maybe none). */
export function uniqueMos(root, officialTitle) {
  return (root?.topMos || [])
    .map(({ mos }) => ({ code: normCode(mos), name: officialTitle(mos) || '' }))
    .filter((m) => m.code)
    .sort((a, b) => a.code.localeCompare(b.code));
}

export function buildPrompt(lins, mos) {
  const linList = lins.length ? lins.map(({ code, name }) => `${code} | ${name}`).join('\n') : '(none)';
  const mosList = mos.length ? mos.map(({ code, name }) => (name ? `${code} | ${name}` : code)).join('\n') : '(none)';
  return `You are a U.S. Army force management, equipment and personnel expert. Below are two lists from a unit's Force Management System (FMS) authorization document:
1. Line Item Numbers (LINs), each followed by the generic name the FMS gives it.
2. Military Occupational Specialty (MOS) / Area of Concentration codes, some followed by a known title.

Produce ONE CSV file with exactly these five columns, in this order, with this header row:

TYPE,CODE,NAME,TAG,DESCRIPTION

Include one row for EVERY LIN and EVERY MOS in the lists. Do not skip, merge or add codes.

Rows for LINs:
- TYPE: LIN
- CODE: the LIN, copied exactly as given.
- NAME: the short standard Army nomenclature, starting with its "M" model number followed by the common name, e.g. "M4A1 Carbine", "M1151A1 HMMWV", "M240B Machine Gun". Use the most current model fielded under that LIN. Only if the item genuinely has no M-series designation, use its official type designation instead (e.g. "AN/PRC-117G Radio") - never invent an M number.
- TAG: the item's general category, exactly one of: ${TAGS.map((t) => `"${t}"`).join(', ')}. "Weapon" covers anything related to weapons, including mounts, sights, optics and weapon tools. "Large Systems/Kits" covers large fielded systems and sets such as a Forward Repair System, Assault or Containerized Kitchen, Mobile Kitchen Trailer, shower or laundry systems, water purification and shop sets. "Temperature Control" covers air conditioners, heaters and environmental control units. Use "Others" when nothing else fits.
- DESCRIPTION: 2-4 plain-language sentences for someone unfamiliar with the item: what it is, what it is used for, and notable capabilities or characteristics (e.g. caliber, range, crew, capacity).

Rows for MOSs:
- TYPE: MOS
- CODE: the MOS code, copied exactly as given.
- NAME: the official MOS / AOC / warrant officer specialty title, e.g. "Infantryman", "Wheeled Vehicle Mechanic", "Signal Officer".
- TAG: leave empty.
- DESCRIPTION: 2-4 plain-language sentences on what a Soldier in that specialty does and is responsible for.

If you are not confident what a code is, say so in its DESCRIPTION rather than guessing.

Output format:
- Output ONLY the CSV, inside a single code block, so it can be saved directly as a .csv file (or provide it as a downloadable .csv file if you can).
- Wrap every NAME, TAG and DESCRIPTION value in double quotes, and escape any double quote inside a value by doubling it ("").
- No commentary before or after the CSV.

LINs (LIN | FMS name)
${linList}

MOSs (MOS | known title)
${mosList}
`;
}

// RFC 4180-ish: quoted fields, doubled quotes, commas and newlines inside quotes.
function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim()));
}

// Header aliases, so older LIN-only files (LIN,NOMENCLATURE,DESCRIPTION) and
// MOS-only ones (MOS,TITLE,DESCRIPTION) import too.
const CODE_HEADERS = ['CODE', 'LIN', 'MOS'];
const NAME_HEADERS = ['NAME', 'NOMENCLATURE', 'TITLE'];

/**
 * Parses the CSV an LLM returns (or one this app exported). Tolerates a BOM,
 * markdown code fences and chatter lines around the table, and any column
 * order as long as the header row names them.
 * @returns {{ rows: object[], skipped: number }}
 */
export function parseSupplementCsv(text) {
  const clean = String(text || '')
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((line) => !/^\s*```/.test(line))
    .join('\n');
  const rows = parseCsvRows(clean);

  const isHeader = (r) => r.some((f) => CODE_HEADERS.includes(f.trim().toUpperCase()));
  const headerIdx = rows.findIndex(isHeader);
  if (headerIdx < 0) throw new Error('No header row with a CODE, LIN or MOS column was found in that file.');
  const header = rows[headerIdx].map((f) => f.trim().toUpperCase());
  const find = (names) => header.findIndex((h) => names.includes(h));
  const iType = header.indexOf('TYPE');
  const iCode = find(CODE_HEADERS);
  const iName = find(NAME_HEADERS);
  const iDesc = header.indexOf('DESCRIPTION');
  const iTag = find(['TAG', 'CATEGORY']);
  if (iName < 0 && iDesc < 0) throw new Error('The file needs NAME and/or DESCRIPTION columns.');
  // Without a TYPE column the code column's own header says what it holds.
  const fixedType = header[iCode] === 'MOS' ? 'MOS' : 'LIN';

  const out = [];
  let skipped = 0;
  for (const r of rows.slice(headerIdx + 1)) {
    const type = iType >= 0 ? normCode(r[iType]) : fixedType;
    const code = normCode(r[iCode]);
    const name = iName >= 0 ? String(r[iName] || '').trim() : '';
    const description = iDesc >= 0 ? String(r[iDesc] || '').trim() : '';
    if (!TYPES.includes(type) || !code || (!name && !description)) { skipped++; continue; }
    const tag = iTag >= 0 ? String(r[iTag] || '') : '';
    out.push(makeRow({ type, code, name, tag, description }));
  }
  if (!out.length) throw new Error('The file has a header but no usable rows.');
  return { rows: out, skipped };
}

export function toCsv(rows) {
  const q = (v) => {
    const s = String(v ?? '');
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [CSV_COLUMNS.join(',')];
  for (const r of rows) lines.push([r.type, r.code, r.name, r.tag, r.description].map(q).join(','));
  return lines.join('\r\n') + '\r\n';
}
