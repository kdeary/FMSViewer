import React, { useEffect, useMemo, useState } from 'react';
import { buildVehicleTree } from '../model/vehicles.js';
import { TAG_ICONS } from '../model/equipmentTags.js';
import { useSupplement, useDetail } from '../view/Supplement.jsx';
import { AssignedEquipment } from './EquipmentSection.jsx';

/**
 * Data modal tab: every vehicle in the structure as a tree of units, each
 * with its vehicle total (itself and everything below it) and a small card per
 * vehicle. A card leads with the crew's name, then the vehicle's nomenclature,
 * its trailer, and the crew's main system and weapon when it has them.
 * Clicking a card opens the crew's equipment.
 *
 * `onSubModal(open)` tells the data modal when the crew modal is up, so
 * Escape closes only that.
 */
export default function VehiclesTab({ model, onSubModal }) {
  const sup = useSupplement();
  const tree = useMemo(() => buildVehicleTree(
    model,
    sup.tagOf,
    (item) => `${item.name || ''} ${sup.getLin(item.lin)?.name || ''}`,
  ), [model, sup]);

  const allIds = useMemo(() => {
    const ids = [];
    const stack = tree ? [tree] : [];
    while (stack.length) {
      const u = stack.pop();
      ids.push(u.id);
      stack.push(...u.children);
    }
    return ids;
  }, [tree]);

  // The top two echelons start open; deeper ones on a click.
  const [open, setOpen] = useState(() => new Set(tree ? [tree.id, ...tree.children.map((c) => c.id)] : []));
  const toggle = (id) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const [crew, setCrew] = useState(null); // the card whose equipment is showing
  useEffect(() => { onSubModal?.(!!crew); }, [crew, onSubModal]);
  useEffect(() => () => onSubModal?.(false), [onSubModal]);

  if (!tree) {
    return (
      <p className="small text-body-secondary mb-0">
        No vehicles were found in this structure. Vehicles are found by their equipment tag: give a LIN the
        &ldquo;Vehicle&rdquo; tag in the Supplement Table if it is missing here.
      </p>
    );
  }

  return (
    <div className="data-pane">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
        <span className="small text-body-secondary">
          <strong className="text-body">{tree.total}</strong> vehicles · each unit's total includes every echelon
          below it · click a card for its crew's equipment
        </span>
        <div className="btn-group btn-group-sm" role="group">
          <button type="button" className="btn btn-outline-secondary" onClick={() => setOpen(new Set(allIds))}>
            <i className="bi bi-arrows-expand me-1" />Expand All
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => setOpen(new Set())}>
            <i className="bi bi-arrows-collapse me-1" />Collapse All
          </button>
        </div>
      </div>
      <div className="stats-table-container veh-tree">
        <VehicleUnit unit={tree} open={open} onToggle={toggle} onPick={setCrew} sup={sup} />
      </div>
      {crew && <CrewModal card={crew} model={model} onClose={() => setCrew(null)} sup={sup} />}
    </div>
  );
}

function VehicleUnit({ unit, open, onToggle, onPick, sup }) {
  const isOpen = open.has(unit.id);
  return (
    <section className="veh-unit">
      <button
        type="button"
        className="veh-unit-head"
        onClick={() => onToggle(unit.id)}
        aria-expanded={isOpen}
      >
        <i className={`bi ${isOpen ? 'bi-chevron-down' : 'bi-chevron-right'} text-body-secondary small`} aria-hidden="true" />
        <span className="veh-unit-title">{unit.title}</span>
        {unit.uic && <span className="badge bg-secondary-subtle text-secondary-emphasis">{unit.uic}</span>}
        <span className="badge bg-primary-subtle text-primary-emphasis ms-auto" title="Vehicles in this unit and below">
          <i className="bi bi-truck me-1" aria-hidden="true" />{unit.total}
        </span>
      </button>
      {isOpen && (
        <div className="veh-unit-body">
          {unit.cards.length > 0 && (
            <div className="veh-cards">
              {unit.cards.map((card) => <VehicleCard key={card.id} card={card} onPick={onPick} sup={sup} />)}
            </div>
          )}
          {unit.children.map((child) => (
            <VehicleUnit key={child.id} unit={child} open={open} onToggle={onToggle} onPick={onPick} sup={sup} />
          ))}
        </div>
      )}
    </section>
  );
}

