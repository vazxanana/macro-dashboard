// Offline tests for council/ctrader-mirror.mjs: a fake cTrader server keeps positions; no network, no real secrets.
//   node --test tests/ctrader-mirror.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mirrorRound, PT, ALLOWED, session, volumeFor, relative, seal, unseal, LIMITS, ictCandidates, replicaCandidates, replicaHasOwnAccount, orderStep, commentFor, mirrorAlertText, sendMirrorAlerts, riskVolume, quoteRate, specFor, markOf, applyReset, validUntil, WAIT, pendingStep, cancelStep, bookOf, accountsFor, BOOKS } from '../council/ctrader-mirror.mjs';

const ENV = { CTRADER_CLIENT_ID: 'fake-client-id', CTRADER_CLIENT_SECRET: 'fake-client-secret', CTRADER_ACCESS_TOKEN: 'fake-access-old',
  CTRADER_REFRESH_TOKEN: 'fake-refresh-old', CTRADER_ACCOUNT_ID: '4242', CTRADER_ENV: 'demo', CTRADER_MIRROR: 'on' };
const SYMS = [{ symbolId: 1, symbolName: 'EURUSD' }, { symbolId: 41, symbolName: 'XAUUSD' }, { symbolId: 7, symbolName: 'NAS100' }];
const INFO = { 7: { symbolId: 7, digits: 2, lotSize: 100, minVolume: 1, stepVolume: 1 }, 1: { symbolId: 1, digits: 5, lotSize: 10000000, minVolume: 100000, stepVolume: 100000 }, 41: { symbolId: 41, digits: 2, lotSize: 10000, minVolume: 100, stepVolume: 100 } };

// Like the real server, a market order / close gets ORDER_ACCEPTED (2) and then ORDER_FILLED (3), both with the request's clientMsgId,
// enums as numbers. Options: reject (ORDER_ERROR_EVENT code), execReject (ORDER_REJECTED inside an execution event), fill: 'accepted-only'
// (no fill event: the position opens/closes later) or 'silent' (order placed, no answer at all), info (symbol overrides).
function broker({ isLive = false, balance = 1000000, expireFirst = false, reject = null, execReject = false, fill = 'normal', closeFill = 'normal', info = {}, names = SYMS } = {}) {
  const sent = [], positions = new Map(), orders = new Map(), amends = []; let pid = 900, expired = expireFirst;
  const o = { reject, fill, closeFill, rejectPending: null, cancelReject: false, amendReject: null, amendSilent: false, noSL: false, slLate: false, strictAmend: false, closes: 0 };
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
        case PT.RECONCILE_REQ: return r(PT.RECONCILE_RES, { position: [...positions.values()], order: [...orders.values()] });
        case PT.AMEND_POSITION_SLTP_REQ: {
          const ps = positions.get(String(p.positionId));
          if (o.amendSilent) return;
          if (!ps || o.amendReject) return r(PT.EXECUTION_EVENT, { executionType: 7, errorCode: o.amendReject || 'POSITION_NOT_FOUND' });
          if (o.strictAmend) { ps.stopLoss = p.stopLoss; ps.takeProfit = p.takeProfit; } else { if (p.stopLoss != null) ps.stopLoss = p.stopLoss; if (p.takeProfit != null) ps.takeProfit = p.takeProfit; } amends.push(p);   // strictAmend: a level left out is removed, as at cTrader
          return r(PT.EXECUTION_EVENT, { executionType: 4, position: { ...ps } });
        }
        case PT.CANCEL_ORDER_REQ: {
          const od = orders.get(String(p.orderId));
          if (!od || o.cancelReject) return r(PT.EXECUTION_EVENT, { executionType: 8, errorCode: 'ORDER_CANCEL_REJECTED', order: { orderId: p.orderId } });
          orders.delete(String(p.orderId)); return r(PT.EXECUTION_EVENT, { executionType: 5, order: { ...od, orderStatus: 3 } });
        }
        case PT.SYMBOLS_LIST_REQ: return r(PT.SYMBOLS_LIST_RES, { symbol: names });
        case PT.SYMBOL_BY_ID_REQ: return r(PT.SYMBOL_BY_ID_RES, { symbol: p.symbolId.map((i) => ({ ...INFO[i], ...(info[i] || {}) })) });
        case PT.NEW_ORDER_REQ: {
          if (p.orderType === 2) {   // LIMIT: rests until the test fills it (fillOrder) or the mirror cancels it
            if (o.rejectPending) return r(PT.ORDER_ERROR_EVENT, { errorCode: o.rejectPending, description: 'no' });
            const id = ++pid, od = { orderId: id, orderStatus: 1, orderType: 2, limitPrice: p.limitPrice, stopLoss: p.stopLoss, takeProfit: p.takeProfit, timeInForce: p.timeInForce, expirationTimestamp: p.expirationTimestamp,
              tradeData: { symbolId: p.symbolId, volume: p.volume, tradeSide: p.tradeSide, label: p.label, comment: p.comment } };
            orders.set(String(id), od); return r(PT.EXECUTION_EVENT, { executionType: 2, order: od });
          }
          if (o.reject) return r(PT.ORDER_ERROR_EVENT, { errorCode: o.reject, description: 'no' });
          const px = 1.10012, dg = (INFO[p.symbolId] || {}).digits ?? 5, rel = (v) => v / 100000;   // the relative levels become absolute ones at the fill, as at a real broker
          const id = ++pid, pos = { positionId: id, positionStatus: 1, price: px, tradeData: { symbolId: p.symbolId, volume: p.volume, tradeSide: p.tradeSide, label: p.label, comment: p.comment },
            ...(!o.noSL && p.relativeStopLoss != null ? { stopLoss: +(px + (p.tradeSide === 1 ? -1 : 1) * rel(p.relativeStopLoss)).toFixed(dg) } : {}),
            ...(p.relativeTakeProfit != null ? { takeProfit: +(px + (p.tradeSide === 1 ? 1 : -1) * rel(p.relativeTakeProfit)).toFixed(dg) } : {}) };
          if (execReject) { r(PT.EXECUTION_EVENT, { executionType: 2, order: { orderId: 5 } }); return r(PT.EXECUTION_EVENT, { executionType: 7, errorCode: 'TRADING_BAD_VOLUME' }, 5); }
          positions.set(String(id), pos);
          if (o.fill === 'silent') return;
          r(PT.EXECUTION_EVENT, { executionType: 2, position: { positionId: id, positionStatus: 3 }, order: { orderId: 5, positionId: id } });
          if (o.fill === 'accepted-only') return;
          return r(PT.EXECUTION_EVENT, { executionType: 3, position: o.slLate ? (({ stopLoss, takeProfit, ...x }) => x)(pos) : { ...pos }, order: { orderId: 5, positionId: id }, deal: { executionPrice: 1.10012 } }, 5);
        }
        case PT.CLOSE_POSITION_REQ: {
          o.closes++; r(PT.EXECUTION_EVENT, { executionType: 2, position: { positionId: p.positionId } });
          if (o.closeFill === 'accepted-only') return;
          positions.delete(String(p.positionId)); return r(PT.EXECUTION_EVENT, { executionType: 3, position: { positionId: p.positionId, positionStatus: 2 }, deal: { executionPrice: 1.10431, closePositionDetail: { grossProfit: 419, moneyDigits: 2 } } }, 5);
        }
        default: return r(PT.ERROR_RES, { errorCode: 'UNEXPECTED' });
      }
    }
    close() {}
  }
  const fillOrder = (orderId, price) => { const od = orders.get(String(orderId)); if (!od) throw new Error('no such order'); orders.delete(String(orderId));
    const id = ++pid; positions.set(String(id), { positionId: id, positionStatus: 1, price, tradeData: { ...od.tradeData }, ...(od.stopLoss != null ? { stopLoss: od.stopLoss } : {}), ...(od.takeProfit != null ? { takeProfit: od.takeProfit } : {}) }); return id; };
  return { WS, sent, positions, orders, amends, o, fillOrder, setBalance: (b) => { balance = b; } };
}
const NOW = 1794000000;
const tr = (o = {}) => ({ id: 'eurusd-intraday-1', market: 'eurusd', k: 'intraday', side: 'buy', entry: 1.1, stop: 1.098, t1: 1.105, rr: 2.5, status: 'open', opened: NOW - 60, filled: NOW - 60, shadow: false, ...o });
const started = { startedAt: new Date((NOW - 3600) * 1000).toISOString() };
const types = (b) => b.sent.map((m) => m.payloadType);

