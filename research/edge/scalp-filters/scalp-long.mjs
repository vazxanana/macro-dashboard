// Edge research · scalp-filters: the council's Scalp setup (M15 → M1) replayed over 2018–2026 M1 history.
// Usage: node research/edge/scalp-filters/scalp-long.mjs <SYMBOL> <candleDir> <outDir> [fromISO] [toISO]
//   candleDir holds <SYM>_M1_<year>.csv.gz / <SYM>_M1_<yyyymm>.csv.gz (HistData format; clock: council/histdata.mjs),
//   extracted from origin/council-data:research/candles/.
// Same engine as the live Trader and council/backtest.mjs: msAnalyze + buildSetup('scalp') from council/engine.mjs, the
// M15 CHoCH feature from council/choch.mjs, the bad-print cleaner from council/clean.mjs (forex LTFs with wickK 15).
// Replay loop copies backtest.mjs: a 5-minute step, 720-candle views (closed candles plus the forming one, 1m closed only),
// READY + unseen signature + fresh CF (12 M1 candles) + not the same open idea; limit at the engine entry (market fill when price
// is already through it), unfilled orders expire after 3 h or when the target trades first; managed on 1m candles to stop or T1.
// Differences (documented in RESULT.md): only the Scalp is built (the other setups are not needed); D1 trend from daily candles
// built from the same M1 data (NY-close days, 22:00 UTC) instead of OANDA's; H1/H4/M5 views and every feature are computed only
// when a Scalp is READY; no news guard (no news history); no portfolio limits (exposure / USD cap), recorded per trade instead.
// Every signal is written with its features; filters are applied afterwards (analyze.mjs), like the Coach does with backtest.json.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { msAnalyze, CFG, PAIRS, buildSetup, setMarket } from '../../../council/engine.mjs';
import { m15cFeat } from '../../../council/choch.mjs';
import { cleanBars, LTF_CLEAN } from '../../../council/clean.mjs';
import { histStampUtc } from '../../../council/histdata.mjs';   // HistData clock: UTC-5, UTC-4 in Europe's summer (2018: New York time)

const [SYM, CDIR, ODIR, FROM = '2018-06-15', TO = '2026-11-01'] = process.argv.slice(2);
// market model: engine group (stop floor) and the round-trip spread charged per trade (backtest.mjs spreadOf, with realistic
// values where its generic rule does not fit: JPY pips, silver cents, index points)
const MK = {
  EURUSD: { group: 'Forex', dec: 5, spr: 0.0001 }, GBPUSD: { group: 'Forex', dec: 5, spr: 0.0001 }, AUDUSD: { group: 'Forex', dec: 5, spr: 0.0001 },
  USDCAD: { group: 'Forex', dec: 5, spr: 0.0001 }, USDCHF: { group: 'Forex', dec: 5, spr: 0.0001 }, USDJPY: { group: 'Forex', dec: 3, spr: 0.01 },
  XAUUSD: { group: 'Metals', dec: 2, spot: true, spr: 0.3 }, XAGUSD: { group: 'Metals', dec: 3, spr: 0.025 },
  NSXUSD: { group: 'Index', dec: 1, spr: 1.5 }, SPXUSD: { group: 'Index', dec: 1, spr: 0.5 },
}[SYM];
if (!MK) throw new Error('unknown symbol ' + SYM);
// live Coach settings (council-data config.json, 7 Nov): buf 0.15, minRisk 1.1, minRR 1.2
CFG.buf = 0.15; CFG.minRisk = 1.1; const MIN_RR = 1.2;
setMarket(MK);

// ─── load M1 ───
const files = fs.readdirSync(CDIR).filter((f) => f.startsWith(SYM + '_M1_')).sort();
// M1 kept in typed arrays (3+ million candles); objects are made only for the 720-candle views
let cap = 4e6, n1 = 0, Tm = new Float64Array(cap), Om = new Float64Array(cap), Hm = new Float64Array(cap), Lm = new Float64Array(cap), Cm = new Float64Array(cap);
for (const f of files) {
  const lines = zlib.gunzipSync(fs.readFileSync(path.join(CDIR, f))).toString('utf8').split('\n');
  for (const line of lines) {
    if (line.length < 20) continue;
    const p = line.split(';'), s = p[0];
    const t = histStampUtc(s);
    if (n1 && t <= Tm[n1 - 1]) continue;   // files are in time order; drop duplicates / out-of-order lines
    Tm[n1] = t; Om[n1] = +p[1]; Hm[n1] = +p[2]; Lm[n1] = +p[3]; Cm[n1] = +p[4]; n1++;
  }
}
const bar1 = (i) => ({ time: Tm[i], open: Om[i], high: Hm[i], low: Lm[i], close: Cm[i] });
console.log(`${SYM}: ${n1} M1 candles ${new Date(Tm[0] * 1000).toISOString().slice(0, 10)} → ${new Date(Tm[n1 - 1] * 1000).toISOString().slice(0, 10)}`);

