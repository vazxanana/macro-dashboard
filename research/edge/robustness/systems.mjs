// Robustness audit of the council's live paper systems (research/edge/robustness). Paper research only; nothing live changes.
// Each system is re-implemented from council/trader.mjs (the live code; trader.mjs is a script, not a module, so its rules are
// copied here line for line and cited) and replayed on HistData 1m 2018/19 - Oct 2026 (spot gold, Nasdaq-100 cash) and
// Binance daily (crypto). For each: per-year, IS 2018-23 / OOS 2024-26 (preamble split) and the council's own split
// (2019-22 | 2023-24 | 2025-26), sign flip, random entries with the same exit geometry and exposure, +-20% parameters.
// Usage: ROB_DATA=<dir> node systems.mjs [system ...]  → writes out/<system>.json
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { loadM1, aggregate, simTrade, stats, rng, yearOf, nyParts, DATA, deflatedSharpe } from './lib.mjs';
import { msAnalyze } from '../../../council/engine.mjs';

const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), 'out'); fs.mkdirSync(OUT, { recursive: true });
const GOLD_COST = 0.30;   // all-in round trip, gold price units (research log: 0.30; 0.42 in the cBot test)
const NQ_COST = 1.0;      // cash Nasdaq points round trip (log: 1 pt cash / 0.5 pt futures)
const CRYPTO_COST = 0.008; // 0.8% round trip (Kraken taker 0.4% a side, as the council's crypto research)

// ── helpers ──
const idxAt = (A, t) => { let lo = 0, hi = A.n; while (lo < hi) { const m = (lo + hi) >> 1; if (A.t[m] < t) lo = m + 1; else hi = m; } return lo; };
const tr = (D, i) => Math.max(D[i].high - D[i].low, Math.abs(D[i].high - D[i - 1].close), Math.abs(D[i].low - D[i - 1].close));
const atrN = (D, i, n) => { let a = 0; for (let j = i - n + 1; j <= i; j++) a += tr(D, j); return a / n; };
function summarize(trades) {
  const R = trades.map((x) => x.R), sp = (f) => stats(trades.filter(f).map((x) => x.R));
  const yrs = {}; for (const x of trades) (yrs[yearOf(x.t)] = yrs[yearOf(x.t)] || []).push(x.R);
  return { all: stats(R), is: sp((x) => yearOf(x.t) <= 2023), oos: sp((x) => yearOf(x.t) >= 2024),
    w1922: sp((x) => yearOf(x.t) >= 2019 && yearOf(x.t) <= 2022), w2324: sp((x) => yearOf(x.t) >= 2023 && yearOf(x.t) <= 2024), w2526: sp((x) => yearOf(x.t) >= 2025),
    years: Object.fromEntries(Object.entries(yrs).map(([y, a]) => [y, stats(a)])), gross: stats(trades.map((x) => x.gross ?? x.R)) };
}

// ════════ Gold trend (trader.mjs 616-648): daily close > prior N highs → long next open; stop k·ATR14; ratchet close − k·ATR14 each
// closed day; one add at +1R (close) at the next open with the same stop; long only. flip: mirrored short on the N-day low.
function goldTrend(D, p) {
  const out = []; const N = p.n, k = p.k, d = p.flip ? -1 : 1;
  let i = Math.max(N + 15, 20);
  const entryDays = p.randomDays;   // random benchmark: entries on these day indices instead of breakouts
  while (i < D.length - 1) {
    const hi = Math.max(...D.slice(i - N, i).map((b) => b.high)), lo = Math.min(...D.slice(i - N, i).map((b) => b.low));
    const sig = entryDays ? entryDays.has(i) : (d > 0 ? D[i].close > hi : D[i].close < lo);
    if (!sig) { i++; continue; }
    const A = atrN(D, i, 14), e = D[i + 1].open; let stop = e - d * k * A; const r0 = k * A; let add = null, exitPx = null, j = i + 1;
    for (; j < D.length; j++) {
      const b = D[j];
      if (d > 0 ? b.low <= stop : b.high >= stop) { exitPx = d > 0 ? Math.min(b.open, stop) : Math.max(b.open, stop); break; }
      if (add && add.pending) { add.e = b.open; add.r0 = Math.abs(add.e - stop); add.pending = false; }
      const ns = b.close - d * k * atrN(D, j, 14); if ((ns - stop) * d > 0) stop = ns;
      if (p.add && !add && d * (b.close - e) >= p.add * r0 && j + 1 < D.length) add = { pending: true };
    }
    if (exitPx == null) { exitPx = D[D.length - 1].close; j = D.length - 1; }
    const gross = d * (exitPx - e) / r0; let R = gross - GOLD_COST / r0;
    if (add && !add.pending && add.r0 > 0) R += d * (exitPx - add.e) / add.r0 - GOLD_COST / add.r0;
    out.push({ t: D[i].time, R, gross, side: d, days: j - i });
    i = entryDays ? i + 1 : j + 1;   // one position at a time (random: overlapping allowed, each draw independent)
  }
  return out;
}

