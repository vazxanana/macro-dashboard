// Registers /sw.js (installable app, offline page, price-alert notifications) and keeps it current. scripts/pwa.mjs links this
// file into every built page. Open any page with ?sw-reset to remove the worker and its caches on this device (price alerts on
// that device then need turning on again).
(function () {
  'use strict';
  var sw = navigator.serviceWorker;
  if (!sw || !window.isSecureContext) return;
  if (/[?&]sw-reset(?:[=&]|$)/.test(location.search)) {
    Promise.all([
      sw.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { return r.unregister(); })); }),
      window.caches ? caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); }) : null
    ]).catch(function () {}).then(function () {
      var u = new URL(location.href); u.searchParams.delete('sw-reset'); location.replace(u.href);
    });
    return;
  }
  var had = !!sw.controller, updated = false, hiddenAt = 0, checked = Date.now(), reg = null;
  // A new worker takes over as soon as it is installed (skipWaiting + clients.claim in sw.js); pages are never cached, so the
  // next page load is the new deploy. An open page keeps running; it reloads only at a quiet moment: back after 10+ minutes away
  // with no dialog open (an installed app can stay open for days).
  sw.addEventListener('controllerchange', function () { if (had) updated = true; had = true; });
  function check() { if (reg && Date.now() - checked > 15 * 60e3) { checked = Date.now(); reg.update().catch(function () {}); } }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
    if (updated && hiddenAt && Date.now() - hiddenAt > 10 * 60e3 && !document.querySelector('dialog[open]')) { location.reload(); return; }
    check();
  });
  setInterval(function () { if (document.visibilityState === 'visible') check(); }, 30 * 60e3);
  function go() { sw.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then(function (r) { reg = r; }).catch(function () {}); }
  if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
})();
