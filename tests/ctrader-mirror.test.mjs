// Offline tests for council/ctrader-mirror.mjs: a fake cTrader server keeps positions; no network, no real secrets.
//   node --test tests/ctrader-mirror.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mirrorRound, PT, ALLOWED, session, volumeFor, relative, seal, unseal, LIMITS, ictCandidates, orderStep, commentFor, mirrorAlertText, sendMirrorAlerts, riskVolume, quoteRate, specFor } from '../council/ctrader-mirror.mjs';

const ENV = { CTRADER_CLIENT_ID: 'fake-client-id', CTRADER_CLIENT_SECRET: 'fake-client-secret', CTRADER_ACCESS_TOKEN: 'fake-access-old',
  CTRADER_REFRESH_TOKEN: 'fake-refresh-old', CTRADER_ACCOUNT_ID: '4242', CTRADER_ENV: 'demo', CTRADER_MIRROR: 'on' };
const SYMS = [{ symbolId: 1, symbolName: 'EURUSD' }, { symbolId: 41, symbolName: 'XAUUSD' }, { symbolId: 7, symbolName: 'NAS100' }];
const INFO = { 7: { symbolId: 7, digits: 2, lotSize: 100, minVolume: 1, stepVolume: 1 }, 1: { symbolId: 1, digits: 5, lotSize: 10000000, minVolume: 100000, stepVolume: 100000 }, 41: { symbolId: 41, digits: 2, lotSize: 10000, minVolume: 100, stepVolume: 100 } };

// Like the real server, a market order / close gets ORDER_ACCEPTED (2) and then ORDER_FILLED (3), both with the request's clientMsgId,
// enums as numbers. Options: reject (ORDER_ERROR_EVENT code), execReject (ORDER_REJECTED inside an execution event), fill: 'accepted-only'
// (no fill event: the position opens/closes later) or 'silent' (order placed, no answer at all), info (symbol overrides).
function broker({ isLive = false, balance = 1000000, expireFirst = false, reject = null, execReject = false, fill = 'normal', closeFill = 'normal', info = {}, names = SYMS } = {}) {
  const sent = [], positions = new Map(); let pid = 900, expired = expireFirst;
  const o = { reject, fill, closeFill };
  class WS {
    constructor(url) { this.url = url; setTimeout(() => this.onopen && this.onopen(), 0); }
    send(text) {
      const m = JSON.parse(text); sent.push(m); if (m.payloadType === PT.HEARTBEAT) return;
      const r = (payloadType, payload, delay = 0) => setTimeout(() => this.onmessage({ data: JSON.stringify({ clientMsgId: m.clientMsgId, payloadType, payload }) }), delay);
      const p = m.payload;
      switch (m.payloadType) {
        case PT.APP_AUTH_REQ: return r(PT.APP_AUTH_RES, {});
        case PT.ACCOUNTS_BY_TOKEN_REQ: if (expired && p.accessToken === 'fake-access-old') return r(PT.OA_ERROR_RES, { errorCode: 'CH_ACCESS_TOKEN_INVALID' });
          return r(PT.ACCOUNTS_BY_TOKEN_RES, { ctidTraderAccount: [{ ctidTraderAccountId: 4242, traderLogin: 77, isLive, brokerTitleShort: 'Demo' }] });
        case PT.REFRESH_TOKEN_REQ: expired = false; return r(PT.REFRESH_TOKEN_RES, { accessToken: 'fake-access-new', refreshToken: 'fake-refresh-new' });
        case PT.ACCOUNT_AUTH_REQ: return r(PT.ACCOUNT_AUTH_RES, {});
        case PT.TRADER_REQ: return r(PT.TRADER_RES, { trader: { balance, moneyDigits: 2 } });
        case PT.RECONCILE_REQ: return r(PT.RECONCILE_RES, { position: [...positions.values()] });
        case PT.SYMBOLS_LIST_REQ: return r(PT.SYMBOLS_LIST_RES, { symbol: names });
        case PT.SYMBOL_BY_ID_REQ: return r(PT.SYMBOL_BY_ID_RES, { symbol: p.symbolId.map((i) => ({ ...INFO[i], ...(info[i] || {}) })) });
        case PT.NEW_ORDER_REQ: {
          if (o.reject) return r(PT.ORDER_ERROR_EVENT, { errorCode: o.reject, description: 'no' });
          const id = ++pid, pos = { positionId: id, positionStatus: 1, tradeData: { symbolId: p.symbolId, volume: p.volume, tradeSide: p.tradeSide, label: p.label, comment: p.comment } };
          if (execReject) { r(PT.EXECUTION_EVENT, { executionType: 2, order: { orderId: 5 } }); return r(PT.EXECUTION_EVENT, { executionType: 7, errorCode: 'TRADING_BAD_VOLUME' }, 5); }
          positions.set(String(id), pos);
          if (o.fill === 'silent') return;
          r(PT.EXECUTION_EVENT, { executionType: 2, position: { positionId: id, positionStatus: 3 }, order: { orderId: 5, positionId: id } });
          if (o.fill === 'accepted-only') return;
          return r(PT.EXECUTION_EVENT, { executionType: 3, position: { ...pos }, order: { orderId: 5, positionId: id }, deal: { executionPrice: 1.10012 } }, 5);
        }
        case PT.CLOSE_POSITION_REQ: {
          r(PT.EXECUTION_EVENT, { executionType: 2, position: { positionId: p.positionId } });
          if (o.closeFill === 'accepted-only') return;
          positions.delete(String(p.positionId)); return r(PT.EXECUTION_EVENT, { executionType: 3, position: { positionId: p.positionId, positionStatus: 2 }, deal: { executionPrice: 1.10431, closePositionDetail: { grossProfit: 419, moneyDigits: 2 } } }, 5);
        }
        default: return r(PT.ERROR_RES, { errorCode: 'UNEXPECTED' });
      }
    }
    close() {}
  }
  return { WS, sent, positions, o, setBalance: (b) => { balance = b; } };
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
  const b = broker(); let r = await mirrorRound({ env: ENV, trades: [tr(), tr({ id: 'x2', market: 'xau', entry: 4000, stop: 3998, t1: 4006 })], state: started, WS: b.WS, now: NOW });
  assert.equal(b.positions.size, 2);
  const gold = b.sent.filter((m) => m.payloadType === PT.NEW_ORDER_REQ)[1].payload; assert.equal(gold.volume, 100); assert.equal(gold.relativeStopLoss, 200000);
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
  const b = broker({ reject: 'NOT_ENOUGH_MONEY' }); let r = await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b.WS, now: NOW });
  assert.match(r.state.skipped['eurusd-intraday-1'], /NOT_ENOUGH_MONEY/);
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

