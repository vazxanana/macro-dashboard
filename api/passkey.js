// Face ID / fingerprint sign-in with passkeys (17 Nov 2026, owner: "Face ID or fingerprint login"). The password stays the
// primary way in; a passkey is something a signed-in member turns on for a device and can remove again.
//   POST { op: 'reg-options' }                  session -> options for navigator.credentials.create (challenge 5 min, UV required)
//   POST { op: 'register', id, response, name? } session -> stores the passkey under the account (10 at most)
//   POST { op: 'login-options' }                no session -> options for navigator.credentials.get (discoverable, UV required)
//   POST { op: 'login', id, response }           no session -> the SAME session cookie and answer as /api/login: { account }
//   GET                                          session -> { passkeys: [{ id, name, at, used }], max }
//   POST { op: 'rename', id, name } / { op: 'remove', id }   session -> own passkeys only
// Sign-in re-checks the account in the user list (removed or disabled: refused; the list unreadable: 503, fails closed) and
// refuses a passkey made before the account's password changed (each passkey keeps a keyed fingerprint of the password hash
// it was made under, the session's own fingerprint): a new password ends every passkey of that account, as it ends sessions.
// Failed sign-ins count in api/_guard.js with failed passwords. Every POST refuses a foreign Origin. Errors are generic.
// Store: one private file passkeys/all.json (public keys, counters, labels; nothing secret), overwritten in place, so every read
// asks the Blob origin (cache=0, the 11 Nov freshness rule). Used challenge nonces are kept there for their 5 minutes, so a
// challenge works once across instances.
const S = require('./_session');
const A = require('./_accounts');
const G = require('./_guard');
const P = require('./_passkey');

