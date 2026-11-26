// node --test tests/dom-demo.test.mjs: the H1 dominant-zone limit on the Council cTrader DEMO account (council/dom-demo.mjs, 23 Nov 2026)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { VARIANTS, LABEL, MAX_MARKET, MAX_TOTAL, LIFE_S, read, plan, armable, idOf, commentOf, inferExit, usdPer, step } from '../council/dom-demo.mjs';
import { PT } from '../council/ctrader-mirror.mjs';
import { execChecks } from '../council/forward.mjs';
import { COSTS } from '../research/edge/combo-grid-2/run.mjs';

const H = 3600, DAY = 86400, T0 = Date.UTC(2026, 10, 24, 12) / 1000;   // Tuesday 24 Nov 2026 12:00 UTC
// H1 rows: alternating colours (no DOM), then a DOM up pair (zone body 4000-4002), then candles above the zone, then the forming one
function rows({ after = 6, formClose = null, extra = [] } = {}) {
  const out = []; let t = T0 - 200 * H;
  const nPre = 200 - 2 - after - 1; for (let i = 0; i < nPre; i++, t += H) { const up = i % 2 === (nPre % 2 === 0 ? 0 : 1); const o = up ? 3999.5 : 4000.5, c = up ? 4000.5 : 3999.5; out.push([t, o, Math.max(o, c) + 1, Math.min(o, c) - 1, c]); }
  // the last filler candle is red, so the DOM's first (green) candle starts a new colour
  out.push([t, 4000, 4003, 3999, 4002]); t += H;      // first candle (green): body 4000-4002
  out.push([t, 4002, 4007, 4001.5, 4006]); t += H;    // second: green, closes 4006 > 4003, high 4007 > 4003
  for (let i = 0; i < after; i++, t += H) { const red = i % 2 === 0, o = red ? 4005 : 4004, c = red ? 4004 : 4005; out.push([t, o, Math.max(o, c) + 1, Math.min(o, c) - 1, c]); }
  for (const x of extra) { out.push([t, ...x]); t += H; }
  out.push([t, 4004, 4005, 4003.5, formClose == null ? 4004 : formClose]);   // forming
  return { rows: out, now: t + 1800 };
}
const ZT = (r) => r.rows.find((x) => x[1] === 4000 && x[4] === 4002)[0];

test('zone detection on closed H1 candles only: a forming second candle makes no zone; a close through the far side ends it', () => {
  const R = rows(); const r = read(R.rows, R.now);
  const z = r.zones.filter((x) => x.stands); assert.equal(z.length, 1); assert.deepEqual([z[0].side, z[0].bot, z[0].top, z[0].t], ['buy', 4000, 4002, ZT(R)]);
  // no look-ahead: cut so that the DOM's second candle is the forming one
  const cut = R.rows.slice(0, R.rows.findIndex((x) => x[4] === 4006) + 1), tc = cut[cut.length - 1][0] + 1800;
  assert.equal(read(cut, tc).zones.length, 0, 'the forming candle never completes a zone');
  assert.equal(read(cut, cut[cut.length - 1][0] + H).zones.length, 1, 'once it has closed, it does');
  // a closed candle under the body's bottom ends the zone; a forming one does not
  const F = rows({ extra: [[4003, 4003.5, 3995, 3996]] });
  assert.equal(read(F.rows, F.now).zones.filter((x) => x.stands).length, 0);
  const G = rows({ formClose: 3990 }); assert.equal(read(G.rows, G.now).zones.filter((x) => x.stands).length, 1);
  // mirrored: two red candles, the second closing under the first's low -> a sell zone on the first's body
  const S = [[0, 4002, 4003, 3999, 4000], [H, 4000, 4001, 3990, 3992], [2 * H, 3992, 3993, 3991, 3992.5]];
  const zs = read(S, 3 * H + 10).zones; assert.equal(zs.length, 1); assert.deepEqual([zs[0].side, zs[0].bot, zs[0].top], ['sell', 4000, 4002]);
});
test('arming: only a standing zone on the right side of the price, its near edge within 1 x ATR(14); stop / target values', () => {
  const R = rows(), r = read(R.rows, R.now); assert.ok(r.atr > 1 && r.atr < 4, `atr ${r.atr}`);
  assert.equal(armable('xau', r, new Set()).length, 1, 'price 4004, 2 above the top: within 1 ATR');
  assert.equal(armable('xau', r, new Set([idOf('xau', 'buy', ZT(R))])).length, 0, 'never twice');
  assert.equal(armable('xau', { ...r, price: 4002 + 1.01 * r.atr }, new Set()).length, 0, 'too far');
  assert.equal(armable('xau', { ...r, price: 4001 }, new Set()).length, 0, 'price inside or under a buy zone: wrong side');
  const P = plan({ side: 'buy', bot: 4000, top: 4002 }, 2, 0.3); assert.equal(P.entry, 4002); assert.ok(Math.abs(P.stop - (4000 - 0.15 - 0.5)) < 1e-9); assert.ok(Math.abs(P.target - (4002 + 2 * (4002 - P.stop))) < 1e-9);
  const Q = plan({ side: 'sell', bot: 4000, top: 4002 }, 2, 0.3); assert.equal(Q.entry, 4000); assert.ok(Q.stop > 4002 && Q.target < 4000);
  assert.equal(usdPer('JPY', { usdjpy: 150 }), 1 / 150); assert.equal(usdPer('GBP', { gbpusd: 1.3 }), 1.3); assert.equal(usdPer('JPY', {}), null);
});

