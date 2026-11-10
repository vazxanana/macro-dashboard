// Edge research · regime: multi-year replay of the council engine setups (Scalp M15->M1, Intraday H1->M5, Swing H4->H1) on
// HistData M1 (2018 - Oct 2026), with regime features measured at signal time from closed candles only.
// Usage: node research/edge/regime/replay.mjs <rawDir> <market> <outFile>
//   rawDir: the extracted research/candles folder of council-data (git archive origin/council-data research/candles/...)
//   market: xau | eurusd | gbpusd | audusd | usdcad | usdchf
// Signals come from council/engine.mjs (msAnalyze + buildSetup), unchanged. The step loop, fills (resting order or market
// fill when price is already through), pending expiry, freshness check, management (no break-even, target 1) and spread cost
// follow council/backtest.mjs. Differences (data only): HistData spot candles (EST -> UTC) instead of Kraken/Yahoo; the D1
// trend label comes from the same feed's daily candles (17:00 New York close) instead of OANDA's; no portfolio limits
// (signal-level, like backtest.json); USD/JPY-style pip sizes are not needed (no JPY market here).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { msAnalyze, CFG, PAIRS, buildSetup, setMarket } from '../../../council/engine.mjs';
import { cleanBars, LTF_CLEAN } from '../../../council/clean.mjs';
import { histStampUtc } from '../../../council/histdata.mjs';   // HistData clock: UTC-5, UTC-4 in Europe's summer (2018: New York time)

const [RAW, KEY, OUT] = process.argv.slice(2);
const MARKETS = {
  xau: { label: 'XAU/USD', group: 'Metals', dir: 'xau-histdata', file: 'XAUUSD', dec: 2, spot: true },
  eurusd: { label: 'EUR/USD', group: 'Forex', dir: 'EURUSD', file: 'EURUSD', dec: 5 },
  gbpusd: { label: 'GBP/USD', group: 'Forex', dir: 'GBPUSD', file: 'GBPUSD', dec: 5 },
  audusd: { label: 'AUD/USD', group: 'Forex', dir: 'AUDUSD', file: 'AUDUSD', dec: 5 },
  usdcad: { label: 'USD/CAD', group: 'Forex', dir: 'USDCAD', file: 'USDCAD', dec: 5 },
  usdchf: { label: 'USD/CHF', group: 'Forex', dir: 'USDCHF', file: 'USDCHF', dec: 5 },
};
const M = MARKETS[KEY];
// live Coach settings today (council-data config.json, 7 Nov): buf 0.15, minRisk 1.1 (clamped to the 1.2 limit), minRR 1.2
CFG.buf = 0.15; CFG.minRisk = 1.1;
const MIN_RR = 1.2;
const TFS = [['4h', 14400], ['1h', 3600], ['15m', 900], ['5m', 300], ['1m', 60]];
const SEC = Object.fromEntries(TFS); SEC['1d'] = 86400;
const WAIT = { '4h': 2 * 86400, '1h': 12 * 3600, '15m': 3 * 3600 };
const FRESH = 12, WIN = 720, STEP = 300;
const SETUPS = PAIRS.filter((p) => ['scalp', 'intraday', 'swing'].includes(p.k));
const sessionOf = (t) => { const h = new Date(t * 1000).getUTCHours(); return h < 7 ? 'asia' : h < 12 ? 'london' : h < 16 ? 'overlap' : h < 21 ? 'newyork' : 'late'; };
const marketOpen = (t) => { const d = new Date(t * 1000), wd = d.getUTCDay(), h = d.getUTCHours(); return !(wd === 6 || (wd === 0 && h < 23) || (wd === 5 && h >= 21)); };
const spreadOf = (price) => M.group === 'Forex' ? 0.0001 : M.spot ? 0.3 : price * 0.0002;

