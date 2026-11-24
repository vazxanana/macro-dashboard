// research/edge/grid7-sd-wide/run.mjs - the wide supply / demand grid of PREREGISTRATION.md (23 Nov 2026): 56 cells (4 base
// shapes x 2 zone timeframes x 2 entries x 3 exits, + 8 leg-out strength cells), ten markets, discovery 2005-14, confirmation
// 2015 to Oct 2026, judged before costs on month sums, each cell against its random-band control. Research only.
//   EDGE_DATA=<cache> node research/edge/grid7-sd-wide/run.mjs market <m> <outDir>
//   EDGE_DATA=<cache> node research/edge/grid7-sd-wide/run.mjs cut <m> <outDir>
//   node research/edge/grid7-sd-wide/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { mstat, p1, welch } from '../grid7-wide-core/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (Y, M = 0) => Date.UTC(Y, M, 1) / 1000;
export const MARKETS = ['xau', 'xag', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy'];
export const ASSUMED = ['xag', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy'];
export const SHAPES = ['RBR', 'DBD', 'DBR', 'RBD'], ZTF = ['1d', '4h'], ENTRIES = ['touch', 'break'], EXITS = ['1R', '2R', 'ext'], STRENGTHS = ['1.5-2.5', 'over 2.5'];
export const TBELOW = { '1d': '1h', '4h': '15m' }, CAP = { '1d': 10 * 86400, '4h': 3 * 86400 };
export const SMALL = 0.5, STRONG = 1.5, BIG = 2.5, MAXBASE = 4, LIFE = 120, WIN = 24, ATRK = 0.1, KSW = 2;
export const SEEDS = [1, 2, 3], POOL = 500, POOLMIN = 50;
export const FROM = y(2005), SPLIT = y(2015), TO = y(2026, 10);
export const NM = 262, DM = 120;
export const NSHAPE = 48, NCELL = 56;
export const shapeCell = (s, z, e, x) => ((s * 2 + z) * 2 + e) * 3 + x;
export const strengthCell = (g, z, e) => NSHAPE + (g * 2 + z) * 2 + e;
export function cellName(i) {
  if (i < NSHAPE) { const x = i % 3; let r = (i - x) / 3; const e = r % 2; r = (r - e) / 2; const z = r % 2; const s = (r - z) / 2;
    return { kind: 'shape', shape: SHAPES[s], ztf: ZTF[z], entry: ENTRIES[e], exit: EXITS[x], name: `${SHAPES[s]} ${ZTF[z]} ${ENTRIES[e]} ${EXITS[x]}` }; }
  let r = i - NSHAPE; const e = r % 2; r = (r - e) / 2; const z = r % 2; const g = (r - z) / 2;
  return { kind: 'strength', strength: STRENGTHS[g], ztf: ZTF[z], entry: ENTRIES[e], exit: '2R', name: `all shapes ${ZTF[z]} ${ENTRIES[e]} 2R, leg out ${STRENGTHS[g]} ATR` };
}
export const monthOf = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2005) * 12 + d.getUTCMonth(); };
const colour = (b) => (b.c > b.o ? 1 : b.c < b.o ? -1 : 0);

