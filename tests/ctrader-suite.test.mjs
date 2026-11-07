// node --test tests/ctrader-suite.test.mjs — the DEMO trade test suite (latency, SL/TP amend, limit + cancel) against a fake broker
import test from 'node:test';
import assert from 'node:assert/strict';
import { suiteRound, suiteSession, PT2 } from '../council/ctrader-suite.mjs';
import { PT } from '../council/ctrader-mirror.mjs';
const ENV = { CTRADER_CLIENT_ID: 'fake-client-id', CTRADER_CLIENT_SECRET: 'fake-client-secret', CTRADER_ACCESS_TOKEN: 'fake-access', CTRADER_ACCOUNT_ID: '4242', CTRADER_ENV: 'demo', CTRADER_MIRROR: 'on' };
// failReconcile: reconcile answers with an error (a broker hiccup mid-suite); info: symbol field overrides
function broker({ isLive = false, closed = [], failReconcile = false, info = {} } = {}) {
  const sent = [], pos = new Map(), ord = new Map(); let id = 500;
  class WS { constructor() { setTimeout(() => this.onopen(), 0); }
    send(text) { const m = JSON.parse(text); sent.push(m);
      const r = (t, p, delay = 0) => setTimeout(() => this.onmessage({ data: JSON.stringify({ clientMsgId: m.clientMsgId, payloadType: t, payload: p }) }), delay), p = m.payload;
      if (failReconcile && m.payloadType === PT.RECONCILE_REQ) return r(PT.OA_ERROR_RES, { errorCode: 'CH_SERVER_NOT_REACHABLE', description: 'try later' });
      if (m.payloadType === PT.SYMBOL_BY_ID_REQ && info[p.symbolId[0]]) return r(PT.SYMBOL_BY_ID_RES, { symbol: [{ symbolId: p.symbolId[0], digits: 2, ...info[p.symbolId[0]] }] });
      switch (m.payloadType) {
        case PT.APP_AUTH_REQ: return r(PT.APP_AUTH_RES, {});
        case PT.ACCOUNTS_BY_TOKEN_REQ: return r(PT.ACCOUNTS_BY_TOKEN_RES, { ctidTraderAccount: [{ ctidTraderAccountId: 4242, isLive }] });
        case PT.ACCOUNT_AUTH_REQ: return r(PT.ACCOUNT_AUTH_RES, {});
        case PT.SYMBOLS_LIST_REQ: return r(PT.SYMBOLS_LIST_RES, { symbol: [{ symbolId: 3, symbolName: 'BTCUSD' }, { symbolId: 1, symbolName: 'EURUSD' }] });
        case PT.SYMBOL_BY_ID_REQ: return r(PT.SYMBOL_BY_ID_RES, { symbol: [{ symbolId: p.symbolId[0], digits: p.symbolId[0] === 3 ? 2 : 5, lotSize: p.symbolId[0] === 3 ? 100 : 10000000, minVolume: 1, stepVolume: 1 }] });
        case PT.NEW_ORDER_REQ: {
          if (closed.includes(p.symbolId)) return r(PT.ORDER_ERROR_EVENT, { errorCode: 'MARKET_CLOSED', description: 'market closed' });
          const oid = ++id;
          if (p.orderType === 2) { ord.set(String(oid), { orderId: oid, limitPrice: p.limitPrice }); return r(PT.EXECUTION_EVENT, { executionType: 'ORDER_ACCEPTED', order: { orderId: oid } }); }
          const pid = ++id, price = p.symbolId === 3 ? 100000 : 1.1; pos.set(String(pid), { positionId: pid, price, tradeData: { volume: p.volume } });
          r(PT.EXECUTION_EVENT, { executionType: 'ORDER_ACCEPTED', order: { orderId: oid } }, 1);
          return r(PT.EXECUTION_EVENT, { executionType: 'ORDER_FILLED', position: { positionId: pid }, deal: { executionPrice: price } }, 5);
        }
        case PT.RECONCILE_REQ: return r(PT.RECONCILE_RES, { position: [...pos.values()], order: [...ord.values()] });
        case PT2.AMEND_POSITION_SLTP_REQ: { const x = pos.get(String(p.positionId)); if (!x) return r(PT.OA_ERROR_RES, { errorCode: 'POSITION_NOT_FOUND' });
          x.stopLoss = p.stopLoss; x.takeProfit = p.takeProfit; return r(PT.EXECUTION_EVENT, { executionType: 'ORDER_REPLACED', position: x }); }
        case PT.CLOSE_POSITION_REQ: pos.delete(String(p.positionId)); return r(PT.EXECUTION_EVENT, { executionType: 'ORDER_FILLED' });
        case PT2.CANCEL_ORDER_REQ: ord.delete(String(p.orderId)); return r(PT.EXECUTION_EVENT, { executionType: 'ORDER_CANCELLED' });
        default: return r(PT.ERROR_RES, { errorCode: 'X' }); } }
    close() {} }
  return { WS, sent, pos, ord };
}
test('runs market fill, set + change SL/TP, close, limit and cancel; leaves nothing open', async () => {
  const b = broker(), req = await suiteRound({ env: ENV, req: { request: 's1', symbols: ['BTCUSD'] }, WS: b.WS });
  assert.equal(req.status, 'done'); assert.ok(req.done);
  const r = req.results[0]; assert.equal(r.result, 'ok');
  const steps = Object.fromEntries(r.steps.map((s) => [s.step, s]));
  assert.ok(steps['market buy'].filledMs >= steps['market buy'].acceptedMs); assert.equal(steps['market buy'].fillPrice, 100000);
  assert.deepEqual(steps['set SL/TP'].asked, { sl: 99000, tp: 102000 }); assert.equal(steps['set SL/TP'].match, true);
  assert.deepEqual(steps['change SL/TP'].broker, { sl: 98500, tp: 103000 }); assert.equal(steps['change SL/TP'].match, true);
  assert.equal(steps['limit buy'].limitPrice, 98000); assert.equal(steps['limit buy'].pendingAtBroker, true);
  assert.equal(steps['cancel limit'].goneAtBroker, true);
  assert.equal(b.pos.size, 0); assert.equal(b.ord.size, 0);
  assert.ok(b.sent.filter((m) => m.payloadType === PT.NEW_ORDER_REQ).every((m) => m.payload.label === 'council-test'));
  assert.match(req.summary[0], /BTCUSD: ok · fill \d+ ms/);
});
test('a closed market is recorded with its error and the next pair still runs', async () => {
  const b = broker({ closed: [1] }), req = await suiteRound({ env: ENV, req: { request: 's2', symbols: ['EURUSD', 'BTCUSD', 'DOGEUSD'] }, WS: b.WS });
  assert.match(req.results[0].result, /MARKET_CLOSED/); assert.equal(req.results[1].result, 'ok'); assert.equal(req.results[2].skipped, 'not offered by the broker');
  assert.match(req.summary[0], /MARKET_CLOSED/);
});
// review (7 Nov): an error after the market buy (here: reconcile fails) ended the whole suite with the test position still open
test('an error mid-symbol closes that symbol\'s test position and the next symbol still runs', async () => {
  const b = broker({ failReconcile: true }), req = await suiteRound({ env: ENV, req: { request: 's5', symbols: ['BTCUSD', 'EURUSD'] }, WS: b.WS });
  assert.ok(req.done); assert.equal(b.pos.size, 0, 'no test position left open');
  assert.match(req.results[0].result, /CH_SERVER_NOT_REACHABLE/); assert.equal(req.results[1].symbol, 'EURUSD');
  assert.equal(b.sent.filter((m) => m.payloadType === PT.CLOSE_POSITION_REQ).length, 2);
});
test('a symbol whose minimum volume is above 0.1 lot is skipped, never sent with no volume', async () => {
  const b = broker({ info: { 3: { lotSize: 100, minVolume: 50, stepVolume: 1 } } }), req = await suiteRound({ env: ENV, req: { request: 's6', symbols: ['BTCUSD'] }, WS: b.WS });
  assert.match(req.results[0].skipped, /minimum/); assert.equal(b.sent.some((m) => m.payloadType === PT.NEW_ORDER_REQ), false);
});

test('refuses a live account, a mirror switched off, and runs a request once', async () => {
  const b = broker({ isLive: true }); let req = await suiteRound({ env: ENV, req: { request: 's3' }, WS: b.WS });
  assert.ok(req.done); assert.match(req.status, /not a demo/); assert.equal(b.sent.some((m) => m.payloadType === PT.NEW_ORDER_REQ), false);
  const b2 = broker(); req = await suiteRound({ env: { ...ENV, CTRADER_MIRROR: 'off' }, req: { request: 's4' }, WS: b2.WS });
  assert.ok(req.done); assert.equal(b2.sent.length, 0);
  const again = await suiteRound({ env: ENV, req, WS: b2.WS }); assert.equal(again, req); assert.equal(b2.sent.length, 0);
});
test('session refuses a non-demo host and messages outside the allowlist', async () => {
  assert.throws(() => suiteSession(broker().WS, (x) => x, 'wss://live.ctraderapi.com:5036'), /non-demo/);
  const s = suiteSession(broker().WS, (x) => x); await assert.rejects(s.send(2107, {}), /not allowed/); s.close();
});
