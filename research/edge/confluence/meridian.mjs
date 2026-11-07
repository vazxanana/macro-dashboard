// Meridian Scalp (M15 -> M1, up H1) and Intraday (H1 -> M5, up H4) replayed over multi-year HistData M1 with the live engine
// (council/engine.mjs buildSetup + msAnalyze), following council/backtest.mjs step by step: a 5-minute step, the last 720 closed
// candles of every timeframe plus the forming one, READY + fresh CF only, resting order at the setup's entry (filled at market when
// price is already through it), WAIT expiry, 'missed' when the target trades first, management on M1 candles, no break-even
// (R_none), spread cost per round trip from backtest.mjs spreadOf. Live Coach stop settings (buf 0.15, minRisk 1.1).
// Differences from backtest.mjs: candles are HistData spot M1 (all TFs aggregated from it; no Kraken/PAXG basis), only the two
// setups the study needs are built, and unfilled orders are dropped (backtest.mjs keeps them as 0R rows outside the stats).
// Usage: CONFL_RAW=<dir> node meridian.mjs <xau|nas|eurusd> <year> <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { msAnalyze, CFG, PAIRS, buildSetup, setMarket } from '../../../council/engine.mjs';
import { cleanBars, LTF_CLEAN } from '../../../council/clean.mjs';
import { MKT, loadM1, aggregate, daily } from './lib.mjs';

const [key, yS, out = '.'] = process.argv.slice(2), Y = +yS, M = MKT[key];
CFG.buf = 0.15; CFG.minRisk = 1.1;
setMarket({ ...M });
const TFS = [['4h', 14400], ['1h', 3600], ['15m', 900], ['5m', 300], ['1m', 60]];
const SEC = Object.fromEntries(TFS), WAIT = { '1h': 12 * 3600, '15m': 3 * 3600 }, FRESH = 12, WIN = 720, STEP = 300;
const DEFS = PAIRS.filter((p) => p.k === 'scalp' || p.k === 'intraday');
const spreadOf = (price) => M.group === 'Forex' ? 0.0001 : M.spot ? 0.3 : price * 0.0002;
const sessionOf = (t) => { const h = new Date(t * 1000).getUTCHours(); return h < 7 ? 'asia' : h < 12 ? 'london' : h < 16 ? 'overlap' : h < 21 ? 'newyork' : 'late'; };
const marketOpen = (t) => { const d = new Date(t * 1000), wd = d.getUTCDay(), h = d.getUTCHours(); return !(wd === 6 || (wd === 0 && h < 23) || (wd === 5 && h >= 21)); };

const all = loadM1(key, Y - 1, Y);
const startT = Date.UTC(Y, 0, 1) / 1000, endT = Math.min(process.env.DAYS ? startT + +process.env.DAYS * 86400 : Date.UTC(Y + 1, 0, 1) / 1000, all.at(-1).time + 60);
const m1 = all;
const data = { '1m': m1 };
for (const [id, sec] of TFS) if (id !== '1m') data[id] = aggregate(m1, sec);
for (const [id] of TFS) cleanBars(data[id], M.group === 'Forex' && LTF_CLEAN.has(id) ? { wickK: 15 } : {});
const D1 = daily(m1), d1Cache = new Map();
const d1Trend = (t) => { const d = Math.floor((t + 7200) / 86400); if (d1Cache.has(d)) return d1Cache.get(d); const w = D1.filter((b) => b.time + 86400 <= t).slice(-WIN); const v = w.length >= 60 ? msAnalyze(w, 6).trend : 0; d1Cache.set(d, v); return v; };

