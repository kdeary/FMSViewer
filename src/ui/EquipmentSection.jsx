import React, { useMemo } from 'react';
import { sortEquipmentList } from '../model/rollups.js';
import { titleCut } from '../model/taxonomy.js';
import { TAGS, TAG_ICONS } from '../model/equipmentTags.js';
import { useSupplement } from '../view/Supplement.jsx';
import { useStreamed } from '../view/useStreamed.js';

// The side panel's two equipment accordions. LINs aren't shown here -- the
// panel is narrow, and the name opens the detail modal, which has the LIN.

const eqKey = (e) => (e.lin || e.name || '').toUpperCase();

function AccordionHeader({ title, open, onToggle, lines, qty }) {
  return (
    <h3 className="h6 mb-0">
      <button type="button" className="eq-accordion-toggle" aria-expanded={open} onClick={onToggle}>
        <i className={`bi ${open ? 'bi-chevron-down' : 'bi-chevron-right'} small`} aria-hidden="true" />
        <span className="flex-grow-1">{title}</span>
        <span className="text-body-secondary fw-normal small text-nowrap">{lines} lines · {qty} items</span>
      </button>
    </h3>
  );
}

const total = (items) => items.reduce((sum, e) => sum + e.qty, 0);

function NameCell({ item }) {
  const sup = useSupplement();
  return (
    <button type="button" className="eq-link" onClick={() => sup.open(item)}>
      {sup.displayName(item)}
    </button>
  );
}

/** Equipment assigned directly to the node. */
export function AssignedEquipment({ node, open, onToggle }) {
  const items = sortEquipmentList(node.equipment, node.globalCatCounts || node.catCounts);
  return (
    <section className="eq-accordion mt-4">
      <AccordionHeader title="Assigned equipment" open={open} onToggle={onToggle} lines={items.length} qty={total(items)} />
      {open && (
        <div className="eq-accordion-body">
          <table className="table table-sm table-dark table-borderless small mb-0 eq-side-table">
            <thead>
              <tr className="text-body-secondary">
                <th scope="col">Nomenclature</th>
                <th scope="col" className="text-end">Qty</th>
                <th scope="col" className="text-end">ERC</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e, i) => (
                <tr key={`${eqKey(e)}-${i}`}>
                  <td><NameCell item={e} /></td>
                  <td className="text-end">{e.qty}</td>
                  <td className="text-end">{e.erc || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-body-secondary small mt-1 mb-0 fst-italic">
            Assigned directly to this element, not including sub-units.
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * Everything in the node's subtree, merged by LIN and grouped into one compact
 * accordion per equipment tag. Hovering a row lists which of the node's direct
 * sub-units the item is in; its Search button finds every element holding it.
 */
export function ContainedEquipment({ node, model, open, onToggle, openTags, onToggleTag, onSearch }) {
  const sup = useSupplement();

  // item key -> Map(direct child | node itself -> qty). Holdings are rolled
  // up to the node's own children, one level down, rather than to the billet
  // or crew that holds them -- that is the level the reader is looking at.
  const byChild = useMemo(() => {
    const map = new Map();
    const add = (key, where, qty) => {
      let per = map.get(key);
      if (!per) { per = new Map(); map.set(key, per); }
      per.set(where, (per.get(where) || 0) + qty);
    };
    for (const e of node.equipment) add(eqKey(e), node, e.qty);
    for (const childId of node.childIds) {
      const child = model.byId.get(childId);
      if (!child) continue;
      for (const e of child.allEq || []) add(eqKey(e), child, e.qty);
    }
    return map;
  }, [node, model]);

  const groups = useMemo(() => {
    const byTag = new Map(TAGS.map((t) => [t, []]));
    for (const e of sortEquipmentList(node.allEq, node.globalCatCounts || node.catCounts)) {
      byTag.get(sup.tagOf(e)).push(e);
    }
    return TAGS.map((tag) => ({ tag, items: byTag.get(tag) })).filter((g) => g.items.length);
  }, [node, sup]);

  const tip = (key) => {
    const per = byChild.get(key);
    if (!per) return '';
    const lines = [...per].map(([where, qty]) => {
      const name = where === node ? 'Assigned to this element' : titleCut(where.title);
      return `• ${name} ×${qty}`;
    });
    return `In:\n${lines.join('\n')}`;
  };
  // A LIN finds every holder exactly; the rare line without one falls back to its name.
  const query = (e) => (e.lin ? `LIN:${e.lin}` : `EQUIP:${e.name}`);

  return (
    <section className="eq-accordion mt-3">
      <AccordionHeader title="Contained equipment" open={open} onToggle={onToggle} lines={node.allEq.length} qty={node.roll.eqQty} />
      {open && (
        <div className="eq-accordion-body eq-tag-groups">
          {groups.map(({ tag, items }) => {
            const tagOpen = openTags.has(tag);
            return (
              <div key={tag} className="eq-tag-group">
                <button
                  type="button"
                  className="eq-tag-toggle"
                  aria-expanded={tagOpen}
                  onClick={() => onToggleTag(tag)}
                >
                  <i className={`bi ${tagOpen ? 'bi-chevron-down' : 'bi-chevron-right'}`} aria-hidden="true" />
                  <i className={`bi ${TAG_ICONS[tag]} text-body-secondary`} aria-hidden="true" />
                  <span className="flex-grow-1 text-truncate">{tag}</span>
                  <span className="text-body-secondary text-nowrap">{items.length} · {total(items)}</span>
                </button>
                {tagOpen && (
                  <table className="table table-sm table-dark table-borderless small mb-0 eq-side-table">
                    <tbody>
                      <TagRows items={items} node={node} tip={tip} query={query} onSearch={onSearch} tag={tag} />
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
          <p className="text-body-secondary small mt-1 mb-0 fst-italic">
            Everything in this element and its sub-units, merged by LIN. Hover a row to see which sub-units have it.
          </p>
        </div>
      )}
    </section>
  );
}

/** One tag group's rows, streamed in so opening a big group doesn't stall the panel. */
function TagRows({ items, node, tip, query, onSearch, tag }) {
  const sup = useSupplement();
  const { shown, done, total: count } = useStreamed(items, `${node.id}|${tag}`, { first: 30, step: 50 });
  return (
    <>
      {shown.map((e) => {
        const key = eqKey(e);
        return (
          <tr
            key={`${node.id}-${key}`}
            data-bs-toggle="tooltip"
            data-bs-title={tip(key)}
            data-bs-custom-class="tooltip-list"
            data-bs-placement="left"
          >
            <td><NameCell item={e} /></td>
            <td className="text-end eq-col-qty">{e.qty}</td>
            <td className="text-end eq-col-erc">{e.erc || '—'}</td>
            <td className="text-end eq-col-go">
              <button
                type="button"
                className="btn btn-outline-info btn-xs py-0 px-1"
                title={`Search this unit for ${query(e)}`}
                aria-label={`Search this unit for ${sup.displayName(e)}`}
                onClick={() => onSearch(query(e), node.id)}
              >
                <i className="bi bi-search" aria-hidden="true" />
              </button>
            </td>
          </tr>
        );
      })}
      {!done && (
        <tr>
          <td colSpan={4} className="text-center text-body-secondary py-1">
            <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />{shown.length} of {count}
          </td>
        </tr>
      )}
    </>
  );
}
