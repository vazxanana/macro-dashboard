// Edge research · timing: multi-year replay of the MERIDIAN engine setups Scalp (M15 -> M1), Retrace M15 -> M1 (rscalp),
// Intraday (H1 -> M5) and Retrace H1 -> M5 (rintra) on HistData M1 candles, to measure results by time of day.
//   node research/edge/timing/replay.mjs <candlesDir> <market> <year> <outFile>
// The signal logic is the live engine's own code (council/engine.mjs buildSetup / buildRetrace / msAnalyze, the bad-print
// cleaner council/clean.mjs). The stepping, pending-order handling, freshness rule, duplicate rule, stop/target management
// and spread cost copy council/backtest.mjs: a step every 5 minutes, each timeframe = its last 720 closed candles plus
// the forming one built from M1, READY signals with a CF no older than 12 lower-timeframe candles, a limit at the engine's
// entry (filled at market when price is already through it), resting orders expire after WAIT, one spread per trade in R.
// Differences (stated): only the four setups above are built (and only the timeframes they read: M1, M5, M15, H1), the D1
// trend label is msAnalyze over the last 720 CLOSED New-York-17:00 daily candles (the OANDA alignment the live label uses;
// live includes the forming day), and the data is HistData converted to UTC with council/histdata.mjs (10 Nov 2026: UTC-5, UTC-4
// while Europe is on summer time, New York time in 2018; before, New York time all along, an hour off in the ~4 weeks a year
// the US and Europe switch apart).
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { msAnalyze, CFG, PAIRS, RETR, buildSetup, buildRetrace, setMarket } from '../../../council/engine.mjs';
import { cleanBars, LTF_CLEAN } from '../../../council/clean.mjs';
import { histToUtc, usDaylight } from '../../../council/histdata.mjs';   // the shared HistData clock

const [DIR, KEY, YEAR, OUT] = process.argv.slice(2);
const MK = {
  xau: { label: 'XAU/USD', group: 'Metals', dec: 1, spot: true, dir: 'xau-histdata', file: 'XAUUSD' },
  eurusd: { label: 'EUR/USD', group: 'Forex', dec: 5, dir: 'EURUSD', file: 'EURUSD' },
  gbpusd: { label: 'GBP/USD', group: 'Forex', dec: 5, dir: 'GBPUSD', file: 'GBPUSD' },
  audusd: { label: 'AUD/USD', group: 'Forex', dec: 5, dir: 'AUDUSD', file: 'AUDUSD' },
  usdcad: { label: 'USD/CAD', group: 'Forex', dec: 5, dir: 'USDCAD', file: 'USDCAD' },
  usdchf: { label: 'USD/CHF', group: 'Forex', dec: 5, dir: 'USDCHF', file: 'USDCHF' },
};
const M = MK[KEY], Y = +YEAR;
CFG.buf = 0.15; CFG.minRisk = 0.6;   // the backtest's defaults (config.json clamps around these)