const ptr = Object.fromEntries(TFS.map(([id]) => [id, 0])), seen = new Set(), open = [], done = [];
let i1 = 0;
const t0 = Date.now();
for (let t = startT; t <= endT; t += STEP) {
  while (i1 < m1.length && m1[i1].time < t) {
    const b = m1[i1++];
    for (const tr of open) {
      if (tr.status === 'pending') {
        if (b.time < tr.opened) continue;
        const s = tr.side === 'sell';
        if (s ? b.high >= tr.entry : b.low <= tr.entry) { tr.status = 'open'; tr.filled = b.time; }
        else if (s ? b.low <= tr.t1 : b.high >= tr.t1) { tr.status = 'missed'; continue; }
        else { if (b.time - tr.opened > WAIT[tr.h]) tr.status = 'expired'; continue; }
      }
      if (tr.status !== 'open') continue;
      const s = tr.side === 'sell';
      if (s ? b.high >= tr.stop : b.low <= tr.stop) { tr.R = -1; tr.status = 'closed'; tr.closed = b.time; continue; }
      if (s ? b.low <= tr.t1 : b.high >= tr.t1) { tr.R = tr.rr; tr.status = 'closed'; tr.closed = b.time; }
    }
    for (let k = open.length - 1; k >= 0; k--) if (open[k].status !== 'pending' && open[k].status !== 'open') { const tr = open.splice(k, 1)[0]; if (tr.status === 'closed') done.push(tr); }
  }
  if (i1 < WIN || !marketOpen(t)) continue;
  const src = {};
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
    if (bars.length < 60) { src.bad = true; break; }
    src[id] = { bars, A: msAnalyze(bars, 6) };
  }
  if (src.bad) continue;
  if (t - src['1m'].bars.at(-1).time > 30 * 60) continue;   // stale (holiday gap): the live trader would see no fresh candles
  const price = src['1m'].bars.at(-1).close;
  for (const pr of DEFS) {
    let st; try { st = buildSetup(pr, price, src); } catch (e) { st = null; }
    if (!st || st.state !== 'READY' || seen.has(st.sig)) continue;
    seen.add(st.sig);
    const side = st.sell ? 'sell' : 'buy';
    if (open.some((x) => x.k === st.k && x.side === side && Math.abs(x.t1 - st.t1) <= Math.abs(st.t1) * 1e-5)) continue;
    const cfT = +String(st.sig).split('|')[2];
    if (!cfT || t - cfT > FRESH * SEC[pr.l]) continue;
    const dir = st.sell ? -1 : 1;
    const tr = { m: key, k: st.k, h: pr.h, side, entry: st.entry, stop: st.stop, t1: st.t1, rr: st.rr, opened: t, status: 'pending',
      d1: d1Trend(t) === dir ? 'with' : 'against', h1: src['1h'].A.trend === dir ? 'with' : 'against', h4: src['4h'].A.trend === dir ? 'with' : 'against', session: sessionOf(t) };
    if (st.sell ? price >= st.entry : price <= st.entry) {
      const r = Math.abs(price - st.stop), rw = (st.t1 - price) * (st.sell ? -1 : 1);
      if (!(r > 0) || (st.sell ? price >= st.stop : price <= st.stop) || rw <= 0) continue;
      tr.entry = price; tr.rr = rw / r; tr.status = 'open'; tr.filled = t;
    }
    tr.r0 = Math.abs(tr.entry - tr.stop); if (!(tr.r0 > 0)) continue;
    tr.cost = spreadOf(tr.entry) / tr.r0;
    open.push(tr);
  }
}
const rows = done.map((x) => [x.m, x.k, x.side, x.opened, x.filled, x.closed, +x.entry.toFixed(5), +x.stop.toFixed(5), +x.t1.toFixed(5), +x.rr.toFixed(3), +x.R.toFixed(3), +x.cost.toFixed(4), x.d1, x.h1, x.h4, x.session]);
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, `mer_${key}_${Y}.json`), JSON.stringify({ cols: ['m', 'k', 'side', 'opened', 'filled', 'closed', 'entry', 'stop', 't1', 'rr', 'R', 'cost', 'd1', 'h1', 'h4', 'session'], rows, openAtEnd: open.length }));
console.log(key, Y, 'trades', rows.length, 'secs', ((Date.now() - t0) / 1000).toFixed(0));
