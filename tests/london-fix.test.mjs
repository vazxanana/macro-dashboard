// research/edge/london-fix: London time with summer time, the event filter without look-ahead, stop / exit, costs, and the
// report against result.json. Offline (synthetic candles).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as L from '../research/edge/london-fix/run.mjs';

const iso = (t) => new Date(t * 1000).toISOString();

test('London time: GMT in winter, BST in summer, on the switch days', () => {
  assert.equal(iso(L.londonT('2026-01-15', 15 * 60 + 30)), '2026-01-15T15:30:00.000Z');
  assert.equal(iso(L.londonT('2026-07-01', 15 * 60 + 30)), '2026-07-01T14:30:00.000Z');
  // UK clocks go forward on the last Sunday of March (29 Mar 2026) and back on the last Sunday of October (25 Oct 2026)
  assert.equal(iso(L.londonT('2026-03-27', 16 * 60)), '2026-03-27T16:00:00.000Z');
  assert.equal(iso(L.londonT('2026-03-30', 16 * 60)), '2026-03-30T15:00:00.000Z');
  assert.equal(iso(L.londonT('2026-10-23', 16 * 60)), '2026-10-23T15:00:00.000Z');
  assert.equal(iso(L.londonT('2026-10-26', 16 * 60)), '2026-10-26T16:00:00.000Z');
  // the US moves on 8 Mar 2026: London is still GMT that week
  assert.equal(iso(L.londonT('2026-03-10', 16 * 60)), '2026-03-10T16:00:00.000Z');
  const w = L.windows(L.FIX);
  assert.deepEqual([w.a0, w.a1, w.T2.entry, w.T2.exit, w.T1.entry, w.T1.exit].map(L.hm), ['15:30', '15:55', '15:55', '16:05', '16:05', '17:00']);
  assert.ok(!L.SLOTS.some((F) => Math.abs(F - L.FIX) <= 30), 'no placebo slot holds the fix');
});

// flat candles every 5 min over [from, to) at price px
const flat = (from, to, px) => { const b = []; for (let t = from; t < to; t += 300) b.push([t, px, px, px, px]); return b; };

test('the event filter: the median of the 20 weekdays strictly before, never the day itself or later', () => {
  const days = []; for (let d = '2026-01-05'; days.length < 30; d = L.addD(d, 1)) if (L.isWeekday(d)) days.push(d);
  const A = new Map(days.map((d, k) => [d, k < 25 ? 0.001 : 0.5]));
  const aOf = (d) => A.get(d);
  assert.equal(L.reference(aOf, days, 19), null);                 // fewer than 20 days behind
  assert.ok(Math.abs(L.reference(aOf, days, 20) - 0.001) < 1e-12);
  assert.ok(Math.abs(L.reference(aOf, days, 25) - 0.001) < 1e-12); // day 25's own big A is not in its reference
  // changing every later day changes nothing
  const ref0 = L.reference(aOf, days, 22);
  for (let k = 22; k < 30; k++) A.set(days[k], 99);
  assert.equal(L.reference(aOf, days, 22), ref0);
  assert.ok(L.isEvent(0.0016, 0.001)); assert.ok(!L.isEvent(0.0015, 0.001)); assert.ok(!L.isEvent(0.0016, 0));
  // fewer than 15 of the 20 with an A -> no reference
  const B = new Map(days.map((d, k) => [d, k % 3 ? 0.001 : null]));
  assert.equal(L.reference((d) => B.get(d), days, 25), null);
  // runSlot: a big pre-fix move on the last day is an event, read from London time
  const bars = [];
  for (const d of days) {
    const day = flat(L.londonT(d, 15 * 60), L.londonT(d, 17 * 60 + 30), 1.1);
    const big = d === days[29];
    for (const b of day) if (b[0] >= L.londonT(d, 15 * 60 + 55)) { const p = big ? 1.105 : (b[0] >= L.londonT(d, 15 * 60 + 55) ? 1.1002 : 1.1); b[1] = b[2] = b[3] = b[4] = p; }
    bars.push(...day);
  }
  const r = L.runSlot(bars, 'eurusd', days, L.FIX);
  assert.deepEqual([...r.ev.keys()], [days[29]]);
  const e = r.ev.get(days[29]);
  assert.ok(Math.abs(e.A - 0.005) < 1e-12 && Math.abs(e.ref - 0.0002) < 1e-12);
  assert.equal(e.T2.side, 1); assert.equal(e.T1.side, -1);   // follow buys, fade sells
});

