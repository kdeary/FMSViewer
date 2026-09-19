import React, { useState } from 'react';
import MosBar from '../view/MosBar.jsx';
import ImagePlaceholder from '../view/ImagePlaceholder.jsx';
import { KIND_STYLE } from '../model/taxonomy.js';
import { useMosInfo } from '../view/MosPalette.jsx';
import { useMosSpec } from '../view/useMosSpec.js';
import { titleCut } from '../model/taxonomy.js';
import { exportNodeToExcel } from '../model/exportExcel.js';
import { withBusyToast } from '../view/busy.js';
import { useDetailActions } from '../view/Supplement.jsx';
import { AssignedEquipment, ContainedEquipment } from './EquipmentSection.jsx';

/** Everything about the selected node, at full fidelity, regardless of zoom. */
export default function SidePanel({ node, model, onClose, onGo, onSearch }) {
  const mosInfo = useMosInfo();
  // Which equipment accordions are open. Kept across selections, so a reader
  // browsing units with the contained list open keeps seeing it.
  const [openEq, setOpenEq] = useState({ assigned: true, contained: false });
  const toggleEq = (key) => setOpenEq((o) => ({ ...o, [key]: !o[key] }));
  // Open equipment-tag groups inside the contained list; also kept across selections.
  const [openTags, setOpenTags] = useState(() => new Set());
  const toggleTag = (tag) => setOpenTags((prev) => {
    const next = new Set(prev);
    if (next.has(tag)) next.delete(tag); else next.add(tag);
    return next;
  });
  const { openMos } = useDetailActions();
  const spec = useMosSpec(node && node.kind === 'BL' ? node.mos : null);
  if (!node) return null;
  const r = node.roll;
  const isBillet = node.kind === 'BL';
  const parent = node.parentId ? model.byId.get(node.parentId) : null;
  const children = node.childIds.map((id) => model.byId.get(id));

  return (
    <aside className="side-panel card border-0 rounded-0">
      <div className="card-header d-flex align-items-start gap-2">
        <div className="flex-grow-1">
          <span className="badge text-bg-secondary mb-1">{KIND_STYLE[node.kind].label}</span>
          <h2 className="h6 mb-0">{node.title}</h2>
          {parent && (
            <button type="button" className="btn btn-link btn-sm p-0 small" onClick={() => onGo(parent.id)}>
              <i className="bi bi-arrow-up me-1" /> {titleCut(parent.title)}
            </button>
          )}
        </div>
        <button
          type="button"
          className="btn btn-outline-info btn-sm px-2"
          title="Export to Excel"
          onClick={() => withBusyToast(`Exporting ${node.title} to Excel…`, () => exportNodeToExcel(node, model))}
        >
          <i className="bi bi-download" />
        </button>
        <button type="button" className="btn-close mt-1" aria-label="Close" onClick={onClose} />
      </div>

      <div className="card-body overflow-auto">
        <ImagePlaceholder node={node} kind={node.kind} className="img-ph-lg" label={isBillet ? 'No photo' : 'No crest'} />

        <dl className="row small mt-3 mb-2 gy-1">
          {isBillet ? (
            <>
              <dt className="col-5">MOS</dt>
              <dd className="col-7 mb-0">
                {node.mos ? (
                  <button type="button" className="eq-link" onClick={() => openMos(node.mos)} title="Show MOS details">
                    <span style={{ color: mosInfo(node.mos).text }}>{node.mos}</span>{' '}
                    <span className="text-body-secondary">{mosInfo(node.mos).title || mosInfo(node.mos).label}</span>
                  </button>
                ) : '—'}
              </dd>
              <dt className="col-5">Grade</dt><dd className="col-7 mb-0">{node.grade || '—'}</dd>
              <dt className="col-5">POSCO</dt><dd className="col-7 mb-0">{node.poscode || '—'}</dd>
            </>
          ) : (
            <>
              <dt className="col-5">Strength</dt>
              <dd className="col-7 mb-0">
                {r.mil} mil{r.civ > 0 ? ` · ${r.civ} civ` : ''}
              </dd>
              <dt className="col-5">O / W / E</dt>
              <dd className="col-7 mb-0">{r.off} / {r.wo} / {r.enl}</dd>
              <dt className="col-5">Sub-units</dt>
              <dd className="col-7 mb-0">{r.units} units · {r.crews} crews</dd>
              <dt className="col-5">Billets</dt><dd className="col-7 mb-0">{r.billets}</dd>
            </>
          )}
          <dt className="col-5">Paragraph</dt><dd className="col-7 mb-0">{node.parno || '—'}</dd>
          {node.uic && <><dt className="col-5">UIC</dt><dd className="col-7 mb-0">{node.uic}</dd></>}
          <dt className="col-5">Equipment</dt>
          <dd className="col-7 mb-0">{r.eqLines} lines · {r.eqQty} items</dd>
        </dl>

        {isBillet && mosInfo(node.mos).description && (
          <section className="mos-spec">
            <h3 className="h6 mt-4 mb-2">
              About this MOS{' '}
              <span className="text-body-secondary fw-normal small">(Supplement Table)</span>
            </h3>
            <p className="small mb-0">{mosInfo(node.mos).description}</p>
          </section>
        )}

        {isBillet && spec && (
          <section className="mos-spec">
            <h3 className="h6 mt-4 mb-2">
              Major duties{' '}
              <span className="text-body-secondary fw-normal font-monospace">{spec.mos}</span>
            </h3>
            <p className="small mb-1">{spec.duties}</p>
            <p className="text-body-secondary mb-0 mos-spec-src">{spec.version}</p>
          </section>
        )}

        {!isBillet && node.topMos.length > 0 && (
          <>
            <h3 className="h6 mt-4 mb-2">MOS breakdown</h3>
            <MosBar topMos={node.topMos} total={r.billets} />
          </>
        )}

        {node.equipment.length > 0 && (
          <AssignedEquipment node={node} open={openEq.assigned} onToggle={() => toggleEq('assigned')} />
        )}

        {node.childIds.length > 0 && node.allEq.length > 0 && (
          <ContainedEquipment
            key={node.id}
            node={node}
            model={model}
            open={openEq.contained}
            onToggle={() => toggleEq('contained')}
            openTags={openTags}
            onToggleTag={toggleTag}
            onSearch={onSearch}
          />
        )}

        {children.length > 0 && (
          <>
            <h3 className="h6 mt-4 mb-2">Contains</h3>
            <ul className="list-group list-group-flush small">
              {children.map((c) => (
                <li key={c.id} className="list-group-item bg-transparent px-0 py-1 d-flex justify-content-between align-items-center gap-2">
                  <button type="button" className="btn btn-link btn-sm p-0 text-start flex-grow-1" onClick={() => onGo(c.id)}>
                    {c.title}
                  </button>
                  <span className="text-body-secondary text-nowrap">
                    {c.kind === 'BL' ? (c.mos || c.grade || 'BL') : `${c.roll.mil} PAX`}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </aside>
  );
}

