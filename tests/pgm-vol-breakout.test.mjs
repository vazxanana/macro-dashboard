// node --test tests/pgm-vol-breakout.test.mjs — research/edge/pgm-vol-breakout (14 Nov 2026): gold-vol-breakout's T1 rule
// (open ± 0.5 × the previous day's range) on platinum and palladium: original.mjs is the verbatim copy (sha256), hand-made
// candles (fills, stops, the cost as a share of the day's open at 0.5x / 1x / 2x), the folded D1 with no look-ahead, the first
// full month, the placebo, Holm over the two markets, the comparison with XAU/USD, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as S from '../research/edge/pgm-vol-breakout/run.mjs';
import * as O from '../research/edge/pgm-vol-breakout/original.mjs';
import { studyVerdict } from '../research/edge/verdict.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), DIR = path.join(HERE, '..', 'research', 'edge', 'pgm-vol-breakout');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const D0 = Date.parse('2024-03-06T00:00:00Z') / 1000;          // a Wednesday
const hm = (h, m) => h * 60 + m;
const near = (a, b) => Math.abs(a - b) < 1e-9;
// platinum-like candles: flat at 1000 (high 1001, low 999); prevRange 20 → levels 1010 / 990, 1R = 10
const day = (patch = {}) => { const out = []; for (let m = 0; m < 21 * 60; m += 5) { const p = patch[m] || [1000, 1001, 999, 1000]; out.push({ t: D0 + m * 60, o: p[0], h: p[1], l: p[2], c: p[3] }); } return out; };
const dayObj = (bars) => ({ day: '2024-03-06', d0: D0, bars, prevRange: 20 });

test('original.mjs is the verbatim copy of the gold-vol-breakout run.mjs; run.mjs imports only it; the market set and costs', () => {
  assert.equal(crypto.createHash('sha256').update(read('original.mjs')).digest('hex'), S.ORIG_SHA);
  assert.equal(S.ORIG_SHA, 'afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f');
  const imps = [...read('run.mjs').matchAll(/from '([^']+)'/g)].map((m) => m[1]).filter((p) => p.startsWith('.'));
  assert.deepEqual(imps, ['./original.mjs']);
  assert.equal(S.T1, O.TESTS.T1); assert.equal(S.T1.k, 0.5); assert.equal(S.T1.sides, 'both');
  assert.deepEqual(Object.keys(S.MARKETS), ['xpt', 'xpd']);
  assert.equal(S.MARKETS.xpt.costPct, 0.003); assert.equal(S.MARKETS.xpd.costPct, 0.008);
  assert.match(read('PREREGISTRATION.md'), /Platinum 0\.30 % of price a round trip; palladium 0\.80 % of price/);
});

test('T1: buy stop open + 0.5 × range, stop at the open, out at 20:55; cost = pct × the day\'s open at 0.5x / 1x / 2x', () => {
  const p = { [hm(9, 0)]: [1000, 1015, 1000.5, 1014] };
  for (let m = hm(9, 5); m < 21 * 60; m += 5) p[m] = [1014, 1015, 1012, 1014];
  p[hm(20, 55)] = [1014, 1020, 1013, 1018];
  const bars = day(p), d = dayObj(bars), cost = S.costFn(0.003);
  assert.ok(near(cost(d), 3), '0.003 × 1000');
  const { tr } = S.tradesIn([d], ['2024-01-01', '2024-12-31'], cost), x = tr[0];
  assert.equal(x.side, 1); assert.ok(near(x.entry, 1010)); assert.equal(x.stop, 1000); assert.ok(near(x.r, 10));
  assert.equal(x.how, 'time'); assert.equal(x.exit, 1018); assert.ok(near(x.R, 0.8));
  assert.ok(near(x.net, 0.8 - 0.3)); assert.ok(near(x.net2, 0.8 - 0.6)); assert.equal(x.finR, 0);
  assert.ok(near(S.netAt(x, 0.5), 0.65)); assert.ok(near(S.netAt(x, 1), x.net)); assert.ok(near(S.netAt(x, 2), x.net2));
  const y = O.vbTrade(bars, { ...S.T1, prevRange: 20, cost: 3 }); assert.equal(y.net, x.net);
  // a sell; a stop inside the fill candle; no fill
  const q = { [hm(9, 0)]: [999, 999.5, 985, 986] }; for (let m = hm(9, 5); m < 21 * 60; m += 5) q[m] = [986, 987, 985, 986];
  const s = O.vbTrade(day(q), { ...S.T1, prevRange: 20, cost: 0 }); assert.equal(s.side, -1); assert.ok(near(s.R, 0.4));
  const a = O.vbTrade(day({ [hm(9, 0)]: [1001, 1015, 999, 1012] }), { ...S.T1, prevRange: 20, cost: 0 }); assert.equal(a.how, 'stop'); assert.ok(near(a.R, -1));
  assert.equal(O.vbTrade(day(), { ...S.T1, prevRange: 20 }).skip, 'nofill');
  // a thin day (under 200 candles) is skipped as the original
  const thin = { ...dayObj(bars.slice(0, 150)) }; assert.equal(O.daySkip(thin), 'thin');
});

