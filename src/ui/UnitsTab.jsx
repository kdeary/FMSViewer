import React, { useMemo, useState } from 'react';
import { titleCut, KIND_STYLE } from '../model/taxonomy.js';

/**
 * Data modal tab: the unit breakdown as vertical accordions. A unit's name
 * or its Go button flies the map to it (`onGo`, which also closes the modal).
 */
export default function UnitsTab({ model, onGo }) {
  const [unitsOnly, setUnitsOnly] = useState(true);
  // The root and its immediate children start open.
  const [expandedIds, setExpandedIds] = useState(() => {
    const rootNode = model?.byId.get(model.rootId);
    return new Set(rootNode ? [rootNode.id, ...rootNode.childIds] : []);
  });

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

  if (!model?.byId.has(model.rootId)) return null;

  return (
    <div className="data-pane">
      {/* Controls bar */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2" data-tour="tree-controls">
        <div className="d-flex align-items-center gap-2">
          <select
            className="form-select form-select-sm w-auto fw-semibold"
            aria-label="Show in tree"
            value={unitsOnly ? 'units' : 'all'}
            onChange={(e) => setUnitsOnly(e.target.value === 'units')}
          >
            <option value="units">Units only</option>
            <option value="all">Units &amp; Billets</option>
          </select>
          <span className="text-body-secondary small d-none d-md-inline">
            Click a name or <i className="bi bi-geo-alt-fill text-info mx-1" />Go to show it on the map.
          </span>
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
      <div className="stats-table-container tree-container">
        <TreeItem
          nodeId={model.rootId}
          model={model}
          expandedIds={expandedIds}
          onToggleExpand={toggleExpand}
          onGo={(id) => onGo?.(id)}
          unitsOnly={unitsOnly}
          isRoot={true}
        />
      </div>
    </div>
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
          className="badge px-1 py-0 font-monospace tree-kind-badge tint-badge"
          style={{ '--accent': kindInfo.accent, fontSize: '0.72rem' }}
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
