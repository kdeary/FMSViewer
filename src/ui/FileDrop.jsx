import React, { useEffect, useRef, useState } from 'react';
import HowToModal from './HowToModal.jsx';
import exampleImg from '../../images/example.png';
import exampleUnitUrl from '../../data/EXAMPLE_UNIT.xlsx?url';

const SHEET_RE = /\.(xlsx|xlsm|xlsb|xls|csv)$/i;
const MODEL_RE = /\.json$/i;

/** Landing screen: take an FMS Web export, or a model file saved earlier. */
export default function FileDrop({ onSheet, onModel, error }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  const [howTo, setHowTo] = useState(false);
  const [imgModalOpen, setImgModalOpen] = useState(false);
  const [loadingExample, setLoadingExample] = useState(false);

  useEffect(() => {
    if (!imgModalOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setImgModalOpen(false); };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [imgModalOpen]);

  const handle = (file) => {
    if (!file) return;
    if (MODEL_RE.test(file.name)) onModel(file);
    else onSheet(file);
  };

  const loadExampleUnit = async () => {
    try {
      setLoadingExample(true);
      const res = await fetch(exampleUnitUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const file = new File([blob], 'EXAMPLE_UNIT.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      onSheet(file);
    } catch (err) {
      console.error('Could not load example unit:', err);
    } finally {
      setLoadingExample(false);
    }
  };

  return (
    <div className="drop-wrap">
      <div className="landing-grid">
        {/* Left Column: Explanation panel & example image */}
        <div className="landing-left">
          <section className="intro-card">
            <h1 className="h4 mb-2">FMSViewer</h1>
            <p className="text-body-secondary mb-3">
              Turns an FMS Web structure export into a map you can move around in.
              Units are nested inside units, down to individual soldiers and their equipment.
            </p>

            <ul className="intro-points mb-3">
              <li>
                <strong>Zoom and pan.</strong> Explore the hierarchical unit structure.
              </li>
              <li>
                <strong>Search and filter.</strong> Use the search bar to find units by name, UIC, or equipment.
              </li>
              <li>
                <strong>Local processing.</strong> There is no server and no data is uploaded anywhere.
              </li>
            </ul>

            <div className="d-grid gap-2 mb-3">
              <button
                type="button"
                className="btn btn-info btn-sm w-100"
                onClick={loadExampleUnit}
                disabled={loadingExample}
              >
                <i className="bi bi-play-fill me-1" />
                {loadingExample ? 'Loading example…' : 'Use Fake Example Unit'}
              </button>
              <button
                type="button"
                className="btn btn-outline-info btn-sm w-100"
                onClick={() => setHowTo(true)}
              >
                How do I get the spreadsheet?
              </button>
            </div>

            <div className="example-preview mt-auto pt-3">
              <div className="position-relative">
                <img
                  src={exampleImg}
                  alt="Application preview"
                  width={1172}
                  height={768}
                  className="example-img example-img-clickable"
                  onClick={() => setImgModalOpen(true)}
                  title="Click to enlarge preview"
                />
                <div className="example-img-overlay" onClick={() => setImgModalOpen(true)}>
                  <i className="bi bi-arrows-angle-expand me-1" /> Click to enlarge
                </div>
              </div>
              <p className="example-note mb-0">
                <em>Note: All the titles of units and equipment have been altered for security concerns.</em>
              </p>
            </div>
          </section>
        </div>

        {/* Right Column: Dropzone ONLY */}
        <div className="landing-right">
          <div
            className={`drop-zone${over ? ' is-over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files[0]); }}
            onClick={() => inputRef.current.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current.click()}
          >
            <svg className="drop-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 16V4m0 0L7 9m5-5l5 5" />
              <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
            </svg>
            <h2 className="h4 mb-2">Drop an FMS Web spreadsheet</h2>
            <p className="text-body-secondary mb-2">
              or click to browse — <code>.xlsx</code>, <code>.xls</code>, <code>.csv</code>
            </p>
            <p className="text-body-secondary small mb-0">
              A previously exported <code>.fmsmodel.json</code> works too, and loads instantly.
            </p>
            <input
              ref={inputRef}
              type="file"
              className="d-none"
              accept=".xlsx,.xlsm,.xlsb,.xls,.csv,.json"
              onChange={(e) => { handle(e.target.files[0]); e.target.value = ''; }}
            />
          </div>

          {error && (
            <div className="alert alert-danger mt-3 mb-0" role="alert">
              <strong>Could not load that file.</strong>
              <div className="small mt-1">{error}</div>
            </div>
          )}
        </div>
      </div>

      <HowToModal open={howTo} onClose={() => setHowTo(false)} />

      {/* Maximize image preview modal */}
      {imgModalOpen && (
        <>
          <div
            className="modal d-block"
            tabIndex="-1"
            role="dialog"
            aria-modal="true"
            aria-label="Application preview full size"
            onMouseDown={(e) => { if (e.target === e.currentTarget) setImgModalOpen(false); }}
          >
            <div className="modal-dialog modal-fullscreen p-2 p-md-3">
              <div className="modal-content h-100 bg-dark border-secondary">
                <div className="modal-header py-2">
                  <h2 className="modal-title h6 mb-0 text-body">Application Preview</h2>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={() => setImgModalOpen(false)}
                  />
                </div>
                <div className="modal-body d-flex flex-column align-items-center justify-content-center p-2 overflow-auto text-center">
                  <img
                    src={exampleImg}
                    alt="Application preview full size"
                    style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 120px)', objectFit: 'contain' }}
                    className="rounded shadow"
                  />
                  <p className="example-note mt-2 mb-0">
                    <em>Note: All the titles of units and equipment have been altered for security concerns.</em>
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show" />
        </>
      )}
    </div>
  );
}

export { SHEET_RE, MODEL_RE };
