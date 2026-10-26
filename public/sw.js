/*
 * Animatron's service worker: the studio keeps working offline once it has
 * been opened. Everything it does is in the browser, so only the app's own
 * files need caching:
 *
 * - On install: both pages and every build file (the list is written in by
 *   scripts/precache.mjs), so everything opens offline, lazily loaded parts
 *   included.
 * - Pages: network first, so a new release shows up on the next visit; the
 *   last copy (or the studio's start page) when offline.
 * - Build files under _next/static: their names change with their content,
 *   so a cached copy is always right: cache first.
 * - Other files of this site (icons, fonts, the manifest): served from the
 *   cache and refreshed in the background.
 *
 * Other origins (a configured cloud, for one) and anything but GET are left
 * to the network untouched.
 */
// Filled in by scripts/precache.mjs after each build: a cache name unique to
// the build, and every file under _next/static.
const VERSION = "animatron-dev";
const PRECACHE = [];
const SCOPE = new URL(self.registration.scope);
const START = SCOPE.pathname;
/** The site's pages, cached on install with every build file, so the studio and the Squiggle Studio open offline even if never visited. */
const PAGES = [START, `${START}squiggle/`];

// Fetched past the browser's HTTP cache (Pages caches for ten minutes), so
// a new build never precaches the previous one's pages.
const fresh = (url) => new Request(url, { cache: "reload" });

// No skipWaiting: a new build's worker waits until the old build's tabs are
// closed, so their lazily loaded parts stay in the old cache until then.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll([...PAGES, ...PRECACHE].map(fresh)))
      .catch((err) => {
        console.error("Animatron offline install failed; the previous version stays in use.", err);
        throw err;
      }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      // Only this app's old caches: other sites on the same origin (GitHub Pages) keep theirs.
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("animatron-") && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(VERSION);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = (await cache.match(request, { ignoreSearch: true })) || (await cache.match(START));
    if (cached) return cached;
    throw err;
  }
}

/** Whole responses only: a partial (Range) one can't be stored. */
const storable = (request, response) => response.ok && response.status !== 206 && !request.headers.has("range");

async function cacheFirst(request) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (storable(request, response)) await cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request);
  const refresh = fetch(request).then((response) => {
    if (storable(request, response)) return cache.put(request, response.clone()).then(() => response);
    return response;
  });
  if (cached) {
    event.waitUntil(refresh.catch(() => undefined));
    return cached;
  }
  return refresh;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(START)) return;
  if (request.mode === "navigate") event.respondWith(networkFirst(request));
  else if (url.pathname.includes("/_next/static/")) event.respondWith(cacheFirst(request));
  else event.respondWith(staleWhileRevalidate(request, event));
});
