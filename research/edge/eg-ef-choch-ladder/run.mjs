// research/edge/eg-ef-choch-ladder/run.mjs - engulf and failed-engulf zones with a ChoCh or EF turn down the ladder, as
// PREREGISTRATION.md (23 Nov 2026): 56 cells, two controls, ten markets, discovery 2005-14, confirmation 2015 to Oct 2026, judged
// before costs on month sums. Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/eg-ef-choch-ladder/run.mjs market <m> <outDir>   one market's accumulators
//   EDGE_DATA=<cache> node research/edge/eg-ef-choch-ladder/run.mjs cut <m> <outDir>      the cut test of one market
//   node research/edge/eg-ef-choch-ladder/run.mjs report <outDir>                         result.json + RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames, buildZones } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { dailyCalls, mstat, p1, welch, monthOf, NM, DM, FROM, SPLIT, TO, MARKETS, ASSUMED } from '../grid7-wide-core/run.mjs';
import { trade } from '../grid7-wide-eg-chain/run.mjs';
import { zones } from '../../../council/eg-methods.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export { MARKETS, ASSUMED };
export const LADDERS = [{ k: 'A', tfs: ['1d', '4h', '1h'], cap: 10 * 86400 }, { k: 'B', tfs: ['4h', '1h', '15m'], cap: 3 * 86400 }];
export const TURNS = ['choch', 'ef', 'either'], TRIGS = ['choch', 'ef', 'either'], EXITS = ['1R', '2R', '3R', 'opp'], CALLC = ['with', 'against'];
export const WIN = 24, ATRK = 0.1, KSW = 2, MATCH = 30 * 86400;
export const NC = 56, NMAIN = 48;
export const cellMain = (l, tu, tr, x) => ((l * 3 + tu) * 2 + tr) * 4 + x;          // tr 0 choch, 1 ef
export const cellCall = (l, cc, x) => NMAIN + (l * 2 + cc) * 2 + x;                 // x 0 1R, 1 2R; turn = trigger = either
export function cellName(i) {
  if (i < NMAIN) { const x = i % 4; let r = (i - x) / 4; const tr = r % 2; r = (r - tr) / 2; const tu = r % 3; const l = (r - tu) / 3;
    return { ladder: LADDERS[l].k, l, turn: TURNS[tu], trig: TRIGS[tr], exit: EXITS[x], call: 'all', x, tu, tr: tr, cc: -1 }; }
  const j = i - NMAIN, x = j % 2, r = (j - x) / 2, cc = r % 2, l = (r - cc) / 2;
  return { ladder: LADDERS[l].k, l, turn: 'either', trig: 'either', exit: EXITS[x], call: CALLC[cc], x, tu: 2, tr: 2, cc };
}
export const cname = (r) => `${r.ladder} turn ${r.turn} trig ${r.trig} ${r.exit}${r.call !== 'all' ? ' MSNR ' + r.call : ''}`;

const conv = (B) => B.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));
const lowerIdx = (B, t) => { let lo = 0, hi = B.length; while (lo < hi) { const m = (lo + hi) >> 1; if (B[m].t < t) lo = m + 1; else hi = m; } return lo; };
const firstAt = (arr, i0) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < i0) lo = m + 1; else hi = m; } return lo < arr.length ? arr[lo] : -1; };

