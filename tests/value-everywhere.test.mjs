// Value everywhere study (research/edge/value-everywhere): offline checks of the value score (no look-ahead), the thirds, the
// stop, the costs, Holm, and the written report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  indexMarket, valueScore, momentum, rankAt, thirds, simLeg, leg, shiftYm, monthsBetween, groupBook, monthR, series, holm, pTwo, P,
} from '../research/edge/value-everywhere/run.mjs';

const dir = new URL('../research/edge/value-everywhere/', import.meta.url);
const result = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const report = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');

// a hand-made market: candles on the 2nd, 15th and 27th of each month, closes from closeOf(month index, day)
function market(key, group, closeOf, from = '2010-01', to = '2016-06') {
  const bars = []; let mi = 0;
  for (const m of monthsBetween(from, to)) {
    for (const d of [2, 15, 27]) {
      const t = Date.UTC(+m.slice(0, 4), +m.slice(5) - 1, d) / 1000, c = closeOf(mi, d);
      bars.push({ time: t, open: c, high: c * 1.001, low: c * 0.999, close: c });
    }
    mi++;
  }
  return indexMarket(key, group, bars);
}

test('value = mean log of month-end closes 54..66 months back minus log close now; nothing after S is read', () => {
  const S = '2016-01', iS = 72; // month index of 2016-01 from 2010-01
  const mk = market('xcu', 'commodities', (mi) => 100 + mi);
  let s = 0; for (let k = 54; k <= 66; k++) s += Math.log(100 + iS - k);
  assert.ok(Math.abs(valueScore(mk, S) - (s / 13 - Math.log(100 + iS))) < 1e-12);
  // a price fallen over five years scores higher (cheaper) than one that rose
  const fell = market('a', 'commodities', (mi) => 200 - mi), rose = market('b', 'commodities', (mi) => 100 + mi);
  assert.ok(valueScore(fell, S) > 0 && valueScore(rose, S) < 0);
  // changing every price after month S leaves the score alone
  const mk2 = market('xcu', 'commodities', (mi) => (mi > iS ? 1 : 100 + mi));
  assert.equal(valueScore(mk2, S), valueScore(mk, S));
  // 66 months of history are needed
  assert.equal(valueScore(mk, shiftYm('2010-01', 65)), null);
  assert.notEqual(valueScore(mk, shiftYm('2010-01', 66)), null);
  // momentum reads M-12 and M-1 only
  assert.equal(momentum(mk, S), (100 + iS - 1) / (100 + iS - 12) - 1);
});

