// Meridian X service worker: installable app, offline page, price-alert notifications.
// Safe by design (tests/pwa.test.mjs, CLAUDE.md "Installable app"):
// - Pages (navigations): network only; when the network fails, the offline page. Pages are never cached, so a deploy shows at once.
// - /api, /cdata, /md, /_vercel, other origins, non-GET, Range requests: not touched at all (the browser goes to the network as if
//   there were no service worker). Private data and API answers never enter Cache Storage.
// - /assets/*?v=<hash> (stamped by scripts/stamp-assets.mjs, the URL changes with the content): stale-while-revalidate.
//   Unversioned files (sounds, icons, the manifest) go to the network and its HTTP revalidation.
// - The build (scripts/pwa.mjs) writes VERSION (hash of everything served), so every deploy is a new worker; it takes over at once
//   (skipWaiting + clients.claim) and deletes the caches of older versions. KILL (build env MX_SW_KILL=1) turns every fetch
//   rule off and deletes the caches, keeping push notifications working.
const VERSION = '39051b419937';
const KILL = false;
const SHELL = 'mx-shell-' + VERSION;
const ASSETS = 'mx-assets-' + VERSION;
const OWN = /^(?:mx-|meridian-|gold-terminal-)/;   // caches this site's workers ever made (older names included)
const OFFLINE = '/offline.html';
const BYPASS = /^\/(?:macro-dashboard\/)?(?:api|cdata|md|_vercel)(?:\/|$)/;
const ASSET = /^\/(?:macro-dashboard\/)?assets\//;
const VER = /[?&]v=[0-9a-f]{6,64}(?:&|$)/;
const FALLBACK = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline · Meridian X</title>'
  + '<body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#08090c;color:#eceef2;font:16px system-ui,sans-serif;text-align:center;padding:16px">'
  + '<p>You\'re offline — prices and trades need a connection.<br><button onclick="location.reload()" style="margin-top:16px;font:inherit;padding:10px 20px">Try again</button></p>';

// 'page' | 'asset' | 'network' — 'network' means the worker does not answer and the request is not cached.
function route(req, origin) {
  if (KILL || req.method !== 'GET') return 'network';
  let u; try { u = new URL(req.url); } catch (err) { return 'network'; }
  if (u.origin !== origin) return 'network';
  if (BYPASS.test(u.pathname)) return 'network';
  if (req.headers && req.headers.get && req.headers.get('range')) return 'network';
  if (req.mode === 'navigate') return 'page';
  if (ASSET.test(u.pathname) && VER.test(u.search)) return 'asset';
  return 'network';
}

// Only a plain 200 from this origin that the server allows to be stored.
function storable(r) {
  return !!r && r.status === 200 && r.type === 'basic' && !/no-store|private/i.test(r.headers.get('Cache-Control') || '');
}

async function page(e) {
  try {
    return await fetch(e.request);
  } catch (err) {
    const hit = await caches.match(OFFLINE).catch(() => null);   // caches.match never creates a cache
    return hit || new Response(FALLBACK, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

async function asset(e) {
  // a newer worker deleted this version's cache: go to the network rather than re-create an orphan cache
  if (!(await caches.has(ASSETS))) return fetch(e.request);
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(e.request);
  const fresh = fetch(e.request).then(async (r) => {
    if (storable(r)) {
      await cache.put(e.request, r.clone());
      // keep one version per file: drop the superseded ?v= entries of the same path
      const path = new URL(e.request.url).pathname;
      for (const k of await cache.keys()) if (k.url !== e.request.url && new URL(k.url).pathname === path) await cache.delete(k);
    }
    return r;
  });
  if (hit) { e.waitUntil(fresh.catch(() => {})); return hit; }
  return fresh;
}

// The caches of this version: the asset cache and the offline page.
async function prime() {
  await caches.open(ASSETS);
  try { await (await caches.open(SHELL)).add(new Request(OFFLINE, { cache: 'reload' })); } catch (err) { /* the inline FALLBACK covers it */ }
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    if (!KILL) await prime();
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = KILL ? [] : [SHELL, ASSETS];
    const names = await caches.keys();
    await Promise.all(names.filter((k) => OWN.test(k) && !keep.includes(k)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const how = route(e.request, self.location.origin);
  if (how === 'page') e.respondWith(page(e));
  else if (how === 'asset') e.respondWith(asset(e));
});

self.addEventListener('message', (e) => {
  if (e.data === 'mx-version' && e.source) e.source.postMessage({ mxVersion: VERSION, kill: KILL });
  // After ?sw-reset with another window still open the browser keeps this same worker (no install runs again), so the page
  // that was reset (assets/pwa.js) asks for the caches back and for the worker to take it. Only the worker in charge answers.
  if (e.data === 'mx-prime' && !KILL && (!self.serviceWorker || self.serviceWorker.state === 'activated')) {
    e.waitUntil(prime().then(() => self.clients.claim()).catch(() => {}));
  }
});

// Push payloads come from api/alert-cron.js as JSON { title, body, url, tag }. Anything else (plain text, null, a bare
// string, wrong types) still becomes a readable notification, and its link only ever points into this site.
const text = (v, max) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '').slice(0, max);
function inSite(url, fallback) {
  try { const u = new URL(String(url), self.location.origin); if (u.origin === self.location.origin && typeof url === 'string' && url) return u.pathname + u.search + u.hash; } catch (err) { /* fallback */ }
  return fallback;
}
function notice(e) {
  let d = null;
  try { d = e.data ? e.data.json() : null; } catch (err) { try { d = { body: e.data.text() }; } catch (err2) { d = null; } }
  if (typeof d === 'string') d = { body: d };
  if (!d || typeof d !== 'object' || Array.isArray(d)) d = {};
  return [text(d.title, 120) || 'Price alert', {
    body: text(d.body, 400), tag: text(d.tag, 80) || 'price-alert', renotify: true, requireInteraction: true,
    icon: '/icons/icon-192.png', badge: '/icons/badge-96.png', data: { url: inSite(d.url, '/#charts') }, vibrate: [120, 60, 120],
  }];
}

self.addEventListener('push', (e) => {
  const n = notice(e);
  e.waitUntil(self.registration.showNotification(n[0], n[1]));
});

// A tap opens the alert's chart on the Desk. A window already on the Desk is brought forward and taken there; a window on
// another page (a ChronosTrade replay, the Academy, the macro desk) is left as it is and the chart opens in a new one. Only
// when the browser will not open a window does an open one get navigated.
const DESK = /^\/(?:index\.html|market-structure\.html)?$/;
const samePage = (a, b) => a.pathname === b.pathname || (DESK.test(a.pathname) && DESK.test(b.pathname));
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const want = new URL(inSite(e.notification.data && e.notification.data.url, '/'), self.location.origin);
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true }).catch(() => []);
    const mine = all.filter((c) => { try { return new URL(c.url).origin === self.location.origin; } catch (err) { return false; } });
    const go = (c) => { if (c.url !== want.href) { try { Promise.resolve(c.navigate(want.href)).catch(() => {}); } catch (err) { /* not ours to move */ } } return Promise.resolve(c.focus()).catch(() => {}); };
    const hit = mine.find((c) => samePage(new URL(c.url), want));
    if (hit) return go(hit);
    try { if (await self.clients.openWindow(want.href)) return; } catch (err) { /* no window allowed: use an open one */ }
    if (mine[0]) return go(mine[0]);
  })());
});
