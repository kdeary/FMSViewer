import React, { useRef, useState } from 'react';

const SHEET_RE = /\.(xlsx|xlsm|xlsb|xls|csv)$/i;
const MODEL_RE = /\.json$/i;

/** Landing screen: take an FMS Web export, or a model file saved earlier. */
export default function FileDrop({ onSheet, onModel, error }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);

  const handle = (file) => {
    if (!file) return;
    if (MODEL_RE.test(file.name)) onModel(file);
    else onSheet(file);
  };

  return (
    <div className="drop-wrap">
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
        <h2 className="h4">Drop an FMS Web spreadsheet</h2>
        <p className="text-body-secondary mb-1">
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
  );
}

export { SHEET_RE, MODEL_RE };
