// Sign-up, email verification, owner approval and password reset (17 Nov 2026, owner: "do 2").
//
//   GET  /api/signup                      -> { open: bool }  (whether sign-ups and reset emails can be sent)
//   POST /api/signup { name, username, email, password }   -> 200 "Check your email…" (the same words whether or not the email is known)
//   GET  /api/signup?verify=<token>       -> 302 /market-structure.html?signup=verified | ?signup=expired
//   GET  /api/signup?watch=<code>         -> { state: 'confirmed' | 'waiting' } (the sign-up answer's own code; nothing else)
//   GET  /api/signup?list=1               owner session -> { items: [{ id, name, email, at, verifiedAt }] } (verified, no hashes)
//   POST /api/signup { approve: id, role }   owner session -> the account goes into the stored user list (as the Users page saves it)
//   POST /api/signup { refuse: id }          owner session -> the request is removed
//   POST /api/signup { forgot: email }       -> always the same answer; a member with that email gets a reset link (1 h)
//   POST /api/signup { reset: token, password } -> the member's new password (old sessions end: the session fingerprint changes)
//
// Email: the Worker's Cloudflare Email Service binding from MAIL_FROM (the site's domain), else Gmail SMTP (api/_smtp.js,
// GMAIL_USER / GMAIL_APP_PASSWORD); see mailer(). With neither, sign-up and reset emails are off: 503 "Sign-ups are not open
// yet." Nothing else depends on them.
// Stored privately (the users list's store): signups/pending.json and signups/resets.json, overwritten in place, so every read
// asks the origin (`?cache=0`, the Blob freshness rule). A token is 32 random bytes; only its sha256 is stored. A password picks
// the account at sign-in, so one already used by the owner, a member or another request is refused ("Choose another password."),
// and that refusal counts as a failed password check (api/_guard.js): it would otherwise be a way to test passwords.
// A member's email never leaves the server except to the owner (the approval list); publicRecord leaves it out.
const crypto = require('node:crypto');
const A = require('./_accounts');
const S = require('./_session');
const G = require('./_guard');
const M = require('./_smtp');
const U = require('./users.js');

const PENDING = 'signups/pending.json', RESETS = 'signups/resets.json';
const VERIFY_MS = 24 * 3600e3, RESET_MS = 3600e3, KEEP_VERIFIED_MS = 30 * 86400e3, CAP = 200, COOL_MS = 10 * 60e3;
const HOSTS = ['aureumdesk.co.uk', 'www.aureumdesk.co.uk', 'meridianx.meridianx-cloudflare.workers.dev', 'localhost', '127.0.0.1'];
const OFF = 'Sign-ups are not open yet.', OFF_RESET = 'Password reset by email is not open yet.';
const SENT = 'Check your email for a link to confirm it. The link works for 24 hours.';
const FORGOT = 'If that email belongs to an account, a link to choose a new password is on its way. It works for one hour.';
const AGAIN = 'Choose another password.';
// 19 Nov 2026 (owner: "The new users will have access to charts chronos and macro only"): an approved sign-up opens Charts and
// the Macro desk (ChronosTrade is open to every signed-in member) and nothing else; the owner can change it on the Users page
const NEW_PERMS = { charts: true, macro: true, desk: false, scanner: false, journal: false, desks: false, council: false, ct: false, mcp: false, ict: false, mosha: false };
// 18 Nov 2026: a password alone signs in only the owner and the built-in members, so a new or reset password is refused only when
// it is one of theirs (else typing it without a username would open their account); members' passwords may repeat each other.
const pwClash = (h, users, builtIns) => A.same(h, A.OWNER_HASH) || Object.keys(builtIns || {}).concat(A.PW_ONLY).some((k) => users[k] && A.same(users[k].hash, h));

