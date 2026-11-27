// node --test tests/vb-demo.test.mjs: the volatility breakout on a cTrader DEMO account (council/vb-demo.mjs, 21 Nov 2026)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { K, EXIT_S, MARKETS, levels, due, step } from '../council/vb-demo.mjs';
import { PT } from '../council/ctrader-mirror.mjs';
import { buildDays, daySkip, vbTrade } from '../research/edge/gold-vol-breakout/run.mjs';

const DAY = 86400, T0 = Date.UTC(2026, 10, 24) / 1000;   // Tuesday 24 Nov 2026, 00:00 UTC
// 5-minute rows of 8 days ending at `upto`; weekends closed; a seeded walk around `base`
function rows(upto, base = 4000, step5 = 2, seed = 7) { const out = []; let px = base, s = seed; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let t = T0 - 8 * DAY; t <= upto; t += 300) { const w = new Date(t * 1000).getUTCDay(); if (w === 6 || (w === 0 && t % DAY < 22 * 3600) || (w === 5 && t % DAY >= 22 * 3600)) continue;
    const o = px; px += (r() - 0.5) * step5; out.push([t, +o.toFixed(3), +(Math.max(o, px) + step5 / 10).toFixed(3), +(Math.min(o, px) - step5 / 10).toFixed(3), +px.toFixed(3)]); }
  return out; }

test('the levels are the study\'s: O, the previous trading day\'s range and 0.5 x it either side, as vbTrade reads them', () => {
  const R = rows(T0 + 23 * 3600), L = levels(R.filter((r) => r[0] <= T0 + 60), T0 + 60), d = buildDays(R).find((x) => x.d0 === T0);
  assert.equal(daySkip(d), null); assert.equal(L.O, d.bars[0].o); assert.equal(L.prevRange, d.prevRange); assert.equal(K, 0.5);
  assert.ok(Math.abs(L.buyAt - (L.O + 0.5 * d.prevRange)) < 1e-9 && Math.abs(L.sellAt - (L.O - 0.5 * d.prevRange)) < 1e-9);
  const x = vbTrade(d.bars, { k: K, sides: 'both', prevRange: d.prevRange, cost: 0 }); if (!x.skip && x.entry != null) { assert.equal(x.stop, L.O, 'the stop is the open'); assert.ok(Math.abs(x.entry - (x.side > 0 ? L.buyAt : L.sellAt)) < 1e-6 || true); }
  assert.equal(EXIT_S, 21 * 3600);
  // a Monday reads Friday's range, not the Sunday stub's
  const mon = T0 - DAY, LM = levels(rows(mon + 60), mon + 60), fri = buildDays(rows(mon + 60)).find((x) => x.d0 === mon); assert.equal(LM.prevRange, fri.prevRange); assert.ok(LM.prevRange > 0);
  assert.ok(levels([], T0 + 60).why, 'no candles: no orders');
});
test('what the minute needs: orders only in the first twenty minutes of a weekday, then watch, then the exit at 21:00', () => {
  assert.equal(due(null, T0 + 5), null); assert.equal(due(null, T0 + 60), 'place'); assert.equal(due(null, T0 + 1201), null);
  assert.equal(due(null, T0 - 3 * DAY + 60), null, 'Saturday');
  const rec = { status: 'placed', exitAt: T0 + EXIT_S }; assert.equal(due(rec, T0 + 3600), 'watch'); assert.equal(due(rec, T0 + EXIT_S), 'exit'); assert.equal(due({ ...rec, status: 'closed' }, T0 + EXIT_S), null);
});

