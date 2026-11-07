// Offline tests for council/ctrader-mirror.mjs: a fake cTrader server keeps positions; no network, no real secrets.
//   node --test tests/ctrader-mirror.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mirrorRound, PT, ALLOWED, session, volumeFor, relative, unseal, LIMITS } from '../council/ctrader-mirror.mjs';

const ENV = { CTRADER_CLIENT_ID: 'fake-client-id', CTRADER_CLIENT_SECRET: 'fake-client-secret', CTRADER_ACCESS_TOKEN: 'fake-access-old',
  CTRADER_REFRESH_TOKEN: 'fake-refresh-old', CTRADER_ACCOUNT_ID: '4242', CTRADER_ENV: 'demo', CTRADER_MIRROR: 'on' };
const SYMS = [{ symbolId: 1, symbolName: 'EURUSD' }, { symbolId: 41, symbolName: 'XAUUSD' }];
const INFO = { 1: { symbolId: 1, digits: 5, lotSize: 10000000, minVolume: 100000, stepVolume: 100000 }, 41: { symbolId: 41, digits: 2, lotSize: 10000, minVolume: 100, stepVolume: 100 } };

function broker({ isLive = false, balance = 100000, expireFirst = false, reject = false } = {}) {
  const sent = [], positions = new Map(); let pid = 900, expired = expireFirst;
  class WS {
    constructor(url) { this.url = url; setTimeout(() => this.onopen && this.onopen(), 0); }
    send(text) {
      const m = JSON.parse(text); sent.push(m); if (m.payloadType === PT.HEARTBEAT) return;
      const r = (payloadType, payload) => setTimeout(() => this.onmessage({ data: JSON.stringify({ clientMsgId: m.clientMsgId, payloadType, payload }) }), 0);
      const p = m.payload;
      switch (m.payloadType) {
        case PT.APP_AUTH_REQ: return r(PT.APP_AUTH_RES, {});
        case PT.ACCOUNTS_BY_TOKEN_REQ: if (expired && p.accessToken === 'fake-access-old') return r(PT.OA_ERROR_RES, { errorCode: 'CH_ACCESS_TOKEN_INVALID' });
          return r(PT.ACCOUNTS_BY_TOKEN_RES, { ctidTraderAccount: [{ ctidTraderAccountId: 4242, traderLogin: 77, isLive, brokerTitleShort: 'Demo' }] });
        case PT.REFRESH_TOKEN_REQ: expired = false; return r(PT.REFRESH_TOKEN_RES, { accessToken: 'fake-access-new', refreshToken: 'fake-refresh-new' });
        case PT.ACCOUNT_AUTH_REQ: return r(PT.ACCOUNT_AUTH_RES, {});
        case PT.TRADER_REQ: return r(PT.TRADER_RES, { trader: { balance, moneyDigits: 2 } });
        case PT.RECONCILE_REQ: return r(PT.RECONCILE_RES, { position: [...positions.values()] });
        case PT.SYMBOLS_LIST_REQ: return r(PT.SYMBOLS_LIST_RES, { symbol: SYMS });
        case PT.SYMBOL_BY_ID_REQ: return r(PT.SYMBOL_BY_ID_RES, { symbol: p.symbolId.map((i) => INFO[i]) });
        case PT.NEW_ORDER_REQ: if (reject) return r(PT.ORDER_ERROR_EVENT, { errorCode: 'MARKET_CLOSED', description: 'closed' });
          { const id = ++pid; positions.set(String(id), { positionId: id, tradeData: { symbolId: p.symbolId, volume: p.volume, tradeSide: p.tradeSide, label: p.label } });
            return r(PT.EXECUTION_EVENT, { executionType: 'ORDER_FILLED', position: { positionId: id } }); }
        case PT.CLOSE_POSITION_REQ: positions.delete(String(p.positionId)); return r(PT.EXECUTION_EVENT, { executionType: 'ORDER_FILLED' });
        default: return r(PT.ERROR_RES, { errorCode: 'UNEXPECTED' });
      }
    }
    close() {}
  }
  return { WS, sent, positions, setBalance: (b) => { balance = b; } };
}
const NOW = 1794000000;
const tr = (o = {}) => ({ id: 'eurusd-intraday-1', market: 'eurusd', k: 'intraday', side: 'buy', entry: 1.1, stop: 1.098, t1: 1.105, rr: 2.5, status: 'open', opened: NOW - 60, filled: NOW - 60, shadow: false, ...o });
const started = { startedAt: new Date((NOW - 3600) * 1000).toISOString() };
const types = (b) => b.sent.map((m) => m.payloadType);

test('only allowed message types: amend/cancel/modify are blocked before sending; non-demo host refused', async () => {
  for (const t of [2107, 2108, 2109, 2110]) assert.equal(ALLOWED.has(t), false);
  const b = broker(), s = session(b.WS, (x) => x);
  await assert.rejects(s.send(2110, {}), /not allowed/); s.close(); assert.equal(b.sent.length, 0);
  assert.throws(() => session(b.WS, (x) => x, 'wss://live.ctraderapi.com:5036'), /non-demo/);
});

test('off unless CTRADER_MIRROR=on; refuses a non-demo env; does nothing without secrets', async () => {
  for (const env of [{ ...ENV, CTRADER_MIRROR: '' }, { ...ENV, CTRADER_ENV: 'live' }, { ...ENV, CTRADER_ACCESS_TOKEN: '' }]) {
    const b = broker(); const r = await mirrorRound({ env, trades: [tr()], state: started, WS: b.WS, now: NOW });
    assert.equal(b.sent.length, 0); assert.equal(r.sent.length, 0);
  }
});

