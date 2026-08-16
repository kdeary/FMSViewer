import React from 'react';
import { KIND_STYLE } from '../model/taxonomy.js';
import { useMosInfo } from '../view/MosPalette.jsx';

/** Colour key for the whole loaded structure, ordered by how common each MOS is. */
export default function Legend({ model, onClose }) {
  // Titles come with the palette; the branch is only a fallback for codes
  // outside the enlisted chapter.
  const mosInfo = useMosInfo();
  const root = model.byId.get(model.rootId);

  return (
    <div className="legend card">
      <div className="card-header d-flex align-items-center justify-content-between py-1">
        <span className="small fw-semibold">Legend</span>
        <button type="button" className="btn-close btn-sm" aria-label="Close" onClick={onClose} />
      </div>
      <div className="card-body py-2 small overflow-auto">
        <div className="text-body-secondary mb-1">Box type</div>
        <ul className="list-unstyled mb-3">
          {Object.entries(KIND_STYLE).map(([kind, style]) => (
            <li key={kind} className="d-flex align-items-center gap-2 mb-1">
              <i className="legend-swatch" style={{ background: style.accent }} />
              {style.label}
            </li>
          ))}
        </ul>

        <div className="text-body-secondary mb-1">MOS ({root.topMos.length})</div>
        <ul className="list-unstyled mb-0">
          {root.topMos.map(({ mos, n }) => {
            const info = mosInfo(mos);
            const rawTitle = info.title || info.label || '';
            const cleanTitle = rawTitle.replace(/\s*\([^)]*\)/g, '').trim();
            return (
              <li key={mos} className="legend-mos d-flex gap-2 mb-1">
                <i className="legend-swatch" style={{ background: info.color }} />
                <span className="font-monospace">{mos}</span>
                <span className="text-body-secondary flex-grow-1" title={cleanTitle}>
                  {cleanTitle}
                </span>
                <span className="fw-semibold">{n}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
