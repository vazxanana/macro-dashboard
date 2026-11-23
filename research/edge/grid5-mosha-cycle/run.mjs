// research/edge/grid5-mosha-cycle/run.mjs - grid 5 of PREREGISTRATION.md (23 Nov 2026): the Mosha storyline BO -> VR -> CF
// on D1>H4, H4>H1, H1>M15 with the market-cycle stage, a barrier, the return to the BO level and the CF's place against the VR.
// node research/edge/grid5-mosha-cycle/run.mjs market <market> <outDir>   one market: signals, simulations, cell month sums
// node research/edge/grid5-mosha-cycle/run.mjs report <outDir>            apply the pre-registered bar, write result.json
// Research only: imports edgekit, phase, combo-grid-2 (COSTS, exclusions), combo-grid-3 (egZones) and the page's structure
// functions through council/mosha-desk.mjs loadFns (read, never edited). Writes only to <outDir> and its own folder.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { readPhase } from '../_lib/phase.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { egZones } from '../combo-grid-3/run.mjs';
import { loadFns } from '../../../council/mosha-desk.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const CHAINS = [['1d', '4h'], ['4h', '1h'], ['1h', '15m']];
export const LOWER = { '4h': '1h', '1h': '15m', '15m': '5m' };
export const SEC = { '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 };
export const CAP = { '1d': 10 * 86400, '4h': 5 * 86400, '1h': 2 * 86400 };
export const N_BO = 6, N_LOW = 3, ATR_K = 0.1, EG_WAIT = 48, LIM_LIFE = 24;
export const CFTF = ['same', 'lower'];
export const STAGES = ['any', 'pullback', 'continuation'];
export const TRI = ['any', 'yes', 'no'];
export const INVR = ['any', 'clear', 'inside'];
export const ES = ['MKT-cfz', 'EG-cfz', 'EG-pb', 'LIM-cfz'];
export const EXITS = ['1R', '2R', '3R', 'VR', 'trail'];
export const DIMS = [CHAINS.length, CFTF.length, STAGES.length, TRI.length, TRI.length, INVR.length, ES.length, EXITS.length];
export const NCELL = DIMS.reduce((a, b) => a * b, 1); // 9,720
export const cellIndex = (v) => v.reduce((a, x, i) => a * DIMS[i] + x, 0);
export function cellName(c) {
  const v = []; for (let i = DIMS.length - 1; i >= 0; i--) { v[i] = c % DIMS[i]; c = Math.floor(c / DIMS[i]); }
  return { chain: CHAINS[v[0]].join('>'), cftf: CFTF[v[1]], stage: STAGES[v[2]], barrier: TRI[v[3]], back: TRI[v[4]], inVR: INVR[v[5]], entry: ES[v[6]], exit: EXITS[v[7]] };
}
export const Y0 = 2010, NM = 120, SPLIT_M = 60; // months 2010-01 .. 2019-12; discovery = first 60
export const monthOf = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - Y0) * 12 + d.getUTCMonth(); };

// ---- frames and the page's structure engine -------------------------------------------------------------------------
export function frames(M5) {
  return { '5m': M5, '15m': K.resample(M5, 900), '1h': K.resample(M5, 3600), '4h': K.resample(M5, 14400), '1d': K.dailyNY(M5) };
}
const conv = (B) => B.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));
// only dir, level, structure, fromIdx, breakIdx are read; k = the moment the break is known (close of its candle)
export function eventsOf(Fn, B, N) {
  return Fn.msAnalyze(conv(B), N).events.map((e) => ({ dir: e.dir, level: e.level, structure: e.structure === true, fromIdx: e.fromIdx, breakIdx: e.breakIdx, k: B[e.breakIdx].e }));
}
export function atr14(B) { const a = new Float64Array(B.length); let s = 0; const tr = (i) => Math.max(B[i].h - B[i].l, Math.abs(B[i].h - B[i - 1].c), Math.abs(B[i].l - B[i - 1].c));
  for (let i = 1; i < B.length; i++) { s += tr(i); if (i > 14) s -= tr(i - 14); a[i] = i >= 14 ? s / 14 : 0; } return a; }
