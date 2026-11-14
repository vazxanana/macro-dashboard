// The three-timeframe agreement study on gold: blocks, EMA / ATR, closed candles only, the engine's stops, the report.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { blockOf, group, ema, atrW, states, simulate, costR, holm, monthSums, tStat, placebo, STOP_ATR } from '../research/edge/gold-mtf-align/run.mjs';

const T = (s) => Date.parse(s) / 1000;

test('blocks start at 17:00 New York in winter and summer, weekend hours are null', () => {
  assert.equal(blockOf(T('2026-01-13T22:00:00Z')), blockOf(T('2026-01-14T01:00:00Z')));
  assert.notEqual(blockOf(T('2026-01-14T01:00:00Z')), blockOf(T('2026-01-14T02:00:00Z')));
  assert.notEqual(blockOf(T('2026-07-14T20:00:00Z')), blockOf(T('2026-07-14T21:00:00Z')));
  assert.equal(blockOf(T('2026-01-16T22:00:00Z')), null);
  assert.notEqual(blockOf(T('2026-01-18T22:00:00Z')), null);
});

test('EMA starts at the simple mean of the first n, ATR at the mean of the first n true ranges', () => {
  const e = ema([1, 2, 3, 4, 5], 3);
  assert.deepEqual(e.slice(0, 2), [null, null]); assert.equal(e[2], 2); assert.equal(e[3], 3); assert.equal(e[4], 4);
  const a = atrW([{ h: 2, l: 0, c: 1 }, { h: 3, l: 1, c: 2 }, { h: 6, l: 2, c: 5 }], 2);
  assert.equal(a[1], 2); assert.equal(a[2], (2 + 4) / 2);
});

// a run of hourly rows (weekdays only) starting Tuesday 13 Jan 2026 22:00 UTC = 17:00 New York
const hourly = (closes, t0 = T('2026-01-13T22:00:00Z')) => {
  const out = []; let t = t0, prev = closes[0];
  for (const c of closes) { while (blockOf(t) == null) t += 3600; out.push([t, prev, Math.max(prev, c) + 0.5, Math.min(prev, c) - 0.5, c]); prev = c; t += 3600; }
  return out;
};

test('an H4 candle is known closed only at its block end, a D1 candle only at 17:00 New York', () => {
  const rows = hourly([...Array(30)].map((_, i) => 100 + i));
  const h4 = group(rows, blockOf, 5);
  assert.equal(h4[0].closeT, T('2026-01-14T02:00:00Z'));
  const d1 = group(rows, (t) => Math.floor(blockOf(t) / 6), 26);
  assert.equal(d1[0].closeT, T('2026-01-14T22:00:00Z'));
});

test('no look-ahead: changing every hour after j leaves every state up to j unchanged', () => {
  const cl = [...Array(1200)].map((_, i) => 100 + 10 * Math.sin(i / 37) + 3 * Math.sin(i / 5));
  const a = states(hourly(cl)), b = states(hourly(cl.map((c, i) => (i > 900 ? c * 2 + 50 : c))));
  for (let j = 0; j <= 900; j++) assert.deepEqual(a[j], b[j], `hour ${j}`);
  assert.ok(a.some((x) => x.s === 1) && a.some((x) => x.s === -1));
});

const flat = (n) => [...Array(n)].map((_, k) => [k * 3600, 100, 101, 99, 100]);
const S = (arr, d = null) => arr.map((s) => ({ s, d: d ?? s, atr: 2 }));

test('engine: entry at the next open on a turn, exit at the next open when the agreement ends, stop 2 ATR on the losing side', () => {
  const rows = flat(8), st = S([0, 1, 1, 0, 0, -1, -1, -1]);
  const tr = simulate(rows, st, { exit: 'all' });
  assert.equal(tr[0].side, 'buy'); assert.equal(tr[0].entryT, 2 * 3600); assert.equal(tr[0].exitT, 4 * 3600); assert.equal(tr[0].how, 'rule');
  assert.equal(tr[0].r0, STOP_ATR * 2); assert.ok(tr.every((x) => x.r0 > 0));
  // buys only: the down turn opens nothing
  assert.equal(simulate(rows, st, { longsOnly: true }).length, 1);
  // a direct flip up -> down closes the buy and opens the sell at the same open
  const st2 = S([1, 1, -1, -1, -1, -1, 0, 0]);
  const t2 = simulate(flat(8), st2, { exit: 'all' });
  assert.equal(t2[0].exitT, 3 * 3600); assert.equal(t2[1].entryT, 3 * 3600); assert.equal(t2[1].side, 'sell');
});

