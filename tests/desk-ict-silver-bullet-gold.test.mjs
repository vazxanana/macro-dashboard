// node --test tests/desk-ict-silver-bullet-gold.test.mjs — research/edge/ict-silver-bullet-gold (14 Nov 2026): the silver
// bullet rule on hand-made candles, no look-ahead, the calendar grouping, and the report against result.json. Offline.
// Not named tests/ict-*: it checks research files, not the ICT desk's own code.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as S from '../research/edge/ict-silver-bullet-gold/run.mjs';
import { studyVerdict } from '../research/edge/verdict.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), DIR = path.join(HERE, '..', 'research', 'edge', 'ict-silver-bullet-gold');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const AM = S.WIN.T1, LV = { bsl: 110, ssl: 90 };
// a flat day 00:00 → 15:55 at 100, then patches; t = minute x 60 so consecutive candles are 300 s apart
const day = (patch = {}) => { const out = []; for (let m = 0; m < 16 * 60; m += 5) { const p = patch[m] || [100, 100.5, 99.5, 100]; out.push({ t: m * 60, min: m, o: p[0], h: p[1], l: p[2], c: p[3] }); } return out; };
const hm = (h, m) => h * 60 + m;
// buy side swept at 09:00, a sell gap c1 10:00 / c2 10:05 / c3 10:10, the limit (c3 high 103) touched at 10:20
const sellDay = (after = {}) => day({
  [hm(9, 0)]: [104, 111, 104, 105],
  [hm(10, 0)]: [106, 106.5, 105, 105.2], [hm(10, 5)]: [105.2, 105.3, 102, 102.2], [hm(10, 10)]: [102.2, 103, 101.5, 101.8],
  [hm(10, 15)]: [101.8, 102.5, 101.6, 102.4], [hm(10, 20)]: [102.4, 103.2, 102.3, 102.9], ...after });

test('a sell after the buy side is swept: limit at c3 high, stop at c1 high, target the nearer of 2R and the draw', () => {
  const x = S.dayTrade(sellDay(), LV, AM, 0);
  assert.equal(x.side, -1); assert.equal(x.entry, 103); assert.equal(x.stop, 106.5); assert.equal(x.r, 3.5);
  assert.equal(x.target, 96, '2R (96) is nearer than the draw (90)');
  assert.equal(x.gapAt, hm(10, 10)); assert.equal(x.fillAt, hm(10, 20));
  assert.equal(x.how, 'time'); assert.equal(x.exit, 100); assert.ok(Math.abs(x.R - 3 / 3.5) < 1e-12);
  const near = S.dayTrade(sellDay(), { bsl: 110, ssl: 98 }, AM, 0);
  assert.equal(near.target, 98, 'the draw is nearer than 2R');
  assert.equal(S.dayTrade(sellDay({ [hm(10, 0)]: [106, 108, 105, 105.2] }), { bsl: 110, ssl: 99.5 }, AM, 0).skip, 'room', 'under 1R to the draw (3.5 against r 5)');
  assert.ok(Math.abs(S.dayTrade(sellDay(), LV, AM).net - (x.R - 0.3 / 3.5)) < 1e-12, '$0.30 cost in R');
});

test('stop first, stop only in the fill candle, a gap through the stop fills at the open', () => {
  assert.equal(S.dayTrade(sellDay({ [hm(10, 20)]: [102.4, 107, 95, 100] }), LV, AM, 0).how, 'stop', 'fill candle reaching stop and target: stop');
  const t = S.dayTrade(sellDay({ [hm(10, 20)]: [102.4, 103.2, 95, 96], [hm(10, 25)]: [96, 96.5, 95.5, 96] }), LV, AM, 0);
  assert.equal(t.how, 'target'); assert.equal(t.exit, 96); assert.equal(t.fillAt, hm(10, 20), 'target only after the fill candle');
  const g = S.dayTrade(sellDay({ [hm(10, 30)]: [108, 108.5, 107, 108] }), LV, AM, 0);
  assert.equal(g.how, 'stop'); assert.equal(g.exit, 108);
  const both = S.dayTrade(sellDay({ [hm(10, 30)]: [102, 107, 95, 100] }), LV, AM, 0);
  assert.equal(both.how, 'stop');
});

test('no trade: no sweep, both sides, the opposite side before the fill, no gap in the window, no fill by 11:00', () => {
  assert.equal(S.dayTrade(sellDay({ [hm(9, 0)]: [100, 100.5, 99.5, 100] }), LV, AM, 0).skip, 'nosweep');
  assert.equal(S.dayTrade(sellDay({ [hm(9, 0)]: [100, 111, 89, 100] }), LV, AM, 0).skip, 'both');
  assert.equal(S.dayTrade(sellDay({ [hm(9, 30)]: [100, 100.5, 89, 100] }), LV, AM, 0).skip, 'opposite');
  assert.equal(S.dayTrade(sellDay({ [hm(10, 5)]: [105.2, 105.3, 102, 105.25] }), LV, AM, 0).skip, 'nogap', 'middle candle must close down');
  assert.equal(S.dayTrade(sellDay({ [hm(10, 20)]: [102.4, 102.9, 102.3, 102.8] }), LV, AM, 0).skip, 'nofill');
  // a gap whose third candle opens at 10:55 is too late
  const late = day({ [hm(9, 0)]: [104, 111, 104, 105], [hm(10, 45)]: [106, 106.5, 105, 105.2], [hm(10, 50)]: [105.2, 105.3, 102, 102.2], [hm(10, 55)]: [102.2, 103, 101.5, 101.8] });
  assert.equal(S.dayTrade(late, LV, AM, 0).skip, 'nogap');
  // a buy mirrors a sell
  const flip = (b) => b.map((x) => ({ ...x, o: 200 - x.o, h: 200 - x.l, l: 200 - x.h, c: 200 - x.c }));
  const b = S.dayTrade(flip(sellDay()), { bsl: 110, ssl: 90 }, AM, 0);
  assert.equal(b.side, 1); assert.equal(b.entry, 97); assert.equal(b.stop, 93.5); assert.equal(b.target, 104);
});

