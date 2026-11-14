// research/edge/gold-run-pause: the rule's pieces on hand-made candles, and RESULT.md against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runs, signals, atrAt, trade, run, monthSums, holm, control, toDays, TESTS, P } from '../research/edge/gold-run-pause/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const D = 86400, T0 = Date.UTC(2024, 0, 1) / 1000; // a Monday
function flat(n) { const ds = []; let t = T0; while (ds.length < n) { const w = new Date(t * 1000).getUTCDay(); if (w && w !== 6) ds.push({ time: t, open: 1000, high: 1005, low: 995, close: 1000 }); t += D; } return ds; }
const next = (ds) => { let t = ds.at(-1).time + D; while ([0, 6].includes(new Date(t * 1000).getUTCDay())) t += D; return t; };
const add = (ds, o, h, l, c) => { ds.push({ time: next(ds), open: o, high: h, low: l, close: c }); return ds.length - 1; };

test('a signal is the first opposite close after a run of 3+; an equal close ends a run', () => {
  const ds = flat(20);
  add(ds, 1000, 1002, 999, 1001); add(ds, 1001, 1003, 1000, 1002); add(ds, 1002, 1004, 1001, 1003);
  const p1 = add(ds, 1003, 1004, 1001, 1002); // first down close after 3 up: signal for T1
  const d2 = add(ds, 1002, 1003, 1000, 1001); // second down close: not a signal
  add(ds, 1001, 1002, 999, 1000); add(ds, 1000, 1001, 998, 999); // down run of 4
  const p2 = add(ds, 999, 1001, 998, 1000);   // first up close after 4 down: T2 / T3 signal
  add(ds, 1000, 1002, 999, 1001); add(ds, 1001, 1002, 1000, 1001); // equal close -> run 0
  add(ds, 1001, 1002, 1000, 1000); // down after an equal close: no signal
  const s = runs(ds);
  assert.equal(s[p1], -1); assert.equal(s[p1 - 1], 3); assert.equal(s[d2], -2); assert.equal(s[p2], 1); assert.equal(s[p2 - 1], -4);
  assert.deepEqual(signals(ds, TESTS[0].run), [p1]);
  assert.deepEqual(signals(ds, TESTS[1].run), [p2]);
  assert.deepEqual(signals(ds, TESTS[2].run), [p2]);
  // a run of only 2 does not count
  const g = flat(20); add(g, 1000, 1002, 999, 1001); add(g, 1001, 1003, 1000, 1002); add(g, 1002, 1003, 1000, 1001);
  assert.deepEqual(signals(g, 1), []);
});

test('no look-ahead: signals and ATR at day i do not change when later days change', () => {
  const ds = flat(20); add(ds, 1000, 1002, 999, 1001); add(ds, 1001, 1003, 1000, 1002); add(ds, 1002, 1004, 1001, 1003);
  const i = add(ds, 1003, 1004, 1001, 1002);
  const a = atrAt(ds, i), sig = signals(ds, 1);
  add(ds, 1002, 9000, 1, 5000); add(ds, 5000, 5001, 4999, 5000); add(ds, 5000, 5001, 10, 20);
  assert.equal(atrAt(ds, i), a); assert.deepEqual(signals(ds, 1).filter((k) => k <= i), sig);
  assert.equal(atrAt(ds, P.atrN - 1), null);
});

test('entry at the next open, 2 x ATR stop, out at the 5th close, financing on buys only', () => {
  const ds = flat(30), i = 29; // ATR 10 -> risk 20
  for (let k = 0; k < 4; k++) add(ds, 1000, 1005, 995, 1000);
  add(ds, 1000, 1010, 995, 1008);
  const tr = trade(ds, i, 1);
  assert.equal(tr.entry, 1000); assert.equal(tr.stop, 980); assert.equal(tr.why, 'time'); assert.equal(tr.exit, 1008); assert.equal(tr.xi, i + 5);
  assert.ok(Math.abs(tr.R - 0.4) < 1e-12); assert.ok(Math.abs(tr.costR - 0.03) < 1e-12);
  const nn = nights(ds[i + 1].time, ds[i + 5].time + D); assert.equal(tr.nights, nn); assert.ok(nn >= 5);
  assert.ok(Math.abs(tr.finR - nn * FIN.xau.long * 1000 / 20) < 1e-12);
  assert.ok(Math.abs(tr.net - (tr.R - tr.costR - tr.finR)) < 1e-12);
  const s = trade(ds, i, -1); assert.equal(s.finR, 0); assert.ok(Math.abs(s.R + 0.4) < 1e-12);
  const x2 = trade(ds, i, 1, 2); assert.ok(Math.abs(x2.costR - 0.06) < 1e-12); assert.ok(Math.abs(x2.finR - 2 * tr.finR) < 1e-12);
  assert.equal(trade(flat(32), 29, 1), null); // not enough days left for the hold
});