const MAX = 10, FILE = 'passkeys/all.json', MAX_ALL = 2000;
const fresh = (url) => { const u = new URL(url); u.searchParams.set('cache', '0'); return u.toString(); };
function blobStore(env, io = {}) {
  const B = () => io.blob || require('@vercel/blob'), F = io.fetch || fetch, token = env.BLOB_READ_WRITE_TOKEN;
  return {
    async get() { const { blobs } = await B().list({ prefix: FILE, token }); const b = blobs.find((x) => x.pathname === FILE); if (!b) return null;
      const r = await F(fresh(b.url), { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(8000) }); if (!r.ok) throw new Error(`passkeys read ${r.status}`); return r.json(); },   // a failed read never looks empty
    async put(data) { await B().put(FILE, JSON.stringify(data), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', token }); },
  };
}
// one write at a time in this instance (read, change, write)
let TAIL = Promise.resolve();
function locked(fn) { const run = TAIL.then(fn, fn); TAIL = run.catch(() => {}); return run; }
const norm = (db) => ({ v: 1, creds: (db && db.creds && typeof db.creds === 'object') ? db.creds : {}, seen: (db && db.seen && typeof db.seen === 'object') ? db.seen : {} });
const prune = (db, now) => { for (const [n, exp] of Object.entries(db.seen)) if (!(exp > now)) delete db.seen[n]; };

// the account as it stands now: its password hash (for the session's fingerprint) and what the page may see; null = refused
async function accountNow(deps, u) {
  if (u === 'owner') return { h: A.OWNER_HASH, account: S.account('owner') };
  if (typeof u !== 'string' || !A.KEY_RE.test(u)) return null;
  const users = await A.userList(deps), R = users[u];   // throws 503 when the list cannot be read
  return R && /^[0-9a-f]{64}$/.test(String(R.hash)) ? { h: R.hash, account: S.account(u, R) } : null;
}
const bodyOf = (req) => { try { const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body; return b && typeof b === 'object' && !Array.isArray(b) ? b : null; } catch (e) { return null; } };
const listOf = (db, u) => Object.entries(db.creds).filter(([, c]) => c && c.u === u).map(([id, c]) => ({ id, name: c.name, at: c.at, used: c.used || null })).sort((a, b) => String(a.at).localeCompare(String(b.at)));

async function handle(req, res, d = {}) {
  const env = d.env || process.env, now = d.now || Date.now(); res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });
  if (req.method === 'POST' && !S.sameOrigin(req)) return res.status(403).json({ error: 'not allowed' });
  const key = S.secret(env); if (!key) return res.status(503).json({ error: 'Sign-in is not available right now' });
  if (!env.BLOB_READ_WRITE_TOKEN && !d.store) return res.status(503).json({ error: 'Face ID sign-in is not set up' });
  const deps = d.deps || S.defaultDeps(env), store = d.store || blobStore(env), host = P.hostOf(req), rp = P.rpFor(host, env);
  const b = req.method === 'POST' ? bodyOf(req) : {}; if (!b) return res.status(400).json({ error: 'bad request' });
  const op = req.method === 'GET' ? 'list' : String(b.op || '');
  try {
    // ---- sign-in: no session ----
    if (op === 'login-options') {
      if (!rp) return res.status(400).json({ error: 'Face ID sign-in is not available on this address' });
      return res.status(200).json({ publicKey: { challenge: P.makeChallenge(key, { t: 'login', rp }, now), rpId: rp, timeout: P.CHALLENGE_MS, userVerification: 'required', allowCredentials: [] } });
    }
    if (op === 'login') {
      const secs = G.wait(req, now); if (secs) return G.tooMany(res, secs);
      const no = (code = 'refused') => { G.failed(req, now); return res.status(401).json({ error: 'Face ID sign-in was not accepted', code }); };
      if (!rp) return res.status(400).json({ error: 'Face ID sign-in is not available on this address' });
      const r = b.response || {}; let cd, ad;
      try { cd = P.clientData(r.clientDataJSON, 'webauthn.get', host); ad = P.parseAuthData(P.unb64u(r.authenticatorData)); } catch (e) { return no(); }
      const ch = P.readChallenge(key, cd.c.challenge, now); if (!ch || ch.t !== 'login' || ch.rp !== rp) return no('challenge');
      if (!Buffer.from(ad.rpIdHash).equals(Buffer.from(P.sha256(rp))) || !P.flagsOk(ad.flags)) return no();
      const id = typeof b.id === 'string' ? b.id : ''; if (!id || id.length > 1400) return no();
      return await locked(async () => {
        const db = norm(await store.get()); prune(db, now);
        const c = db.creds[id]; if (!c) return no('unknown');
        if (db.seen[ch.n]) return no('challenge');
        if (r.userHandle && r.userHandle !== P.userHandle(key, c.u)) return no();
        let sig; try { sig = P.unb64u(r.signature); } catch (e) { return no(); }
        const data = Buffer.concat([Buffer.from(P.unb64u(r.authenticatorData)), Buffer.from(P.sha256(cd.raw))]);
        if (!(await P.verifySig(c.alg, c.pub, sig, data))) return no();
        if ((ad.counter !== 0 || c.counter !== 0) && !(ad.counter > c.counter)) return no('counter');   // a clone or a replay
        const who = await accountNow(deps, c.u); if (!who) return no('account');
        if (c.fp !== S.fingerprint(env, who.h)) return no('password-changed');
        c.counter = ad.counter; c.used = new Date(now).toISOString(); db.seen[ch.n] = ch.exp; await store.put(db);
        res.setHeader('Set-Cookie', S.setCookie(S.issue(env, c.u, who.h, who.account, now)));
        return res.status(200).json({ account: who.account });
      });
    }
    // ---- everything else: the signed-in account's own passkeys ----
    const acct = await S.fromRequest(req, env, deps); if (!acct) return res.status(401).json({ error: 'sign in first' });
    const u = acct.u;
    if (op === 'list') { const db = norm(await store.get()); return res.status(200).json({ passkeys: listOf(db, u), max: MAX, rpId: rp }); }
    if (op === 'reg-options') {
      if (!rp) return res.status(400).json({ error: 'Face ID sign-in is not available on this address' });
      const db = norm(await store.get()), mine = listOf(db, u);
      if (mine.length >= MAX) return res.status(409).json({ error: `You already have ${MAX} devices: remove one first` });
      return res.status(200).json({ publicKey: {
        challenge: P.makeChallenge(key, { t: 'reg', u, rp }, now), rp: { id: rp, name: 'Aureum Desk' },
        user: { id: P.userHandle(key, u), name: acct.name || u, displayName: acct.name || u },
        pubKeyCredParams: P.ALGS.map((alg) => ({ type: 'public-key', alg })), timeout: P.CHALLENGE_MS, attestation: 'none',
        authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'required' },
        excludeCredentials: mine.map((m) => ({ type: 'public-key', id: m.id })) } });
    }
    if (op === 'register') {
      if (!rp) return res.status(400).json({ error: 'Face ID sign-in is not available on this address' });
      const bad = () => res.status(400).json({ error: 'This device\'s answer could not be checked. Try again.' });
      const r = b.response || {}; let cd, att, ad;
      try { cd = P.clientData(r.clientDataJSON, 'webauthn.create', host); att = P.cbor(P.unb64u(r.attestationObject)); ad = P.parseAuthData(att instanceof Map ? att.get('authData') : null); } catch (e) { return bad(); }
      const ch = P.readChallenge(key, cd.c.challenge, now); if (!ch || ch.t !== 'reg' || ch.u !== u || ch.rp !== rp) return bad();
      if (!Buffer.from(ad.rpIdHash).equals(Buffer.from(P.sha256(rp))) || !P.flagsOk(ad.flags) || !ad.credId || !ad.cose) return bad();
      let k; try { k = P.coseToJwk(ad.cose); await P.importKey(k.alg, k.jwk); } catch (e) { return bad(); }
      const id = P.b64u(ad.credId); if (typeof b.id === 'string' && b.id && b.id !== id) return bad();
      const who = await accountNow(deps, u); if (!who) return res.status(401).json({ error: 'sign in first' });
      return await locked(async () => {
        const db = norm(await store.get()); prune(db, now);
        if (db.seen[ch.n]) return bad();
        if (db.creds[id]) return res.status(409).json({ error: 'This device is already turned on' });
        if (listOf(db, u).length >= MAX) return res.status(409).json({ error: `You already have ${MAX} devices: remove one first` });
        if (Object.keys(db.creds).length >= MAX_ALL) return res.status(507).json({ error: 'No room for another device' });
        const name = P.cleanName(b.name) || P.deviceLabel(req.headers && req.headers['user-agent']);
        db.creds[id] = { u, alg: k.alg, pub: k.jwk, counter: ad.counter, fp: S.fingerprint(env, who.h), name, at: new Date(now).toISOString() };
        db.seen[ch.n] = ch.exp; await store.put(db);
        return res.status(200).json({ ok: true, id, name, passkeys: listOf(db, u) });
      });
    }
    if (op === 'rename' || op === 'remove') {
      const id = typeof b.id === 'string' ? b.id : '';
      return await locked(async () => {
        const db = norm(await store.get()), c = db.creds[id];
        if (!c || c.u !== u) return res.status(404).json({ error: 'No such device' });
        if (op === 'remove') delete db.creds[id];
        else { const n = P.cleanName(b.name); if (!n) return res.status(400).json({ error: 'Give the device a name' }); c.name = n; }
        await store.put(db); return res.status(200).json({ ok: true, passkeys: listOf(db, u) });
      });
    }
    return res.status(400).json({ error: 'unknown operation' });
  } catch (e) { return res.status(503).json({ error: 'Face ID sign-in is not available right now' }); }
}
module.exports = (req, res) => handle(req, res);
module.exports.handle = handle;
module.exports.blobStore = blobStore;
module.exports.MAX = MAX;
