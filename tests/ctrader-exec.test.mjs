// node --test tests/ctrader-exec.test.mjs — demo fill vs council paper entry (slippage in R, delay)
import test from 'node:test';
import assert from 'node:assert/strict';
import { fillQuality, executionStats } from '../council/ctrader-mirror.mjs';
import { deskSection } from '../council/analyst.mjs';
test('slippage is in R and signed so that positive is worse than paper', () => {
  assert.deepEqual(fillQuality({ side: 'buy', entry: 100, stop: 98, filled: 1000 }, 100.5, 1030), { fillPrice: 100.5, slipR: 0.25, lagSec: 30 });
  assert.equal(fillQuality({ side: 'sell', entry: 100, stop: 102 }, 100.5, 0).slipR, -0.25);   // sold higher: better
  assert.deepEqual(fillQuality({ side: 'buy', entry: 100, stop: 100 }, 101, 0), {});
  assert.deepEqual(fillQuality({ side: 'buy', entry: 100, stop: 99 }, null, 0), {});
});
test('execution stats: mean, median, worst, per symbol; positions without a fill are left out', () => {
  const map = { a: { symbol: 'XAUUSD', slipR: 0.1, lagSec: 20, openedAt: '2026-11-09T00:00:00Z' }, b: { symbol: 'XAUUSD', slipR: -0.05, lagSec: 40, openedAt: '2026-11-09T00:00:00Z' },
    c: { symbol: 'EURUSD', slipR: 0.3, lagSec: 30, openedAt: '2026-11-09T00:00:00Z' }, d: { symbol: 'EURUSD', status: 'sent', openedAt: '2026-11-09T00:00:00Z' } };
  const x = executionStats(map);
  assert.equal(x.n, 3); assert.equal(x.meanSlipR, 0.117); assert.equal(x.medianSlipR, 0.1); assert.equal(x.worstSlipR, 0.3); assert.equal(x.medianLagSec, 30);
  assert.deepEqual(x.bySymbol.XAUUSD, { n: 2, meanSlipR: 0.025 });
  assert.deepEqual(executionStats({}), { n: 0 });
  const md = deskSection({ mirror: { state: { status: 'ok', map }, execution: x }, now: 1794200000 });
  assert.match(md, /Execution vs paper:\*\* 3 demo fills; slippage against the council entry \+0\.12R/);
});
// review (7 Nov): the ICT desk signals on CME futures (NQ / ES / YM / RTY / GC) and the demo fills the cash index / spot gold CFD,
// so its paper entry is on another instrument: fill - entry is the futures-cash basis (often several R), not slippage
test('ICT desk fills: no slippage against a futures entry (basis); the delay is still measured', () => {
  const ict = { id: 'ict:nq-b-1', side: 'buy', entry: 25150, stop: 25100, opened: 1000 };
  assert.deepEqual(fillQuality(ict, 24990.5, 1090), { fillPrice: 24990.5, lagSec: 90 });   // was slipR -3.19 (the basis)
  const map = { a: { symbol: 'XAUUSD', slipR: 0.1, lagSec: 20, openedAt: '2026-11-09T00:00:00Z' }, n: { symbol: 'US100', fillPrice: 24990.5, lagSec: 90, openedAt: '2026-11-09T00:00:00Z' } };
  const x = executionStats(map); assert.equal(x.n, 1); assert.equal(x.meanSlipR, 0.1); assert.equal(x.bySymbol.US100, undefined); assert.equal(x.medianLagSec, 55);
  assert.deepEqual(executionStats({ n: map.n }), { n: 0, medianLagSec: 90 });
  assert.equal(executionStats({ a: { ...map.a, lagSec: null } }).medianLagSec, null);   // a missing delay is not a 0 s delay
});