test('only allowed message types: amend/cancel/modify are blocked before sending; non-demo host refused', async () => {
  for (const t of [2107, 2109, 2112]) assert.equal(ALLOWED.has(t), false);   // amend order, close-all and the rest stay blocked
  assert.equal(ALLOWED.has(PT.CANCEL_ORDER_REQ), true);   // 8 Nov: the mirror cancels its own resting limit orders
  assert.equal(ALLOWED.has(PT.AMEND_POSITION_SLTP_REQ), true);   // 8 Nov (owner approved): and moves its own positions' stop / target with the council
  const b = broker(), s = session(b.WS, (x) => x);
  await assert.rejects(s.send(2109, {}), /not allowed/); s.close(); assert.equal(b.sent.length, 0);
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

test('with shadows off: never copies shadows, pending orders or unknown markets; old live trades are copied (8 Nov: everything the council has open)', async () => {
  const b = broker();
  const trades = [tr({ id: 'a', shadow: true }), tr({ id: 'b', opened: NOW - 3 * 3600, filled: NOW - 3 * 3600 }), tr({ id: 'c', opened: NOW - 20 * 60, filled: NOW - 20 * 60 }), tr({ id: 'd', market: 'btc' }), tr({ id: 'e', status: 'pending' })];
  const r = await mirrorRound({ env: ENV, trades, state: { startedAt: new Date((NOW - 600) * 1000).toISOString(), catchUpAt: 'done' }, WS: b.WS, now: NOW, shadows: false });
  assert.deepEqual(r.sent.map((x) => x.trade).sort(), ['b', 'c']); assert.equal(r.state.map.a, undefined); assert.equal(r.state.map.d, undefined); assert.equal(r.state.map.e, undefined);
});

test('8 Nov (owner: mirror everything): shadows are copied by default, marked shadow at the broker-side record, and the first round catches up every open trade once', async () => {
  const b = broker();
  // an old shadow trade (3 h, before the mirror started) and a fresh one: the catch-up round copies both
  const trades = [tr({ id: 'old-shadow', shadow: true, opened: NOW - 3 * 3600, filled: NOW - 3 * 3600 }), tr({ id: 'fresh-shadow', shadow: true })];
  let r = await mirrorRound({ env: ENV, trades, state: { startedAt: new Date((NOW - 600) * 1000).toISOString() }, WS: b.WS, now: NOW });
  assert.equal(b.positions.size, 2); assert.ok(r.state.catchUpAt); assert.equal(r.state.map['old-shadow'].shadow, true); assert.equal(r.state.map['old-shadow'].status, 'open');
  assert.ok(r.log.some((l) => /catch-up round: 2 open council trades/.test(l.msg)));
  // later rounds keep copying whatever is open and not yet copied, old or new (no freshness window any more)
  r = await mirrorRound({ env: ENV, trades: trades.concat([tr({ id: 'old2', shadow: true, opened: NOW - 3 * 3600, filled: NOW - 3 * 3600 }), tr({ id: 'new2', shadow: true, opened: NOW + 200, filled: NOW + 200 })]), state: r.state, WS: b.WS, now: NOW + 300 });
  assert.equal(b.positions.size, 4); assert.equal(r.state.map.old2.status, 'open'); assert.equal(r.state.map.new2.status, 'open');
  // the shadow trade closing at the council closes the demo position
  r = await mirrorRound({ env: ENV, trades: [tr({ id: 'old-shadow', shadow: true, status: 'loss' }), trades[1], tr({ id: 'new2', shadow: true }), tr({ id: 'old2', shadow: true })], state: r.state, WS: b.WS, now: NOW + 600 });
  assert.equal(r.state.map['old-shadow'].status, 'closed by council'); assert.equal(b.positions.size, 3);
  // crypto markets are in the symbol map now
  const { SYMBOLS } = await import('../council/ctrader-mirror.mjs'); assert.deepEqual(SYMBOLS.btc, ['BTCUSD']); assert.deepEqual(SYMBOLS.xrp, ['XRPUSD']);
});

test('closes the position when the council closes the trade; marks broker-side closes', async () => {
  const b = broker(); let r = await mirrorRound({ env: ENV, trades: [tr(), tr({ id: 'x2', market: 'xau', entry: 4000, stop: 3998, t1: 4006 })], state: started, WS: b.WS, now: NOW });
  assert.equal(b.positions.size, 2);
  const gold = b.sent.filter((m) => m.payloadType === PT.NEW_ORDER_REQ)[1].payload; assert.equal(gold.volume, 100); assert.equal(gold.relativeStopLoss, 200000);
  [...b.positions.keys()].filter((k) => b.positions.get(k).tradeData.symbolId === 41).forEach((k) => b.positions.delete(k));   // gold stopped at the broker
  r = await mirrorRound({ env: ENV, trades: [tr({ status: 'loss' }), tr({ id: 'x2', market: 'xau', status: 'open' })], state: r.state, WS: b.WS, now: NOW + 300 });
  assert.equal(b.positions.size, 0); assert.equal(r.state.map['eurusd-intraday-1'].status, 'closed by council'); assert.equal(r.state.map.x2.status, 'closed at broker');
});

test('caps: at most LIMITS.maxOpen open, and no new order after a 2% daily loss; both are waits (tried again), not skips', async () => {
  const b = broker(); const trades = Array.from({ length: LIMITS.maxOpen + 2 }, (_, i) => tr({ id: 't' + i }));
  let r = await mirrorRound({ env: ENV, trades, state: started, WS: b.WS, now: NOW });
  assert.equal(b.positions.size, LIMITS.maxOpen); assert.equal(Object.keys(r.state.skipped || {}).length, 0); assert.equal(Object.keys(r.state.wait).length, 2);
  assert.match(r.state.wait['t' + LIMITS.maxOpen].why, /already open/); assert.equal(r.state.wait['t' + LIMITS.maxOpen].n, 0);
  // one position closes at the council: a waiting trade takes its place next round
  r = await mirrorRound({ env: ENV, trades: trades.map((t) => (t.id === 't0' ? { ...t, status: 'win' } : t)), state: r.state, WS: b.WS, now: NOW + 240 });
  assert.equal(b.positions.size, LIMITS.maxOpen); assert.equal(Object.keys(r.state.wait).length, 1);
  const b2 = broker({ balance: 100000 }); r = await mirrorRound({ env: ENV, trades: [], state: started, WS: b2.WS, now: NOW });
  b2.setBalance(97900); r = await mirrorRound({ env: ENV, trades: [tr({ id: 'late' })], state: r.state, WS: b2.WS, now: NOW + 60 });
  assert.equal(b2.positions.size, 0); assert.match(r.state.wait.late.why, /daily loss stop/);
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
  const b = broker({ fill: 'accepted-only' }), six = () => Array.from({ length: LIMITS.maxOpen + 1 }, (_, i) => tr({ id: 's' + i }));
  let r = await mirrorRound({ env: ENV, trades: six(), state: started, WS: b.WS, now: NOW, timeout: 30 });
  const sent = Object.values(r.state.map); assert.equal(sent.length, LIMITS.maxOpen); assert.ok(sent.every((m) => m.status === 'sent' && m.positionId));
  assert.match(r.state.wait['s' + LIMITS.maxOpen].why, /already open/);
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

test('market closed: the trade waits for as long as it is open (no try counted), the symbol is paused LIMITS.pause; other "not now" answers count', async () => {
  const b = broker({ reject: 'MARKET_CLOSED' });
  let r = await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b.WS, now: NOW });
  assert.equal(r.state.wait['eurusd-intraday-1'].n, 0); assert.equal((r.state.skipped || {})['eurusd-intraday-1'], undefined); assert.ok(r.state.paused.EURUSD);
  b.o.reject = null; r = await mirrorRound({ env: ENV, trades: [tr()], state: r.state, WS: b.WS, now: NOW + LIMITS.pause + 60 });
  assert.equal(r.state.map['eurusd-intraday-1'], undefined, 'just reopened: spreads settle first'); assert.match(r.state.wait['eurusd-intraday-1'].why, /just reopened/);
  r = await mirrorRound({ env: ENV, trades: [tr()], state: r.state, WS: b.WS, now: NOW + LIMITS.settle + 60 });
  assert.equal(r.state.map['eurusd-intraday-1'].status, 'open'); assert.equal(r.state.wait['eurusd-intraday-1'], undefined);
  // a whole weekend of closed-market rounds: one order per symbol per pause, never a skip; a second trade on the symbol sends nothing while paused
  const b2 = broker({ reject: 'MARKET_CLOSED' }); r = { state: started };
  for (let i = 0; i < 30; i++) r = await mirrorRound({ env: ENV, trades: [tr({ opened: NOW + 100, filled: NOW + 100 }), tr({ id: 'two', opened: NOW + 100, filled: NOW + 100 })], state: r.state, WS: b2.WS, now: NOW + 100 + i * 240 });
  assert.ok(orders(b2).length >= 4 && orders(b2).length <= 8, `orders ${orders(b2).length}`);   // 30 rounds x 4 min: one probe per pause + settle window
  assert.equal((r.state.skipped || {})['eurusd-intraday-1'], undefined); assert.match(r.state.wait.two.why, /market closed/);
  assert.equal(r.log.filter((l) => /not mirrored yet two/.test(l.msg)).length <= 1, true);   // a repeat of the same reason is not logged again
  // a counted "not now" (maintenance) still runs out after LIMITS.retries
  const b4 = broker({ reject: 'SERVER_IS_UNDER_MAINTENANCE' }); r = { state: started };
  for (let i = 0; i < 5; i++) r = await mirrorRound({ env: ENV, trades: [tr()], state: r.state, WS: b4.WS, now: NOW + i * 60 });
  assert.equal(orders(b4).length, LIMITS.retries); assert.match(r.state.skipped['eurusd-intraday-1'], /3 tries/);
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

test('housekeeping: skip notes live as long as the council trade is open (never re-sent), dropped once it closes; finished positions dropped after keepDays', async () => {
  const b = broker({ reject: 'NOT_ENOUGH_MONEY' }); let r = await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b.WS, now: NOW });
  assert.ok(r.state.skipped['eurusd-intraday-1']);
  r.state.map.old = { status: 'closed at broker', closedAt: new Date((NOW - 40 * 86400) * 1000).toISOString(), positionId: '1' };
  r = await mirrorRound({ env: ENV, trades: [tr()], state: r.state, WS: b.WS, now: NOW + 3 * 3600 });   // three hours on, still open: still skipped, no new order
  assert.ok(r.state.skipped['eurusd-intraday-1']); assert.equal(r.state.map.old, undefined); assert.equal(orders(b).length, 1);
  r = await mirrorRound({ env: ENV, trades: [tr({ status: 'loss' })], state: r.state, WS: b.WS, now: NOW + 4 * 3600 });
  assert.equal(r.state.skipped['eurusd-intraday-1'], undefined); assert.equal(orders(b).length, 1);
});

test('daily stop: a day that started without a readable balance takes the first one it gets', async () => {
  const b = broker(); const st = { ...started, day: { date: new Date(NOW * 1000).toISOString().slice(0, 10), startBalance: null } };
  let r = await mirrorRound({ env: ENV, trades: [], state: st, WS: b.WS, now: NOW }); assert.equal(r.state.day.startBalance, 10000);
  b.setBalance(970000); r = await mirrorRound({ env: ENV, trades: [tr({ opened: NOW + 30, filled: NOW + 30 })], state: r.state, WS: b.WS, now: NOW + 60 });
  assert.equal(orders(b).length, 0); assert.match(r.state.wait['eurusd-intraday-1'].why, /daily loss stop/);
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
  const b2 = broker({ reject: 'SERVER_IS_UNDER_MAINTENANCE' }); r = { state: started }; const seen = [];
  for (let i = 0; i < 4; i++) { r = await mirrorRound({ env: ENV, trades: [tr({ opened: NOW + 100, filled: NOW + 100 })], state: again(r), WS: b2.WS, now: NOW + 100 + i * 60 }); seen.push(...kinds(r)); }
  assert.deepEqual(seen, ['reject']);
  // a closed market never alerts: it waits for the open
  const b3 = broker({ reject: 'MARKET_CLOSED' }); r = { state: started }; const seen3 = [];
  for (let i = 0; i < 4; i++) { r = await mirrorRound({ env: ENV, trades: [tr()], state: again(r), WS: b3.WS, now: NOW + i * 900 }); seen3.push(...kinds(r)); }
  assert.deepEqual(seen3, []);
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
  assert.match(mirrorAlertText(r.alerts[0], NOW).msg, /^Opened at 1\.10012 · council entry/);   // the fake broker reports the fill price on the adopted position
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
  assert.equal(ALLOWED.size, 13);
});

// ---- risk-based sizing (owner, 7 Nov: "risk-based lots, bigger demo") -----------------------------------------------------
test('risk sizing: ICT 0.20% x size, Meridian 0.02% per 1R; USD-base pairs converted; open-risk cap; below the minimum is skipped', () => {
  const fx = { lotSize: 10000000, minVolume: 100000, stepVolume: 100000 }, gold = { lotSize: 10000, minVolume: 100, stepVolume: 100 }, idx = { lotSize: 100, minVolume: 10, stepVolume: 10 };
  // $50k, Meridian EURUSD with a 200-pip stop: $10 risk / ($2,000 a lot) = 0.005 lot -> below 0.01 -> skipped, never rounded up
  assert.match(riskVolume({ info: fx, t: { id: 'm1', entry: 1.1, stop: 1.08 }, balance: 50000, name: 'EURUSD', minLot: false }).skip, /below the broker minimum/);
  // 8 Nov: by default the order goes at the broker minimum instead, with its real risk counted (0.01 lot x 200 pips = 20)
  const atMin = riskVolume({ info: fx, t: { id: 'm1', entry: 1.1, stop: 1.08 }, balance: 50000, name: 'EURUSD' });
  assert.equal(atMin.volume, 100000); assert.equal(atMin.minLot, true); assert.equal(atMin.lots, 0.01); assert.equal(atMin.riskCash, 20);
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
  assert.match(riskVolume({ info: gold, t: { id: 'ict:gc-3', entry: 4000, stop: 3980 }, balance: 50000, name: 'XAUUSD', openRisk: 50000 * LIMITS.maxOpenRisk - 50 }).skip, /open risk/);
  assert.equal(LIMITS.maxOpen, 40); assert.equal(LIMITS.maxOpenRisk, 0.5); assert.equal(LIMITS.minLot, true);
  // a cross pair with no USD side is not guessed
  assert.match(riskVolume({ info: fx, t: { id: 'm3', entry: 0.85, stop: 0.849 }, balance: 50000, name: 'EURGBP' }).skip, /quote currency/);
  // on a $1,000 demo an ICT gold trade goes at the minimum lot (8 Nov), its real 2% risk counted; with the fallback off it is skipped as before
  const small = riskVolume({ info: gold, t: { id: 'ict:gc-4', entry: 4000, stop: 3980 }, balance: 1000, name: 'XAUUSD' });
  assert.equal(small.minLot, true); assert.equal(small.lots, 0.01); assert.equal(small.riskCash, 20);
  assert.match(riskVolume({ info: gold, t: { id: 'ict:gc-4', entry: 4000, stop: 3980 }, balance: 1000, name: 'XAUUSD', minLot: false }).skip, /bigger demo balance/);
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

// ---- 8 Nov audit: levels from the council's latest price, min-lot risk cap --------------------------------------------------
test('levels: a council trade copied late measures its stop/target distances from the council\'s latest price, so the demo levels equal the council\'s', async () => {
  // buy 1.1000 / stop 1.0980 / target 1.1050, price now 1.1010 (0.5R into the trade): stop 210 pips-ish below, target 400 above
  const b = broker(); const r = await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b.WS, now: NOW, marks: { eurusd: { price: 1.101, at: NOW - 60 } } });
  const o = orders(b)[0].payload; assert.equal(o.relativeStopLoss, 300); assert.equal(o.relativeTakeProfit, 400);
  const m = r.state.map['eurusd-intraday-1']; assert.equal(m.mark, 1.101); assert.equal(m.levelsFrom, 'mark'); assert.equal(m.stop, 1.098); assert.equal(m.t1, 1.105);
  assert.equal(m.riskCash, 3);   // sized on the real distance: 0.01 lot (the minimum) x 30 pips = $3, not the council's 20 pips
});
test('levels: price past the council stop or target, or more than LIMITS.maxDriftR into the trade, is skipped as a different trade', async () => {
  let b = broker(); let r = await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b.WS, now: NOW, marks: { eurusd: 1.0975 } });
  assert.equal(orders(b).length, 0); assert.match(r.state.skipped['eurusd-intraday-1'], /past the council stop/);
  b = broker(); r = await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b.WS, now: NOW, marks: { eurusd: 1.1051 } });
  assert.equal(orders(b).length, 0); assert.match(r.state.skipped['eurusd-intraday-1'], /past the council target/);
  b = broker(); r = await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b.WS, now: NOW, marks: { eurusd: 1.1025 } });   // 1.25R run
  assert.equal(orders(b).length, 0); assert.match(r.state.skipped['eurusd-intraday-1'], /run 1\.25R/);
  // a sell: the same checks the other way round
  b = broker(); r = await mirrorRound({ env: ENV, trades: [tr({ side: 'sell', entry: 1.1, stop: 1.102, t1: 1.095 })], state: started, WS: b.WS, now: NOW, marks: { eurusd: 1.1021 } });
  assert.match(r.state.skipped['eurusd-intraday-1'], /past the council stop/);
  b = broker(); r = await mirrorRound({ env: ENV, trades: [tr({ side: 'sell', entry: 1.1, stop: 1.102, t1: 1.095 })], state: started, WS: b.WS, now: NOW, marks: { eurusd: 1.099 } });
  assert.equal(orders(b)[0].payload.relativeStopLoss, 300); assert.equal(orders(b)[0].payload.relativeTakeProfit, 400); assert.equal(r.state.map['eurusd-intraday-1'].status, 'open');
  // a trailing system (rr >= 50, no target) is never skipped for the target
  b = broker(); r = await mirrorRound({ env: ENV, trades: [tr({ rr: 99, t1: 1.1001 })], state: started, WS: b.WS, now: NOW, marks: { eurusd: 1.1005 } });
  assert.equal(r.state.map['eurusd-intraday-1'].status, 'open'); assert.equal('relativeTakeProfit' in orders(b)[0], false);
});
test('levels: no mark, a stale mark or an ICT trade fall back to the council entry; markOf', async () => {
  let b = broker(); await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b.WS, now: NOW, marks: { eurusd: { price: 1.101, at: NOW - LIMITS.markMaxAge - 1 } } });
  assert.equal(orders(b)[0].payload.relativeStopLoss, 200); assert.equal(orders(b)[0].payload.relativeTakeProfit, 500);
  b = broker(); let r = await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b.WS, now: NOW, marks: { xau: 4000 } });
  assert.equal(orders(b)[0].payload.relativeStopLoss, 200); assert.equal(r.state.map['eurusd-intraday-1'].mark, undefined);
  assert.equal(markOf({ eurusd: 1.1 }, 'eurusd', NOW), 1.1); assert.equal(markOf({ eurusd: { price: 1.1, at: new Date((NOW - 60) * 1000).toISOString() } }, 'eurusd', NOW), 1.1);
  assert.equal(markOf({ eurusd: { price: 1.1, at: (NOW - 3600) * 1000 } }, 'eurusd', NOW), null); assert.equal(markOf({ eurusd: 0 }, 'eurusd', NOW), null); assert.equal(markOf(null, 'eurusd', NOW), null);
  // ICT: futures levels on a cash CFD, distance from the entry regardless of the mark
  const ict = [{ id: 'nq-b-1', market: 'nq', side: 'buy', entry: 20000, stop: 19950, t1: null, status: 'open', opened: NOW - 60, filled: NOW - 60, grade: 'A', setup: 'ict-A' }];
  b = broker(); await mirrorRound({ env: ENV, trades: ictCandidates(ict), state: started, WS: b.WS, now: NOW, marks: { nq: 20100 } });
  assert.equal(orders(b)[0].payload.relativeStopLoss, 5000000);
});
test('min-lot risk cap: a wide-stop trade whose minimum lot risks more than LIMITS.maxMinLotRisk of the balance waits for a bigger balance', async () => {
  const gold = { symbolId: 41, digits: 2, lotSize: 10000, minVolume: 100, stepVolume: 100 };   // 0.01 lot = 1 oz
  // $1,000 demo, SOL-like stop of $8.4 on 1 lot-equivalent... use gold: 0.01 lot x $84 stop = $84 risk = 8.4% > 2%
  const wide = riskVolume({ info: gold, t: { id: 'xau-position-1', entry: 4000, stop: 3916 }, balance: 1000, name: 'XAUUSD' });
  assert.match(wide.skip, /even the minimum lot .* risks 84\.00, 8\.4% of the balance/); assert.equal(wide.retry, true);
  const ok = riskVolume({ info: gold, t: { id: 'xau-scalp-1', entry: 4000, stop: 3985 }, balance: 1000, name: 'XAUUSD' });   // $15 = 1.5%
  assert.equal(ok.volume, 100); assert.equal(ok.minLot, true); assert.equal(ok.riskCash, 15);
  const big = riskVolume({ info: gold, t: { id: 'xau-position-1', entry: 4000, stop: 3916 }, balance: 10000, name: 'XAUUSD' });   // $10k: 0.84%, fine
  assert.equal(big.volume, 100); assert.equal(big.riskCash, 84);
  assert.equal(LIMITS.maxMinLotRisk, 0.02); assert.equal(LIMITS.maxDriftR, 1);
  // in a round it is a wait, not a skip: the owner's bigger balance lets it through next round
  const b = broker({ balance: 100000 }); let r = await mirrorRound({ env: ENV, trades: [tr({ id: 'x', market: 'xau', entry: 4000, stop: 3916, t1: 4200 })], state: started, WS: b.WS, now: NOW });
  assert.equal(orders(b).length, 0); assert.match(r.state.wait.x.why, /even the minimum lot/);
  b.setBalance(1000000); r = await mirrorRound({ env: ENV, trades: [tr({ id: 'x', market: 'xau', entry: 4000, stop: 3916, t1: 4200 })], state: r.state, WS: b.WS, now: NOW + 240 });
  assert.equal(orders(b).length, 1); assert.equal(r.state.map.x.status, 'open'); assert.equal(r.state.wait.x, undefined);
});

