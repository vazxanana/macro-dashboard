// research/edge/gold-mid-month-turn: the months from the candles, the signal (against the month-to-date move) on hand-made
// candles, the trade, no look-ahead, the placebo, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prepare, months, signal, trade, placebo, monthT, holm, verdictLine, report, COST, TESTS, dateOf } from '../research/edge/gold-mid-month-turn/run.mjs';

const dir = new URL('../research/edge/gold-mid-month-turn/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');

// hand-made candles every calendar day from 2024-01-01 (weekends get folded); f(k, t) -> [t, o, h, l, c, v]
function rows(n, f) { const out = []; let t = Date.UTC(2024, 0, 1) / 1000; for (let k = 0; k < n; k++, t += 86400) out.push(f(k, t)); return out; }
const flat = (i, t) => [t, 100, 101, 99, 100, 1];
const mar = (P) => months(P.bars).find((m) => m.mk === '2024-03');

test('tests are the pre-registered ones', () => {
  assert.deepEqual(Object.keys(TESTS), ['T1', 'T2', 'T3']);
  assert.deepEqual([TESTS.T1.k, TESTS.T1.h, TESTS.T1.minAtr], [10, 5, 0]);
  assert.deepEqual([TESTS.T2.k, TESTS.T2.h, TESTS.T2.minAtr], [10, 5, 1]);
  assert.deepEqual([TESTS.T3.k, TESTS.T3.h, TESTS.T3.minAtr], [8, 7, 0]);
});

test('signal: AGAINST the sign of TD+k against the previous month\'s last close, both sides, the 1 ATR threshold', () => {
  // flat until the end of February, then March drifts up by 1 a day (or down)
  const up = prepare(rows(120, (i, t) => { const c = i < 60 ? 100 : 100 + (i - 59); return [t, c, c + 1, c - 1, c, 1]; }));
  const dn = prepare(rows(120, (i, t) => { const c = i < 60 ? 100 : 100 - (i - 59); return [t, c, c + 1, c - 1, c, 1]; }));
  const s1 = signal(up, mar(up), 'T1'), s2 = signal(dn, mar(dn), 'T1');
  assert.equal(dateOf(up.bars[s1.i].time), '2024-03-14');                 // 1 Mar is a Friday: TD+10 = Thursday 14 Mar
  assert.equal(s1.side, -1); assert.equal(s2.side, 1);                    // sell after an up month, buy after a down one
  assert.equal(dateOf(up.bars[signal(up, mar(up), 'T3').i].time), '2024-03-12');
  const P = prepare(rows(120, flat)); assert.equal(signal(P, mar(P), 'T1'), null);
  const tiny = prepare(rows(120, (i, t) => { const c = i < 63 ? 100 : 100.2; return [t, c, c + 1, c - 1, c, 1]; }));
  assert.equal(signal(tiny, mar(tiny), 'T1').side, -1); assert.equal(signal(tiny, mar(tiny), 'T2'), null);
});

test('trade: R, stop, costs, financing on buys only', () => {
  const P = prepare(rows(60, (i, t) => [t, 100 + i, 101 + i, 99 + i, 100 + i, 1]));
  const L = trade(P, 25, 30, 1), S = trade(P, 25, 35, -1);
  assert.ok(L.risk > 0 && L.R > 0); assert.ok(L.fin > 0); assert.equal(S.fin, 0);
  assert.ok(Math.abs(L.net - (L.R - COST / L.risk - L.fin)) < 1e-12);
  assert.equal(S.how, 'stop'); assert.ok(Math.abs(S.R + 1) < 1e-9);       // every trade has a stop, on the losing side
  assert.ok(S.stop > S.entry && L.stop < L.entry);
  assert.equal(trade(P, 5, 8, 1), null);                                 // no ATR(20) yet
  assert.equal(trade(P, 50, 70, 1), null);                               // exit candle not on file
});

test('no look-ahead: candles after the entry do not move the side or the stop; after the exit nothing moves', () => {
  const base = (i, t) => { const c = 100 + 3 * Math.sin(i / 3) + (i > 60 ? (i - 60) * 0.5 : 0); return [t, c, c + 2, c - 2, c, 1]; };
  const a = rows(130, base), Pa = prepare(a), s = signal(Pa, mar(Pa), 'T1');
  const cut = Pa.bars[s.i].time;
  const b = a.map((r) => r[0] > cut ? [r[0], 999, 1999, 1, 500, 1] : r), Pb = prepare(b);
  assert.deepEqual(signal(Pb, mar(Pb), 'T1'), s);
  assert.equal(trade(Pa, s.i, s.i + 3, s.side).stop, trade(Pb, s.i, s.i + 3, s.side).stop);
  const j = s.i + TESTS.T1.h, end = Pa.bars[j].time, c = a.map((r) => r[0] > end ? [r[0], 999, 1999, 1, 500, 1] : r), Pc = prepare(c);
  assert.deepEqual(trade(Pa, s.i, j, s.side), trade(Pc, s.i, j, s.side));
});

test('placebo is seeded and repeatable; statistics: month sums and Holm', () => {
  const P = prepare(rows(200, (i, t) => { const c = 100 + 5 * Math.sin(i / 7); return [t, c, c + 1, c - 1, c, 1]; }));
  const evs = [{ i: 40, j: 45 }, { i: 70, j: 75 }, { i: 100, j: 105 }];
  assert.deepEqual(placebo(P, evs, 5), placebo(P, evs, 5));
  const T = [{ a: '2020-01-02', net: 1 }, { a: '2020-01-09', net: 1 }, { a: '2020-02-03', net: 1 }, { a: '2020-03-03', net: 3 }];
  const m = monthT(T); assert.equal(m.months, 3); assert.ok(m.t > 0);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
});

test('report matches result.json, verdict line', () => {
  assert.equal(R.verdict, 'FAIL'); assert.deepEqual(R.passed, []);
  assert.equal(MD, report(R));                                            // the page is written from result.json only
  const line = MD.match(/\*\*Verdict: [^\n]*\*\*/)[0];
  assert.equal(line, verdictLine(R)); assert.ok(line.length < 220, line);
  const T1 = R.tests.T1;
  assert.ok(line.includes(Math.abs(T1.oos.net).toFixed(3)) && line.includes(`n ${T1.oos.n}`) && line.includes(Math.abs(T1.oos.tNet).toFixed(2)) && line.includes(`${T1.placebo.beaten} of 40`));
  for (const k of ['T1', 'T2', 'T3']) { const r = R.tests[k];
    assert.equal(r.pass, Object.values(r.checks).every(Boolean));
    assert.equal(r.pass, false);
    assert.ok(r.oos.medStop >= 10 && r.is.medStop >= 10, `${k}: median stop of at least $10`); }
  assert.deepEqual(R.rules.IS, ['2007-01', '2016-12']); assert.deepEqual(R.rules.OOS, ['2017-01', '2026-10']);
  assert.ok(!/is an edge/.test(MD));
});
