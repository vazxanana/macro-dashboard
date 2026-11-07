// Offline tests for council/fills.mjs (the Trader's paper fills): costs, the stale-signal stat and the trade-state helpers.
//   node --test tests/trader-fills.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spreadOf, costOf, FEE, SLIP_SPREADS, STALE_R, costModel, tradeCost, annotateCosts, costSummary, targetExit, limitEntry,
  driftR, backfillDrift, staleStats } from '../council/fills.mjs';

const MK = { xau: { group: 'Metals', spot: true }, eurusd: { group: 'Forex' }, btc: { group: 'Crypto' } };
const SYM = { xau: ['XAUUSD'], eurusd: ['EURUSD'] };
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);

test('costOf is the Backtest model: spread, plus Kraken fees on crypto', () => {
  near(costOf(MK.xau, 4000, false), 0.3);
  near(costOf(MK.eurusd, 1.1, true), 0.0001);
  near(costOf(MK.btc, 100000, false), 100000 * 0.0002 + 100000 * (FEE.taker + FEE.taker));
  near(costOf(MK.btc, 100000, true), 100000 * 0.0002 + 100000 * (FEE.maker + FEE.taker));
});

test('the Backtest imports costOf from fills.mjs (one cost model)', () => {
  const src = fs.readFileSync(new URL('../council/backtest.mjs', import.meta.url), 'utf8');
  assert.match(src, /import \{ spreadOf, costOf\b[^}]*\} from '\.\/fills\.mjs'/);
  assert.doesNotMatch(src, /const costOf =/);
});

test('market entry + stop exit pays the spread and two slippages; limit entry + target exit pays the spread only', () => {
  const sp = spreadOf(MK.xau, 4000), stopT = { entry: 4000, stop: 3990, r0: 10, side: 'buy', status: 'loss', R: -1, rr: 3, opened: 1, filled: 1, entryMode: 'market' };
  near(tradeCost(stopT, MK.xau).costR, (sp + 2 * SLIP_SPREADS * sp) / 10);
  const tgt = { entry: 4000, stop: 3990, r0: 10, side: 'buy', status: 'win', R: 3, rr: 3, opened: 1, filled: 50, exitKind: 'target' };
  assert.equal(limitEntry(tgt), true); assert.equal(targetExit(tgt), true);
  near(tradeCost(tgt, MK.xau).costR, sp / 10);
});

test('targetExit is inferred for older trades (no exitKind): a win at exactly rr with no named exit', () => {
  assert.equal(targetExit({ status: 'win', R: 2.5, rr: 2.5 }), true);
  assert.equal(targetExit({ status: 'win', R: 1.2, rr: 2.5, exit: '48 h' }), false);
  assert.equal(targetExit({ status: 'win', R: 2.5, rr: 2.5, trailMoved: true }), false);
  assert.equal(targetExit({ status: 'win', R: 1.25, rawR: 2.5, size: 0.5, rr: 2.5 }), true);
});

test('broker spread replaces the default; mirror fills replace the entry half-spread + slippage once there are enough', () => {
  const map = {};
  for (let i = 0; i < 5; i++) map['t' + i] = { symbol: 'XAUUSD', side: i % 2 ? 'sell' : 'buy', fillPrice: i % 2 ? 3999.8 : 4000.2, councilEntry: 4000 };
  map.adopted = { symbol: 'XAUUSD', side: 'buy', adopted: true };   // no fill price: ignored
  const m = costModel(MK, { symbols: SYM, brokerInfo: { symbols: { XAUUSD: { spread: 0.2 } } }, mirrorMap: map });
  assert.equal(m.xau.spread, 0.2); assert.equal(m.xau.fills, 5); near(m.xau.entrySlip, 0.2, 1e-6); assert.equal(m.xau.src, 'broker+mirror');
  assert.equal(m.eurusd.src, 'default'); assert.equal(m.eurusd.entrySlip, null);
  const t = { entry: 4000, stop: 3990, r0: 10, side: 'buy', status: 'loss', R: -1, rr: 3, opened: 1, filled: 1 };
  // spread 0.2 - half spread 0.1 + observed entry slip 0.2 + exit slip 0.1
  near(tradeCost(t, MK.xau, m.xau).costR, (0.2 - 0.1 + 0.2 + SLIP_SPREADS * 0.2) / 10);
  const few = costModel(MK, { symbols: SYM, mirrorMap: { a: map.t0 } });
  assert.equal(few.xau.entrySlip, null); assert.equal(few.xau.fills, 1);
});

