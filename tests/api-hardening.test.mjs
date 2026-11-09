// node --test tests/api-hardening.test.mjs — hardening pass over the serverless API (9 Nov 2026): password-guess limits, cron
// secret compare, public error / status detail, push storage caps, Blob read robustness, MCP grant precedence, method checks.
// Fake Blob store, fake web-push, fake fetch: no network, no real secrets.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import Module, { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// ---- fakes for the modules that are not installed in CI (no npm install there) ----
const BLOB = { blobs: [], puts: [], dels: [], fail: null, seq: 0 };
const fakeBlob = {
  list: async ({ prefix = '' } = {}) => { if (BLOB.fail) throw BLOB.fail; return { blobs: BLOB.blobs.filter((b) => b.pathname.startsWith(prefix)), hasMore: false }; },
  put: async (pathname, body) => { BLOB.puts.push({ pathname, body }); const b = { pathname, url: `https://blob.test/${pathname}?${++BLOB.seq}`, uploadedAt: new Date(Date.now() + BLOB.seq).toISOString(), body }; BLOB.blobs.push(b); return b; },
  del: async (urls) => { const u = [].concat(urls); BLOB.dels.push(...u); BLOB.blobs = BLOB.blobs.filter((b) => !u.includes(b.url)); },
};
const PUSH = { sent: [] };
const fakeWebpush = { setVapidDetails() {}, sendNotification: async (sub, payload) => { PUSH.sent.push({ sub, payload }); return { statusCode: 201 }; } };
const origLoad = Module._load;
Module._load = function (r, ...rest) { if (r === '@vercel/blob') return fakeBlob; if (r === 'web-push') return fakeWebpush; return origLoad.call(this, r, ...rest); };
const resetBlob = () => { BLOB.blobs = []; BLOB.puts = []; BLOB.dels = []; BLOB.fail = null; PUSH.sent = []; };
const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json' } });
// fetch: blob urls answer their stored body; everything else 404 unless a route matches
const fetchWith = (routes = []) => async (url) => { const u = String(url);
  for (const [re, fn] of routes) if (re.test(u)) return fn(u);
  const b = BLOB.blobs.find((x) => x.url === u); if (b) return new Response(b.body, { status: 200 });
  return new Response('{"message":"Not Found"}', { status: 404 }); };
globalThis.fetch = fetchWith();

const G = require('../api/_guard.js');
const S = require('../api/_session.js');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const builtIns = { fred: { name: 'Fred', hash: sha('fred-pw'), role: 'reviewer', ict: true, mcp: true } };
const listOf = (u) => async () => ({ users: u });
function res() { const r = { code: 0, body: null, headers: {}, loc: null };
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; };
  r.send = (b) => { r.body = b; return r; }; r.end = () => r; r.redirect = (c, l) => { r.code = c; r.loc = l; return r; }; return r; }
const ip = (a) => ({ host: 'x.test', 'x-real-ip': a, 'x-forwarded-for': a });
const ENV = { CTRADER_LINK_KEY: 'link-key-fake-0123456789' };

