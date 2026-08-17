import React, { useRef } from 'react';
import Breadcrumbs from './Breadcrumbs.jsx';

export default function TopBar({
  path, onGo, onExport, onLoadModel, onReset,
  onZoomIn, onZoomOut, onFit, legendOpen, onToggleLegend, warnings, onOpenSettings,
  searchOpen, onToggleSearch, onOpenStats, onOpenWarnings,
}) {
  const modelInput = useRef(null);

  return (
    <nav className="navbar navbar-expand bg-body-tertiary border-bottom topbar py-1">
      <div className="container-fluid gap-2 flex-nowrap align-items-center">
        {/* LEFT SIDE: Buttons reordered logically */}
        <div className="d-flex align-items-center gap-2">
          {/* File Operations */}
          <div className="btn-group btn-group-sm" role="group" aria-label="File Operations">
            <button type="button" className="btn btn-outline-secondary" onClick={onReset} title="Open a different spreadsheet">
              New
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => modelInput.current.click()} title="Load a saved model">
              Load
            </button>
            <button type="button" className="btn btn-outline-info" onClick={onExport} title="Save the parsed model as JSON">
              Export
            </button>
          </div>

          {/* Search */}
          <button
            type="button"
            className={`btn btn-sm ${searchOpen ? 'btn-secondary' : 'btn-outline-secondary'} d-flex align-items-center gap-1`}
            onClick={onToggleSearch}
            title="Search within a unit"
            aria-pressed={searchOpen}
          >
            <svg className="icon-search" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="M16 16l4.5 4.5" />
            </svg>
            Search
          </button>

          {/* Stats & Legend */}
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={onOpenStats}
            title="Unit statistics"
          >
            Stats
          </button>

          <button
            type="button"
            className={`btn btn-sm ${legendOpen ? 'btn-secondary' : 'btn-outline-secondary'}`}
            onClick={onToggleLegend}
            title="MOS legend"
          >
            Legend
          </button>

          {/* Zoom controls */}
          <div className="btn-group btn-group-sm" role="group" aria-label="Zoom">
            <button type="button" className="btn btn-outline-secondary" onClick={onZoomOut} title="Zoom out">−</button>
            <button type="button" className="btn btn-outline-secondary" onClick={onFit} title="Fit whole structure (F)">Fit</button>
            <button type="button" className="btn btn-outline-secondary" onClick={onZoomIn} title="Zoom in">+</button>
          </div>

          {/* Settings button (text instead of gear icon) */}
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={onOpenSettings}
            title="Settings"
          >
            Settings
          </button>

          {/* Warnings */}
          {warnings?.length > 0 && (
            <button
              type="button"
              className="btn btn-sm btn-outline-warning d-flex align-items-center gap-1"
              title="View model warnings"
              onClick={onOpenWarnings}
            >
              <i className="bi bi-exclamation-triangle-fill" /> {warnings.length}
            </button>
          )}
        </div>

        {/* MIDDLE: Breadcrumbs trail */}
        <div className="flex-grow-1 overflow-hidden">
          <Breadcrumbs path={path} onGo={onGo} />
        </div>

        {/* RIGHT SIDE: FMS Viewer Brand */}
        <span className="navbar-brand mb-0 h1 d-flex align-items-center gap-2 ms-auto">
          <svg className="brand-mark" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="2" y="2" width="20" height="20" rx="3" />
            <rect x="5.5" y="5.5" width="8" height="7" rx="1" />
            <rect x="15" y="5.5" width="3.5" height="7" rx="1" />
            <rect x="5.5" y="14.5" width="13" height="4" rx="1" />
          </svg>
          FMS Viewer
        </span>

        <input
          ref={modelInput}
          type="file"
          accept=".json"
          className="d-none"
          onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) onLoadModel(f); }}
        />
      </div>
    </nav>
  );
}
