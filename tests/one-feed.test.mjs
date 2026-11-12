// node --test tests/one-feed.test.mjs — one feed per market (12 Nov 2026, owner approved). council-data 9-12 Nov: the gold / forex
// candle feed flipped OANDA -> Kraken -> OANDA for a few minutes at a time (189 switch events in the trade notes, 43 of them gold),
// and every flip re-based every open position's stop and target by a one-minute basis between two feeds (914 notes on 107 trades,
// 435 of them loosening the stop). Now a record is managed only by its own feed, held while that feed is away, and adopted by
// another feed with ONE logged offset that never loosens its stop. Offline: fake feeds, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { requoteMarket, feedDecision, feedChangeText, shiftStop, countSwitch, switchSummary, ADOPT_AFTER_S } from '../council/feed.mjs';
import { spotSkip, stopFill, exitR, fillBarAmbiguous } from '../council/fills.mjs';

const SRC = fs.readFileSync(new URL('../council/trader.mjs', import.meta.url), 'utf8');
const T0 = Date.parse('2026-11-12T10:00:00Z') / 1000;   // a Thursday, spot open
const m1 = (t, px, off = 0, n = 60) => Array.from({ length: n }, (_, i) => { const tm = t - (n - i) * 60, c = px + Math.sin(tm / 300) * 2 + off; return { time: tm, open: c - 0.3, high: c + 0.8, low: c - 0.8, close: c }; });
const feedAt = (t, off = 0) => ({ '1m': { bars: m1(t, 4000, off) } });
const lastMin = (src) => { const b = src['1m'].bars.at(-2); return { t: b.time, close: b.close }; };
const levels = (t) => ({ entry: t.entry, stop: t.stop, t1: t.t1, tp1: t.tp1, status: t.status, feed: t.feed, feedBasis: t.feedBasis, checked: t.checked });

// ─── the Trader's own manage loop, lifted as tests/fills-live.test.mjs lifts it ───
const M1 = '// ─── Manage open trades on this market with the candles since the last check ───', M2 = '// ─── Review closed trades';
const liveLoop = new Function('trades', 'key', 'src', 'M', 'config', 'now', 'spotSkip', 'stopFill', 'exitR', 'fillBarAmbiguous', 'startReview', 'NEWS', 'WAIT', 'FEED', SRC.slice(SRC.indexOf(M1), SRC.indexOf(M2)));
const WAIT = { '1d': 5 * 86400, '4h': 2 * 86400, '1h': 12 * 3600, '30m': 6 * 3600, '15m': 3 * 3600 };

test('the manage loop never fills, stops or targets a record with candles of another feed (a held record keeps its checked pointer)', () => {
  const bars = Array.from({ length: 30 }, (_, i) => ({ time: T0 + i * 60, open: 3992, high: 3993, low: 3985, close: 3990 }));   // through the stop
  const src = { '1m': { bars }, '5m': { bars }, '15m': { bars } };
  const mk = () => ({ id: 'xau-geg-1', market: 'xau', k: 'geg', side: 'buy', entry: 4000, stop: 3989, t1: 4110, tp1: 4022, rr: 10, r0: 11, noBe: true, status: 'open', opened: T0 - 600, filled: T0 - 600, checked: T0 - 60, dec: 1, feed: 'oanda', h: '1d' });
  const held = mk(), before = JSON.stringify(held);
  liveLoop([held], 'xau', src, { group: 'Metals' }, { be: null }, T0 + 1800, spotSkip, stopFill, exitR, fillBarAmbiguous, () => {}, [], WAIT, 'kraken');
  assert.equal(JSON.stringify(held), before, 'untouched by kraken candles');
  const own = mk();
  liveLoop([own], 'xau', src, { group: 'Metals' }, { be: null }, T0 + 1800, spotSkip, stopFill, exitR, fillBarAmbiguous, () => {}, [], WAIT, 'oanda');
  assert.equal(own.status, 'loss'); assert.equal(own.R, -1, 'its own feed stops it');
  // an untagged record (older files) is managed as before
  const old = mk(); delete old.feed;
  liveLoop([old], 'xau', src, { group: 'Metals' }, { be: null }, T0 + 1800, spotSkip, stopFill, exitR, fillBarAmbiguous, () => {}, [], WAIT, 'kraken');
  assert.equal(old.status, 'loss');
});