test('ICT desk: A-setups mirrored on the cash index (no fixed target), others never; closed when the desk closes', async () => {
  const ict = [{ id: 'nq-b-1', market: 'nq', side: 'buy', entry: 25000, stop: 24950, t1: null, status: 'open', opened: NOW - 120, aset: true, aplus: false },
    { id: 'es-s-2', market: 'es', side: 'sell', entry: 7400, stop: 7430, t1: null, status: 'open', opened: NOW - 120, aset: false }];
  const b = broker(); let r = await mirrorRound({ env: ENV, trades: ictCandidates(ict), state: started, WS: b.WS, now: NOW });
  const orders = b.sent.filter((m) => m.payloadType === PT.NEW_ORDER_REQ).map((m) => m.payload);
  assert.equal(orders.length, 1); assert.equal(orders[0].symbolId, 7); assert.equal(orders[0].relativeStopLoss, 5000000);
  assert.equal('relativeTakeProfit' in orders[0], false); assert.match(orders[0].comment, /^ict ict-A ict:nq-b-1/);
  assert.equal(r.state.map['ict:nq-b-1'].symbol, 'NAS100');
  r = await mirrorRound({ env: ENV, trades: ictCandidates([{ ...ict[0], status: 'win', R: 2.1 }]), state: r.state, WS: b.WS, now: NOW + 300 });
  assert.equal(b.positions.size, 0); assert.equal(r.state.map['ict:nq-b-1'].status, 'closed by council');
});

// ---- review fixes (8 Nov) -------------------------------------------------------------------------------------------------
const orders = (b) => b.sent.filter((m) => m.payloadType === PT.NEW_ORDER_REQ);

test('execution events: ACCEPTED waits for the fill; REJECTED/CANCELLED/EXPIRED inside an execution event is an error; names or numbers', () => {
  assert.equal(orderStep({ executionType: 2 }), 'wait'); assert.equal(orderStep({ executionType: 'ORDER_ACCEPTED' }), 'wait');
  assert.equal(orderStep({ executionType: 3 }), 'done'); assert.equal(orderStep({ executionType: 'ORDER_FILLED' }), 'done'); assert.equal(orderStep({ executionType: 11 }), 'done');
  for (const x of [5, 6, 7, 'ORDER_REJECTED']) assert.ok(orderStep({ executionType: x, errorCode: 'TRADING_BAD_STOPS' }) instanceof Error);
});

