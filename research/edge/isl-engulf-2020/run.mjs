// research/edge/isl-engulf-2020/run.mjs - ISL-qualified engulf zones against plain engulf zones (PREREGISTRATION.md, 23 Nov 2026).
// node research/edge/isl-engulf-2020/run.mjs market <market> <outDir>   one market: every zone set's trades -> <outDir>/<market>.json
// node research/edge/isl-engulf-2020/run.mjs report <outDir>            pool, apply the pre-registered bar, write result.json here
// node research/edge/isl-engulf-2020/run.mjs cut <market>               the cut test on real candles
// Research only: imports edgekit and the combination grids (egZones, multi, frames, COSTS, exclusions); nothing live.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { multi, frames } from '../combo-grid/run.mjs';
import { engulfAt } from '../../../council/eg-methods.mjs';
import { COSTS, GRID_MARKETS, exclusions } from '../combo-grid-2/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const START = Date.UTC(2020, 0, 1) / 1000, SPLIT = Date.UTC(2024, 0, 1) / 1000;
export const MONTHS = (() => { const out = []; for (let y = 2020; y <= 2026; y++) for (let m = 0; m < 12; m++) { if (y === 2026 && m > 10) break; out.push(Date.UTC(y, m, 1) / 1000); } return out; })();
export const NM = MONTHS.length, IS_M = 48;
export const TFS = ['4h', '1h'];
export const SETS = ['plain', 'islA', 'islB', 'breaks', 'notA'];
export const EXITS = ['2R', 'trail'];
export const LIFE = 120, STEPS = 2, BREAKS = 2;
export const CAP = { '4h': 5 * 86400, '1h': 2 * 86400 };

