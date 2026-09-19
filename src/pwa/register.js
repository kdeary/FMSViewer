// The page's side of service-worker updates (see sw.js for the whole flow).
//
// registerServiceWorker() is called once at startup. The UI subscribes with
// onUpdateAvailable() and calls applyUpdate() when the user agrees; the page
// then reloads into the new build.

const CHECK_EVERY_MS = 60 * 60 * 1000;

let waiting = null; // the installed-but-waiting worker of a newer build
const listeners = new Set();

function announce(worker) {
  waiting = worker;
  for (const fn of listeners) fn();
}

/** Calls `fn` when a newer build is ready (right away if one already is). Returns an unsubscribe. */
export function onUpdateAvailable(fn) {
  listeners.add(fn);
  if (waiting) fn();
  return () => listeners.delete(fn);
}

/** Switches to the waiting build and reloads the page into it. */
export function applyUpdate() {
  if (!waiting) return;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
  waiting.postMessage({ type: 'SKIP_WAITING' });
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    let reg;
    try {
      // `updateViaCache: 'none'` fetches sw.js past the HTTP cache on every
      // check, so a host's caching headers can't hide a new version.
      reg = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
    } catch {
      return; // offline support is a bonus, not a requirement
    }

    // A worker that is waiting only matters if one is already in charge; on
    // the very first visit there is nothing older to replace.
    const watch = (worker) => {
      if (!worker) return;
      const check = () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) announce(worker);
      };
      check();
      worker.addEventListener('statechange', check);
    };
    watch(reg.waiting);
    watch(reg.installing);
    reg.addEventListener('updatefound', () => watch(reg.installing));

    const check = () => { reg.update().catch(() => { /* offline; try again later */ }); };
    setInterval(check, CHECK_EVERY_MS);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    window.addEventListener('online', check);
  });
}