test('engine: the stop fills at the stop, or at the open on a gap; no re-entry without a new turn', () => {
  const rows = flat(8); rows[3] = [3 * 3600, 100, 100.5, 95, 97];
  let tr = simulate(rows, S([1, 1, 1, 1, 1, 1, 1, 1]), { exit: 'all' });
  assert.equal(tr.length, 1); assert.equal(tr[0].how, 'stop'); assert.equal(tr[0].exit, 96); assert.equal(tr[0].R, -1);
  const g = flat(8); g[2] = [2 * 3600, 90, 91, 89, 90];
  tr = simulate(g, S([1, 1, 1, 1, 1, 1, 1, 1]), { exit: 'all' });
  assert.equal(tr[0].exit, 90); assert.equal(tr[0].R, -2.5);
});

test('T3 exit: the position stays through mixed hours and leaves only when D1 turns', () => {
  const st = [0, 1, 0, 0, 0, 0, 0, 0].map((s, k) => ({ s, d: k < 5 ? 1 : -1, atr: 2 }));
  const tr = simulate(flat(8), st, { exit: 'd1' });
  assert.equal(tr.length, 1); assert.equal(tr[0].entryT, 2 * 3600); assert.equal(tr[0].exitT, 6 * 3600);
});

test('costs: spread on both sides, financing only on buys, doubled at 2x', () => {
  const b = { side: 'buy', entryT: T('2026-01-12T10:00:00Z'), exitT: T('2026-01-15T10:00:00Z'), entry: 4000, r0: 40 };
  const s = { ...b, side: 'sell' };
  assert.equal(costR(s), 0.6 / 40); assert.ok(costR(b) > costR(s));
  assert.ok(Math.abs(costR(b, 2) - 2 * costR(b)) < 1e-12);
});

test('statistics: Holm, month sums with empty months, seeded placebo is repeatable and never overlaps', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(2)), [0.03, 0.06, 0.06]);
  const w = { from: T('2020-01-01T00:00:00Z'), to: T('2020-04-01T00:00:00Z') };
  assert.deepEqual(monthSums([{ exitT: T('2020-03-05T00:00:00Z'), v: 2 }], w, (x) => x.v), [0, 0, 2]);
  assert.equal(tStat([1, 1, 1]), 0);
  const rows = [...Array(400)].map((_, k) => [w.from + k * 3600, 100, 101, 99, 100]), st = S(Array(400).fill(0));
  const a = placebo(rows, st, w, 20, [3, 5, 8], 7, false);
  assert.deepEqual(a, placebo(rows, st, w, 20, [3, 5, 8], 7, false));
  for (let k = 1; k < a.length; k++) assert.ok(a[k].entryT >= a[k - 1].exitT);
  assert.ok(placebo(rows, st, w, 20, [3], 9, true).every((x) => x.side === 'buy'));
});

test('the report says what result.json holds, and FAIL', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-mtf-align/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/gold-mtf-align/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.verdict, 'FAIL, 0 of 3'); assert.match(md, /\*\*Verdict: FAIL, 0 of 3/);
  const head = md.match(/\*\*Verdict: (.*?)\*\*/)[1]; assert.ok(head.length < 220);
  const f = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
  for (const k of ['T1', 'T2', 'T3']) {
    const t = r.tests[k]; assert.equal(t.pass, false);
    for (const s of [t.is, t.oos]) assert.match(md, new RegExp(`\\| ${s.n} \\| ${s.win.toFixed(1)} % \\| \\${f(s.gross)} \\| \\${f(s.net)} \\| \\${f(s.net2x)} \\|.*\\| ${s.tNet.toFixed(2)} \\|`), k);
    assert.match(md, new RegExp(`\\(${t.placebo.beaten}; (placebo )?median t ${t.placebo.median.toFixed(2)}\\)`), k);
  }
  const t1 = r.tests.T1;
  assert.match(md, new RegExp(`T1 OOS ${f(t1.oos.net)}R net, n ${t1.oos.n}, month t ${t1.oos.tNet.toFixed(2)}`));
  assert.match(md, new RegExp(`Holm p ${t1.holm.toFixed(3)}`));
});
