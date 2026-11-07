// Crypto trend v3 decay study (research/edge/crypto-trend-decay). Paper research only: nothing live changes.
// lib.mjs: data loading, the live rule replayed unchanged, statistics.
//
// Data (no network needed): the council-data branch already holds the free public candles this study uses.
//   - Binance spot daily klines (BTCUSDT, ETHUSDT, SOLUSDT, XRPUSDT; public /api/v3/klines, UTC days), cached in
//     origin/council-data research/candles/crypto1d/<SYM>_1d.json.gz as [time, open, high, low, close]. BTC and ETH start
//     2017-08-17, XRP 2018-05-04, SOL 2020-08-11; all end 2026-10-31. This is the earliest free daily history we can reach
//     (Binance, Bitstamp, Kraken, Yahoo, CryptoDataDownload, CoinGecko and Coin Metrics are not reachable from the research
//     sandbox; the cache was pulled from Binance's public klines API earlier).
//   - Kraken public OHLC daily (interval 1440, the Trader's own crypto feed; the API keeps 720 candles), cached in
//     origin/council-data research/bars/<PAIR>-1440.json: 2024-11-16 to 2026-11-06. Used as a cross-check of the recent years.
// load() reads them with `git show` (or from $CT_DATA/<file> when set).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { costOf } from '../../../council/fills.mjs';

export const COINS = { btc: { bin: 'BTCUSDT', kr: 'XBTUSD' }, eth: { bin: 'ETHUSDT', kr: 'ETHUSD' }, sol: { bin: 'SOLUSDT', kr: 'SOLUSD' }, xrp: { bin: 'XRPUSDT', kr: 'XRPUSD' } };
const M = { group: 'Crypto' };   // costOf: spread (0.02% of price) + Kraken taker entry 0.40% + taker exit 0.40% (market orders both ways)

function readRef(file) {
  if (process.env.CT_DATA) return fs.readFileSync(path.join(process.env.CT_DATA, path.basename(file)));
  return execFileSync('git', ['show', `origin/council-data:${file}`], { maxBuffer: 1 << 28 });
}
export function loadBinance(coin) {
  const raw = JSON.parse(zlib.gunzipSync(readRef(`research/candles/crypto1d/${COINS[coin].bin}_1d.json.gz`)));
  return raw.map((x) => ({ time: x[0], open: +x[1], high: +x[2], low: +x[3], close: +x[4] }));
}
// Kraken: the newest candle in the file is the day still forming when it was saved, so it is dropped (as the Trader does)
export function loadKraken(coin) {
  const j = JSON.parse(readRef(`research/bars/${COINS[coin].kr}-1440.json`));
  const a = Object.values(j.result).find(Array.isArray);
  return a.slice(0, -1).map((x) => ({ time: x[0], open: +x[1], high: +x[2], low: +x[3], close: +x[4] }));
}

const tr = (D, i) => Math.max(D[i].high - D[i].low, Math.abs(D[i].high - D[i - 1].close), Math.abs(D[i].low - D[i - 1].close));
const atr20 = (D, i) => { let a = 0; for (let j = i - 19; j <= i; j++) a += tr(D, j); return a / 20; };
const hiOf = (D, a, b) => { let m = -Infinity; for (let j = a; j < b; j++) m = Math.max(m, D[j].high); return m; };
const loOf = (D, a, b) => { let m = Infinity; for (let j = a; j < b; j++) m = Math.min(m, D[j].low); return m; };

