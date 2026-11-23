// research/edge/mosha-barrier-wide/run.mjs - the Mosha barrier entry with MARKET fills on ten markets (PREREGISTRATION.md,
// 23 Nov 2026). The desk's barrier boxes (assets/mosha-sop.js zonesOf, imported) and its QM confirmation (swingEv, copied);
// 36 cells, discovery 2005-14, confirmation 2015 to Oct 2026, judged before costs on month sums against a no-barrier control.
// Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/mosha-barrier-wide/run.mjs market <m> <outDir>
//   EDGE_DATA=<cache> node research/edge/mosha-barrier-wide/run.mjs cut <m> <outDir>
//   node research/edge/mosha-barrier-wide/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';

const require = createRequire(import.meta.url), SOP = require('../../../assets/mosha-sop.js');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (Y, M = 0) => Date.UTC(Y, M, 1) / 1000;
export const MARKETS = ['xau', 'xag', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy'];
export const ASSUMED = ['xag', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy'];
export const TFS = ['4h', '1h'], KINDS = ['bo', 'ibo', 'eg'], DIRS = ['with', 'against'], EXITS = [1, 3, 6];
export const CONF = { '4h': '15m', '1h': '5m' }, UP = { '4h': '1d', '1h': '4h' };
export const SEC = { '1d': 86400, '4h': 14400, '1h': 3600, '15m': 900, '5m': 300 };
export const WATCH = 60, SWING_AGE = 30, CAP = 5 * 86400, WIN = 1500, REF = 4000;
export const FROM = y(2005), SPLIT = y(2015), TO = y(2026, 10);
export const NM = 262, DM = 120, NCELL = 36;
export const cellIndex = (tf, k, dr, x) => ((tf * 3 + k) * 2 + dr) * 3 + x;
export function cellName(i) { const x = i % 3; i = (i - x) / 3; const dr = i % 2; i = (i - dr) / 2; const k = i % 3; const tf = (i - k) / 3;
  return { tf: TFS[tf], kind: KINDS[k], dir: DIRS[dr], exit: EXITS[x] + 'R', itf: tf, ik: k, idr: dr, ix: x }; }
export const monthOf = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2005) * 12 + d.getUTCMonth(); };
// the desk's sizes: gold's dollars, the same share of price elsewhere (assets/mosha-sop.js sizes, for every market)
export const sizes = (mk, px) => { const q = mk === 'xau' ? 1 : px / REF; return { buf: 0.3 * q, rmin: 0.8 * q, rmax: 25 * q, zmin: 0.5 * q }; };

const toDesk = (b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c });
export function group(M5, sec) { // UTC buckets; the last one dropped while it could still be forming
  const out = [];
  for (const b of M5) { const t = b.time - (b.time % sec), q = out[out.length - 1];
    if (q && q.time === t) { if (b.high > q.high) q.high = b.high; if (b.low < q.low) q.low = b.low; q.close = b.close; }
    else out.push({ time: t, open: b.open, high: b.high, low: b.low, close: b.close }); }
  const last = M5.length ? M5[M5.length - 1].time + 300 : 0;
  if (out.length && out[out.length - 1].time + sec > last) out.pop();
  return out;
}
const at = (A, t) => { let lo = 0, hi = A.length; while (lo < hi) { const m = (lo + hi) >> 1; if (A[m].time < t) lo = m + 1; else hi = m; } return lo; };

export function candles(mk, end = Infinity) {
  const M5 = K.load(mk, '5m', { from: '2004-01-01', to: '2026-11-01' }).filter((b) => b.e <= end).map(toDesk);
  const B = { '5m': M5 };
  for (const tf of ['15m', '1h', '4h']) B[tf] = group(M5, SEC[tf]);
  B['1d'] = K.load(mk, '1d', { from: '2003-01-01', to: '2026-11-01' }).filter((b) => b.e <= end).map(toDesk);
  return B;
}

// the desk's swingEv (assets/mosha-sop.js, not exported): the small-swing breaks of a window, 3 candles a side
function swingEv(F, W) {
  const ev = F.msAnalyze(W, 3).events, out = [];
  for (let k = 0; k < ev.length; k++) { const e = ev[k]; out.push({ dir: e.dir, level: e.level, structure: !!e.structure, fromIdx: e.fromIdx, breakIdx: e.breakIdx }); }
  return out;
}

