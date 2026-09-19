import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useMosInfo } from '../view/MosPalette.jsx';
import { getEquipmentCategory } from '../model/rollups.js';
import { titleCut } from '../model/taxonomy.js';
import { useSupplement, useDetail } from '../view/Supplement.jsx';
import SupplementTab from './SupplementTab.jsx';
import { useStreamed } from '../view/useStreamed.js';
import ProgressStrip, { TabProgress } from './ProgressStrip.jsx';

/**
 * Unit Statistics Modal.
 * Has multiple tabs:
 *  - "Personnel": Text strength summary & full MOS breakdown table (Code, Title [no parentheticals], Count).
 *    Clicking an MOS row opens its detail modal; the row's Search button searches for it.
 *  - "Equipment": Scrollable table of all unit equipment grouped by Equipment Category (6-char clean code).
 *    Uses accordions for categories with multiple items, flat rows for single-item categories.
 *    Sorted with ERC "P" priority first, then category count ASCENDING.
 *    A search bar filters items by nomenclature, LIN, ERC or category code; while
 *    filtering, matching categories auto-expand so hits are visible without clicking.
 *  - "Supplement Table": AI prompt for LIN / MOS names and descriptions, the CSV import for its
 *    answer, and the editable table itself.
 *  - Clicking a LIN or nomenclature opens the equipment detail modal.
 *  - Clicking any MOS or Equipment row auto-populates the search panel with field tags (MOS:56M, LIN:T73827, CAT:CARBIN).
 */
