// Brent - WTI spread study (research/edge/brent-wti-spread): the pre-registered constants, z from past closes only, entry at the
// next open, the stop on every trade, the exits, the one-leg gap drop, the costs, and the committed RESULT.md against
// result.json. Offline: no candle file is read.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, VARIANT, COST, WINDOWS, BAR, PLACEBO, zScores, tradeFrom, simulate, costOf, oneLegGap, spreadC, join, report, placebo }
  from '../research/edge/brent-wti-spread/run.mjs';
import { nights } from '../council/fills.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PRE = rd('../research/edge/brent-wti-spread/PREREGISTRATION.md');
const T0 = Date.UTC(2020, 0, 6) / 1000; // a Monday
const near = (a, b, eps = 1e-12) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

// joined days from a spread path: WTI flat at 50, Brent = 50 x exp(s); opens = the previous close unless given
function mkJ(s, o = {}) {
  const out = []; let t = T0;
  s.forEach((x, i) => {
    while ([0, 6].includes(new Date(t * 1000).getUTCDay())) t += 86400;
    const bc = 50 * Math.exp(x), wc = 50;
    out.push({ time: t, bc, wc, bo: o.bo?.[i] ?? (i ? 50 * Math.exp(s[i - 1]) : bc), wo: o.wo?.[i] ?? 50 });
    t += 86400;
  });
  return out;
}
const wiggle = (n) => Array.from({ length: n }, (_, i) => (i % 2 ? 0.01 : -0.01));

test('the pre-registered constants', () => {
  assert.deepEqual(P, { zN: 60, zIn: 2, zOut: 0.5, stopSd: 1.5, hold: 20, gapMax: 0.05 });
  assert.deepEqual(VARIANT, { id: 'V1', zIn: 1.5 });
  assert.deepEqual(COST, { sprPerLeg: 0.0006, finYear: 0.03, legs: 2 });
  assert.deepEqual(WINDOWS.dec, { from: '2016-01-01', to: null });
  assert.equal(WINDOWS.rep.to, '2016-01-01');
  assert.deepEqual(WINDOWS.glut, { from: '2011-01-01', to: '2014-01-01' });
  assert.deepEqual(BAR, { minT: 2, minN: 40, placeboPct: 0.95 });
  assert.equal(PLACEBO.draws, 40);
  for (const s of ['Committed on 14 Nov 2026, alone', 'the 60 closes', '`z_i > +2`', '1.5 x sd_i', '`|z_j| < 0.5`',
    '20th joined day', '0.06 % of price per leg', '3 % a year on EACH leg', 'over 5 %', '2011-01-01 to 2013-12-31',
    'n >= 40', "placebo's 95th percentile", 'V1: entry at |z| > 1.5', 'reported only, never judged', '`foldWeekend`'])
    assert.ok(PRE.includes(s), s);
});

test('join keeps only days both legs have', () => {
  const b = [{ time: 1, open: 10, close: 11 }, { time: 2, open: 11, close: 12 }];
  const w = [{ time: 2, open: 9, close: 8 }, { time: 3, open: 8, close: 7 }];
  assert.deepEqual(join(b, w), [{ time: 2, bo: 11, bc: 12, wo: 9, wc: 8 }]);
});

test('z at a close uses closes up to that close only (no look-ahead)', () => {
  const s = wiggle(120).map((x, i) => x + 0.001 * i), J = mkJ(s), Z = zScores(J);
  assert.equal(Z[58], null); assert.ok(Z[59]);
  const i = 90, xs = s.slice(i - 59, i + 1), m = xs.reduce((a, b) => a + b, 0) / 60;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / 59);
  near(Z[i].mean, m); near(Z[i].sd, sd); near(Z[i].z, (s[i] - m) / sd);
  // changing every close after i changes nothing at or before i
  const s2 = s.map((x, k) => (k > i ? x + 5 * Math.sin(k) : x)), Z2 = zScores(mkJ(s2));
  for (let k = 59; k <= i; k++) near(Z2[k].z, Z[k].z);
  near(spreadC(J, i), s[i]);
});

test('a stretch up is shorted at the next open and exits at the mean', () => {
  const s = wiggle(60); s.push(0.2, 0.2, 0.0, 0.0); // close 60 jumps (z > 2), then back
  const J = mkJ(s), Z = zScores(J);
  assert.ok(Z[60].z > 2);
  const T = simulate(J, Z);
  assert.equal(T.length, 1);
  const t = T[0];
  assert.equal(t.dir, -1); assert.equal(t.e, 61); near(t.entry, 0.2); // entry at the open of 61 (= close 60)
  near(t.risk, 1.5 * Z[60].sd); near(t.stop, 0.2 + t.risk);
  assert.equal(t.why, 'mean'); assert.equal(t.x, 62); near(t.R, (0.2 - 0.0) / t.risk);
  assert.equal(t.dropped, false);
});

