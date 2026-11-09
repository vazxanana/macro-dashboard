// node --test tests/shadow-cost.test.mjs — the shadow-cost study (research/edge/shadow-cost): the realistic cost model, the mirror
// slippage reader, the pre-registered verdict, and the committed result.json / RESULT.md / proposal staying consistent. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GATE, BROKER, brokerFrom, costParts, costR, mirrorSlippage, stats, judge, groupOf } from '../research/edge/shadow-cost/costmodel.mjs';
import { studyVerdict } from '../research/edge/verdict.mjs';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);
const T = (s) => Date.parse(s) / 1000;
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const LONDON = T('2026-11-04T10:00:00Z'), ROLL = T('2026-11-04T22:30:00Z');   // 05:00 and 17:30 New York (EST)

test('cost parts: forex spread by session + broker commission + slippage only on market orders and non-target exits', () => {
  const eu = { market: 'eurusd', entry: 1.1, t: LONDON, r0: 0.001 };
  const mk = costParts({ ...eu, marketEntry: true, exit: 'stop' });
  near(mk.spread, 0.15e-4); near(mk.comm, 2 * 22.5e-6 * 1.1); near(mk.slip, 0.1e-4 + 0.2e-4);
  near(costR({ ...eu, marketEntry: true, exit: 'stop' }).costR, (0.15e-4 + 4.95e-5 + 3e-5) / 0.001);
  near(costParts({ ...eu, marketEntry: false, exit: 'target' }).total, 0.15e-4 + 4.95e-5, 1e-12);
  near(costParts({ ...eu, marketEntry: false, exit: 'time' }).slip, 0.1e-4);
  near(costParts({ ...eu, t: ROLL, marketEntry: false, exit: 'target' }).spread, 5 * 0.15e-4, 1e-12);   // the 17:00 NY rollover
});

test('cost parts: gold, CME futures, crypto at the broker spread, silver', () => {
  const au = costParts({ market: 'xau', entry: 4000, t: LONDON, marketEntry: true, exit: 'stop' });
  near(au.total, 0.14 + 2 * 12e-6 * 4000 + 0.05 + 0.10);
  const nq = costParts({ market: 'nq', entry: 25000, t: LONDON, marketEntry: true, exit: 'time' });
  near(nq.total, 0.25 + 0.62 + 0.25 + 0.25, 1e-12);   // 1.37 points: the costs study's MNQ round trip
  const sol = costParts({ market: 'sol', entry: 100, t: LONDON, marketEntry: true, exit: 'stop' });
  near(sol.total, 2 * BROKER.cryptoSpread.sol * 100);
  assert.equal(costParts({ market: 'sol', entry: 100, t: LONDON, marketEntry: false, exit: 'target' }).comm, 0);
  assert.ok(costParts({ market: 'xag', entry: 30, t: LONDON, marketEntry: true, exit: 'stop' }).total > 0.025);
  assert.equal(costParts({ market: 'nope', entry: 1, t: LONDON }), null);
  assert.equal(costR({ market: 'xau', entry: 4000, t: LONDON, r0: 0 }), null);
  assert.deepEqual(['eurusd', 'xau', 'xag', 'btc', 'nq', 'gc'].map(groupOf), ['forex', 'gold', 'silver', 'crypto', 'futures', 'futures']);
});

test('brokerFrom reads commission and crypto spreads from ctrader/symbols.json; XRP takes the mean of the others', () => {
  const b = brokerFrom({ symbols: {
    EURUSD: { commission: { preciseRate: 3000000000 } }, XAUUSD: { commission: { preciseRate: 1500000000 } },
    BTCUSD: { spread: 10, bid: 99995, ask: 100005 }, ETHUSD: { spread: 2, bid: 1999, ask: 2001 }, SOLUSD: { spread: 0.1, bid: 99.95, ask: 100.05 } } });
  near(b.commPerSide.forex, 30e-6); near(b.commPerSide.gold, 15e-6); near(b.commPerSide.silver, 15e-6);
  near(b.cryptoSpread.btc, 1e-4); near(b.cryptoSpread.eth, 1e-3); near(b.cryptoSpread.xrp, (1e-4 + 1e-3 + 1e-3) / 3);
  assert.deepEqual(brokerFrom(null).commPerSide, BROKER.commPerSide);
});

test('mirror slippage: same-time market fills only, one per position, multiplier only from 5 fills and only upward', () => {
  const f = (id, o) => [id, { positionId: id, symbol: 'EURUSD', side: 'buy', councilEntry: 1.1, stop: 1.099, slipR: 0.1, lagSec: 60, openedAt: '2026-11-04T10:00:00Z', ...o }];
  const four = Object.fromEntries([f('a'), f('b'), f('c'), f('d'), f('late', { lagSec: 9000 }), f('lim', { viaLimit: true }), f('x', { slipR: null })]);
  let m = mirrorSlippage([four, { a2: four.a }]);
  assert.equal(m.n, 4, 'late copies, limit fills, fills without slipR and a repeated positionId are left out');
  assert.equal(m.groups.forex.used, false); assert.deepEqual(m.mult, {});
  m = mirrorSlippage([{ ...four, ...Object.fromEntries([f('e')]) }]);
  // adverse 0.1R x 0.001 = 1e-4, less half the 0.15-pip spread, over the 0.1-pip default slippage = 9.25x
  assert.equal(m.groups.forex.used, true); near(m.mult.forex, (1e-4 - 0.75e-5) / 1e-5, 1e-6);
  near(costParts({ market: 'eurusd', entry: 1.1, t: LONDON, marketEntry: true, exit: 'target' }, BROKER, m.mult).slip, 1e-4 - 0.75e-5, 1e-12);
  const good = mirrorSlippage([Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map((k) => f(k, { slipR: -0.2 })))]);
  assert.deepEqual(good.mult, {}, 'better-than-model fills never lower the default');
});