// ── New York offset (US DST: 2nd Sunday of March 02:00 to 1st Sunday of November 02:00), for the 17:00 New York day ──
const nthSunday = (y, m, n) => { const d = new Date(Date.UTC(y, m, 1)); const first = (7 - d.getUTCDay()) % 7 + 1; return first + 7 * (n - 1); };
const dstCache = new Map();
function nyOffsetH(y, mo, d, h) {   // hours to add to NY local to get UTC
  let c = dstCache.get(y); if (!c) { c = { s: nthSunday(y, 2, 2), e: nthSunday(y, 10, 1) }; dstCache.set(y, c); }
  const k = mo * 100 + d, ks = 2 * 100 + c.s, ke = 10 * 100 + c.e;
  const dst = (k > ks || (k === ks && h >= 2)) && (k < ke || (k === ke && h < 2));
  return dst ? 4 : 5;
}
function loadFile(f, out, dayKeyOut) {
  const txt = zlib.gunzipSync(fs.readFileSync(f)).toString('utf8');
  let p = 0; const n = txt.length;
  while (p < n) {
    let e = txt.indexOf('\n', p); if (e < 0) e = n;
    const line = txt.slice(p, e); p = e + 1;
    if (line.length < 20) continue;
    const y = +line.slice(0, 4), mo = +line.slice(4, 6) - 1, d = +line.slice(6, 8), h = +line.slice(9, 11), mi = +line.slice(11, 13);
    const parts = line.slice(16).split(';');
    const t = histToUtc(y, mo + 1, d, h, mi), loc = t - (usDaylight(t) ? 4 : 5) * 3600;   // loc = New York wall clock
    out.push({ time: t, open: +parts[0], high: +parts[1], low: +parts[2], close: +parts[3] });
    dayKeyOut.push(Math.floor((loc + 7 * 3600) / 86400));   // NY trading day: 17:00 NY rollover (OANDA D1 alignment)
  }
}
function filesFor(y) {
  const d = path.join(DIR, M.dir), all = fs.readdirSync(d);
  const yr = all.filter((f) => f === `${M.file}_M1_${y}.csv.gz`);
  return yr.length ? yr.map((f) => path.join(d, f)) : all.filter((f) => f.startsWith(`${M.file}_M1_${y}`) && f.length === `${M.file}_M1_${y}01.csv.gz`.length).sort().map((f) => path.join(d, f));
}
function aggregate(m1, sec) {
  const out = []; let cur = null;
  for (const b of m1) {
    const t0 = Math.floor(b.time / sec) * sec;
    if (!cur || cur.time !== t0) { cur = { time: t0, open: b.open, high: b.high, low: b.low, close: b.close }; out.push(cur); }
    else { if (b.high > cur.high) cur.high = b.high; if (b.low < cur.low) cur.low = b.low; cur.close = b.close; }
  }
  return out;
}

// ── load: the previous year (warm-up: 720 H1 candles ~ 6 weeks; D1 trend needs years: daily candles from every year up to Y) ──
const t0wall = Date.now();
const m1 = [], dk = [];
for (const y of [Y - 1, Y]) for (const f of filesFor(y)) loadFile(f, m1, dk);
{ const cut = Date.UTC(Y, 0, 1) / 1000 - 60 * 86400; let k = 0; while (k < m1.length && m1[k].time < cut) k++; m1.splice(0, k); dk.splice(0, k); }   // keep a 60-day warm-up
// D1 trend per NY trading day: msAnalyze over the last 720 daily candles (17:00 New York rollover) closed before that day.
// Computed once per market from every year on file (each day only reads earlier days) and cached next to the output.
const d1File = path.join(path.dirname(OUT), `d1-${KEY}.json`);
let dTrend;
if (fs.existsSync(d1File)) dTrend = new Map(JSON.parse(fs.readFileSync(d1File, 'utf8')));
else {
  const daily = [], pushDay = (key, b) => {
    const L = daily[daily.length - 1];
    if (!L || L.key !== key) { if (L && key < L.key) return; daily.push({ key, time: key * 86400 - 7 * 3600, open: b.open, high: b.high, low: b.low, close: b.close }); }
    else { if (b.high > L.high) L.high = b.high; if (b.low < L.low) L.low = b.low; L.close = b.close; }
  };
  const ys = [...new Set(fs.readdirSync(path.join(DIR, M.dir)).map((f) => +f.slice(M.file.length + 4, M.file.length + 8)).filter(Boolean))].sort();
  for (const y of ys) { const a = [], k = []; for (const f of filesFor(y)) loadFile(f, a, k); for (let i = 0; i < a.length; i++) pushDay(k[i], a[i]); }
  dTrend = new Map();
  for (let i = 1; i < daily.length; i++) { const w = daily.slice(Math.max(0, i - 720), i); dTrend.set(daily[i].key, w.length > 100 ? msAnalyze(w, 6).trend : 0); }
  fs.writeFileSync(d1File, JSON.stringify([...dTrend]));
}

// ── timeframes (only those the four setups read), cleaned like the live Trader ──
const TFS = [['1h', 3600], ['15m', 900], ['5m', 300], ['1m', 60]];
const data = { '1m': m1 };
for (const [id, sec] of TFS) if (id !== '1m') data[id] = aggregate(m1, sec);
for (const [id] of TFS) cleanBars(data[id], M.group === 'Forex' && LTF_CLEAN.has(id) ? { wickK: 15 } : {});
setMarket(M);
if (process.env.DBG) console.log("loaded", (Date.now() - t0wall) / 1000);