test('no look-ahead: previous folded D1, later candles change nothing; first full month; windows', () => {
  const rows = [], start = Date.parse('2024-01-01T00:00:00Z') / 1000;   // a Monday
  for (let d = 0; d < 20; d++) {
    const d0 = start + d * 86400, wd = new Date(d0 * 1000).getUTCDay(), px = 1000 + d;
    if (wd === 6) continue;
    for (let m = wd === 0 ? 22 * 60 : 0; m < 24 * 60; m += 5) rows.push([d0 + m * 60, px, wd === 0 ? px + 25 : px + 2, px - 2, px]);
  }
  rows.push([start + 20 * 86400, 1, 1, 1, 1]);   // a forming day: dropped
  const { days, dataEnd } = S.daysOf(rows), by = new Map(days.map((x) => [x.day, x]));
  assert.equal(dataEnd, '2024-01-20');
  assert.ok(near(by.get('2024-01-08').prevRange, 4), 'Monday reads Friday');
  assert.ok(near(by.get('2024-01-09').prevRange, 27), 'Tuesday reads Monday with the Sunday stub folded in');
  const k = '2024-01-10', d0 = Date.parse(k + 'T00:00:00Z') / 1000, cost = S.costFn(0.008);
  const alt = S.daysOf(rows.map((r) => (r[0] > d0 && r[0] < d0 + 86400 ? [r[0], 1, 9999, 0.5, 1] : r))).days.find((x) => x.day === k);
  assert.equal(alt.prevRange, by.get(k).prevRange); assert.equal(cost(alt), cost(by.get(k)));
  const base = day({ [hm(9, 0)]: [1000, 1015, 1000.5, 1014] });
  const x = O.vbTrade(base.map((b) => (b.t === D0 + hm(9, 5) * 60 ? { ...b, l: 990 } : b)), { ...S.T1, prevRange: 20, cost: 0 });
  const y = O.vbTrade(base.map((b) => (b.t === D0 + hm(9, 5) * 60 ? { ...b, l: 990 } : b.t > D0 + hm(9, 5) * 60 ? { ...b, h: 9999 } : b)), { ...S.T1, prevRange: 20, cost: 0 });
  assert.equal(x.how, 'stop'); assert.deepEqual(x, y);
  assert.equal(S.firstFullMonth(Date.parse('2005-01-03T02:00:00Z') / 1000), '2005-02-01');
  assert.equal(S.firstFullMonth(Date.parse('2005-03-01T00:00:00Z') / 1000), '2005-03-01');
  assert.equal(S.firstFullMonth(Date.parse('2005-12-15T00:00:00Z') / 1000), '2006-01-01');
  assert.deepEqual(S.windowsOf('2005-02-01'), { ALL: ['2005-02-01', '2026-10-31'], IS: ['2005-02-01', '2016-12-31'], OOS: ['2017-01-01', '2026-10-31'] });
});

