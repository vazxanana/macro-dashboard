// Auto-researcher engine (PREREGISTRATION.md, 24 Nov 2026). Paper research only: nothing here trades or changes a rule.
//   node engine.mjs run <worker 1-9> <outDir> [minutes]   search until the time is up, writing <outDir>/worker-<k>.json
//   node engine.mjs bench <worker> [tries]                 time a few tries on the local candle cache
// Candles: H1 OANDA mid. EDGE_DATA (edgekit cache, 5-minute files) when present, else the site's /md/bars through MD_BASE.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';

export const VERSION = 'auto-3';
// auto-2 (26 Nov 2026, owner: "focus only in EG EF BO ... results from 2019 till today t above 1 is okey"; PREREGISTRATION.md, "Version auto-2"). auto-1's
// windows, bars and families below are kept for the studies and desks that import them; the worker (`run`) draws auto-2 rules only.
export const WIN2 = { A: [Date.UTC(2021, 0, 1) / 1000, Date.UTC(2024, 0, 1) / 1000], C: [Date.UTC(2024, 0, 1) / 1000, Infinity] };   // auto-3 (27 Nov 2026): 2021 to now
export const BAR2 = { A: { n: 100, t: 1.0 }, C: { n: 50, t: 1.0 }, ALL: { t: 1.0 }, LEAD: { n: 100, t: 2.0 } };
export const K2 = ['eg', 'egr', 'ef', 'efr'], SPACE2 = { life: [12, 24, 48, 96], P: [2, 3, 5, 8], bo: ['any', 'bos', 'choch'] };
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy', 'xag'];
const UTC = (y, m = 0, d = 1) => Date.UTC(y, m, d) / 1000;
export const WIN = { A: [UTC(2005), UTC(2015)], B: [UTC(2015), UTC(2020)], C: [UTC(2020), Infinity] };
export const BAR = { A: { n: 250, mean: 0.04, t: 3.0 }, B: { n: 100, mean: 0, t: 1.5 }, C: { n: 100, mean: 0, t: 2.0 } };
export const FAMILY = { 1: ['brk', 'fade', 'eg'], 2: ['pull', 'dev'], 3: ['big', 'blk', 'sweep'], 4: ['brk', 'fade', 'pull', 'dev', 'big', 'blk', 'eg', 'sweep'], 5: ['wild'],
  // 25 Nov 2026: four more workers, same grids and bars (PREREGISTRATION.md, "Four more workers"); only the seeds differ
  6: ['wild'], 7: ['wild'], 8: ['brk', 'fade', 'pull', 'dev', 'big', 'blk', 'eg', 'sweep'], 9: ['big', 'blk', 'sweep'],
  // 25 Nov 2026 (owner: "one worker just for NQ try all the edges possible and do combinations"): worker 10 = NAS100 only, every trigger kind, one or two combined
  10: ['nq'],
  // 26 Nov 2026 (owner: "look the edges following market structure"; PREREGISTRATION.md, "Two market-structure workers"): 11 = one structure trigger, 12 = a structure trigger with a second trigger
  11: ['ms'], 12: ['ms'] };
export const MS_WORKERS = [11, 12], MSK = ['bos', 'choch', 'mspb'], MS_MARKETS = [...MARKETS, 'nas100'];
export const MS_SPACE = { P: [2, 3, 5, 8], d: [0.382, 0.5, 0.618, 0.786], msP: [8, 12, 20, 30], ms: ['none', 'with', 'with', 'against'] };
export const NQ_WORKER = 10, NQ_COST = 0;   // owner, 25 Nov 2026: "no cost because will be futures": NQ results are BEFORE costs (futures still pay a tick and a commission; a lead is re-priced at real quotes before anything else)
const ALLK = ['brk', 'fade', 'pull', 'big', 'blk', 'dev', 'eg', 'sweep'];
export const SPACE = {
  N: [5, 8, 10, 15, 20, 30, 50, 80, 120], fast: [5, 10, 20, 30], slow: [50, 100, 150, 200], rsi: [20, 25, 30, 35, 65, 70, 75, 80],
  k: [1, 1.25, 1.5, 2, 2.5, 3], z: [1, 1.5, 2, 2.5, 3, 4], blockH: [3, 4, 6, 8], hours: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
  stop: [0.5, 0.75, 1, 1.5, 2, 3], rr: [0.5, 1, 1.5, 2, 3, 4, 6, 0], hold: [4, 8, 12, 24, 48, 96, 240], atrPct: [0.3, 0.5, 0.7] };

