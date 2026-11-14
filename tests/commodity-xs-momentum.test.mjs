// Commodity cross-sectional momentum study (research/edge/commodity-xs-momentum): offline checks of the ranking (skip-month,
// no look-ahead), the stop, the costs and the written report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  indexMarket, momentum, rankAt, topBottom, simLeg, leg, shiftYm, monthsBetween, runBook, monthR, neweyWestT, costOf, P,
} from '../research/edge/commodity-xs-momentum/run.mjs';

const dir = new URL('../research/edge/commodity-xs-momentum/', import.meta.url);
const result = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const report = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');

// a hand-made market: one weekday candle on the 2nd, 15th and last weekday-ish day of each month, closes from closeOf(month index, day)
function market(key, closeOf, from = '2020-01', to = '2022-06') {
  const bars = []; let mi = 0;
  for (const m of monthsBetween(from, to)) {
    for (const d of [2, 15, 27]) {
      const t = Date.UTC(+m.slice(0, 4), +m.slice(5) - 1, d, 0, 0, 0) / 1000;
      const c = closeOf(mi, d);
      bars.push({ time: t, open: c, high: c * 1.001, low: c * 0.999, close: c });
    }
    mi++;
  }
  return indexMarket(key, bars);
}

test('calendar months shift across years', () => {
  assert.equal(shiftYm('2021-01', -1), '2020-12');
  assert.equal(shiftYm('2021-01', -12), '2020-01');
  assert.equal(shiftYm('2020-12', 1), '2021-01');
});

test('12-1 return uses month-end closes of M-12 and M-1, never month M', () => {
  // close = 100 + month index at every candle, except the last candle of month M (index 12 = 2021-01) is huge
  const mk = market('xau', (mi, d) => (mi === 12 && d === 27 ? 1e6 : 100 + mi));
  const r = momentum(mk, '2021-01');
  assert.equal(r, (100 + 11) / (100 + 0) - 1); // close(2020-12) / close(2020-01) - 1
  // changing anything after the signal month leaves the signal alone
  const mk2 = market('xau', (mi, d) => (mi > 12 ? 5 : mi === 12 && d === 27 ? 1e6 : 100 + mi));
  assert.equal(momentum(mk2, '2021-01'), r);
  // 13 months of history are needed
  assert.equal(momentum(mk, '2020-12'), null);
});

test('ranking orders markets and takes top 3 long, bottom 3 short; ties by list order', () => {
  const mks = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map((k, j) => market(k, (mi) => 100 * (1 + (j % 5) * 0.01) ** mi));
  const ranked = rankAt(mks, '2021-06');
  assert.equal(ranked.length, 10);
  assert.deepEqual(ranked, ['e', 'j', 'd', 'i', 'c', 'h', 'b', 'g', 'a', 'f']);
  assert.deepEqual(topBottom(ranked), { long: ['e', 'j', 'd'], short: ['b', 'g', 'a', 'f'].slice(-3) });
  // a book needs at least 10 ranked markets; with 9 nothing is traded
  assert.equal(runBook(mks.slice(0, 9), ['2021-07']).length, 0);
  const one = runBook(mks, ['2021-07']);
  assert.equal(one.length, 1);
  assert.deepEqual(one[0].long, ['e', 'j', 'd']);
  assert.deepEqual(one[0].short, ['g', 'a', 'f']);
  assert.equal(one[0].legs.length, 6);
});

test('the stop: 1R from entry, a touch fills at the stop, an open beyond it at the open, never better', () => {
  const bars = [
    { time: 0, open: 100, high: 101, low: 99, close: 100 },
    { time: 86400, open: 100, high: 100.5, low: 97.5, close: 98 },
  ];
  assert.deepEqual(simLeg(bars, 0, 1, 1, 2), { entry: 100, stop: 98, exit: 98, exitIdx: 1, how: 'stop' });
  const gap = [bars[0], { time: 86400, open: 96, high: 97, low: 95, close: 96 }];
  const g = simLeg(gap, 0, 1, 1, 2);
  assert.equal(g.how, 'gap'); assert.equal(g.exit, 96);
  const s = simLeg([bars[0], { time: 86400, open: 103, high: 104, low: 102, close: 103 }], 0, 1, -1, 2);
  assert.equal(s.how, 'gap'); assert.equal(s.exit, 103); assert.equal(s.stop, 102);
  const held = simLeg(bars, 0, 1, 1, 5);
  assert.equal(held.how, 'close'); assert.equal(held.exit, 98);
  // the entry candle itself can stop the leg
  assert.equal(simLeg([{ time: 0, open: 100, high: 100, low: 90, close: 95 }], 0, 0, 1, 2).how, 'stop');
});

