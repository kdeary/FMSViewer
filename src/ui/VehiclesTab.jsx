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
 * Escape closes only that. `onGo(id)` shows a crew on the map.
 */
export default function VehiclesTab({ model, onSubModal, onGo }) {
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
      {crew && <CrewModal card={crew} model={model} onClose={() => setCrew(null)} onGo={onGo} sup={sup} />}
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
              {groupByName(unit.cards, sup).map(({ name, cards }) => (cards.length === 1
                ? <VehicleCard key={cards[0].id} card={cards[0]} onPick={onPick} sup={sup} />
                : (
                  <div key={`g-${cards[0].id}`} className="veh-group" role="group" aria-label={name}>
                    <div className="veh-group-head">
                      <span className="veh-unit-title">{name}</span>
                      <span className="badge bg-primary-subtle text-primary-emphasis" title="Vehicles in this group">
                        <i className="bi bi-truck me-1" aria-hidden="true" />
                        {cards.reduce((sum, c) => sum + c.qty, 0)}
                      </span>
                    </div>
                    <div className="veh-group-row">
                      {cards.map((card) => <VehicleCard key={card.id} card={card} onPick={onPick} sup={sup} />)}
                    </div>
                  </div>
                )))}
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

/** A unit's cards gathered by name, each group where its first card was. */
function groupByName(cards, sup) {
  const groups = new Map();
  for (const card of cards) {
    const name = cardName(card, sup);
    const key = name.toUpperCase();
    if (!groups.has(key)) groups.set(key, { name, cards: [] });
    groups.get(key).cards.push(card);
  }
  return [...groups.values()];
}

/**
 * A card's vehicles, trailers, main system and weapon, one line each with its
 * tag's icon; lines that have nothing to show are left out. With `onOpen`
 * (in the crew modal) each name opens that item's details.
 */
function CardLines({ card, sup, onOpen }) {
  const lines = [
    ...card.vehicles.map((item) => ['Vehicle', item]),
    ...card.trailers.map((item) => ['Trailer', item]),
    ...(card.largeSystem ? [['Large Systems/Kits', card.largeSystem]] : []),
    ...(card.weapon ? [['Weapon', card.weapon]] : []),
  ];
  return (
    <ul className="veh-card-lines">
      {lines.map(([tag, item], i) => {
        const text = sup.displayName(item) || item.lin || '—';
        return (
          <li key={i} className={tag === 'Vehicle' ? 'veh-nomen' : undefined} title={tag}>
            <i className={`bi ${TAG_ICONS[tag]}`} aria-hidden="true" />
            {onOpen
              ? <button type="button" className="eq-link veh-line-text" onClick={() => onOpen(item)}>{text}</button>
              : <span className="veh-line-text">{text}</span>}
            {item.qty > 1 && <span className="eq-qty">×{item.qty}</span>}
          </li>
        );
      })}
    </ul>
  );
}

function VehicleCard({ card, onPick, sup }) {
  const name = cardName(card, sup);
  return (
    <button type="button" className="veh-card" onClick={() => onPick(card)} title={`${name}: show the crew's equipment`}>
      <span className="veh-card-name">
        {name}
        {card.ownerKind === 'UN' && <span className="veh-card-note"> · unit vehicle</span>}
      </span>
      <CardLines card={card} sup={sup} />
    </button>
  );
}

/**
 * The card's lines again, then the crew's equipment in the side panel's
 * Assigned equipment accordion.
 * Stacks over the data modal and under the equipment detail modal, which a
 * nomenclature opens.
 */
function CrewModal({ card, model, onClose, onGo, sup }) {
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
                <h2 className="modal-title h5 mb-0">{name}</h2>
                <div className="small text-body-secondary">{card.unitTitle}</div>
              </div>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>
            <div className="modal-body pb-0">
              <div className="veh-crew-summary">
                <CardLines card={card} sup={sup} onOpen={sup.open} />
              </div>
              <AssignedEquipment node={node} open={listOpen} onToggle={() => setListOpen((v) => !v)} />
            </div>
            <div className="modal-footer py-2 border-top-0">
              {onGo && (
                <button
                  type="button"
                  className="btn btn-outline-info btn-sm me-auto"
                  onClick={() => onGo(card.nodeId)}
                  title={card.ownerKind === 'UN' ? 'Show this unit on the map' : 'Show this crew on the map'}
                >
                  <i className="bi bi-geo-alt-fill me-1" aria-hidden="true" />Show on map
                </button>
              )}
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show veh-crew-backdrop" />
    </>
  );
}
