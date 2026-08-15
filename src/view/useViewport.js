import { useCallback, useEffect, useRef, useState } from 'react';

// Camera over the world: screen = world * k + (x, y).
// One transform on one element -- children never re-layout when panning.

export const MIN_K = 0.02;
export const MAX_K = 60;
export const FLY_MS = 620;

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Camera that fits `rect` inside `size` with a margin, centred.
 * `minK` forces a closer zoom than the fit when the caller needs one -- the
 * rect then overflows the viewport, still centred on the same point.
 */
export function fitTo(rect, size, margin = 0.86, minK = 0) {
  if (!rect || !size.w || !size.h) return { x: 0, y: 0, k: 1 };
  const fit = Math.min((size.w / rect.w) * margin, (size.h / rect.h) * margin);
  const k = clamp(Math.max(fit, minK), MIN_K, MAX_K);
  return {
    k,
    x: size.w / 2 - (rect.x + rect.w / 2) * k,
    y: size.h / 2 - (rect.y + rect.h / 2) * k,
  };
}

export function useViewport() {
  const [cam, setCam] = useState({ x: 0, y: 0, k: 1 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [flying, setFlying] = useState(false);

  // The map surface doesn't exist until a file has been loaded, so this has to
  // be a callback ref: a plain ref would still be null when the effects below
  // first run, and their deps would never change to re-attach them.
  const [el, setEl] = useState(null);
  const elRef = useRef(null);
  const surfaceRef = useCallback((node) => { elRef.current = node; setEl(node); }, []);

  const camRef = useRef(cam);
  camRef.current = cam;
  const flightRef = useRef(null);

  /** Stops any in-flight animation. Called by every direct user gesture. */
  const cancelFlight = useCallback(() => {
    if (flightRef.current) {
      cancelAnimationFrame(flightRef.current.raf);
      flightRef.current = null;
      setFlying(false);
    }
  }, []);

  /**
   * Animate the camera to frame `rect`. Interpolating k in log space keeps the
   * apparent speed even across large zoom changes.
   */
  const flyTo = useCallback((rect, opts = {}) => {
    const node = elRef.current;
    if (!node || !rect) return;
    const box = { w: node.clientWidth, h: node.clientHeight };
    const target = fitTo(rect, box, opts.margin ?? 0.86, opts.minK ?? 0);
    const from = camRef.current;

    if (opts.instant) { cancelFlight(); setCam(target); return; }

    cancelFlight();
    // Taken from the first frame rather than performance.now(): the timestamp
    // passed to a rAF callback need not share an origin with performance.now(),
    // and a negative delta would stall the flight at t=0 forever.
    let t0 = null;
    const dur = opts.duration ?? FLY_MS;
    const logFrom = Math.log(from.k);
    const logTo = Math.log(target.k);
    setFlying(true);

    const tick = (now) => {
      if (t0 === null) t0 = now;
      const t = clamp((now - t0) / dur, 0, 1);
      const e = easeInOutCubic(t);
      setCam({
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e,
        k: Math.exp(logFrom + (logTo - logFrom) * e),
      });
      if (t < 1) flightRef.current.raf = requestAnimationFrame(tick);
      else { flightRef.current = null; setFlying(false); }
    };
    flightRef.current = { raf: requestAnimationFrame(tick) };
  }, [cancelFlight]);

  const zoomBy = useCallback((factor, originX, originY) => {
    cancelFlight();
    setCam((c) => {
      const k = clamp(c.k * factor, MIN_K, MAX_K);
      const scale = k / c.k;
      // Keep the world point under the origin pinned to the origin.
      return { k, x: originX - (originX - c.x) * scale, y: originY - (originY - c.y) * scale };
    });
  }, [cancelFlight]);

  // Track container size.
  useEffect(() => {
    if (!el) return undefined;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [el]);

  // Wheel zoom, drag pan, pinch. Non-passive so we can preventDefault the page scroll.
  useEffect(() => {
    if (!el) return undefined;

    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      // Trackpads report small deltas in lines/pixels; normalise to a gentle curve.
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? r.height : 1;
      const factor = Math.exp(-e.deltaY * unit * 0.0016);
      zoomBy(factor, e.clientX - r.left, e.clientY - r.top);
    };

    let drag = null;
    const onPointerDown = (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      drag = { id: e.pointerId, px: e.clientX, py: e.clientY, moved: 0, captured: false };
    };
    const onPointerMove = (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.px;
      const dy = e.clientY - drag.py;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      drag.px = e.clientX; drag.py = e.clientY;
      if (drag.moved > 3) {
        // Capture only once a drag is really under way -- never on pointerdown.
        // A capturing element also receives the compatibility `click`, so
        // capturing up front retargets every click from the box the user aimed
        // at to this surface, and clicking a unit does nothing at all.
        if (!drag.captured) {
          drag.captured = true;
          try { el.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
        }
        cancelFlight();
        el.classList.add('is-panning');
        setCam((c) => ({ ...c, x: c.x + dx, y: c.y + dy }));
      }
    };
    const onPointerUp = (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      if (drag.captured && el.hasPointerCapture && el.hasPointerCapture(e.pointerId)) {
        el.releasePointerCapture(e.pointerId);
      }
      // A click that moved the camera shouldn't also select a box.
      el.dataset.dragged = drag.moved > 4 ? '1' : '';
      el.classList.remove('is-panning');
      drag = null;
    };

    // Two-finger pinch.
    const touches = new Map();
    let pinch = null;
    const onTouchStart = (e) => {
      for (const t of e.changedTouches) touches.set(t.identifier, t);
      if (touches.size === 2) {
        const [a, b] = [...touches.values()];
        pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) };
      }
    };
    const onTouchMove = (e) => {
      for (const t of e.changedTouches) if (touches.has(t.identifier)) touches.set(t.identifier, t);
      if (touches.size === 2 && pinch) {
        e.preventDefault();
        const [a, b] = [...touches.values()];
        const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const r = el.getBoundingClientRect();
        if (pinch.d > 0) {
          zoomBy(d / pinch.d, (a.clientX + b.clientX) / 2 - r.left, (a.clientY + b.clientY) / 2 - r.top);
        }
        pinch.d = d;
      }
    };
    const onTouchEnd = (e) => {
      for (const t of e.changedTouches) touches.delete(t.identifier);
      if (touches.size < 2) pinch = null;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [el, zoomBy, cancelFlight]);

  useEffect(() => () => cancelFlight(), [cancelFlight]);

  return { surfaceRef, cam, size, flying, flyTo, zoomBy, cancelFlight, setCam };
}
