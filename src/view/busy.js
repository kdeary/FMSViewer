// Long-running work in the main window (outside any modal): exports and the
// like. withBusyToast() shows a toast at the top of the page for as long as the
// work runs -- see ui/BusyToast.jsx. Work inside a modal shows that modal's own
// progress bar instead.

import { afterPaint } from './useStreamed.js';

let current = null; // { label } or null
const listeners = new Set();

function set(value) {
  current = value;
  for (const fn of listeners) fn();
}

export function subscribeBusy(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getBusy() {
  return current;
}

/**
 * Runs `fn` with a toast saying `label`. Waits for the toast to be painted
 * first, so it is on screen while `fn` (usually synchronous) holds the thread.
 */
export async function withBusyToast(label, fn) {
  set({ label });
  await afterPaint();
  try {
    return await fn();
  } finally {
    set(null);
  }
}
