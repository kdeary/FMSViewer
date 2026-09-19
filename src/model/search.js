// Search within a subtree with prefix query support (e.g. MOS:56M, LIN:T73827, TITLE:Infantry, etc.).

import { getEquipmentCategory } from './rollups.js';

const MAX_RESULTS = 300;

// Lower sorts first.
const EXACT_CODE = 0;
const TITLE_START = 1;
const CODE_PREFIX = 2;
const TITLE_PART = 3;
const EQUIP = 4;

const FIELD_LABEL = {
  mos: 'MOS',
  poscode: 'POSCO',
  grade: 'Grade',
  lin: 'LIN',
  uic: 'UIC',
  parno: 'Para',
  erc: 'ERC',
  cat: 'Category',
  title: null,
};

export function parseSearchQuery(query) {
  const raw = String(query || '').trim();
  if (!raw) return { prefix: null, term: '' };

  const colonIdx = raw.indexOf(':');
  if (colonIdx > 0) {
    const key = raw.substring(0, colonIdx).trim().toUpperCase();
    const term = raw.substring(colonIdx + 1).trim();
    if (term) {
      if (['MOS', 'M'].includes(key)) return { prefix: 'MOS', term: term.toUpperCase() };
      if (['LIN', 'L'].includes(key)) return { prefix: 'LIN', term: term.toUpperCase() };
      if (['EQUIP', 'EQ', 'GEAR'].includes(key)) return { prefix: 'EQUIP', term: term.toUpperCase() };
      if (['TITLE', 'T', 'NAME'].includes(key)) return { prefix: 'TITLE', term: term.toUpperCase() };
      if (['GRADE', 'G', 'RANK'].includes(key)) return { prefix: 'GRADE', term: term.toUpperCase() };
      if (['UIC', 'U'].includes(key)) return { prefix: 'UIC', term: term.toUpperCase() };
      if (['POS', 'POSCODE'].includes(key)) return { prefix: 'POSCODE', term: term.toUpperCase() };
      if (['PAR', 'PARNO'].includes(key)) return { prefix: 'PARNO', term: term.toUpperCase() };
      if (['ERC'].includes(key)) return { prefix: 'ERC', term: term.toUpperCase() };
      if (['CAT', 'CATEGORY'].includes(key)) return { prefix: 'CAT', term: term.toUpperCase() };
    }
  }

  return { prefix: null, term: raw.toUpperCase() };
}

/**
 * @param supplement the indexed Supplement Table (`indexSupplement`), optional.
 *   Its LIN nomenclatures and MOS titles are searchable alongside the FMS text.
 * @returns [{ node, score, field, hint }] -- `field` says why it matched and `hint` is the matching text.
 */
export function searchSubtree(model, scopeId, query, supplement = null) {
  const parsed = parseSearchQuery(query);
  if (!parsed.term || !model) return [];
  const scope = model.byId.get(scopeId) || model.byId.get(model.rootId);
  if (!scope) return [];

  const out = [];
  const stack = [scope.id];

  while (stack.length && out.length < MAX_RESULTS * 4) {
    const node = model.byId.get(stack.pop());
    if (!node) continue;
    for (const id of node.childIds) stack.push(id);

    const hit = match(node, parsed, supplement);
    if (hit) out.push({ node, ...hit });
  }

  out.sort((a, b) => a.score - b.score
    || a.node.depth - b.node.depth
    || a.node.title.localeCompare(b.node.title));
  return out.slice(0, MAX_RESULTS);
}

// Supplement Table lookups: the alternative name for a LIN / MOS, upper-cased, or ''.
const supLin = (sup, lin) => (sup?.lin.get((lin || '').toUpperCase())?.name || '').toUpperCase();
const supMos = (sup, mos) => (sup?.mos.get((mos || '').toUpperCase())?.name || '').toUpperCase();

