// Search within a subtree.
//
// Scoped to the focused unit rather than the whole structure: "91B" in a
// battalion is hundreds of hits and no help, but "91B in this platoon" is a
// question with a useful answer. The scope is the user's to widen -- clicking
// up the breadcrumb trail and searching again searches more.

const MAX_RESULTS = 300;

// Lower sorts first. An exact code is what you typed if you typed a code, so it
// outranks a title that merely happens to contain those letters.
const EXACT_CODE = 0;
const TITLE_START = 1;
const CODE_PREFIX = 2;
const TITLE_PART = 3;
const EQUIP = 4;

const FIELD_LABEL = {
  mos: 'MOS', poscode: 'POSCO', grade: 'Grade', lin: 'LIN', title: null,
};

/**
 * @returns [{ node, score, field, hint }] -- `field` says why it matched and
 *   `hint` is the matching text, so a result can explain itself.
 */
export function searchSubtree(model, scopeId, query) {
  const q = String(query || '').trim().toUpperCase();
  if (q.length < 1 || !model) return [];
  const scope = model.byId.get(scopeId) || model.byId.get(model.rootId);
  if (!scope) return [];

  const out = [];
  const stack = [scope.id];

  while (stack.length && out.length < MAX_RESULTS * 4) {
    const node = model.byId.get(stack.pop());
    if (!node) continue;
    for (const id of node.childIds) stack.push(id);

    const hit = match(node, q);
    if (hit) out.push({ node, ...hit });
  }

  out.sort((a, b) => a.score - b.score
    || a.node.depth - b.node.depth
    || a.node.title.localeCompare(b.node.title));
  return out.slice(0, MAX_RESULTS);
}

function match(node, q) {
  const title = (node.title || '').toUpperCase();
  const mos = (node.mos || '').toUpperCase();
  const posco = (node.poscode || '').toUpperCase();
  const grade = (node.grade || '').toUpperCase();

  if (mos === q) return { score: EXACT_CODE, field: 'mos', hint: node.mos };
  if (posco === q) return { score: EXACT_CODE, field: 'poscode', hint: node.poscode };
  // Grades are written "E-4"; accepting "E4" saves the hyphen.
  if (grade === q || grade.replace('-', '') === q.replace('-', '')) {
    return { score: EXACT_CODE, field: 'grade', hint: node.grade };
  }

  for (const e of node.equipment) {
    if ((e.lin || '').toUpperCase() === q) {
      return { score: EXACT_CODE, field: 'lin', hint: `${e.lin} ${e.name}` };
    }
  }

  if (title.startsWith(q)) return { score: TITLE_START, field: 'title', hint: node.title };
  if (mos.startsWith(q)) return { score: CODE_PREFIX, field: 'mos', hint: node.mos };
  if (posco.startsWith(q)) return { score: CODE_PREFIX, field: 'poscode', hint: node.poscode };
  if (title.includes(q)) return { score: TITLE_PART, field: 'title', hint: node.title };

  for (const e of node.equipment) {
    const lin = (e.lin || '').toUpperCase();
    const name = (e.name || '').toUpperCase();
    if (lin.startsWith(q)) return { score: CODE_PREFIX, field: 'lin', hint: `${e.lin} ${e.name}` };
    if (name.includes(q)) return { score: EQUIP, field: 'lin', hint: `${e.lin} ${e.name}` };
  }
  return null;
}

export function fieldLabel(field) {
  return FIELD_LABEL[field] || null;
}

/**
 * The two units a result sits inside, outermost first.
 *
 * A result on its own is often ambiguous -- half a company answers to "#1
 * Wheeled Vehicle Mechanic" -- and two levels is enough to tell them apart
 * without turning every row into a full path from the root.
 */
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
