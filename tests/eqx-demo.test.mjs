// node --test tests/eqx-demo.test.mjs: four Equinox rules on the cTrader DEMO account 10152144 (council/eqx-demo.mjs, 24 Nov 2026)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LABEL, ACCOUNT, MAX_OPEN, FRESH_S, LATE_R, DESKS, commentOf, feed, signals, lateCheck, inferExit, recCount, step } from '../council/eqx-demo.mjs';
import { PT } from '../council/ctrader-mirror.mjs';
import { execChecks } from '../council/forward.mjs';

const T0 = Date.UTC(2026, 10, 24, 12, 2) / 1000;   // Tuesday 24 Nov 2026 12:02 UTC
// 5-minute gold rows: a seeded random walk over 8 days, the last one forming
function walkRows(seed = 7, n = 8 * 288, end = T0, p0 = 4000, step = 1.2) {
  let s = seed; const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const out = []; let p = p0, t = Math.floor(end / 300) * 300 - (n - 1) * 300;
  for (let i = 0; i < n; i++, t += 300) { const o = p, c = o + (rnd() - 0.5) * 2 * step; out.push([t, o, Math.max(o, c) + rnd() * step, Math.min(o, c) - rnd() * step, c]); p = c; }
  return out;
}
const flat = (px = 4000, end = T0) => walkRows(1, 400, end, px, 0.01);

// a fake demo broker: market orders fill at once, reconcile, amend, close
function broker({ live = false, refuseAmend = false, dropStop = false, offered = ['XAUUSD', 'EURUSD'] } = {}) {
  const b = { sent: [], positions: [], orders: [], next: 500 };
  b.WS = class { constructor() { setTimeout(() => this.onopen && this.onopen(), 0); }
    send(text) { const m = JSON.parse(text); b.sent.push(m); if (m.payloadType === PT.HEARTBEAT) return;
      const r = (payloadType, payload) => setTimeout(() => this.onmessage({ data: JSON.stringify({ clientMsgId: m.clientMsgId, payloadType, payload }) }), 0);
      const P = m.payload || {};
      switch (m.payloadType) {
        case PT.APP_AUTH_REQ: return r(PT.APP_AUTH_RES, {});
        case PT.ACCOUNTS_BY_TOKEN_REQ: return r(PT.ACCOUNTS_BY_TOKEN_RES, { ctidTraderAccount: [{ ctidTraderAccountId: 77, traderLogin: 10152144, isLive: live }] });
        case PT.ACCOUNT_AUTH_REQ: return r(PT.ACCOUNT_AUTH_RES, {});
        case PT.TRADER_REQ: return r(PT.TRADER_RES, { trader: { balance: 1000000, moneyDigits: 2 } });   // $10,000
        case PT.SYMBOLS_LIST_REQ: return r(PT.SYMBOLS_LIST_RES, { symbol: offered.map((n, i) => ({ symbolId: 41 + i, symbolName: n })) });
        case PT.SYMBOL_BY_ID_REQ: return r(PT.SYMBOL_BY_ID_RES, { symbol: [{ symbolId: P.symbolId[0], digits: 2, stepVolume: 1, minVolume: 1, maxVolume: 1e9 }] });
        case PT.NEW_ORDER_REQ: { const id = b.next++, td = { symbolId: P.symbolId, volume: P.volume, tradeSide: P.tradeSide, label: P.label, comment: P.comment };
          if (P.orderType === 1) { const px = b.px || 4000, s = P.tradeSide === 1 ? 1 : -1, pos = { positionId: 9000 + id, price: px, stopLoss: dropStop ? undefined : +(px - s * P.relativeStopLoss / 100000).toFixed(2), takeProfit: P.relativeTakeProfit ? +(px + s * P.relativeTakeProfit / 100000).toFixed(2) : undefined, tradeData: td };
            b.positions.push(pos); return r(PT.EXECUTION_EVENT, { executionType: 3, position: pos, deal: { executionPrice: px } }); }
          const o = { orderId: id, orderType: P.orderType, stopPrice: P.stopPrice, stopLoss: P.stopLoss, tradeData: td }; b.orders.push(o); return r(PT.EXECUTION_EVENT, { executionType: 2, order: o }); }
        case PT.CANCEL_ORDER_REQ: { b.orders = b.orders.filter((x) => x.orderId !== P.orderId); return r(PT.EXECUTION_EVENT, { executionType: 5 }); }
        case PT.RECONCILE_REQ: return r(PT.RECONCILE_RES, { position: b.positions.map((x) => ({ ...x })), order: b.orders.map((x) => ({ ...x })) });
        case PT.AMEND_POSITION_SLTP_REQ: { if (refuseAmend) return r(PT.EXECUTION_EVENT, { executionType: 7, errorCode: 'NO' }); const p = b.positions.find((x) => x.positionId === P.positionId); if (p) { p.stopLoss = P.stopLoss; p.takeProfit = P.takeProfit; } return r(PT.EXECUTION_EVENT, { executionType: 4 }); }
        case PT.CLOSE_POSITION_REQ: { const p = b.positions.find((x) => x.positionId === P.positionId); b.positions = b.positions.filter((x) => x !== p); r(PT.EXECUTION_EVENT, { executionType: 2 }); return r(PT.EXECUTION_EVENT, { executionType: 3, deal: { executionPrice: p ? p.price : null } }); }
        default: return r(PT.ERROR_RES, { errorCode: 'X' });
      } }
    close() {} };
  return b;
}
const ENV = { CTRADER_MIRROR: 'on', CTRADER_ENV: 'demo', CTRADER_CLIENT_ID: 'id', CTRADER_CLIENT_SECRET: 'sec', CTRADER_ACCESS_TOKEN: 'tok' };
function setup(cfg = { eqx: { desks: ['fade'] } }, seed) { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eqx-')); fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(cfg));
  if (seed) { fs.mkdirSync(path.join(dir, 'eqx')); fs.writeFileSync(path.join(dir, 'eqx', 'trades.json'), JSON.stringify({ trades: seed })); } return dir; }
