// Council · Macro strategist (paper only, 7 Nov 2026, owner request): next-day direction odds for gold, EUR/USD (DXY),
// USD/JPY, NQ and ES, an event playbook for the next 1-5 days, a plain-language brief, and an honest scorecard.
//
// Knowledge: the 15-driver macro stack of gold-trading.html (computeDailyBias, dollarSmileRegime, refreshFundamentalsX:
// real yields as the master driver, macro composite, VIX, real-yield momentum, breakeven, 2Y, DXY momentum, COT, curve,
// HY spreads, Dollar Smile regime with SOFR−EFFR and swap lines, Eurozone growth pulse, yen carry-unwind risk), the owner's
// macro handbook as encoded there (Dollar Smile, global dollar liquidity, Germany/Eurozone, Japan carry), the Fed balance
// sheet liquidity gauge (WALCL − RRP − TGA), the pre-FOMC drift, and the CPI / NFP / FOMC days of council/events.mjs.
//
// Finds its own data, free and keyless only: FRED fredgraph.csv, the Forex Factory calendar JSON (faireconomy), Fed and ECB
// RSS, CFTC COT (Socrata), prices from the OANDA proxy (meridianx.dev/md/bars) with Kraken as a fallback. Every fetch has a
// timeout; a failed source falls back to the last good copy in macro/cache.json, then to "no data" for its drivers.
//
// Honesty (deep-research report "Macro next day forecasting", 7 Nov): next-day direction is barely forecastable, most macro
// drivers describe today rather than predict tomorrow, and the forecastable part is event-day VOLATILITY. So:
//  - P(up) = σ(logit(trailing base up-rate) + b·score), b fitted walk-forward on past days only with strong shrinkage
//    toward a small prior, capped to 0.35-0.65: a score with no edge collapses to the base rate;
//  - net liquidity and the pre-FOMC drift are context only (no weight); the VIX term structure (VIX/VIX3M) is the one
//    equity input with forward evidence (inverted curve → positive next-day ES/NQ returns);
//  - expected move: four simple models (same-type event median × vol ratio, EWMA, HAR-lite, VIX-implied) run walk-forward
//    against the naive 20-day mean absolute move on MAE and QLIKE; one is used for a market only if it is picked on the first
//    half of the replay and beats naive again on the second half, otherwise the naive forecast is kept (research/edge/macro-vol);
//  - scorecard: hit rate vs base rate, Brier skill vs base rate and coin flip, calibration, Pesaran-Timmermann test;
//    a driver counts as proven only with a replay t-stat ≥ 3 (weights are NOT tuned automatically);
//  - one immutable log entry per asset and day, written at the first run from 21:00 UTC before the day opens.
// Every forecast is for a candle that opens after the forecast time; FRED values are only used once their publication lag
// has passed (LAG). Never changes live rules or trades; writes only data/macro/ and its own block in analysis/latest.md.
//
// Usage: node council/macro.mjs [dataDir]   (dataDir = the council-data checkout, default "data")
import fs from 'node:fs';
import path from 'node:path';
import { injectSection } from './analyst.mjs';
import { readJson, writeAtomic, writeIfChanged } from './jsonio.mjs';
import { EVENTS, HISTORY } from './events.mjs';
import { MARKETS as COT_MARKETS, usableAt as cotUsableAt } from './cot.mjs';
// Gold Macro Score (8 Nov, owner: the macro-agent-demo skill's directional engine): council/macroscore.mjs, a paper reading
import { goldMacroScore, scoreLine, dxyDaily, dailyRows, weeklyFrame, isoDay as isoW } from './macroscore.mjs';

const DAY = 86400;
export const MD_BASE = process.env.MD_BASE || 'https://meridianx.dev/md/';
export const ASSETS = {
  gold:   { label: 'Gold', sym: 'xau', kraken: 'PAXGUSD' },
  eurusd: { label: 'EUR/USD', sym: 'eurusd', kraken: 'EURUSD' },
  usdjpy: { label: 'USD/JPY', sym: 'usdjpy' },
  nq:     { label: 'NQ (Nasdaq 100)', sym: 'nas100' },
  es:     { label: 'ES (S&P 500)', sym: 'spx500' },
};
export const AK = Object.keys(ASSETS);
const FX_EXTRA = { gbpusd: { sym: 'gbpusd', kraken: 'GBPUSD' }, usdcad: { sym: 'usdcad', kraken: 'USDCAD' }, usdchf: { sym: 'usdchf', kraken: 'USDCHF' } };   // for the ICE DXY proxy

// FRED series and their publication lag in days: an observation dated d may be used for a target day D only when
// d <= D - LAG. H.15 / VIX / HY / SOFR post the next business day; H.4.1 (WALCL, WTREGEN, SWPT) the day after the Wednesday;
// the broad dollar index weekly on Monday for the week before; the OECD confidence index about six weeks after its month.
export const LAG = { DFII10: 2, DGS2: 2, DGS10: 2, T10YIE: 2, T10Y3M: 2, BAMLH0A0HYM2: 2, VIXCLS: 2, VXVCLS: 2, DTWEXBGS: 10, WALCL: 2, RRPONTSYD: 2, WTREGEN: 2, SOFR: 2, EFFR: 2, SWPT: 2, BSCICP03DEM665S: 45 };
export const FRED = Object.keys(LAG);
// "GOLD" matches more than one contract (COMEX 100 oz and the micro): one row per report date, the largest book (8 Nov: the micro's
// ~−1k net was read as gold, 0th percentile). Old cached rows without gross keep the row with the largest |net|.
export function cotMain(rows) { const by = new Map(); for (const r of rows || []) { const k = r.t, sz = r.gross != null ? r.gross : Math.abs(r.net), o = by.get(k); if (!o || sz > (o.gross != null ? o.gross : Math.abs(o.net))) by.set(k, r); }
  return [...by.values()].sort((a, b) => a.t - b.t); }
// COT release clock (9 Nov data fix): the same rule as council/cot.mjs. A report is public from the first Monday after its as-of
// date (Friday normally, Monday in holiday weeks; before, a fixed 4-day lag used holiday-week reports up to 2 days early), and the
// 2025 shutdown backlog only once it was out (`usableAt`). `at` = the moment of the reading: the Macro strategist writes target
// day D's reading at 21:00 UTC on D−1 (`LOG_FROM`), so a report known from Monday enters Tuesday's forecast; the veteran reads now.
// The percentile is over the prior 156 weeks (3 years, cot.mjs's convention: share of those weeks at or below this net; null below
// 52 weeks, `pctWeeks` says how many). Before 9 Nov it was the last 60 rows of a 200-row pull that mixed in the micro contract
// (~100 report dates), so "3-year" was ~1 year.
export const COT_WEEKS = 156, COT_MIN_WEEKS = 52, COT_GOLD = (COT_MARKETS.find((m) => m.k === 'gold') || {}).code || '088691';
export function cotReading(rows, at) {
  const known = cotMain(rows).filter((r) => cotUsableAt(r.t) <= at); if (known.length < 5) return null;
  const i = known.length - 1, now = known[i], m4 = known[i - 4], hist = known.slice(Math.max(0, i - COT_WEEKS), i).map((r) => r.net);
  return { net: now.net, chg4w: now.t - m4.t <= 31 * DAY ? now.net - m4.net : null, pct: hist.length >= COT_MIN_WEEKS ? Math.round(hist.filter((x) => x <= now.net).length / hist.length * 100) : null,
    pctWeeks: hist.length, asOf: iso(now.t), knownAt: iso(cotUsableAt(now.t)) };
}

export const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const r2 = (x, d = 2) => x == null || !isFinite(x) ? null : +(+x).toFixed(d);
const sg = (x, d = 2) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const logit = (p) => Math.log(p / (1 - p)), sigm = (z) => 1 / (1 + Math.exp(-z));

// Event days come from the shared calendar council/events.mjs (#488): HISTORY (CPI, NFP, FOMC, Jan 2022 - Jul 2025, checked
// against EUR/USD 1-minute bars) plus EVENTS (Aug 2025 - Dec 2026, exact release times). The volatility engine models CPI,
// NFP and FOMC days, the types with 24+ events of history; on a shared day the bigger release wins (FOMC, then NFP, then CPI).
// Past the end of the calendar, the faireconomy feed names them (dayKind).
export const VOL_TYPES = ['FOMC', 'NFP', 'CPI'];
export const CAL = Object.freeze([...HISTORY, ...EVENTS]);
const CAL_TYPES = new Map();
for (const e of CAL) if (VOL_TYPES.includes(e.type)) { const d = iso(e.t), o = CAL_TYPES.get(d); if (!o || VOL_TYPES.indexOf(e.type) < VOL_TYPES.indexOf(o)) CAL_TYPES.set(d, e.type); }
export const CAL_END = CAL.reduce((m, e) => Math.max(m, e.t), 0);
export const eventTypeOn = (t) => CAL_TYPES.get(iso(t)) || null;
export const FOMC = new Set(CAL.filter((e) => e.type === 'FOMC').map((e) => iso(e.t)));

