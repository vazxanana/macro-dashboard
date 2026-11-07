// Offline tests for api/ctrader.js — a fake WebSocket stands in for the cTrader demo server; no network, no real secrets.
//   node --test tests/ctrader.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { check, seal, open, scrub, PT, READ_ONLY, DEMO_HOST, session } = require('../api/ctrader.js')._test;

const ENV = { CTRADER_CLIENT_ID: 'fake-client-id', CTRADER_CLIENT_SECRET: 'fake-client-secret', CTRADER_ACCESS_TOKEN: 'fake-access-old',
  CTRADER_REFRESH_TOKEN: 'fake-refresh-old', CTRADER_ACCOUNT_ID: '4242', CTRADER_ENV: 'demo' };

// Fake server: replies per payload type; records everything sent.
function fakeWS({ isLive = false, expireFirst = false } = {}) {
  const sent = [];
  let expired = expireFirst;
  class WS {
    constructor(url) { this.url = url; setTimeout(() => this.onopen && this.onopen(), 0); }
    send(text) {
      const m = JSON.parse(text); sent.push(m);
      if (m.payloadType === PT.HEARTBEAT) return;
      const reply = (payloadType, payload) => setTimeout(() => this.onmessage({ data: JSON.stringify({ clientMsgId: m.clientMsgId, payloadType, payload }) }), 0);
      switch (m.payloadType) {
        case PT.APP_AUTH_REQ: return reply(PT.APP_AUTH_RES, {});
        case PT.ACCOUNTS_BY_TOKEN_REQ:
          if (expired && m.payload.accessToken === 'fake-access-old') return reply(PT.OA_ERROR_RES, { errorCode: 'CH_ACCESS_TOKEN_INVALID', description: 'token fake-access-old expired' });
          return reply(PT.ACCOUNTS_BY_TOKEN_RES, { ctidTraderAccount: [{ ctidTraderAccountId: 4242, isLive, traderLogin: 99, brokerTitleShort: 'DemoBroker' }] });
        case PT.REFRESH_TOKEN_REQ: expired = false; return reply(PT.REFRESH_TOKEN_RES, { accessToken: 'fake-access-new', refreshToken: 'fake-refresh-new', expiresIn: 2628000 });
        case PT.ACCOUNT_AUTH_REQ: return reply(PT.ACCOUNT_AUTH_RES, {});
        case PT.TRADER_REQ: return reply(PT.TRADER_RES, { trader: { balance: 1000000, moneyDigits: 2, depositAssetId: 15 } });
        case PT.RECONCILE_REQ: return reply(PT.RECONCILE_RES, { position: [{}], order: [] });
        default: return reply(PT.ERROR_RES, { errorCode: 'UNEXPECTED' });
      }
    }
    close() {}
  }
  return { WS, sent };
}
const memStore = () => { const saved = []; return { saved, async latest() { return saved.length ? { text: saved[saved.length - 1], all: [] } : null; }, async save(t) { saved.push(t); } }; };

test('only read-only message types are allowed; order types are blocked before sending', async () => {
  for (const t of [2106 /* NEW_ORDER */, 2108 /* CANCEL_ORDER */, 2109 /* AMEND_ORDER */, 2110 /* AMEND_POSITION_SLTP */, 2111 /* CLOSE_POSITION */]) {
    assert.equal(READ_ONLY.has(t), false);
    const { WS, sent } = fakeWS(); const s = session(WS);
    await assert.rejects(s.send(t, {}), /not read-only/); s.close();
    assert.equal(sent.length, 0);
  }
});

test('refuses any host other than the demo endpoint', () => {
  assert.throws(() => session(fakeWS().WS, 'wss://live.ctraderapi.com:5036'), /non-demo/);
  assert.match(DEMO_HOST, /^wss:\/\/demo\./);
});

test('missing variables -> 503 with names only', async () => {
  const r = await check({ ...ENV, CTRADER_ACCESS_TOKEN: '' }, { WS: fakeWS().WS });
  assert.equal(r.status, 503); assert.deepEqual(r.missing, ['CTRADER_ACCESS_TOKEN']);
});

