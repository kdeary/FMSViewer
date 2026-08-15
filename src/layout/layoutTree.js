// Assigns every node a rect in a canonical world space, once, in the worker.
// Pan/zoom is then a single CSS transform -- layout never re-runs.

import { squarify } from './squarify.js';
import { isHeadquarters } from '../model/taxonomy.js';

export const WORLD = { x: 0, y: 0, w: 4000, h: 2600 };

// Proportional so a box looks the same at any zoom: the header strip and padding
// are always the same fraction of the box.
export const HEADER_RATIO = 0.115;
export const PAD_RATIO = 0.035;
export const GAP_RATIO = 0.02;
const MAX_HEADER = 90; // world units -- keeps huge containers from wasting space

/** The area inside a container available to its children (below the title strip). */
export function innerRect(rect) {
  const header = Math.min(rect.h * HEADER_RATIO, MAX_HEADER);
  const pad = Math.min(rect.w, rect.h) * PAD_RATIO;
  return {
    x: rect.x + pad,
    y: rect.y + header,
    w: Math.max(rect.w - pad * 2, 1),
    h: Math.max(rect.h - header - pad, 1),
  };
}

export function headerHeight(rect) {
  return Math.min(rect.h * HEADER_RATIO, MAX_HEADER);
}

/**
 * Weight drives box area: mostly headcount, with a small contribution from
 * equipment so that vehicle crews and equipment-heavy sections aren't hairlines.
 *
 * The exponent compresses the range. Raw headcount puts a 2-soldier HQ next to a
 * 28-soldier section, and the treemap answers with a full-height sliver; at 0.65
 * nothing in the sample exceeds a 2.6:1 box while strength ordering still reads
 * clearly (58 pax -> 2.62 area units, 30 -> 1.80, 12 -> 0.98, 6 -> 0.56).
 */
const SIZE_EXPONENT = 0.65;

function weightOf(node) {
  const r = node.roll;
  return Math.pow(Math.max(1, r.mil + r.civ + r.eqLines * 0.15), SIZE_EXPONENT);
}

// How much of a parent the headquarters block may take. Its real weight share
// drives the size, but a command element is never allowed to become a sliver
// or to crowd out the units it commands.
const HQ_MIN_FRACTION = 0.16;
const HQ_MAX_FRACTION = 0.42;

/**
 * Carves the headquarters out of the top-left corner as a proper block, scaled
 * on both axes so it keeps the parent's proportions instead of becoming a
 * full-height strip down one side.
 *
 * That leaves an L, which is covered by two rectangles -- the band to the right
 * and the band below the HQ -- so the remaining children still get clean
 * treemaps. `rightShare` is the fraction of the remaining weight those two
 * areas should split, derived from their areas so box size stays proportional.
 */
function sliceHeadquarters(inner, hqWeight, totalWeight) {
  const share = totalWeight > 0 ? hqWeight / totalWeight : HQ_MIN_FRACTION;
  const frac = Math.min(Math.max(share, HQ_MIN_FRACTION), HQ_MAX_FRACTION);
  const side = Math.sqrt(frac); // same fraction of width and height -> same aspect as the parent
  const w = inner.w * side;
  const h = inner.h * side;

  return {
    hq: { x: inner.x, y: inner.y, w, h },
    right: { x: inner.x + w, y: inner.y, w: inner.w - w, h: inner.h },
    below: { x: inner.x, y: inner.y + h, w, h: inner.h - h },
    rightShare: 1 / (1 + side),
  };
}

/** Splits children between the two leftover bands, keeping each band's fill proportional to its area. */
function splitByShare(items, rightShare) {
  const total = items.length ? items.reduce((s, it) => s + it.weight, 0) : 0;
  const targetRight = total * rightShare;
  const right = [];
  const below = [];
  let accRight = 0;
  let accBelow = 0;

  // Largest first, each going to whichever band is furthest short of its target.
  for (const it of [...items].sort((a, b) => b.weight - a.weight)) {
    if (targetRight - accRight >= (total - targetRight) - accBelow) {
      right.push(it); accRight += it.weight;
    } else {
      below.push(it); accBelow += it.weight;
    }
  }
  return { right, below };
}

function place(node, cell) {
  const gap = Math.min(cell.w, cell.h) * GAP_RATIO;
  node.rect = {
    x: cell.x + gap,
    y: cell.y + gap,
    w: Math.max(cell.w - gap * 2, 0.5),
    h: Math.max(cell.h - gap * 2, 0.5),
  };
  return node.rect.w;
}


export function layoutTree(nodes, rootId, onProgress = () => {}) {
  const root = nodes.get(rootId);
  root.rect = { ...WORLD };

  const queue = [rootId];
  let done = 0;
  const step = Math.max(1, Math.floor(nodes.size / 20));

  while (queue.length) {
    const node = nodes.get(queue.shift());
    done++;

    if (node.childIds.length) {
      const area = innerRect(node.rect);
      const lay = (items, rect) => {
        for (const cell of squarify(items, rect)) {
          place(nodes.get(cell.key), cell);
          queue.push(cell.key);
        }
      };

      // The command element is pinned to the corner rather than being placed by
      // the treemap, so it sits in the same spot on every unit that has one.
      const hqId = node.childIds.find((id) => isHeadquarters(nodes.get(id)));
      const restIds = hqId ? node.childIds.filter((id) => id !== hqId) : node.childIds;
      const items = restIds.map((id) => ({ key: id, weight: weightOf(nodes.get(id)) }));

      if (hqId) {
        const hq = nodes.get(hqId);
        hq.isHq = true;
        queue.push(hqId);

        if (!items.length) {
          place(hq, area);
        } else {
          const total = node.childIds.reduce((s, id) => s + weightOf(nodes.get(id)), 0);
          const cut = sliceHeadquarters(area, weightOf(hq), total);
          place(hq, cut.hq);

          const groups = splitByShare(items, cut.rightShare);
          if (groups.right.length && groups.below.length) {
            lay(groups.right, cut.right);
            lay(groups.below, cut.below);
          } else {
            // One band would have been left empty; give everyone the L's larger
            // half rather than stranding a whole region of the unit.
            lay(items, cut.right.w * cut.right.h >= cut.below.w * cut.below.h ? cut.right : cut.below);
          }
        }
      } else {
        lay(items, area);
      }
    }

    if (done % step === 0) onProgress(done / nodes.size);
  }

  onProgress(1);
  return WORLD;
}
