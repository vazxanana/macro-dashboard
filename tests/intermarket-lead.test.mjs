// intermarket-lead: the rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as L from '../research/edge/intermarket-lead/run.mjs';

const dir = new URL('../research/edge/intermarket-lead/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));

// daily candles from 2020-01-01, close path given by fn(i); one candle a weekday
function market(key, n, fn, wig = 1) {
  const bars = [];
  let t = Date.UTC(2020, 0, 1) / 1000, i = 0;
  while (bars.length < n) {
    const wd = new Date(t * 1000).getUTCDay();
    if (wd !== 0 && wd !== 6) { const c = fn(i), o = i ? bars[i - 1].close : c; bars.push({ time: t, open: o, high: Math.max(o, c) + wig, low: Math.min(o, c) - wig, close: c }); i++; }
    t += 86400;
  }
  return L.indexMarket(key, bars);
}

test('month return and sides read only closes of S and S-1', () => {
  const mk = market('spx500', 120, (i) => 100 + i);
  const S = '2020-02', a = mk.bars[mk.last.get('2020-01')].close, b = mk.bars[mk.last.get('2020-02')].close;
  assert.equal(L.monthRet(mk, S), b / a - 1);
  // change every price after S: the signal does not move
  const after = mk.last.get(S) + 1, copy = { ...mk, bars: mk.bars.map((x, i) => (i >= after ? { ...x, close: 1, open: 1, high: 2, low: 0.5 } : x)) };
  assert.equal(L.monthRet(copy, S), L.monthRet(mk, S));
  const M = { mk: { spx500: mk }, pairs: {} };
  assert.equal(L.leaderSide(L.FAMILIES.F1, M, S), 1);
  assert.equal(L.ownSide(mk, S), 1);
});

test('USD basket: a rising dollar gives positive, F3 inverts to short metals', () => {
  const pairs = {};
  for (const [k, s] of Object.entries(L.USD_PAIRS)) pairs[k] = market(k, 80, (i) => (s > 0 ? 100 + i * 0.1 : 100 - i * 0.1), 0.01);
  const b = L.usdBasket(pairs, '2020-02');
  assert.ok(b > 0);
  assert.equal(L.leaderSide(L.FAMILIES.F3, { mk: {}, pairs }, '2020-02'), -1);
  delete pairs.usdchf;
  assert.equal(L.usdBasket(pairs, '2020-02'), null);
});

test('every leg has a stop at 3 x ATR(20) on the losing side, a gap fills at the open', () => {
  const mk = market('de40', 120, (i) => 100 + (i % 2), 1);
  const S = '2020-02', H = '2020-03', d = mk.last.get(S), a = L.atr(mk.bars, d);
  const lg = L.leg(mk, S, H, 1);
  assert.ok(lg && lg.how === 'close');
  const e = mk.first.get(H), x = mk.last.get(H);
  const sim = L.simLeg(mk.bars, e, x, -1, 3 * a);
  assert.ok(sim.stop > sim.entry);
  // a gap through a long stop fills at the open, never at the stop
  const bars = mk.bars.map((b, i) => (i === e + 2 ? { ...b, open: 50, low: 49, high: 51, close: 50 } : b));
  const g = L.simLeg(bars, e, x, 1, 3 * a);
  assert.equal(g.how, 'gap');
  assert.equal(g.exit, 50);
  // costs: index 0.04 % of price, gold flat $0.30
  assert.equal(L.costOf('de40', 1000), 0.4);
  assert.equal(L.costOf('xau', 4000), 0.3);
});

test('placebo and own signals run the same legs; Holm is step-down', () => {
  const M = { mk: { spx500: market('spx500', 200, (i) => 100 - i * 0.2), de40: market('de40', 200, (i) => 100 + i * 0.2) }, pairs: {} };
  const fam = { leader: 'spx500', followers: ['de40'], invert: false };
  const lead = L.runFamily(fam, M, ['2020-04'], 'leader'), own = L.runFamily(fam, M, ['2020-04'], 'own');
  assert.equal(lead[0].legs[0].side, -1);
  assert.equal(own[0].legs[0].side, 1);
  assert.deepEqual(L.holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  assert.ok(Math.abs(L.normSf(1.96) - 0.025) < 1e-3);
});

test('result.json matches the pre-registered design and RESULT.md is the report of it', () => {
  assert.equal(R.study, 'intermarket-lead');
  assert.deepEqual(R.windows, { is: { from: '2004-01', to: '2016-12' }, oos: { from: '2017-01', to: '2026-10' } });
  assert.equal(R.families.F1.followers.length, 10);
  assert.equal(R.tests.length, 6);
  for (const x of R.tests) assert.ok(x.holm >= x.p);
  for (const id of ['F1', 'F2', 'F3']) {
    const F = R.families[id], c = R.checks[id];
    assert.equal(c.isPositive, F.lead.is.net.mean > 0);
    assert.equal(c.oos2xPositive, F.lead.oos.net2x.mean > 0);
    assert.equal(F.placebo.runs.length, 40);
  }
  assert.equal(R.verdict, R.checks.F1.pass ? 'PASS' : 'FAIL');
  const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
  assert.equal(md, L.report(R));
  const h = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(h.includes(R.verdict) && h.length < 220, h);
});