test('owner reset: drops the copied-trade records, notes, pauses and day once per `at`; the same trades are then copied again', async () => {
  const b = broker(); let r = await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b.WS, now: NOW });
  assert.equal(orders(b).length, 1); b.positions.clear();   // the owner closed it by hand
  const none = applyReset(r.state, null); assert.equal(none.applied, false); assert.equal(none.state, r.state);
  const first = applyReset(r.state, { at: '2026-11-08T09:45Z' }, NOW + 60);
  assert.equal(first.applied, true); assert.equal(first.dropped, 1); assert.deepEqual(first.state.map, {}); assert.equal(first.state.day, null); assert.equal(first.state.resetAt, '2026-11-08T09:45Z');
  assert.equal(first.state.startedAt, started.startedAt); assert.equal(first.state.catchUpAt, r.state.catchUpAt);
  assert.equal(applyReset(first.state, { at: '2026-11-08T09:45Z' }).applied, false);   // once
  r = await mirrorRound({ env: ENV, trades: [tr()], state: first.state, WS: b.WS, now: NOW + 240 });
  assert.equal(orders(b).length, 2); assert.equal(r.state.map['eurusd-intraday-1'].status, 'open'); assert.equal(r.state.day.startBalance, 10000);
  const file = JSON.parse(fs.readFileSync(new URL('../council/ctrader-reset.json', import.meta.url), 'utf8')); assert.match(file.at, /^\d{4}-\d{2}-\d{2}T/);
});

