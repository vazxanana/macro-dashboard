// research/edge/sd-complement/run.mjs - PREREGISTRATION.md (24 Nov 2026): what the plain supply / demand reading lacked
// (Part A: premium / discount, Daily trend, zone quality, opposite-zone target, resting order at the near line, all filters)
// on ten markets and an eight-market holdout, each against its random-band control; and the zones as a filter on the two
// passing breakout rules (Part B). Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/sd-complement/run.mjs market <m> <outDir>   Part A, one market (main or holdout)
//   EDGE_DATA=<cache> node research/edge/sd-complement/run.mjs cut <m> <outDir>      Part A cut test
//   EDGE_DATA=<cache> node research/edge/sd-complement/run.mjs vb <m> <outDir>       Part B, xau or usdjpy
//   node research/edge/sd-complement/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { mstat, p1 } from '../grid7-wide-core/run.mjs';
import { sdBaseZones, bandsOf, seedOf, exits, SEEDS, ATRK } from '../grid7-sd-wide/run.mjs';
import { buildDays, daySkip, vbTrade, monthT, normP, holm } from '../gold-vol-breakout/run.mjs';
import { costOf } from '../vb-structure-filter/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (Y, M = 0) => Date.UTC(Y, M, 1) / 1000;
export const MAIN = ['xau', 'xag', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy'];
export const HOLD = ['nas100', 'spx500', 'de40', 'gbpjpy', 'audjpy', 'cadjpy', 'eurgbp', 'euraud'];
export const MEASURED = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const TESTS = ['A1 premium / discount', 'A2 Daily trend', 'A3 quality', 'A4 opposite-zone target', 'A5 resting order at the near line', 'A6 A1 + A2 + A3'];
export const FROM = y(2005), SPLIT = y(2015), TO = y(2026, 10), HFROM = y(2019, 1);
export const NM = 262, M0 = { 0: 0, 1: 120, 2: (2019 - 2005) * 12 + 1 }, M1 = { 0: 120, 1: 262, 2: 262 };
export const CAP = 3 * 86400, CAP4 = 10 * 86400, TOUCH_B = 48 * 3600;
const NT = TESTS.length;
export const monthOf = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2005) * 12 + d.getUTCMonth(); };

// ---- context readers (closed candles only) --------------------------------------------------------------------------
export function rangeReader(D) { // the last confirmed Daily swing high and low at moment t
  const sw = K.swings(D, 3).sort((a, b) => a.ct - b.ct); let k = 0, H = null, L = null; const at = [];
  for (const s of sw) { if (s.type === 'H') H = s.price; else L = s.price; at.push([s.ct, H, L]); }
  return (t) => { let lo = 0, hi = at.length; while (lo < hi) { const m = (lo + hi) >> 1; if (at[m][0] <= t) lo = m + 1; else hi = m; }
    if (!lo) return null; const [, h, l] = at[lo - 1]; return h != null && l != null && h > l ? { h, l, mid: (h + l) / 2 } : null; };
}
export function sideReader(D) { const S = K.structure(D, 3).side; return (t) => { const n = K.closedCount(D, t); return n ? S[n - 1] : 0; }; }
export const inDiscount = (z, r) => !!r && (z.d > 0 ? z.hi <= r.mid : z.lo >= r.mid);
export function quality(z, breaks) { if (!(z.nb <= 2)) return false; for (let j = z.o; j <= z.i; j++) if (breaks.get(j) === z.d) return true; return false; }

