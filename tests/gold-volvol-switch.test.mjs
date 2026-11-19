// research/edge/gold-volvol-switch: the regime, the two signals and the switch on hand-made candles, the trade, one position
// at a time, no look-ahead, statistics, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prepare, regimeAt, breakoutAt, reversalAt, signals, trade, run, monthT, holm, report, verdictLine, COST, HOLD, TESTS } from '../research/edge/gold-volvol-switch/run.mjs';

const dir = new URL('../research/edge/gold-volvol-switch/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');

// hand-made candles on weekdays only from 2024-01-01 (a Monday), so the fold changes nothing
function rows(n, f) { const out = []; let t = Date.UTC(2024, 0, 1) / 1000, k = 0; while (out.length < n) { const w = new Date(t * 1000).getUTCDay(); if (w >= 1 && w <= 5) out.push(f(k++, t)); t += 86400; } return out; }

test('regime: rising when ATR(20) is above ATR(20) ten candles earlier', () => {
  // ranges widen after candle 30: ATR rises; narrow after 60: ATR falls
  const w = (i) => i < 30 ? 1 : i < 60 ? 4 : 0.5;
  const P = prepare(rows(90, (i, t) => [t, 100, 100 + w(i), 100 - w(i), 100, 1]));
  assert.equal(regimeAt(P.bars, 25), null);          // not enough history (needs ATR at i-10)
  assert.equal(regimeAt(P.bars, 45), 1);
  assert.equal(regimeAt(P.bars, 75), 0);
  assert.equal(regimeAt(P.bars, 40), 1);
});

test('signals: 20-day breakout of highs / lows, 5-day close reversal', () => {
  const base = rows(40, (i, t) => [t, 100, 101, 99, 100, 1]);
  const up = base.map((r, i) => i === 30 ? [r[0], 100, 103, 99.5, 102, 1] : r);
  const dn = base.map((r, i) => i === 30 ? [r[0], 100, 100.5, 97, 98, 1] : r);
  assert.equal(breakoutAt(prepare(up).bars, 30), 1); assert.equal(breakoutAt(prepare(dn).bars, 30), -1);
  assert.equal(breakoutAt(prepare(base).bars, 30), 0);
  // closes 100, then a close below every one of the 5 before -> buy (+1); above -> sell (-1)
  assert.equal(reversalAt(prepare(dn).bars, 30), 1); assert.equal(reversalAt(prepare(up).bars, 30), -1);
  const mid = base.map((r, i) => i === 30 ? [r[0], 100, 100.5, 99.5, 100.2, 1] : i === 28 ? [r[0], 100, 101, 99, 100.5, 1] : r);
  assert.equal(reversalAt(prepare(mid).bars, 30), 0);   // not above the 100.5 close two days before
});

test('the switch: rising takes the breakout, falling the reversal', () => {
  const P = prepare(rows(60, (i, t) => [t, 100, 101, 99, 100, 1]));
  P.B = P.B.map(() => 1); P.V = P.V.map(() => -1);
  const reg = P.reg.map((r, i) => r == null ? null : i % 2);
  const s1 = signals(P, 'T1', reg);
  assert.ok(s1.length > 0);
  for (const e of s1) { assert.equal(e.leg, reg[e.i] ? 'B' : 'V'); assert.equal(e.dir, reg[e.i] ? 1 : -1); }
  assert.ok(signals(P, 'T2', reg).every((e) => reg[e.i] === 1 && e.leg === 'B'));
  assert.ok(signals(P, 'T3', reg).every((e) => reg[e.i] === 0 && e.leg === 'V'));
  assert.deepEqual(Object.fromEntries(Object.entries(TESTS).map(([k, v]) => [k, [v.rising, v.falling]])), { T1: ['B', 'V'], T2: ['B', null], T3: [null, 'V'] });
});

test('trade: next open entry, stop 2 x ATR, 10-day hold, costs, financing on buys only', () => {
  const P = prepare(rows(60, (i, t) => [t, 100 + i, 101 + i, 99 + i, 100 + i, 1]));
  const L = trade(P, 25, 1), S = trade(P, 25, -1);
  assert.equal(L.entry, P.bars[26].open);
  assert.ok(L.risk > 0 && L.R > 0 && L.how === 'time' && L.out === 25 + HOLD);
  assert.ok(L.fin > 0); assert.equal(S.fin, 0);
  assert.ok(Math.abs(L.net - (L.R - COST / L.risk - L.fin)) < 1e-12);
  assert.equal(S.how, 'stop'); assert.ok(Math.abs(S.R + 1) < 1e-9);
  assert.equal(trade(P, 5, 1), null);                                 // no ATR(20) yet
  assert.equal(trade(P, 55, 1), null);                                // exit not on file
  assert.ok(Number.isFinite(L.stop) && L.stop < L.entry && S.stop > S.entry);   // every trade has a stop on the losing side
});

test('one position at a time: a signal inside an open trade is skipped', () => {
  const P = prepare(rows(80, (i, t) => [t, 100 + Math.sin(i), 102 + Math.sin(i), 98 + Math.sin(i), 100 + Math.cos(i), 1]));
  const sig = [{ i: 30, dir: 1, leg: 'B', mk: 'x' }, { i: 35, dir: -1, leg: 'V', mk: 'x' }, { i: 45, dir: 1, leg: 'B', mk: 'x' }];
  const A = run(P, sig);
  assert.equal(A.skipped, 1); assert.deepEqual(A.T.map((x) => x.i), [30, 45]);
});

test('no look-ahead: later prices move neither the labels, the signals nor a trade', () => {
  const base = (i, t) => [t, 100 + Math.sin(i), 102 + Math.sin(i) + (i % 7 === 0 ? 3 : 0), 98 + Math.sin(i / 3), 100 + Math.cos(i / 2) * 3, 1];
  const a = rows(100, base), b = a.map((r, i) => i > 70 ? [r[0], 999, 1999, 1, 500, 1] : r);
  const Pa = prepare(a), Pb = prepare(b);
  for (let i = 0; i <= 70; i++) { assert.equal(Pa.reg[i], Pb.reg[i]); assert.equal(Pa.B[i], Pb.B[i]); assert.equal(Pa.V[i], Pb.V[i]); }
  for (const k of ['T1', 'T2', 'T3']) assert.deepEqual(signals(Pa, k).filter((e) => e.i <= 70), signals(Pb, k).filter((e) => e.i <= 70));
  assert.deepEqual(trade(Pa, 40, 1), trade(Pb, 40, 1));
  assert.deepEqual(trade(Pa, 40, -1), trade(Pb, 40, -1));
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
    assert.equal(r.checks.oosT2, r.oos.tNet >= 2); assert.equal(r.checks.placebo, r.placebo.beaten >= 38);
    assert.ok(r.oos.medStop >= 10 && r.is.medStop >= 10); }
  assert.ok(!/is an edge/.test(MD.replace('Nothing is an edge here', '')));
});