test('market order: waits past ORDER_ACCEPTED for ORDER_FILLED; a rejection after ACCEPTED is not recorded as a position', async () => {
  let b = broker(); let r = await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b.WS, now: NOW });
  const m = r.state.map['eurusd-intraday-1']; assert.equal(m.status, 'open'); assert.equal(m.positionId, '901');
  b = broker({ execReject: true }); r = await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b.WS, now: NOW });
  assert.equal(r.state.map['eurusd-intraday-1'], undefined); assert.match(r.state.skipped['eurusd-intraday-1'], /TRADING_BAD_VOLUME/); assert.deepEqual(r.sent, []);
});

test('ORDER_ACCEPTED but no fill seen: kept as "sent" (counts toward the cap), confirmed open by the next reconcile', async () => {
  const b = broker({ fill: 'accepted-only' }), six = () => Array.from({ length: 6 }, (_, i) => tr({ id: 's' + i }));
  let r = await mirrorRound({ env: ENV, trades: six(), state: started, WS: b.WS, now: NOW, timeout: 30 });
  const sent = Object.values(r.state.map); assert.equal(sent.length, LIMITS.maxOpen); assert.ok(sent.every((m) => m.status === 'sent' && m.positionId));
  assert.match(r.state.skipped.s5, /already open/);
  r = await mirrorRound({ env: ENV, trades: six(), state: r.state, WS: b.WS, now: NOW + 240 });
  assert.ok(Object.values(r.state.map).every((m) => m.status === 'open')); assert.equal(orders(b).length, LIMITS.maxOpen);
});

test('no answer at all (timeout): never resent; the position is found by label/comment next round, then closed with the trade', async () => {
  const b = broker({ fill: 'silent' });
  let r = await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b.WS, now: NOW, timeout: 30 });
  assert.match(r.state.skipped['eurusd-intraday-1'], /timeout/); assert.equal(b.positions.size, 1);
  b.o.fill = 'normal';
  r = await mirrorRound({ env: ENV, trades: [tr()], state: r.state, WS: b.WS, now: NOW + 240 });
  assert.equal(orders(b).length, 1); assert.equal(r.state.map['eurusd-intraday-1'].status, 'open'); assert.equal(r.state.skipped['eurusd-intraday-1'], undefined);
  r = await mirrorRound({ env: ENV, trades: [tr({ status: 'win' })], state: r.state, WS: b.WS, now: NOW + 480 });
  assert.equal(b.positions.size, 0); assert.equal(r.state.map['eurusd-intraday-1'].status, 'closed by council');
});

test('a round whose state was lost (job cancelled after the order): the position is adopted, not opened twice', async () => {
  const b = broker(); await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b.WS, now: NOW });
  b.positions.set('5', { positionId: 5, tradeData: { symbolId: 1, volume: 100000, label: 'manual', comment: commentFor(tr({ id: 'other' })) } });   // not ours: other label
  const r = await mirrorRound({ env: ENV, trades: [tr(), tr({ id: 'other' })], state: started, WS: b.WS, now: NOW + 60 });   // state without the map
  const m = r.state.map['eurusd-intraday-1']; assert.equal(m.status, 'open'); assert.equal(m.positionId, '901'); assert.equal(m.adopted, true);
  assert.equal(orders(b).filter((x) => x.payload.comment === commentFor(tr())).length, 1);
  assert.equal(r.state.map.other.positionId, '902');   // the manual position is never adopted: "other" got its own mirror order
});

test('market closed: retried next round while fresh, at most LIMITS.retries times; a symbol not tradable now waits too', async () => {
  const b = broker({ reject: 'MARKET_CLOSED' });
  let r = await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b.WS, now: NOW });
  assert.equal(r.state.wait['eurusd-intraday-1'].n, 1); assert.equal((r.state.skipped || {})['eurusd-intraday-1'], undefined);
  b.o.reject = null; r = await mirrorRound({ env: ENV, trades: [tr()], state: r.state, WS: b.WS, now: NOW + 240 });
  assert.equal(r.state.map['eurusd-intraday-1'].status, 'open'); assert.equal(r.state.wait['eurusd-intraday-1'], undefined);
  const b2 = broker({ reject: 'MARKET_CLOSED' }); r = { state: started };
  for (let i = 0; i < 5; i++) r = await mirrorRound({ env: ENV, trades: [tr({ opened: NOW + 100, filled: NOW + 100 })], state: r.state, WS: b2.WS, now: NOW + 100 + i * 60 });
  assert.equal(orders(b2).length, LIMITS.retries); assert.match(r.state.skipped['eurusd-intraday-1'], /3 tries/);
  const b3 = broker({ info: { 1: { tradingMode: 1 } } }); r = await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b3.WS, now: NOW });
  assert.equal(orders(b3).length, 0); assert.match(r.state.wait['eurusd-intraday-1'].why, /not tradable/);
});