// ─── parsers ──────────────────────────────────────────────────────────────────────────────────────────────────────────
// fredgraph.csv: "observation_date,DFII10" (older files: "DATE,DFII10"), missing values "." or empty
export function parseFredCsv(text) {
  const out = [];
  for (const line of String(text || '').split(/\r?\n/).slice(1)) {
    const [d, v] = line.split(',');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '') || v == null || v.trim() === '' || v.trim() === '.') continue;
    const x = +v; if (!isFinite(x)) continue;
    out.push({ t: Date.parse(d + 'T00:00:00Z') / 1000, v: x });
  }
  return out.sort((a, b) => a.t - b.t);
}
// "0.3%" → 0.3, "185K" → 185000, "1.2M", "-0.1%", "<0.10%" → 0.1; "" → null
export function parseNum(s) {
  if (s == null) return null;
  const m = String(s).replace(/,/g, '').match(/(-?\d+(?:\.\d+)?)\s*([KMBT]?)/i);
  if (!m) return null;
  return +m[1] * ({ K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[m[2].toUpperCase()] || 1);
}
const stepOf = (s) => { const m = String(s || '').match(/\.(\d+)/); return m ? Math.pow(10, -m[1].length) : 1; };
// Forex Factory weekly JSON: [{ title, country, date: "2026-11-10T08:30:00-05:00", impact, forecast, previous, actual? }]
export function parseCalendar(j) {
  if (!Array.isArray(j)) return [];
  return j.map((e) => ({ title: String(e.title || '').trim(), country: String(e.country || '').toUpperCase(), at: Math.floor(Date.parse(e.date) / 1000),
    impact: String(e.impact || ''), forecast: e.forecast || '', previous: e.previous || '', actual: e.actual || '' }))
    .filter((e) => e.title && isFinite(e.at));
}
// Forex Factory weeks run Sunday to Saturday in New York time: the week an event belongs to (Sunday 00:00 UTC-5 epoch weeks)
export const calWeek = (t) => Math.floor((t - 5 * 3600 - 3 * DAY) / (7 * DAY));
// The calendar to use: every week a feed returned (`weeks`: one event list per feed, [] when it failed), plus the cached
// events of weeks no feed returned this run, from two weeks back on (older ones are history, kept in events.json).
export function mergeCalendar(weeks, cached, now) {
  const got = (weeks || []).flat(), have = new Set(got.map((e) => calWeek(e.at)));
  const old = (Array.isArray(cached) ? cached : []).filter((e) => e && isFinite(e.at) && e.at >= now - 14 * DAY && !have.has(calWeek(e.at)));
  return [...got, ...old].sort((a, b) => a.at - b.at);
}
const unxml = (s) => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, ' ').trim();
// RSS 2.0 <item> or Atom <entry>
export function parseRss(xml, src) {
  const out = [], s = String(xml || '');
  for (const m of s.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/g)) {
    const b = m[0], g = (tag) => { const x = b.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`)); return x ? unxml(x[1]) : ''; };
    const link = g('link') || ((b.match(/<link[^>]*href="([^"]+)"/) || [])[1] || '');
    const at = Math.floor(Date.parse(g('pubDate') || g('updated') || g('published') || g('dc:date')) / 1000);
    const title = g('title'); if (title) out.push({ src, title, link, at: isFinite(at) ? at : null });
  }
  return out;
}
// Cboe index history CSV ("DATE,OPEN,HIGH,LOW,CLOSE", dates MM/DD/YYYY): the fallback for VIX and VIX3M
export const CBOE = { VIXCLS: 'https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv', VXVCLS: 'https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX3M_History.csv' };
export function parseCboeCsv(text) {
  const lines = String(text || '').split(/\r?\n/), h = (lines[0] || '').toUpperCase().split(','), ci = h.indexOf('CLOSE'), di = h.indexOf('DATE');
  if (ci < 0 || di < 0) return [];
  return lines.slice(1).map((l) => { const c = l.split(','), m = String(c[di] || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/), v = +c[ci];
    return m && isFinite(v) && v > 0 ? { t: Date.UTC(+m[3], +m[1] - 1, +m[2]) / 1000, v } : null; }).filter(Boolean).sort((a, b) => a.t - b.t);
}
// ECB data API csvdata: header with TIME_PERIOD and OBS_VALUE
export function parseEcbCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter(Boolean), h = (lines[0] || '').split(','), ti = h.indexOf('TIME_PERIOD'), vi = h.indexOf('OBS_VALUE');
  if (ti < 0 || vi < 0) return [];
  return lines.slice(1).map((l) => { const c = l.split(','), d = c[ti], v = +c[vi]; return /^\d{4}-\d{2}-\d{2}$/.test(d || '') && c[vi] !== '' && isFinite(v) ? { t: Date.parse(d + 'T00:00:00Z') / 1000, v } : null; })
    .filter(Boolean).sort((a, b) => a.t - b.t);
}
// Kraken OHLC result → bars
export function parseKraken(j) {
  const k = j && j.result && Object.keys(j.result).find((x) => x !== 'last');
  return k ? j.result[k].map((r) => ({ time: +r[0], open: +r[1], high: +r[2], low: +r[3], close: +r[4] })) : [];
}

// ─── series access with publication lags (the no-look-ahead rule) ──────────────────────────────────────────────────────
function upto(arr, t, key = 't') { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m][key] <= t) lo = m + 1; else hi = m; } return lo; }   // count of items with key <= t
// a view of FRED series id as known for target day D
// a series whose newest usable value is older than this many days counts as no data (e.g. a discontinued FRED series)
export const MAX_AGE = { DTWEXBGS: 30, WALCL: 21, WTREGEN: 21, SWPT: 21, BSCICP03DEM665S: 120 };
export function fredView(fred, id, D) {
  const a = (fred && fred[id]) || [], n0 = upto(a, D - (LAG[id] || 2) * DAY), n = n0 && a[n0 - 1].t >= D - (MAX_AGE[id] || 15) * DAY ? n0 : 0;
  return { n, last: n ? a[n - 1] : null, back: (k) => (n - 1 - k >= 0 ? a[n - 1 - k] : null), at: (t) => { if (!n) return null; const i = upto(a, Math.min(t, D - (LAG[id] || 2) * DAY)); return i ? a[i - 1] : null; } };
}
// daily bars before D (weekdays only; the forming candle of the day before D counts with its latest price)
export const weekday = (t) => { const w = new Date(t * 1000).getUTCDay(); return w >= 1 && w <= 5; };
export function barsBefore(bars, D) { return (bars || []).slice(0, upto(bars || [], D - 1, 'time')).filter((b) => weekday(b.time)); }
// the next weekday candle that opens after `now`: the day a forecast made now is about
export function targetDay(now) { let D = Math.floor(now / DAY) * DAY + DAY; while (!weekday(D)) D += DAY; return D; }

// ICE DXY formula on OANDA pairs; SEK is not on the feed, so USD/SEK = 11.2 / EUR/USD (EUR/SEK held flat; it cancels in changes)
export function dxySeries(bars) {
  const m = {}; for (const k of ['eurusd', 'usdjpy', 'gbpusd', 'usdcad', 'usdchf']) for (const b of (bars[k] || [])) (m[b.time] = m[b.time] || {})[k] = b.close;
  return Object.entries(m).filter(([, r]) => Object.keys(r).length === 5).map(([t, r]) => ({ time: +t, close:
    50.14348112 * Math.pow(r.eurusd, -0.576) * Math.pow(r.usdjpy, 0.136) * Math.pow(r.gbpusd, -0.119) * Math.pow(r.usdcad, 0.091) * Math.pow(11.2 / r.eurusd, 0.042) * Math.pow(r.usdchf, 0.036) }))
    .sort((a, b) => a.time - b.time);
}

// ─── the driver stack ─────────────────────────────────────────────────────────────────────────────────────────────────
// Each driver votes +1 / −1 / 0 from gold's point of view (as in computeDailyBias), or null when it has no data. W turns the
// vote into each asset's direction: e.g. falling real yields lift gold, EUR/USD and the Nasdaq and pull USD/JPY down.
// Drivers with a `map` give each asset its own vote (Dollar Smile phases, each asset's own trend, the pre-FOMC drift).
// The Macro veteran's challengers (8 Nov, owner: "the veteran will argue with him to fortify his understanding and prediction"):
// the strategist's own drivers read over the veteran's 4-week window instead of the level or the 5-day move. They ride the
// replay like every driver (hit rate, t-stat) but carry no weight until a lesson adopts them: a challenger proven on the replay
// (t >= 3) that beats its incumbent's hit rate takes the incumbent's weights and the incumbent keeps half (lessons()). A
// challenger that stops being proven hands them back. Every adoption and reversal is an append-only record in macro/lessons.json.
export const CHALLENGERS = {
  v_ry4w: { vs: 'ry', weights: { gold: 3, eurusd: 1, usdjpy: -1.5, nq: 1.5, es: 1 } },
  v_d2_4w: { vs: 'dgs2', weights: { gold: 1, eurusd: 1, usdjpy: -1, nq: 0.5, es: 0.5 } },
  v_dxy4w: { vs: 'dxymom', weights: { gold: 1, eurusd: 1, usdjpy: -1, nq: 0.5, es: 0.5 } },
};
export const LESSON = { minN: 30, provenT: 3, keepT: 2, margin: 0.02 };
export const W = {
  ry:       { gold: 3, eurusd: 1, usdjpy: -1.5, nq: 1.5, es: 1 },
  macro:    { gold: 2 },
  vix:      { gold: 1, eurusd: -0.5, usdjpy: -0.5, nq: 0.5, es: 0.5 },
  rymom:    { gold: 2, eurusd: 1, usdjpy: -1, nq: 1, es: 0.5 },
  be:       { gold: 1 },
  dgs2:     { gold: 1, eurusd: 1, usdjpy: -1, nq: 0.5, es: 0.5 },
  dgs10:    { usdjpy: 1.5 },
  dxymom:   { gold: 1, eurusd: 1, usdjpy: -1, nq: 0.5, es: 0.5 },
  cot:      { gold: 1 },
  curve:    { gold: 1 },
  hy:       { gold: 1, eurusd: -0.5, usdjpy: -1, nq: -1, es: -1 },
  smile:    { gold: 1, eurusd: 1, usdjpy: 1, nq: 0.5, es: 0.5 },
  eugrowth: { gold: 1, eurusd: 1 },
  carry:    {},                     // volatility warning only (as in gold-trading.html)
  liq:      {},                     // context only: level correlations unstable, possibly spurious (research report)
  vixts:    { nq: 1, es: 1 },       // VIX above VIX3M (backwardation) → positive next-day equity returns; contango says nothing
  trend:    { gold: 1, eurusd: 1, usdjpy: 1, nq: 1, es: 1 },
  fomc:     {},                     // context only: the pre-FOMC drift faded after 2015 (research report)
};
const SMILE_MAP = { left: { gold: 0, eurusd: -1, usdjpy: -1, nq: -1, es: -1 }, right: { gold: -1, eurusd: -1, usdjpy: 1, nq: 0, es: 0 },
  trough: { gold: 1, eurusd: 1, usdjpy: 0, nq: 1, es: 1 }, mid: { gold: 0, eurusd: 0, usdjpy: 0, nq: 0, es: 0 } };

const chgOf = (v, k) => (v.last && v.back(k) ? v.last.v - v.back(k).v : null);
// port of applyRealYield (gold-trading.html): level + 1-week direction → bull / bear / neutral and a 0-10 score
export function realYieldState(v) {
  if (!v.last) return null;
  const level = v.last.v, chg = chgOf(v, 5) ?? 0, dir = chg <= -0.02 ? 'falling' : chg >= 0.02 ? 'rising' : 'flat';
  const lvl = level <= 0.5 ? 7 : level <= 1.0 ? 6 : level <= 1.5 ? 5 : level <= 2.0 ? 4 : level <= 2.5 ? 2 : 1;
  const score = clamp(lvl + (dir === 'falling' ? 3 : dir === 'rising' ? -3 : 0), 0, 10);
  const bias = dir === 'falling' && level <= 2.0 ? 'bull' : dir === 'rising' && level >= 1.0 ? 'bear' : level <= 0.75 ? 'bull' : level >= 2.5 ? 'bear' : 'neutral';
  return { level, chg, dir, score, bias };
}
const vixScore = (v) => v == null ? 4 : v >= 30 ? 6 : v >= 22 ? 5 : v >= 15 ? 4 : 3;
// port of dollarSmileRegime (macro handbook ch.1 & 7)
export function smileRegime({ dm, hy, d2, swapBn, sofrBps, vix, ryChg }) {
  if (dm == null && hy == null && vix == null) return null;
  const stress = (hy != null && hy >= 0.15) || (swapBn != null && swapBn >= 5) || (vix != null && vix >= 28) || (sofrBps != null && sofrBps >= 15);
  if (stress) return { phase: 'left', detail: 'crisis / dollar-funding stress' + (sofrBps != null && sofrBps >= 15 ? ` (SOFR−EFFR +${sofrBps}bp)` : swapBn != null && swapBn >= 5 ? ` (swap lines $${swapBn}bn)` : '') + ': USD bid, risk sold, gold whipsaws then gets the haven bid' };
  const calm = vix == null || vix < 22;
  if (dm != null && dm >= 0.25 && calm && ((ryChg != null && ryChg >= 0.02) || (d2 != null && d2 >= 0.03))) return { phase: 'right', detail: 'US outperformance: USD and real rates bid' };
  if (dm != null && dm <= -0.15 && calm && (hy == null || hy <= 0.05)) return { phase: 'trough', detail: 'synchronized global growth: USD offered' };
  return { phase: 'mid', detail: 'transitional: no dominant USD force' };
}

// Everything the drivers need for target day D, built only from data available before D
export function features(data, D, opt = {}) {
  const F = (id) => fredView(data.fred, id, D);
  const ry = realYieldState(F('DFII10'));
  const vixV = F('VIXCLS').last ? F('VIXCLS').last.v : null;
  const hyV = F('BAMLH0A0HYM2'), d2V = F('DGS2'), d10V = F('DGS10'), beV = F('T10YIE'), cvV = F('T10Y3M');
  const sofr = F('SOFR').last, effr = F('EFFR').last, sw = F('SWPT').last, eu = F('BSCICP03DEM665S');
  const bars = {}; for (const k of [...AK, ...Object.keys(FX_EXTRA)]) bars[k] = barsBefore(data.bars && data.bars[k], D);
  const dxy = dxySeries(bars), dxyNow = dxy.length ? dxy[dxy.length - 1].close : null;
  const dm = dxy.length > 5 ? dxyNow - dxy[dxy.length - 6].close : null;
  const uj = bars.usdjpy, jpyPct = uj.length > 5 ? (uj[uj.length - 1].close / uj[uj.length - 6].close - 1) * 100 : null;
  // global dollar liquidity: Fed balance sheet − reverse repo − Treasury General Account, $bn, 4-week change
  const netAt = (t) => { const w = F('WALCL').at(t), r = F('RRPONTSYD').at(t), g = F('WTREGEN').at(t); return w && r && g ? w.v / 1000 - r.v - g.v / 1000 : null; };
  const cut = D - 2 * DAY, liqNow = netAt(cut), liq4 = netAt(cut - 28 * DAY);
  const cot = cotReading(data.cot || [], D - LOG_FROM * 3600);
  const trend = {}, vol = {}, last = {};
  for (const k of AK) { const b = bars[k]; if (b.length >= 21) { const c = b[b.length - 1].close, sma = b.slice(-20).reduce((s, x) => s + x.close, 0) / 20; trend[k] = c > sma ? 1 : c < sma ? -1 : 0; last[k] = c; }
    const rets = b.slice(-21).map((x, i, a) => (i ? Math.log(x.close / a[i - 1].close) : null)).slice(1); vol[k] = rets.length >= 10 ? Math.sqrt(rets.reduce((s, x) => s + x * x, 0) / rets.length) * 100 : null; }
  const v3 = F('VXVCLS').last, e2 = F('ECB2Y');
  // the Macro veteran's windows (8 Nov): the same series over the 4 weeks the Gold Macro Score was tested on
  const ry4w = chgOf(F('DFII10'), 20), d2_4w = chgOf(d2V, 20), dxy4w = dxy.length > 20 ? +((dxyNow / dxy[dxy.length - 21].close - 1) * 100).toFixed(3) : null;
  return {
    ry4w: ry4w == null ? null : +ry4w.toFixed(4), d2_4w: d2_4w == null ? null : +d2_4w.toFixed(4), dxy4w,
    eu2y: e2.last ? { level: e2.last.v, chg: chgOf(e2, 5) } : null,
    D, ry, vix: vixV, vixTs: vixV != null && v3 && v3.v > 0 && Math.abs(F('VIXCLS').last.t - v3.t) <= 3 * DAY ? +(vixV / v3.v).toFixed(3) : null, hy: hyV.last ? { level: hyV.last.v, chg: chgOf(hyV, 5) } : null, d2: d2V.last ? { level: d2V.last.v, chg: chgOf(d2V, 5) } : null,
    d10: d10V.last ? { level: d10V.last.v, chg: chgOf(d10V, 5) } : null, be: beV.last ? { level: beV.last.v, chg: chgOf(beV, 5) } : null,
    curve: cvV.last ? cvV.last.v : null, sofrBps: sofr && effr ? Math.round((sofr.v - effr.v) * 100) : null, swapBn: sw ? +(sw.v / 1000).toFixed(1) : null,
    eu: eu.last && eu.back(5) ? { level: eu.last.v, chg: +(eu.last.v - eu.back(5).v).toFixed(1) } : null,
    dxy: dxyNow, dm, jpyPct, liq: liqNow != null ? { level: Math.round(liqNow), chg: liq4 != null ? Math.round(liqNow - liq4) : null } : null,
    broad: (() => { const b = F('DTWEXBGS'); return b.last && b.back(20) ? +(b.last.v / b.back(20).v * 100 - 100).toFixed(2) : null; })(),
    cot, trend, vol, last, fomcDay: FOMC.has(iso(D)) || !!opt.fomcDay,
  };
}

export function drivers(f) {
  const out = [], add = (k, name, cluster, v, detail, map) => out.push({ k, name, cluster, v, detail, map });
  const ry = f.ry, vx = f.vix;
  add('ry', 'Real yields (master driver)', 'rates', !ry ? null : ry.bias === 'bull' ? 1 : ry.bias === 'bear' ? -1 : 0, ry ? `10Y TIPS ${ry.level.toFixed(2)}%, ${ry.dir}` : 'no data');
  // macro composite (computeMacroScore + getMacroData): real-yield score, DXY level, seasonality, central-bank buying, VIX
  if (ry || f.dxy != null) {
    const tipsS = ry ? ry.score : 4, dxy = f.dxy ?? 104, dxyS = dxy <= 96 ? 10 : dxy <= 100 ? 8 : dxy <= 104 ? 6 : dxy <= 108 ? 4 : 2;
    const mo = new Date(f.D * 1000).getUTCMonth(), seasS = [10, 11, 0, 1].includes(mo) ? 9 : [2, 5].includes(mo) ? 5 : 7;
    const conf = Math.round(Math.min(40, tipsS + dxyS + seasS + 5 + vixScore(vx)) / 40 * 100);
    let L = conf >= 60, S = conf <= 40;
    if (ry) { if (ry.bias === 'bear') { L = false; if (dxyS <= 4) S = true; } else if (ry.bias === 'bull' && conf >= 54) { L = true; S = false; } }
    add('macro', 'Macro composite (TIPS, DXY, seasonal, CB buying, VIX)', 'dollar', L ? 1 : S ? -1 : 0, `${conf}% gold-supportive${f.dxy != null ? `, DXY ≈ ${f.dxy.toFixed(1)}` : ''}`);
  } else add('macro', 'Macro composite (TIPS, DXY, seasonal, CB buying, VIX)', 'dollar', null, 'no data');
  const vs = vixScore(vx);
  add('vix', 'Risk sentiment (VIX)', 'risk', vx == null ? null : vs >= 5 ? 1 : vs <= 3 ? -1 : 0, vx == null ? 'no data' : `VIX ${vx.toFixed(1)}${vx >= 22 ? ', elevated fear' : vx < 15 ? ', complacent' : ', normal'}`);
  add('rymom', 'Real-yield 1-week momentum', 'rates', !ry ? null : ry.chg <= -0.02 ? 1 : ry.chg >= 0.02 ? -1 : 0, ry ? `${sg(ry.chg * 100, 0)} bp a week` : 'no data');
  add('be', 'Inflation expectations (10Y breakeven)', 'rates', !f.be || f.be.chg == null ? null : f.be.chg >= 0.02 ? 1 : f.be.chg <= -0.02 ? -1 : 0, f.be ? `${f.be.level.toFixed(2)}%, ${f.be.chg != null ? sg(f.be.chg * 100, 0) + ' bp a week' : ''}` : 'no data');
  add('dgs2', 'Fed expectations (2Y yield trend)', 'rates', !f.d2 || f.d2.chg == null ? null : f.d2.chg <= -0.03 ? 1 : f.d2.chg >= 0.03 ? -1 : 0, f.d2 ? `${f.d2.level.toFixed(2)}%, ${sg((f.d2.chg || 0) * 100, 0)} bp a week` : 'no data');
  add('dgs10', 'US 10Y yield trend (US-Japan rate gap)', 'rates', !f.d10 || f.d10.chg == null ? null : f.d10.chg >= 0.05 ? 1 : f.d10.chg <= -0.05 ? -1 : 0, f.d10 ? `${f.d10.level.toFixed(2)}%, ${sg((f.d10.chg || 0) * 100, 0)} bp a week` : 'no data');
  add('dxymom', 'USD 5-day momentum (ICE DXY on OANDA)', 'dollar', f.dm == null ? null : f.dm <= -0.25 ? 1 : f.dm >= 0.25 ? -1 : 0, f.dm == null ? 'no data' : `${sg(f.dm)} pts in 5 sessions`);
  const ct = f.cot;
  add('cot', 'Funds positioning (COT managed money, gold)', 'positioning', !ct ? null : ct.pct != null && ct.pct >= 90 ? 0 : ct.chg4w == null ? 0 : ct.chg4w > 5000 ? 1 : ct.chg4w < -5000 ? -1 : 0, ct ? `${Math.round(ct.net / 1000)}k net, ${ct.chg4w == null ? '4-week change n/a' : `${sg(ct.chg4w / 1000, 0)}k in 4 weeks`}, ${ct.pct == null ? `percentile n/a (${ct.pctWeeks} weeks)` : `${ct.pct}th pct of 3 years`}${ct.pct >= 90 ? ' (crowded)' : ''}, week of ${ct.asOf}` : 'no data');
  add('curve', 'Yield curve (10Y−3M)', 'rates', f.curve == null ? null : f.curve < 0 ? 1 : 0, f.curve == null ? 'no data' : `${f.curve.toFixed(2)}%${f.curve < 0 ? ', inverted' : ''}`);
  add('hy', 'Credit stress (HY spreads)', 'risk', !f.hy || f.hy.chg == null ? null : f.hy.chg >= 0.08 ? 1 : f.hy.chg <= -0.08 ? -1 : 0, f.hy ? `${f.hy.level.toFixed(2)}%, ${sg((f.hy.chg || 0) * 100, 0)} bp a week` : 'no data');
  const sm = smileRegime({ dm: f.dm, hy: f.hy && f.hy.chg, d2: f.d2 && f.d2.chg, swapBn: f.swapBn, sofrBps: f.sofrBps, vix: vx, ryChg: ry && ry.chg });
  add('smile', 'Dollar Smile regime (USD cycle)', 'dollar', sm ? 0 : null, sm ? `${sm.phase}: ${sm.detail}` : 'no data', sm ? SMILE_MAP[sm.phase] : null);
  add('eugrowth', 'Eurozone growth pulse (OECD confidence, Germany)', 'dollar', !f.eu || Math.abs(f.eu.chg) < 0.3 ? (f.eu ? 0 : null) : f.eu.chg > 0 ? 1 : -1, f.eu ? `${f.eu.level.toFixed(1)}, ${sg(f.eu.chg, 1)} over 5 releases` : 'no data');
  // yen carry unwind (handbook ch.5): a volatility warning, deliberately non-directional (as in gold-trading.html)
  const carry = f.jpyPct != null && f.jpyPct <= -2 && vx != null && vx >= 22;
  add('carry', 'Yen carry-unwind risk (BoJ / VIX)', 'risk', null, f.jpyPct == null ? 'no data' : carry ? `USD/JPY ${f.jpyPct.toFixed(1)}% in 5 days with VIX ${vx.toFixed(0)}: active unwind risk, expect violent two-way moves` : `USD/JPY ${sg(f.jpyPct, 1)}% in 5 days: calm`);
  add('vixts', 'VIX term structure (VIX / VIX3M)', 'risk', f.vixTs == null ? null : f.vixTs > 1 ? 1 : 0, f.vixTs == null ? 'no data' : `${f.vixTs.toFixed(2)}${f.vixTs > 1 ? ': inverted (stress), stocks tend to bounce next day' : ': normal contango, no signal'}`);
  add('liq', 'Dollar liquidity (Fed balance sheet − RRP − TGA)', 'risk', !f.liq || f.liq.chg == null ? null : f.liq.chg >= 50 ? 1 : f.liq.chg <= -50 ? -1 : 0, f.liq ? `$${(f.liq.level / 1000).toFixed(2)}tn, ${f.liq.chg != null ? sg(f.liq.chg, 0) + 'bn in 4 weeks' : ''}` : 'no data');
  const tr = f.trend, hasT = AK.some((k) => tr[k] != null);
  add('trend', 'Own price trend (close vs 20-day mean)', 'positioning', hasT ? 0 : null, hasT ? AK.map((k) => `${ASSETS[k].label.split(' ')[0]} ${tr[k] > 0 ? 'above' : tr[k] < 0 ? 'below' : 'n/a'}`).join(', ') : 'no data', hasT ? Object.fromEntries(AK.map((k) => [k, tr[k] || 0])) : null);
  add('fomc', 'Fed decision day (context: the pre-FOMC drift faded after 2015)', 'event', 0, f.fomcDay ? 'Fed decision on the target day' : 'no Fed decision on the target day');
  // the veteran's challengers: 4-week changes (see CHALLENGERS); a falling real yield / 2Y / dollar over 4 weeks leans up for gold
  add('v_ry4w', 'Veteran: real yield, 4-week change', 'rates', f.ry4w == null ? null : f.ry4w <= -0.1 ? 1 : f.ry4w >= 0.1 ? -1 : 0, f.ry4w == null ? 'no data' : `10Y TIPS ${sg(f.ry4w * 100, 0)} bp in 4 weeks`);
  add('v_d2_4w', 'Veteran: Fed path (2Y), 4-week change', 'rates', f.d2_4w == null ? null : f.d2_4w <= -0.15 ? 1 : f.d2_4w >= 0.15 ? -1 : 0, f.d2_4w == null ? 'no data' : `2Y ${sg(f.d2_4w * 100, 0)} bp in 4 weeks`);
  add('v_dxy4w', 'Veteran: dollar (DXY), 4-week change', 'dollar', f.dxy4w == null ? null : f.dxy4w <= -1 ? 1 : f.dxy4w >= 1 ? -1 : 0, f.dxy4w == null ? 'no data' : `DXY ${sg(f.dxy4w, 2)}% in 4 weeks`);
  return { list: out, smile: sm, carry };
}

// score in [-1, 1] for one asset: weighted mean of the votes of the drivers that have data
// weights in force: W, except where a lesson has adopted a challenger (adopted: { driverKey: weights }, from lessons())
export const weightsOf = (k, adopted = null) => (adopted && adopted[k]) || W[k] || {};
export function assetScore(list, a, adopted = null) {
  let num = 0, den = 0; const used = [];
  for (const d of list) {
    const w = weightsOf(d.k, adopted)[a]; if (!w || d.v === null) continue;
    const vote = d.map ? (d.map[a] || 0) * Math.abs(w) : d.v * w;
    num += vote; den += Math.abs(w); if (vote) used.push({ k: d.k, name: d.name, dir: vote > 0 ? 'up' : 'down', w: Math.abs(w), detail: d.detail });
  }
  return { s: den ? num / den : 0, cover: den, used: used.sort((x, y) => y.w - x.w) };
}

// ─── calibration: P(up) = σ(a + b·score), fitted on past days only (MAP with priors, Newton steps) ─────────────────────
// a is anchored on the trailing base up-rate, b on a small prior (0.25: a full-agreement score moves the odds ~6 points),
// both strongly shrunk; outputs are capped to 0.35-0.65 (a higher number on a daily call means overfitting, not insight).
export const P_CAP = [0.35, 0.65];
export function fitPlatt(pairs, prior = {}) {
  const n = pairs.length, base = n ? clamp(pairs.reduce((s, p) => s + p.y, 0) / n, 0.3, 0.7) : 0.5;
  const a0 = prior.a0 ?? logit(base), b0 = prior.b0 ?? 0.25, ta = 1 / 0.15 ** 2, tb = 1 / 0.3 ** 2;
  let a = a0, b = b0;
  for (let it = 0; it < 25; it++) {
    let ga = ta * (a - a0), gb = tb * (b - b0), haa = ta, hab = 0, hbb = tb;
    for (const { s, y } of pairs) { const p = sigm(a + b * s), w = p * (1 - p); ga += p - y; gb += (p - y) * s; haa += w; hab += w * s; hbb += w * s * s; }
    const det = haa * hbb - hab * hab; if (!(det > 0)) break;
    const da = (hbb * ga - hab * gb) / det, db = (haa * gb - hab * ga) / det; a -= da; b -= db;
    if (Math.abs(da) + Math.abs(db) < 1e-7) break;
  }
  // the drivers keep their economic sign: a negative fit means "no edge here", not "trade the drivers backwards"
  if (b < 0) { b = 0; for (let it = 0; it < 25; it++) { let g = ta * (a - a0), h = ta; for (const { y } of pairs) { const p = sigm(a); g += p - y; h += p * (1 - p); } a -= g / h; } }
  return { a: +a.toFixed(4), b: +b.toFixed(4), n, base: +base.toFixed(3) };
}
export const probOf = (s, fit) => clamp(sigm(fit.a + fit.b * s), P_CAP[0], P_CAP[1]);

// ─── scoring ───────────────────────────────────────────────────────────────────────────────────────────────────────────
// Pesaran-Timmermann: are the predicted and the realised signs independent? ~N(0,1) under no skill; null when undefined
export function pesaranTimmermann(rows) {
  const n = rows.length; if (n < 20) return null;
  const P = rows.filter((r) => (r.p > 0.5 ? 1 : 0) === r.y).length / n, Py = rows.reduce((s, r) => s + r.y, 0) / n, Px = rows.filter((r) => r.p > 0.5).length / n;
  const Ps = Py * Px + (1 - Py) * (1 - Px), vP = Ps * (1 - Ps) / n;
  const vPs = ((2 * Py - 1) ** 2 * Px * (1 - Px)) / n + ((2 * Px - 1) ** 2 * Py * (1 - Py)) / n + (4 * Py * Px * (1 - Py) * (1 - Px)) / (n * n);
  return vP - vPs > 1e-12 ? r2((P - Ps) / Math.sqrt(vP - vPs), 2) : null;
}
// rows: [{ p, y }] → hit rate vs the base rate, Brier vs the coin flip (random walk, p = 0.5) and vs the base rate
// (climatology), log loss, calibration bins, Pesaran-Timmermann
export function scorecard(rows) {
  const n = rows.length; if (!n) return { n: 0 };
  const up = rows.reduce((s, r) => s + r.y, 0) / n, hit = rows.filter((r) => (r.p > 0.5 ? 1 : 0) === r.y).length / n, base = Math.max(up, 1 - up);
  const brier = rows.reduce((s, r) => s + (r.p - r.y) ** 2, 0) / n, clim = up * (1 - up);
  const ll = -rows.reduce((s, r) => s + (r.y ? Math.log(r.p) : Math.log(1 - r.p)), 0) / n;
  const BINS = [0, 0.4, 0.45, 0.48, 0.5, 0.52, 0.55, 0.6, 1.01];
  const calib = BINS.slice(0, -1).map((lo, i) => { const hi = BINS[i + 1], b = rows.filter((r) => r.p >= lo && r.p < hi); return { bin: `${Math.round(lo * 100)}-${Math.min(100, Math.round(hi * 100))}%`, n: b.length,
    p: b.length ? r2(b.reduce((s, r) => s + r.p, 0) / b.length, 3) : null, obs: b.length ? r2(b.reduce((s, r) => s + r.y, 0) / b.length, 3) : null }; });
  const ece = calib.reduce((s, c) => s + (c.n ? c.n * Math.abs(c.p - c.obs) : 0), 0) / n;
  return { n, upRate: r2(up, 3), hit: r2(hit, 3), base: r2(base, 3), edge: r2(hit - base, 3), z: r2((hit - base) / Math.sqrt(base * (1 - base) / n), 2), pt: pesaranTimmermann(rows),
    brier: r2(brier, 4), brierRW: 0.25, brierClim: r2(clim, 4), skillRW: r2(1 - brier / 0.25, 4), skillClim: r2(clim ? 1 - brier / clim : 0, 4), logLoss: r2(ll, 4), ece: r2(ece, 3), calib };
}
export const verdictOf = (sc) => !sc || !sc.n ? 'no record yet' : sc.n < 250 ? `only ${sc.n} days: too few to tell skill from luck (a 53% hit rate needs ~1,100)`
  : sc.skillClim > 0 && sc.pt != null && sc.pt > 1.96 ? 'some edge (beats the base rate; Pesaran-Timmermann significant)' : sc.skillRW > 0 ? 'no proven edge (about the base rate)' : 'no edge (worse than a coin flip)';

// ─── volatility engine ─────────────────────────────────────────────────────────────────────────────────────────────────
// Target: the absolute open-to-close move (%) of the UTC weekday candle D, forecast from complete candles before D only.
// Baseline: the naive mean absolute move of the last 20 days. Candidates (VOL_TRIED), each run walk-forward and scored on
// MAE and QLIKE against that baseline, on all days and on CPI / NFP / FOMC days:
//  evt  - the research recipe: median absolute move of the last 24 same-type event days × (20-day ÷ 1-year realized vol),
//         clamped 0.5-2.5; naive on other days (needs 8 past events of the type)
//  ewma - RiskMetrics EWMA variance (λ 0.94) × the asset's own E|r|/sd shape over the last year; on an event day × the mean
//         ratio of actual move to that forecast on the last 24 same-type days (needs 8, clamped 0.7-3)
//  har  - HAR-RV-lite on absolute moves: a + b·|r|(1d) + c·mean|r|(5d) + d·mean|r|(22d) + one dummy per event type, OLS on
//         the last 750 days, refitted every 20 days (needs 250 rows; a type needs 8 days in the window to get a dummy)
//  vix  - ES and NQ only: VIX/√252 × the mean ratio of actual move to it over the last year (VIX with its FRED lag)
// `cur` is the model before this change (median of 20 days × median event-day multiplier), kept as a reference only.
export const VOL_TRIED = ['evt', 'ewma', 'har', 'vix'];
export const VOL_NAMES = { naive: 'naive 20-day mean absolute move', cur: 'previous model (20-day median × event multiplier)', evt: 'same-type event median × vol ratio',
  ewma: 'EWMA vol × event-day ratio', har: 'HAR-lite with event dummies', vix: 'VIX-implied move' };
const median = (a) => { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; };
const sd = (a) => (a.length ? Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length) : null);
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
// least squares with a tiny ridge, Gauss-Jordan on the normal equations
export function ols(X, y, ridge = 1e-6) {
  const p = X[0].length, A = Array.from({ length: p }, () => new Array(p + 1).fill(0));
  for (let r = 0; r < X.length; r++) { const x = X[r]; for (let i = 0; i < p; i++) { for (let j = 0; j < p; j++) A[i][j] += x[i] * x[j]; A[i][p] += x[i] * y[r]; } }
  for (let i = 0; i < p; i++) A[i][i] += ridge * X.length;
  for (let c = 0; c < p; c++) {
    let pv = c; for (let r = c + 1; r < p; r++) if (Math.abs(A[r][c]) > Math.abs(A[pv][c])) pv = r;
    [A[c], A[pv]] = [A[pv], A[c]]; const d = A[c][c]; if (Math.abs(d) < 1e-12) return null;
    for (let j = c; j <= p; j++) A[c][j] /= d;
    for (let r = 0; r < p; r++) if (r !== c && A[r][c]) { const f = A[r][c]; for (let j = c; j <= p; j++) A[r][j] -= f * A[c][j]; }
  }
  return A.map((row) => row[p]);
}
// One walk-forward pass over an asset's daily candles before D. rows[i].f holds every model's forecast for candle i, made
// from candles 0..i-1 only; next(type, vix) is the forecast for D. typeOf(t) names the event type of a day (or null),
// vixAt(t) the VIX value usable for day t (or null).
export function volEngine(bars, { D = Infinity, typeOf = eventTypeOn, vixAt = null, lam = 0.94 } = {}) {
  const S = (bars || []).filter((b) => weekday(b.time) && !b.live && b.time < D && b.open > 0 && b.close > 0)
    .map((b) => ({ t: b.time, r: Math.log(b.close / b.open) * 100, a: Math.abs(b.close / b.open - 1) * 100, type: typeOf(b.time), v: vixAt ? vixAt(b.time) : null }));
  const n = S.length, cum = [0]; for (const x of S) cum.push(cum[cum.length - 1] + x.a);
  const am = (j, k) => (cum[j] - cum[j - k]) / k;   // mean |move| of the k days before j
  const pastA = {}, pastR = {};                      // per type: past event-day moves; past move / EWMA-base ratios
  let ew = null, har = null;
  const harX = (j, type, cols) => cols.map((c) => c === 0 ? 1 : c === 1 ? S[j - 1].a : c === 2 ? am(j, 5) : c === 3 ? am(j, 22) : type === VOL_TYPES[c - 4] ? 1 : 0);
  function fitHar(i) {
    if (har && har.at > i - 20 && har.at <= i) return har;
    const j0 = Math.max(22, i - 750); if (i - j0 < 250) return null;
    const cols = [0, 1, 2, 3, ...VOL_TYPES.map((T, q) => q + 4).filter((c) => { let k = 0; for (let j = j0; j < i; j++) if (S[j].type === VOL_TYPES[c - 4]) k++; return k >= 8; })];
    const X = [], y = []; for (let j = j0; j < i; j++) { X.push(harX(j, S[j].type, cols)); y.push(S[j].a); }
    const b = ols(X, y); har = b ? { at: i, cols, b } : null; return har;
  }
  function fc(i, type, vx) {
    if (i < 20) return null;
    const A = S.slice(Math.max(0, i - 250), i), a20 = S.slice(i - 20, i).map((x) => x.a), naive = am(i, 20);
    const ratio = clamp(sd(S.slice(i - 20, i).map((x) => x.r)) / sd(A.map((x) => x.r)) || 1, 0.5, 2.5);
    const ev = type ? (pastA[type] || []).slice(-24) : [];
    let cur = median(a20); if (ev.length >= 6) cur *= clamp(median(ev) / median(A.map((x) => x.a)), 0.7, 2.5);
    const evt = ev.length >= 8 ? median(ev) * ratio : naive;
    const shape = mean(A.map((x) => x.a)) / sd(A.map((x) => x.r)), base = ew != null && A.length >= 60 ? shape * Math.sqrt(ew) : null;
    const rt = type ? (pastR[type] || []).slice(-24) : [], mult = rt.length >= 8 ? clamp(mean(rt), 0.7, 3) : 1;
    const h = fitHar(i), harF = h ? Math.max(harX(i, type, h.cols).reduce((s, x, q) => s + x * h.b[q], 0), 0.25 * naive) : null;
    let vix = null;
    if (vixAt && vx > 0) { const cal = A.filter((x) => x.v > 0).map((x) => x.a / (x.v / Math.sqrt(252))); if (cal.length >= 120) vix = mean(cal) * vx / Math.sqrt(252); }
    return { naive, cur, evt, ewma: base != null ? base * mult : null, har: harF, vix, ewmaBase: base, ratio, evN: ev.length, mult: rt.length >= 8 ? mult : null };
  }
  const rows = [];
  for (let i = 0; i < n; i++) {
    const x = S[i], f = fc(i, x.type, x.v); rows.push({ t: x.t, type: x.type, a: x.a, f });
    if (x.type) { (pastA[x.type] = pastA[x.type] || []).push(x.a); if (f && f.ewmaBase) (pastR[x.type] = pastR[x.type] || []).push(x.a / f.ewmaBase); }
    if (i === 19) ew = mean(S.slice(0, 20).map((y) => y.r * y.r)); else if (i > 19) ew = lam * ew + (1 - lam) * x.r * x.r;
  }
  return { rows, n, next: (type = null, vx = null) => fc(n, type, vx) };
}
// QLIKE of an absolute-move forecast e (%), read as E|r| of a normal day: variance h = (π/2)·e², loss = ln h + r²/h
export const qlike = (e, a) => { const h = Math.PI / 2 * e * e; return Math.log(h) + a * a / h; };
const absErr = (e, a) => Math.abs(e - a);
// every model against the naive baseline on the same days: MAE, QLIKE, and the Diebold-Mariano t of the loss gap
// (positive = the model's loss is lower); on all days and on event days
export function volCompare(rows, keys = ['cur', ...VOL_TRIED]) {
  const R = rows.filter((r) => r.f && r.f.naive != null);
  const stat = (xs, k) => {
    const P = xs.filter((r) => r.f[k] != null && r.f[k] > 0); if (!P.length) return null;
    const dm = (L) => { const d = P.map((r) => L(r.f.naive, r.a) - L(r.f[k], r.a)), m = mean(d), s = sd(d.map((x) => x - m)); return s ? r2(m / (s / Math.sqrt(d.length)), 2) : null; };
    return { n: P.length, mae: r2(mean(P.map((r) => absErr(r.f[k], r.a))), 3), maeNaive: r2(mean(P.map((r) => absErr(r.f.naive, r.a))), 3),
      qlike: r2(mean(P.map((r) => qlike(r.f[k], r.a))), 3), qlikeNaive: r2(mean(P.map((r) => qlike(r.f.naive, r.a))), 3), dmMae: dm(absErr), dmQlike: dm(qlike) };
  };
  const ev = R.filter((r) => r.type), out = { n: R.length, eventDays: ev.length,
    eventAvgAbs: ev.length ? r2(mean(ev.map((r) => r.a)), 3) : null, otherAvgAbs: R.length > ev.length ? r2(mean(R.filter((r) => !r.type).map((r) => r.a)), 3) : null,
    from: R.length ? iso(R[0].t) : null, to: R.length ? iso(R[R.length - 1].t) : null, models: {} };
  for (const k of keys) out.models[k] = { all: stat(R, k), event: stat(ev, k) };
  return out;
}
// beats the baseline = lower MAE and lower QLIKE than naive, on all days and on event days
export const beatsNaive = (m) => !!(m && m.all && m.event && m.all.mae < m.all.maeNaive && m.all.qlike < m.all.qlikeNaive && m.event.mae < m.event.maeNaive && m.event.qlike < m.event.qlikeNaive);
const volGap = (m) => { const g = (x) => (x ? (x.maeNaive - x.mae) / x.maeNaive + (x.qlikeNaive - x.qlike) : 0); return g(m.all) + g(m.event); };
// The VIX model is for the US index futures only; VIX as usable for day t (FRED close with its publication lag)
export const VIX_ASSETS = ['nq', 'es'];
export const vixOf = (data) => (t) => { const v = fredView(data.fred, 'VIXCLS', t).last; return v ? v.v : null; };
export const volKeys = (asset) => VOL_TRIED.filter((k) => k !== 'vix' || !asset || VIX_ASSETS.includes(asset));
// The selection protocol, the same in the research script and in every live run. Rows = days where naive and every
// non-VIX candidate have a walk-forward forecast, split at the middle date. First half (selection): among the candidates that
// beat naive there, the one with the largest loss gap. Second half (confirmation): it is used only if it beats naive again;
// otherwise the naive 20-day mean is kept. With no candidate passing the first half, naive is kept as well.
export function volSelect(rows, asset = null) {
  const keys = volKeys(asset), cmpKeys = ['cur', ...keys];
  const R = rows.filter((r) => r.f && ['naive', 'cur', 'evt', 'ewma', 'har'].every((m) => r.f[m] != null));
  if (R.length < 120) return { used: 'naive', picked: null, tried: keys.length, reason: `only ${R.length} days with every forecast`, full: volCompare(R, cmpKeys) };
  const mid = R[R.length >> 1].t, sel = volCompare(R.filter((r) => r.t < mid), cmpKeys), conf = volCompare(R.filter((r) => r.t >= mid), cmpKeys);
  const picked = keys.filter((k) => beatsNaive(sel.models[k])).sort((a, b) => volGap(sel.models[b]) - volGap(sel.models[a]))[0] || null;
  const used = picked && beatsNaive(conf.models[picked]) ? picked : 'naive';
  const reason = !picked ? `none of the ${keys.length} models beat naive on the first half (to ${iso(mid)})` : used === 'naive' ? `${picked} won the first half but did not beat naive on the second half (from ${iso(mid)})`
    : `${picked} beat naive on both halves (split ${iso(mid)})`;
  return { used, picked, tried: keys.length, split: iso(mid), reason, full: volCompare(R, cmpKeys), selection: sel, confirmation: conf };
}
export const VOL_METHOD = 'Move size: the absolute open-to-close move of the next UTC weekday candle. Every model is run walk-forward on the replay days (only candles before each day; VIX with its FRED lag) and scored against the naive 20-day mean absolute move on MAE and QLIKE (ln h + r²/h, h = (π/2)·forecast²), on all days and on CPI / NFP / FOMC days (council/events.mjs). Models tried: evt (median of the last 24 same-type events × 20-day / 1-year vol), ewma (EWMA vol × event-day ratio), har (HAR-lite with event dummies), vix (VIX-implied, ES and NQ only); cur = the previous model, reference only. The rows are split at the middle date: a model is picked on the first half only if it beats naive on all four, and it is used only if it beats naive again on the second half. Otherwise the naive forecast is kept. dm* = Diebold-Mariano t of the loss gap (positive = better than naive).';
// the forecast for D of one asset: the given model's expected move (naive when it has none), and its basis in words
export function volForecast(bars, D, type = null, { vixAt = null, model = 'naive', engine = null } = {}) {
  const E = engine || volEngine(bars, { D, vixAt }), f = E.next(type, vixAt ? vixAt(D) : null);
  if (!f) return null;
  const use = f[model] != null ? model : 'naive';
  const basis = use === 'naive' ? 'naive: mean absolute move of the last 20 days'
    : use === 'ewma' ? `EWMA volatility${type && f.mult ? ` × ${f.mult.toFixed(2)} (actual vs forecast on the last ${Math.min(24, f.evN)} ${type} days)` : ''}`
    : use === 'evt' && type && f.evN >= 8 ? `median of the last ${Math.min(24, f.evN)} ${type} days × vol ratio ${f.ratio.toFixed(2)}` : VOL_NAMES[use] || use;
  return { exp: r2(f[use], 3), naive: r2(f.naive, 3), ratio: r2(f.ratio, 2), model: use, basis, f };
}

// walk-forward replay over past weekday candles: features as known before each day, calibration refitted on earlier days only
export function replay(data, { days = 1000, minTrain = 120, refit = 20, upto: lastD = Infinity } = {}) {
  const ref = (data.bars && data.bars.gold && data.bars.gold.length ? data.bars.gold : data.bars && data.bars.eurusd) || [];
  const Ds = ref.filter((b) => weekday(b.time) && !b.live && b.time < lastD).map((b) => b.time).slice(-days);
  const rows = Object.fromEntries(AK.map((k) => [k, []])), drv = Object.fromEntries(AK.map((k) => [k, {}])), vol = Object.fromEntries(AK.map((k) => [k, []]));
  const fits = Object.fromEntries(AK.map((k) => [k, null])), idx = {};
  for (const k of AK) idx[k] = new Map((data.bars[k] || []).filter((b) => !b.live).map((b) => [b.time, b]));
  let i = 0;
  for (const D of Ds) {
    const f = features(data, D), { list } = drivers(f);
    for (const k of AK) {
      const bar = idx[k].get(D); if (!bar || bar.close === bar.open || !(f.last[k] > 0)) continue;
      const y = bar.close > bar.open ? 1 : 0, sc = assetScore(list, k), past = rows[k];
      if (!fits[k] || i % refit === 0) fits[k] = past.length >= minTrain ? fitPlatt(past.map((r) => ({ s: r.s, y: r.y }))) : null;
      const p = fits[k] ? probOf(sc.s, fits[k]) : null;
      past.push({ D, s: sc.s, y, p });
      for (const d of list) { const w = (W[d.k] || {})[k] || (CHALLENGERS[d.k] ? CHALLENGERS[d.k].weights[k] : 0); if (!w || d.v === null) continue; const v = d.map ? d.map[k] || 0 : Math.sign(d.v * w); if (!v) continue;
        const t = drv[k][d.k] || (drv[k][d.k] = { n: 0, hit: 0 }); t.n++; if ((v > 0 ? 1 : 0) === y) t.hit++; }
    }
    i++;
  }
  // the volatility engine: one walk-forward pass per asset; its rows are scored on the same replay days
  const inD = new Set(Ds), eng = {};
  for (const k of AK) { eng[k] = volEngine(data.bars[k], { D: lastD, vixAt: VIX_ASSETS.includes(k) ? vixOf(data) : null }); vol[k] = eng[k].rows.filter((r) => inD.has(r.t)); }
  return { Ds, rows, drv, vol, eng };
}

// ─── event playbook ────────────────────────────────────────────────────────────────────────────────────────────────────
// Typical absolute move on the release day, in % (rough priors from the gold-trading.html playbooks, scaled by each asset's
// current volatility vs normal); `hot` = which way each asset should move when the print is hot / hawkish; cool = the reverse.
const T = (re, type, hot, move, extra = {}) => ({ re, type, hot, move, ...extra });
export const EVENT_TYPES = [
  T(/FOMC|Federal Funds Rate|Fed Chair|Powell|Fed Statement/i, 'Fed decision / Fed chair', { gold: -1, eurusd: -1, usdjpy: 1, nq: -1, es: -1 }, { gold: 1.1, eurusd: 0.6, usdjpy: 0.7, nq: 1.4, es: 1.0 }, { usd: true, words: ['hawkish', 'dovish'] }),
  T(/\bCPI\b|PCE|PPI|Average Hourly Earnings|Employment Cost|Inflation/i, 'Inflation', { gold: -1, eurusd: -1, usdjpy: 1, nq: -1, es: -1 }, { gold: 1.0, eurusd: 0.5, usdjpy: 0.6, nq: 1.3, es: 1.0 }, { usd: true }),
  T(/Non-?Farm|NFP|ADP|JOLTS|Job Openings/i, 'Jobs', { gold: -1, eurusd: -1, usdjpy: 1, nq: 0, es: 0 }, { gold: 0.9, eurusd: 0.5, usdjpy: 0.6, nq: 1.0, es: 0.8 }, { usd: true, relTol: 0.25 }),
  T(/Unemployment Rate/i, 'Jobs', { gold: -1, eurusd: -1, usdjpy: 1, nq: 0, es: 0 }, { gold: 0.9, eurusd: 0.5, usdjpy: 0.6, nq: 1.0, es: 0.8 }, { usd: true, low: true }),
  T(/Unemployment Claims|Jobless Claims/i, 'Jobless claims', { gold: -1, eurusd: -1, usdjpy: 1, nq: 0, es: 0 }, { gold: 0.3, eurusd: 0.2, usdjpy: 0.2, nq: 0.4, es: 0.3 }, { usd: true, low: true, relTol: 0.04 }),
  T(/GDP|Retail Sales|ISM|PMI|Durable|Consumer (Confidence|Sentiment)|Industrial Production/i, 'Growth', { gold: -1, eurusd: -1, usdjpy: 1, nq: 0, es: 0 }, { gold: 0.5, eurusd: 0.3, usdjpy: 0.4, nq: 0.8, es: 0.6 }, { usd: true }),
];
const ECB_T = T(/ECB|Main Refinancing|Monetary Policy Statement|Deposit Facility|Lagarde/i, 'ECB', { gold: 0, eurusd: 1, usdjpy: 0, nq: 0, es: 0 }, { gold: 0.5, eurusd: 0.7, usdjpy: 0.3, nq: 0.4, es: 0.3 }, { words: ['hawkish', 'dovish'] });
const EUR_T = T(/./, 'Euro-area data', { gold: 0, eurusd: 1, usdjpy: 0, nq: 0, es: 0 }, { gold: 0.2, eurusd: 0.4, usdjpy: 0.1, nq: 0.2, es: 0.2 });
const BOJ_T = T(/BOJ|Bank of Japan|Policy Rate|Ueda/i, 'BoJ', { gold: 0, eurusd: 0, usdjpy: -1, nq: 0, es: 0 }, { gold: 0.5, eurusd: 0.2, usdjpy: 1.0, nq: 0.6, es: 0.4 }, { words: ['hawkish', 'dovish'] });
const JPY_T = T(/./, 'Japan data', { gold: 0, eurusd: 0, usdjpy: -1, nq: 0, es: 0 }, { gold: 0.1, eurusd: 0.1, usdjpy: 0.4, nq: 0.1, es: 0.1 });
const USD_T = T(/./, 'US data', { gold: -1, eurusd: -1, usdjpy: 1, nq: 0, es: 0 }, { gold: 0.3, eurusd: 0.2, usdjpy: 0.2, nq: 0.3, es: 0.2 }, { usd: true });
const OTH_T = T(/./, 'Other', { gold: 0, eurusd: 0, usdjpy: 0, nq: 0, es: 0 }, { gold: 0.2, eurusd: 0.2, usdjpy: 0.2, nq: 0.2, es: 0.2 });
export function classify(ev) {
  if (ev.country === 'USD') return EVENT_TYPES.find((t) => t.re.test(ev.title)) || USD_T;
  if (ev.country === 'EUR') return ECB_T.re.test(ev.title) ? ECB_T : EUR_T;
  if (ev.country === 'JPY') return BOJ_T.re.test(ev.title) ? BOJ_T : JPY_T;
  return OTH_T;
}
const ARROW = (v) => v > 0 ? 'up' : v < 0 ? 'down' : 'mixed';
const fmtNum = (x, ref) => { if (x == null) return '—'; const u = /%/.test(ref) ? '%' : /K/i.test(ref) ? 'K' : /M/i.test(ref) ? 'M' : /B/i.test(ref) ? 'B' : '';
  const d = u === 'K' ? x / 1e3 : u === 'M' ? x / 1e6 : u === 'B' ? x / 1e9 : x; const dec = (String(ref).match(/\.(\d+)/) || ['', ''])[1].length; return d.toFixed(dec) + u; };
const evKey = (e) => `${e.country}|${e.title.replace(/\s+/g, ' ').trim()}`;
// a faireconomy calendar entry as a modelled event type (used past the end of council/events.mjs)
export const feedType = (e) => e.country !== 'USD' ? null : /FOMC Statement|Federal Funds Rate/i.test(e.title) ? 'FOMC' : /Non-?Farm/i.test(e.title) ? 'NFP' : /\bCPI\b/.test(e.title) ? 'CPI' : null;
// the event type of day D for the volatility engine (CPI / NFP / FOMC from council/events.mjs; the feed past its end), and
// a label: the type's release, or else the day's top high-impact release on the feed (context only, not modelled)
export function dayKind(D, cal = []) {
  const day = (cal || []).filter((e) => e.impact === 'High' && iso(e.at) === iso(D));
  let type = eventTypeOn(D);
  if (!type && D > CAL_END) type = day.map(feedType).filter(Boolean).sort((a, b) => VOL_TYPES.indexOf(a) - VOL_TYPES.indexOf(b))[0] || null;
  if (type) { const e = CAL.find((x) => x.type === type && iso(x.t) === iso(D)); return { type, title: e ? `${e.title}, ${e.at.slice(11, 16)} UTC` : type }; }
  const rank = (e) => (e.country === 'USD' ? 0 : e.country === 'EUR' || e.country === 'JPY' ? 1 : 2);
  const top = day.filter((e) => rank(e) < 2).sort((a, b) => rank(a) - rank(b))[0];
  return top ? { type: null, title: `${top.country} ${top.title}` } : { type: null, title: null };
}
// Surprise log: the consensus of every high-impact release we saw, and its actual when the feed carries one, so the hot /
// cool cut-offs can become ±1 SD of that release's past surprises once 8 are logged (until then: one reporting step).
export function logEvents(log, events) {
  const L = Array.isArray(log) ? log.slice() : [];
  for (const e of events) {
    if (e.impact !== 'High' || !e.forecast) continue;
    const id = `${evKey(e)}|${iso(e.at)}`, i = L.findIndex((x) => x.id === id), rec = { id, key: evKey(e), at: new Date(e.at * 1000).toISOString(), forecast: e.forecast, previous: e.previous || null, actual: e.actual || null };
    if (i < 0) L.push(rec); else if (!L[i].actual && e.actual) L[i] = { ...L[i], actual: e.actual };   // the consensus seen first is kept
  }
  return L.slice(-3000);
}
export function surpriseStats(log, key) {
  const s = (log || []).filter((x) => x.key === key && x.actual).map((x) => parseNum(x.actual) - parseNum(x.forecast)).filter((x) => isFinite(x));
  if (s.length < 8) return null;
  const sdv = sd(s.map((x) => x - s.reduce((a, b) => a + b, 0) / s.length));
  return { n: s.length, sd: sdv, hot: s.filter((x) => x > sdv).length / s.length, cool: s.filter((x) => x < -sdv).length / s.length };
}
// vol: { asset: { engine, model, vixAt } } from the live run (the model each asset uses after the selection protocol); without
// it, a fresh engine on `bars` and the naive forecast. The expected move is the day's: the engine's forecast for the event
// day's type (CPI / NFP / FOMC), else a normal day; made with the candles known now.
export function eventPlaybook(events, now, { bars = {}, log = [], days = 5, vol = null } = {}) {
  const end = now + days * DAY, V = {};
  for (const k of AK) V[k] = vol && vol[k] ? vol[k] : bars[k] && bars[k].length ? { engine: volEngine(bars[k]), model: 'naive' } : null;
  return events.filter((e) => e.impact === 'High' && e.at >= now - 3 * 3600 && e.at <= end).sort((a, b) => a.at - b.at).map((e) => {
    const t = classify(e), fc = parseNum(e.forecast), ac = parseNum(e.actual), st = surpriseStats(log, evKey(e));
    // a policy-rate decision is hot (hawkish) at any rate above consensus; data releases need one reporting step or ±1 SD
    const isRate = !!t.words && /Rate|Funds/i.test(e.title), step = stepOf(e.forecast);
    const tol = fc == null ? null : isRate ? 1e-6 : st ? st.sd : Math.max(step, (t.relTol || 0) * Math.abs(fc));
    const hotAt = fc == null ? null : t.low ? fc - tol : fc + tol, coolAt = fc == null ? null : t.low ? fc + tol : fc - tol;
    const D = Math.floor(e.at / DAY) * DAY, type = dayKind(D, events).type;
    const exp = {}, basis = {};
    for (const k of AK) { const vf = V[k] ? volForecast(null, D, type, V[k]) : null; exp[k] = vf ? r2(vf.exp, 2) : t.move[k]; basis[k] = vf ? vf.basis : 'event prior (no price history)'; }
    const hot = Object.fromEntries(AK.map((k) => [k, ARROW(t.hot[k])])), cool = Object.fromEntries(AK.map((k) => [k, ARROW(-t.hot[k])]));
    const [hw, cw] = t.words || ['hot', 'cool'];
    const rule = fc == null ? `no consensus published: judge it against the previous ${e.previous || 'print'}` : isRate ? `${hw} if the rate is above ${e.forecast} or the statement / press conference leans ${hw}, ${cw} if below ${e.forecast} or a ${cw} lean` :
      `${hw} if ${t.low ? '≤' : '≥'} ${fmtNum(hotAt, e.forecast)}, ${cw} if ${t.low ? '≥' : '≤'} ${fmtNum(coolAt, e.forecast)}, in line in between${st ? ` (±1 SD of ${st.n} logged surprises)` : ' (one reporting step; ±1 SD once 8 surprises are logged)'}`;
    const odds = st ? { hot: r2(st.hot, 2), inline: r2(1 - st.hot - st.cool, 2), cool: r2(st.cool, 2), basis: `${st.n} logged surprises` } : { hot: 0.25, inline: 0.5, cool: 0.25, basis: 'prior (no surprise history yet)' };
    let outcome = null;
    if (ac != null && fc != null) outcome = (t.low ? ac <= hotAt : ac >= hotAt) ? 'hot' : (t.low ? ac >= coolAt : ac <= coolAt) ? 'cool' : 'in-line';
    return { at: new Date(e.at * 1000).toISOString(), country: e.country, title: e.title, type: t.type, consensus: e.forecast || null, previous: e.previous || null, actual: e.actual || null, outcome,
      rule, expMovePct: exp, expBasis: basis, scenarios: [
        { name: hw, odds: odds.hot, when: fc == null ? `above ${e.previous || 'the previous'}` : `${t.low ? 'below' : 'above'} consensus`, moves: hot },
        { name: 'in line', odds: odds.inline, when: 'near consensus', moves: Object.fromEntries(AK.map((k) => [k, 'little; the prevailing trend resumes'])) },
        { name: cw, odds: odds.cool, when: fc == null ? `below ${e.previous || 'the previous'}` : `${t.low ? 'above' : 'below'} consensus`, moves: cool }],
      oddsBasis: odds.basis,
      note: t.type === 'Jobs' || t.type === 'Growth' || t.type === 'Jobless claims' ? 'Stocks: strong data can lift them (growth) or sink them (higher yields); follow the 10Y reaction. Bad news moves prices more than good news.' :
        t.type === 'BoJ' ? 'A big hawkish surprise can start a yen carry unwind: risk assets sold together for a day or two. The press conference often drives the move.' :
        t.type === 'Fed decision / Fed chair' ? 'Two stages: the statement, then the press conference, which often reverses the first move.' :
        t.type === 'ECB' ? 'The press conference often drives the move, not the decision.' :
        t.type === 'Inflation' ? 'Gold trades this through real yields: watch the TIPS reaction, not the headline.' : null };
  });
}

// ─── fetching (injectable fetch; every call has a timeout and never throws) ───────────────────────────────────────────
const UA = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' };
async function get(fetchImpl, url, kind = 'text', ms = 15000, headers = UA) {
  try { const r = await fetchImpl(url, { headers, signal: AbortSignal.timeout(ms) }); if (!r.ok) return { err: `HTTP ${r.status}` };
    const body = kind === 'json' ? await r.json() : await r.text(); return { body }; } catch (e) { return { err: String((e && e.message) || e).slice(0, 80) }; }
}
// run async jobs a few at a time (FRED throttles a burst of parallel requests from one runner)
async function pool(items, n, fn) { const q = items.slice(); await Promise.all(Array.from({ length: n }, async () => { while (q.length) await fn(q.shift()); })); }
// US Treasury daily par and real yield curves (CSV per year): the fallback for DGS2, DGS10, T10Y3M, DFII10 and T10YIE
export const TREASURY = (type, year) => `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all?type=${type}&field_tdr_date_value=${year}&page&_format=csv`;
export function parseTreasuryCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter(Boolean); if (lines.length < 2) return {};
  const h = lines[0].split(',').map((x) => x.replace(/"/g, '').trim().toLowerCase().replace(/\s+/g, ' ')), di = h.indexOf('date'); if (di < 0) return {};
  const out = {};
  for (const l of lines.slice(1)) { const c = l.split(',').map((x) => x.replace(/"/g, '').trim()), m = (c[di] || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (!m) continue;
    const t = Date.UTC(+m[3], +m[1] - 1, +m[2]) / 1000;
    h.forEach((k, i) => { if (i === di || c[i] === '' || !isFinite(+c[i])) return; (out[k] = out[k] || []).push({ t, v: +c[i] }); }); }
  for (const k in out) out[k].sort((a, b) => a.t - b.t);
  return out;
}
async function treasuryFallback(fetchImpl, now, data, src) {
  const need = (id) => !data.fred[id] || !data.fred[id].length, Y = new Date(now * 1000).getUTCFullYear(), years = [Y - 4, Y - 3, Y - 2, Y - 1, Y];
  if (!['DGS2', 'DGS10', 'T10Y3M', 'T10YIE', 'DFII10'].some(need)) return;
  const grab = async (type) => { const cols = {}; let ok = 0, err = null;
    await pool(years, 2, async (y) => { const r = await get(fetchImpl, TREASURY(type, y), 'text', 20000); const p = r.body ? parseTreasuryCsv(r.body) : {};
      if (Object.keys(p).length) { ok++; for (const k in p) cols[k] = (cols[k] || []).concat(p[k]); } else err = r.err || 'empty'; });
    for (const k in cols) cols[k].sort((a, b) => a.t - b.t);
    return { cols, ok, err }; };
  const col = (cols, ...names) => names.map((n) => cols[n]).find((a) => a && a.length);
  const by = (a) => new Map((a || []).map((o) => [o.t, o.v])), note = (id, m) => { src[`fred:${id}`] = `${src[`fred:${id}`] || 'FRED failed'}; ${m}`; };
  const nom = await grab('daily_treasury_yield_curve'), y2 = col(nom.cols, '2 yr'), y10 = col(nom.cols, '10 yr'), m3 = col(nom.cols, '3 mo');
  src['treasury:nominal'] = nom.ok ? `ok (${nom.ok} years)` : `failed (${nom.err})`;
  if (need('DGS2') && y2) { data.fred.DGS2 = y2; note('DGS2', 'Treasury 2Y ok'); }
  if (need('DGS10') && y10) { data.fred.DGS10 = y10; note('DGS10', 'Treasury 10Y ok'); }
  if (need('T10Y3M') && y10 && m3) { const b = by(m3); data.fred.T10Y3M = y10.filter((o) => b.has(o.t)).map((o) => ({ t: o.t, v: +(o.v - b.get(o.t)).toFixed(3) })); note('T10Y3M', 'Treasury 10Y − 3M ok'); }
  if (need('DFII10')) { const r = await grab('daily_treasury_real_yield_curve'), r10 = col(r.cols, '10 yr');
    src['treasury:real'] = r.ok ? `ok (${r.ok} years)` : `failed (${r.err})`;
    if (r10) { data.fred.DFII10 = r10; note('DFII10', 'Treasury real 10Y ok'); } }
  if (need('T10YIE') && y10 && data.fred.DFII10) { const b = by(data.fred.DFII10); data.fred.T10YIE = y10.filter((o) => b.has(o.t)).map((o) => ({ t: o.t, v: +(o.v - b.get(o.t)).toFixed(3) })); note('T10YIE', 'Treasury 10Y − real 10Y ok'); }
}
const FRED_TRY = [[{ 'User-Agent': 'macro-dashboard-council/1.0 (+https://meridianx.dev)', Accept: 'text/csv,*/*' }, 20000], [UA, 10000]];
export async function gather(fetchImpl, now, cache = {}) {
  const src = {}, data = { fred: {}, bars: {}, cot: [], cal: [], rss: [] };
  const cosd = iso(now - 5 * 365 * DAY);
  // FRED: four at a time; a plain client first, then once more with a browser user agent. After 4 series in a row fail,
  // FRED counts as unreachable for this run and the rest go straight to the fallbacks (the run has a 3-minute budget).
  let fredFails = 0;
  await pool(FRED, 4, async (id) => {
    let r = { err: 'skipped: FRED unreachable this run' }, obs = [];
    if (fredFails < 4) {
      for (const [h, ms] of FRED_TRY) { r = await get(fetchImpl, `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${cosd}`, 'text', ms, h); obs = r.body ? parseFredCsv(r.body) : []; if (obs.length) break; }
      fredFails = obs.length ? 0 : fredFails + 1;
    }
    if (obs.length) { data.fred[id] = obs; src[`fred:${id}`] = `ok, last ${iso(obs[obs.length - 1].t)}`; return; }
    const cb = CBOE[id] ? await get(fetchImpl, CBOE[id]) : null, co = cb && cb.body ? parseCboeCsv(cb.body).filter((o) => o.t >= now - 5 * 365 * DAY) : [];
    if (co.length) { data.fred[id] = co; src[`fred:${id}`] = `FRED failed (${r.err || 'empty'}), Cboe ok, last ${iso(co[co.length - 1].t)}`; }
    else src[`fred:${id}`] = `failed (${r.err || 'empty'})`;
  });
  await treasuryFallback(fetchImpl, now, data, src);
  // still missing: the last good copy from an earlier run
  for (const id of FRED) if ((!data.fred[id] || !data.fred[id].length) && cache.fred && cache.fred[id] && cache.fred[id].length) {
    data.fred[id] = cache.fred[id].map(([d, v]) => ({ t: Date.parse(d + 'T00:00:00Z') / 1000, v })); src[`fred:${id}`] += `, using cache to ${cache.fred[id][cache.fred[id].length - 1][0]}`; }
  // euro-area 2Y government yield (ECB AAA curve), context for the US-euro rate gap
  { const r = await get(fetchImpl, 'https://data-api.ecb.europa.eu/service/data/YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_2Y?format=csvdata&lastNObservations=60');
    const obs = r.body ? parseEcbCsv(r.body) : [];
    if (obs.length) { data.fred.ECB2Y = obs; src['ecb:2y'] = `ok, last ${iso(obs[obs.length - 1].t)}`; } else src['ecb:2y'] = `failed (${r.err || 'empty'})`; }
  const ALL = { ...ASSETS, ...FX_EXTRA };
  await Promise.all(Object.entries(ALL).map(async ([k, m]) => {
    const r = await get(fetchImpl, `${MD_BASE}bars?sym=${m.sym}&tf=1d&n=1400`, 'json', 15000);
    let bars = r.body && Array.isArray(r.body.bars) ? r.body.bars.filter((b) => b && b.time && b.close > 0) : [];
    if (bars.length >= 30) { data.bars[k] = bars; src[`bars:${k}`] = `OANDA ok (${bars.length} days)`; return; }
    if (m.kraken) { const q = await get(fetchImpl, `https://api.kraken.com/0/public/OHLC?pair=${m.kraken}&interval=1440`, 'json', 12000);
      bars = q.body ? parseKraken(q.body) : [];
      if (bars.length) { const lastT = Math.floor(now / DAY) * DAY; data.bars[k] = bars.map((b) => (b.time >= lastT ? { ...b, live: true } : b)); src[`bars:${k}`] = `OANDA failed (${r.err || 'empty'}), Kraken ok (${bars.length} days)`; return; } }
    data.bars[k] = []; src[`bars:${k}`] = `failed (${r.err || 'empty'})`;
  }));
  // calendar: this week + next week; the feed rate-limits, so keep the last good copy
  const weeks = [];
  for (const w of ['thisweek', 'nextweek']) {
    const r = await get(fetchImpl, `https://nfs.faireconomy.media/ff_calendar_${w}.json`, 'json', 12000);
    const ev = r.body ? parseCalendar(r.body) : [];
    src[`calendar:${w}`] = ev.length ? `ok (${ev.length} events)` : `failed (${r.err || 'empty'})`;
    weeks.push(ev);
  }
  // a week that failed keeps its events from the last good copy (9 Nov: one throttled feed used to drop that whole week,
  // e.g. tomorrow's CPI, from the playbook and from the cache)
  data.cal = mergeCalendar(weeks, cache.cal, now);
  const kept = data.cal.length - weeks.reduce((s, ev) => s + ev.length, 0);
  if (kept > 0) src['calendar:cache'] = `using the last good copy for ${weeks.some((ev) => ev.length) ? 'the week that failed' : 'both weeks'} (${kept} cached event${kept === 1 ? '' : 's'})`;
  const feeds = [['Fed', 'https://www.federalreserve.gov/feeds/press_all.xml'], ['ECB', 'https://www.ecb.europa.eu/rss/press.html'], ['BoJ', 'https://www.boj.or.jp/en/rss/whatsnew.xml']];
  await Promise.all(feeds.map(async ([name, url]) => { const r = await get(fetchImpl, url, 'text', 12000); const it = r.body ? parseRss(r.body, name) : [];
    src[`rss:${name}`] = it.length ? `ok (${it.length} items)` : `failed (${r.err || 'empty'})`; data.rss.push(...it.slice(0, 10)); }));
  // the COMEX 100 oz contract only (by its CFTC code; "commodity_name='GOLD'" also returned the micro, half of a 200-row pull), 600
  // weeks: the 3-year percentile window behind the 1000-day replay plus room
  const q = 'https://publicreporting.cftc.gov/resource/72hh-3qpy.json?$select=report_date_as_yyyy_mm_dd,m_money_positions_long_all,m_money_positions_short_all'
    + '&$where=' + encodeURIComponent(`cftc_contract_market_code='${COT_GOLD}'`) + '&$order=' + encodeURIComponent('report_date_as_yyyy_mm_dd DESC') + '&$limit=600';
  const c = await get(fetchImpl, q, 'json', 15000);
  if (Array.isArray(c.body) && c.body.length) { data.cot = c.body.map((r) => ({ t: Date.parse(String(r.report_date_as_yyyy_mm_dd).slice(0, 10) + 'T00:00:00Z') / 1000, net: (+r.m_money_positions_long_all || 0) - (+r.m_money_positions_short_all || 0), gross: (+r.m_money_positions_long_all || 0) + (+r.m_money_positions_short_all || 0) }))
    .filter((r) => isFinite(r.t)); data.cot = cotMain(data.cot); src.cot = `ok (${data.cot.length} weeks)`; }
  else if (Array.isArray(cache.cot) && cache.cot.length) { data.cot = cotMain(cache.cot); src.cot = `failed (${c.err || 'empty'}), using cache`; }
  else src.cot = `failed (${c.err || 'empty'})`;
  return { data, src };
}

