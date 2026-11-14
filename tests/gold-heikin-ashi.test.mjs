// research/edge/gold-heikin-ashi: the rule's pieces on hand-made candles, and RESULT.md against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { haColours, runs, flips, atrAt, trade, run, monthSums, holm, toDays, TESTS, P } from '../research/edge/gold-heikin-ashi/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const D = 86400, T0 = Date.UTC(2024, 0, 1) / 1000; // a Monday
function flat(n) { const ds = []; let t = T0; while (ds.length < n) { const w = new Date(t * 1000).getUTCDay(); if (w && w !== 6) ds.push({ time: t, open: 1000, high: 1005, low: 995, close: 1000 }); t += D; } return ds; }
const next = (ds) => { let t = ds.at(-1).time + D; while ([0, 6].includes(new Date(t * 1000).getUTCDay())) t += D; return t; };
const add = (ds, o, h, l, c) => { ds.push({ time: next(ds), open: o, high: h, low: l, close: c }); return ds.length - 1; };

test('Heikin-Ashi colours by hand; runs; a flip needs a run of k of the other colour', () => {
  const ds = [{ time: 0, open: 10, high: 12, low: 9, close: 11 }, { time: 1, open: 11, high: 14, low: 11, close: 13 }, { time: 2, open: 13, high: 13, low: 8, close: 9 }];
  // haO0 = 10.5, haC0 = 10.5 -> 0; haO1 = 10.5, haC1 = 12.25 -> green; haO2 = 11.375, haC2 = 10.75 -> red
  assert.deepEqual(haColours(ds), [0, 1, -1]);
  assert.deepEqual(runs([0, 1, 1, 1, -1, -1, 0, 1]), [0, 1, 2, 3, 1, 2, 0, 1]);
  const d2 = flat(20); for (let k = 0; k < 4; k++) add(d2, 1000 + 5 * k, 1010 + 5 * k, 998 + 5 * k, 1008 + 5 * k);
  const fl = add(d2, 1020, 1021, 980, 982);
  const col = haColours(d2);
  assert.equal(col[fl], -1); assert.ok(col[fl - 1] === 1 && runs(col)[fl - 1] >= 3);
  assert.deepEqual(flips(d2, 3).filter((s) => s.i >= 20), [{ i: fl, side: -1 }]);
  assert.deepEqual(flips(d2, runs(col)[fl - 1] + 1).filter((s) => s.i >= 20), []);
});

test('no look-ahead: colours, flips and ATR up to a day do not change with later days', () => {
  const ds = flat(20); for (let k = 0; k < 4; k++) add(ds, 1000 + 5 * k, 1010 + 5 * k, 998 + 5 * k, 1008 + 5 * k);
  const i = add(ds, 1020, 1021, 980, 982);
  const c0 = haColours(ds), f0 = flips(ds, 3), a = atrAt(ds, i);
  add(ds, 982, 5000, 1, 4000); add(ds, 4000, 4001, 3, 10);
  assert.deepEqual(haColours(ds).slice(0, i + 1), c0); assert.deepEqual(flips(ds, 3).filter((s) => s.i <= i), f0);
  assert.equal(atrAt(ds, i), a); assert.equal(atrAt(ds, P.atrN - 1), null);
});

test('entry next open, 2 x ATR stop, colour exit at the next open, financing on buys only', () => {
  const ds = flat(30), i = 29; // ATR 10 -> risk 20
  const e = add(ds, 1000, 1012, 995, 1010); add(ds, 1010, 1014, 1004, 1012); // green-ish days
  const red = add(ds, 1012, 1013, 985, 986); add(ds, 990, 995, 985, 992);
  const col = haColours(ds); assert.equal(col[red], -1);
  const firstAgainst = [e, e + 1, red].find((j) => col[j] === -1);
  const tr = trade(ds, col, i, 1, 'colour', 20);
  assert.equal(tr.entry, 1000); assert.equal(tr.stop, 980); assert.equal(tr.why, 'colour'); assert.equal(tr.xi, firstAgainst + 1);
  assert.equal(tr.exit, ds[firstAgainst + 1].open);
  assert.ok(Math.abs(tr.costR - 0.03) < 1e-12);
  const nn = nights(ds[e].time, ds[firstAgainst + 1].time); assert.equal(tr.nights, nn);
  assert.ok(Math.abs(tr.finR - nn * FIN.xau.long * 1000 / 20) < 1e-12);
  assert.ok(Math.abs(tr.net - (tr.R - tr.costR - tr.finR)) < 1e-12);
  const s = trade(ds, col, i, -1, 'time', 2); assert.equal(s.finR, 0); assert.equal(s.why, 'time'); assert.equal(s.exit, 1012);
  const x2 = trade(ds, col, i, 1, 'colour', 20, 2); assert.ok(Math.abs(x2.costR - 0.06) < 1e-12);
});

