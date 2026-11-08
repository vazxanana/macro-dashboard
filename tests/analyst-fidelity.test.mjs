// node --test tests/analyst-fidelity.test.mjs: the Analyst reports research/fidelity.json (7 Nov)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fidelitySection, FID_START, FID_END, injectSection } from '../council/analyst.mjs';
const now = Date.parse('2026-11-07T22:00:00Z') / 1000;
const fid = { at: '2026-11-07T21:25:58Z', window: { from: '2026-11-01T20:09:19Z', to: '2026-11-07T21:04:00Z' },
  counts: { live: 651, matched: 236, comparableLive: 616 }, matchRate: { liveInReplay: 0.363, comparable: { liveInReplay: 0.383 } },
  agreement: { outcome: { bothClosed: 180, signRate: 0.883 } }, sameFeed: { live: 103, liveInReplay: 0.767, bothClosed: 58, signRate: 0.948, meanLiveR: 0.203, meanReplayR: -0.202 },
  unmatchedLive: { n: 415, reasons: [{ cls: 'feed differs', n: 255 }, { cls: 'data feed', n: 39 }] },
  perMarket: { xau: { replayFeed: 'OANDA', liveFeeds: { OANDA: 3 } } },
  liveRunGaps: [{ from: '2026-11-07T10:59:47Z', to: '2026-11-07T16:31:59Z', hours: 5.5 }, { from: '2026-11-01T01:00:00Z', to: '2026-11-01T03:00:00Z', hours: 2 }] };
test('the section reports same-feed and overall match, reasons, feeds and recent loop gaps', () => {
  const s = fidelitySection({ fid, now });
  assert.ok(s.startsWith(FID_START) && s.endsWith(FID_END));
  assert.match(s, /found 77% of 103 live signals/); assert.match(s, /same sign 95%/);
  assert.match(s, /38% of comparable live signals found \(236 matched of 616\)/);
  assert.match(s, /feed differs 255, data feed 39 \(of 415\)/);
  assert.match(s, /xau OANDA \/ live OANDA/);
  assert.match(s, /11-07 10:59 for 5.5 h/); assert.doesNotMatch(s, /11-01 01:00/);   // older than 48 h: left out
  assert.doesNotMatch(s, /h old/);
});
test('a stale or missing report says so; the block injects into the analysis', () => {
  assert.match(fidelitySection({ fid, now: now + 3 * 86400 }), /h old\*\*/);
  assert.match(fidelitySection({ fid: null, now }), /No fidelity check yet/);
  const md = injectSection('# Analysis\n', fidelitySection({ fid, now }), FID_START, FID_END);
  assert.equal(injectSection(md, fidelitySection({ fid, now }), FID_START, FID_END), md);
});
test('the Trader injects it every round', () => {
  assert.match(fs.readFileSync(new URL('../council/trader.mjs', import.meta.url), 'utf8'), /fidelitySection\(\{ fid: rd\('research\/fidelity\.json', null\), now \}\), FID_START, FID_END\)/);
});
