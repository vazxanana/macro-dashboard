// Shared helpers for the robustness audit (research/edge/robustness). Paper research only.
// Data: HistData M1 CSVs extracted from origin/council-data research/candles/<dir>/ into $ROB_DATA (default ./data).
// HistData stamps convert with council/histdata.mjs (10 Nov 2026, research/edge/histdata-clock: New York time in 2018, UTC-5 /
// UTC-4 on Europe's summer-time dates from 2019; the earlier reading as New York time for every year was one hour early in
// the weeks the US is on daylight time and Europe is not).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { histToUtc } from '../../../council/histdata.mjs';   // the shared HistData clock

export const DATA = process.env.ROB_DATA || path.join(path.dirname(new URL(import.meta.url).pathname), 'data');

const nyFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' });
export function nyParts(t) { const o = {}; for (const p of nyFmt.formatToParts(new Date(t * 1000))) o[p.type] = p.value; return { d: `${o.year}-${o.month}-${o.day}`, m: +o.hour * 60 + +o.minute, wd: o.weekday, h: +o.hour }; }
const offCache = new Map();
// UTC offset (seconds) of New York on a calendar day (evaluated at noon UTC of that day; DST switch hour ignored): the 17:00 New
// York day / H4 alignment of `aggregate`, not the file clock
function nyOffset(y, mo, d) {
  const k = y * 10000 + mo * 100 + d; if (offCache.has(k)) return offCache.get(k);
  const t = Date.UTC(y, mo - 1, d, 12) / 1000, p = nyParts(t), [yy, mm, dd] = p.d.split('-').map(Number);
  const local = Date.UTC(yy, mm - 1, dd, Math.floor(p.m / 60), p.m % 60) / 1000, off = t - local; offCache.set(k, off); return off;
}
// Load HistData M1 for a symbol directory (e.g. 'xau-histdata', prefix 'XAUUSD') → {t,o,h,l,c} typed arrays, UTC seconds, sorted
export function loadM1(dir, years) {
  const cache = path.join(DATA, `${dir}-m1.bin`);
  if (fs.existsSync(cache)) { const buf = fs.readFileSync(cache); const n = buf.length / 40; const f = new Float64Array(buf.buffer, buf.byteOffset, n * 5);
    const t = new Float64Array(n), o = new Float64Array(n), h = new Float64Array(n), l = new Float64Array(n), c = new Float64Array(n);
    for (let i = 0; i < n; i++) { t[i] = f[i * 5]; o[i] = f[i * 5 + 1]; h[i] = f[i * 5 + 2]; l[i] = f[i * 5 + 3]; c[i] = f[i * 5 + 4]; }
    return filt({ t, o, h, l, c, n }, years); }
  const files = fs.readdirSync(path.join(DATA, 'research/candles', dir)).filter((f) => f.endsWith('.csv.gz')).sort();
  const rows = [];
  for (const f of files) {
    const txt = zlib.gunzipSync(fs.readFileSync(path.join(DATA, 'research/candles', dir, f))).toString();
    for (const line of txt.split('\n')) { if (line.length < 20) continue; const [ts, o, h, l, c] = line.split(';');
      const y = +ts.slice(0, 4), mo = +ts.slice(4, 6), d = +ts.slice(6, 8), hh = +ts.slice(9, 11), mi = +ts.slice(11, 13);
      const t = histToUtc(y, mo, d, hh, mi); rows.push([t, +o, +h, +l, +c]); }
  }
  rows.sort((a, b) => a[0] - b[0]);
  const u = []; for (const r of rows) if (!u.length || u[u.length - 1][0] !== r[0]) u.push(r);
  const f = new Float64Array(u.length * 5); u.forEach((r, i) => f.set(r, i * 5)); fs.writeFileSync(cache, Buffer.from(f.buffer));
  return loadM1(dir, years);
}
function filt(A, years) { if (!years) return A; const [a, b] = years.map((y, i) => Date.UTC(y + i, 0, 1) / 1000); let i0 = 0; while (i0 < A.n && A.t[i0] < a) i0++; let i1 = i0; while (i1 < A.n && A.t[i1] < b) i1++;
  return { t: A.t.subarray(i0, i1), o: A.o.subarray(i0, i1), h: A.h.subarray(i0, i1), l: A.l.subarray(i0, i1), c: A.c.subarray(i0, i1), n: i1 - i0 }; }
