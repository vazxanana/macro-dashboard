// node --test tests/ctrader-link.test.js — per-user cTrader link (view only) against a fake cTrader and a fake store
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { handle, _t } = require('../api/ctrader-link.js');
const ENV = { CTRADER_CLIENT_ID: 'cid-fake', CTRADER_CLIENT_SECRET: 'csecret-fake', CTRADER_LINK_KEY: 'link-key-fake-0123456789', BLOB_READ_WRITE_TOKEN: 'blob-fake' };
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const OWNER_HASH = '49c5624f2625ed8b42b6e1bf2819a3a41ddb9743aeca36ea34ea7eb96c252ca8';   // the owner's hash, public in the page
const USERS = { users: { maria: { name: 'Maria', hash: sha('maria-pw'), role: 'viewer' }, gone: { name: 'Gone', hash: sha('gone-pw'), role: 'viewer', disabled: true } } };

function memStore() { const m = new Map(); return { m, get: async (u) => m.get(u) || null, set: async (u, r) => { m.set(u, JSON.parse(JSON.stringify(r))); }, del: async (u) => { m.delete(u); } }; }
function res() { const r = { code: 0, body: null, headers: {}, loc: null };
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; };
  r.redirect = (c, l) => { r.code = c; r.loc = l; return r; }; return r; }
const post = (body, opts) => { const r = res(); return handle({ method: 'POST', headers: { host: 'x.test' }, body }, r, opts).then(() => r); };

function fakeCtrader({ live = false } = {}) {
  const sent = [];
  class WS { constructor(url) { this.url = url; setTimeout(() => this.onopen(), 0); }
    send(text) { const m = JSON.parse(text); sent.push({ url: this.url, ...m }); const P = _t.PT, p = m.payload;
      const r = (t, pl) => setTimeout(() => this.onmessage({ data: JSON.stringify({ clientMsgId: m.clientMsgId, payloadType: t, payload: pl }) }), 0);
      switch (m.payloadType) {
        case P.ACCOUNTS_BY_TOKEN_REQ: return r(P.ACCOUNTS_BY_TOKEN_RES, { ctidTraderAccount: [{ ctidTraderAccountId: 77, traderLogin: 1001, isLive: live, brokerTitleShort: 'Fake FX' }] });
        case P.APP_AUTH_REQ: return r(P.APP_AUTH_RES, {});
        case P.ACCOUNT_AUTH_REQ: return r(P.ACCOUNT_AUTH_RES, {});
        case P.TRADER_REQ: return r(P.TRADER_RES, { trader: { balance: 123456, moneyDigits: 2, depositAssetId: 9, leverageInCents: 50000 } });
        case P.ASSET_LIST_REQ: return r(P.ASSET_LIST_RES, { asset: [{ assetId: 9, name: 'USD' }] });
        case P.SYMBOLS_LIST_REQ: return r(P.SYMBOLS_LIST_RES, { symbol: [{ symbolId: 1, symbolName: 'EURUSD' }, { symbolId: 41, symbolName: 'XAUUSD' }] });
        case P.RECONCILE_REQ: return r(P.RECONCILE_RES, { position: [{ positionId: 5, price: 1.1, stopLoss: 1.09, tradeData: { symbolId: 1, volume: 1000000, tradeSide: 1, openTimestamp: 1794000000000 }, swap: -12, commission: -30, moneyDigits: 2 }], order: [] });
        case P.DEAL_LIST_REQ: return r(P.DEAL_LIST_RES, p.toTimestamp === 1794600000000 ? { deal: [{ dealId: 9, positionId: 4, symbolId: 41, tradeSide: 2, filledVolume: 100, executionPrice: 2400, executionTimestamp: 1794500000000,
          closePositionDetail: { entryPrice: 2380, grossProfit: 2000, swap: 0, commission: -70, closedVolume: 100, moneyDigits: 2 } }] } : { deal: [] });
        case P.UNREALIZED_PNL_REQ: return r(P.UNREALIZED_PNL_RES, { positionUnrealizedPnL: [{ positionId: 5, grossUnrealizedPnL: 2500, netUnrealizedPnL: 2458 }], moneyDigits: 2 });
        case P.SYMBOL_BY_ID_REQ: return r(P.SYMBOL_BY_ID_RES, { symbol: p.symbolId.map((id) => ({ symbolId: id, lotSize: id === 1 ? 10000000 : 10000, digits: id === 1 ? 5 : 2 })) });
        default: return r(P.ERROR_RES, { errorCode: 'X' }); } }
    close() {} }
  return { WS, sent };
}

test('built-in users are read from the page; disabled Blob users are refused; the owner is recognised', async () => {
  const html = "window.MS_USERS = { fred: { name: 'Fred', hash: '" + sha('fred-pw') + "', role: 'reviewer', ict: true },\n  luxus: { name: 'Luxus', hash: '" + sha('lx') + "', role: 'viewer' } };";
  assert.deepEqual(Object.keys(_t.builtInUsers(html)), ['fred', 'luxus']);
  const deps = { blobUsers: async () => USERS };
  assert.equal((await _t.identify(deps, 'maria', 'maria-pw')).u, 'maria');
  assert.equal(await _t.identify(deps, 'maria', 'wrong'), null);
  assert.equal(await _t.identify(deps, 'gone', 'gone-pw'), null);
  assert.equal(await _t.identify(deps, 'maria', sha('maria-pw')), null);   // knowing the (public) hash is not enough
});

