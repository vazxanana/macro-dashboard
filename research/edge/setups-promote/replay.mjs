// Edge research · setups-promote: multi-year replay of the MERIDIAN engine setups (paper only).
// Runs the live engine (council/engine.mjs buildSetup/buildRetrace, choch.mjs, clean.mjs) on HistData M1 candles
// 2018-2026 the same way council/backtest.mjs does on its 30-day window: every 5 minutes the last 720 closed candles of each
// timeframe plus the forming one, READY signals with a fresh CF (12 lower-TF candles), a resting order at the entry (market
// fill when price is already through it; expiry by the higher TF as in trader.mjs WAIT), managed on M1 to stop or first
// target. Costs: one spread per round trip in R (backtest.mjs spreadOf: forex 0.0001, spot gold 0.3).
//   node replay.mjs <key> <candleDir> <out.json> [fromISO] [toISO]
// key: eurusd gbpusd audusd usdcad usdchf xau. HistData time → UTC with council/histdata.mjs (+5 h before 10 Nov 2026).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { msAnalyze, CFG, PAIRS, RETR, LBL, buildSetup, buildRetrace, setMarket } from '../../../council/engine.mjs';
import { m15cFeat } from '../../../council/choch.mjs';
import { cleanBars, LTF_CLEAN } from '../../../council/clean.mjs';
import { fastAnalyze } from './fastms.mjs';   // the engine's msAnalyze, same results, faster (check.mjs)

const [key, DIR, OUT, fromS = '2018-07-01', toS = '2026-11-01'] = process.argv.slice(2);
import { histStampUtc } from '../../../council/histdata.mjs';   // the shared HistData clock
const SYMS = { eurusd: 'EURUSD', gbpusd: 'GBPUSD', audusd: 'AUDUSD', usdcad: 'USDCAD', usdchf: 'USDCHF', xau: 'xau-histdata' };
const M = key === 'xau' ? { label: 'XAU/USD', group: 'Metals', spot: true, dec: 2 } : { label: key, group: 'Forex', dec: 5 };
// live config (council-data config.json, 7 Nov 2026): buf 0.15, minRisk 1.1, fresh 12
CFG.buf = 0.15; CFG.minRisk = +(process.env.MIN_RISK || 1.1);
LBL['30m'] = 'M30';
const FRESH = 12, WIN = 720, STEP = 300;
const TFS = [['1d', 86400], ['4h', 14400], ['1h', 3600], ['30m', 1800], ['15m', 900], ['5m', 300], ['1m', 60]];
const SEC = Object.fromEntries(TFS);
const DOFF = 7200;   // daily candles roll at 22:00 UTC (17:00 New York, standard time), like OANDA's D1
const bucket = (t, sec) => sec === 86400 ? Math.floor((t + DOFF) / sec) * sec - DOFF : Math.floor(t / sec) * sec;
const WAIT = { '1d': 5 * 86400, '4h': 2 * 86400, '1h': 12 * 3600, '30m': 6 * 3600, '15m': 3 * 3600 };
const sessionOf = (t) => { const h = new Date(t * 1000).getUTCHours(); return h < 7 ? 'asia' : h < 12 ? 'london' : h < 16 ? 'overlap' : h < 21 ? 'newyork' : 'late'; };
const marketOpen = (t) => { const d = new Date(t * 1000), wd = d.getUTCDay(), h = d.getUTCHours(); return !(wd === 6 || (wd === 0 && h < 23) || (wd === 5 && h >= 21)); };
const spreadOf = (price) => M.group === 'Forex' ? 0.0001 : 0.3;

