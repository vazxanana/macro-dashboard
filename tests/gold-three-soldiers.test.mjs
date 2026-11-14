// research/edge/gold-three-soldiers: the rule's pieces on hand-made candles, and RESULT.md against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { strong, pattern, signals, atrAt, trade, run, monthSums, holm, toDays, TESTS, P } from '../research/edge/gold-three-soldiers/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const D = 86400, T0 = Date.UTC(2024, 0, 1) / 1000; // a Monday
function flat(n) { const ds = []; let t = T0; while (ds.length < n) { const w = new Date(t * 1000).getUTCDay(); if (w && w !== 6) ds.push({ time: t, open: 1000, high: 1005, low: 995, close: 1000 }); t += D; } return ds; }
const next = (ds) => { let t = ds.at(-1).time + D; while ([0, 6].includes(new Date(t * 1000).getUTCDay())) t += D; return t; };
const add = (ds, o, h, l, c) => { ds.push({ time: next(ds), open: o, high: h, low: l, close: c }); return ds.length - 1; };

test('strong days need a long body the right way and a close beyond the previous close', () => {
  const ds = flat(5);
  const a = add(ds, 1000, 1012, 999, 1010);   // body 10 of range 13: strong at 0.5
  const b = add(ds, 1010, 1030, 1000, 1015);  // body 5 of 30: not at 0.5, yes at 0.1
  const c = add(ds, 1016, 1016, 1005, 1014);  // red: not up
  assert.equal(strong(ds, a, 1, 0.5), true); assert.equal(strong(ds, a, -1, 0.5), false);
  assert.equal(strong(ds, b, 1, 0.5), false); assert.equal(strong(ds, b, 1, 0.1), true);
  assert.equal(strong(ds, c, 1, 0.1), false);
  const d = add(ds, 1000, 1013, 999, 1012);   // green, long body, but close below the previous close? no: 1012 < 1014
  assert.equal(strong(ds, d, 1, 0.5), false);
});

test('three soldiers / crows and the side each test takes', () => {
  const ds = flat(25);
  add(ds, 1000, 1011, 999, 1010); add(ds, 1010, 1021, 1009, 1020); const s = add(ds, 1020, 1031, 1019, 1030);
  add(ds, 1030, 1031, 1019, 1020); add(ds, 1020, 1021, 1009, 1010); const c = add(ds, 1010, 1011, 999, 1000);
  assert.equal(pattern(ds, s, 0.5), 1); assert.equal(pattern(ds, c, 0.5), -1); assert.equal(pattern(ds, s - 1, 0.5), 0);
  assert.deepEqual(signals(ds, TESTS[0]), [[s, 1], [c, -1]]);  // continuation
  assert.deepEqual(signals(ds, TESTS[1]), [[s, -1], [c, 1]]);  // fade
});

test('no look-ahead: a signal and its ATR do not change with later days', () => {
  const ds = flat(25);
  add(ds, 1000, 1011, 999, 1010); add(ds, 1010, 1021, 1009, 1020); const s = add(ds, 1020, 1031, 1019, 1030);
  const a = atrAt(ds, s), sig = signals(ds, TESTS[0]);
  add(ds, 1030, 5000, 1, 4000); add(ds, 4000, 4001, 3999, 4000);
  assert.equal(atrAt(ds, s), a); assert.deepEqual(signals(ds, TESTS[0]).filter(([k]) => k <= s), sig);
  assert.equal(atrAt(ds, P.atrN - 1), null);
});

test('entry at the next open, 2 x ATR(20) stop, close exit after the hold, financing on buys only', () => {
  const ds = flat(30), i = 29; // ATR 10 -> risk 20
  add(ds, 1000, 1010, 990, 1004); add(ds, 1004, 1010, 995, 1008);
  const tr = trade(ds, i, 1, 2);
  assert.equal(tr.entry, 1000); assert.equal(tr.stop, 980); assert.equal(tr.why, 'time'); assert.equal(tr.exit, 1008);
  assert.ok(Math.abs(tr.R - 0.4) < 1e-12); assert.ok(Math.abs(tr.costR - 0.03) < 1e-12);
  const nn = nights(ds[i + 1].time, ds[i + 2].time + D); assert.equal(tr.nights, nn); assert.ok(nn >= 2);
  assert.ok(Math.abs(tr.finR - nn * FIN.xau.long * 1000 / 20) < 1e-12);
  assert.ok(Math.abs(tr.net - (tr.R - tr.costR - tr.finR)) < 1e-12);
  const s = trade(ds, i, -1, 2); assert.equal(s.finR, 0); assert.ok(Math.abs(s.R + 0.4) < 1e-12);
  const x2 = trade(ds, i, 1, 2, 2); assert.ok(Math.abs(x2.costR - 0.06) < 1e-12); assert.ok(Math.abs(x2.finR - 2 * tr.finR) < 1e-12);
  assert.equal(trade(ds, i, 1, 5), null); // not enough days left to hold
});

