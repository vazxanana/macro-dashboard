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
// `since0` resumes a paged read (Kraken's cursor from an earlier call); the array also carries .since, the cursor to resume from
export async function krakenTrades(pair, from, to, maxCalls = 900, since0 = null) {
  const out = [];
  let since = since0 || String(BigInt(Math.floor(from)) * 1000000000n), calls = 0, complete = false;
  while (calls < maxCalls) {
    calls++;
    const res = await call(`https://api.kraken.com/0/public/Trades?pair=${pair}&since=${since}&count=1000`);
    const key = Object.keys(res).find((k) => k !== 'last'), rows = res[key] || [];
    for (const t of rows) { const tm = +t[2]; if (tm >= from && tm < to) out.push([tm, +t[0]]); }
    const last = rows.length ? +rows[rows.length - 1][2] : Infinity;
    if (!rows.length || last >= to || res.last === since) {
      complete = true;
      // resume point for a later read of the same day past `to`: just after the last trade kept (the page's own cursor
      // would skip the trades between `to` and the page end); a repeated boundary trade changes no candle
      if (out.length) since = String(BigInt(Math.floor(out[out.length - 1][0] * 1e6)) * 1000n + 1n);
      break;
    }
    since = res.last;
    await sleep(process.env.KRAKEN_NO_WAIT ? 0 : 1100);   // Kraken allows about one public call a second
  }
  out.calls = calls; out.complete = complete; out.since = since;
  return out;
}

// join candles of the same day read in two parts (b's trades all come after a's): open from a, close from b
export function mergeCandles(a, b) {
  const m = new Map(a.map((x) => [x.time, { ...x }]));
  for (const x of b) { const y = m.get(x.time); if (!y) m.set(x.time, { ...x }); else { y.high = Math.max(y.high, x.high); y.low = Math.min(y.low, x.low); y.close = x.close; } }
  return [...m.values()].sort((p, q) => p.time - q.time);
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
      // a day an earlier run could not finish (the budget ran out inside it) resumes from Kraken's cursor: crypto prints
      // so many trades that one day takes more calls than a run's budget, so without this no past day ever completed
      const part = file && file.replace(/\.json$/, '.part.json');
      let prev = null; if (part && fs.existsSync(part)) { try { prev = JSON.parse(fs.readFileSync(part, 'utf8')); } catch (e) { prev = null; } }
      const tr = await krakenTrades(pair, d, end, budget - calls, prev && prev.since);
      calls += tr.calls;
      const got = prev ? mergeCandles(prev.bars, minuteCandles(tr)) : minuteCandles(tr);
      if (!tr.complete) {   // the budget ran out inside this day: keep what we have and where to go on; older days wait
        if (part) { try { fs.mkdirSync(cacheDir, { recursive: true }); fs.writeFileSync(part, JSON.stringify({ since: tr.since, bars: got })); } catch (e) {} }
        break;
      }
      bars = got; fetched++;
      // today (not finished yet): keep it with its cursor, so the next run reads only the trades since
      if (!whole && part) { try { fs.mkdirSync(cacheDir, { recursive: true }); fs.writeFileSync(part, JSON.stringify({ since: tr.since, bars })); } catch (e) {} }
      if (whole && file) { try { fs.mkdirSync(cacheDir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(bars)); if (part && fs.existsSync(part)) fs.unlinkSync(part); } catch (e) {} }
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

// Gold's spot offset through time, for the replay (backtest.mjs goldBasis): samples = spot H1 closes (H: [{time, close}],
// time = the hour's open) minus the PAXG 1m close (m1, time-ordered) of the last minute before that hour ends (a minute more
// than 10 min old adds no sample; |offset| >= 150 is ignored), as the live Trader's basisFor. offAt(t) = the median of the
// samples of the last 2 hours; with none, the newest sample's (the offset live keeps); before the first sample, the first
// one. null: no samples.
export function basisSeries(H, m1) {
  const S = []; let j = 0;   // samples [time, offset], time-ordered
  for (const h of H.slice().sort((a, b) => a.time - b.time)) {
    const s = h.time + 3600;
    while (j < m1.length && m1[j].time < s) j++;
    const p = m1[j - 1];   // the last PAXG minute before the hour closed; a stale one (> 10 min old) adds no sample
    if (!p || s - p.time > 600 || !isFinite(h.close)) continue;
    const o = h.close - p.close; if (Math.abs(o) < 150) S.push([s, +o.toFixed(3)]);
  }
  if (!S.length) return null;
  const med = (v) => { v = v.slice().sort((x, y) => x - y); const n = v.length; return +(n % 2 ? v[n >> 1] : (v[n / 2 - 1] + v[n / 2]) / 2).toFixed(3); };
  const offAt = (t) => {
    let lo = 0, hi = S.length - 1, k = -1;   // last sample at or before t
    while (lo <= hi) { const m = (lo + hi) >> 1; if (S[m][0] <= t) { k = m; lo = m + 1; } else hi = m - 1; }
    if (k < 0) return S[0][1];   // before the first sample: the first offset (the live Trader had one already)
    const w = []; for (let i = k; i >= 0 && t - S[i][0] <= 2 * 3600; i--) w.push(S[i][1]);
    if (w.length) return med(w);
    // no fresh sample (weekend, feed gap): the last offset is kept; live, the samples age out one by one, so the last
    // offset it computed was the newest sample's alone
    return S[k][1];
  };
  offAt.samples = S.length;
  return offAt;
}