// ---- 8 Nov (owner: "open at the same time"): resting LIMIT orders for the council's pending trades ----------------------------
const pend = (o = {}) => tr({ id: 'eurusd-scalp-9', k: 'scalp', status: 'pending', filled: undefined, opened: NOW - 120, h: '15m', entry: 1.1, stop: 1.098, t1: 1.105, ...o });
const limits = (b) => b.sent.filter((m) => m.payloadType === PT.NEW_ORDER_REQ && m.payload.orderType === 2).map((m) => m.payload);
const markets = (b) => b.sent.filter((m) => m.payloadType === PT.NEW_ORDER_REQ && m.payload.orderType === 1).map((m) => m.payload);
const cancels = (b) => b.sent.filter((m) => m.payloadType === PT.CANCEL_ORDER_REQ).map((m) => m.payload);
const MK = { eurusd: 1.102 };   // price above the buy entry: a limit buy rests below

test('pending council trade -> one resting LIMIT at the council entry with absolute stop/target, valid to the council expiry; never twice', async () => {
  const b = broker(); let r = await mirrorRound({ env: ENV, trades: [pend()], state: started, WS: b.WS, now: NOW, marks: MK });
  const o = limits(b)[0]; assert.equal(limits(b).length, 1); assert.equal(markets(b).length, 0);
  assert.equal(o.orderType, 2); assert.equal(o.tradeSide, 1); assert.equal(o.limitPrice, 1.1); assert.equal(o.stopLoss, 1.098); assert.equal(o.takeProfit, 1.105); assert.equal(o.volume, 100000);
  assert.equal(o.timeInForce, 1); assert.equal(o.expirationTimestamp, (NOW - 120 + WAIT['15m']) * 1000); assert.equal(o.label, 'council'); assert.match(o.comment, /eurusd-scalp-9/);
  assert.equal(validUntil(pend()), NOW - 120 + 3 * 3600); assert.equal(validUntil(pend({ validFor: 600 })), NOW - 120 + 600); assert.equal(validUntil(pend({ h: 'zz' })), NOW - 120 + 86400);
  const rec = r.state.orders['eurusd-scalp-9']; assert.equal(rec.orderId, '901'); assert.equal(rec.limitPrice, 1.1); assert.equal(rec.riskCash, 2); assert.equal(rec.lots, 0.01);
  assert.deepEqual(r.alerts.map((a) => a.kind), ['pending']); const txt = mirrorAlertText(r.alerts[0], NOW); assert.match(txt.title, /limit placed · BUY EURUSD 0.01 lot/); assert.match(txt.msg, /Resting at 1.10000 · stop 1.09800 · target 1.10500/);
  assert.match(r.state.status, /0 open · 1 resting/);
  r = await mirrorRound({ env: ENV, trades: [pend()], state: r.state, WS: b.WS, now: NOW + 240, marks: MK });
  assert.equal(limits(b).length, 1); assert.equal(r.sent.length, 0); assert.equal(b.orders.size, 1);
  // a trailing system (rr >= 50): no take profit on the limit either
  const b2 = broker(); await mirrorRound({ env: ENV, trades: [pend({ rr: 99, t1: 2 })], state: started, WS: b2.WS, now: NOW, marks: MK });
  assert.equal('takeProfit' in limits(b2)[0], false); assert.equal(limits(b2)[0].stopLoss, 1.098);
});

test('the broker fills the limit first -> the position is adopted (limit filled), the order record goes, one open alert', async () => {
  const b = broker(); let r = await mirrorRound({ env: ENV, trades: [pend()], state: started, WS: b.WS, now: NOW, marks: MK });
  const pid = b.fillOrder(r.state.orders['eurusd-scalp-9'].orderId, 1.1);
  r = await mirrorRound({ env: ENV, trades: [pend()], state: r.state, WS: b.WS, now: NOW + 240, marks: MK });   // the council still says pending
  const m = r.state.map['eurusd-scalp-9']; assert.equal(m.status, 'open'); assert.equal(m.positionId, String(pid)); assert.equal(m.viaLimit, true); assert.equal(m.limitPrice, 1.1); assert.equal(m.fillPrice, 1.1); assert.equal(m.slipR, 0);
  assert.equal(m.riskCash, 2); assert.equal(m.lots, 0.01); assert.equal(r.state.orders['eurusd-scalp-9'], undefined); assert.equal(markets(b).length, 0);
  assert.deepEqual(r.alerts.map((a) => a.kind), ['open']); assert.match(mirrorAlertText(r.alerts[0], NOW).msg, /^Limit filled at 1.10000/);
  // the council then fills too: nothing more is sent; the council closing it closes the position
  r = await mirrorRound({ env: ENV, trades: [pend({ status: 'open', filled: NOW + 200 })], state: r.state, WS: b.WS, now: NOW + 480, marks: MK }); assert.equal(r.sent.length, 0);
  r = await mirrorRound({ env: ENV, trades: [pend({ status: 'win', R: 2.5 })], state: r.state, WS: b.WS, now: NOW + 720, marks: MK });
  assert.equal(r.state.map['eurusd-scalp-9'].status, 'closed by council'); assert.equal(b.positions.size, 0);
  // the council marks it missed while the broker had filled: the demo position is closed (council book wins)
  const b3 = broker(); r = await mirrorRound({ env: ENV, trades: [pend()], state: started, WS: b3.WS, now: NOW, marks: MK }); b3.fillOrder(r.state.orders['eurusd-scalp-9'].orderId, 1.1);
  r = await mirrorRound({ env: ENV, trades: [pend({ status: 'missed' })], state: r.state, WS: b3.WS, now: NOW + 240, marks: MK });
  assert.equal(r.state.map['eurusd-scalp-9'].status, 'closed by council'); assert.equal(b3.positions.size, 0);
});

