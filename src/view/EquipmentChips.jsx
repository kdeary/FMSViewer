import React from 'react';

/**
 * Equipment authorised directly to this node (LIN, nomenclature, quantity, ERC).
 * Only mounted at the deepest zoom band -- there are >1,100 lines in a company.
 */
export default function EquipmentChips({ equipment, limit = 0 }) {
  if (!equipment || !equipment.length) return null;
  const shown = limit ? equipment.slice(0, limit) : equipment;
  const hidden = equipment.length - shown.length;

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