test('thirds: the cheapest third long, the dearest third short; under 9 scored, no book', () => {
  const keys = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
  const mks = keys.map((k, j) => market(k, 'commodities', (mi) => 100 * (1 + (j - 5) * 0.005) ** mi));
  const ranked = rankAt(mks, '2016-01', 'value');
  assert.deepEqual(ranked, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']); // a fell most = cheapest
  assert.deepEqual(thirds(ranked), { long: ['a', 'b', 'c'], short: ['h', 'i', 'j'] });
  assert.deepEqual(thirds(ranked.slice(0, 9)), { long: ['a', 'b', 'c'], short: ['g', 'h', 'i'] });
  assert.equal(groupBook(mks.slice(0, 8), ['2016-02'], 'value').size, 0);
  const b = groupBook(mks, ['2016-02'], 'value').get('2016-02');
  assert.equal(b.legs.length, 6);
  assert.deepEqual(b.long, ['a', 'b', 'c']);
  assert.ok(P.MIN_SCORED === 9 && P.V_FROM === 54 && P.V_TO === 66 && P.ATR_MULT === 3);
});

test('the stop: 1R from the entry, a touch fills at the stop, an open beyond it at the open', () => {
  const b0 = { time: 0, open: 100, high: 101, low: 99, close: 100 };
  assert.deepEqual(simLeg([b0, { time: 86400, open: 100, high: 100, low: 97, close: 98 }], 0, 1, 1, 2), { entry: 100, stop: 98, exit: 98, exitIdx: 1, how: 'stop' });
  const g = simLeg([b0, { time: 86400, open: 96, high: 97, low: 95, close: 96 }], 0, 1, 1, 2);
  assert.equal(g.how, 'gap'); assert.equal(g.exit, 96);
  const s = simLeg([b0, { time: 86400, open: 103, high: 104, low: 102, close: 103 }], 0, 1, -1, 2);
  assert.equal(s.how, 'gap'); assert.equal(s.exit, 103);
  assert.equal(simLeg([b0, { time: 86400, open: 100, high: 100.5, low: 99.5, close: 100.2 }], 0, 1, 1, 5).how, 'close');
});

test('a leg is 3 x ATR(20) wide and pays the group cost and financing; the book mixes groups equally', () => {
  const mkI = market('spx500', 'indices', (mi) => 1000 + mi * 3);
  const l = leg(mkI, '2015-06', '2015-07', 1);
  assert.ok(l.costR > 0 && l.finR > 0);
  // index: 0.04 % of the entry against 3 % a year a night, both over the same 1R
  assert.ok(Math.abs(l.costR / l.finR - 0.0004 / (l.nights * 0.03 / 365)) < 1e-9);
  // gold: a fixed $0.30 round trip; entry = the first open of 2015-07 (month index 66 from 2010-01)
  const mkG = market('xau', 'commodities', (mi) => 1500 + mi);
  const lg = leg(mkG, '2015-06', '2015-07', -1);
  assert.ok(Math.abs(lg.costR / lg.finR - 0.30 / (lg.nights * 0.03 / 365 * 1566)) < 1e-9);
  const a = new Map([['2015-07', { legs: [{ gross: 1, costR: 0, finR: 0 }] }]]), b = new Map([['2015-07', { legs: [{ gross: -0.5, costR: 0.1, finR: 0.1 }] }], ['2015-08', { legs: [{ gross: 2, costR: 0, finR: 0 }] }]]);
  const s = series([a, b]);
  assert.equal(s.length, 1);
  assert.ok(Math.abs(s[0].r(1) - (1 + -0.7) / 2) < 1e-12);
  assert.ok(Math.abs(s[0].r(0) - 0.25) < 1e-12);
  assert.ok(Math.abs(monthR({ legs: [{ gross: 1, costR: 0.1, finR: 0.2 }] }, 2) - 0.4) < 1e-12);
});

test('Holm and the two-sided p', () => {
  assert.ok(Math.abs(pTwo(1.96) - 0.05) < 1e-3);
  const adj = holm([0.01, 0.04, 0.03, 0.5]);
  assert.deepEqual(adj.map((x) => +x.toFixed(4)), [0.04, 0.09, 0.09, 0.5]);
});

test('result.json: FAIL, the windows, and the report quotes it', () => {
  assert.equal(result.study, 'value-everywhere');
  assert.equal(result.verdict, 'FAIL');
  assert.deepEqual(result.pass, { T1: false, T2: false, T3: false, T4: false });
  assert.equal(result.firstBookMonth.T1, '2010-08');
  const T1 = result.tests.T1;
  assert.equal(T1.oos.net.n, 118); assert.equal(T1.inSample.net.n, 77);
  const line = report.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(line && line.length < 300);
  assert.match(line, /FAIL/);
  assert.ok(line.includes(T1.oos.net.mean.toFixed(3)));
  assert.ok(line.includes(`t ${T1.oos.net.t.toFixed(2)}`));
  assert.ok(line.includes(`t ${T1.inSample.net.t.toFixed(2)}`));
  const fmt = (v) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(3);
  for (const n of ['T1', 'T2', 'T3', 'T4']) {
    const T = result.tests[n];
    assert.ok(report.includes(fmt(T.oos.net.mean)), `${n} OOS mean in report`);
    assert.ok(report.includes(fmt(T.oos.net2x.mean)), `${n} 2x in report`);
    assert.ok(report.includes(`${fmt(T.oos.net.t).replace(/(\.\d\d)\d$/, '$1')}`), `${n} OOS t in report`);
    assert.ok(report.includes(`${result.placebo[n].beaten} of 40`), `${n} placebo in report`);
    assert.equal(result.placebo[n].of, 40);
  }
  // no model names, and FX not among the markets
  assert.ok(!Object.values(result.universe).flat().some((k) => /usd|eur|gbp|jpy/.test(k) && k !== 'xaueur'));
});
