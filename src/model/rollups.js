// Bottom-up aggregation: strength, MOS breakdown and equipment totals for every
// node. Computed from the billet rows rather than trusting the sheet's own UN
// rollups -- but we compare against them and surface any disagreement.

/** Officer / warrant / enlisted from the GRADE prefix ("O-3", "W-3", "E-4"). */
export function categoryOfGrade(grade) {
  const g = String(grade || '').trim().toUpperCase();
  if (g.startsWith('O')) return 'off';
  if (g.startsWith('W')) return 'wo';
  if (g.startsWith('E')) return 'enl';
  if (g.startsWith('C') || g.startsWith('G')) return 'civ'; // civilian pay plans
  return '';
}

/** Post-order traversal without recursion -- deep structures are fine. */
export function postOrder(nodes, rootId) {
  const out = [];
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop();
    out.push(id);
    const node = nodes.get(id);
    for (const c of node.childIds) stack.push(c);
  }
  out.reverse();
  return out;
}

/**
 * Equipment category calculation:
 * Remove all punctuation and spaces from title.
 * Take the first 6 characters and uppercase them all.
 */
export function getEquipmentCategory(name) {
  const clean = String(name || '').replace(/[^a-zA-Z0-9]/g, '');
  return (clean.substring(0, 6) || 'OTHER').toUpperCase();
}

/**
 * Sorts equipment list by:
 * 1. Primary: ERC "P" items first.
 * 2. Secondary: Category total count ASCENDING (least authorized category at top, frequently issued at bottom).
 * 3. Tertiary: Item quantity / name.
 */
export function sortEquipmentList(equipmentList, categoryCountsMap = null) {
  if (!equipmentList || !equipmentList.length) return [];

  let catCounts = categoryCountsMap;
  if (!catCounts) {
    catCounts = new Map();
    for (const item of equipmentList) {
      const cat = getEquipmentCategory(item.name);
      catCounts.set(cat, (catCounts.get(cat) || 0) + (item.qty || 1));
    }
  }

  return [...equipmentList].sort((a, b) => {
    const isP_a = String(a.erc || '').trim().toUpperCase() === 'P' ? 0 : 1;
    const isP_b = String(b.erc || '').trim().toUpperCase() === 'P' ? 0 : 1;
    if (isP_a !== isP_b) return isP_a - isP_b; // ERC "P" comes first

    const catA = getEquipmentCategory(a.name);
    const catB = getEquipmentCategory(b.name);
    const countA = catCounts.get(catA) || 0;
    const countB = catCounts.get(catB) || 0;

    if (countA !== countB) return countA - countB; // Least authorized category count first
    return (a.qty || 1) - (b.qty || 1) || (a.name || '').localeCompare(b.name || '');
  });
}

export function computeRollups(nodes, rootId, onProgress = () => {}) {
  const order = postOrder(nodes, rootId);
  const warnings = [];
  const step = Math.max(1, Math.floor(order.length / 25));

  for (let i = 0; i < order.length; i++) {
    const node = nodes.get(order[i]);

    const eqMap = new Map();
    for (const line of node.equipment) {
      const key = (line.lin || line.name || '').toUpperCase();
      if (!key) continue;
      const existing = eqMap.get(key);
      if (existing) {
        existing.qty += line.qty;
      } else {
        eqMap.set(key, { lin: line.lin || '', name: line.name || '', erc: line.erc || '', qty: line.qty });
      }
    }

    const roll = {
      off: 0, wo: 0, enl: 0, civ: 0, mil: 0,
      units: 0, crews: 0, billets: 0,
      eqLines: 0, eqQty: 0,
    };
    const mosCounts = Object.create(null);

    // A billet counts itself.
    if (node.kind === 'BL') {
      const cat = categoryOfGrade(node.grade);
      if (cat) roll[cat] += 1;
      else roll.enl += 1; // ungraded billets still occupy a seat
      roll.billets = 1;
      if (node.mos) mosCounts[node.mos] = 1;
    }

    for (const childId of node.childIds) {
      const child = nodes.get(childId);
      const cr = child.roll;
      roll.off += cr.off; roll.wo += cr.wo; roll.enl += cr.enl; roll.civ += cr.civ;
      roll.units += cr.units + (child.kind === 'UN' ? 1 : 0);
      roll.crews += cr.crews + (child.kind === 'CR' ? 1 : 0);
      roll.billets += cr.billets;
      for (const mos in child.mosCounts) {
        mosCounts[mos] = (mosCounts[mos] || 0) + child.mosCounts[mos];
      }
      if (child.allEq) {
        for (const item of child.allEq) {
          const key = (item.lin || item.name || '').toUpperCase();
          if (!key) continue;
          const existing = eqMap.get(key);
          if (existing) {
            existing.qty += item.qty;
          } else {
            eqMap.set(key, { ...item });
          }
        }
      }
    }

    // Compute category counts across all items in this node/sub-tree
    const rawAllEq = Array.from(eqMap.values());
    const catCounts = new Map();
    for (const item of rawAllEq) {
      const cat = getEquipmentCategory(item.name);
      catCounts.set(cat, (catCounts.get(cat) || 0) + item.qty);
    }

    // Sort equipment by ERC "P" priority, then category count ASCENDING
    const allEq = sortEquipmentList(rawAllEq, catCounts);
    roll.eqLines = allEq.length;
    roll.eqQty = allEq.reduce((sum, item) => sum + item.qty, 0);

    node.roll = roll;
    node.mosCounts = mosCounts;
    node.allEq = allEq;
    node.catCounts = catCounts;
    // Top MOS codes, precomputed once so the summary face never sorts at render time.
    node.topMos = Object.keys(mosCounts)
      .map((mos) => ({ mos, n: mosCounts[mos] }))
      .sort((a, b) => b.n - a.n || a.mos.localeCompare(b.mos));

    // Cross-check against the sheet's own rollup on unit rows.
    if (node.kind === 'UN' && !node.synthetic && node.sheet.mil && node.sheet.mil !== roll.mil) {
      warnings.push(
        `"${node.title}": sheet reports ${node.sheet.mil} military, computed ${roll.mil}.`,
      );
    }

    if (i % step === 0) onProgress(i / order.length);
  }

  onProgress(1);
  return { warnings: warnings.slice(0, 25), order };
}
