// The page's side of "Install FMSViewer" (see register.js for updates).
//
// A browser that is willing to install the app fires `beforeinstallprompt`
// instead of showing its own banner. The event is the only handle on that
// prompt, so it is kept until the user asks for it. Browsers that never fire
// it (Firefox, iOS Safari) and an already-installed app leave `deferred` null,
// which is what keeps the button off the landing page.

let deferred = null;
const listeners = new Set();

function announce() {
  for (const fn of listeners) fn();
}

/** True while the browser has an install prompt waiting to be opened. */
export function canInstall() {
  return deferred !== null;
}

/** Calls `fn` whenever canInstall() changes. Returns an unsubscribe. */
export function onInstallAvailable(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Opens the browser's install prompt. Resolves to the user's choice
 * ('accepted' | 'dismissed'), or null if there was no prompt to open.
 * The event is single-use either way; the browser fires a fresh one if the
 * user may be asked again.
 */
export async function promptInstall() {
  const evt = deferred;
  if (!evt) return null;
  deferred = null;
  announce();
  try {
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    return outcome;
  } catch {
    return null; // already used, or the browser refused to show it
  }
}

/** True when the app is running as an installed app rather than in a tab. */
function isInstalled() {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

export function watchInstallPrompt() {
  if (isInstalled()) return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // keep the browser's own banner from taking over
    deferred = e;
    announce();
  });

  // Installed from our button or from the browser's menu: nothing left to offer.
  window.addEventListener('appinstalled', () => {
    deferred = null;
    announce();
  });
}