test('a leg is sized by 2 x ATR(20) of the signal day and pays its costs', () => {
  const mk = market('xag', (mi) => 20 + mi * 0.1);
  const l = leg(mk, '2021-06', '2021-07', 1);
  assert.ok(l && l.costR > 0 && l.finR >= 0 && l.nights > 0);
  assert.equal(costOf('xau', 4000), 0.30);
  assert.equal(costOf('xag', 50), 0.03);
  assert.equal(costOf('wheat', 500), 0.3);
  assert.equal(monthR({ legs: [l] }, 0), l.gross);
  assert.equal(monthR({ legs: [l] }, 2), l.gross - 2 * (l.costR + l.finR));
});

test('Newey-West t equals the plain t when there is no autocorrelation term', () => {
  const v = [1, -1, 1, -1, 2, 0, 1, 0];
  const t0 = neweyWestT(v, 0), n = v.length, mu = v.reduce((a, b) => a + b, 0) / n;
  const g0 = v.reduce((a, x) => a + (x - mu) ** 2, 0) / n;
  assert.ok(Math.abs(t0 - mu / Math.sqrt(g0 / n)) < 1e-12);
  assert.ok(Number.isFinite(neweyWestT(v, P.NW_LAGS)));
});

test('result.json: the pre-registered checks and the verdict agree', () => {
  const c = result.checks, D = result.decisive, R = result.replication;
  assert.equal(c.decisivePositive, D.net.mean > 0);
  assert.equal(c.replicationPositive, R.net.mean > 0);
  assert.equal(c.decisiveT2, D.net.tNW >= 2);
  assert.equal(c.abovePlacebo95, result.placebo.real > result.placebo.p95);
  assert.equal(D.net.n, 130);
  assert.equal(result.verdict, Object.values(c).every(Boolean) ? 'PASS' : 'FAIL');
  assert.equal(result.placebo.runs.length, 40);
  assert.equal(D.legs.long, D.legs.short);
});

test('RESULT.md states the verdict and the figures of result.json', () => {
  const D = result.decisive, R = result.replication, f = (v, k = 3) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(k);
  const first = report.split('\n').find((l) => l.startsWith('**Verdict'));
  assert.ok(first.startsWith(`**Verdict: ${result.verdict}.**`));
  for (const s of [f(D.net.mean), f(D.net.tNW, 2), f(R.net.mean), f(R.net.tNW, 2), f(D.gross.mean), f(R.gross.mean), f(D.net2x.mean), f(D.net.dd, 2),
    f(result.placebo.p50, 4), f(result.placebo.p95, 4), f(result.placebo.real, 4), `${result.placebo.above} of 40`])
    assert.ok(report.includes(s), `RESULT.md lacks ${s}`);
  for (const [k, v] of Object.entries(result.byMarket.decisive)) assert.ok(report.includes(`| ${k} | ${v.long} / ${v.short} | ${f(v.netR, 2)} |`), k);
  for (const [y, v] of Object.entries(result.byYear)) assert.ok(report.includes(`| ${y} | ${v.months} | ${f(v.gross, 2)} | ${f(v.net, 2)} |`), y);
  for (const n of ['6-1', '3-1']) assert.ok(report.includes(`| ${n} | ${f(result.variants[n].decisive.net.mean)} (${f(result.variants[n].decisive.net.tNW, 2)})`), n);
  assert.ok(report.includes('tsmom') && report.includes('fx-xs-momentum'));
});
