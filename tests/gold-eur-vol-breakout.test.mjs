// node --test tests/gold-eur-vol-breakout.test.mjs — research/edge/gold-eur-vol-breakout (14 Nov 2026): gold-vol-breakout's T1
// rule (open ± 0.5 × the previous day's range) on XAU/EUR: original.mjs is the verbatim copy (sha256), hand-made candles (fills,
// stops, gaps, the cost as a share of the day's open), the folded D1 with no look-ahead, the placebo, the comparison with
// XAU/USD, the pass bar, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as S from '../research/edge/gold-eur-vol-breakout/run.mjs';
import * as O from '../research/edge/gold-eur-vol-breakout/original.mjs';
import { studyVerdict } from '../research/edge/verdict.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), DIR = path.join(HERE, '..', 'research', 'edge', 'gold-eur-vol-breakout');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const D0 = Date.parse('2024-03-06T00:00:00Z') / 1000;          // a Wednesday
const hm = (h, m) => h * 60 + m;
const near = (a, b) => Math.abs(a - b) < 1e-9;
// euro-gold-like candles: flat at 2000 (high 2001, low 1999); prevRange 20 → levels 2010 / 1990, 1R = 10
const day = (patch = {}) => { const out = []; for (let m = 0; m < 21 * 60; m += 5) { const p = patch[m] || [2000, 2001, 1999, 2000]; out.push({ t: D0 + m * 60, o: p[0], h: p[1], l: p[2], c: p[3] }); } return out; };
const dayObj = (bars) => ({ day: '2024-03-06', d0: D0, bars, prevRange: 20 });

test('original.mjs is the verbatim copy of the gold-vol-breakout run.mjs; run.mjs imports only it', () => {
  assert.equal(crypto.createHash('sha256').update(read('original.mjs')).digest('hex'), S.ORIG_SHA);
  assert.equal(S.ORIG_SHA, 'afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f');
  const imps = [...read('run.mjs').matchAll(/from '([^']+)'/g)].map((m) => m[1]).filter((p) => p.startsWith('.'));
  assert.deepEqual(imps, ['./original.mjs']);
  assert.equal(S.T1, O.TESTS.T1); assert.equal(S.T1.k, 0.5); assert.equal(S.T1.sides, 'both');
});

test('T1 on XAU/EUR: buy stop open + 0.5 × range, stop at the open, out at 20:55; cost = 0.016 % of the day\'s open', () => {
  const p = { [hm(9, 0)]: [2000, 2015, 2000.5, 2014] };
  for (let m = hm(9, 5); m < 21 * 60; m += 5) p[m] = [2014, 2015, 2012, 2014];
  p[hm(20, 55)] = [2014, 2020, 2013, 2018];
  const bars = day(p), d = dayObj(bars);
  assert.ok(near(S.costOf(d), 0.32), '0.00016 × 2000');
  const { tr } = S.tradesIn([d], ['2024-01-01', '2024-12-31']), x = tr[0];
  assert.equal(x.side, 1); assert.ok(near(x.entry, 2010)); assert.equal(x.stop, 2000); assert.ok(near(x.r, 10));
  assert.equal(x.how, 'time'); assert.equal(x.exit, 2018); assert.ok(near(x.R, 0.8));
  assert.ok(near(x.net, 0.8 - 0.032)); assert.ok(near(x.net2, 0.8 - 0.064)); assert.equal(x.finR, 0);
  // the same trade through the original function with a constant cost
  const y = O.vbTrade(bars, { ...S.T1, prevRange: 20, cost: 0.32 }); assert.equal(y.net, x.net);
  // a sell; a stop inside the fill candle; a gap through the stop; no fill
  const q = { [hm(9, 0)]: [1999, 1999.5, 1985, 1986] }; for (let m = hm(9, 5); m < 21 * 60; m += 5) q[m] = [1986, 1987, 1985, 1986];
  const s = O.vbTrade(day(q), { ...S.T1, prevRange: 20, cost: 0 }); assert.equal(s.side, -1); assert.ok(near(s.R, 0.4));
  const a = O.vbTrade(day({ [hm(9, 0)]: [2001, 2015, 1999, 2012] }), { ...S.T1, prevRange: 20, cost: 0 }); assert.equal(a.how, 'stop'); assert.ok(near(a.R, -1));
  const up = {}; for (let m = hm(9, 5); m < 21 * 60; m += 5) up[m] = [2012, 2013, 2011, 2012];
  const g = O.vbTrade(day({ ...up, [hm(9, 0)]: [2001, 2015, 2001, 2012], [hm(10, 0)]: [1995, 1996, 1994, 1995] }), { ...S.T1, prevRange: 20, cost: 0 });
  assert.equal(g.exit, 1995); assert.ok(near(g.R, -1.5));
  assert.equal(O.vbTrade(day(), { ...S.T1, prevRange: 20 }).skip, 'nofill');
});