test('CTRADER_ENV other than demo is refused before connecting', async () => {
  const { WS, sent } = fakeWS();
  const r = await check({ ...ENV, CTRADER_ENV: 'live' }, { WS });
  assert.equal(r.status, 403); assert.equal(sent.length, 0);
});

test('a live account stops before account auth', async () => {
  const { WS, sent } = fakeWS({ isLive: true });
  const r = await check(ENV, { WS });
  assert.equal(r.status, 403);
  assert.equal(sent.some((m) => m.payloadType === PT.ACCOUNT_AUTH_REQ), false);
});

test('demo account: read-only summary, no secrets in the result', async () => {
  const { WS, sent } = fakeWS();
  const r = await check(ENV, { WS, store: memStore() });
  assert.equal(r.ok, true); assert.equal(r.account.isLive, false); assert.equal(r.account.balance, 10000);
  assert.equal(r.positions, 1); assert.equal(r.orders, 0); assert.deepEqual(r.token, { source: 'env', refreshed: false });
  for (const m of sent) assert.ok(READ_ONLY.has(m.payloadType));
  const txt = JSON.stringify(r); for (const v of Object.values(ENV)) if (v.length > 6) assert.equal(txt.includes(v), false);
});

test('expired token: refreshed, stored only encrypted, reused next time', async () => {
  const store = memStore();
  const a = fakeWS({ expireFirst: true });
  const r = await check(ENV, { WS: a.WS, store });
  assert.equal(r.ok, true); assert.deepEqual(r.token, { source: 'rotated', refreshed: true });
  assert.equal(store.saved.length, 1);
  assert.equal(store.saved[0].includes('fake-access-new'), false); assert.equal(store.saved[0].includes('fake-refresh-new'), false);
  assert.equal(open(store.saved[0], ENV).accessToken, 'fake-access-new');
  const b = fakeWS();
  const r2 = await check(ENV, { WS: b.WS, store });
  assert.equal(r2.token.source, 'rotated');
  assert.equal(b.sent.find((m) => m.payloadType === PT.ACCOUNTS_BY_TOKEN_REQ).payload.accessToken, 'fake-access-new');
});

test('CTRADER_ACCOUNT_ID may be the login number; the demo check still applies', async () => {
  const { WS, sent } = fakeWS();
  const r = await check({ ...ENV, CTRADER_ACCOUNT_ID: '99' }, { WS });
  assert.equal(r.ok, true); assert.equal(r.account.id, 4242); assert.equal(r.account.matchedBy, 'login');
  assert.equal(sent.find((m) => m.payloadType === PT.ACCOUNT_AUTH_REQ).payload.ctidTraderAccountId, 4242);
  const live = fakeWS({ isLive: true });
  const r2 = await check({ ...ENV, CTRADER_ACCOUNT_ID: '99' }, { WS: live.WS });
  assert.equal(r2.status, 403); assert.equal(live.sent.some((m) => m.payloadType === PT.ACCOUNT_AUTH_REQ), false);
});

test('unknown account: 404 with a masked list, no full numbers', async () => {
  const r = await check({ ...ENV, CTRADER_ACCOUNT_ID: '123456' }, { WS: fakeWS().WS });
  assert.equal(r.status, 404); assert.deepEqual(r.accounts, [{ accountId: '…242', login: '…99', demo: true, broker: 'DemoBroker' }]);
  assert.equal(JSON.stringify(r).includes('4242'), false);
});

test('expired token with no store fails loudly instead of losing the rotated pair', async () => {
  await assert.rejects(check(ENV, { WS: fakeWS({ expireFirst: true }).WS }), /no server-side store/);
});

test('seal is tamper-evident and keyed by the client secret', () => {
  const s = seal({ a: 1 }, ENV);
  assert.throws(() => open(s, { ...ENV, CTRADER_CLIENT_SECRET: 'other-secret' }));
});

test('scrub removes env secret values from error text', () => {
  const prev = process.env.CTRADER_CLIENT_SECRET; process.env.CTRADER_CLIENT_SECRET = 'fake-client-secret';
  try { assert.equal(scrub('bad secret fake-client-secret here'), 'bad secret [redacted] here'); }
  finally { if (prev === undefined) delete process.env.CTRADER_CLIENT_SECRET; else process.env.CTRADER_CLIENT_SECRET = prev; }
});
