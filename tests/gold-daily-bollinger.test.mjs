// research/edge/gold-daily-bollinger: the rule's pieces on hand-made candles, and RESULT.md against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bandAt, atrAt, signalAt, signals, trade, run, monthSums, holm, toDays, TESTS, P } from '../research/edge/gold-daily-bollinger/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const D = 86400, T0 = Date.UTC(2024, 0, 1) / 1000; // a Monday
// weekday candles alternating close 999 / 1001 (sd 1, middle 1000), range 10 (true range 10)
function base(n) { const ds = []; let t = T0; while (ds.length < n) { const w = new Date(t * 1000).getUTCDay(); if (w && w !== 6) { const c = ds.length % 2 ? 1001 : 999; ds.push({ time: t, open: 1000, high: 1005, low: 995, close: c }); } t += D; } return ds; }
const next = (ds) => { let t = ds.at(-1).time + D; while ([0, 6].includes(new Date(t * 1000).getUTCDay())) t += D; return t; };
const add = (ds, o, h, l, c) => { ds.push({ time: next(ds), open: o, high: h, low: l, close: c }); return ds.length - 1; };
// a trade is taken only when its whole 10-day window is on file: pad quiet days after the ones a test draws
const pad = (ds, n = P.maxHold) => { for (let k = 0; k < n; k++) add(ds, 1000, 1004, 996, 1000); return ds; };

test('band from the 20 closes ending at the day; signals above / below', () => {
  const ds = base(30);
  const b = bandAt(ds, 29); assert.ok(Math.abs(b.mid - 1000) < 1e-9); assert.ok(Math.abs(b.sd - 1) < 1e-9);
  assert.equal(bandAt(ds, 18), null); assert.equal(signalAt(ds, 29), 0);
  const up = add(ds, 1001, 1012, 1000, 1010); // far above mid + 2 sd
  assert.equal(signalAt(ds, up), 1);
  const dn = base(30); const i = add(dn, 999, 1000, 985, 988);
  assert.equal(signalAt(dn, i), -1);
  assert.deepEqual(signals(ds, TESTS[1]), [up]); assert.deepEqual(signals(ds, TESTS[2]), [up]); assert.deepEqual(signals(ds, TESTS[0]), []);
});

test('no look-ahead: band, ATR and signal of a day do not change with later days', () => {
  const ds = base(30); const i = add(ds, 1001, 1012, 1000, 1010);
  const b = bandAt(ds, i), a = atrAt(ds, i);
  add(ds, 1010, 5000, 1, 4000); add(ds, 4000, 4001, 3999, 4000);
  assert.deepEqual(bandAt(ds, i), b); assert.equal(atrAt(ds, i), a); assert.equal(signalAt(ds, i), 1);
  assert.equal(atrAt(ds, P.atrN - 1), null);
});

test('entry next open, 1.5 x ATR stop, middle-band exit, financing on buys only', () => {
  const ds = base(30), i = 29; // ATR 10 -> risk 15, entry 1000
  add(ds, 1000, 1004, 996, 1003); pad(ds); // close 1003 >= that day's mid -> T1 exit
  const tr = trade(ds, i, 1, 'aboveMid');
  assert.equal(tr.entry, 1000); assert.equal(tr.stop, 985); assert.equal(tr.why, 'mid'); assert.equal(tr.exit, 1003); assert.equal(tr.held, 1);
  assert.ok(Math.abs(tr.R - 0.2) < 1e-12); assert.ok(Math.abs(tr.costR - 0.04) < 1e-12);
  const nn = nights(ds[i + 1].time, ds[i + 1].time + D); assert.equal(tr.nights, nn);
  assert.ok(Math.abs(tr.finR - nn * FIN.xau.long * 1000 / 15) < 1e-12);
  assert.ok(Math.abs(tr.net - (tr.R - tr.costR - tr.finR)) < 1e-12);
  const s = trade(ds, i, -1, 'belowMid'); assert.equal(s.finR, 0); assert.ok(['mid', 'time', 'stop', 'gap'].includes(s.why));
  const x2 = trade(ds, i, 1, 'aboveMid', 2); assert.ok(Math.abs(x2.costR - 0.08) < 1e-12); assert.ok(Math.abs(x2.finR - 2 * tr.finR) < 1e-12);
});

test('the stop wins on its day; a later gap fills at the open; time exit after 10 days; fixed hold for the placebo', () => {
  const ds = base(30), i = 29; add(ds, 1000, 1004, 980, 1003); pad(ds);
  const st = trade(ds, i, 1, 'aboveMid'); assert.equal(st.why, 'stop'); assert.equal(st.R, -1);
  const g = base(30); add(g, 1000, 1004, 990, 992); add(g, 970, 975, 960, 972); pad(g);
  const tg = trade(g, 29, 1, 3); assert.equal(tg.why, 'gap'); assert.equal(tg.exit, 970);
  const h = base(30); for (let k = 0; k < 12; k++) add(h, 1000, 1004, 996, 990 - k * 0.01); // never back above the mid
  const th = trade(h, 29, 1, 'aboveMid'); assert.equal(th.why, 'time'); assert.equal(th.held, P.maxHold);
  assert.equal(trade(base(32), 29, 1, 'aboveMid'), null); // window past the data end: not taken
  const fx = trade(h, 29, 1, 4); assert.equal(fx.held, 4); assert.equal(fx.why, 'time');
});

test('one position at a time; month sums count empty months; Holm; weekend folded; parameters', () => {
  const ds = base(40);
  assert.deepEqual(run(ds, [29, 30, 31, 32, 33], () => 1, () => 3).map((x) => x.ei), [30, 33]);
  assert.deepEqual(monthSums([{ d: '2024-01-05', net: 1 }, { d: '2024-03-02', net: -2 }], '2024-01-01', '2024-04-30'), [1, 0, -2, 0]);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const sat = Date.UTC(2024, 0, 6) / 1000;
  const days = toDays([[sat - D, 1, 2, 0.5, 1.5, 1], [sat + D, 1.5, 3, 1.4, 1.6, 1], [sat + 2 * D, 1.6, 1.7, 1.2, 1.3, 1]]);
  assert.equal(days.length, 2); assert.equal(days[1].open, 1.5); assert.equal(days[1].high, 3);
  assert.deepEqual([P.bbN, P.bbK, P.atrN, P.stopAtr, P.maxHold, P.cost, P.seeds, P.needBeat], [20, 2, 14, 1.5, 10, 0.60, 40, 38]);
  assert.deepEqual([P.isFrom, P.isTo, P.oosFrom, P.oosTo], ['2007-01-01', '2016-12-31', '2017-01-01', '2026-10-31']);
});

test('RESULT.md agrees with result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-daily-bollinger/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gold-daily-bollinger/RESULT.md', import.meta.url), 'utf8');
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
