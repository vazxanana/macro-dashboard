// Edge research · meridian-swing: multi-year replay of the MERIDIAN Swing setups (H4 -> H1 `swing`, and the H4 -> H1
// retracement `rswing`) on OANDA mid candles, the live Trader's gold/forex feed (fetch.mjs). Paper research only.
// Same loop as council/backtest.mjs: a step every 5 minutes, each timeframe = its last 720 closed OANDA candles plus the
// forming one (built from the closed M5 candles inside it), READY signals with a CF no older than 12 H1 candles, a resting
// order at the entry (market fill when price is already through it), the 2-day H4 WAIT expiry, an order dropped as missed
// if target 1 trades first, one spread per round trip in R (forex 1 pip, spot gold 0.30), live Coach stops (buf 0.15,
// minRisk 1.1). Differences: trades are managed on M5 candles (stop checked before target inside a candle, as backtest.mjs
// does on M1), and every exit variant (exits.mjs) is run on the same fill.
//   node replay.mjs <key> <candleDir> <out.json>
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { CFG, PAIRS, RETR, buildSetup, buildRetrace, setMarket } from '../../../council/engine.mjs';
import { m15cFeat } from '../../../council/choch.mjs';
import { d1AdxFeat } from '../../../council/adx.mjs';
import { fastAnalyze } from '../setups-promote/fastms.mjs';   // engine msAnalyze, identical output (setups-promote/check.mjs)
import { VAR, newVariants, h1Pivots, manage } from './exits.mjs';   // the exit variants (none, be1, part, tp2, trail, trailT1)

const [key, DIR, OUT] = process.argv.slice(2);
const M = key === 'xau' ? { label: 'XAU/USD', group: 'Metals', spot: true, dec: 2 } : { label: key, group: 'Forex', dec: 5 };
CFG.buf = 0.15; CFG.minRisk = +(process.env.MIN_RISK || 1.1);
const FRESH = 12, WIN = 720, STEP = 300, WAIT = 2 * 86400;
const spread = M.group === 'Forex' ? 0.0001 : 0.3;
const sessionOf = (t) => { const h = new Date(t * 1000).getUTCHours(); return h < 7 ? 'asia' : h < 12 ? 'london' : h < 16 ? 'overlap' : h < 21 ? 'newyork' : 'late'; };
const marketOpen = (t) => { const d = new Date(t * 1000), wd = d.getUTCDay(), h = d.getUTCHours(); return !(wd === 6 || (wd === 0 && h < 23) || (wd === 5 && h >= 21)); };
Number.prototype.toLocaleString = function () { return String(+this); };   // engine card text only (slow); numbers unchanged
setMarket(M);

const load = (tf) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, `${key}-${tf}.json.gz`)))).map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
const m5 = load('5m'), data = { '1h': load('1h'), '4h': load('4h'), '1d': load('1d') };
const SEC = { '1d': 86400, '4h': 14400, '1h': 3600 };
const T0 = m5[0].time, T1 = m5.at(-1).time + 300;
console.error(`${key}: ${m5.length} M5 ${new Date(T0 * 1000).toISOString().slice(0, 10)} → ${new Date(T1 * 1000).toISOString().slice(0, 10)}`);

// Weekly candles (Monday weeks from the D1 candles) for a W1 trend label
const W1 = []; for (const b of data['1d']) { const d = new Date((b.time + 7200) * 1000), wk = Math.floor(((b.time + 7200) / 86400 - ((d.getUTCDay() + 6) % 7))) * 86400;
  const x = W1.at(-1); if (!x || x.time !== wk) W1.push({ time: wk, open: b.open, high: b.high, low: b.low, close: b.close }); else { x.high = Math.max(x.high, b.high); x.low = Math.min(x.low, b.low); x.close = b.close; } }
