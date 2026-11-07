// Council · Macro strategist (paper only, 7 Nov 2026, owner request): next-day direction odds for gold, EUR/USD (DXY),
// USD/JPY, NQ and ES, an event playbook for the next 1-5 days, a plain-language brief, and an honest scorecard.
//
// Knowledge: the 15-driver macro stack of gold-trading.html (computeDailyBias, dollarSmileRegime, refreshFundamentalsX:
// real yields as the master driver, macro composite, VIX, real-yield momentum, breakeven, 2Y, DXY momentum, COT, curve,
// HY spreads, Dollar Smile regime with SOFR−EFFR and swap lines, Eurozone growth pulse, yen carry-unwind risk), the owner's
// macro handbook as encoded there (Dollar Smile, global dollar liquidity, Germany/Eurozone, Japan carry), the Fed balance
// sheet liquidity gauge (WALCL − RRP − TGA), the pre-FOMC drift, and the FOMC dates of research/edge/regime/replay.mjs.
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
//  - expected move = median absolute move on the last 24 same-type event days × (20-day vol / 1-year vol), naive 20-day
//    mean absolute move otherwise, scored against that naive forecast;
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
const COT_LAG = 4;   // CFTC: Tuesday positions, released Friday

// FOMC decision days (from research/edge/regime/replay.mjs); live runs also read them off the calendar
export const FOMC = new Set(('2023-02-01 2023-03-22 2023-05-03 2023-06-14 2023-07-26 2023-09-20 2023-11-01 2023-12-13 ' +
  '2024-01-31 2024-03-20 2024-05-01 2024-06-12 2024-07-31 2024-09-18 2024-11-07 2024-12-18 ' +
  '2025-01-29 2025-03-19 2025-05-07 2025-06-18 2025-07-30 2025-09-17 2025-10-29 2025-12-10 ' +
  '2026-01-28 2026-03-18 2026-04-29 2026-06-17 2026-07-29 2026-09-16 2026-10-28 2026-12-09').split(' '));

