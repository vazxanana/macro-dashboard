// research/edge/dom-gold-quality: can the better DOM-zone gold trades be told apart at the fill? (offline: files and pure helpers)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FEATS, LEVELS, SHRINK, SHUFFLES, NEED, EXIT, ROUTE, sessionOf, weekdayOf, ageBand, terc, tercCuts, quant, levelsOf, fit, score, groupOf, welch, monthT, monthsBetween,
  verdictOf, erAt, judge, verdictLine } from '../research/edge/dom-gold-quality/run.mjs';
import { FROM, SPLIT } from '../research/edge/dom-gold-hourcost/run.mjs';

const DIR = new URL('../research/edge/dom-gold-quality/', import.meta.url);
const read = (f) => fs.readFileSync(new URL(f, DIR), 'utf8');
const U = (y, m, d, h = 0) => Date.UTC(y, m, d, h) / 1000;

test('dom-gold-quality: the pre-registration names the trades, the score, the test and the bars', () => {
  const p = read('PREREGISTRATION.md').replace(/\s+/g, ' ');
  for (const w of ['dom-gold-hourcost', 'C1', '4R', 'n / (n + 200)', 'terciles of the A scores', 'KEEP', 'AVOID', 'MID', 'Welch t >= 2', 'month-sum t >= 2', '40 seeds', 'at least 38 of the 40',
    'USEFUL TO AVOID', 'Welch t <= -2', 'cut test', 'never an edge', 'One run'])
    assert.ok(p.includes(w), w);
  assert.equal(FEATS.length, 10);
  assert.deepEqual(Object.keys(LEVELS), FEATS);
  assert.equal(SHRINK, 200); assert.equal(SHUFFLES, 40); assert.equal(NEED, 38); assert.equal(EXIT, '4R'); assert.equal(ROUTE, 'C1');
  assert.equal(FROM, U(2021, 0, 1)); assert.equal(SPLIT, U(2024, 0, 1));
});

test('dom-gold-quality: sessions, weekdays, zone age, terciles', () => {
  const s = (h) => sessionOf(U(2024, 0, 3, h));
  assert.deepEqual([22, 23, 0, 6].map(s), ['Asia', 'Asia', 'Asia', 'Asia']);
  assert.deepEqual([7, 11].map(s), ['London', 'London']);
  assert.deepEqual([12, 16].map(s), ['New York', 'New York']);
  assert.deepEqual([17, 21].map(s), ['late', 'late']);
  assert.equal(weekdayOf(U(2024, 0, 7, 23)), 'Monday');            // the Sunday reopen
  assert.equal(weekdayOf(U(2024, 0, 8, 10)), 'Monday');
  assert.equal(weekdayOf(U(2024, 0, 10, 10)), 'Tuesday-Thursday');
  assert.equal(weekdayOf(U(2024, 0, 12, 10)), 'Friday');
  assert.deepEqual([0, 3, 4, 12, 13].map(ageBand), ['0-3', '0-3', '4-12', '4-12', 'over 12']);
  assert.equal(quant([1, 2, 3, 4], 0.5), 2.5);
  const c = tercCuts([1, 2, 3, 4, 5, 6, 7]); assert.deepEqual(c, [3, 5]);
  assert.deepEqual([3, 3.1, 5, 5.1].map((v) => terc(v, c)), ['low', 'mid', 'mid', 'high']);
  assert.equal(monthsBetween(U(2024, 0, 1), U(2024, 3, 1)).length, 3);
  // efficiency ratio: a straight line is 1, a zigzag that ends where it began is 0
  const D = Array.from({ length: 30 }, (_, i) => ({ c: 100 + i }));
  assert.equal(erAt(D, 25), 1); assert.equal(erAt(D, 10), null);
  const Z = Array.from({ length: 30 }, (_, i) => ({ c: 100 + (i % 2) }));
  assert.equal(erAt(Z, 25), 0);
});

// hand-made trades: only the side matters (buys win, sells lose), every other feature constant
const mk = (t, side, net) => ({ t, side, net, R: net + 0.1, costShare: 0.05, stopAtr: 1, sideways: true, trend: 'with', move20: 'with', er: 0.3, age: 2 });
// for judge(): the side, the session and the zone age each carry a part of the outcome
const HOURS = [3, 9, 14, 19], SESS = [-0.6, 0.6, 0.2, -0.2], AGE = [1, 6, 20], AGEV = [-0.3, 0, 0.3];
const hand = (from, n, flip = 1) => Array.from({ length: n }, (_, i) => { const side = i % 2 ? 1 : -1, h = i % 4, a = i % 3;
  return { ...mk(from + i * 86400 * 3 + HOURS[h] * 3600, side, flip * (0.5 * side + SESS[h] + AGEV[a]) + (i % 7) * 0.01), age: AGE[a] }; });

test('dom-gold-quality: the score is the shrunk level mean, summed; cuts are the terciles of the fitted scores', () => {
  const A = [...Array(300)].map((_, i) => mk(U(2021, 0, 4, 10), i < 100 ? 1 : -1, i < 100 ? 1 : -0.5));
  const m = fit(A);
  assert.ok(Math.abs(m.all) < 1e-12);
  assert.ok(Math.abs(m.val.side.buy - (1 - 0) * 100 / 300) < 1e-12);            // (mean - all) x n / (n + 200)
  assert.ok(Math.abs(m.val.side.sell - (-0.5 - 0) * 200 / 400) < 1e-12);
  for (const f of FEATS) if (f !== 'side') for (const v of Object.values(m.val[f])) assert.ok(Math.abs(v) < 1e-12, f);
  assert.ok(Math.abs(score(A[0], m) - m.val.side.buy) < 1e-12);
  assert.equal(groupOf(score(A[0], m), m), 'keep');
  assert.equal(groupOf(score(A[299], m), m), 'avoid');
  assert.equal(levelsOf(A[0], m.cuts).side, 'buy');
  // a level never seen in A adds nothing
  const m2 = { ...m, val: { ...m.val, age: {} } };
  assert.ok(Math.abs(score(A[0], m2) - m.val.side.buy) < 1e-12);
  // the fit reads outcomes only through netOf
  const z = fit(A, () => 0); assert.ok(Object.values(z.val.side).every((v) => v === 0));
});

