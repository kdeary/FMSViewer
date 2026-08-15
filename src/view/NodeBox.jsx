import React from 'react';
import SummaryFace from './SummaryFace.jsx';
import DetailFace from './DetailFace.jsx';
import { abbreviate } from '../model/taxonomy.js';
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
 * so nothing here changes while panning.
 *
 * Exactly one view is mounted at a time -- `view` says which, `face` is how far
 * through its fade it is. Two views are never on screen together.
 */
function NodeBox({ node, s, view, face, appear, k, selected, focused }) {
  const mosInfo = useMosInfo();
  const { rect: r, kind } = node;
  const isLeaf = node.childIds.length === 0;
  const hh = headerHeight(r);

  // Type sizes are world units too, so text scales with the box.
  const headFs = headerFontSize(node, hh, k);
  const bodyFs = Math.min(r.w * 0.048, r.h * 0.07);
  const miniFs = Math.min(r.w * 0.17, r.h * 0.3);

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
        // A box that has barely begun fading in shouldn't intercept clicks
        // meant for the parent underneath it.
        pointerEvents: appear < 0.3 ? 'none' : undefined,
        '--accent': accent,
        '--hh': `${hh}px`,
      }}
    >
      <div
        className="nb-content"
        style={{ opacity: face, willChange: face > 0.015 && face < 0.985 ? 'opacity' : undefined }}
      >
        {view === 'mini' ? (
          <div className="nb-mini" style={{ fontSize: miniFs }}>
            <span className="nb-mini-title">{abbreviate(node.title, s < 90 ? 6 : 12)}</span>
            {node.roll.mil > 0 && <span className="nb-mini-n">{node.roll.mil}</span>}
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}

// The scene is rebuilt every frame; memoising keeps re-renders to the boxes
// whose view or fade actually moved.
export default React.memo(NodeBox, (a, b) => (
  a.node === b.node
  && a.view === b.view
  && a.selected === b.selected
  && a.focused === b.focused
  && Math.abs(a.face - b.face) < 0.004
  && Math.abs(a.appear - b.appear) < 0.004
  && Math.abs(a.s - b.s) < 8
  // Only the header size depends on zoom, so sub-percent changes are invisible.
  && Math.abs(a.k - b.k) < b.k * 0.004
));
