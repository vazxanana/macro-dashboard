// node --test tests/ict-roll.test.mjs — futures rolls in the ICT desk's CNBC candles (research/edge/futures-roll): the daily
// back-adjustment (rollAdjust) and the open-trade shift on a contract switch (contractShift / shiftTrade)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rollAdjust, contractShift, shiftTrade, ROLL, MARKETS } from '../ict/tracker.mjs';

const fx = JSON.parse(fs.readFileSync(new URL('./fixtures/cnbc-nq-roll-sep2026.json', import.meta.url), 'utf8'));
const rows = (a) => a.map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] }));
// synthetic daily candles at 00:00 New York (04:00 UTC in summer), weekdays only, from a start date
function days(start, n) { const out = []; let t = Date.parse(`${start}T04:00:00Z`) / 1000; while (out.length < n) { const w = new Date(t * 1000).getUTCDay(); if (w > 0 && w < 6) out.push(t); t += 86400; } return out; }
function market(start, n, stepDay, spread, noise = 0) {
  const T = days(start, n), fut = [], cash = [];
  T.forEach((t, i) => { const c = 20000 + 40 * Math.sin(i) + i * 5, basis = 120 - i + (i % 3) * noise, k = new Date(t * 1000).toISOString().slice(0, 10) >= stepDay ? spread : 0;
    cash.push({ time: t, open: c, high: c + 100, low: c - 100, close: c }); const f = c + basis + k; fut.push({ time: t, open: f - 10, high: f + 90, low: f - 110, close: f }); });
  return { fut, cash };
}

test('real CNBC NQ daily candles, Sep 2026: one roll on 14 Sep, spread ~300, adjusted series matches the Dec contract', () => {
  const r = rollAdjust(rows(fx.nq), rows(fx.ndx));
  assert.equal(r.rolls.length, 1);
  assert.equal(r.rolls[0].day, '2026-09-14');
  assert.ok(Math.abs(r.rolls[0].spread - 300) < 20, `spread ${r.rolls[0].spread}`);
  // before the switch the raw front month sits ~290 under the Dec contract; adjusted, within 25 points (the spread drifts a little)
  const Z = new Map(fx.nqz26.map((b) => [b[0], b[4]]));
  const pre = r.d1.filter((b) => b.time < Date.parse('2026-09-14') / 1000 && Z.has(b.time));
  assert.ok(pre.length > 20);
  for (const b of pre) assert.ok(Math.abs(b.close - Z.get(b.time)) < 25, `${new Date(b.time * 1000).toISOString()} ${b.close} vs ${Z.get(b.time)}`);
  // from the switch on, nothing moves; highs minus lows never change (the daily ATR is the same)
  const raw = rows(fx.nq);
  r.d1.forEach((b, i) => { assert.ok(Math.abs((b.high - b.low) - (raw[i].high - raw[i].low)) < 1e-9);
    if (b.time >= Date.parse('2026-09-14') / 1000) assert.deepEqual(b, raw[i]); });
});

test('synthetic: a step in the expiry week is a roll; candles before it move by the spread', () => {
  const { fut, cash } = market('2026-08-03', 60, '2026-09-14', 250);
  const r = rollAdjust(fut, cash);
  assert.deepEqual(r.rolls.map((x) => x.day), ['2026-09-14']);
  assert.ok(Math.abs(r.rolls[0].spread - 251) < 3);   // the step plus one day of basis drift
  const i = fut.findIndex((b) => new Date(b.time * 1000).toISOString().slice(0, 10) === '2026-09-14');
  assert.ok(Math.abs(r.d1[i - 1].close - (fut[i - 1].close + r.rolls[0].spread)) < 1e-9);
  assert.equal(r.d1[i], fut[i]);
});

test('not a roll: a step far from an expiry, a downward lone step, a 0.3 % basis wobble, no cash data', () => {
  assert.equal(rollAdjust(...Object.values(market('2026-07-01', 60, '2026-08-05', 250))).rolls.length, 0, 'August is no index expiry');
  assert.equal(rollAdjust(...Object.values(market('2026-08-03', 60, '2026-09-14', -250))).rolls.length, 0, 'backwardation step');
  assert.equal(rollAdjust(...Object.values(market('2026-08-03', 60, '2026-09-14', 0.003 * 20000))).rolls.length, 0, 'below ROLL.minPct');
  const { fut } = market('2026-08-03', 60, '2026-09-14', 250);
  const r = rollAdjust(fut, []); assert.equal(r.rolls.length, 0); assert.equal(r.d1, fut);
  assert.ok(ROLL.minPct >= 0.004 && ROLL.win <= 10);
});

test('a settlement-day dip and the switch a few days later count as one roll (June 2026 case)', () => {
  const { fut, cash } = market('2026-05-04', 60, '2026-06-22', 300);
  const k = fut.findIndex((b) => new Date(b.time * 1000).toISOString().slice(0, 10) === '2026-06-18');
  fut[k] = { ...fut[k], close: fut[k].close - 150 };   // the expiring contract's thin final candle
  const r = rollAdjust(fut, cash);
  assert.deepEqual(r.rolls.map((x) => x.day), ['2026-06-22']);
  assert.ok(Math.abs(r.rolls[0].spread - 301) < 3);
  // live on 19 Jun (the switch not printed yet): the lone downward step is not applied
  assert.equal(rollAdjust(fut.slice(0, k + 1), cash).rolls.length, 0);
});

