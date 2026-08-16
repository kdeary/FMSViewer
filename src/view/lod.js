// Level of detail.
//
// Two rules govern what a box shows:
//
//  1. A box is in exactly one of two views -- never both at once, because a
//     half-faded summary on top of half-faded detail is unreadable. Crossing a
//     threshold plays a transition: the current view fades out, then the new
//     one fades in.
//
//  2. The view is chosen per *depth level*, not per box, from a representative
//     box width for that level (see model/levels.js). Every box at the same
//     depth therefore shows the same amount of information at a given zoom --
//     you never see one soldier's equipment next to another's bare summary.
//
// There used to be a third, "mini" view below summary -- just an abbreviated
// title and a headcount, no header, no MOS mix, nothing you could act on. It's
// gone: a box that's too small to summarise now simply isn't drawn (MIN_S
// already existed for that), so the ladder is either summary or detail, never
// a placeholder in between.

export const MIN_S = 44;          // below this a box isn't drawn at all
export const CULL_MARGIN = 80;    // px of slack around the viewport, so boxes don't pop while panning

/** Default minimum readable text size on screen in pixels at which a unit opens up. */
export const DEFAULT_MIN_TEXT_PX = 10;
export const MIN_TEXT_PX_RANGE = [6, 24];

// Backward compatibility exports
export const DEFAULT_DETAIL_PCT = DEFAULT_MIN_TEXT_PX;
export const DETAIL_PCT_RANGE = MIN_TEXT_PX_RANGE;

const FADE_OUT_MS = 120;
const FADE_IN_MS = 200;
const APPEAR_MS = 220;

/**
 * Calculates the smallest body text font size for a node in world units.
 * Inline styles set .nb-face font size to Math.min(r.w * 0.048, r.h * 0.07).
 * Badges, chips, and sub-labels use ~0.75em relative size.
 */
export function getNodeSmallestTextWorld(node) {
  if (!node?.rect) return 0;
  const { w, h } = node.rect;
  const bodyFs = Math.min(w * 0.048, h * 0.07);
  return bodyFs * 0.75;
}

/**
 * Rule 2: Parent-Scoped Sibling Synchronization.
 * Evaluates the max smallest-text size among a parent's direct sub-units.
 * All sub-units within the same unit transition together so sibling layout stays perfectly synchronized.
 */
export function getNodeEffectiveTextWorld(node, byId) {
  if (!node) return 0;
  if (!node.childIds || !node.childIds.length) return getNodeSmallestTextWorld(node);

  if (node._maxChildTextWorld === undefined) {
    let maxT = 0;
    for (const cid of node.childIds) {
      const child = byId.get(cid);
      if (child) maxT = Math.max(maxT, getNodeSmallestTextWorld(child));
    }
    node._maxChildTextWorld = maxT || getNodeSmallestTextWorld(node);
  }
  return node._maxChildTextWorld;
}

/**
 * Assigns one view per depth in the tree (legacy reference).
 */
export function levelViews(levels, k, viewportW, detailPct) {
  const detail = Math.max(detailPct, 1) / 100;
  const views = [];
  for (let d = 0; d < levels.length; d++) {
    const frac = viewportW > 0 ? (levels[d] * k) / viewportW : 0;
    views[d] = frac >= detail ? 'detail' : 'summary';
  }
  return views;
}

const K_STEP = Math.log(1.04);
export function quantizeK(k) {
  return Math.exp(Math.round(Math.log(Math.max(k, 1e-6)) / K_STEP) * K_STEP);
}

/**
 * Rule 1: The zoom at which a node's smallest text reaches minTextPx on screen.
 */
export function zoomToOpen(nodeOrTextSize, viewportW_or_minTextPx, minTextPx, byId) {
  let textWorld = 0;
  let targetPx = typeof minTextPx === 'number' ? minTextPx : DEFAULT_MIN_TEXT_PX;

  if (typeof nodeOrTextSize === 'number') {
    textWorld = nodeOrTextSize;
  } else if (nodeOrTextSize && typeof nodeOrTextSize === 'object') {
    textWorld = getNodeEffectiveTextWorld(nodeOrTextSize, byId);
  }

  if (typeof viewportW_or_minTextPx === 'number' && typeof minTextPx !== 'number') {
    // If called as zoomToOpen(node, viewportW, threshold, byId)
    targetPx = typeof minTextPx === 'number' ? minTextPx : (typeof viewportW_or_minTextPx === 'number' && viewportW_or_minTextPx < 100 ? viewportW_or_minTextPx : DEFAULT_MIN_TEXT_PX);
  }

  if (!textWorld || !targetPx) return 0;
  return targetPx / textWorld;
}