// ─── data ───
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export function toArrays(bars) {
  const n = bars.length, A = { n, t: new Float64Array(n), o: new Float64Array(n), h: new Float64Array(n), l: new Float64Array(n), c: new Float64Array(n) };
  bars.forEach((b, i) => { A.t[i] = b.t; A.o[i] = b.o; A.h[i] = b.h; A.l[i] = b.l; A.c[i] = b.c; }); return A;
}
async function fetchH1(mk, cacheDir) {
  const f = path.join(cacheDir, `${mk}-1h.json.gz`);
  if (fs.existsSync(f) && Date.now() - fs.statSync(f).mtimeMs < 20 * 3600e3) return JSON.parse(zlib.gunzipSync(fs.readFileSync(f)));
  const BASE = process.env.MD_BASE || 'https://aureumdesk.co.uk/md/', now = Math.floor(Date.now() / 1000), map = new Map(), span = 4900 * 3600;
  for (let a = UTC(2005); a < now; a += span) {
    for (let tries = 0; tries < 4; tries++) {
      try { const r = await fetch(`${BASE}bars?sym=${mk}&tf=1h&from=${a}&to=${Math.min(a + span, now)}`);
        if (r.ok) { for (const x of (await r.json()).bars || []) if (x.time + 3600 <= now) map.set(x.time, { t: x.time, o: x.open, h: x.high, l: x.low, c: x.close }); break; } } catch {}
      await sleep(1500 * (tries + 1));
    }
    await sleep(250);
  }
  const rows = [...map.values()].sort((p, q) => p.t - q.t); fs.mkdirSync(cacheDir, { recursive: true }); fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(rows))); return rows;
}
export async function loadMarket(mk, cacheDir) {
  let bars;
  try { const five = K.load(mk, '5m', { from: '2005-01-01' }); if (five.length > 1000) bars = K.resample(five, 3600).filter((b) => b.n >= 10).map((b) => ({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c })); } catch {}
  if (!bars) bars = await fetchH1(mk, cacheDir);
  return prep(toArrays(bars), mk);
}

// ─── indicators, computed once per market ───
const cache = (D, key, f) => (D.ind[key] ||= f());
export function sma(c, n) { const o = new Float64Array(c.length).fill(NaN); let s = 0; for (let i = 0; i < c.length; i++) { s += c[i]; if (i >= n) s -= c[i - n]; if (i >= n - 1) o[i] = s / n; } return o; }
export function atr(D, n = 14) { return cache(D, 'atr' + n, () => { const o = new Float64Array(D.n).fill(NaN), tr = (i) => Math.max(D.h[i] - D.l[i], Math.abs(D.h[i] - D.c[i - 1]), Math.abs(D.l[i] - D.c[i - 1]));
  let m = 0; for (let i = 1; i <= n; i++) m += tr(i); m /= n; o[n] = m;                       // Wilder: the first value is the mean of n true ranges
  for (let i = n + 1; i < D.n; i++) { m = (m * (n - 1) + tr(i)) / n; o[i] = m; } return o; }); }
const maOf = (D, n) => cache(D, 'sma' + n, () => sma(D.c, n));
export function rsi(D, n = 14) { return cache(D, 'rsi' + n, () => { const o = new Float64Array(D.n).fill(NaN); let g = 0, l = 0;
  for (let i = 1; i < D.n; i++) { const d = D.c[i] - D.c[i - 1], up = Math.max(d, 0), dn = Math.max(-d, 0); if (i <= n) { g += up; l += dn; if (i === n) { g /= n; l /= n; o[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); } } else { g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n; o[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); } } return o; }); }
const hiN = (D, n) => cache(D, 'hi' + n, () => { const o = new Float64Array(D.n).fill(NaN); for (let i = n; i < D.n; i++) { let m = -Infinity; for (let k = i - n; k < i; k++) if (D.h[k] > m) m = D.h[k]; o[i] = m; } return o; });
const loN = (D, n) => cache(D, 'lo' + n, () => { const o = new Float64Array(D.n).fill(NaN); for (let i = n; i < D.n; i++) { let m = Infinity; for (let k = i - n; k < i; k++) if (D.l[k] < m) m = D.l[k]; o[i] = m; } return o; });
export const atrPct = (D) => cache(D, 'atrpct', () => { const a = atr(D), o = new Float64Array(D.n).fill(NaN), W = 500;
  for (let i = W; i < D.n; i++) { let r = 0, c = 0; for (let k = i - W; k < i; k += 5) { c++; if (a[k] < a[i]) r++; } o[i] = r / c; } return o; });