// a fake demo broker: resting limit orders, fills on demand, reconcile, cancel, amend, close
function broker({ live = false, refuseAmend = false, offered = ['XAUUSD'] } = {}) {
  const b = { sent: [], positions: [], orders: [], next: 500 };
  b.fill = (id, price, { dropStop = false } = {}) => { const o = b.orders.find((x) => x.orderId === id); b.orders = b.orders.filter((x) => x !== o);
    b.positions.push({ positionId: 9000 + o.orderId, price, stopLoss: dropStop ? undefined : o.stopLoss, takeProfit: dropStop ? undefined : o.takeProfit, tradeData: { ...o.tradeData, openTimestamp: (T0 + 600) * 1000 } }); };
  b.WS = class { constructor() { setTimeout(() => this.onopen && this.onopen(), 0); }
    send(text) { const m = JSON.parse(text); b.sent.push(m); if (m.payloadType === PT.HEARTBEAT) return;
      const r = (payloadType, payload) => setTimeout(() => this.onmessage({ data: JSON.stringify({ clientMsgId: m.clientMsgId, payloadType, payload }) }), 0);
      const P = m.payload || {};
      switch (m.payloadType) {
        case PT.APP_AUTH_REQ: return r(PT.APP_AUTH_RES, {});
        case PT.ACCOUNTS_BY_TOKEN_REQ: return r(PT.ACCOUNTS_BY_TOKEN_RES, { ctidTraderAccount: b.accounts || [{ ctidTraderAccountId: 77, traderLogin: 49478137, isLive: live }] });
        case PT.ACCOUNT_AUTH_REQ: return r(PT.ACCOUNT_AUTH_RES, {});
        case PT.TRADER_REQ: return r(PT.TRADER_RES, { trader: { balance: 1000000, moneyDigits: 2 } });   // $10,000
        case PT.SYMBOLS_LIST_REQ: return r(PT.SYMBOLS_LIST_RES, { symbol: offered.map((n, i) => ({ symbolId: 41 + i, symbolName: n })) });
        case PT.SYMBOL_BY_ID_REQ: return r(PT.SYMBOL_BY_ID_RES, { symbol: [b.info || { symbolId: P.symbolId[0], digits: 2, stepVolume: 1, minVolume: 1, maxVolume: 1e9 }] });
        case PT.NEW_ORDER_REQ: { const o = { orderId: b.next++, orderType: P.orderType, limitPrice: P.limitPrice, stopLoss: P.stopLoss, takeProfit: P.takeProfit, expirationTimestamp: P.expirationTimestamp, tradeData: { symbolId: P.symbolId, volume: P.volume, tradeSide: P.tradeSide, label: P.label, comment: P.comment } }; b.orders.push(o); return r(PT.EXECUTION_EVENT, { executionType: 2, order: o }); }
        case PT.CANCEL_ORDER_REQ: { const had = b.orders.some((x) => x.orderId === P.orderId); b.orders = b.orders.filter((x) => x.orderId !== P.orderId); return r(PT.EXECUTION_EVENT, { executionType: had ? 5 : 8 }); }
        case PT.RECONCILE_REQ: return r(PT.RECONCILE_RES, { position: b.positions.map((x) => ({ ...x })), order: b.orders.map((x) => ({ ...x })) });
        case PT.AMEND_POSITION_SLTP_REQ: { if (refuseAmend) return r(PT.EXECUTION_EVENT, { executionType: 7, errorCode: 'NO' }); const p = b.positions.find((x) => x.positionId === P.positionId); if (p) { p.stopLoss = P.stopLoss; p.takeProfit = P.takeProfit; } return r(PT.EXECUTION_EVENT, { executionType: 4 }); }
        case PT.CLOSE_POSITION_REQ: { const p = b.positions.find((x) => x.positionId === P.positionId); b.positions = b.positions.filter((x) => x !== p); r(PT.EXECUTION_EVENT, { executionType: 2 }); return r(PT.EXECUTION_EVENT, { executionType: 3, deal: { executionPrice: p.price } }); }
        default: return r(PT.ERROR_RES, { errorCode: 'X' });
      } }
    close() {} };
  return b;
}
const ENV = { CTRADER_MIRROR: 'on', CTRADER_ENV: 'demo', CTRADER_CLIENT_ID: 'id', CTRADER_CLIENT_SECRET: 'sec', CTRADER_ACCESS_TOKEN: 'tok', CTRADER_ACCOUNT_ID: '49478137' };
function setup(cfg, seed) { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dom-')); if (cfg) fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(cfg));
  if (seed) { fs.mkdirSync(path.join(dir, 'dom')); fs.writeFileSync(path.join(dir, 'dom', 'trades.json'), JSON.stringify({ trades: seed })); } return dir; }
