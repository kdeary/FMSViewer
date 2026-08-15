import React from 'react';
import { useMosInfo } from './MosPalette.jsx';
import { stripParentheticals } from '../model/taxonomy.js';

/**
 * The MOS breakdown -- the headline number for a unit summary, ahead of any
 * duty-position title. A stacked proportional bar plus the codes behind it.
 */
export default function MosBar({ topMos, total, showCodes = true }) {
  const mosInfo = useMosInfo();
  if (!topMos || !topMos.length) return null;
  const sum = total || topMos.reduce((s, m) => s + m.n, 0);
  if (!sum) return null;

  // Bootstrap tooltips rather than the browser's own: a native title takes a
  // second to appear and can't be styled or placed, and on a bar segment a few
  // pixels wide the label is the only way to read the segment at all. One
  // delegated instance handles them all -- see useTooltips.
  const tip = (mos, n) => {
    const info = mosInfo(mos);
    // Parentheticals go: a tooltip has no room for "(Util Equip Rep)" spelled
    // out next to the words it abbreviates. The branch fallback keeps its own,
    // since "(Officer)" there is the distinction, not a restatement.
    const name = info.title ? stripParentheticals(info.title) : info.label;
    return `${mos} · ${name} · ${n} ${n === 1 ? 'soldier' : 'soldiers'}`;
  };

  return (
    <div className="mosbar">
      <div className="mosbar-track">
        {topMos.map(({ mos, n }) => (
          <span
            key={mos}
            className="mosbar-seg"
            style={{ width: `${(n / sum) * 100}%`, background: mosInfo(mos).color }}
            data-bs-toggle="tooltip"
            data-bs-title={tip(mos, n)}
          />
        ))}
      </div>
      {showCodes && (
        // Every code is listed and left to wrap -- a "+N more" chip costs about
        // as much width as the code it hides, and there is normally room on the
        // next line for the real thing.
        <div className="mosbar-codes">
          {topMos.map(({ mos, n }) => (
            <span
              key={mos}
              className="mos-chip"
              data-bs-toggle="tooltip"
              data-bs-title={tip(mos, n)}
            >
              <i className="mos-dot" style={{ background: mosInfo(mos).color }} />
              {mos}<b>{n}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