test('dom-gold-quality: Welch t, month-sum t and the verdict rule', () => {
  assert.ok(welch([1, 2, 3, 4], [-1, -2, -3, -4]) > 2);
  assert.equal(welch([1], [2, 3]), null);
  const rows = [{ t: U(2024, 0, 5), net: 1 }, { t: U(2024, 1, 5), net: 1.2 }, { t: U(2024, 2, 5), net: 0.8 }];
  assert.ok(monthT(rows, U(2024, 0, 1), U(2024, 3, 1)) > 2);
  assert.ok(monthT(rows, U(2024, 0, 1), U(2025, 0, 1)) < monthT(rows, U(2024, 0, 1), U(2024, 3, 1)));   // empty months count as zero
  const ok = { keepMean: 0.2, allMean: 0.07, keepWelch: 3, keepMonthT: 4, beaten: 38, avoidWelch: 0.5, avoidMean: 0.1 };
  assert.equal(verdictOf(ok).verdict, 'PASS');
  assert.equal(verdictOf({ ...ok, beaten: 37 }).verdict, 'FAIL');
  assert.equal(verdictOf({ ...ok, keepWelch: 1.99 }).verdict, 'FAIL');
  assert.equal(verdictOf({ ...ok, keepMonthT: 1.9 }).verdict, 'FAIL');
  assert.equal(verdictOf({ ...ok, keepMean: 0.05 }).verdict, 'FAIL');
  assert.equal(verdictOf({ ...ok, keepMean: -0.01, allMean: -0.1 }).verdict, 'FAIL');
  assert.equal(verdictOf({ ...ok, keepWelch: 1, avoidWelch: -2, avoidMean: -0.05 }).verdict, 'USEFUL TO AVOID');
  assert.equal(verdictOf({ ...ok, keepWelch: 1, avoidWelch: -2, avoidMean: 0.01 }).verdict, 'FAIL');
  assert.equal(verdictOf({ ...ok, keepWelch: 1, avoidWelch: -1.9, avoidMean: -0.05 }).verdict, 'FAIL');
});

test('dom-gold-quality: judge() passes a pattern that repeats and not one that flips', () => {
  const END = U(2026, 10, 1);
  const good = judge([...hand(FROM, 360), ...hand(SPLIT, 340)], END);
  assert.equal(good.verdict, 'PASS');
  assert.ok(good.groups.B.keep.net > 0.4 && good.groups.B.avoid.net < -0.4);
  assert.ok(good.placebo.beaten >= 38);
  assert.equal(good.placebo.seeds, 40);
  assert.equal(good.n.A + good.n.B, 700);
  const bad = judge([...hand(FROM, 360), ...hand(SPLIT, 340, -1)], END);
  assert.notEqual(bad.verdict, 'PASS');
  assert.ok(bad.groups.B.keep.net < 0);
});

test('dom-gold-quality: RESULT.md says what result.json says', () => {
  const r = JSON.parse(read('result.json')), md = read('RESULT.md'), line = md.split('\n')[2];
  assert.ok(['PASS', 'USEFUL TO AVOID', 'FAIL'].includes(r.verdict));
  assert.ok(line.startsWith(`**Verdict: ${r.verdict}. `), line);
  assert.equal(line, verdictLine(r));
  assert.equal(line, r.line);
  assert.ok(r.gates.G1 && r.gates.G2 && r.gates.G3 && r.gates.probe);
  assert.ok(r.cut.length >= 1 && r.cut.every((c) => c.same && c.compared > 1000));
  // the verdict follows from the stored numbers
  const T = r.test;
  assert.equal(verdictOf({ keepMean: T.keepMean, allMean: T.allMean, keepWelch: T.keepWelch, keepMonthT: T.keepMonthT, beaten: r.placebo.beaten, avoidWelch: T.avoidWelch, avoidMean: T.avoidMean }).verdict, r.verdict);
  const B = r.groups.B, A = r.groups.A;
  assert.equal(B.keep.n + B.mid.n + B.avoid.n, r.n.B); assert.equal(A.keep.n + A.mid.n + A.avoid.n, r.n.A);
  assert.equal(r.all.A.n, 8850);                                   // dom-gold-hourcost's window A
  assert.equal(B.keep.net, T.keepMean);
  assert.equal(r.levels.length, Object.values(LEVELS).reduce((a, v) => a + v.length, 0));
  for (const f of FEATS) { const rows = r.levels.filter((x) => x.f === f); assert.equal(rows.reduce((a, x) => a + x.A.n, 0), r.n.A, f); assert.equal(rows.reduce((a, x) => a + x.B.n, 0), r.n.B, f); }
  const num = (v) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3);
  for (const k of ['keep', 'mid', 'avoid']) assert.ok(md.includes(`| ${k.toUpperCase()} | ${A[k].n} / ${num(A[k].net)}`) && md.includes(`| ${B[k].n} / ${num(B[k].net)}`), k);
  assert.ok(md.includes(`${r.placebo.beaten} of ${r.placebo.seeds}`));
  assert.ok(/not an edge/.test(md) && /in-sample years/.test(md));
  assert.ok(!/\bis an edge\b|proven/i.test(md));
});
