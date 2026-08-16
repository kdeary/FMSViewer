import React, { useEffect } from 'react';
import { DEFAULT_DETAIL_PCT, DETAIL_PCT_RANGE } from '../view/lod.js';

const [MIN_PCT, MAX_PCT] = DETAIL_PCT_RANGE;

/**
 * Controlled Bootstrap modal. Rendered by hand rather than through the
 * Bootstrap JS bundle so its open state stays owned by React.
 */
export default function SettingsModal({ open, settings, onChange, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open) return null;
  const pct = settings.detailPct;

  return (
    <>
      <div
        className="modal d-block"
        tabIndex="-1"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title h5">Settings</h2>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>

            <div className="modal-body">
              <label htmlFor="detailPct" className="form-label mb-1">
                Open a unit at <strong>{pct}%</strong> of viewport width
              </label>
              <input
                id="detailPct"
                type="range"
                className="form-range"
                min={MIN_PCT}
                max={MAX_PCT}
                step={1}
                value={pct}
                onChange={(e) => onChange({ ...settings, detailPct: Number(e.target.value) })}
              />
              <div className="d-flex justify-content-between text-body-secondary small">
                <span>{MIN_PCT}%: opens sooner, more on screen</span>
                <span>{MAX_PCT}%: opens later, less clutter</span>
              </div>

              <p className="text-body-secondary small mt-3 mb-0">
                A unit shows what's inside it once a typical box at its level covers this
                much of the viewport width. The threshold applies to a whole level at a
                time, so every unit at the same depth always shows the same amount of
                detail.
              </p>

              <hr />

              <div className="form-check">
                <input
                  id="perfHud"
                  type="checkbox"
                  className="form-check-input"
                  checked={!!settings.perf}
                  onChange={(e) => onChange({ ...settings, perf: e.target.checked })}
                />
                <label htmlFor="perfHud" className="form-check-label">Show frame timings</label>
              </div>
              <p className="text-body-secondary small mt-1 mb-0">
                Overlays a live breakdown of where each frame goes. Anything the browser
                spends on style, paint and raster is the gap between the total and the two
                JavaScript figures.
              </p>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => onChange({ ...settings, detailPct: DEFAULT_DETAIL_PCT })}
                disabled={pct === DEFAULT_DETAIL_PCT}
              >
                Reset to {DEFAULT_DETAIL_PCT}%
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>Done</button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}
