// Crypto cross-sectional momentum study (research/edge/crypto-xs-momentum): offline checks of the ranking (no look-ahead), the
// thirds, the stop, the costs and the written report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  indexCoin, eligible, rankAt, topBottom, simLeg, leg, runBook, weekR, legNet, nightsHeld, finRate, mondays, tOf, P,
} from '../research/edge/crypto-xs-momentum/run.mjs';
import { CFD_CRYPTO } from '../council/fills.mjs';

const dir = new URL('../research/edge/crypto-xs-momentum/', import.meta.url);
const result = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const report = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
const DAY = 86400;
const MON = Date.UTC(2021, 0, 4) / 1000 / DAY; // Monday 4 Jan 2021, as a day number

// a hand-made coin: one candle a day for `days` days ending at MON + 13, close = closeOf(day number)
function coin(key, closeOf, days = 120) {
  const bars = [];
  for (let d = MON + 13 - days + 1; d <= MON + 13; d++) { const c = closeOf(d); bars.push({ time: d * DAY, open: c, high: c * 1.01, low: c * 0.99, close: c }); }
  return indexCoin(key, bars);
}

test('3-week return reads Sunday and 21 days before it, never the Monday or later', () => {
  const c = coin('btc', (d) => (d >= MON ? 1e6 : 100 + d - MON));
  const e = eligible(c, MON);
  assert.equal(e.r, (100 - 1) / (100 - 22) - 1);
  const c2 = coin('btc', (d) => (d >= MON ? 1 : 100 + d - MON));
  assert.equal(eligible(c2, MON).r, e.r);
  // fewer than 60 candles before Monday: not eligible
  assert.equal(eligible(coin('btc', () => 100, 70), MON), null);
});

test('rank, thirds, minimum of six coins, ties by list order', () => {
  const keys = ['btc', 'eth', 'bnb', 'ltc', 'ada', 'xrp', 'trx', 'link', 'doge', 'sol'];
  const coins = keys.map((k, j) => coin(k, (d) => 100 * (1 + (j % 5) * 0.001) ** (d - MON)));
  const ranked = rankAt(coins, MON);
  assert.deepEqual(ranked, ['ada', 'sol', 'ltc', 'doge', 'bnb', 'link', 'eth', 'trx', 'btc', 'xrp']);
  assert.deepEqual(topBottom(ranked), { k: 3, long: ['ada', 'sol', 'ltc'], short: ['trx', 'btc', 'xrp'] });
  assert.equal(topBottom(ranked.slice(0, 8)).k, 2);
  assert.equal(runBook(coins.slice(0, 5), [MON]).length, 0);
  const w = runBook(coins.slice(0, 6), [MON]);
  assert.equal(w.length, 1); assert.equal(w[0].k, 2); assert.equal(w[0].legs.length, 4);
});

test('the stop: 1R from entry, a touch fills at the stop, an open beyond it at the open, never better', () => {
  const bars = [{ open: 100, high: 101, low: 99, close: 100 }, { open: 100, high: 100.5, low: 97.5, close: 98 }];
  assert.deepEqual(simLeg(bars, [0, 1], 1, 2), { entry: 100, stop: 98, exit: 98, pos: 1, how: 'stop' });
  const g = simLeg([bars[0], { open: 96, high: 97, low: 95, close: 96 }], [0, 1], 1, 2);
  assert.equal(g.how, 'gap'); assert.equal(g.exit, 96);
  const s = simLeg([bars[0], { open: 103, high: 104, low: 102, close: 103 }], [0, 1], -1, 2);
  assert.equal(s.how, 'gap'); assert.equal(s.exit, 103); assert.equal(s.stop, 102);
  const held = simLeg(bars, [0, 1], 1, 5);
  assert.equal(held.how, 'close'); assert.equal(held.exit, 98);
  assert.equal(nightsHeld(held, true), 7);
  assert.equal(nightsHeld({ how: 'stop', pos: 0 }, true), 0);
  assert.equal(nightsHeld({ how: 'stop', pos: 3 }, true), 3);
});

