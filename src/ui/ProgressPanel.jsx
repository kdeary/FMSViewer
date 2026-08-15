import React, { useEffect, useRef, useState } from 'react';

const PHASES = [
  ['read', 'Read'],
  ['decode', 'Decode'],
  ['index', 'Index'],
  ['tree', 'Tree'],
  ['rollups', 'Rollups'],
  ['layout', 'Layout'],
];

/**
 * Eases the bar towards the end of the current phase while the worker is inside
 * a step it can't report from (decoding a big workbook blocks for seconds). It
 * only ever approaches the phase boundary and never crosses it, and a real
 * message from the worker always wins -- so the bar keeps moving without
 * claiming progress that hasn't happened.
 */
function useEasedProgress(progress) {
  const [shown, setShown] = useState(0);
  const state = useRef({ shown: 0, raf: 0 });

  useEffect(() => {
    const floor = progress?.pct ?? 0;
    const ceiling = progress?.end ?? floor;
    state.current.shown = Math.max(state.current.shown, floor);

    const tick = () => {
      const s = state.current.shown;
      const next = Math.max(floor, s + (ceiling - s) * 0.014);
      if (next - s > 0.01) {
        state.current.shown = next;
        setShown(next);
      }
      state.current.raf = requestAnimationFrame(tick);
    };
    state.current.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(state.current.raf);
  }, [progress]);

  return Math.max(shown, progress?.pct ?? 0);
}

/** Parse progress. The work runs in a worker, so this animates the whole time. */
export default function ProgressPanel({ progress, fileName }) {
  const pct = Math.round(useEasedProgress(progress));
  const current = progress?.phase;
  const currentIdx = PHASES.findIndex((p) => p[0] === current);

  return (
    <div className="drop-wrap">
      <div className="progress-card card">
        <div className="card-body">
          <h2 className="h5 card-title mb-1">Building the model</h2>
          <p className="text-body-secondary small text-truncate mb-3">{fileName}</p>

          <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100" style={{ height: '1.4rem' }}>
            <div
              className="progress-bar progress-bar-striped progress-bar-animated"
              style={{ width: `${pct}%` }}
            >
              {pct}%
            </div>
          </div>

          <div className="phase-row mt-3">
            {PHASES.map(([key, label], i) => (
              <span
                key={key}
                className={`phase-pill${i < currentIdx ? ' is-done' : ''}${i === currentIdx ? ' is-active' : ''}`}
              >
                {label}
              </span>
            ))}
          </div>

          <p className="text-body-secondary small mb-0 mt-3">
            {progress?.label || 'Starting…'}
          </p>
        </div>
      </div>
    </div>
  );
}
