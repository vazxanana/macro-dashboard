// node --test tests/fidelity.test.mjs — replay fidelity: per-market outcome and R gap, and the same-feed split (live gold/forex ran
// on Kraken candles before the 7 Nov 19:00 UTC switch, the replay reads OANDA: those pairs are a feed comparison, not a replay fault)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const SCRIPT = new URL('../council/fidelity.mjs', import.meta.url).pathname;
const COLS = ['market', 'setup', 'side', 'opened', 'filled', 'rr', 'd1', 'struct', 'session', 'R_none', 'R_be1', 'R_be15', 'R_tp2', 'mfe', 'cost', 'fill', 'cf', 'choch', 'm15c', 'm15c1', 'status', 'adx', 'adxBand'];
const SWITCH = Date.parse('2026-11-07T19:00:06Z') / 1000, T0 = SWITCH - 3 * 86400;
const row = (m, k, side, opened, R, cost = 0.1, d1 = 'with') => [m, k, side, opened, opened, 2, d1, 'main', 'london', R, R, R, R, 1, cost, 1, 'bo', 'no', 'no', 'no', 'closed', null, null];
let id = 0;
const live = (market, k, side, opened, R, d1 = 'with') => ({ id: `t${++id}`, market, k, side, opened, status: R > 0 ? 'win' : 'loss', R, rr: 2, feat: { d1, session: 'london', struct: 'main', cf: 'bo', choch: 'no', m15c: 'no' }, shadow: true });

function run(trades, rows, source) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fid-'));
  try {
    fs.writeFileSync(path.join(dir, 'trades.json'), JSON.stringify(trades));
    fs.writeFileSync(path.join(dir, 'backtest.json'), JSON.stringify({ at: new Date((SWITCH + 7200) * 1000).toISOString(), from: new Date((T0 - 86400) * 1000).toISOString(), to: new Date((SWITCH + 7200) * 1000).toISOString(),
      markets: { source, errors: {}, d1src: { xau: 'OANDA', btc: 'feed' }, xau: { steps: 1 }, btc: { steps: 1 } }, tradeCols: COLS, trades: rows }));
    const log = execFileSync(process.execPath, [SCRIPT, dir], { encoding: 'utf8' });
    return { log, f: JSON.parse(fs.readFileSync(path.join(dir, 'research', 'fidelity.json'), 'utf8')) };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('per-market outcome and R gap; gold before the live OANDA switch is left out of the same-feed numbers', () => {
  const trades = [
    // gold, live on Kraken (before the switch): one matched win the replay lost, one the replay never fired
    live('xau', 'scalp', 'buy', T0 + 3600, 2), live('xau', 'scalp', 'sell', T0 + 7200, -1),
    // gold after the switch (both OANDA): matched, same result
    live('xau', 'scalp', 'buy', SWITCH + 600, -1),
    // crypto: live Kraken, replay Kraken: matched, live +2 vs replay +1
    live('btc', 'scalp', 'buy', T0 + 3600, 2), live('btc', 'scalp', 'sell', T0 + 5 * 3600, -1),
  ];
  const rows = [row('xau', 'scalp', 'buy', T0 + 3600 + 120, -1), row('xau', 'scalp', 'buy', SWITCH + 600, -1),
    row('btc', 'scalp', 'buy', T0 + 3600, 1, 0.5), row('btc', 'scalp', 'sell', T0 + 5 * 3600 - 60, -1, 0.5)];
  const { f, log } = run(trades, rows, { xau: 'OANDA', btc: 'Kraken' });
  const x = f.perMarket.xau, b = f.perMarket.btc;
  assert.equal(x.replayFeed, 'OANDA');
  assert.deepEqual(x.liveFeeds, { Kraken: 2, OANDA: 1 });
  assert.equal(x.live, 3); assert.equal(x.liveMatched, 2);
  assert.equal(x.bothClosed, 2); assert.equal(x.signRate, 0.5);
  assert.equal(x.sumLiveR, 1); assert.equal(x.sumReplayR, -2); assert.equal(x.gapGross, 1.5);
  // same feed: only the post-switch gold trade
  assert.equal(x.sameFeed.live, 1); assert.equal(x.sameFeed.liveRate, 1); assert.equal(x.sameFeed.gapGross, 0); assert.equal(x.sameFeed.signRate, 1);
  // crypto on Kraken both sides: all same feed; gap +0.5 gross, +1 net (cost 0.5R a trade)
  assert.equal(b.sameFeed.live, 2); assert.equal(b.gapGross, 0.5); assert.equal(b.gapNet, 1); assert.equal(b.sumReplayRNet, -1);
  assert.equal(f.sameFeed.live, 3); assert.equal(f.sameFeed.liveMatched, 3); assert.equal(f.sameFeed.feedDiffersPairs, 1);
  assert.deepEqual(f.sameFeed.markets, ['btc', 'xau']);
  // the unmatched pre-switch gold signal is put down to the feed, not to the replay
  const why = f.unmatchedLive.reasons.map((r) => `${r.cls}: ${r.why}`);
  assert.ok(why.some((w) => /^feed differs: .*replay on OANDA candles, live on Kraken/.test(w)), why.join('\n'));
  assert.match(log, /same feed only/);
});

test('crypto on Binance in the replay counts as a different feed from live Kraken', () => {
  const { f } = run([live('btc', 'scalp', 'buy', T0 + 3600, 2)], [row('btc', 'scalp', 'buy', T0 + 3600, 2)], { xau: 'OANDA', btc: 'Binance' });
  assert.equal(f.perMarket.btc.pairs, 1); assert.equal(f.perMarket.btc.sameFeed.pairs, 0);
  assert.equal(f.sameFeed.live, 0); assert.equal(f.sameFeed.feedDiffersPairs, 1);
});