test('a fallback episode: the OANDA position and order keep every level; a position made on Kraken gets ONE offset on the return, never a looser stop', () => {
  const OFF = 3.2;   // the Kraken frame (PAXG shifted onto spot) sits 3.20 above OANDA in this episode
  const buy = { id: 'xau-gtl-1', market: 'xau', k: 'gtl', side: 'buy', entry: 4000, stop: 3990, t1: 4100, tp1: 4020, r0: 10, status: 'open', opened: T0 - 3600, filled: T0 - 3600, checked: T0 - 60, feed: 'oanda' };
  const ord = { id: 'xau-geg-1793664000', market: 'xau', k: 'geg', side: 'buy', entry: 3971.36, stop: 3895.27, t1: 4732.26, tp1: 4123.54, r0: 76.09, status: 'pending', opened: T0 - 86400, checked: T0 - 60, feed: 'oanda' };
  const trades = [buy, ord], keep = JSON.stringify([buy, ord].map(levels));
  // a proxy that misses 6 reads, answers once, misses once, then answers: the Trader's rounds, a minute apart
  const reads = [false, false, false, false, false, false, true, false, true, true, true, true];
  let prevFeed = 'oanda', misses = 0, oks = 0, prevBy = { oanda: lastMin(feedAt(T0)) }, prev = { feed: 'oanda', ...prevBy.oanda }, switches = 0, held = 0;
  for (let i = 0; i < reads.length; i++) {
    const now = T0 + (i + 1) * 60, d = feedDecision({ oandaOk: reads[i], oandaMarket: true, prevFeed, misses, oks }); misses = d.misses; oks = d.oks;
    if (d.feed === 'skip') continue;
    const tag = d.feed === 'OANDA' ? 'oanda' : 'kraken', src = feedAt(now, tag === 'kraken' ? OFF : 0);
    const q = requoteMarket({ trades, key: 'xau', feed: d.feed, src, price: 4005, now, dp: 2, config: {}, prev, prevBy, oandaMarket: true });
    held += q.held;
    if (tag === 'kraken' && !trades.some((x) => x.id === 'xau-scalp-k'))   // the rules took a trade on the Kraken candles
      trades.push({ id: 'xau-scalp-k', market: 'xau', k: 'scalp', side: 'sell', entry: 4008.2, stop: 4010.2, t1: 4004.2, tp1: 4006.2, r0: 2, status: 'open', opened: now, filled: now, checked: now, feed: 'kraken' });
    if (prevFeed !== tag) switches++;
    prevFeed = tag; prev = { feed: tag, ...lastMin(src) }; prevBy = { ...prevBy, [tag]: lastMin(src) };
  }
  assert.equal(prevFeed, 'oanda'); assert.equal(switches, 2, 'one fall and one return, not a flip per missed read');
  assert.ok(held >= 2 * 5, 'the OANDA records were held through the Kraken rounds');
  assert.equal(JSON.stringify([buy, ord].map(levels)), keep, 'the OANDA position and order: same entry, stop, target, status, checked');
  assert.equal(buy.feedHeld, undefined); assert.equal(ord.feedHeld, undefined); assert.equal(ord.requoted, undefined, 'no re-quote');
  const k = trades.find((x) => x.id === 'xau-scalp-k');
  assert.equal(k.feed, 'oanda'); assert.equal(k.feedMoves.length, 1, 'exactly one offset');
  assert.ok(Math.abs(k.feedMoves[0].basis + OFF) < 0.02, 'measured on the last Kraken minute against the same OANDA minute');
  assert.ok(k.stop <= 4010.2, 'a sell stop never rises (looser)'); assert.ok(Math.abs(k.stop - (4010.2 - OFF)) < 0.02, 'here the offset tightened it, so it applied');
  assert.ok(Math.abs(k.t1 - (4004.2 - OFF)) < 0.02); assert.deepEqual(Object.keys(k.feedAdj), ['stop', 't1']);
});

test('an offset never loosens a stop: 400 random adoptions back and forth, buy stops only rise, sell stops only fall', () => {
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const side of ['buy', 'sell']) {
    let stop = side === 'buy' ? 3990 : 4010;
    for (let i = 0; i < 400; i++) { const b = +((rnd() - 0.5) * 9).toFixed(3), next = shiftStop(side, stop, b, 3);
      assert.ok(side === 'buy' ? next >= stop : next <= stop, `${side} ${stop} -> ${next} on ${b}`); stop = next; }
  }
  assert.equal(shiftStop('buy', 3990, -1.5, 3), 3990); assert.equal(shiftStop('buy', 3990, 1.5, 3), 3991.5);
  assert.equal(shiftStop('sell', 4010, 1.5, 3), 4010); assert.equal(shiftStop('sell', 4010, -1.5, 3), 4008.5);
});

