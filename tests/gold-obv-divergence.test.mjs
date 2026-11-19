// research/edge/gold-obv-divergence: the rule's pieces on hand-made candles, and RESULT.md against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { obv, signalAt, signals, trade, run, baseline, placeboTrade, atrAt, monthSums, holm, toDays, TESTS, P } from '../research/edge/gold-obv-divergence/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const D = 86400, T0 = Date.UTC(2024, 0, 1) / 1000; // a Monday
const next = (ds) => { let t = ds.length ? ds.at(-1).time + D : T0; while ([0, 6].includes(new Date(t * 1000).getUTCDay())) t += D; return t; };
const add = (ds, o, h, l, c, v = 100) => { ds.push({ time: next(ds), open: o, high: h, low: l, close: c, v }); return ds.length - 1; };
// a flat band of n days around p with volume v
function flat(ds, n, p, v = 100) { for (let k = 0; k < n; k++) add(ds, p, p + 5, p - 5, p + (k % 2 ? 1 : -1), v); return ds; }

test('OBV signs the volume by the close against the previous close', () => {
  const ds = [];
  add(ds, 10, 11, 9, 10, 5); add(ds, 10, 12, 9, 11, 7); add(ds, 11, 12, 9, 10, 3); add(ds, 10, 11, 9, 10, 9);
  assert.deepEqual(obv(ds), [0, 7, 4, 4]);
});

test('divergence and confirmed extremes at a new N-day closing high / low', () => {
  // a big up day early lifts OBV; the later new closing high comes on a small volume after down days -> divergence
  const ds = [];
  flat(ds, 5, 1000, 100); add(ds, 1000, 1012, 999, 1010, 10000); add(ds, 1010, 1011, 995, 1000, 5000); flat(ds, 13, 1000, 100);
  const hi = add(ds, 1000, 1020, 999, 1015, 50);
  const ob = obv(ds);
  assert.deepEqual(signalAt(ds, ob, hi, 20), { i: hi, side: -1, kind: 'div' });
  // the same high on a huge volume confirms
  const d2 = ds.slice(0, -1).map((x) => ({ ...x })); add(d2, 1000, 1020, 999, 1015, 1e6);
  assert.equal(signalAt(d2, obv(d2), hi, 20).kind, 'conf');
  // a new low with OBV above its prior low: bullish divergence; no extreme: null; too little history: null
  const d3 = []; flat(d3, 5, 1000, 100); add(d3, 1000, 1001, 985, 990, 10000); add(d3, 990, 1005, 989, 1000, 5000); flat(d3, 13, 1000, 100);
  const lo = add(d3, 1000, 1001, 970, 980, 50);
  assert.deepEqual(signalAt(d3, obv(d3), lo, 20), { i: lo, side: 1, kind: 'div' });
  assert.equal(signalAt(d3, obv(d3), lo - 1, 20), null);
  assert.equal(signalAt(ds, ob, 10, 20), null);
  assert.deepEqual(signals(ds, 20).map((s) => s.i), [hi]);
});

test('no look-ahead: signals and ATR up to a day do not change with later days', () => {
  const ds = []; flat(ds, 5, 1000, 100); add(ds, 1000, 1012, 999, 1010, 10000); add(ds, 1010, 1011, 995, 1000, 5000); flat(ds, 13, 1000, 100); add(ds, 1000, 1020, 999, 1015, 50);
  const k = ds.length - 1, a = signals(ds, 20), atr = atrAt(ds, k), ob = obv(ds);
  add(ds, 1015, 9000, 1, 5000, 1e9); add(ds, 5000, 5001, 2, 3, 1e9);
  assert.deepEqual(signals(ds, 20).filter((s) => s.i <= k), a);
  assert.equal(atrAt(ds, k), atr); assert.deepEqual(obv(ds).slice(0, k + 1), ob);
});