// the first M15 candle that trades into a zone (index, or -1)
export function firstTouch(T, z) {
  let k = startIdx(T, z.at);
  while (k < T.length && T[k].t < z.end && !(T[k].l <= z.hi && T[k].h >= z.lo)) k++;
  return k < T.length && T[k].t < z.end ? k : -1;
}
// A4: the near line of the nearest opposite zone known by t, untouched and alive at t, at least 1R beyond fill (or null)
export function oppTarget(Z, touchT, s, fill, risk, t) {
  let best = null;
  for (let q = 0; q < Z.length && Z[q].at <= t; q++) { const o = Z[q]; if (o.d !== -s || o.end <= t || touchT[q] <= t) continue;
    const near = s > 0 ? o.lo : o.hi; if (s * (near - fill) >= risk && (best == null || s * (best - near) > 0)) best = near; }
  return best;
}
// A5: a resting limit inside the zone by half the round trip, placed at the zone's known time, until its end; R at 2R or null
export function limitTrade(M5, z, stop, cost, cap = CAP) {
  const s = z.d, lim = s > 0 ? z.hi - cost / 2 : z.lo + cost / 2;
  for (let i = startIdx(M5, z.at); i < M5.length && M5[i].t < z.end; i++) { const b = M5[i];
    if (!(s > 0 ? b.l <= lim : b.h >= lim)) continue;
    const fill = s > 0 ? Math.min(lim, b.o) : Math.max(lim, b.o), risk = s * (fill - stop); if (!(risk > 0)) return { t: b.t, none: 'past' };
    if (risk < cost) return { t: b.t, none: 'small' };
    const tg = fill + 2 * s * risk, dl = b.t + cap;
    if (s * ((s > 0 ? b.l : b.h) - stop) <= 0) return { t: b.t, fill, risk, R: -1 };
    for (let j = i + 1; j < M5.length; j++) { const c = M5[j];
      if (s * (c.o - stop) <= 0) return { t: b.t, fill, risk, R: (s * (c.o - fill)) / risk };
      if (s * (c.o - tg) >= 0) return { t: b.t, fill, risk, R: (s * (c.o - fill)) / risk };
      if (s * ((s > 0 ? c.l : c.h) - stop) <= 0) return { t: b.t, fill, risk, R: -1 };
      if (s * ((s > 0 ? c.h : c.l) - tg) >= 0) return { t: b.t, fill, risk, R: 2 };
      if (c.e >= dl) return { t: b.t, fill, risk, R: (s * (c.c - fill)) / risk }; }
    return null; }
  return null;
}

// ---- Part A signals of one market -------------------------------------------------------------------------------------
// [{ ctl (0 real | seed), test, ts (entry decision time), s, stop, tgt (null = 2R), kind: 'mkt' | 'lim', z }]
export function signals(F, market) {
  const L = F['4h'], T = F['15m'], D = F['1d'], A = atr14(L), Z = sdBaseZones(L, A), cost = COSTS[market];
  const breaks = new Map(); for (const e of K.structure(L, 3).events) breaks.set(e.i, e.dir);
  const rng = rangeReader(D), side = sideReader(D), touchT = Z.map((z) => { const k = firstTouch(T, z); return k < 0 ? Infinity : T[k].t; });
  const Q = Z.map((z) => quality(z, breaks)), out = [];
  const sets = [[0, Z.map((z, q) => [z, q])], ...SEEDS.map((s) => [s, bandsOf(Z, seedOf(market, '4h', s)).map((b) => [b, b.src])])];
  for (const [ctl, list] of sets) for (const [z, q] of list) {
    const stop = z.d > 0 ? z.lo - ATRK * z.a : z.hi + ATRK * z.a;
    out.push({ ctl, test: 4, ts: z.at, s: z.d, stop, kind: 'lim', z });
    const k = firstTouch(T, z); if (k < 0) continue; const b = T[k];
    if (z.d > 0 ? b.c < z.lo : b.c > z.hi) continue;
    const ts = b.e, a1 = inDiscount(z, rng(ts)), a2 = side(ts) === z.d, a3 = Q[q];
    const base = { ctl, ts, s: z.d, stop, kind: 'mkt', z };
    if (a1) out.push({ ...base, test: 0 });
    if (a2) out.push({ ...base, test: 1 });
    if (a3) out.push({ ...base, test: 2 });
    out.push({ ...base, test: 3, opp: true });
    if (a1 && a2 && a3) out.push({ ...base, test: 5 });
  }
  return { out, Z, touchT };
}