/**
 * Rule 1 & Rule 2: The zoom floor required to reveal a node, ensuring all parent ancestors
 * up to the root reach the text size threshold as well.
 */
export function zoomToReveal(nodeOrLevels, depthOrModel, viewportW_or_minTextPx, minTextPx) {
  if (!nodeOrLevels) return 0;
  const targetPx = typeof minTextPx === 'number' ? minTextPx : DEFAULT_MIN_TEXT_PX;

  // Signature: zoomToReveal(node, byIdMap, availW, minTextPx)
  if (typeof nodeOrLevels === 'object' && nodeOrLevels.id && depthOrModel instanceof Map) {
    const node = nodeOrLevels;
    const byId = depthOrModel;
    let k = 0;
    let curr = node;
    while (curr) {
      const textWorld = getNodeEffectiveTextWorld(curr, byId);
      if (textWorld) {
        k = Math.max(k, targetPx / textWorld);
      }
      curr = curr.parentId ? byId.get(curr.parentId) : null;
    }
    return k;
  }

  // Legacy fallback
  const levels = nodeOrLevels;
  const depth = depthOrModel;
  let k = 0;
  if (Array.isArray(levels)) {
    for (let d = 0; d < depth; d++) {
      const w = levels[d];
      if (w) k = Math.max(k, zoomToOpen(w, 0, targetPx));
    }
  }
  return k;
}

/**
 * Rule 1: A unit can only show its next level if the size of the smallest piece of text
 * within that unit (on screen) is above minTextPx threshold.
 * Rule 2: All siblings within a specific unit are open at the same level.
 */
export function stepScene(model, cam, size, store, dt, minTextPx) {
  const list = [];
  let animating = false;
  if (!model || !size.w || !size.h) return { list, animating };

  const { byId, rootId } = model;
  const k = cam.k;
  const targetTextPx = Math.max(minTextPx ?? DEFAULT_MIN_TEXT_PX, 1);

  // Viewport in world coordinates, with a margin so boxes fade in just offscreen.
  const m = CULL_MARGIN / k;
  const vx0 = -cam.x / k - m, vy0 = -cam.y / k - m;
  const vx1 = (size.w - cam.x) / k + m, vy1 = (size.h - cam.y) / k + m;

  const seen = new Set();
  const stack = [rootId];

  while (stack.length) {
    const id = stack.pop();
    const node = byId.get(id);
    if (!node) continue;
    const r = node.rect;
    if (!r) continue;

    // Offscreen: skip this box and everything under it.
    if (r.x > vx1 || r.y > vy1 || r.x + r.w < vx0 || r.y + r.h < vy0) continue;

    const s = r.w * k;
    if (s < MIN_S && id !== rootId) continue;

    const isLeaf = node.childIds.length === 0;

    // Own node's smallest rendered text size on screen in pixels:
    const ownTextWorld = getNodeSmallestTextWorld(node);
    const ownTextPx = ownTextWorld * k;

    // Sub-units' synchronized smallest text size on screen in pixels:
    const effTextWorld = getNodeEffectiveTextWorld(node, byId);
    const subUnitsTextPx = effTextWorld * k;

    // Rule 1 & Rule 2:
    // If the text size for the next level (detail / sub-units) is below targetTextPx,
    // show the unit at a more summarized level of detail ('summary').
    // Otherwise, open the next level ('detail').
    const targetView = (subUnitsTextPx >= targetTextPx) ? 'detail' : 'summary';

    let e = store.get(id);
    if (!e) {
      e = { appear: 0, view: targetView, face: 1 };
      store.set(id, e);
    }

    if (e.view !== targetView) {
      e.face -= dt / FADE_OUT_MS;
      if (e.face <= 0) { e.face = 0; e.view = targetView; }
      animating = true;
    } else if (e.face < 1) {
      e.face = Math.min(1, e.face + dt / FADE_IN_MS);
      animating = true;
    }

    seen.add(id);
    if (e.appear < 1) {
      e.appear = Math.min(1, e.appear + dt / APPEAR_MS);
      animating = true;
    }

    list.push({ node, s, view: e.view, face: e.face, appear: e.appear });

    // Children belong to the detail view, so they wait for this node's view to switch to detail.
    if (!isLeaf && e.view === 'detail') {
      for (const childId of node.childIds) stack.push(childId);
    }
  }

  // Anything that left the viewport forgets its state.
  for (const id of store.keys()) if (!seen.has(id)) store.delete(id);

  return { list, animating };
}