test('the council ends or drops a pending trade -> the resting limit is cancelled; filled on the council feed first -> cancel then market order', async () => {
  let b = broker(); let r = await mirrorRound({ env: ENV, trades: [pend()], state: started, WS: b.WS, now: NOW, marks: MK });
  r = await mirrorRound({ env: ENV, trades: [pend({ status: 'expired' })], state: r.state, WS: b.WS, now: NOW + 240, marks: MK });
  assert.equal(cancels(b).length, 1); assert.equal(cancels(b)[0].orderId, 901); assert.equal(b.orders.size, 0); assert.equal(r.state.orders['eurusd-scalp-9'], undefined);
  assert.deepEqual(r.alerts.map((a) => a.kind), ['cancel']); assert.match(mirrorAlertText(r.alerts[0], NOW).msg, /the council ended it: expired/); assert.deepEqual(r.sent, [{ type: 'cancel', trade: 'eurusd-scalp-9' }]);
  // dropped from the council's list altogether
  b = broker(); r = await mirrorRound({ env: ENV, trades: [pend()], state: started, WS: b.WS, now: NOW, marks: MK });
  r = await mirrorRound({ env: ENV, trades: [], state: r.state, WS: b.WS, now: NOW + 240, marks: MK }); assert.equal(b.orders.size, 0); assert.match(r.log.at(-1).msg, /dropped the trade/);
  // the council's feed saw the touch first: cancel, then the usual market order the same round (levels from the mark)
  b = broker(); r = await mirrorRound({ env: ENV, trades: [pend()], state: started, WS: b.WS, now: NOW, marks: MK });
  r = await mirrorRound({ env: ENV, trades: [pend({ status: 'open', filled: NOW + 200 })], state: r.state, WS: b.WS, now: NOW + 240, marks: { eurusd: 1.1002 } });
  assert.equal(cancels(b).length, 1); assert.equal(markets(b).length, 1); assert.equal(r.state.map['eurusd-scalp-9'].status, 'open'); assert.equal(r.state.orders['eurusd-scalp-9'], undefined);
  assert.deepEqual(r.alerts.map((a) => a.kind), ['cancel', 'open']); assert.match(mirrorAlertText(r.alerts[0], NOW).msg, /a market order follows/);
  // the cancel is rejected (the broker filled it meanwhile): no market order; the position is adopted next round
  b = broker(); r = await mirrorRound({ env: ENV, trades: [pend()], state: started, WS: b.WS, now: NOW, marks: MK });
  b.o.cancelReject = true; r = await mirrorRound({ env: ENV, trades: [pend({ status: 'open', filled: NOW + 200 })], state: r.state, WS: b.WS, now: NOW + 240, marks: { eurusd: 1.1002 } });
  assert.equal(markets(b).length, 0); assert.ok(r.state.orders['eurusd-scalp-9']); assert.match(r.log.at(-1).msg, /cancel .* failed/);
  b.o.cancelReject = false; b.fillOrder('901', 1.1);
  r = await mirrorRound({ env: ENV, trades: [pend({ status: 'open', filled: NOW + 200 })], state: r.state, WS: b.WS, now: NOW + 480, marks: { eurusd: 1.1002 } });
  assert.equal(markets(b).length, 0); assert.equal(r.state.map['eurusd-scalp-9'].status, 'open'); assert.equal(r.state.map['eurusd-scalp-9'].viaLimit, true);
});

test('pending: waits without a price, when the entry is on the wrong side of it, near the council expiry, or on a paused symbol; shadows off skips shadows', async () => {
  let b = broker(); let r = await mirrorRound({ env: ENV, trades: [pend()], state: started, WS: b.WS, now: NOW });
  assert.equal(limits(b).length, 0); assert.match(r.state.wait['eurusd-scalp-9'].why, /no current council price/);
  b = broker(); r = await mirrorRound({ env: ENV, trades: [pend()], state: started, WS: b.WS, now: NOW, marks: { eurusd: 1.099 } });   // buy entry above the price
  assert.equal(limits(b).length, 0); assert.match(r.state.wait['eurusd-scalp-9'].why, /entry 1.1 is above the price 1.099/);
  b = broker(); r = await mirrorRound({ env: ENV, trades: [pend({ side: 'sell', entry: 1.1, stop: 1.102, t1: 1.095 })], state: started, WS: b.WS, now: NOW, marks: { eurusd: 1.099 } });   // sell limit above the price: fine
  assert.equal(limits(b).length, 1); assert.equal(limits(b)[0].tradeSide, 2); assert.equal(limits(b)[0].stopLoss, 1.102); assert.equal(limits(b)[0].takeProfit, 1.095);
  b = broker(); r = await mirrorRound({ env: ENV, trades: [pend({ validFor: 150 })], state: started, WS: b.WS, now: NOW, marks: MK });   // expires in 30 s
  assert.equal(limits(b).length, 0); assert.match(r.state.wait['eurusd-scalp-9'].why, /expires within a minute/);
  b = broker({}); b.o.rejectPending = 'MARKET_CLOSED'; r = await mirrorRound({ env: ENV, trades: [pend(), pend({ id: 'eurusd-scalp-10' })], state: started, WS: b.WS, now: NOW, marks: MK });
  assert.equal(limits(b).length, 1); assert.ok(r.state.paused['EURUSD:pending']); assert.equal(r.state.paused.EURUSD, undefined); assert.match(r.state.wait['eurusd-scalp-10'].why, /paused until/);
  b.o.rejectPending = null; r = await mirrorRound({ env: ENV, trades: [pend(), pend({ id: 'eurusd-scalp-10' })], state: r.state, WS: b.WS, now: NOW + LIMITS.pause + 60, marks: MK });
  assert.equal(limits(b).length, 3); assert.equal(Object.keys(r.state.orders).length, 2);
  b = broker(); r = await mirrorRound({ env: ENV, trades: [pend({ shadow: true })], state: started, WS: b.WS, now: NOW, marks: MK, shadows: false }); assert.equal(limits(b).length, 0);
  // ICT trades are never placed as limits (the desk reports fills only)
  const ict = [{ id: 'nq-b-2', market: 'nq', side: 'buy', entry: 20000, stop: 19950, t1: null, status: 'pending', opened: NOW - 60, grade: 'A', setup: 'ict-A' }];
  b = broker(); r = await mirrorRound({ env: ENV, trades: ictCandidates(ict), state: started, WS: b.WS, now: NOW, marks: { nq: 20100 } }); assert.equal(limits(b).length, 0);
});

test('pending: a resting order counts toward the open cap and the open risk; gone at the broker -> counted wait, placed again', async () => {
  const b = broker(); const many = Array.from({ length: LIMITS.maxOpen }, (_, i) => pend({ id: 'p' + i }));
  let r = await mirrorRound({ env: ENV, trades: many.concat([pend({ id: 'extra' })]), state: started, WS: b.WS, now: NOW, marks: MK });
  assert.equal(limits(b).length, LIMITS.maxOpen); assert.match(r.state.wait.extra.why, /already open/); assert.match(r.state.status, /0 open · 40 resting/);
  const b2 = broker(); r = await mirrorRound({ env: ENV, trades: [pend()], state: started, WS: b2.WS, now: NOW, marks: MK });
  b2.orders.clear();   // expired at the broker, no position
  r = await mirrorRound({ env: ENV, trades: [pend()], state: r.state, WS: b2.WS, now: NOW + 240, marks: MK });
  assert.equal(limits(b2).length, 2); assert.equal(Object.keys(r.state.orders).length, 1); assert.ok(r.log.some((l) => /gone at the broker/.test(l.msg)));
  assert.equal(pendingStep({ executionType: 2 }), 'done'); assert.ok(pendingStep({ executionType: 7, errorCode: 'X' }) instanceof Error);
  assert.equal(cancelStep({ executionType: 5 }), 'done'); assert.equal(cancelStep({ executionType: 2 }), 'wait'); assert.ok(cancelStep({ executionType: 8 }) instanceof Error);
});

