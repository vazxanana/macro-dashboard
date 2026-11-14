// research/edge/gold-range-expansion: the event on hand-made candles, the trade, one position at a time, no look-ahead,
// statistics, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prepare, eventAt, trade, run, events, monthT, holm, report, verdictLine, COST, TESTS } from '../research/edge/gold-range-expansion/run.mjs';

const dir = new URL('../research/edge/gold-range-expansion/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');

// hand-made candles every calendar day from 2024-01-01 (weekends get folded); quiet candles of range 2 around 100
function rows(n, f) { const out = []; let t = Date.UTC(2024, 0, 1) / 1000; for (let k = 0; k < n; k++, t += 86400) out.push(f(k, t)); return out; }
const quiet = (k, t) => [t, 100, 101, 99, 100, 1];

test('event: range >= 1.75 x ATR of the 20 candles before, close in the outer quarter', () => {
  const base = prepare(rows(60, quiet)), i = base.bars.findIndex((b) => new Date(b.time * 1000).toISOString().startsWith('2024-02-09'));
  const mkAt = (bar) => { const r = rows(60, quiet); const k = r.findIndex((x) => new Date(x[0] * 1000).toISOString().startsWith('2024-02-09')); r[k] = [r[k][0], ...bar, 1]; return prepare(r); };
  assert.equal(eventAt(mkAt([99.2, 104, 99, 103.9]).bars, i), 1);    // range 5 >= 3.5, close at the top
  assert.equal(eventAt(mkAt([103.8, 104, 99, 99.1]).bars, i), -1);   // close at the bottom
  assert.equal(eventAt(mkAt([100, 104, 99, 101.5]).bars, i), 0);     // wide but mid-range close
  assert.equal(eventAt(mkAt([100, 102, 99, 101.9]).bars, i), 0);     // range 3 < 3.5
});

test('trade: R, stop, costs, financing on buys only', () => {
  const P = prepare(rows(60, (i, t) => [t, 100 + i, 101 + i, 99 + i, 100 + i, 1]));
  const L = trade(P, 25, 30, 1), S = trade(P, 25, 30, -1);
  assert.ok(L.risk > 0 && L.R > 0); assert.ok(L.fin > 0); assert.equal(S.fin, 0);
  assert.ok(Math.abs(L.net - (L.R - COST / L.risk - L.fin)) < 1e-12);
  assert.equal(S.how, 'stop'); assert.ok(Math.abs(S.R + 1) < 1e-9);
  assert.equal(trade(P, 5, 8, 1), null);                                 // no ATR(20) yet
  assert.ok(Number.isFinite(L.stop) && L.stop < L.entry && S.stop > S.entry);   // every trade has a stop on the losing side
});

test('one position at a time: an event inside an open trade is skipped', () => {
  const P = prepare(rows(80, (i, t) => [t, 100 + Math.sin(i), 102 + Math.sin(i), 98 + Math.sin(i), 100 + Math.cos(i), 1]));
  const evs = [{ i: 30, dir: 1, mk: 'x' }, { i: 32, dir: -1, mk: 'x' }, { i: 40, dir: 1, mk: 'x' }];
  const A = run(P, evs, 'T1');
  assert.equal(A.skipped, 1); assert.deepEqual(A.T.map((x) => x.i), [30, 40]);
  assert.equal(A.T[0].side, 1); assert.equal(run(P, evs, 'T2').T[0].side, -1);   // T2 trades against the close
  assert.deepEqual(Object.fromEntries(Object.entries(TESTS).map(([k, v]) => [k, [v.with, v.hold]])), { T1: [1, 5], T2: [-1, 1], T3: [1, 20] });
});

test('no look-ahead: later prices move neither the event nor a trade', () => {
  const base = (i, t) => [t, 100 + Math.sin(i), 102 + Math.sin(i) + (i % 7 === 0 ? 4 : 0), 98 + Math.sin(i), 100 + Math.cos(i) + (i % 7 === 0 ? 4 : 0), 1];
  const a = rows(90, base), b = a.map((r, i) => i > 60 ? [r[0], 999, 1999, 1, 500, 1] : r);
  const Pa = prepare(a), Pb = prepare(b), cut = Pa.bars.findIndex((x) => x.time > a[60][0]) - 1;
  for (let i = 21; i <= cut; i++) assert.equal(eventAt(Pa.bars, i), eventAt(Pb.bars, i));
  assert.deepEqual(events(Pa).filter((e) => e.i <= cut), events(Pb).filter((e) => e.i <= cut));
  assert.deepEqual(trade(Pa, 25, 30, 1), trade(Pb, 25, 30, 1));
  assert.deepEqual(trade(Pa, 25, 30, -1), trade(Pb, 25, 30, -1));
});

test('statistics: month sums and Holm', () => {
  const T = [{ a: '2020-01-02', net: 1 }, { a: '2020-01-09', net: 1 }, { a: '2020-02-03', net: 1 }, { a: '2020-03-03', net: 3 }];
  const m = monthT(T); assert.equal(m.months, 3); assert.ok(m.t > 0);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
});

test('report matches result.json, verdict line', () => {
  assert.equal(R.verdict, 'FAIL'); assert.deepEqual(R.passed, []);
  assert.equal(MD.trim(), report(R).trim());
  const line = MD.match(/\*\*Verdict: [^\n]*\*\*/)[0];
  assert.equal(line, verdictLine(R)); assert.ok(line.length < 220, line);
  const T1 = R.tests.T1;
  assert.ok(line.includes(`n ${T1.oos.n}`) && line.includes(T1.oos.tNet.toFixed(2)) && line.includes(`${T1.placebo.beaten} of 40`));
  for (const k of ['T1', 'T2', 'T3']) { const r = R.tests[k];
    assert.equal(r.pass, Object.values(r.checks).every(Boolean));
    assert.equal(r.checks.oosT2, r.oos.tNet >= 2); assert.equal(r.checks.placebo, r.placebo.beaten >= 38); }
  assert.ok(!/is an edge/.test(MD.replace('Nothing is an edge here', '')));
});
