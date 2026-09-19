import React from 'react';

/**
 * A thin labelled progress bar for work that fills in over a few moments --
 * streaming a long table, importing a Supplement Table.
 * `pct` is 0..100.
 */
export default function ProgressStrip({ label, pct }) {
  const value = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className="progress-strip mb-2" role="status" aria-live="polite">
      <div className="d-flex align-items-center gap-2 small text-body-secondary mb-1">
        <span className="spinner-border spinner-border-sm" aria-hidden="true" />
        <span className="flex-grow-1 text-truncate">{label}</span>
        <span className="font-monospace">{value}%</span>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="progress-bar bg-info" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

/** The spinner-and-percentage badge shown on a tab while its content loads. */
export function TabProgress({ pct }) {
  return (
    <span className="tab-progress ms-2" aria-label={`Loading, ${Math.round(pct)} percent`}>
      <span className="spinner-border spinner-border-sm" aria-hidden="true" />
      <span className="font-monospace">{Math.round(pct)}%</span>
    </span>
  );
}