const SEC = { '1h': 3600, '15m': 900, '5m': 300, '1m': 60 };
const WAIT = { '1h': 12 * 3600, '15m': 3 * 3600 };
const FRESH = 12, WIN = 720, STEP = 300;
const VARIANTS = [['none', null], ['be1', 1]];
const spreadOf = (price) => M.group === 'Forex' ? 0.0001 : M.spot ? 0.3 : price * 0.0002;
const marketOpen = (t) => { const d = new Date(t * 1000), wd = d.getUTCDay(), h = d.getUTCHours(); return !(wd === 6 || (wd === 0 && h < 23) || (wd === 5 && h >= 21)); };
const SETS = [[PAIRS.find((p) => p.k === 'scalp'), buildSetup], [PAIRS.find((p) => p.k === 'intraday'), buildSetup],
  [RETR.find((p) => p.k === 'rscalp'), buildRetrace], [RETR.find((p) => p.k === 'rintra'), buildRetrace]];
function structFeat(sell, l, src, at) {   // backtest.mjs structFeat
  const dir = sell ? -1 : 1, lp = src[l], ll = lp && lp.A && lp.A.last;
  const cf = ll && ll.dir === dir && ll.structure ? 'choch' : 'bo';
  const choch = ['15m', '5m'].some((id) => { const s = src[id]; return s && s.A && s.A.events.some((e) => e.dir === dir && e.structure && at - s.bars[e.breakIdx].time <= FRESH * SEC[id]); }) ? 'yes' : 'no';
  return { cf, choch };
}
function manage(v, tr, b) {   // backtest.mjs manage (no tp2 variant)
  if (v.done) return;
  const s = tr.side === 'sell', r0 = tr.r0;
  if (s ? b.high >= v.stop : b.low <= v.stop) { v.done = true; v.R = v.beMoved ? 0 : -1; v.closed = b.time; return; }
  if (s ? b.low <= tr.t1 : b.high >= tr.t1) { v.done = true; v.R = tr.rr; v.closed = b.time; return; }
  if (v.be && !v.beMoved && ((s ? tr.entry - b.low : b.high - tr.entry) / r0) >= v.be) { v.stop = tr.entry; v.beMoved = true; }
}

