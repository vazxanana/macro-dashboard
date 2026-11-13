// The daily three-candle swing failure: detection, silver agreement, New York midnight, no look-ahead, the report.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { failure, smt, isNyMidnight, activeLevels, trade, days, holm, BUF, COST } from '../research/edge/swing-day3/run.mjs';

const day = (low, high, close) => ({ low, high, close });

test('pre-registered numbers', () => { assert.equal(BUF, 0.30); assert.equal(COST, 0.30); });

test('swing failure: one side swept and a close back inside Day 1', () => {
  const d1 = day(100, 110, 105);
  assert.equal(failure(d1, day(98, 108, 101)), 1);     // low swept, closed inside: buy
  assert.equal(failure(d1, day(102, 112, 109)), -1);   // high swept, closed inside: sell
  assert.equal(failure(d1, day(98, 108, 99)), 0);      // closed below Day 1's low: no failure
  assert.equal(failure(d1, day(98, 112, 105)), 0);     // both sides taken: skipped
  assert.equal(failure(d1, day(101, 109, 105)), 0);    // inside day: nothing swept
});

test('SMT: gold took its Day 1 extreme, silver did not take its own', () => {
  const g1 = day(100, 110, 105), g2 = day(98, 108, 101);
  assert.equal(smt(1, g1, g2, day(20, 22, 21), day(20.1, 21.5, 21)), true);
  assert.equal(smt(1, g1, g2, day(20, 22, 21), day(19.9, 21.5, 21)), false);
  assert.equal(smt(-1, day(100, 110, 105), day(102, 112, 109), day(20, 22, 21), day(20.5, 21.9, 21)), true);
  assert.equal(smt(1, g1, g2, null, null), null);
});

test('New York midnight follows daylight saving; 17:00 New York days', () => {
  assert.ok(isNyMidnight(Date.parse('2026-07-15T04:00:00Z') / 1000));   // EDT, UTC-4
  assert.ok(!isNyMidnight(Date.parse('2026-07-15T05:00:00Z') / 1000));
  assert.ok(isNyMidnight(Date.parse('2026-01-15T05:00:00Z') / 1000));   // EST, UTC-5
  assert.ok(!isNyMidnight(Date.parse('2026-01-15T04:00:00Z') / 1000));
  // Sunday 18:00 New York belongs to Monday, Friday 16:45 to Friday, Monday 17:00 starts Tuesday
  const b = (iso) => ({ time: Date.parse(iso) / 1000, open: 1, high: 1, low: 1, close: 1 });
  const ds = days([b('2026-01-16T21:45:00Z'), b('2026-01-18T23:00:00Z'), b('2026-01-19T21:45:00Z'), b('2026-01-19T22:00:00Z')]);
  assert.deepEqual(ds.map((x) => new Date(x.d * 86400000).toISOString().slice(0, 10)), ['2026-01-16', '2026-01-19', '2026-01-20']);
});

// a deterministic path
function walk(n, seed = 7) { let a = seed, p = 100; const out = [];
  for (let i = 0; i < n; i++) { a = (a * 1103515245 + 12345) % 2147483648; const r = a / 2147483648 - 0.5, o = p; p += r * 2;
    out.push({ time: 1700000000 + i * 900, open: o, high: Math.max(o, p) + Math.abs(r), low: Math.min(o, p) - Math.abs(r), close: p }); }
  return out; }

test('no look-ahead: a swing level and an entry never change when later candles change', () => {
  const bars = walk(400);
  for (const side of [1, -1]) {
    const lv = activeLevels(bars, side);
    for (const k of [50, 120, 233, 390]) {
      const alt = bars.map((b, i) => (i >= k ? { ...b, high: b.high + 50, low: b.low - 50, close: b.close + (i % 2 ? 30 : -30) } : b));
      assert.equal(activeLevels(alt, side)[k], lv[k], `side ${side} k ${k}`);
    }
  }
  let checked = 0;
  for (let i0 = 10; i0 < 300; i0 += 20) { const d3 = { i0, i1: i0 + 96 }, e = walk(400)[i0].open, r = trade(bars, d3, 1, e - 20, e + 60, activeLevels(bars, 1));
    if (r.skip) continue; checked++;
    const alt = bars.map((b, i) => (i > r.k ? { ...b, high: b.high + 5, low: b.low - 5, close: b.close + 3 } : b));
    const r2 = trade(alt, d3, 1, e - 20, e + 60, activeLevels(alt, 1));
    assert.equal(r2.entry, r.entry); assert.equal(r2.k, r.k); }
  assert.ok(checked > 0);
});