// ---------------------------------------------------------------------------------------------------------------------------
test('guard: failed password checks per IP, a sliding window, independent IPs, memory bounded', () => {
  G._reset(); const t0 = 1e12, a = { headers: ip('1.1.1.1') }, b = { headers: ip('2.2.2.2') };
  for (let i = 0; i < G.MAX; i++) { assert.equal(G.wait(a, t0 + i), 0); G.failed(a, t0 + i); }
  assert.ok(G.wait(a, t0 + G.MAX) > 0, 'blocked after MAX failures'); assert.equal(G.wait(b, t0), 0, 'another IP is not');
  assert.equal(G.wait(a, t0 + G.WINDOW + 1), 0, 'the oldest failure ages out: no long lock-out');
  assert.equal(G.ipOf({ headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.1' } }), '9.9.9.9'); assert.equal(G.ipOf({ headers: {} }), 'unknown');
  G._reset(); for (let i = 0; i < 6000; i++) G.failed({ headers: ip(`10.0.${i >> 8}.${i & 255}`) }, t0);
  assert.ok(G._size() <= G.KEEP, 'the table stays bounded');
  G._reset();
});

test('login: password guessing is limited per IP; the right password waits too; other IPs unaffected', async () => {
  G._reset(); const login = require('../api/login.js'), deps = { builtIns, blobUsers: listOf({}) };
  const go = async (pw, a = '3.3.3.3') => { const r = res(); await login.handle({ method: 'POST', headers: ip(a), body: { password: pw } }, r, { env: ENV, deps }); return r; };
  for (let i = 0; i < G.MAX; i++) assert.equal((await go('wrong' + i)).code, 401);
  const blocked = await go('fred-pw'); assert.equal(blocked.code, 429); assert.ok(+blocked.headers['retry-after'] > 0); assert.equal(blocked.headers['set-cookie'], undefined);
  assert.equal((await go('fred-pw', '4.4.4.4')).code, 200);
  G._reset();
});

test('the limit is shared by every password check: cTrader link, MCP key, owner-password fallbacks', async () => {
  // ctrader-link session
  G._reset(); const ct = require('../api/ctrader-link.js');
  const CENV = { CTRADER_CLIENT_ID: 'cid-fake', CTRADER_CLIENT_SECRET: 'csecret-fake', CTRADER_LINK_KEY: 'link-key-fake-0123456789', BLOB_READ_WRITE_TOKEN: 'blob-fake' };
  const store = { get: async () => null, set: async () => {}, del: async () => {} }, opts = { env: CENV, deps: { store, blobUsers: listOf({}), builtIns } };
  const ctPost = async (pw, a = '5.5.5.5') => { const r = res(); await ct.handle({ method: 'POST', headers: ip(a), body: { action: 'session', user: 'fred', pw } }, r, opts); return r; };
  for (let i = 0; i < G.MAX; i++) assert.equal((await ctPost('nope' + i)).code, 403);
  assert.equal((await ctPost('fred-pw')).code, 429, 'cTrader link session');
  assert.equal((await ctPost('fred-pw', '6.6.6.6')).code, 200);
  // the same IP is also refused on sign-in: one budget for every password check
  const login = require('../api/login.js'), r0 = res(); await login.handle({ method: 'POST', headers: ip('5.5.5.5'), body: { password: 'fred-pw' } }, r0, { env: ENV, deps: { builtIns, blobUsers: listOf({}) } });
  assert.equal(r0.code, 429, 'shared across endpoints');

  // MCP profile key (mykey): the user list comes from the fake Blob store / fake GitHub (none: built-ins only)
  G._reset(); resetBlob(); const mcp = require('../api/mcp.js');
  const mk = async (pw, a = '7.7.7.7') => { const r = res(); await mcp({ method: 'POST', headers: ip(a), query: {}, body: { action: 'mykey', user: 'fred', pw } }, r); return r; };
  for (let i = 0; i < G.MAX; i++) assert.equal((await mk('nope' + i)).code, 403);
  assert.equal((await mk('still-wrong')).code, 429, 'MCP mykey');

  // users / sounds owner password (no owner session)
  G._reset(); const users = require('../api/users.js'), sounds = require('../api/sounds.js');
  const uPost = async (a = '8.8.8.8') => { const r = res(); await users.handle({ method: 'POST', headers: ip(a), body: { ownerPw: 'not-the-owner', users: {} } }, r, { env: ENV, load: async () => ({ users: {} }), save: async () => {}, deps: { builtIns, blobUsers: listOf({}) } }); return r; };
  for (let i = 0; i < G.MAX; i++) assert.equal((await uPost()).code, 403);
  assert.equal((await uPost()).code, 429, 'users ownerPw');
  G._reset(); let saved = 0; const sstore = { get: async () => ({}), put: async () => { saved++; } };
  const sPost = async (pw) => { const r = res(); await sounds.handle({ method: 'POST', headers: ip('8.8.4.4'), body: { ownerPw: pw, kind: 'sl', data: null } }, r, { env: {}, store: sstore, isOwner: (p) => p === 'right', isOwnerSession: async () => false }); return r; };
  for (let i = 0; i < G.MAX; i++) assert.equal((await sPost('bad')).code, 403);
  assert.equal((await sPost('right')).code, 429, 'sounds ownerPw'); assert.equal(saved, 0);

  // bridge / tv-webhook owner password
  G._reset(); process.env.BLOB_READ_WRITE_TOKEN = 'blob-fake'; process.env.TV_WEBHOOK_KEY = 'tv-key-fake-0123456789';
  const bridge = require('../api/bridge.js'), tv = require('../api/tv-webhook.js');
  const bPost = async () => { const r = res(); await bridge({ method: 'POST', headers: ip('9.9.9.9'), body: { ownerPw: 'nope', file: 'mt5' } }, r); return r; };
  for (let i = 0; i < G.MAX; i++) assert.equal((await bPost()).code, 403);
  assert.equal((await bPost()).code, 429, 'bridge ownerPw');
  const tPost = async () => { const r = res(); await tv({ method: 'POST', headers: ip('9.9.9.9'), query: {}, body: { ownerPw: 'nope', list: true } }, r); return r; };
  assert.equal((await tPost()).code, 429, 'tv-webhook ownerPw (same IP, same budget)');
  G._reset(); delete process.env.TV_WEBHOOK_KEY;
});

test('cron endpoints compare the secret in constant time (no plain string compare)', async () => {
  assert.equal(G.bearerOk('Bearer s3cret-value', 's3cret-value'), true);
  for (const h of ['Bearer s3cret-valuX', 'Bearer s3cret', 's3cret-value', '', undefined, 'Bearer s3cret-value ']) assert.equal(G.bearerOk(h, 's3cret-value'), false, String(h));
  assert.equal(G.bearerOk('Bearer ', ''), false, 'no secret configured: never ok'); assert.equal(G.bearerOk('Bearer undefined', undefined), false);
  for (const f of ['../api/run.js', '../api/alert-cron.js']) {
    const src = fs.readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /authorization\s*!==?\s*`Bearer/, `${f}: timing-unsafe compare`); assert.match(src, /bearerOk\(/, f);
  }
  const run = require('../api/run.js'), saved = process.env.CRON_SECRET; process.env.CRON_SECRET = 'cron-fake-0123456789';
  for (const h of [undefined, 'Bearer nope', 'Bearer cron-fake-012345678']) { const r = res(); await run({ headers: { authorization: h }, query: { job: 'council' } }, r); assert.equal(r.code, 401); }
  if (saved === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = saved;
});

test('/api/status is public and edge-cached: no stack trace or error cause of the runner in it', async () => {
  resetBlob(); process.env.BLOB_READ_WRITE_TOKEN = 'blob-fake';
  await fakeBlob.put('runs/council-1.json', JSON.stringify({ at: new Date().toISOString(), mode: 'live', error: 'GitHub 500 /git/trees: boom', cause: 'ECONNRESET socket hang up', stack: 'at gh (/var/task/api/run.js:40:11) | at async (/var/task/api/run.js:60:3)', step: 'commit' }));
  const status = require('../api/status.js'), r = res(); await status({ method: 'GET', headers: {}, query: {} }, r);
  assert.equal(r.code, 200); const lr = r.body.bots.council.lastRun;
  assert.equal(lr.error, 'GitHub 500 /git/trees: boom', 'the page still shows the error line'); assert.equal(lr.step, 'commit');
  assert.equal(lr.stack, undefined); assert.equal(lr.cause, undefined); assert.doesNotMatch(JSON.stringify(r.body), /\/var\/task|ECONNRESET/);
  resetBlob();
});

test('bridge: a storage error is not echoed to the public; only GET and POST are answered', async () => {
  resetBlob(); process.env.BLOB_READ_WRITE_TOKEN = 'blob-fake'; BLOB.fail = new Error('Vercel Blob: store_internal_detail 500');
  const bridge = require('../api/bridge.js'); let r = res(); await bridge({ method: 'GET', headers: {}, query: {} }, r);
  assert.equal(r.code, 200); assert.equal(r.body.lastRead, null); assert.doesNotMatch(JSON.stringify(r.body), /store_internal_detail/);
  resetBlob(); r = res(); await bridge({ method: 'DELETE', headers: {}, query: {} }, r); assert.equal(r.code, 405);
});

test('push: unauthenticated saves are capped (endpoint / key sizes), bad alert items are a 400, storage errors stay generic', async () => {
  resetBlob(); process.env.BLOB_READ_WRITE_TOKEN = 'blob-fake'; process.env.VAPID_PUBLIC_KEY = 'vapid-public-fake';
  const push = require('../api/push.js'), keys = { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) }, ep = 'https://fcm.googleapis.com/fcm/send/abc';
  const post = async (body) => { const r = res(); await push({ method: 'POST', headers: {}, query: {}, body }, r); return r; };
  const alert = { id: 'a1', sym: 'xau', price: 2000, dir: 'above', at: 1 };
  assert.equal((await post({ sub: { endpoint: ep, keys }, alerts: [alert] })).code, 200, 'a normal save works');
  resetBlob();
  assert.equal((await post({ sub: { endpoint: ep + 'x'.repeat(5000), keys }, alerts: [alert] })).code, 400, 'huge endpoint');
  assert.equal((await post({ sub: { endpoint: ep, keys: { ...keys, p256dh: 'B'.repeat(100000) } }, alerts: [alert] })).code, 400, 'huge key');
  assert.equal((await post({ sub: { endpoint: ep, keys: { p256dh: { x: 1 }, auth: 'a' } }, alerts: [alert] })).code, 400, 'keys must be strings');
  assert.equal(BLOB.puts.length, 0, 'nothing stored');
  const nul = await post({ sub: { endpoint: ep, keys }, alerts: [null] }); assert.equal(nul.code, 400); assert.doesNotMatch(JSON.stringify(nul.body), /Cannot read/);
  BLOB.fail = new Error('Vercel Blob: store_internal_detail'); const down = await post({ sub: { endpoint: ep, keys }, get: true });
  assert.equal(down.code, 500); assert.doesNotMatch(JSON.stringify(down.body), /store_internal_detail/);
  resetBlob();
});

test('alert-cron: one unreadable / malformed device record does not stop the other devices\' alerts', async () => {
  resetBlob(); const env = { CRON_SECRET: 'cron-fake-0123456789', OANDA_TOKEN: 'oanda-fake', VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv', BLOB_READ_WRITE_TOKEN: 'blob-fake' };
  const saved = {}; for (const k of Object.keys(env)) { saved[k] = process.env[k]; process.env[k] = env[k]; }
  const now = Math.floor(Date.now() / 1000);
  await fakeBlob.put('push/aaaaaaaaaaaaaaaaaaaaaaaa/d.json', 'null');
  await fakeBlob.put('push/bbbbbbbbbbbbbbbbbbbbbbbb/d.json', JSON.stringify({ sub: { endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: 'p', auth: 'a' } }, alerts: [{ id: 'a1', sym: 'xau', price: 2000, dir: 'above', at: now - 60 }] }));
  globalThis.fetch = fetchWith([[/oanda\.com\/v3\/instruments\/XAU_USD\/candles/, () => json({ candles: [{ time: String(now - 30), mid: { o: '1999', h: '2001', l: '1998', c: '2000.5' } }] })]]);
  const cron = require('../api/alert-cron.js'), r = res(); await cron({ method: 'GET', headers: { authorization: `Bearer ${env.CRON_SECRET}` }, query: {} }, r);
  globalThis.fetch = fetchWith();
  for (const k of Object.keys(env)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  assert.equal(r.code, 200, JSON.stringify(r.body)); assert.equal(r.body.sent, 1); assert.equal(PUSH.sent.length, 1);
  assert.ok(BLOB.blobs.some((b) => b.pathname.startsWith('push/aaaaaaaaaaaaaaaaaaaaaaaa/')), 'the unreadable record is left alone, never deleted');
  resetBlob();
});

test('MCP: an explicit perms.mcp false revokes the connector even when the older record flag says mcp', async () => {
  const L = require('../api/mcp.js').lib, env = { CTRADER_LINK_KEY: 'link-secret' };
  L.GRANT.users = { ana: { mcp: true, perms: { mcp: false } }, bo: { mcp: true }, cy: { perms: { mcp: true } } }; L.GRANT.at = Date.now();
  assert.equal(await L.granted('ana', 'h', env), false, 'perms win, as on the page (msPerms)');
  assert.equal(await L.granted('bo', 'h', env), true); assert.equal(await L.granted('cy', 'h', env), true);
  L.GRANT.users = null; L.GRANT.at = 0;
});

test('/cdata answers GET and HEAD only (a POST never reaches GitHub or the bridge ping)', async () => {
  const data = require('../api/data.js'); let calls = 0; const f = async () => { calls++; return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(2) }; };
  for (const m of ['POST', 'PUT', 'DELETE']) { const r = res(); await data.handle({ method: m, headers: {}, query: { p: 'mt5/signals.csv' } }, r, { env: {}, fetch: f }); assert.equal(r.code, 405, m); }
  assert.equal(calls, 0);
  const r = res(); await data.handle({ method: 'GET', headers: {}, query: { p: 'trades.json' } }, r, { env: {}, fetch: f }); assert.equal(r.code, 200);
  const h = res(); await data.handle({ headers: {}, query: { p: 'trades.json' } }, h, { env: {}, fetch: f }); assert.equal(h.code, 200, 'no method given (old callers) still reads');
});

test('sounds: a failed read is never cached as a public answer', async () => {
  const sounds = require('../api/sounds.js'), r = res();
  await sounds.handle({ method: 'GET', headers: {} }, r, { env: {}, store: { get: async () => { throw new Error('blob 500'); } } });
  assert.equal(r.code, 500); assert.equal(r.headers['cache-control'], 'no-store');
});

test('profile: a JSON body that is not an object is a 400 and saves nothing', async () => {
  const profile = require('../api/profile.js'); let puts = 0; const store = { get: async () => ({ photo: 'keep' }), put: async () => { puts++; } };
  const tok = S.issue(ENV, 'fred', builtIns.fred.hash, { name: 'Fred', role: 'reviewer' });
  for (const body of ['5', '"x"', 'true', '[1]']) {
    const r = res(); await profile.handle({ method: 'POST', headers: { host: 'x.test', cookie: `ms_session=${tok}` }, body }, r, { env: ENV, store, deps: { builtIns, blobUsers: listOf({}) } });
    assert.equal(r.code, 400, body);
  }
  assert.equal(puts, 0);
});
