// ICT desk H1 iFVG model (ict/tracker.mjs signals() + ict/replay.mjs simulate(), unchanged) over multi-year HistData M1, with the
// Meridian context of every trade recorded: Meridian (council/engine.mjs msAnalyze, N = 6) H1 / H4 / D1 structure trend on the
// last 720 closed candles, and the Malaysian SnR direction (H4 working TF, Daily key levels; the live trader.mjs msnrDirection,
// copied verbatim below because trader.mjs is a script and does not export it, turned into a per-candle series).
// Same trade rules as ict/replay.mjs: grade >= 3, one open trade per market (an A-setup only blocked by an open A-setup), entry at the
// inversion close, stop 2 ticks past the sweep, trail from +2R 1.5R behind, BE at +1.5R on indices (not gold), 36 H1 candles max.
// R is per unit (no A-setup sizing); cost = MKT.ictCost (spread + 1 tick) / risk.
// Also writes every graded signal (before the one-at-a-time rule) with its iFVG zone and when an H1 body closed back through it, and
// the D1 candles, for the Meridian-side join (analyze.mjs).
// Usage: CONFL_RAW=<dir> node ict.mjs <xau|nas|eurusd> <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { msAnalyze } from '../../../council/engine.mjs';
import { signals, MIN_GRADE, isASetup } from '../../../ict/tracker.mjs';
import { simulate } from '../../../ict/replay.mjs';
import { MKT, loadM1, aggregate, daily } from './lib.mjs';

const [key, out = '.'] = process.argv.slice(2), M0 = MKT[key];
const ictKey = { xau: 'gc', nas: 'nq', eurusd: 'eurusd' }[key];
const M = { label: M0.label, short: key.toUpperCase(), dec: M0.dec + 1, tick: M0.tick, aRule: key === 'xau' ? 'gold' : undefined };

// ── trader.mjs msnrDirection, verbatim except that it returns the direction after every H4 candle ──
function msnrSeries(H4, D, n4 = 5, nD = 2) {
  const Z = [];
  const isPivH = (B, i, n) => { for (let k = i - n; k <= i + n; k++) if (k !== i && B[k].high >= B[i].high) return false; return true; };
  const isPivL = (B, i, n) => { for (let k = i - n; k <= i + n; k++) if (k !== i && B[k].low <= B[i].low) return false; return true; };
  const atr = (i) => { let s = 0, k = 0; for (let j = Math.max(0, i - 13); j <= i; j++) { s += D[j].high - D[j].low; k++; } return s / Math.max(1, k); };
  for (let i = nD; i < D.length - nD; i++) { const a = atr(i);
    if (isPivH(D, i, nD)) Z.push([D[i + nD].time + 86400, -1, D[i].high - 0.1 * a, D[i].high + 0.1 * a]);
    if (isPivL(D, i, nD)) Z.push([D[i + nD].time + 86400, 1, D[i].low - 0.1 * a, D[i].low + 0.1 * a]); }
  for (let i = 1; i < D.length; i++) { const p = D[i - 1], b = D[i], kn = b.time + 86400;
    if (p.close < p.open && b.close > b.open && b.close > p.open && b.open <= p.close) Z.push([kn, 1, Math.min(p.low, b.low), p.open]);
    if (p.close > p.open && b.close < b.open && b.close < p.open && b.open >= p.close) Z.push([kn, -1, p.open, Math.max(p.high, b.high)]);
    if (p.close > p.open && b.close > b.open && b.high > p.high && b.close > p.high) Z.push([kn, 1, Math.min(p.open, p.close), Math.max(p.open, p.close)]);
    if (p.close < p.open && b.close < b.open && b.low < p.low && b.close < p.low) Z.push([kn, -1, Math.min(p.open, p.close), Math.max(p.open, p.close)]); }
  Z.sort((a, b) => a[0] - b[0]);
  const A = [], V = [], lastTap = { 1: null, '-1': null }; let d = 0, zi = 0; const ser = new Array(H4.length);
  for (let i = 0; i < H4.length; i++) {
    const b = H4[i], j = i - n4;
    if (j >= n4) { if (isPivH(H4, j, n4)) A.push([b.time, H4[j].high, j]); if (isPivL(H4, j, n4)) V.push([b.time, H4[j].low, j]); }
    while (zi < Z.length && Z[zi][0] <= b.time) zi++;
    for (let q = Math.max(0, zi - 400); q < zi; q++) { const z = Z[q]; if (b.time - z[0] > 90 * 86400) continue; if (b.low <= z[3] && b.high >= z[2]) lastTap[z[1]] = i; }
    if (d <= 0 && A.length) { const [, px, pj] = A[A.length - 1]; if (b.close > px) { const tap = lastTap[1]; if (tap != null && pj < tap && tap <= i) d = 1; } }
    else if (d >= 0 && V.length) { const [, px, pj] = V[V.length - 1]; if (b.close < px) { const tap = lastTap['-1']; if (tap != null && pj < tap && tap <= i) d = -1; } }
    if (d === 0 && A.length && V.length) { if (b.close > A[A.length - 1][1]) d = 1; else if (b.close < V[V.length - 1][1]) d = -1; }
    ser[i] = d;
  }
  return ser;
}

