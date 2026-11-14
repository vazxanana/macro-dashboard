// node --test tests/gold-comex-orb.test.mjs — research/edge/gold-comex-orb (14 Nov 2026): the COMEX-open range breakout on
// hand-made candles (breakout, fade, stops, costs), no look-ahead, the narrow-range flag, and the report against result.json.
// Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as S from '../research/edge/gold-comex-orb/run.mjs';
import { studyVerdict } from '../research/edge/verdict.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), DIR = path.join(HERE, '..', 'research', 'edge', 'gold-comex-orb');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const hm = (h, m) => h * 60 + m;
// a day 00:00 → 16:55: flat at 100 (high 100.5, low 99.5), range 08:20-08:50 = 99.5 → 100.5 (width 1); patches by minute
const day = (patch = {}) => { const out = []; for (let m = 0; m < 17 * 60; m += 5) { const p = patch[m] || [100, 100.5, 99.5, 100]; out.push({ t: m * 60, min: m, o: p[0], h: p[1], l: p[2], c: p[3] }); } return out; };
// an up break: the 09:30 candle closes 100.8 above the range high 100.5; entry at the 09:35 open 101
const up = (after = {}) => day({ [hm(9, 30)]: [100.2, 100.9, 100.1, 100.8], [hm(9, 35)]: [101, 101.2, 100.6, 101], ...after });
const T1 = S.TESTS.T1, T3 = S.TESTS.T3;

test('T1: breakout in the break direction, entry at the next open, stop at the opposite side, 2R target, out at 12:00', () => {
  const x = S.orbTrade(up(), { ...T1, cost: 0, slip: 0 });
  assert.equal(x.side, 1); assert.equal(x.breakAt, hm(9, 30)); assert.equal(x.entryAt, hm(9, 35));
  assert.equal(x.entry, 101); assert.equal(x.stop, 99.5); assert.equal(x.r, 1.5); assert.equal(x.target, 104);
  assert.equal(x.how, 'stop', 'the flat day after the entry trades back to 99.5: stopped'); assert.equal(x.R, -1);
  // a day that drifts up without reaching the target: out at the close of the 11:55 candle
  const p = {}; for (let m = hm(9, 40); m < 17 * 60; m += 5) p[m] = [101.5, 101.8, 101.2, 101.5];
  p[hm(11, 55)] = [101.5, 101.8, 101.2, 102];
  const t = S.orbTrade(up(p), { ...T1, cost: 0, slip: 0 });
  assert.equal(t.how, 'time'); assert.equal(t.exit, 102); assert.ok(Math.abs(t.R - 1 / 1.5) < 1e-12);
  // a target: limit, no exit slippage
  const g = S.orbTrade(up({ [hm(9, 40)]: [101, 104.2, 100.9, 104] }), T1);
  assert.equal(g.how, 'target'); assert.equal(g.R, 2); assert.ok(Math.abs(g.costUsd - 0.45) < 1e-12); assert.ok(Math.abs(g.net - (2 - 0.45 / 1.5)) < 1e-12);
  assert.equal(x.costUsd === undefined, false); assert.ok(Math.abs(S.orbTrade(up(), T1).costUsd - 0.6) < 1e-12, 'a stop exit pays slippage too');
  assert.ok(Math.abs(S.orbTrade(up(), T1).net2 - (-1 - 1.2 / 1.5)) < 1e-12, '2x costs');
  // a sell mirrors a buy
  const flip = (b) => b.map((c) => ({ ...c, o: 200 - c.o, h: 200 - c.l, l: 200 - c.h, c: 200 - c.c }));
  const s = S.orbTrade(flip(up({ [hm(9, 40)]: [101, 104.2, 100.9, 104] })), { ...T1, cost: 0, slip: 0 });
  assert.equal(s.side, -1); assert.equal(s.entry, 99); assert.equal(s.stop, 100.5); assert.equal(s.target, 96); assert.equal(s.how, 'target');
});

test('stops: stop first when one candle holds both, a gap through the stop fills at the open', () => {
  assert.equal(S.orbTrade(up({ [hm(9, 40)]: [101, 105, 99, 101] }), T1).how, 'stop');
  const g = S.orbTrade(up({ [hm(9, 40)]: [99, 99.2, 98.5, 99] }), { ...T1, cost: 0, slip: 0 });
  assert.equal(g.how, 'stop'); assert.equal(g.exit, 99); assert.ok(g.R < -1);
  assert.equal(S.orbTrade(up({ [hm(9, 35)]: [99.4, 99.6, 99.3, 99.5] }), T1).skip, 'norisk', 'entry open already past the stop');
});

