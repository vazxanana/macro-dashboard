// node --test tests/security-review.test.js — security review of the cTrader link, users, data and the demo mirror (7 Nov 2026).
// Each test pins one fixed issue; fake stores, fake cTrader, no network, no real secrets.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { handle, _t } = require('../api/ctrader-link.js');

const ENV = { CTRADER_CLIENT_ID: 'cid-fake', CTRADER_CLIENT_SECRET: 'csecret-fake', CTRADER_LINK_KEY: 'link-key-fake-0123456789', BLOB_READ_WRITE_TOKEN: 'blob-fake' };
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const OWNER_HASH = '49c5624f2625ed8b42b6e1bf2819a3a41ddb9743aeca36ea34ea7eb96c252ca8';
const PAGE = "window.MS_USERS = { fred: { name: 'Fred', hash: '" + sha('fred-pw') + "', role: 'reviewer', ict: true },\n  luxus: { name: 'Luxus', hash: '" + sha('lx-pw') + "', role: 'viewer' } };";

function memStore() { const m = new Map(); return { m, get: async (u) => m.get(u) || null, set: async (u, r) => { m.set(u, JSON.parse(JSON.stringify(r))); }, del: async (u) => { m.delete(u); } }; }
function res() { const r = { code: 0, body: null, headers: {}, loc: null };
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; };
  r.send = (b) => { r.body = b; return r; }; r.redirect = (c, l) => { r.code = c; r.loc = l; return r; }; return r; }
const post = (body, opts) => { const r = res(); return handle({ method: 'POST', headers: { host: 'x.test' }, body }, r, opts).then(() => r); };
const get = (headers, query, opts) => { const r = res(); return handle({ method: 'GET', headers: { host: 'x.test', ...headers }, query }, r, opts).then(() => r); };
const users = (u) => ({ users: u });
const maria = (pw = 'maria-pw', extra = {}) => ({ maria: { name: 'Maria', hash: sha(pw), role: 'viewer', ...extra } });

// a cTrader that answers the account list with an error whose text echoes the access token it was given
function echoingCtrader() {
  class WS { constructor(url) { this.url = url; setTimeout(() => this.onopen(), 0); }
    send(text) { const m = JSON.parse(text);
      setTimeout(() => this.onmessage({ data: JSON.stringify({ clientMsgId: m.clientMsgId, payloadType: 2142, payload: { errorCode: 'CH_ACCESS_TOKEN_INVALID', description: `token ${m.payload.accessToken} is not valid` } }) }), 0); }
    close() {} }
  return WS;
}

test('a session ends when its user is removed, re-created under the same key, or changes password', async () => {
  let list = users(maria());
  const WS = class { constructor() { throw new Error('no network in tests'); } };
  const store = memStore(), opts = { env: ENV, WS, deps: { store, blobUsers: async () => list, pageHtml: '' } };
  const s = await post({ action: 'session', user: 'maria', pw: 'maria-pw' }, opts); assert.equal(s.code, 200);
  const before = await post({ action: 'summary', session: s.body.session }, opts);
  assert.equal(before.code, 200); assert.equal(before.body.linked, false);                  // a valid session works
  await store.set('maria', { accessToken: 'AT-maria' });
  list = users(maria('maria-pw', { disabled: true }));                                      // removed on the Users page
  assert.equal((await post({ action: 'summary', session: s.body.session }, opts)).code, 401);
  assert.equal((await post({ action: 'unlink', session: s.body.session }, opts)).code, 401);
  assert.equal(store.m.has('maria'), true);
  list = users(maria('new-person-pw'));                                                       // key re-used for someone else / new password
  assert.equal((await post({ action: 'summary', session: s.body.session }, opts)).code, 401);
  assert.equal((await post({ action: 'start', session: s.body.session }, opts)).code, 401);
});

test('the link cookie is refused at the callback once its user is gone', async () => {
  let list = users(maria());
  const store = memStore(), fetchFn = async () => ({ ok: true, json: async () => ({ accessToken: 'AT-1', refreshToken: 'RT-1', expiresIn: 2592000 }) });
  const opts = { env: ENV, deps: { store, blobUsers: async () => list, fetch: fetchFn, pageHtml: '' } };
  const s = await post({ action: 'session', user: 'maria', pw: 'maria-pw' }, opts);
  const st = await post({ action: 'start', session: s.body.session }, opts), cookie = st.headers['set-cookie'].split(';')[0];
  list = users(maria('maria-pw', { disabled: true }));
  const cb = await get({ cookie }, { code: 'abc' }, opts);
  assert.match(cb.loc, /ct=expired/); assert.equal(store.m.size, 0);
});

test('a user keyed "owner" can never reach the owner\'s link', async () => {
  const deps = { blobUsers: async () => users({ owner: { name: 'Owner', hash: sha('imposter-pw'), role: 'viewer' } }), pageHtml: PAGE };
  assert.equal(await _t.identify(deps, 'owner', 'imposter-pw'), null);
  const r = await post({ action: 'session', user: 'owner', pw: 'imposter-pw' }, { env: ENV, deps: { ...deps, store: memStore() } });
  assert.equal(r.code, 403);
  const { _t: U } = require('../api/users.js');
  assert.equal(U.clean({ owner: { name: 'Owner', hash: sha('x'), role: 'viewer' } }), null);
  assert.ok(U.clean(maria()));
});

