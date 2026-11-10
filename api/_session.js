// Sign-in sessions (9 Nov 2026 security fix). /api/login checks the password on the server and sets an HttpOnly cookie that
// holds an HMAC-signed token; /api/me, /api/profile, /api/users and /cdata (protected files) read it. The browser keeps only
// non-secret account info (name, role, perms) for drawing the page; it can never mint or read the token.
//
// Token: base64url(JSON { v: 1, u, n, r, f, pv, iat, exp }) + "." + base64url(HMAC-SHA256)
//   u user key ("owner" for the owner) · n name · r role (owner | reviewer | viewer) · f keyed fingerprint of the password hash
//   (a password change or a key re-used for someone else ends old sessions) · pv permissions version (informational; the
//   current role and perms are re-read from the user list on every check) · iat / exp issued and expiry (ms, 30 days).
// Key: env SESSION_SECRET when set (16+ chars), else HMAC-SHA256(CTRADER_LINK_KEY or CRON_SECRET, fixed label), so no new env
// var is needed. With none of them set, sign-in answers 503 (never an unsigned session).
const crypto = require('node:crypto');
const A = require('./_accounts');

const COOKIE = 'ms_session', TTL = 30 * 86400e3, LABEL = 'meridian-x/session/v1';
const b64u = (b) => Buffer.from(b).toString('base64url');
function secret(env = process.env) {
  if (env.SESSION_SECRET && String(env.SESSION_SECRET).length >= 16) return crypto.createHash('sha256').update(String(env.SESSION_SECRET)).digest();
  const base = env.CTRADER_LINK_KEY || env.CRON_SECRET;
  return base ? crypto.createHmac('sha256', String(base)).update(LABEL).digest() : null;
}
const mac = (key, body) => b64u(crypto.createHmac('sha256', key).update(body).digest());
const fpOf = (key, h) => b64u(crypto.createHmac('sha256', key).update(`pw|${h}`).digest()).slice(0, 22);
const pvOf = (acct) => crypto.createHash('sha256').update(JSON.stringify([acct.role, acct.ict || false, acct.ct || false, acct.mcp || false, acct.perms || null])).digest('base64url').slice(0, 10);

function sign(env, payload) { const key = secret(env); if (!key) throw Object.assign(new Error('sessions are not set up'), { status: 503 }); const body = b64u(JSON.stringify(payload)); return `${body}.${mac(key, body)}`; }
// the payload of a well-formed, untampered, unexpired token; null otherwise
function verify(env, tok, now = Date.now()) {
  const key = secret(env); if (!key || typeof tok !== 'string' || tok.length > 2000) return null;
  const [body, m, extra] = tok.split('.'); if (!body || !m || extra !== undefined) return null;
  const want = mac(key, body); if (want.length !== m.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(m))) return null;
  let o; try { o = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch (e) { return null; }
  if (!o || o.v !== 1 || typeof o.u !== 'string' || typeof o.f !== 'string' || !(o.exp > now) || !(o.iat <= now + 60e3)) return null;
  return o;
}
// the account as the page may see it (no hash)
function account(u, R) {
  if (u === 'owner') return { u: 'owner', name: 'Owner', role: 'owner' };
  const P = A.publicRecord(R), B = A.BUILT_IN[u];
  if (B) { if (B.mosha && !P.mosha) P.mosha = B.mosha; if (B.home && !P.home) P.home = B.home; }   // built-in defaults by key: a stored copy of the record (a new password) does not lose them
  return { u, ...P, name: P.name || u };
}
function issue(env, u, h, acct, now = Date.now()) {
  const key = secret(env); if (!key) throw Object.assign(new Error('sessions are not set up'), { status: 503 });
  return sign(env, { v: 1, u, n: acct.name, r: acct.role, f: fpOf(key, h), pv: pvOf(acct), iat: now, exp: now + TTL });
}

// Password check for /api/login. Returns { u, h, account } or null; every failure looks the same to the caller (no user
// enumeration). Every member hash is compared (constant time each, no early exit). Throws 503 when the list cannot be read.
async function login(deps, pw) {
  if (typeof pw !== 'string' || !pw || pw.length > 200) return null;
  const h = A.sha(pw);
  if (A.same(h, A.OWNER_HASH)) return { u: 'owner', h, account: account('owner') };
  const users = await A.userList(deps); let hit = null;
  for (const k of Object.keys(users)) { const R = users[k]; if (R && A.KEY_RE.test(k) && A.same(R.hash, h) && !hit) hit = k; }
  return hit ? { u: hit, h, account: account(hit, users[hit]) } : null;
}
// The token's account as the user list stands now: null when removed, disabled, or the password changed since; current role
// and perms otherwise. Throws 503 when the list cannot be read (fail closed).
async function current(env, deps, tok) {
  const key = secret(env); if (!tok || !key) return null;
  const same = (h) => { const want = fpOf(key, h); return want.length === tok.f.length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(tok.f)); };
  if (tok.u === 'owner') return same(A.OWNER_HASH) ? account('owner') : null;
  if (!A.KEY_RE.test(tok.u)) return null;
  const users = deps.users || await A.userList(deps), R = users[tok.u];
  return R && /^[0-9a-f]{64}$/.test(String(R.hash)) && same(R.hash) ? account(tok.u, R) : null;
}

function cookieOf(req) { const m = String((req.headers && req.headers.cookie) || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`)); try { return m ? decodeURIComponent(m[1]) : null; } catch (e) { return null; } }
const setCookie = (tok) => `${COOKIE}=${encodeURIComponent(tok)}; Path=/; Max-Age=${TTL / 1000}; HttpOnly; Secure; SameSite=Lax`;
const clearCookie = () => `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
// state-changing calls: a browser sending an Origin from another site is refused (SameSite=Lax already keeps the cookie off
// cross-site POSTs; this is the second lock). No Origin (server-to-server, old browsers) passes.
function sameOrigin(req) {
  const o = req.headers && req.headers.origin; if (!o) return true;
  try { return new URL(o).host === String(req.headers.host || ''); } catch (e) { return false; }
}

// a short per-instance cache of the user list for hot paths (/cdata): one Blob read a minute at most; fails closed when it has
// never been read. Login, /api/me, /api/profile and /api/users always read it fresh.
const CACHE = { at: 0, users: null };
async function cachedUsers(deps, ms = 60e3, now = Date.now()) {
  if (CACHE.users && now - CACHE.at < ms) return CACHE.users;
  try { CACHE.users = await A.userList(deps); CACHE.at = now; return CACHE.users; }
  catch (e) { if (CACHE.users && now - CACHE.at < 10 * 60e3) return CACHE.users; throw e; }
}
// The signed-in account for a request, or null. opts.cacheMs: use the short user-list cache.
async function fromRequest(req, env, deps, opts = {}) {
  const tok = verify(env, cookieOf(req)); if (!tok) return null;
  if (tok.u !== 'owner' && opts.cacheMs) return current(env, { ...deps, users: await cachedUsers(deps, opts.cacheMs) }, tok);
  return current(env, deps, tok);
}
// the owner's session (no user-list read needed): for owner-only calls that also take the owner password
async function isOwnerSession(req, env = process.env) { const tok = verify(env, cookieOf(req)); return !!(tok && tok.u === 'owner' && (await current(env, {}, tok))); }
const defaultDeps = (env) => ({ blobUsers: () => A.blobUsers(env) });

module.exports = { COOKIE, TTL, secret, sign, verify, issue, login, current, account, cookieOf, setCookie, clearCookie, sameOrigin, fromRequest, isOwnerSession, cachedUsers, defaultDeps, pvOf, _cache: CACHE };