function newAcc() { const n = NT * 3; return { ms: new Float64Array(n * NM), msNet: new Float64Array(n * NM), n: new Float64Array(n), sum: new Float64Array(n), sq: new Float64Array(n), net: new Float64Array(n) }; }
function add(A, c, w, m, R, cr) { const q = (c * 3 + w) * NM + m; A.ms[q] += R; A.msNet[q] += R - cr; A.n[c * 3 + w]++; A.sum[c * 3 + w] += R; A.sq[c * 3 + w] += R * R; A.net[c * 3 + w] += R - cr; }
const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };

export function runMarket(market) {
  const hold = HOLD.includes(market);
  const M5 = K.load(market, '5m', { from: hold ? '2018-01-01' : '2004-01-01', to: '2026-11-01' }); const F = frames(M5);
  const { out: sigs, Z, touchT } = signals(F, market), cost = COSTS[market], X = exclusions(market);
  const acc = { real: newAcc(), ctl: newAcc() }, seen = new Set(); let n = 0, dropped = 0, past = 0, small = 0, noTarget = 0;
  const win = (t) => (hold ? (t >= HFROM && t < TO ? 2 : -1) : t >= FROM && t < TO ? (t < SPLIT ? 0 : 1) : -1);
  for (const g of sigs) {
    let t, R, risk;
    if (g.kind === 'lim') { const r = limitTrade(M5, g.z, g.stop, cost); if (!r) continue; t = r.t; if (r.none) { if (r.none === 'past') past++; else small++; continue; } R = r.R; risk = r.risk; }
    else {
      const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; t = M5[fi].t;
      const fill = M5[fi].o; risk = g.s * (fill - g.stop); if (!(risk > 0)) { past++; continue; } if (risk < cost) { small++; continue; }
      let tg = 2, cap = CAP;
      if (g.opp) { const p = oppTarget(Z, touchT, g.s, fill, risk, g.ts); if (p == null) { noTarget++; continue; } tg = (g.s * (p - fill)) / risk; cap = CAP4; }
      const r = exits(M5, g.s, fi, g.stop, [tg], cap); if (!r) continue; R = r.R[0];
      if (!(g.s * (fill - g.stop) > 0)) throw new Error('stop on the wrong side');
    }
    const w = win(t); if (w < 0) continue; if (X.length && inBad(X, t)) { dropped++; continue; }
    const key = g.ctl + '|' + g.test + '|' + t + '|' + g.s; if (seen.has(key)) continue; seen.add(key);
    add(g.ctl ? acc.ctl : acc.real, g.test, w, monthOf(t), R, cost / risk); n++;
  }
  const J = (A) => Object.fromEntries(Object.entries(A).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, hold, cost, assumed: !MEASURED.includes(market), first: M5[0].t, last: M5.at(-1).t, zones: Z.length, signals: sigs.length, trades: n, dropped, past, small, noTarget,
    real: J(acc.real), ctl: J(acc.ctl) };
}

export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const hold = HOLD.includes(market), M5 = K.load(market, '5m', { from: hold ? '2018-01-01' : '2004-01-01', to: '2026-11-01' });
  const key = (g) => [g.ctl, g.test, g.ts, g.s, g.stop.toFixed(8), g.kind, g.z.lo.toFixed(8), g.z.hi.toFixed(8)].join('|');
  const full = signals(frames(M5), market).out, out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000; if (T <= M5[0].t + 200 * 86400) continue;
    const cut = signals(frames(M5.filter((b) => b.e <= T)), market).out.filter((g) => g.ts <= T).map(key);
    const want = full.filter((g) => g.ts <= T).map(key); const A = new Set(cut), B = new Set(want);
    out.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length }); }
  return out;
}

