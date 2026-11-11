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
      try { sessionStorage.setItem('mx-sw-reset', '1'); } catch (err) {}
      var u = new URL(location.href); u.searchParams.delete('sw-reset'); location.replace(u.href);
    });
    return;
  }
  var had = !!sw.controller, updated = false, hiddenAt = 0, checked = Date.now(), reg = null;
  // A new worker takes over as soon as it is installed (skipWaiting + clients.claim in sw.js); pages are never cached, so the
  // next page load is the new deploy. An open page keeps running; it reloads only at a quiet moment: back after 10+ minutes away
  // with nothing in hand (an installed app can stay open for days). In hand = a dialog that blocks the page (ChronosTrade's
  // first-steps card is a dialog too, but it blocks nothing and stays up until dismissed: it must not hold the update back for
  // good), the cursor in a field, or text typed into a box and not sent yet. A skipped reload is tried again at the next return.
  function busy() {
    try { if (document.querySelector('dialog:modal')) return true; } catch (err) { if (document.querySelector('dialog[open]')) return true; }
    var a = document.activeElement;
    if (a && (a.isContentEditable || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || (a.tagName === 'INPUT' && !/^(?:button|submit|reset|checkbox|radio|range|color|file|image)$/i.test(a.type)))) return true;
    var ts = document.querySelectorAll('textarea');
    for (var i = 0; i < ts.length; i++) if (ts[i].value && ts[i].value !== ts[i].defaultValue && ts[i].getClientRects().length) return true;
    return false;
  }
  sw.addEventListener('controllerchange', function () { if (had) updated = true; had = true; });
  function check() { if (reg && Date.now() - checked > 15 * 60e3) { checked = Date.now(); reg.update().catch(function () {}); } }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
    if (updated && hiddenAt && Date.now() - hiddenAt > 10 * 60e3 && !busy()) { location.reload(); return; }
    check();
  });
  setInterval(function () { if (document.visibilityState === 'visible') check(); }, 30 * 60e3);
  // Just after ?sw-reset: with another window of the site still open the browser keeps the same worker alive and runs no
  // install, so the caches the reset deleted would stay gone and this page would have no worker. Ask it to set them up again.
  function afterReset() {
    try { if (sessionStorage.getItem('mx-sw-reset') !== '1') return; sessionStorage.removeItem('mx-sw-reset'); } catch (err) { return; }
    sw.ready.then(function (r) { if (r.active) r.active.postMessage('mx-prime'); }).catch(function () {});
  }
  function go() { sw.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then(function (r) { reg = r; afterReset(); }).catch(function () {}); }
  if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
})();