// market structure from closed candles (PREREGISTRATION.md, "Two market-structure workers"): per bar i, known at its close:
// bk = +1 / -1 on a break up / down, kd = 1 continuation (bos) / 2 against the structure (choch), st = the structure's direction
// after bar i, dp = how far a non-break candle that closed with the structure pulled back into the leg (0 = none)
export function struct(D, P) { return cache(D, 'ms' + P, () => {
  const n = D.n, bk = new Int8Array(n), kd = new Int8Array(n), st = new Int8Array(n), dp = new Float32Array(n);
  let sh = NaN, shI = -1, sl = NaN, slI = -1, dir = 0, org = NaN, ext = NaN;
  for (let i = 0; i < n; i++) {
    const k = i - P;
    if (k >= P) { let hi = true, lo = true;
      for (let j = k - P; j <= i && (hi || lo); j++) { if (j === k) continue; if (j < k ? D.h[j] >= D.h[k] : D.h[j] > D.h[k]) hi = false; if (j < k ? D.l[j] <= D.l[k] : D.l[j] < D.l[k]) lo = false; }
      if (hi) { sh = D.h[k]; shI = k; } if (lo) { sl = D.l[k]; slI = k; } }
    let b = 0;
    if (sh === sh && D.c[i] > sh) b = 1; else if (sl === sl && D.c[i] < sl) b = -1;
    if (b) { bk[i] = b; kd[i] = dir === -b ? 2 : 1; let o = b > 0 ? Infinity : -Infinity;
      for (let j = b > 0 ? shI : slI; j <= i; j++) o = b > 0 ? Math.min(o, D.l[j]) : Math.max(o, D.h[j]);
      org = o; ext = b > 0 ? D.h[i] : D.l[i]; dir = b; if (b > 0) sh = NaN; else sl = NaN; }
    else if (dir) { const leg = dir > 0 ? ext - org : org - ext;
      if (leg > 0 && (dir > 0 ? D.c[i] > D.o[i] && D.l[i] > org : D.c[i] < D.o[i] && D.h[i] < org)) { const q = (dir > 0 ? ext - D.l[i] : D.h[i] - ext) / leg; if (q > 0) dp[i] = q; }
      if (dir > 0 ? D.h[i] > ext : D.l[i] < ext) ext = dir > 0 ? D.h[i] : D.l[i]; }
    st[i] = dir;
  }
  return { bk, kd, st, dp }; }); }
export function prep(D, mk) {
  D.mk = mk; D.ind = {}; D.hour = new Uint8Array(D.n); D.dow = new Uint8Array(D.n); D.month = new Int32Array(D.n);
  for (let i = 0; i < D.n; i++) { const d = new Date(D.t[i] * 1000); D.hour[i] = d.getUTCHours(); D.dow[i] = d.getUTCDay(); D.month[i] = d.getUTCFullYear() * 12 + d.getUTCMonth(); }
  D.cost = K.COSTS[mk]; if (mk === 'nas100') { D.costRel = NQ_COST; D.cost = 0; }   // a share of price when NQ_COST is set, none by the owner's word
  const find = (x) => { let lo = 0, hi = D.n; while (lo < hi) { const m = (lo + hi) >> 1; if (D.t[m] < x) lo = m + 1; else hi = m; } return lo; };
  D.idx = { A: [find(WIN.A[0]), find(WIN.A[1])], B: [find(WIN.B[0]), find(WIN.B[1])], C: [find(WIN.C[0]), D.n] };
  D.idx2 = { A: [find(WIN2.A[0]), find(WIN2.A[1])], C: [find(WIN2.C[0]), D.n] };
  return D;
}

