// research/edge/grid6-smc-market/run.mjs - PREREGISTRATION.md (23 Nov 2026): smart-money combinations (H4 / D1 point of
// interest, liquidity sweep, M15 / M5 confirmation, premium / discount, session) with a market entry or a trade-through limit
// at a gap's 50 %, 5 exits, on 2010-2019, judged before costs, with a side-flipped placebo.
//   node --max-old-space-size=6000 research/edge/grid6-smc-market/run.mjs market <m> <dir>   one market -> <dir>/<m>.json + .bin
//   node --max-old-space-size=6000 research/edge/grid6-smc-market/run.mjs cut <m> <dir>      the cut test (candles cut at 2015-01-01)
//   node research/edge/grid6-smc-market/run.mjs report <dir>                                  pool, the bar -> result.json
// Research only: imports edgekit, grid 3's zones, grid 2's costs / exclusions, smc-ob-fvg's order blocks and
// dom-trade-through's fill and management (never edited); writes only to <dir> and its own result.json. Places nothing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { buildZones } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { obZones, deathOf, atr14 } from '../smc-ob-fvg/run.mjs';
import { findFill, manage, startIdx } from '../dom-trade-through/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (n) => Date.UTC(n, 0, 1) / 1000;
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const START = y(2010), SPLIT = y(2015), END = y(2020);
export const MONTHS = (() => { const o = []; for (let yy = 2010; yy <= 2019; yy++) for (let m = 0; m < 12; m++) o.push(Date.UTC(yy, m, 1) / 1000); return o; })();
export const NM = MONTHS.length, IS_M = 60;
export const POIS = ['ob4', 'ob1d', 'fvg4', 'fvg1d', 'eg1d'];
export const LIQS = ['none', 'pd', 'asia', 'eq'];
export const CONFS = ['m15choch', 'm15ifvg', 'm15disp', 'm5choch', 'm5ifvg', 'm5disp'];
export const PDS = ['any', 'with'], SESS = ['any', 'lon', 'ny', 'other'], ENTRIES = ['mkt', 'lim50'], STOPS = ['swing', 'sweep'];
export const EXITS = ['1R', '2R', '3R', 'opp', 'trail'];
const SLOT = [0, 1, 2, 5, 6]; // manage()'s R slots of the five exits
export const P = { look: 12 * 3600, lookN: 156, eqTol: 0.1, eqLife: 10 * 86400, gapLife: 48, dispK: 1.5, swingN: 12, gapBack: 24, life: 12, cap: 86400 };
const NX = EXITS.length;
export const NCELL = POIS.length * LIQS.length * CONFS.length * PDS.length * SESS.length * ENTRIES.length * STOPS.length * NX; // 19,200 slots
export const cellIndex = (p, l, c, d, s, e, st, x) => (((((((p * LIQS.length + l) * CONFS.length + c) * PDS.length + d) * SESS.length + s) * ENTRIES.length + e) * STOPS.length + st) * NX + x);
export const valid = (k) => { const v = cellName(k); return !(v.liq === 'none' && v.stop === 'sweep'); };
export function cellName(k) {
  const x = k % NX; k = (k - x) / NX; const st = k % 2; k = (k - st) / 2; const e = k % 2; k = (k - e) / 2; const s = k % 4; k = (k - s) / 4;
  const d = k % 2; k = (k - d) / 2; const c = k % 6; k = (k - c) / 6; const l = k % 4; const p = (k - l) / 4;
  return { poi: POIS[p], liq: LIQS[l], conf: CONFS[c], pd: PDS[d], sess: SESS[s], entry: ENTRIES[e], stop: STOPS[st], exit: EXITS[x] };
}
export const NVALID = (() => { let n = 0; for (let k = 0; k < NCELL; k++) if (valid(k)) n++; return n; })();

const mIdx = (t) => { let lo = 0, hi = NM; while (lo < hi) { const m = (lo + hi) >> 1; if (MONTHS[m] <= t) lo = m + 1; else hi = m; } return lo - 1; };
const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
const lastLE = (arr, t, key) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m][key] <= t) lo = m + 1; else hi = m; } return lo - 1; };
export const sessionOf = (tc) => { const h = new Date(tc * 1000).getUTCHours(); return h >= 7 && h < 12 ? 1 : h >= 12 && h < 17 ? 2 : 3; };