export const toBars = (A) => { const out = new Array(A.n); for (let i = 0; i < A.n; i++) out[i] = { time: A.t[i], open: A.o[i], high: A.h[i], low: A.l[i], close: A.c[i] }; return out; };
// Aggregate M1 into candles. 'ny17' alignment: days start 17:00 New York (OANDA/most FX brokers); H4 blocks 17,21,1,5,9,13 NY.
export function aggregate(A, sec, align = 'utc') {
  const out = []; let cur = null;
  for (let i = 0; i < A.n; i++) {
    let t0;
    if (align === 'ny17') { const off = nyOffset(...ymd(A.t[i])); const loc = A.t[i] - off + 7 * 3600; t0 = Math.floor(loc / sec) * sec + off - 7 * 3600; }
    else t0 = Math.floor(A.t[i] / sec) * sec;
    if (!cur || cur.time !== t0) { cur = { time: t0, open: A.o[i], high: A.h[i], low: A.l[i], close: A.c[i], i0: i, i1: i }; out.push(cur); }
    else { if (A.h[i] > cur.high) cur.high = A.h[i]; if (A.l[i] < cur.low) cur.low = A.l[i]; cur.close = A.c[i]; cur.i1 = i; }
  }
  return out;
}
function ymd(t) { const d = new Date(t * 1000); return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]; }
export const yearOf = (t) => new Date(t * 1000).getUTCFullYear();

// ── Trade simulation on M1 ──
// spec: { side: 1|-1, i: M1 index of entry bar (enter at its open unless px given), px, r0 (price risk), cost (price, round trip),
//   tgt (R, null = none), be (R or null), trail: [atR, byR] or null, cap (R, default tgt), maxBars (M1 bars), stopPx (absolute stop, optional),
//   add: {atR, size} (second unit at +atR with stop at first entry, exits with first), exitAt (UTC sec) }
// Returns {R (net, incl. add), gross, exitI}. Intrabar: stop checked before target (conservative).
export function simTrade(A, s) {
  const d = s.side, e = s.px != null ? s.px : A.o[s.i], r0 = s.r0; let stop = s.stopPx != null ? s.stopPx : e - d * r0;
  const tgtPx = s.tgt != null ? e + d * s.tgt * r0 : null; let best = 0, beMoved = false, addE = null, addR0 = 0, i = s.i;
  const end = Math.min(A.n - 1, s.maxBars != null ? s.i + s.maxBars : A.n - 1);
  let exitPx = null;
  for (; i <= end; i++) {
    if (s.exitAt && A.t[i] >= s.exitAt) { exitPx = A.o[i]; break; }
    const hi = A.h[i], lo = A.l[i];
    if (d > 0 ? lo <= stop : hi >= stop) { exitPx = (d > 0 ? Math.min(stop, A.o[i]) : Math.max(stop, A.o[i])); if (i === s.i) exitPx = stop; break; }
    if (tgtPx != null && (d > 0 ? hi >= tgtPx : lo <= tgtPx)) { exitPx = tgtPx; break; }
    const fav = (d > 0 ? hi - e : e - lo) / r0; if (fav > best) best = fav;
    if (s.add && addE == null && best >= s.add.atR) { addE = e + d * s.add.atR * r0; addR0 = s.add.atR * r0; }
    if (s.be != null && !beMoved && best >= s.be) { beMoved = true; if ((stop - e) * d < 0) stop = e; }
    if (s.trail && best >= s.trail[0]) { const ns = e + d * (Math.min(best, s.cap ?? 1e9) - s.trail[1]) * r0; if ((ns - stop) * d > 0) stop = ns; }
    if (s.trail && s.cap != null && best >= s.cap) { exitPx = e + d * s.cap * r0; break; }
  }
  if (exitPx == null) exitPx = A.c[Math.min(end, A.n - 1)];
  const gross = d * (exitPx - e) / r0; let R = gross - s.cost / r0;
  if (addE != null) { const ga = d * (exitPx - addE) / addR0; R += (s.add.size || 1) * (ga - s.cost / addR0); }
  return { R, gross, exitI: i, add: addE != null };
}

