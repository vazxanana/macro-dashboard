// research/edge/grid7-wide-trend-pullback/run.mjs - the wide trend-pullback grid of PREREGISTRATION.md (23 Nov 2026): a move on
// the Daily (or H4), a pullback one timeframe lower, the first structure break back with the move two timeframes lower; 54 cells
// (2 chains x 3 exits x 9 contexts), each against a control taken at the same pullbacks with the move's direction ignored; ten
// markets, discovery 2005-14, confirmation 2015 to Oct 2026, judged before costs on month sums. Research only: nothing live
// imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/grid7-wide-trend-pullback/run.mjs market <m> <outDir>   one market's accumulators
//   EDGE_DATA=<cache> node research/edge/grid7-wide-trend-pullback/run.mjs cut <m> <outDir>      the cut test of one market
//   node research/edge/grid7-wide-trend-pullback/run.mjs report <outDir>                         result.json + RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames, buildZones } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { mstat, p1, welch } from '../grid7-wide-core/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (Y, M = 0) => Date.UTC(Y, M, 1) / 1000;
export const MARKETS = ['xau', 'xag', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy'];
export const ASSUMED = ['xag', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy'];
export const CHAINS = [{ name: 'D1', M: '1d', P: '4h', T: '1h', cap: 5 * 86400 }, { name: 'H4', M: '4h', P: '1h', T: '15m', cap: 2 * 86400 }];
export const EXITS = ['1R', '2R', 'ext'];
export const CTX = ['all', 'shallow+zone', 'shallow-zone', 'mid+zone', 'mid-zone', 'deep+zone', 'deep-zone', 'eg', 'dom'];
export const KS = 3, ATRK = 0.1;
export const FROM = y(2005), SPLIT = y(2015), TO = y(2026, 10);   // fills 2005-01-01 .. 2026-10-31
export const NM = 262, DM = 120;                                   // months 2005-01 .. 2026-10; discovery 0..119
export const NCELL = CHAINS.length * EXITS.length * CTX.length;    // 54
export const cellIndex = (ch, x, k) => (ch * EXITS.length + x) * CTX.length + k;
export function cellName(i) { const k = i % CTX.length, r = (i - k) / CTX.length, x = r % EXITS.length, ch = (r - x) / EXITS.length;
  return { chain: CHAINS[ch].name, exit: EXITS[x], ctx: CTX[k], ch, x, k, name: `${CHAINS[ch].name} ${CTX[k]} ${EXITS[x]}` }; }
export const monthOf = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2005) * 12 + d.getUTCMonth(); };
export const depthBucket = (dp) => (dp < 0.382 ? 'shallow' : dp <= 0.618 ? 'mid' : 'deep');
// the contexts a signal belongs to (indices into CTX)
export function contextsOf(g) {
  const out = [0], z = g.eg || g.dom;
  out.push(1 + ['shallow', 'mid', 'deep'].indexOf(depthBucket(g.depth)) * 2 + (z ? 0 : 1));
  if (g.eg) out.push(7); if (g.dom) out.push(8);
  return out;
}

// ---- zone touches: per trigger candle k, a bit for each (family, side) zone of P known at or before T[k].t, not yet ended
// (T[k].t < end), whose [bot, top] the candle trades into. One sweep with an active set (zones sorted by the time known).
export const FLAG = { eg: [1, 2], dom: [4, 8] };
export function touchFlags(T, P) {
  const hit = new Uint8Array(T.length);
  for (const fam of ['eg', 'dom']) {
    const Z = buildZones(fam, P).slice().sort((a, b) => a.at - b.at); let zi = 0; let act = [];
    for (let k = 0; k < T.length; k++) { const b = T[k];
      while (zi < Z.length && Z[zi].at <= b.t) act.push(Z[zi++]);
      if (act.length > 64) act = act.filter((z) => b.t < z.end);
      for (const z of act) if (b.t < z.end && b.l <= z.top && b.h >= z.bot) hit[k] |= FLAG[fam][z.d > 0 ? 0 : 1]; }
  }
  return hit;
}

