// Squarified treemap (Bruls, Huizing & van Wijk) -- packs weighted items into a
// rect while keeping each cell as close to square as possible.

/**
 * How far from square a cell may get.
 *
 * Hairline boxes are the one layout failure that makes a unit unreadable: body
 * type is sized from the *narrow* side of a box, so a 66x361 section renders its
 * contents at the size a 66x66 box would, in a column that then wraps every
 * label. Measured across the sample sheets 99% of boxes already come out under
 * 3:1, so this bound only bites on the tail -- and it is set slightly under 3
 * because a container's inner rect is a little thinner than the container
 * itself, once the header strip has come off its height.
 *
 * Holding the bound costs exact area proportionality on the boxes that would
 * have broken it. That is the right trade for this map: area is already
 * compressed by SIZE_EXPONENT and eaten by headers and gaps, so it was never a
 * quantity to read off precisely, whereas a box too thin to hold a word is
 * simply lost.
 */
export const MAX_ASPECT = 2.6;

/**
 * Shrinks a rect onto the aspect bound, centred, giving up the difference.
 *
 * Only for a lone child filling its parent, where no sibling wants the space.
 * That case needs it: a container's inner rect is ~15% thinner than the
 * container, so a chain of single-child units -- "Platoon Headquarters" holding
 * nothing but "Platoon Headquarters (WC86A1)" -- multiplies its own thinness at
 * every step until the innermost box is a line. Centring rather than
 * top-anchoring leaves the slack as even margin, which reads as padding instead
 * of as a box that failed to fill.
 */
export function limitAspect(rect, max = MAX_ASPECT) {
  if (rect.w > rect.h * max) {
    const w = rect.h * max;
    return { x: rect.x + (rect.w - w) / 2, y: rect.y, w, h: rect.h };
  }
  if (rect.h > rect.w * max) {
    const h = rect.w * max;
    return { x: rect.x, y: rect.y + (rect.h - h) / 2, w: rect.w, h };
  }
  return rect;
}

function worst(rowSums, rowMin, rowMax, side, scale) {
  const s = rowSums * scale;
  const s2 = s * s;
  const w2 = side * side;
  return Math.max((w2 * rowMax * scale) / s2, s2 / (w2 * rowMin * scale));
}

/**
 * Forces every entry into [lo, hi] while keeping the total at `span`.
 *
 * Clamping one entry has to come out of the others, which can push them out of
 * range in turn, so this repeats -- but only a few times, since each pass either
 * settles or freezes at least one more entry.
 */
function clampLengths(lens, span, lo, hi) {
  if (lens.length * lo > span) {
    // Too many cells to give each the minimum: nothing here can satisfy the
    // bound, so at least fail evenly rather than starving the smallest.
    return lens.map(() => span / lens.length);
  }

  const out = lens.slice();
  for (let pass = 0; pass < 4; pass++) {
    let fixed = 0;
    let free = 0;
    const pinned = out.map((v, i) => {
      const c = Math.min(Math.max(v, lo), hi);
      if (c !== v || out[i] <= lo || out[i] >= hi) { fixed += c; return c; }
      free += v;
      return null;
    });

    const slack = span - fixed;
    if (free <= 0 || slack <= 0) {
      // Everything is pinned; scale back to fit if the minimums overshot.
      const sum = out.reduce((s, v) => s + v, 0);
      return sum > 0 ? out.map((v) => (v * span) / sum) : out;
    }

    let moved = false;
    for (let i = 0; i < out.length; i++) {
      const next = pinned[i] === null ? (out[i] * slack) / free : pinned[i];
      if (Math.abs(next - out[i]) > 1e-9) moved = true;
      out[i] = next;
    }
    if (!moved) break;
  }
  return out;
}

/**
 * Packs `items` (sorted largest-first) into `rect`, appending cells to `out`.
 *
 * The original algorithm lays a row of cells along the rect's short side, then
 * repeats on what is left. Two bounds are layered on top of it, and between them
 * they hold the invariant that every rect this function is handed, and every
 * cell it emits, is within `m` of square:
 *
 *  - A rect that arrives as a strip gets split rather than rowed. A row is the
 *    wrong move there: it runs along the short side, so its cells are as long as
 *    the strip is narrow.
 *  - A row's thickness is capped so the remainder is still wide enough to work
 *    in. This is the bound that mattered. A dominant child takes a row of its
 *    own -- correctly, it packs beautifully -- and leaves a sliver that the last
 *    child then has no choice but to fill end to end. That was the 6.6:1
 *    "Area TMDE" box: a 1.18:1 parent, two children, and no bad decision
 *    anywhere except that the first one used up too much of the width.
 */
