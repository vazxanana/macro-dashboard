// research/edge/silver-lowvol-hold: gold-lowvol-hold's rule unchanged on silver; the volatility state on hand-made candles, the trade,
// no look-ahead, statistics, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prepare, rvSeries, pctAt, stateOf, trade, baseline, run, days, nwT, holm, report, verdictLine, COST, TESTS, FIN_SENS } from '../research/edge/silver-lowvol-hold/run.mjs';

const dir = new URL('../research/edge/silver-lowvol-hold/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');

// hand-made candles every calendar day from 2020-01-01 (weekends get folded)
function rows(n, f) { const out = []; let t = Date.UTC(2020, 0, 1) / 1000; for (let k = 0; k < n; k++, t += 86400) out.push(f(k, t)); return out; }
// a close series whose daily swing is wide for a while, then narrow
const wave = (amp) => (k, t) => { const c = 100 * Math.exp(amp(k) * (k % 2 ? 1 : -1)); return [t, c, c * 1.002, c * 0.998, c, 1]; };

test('rv20 and its percentile: a quiet stretch after a loud year is quiet, and the reverse', () => {
  const P = prepare(rows(560, wave((k) => k < 500 ? 0.01 : 0.001)));
  const i = P.bars.length - 1;
  assert.ok(P.rv[i] < P.rv[i - 40]);
  assert.equal(stateOf(pctAt(P.rv, i)), 'quiet');
  const Q = prepare(rows(560, wave((k) => k < 500 ? 0.001 : 0.01)));
  assert.equal(stateOf(pctAt(Q.rv, Q.bars.length - 1)), 'loud');
  assert.equal(pctAt(P.rv, 100), null);                       // no full year yet
  assert.equal(stateOf(0.5), 'mid'); assert.equal(stateOf(1 / 3 - 1e-9), 'quiet'); assert.equal(stateOf(2 / 3), 'loud');
});

test('trade: a buy with a 3 x ATR(20) stop, costs and financing', () => {
  const P = prepare(rows(120, (i, t) => [t, 100 + i, 101 + i, 99 + i, 100 + i, 1]));
  const L = trade(P, 30, 20);
  assert.equal(COST, 0.06); assert.ok(L.risk > 0 && L.R > 0 && L.fin === 0 && L.nights > 0);   // no silver financing is judged
  const Ls = trade(P, 30, 20, { finRate: FIN_SENS }); assert.ok(Ls.fin > 0 && Math.abs(Ls.fin - Ls.nights * FIN_SENS * Ls.entry / Ls.risk) < 1e-12);
  assert.ok(L.stop < L.entry && Number.isFinite(L.stop));      // every trade has a stop on the losing side
  assert.ok(Math.abs(L.net - (L.R - COST / L.risk - L.fin)) < 1e-12);
  const D = prepare(rows(120, (i, t) => [t, 300 - 3 * i, 301 - 3 * i, 299 - 3 * i, 300 - 3 * i, 1]));
  const S = trade(D, 30, 20); assert.equal(S.how, 'stop'); assert.ok(S.R <= -1 + 1e-9);
  assert.equal(trade(P, 5, 20), null); assert.equal(trade(P, 110, 20), null);   // no ATR yet / exit not on file
});

test('baseline and excess: a trade on every day of the year; excess = net minus the year mean', () => {
  const P = prepare(rows(900, wave((k) => 0.002 + 0.008 * (Math.floor(k / 90) % 2))));
  const b = baseline(P, 20), y = Object.keys(b)[1];
  const all = b[y].ids.map((i) => trade(P, i, 20));
  assert.ok(Math.abs(b[y].net - all.reduce((s, x) => s + x.net, 0) / all.length) < 1e-12);
  const A = run(P, days(P), 'T1');
  assert.ok(A.T.length > 0);
  for (const x of A.T.slice(0, 20)) assert.ok(Math.abs(x.ex - (x.net - A.base[x.a.slice(0, 4)].net)) < 1e-12);
  assert.ok(A.T.every((x) => stateOf(pctAt(P.rv, x.i)) === 'quiet'));
  assert.deepEqual(Object.fromEntries(Object.entries(TESTS).map(([k, v]) => [k, [v.state, v.hold, v.lag]])), { T1: ['quiet', 20, 1], T2: ['quiet', 60, 3], T3: ['loud', 20, 1] });
});

test('no look-ahead: later prices move neither the state nor a trade', () => {
  const a = rows(700, wave((k) => 0.002 + 0.006 * (Math.floor(k / 70) % 2))), b = a.map((r, i) => i > 600 ? [r[0], 999, 1999, 1, 500, 1] : r);
  const Pa = prepare(a), Pb = prepare(b), cut = Pa.bars.findIndex((x) => x.time > a[600][0]) - 1;
  assert.deepEqual(rvSeries(Pa.bars).slice(0, cut + 1), rvSeries(Pb.bars).slice(0, cut + 1));
  for (let i = 280; i <= cut; i++) assert.equal(pctAt(Pa.rv, i), pctAt(Pb.rv, i));
  const i0 = cut - 25; assert.deepEqual(trade(Pa, i0, 20), trade(Pb, i0, 20));
});

test('statistics: Newey-West month t and Holm', () => {
  const v = [1, 2, 0.5, 1.5, 1, 2, 0.5, 1.5];
  const t0 = nwT(v, 0), t1 = nwT(v, 1);
  assert.ok(t0.t > 0 && t1.t > 0 && t0.months === 8);
  assert.equal(nwT([1, 2], 1).t, null);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
});

test('report matches result.json, verdict line', () => {
  assert.equal(R.verdict, 'FAIL'); assert.deepEqual(R.passed, []); assert.equal(R.study, 'silver-lowvol-hold'); assert.equal(R.rules.fin, 0);
  for (const k of ['T1', 'T2', 'T3']) assert.ok(R.tests[k].finSens.oos.n === R.tests[k].oos.n);
  assert.equal(MD.trim(), report(R).trim());
  const line = MD.match(/\*\*Verdict: [^\n]*\*\*/)[0];
  assert.equal(line, verdictLine(R)); assert.ok(line.length < 220, line);
  const T1 = R.tests.T1;
  assert.ok(line.includes(`n ${T1.oos.n}`) && line.includes(T1.oos.tEx.toFixed(2)) && line.includes(`${T1.placebo.beaten} of 40`));
  for (const k of ['T1', 'T2', 'T3']) { const r = R.tests[k];
    assert.equal(r.pass, Object.values(r.checks).every(Boolean));
    assert.equal(r.checks.oosExT2, r.oos.excess > 0 && r.oos.tEx >= 2); assert.equal(r.checks.placebo, r.placebo.beaten >= 38);
    assert.ok(r.is.n >= 100 && r.oos.n >= 100); }
  assert.ok(!/is an edge/.test(MD.replace('Nothing is an edge here', '')));
});