function match(node, parsed, sup) {
  const { prefix, term: q } = parsed;
  if (!q) return null;
  // Equipment hints read with the supplement nomenclature when there is one.
  const eqHint = (e) => `${e.lin} ${sup?.lin.get((e.lin || '').toUpperCase())?.name || e.name}`;
  const mosHint = () => {
    const title = sup?.mos.get((node.mos || '').toUpperCase())?.name;
    return title ? `${node.mos} ${title}` : node.mos;
  };

  if (prefix) {
    switch (prefix) {
      case 'MOS': {
        const mos = (node.mos || '').toUpperCase();
        if (mos === q) return { score: EXACT_CODE, field: 'mos', hint: mosHint() };
        if (mos.includes(q)) return { score: CODE_PREFIX, field: 'mos', hint: mosHint() };
        if (supMos(sup, node.mos).includes(q)) return { score: TITLE_PART, field: 'mos', hint: mosHint() };
        return null;
      }
      case 'LIN': {
        for (const e of node.equipment) {
          const lin = (e.lin || '').toUpperCase();
          if (lin === q) return { score: EXACT_CODE, field: 'lin', hint: eqHint(e) };
          if (lin.includes(q)) return { score: CODE_PREFIX, field: 'lin', hint: eqHint(e) };
        }
        return null;
      }
      case 'EQUIP': {
        for (const e of node.equipment) {
          const lin = (e.lin || '').toUpperCase();
          const name = (e.name || '').toUpperCase();
          const nom = supLin(sup, e.lin);
          if (lin === q || name === q || nom === q) return { score: EXACT_CODE, field: 'lin', hint: eqHint(e) };
          if (lin.includes(q) || name.includes(q) || nom.includes(q)) return { score: EQUIP, field: 'lin', hint: eqHint(e) };
        }
        return null;
      }
      case 'TITLE': {
        const title = (node.title || '').toUpperCase();
        if (title === q) return { score: EXACT_CODE, field: 'title', hint: node.title };
        if (title.startsWith(q)) return { score: TITLE_START, field: 'title', hint: node.title };
        if (title.includes(q)) return { score: TITLE_PART, field: 'title', hint: node.title };
  if (node.mos && supMos(sup, node.mos).includes(q)) return { score: TITLE_PART, field: 'mos', hint: mosHint() };
        return null;
      }
      case 'GRADE': {
        const grade = (node.grade || '').toUpperCase();
        const normGrade = grade.replace('-', '');
        const normQ = q.replace('-', '');
        if (grade === q || normGrade === normQ) return { score: EXACT_CODE, field: 'grade', hint: node.grade };
        if (grade.includes(q)) return { score: CODE_PREFIX, field: 'grade', hint: node.grade };
        return null;
      }
      case 'UIC': {
        const uic = (node.uic || '').toUpperCase();
        if (uic === q) return { score: EXACT_CODE, field: 'uic', hint: node.uic };
        if (uic.includes(q)) return { score: CODE_PREFIX, field: 'uic', hint: node.uic };
        return null;
      }
      case 'POSCODE': {
        const pos = (node.poscode || '').toUpperCase();
        if (pos === q) return { score: EXACT_CODE, field: 'poscode', hint: node.poscode };
        if (pos.includes(q)) return { score: CODE_PREFIX, field: 'poscode', hint: node.poscode };
        return null;
      }
      case 'PARNO': {
        const par = (node.parno || '').toUpperCase();
        if (par === q) return { score: EXACT_CODE, field: 'parno', hint: `Para ${node.parno}` };
        if (par.includes(q)) return { score: CODE_PREFIX, field: 'parno', hint: `Para ${node.parno}` };
        return null;
      }
      case 'ERC': {
        for (const e of node.equipment) {
          const erc = (e.erc || '').toUpperCase();
          if (erc === q) return { score: EXACT_CODE, field: 'erc', hint: `${e.name} (ERC ${e.erc})` };
        }
        return null;
      }
      case 'CAT': {
        for (const e of node.equipment) {
          const cat = getEquipmentCategory(e.name);
          if (cat === q || cat.includes(q)) return { score: EXACT_CODE, field: 'cat', hint: `[${cat}] ${e.name}` };
        }
        return null;
      }
      default:
        return null;
    }
  }

  // Standard multi-field search (no prefix)
  const title = (node.title || '').toUpperCase();
  const mos = (node.mos || '').toUpperCase();
  const posco = (node.poscode || '').toUpperCase();
  const grade = (node.grade || '').toUpperCase();
  const uic = (node.uic || '').toUpperCase();

  if (mos === q) return { score: EXACT_CODE, field: 'mos', hint: mosHint() };
  if (posco === q) return { score: EXACT_CODE, field: 'poscode', hint: node.poscode };
  if (uic === q) return { score: EXACT_CODE, field: 'uic', hint: node.uic };
  if (grade === q || grade.replace('-', '') === q.replace('-', '')) {
    return { score: EXACT_CODE, field: 'grade', hint: node.grade };
  }

  for (const e of node.equipment) {
    if ((e.lin || '').toUpperCase() === q) {
      return { score: EXACT_CODE, field: 'lin', hint: eqHint(e) };
    }
  }

  if (title.startsWith(q)) return { score: TITLE_START, field: 'title', hint: node.title };
  if (mos.startsWith(q)) return { score: CODE_PREFIX, field: 'mos', hint: node.mos };
  if (posco.startsWith(q)) return { score: CODE_PREFIX, field: 'poscode', hint: node.poscode };
  if (uic.startsWith(q)) return { score: CODE_PREFIX, field: 'uic', hint: node.uic };
  if (title.includes(q)) return { score: TITLE_PART, field: 'title', hint: node.title };
  if (node.mos && supMos(sup, node.mos).includes(q)) return { score: TITLE_PART, field: 'mos', hint: mosHint() };

  for (const e of node.equipment) {
    const lin = (e.lin || '').toUpperCase();
    const name = (e.name || '').toUpperCase();
    if (lin.startsWith(q)) return { score: CODE_PREFIX, field: 'lin', hint: eqHint(e) };
    if (name.includes(q) || supLin(sup, e.lin).includes(q)) return { score: EQUIP, field: 'lin', hint: eqHint(e) };
  }
  return null;
}

export function fieldLabel(field) {
  return FIELD_LABEL[field] || null;
}

export function ancestorTrail(model, node, levels = 2) {
  const trail = [];
  let id = node && node.parentId;
  while (id && trail.length < levels) {
    const parent = model.byId.get(id);
    if (!parent) break;
    trail.unshift(parent);
    id = parent.parentId;
  }
  return trail;
}
