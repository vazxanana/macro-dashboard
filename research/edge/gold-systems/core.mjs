// Shared context for the gold-systems study: M1 data, UTC bars, engine analyses, the live trade-management loop
// (a per-bar port of council/trader.mjs "Manage open trades"), and statistics.
import { loadM1, aggregate, lowerBound } from './data.mjs';
import { msAnalyze } from './live.mjs';

export const COST = 0.30;   // gold spot spread+slippage per round trip, $ (council/backtest.mjs spreadOf: M.spot ? 0.3)
export const IS_END = Date.UTC(2024, 0, 1) / 1000;   // in-sample 2018-2023, out-of-sample 2024-2026 (to 30 Oct 2026)

export function buildContext() {
  const m = loadM1();
  const bars = { d1: aggregate(m, 86400), h4: aggregate(m, 14400), h1: aggregate(m, 3600), m15: aggregate(m, 900), m5: aggregate(m, 300) };
  const sec = { d1: 86400, h4: 14400, h1: 3600, m15: 900, m5: 300 };
  const closeT = {}; for (const k of Object.keys(bars)) closeT[k] = Float64Array.from(bars[k], (b) => b.time + sec[k]);
  // engine on the full series (causal by index: an event at breakIdx i uses bars <= i). Live runs it on 720-bar windows.
  const A = {}, trend = {};
  for (const k of ['d1', 'h4', 'h1', 'm15']) {
    A[k] = msAnalyze(bars[k], 6);
    const tr = new Int8Array(bars[k].length); let e = 0, cur = 0; const ev = A[k].events;
    for (let i = 0; i < tr.length; i++) { while (e < ev.length && ev[e].breakIdx <= i) cur = ev[e++].dir; tr[i] = cur; }
    trend[k] = tr;
  }
  // number of closed bars of tf at time t
  const nClosed = (k, t) => { const a = closeT[k]; let lo = 0, hi = a.length; while (lo < hi) { const md = (lo + hi) >> 1; if (a[md] <= t) lo = md + 1; else hi = md; } return lo; };
  // gold 20-day range (% of price) and its percentiles over the last 365 daily values, as the live gate computes them
  const D = bars.d1, rr = D.map((b) => (b.high - b.low) / b.close * 100), vol20 = new Float64Array(D.length + 1).fill(NaN);
  for (let i = 20; i <= D.length; i++) { let s = 0; for (let j = i - 20; j < i; j++) s += rr[j]; vol20[i] = s / 20; }   // vol20[nd] = mean of the 20 closed days before index nd
  const pctCache = new Map();
  const volPct = (nd, p) => {   // threshold at percentile p (0-100) when nd daily bars are closed (live: ser.slice(-367,-2))
    const key = nd * 1000 + p; if (pctCache.has(key)) return pctCache.get(key);
    const ser = []; for (let i = 20; i <= nd; i++) ser.push(vol20[i]);
    const past = ser.slice(-367, -2).sort((a, b) => a - b);
    const v = past.length >= 200 ? past[Math.floor(p / 100 * (past.length - 1))] : null; pctCache.set(key, v); return v;
  };
  const volRank = (nd) => {   // percentile rank (0-100) of today's 20-day range within the same 365-day window
    const ser = []; for (let i = 20; i <= nd; i++) ser.push(vol20[i]);
    const past = ser.slice(-367, -2); if (past.length < 200) return null;
    const v = vol20[nd]; return 100 * past.filter((x) => x < v).length / past.length;
  };
  return { m, bars, sec, closeT, A, trend, nClosed, vol20, volPct, volRank, lb: (t) => lowerBound(m.T, t) };
}

export const marketOpen = (t) => { const d = new Date(t * 1000), wd = d.getUTCDay(), h = d.getUTCHours(); return !(wd === 6 || (wd === 0 && h < 23) || (wd === 5 && h >= 21)); };
const nyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' });
export function nyMin(t) { const o = {}; for (const p of nyFmt.formatToParts(new Date(t * 1000))) o[p.type] = p.value; return { m: +o.hour * 60 + +o.minute, wd: o.weekday }; }