test('placebo is seeded and pays the day\'s cost; comparison; Holm over two markets and the pass bar', () => {
  const bars = day(), pool = [dayObj(bars), { ...dayObj(bars), day: '2024-03-07' }];
  const a = S.placeboIn(pool, S.costFn(0.003), S.T1, 3), b = S.placeboIn(pool, S.costFn(0.003), S.T1, 3);
  assert.deepEqual(a, b); assert.equal(a.length, 3); assert.ok(a.every((v) => v < 0), 'flat candles: the placebo pays its cost');
  const e = [{ day: '1', side: 1, R: 1, net: 0.9 }, { day: '2', side: -1, R: -1, net: -1.1 }, { day: '3', side: 1, R: 0.5, net: 0.4 }, { day: '9', side: 1, R: 0, net: 0 }];
  const u = [{ day: '1', side: 1, R: 2, net: 1.9 }, { day: '2', side: 1, R: -2, net: -2.1 }, { day: '3', side: 1, R: 1, net: 0.9 }, { day: '8', side: 1, R: 0, net: 0 }];
  const c = S.compare(e, u); assert.equal(c.days, 3); assert.equal(c.metalOnly, 1); assert.equal(c.usdOnly, 1);
  assert.equal(c.corrGross, 1); assert.equal(c.sameSide, 0.667);
  const pl = Array(40).fill(-0.1); pl[0] = 0.2;
  const mk = (t, patch = {}) => ({ ALL: { n: 300, netR: 0.1, t, net2R: 0.01 }, IS: { n: 100, netR: 0.1 }, OOS: { n: 200, netR: 0.1 }, pl, ...patch });
  assert.deepEqual(Object.values(S.decide({ xpt: mk(3), xpd: mk(3) })).map((d) => d.pass), [true, true]);
  // t 2.0 beside a market at t 0: Holm p 2 × 0.0228 = 0.046 < 0.05, passes
  const d1 = S.decide({ xpt: mk(2.0), xpd: mk(0) }); assert.equal(d1.xpt.pass, true); assert.ok(d1.xpt.pHolm > d1.xpt.p);
  const d2 = S.decide({ xpt: mk(1.99), xpd: mk(3) }); assert.equal(d2.xpt.pass, false); assert.deepEqual(S.failed(d2.xpt), ['t2']);
  assert.equal(S.decide({ xpt: mk(3, { OOS: { n: 200, netR: -0.01 } }) }).xpt.pass, false);
  assert.equal(S.decide({ xpt: mk(3, { ALL: { n: 300, netR: 0.1, t: 3, net2R: -0.01 } }) }).xpt.pass, false);
  assert.equal(S.decide({ xpt: mk(3, { IS: { n: 29, netR: 0.1 } }) }).xpt.pass, false);
  const pl2 = [...pl]; pl2[1] = pl2[2] = 0.3; const d3 = S.decide({ xpt: mk(3, { pl: pl2 }) }); assert.equal(d3.xpt.placeboBeaten, 37); assert.equal(d3.xpt.pass, false);
});

test('the report is run.mjs\'s function of result.json; pre-registration hash; the verdict line', () => {
  const R = JSON.parse(read('result.json'));
  assert.equal(read('RESULT.md'), S.report(R));
  assert.equal(R.planSha256, crypto.createHash('sha256').update(read('PREREGISTRATION.md')).digest('hex'));
  assert.equal(R.originalSha256, S.ORIG_SHA);
  assert.equal(R.verdict, S.verdictLine(R));
  const per = Object.fromEntries(Object.keys(R.markets).map((k) => [k, { ALL: R.markets[k].ALL, IS: R.markets[k].IS, OOS: R.markets[k].OOS, pl: R.placebo[k].means }]));
  assert.deepEqual(S.decide(per), R.decision);
  assert.ok(R.verdict.length < 220);
  for (const k of ['xpt', 'xpd']) {
    const m = R.markets[k];
    assert.equal(R.placebo[k].means.length, 40); assert.equal(m.costPct, S.MARKETS[k].costPct);
    assert.equal(m.ALL.n, m.IS.n + m.OOS.n); assert.equal(m.windows.ALL[1], '2026-10-31');
    assert.equal(m.mults.find((x) => x.mult === 1).netR, m.ALL.netR);
    assert.ok(R.comparison[k].days > 0);
  }
  const v = studyVerdict(R, read('RESULT.md')); assert.equal(v.verdict, Object.values(R.decision).every((d) => d.pass) ? 'pass' : 'fail');
  assert.ok(v.headline.length <= 221);
  assert.ok(R.reference.ALL.n > 0);
  assert.match(read('PREREGISTRATION.md'), /never a gate, exit, entry or size of the live gold book/i);
});
