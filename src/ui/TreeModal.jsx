import React, { useEffect, useMemo, useState } from 'react';
import { titleCut, KIND_STYLE } from '../model/taxonomy.js';

/**
 * Clickable Tree Modal showing vertical accordions of unit breakdown.
 */
export default function TreeModal({ open, model, onClose, onGo }) {
  const [unitsOnly, setUnitsOnly] = useState(true);
  const [expandedIds, setExpandedIds] = useState(new Set());

  // Close modal on Escape key press
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

  // Expand root and immediate top-level children when opened
  useEffect(() => {
    if (!open || !model || !model.rootId) return;
    const init = new Set();
    init.add(model.rootId);
    const rootNode = model.byId.get(model.rootId);
    if (rootNode) {
      for (const cid of rootNode.childIds) {
        init.add(cid);
      }
    }
    setExpandedIds(init);
  }, [model, open]);

  // Compute set of all node IDs that have expandable children
  const allExpandableIds = useMemo(() => {
    if (!model) return new Set();
    const expandable = new Set();
    for (const [id, node] of model.byId.entries()) {
      if (node.childIds.length > 0) {
        const hasValidChildren = unitsOnly
          ? node.childIds.some((cid) => model.byId.get(cid)?.kind === 'UN')
          : node.childIds.length > 0;
        if (hasValidChildren) {
          expandable.add(id);
        }
      }
    }
    return expandable;
  }, [model, unitsOnly]);

  const handleExpandAll = () => {
    setExpandedIds(new Set(allExpandableIds));
  };

  const handleCollapseAll = () => {
    setExpandedIds(new Set());
  };

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!open || !model || !root) return null;

  return (
    <>
      <div
        className="modal d-block"
        tabIndex="-1"
        role="dialog"
        aria-modal="true"
        aria-label="Unit Breakdown Tree"
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header py-2 px-3">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-diagram-3-fill text-info fs-5" />
                <div>
                  <h2 className="modal-title h5 mb-0">Unit Breakdown Tree</h2>
                  <span className="text-body-secondary small">
                    {titleCut(root.title)} ({model.meta.nodeCount} total nodes)
                  </span>
                </div>
              </div>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>

            <div className="modal-body p-3">
              {/* Controls bar */}
              <div className="d-flex align-items-center justify-content-between gap-2 mb-3 bg-body-tertiary p-2 rounded border">
                <div className="form-check form-switch mb-0 small ms-1">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="treeUnitsOnlySwitch"
                    checked={unitsOnly}
                    onChange={(e) => setUnitsOnly(e.target.checked)}
                  />
                  <label className="form-check-label fw-semibold" htmlFor="treeUnitsOnlySwitch">
                    Units only
                  </label>
                </div>

                <div className="btn-group btn-group-sm" role="group">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={handleExpandAll}
                    title="Expand all tree branches"
                  >
                    <i className="bi bi-arrows-expand me-1" /> Expand All
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={handleCollapseAll}
                    title="Collapse all tree branches"
                  >
                    <i className="bi bi-arrows-collapse me-1" /> Collapse All
                  </button>
                </div>
              </div>

              {/* Vertical Tree Accordion Container */}
              <div className="tree-container pe-1">
                <TreeItem
                  nodeId={model.rootId}
                  model={model}
                  expandedIds={expandedIds}
                  onToggleExpand={toggleExpand}
                  onGo={(id) => { onGo(id); onClose(); }}
                  unitsOnly={unitsOnly}
                  isRoot={true}
                />
              </div>
            </div>

            <div className="modal-footer py-2 px-3">
              <span className="text-body-secondary small me-auto">
                Click unit name or <i className="bi bi-geo-alt-fill text-info mx-1" /> Go to focus unit on map.
              </span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}

function TreeItem({
  nodeId,
  model,
  expandedIds,
  onToggleExpand,
  onGo,
  unitsOnly,
  isRoot = false,
}) {
  const node = model.byId.get(nodeId);
  if (!node) return null;

  // Filter children based on unitsOnly
  const rawChildren = node.childIds || [];
  const children = useMemo(() => {
    return rawChildren
      .map((id) => model.byId.get(id))
      .filter((c) => c && (!unitsOnly || c.kind === 'UN'));
  }, [rawChildren, model, unitsOnly]);

  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(nodeId);
  const r = node.roll;

  const kindInfo = KIND_STYLE[node.kind] || KIND_STYLE.UN;
  const cleanTitle = titleCut(node.title);

  return (
    <div className={`tree-accordion-item ${isRoot ? 'tree-root-item' : ''}`}>
      <div className="tree-accordion-header d-flex align-items-center gap-2 py-1 px-2 rounded">
        {/* Toggle chevron */}
        {hasChildren ? (
          <button
            type="button"
            className="btn btn-sm btn-link p-0 text-body-secondary tree-toggle-btn"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(nodeId);
            }}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <i className={`bi bi-chevron-${isExpanded ? 'down' : 'right'} tree-chevron`} />
          </button>
        ) : (
          <span className="tree-chevron-placeholder" />
        )}

        {/* Kind badge */}
        <span
          className="badge px-1 py-0 font-monospace tree-kind-badge"
          style={{
            backgroundColor: `${kindInfo.accent}25`,
            color: kindInfo.accent,
            border: `1px solid ${kindInfo.accent}60`,
            fontSize: '0.72rem',
          }}
        >
          {node.kind}
        </span>

        {/* Title clickable to Go */}
        <button
          type="button"
          className="btn btn-link p-0 text-start text-reset text-decoration-none flex-grow-1 text-truncate tree-title-btn"
          onClick={() => onGo(nodeId)}
          title={`Focus ${node.title} on map`}
        >
          <span className="fw-semibold me-2">{cleanTitle}</span>
          {node.uic && <span className="badge text-bg-dark border me-1 font-monospace">{node.uic}</span>}
          {node.parno && <span className="text-body-secondary small me-1">Para {node.parno}</span>}
        </button>

        {/* Metrics badges */}
        <div className="d-flex align-items-center gap-1 ms-auto flex-shrink-0 small text-body-secondary">
          {r.mil > 0 && (
            <span className="badge text-bg-secondary font-monospace" title={`${r.mil} military strength`}>
              {r.mil} mil
            </span>
          )}
          {r.units > 0 && node.kind === 'UN' && (
            <span className="badge text-bg-dark border font-monospace d-none d-sm-inline" title={`${r.units} sub-units`}>
              {r.units} u
            </span>
          )}
          {r.billets > 0 && node.kind === 'UN' && (
            <span className="badge text-bg-dark border font-monospace d-none d-md-inline" title={`${r.billets} billets`}>
              {r.billets} b
            </span>
          )}

          {/* Go button */}
          <button
            type="button"
            className="btn btn-outline-info btn-xs ms-1 py-0 px-1 tree-go-btn"
            onClick={() => onGo(nodeId)}
            title="Focus this unit on the canvas"
          >
            <i className="bi bi-geo-alt-fill me-1" />
            Go
          </button>
        </div>
      </div>

      {/* Accordion body for children */}
      {hasChildren && isExpanded && (
        <div className="tree-accordion-body ps-3 ms-2 my-1 border-start">
          {children.map((child) => (
            <TreeItem
              key={child.id}
              nodeId={child.id}
              model={model}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onGo={onGo}
              unitsOnly={unitsOnly}
            />
          ))}
        </div>
      )}
    </div>
  );
}