export default function StatsModal({ open, model, censored, onClose, onSearch }) {
  const [tab, setTab] = useState('personnel'); // 'personnel' | 'equipment' | 'info'
  const [expandedCats, setExpandedCats] = useState(new Set());
  const [eqQuery, setEqQuery] = useState('');
  const mosInfo = useMosInfo();
  const eqInfo = useSupplement();
  const { detailOpen } = useDetail();


  useEffect(() => { if (!open) setEqQuery(''); }, [open]);

  // The Supplement Table tab stays mounted (hidden) once visited, so a long
  // import or row load carries on -- with its progress on the tab -- while
  // another tab is showing, and switching back doesn't rebuild it.
  // The selected tab always counts as visited: the modal remembers its tab
  // across closing, so it can reopen straight onto this one.
  const [infoVisited, setInfoVisited] = useState(false);
  const infoMounted = infoVisited || tab === 'info';
  const [supProgress, setSupProgress] = useState(null);
  useEffect(() => { if (open && tab === 'info') setInfoVisited(true); }, [open, tab]);
  useEffect(() => { if (!open) { setInfoVisited(false); setSupProgress(null); } }, [open]);

  // Closing from a Supplement Table full of rows first lets the tab clear its
  // rows in chunks (with progress); every other close is immediate.
  const [closing, setClosing] = useState(false);
  useEffect(() => { if (!open) setClosing(false); }, [open]);
  const requestClose = useCallback(() => {
    if (closing) return;
    if (tab === 'info' && infoMounted) setClosing(true);
    else onClose();
  }, [closing, tab, infoMounted, onClose]);

  useEffect(() => {
    // The equipment detail modal stacks on top of this one and owns Escape while it's up.
    if (!open || detailOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') requestClose(); };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, requestClose, detailOpen]);

  const root = useMemo(() => {
    if (!model || !model.rootId) return null;
    return model.byId.get(model.rootId);
  }, [model]);

  // Clean unit title without parentheticals
  const cleanUnitTitle = useMemo(() => {
    if (!root) return '';
    return titleCut(root.title);
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

  // Free-text filter over nomenclature, LIN, ERC and category code.
  // Space-separated terms are ANDed; a term matching the category code keeps the whole group.
  const filteredEquipment = useMemo(() => {
    const terms = eqQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return categorizedEquipment;

    const out = [];
    for (const group of categorizedEquipment) {
      const catText = group.category.toLowerCase();
      const items = group.items.filter((item) => {
        const hay = `${item.name || ''} ${eqInfo.getLin(item.lin)?.name || ''} ${item.lin || ''} ${item.erc || ''} ${catText}`.toLowerCase();
        return terms.every((t) => hay.includes(t));
      });
      if (!items.length) continue;
      const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
      const hasP = items.some((item) => String(item.erc || '').trim().toUpperCase() === 'P');
      out.push({ ...group, items, totalQty, hasP });
    }
    return out;
  }, [categorizedEquipment, eqQuery, eqInfo]);

  const isFiltering = eqQuery.trim().length > 0;

  // Long tables stream in a chunk at a time (see useStreamed), starting over
  // whenever the modal opens, the tab changes or the filter does, so switching
  // tabs paints straight away instead of freezing while every row mounts.
  const mosStream = useStreamed(root?.topMos || [], `${open}|${tab}|${root?.id}`);
  const eqStream = useStreamed(filteredEquipment, `${open}|${tab}|${eqQuery}`, { first: 30, step: 40 });

  // What each tab is still loading, as { label, pct } or null.
  const tabProgress = {
    personnel: mosStream.done ? null : { label: `Loading MOSs… ${mosStream.shown.length} of ${mosStream.total}`, pct: mosStream.progress * 100 },
    equipment: eqStream.done ? null : { label: `Loading categories… ${eqStream.shown.length} of ${eqStream.total}`, pct: eqStream.progress * 100 },
    info: supProgress,
  };
  const activeProgress = tabProgress[tab];

  const filteredTotals = useMemo(() => {
    let qty = 0;
    let lines = 0;
    for (const group of filteredEquipment) {
      lines += group.items.length;
      qty += group.totalQty;
    }
    return { qty, lines };
  }, [filteredEquipment]);

  const toggleCategory = (catCode) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(catCode)) next.delete(catCode);
      else next.add(catCode);
      return next;
    });
  };

  const handleRowClick = (query) => {
    if (onSearch && query) {
      onSearch(query);
      onClose();
    }
  };

  // LIN and nomenclature open the detail modal; the rest of the row still searches.
  const openDetail = (e, item) => { e.stopPropagation(); eqInfo.open(item); };
  const renderName = (item) => (
    <button type="button" className="eq-link" onClick={(e) => openDetail(e, item)} title={item.name}>
      {eqInfo.displayName(item) || '—'}
    </button>
  );
  const renderLin = (item) => (item.lin ? (
    <button type="button" className="eq-link font-monospace" onClick={(e) => openDetail(e, item)} title="Show equipment details">
      <code>{item.lin}</code>
    </button>
  ) : <code>—</code>);

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
        onMouseDown={(e) => { if (e.target === e.currentTarget) requestClose(); }}
      >
        <div className={`modal-dialog modal-dialog-centered modal-dialog-scrollable ${tab === 'info' ? 'modal-xl' : 'modal-lg'}`}>
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
              <button type="button" className="btn-close ms-2" aria-label="Close" onClick={requestClose} disabled={closing} />
            </div>

            <div className="modal-header border-bottom-0 py-1 bg-body-tertiary">
              <ul className="nav nav-tabs card-header-tabs">
                <li className="nav-item">
                  <button
                    type="button"
                    className={`nav-link ${tab === 'personnel' ? 'active' : ''}`}
                    onClick={() => setTab('personnel')}
                  >
                    Personnel
                    {tab === 'personnel' && tabProgress.personnel && <TabProgress pct={tabProgress.personnel.pct} />}
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    type="button"
                    className={`nav-link ${tab === 'equipment' ? 'active' : ''}`}
                    onClick={() => setTab('equipment')}
                  >
                    Equipment ({categorizedEquipment.length} Categories)
                    {tab === 'equipment' && tabProgress.equipment && <TabProgress pct={tabProgress.equipment.pct} />}
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    type="button"
                    className={`nav-link ${tab === 'info' ? 'active' : ''}`}
                    onClick={() => setTab('info')}
                  >
                    Supplement Table
                    {tabProgress.info && <TabProgress pct={tabProgress.info.pct} />}
                  </button>
                </li>
              </ul>
            </div>

            <div className="modal-body p-3">
              {activeProgress && (
                <div className="stats-progress">
                  <ProgressStrip label={activeProgress.label} pct={activeProgress.pct} />
                </div>
              )}
              {tab === 'personnel' && (
                <div>
                  {/* General Strength Text Summary */}
                  <div className="p-2 mb-3 border rounded bg-body-tertiary text-body-secondary small d-flex flex-wrap align-items-center justify-content-between gap-2">
                    <div>
                      <strong className="text-body fs-6 me-1">{r.mil} PAX</strong>
                      <span>({r.off} O / {r.wo} W / {r.enl} E / {r.civ} C)</span>
                    </div>
                    <div className="d-flex gap-3 text-nowrap">
                      <span><strong>{r.units}</strong> Units</span>
                      <span><strong>{r.billets}</strong> Billets</span>
                      <span><strong>{r.eqQty}</strong> Equipment</span>
                    </div>
                  </div>

                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <h3 className="h6 fw-semibold mb-0">MOS Breakdown ({root.topMos.length} Unique)</h3>
                    <span className="small text-body-secondary">Click a row for MOS details</span>
                  </div>

                  <div className="table-responsive stats-table-container">
                    <table className="table table-sm table-dark table-borderless table-hover align-middle mb-0">
                      <thead className="sticky-top border-bottom">
                        <tr>
                          <th scope="col" style={{ width: '85px' }}>Code</th>
                          <th scope="col">Specialty / Title</th>
                          <th scope="col" className="text-end" style={{ width: '70px' }}>Count</th>
                          <th scope="col" style={{ width: '84px' }}><span className="visually-hidden">Search</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {mosStream.shown.map(({ mos, n }) => {
                          const info = mosInfo(mos);
                          const cleanTitle = titleCut(info.title || info.label || '');
                          return (
                            <tr
                              key={mos}
                              onClick={() => eqInfo.openMos(mos)}
                              style={{ cursor: 'pointer' }}
                              title={`Show details for MOS ${mos}`}
                            >
                              <td>
                                <span className="d-inline-flex align-items-center gap-1">
                                  <i className="legend-swatch" style={{ background: info.color }} />
                                  <code className="fw-bold text-body">{mos}</code>
                                </span>
                              </td>
                              <td>{cleanTitle}</td>
                              <td className="text-end fw-semibold">{n}</td>
                              <td className="text-end">
                                <button
                                  type="button"
                                  className="btn btn-outline-info btn-xs py-0 px-2"
                                  title={`Search for MOS:${mos}`}
                                  onClick={(e) => { e.stopPropagation(); handleRowClick(`MOS:${mos}`); }}
                                >
                                  <i className="bi bi-search me-1" aria-hidden="true" />Search
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {!mosStream.done && <StreamingRow colSpan={4} shown={mosStream.shown.length} total={mosStream.total} what="MOSs" />}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tab === 'equipment' && (
                <div>
                  <div className="input-group input-group-sm mb-2">
                    <span className="input-group-text"><i className="bi bi-search" /></span>
                    <input
                      type="search"
                      className="form-control"
                      placeholder="Filter equipment by nomenclature, LIN, ERC or category…"
                      aria-label="Filter equipment"
                      value={eqQuery}
                      onChange={(e) => setEqQuery(e.target.value)}
                    />
                    {isFiltering && (
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        title="Clear filter"
                        onClick={() => setEqQuery('')}
                      >
                        <i className="bi bi-x-lg" />
                      </button>
                    )}
                  </div>

                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="small text-body-secondary">
                      ERC P items at top · Sorted ascending by category count · Click LIN/name for details, row to search
                    </span>
                    <span className="badge bg-secondary-subtle text-secondary-emphasis">
                      {isFiltering
                        ? `Matched: ${filteredTotals.qty} items (${filteredTotals.lines} lines)`
                        : `Total: ${r.eqQty} items (${r.eqLines} lines)`}
                    </span>
                  </div>

                  <div className="table-responsive stats-table-container" style={{ maxHeight: '420px' }}>
                    <table className="table table-sm table-dark table-borderless table-hover align-middle mb-0">
                      <thead className="sticky-top border-bottom">
                        <tr>
                          <th scope="col">Nomenclature / Title</th>
                          <th scope="col" style={{ width: '110px' }}>LIN</th>
                          <th scope="col" style={{ width: '80px' }}>ERC</th>
                          <th scope="col" className="text-end" style={{ width: '90px' }}>Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {eqStream.shown.map((group) => {
                          const isMulti = group.items.length > 1;
                          const isExpanded = isFiltering || expandedCats.has(group.category);

                          if (!isMulti) {
                            const singleItem = group.items[0];
                            const isP = String(singleItem.erc || '').trim().toUpperCase() === 'P';
                            const targetQuery = singleItem.lin ? `LIN:${singleItem.lin}` : `EQUIP:${singleItem.name}`;
                            return (
                              <tr
                                key={`single-${group.category}`}
                                className="eq-single-row"
                                onClick={() => handleRowClick(targetQuery)}
                                style={{ cursor: 'pointer' }}
                                title={`Click to search for ${targetQuery}`}
                              >
                                <td className="fw-medium">{renderName(singleItem)}</td>
                                <td>{renderLin(singleItem)}</td>
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
                                  <span className="d-inline-flex align-items-center gap-1">
                                    <i className={`bi ${isExpanded ? 'bi-chevron-down' : 'bi-chevron-right'} text-body-secondary small me-1`} />
                                    <span
                                      className="badge bg-primary-subtle text-primary-emphasis font-monospace me-1"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRowClick(`CAT:${group.category}`);
                                      }}
                                      title={`Click to search category CAT:${group.category}`}
                                    >
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
                                      P
                                    </span>
                                  )}
                                </td>
                                <td className="text-end fw-bold">{group.totalQty}</td>
                              </tr>

                              {isExpanded &&
                                group.items.map((item, idx) => {
                                  const isP = String(item.erc || '').trim().toUpperCase() === 'P';
                                  const subQuery = item.lin ? `LIN:${item.lin}` : `EQUIP:${item.name}`;
                                  return (
                                    <tr
                                      key={`sub-${group.category}-${idx}`}
                                      className="eq-sub-row"
                                      onClick={() => handleRowClick(subQuery)}
                                      style={{ cursor: 'pointer' }}
                                      title={`Click to search for ${subQuery}`}
                                    >
                                      <td className="ps-4 fw-medium text-body-secondary">
                                        <i className="bi bi-arrow-return-right me-2 text-body-secondary" />
                                        {renderName(item)}
                                      </td>
                                      <td>{renderLin(item)}</td>
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
                        {!eqStream.done && <StreamingRow colSpan={4} shown={eqStream.shown.length} total={eqStream.total} what="categories" />}
                        {!filteredEquipment.length && (
                          <tr>
                            <td colSpan={4} className="text-center text-body-secondary py-4">
                              No equipment matches “{eqQuery.trim()}”.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {infoMounted && (
                <div hidden={tab !== 'info'}>
                  <SupplementTab
                    root={root}
                    censored={censored}
                    onProgress={setSupProgress}
                    active={tab === 'info'}
                    closing={closing}
                    onDrained={onClose}
                  />
                </div>
              )}
            </div>

            <div className="modal-footer py-2 border-top-0">
              <button type="button" className="btn btn-secondary btn-sm" onClick={requestClose} disabled={closing}>
                {closing ? 'Closing…' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}

function StreamingRow({ colSpan, shown, total, what }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-center text-body-secondary small py-2">
        <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
        Loading {what}… {shown} of {total}
      </td>
    </tr>
  );
}
