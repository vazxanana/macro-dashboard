// Grain seasonality study (research/edge/grain-seasonality): window selection on a hand-made calendar, the fixed 3 x ATR(20)
// stop on every position, no look-ahead, the costs, the permutation p and Holm, and the written report against result.json.
// Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, TESTS, prep, atrBefore, windowOf, trade, permP, holm, verdictOf } from '../research/edge/grain-seasonality/run.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PRE = rd('../research/edge/grain-seasonality/PREREGISTRATION.md'), RES = rd('../research/edge/grain-seasonality/RESULT.md');
const J = JSON.parse(rd('../research/edge/grain-seasonality/result.json'));
const DAY = 86400;
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
// one flat candle (range 2 around 100) per UTC day from `from` to `to`, weekends included as stubs
function cal(from, to) {
  const rows = [];
  for (let t = Date.UTC(from[0], from[1] - 1, from[2]) / 1000; t <= Date.UTC(to[0], to[1] - 1, to[2]) / 1000; t += DAY) rows.push([t, 100, 101, 99, 100, 1]);
  return rows;
}
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);

test('the constants and the tests are the pre-registered ones', () => {
  assert.deepEqual([P.ATR, P.K, P.MONTHS, P.SPREAD, P.FIN_YEAR, P.DRAWS, P.SEED, P.PLACEBO_SEEDS, P.ALPHA], [20, 3, 3, 0.002, 0.03, 200000, 20261114, 40, 0.05]);
  assert.deepEqual(P.DECISIVE, [2016, 2026]); assert.equal(P.REPLICATION_TO, 2015);
  assert.deepEqual(TESTS.map((t) => [t.id, t.key, t.m0, t.judged]), [['T1', 'corn', 7, true], ['T2', 'soybn', 7, true], ['T3', 'wheat', 6, true], ['control', 'sugar', 7, false]]);
  assert.match(PRE, /0\.20 % of the entry price a round trip/); assert.match(PRE, /3 % of the entry price a year/);
  assert.match(PRE, /entry \+ 3 x ATR\(20\)/); assert.match(PRE, /200,000 draws/);
});

test('window selection: first weekday of the first month to the last weekday of the last month; weekends folded', () => {
  const B = prep(cal([2021, 3, 1], [2021, 11, 10]));
  assert.ok(B.every((b) => ![0, 6].includes(new Date(b.time * 1000).getUTCDay())), 'only weekday candles');
  const w = windowOf(B, 2021, 7);                          // 1 July 2021 is a Thursday, 30 Sep a Thursday
  assert.equal(ymd(B[w[0]].time), '2021-07-01'); assert.equal(ymd(B[w[1]].time), '2021-09-30');
  const v = windowOf(B, 2021, 5);                          // 1 May 2021 is a Saturday: the window starts Monday 3 May
  assert.equal(ymd(B[v[0]].time), '2021-05-03'); assert.equal(ymd(B[v[1]].time), '2021-07-30');
  assert.equal(windowOf(B, 2021, 9), null, 'September-November ends after the data');
  assert.equal(windowOf(B, 2021, 3), null, 'a window in the data\'s first month has no candles before it');
  assert.equal(windowOf(B, 2022, 7), null);
});

test('a short with a fixed 3 x ATR(20) stop: stopped at the stop, at a gapped open, or out at the window close', () => {
  const B = prep(cal([2021, 3, 1], [2021, 11, 10])), [i0, i1] = windowOf(B, 2021, 7);
  near(atrBefore(B, i0), 2);
  let t = trade(B, i0, i1, 0);
  near(t.entry, 100); near(t.stop, 106); assert.ok(t.stop > t.entry, 'the stop of a short is above its entry');
  assert.equal(t.why, 'window'); near(t.g, 0); near(t.net, 0);
  const H = B.map((b) => ({ ...b })); H[i0 + 5] = { ...H[i0 + 5], high: 107 };
  t = trade(H, i0, i1, 0); assert.equal(t.why, 'stop'); near(t.exit, 106); near(t.g, -1);
  const G = B.map((b) => ({ ...b })); G[i0 + 5] = { ...G[i0 + 5], open: 109, high: 110, close: 109 };
  t = trade(G, i0, i1, 0); assert.equal(t.why, 'stop-gap'); near(t.exit, 109); near(t.g, -1.5);
  const W = B.map((b) => ({ ...b })); W[i1] = { ...W[i1], close: 94 };
  t = trade(W, i0, i1, 0); near(t.g, 1);                    // a 6-point fall on a 6-point stop is +1R
  t = trade(W, i0, i1, 1); near(t.cost, 0.002 * 100 / 6); near(t.fin, t.nights * 0.03 / 365 * 100 / 6); near(t.net, t.g - t.cost - t.fin);
  assert.ok(t.nights > 85 && t.nights < 95, `about one night a calendar day (${t.nights})`);
  near(trade(W, i0, i1, 2).net, t.g - 2 * t.cost - 2 * t.fin);
});