let CONNECT = null, BINDING = null;   // handed in by cloudflare/src/worker.mjs: the socket function (cloudflare:sockets connect) and env.EMAIL
const useSmtp = (fn) => { CONNECT = typeof fn === 'function' ? fn : null; };
let EMAIL_MESSAGE = null, LAST_MAIL_ERROR = null;
const useEmailMessage = (C) => { EMAIL_MESSAGE = typeof C === 'function' ? C : null; };
// an error's text without any email address in it (the provider may quote the recipient)
const redact = (e) => String((e && (e.code ? e.code + ' ' : '') + (e.message || e)) || 'error').replace(/[^\s@<>"']+@[^\s@<>"']+/g, '<address>').slice(0, 200);
const useMail = (b) => { BINDING = b && typeof b.send === 'function' ? b : null; };

const sha = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');
const token = () => crypto.randomBytes(32).toString('base64url');
const one = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const emailOf = (v) => { const e = String(v == null ? '' : v).trim().toLowerCase(); return e.length <= 254 && U.EMAIL_RE.test(e) ? e : null; };
const pwOk = (p) => typeof p === 'string' && p.length >= 10 && p.length <= 200;
const tokOk = (t) => typeof t === 'string' && /^[A-Za-z0-9_-]{40,60}$/.test(t);
// Usernames (18 Nov 2026, owner: "unique username, so no repeated ones"): the account key itself, so one name is one account.
// 3 to 24 of a-z, 0-9 and "-", starting with a letter or digit, case-insensitive; a few words are kept for the desk.
const USER_RE = /^[a-z0-9][a-z0-9-]{2,23}$/;
const RESERVED = new Set(['owner', 'admin', 'aureum', 'desk', 'guest', 'help', 'support', 'root', 'system', 'council', 'member', 'api']);
const userOf = (v) => { const u = String(v == null ? '' : v).trim().toLowerCase(); return USER_RE.test(u) && !RESERVED.has(u) ? u : null; };
const keyOf = (name) => String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'member';

// the private store (the users list's): one JSON file per name, read from the origin, written in place
const fresh = (url) => { const u = new URL(url); u.searchParams.set('cache', '0'); return u.toString(); };
function blobStore(env, io = {}) {
  const B = () => io.blob || require('@vercel/blob'), F = io.fetch || fetch, tk = env.BLOB_READ_WRITE_TOKEN;
  return {
    async get(P) { const { blobs } = await B().list({ prefix: P, token: tk }); const b = blobs.find((x) => x.pathname === P); if (!b) return [];
      const r = await F(fresh(b.url), { headers: { Authorization: `Bearer ${tk}` }, cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error(`signup store read ${r.status}`);   // a failed read never looks empty (the next write would drop the list)
      const j = await r.json(); return Array.isArray(j) ? j : []; },
    async put(P, list) { await B().put(P, JSON.stringify(list), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', token: tk }); },
  };
}

// the link's address: the host the request came to when it is one of the site's own, else the site's domain
function originOf(req) {
  const h = String((req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || '').toLowerCase().split(',')[0].trim();
  const host = h.replace(/:\d+$/, '');
  if (!HOSTS.includes(host)) return 'https://aureumdesk.co.uk';
  return host === 'localhost' || host === '127.0.0.1' ? `http://${h}` : `https://${host}`;
}

// The mail sender, or null when email is off (owner, 17 Nov 2026: the emails come from the site's own domain).
//   1. PRIMARY: the Worker's Cloudflare Email Service binding (`send_email` binding named EMAIL, handed in by the Worker through
//      useMail), from MAIL_FROM (a plain variable, default help@aureumdesk.co.uk; its domain must be onboarded to Email Service).
//   2. FALLBACK: Gmail SMTP (api/_smtp.js) with GMAIL_USER / GMAIL_APP_PASSWORD, through the Worker's socket (useSmtp).
//   With both, a binding that throws is followed by one try through Gmail. Neither: null (sign-ups off).
// Returns send(to, subject, text, html) with a `.via` naming the first route.
function mailer(env, d) {
  if (d.send) return d.send;
  const binding = d.binding !== undefined ? d.binding : BINDING, connect = d.connect !== undefined ? d.connect : CONNECT;
  const from = M.oneLine(env.MAIL_FROM || 'help@aureumdesk.co.uk'), user = env.GMAIL_USER, pass = env.GMAIL_APP_PASSWORD;
  // The binding is tried in the shapes Cloudflare documents (17 Nov 2026: the first live send failed and the docs could not be read
  // from the build sandbox): the Email Service object with `from` as { email, name }, the same with `from` as an address, and the
  // older `send_email` call with a raw MIME message (EmailMessage of the Worker's email module, handed in by the Worker). Each failure
  // is kept (`tries`) so the owner can see which shape the account takes.
  const viaCf = binding && typeof binding.send === 'function' ? async (to, subject, text, html) => {
    const f = M.address(from), t = M.address(to), sub = M.oneLine(subject).slice(0, 150), body = { to: t, subject: sub, text: String(text || ''), ...(html ? { html } : {}) }, tries = [];
    const shapes = [['object', () => binding.send({ from: { email: f, name: 'Aureum Desk' }, ...body })], ['address', () => binding.send({ from: f, ...body })]];
    if (EMAIL_MESSAGE) shapes.push(['mime', () => binding.send(new EMAIL_MESSAGE(f, t, M.build({ from: f, to: t, subject: sub, text, html, now: d.now ? d.now() : Date.now() })))]);
    for (const [k, fn] of shapes) { try { return await fn(); } catch (e) { tries.push(`${k}: ${redact(e)}`); } }
    LAST_MAIL_ERROR = { at: d.now ? d.now() : Date.now(), tries }; console.log('[signup] the Email Service binding failed:', tries.join(' | '));
    throw Object.assign(new Error('email service failed'), { tries });
  } : null;
  const viaGmail = connect && user && pass ? (to, subject, text, html) => M.sendMail({ connect, user, pass, to, subject, text, html, now: d.now ? d.now() : Date.now(), timeoutMs: 15000 }) : null;
  if (!viaCf && !viaGmail) return null;
  const send = !viaCf ? viaGmail : !viaGmail ? viaCf : async (...a) => { try { return await viaCf(...a); } catch (e) { console.log('[signup] the Email Service binding failed; trying Gmail'); return viaGmail(...a); } };
  send.via = viaCf ? 'email-service' : 'gmail';
  return send;
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// One template for every email (18 Nov 2026): a table layout every mail app draws the same, the wordmark, a heading, the
// message, one button, the address as a fallback, a quiet note and the footer. `o` = { title, note }; every text escaped.
// the logo (icons/email-logo.png, drawn by scripts/make-icons.mjs from the mark): always from the site's own domain, a PNG
// because most mail apps show no SVG; its alt text and font say "Aureum Desk" when a mail app blocks images
const SITE = 'https://aureumdesk.co.uk/', LOGO = SITE + 'icons/email-logo.png';
// the fallback link is shown short (the site's name only) and still opens the whole address (19 Nov 2026,
// owner: "make green shorter"); the footer has no disclaimer line (owner: "remove red")
const shortLink = (u) => { try { return new URL(u).host; } catch (e) { return 'aureumdesk.co.uk'; } };
const html = (lines, link, label, o = {}) => {
  const F = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const p = (t, st = '') => `<p style="margin:0 0 16px;font:15px/1.65 ${F};color:#454b55;${st}">${esc(t)}</p>`;
  const body = lines.map((l, i) => p(l, i === 0 ? 'color:#16181b;font-weight:600;' : '')).join('');
  const btn = link ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:12px 0 28px"><tr><td style="border-radius:10px;background:#16181b"><a href="${esc(link)}" style="display:inline-block;padding:15px 30px;font:600 15px/1 ${F};color:#ffffff;text-decoration:none;border-radius:10px">${esc(label)}&nbsp;&nbsp;&rarr;</a></td></tr></table>`
    + `<p style="margin:0;font:13px/1.55 ${F};color:#7a808a">Button not working? <a href="${esc(link)}" style="color:#2f5e9e;text-decoration:underline">Open this link</a> <span style="color:#a3a8b0">(${esc(shortLink(link))})</span></p>` : '';
  const note = o.note ? `<tr><td style="padding:18px 40px 22px;background:#f8f9fa;border-top:1px solid #eceef1;border-radius:0 0 14px 14px;font:13px/1.55 ${F};color:#6b717b">${esc(o.note)}</td></tr>` : '';
  return `<!doctype html><html><head><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head><body style="margin:0;padding:0;background:#eef0f3">`
    + (o.pre ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(o.pre)}</div>` : '')
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f3"><tr><td align="center" style="padding:36px 16px 40px">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">`
    + `<tr><td align="center" style="padding:0 4px 24px"><a href="${SITE}" style="text-decoration:none"><img src="${LOGO}" width="195" height="32" alt="Aureum Desk" style="display:block;border:0;outline:none;width:195px;height:32px;font:700 15px/32px ${F};letter-spacing:.16em;color:#16181b"></a></td></tr>`
    + `<tr><td style="background:#ffffff;border:1px solid #e3e6ea;border-top:3px solid #16181b;border-radius:14px;box-shadow:0 1px 2px rgba(16,24,40,.04)"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">`
    + `<tr><td style="padding:36px 40px 28px">${o.title ? `<h1 style="margin:0 0 22px;font:700 24px/1.3 ${F};color:#16181b;letter-spacing:-.01em">${esc(o.title)}</h1>` : ''}${body}${btn}</td></tr>${note}</table></td></tr>`
    + `<tr><td align="center" style="padding:22px 4px 0;font:12px/1.6 ${F};color:#8a9099"><a href="${SITE}" style="color:#8a9099;text-decoration:none">Aureum Desk</a> &middot; <a href="${SITE}" style="color:#8a9099;text-decoration:underline">aureumdesk.co.uk</a></td></tr>`
    + `</table></td></tr></table></body></html>`;
};

async function handle(req, res, d = {}) {
  const env = d.env || process.env, now = d.now ? d.now() : Date.now(); res.setHeader('Cache-Control', 'private, no-store');
  const send = mailer(env, d);
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });
  const q = req.query || {};
  if (req.method === 'GET' && !q.verify && !q.list && !q.watch) return res.status(200).json({ open: !!send });
  if (!env.BLOB_READ_WRITE_TOKEN && !d.store) return res.status(503).json({ error: q.verify ? undefined : 'account storage unavailable' });
  const store = d.store || blobStore(env), deps = d.deps || S.defaultDeps(env);
  const loadUsers = d.loadUsers || (async () => (await A.blobUsers(env)) || { users: {} });
  const saveUsers = d.saveUsers || ((data) => U.saveList(env, data));
  const builtIns = d.builtIns || A.builtInUsers();
  const live = (list) => list.filter((x) => x && (x.verified ? now - (x.verifiedAt || x.at) < KEEP_VERIFIED_MS : x.exp > now));
  try {
    // ---- watch (18 Nov 2026): the page that sent a sign-up asks every few seconds whether its link was opened, on any device.
    // The code came with the sign-up answer (every answer carries one, so it tells nothing about the email); only its hash is
    // stored. The answer is 'confirmed' or 'waiting', never a name or an email; an unknown or expired code reads 'waiting'.
    if (req.method === 'GET' && q.watch) {
      const w = String(q.watch); if (!tokOk(w)) return res.status(400).json({ error: 'bad code' });
      const lim = G.hit('signup-watch', G.ipOf(req), 1200, 3600e3, now); if (lim) return G.tooMany(res, lim);
      const wh = sha(w), x = live(await store.get(PENDING)).find((p) => p.watchHash && A.same(p.watchHash, wh));
      return res.status(200).json({ state: x && x.verified ? 'confirmed' : 'waiting' });
    }
    // ---- verify (a link from the email) ----
    if (req.method === 'GET' && q.verify) {
      const t = String(q.verify), go = (s) => { res.statusCode = 302; res.setHeader('Location', `/market-structure.html?signup=${s}`); return res.end(); };
      if (!tokOk(t)) return go('expired');
      const list = live(await store.get(PENDING)), th = sha(t), x = list.find((p) => !p.verified && p.tokenHash && A.same(p.tokenHash, th));
      if (!x || !(x.exp > now)) return go('expired');
      x.verified = true; x.verifiedAt = now; delete x.tokenHash; await store.put(PENDING, list);
      console.log('[signup] an email was confirmed');
      const owner = env.OWNER_EMAIL || env.GMAIL_USER;   // a plain variable; the owner's address is never in the repository
      if (send && owner) await send(owner, 'A new sign-up is waiting for your approval', `${one(x.name, 24)} confirmed their email and is waiting for a seat.\nApprove or refuse it on the Users page of the desk.`).catch(() => {});
      return go('verified');
    }
    // ---- the owner's approval list ----
    if (req.method === 'GET' && q.list) {
      const acct = await S.fromRequest(req, env, deps); if (!acct) return res.status(401).json({ error: 'sign in first' });
      if (acct.u !== 'owner') return res.status(403).json({ error: 'only the owner approves seats' });
      const items = live(await store.get(PENDING)).filter((p) => p.verified).map((p) => ({ id: p.id, name: p.name, username: p.username || null, email: p.email, at: new Date(p.at).toISOString(), verifiedAt: new Date(p.verifiedAt || p.at).toISOString() }));
      return res.status(200).json({ items });
    }
    if (!S.sameOrigin(req)) return res.status(403).json({ error: 'not allowed' });
    let b; try { b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}; } catch (e) { return res.status(400).json({ error: 'bad JSON' }); }
    b = b && typeof b === 'object' ? b : {};

    // ---- approve / refuse (owner) ----
    if (b.approve != null || b.refuse != null) {
      const acct = await S.fromRequest(req, env, deps); if (!acct || acct.u !== 'owner') return res.status(403).json({ error: 'only the owner approves seats' });
      const id = String(b.approve != null ? b.approve : b.refuse), list = live(await store.get(PENDING)), x = list.find((p) => p.id === id && p.verified);
      if (!x) return res.status(404).json({ error: 'That request is no longer waiting.' });
      const rest = list.filter((p) => p !== x);
      if (b.refuse != null) { await store.put(PENDING, rest); console.log('[signup] a request was refused'); return res.status(200).json({ ok: true }); }
      const role = b.role === 'reviewer' ? 'reviewer' : 'viewer';
      const cur = (await loadUsers()) || { users: {} }, stored = { ...(cur.users || {}) }, users = await A.userList({ ...deps, builtIns, blobUsers: async () => cur });
      if (pwClash(x.hash, users, builtIns)) return res.status(409).json({ error: 'That password is now used by another account: refuse this request and ask them to sign up again with another password.' });
      const taken = new Set(Object.keys(builtIns).concat(Object.keys(stored), ['owner'])); let k;
      if (x.username) { k = x.username; if (taken.has(k) || users[k]) return res.status(409).json({ error: `The username "${k}" is now taken by another account: refuse this request and ask them to sign up again with another username.` }); }
      else { let n = 2; k = keyOf(x.name); while (taken.has(k)) { const sfx = `-${n++}`; k = keyOf(x.name).slice(0, 24 - sfx.length) + sfx; } }   // a request made before usernames
      stored[k] = { name: one(x.name, 24), role, hash: x.hash, email: x.email, perms: { ...NEW_PERMS } };
      const clean = U.clean(stored); if (!clean) return res.status(500).json({ error: 'The account list could not be saved.' });
      await saveUsers({ users: clean, updated: new Date(now).toISOString(), note: `approved a sign-up: ${one(x.name, 24)}` });
      await store.put(PENDING, rest);
      console.log(`[signup] approved a sign-up as ${role}`);
      let emailed = false;
      if (send) emailed = await send(x.email, 'Your seat at Aureum Desk is ready', `Hello ${one(x.name, 24)},\n\nThe owner approved your seat. Sign in on https://aureumdesk.co.uk with your username "${k}" (or this email) and the password you chose.\n\nAureum Desk · paper trading, not financial advice`,
        html([`Hello ${one(x.name, 24)},`, `Your account has been approved. Sign in with your username ${k} (or this email address) and the password you chose when you signed up.`], 'https://aureumdesk.co.uk/market-structure.html', 'Sign in to Aureum Desk', { title: 'Your seat is ready', note: 'Forgot your password? Use "Forgot password?" on the sign-in screen.' })).then(() => true, () => false);
      return res.status(200).json({ ok: true, key: k, role, emailed });
    }

    // ---- forgot: always the same answer ----
    if (b.forgot != null) {
      if (!send) return res.status(503).json({ error: OFF_RESET });
      const ip = G.ipOf(req), secs = G.hit('forgot', ip, 5, 3600e3, now); if (secs) return G.tooMany(res, secs);
      const e = emailOf(b.forgot); if (!e) return res.status(400).json({ error: 'Type the email address of your account.' });
      if (!G.hit('forgot-mail', sha(e), 1, COOL_MS, now)) {
        const users = await A.userList({ ...deps, builtIns }), k = Object.keys(users).find((j) => users[j] && users[j].email && String(users[j].email).toLowerCase() === e);
        if (k) {
          const t = token(), resets = (await store.get(RESETS)).filter((r) => r && r.exp > now && r.u !== k).slice(-CAP);
          resets.push({ u: k, tokenHash: sha(t), at: now, exp: now + RESET_MS }); await store.put(RESETS, resets);
          const link = `${originOf(req)}/market-structure.html#reset=${t}`;
          await send(e, 'Reset your password · Aureum Desk', `Someone asked to change the password of your Aureum Desk account.\n\nChoose a new one here (the link works for one hour, once):\n${link}\n\nIf it was not you, ignore this email: your password stays as it is.`,
            html(['We received a request to reset the password for your Aureum Desk account.', 'Choose a new password with the button below. For your security, the link works once and expires in one hour.'], link, 'Reset password', { title: 'Reset your password', note: 'If you did not ask for this, you can ignore this email: your password stays as it is and nobody can change it without this link.' })).catch(() => console.log('[signup] a reset email could not be sent'));
        }
      }
      return res.status(200).json({ ok: true, message: FORGOT });
    }

    // ---- reset with a token ----
    if (b.reset != null) {
      const secs = G.wait(req); if (secs) return G.tooMany(res, secs);
      const t = String(b.reset), resets = (await store.get(RESETS)).filter((r) => r && r.exp > now), th = sha(t);
      const r = tokOk(t) && resets.find((x) => A.same(x.tokenHash, th));
      if (!r) { G.failed(req); return res.status(400).json({ error: 'This link has expired or was already used. Ask for a new one.' }); }
      if (!pwOk(b.password)) return res.status(400).json({ error: 'Use a password of at least 10 characters.' });
      const h = A.sha(b.password), cur = (await loadUsers()) || { users: {} }, users = await A.userList({ ...deps, builtIns, blobUsers: async () => cur });
      if (!users[r.u]) { await store.put(RESETS, resets.filter((x) => x !== r)); return res.status(400).json({ error: 'This link has expired or was already used. Ask for a new one.' }); }
      const pend = live(await store.get(PENDING));
      if (A.same(h, A.OWNER_HASH) || Object.keys(builtIns).concat(A.PW_ONLY).some((j) => j !== r.u && users[j] && A.same(users[j].hash, h))) { G.failed(req); return res.status(400).json({ error: AGAIN }); }
      const stored = { ...(cur.users || {}) }; stored[r.u] = { ...(stored[r.u] || builtIns[r.u]), hash: h }; delete stored[r.u].disabled;
      const clean = U.clean(stored); if (!clean) return res.status(500).json({ error: 'The new password could not be saved.' });
      await saveUsers({ users: clean, updated: new Date(now).toISOString(), note: 'a password was reset by email' });
      await store.put(RESETS, resets.filter((x) => x.u !== r.u));
      console.log('[signup] a password was reset by email');
      return res.status(200).json({ ok: true, message: 'Password changed. Sign in with your new password.' });
    }

    // ---- sign up ----
    if (!send) return res.status(503).json({ error: OFF });
    const ip = G.ipOf(req), w = G.wait(req, now) || G.hit('signup', ip, 5, 3600e3, now); if (w) return G.tooMany(res, w);
    const name = one(b.name, 40), email = emailOf(b.email), uname = userOf(b.username);
    if (!name || name.length > 24) return res.status(400).json({ error: 'Use a name of 1 to 24 characters.' });
    if (!uname) return res.status(400).json({ error: RESERVED.has(String(b.username || '').trim().toLowerCase()) ? 'That username is kept for the desk. Choose another.' : 'Choose a username of 3 to 24 letters, numbers or "-".' });
    if (!email) return res.status(400).json({ error: 'Type a valid email address.' });
    if (!pwOk(b.password)) return res.status(400).json({ error: 'Use a password of at least 10 characters.' });
    const h = A.sha(b.password), users = await A.userList({ ...deps, builtIns });
    let list = live(await store.get(PENDING));
    if (pwClash(h, users, builtIns)) { G.failed(req, now); return res.status(400).json({ error: AGAIN }); }
    // one username, one account: a member's key, a built-in, the owner's words, or another live request (not this email's own)
    if (users[uname] || builtIns[uname] || list.some((p) => p.username === uname && p.email !== email)) return res.status(409).json({ error: 'That username is taken. Choose another.', field: 'username' });
    const known = Object.values(users).some((u) => u && u.email && String(u.email).toLowerCase() === email), had = list.find((p) => p.email === email);
    // a known member, a request already confirmed, or one sent in the last 10 minutes: the same answer, nothing sent
    if (known || (had && (had.verified || now - had.at < COOL_MS))) return res.status(200).json({ ok: true, message: SENT, watch: token() });
    list = list.filter((p) => p !== had);
    if (list.length >= CAP) return res.status(429).json({ error: 'Too many sign-ups are waiting right now. Try again tomorrow.' });
    const t = token(), watch = token(), rec = { id: crypto.randomBytes(9).toString('base64url'), name, username: uname, email, hash: h, tokenHash: sha(t), watchHash: sha(watch), at: now, exp: now + VERIFY_MS, verified: false };
    const link = `${originOf(req)}/api/signup?verify=${t}`;
    try {
      await send(email, 'Confirm your email address · Aureum Desk', `Hello ${name},\n\nThank you for signing up to Aureum Desk. Confirm your email address with this link (it works once and expires in 24 hours):\n${link}\n\nThen the owner approves your seat, and you sign in with the password you chose.\nIf you did not sign up, ignore this email.`,
        html([`Hello ${name},`, 'Thank you for signing up to Aureum Desk. Please confirm that this is your email address to continue.', 'Once confirmed, your request goes to the desk owner for approval. We will email you as soon as your seat is ready, and you sign in with the password you chose.'], link, 'Confirm email address', { title: 'Confirm your email address', note: 'This link works once and expires in 24 hours. If you did not create an account, you can safely ignore this email.' }));
    } catch (e) { console.log('[signup] a confirmation email could not be sent'); return res.status(502).json({ error: 'The email could not be sent. Try again in a few minutes.', why: e && e.tries ? e.tries : [redact(e)] }); }
    list.push(rec); await store.put(PENDING, list);
    return res.status(200).json({ ok: true, message: SENT, watch });
  } catch (e) { console.error('[signup] failed'); return res.status(e.status === 503 ? 503 : 500).json({ error: 'Account storage is not available right now. Try again in a minute.' }); }
}

module.exports = (req, res) => handle(req, res);
module.exports.handle = handle;
module.exports.useSmtp = useSmtp;
module.exports.useEmailMessage = useEmailMessage;
module.exports.lastMailError = () => LAST_MAIL_ERROR;
module.exports.useMail = useMail;
module.exports.mailer = mailer;   // the daily reports' email (api/daily.js) uses the same senders
module.exports._t = { html, originOf, keyOf, userOf, RESERVED, blobStore, PENDING, RESETS, OFF, SENT, FORGOT, AGAIN };