test('the stop is checked first; a gap through it fills at the open; a trade open at the data end is dropped', () => {
  const ds = flat(30), i = 29; add(ds, 1000, 1004, 975, 990);
  const col = haColours(ds);
  const tr = trade(ds, col, i, 1, 'colour', 20); assert.equal(tr.why, 'stop'); assert.equal(tr.exit, 980); assert.equal(tr.R, -1);
  const g = flat(30); add(g, 1000, 1004, 990, 1002); add(g, 960, 965, 950, 962);
  assert.equal(trade(g, haColours(g), 29, 1, 'time', 10).why, 'gap'); assert.equal(trade(g, haColours(g), 29, 1, 'time', 10).exit, 960);
  const open = flat(30); add(open, 1000, 1003, 997, 1001);
  assert.equal(trade(open, haColours(open), 29, 1, 'time', 10), null);
});

test('one position at a time; month sums count empty months; Holm; weekend folded; parameters', () => {
  const ds = flat(60), col = haColours(ds);
  const T = run(ds, col, [29, 30, 31, 40].map((i) => ({ i, side: 1 })), 'time', 5);
  assert.deepEqual(T.map((x) => x.ei), [30, 41]);
  assert.deepEqual(monthSums([{ d: '2024-01-05', net: 1 }, { d: '2024-03-02', net: -2 }], '2024-01-01', '2024-04-30'), [1, 0, -2, 0]);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const sat = Date.UTC(2024, 0, 6) / 1000;
  const days = toDays([[sat - D, 1, 2, 0.5, 1.5, 1], [sat + D, 1.5, 3, 1.4, 1.6, 1], [sat + 2 * D, 1.6, 1.7, 1.2, 1.3, 1]]);
  assert.equal(days.length, 2);
  assert.equal(P.atrN, 14); assert.equal(P.stopAtr, 2); assert.equal(P.cost, 0.60); assert.equal(P.seeds, 40);
  assert.deepEqual(TESTS.map((t) => [t.k, t.exit, t.hold]), [[3, 'colour', 20], [5, 'colour', 20], [3, 'time', 10]]);
});

test('RESULT.md agrees with result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-heikin-ashi/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gold-heikin-ashi/RESULT.md', import.meta.url), 'utf8');
  const vl = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(vl.startsWith(`**Verdict: ${r.verdict}:`)); assert.ok(vl.length < 220);
  const f = (v) => (v > 0 ? '+' : v < 0 ? '-' : '') + Math.abs(v).toFixed(3);
  for (const id of ['T1', 'T2', 'T3']) {
    const g = r.gold.tests[id], c = r.gold.checks[id], row = md.split('\n').find((l) => l.startsWith(`| ${id} `));
    const cells = row.split('|').map((s) => s.trim()).filter(Boolean);
    assert.deepEqual(cells.slice(1), [String(g.is.n), f(g.isGross.mean), f(g.is.mean), g.is.monthT.toFixed(2), String(g.oos.n), f(g.oosGross.mean), f(g.oos.mean), g.oos.monthT.toFixed(2), String(c.holmP), f(g.oos2x.mean), f(g.half1.mean), f(g.half2.mean), `${g.placebo.beaten} of 40`, c.pass ? 'yes' : 'no']);
  }
  assert.equal(r.verdict, r.gold.checks.T1.pass ? 'PASS' : 'FAIL');
  assert.ok(md.includes(`${r.gold.data.days.toLocaleString('en-US')} trading days`));
  assert.ok(md.includes(`Median stop $${r.gold.tests.T1.stopUsd.median.toFixed(2)}`));
  assert.ok(md.includes('Item 44'));
});
