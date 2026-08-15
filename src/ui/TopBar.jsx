import React, { useRef } from 'react';
import Breadcrumbs from './Breadcrumbs.jsx';

export default function TopBar({
  model, path, onGo, onExport, onLoadModel, onReset,
  onZoomIn, onZoomOut, onFit, legendOpen, onToggleLegend, warnings, onOpenSettings,
}) {
  const modelInput = useRef(null);
  const { meta } = model;

  return (
    <nav className="navbar navbar-expand bg-body-tertiary border-bottom topbar py-1">
      <div className="container-fluid gap-2 flex-nowrap">
        <span className="navbar-brand mb-0 h1 d-flex align-items-center gap-2">
          <svg className="brand-mark" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="2" y="2" width="20" height="20" rx="3" />
            <rect x="5.5" y="5.5" width="8" height="7" rx="1" />
            <rect x="15" y="5.5" width="3.5" height="7" rx="1" />
            <rect x="5.5" y="14.5" width="13" height="4" rx="1" />
          </svg>
          FMS Viewer
        </span>

        <div className="topbar-meta text-body-secondary small text-truncate d-none d-lg-block">
          <span className="fw-semibold text-body">{meta.uic || '—'}</span>
          <span className="mx-2">·</span>
          <span title={meta.sourceFile}>{meta.sourceFile}</span>
          {meta.runDate && <><span className="mx-2">·</span><span>run {meta.runDate}</span></>}
        </div>

        <div className="flex-grow-1 overflow-hidden">
          <Breadcrumbs path={path} onGo={onGo} />
        </div>

        {warnings?.length > 0 && (
          <button
            type="button"
            className="btn btn-sm btn-outline-warning"
            data-bs-toggle="tooltip"
            title={warnings.join('\n')}
            onClick={() => window.alert(`Model warnings:\n\n${warnings.join('\n')}`)}
          >
            ⚠ {warnings.length}
          </button>
        )}

        <div className="btn-group btn-group-sm" role="group" aria-label="Zoom">
          <button type="button" className="btn btn-outline-secondary" onClick={onZoomOut} title="Zoom out">−</button>
          <button type="button" className="btn btn-outline-secondary" onClick={onFit} title="Fit whole structure (F)">Fit</button>
          <button type="button" className="btn btn-outline-secondary" onClick={onZoomIn} title="Zoom in">+</button>
        </div>

        <button
          type="button"
          className={`btn btn-sm ${legendOpen ? 'btn-secondary' : 'btn-outline-secondary'}`}
          onClick={onToggleLegend}
          title="MOS legend"
        >
          Legend
        </button>

        <div className="btn-group btn-group-sm" role="group">
          <button type="button" className="btn btn-outline-info" onClick={onExport} title="Save the parsed model as JSON">
            Export
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => modelInput.current.click()} title="Load a saved model">
            Load
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={onReset} title="Open a different spreadsheet">
            New
          </button>
        </div>
        <input
          ref={modelInput}
          type="file"
          accept=".json"
          className="d-none"
          onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) onLoadModel(f); }}
        />

        <button
          type="button"
          className="btn btn-sm btn-outline-secondary btn-gear"
          onClick={onOpenSettings}
          title="Settings"
          aria-label="Settings"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="3.2" />
            <path d="M12 2.6l1.5 2.6 3-.4.6 3 2.7 1.3-1.4 2.7 1.4 2.7-2.7 1.3-.6 3-3-.4L12 21.4l-1.5-2.6-3 .4-.6-3-2.7-1.3L5.6 12 4.2 9.3l2.7-1.3.6-3 3 .4z" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