test('the stop: a further 1.5 sd against the entry, checked on the close', () => {
  const s = wiggle(60); s.push(0.2, 0.2, 0.9);
  const J = mkJ(s), Z = zScores(J), t = tradeFrom(J, Z, 60, -1);
  assert.equal(t.why, 'stop'); assert.equal(t.x, 62);
  assert.ok(t.R < -1); near(t.R, -(0.9 - 0.2) / t.risk); // filled at the close beyond the level
  // every trade has a stop on the losing side
  assert.ok(t.stop > t.entry);
  const s2 = [...s.slice(0, 62), -0.6], J2 = mkJ(s2), tl = tradeFrom(J2, zScores(J2), 60, 1);
  assert.ok(tl.stop < tl.entry); assert.equal(tl.why, 'stop');
});

test('time exit at the close of the 20th day; one position at a time', () => {
  const s = wiggle(60); s.push(0.2); for (let k = 0; k < 30; k++) s.push(0.2 + 0.0001 * k); // stays stretched, no stop
  const J = mkJ(s), Z = zScores(J), t = tradeFrom(J, Z, 60, -1);
  // z falls as the window absorbs the level; time or mean, whichever first, never past day 20
  assert.ok(t.x - t.e + 1 <= 20);
  const T = simulate(J, Z);
  for (let k = 1; k < T.length; k++) assert.ok(T[k].sig > T[k - 1].x);
});

test('a one-leg gap over 5 % in the hold drops the trade', () => {
  const s = wiggle(60); s.push(0.2, 0.2, 0.0);
  const bo = []; bo[62] = 50 * Math.exp(0.2) * 1.08; // Brent opens 8 % above its previous close on day 62, WTI flat
  const J = mkJ(s, { bo }), Z = zScores(J);
  assert.equal(oneLegGap(J, 62), true); assert.equal(oneLegGap(J, 61), false);
  const t = tradeFrom(J, Z, 60, -1);
  assert.equal(t.dropped, true); assert.equal(t.gaps.length, 1);
  // both legs gapping is not a one-leg gap
  const wo = []; wo[62] = 50 * 1.07;
  assert.equal(oneLegGap(mkJ(s, { bo, wo }), 62), false);
});

test('costs: 0.06 % a leg round trip, 3 % a year a leg a night, scaled by the multiple', () => {
  const t = { opened: T0, closed: T0 + 3 * 86400, risk: 0.02 }; // Mon 00:00 to Thu 00:00
  const n = nights(t.opened, t.closed); assert.equal(n, 5); // Mon 1, Tue 1, Wed 3
  const c = costOf(t);
  near(c.spr, 0.0012 / 0.02); near(c.fin, n * 2 * 0.03 / 365 / 0.02); near(c.total, c.spr + c.fin);
  near(costOf(t, 2).total, 2 * c.total); assert.equal(costOf(t, 0).total, 0);
});

test('placebo draws are repeatable and keep the count', () => {
  const s = Array.from({ length: 400 }, (_, i) => 0.02 * Math.sin(i / 5) + 0.005 * Math.cos(i * 1.3));
  const J = mkJ(s), Z = zScores(J), real = [{ opened: J[200].time }, { opened: J[250].time }];
  const a = placebo(J, Z, real, J[100].time, J.at(-1).time + 86400, { draws: 3 });
  const b = placebo(J, Z, real, J[100].time, J.at(-1).time + 86400, { draws: 3 });
  assert.deepEqual(a, b); assert.equal(a.length, 3); assert.ok(a.every((x) => Number.isFinite(x)));
});

test('the committed report matches result.json', () => {
  const res = JSON.parse(rd('../research/edge/brent-wti-spread/result.json'));
  const md = rd('../research/edge/brent-wti-spread/RESULT.md');
  assert.equal(md, report(res));
  assert.ok(md.startsWith('# Result:'));
  assert.ok(md.split('\n')[2].startsWith(`**Verdict: ${res.verdict}.**`));
  assert.equal(res.pass, Object.values(res.checks).every(Boolean));
  assert.equal(res.pass, res.verdict.startsWith('PASS'));
  assert.equal(res.checks.nAtLeast40, res.base.dec.n >= 40);
  assert.equal(res.checks.aboveRandom, res.base.dec.avg > res.base.placebo.p95);
  assert.equal(res.base.placebo.draws, 40);
});
