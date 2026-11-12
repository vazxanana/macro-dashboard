// Offline tests for council/feed.mjs: the feed tag on every record and what happens to resting orders and open positions when a
// market's candle feed changes source mid-session (research/edge/param-drift: Kraken PAXG + basis → OANDA on 7 Nov 16:01 UTC).
//   node --test tests/feed-requote.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FEED_SWITCH_AT, feedTag, legacyFeed, measureBasis, rederiveGeg, requoteMarket, feedChangeText } from '../council/feed.mjs';
import { alertEvents } from '../council/alerts.mjs';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const OANDA_D1 = JSON.parse(read('./fixtures/council/oanda-xau-d1.json')).bars;   // real OANDA daily candles around the 3 Nov base candle
const BASIS = 8;                                                                    // the fake Kraken frame sits 8 dollars above OANDA
const T0 = Date.parse('2026-11-08T10:00:00Z') / 1000;
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);
// a fake feed: 1-minute candles around px for the 60 minutes before t (the last one forming), shifted by off
const m1 = (t, px, off = 0, n = 60) => Array.from({ length: n }, (_, i) => { const tm = t - (n - i) * 60, c = px + Math.sin(tm / 300) * 2 + off; return { time: tm, open: c - 0.3, high: c + 0.8, low: c - 0.8, close: c }; });
const shift = (bars, off) => bars.map((b) => ({ time: b.time, open: b.open + off, high: b.high + off, low: b.low + off, close: b.close + off }));
const feedOf = (off, t = T0, px = 4070) => ({ '1m': { bars: m1(t, px, off) }, '1d': { bars: shift(OANDA_D1, off) } });
const EG = { k: 3, life: 20, hold: 240, sma: 20, pad: 0.3, maxOpen: 3 };
// the live pending Gold daily engulf order as it stands in council-data trades.json (7 Nov 22:34 UTC), Kraken-priced, no feed tag
const GEG = () => ({ id: 'xau-geg-1793664000', market: 'xau', label: 'XAU/USD', dec: 1, k: 'geg', name: 'Gold daily engulf', pair: 'D1 engulf zone', h: '1d', side: 'buy',
  entry: 3979.36, stop: 3907.61, t1: 4696.86, tp1: 4122.86, rr: 10, trail: [2, 1], opened: 1793956528, checked: 1794090480, status: 'pending', R: null, r0: 71.75, validFor: 1728000, maxHold: 864000, noBe: true, entryMode: 'limit',
  zone: [3907.91, 3979.36], lastD: 1793923200, feat: { sma: 4047.51, conf: 4065.68 }, shadow: false, blockedBy: [], note: 'Gold daily engulf: daily close 4065.68 above the high 3979.36 of the red candle of 2026-11-03 (zone 3907.91-3979.36).' });
const clone = (x) => JSON.parse(JSON.stringify(x));

test('feed tags: the Trader\'s feed label becomes oanda / kraken; untagged records are placed by the switch time', () => {
  assert.equal(feedTag('OANDA'), 'oanda'); assert.equal(feedTag('Kraken'), 'kraken'); assert.equal(feedTag(undefined), 'kraken');
  assert.equal(FEED_SWITCH_AT, Date.parse('2026-11-07T16:01:00Z') / 1000);
  assert.equal(legacyFeed({ opened: FEED_SWITCH_AT - 1 }, true), 'kraken'); assert.equal(legacyFeed({ opened: FEED_SWITCH_AT }, true), 'oanda');
  assert.equal(legacyFeed({ opened: FEED_SWITCH_AT + 99 }, false), 'kraken');   // crypto has no OANDA feed
  assert.equal(legacyFeed({ feed: 'oanda', opened: 0 }, true), 'oanda');
});

test('the basis is measured on the switch minute: same candle first, nearest within 15 min else, never an implausible jump', () => {
  const bars = m1(T0, 4070, BASIS), last = bars.at(-2);
  const ex = measureBasis({ feed: 'kraken', t: last.time, close: last.close - BASIS }, bars);
  near(ex.basis, BASIS); assert.equal(ex.exact, true); assert.equal(ex.at, last.time);
  const nr = measureBasis({ feed: 'kraken', t: last.time + 120, close: last.close - BASIS }, bars);   // no candle at that minute (feed gap): the nearest one
  near(nr.basis, +(bars.at(-1).close - (last.close - BASIS)).toFixed(3)); assert.equal(nr.exact, false); assert.equal(nr.at, bars.at(-1).time);
  assert.equal(measureBasis({ feed: 'kraken', t: last.time + 3600, close: 4000 }, bars), null);      // a weekend / outage: nothing within 15 min
  assert.equal(measureBasis({ feed: 'kraken', t: last.time, close: 3000 }, bars), null);             // > 2% apart: a bad print, not a basis
  assert.equal(measureBasis(null, bars), null); assert.equal(measureBasis({ feed: 'kraken', t: last.time, close: 4000 }, []), null);
});

