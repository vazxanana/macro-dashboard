// node --test tests/gold-vol-breakout.test.mjs — research/edge/gold-vol-breakout (14 Nov 2026): the open ± k × previous-day-range
// breakout on hand-made candles (fills, stops, gaps, both levels in one candle, costs), the folded D1 and the trend flag with
// no look-ahead, the placebo, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as S from '../research/edge/gold-vol-breakout/run.mjs';
import { studyVerdict } from '../research/edge/verdict.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), DIR = path.join(HERE, '..', 'research', 'edge', 'gold-vol-breakout');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const D0 = Date.parse('2024-03-06T00:00:00Z') / 1000;          // a Wednesday
const hm = (h, m) => h * 60 + m;
// the day's 00:00-20:55 candles: flat at 100 (high 100.2, low 99.8), patches by minute; prevRange 2 → k 0.5 levels 101 / 99
const day = (patch = {}) => { const out = []; for (let m = 0; m < 21 * 60; m += 5) { const p = patch[m] || [100, 100.2, 99.8, 100]; out.push({ t: D0 + m * 60, o: p[0], h: p[1], l: p[2], c: p[3] }); } return out; };
const T1 = { ...S.TESTS.T1, prevRange: 2, cost: 0 };
const near = (a, b) => Math.abs(a - b) < 1e-9;

test('T1: buy stop at open + 0.5 × range, stop back at the open, out at the 20:55 close', () => {
  const p = { [hm(9, 0)]: [100, 101.5, 100.05, 101.4] };
  for (let m = hm(9, 5); m < 21 * 60; m += 5) p[m] = [101.4, 101.6, 101.2, 101.5];
  p[hm(20, 55)] = [101.5, 101.9, 101.4, 101.8];
  const x = S.vbTrade(day(p), T1);
  assert.equal(x.side, 1); assert.equal(x.up, 101); assert.equal(x.dn, 99); assert.equal(x.entry, 101); assert.equal(x.stop, 100);
  assert.equal(x.r, 1); assert.equal(x.how, 'time'); assert.equal(x.exit, 101.8); assert.ok(near(x.R, 0.8));
  assert.equal(x.fillMin, hm(9, 0)); assert.equal(x.nights, 0, 'no trade crosses the 22:00 rollover'); assert.equal(x.finR, 0);
  // costs: $0.60 a round trip, 2x reported
  const c = S.vbTrade(day(p), { ...T1, cost: 0.6 }); assert.ok(near(c.net, 0.8 - 0.6)); assert.ok(near(c.net2, 0.8 - 1.2));
  // a sell mirrors it
  const q = { [hm(9, 0)]: [100, 99.95, 98.5, 98.6] }; for (let m = hm(9, 5); m < 21 * 60; m += 5) q[m] = [98.6, 98.8, 98.4, 98.5];
  const s = S.vbTrade(day(q), T1); assert.equal(s.side, -1); assert.equal(s.entry, 99); assert.equal(s.stop, 100); assert.ok(near(s.R, 0.5));
});

test('stop mechanics on clean candles', () => {
  // fill candle reaches the stop after the fill: stopped at the open level, −1R
  const base = (patch) => { const b = day(patch); return b.map((c) => (c.t - D0 >= hm(9, 0) * 60 ? c : { ...c, h: 100.2, l: 99.9 })); };
  const flatAfter = {}; for (let m = hm(9, 5); m < 21 * 60; m += 5) flatAfter[m] = [101.2, 101.4, 101.1, 101.2];
  const a = S.vbTrade(base({ ...flatAfter, [hm(9, 0)]: [100.1, 101.5, 99.95, 101.2] }), T1);
  assert.equal(a.how, 'stop'); assert.equal(a.exit, 100); assert.equal(a.R, -1);
  const b = S.vbTrade(base({ ...flatAfter, [hm(9, 0)]: [100.1, 101.5, 100.05, 101.2], [hm(10, 0)]: [101.2, 101.3, 99.5, 99.7] }), T1);
  assert.equal(b.how, 'stop'); assert.equal(b.exit, 100); assert.equal(b.R, -1);
  const g = S.vbTrade(base({ ...flatAfter, [hm(9, 0)]: [100.1, 101.5, 100.05, 101.2], [hm(10, 0)]: [99.5, 99.7, 99.2, 99.4] }), T1);
  assert.equal(g.exit, 99.5, 'gap through the stop fills at the open'); assert.ok(near(g.R, -1.5));
  // a candle opening above the buy level fills at its open (missing candles before it)
  const bars = base({ ...flatAfter, [hm(9, 0)]: [101.4, 101.6, 101.3, 101.5] }).filter((c) => c.t - D0 !== hm(8, 55) * 60);
  const o = S.vbTrade(bars, T1); assert.equal(o.entry, 101.4); assert.ok(near(o.r, 1.4));
  // both levels in one candle: the one nearer its open fills, then the stop is inside the candle: −1R
  const both = S.vbTrade(base({ ...flatAfter, [hm(9, 0)]: [100.8, 101.5, 98.5, 99] }), T1);
  assert.equal(both.side, 1); assert.equal(both.how, 'stop'); assert.equal(both.R, -1);
  const both2 = S.vbTrade(base({ ...flatAfter, [hm(9, 0)]: [99.3, 101.5, 98.5, 99] }), T1); assert.equal(both2.side, -1);
  // no level reached: no trade
  assert.equal(S.vbTrade(base({}), T1).skip, 'nofill');
});