test('a live account is refused before account auth, nothing is sent', async () => {
  const b = broker({ isLive: true }); const r = await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b.WS, now: NOW });
  assert.match(r.state.status, /not a demo/); assert.equal(types(b).includes(PT.ACCOUNT_AUTH_REQ), false); assert.equal(types(b).includes(PT.NEW_ORDER_REQ), false);
});

test('opens a market order for a fresh live trade, with relative stop/target and 0.01 lot', async () => {
  const b = broker(); const r = await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b.WS, now: NOW });
  const o = b.sent.find((m) => m.payloadType === PT.NEW_ORDER_REQ).payload;
  assert.equal(o.orderType, 1); assert.equal(o.tradeSide, 1); assert.equal(o.volume, 100000); assert.equal(o.label, 'council');
  assert.equal(o.relativeStopLoss, 200); assert.equal(o.relativeTakeProfit, 500);
  assert.equal(r.state.map['eurusd-intraday-1'].status, 'open'); assert.equal(b.positions.size, 1);
});

test('never copies shadows, old trades, trades from before the mirror started, pending orders or unknown markets', async () => {
  const b = broker();
  const trades = [tr({ id: 'a', shadow: true }), tr({ id: 'b', opened: NOW - 3 * 3600, filled: NOW - 3 * 3600 }), tr({ id: 'c', opened: NOW - 20 * 60, filled: NOW - 20 * 60 }), tr({ id: 'd', market: 'btc' }), tr({ id: 'e', status: 'pending' })];
  const r = await mirrorRound({ env: ENV, trades, state: { startedAt: new Date((NOW - 600) * 1000).toISOString() }, WS: b.WS, now: NOW });
  assert.equal(types(b).includes(PT.NEW_ORDER_REQ), false); assert.deepEqual(r.sent, []);
});

test('closes the position when the council closes the trade; marks broker-side closes', async () => {
  const b = broker(); let r = await mirrorRound({ env: ENV, trades: [tr(), tr({ id: 'x2', market: 'xau', entry: 4000, stop: 3990, t1: 4030 })], state: started, WS: b.WS, now: NOW });
  assert.equal(b.positions.size, 2);
  const gold = b.sent.filter((m) => m.payloadType === PT.NEW_ORDER_REQ)[1].payload; assert.equal(gold.volume, 100); assert.equal(gold.relativeStopLoss, 1000000);
  [...b.positions.keys()].filter((k) => b.positions.get(k).tradeData.symbolId === 41).forEach((k) => b.positions.delete(k));   // gold stopped at the broker
  r = await mirrorRound({ env: ENV, trades: [tr({ status: 'loss' }), tr({ id: 'x2', market: 'xau', status: 'open' })], state: r.state, WS: b.WS, now: NOW + 300 });
  assert.equal(b.positions.size, 0); assert.equal(r.state.map['eurusd-intraday-1'].status, 'closed by council'); assert.equal(r.state.map.x2.status, 'closed at broker');
});

test('caps: at most 5 open, and no new order after a 2% daily loss', async () => {
  const b = broker(); const trades = Array.from({ length: 7 }, (_, i) => tr({ id: 't' + i }));
  let r = await mirrorRound({ env: ENV, trades, state: started, WS: b.WS, now: NOW });
  assert.equal(b.positions.size, LIMITS.maxOpen); assert.equal(Object.keys(r.state.skipped).length, 2);
  const b2 = broker({ balance: 100000 }); r = await mirrorRound({ env: ENV, trades: [], state: started, WS: b2.WS, now: NOW });
  b2.setBalance(97900); r = await mirrorRound({ env: ENV, trades: [tr({ id: 'late' })], state: r.state, WS: b2.WS, now: NOW + 60 });
  assert.equal(b2.positions.size, 0); assert.match(r.state.skipped.late, /daily loss stop/);
});

test('a rejected order is logged and not retried', async () => {
  const b = broker({ reject: true }); let r = await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b.WS, now: NOW });
  assert.match(r.state.skipped['eurusd-intraday-1'], /MARKET_CLOSED/);
  const n = b.sent.filter((m) => m.payloadType === PT.NEW_ORDER_REQ).length;
  r = await mirrorRound({ env: ENV, trades: [tr()], state: r.state, WS: b.WS, now: NOW + 60 });
  assert.equal(b.sent.filter((m) => m.payloadType === PT.NEW_ORDER_REQ).length, n);
});

test('expired token: refreshed and returned only encrypted; secrets never in state or log', async () => {
  const b = broker({ expireFirst: true }); const r = await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b.WS, now: NOW });
  assert.ok(r.tokens); assert.equal(JSON.stringify(r.tokens).includes('fake-access-new'), false); assert.equal(unseal(r.tokens, ENV).accessToken, 'fake-access-new');
  const txt = JSON.stringify({ s: r.state, l: r.log }); for (const v of Object.values(ENV)) if (v.length > 6) assert.equal(txt.includes(v), false);
});

test('sizing and relative distances', () => {
  assert.equal(volumeFor(INFO[1]), 100000); assert.equal(volumeFor({ lotSize: 10000000, minVolume: 1000000, stepVolume: 1000000 }), 1000000);
  assert.equal(relative(0.002, 5), 200); assert.equal(relative(10, 2), 1000000); assert.equal(relative(0.0000001, 5), 1);
});
