// Service worker for the dashboard and the GOLD terminal page.
// - Offline shell: network-first for page loads and the few static files, with a cache fallback (never for data or API calls).
// - Price alerts: shows the Web Push notifications sent by the /api/alert-cron Vercel cron, and opens the chart on tap.
const CACHE = 'meridian-v3';
const SHELL = ['/', './gold-trading.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()));
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
  if (/^\/(api|md|cdata|_vercel)\//.test(u.pathname)) return;   // live data: straight to the network
  if (e.request.mode !== 'navigate' && !/\.(png|json|webmanifest)$/.test(u.pathname)) return;
  e.respondWith(
    fetch(e.request)
      .then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)).catch(() => {}); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});

self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: 'Price alert', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Price alert', {
    body: d.body || '', tag: d.tag || 'price-alert', renotify: true, requireInteraction: true,
    icon: '/icon-192.png', badge: '/icon-192.png', data: { url: d.url || '/#charts' }, vibrate: [120, 60, 120],
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    const w = ws.find(c => new URL(c.url).origin === location.origin);
    if (w) { w.navigate(url).catch(() => {}); return w.focus(); }
    return self.clients.openWindow(url);
  }));
});