test('sizing safety: no lot size -> no order (no forex-lot guess on an index); a minimum above the lot cap -> no order', async () => {
  assert.equal(volumeFor({ digits: 2 }), null); assert.equal(volumeFor({ lotSize: 100, minVolume: 50, stepVolume: 1 }), null);   // fixed-lot helper: minimum above 0.1 lot
  assert.equal(volumeFor({ lotSize: 100, minVolume: 1, stepVolume: 1 }), 1); assert.equal(volumeFor(INFO[41]), 100);
  const b = broker({ info: { 1: { lotSize: undefined } } }); const r = await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b.WS, now: NOW });
  assert.equal(orders(b).length, 0); assert.match(r.state.skipped['eurusd-intraday-1'], /no lot size/);
});

test('broker symbol names like "EUR/USD" match; disabled symbols are not used', async () => {
  let b = broker({ names: [{ symbolId: 1, symbolName: 'EUR/USD' }] }); await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b.WS, now: NOW });
  assert.equal(orders(b)[0].payload.symbolId, 1);
  b = broker({ names: [{ symbolId: 1, symbolName: 'EURUSD', enabled: false }] }); const r = await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b.WS, now: NOW });
  assert.equal(orders(b).length, 0); assert.match(r.state.skipped['eurusd-intraday-1'], /found at the broker/);
});

test('close accepted but fill not seen: stays open (closing); counted closed by council once the position is gone', async () => {
  const b = broker({ closeFill: 'accepted-only' }); let r = await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b.WS, now: NOW });
  r = await mirrorRound({ env: ENV, trades: [tr({ status: 'loss' })], state: r.state, WS: b.WS, now: NOW + 240, timeout: 30 });
  const m = r.state.map['eurusd-intraday-1']; assert.equal(m.status, 'open'); assert.ok(m.closing);
  b.positions.clear(); r = await mirrorRound({ env: ENV, trades: [tr({ status: 'loss' })], state: r.state, WS: b.WS, now: NOW + 480 });
  assert.equal(r.state.map['eurusd-intraday-1'].status, 'closed by council');
});

test('tokens: a refreshed pair is handed to onTokens at once; a newly configured pair replaces stored ones', async () => {
  let saved = null; const b = broker({ expireFirst: true });
  const r = await mirrorRound({ env: ENV, trades: [], state: started, WS: b.WS, now: NOW, onTokens: (t) => { saved = t; } });
  assert.deepEqual(saved, r.tokens); assert.equal(unseal(saved, ENV).accessToken, 'fake-access-new');
  // the owner re-authorises and sets a new pair: the stored (older) pair must not win over it
  const env2 = { ...ENV, CTRADER_ACCESS_TOKEN: 'fake-access-owner2', CTRADER_REFRESH_TOKEN: 'fake-refresh-owner2' }, b2 = broker();
  await mirrorRound({ env: env2, trades: [], state: started, tokens: seal(unseal(saved, ENV), env2), WS: b2.WS, now: NOW });
  assert.equal(b2.sent.find((m) => m.payloadType === PT.ACCOUNTS_BY_TOKEN_REQ).payload.accessToken, 'fake-access-owner2');
  const b3 = broker(); await mirrorRound({ env: ENV, trades: [], state: started, tokens: saved, WS: b3.WS, now: NOW });   // same configuration: rotated pair used
  assert.equal(b3.sent.find((m) => m.payloadType === PT.ACCOUNTS_BY_TOKEN_REQ).payload.accessToken, 'fake-access-new');
});

test('housekeeping: skip notes dropped once the trade can no longer be copied; finished positions dropped after keepDays', async () => {
  const b = broker({ reject: 'NOT_ENOUGH_MONEY' }); let r = await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b.WS, now: NOW });
  assert.ok(r.state.skipped['eurusd-intraday-1']);
  r.state.map.old = { status: 'closed at broker', closedAt: new Date((NOW - 40 * 86400) * 1000).toISOString(), positionId: '1' };
  r = await mirrorRound({ env: ENV, trades: [tr()], state: r.state, WS: b.WS, now: NOW + LIMITS.fresh + 60 });
  assert.equal(r.state.skipped['eurusd-intraday-1'], undefined); assert.equal(r.state.map.old, undefined); assert.equal(orders(b).length, 1);
});

test('daily stop: a day that started without a readable balance takes the first one it gets', async () => {
  const b = broker(); const st = { ...started, day: { date: new Date(NOW * 1000).toISOString().slice(0, 10), startBalance: null } };
  let r = await mirrorRound({ env: ENV, trades: [], state: st, WS: b.WS, now: NOW }); assert.equal(r.state.day.startBalance, 10000);
  b.setBalance(970000); r = await mirrorRound({ env: ENV, trades: [tr({ opened: NOW + 30, filled: NOW + 30 })], state: r.state, WS: b.WS, now: NOW + 60 });
  assert.equal(orders(b).length, 0); assert.match(r.state.skipped['eurusd-intraday-1'], /daily loss stop/);
});

