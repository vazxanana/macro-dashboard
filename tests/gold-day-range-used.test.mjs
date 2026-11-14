// node --test tests/gold-day-range-used.test.mjs — research/edge/gold-day-range-used (14 Nov 2026): gold's day range already
// used up by 15:00 UTC, faded (or followed) to 21:00 UTC against the same side on every eligible day of the month. Hand-made
// H1 candles (ADR from the days before, the 15:00 reading, sides, stop / gap, costs and financing), no look-ahead, the
// baseline and placebo, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as S from '../research/edge/gold-day-range-used/run.mjs';
import { studyVerdict } from '../research/edge/verdict.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), DIR = path.join(HERE, '..', 'research', 'edge', 'gold-day-range-used');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const DAY0 = Date.parse('2024-01-01T00:00:00Z') / 1000;   // a Monday
// 20 flat weekdays (each hour h 100.5 l 99.5: ADR 1.0), then the test day (Monday 29 Jan) shaped by `day(k)` per hour k
function rowsOf(day) {
  const out = [];
  let n = 0;
  for (let t = DAY0; n < 21; t += 86400) {
    const w = new Date(t * 1000).getUTCDay(); if (w === 0 || w === 6) continue;
    for (let k = 0; k < 24; k++) out.push(n < 20 ? [t + k * 3600, 100, 100.5, 99.5, 100] : [t + k * 3600, ...day(k)]);
    n++;
  }
  return out;
}
// a day that climbs 100 → 101.2 by 15:00 UTC (range 1.27 = 1.27 x ADR, closing at the top), then flat
const UP = (k) => { if (k < 15) { const o = 100 + 0.08 * k; return [o, o + 0.1, o - 0.05, o + 0.08]; } return [101.2, 101.25, 101.15, 101.2]; };
const last = (rows) => S.makeDays(rows).at(-1);
const flip = (f) => (k) => { const [o, h, l, c] = f(k); return [200 - o, 200 - l, 200 - h, 200 - c]; };

test('ADR is the mean whole-day range of the 20 complete weekdays BEFORE the day', () => {
  const days = S.makeDays(rowsOf(UP));
  assert.equal(days.length, 21); assert.equal(days.at(-1).day, '2024-01-29');
  assert.ok(Math.abs(days.at(-1).adr - 1) < 1e-9); assert.equal(days[19].adr, null, 'no ADR before 20 days exist');
});

test('the 15:00 reading: U and P from the 00:00-14:00 candles; T1 fades, T3 follows, T2 needs U >= 1.5', () => {
  const d = last(rowsOf(UP)), cp = S.checkpoint(d);
  assert.ok(Math.abs(cp.U - 1.27) < 1e-9); assert.ok(cp.P > 0.95);
  assert.equal(S.sideOf(cp, S.TESTS.T1), -1); assert.equal(S.sideOf(cp, S.TESTS.T3), 1); assert.equal(S.sideOf(cp, S.TESTS.T2), 0);
  const dn = S.checkpoint(last(rowsOf(flip(UP))));
  assert.equal(S.sideOf(dn, S.TESTS.T1), 1); assert.equal(S.sideOf(dn, S.TESTS.T3), -1);
  const mid = (k) => (k === 14 ? [101, 101.05, 100.5, 100.6] : UP(k));     // closes in the middle of the range
  assert.equal(S.sideOf(S.checkpoint(last(rowsOf(mid))), S.TESTS.T1), 0);
  const small = (k) => [100, 100.3, 99.9, 100];                              // a quiet morning, U 0.4
  assert.equal(S.sideOf(S.checkpoint(last(rowsOf(small))), S.TESTS.T1), 0);
});