export const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const r2 = (x, d = 2) => x == null || !isFinite(x) ? null : +(+x).toFixed(d);
const sg = (x, d = 2) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const logit = (p) => Math.log(p / (1 - p)), sigm = (z) => 1 / (1 + Math.exp(-z));

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
export function fredView(fred, id, D) {
  const a = (fred && fred[id]) || [], n = upto(a, D - (LAG[id] || 2) * DAY);
  return { n, last: n ? a[n - 1] : null, back: (k) => (n - 1 - k >= 0 ? a[n - 1 - k] : null), at: (t) => { const i = upto(a, Math.min(t, D - (LAG[id] || 2) * DAY)); return i ? a[i - 1] : null; } };
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
  const cotRows = (data.cot || []).filter((r) => r.t <= D - COT_LAG * DAY);
  let cot = null;
  if (cotRows.length >= 5) { const w = cotRows.slice(-60), now = w[w.length - 1], m4 = w[Math.max(0, w.length - 5)], s = w.map((r) => r.net).sort((a, b) => a - b);
    cot = { net: now.net, chg4w: now.net - m4.net, pct: Math.round(Math.max(0, s.findIndex((v) => v >= now.net)) / Math.max(1, s.length - 1) * 100), asOf: iso(now.t) }; }
  const trend = {}, vol = {}, last = {};
  for (const k of AK) { const b = bars[k]; if (b.length >= 21) { const c = b[b.length - 1].close, sma = b.slice(-20).reduce((s, x) => s + x.close, 0) / 20; trend[k] = c > sma ? 1 : c < sma ? -1 : 0; last[k] = c; }
    const rets = b.slice(-21).map((x, i, a) => (i ? Math.log(x.close / a[i - 1].close) : null)).slice(1); vol[k] = rets.length >= 10 ? Math.sqrt(rets.reduce((s, x) => s + x * x, 0) / rets.length) * 100 : null; }
  const v3 = F('VXVCLS').last, e2 = F('ECB2Y');
  return {
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
  add('cot', 'Funds positioning (COT managed money, gold)', 'positioning', !ct ? null : ct.pct >= 90 ? 0 : ct.chg4w > 5000 ? 1 : ct.chg4w < -5000 ? -1 : 0, ct ? `${Math.round(ct.net / 1000)}k net, ${sg(ct.chg4w / 1000, 0)}k in 4 weeks, ${ct.pct}th pct${ct.pct >= 90 ? ' (crowded)' : ''}, week of ${ct.asOf}` : 'no data');
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
  return { list: out, smile: sm, carry };
}

// score in [-1, 1] for one asset: weighted mean of the votes of the drivers that have data
export function assetScore(list, a) {
  let num = 0, den = 0; const used = [];
  for (const d of list) {
    const w = (W[d.k] || {})[a]; if (!w || d.v === null) continue;
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
// Event days with a history we can rebuild without a paid archive: FOMC decisions (fixed list) and payrolls (first Friday of
// the month, the usual BLS rule; a holiday can move it a week). Other types use the prior table × the volatility ratio.
export const isKind = (t, kind) => kind === 'fomc' ? FOMC.has(iso(t)) : kind === 'nfp' ? new Date(t * 1000).getUTCDay() === 5 && new Date(t * 1000).getUTCDate() <= 7 : false;
const median = (a) => { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; };
const sd = (a) => (a.length ? Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length) : null);
// expected absolute open-to-close move (%) of day D for one asset: the typical (median) move of the last 20 days, times the
// event multiplier (median move on the last 24 same-type event days vs a normal day) on Fed / payrolls days, or the prior
// table × the 20-day / 1-year volatility ratio for other events. Scored against the naive 20-day mean absolute move.
// kind = 'fomc' | 'nfp' | null, prior = typical % for other events
export function volForecast(bars, D, kind = null, prior = null) {
  const b = barsBefore(bars, D).filter((x) => !x.live), abs = b.map((x) => ({ t: x.time, a: Math.abs(x.close / x.open - 1) * 100 }));
  if (abs.length < 20) return null;
  const naive = abs.slice(-20).reduce((s, x) => s + x.a, 0) / 20;
  const rets = b.map((x, i) => (i ? Math.log(x.close / b[i - 1].close) : null)).slice(1);
  const v20 = sd(rets.slice(-20)), v250 = sd(rets.slice(-250)), ratio = v20 && v250 ? clamp(v20 / v250, 0.5, 2.5) : 1;
  const typ = median(abs.slice(-20).map((x) => x.a));
  let exp = typ, basis = 'typical day: median absolute move of the last 20 days';
  if (kind) { const ev = abs.filter((x) => isKind(x.t, kind)).slice(-24);
    if (ev.length >= 6) { const m = clamp(median(ev.map((x) => x.a)) / median(abs.slice(-250).map((x) => x.a)), 0.7, 2.5); exp = typ * m;
      basis = `median of the last 20 days × ${m.toFixed(2)} (median of the last ${ev.length} ${kind === 'fomc' ? 'Fed decision' : 'payrolls'} days vs a normal day)`; } }
  if (basis.startsWith('typical') && prior != null) { exp = Math.max(typ, prior * ratio); basis = `event prior ${prior}% × vol ratio ${ratio.toFixed(2)} (no history for this event type)`; }
  return { exp: r2(exp, 3), naive: r2(naive, 3), ratio: r2(ratio, 2), basis };
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
    const f = features(data, D), { list } = drivers(f), kind = isKind(D, 'fomc') ? 'fomc' : isKind(D, 'nfp') ? 'nfp' : null;
    for (const k of AK) {
      const bar = idx[k].get(D); if (!bar || bar.close === bar.open || !(f.last[k] > 0)) continue;
      const y = bar.close > bar.open ? 1 : 0, sc = assetScore(list, k), past = rows[k];
      if (!fits[k] || i % refit === 0) fits[k] = past.length >= minTrain ? fitPlatt(past.map((r) => ({ s: r.s, y: r.y }))) : null;
      const p = fits[k] ? probOf(sc.s, fits[k]) : null;
      past.push({ D, s: sc.s, y, p });
      const vf = volForecast(data.bars[k], D, kind); if (vf) vol[k].push({ D, kind, exp: vf.exp, naive: vf.naive, abs: Math.abs(bar.close / bar.open - 1) * 100 });
      for (const d of list) { const w = (W[d.k] || {})[k]; if (!w || d.v === null) continue; const v = d.map ? d.map[k] || 0 : Math.sign(d.v * w); if (!v) continue;
        const t = drv[k][d.k] || (drv[k][d.k] = { n: 0, hit: 0 }); t.n++; if ((v > 0 ? 1 : 0) === y) t.hit++; }
    }
    i++;
  }
  return { Ds, rows, drv, vol };
}
// volatility forecast vs the naive one (MAE of the absolute move), all days and event days
export function volScore(v) {
  const mae = (xs, key) => xs.length ? r2(xs.reduce((s, x) => s + Math.abs(x[key] - x.abs), 0) / xs.length, 3) : null;
  const ev = v.filter((x) => x.kind);
  return { n: v.length, maeModel: mae(v, 'exp'), maeNaive: mae(v, 'naive'), eventDays: ev.length, eventMaeModel: mae(ev, 'exp'), eventMaeNaive: mae(ev, 'naive'),
    eventAvgAbs: ev.length ? r2(ev.reduce((s, x) => s + x.abs, 0) / ev.length, 3) : null, otherAvgAbs: v.length > ev.length ? r2(v.filter((x) => !x.kind).reduce((s, x) => s + x.abs, 0) / (v.length - ev.length), 3) : null };
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
// the kind of event day D is for the volatility engine: Fed decision, payrolls, or another high-impact release (prior table)
export function dayKind(D, cal = []) {
  const day = (cal || []).filter((e) => e.impact === 'High' && iso(e.at) === iso(D));
  const fomc = FOMC.has(iso(D)) || day.some((e) => e.country === 'USD' && /FOMC Statement|Federal Funds Rate/i.test(e.title));
  if (fomc) return { kind: 'fomc', title: 'FOMC decision' };
  const nfp = day.find((e) => e.country === 'USD' && /Non-?Farm/i.test(e.title)) || (!cal.length && isKind(D, 'nfp') ? { title: 'Non-Farm Payrolls (first-Friday rule)' } : null);
  if (nfp) return { kind: 'nfp', title: nfp.title };
  const rank = (e) => (e.country === 'USD' ? 0 : e.country === 'EUR' || e.country === 'JPY' ? 1 : 2);
  const top = day.filter((e) => rank(e) < 2).sort((a, b) => rank(a) - rank(b))[0];
  return top ? { kind: null, title: `${top.country} ${top.title}`, prior: classify(top).move } : { kind: null, title: null };
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
export function eventPlaybook(events, now, { bars = {}, log = [], days = 5 } = {}) {
  const end = now + days * DAY;
  return events.filter((e) => e.impact === 'High' && e.at >= now - 3 * 3600 && e.at <= end).sort((a, b) => a.at - b.at).map((e) => {
    const t = classify(e), fc = parseNum(e.forecast), ac = parseNum(e.actual), st = surpriseStats(log, evKey(e));
    // a policy-rate decision is hot (hawkish) at any rate above consensus; data releases need one reporting step or ±1 SD
    const isRate = !!t.words && /Rate|Funds/i.test(e.title), step = stepOf(e.forecast);
    const tol = fc == null ? null : isRate ? 1e-6 : st ? st.sd : Math.max(step, (t.relTol || 0) * Math.abs(fc));
    const hotAt = fc == null ? null : t.low ? fc - tol : fc + tol, coolAt = fc == null ? null : t.low ? fc + tol : fc - tol;
    const D = Math.floor(e.at / DAY) * DAY, kind = t.type.startsWith('Fed') && /FOMC|Funds Rate/i.test(e.title) ? 'fomc' : /Non-?Farm/i.test(e.title) ? 'nfp' : null;
    const exp = {}, basis = {};
    for (const k of AK) { const vf = bars[k] ? volForecast(bars[k], D, kind, t.move[k]) : null; exp[k] = vf ? vf.exp : t.move[k]; basis[k] = vf ? vf.basis : 'event prior (no price history)'; }
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
async function get(fetchImpl, url, kind = 'text', ms = 15000) {
  try { const r = await fetchImpl(url, { headers: UA, signal: AbortSignal.timeout(ms) }); if (!r.ok) return { err: `HTTP ${r.status}` };
    const body = kind === 'json' ? await r.json() : await r.text(); return { body }; } catch (e) { return { err: String((e && e.message) || e).slice(0, 80) }; }
}
export async function gather(fetchImpl, now, cache = {}) {
  const src = {}, data = { fred: {}, bars: {}, cot: [], cal: [], rss: [] };
  const cosd = iso(now - 5 * 365 * DAY);
  await Promise.all(FRED.map(async (id) => {
    const r = await get(fetchImpl, `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${cosd}`);
    const obs = r.body ? parseFredCsv(r.body) : [];
    if (obs.length) { data.fred[id] = obs; src[`fred:${id}`] = `ok, last ${iso(obs[obs.length - 1].t)}`; return; }
    const cb = CBOE[id] ? await get(fetchImpl, CBOE[id]) : null, co = cb && cb.body ? parseCboeCsv(cb.body).filter((o) => o.t >= now - 5 * 365 * DAY) : [];
    if (co.length) { data.fred[id] = co; src[`fred:${id}`] = `FRED failed (${r.err || 'empty'}), Cboe ok, last ${iso(co[co.length - 1].t)}`; }
    else if (cache.fred && cache.fred[id] && cache.fred[id].length) { data.fred[id] = cache.fred[id].map(([d, v]) => ({ t: Date.parse(d + 'T00:00:00Z') / 1000, v })); src[`fred:${id}`] = `failed (${r.err || 'empty'}), using cache to ${cache.fred[id][cache.fred[id].length - 1][0]}`; }
    else src[`fred:${id}`] = `failed (${r.err || 'empty'})`;
  }));
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
  const cal = [];
  for (const w of ['thisweek', 'nextweek']) {
    const r = await get(fetchImpl, `https://nfs.faireconomy.media/ff_calendar_${w}.json`, 'json', 12000);
    const ev = r.body ? parseCalendar(r.body) : [];
    src[`calendar:${w}`] = ev.length ? `ok (${ev.length} events)` : `failed (${r.err || 'empty'})`;
    cal.push(...ev);
  }
  if (cal.length) data.cal = cal;
  else if (Array.isArray(cache.cal) && cache.cal.length) { data.cal = cache.cal; src['calendar:cache'] = `using the last good copy (${cache.cal.length} events)`; }
  const feeds = [['Fed', 'https://www.federalreserve.gov/feeds/press_all.xml'], ['ECB', 'https://www.ecb.europa.eu/rss/press.html'], ['BoJ', 'https://www.boj.or.jp/en/rss/whatsnew.xml']];
  await Promise.all(feeds.map(async ([name, url]) => { const r = await get(fetchImpl, url, 'text', 12000); const it = r.body ? parseRss(r.body, name) : [];
    src[`rss:${name}`] = it.length ? `ok (${it.length} items)` : `failed (${r.err || 'empty'})`; data.rss.push(...it.slice(0, 10)); }));
  const q = 'https://publicreporting.cftc.gov/resource/72hh-3qpy.json?$select=report_date_as_yyyy_mm_dd,m_money_positions_long_all,m_money_positions_short_all'
    + '&$where=' + encodeURIComponent("commodity_name='GOLD'") + '&$order=' + encodeURIComponent('report_date_as_yyyy_mm_dd DESC') + '&$limit=200';
  const c = await get(fetchImpl, q, 'json', 15000);
  if (Array.isArray(c.body) && c.body.length) { data.cot = c.body.map((r) => ({ t: Date.parse(String(r.report_date_as_yyyy_mm_dd).slice(0, 10) + 'T00:00:00Z') / 1000, net: (+r.m_money_positions_long_all || 0) - (+r.m_money_positions_short_all || 0) }))
    .filter((r) => isFinite(r.t)).sort((a, b) => a.t - b.t); src.cot = `ok (${data.cot.length} weeks)`; }
  else if (Array.isArray(cache.cot) && cache.cot.length) { data.cot = cache.cot; src.cot = `failed (${c.err || 'empty'}), using cache`; }
  else src.cot = `failed (${c.err || 'empty'})`;
  return { data, src };
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
    H.push({ id, asset: a, target: fc.target, at: fc.at, p: f.pUp, s: f.score, base: f.fit ? f.fit.base : null, expAbs: f.expMovePct, naiveAbs: f.naiveMovePct, event: fc.targetEvent || null,
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
    L.push(`${ASSETS[a].label}: ${pct(f.pUp)} up (base rate ${f.fit ? pct(f.fit.base) : '?'}; ${leanWord(f.pUp, f.fit ? f.fit.base : 0.5)}${f.fit && f.fit.b === 0 ? ', the replay finds no edge in its drivers' : ''}).${pro.length ? ` Drivers lean ${up}: ${pro.join(', ')}${con.length ? `; against: ${con[0]}` : ''}.` : ''} Typical move ±${f.expMovePct ?? '?'}%.`); }
  if (fc.dxy) L.push(`DXY: ${pct(fc.dxy.pUp)} up (mirror of EUR/USD).`);
  const ev = fc.playbook.slice(0, 4);
  if (ev.length) L.push('Coming up: ' + ev.map((e) => `${e.country} ${e.title} ${WD.format(new Date(e.at))} ${HM.format(new Date(e.at))} UTC${e.consensus ? ` (consensus ${e.consensus}, previous ${e.previous || '—'})` : ''}${e.outcome ? `, came in ${e.outcome}` : `: if ${e.scenarios[0].name}, gold ${e.scenarios[0].moves.gold}, USD ${usdOf(e.scenarios[0].moves.eurusd)}, NQ ${e.scenarios[0].moves.nq}; gold usually moves ±${e.expMovePct.gold}%`}`).join('; ') + '.');
  else L.push('No high-impact events in the next 5 days on the calendar we could read.');
  const g = fc.scorecard.replay.gold, v = fc.scorecard.vol && fc.scorecard.vol.gold;
  if (g && g.n) L.push(`Honesty check: on the ${g.n}-day walk-forward replay the gold calls hit ${pct(g.hit)} against a ${pct(g.base)} base rate (Brier ${g.brier} vs ${g.brierRW} for a coin flip, Pesaran-Timmermann ${g.pt ?? 'n/a'}): ${verdictOf(g)}.${v && v.eventDays ? ` Event days moved gold ${v.eventAvgAbs}% on average against ${v.otherAvgAbs}% on other days: the size of the move is the more reliable forecast.` : ''} Treat the direction odds as context, not trade signals.`);
  return L.join(' ');
}
export const MACRO_START = '<!-- macro:start -->', MACRO_END = '<!-- macro:end -->';
export function macroSection(fc) {
  if (!fc || !fc.assets) return '';
  const out = [MACRO_START, '## Macro strategist', '', `Built by the Macro strategist at ${fc.at.slice(0, 16).replace('T', ' ')} UTC for ${fc.target} (paper only, changes no rule or trade; full view in macro/forecast.json). Regime: **${fc.regime.label}**.`, '',
    '| Market | P(up) | Lean | Exp. move | Main drivers | Replay hit / base | Brier vs coin |', '|---|---|---|---|---|---|---|'];
  for (const a of AK) { const f = fc.assets[a], sc = fc.scorecard.replay[a] || {};
    out.push(`| ${ASSETS[a].label} | ${f && f.pUp != null ? pct(f.pUp) : '—'} | ${f && f.pUp != null ? leanWord(f.pUp, f.fit ? f.fit.base : 0.5) : '—'} | ${f && f.expMovePct != null ? `±${f.expMovePct}%` : '—'} | ${f ? f.drivers.slice(0, 3).map((d) => `${short(d.name)} ${d.dir}`).join('; ').replace(/\|/g, '/') : '—'} | ${sc.n ? `${pct(sc.hit)} / ${pct(sc.base)} (${sc.n} d)` : '—'} | ${sc.n ? `${sc.brier} vs 0.25` : '—'} |`); }
  if (fc.playbook.length) { out.push('', 'Next high-impact events:'); for (const e of fc.playbook.slice(0, 6)) out.push(`- ${e.at.slice(0, 16).replace('T', ' ')} UTC ${e.country} ${e.title}${e.consensus ? ` (cons. ${e.consensus}, prev. ${e.previous || '—'})` : ''}: ${e.rule}; ${e.scenarios[0].name} → gold ${e.scenarios[0].moves.gold}, EUR/USD ${e.scenarios[0].moves.eurusd}, USD/JPY ${e.scenarios[0].moves.usdjpy}, NQ ${e.scenarios[0].moves.nq}.`); }
  out.push('', fc.brief.replace(/\|/g, '/'), MACRO_END);
  return out.join('\n');
}

// ─── one run ───────────────────────────────────────────────────────────────────────────────────────────────────────────
export function buildForecast(data, now, { src = {}, history = [], eventLog = [] } = {}) {
  const D = targetDay(now), Dn = iso(D), cal = data.cal || [];
  const dk = dayKind(D, cal);
  const f = features(data, D, { fomcDay: dk.kind === 'fomc' }), { list, smile, carry } = drivers(f);
  const rp = replay(data, { upto: D });
  const assets = {}, scRe = {}, drvRe = {}, vs = {};
  for (const a of AK) {
    const rows = rp.rows[a], fit = fitPlatt(rows.map((r) => ({ s: r.s, y: r.y }))), sc = assetScore(list, a), have = f.last[a] > 0;
    const vf = data.bars[a] && data.bars[a].length ? volForecast(data.bars[a], D, dk.kind, dk.prior ? dk.prior[a] : null) : null;
    assets[a] = { label: ASSETS[a].label, pUp: have ? r2(probOf(sc.s, fit), 3) : null, score: r2(sc.s, 3), last: f.last[a] ?? null,
      expMovePct: vf ? r2(vf.exp, 2) : null, naiveMovePct: vf ? r2(vf.naive, 2) : null, volRatio: vf ? vf.ratio : null, expBasis: vf ? vf.basis : null,
      fit, drivers: sc.used.map((d) => ({ k: d.k, name: d.name, dir: d.dir, w: d.w, detail: d.detail })) };
    scRe[a] = scorecard(rows.filter((r) => r.p != null));
    // a driver counts as proven only with a t-stat of 3 or more on the replay (research: after counting every variant tried)
    drvRe[a] = Object.fromEntries(Object.entries(rp.drv[a]).filter(([, t]) => t.n >= 30).map(([k, t]) => { const h = t.hit / t.n, tt = (h - 0.5) / Math.sqrt(0.25 / t.n); return [k, { n: t.n, hit: r2(h, 3), t: r2(tt, 2), proven: tt >= 3 }]; }));
    vs[a] = volScore(rp.vol[a]);
  }
  const live = Object.fromEntries(AK.map((a) => { const R = history.filter((h) => h.asset === a && h.y != null); const sc = scorecard(R.map((h) => ({ p: h.p, y: h.y })));
    const V = R.filter((h) => h.expAbs != null && h.abs != null); if (V.length) Object.assign(sc, { volMaeModel: r2(V.reduce((s, h) => s + Math.abs(h.expAbs - h.abs), 0) / V.length, 3), volMaeNaive: r2(V.reduce((s, h) => s + Math.abs((h.naiveAbs ?? h.expAbs) - h.abs), 0) / V.length, 3) });
    return [a, sc]; }));
  const liqTag = f.liq && f.liq.chg != null ? (f.liq.chg >= 50 ? 'dollar liquidity rising' : f.liq.chg <= -50 ? 'dollar liquidity draining' : 'liquidity flat') : 'liquidity n/a';
  const volTag = carry ? 'yen carry-unwind risk' : f.vixTs != null && f.vixTs > 1 ? 'VIX curve inverted (stress)' : f.vix == null ? 'VIX n/a' : f.vix >= 28 ? 'high stress' : f.vix >= 22 ? 'elevated volatility' : f.vix < 15 ? 'calm' : 'normal volatility';
  const phaseName = { left: 'Dollar Smile left side (stress)', right: 'Dollar Smile right side (US outperformance)', trough: 'Dollar Smile trough (global growth)', mid: 'transitional dollar' };
  const regime = { label: `${smile ? phaseName[smile.phase] : 'regime unknown'} · ${liqTag} · ${volTag}`, smile: smile ? smile.phase : null, smileDetail: smile ? smile.detail : null, carryUnwind: !!carry,
    vix: f.vix, vixTermRatio: f.vixTs, liquidity: f.liq, realYield: f.ry ? { level: f.ry.level, chg: r2(f.ry.chg, 3), bias: f.ry.bias } : null, dxyProxy: r2(f.dxy, 2), dxy5d: r2(f.dm, 2), broadUsd20dPct: f.broad,
    sofrEffrBps: f.sofrBps, curve10y3m: f.curve, us2y: f.d2 ? f.d2.level : null, eu2y: f.eu2y ? f.eu2y.level : null, usEu2ySpread: f.d2 && f.eu2y ? r2(f.d2.level - f.eu2y.level, 2) : null };
  const playbook = eventPlaybook(cal, now, { bars: data.bars, log: eventLog });
  const news = (data.rss || []).filter((n) => n.at == null || n.at >= now - 7 * DAY).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 8)
    .map((n) => ({ src: n.src, title: n.title, link: n.link, at: n.at ? new Date(n.at * 1000).toISOString() : null, policy: /FOMC statement|monetary policy decision|policy rate|interest rate|minutes/i.test(n.title) }));
  const fc = { v: 1, at: new Date(now * 1000).toISOString(), target: Dn, targetEvent: dk.title, paperOnly: true, regime, assets,
    dxy: assets.eurusd.pUp != null ? { pUp: r2(1 - assets.eurusd.pUp, 3), note: 'mirror of EUR/USD (EUR is 57.6% of the DXY)' } : null,
    drivers: list.map((d) => ({ k: d.k, name: d.name, cluster: d.cluster, vote: d.v, detail: d.detail, weights: W[d.k] || {}, ...(d.map ? { perAsset: d.map } : {}) })),
    playbook, news, scorecard: { replay: scRe, live, vol: vs, replayDays: rp.Ds.length, driverHit: drvRe, logged: history.length, resolved: history.filter((h) => h.y != null).length,
      method: 'Walk-forward: each replay day uses only data published before it (FRED with publication lags, candles before the day); the score-to-probability map (anchored on the base up-rate, strongly shrunk, capped 35-65%) is refitted every 20 days on earlier days only (needs 120). Target: the next UTC weekday candle, up if close > open. Base rate = the share of the more common direction; coin flip (random walk) = 50% every day, Brier 0.25. Pesaran-Timmermann above 1.96 = direction calls better than chance. A 53% hit rate needs about 1,100 forecasts to tell from luck. The live log is append-only, written from 21:00 UTC before each day opens.' },
    sources: src };
  fc.brief = makeBrief(fc);
  return fc;
}

export async function run({ dir = 'data', fetchImpl = globalThis.fetch, now = Math.floor(Date.now() / 1000), log = console.log } = {}) {
  const M = path.join(dir, 'macro'); fs.mkdirSync(M, { recursive: true });
  const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(M, f), 'utf8')); } catch (e) { return d; } };
  const cache = rd('cache.json', {});
  const { data, src } = await gather(fetchImpl, now, cache);
  const eventLog = logEvents(rd('events.json', []), data.cal || []);
  let history = resolveHistory(rd('history.json', []), data.bars);
  const fc = buildForecast(data, now, { src, history, eventLog });
  history = updateHistory(history, fc, now).slice(-3000);
  const w = (f, v, pretty = true) => { const s = pretty ? JSON.stringify(v, null, 1) : JSON.stringify(v); const p = path.join(M, f); let old = null; try { old = fs.readFileSync(p, 'utf8'); } catch (e) {} if (old !== s) fs.writeFileSync(p, s); };
  w('forecast.json', fc); w('history.json', history); w('events.json', eventLog);
  // last good copies, so one failed fetch does not blank the drivers (no timestamps: the file only changes with new data)
  const nc = { fred: {}, cal: data.cal && data.cal.length ? data.cal : cache.cal || [], cot: data.cot && data.cot.length ? data.cot : cache.cot || [] };
  for (const id of [...FRED, 'ECB2Y']) if (data.fred[id] && data.fred[id].length) nc.fred[id] = data.fred[id].slice(-300).map((o) => [iso(o.t), o.v]); else if (cache.fred && cache.fred[id]) nc.fred[id] = cache.fred[id];
  w('cache.json', nc, false);
  try { const fA = path.join(dir, 'analysis', 'latest.md');
    if (fs.existsSync(fA)) { const md = fs.readFileSync(fA, 'utf8'), nx = injectSection(md, macroSection(fc), MACRO_START, MACRO_END); if (nx !== md) fs.writeFileSync(fA, nx); } } catch (e) { log('macro: analysis section skipped:', e.message); }
  log(fc.brief);
  log('Sources: ' + Object.entries(src).map(([k, v]) => `${k} ${v}`).join(' | '));
  return fc;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run({ dir: process.argv[2] || 'data' }).catch((e) => { console.error('Macro strategist failed:', (e && e.stack) || e); process.exitCode = 1; });
}
