// node --test tests/feed-hysteresis.test.mjs — one missed OANDA read no longer flips a market to Kraken and back (two re-quotes)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { feedDecision, FEED_MISSES } from '../council/feed.mjs';

test('a market on OANDA skips the round on the first miss and falls to Kraken on the second; a good read resets', () => {
  assert.deepEqual(feedDecision({ oandaOk: true, oandaMarket: true, prevFeed: 'oanda', misses: 1 }), { feed: 'OANDA', misses: 0 });
  const m1 = feedDecision({ oandaOk: false, oandaMarket: true, prevFeed: 'oanda', misses: 0 });
  assert.deepEqual(m1, { feed: 'skip', misses: 1 });
  assert.deepEqual(feedDecision({ oandaOk: false, oandaMarket: true, prevFeed: 'oanda', misses: m1.misses }), { feed: 'Kraken', misses: 2 });
  assert.equal(FEED_MISSES, 2);
});
test('no hysteresis where there is nothing to protect: first round, already on Kraken, or a crypto market', () => {
  assert.deepEqual(feedDecision({ oandaOk: false, oandaMarket: true, prevFeed: null, misses: 0 }), { feed: 'Kraken', misses: 1 });
  assert.deepEqual(feedDecision({ oandaOk: false, oandaMarket: true, prevFeed: 'kraken', misses: 0 }), { feed: 'Kraken', misses: 1 });
  assert.deepEqual(feedDecision({ oandaOk: false, oandaMarket: false }), { feed: 'Kraken', misses: 0 });
  assert.deepEqual(feedDecision({ oandaOk: true, oandaMarket: false }), { feed: 'Kraken', misses: 0 });
});
test('the Trader counts misses in state.feedMiss and skips the market on "skip" (wiring pin)', () => {
  const src = fs.readFileSync(new URL('../council/trader.mjs', import.meta.url), 'utf8');
  assert.match(src, /feedDecision\(\{ oandaOk: ok, oandaMarket: true, prevFeed: /); assert.match(src, /FM\[key\] = d\.misses;/);
  assert.match(src, /if \(d\.feed === 'skip'\) \{[^\n]*continue; \}/);
  assert.match(src, /if \(ok\) \{ feed = 'OANDA';/);
});