test('T3 fade: against the break, stop at the 08:20 → break-candle extreme, 1R', () => {
  const x = S.orbTrade(up({ [hm(9, 35)]: [100.6, 100.7, 100.6, 100.6] }), { ...T3, cost: 0, slip: 0 });
  assert.equal(x.side, -1); assert.equal(x.entry, 100.6); assert.equal(x.stop, 100.9); assert.ok(Math.abs(x.r - 0.3) < 1e-12);
  assert.ok(Math.abs(x.target - 100.3) < 1e-12); assert.equal(x.how, 'target');
  // the extreme is read only up to the break candle: a later high does not move the stop
  const y = S.orbTrade(up({ [hm(9, 35)]: [100.6, 100.7, 100.6, 100.6], [hm(9, 40)]: [100.6, 100.65, 100.2, 100.25], [hm(10, 0)]: [100, 120, 90, 100] }), { ...T3, cost: 0, slip: 0 });
  assert.equal(y.stop, 100.9);
});

test('no trade: no break by 11:25, a missing range candle, too few candles after the range', () => {
  assert.equal(S.orbTrade(day(), T1).skip, 'nobreak');
  assert.equal(S.orbTrade(day({ [hm(11, 30)]: [100.2, 100.9, 100.1, 100.8] }), T1).skip, 'nobreak', 'a close outside at 11:30 is after the window');
  assert.equal(S.orbTrade(day({ [hm(11, 25)]: [100.2, 100.9, 100.1, 100.8] }), T1).breakAt, hm(11, 25));
  assert.equal(S.orbTrade(up().filter((b) => b.min !== hm(8, 30)), T1).skip, 'range');
  assert.equal(S.orbTrade(up().filter((b) => b.min < hm(10, 0) || b.min >= hm(12, 0)), T1).skip, 'missing');
  assert.equal(S.tradingDay('2024-03-29'), false, 'Good Friday'); assert.equal(S.tradingDay('2024-07-03'), false, 'early close');
  assert.equal(S.tradingDay('2024-03-06'), true); assert.equal(S.tradingDay('2024-03-09'), false, 'Saturday');
});

test('no look-ahead: candles after 12:00 change nothing; the narrow flag reads only earlier days', () => {
  const base = S.orbTrade(up({ [hm(9, 40)]: [101, 104.2, 100.9, 104] }), T1);
  const later = up({ [hm(9, 40)]: [101, 104.2, 100.9, 104], [hm(12, 0)]: [104, 150, 50, 120], [hm(15, 0)]: [120, 130, 1, 2] });
  assert.deepEqual(S.orbTrade(later, T1), base);
  // also before the target: the 12:00+ candles are never read
  const p = {}; for (let m = hm(9, 40); m < hm(12, 0); m += 5) p[m] = [101.5, 101.8, 101.2, 101.5];
  assert.deepEqual(S.orbTrade(up({ ...p, [hm(12, 30)]: [0, 500, 0, 1] }), T1), S.orbTrade(up(p), T1));
  // narrow: 21 days of width 1, then a day of 0.5 (narrow) and of 2 (wide); a later wide day does not change an earlier flag
  const w = (lo, hi) => { const p = {}; for (let m = hm(8, 20); m < hm(8, 50); m += 5) p[m] = [100, hi, lo, 100]; return day(p); };
  const days = []; for (let i = 0; i < 21; i++) days.push({ day: `d${String(i).padStart(2, '0')}`, bars: w(99.5, 100.5) });
  days.push({ day: 'd21', bars: w(99.8, 100.3) }, { day: 'd22', bars: w(99, 101) });
  const f = S.narrowFlags(days);
  assert.equal(f.get('d19'), undefined, 'warm-up'); assert.equal(f.get('d20'), false, 'equal to the median is not under it');
  assert.equal(f.get('d21'), true); assert.equal(f.get('d22'), false);
  assert.equal(S.narrowFlags([...days, { day: 'd23', bars: w(90, 110) }]).get('d21'), true);
});

test('statistics: month t, Holm, placebo seeds are deterministic', () => {
  const tr = [{ day: '2021-01-04', net: 1 }, { day: '2021-01-05', net: 1 }, { day: '2021-02-01', net: 3 }, { day: '2021-03-01', net: 2 }];
  const m = S.monthT(tr); assert.equal(m.months, 3); assert.ok(Math.abs(m.t - 7) < 1e-9);
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

test('stand-alone: only the CME calendar of ict/ is imported, no candle before 2016', () => {
  const src = read('run.mjs');
  const imps = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]).filter((p) => p.startsWith('.'));
  assert.deepEqual(imps, ['../../../ict/calendar.mjs']);
  assert.equal(S.WINDOWS.IS[0], '2016-01-01');
  assert.match(read('PREREGISTRATION.md'), /Item 44/);
});