// ─── Gold Macro Score inputs (8 Nov) ───────────────────────────────────────────────────────────
// Twenty years of DFII10 / DGS2 / DGS10 from FRED (the expanding z-scores need the history; gather() stops at 5 years), the
// ICE DXY from the council's own daily candle cache (council-data research/daily/*.json, since 2002) and gold's daily closes
// for the 10-week tiebreaker. A failed FRED read falls back to the weekly values kept in macro/cache.json plus this run's
// 5-year daily data, so one bad fetch does not blank the score.
export const SCORE_FRED = ['DFII10', 'DGS2', 'DGS10'];
export async function scoreSeries(fetchImpl, now, { dir = 'data', data = { fred: {}, bars: {} }, cache = {}, src = {} } = {}) {
  const out = {}, C = (cache.score && cache.score.fred) || {};
  for (const id of SCORE_FRED) {
    let obs = [], err = '';
    for (const [h, ms] of FRED_TRY) { const r = await get(fetchImpl, `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=2006-01-01`, 'text', ms, h); err = r.err || err; obs = r.body ? parseFredCsv(r.body) : []; if (obs.length) break; }
    if (obs.length) { out[id] = obs; src[`score:${id}`] = `ok, ${obs.length} days to ${iso(obs[obs.length - 1].t)}`; continue; }
    const wk = (C[id] || []).map(([d, v]) => ({ t: Date.parse(d + 'T00:00:00Z') / 1000, v })), recent = (data.fred && data.fred[id]) || [];
    const lastW = wk.length ? wk[wk.length - 1].t : -Infinity;
    out[id] = wk.concat(recent.filter((o) => o.t > lastW));
    src[`score:${id}`] = out[id].length ? `FRED long history failed (${err || 'empty'}): ${wk.length} cached weeks + ${recent.length} recent days` : `failed (${err || 'empty'})`;
  }
  const rd = (k) => { try { return dailyRows(JSON.parse(fs.readFileSync(path.join(dir, 'research', 'daily', `${k}.json`), 'utf8'))); } catch (e) { return null; } };
  // this run's closed daily candles (the forming day left out)
  const fromBars = (k) => ((data.bars && data.bars[k]) || []).filter((b) => b && b.close > 0 && !b.live && Math.floor(b.time / DAY) * DAY + DAY <= now).map((b) => ({ t: Math.floor(b.time / DAY) * DAY, v: b.close }));
  // the candle cache (research/daily, refreshed on Saturdays) carries the long history; this run's closes extend it past its
  // last day (9 Nov: from Monday to Friday the DXY and gold used to stop at the cache's last day, up to six days old)
  const ext = (c, k) => { const lt = c[c.length - 1].t; return c.concat(fromBars(k).filter((o) => o.t > lt)); };
  const daily = {}; let cached = 0;
  for (const k of ['eurusd', 'usdjpy', 'gbpusd', 'usdcad', 'usdchf']) { const d = rd(k); if (d && d.length) { daily[k] = ext(d, k); cached++; } else daily[k] = fromBars(k); }
  const dxy = dxyDaily(daily), goldD = rd('xau'), gold = goldD && goldD.length ? ext(goldD, 'gold') : fromBars('gold');
  src['score:dxy'] = dxy.length ? `${dxy.length} days (${cached === 5 ? 'daily cache since ' + iso(dxy[0].t) : `${cached} of 5 pairs cached, rest from this run's bars`})` : 'no DXY (pairs missing)';
  return { ry: out.DFII10 || [], y2: out.DGS2 || [], y10: out.DGS10 || [], dxy, gold };
}
// weekly [date, value] per series for macro/cache.json (small, and enough to rebuild the score when FRED is down)
export function scoreCache(S) {
  const fred = {};
  for (const [id, key] of [['DFII10', 'ry'], ['DGS2', 'y2'], ['DGS10', 'y10']]) { const F = weeklyFrame({ v: S[key] || [] }, '2006-01-01'); fred[id] = F.weeks.map((t, i) => [isoW(t), F.cols.v[i]]).filter(([, v]) => v != null); }
  return { fred };
}

