// Kraken trade history → 1m candles: the forex history source for the backtest. Kraken is the feed the live Trader
// trades on and it answers GitHub's runners (Yahoo and Dukascopy throttle them). Its OHLC endpoint only keeps the last
// 720 candles per timeframe, but the public Trades endpoint pages back through the whole history, 1000 trades a call.
// Crypto (8 Nov): Kraken's XBTUSD prints ~150-185k trades a day (~175 calls a day at 1,000 trades a call), so BTC's 30-day
// window plus its warm-up day is ~5,600 calls, about two hours at Kraken's ~1 public call a second (ETH ~48, SOL ~38, XRP ~29
// calls a day). The nightly replay can't spend that, so the light backfill (council/krakenfill.mjs, workflow
// kraken-backfill.yml) fills the per-day cache in time-boxed runs, and the replay takes a coin from Kraken as soon as the
// cache covers its window (krakenGap below); until then that coin stays on Binance, recorded in markets.source.
import fs from 'node:fs';
import path from 'node:path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = () => process.env.KRAKEN_BASE || 'https://api.kraken.com/0/public/';   // tests point it at a fake server
const noWait = () => !!process.env.KRAKEN_NO_WAIT;   // tests: no pacing, no back-off
export const PACE_MS = 1100;   // Kraken allows about one public call a second: calls start at least this far apart

let lastCall = 0;
async function call(url) {
  for (let a = 0; a < 6; a++) {
    // paced start to start: the call's own latency counts toward the gap (a fixed 1.1 s sleep after each call made BTC's
    // calls ~1.33 s apart in the 7 Nov runs)
    if (!noWait()) { const w = lastCall + PACE_MS - Date.now(); if (w > 0) await sleep(w); }
    lastCall = Date.now();
    try {
      const r = await fetch(url);
      const j = await r.json();
      if (j.error && j.error.length) {
        if (/too many|rate|throttl/i.test(j.error[0])) { if (!noWait()) await sleep(3000 * (a + 1)); continue; }
        throw new Error(j.error[0]);
      }
      return j.result;
    } catch (e) { if (a === 5) throw e; if (!noWait()) await sleep(1500 * (a + 1)); }
  }
  throw new Error('Kraken: too many requests');
}

// a cache file is written whole or not at all: a run cancelled mid-write must not leave half a JSON file behind
function writeAtomic(file, data) {
  try { fs.mkdirSync(path.dirname(file), { recursive: true }); const tmp = `${file}.${process.pid}.tmp`; fs.writeFileSync(tmp, data); fs.renameSync(tmp, file); } catch (e) {}
}
const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; } };
const dayStr = (d) => new Date(d * 1000).toISOString().slice(0, 10);
export const dayFile = (cacheDir, pair, d) => path.join(cacheDir, `kraken-${pair}-${dayStr(d)}.json`);
export const partFile = (cacheDir, pair, d) => path.join(cacheDir, `kraken-${pair}-${dayStr(d)}.part.json`);