test('the 12 Nov Gold daily engulf: 18 re-bases walked its stop $1.32 below the rule\'s level; held now, it does not move at all', () => {
  // the 18 bases of its note (council-data trades.json, xau-geg-1793664000), switch after switch, each Kraken episode 2-25 minutes
  const B = [1.05, -2.415, 1.76, -0.935, 1.32, -0.735, 1.02, -0.53, -0.285, 0.455, 1.63, -0.58, 0.885, -2.13, 1.875, -2.11, 2.83, -4.42];
  assert.equal(+(3895.27 + B.reduce((a, b) => a + b, 0)).toFixed(3), 3893.955, 'the old rule: the stop on file when it closed');
  const tr = { id: 'xau-geg-1793664000', market: 'xau', k: 'geg', side: 'buy', entry: 3971.36, stop: 3895.27, t1: 4732.26, tp1: 4123.54, r0: 76.09, status: 'open', opened: T0 - 86400, filled: T0 - 36000, checked: T0, feed: 'oanda' };
  let t = T0, prevBy = { oanda: lastMin(feedAt(t)) };
  for (let i = 0; i < B.length; i += 2) {   // fall (B[i]) then return (B[i + 1]): the new rule holds through each episode
    t += 600; let src = feedAt(t, B[i]); requoteMarket({ trades: [tr], key: 'xau', feed: 'Kraken', src, price: 4000, now: t, config: {}, prevBy, oandaMarket: true }); prevBy = { ...prevBy, kraken: lastMin(src) };
    t += 180; src = feedAt(t, 0); requoteMarket({ trades: [tr], key: 'xau', feed: 'OANDA', src, price: 4000, now: t, config: {}, prevBy, oandaMarket: true }); prevBy = { ...prevBy, oanda: lastMin(src) };
  }
  assert.equal(tr.stop, 3895.27); assert.equal(tr.t1, 4732.26); assert.equal(tr.feedBasis, undefined); assert.equal(tr.feedMoves, undefined); assert.equal(tr.feed, 'oanda');
  assert.equal((tr.note.match(/Held /g) || []).length, 9, 'one short note per episode, not one per round');
});

test('a primary feed away for ADOPT_AFTER_S: the held position is adopted by the fallback once, with one offset measured on its own last minute', () => {
  const tr = { id: 'xau-gtrend-1', market: 'xau', k: 'gtrend', side: 'buy', entry: 4000, stop: 3950, t1: 400000, r0: 50, status: 'open', opened: T0 - 86400, filled: T0 - 86400, checked: T0, feed: 'oanda' };
  // OANDA's last minute was read at T0; Kraken bars that reach back over it (12 h of 1-minute candles) sit 2.5 above
  const kr = (now) => ({ '1m': { bars: m1(now, 4000, 2.5, 800) } }), prevBy = { oanda: lastMin(feedAt(T0)) };
  let q = requoteMarket({ trades: [tr], key: 'xau', feed: 'Kraken', src: kr(T0 + 300), price: 4000, now: T0 + 300, config: {}, prevBy, oandaMarket: true });
  assert.equal(q.held, 1); assert.equal(tr.feedHeld, T0 + 300);
  q = requoteMarket({ trades: [tr], key: 'xau', feed: 'Kraken', src: kr(T0 + 300 + ADOPT_AFTER_S - 60), price: 4000, now: T0 + 300 + ADOPT_AFTER_S - 60, config: {}, prevBy, oandaMarket: true });
  assert.equal(q.held, 1);
  const now = T0 + 300 + ADOPT_AFTER_S;
  q = requoteMarket({ trades: [tr], key: 'xau', feed: 'Kraken', src: kr(now), price: 4000, now, config: {}, prevBy, oandaMarket: true });
  assert.equal(q.held, 0); assert.equal(q.rebased, 1); assert.equal(tr.feed, 'kraken'); assert.equal(tr.feedHeld, undefined);
  assert.ok(Math.abs(tr.feedBasis - 2.5) < 0.01); assert.ok(Math.abs(tr.stop - 3952.5) < 0.01, 'tightened: applied'); assert.equal(tr.feedMoves.length, 1);
  assert.match(tr.note, /one offset \+2\.5\d* measured on the last oanda minute/);
});

test('switch counts on the snapshot, and the Trader wiring', () => {
  let r = null; for (const t of [T0, T0 + 120, T0 + 90000]) r = countSwitch(r, t);
  assert.deepEqual(switchSummary(r, T0 + 90060), { n: 3, since: new Date(T0 * 1000).toISOString(), last24h: 1, last7d: 3, lastAt: new Date((T0 + 90000) * 1000).toISOString() });
  assert.equal(feedChangeText({ from: 'oanda', to: 'kraken', held: 2 }), 'feed changed oanda → kraken: 2 held on their own feed');
  assert.deepEqual(switchSummary(undefined, T0), { n: 0, since: null, last24h: 0, last7d: 0, lastAt: null });
  assert.match(SRC, /if \(prev && prev\.feed !== FEED\) \{ const FS = \(state\.feedSwitch = state\.feedSwitch \|\| \{\}\); FS\[key\] = countSwitch\(FS\[key\], now\); \}/);
  assert.match(SRC, /snapshot\.feedSwitches = Object\.fromEntries\(Object\.entries\(state\.feedSwitch \|\| \{\}\)\.map\(\(\[k, r\]\) => \[k, switchSummary\(r, now\)\]\)\);/);
  assert.match(SRC, /prevBy: FLB\[key\] \|\| null/); assert.match(SRC, /\(FLB\[key\] = FLB\[key\] \|\| \{\}\)\[FEED\] = \{ t: lc\.time, close: lc\.close \}/);
  const loop = SRC.slice(SRC.indexOf(M1), SRC.indexOf(M2));
  assert.match(loop, /if \(tr\.feed && tr\.feed !== FEED\) continue;/);
  assert.match(SRC, /config\.retireLegacy\) for \(const tr of trades\.filter\(\(x\) => x\.market === key && \(!x\.feed \|\| x\.feed === FEED\)/);
});
