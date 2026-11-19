// research/edge/gold-rv-term: the 5 / 60-day volatility ratio, the trend side and the signals on hand-made candles, the trade,
// one position at a time, the every-day baseline and excess, the shuffled-path control, no look-ahead, and the report against
// result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prepare, rv, ratioAt, sideAt, isSignal, signals, trade, run, everyDay, withExcess, shuffledPath, mulberry32, monthT, holm, report, verdictLine, COST, HOLD } from '../research/edge/gold-rv-term/run.mjs';

const dir = new URL('../research/edge/gold-rv-term/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');

// hand-made candles on weekdays only from 2024-01-01 (a Monday), so the weekend fold changes nothing
function rows(n, f) { const out = []; let t = Date.UTC(2024, 0, 1) / 1000, k = 0; while (out.length < n) { const w = new Date(t * 1000).getUTCDay(); if (w >= 1 && w <= 5) out.push(f(k++, t)); t += 86400; } return out; }

test('ratio: calm last week after a volatile quarter is compression, a burst is expansion', () => {
  // closes alternate +/- 2 % for 70 candles, then +/- 0.2 % (compression); a second path does the opposite (expansion)
  const calm = rows(80, (i, t) => { const c = 100 * Math.exp((i % 2 ? 1 : -1) * (i < 75 ? 0.02 : 0.002)) * (1 + i * 0.001); return [t, c, c * 1.001, c * 0.999, c, 1]; });
  const P = prepare(calm);
  assert.equal(ratioAt(P.bars, 59), null); assert.ok(ratioAt(P.bars, 60) > 0);   // 60 returns need 61 candles
  assert.ok(ratioAt(P.bars, 79) < 0.6, String(ratioAt(P.bars, 79)));
  const burst = rows(80, (i, t) => { const c = 100 * Math.exp((i % 2 ? 1 : -1) * (i < 75 ? 0.002 : 0.03)); return [t, c, c * 1.001, c * 0.999, c, 1]; });
  assert.ok(ratioAt(prepare(burst).bars, 79) > 1.2);
  assert.ok(Math.abs(rv(P.bars, 79, 5) / rv(P.bars, 79, 60) - ratioAt(P.bars, 79)) < 1e-12);
});

test('side: the sign of the 60-day change; signals need a side and the ratio past the threshold', () => {
  const up = prepare(rows(80, (i, t) => [t, 100 + i, 101 + i, 99 + i, 100 + i, 1]));
  assert.equal(sideAt(up.bars, 70), 1); assert.equal(sideAt(up.bars, 50), 0);
  const dn = prepare(rows(80, (i, t) => [t, 200 - i, 201 - i, 199 - i, 200 - i, 1]));
  assert.equal(sideAt(dn.bars, 70), -1);
  const P = prepare(rows(80, (i, t) => [t, 100, 101, 99, 100 + i, 1]));
  P.q = P.q.map((x, i) => x == null ? null : i % 3 === 0 ? 0.5 : i % 3 === 1 ? 1.5 : 1);
  for (let i = 61; i < 80; i++) { assert.equal(isSignal(P, 'T1', i), i % 3 === 0); assert.equal(isSignal(P, 'T2', i), i % 3 === 1); }
  P.s = P.s.map(() => 0); assert.equal(isSignal(P, 'T1', 63), false);
});

test('trade: next open entry, stop 2 x ATR on the losing side, 10-day hold, costs, financing on buys only', () => {
  const P = prepare(rows(60, (i, t) => [t, 100 + i, 101 + i, 99 + i, 100 + i, 1]));
  const L = trade(P, 25, 1), S = trade(P, 25, -1);
  assert.equal(L.entry, P.bars[26].open);
  assert.ok(L.risk > 0 && L.R > 0 && L.how === 'time' && L.out === 25 + HOLD);
  assert.ok(L.fin > 0); assert.equal(S.fin, 0);
  assert.ok(Math.abs(L.net - (L.R - COST / L.risk - L.fin)) < 1e-12);
  assert.equal(S.how, 'stop'); assert.ok(Math.abs(S.R + 1) < 1e-9);
  assert.ok(L.stop < L.entry && S.stop > S.entry);
  assert.equal(trade(P, 5, 1), null); assert.equal(trade(P, 55, 1), null); assert.equal(trade(P, 25, 0), null);
});