// ---- signals (closed candles only) ------------------------------------------------------------------------------------
// [{ ch, kind 'real' | 'ctl', s, j, tt (trigger candle start), ts (its close), stop, ext (target price), depth, eg, dom }]
export function chainSignals(F, ci) {
  const C = CHAINS[ci], M = F[C.M], P = F[C.P], T = F[C.T];
  const mEv = K.structure(M, KS).events.map((e) => { let o = e.dir > 0 ? Infinity : -Infinity;
    for (let q = e.from; q <= e.i; q++) o = e.dir > 0 ? Math.min(o, M[q].l) : Math.max(o, M[q].h);
    return { known: M[e.i].e, d: e.dir, O: o, start: M[e.from].t }; });
  const pEv = K.structure(P, KS).events.map((e) => ({ known: P[e.i].e, d: e.dir }));
  const tEv = new Map(); for (const e of K.structure(T, KS).events) tEv.set(e.i, e.dir);
  const atr = atr14(T);
  const hit = touchFlags(T, P);
  const out = []; let mi = 0, pi = 0, mv = null, pb = null;
  const zoneHit = (fam, d, k) => (hit[k] & FLAG[fam][d > 0 ? 0 : 1]) !== 0;
  for (let j = 0; j < T.length; j++) {
    const b = T[j];
    // M and P events known by the start of candle j
    while (mi < mEv.length && mEv[mi].known <= b.t) { const e = mEv[mi++];
      // X: the running extreme of the T candles from the leg's start up to (not including) candle j
      let x = e.d > 0 ? -Infinity : Infinity, xi = -1, k = startIdx(T, e.start);
      for (; k < j; k++) if (e.d > 0 ? T[k].h >= x : T[k].l <= x) { x = e.d > 0 ? T[k].h : T[k].l; xi = k; }
      mv = { d: e.d, O: e.O, X: x, xi, known: e.known, dead: false }; pb = null; }
    while (pi < pEv.length && pEv[pi].known <= b.t) { const e = pEv[pi++];
      if (mv && !mv.dead && !pb && e.d === -mv.d && e.known > mv.known && mv.xi >= 0) {
        const d = mv.d; let E = d > 0 ? Infinity : -Infinity, Hc = d > 0 ? -Infinity : Infinity, eg = false, dom = false;
        for (let k = mv.xi; k < j; k++) { const c = T[k]; E = d > 0 ? Math.min(E, c.l) : Math.max(E, c.h); Hc = d > 0 ? Math.max(Hc, c.h) : Math.min(Hc, c.l);
          if (!eg && zoneHit('eg', d, k)) eg = true; if (!dom && zoneHit('dom', d, k)) dom = true; }
        pb = { X: mv.X, xi: mv.xi, E, Hc, eg, dom, ctlDone: false }; } }
    if (!mv || mv.dead) continue;
    const d = mv.d;
    if (pb) { // candle j is part of the pullback window
      pb.E = d > 0 ? Math.min(pb.E, b.l) : Math.max(pb.E, b.h); pb.Hc = d > 0 ? Math.max(pb.Hc, b.h) : Math.min(pb.Hc, b.l);
      if (!pb.eg && zoneHit('eg', d, j)) pb.eg = true; if (!pb.dom && zoneHit('dom', d, j)) pb.dom = true; }
    // the move is broken by a touch of its origin
    if (d > 0 ? b.l <= mv.O : b.h >= mv.O) { mv.dead = true; pb = null; continue; }
    const ev = tEv.get(j), a = atr[j];
    if (pb && ev && a > 0) {
      const depth = Math.abs(pb.X - pb.E) / Math.abs(pb.X - mv.O);
      const base = { ch: ci, j, tt: b.t, ts: b.e, depth, eg: pb.eg, dom: pb.dom };
      if (!pb.ctlDone) { pb.ctlDone = true; const c = ev;
        const stop = c === d ? pb.E - d * ATRK * a : pb.Hc + d * ATRK * a;
        out.push({ ...base, kind: 'ctl', s: c, stop, ext: c === d ? pb.X : mv.O }); }
      if (ev === d) { out.push({ ...base, kind: 'real', s: d, stop: pb.E - d * ATRK * a, ext: pb.X }); pb = null; }
    }
    // X runs on (after the pullback logic for this candle)
    if (d > 0 ? b.h >= mv.X : b.l <= mv.X) { mv.X = d > 0 ? b.h : b.l; mv.xi = j; }
  }
  return out;
}
export const signals = (F) => CHAINS.flatMap((_, ci) => chainSignals(F, ci));

