// node --test tests/feed-hysteresis.test.mjs — one feed per market: a market leaves OANDA only after FEED_MISSES missed reads in a
// row and comes back only after FEED_BACK good reads in a row (8 Nov; both ways since 12 Nov 2026)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { feedDecision, FEED_MISSES, FEED_BACK } from '../council/feed.mjs';

// a fake OANDA proxy: a list of good / missed reads, run through the decision the way the Trader does round after round
function run(reads, start = 'oanda') {
  let prevFeed = start, misses = 0, oks = 0; const out = [];
  for (const ok of reads) {
    const d = feedDecision({ oandaOk: ok, oandaMarket: true, prevFeed, misses, oks });
    misses = d.misses; oks = d.oks; out.push(d.feed);
    if (d.feed !== 'skip') prevFeed = d.feed === 'OANDA' ? 'oanda' : 'kraken';   // a skipped round leaves state.feedLast as it was
  }
  return out;
}
const switches = (feeds) => { let n = 0, last = 'OANDA'; for (const f of feeds) { if (f === 'skip') continue; if (f !== last) n++; last = f; } return n; };

test('a market on OANDA skips the round on the first misses and falls to Kraken on the FEED_MISSES-th; a good read resets', () => {
  assert.equal(FEED_MISSES, 3); assert.equal(FEED_BACK, 3);
  assert.deepEqual(feedDecision({ oandaOk: true, oandaMarket: true, prevFeed: 'oanda', misses: 2 }), { feed: 'OANDA', misses: 0, oks: 0 });
  assert.deepEqual(feedDecision({ oandaOk: false, oandaMarket: true, prevFeed: 'oanda', misses: 0 }), { feed: 'skip', misses: 1, oks: 0 });
  assert.deepEqual(feedDecision({ oandaOk: false, oandaMarket: true, prevFeed: 'oanda', misses: 1 }), { feed: 'skip', misses: 2, oks: 0 });
  assert.deepEqual(feedDecision({ oandaOk: false, oandaMarket: true, prevFeed: 'oanda', misses: 2 }), { feed: 'Kraken', misses: 3, oks: 0 });
  assert.deepEqual(run([false, false, true, false, false, true]), ['skip', 'skip', 'OANDA', 'skip', 'skip', 'OANDA']);
});
test('a market on Kraken goes back to OANDA only after FEED_BACK good reads in a row; a miss restarts the count', () => {
  assert.deepEqual(feedDecision({ oandaOk: true, oandaMarket: true, prevFeed: 'kraken', oks: 0 }), { feed: 'Kraken', misses: 0, oks: 1 });
  assert.deepEqual(feedDecision({ oandaOk: true, oandaMarket: true, prevFeed: 'kraken', oks: 2 }), { feed: 'OANDA', misses: 0, oks: 0 });
  assert.deepEqual(feedDecision({ oandaOk: false, oandaMarket: true, prevFeed: 'kraken', oks: 2, misses: 4 }), { feed: 'Kraken', misses: 5, oks: 0 });
  assert.deepEqual(run([true, true, false, true, true, true], 'kraken'), ['Kraken', 'Kraken', 'Kraken', 'Kraken', 'Kraken', 'OANDA']);
});
test('the flapping proxy of 9-12 Nov (two misses, a good read, ...): no switch at all now; a real outage costs two switches', () => {
  // the old rule (fall on the 2nd miss, back on the 1st good read) switched twice for every "miss, miss, ok"
  const flap = Array.from({ length: 20 }, () => [false, false, true]).flat();
  assert.equal(switches(run(flap)), 0);
  const outage = [...Array(10).fill(false), true, false, true, true, true, ...Array(5).fill(true)];
  const f = run(outage);
  assert.equal(switches(f), 2); assert.equal(f.indexOf('Kraken'), FEED_MISSES - 1); assert.equal(f.lastIndexOf('Kraken'), 13);
});
test('no hysteresis where there is nothing to protect: first round, or a crypto market', () => {
  assert.deepEqual(feedDecision({ oandaOk: false, oandaMarket: true, prevFeed: null, misses: 0 }), { feed: 'Kraken', misses: 1, oks: 0 });
  assert.deepEqual(feedDecision({ oandaOk: true, oandaMarket: true, prevFeed: null }), { feed: 'OANDA', misses: 0, oks: 0 });
  assert.deepEqual(feedDecision({ oandaOk: false, oandaMarket: false }), { feed: 'Kraken', misses: 0, oks: 0 });
  assert.deepEqual(feedDecision({ oandaOk: true, oandaMarket: false }), { feed: 'Kraken', misses: 0, oks: 0 });
});
test('the Trader counts misses and good reads, retries a timeframe once, and takes OANDA only on the decision (wiring pin)', () => {
  const src = fs.readFileSync(new URL('../council/trader.mjs', import.meta.url), 'utf8');
  assert.match(src, /feedDecision\(\{ oandaOk: ok, oandaMarket: true, prevFeed: [^\n]*oks: FO\[key\] \|\| 0 \}\)/); assert.match(src, /FM\[key\] = d\.misses; FO\[key\] = d\.oks;/);
  assert.match(src, /if \(d\.feed === 'skip'\) \{[^\n]*continue; \}/);
  assert.match(src, /if \(d\.feed === 'OANDA'\) \{ feed = 'OANDA';/);
  assert.match(src, /if \(!got\[id\]\) \{ await sleep\(1500\); got\[id\] = await oandaBars\(key, id\); \}/);
});
