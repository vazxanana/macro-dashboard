// Cross-sectional index momentum study (research/edge/index-xs-momentum): offline checks of the ranking (skip-month, no
// look-ahead, thirds), the stop, the costs, the pre-registered checks and the written report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  indexMarket, momentum, rankAt, thirds, simLeg, leg, shiftYm, monthsBetween, runBook, monthSum, monthSums, finRate, cashRate,
  neweyWestT, report, MARKETS, P, IS, OOS,
} from '../research/edge/index-xs-momentum/run.mjs';

const dir = new URL('../research/edge/index-xs-momentum/', import.meta.url);
const result = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');

// a hand-made market: candles on the 2nd, 15th and 27th of each month, closes from closeOf(month index, day)
function market(key, closeOf, from = '2020-01', to = '2022-06') {
  const bars = []; let mi = 0;
  for (const m of monthsBetween(from, to)) {
    for (const d of [2, 15, 27]) {
      const t = Date.UTC(+m.slice(0, 4), +m.slice(5) - 1, d) / 1000, c = closeOf(mi, d);
      bars.push({ time: t, open: c, high: c * 1.001, low: c * 0.999, close: c });
    }
    mi++;
  }
  return indexMarket(key, bars);
}

test('calendar months and the pre-registered windows', () => {
  assert.equal(shiftYm('2021-01', -12), '2020-01');
  assert.equal(monthsBetween(IS.from, IS.to).length, 129);
  assert.equal(monthsBetween(OOS.from, OOS.to).length, 130);
  assert.equal(MARKETS.length, 13);
  for (const k of ['nas100', 'us30', 'us2000', 'eu50']) assert.ok(!MARKETS.includes(k), k);
});

test('12-1 return reads the month-ends of M-12 and M-1, never month M or later', () => {
  const mk = market('spx500', (mi, d) => (mi === 12 && d === 27 ? 1e6 : 100 + mi));
  const r = momentum(mk, '2021-01');
  assert.equal(r, (100 + 11) / 100 - 1);
  const mk2 = market('spx500', (mi, d) => (mi > 12 ? 5 : mi === 12 && d === 27 ? 1e6 : 100 + mi));
  assert.equal(momentum(mk2, '2021-01'), r);
  assert.equal(momentum(mk, '2020-12'), null);
});

test('ranking: highest first, ties by the universe order; top third long, bottom third short', () => {
  const growth = [0.03, 0.01, 0.02, 0.0, 0.03, -0.01, 0.02, 0.01, 0.0, -0.02, 0.04, 0.0, 0.01];
  const mks = MARKETS.map((k, j) => market(k, (mi) => 100 * (1 + growth[j]) ** mi));
  const ranked = rankAt(mks, '2021-06');
  assert.deepEqual(ranked, ['cn50', 'spx500', 'ch20', 'uk100', 'es35', 'de40', 'jp225', 'in50', 'fr40', 'au200', 'sg30', 'nl25', 'hk33']);
  assert.deepEqual(thirds(ranked), { long: ['cn50', 'spx500', 'ch20', 'uk100'], short: ['au200', 'sg30', 'nl25', 'hk33'] });
  assert.deepEqual(thirds(ranked.slice(0, 11)), { long: ['cn50', 'spx500', 'ch20'], short: ['fr40', 'au200', 'sg30'] });
  // fewer than 9 ranked: nothing traded
  assert.equal(runBook(mks.slice(0, 8), ['2021-07']).length, 0);
  const one = runBook(mks.slice(0, 9), ['2021-07']);
  assert.equal(one.length, 1);
  assert.equal(one[0].legs.length, 6);
  assert.equal(one[0].legs.filter((l) => l.side > 0).length, 3);
  // a month with no trade is a 0 in the calendar-month sums
  const sums = monthSums(one, { from: '2021-06', to: '2021-07' });
  assert.equal(sums[0], 0);
  assert.equal(sums[1], monthSum(one[0]));
});