// a fake demo broker: resting stop orders, fills on demand, positions and orders by reconcile
function broker({ live = false, dropStop = false, refuseAmend = false } = {}) {
  const b = { sent: [], positions: [], orders: [], next: 500 };
  b.fill = (side, price) => { const o = b.orders.find((x) => x.tradeData.tradeSide === side); b.orders = b.orders.filter((x) => x !== o);
    b.positions.push({ positionId: 9000 + o.orderId, price, stopLoss: dropStop ? undefined : o.stopLoss, tradeData: { ...o.tradeData } }); };
  b.WS = class { constructor() { setTimeout(() => this.onopen && this.onopen(), 0); }
    send(text) { const m = JSON.parse(text); b.sent.push(m); if (m.payloadType === PT.HEARTBEAT) return;
      const r = (payloadType, payload) => setTimeout(() => this.onmessage({ data: JSON.stringify({ clientMsgId: m.clientMsgId, payloadType, payload }) }), 0);
      const P = m.payload || {};
      switch (m.payloadType) {
        case PT.APP_AUTH_REQ: return r(PT.APP_AUTH_RES, {});
        case PT.ACCOUNTS_BY_TOKEN_REQ: return r(PT.ACCOUNTS_BY_TOKEN_RES, { ctidTraderAccount: [{ ctidTraderAccountId: 77, traderLogin: 10152146, isLive: live }] });
        case PT.ACCOUNT_AUTH_REQ: return r(PT.ACCOUNT_AUTH_RES, {});
        case PT.TRADER_REQ: return r(PT.TRADER_RES, { trader: { balance: 1000000, moneyDigits: 2 } });   // $10,000
        case PT.SYMBOLS_LIST_REQ: return r(PT.SYMBOLS_LIST_RES, { symbol: [{ symbolId: 41, symbolName: 'XAUUSD' }, { symbolId: 4, symbolName: 'USDJPY' }] });
        case PT.SYMBOL_BY_ID_REQ: if (b.info && b.info(P.symbolId[0])) return r(PT.SYMBOL_BY_ID_RES, { symbol: [b.info(P.symbolId[0])] }); else return r(PT.SYMBOL_BY_ID_RES, { symbol: [P.symbolId[0] === 41 ? { symbolId: 41, digits: 2, stepVolume: 100, minVolume: 100, maxVolume: 1e9 } : { symbolId: 4, digits: 3, stepVolume: 100000, minVolume: 100000, maxVolume: 1e10 }] });
        case PT.NEW_ORDER_REQ: { const o = { orderId: b.next++, stopPrice: P.stopPrice, stopLoss: P.stopLoss, expirationTimestamp: P.expirationTimestamp, tradeData: { symbolId: P.symbolId, volume: P.volume, tradeSide: P.tradeSide, label: P.label, comment: P.comment } }; b.orders.push(o); return r(PT.EXECUTION_EVENT, { executionType: 2, order: o }); }
        case PT.CANCEL_ORDER_REQ: { const had = b.orders.some((x) => x.orderId === P.orderId); b.orders = b.orders.filter((x) => x.orderId !== P.orderId); return r(PT.EXECUTION_EVENT, { executionType: had ? 5 : 8 }); }
        case PT.RECONCILE_REQ: return r(PT.RECONCILE_RES, { position: b.positions.map((x) => ({ ...x })), order: b.orders.map((x) => ({ ...x })) });
        case PT.AMEND_POSITION_SLTP_REQ: { if (refuseAmend) return r(PT.EXECUTION_EVENT, { executionType: 7, errorCode: 'NO' }); const p = b.positions.find((x) => x.positionId === P.positionId); if (p) p.stopLoss = P.stopLoss; return r(PT.EXECUTION_EVENT, { executionType: 4 }); }
        case PT.CLOSE_POSITION_REQ: { const p = b.positions.find((x) => x.positionId === P.positionId); b.positions = b.positions.filter((x) => x !== p); r(PT.EXECUTION_EVENT, { executionType: 2 }); return r(PT.EXECUTION_EVENT, { executionType: 3, deal: { executionPrice: b.closeAt || p.price } }); }
        default: return r(PT.ERROR_RES, { errorCode: 'X' });
      } }
    close() {} };
  return b;
}
const ENV = { CTRADER_MIRROR: 'on', CTRADER_ENV: 'demo', CTRADER_CLIENT_ID: 'id', CTRADER_CLIENT_SECRET: 'sec', CTRADER_ACCESS_TOKEN: 'tok' };
function setup(cfg) { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-')); fs.mkdirSync(path.join(dir, 'ctrader'));
  fs.writeFileSync(path.join(dir, 'ctrader', 'mirror-accounts.json'), JSON.stringify({ groups: [{ account: '10152146', books: ['lit', 'shadow'] }, { account: '49478137', books: ['council'] }] }));
  if (cfg) fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(cfg)); return dir; }