// ════════ Gold daily engulf (trader.mjs 678-704): green D1 closes above the HIGH of the most recent red candle within k (greens in
// between allowed), close > SMA20 → limit buy at base high for `life` days (cancelled by a daily close under base low), stop base
// low − 0.3, trail 1R after +2R (cap 10R), out `hold` h after fill, at most 3 open/pending.
function goldEngulf(A, D, p) {
  const out = []; const active = []; const d = p.flip ? -1 : 1;
  for (let i = Math.max(p.sma, p.k, 16) + 2; i < D.length - 1; i++) {
    const L = D[i];
    for (let q = active.length - 1; q >= 0; q--) if (active[q] <= L.time) active.splice(q, 1);
    const sma = D.slice(i - p.sma + 1, i + 1).reduce((a, b) => a + b.close, 0) / p.sma;
    let base = null;
    const A14 = atrN(D, i, 14);
    if (p.randomDays) { if (p.randomDays.has(i)) { const [g1, g2] = p.geo(); const hi = L.close - g1 * A14; base = { high: hi, low: hi - g2 * A14 + p.pad, time: L.time }; } }
    else if (d > 0 ? (L.close > L.open && (p.noSma || L.close > sma)) : (L.close < L.open && (p.noSma || L.close < sma))) {
      for (let j = i - 1; j >= i - p.k && j >= 0; j--) { const b = D[j];
        if (d > 0 ? b.open > b.close : b.close > b.open) { if (d > 0 ? L.close > b.high : L.close < b.low) base = b; break; } }
    }
    if (!base || active.length >= p.maxOpen) continue;
    const entry = d > 0 ? base.high : base.low, stop = d > 0 ? base.low - p.pad : base.high + p.pad, r0 = Math.abs(entry - stop); if (!(r0 > 0)) continue;
    // pending from the next day: fill on M1 when price trades back to the entry; cancel on a daily close through the far side
    let fillI = -1, endT = D[i].time;
    for (let j = i + 1; j < D.length && j <= i + p.life; j++) {
      const b = D[j];
      for (let m = b.i0; m <= b.i1; m++) if (d > 0 ? A.l[m] <= entry : A.h[m] >= entry) { fillI = m; break; }
      if (fillI >= 0) break;
      endT = b.time + 86400;
      if (d > 0 ? b.close < base.low : b.close > base.high) break;
    }
    if (fillI < 0) { active.push(endT); continue; }
    const px = d > 0 ? Math.min(A.o[fillI], entry) : Math.max(A.o[fillI], entry);
    const r = simTrade(A, { side: d, i: fillI, px, r0: Math.abs(px - stop), stopPx: stop, cost: GOLD_COST, tgt: null, trail: [2, 1], cap: 10, exitAt: A.t[fillI] + p.hold * 3600 });
    active.push(A.t[Math.min(r.exitI, A.n - 1)]);
    out.push({ t: A.t[fillI], R: r.R, gross: r.gross, side: d, g1: (L.close - base.high) / A14, g2: (base.high - base.low + p.pad) / A14 });
  }
  return out;
}

// ════════ msnrDirection (trader.mjs 1602-1627), copied verbatim
function msnrDirection(H4, D, n4 = 5, nD = 2) {
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
  const Ah = [], V = [], lastTap = { 1: null, '-1': null }; let d = 0, zi = 0;
  for (let i = 0; i < H4.length; i++) {
    const b = H4[i], j = i - n4;
    if (j >= n4) { if (isPivH(H4, j, n4)) Ah.push([b.time, H4[j].high, j]); if (isPivL(H4, j, n4)) V.push([b.time, H4[j].low, j]); }
    while (zi < Z.length && Z[zi][0] <= b.time) zi++;
    for (let q = Math.max(0, zi - 400); q < zi; q++) { const z = Z[q]; if (b.time - z[0] > 90 * 86400) continue; if (b.low <= z[3] && b.high >= z[2]) lastTap[z[1]] = i; }
    if (d <= 0 && Ah.length) { const [, px, pj] = Ah[Ah.length - 1]; if (b.close > px) { const tap = lastTap[1]; if (tap != null && pj < tap && tap <= i) d = 1; } }
    else if (d >= 0 && V.length) { const [, px, pj] = V[V.length - 1]; if (b.close < px) { const tap = lastTap['-1']; if (tap != null && pj < tap && tap <= i) d = -1; } }
    if (d === 0 && Ah.length && V.length) { if (b.close > Ah[Ah.length - 1][1]) d = 1; else if (b.close < V[V.length - 1][1]) d = -1; }
  }
  return d;
}