test('stop on the losing side; a gap through it fills at the open', () => {
  const ds = flat(30); add(ds, 1000, 1004, 975, 990); for (let k = 0; k < 4; k++) add(ds, 990, 995, 985, 990);
  const tr = trade(ds, 29, 1); assert.equal(tr.why, 'stop'); assert.equal(tr.exit, 980); assert.equal(tr.R, -1);
  const g = flat(30); add(g, 1000, 1004, 990, 992); add(g, 970, 975, 960, 972); for (let k = 0; k < 3; k++) add(g, 972, 973, 970, 971);
  const tg = trade(g, 29, 1); assert.equal(tg.why, 'gap'); assert.equal(tg.exit, 970);
});

test('one position at a time; control keeps the yearly count; month sums; Holm; weekend folded', () => {
  const ds = flat(60);
  assert.deepEqual(run(ds, [29, 30, 34, 35], () => 1).map((x) => x.ei), [30, 35]);
  const c = control(ds, [{ d: '2024-02-01' }, { d: '2024-02-10' }], 1, 101);
  assert.equal(c.length, 2); assert.ok(c.every((x) => x.d.startsWith('2024')));
  assert.ok(c[0].xi < c[1].ei || c[1].xi < c[0].ei);
  assert.deepEqual(monthSums([{ d: '2024-01-05', net: 1 }, { d: '2024-03-02', net: -2 }], '2024-01-01', '2024-04-30'), [1, 0, -2, 0]);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const sat = Date.UTC(2024, 0, 6) / 1000;
  const days = toDays([[sat - D, 1, 2, 0.5, 1.5, 1], [sat + D, 1.5, 3, 1.4, 1.6, 1], [sat + 2 * D, 1.6, 1.7, 1.2, 1.3, 1]]);
  assert.equal(days.length, 2); assert.equal(days[1].high, 3); assert.equal(days[1].low, 1.2);
  assert.equal(P.atrN, 14); assert.equal(P.stopAtr, 2); assert.equal(P.hold, 5); assert.equal(P.k, 3); assert.equal(P.cost, 0.60); assert.equal(P.seeds, 40);
});

test('RESULT.md agrees with result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-run-pause/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gold-run-pause/RESULT.md', import.meta.url), 'utf8');
  const vl = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(vl.startsWith(`**Verdict: ${r.verdict}, ${r.passed.length} of 3:`)); assert.ok(vl.length < 220);
  const f = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(3);
  const lines = md.split('\n');
  for (const id of ['T1', 'T2', 'T3']) {
    const g = r.tests[id], c = r.checks[id], k = lines.findIndex((l) => l.startsWith(`| ${id} `));
    const isC = lines[k].split('|').map((s) => s.trim()).slice(2, -1), oC = lines[k + 1].split('|').map((s) => s.trim()).slice(2, -1);
    assert.equal(isC[1], String(g.is.n)); assert.equal(isC[2], f(g.isGross.mean)); assert.equal(isC[3], f(g.is.mean));
    assert.equal(+isC[4].replace('−', '-'), g.is.monthT);
    assert.equal(oC[1], String(g.oos.n)); assert.equal(oC[2], f(g.oosGross.mean)); assert.equal(oC[3], f(g.oos.mean));
    assert.equal(+oC[4].replace('−', '-'), g.oos.monthT);
    assert.equal(oC[6], `${f(g.excess.oos.diff)} (${g.excess.oos.welchT.toFixed(2).replace('-', '−')})`);
    assert.equal(oC[7], f(g.oos2x.mean)); assert.equal(oC[8], c.holmP.toFixed(3));
    assert.equal(oC[9], `${g.placebo.beaten} of 40`); assert.equal(oC[10], `${g.control.beaten} of 40`); assert.equal(oC[11], c.pass ? 'yes' : 'no');
  }
  assert.equal(r.verdict, r.checks.T1.pass ? 'PASS' : 'FAIL');
  assert.ok(md.includes(`${r.data.days.toLocaleString('en-US')} trading days`));
  assert.ok(md.includes('Item 44'));
});