test('every trade has its stop on the losing side; stop first; under 1R skipped', () => {
  const bars = walk(400, 11);
  for (const side of [1, -1]) { const lv = activeLevels(bars, side);
    for (let i0 = 10; i0 < 300; i0 += 24) { const d3 = { i0, i1: i0 + 96 }, e = bars[i0].open;
      const r = trade(bars, d3, side, e - side * 6, e + side * 30, lv);
      if (r.skip) continue; assert.ok(side * (r.entry - r.stop) > 0); assert.ok(r.net < r.R);
      if (r.how === 'stop') assert.ok(r.R <= -1 + 1e-9); } }
  const flat = Array.from({ length: 20 }, (_, i) => ({ time: i * 900, open: 100, high: 100.1 + (i === 6 ? 1 : 0), low: 99.9, close: i === 12 ? 101.5 : 100 }));
  const lv = activeLevels(flat, 1);
  assert.equal(lv[12], 101.1);                                           // the pivot at 6, known from candle 10 on
  assert.equal(trade(flat, { i0: 10, i1: 20 }, 1, 99, 102, lv).skip, 'under-1R');
  assert.equal(trade(flat, { i0: 10, i1: 20 }, 1, 99, 105, lv).entry, 101.5);
});

test('Holm', () => { assert.deepEqual(holm([0.5, 0.01, 0.02]).map((x) => +x.toFixed(3)), [0.5, 0.03, 0.04]); });

test('the report says what result.json holds', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/swing-day3/result.json', import.meta.url))), md = fs.readFileSync(new URL('../research/edge/swing-day3/RESULT.md', import.meta.url), 'utf8');
  const s = (v) => (v > 0 ? '+' : '') + v.toFixed(3), T = r.T1;
  assert.equal(r.verdict, 'FAIL'); assert.match(md, /^\*\*Verdict: FAIL, 0 of 3 tests\.\*\*/m);
  for (const k of ['T1', 'T2', 'T3']) assert.equal(r.tests[k].pass, false);
  assert.ok(md.includes(`n ${T.all.n} trades, ${s(T.all.avg)}R a trade`));
  assert.ok(md.includes(`month-sum t ${T.monthly.t.toFixed(2)} over ${T.monthly.months}`));
  assert.ok(md.includes(`${s(T.a.avg)}R (n ${T.a.n}, t ${T.a.t.toFixed(2)})`));
  assert.ok(md.includes(`${s(T.b.avg)}R (n ${T.b.n}, t ${T.b.t.toFixed(2)})`));
  assert.ok(md.includes(`beats ${r.placebo.beaten} of 40`));
  assert.ok(md.includes(`| ${r.T2.in.n} / ${r.T2.out.n} | ${s(r.T2.in.avg)} / ${s(r.T2.out.avg)} | ${r.T2.all.t.toFixed(2)} (difference)`));
  assert.ok(md.includes(`| ${r.T3.in.n} / ${r.T3.out.n} | ${s(r.T3.in.avg)} / ${s(r.T3.out.avg)} | ${r.T3.all.t.toFixed(2)} (difference)`));
  assert.ok(md.includes(`**either ${r.pdhpdl.either} %`) && md.includes(`${r.pdhpdl.high} %`) && md.includes(`${r.pdhpdl.low} %`));
  assert.ok(md.includes(`${r.funnel.setups} swing-failure setups`) && md.includes(`${r.funnel['under-1R']} dropped`));
});