// ---- pieces -----------------------------------------------------------------------------------------------------------
// the first close through the far side after candle i (inside LIFE candles): { end, fi } (fi -1 = none, end = life's end)
export function closeEnd(L, i, d, bot, top) {
  for (let j = i + 1; j < L.length && j <= i + LIFE; j++) if (d > 0 ? L[j].c < bot : L[j].c > top) return { end: L[j].e, fi: j };
  return { end: i + LIFE < L.length ? L[i + LIFE].e : Infinity, fi: -1 };
}
// A / V levels: turns of the closes, 2 a side, known at the close of m + 2; broken by a later wick (high above an A level, low
// below a V level). Returns the break candle indices, one entry per level, sorted: up (A levels) and dn (V levels).
export function levelBreaks(L) {
  const up = [], dn = [];
  for (let m = 2; m + 2 < L.length; m++) { const x = L[m].c; let a = true, v = true;
    for (let j = 1; j <= 2; j++) { if (!(x > L[m - j].c && x > L[m + j].c)) a = false; if (!(x < L[m - j].c && x < L[m + j].c)) v = false; }
    if (a) for (let j = m + 3; j < L.length; j++) if (L[j].h > x) { up.push(j); break; }
    if (v) for (let j = m + 3; j < L.length; j++) if (L[j].l < x) { dn.push(j); break; }
  }
  up.sort((p, q) => p - q); dn.sort((p, q) => p - q); return { up, dn };
}
// the candle of the second wick break on the zone's side from candle i on, while the zone stands; -1 = none
export function secondBreak(B, d, i, fi) {
  const arr = d > 0 ? B.up : B.dn; let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < i) lo = m + 1; else hi = m; }
  const j2 = arr[lo + BREAKS - 1]; if (j2 == null) return -1;
  if (j2 > i + LIFE - 1) return -1; if (fi >= 0 && j2 >= fi) return -1;
  return j2;
}
// variant A: the base, or up to two candles after it (before the completing candle), swept the candle before it on the trade
// side; the completing close is beyond the chosen candle. Returns the zone candle index or -1.
export function sweepA(L, z) {
  const i = z.i, j0 = z.j;
  for (let c = j0; c <= j0 + STEPS && c < i; c++) { if (c < 1) continue;
    const ok = z.d > 0 ? L[c].h > L[c - 1].h : L[c].l < L[c - 1].l; if (!ok) continue;
    const out = z.d > 0 ? L[i].c > L[c].h : L[i].c < L[c].l; return out && L[c].h > L[c].l ? c : -1; }
  return -1;
}
// variant B: the move after the base (to the completing candle) took the extreme of the candle before the base
export function sweepB(L, z) {
  const j0 = z.j; if (j0 < 1) return false; const p = L[j0 - 1];
  for (let c = j0 + 1; c <= z.i; c++) if (z.d > 0 ? L[c].h > p.h : L[c].l < p.l) return true;
  return false;
}
// plain zones = the combo grid's egZones(L, 3), written out again only to keep the base index j (the test compares the two)
const conv = (B) => B.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));
export function plainZones(L) {
  const C = conv(L), out = [];
  for (let i = 1; i < L.length; i++) { const e = engulfAt(C, i, 3); if (!e) continue; const p = L[e.j]; let gone = false;
    for (let q = e.j + 1; q < i && !gone; q++) { const b = L[q]; gone = e.dir > 0 ? (b.c > b.o && b.c > p.h) || b.c < p.l : (b.c < b.o && b.c < p.l) || b.c > p.h; }
    if (gone || !(p.h > p.l)) continue;
    const z = { d: e.dir, bot: p.l, top: p.h, at: L[i].e, i, j: e.j }; Object.assign(z, closeEnd(L, i, z.d, z.bot, z.top)); out.push(z); }
  return out;
}
// every order of one timeframe: { set, d, at (known), end (expiry), bot, top }
export function orders(L) {
  const Z = plainZones(L), B = levelBreaks(L), out = [];
  for (const z of Z) {
    out.push({ set: 'plain', d: z.d, at: z.at, end: z.end, bot: z.bot, top: z.top });
    const ia = sweepA(L, z);
    if (ia >= 0) { const bot = L[ia].l, top = L[ia].h, ce = closeEnd(L, z.i, z.d, bot, top), j2 = secondBreak(B, z.d, z.i, ce.fi);
      if (j2 >= 0) out.push({ set: 'islA', d: z.d, at: L[j2].e, end: ce.end, bot, top }); }
    const j2p = secondBreak(B, z.d, z.i, z.fi);
    if (j2p >= 0) { out.push({ set: 'breaks', d: z.d, at: L[j2p].e, end: z.end, bot: z.bot, top: z.top });
      if (sweepB(L, z)) out.push({ set: 'islB', d: z.d, at: L[j2p].e, end: z.end, bot: z.bot, top: z.top }); }
    // the zones whose sweep (variant A) failed, known at the completing close; traded as plain zones (descriptive)
    if (ia < 0) out.push({ set: 'notA', d: z.d, at: z.at, end: z.end, bot: z.bot, top: z.top });
  }
  return out;
}

// ---- one market --------------------------------------------------------------------------------------------------------
const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
export function runMarket(market, { from = '2019-03-01', to } = {}) {
  const M5 = K.load(market, '5m', { from, to }), F = frames(M5), cost = COSTS[market], X = exclusions(market);
  const rows = [], cache = new Map(); let nOrd = 0, nSkip = 0, nBad = 0, nStopBad = 0;
  TFS.forEach((tf, ti) => {
    for (const o of orders(F[tf])) {
      if (o.at < START - 30 * 86400) continue; nOrd++;
      const s = o.d, entry = s > 0 ? o.top : o.bot, stop = s > 0 ? o.bot - cost / 2 : o.top + cost / 2;
      if (!(s * (entry - stop) > 0)) { nStopBad++; continue; }
      if (s * (entry - stop) < 2 * cost) { nSkip++; continue; }
      const key = `${ti}|${s}|${o.at}|${entry}|${stop}|${o.end}`;
      let r = cache.get(key); if (r === undefined) { r = multi(M5, s, entry, stop, 'lim', o.at, o.end, 2, CAP[tf]); cache.set(key, r); }
      if (!r || r.t < START) continue;
      if (inBad(X, r.t)) { nBad++; continue; }
      rows.push([SETS.indexOf(o.set), ti, r.t, +r.R[1].toFixed(5), +r.R[6].toFixed(5), +(cost / r.risk).toFixed(6)]);
    }
  });
  return { market, rows, nOrd, nSkip, nBad, nStopBad, sims: cache.size, bars: M5.length, last: M5[M5.length - 1].t };
}