test('the trade: next open, fixed 1.5 ATR stop, gap fill, 10-day time exit, costs and financing on buys only', () => {
  const ds = []; flat(ds, 20, 1000, 100);
  const i = ds.length - 1, atr = atrAt(ds, i);
  for (let k = 0; k < 12; k++) add(ds, 1000 - k, 1003 - k, 997 - k, 999 - k);
  const s = trade(ds, i, -1);
  assert.equal(s.entry, 1000); assert.ok(Math.abs(s.risk - 1.5 * atr) < 1e-9);
  assert.equal(s.why, 'time'); assert.equal(s.held, P.hold); assert.equal(s.exit, ds[i + P.hold].close);
  assert.equal(s.finR, 0); assert.ok(Math.abs(s.net - (s.R - P.cost / s.risk)) < 1e-12);
  const b = trade(ds, i, 1);
  assert.ok(b.R < 0); assert.equal(b.nights, nights(ds[i + 1].time, ds[b.xi].time + (b.why === 'time' ? D : D / 2)));
  assert.ok(Math.abs(b.finR - b.nights * FIN.xau.long * b.entry / b.risk) < 1e-12);
  assert.ok(Math.abs(trade(ds, i, 1, 2).finR - 2 * b.finR) < 1e-12);
  // a gap through the stop fills at the open; a stop touch fills at the stop
  const g = []; flat(g, 20, 1000, 100); const gi = g.length - 1; add(g, 1000, 1004, 996, 1001); add(g, 900, 905, 890, 895);
  const gt = trade(g, gi, 1); assert.equal(gt.why, 'gap'); assert.equal(gt.exit, 900);
  const st = []; flat(st, 20, 1000, 100); const si = st.length - 1; add(st, 1000, 1050, 999, 1040);
  const tt = trade(st, si, -1); assert.equal(tt.why, 'stop'); assert.ok(Math.abs(tt.R + 1) < 1e-12);
  // still open at the data end -> null; one position at a time
  assert.equal(trade(st.slice(0, si + 3).map((x, k) => (k > si ? { ...x, high: 1001, low: 999 } : x)), si, -1), null);
  assert.equal(run(ds, [{ i, side: -1 }, { i: i + 2, side: 1 }]).length, 1);
  assert.equal(baseline(ds, 1).length >= 1, true);
});

test('placebo keeps entry, risk, exit day; month sums; Holm; weekend fold adds volume', () => {
  const ds = []; flat(ds, 20, 1000, 100); const i = ds.length - 1;
  for (let k = 0; k < 12; k++) add(ds, 1000, 1003, 997, 1000);
  const x = trade(ds, i, 1), p = placeboTrade(ds, x, -1);
  assert.equal(p.ei, x.ei); assert.equal(p.risk, x.risk); assert.equal(p.xi, x.xi); assert.equal(p.exit, ds[x.xi].open);
  assert.deepEqual(monthSums([{ d: '2024-02-03', net: 1 }, { d: '2024-02-20', net: -0.5 }], '2024-01-01', '2024-03-31'), [0, 0.5, 0]);
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((v) => +v.toFixed(2)), [0.03, 0.06, 0.06]);
  const fri = Date.UTC(2024, 0, 5) / 1000;
  const days = toDays([[fri, 1, 2, 0, 1, 10], [fri + 2 * D, 1, 3, 1, 2, 4], [fri + 3 * D, 2, 2.5, 0.5, 2, 6]]);
  assert.equal(days.length, 2); assert.equal(days[1].v, 10); assert.equal(days[1].open, 1); assert.equal(days[1].high, 3);
  assert.deepEqual(TESTS.map((t) => t.n), [20, 40, 20]); assert.equal(P.cost, 0.6); assert.equal(P.oosFrom, '2017-01-01');
});

test('RESULT.md matches result.json', () => {
  const j = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-obv-divergence/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gold-obv-divergence/RESULT.md', import.meta.url), 'utf8');
  const g = j.gold, t1 = g.tests.T1, t3 = g.tests.T3;
  assert.equal(j.verdict, 'FAIL'); assert.match(md, /\*\*Verdict: FAIL: [^\n]*\*\*/);
  const f = (v) => (v >= 0 ? '+' : '-') + Math.abs(v).toFixed(3);
  for (const id of ['T1', 'T2']) {
    const r = g.tests[id];
    for (const v of [r.is.mean, r.isGross.mean, r.oos.mean, r.oosGross.mean, r.oos2x.mean, r.half1.mean, r.half2.mean]) assert.ok(md.includes(f(v)), `${id} ${v}`);
    assert.ok(md.includes(`| ${r.is.n} |`) && md.includes(`| ${r.oos.n} |`));
    assert.ok(md.includes(`${r.placebo.beaten} of 40`));
    assert.equal(g.checks[id].pass, false);
  }
  assert.ok(md.includes(`n ${t1.oos.n}, t ${t1.oos.monthT}`));
  assert.ok(md.includes(f(t3.diff.is)) && md.includes(f(t3.diff.oos)) && md.includes(String(t3.diff.oosWelchT)));
  assert.ok(md.includes(f(g.baseline.buy.oos.mean)) && md.includes(f(g.baseline.sell.oos.mean)));
  assert.ok(md.includes(f(t1.vsBaseline.buy.diff)) && md.includes(String(t1.vsBaseline.buy.welchT)));
  assert.ok(md.includes(`$${t1.stopUsd.median}`) && t1.stopUsd.median >= 10);
  assert.ok(md.includes(`${t1.costs.share}R`));
});
