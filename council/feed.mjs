// Council · feed source on every record, and what happens to resting orders and open positions when a market's candle feed
// changes source (8 Nov 2026, research/edge/param-drift: the gold feed moved from Kraken PAXG + spot basis to OANDA on 7 Nov
// 16:01 UTC and the live record before then is Kraken-priced; the pending Gold daily engulf order sat at 3979.36 where the
// OANDA zone high is 3971.36). Pure functions: council/trader.mjs calls requoteMarket once per market, after the candles are
// loaded and BEFORE any candle of the new feed is allowed to fill, stop or target a trade.
//
//  - every trade, order and research record carries feed: 'oanda' | 'kraken' (the feed its prices were taken from)
//  - a PENDING order priced on another feed is re-derived from the rule's own levels on the new feed's candles when the rule
//    allows it (Gold daily engulf: the zone is the base candle's range, found by its day), else cancelled (status 'cancelled',
//    exit 'feed changed', reason recorded). A pending order is never filled by ticks of a feed it was not priced on.
//  - an OPEN position keeps its entry (it was filled) and has stop / target / trail marks re-based by the basis measured on the
//    switch minute (the last closed 1-minute candle of the old feed against the same minute on the new one); the basis goes
//    into feedBasis (cumulative) and the trade's note; the Trader's management maths adds feedBasis to the entry. When no
//    overlapping minute exists (weekend, feed down, a switch before this code) the stops are kept and the note says so.
//  - records from before this code have no feed tag: gold / forex records opened before FEED_SWITCH_AT are Kraken-priced,
//    later ones OANDA; crypto is Kraken only.
import { foldWeekend } from './fills.mjs';
export const FEED_SWITCH_AT = 1794067260;   // 2026-11-07T16:01:00Z: gold and forex candles from OANDA spot (council/trader.mjs)
export const feedTag = (feed) => /oanda/i.test(String(feed || '')) ? 'oanda' : 'kraken';
// the feed a record was priced on: its tag, else inferred from the switch time (oandaMarket = a market that reads OANDA)
export function legacyFeed(tr, oandaMarket) {
  if (tr.feed) return tr.feed;
  return oandaMarket && (tr.opened || 0) >= FEED_SWITCH_AT ? 'oanda' : 'kraken';
}
// basis between two feeds on the switch minute: prev = { feed, t, close } (the old feed's last closed 1-minute candle, saved by
// the previous round), bars = the new feed's 1-minute candles. The same minute when it exists, else the nearest within maxGap;
// null when none overlaps or the difference is implausible (> maxFrac of price: a bad print, not a basis).
export function measureBasis(prev, bars, { maxGap = 900, maxFrac = 0.02, dp = 3 } = {}) {
  if (!prev || !Number.isFinite(prev.close) || !Number.isFinite(prev.t) || !Array.isArray(bars) || !bars.length) return null;
  let best = null;
  for (const b of bars) { const d = Math.abs(b.time - prev.t); if (d <= maxGap && (!best || d < best.d)) best = { d, b }; }
  if (!best) return null;
  const basis = best.b.close - prev.close;
  if (!(Math.abs(basis) <= maxFrac * Math.abs(prev.close))) return null;
  return { basis: +basis.toFixed(dp), at: best.b.time, exact: best.d === 0 };
}
// Gold daily engulf (geg): the order's levels are the base candle's range on the new feed. The base day is in the id
// (`<market>-geg-<base.time>`); the candle must still be red and the limit must still sit below price (the rule's own check).
// The engulf reads trading days since 12 Nov 2026 (council/fills.mjs foldWeekend, item 52), so the base is looked up on the same
// folded series: a Monday base carries the Sunday reopen stub's range; a Sunday-dated base no longer exists (null: cancelled).
export function rederiveGeg(tr, D, EG, price, dp) {
  const t = Number.isFinite(tr.zoneT) ? tr.zoneT : +String(tr.id || '').split('-').pop();
  const b = foldWeekend(D).find((x) => x.time === t);
  if (!b || !(b.open > b.close) || !EG) return null;
  const entry = +b.high.toFixed(dp), stop = +(b.low - EG.pad).toFixed(dp), r0 = +(entry - stop).toFixed(dp);
  if (!(r0 > 0) || !(price > entry)) return null;
  return { entry, stop, r0, t1: +(entry + 10 * r0).toFixed(dp), tp1: +(entry + 2 * r0).toFixed(dp), zone: [+b.low.toFixed(dp), +b.high.toFixed(dp)] };
}
const fx = (v, dp) => Number.isFinite(v) ? +v.toFixed(dp) : v;
const sgn = (v) => `${v >= 0 ? '+' : ''}${v}`;
// One market, one round. Returns what it did: { from, to, basis, rederived, cancelled, rebased, kept, tagged, ids }.
// from is null when no live record was priced on another feed (then nothing but the tags changed).
export function requoteMarket({ trades, key, feed, src, price, now, dp = 2, config = {}, prev = null, oandaMarket = false }) {
  const tag = feedTag(feed), out = { market: key, from: null, to: tag, basis: null, rederived: 0, cancelled: 0, rebased: 0, kept: 0, tagged: 0, ids: [] };
  const live = trades.filter((x) => x.market === key && (x.status === 'pending' || x.status === 'open'));
  if (!live.length) return out;
  const iso = new Date(now * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  const B = prev && prev.feed && prev.feed !== tag ? measureBasis(prev, src && src['1m'] && src['1m'].bars, { dp: dp + 1 }) : null;
  if (B) out.basis = B.basis;
  for (const tr of live) {
    const was = legacyFeed(tr, oandaMarket);
    if (was === tag) { if (!tr.feed) { tr.feed = tag; out.tagged++; } continue; }
    out.from = was; out.ids.push(tr.id);
    if (tr.status === 'pending') {
      const nq = tr.k === 'geg' ? rederiveGeg(tr, src && src['1d'] && src['1d'].bars, config.goldEG, price, dp) : null;
      if (nq) {
        const old = { entry: tr.entry, stop: tr.stop, t1: tr.t1, tp1: tr.tp1, zone: tr.zone };
        Object.assign(tr, nq); tr.rr = 10; tr.feed = tag; tr.requoted = { at: now, from: was, to: tag, was: old }; tr.ntfyP = 0;
        tr.note = `${tr.note || ''} Re-quoted ${iso}: the candle feed changed ${was} → ${tag}, so the order was re-derived from the zone on the ${tag} candles: limit ${old.entry} → ${tr.entry}, stop ${old.stop} → ${tr.stop}, 2R mark ${tr.tp1}.`.trim();
        out.rederived++;
      } else {
        tr.status = 'cancelled'; tr.closed = now; tr.R = 0; tr.exit = 'feed changed'; tr.feedTo = tag;
        tr.reason = `feed changed (${was} → ${tag}): the order was priced on ${was} candles and ${tr.k === 'geg' ? 'its zone cannot be re-derived on the new feed (base candle missing, not red, or price already through the re-derived limit)' : 'its level cannot be re-derived on the new feed'}; never filled by ticks of another feed.`;
        tr.note = `${tr.note || ''} Cancelled ${iso}: ${tr.reason}`.trim();
        out.cancelled++;
      }
      continue;
    }
    // open: the fill stands; the marks move by the basis measured on the switch minute
    tr.r0 = tr.r0 || Math.abs(tr.entry - tr.stop);
    if (B) {
      for (const f of ['stop', 't1', 'tp1', 'midStop']) if (Number.isFinite(tr[f])) tr[f] = fx(tr[f] + B.basis, dp + 1);
      tr.feedBasis = fx((tr.feedBasis || 0) + B.basis, dp + 1); tr.feed = tag;
      tr.note = `${tr.note || ''} Feed changed ${was} → ${tag} ${iso}: basis ${sgn(B.basis)} measured on the switch minute (${B.exact ? 'same' : 'nearest'} candle); stop ${tr.stop}${Number.isFinite(tr.tp1) ? `, 2R mark ${tr.tp1}` : ''} and target re-based by it, entry kept at ${tr.entry} (filled on ${was}).`.trim();
      out.rebased++;
    } else {
      tr.feed = tag; tr.feedKept = (tr.feedKept || 0) + 1;
      tr.note = `${tr.note || ''} Feed changed ${was} → ${tag} ${iso}: no overlapping minute to measure the basis, so stop and target are kept as priced on ${was}; entry ${tr.entry} kept.`.trim();
      out.kept++;
    }
  }
  return out;
}
// one line for snapshot.errors / the page's health line
export function feedChangeText(c) {
  const parts = [];
  if (c.rederived) parts.push(`${c.rederived} order${c.rederived > 1 ? 's' : ''} re-quoted`);
  if (c.cancelled) parts.push(`${c.cancelled} cancelled`);
  if (c.rebased) parts.push(`${c.rebased} open re-based (basis ${sgn(c.basis)})`);
  if (c.kept) parts.push(`${c.kept} open kept (no basis)`);
  return `feed changed ${c.from} → ${c.to}${parts.length ? ': ' + parts.join(', ') : ' (no live trades)'}`;
}

// Feed hysteresis (8 Nov): one missed OANDA read (a proxy timeout) used to flip a market to Kraken for a round and back the
// next, re-quoting its orders twice on the way (gold 07:00 and 07:05 UTC: the engulf order re-derived on PAXG, then on spot
// again). A market that was on OANDA now needs FEED_MISSES consecutive misses before it falls to Kraken; until then the
// round skips the market (its records are not touched by candles they were not priced on, and nothing is re-quoted). A
// market that was not on OANDA (first round, or already on Kraken) falls through at once, as before.
export const FEED_MISSES = 2;
export function feedDecision({ oandaOk, oandaMarket, prevFeed = null, misses = 0 }) {
  if (!oandaMarket) return { feed: 'Kraken', misses: 0 };
  if (oandaOk) return { feed: 'OANDA', misses: 0 };
  const m = (misses | 0) + 1;
  return prevFeed === 'oanda' && m < FEED_MISSES ? { feed: 'skip', misses: m } : { feed: 'Kraken', misses: m };
}