// ---- 8 Nov (owner approved): the council moves a stop or target -> the demo position follows ------------------------------
test('amend: a council stop / target move on an open trade is sent to the broker as absolute levels; once per move; ICT moves by the same distance', async () => {
  const b = broker(); let r = await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b.WS, now: NOW });
  const pid = r.state.map['eurusd-intraday-1'].positionId; b.positions.get(pid).stopLoss = 1.098; b.positions.get(pid).takeProfit = 1.105;   // what the market order's relative levels became
  r = await mirrorRound({ env: ENV, trades: [tr()], state: r.state, WS: b.WS, now: NOW + 240 }); assert.equal(b.amends.length, 0, 'same levels: nothing sent');
  // break-even: the council moves the stop to the entry
  r = await mirrorRound({ env: ENV, trades: [tr({ stop: 1.1, be: true })], state: r.state, WS: b.WS, now: NOW + 480 });
  assert.equal(b.amends.length, 1); assert.equal(b.amends[0].positionId, Number(pid)); assert.equal(b.amends[0].stopLoss, 1.1); assert.equal(b.amends[0].takeProfit, 1.105);
  const m = r.state.map['eurusd-intraday-1']; assert.equal(m.stop, 1.1); assert.equal(m.amended, 1); assert.deepEqual(r.sent, [{ type: 'amend', trade: 'eurusd-intraday-1' }]);
  assert.deepEqual(r.alerts.map((a) => a.kind), ['amend']); const txt = mirrorAlertText(r.alerts[0], NOW); assert.match(txt.title, /stop moved · BUY EURUSD/); assert.match(txt.msg, /Stop 1.09800 → 1.10000/); assert.match(txt.msg, /break-even/);
  r = await mirrorRound({ env: ENV, trades: [tr({ stop: 1.1, be: true })], state: r.state, WS: b.WS, now: NOW + 720 }); assert.equal(b.amends.length, 1, 'the same move is not resent');
  r = await mirrorRound({ env: ENV, trades: [tr({ stop: 1.102, t1: 1.108 })], state: r.state, WS: b.WS, now: NOW + 960 });
  assert.equal(b.amends.length, 2); assert.equal(b.amends[1].stopLoss, 1.102); assert.equal(b.amends[1].takeProfit, 1.108); assert.equal(r.state.map['eurusd-intraday-1'].t1, 1.108);
  // the council drops the fixed target (trailing system, rr >= 50): only the stop goes
  r = await mirrorRound({ env: ENV, trades: [tr({ stop: 1.103, t1: 2, rr: 99 })], state: r.state, WS: b.WS, now: NOW + 1200 });
  assert.equal(b.amends.length, 3); assert.equal(b.amends[2].stopLoss, 1.103); assert.equal('takeProfit' in b.amends[2], false);
  // ICT: the broker stop moves by the council's distance (futures levels), not to the council's level
  const ict = [{ id: 'nq-b-1', market: 'nq', side: 'buy', entry: 20000, stop: 19950, t1: null, status: 'open', opened: NOW - 60, filled: NOW - 60, grade: 'A', setup: 'ict-A' }];
  const b2 = broker(); r = await mirrorRound({ env: ENV, trades: ictCandidates(ict), state: started, WS: b2.WS, now: NOW });
  const pid2 = r.state.map['ict:nq-b-1'].positionId; b2.positions.get(pid2).stopLoss = 19850;   // the cash index trades 100 under the futures
  r = await mirrorRound({ env: ENV, trades: ictCandidates([{ ...ict[0], stop: 20000 }]), state: r.state, WS: b2.WS, now: NOW + 240 });
  assert.equal(b2.amends.length, 1); assert.equal(b2.amends[0].stopLoss, 19900); assert.equal(r.state.map['ict:nq-b-1'].stop, 20000);
  // a rejected move is retried AMEND_TRIES times, then left alone (logged once as given up)
  const b3 = broker(); r = await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b3.WS, now: NOW }); b3.o.amendReject = 'INVALID_STOP_LOSS';
  for (let i = 1; i <= 5; i++) r = await mirrorRound({ env: ENV, trades: [tr({ stop: 1.0995 })], state: r.state, WS: b3.WS, now: NOW + i * 240 });
  const m3 = r.state.map['eurusd-intraday-1']; assert.equal(m3.amendFails, 3); assert.equal(m3.stop, 1.098); assert.equal(b3.sent.filter((x) => x.payloadType === PT.AMEND_POSITION_SLTP_REQ).length, 3);
  assert.equal(r.log.filter((l) => /giving up/.test(l.msg)).length <= 1, true);
  // a closed council trade is not amended, it is closed
  const b4 = broker(); r = await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b4.WS, now: NOW });
  r = await mirrorRound({ env: ENV, trades: [tr({ stop: 1.1, status: 'win', R: 2 })], state: r.state, WS: b4.WS, now: NOW + 240 }); assert.equal(b4.amends.length, 0); assert.equal(r.state.map['eurusd-intraday-1'].status, 'closed by council');
});

// ---- 8 Nov (owner): one demo account per book ---------------------------------------------------------------------------------
test('books and accounts: every trade has one book; accounts come from config.json or CTRADER_ACCOUNTS, the base account takes the rest', () => {
  assert.deepEqual(BOOKS, ['council', 'ict', 'shadow', 'lit', 'replica']); assert.equal(bookOf({ id: 'xau-replica-1-s', k: 'replica', shadow: true }), 'replica');
  assert.equal(bookOf({ id: 'ict:nq-b-1' }), 'ict'); assert.equal(bookOf({ id: 'xau-lit-s-1', k: 'lit', shadow: true }), 'lit'); assert.equal(bookOf({ id: 'eurusd-scalp-1', shadow: true }), 'shadow'); assert.equal(bookOf({ id: 'eurusd-scalp-1', k: 'scalp' }), 'council');
  let a = accountsFor({ CTRADER_ACCOUNT_ID: '4242' }, {}); assert.deepEqual(a.byBook, { council: '4242', ict: '4242', shadow: '4242', lit: '4242', replica: '4242' }); assert.equal(a.groups.length, 1); assert.deepEqual(a.groups[0].books, BOOKS);
  a = accountsFor({ CTRADER_ACCOUNT_ID: '4242' }, { mirrorAccounts: { shadow: '5000', lit: '6000' } });
  assert.deepEqual(a.byBook, { council: '4242', ict: '4242', shadow: '5000', lit: '6000', replica: '4242' }); assert.deepEqual(a.groups.map((g) => [g.account, g.books]), [['4242', ['council', 'ict', 'replica']], ['5000', ['shadow']], ['6000', ['lit']]]);
  a = accountsFor({ CTRADER_ACCOUNT_ID: '4242', CTRADER_ACCOUNTS: 'ict:7000, lit:8000,bogus:1' }, { mirrorAccounts: { lit: '6000' } });
  assert.deepEqual(a.byBook, { council: '4242', ict: '7000', shadow: '4242', lit: '8000', replica: '4242' }, 'the env wins over config.json; unknown books ignored');
  assert.match(mirrorAlertText({ kind: 'reject', symbol: 'XAUUSD', side: 'buy', book: 'shadow', result: 'no' }, 0).title, /^Demo mirror \[shadow\]: order rejected/);
  assert.match(mirrorAlertText({ kind: 'reject', symbol: 'XAUUSD', side: 'buy', result: 'no' }, 0).title, /^Demo mirror: order rejected/);
});

test('accounts hand-over: a trade held on one account is managed there and never opened on another; openBooks limits new opens', async () => {
  // the base account holds a shadow trade from before the split; the shadow account must not open it again
  const b = broker(); let r = await mirrorRound({ env: ENV, trades: [tr({ id: 'sh1', shadow: true })], state: started, WS: b.WS, now: NOW });
  assert.equal(r.state.map.sh1.status, 'open');
  const b2 = broker(); const r2 = await mirrorRound({ env: ENV, trades: [tr({ id: 'sh1', shadow: true }), tr({ id: 'sh2', shadow: true }), tr({ id: 'live1' })], state: started, WS: b2.WS, now: NOW, openBooks: ['shadow'], exclude: new Set(['sh1']) });
  assert.deepEqual(Object.keys(r2.state.map), ['sh2'], 'only the unheld shadow trade opens on the shadow account; the live trade is not its book');
  // the base account, now opening only council trades, still manages the shadow trade it holds: the council closes it, the demo closes
  r = await mirrorRound({ env: ENV, trades: [tr({ id: 'sh1', shadow: true, status: 'loss' }), tr({ id: 'sh3', shadow: true })], state: r.state, WS: b.WS, now: NOW + 240, openBooks: ['council'] });
  assert.equal(r.state.map.sh1.status, 'closed by council'); assert.equal(r.state.map.sh3, undefined, 'no new shadow opens on the base account'); assert.equal(b.positions.size, 0);
});

// ---- the stop guard (8 Nov, owner: "u didnt place sl" / "it is forbidden to have a trade with no sl") -----------------------
test('stop guard: a fill the broker reports without a stop gets the council stop at once; a refused stop closes the position; a stop inside the spread is not mirrored', async () => {
  const b = broker(); b.o.noSL = true;
  const t = tr({ id: 'eurusd-intraday-9' });
  const r = await mirrorRound({ env: ENV, trades: [t], state: {}, tokens: null, WS: b.WS, now: NOW, timeout: 2000, marks: { eurusd: { price: 1.1, at: NOW } } });
  const pid = r.state.map['eurusd-intraday-9'].positionId;
  assert.equal(b.amends.length, 1); assert.equal(b.amends[0].stopLoss, 1.098); assert.equal(b.amends[0].takeProfit, 1.105); assert.equal(b.positions.get(pid).stopLoss, 1.098);   // set in the same round as the fill
  assert.equal(r.state.map['eurusd-intraday-9'].stopSetBy, 'guard'); assert.ok(r.log.some((l) => /set the missing stop/.test(l.msg)));
  assert.deepEqual(kinds(r), ['open', 'amend']);
  // once set, nothing more is sent
  await mirrorRound({ env: ENV, trades: [t], state: r.state, tokens: null, WS: b.WS, now: NOW + 60, timeout: 2000, marks: { eurusd: { price: 1.1, at: NOW + 60 } } });
  assert.equal(b.amends.length, 1);
  // a held position found without a stop on a later round (someone removed it at the broker) is protected again
  b.positions.get(pid).stopLoss = undefined;
  const r3 = await mirrorRound({ env: ENV, trades: [t], state: r.state, tokens: null, WS: b.WS, now: NOW + 120, timeout: 2000, marks: { eurusd: { price: 1.1, at: NOW + 120 } } });
  assert.equal(b.amends.length, 2); assert.equal(b.positions.get(pid).stopLoss, 1.098); assert.equal(r3.state.map['eurusd-intraday-9'].status, 'open');
  // the broker refuses the stop -> the position is closed at once, whatever the price; the record and the alert say why
  const b2 = broker(); b2.o.noSL = true; b2.o.amendReject = 'INVALID_REQUEST';
  const s1 = await mirrorRound({ env: ENV, trades: [t], state: {}, tokens: null, WS: b2.WS, now: NOW, timeout: 2000, marks: { eurusd: { price: 1.1, at: NOW } } });
  assert.equal(s1.state.map['eurusd-intraday-9'].status, 'closed by mirror'); assert.equal(b2.o.closes, 1); assert.equal(b2.positions.size, 0);
  assert.match(s1.state.map['eurusd-intraday-9'].closedWhy, /no stop at the broker/); assert.ok(s1.alerts.some((a) => a.kind === 'close' && /no stop/.test(a.why)));
  // the amend gets no answer at all -> not closed on a guess; alerted, checked again next round
  const b3 = broker(); b3.o.noSL = true;
  const s3a = await mirrorRound({ env: ENV, trades: [t], state: {}, tokens: null, WS: b3.WS, now: NOW, timeout: 2000, marks: { eurusd: { price: 1.1, at: NOW } } });
  const pid3 = s3a.state.map['eurusd-intraday-9'].positionId; b3.positions.get(pid3).stopLoss = undefined; b3.o.amendSilent = true;
  const s3 = await mirrorRound({ env: ENV, trades: [t], state: s3a.state, tokens: null, WS: b3.WS, now: NOW + 60, timeout: 30, marks: { eurusd: { price: 1.1, at: NOW + 60 } } });
  assert.equal(s3.state.map['eurusd-intraday-9'].status, 'open'); assert.equal(s3.state.map['eurusd-intraday-9'].noStopTries, 1); assert.ok(s3.alerts.some((a) => a.kind === 'nostop')); assert.equal(b3.o.closes, 0);
  // the spread guard: a stop 0.0002 away with a 0.0002 spread is not mirrored at all
  const b4 = broker();
  const tight = { ...t, id: 'eurusd-scalp-9', stop: 1.0998, t1: 1.1004 };
  const r4 = await mirrorRound({ env: ENV, trades: [tight], state: {}, tokens: null, WS: b4.WS, now: NOW, timeout: 2000, marks: { eurusd: { price: 1.1, at: NOW } },
    specs: { account: { currency: 'USD' }, symbols: { EURUSD: { base: 'EUR', quote: 'USD', spread: 0.0002 } } } });
  assert.equal(b4.positions.size, 0); assert.match(r4.state.skipped['eurusd-scalp-9'], /inside the broker spread/);
});

