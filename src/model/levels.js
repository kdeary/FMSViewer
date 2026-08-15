// A representative box width for every depth in the tree.
//
// Level of detail keys off these rather than off each box's own size, so every
// box at the same depth shows the same amount of information at a given zoom.
// Without it, the treemap's own size variation means one soldier shows their
// equipment while the soldier beside them still shows a summary.

export function computeLevels(nodes, rootId) {
  const byDepth = [];
  const stack = [rootId];
  while (stack.length) {
    const node = nodes.get(stack.pop());
    if (!node.rect) continue;
    (byDepth[node.depth] || (byDepth[node.depth] = [])).push(node.rect.w);
    for (const id of node.childIds) stack.push(id);
  }

  return byDepth.map((widths) => {
    if (!widths || !widths.length) return 0;
    const sorted = widths.sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    // Median: a level's typical box, unswayed by one oversized or hairline unit.
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  });
}
