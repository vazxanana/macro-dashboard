// Multi-year replay of the council's Scalp (M15 -> M1) with the LIVE engine (council/engine.mjs buildSetup, msAnalyze)
// and the same signal plumbing as council/backtest.mjs (5-minute steps, 720-candle views with the forming M15 candle,
// READY + fresh CF within 12 M1 candles, one open trade per setup/side/target, limit at the broken M1 level for 3 h or
// market when price is already through, "missed" if the target trades first, stop-first inside a candle, no
// break-even = the live 'none' management). D1 label = msAnalyze(N=6) trend of the closed UTC daily candles (the OANDA
// D1 label the live trader uses). Data: HistData M1 BID (no cleaner: HistData has no Kraken-style bad prints).
//
// Every signal is then executed under several cost / latency scenarios on the same M1 path (see SCEN below).
//   node research/edge/costs/scalp.mjs <dataRoot> <SYM> <fromYear> <toYear> <out.json>
import fs from 'node:fs';
import { msAnalyze, CFG, PAIRS, buildSetup, setMarket } from '../../../council/engine.mjs';
import { loadM1, aggregate } from './load.mjs';
import { model, nyHour } from './costs.mjs';

const [ROOT, SYM, Y0, Y1, OUT] = process.argv.slice(2);
const M = SYM === 'XAUUSD' ? { label: 'XAU/USD', group: 'Metals', dec: 2, spot: true } : { label: SYM, group: 'Forex', dec: 5 };
setMarket(M);
CFG.buf = 0.15; CFG.minRisk = 1.1;   // live config.json (buf 0.15, minRisk 1.1)
const PR = PAIRS.find((p) => p.k === 'scalp');
const WIN = 720, STEP = 300, FRESH = 12, WAIT = 3 * 3600;
const sessionOf = (t) => { const h = new Date(t * 1000).getUTCHours(); return h < 7 ? 'asia' : h < 12 ? 'london' : h < 16 ? 'overlap' : h < 21 ? 'newyork' : 'late'; };
const marketOpen = (t) => { const d = new Date(t * 1000), wd = d.getUTCDay(), h = d.getUTCHours(); return !(wd === 6 || (wd === 0 && h < 23) || (wd === 5 && h >= 21)); };
const engSpread = M.group === 'Forex' ? 0.0001 : 0.3;   // backtest.mjs spreadOf (the cost the council charges today)

const t0w = Date.now();
const m1 = loadM1(ROOT, SYM, +Y0 - 1, +Y1);   // previous year = warm-up for D1 / M15
const m15 = aggregate(m1, 900), d1 = aggregate(m1, 86400);
console.log(SYM, 'loaded', m1.length, 'M1', ((Date.now() - t0w) / 1000).toFixed(0) + 's');
const start = Date.UTC(+Y0, 0, 1) / 1000, end = Date.UTC(+Y1 + 1, 0, 1) / 1000;

// D1 trend label per UTC day from closed days (cached)
const d1Cache = new Map();
function d1Trend(t) { const d = Math.floor(t / 86400) * 86400; if (d1Cache.has(d)) return d1Cache.get(d);
  let k = 0; while (k < d1.length && d1[k].time < d) k++; const w = d1.slice(Math.max(0, k - 720), k); const v = w.length > 100 ? msAnalyze(w, 6).trend : 0; d1Cache.set(d, v); return v; }

// ─── 1. signals ───
const sigs = []; const seen = new Set(); const open = [];   // open: {side,t1,until} to mimic the "same setup/side/target already open" skip
let i1 = 0, i15 = 0;
for (let t = Math.floor(Math.max(start, m1[0].time + 30 * 86400) / STEP) * STEP; t < end; t += STEP) {
  while (i1 < m1.length && m1[i1].time + 60 <= t) i1++;
  while (i15 < m15.length && m15[i15].time + 900 <= t) i15++;
  if (i1 < WIN || i15 < 100) continue;
  if (!marketOpen(t)) continue;
  if (m1[i1 - 1].time < t - 600) continue;   // no fresh M1 (holiday / gap)
  const b1 = m1.slice(i1 - (WIN - 1), i1);
  const b15 = m15.slice(Math.max(0, i15 - (WIN - 1)), i15);
  const f0 = Math.floor(t / 900) * 900; let f = null;
  for (let j = i1 - 1; j >= 0 && m1[j].time >= f0; j--) { const b = m1[j]; f = f ? { time: f0, open: b.open, high: Math.max(f.high, b.high), low: Math.min(f.low, b.low), close: f.close } : { time: f0, open: b.open, high: b.high, low: b.low, close: b.close }; }
  if (f) b15.push(f);
  const src = { '1m': { bars: b1, A: msAnalyze(b1, 6) }, '15m': { bars: b15, A: msAnalyze(b15, 6) } };
  const price = b1.at(-1).close;
  let st; try { st = buildSetup(PR, price, src); } catch (e) { st = null; }
  if (!st || st.state !== 'READY' || seen.has(st.sig)) continue;
  seen.add(st.sig);
  const side = st.sell ? 'sell' : 'buy', s = st.sell ? -1 : 1;
  for (let k = open.length - 1; k >= 0; k--) if (open[k].until <= t) open.splice(k, 1);
  if (open.some((x) => x.side === side && Math.abs(x.t1 - st.t1) <= Math.abs(st.t1) * 1e-5)) continue;
  const cfT = +String(st.sig).split('|')[2];
  if (!cfT || t - cfT > FRESH * 60) continue;
  const mkt = st.sell ? price >= st.entry : price <= st.entry;
  const entry = mkt ? price : st.entry;
  if (mkt) { const r = Math.abs(price - st.stop), rw = (st.t1 - price) * s; if (!(r > 0) || (st.sell ? price >= st.stop : price <= st.stop) || rw <= 0) continue; }
  const r0 = Math.abs(entry - st.stop); if (!(r0 > 0)) continue;
  const d1v = d1Trend(t);
  const sig = { t, side, s, mkt, entry, stop: st.stop, t1: st.t1, r0, rr: Math.abs(st.t1 - entry) / r0, d1: d1v === 0 ? 'none' : d1v === s ? 'with' : 'against', session: sessionOf(t), ny: nyHour(t), i1, mktPx: price };
  sigs.push(sig);
  open.push({ side, t1: st.t1, until: t + 3 * 86400 });   // released when its gross trade closes (set below)
  // release time: approximate with the gross simulation's close
  const g = execute(sig, null, 0); open[open.length - 1].until = g.closed || t + WAIT;
}
console.log(SYM, 'signals', sigs.length, ((Date.now() - t0w) / 1000).toFixed(0) + 's');