test('session -> start -> callback stores encrypted tokens for that user only', async () => {
  const store = memStore(), fetchFn = async (url) => { assert.match(url, /grant_type=authorization_code/); assert.match(url, /code=abc/); return { ok: true, json: async () => ({ accessToken: 'AT-1', refreshToken: 'RT-1', expiresIn: 2592000 }) }; };
  const opts = { env: ENV, deps: { store, blobUsers: async () => USERS, fetch: fetchFn } };
  const bad = await post({ action: 'session', user: 'maria', pw: 'nope' }, opts); assert.equal(bad.code, 403);
  const s = await post({ action: 'session', user: 'maria', pw: 'maria-pw' }, opts); assert.equal(s.code, 200);
  const st = await post({ action: 'start', session: s.body.session }, opts);
  assert.match(st.body.url, /^https:\/\/id\.ctrader\.com\/.*scope=accounts/); assert.doesNotMatch(st.body.url, /csecret/);
  const cookie = st.headers['set-cookie'].split(';')[0];
  const cb = res(); await handle({ method: 'GET', headers: { host: 'x.test', cookie }, query: { code: 'abc' } }, cb, opts);
  assert.equal(cb.code, 302); assert.match(cb.loc, /ct=linked/); assert.equal(store.m.get('maria').accessToken, 'AT-1'); assert.equal(store.m.size, 1);
  const nocookie = res(); await handle({ method: 'GET', headers: { host: 'x.test' }, query: { code: 'abc' } }, nocookie, opts); assert.match(nocookie.loc, /ct=expired/);
  const forged = await post({ action: 'summary', session: s.body.session.replace(/.$/, 'x') }, opts); assert.equal(forged.code, 401);
});

test('summary: balance, floating P&L, open trades in lots, closed history with net P&L; read messages only', async () => {
  const store = memStore(); await store.set('maria', { accessToken: 'AT-1', refreshToken: 'RT-1', exp: Date.now() + 20 * 86400e3 });
  const ct = fakeCtrader();
  const sess = _t.sign(ENV, { k: 'sess', u: 'maria', f: _t.fpOf(ENV, sha('maria-pw')), exp: 1794600000000 + 1e6 });
  const realNow = Date.now; Date.now = () => 1794600000000;
  try {
    const r = await post({ action: 'summary', session: sess }, { env: ENV, WS: ct.WS, deps: { store, blobUsers: async () => USERS } });
    assert.equal(r.code, 200, JSON.stringify(r.body));
    const b = r.body;
    assert.equal(b.balance, 1234.56); assert.equal(b.floating, 24.58); assert.equal(b.equity, 1259.14); assert.equal(b.account.currency, 'USD');
    assert.deepEqual([b.open[0].symbol, b.open[0].side, b.open[0].lots, b.open[0].pnl], ['EURUSD', 'buy', 0.1, 24.58]);
    assert.deepEqual([b.history[0].symbol, b.history[0].side, b.history[0].lots, b.history[0].net], ['XAUUSD', 'buy', 0.01, 19.3]);
    assert.ok(ct.sent.every((m) => _t.READ_ONLY.has(m.payloadType)));
    assert.ok(ct.sent.every((m) => m.url === _t.HOSTS.demo));
  } finally { Date.now = realNow; }
});

test('live accounts are read on the live host (view only); a session never sends a trading message', async () => {
  const store = memStore(); await store.set('owner', { accessToken: 'AT-2', exp: Date.now() + 20 * 86400e3 });
  const ct = fakeCtrader({ live: true });
  const r = await post({ action: 'summary', session: _t.sign(ENV, { k: 'sess', u: 'owner', f: _t.fpOf(ENV, OWNER_HASH), exp: Date.now() + 1e6 }) }, { env: ENV, WS: ct.WS, deps: { store, blobUsers: async () => USERS } });
  assert.equal(r.code, 200); assert.equal(r.body.account.live, true);
  assert.ok(ct.sent.some((m) => m.url === _t.HOSTS.live));
  const s = _t.session(ct.WS, _t.HOSTS.demo);
  for (const pt of [2106, 2108, 2110, 2111]) await assert.rejects(s.send(pt, {}), /not a read/);
  s.close();
  assert.throws(() => _t.session(ct.WS, 'wss://evil.example:5036'), /unknown cTrader host/);
});

test('not linked yet, unlink, missing setup, and secrets never echoed', async () => {
  const store = memStore(), sess = _t.sign(ENV, { k: 'sess', u: 'maria', f: _t.fpOf(ENV, sha('maria-pw')), exp: Date.now() + 1e6 });
  const r = await post({ action: 'summary', session: sess }, { env: ENV, deps: { store, blobUsers: async () => USERS } }); assert.deepEqual(r.body, { linked: false });
  await store.set('maria', { accessToken: 'x' }); await post({ action: 'unlink', session: sess }, { env: ENV, deps: { store, blobUsers: async () => USERS } }); assert.equal(store.m.size, 0);
  const off = await post({ action: 'session' }, { env: { ...ENV, CTRADER_LINK_KEY: '' } }); assert.equal(off.code, 503);
  const box = _t.seal(ENV, { accessToken: 'AT-secret' }); assert.doesNotMatch(JSON.stringify(box), /AT-secret/); assert.equal(_t.unseal(ENV, box).accessToken, 'AT-secret');
  const err = await post({ action: 'summary', session: sess }, { env: ENV, deps: { store: { get: async () => { throw new Error('boom csecret-fake'); } }, blobUsers: async () => USERS } });
  assert.equal(err.code, 502); assert.doesNotMatch(err.body.error, /csecret-fake/);
});