test('stop check reads the position back: a stop attached just after the fill event is not "missing"; a really missing one is set', async () => {
  const b = broker(); b.o.slLate = true;
  let r = await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b.WS, now: NOW, slWaitMs: 0 });
  assert.equal(r.state.map['eurusd-intraday-1'].status, 'open'); assert.equal(b.amends.length, 0, 'no needless amend');
  assert.ok(r.state.map['eurusd-intraday-1'].brokerStop > 0); assert.equal(r.log.some((l) => /missing stop/.test(l.msg)), false);
  const b2 = broker(); b2.o.noSL = true;
  r = await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b2.WS, now: NOW, slWaitMs: 0 });
  assert.equal(b2.amends.length, 1); assert.ok(b2.amends[0].stopLoss > 0); assert.ok(r.log.some((l) => /missing stop/.test(l.msg)));
});

test('audit 9 Nov: no position is ever left without a stop, and a stop is never set at 0', async () => {
  // the council trade leaves the list: the stop saved at the open still protects the position
  const b = broker(); let r = await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b.WS, now: NOW, slWaitMs: 0 });
  const pid = r.state.map['eurusd-intraday-1'].positionId; delete b.positions.get(pid).stopLoss;
  r = await mirrorRound({ env: ENV, trades: [], state: r.state, WS: b.WS, now: NOW + 60, slWaitMs: 0 });
  assert.equal(b.amends.at(-1).stopLoss, 1.098, 'saved stop used'); assert.ok(b.amends.every((a) => a.stopLoss == null || a.stopLoss > 0));
  // no level anywhere: closed, never amended to 0
  const b2 = broker(); r = await mirrorRound({ env: ENV, trades: [tr()], state: started, WS: b2.WS, now: NOW, slWaitMs: 0 });
  const id2 = r.state.map['eurusd-intraday-1'].positionId; delete b2.positions.get(id2).stopLoss; r.state.map['eurusd-intraday-1'].stop = null;
  const before = b2.amends.length; r = await mirrorRound({ env: ENV, trades: [tr({ stop: null })], state: r.state, WS: b2.WS, now: NOW + 60, slWaitMs: 0 });
  assert.equal(b2.amends.length, before, 'no amend'); assert.equal(b2.o.closes, 1); assert.match(r.state.map['eurusd-intraday-1'].status, /closed by mirror/);
  // an unmanaged position with our label and no stop is closed; one with a stop is reported once and left
  const b3 = broker(); b3.positions.set('900', { positionId: 900, positionStatus: 1, price: 1.1, tradeData: { symbolId: 1, volume: 1000, tradeSide: 1, label: 'council', comment: 'lost' } });
  b3.positions.set('901', { positionId: 901, positionStatus: 1, price: 1.1, stopLoss: 1.09, tradeData: { symbolId: 1, volume: 1000, tradeSide: 1, label: 'council', comment: 'kept' } });
  r = await mirrorRound({ env: ENV, trades: [], state: started, WS: b3.WS, now: NOW, slWaitMs: 0 });
  assert.equal(b3.o.closes, 1); assert.equal(b3.positions.has('900'), false); assert.equal(b3.positions.has('901'), true); assert.ok(r.state.orphans['901']);
  r = await mirrorRound({ env: ENV, trades: [], state: r.state, WS: b3.WS, now: NOW + 60, slWaitMs: 0 });
  assert.equal(r.log.filter((l) => /unmanaged position 901/.test(l.msg)).length, 0, 'reported once');
});

test('audit 9 Nov (2): an ICT stop set by the guard is not removed by a target move in the same round, nor the target shifted twice', async () => {
  const ict = [{ id: 'nq-b-2', market: 'nq', side: 'buy', entry: 20000, stop: 19950, t1: 20100, rr: 2, status: 'open', opened: NOW - 60, filled: NOW - 60, grade: 'A', aset: true }];
  const b = broker(); b.o.strictAmend = true;
  let r = await mirrorRound({ env: ENV, trades: ictCandidates(ict), state: started, WS: b.WS, now: NOW, slWaitMs: 0 });
  const pid = r.state.map["ict:nq-b-2"].positionId, fill = 19900; Object.assign(b.positions.get(pid), { price: fill, takeProfit: fill + 100 }); delete b.positions.get(pid).stopLoss;   // the cash index fills 100 under the futures
  r = await mirrorRound({ env: ENV, trades: ictCandidates([{ ...ict[0], t1: 20150 }]), state: r.state, WS: b.WS, now: NOW + 60, slWaitMs: 0 });
  const ps = b.positions.get(pid); assert.ok(ps, "still open: " + JSON.stringify(r.log.map((l) => l.msg)));
  assert.ok(ps.stopLoss != null, 'the stop the guard just set is still there'); assert.equal(ps.stopLoss, +(fill - 50).toFixed(2));
  assert.equal(ps.takeProfit, +(fill + 150).toFixed(2), 'target moved once');
});

// ---- bug hunt 9 Nov (3) ---------------------------------------------------------------------------------------------------
test('bug hunt 9 Nov: a trade one account copied and saw closed at the broker is never opened again on another account', async () => {
  // real data, 8 Nov: sol-rintra-1793936181, eth-scalp-1794095566, sol-intraday-1794084386 and sol-scalp-1794102041 were copied on the
  // base account before the book split, stopped at the broker while the council trade was still open, then opened a second time
  // (and lost again) on the shadow account, because only open / sent positions of other accounts were excluded
  const { copiedIds } = await import('../council/ctrader-mirror.mjs');
  assert.equal(typeof copiedIds, 'function');
  const b = broker(); let r = await mirrorRound({ env: ENV, trades: [tr({ id: 'sh1', shadow: true })], state: started, WS: b.WS, now: NOW, slWaitMs: 0 });
  b.positions.clear();   // stopped at the broker; the council's own stop is not hit yet
  r = await mirrorRound({ env: ENV, trades: [tr({ id: 'sh1', shadow: true })], state: r.state, WS: b.WS, now: NOW + 60, slWaitMs: 0, openBooks: ['council'] });
  assert.equal(r.state.map.sh1.status, 'closed at broker');
  const ex = copiedIds(JSON.parse(JSON.stringify(r.state)));
  assert.ok(ex.has('sh1'), 'a finished copy still counts as copied');
  const b2 = broker(); const r2 = await mirrorRound({ env: ENV, trades: [tr({ id: 'sh1', shadow: true })], state: started, WS: b2.WS, now: NOW + 120, slWaitMs: 0, openBooks: ['shadow'], exclude: ex });
  assert.equal(b2.positions.size, 0); assert.equal(r2.state.map.sh1, undefined);
  // resting limit orders count too; an empty or missing state holds nothing
  assert.ok(copiedIds({ map: {}, orders: { p1: { orderId: '9' } } }).has('p1')); assert.equal(copiedIds(null).size, 0);
});

test('bug hunt 9 Nov: a finished copy is kept past keepDays while the council trade is still open (a position trade is never copied twice)', async () => {
  const b = broker(); const st = { ...started, map: { 'eurusd-intraday-1': { status: 'closed at broker', positionId: '77', symbol: 'EURUSD', side: 'buy', openedAt: new Date((NOW - 45 * 86400) * 1000).toISOString(), closedAt: new Date((NOW - 40 * 86400) * 1000).toISOString() } } };
  let r = await mirrorRound({ env: ENV, trades: [tr()], state: st, WS: b.WS, now: NOW, slWaitMs: 0 });
  assert.ok(r.state.map['eurusd-intraday-1'], 'kept while the council trade is open'); assert.equal(orders(b).length, 0, 'not copied a second time');
  r = await mirrorRound({ env: ENV, trades: [tr({ status: 'loss', R: -1 })], state: r.state, WS: b.WS, now: NOW + 60, slWaitMs: 0 });
  assert.equal(r.state.map['eurusd-intraday-1'], undefined, 'dropped once the council trade is done');
});

