import React, { Profiler, useRef } from 'react';
import NodeBox from './NodeBox.jsx';
import { useScene } from './useScene.js';
import { quantizeK } from './lod.js';

/**
 * The map surface using Screen-Space Virtual DOM.
 * Outer container transform scaling is eliminated, so borders, outlines,
 * and text rasterization remain crisp and 1:1 with screen resolution at any zoom depth.
 *
 * Clicks are handled once, here, via `data-id` -- no per-box listeners.
 */
export default function MapCanvas({
  containerRef, model, cam, size, selectedId, focusId, onSelect, flying, minTextPx, perf,
}) {
  const { list, stats } = useScene(model, cam, size, minTextPx);

  const k = quantizeK(cam.k);

  const cache = useRef(new Map());
  const nextCache = new Map();

  const children = list.map((v) => {
    const id = v.node.id;
    const selected = id === selectedId;
    const focused = id === focusId;
    const faceStep = Math.round((v.face ?? 1) * 8) / 8;
    const appearStep = Math.round((v.appear ?? 1) * 8) / 8;
    const camXStep = Math.round(cam.x);
    const camYStep = Math.round(cam.y);
    const sig = `${v.view}|${faceStep}|${appearStep}|${k}|${camXStep}|${camYStep}|${selected ? 1 : 0}${focused ? 1 : 0}`;

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
        cam={cam}
        selected={selected}
        focused={focused}
      />
    );
    nextCache.set(id, { sig, el, node: v.node });
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
      <div className="world">
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
