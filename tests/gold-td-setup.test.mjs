// research/edge/gold-td-setup: the count on hand-made candles, no look-ahead, and RESULT.md against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { counts, signals, atrAt, trade, run, monthSums, holm, TESTS, P } from '../research/edge/gold-td-setup/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const D = 86400, T0 = Date.UTC(2024, 0, 1) / 1000; // a Monday
function flat(n) { const ds = []; let t = T0; while (ds.length < n) { const w = new Date(t * 1000).getUTCDay(); if (w && w !== 6) ds.push({ time: t, open: 1000, high: 1005, low: 995, close: 1000 }); t += D; } return ds; }
const next = (ds) => { let t = ds.at(-1).time + D; while ([0, 6].includes(new Date(t * 1000).getUTCDay())) t += D; return t; };
const add = (ds, c, lo) => { ds.push({ time: next(ds), open: c, high: c + 5, low: lo ?? c - 5, close: c }); return ds.length - 1; };

test('the buy count compares each close with the close 4 days earlier and signals once at exactly 9', () => {
  const ds = flat(20), idx = [];
  // a slow fall with up days inside it: every close still below the close 4 days back
  for (const c of [999, 998, 999, 997, 996, 997, 995, 994, 995, 993, 992]) idx.push(add(ds, c));
  const c = counts(ds);
  assert.deepEqual(idx.map((i) => c.buy[i]), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.deepEqual(signals(ds, TESTS[0]), [idx[8]]);
  assert.deepEqual(signals(ds, TESTS[1]), []);
  const brk = add(ds, 1000); assert.equal(counts(ds).buy[brk], 0); // a close above the close 4 back ends it
});

test('perfected buy needs the day-8 or day-9 low at or below the day-6 and day-7 lows', () => {
  const mk = (low9) => { const ds = flat(20), idx = []; for (const c of [999, 998, 997, 996, 995, 994, 993, 992]) idx.push(add(ds, c)); idx.push(add(ds, 991, low9)); return { ds, i: idx[8] }; };
  const a = mk(980); assert.deepEqual(signals(a.ds, TESTS[2]), [a.i]);
  const b = mk(1000); b.ds[b.i - 1].low = 1000; assert.deepEqual(signals(b.ds, TESTS[2]), []);
  assert.deepEqual(signals(b.ds, TESTS[0]), [b.i]);
});

test('sell count mirrors, and no look-ahead: later days never change a past signal or ATR', () => {
  const ds = flat(20), idx = []; for (let k = 1; k <= 9; k++) idx.push(add(ds, 1000 + k));
  assert.deepEqual(signals(ds, TESTS[1]), [idx[8]]);
  const a = atrAt(ds, idx[8]);
  add(ds, 50); add(ds, 9000);
  assert.deepEqual(signals(ds, TESTS[1]).filter((i) => i <= idx[8]), [idx[8]]);
  assert.equal(atrAt(ds, idx[8]), a);
});

test('entry at the next open, 1.5 x ATR stop, time exit, financing on buys only', () => {
  const ds = flat(30), i = 29; // ATR 10 -> risk 15
  ds.push({ time: next(ds), open: 1000, high: 1010, low: 990, close: 1003 });
  ds.push({ time: next(ds), open: 1003, high: 1010, low: 990, close: 1004 });
  ds.push({ time: next(ds), open: 1004, high: 1010, low: 990, close: 1006 });
  const tr = trade(ds, i, 1, 3);
  assert.equal(tr.entry, 1000); assert.equal(tr.stop, 985); assert.equal(tr.why, 'time'); assert.equal(tr.exit, 1006);
  assert.ok(Math.abs(tr.R - 0.4) < 1e-12); assert.ok(Math.abs(tr.costR - 0.04) < 1e-12);
  const nn = nights(ds[30].time, ds[32].time + D); assert.equal(tr.nights, nn);
  assert.ok(Math.abs(tr.finR - nn * FIN.xau.long * 1000 / 15) < 1e-12);
  assert.equal(trade(ds, i, -1, 3).finR, 0);
  assert.deepEqual(run(ds, [29, 30, 31], 3, () => 1).map((x) => x.ei), [30]);
  const st = flat(30); st.push({ time: next(st), open: 1000, high: 1004, low: 980, close: 990 });
  assert.equal(trade(st, 29, 1, 1).exit, 985);
});

test('month sums, Holm, parameters', () => {
  assert.deepEqual(monthSums([{ d: '2024-01-05', net: 1 }, { d: '2024-03-02', net: -2 }], '2024-01-01', '2024-04-30'), [1, 0, -2, 0]);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  assert.equal(P.lag, 4); assert.equal(P.k, 9); assert.equal(P.cost, 0.60); assert.equal(P.isFrom, '2007-01-01'); assert.equal(P.oosFrom, '2017-01-01');
});

test('RESULT.md agrees with result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-td-setup/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gold-td-setup/RESULT.md', import.meta.url), 'utf8');
  const vl = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(vl.startsWith(`**Verdict: ${r.verdict}:`)); assert.ok(vl.length < 220);
  const f = (v) => (v > 0 ? '+' : v < 0 ? '-' : '') + Math.abs(v).toFixed(3);
  for (const id of ['T1', 'T2', 'T3']) {
    const g = r.gold.tests[id], c = r.gold.checks[id], b = r.gold.baselines[id];
    const cells = md.split('\n').find((l) => l.startsWith(`| ${id} | ${g.is.n}`)).split('|').map((s) => s.trim()).filter(Boolean);
    assert.deepEqual(cells.slice(1), [String(g.is.n), f(g.isGross.mean), f(g.is.mean), g.is.monthT.toFixed(2), String(g.oos.n), f(g.oosGross.mean), f(g.oos.mean), g.oos.monthT.toFixed(2), String(c.holmP), f(g.oos2x.mean), f(g.half1.mean), f(g.half2.mean), `${g.placebo.beaten} of 40`, c.pass ? 'yes' : 'no']);
    const ex = md.split('\n').find((l) => l.startsWith(`| ${id} | ${b.name}`)).split('|').map((s) => s.trim()).filter(Boolean);
    assert.deepEqual(ex.slice(2), [f(b.oos.mean), `${f(g.excess.is.mean)} (${g.excess.is.monthT.toFixed(2)})`, `${f(g.excess.oos.mean)} (${g.excess.oos.monthT.toFixed(2)})`, g.vsBaseline.welchT.toFixed(2)]);
  }
  assert.equal(r.verdict, r.gold.passed.length ? 'PASS' : 'FAIL');
  assert.ok(md.includes(`${r.gold.data.days.toLocaleString('en-US')} trading days`));
  assert.ok(md.includes('Item 44'));
});
