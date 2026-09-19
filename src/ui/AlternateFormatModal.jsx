import React, { useEffect, useRef } from 'react';

/**
 * Shown before a structure from the alternate FMSWeb export is opened. That
 * format has no parent links, so the hierarchy is a reconstruction; the user
 * has to choose to accept that, and is pointed at the export that doesn't
 * need one.
 */
export default function AlternateFormatModal({ open, fileName, onShowHowTo, onCancel, onContinue }) {
  const howToRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    howToRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onCancel(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <>
      <div
        className="modal d-block alt-format-modal"
        tabIndex="-1"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alt-format-title"
        aria-describedby="alt-format-body"
      >
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content border-warning">
            <div className="modal-header bg-warning-subtle border-warning">
              <h2 id="alt-format-title" className="modal-title h5 mb-0 text-warning-emphasis d-flex align-items-center gap-2">
                <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" />
                This spreadsheet is in the alternate format
              </h2>
            </div>

            <div id="alt-format-body" className="modal-body">
              {fileName && (
                <p className="small text-body-secondary mb-2">
                  <i className="bi bi-file-earmark-spreadsheet me-1" aria-hidden="true" />{fileName}
                </p>
              )}
              <p>
                This export doesn't record which unit each section, vehicle and soldier belongs to. FMSViewer can
                only <strong>guess the structure</strong> from paragraph numbers and titles, so what you see may
                not match the real organization:
              </p>
              <ul className="mb-3">
                <li>Soldiers and vehicles are shown at their section, not in the crew or team they belong to.</li>
                <li>Which platoon a section belongs to is inferred from titles and may be wrong.</li>
                <li>Strength and equipment totals for the whole unit are still complete.</li>
              </ul>
              <div className="alert alert-info d-flex gap-2 mb-0" role="note">
                <i className="bi bi-info-circle-fill mt-1" aria-hidden="true" />
                <div>
                  <strong>For an accurate map, download the standard format instead.</strong> Follow the steps
                  under <em>How do I get the spreadsheet?</em> on the home page: open the document's{' '}
                  <strong>AOS Unit Structure</strong>, click <strong>Download</strong>, and choose{' '}
                  <strong>Spreadsheet</strong>.
                </div>
              </div>
            </div>

            <div className="modal-footer flex-wrap gap-2">
              <button type="button" className="btn btn-outline-warning me-auto" onClick={onContinue}>
                Continue anyway
              </button>
              <button type="button" className="btn btn-secondary" onClick={onCancel}>
                Cancel
              </button>
              <button ref={howToRef} type="button" className="btn btn-info" onClick={onShowHowTo}>
                <i className="bi bi-question-circle me-1" aria-hidden="true" />
                Show me how to get the right format
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}
