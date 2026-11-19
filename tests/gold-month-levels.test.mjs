// Gold's previous calendar month high / low: the rule on hand-made days, no look-ahead, and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { daysOf, monthsOf, levels, signals, simulate, trades, touches, atr, holm, mulberry32, COST } from '../research/edge/gold-month-levels/run.mjs';

const U = (y, m, d) => Date.UTC(y, m - 1, d) / 1000;
// weekday rows of one month, each [o, h, l, c]
function month(y, m, bars) { const out = []; let d = 1;
  for (const b of bars) { while (true) { const t = U(y, m, d), wd = new Date(t * 1000).getUTCDay(); d++; if (wd !== 0 && wd !== 6) { out.push([t, ...b, 1]); break; } } }
  return out; }
const flat = (n, o = 100) => Array(n).fill([o, o + 5, o - 5, o]);

test('levels: last month high and low, months with too few days skipped, weekends folded', () => {
  const rows = [...month(2024, 1, flat(20)), ...month(2024, 2, [[100, 130, 70, 100], ...flat(19)]), ...month(2024, 3, flat(20))];
  const days = daysOf(rows), L = levels(monthsOf(days));
  assert.equal(L.length, 2); assert.equal(L[0].hi, 105); assert.equal(L[1].hi, 130); assert.equal(L[1].lo, 70);
  assert.equal(levels(monthsOf(daysOf([...month(2024, 1, flat(10)), ...month(2024, 2, flat(20))]))).length, 0);
  const wk = daysOf([[U(2024, 3, 2), 1, 9, 1, 2, 1], [U(2024, 3, 4), 2, 3, 2, 3, 1]]);   // Saturday then Monday
  assert.equal(wk.length, 1); assert.equal(wk[0].high, 9); assert.equal(wk[0].open, 1);
});

test('T1: the first day above last month high that closes back below sells next open; stop $0.30 over its high, target the low', () => {
  const rows = [...month(2024, 1, flat(20)), ...month(2024, 2, [[100, 104, 96, 100], [100, 108, 99, 103], [102, 103, 94, 95], ...flat(17, 95)])];
  const days = daysOf(rows), L = levels(monthsOf(days)), s = signals(days, L[0], 'rev');
  const sell = s.find((x) => x.side < 0); assert.equal(days[sell.i].high, 108); assert.equal(+sell.stop.toFixed(2), 108.3); assert.equal(sell.target, 95);
  const T = trades(days, L, 'T1'); assert.equal(T[0].side, -1); assert.equal(T[0].entry, 102); assert.equal(T[0].how, 'target'); assert.equal(T[0].exit, 95);
  assert.equal(T[0].finR, 0, 'sells pay no financing'); assert.ok(Math.abs(T[0].net - (T[0].R - COST / T[0].risk)) < 1e-12);
});

test('T2 / T3: a close beyond the level buys next open with a 1.5 ATR stop, held 10 days; buys pay financing; T3 has no sells', () => {
  const rows = [...month(2024, 1, flat(20)), ...month(2024, 2, [[100, 110, 99, 109], ...Array(15).fill([110, 112, 108, 111])])];
  const days = daysOf(rows), L = levels(monthsOf(days)), T = trades(days, L, 'T2');
  assert.equal(T.length, 1); const x = T[0]; const i = x.e - 1;
  assert.ok(Math.abs(x.stop - (days[x.e].open - 1.5 * atr(days, i))) < 1e-9); assert.equal(x.how, 'time'); assert.equal(x.x - x.e, 9);
  assert.ok(x.nights > 0 && x.finR > 0);
  const dn = [...month(2024, 1, flat(20)), ...month(2024, 2, [[100, 101, 90, 91], ...Array(15).fill([90, 92, 88, 89])])];
  const d2 = daysOf(dn), L2 = levels(monthsOf(d2));
  assert.equal(trades(d2, L2, 'T2')[0].side, -1); assert.equal(trades(d2, L2, 'T3').length, 0);
});

test('stop first when a day holds both, a gap through the stop fills at the open', () => {
  const days = [{ time: 0, open: 100, high: 100, low: 100, close: 100 }, { time: 86400, open: 100, high: 120, low: 80, close: 100 }, ...Array(12).fill(0).map((_, k) => ({ time: (k + 2) * 86400, open: 100, high: 101, low: 99, close: 100 }))];
  assert.equal(simulate(days, 1, 1, 90, 110).how, 'stop');
  const g = [{ time: 0, open: 100, high: 101, low: 99, close: 100 }, { time: 86400, open: 85, high: 86, low: 84, close: 85 }, ...Array(10).fill({ time: 2 * 86400, open: 85, high: 85, low: 85, close: 85 })];
  assert.equal(simulate(g, 0, 1, 90, null).exit, 85);
});

test('no look-ahead: changing every day after the signal day leaves the signal and its levels alone', () => {
  const rows = [...month(2024, 1, flat(20)), ...month(2024, 2, [[100, 104, 96, 100], [100, 108, 99, 103], ...flat(18, 100)])];
  const a = daysOf(rows), b = a.map((d, i) => (i > 21 ? { ...d, high: d.high + 50, low: d.low - 50, close: d.close + 7 } : d));
  const sa = signals(a, levels(monthsOf(a))[0], 'rev').find((x) => x.side < 0), sb = signals(b, levels(monthsOf(b))[0], 'rev').find((x) => x.side < 0);
  assert.deepEqual(sa, sb); assert.equal(atr(a, 21), atr(b, 21));
});

test('one position at a time, the placebo is seeded, Holm adjusts', () => {
  const rows = [...month(2024, 1, flat(20)), ...month(2024, 2, [[100, 108, 92, 100], ...flat(19)])];
  const days = daysOf(rows), T = trades(days, levels(monthsOf(days)), 'T1');
  for (let k = 1; k < T.length; k++) assert.ok(T[k].e > T[k - 1].x);
  const m = monthsOf(days); assert.deepEqual(levels(m, mulberry32(3)), levels(m, mulberry32(3)));
  assert.notDeepEqual(levels(m, mulberry32(3)), levels(m));
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(4)), [0.03, 0.06, 0.06]);
  assert.ok(touches(days, levels(m)).length >= 1);
});

test('the report says what result.json says', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-month-levels/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gold-month-levels/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.verdict, 'FAIL'); assert.match(md, /\*\*Verdict: FAIL, 0 of 3 tests/);
  assert.equal(Object.values(r.tests).filter((x) => x.pass).length, 0);
  const f = (v, d = 3) => (v > 0 ? '+' : '') + v.toFixed(d);
  for (const [k, x] of Object.entries(r.tests)) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${k} `)); assert.ok(row, k);
    const cells = row.split('|').slice(2, -1).map((c) => c.trim());
    assert.deepEqual(cells, [String(x.is.n), f(x.is.gross), f(x.is.avg), x.is.tMonth.toFixed(2), String(x.oos.n), f(x.oos.gross), f(x.oos.avg), x.oos.pf.toFixed(2), x.oos.tMonth.toFixed(2), x.holmP.toFixed(4), f(x.x2.oos.avg), `${x.placebo.beat} of 40`], k);
  }
  const head = md.split('\n').find((l) => l.startsWith('**Verdict')); assert.ok(head.length < 220 + 14);
});