// ─── load M1 (HistData clock: council/histdata.mjs; fixed UTC-5 before 9 Nov) ───
// Stored as typed arrays (the machine is shared; 3M+ bar objects per market do not fit next to other jobs). Each file is
// cleaned with the shared bad-print cleaner (clean.mjs, 1m options) before it is packed.
function loadM1() {
  const dir = path.join(RAW, M.dir), files = fs.readdirSync(dir).filter((f) => f.endsWith('.csv.gz')).sort();
  const CAP = 3_800_000, A = { T: new Float64Array(CAP), O: new Float64Array(CAP), H: new Float64Array(CAP), L: new Float64Array(CAP), C: new Float64Array(CAP) };
  let n = 0;
  for (const f of files) {
    const txt = zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString();
    const part = [];
    for (const ln of txt.split('\n')) {
      if (ln.length < 20) continue;
      const p = ln.split(';');
      const s = p[0];
      const t = histStampUtc(s);
      part.push({ time: t, open: +p[1], high: +p[2], low: +p[3], close: +p[4] });
    }
    part.sort((a, b) => a.time - b.time);
    cleanBars(part, M.group === 'Forex' ? { wickK: 15 } : {});
    for (const b of part) { if (n && b.time <= A.T[n - 1]) continue; A.T[n] = b.time; A.O[n] = b.open; A.H[n] = b.high; A.L[n] = b.low; A.C[n] = b.close; n++; }
  }
  A.n = n;
  return A;
}
function aggregateTA(A, sec, shift = 0) {
  const out = []; let cur = null;
  for (let i = 0; i < A.n; i++) {
    const t0 = Math.floor((A.T[i] + shift) / sec) * sec - shift;
    if (!cur || cur.time !== t0) { cur = { time: t0, open: A.O[i], high: A.H[i], low: A.L[i], close: A.C[i] }; out.push(cur); }
    else { if (A.H[i] > cur.high) cur.high = A.H[i]; if (A.L[i] < cur.low) cur.low = A.L[i]; cur.close = A.C[i]; }
  }
  return out;
}

// ─── regime series from closed daily / H4 candles ───
const DSHIFT = 2 * 3600;   // trading day = 22:00 UTC (17:00 New York, EST) to 22:00 UTC
const dayKey = (t) => Math.floor((t + DSHIFT) / 86400);
function trs(B) { return B.map((b, i) => i ? Math.max(b.high - b.low, Math.abs(b.high - B[i - 1].close), Math.abs(b.low - B[i - 1].close)) : b.high - b.low); }
function wilder(x, n) { const o = new Array(x.length).fill(null); let s = 0; for (let i = 0; i < x.length; i++) { if (i < n) { s += x[i]; if (i === n - 1) o[i] = s / n; } else o[i] = (o[i - 1] * (n - 1) + x[i]) / n; } return o; }
function pctRank(arr, i, look) {   // share of the previous `look` values (i-look .. i-1) below arr[i]
  if (arr[i] == null) return null; let n = 0, b = 0;
  for (let j = Math.max(0, i - look); j < i; j++) if (arr[j] != null) { n++; if (arr[j] < arr[i]) b++; }
  return n >= Math.min(look, 100) ? b / n : null;
}
function dailyFeatures(D) {
  const n = D.length, tr = trs(D), atr = wilder(tr, 14);
  const up = D.map((b, i) => i ? Math.max(b.high - D[i - 1].high, 0) : 0), dn = D.map((b, i) => i ? Math.max(D[i - 1].low - b.low, 0) : 0);
  const pdm = up.map((u, i) => u > dn[i] ? u : 0), mdm = dn.map((d, i) => d > up[i] ? d : 0);
  const sTR = wilder(tr, 14), sP = wilder(pdm, 14), sM = wilder(mdm, 14);
  const dx = D.map((_, i) => sTR[i] ? (() => { const p = 100 * sP[i] / sTR[i], m = 100 * sM[i] / sTR[i]; return p + m ? 100 * Math.abs(p - m) / (p + m) : 0; })() : null);
  const adx = new Array(n).fill(null); { let s = 0, k = 0; for (let i = 0; i < n; i++) { if (dx[i] == null) continue; if (k < 14) { s += dx[i]; k++; if (k === 14) adx[i] = s / 14; } else adx[i] = (adx[i - 1] * 13 + dx[i]) / 14; } }
  const ma = (L) => D.map((_, i) => { if (i < L - 1) return null; let s = 0; for (let j = i - L + 1; j <= i; j++) s += D[j].close; return s / L; });
  const ma20 = ma(20), ma50 = ma(50);
  const lr = D.map((b, i) => i ? Math.log(b.close / D[i - 1].close) : 0);
  const rv5 = D.map((_, i) => { if (i < 5) return null; const x = lr.slice(i - 4, i + 1), m = x.reduce((a, b) => a + b, 0) / 5; return Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / 4); });
  const atrPct = atr.map((_, i) => pctRank(atr, i, 250)), rvPct = rv5.map((_, i) => pctRank(rv5, i, 250));
  return { atr, adx, ma20, ma50, rv5, atrPct, rvPct };
}

