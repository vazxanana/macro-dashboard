// node --test tests/auth.test.mjs — server-side sign-in (9 Nov 2026 security fix): /api/login, /api/me, /api/logout, the signed
// session cookie (api/_session.js), /api/users without hashes, and /cdata's guest allowlist. Fake stores, no network, no secrets.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const S = require('../api/_session.js'), A = require('../api/_accounts.js');
const login = require('../api/login.js'), me = require('../api/me.js'), logout = require('../api/logout.js'), users = require('../api/users.js'), data = require('../api/data.js');

const ENV = { CTRADER_LINK_KEY: 'link-key-fake-0123456789' };   // no SESSION_SECRET: the key is derived from an existing secret
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const builtIns = { fred: { name: 'Fred', hash: sha('fred-pw'), role: 'reviewer', ict: true }, luxus: { name: 'Luxus', hash: sha('lx-pw'), role: 'viewer' } };
const listOf = (u) => async () => ({ users: u });
function res() { const r = { code: 0, body: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; r.send = (b) => { r.body = b; return r; }; return r; }
const run = async (h, req, d) => { const r = res(); await h.handle({ headers: { host: 'x.test' }, ...req, headers: { host: 'x.test', ...(req.headers || {}) } }, r, d); return r; };
const cookieFrom = (r) => String(r.headers['set-cookie'] || '').split(';')[0];
const signIn = async (pw, deps = { builtIns, blobUsers: listOf({}) }, env = ENV, now) => run(login, { method: 'POST', body: { password: pw } }, { env, deps, now });

test('the session key: SESSION_SECRET when set, else derived from an existing secret, else none (sign-in off)', () => {
  assert.ok(S.secret({ SESSION_SECRET: 'x'.repeat(32) })); assert.ok(S.secret({ CRON_SECRET: 'c' })); assert.equal(S.secret({}), null);
  assert.notDeepEqual(S.secret({ CTRADER_LINK_KEY: 'k' }), crypto.createHash('sha256').update('k').digest(), 'labelled HMAC, not the raw secret');
});

test('login: owner, built-in and Blob members sign in; the cookie is HttpOnly, Secure, SameSite=Lax; no hash comes back', async () => {
  const deps = { builtIns, blobUsers: listOf({ maria: { name: 'Maria', hash: sha('maria-pw'), role: 'viewer', perms: { charts: true } } }) };
  const f = await signIn('fred-pw', deps); assert.equal(f.code, 200); assert.deepEqual(f.body.account, { u: 'fred', name: 'Fred', role: 'reviewer', ict: true });
  assert.match(f.headers['set-cookie'], /^ms_session=[^;]+; Path=\/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax$/);
  const m = await signIn('maria-pw', deps); assert.equal(m.body.account.u, 'maria'); assert.deepEqual(m.body.account.perms, { charts: true });
  assert.doesNotMatch(JSON.stringify([f.body, m.body]), /[0-9a-f]{64}/);
  // the owner's real password is not in the repo: check the owner path through the token instead
  const tok = S.issue(ENV, 'owner', A.OWNER_HASH, S.account('owner')), o = await run(me, { method: 'GET', headers: { cookie: `ms_session=${tok}` } }, { env: ENV, deps });
  assert.deepEqual(o.body.account, { u: 'owner', name: 'Owner', role: 'owner' });
});

test('login failures all look the same: wrong password, a hash as the password, empty, too long, bad body', async () => {
  const outs = [];
  for (const pw of ['nope', sha('fred-pw'), '', 'x'.repeat(500)]) outs.push(await signIn(pw));
  outs.push(await run(login, { method: 'POST', body: '{not json' }, { env: ENV, deps: { builtIns, blobUsers: listOf({}) } }));
  outs.push(await run(login, { method: 'POST', body: { password: 42 } }, { env: ENV, deps: { builtIns, blobUsers: listOf({}) } }));
  for (const r of outs) { assert.equal(r.code, 401); assert.deepEqual(r.body, { error: 'Password not accepted' }); assert.equal(r.headers['set-cookie'], undefined); }
  assert.equal((await run(login, { method: 'POST', headers: { origin: 'https://evil.test' }, body: { password: 'fred-pw' } }, { env: ENV, deps: { builtIns, blobUsers: listOf({}) } })).code, 401, 'cross-site post');
  assert.equal((await run(login, { method: 'GET' }, { env: ENV })).code, 405);
});

test('login: a disabled (removed) member is refused, a built-in included', async () => {
  const deps = { builtIns, blobUsers: listOf({ fred: { ...builtIns.fred, disabled: true }, maria: { name: 'Maria', hash: sha('maria-pw'), role: 'viewer', disabled: true } }) };
  for (const pw of ['fred-pw', 'maria-pw']) { const r = await signIn(pw, deps); assert.equal(r.code, 401); assert.deepEqual(r.body, { error: 'Password not accepted' }); }
  assert.equal((await signIn('lx-pw', deps)).code, 200, 'others still sign in');
});

test('login fails closed when the user list cannot be read; no session key means no sign-in', async () => {
  const broken = { builtIns, blobUsers: async () => { throw new Error('Blob 500'); } };
  const r = await signIn('fred-pw', broken); assert.equal(r.code, 503); assert.equal(r.headers['set-cookie'], undefined);
  assert.equal((await signIn('fred-pw', { builtIns, blobUsers: listOf({}) }, {})).code, 503);
});

test('tokens: tampered, re-signed with another key, expired or malformed tokens are rejected', async () => {
  const now = Date.now(), tok = S.issue(ENV, 'luxus', sha('lx-pw'), { name: 'Luxus', role: 'viewer' }, now);
  assert.ok(S.verify(ENV, tok, now));
  const [body, mac] = tok.split('.'), p = JSON.parse(Buffer.from(body, 'base64url').toString());
  const forged = Buffer.from(JSON.stringify({ ...p, u: 'owner', r: 'owner' })).toString('base64url');
  assert.equal(S.verify(ENV, `${forged}.${mac}`, now), null, 'payload changed');
  assert.equal(S.verify(ENV, `${body}.${mac.slice(0, -2)}AA`, now), null, 'mac changed');
  assert.equal(S.verify({ CTRADER_LINK_KEY: 'another-key' }, tok, now), null, 'other key');
  assert.equal(S.verify(ENV, tok, now + 31 * 86400e3), null, 'expired after 30 days');
  for (const t of ['', 'abc', `${body}.${mac}.x`, null, 'a'.repeat(3000)]) assert.equal(S.verify(ENV, t, now), null);
  const r = await run(me, { method: 'GET', headers: { cookie: `ms_session=${forged}.${mac}` } }, { env: ENV, deps: { builtIns, blobUsers: listOf({}) } });
  assert.equal(r.body.account, null); assert.match(r.headers['set-cookie'], /Max-Age=0/);
  const old = await run(me, { method: 'GET', headers: { cookie: `ms_session=${tok}` } }, { env: ENV, deps: { builtIns, blobUsers: listOf({}) }, now: now + 31 * 86400e3 });
  assert.equal(old.body.account, null);
});

test('/api/me re-reads the user list: new role and perms show up, removal or a new password ends the session', async () => {
  let list = {}; const deps = { builtIns, blobUsers: async () => ({ users: list }) };
  const c = cookieFrom(await signIn('lx-pw', deps));
  assert.deepEqual((await run(me, { method: 'GET', headers: { cookie: c } }, { env: ENV, deps })).body.account, { u: 'luxus', name: 'Luxus', role: 'viewer', mosha: 'teach', home: 'mosha' });   // Luxus's built-in defaults (10 Nov: the Mosha desk is his main page, and he teaches there), applied by key
  list = { luxus: { ...builtIns.luxus, role: 'reviewer', perms: { scanner: false }, ct: true } };
  assert.deepEqual((await run(me, { method: 'GET', headers: { cookie: c } }, { env: ENV, deps })).body.account, { u: 'luxus', name: 'Luxus', role: 'reviewer', ct: true, perms: { scanner: false }, mosha: 'teach', home: 'mosha' });
  list = { luxus: { ...builtIns.luxus, hash: sha('new-pw') } };
  const r = await run(me, { method: 'GET', headers: { cookie: c } }, { env: ENV, deps }); assert.equal(r.body.account, null); assert.match(r.headers['set-cookie'], /Max-Age=0/);
  list = { luxus: { ...builtIns.luxus, disabled: true } };
  assert.equal((await run(me, { method: 'GET', headers: { cookie: c } }, { env: ENV, deps })).body.account, null);
  assert.equal((await run(me, { method: 'GET', headers: { cookie: c } }, { env: ENV, deps: { builtIns, blobUsers: async () => { throw new Error('x'); } } })).code, 503, 'unreadable list: 503, not signed out');
  assert.equal((await run(me, { method: 'GET' }, { env: ENV, deps })).body.account, null, 'no cookie');
});

test('/api/me renews a session older than a day; /api/logout clears the cookie', async () => {
  const t0 = Date.now() - 2 * 86400e3, deps = { builtIns, blobUsers: listOf({}) }, c = cookieFrom(await signIn('fred-pw', deps, ENV, t0));
  const r = await run(me, { method: 'GET', headers: { cookie: c } }, { env: ENV, deps });
  assert.equal(r.body.account.u, 'fred'); const tok = S.verify(ENV, decodeURIComponent(cookieFrom(r).split('=')[1]));
  assert.ok(tok && tok.exp > Date.now() + 29 * 86400e3);
  const out = res(); logout({ method: 'POST', headers: {} }, out); assert.equal(out.code, 200); assert.match(out.headers['set-cookie'], /^ms_session=; Path=\/; Max-Age=0; HttpOnly; Secure; SameSite=Lax$/);
});

test('/api/users never returns a hash; the owner gets every member, a member only their own record, a guest nothing', async () => {
  const stored = { users: { maria: { name: 'Maria', hash: sha('maria-pw'), role: 'viewer' }, fred: { ...builtIns.fred, perms: { ct: false } } }, updated: '2026-11-09' };
  const d = (extra) => ({ env: { ...ENV, BLOB_READ_WRITE_TOKEN: 'b' }, load: async () => stored, builtIns, deps: { builtIns, blobUsers: async () => stored }, ...extra });
  const owner = `ms_session=${S.issue(ENV, 'owner', A.OWNER_HASH, S.account('owner'))}`, fred = cookieFrom(await signIn('fred-pw', { builtIns, blobUsers: async () => stored }));
  const o = await run(users, { method: 'GET', headers: { cookie: owner } }, d());
  assert.equal(o.code, 200); assert.deepEqual(Object.keys(o.body.users).sort(), ['fred', 'maria']); assert.deepEqual(Object.keys(o.body.builtins).sort(), ['fred', 'luxus']);
  const f = await run(users, { method: 'GET', headers: { cookie: fred } }, d());
  assert.deepEqual(Object.keys(f.body.users), ['fred']); assert.equal(f.body.builtins, undefined);
  assert.equal((await run(users, { method: 'GET' }, d())).code, 401);
  for (const b of [o.body, f.body]) assert.doesNotMatch(JSON.stringify(b), /hash|[0-9a-f]{64}/);
});

test('/api/users POST: owner session (or password) only; hashes stay on the server; new passwords hashed there and kept unique', async () => {
  const stored = { users: { maria: { name: 'Maria', hash: sha('maria-pw'), role: 'viewer' } } }; let saved = null;
  const d = { env: { ...ENV, BLOB_READ_WRITE_TOKEN: 'b' }, load: async () => stored, save: async (x) => { saved = x; }, builtIns, deps: { builtIns, blobUsers: async () => stored } };
  const owner = `ms_session=${S.issue(ENV, 'owner', A.OWNER_HASH, S.account('owner'))}`, fred = cookieFrom(await signIn('fred-pw', { builtIns, blobUsers: async () => stored }));
  const post = (cookie, body) => run(users, { method: 'POST', headers: cookie ? { cookie } : {}, body }, d);
  const list = { maria: { name: 'Maria', role: 'reviewer' }, fred: { name: 'Fred', role: 'reviewer', disabled: true }, ana: { name: 'Ana', role: 'viewer', pw: 'ana-pw-1' } };
  assert.equal((await post(fred, { users: list })).code, 403, 'a member cannot save');
  assert.equal((await post(null, { users: list })).code, 403, 'a guest cannot save');
  const r = await post(owner, { users: list, note: 'test' }); assert.equal(r.code, 200, JSON.stringify(r.body));
  assert.equal(saved.users.maria.hash, sha('maria-pw')); assert.equal(saved.users.maria.role, 'reviewer');
  assert.equal(saved.users.fred.hash, builtIns.fred.hash); assert.equal(saved.users.fred.disabled, true);
  assert.equal(saved.users.ana.hash, sha('ana-pw-1'));
  assert.doesNotMatch(JSON.stringify(r.body), /hash|[0-9a-f]{64}/);
  assert.equal((await post(owner, { users: { ana: { name: 'Ana', role: 'viewer', pw: 'lx-pw' } } })).code, 400, 'password of another account');
  assert.equal((await post(owner, { users: { ana: { name: 'Ana', role: 'viewer', hash: sha('x') } } })).code, 400, 'a posted hash is ignored: no password set');
  assert.equal((await post(owner, { users: { ana: { name: 'Ana', role: 'viewer', pw: 'ab' } } })).code, 400, 'too short');
  assert.equal((await run(users, { method: 'POST', headers: { cookie: owner, origin: 'https://evil.test' }, body: { users: list } }, d)).code, 403, 'cross-site');
});

test('/cdata: guests read only the allowlist; protected files need a session and are never cached publicly', async () => {
  // each guest file in its real shape: since 11 Nov a guest gets a cut copy, and a file the cut cannot read is a 503 (tests/guest-files.test.mjs)
  const SHAPE = { 'trades.json': '[]', 'research.json': '[]', 'research/replay-2w.json': '{"trades":[]}', 'snapshot.json': '{"markets":{}}' };
  const env = { ...ENV }, fetchFn = async (u) => ({ ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(Object.entries(SHAPE).find(([f]) => String(u).includes('/' + f + '?')) ?. [1] || '{}').buffer });
  const d = { env, fetch: fetchFn, deps: { builtIns, blobUsers: listOf({}) } };
  assert.deepEqual([...data.GUEST_OK].sort(), ['ict/replay.json', 'mt5/signals.csv', 'research.json', 'research/replay-2w.json', 'snapshot.json', 'trades.json']);
  for (const p of data.GUEST_OK) { const r = await run(data, { query: { p } }, d); assert.equal(r.code, 200, p); assert.match(r.headers['cache-control'], /^public/); }
  for (const p of ['reviews/losses.json', 'ctrader/accounts.json', 'ict/trades.json', 'coach.json', 'research/daily/xau.json']) {
    const g = await run(data, { query: { p } }, d); assert.equal(g.code, 401, p); assert.match(g.headers['cache-control'], /private/);
    const bad = await run(data, { query: { p }, headers: { cookie: 'ms_session=forged.mac' } }, d); assert.equal(bad.code, 401, p);
  }
  S._cache.users = null;
  const c = cookieFrom(await signIn('lx-pw')), ok = await run(data, { query: { p: 'reviews/losses.json' }, headers: { cookie: c } }, d);
  assert.equal(ok.code, 200); assert.equal(ok.headers['cache-control'], 'private, no-store'); assert.equal(ok.headers['access-control-allow-origin'], undefined);
  S._cache.users = null;
  const down = await run(data, { query: { p: 'coach.json' }, headers: { cookie: c } }, { ...d, deps: { builtIns, blobUsers: async () => { throw new Error('x'); } } });
  assert.equal(down.code, 503, 'fails closed when the list was never read');
});

test('the pages carry no password hash and no hash-as-session code', () => {
  for (const f of ['market-structure.html', 'backtest.html', 'macro-desk.html']) {
    const html = fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    assert.doesNotMatch(html, /[0-9a-f]{64}/, f); assert.doesNotMatch(html, /MS_ADMIN_HASH|X-MS-Auth|getItem\('ms-admin'\)|setItem\('ms-admin'/, f);
  }
  const ms = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
  assert.match(ms, /MS_API \+ 'login'/); assert.match(ms, /MS_API \+ 'me'/);
  assert.match(fs.readFileSync(new URL('../backtest.html', import.meta.url), 'utf8'), /fetch\('\/api\/me'/);
  assert.match(fs.readFileSync(new URL('../macro-desk.html', import.meta.url), 'utf8'), /fetch\('\/api\/me'/);
});