// ─── history: an append-only log, one forecast per asset per target day ───────────────────────────────────────────────
// The entry is written once, at the first run from LOG_FROM hours before the day opens (21:00 UTC ≈ the 17:00 New York
// roll) and before it opens; it is never rewritten. It is resolved on the day's close (up = close > open).
export const LOG_FROM = 3;
export function updateHistory(hist, fc, now) {
  const H = Array.isArray(hist) ? hist.slice() : [], D = Date.parse(fc.target + 'T00:00:00Z') / 1000;
  if (now >= D || now < D - LOG_FROM * 3600) return H;   // never for a day that has started; not before the cutoff
  for (const a of AK) {
    const f = fc.assets[a]; if (!f || f.pUp == null) continue;
    const id = `${fc.target}-${a}`; if (H.some((h) => h.id === id)) continue;
    H.push({ id, asset: a, target: fc.target, at: fc.at, p: f.pUp, s: f.score, base: f.fit ? f.fit.base : null, expAbs: f.expMovePct, naiveAbs: f.naiveMovePct, volModel: f.volModel || null, event: fc.targetEvent || null,
      regime: fc.regime.label, top: f.drivers.slice(0, 3).map((d) => `${d.k}:${d.dir}`) });
  }
  return H;
}
export function resolveHistory(hist, bars) {
  for (const h of hist) {
    if (h.y != null || h.void) continue;
    const D = Date.parse(h.target + 'T00:00:00Z') / 1000;
    if (!(Date.parse(h.at) / 1000 < D)) { h.void = 'forecast not made before the day opened'; continue; }   // look-ahead guard
    const b = (bars[h.asset] || []).find((x) => x.time === D);
    if (!b || b.live) continue;
    if (b.close === b.open) { h.void = 'flat day'; continue; }
    h.y = b.close > b.open ? 1 : 0; h.ret = r2((b.close / b.open - 1) * 100, 3); h.abs = r2(Math.abs(h.ret), 3); h.hit = (h.p > 0.5 ? 1 : 0) === h.y;
  }
  return hist;
}

