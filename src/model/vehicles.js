// The Vehicles rollup for the data modal: every vehicle in the structure,
// grouped by the unit it sits in, with a running total at each echelon.
//
// A vehicle is an equipment line whose tag is "Vehicle" (the Supplement
// Table's tag, else the keyword guess -- see equipmentTags.js). Vehicles are
// named for the crew that owns them rather than by nomenclature: the FMS gives
// crews titles like "1ST SQD: TRK CREW (M1083)", which become "TRK CREW".

import { titleCut } from './taxonomy.js';

/** Crew title -> vehicle name: everything up to the last ":" and anything in parentheses removed. */
export function crewVehicleName(title) {
  const raw = String(title || '');
  const name = titleCut(raw.slice(raw.lastIndexOf(':') + 1));
  return name || titleCut(raw) || raw.trim();
}

const isPacing = (item) => String(item.erc || '').trim().toUpperCase() === 'P';
// Words for the weapon itself, as against its mount, sight or tools, which share its tag.
const WEAPON_RE = /MACH(INE)? ?GUN|\bMG\b|\bGUN\b|LAUNCHER|\bLCHR\b|\bMK ?19\b|\bM2A?1?\b|\bM240|\bM249|HOWITZER|MORTAR|JAVELIN|\bTOW\b|RIFLE|CARBINE/i;
const ACCESSORY_RE = /MOUNT|\bMT\b|SIGHT|OPTIC|TELESCOPE|\bAN\/P[AEV][QSV]|NIGHT VIS|ILLUMINATOR|AMMO|TOOL|\bKIT\b/i;

/**
 * The item that best stands for a crew's tag group: pacing (ERC P) items
 * first, then for weapons the gun itself over its mount or sight, then the
 * order the sheet lists them.
 */
function primaryOf(items, weapon, names) {
  let best = null;
  let bestScore = Infinity;
  items.forEach((item, i) => {
    const text = names(item);
    let score = (isPacing(item) ? 0 : 2000) + i;
    if (weapon) score += (WEAPON_RE.test(text) ? 0 : 500) + (ACCESSORY_RE.test(text) ? 1000 : 0);
    if (score < bestScore) { best = item; bestScore = score; }
  });
  return best;
}

/**
 * @param model  the loaded structure ({ byId, rootId })
 * @param tagOf  (item) => tag, from the Supplement Table context
 * @param names  (item) => every name it goes by (FMS and Supplement Table), for picking primaries
 * @returns the root unit's entry, or null when there are no vehicles:
 *   { id, title, uic, total, cards, children }
 *   cards: { id, name, ownerKind, unitTitle, vehicles, trailers, largeSystem, weapon, equipment, qty }
 *   `equipment` is everything the crew holds, vehicles included.
 *   `total` is every vehicle in the unit and below it; `qty` a card's own.
 */
export function buildVehicleTree(model, tagOf, names = (item) => item.name || '') {
  if (!model?.rootId) return null;
  const { byId } = model;

  // One card per crew (or billet) holding a vehicle, carrying its trailers,
  // its main system and weapon, and all its own equipment; a crew's soldiers'
  // kit is not included.
  const cardFor = (node, unit) => {
    const byTag = new Map();
    for (const item of node.equipment || []) {
      const tag = tagOf(item);
      if (!byTag.has(tag)) byTag.set(tag, []);
      byTag.get(tag).push(item);
    }
    const vehicles = byTag.get('Vehicle') || [];
    if (!vehicles.length) return null;
    return {
      id: node.id,
      name: node.kind === 'CR' ? crewVehicleName(node.title) : titleCut(node.title),
      ownerKind: node.kind,
      unitTitle: titleCut(unit.title),
      vehicles,
      trailers: byTag.get('Trailer') || [],
      largeSystem: primaryOf(byTag.get('Large Systems/Kits') || [], false, names),
      weapon: primaryOf(byTag.get('Weapon') || [], true, names),
      equipment: node.equipment,
      qty: vehicles.reduce((sum, v) => sum + v.qty, 0),
    };
  };

  const unitEntry = (unit) => {
    const cards = [];
    const children = [];

    // A unit's own vehicles aren't any crew's, so each is its own card, named
    // by what it is.
    for (const item of unit.equipment || []) {
      if (tagOf(item) !== 'Vehicle') continue;
      cards.push({
        id: `${unit.id}|${item.lin || item.name}`,
        name: '',
        ownerKind: 'UN',
        unitTitle: titleCut(unit.title),
        vehicles: [item],
        trailers: [],
        largeSystem: null,
        weapon: null,
        equipment: [item],
        qty: item.qty,
      });
    }

    // Crews and billets belong to this unit down to the next unit below it.
    const stack = [...unit.childIds].reverse();
    while (stack.length) {
      const node = byId.get(stack.pop());
      if (!node) continue;
      if (node.kind === 'UN') {
        const child = unitEntry(node);
        if (child) children.push(child);
        continue;
      }
      const card = cardFor(node, unit);
      if (card) cards.push(card);
      for (let i = node.childIds.length - 1; i >= 0; i--) stack.push(node.childIds[i]);
    }

    const total = cards.reduce((sum, c) => sum + c.qty, 0) + children.reduce((sum, c) => sum + c.total, 0);
    if (!total) return null;
    return { id: unit.id, title: titleCut(unit.title), uic: unit.uic || '', total, cards, children };
  };

  return unitEntry(byId.get(model.rootId));
}
