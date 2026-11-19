// node --test tests/gold-london-displacement.test.mjs — research/edge/gold-london-displacement (14 Nov 2026): one large M15
// candle in gold's first London hour, followed at the next M15 open. Hand-made candles (M15 build, ATR before the candle, the
// signal, stop / gap / target, costs and financing, the London clock), no look-ahead, the same-side baseline and the placebo,
// and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as S from '../research/edge/gold-london-displacement/run.mjs';
import { studyVerdict } from '../research/edge/verdict.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), DIR = path.join(HERE, '..', 'research', 'edge', 'gold-london-displacement');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const hm = (h, m) => h * 60 + m;
const T0 = Date.parse('2024-01-15T00:00:00Z') / 1000;           // a winter Monday: London hour = 08:00 UTC
// M5 rows of Sunday + Monday (Sunday only warms the ATR up; weekdays are traded), flat around 100 (each M5 high 100.1, low 99.9); patch by minute of day 2
const rowsOf = (patch = {}) => {
  const out = [];
  for (let t = T0 - 86400; t < T0 + 86400; t += 300) {
    const m = (t - T0) / 60, p = (m >= 0 && patch[m]) || [100, 100.1, 99.9, 100];
    out.push([t, ...p]);
  }
  return out;
};
// a displacement buy in the 08:15 M15 candle: 100 → 101 (three M5 candles), M15 ATR of the flat tape is 0.2
const BUY = { [hm(8, 15)]: [100, 100.4, 99.5, 100.35], [hm(8, 20)]: [100.35, 100.7, 100.3, 100.65], [hm(8, 25)]: [100.65, 101, 100.6, 100.95] };
const sig = (rows, test = S.TESTS.T1) => { const { days } = S.prepare(rows); return S.signalTrade(days.at(-1), test); };
// the prepare() window starts in 2007, so the hand-made days (2024) are inside it

test('the London clock and the M15 build: 08:00 London is 07:00 UTC in summer, else 08:00; an M15 needs three M5', () => {
  assert.equal(S.londonHour('2024-03-29'), 8); assert.equal(S.londonHour('2024-04-01'), 7);
  assert.equal(S.londonHour('2024-10-25'), 7); assert.equal(S.londonHour('2024-10-28'), 8); assert.equal(S.londonHour('2024-03-12'), 8);
  const m = S.m15Series([[900, 1, 2, 0.5, 1.5], [1200, 1.5, 3, 1, 2], [1500, 2, 2.5, 1.8, 2.2], [1800, 2, 2, 2, 2]]);
  assert.equal(m.length, 1); assert.deepEqual([m[0].t, m[0].o, m[0].h, m[0].l, m[0].c], [900, 1, 3, 0.5, 2.2]);
});

test('ATR is the mean true range of the 96 M15 candles BEFORE the candle, never the candle itself', () => {
  const m = S.m15Series(rowsOf(BUY)), i = m.findIndex((b) => b.t === T0 + hm(8, 15) * 60);
  assert.ok(Math.abs(m[i].atr - 0.2) < 1e-9, 'flat tape before: TR 0.2 each');
  assert.ok(m[i + 1].atr > 0.2, 'the big candle enters the next one');
  assert.equal(m[0].atr, null);
});

test('a buy at the next M15 open, stop at the candle low, out at 17:00 UTC; a sell mirrors it', () => {
  const x = sig(rowsOf(BUY));
  assert.equal(x.side, 1); assert.equal(x.entryMin, hm(8, 30)); assert.equal(x.entry, 100); assert.equal(x.stop, 99.5);
  assert.ok(Math.abs(x.r - 0.5) < 1e-9); assert.equal(x.how, 'time');
  assert.ok(Math.abs(x.kStop - 2.5) < 1e-9); assert.equal(x.fin, 0, 'out before the 22:00 rollover');
  assert.ok(Math.abs(x.net - (x.R - 0.6 / x.r)) < 1e-9); assert.ok(Math.abs(x.net2 - (x.R - 1.2 / x.r)) < 1e-9);
  const flip = (rows) => rows.map(([t, o, h, l, c]) => [t, 200 - o, 200 - l, 200 - h, 200 - c]);
  const s = sig(flip(rowsOf(BUY)));
  assert.equal(s.side, -1); assert.equal(s.stop, 100.5); assert.ok(Math.abs(s.R - x.R) < 1e-9);
});