// the last 2-a-side swing high / low confirmed before each candle closes (ci < j): prices, NaN when none
export function lastSwings(T) {
  const sw = K.swings(T, KSW).sort((a, b) => a.ci - b.ci), H = new Float64Array(T.length).fill(NaN), L = new Float64Array(T.length).fill(NaN);
  let h = NaN, l = NaN, k = 0;
  for (let j = 0; j < T.length; j++) { while (k < sw.length && sw[k].ci < j) { const s = sw[k++]; if (s.type === 'H') h = s.price; else l = s.price; } H[j] = h; L[j] = l; }
  return { H, L };
}
// EF events of one timeframe: an engulf zone of side dir closed through = an event of side -dir at the fail candle fi
export function efEvents(T, tf) {
  const ev = { 1: [], '-1': [] };
  for (const z of zones(conv(T), tf)) if (z.fi != null) ev[-z.dir].push({ i: z.i, fi: z.fi });
  for (const k of Object.keys(ev)) ev[k].sort((a, b) => a.fi - b.fi);
  return ev;
}
// the higher zones of a ladder: EG of side d and EF turned to d, { k, d, bot, top, at, end }
export function higherZones(Z) {
  return [...buildZones('eg', Z).map((z) => ({ k: 'eg', d: z.d, bot: z.bot, top: z.top, at: z.at, end: z.end })),
    ...buildZones('ef', Z).map((z) => ({ k: 'ef', d: z.d, bot: z.bot, top: z.top, at: z.at, end: z.end }))].sort((a, b) => a.at - b.at || a.d - b.d);
}
// near side of the nearest higher zone of the other side standing at t and ahead of px (zones sorted by at; life <= 30 days)
export function oppTarget(HZ, s, t, px) { let best = null; let lo = 0, hi = HZ.length; const a0 = t - 30 * 86400;
  while (lo < hi) { const m = (lo + hi) >> 1; if (HZ[m].at < a0) lo = m + 1; else hi = m; }
  for (let q = lo; q < HZ.length && HZ[q].at <= t; q++) { const o = HZ[q]; if (o.d !== -s || !(o.end > t)) continue; const p = s > 0 ? o.bot : o.top;
    if ((p - px) * s > 0 && (best == null || (p - px) * s < (best - px) * s)) best = p; }
  return best; }
// lowest 5-minute low (buy) / highest high (sell) from t0 (candle start) to t1 (candle end)
export function extreme(M5, s, t0, t1) { let x = s > 0 ? Infinity : -Infinity;
  for (let i = startIdx(M5, t0); i < M5.length && M5[i].e <= t1; i++) x = s > 0 ? Math.min(x, M5[i].l) : Math.max(x, M5[i].h);
  return Number.isFinite(x) ? x : null; }