// ─── candles ───
const sdir = path.join(DIR, SYMS[key]);
const files = fs.readdirSync(sdir).filter((f) => f.endsWith('.csv.gz')).sort();
const t0 = Date.parse(fromS + 'T00:00:00Z') / 1000, t1 = Date.parse(toS + 'T00:00:00Z') / 1000;
const loadFrom = t0 - 3 * 365 * 86400;   // 720 daily candles of warm-up
// Streaming load (memory): M1 candles are kept from 2 days before the start; every other timeframe is aggregated on the fly
// from the raw M1 candles, keeping only its own warm-up (720 candles before the start, plus margin; D1: 3 years).
const m1 = [], data = { '1m': m1 }, cur = {}, keepFrom = {};
for (const [id, sec] of TFS) if (id !== '1m') { data[id] = []; keepFrom[id] = id === '1d' ? loadFrom : t0 - (WIN + 30) * sec; }
let lastT = 0;
for (const f of files) {
  const yr = +f.match(/_(\d{4})/)[1]; if (yr < new Date(loadFrom * 1000).getUTCFullYear() || yr > new Date(t1 * 1000).getUTCFullYear()) continue;
  const txt = zlib.gunzipSync(fs.readFileSync(path.join(sdir, f))).toString();
  let p = 0;
  while (p < txt.length) {
    let e = txt.indexOf('\n', p); if (e < 0) e = txt.length;
    const line = txt.slice(p, e); p = e + 1;
    if (line.length < 20) continue;
    const [dt, o, h, l, c] = line.split(';');
    const t = histStampUtc(dt);
    if (t < loadFrom || t > t1 + 14 * 86400 || t <= lastT) continue;
    lastT = t;
    const b = { time: t, open: +o, high: +h, low: +l, close: +c };
    for (const [id, sec] of TFS) if (id !== '1m' && t >= keepFrom[id]) {
      const s = bucket(t, sec), x = cur[id];
      if (!x || x.time !== s) { cur[id] = { time: s, open: b.open, high: b.high, low: b.low, close: b.close }; data[id].push(cur[id]); }
      else { if (b.high > x.high) x.high = b.high; if (b.low < x.low) x.low = b.low; x.close = b.close; }
    }
    if (t >= t0 - 2 * 86400) m1.push(b);
  }
}
// bad-print cleaner (clean.mjs) on every timeframe, with the live Trader's options (forex: the lone-wick rule on M1-M30)
for (const [id] of TFS) cleanBars(data[id], M.group === 'Forex' && LTF_CLEAN.has(id) ? { wickK: 15 } : {});
console.error(`${key}: ${m1.length} M1 candles ${new Date(m1[0].time * 1000).toISOString().slice(0, 10)} → ${new Date(m1.at(-1).time * 1000).toISOString().slice(0, 10)}, ${data['1d'].length} D1`);

// D1 trend label: the engine's trend on the closed daily candles before this trading day (last 720), as backtest.mjs odTrend
const dCache = new Map();
const d1Trend = (t) => { const d = bucket(t, 86400); if (dCache.has(d)) return dCache.get(d); let p = 0; const D = data['1d']; while (p < D.length && D[p].time < d) p++;
  const w = D.slice(Math.max(0, p - 720), p), v = w.length > 100 ? fastAnalyze(w, 6).trend : 0; dCache.set(d, v); return v; };

// ─── setups ───
// the engine formats prices into its card text with toLocaleString (slow, display only): a plain String keeps every number the same
Number.prototype.toLocaleString = function () { return String(+this); };
setMarket(M);
const DEFS = PAIRS.concat(key === 'xau' ? [{ k: 'm30m1', name: 'M30', h: '30m', l: '1m', e: 'M1', up: '1h' }] : []).map((p) => [p, buildSetup])
  .concat(RETR.map((p) => [p, buildRetrace]));
function structFeat(sell, l, src, at) {   // trader.mjs / backtest.mjs structFeat
  const dir = sell ? -1 : 1, lp = src[l], ll = lp && lp.A && lp.A.last;
  const cf = ll && ll.dir === dir && ll.structure ? 'choch' : 'bo';
  const choch = ['15m', '5m'].some((id) => { const s = src[id]; return s && s.A && s.A.events.some((e) => e.dir === dir && e.structure && at - s.bars[e.breakIdx].time <= FRESH * SEC[id]); }) ? 'yes' : 'no';
  return { cf, choch };
}
function manage(v, tr, b) {   // backtest.mjs manage (first target only)
  if (v.done) return;
  const s = tr.side === 'sell', r0 = tr.r0;
  if (s ? b.high >= v.stop : b.low <= v.stop) { v.done = true; v.R = v.beMoved ? 0 : -1; v.closed = b.time; return; }
  if (s ? b.low <= tr.t1 : b.high >= tr.t1) { v.done = true; v.R = tr.rr; v.closed = b.time; return; }
  if (v.be && !v.beMoved && ((s ? tr.entry - b.low : b.high - tr.entry) / r0) >= v.be) { v.stop = tr.entry; v.beMoved = true; }
}
const VARIANTS = [['none', null], ['be1', 1]];

