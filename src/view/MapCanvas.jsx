import React, { Profiler, useRef } from 'react';
import NodeBox from './NodeBox.jsx';
import { useScene } from './useScene.js';
import { quantizeK } from './lod.js';

/**
 * The map surface. Everything lives inside one transformed layer, so panning and
 * zooming is a single composited transform rather than a re-layout.
 *
 * Clicks are handled once, here, via `data-id` -- no per-box listeners.
 */
export default function MapCanvas({
  containerRef, model, cam, size, selectedId, focusId, onSelect, flying, detailPct, perf,
}) {
  const { list, views, stats } = useScene(model, cam, size, detailPct);

  // Boxes see a quantised zoom, never the live one. Everything a box derives
  // from k -- border widths, corner radii, header type size -- would otherwise
  // change on every frame of a zoom, forcing a re-render and a text re-shape
  // for every box on screen. Steps of 4% are invisible and turn that into a
  // handful of updates across an entire zoom.
  const k = quantizeK(cam.k);

  // Elements are cached per box and reused while nothing about that box has
  // changed. Panning shifts one transform on the parent, so most boxes are
  // untouched from frame to frame; handing React the identical element lets it
  // skip them outright instead of rebuilding and diffing every box each frame.
  const cache = useRef(new Map());
  const nextCache = new Map();

  const children = list.map((v) => {
    const id = v.node.id;
    const selected = id === selectedId;
    const focused = id === focusId;
    // Deliberately coarse, and matched to NodeBox's own memo: anything finer
    // invalidates the cache on frames where nothing about the box would look
    // different.
    const sig = `${v.view}|${v.face.toFixed(2)}|${v.appear.toFixed(2)}`
      + `|${k}|${selected ? 1 : 0}${focused ? 1 : 0}`;

    const hit = cache.current.get(id);
    if (hit && hit.sig === sig && hit.node === v.node) {
      nextCache.set(id, hit);
      return hit.el;
    }

    const el = (
      <NodeBox
        key={id}
        node={v.node}
        view={v.view}
        face={v.face}
        appear={v.appear}
        k={k}
        selected={selected}
        focused={focused}
      />
    );
    nextCache.set(id, { sig, el, node: v.node });
    return el;
  });

  // Boxes that left the viewport drop out of the cache with them.
  cache.current = nextCache;

  const onClick = (e) => {
    // A drag that ended on a box shouldn't count as a selection.
    const surface = e.currentTarget;
    if (surface.dataset.dragged) { surface.dataset.dragged = ''; return; }
    let el = e.target.closest('[data-id]');
    // If anything retargeted the event away from the box that was actually
    // under the cursor (pointer capture does exactly this), fall back to a
    // hit-test on the coordinates, which nothing can redirect.
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
      <div
        className="world"
        style={{
          transform: `translate3d(${cam.x}px, ${cam.y}px, 0) scale(${cam.k})`,
          // Borders and radii divide by this so they stay a constant width on
          // screen instead of thickening as you zoom in. Quantised, because a
          // custom property on this element is inherited by every box, and
          // changing it restyles all of them.
          '--k': k,
        }}
      >
        <Profiler id="boxes" onRender={onCommit}>{children}</Profiler>
      </div>
      <div className="map-count">
        {list.length} boxes · {views.filter((v) => v === 'detail').length} levels open
      </div>
      {perf && <PerfReadout stats={stats} />}
    </div>
  );
}

/**
 * Frame timing, sampled in the scene loop. `frame` is the wall clock, so
 * everything the browser does after React hands off -- style, layout, paint,
 * raster -- shows up as the gap between it and the JS columns.
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