// ---- frames (complete candles only) ------------------------------------------------------------------------------------
export function framesOf(M5) {
  const last = M5.length ? M5[M5.length - 1].e : 0, done = (B) => B.filter((b) => b.e <= last);
  return { M5, M15: done(K.resample(M5, 900)), H1: done(K.resample(M5, 3600)), H4: done(K.resample(M5, 14400)), D: done(K.dailyNY(M5)) };
}

// ---- points of interest ------------------------------------------------------------------------------------------------
// FVG zones of one chart: { d, bot, top, i, at, end }
export function gapZones(B) {
  const out = [];
  for (let i = 2; i < B.length; i++) {
    const d = B[i].l > B[i - 2].h ? 1 : B[i].h < B[i - 2].l ? -1 : 0; if (!d) continue;
    const bot = d > 0 ? B[i - 2].h : B[i].h, top = d > 0 ? B[i].l : B[i - 2].l; if (!(top > bot)) continue;
    out.push({ d, bot, top, i, at: B[i].e, end: deathOf(B, i, d, bot, top) });
  }
  return out;
}
export function poiZones(F) {
  const ob = (B) => obZones(B).map((z) => ({ ...z, end: deathOf(B, z.i, z.d, z.bot, z.top) }));
  const Z = [ob(F.H4), ob(F.D), gapZones(F.H4), gapZones(F.D), buildZones('eg', F.D).map((z) => ({ d: z.d, bot: z.bot, top: z.top, at: z.at, end: z.end }))];
  return Z.map((list) => list.filter((z) => z.top > z.bot).sort((a, b) => a.at - b.at));
}

// ---- liquidity sweeps on M15 -------------------------------------------------------------------------------------------
// sweeps[liq][side] = [{ t (sweep candle close), start (its open), level }] sorted by t. liq 1 pd, 2 asia, 3 eq.
export function sweepsOf(F) {
  const { M5, M15, H1, D } = F; const atrD = atr14(D);
  const out = [null, { 1: [], '-1': [] }, { 1: [], '-1': [] }, { 1: [], '-1': [] }];
  const pools = []; // { liq, s, level, from, until, used }
  const push = (liq, s, level, from, until) => { if (Number.isFinite(level)) pools.push({ liq, s, level, from, until, used: false }); };
  // pd pools
  for (let d = 1; d < D.length; d++) { push(1, 1, D[d - 1].l, D[d - 1].e, D[d].e); push(1, -1, D[d - 1].h, D[d - 1].e, D[d].e); }
  if (D.length) { const d = D.length; push(1, 1, D[d - 1].l, D[d - 1].e, Infinity); push(1, -1, D[d - 1].h, D[d - 1].e, Infinity); }
  // asia pools
  let i5 = 0; const firstDay = M5.length ? Math.floor(M5[0].t / 86400) * 86400 : 0, lastDay = M5.length ? M5[M5.length - 1].t : 0;
  for (let day = firstDay; day <= lastDay; day += 86400) {
    while (i5 < M5.length && M5[i5].t < day) i5++;
    let lo = Infinity, hi = -Infinity, j = i5, last = -1; for (; j < M5.length && M5[j].t < day + 7 * 3600; j++) { lo = Math.min(lo, M5[j].l); hi = Math.max(hi, M5[j].h); last = j; }
    if (last < 0 || M5[last].e > day + 7 * 3600) continue;
    push(2, 1, lo, day + 7 * 3600, day + 21 * 3600); push(2, -1, hi, day + 7 * 3600, day + 21 * 3600);
  }
  // equal highs / lows from H1 swings
  const sw = K.swings(H1, 3).sort((a, b) => a.ct - b.ct || a.i - b.i);
  const alive = { 1: [], '-1': [] }; // { price, t, ct, tol }
  let k15 = 0; const tradeThrough = (s, upTo) => { // remove candidate swings traded through by more than their tolerance
    for (; k15 < M15.length && M15[k15].e <= upTo; k15++) { const q = M15[k15];
      alive[1] = alive[1].filter((a) => !(q.l < a.price - a.tol)); alive[-1] = alive[-1].filter((a) => !(q.h > a.price + a.tol)); }
  };
  for (const w of sw) {
    tradeThrough(0, w.ct);
    const dc = K.closedCount(D, w.ct) - 1; if (dc < 15) continue; const tol = P.eqTol * atrD[dc];
    const s = w.type === 'L' ? 1 : -1, list = alive[s];
    for (const a of list) if (w.ct - a.ct <= P.eqLife && Math.abs(a.price - w.price) <= tol) {
      push(3, s, s > 0 ? Math.min(a.price, w.price) : Math.max(a.price, w.price), w.ct, w.ct + P.eqLife); }
    list.push({ price: w.price, t: w.t, ct: w.ct, tol });
    alive[s] = list.filter((a) => w.ct - a.ct <= P.eqLife);
  }
  // walk M15 candles over pools
  pools.sort((a, b) => a.from - b.from); let pk = 0; let live = [];
  for (const q of M15) {
    while (pk < pools.length && pools[pk].from <= q.t) live.push(pools[pk++]);
    const keep = [];
    for (const p of live) {
      if (q.t >= p.until) continue;
      const through = p.s > 0 ? q.l < p.level : q.h > p.level;
      if (!through) { keep.push(p); continue; }
      if (p.s > 0 ? q.c > p.level : q.c < p.level) out[p.liq][p.s].push({ t: q.e, start: q.t, level: p.level });
    }
    live = keep;
  }
  for (const l of [1, 2, 3]) for (const s of [1, -1]) out[l][s].sort((a, b) => a.t - b.t);
  return out;
}