// ---- the ladder prep and signals (closed candles only) ---------------------------------------------------------------------
export function prep(F) {
  const calls = dailyCalls(F), D = F['1d'];
  const callAt = (t) => { const i = K.closedCount(D, t) - 1; return i >= 0 ? calls[i] : 0; };
  const P = LADDERS.map((lad) => {
    const [zt, mt, lt] = lad.tfs, TM = F[mt], TL = F[lt];
    const st = K.structure(TL, KSW).events.filter((e) => e.kind === 'ChoCh');
    const choch = { 1: st.filter((e) => e.dir > 0).map((e) => e.i), '-1': st.filter((e) => e.dir < 0).map((e) => e.i) };
    const efL = efEvents(TL, lt), efLi = { 1: efL[1].map((e) => e.fi), '-1': efL[-1].map((e) => e.fi) };
    return { lad, HZ: higherZones(F[zt]), TM, TL, swM: lastSwings(TM), efM: efEvents(TM, mt), atrM: atr14(TM), chochL: choch, efL: efLi };
  });
  return { P, callAt };
}
// first lowest trigger of kind ('choch' | 'ef') and side s from candle index i0, inside [i0, i0 + WIN), before the zone breaks
function lowTrig(p, kind, s, i0, z) {
  const arr = (kind === 'choch' ? p.chochL : p.efL)[s], j = firstAt(arr, i0); if (j < 0 || j >= i0 + WIN) return -1;
  for (let q = i0; q < j; q++) if (s > 0 ? p.TL[q].c < z.bot : p.TL[q].c > z.top) return -1;
  return j;
}
// every setup: { l, s, zk, z, k (middle return), retT, turn: { choch, ef } middle indices, trig[turn][kind] lowest indices, stop... }
// returns signals [{ l, s, tu, tr, j (lowest index), ts (trigger close), tt (trigger start), retT, stop, call, zr }] and the zone returns
export function signals(F, M5) {
  const { P, callAt } = prep(F), sig = [], rets = [];
  P.forEach((p, l) => {
    const { TM, TL } = p;
    for (const z of p.HZ) {
      const s = z.d; let k = lowerIdx(TM, z.at);
      while (k < TM.length && TM[k].e <= z.end && !(s > 0 ? TM[k].l <= z.top : TM[k].h >= z.bot)) k++;
      if (k >= TM.length || TM[k].e > z.end) continue;
      const retT = TM[k].t, ak = p.atrM[k];
      // control (ii): market at the return candle's close
      if (ak > 0) { const x = extreme(M5, s, retT, TM[k].e); if (x != null) rets.push({ l, s, ts: TM[k].e, stop: x - s * ATRK * ak, call: callAt(TM[k].e) }); }
      // the turn on the middle timeframe
      let tc = -1, te = -1;
      for (let j = k; j < k + WIN && j < TM.length; j++) { if (j > k && (s > 0 ? TM[j - 1].c < z.bot : TM[j - 1].c > z.top)) break;
        const lv = s > 0 ? p.swM.H[j] : p.swM.L[j]; if (Number.isFinite(lv) && (s > 0 ? TM[j].c > lv : TM[j].c < lv)) { tc = j; break; } }
      const EM = p.efM[s]; let q0 = 0, q1 = EM.length; while (q0 < q1) { const m = (q0 + q1) >> 1; if (EM[m].fi < k) q0 = m + 1; else q1 = m; }
      for (let q = q0; q < EM.length; q++) { const e = EM[q]; if (e.fi >= k + WIN) break; if (e.i < k - WIN) continue;
        let broke = false; for (let q = k; q < e.fi; q++) if (s > 0 ? TM[q].c < z.bot : TM[q].c > z.top) { broke = true; break; }
        if (!broke) te = e.fi; break; }
      const turnIdx = [tc, te, tc < 0 ? te : te < 0 ? tc : Math.min(tc, te)];
      for (let tu = 0; tu < 3; tu++) { const ti = turnIdx[tu]; if (ti < 0) continue; const a = p.atrM[ti]; if (!(a > 0)) continue;
        const tClose = TM[ti].e, i0 = lowerIdx(TL, tClose);
        const jc = lowTrig(p, 'choch', s, i0, z), je = lowTrig(p, 'ef', s, i0, z);
        const tj = [jc, je, jc < 0 ? je : je < 0 ? jc : Math.min(jc, je)];
        for (let tr = 0; tr < 3; tr++) { const j = tj[tr]; if (j < 0) continue; if (tu !== 2 && tr === 2) continue;
          const ts = TL[j].e, x = extreme(M5, s, retT, ts); if (x == null) continue;
          sig.push({ l, s, tu, tr, kind: tr === 2 ? (j === jc ? 0 : 1) : tr, j, tt: TL[j].t, ts, retT, stop: x - s * ATRK * a, a, call: callAt(ts), zk: z.k }); }
      }
    }
  });
  return { sig, rets, P, callAt };
}

// ---- accumulators ------------------------------------------------------------------------------------------------------------
const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
export function newAcc() { return { ms: new Float64Array(NC * NM), msNet: new Float64Array(NC * NM), n: new Float64Array(NC * 2), sum: new Float64Array(NC * 2),
  sq: new Float64Array(NC * 2), net: new Float64Array(NC * 2), win: new Float64Array(NC * 2) }; }