test('no signal: a small candle, a weak body, a big candle outside the London hour', () => {
  assert.equal(sig(rowsOf()).skip, 'nosignal');
  const weak = { [hm(8, 15)]: [100, 101, 99.95, 100.1] };          // range 1.05, body 0.1
  assert.equal(sig(rowsOf(weak)).skip, 'nosignal');
  const late = {}; for (const [m, v] of Object.entries(BUY)) late[+m + 60] = v;   // 09:15, after the winter London hour
  assert.equal(sig(rowsOf(late)).skip, 'nosignal');
  const summer = S.displacement(S.m15Series(rowsOf(BUY)).filter((b) => b.t >= T0), 7);
  assert.equal(summer, null, 'with a 07:00 UTC hour the 08:15 candle is outside it');
});

test('stops, gaps and the 2R target', () => {
  const stop = sig(rowsOf({ ...BUY, [hm(9, 0)]: [100, 100.05, 99.4, 99.6] }));
  assert.equal(stop.how, 'stop'); assert.equal(stop.exit, 99.5); assert.ok(Math.abs(stop.R + 1) < 1e-9);
  const gap = sig(rowsOf({ ...BUY, [hm(8, 35)]: [99.3, 99.4, 99.2, 99.3] }));
  assert.equal(gap.how, 'stop'); assert.equal(gap.exit, 99.3, 'a gap through the stop fills at the open');
  const tg = sig(rowsOf({ ...BUY, [hm(9, 0)]: [100, 101.1, 99.95, 101] }), S.TESTS.T2);
  assert.equal(tg.how, 'target'); assert.ok(Math.abs(tg.exit - 101) < 1e-9); assert.ok(Math.abs(tg.R - 2) < 1e-9);
  const both = sig(rowsOf({ ...BUY, [hm(9, 0)]: [100, 101.1, 99.4, 100] }), S.TESTS.T2);
  assert.equal(both.how, 'stop', 'stop and target in one candle: the stop');
});

test('T3: the candle must close beyond the Asian range', () => {
  assert.equal(sig(rowsOf(BUY), S.TESTS.T3).side, 1, 'closes 100.95 above the Asian high 100.1');
  assert.equal(sig(rowsOf({ ...BUY, [hm(3, 0)]: [100, 101.5, 99.9, 100] }), S.TESTS.T3).skip, 'inside');
});

test('no look-ahead: candles from 17:00 UTC change nothing; the signal ignores later London candles', () => {
  const base = sig(rowsOf(BUY));
  assert.deepEqual(sig(rowsOf({ ...BUY, [hm(17, 0)]: [100, 500, 1, 2], [hm(22, 0)]: [0, 999, 0, 1] })), base);
  const later = { ...BUY, [hm(8, 45)]: [100, 99.9, 98, 98.1] };   // a bigger sell candle after the signal
  assert.equal(sig(rowsOf(later)).side, 1);
});

test('baseline and placebo keep side, entry minute, ATR-multiple stop and exit, on other days', () => {
  const { days, atrAt } = S.prepare(rowsOf(BUY)), x = S.signalTrade(days.at(-1), S.TESTS.T1);
  const y = S.shifted(days[0], { ...x, day: 'other' }, 0, atrAt);
  assert.ok(y && y.stop < y.entry && Math.abs(y.r - 2.5 * atrAt.get(T0 + hm(8, 15) * 60)) < 1e-9, 'same side, stop = the same ATR multiple');
  assert.equal(S.shifted(days[0], x, 0, new Map()), null, 'no ATR known: no trade');
  const tr = [{ day: '2021-01-04', net: 1 }, { day: '2021-01-05', net: 1 }, { day: '2021-02-01', net: 3 }, { day: '2021-03-01', net: 2 }];
  const m = S.monthT(tr); assert.equal(m.months, 3); assert.ok(Math.abs(m.t - 7) < 1e-9);
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
  assert.equal(v.verdict, Object.values(R.decision).some((d) => d.pass) ? 'pass' : 'fail');
  assert.ok(v.headline.length <= 221);
});

test('stand-alone: only the financing rule is imported, windows and costs as pre-registered, not a rule of the gold book', () => {
  const src = read('run.mjs');
  assert.deepEqual([...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]).filter((p) => p.startsWith('.')), ['../../../council/fills.mjs']);
  assert.deepEqual(S.WINDOWS.IS, ['2007-01-01', '2016-12-31']); assert.deepEqual(S.WINDOWS.OOS, ['2017-01-01', '2026-10-31']);
  assert.equal(S.COST, 0.6); assert.equal(S.K_ATR, 2); assert.equal(S.BODY, 0.6); assert.equal(S.ATR_N, 96);
  assert.match(read('PREREGISTRATION.md'), /not a gate, exit, entry or size of the live gold book/);
});