// ─── report text ───────────────────────────────────────────────────────────────────────────────────────────────────────
const WD = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
const HM = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const pct = (p) => `${Math.round(p * 100)}%`;
// words for a probability, relative to the base up-rate (the honest anchor), not to 50%
export function leanWord(p, base = 0.5) { const t = p - base; return Math.abs(t) < 0.01 ? 'base rate, no macro tilt' : `macro tilt ${t > 0 ? 'up' : 'down'} ${Math.round(Math.abs(t) * 100)} pt${Math.round(Math.abs(t) * 100) === 1 ? '' : 's'}`; }
const short = (n) => n.replace(/\s*\(.*\)$/, '').toLowerCase();
const usdOf = (m) => (m === 'down' ? 'up' : m === 'up' ? 'down' : 'mixed');
export function makeBrief(fc) {
  const L = [], tgt = new Date(Date.parse(fc.target + 'T00:00:00Z'));
  L.push(`Macro strategist, ${WD.format(new Date(fc.at))} ${HM.format(new Date(fc.at))} UTC, for ${WD.format(tgt)} (UTC day, open to close). Regime: ${fc.regime.label}.${fc.targetEvent ? ` ${WD.format(tgt)} is an event day (${fc.targetEvent}): expect bigger moves.` : ''}`);
  for (const a of AK) { const f = fc.assets[a]; if (!f || f.pUp == null) { L.push(`${ASSETS[a].label}: no forecast (no price data).`); continue; }
    const up = f.score >= 0 ? 'up' : 'down', pro = f.drivers.filter((d) => d.dir === up).slice(0, 2).map((d) => short(d.name)), con = f.drivers.filter((d) => d.dir !== up).slice(0, 1).map((d) => short(d.name));
    L.push(`${ASSETS[a].label}: ${pct(f.pUp)} up (base rate ${f.fit ? pct(f.fit.base) : '?'}; ${leanWord(f.pUp, f.fit ? f.fit.base : 0.5)}${f.fit && f.fit.b === 0 ? ', the replay finds no edge in its drivers' : ''}).${pro.length ? ` Drivers lean ${up}: ${pro.join(', ')}${con.length ? `; against: ${con[0]}` : ''}.` : ''} Expected move ±${f.expMovePct ?? '?'}%${f.volModel && f.volModel !== 'naive' ? ` (${VOL_NAMES[f.volModel]})` : ' (20-day average)'}.`); }
  if (fc.dxy) L.push(`DXY: ${pct(fc.dxy.pUp)} up (mirror of EUR/USD).`);
  if (fc.goldScore) L.push(scoreLine(fc.goldScore));
  const ev = fc.playbook.slice(0, 4);
  if (ev.length) L.push('Coming up: ' + ev.map((e) => `${e.country} ${e.title} ${WD.format(new Date(e.at))} ${HM.format(new Date(e.at))} UTC${e.consensus ? ` (consensus ${e.consensus}, previous ${e.previous || '—'})` : ''}${e.outcome ? `, came in ${e.outcome}` : `: if ${e.scenarios[0].name}, gold ${e.scenarios[0].moves.gold}, USD ${usdOf(e.scenarios[0].moves.eurusd)}, NQ ${e.scenarios[0].moves.nq}; gold usually moves ±${e.expMovePct.gold}%`}`).join('; ') + '.');
  else L.push(`No high-impact events in the next 5 days on the calendar we could read${fc.sources && /failed/.test(fc.sources['calendar:nextweek'] || '') ? " (next week's calendar is not published yet; it usually appears over the weekend)" : ''}.`);
  const g = fc.scorecard.replay.gold;
  if (g && g.n) L.push(`Honesty check: on the ${g.n}-day walk-forward replay the gold calls hit ${pct(g.hit)} against a ${pct(g.base)} base rate (Brier ${g.brier} vs ${g.brierRW} for a coin flip, Pesaran-Timmermann ${g.pt ?? 'n/a'}): ${verdictOf(g)}. Treat the direction odds as context, not trade signals.`);
  const vl = volLine(fc); if (vl) L.push(vl);
  return L.join(' ');
}
// the move-size model's own record, in words: which markets use a model and how it scored, and what the naive baseline does
export function volLine(fc) {
  const V = fc.scorecard && fc.scorecard.vol; if (!V || !V.gold || !V.gold.full) return '';
  const tried = Math.max(...AK.map((a) => (V[a] ? V[a].tried : 0))), using = AK.filter((a) => V[a] && V[a].used !== 'naive');
  const fm = (x) => `MAE ${x.mae} vs ${x.maeNaive}, QLIKE ${x.qlike} vs ${x.qlikeNaive}`;
  const parts = using.map((a) => { const m = V[a].full.models[V[a].used];
    return `${ASSETS[a].label} uses the ${VOL_NAMES[V[a].used]}, which beat the naive 20-day average on both halves of the replay (all days ${fm(m.all)}; CPI / NFP / FOMC days ${fm(m.event)})`; });
  const rest = AK.filter((a) => !using.includes(a)), gf = V.gold.full;
  const naiveTxt = rest.length ? `${rest.length === AK.length ? 'all five markets keep' : `${rest.map((a) => ASSETS[a].label).join(', ')} keep${rest.length === 1 ? 's' : ''}`} the naive 20-day average: none of the ${tried} models tried beat it out of sample on both MAE and QLIKE, on all days and on CPI / NFP / FOMC days` : '';
  const ev = gf.eventDays ? ` CPI / NFP / FOMC days moved gold ${gf.eventAvgAbs}% on average against ${gf.otherAvgAbs}% on other days${rest.includes('gold') ? ', but no model turned that into a better forecast' : ''}.` : '';
  return `Move size: ${[...parts, naiveTxt].filter(Boolean).join('. ')}.${ev}`;
}
export const MACRO_START = '<!-- macro:start -->', MACRO_END = '<!-- macro:end -->';
export function macroSection(fc) {
  if (!fc || !fc.assets) return '';
  const out = [MACRO_START, '## Macro strategist', '', `Built by the Macro strategist at ${fc.at.slice(0, 16).replace('T', ' ')} UTC for ${fc.target} (paper only, changes no rule or trade; full view in macro/forecast.json). Regime: **${fc.regime.label}**.`, '',
    ...(fc.goldScore ? [scoreLine(fc.goldScore).replace(/\|/g, '/'), ''] : []),
    '| Market | P(up) | Lean | Exp. move | Main drivers | Replay hit / base | Brier vs coin |', '|---|---|---|---|---|---|---|'];
  for (const a of AK) { const f = fc.assets[a], sc = fc.scorecard.replay[a] || {};
    out.push(`| ${ASSETS[a].label} | ${f && f.pUp != null ? pct(f.pUp) : '—'} | ${f && f.pUp != null ? leanWord(f.pUp, f.fit ? f.fit.base : 0.5) : '—'} | ${f && f.expMovePct != null ? `±${f.expMovePct}% (${f.volModel === 'naive' || !f.volModel ? '20-day avg' : f.volModel})` : '—'} | ${f ? f.drivers.slice(0, 3).map((d) => `${short(d.name)} ${d.dir}`).join('; ').replace(/\|/g, '/') : '—'} | ${sc.n ? `${pct(sc.hit)} / ${pct(sc.base)} (${sc.n} d)` : '—'} | ${sc.n ? `${sc.brier} vs 0.25` : '—'} |`); }
  if (fc.playbook.length) { out.push('', 'Next high-impact events:'); for (const e of fc.playbook.slice(0, 6)) out.push(`- ${e.at.slice(0, 16).replace('T', ' ')} UTC ${e.country} ${e.title}${e.consensus ? ` (cons. ${e.consensus}, prev. ${e.previous || '—'})` : ''}: ${e.rule}; ${e.scenarios[0].name} → gold ${e.scenarios[0].moves.gold}, EUR/USD ${e.scenarios[0].moves.eurusd}, USD/JPY ${e.scenarios[0].moves.usdjpy}, NQ ${e.scenarios[0].moves.nq}.`); }
  if (fc.learned) { const a = fc.learned.active || []; out.push('', `Lessons from the Macro veteran: ${a.length ? `${a.length} challenger${a.length === 1 ? '' : 's'} adopted (${a.join(', ')})` : 'no challenger has beaten its incumbent on the replay yet'}; ${Object.entries(fc.learned.challengers || {}).map(([c, x]) => `${c} ${x.challenger ? `hit ${x.challenger.hit} t ${x.challenger.t}` : 'no record'} vs ${x.vs} ${x.incumbent ? `hit ${x.incumbent.hit} t ${x.incumbent.t}` : 'no record'}`).join('; ')}.`); }
  out.push('', fc.brief.replace(/\|/g, '/'), MACRO_END);
  return out.join('\n');
}