function add(A, c, w, m, R, cr) { A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; A.n[c * 2 + w]++; A.sum[c * 2 + w] += R; A.sq[c * 2 + w] += R * R; A.net[c * 2 + w] += R - cr; if (R > 0) A.win[c * 2 + w]++; }

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5);
  const { sig, rets, P, callAt } = signals(F, M5);
  const cost = COSTS[market], X = exclusions(market);
  const real = newAcc(), plac = newAcc(), c1 = newAcc(), c2 = newAcc();
  const cnt = { signals: sig.length, rets: rets.length, trades: 0, dropped: 0, bad: 0, small: 0, ctl1: 0, ctl1None: 0, ctl2: 0, noOpp: 0 };
  // one market trade at the first 5m open after ts: { t, w, m, R[4], cr, fill, risk, fi } or null
  const run = (l, s, ts, stop) => {
    const fi = startIdx(M5, ts); if (fi >= M5.length) return null; const t = M5[fi].t; if (t < FROM || t >= TO) return null;
    if (X.length && inBad(X, t)) { cnt.dropped++; return null; }
    const fill = M5[fi].o, risk = s * (fill - stop); if (!(risk > 0)) { cnt.bad++; return null; }
    if (risk < cost) { cnt.small++; return null; }
    if (!(s * (fill - stop) > 0)) throw new Error('stop on the wrong side');
    let op = oppTarget(P[l].HZ, s, ts, fill); if (op != null && s * (op - fill) < risk) op = null; if (op == null) cnt.noOpp++;
    const tg = [fill + s * risk, fill + 2 * s * risk, fill + 3 * s * risk, op == null ? NaN : op];
    const r = trade(M5, s, 'mkt', null, stop, t, Infinity, tg, LADDERS[l].cap, 0, { fi, fill }); if (!r) return null;
    return { t, w: t < SPLIT ? 0 : 1, m: monthOf(t), R: r.R, cr: cost / risk, fill, risk, fi, tg };
  };
  const flip = (l, s, x) => { const s2 = -s, stop = x.fill - s2 * x.risk;
    const tg = x.tg.map((p) => (Number.isNaN(p) ? NaN : x.fill + s2 * (Math.abs(p - x.fill) / x.risk) * x.risk));
    const r = trade(M5, s2, 'mkt', null, stop, x.t, Infinity, tg, LADDERS[l].cap, 0, { fi: x.fi, fill: x.fill }); return r ? r.R : null; };
  // the cells a signal feeds (per exit), and its control group key
  const cellsOf = (g) => { const out = [];
    if (g.tr < 2) for (let x = 0; x < 4; x++) out.push([cellMain(g.l, g.tu, g.tr, x), x]);
    if (g.tu === 2 && g.tr === 2 && g.call !== 0) { const cc = g.call === g.s ? 0 : 1; for (let x = 0; x < 2; x++) out.push([cellCall(g.l, cc, x), x]); }
    return out; };
  // dedup within a cell group: (ladder, turn, trig, trigger candle, side)
  const seen = new Set(), used = new Set(), realTrig = P.map(() => new Set());
  for (const g of sig) realTrig[g.l].add(g.s + '|' + g.kind + '|' + g.j);
  // control (i) pools: lowest triggers of kind and side not in any setup of the ladder, as sorted lowest indices
  const pool = P.map((p, l) => ({ 0: { 1: p.chochL[1].filter((j) => !realTrig[l].has('1|0|' + j)), '-1': p.chochL[-1].filter((j) => !realTrig[l].has('-1|0|' + j)) },
    1: { 1: p.efL[1].filter((j) => !realTrig[l].has('1|1|' + j)), '-1': p.efL[-1].filter((j) => !realTrig[l].has('-1|1|' + j)) } }));
  const matchCtl = (g, grp) => {   // nearest unused pool event in time (within MATCH), same kind and side; MSNR cells: same call condition
    const arr = pool[g.l][g.kind][g.s], TL = P[g.l].TL; let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (TL[arr[m]].t < g.tt) lo = m + 1; else hi = m; }
    let a = lo - 1, b = lo;
    while (a >= 0 || b < arr.length) {
      const da = a >= 0 ? g.tt - TL[arr[a]].t : Infinity, db = b < arr.length ? TL[arr[b]].t - g.tt : Infinity; if (Math.min(da, db) > MATCH) return null;
      const q = da <= db ? arr[a--] : arr[b++]; const key = grp + '|' + q; if (used.has(key)) continue;
      if (grp.startsWith('C')) { const cl = callAt(TL[q].e); const cc = cl === g.s ? 0 : cl === -g.s ? 1 : -1; if (cc !== (g.call === g.s ? 0 : 1)) continue; }
      used.add(key); return q; }
    return null; };
  for (const g of sig) {
    const cells = cellsOf(g); if (!cells.length) continue;
    const key = g.l + '|' + g.tu + '|' + g.tr + '|' + g.j + '|' + g.s; if (seen.has(key)) continue; seen.add(key);
    const x = run(g.l, g.s, g.ts, g.stop); if (!x) continue; cnt.trades++;
    const pR = flip(g.l, g.s, x);
    for (const [c, k] of cells) { if (Number.isNaN(x.R[k])) continue; add(real, c, x.w, x.m, x.R[k], x.cr); if (pR && !Number.isNaN(pR[k])) add(plac, c, x.w, x.m, pR[k], x.cr); }
    // control (i), one per group (main cells: ladder|turn|trig; MSNR cells: ladder|call condition)
    const groups = []; if (g.tr < 2) groups.push(['M' + g.l + g.tu + g.tr, cells.filter(([c]) => c < NMAIN)]);
    if (g.tu === 2 && g.tr === 2 && g.call !== 0) groups.push(['C' + g.l + (g.call === g.s ? 0 : 1), cells.filter(([c]) => c >= NMAIN)]);
    for (const [grp, cl] of groups) { const q = matchCtl(g, grp); if (q == null) { cnt.ctl1None++; continue; }
      const p = P[g.l], ts = p.TL[q].e, im = K.closedCount(p.TM, ts) - 1, a = im >= 0 ? p.atrM[im] : 0; if (!(a > 0)) continue;
      const ex = extreme(M5, g.s, ts - (g.ts - g.retT), ts); if (ex == null) continue;
      const y = run(g.l, g.s, ts, ex - g.s * ATRK * a); if (!y) continue; cnt.ctl1++;
      for (const [c, k] of cl) if (!Number.isNaN(y.R[k])) add(c1, c, y.w, y.m, y.R[k], y.cr); }
  }
  // control (ii): every zone return at market
  for (const r of rets) { const y = run(r.l, r.s, r.ts, r.stop); if (!y) continue; cnt.ctl2++;
    for (let c = 0; c < NC; c++) { const n = cellName(c); if (n.l !== r.l) continue;
      if (n.cc >= 0) { if (r.call === 0 || (r.call === r.s ? 0 : 1) !== n.cc) continue; }
      if (!Number.isNaN(y.R[n.x])) add(c2, c, y.w, y.m, y.R[n.x], y.cr); } }
  const J = (A) => Object.fromEntries(Object.entries(A).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, assumed: ASSUMED.includes(market), first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null,
    ...cnt, real: J(real), plac: J(plac), c1: J(c1), c2: J(c2) };
}

