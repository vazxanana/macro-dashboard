// research/edge/gold-premium-discount: the rule's pieces on hand-made candles, and RESULT.md against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rangeAt, atrAt, trendUp, signals, trade, run, monthSums, holm, toDays, TESTS, P } from '../research/edge/gold-premium-discount/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const D = 86400, T0 = Date.UTC(2024, 0, 1) / 1000; // a Monday
// flat weekday candles: high 1005, low 995, close 1000 (true range 10)
function flat(n) { const ds = []; let t = T0; while (ds.length < n) { const w = new Date(t * 1000).getUTCDay(); if (w && w !== 6) ds.push({ time: t, open: 1000, high: 1005, low: 995, close: 1000 }); t += D; } return ds; }
const next = (ds) => { let t = ds.at(-1).time + D; while ([0, 6].includes(new Date(t * 1000).getUTCDay())) t += D; return t; };
const add = (ds, o, h, l, c) => { ds.push({ time: next(ds), open: o, high: h, low: l, close: c }); return ds.length - 1; };
const pad = (ds, n = 12) => { for (let k = 0; k < n; k++) add(ds, 1000, 1005, 995, 1000); return ds; };
const close = (a, b) => Math.abs(a - b) < 1e-9;

test('the range is the last 20 days, today included; position and mid', () => {
  const ds = flat(25), i = add(ds, 1000, 1001, 990, 991); // low20 990, high20 1005
  const r = rangeAt(ds, i);
  assert.equal(r.hi, 1005); assert.equal(r.lo, 990); assert.equal(r.mid, 997.5); assert.ok(close(r.pos, 1 / 15));
  assert.equal(rangeAt(ds, 18), null); assert.ok(rangeAt(ds, 19));
  // a high 20 days back is out of today's range
  const e = flat(5); e[0].high = 2000; for (let k = 0; k < 20; k++) add(e, 1000, 1005, 995, 1000);
  assert.equal(rangeAt(e, 20).hi, 1005); assert.equal(rangeAt(e, 19).hi, 2000);
});

test('signals: T1 below 0.25, T2 above 0.75, T3 needs the 100-day trend up', () => {
  const ds = flat(120), lo = add(ds, 1000, 1001, 990, 991), hi = add(ds, 991, 1010, 990, 1009);
  assert.ok(signals(ds, TESTS[0]).includes(lo)); assert.ok(!signals(ds, TESTS[0]).includes(hi));
  assert.ok(signals(ds, TESTS[1]).includes(hi)); assert.ok(!signals(ds, TESTS[1]).includes(lo));
  assert.equal(trendUp(ds, lo), false); assert.ok(!signals(ds, TESTS[2]).includes(lo)); // close 991 under its 100-day mean
  const up = flat(5); for (let k = 0; k < 110; k++) add(up, 1000 + k, 1005 + k, 995 + k, 1000 + k);
  const dip = add(up, 1110, 1111, 1085, 1088); // in the lowest quarter, still above the 100-day mean
  assert.equal(trendUp(up, dip), true); assert.ok(signals(up, TESTS[2]).includes(dip));
  assert.equal(trendUp(up, 50), null);
});

test('no look-ahead: range, ATR, trend and signals do not change with later days', () => {
  const ds = flat(120), i = add(ds, 1000, 1001, 990, 991);
  const r = rangeAt(ds, i), a = atrAt(ds, i), tu = trendUp(ds, i), s = signals(ds, TESTS[0]);
  add(ds, 991, 5000, 1, 4000); add(ds, 4000, 4001, 3999, 4000);
  assert.deepEqual(rangeAt(ds, i), r); assert.equal(atrAt(ds, i), a); assert.equal(trendUp(ds, i), tu);
  assert.deepEqual(signals(ds, TESTS[0]).filter((k) => k <= i), s);
});

test('entry at the next open, 1.5 x ATR stop, target at the 50 %, costs and financing', () => {
  const ds = flat(30), i = add(ds, 1000, 1001, 990, 991); // ATR (10*13 + 11)/14, mid 997.5
  const atr = atrAt(ds, i), risk = 1.5 * atr;
  add(ds, 992, 999, 991, 998); pad(ds);
  const tr = trade(ds, i, 1);
  assert.equal(tr.entry, 992); assert.equal(tr.target, 997.5); assert.equal(tr.why, 'target'); assert.equal(tr.exit, 997.5);
  assert.ok(close(tr.stop, 992 - risk)); assert.ok(close(tr.R, 5.5 / risk)); assert.ok(close(tr.costR, 0.6 / risk));
  const nn = nights(ds[i + 1].time, ds[i + 1].time + D / 2); assert.equal(tr.nights, nn);
  assert.ok(close(tr.finR, nn * FIN.xau.long * 992 / risk)); assert.ok(close(tr.net, tr.R - tr.costR - tr.finR));
  const x2 = trade(ds, i, 1, 2); assert.ok(close(x2.costR, 2 * tr.costR)); assert.ok(close(x2.finR, 2 * tr.finR));
  // a sell: no financing; mid below the entry is its target
  const s = flat(30), j = add(s, 1000, 1010, 999, 1009); add(s, 1008, 1009, 1003, 1004); pad(s);
  const st = trade(s, j, -1); assert.equal(st.finR, 0); assert.equal(st.target, rangeAt(s, j).mid); assert.equal(st.why, 'target'); assert.equal(st.xi, j + 2);
});