// ---- phone alerts (mirror opens / closes / rejects) -----------------------------------------------------------------------
const kinds = (r) => r.alerts.map((a) => a.kind);
const again = (r) => JSON.parse(JSON.stringify(r.state));   // as saved in mirror.json and read back by the next run (restart)
function fakeFetch({ fail = null } = {}) {
  const calls = [];
  const fn = async (url, opt) => { calls.push({ url, body: JSON.parse(opt.body) }); if (fail === 'throw') throw new Error(`network down ${url}`); return { ok: fail !== 'http', status: fail === 'http' ? 500 : 200 }; };
  return { fn, calls };
}
const AENV = { ...ENV, NTFY_TOPIC: 'test-topic-xyz', TELEGRAM_BOT_TOKEN: 'tg-secret-token-123', TELEGRAM_CHAT_ID: '555' };

test('alerts: one open alert with symbol, side, lots and fill price; one close alert; a restart never re-alerts', async () => {
  const b = broker();
  let r = await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b.WS, now: NOW });
  assert.deepEqual(kinds(r), ['open']);
  const o = r.alerts[0]; assert.equal(o.symbol, 'EURUSD'); assert.equal(o.side, 'buy'); assert.equal(o.lots, 0.01); assert.equal(o.price, 1.10012); assert.equal(o.filled, true);
  const txt = mirrorAlertText(o, NOW);
  assert.equal(txt.title, 'Demo mirror: BUY EURUSD 0.01 lot'); assert.match(txt.msg, /^Opened at 1\.10012 · council entry 1\.10000 · stop 1\.09800 · target 1\.10500\nCouncil intraday · eurusd-intraday-1\n/);
  r = await mirrorRound({ env: ENV, trades: [tr()], state: again(r), WS: b.WS, now: NOW + 240 });   // restart: same position, no new alert
  assert.deepEqual(kinds(r), []);
  r = await mirrorRound({ env: ENV, trades: [tr({ status: 'win', R: 2.1 })], state: again(r), WS: b.WS, now: NOW + 480 });
  assert.deepEqual(kinds(r), ['close']); const c = mirrorAlertText(r.alerts[0], NOW + 480);
  assert.equal(c.title, 'Demo mirror: closed BUY EURUSD 0.01 lot'); assert.match(c.msg, /^Closed at 1\.10431 · gross P\/L \+4\.19\nThe council closed the trade: win \+2\.10R\n/); assert.match(c.tags, /white_check_mark/);
  r = await mirrorRound({ env: ENV, trades: [tr({ status: 'win', R: 2.1 })], state: again(r), WS: b.WS, now: NOW + 720 });
  assert.deepEqual(kinds(r), []);
});

test('alerts: a broker-side close alerts once; an accepted-only close alerts when the position is gone', async () => {
  let b = broker(); let r = await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b.WS, now: NOW });
  b.positions.clear(); r = await mirrorRound({ env: ENV, trades: [tr()], state: again(r), WS: b.WS, now: NOW + 240 });
  assert.deepEqual(kinds(r), ['close']); assert.equal(r.alerts[0].by, 'broker'); assert.match(mirrorAlertText(r.alerts[0], NOW).msg, /^Closed at the broker \(its stop or target\)\n/);
  b = broker({ closeFill: 'accepted-only' }); r = await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b.WS, now: NOW });
  r = await mirrorRound({ env: ENV, trades: [tr({ status: 'loss', R: -1 })], state: again(r), WS: b.WS, now: NOW + 240, timeout: 30 });
  assert.deepEqual(kinds(r), []);   // close accepted, not filled yet: no alert
  b.positions.clear(); r = await mirrorRound({ env: ENV, trades: [tr({ status: 'loss', R: -1 })], state: again(r), WS: b.WS, now: NOW + 480 });
  assert.deepEqual(kinds(r), ['close']); assert.equal(r.alerts[0].by, 'council'); assert.match(mirrorAlertText(r.alerts[0], NOW).tags, /,x$/);
});