// ---- confirmations -----------------------------------------------------------------------------------------------------
// events of one chart: [{ j, s, kind 0 choch / 1 ifvg / 2 disp }] in time order
export function confirmations(C) {
  const ev = [];
  for (const e of K.structure(C, 3).events) if (e.kind === 'ChoCh') ev.push({ j: e.i, s: e.dir, kind: 0 });
  let gaps = []; // opposite gaps waiting for a close beyond the far side: { s (side of the signal), level, born }
  for (let j = 2; j < C.length; j++) {
    const keep = [];
    for (const g of gaps) { if (j - g.born > P.gapLife) continue;
      if (g.s > 0 ? C[j].c > g.level : C[j].c < g.level) { ev.push({ j, s: g.s, kind: 1 }); continue; } keep.push(g); }
    gaps = keep;
    if (C[j].h < C[j - 2].l) gaps.push({ s: 1, level: C[j - 2].l, born: j });        // a down gap: a buy when closed above its top
    if (C[j].l > C[j - 2].h) gaps.push({ s: -1, level: C[j - 2].h, born: j });       // an up gap: a sell when closed below its bottom
  }
  const A = atr14(C);
  for (let j = 15; j < C.length; j++) { const body = C[j].c - C[j].o; if (Math.abs(body) > P.dispK * A[j - 1] && A[j - 1] > 0) ev.push({ j, s: Math.sign(body), kind: 2 }); }
  return ev.sort((a, b) => a.j - b.j || a.kind - b.kind);
}

// the limit of lim50: the 50 % of the most recent same-side gap of chart C completed in [j-23, j], not reached since, on the near
// side of the close at j. Returns the price or null.
export function lim50Of(C, j, s) {
  let reach = s > 0 ? Infinity : -Infinity;
  for (let k = j; k >= Math.max(2, j - P.gapBack + 1); k--) {
    if (k < j) reach = s > 0 ? Math.min(reach, C[k + 1].l) : Math.max(reach, C[k + 1].h);
    const gap = s > 0 ? C[k].l > C[k - 2].h : C[k].h < C[k - 2].l; if (!gap) continue;
    const mid = s > 0 ? (C[k - 2].h + C[k].l) / 2 : (C[k].h + C[k - 2].l) / 2;
    if ((s > 0 ? reach > mid : reach < mid) && s * (C[j].c - mid) > 0) return mid;
  }
  return null;
}

