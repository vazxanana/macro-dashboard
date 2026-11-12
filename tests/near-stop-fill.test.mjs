// node --test tests/near-stop-fill.test.mjs: near-stop market fills (12 Nov 2026, owner approved: docs/owner-decisions.md item 52).
// The engine plans every stop at least the minimum stop max(minRisk x ATR(14) of the lower timeframe, 5 spreads) from the PLANNED
// entry; a setup taken at market fills at the price of the moment, which can sit much nearer the stop. The same floor is checked
// on the fill: inside it, or past the stop / target, the order is not opened (status 'skipped', reason 'fill-near-stop'), never
// counted as a trade, and the stop is never moved. Offline: the Trader's entry block is lifted from council/trader.mjs as text.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { atrN, minStopDist, fillCheck, fillCheckText, NEAR_STOP, spreadOf, driftR } from '../council/fills.mjs';
import { atrOf } from '../council/review.mjs';
import { bookTrades } from '../council/forward.mjs';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const TRADER = read('../council/trader.mjs'), ENGINE = read('../council/engine.mjs'), BT = read('../council/backtest.mjs'), MIRROR = read('../council/ctrader-mirror.mjs');

function bars(n, seed = 7, px = 0.68, step = 0.0004) {
  let x = seed; const rnd = () => ((x = (x * 16807) % 2147483647) / 2147483647); const out = [];
  for (let i = 0; i < n; i++) { const o = px; px += (rnd() - 0.5) * step; out.push({ time: 1794450000 + 60 * i, open: o, high: Math.max(o, px) + rnd() * step / 3, low: Math.min(o, px) - rnd() * step / 3, close: px }); }
  return out;
}

test('atrN is the engine\'s ATR (review.mjs atrOf, the one entryContext records) and minStopDist is its floor', () => {
  for (const seed of [1, 2, 3, 99]) { const b = bars(60, seed); assert.ok(Math.abs(atrN(b) - atrOf(b)) < 1e-15); }
  const b = bars(40), a = atrN(b);
  assert.equal(minStopDist(b, 0.0001, 1.1), Math.max(1.1 * a, 0.0005));
  assert.equal(minStopDist(b, 1, 0.6), 5, 'a quiet market: 5 spreads');
  // the engine applies exactly this floor to the planned entry (buildSetup and buildRetrace)
  assert.equal(ENGINE.split('const floor = Math.max(CFG.minRisk * atr(lp.bars), 5 * spr);').length - 1, 2, 'engine.mjs: the minimum stop formula changed; change fills.mjs minStopDist with it');
  assert.match(ENGINE, /function atr\(bars, n = 14\)/);
});

test('fillCheck: inside the floor, on or past the stop, past the target; a fill exactly at the floor opens', () => {
  // the 11 Nov AUD/USD retrace buy: planned 0.68490, stop 0.68432, filled 0.68436 (0.4 pip) with a 5-pip floor
  assert.equal(fillCheck('buy', 0.68436, 0.68432, 0.6870, 0.0005), NEAR_STOP);
  assert.equal(fillCheck('buy', 0.68490, 0.68432, 0.6870, 0.0005), null, 'the planned entry is outside the floor');
  assert.equal(fillCheck('buy', 0.68482, 0.68432, 0.6870, 0.0005), null, 'exactly at the floor (float noise ignored)');
  assert.equal(fillCheck('buy', 0.68432, 0.68432, 0.6870, 0.0005), 'past-stop');
  assert.equal(fillCheck('buy', 0.68400, 0.68432, 0.6870, 0.0005), 'past-stop');
  assert.equal(fillCheck('buy', 0.68710, 0.68432, 0.6870, 0.0005), 'past-target');
  assert.equal(fillCheck('sell', 1.3270, 1.3274, 1.3200, 0.0005), NEAR_STOP);
  assert.equal(fillCheck('sell', 1.3260, 1.3274, 1.3200, 0.0005), null);
  assert.equal(fillCheck('sell', 1.3275, 1.3274, 1.3200, 0.0005), 'past-stop');
  assert.equal(fillCheck('sell', 1.3190, 1.3274, 1.3200, 0.0005), 'past-target');
  assert.equal(fillCheck('buy', 0.68436, 0.68432, 0.6870, NaN), null, 'no floor known: only the stop and target checks');
  assert.match(fillCheckText(NEAR_STOP, { dec: 5 }, 0.68436, 0.0005), /minimum stop.*fill-near-stop/);
});