// ════════ Gold H4 trendline (trader.mjs 651-677): falling line through the last two confirmed H4 pivot highs (half-width n, second
// lower, ≤ span bars apart); a closed H4 above it while msnrDirection(H4, D, n4, 2) = up → buy next H4 open; stop under the lowest
// low since the 2nd anchor − pad; trail 1R after +2R (cap 10R); out after `hold` h; one trade per line, one position.
function goldTrendline(A, H, D, p) {
  const out = []; const traded = new Set(); let busyUntil = 0; const piv = []; let pivUpTo = p.n;
  for (let n1 = p.n * 2 + 2; n1 < H.length - 1; n1++) {
    // pivots confirmed with bars < n1 (live: i < n - TL.n with n = n1)
    for (; pivUpTo < n1 - p.n; pivUpTo++) { const i = pivUpTo; let ok = true; for (let k = i - p.n; k <= i + p.n && ok; k++) if (k !== i && H[k].high >= H[i].high) ok = false; if (ok) piv.push([i, H[i].high]); }
    const last = H[n1 - 1];
    if (H[n1].time < busyUntil || piv.length < 2) continue;
    let sig = false, a, pa, b, pb, lv;
    if (p.randomBars) sig = p.randomBars.has(n1);
    else { [a, pa] = piv[piv.length - 2]; [b, pb] = piv[piv.length - 1];
      if (!(pb < pa && b - a <= p.span && n1 - 1 > b + p.n)) continue;
      lv = pa + (pb - pa) / (b - a) * (n1 - 1 - a); const id = `${a}-${b}`;
      if (traded.has(id) || !(last.close > lv)) continue;
      traded.add(id);   // live marks the line traded only when a trade is pushed; direction-blocked lines can retry → handled below
      const Dc = D.filter((x) => x.time + 86400 <= H[n1].time).slice(-600), dir = p.noDir ? 1 : msnrDirection(H.slice(Math.max(0, n1 - 1200), n1), Dc, p.n4, 2);
      if (dir !== 1) { traded.delete(id); continue; }
      sig = true; }
    if (!sig) continue;
    const d = p.flip ? -1 : 1, i = H[n1].i0; const e = A.o[i];
    let stop;
    if (p.randomBars) { const lb = H.slice(Math.max(0, n1 - 1 - p.rLook()), n1); stop = d > 0 ? Math.min(...lb.map((x) => x.low)) - p.pad : Math.max(...lb.map((x) => x.high)) + p.pad; }
    else { const seg = H.slice(b, n1); stop = d > 0 ? Math.min(...seg.map((x) => x.low)) - p.pad : 2 * e - (Math.min(...seg.map((x) => x.low)) - p.pad); }
    const r0 = Math.abs(e - stop); if (!(r0 > 0) || (e - stop) * d <= 0) continue;
    const r = simTrade(A, { side: d, i, r0, stopPx: stop, cost: GOLD_COST, tgt: null, trail: [2, 1], cap: 10, exitAt: A.t[i] + p.hold * 3600 });
    busyUntil = A.t[Math.min(r.exitI, A.n - 1)];
    out.push({ t: A.t[i], R: r.R, gross: r.gross, side: d, r0 });
  }
  return out;
}

// ════════ NQ New York open run (trader.mjs 1628-1644 nqOpenSweep + 1700-1726): O = 09:30 open; within 90 min a 1m candle runs
// ≥ minPen·O through O and within 15 min closes back across it in the reversal colour = the sweep; trade WITH the run (opposite of
// the reclaim), entry the reclaim close, stop at the same distance (|entry − (extreme ∓ 2)|) on the other side; midnight-open filter
// (00:00 ET open ahead of the trade); after +2R trail 1R (cap 10R); out 11:00 ET.
function nqDays(A) { const days = new Map(); for (let i = 0; i < A.n; i++) { const p = nyParts(A.t[i]); if (p.wd === 'Sat' || p.wd === 'Sun') continue; if (!days.has(p.d)) days.set(p.d, []); const a = days.get(p.d); if (p.m === 0 || (p.m >= 570 && p.m <= 662)) a.push([i, p.m]); } return days; }
function nqRun(A, days, p) {
  const out = [];
  for (const [d, rows] of days) {
    const first = rows.find((r) => r[1] === 570); if (!first) continue;
    const O = A.o[first[0]], minPen = p.minPen * O, live = new Map(); let g = null;
    if (p.randomMin) { const rm = p.randomMin(); const r = rows.find((x) => x[1] === rm); if (!r) continue; const side = p.rnd() < 0.5 ? 1 : -1, r0 = p.rR0(O);
      g = { sell: side < 0, entry: A.c[r[0]], stop: side < 0 ? A.c[r[0]] + r0 : A.c[r[0]] - r0, i: r[0], m: r[1] }; }
    else for (const [i, m] of rows) {
      if (!(m > 570 && m < 660)) continue;
      if (!live.has('L') && A.l[i] < O) live.set('L', { t: A.t[i], ext: A.l[i] });
      if (!live.has('H') && A.h[i] > O) live.set('H', { t: A.t[i], ext: A.h[i] });
      for (const [k, v] of live) {
        v.ext = k === 'L' ? Math.min(v.ext, A.l[i]) : Math.max(v.ext, A.h[i]);
        if (A.t[i] - v.t > p.win * 60 || Math.abs(v.ext - O) < minPen) continue;
        if (k === 'L' && A.c[i] > O && A.c[i] > A.o[i]) { g = { sell: false, ext: v.ext, stop: v.ext - 2, entry: A.c[i], i, m }; break; }
        if (k === 'H' && A.c[i] < O && A.c[i] < A.o[i]) { g = { sell: true, ext: v.ext, stop: v.ext + 2, entry: A.c[i], i, m }; break; }
      }
      if (g) break;
    }
    if (!g) continue;
    let sell = !g.sell; if (p.randomMin) sell = g.sell; const sell0 = sell; if (p.flip) sell = !sell;   // live trades WITH the run (opposite of the reclaim); flip mirrors the same trades
    const r0 = Math.abs(g.entry - g.stop); if (!(r0 > 0)) continue;
    const ndo = rows.find((r) => r[1] === 0);
    if (p.ndo && !p.randomMin) { if (!ndo) continue; const ahead = (A.o[ndo[0]] - g.entry) * (sell0 ? -1 : 1) > 0; if (p.ndo === 'ahead' ? !ahead : ahead) continue; }
    const r = simTrade(A, { side: sell ? -1 : 1, i: g.i + 1, px: g.entry, r0, cost: NQ_COST, tgt: p.runner ? null : 2, trail: p.runner ? [2, 1] : null, cap: 10, exitAt: A.t[g.i] + (660 - g.m) * 60 });
    out.push({ t: A.t[g.i], R: r.R, gross: r.gross, side: sell ? -1 : 1, r0, O, m: g.m });
  }
  return out;
}