// ---- Part B ------------------------------------------------------------------------------------------------------------
export const WINB = { REP: ['2010-01-01', '2019-12-31'], IS: ['2020-01-01', '2023-12-31'], OOS: ['2024-01-01', '2099-12-31'] };
// zones whose first M15 touch closed in the 48 h before d0, with no M15 close beyond the far side since; their sides
export function zoneTagger(F) {
  const L = F['4h'], T = F['15m'], Z = sdBaseZones(L, atr14(L)), ev = [];
  for (const z of Z) { const k = firstTouch(T, z); if (k < 0) continue; let dead = Infinity;
    for (let j = k; j < T.length; j++) if (z.d > 0 ? T[j].c < z.lo : T[j].c > z.hi) { dead = T[j].e; break; }
    ev.push({ d: z.d, tc: T[k].e, dead }); }
  ev.sort((a, b) => a.tc - b.tc);
  return (d0) => { let up = false, dn = false;
    for (let lo = 0, hi = ev.length; ; ) { if (lo >= hi) { for (let q = lo - 1; q >= 0 && ev[q].tc > d0 - TOUCH_B; q--) if (ev[q].tc <= d0 && ev[q].dead > d0) { if (ev[q].d > 0) up = true; else dn = true; } break; }
      const m = (lo + hi) >> 1; if (ev[m].tc <= d0) lo = m + 1; else hi = m; }
    return { up, dn }; };
}
export function vbMarket(mk) {
  const M5 = K.load(mk, '5m', { from: '2009-06-01' }), F = frames(M5), tag = zoneTagger(F);
  const rows = M5.map((b) => [b.t, b.o, b.h, b.l, b.c]), lastDay = new Date(rows.at(-1)[0] * 1000).toISOString().slice(0, 10);
  const days = buildDays(rows).filter((d) => d.day < lastDay && d.day >= '2010-01-01'), out = [];
  for (const d of days) { if (daySkip(d)) continue;
    const x = vbTrade(d.bars, { k: 0.5, sides: 'both', prevRange: d.prevRange, cost: 0 }); if (x.skip) continue;
    const c = costOf(mk, x.entry), fin = mk === 'xau' ? x.finR || 0 : 0, z = tag(d.d0);
    const own = x.side > 0 ? z.up : z.dn, oth = x.side > 0 ? z.dn : z.up;
    out.push({ day: d.day, side: x.side, R: +x.R.toFixed(6), net: +(x.R - c / x.r - fin).toFixed(6), net2: +(x.R - 2 * c / x.r - 2 * fin).toFixed(6),
      tag: own && !oth ? 'kept' : oth && !own ? 'against' : 'neither' }); }
  return out;
}

// ---- statistics and the report -------------------------------------------------------------------------------------------
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const sdv = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : NaN; };
export function welchArr(a, b) { if (a.length < 2 || b.length < 2) return null; const se = Math.sqrt(sdv(a) ** 2 / a.length + sdv(b) ** 2 / b.length); return se > 0 ? (mean(a) - mean(b)) / se : null; }
export function welchS(a, b) { if (a.n < 2 || b.n < 2) return null; const ma = a.sum / a.n, mb = b.sum / b.n;
  const va = (a.sq - a.n * ma * ma) / (a.n - 1), vb = (b.sq - b.n * mb * mb) / (b.n - 1), se = Math.sqrt(va / a.n + vb / b.n); return se > 0 ? (ma - mb) / se : null; }
function pool(list, kind) { const A = newAcc(); for (const d of list) for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += d[kind][k][i]; return A; }
function wstat(A, c, w) { const n = A.n[c * 3 + w], q = c * 3 + w, ms = A.ms.subarray(q * NM, (q + 1) * NM), mn = A.msNet.subarray(q * NM, (q + 1) * NM);
  return { n, mean: n ? A.sum[c * 3 + w] / n : null, meanNet: n ? A.net[c * 3 + w] / n : null, t: n ? mstat(ms, M0[w], M1[w]).t : 0, tNet: n ? mstat(mn, M0[w], M1[w]).t : 0,
    months: M1[w] - M0[w], sum: A.sum[c * 3 + w], sq: A.sq[c * 3 + w] }; }
