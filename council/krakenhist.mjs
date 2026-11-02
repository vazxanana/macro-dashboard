// Kraken trade history → 1m candles: the forex history source for the backtest. Kraken is the feed the live Trader
// trades on and it answers GitHub's runners (Yahoo and Dukascopy throttle them). Its OHLC endpoint only keeps the last
// 720 candles per timeframe, but the public Trades endpoint pages back through the whole history, 1000 trades a call.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(url) {
  for (let a = 0; a < 6; a++) {
    try {
      const r = await fetch(url);
      const j = await r.json();
      if (j.error && j.error.length) {
        if (/too many|rate|throttl/i.test(j.error[0])) { await sleep(3000 * (a + 1)); continue; }
        throw new Error(j.error[0]);
      }
      return j.result;
    } catch (e) { if (a === 5) throw e; await sleep(1500 * (a + 1)); }
  }
  throw new Error('Kraken: too many requests');
}

// every trade in [from, to) as [time (s), price]; maxCalls caps a runaway pair
export async function krakenTrades(pair, from, to, maxCalls = 900) {
  const out = [];
  let since = String(BigInt(Math.floor(from)) * 1000000000n), calls = 0;
  while (calls++ < maxCalls) {
    const res = await call(`https://api.kraken.com/0/public/Trades?pair=${pair}&since=${since}&count=1000`);
    const key = Object.keys(res).find((k) => k !== 'last'), rows = res[key] || [];
    for (const t of rows) { const tm = +t[2]; if (tm >= from && tm < to) out.push([tm, +t[0]]); }
    const last = rows.length ? +rows[rows.length - 1][2] : Infinity;
    if (!rows.length || last >= to || res.last === since) break;
    since = res.last;
    await sleep(1100);   // Kraken allows about one public call a second
  }
  return out;
}

// 1m candles from trades (minutes without a trade have no candle, like Kraken's own OHLC)
export function minuteCandles(trades) {
  const m = new Map();
  for (const [tm, p] of trades) {
    const t0 = Math.floor(tm / 60) * 60, b = m.get(t0);
    if (!b) m.set(t0, { time: t0, open: p, high: p, low: p, close: p, _t: tm });
    else { b.high = Math.max(b.high, p); b.low = Math.min(b.low, p); if (tm >= b._t) { b.close = p; b._t = tm; } }
  }
  return [...m.values()].sort((a, b) => a.time - b.time).map(({ _t, ...b }) => b);
}

// Kraken's own OHLC (the last 720 candles of a timeframe)
export async function krakenOHLC(pair, minutes) {
  const res = await call(`https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=${minutes}`);
  const key = Object.keys(res).find((k) => k !== 'last');
  return (res[key] || []).map((k) => ({ time: +k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4] }));
}