test('no feed change: the records are byte-identical apart from the feed tag on untagged ones', () => {
  const tagged = [{ id: 'a', market: 'xau', k: 'replica', status: 'open', side: 'buy', entry: 4000, stop: 3990, t1: 4100, r0: 10, feed: 'oanda', opened: T0 - 600 }, GEG()];
  tagged[1].feed = 'oanda';
  const before = JSON.stringify(tagged), prev = { feed: 'oanda', t: T0 - 300, close: 4071 };
  const q = requoteMarket({ trades: tagged, key: 'xau', feed: 'OANDA', src: feedOf(0), price: 4070.59, now: T0, config: { goldEG: EG }, prev, oandaMarket: true });
  assert.equal(JSON.stringify(tagged), before); assert.equal(q.from, null); assert.equal(q.tagged, 0); assert.equal(q.rederived + q.cancelled + q.rebased + q.kept, 0);
  // untagged records created after the switch get the tag and nothing else
  const un = [{ id: 'b', market: 'xau', k: 'gtl', status: 'open', side: 'buy', entry: 4000, stop: 3990, t1: 4100, r0: 10, opened: FEED_SWITCH_AT + 3600 }];
  const q2 = requoteMarket({ trades: un, key: 'xau', feed: 'OANDA', src: feedOf(0), price: 4070.59, now: T0, config: { goldEG: EG }, prev, oandaMarket: true });
  assert.equal(q2.tagged, 1); assert.equal(un[0].feed, 'oanda'); assert.equal(un[0].stop, 3990); assert.equal(un[0].note, undefined);
  // another market's records are not touched
  const other = [{ id: 'c', market: 'eurusd', k: 'scalp', status: 'pending', side: 'buy', entry: 1.1, stop: 1.09, t1: 1.13, opened: 0 }];
  requoteMarket({ trades: other, key: 'xau', feed: 'OANDA', src: feedOf(0), price: 4070.59, now: T0, config: {}, prev, oandaMarket: true });
  assert.equal(other[0].feed, undefined); assert.equal(other[0].status, 'pending');
});

test('the pending Gold daily engulf order (Kraken-priced 3979.36) is re-derived from the OANDA zone, not filled by OANDA ticks', () => {
  const tr = GEG(), trades = [tr], src = feedOf(0);   // the switch already happened: the previous round has no OANDA / Kraken record
  // without the re-quote an OANDA candle at 3975 would have filled the Kraken-priced limit
  const tick = { time: T0 - 60, open: 3976, high: 3977, low: 3975, close: 3976 };
  assert.ok(tick.low <= tr.entry, 'the stale level would fill');
  const q = requoteMarket({ trades, key: 'xau', feed: 'OANDA', src, price: 4070.59, now: T0, config: { goldEG: EG }, prev: null, oandaMarket: true });
  assert.equal(q.from, 'kraken'); assert.equal(q.to, 'oanda'); assert.equal(q.rederived, 1); assert.equal(q.cancelled, 0); assert.deepEqual(q.ids, ['xau-geg-1793664000']);
  assert.equal(tr.status, 'pending'); assert.equal(tr.feed, 'oanda');
  assert.equal(tr.entry, 3971.36); assert.equal(tr.stop, 3895.27); near(tr.r0, 76.09); near(tr.t1, 4732.26); near(tr.tp1, 4123.54);
  assert.deepEqual(tr.zone, [3895.57, 3971.36]); assert.equal(tr.rr, 10); assert.deepEqual(tr.trail, [2, 1]);
  assert.ok(!(tick.low <= tr.entry), 'the re-derived level is not filled by that candle');
  assert.deepEqual(tr.requoted.was, { entry: 3979.36, stop: 3907.61, t1: 4696.86, tp1: 4122.86, zone: [3907.91, 3979.36] });
  assert.equal(tr.requoted.from, 'kraken'); assert.equal(tr.ntfyP, 0);
  assert.match(tr.note, /Re-quoted .*kraken → oanda.*limit 3979\.36 → 3971\.36, stop 3907\.61 → 3895\.27/);
  assert.equal(tr.feedBasis, undefined);   // a pending order has no fill to re-base
  assert.match(feedChangeText({ from: 'kraken', to: 'oanda', rederived: 1 }), /^feed changed kraken → oanda: 1 order re-quoted$/);
});