function aggregate(sec, shift = 0) {
  const out = []; let cur = null;
  for (let i = 0; i < n1; i++) {
    const t0 = Math.floor((Tm[i] + shift) / sec) * sec - shift;
    if (!cur || cur.time !== t0) { cur = { time: t0, open: Om[i], high: Hm[i], low: Lm[i], close: Cm[i] }; out.push(cur); }
    else { if (Hm[i] > cur.high) cur.high = Hm[i]; if (Lm[i] < cur.low) cur.low = Lm[i]; cur.close = Cm[i]; }
  }
  return out;
}
// timeframes built from the raw M1, then every one cleaned like backtest.mjs does (same cleaner, LTF wick rule on forex)
const TF = { '5m': aggregate(300), '15m': aggregate(900), '1h': aggregate(3600), '4h': aggregate(14400), '1d': aggregate(86400, 2 * 3600) };
const SEC = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 };
for (const id of Object.keys(TF)) cleanBars(TF[id], MK.group === 'Forex' && LTF_CLEAN.has(id) ? { wickK: 15 } : {});
// M1 cleaned in chunks (the cleaner only looks 100 candles back and 3 ahead): each chunk carries 150 already-cleaned candles before it
{ const opt = MK.group === 'Forex' ? { wickK: 15 } : {}, CH = 200000;
  for (let s = 0; s < n1; s += CH) {
    const a = Math.max(0, s - 150), e = Math.min(n1, s + CH), arr = [];
    for (let i = a; i < Math.min(n1, e + 4); i++) arr.push(bar1(i));
    cleanBars(arr, opt);
    for (let i = s; i < e; i++) { const b = arr[i - a]; Om[i] = b.open; Hm[i] = b.high; Lm[i] = b.low; Cm[i] = b.close; }
  } }
console.log(`cleaned; ${TF['15m'].length} M15, ${TF['1d'].length} D1`);

// ─── helpers ───
const WIN = 720, STEP = 300, FRESH = 12, WAIT15 = 3 * 3600;
const sessionOf = (t) => { const h = new Date(t * 1000).getUTCHours(); return h < 7 ? 'asia' : h < 12 ? 'london' : h < 16 ? 'overlap' : h < 21 ? 'newyork' : 'late'; };
const marketOpen = (t) => { const d = new Date(t * 1000), wd = d.getUTCDay(), h = d.getUTCHours(); return !(wd === 6 || (wd === 0 && h < 23) || (wd === 5 && h >= 21)); };
const ptr = Object.fromEntries(Object.keys(TF).map((id) => [id, 0]));
// the Trader's view of one timeframe at time t: last 719 closed candles plus the forming one built from M1 (1m: 720 closed)
function view(id, t, i1) {
  const sec = SEC[id];
  if (id === '1m') { const bars = []; for (let j = Math.max(0, i1 - WIN); j < i1; j++) bars.push(bar1(j)); return bars; }
  const arr = TF[id]; let p = ptr[id];
  while (p < arr.length && arr[p].time + sec <= t) p++;
  ptr[id] = p;
  const bars = arr.slice(Math.max(0, p - (WIN - 1)), p);
  if (id !== '1m' && id !== '1d') {
    const f0 = Math.floor(t / sec) * sec; let f = null;
    for (let j = i1 - 1; j >= 0 && Tm[j] >= f0; j--) { const b = bar1(j); f = f ? { time: f0, open: b.open, high: Math.max(f.high, b.high), low: Math.min(f.low, b.low), close: f.close } : { time: f0, open: b.open, high: b.high, low: b.low, close: b.close }; }
    if (f) bars.push(f);
  }
  return bars;
}
// D1 trend for the day (closed daily candles before it, last 720), like the live Trader's OANDA label
const d1Cache = new Map();
function d1Trend(t) {
  const d = Math.floor((t + 7200) / 86400) * 86400 - 7200;
  if (d1Cache.has(d)) return d1Cache.get(d);
  const arr = TF['1d']; let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].time < d) lo = m + 1; else hi = m; }
  const w = arr.slice(Math.max(0, lo - 720), lo), v = w.length > 100 ? msAnalyze(w, 6).trend : null;
  d1Cache.set(d, v); return v;
}
// M15 ATR(14) series on closed candles, for the volatility-regime percentile (rank vs the previous 30 days of M15 candles)
const A15 = (() => { const B = TF['15m'], a = new Float64Array(B.length); let s = 0; const tr = (i) => i ? Math.max(B[i].high - B[i].low, Math.abs(B[i].high - B[i - 1].close), Math.abs(B[i].low - B[i - 1].close)) : B[i].high - B[i].low;
  const q = []; for (let i = 0; i < B.length; i++) { const v = tr(i); q.push(v); s += v; if (q.length > 14) s -= q.shift(); a[i] = s / q.length; } return a; })();