// ─── news days (UTC dates) ───
// NFP: first Friday of the month (calendar rule). FOMC: statement days from the Fed's published schedules 2018-2026
// (hard-coded; incl. the 2020 emergency moves). CPI: no data here, so a calendar approximation (a Tue-Thu between the 10th
// and the 15th; the BLS release day falls in that window in most months, but this rule also flags non-release days).
const FOMC = new Set(('2018-01-31 2018-03-21 2018-05-02 2018-06-13 2018-08-01 2018-09-26 2018-11-08 2018-12-19 ' +
  '2019-01-30 2019-03-20 2019-05-01 2019-06-19 2019-07-31 2019-09-18 2019-10-30 2019-12-11 ' +
  '2020-01-29 2020-03-03 2020-03-15 2020-04-29 2020-06-10 2020-07-29 2020-09-16 2020-11-05 2020-12-16 ' +
  '2021-01-27 2021-03-17 2021-04-28 2021-06-16 2021-07-28 2021-09-22 2021-11-03 2021-12-15 ' +
  '2022-01-26 2022-03-16 2022-05-04 2022-06-15 2022-07-27 2022-09-21 2022-11-02 2022-12-14 ' +
  '2023-02-01 2023-03-22 2023-05-03 2023-06-14 2023-07-26 2023-09-20 2023-11-01 2023-12-13 ' +
  '2024-01-31 2024-03-20 2024-05-01 2024-06-12 2024-07-31 2024-09-18 2024-11-07 2024-12-18 ' +
  '2025-01-29 2025-03-19 2025-05-07 2025-06-18 2025-07-30 2025-09-17 2025-10-29 2025-12-10 ' +
  '2026-01-28 2026-03-18 2026-04-29 2026-06-17 2026-07-29 2026-09-16 2026-10-28 2026-12-09').split(' '));
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
function newsKind(t) {
  const d = new Date(t * 1000), dom = d.getUTCDate(), wd = d.getUTCDay();
  if (wd === 5 && dom <= 7) return 'nfp';
  if (FOMC.has(iso(t))) return 'fomc';
  if (wd >= 2 && wd <= 4 && dom >= 10 && dom <= 15) return 'cpiwin';
  return null;
}
function newsTag(t) {
  const k = newsKind(t); if (k) return k;
  // the trading day before / after a NFP or FOMC day (weekends skipped)
  const prevT = (x) => { let y = x - 86400; while ([0, 6].includes(new Date(y * 1000).getUTCDay())) y -= 86400; return y; };
  const nextT = (x) => { let y = x + 86400; while ([0, 6].includes(new Date(y * 1000).getUTCDay())) y += 86400; return y; };
  const nk = newsKind(nextT(t)), pk = newsKind(prevT(t));
  if (nk === 'nfp' || nk === 'fomc') return 'pre';
  if (pk === 'nfp' || pk === 'fomc') return 'post';
  return 'none';
}

// ─── main ───
const t0 = Date.now();
const m1 = loadM1(), N1 = m1.n, MT = m1.T, MO = m1.O, MH = m1.H, ML = m1.L, MC = m1.C;
const data = {};
for (const [id, sec] of TFS) if (id !== '1m') { data[id] = aggregateTA(m1, sec); cleanBars(data[id], M.group === 'Forex' && LTF_CLEAN.has(id) ? { wickK: 15 } : {}); }
// 1m bar objects are made on demand for the last ~720 minutes and dropped after (rolling cache)
const m1o = new Array(N1).fill(null);
const bar1 = (i) => m1o[i] || (m1o[i] = { time: MT[i], open: MO[i], high: MH[i], low: ML[i], close: MC[i] });
const D = aggregateTA(m1, 86400, DSHIFT);

const DF = dailyFeatures(D);
const dIdx = new Map(D.map((b, i) => [dayKey(b.time), i]));
const H4 = data['4h'], h4atr = wilder(trs(H4), 14), h4pct = h4atr.map((_, i) => pctRank(h4atr, i, 1500));
// weekly ranges (Monday weeks on the trading day): completed-week range / mean of the previous 8 completed weeks
const wkOf = (dk) => Math.floor((dk - 4) / 7);   // dayKey 4 = Monday 5 Jan 1970
const WK = new Map(); for (const b of D) { const w = wkOf(dayKey(b.time)); const x = WK.get(w); if (!x) WK.set(w, { hi: b.high, lo: b.low }); else { x.hi = Math.max(x.hi, b.high); x.lo = Math.min(x.lo, b.low); } }
const d1Cache = new Map();
const d1Trend = (dk) => { if (d1Cache.has(dk)) return d1Cache.get(dk); const i = dIdx.has(dk) ? dIdx.get(dk) : D.findIndex((b) => dayKey(b.time) >= dk); const w = D.slice(Math.max(0, i - 720), i); const v = w.length > 100 ? msAnalyze(w, 6).trend : null; d1Cache.set(dk, v); return v; };
console.log(`${KEY}: ${N1} 1m, ${D.length} D1, load ${((Date.now() - t0) / 1000).toFixed(0)}s`);