test('gold carries no cash index: its daily candles are never adjusted', () => {
  assert.equal(MARKETS.gc.cash, undefined);
  for (const k of ['nq', 'es', 'ym', 'rty']) assert.match(MARKETS[k].cash, /^\.(NDX|SPX|DJI|RUT)$/);
});

test('contractShift: equal candles -> 0; the new contract +spread -> the spread; noise or too few -> 0', () => {
  const H = Array.from({ length: 60 }, (_, i) => ({ time: 1e9 + i * 3600, open: 1, high: 1, low: 1, close: 25000 + 30 * Math.sin(i) }));
  const prev = H.map((b) => [b.time, b.open, b.high, b.low, b.close]);
  assert.equal(contractShift(prev, H), 0);
  const moved = H.map((b, i) => ({ ...b, close: b.close + 300 + (i % 5) - 2 }));
  assert.ok(Math.abs(contractShift(prev, moved) - 300) <= 2);
  assert.equal(contractShift(prev.slice(0, 10), moved), 0, 'fewer than SHIFT.min shared candles');
  const messy = H.map((b, i) => ({ ...b, close: b.close + (i % 2 ? 300 : -300) }));
  assert.equal(contractShift(prev, messy), 0, 'not a constant offset');
  const small = H.map((b) => ({ ...b, close: b.close + 20 }));
  assert.equal(contractShift(prev, small), 0, 'below SHIFT.minPct');
  assert.equal(contractShift(undefined, H), 0);
});

test('shiftTrade moves every price level of an open trade and keeps its R geometry', () => {
  const f = (v) => +(+v).toFixed(2);
  const tr = { side: 'sell', entry: 25000, stop: 25100, stop0: 25100, t1: null, t2: 24800, signalPx: 25005, r0: 100, ih: 24700, dol: 24600, sweep: { t: 1, level: 25098 }, fvg: [24950, 24980], status: 'open' };
  shiftTrade(tr, 300, f, 123);
  assert.deepEqual([tr.entry, tr.stop, tr.stop0, tr.t2, tr.signalPx, tr.ih, tr.dol, tr.sweep.level], [25300, 25400, 25400, 25100, 25305, 25000, 24900, 25398]);
  assert.deepEqual(tr.fvg, [25250, 25280]); assert.equal(tr.t1, null); assert.equal(tr.r0, 100);
  assert.deepEqual(tr.rolled, [{ at: 123, by: 300 }]);
  // a new-contract candle 50 points above the old entry's equivalent no longer looks like a stop-out
  assert.ok(25300 + 50 < tr.stop);
});

test('replay liquidFrom: CNBC intraday is kept only from the stretch where the contract trades like the front month', async () => {
  const { liquidFrom, LIQ } = await import('../ict/replay.mjs');
  // 60 deferred days at ~1 % of the front's hourly volume, then 30 front-month days; one quiet holiday inside the front stretch
  const h1 = []; const t0 = Date.parse('2026-07-01T00:00:00Z') / 1000;
  for (let d = 0; d < 90; d++) for (let h = 0; h < 20; h++) h1.push({ time: t0 + d * 86400 + h * 3600, open: 1, high: 1, low: 1, close: 1, volume: d < 60 ? 100 : d === 75 ? 500 : 10000 });
  assert.equal(liquidFrom(h1), t0 + 60 * 86400);
  // all liquid -> the first day; no volume (another source) or too short -> null (nothing cut)
  assert.equal(liquidFrom(h1.slice(60 * 20)), t0 + 60 * 86400);
  assert.equal(liquidFrom(h1.map((b) => ({ ...b, volume: 0 }))), null);
  assert.equal(liquidFrom(h1.slice(-10 * 20)), null);
  // a thin last day (a holiday session) does not move the start to the end
  const tail = h1.concat(Array.from({ length: 5 }, (_, h) => ({ time: t0 + 90 * 86400 + h * 3600, open: 1, high: 1, low: 1, close: 1, volume: 50 })));
  assert.equal(liquidFrom(tail), t0 + 60 * 86400);
  assert.ok(LIQ.min > 0.06 && LIQ.min < 0.5, 'between the deferred (<= 6 %) and front (>= 50 %) weekly volume shares, the cut moves by days only (liqsens.mjs)');
});

test('the ICT desk shows the roll state the tracker publishes (snapshot markets[k].d1Roll / switched)', () => {
  const html = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
  assert.match(html, /m && m\.switched \? `<div class="sub roll"/); assert.match(html, /m && m\.d1Roll \? `<div class="sub roll"/);
  assert.match(html, /contract switch on \$\{switched\.join\(', '\)\}/);
});