// ---- one trade: three targets in one pass (market fill at the open of candle fi; stop first in a candle that holds both) ---
// tg: target prices (NaN = no target in that exit). Returns { fill, risk, R: [3] } or null (stop on the wrong side).
export function exits(M5, s, fi, stop, tgR, cap) {
  const fill = M5[fi].o, risk = s * (fill - stop); if (!(risk > 0)) return null;
  const n = tgR.length, tg = tgR.map((k) => (Number.isFinite(k) ? fill + s * k * risk : NaN)), R = new Array(n).fill(NaN);
  let left = tg.filter((x) => Number.isFinite(x)).length; const dl = M5[fi].t + cap;
  const fin = (k, px) => { if (Number.isFinite(tg[k]) && Number.isNaN(R[k])) { R[k] = (s * (px - fill)) / risk; left--; } };
  for (let j = fi; j < M5.length && left; j++) { const b = M5[j];
    if (j > fi) { if (s * (b.o - stop) <= 0) for (let k = 0; k < n; k++) fin(k, b.o); else for (let k = 0; k < n; k++) if (s * (b.o - tg[k]) >= 0) fin(k, b.o); }
    const low = s > 0 ? b.l : b.h, high = s > 0 ? b.h : b.l;
    if (s * (low - stop) <= 0) for (let k = 0; k < n; k++) fin(k, stop);
    for (let k = 0; k < n; k++) if (s * (high - tg[k]) >= 0) fin(k, tg[k]);
    if (b.e >= dl) for (let k = 0; k < n; k++) fin(k, b.c); }
  return left ? null : { fill, risk, R };
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
function newAcc() { return { ms: new Float64Array(NCELL * NM), msNet: new Float64Array(NCELL * NM), n: new Float64Array(NCELL * 2), sum: new Float64Array(NCELL * 2),
  sq: new Float64Array(NCELL * 2), net: new Float64Array(NCELL * 2), win: new Float64Array(NCELL * 2) }; }
function add(A, c, w, m, R, cr) { A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; A.n[c * 2 + w]++; A.sum[c * 2 + w] += R; A.sq[c * 2 + w] += R * R; A.net[c * 2 + w] += R - cr; if (R > 0) A.win[c * 2 + w]++; }

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5);
  const sigs = signals(F), cost = COSTS[market], X = exclusions(market);
  const real = newAcc(), ctl = newAcc(), flip = newAcc(); let dropped = 0, bad = 0, small = 0, sims = 0, noExt = 0;
  const depthSeen = { shallow: 0, mid: 0, deep: 0 };
  for (const g of sigs) {
    const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const t = M5[fi].t; if (t < FROM || t >= TO) continue;
    if (X.length && inBad(X, t)) { dropped++; continue; }
    const fill = M5[fi].o, risk = g.s * (fill - g.stop); if (!(risk > 0)) { bad++; continue; }
    if (risk < cost) { small++; continue; }
    const kx = (g.s * (g.ext - fill)) / risk, kExt = kx >= 1 ? kx : NaN; if (!(kx >= 1)) noExt++;
    const cap = CHAINS[g.ch].cap, r = exits(M5, g.s, fi, g.stop, [1, 2, kExt], cap); sims++;
    if (!r) continue;
    if (!(g.s * (fill - g.stop) > 0)) throw new Error('stop on the wrong side');
    const m = monthOf(t), w = t < SPLIT ? 0 : 1, cr = cost / risk, ctxs = contextsOf(g);
    const p = g.kind === 'real' ? exits(M5, -g.s, fi, fill + g.s * risk, [1, 2, kExt], cap) : null;
    if (g.kind === 'real') depthSeen[depthBucket(g.depth)]++;
    for (let x = 0; x < 3; x++) { if (!Number.isFinite(r.R[x])) continue;
      for (const k of ctxs) { const ci = cellIndex(g.ch, x, k);
        if (g.kind === 'real') { add(real, ci, w, m, r.R[x], cr); if (p && Number.isFinite(p.R[x])) add(flip, ci, w, m, p.R[x], cr); }
        else add(ctl, ci, w, m, r.R[x], cr); } }
  }
  const J = (A) => Object.fromEntries(Object.entries(A).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, assumed: ASSUMED.includes(market), first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null,
    signals: sigs.length, realSignals: sigs.filter((g) => g.kind === 'real').length, sims, dropped, bad, small, noExt, depthSeen,
    real: J(real), ctl: J(ctl), flip: J(flip) };
}