test('the user list fails closed: a disabled built-in user is not let back in when the Blob read fails', async () => {
  const off = users({ fred: { name: 'Fred', hash: sha('fred-pw'), role: 'reviewer', disabled: true } });
  assert.equal(await _t.identify({ blobUsers: async () => off, pageHtml: PAGE }, 'fred', 'fred-pw'), null);
  const broken = { blobUsers: async () => { throw new Error('Blob 500'); }, pageHtml: PAGE };
  await assert.rejects(_t.identify(broken, 'fred', 'fred-pw'), /user list/);
  const r = await post({ action: 'session', user: 'fred', pw: 'fred-pw' }, { env: ENV, deps: { ...broken, store: memStore() } });
  assert.equal(r.code, 503);
  assert.equal((await _t.identify({ blobUsers: async () => null, pageHtml: PAGE }, 'fred', 'fred-pw')).u, 'fred');   // no list at all: built-ins only
  assert.equal((await _t.identify(broken, '', 'owner-not-needed')), null);
});

test('an empty Blob store falls back to council-data users.json, like /api/users', async () => {
  const seen = [];
  const fetchFn = async (url) => { seen.push(url); return { ok: true, status: 200, json: async () => users({ fred: { name: 'Fred', hash: sha('fred-pw'), role: 'reviewer', disabled: true } }) }; };
  const listFn = async () => ({ blobs: [] });
  const r = await _t.blobUsers(ENV, 'x.test', { list: listFn, fetch: fetchFn });
  assert.equal(r.users.fred.disabled, true); assert.deepEqual(seen, ['https://x.test/cdata/users.json']);
  const missing = await _t.blobUsers(ENV, 'x.test', { list: listFn, fetch: async () => ({ ok: false, status: 404 }) });
  assert.equal(missing, null);
  await assert.rejects(_t.blobUsers(ENV, 'x.test', { list: listFn, fetch: async () => ({ ok: false, status: 502 }) }), /users\.json 502/);
  await assert.rejects(_t.blobUsers(ENV, 'evil.test/x?', { list: listFn, fetch: fetchFn }), /host/);
});

test('cTrader tokens never come back in an error message', async () => {
  const store = memStore(); await store.set('maria', { accessToken: 'AT-leak-123456', refreshToken: 'RT-leak-123456', exp: Date.now() + 20 * 86400e3 });
  const opts = { env: ENV, WS: echoingCtrader(), deps: { store, blobUsers: async () => users(maria()), pageHtml: '' } };
  const s = await post({ action: 'session', user: 'maria', pw: 'maria-pw' }, opts);
  const errs = []; const ce = console.error; console.error = (m) => errs.push(String(m));
  try {
    const r = await post({ action: 'summary', session: s.body.session }, opts);
    assert.equal(r.code, 502); assert.match(r.body.error, /CH_ACCESS_TOKEN_INVALID/);
    assert.doesNotMatch(r.body.error, /AT-leak/); assert.doesNotMatch(errs.join('\n'), /AT-leak|RT-leak/);
  } finally { console.error = ce; }
});

test('hash checks use a constant-time compare', () => {
  assert.equal(_t.same(sha('a'), sha('a')), true);
  assert.equal(_t.same(sha('a'), sha('b')), false);
  assert.equal(_t.same(sha('a'), 'short'), false);
  assert.equal(_t.same(undefined, sha('a')), false);
});

test('/cdata never serves the sealed broker tokens', async () => {
  const data = require('../api/data.js');
  const realFetch = global.fetch; let called = 0; global.fetch = async () => { called++; return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) }; };
  try {
    for (const p of ['ctrader/tokens.json', 'ctrader//tokens.json', 'CTRADER/tokens.json', 'ctrader/tokens.json/']) {
      const r = res(); await data({ query: { p }, headers: {} }, r); assert.ok(r.code >= 400 && r.code < 500, p); }
    assert.equal(called, 0);
    const ok = res(); await data({ query: { p: 'ctrader/mirror.json' }, headers: {} }, ok); assert.equal(ok.code, 200);
  } finally { global.fetch = realFetch; }
});

test('signing out forgets the cTrader session kept in this browser', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'market-structure.html'), 'utf8');
  const fn = (html.match(/window\.msForgetCt = function \(\) \{[\s\S]*?\n\};/) || [])[0];
  assert.ok(fn, 'msForgetCt in the head script');
  const store = { 'ms-ct-sess-fred': 'tok', 'ms-ct-acc-fred': '77', 'ms-ct-sess-owner': 'tok2', 'ms-user': 'fred', other: '1' };
  const localStorage = { get length() { return Object.keys(store).length; }, key: (i) => Object.keys(store)[i], removeItem: (k) => { delete store[k]; } };
  const ctx = { window: {}, localStorage }; vm.runInNewContext(fn, ctx); ctx.window.msForgetCt();
  assert.deepEqual(Object.keys(store).sort(), ['ms-user', 'other']);
  // every sign-out path calls it
  const outs = html.match(/localStorage\.removeItem\('ms-user-rec'\)/g).length, calls = html.match(/window\.msForgetCt\(\)/g) || [];
  assert.ok(calls.length >= outs, `${calls.length} msForgetCt calls for ${outs} sign-out paths`);
});