// ---- statistics ----------------------------------------------------------------------------------------------------------
const mIdx = (t) => { let lo = 0, hi = NM; while (lo < hi) { const m = (lo + hi) >> 1; if (MONTHS[m] <= t) lo = m + 1; else hi = m; } return lo - 1; };
export function mstat(ms, a, b) { const n = b - a; let s = 0, q = 0; for (let m = a; m < b; m++) { s += ms[m]; q += ms[m] * ms[m]; }
  const mean = s / n, sd = Math.sqrt(Math.max(0, (q - n * mean * mean) / (n - 1))); return { sum: s, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : 0 }; }
const mv = (xs) => { const n = xs.length; if (!n) return { n: 0, mean: null, v: null }; const mean = xs.reduce((a, b) => a + b, 0) / n; return { n, mean, v: n > 1 ? xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0 }; };
export function welch(a, b) { const x = mv(a), y = mv(b); if (x.n < 2 || y.n < 2) return { diff: null, t: null }; const se = Math.sqrt(x.v / x.n + y.v / y.n); return { diff: x.mean - y.mean, t: se > 0 ? (x.mean - y.mean) / se : null }; }
const r4 = (x) => (x == null ? null : +x.toFixed(4)), r2 = (x) => (x == null ? null : +x.toFixed(2));
// rows of one set / tf / exit -> discovery and confirmation summary (after costs), and the confirmation at twice the cost
export function summary(rows, xi) {
  const ms = new Float64Array(NM), R = { is: [], oos: [] }; let c2 = 0, w = { is: 0, oos: 0 };
  for (const r of rows) { const m = mIdx(r[2]); if (m < 0) continue; const Rn = r[3 + xi] - r[5], oos = r[2] >= SPLIT;
    ms[m] += Rn; (oos ? R.oos : R.is).push(Rn); if (Rn > 0) w[oos ? 'oos' : 'is']++; if (oos) c2 += r[5]; }
  const a = mstat(ms, 0, IS_M), b = mstat(ms, IS_M, NM), nI = R.is.length, nO = R.oos.length;
  return { is: { n: nI, meanR: nI ? r4(a.sum / nI) : null, monthT: r2(a.t), winRate: nI ? r4(w.is / nI) : null },
    oos: { n: nO, meanR: nO ? r4(b.sum / nO) : null, monthT: r2(b.t), winRate: nO ? r4(w.oos / nO) : null, meanR2c: nO ? r4((b.sum - c2) / nO) : null },
    _R: R };
}
const p1 = (t, df) => { const p = K.pFromT(t, df); return t > 0 ? p / 2 : 1 - p / 2; };

