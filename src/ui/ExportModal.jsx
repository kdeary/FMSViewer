import React, { useEffect } from 'react';

/**
 * Model export modal (.fmsmodel.json). Lossless export to save and reload
 * structure without parsing Excel files again.
 */
export default function ExportModal({ open, model, onExportModel, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open || !model) return null;

  return (
    <>
      <div
        className="modal d-block"
        tabIndex="-1"
        role="dialog"
        aria-modal="true"
        aria-label="Export"
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="modal-dialog modal-md modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title h5">Export Model</h2>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>

            <div className="modal-body">
              <section className="export-card">
                <div className="export-controls">
                  <h3 className="h6 mb-1">Export model</h3>
                  <p className="text-body-secondary small mb-3">
                    {model.meta.nodeCount} nodes · {model.meta.rowCount} rows
                  </p>
                  <button
                    type="button"
                    className="btn btn-info w-100"
                    onClick={() => { onExportModel(); onClose(); }}
                  >
                    Download .fmsmodel.json
                  </button>
                </div>
                <div className="export-explain mt-3">
                  <p>
                    The whole parsed structure as JSON. Every unit, billet and equipment
                    line, with the layout already computed.
                  </p>
                  <p className="mb-0">
                    Load it back with <strong>Load</strong> to reopen this exact structure
                    without re-reading the spreadsheet, which is the slow part.
                  </p>
                </div>
              </section>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}