// every trade in [from, to) as [time (s), price], at most maxCalls calls and none after `deadline` (ms epoch, 0 = none);
// the array also carries .calls and .complete (false when the call cap or the deadline stopped it before `to`)
// `since0` resumes a paged read (Kraken's cursor from an earlier call); the array also carries .since, the cursor to resume from
export async function krakenTrades(pair, from, to, maxCalls = 900, since0 = null, { deadline = 0 } = {}) {
  const out = [];
  let since = since0 || String(BigInt(Math.floor(from)) * 1000000000n), calls = 0, complete = false;
  while (calls < maxCalls && !(deadline && Date.now() >= deadline)) {
    calls++;
    const res = await call(`${BASE()}Trades?pair=${pair}&since=${since}&count=1000`);
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
// workflows keep it between runs), so a run only downloads days it hasn't seen; `budget` caps the calls per pair and
// run and `deadline` (ms epoch) stops it in time (EUR/USD prints ~90,000 trades a day: 38 days are ~3,400 calls, an hour).
// Returns the newest contiguous days it has (a day it couldn't finish ends the run of days) and where they start, plus
// `days`: the whole days it finished in this call with the calls each took in all (its .part.json keeps the count across runs).
export async function krakenMinutes(pair, from, to, { cacheDir = null, budget = 400, deadline = 0, now = Date.now() / 1000 } = {}) {
  const day0 = Math.floor(from / 86400) * 86400;
  let calls = 0, cached = 0, fetched = 0, out = [], first = to;
  const days = [];
  for (let d = Math.floor((to - 1) / 86400) * 86400; d >= day0; d -= 86400) {
    const end = Math.min(d + 86400, to), whole = end === d + 86400 && end <= now - 3600;   // finished (an hour of margin)
    const file = cacheDir && dayFile(cacheDir, pair, d);
    let bars = null;
    if (whole && file && fs.existsSync(file)) { bars = readJson(file); if (Array.isArray(bars)) cached++; else bars = null; }
    if (!bars) {
      if (calls >= budget || (deadline && Date.now() >= deadline)) break;
      // a day an earlier run could not finish (the budget ran out inside it) resumes from Kraken's cursor: crypto prints
      // so many trades that one day takes more calls than a run's budget, so without this no past day ever completed
      const part = file && partFile(cacheDir, pair, d);
      let prev = part && fs.existsSync(part) ? readJson(part) : null;
      if (prev && !(Array.isArray(prev.bars) && prev.since)) prev = null;
      const tr = await krakenTrades(pair, d, end, budget - calls, prev && prev.since, { deadline });
      calls += tr.calls;
      const got = prev ? mergeCandles(prev.bars, minuteCandles(tr)) : minuteCandles(tr), dayCalls = ((prev && prev.calls) || 0) + tr.calls;
      if (!tr.complete) {   // the budget or the time ran out inside this day: keep what we have and where to go on; older days wait
        if (part) writeAtomic(part, JSON.stringify({ since: tr.since, calls: dayCalls, bars: got }));
        break;
      }
      bars = got; fetched++;
      // today (not finished yet): keep it with its cursor, so the next run reads only the trades since
      if (!whole && part) writeAtomic(part, JSON.stringify({ since: tr.since, calls: dayCalls, bars }));
      if (whole) {
        days.push({ day: dayStr(d), calls: dayCalls, bars: bars.length });
        if (file) { writeAtomic(file, JSON.stringify(bars)); try { if (fs.existsSync(part)) fs.unlinkSync(part); } catch (e) {} }
      }
    }
    out = bars.concat(out); first = d;
  }
  return { bars: out, from: first, calls, cached, fetched, days };
}

// Kraken's own OHLC (the last 720 candles of a timeframe: 12 h of 1m, 15 days of 30m, 30 days of 1h)
export async function krakenOHLC(pair, minutes) {
  const res = await call(`${BASE()}OHLC?pair=${pair}&interval=${minutes}`);
  const key = Object.keys(res).find((k) => k !== 'last');
  return (res[key] || []).map((k) => ({ time: +k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4] }));
}

export function aggregate(m1, sec) {
  const out = []; let cur = null;
  for (const b of m1) {
    const t0 = Math.floor(b.time / sec) * sec;
    if (!cur || cur.time !== t0) { cur = { time: t0, open: b.open, high: b.high, low: b.low, close: b.close }; out.push(cur); }
    else { cur.high = Math.max(cur.high, b.high); cur.low = Math.min(cur.low, b.low); cur.close = b.close; }
  }
  return out;
}

// The replay's Kraken candles for one market: trades → 1m (whole UTC days, newest first, cached), 5m/15m/30m built from them;
// 1h = Kraken's 720 hourly candles plus older hours from the trades; 4h/1d = Kraken's own OHLC (the live Trader's candles).
// feeds: where each timeframe came from (all Kraken: one feed, never a mix), recorded per market by the replay.
export const KRAKEN_FEEDS = { '1m': 'Kraken trades', '5m': 'Kraken trades', '15m': 'Kraken trades', '30m': 'Kraken trades', '1h': 'Kraken OHLC (older hours: Kraken trades)', '4h': 'Kraken OHLC', '1d': 'Kraken OHLC' };
export async function krakenData(pair, from, to, opts = {}) {
  const K = await krakenMinutes(pair, from, to, opts), m1 = K.bars;
  if (!m1.length) return { K, data: null, feeds: null };
  const o60 = await krakenOHLC(pair, 60), o240 = await krakenOHLC(pair, 240), o1440 = await krakenOHLC(pair, 1440);
  const firstH = o60.length ? o60[0].time : Infinity, h1 = aggregate(m1.filter((b) => b.time < firstH), 3600).concat(o60);
  return { K, data: { '1m': m1, '5m': aggregate(m1, 300), '15m': aggregate(m1, 900), '30m': aggregate(m1, 1800), '1h': h1, '4h': o240, '1d': o1440 }, feeds: { ...KRAKEN_FEEDS } };
}

// Does Kraken's history cover a replay that needs 1m candles from `need` (s)? null when it does, else the reason (a string,
// recorded as the market's fallback). The replay uses Kraken for a coin only on null: the whole window from one feed.
export function krakenGap(K, data, need, minBars = 1440) {
  const cov = dayStr(K.from), have = data ? data['1m'].length : K.bars.length;
  if (data && K.from <= need && have >= minBars) return null;
  return `Kraken history from ${cov} only (${have} 1m candles, ${K.calls} calls, ${K.cached} days cached; needs ${new Date(need * 1000).toISOString().slice(0, 16)})`;
}

// What the cache holds for a pair, without a network call: the oldest day of the contiguous run of finished days ending
// yesterday (null: none), how many, and the day an unfinished backfill is inside (its cursor time and calls so far).
export function krakenCoverage(pair, cacheDir, now = Date.now() / 1000) {
  const today = Math.floor(now / 86400) * 86400;
  let d = today - 86400, n = 0;
  while (cacheDir && fs.existsSync(dayFile(cacheDir, pair, d))) { n++; d -= 86400; }
  const from = n ? d + 86400 : null, p = cacheDir ? readJson(partFile(cacheDir, pair, d)) : null;
  const partial = p && p.since ? { day: dayStr(d), at: new Date(Number(BigInt(p.since) / 1000000n)).toISOString().slice(0, 16), calls: p.calls || null } : null;
  return { from: from == null ? null : dayStr(from), fromT: from, days: n, partial };
}

// Union of two cache directories into `into` (the Actions cache keeps one directory per save: a run that saves after a
// concurrent one must not drop the other's days). Files only `from` has are copied; a finished day drops its .part.json; of
// two .part.json for the same day, the one further along (later cursor) wins. Returns the number of files taken from `from`.
export function mergeCacheDirs(from, into) {
  if (!fs.existsSync(from)) return 0;
  fs.mkdirSync(into, { recursive: true });
  let n = 0;
  for (const f of fs.readdirSync(from)) {
    const a = path.join(from, f), b = path.join(into, f);
    if (!fs.statSync(a).isFile() || f.endsWith('.tmp')) continue;
    if (f.endsWith('.part.json')) {
      if (fs.existsSync(path.join(from, f.replace(/\.part\.json$/, '.json'))) || fs.existsSync(b.replace(/\.part\.json$/, '.json'))) continue;
      const pa = readJson(a), pb = fs.existsSync(b) ? readJson(b) : null;
      const cur = (p) => { try { return BigInt(p.since); } catch (e) { return -1n; } };
      if (pa && pa.since && (!pb || cur(pa) > cur(pb))) { fs.copyFileSync(a, b); n++; }
      continue;
    }
    if (!fs.existsSync(b)) { fs.copyFileSync(a, b); n++; }
    if (/^kraken-.*\.json$/.test(f)) { const pb = b.replace(/\.json$/, '.part.json'); if (fs.existsSync(pb)) fs.unlinkSync(pb); }
  }
  return n;
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