export function report(dir, markets = GRID_MARKETS) {
  const data = {}; for (const m of markets) data[m] = JSON.parse(fs.readFileSync(path.join(dir, `${m}.json`), 'utf8'));
  const pick = (mk, si, ti) => (mk ? [mk] : markets).flatMap((m) => data[m].rows.filter((r) => r[0] === si && r[1] === ti));
  const tests = [];
  TFS.forEach((tf, ti) => EXITS.forEach((ex, xi) => {
    const q = summary(pick(null, 1, ti), xi), p = summary(pick(null, 0, ti), xi);
    const dIs = welch(q._R.is, p._R.is), dOos = welch(q._R.oos, p._R.oos);
    tests.push({ tf, exit: ex, isl: strip(q), plain: strip(p),
      diff: { is: { diff: r4(dIs.diff), welchT: r2(dIs.t) }, oos: { diff: r4(dOos.diff), welchT: r2(dOos.t) } } });
  }));
  const adj = K.holm(tests.map((t) => p1(t.isl.oos.monthT, NM - IS_M - 1)));
  tests.forEach((t, i) => { const a = t.isl.is, b = t.isl.oos; t.holm = +adj[i].toPrecision(3);
    t.checks = { isN: a.n >= 100, isMean: a.meanR > 0, isT: a.monthT >= 2, oosN: b.n >= 50, oosMean: b.meanR > 0, oosT: b.monthT >= 2, holm: t.holm < 0.05, cost2: b.meanR2c > 0 };
    t.pass = Object.values(t.checks).every(Boolean); });
  // descriptive tables: every set, pooled and gold; and each market alone (the tested set)
  const desc = {};
  for (const scope of ['pool', 'xau']) { desc[scope] = {};
    TFS.forEach((tf, ti) => EXITS.forEach((ex, xi) => SETS.forEach((st, si) => { desc[scope][`${tf}/${ex}/${st}`] = strip(summary(pick(scope === 'pool' ? null : 'xau', si, ti), xi)); }))); }
  const qVsNot = {}; TFS.forEach((tf, ti) => EXITS.forEach((ex, xi) => { const q = summary(pick(null, 1, ti), xi), n = summary(pick(null, 4, ti), xi);
    qVsNot[`${tf}/${ex}`] = { is: welchR(q._R.is, n._R.is), oos: welchR(q._R.oos, n._R.oos) }; }));
  const byMarket = {}; for (const m of markets) { byMarket[m] = {}; TFS.forEach((tf, ti) => EXITS.forEach((ex, xi) => { const s = strip(summary(pick(m, 1, ti), xi)); byMarket[m][`${tf}/${ex}`] = { isN: s.is.n, isMean: s.is.meanR, oosN: s.oos.n, oosMean: s.oos.meanR }; })); }
  const passed = tests.filter((t) => t.pass).length;
  const meta = Object.fromEntries(markets.map((m) => [m, { orders: data[m].nOrd, skippedSmall: data[m].nSkip, droppedBadData: data[m].nBad, last: data[m].last }]));
  return { passed, tests, desc, qVsNot, byMarket, meta };
}
const strip = (s) => ({ is: s.is, oos: s.oos });
const welchR = (a, b) => { const w = welch(a, b); return { diff: r4(w.diff), welchT: r2(w.t), nA: a.length, nB: b.length }; };

// ---- the cut test ----------------------------------------------------------------------------------------------------------
// orders known at or before a cut must be the same (side, time known, zone) when every candle after the cut is removed
export function cutCheck(M5, cuts, tf) {
  const sec = K.TF[tf], full = orders(K.resample(M5, sec)); let compared = 0, mism = 0;
  const key = (o) => `${o.set}|${o.d}|${o.at}|${o.bot}|${o.top}`;
  for (const T of cuts) { const part = M5.filter((b) => b.e <= T), got = new Set(orders(K.resample(part, sec)).filter((o) => o.at <= T).map(key));
    const want = full.filter((o) => o.at <= T).map(key); compared += want.length; for (const k of want) if (!got.has(k)) mism++;
    if (got.size !== new Set(want).size) mism += Math.abs(got.size - new Set(want).size); }
  return { compared, mismatches: mism };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { const t0 = Date.now(); const out = runMarket(a); fs.mkdirSync(b, { recursive: true }); fs.writeFileSync(path.join(b, `${a}.json`), JSON.stringify(out));
    console.log(a, out.rows.length, 'trades', out.sims, 'sims', ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'report') { const R = report(a); fs.writeFileSync(path.join(a, 'report.json'), JSON.stringify(R, null, 1));
    console.log(JSON.stringify({ passed: R.passed, tests: R.tests.map((t) => ({ tf: t.tf, exit: t.exit, isl: t.isl, plain: t.plain, diff: t.diff, holm: t.holm, pass: t.pass })) }, null, 1)); }
  else if (cmd === 'cut') { const M5 = K.load(a, '5m', { from: '2023-01-01', to: '2023-07-01' }); const cuts = []; for (let T = Date.UTC(2023, 2, 1) / 1000; T < Date.UTC(2023, 6, 1) / 1000; T += 7 * 86400 + 4 * 14400) cuts.push(T);
    for (const tf of TFS) console.log(tf, JSON.stringify(cutCheck(M5, cuts, tf))); }
  else console.log('usage: run.mjs market <m> <dir> | report <dir> | cut <m>');
}