test('every leg has a stop: 1R from entry, a touch fills at the stop, an open beyond it at the open', () => {
  const b0 = { time: 0, open: 100, high: 101, low: 99, close: 100 };
  assert.deepEqual(simLeg([b0, { time: 86400, open: 100, high: 100.5, low: 97.5, close: 98 }], 0, 1, 1, 2), { entry: 100, stop: 98, exit: 98, exitIdx: 1, how: 'stop' });
  const g = simLeg([b0, { time: 86400, open: 96, high: 97, low: 95, close: 96 }], 0, 1, 1, 2);
  assert.equal(g.how, 'gap'); assert.equal(g.exit, 96);
  const s = simLeg([b0, { time: 86400, open: 103, high: 104, low: 102, close: 103 }], 0, 1, -1, 2);
  assert.equal(s.how, 'gap'); assert.equal(s.exit, 103); assert.equal(s.stop, 102);
  assert.equal(simLeg([b0, { time: 86400, open: 100, high: 100.5, low: 97.5, close: 98 }], 0, 1, 1, 5).how, 'close');
});

test('costs: 0.03 % round trip, long financing r + 2.5 %, short max(0, 2.5 % - r)', () => {
  const t2024 = Date.UTC(2024, 5, 3) / 1000;
  assert.equal(cashRate('USD', 2024), 5.1);
  assert.equal(cashRate('CHF', 2019), 0); // negative floored
  assert.equal(cashRate('USD', 2004), 5.0); // before 2007 uses 2007
  assert.ok(Math.abs(finRate('spx500', 1, t2024) - 0.076) < 1e-12);
  assert.equal(finRate('spx500', -1, t2024), 0);
  assert.ok(Math.abs(finRate('ch20', -1, Date.UTC(2019, 1, 1) / 1000) - 0.025) < 1e-12);
  const mk = market('de40', (mi) => 100 + mi);
  const l = leg(mk, '2021-06', '2021-07', 1);
  assert.ok(l && l.costR > 0 && l.finR > 0 && l.nights > 0);
  assert.equal(monthSum({ legs: [l, l] }, 0), 2 * l.gross);
  assert.equal(monthSum({ legs: [l] }, 2), l.gross - 2 * (l.costR + l.finR));
});

test('Newey-West t with no lags equals the plain t built on the population variance', () => {
  const v = [1, -1, 1, -1, 2, 0, 1, 0], n = v.length, mu = v.reduce((a, b) => a + b, 0) / n;
  const g0 = v.reduce((a, x) => a + (x - mu) ** 2, 0) / n;
  assert.ok(Math.abs(neweyWestT(v, 0) - mu / Math.sqrt(g0 / n)) < 1e-12);
});

test('result.json: the pre-registered checks and the verdict agree', () => {
  const c = result.checks, O = result.oos, I = result.is;
  assert.equal(O.net.n, 130); assert.equal(I.net.n, 129);
  assert.equal(c.oosT2, O.net.t >= 2);
  assert.equal(c.isPositive, I.net.mean > 0);
  assert.equal(c.oos2xPositive, O.net2x.mean > 0);
  assert.equal(c.beatsPlacebo, result.placebo.beaten >= 38);
  assert.equal(result.placebo.beaten, result.placebo.runs.filter((r) => O.net.mean > r.mean).length);
  assert.equal(result.placebo.runs.length, 40);
  assert.equal(result.verdict, Object.values(c).every(Boolean) ? 'PASS' : 'FAIL');
  for (const w of [O, I]) {
    assert.equal(w.legs.long + w.legs.short, w.legs.n);
    assert.ok(Math.abs(w.legs.long - w.legs.short) <= w.missingLegs); // only a missing leg unbalances a month
  }
  assert.equal(P.BEAT, 38);
});

test('RESULT.md is the report of result.json and states the verdict line', () => {
  assert.equal(md, report(result));
  assert.ok(md.split('\n').some((l) => l.startsWith(`**Verdict: ${result.verdict}**`)));
  assert.ok(/Verdict: (PASS|FAIL)/.test(md));
});
