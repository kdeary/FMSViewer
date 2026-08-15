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

export function computeRollups(nodes, rootId, onProgress = () => {}) {
  const order = postOrder(nodes, rootId);
  const warnings = [];
  const step = Math.max(1, Math.floor(order.length / 25));

  for (let i = 0; i < order.length; i++) {
    const node = nodes.get(order[i]);

    let eqLines = node.equipment.length;
    let eqQty = 0;
    for (const line of node.equipment) eqQty += line.qty;

    const roll = {
      off: 0, wo: 0, enl: 0, civ: 0, mil: 0,
      units: 0, crews: 0, billets: 0,
      eqLines, eqQty,
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
      roll.eqLines += cr.eqLines;
      roll.eqQty += cr.eqQty;
      for (const mos in child.mosCounts) {
        mosCounts[mos] = (mosCounts[mos] || 0) + child.mosCounts[mos];
      }
    }

    roll.mil = roll.off + roll.wo + roll.enl;
    node.roll = roll;
    node.mosCounts = mosCounts;
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