// ════════ Crypto trend v3 (trader.mjs 549-612): per coin two slots (55-day breakout, 100-day breakout), long; entry next open after a
// close above the prior N highs; 5·ATR20 catastrophe stop (fixed); exit at a daily close under the ratcheting midpoint of the
// N-day channel; one add at +1R (daily close) at the next open with its own 5·ATR stop, out with the first.
function cryptoTrend(D, p) {
  const out = []; const d = p.flip ? -1 : 1;
  for (const N of p.slots) {
    let i = N + 21;
    while (i < D.length - 1) {
      const hi = Math.max(...D.slice(i - N, i).map((b) => b.high)), lo = Math.min(...D.slice(i - N, i).map((b) => b.low));
      const sig = p.randomDays ? p.randomDays.has(i * 1000 + N) : (d > 0 ? D[i].close > hi : D[i].close < lo);
      if (!sig) { i++; continue; }
      const A20 = atrN(D, i, 20), e = D[i + 1].open, r0 = p.k * A20, stop = e - d * r0; let mid = -Infinity * d, add = null, exitPx = null, j = i + 1;
      for (; j < D.length; j++) {
        const b = D[j];
        if (d > 0 ? b.low <= stop : b.high >= stop) { exitPx = d > 0 ? Math.min(b.open, stop) : Math.max(b.open, stop); break; }
        if (add && add.pending) { add.e = b.open; add.stop = add.e - d * r0; add.pending = false; }
        if (add && !add.pending && !add.out && (d > 0 ? b.low <= add.stop : b.high >= add.stop)) { add.out = true; add.R = -1 - CRYPTO_COST * add.e / r0; }
        if (j >= N) { const m = (Math.max(...D.slice(j - N, j).map((x) => x.high)) + Math.min(...D.slice(j - N, j).map((x) => x.low))) / 2; mid = d > 0 ? Math.max(mid, m) : Math.min(mid, m); }
        if (d > 0 ? b.close < mid : b.close > mid) { exitPx = b.close; break; }
        if (p.add && !add && d * (b.close - e) >= p.add * r0 && j + 1 < D.length) add = { pending: true };
      }
      if (exitPx == null) { exitPx = D[D.length - 1].close; j = D.length - 1; }
      const gross = d * (exitPx - e) / r0; let R = gross - CRYPTO_COST * e / r0;
      if (add && !add.pending) R += add.out ? add.R : d * (exitPx - add.e) / r0 - CRYPTO_COST * add.e / r0;
      out.push({ t: D[i].time, R, gross, side: d, coin: p.coin, slot: N });
      i = p.randomDays ? i + 1 : j + 1;
    }
  }
  return out;
}

// ════════ Gold momentum pullback (trader.mjs 705-735; TEST / shadow): H1 range ≥ mult·avg(14) closing in the top/bottom (1−top),
// with the 20-day SMA direction, 07-17 UTC; first M5 within `wait` h that trades into the z1-z2 pullback and closes in the trade
// direction → market at the next M5 open; stop 0.1 beyond the H1 candle; trail 1R after +k R (cap 10R); out after 8 h.
function goldMP(A, H, M5, D, p) {
  const out = []; let busy = 0; let di = 0;
  for (let n = 16; n < H.length; n++) {
    const b = H[n - 1], tc = b.time + 3600; if (tc < busy) continue;
    while (di < D.length && D[di].time + 86400 <= tc) di++;
    if (di < 21) continue;
    const sma = D.slice(di - 20, di).reduce((a, x) => a + x.close, 0) / 20, dDir = D[di - 1].close > sma ? 1 : -1;
    const rg = b.high - b.low, avg = H.slice(n - 15, n - 1).reduce((a, x) => a + (x.high - x.low), 0) / 14, hr = new Date(tc * 1000).getUTCHours();
    let dd = 0;
    if (p.random) { if (hr >= 7 && hr < 17 && p.rnd() < p.random) dd = p.rnd() < 0.5 ? 1 : -1; else continue; }
    else { if (!(rg >= p.mult * avg && hr >= 7 && hr < 17)) continue;
      const up = b.close > b.open && b.close - b.low >= p.top * rg, dn = b.close < b.open && b.high - b.close >= p.top * rg; dd = up ? 1 : dn ? -1 : 0;
      if (!dd || dd !== dDir) continue; }
    const w = dd > 0 ? { zhi: b.high - p.z1 * rg, zlo: b.high - p.z2 * rg, stop: b.low - 0.1 } : { zlo: b.low + p.z1 * rg, zhi: b.low + p.z2 * rg, stop: b.high + 0.1 };
    const until = tc + p.wait * 3600; let k0 = M5.findIndex((c) => c.time >= tc); if (k0 < 0) continue;
    for (let k = k0; k < M5.length; k++) { const c = M5[k]; if (c.time + 300 > until) break;
      if (dd > 0 ? c.low <= w.stop : c.high >= w.stop) break;
      const ok = dd > 0 ? (c.low <= w.zhi && c.close > c.open && c.close >= w.zlo) : (c.high >= w.zlo && c.close < c.open && c.close <= w.zhi);
      if (!ok) continue;
      const i = c.i1 + 1; if (i >= A.n) break; const side = p.flip ? -dd : dd, e = A.o[i];
      const stop = p.flip ? e + (e - w.stop) : w.stop, r0 = Math.abs(e - stop); if (!(r0 > 0.5) || (e - stop) * side <= 0) break;
      const r = simTrade(A, { side, i, r0, stopPx: stop, cost: p.cost ?? 0.15, tgt: null, trail: [p.k, 1], cap: 10, exitAt: A.t[i] + 8 * 3600 });
      out.push({ t: A.t[i], R: r.R, gross: r.gross, side }); busy = A.t[Math.min(r.exitI, A.n - 1)]; break; }
  }
  return out;
}

