import React from 'react';
import EquipmentChips from './EquipmentChips.jsx';
import ImagePlaceholder from './ImagePlaceholder.jsx';
import { useMosInfo } from './MosPalette.jsx';

/**
 * The innermost band. A container's detail is simply its children (drawn as
 * their own boxes), so this only has work to do for leaves -- soldiers and
 * crews -- where it shows the position's attributes and its equipment.
 */
export default function DetailFace({ node }) {
  const mosInfo = useMosInfo();
  const isBillet = node.kind === 'BL';
  const info = isBillet ? mosInfo(node.mos) : null;

  return (
    <div className="nb-detail-inner">
      <div className="nb-det-head">
        <ImagePlaceholder node={node} kind={node.kind} label={isBillet ? 'No photo' : 'No image'} />
        <dl className="nb-attrs">
          {isBillet ? (
            <>
              <div><dt>MOS</dt><dd style={{ color: info.text }}>{node.mos || '—'}</dd></div>
              <div><dt>Grade</dt><dd>{node.grade || '—'}</dd></div>
              <div><dt>POSCO</dt><dd>{node.poscode || '—'}</dd></div>
              <div><dt>Para</dt><dd>{node.parno || '—'}</dd></div>
            </>
          ) : (
            <>
              <div><dt>Strength</dt><dd>{node.roll.mil} PAX</dd></div>
              <div><dt>Billets</dt><dd>{node.roll.billets}</dd></div>
              <div><dt>Para</dt><dd>{node.parno || '—'}</dd></div>
              <div><dt>Equip</dt><dd>{node.roll.eqQty}</dd></div>
            </>
          )}
        </dl>
      </div>
      {isBillet && <div className="nb-det-branch">{info.label}</div>}
      <EquipmentChips equipment={node.equipment} node={node} />
    </div>
  );
}