const lb = (B, t) => { let lo = 0, hi = B.length; while (lo < hi) { const m = (lo + hi) >> 1; if (B[m].t < t) lo = m + 1; else hi = m; } return lo; }; // first index with t >= t
const lbK = (E, k) => { let lo = 0, hi = E.length; while (lo < hi) { const m = (lo + hi) >> 1; if (E[m].k <= k) lo = m + 1; else hi = m; } return lo; }; // first event with k > k

// zones of side d on the BO timeframe: { d, lo, hi, known, touchT (start of the first BO-timeframe candle trading into it), breakE }
export function zonesOf(Fn, H, AH) {
  const out = [];
  const z1 = Fn.msZones(conv(H), AH.map((e) => ({ dir: e.dir, fromIdx: e.fromIdx, breakIdx: e.breakIdx, kind: 'bo' })), H.length);
  for (const z of z1) out.push({ d: z.dir, lo: z.lo, hi: z.hi, known: H[z.breakIdx].e, touchT: z.touchIdx == null ? Infinity : H[z.touchIdx].t, breakE: z.brokenIdx == null ? Infinity : H[z.brokenIdx].e });
  for (const z of egZones(H, 3)) { let touchT = Infinity, breakE = Infinity;
    for (let j = z.i + 1; j < H.length && j <= z.i + 120; j++) { const b = H[j];
      if (touchT === Infinity && (z.d > 0 ? b.l <= z.top : b.h >= z.bot)) touchT = b.t;
      if (z.d > 0 ? b.c < z.bot : b.c > z.top) { breakE = b.e; break; } }
    out.push({ d: z.d, lo: z.bot, hi: z.top, known: z.at, touchT, breakE }); }
  return out.sort((a, b) => a.known - b.known);
}

// ---- the storylines of one chain ----------------------------------------------------------------------------------------
// returns signals { d, T (CF known), h, v, c, cfIdx, cfLevel, origin, x, L, stage, barrier, back, inVR, boK }
export function storylines(F, Fn, h, v, c, cache = {}) {
  const H = F[h], V = F[v], C = F[c];
  const AH = cache['ev' + h + N_BO] ||= eventsOf(Fn, H, N_BO);
  const AV = cache['ev' + v + N_LOW] ||= eventsOf(Fn, V, N_LOW);
  const AC = cache['ev' + c + N_LOW] ||= eventsOf(Fn, C, N_LOW);
  const Z = cache['z' + h] ||= zonesOf(Fn, H, AH);
  const phaseMemo = cache['ph' + h] ||= new Map();
  const out = [];
  for (let q = 0; q < AH.length; q++) {
    const e = AH[q], d = e.dir, L = e.level, kH = e.k, endK = q + 1 < AH.length ? AH[q + 1].k : Infinity, boStart = H[e.breakIdx].t;
    // VR
    let vr = null; for (let p = lbK(AV, kH); p < AV.length && AV[p].k < endK; p++) if (AV[p].dir === -d && AV[p].structure) { vr = AV[p]; break; }
    if (!vr) continue;
    let x = d > 0 ? -Infinity : Infinity, xi = -1;
    for (let j = lb(V, boStart); j <= vr.breakIdx && j < V.length; j++) { const p = d > 0 ? V[j].h : V[j].l; if (d > 0 ? p > x : p < x) { x = p; xi = j; } }
    if (xi < 0) continue;
    // CF
    let cf = null;
    for (let p = lbK(AC, vr.k); p < AC.length && AC[p].k < endK; p++) { const a = AC[p]; if (a.dir !== d) continue;
      if (d > 0 ? a.level >= x : a.level <= x) break; // the move went on beyond the VR's extreme
      if (a.structure) { cf = a; break; } }
    if (!cf) continue;
    const j0 = lb(C, V[vr.breakIdx].e); let hit = false;
    for (let j = j0; j <= cf.breakIdx; j++) if (d > 0 ? C[j].h >= x : C[j].l <= x) { hit = true; break; }
    if (hit) continue;
    let origin = d > 0 ? Infinity : -Infinity;
    for (let j = lb(C, V[xi].t); j <= cf.breakIdx; j++) { const p = d > 0 ? C[j].l : C[j].h; if (d > 0 ? p < origin : p > origin) origin = p; }
    if (!(d * (cf.level - origin) > 0)) continue;
    const T = cf.k;
    // factors
    let stage = phaseMemo.get(T);
    if (stage === undefined) { const bb = { [h]: H, [v]: V }; stage = readPhase(bb, T, { window: 300 }).tf[h].stage; phaseMemo.set(T, stage); }
    let back = false; for (let j = lb(C, V[vr.breakIdx].t); j <= cf.breakIdx; j++) if (d > 0 ? C[j].l <= L : C[j].h >= L) { back = true; break; }
    const xT = V[xi].t, hxT = H[Math.max(0, K.barAt(H, xT))].t;
    let barrier = false;
    for (let zi = lbKnown(Z, xT) - 1; zi >= 0 && !barrier; zi--) { const z = Z[zi]; if (z.known < xT - 250 * SEC[h]) break;
      if (z.d !== d) continue; if (!(z.touchT >= hxT)) continue; if (!(z.breakE > T)) continue;
      if (d > 0 ? origin <= z.hi : origin >= z.lo) barrier = true; }
    const boxLo = Math.min(x, vr.level), boxHi = Math.max(x, vr.level), zLo = Math.min(origin, cf.level), zHi = Math.max(origin, cf.level);
    const inVR = zHi >= boxLo && zLo <= boxHi;
    out.push({ d, T, h, v, c, cfIdx: cf.breakIdx, cfLevel: cf.level, origin, x, L, stage, barrier, back, inVR, boK: kH });
  }
  return out;
}
const lbKnown = (Z, t) => { let lo = 0, hi = Z.length; while (lo < hi) { const m = (lo + hi) >> 1; if (Z[m].known <= t) lo = m + 1; else hi = m; } return lo; };