// ---- cut test: the signals known by a date, computed on candles cut there, equal the full run's ---------------------------
export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const key = (g) => [g.ch, g.kind, g.tt, g.s, g.stop.toFixed(8), g.ext.toFixed(8), g.depth.toFixed(8), g.eg, g.dom].join('|');
  const full = signals(frames(M5)); const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000;
    const cut = signals(frames(M5.filter((b) => b.e <= T))).filter((g) => g.ts <= T).map(key);
    const want = full.filter((g) => g.ts <= T).map(key); const A = new Set(cut), B = new Set(want);
    out.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length }); }
  return out;
}

// ---- pooled statistics ----------------------------------------------------------------------------------------------------
export function pool(list, kind) { const A = newAcc(); for (const d of list) { const S = d[kind]; for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += S[k][i]; } return A; }
export function cellStats(A, c) {
  const ms = A.ms.subarray(c * NM, (c + 1) * NM), msn = A.msNet.subarray(c * NM, (c + 1) * NM);
  const win = (w) => { const n = A.n[c * 2 + w], a = w ? DM : 0, b = w ? NM : DM;
    return { n, mean: n ? A.sum[c * 2 + w] / n : null, t: mstat(ms, a, b).t, meanNet: n ? A.net[c * 2 + w] / n : null, tNet: mstat(msn, a, b).t,
      win: n ? A.win[c * 2 + w] / n : null, months: b - a, sum: A.sum[c * 2 + w], sq: A.sq[c * 2 + w] }; };
  return { d: win(0), c: win(1) };
}
const ok3 = (x, h) => x.d.n >= 300 && x.c.n >= 300 && x.d.mean > 0 && x.c.mean > 0 && x.d.t >= 2 && x.c.t >= 2 && h < 0.05;
export function judge(data) {
  const R = pool(data, 'real'), C = pool(data, 'ctl'), P = pool(data, 'flip'); const rows = [];
  for (let c = 0; c < NCELL; c++) { const s = cellStats(R, c), cs = cellStats(C, c), ps = cellStats(P, c);
    rows.push({ cell: c, ...cellName(c), d: s.d, c: s.c, p: p1(s.c.t, s.c.months - 1), ctl: cs, vs: { d: welch(s.d, cs.d), c: welch(s.c, cs.c) },
      flip: { d: ps.d, c: ps.c, p: p1(ps.c.t, ps.c.months - 1) } }); }
  const H = K.holm(rows.map((r) => r.p)), HP = K.holm(rows.map((r) => r.flip.p));
  rows.forEach((r, i) => { r.holm = H[i]; r.flip.holm = HP[i];
    r.checks = { n: r.d.n >= 300 && r.c.n >= 300, disc: r.d.mean > 0 && r.d.t >= 2, conf: r.c.mean > 0 && r.c.t >= 2, holm: H[i] < 0.05,
      control: r.vs.d != null && r.vs.c != null && r.vs.d >= 2 && r.vs.c >= 2 };
    r.pass = Object.values(r.checks).every(Boolean); r.flip.pass = ok3(r.flip, HP[i]); });
  return rows;
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(6), t: +w.t.toFixed(6), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(6), tNet: +w.tNet.toFixed(2),
  win: w.win == null ? null : +w.win.toFixed(3) });