test('bug hunt 9 Nov: an ICT futures roll (levels shifted by the contract switch) never moves the cash-CFD broker stop; a real move after it does', async () => {
  const ict = { id: 'nq-s-1', market: 'nq', side: 'sell', entry: 20000, stop: 20050, t1: null, status: 'open', opened: NOW - 60, filled: NOW - 60, aset: true, size: 1 };
  const b = broker(); let r = await mirrorRound({ env: ENV, trades: ictCandidates([ict]), state: started, WS: b.WS, now: NOW, slWaitMs: 0 });
  const pid = r.state.map['ict:nq-s-1'].positionId; Object.assign(b.positions.get(pid), { price: 19900, stopLoss: 19950 });   // the cash CFD fills 100 under the futures
  // the tracker's shiftTrade on a contract switch: every level +300 and a `rolled` entry; nothing really moved
  const rolled = { ...ict, entry: 20300, stop: 20350, rolled: [{ at: NOW + 100, by: 300 }] };
  r = await mirrorRound({ env: ENV, trades: ictCandidates([rolled]), state: r.state, WS: b.WS, now: NOW + 240, slWaitMs: 0 });
  assert.equal(b.amends.length, 0, 'a roll is not a stop move: ' + JSON.stringify(b.amends)); assert.equal(b.positions.get(pid).stopLoss, 19950);
  // break-even after the roll: the council stop goes to its (shifted) entry -> the broker stop moves 50 down, to the fill-side level
  r = await mirrorRound({ env: ENV, trades: ictCandidates([{ ...rolled, stop: 20300, beMoved: true }]), state: r.state, WS: b.WS, now: NOW + 480, slWaitMs: 0 });
  assert.equal(b.amends.length, 1); assert.equal(b.amends[0].stopLoss, 19900);
  // the guard's fallback (the trade left the list) still sets the stop at the council's distance from the fill
  delete b.positions.get(pid).stopLoss;
  r = await mirrorRound({ env: ENV, trades: [], state: r.state, WS: b.WS, now: NOW + 720, slWaitMs: 0 });
  assert.equal(b.amends.at(-1).stopLoss, 19900);
});

test('bug hunt 9 Nov: a pending council order re-quoted (new entry / stop) cancels the resting limit and places it at the new levels; a limit filled at old levels is brought to the council stop', async () => {
  let b = broker(); let r = await mirrorRound({ env: ENV, trades: [pend()], state: started, WS: b.WS, now: NOW, marks: MK });
  assert.equal(limits(b).length, 1);
  r = await mirrorRound({ env: ENV, trades: [pend({ entry: 1.0995, stop: 1.0985, t1: 1.104 })], state: r.state, WS: b.WS, now: NOW + 60, marks: MK });
  assert.equal(cancels(b).length, 1, 'the stale limit is cancelled'); assert.equal(limits(b).length, 2);
  const nl = limits(b)[1]; assert.equal(nl.limitPrice, 1.0995); assert.equal(nl.stopLoss, 1.0985); assert.equal(nl.takeProfit, 1.104);
  assert.equal(r.state.orders['eurusd-scalp-9'].stop, 1.0985);
  r = await mirrorRound({ env: ENV, trades: [pend({ entry: 1.0995, stop: 1.0985, t1: 1.104 })], state: r.state, WS: b.WS, now: NOW + 120, marks: MK });
  assert.equal(cancels(b).length, 1, 'unchanged levels: nothing more');
  // the broker filled the old limit before the mirror saw the re-quote: adopted with the stop the broker holds, then moved to the council's
  b = broker(); r = await mirrorRound({ env: ENV, trades: [pend()], state: started, WS: b.WS, now: NOW, marks: MK });
  const pid = b.fillOrder(r.state.orders['eurusd-scalp-9'].orderId, 1.1);
  r = await mirrorRound({ env: ENV, trades: [pend({ stop: 1.0985 })], state: r.state, WS: b.WS, now: NOW + 60, marks: MK });
  assert.equal(r.state.map['eurusd-scalp-9'].status, 'open'); assert.equal(b.positions.get(String(pid)).stopLoss, 1.0985, 'broker stop follows the council stop');
});

// ---- 10 Nov (owner: "the mirror is not taking the replica trades") ------------------------------------------------------------
// the replica's forward paper trades are recorded in research.json, as the Trader writes them (a real record, shortened)
const rep = (o = {}) => ({ id: 'eurusd-replica-1794182743-b', sig: 'replica|b|1794182400', market: 'eurusd', label: 'EUR/USD', dec: 5, k: 'replica', name: 'EUR/USD replica', side: 'buy', entry: 1.1, stop: 1.098, stop0: 1.098, t1: 1.104, rr: 2,
  opened: NOW - 60, filled: NOW - 60, checked: NOW, status: 'open', R: null, v: 5, pass: true, feed: 'oanda', note: 'Research (paper only): gold replica v5.', ...o });

test('replica research trades become candidates for the replica book: never twice, a failed filter counts as a shadow', () => {
  const live = { id: 'xau-replica-1793765703-b', market: 'xau', k: 'replica', side: 'buy', entry: 3949.82, stop: 3926.45, t1: 3996.56, status: 'open', opened: 1793765703, shadow: false };
  const research = [rep(), rep({ id: 'eth-replica-2-s', market: 'eth', side: 'sell', pass: false }), { ...live }, { ...live, id: 'xau-replica-other-id' },
    { id: 'nq-nyflip-1', k: 'nq-open', market: 'nq', side: 'buy', entry: 1, stop: 0.5, status: 'open' }, { id: 'c-1', k: 'cycle', market: 'btc' }, null, { k: 'replica' }];
  const c = replicaCandidates(research, [live, tr()]);
  assert.deepEqual(c.map((t) => t.id), ['eurusd-replica-1794182743-b', 'eth-replica-2-s'], 'only replica records; the live gold replica is taken from trades.json, by id and by market + side + time');
  assert.deepEqual(c.map((t) => [bookOf(t), t.shadow, t.research]), [['replica', false, true], ['replica', true, true]]);
  assert.equal(c[0].stop, 1.098); assert.equal(c[0].status, 'open');
  assert.deepEqual(replicaCandidates(null), []); assert.deepEqual(replicaCandidates({ trades: [] }), []); assert.deepEqual(replicaCandidates([rep()]).length, 1);
  // only while the replica book has a demo account of its own (else its trades would land on the council's account)
  assert.equal(replicaHasOwnAccount(accountsFor({ CTRADER_ACCOUNT_ID: '4242' }, {}).byBook), false);
  assert.equal(replicaHasOwnAccount(accountsFor({ CTRADER_ACCOUNT_ID: '4242' }, { mirrorAccounts: { replica: '9000' } }).byBook), true);
  assert.equal(replicaHasOwnAccount(accountsFor({ CTRADER_ACCOUNT_ID: '4242', CTRADER_ACCOUNTS: 'replica:4242' }, {}).byBook), false);
  assert.equal(replicaHasOwnAccount(null), false);
});

test('a replica research trade is copied to the replica account with its stop and target, follows a moved stop, and is closed when the record closes', async () => {
  const [t] = replicaCandidates([rep()]), b = broker();
  // the council account's round does not open it; the replica account's round does
  let r = await mirrorRound({ env: ENV, trades: [t], state: started, WS: b.WS, now: NOW, openBooks: ['council', 'shadow'] });
  assert.equal(b.sent.filter((m) => m.payloadType === PT.NEW_ORDER_REQ).length, 0);
  r = await mirrorRound({ env: ENV, trades: [t], state: started, WS: b.WS, now: NOW, openBooks: ['replica'] });
  const o = b.sent.find((m) => m.payloadType === PT.NEW_ORDER_REQ).payload;
  assert.equal(o.orderType, 1); assert.equal(o.tradeSide, 1); assert.equal(o.relativeStopLoss, 200, 'the stop is copied'); assert.equal(o.relativeTakeProfit, 400);
  assert.equal(r.state.map[t.id].status, 'open'); assert.equal(b.positions.size, 1);
  for (const p of b.positions.values()) assert.ok(p.stopLoss > 0, 'the demo position has a stop');
  // the Trader moves the research trade's stop to break-even: the demo stop follows
  r = await mirrorRound({ env: ENV, trades: replicaCandidates([rep({ stop: 1.1 })]), state: r.state, WS: b.WS, now: NOW + 240, openBooks: ['replica'] });
  assert.equal(b.amends.length, 1, 'one stop move at the broker');
  // the research record closes: so does the demo position
  r = await mirrorRound({ env: ENV, trades: replicaCandidates([rep({ stop: 1.1, status: 'win', R: 2 })]), state: r.state, WS: b.WS, now: NOW + 480, openBooks: ['replica'] });
  assert.equal(r.state.map[t.id].status, 'closed by council'); assert.equal(b.positions.size, 0);
});

test('a replica research trade without a stop is never sent; a failed-filter one is left out when shadows are off', async () => {
  let b = broker(), r = await mirrorRound({ env: ENV, trades: replicaCandidates([rep({ stop: null })]), state: started, WS: b.WS, now: NOW, openBooks: ['replica'] });
  assert.equal(b.sent.filter((m) => m.payloadType === PT.NEW_ORDER_REQ).length, 0, 'no stop, no order');
  b = broker(); r = await mirrorRound({ env: ENV, trades: replicaCandidates([rep({ pass: false })]), state: started, WS: b.WS, now: NOW, openBooks: ['replica'], shadows: false });
  assert.equal(b.sent.filter((m) => m.payloadType === PT.NEW_ORDER_REQ).length, 0);
  b = broker(); r = await mirrorRound({ env: ENV, trades: replicaCandidates([rep({ pass: false })]), state: started, WS: b.WS, now: NOW, openBooks: ['replica'], shadows: true });
  assert.equal(b.sent.filter((m) => m.payloadType === PT.NEW_ORDER_REQ).length, 1);
});

test('the mirror\'s entry point reads research.json for the replica book', () => {
  const src = fs.readFileSync(new URL('../council/ctrader-mirror.mjs', import.meta.url), 'utf8');
  assert.match(src, /research\.json/); assert.match(src, /replicaOwn \? replicaCandidates\(research, own\) : \[\]/);
});
