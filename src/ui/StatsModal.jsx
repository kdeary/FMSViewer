import React, { useEffect, useMemo, useState } from 'react';
import { useMosInfo } from '../view/MosPalette.jsx';
import { getEquipmentCategory } from '../model/rollups.js';

/**
 * Unit Statistics Modal.
 * Has multiple tabs:
 *  - "General": Unit strength breakdown & full MOS breakdown table (Code, Title [no parentheticals], Count).
 *  - "Equipment": Scrollable table of all unit equipment grouped by Equipment Category (6-char clean code).
 *    Uses accordions for categories with multiple items, flat rows for single-item categories.
 *    Sorted with ERC "P" priority first, then category count ASCENDING (least authorized category first).
 */
export default function StatsModal({ open, model, onClose }) {
  const [tab, setTab] = useState('general'); // 'general' | 'equipment'
  const [expandedCats, setExpandedCats] = useState(new Set());
  const mosInfo = useMosInfo();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  const root = useMemo(() => {
    if (!model || !model.rootId) return null;
    return model.byId.get(model.rootId);
  }, [model]);

  // Clean unit title without parentheticals
  const cleanUnitTitle = useMemo(() => {
    if (!root) return '';
    return (root.title || '').replace(/\s*\([^)]*\)/g, '').trim();
  }, [root]);

  // Group and sort equipment categories
  const categorizedEquipment = useMemo(() => {
    if (!root) return [];
    const items = root.allEq || [];

    const catMap = new Map();
    for (const item of items) {
      const catCode = getEquipmentCategory(item.name);
      let group = catMap.get(catCode);
      if (!group) {
        group = { category: catCode, items: [], totalQty: 0, hasP: false };
        catMap.set(catCode, group);
      }
      group.items.push(item);
      group.totalQty += item.qty;
      if (String(item.erc || '').trim().toUpperCase() === 'P') {
        group.hasP = true;
      }
    }

    // Sort categories: ERC P priority first, then total category count ASCENDING
    const groups = Array.from(catMap.values()).sort((a, b) => {
      if (a.hasP !== b.hasP) return a.hasP ? -1 : 1;
      if (a.totalQty !== b.totalQty) return a.totalQty - b.totalQty;
      return a.category.localeCompare(b.category);
    });

    // Sort items within each category
    for (const g of groups) {
      g.items.sort((a, b) => {
        const isP_a = String(a.erc || '').trim().toUpperCase() === 'P' ? 0 : 1;
        const isP_b = String(b.erc || '').trim().toUpperCase() === 'P' ? 0 : 1;
        if (isP_a !== isP_b) return isP_a - isP_b;
        return a.qty - b.qty || (a.name || '').localeCompare(b.name || '');
      });
    }

    return groups;
  }, [root]);

  const toggleCategory = (catCode) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(catCode)) next.delete(catCode);
      else next.add(catCode);
      return next;
    });
  };

  if (!open || !root) return null;

  const r = root.roll;

  return (
    <>
      <div
        className="modal d-block"
        tabIndex="-1"
        role="dialog"
        aria-modal="true"
        aria-label="Unit Statistics"
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header d-flex align-items-center justify-content-between py-2">
              <div className="d-flex align-items-center gap-2 overflow-hidden">
                <h2 className="modal-title h5 mb-0 text-truncate">{cleanUnitTitle}</h2>
                {root.uic && (
                  <span className="badge bg-secondary-subtle text-secondary-emphasis flex-none">
                    {root.uic}
                  </span>
                )}
              </div>
              <button type="button" className="btn-close ms-2" aria-label="Close" onClick={onClose} />
            </div>

            <div className="modal-header border-bottom-0 py-1 bg-body-tertiary">
              <ul className="nav nav-tabs card-header-tabs">
                <li className="nav-item">
                  <button
                    type="button"
                    className={`nav-link ${tab === 'general' ? 'active' : ''}`}
                    onClick={() => setTab('general')}
                  >
                    General
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    type="button"
                    className={`nav-link ${tab === 'equipment' ? 'active' : ''}`}
                    onClick={() => setTab('equipment')}
                  >
                    Equipment ({categorizedEquipment.length} Categories)
                  </button>
                </li>
              </ul>
            </div>

            <div className="modal-body p-3">
              {tab === 'general' && (
                <div>
                  {/* General Strength Overview Cards */}
                  <div className="row g-2 mb-3 text-center">
                    <div className="col-6 col-md-3">
                      <div className="p-2 border rounded bg-body-tertiary">
                        <div className="text-body-secondary small">Total Military</div>
                        <div className="fs-4 fw-bold">{r.mil}</div>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="p-2 border rounded bg-body-tertiary">
                        <div className="text-body-secondary small">Officers / WOs</div>
                        <div className="fs-5 fw-semibold">{r.off} OFF · {r.wo} WO</div>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="p-2 border rounded bg-body-tertiary">
                        <div className="text-body-secondary small">Enlisted / Civ</div>
                        <div className="fs-5 fw-semibold">{r.enl} ENL · {r.civ} CIV</div>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="p-2 border rounded bg-body-tertiary">
                        <div className="text-body-secondary small">Structure / Gear</div>
                        <div className="fs-6 fw-semibold">{r.units} U · {r.billets} B · {r.eqQty} Eq</div>
                      </div>
                    </div>
                  </div>

                  <h3 className="h6 fw-semibold mb-2">MOS Breakdown ({root.topMos.length} Specialties)</h3>
                  <div className="table-responsive stats-table-container">
                    <table className="table table-sm table-borderless table-hover align-middle mb-0">
                      <thead className="table-light sticky-top border-bottom">
                        <tr>
                          <th scope="col" style={{ width: '80px' }}>Code</th>
                          <th scope="col">Specialty / Title</th>
                          <th scope="col" className="text-end" style={{ width: '90px' }}>Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {root.topMos.map(({ mos, n }) => {
                          const info = mosInfo(mos);
                          const rawTitle = info.title || info.label || '';
                          const cleanTitle = rawTitle.replace(/\s*\([^)]*\)/g, '').trim();
                          return (
                            <tr key={mos}>
                              <td>
                                <span className="d-inline-flex align-items-center gap-1">
                                  <i className="legend-swatch" style={{ background: info.color }} />
                                  <code className="fw-bold">{mos}</code>
                                </span>
                              </td>
                              <td>{cleanTitle}</td>
                              <td className="text-end fw-semibold">{n}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tab === 'equipment' && (
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="small text-body-secondary">
                      ERC P priority at top, then sorted ascending by category count
                    </span>
                    <span className="badge bg-secondary-subtle text-secondary-emphasis">
                      Total: {r.eqQty} items ({r.eqLines} lines)
                    </span>
                  </div>

                  <div className="table-responsive stats-table-container" style={{ maxHeight: '420px' }}>
                    <table className="table table-sm table-borderless align-middle mb-0">
                      <thead className="table-light sticky-top border-bottom">
                        <tr>
                          <th scope="col">Category / Nomenclature</th>
                          <th scope="col" style={{ width: '110px' }}>LIN</th>
                          <th scope="col" style={{ width: '80px' }}>ERC</th>
                          <th scope="col" className="text-end" style={{ width: '90px' }}>Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categorizedEquipment.map((group) => {
                          const isMulti = group.items.length > 1;
                          const isExpanded = expandedCats.has(group.category);

                          if (!isMulti) {
                            const singleItem = group.items[0];
                            const isP = String(singleItem.erc || '').trim().toUpperCase() === 'P';
                            return (
                              <tr key={`single-${group.category}`} className="eq-single-row">
                                <td className="fw-medium">
                                  <span className="badge bg-body-secondary text-body-tertiary me-2 font-monospace">
                                    {group.category}
                                  </span>
                                  {singleItem.name || '—'}
                                </td>
                                <td><code>{singleItem.lin || '—'}</code></td>
                                <td>
                                  {singleItem.erc && (
                                    <span className={`badge ${isP ? 'bg-warning-subtle text-warning-emphasis fw-bold' : 'bg-body-secondary text-body'}`}>
                                      {singleItem.erc}
                                    </span>
                                  )}
                                </td>
                                <td className="text-end fw-bold">{singleItem.qty}</td>
                              </tr>
                            );
                          }

                          // Accordion Category Group Header for multi-item categories
                          return (
                            <React.Fragment key={`group-${group.category}`}>
                              <tr
                                className="eq-cat-header-row user-select-none"
                                onClick={() => toggleCategory(group.category)}
                                style={{ cursor: 'pointer' }}
                              >
                                <td colSpan={2} className="fw-bold">
                                  <span className="d-inline-flex align-items-center gap-2">
                                    <span className="eq-cat-toggle text-body-secondary small">
                                      {isExpanded ? '▼' : '▶'}
                                    </span>
                                    <span className="badge bg-primary-subtle text-primary-emphasis font-monospace">
                                      {group.category}
                                    </span>
                                    <span className="small text-body-secondary fw-normal">
                                      ({group.items.length} lines)
                                    </span>
                                  </span>
                                </td>
                                <td>
                                  {group.hasP && (
                                    <span className="badge bg-warning-subtle text-warning-emphasis fw-bold">
                                      ERC P
                                    </span>
                                  )}
                                </td>
                                <td className="text-end fw-bold">{group.totalQty}</td>
                              </tr>

                              {isExpanded &&
                                group.items.map((item, idx) => {
                                  const isP = String(item.erc || '').trim().toUpperCase() === 'P';
                                  return (
                                    <tr key={`sub-${group.category}-${idx}`} className="eq-sub-row bg-body-tertiary">
                                      <td className="ps-4 fw-medium text-body-secondary">
                                        ↳ {item.name || '—'}
                                      </td>
                                      <td><code>{item.lin || '—'}</code></td>
                                      <td>
                                        {item.erc && (
                                          <span className={`badge ${isP ? 'bg-warning-subtle text-warning-emphasis fw-bold' : 'bg-body-secondary text-body'}`}>
                                            {item.erc}
                                          </span>
                                        )}
                                      </td>
                                      <td className="text-end fw-semibold">{item.qty}</td>
                                    </tr>
                                  );
                                })}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer py-2 border-top-0">
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}