test('a pending order whose rule cannot be re-derived is cancelled with the reason, never filled on the new feed', () => {
  const mb = { id: 'xau-moshabo-1794000000', market: 'xau', k: 'mosha-bo', name: 'Mosha BO system', side: 'sell', status: 'pending', entry: 4080, stop: 4090.3, t1: 4049.1, r0: 10.3, opened: FEED_SWITCH_AT - 7200, note: 'Mosha BO system: …' };
  const eng = { id: 'xau-scalp-1794000001', market: 'xau', k: 'scalp', side: 'buy', status: 'pending', entry: 4060, stop: 4055, t1: 4075, opened: FEED_SWITCH_AT - 60, shadow: true, note: 'Shadow (focus)' };
  const trades = [mb, eng];
  const q = requoteMarket({ trades, key: 'xau', feed: 'OANDA', src: feedOf(0), price: 4070.59, now: T0, config: { goldEG: EG }, prev: null, oandaMarket: true });
  assert.equal(q.cancelled, 2); assert.equal(q.rederived, 0);
  for (const x of trades) { assert.equal(x.status, 'cancelled'); assert.equal(x.R, 0); assert.equal(x.closed, T0); assert.equal(x.exit, 'feed changed'); assert.equal(x.feedTo, 'oanda'); assert.equal(x.feed, undefined);
    assert.match(x.reason, /^feed changed \(kraken → oanda\)/); assert.match(x.note, /Cancelled .*never filled by ticks of another feed/); }
  // a geg order whose re-derived limit sits above price (the rule places it only below) is cancelled too, and so is one whose base day is missing
  const g1 = GEG(), g2 = GEG(); g2.id = 'xau-geg-1700000000';
  const q2 = requoteMarket({ trades: [g1, g2], key: 'xau', feed: 'OANDA', src: feedOf(0), price: 3960, now: T0, config: { goldEG: EG }, prev: null, oandaMarket: true });
  assert.equal(q2.cancelled, 2); assert.match(g1.reason, /base candle missing, not red, or price already through/);
  assert.equal(rederiveGeg(GEG(), OANDA_D1, EG, 4070.59, 2).entry, 3971.36); assert.equal(rederiveGeg(GEG(), OANDA_D1, null, 4070.59, 2), null);
});