test('every trade has a stop on the losing side; a gap through it fills at the open', () => {
  const ds = flat(30), i = 29; add(ds, 1000, 1004, 970, 990);
  const tr = trade(ds, i, 1, 1); assert.ok(tr.stop < tr.entry); assert.equal(tr.why, 'stop'); assert.equal(tr.exit, 980); assert.equal(tr.R, -1);
  const g = flat(30); add(g, 1000, 1004, 990, 992); add(g, 960, 975, 955, 972); add(g, 972, 973, 970, 971);
  const tg = trade(g, 29, 1, 3); assert.equal(tg.why, 'gap'); assert.equal(tg.exit, 960);
  const sh = flat(30); add(sh, 1000, 1025, 995, 1001); const ts = trade(sh, 29, -1, 1); assert.ok(ts.stop > ts.entry); assert.equal(ts.exit, 1020);
});

test('one position at a time; month sums count empty months; Holm; weekend folded', () => {
  const ds = flat(40);
  assert.deepEqual(run(ds, [[25, 1], [26, -1], [27, 1], [28, 1]], 3).map((x) => [x.ei, x.side]), [[26, 1], [29, 1]]);
  const ms = monthSums([{ d: '2024-01-05', net: 1 }, { d: '2024-03-02', net: -2 }], '2024-01-01', '2024-04-30');
  assert.deepEqual(ms, [1, 0, -2, 0]);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const sat = Date.UTC(2024, 0, 6) / 1000;
  const days = toDays([[sat - D, 1, 2, 0.5, 1.5, 1], [sat + D, 1.5, 3, 1.4, 1.6, 1], [sat + 2 * D, 1.6, 1.7, 1.2, 1.3, 1]]);
  assert.equal(days.length, 2); assert.equal(days[1].open, 1.5); assert.equal(days[1].high, 3); assert.equal(days[1].low, 1.2);
  assert.equal(P.atrN, 20); assert.equal(P.stopAtr, 2); assert.equal(P.cost, 0.60); assert.equal(P.seeds, 40);
  assert.deepEqual(TESTS.map((t) => [t.body, t.mode, t.hold]), [[0.5, 1, 10], [0.5, -1, 5], [0.3, 1, 10]]);
});

test('RESULT.md agrees with result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-three-soldiers/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gold-three-soldiers/RESULT.md', import.meta.url), 'utf8');
  const vl = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(vl.startsWith(`**Verdict: ${r.verdict}:`)); assert.ok(vl.length < 220);
  const f = (v) => (v > 0 ? '+' : v < 0 ? '-' : '') + Math.abs(v).toFixed(3);
  for (const id of ['T1', 'T2', 'T3']) {
    const g = r.gold.tests[id], c = r.gold.checks[id], row = md.split('\n').find((l) => l.startsWith(`| ${id} `) && l.includes(' of 40 '));
    const cells = row.split('|').map((s) => s.trim()).filter(Boolean);
    assert.deepEqual(cells.slice(1), [String(g.is.n), f(g.isGross.mean), f(g.is.mean), g.is.monthT.toFixed(2), String(g.oos.n), f(g.oosGross.mean), f(g.oos.mean), g.oos.monthT.toFixed(2), String(c.holmP), f(g.oos2x.mean), f(g.half1.mean), f(g.half2.mean), `${g.placebo.beaten} of 40`, c.pass ? 'yes' : 'no']);
    const b = md.split('\n').find((l) => l.startsWith(`| ${id} |`) && l.includes('Welch') === false && l.includes(String(g.vsBaseline.welchT.toFixed(2))));
    assert.ok(b, `baseline row ${id}`);
    assert.ok(b.includes(`${g.oosBuys.n} / ${f(g.oosBuys.net)}`) && b.includes(`${g.oosSells.n} / ${f(g.oosSells.net)}`) && b.includes(f(g.vsBaseline.diff)));
  }
  assert.equal(r.verdict, r.gold.passed.length ? 'PASS' : 'FAIL');
  assert.ok(md.includes(`${r.gold.data.days.toLocaleString('en-US')} trading days`));
  assert.ok(md.includes('Item 44'));
});