const t0 = Date.now();
const m1 = loadM1(key, 2018, 2026);
const H = aggregate(m1, 3600), H4 = aggregate(m1, 14400), D = daily(m1), m5 = aggregate(m1, 300);
const days = new Map(); for (const b of m5) { const d = Math.floor(b.time / 86400); days.set(d, (days.get(d) || 0) + 1); }
const src = { H, m5, m5days: new Set([...days.entries()].filter(([, n]) => n >= 200).map(([d]) => d)) };
// D1 for msnr: only candles closed before the H4 candle is judged (the trader passes closed D1); Z uses each level's known time
const msnr = msnrSeries(H4, D);
const lastClosed = (B, sec, t) => { let lo = 0, hi = B.length - 1, r = -1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (B[mid].time + sec <= t) { r = mid; lo = mid + 1; } else hi = mid - 1; } return r; };
const trendAt = (B, sec, t) => { const i = lastClosed(B, sec, t); if (i < 60) return 0; return msAnalyze(B.slice(Math.max(0, i - 719), i + 1), 6).trend; };
const ctx = (side, t) => {
  const i4 = lastClosed(H4, 14400, t), ms = i4 >= 0 ? msnr[i4] : 0, rel = (v) => v === 0 ? 'none' : v === side ? 'with' : 'against';
  return { mH1: rel(trendAt(H, 3600, t)), mH4: rel(trendAt(H4, 14400, t)), mD1: rel(trendAt(D, 86400, t)), msnr: rel(ms) };
};

const sig = signals(H, D, 1, M.tick).concat(signals(H, D, -1, M.tick)).filter((g) => g.grade.total >= MIN_GRADE).sort((a, b) => a.close - b.close);
// every graded signal for the Meridian join: iFVG zone, and when an H1 body closed back through its far side (zone dead)
const zones = sig.map((g) => {
  const lo = g.fvg[0], hi = g.fvg[1]; let dead = null;
  for (let i = lastClosed(H, 3600, g.close) + 1; i < H.length && H[i].time < g.close + 7 * 86400; i++) { const c = H[i].close; if (g.side > 0 ? c < lo : c > hi) { dead = H[i].time + 3600; break; } }
  return [g.close, g.side, +lo.toPrecision(8), +hi.toPrecision(8), dead, g.feat.pd, g.feat.zone, g.grade.total];
});
const trades = [];
let busyAll = 0, busyA = 0, gaps = 0;
for (const g of sig) {
  const a = isASetup(g, ictKey); if (g.close < (a ? busyA : busyAll)) continue;
  const tr = simulate(g, M, key, src, m1.at(-1).time); if (!tr) { gaps++; continue; }
  if (tr.closed == null) continue;
  const end = tr.closed; busyAll = Math.max(busyAll, end); if (a) busyA = end;
  const s = g.side, c = ctx(s, g.close);
  trades.push({ t: g.close, side: s, entry: tr.entry, r0: tr.r0, R: tr.R, R2: tr.R2, cost: +(M0.ictCost / tr.r0).toFixed(4), aset: a, grade: g.grade.total,
    bias: g.feat.bias, pd: g.feat.pd, zone: g.feat.zone, session: g.feat.session, atrR: g.feat.atrR, ...c });
}
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, `ict_${key}.json`), JSON.stringify({ key, trades, zones, gaps, D1: D.map((b) => [b.time, b.high, b.low, b.close]) }));
console.log(key, 'signals', sig.length, 'trades', trades.length, 'gaps', gaps, 'secs', ((Date.now() - t0) / 1000).toFixed(0));
