import React from 'react';
import { truncate } from '../model/taxonomy.js';

/** Trail from the root down to whatever the camera is focused on. */
export default function Breadcrumbs({ path, onGo }) {
  if (!path?.length) return null;
  // Keep the ends and elide the middle when the chain gets long.
  const items = path.length > 5
    ? [path[0], { id: '__gap__' }, ...path.slice(-3)]
    : path;

  return (
    <nav aria-label="breadcrumb" className="crumbs">
      <ol className="breadcrumb mb-0 flex-nowrap">
        {items.map((n, i) => {
          if (n.id === '__gap__') return <li key="gap" className="breadcrumb-item disabled">…</li>;
          const last = i === items.length - 1;
          return (
            <li key={n.id} className={`breadcrumb-item${last ? ' active' : ''}`}>
              {last ? (
                <span title={n.title}>{truncate(n.title, 40)}</span>
              ) : (
                <button type="button" className="btn btn-link btn-sm p-0 align-baseline" title={n.title} onClick={() => onGo(n.id)}>
                  {truncate(n.title, 26)}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