function atrPct(t) {
  const B = TF['15m']; let lo = 0, hi = B.length; while (lo < hi) { const m = (lo + hi) >> 1; if (B[m].time + 900 <= t) lo = m + 1; else hi = m; }
  const i = lo - 1; if (i < 200) return null; const cur = A15[i]; let below = 0, n = 0;
  for (let j = Math.max(0, i - 2880); j < i; j++) { n++; if (A15[j] < cur) below++; }
  return n ? below / n : null;
}

// ─── replay ───
const PR = PAIRS.find((p) => p.k === 'scalp');
const startT = Math.floor(Date.parse(FROM) / 1000 / STEP) * STEP, endT = Math.min(Date.parse(TO) / 1000, Tm[n1 - 1] + 60);
const seen = new Set(), open = [], done = [], lossLog = [];   // lossLog: [closeTime, side] of scalp losses, for the live re-entry rule
let i1 = 0, steps = 0, lastI1 = -1;
const t0w = Date.now();
function manage(tr, b) {
  const s = tr.side === 'sell';
  if (s ? b.high >= tr.stop : b.low <= tr.stop) { tr.R = -1; tr.closed = b.time; return true; }
  if (s ? b.low <= tr.t1 : b.high >= tr.t1) { tr.R = tr.rr; tr.closed = b.time; return true; }
  return false;
}
for (let t = startT; t <= endT; t += STEP) {
  while (i1 < n1 && Tm[i1] < t) {
    const b = bar1(i1++);
    for (let k = open.length - 1; k >= 0; k--) {
      const tr = open[k];
      if (tr.status === 'pending') {
        if (b.time < tr.opened) continue;
        const s = tr.side === 'sell';
        if (s ? b.high >= tr.entry : b.low <= tr.entry) { tr.status = 'open'; tr.filled = b.time; }
        else if (s ? b.low <= tr.t1 : b.high >= tr.t1) { tr.status = 'missed'; open.splice(k, 1); continue; }
        else { if (b.time - tr.opened > WAIT15) { tr.status = 'expired'; open.splice(k, 1); } continue; }
      }
      const s = tr.side === 'sell';
      tr.mfe = Math.max(tr.mfe, (s ? tr.entry - b.low : b.high - tr.entry) / tr.r0);
      if (manage(tr, b)) { tr.status = 'closed'; open.splice(k, 1); done.push(tr); if (tr.R < 0) lossLog.push([tr.closed, tr.side]); }
    }
  }
  if (i1 < WIN * 20 || !marketOpen(t) || i1 === lastI1) continue;   // need history; skip closed market and steps without a new candle
  lastI1 = i1;
  const b15 = view('15m', t, i1), b1 = view('1m', t, i1);
  if (b15.length < 60 || b1.length < 60) continue;
  steps++;
  if (steps % 50000 === 0) console.log(`${new Date(t * 1000).toISOString().slice(0, 10)} steps ${steps} trades ${done.length} ${((Date.now() - t0w) / 1000).toFixed(0)}s`);
  const A1 = msAnalyze(b1, 6);
  // speed-up, no effect on signals: a Scalp needs its confirming M1 break (A1.last) within FRESH M1 candles, so without one
  // the M15 analysis is skipped
  if (!A1.last || t - b1[A1.last.breakIdx].time > FRESH * 60) continue;
  const src = { '15m': { bars: b15, A: msAnalyze(b15, 6) }, '1m': { bars: b1, A: A1 } };
  const price = b1.at(-1).close;
  let st; try { st = buildSetup(PR, price, src); } catch (e) { st = null; }
  if (!st || st.state !== 'READY' || seen.has(st.sig)) continue;
  seen.add(st.sig);
  const side = st.sell ? 'sell' : 'buy';
  if (open.some((x) => x.side === side && Math.abs(x.t1 - st.t1) <= Math.abs(st.t1) * 1e-5)) continue;   // same idea still open
  const cfT = +String(st.sig).split('|')[2];
  if (!cfT || t - cfT > FRESH * 60) continue;
  // features at the signal (lazy: only now are the other timeframes analysed)
  for (const id of ['5m', '1h', '4h']) { const bars = view(id, t, i1); src[id] = { bars, A: msAnalyze(bars, 6) }; }
  const dir = st.sell ? -1 : 1, d1 = d1Trend(t), ll = src['1m'].A.last;
  const trendRel = (tr) => tr === dir ? 'with' : tr === -dir ? 'against' : 'none';
  const feat = {
    d1: d1 === dir ? 'with' : 'against',   // as the Trader labels it (no trend counts as against)
    h4: trendRel(src['4h'].A.trend), h1: trendRel(src['1h'].A.trend),
    struct: st.retr == null ? 'n/a' : st.retr >= 0.5 ? 'main' : 'internal', session: sessionOf(t),
    cf: ll && ll.dir === dir && ll.structure ? 'choch' : 'bo',
    choch: ['15m', '5m'].some((id) => src[id].A.events.some((e) => e.dir === dir && e.structure && t - src[id].bars[e.breakIdx].time <= FRESH * SEC[id])) ? 'yes' : 'no',
    m15c: m15cFeat(b15, st.sell, t), atrPct: atrPct(t),
    reentry: lossLog.some(([ct, sd]) => sd === side && t - ct <= 3 * 3600 && ct <= t) ? 'yes' : 'no',
  };
  const tr = { side, entry: st.entry, stop: st.stop, t1: st.t1, rr: st.rr, opened: t, status: 'pending', feat, mfe: 0, mode: 'limit' };
  if (st.sell ? price >= st.entry : price <= st.entry) {
    const r = Math.abs(price - st.stop), rw = (st.t1 - price) * (st.sell ? -1 : 1);
    if (!(r > 0) || (st.sell ? price >= st.stop : price <= st.stop) || rw <= 0) continue;
    tr.entry = price; tr.rr = rw / r; tr.status = 'open'; tr.filled = t; tr.mode = 'market';
  }
  tr.r0 = Math.abs(tr.entry - tr.stop);
  if (!(tr.r0 > 0)) continue;
  tr.cost = MK.spr / tr.r0;
  tr.minRR = tr.rr >= MIN_RR ? 'pass' : 'fail';   // the live Trader's global minimum reward:risk (judged at the price it fills)
  open.push(tr);
}
const rows = done.map((x) => [x.opened, x.filled, x.side, +x.rr.toFixed(3), +x.R.toFixed(3), +x.cost.toFixed(4), +x.mfe.toFixed(2), x.mode, x.minRR,
  x.feat.d1, x.feat.h4, x.feat.h1, x.feat.struct, x.feat.session, x.feat.cf, x.feat.choch, x.feat.m15c, x.feat.atrPct == null ? null : +x.feat.atrPct.toFixed(3), x.feat.reentry, x.closed]);
fs.mkdirSync(ODIR, { recursive: true });
fs.writeFileSync(path.join(ODIR, `${SYM}.json`), JSON.stringify({ sym: SYM, from: FROM, to: TO, spr: MK.spr, steps, open: open.length,
  cols: ['opened', 'filled', 'side', 'rr', 'R', 'cost', 'mfe', 'mode', 'minRR', 'd1', 'h4', 'h1', 'struct', 'session', 'cf', 'choch', 'm15c', 'atrPct', 'reentry', 'closed'], rows }));
console.log(`${SYM}: ${steps} steps, ${done.length} closed trades, ${open.length} open at end, ${((Date.now() - t0w) / 1000).toFixed(0)}s`);