// ---- entries ----------------------------------------------------------------------------------------------------------
// returns [{ es, type 'mkt'|'lim', t0 (the moment management starts: a market fill's close / a limit's placement), fill?, entry,
// stop, expire?, cancelT? }] (an entry that does not exist is left out)
export function entries(s, F, atrC, cost) {
  const C = F[s.c], d = s.d, i = s.cfIdx, a = atrC[i], out = [];
  if (!(a > 0)) return out;
  const cfz = s.origin - d * ATR_K * a;
  // MKT at the CF close
  { const fill = C[i].c; if (d * (fill - cfz) > 0) out.push({ es: 0, type: 'mkt', t0: C[i].e, fill, stop: cfz }); }
  // EG after a pullback into the CF zone
  { let k0 = -1, base = null;
    for (let j = i + 1; j < C.length && j <= i + EG_WAIT; j++) { const b = C[j];
      if (d > 0 ? b.c < s.origin : b.c > s.origin) break;          // the CF failed
      if (d > 0 ? b.h >= s.x : b.l <= s.x) break;                  // the move is done
      if (k0 < 0) { if (d > 0 ? b.l <= s.cfLevel : b.h >= s.cfLevel) k0 = j; else continue; }
      if (base && (d > 0 ? b.c > base.h : b.c < base.l)) {
        let pb = d > 0 ? Infinity : -Infinity; for (let q = k0; q <= j; q++) pb = d > 0 ? Math.min(pb, C[q].l) : Math.max(pb, C[q].h);
        const aj = atrC[j] > 0 ? atrC[j] : a, fill = b.c, sz = s.origin - d * ATR_K * aj, sp = pb - d * ATR_K * aj;
        if (d * (fill - sz) > 0) out.push({ es: 1, type: 'mkt', t0: b.e, fill, stop: sz, egT: b.e });
        if (d * (fill - sp) > 0) out.push({ es: 2, type: 'mkt', t0: b.e, fill, stop: sp, egT: b.e });
        break; }
      if (d > 0 ? b.c < b.o : b.c > b.o) base = b; } }
  // trade-through limit at the CF line
  { let cancelT = C[i].e + LIM_LIFE * SEC[s.c];
    for (let j = i + 1; j < C.length && j <= i + LIM_LIFE; j++) if (d > 0 ? C[j].c < s.origin : C[j].c > s.origin) { cancelT = Math.min(cancelT, C[j].e); break; }
    if (d * (s.cfLevel - cfz) > 0) out.push({ es: 3, type: 'lim', t0: C[i].e, entry: s.cfLevel, stop: cfz, cancelT, through: cost / 2 }); }
  return out;
}

