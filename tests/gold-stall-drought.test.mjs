// research/edge/gold-stall-drought: the rule's pieces on hand-made candles, and RESULT.md against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { extremes, signals, atrAt, trade, run, monthSums, holm, control, toDays, report, P } from '../research/edge/gold-stall-drought/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const D = 86400, T0 = Date.UTC(2024, 0, 1) / 1000; // a Monday
function flat(n, c = 1000) { const ds = []; let t = T0; while (ds.length < n) { const w = new Date(t * 1000).getUTCDay(); if (w && w !== 6) ds.push({ time: t, open: c, high: c + 5, low: c - 5, close: c }); t += D; } return ds; }
const next = (ds) => { let t = ds.at(-1).time + D; while ([0, 6].includes(new Date(t * 1000).getUTCDay())) t += D; return t; };
const add = (ds, o, h, l, c) => { ds.push({ time: next(ds), open: o, high: h, low: l, close: c }); return ds.length - 1; };

test('new 20-day closing extremes are strict and read only the 20 closes before', () => {
  const ds = flat(25);
  const hi = add(ds, 1000, 1012, 999, 1010), eq = add(ds, 1010, 1011, 1005, 1010), lo = add(ds, 1000, 1001, 900, 950);
  const e = extremes(ds);
  assert.equal(e[hi], 1); assert.equal(e[eq], 0); assert.equal(e[lo], -1);
  assert.ok(e.slice(0, 20).every((v) => v === 0));
  assert.equal(e[20], 0); // a flat close equal to the max is not new
});

test('a signal needs 7+ days without a new extreme; the stall counts days strictly between', () => {
  const ds = flat(21);
  const a = add(ds, 1000, 1011, 999, 1010);            // new high, no previous extreme: not a signal
  for (let k = 0; k < 6; k++) add(ds, 1005, 1008, 1002, 1005); // 6 quiet days
  const b = add(ds, 1010, 1021, 1009, 1020);           // new high after a 6-day stall: not a signal
  for (let k = 0; k < 7; k++) add(ds, 1015, 1018, 1012, 1015); // 7 quiet days
  const c = add(ds, 1000, 1001, 960, 970);             // new low after a 7-day stall: signal, dir -1
  const s = signals(ds);
  assert.equal(extremes(ds)[a], 1); assert.equal(extremes(ds)[b], 1);
  assert.deepEqual(s, [{ i: c, dir: -1, stall: 7 }]);
  assert.deepEqual(signals(ds, 6).map((x) => x.i), [b, c]);
});

test('no look-ahead: signals, extremes and ATR at day i do not change when later days change', () => {
  const ds = flat(21); add(ds, 1000, 1011, 999, 1010);
  for (let k = 0; k < 8; k++) add(ds, 1005, 1008, 1002, 1005);
  const i = add(ds, 1010, 1031, 1009, 1030);
  const a = atrAt(ds, i), sig = signals(ds), ex = extremes(ds);
  add(ds, 1030, 9000, 1, 5000); add(ds, 5000, 5001, 4999, 5000); add(ds, 5000, 5001, 10, 20);
  assert.equal(atrAt(ds, i), a);
  assert.deepEqual(signals(ds).filter((x) => x.i <= i), sig);
  assert.deepEqual(extremes(ds).slice(0, i + 1), ex);
  assert.equal(atrAt(ds, P.atrN - 1), null);
});

test('entry at the next open, 3 x ATR stop, out at the 10th close, financing on buys only', () => {
  const ds = flat(30), i = 29; // ATR 10 -> risk 30
  for (let k = 0; k < 9; k++) add(ds, 1000, 1005, 995, 1000);
  add(ds, 1000, 1010, 995, 1006);
  const tr = trade(ds, i, 1);
  assert.equal(tr.entry, 1000); assert.equal(tr.stop, 970); assert.equal(tr.why, 'time'); assert.equal(tr.exit, 1006); assert.equal(tr.xi, i + 10);
  assert.ok(Math.abs(tr.R - 0.2) < 1e-12); assert.ok(Math.abs(tr.costR - 0.02) < 1e-12);
  const nn = nights(ds[i + 1].time, ds[i + 10].time + D); assert.equal(tr.nights, nn); assert.ok(nn >= 10);
  assert.ok(Math.abs(tr.finR - nn * FIN.xau.long * 1000 / 30) < 1e-12);
  assert.ok(Math.abs(tr.net - (tr.R - tr.costR - tr.finR)) < 1e-12);
  const s = trade(ds, i, -1); assert.equal(s.finR, 0); assert.ok(Math.abs(s.R + 0.2) < 1e-12);
  const x2 = trade(ds, i, 1, 2); assert.ok(Math.abs(x2.costR - 0.04) < 1e-12); assert.ok(Math.abs(x2.finR - 2 * tr.finR) < 1e-12);
  assert.equal(trade(flat(38), 29, 1), null); // not enough days left for the hold
});