// ---- trades of one market -------------------------------------------------------------------------------------------------
// sink(trade): { conf, s, tc, poi[] (touched kinds), sess, pdOk, swept { liq: extreme } , entry 0/1, stopKind 0/1, liq (sweep stop's
// liq or 0), t (fill), cr, R[5], pl: { t, cr, R[5] } | null }
export function tradesOf(M5, market, { start = START, end = END, X = [], sink }) {
  const F = framesOf(M5), cost = COSTS[market];
  const Z = poiZones(F), SW = sweepsOf(F);
  const sw4 = K.swings(F.H4, 3).sort((a, b) => a.ct - b.ct);
  const hiAt = new Float64Array(F.H4.length).fill(NaN), loAt = new Float64Array(F.H4.length).fill(NaN);
  { let k = 0, hi = NaN, lo = NaN; for (let n = 0; n < F.H4.length; n++) { while (k < sw4.length && sw4[k].ct <= F.H4[n].e) { const w = sw4[k++]; if (w.type === 'H') hi = w.price; else lo = w.price; } hiAt[n] = hi; loAt[n] = lo; } }
  const lo = new Float64Array(P.lookN + 1), hi = new Float64Array(P.lookN + 1);
  const charts = [[F.M15, 900], [F.M5, 300]];
  let made = 0;
  charts.forEach(([C, sec], ci) => {
    const ev = confirmations(C); let zp = Z.map(() => 0); const act = Z.map(() => []);
    for (const g of ev) {
      const tc = C[g.j].e, s = g.s; if (tc < start - 2 * 86400 || tc >= end) continue;
      if (X.length && inBad(X, tc)) continue;
      // POI touched in the last 12 hours
      const n5 = K.closedCount(M5, tc); if (n5 < P.lookN + 2) continue;
      lo[0] = Infinity; hi[0] = -Infinity; for (let q = 1; q <= P.lookN; q++) { const b = M5[n5 - q]; lo[q] = Math.min(lo[q - 1], b.l); hi[q] = Math.max(hi[q - 1], b.h); }
      const poi = [];
      for (let p = 0; p < Z.length; p++) {
        const L = Z[p]; while (zp[p] < L.length && L[zp[p]].at <= tc) act[p].push(L[zp[p]++]);
        act[p] = act[p].filter((z) => z.end > tc);
        for (const z of act[p]) { if (z.d !== s) continue;
          const kk = Math.min(P.lookN, n5 - startIdx(M5, Math.max(z.at, tc - P.look)), Math.floor(P.look / 300)); if (kk <= 0) continue;
          if (s > 0 ? lo[kk] <= z.top : hi[kk] >= z.bot) { poi.push(p); break; } }
      }
      if (!poi.length) continue;
      // liquidity sweeps
      const swept = {};
      for (const l of [1, 2, 3]) { const list = SW[l][s]; const k = lastLE(list, tc, 't'); if (k < 0) continue; const w = list[k];
        if (w.t <= tc - P.look) continue; const kk = n5 - startIdx(M5, w.start); if (kk <= 0 || kk > P.lookN) continue;
        swept[l] = s > 0 ? lo[kk] : hi[kk]; }
      // premium / discount, session, previous-day levels
      const n4 = K.closedCount(F.H4, tc) - 1; const mid = n4 >= 0 ? (hiAt[n4] + loAt[n4]) / 2 : NaN;
      const close = C[g.j].c, pdOk = Number.isFinite(mid) && (s > 0 ? close < mid : close > mid);
      const dc = K.closedCount(F.D, tc) - 1; if (dc < 1) continue; const pdh = F.D[dc].h, pdl = F.D[dc].l;
      const sess = sessionOf(tc);
      // stops
      let ext = s > 0 ? Infinity : -Infinity; for (let q = Math.max(0, g.j - P.swingN + 1); q <= g.j; q++) ext = s > 0 ? Math.min(ext, C[q].l) : Math.max(ext, C[q].h);
      const stops = [[0, 0, ext - s * cost / 2]]; for (const l of [1, 2, 3]) if (swept[l] != null) stops.push([1, l, swept[l] - s * cost / 2]);
      const lim = lim50Of(C, g.j, s), i0 = startIdx(M5, tc); if (i0 >= M5.length) continue;
      const oppR = (fill, risk, side) => { const lv = side > 0 ? pdh : pdl; const r = (side * (lv - fill)) / risk; return r >= 1 ? r : NaN; };
      const run = (fi, fill, stop, firstFull, side) => { const risk = side * (fill - stop); if (!(risk >= cost)) return null;
        const o = oppR(fill, risk, side); const r = manage(M5, side, fi, fill, stop, P.cap, firstFull, Number.isFinite(o) ? o : 2); if (!r) return null;
        const R = SLOT.map((q) => r.R[q]); if (!Number.isFinite(o)) R[3] = NaN; return { t: r.t, cr: cost / r.risk, R }; };
      for (const [stopKind, liq, stop] of stops) {
        for (let e = 0; e < 2; e++) {
          let ref, res = null;
          const expire = tc + P.life * sec;
          if (e === 0) { ref = close; if (!(s * (ref - stop) >= 2 * cost)) continue; res = run(i0, M5[i0].o, stop, true, s); }
          else { if (lim == null) continue; ref = lim; if (!(s * (ref - stop) >= 2 * cost)) continue;
            const f = findFill(M5, s, lim, stop, tc, expire, 'through', cost / 2); res = f ? run(f.i, f.fill, stop, false, s) : null; }
          if (!(s * (ref - stop) > 0)) throw new Error('stop on the wrong side');
          if (res && (res.t < start || res.t >= end || (X.length && inBad(X, res.t)))) res = null;
          // side-flipped placebo, decided at the order (never on the real trade's fill): mkt = a market trade of the other side
          // at the next open with the same stop distance; lim50 = a trade-through limit of the other side mirrored around the
          // tc close (2 x close - limit), the same stop distance, the same life. (Fixed 23 Nov 2026 after the first run: the
          // pre-registered wording made the placebo only when the real limit filled, which selects on later prices.)
          const dist = s * (ref - stop); let pres = null;
          if (e === 0) { const pf = M5[i0].o; pres = run(i0, pf, pf + s * dist, true, -s); }
          else { const pl0 = 2 * close - lim, ps = pl0 + s * dist; const f = findFill(M5, -s, pl0, ps, tc, expire, 'through', cost / 2); pres = f ? run(f.i, f.fill, ps, false, -s) : null; }
          const pl = pres && !(X.length && inBad(X, pres.t)) && pres.t >= start && pres.t < end ? pres : null;
          if (!res && !pl) continue;
          const tr = { conf: ci * 3 + g.kind, s, tc, poi, sess, pdOk, swept, entry: e, stopKind, liq, stop, t: res ? res.t : null, cr: res ? res.cr : null, R: res ? res.R : null, pl };
          sink(tr); if (res) made++;
        }
      }
    }
  });
  return made;
}