// ─── one run ───────────────────────────────────────────────────────────────────────────────────────────────────────────
// ─── lessons: what the strategist adopts from the veteran's challengers (append-only records) ───────────────────────────
// stats: the replay's driver hit rates for gold ({ k: { n, hit, t, proven } }). A challenger is adopted when it is proven (t >=
// LESSON.provenT, n >= minN) and its incumbent is not, or it beats the incumbent's hit rate by LESSON.margin; it is reverted when
// its t falls under LESSON.keepT or the incumbent is proven and ahead by the margin. The decision uses the replay to today, so it
// is recorded with its date and the live log judges the adopted strategist from there on.
export function lessons(prev, stats, now) {
  const L = Array.isArray(prev) ? prev.slice() : [], at = new Date(now * 1000).toISOString();
  const state = {}; for (const r of L) state[r.challenger] = r.action === 'adopt';
  for (const [c, def] of Object.entries(CHALLENGERS)) {
    const cs = stats[c], is = stats[def.vs], on = !!state[c];
    const cProven = cs && cs.n >= LESSON.minN && cs.t >= LESSON.provenT, iProven = is && is.n >= LESSON.minN && is.t >= LESSON.provenT;
    if (!on && cProven && (!iProven || cs.hit >= is.hit + LESSON.margin)) {
      L.push({ at, challenger: c, incumbent: def.vs, action: 'adopt', stats: { challenger: cs, incumbent: is || null }, why: `${c} proven on the replay (hit ${cs.hit}, t ${cs.t}, n ${cs.n})${iProven ? ` and ahead of ${def.vs} (hit ${is.hit})` : `; ${def.vs} not proven${is ? ` (hit ${is.hit}, t ${is.t})` : ''}`}` }); state[c] = true;
    } else if (on && (!cs || cs.t < LESSON.keepT || (iProven && is.hit >= cs.hit + LESSON.margin))) {
      L.push({ at, challenger: c, incumbent: def.vs, action: 'revert', stats: { challenger: cs || null, incumbent: is || null }, why: !cs ? `${c} has no replay record` : cs.t < LESSON.keepT ? `${c} no longer proven (t ${cs.t})` : `${def.vs} is ahead again (hit ${is.hit} vs ${cs.hit})` }); state[c] = false;
    }
  }
  const adopted = {};
  for (const [c, def] of Object.entries(CHALLENGERS)) if (state[c]) { adopted[c] = { ...def.weights }; adopted[def.vs] = Object.fromEntries(Object.entries(W[def.vs] || {}).map(([a, w]) => [a, +(w / 2).toFixed(2)])); }
  return { records: L, adopted, active: Object.keys(state).filter((c) => state[c]) };
}

