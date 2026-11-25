// Desk notifications (owner, 9 Nov 2026: "a notification icon in the corner, and when they log in it comes onto the screen; a
// feature on my profile to send a notification to all"). The owner posts; every signed-in member reads them.
//   GET  /api/notify                       signed in -> { items: [{ id, at, title, body }] } newest first (last 50)
//   POST /api/notify { title, body }       owner session only -> the new item; { remove: id } deletes one
//   POST /api/notify { title, body, email: true }  also emails it to the owner and every member with an address on file (25 Nov 2026,
//     owner: "Email them"): the sign-up senders (signup.js mailer), at most 60 addresses, addresses never logged or returned, counts only;
//     an unreadable member list or a failing sender never loses the notice (answer `email: { ok: 0, why }`).
// Stored privately in the Blob store as notices/list.json (100 kept). Read/unread is kept per browser and account (localStorage).
// 19 Nov 2026: api/daily.js posts ONE notice a day for the daily reports (`dailyNotice`: id `daily-<day>`, `perm: 'macro'`, `link`).
// A notice with `perm` is shown only to accounts that have that permission (owner: all; a member: unless `perms.macro === false`,
// the role defaults give macro to every role).
const S = require('./_session.js');
const A = require('./_accounts.js');
const U = require('./users.js');
const DAILY_LATE = 3 * 3600e3;   // a report found more than 3 h after its publish time is not announced (a late build never wakes everyone)
// effective permission of a signed-in account, as the page's msPerms reads it (only macro is used today)
function allowed(acct, perm) { if (!perm) return true; if (!acct) return false; if (acct.u === 'owner') return true;
  const P = acct.perms && typeof acct.perms === 'object' ? acct.perms : {}; return P[perm] !== false; }
// the notice for the latest daily report, or null when none is due
function dailyNotice(file, list, now) {
  const r = file && Array.isArray(file.reports) && file.reports[0]; if (!r || !r.day || !r.publishAt) return null;
  const pub = Date.parse(r.publishAt); if (!(pub <= now) || now - pub > DAILY_LATE) return null;
  const id = 'daily-' + r.day; if (list.some((x) => x.id === id)) return null;
  const day = new Date(pub).toLocaleDateString('en-GB', { timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long' });
  const lead = (x) => clean(x && x.lead, 300);
  return { id, at: new Date(now).toISOString(), title: `Daily reports · ${day}`, body: `World economy: ${lead(r.world)}\nMarkets: ${lead(r.markets)}`, perm: 'macro', link: '/macro-desk#s-daily' };
}
const KEEP = 100, SHOW = 50;
// Reads ask the Blob ORIGIN (`?cache=0`), never the CDN copy: the file is overwritten in place, and the CDN serves an overwritten
// file with its old bytes for up to a minute, so another function instance would show old data and its next save would drop
// what was stored in between (11 Nov 2026, the Academy store's bug; same fix).
const fresh = (url) => { const u = new URL(url); u.searchParams.set('cache', '0'); return u.toString(); };
function blobStore(env, io = {}) {
  const B = () => io.blob || require('@vercel/blob'), F = io.fetch || fetch, token = env.BLOB_READ_WRITE_TOKEN, P = 'notices/list.json';
  return {
    async get() { const { blobs } = await B().list({ prefix: P, token }); const b = blobs.find((x) => x.pathname === P); if (!b) return [];
      const r = await F(fresh(b.url), { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(8000) }); if (!r.ok) throw new Error(`notices read ${r.status}`); const j = await r.json(); return Array.isArray(j) ? j : []; },   // a failed read never looks empty (a POST would overwrite the list),
    async put(list) { await B().put(P, JSON.stringify(list), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', token }); },
  };
}
const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);
// the owner and every enabled member with a valid address, once each (at most 60)
function addresses(users, ownerEmail) {
  const out = [], seen = new Set(), add = (e) => { const m = String(e == null ? '' : e).trim().toLowerCase(); if (m && m.length <= 254 && U.EMAIL_RE.test(m) && !seen.has(m) && out.length < 60) { seen.add(m); out.push(m); } };
  add(ownerEmail); for (const R of Object.values(users || {})) { if (R && !R.disabled && R.email) add(R.email); } return out;
}
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
async function emailAll(env, d, item) {
  let users; try { users = await (d.users ? Promise.resolve(d.users) : (d.userList || (() => A.userList(S.defaultDeps(env))))()); } catch (e) { return { ok: 0, failed: 0, why: 'the member list could not be read: nothing was emailed' }; }
  const to = addresses(users, env.OWNER_EMAIL || env.GMAIL_USER); if (!to.length) return { ok: 0, failed: 0, why: 'no address is on file' };
  const send = d.send || require('./signup.js').mailer(env, {}); if (!send) return { ok: 0, failed: to.length, why: 'no mail sender is set up' };
  const text = `${item.body}\n\n— The Aureum Desk · https://aureumdesk.co.uk`, html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#16181B"><p>${esc(item.body).replace(/\n/g, '<br>')}</p><p style="color:#5B616A">The Aureum Desk · <a href="https://aureumdesk.co.uk">aureumdesk.co.uk</a></p></div>`;
  let ok = 0, failed = 0; for (const a of to) { try { await send(a, item.title, text, html); ok++; } catch (e) { failed++; } }
  return { ok, failed, recipients: to.length };
}
async function handle(req, res, d = {}) {
  const env = d.env || process.env; res.setHeader('Cache-Control', 'private, no-store');
  if (!env.BLOB_READ_WRITE_TOKEN && !d.store) return res.status(503).json({ error: 'storage not set up' });
  const store = d.store || blobStore(env), who = d.who || ((r) => S.fromRequest(r, env, S.defaultDeps(env), { cacheMs: 60e3 }));
  try {
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });
    if (req.method === 'POST' && !(d.sameOrigin || S.sameOrigin)(req)) return res.status(403).json({ error: 'not allowed' });
    const acct = await who(req); if (!acct) return res.status(401).json({ error: 'sign in first' });
    const list = await store.get();
    if (req.method === 'GET') return res.status(200).json({ items: list.filter((x) => allowed(acct, x.perm)).slice(-SHOW).reverse() });
    if (acct.u !== 'owner') return res.status(403).json({ error: 'only the owner sends notifications' });
    let b; try { b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}; } catch (e) { return res.status(400).json({ error: 'bad JSON' }); }
    b = b || {};
    if (b.remove) { const next = list.filter((x) => x.id !== String(b.remove)); await store.put(next); return res.status(200).json({ ok: true, removed: list.length - next.length }); }
    const title = clean(b.title, 80), body = clean(b.body, 1000); if (!title && !body) return res.status(400).json({ error: 'write a title or a message' });
    const at = new Date(d.now || Date.now()).toISOString(), item = { id: at.replace(/\D/g, '').slice(0, 17) + Math.random().toString(36).slice(2, 6), at, title: title || 'Message from the desk', body };
    const next = list.concat(item).slice(-KEEP); await store.put(next);
    let email;
    if (b.email === true) email = await emailAll(env, d, item).catch(() => ({ ok: 0, failed: 0, why: 'the email could not be sent' }));
    return res.status(200).json({ ok: true, item, ...(email ? { email } : {}) });
  } catch (e) { return res.status(e.status === 503 ? 503 : 500).json({ error: 'notifications unavailable' }); }
}
module.exports = (req, res) => handle(req, res);
module.exports.handle = handle;
module.exports.blobStore = blobStore;
module.exports.dailyNotice = dailyNotice;
module.exports.allowed = allowed;