const yStart = Date.UTC(Y, 0, 1) / 1000, yEnd = Date.UTC(Y + 1, 0, 1) / 1000;
const startT = Math.max(yStart, Math.ceil((m1[0].time + 45 * 86400) / STEP) * STEP);
const endT = Math.min(yEnd, m1[m1.length - 1].time + 60, process.env.LIMIT_DAYS ? startT + process.env.LIMIT_DAYS * 86400 : Infinity);
const ptr = { '1h': 0, '15m': 0, '5m': 0, '1m': 0 };
const seen = new Set(), open = [], done = [];
let i1 = 0, steps = 0;
// skip the warm-up quickly
while (i1 < m1.length && m1[i1].time < startT - STEP) i1++;
for (let t = startT; t <= endT + 3 * 86400; t += STEP) {
  const inYear = t < endT;
  while (i1 < m1.length && m1[i1].time < t) {
    const b = m1[i1++];
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
      for (const v of tr.v) manage(v, tr, b);
      if (tr.v.every((v) => v.done)) { tr.status = 'closed'; tr.closed = tr.v[0].closed; }
    }
    for (let k = open.length - 1; k >= 0; k--) if (open[k].status !== 'pending' && open[k].status !== 'open') { const tr = open.splice(k, 1)[0]; if (tr.status === 'closed') done.push(tr); }
  }
  if (!inYear) { if (!open.length || i1 >= m1.length) break; continue; }
  if (!marketOpen(t)) continue;
  if (i1 < WIN || !m1[i1 - 1] || t - m1[i1 - 1].time > 30 * 60) continue;   // no fresh M1 data (holiday gap): the Trader would see stale candles
  const src = {}; let bad = false;
  for (const [id, sec] of TFS) {
    const arr = data[id]; let p = ptr[id];
    while (p < arr.length && arr[p].time + sec <= t) p++;
    ptr[id] = p;
    const bars = arr.slice(Math.max(0, p - (WIN - 1)), p);
    if (id !== '1m') {
      const f0 = Math.floor(t / sec) * sec; let f = null;
      for (let j = i1 - 1; j >= 0 && m1[j].time >= f0; j--) { const b = m1[j]; f = f ? { time: f0, open: b.open, high: Math.max(f.high, b.high), low: Math.min(f.low, b.low), close: f.close } : { time: f0, open: b.open, high: b.high, low: b.low, close: b.close }; }
      if (f) bars.push(f);
    }
    if (bars.length < 60) { bad = true; break; }
    src[id] = { bars, A: msAnalyze(bars, 6) };
  }
  if (bad) continue;
  steps++;
  const price = src['1m'].bars.at(-1).close;
  const dkey = Math.floor((t - nyOffsetH(new Date(t * 1000).getUTCFullYear(), new Date(t * 1000).getUTCMonth(), new Date(t * 1000).getUTCDate(), new Date(t * 1000).getUTCHours()) * 3600 + 7 * 3600) / 86400);
  const d1 = dTrend.get(dkey) || 0;
  for (const [pr, fn] of SETS) {
    let st; try { st = fn(pr, price, src); } catch (e) { st = null; }
    if (!st || st.state !== 'READY' || seen.has(st.sig)) continue;
    seen.add(st.sig);
    const side = st.sell ? 'sell' : 'buy';
    if (open.some((x) => x.k === st.k && x.side === side && Math.abs(x.t1 - st.t1) <= Math.abs(st.t1) * 1e-5)) continue;
    const cfT = +String(st.sig).split('|')[2];
    if (!cfT || t - cfT > FRESH * SEC[pr.l]) continue;
    const tr = { k: st.k, h: pr.h, side, entry: st.entry, stop: st.stop, t1: st.t1, rr: st.rr, opened: t, status: 'pending', mfe: 0,
      d1: d1 === (st.sell ? -1 : 1) ? 'with' : 'against', struct: st.retr == null ? 'n/a' : st.retr >= 0.5 ? 'main' : 'internal', ...structFeat(st.sell, pr.l, src, t) };
    if (st.sell ? price >= st.entry : price <= st.entry) {
      const r = Math.abs(price - st.stop), rw = (st.t1 - price) * (st.sell ? -1 : 1);
      if (!(r > 0) || (st.sell ? price >= st.stop : price <= st.stop) || rw <= 0) continue;
      tr.entry = price; tr.rr = rw / r; tr.status = 'open'; tr.filled = t;
    }
    tr.r0 = Math.abs(tr.entry - tr.stop); tr.cost = tr.r0 > 0 ? spreadOf(tr.entry) / tr.r0 : 0;
    if (!(tr.r0 > 0)) continue;
    tr.v = VARIANTS.map(([n, be]) => ({ n, be, stop: tr.stop, beMoved: false, done: false, R: null }));
    open.push(tr);
  }
}
const cols = ['market', 'setup', 'side', 'opened', 'filled', 'closed', 'rr', 'd1', 'struct', 'cf', 'choch', 'R_none', 'R_be1', 'cost', 'mfe'];
const rows = done.map((x) => [KEY, x.k, x.side, x.opened, x.filled, x.closed, +x.rr.toFixed(3), x.d1, x.struct, x.cf, x.choch, x.v[0].R == null ? null : +x.v[0].R.toFixed(3), x.v[1].R == null ? null : +x.v[1].R.toFixed(3), +x.cost.toFixed(4), +x.mfe.toFixed(2)]);
fs.writeFileSync(OUT, JSON.stringify({ market: KEY, year: Y, steps, cols, rows, secs: Math.round((Date.now() - t0wall) / 1000) }));
console.log(`${KEY} ${Y}: ${steps} steps, ${rows.length} closed trades, ${((Date.now() - t0wall) / 1000).toFixed(0)}s`);
