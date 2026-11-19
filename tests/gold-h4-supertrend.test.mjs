// The Supertrend reversal study on gold H4: the H4 blocks, the indicator, the engine's stops, no look-ahead, the report.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { blockOf, buildH4, supertrend, flipsOf, simulate, holm, monthSums, tStat, placeboFlips, costR } from '../research/edge/gold-h4-supertrend/run.mjs';

const T = (s) => Date.parse(s) / 1000;

test('H4 blocks start at 17:00 New York in winter and summer, weekend hours are dropped', () => {
  // winter (UTC-5): 22:00 UTC = 17:00 NY opens a block; 01:00-02:00 UTC same block, 02:00 UTC next
  assert.equal(blockOf(T('2026-01-13T22:00:00Z')), blockOf(T('2026-01-14T01:00:00Z')));
  assert.notEqual(blockOf(T('2026-01-14T01:00:00Z')), blockOf(T('2026-01-14T02:00:00Z')));
  // summer (UTC-4): 21:00 UTC = 17:00 NY
  assert.notEqual(blockOf(T('2026-07-14T20:00:00Z')), blockOf(T('2026-07-14T21:00:00Z')));
  assert.equal(blockOf(T('2026-07-14T21:00:00Z')), blockOf(T('2026-07-15T00:00:00Z')));
  // Friday 17:00 NY to Sunday 17:00 NY is weekend
  assert.equal(blockOf(T('2026-01-16T22:00:00Z')), null);
  assert.equal(blockOf(T('2026-01-18T21:00:00Z')), null);
  assert.notEqual(blockOf(T('2026-01-18T22:00:00Z')), null);
});

test('H4 candles join their H1 candles and the last (forming) block is dropped', () => {
  const t0 = T('2026-01-13T22:00:00Z'), rows = [];
  for (let k = 0; k < 9; k++) rows.push([t0 + k * 3600, 10 + k, 12 + k, 9 + k, 11 + k]);
  const { h4, h1 } = buildH4(rows);
  assert.equal(h4.length, 2);   // blocks 22-02, 02-06 closed; 06-07 forming dropped
  assert.deepEqual([h4[0].o, h4[0].h, h4[0].l, h4[0].c], [10, 15, 9, 14]);
  assert.equal(h1[0].length, 4);
});

const bars = (cl, w = 1) => cl.map((c, i) => ({ t: i * 14400, o: i ? cl[i - 1] : c, h: Math.max(c, i ? cl[i - 1] : c) + w, l: Math.min(c, i ? cl[i - 1] : c) - w, c }));

test('Supertrend: up while rising, flips down on a close below the lower line, the line trails up only', () => {
  const cl = [...Array(30)].map((_, i) => 100 + i), down = [...cl, ...[...Array(15)].map((_, i) => 128 - 3 * i)];
  const st = supertrend(bars(down), 10, 3), f = flipsOf(st);
  for (let i = 10; i < 30; i++) { assert.equal(st.up[i], true); assert.ok(st.line[i] >= st.line[i - 1] - 1e-9 || i === 10); assert.ok(st.line[i] < down[i]); }
  assert.ok(f.length >= 1 && f[0].side === 'sell' && f[0].i >= 30);
  assert.ok(down[f[0].i] < st.line[f[0].i - 1]);
});

test('no look-ahead: changing every candle after i leaves the indicator up to i unchanged', () => {
  const cl = [...Array(60)].map((_, i) => 100 + 10 * Math.sin(i / 4)), a = bars(cl), b = bars(cl.map((c, i) => (i > 40 ? c * 3 : c)));
  const sa = supertrend(a, 10, 3), sb = supertrend(b, 10, 3);
  for (let i = 0; i <= 40; i++) { assert.equal(sa.line[i], sb.line[i]); assert.equal(sa.up[i], sb.up[i]); }
});

