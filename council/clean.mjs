// Council · bad-print cleaner, shared by the live Trader (trader.mjs) and the daily replay (backtest.mjs) so both read the
// same candles. Moved unchanged from trader.mjs; only the exports are new.

// Bad prints: thin feeds (Kraken FX trades, stitched Yahoo/Dukascopy) carry the odd off-market tick that makes a 1,000-pip
// candle and a fake 160R trade. A wick longer than 50 times the median candle range of the last 100 candles is clipped to the
// body plus one median range; a candle whose body jumps 50 ranges away and comes straight back is flattened to the prior close.
// Forex (opts.wickK = 15) also clips a lone wick past 15 ranges that the next 3 candles never trade back into: on
// 3 Nov 10:12 one Kraken order spiked AUD/USD 35 pips for a minute (Yahoo saw nothing) and hit five stops. News spikes get revisited.
export const LTF_CLEAN = new Set(['1m', '5m', '15m', '30m']);   // the lone-wick rule: the timeframes trades are managed on, not the structure TFs
export function cleanBars(arr, o = {}) {
  const K = o.k || 50, WK = o.wickK || 0, RV = o.revisit || 3;
  let fixed = 0; const win = [], log = [];
  for (let i = 0; i < arr.length; i++) {
    const b = arr[i];
    const med = win.length >= 20 ? [...win].sort((x, y) => x - y)[win.length >> 1] : 0;
    if (med > 0) {
      const lim = K * med, p = arr[i - 1], n = arr[i + 1];
      if (p && n && Math.abs(b.close - p.close) > lim && Math.abs(n.open - p.close) < lim / 2) {
        Object.assign(b, { open: p.close, high: p.close, low: p.close, close: p.close }); fixed++; log.push([b.time, 'body']);
      }
      const top = Math.max(b.open, b.close), bot = Math.min(b.open, b.close);
      // a lone wick: far past the body and never traded near again in the next RV candles (needs those candles to exist)
      const next = arr.slice(i + 1, i + 1 + RV), lone = WK && next.length === RV;
      const hiLim = lone && next.every((x) => x.high < top + (b.high - top) / 2) ? WK * med : lim;
      const loLim = lone && next.every((x) => x.low > bot - (bot - b.low) / 2) ? WK * med : lim;
      if (b.high - top > hiLim) { log.push([b.time, 'high', +((b.high - top) / med).toFixed(0)]); b.high = top + med; fixed++; }
      if (bot - b.low > loLim) { log.push([b.time, 'low', +((bot - b.low) / med).toFixed(0)]); b.low = bot - med; fixed++; }
    }
    const r = b.high - b.low; if (r > 0) { win.push(r); if (win.length > 100) win.shift(); }
  }
  return o.log ? log : fixed;
}