function pack(items, rect, out, m) {
  if (!items.length || rect.w <= 1e-6 || rect.h <= 1e-6) return;

  if (items.length === 1) {
    const { key, i } = items[0];
    out.push({ key, i, x: rect.x, y: rect.y, w: rect.w, h: rect.h });
    return;
  }

  // `along` is true when the long axis is x, so a row grows rightwards.
  const along = rect.w >= rect.h;
  const long = along ? rect.w : rect.h;
  const short = along ? rect.h : rect.w;
  const total = items.reduce((s, it) => s + it.weight, 0);

  const at = (v) => (along
    ? { x: rect.x + v.off, y: rect.y + v.pos, w: v.thick, h: v.len }
    : { x: rect.x + v.pos, y: rect.y + v.off, w: v.len, h: v.thick });

  if (long / short > m) {
    // Peel off a block that is about as long as the strip is wide, so both
    // pieces come out workable, and pack each of them independently.
    const target = total * Math.min(short / long, 0.999);
    let acc = 0;
    let n = 0;
    // Always leaves an item behind, so the recursion cannot stall.
    while (n < items.length - 1) {
      const next = acc + items[n].weight;
      if (n > 0 && Math.abs(next - target) > Math.abs(acc - target)) break;
      acc = next;
      n++;
    }

    let cut = long * (acc / total);
    // Each piece needs to stay wide enough to work in. A piece still holding
    // several items may come out a strip -- recursion will split that again --
    // but one down to its last item has to be within the bound already, since
    // that item fills whatever it is given.
    let lo = short / m;
    let hi = long - short / m;
    if (items.length - n === 1) lo = Math.max(lo, long - m * short);
    if (n === 1) hi = Math.min(hi, m * short);
    // Unsatisfiable only when the strip is longer than two bounded pieces can
    // cover between them, i.e. the rect arrived past saving; split the
    // difference so at least the damage is shared.
    cut = lo > hi ? (lo + hi) / 2 : Math.min(Math.max(cut, lo), hi);
    cut = Math.min(Math.max(cut, 1e-6), long - 1e-6);

    pack(items.slice(0, n), at({ off: 0, pos: 0, thick: cut, len: short }), out, m);
    pack(items.slice(n), at({ off: cut, pos: 0, thick: long - cut, len: short }), out, m);
    return;
  }

  // Grow the row while it improves the worst aspect ratio in it.
  const scale = (rect.w * rect.h) / total;
  let sum = 0;
  let min = Infinity;
  let max = 0;
  let best = Infinity;
  let n = 0;
  while (n < items.length) {
    const it = items[n];
    const nSum = sum + it.weight;
    const nMin = Math.min(min, it.weight);
    const nMax = Math.max(max, it.weight);
    const ratio = worst(nSum, nMin, nMax, short, scale);
    if (n && ratio > best) break;
    sum = nSum; min = nMin; max = nMax; best = ratio;
    n++;
  }

  let thick = (sum * scale) / short;
  if (n < items.length) {
    // Keep enough of the long axis for whatever is still unplaced. The area the
    // row gives up is not wasted -- it goes to the remainder, whose scale is
    // recomputed from its own rect on the next call down.
    thick = Math.min(thick, long - short / m);
  }
  thick = Math.min(thick, long);
  if (thick <= 1e-6) return;

  // Cell lengths are proportional to weight within the row whatever the
  // thickness, so capping the thickness above did not disturb them.
  const lens = clampLengths(
    items.slice(0, n).map((it) => (short * it.weight) / sum),
    short, thick / m, thick * m,
  );

  let pos = 0;
  for (let j = 0; j < n; j++) {
    const { key, i } = items[j];
    out.push({ key, i, ...at({ off: 0, pos, thick, len: lens[j] }) });
    pos += lens[j];
  }

  pack(items.slice(n), at({ off: thick, pos: 0, thick: long - thick, len: short }), out, m);
}

/**
 * @param items [{ key, weight }] -- weights must be > 0
 * @param rect  { x, y, w, h }
 * @returns [{ key, x, y, w, h }] in the same order as `items`
 */
export function squarify(items, rect, maxAspect = MAX_ASPECT) {
  const out = [];
  if (!items.length || rect.w <= 0 || rect.h <= 0) return out;

  // A lone child gets the whole rect, so it is the one case where the bound can
  // be held by simply not using all of it.
  if (items.length === 1) {
    return [{ key: items[0].key, ...limitAspect(rect, maxAspect) }];
  }

  // Largest first packs far better; we restore the caller's order at the end.
  const sorted = items
    .map((it, i) => ({ ...it, i, weight: Math.max(it.weight, 1e-6) }))
    .sort((a, b) => b.weight - a.weight);

  pack(sorted, rect, out, maxAspect);

  out.sort((a, b) => a.i - b.i);
  return out.map(({ i: _i, ...cell }) => cell);
}
