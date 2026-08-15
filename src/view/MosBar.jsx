import React from 'react';
import { useMosInfo } from './MosPalette.jsx';

/**
 * The MOS breakdown -- the headline number for a unit summary, ahead of any
 * duty-position title. A stacked proportional bar plus the codes behind it.
 */
export default function MosBar({ topMos, total, showCodes = true }) {
  const mosInfo = useMosInfo();
  if (!topMos || !topMos.length) return null;
  const sum = total || topMos.reduce((s, m) => s + m.n, 0);
  if (!sum) return null;

  return (
    <div className="mosbar">
      <div className="mosbar-track">
        {topMos.map(({ mos, n }) => (
          <span
            key={mos}
            className="mosbar-seg"
            style={{ width: `${(n / sum) * 100}%`, background: mosInfo(mos).color }}
            title={`${mos} ${mosInfo(mos).label} — ${n}`}
          />
        ))}
      </div>
      {showCodes && (
        // Every code is listed and left to wrap -- a "+N more" chip costs about
        // as much width as the code it hides, and there is normally room on the
        // next line for the real thing.
        <div className="mosbar-codes">
          {topMos.map(({ mos, n }) => (
            <span key={mos} className="mos-chip">
              <i className="mos-dot" style={{ background: mosInfo(mos).color }} />
              {mos}<b>{n}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