// ── Statistics ──
export function stats(R) {
  const n = R.length; if (!n) return { n: 0, wr: null, exp: null, R: 0, maxDD: 0, streak: 0, t: null };
  let s = 0, s2 = 0, w = 0, eq = 0, pk = 0, dd = 0, st = 0, mst = 0;
  for (const r of R) { s += r; s2 += r * r; if (r > 0) { w++; st = 0; } else { st++; if (st > mst) mst = st; } eq += r; if (eq > pk) pk = eq; if (pk - eq > dd) dd = pk - eq; }
  const m = s / n, sd = Math.sqrt(Math.max(0, s2 / n - m * m) * n / Math.max(1, n - 1));
  return { n, wr: +(w / n).toFixed(3), exp: +m.toFixed(3), R: +s.toFixed(1), maxDD: +(-dd).toFixed(1), streak: mst, t: sd > 0 ? +(m / (sd / Math.sqrt(n))).toFixed(2) : null };
}
export function byYear(trades) { const g = {}; for (const x of trades) (g[yearOf(x.t)] = g[yearOf(x.t)] || []).push(x.R); return Object.fromEntries(Object.entries(g).map(([y, a]) => [y, stats(a)])); }
// Deterministic RNG
export function rng(seed = 1) { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
// Standard normal CDF / inverse
export function Phi(z) { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2); const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; }
export function PhiInv(p) { // Acklam
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239], b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572], c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783], dd = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425; let q, r;
  if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((dd[0] * q + dd[1]) * q + dd[2]) * q + dd[3]) * q + 1); }
  if (p > 1 - pl) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((dd[0] * q + dd[1]) * q + dd[2]) * q + dd[3]) * q + 1); }
  q = p - 0.5; r = q * q; return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
// Deflated Sharpe ratio (Bailey & Lopez de Prado 2014) on per-trade returns, given N independent trials.
export function deflatedSharpe(R, N) {
  const n = R.length; if (n < 10) return null; const m = R.reduce((a, b) => a + b, 0) / n; const v = R.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1); const sd = Math.sqrt(v); if (!(sd > 0)) return null;
  const sr = m / sd, sk = R.reduce((a, b) => a + ((b - m) / sd) ** 3, 0) / n, ku = R.reduce((a, b) => a + ((b - m) / sd) ** 4, 0) / n;
  const g = 0.5772156649, vSR = 1 / (n - 1);   // variance of SR across trials under the null
  const sr0 = N > 1 ? Math.sqrt(vSR) * ((1 - g) * PhiInv(1 - 1 / N) + g * PhiInv(1 - 1 / (N * Math.E))) : 0;
  const z = (sr - sr0) * Math.sqrt(n - 1) / Math.sqrt(Math.max(1e-9, 1 - sk * sr + (ku - 1) / 4 * sr * sr));
  return { sr: +sr.toFixed(3), sr0: +sr0.toFixed(3), psr0: +Phi(sr * Math.sqrt(n - 1) / Math.sqrt(Math.max(1e-9, 1 - sk * sr + (ku - 1) / 4 * sr * sr))).toFixed(3), dsr: +Phi(z).toFixed(3) };
}
export const fmt = (s) => s && s.n ? `n${s.n} wr${(s.wr * 100).toFixed(0)}% exp${s.exp >= 0 ? '+' : ''}${s.exp} R${s.R >= 0 ? '+' : ''}${s.R} dd${s.maxDD} t${s.t}` : 'n0';