// ── Crypto trend v3 exactly as council/trader.mjs runs it (lines 616-676, user rules pairs-best + crypto-add) ──
// Per coin two independent slots: the 55-day and the 100-day breakout, long only, one open trade per slot.
//  signal: a closed daily candle i closes above the highest high of the N candles before it (D[i-N..i-1]).
//  entry : at market on the Trader's next run after that close = the next daily open D[i+1].open (crypto trades 24/7).
//  risk  : catastrophe stop entry - 5 x ATR(20) (ATR on candles i-19..i), fixed; r0 = 5 ATR = 1R. A candle whose low
//          reaches it exits at the stop, or at its open when it opened below the stop (stopFill).
//  exit  : a daily close under the N-day channel midpoint ((max high + min low)/2 of the N candles before that day), which
//          only ratchets up from its value at the signal; out at market on the next run = the next daily open.
//  add   : once, when a daily close is >= entry + 1R (and the trade did not exit that day): a second unit buys at market
//          (next open) with its own stop add - r0; it exits with the first trade, or alone at its stop.
//  costs : council/fills.mjs costOf per unit (market entry: taker 0.40% + taker exit 0.40% + spread 0.02% of price), in R.
//  The live per-coin kill switch (config.cryptoTrendStopR -8R, counted from 5 Nov 2026 only) is forward-only and not replayed.
// A position = the first unit plus its add, in R of the first unit's risk (the robustness rebuild's unit). `units` keeps
// each unit separately (the council replay counts the add as its own trade).
export function replayV3(D, coin, opt = {}) {
  const slots = opt.slots || [55, 100], K = opt.k ?? 5, addAt = opt.add ?? 1, costMult = opt.costMult ?? 1, out = [];
  const costR = (px, r0) => costMult * costOf(M, px, false) / r0;
  for (const N of slots) {
    let i = Math.max(N, 20) + 1;
    while (i < D.length - 1) {
      const hi = hiOf(D, i - N, i);
      if (!(D[i].close > hi)) { i++; continue; }
      const A = atr20(D, i), e = D[i + 1].open, r0 = K * A, stop = e - r0;
      if (!(r0 > 0)) { i++; continue; }
      let mid = (hi + loOf(D, i - N, i)) / 2, add = null, exitPx = null, exitKind = null, j = i + 1, mfe = 0;
      for (; j < D.length; j++) {
        const b = D[j];
        // the add filled at this candle's open (signal on the previous close)
        if (add && add.pending) { add.e = b.open; add.stop = add.e - r0; add.pending = false; add.t = b.time; }
        // the add's stop sits above the first unit's (add >= entry + 1R, stop add - 1R >= entry), so it is checked first
        if (add && !add.pending && !add.out && b.low <= add.stop) { add.out = true; add.px = Math.min(b.open, add.stop); add.kind = 'stop'; }
        if (b.low <= stop) { exitPx = Math.min(b.open, stop); exitKind = 'stop'; break; }
        mfe = Math.max(mfe, (b.high - e) / r0);
        mid = Math.max(mid, (hiOf(D, j - N, j) + loOf(D, j - N, j)) / 2);
        if (b.close < mid) { if (j + 1 < D.length) { exitPx = D[j + 1].open; exitKind = 'mid'; j = j + 1; } break; }
        if (addAt && !add && b.close >= e + addAt * r0 && j + 1 < D.length) add = { pending: true };
      }
      const open = exitPx == null;
      if (open) { exitPx = D[D.length - 1].close; j = D.length - 1; }
      const u1g = (exitPx - e) / r0, u1 = { t: D[i + 1].time, entry: e, exit: exitPx, gross: u1g, cost: costR(e, r0), add: false };
      const units = [u1];
      if (add && !add.pending) {
        const px = add.out ? add.px : exitPx;
        units.push({ t: add.t, entry: add.e, exit: px, gross: (px - add.e) / r0, cost: costR(add.e, r0), add: true });
      }
      for (const u of units) u.R = u.gross - u.cost;
      const gross = units.reduce((s, u) => s + u.gross, 0), cost = units.reduce((s, u) => s + u.cost, 0);
      out.push({ coin, slot: N, sig: D[i].time, t: D[i + 1].time, exitT: D[j].time, entry: e, r0, r0pct: r0 / e, exitPx, exitKind: open ? 'open' : exitKind,
        open, gross, cost, R: gross - cost, add: units.length > 1, mfe, units });
      // the slot is free again the day it exits (a stop day can signal at its own close; a midpoint exit frees it from j)
      i = open ? D.length : j;
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

// ── statistics ──
export const mean = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
export function stats(trades, key = 'R') {
  const R = trades.map((x) => x[key]), n = R.length;
  if (!n) return { n: 0, R: 0, exp: null, t: null, maxDD: 0, wr: null };
  const m = mean(R), sd = n > 1 ? Math.sqrt(R.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1)) : 0;
  // drawdown of the realised equity curve, trades in exit order
  let eq = 0, pk = 0, dd = 0;
  for (const x of trades.slice().sort((a, b) => (a.exitT ?? a.t) - (b.exitT ?? b.t))) { eq += x[key]; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  return { n, R: +(m * n).toFixed(2), exp: +m.toFixed(3), t: sd > 0 ? +(m / (sd / Math.sqrt(n))).toFixed(2) : null, maxDD: +dd.toFixed(2), wr: +(R.filter((x) => x > 0).length / n).toFixed(3) };
}
export const yearOf = (t) => new Date(t * 1000).getUTCFullYear();
export const ts = (s) => Math.floor(Date.parse(s + 'T00:00:00Z') / 1000);
export const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export const sma = (D, i, n) => { if (i < n - 1) return null; let s = 0; for (let j = i - n + 1; j <= i; j++) s += D[j].close; return s / n; };