// grid7-wide-fade's plain fade cells for the same trigger timeframes (read, never recomputed)
function fadeBeside() {
  const f = path.join(HERE, '..', 'grid7-wide-fade', 'result.json'); if (!fs.existsSync(f)) return [];
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  return r.cells.filter((c) => c.session === 'all' && c.ctx === 'none' && c.stop === 'ext' && (c.tf === 'm15' || c.tf === 'h1'))
    .map((c) => ({ cell: c.cell, chain: c.tf === 'h1' ? 'D1' : 'H4', disc: { n: c.disc.n, mean: c.disc.mean, t: +c.disc.t.toFixed(2), meanNet: c.disc.meanNet },
      conf: { n: c.conf.n, mean: c.conf.mean, t: +c.conf.t.toFixed(2), meanNet: c.conf.meanNet } }));
}

export function report(dir) {
  const data = MARKETS.map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cut = MARKETS.flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const rows = judge(data), pass = rows.filter((r) => r.pass), flPass = rows.filter((r) => r.flip.pass);
  const verdict = pass.length ? 'PASS' : 'FAIL';
  const bestC = [...rows].sort((a, b) => b.c.t - a.c.t)[0], bestBoth = [...rows].sort((a, b) => Math.min(b.d.t, b.c.t) - Math.min(a.d.t, a.c.t))[0];
  const perMarket = {}; for (const r of pass) perMarket[r.name] = data.map((d) => { const s = cellStats(pool([d], 'real'), r.cell); return { market: d.market, d: slim(s.d), c: slim(s.c) }; });
  const allCells = rows.filter((r) => r.ctx === 'all');
  const headline = verdict === 'PASS'
    ? `${pass.length} of 54 cells pass the pre-registered bar; best ${pass[0].name}, ${f3(pass[0].c.mean)}R a trade before costs in 2015-26 (n ${N(pass[0].c.n)}, month t ${f2(pass[0].c.t)}; after costs ${f3(pass[0].c.meanNet)}R)`
    : `0 of 54 cells pass; the best confirmation cell, ${bestC.name}, made ${f3(bestC.c.mean)}R a trade before costs in 2015-26 (n ${N(bestC.c.n)}, month t ${f2(bestC.c.t)}; discovery ${f3(bestC.d.mean)}R, t ${f2(bestC.d.t)})`;
  const RW = rows.map((r) => ({ cell: r.name, chain: r.chain, ctx: r.ctx, exit: r.exit, disc: slim(r.d), conf: slim(r.c), holm: +r.holm.toFixed(4),
    control: { disc: slim(r.ctl.d), conf: slim(r.ctl.c) }, vsControl: { d: r.vs.d == null ? null : +r.vs.d.toFixed(2), c: r.vs.c == null ? null : +r.vs.c.toFixed(2) },
    checks: r.checks, pass: r.pass, flipped: { disc: slim(r.flip.d), conf: slim(r.flip.c), holm: +r.flip.holm.toFixed(4), pass: r.flip.pass } }));
  const out = { study: 'grid7-wide-trend-pullback', built: '2026-11-23', verdict, headline, basis: 'judged before costs on calendar-month sums (pre-registered); after costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' }, markets: MARKETS,
    assumedCosts: ASSUMED, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10),
      signals: d.signals, realSignals: d.realSignals, sims: d.sims, dropped: d.dropped, bad: d.bad, small: d.small, noExt: d.noExt, depth: d.depthSeen })),
    passed: pass.map((r) => r.name), flippedPassed: flPass.map((r) => r.name), bestConfirmation: bestC.name, bestBothWindows: bestBoth.name,
    fadeBeside: fadeBeside(), cut, cells: RW, perMarket };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, rows, bestBoth, allCells));
  return out;
}