// ─── 2. execution on the M1 path ───
// cost: null = frictionless mid (the backtest's own fill model); else a function t -> {spread, comm, slipM, slipS}.
// Bars are BID. ask = bid + spread(t). Buy limit fills when ask <= limit, sell limit when bid >= limit. Buy exits at bid
// (stop: bid <= stop, filled stop - slipS; target: bid >= target), sell exits at ask (stop: ask >= stop, + slipS).
// lat: minutes between the signal (the M1 close at t) and the order reaching the broker.
function execute(g, cost, lat) {
  const s = g.s, S = g.stop, T = g.t1, E = g.entry, active = g.t + lat * 60;
  let k = g.i1;   // first bar starting at or after t
  while (k < m1.length && m1[k].time < g.t) k++;
  let fill = null, filledAt = null, kk = k;
  const sp = (t) => cost ? cost(t).spread : 0;
  if (g.mkt) {
    while (kk < m1.length && m1[kk].time < active) kk++;
    if (kk >= m1.length) return { R: null };
    const b = m1[kk], c = cost ? cost(b.time) : null;
    // price at arrival: the open of the minute the order lands in (bid); buy pays the ask + slip
    fill = b.open + (s > 0 ? (c ? c.spread + c.slipM : 0) : (c ? -c.slipM : 0));
    if (s > 0 ? fill >= T : fill <= T) return { R: 0, fill: 0, why: 'past target' };
    filledAt = kk;
  } else {
    for (; kk < m1.length; kk++) {
      const b = m1[kk]; if (b.time < active) { if (s > 0 ? b.high >= T : b.low + sp(b.time) <= T) return { R: 0, fill: 0, why: 'missed' }; continue; }
      if (b.time - g.t > WAIT) return { R: 0, fill: 0, why: 'expired' };
      const a = sp(b.time);
      if (s > 0 ? b.low + a <= E : b.high >= E) { fill = (s > 0 ? Math.min(E, b.open + a) : Math.max(E, b.open)); filledAt = kk; break; }
      if (s > 0 ? b.high >= T : b.low + a <= T) return { R: 0, fill: 0, why: 'missed' };
    }
    if (filledAt == null) return { R: null };
  }
  const comm = cost ? cost(m1[filledAt].time).comm : 0;
  for (let j = filledAt; j < m1.length; j++) {
    const b = m1[j], a = sp(b.time), c = cost ? cost(b.time) : null;
    const hitS = s > 0 ? b.low <= S : b.high + a >= S;
    if (hitS) { const px = s > 0 ? Math.min(S, b.open) - (c ? c.slipS : 0) : Math.max(S, b.open + a) + (c ? c.slipS : 0);
      return { R: (s * (px - fill) - comm) / g.r0, fill: 1, closed: b.time + 60, out: 'stop' }; }
    const hitT = s > 0 ? b.high >= T : b.low + a <= T;
    if (hitT) return { R: (s * (T - fill) - comm) / g.r0, fill: 1, closed: b.time + 60, out: 'target' };
    if (b.time - m1[filledAt].time > 30 * 86400) return { R: (s * (b.close - fill) - comm) / g.r0, fill: 1, closed: b.time, out: 'time' };
  }
  return { R: null };
}

const raw = model(SYM, 'raw'), oanda = model(SYM, 'oanda');
const SCEN = {
  gross: [null, 0],                 // frictionless, instant: the backtest's fill model before its cost deduction
  raw0: [raw, 0], raw1: [raw, 1], raw2: [raw, 2], raw3: [raw, 3],
  oanda0: [oanda, 0], oanda2: [oanda, 2],
};
const rows = [];
for (const g of sigs) {
  const row = { t: g.t, y: new Date(g.t * 1000).getUTCFullYear(), side: g.side, mkt: g.mkt ? 1 : 0, d1: g.d1, session: g.session, ny: g.ny, r0: +g.r0.toPrecision(6), rr: +g.rr.toFixed(2),
    sprRaw: +raw(g.t).spread.toPrecision(4), sprOanda: +oanda(g.t).spread.toPrecision(4), engCost: +(engSpread / g.r0).toFixed(4) };
  for (const [k, [c, lat]] of Object.entries(SCEN)) { const x = execute(g, c, lat); row[k] = x.R == null ? null : +x.R.toFixed(4); if (k === 'gross') row.fill = x.fill; }
  rows.push(row);
}
fs.writeFileSync(OUT, JSON.stringify({ sym: SYM, from: Y0, to: Y1, scen: Object.keys(SCEN), rows }));
console.log(SYM, 'done', rows.length, ((Date.now() - t0w) / 1000).toFixed(0) + 's');