test('engine: entry at the next open, hard stop on H1 at the stop (or the gap open), trailed tighter only, flip exit', () => {
  const h4 = [0, 1, 2, 3, 4].map((k) => ({ t: k * 14400, o: 100, h: 101, l: 99, c: 100 }));
  const h1 = h4.map((b) => [[b.t, 100, 101, 99, 100]]);
  // buy flip at 0 (stop 95), sell flip at 2: buy exits at open of 3 by flip, sell opens there
  let tr = simulate(h4, h1, [{ i: 0, side: 'buy' }, { i: 2, side: 'sell' }], (i, s) => (s === 'buy' ? 95 : 105));
  assert.equal(tr.length, 1); assert.equal(tr[0].how, 'flip'); assert.equal(tr[0].entryT, 14400); assert.equal(tr[0].exitT, 3 * 14400);
  assert.equal(tr[0].r0, 5); assert.equal(tr[0].R, 0);
  // a trailed stop is never loosened, and an H1 low through it stops the trade at the stop
  const h1b = h1.map((x, k) => (k === 3 ? [[3 * 14400, 100, 101, 97, 98]] : x));
  tr = simulate(h4, h1b, [{ i: 0, side: 'buy' }], (i) => (i === 1 ? 98 : i === 2 ? 90 : 95));
  assert.equal(tr[0].how, 'stop'); assert.equal(tr[0].exit, 98); assert.equal(tr[0].R, -0.4);
  // a gap below the stop fills at the open
  const h1c = h1.map((x, k) => (k === 2 ? [[2 * 14400, 92, 93, 91, 92]] : x));
  tr = simulate(h4, h1c, [{ i: 0, side: 'buy' }], () => 95);
  assert.equal(tr[0].exit, 92);
  // buys only: a sell flip only closes the buy
  tr = simulate(h4, h1, [{ i: 0, side: 'buy' }, { i: 1, side: 'sell' }, { i: 3, side: 'buy' }], (i, s) => (s === 'buy' ? 95 : 105), true);
  assert.ok(tr.every((x) => x.side === 'buy'));
  // every trade has a stop on the losing side at entry
  for (const x of tr) assert.ok(x.r0 > 0);
});

test('costs: spread on both sides, financing only on buys, doubled at 2x', () => {
  const b = { side: 'buy', entryT: T('2026-01-12T10:00:00Z'), exitT: T('2026-01-15T10:00:00Z'), entry: 4000, r0: 40 };
  const s = { ...b, side: 'sell' };
  assert.equal(costR(s), 0.6 / 40);
  assert.ok(costR(b) > costR(s));
  assert.ok(Math.abs(costR(b, 2) - 2 * costR(b)) < 1e-12);
});

test('statistics: Holm, month sums with empty months, seeded placebo is repeatable', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(2)), [0.03, 0.06, 0.06]);
  const w = { from: T('2020-01-01T00:00:00Z'), to: T('2020-04-01T00:00:00Z') };
  assert.deepEqual(monthSums([{ exitT: T('2020-03-05T00:00:00Z'), v: 2 }], w, (x) => x.v), [0, 0, 2]);
  assert.equal(tStat([1, 1, 1]), 0);
  const h4 = [...Array(100)].map((_, k) => ({ t: w.from + k * 14400 }));
  assert.deepEqual(placeboFlips(h4, w, 7, 3), placeboFlips(h4, w, 7, 3));
  const p = placeboFlips(h4, w, 7, 3);
  assert.equal(p.length, 7); for (let k = 1; k < 7; k++) assert.notEqual(p[k].side, p[k - 1].side);
});

test('the report says what result.json holds, and FAIL', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-h4-supertrend/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/gold-h4-supertrend/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.verdict, 'FAIL, 0 of 3'); assert.match(md, /\*\*Verdict: FAIL, 0 of 3/);
  const f = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
  for (const k of ['T1', 'T2', 'T3']) {
    const t = r.tests[k]; assert.equal(t.pass, false);
    for (const s of [t.is, t.oos]) assert.match(md, new RegExp(`\\| ${s.n} \\| [0-9.]+ % \\| \\${f(s.gross)} \\| \\${f(s.net)} \\| \\${f(s.net2x)} \\|`), k);
    assert.match(md, new RegExp(`\\(${t.placebo.beaten}; placebo median t|\\(${t.placebo.beaten}; median t`));
  }
  assert.match(md, new RegExp(`n ${r.tests.T2.oos.n}, month t ${r.tests.T2.oos.tNet.toFixed(2)}, Holm p ${r.tests.T2.holm.toFixed(2)}`));
  assert.ok(!/live change|now live/i.test(md.replace(/nothing live changed/i, '')), 'no live change claimed');
});