test('one position at a time, the every-day baseline and the excess', () => {
  const P = prepare(rows(120, (i, t) => [t, 100 + Math.sin(i), 102 + Math.sin(i), 98 + Math.sin(i), 100 + Math.cos(i) + i * 0.05, 1]));
  const A = run(P, [{ i: 70, dir: 1, mk: 'x' }, { i: 75, dir: -1, mk: 'x' }, { i: 90, dir: 1, mk: 'x' }]);
  assert.equal(A.skipped, 1); assert.deepEqual(A.T.map((x) => x.i), [70, 90]);
  const E = { base: { '1:2024': { net: 0.25, R: 0.3 } } };
  const X = withExcess([{ a: '2024-05-01', side: 1, net: 1, R: 1.1 }], E.base)[0];
  assert.ok(Math.abs(X.ex - 0.75) < 1e-12 && Math.abs(X.exG - 0.8) < 1e-12);
  const ED = everyDay(P);                                       // every candle with a side and a full hold on file, overlapping
  assert.ok(ED.D.length > 0 && ED.D.every((x) => x.side !== 0 && x.i + HOLD < P.bars.length));
  for (const sd of [1, -1]) { const v = ED.D.filter((x) => x.side === sd); if (!v.length) continue;
    assert.ok(Math.abs(ED.base[`${sd}:2024`].net - v.reduce((s, x) => s + x.net, 0) / v.length) < 1e-12); }
});

test('control: the shuffled path keeps each year\'s moves, only their order', () => {
  const a = rows(300, (i, t) => { const o = 100 + Math.sin(i), c = 100 + Math.cos(i / 3) * 4 + i * 0.1; return [t, o, Math.max(o, c) + 1, Math.min(o, c) - 1, c, 1]; });
  const P = prepare(a), S = shuffledPath(P.bars, mulberry32(7));
  assert.equal(S.length, P.bars.length); assert.equal(S[0], P.bars[0]);
  const rel = (B) => B.slice(1).map((x, k) => +(x.close / B[k].close).toFixed(10)).sort();
  assert.deepEqual(rel(S), rel(P.bars));
  assert.notDeepEqual(S.map((x) => x.close), P.bars.map((x) => x.close));
  for (const x of S) assert.ok(x.high >= Math.max(x.open, x.close) - 1e-9 && x.low <= Math.min(x.open, x.close) + 1e-9);
});

test('no look-ahead: later prices move neither the ratio, the side, the signals nor a trade', () => {
  const base = (i, t) => [t, 100 + Math.sin(i), 102 + Math.sin(i) + (i % 7 === 0 ? 3 : 0), 98 + Math.sin(i / 3), 100 + Math.cos(i / 2) * 3, 1];
  const a = rows(140, base), b = a.map((r, i) => i > 100 ? [r[0], 999, 1999, 1, 500, 1] : r);
  const Pa = prepare(a), Pb = prepare(b);
  for (let i = 0; i <= 100; i++) { assert.equal(Pa.q[i], Pb.q[i]); assert.equal(Pa.s[i], Pb.s[i]); }
  for (const k of ['T1', 'T2']) for (let i = 61; i <= 100; i++) assert.equal(isSignal(Pa, k, i), isSignal(Pb, k, i));
  assert.deepEqual(trade(Pa, 80, 1), trade(Pb, 80, 1)); assert.deepEqual(trade(Pa, 80, -1), trade(Pb, 80, -1));
  assert.deepEqual(signals(Pa, 'T1').filter((e) => e.i <= 100), signals(Pb, 'T1').filter((e) => e.i <= 100));
});

test('statistics: month sums and Holm', () => {
  const T = [{ a: '2020-01-02', ex: 1 }, { a: '2020-01-09', ex: 1 }, { a: '2020-02-03', ex: 1 }, { a: '2020-03-03', ex: 3 }];
  const m = monthT(T); assert.equal(m.months, 3); assert.ok(m.t > 0);
  assert.deepEqual(holm([0.01, 0.04]), [0.02, 0.04]);
});

test('report matches result.json, verdict line, events per window', () => {
  assert.equal(R.verdict, 'FAIL'); assert.deepEqual(R.passed, []);
  assert.equal(MD.trim(), report(R).trim());
  const line = MD.match(/\*\*Verdict: [^\n]*\*\*/)[0];
  assert.equal(line, verdictLine(R)); assert.ok(line.length < 220, line);
  const T1 = R.tests.T1;
  assert.ok(line.includes(`n ${T1.oos.n}`) && line.includes(T1.oos.tEx.toFixed(2)));
  for (const k of ['T1', 'T2']) { const r = R.tests[k];
    assert.ok(r.is.n >= 100 && r.oos.n >= 100, k);
    assert.equal(r.pass, Object.values(r.checks).every(Boolean));
    assert.equal(r.checks.oosT2, r.oos.tEx >= 2); assert.equal(r.checks.placebo, r.placebo.beaten >= 38); assert.equal(r.checks.control, r.control.beaten >= 38);
    assert.equal(r.placebo.seeds, 40); assert.equal(r.control.seeds, 40); }
  assert.ok(!/is an edge/.test(MD.replace('Nothing is an edge here', '')));
});