function seedU(...p) { let h = 2166136261; for (const c of p.join('|')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return K.rng(h >>> 0)(); }

// ---- signals: [{ tf, kind, ctl, d, wd (1 with / 0 against / null), t0 (return), tq (QM close), stop }] -----------------
export function signals(B, F, mk) {
  const out = [], M5 = B['5m'];
  for (const zt of TFS) {
    const H = B[zt], ctf = CONF[zt], C = B[ctf], up = UP[zt], UH = B[up];
    if (!H.length || !C.length) continue;
    const qmMemo = new Map(), dirMemo = new Map();
    const qmAt = (i) => { if (qmMemo.has(i)) return qmMemo.get(i); const W = C.slice(Math.max(0, i - 240), i + 1), ev = swingEv(F, W), e = ev[ev.length - 1];
      const r = e && e.breakIdx === W.length - 1 ? { dir: e.dir, structure: e.structure, fromT: W[e.fromIdx].time } : null; qmMemo.set(i, r); return r; };
    const dirAt = (t) => { const n = at(UH, t - SEC[up] + 1); if (!dirMemo.has(n)) { const Hw = UH.slice(Math.max(0, n - WIN), n), A = Hw.length > 20 ? F.msAnalyze(Hw, 6) : null; dirMemo.set(n, A && A.trend ? A.trend : 0); } return dirMemo.get(n); };
    const zs = SOP.zonesOf(zt, B, F, {}).filter((z) => KINDS.includes(z.kind));
    const bands = [];
    for (const z of zs) {
      bands.push({ ...z, ctl: false });
      // the control twin: same side and height, near edge at u x D from the close that completed the box
      const ki = at(H, z.known - SEC[zt]); if (ki >= H.length) continue; const P = H[ki].close, h = z.hi - z.lo;
      const D = Math.max(h, z.dir > 0 ? P - z.hi : z.lo - P), u = 0.5 + seedU(mk, zt, z.kind, z.known, z.dir);
      const near = z.dir > 0 ? P - u * D : P + u * D, lo = z.dir > 0 ? near - h : near, hi = z.dir > 0 ? near : near + h;
      let touch = null; for (let q = at(H, z.known); q < H.length; q++) if (z.dir < 0 ? H[q].high >= lo : H[q].low <= hi) { touch = H[q].time; break; }
      bands.push({ tf: zt, dir: z.dir, lo, hi, kind: z.kind, known: z.known, touch, ctl: true });
    }
    for (const z of bands) {
      if (!z.touch || !(z.hi - z.lo > sizes(mk, z.hi).zmin)) continue;
      const d = z.dir, h = z.hi - z.lo;
      let q = at(M5, z.touch), hit = -1;
      for (; q < M5.length && M5[q].time < z.touch + SEC[zt]; q++) if (d < 0 ? M5[q].high >= z.lo : M5[q].low <= z.hi) { hit = q; break; }
      if (hit < 0) continue; const t0 = M5[hit].time;
      let x = d < 0 ? -Infinity : Infinity, sig = null;
      for (let i = at(C, t0 - SEC[ctf] + 1); i < C.length && C[i].time < t0 + WATCH * SEC[ctf]; i++) { const c = C[i];
        x = d < 0 ? Math.max(x, c.high) : Math.min(x, c.low);
        if (d < 0 ? c.close > z.hi + h : c.close < z.lo - h) break;
        const e = qmAt(i); if (!e) continue;
        if (e.dir === d && e.structure && e.fromT >= t0 - SWING_AGE * SEC[ctf]) { sig = { tq: c.time + SEC[ctf], close: c.close }; break; }
      }
      if (!sig) continue;
      const ud = dirAt(t0), buf = sizes(mk, sig.close).buf;
      out.push({ tf: zt, kind: z.kind, ctl: z.ctl, d, wd: ud ? (ud === d ? 1 : 0) : null, t0, tq: sig.tq, stop: d > 0 ? x - buf : x + buf });
    }
  }
  return out;
}

// ---- one trade at 1R / 3R / 6R in one pass (market fill at the open of candle fi; stop first in a candle holding both) ---
export function exits(M5, s, fi, stop, cap = CAP) {
  const fill = M5[fi].open, risk = s * (fill - stop); if (!(risk > 0)) return null;
  const tg = EXITS.map((k) => fill + k * s * risk), R = EXITS.map(() => NaN), dl = M5[fi].time + cap; let left = EXITS.length;
  const fin = (k, px) => { if (Number.isNaN(R[k])) { R[k] = (s * (px - fill)) / risk; left--; } };
  for (let j = fi; j < M5.length && left; j++) { const b = M5[j];
    if (j > fi) { if (s * (b.open - stop) <= 0) EXITS.forEach((_, k) => fin(k, b.open)); else tg.forEach((g, k) => { if (s * (b.open - g) >= 0) fin(k, b.open); }); }
    const low = s > 0 ? b.low : b.high, high = s > 0 ? b.high : b.low;
    if (s * (low - stop) <= 0) EXITS.forEach((_, k) => fin(k, stop));
    tg.forEach((g, k) => { if (s * (high - g) >= 0) fin(k, g); });
    if (b.time + 300 >= dl) EXITS.forEach((_, k) => fin(k, b.close)); }
  return left ? null : { fill, risk, R };
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
export function newAcc() { return { ms: new Float64Array(NCELL * NM), msNet: new Float64Array(NCELL * NM), n: new Float64Array(NCELL * 2), sum: new Float64Array(NCELL * 2),
  sq: new Float64Array(NCELL * 2), net: new Float64Array(NCELL * 2), win: new Float64Array(NCELL * 2) }; }
function add(A, c, w, m, R, cr) { A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; A.n[c * 2 + w]++; A.sum[c * 2 + w] += R; A.sq[c * 2 + w] += R * R; A.net[c * 2 + w] += R - cr; if (R > 0) A.win[c * 2 + w]++; }

export async function runMarket(mk) {
  const { loadFns } = await import('../../../council/mosha-desk.mjs');
  const F = loadFns(), B = candles(mk), M5 = B['5m'], sigs = signals(B, F, mk), cost = COSTS[mk], X = exclusions(mk);
  const real = newAcc(), ctl = newAcc(), flip = newAcc(), seen = new Set(); const cnt = { realTrades: 0, ctlTrades: 0, nodir: 0, dropped: 0, bad: 0, limits: 0, small: 0 };
  for (const g of sigs) {
    if (g.wd == null) { cnt.nodir++; continue; }
    const fi = at(M5, g.tq); if (fi >= M5.length) continue; const t = M5[fi].time; if (t < FROM || t >= TO) continue;
    const key = [g.ctl, g.tf, g.kind, g.d, t, g.stop].join('|'); if (seen.has(key)) continue; seen.add(key);
    if (X.length && inBad(X, t)) { cnt.dropped++; continue; }
    const fill = M5[fi].open, risk = g.d * (fill - g.stop), Z = sizes(mk, fill);
    if (!(risk > 0)) { cnt.bad++; continue; }
    if (!(risk > Z.rmin) || risk > Z.rmax) { cnt.limits++; continue; }
    if (risk < cost) { cnt.small++; continue; }
    const r = exits(M5, g.d, fi, g.stop); if (!r) continue;
    if (!(g.d * (r.fill - g.stop) > 0)) throw new Error('stop on the wrong side');
    const m = monthOf(t), w = t < SPLIT ? 0 : 1, cr = cost / risk, base = [TFS.indexOf(g.tf), KINDS.indexOf(g.kind), g.wd ? 0 : 1];
    const A = g.ctl ? ctl : real; cnt[g.ctl ? 'ctlTrades' : 'realTrades']++;
    const p = g.ctl ? null : exits(M5, -g.d, fi, fill + g.d * risk);
    for (let x = 0; x < 3; x++) { const ci = cellIndex(...base, x); add(A, ci, w, m, r.R[x], cr); if (p) add(flip, ci, w, m, p.R[x], cr); }
  }
  const J = (A) => Object.fromEntries(Object.entries(A).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market: mk, cost, assumed: ASSUMED.includes(mk), first: M5.length ? M5[0].time : null, last: M5.length ? M5[M5.length - 1].time : null,
    signals: sigs.length, ...cnt, real: J(real), ctl: J(ctl), flip: J(flip) };
}

// ---- cut test: the signals known by a date (QM closed), computed on candles cut there, equal the full run's ------------------
export async function cutTest(mk, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const { loadFns } = await import('../../../council/mosha-desk.mjs');
  const F = loadFns(), key = (g) => [g.ctl, g.tf, g.kind, g.d, g.wd, g.t0, g.tq, g.stop.toFixed(8)].join('|');
  const full = signals(candles(mk), F, mk), out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000;
    const cut = signals(candles(mk, T), F, mk).filter((g) => g.tq <= T).map(key), want = full.filter((g) => g.tq <= T).map(key);
    const A = new Set(cut), Bs = new Set(want);
    out.push({ market: mk, cut: c, n: Bs.size, missing: [...Bs].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !Bs.has(k)).length }); }
  return out;
}