// ════════ Mosha BO (trader.mjs 736-786): H4 BO dir d, then H1 BO −d after it, then M15 BO d; weekly structure (msAnalyze swing 3,
// Monday weeks) agrees; H1 pull ≥ moshaSlow bars (else shadow); limit at the broken M15 level, valid 24 h, stop past the M15 origin
// ± 0.3, BE + add at +1.5R, trail 1R after +3R (cap 10R), out after 72 h; at most 2 open. Events: msAnalyze on a rolling window of
// the last W closed candles at each M15 close (causal, like the live run). Expensive: events cached per timeframe.
function causalEvents(B, sec, W = 720, step = 1) {
  // re-run msAnalyze each `step` bars on the last W bars; keep events the first time they appear (time of the break bar close)
  const seen = new Map();
  for (let n = W; n <= B.length; n += step) {
    const win = B.slice(n - W, n), A = msAnalyze(win, 6);
    for (const e of A.events) { if (e.breakIdx >= win.length - 1 + 1) continue; const t = win[e.breakIdx].time + sec; const key = `${t}|${e.dir}`;
      if (!seen.has(key) && t <= B[n - 1].time + sec) seen.set(key, { t, dir: e.dir, level: e.level, top: e.top, bot: e.bot, flip: e.structure, seenAt: B[n - 1].time + sec }); }
  }
  return [...seen.values()].sort((a, b) => a.seenAt - b.seenAt || a.t - b.t);
}
function moshaBO(A, E1, E2, E3, wk, H1, p) {
  const wEv = msAnalyze(wk, 3).events.map((e) => ({ t: wk[e.breakIdx].time + 604800, dir: e.dir }));
  const before = (E, t) => { let r = null; for (const e of E) { if (e.seenAt <= t) r = e; else break; } return r; };
  const w1At = (t) => { let r = 0; for (const e of wEv) { if (e.t <= t) r = e.dir; else break; } return r; };
  const out = []; const openEnds = [];
  for (const e3 of E3) {
    const t = e3.seenAt; const e2 = before(E2, t), e1 = before(E1, t); let d = e3.dir;
    if (!p.noChain && !(e1 && e2 && e1.dir === d && e2.dir === -d && e2.t > e1.t)) continue;
    if (p.keep && !p.keep()) continue;
    if (p.weekly && w1At(t) !== d) continue;
    if (p.slow && e2) { const i2 = H1.findIndex((b) => b.time >= e2.t); if (i2 >= 0) { let ext = d < 0 ? Infinity : -Infinity, iE = i2;
      for (let i = i2; i < H1.length && H1[i].time < e3.t; i++) if (d < 0 ? H1[i].low < ext : H1[i].high > ext) { ext = d < 0 ? H1[i].low : H1[i].high; iE = i; }
      const pull = H1.filter((b) => b.time > H1[iE].time && b.time < e3.t).length; if (pull < p.slow) continue; } }
    for (let q = openEnds.length - 1; q >= 0; q--) if (openEnds[q] <= t) openEnds.splice(q, 1);
    if (openEnds.length >= 2) continue;
    let entry = e3.level, stop = d < 0 ? e3.top + 0.3 : e3.bot - 0.3; const r0 = Math.abs(entry - stop); if (!(r0 > 0.5)) continue;
    const i0 = idxAt(A, t); if (i0 >= A.n) continue; const price = A.o[i0];
    if (!(d < 0 ? price < stop : price > stop)) continue;
    if (p.flip) { d = -d; stop = entry - d * r0; }
    // limit fill within 24 h (flip: same price level, opposite side, so it fills as a stop-entry would not — keep it a limit at the level)
    let fi = -1; for (let i = i0; i < A.n && A.t[i] < t + 86400; i++) { if (p.flip ? (d > 0 ? A.h[i] >= entry : A.l[i] <= entry) : (d > 0 ? A.l[i] <= entry : A.h[i] >= entry)) { fi = i; break; }
      if (!p.flip && (d > 0 ? A.h[i] >= entry + 3 * r0 : A.l[i] <= entry - 3 * r0)) break; }
    if (fi < 0) continue;
    const r = simTrade(A, { side: d, i: fi, px: entry, r0, stopPx: stop, cost: GOLD_COST, tgt: p.run ? null : 3, be: p.be, add: p.add ? { atR: p.add, size: 1 } : null, trail: p.run ? [3, 1] : null, cap: 10, exitAt: A.t[fi] + 72 * 3600 });
    openEnds.push(A.t[Math.min(r.exitI, A.n - 1)]);
    out.push({ t: A.t[fi], R: r.R, gross: r.gross, side: d });
  }
  return out;
}

// ── random benchmark runner: `make(seed)` returns trades; report mean / 5th / 95th pct of exp per trade over S seeds
function bench(make, S) { const E = [], T = []; for (let s = 1; s <= S; s++) { const tr = make(s); const st = stats(tr.map((x) => x.R)); E.push(st.exp ?? 0); T.push(st.R); }
  E.sort((a, b) => a - b); T.sort((a, b) => a - b); const q = (a, f) => a[Math.min(a.length - 1, Math.floor(f * a.length))];
  return { seeds: S, expMean: +(E.reduce((a, b) => a + b, 0) / S).toFixed(3), exp5: +q(E, 0.05).toFixed(3), exp95: +q(E, 0.95).toFixed(3), RMean: +(T.reduce((a, b) => a + b, 0) / S).toFixed(1) }; }