// ─── random rules ───
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, a) => a[Math.floor(r() * a.length)];
function trigger(r, kind) {
  switch (kind) {
    case 'brk': return { kind, N: pick(r, SPACE.N) };
    case 'fade': return { kind, N: pick(r, SPACE.N) };
    case 'pull': return { kind, fast: pick(r, SPACE.fast), slow: pick(r, SPACE.slow), rsi: pick(r, SPACE.rsi) };
    case 'big': return { kind, k: pick(r, SPACE.k), follow: r() < 0.5 };
    case 'blk': return { kind, H: pick(r, SPACE.blockH), at: pick(r, SPACE.hours), follow: r() < 0.5 };
    case 'dev': return { kind, n: pick(r, [10, 20, 50]), z: pick(r, SPACE.z), follow: r() < 0.5 };
    case 'eg': return { kind, follow: r() < 0.5 };
    case 'sweep': return { kind, N: pick(r, SPACE.N), follow: r() < 0.5 };
  }
}
function msGenome(r, worker) {
  const one = () => { const kind = pick(r, MSK), P = pick(r, MS_SPACE.P); return kind === 'mspb' ? { kind, P, d: pick(r, MS_SPACE.d) } : { kind, P, follow: r() < 0.7 }; };
  const trig = [one()]; if (worker === 12) trig.push(r() < 0.5 ? one() : trigger(r, pick(r, ALLK)));
  const h0 = r() < 0.5 ? null : pick(r, SPACE.hours);
  return { mk: pick(r, MS_MARKETS), trig, side: pick(r, ['both', 'both', 'long', 'short']),
    hours: h0 == null ? null : [h0, (h0 + pick(r, [1, 2, 3, 4, 6, 8, 12])) % 24], dows: r() < 0.7 ? null : pick(r, [[1, 2, 3, 4, 5], [1, 2, 3], [2, 3, 4], [3, 4, 5], [1, 5]]),
    trend: pick(r, ['none', 'none', 'with', 'against']), vol: pick(r, ['none', 'none', 'low', 'high']), volP: pick(r, SPACE.atrPct),
    ms: pick(r, MS_SPACE.ms), msP: pick(r, MS_SPACE.msP), stop: pick(r, SPACE.stop), rr: pick(r, SPACE.rr), hold: pick(r, SPACE.hold) };
}
export function genome(r, worker) {
  if (FAMILY[worker][0] === 'ms') return msGenome(r, worker);
  const fam = FAMILY[worker], kinds = fam[0] === 'wild' ? [pick(r, ALLK), pick(r, ALLK)] : fam[0] === 'nq' ? (r() < 0.5 ? [pick(r, ALLK)] : [pick(r, ALLK), pick(r, ALLK)]) : [pick(r, fam)];
  const h0 = r() < 0.5 ? null : pick(r, SPACE.hours);
  return { mk: worker === NQ_WORKER ? 'nas100' : pick(r, MARKETS), trig: kinds.map((k) => trigger(r, k)), side: pick(r, ['both', 'both', 'long', 'short']),
    hours: h0 == null ? null : [h0, (h0 + pick(r, [1, 2, 3, 4, 6, 8, 12])) % 24], dows: r() < 0.7 ? null : pick(r, [[1, 2, 3, 4, 5], [1, 2, 3], [2, 3, 4], [3, 4, 5], [1, 5]]),
    trend: pick(r, ['none', 'none', 'with', 'against']), vol: pick(r, ['none', 'none', 'low', 'high']), volP: pick(r, SPACE.atrPct),
    stop: pick(r, SPACE.stop), rr: pick(r, SPACE.rr), hold: pick(r, SPACE.hold) };
}
// the engulf at bar i: [direction, index of its base candle]. The nearest opposite candle within the 3 before: this close is the first to go beyond its high / low
export function egAt(D, i) {
  for (let b = i - 1; b >= i - 3 && b >= 1; b--) {
    const bull = D.c[b] > D.o[b], bear = D.c[b] < D.o[b];
    if (bear && D.c[i] > D.h[b]) { let first = true; for (let k = b + 1; k < i; k++) if (D.c[k] > D.h[b]) first = false; return first ? [1, b] : [0, -1]; }
    if (bull && D.c[i] < D.l[b]) { let first = true; for (let k = b + 1; k < i; k++) if (D.c[k] < D.l[b]) first = false; return first ? [-1, b] : [0, -1]; }
    if (bear || bull) return [0, -1];
  }
  return [0, -1];
}
// auto-2: engulf zones walked once, candle by candle (only candles up to i decide bar i). A zone = the base candle wick to wick, alive `life` candles from the
// candle that completed it, until a close through its far side. egr[i] = the first return: bar i trades into the zone and closes back out on the engulf's side
// (the engulf's direction). ef[i] = bar i is the first close through the far side (the direction of the failure). Two opposite signals on one bar = none.
export function zones(D, life) { return cache(D, 'zn' + life, () => {
  const n = D.n, egr = new Int8Array(n), ef = new Int8Array(n), efr = new Int8Array(n); let live = [], dead = [];
  for (let i = 4; i < n; i++) {
    let r = 0, f = 0, rx = false, fx = false, q = 0, qx = false; const keep = [], born = [];
    for (const z of live) {
      if (i - z.born > life) continue;
      if (z.d > 0 ? D.c[i] < z.bot : D.c[i] > z.top) { if (f && f !== -z.d) fx = true; f = -z.d; born.push({ d: -z.d, top: z.top, bot: z.bot, born: i, hit: false }); continue; }
      if (!z.hit && (z.d > 0 ? D.l[i] <= z.top : D.h[i] >= z.bot)) { z.hit = true; if (z.d > 0 ? D.c[i] > z.top : D.c[i] < z.bot) { if (r && r !== z.d) rx = true; r = z.d; } }
      keep.push(z);
    }
    // auto-3: a failed zone serves the other side (d = the failure's direction) until a close back through it; efr = its first return closing back out
    const keepD = [];
    for (const z of dead) {
      if (i - z.born > life) continue;
      if (z.d > 0 ? D.c[i] < z.bot : D.c[i] > z.top) continue;
      if (!z.hit && (z.d > 0 ? D.l[i] <= z.top : D.h[i] >= z.bot)) { z.hit = true; if (z.d > 0 ? D.c[i] > z.top : D.c[i] < z.bot) { if (q && q !== z.d) qx = true; q = z.d; } }
      keepD.push(z);
    }
    dead = keepD.concat(born);
    live = keep; egr[i] = rx ? 0 : r; ef[i] = fx ? 0 : f; efr[i] = qx ? 0 : q;
    const [d, b] = egAt(D, i); if (d) live.push({ d, top: D.h[b], bot: D.l[b], born: i, hit: false });
  }
  return { egr, ef, efr }; }); }