export function judgeA(data) {
  const R = pool(data, 'real'), C = pool(data, 'ctl'), rows = [];
  for (let c = 0; c < NT; c++) { const s = [0, 1, 2].map((w) => wstat(R, c, w)), k = [0, 1, 2].map((w) => wstat(C, c, w));
    rows.push({ test: c, name: TESTS[c], w: s, ctl: k, vs: [0, 1, 2].map((w) => welchS(s[w], k[w])), p: p1(s[1].t, s[1].months - 1) }); }
  const H = K.holm(rows.map((r) => r.p));
  rows.forEach((r, i) => { const [d, c, h] = r.w, [kd, kc, kh] = r.ctl; r.holm = H[i];
    r.checks = { n: d.n >= 300 && c.n >= 300 && h.n >= 150, before: [d, c, h].every((x) => x.mean > 0 && x.t >= 2), holm: H[i] < 0.05,
      control: (r.vs[0] ?? -9) >= 2 && (r.vs[1] ?? -9) >= 2 && h.mean > (kh.mean ?? Infinity), after: c.meanNet > 0 && h.meanNet > 0 };
    r.pass = Object.values(r.checks).every(Boolean); });
  return rows;
}
const inW = (day, [a, b]) => day >= a && day <= b;
const summ = (a) => ({ n: a.length, R: +mean(a.map((x) => x.R)).toFixed(4), net: +mean(a.map((x) => x.net)).toFixed(4), net2: +mean(a.map((x) => x.net2)).toFixed(4), t: +monthT(a).t.toFixed(2) });
export function judgeB(trades) {
  const out = {}, ps = [];
  for (const [mk, tr] of Object.entries(trades)) {
    const W = {}; for (const [w, rg] of Object.entries(WINB)) { const a = tr.filter((x) => inW(x.day, rg));
      const kept = a.filter((x) => x.tag === 'kept'), ag = a.filter((x) => x.tag === 'against');
      W[w] = { all: summ(a), kept: summ(kept), against: summ(ag), neither: a.filter((x) => x.tag === 'neither').length, diff: +(mean(kept.map((x) => x.net)) - mean(ag.map((x) => x.net))).toFixed(4), welch: welchArr(kept.map((x) => x.net), ag.map((x) => x.net)) }; }
    const all = tr, wt = welchArr(all.filter((x) => x.tag === 'kept').map((x) => x.net), all.filter((x) => x.tag === 'against').map((x) => x.net));
    out[mk] = { windows: W, welch2010: wt == null ? null : +wt.toFixed(2), p: normP(W.OOS.kept.t) }; ps.push(out[mk].p); }
  const H = holm(ps);
  Object.values(out).forEach((o, i) => { const W = o.windows, k = W.OOS.kept; o.holm = H[i];
    o.checks = { oos: k.net > 0 && k.t >= 2 && k.n >= 30, is: W.IS.kept.net > 0, rep: W.REP.kept.net > 0, cost2x: k.net2 > 0,
      adds: ['REP', 'IS', 'OOS'].every((w) => W[w].diff > 0) && (o.welch2010 ?? -9) >= 2, holm: H[i] < 0.05 };
    o.pass = Object.values(o.checks).every(Boolean); });
  return out;
}

