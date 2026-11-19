// Cross-sectional return seasonality study (research/edge/xs-seasonality): offline checks of the same-month signal (past
// years only, at least 5, no look-ahead), the inverted dollar pairs, the thirds within a group, the stop, the costs, the
// placebo month, Holm, and the written report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  indexMarket, seasonal, rankGroup, thirds, simLeg, leg, shiftYm, monthsBetween, runBook, monthSum, monthSums, costFrac, finNight,
  holm, pOfT, otherMonth, mulberry32, report, GROUPS, MARKETS, INV, P, OOS, IS_TO, BOOKS,
} from '../research/edge/xs-seasonality/run.mjs';
import { FIN } from '../council/fills.mjs';

const dir = new URL('../research/edge/xs-seasonality/', import.meta.url);
const result = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');

// a hand-made market: candles on the 2nd, 15th and 27th of each month; monthly growth from growthOf(month string)
function market(key, growthOf, from = '2010-01', to = '2021-12') {
  const bars = []; let c = 100;
  for (const m of monthsBetween(from, to)) {
    const g = growthOf(m);
    for (const d of [2, 15, 27]) {
      const t = Date.UTC(+m.slice(0, 4), +m.slice(5) - 1, d) / 1000, o = c; c = c * (1 + g / 3);
      bars.push({ time: t, open: o, high: Math.max(o, c) * 1.001, low: Math.min(o, c) * 0.999, close: c });
    }
  }
  return indexMarket(key, bars);
}

test('universe and windows are the pre-registered ones', () => {
  assert.deepEqual(Object.keys(GROUPS), ['index', 'metal', 'energy', 'fx']);
  assert.equal(GROUPS.index.length, 13); assert.equal(GROUPS.metal.length, 5); assert.equal(GROUPS.energy.length, 7); assert.equal(GROUPS.fx.length, 9);
  for (const k of ['nas100', 'us30', 'eu50', 'xaueur', 'usdtry', 'usdzar', 'usdhkd', 'usdcnh']) assert.ok(!MARKETS.includes(k), k);
  assert.deepEqual([...INV].sort(), ['usdcad', 'usdchf', 'usdjpy', 'usdnok', 'usdsek']);
  assert.equal(IS_TO, '2016-12');
  assert.deepEqual(OOS, { from: '2017-01', to: '2026-10' });
  assert.equal(monthsBetween(OOS.from, OOS.to).length, 118);
  assert.equal(P.MIN_YEARS, 5); assert.equal(P.ATR_MULT, 3); assert.equal(P.ATR_N, 20);
  assert.deepEqual(BOOKS, ['all', 'index', 'metal', 'energy', 'fx']);
});

test('signal: mean of the same calendar month in past years only, at least 5, and nothing at or after the signal month', () => {
  const mk = market('spx500', (m) => (m.endsWith('-03') ? 0.03 : 0.0));
  // 2015-03: Marches 2010..2014 = 5 past years (the first month, 2010-01, has no return)
  const g3 = 1.01 ** 3 - 1; // three candles of +1 % each
  assert.ok(Math.abs(seasonal(mk, '2015-03') - g3) < 1e-9);
  assert.equal(seasonal(mk, '2014-03'), null); // only 4 past Marches
  assert.ok(Math.abs(seasonal(mk, '2015-04')) < 1e-12);
  // changing every price from the signal month on (and this year's) changes nothing
  const mk2 = market('spx500', (m) => (m >= '2015-01' ? 0.5 : m.endsWith('-03') ? 0.03 : 0.0));
  assert.equal(seasonal(mk2, '2015-03'), seasonal(mk, '2015-03'));
  // a different calendar month (the placebo) reads that month's past average
  assert.ok(Math.abs(seasonal(mk, '2015-07', '03') - g3) < 1e-9);
  // de-drifted: same-month mean minus the all-month mean of the same past years
  const d = seasonal(mk, '2015-03', '03', { dedrift: true });
  assert.ok(d > 0 && d < g3);
});

test('an inverted USD-base pair ranks the foreign currency: the pair falling is the currency rising', () => {
  const pair = market('usdjpy', (m) => (m.endsWith('-06') ? -0.02 : 0));
  assert.ok(seasonal(pair, '2016-06') > 0.019);
  const l = leg(pair, '2016-06', 1); // long JPY = short USD/JPY
  assert.ok(l.gross > 0, 'a long currency earns when the pair falls');
});