// ---- accumulation ----------------------------------------------------------------------------------------------------------
export function accumulator() {
  const A = { n: new Uint32Array(NCELL * 2), g: new Float64Array(NCELL * NM), c: new Float64Array(NCELL * NM),
    pn: new Uint32Array(NCELL * 2), pg: new Float64Array(NCELL * NM), pc: new Float64Array(NCELL * NM), trades: 0 };
  const put = (n, g, c, k, t, R, cr) => { const m = mIdx(t); if (m < 0 || m >= NM) return; const w = t >= SPLIT ? 1 : 0;
    if (!Number.isFinite(R)) return; n[k * 2 + w]++; g[k * NM + m] += R; c[k * NM + m] += cr; };
  A.add = (tr) => { if (tr.R) A.trades++;
    const liqs = tr.stopKind === 0 ? [0, ...Object.keys(tr.swept).map(Number)] : [tr.liq];
    const pds = tr.pdOk ? [0, 1] : [0], sess = [0, tr.sess];
    for (const p of tr.poi) for (const l of liqs) for (const d of pds) for (const se of sess) for (let x = 0; x < NX; x++) {
      const k = cellIndex(p, l, tr.conf, d, se, tr.entry, tr.stopKind, x);
      if (tr.R) put(A.n, A.g, A.c, k, tr.t, tr.R[x], tr.cr);
      if (tr.pl) put(A.pn, A.pg, A.pc, k, tr.pl.t, tr.pl.R[x], tr.pl.cr);
    } };
  return A;
}

export function mstat(ms, a, b) { const n = b - a; let s = 0, q = 0; for (let m = a; m < b; m++) { s += ms[m]; q += ms[m] * ms[m]; }
  const mean = s / n, sd = Math.sqrt(Math.max(0, (q - n * mean * mean) / (n - 1))); return { sum: s, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : 0 }; }
const p1 = (t, df) => { const p = K.pFromT(t, df); return p == null ? 1 : t > 0 ? p / 2 : 1 - p / 2; };