// ════════ main
const want = new Set(process.argv.slice(2));
const run = (k) => !want.size || want.has(k);
const save = (k, o) => { fs.writeFileSync(path.join(OUT, k + '.json'), JSON.stringify(o, null, 1)); console.log('wrote', k); };
const brief = (s) => `n${s.all.n} exp${s.all.exp} R${s.all.R} | IS(≤2023) ${s.is.exp} n${s.is.n} | OOS(2024+) ${s.oos.exp} n${s.oos.n} t${s.oos.t} | 19-22 ${s.w1922.exp} 23-24 ${s.w2324.exp} 25-26 ${s.w2526.exp}`;

let GA = null, GD = null;
const gold = () => { if (!GA) { GA = loadM1('xau-histdata'); GD = aggregate(GA, 86400, 'ny17'); } return [GA, GD]; };

if (run('gtrend')) {
  const [, D] = gold(); const res = {};
  for (const [name, base] of [['gtrend20', { n: 20, k: 2, add: 1 }], ['gtrend5', { n: 5, k: 2, add: 1 }]]) {
    const r = { live: summarize(goldTrend(D, base)), noAdd: summarize(goldTrend(D, { ...base, add: 0 })), flip: summarize(goldTrend(D, { ...base, flip: true })) };
    r.sens = {}; for (const [kk, f] of [['n', 0.8], ['n', 1.2], ['k', 0.8], ['k', 1.2]]) { const q = { ...base, [kk]: kk === 'n' ? Math.max(2, Math.round(base.n * f)) : +(base.k * f).toFixed(2) }; r.sens[`${kk}=${q[kk]}`] = summarize(goldTrend(D, q)); }
    const nTr = r.live.all.n, cand = []; for (let i = 40; i < D.length - 1; i++) cand.push(i);
    r.randomLong = bench((s) => { const g = rng(s * 7 + 1), set = new Set(); while (set.size < nTr) set.add(cand[Math.floor(g() * cand.length)]); return goldTrend(D, { ...base, randomDays: set }); }, 200);
    r.randomShort = bench((s) => { const g = rng(s * 7 + 3), set = new Set(); while (set.size < nTr) set.add(cand[Math.floor(g() * cand.length)]); return goldTrend(D, { ...base, randomDays: set, flip: true }); }, 100);
    // per-period random-long benchmark matched to each window (drift differs a lot by period)
    r.randomLongWin = {}; for (const [w, y0, y1] of [['19-22', 2019, 2022], ['23-24', 2023, 2024], ['25-26', 2025, 2026], ['IS', 2018, 2023], ['OOS', 2024, 2026]]) {
      const cw = cand.filter((i) => { const y = yearOf(D[i].time); return y >= y0 && y <= y1; }), nw = goldTrend(D, base).filter((x) => { const y = yearOf(x.t); return y >= y0 && y <= y1; }).length;
      r.randomLongWin[w] = { n: nw, ...bench((s) => { const g = rng(s * 11 + 5), set = new Set(); while (set.size < Math.min(nw, cw.length)) set.add(cw[Math.floor(g() * cw.length)]); return goldTrend(D, { ...base, randomDays: set }).filter((x) => { const y = yearOf(x.t); return y >= y0 && y <= y1; }); }, 200) }; }
    r.dsr = deflatedSharpe(goldTrend(D, base).map((x) => x.R), 1);
    res[name] = r; console.log(name, 'live', brief(r.live)); console.log(name, 'flip', brief(r.flip)); console.log(name, 'noAdd', brief(r.noAdd)); console.log(name, 'rndLong', JSON.stringify(r.randomLong), 'rndShort', JSON.stringify(r.randomShort));
    for (const [k, v] of Object.entries(r.sens)) console.log(name, k, brief(v)); console.log(name, 'rndWin', JSON.stringify(r.randomLongWin));
  }
  res.trades = { gtrend20: goldTrend(D, { n: 20, k: 2, add: 1 }), gtrend5: goldTrend(D, { n: 5, k: 2, add: 1 }) };
  save('gtrend', res);
}

if (run('geg')) {
  const [A, D] = gold(); const base = { k: 3, life: 20, hold: 240, sma: 20, pad: 0.3, maxOpen: 3 }; const r = {};
  const live = goldEngulf(A, D, base); r.live = summarize(live); r.flip = summarize(goldEngulf(A, D, { ...base, flip: true }));
  r.noSma = summarize(goldEngulf(A, D, { ...base, sma: 1, noSma: true }));
  r.sens = {}; for (const [kk, v] of [['k', 2], ['k', 4], ['life', 16], ['life', 24], ['hold', 192], ['hold', 288], ['sma', 16], ['sma', 24]]) r.sens[`${kk}=${v}`] = summarize(goldEngulf(A, D, { ...base, [kk]: v }));
  const cand = []; for (let i = 30; i < D.length - 1; i++) if (D[i].close > D[i].open) cand.push(i);
  const geo = live.map((x) => [x.g1, x.g2]);
  r.randomLong = bench((s) => { const g = rng(s * 13 + 1), set = new Set(); while (set.size < Math.round(live.length * 1.4)) set.add(cand[Math.floor(g() * cand.length)]); return goldEngulf(A, D, { ...base, randomDays: set, geo: () => geo[Math.floor(g() * geo.length)] }); }, 100);
  r.randomLongNoSma = r.randomLong;
  r.dsr = deflatedSharpe(live.map((x) => x.R), 1); r.trades = live;
  console.log('geg live', brief(r.live)); console.log('geg flip', brief(r.flip)); console.log('geg noSma', brief(r.noSma)); console.log('geg rnd', JSON.stringify(r.randomLong));
  for (const [k, v] of Object.entries(r.sens)) console.log('geg', k, brief(v));
  save('geg', r);
}