test('alerts: a rejected order alerts once (with the reason); "not now" answers alert only when the retries run out', async () => {
  const b = broker({ reject: 'NOT_ENOUGH_MONEY' }); let r = await mirrorRound({ env: ENV, trades: [tr({ side: 'sell' })], state: started, WS: b.WS, now: NOW });
  assert.deepEqual(kinds(r), ['reject']); const t = mirrorAlertText(r.alerts[0], NOW);
  assert.equal(t.title, 'Demo mirror: order rejected · SELL EURUSD 0.01 lot'); assert.match(t.msg, /NOT_ENOUGH_MONEY/);
  r = await mirrorRound({ env: ENV, trades: [tr({ side: 'sell' })], state: again(r), WS: b.WS, now: NOW + 60 }); assert.deepEqual(kinds(r), []);
  const b2 = broker({ reject: 'MARKET_CLOSED' }); r = { state: started }; const seen = [];
  for (let i = 0; i < 4; i++) { r = await mirrorRound({ env: ENV, trades: [tr({ opened: NOW + 100, filled: NOW + 100 })], state: again(r), WS: b2.WS, now: NOW + 100 + i * 60 }); seen.push(...kinds(r)); }
  assert.deepEqual(seen, ['reject']);
});

test('alerts: a position found again after a lost round is managed but not re-alerted as opened', async () => {
  const b = broker(); await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b.WS, now: NOW });
  let r = await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b.WS, now: NOW + 60 });   // state without the map
  assert.equal(r.state.map['eurusd-intraday-1'].adopted, true); assert.deepEqual(kinds(r), []);
  r = await mirrorRound({ env: ENV, trades: [tr({ status: 'loss', R: -1 })], state: again(r), WS: b.WS, now: NOW + 240 });
  assert.deepEqual(kinds(r), ['close']);
});

// review (7 Nov): no answer to the order (timeout) is not a rejection: the order may have gone through, and it is found by
// label/comment next round. Before, the owner got "order rejected · Not retried" and then no open alert for the live position.
test('alerts: no broker answer is not alerted as a rejection; the position found next round gets its open alert, once', async () => {
  const b = broker({ fill: 'silent' });
  let r = await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b.WS, now: NOW, timeout: 30 });
  assert.match(r.state.skipped['eurusd-intraday-1'], /timeout/); assert.deepEqual(kinds(r), []);
  b.o.fill = 'normal';
  r = await mirrorRound({ env: ENV, trades: [tr()], state: again(r), WS: b.WS, now: NOW + 240 });
  assert.equal(r.state.map['eurusd-intraday-1'].status, 'open'); assert.deepEqual(kinds(r), ['open']);
  assert.match(mirrorAlertText(r.alerts[0], NOW).msg, /^Opened · council entry/);
  r = await mirrorRound({ env: ENV, trades: [tr()], state: again(r), WS: b.WS, now: NOW + 480 }); assert.deepEqual(kinds(r), []);
  assert.equal(orders(b).length, 1);
});
test('ICT desk position: the fill is recorded without a slippage against the futures entry', async () => {
  const b = broker(), ict = [{ id: 'nq-b-1', market: 'nq', side: 'buy', entry: 25000, stop: 24950, t1: null, status: 'open', opened: NOW - 120, aset: true }];
  const r = await mirrorRound({ env: ENV, trades: ictCandidates(ict), state: started, WS: b.WS, now: NOW });
  const m = r.state.map['ict:nq-b-1']; assert.equal(m.status, 'open'); assert.equal(m.fillPrice, 1.10012); assert.equal(m.lagSec, 120); assert.equal(m.slipR, undefined);
});

test('alerts: sent through ntfy + Telegram (fake fetch); failures are returned scrubbed, never thrown; off with COUNCIL_ALERTS=off', async () => {
  const b = broker(); const r = await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b.WS, now: NOW });
  let f = fakeFetch(); let a = await sendMirrorAlerts(r.alerts, { env: AENV, now: NOW, fetchFn: f.fn });
  assert.equal(a.sent, 1); assert.deepEqual(a.errors, {});
  const tg = f.calls.find((c) => c.url.includes('api.telegram.org')), nt = f.calls.find((c) => c.url === 'https://ntfy.sh/');
  assert.equal(tg.body.chat_id, '555'); assert.match(tg.body.text, /^Demo mirror: BUY EURUSD 0\.01 lot\nOpened at 1\.10012/);
  assert.equal(nt.body.topic, 'test-topic-xyz'); assert.equal(nt.body.title, 'Demo mirror: BUY EURUSD 0.01 lot'); assert.deepEqual(nt.body.tags, ['robot', 'chart_with_upwards_trend']);
  // the council's remembered chat is used when TELEGRAM_CHAT_ID is not set; the default topic without NTFY_TOPIC
  f = fakeFetch(); await sendMirrorAlerts(r.alerts, { env: { TELEGRAM_BOT_TOKEN: 'tg-secret-token-123' }, tgChat: '777', now: NOW, fetchFn: f.fn });
  assert.equal(f.calls.find((c) => c.url.includes('telegram')).body.chat_id, '777'); assert.ok(f.calls.find((c) => c.url === 'https://ntfy.sh/').body.topic);
  for (const fail of ['throw', 'http']) {
    f = fakeFetch({ fail }); a = await sendMirrorAlerts(r.alerts, { env: AENV, now: NOW, fetchFn: f.fn });
    assert.ok(a.errors.telegram && a.errors.ntfy); const txt = JSON.stringify(a.errors);
    for (const v of ['tg-secret-token-123', 'test-topic-xyz', 'fake-client-secret']) assert.equal(txt.includes(v), false);
  }
  a = await sendMirrorAlerts([{ kind: 'open', get symbol() { throw new Error('bad'); } }, null], { env: AENV, now: NOW, fetchFn: fakeFetch().fn });   // bad events never throw
  assert.equal(a.sent, 0);
  f = fakeFetch(); a = await sendMirrorAlerts(r.alerts, { env: { ...AENV, COUNCIL_ALERTS: 'off' }, now: NOW, fetchFn: f.fn }); assert.equal(f.calls.length, 0); assert.equal(a.sent, 0);
});