test('a leg pays the CFD round trip and financing, shorts too', () => {
  const c = coin('eth', (d) => 100 + 0.3 * Math.sin(d));
  const l = leg(c, MON, -1), L = leg(c, MON, 1);
  assert.ok(l.costR > 0 && l.finR > 0 && L.finR > 0);
  assert.equal(P.COST, CFD_CRYPTO);
  assert.equal(finRate('btc', -1), 0.075); assert.equal(finRate('eth', -1), 0.10); assert.equal(finRate('doge', -1), 0.15); assert.equal(finRate('sol', 1), 0.15);
  assert.equal(weekR({ legs: [l] }, 0), l.gross);
  assert.equal(weekR({ legs: [l] }, 2), legNet(l, 2));
});

test('Mondays are Mondays and the last one has its Sunday on file', () => {
  const c = coin('btc', () => 100);
  const ms = mondays([c]);
  for (const m of ms) assert.equal(new Date(m * DAY * 1000).getUTCDay(), 1);
  assert.equal(ms.at(-1), MON + 7);
  assert.ok(Math.abs(tOf([1, 2, 3]) - 2 * Math.sqrt(3)) < 1e-12);
});

test('result.json: the pre-registered checks and the verdict agree', () => {
  const c = result.checks, I = result.inSample, O = result.outOfSample;
  assert.equal(c.oosT2, O.net.tMonth >= 2);
  assert.equal(c.isPositive, I.net.meanWeek > 0);
  assert.equal(c.oos2xPositive, O.net2x.meanWeek > 0);
  assert.equal(c.placebo95, result.placebo.beaten >= 38);
  assert.equal(result.placebo.beaten, result.placebo.runs.filter((r) => result.placebo.real > r.meanWeek).length);
  assert.equal(result.placebo.runs.length, 40);
  assert.equal(result.verdict, Object.values(c).every(Boolean) ? 'PASS' : 'FAIL');
  assert.equal(I.net.weeks + O.net.weeks, result.weeks.traded);
  assert.equal(result.weeks.inSample.n, Math.floor(result.weeks.traded / 2));
  assert.equal(I.legs.long, I.legs.short); assert.equal(O.legs.long, O.legs.short);
  assert.equal(result.weekly.length, result.weeks.traded);
});

test('RESULT.md states the verdict and the figures of result.json', () => {
  const I = result.inSample, O = result.outOfSample, f = (v, k = 4) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(k);
  const first = report.split('\n').find((l) => l.startsWith('**Verdict'));
  assert.ok(first.startsWith(`**Verdict: ${result.verdict}`));
  assert.ok(first.replace(/\*\*/g, '').length < 240);
  for (const s of [f(O.net.meanWeek), f(O.net.tMonth, 2), f(I.net.meanWeek), f(I.net.tMonth, 2), f(O.net2x.meanWeek), f(I.net2x.meanWeek),
    f(I.gross.meanWeek), f(O.gross.meanWeek), f(O.gross.tMonth, 2), f(O.net.dd, 2), f(result.placebo.p50), f(result.placebo.p95), `${result.placebo.beaten} of 40`,
    f(O.legs.meanNet), f(I.legs.meanNet), f(O.legs.meanGross), String(O.legs.n), String(I.legs.n), String(result.weeks.traded)])
    assert.ok(report.includes(s), `RESULT.md lacks ${s}`);
  for (const [y, v] of Object.entries(result.byYear)) assert.ok(report.includes(`| ${y} | ${v.weeks} | ${f(v.gross, 2)} | ${f(v.net, 2)} |`), y);
  for (const [k, v] of Object.entries(result.byCoin.inSample)) {
    const o = result.byCoin.outOfSample[k];
    assert.ok(report.includes(`| ${k} | ${v.long} / ${v.short} | ${f(v.netR, 2)} | ${o.long} / ${o.short} | ${f(o.netR, 2)} |`), k);
  }
  for (const [n, lw] of [['1 week', '1w'], ['4 weeks', '4w']]) {
    const v = result.variants[lw];
    assert.ok(report.includes(`| ${n} | ${f(v.inSample.net.meanWeek)} (${f(v.inSample.net.tMonth, 2)}) | ${f(v.outOfSample.net.meanWeek)} (${f(v.outOfSample.net.tMonth, 2)}) |`), n);
  }
  assert.ok(report.includes('crypto-weekly-mom'));
});
