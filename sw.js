// GOLD Terminal service worker — network-first for same-origin GETs with a
// cache fallback, so the app shell opens offline but never goes stale.
const CACHE = 'gold-terminal-v2';
const SHELL = ['./gold-trading.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(r => {
        const cp = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, cp)).catch(() => {});
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
