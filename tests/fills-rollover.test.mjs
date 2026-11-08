// node --test tests/fills-rollover.test.mjs: the 17:00 New York rollover minutes fill and stop nothing on gold / forex (owner, 7 Nov)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spotRollover, spotSkip, spotClosed } from '../council/fills.mjs';
const T = (s) => Date.parse(s) / 1000;
test('rollover: 17:00-17:14 New York Monday to Thursday, in EDT and EST', () => {
  assert.equal(spotRollover(T('2026-08-12T21:04:00Z')), true);    // Wed 17:04 EDT: the USD/CHF spike from #520
  assert.equal(spotRollover(T('2026-08-12T21:05:00Z')), true);    // 17:05: the first candle after OANDA's pause carries the spike
  assert.equal(spotRollover(T('2026-08-12T21:15:00Z')), false);   // 17:15: trades again
  assert.equal(spotRollover(T('2026-08-12T20:59:00Z')), false);
  assert.equal(spotRollover(T('2026-11-10T22:00:00Z')), true);    // Tue 17:00 EST
  assert.equal(spotRollover(T('2026-11-13T22:02:00Z')), false);   // Friday 17:02 is the weekend close (spotClosed), not rollover
  assert.equal(spotSkip(T('2026-11-13T22:02:00Z')), true);
  assert.equal(spotRollover(T('2026-11-08T22:01:00Z')), false);   // Sunday 17:01: the real reopen, its gap is a real gap
  assert.equal(spotSkip(T('2026-11-08T22:01:00Z')), false);
  assert.equal(spotSkip(T('2026-11-07T15:00:00Z')), spotClosed(T('2026-11-07T15:00:00Z')));
});
test('the live Trader and the replay both use spotSkip', () => {
  assert.match(fs.readFileSync(new URL('../council/trader.mjs', import.meta.url), 'utf8'), /spotSkip\(b\.time\)\) continue/);
  assert.match(fs.readFileSync(new URL('../council/backtest.mjs', import.meta.url), 'utf8'), /const shut = M\.group !== 'Crypto' && spotSkip\(b\.time\)/);
});
