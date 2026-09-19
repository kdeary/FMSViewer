import React, { useSyncExternalStore } from 'react';
import { subscribeBusy, getBusy } from '../view/busy.js';

/** Drops down from the top of the page while main-window work runs (see view/busy.js). */
export default function BusyToast() {
  const busy = useSyncExternalStore(subscribeBusy, getBusy);
  if (!busy) return null;
  return (
    <div className="busy-toast" role="status" aria-live="polite">
      <span className="spinner-border spinner-border-sm" aria-hidden="true" />
      <span>{busy.label}</span>
    </div>
  );
}