test('no look-ahead: the range is the previous folded D1; later candles do not change a trade; the cost uses the open only', () => {
  const rows = [], start = Date.parse('2024-01-01T00:00:00Z') / 1000;   // a Monday
  for (let d = 0; d < 20; d++) {
    const d0 = start + d * 86400, wd = new Date(d0 * 1000).getUTCDay(), px = 2000 + d;
    if (wd === 6) continue;
    for (let m = wd === 0 ? 22 * 60 : 0; m < 24 * 60; m += 5) rows.push([d0 + m * 60, px, wd === 0 ? px + 25 : px + 2, px - 2, px]);
  }
  rows.push([start + 20 * 86400, 1, 1, 1, 1]);   // a forming day: dropped
  const { days, dataEnd } = S.daysOf(rows), by = new Map(days.map((x) => [x.day, x]));
  assert.equal(dataEnd, '2024-01-20');
  assert.equal(O.daySkip(by.get('2024-01-01')), 'noprev');
  assert.ok(near(by.get('2024-01-08').prevRange, 4), 'Monday reads Friday');
  assert.ok(near(by.get('2024-01-09').prevRange, 27), 'Tuesday reads Monday with the Sunday stub folded in');
  const k = '2024-01-10', d0 = Date.parse(k + 'T00:00:00Z') / 1000;
  const alt = S.daysOf(rows.map((r) => (r[0] > d0 && r[0] < d0 + 86400 ? [r[0], 1, 9999, 0.5, 1] : r))).days.find((x) => x.day === k);
  assert.equal(alt.prevRange, by.get(k).prevRange); assert.equal(S.costOf(alt), S.costOf(by.get(k)));
  const p = { [hm(9, 0)]: [2000, 2015, 2000.5, 2014] }, base = day(p);
  const x = O.vbTrade(base.map((b) => (b.t === D0 + hm(9, 5) * 60 ? { ...b, l: 1990 } : b)), { ...S.T1, prevRange: 20, cost: 0 });
  const y = O.vbTrade(base.map((b) => (b.t === D0 + hm(9, 5) * 60 ? { ...b, l: 1990 } : b.t > D0 + hm(9, 5) * 60 ? { ...b, h: 9999 } : b)), { ...S.T1, prevRange: 20, cost: 0 });
  assert.equal(x.how, 'stop'); assert.deepEqual(x, y);
});

test('placebo is seeded and uses the day\'s cost; comparison; the pass bar', () => {
  const bars = day(), pool = [dayObj(bars), { ...dayObj(bars), day: '2024-03-07' }];
  const a = S.placeboIn(pool, S.costOf, S.T1, 3), b = S.placeboIn(pool, S.costOf, S.T1, 3);
  assert.deepEqual(a, b); assert.equal(a.length, 3); assert.ok(a.every((v) => v < 0), 'flat candles: the placebo pays its cost');
  const e = [{ day: '1', side: 1, R: 1, net: 0.9 }, { day: '2', side: -1, R: -1, net: -1.1 }, { day: '3', side: 1, R: 0.5, net: 0.4 }, { day: '9', side: 1, R: 0, net: 0 }];
  const u = [{ day: '1', side: 1, R: 2, net: 1.9 }, { day: '2', side: 1, R: -2, net: -2.1 }, { day: '3', side: 1, R: 1, net: 0.9 }, { day: '8', side: 1, R: 0, net: 0 }];
  const c = S.compare(e, u); assert.equal(c.days, 3); assert.equal(c.eurOnly, 1); assert.equal(c.usdOnly, 1);
  assert.equal(c.corrGross, 1); assert.equal(c.sameSide, 0.667);
  const ok = { n: 200, netR: 0.1, t: 2.1, net2R: 0.01 }, h = { n: 100, netR: 0.1 };
  const pl = Array(40).fill(-0.1); pl[0] = 0.2;
  assert.equal(S.decide(ok, h, h, pl).pass, true);
  assert.equal(S.decide({ ...ok, t: 1.99 }, h, h, pl).pass, false);
  assert.equal(S.decide(ok, h, { n: 100, netR: -0.01 }, pl).pass, false);
  assert.equal(S.decide({ ...ok, net2R: -0.01 }, h, h, pl).pass, false);
  assert.equal(S.decide(ok, { n: 29, netR: 0.1 }, h, pl).pass, false);
  pl[1] = pl[2] = 0.3; assert.equal(S.decide(ok, h, h, pl).placeboBeaten, 37); assert.equal(S.decide(ok, h, h, pl).pass, false);
});

test('the report is run.mjs\'s function of result.json; pre-registration hash; the verdict line', () => {
  const R = JSON.parse(read('result.json'));
  assert.equal(read('RESULT.md'), S.report(R));
  assert.equal(R.planSha256, crypto.createHash('sha256').update(read('PREREGISTRATION.md')).digest('hex'));
  assert.equal(R.originalSha256, S.ORIG_SHA);
  assert.equal(R.verdict, S.verdictLine(R.tests.ALL, R.decision));
  assert.deepEqual(S.decide(R.tests.ALL, R.tests.H1, R.tests.H2, R.placebo.means), R.decision);
  assert.ok(R.verdict.length < 220); assert.equal(R.placebo.means.length, 40); assert.equal(R.costPct, 0.00016);
  assert.deepEqual(R.windows, S.WIN);
  assert.equal(R.tests.ALL.n, R.tests.H1.n + R.tests.H2.n);
  const v = studyVerdict(R, read('RESULT.md')); assert.equal(v.verdict, R.decision.pass ? 'pass' : 'fail');
  assert.ok(v.headline.length <= 221);
  assert.ok(R.comparison.days > 0 && R.reference.ALL.n > 0);
  assert.match(read('PREREGISTRATION.md'), /never a gate, exit, entry or size of the live gold book/i);
});