test('stop on the losing side; a gap through it fills at the open', () => {
  const ds = flat(30); add(ds, 1000, 1004, 965, 990); for (let k = 0; k < 9; k++) add(ds, 990, 995, 985, 990);
  const tr = trade(ds, 29, 1); assert.equal(tr.why, 'stop'); assert.equal(tr.exit, 970); assert.equal(tr.R, -1);
  const g = flat(30); add(g, 1000, 1004, 990, 992); add(g, 960, 965, 950, 962); for (let k = 0; k < 8; k++) add(g, 962, 963, 960, 961);
  const tg = trade(g, 29, 1); assert.equal(tg.why, 'gap'); assert.equal(tg.exit, 960);
  const sl = trade(flat(40), 29, -1); assert.equal(sl.stop, 1030); assert.equal(sl.why, 'time');
});

test('one position at a time; control keeps the yearly count per side; month sums; Holm; weekend folded', () => {
  const ds = flat(80);
  assert.deepEqual(run(ds, [29, 30, 39, 40], () => 1).map((x) => x.ei), [30, 40]);
  const c = control(ds, [{ d: '2024-02-01', side: 1 }, { d: '2024-02-10', side: -1 }], 101);
  assert.equal(c.length, 2); assert.ok(c.every((x) => x.d.startsWith('2024')));
  assert.deepEqual(c.map((x) => x.side).sort(), [-1, 1]);
  assert.ok(c[0].xi < c[1].ei || c[1].xi < c[0].ei);
  assert.deepEqual(monthSums([{ d: '2024-01-05', net: 1 }, { d: '2024-03-02', net: -2 }], '2024-01-01', '2024-04-30'), [1, 0, -2, 0]);
  assert.deepEqual(holm([0.01, 0.04]), [0.02, 0.04]);
  const sat = Date.UTC(2024, 0, 6) / 1000;
  const days = toDays([[sat - D, 1, 2, 0.5, 1.5, 1], [sat + D, 1.5, 3, 1.4, 1.6, 1], [sat + 2 * D, 1.6, 1.7, 1.2, 1.3, 1]]);
  assert.equal(days.length, 2); assert.equal(days[1].high, 3); assert.equal(days[1].low, 1.2);
  assert.equal(P.look, 20); assert.equal(P.K, 7); assert.equal(P.atrN, 14); assert.equal(P.stopAtr, 3); assert.equal(P.hold, 10); assert.equal(P.cost, 0.60); assert.equal(P.seeds, 40);
});

test('RESULT.md agrees with result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-stall-drought/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gold-stall-drought/RESULT.md', import.meta.url), 'utf8');
  assert.equal(md, report(r));
  const vl = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(vl.startsWith(`**Verdict: ${r.verdict}`)); assert.ok(vl.length < 220);
  assert.ok(vl.includes(`n ${r.tests.T1.oos.n}`));
  for (const id of ['T1', 'T2']) {
    const t = r.tests[id];
    assert.ok(t.oos.n >= 100 && t.is.n >= 100, `${id} has 100+ trades a window`);
    assert.equal(t.placebo.draws.length, 40); assert.equal(t.control.draws.length, 40);
    assert.equal(r.checks[id].pass, r.passed.includes(id));
  }
  assert.equal(r.verdict, r.checks.T1.pass ? 'PASS' : 'FAIL');
  const pre = fs.readFileSync(new URL('../research/edge/gold-stall-drought/PREREGISTRATION.md', import.meta.url), 'utf8');
  assert.match(pre, /K = 7/); assert.match(pre, /3 x ATR\(14\)/); assert.match(pre, /10th trading day/);
});