// the pre-registered bar. P = { market: accumulator-like { n, g, c } }; which = '' (real) or 'p' (placebo); basis 'before' | 'after'
export function bar(PM, basis, which = '', markets = MARKETS) {
  const N = which + 'n', G = which + 'g', Cc = which + 'c';
  const rows = [], ms = new Float64Array(NM);
  for (const sc of ['pool', ...markets]) { const list = sc === 'pool' ? markets : [sc];
    for (let k = 0; k < NCELL; k++) { if (!valid(k)) continue; let nI = 0, nO = 0; ms.fill(0);
      for (const m of list) { const A = PM[m]; nI += A[N][k * 2]; nO += A[N][k * 2 + 1]; if (!(A[N][k * 2] + A[N][k * 2 + 1])) continue;
        for (let q = 0; q < NM; q++) ms[q] += A[G][k * NM + q] - (basis === 'after' ? A[Cc][k * NM + q] : 0); }
      if (nI < 100) { rows.push({ sc, k, nI, nO }); continue; }
      const a = mstat(ms, 0, IS_M), b = mstat(ms, IS_M, NM);
      rows.push({ sc, k, nI, nO, isMean: a.sum / nI, isT: a.t, oosMean: nO ? b.sum / nO : null, oosT: b.t }); } }
  const disc = rows.filter((x) => x.nI >= 100 && x.isMean > 0 && x.isT >= 2);
  const ok = disc.filter((x) => x.nO >= 100), adj = K.holm(ok.map((x) => p1(x.oosT, NM - IS_M - 1)));
  ok.forEach((x, i) => { x.holm = adj[i]; x.raw = x.oosMean > 0 && x.oosT >= 2; x.pass = x.raw && x.holm < 0.05; });
  const raw = ok.filter((x) => x.raw), pass = ok.filter((x) => x.pass);
  const fmt = (x) => ({ scope: x.sc, ...cellName(x.k), isN: x.nI, isMean: +x.isMean.toFixed(4), isT: +x.isT.toFixed(2), oosN: x.nO,
    oosMean: x.oosMean == null ? null : +x.oosMean.toFixed(4), oosT: +x.oosT.toFixed(2), holm: x.holm == null ? null : +x.holm.toPrecision(3) });
  const by = (list) => { const o = {}; for (const key of ['poi', 'liq', 'conf', 'pd', 'sess', 'entry', 'stop', 'exit']) { o[key] = {}; for (const x of list) { const v = cellName(x.k)[key]; o[key][v] = (o[key][v] || 0) + 1; } } return o; };
  return { basis, which: which ? 'placebo' : 'real', tested: rows.length, withN100: rows.filter((x) => x.nI >= 100).length, discovery: disc.length,
    discoveryWithConf: ok.length, rawConfirmed: raw.length, expectedByChance: +(ok.length * 0.0228).toFixed(1), holmConfirmed: pass.length,
    discoveryBy: by(disc), rawBy: by(raw), confirmedList: pass.sort((a, b) => b.oosT - a.oosT).map(fmt), rawList: raw.sort((a, b) => b.oosT - a.oosT).slice(0, 40).map(fmt),
    topConfirmationT: ok.sort((a, b) => b.oosT - a.oosT).slice(0, 10).map(fmt), rows };
}

// pooled figures of every cell of one piece value, all windows (before / after costs), for the RESULT tables
export function pieceSummary(PM, markets = MARKETS) {
  const keys = ['poi', 'liq', 'conf', 'entry', 'stop', 'exit']; const out = {};
  // "base" slice: pd any, session any; then for each piece value sum trades over the other pieces (trades counted once per cell)
  for (const key of keys) { out[key] = {};
    for (let k = 0; k < NCELL; k++) { if (!valid(k)) continue; const v = cellName(k); if (v.pd !== 'any' || v.sess !== 'any') continue;
      const o = (out[key][v[key]] ||= { n: 0, g: 0, c: 0, pn: 0, pg: 0 });
      for (const m of markets) { const A = PM[m]; o.n += A.n[k * 2] + A.n[k * 2 + 1]; o.pn += A.pn[k * 2] + A.pn[k * 2 + 1];
        let g = 0, c = 0, pg = 0; for (let q = 0; q < NM; q++) { g += A.g[k * NM + q]; c += A.c[k * NM + q]; pg += A.pg[k * NM + q]; } o.g += g; o.c += c; o.pg += pg; } }
    for (const v of Object.keys(out[key])) { const o = out[key][v]; out[key][v] = { cellTrades: o.n, before: o.n ? +(o.g / o.n).toFixed(4) : null, after: o.n ? +((o.g - o.c) / o.n).toFixed(4) : null, placebo: o.pn ? +(o.pg / o.pn).toFixed(4) : null }; } }
  return out;
}