// ---- cut test: the signals known by a date, computed on candles cut there, equal the full run's ---------------------------
export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const key = (g) => [g.l, g.tu, g.tr, g.tt, g.s, g.stop.toFixed(8), g.call].join('|');
  const full = signals(frames(M5), M5).sig; const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000; const M = M5.filter((b) => b.e <= T);
    const cut = signals(frames(M), M).sig.filter((g) => g.ts <= T).map(key);
    const want = full.filter((g) => g.ts <= T).map(key); const A = new Set(cut), B = new Set(want);
    out.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length }); }
  return out;
}

// ---- pooled statistics and the bar ----------------------------------------------------------------------------------------
export function pool(list, kind) { const A = newAcc(); for (const d of list) { const S = d[kind]; for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += S[k][i]; } return A; }
export function cellStats(A, c) {
  const ms = A.ms.subarray(c * NM, (c + 1) * NM), msn = A.msNet.subarray(c * NM, (c + 1) * NM);
  const win = (w) => { const n = A.n[c * 2 + w], a = w ? DM : 0, b = w ? NM : DM;
    return { n, mean: n ? A.sum[c * 2 + w] / n : null, t: mstat(ms, a, b).t, meanNet: n ? A.net[c * 2 + w] / n : null, tNet: mstat(msn, a, b).t,
      win: n ? A.win[c * 2 + w] / n : null, months: b - a, sum: A.sum[c * 2 + w], sq: A.sq[c * 2 + w] }; };
  return { d: win(0), c: win(1) };
}
export const bars13 = (x) => x.d.n >= 300 && x.c.n >= 300 && x.d.mean > 0 && x.c.mean > 0 && x.d.t >= 2 && x.c.t >= 2;
export function judge(data) {
  const R = pool(data, 'real'), PL = pool(data, 'plac'), C1 = pool(data, 'c1'), C2 = pool(data, 'c2'); const rows = [];
  for (let c = 0; c < NC; c++) { const s = cellStats(R, c), ps = cellStats(PL, c), a = cellStats(C1, c), b = cellStats(C2, c);
    rows.push({ cell: c, ...cellName(c), d: s.d, c: s.c, p: p1(s.c.t, s.c.months - 1), c1: a, c2: b,
      v1: { d: welch(s.d, a.d), c: welch(s.c, a.c) }, v2: { d: welch(s.d, b.d), c: welch(s.c, b.c) }, plac: { d: ps.d, c: ps.c, p: p1(ps.c.t, ps.c.months - 1) } }); }
  const H = K.holm(rows.map((r) => r.p)), HP = K.holm(rows.map((r) => r.plac.p));
  const ge2 = (v) => v.d != null && v.c != null && v.d >= 2 && v.c >= 2;
  rows.forEach((r, i) => { r.holm = H[i]; r.plac.holm = HP[i];
    r.checks = { n: r.d.n >= 300 && r.c.n >= 300, disc: r.d.mean > 0 && r.d.t >= 2, conf: r.c.mean > 0 && r.c.t >= 2, holm: H[i] < 0.05, ctl1: ge2(r.v1), ctl2: ge2(r.v2) };
    r.pass = Object.values(r.checks).every(Boolean); r.plac.pass = bars13(r.plac) && HP[i] < 0.05; });
  return rows;
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(6), t: +w.t.toFixed(6), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(6), tNet: +w.tNet.toFixed(2),
  win: w.win == null ? null : +w.win.toFixed(3) });