export function buildForecast(data, now, { src = {}, history = [], eventLog = [], goldScore = null, lessons: prevLessons = [] } = {}) {
  const D = targetDay(now), Dn = iso(D), cal = data.cal || [];
  const dk = dayKind(D, cal);
  const f = features(data, D, { fomcDay: dk.type === 'FOMC' }), { list, smile, carry } = drivers(f);
  const rp = replay(data, { upto: D });
  const assets = {}, scRe = {}, drvRe = {}, vs = {}, volUse = {};
  // a driver counts as proven only with a t-stat of 3 or more on the replay (research: after counting every variant tried)
  for (const a of AK) drvRe[a] = Object.fromEntries(Object.entries(rp.drv[a]).filter(([, t]) => t.n >= 30).map(([k, t]) => { const h = t.hit / t.n, tt = (h - 0.5) / Math.sqrt(0.25 / t.n); return [k, { n: t.n, hit: r2(h, 3), t: r2(tt, 2), proven: tt >= 3 }]; }));
  // the veteran's lessons: challengers proven on the replay take their incumbent's weights (see lessons())
  const learned = lessons(prevLessons, drvRe.gold || {}, now), adopted = Object.keys(learned.adopted).length ? learned.adopted : null;
  for (const a of AK) {
    const rows = rp.rows[a], fit = fitPlatt(rows.map((r) => ({ s: r.s, y: r.y }))), sc = assetScore(list, a, adopted), have = f.last[a] > 0;
    // move size: the selection protocol on this asset's walk-forward rows decides the model; naive unless one passes both halves
    const sel = volSelect(rp.vol[a], a), vixAt = VIX_ASSETS.includes(a) ? vixOf(data) : null;
    volUse[a] = { engine: rp.eng[a], model: sel.used, vixAt };
    const vf = rp.eng[a].n ? volForecast(null, D, dk.type, volUse[a]) : null;
    assets[a] = { label: ASSETS[a].label, pUp: have ? r2(probOf(sc.s, fit), 3) : null, score: r2(sc.s, 3), last: f.last[a] ?? null,
      expMovePct: vf ? r2(vf.exp, 2) : null, naiveMovePct: vf ? r2(vf.naive, 2) : null, volModel: vf ? vf.model : null, volRatio: vf ? vf.ratio : null, expBasis: vf ? vf.basis : null,
      fit, drivers: sc.used.map((d) => ({ k: d.k, name: d.name, dir: d.dir, w: d.w, detail: d.detail })) };
    scRe[a] = scorecard(rows.filter((r) => r.p != null));
    vs[a] = sel;
  }
  // the live log: the move forecast that was used vs the naive one, MAE and QLIKE
  const live = Object.fromEntries(AK.map((a) => { const R = history.filter((h) => h.asset === a && h.y != null); const sc = scorecard(R.map((h) => ({ p: h.p, y: h.y })));
    const V = R.filter((h) => h.expAbs > 0 && h.abs != null), nv = (h) => (h.naiveAbs > 0 ? h.naiveAbs : h.expAbs);
    if (V.length) Object.assign(sc, { volN: V.length, volMaeModel: r2(mean(V.map((h) => absErr(h.expAbs, h.abs))), 3), volMaeNaive: r2(mean(V.map((h) => absErr(nv(h), h.abs))), 3),
      volQlikeModel: r2(mean(V.map((h) => qlike(h.expAbs, h.abs))), 3), volQlikeNaive: r2(mean(V.map((h) => qlike(nv(h), h.abs))), 3) });
    return [a, sc]; }));
  const liqTag = f.liq && f.liq.chg != null ? (f.liq.chg >= 50 ? 'dollar liquidity rising' : f.liq.chg <= -50 ? 'dollar liquidity draining' : 'liquidity flat') : 'liquidity n/a';
  const volTag = carry ? 'yen carry-unwind risk' : f.vixTs != null && f.vixTs > 1 ? 'VIX curve inverted (stress)' : f.vix == null ? 'VIX n/a' : f.vix >= 28 ? 'high stress' : f.vix >= 22 ? 'elevated volatility' : f.vix < 15 ? 'calm' : 'normal volatility';
  const phaseName = { left: 'Dollar Smile left side (stress)', right: 'Dollar Smile right side (US outperformance)', trough: 'Dollar Smile trough (global growth)', mid: 'transitional dollar' };
  const regime = { label: `${smile ? phaseName[smile.phase] : 'regime unknown'} · ${liqTag} · ${volTag}`, smile: smile ? smile.phase : null, smileDetail: smile ? smile.detail : null, carryUnwind: !!carry,
    vix: f.vix, vixTermRatio: f.vixTs, liquidity: f.liq, realYield: f.ry ? { level: f.ry.level, chg: r2(f.ry.chg, 3), bias: f.ry.bias } : null, dxyProxy: r2(f.dxy, 2), dxy5d: r2(f.dm, 2), broadUsd20dPct: f.broad,
    sofrEffrBps: f.sofrBps, curve10y3m: f.curve, us2y: f.d2 ? f.d2.level : null, eu2y: f.eu2y ? f.eu2y.level : null, usEu2ySpread: f.d2 && f.eu2y ? r2(f.d2.level - f.eu2y.level, 2) : null };
  const playbook = eventPlaybook(cal, now, { bars: data.bars, log: eventLog, vol: volUse });
  const news = (data.rss || []).filter((n) => n.at == null || n.at >= now - 7 * DAY).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 8)
    .map((n) => ({ src: n.src, title: n.title, link: n.link, at: n.at ? new Date(n.at * 1000).toISOString() : null, policy: /FOMC statement|monetary policy decision|policy rate|interest rate|minutes/i.test(n.title) }));
  const fc = { v: 1, at: new Date(now * 1000).toISOString(), target: Dn, targetEvent: dk.title, paperOnly: true, regime, assets,
    dxy: assets.eurusd.pUp != null ? { pUp: r2(1 - assets.eurusd.pUp, 3), note: 'mirror of EUR/USD (EUR is 57.6% of the DXY)' } : null,
    drivers: list.map((d) => ({ k: d.k, name: d.name, cluster: d.cluster, vote: d.v, detail: d.detail, weights: weightsOf(d.k, adopted), ...(CHALLENGERS[d.k] ? { challenger: true, vs: CHALLENGERS[d.k].vs, candidateWeights: CHALLENGERS[d.k].weights } : {}), ...(d.map ? { perAsset: d.map } : {}) })),
    // what the strategist has learned from the veteran: adopted challengers, the full record, and every challenger's replay standing
    learned: { active: learned.active, adopted: learned.adopted, records: learned.records, recent: learned.records.slice(-10),
      challengers: Object.fromEntries(Object.entries(CHALLENGERS).map(([c, def]) => [c, { vs: def.vs, challenger: (drvRe.gold || {})[c] || null, incumbent: (drvRe.gold || {})[def.vs] || null, adopted: learned.active.includes(c) }])) },
    playbook, news, scorecard: { replay: scRe, live, vol: vs, volMethod: VOL_METHOD, replayDays: rp.Ds.length, driverHit: drvRe, logged: history.length, resolved: history.filter((h) => h.y != null).length,
      method: 'Walk-forward: each replay day uses only data published before it (FRED with publication lags, candles before the day); the score-to-probability map (anchored on the base up-rate, strongly shrunk, capped 35-65%) is refitted every 20 days on earlier days only (needs 120). Target: the next UTC weekday candle, up if close > open. Base rate = the share of the more common direction; coin flip (random walk) = 50% every day, Brier 0.25. Pesaran-Timmermann above 1.96 = direction calls better than chance. A 53% hit rate needs about 1,100 forecasts to tell from luck. The live log is append-only, written from 21:00 UTC before each day opens.' },
    sources: src, goldScore };
  fc.brief = makeBrief(fc);
  return fc;
}

