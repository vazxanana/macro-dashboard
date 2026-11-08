// node --test tests/spotcheck-feed.test.mjs — the spot check judges only Kraken-era trades: a trade managed on OANDA candles
// walked through OANDA candles again is the same feed judging itself (feed switch 7 Nov 16:01 UTC)
import test from 'node:test';
import assert from 'node:assert/strict';
import { judge, judgeable, krakenEra, summarize } from '../council/spotcheck.mjs';

const bars = Array.from({ length: 40 }, (_, i) => ({ time: 1000 + i * 300, high: 100 + (i >= 20 ? 3 : 0), low: 99 }));
const T = (id, extra = {}) => ({ id, market: 'xau', side: 'buy', entry: 100, stop: 98, t1: 102, rr: 1, filled: 1000 + 12 * 300, closed: bars.at(-1).time, status: 'loss', ...extra });

test('krakenEra: untagged (pre-tag) and kraken trades are judged, oanda trades are not', () => {
  assert.equal(krakenEra(T('a')), true); assert.equal(krakenEra(T('b', { feed: 'kraken' })), true); assert.equal(krakenEra(T('c', { feed: 'oanda' })), false);
  assert.equal(judgeable(T('a')), true);
});
test('summarize: the same-feed trades are counted, not judged, and never move liveR / spotR', () => {
  const s = summarize([T('k1'), T('k2', { feed: 'kraken' }), T('o1', { feed: 'oanda' }), T('o2', { feed: 'oanda', status: 'win' })], { xau: bars });
  assert.equal(s.xau.n, 2); assert.equal(s.xau.sameFeed, 2);
  assert.equal(judge(T('k1'), bars), 'win');   // spot reached the target the live (Kraken) record did not
  assert.equal(s.xau.liveLossSpotWin, 2); assert.equal(s.xau.liveR, -2); assert.equal(s.xau.spotR, 2);
});