// one cell's figures (pooled or one market): both windows, before / after costs, and its placebo
export function cellStats(PM, k, markets = MARKETS) {
  const ms = { g: new Float64Array(NM), c: new Float64Array(NM), pg: new Float64Array(NM) }; let nI = 0, nO = 0, pI = 0, pO = 0;
  for (const m of markets) { const A = PM[m]; nI += A.n[k * 2]; nO += A.n[k * 2 + 1]; pI += A.pn[k * 2]; pO += A.pn[k * 2 + 1];
    for (let q = 0; q < NM; q++) { ms.g[q] += A.g[k * NM + q]; ms.c[q] += A.c[k * NM + q]; ms.pg[q] += A.pg[k * NM + q]; } }
  const net = ms.g.map((v, q) => v - ms.c[q]);
  const w = (arr, a, b, n) => { const x = mstat(arr, a, b); return { n, mean: n ? +(x.sum / n).toFixed(4) : null, t: +x.t.toFixed(2) }; };
  return { ...cellName(k), before: { '2010-14': w(ms.g, 0, IS_M, nI), '2015-19': w(ms.g, IS_M, NM, nO) },
    after: { '2010-14': w(net, 0, IS_M, nI), '2015-19': w(net, IS_M, NM, nO) },
    placebo: { '2010-14': w(ms.pg, 0, IS_M, pI), '2015-19': w(ms.pg, IS_M, NM, pO) } };
}
export const NAMED = [
  ['standard: H4 order block, previous-day sweep, M15 ChoCh, discount, limit at the gap 50 %, sweep stop, 2R', ['ob4', 'pd', 'm15choch', 'with', 'any', 'lim50', 'sweep', '2R']],
  ['London: H4 gap, Asia sweep, M5 ChoCh, discount, market, sweep stop, 2R', ['fvg4', 'asia', 'm5choch', 'with', 'lon', 'mkt', 'sweep', '2R']],
  ['Daily engulf zone, equal lows / highs swept, M15 inverse gap, market, swing stop, trail', ['eg1d', 'eq', 'm15ifvg', 'any', 'any', 'mkt', 'swing', 'trail']],
  ['Daily order block, M15 displacement, market, swing stop, previous-day target', ['ob1d', 'none', 'm15disp', 'any', 'any', 'mkt', 'swing', 'opp']],
];
export const named = (PM) => NAMED.map(([label, v]) => ({ label, ...cellStats(PM, cellIndex(POIS.indexOf(v[0]), LIQS.indexOf(v[1]), CONFS.indexOf(v[2]), PDS.indexOf(v[3]), SESS.indexOf(v[4]), ENTRIES.indexOf(v[5]), STOPS.indexOf(v[6]), EXITS.indexOf(v[7]))) }));