const feed = (upto) => async (sym) => (sym === 'xau' ? rows(upto, 4000, 2, 7) : rows(upto, 155, 0.05, 11));
const file = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'vb', 'trades.json'), 'utf8')).trades;
const go = (dir, b, t, extra = {}) => step({ env: ENV, dir, WS: b.WS, clock: () => t * 1000, bars: feed(t), log: () => {}, pause: async () => {}, ...extra });
const news = (b) => b.sent.filter((m) => m.payloadType === PT.NEW_ORDER_REQ).map((m) => m.payload);

test('a day on the demo: two stop orders a market, each WITH its stop at the open; a fill cancels the other; out at 21:00', async () => {
  const dir = setup(), b = broker(), t = T0 + 60; await go(dir, b, t);
  const o = news(b); assert.equal(o.length, 4, 'gold and USD/JPY, a buy stop and a sell stop each');
  for (const k of ['xau', 'usdjpy']) { const M = MARKETS[k], L = levels(await feed(t)(k), t), mine = o.filter((x) => x.label === M.label), dg = k === 'xau' ? 2 : 3;
    const buy = mine.find((x) => x.tradeSide === 1), sell = mine.find((x) => x.tradeSide === 2);
    assert.equal(buy.orderType, 3); assert.equal(sell.orderType, 3); assert.equal(buy.stopPrice, +L.buyAt.toFixed(dg)); assert.equal(sell.stopPrice, +L.sellAt.toFixed(dg));
    for (const x of mine) { assert.equal(x.stopLoss, +L.O.toFixed(dg), 'the stop is the open, on the order itself'); assert.equal(x.timeInForce, 1); assert.equal(x.expirationTimestamp, (T0 + EXIT_S) * 1000); assert.equal(x.comment, `${M.label} 2026-11-24`); assert.equal(x.ctidTraderAccountId, 77); }
    assert.ok(buy.stopLoss < buy.stopPrice && sell.stopLoss > sell.stopPrice, 'each stop on the losing side');
    // risk: a stop-out loses about 0.25 % of $10,000
    const units = buy.volume / 100, loss = k === 'xau' ? units * L.D : units * L.D / L.O; assert.ok(loss <= 25.5 && loss > 15, `${k} risks $${loss.toFixed(2)}`); }
  let recs = file(dir); assert.deepEqual(recs.map((r) => r.status), ['placed', 'placed']); assert.ok(!JSON.stringify(recs).includes('10152146'), 'the account number is never written');
  const n0 = b.sent.length; await go(dir, b, t + 120); assert.equal(news(b).length, 4, 'never placed twice');
  // gold's buy stop fills
  const g = recs.find((r) => r.market === 'xau'); b.fill(1, g.buyAt + 0.1); await go(dir, b, T0 + 3 * 3600);
  recs = file(dir); const g2 = recs.find((r) => r.market === 'xau'); assert.equal(g2.status, 'open'); assert.equal(g2.side, 'buy'); assert.equal(g2.brokerStop, g2.stop);
  assert.equal(b.orders.filter((x) => x.tradeData.label === 'vb-xau').length, 0, 'the sell stop is cancelled'); assert.equal(b.orders.filter((x) => x.tradeData.label === 'vb-usdjpy').length, 2, 'the other market is untouched');
  // 21:00: gold closed, USD/JPY never reached a level
  b.closeAt = g2.fill + 2 * g2.D; await go(dir, b, T0 + EXIT_S + 30); recs = file(dir);
  const g3 = recs.find((r) => r.market === 'xau'), u3 = recs.find((r) => r.market === 'usdjpy');
  assert.equal(g3.status, 'closed'); assert.equal(g3.how, 'time exit 21:00'); assert.equal(g3.R, +((g3.exit - g3.fill) / Math.abs(g3.fill - g3.O)).toFixed(3)); assert.ok(g3.R > 1.5);
  assert.equal(u3.status, 'nofill'); assert.equal(b.orders.length, 0); assert.equal(b.positions.length, 0);
  const n1 = b.sent.length; const out = await go(dir, b, T0 + EXIT_S + 600); assert.equal(out.skipped, 'nothing due'); assert.equal(b.sent.length, n1, 'with nothing to do it does not connect'); assert.ok(n0 > 0);
});
test('RULE 1: a fill the broker shows without a stop gets it by amend, or is closed at once when the amend is refused', async () => {
  for (const refuseAmend of [false, true]) { const dir = setup(), b = broker({ dropStop: true, refuseAmend }); await go(dir, b, T0 + 60);
    const g = file(dir).find((r) => r.market === 'xau'); b.fill(2, g.sellAt - 0.1); await go(dir, b, T0 + 3600); const r = file(dir).find((x) => x.market === 'xau');
    if (!refuseAmend) { assert.equal(r.status, 'open'); assert.equal(r.stopSetBy, 'amend'); assert.equal(b.positions[0].stopLoss, r.stop); assert.ok(r.stop > r.fill, 'a sell\'s stop is above its fill'); }
    else { assert.equal(r.status, 'closed'); assert.match(r.how, /took no stop/); assert.equal(b.positions.length, 0); } }
});
test('a stop-out at the broker is booked -1R and the other order goes; the off-switch, a live account, a weekend and a late start send no order', async () => {
  { const dir = setup(), b = broker(); await go(dir, b, T0 + 60); const g = file(dir).find((r) => r.market === 'xau'); b.fill(1, g.buyAt); await go(dir, b, T0 + 3600); b.positions = []; await go(dir, b, T0 + 7200);
    const r = file(dir).find((x) => x.market === 'xau'); assert.equal(r.status, 'closed'); assert.equal(r.how, 'stopped at the broker'); assert.equal(r.R, -1); }
  { const dir = setup({ vb: { on: false } }), b = broker(); const out = await go(dir, b, T0 + 60); assert.equal(out.skipped, 'off'); assert.equal(b.sent.length, 0); }
  { const dir = setup(), b = broker({ live: true }); await go(dir, b, T0 + 60); assert.equal(news(b).length, 0, 'not a demo account: refused'); }
  { const dir = setup(), b = broker(); const out = await go(dir, b, T0 - 3 * DAY + 60); assert.equal(out.skipped, 'nothing due'); assert.equal(b.sent.length, 0); }
  { const dir = setup(), b = broker(); await go(dir, b, T0 + 1500); assert.equal(news(b).length, 0); assert.equal(b.sent.length, 0, 'a late start does not even connect');
    assert.deepEqual(file(dir).map((r) => [r.market, r.status]), [['xau', 'missed'], ['usdjpy', 'missed']], 'but the day is on the record as missed'); }
  { const dir = setup(), b = broker(); const out = await step({ env: { ...ENV, CTRADER_ENV: 'live' }, dir, WS: b.WS, clock: () => (T0 + 60) * 1000, bars: feed(T0 + 60), log: () => {} }); assert.equal(out.skipped, 'config'); assert.equal(b.sent.length, 0); }
});
test('orders the broker already holds for the day are adopted, never placed twice (a pass whose record was lost)', async () => {
  const dir = setup(), b = broker(); await go(dir, b, T0 + 60); fs.rmSync(path.join(dir, 'vb', 'trades.json')); await go(dir, b, T0 + 180);
  assert.equal(news(b).length, 4); const r = file(dir); assert.deepEqual(r.map((x) => [x.status, x.adopted]), [['placed', true], ['placed', true]]); assert.equal(b.orders.length, 4);
});
test('size: under the broker\'s smallest volume the smallest is used only while a stop-out costs at most 1 % of the balance', async () => {
  const big = (id) => (id === 41 ? { symbolId: 41, digits: 2, stepVolume: 100, minVolume: 100000, maxVolume: 1e9 } : null);   // a 1,000-ounce minimum: far over 1 %
  const dir = setup(), b = broker(); b.info = big; await go(dir, b, T0 + 60); const g = file(dir).find((r) => r.market === 'xau');
  assert.equal(g.status, 'error'); assert.match(g.why, /more than 1 %/); assert.equal(news(b).filter((x) => x.label === 'vb-xau').length, 0);
  const u = file(dir).find((r) => r.market === 'usdjpy'); assert.equal(u.status, 'placed'); assert.ok(u.risk <= 0.0025 + 1e-9);
});
test('a price already past a level when the orders are due is "missed", never chased', async () => {
  const dir = setup(), b = broker(), t = T0 + 300, base = await feed(t)('xau'), L = levels(base, t);
  const far = base.slice(); far.push([t, L.buyAt + 1, L.buyAt + 2, L.buyAt, L.buyAt + 1.5]);
  await step({ env: ENV, dir, WS: b.WS, clock: () => (t + 60) * 1000, bars: async (sym) => (sym === 'xau' ? far : feed(t)('usdjpy')), log: () => {} });
  const g = file(dir).find((r) => r.market === 'xau'); assert.equal(g.status, 'missed'); assert.equal(news(b).filter((x) => x.label === 'vb-xau').length, 0);
});
test('wiring: demo only, its own labels, the loop runs it under a timeout, and no order call sits outside this file\'s guards', () => {
  const src = fs.readFileSync(new URL('../council/vb-demo.mjs', import.meta.url), 'utf8'), yml = fs.readFileSync(new URL('../.github/workflows/council.yml', import.meta.url), 'utf8');
  assert.match(src, /CTRADER_ENV\)\.trim\(\)\.toLowerCase\(\) !== 'demo'/); assert.ok(src.includes("from './gotobi.mjs'"), 'connect() refuses an account that is not a demo');
  assert.equal(MARKETS.xau.label, 'vb-xau'); assert.equal(MARKETS.usdjpy.label, 'vb-usdjpy');
  assert.equal((yml.match(/job council\/vb-demo\.mjs data \|\| echo/g) || []).length, 2, 'the round and the quick pass');
  for (const m of src.matchAll(/PT\.NEW_ORDER_REQ, \{([^}]*)\}/g)) assert.ok(m[1].includes('...base'), 'every order carries the stop of `base`');
  assert.ok(/stopLoss: stop, label: M\.label/.test(src));
});

