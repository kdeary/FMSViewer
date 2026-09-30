import React from 'react';

/**
 * First-run offer of the guided tour. Deliberately not a modal: no backdrop
 * and no focus grab, so the structure behind it stays usable while it waits.
 */
export default function TutorialOffer({ open, onStart, onDismiss }) {
  if (!open) return null;
  return (
    <aside className="tutorial-offer card shadow-lg" aria-labelledby="tutorial-offer-title">
      <div className="card-body">
        <div className="d-flex align-items-start gap-3">
          <i className="bi bi-signpost-split tutorial-offer-icon" aria-hidden="true" />
          <div className="flex-grow-1">
            <h2 id="tutorial-offer-title" className="h6 mb-1">New to FMSViewer?</h2>
            <p className="small text-body-secondary mb-0">
              Take a guided tour of the viewer. It starts with a quick look at every part, and you can go deeper from there.
            </p>
          </div>
          <button type="button" className="btn-close btn-sm" aria-label="Close" onClick={onDismiss} />
        </div>
        <div className="d-flex justify-content-end gap-2 mt-3">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onDismiss}>No thanks</button>
          <button type="button" className="btn btn-info btn-sm" onClick={onStart}>
            <i className="bi bi-play-fill me-1" aria-hidden="true" />Start tutorial
          </button>
        </div>
      </div>
    </aside>
  );
}
