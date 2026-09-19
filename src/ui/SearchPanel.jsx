import React, { useEffect, useMemo, useRef, useState } from 'react';
import { searchSubtree, fieldLabel, ancestorTrail } from '../model/search.js';
import { KIND_STYLE, abbreviateTitle } from '../model/taxonomy.js';
import { useMosInfo } from '../view/MosPalette.jsx';
import { useSupplement } from '../view/Supplement.jsx';

/**
 * Find something inside a chosen unit.
 * Supports field-specific prefixes like MOS:56M, LIN:T73827, TITLE:Infantry, etc.
 * Features a circular info button in the bottom right corner to toggle query syntax help.
 */
export default function SearchPanel({
  model, scopeNode, picking, onPick, onGo, onClose, initialQuery = '',
}) {
  const [q, setQ] = useState(initialQuery);
  const [showHelp, setShowHelp] = useState(false);
  const input = useRef(null);
  const mosInfo = useMosInfo();
  const { lin: supLin, mos: supMos } = useSupplement();

  useEffect(() => {
    if (initialQuery) setQ(initialQuery);
    input.current?.focus();
  }, [initialQuery]);

  const results = useMemo(
    () => searchSubtree(model, scopeNode?.id, q, { lin: supLin, mos: supMos }),
    [model, scopeNode, q, supLin, supMos],
  );

  return (
    <aside className="search-panel card border-0 rounded-0">
      <div className="search-head">
        <button
          type="button"
          className={`search-scope${picking ? ' is-picking' : ''}`}
          onClick={onPick}
          title={picking ? 'Waiting for a unit' : 'Change what is being searched'}
          aria-pressed={picking}
        >
          {picking ? (
            <>
              <span className="search-scope-label">Pick a unit</span>
              <span className="search-scope-name">Click one on the map…</span>
            </>
          ) : (
            <>
              <span className="search-scope-label">Searching within — change</span>
              <span className="search-scope-name" title={scopeNode?.title}>
                {scopeNode ? scopeNode.title : '—'}
              </span>
            </>
          )}
        </button>
        <button type="button" className="btn-close" aria-label="Close search" onClick={onClose} />
      </div>

      <div className="search-query">
        <input
          ref={input}
          type="search"
          className="form-control form-control-sm"
          placeholder="Title, MOS:56M, LIN:T73827, Grade…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.stopPropagation(); if (q) setQ(''); else onClose(); }
            if (e.key === 'Enter' && results.length) onGo(results[0].node.id);
          }}
        />
        <div className="text-body-secondary small mt-1 d-flex align-items-center justify-content-between">
          <span>
            {q.trim()
              ? `${results.length} result${results.length === 1 ? '' : 's'}`
              : 'Use prefixes like MOS:56M or LIN:T73827 for specific queries. Click the info "i" button below for more.'}
          </span>
        </div>
      </div>

      <div className="search-results">
        {q.trim() && results.length === 0 && (
          <p className="text-body-secondary small p-3 mb-0">
            Nothing here matches. This query is for{' '}
            <strong>{scopeNode?.title}</strong> only. To change this, click the "SEARCING WITHIN" button above the search bar.
          </p>
        )}
        <ul className="list-group list-group-flush">
          {results.map(({ node, field, hint }) => {
            const label = fieldLabel(field);
            const colour = node.kind === 'BL' && node.mos
              ? mosInfo(node.mos).color
              : KIND_STYLE[node.kind].accent;
            const trail = ancestorTrail(model, node);
            return (
              <li key={node.id} className="list-group-item p-0 bg-transparent">
                <button
                  type="button"
                  className="search-hit"
                  onClick={() => onGo(node.id)}
                  title={node.title}
                >
                  <i className="search-dot" style={{ background: colour }} />
                  <span className="search-hit-body">
                    {trail.length > 0 && (
                      <span
                        className="search-hit-trail"
                        title={trail.map((a) => a.title).join(' › ')}
                      >
                        {trail.map((a, i) => (
                          <React.Fragment key={a.id}>
                            {i > 0 && <span className="search-hit-sep">›</span>}
                            {abbreviateTitle(a.title)}
                          </React.Fragment>
                        ))}
                      </span>
                    )}
                    <span className="search-hit-title">{node.title}</span>
                    {label && (
                      <span className="search-hit-meta">
                        <span className="search-hit-field">{label}</span> {hint}
                      </span>
                    )}
                  </span>
                  <span className="search-hit-tail">
                    {node.kind === 'BL' ? (node.grade || 'BL') : `${node.roll.mil} PAX`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Circle Info Button in bottom right corner */}
      <button
        type="button"
        className="search-info-btn btn btn-sm btn-outline-info rounded-circle shadow-sm"
        onClick={() => setShowHelp((v) => !v)}
        title="Search syntax & query prefixes"
        aria-label="Search syntax help"
      >
        <i className="bi bi-info-circle" />
      </button>

      {/* Search Help Popover */}
      {showHelp && (
        <div className="search-help-popover card shadow-lg border-secondary">
          <div className="card-header py-1.5 px-3 d-flex align-items-center justify-content-between bg-body-tertiary">
            <strong className="small"><i className="bi bi-search me-1.5 text-info" /> Search Syntax & Prefixes</strong>
            <button type="button" className="btn-close btn-close-sm ms-2" aria-label="Close help" onClick={() => setShowHelp(false)} />
          </div>
          <div className="card-body p-2.5 small text-body-secondary">
            <p className="mb-2">Prefix your query with a field tag to filter specifically:</p>
            <div className="d-flex flex-column gap-1">
              <div><code className="text-info-emphasis">MOS:56M</code> — Search MOS code</div>
              <div><code className="text-info-emphasis">LIN:T73827</code> — Search Equipment LIN</div>
              <div><code className="text-info-emphasis">TITLE:Infantry</code> — Search Unit / Billet Title</div>
              <div><code className="text-info-emphasis">GRADE:E-4</code> — Search Rank / Grade</div>
              <div><code className="text-info-emphasis">UIC:W12345</code> — Search Unit ID Code</div>
              <div><code className="text-info-emphasis">CAT:CARBIN</code> — Search Equipment Category</div>
              <div><code className="text-info-emphasis">ERC:P</code> — Search Readiness Code</div>
              <div><code className="text-info-emphasis">PAR:01</code> — Search Paragraph Number</div>
            </div>
            <div className="mt-2 pt-2 border-top text-body-tertiary" style={{ fontSize: '0.78rem' }}>
              Plain text (e.g. <code>91B</code> or <code>M4</code>) searches across all fields simultaneously,
              including LIN nomenclatures and MOS titles from the Supplement Table.
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
