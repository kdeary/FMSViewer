// Level of detail.
//
// Two rules govern what a box shows:
//
//  1. A box is in exactly one of three views -- never two at once, because a
//     half-faded summary on top of half-faded detail is unreadable. Crossing a
//     threshold plays a transition: the current view fades out, then the new
//     one fades in.
//
//  2. The view is chosen per *depth level*, not per box, from a representative
//     box width for that level (see model/levels.js). Every box at the same
//     depth therefore shows the same amount of information at a given zoom --
//     you never see one soldier's equipment next to another's bare summary.

export const MIN_S = 44;          // below this a box isn't drawn at all
export const CULL_MARGIN = 80;    // px of slack around the viewport, so boxes
                                  // don't pop while panning

/** Default for the user-facing setting: % of viewport width at which a level opens. */
export const DEFAULT_DETAIL_PCT = 22;
export const DETAIL_PCT_RANGE = [6, 60];

// The mini -> summary step sits at a fixed fraction of the detail threshold, so
// the single setting moves the whole ladder coherently.
const SUMMARY_RATIO = 0.34;
// No hysteresis: a level's view is a pure function of the zoom, so the same
// zoom always shows the same thing. An earlier version made opening sticky,
// which meant zooming into a unit and then hitting Fit left the overview opened
// up -- one zoom, two possible pictures, depending on how you got there.
// Levels key off zoom alone and never change while panning, so there is nothing
// here for a stability margin to protect against.

// A transition is deliberately quick, and asymmetric: the outgoing view clears
// out faster than the incoming one arrives, so the box is never crowded.
const FADE_OUT_MS = 120;
const FADE_IN_MS = 200;
const APPEAR_MS = 220;

/**
 * Assigns one view to every depth in the tree.
 * @param levels representative box width per depth, in world units
 */
export function levelViews(levels, k, viewportW, detailPct) {
  const detail = Math.max(detailPct, 1) / 100;
  const summary = detail * SUMMARY_RATIO;
  const views = [];

  for (let d = 0; d < levels.length; d++) {
    const frac = viewportW > 0 ? (levels[d] * k) / viewportW : 0;
    views[d] = frac >= detail ? 'detail' : frac >= summary ? 'summary' : 'mini';
  }
  return views;
}

/**
 * The zoom at which a given depth opens up. Clicking a unit is a request to see
 * inside it, so the camera has to land somewhere that actually opens its level.
 */
export function zoomToOpen(levels, depth, viewportW, detailPct) {
  const w = levels && levels[depth];
  if (!w || !viewportW) return 0;
  return ((detailPct / 100) * viewportW * 1.04) / w;
}

/**
 * Advances the scene by `dt` milliseconds and returns what to draw.
 *
 * `store` holds each box's animation state between frames, keyed by node id.
 * Anything outside the viewport is skipped before any of that work happens --
 * offscreen boxes cost one rectangle comparison and nothing else, and a subtree
 * whose parent is offscreen is never even visited.
 *
 * @returns {{ list, animating }} `animating` is true while any box is mid-transition
 */
export function stepScene(model, cam, size, store, dt, views, levelState) {
  const list = [];
  let animating = false;
  if (!model || !size.w || !size.h) return { list, animating };

  // Transitions run per level, not per box. Every box at a depth therefore
  // shares one view and one fade position -- including a box that scrolls into
  // the viewport midway through, which would otherwise arrive already showing
  // the new view while its siblings were still fading out of the old one.
  for (let d = 0; d < views.length; d++) {
    let st = levelState[d];
    if (!st) { st = { view: views[d], face: 0 }; levelState[d] = st; }
    if (st.view !== views[d]) {
      st.face -= dt / FADE_OUT_MS;
      if (st.face <= 0) { st.face = 0; st.view = views[d]; }
      animating = true;
    } else if (st.face < 1) {
      st.face = Math.min(1, st.face + dt / FADE_IN_MS);
      animating = true;
    }
  }

  const { byId, rootId } = model;
  const k = cam.k;
  // Viewport in world coordinates, with a margin so boxes fade in just offscreen.
  const m = CULL_MARGIN / k;
  const vx0 = -cam.x / k - m, vy0 = -cam.y / k - m;
  const vx1 = (size.w - cam.x) / k + m, vy1 = (size.h - cam.y) / k + m;

  const seen = new Set();
  const stack = [rootId];

  while (stack.length) {
    const id = stack.pop();
    const node = byId.get(id);
    const r = node.rect;

    // Offscreen: skip this box and everything under it. Children are always
    // contained by their parent, so nothing visible can be missed here.
    if (r.x > vx1 || r.y > vy1 || r.x + r.w < vx0 || r.y + r.h < vy0) continue;

    const s = r.w * k;
    if (s < MIN_S && id !== rootId) continue;

    const isLeaf = node.childIds.length === 0;
    const level = levelState[node.depth] || { view: 'mini', face: 1 };

    // The only per-box animation left: fading in as it enters the viewport.
    let e = store.get(id);
    if (!e) { e = { appear: 0 }; store.set(id, e); }
    seen.add(id);
    if (e.appear < 1) {
      e.appear = Math.min(1, e.appear + dt / APPEAR_MS);
      animating = true;
    }

    list.push({ node, s, view: level.view, face: level.face, appear: e.appear });

    // Children belong to the detail view, so they wait for the switch to land.
    if (!isLeaf && level.view === 'detail') {
      for (const childId of node.childIds) stack.push(childId);
    }
  }

  // Anything that left the viewport forgets its state, so it fades in again
  // when it returns and the store never grows past what's on screen.
  for (const id of store.keys()) if (!seen.has(id)) store.delete(id);

  return { list, animating };
}