// One M1 bar of the live management loop for one trade. Returns an add trade to open (or null). Sets tr.done when closed.
export function step(tr, m, k) {
  const t = m.T[k], hi = m.H[k], lo = m.L[k], s = tr.side < 0;
  if (tr.status === 'pending') {
    if (t >= tr.expireAt) { tr.status = 'expired'; tr.R = 0; tr.closed = t; tr.done = true; return null; }
    if (s ? hi >= tr.entry : lo <= tr.entry) { tr.status = 'open'; tr.filled = t; }
    else if (s ? lo <= tr.t1 : hi >= tr.t1) { tr.status = 'missed'; tr.R = 0; tr.closed = t; tr.done = true; return null; }
    else return null;
  }
  const r0 = tr.r0;
  if (s ? hi >= tr.stop : lo <= tr.stop) {
    if (tr.trail && tr.trailMoved) tr.R = (s ? tr.entry - tr.stop : tr.stop - tr.entry) / r0;
    else if (tr.beMoved) tr.R = 0; else tr.R = -1;
    tr.status = 'closed'; tr.exit = 'stop'; tr.closed = t; tr.done = true; return null;
  }
  if (s ? lo <= tr.t1 : hi >= tr.t1) { tr.R = tr.rr; tr.status = 'closed'; tr.exit = 'target'; tr.closed = t; tr.done = true; return null; }
  if (tr.maxHold && t >= tr.filled + tr.maxHold) { tr.R = (s ? tr.entry - m.C[k] : m.C[k] - tr.entry) / r0; tr.status = 'closed'; tr.exit = 'time'; tr.closed = t; tr.done = true; return null; }
  const fav = (s ? tr.entry - lo : hi - tr.entry) / r0;
  tr.mfe = Math.max(tr.mfe || 0, fav);
  if (tr.trail && tr.mfe >= tr.trail[0]) { const ns = tr.entry + (s ? -1 : 1) * (tr.mfe - tr.trail[1]) * r0; if (s ? ns < tr.stop : ns > tr.stop) { tr.stop = ns; tr.trailMoved = true; } }
  if (tr.beAt && !tr.beMoved && fav >= tr.beAt) { tr.stop = tr.entry; tr.beMoved = true; }
  if (tr.addAt && !tr.addDone && tr.mfe >= tr.addAt) {
    tr.addDone = true; const dir = s ? -1 : 1, ae = tr.entry + dir * tr.addAt * r0, rA = Math.abs(ae - tr.entry);
    if (rA > 0) return { side: tr.side, entry: ae, stop: tr.entry, t1: tr.t1, rr: Math.abs(tr.t1 - ae) / rA,
      trail: tr.trail ? [(tr.trail[0] - tr.addAt) / tr.addAt, tr.trail[1] / tr.addAt] : null,
      size: tr.addAt * (tr.size || 1), opened: t, filled: t, status: 'open', r0: rA, maxHold: Math.max(300, (tr.filled + (tr.maxHold || 48 * 3600)) - t), addOf: tr, k0: k + 1 };
  }
  return null;
}
// gross and net R of a closed unit, in account R (size applied)
export const unitR = (tr) => ({ g: tr.R * (tr.size || 1), n: (tr.R - COST / tr.r0) * (tr.size || 1) });

// Run independent positions (each with its own add) to completion: list of trade objects with k0 (first M1 index).
// Used where positions do not interact (no portfolio limits) -- returns the same objects with R filled.
export function runAlone(trades, m) {
  for (const tr of trades) {
    const legs = [tr]; let q = 0;
    while (q < legs.length) {
      const x = legs[q++];
      for (let k = x.k0; k < m.n && !x.done; k++) { const a = step(x, m, k); if (a) legs.push(a); }
      if (!x.done) { const k = m.n - 1; x.R = x.status === 'pending' ? 0 : ((x.side < 0 ? x.entry - m.C[k] : m.C[k] - x.entry) / x.r0); x.closed = m.T[k]; x.done = true; x.exit = 'end'; if (x.status === 'pending') x.status = 'expired'; }
    }
    tr.legs = legs;
  }
  return trades;
}
// a position = first unit + its add(s): net/gross R in account units
export function posR(tr) {
  const legs = tr.legs || [tr]; let g = 0, n = 0, closed = 0;
  for (const x of legs) { if (x.status === 'expired' || x.status === 'missed') continue; const u = unitR(x); g += u.g; n += u.n; closed = Math.max(closed, x.closed); }
  return { g, n, closed: closed || tr.closed, filled: tr.status !== 'expired' && tr.status !== 'missed' };
}

// ── statistics ──
export function stats(rows, key = 'n') {   // rows: [{t (entry), c (close), n (net R), g (gross R)}]
  const a = rows.slice().sort((x, y) => x.c - y.c), v = a.map((x) => x[key]), n = v.length;
  if (!n) return { n: 0, wr: 0, exp: 0, R: 0, maxDD: 0, streak: 0, t: 0 };
  const R = v.reduce((p, x) => p + x, 0), mean = R / n, sd = Math.sqrt(v.reduce((p, x) => p + (x - mean) ** 2, 0) / Math.max(1, n - 1));
  let eq = 0, peak = 0, dd = 0, st = 0, ws = 0;
  for (const x of v) { eq += x; peak = Math.max(peak, eq); dd = Math.min(dd, eq - peak); if (x < 0) { st++; ws = Math.max(ws, st); } else st = 0; }
  const r2 = (x) => Math.round(x * 100) / 100, r3 = (x) => Math.round(x * 1000) / 1000;
  return { n, wr: r3(v.filter((x) => x > 0).length / n), exp: r3(mean), R: r2(R), maxDD: r2(dd), streak: ws, t: r2(sd > 0 ? mean / sd * Math.sqrt(n) : 0) };
}
export const yearOf = (t) => new Date(t * 1000).getUTCFullYear();
export function report(rows) {
  const out = { all: stats(rows), gross: stats(rows, 'g'), is: stats(rows.filter((x) => x.t < IS_END)), oos: stats(rows.filter((x) => x.t >= IS_END)),
    oosGross: stats(rows.filter((x) => x.t >= IS_END), 'g'), years: {} };
  for (let y = 2018; y <= 2026; y++) out.years[y] = stats(rows.filter((x) => yearOf(x.t) === y));
  out.oosYearsPos = [2024, 2025, 2026].filter((y) => out.years[y].R > 0).length;
  return out;
}
// span stats for comparing to approval claims (e.g. 2023-24, 2025-26)
export function span(rows, y0, y1) { return stats(rows.filter((x) => yearOf(x.t) >= y0 && yearOf(x.t) <= y1)); }
