import React, { useRef } from 'react';
import NodeBox from './NodeBox.jsx';
import { useScene } from './useScene.js';

/**
 * The map surface. Everything lives inside one transformed layer, so panning and
 * zooming is a single composited transform rather than a re-layout.
 *
 * Clicks are handled once, here, via `data-id` -- no per-box listeners.
 */
export default function MapCanvas({
  containerRef, model, cam, size, selectedId, focusId, onSelect, flying, detailPct,
}) {
  const { list, views } = useScene(model, cam, size, detailPct);

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
    const sig = `${v.view}|${v.face.toFixed(2)}|${v.appear.toFixed(2)}|${Math.round(v.s / 8)}`
      + `|${cam.k.toPrecision(4)}|${selected ? 1 : 0}${focused ? 1 : 0}`;

    const hit = cache.current.get(id);
    if (hit && hit.sig === sig && hit.node === v.node) {
      nextCache.set(id, hit);
      return hit.el;
    }

    const el = (
      <NodeBox
        key={id}
        node={v.node}
        s={v.s}
        view={v.view}
        face={v.face}
        appear={v.appear}
        k={cam.k}
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
          // Borders and radii divide by this so they stay a constant width
          // on screen instead of thickening as you zoom in.
          '--k': cam.k,
        }}
      >
        {children}
      </div>
      <div className="map-count">
        {list.length} boxes · {views.filter((v) => v === 'detail').length} levels open
      </div>
    </div>
  );
}
