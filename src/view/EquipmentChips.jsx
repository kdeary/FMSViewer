import React, { useLayoutEffect, useRef, useState } from 'react';

/**
 * Equipment authorised directly to this node (LIN, nomenclature, quantity, ERC).
 * Only mounted at the deepest zoom band -- there are >1,100 lines in a company.
 * Dynamically limits shown chips so they never squish vertically or overflow.
 */
export default function EquipmentChips({ equipment, limit = 0 }) {
  const listRef = useRef(null);
  const total = equipment?.length || 0;
  const initialMax = limit ? Math.min(limit, total) : total;
  const [maxFit, setMaxFit] = useState(initialMax);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el || !total) return;

    const measure = () => {
      const availH = el.clientHeight;
      if (availH <= 0) return;

      const chipEl = el.querySelector('.eq-chip');
      if (!chipEl) return;

      const chipH = chipEl.offsetHeight;
      if (chipH <= 0) return;

      // Small gap between vertical chips (matches 0.12em gap in CSS)
      const gap = 2;
      const step = chipH + gap;
      const maxAllowed = limit ? Math.min(limit, total) : total;

      let fit = 0;
      for (let k = maxAllowed; k >= 0; k--) {
        const isFull = (k === total);
        const totalNeeded = isFull ? (k * step - gap) : ((k + 1) * step - gap);
        if (totalNeeded <= availH) {
          fit = k;
          break;
        }
      }

      setMaxFit((prev) => (prev !== fit ? fit : prev));
    };

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();

    return () => ro.disconnect();
  }, [equipment, limit, total]);

  if (!equipment || !equipment.length) return null;

  const shownCount = Math.min(maxFit, equipment.length);
  const shown = equipment.slice(0, shownCount);
  const hidden = equipment.length - shownCount;

  return (
    <ul className="eq-list" ref={listRef}>
      {shown.map((e, i) => (
        <li className="eq-chip" key={`${e.lin}-${i}`} title={`${e.lin} — ${e.name} (ERC ${e.erc || '—'})`}>
          <span className="eq-lin">{e.lin}</span>
          <span className="eq-name">{e.name}</span>
          {e.qty > 1 && <span className="eq-qty">×{e.qty}</span>}
          {e.erc && <span className="eq-erc">{e.erc}</span>}
        </li>
      ))}
      {hidden > 0 && <li className="eq-chip eq-more">+{hidden} more</li>}
    </ul>
  );
}