export async function run({ dir = 'data', fetchImpl = globalThis.fetch, now = Math.floor(Date.now() / 1000), log = console.log } = {}) {
  const M = path.join(dir, 'macro'); fs.mkdirSync(M, { recursive: true });
  // a file that exists but does not parse (a run killed mid-write before 9 Nov) is reported and, for the append-only logs, never
  // overwritten: it used to read as empty and the next write replaced the whole history with a fresh one
  const corrupt = new Set();
  const rd = (f, d) => { const r = readJson(path.join(M, f), d); if (r.state === 'corrupt') { corrupt.add(f); log(`macro: ${f} is not valid JSON (${r.error}); left as it is`); } return r.value; };
  const cache = rd('cache.json', {});
  const { data, src } = await gather(fetchImpl, now, cache);
  const eventLog = logEvents(rd('events.json', []), data.cal || []);
  let history = resolveHistory(rd('history.json', []), data.bars);
  const S = await scoreSeries(fetchImpl, now, { dir, data, cache, src }), goldScore = goldMacroScore(S, { asOf: now });
  const fc = buildForecast(data, now, { src, history, eventLog, goldScore, lessons: rd('lessons.json', []) });
  history = updateHistory(history, fc, now).slice(-3000);
  const APPEND_ONLY = new Set(['history.json', 'events.json', 'lessons.json']);
  for (const f of corrupt) src[`file:${f}`] = APPEND_ONLY.has(f) ? 'not valid JSON: left as it is for a repair, not appended to' : 'not valid JSON: rebuilt';
  const w = (f, v, pretty = true) => { if (APPEND_ONLY.has(f) && corrupt.has(f)) return; writeIfChanged(path.join(M, f), pretty ? JSON.stringify(v, null, 1) : JSON.stringify(v)); };
  w('forecast.json', fc); w('history.json', history); w('events.json', eventLog); w('lessons.json', fc.learned.records);
  // last good copies, so one failed fetch does not blank the drivers (no timestamps: the file only changes with new data)
  const nc = { fred: {}, cal: data.cal && data.cal.length ? data.cal : cache.cal || [], cot: data.cot && data.cot.length ? data.cot : cache.cot || [] };
  for (const id of [...FRED, 'ECB2Y']) if (data.fred[id] && data.fred[id].length) nc.fred[id] = data.fred[id].slice(-300).map((o) => [iso(o.t), o.v]); else if (cache.fred && cache.fred[id]) nc.fred[id] = cache.fred[id];
  nc.score = S.ry.length && S.y2.length && S.y10.length ? scoreCache(S) : cache.score || null;
  w('cache.json', nc, false);
  try { const fA = path.join(dir, 'analysis', 'latest.md');
    if (fs.existsSync(fA)) { const md = fs.readFileSync(fA, 'utf8'), nx = injectSection(md, macroSection(fc), MACRO_START, MACRO_END); if (nx !== md) writeAtomic(fA, nx); } } catch (e) { log('macro: analysis section skipped:', e.message); }
  log(fc.brief);
  log('Sources: ' + Object.entries(src).map(([k, v]) => `${k} ${v}`).join(' | '));
  return fc;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run({ dir: process.argv[2] || 'data' }).catch((e) => { console.error('Macro strategist failed:', (e && e.stack) || e); process.exitCode = 1; });
}