// ---- one trade on 5m candles, five exits ------------------------------------------------------------------------------
// returns null (no fill, or the data ends first) or { fillT, exitT (last exit), risk, R: Float64Array(5) } before costs.
export function simulate(M5, o, d, x, cap) {
  let j = lb(M5, o.t0), fill, first = -1;
  if (o.type === 'mkt') { fill = o.fill; if (j >= M5.length) return null; }
  else {
    for (; j < M5.length; j++) { const b = M5[j]; if (b.t >= o.cancelT) return null;
      const lvl = o.entry - d * o.through;
      if (d > 0 ? b.l <= lvl : b.h >= lvl) { fill = d > 0 ? Math.min(b.o, o.entry) : Math.max(b.o, o.entry); first = j; break; }
      if (d > 0 ? b.h >= x : b.l <= x) return null; }                  // the move done before the fill
    if (first < 0) return null;
  }
  return manage(M5, j, first, fill, d, o.stop, x, cap);
}
// j = the first managed 5m candle; first = the fill candle of a limit (only the stop counts there), -1 for a market fill
export function manage(M5, j, first, fill, d, stop, x, cap) {
  const risk = d * (fill - stop);
  const R = new Float64Array(5), done = new Uint8Array(5); let left = 5;
  if (!(risk > 0)) return { instant: true }; // a limit filled at an open already past its stop: not built (counted)
  const xR = d * (x - fill) / risk; const lv = [1, 2, 3, xR > 0 ? xR : NaN];
  if (!(xR > 0)) { done[3] = 1; R[3] = NaN; left--; }
  const fin = (k, px) => { if (!done[k]) { done[k] = 1; R[k] = d * (px - fill) / risk; left--; } };
  let tStop = stop, best = fill, exitT = 0; const deadline = M5[j].t + cap;
  for (let q = j; q < M5.length && left; q++) { const b = M5[q], isFirst = q === first;
    const before = left;
    if (!isFirst) { // gaps at the open (never on a limit's fill candle)
      if (d * (b.o - stop) <= 0) for (let k = 0; k < 4; k++) fin(k, b.o);
      for (let k = 0; k < 4; k++) if (!done[k] && d * (b.o - (fill + d * lv[k] * risk)) >= 0) fin(k, b.o);
      if (!done[4] && d * (b.o - tStop) <= 0) fin(4, b.o); }
    const low = d > 0 ? b.l : b.h, high = d > 0 ? b.h : b.l;
    if (d * (low - stop) <= 0) for (let k = 0; k < 4; k++) fin(k, stop);
    if (!done[4] && d * (low - tStop) <= 0) fin(4, tStop);
    if (!isFirst) {
      for (let k = 0; k < 4; k++) if (!done[k] && d * (high - (fill + d * lv[k] * risk)) >= 0) fin(k, fill + d * lv[k] * risk);
      if (d * (high - best) > 0) best = high;
      if (!done[4] && d * (best - fill) >= risk) { const ns = best - d * risk; if (d * (ns - tStop) > 0) tStop = ns; } }
    if (b.e >= deadline) for (let k = 0; k < 5; k++) fin(k, b.c);
    if (left < before) exitT = b.e;
  }
  if (left) return null;
  return { fillT: M5[j].t, exitT, risk, fill, R };
}

