// node --test tests/index-vol-breakout.test.mjs — research/edge/index-vol-breakout (14 Nov 2026): gold-vol-breakout's T1 rule
// (open ± 0.5 × the previous day's range) on NAS100 and SPX500: the copied rule file, hand-made index candles (fills, stops,
// the point cost and index financing in R), the folded D1 around the daily halt with no look-ahead, the placebo, the pass bar,
// and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as S from '../research/edge/index-vol-breakout/run.mjs';
import * as O from '../research/edge/index-vol-breakout/original.mjs';
import { studyVerdict } from '../research/edge/verdict.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), DIR = path.join(HERE, '..', 'research', 'edge', 'index-vol-breakout');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const D0 = Date.parse('2024-03-06T00:00:00Z') / 1000;          // a Wednesday
const hm = (h, m) => h * 60 + m;
const near = (a, b) => Math.abs(a - b) < 1e-9;
// NAS100-like candles: flat at 18000 (high 18002, low 17998); prevRange 200 → levels 18100 / 17900, 1R = 100 points
const day = (patch = {}) => { const out = []; for (let m = 0; m < 21 * 60; m += 5) { const p = patch[m] || [18000, 18002, 17998, 18000]; out.push({ t: D0 + m * 60, o: p[0], h: p[1], l: p[2], c: p[3] }); } return out; };
const opt = { k: 0.5, sides: 'both', prevRange: 200, cost: 0 };

test('original.mjs is the byte-for-byte copy of gold-vol-breakout run.mjs; costs as pre-registered', () => {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, 'original.mjs'))).digest('hex');
  assert.equal(sha, S.ORIGINAL_SHA);
  assert.equal(S.MARKETS.nas100.cost, 3); assert.equal(S.MARKETS.spx500.cost, 1);
  assert.deepEqual({ k: S.T1.k, sides: S.T1.sides }, { k: 0.5, sides: 'both' });
  assert.ok(near(S.finRate(1), 0.075 / 365)); assert.equal(S.finRate(-1), 0);
});

test('T1 on an index: buy stop at open + 0.5 × range, stop at the open, out at 20:55; 3 points in R; financing by nights', () => {
  const p = { [hm(9, 0)]: [18000, 18150, 18001, 18140] };
  for (let m = hm(9, 5); m < 21 * 60; m += 5) p[m] = [18140, 18150, 18130, 18140];
  p[hm(20, 55)] = [18140, 18200, 18135, 18180];
  const raw = O.vbTrade(day(p), opt), x = S.recost(raw, 3);
  assert.equal(x.side, 1); assert.equal(x.entry, 18100); assert.equal(x.stop, 18000); assert.equal(x.r, 100);
  assert.equal(x.how, 'time'); assert.equal(x.exit, 18180); assert.ok(near(x.R, 0.8));
  assert.equal(x.nights, 0); assert.equal(x.finR, 0);
  assert.ok(near(x.net, 0.8 - 0.03)); assert.ok(near(x.net2, 0.8 - 0.06));
  // a hold over one rollover pays the index long rate (a counting check: the 21:00 exit never does this)
  const y = S.recost({ ...raw, nights: 1 }, 3); assert.ok(near(y.finR, 0.075 / 365 * 18100 / 100));
  assert.ok(near(y.net2, 0.8 - 0.06 - 2 * y.finR));
  const q = { [hm(9, 0)]: [18000, 17999, 17850, 17860] }; for (let m = hm(9, 5); m < 21 * 60; m += 5) q[m] = [17860, 17870, 17840, 17850];
  const s = S.recost(O.vbTrade(day(q), opt), 1); assert.equal(s.side, -1); assert.equal(s.entry, 17900); assert.ok(near(s.R, 0.5));
  assert.equal(s.finR, 0); assert.ok(near(s.net, 0.5 - 0.01));
});

test('stop mechanics on index candles: inside the fill candle, a gap through the stop, no fill', () => {
  const flat = {}; for (let m = hm(9, 5); m < 21 * 60; m += 5) flat[m] = [18120, 18125, 18115, 18120];
  const a = O.vbTrade(day({ ...flat, [hm(9, 0)]: [18001, 18150, 17999, 18120] }), opt);
  assert.equal(a.how, 'stop'); assert.ok(near(a.R, -1));
  const g = O.vbTrade(day({ ...flat, [hm(9, 0)]: [18001, 18150, 18001, 18120], [hm(10, 0)]: [17950, 17960, 17940, 17950] }), opt);
  assert.equal(g.exit, 17950); assert.ok(near(g.R, -1.5));
  assert.equal(O.vbTrade(day({}), opt).skip, 'nofill');
});

