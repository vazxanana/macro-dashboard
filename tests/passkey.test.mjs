// node --test tests/passkey.test.mjs — Face ID / fingerprint sign-in with passkeys (api/passkey.js, api/_passkey.js; 17 Nov 2026).
// A software authenticator is built here with WebCrypto (P-256 and RSA keys, real authenticator data, client data, 'none'
// attestation objects in CBOR, DER signatures) and drives the real handler with a fake store and clock. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { handle } = require('../api/passkey.js');
const P = require('../api/_passkey.js');
const S = require('../api/_session.js');
const G = require('../api/_guard.js');
const login = require('../api/login.js');

const ENV = { BLOB_READ_WRITE_TOKEN: 't', SESSION_SECRET: 'test-session-secret-0123456789' };
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const FRED = sha('fred-pw'), LUX = sha('luxus-pw');
const builtIns = { fred: { name: 'Fred', hash: FRED, role: 'reviewer', ict: true }, luxus: { name: 'Luxus', hash: LUX, role: 'viewer' } };
let stored = {};
const deps = { builtIns, blobUsers: async () => ({ users: stored }) };
const HOST = 'aureumdesk.co.uk', ORIGIN = 'https://aureumdesk.co.uk';
const T0 = Date.UTC(2026, 10, 17, 12);
const b64u = (b) => Buffer.from(b).toString('base64url');
const cookieFor = (u, h, acct) => `${S.COOKIE}=${encodeURIComponent(S.issue(ENV, u, h, acct || S.account(u, builtIns[u]), T0))}`;