test('stats: expectancy, t, win rate, max drawdown of the curve', () => {
  const s = stats([1, -1, 2, -1, -1]);
  assert.equal(s.n, 5); assert.equal(s.exp, 0); assert.equal(s.wr, 0.4); assert.equal(s.maxDD, -2); assert.equal(s.R, 0);
  assert.equal(stats([]).n, 0); assert.equal(stats([1]).t, null);
});

test('judge: the pre-registered bar (cost screen, n >= 30, t >= 2, both halves, x2, live not clearly negative)', () => {
  const mk = (n, R, cost, o = {}) => Array.from({ length: n }, (_, i) => ({ t: 1000 + i, R: R + (i % 2 ? 0.5 : -0.5), cost, live: true, ...o }));
  assert.equal(judge(mk(40, 1, 0.2)).verdict, 'FAIL', 'cost > 0.10R');
  assert.equal(judge(mk(40, 1, 0.2), { gated: true }).verdict, 'PASS', 'gated rows skip the stream-level screen');
  assert.equal(judge(mk(40, 0.05, 0.05)).verdict, 'FAIL', 'net <= 0 on 30+ OOS trades');
  assert.equal(judge(mk(40, 0.6, 0.05)).verdict, 'PASS');
  assert.equal(judge(mk(10, 0.6, 0.05)).verdict, 'INCONCLUSIVE', 'fewer than 30 OOS trades');
  assert.equal(judge(mk(40, 0.2, 0.05)).verdict, 'INCONCLUSIVE', 'positive, t < 2');
  const halves = mk(20, -0.3, 0.05).concat(mk(20, 1.6, 0.05).map((x) => ({ ...x, t: x.t + 100 })));
  assert.equal(judge(halves).verdict, 'INCONCLUSIVE', 'a losing first half blocks a pass');
  assert.equal(judge(mk(40, 0.14, 0.05)).oosX2.exp > 0, true);
  // IS / OOS split: backtest before oosFrom is IS, after it (and every live trade) is OOS; no oosFrom = live only
  const rows = [{ t: 10, R: 1, cost: 0 }, { t: 20, R: 1, cost: 0 }, { t: 30, R: 1, cost: 0, live: true }];
  assert.deepEqual([judge(rows, { oosFrom: 15 }).is.n, judge(rows, { oosFrom: 15 }).oos.n], [1, 2]);
  assert.deepEqual([judge(rows).is.n, judge(rows).oos.n], [2, 1]);
  assert.equal(judge(mk(5, 1, 0.01)).survives, true, 'survives = cost <= 0.10R and net OOS > 0, any n');
  assert.equal(judge(mk(5, 1, 0.01).map((x) => ({ ...x, live: false }))).survives, false, 'no OOS trade, no survival');
  assert.equal(GATE, 0.10);
});

test('committed result.json: one row per stream, verdicts follow the stored numbers, the lab reads it as inconclusive', () => {
  const R = JSON.parse(read('../research/edge/shadow-cost/result.json')), md = read('../research/edge/shadow-cost/RESULT.md');
  const ids = Object.keys(R.streams);
  for (const k of ['nq-trend', 'lit', 'ict-nofri', 'ict-h1opp', 'ict-strail', 'ict-silver', 'ict-dip', 'eng-scalp', 'eng-rscalp', 'eng-intraday', 'eng-rintra', 'eng-swing', 'eng-rswing', 'eng-position', 'eng-m30m1'])
    assert.ok(ids.includes(k), k);
  assert.equal(R.candidates.length, ids.length);
  for (const [id, s] of Object.entries(R.streams)) {
    if (s.reference) { assert.equal(s.verdict, 'REFERENCE'); continue; }
    assert.equal(s.costOk, s.cost.mean <= GATE, id);
    const o = s.oos, want = !s.costOk ? 'FAIL' : o.n >= 30 && o.exp <= 0 ? 'FAIL'
      : o.n >= 30 && o.t >= 2 && s.halves.every((h) => h.exp > 0) && s.oosX2.exp > 0 && (s.live.n < 10 || s.live.t > -2) ? 'PASS' : 'INCONCLUSIVE';
    assert.equal(s.verdict, want, id);
    assert.equal(s.survives, s.costOk && o.n > 0 && o.exp > 0, id);
  }
  assert.deepEqual(R.verdict.survivesProposal3, ids.filter((k) => R.streams[k].survives));
  assert.deepEqual(R.verdict.passGated, ids.filter((k) => !R.streams[k].reference && R.streams[k].gated.verdict === 'PASS'));
  const sv = studyVerdict(R, md);
  assert.equal(sv.verdict, 'inc'); assert.match(sv.headline, /^INCONCLUSIVE/); assert.equal(sv.built, '2026-11-09');
  assert.match(md, /^\*\*Verdict: INCONCLUSIVE/m);
  const prop = read('../research/proposals/2026-11-09-council-edge.md');
  assert.match(prop, /research\/edge\/shadow-cost/); assert.match(prop, /Decisions for you/);
  for (const f of ['../research/edge/shadow-cost/preregistration.md', '../research/edge/shadow-cost/run.mjs']) assert.ok(read(f).length > 500);
});