test('annotateCosts keeps raw R, adds costR and Rnet (x size), and clears them when a trade reopens', () => {
  const T = [
    { market: 'xau', entry: 4000, stop: 3990, r0: 10, side: 'buy', status: 'loss', R: -1, rr: 3, opened: 1, filled: 1, entryMode: 'market', shadow: false },
    { market: 'xau', entry: 4000, stop: 3990, r0: 10, side: 'buy', status: 'loss', R: -0.5, rawR: -1, size: 0.5, rr: 3, opened: 1, filled: 1, entryMode: 'market', shadow: true },
    { market: 'xau', entry: 4000, stop: 3990, side: 'buy', status: 'open', R: null, Rnet: 1, costR: 0.1 },
    { market: 'btc', entry: 100000, stop: 99000, side: 'buy', status: 'missed', R: 0 },
  ];
  annotateCosts(T, MK, {});
  assert.equal(T[0].R, -1); near(T[0].Rnet, -1 - T[0].costR, 0.006); assert.ok(T[0].costR > 0);
  assert.equal(T[1].R, -0.5); near(T[1].Rnet, -0.5 - 0.5 * T[1].costR, 0.006);
  assert.equal(T[2].Rnet, undefined); assert.equal(T[2].costR, undefined);
  assert.equal(T[3].Rnet, undefined);   // never filled: no cost
  const c0 = T[0].costR; T[0].R = -1.3; annotateCosts(T, MK, {}); assert.equal(T[0].costR, c0); near(T[0].Rnet, -1.3 - c0, 0.006);
  const s = costSummary(T, MK);
  assert.equal(s.live.all.n, 1); assert.equal(s.shadow.all.n, 1); assert.ok(s.live.byGroup.Metals.Rnet < s.live.byGroup.Metals.R);
});

test('crypto fees dominate a tight crypto stop', () => {
  const t = { market: 'btc', entry: 100000, stop: 99500, side: 'buy', status: 'loss', R: -1, rr: 2, opened: 1, filled: 1, entryMode: 'market' };
  annotateCosts([t], MK, {});
  assert.ok(t.costR > 1.5, `costR ${t.costR}`);   // 0.8% taker round trip + spread on a 0.5% stop
});

test('driftR: + when price ran on (chasing), - when it came back toward the stop', () => {
  assert.equal(driftR('buy', 100, 101, 96), 0.25);
  assert.equal(driftR('sell', 100, 99, 104), 0.25);
  assert.equal(driftR('buy', 100, 99, 96), -0.25);
  assert.equal(driftR('buy', 100, 101, 100), null);
});

test('staleStats splits fills beyond STALE_R by direction and book, with what they made', () => {
  const T = [
    { drift: 0.4, status: 'loss', R: -1, Rnet: -1.1, shadow: false },
    { drift: -0.3, status: 'win', R: 2, Rnet: 1.8, shadow: true },
    { drift: 0.1, status: 'win', R: 1, Rnet: 0.9, shadow: true },
    { drift: 0.6, status: 'open', R: null, shadow: true },
  ];
  const s = staleStats(T);
  assert.equal(s.X, STALE_R); assert.equal(s.n, 4);
  assert.deepEqual(s.live.chased, { n: 1, closed: 1, R: -1, Rnet: -1.1 });
  assert.deepEqual(s.shadow.better, { n: 1, closed: 1, R: 2, Rnet: 1.8 });
  assert.deepEqual(s.shadow.kept, { n: 1, closed: 1, R: 1, Rnet: 0.9 });
  assert.deepEqual(s.shadow.chased, { n: 1, closed: 0, R: 0, Rnet: 0 });
});

test('backfillDrift uses the planned entry of market fills only', () => {
  const T = [{ side: 'buy', entry: 99, stop: 96, opened: 5, filled: 5, ctx: { planned: 100 } }, { side: 'buy', entry: 100, stop: 96, opened: 5, filled: 9, ctx: { planned: 100 } }];
  backfillDrift(T);
  assert.equal(T[0].drift, -0.25); assert.equal(T[1].drift, undefined);
});
