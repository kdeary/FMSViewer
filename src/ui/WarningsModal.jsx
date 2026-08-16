import React, { useEffect } from 'react';

/**
 * Modal to display model parsing warnings instead of a browser alert box.
 */
export default function WarningsModal({ open, warnings = [], onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open || !warnings || warnings.length === 0) return null;

  return (
    <>
      <div
        className="modal d-block"
        tabIndex="-1"
        role="dialog"
        aria-modal="true"
        aria-label="Model Warnings"
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header py-2 d-flex align-items-center justify-content-between">
              <h2 className="modal-title h5 mb-0 text-warning d-flex align-items-center gap-2">
                <i className="bi bi-exclamation-triangle-fill" />
                Model Parsing Warnings ({warnings.length})
              </h2>
              <button type="button" className="btn-close ms-2" aria-label="Close" onClick={onClose} />
            </div>

            <div className="modal-body p-3">
              <p className="text-body-secondary small mb-3">
                The following {warnings.length} warning{warnings.length === 1 ? '' : 's'} were generated while parsing this FMS structure file:
              </p>
              <div className="list-group list-group-flush border rounded overflow-hidden" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                {warnings.map((w, idx) => (
                  <div key={idx} className="list-group-item bg-body-tertiary text-body border-bottom small py-2 px-3 d-flex align-items-start gap-2">
                    <span className="badge bg-warning-subtle text-warning-emphasis fw-bold me-1 mt-0.5">#{idx + 1}</span>
                    <span className="font-monospace text-wrap text-break">{w}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer py-2">
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}