// ---- statistics -----------------------------------------------------------------------------------------------------------
export function mstat(ms, a, b) { const n = b - a; let s = 0, q = 0; for (let m = a; m < b; m++) { s += ms[m]; q += ms[m] * ms[m]; }
  const mean = s / n, sd = Math.sqrt(Math.max(0, (q - n * mean * mean) / (n - 1))); return { months: n, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : 0 }; }
export const p1 = (t, df) => { const p = K.pFromT(t, df); return p == null ? 1 : t > 0 ? p / 2 : 1 - p / 2; };
export function welch(a, b) { if (a.n < 2 || b.n < 2) return null; const ma = a.sum / a.n, mb = b.sum / b.n;
  const va = (a.sq - a.n * ma * ma) / (a.n - 1), vb = (b.sq - b.n * mb * mb) / (b.n - 1), se = Math.sqrt(va / a.n + vb / b.n); return se > 0 ? (ma - mb) / se : null; }
export function pool(list, kind) { const A = newAcc(); for (const d of list) { const S = d[kind]; for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += S[k][i]; } return A; }
export function cellStats(A, c) {
  const ms = A.ms.subarray(c * NM, (c + 1) * NM), msn = A.msNet.subarray(c * NM, (c + 1) * NM);
  const win = (w) => { const n = A.n[c * 2 + w], a = w ? DM : 0, b = w ? NM : DM;
    return { n, mean: n ? A.sum[c * 2 + w] / n : null, t: mstat(ms, a, b).t, meanNet: n ? A.net[c * 2 + w] / n : null, tNet: mstat(msn, a, b).t,
      win: n ? A.win[c * 2 + w] / n : null, months: b - a, sum: A.sum[c * 2 + w], sq: A.sq[c * 2 + w] }; };
  return { d: win(0), c: win(1) };
}
const ok3 = (x) => x.d.n >= 300 && x.c.n >= 300 && x.d.mean > 0 && x.c.mean > 0 && x.d.t >= 2 && x.c.t >= 2;
export function judge(data) {
  const R = pool(data, 'real'), Cc = pool(data, 'ctl'), P = pool(data, 'flip'), rows = [];
  for (let c = 0; c < NCELL; c++) { const s = cellStats(R, c), cs = cellStats(Cc, c), ps = cellStats(P, c);
    rows.push({ cell: c, ...cellName(c), d: s.d, c: s.c, p: p1(s.c.t, s.c.months - 1), ctl: cs, vs: { d: welch(s.d, cs.d), c: welch(s.c, cs.c) }, flip: { d: ps.d, c: ps.c, p: p1(ps.c.t, ps.c.months - 1) } }); }
  const H = K.holm(rows.map((r) => r.p)), HP = K.holm(rows.map((r) => r.flip.p));
  rows.forEach((r, i) => { r.holm = H[i]; r.flip.holm = HP[i];
    r.checks = { n: r.d.n >= 300 && r.c.n >= 300, disc: r.d.mean > 0 && r.d.t >= 2, conf: r.c.mean > 0 && r.c.t >= 2, holm: H[i] < 0.05,
      control: !!(r.vs.d != null && r.vs.c != null && r.vs.d >= 2 && r.vs.c >= 2) };
    r.pass = Object.values(r.checks).every(Boolean); r.flip.pass = ok3(r.flip) && HP[i] < 0.05; });
  return rows;
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
export const cname = (r) => `${r.tf} ${r.kind} ${r.dir} ${r.exit}`;
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(6), t: +w.t.toFixed(6), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(6), tNet: +w.tNet.toFixed(2),
  win: w.win == null ? null : +w.win.toFixed(3) });

