import React from 'react';
import MosBar from './MosBar.jsx';
import EquipmentChips from './EquipmentChips.jsx';
import ImagePlaceholder from './ImagePlaceholder.jsx';
import { useMosInfo } from './MosPalette.jsx';

/**
 * What a unit is made of, at a glance: strength, MOS mix, sub-units, equipment.
 * Shown while the box is mid-sized; crossfades out as the inner units appear.
 */
export default function SummaryFace({ node }) {
  const mosInfo = useMosInfo();
  const r = node.roll;
  const isBillet = node.kind === 'BL';

  return (
    <div className="nb-summary-inner">
      <div className="nb-sum-top">
        <ImagePlaceholder kind={node.kind} label={isBillet ? 'No photo' : 'No crest'} />
        <div className="nb-sum-figures">
          {isBillet ? (
            <>
              <div className="nb-big">{node.mos || '—'}</div>
              <div className="nb-sub">
                {node.grade || 'no grade'} · {mosInfo(node.mos).label}
              </div>
            </>
          ) : (
            <>
              <div className="nb-big">
                {r.mil}<span className="nb-unit">pax</span>
              </div>
              <div className="nb-sub">
                {r.off > 0 && <span title="Officers">{r.off} OFF</span>}
                {r.wo > 0 && <span title="Warrant officers"> · {r.wo} WO</span>}
                {r.enl > 0 && <span title="Enlisted"> · {r.enl} ENL</span>}
                {r.civ > 0 && <span title="Civilians"> · {r.civ} CIV</span>}
              </div>
            </>
          )}
        </div>
      </div>

      {!isBillet && <MosBar topMos={node.topMos} total={r.billets} />}

      {/* Equipment authorised directly to this unit -- not the sub-tree total
          in the footer tag below, which would double-count a sub-unit's own
          gear here. A company HQ holding NBC and optics gear is the common
          case this is for; most units carry nothing at this level and the
          block simply doesn't render. */}
      {!isBillet && node.equipment.length > 0 && (
        <EquipmentChips equipment={node.equipment} limit={6} node={node} />
      )}

      <div className="nb-sum-foot">
        {r.units > 0 && <span className="nb-tag">{r.units} units</span>}
        {r.crews > 0 && <span className="nb-tag">{r.crews} crews</span>}
        {!isBillet && r.billets > 0 && <span className="nb-tag">{r.billets} billets</span>}
        {r.eqLines > 0 && (
          <span className="nb-tag nb-tag-eq">
            {r.eqLines} eqp<span className="nb-unit">/{r.eqQty}</span>
          </span>
        )}
      </div>
    </div>
  );
}