test('the daily halt and the weekend: 00:00 is the open, D1 is the UTC day, Sunday stub folded, no look-ahead', () => {
  // index-like session: 23:00-21:00 UTC (halt 21:00-23:00), weekend from Friday 21:00 to Sunday 23:00
  const rows = [], start = Date.parse('2024-01-01T00:00:00Z') / 1000;   // a Monday
  for (let d = 0; d < 20; d++) {
    const d0 = start + d * 86400, wd = new Date(d0 * 1000).getUTCDay(), px = 18000 + d;
    if (wd === 6) continue;
    for (let m = 0; m < 24 * 60; m += 5) {
      const h = m / 60; if (h >= 21 && h < 23) continue; if (wd === 5 && h >= 21) continue; if (wd === 0 && h < 23) continue;
      rows.push([d0 + m * 60, px, wd === 0 ? px + 50 : px + 5, px - 5, px]);
    }
  }
  const days = O.buildDays(rows), by = new Map(days.map((x) => [x.day, x]));
  assert.ok(days.every((d) => ![0, 6].includes(new Date(d.d0 * 1000).getUTCDay())), 'weekdays only');
  const tue = by.get('2024-01-09'), mon = by.get('2024-01-08');
  assert.equal(tue.bars[0].t, tue.d0, 'the 00:00 candle exists inside the session');
  assert.ok(tue.bars.every((b) => b.t - tue.d0 < 21 * 3600)); assert.equal(tue.bars.length, 252);
  assert.equal(S.tradeDays([tue], '2026-12-31').out.length, 1);
  assert.ok(near(mon.prevRange, 10), 'Monday reads Friday');
  assert.ok(near(tue.prevRange, 18056 - 18001), 'Tuesday reads Monday with the Sunday stub folded in');
  const k = '2024-01-10', d0 = Date.parse(k + 'T00:00:00Z') / 1000;
  const days2 = O.buildDays(rows.map((r) => (r[0] >= d0 && r[0] < d0 + 86400 ? [r[0], 1, 99999, 0.5, 1] : r)));
  assert.equal(days2.find((x) => x.day === k).prevRange, by.get(k).prevRange, 'a day\'s own candles never move its range');
  // an early close leaves fewer candles: under 200 is skipped, over 200 trades and exits at the last candle on file
  assert.equal(O.daySkip({ ...tue, bars: tue.bars.slice(0, 150) }), 'thin');
  assert.equal(O.daySkip({ ...tue, bars: tue.bars.slice(0, 216) }), null);
  // a trade does not change when candles after its exit change
  const p = { [hm(9, 0)]: [18000, 18150, 18001, 18140], [hm(9, 5)]: [18140, 18141, 17990, 17995] };
  const x = O.vbTrade(day(p), opt); assert.equal(x.how, 'stop');
  const y = O.vbTrade(day(p).map((b) => (b.t > D0 + hm(9, 5) * 60 ? { ...b, h: 99999 } : b)), opt); assert.deepEqual(x, y);
});

test('placebo and the pass bar', () => {
  const x = S.recost(O.placeboTrade(day(), { startT: D0 + hm(5, 2) * 60, side: 1, dist: 100, cost: 0 }), 3);
  assert.equal(x.entry, 18000); assert.equal(x.stop, 17900); assert.equal(x.how, 'time'); assert.ok(near(x.net, -0.03));
  const ok = { IS: { netR: 0.1, n: 100 }, OOS: { netR: 0.1, n: 100 }, ALL: { netR: 0.1, t: 3.5, net2R: 0.01, n: 200 } };
  const pl = Array.from({ length: 40 }, (_, i) => (i < 39 ? 0 : 0.2));
  const d = S.decide({ nas100: ok, spx500: ok }, { nas100: pl, spx500: pl });
  assert.equal(d.nas100.pass, true); assert.equal(S.outcome(d), 'generalises');
  const d2 = S.decide({ nas100: ok, spx500: { ...ok, IS: { netR: -0.01, n: 100 } } }, { nas100: pl, spx500: pl });
  assert.equal(S.outcome(d2), 'partial'); assert.equal(d2.spx500.checks.isPos, false);
  const d3 = S.decide({ nas100: ok, spx500: ok }, { nas100: Array(40).fill(0.2), spx500: pl });
  assert.equal(d3.nas100.checks.placebo, false); assert.equal(d3.nas100.pass, false);
  const weak = { ...ok, ALL: { ...ok.ALL, t: 1.9 } };
  assert.equal(S.decide({ nas100: weak, spx500: ok }, { nas100: pl, spx500: pl }).nas100.checks.t2, false);
});

test('result.json and RESULT.md agree; the pre-registration hash; the verdict line', () => {
  const R = JSON.parse(read('result.json')), md = read('RESULT.md');
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, 'PREREGISTRATION.md'))).digest('hex');
  assert.equal(R.planSha256, sha); assert.equal(R.original.sha256, S.ORIGINAL_SHA);
  assert.equal(md, S.report(R));
  assert.equal(R.verdict, S.verdictLine(R.markets, R.decision)); assert.equal(R.outcome, S.outcome(R.decision));
  assert.ok(md.includes(`**Verdict: ${R.verdict}**`)); assert.ok(R.verdict.length < 220);
  for (const k of ['nas100', 'spx500']) {
    const m = R.markets[k], dec = R.decision[k];
    assert.equal(dec.placeboBeaten, R.placebo[k].means.filter((v) => m.ALL.netR > v).length);
    assert.equal(m.ALL.n, m.IS.n + m.OOS.n); assert.equal(m.ALL.finR, 0, 'no trade crosses the rollover');
    assert.equal(dec.pass, Object.values(dec.checks).every(Boolean));
  }
  assert.equal(R.markets.pooled.ALL.n, R.markets.nas100.ALL.n + R.markets.spx500.ALL.n);
  const v = studyVerdict(R, md); assert.ok(v && v.verdict === (R.outcome === 'generalises' ? 'pass' : 'fail'), JSON.stringify(v));
  assert.ok(!/ict\//.test(read('run.mjs').replace(/^\/\/.*$/gm, '')), 'nothing of the ICT edge is read');
});