export function report(dir) {
  const data = MARKETS.map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cut = MARKETS.flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const rows = judge(data), pass = rows.filter((r) => r.pass), flipPass = rows.filter((r) => r.flip.pass);
  const verdict = pass.length ? 'PASS' : 'FAIL';
  const bestC = [...rows].sort((a, b) => b.c.t - a.c.t)[0];
  const tot = (A, w) => { let n = 0, s = 0, nt = 0; for (const r of rows.filter((x) => x.exit === '1R')) { const st = cellStats(A, r.cell)[w]; n += st.n; s += st.sum; nt += st.meanNet * st.n || 0; } return { n, mean: n ? s / n : null, meanNet: n ? nt / n : null }; };
  const RA = pool(data, 'real'), CA = pool(data, 'ctl');
  const all1R = { real: { disc: tot(RA, 'd'), conf: tot(RA, 'c') }, control: { disc: tot(CA, 'd'), conf: tot(CA, 'c') } };
  const perMarket = {}; for (const r of pass) perMarket[r.cell] = data.map((d) => { const s = cellStats(pool([d], 'real'), r.cell); return { market: d.market, d: slim(s.d), c: slim(s.c) }; });
  const headline = verdict === 'PASS'
    ? `${pass.length} of 36 cells pass: best ${cname(pass[0])}, ${f3(pass[0].c.mean)}R a trade before costs in 2015-26 (n ${N(pass[0].c.n)}, month t ${f2(pass[0].c.t)})`
    : `0 of 36 cells pass; the best confirmation cell, ${cname(bestC)}, made ${f3(bestC.c.mean)}R a trade before costs in 2015-26 (n ${N(bestC.c.n)}, month t ${f2(bestC.c.t)}; discovery ${f3(bestC.d.mean)}R, t ${f2(bestC.d.t)})`;
  const RW = rows.map((r) => ({ cell: cname(r), tf: r.tf, kind: r.kind, dir: r.dir, exit: r.exit, disc: slim(r.d), conf: slim(r.c), holm: +r.holm.toFixed(4),
    control: { disc: slim(r.ctl.d), conf: slim(r.ctl.c) }, vsControl: { d: r.vs.d == null ? null : +r.vs.d.toFixed(2), c: r.vs.c == null ? null : +r.vs.c.toFixed(2) },
    checks: r.checks, pass: r.pass, flipped: { disc: slim(r.flip.d), conf: slim(r.flip.c), holm: +r.flip.holm.toFixed(4), pass: r.flip.pass } }));
  const out = { study: 'mosha-barrier-wide', built: '2026-11-23', verdict, headline, basis: 'judged before costs on calendar-month sums (pre-registered); after costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' }, markets: MARKETS,
    assumedCosts: ASSUMED, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    meta: data.map((d) => ({ market: d.market, first: d.first ? new Date(d.first * 1000).toISOString().slice(0, 10) : null, last: d.last ? new Date(d.last * 1000).toISOString().slice(0, 10) : null,
      signals: d.signals, trades: d.realTrades, controls: d.ctlTrades, nodir: d.nodir, dropped: d.dropped, bad: d.bad, limits: d.limits, small: d.small })),
    passed: pass.map(cname), flippedPassed: flipPass.map(cname), bestConfirmation: cname(bestC), all1R, cut, cells: RW, perMarket };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, rows));
  return out;
}