const file = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'dom', 'trades.json'), 'utf8'));
const go = (dir, b, R, extra = {}) => step({ env: ENV, dir, WS: b.WS, clock: () => R.now * 1000, bars: async (k) => (k === 'xau' ? R.rows : k === 'eurjpy' && extra.eur ? extra.eur.rows : []), log: () => {}, ...extra });
const news = (b) => b.sent.filter((m) => m.payloadType === PT.NEW_ORDER_REQ).map((m) => m.payload);

test('an order: a LIMIT at the near edge WITH stopLoss and takeProfit, label dom, 24 h; one order per zone, ever', async () => {
  const R = rows(), r = read(R.rows, R.now), dir = setup(), b = broker(); await go(dir, b, R);
  const o = news(b); assert.equal(o.length, 1); const P = plan({ side: 'buy', bot: 4000, top: 4002 }, r.atr, COSTS.xau), at = (v) => +v.toFixed(2);
  assert.equal(o[0].orderType, 2); assert.equal(o[0].tradeSide, 1); assert.equal(o[0].limitPrice, 4002); assert.equal(o[0].stopLoss, at(P.stop)); assert.equal(o[0].takeProfit, at(P.target));
  assert.ok(o[0].stopLoss < o[0].limitPrice && o[0].takeProfit > o[0].limitPrice); assert.equal(o[0].label, LABEL); assert.equal(o[0].comment, commentOf(idOf('xau', 'buy', ZT(R))));
  assert.equal(o[0].timeInForce, 1); assert.equal(o[0].expirationTimestamp, (R.now + LIFE_S) * 1000); assert.equal(o[0].ctidTraderAccountId, 77);
  // size: 0.5 % of $10,000 = $50 at the stop; one ounce = volume 100
  const loss = (o[0].volume / 100) * (o[0].limitPrice - o[0].stopLoss); assert.ok(loss <= 50 + 1e-6 && loss > 49, `risks $${loss}`);
  const J = file(dir); assert.equal(J.trades[0].status, 'placed'); assert.ok(!JSON.stringify(J).includes('49478137'), 'the account number is never written');
  await go(dir, b, { ...R, now: R.now + 60 }); assert.equal(news(b).length, 1, 'never placed twice');
  // a lost record: the order at the broker is adopted, not placed again
  fs.rmSync(path.join(dir, 'dom', 'trades.json')); await go(dir, b, { ...R, now: R.now + 120 }); assert.equal(news(b).length, 1); assert.equal(file(dir).trades[0].adopted, true);
});
test('24 Nov 2026: the job moved to the demo account ending 6154 at 1 %: found by its login tail, old records of the Council account left alone', async () => {
  const R = rows(), b = broker(); b.accounts = [{ ctidTraderAccountId: 77, traderLogin: 49478137, isLive: false }, { ctidTraderAccountId: 88, traderLogin: 50116154, isLive: false }, { ctidTraderAccountId: 99, traderLogin: 70006154, isLive: true }];
  const old = { id: 'old-zone', market: 'xau', side: 'buy', status: 'placed', entry: 1, stop: 0.5, target: 2, zone: { t: 1, bot: 1, top: 1 }, placedAt: new Date((R.now - 600) * 1000).toISOString(), expiresAt: R.now + 3600 };
  const dir = setup({ dom: { account: '*6154', risk: 0.01 } }, [old]); await go(dir, b, R);
  const o = news(b); assert.equal(o.length, 1); assert.equal(o[0].ctidTraderAccountId, 88, 'the one DEMO account whose login ends 6154 (a live one with the same tail is never taken)');
  const loss = (o[0].volume / 100) * (o[0].limitPrice - o[0].stopLoss); assert.ok(loss <= 100 + 1e-6 && loss > 99, `1 % of $10,000 = $100 at the stop, risked $${loss}`);
  const J = file(dir); assert.equal(J.trades.find((x) => x.id === 'old-zone').status, 'placed', 'a record of the old account is not read or cancelled');
  assert.equal(J.trades.find((x) => x.id !== 'old-zone').acct, '…6154'); assert.ok(!JSON.stringify(J).includes('50116154'), 'the account number is never written');
  const b2 = broker(); b2.accounts = [{ ctidTraderAccountId: 1, traderLogin: 1116154, isLive: false }, { ctidTraderAccountId: 2, traderLogin: 2226154, isLive: false }];
  const d2 = setup({ dom: { account: '*6154' } }); await go(d2, b2, R); assert.equal(news(b2).length, 0, 'two demo accounts with that tail: refused, nothing sent');
  const c = file(d2).conn; assert.ok(c && c.error && c.acct === '…6154', 'a refused connection is written down once, with the tag only');
  const at = c.since; await go(d2, b2, R); assert.equal(file(d2).conn.since, at, 'the same refusal again does not rewrite the file');
  await go(d2, b, R); assert.ok(file(d2).conn.ok, 'back once the account is found');
});
test('the zone fails while the order rests: cancelled at once; an order past its 24 h: expired, never re-armed', async () => {
  { const R = rows(), dir = setup(), b = broker(); await go(dir, b, R);
    const F = rows({ extra: [[4003, 4003.5, 3995, 3996]] }); await go(dir, b, F);
    assert.equal(b.orders.length, 0); assert.equal(file(dir).trades[0].status, 'cancelled'); }
  { const R = rows(), dir = setup(), b = broker(); await go(dir, b, R); await go(dir, b, { ...R, now: R.now + LIFE_S + 10 });
    assert.equal(file(dir).trades[0].status, 'expired'); assert.equal(b.orders.length, 0); const n = news(b).length; await go(dir, b, { ...R, now: R.now + LIFE_S + 70 }); assert.equal(news(b).length, n, 'not re-armed'); }
  { const R = rows(), dir = setup(), b = broker(); await go(dir, b, R); b.orders = []; await go(dir, b, { ...R, now: R.now + LIFE_S }); assert.equal(file(dir).trades[0].status, 'expired', 'the broker removed it at its expiry'); }
});
test('RULE 1: a fill without a stop gets it by amend; refused -> closed at once; a stray dom position without a stop is closed', async () => {
  for (const refuseAmend of [false, true]) { const R = rows(), dir = setup(), b = broker({ refuseAmend }); await go(dir, b, R);
    b.fill(b.orders[0].orderId, 4002, { dropStop: true }); await go(dir, b, { ...R, now: R.now + 60 }); const t = file(dir).trades[0];
    if (!refuseAmend) { assert.equal(t.status, 'open'); assert.equal(t.stopSetBy, 'amend'); assert.equal(b.positions[0].stopLoss, t.stop); assert.equal(b.positions[0].takeProfit, t.target); }
    else { assert.equal(t.status, 'closed'); assert.match(t.how, /took no stop/); assert.equal(b.positions.length, 0); } }
  { const R = rows(), dir = setup(), b = broker(); await go(dir, b, R); b.positions.push({ positionId: 1, price: 1, tradeData: { label: 'dom', comment: 'dom lost-1', volume: 100, tradeSide: 1 } });
    await go(dir, b, { ...R, now: R.now + 60 }); assert.ok(!b.positions.some((p) => p.positionId === 1)); }
  { const R = rows(), dir = setup(), b = broker(); await go(dir, b, R); b.positions.push({ positionId: 2, price: 1, tradeData: { label: 'council', comment: 'council x', volume: 100, tradeSide: 1 } });
    await go(dir, b, { ...R, now: R.now + 60 }); assert.ok(b.positions.some((p) => p.positionId === 2), 'never touches the mirror\'s label'); }
});
test('a position gone at the broker is closed with its exit inferred from the H1 candles (marked inferred)', async () => {
  const R = rows(), dir = setup(), b = broker(); await go(dir, b, R); const t0 = file(dir).trades[0];
  b.fill(b.orders[0].orderId, 4002); await go(dir, b, { ...R, now: R.now + 60 }); assert.equal(file(dir).trades[0].status, 'open');
  b.positions = []; const up = rows({ extra: [[4005, t0.target + 1, 4004, t0.target + 0.5]] });
  await go(dir, b, { ...up, now: up.now }); const t = file(dir).trades[0];
  assert.equal(t.status, 'closed'); assert.equal(t.inferred, true); assert.equal(t.exit, t0.target); assert.equal(t.R, +((t0.target - 4002) / (4002 - t0.stop)).toFixed(3));
  assert.equal(inferExit({ side: 'buy', stop: 3990, target: 4010 }, [{ e: 10, l: 3989, h: 4011 }], 0).exit, 3990, 'stop first in one candle');
});
test('caps: at most 3 a market; config off; a live account; nothing due does not connect; a market the broker does not offer is skipped', async () => {
  { const R = rows(), seed = [], b = broker();
    for (let i = 0; i < MAX_MARKET; i++) { const id = `xau-buy-${i}`; seed.push({ id, market: 'xau', side: 'buy', status: 'open', entry: 4002, stop: 3999, target: 4008, zone: { t: i } });
      b.positions.push({ positionId: 100 + i, price: 4002, stopLoss: 3999, takeProfit: 4008, tradeData: { label: 'dom', comment: commentOf(id), volume: 100, tradeSide: 1 } }); }
    const dir = setup(null, seed); await go(dir, b, R); assert.equal(news(b).length, 0, '3 already open on gold'); }
  { const R = rows(), seed = Array.from({ length: MAX_TOTAL }, (_, i) => ({ id: `m${i}-buy-1`, market: 'm' + i, side: 'buy', status: 'open', entry: 1, stop: 0.5, target: 2, zone: { t: 1 } })), b = broker();
    for (const x of seed) b.positions.push({ positionId: x.id, price: 1, stopLoss: 0.5, tradeData: { label: 'dom', comment: commentOf(x.id), volume: 100, tradeSide: 1 } });
    const dir = setup(null, seed); await go(dir, b, R); assert.equal(news(b).length, 0, 'MAX_TOTAL on the account'); }
  { const R = rows(), dir = setup({ dom: { on: false } }), b = broker(); const out = await go(dir, b, R); assert.equal(out.skipped, 'off'); assert.equal(b.sent.length, 0); }
  { const R = rows(), dir = setup(), b = broker({ live: true }); await go(dir, b, R); assert.equal(news(b).length, 0, 'not a demo account: refused'); }
  { const R = rows({ formClose: 4012 }), dir = setup(), b = broker(); const out = await go(dir, b, R); assert.equal(out.skipped, 'nothing due'); assert.equal(b.sent.length, 0, 'no zone near the price, nothing resting: no connection'); }
  { const R = rows(), dir = setup(), b = broker(); const out = await step({ env: { ...ENV, CTRADER_ENV: 'live' }, dir, WS: b.WS, clock: () => R.now * 1000, bars: async () => R.rows, log: () => {} }); assert.equal(out.skipped, 'config'); assert.equal(b.sent.length, 0); }
  { const R = rows(), E = { rows: R.rows.map((x) => [x[0], x[1] / 4000, x[2] / 4000, x[3] / 4000, x[4] / 4000]), now: R.now }, dir = setup(), b = broker();
    await go(dir, b, R, { eur: E }); assert.deepEqual(news(b).map((x) => x.comment.split('-')[0]), ['dom xau']); const J = file(dir); assert.ok(J.notOffered.eurjpy, 'EUR/JPY not offered: logged and held off a day');
    const n = b.sent.length; await go(dir, b, { ...R, now: R.now + 60 }, { eur: E }); assert.equal(news(b).length, 1); assert.ok(b.sent.length > n); }
});
test('forward.mjs E5 leaves the dom job out (label on positions and orders, its ids for closing deals); a stranger is still flagged', () => {
  const at = new Date((Date.UTC(2026, 10, 20) / 1000) * 1000).toISOString();
  const accounts = { accounts: [{ books: ['council'], open: [{ id: '9001', symbol: 'XAUUSD', side: 'buy', openedAt: at, label: 'dom' }, { id: '777', symbol: 'EURUSD', side: 'sell', openedAt: at, label: null }],
    orders: [{ id: '501', symbol: 'XAUUSD', side: 'buy', price: 4002, label: 'dom' }], history: [{ id: 'd1', positionId: '9002', symbol: 'XAUUSD', side: 'sell', closedAt: at }] }] };
  const dom = { trades: [{ id: 'xau-buy-1', positionId: '9002', orderId: '502' }] };
  const e = execChecks({ rows: [], mirrors: [], accounts, prev: null, now: Date.UTC(2026, 10, 21) / 1000, dom });
  assert.deepEqual(e.foreign.map((f) => f.id), ['777']);
  const e2 = execChecks({ rows: [], mirrors: [], accounts, prev: null, now: Date.UTC(2026, 10, 21) / 1000 });
  assert.deepEqual(e2.foreign.map((f) => f.id).sort(), ['777', '9002'], 'without the dom file a closing deal has no label to go by');
});
test('wiring: demo only, its own label, the loop runs it under a timeout after the breakout job, no live import', () => {
  const src = fs.readFileSync(new URL('../council/dom-demo.mjs', import.meta.url), 'utf8'), yml = fs.readFileSync(new URL('../.github/workflows/council.yml', import.meta.url), 'utf8');
  assert.match(src, /CTRADER_ENV\)\.trim\(\)\.toLowerCase\(\) !== 'demo'/); assert.ok(src.includes("import { connect, accountFor } from './gotobi.mjs'"));
  assert.equal((yml.match(/timeout 45 node council\/dom-demo\.mjs data \|\| echo/g) || []).length, 2, 'the round and the quick pass');
  const m = src.match(/const order = \{[^}]*\}/); assert.ok(m && /stopLoss: stop/.test(m[0]) && /takeProfit: target/.test(m[0]) && /label: V\.label/.test(m[0]));
  assert.equal(src.match(/PT\.NEW_ORDER_REQ/g).length, 1);
  const tr = fs.readFileSync(new URL('../council/trader.mjs', import.meta.url), 'utf8'); assert.match(tr, /dom: rd\('dom\/trades\.json', null\)/);
});