test('alerts never change the trading: same orders, alert flags kept in the saved state; message allowlist unchanged', async () => {
  const b = broker(); let r = await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b.WS, now: NOW });
  r = await mirrorRound({ env: ENV, trades: [tr({ status: 'win', R: 2 })], state: r.state, WS: b.WS, now: NOW + 240 });
  assert.deepEqual(types(b).filter((t) => t === PT.NEW_ORDER_REQ || t === PT.CLOSE_POSITION_REQ), [PT.NEW_ORDER_REQ, PT.CLOSE_POSITION_REQ]);
  assert.equal(r.state.map['eurusd-intraday-1'].status, 'closed by council'); assert.deepEqual(r.state.map['eurusd-intraday-1'].alerted, ['open', 'close']);
  assert.equal(ALLOWED.size, 11);
});

// ---- risk-based sizing (owner, 7 Nov: "risk-based lots, bigger demo") -----------------------------------------------------
test('risk sizing: ICT 0.20% x size, Meridian 0.02% per 1R; USD-base pairs converted; open-risk cap; below the minimum is skipped', () => {
  const fx = { lotSize: 10000000, minVolume: 100000, stepVolume: 100000 }, gold = { lotSize: 10000, minVolume: 100, stepVolume: 100 }, idx = { lotSize: 100, minVolume: 10, stepVolume: 10 };
  // $50k, Meridian EURUSD with a 200-pip stop: $10 risk / ($2,000 a lot) = 0.005 lot -> below 0.01 -> skipped, never rounded up
  assert.match(riskVolume({ info: fx, t: { id: 'm1', entry: 1.1, stop: 1.08 }, balance: 50000, name: 'EURUSD' }).skip, /below the broker minimum/);
  // $50k, Meridian EURUSD with a 20-pip stop: $10 / $200 = 0.05 lot
  assert.deepEqual(riskVolume({ info: fx, t: { id: 'm1', entry: 1.1, stop: 1.098 }, balance: 50000, name: 'EURUSD' }), { volume: 500000, riskCash: 10, lots: 0.05, perLot: 200 });
  // USDJPY 20-pip stop at 150: a lot moves 100,000 x 0.20 / 150 = $133.3; $50k Meridian $10 -> 0.0750 lot -> floor 0.07
  assert.equal(riskVolume({ info: fx, t: { id: 'm2', entry: 150, stop: 149.8 }, balance: 50000, name: 'USDJPY' }).lots, 0.07);
  // ICT gold A-setup (size 1), $20 stop: $100 / ($2,000 a lot) = 0.05 lot; an A+ half-size trade 0.02 (floored from 0.025)
  assert.equal(riskVolume({ info: gold, t: { id: 'ict:gc-1', entry: 4000, stop: 3980, size: 1 }, balance: 50000, name: 'XAUUSD' }).lots, 0.05);
  assert.equal(riskVolume({ info: gold, t: { id: 'ict:gc-2', entry: 4000, stop: 3980, size: 0.5 }, balance: 50000, name: 'XAUUSD' }).lots, 0.02);
  // ICT NQ on a $1-a-point CFD, 90-point stop: $100 / $90 = 1.11 lot -> 1.1
  assert.equal(riskVolume({ info: idx, t: { id: 'ict:nq-1', entry: 25000, stop: 24910 }, balance: 50000, name: 'US100' }).lots, 1.1);
  // open risk: $450 already at risk + a $100 ICT trade passes 1% of $50k? no (550 > 500)
  assert.match(riskVolume({ info: gold, t: { id: 'ict:gc-3', entry: 4000, stop: 3980 }, balance: 50000, name: 'XAUUSD', openRisk: 450 }).skip, /open risk/);
  // a cross pair with no USD side is not guessed
  assert.match(riskVolume({ info: fx, t: { id: 'm3', entry: 0.85, stop: 0.849 }, balance: 50000, name: 'EURGBP' }).skip, /quote currency/);
  // on the old $1,000 demo an ICT gold trade is skipped instead of risking 4%
  assert.match(riskVolume({ info: gold, t: { id: 'ict:gc-4', entry: 4000, stop: 3980 }, balance: 1000, name: 'XAUUSD' }).skip, /bigger demo balance/);
});