// ---- one market -----------------------------------------------------------------------------------------------------
export function runMarket(market, { from = '2009-01-01', to = '2020-01-01', Fn = loadFns() } = {}) {
  const M5 = K.load(market, '5m', { from, to }); const F = frames(M5); const cost = COSTS[market];
  const bad = exclusions(market);
  const badHit = (a, b) => bad.some(([p, q]) => p <= b && q >= a);
  const atr = {}; for (const k of ['5m', '15m', '1h', '4h']) atr[k] = atr14(F[k]);
  const cache = {};
  const acc = { real: newAcc(), plac: newAcc() };
  let nsig = 0, ntr = 0, nbad = 0, gateFail = 0;
  for (let ci = 0; ci < CHAINS.length; ci++) { const [h, v] = CHAINS[ci];
    for (let fi = 0; fi < 2; fi++) { const c = fi ? LOWER[v] : v;
      const S = storylines(F, Fn, h, v, c, cache); nsig += S.length;
      for (const s of S) {
        const st = s.stage === 'pullback' ? 1 : s.stage === 'continuation' ? 2 : 0;
        for (const o of entries(s, F, atr[c], cost)) {
          const r = simulate(M5, o, s.d, s.x, CAP[h]); if (!r) continue;
          if (r.instant || !(r.risk > 0) || !(s.d * (r.fill - o.stop) > 0)) { gateFail++; continue; }
          const m = monthOf(r.fillT); if (m < 0 || m >= NM) continue;
          if (badHit(r.fillT, r.exitT)) { nbad++; continue; }
          ntr++;
          const pl = placebo(M5, o, s, r);
          add(acc.real, [ci, fi, st, s.barrier ? 1 : 2, s.back ? 1 : 2, s.inVR ? 2 : 1, o.es], m, r.R, cost / r.risk);
          if (pl) add(acc.plac, [ci, fi, st, s.barrier ? 1 : 2, s.back ? 1 : 2, s.inVR ? 2 : 1, o.es], m, pl.R, cost / pl.risk);
        }
      }
    }
  }
  return { market, nsig, ntr, nbad, gateFail, acc };
}
// the placebo trade: the same fill moment and price, the other side, the stop and the VR target mirrored
export function placebo(M5, o, s, r) {
  const fillPx = r.fill, j = lb(M5, r.fillT);
  const stop = 2 * fillPx - o.stop, x = 2 * fillPx - s.x;
  const p = manage(M5, j, o.type === 'mkt' ? -1 : j, fillPx, -s.d, stop, x, CAP[s.h]);
  return p && !p.instant ? p : null;
}
function newAcc() { return { n: new Uint32Array(NCELL * 2), g: new Float64Array(NCELL * NM), net: new Float64Array(NCELL * NM) }; }
function add(A, base, m, R, cr) {
  const [ci, fi, st, ba, bk, iv, es] = base;
  const stL = st ? [0, st] : [0], baL = [0, ba], bkL = [0, bk], ivL = [0, iv];
  for (const a of stL) for (const b of baL) for (const cc of bkL) for (const dd of ivL) for (let x = 0; x < 5; x++) {
    const R0 = R[x]; if (!Number.isFinite(R0)) continue;
    const c = cellIndex([ci, fi, a, b, cc, dd, es, x]);
    A.n[c * 2 + (m < SPLIT_M ? 0 : 1)]++; A.g[c * NM + m] += R0; A.net[c * NM + m] += R0 - cr;
  }
}
export function save(dir, out) {
  fs.mkdirSync(dir, { recursive: true });
  const enc = (a) => Buffer.from(a.buffer).toString('base64');
  const body = { market: out.market, nsig: out.nsig, ntr: out.ntr, nbad: out.nbad, gateFail: out.gateFail,
    real: { n: enc(out.acc.real.n), g: enc(out.acc.real.g), net: enc(out.acc.real.net) }, plac: { n: enc(out.acc.plac.n), g: enc(out.acc.plac.g), net: enc(out.acc.plac.net) } };
  fs.writeFileSync(path.join(dir, out.market + '.json.gz'), zlib.gzipSync(JSON.stringify(body)));
}
function loadOne(dir, m) {
  const j = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, m + '.json.gz'))).toString());
  const dec = (s, T) => { const b = Buffer.from(s, 'base64'); return new T(b.buffer, b.byteOffset, b.byteLength / T.BYTES_PER_ELEMENT); };
  const one = (x) => ({ n: dec(x.n, Uint32Array), g: dec(x.g, Float64Array), net: dec(x.net, Float64Array) });
  return { ...j, real: one(j.real), plac: one(j.plac) };
}

