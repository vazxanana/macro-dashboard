// Commodity cross-sectional skewness study (research/edge/commodity-skewness): offline checks of the skewness, the ranking
// (no look-ahead, a third a side, negative skew long), the stop, the windows and the written report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  indexMarket, skewness, returnsOf, skewAt, rankAt, topBottom, perSide, simLeg, runBook, monthR, monthsBetween, splitHalves,
} from '../research/edge/commodity-skewness/run.mjs';

const dir = new URL('../research/edge/commodity-skewness/', import.meta.url);
const result = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const report = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');

// a hand-made market: one candle every weekday, close from closeOf(day index); a deterministic shock pattern gives skew
function market(key, closeOf, from = '2020-01-01', to = '2022-06-30') {
  const bars = []; let i = 0;
  for (let t = Date.parse(from) / 1000; t <= Date.parse(to) / 1000; t += 86400) {
    const wd = new Date(t * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    const c = closeOf(i++);
    bars.push({ time: t, open: c, high: c * 1.002, low: c * 0.998, close: c });
  }
  return indexMarket(key, bars);
}
// log-price path: small steady moves with a rare jump of size `jump` every `every` days (sign of jump = sign of skew)
const path = (jump, every = 17, base = 0.001) => {
  let lp = Math.log(100); const cache = [];
  return (i) => { while (cache.length <= i) { const n = cache.length; lp += n % every === 0 ? jump : (n % 2 ? base : -base) - jump / every; cache.push(Math.exp(lp)); } return cache[i]; };
};

test('skewness: Pearson moment coefficient, sign follows the long tail', () => {
  assert.equal(skewness([1, 1, 1]), null);
  assert.ok(Math.abs(skewness([-1, 0, 1])) < 1e-12);
  const s = skewness([0, 0, 0, 0, 10]);
  // mean 2; m2 = (4*4+64)/5 = 16; m3 = (4*-8+512)/5 = 96; 96 / 64 = 1.5
  assert.ok(Math.abs(s - 1.5) < 1e-12);
  assert.ok(Math.abs(skewness([0, 0, 0, 0, -10]) + 1.5) < 1e-12);
});

test('the signal reads returns from month-end S-12 to month-end S only, needs 200 returns', () => {
  const mk = market('xcu', path(0.05));
  const r = returnsOf(mk, '2021-06');
  const a = mk.last.get('2020-06'), b = mk.last.get('2021-06');
  assert.equal(r.length, b - a);
  assert.ok(skewAt(mk, '2021-06') > 0);
  // anything after the signal month leaves the signal alone
  const mk2 = market('xcu', (i) => (i > b ? 1 : path(0.05)(i)));
  assert.equal(skewAt(mk2, '2021-06'), skewAt(mk, '2021-06'));
  // not 12 months of history yet
  assert.equal(skewAt(mk, '2020-12'), null);
  assert.equal(skewAt(mk, '2021-06', 12, 400), null);
});

test('ranking: most negative skew first, floor(N/3) a side, ties by list order', () => {
  const jumps = [-0.06, 0.06, -0.03, 0.03, 0.0, -0.05, 0.05, -0.02, 0.02, 0.04, -0.04, 0.01];
  const keys = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'];
  const mks = keys.map((k, j) => market(k, path(jumps[j])));
  const ranked = rankAt(mks, '2021-06');
  const sk = ranked.map((k) => skewAt(mks[keys.indexOf(k)], '2021-06'));
  for (let i = 1; i < sk.length; i++) assert.ok(sk[i] >= sk[i - 1]);
  assert.equal(ranked[0], 'a'); assert.equal(ranked.at(-1), 'b');
  assert.equal(perSide(12), 4); assert.equal(perSide(11), 3); assert.equal(perSide(10), 3);
  const tb = topBottom(ranked);
  assert.deepEqual(tb.long, ranked.slice(0, 4)); assert.deepEqual(tb.short, ranked.slice(8));
  assert.ok(tb.long.every((k) => jumps[keys.indexOf(k)] < 0) && tb.short.every((k) => jumps[keys.indexOf(k)] > 0));
  const one = runBook(mks, ['2021-07']);
  assert.equal(one.length, 1); assert.equal(one[0].legs.length, 8);
  assert.deepEqual(one[0].long, tb.long);
  assert.ok(one[0].legs.every((l) => (tb.long.includes(l.key) ? l.side === 1 : l.side === -1)));
  // fewer than 10 ranked: nothing traded
  assert.equal(runBook(mks.slice(0, 9), ['2021-07']).length, 0);
  // ties: equal skew keeps list order
  const twins = ['x', 'y'].map((k) => market(k, path(0.02)));
  assert.deepEqual(rankAt(twins, '2021-06'), ['x', 'y']);
});

test('every leg has a stop at 1R; a gap open fills at the open, never better', () => {
  const bars = [{ time: 0, open: 100, high: 101, low: 99, close: 100 }, { time: 86400, open: 100, high: 100.5, low: 97.5, close: 98 }];
  assert.deepEqual(simLeg(bars, 0, 1, 1, 2), { entry: 100, stop: 98, exit: 98, exitIdx: 1, how: 'stop' });
  const g = simLeg([bars[0], { time: 86400, open: 96, high: 97, low: 95, close: 96 }], 0, 1, 1, 2);
  assert.equal(g.how, 'gap'); assert.equal(g.exit, 96);
  const s = simLeg([bars[0], { time: 86400, open: 103, high: 104, low: 102, close: 103 }], 0, 1, -1, 2);
  assert.equal(s.stop, 102); assert.equal(s.exit, 103);
});

test('windows: first half in sample, the rest out of sample', () => {
  const ms = monthsBetween('2006-02', '2026-10').map((month) => ({ month }));
  const { is, oos } = splitHalves(ms);
  assert.equal(is.length, 124); assert.equal(oos.length, 125);
  assert.equal(is.at(-1).month, '2016-05'); assert.equal(oos[0].month, '2016-06');
  assert.deepEqual(result.windows.is, { from: '2006-02', to: '2016-05', n: 124 });
  assert.deepEqual(result.windows.oos, { from: '2016-06', to: '2026-10', n: 125 });
});

test('result.json: the pre-registered checks and the verdict agree', () => {
  const c = result.checks, I = result.is, O = result.oos;
  assert.equal(c.oosT2, O.net.tNW >= 2);
  assert.equal(c.isPositive, I.net.mean > 0);
  assert.equal(c.oos2xPositive, O.net2x.mean > 0);
  assert.equal(c.abovePlacebo95, result.placebo.real > result.placebo.p95);
  assert.equal(result.verdict, Object.values(c).every(Boolean) ? 'PASS' : 'FAIL');
  assert.equal(result.placebo.runs.length, 40);
  assert.equal(O.legs.long, O.legs.short);
  const m = result.months.filter((x) => x.month >= '2016-06');
  assert.equal(m.length, 125);
  assert.ok(Math.abs(m.reduce((a, x) => a + x.net, 0) / m.length - result.placebo.real) < 1e-3);
  assert.ok(Math.abs(monthR({ legs: [{ gross: 1, costR: 0.1, finR: 0.2 }] }, 2) - 0.4) < 1e-12);
});

test('RESULT.md states the verdict and the figures of result.json', () => {
  const I = result.is, O = result.oos, P = result.placebo, f = (v, k = 3) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(k);
  const first = report.split('\n').find((l) => l.startsWith('**Verdict'));
  assert.ok(first.startsWith(`**Verdict: ${result.verdict}.**`));
  for (const s of [f(O.net.mean), f(O.net.tNW, 2), f(I.net.mean), f(I.net.tNW, 2), f(O.net2x.mean), f(O.gross.mean), f(I.gross.mean),
    f(O.legs.avgNet), f(P.p50, 4), f(P.p95, 4), f(P.real, 4), `${P.above} of 40`, f(O.net.dd, 2)])
    assert.ok(report.includes(s), `RESULT.md lacks ${s}`);
  for (const [k, v] of Object.entries(result.byMarket.oos)) assert.ok(report.includes(`| ${v.long} / ${v.short} | ${f(v.netR, 2)} |`), k);
  for (const [y, v] of Object.entries(result.byYear)) assert.ok(report.includes(`| ${y} | ${v.months} | ${f(v.gross, 2)} | ${f(v.net, 2)} |`), y);
  assert.ok(report.includes('commodity-xs-momentum') && report.includes('decision 44'));
});