// auto-2 rules: one trigger of K2, or two that agree on the same candle
function trigger2(r, kind) { return kind === 'eg' ? { kind, follow: true } : kind === 'bo' ? { kind, P: pick(r, SPACE2.P), bo: pick(r, SPACE2.bo) } : { kind, life: pick(r, SPACE2.life) }; }
export function genome2(r, worker) {
  const trig = [trigger2(r, pick(r, K2))]; if (r() < 0.5) { const k = pick(r, K2); if (k !== trig[0].kind) trig.push(trigger2(r, k)); }
  const h0 = r() < 0.5 ? null : pick(r, SPACE.hours);
  return { mk: worker === NQ_WORKER ? 'nas100' : pick(r, MS_MARKETS), trig, side: pick(r, ['both', 'both', 'long', 'short']),
    hours: h0 == null ? null : [h0, (h0 + pick(r, [1, 2, 3, 4, 6, 8, 12])) % 24], dows: r() < 0.7 ? null : pick(r, [[1, 2, 3, 4, 5], [1, 2, 3], [2, 3, 4], [3, 4, 5], [1, 5]]),
    trend: pick(r, ['none', 'none', 'with', 'against']), vol: pick(r, ['none', 'none', 'low', 'high']), volP: pick(r, SPACE.atrPct),
    stop: pick(r, SPACE.stop), rr: pick(r, SPACE.rr), hold: pick(r, SPACE.hold) };
}
export const group2 = (g) => [g.mk, g.trig.map((t) => t.kind + (t.life ? t.life : '') + (t.P ? t.P + t.bo : '')).join('&'), g.side, g.trend, g.stop, g.rr].join('|');
// one trigger: +1 long, -1 short, 0 none, at the close of bar i
export function sig(D, tr, i) {
  switch (tr.kind) {
    case 'brk': { const H = hiN(D, tr.N)[i], L = loN(D, tr.N)[i]; return D.c[i] > H ? 1 : D.c[i] < L ? -1 : 0; }
    case 'fade': { const H = hiN(D, tr.N)[i], L = loN(D, tr.N)[i]; return D.c[i] > H ? -1 : D.c[i] < L ? 1 : 0; }
    case 'pull': { const f = maOf(D, tr.fast)[i], sl = maOf(D, tr.slow)[i], q = rsi(D)[i]; if (!(f === f && sl === sl && q === q)) return 0;
      const lo = tr.rsi < 50 ? tr.rsi : 100 - tr.rsi; return f > sl && q <= lo ? 1 : f < sl && q >= 100 - lo ? -1 : 0; }
    case 'big': { const a = atr(D)[i - 1], rg = D.h[i] - D.l[i]; if (!(a > 0) || rg < tr.k * a) return 0; const dir = D.c[i] > D.o[i] ? 1 : D.c[i] < D.o[i] ? -1 : 0; return tr.follow ? dir : -dir; }
    case 'blk': { if (D.hour[i] !== tr.at) return 0; let H = -Infinity, L = Infinity; for (let k = i - tr.H; k < i; k++) { if (k < 0) return 0; if (D.h[k] > H) H = D.h[k]; if (D.l[k] < L) L = D.l[k]; }
      const up = D.c[i] > H ? 1 : D.c[i] < L ? -1 : 0; return tr.follow ? up : -up; }
    case 'dev': { const m = maOf(D, tr.n)[i], a = atr(D)[i]; if (!(m === m && a > 0)) return 0; const z = (D.c[i] - m) / a; const dir = z > tr.z ? 1 : z < -tr.z ? -1 : 0; return tr.follow ? dir : -dir; }
    case 'eg': { const dir = egAt(D, i)[0]; return tr.follow ? dir : -dir; }
    case 'egr': return zones(D, tr.life).egr[i];
    case 'ef': return zones(D, tr.life).ef[i];
    case 'efr': return zones(D, tr.life).efr[i];
    case 'bo': { const S = struct(D, tr.P), b = S.bk[i]; if (!b || (tr.bo === 'bos' && S.kd[i] !== 1) || (tr.bo === 'choch' && S.kd[i] !== 2)) return 0; return b; }
    case 'bos': case 'choch': { const S = struct(D, tr.P), b = S.bk[i]; if (!b || S.kd[i] !== (tr.kind === 'bos' ? 1 : 2)) return 0; return tr.follow ? b : -b; }
    case 'mspb': { const S = struct(D, tr.P); return S.dp[i] >= tr.d ? S.st[i] : 0; }
    case 'sweep': { const H = hiN(D, tr.N)[i], L = loN(D, tr.N)[i]; const dir = D.l[i] < L && D.c[i] > L ? 1 : D.h[i] > H && D.c[i] < H ? -1 : 0; return tr.follow ? dir : -dir; }
  }
  return 0;
}
function passes(D, g, i) {
  if (g.hours) { const h = D.hour[i + 1], [a, b] = g.hours; if (a <= b ? !(h >= a && h < b) : !(h >= a || h < b)) return false; }   // the entry hour
  if (g.dows && !g.dows.includes(D.dow[i + 1])) return false;
  if (g.vol !== 'none') { const p = atrPct(D)[i]; if (!(p === p)) return false; if (g.vol === 'low' ? !(p <= g.volP) : !(p >= 1 - g.volP)) return false; }
  return true;
}
// run a rule over [lo, hi): net R per trade; flip = the side-flipped twin (placebo)
export function simulate(D, g, lo, hi, flip = false) {
  const out = { n: 0, sum: 0, months: new Map(), wins: 0 }, a = atr(D), trendMA = g.trend === 'none' ? null : maOf(D, 200);
  let free = lo;
  for (let i = Math.max(lo - 1, 210); i < hi - 1; i++) {
    if (i + 1 < free) continue;
    const A = a[i]; if (!(A > 0)) continue;
    let s = 0; for (const tr of g.trig) { const q = sig(D, tr, i); if (q === 0 || (s !== 0 && q !== s)) { s = 0; break; } s = q; } if (s === 0) continue;
    if (g.side === 'long' && s < 0 || g.side === 'short' && s > 0) continue;
    if (trendMA) { const m = trendMA[i]; if (!(m === m)) continue; const up = D.c[i] > m ? 1 : -1; if (g.trend === 'with' ? up !== s : up === s) continue; }
    if (g.ms && g.ms !== 'none') { const d = struct(D, g.msP).st[i]; if (!d || (g.ms === 'with' ? d !== s : d === s)) continue; }   // the larger structure (workers 11, 12 only)
    if (!passes(D, g, i)) continue;
    const side = flip ? -s : s, entry = D.o[i + 1], dist = g.stop * A, stop = entry - side * dist, tgt = g.rr > 0 ? entry + side * g.rr * dist : null;
    const cst = D.costRel ? D.costRel * entry : D.cost;     // an index costs a share of its price, a currency or metal a fixed amount
    if (!(dist > 0) || cst / dist > 0.5) continue;                                  // a stop smaller than twice the cost is no trade
    let ex = null, j = i + 1;
    for (; j <= i + g.hold && j < D.n; j++) {
      const o = j === i + 1 ? entry : D.o[j];
      if (side > 0 ? o <= stop : o >= stop) { ex = o; break; }                          // a candle that opens beyond the stop exits at its open
      if (side > 0 ? D.l[j] <= stop : D.h[j] >= stop) { ex = stop; break; }             // stop first when one candle holds both
      if (tgt != null && (side > 0 ? D.h[j] >= tgt : D.l[j] <= tgt)) { ex = tgt; break; }
    }
    if (ex == null) { j = Math.min(i + g.hold, D.n - 1); ex = D.c[j]; }
    const R = ((ex - entry) * side - cst) / dist; free = j + 1;
    out.n++; out.sum += R; if (R > 0) out.wins++; out.months.set(D.month[i + 1], (out.months.get(D.month[i + 1]) || 0) + R);
  }
  return out;
}
export function summary(o) {
  if (!o.n) return { n: 0, mean: 0, t: 0 }; const v = [...o.months.values()], m = v.reduce((x, y) => x + y, 0) / v.length;
  const sd = v.length > 1 ? Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / (v.length - 1)) : 0;
  return { n: o.n, mean: +(o.sum / o.n).toFixed(4), t: sd > 0 ? +(m / (sd / Math.sqrt(v.length))).toFixed(2) : 0, win: +(100 * o.wins / o.n).toFixed(1), months: v.length };
}
const pOne = (t) => { const z = Math.abs(t) / Math.SQRT2, k = 1 / (1 + 0.3275911 * z), erf = 1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-z * z), p = 0.5 * (1 - erf); return t > 0 ? p : 1 - p; };
export const groupOf = (g) => [g.mk, g.trig.map((t) => t.kind + (t.follow === undefined ? '' : t.follow ? '+' : '-')).join('&'), g.side].join('|');

