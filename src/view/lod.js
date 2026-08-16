// Level of detail.
//
// Two rules govern what a box shows:
//
//  1. A unit can only show its next level of detail if the smallest text
//     inside its sub-units would be at least `minTextPx` on screen.
//
//  2. All siblings within a specific unit are always at the same level
//     of detail — they open and close together in lockstep.

export const MIN_S = 44;
export const CULL_MARGIN = 80;

export const DEFAULT_MIN_TEXT_PX = 10;
export const MIN_TEXT_PX_RANGE = [6, 24];

const FADE_OUT_MS = 120;
const FADE_IN_MS = 200;
const APPEAR_MS = 220;

/**
 * Smallest body-text font size for a node, in world units.
 * NodeBox sets font-size to Math.min(w * 0.048, h * 0.07); the smallest
 * sub-elements (badges, chips) are ~0.75em of that.
 */
export function getNodeSmallestTextWorld(node) {
  if (!node?.rect) return 0;
  const { w, h } = node.rect;
  return Math.min(w * 0.048, h * 0.07) * 0.75;
}

/**
 * Max smallest-text size among a node's direct children, in world units.
 * All children share this value so they transition together (Rule 2).
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

const K_STEP = Math.log(1.04);
export function quantizeK(k) {
  return Math.exp(Math.round(Math.log(Math.max(k, 1e-6)) / K_STEP) * K_STEP);
}

/**
 * The zoom level at which a node's children become readable (>= minTextPx).
 */
export function zoomToOpen(node, _unused, minTextPx, byId) {
  let textWorld = 0;
  const targetPx = typeof minTextPx === 'number' ? minTextPx : DEFAULT_MIN_TEXT_PX;

  if (typeof node === 'number') {
    textWorld = node;
  } else if (node && typeof node === 'object') {
    textWorld = getNodeEffectiveTextWorld(node, byId);
  }

  if (!textWorld || !targetPx) return 0;
  return targetPx / textWorld;
}

/**
 * The zoom floor required to reveal a node, ensuring every ancestor up to the
 * root also meets the text-size threshold.
 */
export function zoomToReveal(node, byId, _unused, minTextPx) {
  if (!node) return 0;
  const targetPx = typeof minTextPx === 'number' ? minTextPx : DEFAULT_MIN_TEXT_PX;

  if (typeof node === 'object' && node.id && byId instanceof Map) {
    let k = 0;
    let curr = node;
    while (curr) {
      const textWorld = getNodeEffectiveTextWorld(curr, byId);
      if (textWorld) k = Math.max(k, targetPx / textWorld);
      curr = curr.parentId ? byId.get(curr.parentId) : null;
    }
    return k;
  }

  return 0;
}

/**
 * Advances the scene by `dt` ms. Returns the list of boxes to draw and whether
 * any transition is still in flight.
 */
export function stepScene(model, cam, size, store, dt, minTextPx) {
  const list = [];
  let animating = false;
  if (!model || !size.w || !size.h) return { list, animating };

  const { byId, rootId } = model;
  const k = cam.k;
  const targetTextPx = Math.max(minTextPx ?? DEFAULT_MIN_TEXT_PX, 1);

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

    if (r.x > vx1 || r.y > vy1 || r.x + r.w < vx0 || r.y + r.h < vy0) continue;

    const s = r.w * k;
    if (s < MIN_S && id !== rootId) continue;

    const isLeaf = node.childIds.length === 0;

    const effTextWorld = getNodeEffectiveTextWorld(node, byId);
    const subUnitsTextPx = effTextWorld * k;
    const targetView = subUnitsTextPx >= targetTextPx ? 'detail' : 'summary';

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

    if (!isLeaf && e.view === 'detail') {
      for (const childId of node.childIds) stack.push(childId);
    }
  }

  for (const id of store.keys()) if (!seen.has(id)) store.delete(id);

  return { list, animating };
}