test('adoption of a fallback-priced position by the primary feed: ONE offset, target moved by it, the stop only when that tightens it (12 Nov 2026)', () => {
  // round 1 on Kraken: the trader saves the last closed minute; round 2 the feed is OANDA (8 dollars lower)
  const kr = feedOf(BASIS, T0 - 240), lastK = kr['1m'].bars.at(-2), prev = { feed: 'kraken', t: lastK.time, close: lastK.close };
  const oa = feedOf(0);
  const sell = { id: 's', market: 'xau', k: 'replica', side: 'sell', status: 'open', entry: 4080, stop: 4090, t1: 3980, tp1: 4060, r0: 10, trail: [2, 2], feed: 'kraken', opened: T0 - 7200, filled: T0 - 7200, note: 'Gold replica (v5)' };
  const buy = { id: 'b', market: 'xau', k: 'gtrend', side: 'buy', status: 'open', entry: 4000, stop: 3950, t1: 400000, r0: 50, feed: 'kraken', opened: T0 - 86400, filled: T0 - 86400 };
  const trades = [sell, buy];
  const q = requoteMarket({ trades, key: 'xau', feed: 'OANDA', src: oa, price: 4070, now: T0, config: {}, prev, oandaMarket: true });
  assert.equal(q.from, 'kraken'); near(q.basis, -BASIS); assert.equal(q.rebased, 2); assert.equal(q.kept, 0); assert.equal(q.held, 0);
  // the sell: -8 lowers its stop, which tightens it: applied
  assert.equal(sell.entry, 4080); near(sell.stop, 4082); near(sell.t1, 3972); near(sell.tp1, 4052); near(sell.feedBasis, -BASIS); assert.equal(sell.feed, 'oanda'); assert.equal(sell.r0, 10);
  assert.deepEqual(sell.feedAdj, { stop: -8, t1: -8 }); assert.equal(sell.feedMoves.length, 1); assert.deepEqual(sell.feedMoves[0].stop, [4090, 4082]);
  assert.match(sell.note, /Feed changed kraken → oanda .*one offset -8 measured on the last kraken minute \(same candle\); target and 2R mark \(4052\) moved by it, stop 4090 → 4082, entry kept at 4080/);
  // the buy: -8 would LOWER its stop (looser): the stop stays where it is (absolute rule 1), the target moves
  assert.equal(buy.entry, 4000); assert.equal(buy.stop, 3950); near(buy.feedBasis, -BASIS); assert.equal(buy.t1, 399992);
  assert.deepEqual(buy.feedAdj, { stop: 0, t1: -8 }); assert.match(buy.note, /stop kept at 3950 \(the offset would have loosened it\)/);
  // the management maths (E = entry + feedBasis): the sell's stop on the new frame is still -1R, the buy's kept stop is better than -1R
  const E = sell.entry + sell.feedBasis, exitR = (s, e, px, r0) => +(((s ? e - px : px - e)) / r0).toFixed(2);
  assert.equal(exitR(true, E, sell.stop, sell.r0), -1); near(E, 4072);
  assert.ok(exitR(false, buy.entry + buy.feedBasis, buy.stop, buy.r0) > -1);
  assert.equal(feedChangeText({ from: 'kraken', to: 'oanda', rebased: 2, basis: -8, kept: 1 }), 'feed changed kraken → oanda: 2 open re-based (basis -8), 1 open kept (no basis)');
  // the feed falls back later: the now OANDA-priced positions are HELD, nothing moves
  const oaLast = oa['1m'].bars.at(-2), prev2 = { feed: 'oanda', t: oaLast.time, close: oaLast.close }, snap = JSON.stringify(trades.map(({ note, feedHeld, ...r }) => r));
  const q2 = requoteMarket({ trades, key: 'xau', feed: 'Kraken', src: feedOf(BASIS, T0 + 240), price: 4078, now: T0 + 240, config: {}, prev: prev2, oandaMarket: true });
  assert.equal(q2.from, null); assert.equal(q2.held, 2); assert.deepEqual(q2.heldIds, ['s', 'b']); assert.equal(q2.rebased, 0);
  assert.equal(JSON.stringify(trades.map(({ note, feedHeld, ...r }) => r)), snap, 'held records keep every level');
  assert.equal(sell.feedHeld, T0 + 240); assert.equal(sell.feed, 'oanda'); assert.match(sell.note, /Held .*waits for it \(never filled, stopped or re-based by kraken candles\)/);
});

test('no overlapping minute (a switch over the weekend, or before this code): the open position keeps its marks and says so', () => {
  const tr = { id: 'xau-position-1793783465', market: 'xau', k: 'position', side: 'buy', status: 'open', entry: 4041.66, stop: 3887.690642857143, t1: 5636.88, r0: 153.969357142857, opened: 1793783465, filled: 1793783465, shadow: true, note: 'Shadow (focus)' };
  const q = requoteMarket({ trades: [tr], key: 'xau', feed: 'OANDA', src: feedOf(0), price: 4070.59, now: T0, config: {}, prev: null, oandaMarket: true });
  assert.equal(q.kept, 1); assert.equal(q.basis, null); assert.equal(tr.stop, 3887.690642857143); assert.equal(tr.feed, 'oanda'); assert.equal(tr.feedKept, 1); assert.equal(tr.feedBasis, undefined);
  assert.match(tr.note, /no overlapping minute to measure the basis, so stop and target are kept as priced on kraken; entry 4041\.66 kept/);
  // a switch with no live record is still reported
  assert.equal(feedChangeText({ from: 'oanda', to: 'kraken' }), 'feed changed oanda → kraken (no live trades)');
});