if (run('gtl')) {
  const [A, D] = gold(); const H = aggregate(A, 14400, 'ny17'); const base = { n: 3, span: 120, n4: 2, pad: 0.3, hold: 96 }; const r = {};
  const live = goldTrendline(A, H, D, base); r.live = summarize(live); console.log('gtl live', brief(r.live));
  r.flip = summarize(goldTrendline(A, H, D, { ...base, flip: true })); console.log('gtl flip', brief(r.flip));
  r.noDir = summarize(goldTrendline(A, H, D, { ...base, noDir: true })); console.log('gtl noDir', brief(r.noDir));
  r.sens = {}; for (const [kk, v] of [['n', 2], ['n', 4], ['span', 96], ['span', 144], ['hold', 77], ['hold', 115]]) { r.sens[`${kk}=${v}`] = summarize(goldTrendline(A, H, D, { ...base, [kk]: v })); console.log('gtl', kk, v, brief(r.sens[`${kk}=${v}`])); }
  r.randomLong = bench((s) => { const g = rng(s * 17 + 1), set = new Set(); while (set.size < live.length * 2) set.add(10 + Math.floor(g() * (H.length - 20))); return goldTrendline(A, H, D, { ...base, randomBars: set, rLook: () => 6 + Math.floor(g() * 30) }); }, 60);
  console.log('gtl rnd', JSON.stringify(r.randomLong));
  r.dsr = deflatedSharpe(live.map((x) => x.R), 1); r.trades = live; save('gtl', r);
}

if (run('nq')) {
  const A = loadM1('nsxusd-histdata'), days = nqDays(A); const base = { minPen: 0.0008, win: 15, ndo: 'ahead', runner: true }; const r = {};
  const live = nqRun(A, days, base); r.live = summarize(live); console.log('nq live', brief(r.live));
  r.fixed2R = summarize(nqRun(A, days, { ...base, runner: false })); console.log('nq 2R', brief(r.fixed2R));
  r.noNdo = summarize(nqRun(A, days, { ...base, ndo: null })); console.log('nq noNdo', brief(r.noNdo));
  r.ndoBehind = summarize(nqRun(A, days, { ...base, ndo: 'behind' })); console.log('nq ndoBehind', brief(r.ndoBehind));
  r.flip = summarize(nqRun(A, days, { ...base, flip: true })); console.log('nq flip (fade the run = the original 3 Nov rule)', brief(r.flip));
  r.sens = {}; for (const [kk, v] of [['minPen', 0.00064], ['minPen', 0.00096], ['win', 12], ['win', 18]]) { r.sens[`${kk}=${v}`] = summarize(nqRun(A, days, { ...base, [kk]: v })); console.log('nq', kk, v, brief(r.sens[`${kk}=${v}`])); }
  const r0s = live.map((x) => x.r0 / x.O), mins = live.map((x) => x.m), frac = live.length / days.size;
  r.random = bench((s) => { const g = rng(s * 19 + 1); return nqRun(A, days, { ...base, rnd: g, randomMin: () => (g() < frac * 1.0 ? mins[Math.floor(g() * mins.length)] : -1), rR0: (O) => r0s[Math.floor(g() * r0s.length)] * O }); }, 100);
  console.log('nq random', JSON.stringify(r.random));
  r.dsr = deflatedSharpe(live.map((x) => x.R), 1); r.trades = live.map(({ t, R, gross, side }) => ({ t, R, gross, side })); save('nq', r);
}

if (run('crypto')) {
  const coins = { btc: 'BTCUSDT', eth: 'ETHUSDT', sol: 'SOLUSDT', xrp: 'XRPUSDT' }; const r = { coins: {} }; const all = { live: [], flip: [], noAdd: [], k4: [], k6: [], s44: [], s66: [] };
  const Ds = {}; for (const [c, s] of Object.entries(coins)) Ds[c] = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DATA, 'research/candles/crypto1d', `${s}_1d.json.gz`)))).map((x) => ({ time: x[0], open: x[1], high: x[2], low: x[3], close: x[4] }));
  for (const [c, D] of Object.entries(Ds)) { const base = { slots: [55, 100], k: 5, add: 1, coin: c };
    const L = cryptoTrend(D, base); all.live.push(...L); all.flip.push(...cryptoTrend(D, { ...base, flip: true })); all.noAdd.push(...cryptoTrend(D, { ...base, add: 0 }));
    all.k4.push(...cryptoTrend(D, { ...base, k: 4 })); all.k6.push(...cryptoTrend(D, { ...base, k: 6 })); all.s44.push(...cryptoTrend(D, { ...base, slots: [44, 80] })); all.s66.push(...cryptoTrend(D, { ...base, slots: [66, 120] }));
    r.coins[c] = summarize(L); console.log('crypto', c, brief(r.coins[c])); }
  for (const k of Object.keys(all)) { r[k] = summarize(all[k]); console.log('crypto', k, brief(r[k])); }
  r.randomLong = bench((s) => { const g = rng(s * 23 + 1), out = []; for (const [c, D] of Object.entries(Ds)) { const nC = all.live.filter((x) => x.coin === c), set = new Set();
    for (const x of nC) { const i = 120 + Math.floor(g() * (D.length - 125)); set.add(i * 1000 + x.slot); } out.push(...cryptoTrend(D, { slots: [55, 100], k: 5, add: 1, coin: c, randomDays: set })); } return out; }, 100);
  console.log('crypto rnd', JSON.stringify(r.randomLong));
  r.dsr = deflatedSharpe(all.live.map((x) => x.R), 1); r.trades = all.live; save('crypto', r);
}