export const GATE = { xau: [{ w: 'REP', n: 1841, net: 0.042 }, { w: 'IS', n: 747, net: 0.031 }], usdjpy: [{ w: 'REP', n: 1886, net: 0.046 }, { w: 'IS', n: 761, net: 0.070 }] };
const f3 = (x) => (x == null || !Number.isFinite(x) ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null || !Number.isFinite(x) ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(6), t: +w.t.toFixed(6), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(6), tNet: +w.tNet.toFixed(2) });
export function report(dir) {
  const data = [...MAIN, ...HOLD].map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cut = [...MAIN, ...HOLD].flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const vbT = Object.fromEntries(['xau', 'usdjpy'].map((m) => [m, JSON.parse(fs.readFileSync(path.join(dir, 'vb-' + m + '.json'), 'utf8'))]));
  const A = judgeA(data), B = judgeB(vbT), passA = A.filter((r) => r.pass), passB = Object.entries(B).filter(([, o]) => o.pass).map(([k]) => k);
  const verdict = passA.length || passB.length ? 'PASS' : 'FAIL';
  const bestA = [...A].sort((a, b) => Math.min(b.w[1].t, b.w[2].t) - Math.min(a.w[1].t, a.w[2].t))[0];
  const bo = B.xau.windows.OOS.kept, uo = B.usdjpy.windows.OOS.kept;
  const headline = verdict === 'PASS'
    ? `${passA.length} of 6 supply / demand tests and ${passB.length} of 2 breakout filters pass` + (passA[0] ? `; ${passA[0].name}: ${f3(passA[0].w[1].meanNet)}R a trade after costs in 2015-26 (n ${N(passA[0].w[1].n)}), ${f3(passA[0].w[2].meanNet)}R on the holdout (n ${N(passA[0].w[2].n)})` : '')
    : `0 of 6 supply / demand tests and 0 of 2 breakout filters pass; the best test, ${bestA.name}, made ${f3(bestA.w[1].mean)}R a trade before costs in 2015-26 (n ${N(bestA.w[1].n)}, month t ${f2(bestA.w[1].t)}) and ${f3(bestA.w[2].mean)}R on the holdout (n ${N(bestA.w[2].n)}, t ${f2(bestA.w[2].t)}); breakouts away from a defended zone, 2024 on: gold ${f3(bo.net)}R (n ${bo.n}), USD/JPY ${f3(uo.net)}R (n ${uo.n}) after costs`;
  const out = { study: 'sd-complement', built: '2026-11-24', verdict, headline, basis: 'Part A judged before costs on calendar-month sums, with an after-cost profit required; Part B after costs',
    windows: { discovery: '2005-01-01 to 2014-12-31', confirmation: '2015-01-01 to 2026-10-31', holdout: '2019-02-01 to 2026-10-31 (eight markets)' },
    markets: { main: MAIN, holdout: HOLD }, assumedCosts: data.filter((d) => d.assumed).map((d) => d.market),
    meta: data.map((d) => ({ market: d.market, hold: d.hold, first: new Date(d.first * 1000).toISOString().slice(0, 10), zones: d.zones, trades: d.trades, dropped: d.dropped, past: d.past, small: d.small, noTarget: d.noTarget })),
    partA: A.map((r) => ({ test: r.name, disc: slim(r.w[0]), conf: slim(r.w[1]), hold: slim(r.w[2]), control: { disc: slim(r.ctl[0]), conf: slim(r.ctl[1]), hold: slim(r.ctl[2]) },
      vsControl: r.vs.map((v) => (v == null ? null : +v.toFixed(2))), holm: +r.holm.toFixed(4), checks: r.checks, pass: r.pass })),
    partB: Object.fromEntries(Object.entries(B).map(([k, o]) => [k, { windows: o.windows, welch2010: o.welch2010, holm: +o.holm.toFixed(4), checks: o.checks, pass: o.pass }])),
    passedA: passA.map((r) => r.name), passedB: passB, cut };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), md(out, A, B));
  return out;
}

