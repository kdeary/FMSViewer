// Service worker: makes the app installable and fully usable offline.
//
// Template -- the build (see vite.config.js) fills in VERSION and PRECACHE,
// the list of every file the build emitted, and writes the result to sw.js.
// VERSION is a hash of that build's contents, so every deploy gets its own
// cache and its own worker. Nothing here ever talks to a server other than the
// one serving the app; spreadsheets are read locally and never pass through it.
//
// Updating (see register.js for the page's side):
//   1. The page checks for a new sw.js on load, hourly, and when it regains
//      focus or the network. The browser fetches sw.js past its HTTP cache.
//   2. A new worker installs alongside the old one, precaching the new build,
//      then *waits* -- the open page is still running the old build's code and
//      may yet lazy-load its files, which the old cache still holds.
//   3. The page is told and asks the user (or, with nothing open, just goes
//      ahead); it then sends SKIP_WAITING, the new worker takes over, deletes
//      the old caches, and the page reloads into the new build.

const VERSION = '__VERSION__';
const PRECACHE = self.__PRECACHE__;
const CACHE = `fmsviewer-${VERSION}`;

// `cache: 'reload'` goes past the HTTP cache, so a file the host told the
// browser to keep for a while can't slip an old copy into a new version.
const fresh = (url) => new Request(url, { cache: 'reload' });

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['./', ...PRECACHE].map(fresh))));
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'GET_VERSION') event.ports[0]?.postMessage(VERSION);
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('fmsviewer-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // The page: always asked of the network first (revalidating past the HTTP
  // cache), so a new deploy is picked up on the next load even before its
  // worker takes over; the cached copy is only for when there's no network.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then((res) => {
          const copy = res.clone();
          if (res.ok) caches.open(CACHE).then((c) => c.put('./', copy));
          return res;
        })
        .catch(() => caches.match('./', { ignoreVary: true })),
    );
    return;
  }

  // Everything else is content-hashed build output, never changed in place:
  // cache first, and keep anything fetched later so it is there offline.
  event.respondWith(
    // ignoreVary: module scripts and fonts are requested with an Origin header the
    // precache requests didn't carry, and a `Vary: Origin` response would miss.
    caches.match(request, { ignoreVary: true }).then((hit) => hit || fetch(request).then((res) => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
      }
      return res;
    })),
  );
});