function resultMd(o, rows, bestBoth, allCells) {
  const vline = `**Verdict: ${o.verdict}. ${o.headline}.**`;
  const nCut = o.cut.reduce((a, x) => a + x.n, 0), bad = o.cut.reduce((a, x) => a + x.missing + x.extra, 0);
  const cnt = (f) => rows.filter(f).length;
  const L = [];
  L.push('# Wide trend-pullback grid: move, pullback, break back with the move, on ten markets (result)', '', vline, '',
    'Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    'Two chains: a move on the Daily (pullback on H4, trigger on H1) or on H4 (pullback on H1, trigger on M15). The move = the last',
    'structure break on its timeframe (3 candles a side); a pullback starts with a structure break against it one timeframe lower;',
    'the trade is the first structure break back WITH the move on the trigger timeframe, a market entry at the next 5-minute open,',
    'stop past the pullback\'s extreme + 0.1 ATR(14) of the trigger timeframe, exits 1R, 2R or the move\'s extreme (when 1R or',
    'more away), time limit 5 days (Daily chain) or 2 days (H4 chain). Contexts: depth of the pullback at the trigger (under 38.2 %,',
    '38.2-61.8 %, over 61.8 % of the move\'s leg), with or without an engulf / dominant zone of the move\'s side (on the pullback',
    'timeframe) touched during the pullback. 54 cells, ten markets pooled (xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad,',
    'usdchf, eurjpy), OANDA mid 5-minute candles. Discovery = fills 2005-2014, confirmation = 2015 to October 2026.',
    'Control of each cell: the first structure break of EITHER side after the same pullbacks began, traded its own way, same',
    'context. Judged before costs on month sums.',
    `Costs after the fact only: the demo figures for gold and the four majors; **ASSUMED, not measured** for ${o.assumedCosts.join(', ')}.`, '',
    '## The bar, cell by cell', '',
    `- n >= 300 in both windows: ${cnt((r) => r.checks.n)} of 54.`,
    `- Mean R > 0 and month t >= 2 in discovery: ${cnt((r) => r.checks.disc)}; in confirmation: ${cnt((r) => r.checks.conf)}; both: ${cnt((r) => r.checks.disc && r.checks.conf)}.`,
    `- Holm-adjusted p < 0.05 over the 54 confirmation tests: ${cnt((r) => r.checks.holm)}.`,
    `- Beats its control (Welch t >= 2 in both windows): ${cnt((r) => r.checks.control)} of 54.`,
    `- **All four: ${o.passed.length}${o.passed.length ? ' (' + o.passed.join('; ') + ')' : ''}.**`,
    `- Side-flipped check passing bars 1-3: ${o.flippedPassed.length}${o.flippedPassed.length ? ' (' + o.flippedPassed.join('; ') + ')' : ''}.`, '',
    `Best confirmation cell: ${o.bestConfirmation}. Best on the weaker of the two windows: ${o.bestBothWindows} (discovery`,
    `${f3(bestBoth.d.mean)}R, t ${f2(bestBoth.d.t)}; confirmation ${f3(bestBoth.c.mean)}R, t ${f2(bestBoth.c.t)}).`, '',
    '## The plain cells ("all" context) beside their controls', '',
    '| Cell | R 05-14 (t) | control 05-14 | R 15-26 (t) | control 15-26 | after costs 15-26 | vs control |', '|---|---:|---:|---:|---:|---:|---:|');
  for (const r of allCells) L.push(`| ${r.name} | ${f3(r.d.mean)} (${f2(r.d.t)}) | ${f3(r.ctl.d.mean)} (${f2(r.ctl.d.t)}) | ${f3(r.c.mean)} (${f2(r.c.t)}) | ${f3(r.ctl.c.mean)} (${f2(r.ctl.c.t)}) | ${f3(r.c.meanNet)} | ${f2(r.vs.d)} / ${f2(r.vs.c)} |`);
  L.push('', 'Beside, `grid7-wide-fade`\'s plain fade of every structure break on the same trigger timeframes (a different trade, read from',
    'its result.json, not recomputed; stop past the break candle\'s extreme):', '',
    '| Fade cell | for chain | R 05-14 (t) | R 15-26 (t) | after costs 15-26 |', '|---|---|---:|---:|---:|');
  for (const f of o.fadeBeside) L.push(`| ${f.cell} | ${f.chain} | ${f3(f.disc.mean)} (${f2(f.disc.t)}) | ${f3(f.conf.mean)} (${f2(f.conf.t)}) | ${f3(f.conf.meanNet)} |`);
  L.push('', '## Every cell', '',
    'R a trade before costs (month-sum t), after costs beside; "vs ctl" = Welch t of the cell against its control (discovery /',
    'confirmation); Holm on the confirmation test; "flipped" = the side-flipped check in 2015-26.', '',
    '| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | ctl 15-26 | vs ctl | Holm | Flipped R 15-26 (t) | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const r of rows) L.push(`| ${r.name} | ${N(r.d.n)} | ${f3(r.d.mean)} (${f2(r.d.t)}) | ${f3(r.d.meanNet)} | ${N(r.c.n)} | ${f3(r.c.mean)} (${f2(r.c.t)}) | ${f3(r.c.meanNet)} | ${f3(r.ctl.c.mean)} | ${f2(r.vs.d)} / ${f2(r.vs.c)} | ${r.holm.toFixed(3)} | ${f3(r.flip.c.mean)} (${f2(r.flip.c.t)}) | ${r.pass ? 'yes' : 'no'} |`);
  L.push('');
  if (o.passed.length) { L.push('## Per market, passing cells', ''); for (const [c, list] of Object.entries(o.perMarket)) { L.push(`### ${c}`, '', '| Market | n 05-14 | R (t) | n 15-26 | R (t) | net 15-26 |', '|---|---:|---:|---:|---:|---:|');
    for (const x of list) L.push(`| ${x.market}${o.assumedCosts.includes(x.market) ? ' (assumed cost)' : ''} | ${N(x.d.n)} | ${f3(x.d.mean)} (${f2(x.d.t)}) | ${N(x.c.n)} | ${f3(x.c.mean)} (${f2(x.c.t)}) | ${f3(x.c.meanNet)} |`); L.push(''); } }
  L.push('## Checks', '',
    `- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ')}: ${N(nCut)} signals (real and control) known by the cut dates, ${bad} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); fills at or past the stop and trades whose risk is under the round-trip cost are no trades (same for every cell).',
    '- Exclusions: the data-quality audit\'s bad intervals (`combo-grid-2` `exclusions`).', '',
    '| Market | candles from | signals (real + control) | real | simulated | dropped (bad data) | past the stop | risk under cost | ext under 1R | real: shallow / mid / deep |', '|---|---|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.signals)} | ${N(m.realSignals)} | ${N(m.sims)} | ${m.dropped} | ${m.bad} | ${N(m.small)} | ${N(m.noExt)} | ${m.depth.shallow} / ${m.depth.mid} / ${m.depth.deep} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') L.push('A passing cell is a candidate for its own forward record and an owner decision, nothing more: it is not adopted, and never',
    'called an edge before a forward record. Its after-cost figure is beside it; on five markets the costs are assumed.');
  else L.push('Read simply and in advance, the move / pullback / break-back cycle does not pick better trades than taking the first',
    'break of either side after the same pullbacks, on ten markets over 22 years, at any depth or with a zone. Do not re-test',
    'variants of these 54 cells on these years. Nothing live changed; no rule is proposed.');
  if (o.flippedPassed.length) L.push('', `The side-flipped check clears bars 1-3 in ${o.flippedPassed.length} cells: with these exits the flipped trade mirrors the real one, so this`,
    'says only that the real trades lose before costs (entering with a fresh lower-timeframe break gives some of it back, as',
    '`grid7-wide-fade` found). It is not a rule: a placebo is not a candidate, and its after-cost figures are in the table.');
  L.push('');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = runMarket(a);
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, 'signals', r.signals, 'real', r.realSignals, 'sims', r.sims, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify(r)); console.log(JSON.stringify(r)); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