// ---- statistics -----------------------------------------------------------------------------------------------------
export function mstat(arr, off, a, b) { let n = b - a, s = 0, q = 0; for (let m = a; m < b; m++) { s += arr[off + m]; q += arr[off + m] ** 2; }
  const mean = s / n, sd = Math.sqrt(Math.max(0, (q - n * mean * mean) / (n - 1))); return { sum: s, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : 0 }; }
function evalGrid(A, label) {
  const rows = [];
  for (let c = 0; c < NCELL; c++) { const n1 = A.n[c * 2], n2 = A.n[c * 2 + 1]; if (n1 < 100) continue;
    const d = mstat(A.g, c * NM, 0, SPLIT_M); const mean1 = d.sum / n1;
    rows.push({ c, n1, mean1, t1: d.t, n2, eligible: true }); }
  const disc = rows.filter((r) => r.mean1 > 0 && r.t1 >= 2);
  for (const r of disc) { const k = mstat(A.g, r.c * NM, SPLIT_M, NM); r.mean2 = r.n2 ? k.sum / r.n2 : null; r.t2 = k.t; r.p2 = K.pFromT(k.t, SPLIT_M - 1) ?? 1;
    const kn = mstat(A.net, r.c * NM, SPLIT_M, NM), kn1 = mstat(A.net, r.c * NM, 0, SPLIT_M); r.net1 = kn1.sum / r.n1; r.net2 = r.n2 ? kn.sum / r.n2 : null; r.tNet2 = kn.t; }
  const adj = K.holm(disc.map((r) => r.p2)); disc.forEach((r, i) => { r.holm = adj[i]; r.pass = r.n2 >= 50 && r.mean2 > 0 && r.t2 > 0 && r.holm <= 0.05; });
  return { label, eligible: rows.length, discovery: disc.length, expectedByChance: +(rows.length * 0.023).toFixed(1), confirmed: disc.filter((r) => r.pass).length, disc };
}
export function report(dir) {
  const per = MARKETS.map((m) => loadOne(dir, m));
  const pool = (kind) => { const A = { n: new Uint32Array(NCELL * 2), g: new Float64Array(NCELL * NM), net: new Float64Array(NCELL * NM) };
    for (const p of per) for (const k of ['n', 'g', 'net']) { const s = p[kind][k]; for (let i = 0; i < s.length; i++) A[k][i] += s[i]; } return A; };
  // one Holm family per run (all scopes together), as one grid
  const scopes = [...MARKETS.map((m, i) => ({ scope: m, real: per[i].real, plac: per[i].plac })), { scope: 'pooled', real: pool('real'), plac: pool('plac') }];
  const fam = (kind) => { const all = []; const by = scopes.map((s) => { const g = evalGrid(s[kind], s.scope); g.disc.forEach((r) => { r.scope = s.scope; all.push(r); }); return g; });
    const adj = K.holm(all.map((r) => r.p2)); all.forEach((r, i) => { r.holm = adj[i]; r.pass = r.n2 >= 50 && r.mean2 > 0 && r.t2 > 0 && r.holm <= 0.05; });
    return { by, all }; };
  const R = fam('real'), P = fam('plac');
  const fmt = (r) => ({ scope: r.scope, ...cellName(r.c), discovery: { n: r.n1, meanR: +r.mean1.toFixed(4), tMonth: +r.t1.toFixed(2), netR: +r.net1.toFixed(4) },
    confirmation: { n: r.n2, meanR: r.mean2 == null ? null : +r.mean2.toFixed(4), tMonth: +r.t2.toFixed(2), netR: r.net2 == null ? null : +r.net2.toFixed(4), tNet: +r.tNet2.toFixed(2), holm: +r.holm.toPrecision(3) }, pass: r.pass });
  const sum = (G) => ({ eligible: G.by.reduce((a, b) => a + b.eligible, 0), discovery: G.all.length, expectedByChance: +(G.by.reduce((a, b) => a + b.eligible, 0) * 0.023).toFixed(1),
    confirmed: G.all.filter((r) => r.pass).length, confirmedRaw: G.all.filter((r) => r.n2 >= 50 && r.mean2 > 0 && r.t2 >= 2).length,
    byScope: Object.fromEntries(G.by.map((g) => [g.label, { eligible: g.eligible, discovery: g.disc.length, confirmed: g.disc.filter((r) => r.pass).length }])) });
  const real = sum(R), plac = sum(P);
  const top = [...R.all].sort((a, b) => b.t2 - a.t2).slice(0, 25).map(fmt);
  const best = [...R.all].sort((a, b) => (b.pass - a.pass) || b.t2 - a.t2)[0];
  // the plain storyline (every filter 'any'), pooled, before costs, real and placebo, both periods
  const A = scopes[scopes.length - 1], base = [];
  for (let ci = 0; ci < CHAINS.length; ci++) for (let fi = 0; fi < 2; fi++) for (let es = 0; es < ES.length; es++) for (const x of [1, 4]) {
    const c = cellIndex([ci, fi, 0, 0, 0, 0, es, x]); const row = { chain: CHAINS[ci].join('>'), cftf: CFTF[fi], entry: ES[es], exit: EXITS[x] };
    for (const [k, G] of [['real', A.real], ['placebo', A.plac]]) for (const [p2, a, b] of [['disc', 0, SPLIT_M], ['conf', SPLIT_M, NM]]) {
      const n = G.n[c * 2 + (a ? 1 : 0)], m = mstat(G.g, c * NM, a, b), mn = mstat(G.net, c * NM, a, b);
      row[k + '_' + p2] = { n, meanR: n ? +(m.sum / n).toFixed(4) : null, tMonth: +m.t.toFixed(2), netR: n ? +(mn.sum / n).toFixed(4) : null }; }
    base.push(row); }
  return { baseline: base, per: per.map((p) => ({ market: p.market, storylines: p.nsig, trades: p.ntr, droppedBadData: p.nbad, gateFail: p.gateFail })), real, placebo: plac,
    confirmed: R.all.filter((r) => r.pass).map(fmt), topConfirmation: top, best: best ? fmt(best) : null };
}