// ─── the Trader's market-fill block, lifted as text and run ───
const A = TRADER.indexOf('      if (mkt) {'), B = TRADER.indexOf('      // m30m1 (M30 → M1) fires on the same M1 entry');
assert.ok(A > 0 && B > A, 'trader.mjs: the market-fill block moved');
const BLOCK = TRADER.slice(A, B);
const run = new Function('mkt', 'mktEntry', 'tr', 't', 'price', 'src', 'def', 'M', 'CFG', 'now', 'minStopDist', 'spreadOf', 'fillCheck', 'fillCheckText', 'driftR', BLOCK);
function take(entry, stop, t1, price, b, minRisk = 1.1) {
  const sell = stop > entry, t = { entry, stop, t1, sell, rr: Math.abs(t1 - entry) / Math.abs(entry - stop) };
  const tr = { id: 'x', market: 'audusd', side: sell ? 'sell' : 'buy', entry, stop, t1, rr: t.rr, opened: 1794450443, checked: 1794450443, status: 'pending', R: null };
  run(true, false, tr, t, price, { '5m': { bars: b } }, { l: '5m' }, { group: 'Forex', dec: 5 }, { minRisk }, 1794450443, minStopDist, spreadOf, fillCheck, fillCheckText, driftR);
  return tr;
}

test('the Trader does not open a market fill inside the minimum stop; the stop and the planned entry stay as they were', () => {
  const b = bars(60, 3, 0.6845, 0.00001);   // a quiet tape: the 5-spread floor (0.0005) decides
  const tr = take(0.68490, 0.68432, 0.6870, 0.68436, b);
  assert.equal(tr.status, 'skipped'); assert.equal(tr.reason, NEAR_STOP);
  assert.equal(tr.stop, 0.68432, 'the stop is never moved'); assert.equal(tr.entry, 0.68490, 'the planned entry is kept');
  assert.equal(tr.fillPx, 0.68436); assert.equal(tr.R, 0); assert.equal(tr.closed, 1794450443);
  assert.equal(tr.filled, undefined, 'never filled'); assert.equal(tr.r0, undefined); assert.equal(tr.drift, undefined, 'not a fill: no drift for the stale-signal stat');
  assert.ok(Math.abs(tr.minStop - 0.0005) < 1e-12);
  // past the stop: also not filled (before 12 Nov such a record carried the fill time and the fill price)
  const p = take(0.68490, 0.68432, 0.6870, 0.68420, b);
  assert.equal(p.status, 'skipped'); assert.equal(p.reason, 'past-stop'); assert.equal(p.filled, undefined); assert.equal(p.stop, 0.68432);
});

test('a market fill outside the floor opens as before, with its opening risk stamped as r0', () => {
  const b = bars(60, 3, 0.6845, 0.00001);
  const tr = take(0.68490, 0.68432, 0.6870, 0.68500, b);
  assert.equal(tr.status, 'open'); assert.equal(tr.entry, 0.68500); assert.equal(tr.filled, 1794450443);
  assert.ok(Math.abs(tr.r0 - 0.00068) < 1e-12); assert.equal(tr.stop, 0.68432);
  assert.equal(tr.rr, +((0.6870 - 0.68500) / 0.00068).toFixed(2));
  assert.equal(tr.drift, driftR('buy', 0.68490, 0.68500, 0.68432));
  // a volatile tape raises the floor above the planned risk: a slightly better fill is then skipped too
  const v = bars(60, 3, 0.6845, 0.004), fl = minStopDist(v, 0.0001, 1.1);
  const near = take(0.68490, 0.68490 - fl, 0.70, 0.68490 - fl / 2, v);
  assert.equal(near.status, 'skipped'); assert.equal(near.reason, NEAR_STOP);
  const at = take(0.68490, 0.68490 - fl, 0.70, 0.68490, v);
  assert.equal(at.status, 'open');
});

test('the replay applies the same check to its market fills and its at-market twins', () => {
  assert.match(BT, /import \{[^}]*minStopDist, fillCheck[^}]*\} from '\.\/fills\.mjs'/);
  assert.match(BT, /const floor = minStopDist\(src\[def\.l\]\.bars, spreadOf\(M, price\), CFG\.minRisk\);/);
  assert.equal(BT.split('if (fillCheck(side, price, st.stop, st.t1, floor)) continue;').length - 1, 2);
  assert.match(TRADER, /const floor = minStopDist\(src\[def\.l\]\.bars, spreadOf\(M, price\), CFG\.minRisk\)/);
});

test('a skipped record is never a trade: the mirror copies only open / pending, the forward record and the tallies leave it out', () => {
  assert.match(MIRROR, /const OPEN = new Set\(\['open'\]\)/);
  assert.match(MIRROR, /\(OPEN\.has\(t\.status\) \|\| \(t\.status === 'pending'/);
  const rec = { id: 'xau-gtrend-1', k: 'gtrend', market: 'xau', side: 'buy', status: 'skipped', reason: NEAR_STOP, opened: 1794500000, closed: 1794500000, R: 0, entry: 4000, stop: 3990, t1: 4100 };
  assert.equal(bookTrades([rec]).length, 0);
  // every tally of closed trades counts win / loss / be only
  for (const f of ['digest', 'fills', 'decay', 'book']) assert.match(read(`../council/${f}.mjs`), /const DONE = new Set\(\['win', 'loss', 'be'\]\)/);
  assert.match(read('../api/_edge-analyst.js'), /x\.status === 'skipped'/);
  assert.match(read('../market-structure.html'), /x\.status !== 'expired' && x\.status !== 'skipped'\)/);
});
