import React, { useEffect, useState } from 'react';
import { DETAIL_LEVELS, DEFAULT_DETAIL } from '../model/exportImage.js';
import { useMosInfo } from '../view/MosPalette.jsx';

/**
 * Two ways out of the app, each laid out the same way: the controls on the
 * left, what they mean on the right. The model export is the lossless one and
 * sits on top; the image is the one you paste into a brief.
 */
export default function ExportModal({
  open, model, focusNode, onExportModel, onExportImage, onClose,
}) {
  const [scope, setScope] = useState('focus');   // focus | whole
  const [detail, setDetail] = useState(DEFAULT_DETAIL);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mosInfo = useMosInfo();

  const root = model ? model.byId.get(model.rootId) : null;
  // Focusing the root already means the whole structure, so there is nothing
  // for the scope toggle to switch between.
  const focusIsRoot = !focusNode || !root || focusNode.id === root.id;
  const target = scope === 'whole' || focusIsRoot ? root : focusNode;

  useEffect(() => {
    if (!open) return undefined;
    setError('');
    setScope('focus');
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open || !model) return null;

  const level = DETAIL_LEVELS[detail - 1];

  const runImage = async () => {
    setBusy(true);
    setError('');
    try {
      await onExportImage(target.id, detail, (mos) => mosInfo(mos).color);
      onClose();
    } catch (err) {
      setError(err.message || 'The image could not be generated.');
    } finally {
      setBusy(false);
    }
  };

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
        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title h5">Export</h2>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>

            <div className="modal-body">
              {/* ---------------------------------------------- model */}
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
                <div className="export-explain">
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

              {/* ---------------------------------------------- image */}
              <section className="export-card mt-3">
                <div className="export-controls">
                  <h3 className="h6 mb-1">Export image</h3>
                  <p className="text-body-secondary small mb-2">PNG, drawn fresh from the model</p>

                  <label className="form-label small mb-1">Subject</label>
                  <div className="export-target mb-1" title={target ? target.title : ''}>
                    {target ? target.title : '—'}
                  </div>
                  {!focusIsRoot && (
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm w-100 mb-3"
                      onClick={() => setScope((s) => (s === 'focus' ? 'whole' : 'focus'))}
                    >
                      {scope === 'focus' ? 'Use the whole structure' : `Use ${focusNode.title}`}
                    </button>
                  )}
                  {focusIsRoot && (
                    <p className="text-body-secondary small mb-3">
                      Click into a unit on the map to export just that part.
                    </p>
                  )}

                  <label htmlFor="exportDetail" className="form-label small mb-1">
                    Detail — <strong>{level.label}</strong>: {level.note}
                  </label>
                  <input
                    id="exportDetail"
                    type="range"
                    className="form-range"
                    min={1}
                    max={DETAIL_LEVELS.length}
                    step={1}
                    value={detail}
                    onChange={(e) => setDetail(Number(e.target.value))}
                  />
                  <div className="d-flex justify-content-between text-body-secondary small mb-3">
                    <span>{DETAIL_LEVELS[0].label}</span>
                    <span>{DETAIL_LEVELS[DETAIL_LEVELS.length - 1].label}</span>
                  </div>

                  <button
                    type="button"
                    className="btn btn-info w-100"
                    onClick={runImage}
                    disabled={busy || !target}
                  >
                    {busy ? 'Drawing…' : 'Download .png'}
                  </button>
                  {error && <div className="alert alert-danger small mt-2 mb-0">{error}</div>}
                </div>
                <div className="export-explain">
                  <p>
                    A flat picture of the map for a brief or a slide. It is redrawn from the
                    model rather than screenshotted, so it captures the whole subtree at a
                    consistent size.
                  </p>
                  <p className="mb-2">
                    <strong>Detail</strong> sets how far down the tree it draws, not how
                    many pixels it produces.
                  </p>
                  <p className="mb-0 text-body-secondary small">
                    Deeper settings mean smaller boxes, and a box too small to hold its own
                    name is drawn without one.
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
