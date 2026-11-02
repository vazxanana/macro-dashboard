// Yahoo Finance chart API: the primary forex history source for the backtest (Dukascopy throttles GitHub's runners).
// Free, no key. Limits: 1m candles only for the last 30 days and at most 7 days per request; 5m/15m/30m for the
// last 60 days; 1h for the last 730 days; 1d without limit. Candles with any missing price are dropped.
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CHUNK = { '1m': 7 * 86400, '5m': 59 * 86400, '15m': 59 * 86400, '30m': 59 * 86400, '60m': 700 * 86400, '1d': 3650 * 86400 };
const REACH = { '1m': 29.5 * 86400, '5m': 59 * 86400, '15m': 59 * 86400, '30m': 59 * 86400, '60m': 725 * 86400, '1d': 20 * 365 * 86400 };

async function chart(sym, interval, p1, p2) {
  for (let a = 0; a < 5; a++) {
    for (const host of ['query1', 'query2']) {
      let r;
      try { r = await fetch(`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=${interval}&period1=${p1}&period2=${p2}&includePrePost=false`, { headers: { 'User-Agent': UA, Accept: 'application/json' } }); }
      catch (e) { continue; }
      if (r.status === 429 || r.status >= 500) continue;
      const j = await r.json().catch(() => null);
      const res = j && j.chart && j.chart.result && j.chart.result[0];
      if (!res) { const err = j && j.chart && j.chart.error; throw new Error(`Yahoo ${sym} ${interval}: ${err ? err.description || err.code : `HTTP ${r.status}`}`); }
      const ts = res.timestamp || [], q = (res.indicators && res.indicators.quote && res.indicators.quote[0]) || {};
      const out = [];
      for (let i = 0; i < ts.length; i++) {
        const o = q.open && q.open[i], h = q.high && q.high[i], l = q.low && q.low[i], c = q.close && q.close[i];
        if ([o, h, l, c].every((v) => v != null && isFinite(v) && v > 0)) out.push({ time: ts[i], open: o, high: Math.max(h, o, c), low: Math.min(l, o, c), close: c });
      }
      return out;
    }
    await sleep(2000 * (a + 1));
  }
  throw new Error(`Yahoo ${sym} ${interval}: throttled or unreachable`);
}

// Candles for [from, to), fetched in the chunks Yahoo allows and de-duplicated
export async function yahooBars(sym, interval, from, to) {
  const now = Math.floor(Date.now() / 1000);
  from = Math.max(from, now - REACH[interval]);
  const seen = new Map();
  for (let p1 = from; p1 < to; p1 += CHUNK[interval]) {
    const rows = await chart(sym, interval, p1, Math.min(to, p1 + CHUNK[interval]));
    for (const b of rows) if (b.time >= from && b.time < to) seen.set(b.time, b);
    await sleep(400);
  }
  return [...seen.values()].sort((a, b) => a.time - b.time);
}
