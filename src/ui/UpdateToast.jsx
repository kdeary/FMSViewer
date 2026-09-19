import React from 'react';

/**
 * Offered when a newer build has been downloaded while a structure is open.
 * Reloading would close that structure, so it is the user's call; with
 * nothing open the app updates on its own (see App).
 */
export default function UpdateToast({ open, onReload, onLater }) {
  if (!open) return null;
  return (
    <div className="update-toast card shadow-lg border-info" role="status" aria-live="polite">
      <div className="card-body py-2 px-3 d-flex align-items-center gap-3 flex-wrap">
        <i className="bi bi-arrow-repeat fs-4 text-info" aria-hidden="true" />
        <div className="flex-grow-1 small">
          <strong className="d-block">A new version of FMSViewer is available.</strong>
          <span className="text-body-secondary">
            Reloading closes the open structure. Export it first if you want to keep it and its Supplement Table.
          </span>
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onLater}>Later</button>
          <button type="button" className="btn btn-info btn-sm" onClick={onReload}>Reload now</button>
        </div>
      </div>
    </div>
  );
}
