// research/edge/gold-streak: the rule's pieces on hand-made candles, and RESULT.md against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { streaks, signals, atrAt, trade, run, monthSums, holm, toDays, TESTS, P } from '../research/edge/gold-streak/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const D = 86400, T0 = Date.UTC(2024, 0, 1) / 1000; // a Monday
// flat weekday candles: range 10 around 1000 (true range 10), then whatever the test appends
function flat(n) { const ds = []; let t = T0; while (ds.length < n) { const w = new Date(t * 1000).getUTCDay(); if (w && w !== 6) ds.push({ time: t, open: 1000, high: 1005, low: 995, close: 1000 }); t += D; } return ds; }
const next = (ds) => { let t = ds.at(-1).time + D; while ([0, 6].includes(new Date(t * 1000).getUTCDay())) t += D; return t; };
const add = (ds, o, h, l, c) => { ds.push({ time: next(ds), open: o, high: h, low: l, close: c }); return ds.length - 1; };

test('streaks count closes in a row; an equal close ends a streak', () => {
  const ds = flat(20);
  add(ds, 1000, 1001, 995, 999); add(ds, 999, 1000, 994, 998); const i3 = add(ds, 998, 999, 993, 997);
  const i4 = add(ds, 997, 998, 992, 996); const eq = add(ds, 996, 997, 995, 996); const up = add(ds, 996, 1000, 995, 999);
  const s = streaks(ds);
  assert.equal(s[i3], -3); assert.equal(s[i4], -4); assert.equal(s[eq], 0); assert.equal(s[up], 1);
  assert.deepEqual(signals(ds, TESTS[0]), [i3, i4]); // 3+ down
  assert.deepEqual(signals(ds, TESTS[2]), [i4]);     // 4+ down
  assert.deepEqual(signals(ds, TESTS[1]), []);       // no 3+ up
});

test('no look-ahead: a signal and its ATR do not change with later days', () => {
  const ds = flat(20); add(ds, 1000, 1001, 995, 999); add(ds, 999, 1000, 994, 998); const i = add(ds, 998, 999, 993, 997);
  const a = atrAt(ds, i), sig = signals(ds, TESTS[0]);
  add(ds, 997, 5000, 1, 4000); add(ds, 4000, 4001, 3999, 4000);
  assert.equal(atrAt(ds, i), a); assert.deepEqual(signals(ds, TESTS[0]).filter((k) => k <= i), sig);
  assert.equal(atrAt(ds, P.atrN - 1), null);
});

test('entry at the next open, 1.5 x ATR stop, close exit, financing on buys only', () => {
  const ds = flat(30), i = 29; // ATR 10 -> risk 15
  add(ds, 1000, 1010, 990, 1006);
  const tr = trade(ds, i, 1, 1);
  assert.equal(tr.entry, 1000); assert.equal(tr.stop, 985); assert.equal(tr.why, 'time'); assert.equal(tr.exit, 1006);
  assert.ok(Math.abs(tr.R - 0.4) < 1e-12); assert.ok(Math.abs(tr.costR - 0.04) < 1e-12);
  const nn = nights(ds[i + 1].time, ds[i + 1].time + D); assert.equal(tr.nights, nn); assert.ok(nn >= 1);
  assert.ok(Math.abs(tr.finR - nn * FIN.xau.long * 1000 / 15) < 1e-12);
  assert.ok(Math.abs(tr.net - (tr.R - tr.costR - tr.finR)) < 1e-12);
  const s = trade(ds, i, -1, 1); assert.equal(s.finR, 0); assert.ok(Math.abs(s.R + 0.4) < 1e-12);
  const x2 = trade(ds, i, 1, 1, 2); assert.ok(Math.abs(x2.costR - 0.08) < 1e-12); assert.ok(Math.abs(x2.finR - 2 * tr.finR) < 1e-12);
});

test('stop on the losing side; a gap through it on a later day fills at the open', () => {
  const ds = flat(30), i = 29; add(ds, 1000, 1004, 980, 990);
  const tr = trade(ds, i, 1, 1); assert.equal(tr.why, 'stop'); assert.equal(tr.exit, 985); assert.equal(tr.R, -1);
  const g = flat(30); add(g, 1000, 1004, 990, 992); add(g, 970, 975, 960, 972); add(g, 972, 973, 970, 971);
  const tg = trade(g, 29, 1, 3); assert.equal(tg.why, 'gap'); assert.equal(tg.exit, 970);
  const sh = flat(30); add(sh, 1000, 1016, 995, 1001); assert.equal(trade(sh, 29, -1, 1).exit, 1015);
});

test('one position at a time; month sums count empty months; Holm; weekend folded', () => {
  const ds = flat(40);
  assert.deepEqual(run(ds, [29, 30, 31, 32], 3, () => 1).map((x) => x.ei), [30, 33]);
  const ms = monthSums([{ d: '2024-01-05', net: 1 }, { d: '2024-03-02', net: -2 }], '2024-01-01', '2024-04-30');
  assert.deepEqual(ms, [1, 0, -2, 0]);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const sat = Date.UTC(2024, 0, 6) / 1000;
  const days = toDays([[sat - D, 1, 2, 0.5, 1.5, 1], [sat + D, 1.5, 3, 1.4, 1.6, 1], [sat + 2 * D, 1.6, 1.7, 1.2, 1.3, 1]]);
  assert.equal(days.length, 2); assert.equal(days[1].open, 1.5); assert.equal(days[1].high, 3); assert.equal(days[1].low, 1.2);
  assert.equal(P.atrN, 14); assert.equal(P.stopAtr, 1.5); assert.equal(P.cost, 0.60); assert.equal(P.seeds, 40);
});

test('RESULT.md agrees with result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-streak/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gold-streak/RESULT.md', import.meta.url), 'utf8');
  const vl = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(vl.startsWith(`**Verdict: ${r.verdict}:`)); assert.ok(vl.length < 220);
  const f = (v) => (v > 0 ? '+' : v < 0 ? '-' : '') + Math.abs(v).toFixed(3);
  for (const id of ['T1', 'T2', 'T3']) {
    const g = r.gold.tests[id], c = r.gold.checks[id], row = md.split('\n').find((l) => l.startsWith(`| ${id} `));
    const cells = row.split('|').map((s) => s.trim()).filter(Boolean);
    assert.deepEqual(cells.slice(1), [String(g.is.n), f(g.isGross.mean), f(g.is.mean), g.is.monthT.toFixed(2), String(g.oos.n), f(g.oosGross.mean), f(g.oos.mean), g.oos.monthT.toFixed(2), String(c.holmP), f(g.oos2x.mean), f(g.half1.mean), f(g.half2.mean), `${g.placebo.beaten} of 40`, c.pass ? 'yes' : 'no']);
  }
  assert.equal(r.verdict, r.gold.passed.length ? 'PASS' : 'FAIL');
  assert.ok(md.includes(`${r.gold.data.days.toLocaleString('en-US')} trading days`));
  assert.ok(md.includes('Item 44'));
});
