// Wires parent pointers into a tree, tolerating the quirks a real export can have:
// self-parented rows, missing parents, several roots, and outright cycles.

import { isHeadquarters } from './taxonomy.js';

const SYNTHETIC_ROOT = '__root__';

export function buildTree(nodes, meta = {}) {
  const warnings = [];

  // 1. Link children. A node pointing at itself or at a missing ID is a root candidate.
  const rootIds = [];
  for (const node of nodes.values()) {
    const parent = node.parentId && node.parentId !== node.id ? nodes.get(node.parentId) : null;
    if (parent) parent.childIds.push(node.id);
    else rootIds.push(node.id);
  }

  // 2. Break cycles: any node not reachable from a root is re-rooted.
  const reachable = new Set();
  const stack = [...rootIds];
  while (stack.length) {
    const id = stack.pop();
    if (reachable.has(id)) continue;
    reachable.add(id);
    const node = nodes.get(id);
    if (node) for (const c of node.childIds) stack.push(c);
  }
  if (reachable.size !== nodes.size) {
    for (const node of nodes.values()) {
      if (reachable.has(node.id)) continue;
      const parent = nodes.get(node.parentId);
      if (parent) parent.childIds = parent.childIds.filter((c) => c !== node.id);
      node.parentId = '';
      rootIds.push(node.id);
      // Mark the whole orphaned subtree reachable so we only re-root its top.
      const sub = [node.id];
      while (sub.length) {
        const id = sub.pop();
        if (reachable.has(id)) continue;
        reachable.add(id);
        const n = nodes.get(id);
        if (n) for (const c of n.childIds) sub.push(c);
      }
    }
    warnings.push('Circular or orphaned parent references were found; affected units were re-rooted.');
  }

  // 3. Exactly one root is the normal case; wrap several under a synthetic one.
  let rootId;
  if (rootIds.length === 1) {
    [rootId] = rootIds;
  } else {
    rootId = SYNTHETIC_ROOT;
    nodes.set(rootId, {
      id: rootId,
      parentId: '',
      kind: 'UN',
      title: meta.uic ? `Force Structure (${meta.uic})` : 'Force Structure',
      uic: meta.uic || '',
      parno: '',
      grade: '',
      poscode: '',
      mos: '',
      sheet: { off: 0, wo: 0, enl: 0, mil: 0, civ: 0 },
      childIds: rootIds,
      equipment: [],
      synthetic: true,
    });
    for (const id of rootIds) nodes.get(id).parentId = rootId;
    warnings.push(`Sheet contained ${rootIds.length} top-level units; they were grouped under a synthetic root.`);
  }

  // 4. Depth, and a stable sibling order: the headquarters element first, then
  //    units, crews and billets, each group keeping the order it appeared in
  //    the sheet (paragraph order).
  const order = { UN: 0, CR: 1, BL: 2 };
  const seq = new Map();
  let i = 0;
  for (const id of nodes.keys()) seq.set(id, i++);

  const walk = [{ id: rootId, depth: 0 }];
  while (walk.length) {
    const { id, depth } = walk.pop();
    const node = nodes.get(id);
    node.depth = depth;
    node.childIds.sort((a, b) => {
      const na = nodes.get(a);
      const nb = nodes.get(b);
      return (isHeadquarters(nb) - isHeadquarters(na))
        || (order[na.kind] - order[nb.kind])
        || (seq.get(a) - seq.get(b));
    });
    for (const c of node.childIds) walk.push({ id: c, depth: depth + 1 });
  }

  return { rootId, warnings };
}
