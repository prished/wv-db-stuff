/* Water Vipers OC Timer — service worker
   Caches the app shell so the app opens and runs with no signal once it has
   been loaded once. Bump CACHE_VERSION whenever you change index.html or icons
   so phones pick up the new version on their next online launch. */

const CACHE_VERSION = "wv-oc-timer-v10";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./sync.js",
  "./firebase-config.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon.ico"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const isShell =
    url.origin === self.location.origin &&
    (req.mode === "navigate" ||
      APP_SHELL.some((path) => url.pathname.endsWith(path.replace("./", "/"))));

  if (isShell) {
    /* Network-first for the app shell: get updates when online,
       fall back to cache when offline. */
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match("./index.html"))
        )
    );
    return;
  }

  /* Everything else (e.g. realtime sync calls): cache-first with network fallback. */
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req))
  );
});
