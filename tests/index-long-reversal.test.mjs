// research/edge/index-long-reversal: ranking with the skip month and no look-ahead on a hand-made panel, the overlapping
// cohorts, the stop, the costs, and RESULT.md against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  P, COST, rankAt, legOf, cohortsOf, bookOf, monthEnds, monthOf, monthFrom, monthLabel, nwT, statsOf, nightRate, shuffle, mulberry32,
} from '../research/edge/index-long-reversal/run.mjs';
import { nights } from '../council/fills.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../research/edge/index-long-reversal');
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// one weekday candle a day from 2010-01-04 for `days` days; price(k) gives the close, open = previous close, range +-0.5 %
const T0 = Date.UTC(2010, 0, 4) / 1000;
function series(price, days = 1400) {
  const bars = []; let prev = price(0);
  for (let k = 0, t = T0; bars.length < days; t += 86400) {
    const wd = new Date(t * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    const c = price(bars.length), o = prev;
    bars.push({ time: t, open: o, high: Math.max(o, c) * 1.005, low: Math.min(o, c) * 0.995, close: c }); prev = c; k++;
  }
  return { bars, ends: monthEnds(bars) };
}
// eight markets, each a steady trend of its own slope a day
function panel(mut = null, days = 1400) {
  const D = {};
  for (let j = 0; j < 8; j++) {
    const slope = (j - 3.5) * 0.0004;
    D['m' + j] = series((k) => 100 * Math.exp(slope * k) * (mut ? mut(j, k) : 1), days);
  }
  return D;
}
const rate0 = () => 0;

test('ranking: 36-month return skipping the last month, sorted ascending, needs 37 months of history', () => {
  const D = panel(), m0 = monthOf(D.m0.bars[0].time);
  assert.equal(rankAt(D, m0 + 36).length, 0, 'not before close(m-37) exists');
  const m = m0 + 40, list = rankAt(D, m);
  assert.equal(list.length, 8);
  assert.deepEqual(list.map((x) => x.key), ['m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7']);
  const { bars, ends } = D.m2;
  assert.ok(near(list[2].score, bars[ends.get(m - 1)].close / bars[ends.get(m - 37)].close - 1));
});

test('no look-ahead: the ranking at month m reads nothing after month m; the skip month is not read either', () => {
  const D = panel(), m0 = monthOf(D.m0.bars[0].time), m = m0 + 40;
  const cutT = D.m0.bars[D.m0.ends.get(m - 1)].time; // the end of month m-1
  // change every price after month m-1: the ranking at m must stay the same (the skip month and later are never read)
  const D2 = panel((j, k) => (D.m0.bars[k] && D.m0.bars[k].time > cutT ? (j % 2 ? 9 : 0.1) : 1));
  assert.deepEqual(rankAt(D2, m), rankAt(D, m));
  // ...while a change inside month m-1 does change it
  const D3 = panel((j, k) => (D.m0.bars[k] && D.m0.bars[k].time <= cutT && D.m0.bars[k].time > cutT - 20 * 86400 && j === 0 ? 50 : 1));
  assert.notDeepEqual(rankAt(D3, m).map((x) => x.key), rankAt(D, m).map((x) => x.key));
});

test('a stale month end is not ranked', () => {
  const D = panel(), m0 = monthOf(D.m0.bars[0].time), m = m0 + 40;
  const { bars } = D.m5, i = D.m5.ends.get(m);
  const cut = bars.filter((b) => !(monthOf(b.time) === m && b.time > bars[i].time - 10 * 86400));
  D.m5 = { bars: cut, ends: monthEnds(cut) };
  assert.ok(!rankAt(D, m).some((x) => x.key === 'm5'));
});

test('cohorts: long the bottom 3, short the top 3, entry at the next open, 12 overlapping cohorts', () => {
  const D = panel(), m0 = monthOf(D.m0.bars[0].time), last = D.m0.bars[D.m0.bars.length - 1].time;
  const C = cohortsOf(D, { mFrom: m0, mTo: m0 + 60, rate: rate0, lastT: last });
  const h = C.find((x) => x.m === m0 + 40);
  assert.deepEqual(h.longs, ['m0', 'm1', 'm2']); assert.deepEqual(h.shorts, ['m5', 'm6', 'm7']);
  for (const lg of h.legs) {
    const { bars, ends } = D[lg.key];
    assert.equal(lg.entry, bars[ends.get(h.m) + 1].open, 'entry at the open of the next candle');
    assert.ok(lg.dir > 0 ? lg.stop < lg.entry : lg.stop > lg.entry, 'stop on the losing side');
  }
  const rows = bookOf(C, m0 + 52, m0 + 52);
  assert.equal(rows[0].n, 12, 'twelve cohorts live in a month once they have built up');
  assert.equal(C[0].m, m0 + 37, "the first cohort forms once close(m-37) exists");
  const rows1 = bookOf(C, m0 + 38, m0 + 38);
  assert.equal(rows1[0].n, 1, 'the first cohort alone in its first month');
});

test('book R = mean of the live cohorts, each the mean of its legs, and the attribution sums to it', () => {
  const D = panel(), m0 = monthOf(D.m0.bars[0].time), last = D.m0.bars[D.m0.bars.length - 1].time;
  const C = cohortsOf(D, { mFrom: m0, mTo: m0 + 60, rate: nightRate(() => 2), lastT: last });
  const M = m0 + 50, attr = new Map(), [row] = bookOf(C, M, M, 1, attr);
  const live = C.filter((h) => h.m < M && M <= h.m + 12);
  const hand = live.reduce((a, h) => a + h.legs.reduce((b, lg) => { const o = lg.months.get(M); return b + (o ? o.g - o.spr - o.fin : 0); }, 0) / h.legs.length, 0) / live.length;
  assert.ok(near(row.net, hand));
  assert.ok(near([...attr.values()].reduce((a, b) => a + b, 0), row.net));
});

test('the stop: a leg stopped mid-hold is flat afterwards; a gap through the stop fills at the open', () => {
  const D = panel(), m0 = monthOf(D.m0.bars[0].time), m = m0 + 40;
  const { bars, ends } = D.m0, e = ends.get(m) + 1, last = bars[bars.length - 1].time;
  const lg0 = legOf(D, 'm0', m, 1, rate0, last); // m0 falls: a long is stopped
  assert.ok(lg0.why === 'stop' || lg0.why === 'stop-gap');
  assert.ok(near(lg0.exitPx, lg0.why === 'stop' ? lg0.stop : bars.find((b) => b.time === lg0.exitT).open));
  const after = [...lg0.months.keys()].filter((mm) => mm > monthOf(lg0.exitT));
  assert.equal(after.length, 0, 'no R after the stop');
  // gross R up to the stop = (stop - entry) / R = -1 for a plain stop
  const g = [...lg0.months.values()].reduce((a, o) => a + o.g, 0);
  if (lg0.why === 'stop') assert.ok(near(g, -1));
  // a gap: the candle after the entry opens far below the stop
  const gapBars = bars.map((b, k) => (k === e + 3 ? { ...b, open: b.open * 0.7, low: b.low * 0.7 } : b));
  const DG = { ...D, m0: { bars: gapBars, ends: monthEnds(gapBars) } };
  const lgG = legOf(DG, 'm0', m, 1, rate0, last);
  assert.equal(lgG.why, 'stop-gap'); assert.equal(lgG.exitPx, gapBars[e + 3].open);
  assert.ok([...lgG.months.values()].reduce((a, o) => a + o.g, 0) < -1, 'a gap loses more than 1R');
});

test('a leg not stopped exits at the close of month m + 12; costs are the half spreads and nightly financing', () => {
  const D = panel(), m0 = monthOf(D.m0.bars[0].time), m = m0 + 40, last = D.m7.bars[D.m7.bars.length - 1].time;
  const lg = legOf(D, 'm0', m, -1, nightRate(() => 1.5), last); // short the faller: not stopped
  assert.equal(lg.why, 'time');
  const { bars, ends } = D.m0;
  assert.equal(lg.exitT, bars[ends.get(m + 12)].time); assert.equal(lg.exitPx, bars[ends.get(m + 12)].close);
  const spr = [...lg.months.values()].reduce((a, o) => a + o.spr, 0);
  assert.ok(near(spr, (COST.roundTrip / 2) * (lg.entry + lg.exitPx) / lg.R));
  const e = ends.get(m) + 1, x = ends.get(m + 12);
  let fin = 0; for (let k = e; k < x; k++) fin += nights(bars[k].time, bars[k + 1].time) * ((1.5 / 100 + COST.markup) / 365) * bars[k].close / lg.R;
  assert.ok(near([...lg.months.values()].reduce((a, o) => a + o.fin, 0), fin), 'financing charged on a short too');
  const g = [...lg.months.values()].reduce((a, o) => a + o.g, 0);
  assert.ok(near(g, -(lg.exitPx - lg.entry) / lg.R));
});

test('Newey-West t, statistics, the placebo shuffle and the month helpers', () => {
  const xs = [0.1, -0.05, 0.2, 0.03, -0.1, 0.07, 0.12, -0.02, 0.05, 0.01, 0.04, -0.03, 0.08, 0.02];
  const n = xs.length, mu = xs.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(xs.reduce((a, b) => a + (b - mu) ** 2, 0) / n);
  assert.ok(near(nwT(xs, 0), mu / (sd / Math.sqrt(n))), 'zero lags = the t with the population variance');
  const s = statsOf(xs.map((v) => ({ net: v })));
  assert.equal(s.months, n); assert.ok(s.maxDD <= 0);
  const a = shuffle([1, 2, 3, 4, 5], mulberry32(1)), b = shuffle([1, 2, 3, 4, 5], mulberry32(1));
  assert.deepEqual(a, b); assert.deepEqual(a.slice().sort(), [1, 2, 3, 4, 5]);
  assert.equal(monthLabel(monthFrom('2016-01')), '2016-01');
  assert.equal(P.L, 36); assert.equal(P.hold, 12); assert.equal(P.atrK, 3);
});

test('RESULT.md agrees with result.json', () => {
  const j = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
  const md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
  assert.match(md.split('\n')[2], new RegExp(`^\\*\\*Verdict: ${j.verdict}\\.\\*\\*`));
  const pass = Object.values(j.checks).every(Boolean);
  assert.equal(j.verdict, pass ? 'PASS' : 'FAIL');
  const d = j.main.decisive.x1, r = j.main.replication.x1;
  assert.ok(md.includes(`| ${d.months} | ${d.mean} | ${d.tNW} |`));
  assert.ok(md.includes(`| ${r.months} | ${r.mean} | ${r.tNW} |`));
  assert.ok(md.includes(`| ${j.placebo.real} | ${j.placebo.median} | ${j.placebo.p5} | ${j.placebo.p95} |`));
  assert.equal(j.checks.decPositive, d.mean > 0); assert.equal(j.checks.repPositive, r.mean > 0);
  assert.equal(j.checks.tNW, d.tNW >= 2); assert.equal(j.checks.placebo, j.placebo.real > j.placebo.p95);
  assert.equal(j.placebo.draws, 40);
  for (const v of j.variants) assert.ok(md.includes(`| ${v.lookback} months | decisive | ${v.decisive.months} | ${v.decisive.mean} |`));
  assert.equal(j.windows.decisive.from, '2016-01');
  assert.ok(fs.readFileSync(path.join(DIR, 'PREREGISTRATION.md'), 'utf8').includes('Pass bar'));
});