function md(o, A, B) {
  const L = [], yn = (b) => (b ? 'yes' : 'no');
  L.push('# Supply / demand, completed: what was missing, and the zones as a breakout filter (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## Part A: the parts of a supply / demand trade the plain reading left out', '',
    'H4 base zones (all shapes), first touch on M15, market entry, stop past the far side + 0.1 ATR, 2R, 3 days, as `grid7-sd-wide`,',
    'with ONE addition per test. Ten markets 2005-14 (disc) and 2015-26 (conf); eight holdout markets no supply / demand study had',
    `read, 2019-26 (hold). R a trade before costs (month t), after costs beside. Costs **ASSUMED, not measured** for ${o.assumedCosts.join(', ')}.`, '',
    '| Test | disc n | disc R (t) | conf n | conf R (t) | conf after costs | hold n | hold R (t) | hold after costs | control R disc / conf / hold | vs ctl t (disc / conf) | Holm | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const r of A) { const [d, c, h] = r.w, k = r.ctl;
    L.push(`| ${r.name} | ${N(d.n)} | ${f3(d.mean)} (${f2(d.t)}) | ${N(c.n)} | ${f3(c.mean)} (${f2(c.t)}) | ${f3(c.meanNet)} | ${N(h.n)} | ${f3(h.mean)} (${f2(h.t)}) | ${f3(h.meanNet)} | ${f3(k[0].mean)} / ${f3(k[1].mean)} / ${f3(k[2].mean)} | ${f2(r.vs[0])} / ${f2(r.vs[1])} | ${r.holm.toFixed(3)} | ${r.pass ? 'yes' : 'no'} |`); }
  L.push('', '| Test | n | before costs > 0, t >= 2 (all windows) | Holm | beats control | after costs > 0 (conf, hold) |', '|---|---|---|---|---|---|');
  for (const r of A) L.push(`| ${r.name} | ${yn(r.checks.n)} | ${yn(r.checks.before)} | ${yn(r.checks.holm)} | ${yn(r.checks.control)} | ${yn(r.checks.after)} |`);
  L.push('', '## Part B: the zones as a filter on the two passing breakouts', '',
    'Gold T1 and USD/JPY T1 every day from 2010; kept = a fresh H4 zone of the trade\'s side had its first touch in the 48 hours',
    'before the day\'s open and is still alive, and none of the other side; against = only the other side. R after costs.', '',
    '| Market | Window | all n / net | kept n / net (month t) | kept 2x cost | against n / net | neither | kept - against (Welch t) |', '|---|---|---|---|---|---|---|---|');
  for (const [mk, ob] of Object.entries(B)) for (const [w, x] of Object.entries(ob.windows))
    L.push(`| ${mk} | ${w} | ${x.all.n} / ${f3(x.all.net)} | ${x.kept.n} / ${f3(x.kept.net)} (${f2(x.kept.t)}) | ${f3(x.kept.net2)} | ${x.against.n} / ${f3(x.against.net)} | ${x.neither} | ${f3(x.diff)} (${f2(x.welch)}) |`);
  L.push('');
  for (const [mk, ob] of Object.entries(B)) L.push(`- ${mk}: kept - against over 2010 to now, Welch t ${f2(ob.welch2010)}; Holm on OOS ${ob.holm.toFixed(3)}; checks ${Object.entries(ob.checks).map(([k, v]) => `${k} ${yn(v)}`).join(', ')}: **${ob.pass ? 'PASS' : 'fail'}**.`);
  const nCut = o.cut.reduce((a, x) => a + x.n, 0), bad = o.cut.reduce((a, x) => a + x.missing + x.extra, 0);
  L.push('', '## Checks', '', `- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ')}: ${N(nCut)} Part A signals known by the cut dates, ${bad} missing or extra on candles cut there.`,
    `- Breakout harness: the unfiltered trades here against \`vb-structure-filter\`'s published figures: ${Object.entries(GATE).map(([mk, g]) => g.map((x) => `${mk} ${x.w} ${B[mk].windows[x.w].all.n} / ${f3(B[mk].windows[x.w].all.net)} (published ${x.n} / ${f3(x.net)})`).join('; ')).join('; ')}.`,
    '- Every market-entry trade has its stop on the losing side of the fill (the run throws otherwise); fills past the stop and risks under the round trip are no trades, for the tests and the controls alike.', '',
    '| Market | set | candles from | zones | trades (incl. controls) | past the stop | risk under cost | no opposite target |', '|---|---|---|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.hold ? 'holdout' : 'main'} | ${m.first} | ${N(m.zones)} | ${N(m.trades)} | ${N(m.past)} | ${N(m.small)} | ${N(m.noTarget)} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') L.push('A passing test is a candidate for its own forward paper record and an owner decision. It is not adopted and is never called an edge before that record.');
  else L.push('None of the classic missing pieces (location in the Daily range, the Daily trend, a short base with a structure-breaking leg',
    'out, the opposite zone as target, a resting order at the near line) turns the supply / demand zone into something better than a',
    'random band at the same distance, on the main markets or on eight markets it had never seen. Used as a filter, a freshly',
    'defended zone does not improve the two breakout rules either. The zones add nothing measurable; the two breakouts stay as they',
    'are, judged by their forward records. Do not re-test variants of these tests on these markets and years.');
  L.push('');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = runMarket(a); fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, 'trades', r.trades, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify(r)); console.log(JSON.stringify(r)); }
  else if (cmd === 'vb') { fs.mkdirSync(b, { recursive: true }); const r = vbMarket(a); fs.writeFileSync(path.join(b, 'vb-' + a + '.json'), JSON.stringify(r)); console.log(a, 'vb trades', r.length); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market|cut|vb <m> <dir> | report <dir>');
}