test('T2 and T3: k 0.7 levels, buys only', () => {
  const p = { [hm(9, 0)]: [100, 101.5, 99.9, 101.4] };
  const t2 = S.vbTrade(day(p), { ...S.TESTS.T2, prevRange: 2, cost: 0 }); assert.equal(t2.up, 101.4); assert.equal(t2.entry, 101.4); assert.ok(near(t2.r, 1.4));
  const q = { [hm(9, 0)]: [100, 100.1, 98.5, 98.6] };
  assert.equal(S.vbTrade(day(q), T1).side, -1);
  assert.equal(S.vbTrade(day(q), { ...S.TESTS.T3, prevRange: 2, cost: 0 }).skip, 'nofill', 'T3 places no sell order');
});

test('no look-ahead: candles after the exit do not change a trade; D1 range and trend read earlier days only', () => {
  const p = { [hm(9, 0)]: [100, 101.5, 99.9, 101.4] };
  assert.deepEqual(S.vbTrade(day(p), T1), S.vbTrade(day(p).slice(), T1));
  // build rows: 25 weekdays + a weekend, and check prevRange / trendUp / the 21:00 cut
  const rows = []; const start = Date.parse('2024-01-01T00:00:00Z') / 1000;   // a Monday
  for (let d = 0; d < 40; d++) {
    const d0 = start + d * 86400, wd = new Date(d0 * 1000).getUTCDay();
    const px = 100 + d, hi = px + 1;
    if (wd === 6) continue;
    const from = wd === 0 ? 22 * 60 : 0;
    for (let m = from; m < 24 * 60; m += 5) rows.push([d0 + m * 60, px, wd === 0 ? px + 5 : m === 600 ? hi : px + 0.5, px - 1, px]);
  }
  const days = S.buildDays(rows), by = new Map(days.map((x) => [x.day, x]));
  assert.equal(by.get('2024-01-01').prevRange, null); assert.equal(S.daySkip(by.get('2024-01-01')), 'noprev');
  assert.equal(by.get('2024-01-02').prevRange, 2);
  assert.equal(by.get('2024-01-08').prevRange, 2, 'Monday reads Friday, not the folded Sunday stub');
  assert.equal(by.get('2024-01-09').prevRange, 6, 'Tuesday reads Monday with the Sunday stub folded in (Sunday high 111, Sunday low 105)');
  assert.ok(by.get('2024-01-09').bars.every((b) => b.t - by.get('2024-01-09').d0 < 21 * 3600), 'only 00:00-20:55 candles');
  assert.equal(by.get('2024-01-09').bars.length, 252);
  const late = days.filter((x) => x.trendUp != null); assert.ok(late.length > 0); assert.ok(late.every((x) => x.trendUp === true), 'rising closes: above the mean');
  // changing a day's own candles changes neither its prevRange nor its trend flag
  const k = '2024-02-05', d0 = Date.parse(k + 'T00:00:00Z') / 1000;
  const days2 = S.buildDays(rows.map((r) => (r[0] >= d0 && r[0] < d0 + 86400 ? [r[0], 1, 999, 0.5, 1] : r)));
  const a = by.get(k), b = days2.find((x) => x.day === k);
  assert.equal(a.prevRange, b.prevRange); assert.equal(a.trendUp, b.trendUp);
});

test('placebo trade and statistics', () => {
  const x = S.placeboTrade(day(), { startT: D0 + hm(5, 2) * 60, side: 1, dist: 1, cost: 0 });
  assert.equal(x.entry, 100); assert.equal(x.stop, 99); assert.equal(x.how, 'time'); assert.equal(x.R, 0);
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
  const pl = Object.fromEntries(Object.entries(R.placebo).map(([k, v]) => [k, v.means]));
  for (const k of ['T1', 'T2', 'T3']) assert.equal(pl[k].length, 40);
  assert.deepEqual(S.decide(R.tests, pl), R.decision);
  const v = studyVerdict(R, read('RESULT.md')); assert.equal(v.verdict, R.decision.T1.pass ? 'pass' : 'fail');
  assert.ok(v.headline.length <= 221);
  for (const k of ['T1', 'T2', 'T3']) for (const w of ['IS', 'OOS']) assert.ok(R.tests[k][w].n >= 30, `${k} ${w}`);
});

test('stand-alone: only council/fills.mjs is imported; stated as never part of the gold book', () => {
  const src = read('run.mjs');
  const imps = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]).filter((p) => p.startsWith('.'));
  assert.deepEqual(imps, ['../../../council/fills.mjs']);
  assert.equal(S.WINDOWS.IS[0], '2016-01-01'); assert.equal(S.WINDOWS.OOS[0], '2021-01-01');
  assert.match(read('PREREGISTRATION.md'), /never a gate, exit, entry or size of the live gold book/);
});
