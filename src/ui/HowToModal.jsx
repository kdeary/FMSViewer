import React, { useEffect, useState } from 'react';

// Bundled through Vite rather than referenced by path, so the steps survive a
// production build and pick up hashed filenames. Adding a step8.png is enough
// to add a step.
const shots = Object.entries(
  import.meta.glob('../../images/FMSWebHowTo/step*.png', { eager: true, import: 'default' }),
)
  .map(([path, src]) => [Number((/step(\d+)\.png$/.exec(path) || [])[1] || 0), src])
  .sort((a, b) => a[0] - b[0])
  .map(([, src]) => src);

const CAPTIONS = [
  ['Open FMSWeb', 'Sign in at fmsweb.army.mil. The tools page is the starting point. The Authorization Docs section (top left of the tool list) is where the MTOE/TDA documents are.'],
  ['List by UIC', 'On the MTOE Documents tab, choose "by UIC", type the UIC you want, and click Continue.'],
  ['Pick the document', 'The listing shows every approved document for that UIC. Click the one you want. They are sorted by effective date. Earliest is probably the one you want.'],
  ['AOS Unit Structure', 'From the document toolbar, click "AOS Unit Structure". This is the view that can produce the full position-and-equipment listing.'],
  ['Download', 'Click "Download" above the structure tree.'],
  ['Choose Spreadsheet', 'FMSWeb offers several formats. Pick "Spreadsheet" to get the .xlsx file.'],
  ['Bring it here', 'When the file finishes generating, drop the downloaded .xlsx onto the upload area. Nothing is sent anywhere; it is read in your browser.'],
];

/** The steps to get a structure export out of FMSWeb, as a carousel. */
export default function HowToModal({ open, onClose }) {
  const [i, setI] = useState(0);
  const last = shots.length - 1;

  useEffect(() => {
    if (!open) return undefined;
    setI(0);
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI((n) => Math.min(n + 1, last));
      if (e.key === 'ArrowLeft') setI((n) => Math.max(n - 1, 0));
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose, last]);

  if (!open) return null;
  const [title, body] = CAPTIONS[i] || ['', ''];

  return (
    <>
      <div
        className="modal d-block"
        tabIndex="-1"
        role="dialog"
        aria-modal="true"
        aria-label="Getting a spreadsheet out of FMSWeb"
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="modal-dialog modal-xl modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title h5">Getting the spreadsheet from FMSWeb</h2>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>

            <div className="modal-body">
              <div className="howto-frame">
                {shots.length > 0 ? (
                  <img src={shots[i]} alt={`Step ${i + 1}: ${title}`} className="howto-shot" />
                ) : (
                  <p className="text-body-secondary m-0">No screenshots are bundled.</p>
                )}
              </div>

              <div className="howto-caption">
                <div className="howto-step">Step {i + 1} of {shots.length} — <strong>{title}</strong></div>
                <p className="mb-0">{body}</p>
              </div>

              <div className="howto-nav">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setI((n) => Math.max(n - 1, 0))}
                  disabled={i === 0}
                >
                  ← Back
                </button>
                <div className="howto-dots">
                  {shots.map((src, n) => (
                    <button
                      key={src}
                      type="button"
                      className={`howto-dot${n === i ? ' is-on' : ''}`}
                      aria-label={`Step ${n + 1}`}
                      aria-current={n === i}
                      onClick={() => setI(n)}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setI((n) => Math.min(n + 1, last))}
                  disabled={i === last}
                >
                  Next →
                </button>
              </div>
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
