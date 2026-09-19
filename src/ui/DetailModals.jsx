import React, { useEffect } from 'react';
import { useSupplement, useDetail, useDetailActions } from '../view/Supplement.jsx';
import { useMosInfo } from '../view/MosPalette.jsx';
import { useMosSpec } from '../view/useMosSpec.js';
import { TAG_ICONS } from '../model/equipmentTags.js';

/**
 * The equipment and MOS detail modals, opened from anywhere through the
 * Supplement context (`open(item)` / `openMos(code)`). Rendered inside the MOS
 * palette provider so the MOS modal has titles and colours.
 */
export default function DetailModals({ model, onSearch }) {
  const { detail } = useDetail();
  const { closeDetail } = useDetailActions();

  useEffect(() => {
    if (!detail) return undefined;
    // Registered in the capture phase and stopped there, so Escape closes only
    // this modal and not the stats modal or map navigation underneath it.
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      closeDetail();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [detail, closeDetail]);

  if (!detail) return null;
  const search = onSearch ? (q) => { closeDetail(); onSearch(q); } : null;

  return (
    <>
      <div
        className="modal d-block eq-detail-modal"
        tabIndex="-1"
        role="dialog"
        aria-modal="true"
        aria-label={detail.kind === 'mos' ? `MOS ${detail.mos}` : `Equipment ${detail.item.lin}`}
        onMouseDown={(e) => { if (e.target === e.currentTarget) closeDetail(); }}
      >
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            {detail.kind === 'mos'
              ? <MosDetail mos={detail.mos} model={model} onClose={closeDetail} onSearch={search} />
              : <EquipmentDetail item={detail.item} onClose={closeDetail} />}
          </div>
        </div>
      </div>
      <div className="modal-backdrop show eq-detail-backdrop" />
    </>
  );
}

function SupplementNote({ has, what }) {
  return has ? (
    <p className="small text-body-secondary fst-italic mt-3 mb-0">
      Supplement Table details are AI-generated or hand-edited. Verify before relying on them.
    </p>
  ) : (
    <p className="small text-body-secondary mt-3 mb-0">
      This {what} isn't in the Supplement Table yet. Open <strong>Stats → Supplement Table</strong> to generate an
      AI prompt and import the CSV it returns.
    </p>
  );
}

function EquipmentDetail({ item, onClose }) {
  const sup = useSupplement();
  const data = sup.getLin(item.lin);
  const tag = sup.tagOf(item);
  const title = data?.name || item.name || item.lin;

  return (
    <>
      <div className="modal-header py-2">
        <h2 className="modal-title h5 mb-0 text-truncate flex-grow-1" style={{ minWidth: 0 }}>{title}</h2>
        <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
      </div>
      <div className="modal-body">
        <dl className="row small mb-0 gy-2">
          <dt className="col-4 text-body-secondary fw-normal">LIN</dt>
          <dd className="col-8 mb-0 font-monospace">{item.lin || '—'}</dd>
          <dt className="col-4 text-body-secondary fw-normal">FMS name</dt>
          <dd className="col-8 mb-0">{item.name || '—'}</dd>
          <dt className="col-4 text-body-secondary fw-normal">Nomenclature</dt>
          <dd className="col-8 mb-0 fw-semibold">{data?.name || '—'}</dd>
          <dt className="col-4 text-body-secondary fw-normal">Category</dt>
          <dd className="col-8 mb-0">
            <i className={`bi ${TAG_ICONS[tag]} me-1`} aria-hidden="true" />{tag}
            {!data?.tag && <span className="text-body-secondary"> (guessed from the name)</span>}
          </dd>
          {item.erc && (
            <>
              <dt className="col-4 text-body-secondary fw-normal">ERC</dt>
              <dd className="col-8 mb-0">{item.erc}</dd>
            </>
          )}
          <dt className="col-4 text-body-secondary fw-normal">Description</dt>
          <dd className="col-8 mb-0 eq-detail-desc">{data?.description || '—'}</dd>
        </dl>
        <SupplementNote has={!!data} what="LIN" />
      </div>
      <div className="modal-footer py-2 border-top-0">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
      </div>
    </>
  );
}

function MosDetail({ mos, model, onClose, onSearch }) {
  const sup = useSupplement();
  const info = useMosInfo()(mos);
  const spec = useMosSpec(mos);
  const data = sup.getMos(mos);
  const root = model?.byId.get(model.rootId);
  const count = root?.topMos?.find((m) => m.mos === mos)?.n || 0;

  return (
    <>
      <div className="modal-header py-2">
        <div className="d-flex align-items-center gap-2 flex-grow-1" style={{ minWidth: 0 }}>
          <i className="legend-swatch flex-none" style={{ background: info.color }} aria-hidden="true" />
          <h2 className="modal-title h5 mb-0 text-truncate">
            {info.title || info.label ? `${mos} - ${info.title || info.label}` : mos}
          </h2>
        </div>
        <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
      </div>
      <div className="modal-body">
        <dl className="row small mb-0 gy-2">
          <dt className="col-4 text-body-secondary fw-normal">MOS</dt>
          <dd className="col-8 mb-0 font-monospace">{mos}</dd>
          <dt className="col-4 text-body-secondary fw-normal">Title</dt>
          <dd className="col-8 mb-0 fw-semibold">
            {info.title || '—'}
            {data?.name && <span className="text-body-secondary fw-normal"> (Supplement Table)</span>}
          </dd>
          {info.officialTitle && info.officialTitle !== info.title && (
            <>
              <dt className="col-4 text-body-secondary fw-normal">Official title</dt>
              <dd className="col-8 mb-0">{info.officialTitle}</dd>
            </>
          )}
          <dt className="col-4 text-body-secondary fw-normal">Branch</dt>
          <dd className="col-8 mb-0">{info.label || '—'}</dd>
          <dt className="col-4 text-body-secondary fw-normal">In this unit</dt>
          <dd className="col-8 mb-0">{count} billet{count === 1 ? '' : 's'}</dd>
          <dt className="col-4 text-body-secondary fw-normal">Description</dt>
          <dd className="col-8 mb-0 eq-detail-desc">{data?.description || '—'}</dd>
        </dl>

        {spec && (
          <section className="mt-3">
            <h3 className="h6 mb-1">Major duties</h3>
            <p className="small mb-1 eq-detail-desc">{spec.duties}</p>
            <p className="text-body-secondary small mb-0">{spec.version}</p>
          </section>
        )}

        <SupplementNote has={!!data} what="MOS" />
      </div>
      <div className="modal-footer py-2 border-top-0">
        {onSearch && (
          <button type="button" className="btn btn-outline-info btn-sm me-auto" onClick={() => onSearch(`MOS:${mos}`)}>
            <i className="bi bi-search me-1" aria-hidden="true" />Search billets
          </button>
        )}
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
      </div>
    </>
  );
}