// ---- files --------------------------------------------------------------------------------------------------------------------
const ARR = ['n', 'g', 'c', 'pn', 'pg', 'pc'];
export function save(A, dir, market, meta) {
  fs.mkdirSync(dir, { recursive: true });
  for (const a of ARR) fs.writeFileSync(path.join(dir, `${market}.${a}.bin`), Buffer.from(A[a].buffer));
  fs.writeFileSync(path.join(dir, market + '.json'), JSON.stringify({ market, trades: A.trades, ...meta }));
}
export function loadAcc(dir, market) {
  const A = JSON.parse(fs.readFileSync(path.join(dir, market + '.json'), 'utf8'));
  for (const a of ARR) { const b = fs.readFileSync(path.join(dir, `${market}.${a}.bin`)); const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    A[a] = a.endsWith('n') ? new Uint32Array(ab) : new Float64Array(ab); }
  return A;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') {
    const t0 = Date.now(); const M5 = K.load(a, '5m', { from: '2009-01-01', to: '2020-01-01' });
    const A = accumulator(); const n = tradesOf(M5, a, { X: exclusions(a), sink: A.add });
    save(A, b, a, { bars: M5.length, seconds: Math.round((Date.now() - t0) / 1000) });
    console.log(a, n, 'trades', ((Date.now() - t0) / 1000).toFixed(0) + 's');
  } else if (cmd === 'cut') { // trades on candles cut at 2015-01-01 must equal the full run's trades that end before it
    const cut = SPLIT, X = exclusions(a);
    const full = K.load(a, '5m', { from: '2013-06-01', to: '2016-01-01' }), part = full.filter((x) => x.t < cut);
    const row = (tr) => [tr.conf, tr.s, tr.tc, tr.entry, tr.stopKind, tr.liq, tr.poi.join('+'), tr.sess, tr.pdOk ? 1 : 0, Object.keys(tr.swept).join('+'), tr.t, ...(tr.R || ['none']), ...(tr.pl ? [tr.pl.t, ...tr.pl.R] : [])]
      .map((v) => (typeof v === 'number' && Number.isFinite(v) ? +v.toPrecision(10) : String(v))).join(',');
    const lastE = part[part.length - 1].e; // the time limit must end inside the cut candles (gold closes early on 31 Dec)
    const safe = (tr) => tr.tc + P.life * 900 + P.cap + 3600 < lastE;
    const A = [], B = []; const from = Date.UTC(2014, 0, 1) / 1000;
    tradesOf(full, a, { start: from, end: cut, X, sink: (tr) => { if (safe(tr)) A.push(row(tr)); } });
    tradesOf(part, a, { start: from, end: cut, X, sink: (tr) => { if (safe(tr)) B.push(row(tr)); } });
    const cnt = new Map(); for (const x of B) cnt.set(x, (cnt.get(x) || 0) + 1); let same = 0, diff = 0;
    for (const x of A) { const c = cnt.get(x); if (c) { cnt.set(x, c - 1); same++; } else diff++; }
    const res = { market: a, cut: '2015-01-01', from: '2014-01-01', fullTrades: A.length, cutTrades: B.length, same, diff, ok: diff === 0 && A.length === B.length };
    fs.mkdirSync(b, { recursive: true }); fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify(res)); console.log(JSON.stringify(res));
  } else if (cmd === 'report') {
    const PM = {}, meta = {}; for (const m of MARKETS) { PM[m] = loadAcc(a, m); meta[m] = { trades: PM[m].trades, bars: PM[m].bars }; }
    const strip = ({ rows, ...rest }) => rest;
    const G = bar(PM, 'before'), N = bar(PM, 'after'), PG = bar(PM, 'before', 'p'), PN = bar(PM, 'after', 'p');
    const cuts = fs.readdirSync(a).filter((f) => f.startsWith('cut-')).map((f) => JSON.parse(fs.readFileSync(path.join(a, f), 'utf8')));
    const pieces = pieceSummary(PM), namedCells = named(PM);
    const verdict = G.withN100 < 100 ? 'INCONCLUSIVE' : G.holmConfirmed > 0 ? 'PASS' : 'FAIL';
    const res = { study: 'grid6-smc-market', built: '2026-11-23', verdict,
      basis: 'judged before costs (owner); after costs beside, same bar; side-flipped placebo through the same bar',
      window: { discovery: '2010-2014', confirmation: '2015-2019' }, markets: MARKETS, cellsPerScope: NVALID, params: P, meta, cuts,
      before: strip(G), after: strip(N), placeboBefore: strip(PG), placeboAfter: strip(PN), pieces, namedCells };
    const top = G.topConfirmationT[0];
    res.headline = `${verdict}: ${G.holmConfirmed} of ${G.tested} cells confirmed before costs after Holm (${G.discovery} discovery winners, ${G.rawConfirmed} raw confirmations against about ${G.expectedByChance} by chance; the side-flipped placebo ${PG.discovery} winners, ${PG.rawConfirmed} raw); after costs ${N.holmConfirmed} confirmed`
      + (top ? `; best confirmation month t ${top.oosT} (${top.scope} ${top.poi} ${top.liq} ${top.conf} ${top.entry} ${top.stop} ${top.exit}, n ${top.oosN}, ${top.oosMean}R).` : '.');
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
    console.log(JSON.stringify({ verdict, headline: res.headline, cuts }, null, 1));
  } else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