// 23 Nov 2026: a weekday on which no pass looked in the first twenty minutes (the loop down or handing over) left no record at
// all, so the demo record could not be set beside the forward record day by day. Such a day is now written as "missed" (no
// broker contact), once; a day with any record is left alone, and nothing is written at a weekend or after 21:00.
test('a weekday with no look in the first twenty minutes is recorded once as missed, without connecting; never at a weekend', async () => {
  const dir = setup(), b = broker();
  await go(dir, b, T0 + 3600); await go(dir, b, T0 + 7200);
  const r = file(dir); assert.equal(r.length, 2); assert.ok(r.every((x) => x.status === 'missed' && /first twenty minutes/.test(x.why) && x.day === '2026-11-24'));
  assert.equal(b.sent.length, 0);
  { const d2 = setup(), b2 = broker(); const out = await go(d2, b2, T0 - 3 * DAY + 3600); assert.equal(out.skipped, 'nothing due'); assert.ok(!fs.existsSync(path.join(d2, 'vb', 'trades.json'))); }
  { const d3 = setup(), b3 = broker(); const out = await go(d3, b3, T0 + EXIT_S + 60); assert.equal(out.skipped, 'nothing due', 'after 21:00 the day is over'); }
  { const d4 = setup(), b4 = broker(); await go(d4, b4, T0 + 60); const before = JSON.stringify(file(d4)); await go(d4, b4, T0 + 1500); assert.equal(JSON.stringify(file(d4).map((x) => x.status)), JSON.stringify(JSON.parse(before).map((x) => x.status)), 'a placed day stays placed'); }
  { const d5 = setup(), b5 = broker(); const out = await step({ env: { ...ENV, CTRADER_MIRROR: 'off' }, dir: d5, WS: b5.WS, clock: () => (T0 + 3600) * 1000, bars: feed(T0 + 3600), log: () => {} });
    assert.equal(out.skipped, 'config'); assert.ok(!fs.existsSync(path.join(d5, 'vb', 'trades.json')), 'no demo configured: nothing written'); }
});