test('no look-ahead: the ATR reads only candles before the entry, and candles after the exit change nothing', () => {
  const B = prep(cal([2021, 3, 1], [2021, 11, 10])), [i0, i1] = windowOf(B, 2021, 7), base = trade(B, i0, i1, 1);
  const F = B.map((b, i) => (i >= i0 ? { ...b, high: b.high + 0.5 } : b));   // a wider entry candle and later ones
  near(atrBefore(F, i0), atrBefore(B, i0));
  const A = B.map((b, i) => (i > i1 ? { ...b, open: 300, high: 400, low: 1, close: 2 } : b));
  assert.deepEqual(trade(A, i0, i1, 1), base);
  const S = B.map((b) => ({ ...b })); S[i0 - 1] = { ...S[i0 - 1], high: 120 };
  assert.ok(atrBefore(S, i0) > atrBefore(B, i0), 'the candle before the entry is read');
});

test('permutation p and Holm', () => {
  const pools = [[1, 0], [1, 0], [1, 0]];                   // the real mean 1 is reached in 1 of 8 assignments
  const p = permP(1, pools, 40000, 7); assert.ok(Math.abs(p - 0.125) < 0.01, `${p}`);
  assert.ok(permP(-5, pools, 1000, 7) > 0.99);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const t = (dec, rep, p) => ({ judged: true, decisive: { meanNet: dec, perm: { 1: p } }, replication: { meanNet: rep } });
  assert.equal(verdictOf([t(0.1, 0.1, 0.01), t(0.1, 0.1, 0.5), t(0.1, 0.1, 0.5)]), 'PASS');
  assert.equal(verdictOf([t(0.1, -0.1, 0.001), t(0.1, 0.1, 0.5), t(0.1, 0.1, 0.5)]), 'FAIL', 'replication must be positive');
  assert.equal(verdictOf([t(0.1, 0.1, 0.01), t(0.1, 0.1, 0.02), t(0.1, 0.1, 0.5)]), 'PASS', 'Holm 0.03 and 0.04');
  assert.equal(verdictOf([t(0.1, 0.1, 0.02), t(0.1, 0.1, 0.02), t(0.1, 0.1, 0.5)]), 'FAIL', 'Holm 0.06 for both');
});

test('result.json: every position has a stop above its entry, 11 decisive years, the pre-registered bar', () => {
  assert.equal(J.topic, 'grain-seasonality');
  for (const t of J.tests) {
    assert.equal(t.decisive.n, 11, t.id);
    for (const r of [...t.years.decisive, ...t.years.replication]) {
      assert.ok(r.stop > r.entry, `${t.id} ${r.year} stop`);
      assert.ok(r.g >= -1.0001 || r.why === 'stop-gap', `${t.id} ${r.year} loses at most 1R unless gapped`);
      near(r.net, Math.round((r.g - r.cost - r.fin) * 1000) / 1000, 0.0021);
    }
    assert.ok(t.years.decisive.every((r) => r.year >= 2016 && r.year <= 2026));
    assert.ok(t.years.replication.every((r) => r.year < 2016));
  }
  const judged = J.tests.filter((t) => t.judged), ps = holm(judged.map((t) => t.decisive.perm[1]));
  judged.forEach((t, i) => {
    near(t.holmP, +ps[i].toFixed(5), 1e-5);
    assert.equal(t.pass, t.decisive.meanNet > 0 && t.replication.meanNet > 0 && t.holmP < 0.05);
  });
  assert.equal(J.verdict, judged.some((t) => t.pass) ? 'PASS' : 'FAIL');
  assert.equal(J.tests.find((t) => t.id === 'control').pass, undefined, 'the control is never judged');
});

test('RESULT.md: the verdict line first, and its figures equal result.json', () => {
  const first = RES.split('\n').find((l) => l.trim());
  assert.match(first, new RegExp(`^\\*\\*Verdict: ${J.verdict}`));
  const f = (x) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(3);
  for (const t of J.tests) {
    for (const s of ['decisive', 'replication']) {
      const d = t[s];
      assert.ok(RES.includes(f(d.meanNet)), `${t.id} ${s} net ${f(d.meanNet)}`);
      assert.ok(RES.includes(f(d.meanG)), `${t.id} ${s} gross ${f(d.meanG)}`);
      assert.ok(RES.includes(`${d.won} of ${d.n}`), `${t.id} ${s} years won`);
      assert.ok(RES.includes(String(d.perm[1])), `${t.id} ${s} p ${d.perm[1]}`);
      assert.ok(RES.includes(`${d.rank} of ${d.of}`), `${t.id} ${s} rank`);
      assert.ok(RES.includes(`${d.placebo.atOrAbove} of 40`), `${t.id} ${s} placebo`);
    }
    if (t.judged) assert.ok(RES.includes(String(t.holmP)), `${t.id} Holm`);
    for (const r of t.years.decisive) assert.ok(RES.includes(`| ${r.year} | ${r.entryDay} | ${r.exitDay} |`), `${t.id} ${r.year} row`);
  }
});