const ptr = Object.fromEntries(TFS.map(([id]) => [id, 0]));
const fb = {};   // forming candle per timeframe, from the M1 candles consumed so far
const seen = new Set(), open = [], done = [];
let i1 = 0, steps = 0;
const tw = Date.now();
while (i1 < m1.length && m1[i1].time < t0 - WIN * 60) i1++;
// after the chunk ends, no new signals: the trades still open are managed on up to 14 more days of candles
for (let t = Math.floor(t0 / STEP) * STEP; t <= t1 + 14 * 86400; t += STEP) {
  if (t > t1 && !open.length) break;
  while (i1 < m1.length && m1[i1].time < t) {
    const b = m1[i1++];
    for (const [id, sec] of TFS) if (id !== '1m') {
      const s = bucket(b.time, sec), f = fb[id];
      if (!f || f.time !== s) fb[id] = { time: s, open: b.open, high: b.high, low: b.low, close: b.close };
      else { if (b.high > f.high) f.high = b.high; if (b.low < f.low) f.low = b.low; f.close = b.close; }
    }
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
    for (let k = open.length - 1; k >= 0; k--) if (open[k].status !== 'pending' && open[k].status !== 'open') done.push(open.splice(k, 1)[0]);
  }
  if (t > t1 || !marketOpen(t) || i1 === 0 || t - m1[i1 - 1].time > 30 * 60) continue;   // closed, or no fresh M1 data (holiday gaps)
  const src = {}; let bad = false;
  for (const [id, sec] of TFS) {
    const arr = data[id]; let p = ptr[id];
    while (p < arr.length && arr[p].time + sec <= t) p++;
    ptr[id] = p;
    const bars = arr.slice(Math.max(0, p - (WIN - 1)), p);
    if (id !== '1m') { const f = fb[id]; if (f && f.time === bucket(t, sec) && f.time + sec > t) bars.push({ ...f }); }
    if (bars.length < 60) { bad = true; break; }
    src[id] = { bars, A: fastAnalyze(bars, 6) };
  }
  if (bad) continue;
  steps++;
  const price = src['1m'].bars.at(-1).close;
  for (const [pr, fn] of DEFS) {
    let st; try { st = fn(pr, price, src); } catch (e) { st = null; }
    if (!st || st.state !== 'READY' || seen.has(st.sig)) continue;
    seen.add(st.sig);
    const side = st.sell ? 'sell' : 'buy';
    if (open.some((x) => x.k === st.k && x.side === side && Math.abs(x.t1 - st.t1) <= Math.abs(st.t1) * 1e-5)) continue;
    const cfT = +String(st.sig).split('|')[2];
    if (!cfT || t - cfT > FRESH * SEC[pr.l]) continue;
    const d1 = d1Trend(t);
    const feat = { d1: d1 === (st.sell ? -1 : 1) ? 'with' : 'against', struct: st.retr == null ? 'n/a' : st.retr >= 0.5 ? 'main' : 'internal', session: sessionOf(t),
      ...structFeat(st.sell, pr.l, src, t), m15c: m15cFeat(src['15m'].bars, st.sell, t), align: st.align == null ? 'n/a' : st.align ? 'with' : 'against',
      h4: src['4h'].A.trend === (st.sell ? -1 : 1) ? 'with' : 'against' };
    const tr = { k: st.k, h: pr.h, side, entry: st.entry, stop: st.stop, t1: st.t1, rr: st.rr, opened: t, status: 'pending', feat, mfe: 0 };
    if (st.sell ? price >= st.entry : price <= st.entry) {
      const r = Math.abs(price - st.stop), rw = (st.t1 - price) * (st.sell ? -1 : 1);
      if (!(r > 0) || (st.sell ? price >= st.stop : price <= st.stop) || rw <= 0) continue;
      tr.entry = price; tr.rr = rw / r; tr.status = 'open'; tr.filled = t; tr.mkt = 1;
    }
    tr.r0 = Math.abs(tr.entry - tr.stop); if (!(tr.r0 > 0)) continue;
    tr.cost = spreadOf(tr.entry) / tr.r0;
    tr.v = VARIANTS.map(([n, be]) => ({ n, be, stop: tr.stop, beMoved: false, done: false, R: null }));
    open.push(tr);
  }
  if (steps % 20000 === 0) console.error(`${key} ${new Date(t * 1000).toISOString().slice(0, 10)} steps ${steps} trades ${done.length} ${((Date.now() - tw) / 1000).toFixed(0)}s`);
}
// m30m1 fires on the same M1 entry as the Scalp; trader.mjs keeps one (the Scalp). Flag those.
const scal = new Set(done.filter((x) => x.k === 'scalp').map((x) => `${x.side}|${x.opened}|${x.entry}`));
const cols = ['k', 'side', 'opened', 'filled', 'closed', 'status', 'rr', 'R', 'R_be1', 'cost', 'mfe', 'mkt', 'd1', 'struct', 'session', 'cf', 'choch', 'm15c', 'align', 'h4', 'dupScalp', 'r0', 'entry'];
const rows = done.concat(open).map((x) => [x.k, x.side, x.opened, x.filled || null, x.closed || null, x.status, +x.rr.toFixed(3),
  x.status === 'closed' ? x.v[0].R : null, x.status === 'closed' ? x.v[1].R : null, +x.cost.toFixed(4), +x.mfe.toFixed(2), x.mkt || 0,
  x.feat.d1, x.feat.struct, x.feat.session, x.feat.cf, x.feat.choch, x.feat.m15c, x.feat.align, x.feat.h4,
  x.k === 'm30m1' && scal.has(`${x.side}|${x.opened}|${x.entry}`) ? 1 : 0, +x.r0.toPrecision(5), +x.entry.toPrecision(7)]);
fs.writeFileSync(OUT, JSON.stringify({ key, from: fromS, to: toS, cfg: { buf: CFG.buf, minRisk: CFG.minRisk, fresh: FRESH, step: STEP }, steps, cols, rows }));
console.error(`${key}: done ${steps} steps, ${rows.length} rows, ${((Date.now() - tw) / 1000).toFixed(0)}s`);
