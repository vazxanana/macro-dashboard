// Auto-researcher engine (PREREGISTRATION.md, 24 Nov 2026). Paper research only: nothing here trades or changes a rule.
//   node engine.mjs run <worker 1-5> <outDir> [minutes]   search until the time is up, writing <outDir>/worker-<k>.json
//   node engine.mjs bench <worker> [tries]                 time a few tries on the local candle cache
// Candles: H1 OANDA mid. EDGE_DATA (edgekit cache, 5-minute files) when present, else the site's /md/bars through MD_BASE.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';

export const VERSION = 'auto-1';
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy', 'xag'];
const UTC = (y, m = 0, d = 1) => Date.UTC(y, m, d) / 1000;
export const WIN = { A: [UTC(2005), UTC(2015)], B: [UTC(2015), UTC(2020)], C: [UTC(2020), Infinity] };
export const BAR = { A: { n: 250, mean: 0.04, t: 3.0 }, B: { n: 100, mean: 0, t: 1.5 }, C: { n: 100, mean: 0, t: 2.0 } };
export const FAMILY = { 1: ['brk', 'fade', 'eg'], 2: ['pull', 'dev'], 3: ['big', 'blk', 'sweep'], 4: ['brk', 'fade', 'pull', 'dev', 'big', 'blk', 'eg', 'sweep'], 5: ['wild'] };
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
const atrPct = (D) => cache(D, 'atrpct', () => { const a = atr(D), o = new Float64Array(D.n).fill(NaN), W = 500;
  for (let i = W; i < D.n; i++) { let r = 0, c = 0; for (let k = i - W; k < i; k += 5) { c++; if (a[k] < a[i]) r++; } o[i] = r / c; } return o; });