test('no look-ahead: candles after the exit, or after 11:00 on a day with no fill, change nothing', () => {
  const base = S.dayTrade(sellDay({ [hm(10, 30)]: [102, 102.5, 95, 96] }), LV, AM, 0);
  assert.equal(base.how, 'target');
  const later = sellDay({ [hm(10, 30)]: [102, 102.5, 95, 96], [hm(12, 0)]: [96, 150, 50, 120], [hm(15, 0)]: [120, 130, 1, 2] });
  assert.deepEqual(S.dayTrade(later, LV, AM, 0), base);
  const nf = sellDay({ [hm(10, 20)]: [102.4, 102.9, 102.3, 102.8] });
  nf[nf.findIndex((b) => b.min === hm(11, 0))] = { t: hm(11, 0) * 60, min: hm(11, 0), o: 103, h: 104, l: 102, c: 103 };
  assert.equal(S.dayTrade(nf, LV, AM, 0).skip, 'nofill', 'a touch at 11:00 is after the window');
  // the levels read only the prior 17:00 day and 18:00 → 00:00 before D
  const T = (s) => Date.parse(s) / 1000;
  const rows = [['2024-03-05T20:00:00Z', 2100, 2120, 2090], ['2024-03-05T23:30:00Z', 2105, 2110, 2100], ['2024-03-06T00:30:00Z', 2105, 2112, 2098],
    ['2024-03-06T05:30:00Z', 2105, 2111, 2095], ['2024-03-06T15:00:00Z', 2100, 2500, 1500]].map(([s, o, h, l]) => [T(s), o, h, l, o]);
  const G = S.groupDays(rows), lv = S.levels(G, '2024-03-06');
  assert.equal(S.priorDay('2024-03-06'), '2024-03-05'); assert.equal(S.priorDay('2024-03-11'), '2024-03-08');
  assert.deepEqual([lv.pdh, lv.pdl, lv.ah, lv.al, lv.bsl, lv.ssl], [2120, 2090, 2112, 2098, 2120, 2090], 'D\'s own 10:00 candle is not read');
  assert.equal(S.tradingDay('2024-03-29'), false, 'Good Friday'); assert.equal(S.tradingDay('2024-07-03'), false, 'early close');
  assert.equal(S.tradingDay('2024-03-06'), true);
});

test('statistics: month t, Holm, placebo seeds are deterministic', () => {
  const tr = [{ day: '2021-01-04', net: 1 }, { day: '2021-01-05', net: 1 }, { day: '2021-02-01', net: 3 }, { day: '2021-03-01', net: 2 }];
  const m = S.monthT(tr); assert.equal(m.months, 3); assert.ok(Math.abs(m.t - 7) < 1e-9, "sums 2, 3, 2: mean 7/3, sd 1/sqrt 3");
  S.holm([0.01, 0.04, 0.03]).forEach((v, i) => assert.ok(Math.abs(v - [0.03, 0.06, 0.06][i]) < 1e-12));
  assert.equal(S.rng(7)(), S.rng(7)());
});

test('the report is run.mjs\'s function of result.json, pre-registration hash and the verdict line', () => {
  const R = JSON.parse(read('result.json'));
  assert.equal(read('RESULT.md'), S.report(R));
  assert.equal(R.planSha256, crypto.createHash('sha256').update(read('PREREGISTRATION.md')).digest('hex'));
  assert.equal(R.verdict, S.verdictLine(R.tests, R.decision));
  assert.ok(R.verdict.length < 220);
  const p95 = S.quantile(R.placebo.means, 0.95); assert.ok(Math.abs(p95 - R.placebo.p95) < 1e-3);
  assert.deepEqual(S.decide(R.tests, p95), R.decision);
  assert.equal(R.placebo.means.length, 40);
  const v = studyVerdict(R, read('RESULT.md')); assert.equal(v.verdict, R.decision.T1.pass ? 'pass' : 'fail');
  assert.ok(v.headline.length <= 221);
  for (const k of ['T1', 'T2', 'T3']) for (const w of ['IS', 'OOS']) assert.ok(R.tests[k][w].n >= 30, `${k} ${w}`);
});

test('ICT stays separate: only the CME calendar of ict/ is imported, no model names, no pre-2016 candle', () => {
  const src = read('run.mjs');
  const imps = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]).filter((p) => p.startsWith('.'));
  assert.deepEqual(imps, ['../../../ict/calendar.mjs']);
  assert.equal(S.WINDOWS.IS[0], '2016-01-01');
  assert.match(read('PREREGISTRATION.md'), /Item 44/);
});