// ---- broker specs (ctrader/symbols.json, council/ctrader-symbols.mjs) ---------------------------------------------------------
test('risk sizing with the broker specs: the stop is valued in the account currency (an AUD account sizes gold smaller); no rate, no order', async () => {
  const gc = [{ id: 'gc-b-1', market: 'gc', side: 'buy', entry: 4000, stop: 3980, t1: null, status: 'open', opened: NOW - 120, aset: true, aplus: false, size: 1 }];
  const at = new Date((NOW - 600) * 1000).toISOString();
  // USD account, gold quoted in USD: $100 / ($2,000 a lot) = 0.05 lot, as before
  let b = broker({ balance: 5000000 }); await mirrorRound({ env: ENV, trades: ictCandidates(gc), state: started, WS: b.WS, now: NOW,
    specs: { account: { currency: 'USD' }, symbols: { XAUUSD: { base: 'XAU', quote: 'USD' } } } });
  assert.equal(orders(b)[0].payload.volume, 500);
  // AUD account (balance A$50,000, risk A$100), 1 USD = 1.5 AUD at the broker: a lot loses A$3,000 at the stop -> 0.0333 -> 0.03 lot
  b = broker({ balance: 5000000 }); let r = await mirrorRound({ env: ENV, trades: ictCandidates(gc), state: started, WS: b.WS, now: NOW,
    specs: { account: { currency: 'AUD' }, symbols: { XAUUSD: { base: 'XAU', quote: 'USD', quoteToDeposit: 1.5, rateAt: at } } } });
  assert.equal(orders(b)[0].payload.volume, 300); assert.equal(r.state.map['ict:gc-b-1'].riskCash, 100);
  // the same account with a stale (or missing) rate: skipped, never sized as if the account were in USD
  b = broker({ balance: 5000000 }); r = await mirrorRound({ env: ENV, trades: ictCandidates(gc), state: started, WS: b.WS, now: NOW,
    specs: { account: { currency: 'AUD' }, symbols: { XAUUSD: { base: 'XAU', quote: 'USD', quoteToDeposit: 1.5, rateAt: new Date((NOW - 4 * 86400) * 1000).toISOString() } } } });
  assert.equal(orders(b).length, 0); assert.match(r.state.skipped['ict:gc-b-1'], /cannot value its quote currency \(USD\) in the account currency \(AUD\)/);
});

test('quoteRate: quote = account currency 1, base = account currency 1/price, else the broker rate; old rule without specs', () => {
  const now = 1794000000, fresh = new Date((now - 60) * 1000).toISOString();
  assert.deepEqual(quoteRate({ name: 'US100', px: 25000, spec: { base: 'US100', quote: 'USD', deposit: 'USD' }, now }), { rate: 1, src: 'broker' });
  assert.equal(quoteRate({ name: 'USDCAD', px: 1.25, spec: { base: 'USD', quote: 'CAD', deposit: 'USD' }, now }).rate, 0.8);
  assert.equal(quoteRate({ name: 'EURGBP', px: 0.85, spec: { base: 'EUR', quote: 'GBP', deposit: 'USD', quoteToDeposit: 1.31, rateAt: fresh }, now }).rate, 1.31);
  assert.equal(quoteRate({ name: 'EURGBP', px: 0.85, spec: { base: 'EUR', quote: 'GBP', deposit: 'USD' }, now }), null);
  assert.equal(quoteRate({ name: 'US2000', px: 2400 }).rate, 1); assert.equal(quoteRate({ name: 'USDJPY', px: 150 }).rate, 1 / 150);
  assert.equal(quoteRate({ name: 'EURGBP', px: 0.85 }), null);
  assert.deepEqual(specFor({ account: { currency: 'USD' }, symbols: { XAUUSD: { quote: 'USD' } } }, 'XAUUSD'), { quote: 'USD', deposit: 'USD' });
  assert.equal(specFor({ symbols: { XAUUSD: { quote: 'USD' } } }, 'XAUUSD'), null); assert.equal(specFor(null, 'XAUUSD'), null);
});
