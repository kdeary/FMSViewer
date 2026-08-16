import React, { useEffect, useMemo, useRef, useState } from 'react';
import { searchSubtree, fieldLabel, ancestorTrail } from '../model/search.js';
import { KIND_STYLE, abbreviateTitle } from '../model/taxonomy.js';
import { useMosInfo } from '../view/MosPalette.jsx';

/**
 * Find something inside a chosen unit.
 *
 * The scope is pinned, not inherited from wherever the map happens to be
 * looking: following the focus meant that clicking a result immediately
 * narrowed the search to that result, which threw away the list you were
 * working through. It changes only when you ask it to, via the header.
 */
export default function SearchPanel({
  model, scopeNode, picking, onPick, onGo, onClose,
}) {
  const [q, setQ] = useState('');
  const input = useRef(null);
  const mosInfo = useMosInfo();

  useEffect(() => { input.current?.focus(); }, []);

  const results = useMemo(
    () => searchSubtree(model, scopeNode?.id, q),
    [model, scopeNode, q],
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
          placeholder="Title, MOS, LIN or grade…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.stopPropagation(); if (q) setQ(''); else onClose(); }
            if (e.key === 'Enter' && results.length) onGo(results[0].node.id);
          }}
        />
        <div className="text-body-secondary small mt-1">
          {q.trim()
            ? `${results.length} result${results.length === 1 ? '' : 's'}`
            : 'Matches unit and duty titles, MOS, POSCO, equipment LIN and grade.'}
        </div>
      </div>

      <div className="search-results">
        {q.trim() && results.length === 0 && (
          <p className="text-body-secondary small p-3 mb-0">
            Nothing here matches. This searches inside{' '}
            <strong>{scopeNode?.title}</strong> only.
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
                      // Abbreviated: the trail is the one line here competing
                      // for width with something it only has to disambiguate,
                      // and "Field Maintenance CO › Maintenance PLT" fits on
                      // one line where the spelled-out version does not.
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
                    {node.kind === 'BL' ? (node.grade || 'BL') : `${node.roll.mil} pax`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