// ---- a minimal CBOR encoder for the test's own authenticator ----
function enc(v) {
  const head = (mt, n) => n < 24 ? Buffer.from([mt << 5 | n]) : n < 256 ? Buffer.from([mt << 5 | 24, n]) : n < 65536 ? Buffer.from([mt << 5 | 25, n >> 8, n & 255]) : Buffer.from([mt << 5 | 26, n >>> 24, (n >> 16) & 255, (n >> 8) & 255, n & 255]);
  if (typeof v === 'number') return v >= 0 ? head(0, v) : head(1, -1 - v);
  if (typeof v === 'string') { const b = Buffer.from(v, 'utf8'); return Buffer.concat([head(3, b.length), b]); }
  if (v instanceof Uint8Array) return Buffer.concat([head(2, v.length), Buffer.from(v)]);
  if (Array.isArray(v)) return Buffer.concat([head(4, v.length), ...v.map(enc)]);
  if (v instanceof Map) return Buffer.concat([head(5, v.size), ...[...v].flatMap(([k, x]) => [enc(k), enc(x)])]);
  if (v === true) return Buffer.from([0xf5]); if (v === false) return Buffer.from([0xf4]); if (v === null) return Buffer.from([0xf6]);
  throw new Error('enc');
}
// raw r||s -> DER (what a real authenticator sends)
function rawToDer(raw) {
  const int = (b) => { let i = 0; while (i < b.length - 1 && b[i] === 0) i++; b = b.subarray(i); if (b[0] & 0x80) b = Buffer.concat([Buffer.from([0]), b]); return Buffer.concat([Buffer.from([2, b.length]), b]); };
  const r = int(Buffer.from(raw.subarray(0, 32))), s = int(Buffer.from(raw.subarray(32)));
  return Buffer.concat([Buffer.from([0x30, r.length + s.length]), r, s]);
}
async function authenticator({ alg = -7, uv = true, rp = HOST } = {}) {
  const kp = alg === -7 ? await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
    : await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', kp.publicKey), credId = crypto.randomBytes(32);
  const cose = alg === -7 ? new Map([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x, 'base64url')], [-3, Buffer.from(jwk.y, 'base64url')]])
    : new Map([[1, 3], [3, -257], [-1, Buffer.from(jwk.n, 'base64url')], [-2, Buffer.from(jwk.e, 'base64url')]]);
  const A = { counter: 0, credId, id: b64u(credId), handle: null };
  const flags = (at) => (uv ? 0x05 : 0x01) | (at ? 0x40 : 0);
  const authData = (at) => { const c = Buffer.alloc(4); c.writeUInt32BE(A.counter); const parts = [crypto.createHash('sha256').update(A.rp || rp).digest(), Buffer.from([flags(at)]), c];
    if (at) { const L = Buffer.alloc(2); L.writeUInt16BE(credId.length); parts.push(Buffer.alloc(16), L, credId, enc(cose)); } return Buffer.concat(parts); };
  const cdj = (type, challenge, origin) => Buffer.from(JSON.stringify({ type, challenge, origin: origin || ORIGIN, crossOrigin: false }));
  A.create = (opts, o = {}) => { A.handle = opts.user.id; const ad = authData(true);
    return { id: A.id, response: { clientDataJSON: b64u(cdj('webauthn.create', o.challenge || opts.challenge, o.origin)), attestationObject: b64u(enc(new Map([['fmt', 'none'], ['attStmt', new Map()], ['authData', ad]]))) } }; };
  A.get = async (opts, o = {}) => { if (!o.sameCounter) A.counter += o.step == null ? 1 : o.step; const ad = authData(false), cd = cdj('webauthn.get', o.challenge || opts.challenge, o.origin);
    const data = Buffer.concat([ad, crypto.createHash('sha256').update(cd).digest()]);
    let sig = Buffer.from(await crypto.subtle.sign(alg === -7 ? { name: 'ECDSA', hash: 'SHA-256' } : { name: 'RSASSA-PKCS1-v1_5' }, kp.privateKey, data));
    if (alg === -7) sig = rawToDer(sig); if (o.tamper) sig[sig.length - 1] ^= 1;
    return { id: o.id || A.id, response: { clientDataJSON: b64u(cd), authenticatorData: b64u(ad), signature: b64u(sig), userHandle: o.userHandle === undefined ? A.handle : o.userHandle } }; };
  return A;
}
const mkStore = () => { const box = { db: null, puts: 0 }; box.store = { get: async () => (box.db ? JSON.parse(JSON.stringify(box.db)) : null), put: async (v) => { box.db = JSON.parse(JSON.stringify(v)); box.puts++; } }; return box; };
let ip = 0;
async function call(box, method, body, { cookie, host = HOST, origin, now = T0, ua, rip } = {}) {
  const out = { code: 0, body: null, headers: {} };
  const res = { setHeader: (k, v) => { out.headers[k.toLowerCase()] = v; }, status: (c) => { out.code = c; return res; }, json: (b) => { out.body = b; return out; } };
  const headers = { host, 'x-real-ip': rip || `10.0.0.${ip}` }; if (cookie) headers.cookie = cookie; if (origin) headers.origin = origin; if (ua) headers['user-agent'] = ua;
  await handle({ method, headers, body, query: {} }, res, { env: ENV, deps, store: box.store, now });
  return out;
}
async function register(box, A, u = 'fred', h = FRED, extra = {}) {
  const c = cookieFor(u, h, u === 'owner' ? S.account('owner') : undefined);
  const o = await call(box, 'POST', { op: 'reg-options' }, { cookie: c, ...extra }); assert.equal(o.code, 200, JSON.stringify(o.body));
  return call(box, 'POST', { op: 'register', ...A.create(o.body.publicKey) }, { cookie: c, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', ...extra });
}
async function signIn(box, A, o = {}, extra = {}) {
  const opt = await call(box, 'POST', { op: 'login-options' }, extra); assert.equal(opt.code, 200);
  return call(box, 'POST', { op: 'login', ...(await A.get(opt.body.publicKey, o)) }, extra);
}
test.beforeEach(() => { stored = {}; ip++; G._reset(); });

test('CBOR: integers, negative keys, byte and text strings, arrays, maps, floats, simple values; truncation refused', () => {
  const m = new Map([[1, 2], [-1, 1], ['s', 'tëxt'], [-300, 70000], ['a', [true, false, null, new Uint8Array([1, 2, 3])]]]);
  const v = P.cbor(enc(m)); assert.equal(v.get(1), 2); assert.equal(v.get(-1), 1); assert.equal(v.get('s'), 'tëxt'); assert.equal(v.get(-300), 70000);
  assert.deepEqual(v.get('a').slice(0, 3), [true, false, null]); assert.deepEqual([...v.get('a')[3]], [1, 2, 3]);
  assert.equal(P.cbor(Buffer.from([0xf9, 0x3c, 0x00])), 1);   // half float 1.0
  assert.equal(P.cbor(Buffer.from([0xfb, 0x40, 0x09, 0x21, 0xfb, 0x54, 0x44, 0x2d, 0x18])), 3.141592653589793);
  assert.equal(P.cbor(Buffer.from([0xc1, 0x1a, 0, 0, 0, 1])), 1, 'a tag gives its content');
  assert.throws(() => P.cbor(Buffer.from([0x5a, 0, 0, 0, 9, 1])), /truncated/);
  assert.throws(() => P.cbor(Buffer.from([0x9f, 1, 0xff])), /indefinite/);
  assert.throws(() => P.cbor(Buffer.from([1, 2])), /trailing/);
});
test('DER signatures become raw r || s (leading zero bytes and short integers)', () => {
  const raw = Buffer.alloc(64); raw[0] = 0x80; raw[31] = 1; raw[63] = 7;   // r has its top bit set (DER pads a zero), s is short
  assert.deepEqual(Buffer.from(P.derToRaw(rawToDer(raw))), raw);
  assert.throws(() => P.derToRaw(Buffer.from([0x31, 0])), /sequence/);
});
test('RP ID: one passkey for aureumdesk.co.uk and www; the workers.dev host and localhost as themselves; others refused', () => {
  assert.equal(P.rpFor('aureumdesk.co.uk'), 'aureumdesk.co.uk'); assert.equal(P.rpFor('www.aureumdesk.co.uk'), 'aureumdesk.co.uk');
  assert.equal(P.rpFor('meridianx.meridianx-cloudflare.workers.dev'), 'meridianx.meridianx-cloudflare.workers.dev');
  assert.equal(P.rpFor('localhost:8793'), 'localhost'); assert.equal(P.rpFor('evil.test'), null); assert.equal(P.rpFor('127.0.0.1'), null);
  assert.equal(P.rpFor('preview.test', { PASSKEY_HOSTS: 'preview.test' }), 'preview.test');
  assert.ok(P.originOk('https://www.aureumdesk.co.uk', 'www.aureumdesk.co.uk')); assert.ok(!P.originOk('https://aureumdesk.co.uk', 'www.aureumdesk.co.uk'));
  assert.ok(P.originOk('http://localhost:8793', 'localhost:8793')); assert.ok(!P.originOk('http://aureumdesk.co.uk', 'aureumdesk.co.uk'));
});

test('registration: options need a session and ask for a discoverable credential with user verification; the passkey is stored', async () => {
  const box = mkStore(), A = await authenticator();
  assert.equal((await call(box, 'POST', { op: 'reg-options' })).code, 401, 'no session');
  const o = await call(box, 'POST', { op: 'reg-options' }, { cookie: cookieFor('fred', FRED) }), pk = o.body.publicKey;
  assert.equal(pk.rp.id, HOST); assert.equal(pk.authenticatorSelection.residentKey, 'required'); assert.equal(pk.authenticatorSelection.userVerification, 'required');
  assert.equal(pk.attestation, 'none'); assert.deepEqual(pk.pubKeyCredParams.map((x) => x.alg), [-7, -257]); assert.notEqual(pk.user.id, 'fred'); assert.deepEqual(pk.excludeCredentials, []);
  const r = await call(box, 'POST', { op: 'register', ...A.create(pk) }, { cookie: cookieFor('fred', FRED), ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' });
  assert.equal(r.code, 200, JSON.stringify(r.body)); assert.equal(r.body.name, 'iPhone'); assert.equal(r.body.passkeys.length, 1);
  const c = box.db.creds[A.id]; assert.equal(c.u, 'fred'); assert.equal(c.pub.kty, 'EC'); assert.equal(c.counter, 0); assert.ok(c.fp && c.fp !== FRED, 'a keyed fingerprint, never the hash');
  assert.ok(!JSON.stringify(box.db).includes(FRED));
  const again = await call(box, 'POST', { op: 'reg-options' }, { cookie: cookieFor('fred', FRED) }); assert.deepEqual(again.body.publicKey.excludeCredentials.map((x) => x.id), [A.id]);
  const list = await call(box, 'GET', null, { cookie: cookieFor('fred', FRED) }); assert.equal(list.body.passkeys[0].id, A.id); assert.equal(list.body.max, 10);
  // an RSA authenticator registers too
  const B = await authenticator({ alg: -257 }); assert.equal((await register(box, B)).code, 200); assert.equal(box.db.creds[B.id].pub.kty, 'RSA');
});
test('registration refused: wrong origin, wrong RP ID, foreign challenge, another account\'s challenge, expired or reused challenge, no UV', async () => {
  const box = mkStore(), c = cookieFor('fred', FRED);
  const opts = async (cookie = c, now = T0) => (await call(box, 'POST', { op: 'reg-options' }, { cookie, now })).body.publicKey;
  const A = await authenticator();
  assert.equal((await call(box, 'POST', { op: 'register', ...A.create(await opts(), { origin: 'https://evil.test' }) }, { cookie: c })).code, 400, 'origin');
  const W = await authenticator({ rp: 'evil.test' }); assert.equal((await call(box, 'POST', { op: 'register', ...W.create(await opts()) }, { cookie: c })).code, 400, 'rp id hash');
  assert.equal((await call(box, 'POST', { op: 'register', ...A.create(await opts(), { challenge: b64u(Buffer.from('made.up')) }) }, { cookie: c })).code, 400, 'challenge not ours');
  const lux = await opts(cookieFor('luxus', LUX));
  assert.equal((await call(box, 'POST', { op: 'register', ...A.create(lux) }, { cookie: c })).code, 400, 'another account\'s challenge');
  const old = await opts(c, T0 - 6 * 60e3); assert.equal((await call(box, 'POST', { op: 'register', ...A.create(old) }, { cookie: c })).code, 400, 'expired');
  const N = await authenticator({ uv: false }); assert.equal((await call(box, 'POST', { op: 'register', ...N.create(await opts()) }, { cookie: c })).code, 400, 'user verification missing');
  assert.equal(box.db, null, 'nothing stored');
  const o = await opts(); assert.equal((await call(box, 'POST', { op: 'register', ...A.create(o) }, { cookie: c })).code, 200);
  const B = await authenticator(); assert.equal((await call(box, 'POST', { op: 'register', ...B.create(o) }, { cookie: c })).code, 400, 'a challenge works once');
  assert.equal((await call(box, 'POST', { op: 'reg-options' }, { cookie: c, host: 'evil.test' })).code, 400, 'unknown host');
  assert.equal((await call(box, 'POST', { op: 'reg-options' }, { cookie: c, origin: 'https://evil.test' })).code, 403, 'foreign Origin header');
});
test('sign-in issues the same session cookie and answer as /api/login', async () => {
  const box = mkStore(), A = await authenticator(); assert.equal((await register(box, A)).code, 200);
  const opt = await call(box, 'POST', { op: 'login-options' }); assert.equal(opt.body.publicKey.userVerification, 'required'); assert.deepEqual(opt.body.publicKey.allowCredentials, []); assert.equal(opt.body.publicKey.rpId, HOST);
  const r = await call(box, 'POST', { op: 'login', ...(await A.get(opt.body.publicKey)) });
  assert.equal(r.code, 200, JSON.stringify(r.body));
  // the password path, for comparison
  const out = { code: 0, body: null, headers: {} }; const res = { setHeader: (k, v) => { out.headers[k.toLowerCase()] = v; }, status: (c) => { out.code = c; return res; }, json: (b) => { out.body = b; return out; } };
  await login.handle({ method: 'POST', headers: { host: HOST }, body: { password: 'fred-pw' } }, res, { env: ENV, deps, now: T0 });
  assert.deepEqual(r.body, out.body, 'same { account }');
  const tok = decodeURIComponent(r.headers['set-cookie'].match(/ms_session=([^;]+)/)[1]); const v = S.verify(ENV, tok, T0 + 1000);
  assert.equal(v.u, 'fred'); assert.equal((await S.current(ENV, deps, v)).u, 'fred', 'a session /api/me accepts');
  assert.equal(r.headers['set-cookie'].replace(/ms_session=[^;]+/, ''), out.headers['set-cookie'].replace(/ms_session=[^;]+/, ''), 'same cookie attributes');
  assert.equal(box.db.creds[A.id].counter, 1); assert.ok(box.db.creds[A.id].used);
  // the owner's passkey signs the owner in
  const O = await authenticator(); assert.equal((await register(box, O, 'owner', require('../api/_accounts.js').OWNER_HASH)).code, 200);
  const ro = await signIn(box, O); assert.equal(ro.code, 200); assert.equal(ro.body.account.role, 'owner');
});
test('sign-in refused: unknown credential, bad signature, counter going back, replayed challenge, wrong origin, no UV, another handle', async () => {
  const box = mkStore(), A = await authenticator(); await register(box, A);
  const X = await authenticator(); assert.equal((await signIn(box, X)).body.code, 'unknown');
  assert.equal((await signIn(box, A, { tamper: true })).code, 401, 'signature');
  assert.equal((await signIn(box, A)).code, 200); assert.equal((await signIn(box, A)).code, 200);   // counter 1, then 2
  A.counter = 1; const back = await signIn(box, A, { step: 0 }); assert.equal(back.code, 401); assert.equal(back.body.code, 'counter');
  A.counter = 5;
  const opt = await call(box, 'POST', { op: 'login-options' }), as = await A.get(opt.body.publicKey);
  assert.equal((await call(box, 'POST', { op: 'login', ...as })).code, 200);
  A.counter++; const re = await A.get(opt.body.publicKey); assert.equal((await call(box, 'POST', { op: 'login', ...re })).body.code, 'challenge', 'a challenge works once');
  assert.equal((await signIn(box, A, { origin: 'https://evil.test' })).code, 401);
  assert.equal((await signIn(box, A, { userHandle: 'AAAAAAAAAAAAAAAAAAAAAA' })).code, 401);
  const late = await call(box, 'POST', { op: 'login-options' }, { now: T0 - 6 * 60e3 });
  assert.equal((await call(box, 'POST', { op: 'login', ...(await A.get(late.body.publicKey)) })).body.code, 'challenge', 'expired');
  const N = await authenticator({ uv: false }); N.handle = A.handle;   // same key? no: a fresh one; UV is checked before the key
  assert.equal((await signIn(box, N)).code, 401);
});
test('a counter that stays 0 (synced passkeys) is accepted; once non-zero it must grow', async () => {
  const box = mkStore(), A = await authenticator(); await register(box, A);
  assert.equal((await signIn(box, A, { sameCounter: true })).code, 200); assert.equal((await signIn(box, A, { sameCounter: true })).code, 200);
});
test('a removed or disabled account, a changed password and an unreadable user list end passkey sign-in', async () => {
  const box = mkStore(), A = await authenticator(); await register(box, A);
  stored = { fred: { name: 'Fred', hash: FRED, role: 'reviewer', disabled: true } };
  assert.equal((await signIn(box, A)).body.code, 'account');
  stored = { fred: { name: 'Fred', hash: sha('a-new-password'), role: 'reviewer' } };
  assert.equal((await signIn(box, A)).body.code, 'password-changed');
  stored = {};
  const r = await (async () => { const opt = await call(box, 'POST', { op: 'login-options' }); const as = await A.get(opt.body.publicKey);
    const out = { code: 0, body: null }; const res = { setHeader() {}, status: (c) => { out.code = c; return res; }, json: (b) => { out.body = b; return out; } };
    await handle({ method: 'POST', headers: { host: HOST }, body: { op: 'login', ...as } }, res, { env: ENV, deps: { builtIns, blobUsers: async () => { throw new Error('down'); } }, store: box.store, now: T0 }); return out; })();
  assert.equal(r.code, 503, 'fails closed');
  assert.equal((await signIn(box, A)).code, 200, 'back once the account is as it was');
});
test('rename and remove: own passkeys only; at most 10 a member', async () => {
  const box = mkStore(), A = await authenticator(), L = await authenticator(); await register(box, A); await register(box, L, 'luxus', LUX);
  const lc = cookieFor('luxus', LUX), fc = cookieFor('fred', FRED);
  assert.equal((await call(box, 'POST', { op: 'remove', id: A.id }, { cookie: lc })).code, 404, 'not his');
  assert.equal((await call(box, 'GET', null, { cookie: lc })).body.passkeys.length, 1, 'a member lists only his own');
  assert.equal((await call(box, 'POST', { op: 'rename', id: A.id, name: 'Work <phone>' }, { cookie: fc })).body.passkeys[0].name, 'Work phone');
  assert.equal((await call(box, 'POST', { op: 'remove', id: A.id }, { cookie: fc })).code, 200); assert.ok(!box.db.creds[A.id]);
  assert.equal((await signIn(box, A)).body.code, 'unknown', 'a removed passkey no longer signs in');
  for (let i = 0; i < 10; i++) assert.equal((await register(box, await authenticator())).code, 200);
  assert.equal((await call(box, 'POST', { op: 'reg-options' }, { cookie: fc })).code, 409);
});
test('failed passkey sign-ins count with failed passwords: 429 after 10 from one address', async () => {
  const box = mkStore(), A = await authenticator(); await register(box, A);
  for (let i = 0; i < 10; i++) assert.equal((await signIn(box, A, { tamper: true }, { rip: '10.9.9.9' })).code, 401);
  const r = await signIn(box, A, {}, { rip: '10.9.9.9' }); assert.equal(r.code, 429);
  assert.equal((await signIn(box, A, {}, { rip: '10.9.9.8' })).code, 200, 'another address is not held');
});
test('wiring: the Worker routes it, vercel.json lists it, the store reads the origin, the page offers it', () => {
  assert.match(fs.readFileSync('cloudflare/src/worker.mjs', 'utf8'), /import passkey from '\.\.\/\.\.\/api\/passkey\.js'/);
  assert.ok(JSON.parse(fs.readFileSync('vercel.json', 'utf8')).functions['api/passkey.js']);
  const src = fs.readFileSync('api/passkey.js', 'utf8'); assert.match(src, /searchParams\.set\('cache', '0'\)/); assert.match(src, /S\.issue\(env, c\.u, who\.h, who\.account, now\)/);
  const page = fs.readFileSync('market-structure.html', 'utf8');
  assert.match(page, /autocomplete="current-password webauthn"/);
  for (const id of ['ms-gate-pk', 'ms-gate-pkb', 'ms-pf-pkrow', 'ms-pf-pk', 'ms-pk-css', 'ms-pk-js']) assert.ok(page.includes(`id="${id}"`), id);
  const js = page.slice(page.indexOf('<script id="ms-pk-js">'), page.indexOf('</script>', page.indexOf('<script id="ms-pk-js">')));
  assert.doesNotMatch(js, /localStorage\.setItem\('[^']*(pw|password|token|secret)/i, 'nothing secret in browser storage');
  assert.match(js, /PublicKeyCredential/);
});