// ─── the worker ───
export async function run(worker, outDir, minutes, cacheDir) {
  const t0 = Date.now(), LANE = +(process.env.LANE || 0), file = path.join(outDir, `worker-${worker}${LANE ? '-' + LANE : ''}.json`);   // lane 0 = the file as before; lanes 1-3 are extra processes of one worker on the same runner (only the seed and the file differ)
  fs.mkdirSync(outDir, { recursive: true });
  let S = { version: VERSION, worker, started: new Date().toISOString(), tries: 0, survivedA: 0, candidates: 0, cLooks: 0, cPasses: 0, groups: {}, leads: [], looks: [], results: [], chunks: 0 };
  try { const prev = JSON.parse(fs.readFileSync(file, 'utf8')); if (prev.version === VERSION) S = { results: [], ...prev, chunks: prev.chunks + 1 }; } catch {}
  const MY = worker === NQ_WORKER ? ['nas100'] : MS_MARKETS, D = {}; for (const mk of MY) { try { D[mk] = await loadMarket(mk, cacheDir); console.log(mk, D[mk].n, 'H1 bars'); } catch (e) { console.log(mk, 'no data', e.message); } }
  const have = MY.filter((m) => D[m] && D[m].n > 5000); if (!have.length) throw new Error('no candles');
  const r = rng(worker * 1000003 + LANE * 104729000 + S.chunks * 7919 + (Date.now() % 100000)), save = () => { S.updated = new Date().toISOString(); fs.writeFileSync(file + '.tmp', JSON.stringify(S, null, 1)); fs.renameSync(file + '.tmp', file); };
  let lastSave = Date.now();
  while (Date.now() - t0 < minutes * 60e3) {
    for (let q = 0; q < 200; q++) {
      const g = genome2(r, worker); if (!D[g.mk]) continue; const d = D[g.mk]; S.tries++;
      const sa = summary(simulate(d, g, d.idx2.A[0], d.idx2.A[1]));
      if (sa.n < BAR2.A.n || !(sa.mean > 0) || sa.t < BAR2.A.t) continue;
      S.survivedA++;
      const pl = summary(simulate(d, g, d.idx2.A[0], d.idx2.A[1], true)); if (!(pl.mean < 0)) continue;
      S.candidates++; const grp = group2(g); if (S.groups[grp]) { S.groups[grp].more++; continue; }
      const sc = summary(simulate(d, g, d.idx2.C[0], d.idx2.C[1])), all = summary(simulate(d, g, d.idx2.A[0], d.n)); S.cLooks++;
      const p = sc.n >= 2 ? pOne(sc.t) : 1, look = { at: new Date().toISOString(), group: grp, g, A: sa, placeboA: pl, C: sc, ALL: all, p: +p.toFixed(5) };
      const pass = resultOk(look); S.groups[grp] = { more: 0, pass }; if (pass) S.cPasses++;
      S.looks.push(look); if (S.looks.length > 300) S.looks.shift();
      if (pass) { S.results.push(look); S.results.sort((x, y) => y.ALL.t - x.ALL.t); if (S.results.length > 200) S.results.length = 200; }
    }
    if (Date.now() - lastSave > 60e3) { save(); lastSave = Date.now(); console.log(`worker ${worker}: ${S.tries} tries, ${S.survivedA} survive the search, ${S.cLooks} checks, ${S.cPasses} results`); }
  }
  save(); return S;
}

