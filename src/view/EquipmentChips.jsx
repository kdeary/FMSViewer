import React from 'react';
import { headerHeight } from '../layout/layoutTree.js';

/**
 * Calculates max chips that fit inside the box container in world space.
 * Because all elements scale proportionally with bodyFs, maxFit is constant for a
 * given box rectangle, avoiding DOM layout thrashing during zoom/pan.
 */
function calculateMaxFit(node, limit) {
  const total = node?.equipment?.length || 0;
  if (!total) return 0;

  const maxAllowed = limit ? Math.min(limit, total) : total;
  if (!node?.rect) return maxAllowed;

  const r = node.rect;
  const hh = headerHeight(r);
  const bodyFs = Math.min(r.w * 0.048, r.h * 0.07);

  // Available height inside container box minus header and top/bottom padding
  const padY = Math.max(14, r.h * 0.18);
  const availH = r.h - hh - padY;
  const step = bodyFs * 1.45; // chip height + gap in world units

  if (availH <= 0 || step <= 0) return 1;

  let fit = Math.floor(availH / step);
  if (fit < total && fit < maxAllowed) {
    // Reserve space for the '+N more' chip
    fit = Math.max(1, fit - 1);
  }

  return Math.min(fit, maxAllowed);
}

/**
 * Equipment authorised directly to this node (LIN, nomenclature, quantity, ERC).
 * Dynamically limits shown chips to fit container bounds with '+N more' summary tag.
 */
export default function EquipmentChips({ equipment, limit = 0, node }) {
  if (!equipment || !equipment.length) return null;

  const maxFit = node ? calculateMaxFit(node, limit) : (limit ? Math.min(limit, equipment.length) : equipment.length);
  const shownCount = Math.min(maxFit, equipment.length);
  const shown = equipment.slice(0, shownCount);
  const hidden = equipment.length - shownCount;

  return (
    <ul className="eq-list">
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