// ---- zones (closed candles only) ------------------------------------------------------------------------------------
// [{ d, lo, hi, at (known), i (last leg-out index), shape, strength (body / ATR), ext, a (ATR at i), end }]
export function sdBaseZones(L, A = atr14(L)) {
  const out = []; let lastBase = -1;
  const small = (j) => j >= 1 && A[j - 1] > 0 && Math.abs(L[j].c - L[j].o) < SMALL * A[j - 1];
  for (let o = 2; o < L.length; o++) {
    const a = A[o - 1]; if (!(a > 0) || small(o)) continue;
    let b0 = o; while (b0 - 1 >= 1 && small(b0 - 1) && o - (b0 - 1) <= MAXBASE + 1) b0--;
    const nb = o - b0; if (nb < 1 || nb > MAXBASE) continue;
    if (small(b0 - 1)) continue;                        // a run of 5 or more small candles: no base
    const li = b0 - 1; if (li < 1 || b0 <= lastBase) continue;
    const dIn = colour(L[li]), dOut = colour(L[o]); if (!dIn || !dOut) continue;
    let last = -1, body = 0;
    if (Math.abs(L[o].c - L[o].o) > STRONG * a) { last = o; body = Math.abs(L[o].c - L[o].o); }
    else if (o + 1 < L.length && colour(L[o + 1]) === dOut && Math.abs(L[o + 1].c - L[o].o) > STRONG * a) { last = o + 1; body = Math.abs(L[o + 1].c - L[o].o); }
    if (last < 0) continue;
    let lo = Infinity, hi = -Infinity; for (let j = b0; j < o; j++) { lo = Math.min(lo, L[j].l); hi = Math.max(hi, L[j].h); }
    if (!(hi > lo)) continue;
    let ext = dOut > 0 ? -Infinity : Infinity; for (let j = o; j <= last; j++) ext = dOut > 0 ? Math.max(ext, L[j].h) : Math.min(ext, L[j].l);
    const shape = dIn > 0 ? (dOut > 0 ? 'RBR' : 'RBD') : (dOut > 0 ? 'DBR' : 'DBD');
    lastBase = o - 1;
    out.push({ d: dOut, lo, hi, at: L[last].e, i: last, o, nb, shape, strength: body / a, ext, a: A[last], ref: L[last].c,
      end: last + LIFE < L.length ? L[last + LIFE].e : Infinity });
  }
  return out;
}