// D1 trend label as backtest.mjs odTrend: the engine's trend on the closed daily candles before this UTC day (last 720)
const dCache = new Map();
const d1Trend = (t) => { const d = Math.floor(t / 86400) * 86400; if (dCache.has(d)) return dCache.get(d); const w = data['1d'].filter((b) => b.time < d).slice(-720); const v = w.length > 100 ? fastAnalyze(w, 6).trend : 0; dCache.set(d, v); return v; };
const wCache = new Map();
const w1Trend = (t) => { const w = W1.filter((b) => b.time + 7 * 86400 <= t).slice(-720); const k = w.length; if (wCache.has(k)) return wCache.get(k); const v = w.length > 60 ? fastAnalyze(w, 3).trend : 0; wCache.set(k, v); return v; };
const agg = (bars, sec) => { const out = []; for (const b of bars) { const s = Math.floor(b.time / sec) * sec, x = out.at(-1); if (!x || x.time !== s) out.push({ time: s, open: b.open, high: b.high, low: b.low, close: b.close }); else { if (b.high > x.high) x.high = b.high; if (b.low < x.low) x.low = b.low; x.close = b.close; } } return out; };

const H1 = data['1h'], pivotAt = h1Pivots(H1);

const DEFS = PAIRS.filter((p) => p.k === 'swing').map((p) => [p, buildSetup]).concat(RETR.filter((p) => p.k === 'rswing').map((p) => [p, buildRetrace]));
const ptr = { '1d': 0, '4h': 0, '1h': 0 };
const seen = new Set(), open = [], done = [];
let i5 = 0, steps = 0; const tw = Date.now();
const startT = Math.max(T0 + 8 * 86400, H1[WIN].time + 3600);
for (let t = Math.floor(startT / STEP) * STEP; t <= T1; t += STEP) {
  while (i5 < m5.length && m5[i5].time + 300 <= t) {
    const b = m5[i5++];
    for (const tr of open) {
      if (tr.status === 'pending') {
        if (b.time < tr.opened) continue;
        const s = tr.side === 'sell';
        if (s ? b.high >= tr.entry : b.low <= tr.entry) { tr.status = 'open'; tr.filled = b.time; }
        else if (s ? b.low <= tr.t1 : b.high >= tr.t1) { tr.status = 'missed'; continue; }
        else { if (b.time - tr.opened > WAIT) tr.status = 'expired'; continue; }
      }
      if (tr.status !== 'open') continue;
      tr.mfe = Math.max(tr.mfe, ((tr.side === 'sell' ? tr.entry - b.low : b.high - tr.entry) / tr.r0));
      manage(tr, b, pivotAt, CFG.buf, 300);
      if (tr.v.every((v) => v.done)) { tr.status = 'closed'; tr.closed = Math.max(...tr.v.map((v) => v.closed)); }
    }
    for (let k = open.length - 1; k >= 0; k--) if (open[k].status !== 'pending' && open[k].status !== 'open') done.push(open.splice(k, 1)[0]);
  }
  if (!marketOpen(t) || i5 === 0 || t - (m5[i5 - 1].time + 300) > 30 * 60) continue;   // closed, or no fresh data
  const src = {}; let bad = false;
  for (const id of ['1d', '4h', '1h']) {
    const arr = data[id], sec = SEC[id]; let p = ptr[id];
    while (p < arr.length && arr[p].time + sec <= t) p++;
    ptr[id] = p;
    const bars = arr.slice(Math.max(0, p - (WIN - 1)), p);
    if (p < arr.length && arr[p].time <= t) {   // the forming candle, from the closed M5 candles inside it
      let f = null; for (let j = i5 - 1; j >= 0 && m5[j].time >= arr[p].time; j--) { const x = m5[j]; f = f ? { time: arr[p].time, open: x.open, high: Math.max(f.high, x.high), low: Math.min(f.low, x.low), close: f.close } : { time: arr[p].time, open: x.open, high: x.high, low: x.low, close: x.close }; }
      if (f) bars.push(f);
    }
    if (bars.length < 60) { bad = true; break; }
    src[id] = { bars, A: fastAnalyze(bars, 6) };
  }
  if (bad) continue;
  steps++;
  const price = m5[i5 - 1].close;
  for (const [pr, fn] of DEFS) {
    let st; try { st = fn(pr, price, src); } catch (e) { st = null; }
    if (!st || st.state !== 'READY' || seen.has(st.sig)) continue;
    seen.add(st.sig);
    const side = st.sell ? 'sell' : 'buy', dir = st.sell ? -1 : 1;
    if (open.some((x) => x.k === st.k && x.side === side && Math.abs(x.t1 - st.t1) <= Math.abs(st.t1) * 1e-5)) continue;
    const cfT = +String(st.sig).split('|')[2];
    if (!cfT || t - cfT > FRESH * 3600) continue;
    // conditions at the signal (closed candles only, except the engine's own panes which carry the forming candle like live)
    const m5w = m5.slice(Math.max(0, i5 - 3 * 720), i5), m15 = agg(m5w, 900).slice(-720), a5 = fastAnalyze(m5w.slice(-720), 6), a15 = fastAnalyze(m15, 6);
    const ll = src['1h'].A.last;
    const choch = [[m15, a15, 900], [m5w.slice(-720), a5, 300]].some(([B, A, sec]) => A.events.some((e) => e.dir === dir && e.structure && t - B[e.breakIdx].time <= FRESH * sec)) ? 'yes' : 'no';
    const adx = (() => { try { return d1AdxFeat(src['1d'].bars, t); } catch (e) { return { adx: null, adxBand: null }; } })();
    const feat = { d1: d1Trend(t) === dir ? 'with' : 'against', struct: st.retr == null ? 'n/a' : st.retr >= 0.5 ? 'main' : 'internal', session: sessionOf(t),
      cf: ll && ll.dir === dir && ll.structure ? 'choch' : 'bo', choch, m15c: m15cFeat(m15, st.sell, t), align: st.align == null ? 'n/a' : st.align ? 'with' : 'against',
      h4: src['4h'].A.trend === dir ? 'with' : 'against', w1: w1Trend(t) === dir ? 'with' : 'against', adx: adx.adx, adxBand: adx.adxBand, dow: new Date(t * 1000).getUTCDay() };
    const tr = { k: st.k, side, entry: st.entry, stop: st.stop, t1: st.t1, t2: st.t2 != null && (st.t2 - st.t1) * dir > 0 ? st.t2 : st.t1, rr: st.rr, opened: t, status: 'pending', feat, mfe: 0 };
    if (st.sell ? price >= st.entry : price <= st.entry) {
      const r = Math.abs(price - st.stop), rw = (st.t1 - price) * dir;
      if (!(r > 0) || (st.sell ? price >= st.stop : price <= st.stop) || rw <= 0) continue;
      tr.entry = price; tr.rr = rw / r; tr.status = 'open'; tr.filled = t; tr.mkt = 1;
    }
    tr.r0 = Math.abs(tr.entry - tr.stop); if (!(tr.r0 > 0)) continue;
    tr.cost = spread / tr.r0;
    tr.v = newVariants(tr);
    open.push(tr);
  }
  if (steps % 50000 === 0) console.error(`${key} ${new Date(t * 1000).toISOString().slice(0, 10)} steps ${steps} trades ${done.length} ${((Date.now() - tw) / 1000).toFixed(0)}s`);
}
const cols = ['k', 'side', 'opened', 'filled', 'closed', 'status', 'rr', ...VAR.map((n) => 'R_' + n), 'cost', 'mfe', 'mkt', 'd1', 'struct', 'session', 'cf', 'choch', 'm15c', 'align', 'h4', 'w1', 'adx', 'adxBand', 'dow', 'r0'];
const rows = done.concat(open).map((x) => [x.k, x.side, x.opened, x.filled || null, x.closed || null, x.status, +x.rr.toFixed(3),
  ...x.v.map((v) => x.status === 'closed' ? +v.R.toFixed(4) : null), +x.cost.toFixed(4), +x.mfe.toFixed(2), x.mkt || 0,
  x.feat.d1, x.feat.struct, x.feat.session, x.feat.cf, x.feat.choch, x.feat.m15c, x.feat.align, x.feat.h4, x.feat.w1, x.feat.adx, x.feat.adxBand, x.feat.dow, +x.r0.toPrecision(5)]);
fs.writeFileSync(OUT, JSON.stringify({ key, src: 'OANDA', from: new Date(startT * 1000).toISOString(), to: new Date(T1 * 1000).toISOString(), cfg: { buf: CFG.buf, minRisk: CFG.minRisk, fresh: FRESH, step: STEP, manage: 'M5' }, steps, cols, rows }));
console.error(`${key}: done ${steps} steps, ${rows.length} rows, ${((Date.now() - tw) / 1000).toFixed(0)}s`);
