// Meridian X side pages (Edge lab, /macro, /veteran/): who is signed in, asked once. /api/me reads the HttpOnly session cookie
// set by the desk's sign-in (see "Server-side sign-in" in CLAUDE.md); a member sees the Desk | Macro | ChronosTrade switch
// (`.hdr-sw[data-mx-members]`), a guest only the way back to the desk. GitHub Pages and local copies have no API: no check.
// window.MX_ME resolves to the account ({u, name, role, perms?}) or null; it never rejects.
(function () {
  'use strict';
  var api = /^https?:$/.test(location.protocol) && !/github\.io$/.test(location.hostname);
  window.MX_ME = !api ? Promise.resolve(null) : fetch('/api/me', { cache: 'no-store', credentials: 'same-origin' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) { return (j && j.account) || null; }, function () { return null; });
  window.MX_ME.then(function (me) {
    document.documentElement.dataset.signed = me ? 'in' : 'out';
    var deny = (me && me.perms && me.perms.macro === false) || (me && me.role === 'public');
    document.querySelectorAll('[data-mx-members]').forEach(function (el) { el.hidden = !me; });
    if (deny) document.querySelectorAll('[data-mx-macro]').forEach(function (el) { el.hidden = true; });
  });
})();