test('futures tickets follow: a cancelled limit sends a cancel, a re-quoted limit a replacement ticket', () => {
  const now = T0;
  const c = { ...GEG(), status: 'cancelled', closed: now - 60, exit: 'feed changed', futT: { code: 'MGCZ6', n: 1 } };
  const A = alertEvents([c], now, { account: 10000, risk: 0.25 });
  assert.equal(A.errors.length, 0); assert.equal(A.ev.length, 1); assert.match(A.ev[0].title, /^Cancel MGCZ6 limit/); assert.match(A.ev[0].msg, /was cancelled \(feed changed\)/);
  const r = { ...GEG(), entry: 3971.36, stop: 3895.27, t1: 4732.26, tp1: 4123.54, r0: 76.09, futT: { code: 'MGCZ6', n: 1 }, ntfyP: 0, requoted: { at: now - 30, from: 'kraken', to: 'oanda' } };
  const B = alertEvents([r], now, { account: 10000, risk: 0.25 });
  assert.equal(B.ev.length, 1); assert.match(B.ev[0].title, /^REPLACE LIMIT XAU\/USD Gold daily engulf/); assert.match(B.ev[0].msg, /cancel your buy limit on MGCZ6 and place this one/); assert.equal(r.ntfyP, 1);
  // an old pending order with nothing new: no ticket
  const o = { ...GEG(), futT: { code: 'MGCZ6', n: 1 }, ntfyP: 1 };
  assert.equal(alertEvents([o], now, {}).ev.length, 0);
});

test('the Trader is wired: feed tag on every record, re-quote before the manage loop, entry read in the feed frame, switches on the snapshot', () => {
  const src = read('../council/trader.mjs');
  assert.match(src, /import \{ feedTag, requoteMarket, feedChangeText, feedDecision, countSwitch, switchSummary \} from '\.\/feed\.mjs'/);
  assert.match(src, /const FEED = feedTag\(feed\);/);
  // every trade / research record literal carries the tag: 11 trades.push({ … }) literals (the Mosha cycle since 11 Nov), the engine's tr, the add, 2 research pushes
  assert.equal((src.match(/trades\.push\(\{/g) || []).length, 11, 'trades.push literals');
  assert.equal((src.match(/feed: FEED/g) || []).length, 16, '14 record literals + state.feedLast + the LIT shadow stream\'s litStep (council/lit.mjs stamps its records)');
  assert.match(src, /shadow, blockedBy, feed: FEED, note: shadow \?/);
  // the re-quote runs after the candles are loaded and before anything can fill, stop or target a trade
  const iq = src.indexOf('requoteMarket({ trades, key, feed, src, price, now'), im = src.indexOf('Manage open trades on this market'), ir = src.indexOf('if (config.retireLegacy)');
  assert.ok(iq > 0 && iq < im && iq < ir, 're-quote before the manage loop and the legacy close');
  assert.match(src, /FL\[key\] = \{ feed: FEED, t: lc\.time, close: lc\.close \}/);
  assert.match(src, /snapshot\.errors\['feed:' \+ key\] = feedChangeText\(c\)/);
  assert.match(src, /snapshot\.feedChanges = \(state\.feedChanges \|\| \[\]\)\.filter/);
  // management maths in the feed's frame: E = entry + feedBasis everywhere the loop reads the entry (the pinned fillBarAmbiguous keeps tr.entry: pending orders carry no basis)
  assert.match(src, /E = tr\.entry \+ \(tr\.feedBasis \|\| 0\)/);
  const loop = src.slice(src.indexOf('Manage open trades on this market'), src.indexOf('Review closed trades'));
  assert.equal((loop.match(/tr\.entry/g) || []).length, 4, 'only the E declaration and the pending fill checks (no basis on a pending order) read tr.entry in the manage loop');
  assert.match(loop, /exitR\(s, E, px, r0\)/); assert.match(loop, /tr\.stop = E; tr\.beMoved = true/); assert.match(loop, /entry: ae, stop: E,/);
  assert.match(src, /price - tr\.entry - \(tr\.feedBasis \|\| 0\)/);   // retire-legacy close
  // the page shows the switch and labels cancelled orders
  const page = read('../market-structure.html');
  assert.match(page, /cancelled: \['st-dim', 'Cancelled'\]/); assert.match(page, /skipped: 'Skipped', cancelled: 'Cancelled'/);
  assert.match(page, /const feedNote = \(sn\) => \{ const L = \(sn && sn\.feedChanges\) \|\| \[\]/); assert.match(page, /\$\{d1Note\(C\.snap\)\}\$\{feedNote\(C\.snap\)\}/);
});
