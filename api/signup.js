// Sign-up, email verification, owner approval and password reset (17 Nov 2026, owner: "do 2").
//
//   GET  /api/signup                      -> { open: bool }  (whether sign-ups and reset emails can be sent)
//   POST /api/signup { name, email, password }   -> 200 "Check your email…" (the same words whether or not the email is known)
//   GET  /api/signup?verify=<token>       -> 302 /market-structure.html?signup=verified | ?signup=expired
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

let CONNECT = null, BINDING = null;   // handed in by cloudflare/src/worker.mjs: the socket function (cloudflare:sockets connect) and env.EMAIL
const useSmtp = (fn) => { CONNECT = typeof fn === 'function' ? fn : null; };
const useMail = (b) => { BINDING = b && typeof b.send === 'function' ? b : null; };

const sha = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');
const token = () => crypto.randomBytes(32).toString('base64url');
const one = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const emailOf = (v) => { const e = String(v == null ? '' : v).trim().toLowerCase(); return e.length <= 254 && U.EMAIL_RE.test(e) ? e : null; };
const pwOk = (p) => typeof p === 'string' && p.length >= 10 && p.length <= 200;
const tokOk = (t) => typeof t === 'string' && /^[A-Za-z0-9_-]{40,60}$/.test(t);
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
//      useMail), from MAIL_FROM (a plain variable, default desk@aureumdesk.co.uk; its domain must be onboarded to Email Service).
//   2. FALLBACK: Gmail SMTP (api/_smtp.js) with GMAIL_USER / GMAIL_APP_PASSWORD, through the Worker's socket (useSmtp).
//   With both, a binding that throws is followed by one try through Gmail. Neither: null (sign-ups off).
// Returns send(to, subject, text, html) with a `.via` naming the first route.
function mailer(env, d) {
  if (d.send) return d.send;
  const binding = d.binding !== undefined ? d.binding : BINDING, connect = d.connect !== undefined ? d.connect : CONNECT;
  const from = M.oneLine(env.MAIL_FROM || 'desk@aureumdesk.co.uk'), user = env.GMAIL_USER, pass = env.GMAIL_APP_PASSWORD;
  const viaCf = binding && typeof binding.send === 'function' ? (to, subject, text, html) => binding.send({ from: { email: M.address(from), name: 'Aureum Desk' }, to: M.address(to), subject: M.oneLine(subject).slice(0, 150), text: String(text || ''), ...(html ? { html } : {}) }) : null;
  const viaGmail = connect && user && pass ? (to, subject, text, html) => M.sendMail({ connect, user, pass, to, subject, text, html, now: d.now ? d.now() : Date.now(), timeoutMs: 15000 }) : null;
  if (!viaCf && !viaGmail) return null;
  const send = !viaCf ? viaGmail : !viaGmail ? viaCf : async (...a) => { try { return await viaCf(...a); } catch (e) { console.log('[signup] the Email Service binding failed; trying Gmail'); return viaGmail(...a); } };
  send.via = viaCf ? 'email-service' : 'gmail';
  return send;
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const html = (lines, link, label) => `<div style="font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#16181b;max-width:520px">${lines.map((l) => `<p>${esc(l)}</p>`).join('')}${link ? `<p><a href="${esc(link)}" style="display:inline-block;background:#16181b;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">${esc(label)}</a></p><p style="color:#5b616b;font-size:13px">Or open this address: ${esc(link)}</p>` : ''}<p style="color:#5b616b;font-size:13px">Aureum Desk · paper trading, not financial advice</p></div>`;

async function handle(req, res, d = {}) {
  const env = d.env || process.env, now = d.now ? d.now() : Date.now(); res.setHeader('Cache-Control', 'private, no-store');
  const send = mailer(env, d);
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });
  const q = req.query || {};
  if (req.method === 'GET' && !q.verify && !q.list) return res.status(200).json({ open: !!send });
  if (!env.BLOB_READ_WRITE_TOKEN && !d.store) return res.status(503).json({ error: q.verify ? undefined : 'account storage unavailable' });
  const store = d.store || blobStore(env), deps = d.deps || S.defaultDeps(env);
  const loadUsers = d.loadUsers || (async () => (await A.blobUsers(env)) || { users: {} });
  const saveUsers = d.saveUsers || ((data) => U.saveList(env, data));
  const builtIns = d.builtIns || A.builtInUsers();
  const live = (list) => list.filter((x) => x && (x.verified ? now - (x.verifiedAt || x.at) < KEEP_VERIFIED_MS : x.exp > now));
  try {
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
      const items = live(await store.get(PENDING)).filter((p) => p.verified).map((p) => ({ id: p.id, name: p.name, email: p.email, at: new Date(p.at).toISOString(), verifiedAt: new Date(p.verifiedAt || p.at).toISOString() }));
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
      if (A.same(x.hash, A.OWNER_HASH) || Object.values(users).some((u) => u && A.same(u.hash, x.hash))) return res.status(409).json({ error: 'That password is now used by another account: refuse this request and ask them to sign up again with another password.' });
      const taken = new Set(Object.keys(builtIns).concat(Object.keys(stored), ['owner'])); let k = keyOf(x.name), n = 2;
      while (taken.has(k)) { const sfx = `-${n++}`; k = keyOf(x.name).slice(0, 24 - sfx.length) + sfx; }
      stored[k] = { name: one(x.name, 24), role, hash: x.hash, email: x.email };
      const clean = U.clean(stored); if (!clean) return res.status(500).json({ error: 'The account list could not be saved.' });
      await saveUsers({ users: clean, updated: new Date(now).toISOString(), note: `approved a sign-up: ${one(x.name, 24)}` });
      await store.put(PENDING, rest);
      console.log(`[signup] approved a sign-up as ${role}`);
      let emailed = false;
      if (send) emailed = await send(x.email, 'Your seat at Aureum Desk is ready', `Hello ${one(x.name, 24)},\n\nThe owner approved your seat. Sign in on https://aureumdesk.co.uk with the password you chose.\n\nAureum Desk · paper trading, not financial advice`,
        html([`Hello ${one(x.name, 24)},`, 'The owner approved your seat. Sign in with the password you chose.'], 'https://aureumdesk.co.uk/market-structure.html', 'Sign in')).then(() => true, () => false);
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
          await send(e, 'Choose a new password for Aureum Desk', `Someone asked to change the password of your Aureum Desk account.\n\nChoose a new one here (the link works for one hour, once):\n${link}\n\nIf it was not you, ignore this email: your password stays as it is.`,
            html(['Someone asked to change the password of your Aureum Desk account.', 'The link works for one hour, once. If it was not you, ignore this email: your password stays as it is.'], link, 'Choose a new password')).catch(() => console.log('[signup] a reset email could not be sent'));
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
      if (A.same(h, A.OWNER_HASH) || Object.keys(users).some((j) => j !== r.u && A.same(users[j].hash, h)) || pend.some((p) => A.same(p.hash, h))) { G.failed(req); return res.status(400).json({ error: AGAIN }); }
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
    const name = one(b.name, 40), email = emailOf(b.email);
    if (!name || name.length > 24) return res.status(400).json({ error: 'Use a name of 1 to 24 characters.' });
    if (!email) return res.status(400).json({ error: 'Type a valid email address.' });
    if (!pwOk(b.password)) return res.status(400).json({ error: 'Use a password of at least 10 characters.' });
    const h = A.sha(b.password), users = await A.userList({ ...deps, builtIns });
    let list = live(await store.get(PENDING));
    if (A.same(h, A.OWNER_HASH) || Object.values(users).some((u) => u && A.same(u.hash, h)) || list.some((p) => p.email !== email && A.same(p.hash, h))) { G.failed(req, now); return res.status(400).json({ error: AGAIN }); }
    const known = Object.values(users).some((u) => u && u.email && String(u.email).toLowerCase() === email), had = list.find((p) => p.email === email);
    // a known member, a request already confirmed, or one sent in the last 10 minutes: the same answer, nothing sent
    if (known || (had && (had.verified || now - had.at < COOL_MS))) return res.status(200).json({ ok: true, message: SENT });
    list = list.filter((p) => p !== had);
    if (list.length >= CAP) return res.status(429).json({ error: 'Too many sign-ups are waiting right now. Try again tomorrow.' });
    const t = token(), rec = { id: crypto.randomBytes(9).toString('base64url'), name, email, hash: h, tokenHash: sha(t), at: now, exp: now + VERIFY_MS, verified: false };
    const link = `${originOf(req)}/api/signup?verify=${t}`;
    try {
      await send(email, 'Confirm your email for Aureum Desk', `Hello ${name},\n\nConfirm your email for Aureum Desk with this link (it works for 24 hours, once):\n${link}\n\nThen the owner approves your seat, and you sign in with the password you chose.\nIf you did not sign up, ignore this email.`,
        html([`Hello ${name},`, 'Confirm your email for Aureum Desk. The link works for 24 hours, once. Then the owner approves your seat, and you sign in with the password you chose.', 'If you did not sign up, ignore this email.'], link, 'Confirm my email'));
    } catch (e) { console.log('[signup] a confirmation email could not be sent'); return res.status(502).json({ error: 'The email could not be sent. Try again in a few minutes.' }); }
    list.push(rec); await store.put(PENDING, list);
    return res.status(200).json({ ok: true, message: SENT });
  } catch (e) { console.error('[signup] failed'); return res.status(e.status === 503 ? 503 : 500).json({ error: 'Account storage is not available right now. Try again in a minute.' }); }
}

module.exports = (req, res) => handle(req, res);
module.exports.handle = handle;
module.exports.useSmtp = useSmtp;
module.exports.useMail = useMail;
module.exports._t = { originOf, keyOf, blobStore, PENDING, RESETS, OFF, SENT, FORGOT, AGAIN };