// ---- cut test: a storyline known by a cut is the same when computed on candles cut there --------------------------------
export function cutFrames(M5, cut) {
  const F = frames(M5.filter((b) => b.e <= cut)); for (const k of Object.keys(F)) F[k] = F[k].filter((b) => b.e <= cut); return F;
}
export const sigKey = (s) => [s.h, s.v, s.c, s.d, s.T, s.cfLevel, s.origin, s.x, s.stage, s.barrier, s.back, s.inVR].join('|');
export function cutCheck(M5, Fn, cuts) {
  const Fw = frames(M5), cw = {}; let compared = 0, bad = 0;
  const whole = {}; for (const [h, v] of CHAINS) for (const c of [v, LOWER[v]]) whole[h + v + c] = storylines(Fw, Fn, h, v, c, cw);
  for (const cut of cuts) { const Fc = cutFrames(M5, cut), cc = {};
    for (const [h, v] of CHAINS) for (const c of [v, LOWER[v]]) {
      const a = whole[h + v + c].filter((s) => s.T <= cut).map(sigKey), b = storylines(Fc, Fn, h, v, c, cc).filter((s) => s.T <= cut).map(sigKey);
      compared += a.length; if (a.join('\n') !== b.join('\n')) bad++; } }
  return { cuts: cuts.length, compared, mismatches: bad };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { const t0 = Date.now(); const out = runMarket(a); save(b, out); console.log(a, out.nsig, 'storylines', out.ntr, 'trades', out.nbad, 'dropped', ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'report') { const R = report(a); fs.writeFileSync(path.join(a, 'report.json'), JSON.stringify(R, null, 1)); console.log(JSON.stringify({ real: R.real, placebo: R.placebo, best: R.best }, null, 1)); }
  else if (cmd === 'cut') { const M5 = K.load(a, '5m', { from: '2011-01-01', to: '2013-01-01' }); const r = K.rng(20261123), cuts = []; for (let i = 0; i < +(b || 30); i++) cuts.push(Math.floor(M5[20000].t + r() * (M5[M5.length - 1].t - M5[20000].t))); console.log(JSON.stringify({ market: a, ...cutCheck(M5, loadFns(), cuts) })); }
  else console.log('usage: run.mjs market <m> <dir> | report <dir> | cut <m> [n]');
}