// every worker's file in one dir -> the totals and the leads (a C pass that also clears Holm over every C look made)
export const resultOk = (l) => l.C.n >= BAR2.C.n && l.C.mean > 0 && l.C.t >= BAR2.C.t && l.ALL.t >= BAR2.ALL.t;
export function report(dir) {
  const W = fs.readdirSync(dir).filter((f) => /^worker-\d+(-\d+)?\.json$/.test(f)).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))).filter((w) => w.version === VERSION);
  const T = { version: VERSION, workers: W.length, tries: 0, survivedA: 0, candidates: 0, cLooks: 0, cPasses: 0 }, looks = [], res = new Map(), ps = [];
  for (const w of W) { T.tries += w.tries; T.survivedA += w.survivedA; T.candidates += w.candidates; T.cLooks += w.cLooks; T.cPasses += w.cPasses || 0;
    for (const l of w.looks) { looks.push({ ...l, worker: w.worker }); ps.push(l.p); }
    for (const l of w.results || []) if (!res.has(l.group) || res.get(l.group).ALL.t < l.ALL.t) res.set(l.group, { ...l, worker: w.worker }); }
  // Holm over every check look made (the files keep the last 300 looks each: the count is T.cLooks, the p values those on file)
  ps.sort((a, b) => a - b); const m = Math.max(T.cLooks, ps.length), holm = (p) => Math.min(1, p * (m - Math.max(0, ps.indexOf(p))));
  const results = [...res.values()].sort((a, b) => b.ALL.t - a.ALL.t).map((l) => ({ ...l, holm: holm(l.p) }));
  const leads = results.filter((l) => l.C.n >= BAR2.LEAD.n && l.C.t >= BAR2.LEAD.t && l.holm < 0.05);
  return { ...T, note: 'a result clears t >= 1 in 2021-23, in 2024-now and over 2021-now: about one random rule in forty does by luck', results, leads, bestLooks: results.slice(0, 10) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, a, b, c] = process.argv.slice(2), here = path.dirname(fileURLToPath(import.meta.url));
  if (cmd === 'run') { await run(+a, b, +(c || 300), process.env.RESEARCH_CACHE || path.join(process.env.RUNNER_TEMP || '/tmp', 'auto-cache')); }
  else if (cmd === 'report') { const R = report(a); console.log(JSON.stringify({ ...R, results: R.results.length, leads: R.leads.length, bestLooks: R.results.slice(0, 25).map((l) => [l.group, 'search', l.A.n, l.A.mean, l.A.t, 'check', l.C.n, l.C.mean, l.C.t, 'all', l.ALL.n, l.ALL.mean, l.ALL.t, +l.holm.toFixed(3)]) }, null, 1)); }
  else if (cmd === 'bench') {
    const d = await loadMarket('xau', '/tmp/auto-cache'), r = rng(1), n = +(b || 300), t0 = Date.now(); let ok = 0;
    for (let i = 0; i < n; i++) { const g = genome2(r, +a); g.mk = 'xau'; const s = summary(simulate(d, g, d.idx2.A[0], d.idx2.A[1])); if (s.n >= 100) ok++; }
    console.log(n, 'tries', ((Date.now() - t0) / n).toFixed(1), 'ms each;', ok, 'with 100+ trades;', d.n, 'bars');
  } else { console.log('run <worker> <outDir> [minutes] | bench <worker> [tries]'); process.exit(1); }
}