const r2 = (v) => (v == null ? null : +v.toFixed(2));

export function report(dir) {
  const data = MARKETS.map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cut = MARKETS.flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const rows = judge(data), pass = rows.filter((r) => r.pass), plPass = rows.filter((r) => r.plac.pass);
  const verdict = pass.length ? 'PASS' : rows.some((r) => r.checks.n) ? 'FAIL' : 'INCONCLUSIVE';
  const bestC = [...rows].sort((a, b) => b.c.t - a.c.t)[0], bestBoth = [...rows].sort((a, b) => Math.min(b.d.t, b.c.t) - Math.min(a.d.t, a.c.t))[0];
  const perMarket = {}; for (const r of pass) perMarket[r.cell] = data.map((d) => { const s = cellStats(pool([d], 'real'), r.cell); return { market: d.market, d: slim(s.d), c: slim(s.c) }; });
  const headline = verdict === 'PASS'
    ? `${pass.length} of 56 cells pass; best ${cname(pass[0])}, ${f3(pass[0].c.mean)}R a trade before costs in 2015-26 (n ${N(pass[0].c.n)}, month t ${f2(pass[0].c.t)})`
    : `0 of 56 cells pass; the best confirmation cell, ${cname(bestC)}, made ${f3(bestC.c.mean)}R a trade before costs in 2015-26 (n ${N(bestC.c.n)}, month t ${f2(bestC.c.t)}; discovery ${f3(bestC.d.mean)}R, t ${f2(bestC.d.t)})`;
  const RW = rows.map((r) => ({ cell: cname(r), ladder: r.ladder, turn: r.turn, trig: r.trig, exit: r.exit, call: r.call, disc: slim(r.d), conf: slim(r.c), holm: +r.holm.toFixed(4),
    ctl1: { disc: slim(r.c1.d), conf: slim(r.c1.c), welch: { d: r2(r.v1.d), c: r2(r.v1.c) } }, ctl2: { disc: slim(r.c2.d), conf: slim(r.c2.c), welch: { d: r2(r.v2.d), c: r2(r.v2.c) } },
    checks: r.checks, pass: r.pass, placebo: { disc: slim(r.plac.d), conf: slim(r.plac.c), holm: +r.plac.holm.toFixed(4), pass: r.plac.pass } }));
  const out = { study: 'eg-ef-choch-ladder', built: '2026-11-23', verdict, headline, basis: 'judged before costs on calendar-month sums (pre-registered); after costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' }, markets: MARKETS,
    assumedCosts: ASSUMED, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10),
      signals: d.signals, rets: d.rets, trades: d.trades, ctl1: d.ctl1, ctl1None: d.ctl1None, ctl2: d.ctl2, dropped: d.dropped, bad: d.bad, small: d.small })),
    passed: pass.map(cname), placeboPassed: plPass.map(cname), bestConfirmation: cname(bestC), bestBothWindows: cname(bestBoth), cut, cells: RW, perMarket };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, rows, bestBoth));
  return out;
}