// A unit's own vehicle has no crew, so its nomenclature is its name.
const cardName = (card, sup) => card.name || sup.displayName(card.vehicles[0]);

function VehicleCard({ card, onPick, sup }) {
  const name = cardName(card, sup);
  const line = (tag, item, label) => (
    <li>
      <i className={`bi ${TAG_ICONS[tag]}`} aria-hidden="true" />
      {label && <span className="text-body-secondary">{label}</span>}
      <span className="veh-line-text">{sup.displayName(item) || item.lin || '—'}</span>
      {item.qty > 1 && <span className="eq-qty">×{item.qty}</span>}
    </li>
  );

  return (
    <button type="button" className="veh-card" onClick={() => onPick(card)} title={`${name}: show the crew's equipment`}>
      <span className="veh-card-name">
        {name}
        {card.ownerKind === 'UN' && <span className="veh-card-note"> · unit vehicle</span>}
      </span>
      <ul className="veh-card-lines">
        {card.vehicles.map((v, i) => (
          <li key={`v-${i}`} className="veh-nomen">
            <i className={`bi ${TAG_ICONS.Vehicle}`} aria-hidden="true" />
            <span className="veh-line-text">{sup.displayName(v) || v.lin || '—'}</span>
            {v.qty > 1 && <span className="eq-qty">×{v.qty}</span>}
            {v.lin && <code className="veh-lin">{v.lin}</code>}
          </li>
        ))}
        {card.trailers.length
          ? card.trailers.map((t, i) => <React.Fragment key={`t-${i}`}>{line('Trailer', t, 'Trailer:')}</React.Fragment>)
          : (
            <li className="text-body-secondary">
              <i className={`bi ${TAG_ICONS.Trailer}`} aria-hidden="true" />No trailer
            </li>
          )}
        {card.largeSystem && line('Large Systems/Kits', card.largeSystem, 'System:')}
        {card.weapon && line('Weapon', card.weapon, 'Weapon:')}
      </ul>
    </button>
  );
}

/**
 * The crew's equipment, in the side panel's Assigned equipment accordion.
 * Stacks over the data modal and under the equipment detail modal, which a
 * nomenclature opens.
 */
function CrewModal({ card, model, onClose, sup }) {
  const { detailOpen } = useDetail();
  const name = cardName(card, sup);
  const [listOpen, setListOpen] = useState(true);
  // A crew's own node; a unit's vehicle stands alone, not with all the unit's kit.
  const node = card.ownerKind === 'UN' ? { equipment: card.equipment } : model.byId.get(card.id);

  useEffect(() => {
    // The equipment detail modal stacks on top of this one and owns Escape while it's up.
    if (detailOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [detailOpen, onClose]);

  return (
    <>
      <div
        className="modal d-block veh-crew-modal"
        tabIndex="-1"
        role="dialog"
        aria-modal="true"
        aria-label={`${name} equipment`}
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header py-2">
              <div className="flex-grow-1" style={{ minWidth: 0 }}>
                <h2 className="modal-title h5 mb-0 text-truncate">{name}</h2>
                <div className="small text-body-secondary text-truncate">{card.unitTitle}</div>
              </div>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>
            <div className="modal-body pt-0">
              <AssignedEquipment node={node} open={listOpen} onToggle={() => setListOpen((v) => !v)} />
            </div>
            <div className="modal-footer py-2 border-top-0">
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show veh-crew-backdrop" />
    </>
  );
}