test('stop first when stop and target share a day; gaps fill at the open; no target on the wrong side; 10-day time exit', () => {
  const ds = flat(30), i = add(ds, 1000, 1001, 990, 991);
  add(ds, 992, 1003, 900, 995); pad(ds); // both the target and the stop inside one day
  assert.equal(trade(ds, i, 1).why, 'stop');
  const g = flat(30), k = add(g, 1000, 1001, 990, 991); add(g, 992, 994, 990, 993); add(g, 1001, 1002, 1000, 1001); pad(g);
  const tg = trade(g, k, 1); assert.equal(tg.why, 'target'); assert.equal(tg.exit, 1001); // opened through the target
  const w = flat(30), m = add(w, 1000, 1001, 990, 991); add(w, 998, 999, 997, 998); // entry already above the mid
  for (let n = 0; n < 12; n++) add(w, 998, 1000, 996, 999);
  const tw = trade(w, m, 1); assert.equal(tw.target, null); assert.equal(tw.why, 'time'); assert.equal(tw.xi, m + 10);
});

test('one position at a time; month sums count empty months; Holm; weekend folded; parameters as registered', () => {
  const ds = flat(60);
  const T = run(ds, [29, 30, 31, 45], -1); // flat candles never reach the mid: 10-day holds
  assert.deepEqual(T.map((x) => x.ei), [30, 46]);
  assert.deepEqual(monthSums([{ d: '2024-01-05', net: 1 }, { d: '2024-03-02', net: -2 }], '2024-01-01', '2024-04-30'), [1, 0, -2, 0]);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const sat = Date.UTC(2024, 0, 6) / 1000;
  const days = toDays([[sat - D, 1, 2, 0.5, 1.5, 1], [sat + D, 1.5, 3, 1.4, 1.6, 1], [sat + 2 * D, 1.6, 1.7, 1.2, 1.3, 1]]);
  assert.equal(days.length, 2); assert.equal(days[1].high, 3); assert.equal(days[1].low, 1.2);
  assert.deepEqual([P.rangeN, P.atrN, P.trendN, P.stopAtr, P.hold, P.lo, P.hi, P.cost, P.seeds, P.needBeat, P.minN], [20, 14, 100, 1.5, 10, 0.25, 0.75, 0.60, 40, 38, 30]);
});

test('RESULT.md agrees with result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-premium-discount/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gold-premium-discount/RESULT.md', import.meta.url), 'utf8');
  const vl = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(vl.startsWith(`**Verdict: ${r.verdict}:`)); assert.ok(vl.length < 220);
  const f = (v) => (v > 0 ? '+' : v < 0 ? '-' : '') + Math.abs(v).toFixed(3);
  for (const id of ['T1', 'T2', 'T3']) {
    const g = r.gold.tests[id], c = r.gold.checks[id], row = md.split('\n').find((l) => l.startsWith(`| ${id} | ${g.is.n}`));
    const cells = row.split('|').map((s) => s.trim()).filter(Boolean);
    assert.deepEqual(cells.slice(1), [String(g.is.n), f(g.isGross.mean), f(g.is.mean), g.is.monthT.toFixed(2), String(g.oos.n), f(g.oosGross.mean), f(g.oos.mean), g.oos.monthT.toFixed(2), String(c.holmP), f(g.oos2x.mean), f(g.half1.mean), f(g.half2.mean), `${g.placebo.beaten} of 40`, c.pass ? 'yes' : 'no']);
  }
  for (const [k, label] of [['buy', 'buy every day'], ['sell', 'sell every day']]) {
    const b = r.gold.baseline[k], row = md.split('\n').find((l) => l.startsWith(`| ${label} `));
    assert.deepEqual(row.split('|').map((s) => s.trim()).filter(Boolean).slice(1), [String(b.is.n), f(b.is.mean), b.is.monthT.toFixed(2), String(b.oos.n), f(b.oosGross.mean), f(b.oos.mean), b.oos.monthT.toFixed(2)]);
  }
  assert.equal(r.verdict, r.gold.passed.length ? 'PASS' : 'FAIL');
  assert.ok(md.includes(`${r.gold.data.days.toLocaleString('en-US')}\ntrading days`) || md.includes(`${r.gold.data.days.toLocaleString('en-US')} trading days`));
  assert.ok(md.includes('Item 44'));
});
