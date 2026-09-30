import React, { Profiler, useEffect, useReducer, useRef } from 'react';
import NodeBox from './NodeBox.jsx';
import { useScene } from './useScene.js';

// How far a zoom may run on the scaled layout before the boxes are laid out
// again, either way; and how long the camera must be still before the final,
// exact layout.
const MAX_DRIFT = 2;
const SETTLE_MS = 120;

/**
 * The map surface using Screen-Space Virtual DOM.
 * Boxes are positioned and sized in screen pixels, so borders, outlines and
 * text rasterize crisp and 1:1 with the screen at any zoom depth.
 *
 * Except while a zoom is moving. Resizing every box changes every font size in
 * it, and re-laying-out and re-rasterizing all that text each frame is what
 * made zooming (and flying into a unit) stutter where panning never did. So
 * during a zoom the boxes keep the layout they last had -- the "layout camera"
 * -- and one transform on the world scales that to the live camera, which the
 * compositor does for free. The boxes are laid out again for real once the
 * camera settles, or sooner if the scale drifts past MAX_DRIFT. A pan keeps
 * the zoom, so it moves the boxes directly as it always has.
 *
 * Clicks are handled once, here, via `data-id` -- no per-box listeners.
 */
export default function MapCanvas({
  containerRef, model, cam, size, selectedId, focusId, onSelect, flying, minTextPx, perf,
}) {
  // Culling and level of detail follow the live camera, so what's drawn is
  // always right for where the view is; only the boxes' layout lags.
  const { list, stats } = useScene(model, cam, size, minTextPx);

  const layoutRef = useRef(cam);
  const drift = cam.k / layoutRef.current.k;
  if (cam.k === layoutRef.current.k || drift > MAX_DRIFT || drift < 1 / MAX_DRIFT) layoutRef.current = cam;
  const layout = layoutRef.current;

  const [, relayout] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    if (cam.k === layoutRef.current.k) return undefined;
    const t = setTimeout(() => { layoutRef.current = cam; relayout(); }, SETTLE_MS);
    return () => clearTimeout(t);
  }, [cam]);

  // Maps the layout camera's screen onto the live camera's.
  const scale = cam.k / layout.k;
  const worldStyle = cam === layout ? undefined : {
    transform: `translate(${cam.x - layout.x * scale}px, ${cam.y - layout.y * scale}px) scale(${scale})`,
  };

  // Boxes live in slots: a slot keeps its place in the DOM for good, and a box
  // leaving the view frees its slot for the next one to come in, which reuses
  // the element in place. New slots only ever go on the end.
  //
  // This is for the stylesheet's sake. A couple of Bootstrap rules end in a
  // bare :nth-child / :nth-last-child, which the browser checks on every
  // element -- and that marks every container as depending on the order of its
  // children. Inserting or removing a box part-way down the list then
  // re-styles every box after it, contents and all, and zooming shows and hides
  // boxes on nearly every frame. Paint order can't come from DOM order any more,
  // so each box is stacked by its depth in the tree instead (see NodeBox).
  const slotsRef = useRef({ byId: new Map(), free: [], count: 0 });
  const slots = slotsRef.current;
  const live = new Set(list.map((v) => v.node.id));
  for (const [id, i] of slots.byId) {
    if (!live.has(id)) { slots.byId.delete(id); slots.free.push(i); }
  }
  slots.free.sort((a, b) => b - a);
  for (const v of list) {
    if (!slots.byId.has(v.node.id)) {
      slots.byId.set(v.node.id, slots.free.length ? slots.free.pop() : slots.count++);
    }
  }
  const bySlot = new Array(slots.count).fill(null);
  for (const v of list) bySlot[slots.byId.get(v.node.id)] = v;

  const cache = useRef(new Map());
  const nextCache = new Map();

  const children = bySlot.map((v, slot) => {
    if (!v) {
      const hit = cache.current.get(slot);
      const el = hit && !hit.node ? hit.el : <NodeBox key={slot} node={null} cam={layout} />;
      nextCache.set(slot, { sig: '', el, node: null });
      return el;
    }
    const id = v.node.id;
    const selected = id === selectedId;
    const focused = id === focusId;
    const faceStep = Math.round((v.face ?? 1) * 8) / 8;
    const appearStep = Math.round((v.appear ?? 1) * 8) / 8;
    const camXStep = Math.round(layout.x);
    const camYStep = Math.round(layout.y);
    const sig = `${v.view}|${faceStep}|${appearStep}|${layout.k}|${camXStep}|${camYStep}|${selected ? 1 : 0}${focused ? 1 : 0}`;

    const hit = cache.current.get(slot);
    if (hit && hit.sig === sig && hit.node === v.node) {
      nextCache.set(slot, hit);
      return hit.el;
    }

    const el = (
      <NodeBox
        key={slot}
        node={v.node}
        view={v.view}
        face={v.face}
        appear={v.appear}
        cam={layout}
        selected={selected}
        focused={focused}
      />
    );
    nextCache.set(slot, { sig, el, node: v.node });
    return el;
  });

  cache.current = nextCache;

  const onClick = (e) => {
    const surface = e.currentTarget;
    if (surface.dataset.dragged) { surface.dataset.dragged = ''; return; }
    let el = e.target.closest('[data-id]');
    if (!el && document.elementFromPoint) {
      el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-id]');
    }
    if (el) onSelect(el.dataset.id);
  };

  const onCommit = (_id, _phase, actual) => { stats.commit = actual; };

  return (
    <div
      ref={containerRef}
      className={`map-surface${flying ? ' is-flying' : ''}`}
      onClick={onClick}
      role="application"
      aria-label="Force structure map"
    >
      <div className="world" style={worldStyle}>
        <Profiler id="boxes" onRender={onCommit}>{children}</Profiler>
      </div>
      <div className="map-count">{list.length} boxes</div>
      {perf && <PerfReadout stats={stats} />}
    </div>
  );
}

/**
 * Frame timing, sampled in the scene loop.
 */
function PerfReadout({ stats }) {
  const [, redraw] = React.useReducer((n) => n + 1, 0);
  React.useEffect(() => {
    const t = setInterval(redraw, 250);
    return () => clearInterval(t);
  }, []);

  const fps = stats.frame > 0 ? 1000 / stats.frame : 0;
  const js = stats.scene + (stats.commit || 0);
  const rest = Math.max(0, stats.frame - js);
  const row = (label, value, extra = '') => (
    <div className="perf-row"><span>{label}</span><b>{value}</b><i>{extra}</i></div>
  );

  return (
    <div className="perf-hud">
      {row('fps', stats.frame > 0 ? fps.toFixed(0) : '—', `${stats.frame.toFixed(1)} ms/frame`)}
      {row('scene', `${stats.scene.toFixed(2)} ms`, 'cull + layout of detail')}
      {row('react', `${(stats.commit || 0).toFixed(2)} ms`, 'render + commit')}
      {row('browser', `${rest.toFixed(1)} ms`, 'style, paint, raster')}
      {row('worst', `${stats.worst.toFixed(0)} ms`, 'recent peak')}
      {row('boxes', String(stats.boxes), '')}
    </div>
  );
}
