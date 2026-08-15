// Squarified treemap (Bruls, Huizing & van Wijk) -- packs weighted items into a
// rect while keeping each cell as close to square as possible.

function worst(rowSums, rowMin, rowMax, side, scale) {
  const s = rowSums * scale;
  const s2 = s * s;
  const w2 = side * side;
  return Math.max((w2 * rowMax * scale) / s2, s2 / (w2 * rowMin * scale));
}

/**
 * @param items [{ key, weight }] -- weights must be > 0
 * @param rect  { x, y, w, h }
 * @returns [{ key, x, y, w, h }] in the same order as `items`
 */
export function squarify(items, rect) {
  const out = [];
  if (!items.length || rect.w <= 0 || rect.h <= 0) return out;

  // Largest first packs far better; we restore the caller's order at the end.
  const sorted = items
    .map((it, i) => ({ ...it, i, weight: Math.max(it.weight, 1e-6) }))
    .sort((a, b) => b.weight - a.weight);

  const total = sorted.reduce((s, it) => s + it.weight, 0);
  let { x, y, w, h } = rect;
  // Invariant: remaining area always equals remaining weight * scale, because
  // each row consumes exactly `rowWeight * scale` of area. So scale is constant.
  const scale = (w * h) / total;

  let i = 0;
  while (i < sorted.length) {
    const side = Math.min(w, h);
    const row = [];
    let sum = 0;
    let min = Infinity;
    let max = 0;
    let best = Infinity;

    // Grow the row while it improves the worst aspect ratio in it.
    while (i < sorted.length) {
      const it = sorted[i];
      const nSum = sum + it.weight;
      const nMin = Math.min(min, it.weight);
      const nMax = Math.max(max, it.weight);
      const ratio = worst(nSum, nMin, nMax, side, scale);
      if (row.length && ratio > best) break;
      row.push(it);
      sum = nSum; min = nMin; max = nMax; best = ratio;
      i++;
    }

    // Lay the row along the shorter side, then shrink the remaining rect.
    const thickness = (sum * scale) / side;
    let offset = 0;
    for (const it of row) {
      const length = (it.weight * scale) / thickness;
      if (w >= h) out.push({ key: it.key, i: it.i, x, y: y + offset, w: thickness, h: length });
      else out.push({ key: it.key, i: it.i, x: x + offset, y, w: length, h: thickness });
      offset += length;
    }

    if (w >= h) { x += thickness; w -= thickness; }
    else { y += thickness; h -= thickness; }

    if (w <= 1e-6 || h <= 1e-6) break;
  }

  out.sort((a, b) => a.i - b.i);
  return out.map(({ i: _i, ...cell }) => cell);
}
