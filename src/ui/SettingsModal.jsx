import React, { useEffect } from 'react';
import { DEFAULT_MIN_TEXT_PX, MIN_TEXT_PX_RANGE } from '../view/lod.js';

const [MIN_PX, MAX_PX] = MIN_TEXT_PX_RANGE;

/**
 * Controlled Bootstrap modal for app settings.
 */
export default function SettingsModal({ open, settings, onChange, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open) return null;
  const textPx = settings.minTextPx ?? DEFAULT_MIN_TEXT_PX;

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
              <h2 className="modal-title h5 mb-0">Settings</h2>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>

            <div className="modal-body">
              <div className="d-flex align-items-center justify-content-between mb-1">
                <label htmlFor="minTextPx" className="form-label mb-0">
                  Minimum readable text size: <strong>{textPx}px</strong> on screen
                </label>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm py-0 px-2"
                  style={{ fontSize: '0.78rem' }}
                  onClick={() => onChange({ ...settings, minTextPx: DEFAULT_MIN_TEXT_PX })}
                  disabled={textPx === DEFAULT_MIN_TEXT_PX}
                  title={`Reset to default ${DEFAULT_MIN_TEXT_PX}px`}
                >
                  Reset ({DEFAULT_MIN_TEXT_PX}px)
                </button>
              </div>

              <input
                id="minTextPx"
                type="range"
                className="form-range"
                min={MIN_PX}
                max={MAX_PX}
                step={1}
                value={textPx}
                onChange={(e) => onChange({ ...settings, minTextPx: Number(e.target.value) })}
              />
              <div className="d-flex justify-content-between text-body-secondary small">
                <span>{MIN_PX}px: opens sooner, smaller text</span>
                <span>{MAX_PX}px: opens later, larger readable text</span>
              </div>

              <p className="text-body-secondary small mt-3 mb-0">
                A unit shows what's inside it once the smallest text inside its sub-units reaches this size on screen.
                All sub-units within the same unit transition together so sibling layout stays perfectly synchronized.
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
              <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>Done</button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}
