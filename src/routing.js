// The app's two pages as real URLs, under wherever the app is served from:
//   /       the home page (FileDrop), and the progress screen while parsing
//   /view   the viewer for the loaded structure
// On GitHub Pages that's /FMSViewer/ and /FMSViewer/view. Pages has no SPA
// fallback, so the build also writes the app out as 404.html (vite.config.js),
// which is what a reload of /view gets served.

export const HOME = '/';
export const VIEW = '/view';

// The app's own root: the path with any route taken off the end.
const ROOT = window.location.pathname.replace(/view\/?$/, '').replace(/[^/]*$/, '');

export function currentRoute() {
  const rest = window.location.pathname.slice(ROOT.length).replace(/\/$/, '');
  return rest === 'view' ? VIEW : HOME;
}

/** Moves to `route`, as a new history entry unless `replace`; no-op if already there. */
export function navigate(route, { replace = false } = {}) {
  if (currentRoute() === route) return;
  const url = ROOT + (route === VIEW ? 'view' : '');
  if (replace) window.history.replaceState(null, '', url);
  else window.history.pushState(null, '', url);
}

/** Calls `fn(route)` when Back or Forward changes the route. Returns an unsubscribe. */
export function onRouteChange(fn) {
  const handler = () => fn(currentRoute());
  window.addEventListener('popstate', handler);
  return () => window.removeEventListener('popstate', handler);
}