test('26 Nov 2026, gold DOM 4R: gold only, a 4R target, its own label, file and account; the base job and it never touch each other', async () => {
  const R = rows(), r = read(R.rows, R.now), b = broker({ offered: ['XAUUSD', 'EURJPY'] });
  b.accounts = [{ ctidTraderAccountId: 77, traderLogin: 49478137, isLive: false }, { ctidTraderAccountId: 55, traderLogin: 10152146, isLive: false }];
  const dir = setup(); fs.mkdirSync(path.join(dir, 'ctrader')); fs.writeFileSync(path.join(dir, 'ctrader', 'mirror-accounts.json'), JSON.stringify({ groups: [{ account: '10152146', books: ['shadow', 'lit'] }] }));
  await go(dir, b, R, { variant: 'gold4r', eur: R });
  const o = news(b); assert.equal(o.length, 1, 'gold only: the EUR/JPY zone gives no order'); const W = VARIANTS.gold4r;
  const P = plan({ side: 'buy', bot: 4000, top: 4002 }, r.atr, COSTS.xau, 4), at = (v) => +v.toFixed(2);
  assert.equal(o[0].label, 'dom4'); assert.notEqual(W.label, LABEL); assert.equal(o[0].comment, 'dom4 ' + idOf('xau', 'buy', ZT(R)));
  assert.equal(o[0].ctidTraderAccountId, 55, 'the Shadows + LIT demo account, not the base job account'); assert.equal(o[0].limitPrice, 4002);
  assert.equal(o[0].stopLoss, at(P.stop)); assert.ok(o[0].stopLoss < o[0].limitPrice, 'a stop on the losing side');
  assert.ok(Math.abs((o[0].takeProfit - o[0].limitPrice) / (o[0].limitPrice - o[0].stopLoss) - 4) < 0.01, 'target 4R');
  const loss = (o[0].volume / 100) * (o[0].limitPrice - o[0].stopLoss); assert.ok(loss <= 25 + 1e-6 && loss > 24, `0.25 % of $10,000 = $25, risked $${loss}`);
  const J = JSON.parse(fs.readFileSync(path.join(dir, 'dom4', 'trades.json'), 'utf8')); assert.equal(J.trades[0].status, 'placed'); assert.ok(!fs.existsSync(path.join(dir, 'dom', 'trades.json')));
  assert.ok(!JSON.stringify(J).includes('10152146'), 'the account number is never written');
  await go(dir, b, { ...R, now: R.now + 60 }, { variant: 'gold4r' }); assert.equal(news(b).length, 1, 'never placed twice');
  // the base job on its own account places its own 2R order and leaves the dom4 order alone
  await go(dir, b, { ...R, now: R.now + 120 }); const all = news(b); assert.equal(all.length, 2); assert.equal(all[1].label, LABEL); assert.equal(all[1].ctidTraderAccountId, 77);
  assert.ok(!b.sent.some((m) => m.payloadType === PT.CANCEL_ORDER_REQ), 'neither cancels the order of the other');
  // off switch, a live account, an unknown variant
  const d2 = setup({ dom4: { on: false } }); assert.deepEqual(await go(d2, broker(), R, { variant: 'gold4r' }), { skipped: 'off' });
  const d3 = setup({ dom4: { account: '49478137' } }), bl = broker({ live: true }); await go(d3, bl, R, { variant: 'gold4r' }); assert.equal(news(bl).length, 0, 'a live account: nothing sent');
  await assert.rejects(() => go(setup(), broker(), R, { variant: 'nope' }));
  const yml = fs.readFileSync(new URL('../.github/workflows/council.yml', import.meta.url), 'utf8'); assert.equal((yml.match(/dom-demo\.mjs data --variant gold4r \|\|/g) || []).length, 2);
});