// random bands of the same side and height, born at the same time, near edge at a distance drawn from the last 500 earlier
// zones of the same market and timeframe (in ATR of the zone)
export function seedOf(market, tf, k) { let h = 2166136261; for (const ch of `${market}:${tf}:sdw:${k}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }
export function bandsOf(Z, seed) {
  const R = K.rng(seed), out = [], hist = [];
  for (let q = 0; q < Z.length; q++) {
    const z = Z[q], h = z.hi - z.lo, near = z.d > 0 ? z.hi : z.lo;
    if (hist.length >= POOLMIN && z.a > 0) {
      const lo = Math.max(0, hist.length - POOL), u = hist[lo + Math.floor(R() * (hist.length - lo))];
      const top = z.d > 0 ? z.ref - u * z.a : z.ref + u * z.a + h;
      const bnear = z.d > 0 ? top : top - h;
      out.push({ ...z, lo: top - h, hi: top, ext: bnear + (z.ext - near), src: q });
    }
    if (z.a > 0) hist.push((z.d > 0 ? z.ref - z.hi : z.lo - z.ref) / z.a);
  }
  return out;
}

// ---- the first touch and the two entries ----------------------------------------------------------------------------
// returns [{ e (0 touch | 1 break), j (T index of the entry candle), ts (its close) }]
export function entriesOf(T, z, breaks) {
  let k = startIdx(T, z.at);
  while (k < T.length && T[k].t < z.end && !(T[k].l <= z.hi && T[k].h >= z.lo)) k++;
  if (k >= T.length || T[k].t >= z.end) return [];
  const dead = (b) => (z.d > 0 ? b.c < z.lo : b.c > z.hi);
  if (dead(T[k])) return [];
  const out = [{ e: 0, j: k, ts: T[k].e }];
  for (let j = k; j < k + WIN && j < T.length; j++) {
    if (dead(T[j])) break;
    if (breaks.get(j) === z.d) { out.push({ e: 1, j, ts: T[j].e }); break; }
  }
  return out;
}

// ---- exits: up to three targets in one pass (market fill at the open of candle fi; stop first in a candle that holds both)
export function exits(M5, s, fi, stop, tgR, cap) {
  const fill = M5[fi].o, risk = s * (fill - stop); if (!(risk > 0)) return null;
  const n = tgR.length, tg = tgR.map((r) => fill + s * r * risk), R = new Array(n).fill(NaN), dl = M5[fi].t + cap; let left = n;
  const fin = (k, px) => { if (Number.isNaN(R[k])) { R[k] = (s * (px - fill)) / risk; left--; } };
  for (let j = fi; j < M5.length && left; j++) { const b = M5[j];
    if (j > fi) { if (s * (b.o - stop) <= 0) for (let k = 0; k < n; k++) fin(k, b.o); else for (let k = 0; k < n; k++) if (s * (b.o - tg[k]) >= 0) fin(k, b.o); }
    if (s * ((s > 0 ? b.l : b.h) - stop) <= 0) for (let k = 0; k < n; k++) fin(k, stop);
    for (let k = 0; k < n; k++) if (s * ((s > 0 ? b.h : b.l) - tg[k]) >= 0) fin(k, tg[k]);
    if (b.e >= dl) for (let k = 0; k < n; k++) fin(k, b.c); }
  return left ? null : { fill, risk, R };
}

// ---- signals of one market (real zones and their bands) ----------------------------------------------------------------
// { z (0/1), e, ts, s, stop, ext, shape, strength, ctl (0 real | seed) , src }
export function signals(F, market) {
  const out = [];
  ZTF.forEach((tf, zi) => {
    const L = F[tf], T = F[TBELOW[tf]], A = atr14(L), Z = sdBaseZones(L, A);
    const breaks = new Map(); for (const ev of K.structure(T, KSW).events) breaks.set(ev.i, ev.dir);
    const sets = [[0, Z], ...SEEDS.map((s) => [s, bandsOf(Z, seedOf(market, tf, s))])];
    for (const [ctl, list] of sets) for (const z of list) for (const en of entriesOf(T, z, breaks))
      out.push({ z: zi, e: en.e, j: en.j, ts: en.ts, s: z.d, stop: z.d > 0 ? z.lo - ATRK * z.a : z.hi + ATRK * z.a, ext: z.ext,
        shape: SHAPES.indexOf(z.shape), strength: z.strength >= BIG ? 1 : 0, ctl, at: z.at });
  });
  return out;
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
// kinds: real, ctl (bands), plac (side-flipped real)
function newAcc() { return { ms: new Float64Array(NCELL * NM), msNet: new Float64Array(NCELL * NM), n: new Float64Array(NCELL * 2), sum: new Float64Array(NCELL * 2),
  sq: new Float64Array(NCELL * 2), net: new Float64Array(NCELL * 2), win: new Float64Array(NCELL * 2) }; }
function add(A, c, w, m, R, cr) { A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; A.n[c * 2 + w]++; A.sum[c * 2 + w] += R; A.sq[c * 2 + w] += R * R; A.net[c * 2 + w] += R - cr; if (R > 0) A.win[c * 2 + w]++; }
export function cellsOf(g) { // the cells a signal belongs to, with the exit slot (0 1R, 1 2R, 2 ext)
  const out = []; for (let x = 0; x < 3; x++) out.push([shapeCell(g.shape, g.z, g.e, x), x]);
  out.push([strengthCell(g.strength, g.z, g.e), 1]); return out;
}

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5);
  const sigs = signals(F, market), cost = COSTS[market], X = exclusions(market);
  const acc = { real: newAcc(), ctl: newAcc(), plac: newAcc() }, seen = new Set(); let dropped = 0, bad = 0, small = 0, sims = 0;
  const zones = { '1d': 0, '4h': 0 };
  for (const g of sigs) {
    const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const t = M5[fi].t; if (t < FROM || t >= TO) continue;
    if (X.length && inBad(X, t)) { dropped++; continue; }
    const fill = M5[fi].o, risk = g.s * (fill - g.stop); if (!(risk > 0)) { bad++; continue; }
    if (risk < cost) { small++; continue; }
    if (!g.ctl && g.e === 0) zones[ZTF[g.z]]++;
    const extR = (g.s * (g.ext - fill)) / risk, hasExt = extR >= 1;
    const cap = CAP[ZTF[g.z]], tg = [1, 2, hasExt ? extR : 1];
    const r = exits(M5, g.s, fi, g.stop, tg, cap); sims++; if (!r) continue;
    if (!(g.s * (fill - g.stop) > 0)) throw new Error('stop on the wrong side');
    const p = g.ctl ? null : exits(M5, -g.s, fi, fill + g.s * risk, tg, cap);
    const m = monthOf(t), w = t < SPLIT ? 0 : 1, cr = cost / risk;
    for (const [c, x] of cellsOf(g)) { if (x === 2 && !hasExt) continue;
      const key = (g.ctl ? 'c' + g.ctl : 'r') + '|' + c + '|' + g.j + '|' + g.s; if (seen.has(key)) continue; seen.add(key);
      add(g.ctl ? acc.ctl : acc.real, c, w, m, r.R[x], cr);
      if (p) add(acc.plac, c, w, m, p.R[x], cr); }
  }
  const J = (A) => Object.fromEntries(Object.entries(A).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, assumed: ASSUMED.includes(market), first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null,
    signals: sigs.length, sims, dropped, bad, small, touched: zones, real: J(acc.real), ctl: J(acc.ctl), plac: J(acc.plac) };
}

// ---- cut test ------------------------------------------------------------------------------------------------------------
export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const key = (g) => [g.z, g.e, g.ts, g.s, g.stop.toFixed(8), g.ext.toFixed(8), g.shape, g.strength, g.ctl].join('|');
  const full = signals(frames(M5), market); const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000;
    const cut = signals(frames(M5.filter((b) => b.e <= T)), market).filter((g) => g.ts <= T).map(key);
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
export function judge(data) {
  const R = pool(data, 'real'), C = pool(data, 'ctl'), P = pool(data, 'plac'); const rows = [];
  for (let c = 0; c < NCELL; c++) { const s = cellStats(R, c), cs = cellStats(C, c), ps = cellStats(P, c);
    rows.push({ cell: c, ...cellName(c), d: s.d, c: s.c, p: p1(s.c.t, s.c.months - 1), ctl: cs, vs: { d: welch(s.d, cs.d), c: welch(s.c, cs.c) },
      plac: { d: ps.d, c: ps.c, p: p1(ps.c.t, ps.c.months - 1) } }); }
  const H = K.holm(rows.map((r) => r.p)), HP = K.holm(rows.map((r) => r.plac.p));
  const ok3 = (x, h) => x.d.n >= 300 && x.c.n >= 300 && x.d.mean > 0 && x.c.mean > 0 && x.d.t >= 2 && x.c.t >= 2 && h < 0.05;
  rows.forEach((r, i) => { r.holm = H[i]; r.plac.holm = HP[i];
    r.checks = { n: r.d.n >= 300 && r.c.n >= 300, disc: r.d.mean > 0 && r.d.t >= 2, conf: r.c.mean > 0 && r.c.t >= 2, holm: H[i] < 0.05,
      control: !!(r.vs.d != null && r.vs.c != null && r.vs.d >= 2 && r.vs.c >= 2) };
    r.pass = Object.values(r.checks).every(Boolean); r.plac.pass = ok3(r.plac, HP[i]); });
  return rows;
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(6), t: +w.t.toFixed(6), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(6), tNet: +w.tNet.toFixed(2),
  win: w.win == null ? null : +w.win.toFixed(3) });

export function report(dir) {
  const data = MARKETS.map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cut = MARKETS.flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const rows = judge(data), pass = rows.filter((r) => r.pass), plPass = rows.filter((r) => r.plac.pass);
  const verdict = pass.length ? 'PASS' : 'FAIL';
  const bestC = [...rows].sort((a, b) => b.c.t - a.c.t)[0], bestBoth = [...rows].sort((a, b) => Math.min(b.d.t, b.c.t) - Math.min(a.d.t, a.c.t))[0];
  const perMarket = {}; for (const r of pass) perMarket[r.cell] = data.map((d) => { const s = cellStats(pool([d], 'real'), r.cell); return { market: d.market, d: slim(s.d), c: slim(s.c) }; });
  const headline = verdict === 'PASS'
    ? `${pass.length} of 56 cells pass the pre-registered bar: best ${pass[0].name}, ${f3(pass[0].c.mean)}R a trade before costs in 2015-26 (n ${N(pass[0].c.n)}, month t ${f2(pass[0].c.t)}; ${f3(pass[0].c.meanNet)}R after costs)`
    : `0 of 56 cells pass; the best confirmation cell, ${bestC.name}, made ${f3(bestC.c.mean)}R a trade before costs in 2015-26 (n ${N(bestC.c.n)}, month t ${f2(bestC.c.t)}; discovery ${f3(bestC.d.mean)}R, t ${f2(bestC.d.t)}; ${f3(bestC.c.meanNet)}R after costs)`;
  const RW = rows.map((r) => ({ cell: r.name, kind: r.kind, shape: r.shape || null, strength: r.strength || null, ztf: r.ztf, entry: r.entry, exit: r.exit,
    disc: slim(r.d), conf: slim(r.c), holm: +r.holm.toFixed(4), control: { disc: slim(r.ctl.d), conf: slim(r.ctl.c) },
    vsControl: { d: r.vs.d == null ? null : +r.vs.d.toFixed(2), c: r.vs.c == null ? null : +r.vs.c.toFixed(2) }, checks: r.checks, pass: r.pass,
    placebo: { disc: slim(r.plac.d), conf: slim(r.plac.c), holm: +r.plac.holm.toFixed(4), pass: r.plac.pass } }));
  const out = { study: 'grid7-sd-wide', built: '2026-11-23', verdict, headline, basis: 'judged before costs on calendar-month sums (pre-registered); after costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' }, markets: MARKETS,
    assumedCosts: ASSUMED, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10),
      signals: d.signals, sims: d.sims, dropped: d.dropped, bad: d.bad, small: d.small, touched: d.touched })),
    passed: pass.map((r) => r.name), placeboPassed: plPass.map((r) => r.name), bestConfirmation: bestC.name, bestBothWindows: bestBoth.name, cut, cells: RW, perMarket };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, rows, bestBoth));
  return out;
}

function resultMd(o, rows, bestBoth) {
  const nCut = o.cut.reduce((a, x) => a + x.n, 0), badc = o.cut.reduce((a, x) => a + x.missing + x.extra, 0), cnt = (f) => rows.filter(f).length;
  const L = [];
  L.push('# Wide supply / demand grid: zones by base type on ten markets (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    'A zone = a base of 1-4 small candles (body under half the ATR) between a leg in and a strong leg out (one or two candles with',
    'a body over 1.5 ATR), on the Daily or H4 chart; shapes RBR, DBD (continuation), DBR, RBD (reversal); the zone is the base\'s',
    'range, fresh until its first touch. On the first touch, on the timeframe two steps lower (Daily -> H1, H4 -> M15): (touch)',
    'market entry at the touch candle\'s close, or (break) at the first structure break of the zone\'s side within 24 candles.',
    'Stop past the zone\'s far side + 0.1 ATR; exits 1R, 2R or the leg-out\'s extreme (when 1R or more away); time limit 10 days',
    '(Daily) / 3 days (H4). 48 shape cells + 8 leg-out strength cells (shapes pooled, 2R). Each cell against its control: random',
    'bands of the same height born at the same time at a matched distance (three seeds). Ten markets pooled, OANDA mid 5-minute',
    `candles; discovery 2005-2014, confirmation 2015 to October 2026. Costs after the fact only; **ASSUMED, not measured** for ${o.assumedCosts.join(', ')}.`, '',
    '## The bar, cell by cell', '',
    `- n >= 300 in both windows: ${cnt((r) => r.checks.n)} of 56.`,
    `- Mean R > 0 and month t >= 2 in discovery: ${cnt((r) => r.checks.disc)}; in confirmation: ${cnt((r) => r.checks.conf)}; both: ${cnt((r) => r.checks.disc && r.checks.conf)}.`,
    `- Holm-adjusted p < 0.05 over the 56 confirmation tests: ${cnt((r) => r.checks.holm)}.`,
    `- Beats its control (Welch t >= 2 in both windows): ${cnt((r) => r.checks.control)} of 56.`,
    `- **All four: ${o.passed.length}${o.passed.length ? ' (' + o.passed.join('; ') + ')' : ''}.**`,
    `- Side-flipped placebo passing bars 1-3: ${o.placeboPassed.length}${o.placeboPassed.length ? ' (' + o.placeboPassed.join('; ') + ')' : ''}.`, '',
    `Best confirmation cell: ${o.bestConfirmation}. Best on the weaker of the two windows: ${o.bestBothWindows} (discovery`,
    `${f3(bestBoth.d.mean)}R, t ${f2(bestBoth.d.t)}; confirmation ${f3(bestBoth.c.mean)}R, t ${f2(bestBoth.c.t)}).`, '',
    '## Every cell', '',
    'R a trade before costs (month-sum t), after costs beside; control = its random bands (R before costs); "vs ctl" = Welch t',
    'of the cell against its control (discovery / confirmation); Holm on the confirmation test.', '',
    '| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | ctl R 05-14 / 15-26 | vs ctl | Holm | Placebo R 15-26 (t) | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const r of rows) L.push(`| ${r.name} | ${N(r.d.n)} | ${f3(r.d.mean)} (${f2(r.d.t)}) | ${f3(r.d.meanNet)} | ${N(r.c.n)} | ${f3(r.c.mean)} (${f2(r.c.t)}) | ${f3(r.c.meanNet)} | ${f3(r.ctl.d.mean)} / ${f3(r.ctl.c.mean)} | ${f2(r.vs.d)} / ${f2(r.vs.c)} | ${r.holm.toFixed(3)} | ${f3(r.plac.c.mean)} (${f2(r.plac.c.t)}) | ${r.pass ? 'yes' : 'no'} |`);
  L.push('');
  if (o.passed.length) { L.push('## Per market, passing cells', ''); for (const [c, list] of Object.entries(o.perMarket)) { L.push(`### ${rows[c].name}`, '', '| Market | n 05-14 | R (t) | net | n 15-26 | R (t) | net |', '|---|---:|---:|---:|---:|---:|---:|');
    for (const x of list) L.push(`| ${x.market} | ${N(x.d.n)} | ${f3(x.d.mean)} (${f2(x.d.t)}) | ${f3(x.d.meanNet)} | ${N(x.c.n)} | ${f3(x.c.mean)} (${f2(x.c.t)}) | ${f3(x.c.meanNet)} |`); L.push(''); } }
  L.push('## Checks', '',
    `- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ')}: ${N(nCut)} signals (zones and bands) known by the cut dates, ${badc} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); fills at or past the stop and trades whose risk is under the round-trip cost are no trades (same for every cell and the controls).',
    '- Exclusions: the data-quality audit\'s bad intervals (`combo-grid-2` `exclusions`).', '',
    '| Market | candles from | signals | simulated | dropped (bad data) | past the stop | risk under cost | zones traded at the touch (D1 / H4) |', '|---|---|---:|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.signals)} | ${N(m.sims)} | ${m.dropped} | ${m.bad} | ${N(m.small)} | ${N(m.touched['1d'])} / ${N(m.touched['4h'])} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') L.push('A passing cell is a candidate for its own forward record and an owner decision, nothing more: it is not adopted, and never called an edge before a forward record. Read its after-cost figure beside it.');
  else L.push('No base shape, zone timeframe, entry or exit of this classic supply / demand reading beats a random band of the same',
    'height at the same distance on ten markets over 22 years. The base shape and the strength of the leg out do not pick better',
    'first touches than chance levels do. Do not re-test variants of these 56 cells on these years. Nothing live changed; no rule is proposed.');
  L.push('');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = runMarket(a);
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, 'signals', r.signals, 'sims', r.sims, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify(r)); console.log(JSON.stringify(r)); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