setMarket({ group: M.group, dec: M.dec, spot: !!M.spot });
const ptr = Object.fromEntries(TFS.map(([id]) => [id, 0]));
const seen = new Set(), open = [], done = [];
let i1 = 0, steps = 0, h4p = 0;
let dayHi = -Infinity, dayLo = Infinity, curDay = null, wkHi = -Infinity, wkLo = Infinity, curWk = null;
const startT = Math.floor(MT[0] / STEP) * STEP, endT = process.env.END_DAYS ? startT + +process.env.END_DAYS * 86400 : MT[N1 - 1];
for (let t = startT; t <= endT; t += STEP) {
  while (i1 < N1 && MT[i1] < t) {
    if (i1 >= 2 * WIN) m1o[i1 - 2 * WIN] = null;
    const b = bar1(i1++);
    const dk = dayKey(b.time), wk = wkOf(dk);
    if (dk !== curDay) { curDay = dk; dayHi = -Infinity; dayLo = Infinity; }
    if (wk !== curWk) { curWk = wk; wkHi = -Infinity; wkLo = Infinity; }
    dayHi = Math.max(dayHi, b.high); dayLo = Math.min(dayLo, b.low); wkHi = Math.max(wkHi, b.high); wkLo = Math.min(wkLo, b.low);
    for (const tr of open) {
      if (tr.status === 'pending') {
        if (b.time < tr.opened) continue;
        const s = tr.side === 'sell';
        if (s ? b.high >= tr.entry : b.low <= tr.entry) { tr.status = 'open'; tr.filled = b.time; }
        else if (s ? b.low <= tr.t1 : b.high >= tr.t1) { tr.status = 'missed'; continue; }
        else { if (b.time - tr.opened > (WAIT[tr.h] || 86400)) tr.status = 'expired'; continue; }
      }
      if (tr.status !== 'open') continue;
      const s = tr.side === 'sell';
      tr.mfe = Math.max(tr.mfe, (s ? tr.entry - b.low : b.high - tr.entry) / tr.r0);
      if (s ? b.high >= tr.stop : b.low <= tr.stop) { tr.R = -1; tr.closed = b.time; tr.status = 'closed'; continue; }
      if (s ? b.low <= tr.t1 : b.high >= tr.t1) { tr.R = tr.rr; tr.closed = b.time; tr.status = 'closed'; }
    }
    for (let k = open.length - 1; k >= 0; k--) if (open[k].status !== 'pending' && open[k].status !== 'open') { const tr = open.splice(k, 1)[0]; if (tr.status === 'closed') done.push(tr); }
  }
  if (i1 < WIN || !marketOpen(t)) continue;
  if (t - MT[i1 - 1] > 3600) continue;   // data gap (holiday): nothing new to analyse
  const src = {};
  for (const [id, sec] of TFS) {
    let bars;
    if (id === '1m') { bars = []; for (let j = Math.max(0, i1 - (WIN - 1)); j < i1; j++) bars.push(bar1(j)); }   // closed 1m candles before t
    else {
      const arr = data[id]; let p = ptr[id];
      while (p < arr.length && arr[p].time + sec <= t) p++;
      ptr[id] = p;
      bars = arr.slice(Math.max(0, p - (WIN - 1)), p);
      const f0 = Math.floor(t / sec) * sec; let f = null;
      for (let j = i1 - 1; j >= 0 && MT[j] >= f0; j--) f = f ? { time: f0, open: MO[j], high: Math.max(f.high, MH[j]), low: Math.min(f.low, ML[j]), close: f.close } : { time: f0, open: MO[j], high: MH[j], low: ML[j], close: MC[j] };
      if (f) bars.push(f);
    }
    if (bars.length < 60) { src.bad = true; break; }
    src[id] = { bars, A: msAnalyze(bars, 6) };
  }
  if (src.bad) continue;
  steps++;
  const price = src['1m'].bars[src['1m'].bars.length - 1].close;
  for (const pr of SETUPS) {
    let st; try { st = buildSetup(pr, price, src); } catch (e) { st = null; }
    if (!st || st.state !== 'READY' || seen.has(st.sig)) continue;
    seen.add(st.sig);
    const side = st.sell ? 'sell' : 'buy';
    if (open.some((x) => x.k === st.k && x.side === side && Math.abs(x.t1 - st.t1) <= Math.abs(st.t1) * 1e-5)) continue;
    const cfT = +String(st.sig).split('|')[2];
    if (!cfT || t - cfT > FRESH * SEC[pr.l]) continue;
    const dk = dayKey(t), di = dIdx.has(dk) ? dIdx.get(dk) - 1 : null;   // the last CLOSED daily candle
    if (di == null || di < 60) continue;
    const dir = st.sell ? -1 : 1, d1 = d1Trend(dk);
    while (h4p < H4.length && H4[h4p].time + 14400 <= t) h4p++;
    const hi = h4p - 1, atrD = DF.atr[di], cD = D[di].close;
    // weekly expansion: last completed week's range vs the mean of the 8 before it; this week's range so far vs that mean
    const w = wkOf(dk), prevW = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => WK.get(w - k)).filter(Boolean).map((x) => x.hi - x.lo);
    const wAvg = prevW.length >= 5 ? prevW.slice(1).reduce((a, b) => a + b, 0) / (prevW.length - 1) : null;
    const wAvg8 = prevW.length >= 5 ? prevW.slice(0, 8).reduce((a, b) => a + b, 0) / Math.min(8, prevW.length) : null;
    const h4t = src['4h'].A.trend;
    const feat = {
      d1: d1 === dir ? 'with' : 'against', session: sessionOf(t),
      atrPctD: DF.atrPct[di], atrPctH4: hi >= 0 ? h4pct[hi] : null, adx: DF.adx[di],
      dist20: DF.ma20[di] != null ? (cD - DF.ma20[di]) / atrD * dir : null, dist50: DF.ma50[di] != null ? (cD - DF.ma50[di]) / atrD * dir : null,
      adist20: DF.ma20[di] != null ? Math.abs(cD - DF.ma20[di]) / atrD : null,
      wkExp: wAvg ? prevW[0] / wAvg : null, wkSoFar: wAvg8 && isFinite(wkHi) ? (wkHi - wkLo) / wAvg8 : null,
      rvPct: DF.rvPct[di], dayRange: isFinite(dayHi) ? (dayHi - dayLo) / atrD : null,
      dow: new Date(t * 1000).getUTCDay(), wom: Math.ceil(new Date(t * 1000).getUTCDate() / 7), news: newsTag(t),
      h4: h4t === dir ? 'with' : h4t === -dir ? 'against' : 'none',
    };
    const tr = { k: st.k, h: pr.h, side, entry: st.entry, stop: st.stop, t1: st.t1, rr: st.rr, opened: t, status: 'pending', feat, mfe: 0 };
    if (st.sell ? price >= st.entry : price <= st.entry) {
      const r = Math.abs(price - st.stop), rw = (st.t1 - price) * (st.sell ? -1 : 1);
      if (!(r > 0) || (st.sell ? price >= st.stop : price <= st.stop) || rw <= 0) continue;
      tr.entry = price; tr.rr = rw / r; tr.status = 'open'; tr.filled = t;
    }
    tr.r0 = Math.abs(tr.entry - tr.stop); tr.cost = tr.r0 > 0 ? spreadOf(tr.entry) / tr.r0 : 0;
    if (!(tr.r0 > 0)) continue;
    open.push(tr);
  }
}
const r4 = (v) => v == null || !isFinite(v) ? null : +v.toFixed(4);
const cols = ['k', 'side', 'opened', 'filled', 'closed', 'rr', 'R', 'cost', 'mfe', 'd1', 'session', 'atrPctD', 'atrPctH4', 'adx', 'dist20', 'dist50', 'adist20', 'wkExp', 'wkSoFar', 'rvPct', 'dayRange', 'dow', 'wom', 'news', 'h4'];
const rows = done.map((x) => [x.k, x.side, x.opened, x.filled, x.closed, r4(x.rr), r4(x.R), r4(x.cost), r4(x.mfe), x.feat.d1, x.feat.session,
  r4(x.feat.atrPctD), r4(x.feat.atrPctH4), r4(x.feat.adx), r4(x.feat.dist20), r4(x.feat.dist50), r4(x.feat.adist20), r4(x.feat.wkExp), r4(x.feat.wkSoFar), r4(x.feat.rvPct), r4(x.feat.dayRange), x.feat.dow, x.feat.wom, x.feat.news, x.feat.h4]);
fs.writeFileSync(OUT, JSON.stringify({ market: KEY, cols, rows, steps }));
console.log(`${KEY}: ${steps} steps, ${done.length} closed trades, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
