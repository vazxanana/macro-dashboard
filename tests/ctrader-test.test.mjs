// node --test tests/ctrader-test.test.mjs — the one-off DEMO test order against a fake broker
import test from 'node:test';
import assert from 'node:assert/strict';
import { testRound } from '../council/ctrader-test.mjs';
import { PT } from '../council/ctrader-mirror.mjs';
const ENV = { CTRADER_CLIENT_ID: 'fake-client-id', CTRADER_CLIENT_SECRET: 'fake-client-secret', CTRADER_ACCESS_TOKEN: 'fake-access', CTRADER_REFRESH_TOKEN: 'fake-refresh', CTRADER_ACCOUNT_ID: '4242', CTRADER_ENV: 'demo', CTRADER_MIRROR: 'on' };
// execReject: symbolIds whose market order is ACCEPTED and then REJECTED inside an execution event; accepted: send ORDER_ACCEPTED
// (with the position, as the real demo server does) before ORDER_FILLED, for orders and closes
function broker({ isLive = false, closed = [], execReject = [], accepted = false } = {}) {
  const sent = [], pos = new Map(); let pid = 500;
  class WS { constructor() { setTimeout(() => this.onopen(), 0); }
    send(text) { const m = JSON.parse(text); sent.push(m); if (m.payloadType === PT.HEARTBEAT) return;
      const r = (t, p, d = 0) => setTimeout(() => this.onmessage({ data: JSON.stringify({ clientMsgId: m.clientMsgId, payloadType: t, payload: p }) }), d), p = m.payload;
      if (m.payloadType === PT.NEW_ORDER_REQ && execReject.includes(p.symbolId)) { r(PT.EXECUTION_EVENT, { executionType: 2, order: { orderId: 9 } }); return r(PT.EXECUTION_EVENT, { executionType: 7, errorCode: 'TRADING_BAD_VOLUME' }, 5); }
      if (accepted && m.payloadType === PT.NEW_ORDER_REQ && !closed.includes(p.symbolId)) { const id = ++pid; pos.set(String(id), { positionId: id, tradeData: { volume: p.volume } });
        r(PT.EXECUTION_EVENT, { executionType: 2, position: { positionId: id } }); return r(PT.EXECUTION_EVENT, { executionType: 3, position: { positionId: id }, deal: { executionPrice: 100000 } }, 5); }
      if (accepted && m.payloadType === PT.CLOSE_POSITION_REQ) { r(PT.EXECUTION_EVENT, { executionType: 2, position: { positionId: p.positionId } }); return setTimeout(() => { pos.delete(String(p.positionId)); r(PT.EXECUTION_EVENT, { executionType: 3 }); }, 5); }
      switch (m.payloadType) {
        case PT.APP_AUTH_REQ: return r(PT.APP_AUTH_RES, {});
        case PT.ACCOUNTS_BY_TOKEN_REQ: return r(PT.ACCOUNTS_BY_TOKEN_RES, { ctidTraderAccount: [{ ctidTraderAccountId: 4242, isLive }] });
        case PT.ACCOUNT_AUTH_REQ: return r(PT.ACCOUNT_AUTH_RES, {});
        case PT.SYMBOLS_LIST_REQ: return r(PT.SYMBOLS_LIST_RES, { symbol: [{ symbolId: 3, symbolName: 'BTCUSD' }, { symbolId: 1, symbolName: 'EURUSD' }] });
        case PT.SYMBOL_BY_ID_REQ: return r(PT.SYMBOL_BY_ID_RES, { symbol: [{ symbolId: p.symbolId[0], digits: p.symbolId[0] === 3 ? 2 : 5, lotSize: p.symbolId[0] === 3 ? 100 : 10000000, minVolume: 1, stepVolume: 1 }] });
        case PT.NEW_ORDER_REQ: if (closed.includes(p.symbolId)) return r(PT.ORDER_ERROR_EVENT, { errorCode: 'MARKET_CLOSED' });
          { const id = ++pid; pos.set(String(id), { positionId: id, tradeData: { volume: p.volume } }); return r(PT.EXECUTION_EVENT, { executionType: 'ORDER_FILLED', position: { positionId: id } }); }
        case PT.RECONCILE_REQ: return r(PT.RECONCILE_RES, { position: [...pos.values()] });
        case PT.CLOSE_POSITION_REQ: pos.delete(String(p.positionId)); return r(PT.EXECUTION_EVENT, { executionType: 'ORDER_FILLED' });
        default: return r(PT.ERROR_RES, { errorCode: 'X' }); } }
    close() {} }
  return { WS, sent, pos };
}
const N = 1794000000, price = async () => 100000;
test('opens one test position, holds, then closes it', async () => {
  const b = broker(); let req = { request: 't1', symbols: ['BTCUSD'], holdSec: 300 };
  req = await testRound({ env: ENV, req, WS: b.WS, now: N, price });
  const o = b.sent.find((m) => m.payloadType === PT.NEW_ORDER_REQ).payload;
  assert.equal(o.orderType, 1); assert.equal(o.label, 'council-test'); assert.equal(o.relativeStopLoss, 100000000); assert.equal(b.pos.size, 1);
  req = await testRound({ env: ENV, req, WS: b.WS, now: N + 60, price }); assert.equal(b.pos.size, 1); assert.ok(!req.done);
  req = await testRound({ env: ENV, req, WS: b.WS, now: N + 301, price }); assert.equal(b.pos.size, 0); assert.ok(req.done && req.closedAt);
  const again = await testRound({ env: ENV, req, WS: b.WS, now: N + 400, price }); assert.equal(again, req);   // done: nothing more
});
test('market closed: tries the next symbol; all closed: ends without a position', async () => {
  const b = broker({ closed: [3] }); let req = await testRound({ env: ENV, req: { request: 't2', symbols: ['BTCUSD', 'EURUSD'] }, WS: b.WS, now: N, price });
  assert.equal(req.symbol, 'EURUSD');
  const b2 = broker({ closed: [3, 1] }); req = await testRound({ env: ENV, req: { request: 't3', symbols: ['BTCUSD', 'EURUSD'] }, WS: b2.WS, now: N, price });
  assert.ok(req.done); assert.equal(b2.pos.size, 0); assert.match(req.log.at(-1).msg, /no symbol accepted/);
});
// review (7 Nov): the demo server answers an order with ORDER_ACCEPTED, then ORDER_FILLED or ORDER_REJECTED. A rejection after
// ACCEPTED was logged as "opened" (position ?) and ended the test without trying the next symbol.
test('an order ACCEPTED then REJECTED is a rejection: the next symbol is tried', async () => {
  const b = broker({ execReject: [3] }); const req = await testRound({ env: ENV, req: { request: 't6', symbols: ['BTCUSD', 'EURUSD'] }, WS: b.WS, now: N, price });
  assert.equal(req.symbol, 'EURUSD'); assert.equal(b.pos.size, 1); assert.ok(!req.done);
  assert.match(req.log.find((l) => /BTCUSD/.test(l.msg)).msg, /rejected: TRADING_BAD_VOLUME/);
});
test('ACCEPTED then FILLED (the real sequence): opens, holds, closes', async () => {
  const b = broker({ accepted: true }); let req = await testRound({ env: ENV, req: { request: 't7', symbols: ['BTCUSD'], holdSec: 300 }, WS: b.WS, now: N, price });
  assert.equal(req.positionId, '501'); assert.equal(b.pos.size, 1);
  req = await testRound({ env: ENV, req, WS: b.WS, now: N + 301, price }); assert.equal(b.pos.size, 0); assert.ok(req.done && req.closedAt);
});

test('refuses a live account and a mirror switched off', async () => {
  const b = broker({ isLive: true }); let req = await testRound({ env: ENV, req: { request: 't4' }, WS: b.WS, now: N, price });
  assert.ok(req.done); assert.equal(b.sent.some((m) => m.payloadType === PT.NEW_ORDER_REQ), false);
  const b2 = broker(); req = await testRound({ env: { ...ENV, CTRADER_MIRROR: '' }, req: { request: 't5' }, WS: b2.WS, now: N, price });
  assert.ok(req.done); assert.equal(b2.sent.length, 0);
});