function resultMd(o, rows, bestBoth) {
  const cnt = (f) => rows.filter(f).length, nCut = o.cut.reduce((a, x) => a + x.n, 0), bad = o.cut.reduce((a, x) => a + x.missing + x.extra, 0);
  const L = ['# Engulf and failed-engulf zones with a ChoCh or EF turn down the ladder (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    'Ladder A: a Daily engulf zone (or a Daily engulf zone that failed and turned), the first return into it, a turn on H4 (a',
    'ChoCh: the first close beyond the last 2-a-side swing against the move into the zone; or an EF: an H4 engulf of the other',
    'side closed through), then the first ChoCh or EF of the same side on H1; ladder B the same one step lower (H4 zone, H1 turn,',
    'M15 trigger). Market entry at the next 5-minute open, stop past the extreme made in the zone + 0.1 ATR of the middle',
    'timeframe, exits 1R / 2R / 3R / the nearest opposite higher zone (1R or more away). 48 cells (ladder x turn x trigger x exit)',
    'and 8 with the Daily MSNR call with / against the side (turn and trigger = either; 1R, 2R). Ten markets pooled, OANDA mid',
    '5-minute candles; discovery = fills 2005-2014, confirmation = 2015 to October 2026. Two controls: (i) the same lowest-timeframe',
    'trigger of the same kind and side with no zone setup, nearest in time; (ii) the zone return entered at market with no turn.',
    `Costs after the fact only: the demo figures for gold and the four majors; **ASSUMED, not measured** for ${o.assumedCosts.join(', ')}.`, '',
    '## The bar, cell by cell', '',
    `- n >= 300 in both windows: ${cnt((r) => r.checks.n)} of 56.`,
    `- Mean R > 0 and month t >= 2 in discovery: ${cnt((r) => r.checks.disc)}; in confirmation: ${cnt((r) => r.checks.conf)}; both: ${cnt((r) => r.checks.disc && r.checks.conf)}.`,
    `- Holm-adjusted p < 0.05 over the 56 confirmation tests: ${cnt((r) => r.checks.holm)}.`,
    `- Beats control (i) (Welch t >= 2 in both windows): ${cnt((r) => r.checks.ctl1)}; control (ii): ${cnt((r) => r.checks.ctl2)}.`,
    `- **All: ${o.passed.length}${o.passed.length ? ' (' + o.passed.join('; ') + ')' : ''}.**`,
    `- Side-flipped placebo passing bars 1-3 and Holm: ${o.placeboPassed.length}${o.placeboPassed.length ? ' (' + o.placeboPassed.join('; ') + ')' : ''}.`, '',
    `Best confirmation cell: ${o.bestConfirmation}. Best on the weaker of the two windows: ${o.bestBothWindows} (discovery`,
    `${f3(bestBoth.d.mean)}R, t ${f2(bestBoth.d.t)}; confirmation ${f3(bestBoth.c.mean)}R, t ${f2(bestBoth.c.t)}).`, '',
    '## Every cell', '',
    'R a trade before costs (month-sum t), after costs beside; controls (i) and (ii): their R in confirmation and the Welch t of the',
    'cell against them (discovery / confirmation); Holm on the confirmation test; the side-flipped placebo in confirmation.', '',
    '| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | ctl (i) R 15-26, Welch | ctl (ii) R 15-26, Welch | Holm | Placebo R 15-26 (t) | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|'];
  for (const r of rows) L.push(`| ${cname(r)} | ${N(r.d.n)} | ${f3(r.d.mean)} (${f2(r.d.t)}) | ${f3(r.d.meanNet)} | ${N(r.c.n)} | ${f3(r.c.mean)} (${f2(r.c.t)}) | ${f3(r.c.meanNet)} | ${f3(r.c1.c.mean)}, ${f2(r.v1.d)} / ${f2(r.v1.c)} | ${f3(r.c2.c.mean)}, ${f2(r.v2.d)} / ${f2(r.v2.c)} | ${r.holm.toFixed(3)} | ${f3(r.plac.c.mean)} (${f2(r.plac.c.t)}) | ${r.pass ? 'yes' : 'no'} |`);
  L.push('');
  if (o.passed.length) { L.push('## Per market, passing cells', ''); for (const [c, list] of Object.entries(o.perMarket)) { L.push(`### ${cname(rows[c])}`, '', '| Market | n 05-14 | R (t) | n 15-26 | R (t) |', '|---|---:|---:|---:|---:|');
    for (const x of list) L.push(`| ${x.market} | ${N(x.d.n)} | ${f3(x.d.mean)} (${f2(x.d.t)}) | ${N(x.c.n)} | ${f3(x.c.mean)} (${f2(x.c.t)}) |`); L.push(''); } }
  L.push('## Checks', '',
    `- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ')}: ${N(nCut)} signals known by the cut dates, ${bad} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); fills at or past the stop and trades whose risk is under the round-trip cost are no trades (same for cells and controls).',
    '- Exclusions: the data-quality audit\'s bad intervals (`combo-grid-2` `exclusions`).', '',
    '| Market | candles from | signals | zone returns | trades | ctl (i) | no ctl (i) found | ctl (ii) | dropped (bad data) | past the stop | risk under cost |', '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.signals)} | ${N(m.rets)} | ${N(m.trades)} | ${N(m.ctl1)} | ${N(m.ctl1None)} | ${N(m.ctl2)} | ${m.dropped} | ${m.bad} | ${N(m.small)} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') L.push('A passing cell is a candidate for its own forward record and an owner decision, nothing more: it is not adopted, and never called an edge before a forward record.');
  else L.push('No cell clears the bar: a higher engulf or failed-engulf zone with a ChoCh or EF turn one timeframe lower and the same',
    'sign one timeframe lower again does not pick better trades than the trigger alone or than entering at the zone, on ten markets',
    'over 22 years. Do not re-test variants of these cells on these years. Nothing live changed; no rule is proposed.');
  L.push('');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = runMarket(a);
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, 'signals', r.signals, 'trades', r.trades, 'ctl1', r.ctl1, 'ctl2', r.ctl2, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify(r)); console.log(JSON.stringify(r)); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
