import { useEffect, useState } from 'react';

/**
 * Renders a long list a chunk at a time instead of all in one go.
 *
 * The first `first` items render immediately; the rest are added `step` at a
 * time on later ticks, so the page paints (and stays responsive to clicks)
 * while a few hundred heavy rows fill in behind it.
 *
 * `resetKey` says when the list is a different list -- a new filter, a
 * replaced table -- and streaming starts over. When the same list only grows
 * (rows appended) or changes in place (a cell edited), what is already shown
 * stays shown and streaming just carries on.
 *
 * @returns {{ shown: T[], done: boolean, total: number, progress: number }} progress is 0..1
 */
export function useStreamed(items, resetKey, { first = 40, step = 60 } = {}) {
  const [state, setState] = useState({ key: resetKey, count: first });
  let { count } = state;
  if (state.key !== resetKey) {
    // Adjusting state while rendering is React's own pattern for "reset when a
    // prop changes": it re-renders straight away, before anything is painted.
    count = first;
    setState({ key: resetKey, count: first });
  }

  const total = items.length;
  useEffect(() => {
    if (count >= total) return undefined;
    // A macrotask between chunks, so input and painting get their turn.
    const id = setTimeout(() => {
      setState((s) => (s.key === resetKey ? { ...s, count: s.count + step } : s));
    }, 0);
    return () => clearTimeout(id);
  }, [count, total, resetKey, step]);

  const done = count >= total;
  return {
    shown: done ? items : items.slice(0, count),
    done,
    total,
    progress: done || !total ? 1 : count / total,
  };
}

/**
 * Resolves once the browser has had a chance to paint, so a progress label set
 * just before a long synchronous step is on screen while the step runs. The
 * timeout covers background tabs, where animation frames don't fire at all.
 */
export function afterPaint() {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => { if (!settled) { settled = true; resolve(); } };
    requestAnimationFrame(() => setTimeout(done, 0));
    setTimeout(done, 100);
  });
}