function resultMd(o, rows) {
  const nCut = o.cut.reduce((a, x) => a + x.n, 0), badCut = o.cut.reduce((a, x) => a + x.missing + x.extra, 0), cnt = (f) => rows.filter(f).length;
  const L = ['# The Mosha barrier entry with market fills, ten markets (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    'The desk\'s barrier boxes on H4 and H1 (`assets/mosha-sop.js` `zonesOf`, imported: major BO origin, internal BO origin, engulf',
    'zone), first return only; the QM (BO Structure) with the barrier on the table\'s timeframe (H4 on M15, H1 on M5) within 60',
    'candles, read as the desk reads it; then a MARKET entry at the next 5-minute open, stop past the extreme made at the barrier',
    'by the desk\'s buffer (as a share of price off gold), targets 1R / 3R / 6R, 5-day limit. Split by the structure of the',
    'timeframe above (with / against). Control: a band of the same height and side at a matched random distance, run through the',
    'same steps. Ten markets pooled, OANDA mid candles; discovery = fills 2005-2014, confirmation = 2015 to October 2026.',
    `Costs after the fact only; **ASSUMED, not measured** for ${o.assumedCosts.join(', ')}.`, '',
    '## The bar, cell by cell', '',
    `- n >= 300 in both windows: ${cnt((r) => r.checks.n)} of 36.`,
    `- Mean R > 0 and month t >= 2 in discovery: ${cnt((r) => r.checks.disc)}; in confirmation: ${cnt((r) => r.checks.conf)}; both: ${cnt((r) => r.checks.disc && r.checks.conf)}.`,
    `- Holm-adjusted p < 0.05 over the 36 confirmation tests: ${cnt((r) => r.checks.holm)}.`,
    `- Beats its control (Welch t >= 2 in both windows): ${cnt((r) => r.checks.control)} of 36.`,
    `- **All four: ${o.passed.length}${o.passed.length ? ' (' + o.passed.join('; ') + ')' : ''}.**`,
    `- Side-flipped trades passing bars 1-3: ${o.flippedPassed.length}${o.flippedPassed.length ? ' (' + o.flippedPassed.join('; ') + ')' : ''}.`, '',
    `All 1R cells pooled (barriers): discovery ${f3(o.all1R.real.disc.mean)}R a trade before costs over ${N(o.all1R.real.disc.n)} trades (${f3(o.all1R.real.disc.meanNet)}R after),`,
    `confirmation ${f3(o.all1R.real.conf.mean)}R over ${N(o.all1R.real.conf.n)} (${f3(o.all1R.real.conf.meanNet)}R after). The control bands at 1R: discovery`,
    `${f3(o.all1R.control.disc.mean)}R over ${N(o.all1R.control.disc.n)}, confirmation ${f3(o.all1R.control.conf.mean)}R over ${N(o.all1R.control.conf.n)}.`, '',
    '## Every cell', '',
    'R a trade before costs (month-sum t), after costs beside; control = the no-barrier bands of that cell; "vs ctl" = Welch t of',
    'the cell against its control (discovery / confirmation); Holm on the confirmation test; flipped = the same trades taken the',
    'other way.', '',
    '| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | ctl R 05-14 / 15-26 | vs ctl | Holm | Flipped R 15-26 (t) | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|'];
  for (const r of rows) L.push(`| ${cname(r)} | ${N(r.d.n)} | ${f3(r.d.mean)} (${f2(r.d.t)}) | ${f3(r.d.meanNet)} | ${N(r.c.n)} | ${f3(r.c.mean)} (${f2(r.c.t)}) | ${f3(r.c.meanNet)} | ${f3(r.ctl.d.mean)} / ${f3(r.ctl.c.mean)} | ${f2(r.vs.d)} / ${f2(r.vs.c)} | ${r.holm.toFixed(3)} | ${f3(r.flip.c.mean)} (${f2(r.flip.c.t)}) | ${r.pass ? 'yes' : 'no'} |`);
  L.push('');
  if (o.passed.length) { L.push('## Per market, passing cells', ''); for (const [c, list] of Object.entries(o.perMarket)) { L.push(`### ${cname(rows[c])}`, '', '| Market | n 05-14 | R (t) | n 15-26 | R (t) |', '|---|---:|---:|---:|---:|');
    for (const x of list) L.push(`| ${x.market} | ${N(x.d.n)} | ${f3(x.d.mean)} (${f2(x.d.t)}) | ${N(x.c.n)} | ${f3(x.c.mean)} (${f2(x.c.t)}) |`); L.push(''); } }
  L.push('## Checks', '',
    `- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ')}: ${N(nCut)} signals known by the cut dates, ${badCut} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop, a risk outside the desk\'s limits, or a risk under the round trip is no trade (same for barriers and controls).',
    '- Readings with no trend on the timeframe above are in no cell (column "no trend").', '',
    '| Market | candles from | signals | barrier trades | control trades | no trend | dropped (bad data) | past the stop | outside risk limits | risk under cost |', '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.signals)} | ${N(m.trades)} | ${N(m.controls)} | ${N(m.nodir)} | ${m.dropped} | ${m.bad} | ${N(m.limits)} | ${N(m.small)} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') L.push('A passing cell is a candidate for its own forward record and an owner decision, nothing more: it is not adopted and never called an edge before a forward record.');
  else L.push('Taken at market, with no resting limit to be flattered by touch fills, the desk\'s barrier entry does not clear the bar on any of',
    'the 36 cells over ten markets and 22 years. Do not re-test variants of these cells on these years. Nothing live changed; no rule is proposed.',
    '', 'Before costs the barrier trades sit a few hundredths of an R under zero, like the bands placed at random, so the barrier picks no',
    'better place than a random band of the same size; the side-flipped trades are only the mirror of that small loss and lose',
    'after costs too. Silver: the desk\'s risk limits, scaled as a share of price, rule out most of its signals (column "outside risk',
    'limits"), so silver adds few trades; the verdict rests on the other nine markets.');
  L.push('');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = await runMarket(a);
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, 'signals', r.signals, 'real', r.realTrades, 'ctl', r.ctlTrades, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = await cutTest(a); fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify(r)); console.log(JSON.stringify(r)); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