test('stops and exits: T1 against A, T2 with A, stop 1 x |A|, gaps at the open, nothing after the exit', () => {
  const d = '2026-07-01', A = 0.002, px = 1.1;
  const bars = flat(L.londonT(d, 15 * 60), L.londonT(d, 18 * 60), px);
  const at = (b, min) => b.findIndex((x) => x[0] === L.londonT(d, min));
  // T2 follows an up A: buy at 15:55, out at the 16:05 open
  let b = bars.map((x) => [...x]); b[at(b, 16 * 60 + 5)][1] = px + 0.001;
  let t = L.trade(L.index(b), 'eurusd', 'T2', d, A);
  assert.equal(t.how, 'time'); assert.equal(t.side, 1); assert.ok(Math.abs(t.R - 0.5) < 1e-9);
  assert.equal(t.entryT, L.londonT(d, 15 * 60 + 55)); assert.equal(t.exitT, L.londonT(d, 16 * 60 + 5));
  assert.ok(Math.abs(t.stop - (px - A)) < 1e-12);
  // T1 fades an up A: a sell at 16:05 with its stop above; a high through it -> -1R
  b = bars.map((x) => [...x]); b[at(b, 16 * 60 + 30)][2] = px + 0.003;
  t = L.trade(L.index(b), 'eurusd', 'T1', d, A);
  assert.equal(t.side, -1); assert.ok(t.stop > t.entry); assert.equal(t.how, 'stop'); assert.ok(Math.abs(t.R + 1) < 1e-9);
  // an open past the stop fills at that open
  b = bars.map((x) => [...x]); b[at(b, 16 * 60 + 30)] = [b[at(b, 16 * 60 + 30)][0], px + 0.004, px + 0.004, px + 0.004, px + 0.004];
  t = L.trade(L.index(b), 'eurusd', 'T1', d, A);
  assert.equal(t.how, 'gap'); assert.ok(Math.abs(t.R + 2) < 1e-9);
  // a down A: T1 buys at 16:05 with its stop below, exit at the 17:00 open
  b = bars.map((x) => [...x]); b[at(b, 17 * 60)][1] = px + 0.001;
  t = L.trade(L.index(b), 'eurusd', 'T1', d, -A);
  assert.equal(t.side, 1); assert.ok(t.stop < t.entry); assert.equal(t.exitT, L.londonT(d, 17 * 60)); assert.ok(Math.abs(t.R - 0.5) < 1e-9);
  // prices after the exit time never move the trade; a missing entry candle -> no trade
  b = bars.map((x) => [...x]); for (const x of b) if (x[0] >= L.londonT(d, 17 * 60 + 5)) { x[2] = 5; x[3] = 0.1; }
  assert.equal(L.trade(L.index(b), 'eurusd', 'T1', d, A).how, 'time');
  assert.equal(L.trade(L.index(bars.filter((x) => x[0] !== L.londonT(d, 16 * 60 + 5))), 'eurusd', 'T1', d, A), null);
  // a missing exit candle uses the close of the candle before it
  b = bars.filter((x) => x[0] !== L.londonT(d, 17 * 60)).map((x) => [...x]); b[at(b, 16 * 60 + 55)][4] = px - 0.001;
  assert.ok(Math.abs(L.trade(L.index(b), 'eurusd', 'T1', d, A).R - 0.5) < 1e-9);
});

test('costs: 0.3 pip spread, 0.5 pip slippage a side, USD 22.5 per million a side', () => {
  assert.ok(Math.abs(L.costPx('eurusd', 1.1) - (0.00013 + 2 * 22.5e-6 * 1.1)) < 1e-15);
  assert.ok(Math.abs(L.costPx('usdjpy', 150) - (0.013 + 2 * 22.5e-6 * 150)) < 1e-12);
  assert.ok(Math.abs(L.costPx('eurjpy', 170) - (0.013 + 2 * 22.5e-6 * 170)) < 1e-12);
  const d = '2026-01-15', bars = flat(L.londonT(d, 15 * 60), L.londonT(d, 18 * 60), 1.1);
  const t = L.trade(L.index(bars), 'eurusd', 'T2', d, 0.001);
  assert.equal(t.R, 0);
  assert.ok(Math.abs(t.net + L.costPx('eurusd', 1.1) / 0.001) < 1e-12);
  assert.ok(Math.abs(t.net2 + 2 * L.costPx('eurusd', 1.1) / 0.001) < 1e-12);
  const h = L.holm([0.01, 0.04]); assert.deepEqual(h.ok, [true, true]);
  assert.deepEqual(L.holm([0.03, 0.04]).ok, [false, false]);
});

test('RESULT.md matches result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/london-fix/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/london-fix/RESULT.md', import.meta.url), 'utf8');
  assert.equal(L.report(r), md);
  assert.match(md, new RegExp(`\\*\\*Verdict: ${r.verdict.replace(/[()]/g, '\\$&')}\\.`));
  for (const k of ['T1', 'T2']) {
    const t = r.tests[k];
    assert.equal(t.pass, Object.values(t.checks).every(Boolean));
    assert.equal(t.checks.netPositive, t.decisive.netR > 0);
    assert.equal(t.placebo.values.length, 40);
    assert.equal(t.placebo.p95, [...t.placebo.values].sort((a, b) => a - b)[37]);
    assert.ok(md.includes(`| ${k} | 2020-now | ${t.decisive.n} |`));
  }
  assert.equal(r.verdict === 'FAIL', r.passed.length === 0);
  assert.equal(r.bar.holm.tests, 2);
});