if (run('gmp')) {
  const [A, D] = gold(); const H = aggregate(A, 3600), M5 = aggregate(A, 300); const base = { mult: 1.5, top: 0.8, z1: 0.382, z2: 0.618, wait: 6, k: 2, cost: 0.15 }; const r = {};
  const live = goldMP(A, H, M5, D, base); r.live = summarize(live); console.log('gmp live', brief(r.live));
  r.cost30 = summarize(goldMP(A, H, M5, D, { ...base, cost: 0.30 })); console.log('gmp cost0.30', brief(r.cost30));
  r.flip = summarize(goldMP(A, H, M5, D, { ...base, flip: true })); console.log('gmp flip', brief(r.flip));
  r.sens = {}; for (const [kk, v] of [['mult', 1.2], ['mult', 1.8], ['top', 0.64], ['top', 0.96], ['wait', 4.8], ['wait', 7.2]]) { r.sens[`${kk}=${v}`] = summarize(goldMP(A, H, M5, D, { ...base, [kk]: v })); console.log('gmp', kk, v, brief(r.sens[`${kk}=${v}`])); }
  r.random = bench((s) => { const g = rng(s * 29 + 1); return goldMP(A, H, M5, D, { ...base, random: live.length / (H.length * 10 / 24) * 1.6, rnd: g }); }, 30);
  console.log('gmp random', JSON.stringify(r.random)); r.dsr = deflatedSharpe(live.map((x) => x.R), 1); r.trades = live; save('gmp', r);
}

if (run('mosha')) {
  const [A] = gold(); const M15 = aggregate(A, 900), H1 = aggregate(A, 3600), H4 = aggregate(A, 14400), Dd = aggregate(A, 86400);
  const cf = path.join(DATA, 'mosha-events.json'); let EV;
  if (fs.existsSync(cf)) EV = JSON.parse(fs.readFileSync(cf)); else { console.log('mosha: computing causal events (slow)');
    EV = { E1: causalEvents(H4, 14400, 720, 1), E2: causalEvents(H1, 3600, 720, 1), E3: causalEvents(M15, 900, 720, 1) }; fs.writeFileSync(cf, JSON.stringify(EV)); }
  const wk = []; for (const b of Dd) { const k = Math.floor((b.time - 345600) / 604800) * 604800 + 345600, c = wk.at(-1); if (!c || c.time !== k) wk.push({ time: k, open: b.open, high: b.high, low: b.low, close: b.close }); else { c.high = Math.max(c.high, b.high); c.low = Math.min(c.low, b.low); c.close = b.close; } }
  const base = { weekly: true, slow: 12, be: 1.5, add: 1.5, run: true }; const r = {};
  const live = moshaBO(A, EV.E1, EV.E2, EV.E3, wk, H1, base); r.live = summarize(live); console.log('mosha live', brief(r.live));
  r.plain3R = summarize(moshaBO(A, EV.E1, EV.E2, EV.E3, wk, H1, { weekly: true })); console.log('mosha weekly 3R', brief(r.plain3R));
  r.noWeekly = summarize(moshaBO(A, EV.E1, EV.E2, EV.E3, wk, H1, { ...base, weekly: false })); console.log('mosha noWeekly', brief(r.noWeekly));
  r.noSlow = summarize(moshaBO(A, EV.E1, EV.E2, EV.E3, wk, H1, { ...base, slow: 0 })); console.log('mosha noSlow', brief(r.noSlow));
  r.flip = summarize(moshaBO(A, EV.E1, EV.E2, EV.E3, wk, H1, { ...base, flip: true })); console.log('mosha flip', brief(r.flip));
  r.sens = {}; for (const [kk, v] of [['slow', 10], ['slow', 14], ['be', 1.2], ['be', 1.8], ['add', 1.2], ['add', 1.8]]) { r.sens[`${kk}=${v}`] = summarize(moshaBO(A, EV.E1, EV.E2, EV.E3, wk, H1, { ...base, [kk]: v })); console.log('mosha', kk, v, brief(r.sens[`${kk}=${v}`])); }
  // benchmark: every M15 BO pullback (no H4/H1 chain, no weekly, no slow filter), randomly thinned to the live trade count
  const nAll = summarize(moshaBO(A, EV.E1, EV.E2, EV.E3, wk, H1, { ...base, weekly: false, slow: 0, noChain: true })); r.m15only = nAll; console.log('mosha M15-BO only', brief(nAll));
  r.random = bench((s) => { const g = rng(s * 31 + 1), f = live.length / Math.max(1, nAll.all.n); return moshaBO(A, EV.E1, EV.E2, EV.E3, wk, H1, { ...base, weekly: false, slow: 0, noChain: true, keep: () => g() < f }); }, 30);
  console.log('mosha random', JSON.stringify(r.random));
  r.dsr = deflatedSharpe(live.map((x) => x.R), 1); r.trades = live; save('mosha', r);
}
