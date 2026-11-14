// node --test tests/silver-vol-breakout.test.mjs — research/edge/silver-vol-breakout (14 Nov 2026): gold-vol-breakout's T1 rule
// (open ± 0.5 × the previous day's range) on silver: hand-made candles (fills, stops, gaps, both levels in one candle, the
// silver cost), the folded D1 with no look-ahead, the placebo, the pass bar, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as S from '../research/edge/silver-vol-breakout/run.mjs';
import { studyVerdict } from '../research/edge/verdict.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), DIR = path.join(HERE, '..', 'research', 'edge', 'silver-vol-breakout');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const D0 = Date.parse('2024-03-06T00:00:00Z') / 1000;          // a Wednesday
const hm = (h, m) => h * 60 + m;
// silver-like candles: flat at 25 (high 25.02, low 24.98); prevRange 0.4 → levels 25.2 / 24.8, 1R = 0.2
const day = (patch = {}) => { const out = []; for (let m = 0; m < 21 * 60; m += 5) { const p = patch[m] || [25, 25.02, 24.98, 25]; out.push({ t: D0 + m * 60, o: p[0], h: p[1], l: p[2], c: p[3] }); } return out; };
const T1 = { ...S.T1, prevRange: 0.4, cost: 0 };
const near = (a, b) => Math.abs(a - b) < 1e-9;

test('T1 on silver: buy stop at open + 0.5 × range, stop back at the open, out at the 20:55 close; $0.03 cost in R', () => {
  const p = { [hm(9, 0)]: [25, 25.3, 25.01, 25.28] };
  for (let m = hm(9, 5); m < 21 * 60; m += 5) p[m] = [25.28, 25.3, 25.25, 25.28];
  p[hm(20, 55)] = [25.28, 25.4, 25.27, 25.36];
  const x = S.vbTrade(day(p), T1);
  assert.equal(x.side, 1); assert.ok(near(x.up, 25.2)); assert.ok(near(x.dn, 24.8)); assert.ok(near(x.entry, 25.2)); assert.equal(x.stop, 25);
  assert.ok(near(x.r, 0.2)); assert.equal(x.how, 'time'); assert.equal(x.exit, 25.36); assert.ok(near(x.R, 0.8));
  assert.equal(x.nights, 0, 'no trade crosses the 22:00 rollover'); assert.equal(x.finR, 0);
  assert.equal(S.COST, 0.03);
  const c = S.vbTrade(day(p), { ...S.T1, prevRange: 0.4 }); assert.ok(near(c.net, 0.8 - 0.15)); assert.ok(near(c.net2, 0.8 - 0.3));
  const q = { [hm(9, 0)]: [25, 24.99, 24.7, 24.72] }; for (let m = hm(9, 5); m < 21 * 60; m += 5) q[m] = [24.72, 24.75, 24.68, 24.7];
  const s = S.vbTrade(day(q), T1); assert.equal(s.side, -1); assert.ok(near(s.entry, 24.8)); assert.equal(s.stop, 25); assert.ok(near(s.R, 0.5));
});

test('stop mechanics: inside the fill candle, a later touch, a gap, a gapped fill, both levels, no fill', () => {
  const flat = {}; for (let m = hm(9, 5); m < 21 * 60; m += 5) flat[m] = [25.24, 25.26, 25.22, 25.24];
  const a = S.vbTrade(day({ ...flat, [hm(9, 0)]: [25.01, 25.3, 24.99, 25.24] }), T1);
  assert.equal(a.how, 'stop'); assert.equal(a.exit, 25); assert.ok(near(a.R, -1));
  const b = S.vbTrade(day({ ...flat, [hm(9, 0)]: [25.01, 25.3, 25.01, 25.24], [hm(10, 0)]: [25.24, 25.25, 24.9, 24.95] }), T1);
  assert.equal(b.how, 'stop'); assert.equal(b.exit, 25); assert.ok(near(b.R, -1));
  const g = S.vbTrade(day({ ...flat, [hm(9, 0)]: [25.01, 25.3, 25.01, 25.24], [hm(10, 0)]: [24.9, 24.95, 24.85, 24.9] }), T1);
  assert.equal(g.exit, 24.9, 'gap through the stop fills at the open'); assert.ok(near(g.R, -1.5));
  const o = S.vbTrade(day({ ...flat, [hm(9, 0)]: [25.28, 25.3, 25.26, 25.28] }), T1); assert.equal(o.entry, 25.28); assert.ok(near(o.r, 0.28));
  const both = S.vbTrade(day({ ...flat, [hm(9, 0)]: [25.15, 25.3, 24.7, 24.75] }), T1); assert.equal(both.side, 1); assert.equal(both.how, 'stop');
  const both2 = S.vbTrade(day({ ...flat, [hm(9, 0)]: [24.85, 25.3, 24.7, 24.75] }), T1); assert.equal(both2.side, -1);
  assert.equal(S.vbTrade(day({}), T1).skip, 'nofill');
});

