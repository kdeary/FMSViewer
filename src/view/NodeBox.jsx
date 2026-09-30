import React from 'react';
import SummaryFace from './SummaryFace.jsx';
import DetailFace from './DetailFace.jsx';
import { useMosInfo } from './MosPalette.jsx';
import { headerHeight } from '../layout/layoutTree.js';

// Rough advance width of the header font, as a fraction of its size.
const CHAR_EM = 0.52;
// A header never shrinks below this on screen
const MIN_HEADER_PX = 11;

// Type sizes snap to a fixed ladder, 2^(1/16) (about 4.4%) apart. The browser
// measures text per exact font size, and laying out at a size the page hasn't
// used yet costs several times what a size it has seen does. Sizes read
// straight off the zoom were new on every re-layout -- the bulk of what made
// zooming slow on a big structure. On the ladder they keep coming round again.
const FS_STEP = Math.log(2) / 16;
const snapFontSize = (px) => Math.round(Math.exp(Math.round(Math.log(px) / FS_STEP) * FS_STEP) * 100) / 100;

/**
 * Header type size in screen pixels.
 */
function headerFontSize(node, screenW, hh) {
  const cap = hh * 0.46;
  const avail = screenW * 0.76;
  const needed = avail / Math.max(1, (node.title || '').length * CHAR_EM);
  return Math.min(cap, Math.max(needed, MIN_HEADER_PX));
}

/**
 * One box, positioned directly in screen pixels (Screen-Space Virtual DOM).
 * Completely eliminates outer container scale distortion, thick border inflation,
 * and floating-point sub-pixel layout rounding thrashing.
 */
function NodeBox({ node, view, face = 1, appear = 1, cam, selected, focused }) {
  const mosInfo = useMosInfo();
  // An empty slot (see MapCanvas) keeps its element, just hidden, so the next
  // box to need a slot can reuse it without touching the DOM order.
  if (!node) return <div className="nb" hidden />;
  const { rect: r, kind } = node;
  const isLeaf = node.childIds.length === 0;

  // Screen-space coordinates
  const screenX = r.x * cam.k + cam.x;
  const screenY = r.y * cam.k + cam.y;
  const screenW = r.w * cam.k;
  const screenH = r.h * cam.k;

  const hh = Math.max(14, headerHeight(r) * cam.k);
  const headFs = snapFontSize(headerFontSize(node, screenW, hh));
  const bodyFs = snapFontSize(Math.max(9, Math.min(screenW * 0.048, screenH * 0.07)));

  const accent = kind === 'BL' && node.mos ? mosInfo(node.mos).color : undefined;
  const cls = [
    'nb', `nb-${kind}`,
    selected && 'is-selected',
    focused && 'is-focused',
    isLeaf && 'is-leaf',
    node.isHq && 'is-hq',
  ].filter(Boolean).join(' ');

  return (
    <div
      data-id={node.id}
      className={cls}
      style={{
        transform: `translate3d(${screenX.toFixed(2)}px, ${screenY.toFixed(2)}px, 0)`,
        width: `${screenW.toFixed(2)}px`,
        height: `${screenH.toFixed(2)}px`,
        opacity: appear,
        // Stacked by depth: boxes sit in slots, not tree order, so a child's
        // place in the DOM no longer puts it above its parent.
        zIndex: node.depth,
        pointerEvents: appear < 0.3 ? 'none' : undefined,
        '--accent': accent,
        '--hh': `${hh.toFixed(2)}px`,
      }}
    >
      <div
        className="nb-content"
        style={{ opacity: face, willChange: face > 0.015 && face < 0.985 ? 'opacity' : undefined }}
      >
        <div className="nb-head" style={{ fontSize: headFs }}>
          {node.isHq && <span className="nb-hq-tag">HQ</span>}
          <span className="nb-title">{node.title}</span>
          <span className="nb-head-n">
            {node.roll.mil > 0 ? node.roll.mil : ''}
            {kind === 'BL' && node.grade ? ` ${node.grade}` : ''}
          </span>
        </div>

        {view === 'summary' && (
          <div className="nb-face nb-summary" style={{ fontSize: bodyFs }}>
            <SummaryFace node={node} />
          </div>
        )}

        {view === 'detail' && isLeaf && (
          <div className="nb-face nb-detail" style={{ fontSize: bodyFs }}>
            <DetailFace node={node} />
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(NodeBox, (a, b) => (
  a.node === b.node
  && a.view === b.view
  && a.selected === b.selected
  && a.focused === b.focused
  && Math.abs((a.face ?? 1) - (b.face ?? 1)) < 0.05
  && Math.abs((a.appear ?? 1) - (b.appear ?? 1)) < 0.05
  && Math.abs(a.cam.x - b.cam.x) < 0.5
  && Math.abs(a.cam.y - b.cam.y) < 0.5
  && Math.abs(a.cam.k - b.cam.k) < 0.001
));
