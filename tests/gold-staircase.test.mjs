// research/edge/gold-staircase: the rule's pieces on hand-made candles, and RESULT.md against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { step, stairs, signals, atrAt, trade, run, monthSums, holm, toDays, TESTS, P } from '../research/edge/gold-staircase/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const D = 86400, T0 = Date.UTC(2024, 0, 1) / 1000; // a Monday
function flat(n) { const ds = []; let t = T0; while (ds.length < n) { const w = new Date(t * 1000).getUTCDay(); if (w && w !== 6) ds.push({ time: t, open: 1000, high: 1005, low: 995, close: 1000 }); t += D; } return ds; }
const next = (ds) => { let t = ds.at(-1).time + D; while ([0, 6].includes(new Date(t * 1000).getUTCDay())) t += D; return t; };
const add = (ds, o, h, l, c) => { ds.push({ time: next(ds), open: o, high: h, low: l, close: c }); return ds.length - 1; };

test('a step needs BOTH a higher high and a higher low (or both lower); the close does not matter', () => {
  const ds = flat(20);
  const a = add(ds, 1000, 1006, 996, 990);   // up step, closed down
  const b = add(ds, 990, 1007, 995, 1001);   // higher high, lower low: no step
  const c = add(ds, 1000, 1006, 994, 999);   // lower high, lower low: down step
  assert.equal(step(ds, a), 1); assert.equal(step(ds, b), 0); assert.equal(step(ds, c), -1);
});

test('staircase counts steps in a row; signals pick 3+', () => {
  const ds = flat(20);
  add(ds, 1000, 1006, 996, 1003); add(ds, 1003, 1007, 997, 1004); const u3 = add(ds, 1004, 1008, 998, 1005);
  const u4 = add(ds, 1005, 1009, 999, 1006); const br = add(ds, 1006, 1010, 990, 1000);
  add(ds, 1000, 1008, 989, 995); add(ds, 995, 1007, 988, 994); const d3 = add(ds, 994, 1006, 987, 993);
  const s = stairs(ds);
  assert.equal(s[u3], 3); assert.equal(s[u4], 4); assert.equal(s[br], 0); assert.equal(s[d3], -3);
  assert.deepEqual(signals(ds, TESTS[0]), [u3, u4]);
  assert.deepEqual(signals(ds, TESTS[1]), [d3]);
  assert.deepEqual(signals(ds, TESTS[2]), [d3]);
});

test('no look-ahead: a signal and its ATR do not change with later days', () => {
  const ds = flat(20); add(ds, 1000, 1006, 996, 1003); add(ds, 1003, 1007, 997, 1004); const i = add(ds, 1004, 1008, 998, 1005);
  const a = atrAt(ds, i), sig = signals(ds, TESTS[0]);
  add(ds, 997, 5000, 1, 4000); add(ds, 4000, 4001, 3999, 4000);
  assert.equal(atrAt(ds, i), a); assert.deepEqual(signals(ds, TESTS[0]).filter((k) => k <= i), sig);
  assert.equal(atrAt(ds, P.atrN - 1), null);
});

test('entry at the next open, 1.5 x ATR stop, 3-day close exit, financing on buys only', () => {
  const ds = flat(30), i = 29; // ATR 10 -> risk 15
  add(ds, 1000, 1004, 996, 1001); add(ds, 1001, 1004, 996, 1002); add(ds, 1002, 1008, 998, 1006);
  const tr = trade(ds, i, 1, 3);
  assert.equal(tr.entry, 1000); assert.equal(tr.stop, 985); assert.equal(tr.why, 'time'); assert.equal(tr.exit, 1006); assert.equal(tr.xi, i + 3);
  assert.ok(Math.abs(tr.R - 0.4) < 1e-12); assert.ok(Math.abs(tr.costR - 0.04) < 1e-12);
  const nn = nights(ds[i + 1].time, ds[i + 3].time + D); assert.equal(tr.nights, nn); assert.ok(nn >= 3);
  assert.ok(Math.abs(tr.finR - nn * FIN.xau.long * 1000 / 15) < 1e-12);
  const s = trade(ds, i, -1, 3); assert.equal(s.finR, 0); assert.ok(Math.abs(s.R + 0.4) < 1e-12);
  const g = flat(30); add(g, 1000, 1004, 990, 992); add(g, 970, 975, 960, 972); add(g, 972, 973, 970, 971);
  const tg = trade(g, 29, 1, 3); assert.equal(tg.why, 'gap'); assert.equal(tg.exit, 970);
});

test('one position at a time; month sums count empty months; Holm; weekend folded; preregistered parameters', () => {
  const ds = flat(40);
  assert.deepEqual(run(ds, [29, 30, 31, 32], 3, () => 1).map((x) => x.ei), [30, 33]);
  assert.deepEqual(monthSums([{ d: '2024-01-05', net: 1 }, { d: '2024-03-02', net: -2 }], '2024-01-01', '2024-04-30'), [1, 0, -2, 0]);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const sat = Date.UTC(2024, 0, 6) / 1000;
  const days = toDays([[sat - D, 1, 2, 0.5, 1.5, 1], [sat + D, 1.5, 3, 1.4, 1.6, 1], [sat + 2 * D, 1.6, 1.7, 1.2, 1.3, 1]]);
  assert.equal(days.length, 2); assert.equal(days[1].high, 3); assert.equal(days[1].low, 1.2);
  assert.equal(P.isFrom, '2007-01-01'); assert.equal(P.oosFrom, '2017-01-01'); assert.equal(P.cost, 0.60); assert.equal(P.seeds, 40);
  assert.deepEqual(TESTS.map((t) => [t.dir, t.k, t.side, t.hold]), [[1, 3, 1, 3], [-1, 3, -1, 3], [-1, 3, 1, 3]]);
});

test('RESULT.md agrees with result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-staircase/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gold-staircase/RESULT.md', import.meta.url), 'utf8');
  const vl = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(vl.startsWith(`**Verdict: ${r.verdict}:`)); assert.ok(vl.length < 220);
  const f = (v) => (v > 0 ? '+' : v < 0 ? '-' : '') + Math.abs(v).toFixed(3);
  for (const id of ['T1', 'T2', 'T3']) {
    const g = r.gold.tests[id], c = r.gold.checks[id], row = md.split('\n').find((l) => l.startsWith(`| ${id} `));
    const cells = row.split('|').map((s) => s.trim()).filter(Boolean);
    assert.deepEqual(cells.slice(1), [String(g.is.n), f(g.isGross.mean), f(g.is.mean), g.is.monthT.toFixed(2), String(g.oos.n), f(g.oosGross.mean), f(g.oos.mean), g.oos.monthT.toFixed(2), String(c.holmP), f(g.oos2x.mean), f(g.vsBaseline.diff), g.vsBaseline.welchT.toFixed(2), `${g.placebo.beaten} of 40`, c.pass ? 'yes' : 'no']);
  }
  assert.equal(r.verdict, r.gold.passed.length ? 'PASS' : 'FAIL');
  assert.ok(md.includes(`${r.gold.data.days.toLocaleString('en-US')} trading days`));
  assert.ok(md.includes('Item 44'));
});