test('the trade: 15:00 open → 20:00 close, stop 0.5 x ADR, costs $0.60 a round trip, no financing before the rollover', () => {
  const d = last(rowsOf(UP)), x = S.trade(d, -1);
  assert.equal(x.entry, 101.2); assert.equal(x.stop, 101.7); assert.equal(x.r, 0.5); assert.equal(x.how, 'time');
  assert.ok(Math.abs(x.R) < 1e-9); assert.ok(Math.abs(x.net + 1.2) < 1e-9); assert.ok(Math.abs(x.net2 + 2.4) < 1e-9);
  assert.equal(S.trade(d, 1).fin, 0, 'out at 21:00 UTC, before the 22:00 UTC rollover');
  const stopped = (k) => (k === 17 ? [101.2, 101.9, 101.1, 101.8] : UP(k));
  const s = S.trade(last(rowsOf(stopped)), -1); assert.equal(s.how, 'stop'); assert.equal(s.exit, 101.7); assert.ok(Math.abs(s.R + 1) < 1e-9);
  const gap = (k) => (k === 16 ? [102, 102.1, 101.95, 102] : UP(k));
  const g = S.trade(last(rowsOf(gap)), -1); assert.equal(g.exit, 102, 'a gap through the stop fills at the open');
  const hole = (k) => UP(k); const rows = rowsOf(hole).filter((r) => r[0] !== Date.parse('2024-01-29T20:00:00Z') / 1000);
  assert.equal(S.trade(last(rows), -1), null, 'no 20:00 candle, no trade');
});

test('no look-ahead: candles from 15:00 UTC on never change the reading', () => {
  const a = S.checkpoint(last(rowsOf(UP)));
  const wild = (k) => (k >= 15 ? [101.2, 150, 50, 120] : UP(k));
  assert.deepEqual(S.checkpoint(last(rowsOf(wild))), a);
  const days = S.makeDays(rowsOf(wild)); assert.ok(Math.abs(days.at(-1).adr - 1) < 1e-9, 'the day itself is not in its ADR');
});

test('the same-side baseline of the month, the excess, statistics and the placebo seeds', () => {
  const days = S.makeDays(rowsOf(UP)), base = S.baselineByMonth(days);
  assert.equal(base.get('2024-01|-1'), S.trade(days.at(-1), -1).net, 'one eligible day in that month');
  const { tr } = S.runTest(days, S.TESTS.T1, base);
  assert.equal(tr.length, 1); assert.ok(Math.abs(tr[0].excess) < 1e-12);
  const m = S.monthT([{ day: '2021-01-04', net: 1 }, { day: '2021-01-05', net: 1 }, { day: '2021-02-01', net: 3 }, { day: '2021-03-01', net: 2 }]);
  assert.equal(m.months, 3); assert.ok(Math.abs(m.t - 7) < 1e-9);
  S.holm([0.01, 0.04, 0.03]).forEach((v, i) => assert.ok(Math.abs(v - [0.03, 0.06, 0.06][i]) < 1e-12));
  assert.equal(S.rng(7)(), S.rng(7)());
});

test('the report is run.mjs\'s function of result.json; pre-registration hash, verdict line, decision', () => {
  const R = JSON.parse(read('result.json'));
  assert.equal(read('RESULT.md'), S.report(R));
  assert.equal(R.planSha256, crypto.createHash('sha256').update(read('PREREGISTRATION.md')).digest('hex'));
  assert.equal(R.verdict, S.verdictLine(R.tests, R.decision));
  assert.ok(R.verdict.length < 220);
  const pl = Object.fromEntries(['T1', 'T2', 'T3'].map((k) => [k, R.placebo[k].means]));
  assert.deepEqual(S.decide(R.tests, pl), R.decision);
  for (const k of ['T1', 'T2', 'T3']) { assert.equal(R.placebo[k].means.length, 40); assert.ok(R.tests[k].OOS.n >= 30); }
  const v = studyVerdict(R, read('RESULT.md'));
  assert.equal(v.verdict, R.decision.T1.pass ? 'pass' : 'fail');
  assert.ok(v.headline.length <= 221);
});

test('stand-alone: only the financing rule is imported, windows and costs as pre-registered, not a rule of the gold book', () => {
  const src = read('run.mjs');
  assert.deepEqual([...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]).filter((p) => p.startsWith('.')), ['../../../council/fills.mjs']);
  assert.deepEqual(S.WINDOWS.IS, ['2007-01-01', '2016-12-31']); assert.deepEqual(S.WINDOWS.OOS, ['2017-01-01', '2026-10-31']);
  assert.equal(S.COST, 0.6); assert.equal(S.STOP_K, 0.5); assert.equal(S.ADR_N, 20); assert.equal(S.CHECK_H, 15); assert.equal(S.EXIT_H, 21);
  assert.match(read('PREREGISTRATION.md'), /not a gate, exit, entry or size of the live gold book/);
});