test('thirds within a group: highest first, ties by list order; groups ranked apart', () => {
  const sizes = { spx500: 0.05, de40: 0.04, uk100: 0.03, fr40: 0.02, ch20: 0.01, nl25: 0.0, jp225: -0.01, au200: -0.02, hk33: -0.03 };
  const mks = Object.entries(sizes).map(([k, s]) => market(k, (m) => (m.endsWith('-05') ? s : 0.001)));
  const r = rankGroup(mks, '2016-05');
  assert.deepEqual(r, ['spx500', 'de40', 'uk100', 'fr40', 'ch20', 'nl25', 'jp225', 'au200', 'hk33']);
  assert.deepEqual(thirds(r), { long: ['spx500', 'de40', 'uk100'], short: ['jp225', 'au200', 'hk33'] });
  assert.deepEqual(thirds(['a', 'b']), { long: [], short: [] });
  const metals = ['xau', 'xag', 'xpt'].map((k, j) => market(k, (m) => (m.endsWith('-05') ? 0.1 * j : 0)));
  const book = runBook([...mks, ...metals], ['2016-05']);
  assert.equal(book.length, 1);
  assert.equal(book[0].legs.filter((l) => l.group === 'index').length, 6);
  assert.deepEqual(book[0].picks.metal, { ranked: 3, long: ['xpt'], short: ['xau'] });
  assert.ok(Math.abs(monthSum(book[0], 1, 'all') - (monthSum(book[0], 1, 'index') + monthSum(book[0], 1, 'metal'))) < 1e-9);
  const sums = monthSums(book, { from: '2016-04', to: '2016-05' });
  assert.equal(sums[0], 0);
});

test('every leg has a stop: a touch fills at the stop, an open beyond it at the open', () => {
  const b0 = { time: 0, open: 100, high: 101, low: 99, close: 100 };
  assert.deepEqual(simLeg([b0, { time: 86400, open: 100, high: 100.5, low: 96.5, close: 98 }], 0, 1, 1, 3), { entry: 100, stop: 97, exit: 97, exitIdx: 1, how: 'stop' });
  const g = simLeg([b0, { time: 86400, open: 95, high: 96, low: 94, close: 95 }], 0, 1, 1, 3);
  assert.equal(g.how, 'gap'); assert.equal(g.exit, 95);
  const s = simLeg([b0, { time: 86400, open: 104, high: 105, low: 103, close: 104 }], 0, 1, -1, 3);
  assert.equal(s.how, 'gap'); assert.equal(s.exit, 104); assert.equal(s.stop, 103);
  // in the real result every leg has a stop: stopped legs exist and each book counts them
  assert.ok(result.books.all.oos.legs.stopped > 0);
});

test('costs: round trips and financing as pre-registered', () => {
  assert.equal(costFrac('spx500', 5000), 0.0004);
  assert.ok(Math.abs(costFrac('xau', 2000) - 0.3 / 2000) < 1e-15);
  assert.ok(Math.abs(costFrac('xag', 25) - 0.03 / 25) < 1e-15);
  assert.equal(costFrac('natgas', 3), 0.0006);
  assert.equal(costFrac('usdsek', 10), 0.0004);
  assert.ok(Math.abs(costFrac('eurusd', 1.1) - (1.3 * 0.0001 / 1.1 + 0.000045)) < 1e-15);
  assert.ok(Math.abs(costFrac('usdjpy', 150) - (1.3 * 0.01 / 150 + 0.000045)) < 1e-15);
  const t24 = Date.UTC(2024, 5, 3) / 1000;
  assert.ok(Math.abs(finNight('spx500', 1, t24) - 0.076 / 365) < 1e-15);
  assert.equal(finNight('spx500', -1, t24), 0);
  assert.equal(finNight('xau', 1, t24), FIN.xau.long);
  assert.ok(Math.abs(finNight('xau', -1, t24) - 0.03 / 365) < 1e-15);
  assert.ok(Math.abs(finNight('wheat', -1, t24) - 0.03 / 365) < 1e-15);
  assert.equal(finNight('eurusd', -1, t24), 0.00004);
});

test('placebo month is never the holding month; Holm and p', () => {
  const pick = otherMonth(mulberry32(7));
  for (const H of monthsBetween('2017-01', '2026-10')) { const o = pick(H); assert.notEqual(o, H.slice(5, 7)); assert.match(o, /^(0[1-9]|1[0-2])$/); }
  assert.ok(Math.abs(pOfT(1.96) - 0.05) < 0.001);
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(4)), [0.03, 0.06, 0.06]);
});

test('result.json: the checks follow the numbers, and RESULT.md is the report of result.json', () => {
  const A = result.books.all;
  assert.equal(result.checks.oosT2Holm, A.oos.net.t >= 2 && A.holmP < 0.05);
  assert.equal(result.checks.isPositive, A.is.net.mean > 0);
  assert.equal(result.checks.oos2xPositive, A.oos.net2x.mean > 0);
  assert.equal(result.checks.beatsPlacebo, result.placebo.beaten >= 38);
  assert.equal(result.verdict, Object.values(result.checks).every(Boolean) ? 'PASS' : 'FAIL');
  assert.equal(result.placebo.runs.length, 40);
  const adj = holm(BOOKS.map((b) => pOfT(result.books[b].oos.net.t)));
  BOOKS.forEach((b, i) => assert.ok(Math.abs(result.books[b].holmP - adj[i]) < 1e-3, b));
  assert.equal(md, report(result));
  const line = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(line.length < 220, `verdict line ${line.length}`);
  assert.ok(line.includes(`t ${A.oos.net.t > 0 ? '+' : ''}${A.oos.net.t}`));
});