const file = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'eqx', 'trades.json'), 'utf8'));
const news = (b) => b.sent.filter((m) => m.payloadType === PT.NEW_ORDER_REQ).map((m) => m.payload);
// a stand-in for the fade desk's reader: one signal per entry of `sigs` (buy, fill candle t), so the broker logic is tested alone
function withFake(sigs, fn) { const real = DESKS.fade.read;
  DESKS.fade.read = (B, { market }) => sigs.filter((x) => (x.market || 'xau') === market).map((x) => ({ id: x.id, side: x.side ?? 1, t: x.t ?? Math.floor(T0 / 300) * 300, entry: x.entry ?? 4000, stop: x.stop ?? 3990, target: x.target === undefined ? 4020 : x.target, status: 'open', log: [] }));
  return Promise.resolve(fn()).finally(() => { DESKS.fade.read = real; }); }
const go = (dir, b, { now = T0, px = 4000, rows } = {}) => { b.px = px; return step({ env: ENV, dir, WS: b.WS, clock: () => now * 1000, bars: async (k) => rows || (k === 'xau' ? flat(px, now) : []), log: () => {}, pause: async () => {} }); };

test('the desks\' own code on live candles: closed candles + the forming open; every fresh signal has its stop on the losing side', () => {
  const rows = walkRows(11), now = rows[rows.length - 1][0] + 120, B = feed(rows, now)['5m'];
  assert.equal(B.length, rows.length); const f = B[B.length - 1]; assert.ok(f.high === f.open && f.low === f.open && f.close === f.open, 'the forming candle is its open alone');
  let n = 0;
  for (const seed of [3, 5, 11, 19, 23, 29]) { const R = walkRows(seed);
    for (let cut = R.length - 300; cut <= R.length; cut += 7) { const part = R.slice(0, cut), t = part[part.length - 1][0] + 60;
      for (const d of Object.keys(DESKS)) for (const g of signals(d, 'xau', part, t)) { n++;
        assert.ok(g.side * (g.entry - g.stop) > 0, `${g.id}: stop on the losing side`); assert.ok(t - g.t <= FRESH_S && g.t <= t, 'fresh');
        if (g.target != null) assert.ok(g.side * (g.target - g.entry) > 0); assert.equal(g.deadline, g.t + DESKS[d].cap); } } }
  assert.ok(n > 0, 'the walks give some signals');
});
test('late-copy check: past the stop, past the target, or more than LATE_R into the trade is refused', () => {
  const g = { side: 1, entry: 4000, stop: 3990, target: 4020 };
  assert.equal(lateCheck(g, 4000), null); assert.equal(lateCheck(g, 4000 + 10 * LATE_R), null); assert.match(lateCheck(g, 4000 + 10 * LATE_R + 0.1), /into the trade/);
  assert.match(lateCheck(g, 3990), /past the stop/); assert.match(lateCheck(g, 4021), /past the target/);
  assert.match(lateCheck({ side: -1, entry: 4000, stop: 3990, target: 3980 }, 4000), /losing side/);
  assert.equal(lateCheck({ side: -1, entry: 4000, stop: 4010, target: 3980 }, 3999), null);
});
test('an order: MARKET with its stop and target as distances, label eqx, comment eqx <desk> <id>, 0.25 %; one order per id ever', () => withFake([{ id: 'fade-m15-b1' }], async () => {
  const dir = setup(), b = broker(); await go(dir, b);
  const o = news(b); assert.equal(o.length, 1); assert.equal(o[0].orderType, 1); assert.equal(o[0].tradeSide, 1); assert.equal(o[0].label, LABEL); assert.equal(o[0].comment, commentOf('fade', 'fade-m15-b1'));
  const px = file(dir).trades[0].price; assert.equal(o[0].relativeStopLoss, Math.round((px - 3990) * 100) * 1000); assert.equal(o[0].relativeTakeProfit, Math.round((4020 - px) * 100) * 1000);
  const loss = (o[0].volume / 100) * (px - 3990); assert.ok(loss <= 25 + 1e-6 && loss > 24, `risks $${loss}`);   // 0.25 % of $10,000
  const t = file(dir).trades[0]; assert.equal(t.status, 'open'); assert.equal(t.desk, 'fade'); assert.ok(Math.abs(b.positions[0].stopLoss - 3990) < 0.1, 'the stop at the rule\'s distance from the fill');
  assert.ok(!JSON.stringify(file(dir)).includes(ACCOUNT), 'the account number is never written');
  await go(dir, b, { now: T0 + 60 }); assert.equal(news(b).length, 1, 'never twice');
}));
test('freshness: a signal whose fill candle opened more than FRESH_S ago is not taken; a late price is recorded skip', async () => {
  await withFake([{ id: 'old', t: Math.floor(T0 / 300) * 300 - FRESH_S - 300 }], async () => { const dir = setup(), b = broker(); const out = await go(dir, b); assert.equal(news(b).length, 0); assert.equal(out.did.length, 0); });
  await withFake([{ id: 'late' }], async () => { const dir = setup(), b = broker(); await go(dir, b, { px: 4004 }); assert.equal(news(b).length, 0); const t = file(dir).trades[0]; assert.equal(t.status, 'skip'); assert.match(t.why, /into the trade/);
    await go(dir, b, { px: 4000, now: T0 + 60 }); assert.equal(news(b).length, 0, 'a skipped id is never placed later'); });
});
test('cap: at most 30 eqx items; only label eqx is counted (ICT copies on the account are not); at the cap: skip: cap', async () => {
  const ids = Array.from({ length: 31 }, (_, i) => ({ id: `s${i}` }));
  await withFake(ids, async () => { const dir = setup(), b = broker();
    for (let i = 0; i < 40; i++) b.positions.push({ positionId: i + 1, price: 4000, stopLoss: 3990, tradeData: { label: 'ict', comment: `ict x${i}`, volume: 100, tradeSide: 1 } });
    await go(dir, b); assert.equal(news(b).length, MAX_OPEN); const J = file(dir); assert.equal(J.trades.filter((x) => x.why === 'cap').length, 1);
    assert.equal(b.positions.filter((p) => p.tradeData.label === 'ict').length, 40, 'ICT copies untouched'); assert.equal(recCount(J), MAX_OPEN); });
});
test('RULE 1: a fill without a stop gets it by amend; refused -> closed at once; a stray eqx position without a stop is closed; ict never touched', async () => {
  for (const refuseAmend of [false, true]) await withFake([{ id: 'a1' }], async () => { const dir = setup(), b = broker({ dropStop: true, refuseAmend }); await go(dir, b); const t = file(dir).trades[0];
    if (!refuseAmend) { assert.equal(t.status, 'open'); assert.equal(t.stopSetBy, 'amend'); assert.equal(b.positions[0].stopLoss, 3990); }
    else { assert.equal(t.status, 'closed'); assert.match(t.how, /took no stop/); assert.equal(b.positions.length, 0); } });
  await withFake([{ id: 'a2' }], async () => { const dir = setup(), b = broker();
    b.positions.push({ positionId: 1, price: 1, tradeData: { label: 'eqx', comment: 'eqx fade lost', volume: 100, tradeSide: 1 } }, { positionId: 2, price: 1, tradeData: { label: 'ict', comment: 'ict y', volume: 100, tradeSide: 1 } });
    await go(dir, b); assert.ok(!b.positions.some((p) => p.positionId === 1), 'the stray eqx position is closed'); assert.ok(b.positions.some((p) => p.positionId === 2), 'the ICT copy is left alone'); });
});
test('exits: the rule\'s time limit closes at market; a position gone at the broker is closed with its exit inferred', async () => {
  await withFake([{ id: 'x1' }], async () => { const dir = setup(), b = broker(); await go(dir, b); const t0 = file(dir).trades[0];
    await go(dir, b, { now: t0.deadline + 30 }); const t = file(dir).trades[0]; assert.equal(t.status, 'closed'); assert.equal(t.how, 'time exit'); assert.equal(b.positions.length, 0); });
  await withFake([{ id: 'x2' }], async () => { const dir = setup(), b = broker(); await go(dir, b); b.positions = [];
    const now = T0 + 900, rows = flat(4000, now); rows[rows.length - 2] = [rows[rows.length - 2][0], 4000, 4021, 3999, 4019];
    await go(dir, b, { now, rows }); const t = file(dir).trades[0]; assert.equal(t.status, 'closed'); assert.equal(t.inferred, true); assert.equal(t.exit, 4020); assert.equal(t.R, 2); });
  assert.equal(inferExit({ side: 1, stop: 3990, target: 4010 }, [[0, 4000, 4011, 3989, 4000]], -1000).exit, 3990, 'stop first in one candle');
});
test('demo locks and switches: a live account refused; CTRADER_ENV live refused; config off; nothing due does not connect', async () => {
  await withFake([{ id: 'l1' }], async () => { const dir = setup(), b = broker({ live: true }); await go(dir, b); assert.equal(news(b).length, 0); });
  await withFake([{ id: 'l2' }], async () => { const dir = setup(), b = broker(); const out = await step({ env: { ...ENV, CTRADER_ENV: 'live' }, dir, WS: b.WS, clock: () => T0 * 1000, bars: async () => flat(), log: () => {} }); assert.equal(out.skipped, 'config'); assert.equal(b.sent.length, 0); });
  { const dir = setup({ eqx: { on: false } }), b = broker(); const out = await go(dir, b); assert.equal(out.skipped, 'off'); assert.equal(b.sent.length, 0); }
  await withFake([], async () => { const dir = setup(), b = broker(); await go(dir, b); assert.equal(b.sent.length, 0); });
});
test('gold breakout: vb-demo\'s own step on this account under label eqx, recorded in eqx/trades.json; vb\'s own file untouched', async () => {
  const now = Date.UTC(2026, 10, 24, 0, 5) / 1000, rows = flat(4000, now).map((r, i, a) => (i < a.length - 3 ? [r[0], r[1], r[1] + (r[0] % 86400 === 0 ? 0 : 3), r[1] - 3, r[1]] : r));
  const dir = setup({ eqx: { desks: ['goldvb'] } }), b = broker(); await go(dir, b, { now, rows });
  const o = news(b); assert.equal(o.length, 2); assert.ok(o.every((x) => x.label === LABEL && x.comment === 'eqx goldvb xau-2026-11-24' && x.stopLoss > 0 && x.orderType === 3));
  assert.ok(o[0].stopLoss < o[0].stopPrice && o[1].stopLoss > o[1].stopPrice, 'stop on the losing side of each stop order');
  const J = file(dir); assert.equal(J.trades[0].market, 'goldvb'); assert.equal(J.trades[0].status, 'placed'); assert.ok(!fs.existsSync(path.join(dir, 'vb', 'trades.json')));
  assert.equal(recCount(J), 2, 'two resting orders count two toward the cap');
});
test('forward.mjs E5 ignores label eqx; wiring: the loop runs it after the dom job under a timeout', () => {
  const at = new Date(Date.UTC(2026, 10, 20) * 1).toISOString();
  const accounts = { accounts: [{ books: ['council'], open: [{ id: '1', symbol: 'XAUUSD', side: 'buy', openedAt: at, label: 'eqx' }, { id: '2', symbol: 'EURUSD', side: 'sell', openedAt: at, label: null }], orders: [], history: [] }] };
  assert.deepEqual(execChecks({ rows: [], mirrors: [], accounts, prev: null, now: Date.UTC(2026, 10, 21) / 1000 }).foreign.map((f) => f.id), ['2']);
  const yml = fs.readFileSync(new URL('../.github/workflows/council.yml', import.meta.url), 'utf8'), src = fs.readFileSync(new URL('../council/eqx-demo.mjs', import.meta.url), 'utf8');
  assert.equal((yml.match(/timeout 45 node council\/eqx-demo\.mjs data \|\| echo/g) || []).length, 2, 'the round and the quick pass');
  assert.ok(yml.indexOf('council/eqx-demo.mjs') > yml.indexOf('council/dom-demo.mjs'));
  assert.match(src, /CTRADER_ENV\)\.trim\(\)\.toLowerCase\(\) !== 'demo'/); assert.ok(src.includes("import { connect } from './gotobi.mjs'"));
  assert.equal(src.match(/PT\.NEW_ORDER_REQ/g).length, 1); assert.match(src.match(/const order = \{[^}]*\}/)[0], /relativeStopLoss/);
});
