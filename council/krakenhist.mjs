// Kraken trade history → 1m candles: the forex history source for the backtest. Kraken is the feed the live Trader
// trades on and it answers GitHub's runners (Yahoo and Dukascopy throttle them). Its OHLC endpoint only keeps the last
// 720 candles per timeframe, but the public Trades endpoint pages back through the whole history, 1000 trades a call.
import fs from 'node:fs';
import path from 'node:path';

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

// every trade in [from, to) as [time (s), price], at most maxCalls calls; the array also carries .calls and .complete
// (false when the call cap stopped it before `to`)
export async function krakenTrades(pair, from, to, maxCalls = 900) {
  const out = [];
  let since = String(BigInt(Math.floor(from)) * 1000000000n), calls = 0, complete = false;
  while (calls < maxCalls) {
    calls++;
    const res = await call(`https://api.kraken.com/0/public/Trades?pair=${pair}&since=${since}&count=1000`);
    const key = Object.keys(res).find((k) => k !== 'last'), rows = res[key] || [];
    for (const t of rows) { const tm = +t[2]; if (tm >= from && tm < to) out.push([tm, +t[0]]); }
    const last = rows.length ? +rows[rows.length - 1][2] : Infinity;
    if (!rows.length || last >= to || res.last === since) { complete = true; break; }
    since = res.last;
    await sleep(1100);   // Kraken allows about one public call a second
  }
  out.calls = calls; out.complete = complete;
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

// 1m candles for whole UTC days from `from` to `to`, newest day first. Finished days are cached in cacheDir (the
// workflow keeps it between runs), so a run only downloads days it hasn't seen; `budget` caps the calls per pair and
// run (EUR/USD prints ~90,000 trades a day: 38 days are ~3,400 calls, an hour). Returns the newest contiguous days it
// has (a day it couldn't finish ends the run of days) and where they start.
export async function krakenMinutes(pair, from, to, { cacheDir = null, budget = 400 } = {}) {
  const day0 = Math.floor(from / 86400) * 86400, now = Date.now() / 1000;
  let calls = 0, cached = 0, fetched = 0, out = [], first = to;
  for (let d = Math.floor((to - 1) / 86400) * 86400; d >= day0; d -= 86400) {
    const end = Math.min(d + 86400, to), whole = end === d + 86400 && end <= now - 3600;   // finished (an hour of margin)
    const file = cacheDir && path.join(cacheDir, `kraken-${pair}-${new Date(d * 1000).toISOString().slice(0, 10)}.json`);
    let bars = null;
    if (whole && file && fs.existsSync(file)) { try { bars = JSON.parse(fs.readFileSync(file, 'utf8')); cached++; } catch (e) { bars = null; } }
    if (!bars) {
      if (calls >= budget) break;
      const tr = await krakenTrades(pair, d, end, budget - calls);
      calls += tr.calls;
      if (!tr.complete) break;   // the budget ran out inside this day: it and older days wait for the next run
      bars = minuteCandles(tr); fetched++;
      if (whole && file) { try { fs.mkdirSync(cacheDir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(bars)); } catch (e) {} }
    }
    out = bars.concat(out); first = d;
  }
  return { bars: out, from: first, calls, cached, fetched };
}

// Kraken's own OHLC (the last 720 candles of a timeframe)
export async function krakenOHLC(pair, minutes) {
  const res = await call(`https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=${minutes}`);
  const key = Object.keys(res).find((k) => k !== 'last');
  return (res[key] || []).map((k) => ({ time: +k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4] }));
}