export function prep(D, mk) {
  D.mk = mk; D.ind = {}; D.hour = new Uint8Array(D.n); D.dow = new Uint8Array(D.n); D.month = new Int32Array(D.n);
  for (let i = 0; i < D.n; i++) { const d = new Date(D.t[i] * 1000); D.hour[i] = d.getUTCHours(); D.dow[i] = d.getUTCDay(); D.month[i] = d.getUTCFullYear() * 12 + d.getUTCMonth(); }
  D.cost = K.COSTS[mk];
  const find = (x) => { let lo = 0, hi = D.n; while (lo < hi) { const m = (lo + hi) >> 1; if (D.t[m] < x) lo = m + 1; else hi = m; } return lo; };
  D.idx = { A: [find(WIN.A[0]), find(WIN.A[1])], B: [find(WIN.B[0]), find(WIN.B[1])], C: [find(WIN.C[0]), D.n] };
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
export function genome(r, worker) {
  const fam = FAMILY[worker], kinds = fam[0] === 'wild' ? [pick(r, ALLK), pick(r, ALLK)] : [pick(r, fam)];
  const h0 = r() < 0.5 ? null : pick(r, SPACE.hours);
  return { mk: pick(r, MARKETS), trig: kinds.map((k) => trigger(r, k)), side: pick(r, ['both', 'both', 'long', 'short']),
    hours: h0 == null ? null : [h0, (h0 + pick(r, [1, 2, 3, 4, 6, 8, 12])) % 24], dows: r() < 0.7 ? null : pick(r, [[1, 2, 3, 4, 5], [1, 2, 3], [2, 3, 4], [3, 4, 5], [1, 5]]),
    trend: pick(r, ['none', 'none', 'with', 'against']), vol: pick(r, ['none', 'none', 'low', 'high']), volP: pick(r, SPACE.atrPct),
    stop: pick(r, SPACE.stop), rr: pick(r, SPACE.rr), hold: pick(r, SPACE.hold) };
}
// one trigger: +1 long, -1 short, 0 none, at the close of bar i
function sig(D, tr, i) {
  switch (tr.kind) {
    case 'brk': { const H = hiN(D, tr.N)[i], L = loN(D, tr.N)[i]; return D.c[i] > H ? 1 : D.c[i] < L ? -1 : 0; }
    case 'fade': { const H = hiN(D, tr.N)[i], L = loN(D, tr.N)[i]; return D.c[i] > H ? -1 : D.c[i] < L ? 1 : 0; }
    case 'pull': { const f = maOf(D, tr.fast)[i], sl = maOf(D, tr.slow)[i], q = rsi(D)[i]; if (!(f === f && sl === sl && q === q)) return 0;
      const lo = tr.rsi < 50 ? tr.rsi : 100 - tr.rsi; return f > sl && q <= lo ? 1 : f < sl && q >= 100 - lo ? -1 : 0; }
    case 'big': { const a = atr(D)[i - 1], rg = D.h[i] - D.l[i]; if (!(a > 0) || rg < tr.k * a) return 0; const dir = D.c[i] > D.o[i] ? 1 : D.c[i] < D.o[i] ? -1 : 0; return tr.follow ? dir : -dir; }
    case 'blk': { if (D.hour[i] !== tr.at) return 0; let H = -Infinity, L = Infinity; for (let k = i - tr.H; k < i; k++) { if (k < 0) return 0; if (D.h[k] > H) H = D.h[k]; if (D.l[k] < L) L = D.l[k]; }
      const up = D.c[i] > H ? 1 : D.c[i] < L ? -1 : 0; return tr.follow ? up : -up; }
    case 'dev': { const m = maOf(D, tr.n)[i], a = atr(D)[i]; if (!(m === m && a > 0)) return 0; const z = (D.c[i] - m) / a; const dir = z > tr.z ? 1 : z < -tr.z ? -1 : 0; return tr.follow ? dir : -dir; }
    case 'eg': { // the nearest opposite candle within the 3 before: this close is the first to go beyond its high / low
      let dir = 0;
      for (let b = i - 1; b >= i - 3 && b >= 1 && !dir; b--) {
        const bull = D.c[b] > D.o[b], bear = D.c[b] < D.o[b];
        if (bear && D.c[i] > D.h[b]) { let first = true; for (let k = b + 1; k < i; k++) if (D.c[k] > D.h[b]) first = false; if (first) dir = 1; if (bear) break; }
        else if (bull && D.c[i] < D.l[b]) { let first = true; for (let k = b + 1; k < i; k++) if (D.c[k] < D.l[b]) first = false; if (first) dir = -1; if (bull) break; }
        else if (bear || bull) { if ((bear && D.c[i] <= D.h[b]) || (bull && D.c[i] >= D.l[b])) break; }
      }
      return tr.follow ? dir : -dir; }
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
    if (!passes(D, g, i)) continue;
    const side = flip ? -s : s, entry = D.o[i + 1], dist = g.stop * A, stop = entry - side * dist, tgt = g.rr > 0 ? entry + side * g.rr * dist : null;
    if (!(dist > 0) || D.cost / dist > 0.5) continue;                                  // a stop smaller than twice the cost is no trade
    let ex = null, j = i + 1;
    for (; j <= i + g.hold && j < D.n; j++) {
      const o = j === i + 1 ? entry : D.o[j];
      if (side > 0 ? o <= stop : o >= stop) { ex = o; break; }                          // a candle that opens beyond the stop exits at its open
      if (side > 0 ? D.l[j] <= stop : D.h[j] >= stop) { ex = stop; break; }             // stop first when one candle holds both
      if (tgt != null && (side > 0 ? D.h[j] >= tgt : D.l[j] <= tgt)) { ex = tgt; break; }
    }
    if (ex == null) { j = Math.min(i + g.hold, D.n - 1); ex = D.c[j]; }
    const R = ((ex - entry) * side - D.cost) / dist; free = j + 1;
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
  const t0 = Date.now(), file = path.join(outDir, `worker-${worker}.json`); fs.mkdirSync(outDir, { recursive: true });
  let S = { version: VERSION, worker, started: new Date().toISOString(), tries: 0, survivedA: 0, candidates: 0, cLooks: 0, cPasses: 0, groups: {}, leads: [], looks: [], chunks: 0 };
  try { const prev = JSON.parse(fs.readFileSync(file, 'utf8')); if (prev.version === VERSION) S = { ...prev, chunks: prev.chunks + 1 }; } catch {}
  const D = {}; for (const mk of MARKETS) { try { D[mk] = await loadMarket(mk, cacheDir); console.log(mk, D[mk].n, 'H1 bars'); } catch (e) { console.log(mk, 'no data', e.message); } }
  const have = MARKETS.filter((m) => D[m] && D[m].n > 5000); if (!have.length) throw new Error('no candles');
  const r = rng(worker * 1000003 + S.chunks * 7919 + (Date.now() % 100000)), save = () => { S.updated = new Date().toISOString(); S.chanceCandidates = +(S.tries * 0.0013 * 0.07).toFixed(1); fs.writeFileSync(file + '.tmp', JSON.stringify(S, null, 1)); fs.renameSync(file + '.tmp', file); };
  let lastSave = Date.now();
  while (Date.now() - t0 < minutes * 60e3) {
    for (let q = 0; q < 200; q++) {
      const g = genome(r, worker); if (!D[g.mk]) continue; const d = D[g.mk]; S.tries++;
      const a = simulate(d, g, d.idx.A[0], d.idx.A[1]), sa = summary(a);
      if (sa.n < BAR.A.n || sa.mean < BAR.A.mean || sa.t < BAR.A.t) continue;
      S.survivedA++;
      const sb = summary(simulate(d, g, d.idx.B[0], d.idx.B[1]));
      if (sb.n < BAR.B.n || !(sb.mean > BAR.B.mean) || sb.t < BAR.B.t) continue;
      const pl = summary(simulate(d, g, d.idx.A[0], d.idx.A[1], true)); if (!(pl.mean < 0)) continue;
      S.candidates++; const grp = groupOf(g); if (S.groups[grp]) { S.groups[grp].more++; continue; }
      const sc = summary(simulate(d, g, d.idx.C[0], d.idx.C[1])); S.cLooks++;
      const p = sc.n >= 2 ? pOne(sc.t) : 1, look = { at: new Date().toISOString(), group: grp, g, A: sa, B: sb, placeboA: pl, C: sc, p: +p.toFixed(5) };
      S.groups[grp] = { more: 0, pass: sc.n >= BAR.C.n && sc.mean > 0 && sc.t >= BAR.C.t }; S.looks.push(look);
      if (S.looks.length > 400) S.looks.shift(); save();
      console.log('C look', grp, 'A', sa.mean, sa.t, 'B', sb.mean, sb.t, 'C', sc.n, sc.mean, sc.t);
    }
    if (Date.now() - lastSave > 60e3) { save(); lastSave = Date.now(); console.log(`worker ${worker}: ${S.tries} tries, ${S.survivedA} survive A, ${S.candidates} candidates, ${S.cLooks} C looks`); }
  }
  save(); return S;
}

// every worker's file in one dir -> the totals and the leads (a C pass that also clears Holm over every C look made)
export function report(dir) {
  const W = fs.readdirSync(dir).filter((f) => /^worker-\d+\.json$/.test(f)).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  const T = { workers: W.length, tries: 0, survivedA: 0, candidates: 0, cLooks: 0, cPasses: 0 }, looks = [];
  for (const w of W) { T.tries += w.tries; T.survivedA += w.survivedA; T.candidates += w.candidates; T.cLooks += w.cLooks; for (const l of w.looks) looks.push({ ...l, worker: w.worker }); }
  T.chanceCandidates = +(T.tries * 0.0013 * 0.07).toFixed(1);
  const ps = looks.map((l) => l.p).sort((a, b) => a - b), m = ps.length; looks.forEach((l) => { l.holm = Math.min(1, l.p * (m - ps.indexOf(l.p))); });
  const leads = looks.filter((l) => l.C.n >= BAR.C.n && l.C.mean > 0 && l.C.t >= BAR.C.t && l.holm < 0.05); T.cPasses = looks.filter((l) => l.C.n >= BAR.C.n && l.C.mean > 0 && l.C.t >= BAR.C.t).length;
  return { ...T, leads, bestLooks: [...looks].sort((a, b) => b.C.t - a.C.t).slice(0, 10) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, a, b, c] = process.argv.slice(2), here = path.dirname(fileURLToPath(import.meta.url));
  if (cmd === 'run') { await run(+a, b, +(c || 300), process.env.RESEARCH_CACHE || path.join(process.env.RUNNER_TEMP || '/tmp', 'auto-cache')); }
  else if (cmd === 'report') { const R = report(a); console.log(JSON.stringify({ ...R, leads: R.leads.length, bestLooks: R.bestLooks.map((l) => [l.group, l.A.mean, l.A.t, l.B.mean, l.C.n, l.C.mean, l.C.t, l.holm]) }, null, 1)); }
  else if (cmd === 'bench') {
    const d = await loadMarket('xau', '/tmp/auto-cache'), r = rng(1), n = +(b || 300), t0 = Date.now(); let ok = 0;
    for (let i = 0; i < n; i++) { const g = genome(r, +a); g.mk = 'xau'; const s = summary(simulate(d, g, d.idx.A[0], d.idx.A[1])); if (s.n >= 250) ok++; }
    console.log(n, 'tries', ((Date.now() - t0) / n).toFixed(1), 'ms each;', ok, 'with 250+ trades;', d.n, 'bars');
  } else { console.log('run <worker> <outDir> [minutes] | bench <worker> [tries]'); process.exit(1); }
}
