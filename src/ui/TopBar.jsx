import React from 'react';
import Breadcrumbs from './Breadcrumbs.jsx';

const LOGO = `${import.meta.env.BASE_URL}favicon.png`;

/** One icon-only toolbar button; the label is its tooltip and accessible name. */
function IconButton({ icon, label, onClick, active, variant = 'secondary', className = '', children, ...rest }) {
  return (
    <button
      type="button"
      className={`btn btn-sm topbar-btn ${active ? `btn-${variant}` : `btn-outline-${variant}`} ${className}`}
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      {...rest}
    >
      <i className={`bi ${icon}`} aria-hidden="true" />
      {children}
    </button>
  );
}

export default function TopBar({
  path, onGo, onExport, onReset, legendOpen, onToggleLegend, warnings, onOpenSettings,
  searchOpen, onToggleSearch, onOpenStats, onOpenWarnings, treeOpen, onOpenTree, onOpenTutorial,
}) {
  return (
    <nav className="navbar bg-body-tertiary border-bottom topbar py-1">
      <div className="topbar-inner">
        <div className="topbar-tools">
          <div className="btn-group btn-group-sm" role="group" aria-label="File" data-tour="file">
            <IconButton icon="bi-file-earmark-plus" label="New: open a different spreadsheet" onClick={onReset} />
            <IconButton icon="bi-box-arrow-down" label="Export the parsed model" onClick={onExport} variant="info" />
          </div>
          <IconButton icon="bi-search" label="Search within a unit" onClick={onToggleSearch} active={searchOpen} />
          <IconButton icon="bi-diagram-3" label="Unit breakdown tree" onClick={onOpenTree} active={treeOpen} />
          <IconButton icon="bi-bar-chart" label="Unit statistics" onClick={onOpenStats} />
          <IconButton icon="bi-palette" label="MOS legend" onClick={onToggleLegend} active={legendOpen} />
          <IconButton icon="bi-gear" label="Settings" onClick={onOpenSettings} />
          <IconButton
            icon="bi-question-circle"
            label="Tutorial: guided tour of the viewer"
            onClick={onOpenTutorial}
            variant="info"
            data-tour="tutorial-btn"
          />
          {warnings?.length > 0 && (
            <IconButton
              icon="bi-exclamation-triangle-fill"
              label={`${warnings.length} model warning${warnings.length === 1 ? '' : 's'}`}
              onClick={onOpenWarnings}
              variant="warning"
              className="topbar-warn"
              data-tour="warnings-btn"
            >
              <span className="ms-1">{warnings.length}</span>
            </IconButton>
          )}
        </div>

        <div className="topbar-crumbs" data-tour="crumbs">
          <Breadcrumbs path={path} onGo={onGo} />
        </div>

        {/* Clicking the logo returns to the home screen. */}
        <button type="button" className="topbar-logo" onClick={onReset} title="FMSViewer: return to home screen" aria-label="FMSViewer home">
          <img src={LOGO} alt="" width={32} height={32} />
        </button>
      </div>
    </nav>
  );
}
