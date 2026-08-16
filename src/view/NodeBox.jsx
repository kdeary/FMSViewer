import React from 'react';
import SummaryFace from './SummaryFace.jsx';
import DetailFace from './DetailFace.jsx';
import { useMosInfo } from './MosPalette.jsx';
import { headerHeight } from '../layout/layoutTree.js';

// Rough advance width of the header font, as a fraction of its size. Good
// enough to fit a title without measuring text on every box, every frame.
const CHAR_EM = 0.52;
// A header never shrinks below this on screen -- past here, truncating beats
// unreadable text.
const MIN_HEADER_PX = 11;

/**
 * Header type size, in world units.
 *
 * A size proportional to the box would keep a long title truncated at every
 * zoom, since text and box grow together -- zooming in would never reveal more
 * of it. So the title is allowed to shrink to whatever fits, bounded below by a
 * fixed *on-screen* size. Zoomed out, that floor dominates and the title stays
 * legible but clipped; zoom in and the floor shrinks in world terms, letting
 * the text step down until the whole name fits.
 */
function headerFontSize(node, hh, k) {
  const cap = hh * 0.44;
  const avail = node.rect.w * 0.76; // minus padding, the HQ tag and the count
  const needed = avail / Math.max(1, (node.title || '').length * CHAR_EM);
  return Math.min(cap, Math.max(needed, MIN_HEADER_PX / Math.max(k, 1e-6)));
}

/**
 * One box, positioned in world units. The camera transform lives on an ancestor,
 * so nothing here changes while panning, and `k` arrives quantised so nothing
 * here changes on most frames of a zoom either.
 *
 * Exactly one view is mounted at a time -- `view` says which, `face` is how far
 * through its fade it is. Two views are never on screen together.
 */
function NodeBox({ node, view, face = 1, appear = 1, k, selected, focused }) {
  const mosInfo = useMosInfo();
  const { rect: r, kind } = node;
  const isLeaf = node.childIds.length === 0;
  const hh = headerHeight(r);

  // Type sizes are world units too, so text scales with the box.
  const headFs = headerFontSize(node, hh, k);
  const bodyFs = Math.min(r.w * 0.048, r.h * 0.07);

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
        left: r.x, top: r.y, width: r.w, height: r.h,
        opacity: appear,
        pointerEvents: appear < 0.3 ? 'none' : undefined,
        '--accent': accent,
        '--hh': `${hh}px`,
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

// The scene is rebuilt every frame; memoising keeps re-renders to the boxes
// whose view, face, or zoom actually moved.
export default React.memo(NodeBox, (a, b) => (
  a.node === b.node
  && a.view === b.view
  && a.selected === b.selected
  && a.focused === b.focused
  && Math.abs((a.face ?? 1) - (b.face ?? 1)) < 0.05
  && Math.abs((a.appear ?? 1) - (b.appear ?? 1)) < 0.05
  && a.k === b.k
));