test('no look-ahead: a day\'s range is the previous folded D1; its own candles do not change it; only 00:00-20:55 candles', () => {
  const rows = []; const start = Date.parse('2024-01-01T00:00:00Z') / 1000;   // a Monday
  for (let d = 0; d < 20; d++) {
    const d0 = start + d * 86400, wd = new Date(d0 * 1000).getUTCDay(), px = 20 + d / 10;
    if (wd === 6) continue;
    const from = wd === 0 ? 22 * 60 : 0;
    for (let m = from; m < 24 * 60; m += 5) rows.push([d0 + m * 60, px, wd === 0 ? px + 0.5 : px + 0.05, px - 0.05, px]);
  }
  const days = S.buildDays(rows), by = new Map(days.map((x) => [x.day, x]));
  assert.equal(S.daySkip(by.get('2024-01-01')), 'noprev');
  assert.ok(near(by.get('2024-01-02').prevRange, 0.1));
  assert.ok(near(by.get('2024-01-08').prevRange, 0.1), 'Monday reads Friday');
  assert.ok(near(by.get('2024-01-09').prevRange, 0.55), 'Tuesday reads Monday with the Sunday stub folded in');
  assert.ok(by.get('2024-01-09').bars.every((b) => b.t - by.get('2024-01-09').d0 < 21 * 3600));
  const k = '2024-01-10', d0 = Date.parse(k + 'T00:00:00Z') / 1000;
  const days2 = S.buildDays(rows.map((r) => (r[0] >= d0 && r[0] < d0 + 86400 ? [r[0], 1, 999, 0.5, 1] : r)));
  assert.equal(days2.find((x) => x.day === k).prevRange, by.get(k).prevRange);
  // a trade does not change when candles after its exit change
  const p = { [hm(9, 0)]: [25, 25.3, 25.01, 25.28] };
  const base = day(p), alt = base.map((b, i) => (b.t >= D0 + hm(9, 5) * 60 && b.t < D0 + hm(9, 10) * 60 ? { ...b, l: 24.5 } : b));
  const x = S.vbTrade(alt, T1); assert.equal(x.how, 'stop');
  const y = S.vbTrade(alt.map((b) => (b.t > D0 + hm(9, 5) * 60 ? { ...b, h: 99 } : b)), T1); assert.deepEqual(x, y);
});

test('placebo trade, statistics and the pass bar', () => {
  const x = S.placeboTrade(day(), { startT: D0 + hm(5, 2) * 60, side: 1, dist: 0.2, cost: 0 });
  assert.equal(x.entry, 25); assert.equal(x.stop, 24.8); assert.equal(x.how, 'time'); assert.equal(x.R, 0);
  const tr = [{ day: '2021-01-04', net: 1 }, { day: '2021-01-05', net: 1 }, { day: '2021-02-01', net: 3 }, { day: '2021-03-01', net: 2 }];
  const m = S.monthT(tr); assert.equal(m.months, 3); assert.ok(Math.abs(m.t - 7) < 1e-9);
  assert.equal(S.rng(7)(), S.rng(7)());
  const ok = { IS: { netR: 0.1, n: 100 }, OOS: { netR: 0.1, n: 100 }, ALL: { netR: 0.1, t: 2.1, net2R: 0.01, n: 200 } };
  const pl = Array(40).fill(-0.1); pl[0] = 0.2;
  assert.equal(S.decide(ok, pl).pass, true);
  assert.equal(S.decide({ ...ok, IS: { netR: -0.01, n: 100 } }, pl).pass, false);
  assert.equal(S.decide({ ...ok, ALL: { ...ok.ALL, t: 1.99 } }, pl).pass, false);
  assert.equal(S.decide({ ...ok, ALL: { ...ok.ALL, net2R: -0.01 } }, pl).pass, false);
  pl[1] = pl[2] = 0.3; assert.equal(S.decide(ok, pl).placeboBeaten, 37); assert.equal(S.decide(ok, pl).pass, false);
});

test('the report is run.mjs\'s function of result.json, pre-registration hash and the verdict line', () => {
  const R = JSON.parse(read('result.json'));
  assert.equal(read('RESULT.md'), S.report(R));
  assert.equal(R.planSha256, crypto.createHash('sha256').update(read('PREREGISTRATION.md')).digest('hex'));
  assert.equal(R.verdict, S.verdictLine(R.tests, R.decision));
  assert.ok(R.verdict.length < 220);
  assert.equal(R.placebo.means.length, 40);
  assert.deepEqual(S.decide(R.tests, R.placebo.means), R.decision);
  assert.equal(R.cost, 0.03);
  const v = studyVerdict(R, read('RESULT.md')); assert.equal(v.verdict, R.decision.pass ? 'pass' : 'fail');
  assert.ok(v.headline.length <= 221);
  for (const w of ['IS', 'OOS']) assert.ok(R.tests[w].n >= 30, w);
  assert.equal(R.tests.ALL.n, R.tests.IS.n + R.tests.OOS.n);
});

test('stand-alone: only council/fills.mjs is imported; the rule is gold-vol-breakout T1; never part of a live book', () => {
  const src = read('run.mjs');
  const imps = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]).filter((p) => p.startsWith('.'));
  assert.deepEqual(imps, ['../../../council/fills.mjs']);
  assert.equal(S.T1.k, 0.5); assert.equal(S.T1.sides, 'both');
  assert.equal(S.WINDOWS.IS[0], '2016-01-01'); assert.equal(S.WINDOWS.OOS[0], '2021-01-01');
  assert.match(read('PREREGISTRATION.md'), /never a gate, exit, entry or size of the live gold book/);
});
