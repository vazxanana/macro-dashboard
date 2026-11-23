// research/edge/dom-touch-market/run.mjs - PREREGISTRATION.md (23 Nov 2026): the H1 dominant (DOM) zone touched on M5 and
// entered at MARKET at the next 5-minute open; Q1 against three control zones (2010-2019), Q2 on unread data (2005-09, five
// other markets 2010-19), 2020-now reported.
//   node --max-old-space-size=6000 research/edge/dom-touch-market/run.mjs market <m> <set> <dir>   set: d (2010-19, + controls) | a | b | c
//   node research/edge/dom-touch-market/run.mjs report <dir>
// Research only: reads the edgekit candle cache, imports combo-grid-3 / combo-grid-2 / grid6-dom-confirm unchanged, writes
// <dir> and its own result.json. Places nothing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { buildZones, multi } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14 } from '../grid6-dom-confirm/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (n) => Date.UTC(n, 0, 1) / 1000;
export const MAIN = K.MARKETS, OTHER = K.HOLDOUT_MARKETS;
export const SETS = {
  d: { name: '2010-2019 (Q1, the gate)', markets: MAIN, from: y(2010), to: y(2020), half: y(2015) },
  a: { name: 'Set A: the five markets 2005-2009', markets: MAIN, from: y(2005), to: y(2010) },
  b: { name: 'Set B: nzdusd usdcad usdchf eurjpy xag 2010-2019', markets: OTHER, from: y(2010), to: y(2020) },
  c: { name: 'Set C: the five markets 2020 to now (reported)', markets: MAIN, from: y(2020), to: y(2026) + 334 * 86400 },
};
export const LIFE = 120, BACK = 120, SEEDS = [1, 2, 3, 4, 5], BAND_POOL = 500, BAND_MIN = 50;
const CAP = 2 * 86400;
// row columns (Float32): zone stop 1R 2R trail cost/risk, swing stop 1R 2R trail cost/risk, then the same for the placebo
export const COLS = ['z1', 'z2', 'zt', 'zc', 's1', 's2', 'st', 'sc', 'pz1', 'pz2', 'pzt', 'pzc', 'ps1', 'ps2', 'pst', 'psc'];
const NC = COLS.length, SLOT = [0, 1, 6];

// ---- zones ----------------------------------------------------------------------------------------------------------
export function closeEnd(L, i, d, bot, top) { // combo-grid-3's zone end (re-implemented; the test compares it with buildZones)
  for (let j = i + 1; j < L.length && j <= i + LIFE; j++) if (d > 0 ? L[j].c < bot : L[j].c > top) return { end: L[j].e, fi: j };
  return { end: i + LIFE < L.length ? L[i + LIFE].e : Infinity, fi: -1 };
}
const colour = (b) => (b.c > b.o ? 1 : b.c < b.o ? -1 : 0);
export function seedOf(market, k) { let h = 2166136261; for (const ch of market + ':dtm:' + k) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }

// (a) a random same-colour body among candles i-120 .. i-2 of each DOM zone
export function randBodyZones(L, seed, dom = buildZones('dom', L)) {
  const R = K.rng(seed), out = [];
  for (const z of dom) {
    const i = z.i, pool = [];
    for (let j = Math.max(0, i - BACK); j <= i - 2; j++) if (colour(L[j]) === z.d) pool.push(j);
    if (!pool.length) continue;
    const j = pool[Math.floor(R() * pool.length)], b = L[j], bot = Math.min(b.o, b.c), top = Math.max(b.o, b.c);
    if (!(top > bot)) continue;
    out.push({ d: z.d, bot, top, at: z.at, i, src: j, ...closeEnd(L, i, z.d, bot, top) });
  }
  return out;
}
// (b) every closed candle of colour d names the body of the last earlier candle of the opposite colour (once per source, side)
export function oppBodyZones(L) {
  const out = [], seen = new Set(), last = { 1: -1, '-1': -1 };
  for (let i = 0; i < L.length; i++) {
    const d = colour(L[i]); if (!d) continue;
    const j = last[-d];
    if (j >= 0 && !seen.has(j * 2 + (d > 0 ? 1 : 0))) {
      seen.add(j * 2 + (d > 0 ? 1 : 0));
      const b = L[j], bot = Math.min(b.o, b.c), top = Math.max(b.o, b.c);
      if (top > bot) out.push({ d, bot, top, at: L[i].e, i, src: j, ...closeEnd(L, i, d, bot, top) });
    }
    last[d] = i;
  }
  return out;
}
// (c) a band of the DOM's height at a near-edge distance drawn from the last 500 earlier DOM zones (ATR units)
export function bandZones(L, seed, dom = buildZones('dom', L), A = atr14(L)) {
  const R = K.rng(seed), out = [], hist = [];
  for (const z of dom) {
    const i = z.i, a = A[i], c = L[i].c, h = z.top - z.bot;
    if (hist.length >= BAND_MIN && a > 0 && h > 0) {
      const lo = Math.max(0, hist.length - BAND_POOL), u = hist[lo + Math.floor(R() * (hist.length - lo))];
      const top = z.d > 0 ? c - u * a : c + u * a + h, bot = top - h;
      out.push({ d: z.d, bot, top, at: z.at, i, u, ...closeEnd(L, i, z.d, bot, top) });
    }
    if (a > 0) hist.push((z.d > 0 ? c - z.top : z.bot - c) / a);
  }
  return out;
}

// ---- the first touch (combo-grid-3 signalsFor, trigger NONE, visit 1) -------------------------------------------------
export function firstTouches(T, Z, start) {
  const out = [];
  for (const z of Z) {
    if (z.at < start - 30 * 86400) continue;
    let k = K.closedCount(T, z.at);
    while (k < T.length && T[k].t < z.at) k++;
    while (k < T.length && T[k].t < z.end && !(T[k].l <= z.top && T[k].h >= z.bot)) k++;
    if (k >= T.length || T[k].t >= z.end) continue;
    if (T[k].t >= start) out.push({ z, k0: k });
  }
  return out;
}

// ---- trades of one zone list: one row per touch that trades on either stop -------------------------------------------
export function tradeRows(market, M5, H, A, X, Z, { from, to, placebo = false }) {
  const cost = COSTS[market], t = [], v = [];
  const bad = (x) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= x) lo = m + 1; else hi = m; } return lo > 0 && x <= X[lo - 1][1]; };
  for (const { z, k0 } of firstTouches(M5, Z, from)) {
    const d = z.d, b = M5[k0];
    if (d > 0 ? b.c < z.bot : b.c > z.top) continue; // closed beyond the far side: no trade
    const ts = b.e; if (ts >= to) continue;
    const li = K.closedCount(H, ts) - 1; if (li < 15) continue;
    const ref = b.c, ext = d > 0 ? b.l : b.h;
    const stops = [d > 0 ? z.bot - cost / 2 - 0.25 * A[li] : z.top + cost / 2 + 0.25 * A[li], d > 0 ? ext - cost / 2 : ext + cost / 2];
    const row = new Float32Array(NC).fill(NaN); let tt = null;
    stops.forEach((stop, st) => {
      const dist = d * (ref - stop); if (!(dist > 0)) return;
      const r = multi(M5, d, ref, stop, 'mkt', ts, null, 2, null, CAP, null);
      if (!r || r.risk < 2 * cost || r.t < from || r.t >= to || bad(r.t)) return;
      if (!(r.risk > 0)) throw new Error('stop on the wrong side');
      tt = r.t; SLOT.forEach((k, q) => { row[st * 4 + q] = r.R[k]; }); row[st * 4 + 3] = cost / r.risk;
      if (placebo) { const p = multi(M5, -d, ref, ref + d * dist, 'mkt', ts, null, 2, null, CAP, null);
        if (p && p.risk >= 2 * cost && !bad(p.t)) { SLOT.forEach((k, q) => { row[8 + st * 4 + q] = p.R[k]; }); row[8 + st * 4 + 3] = cost / p.risk; } }
    });
    if (tt != null) { t.push(tt); v.push(row); }
  }
  const vals = new Float32Array(v.length * NC); v.forEach((r, i) => vals.set(r, i * NC));
  return { t: Int32Array.from(t), vals };
}

export function runMarket(market, set, { M5 } = {}) {
  const S = SETS[set];
  M5 ||= K.load(market, '5m', { from: S.from - 400 * 86400, to: S.to + 15 * 86400 });
  const H = K.resample(M5, 3600), A = atr14(H), X = exclusions(market), dom = buildZones('dom', H), o = { from: S.from, to: S.to };
  const out = { dom: tradeRows(market, M5, H, A, X, dom, { ...o, placebo: true }) };
  if (set === 'd') {
    for (const s of SEEDS) out['rb' + s] = tradeRows(market, M5, H, A, X, randBodyZones(H, seedOf(market, 'rb' + s), dom), o);
    out.ob = tradeRows(market, M5, H, A, X, oppBodyZones(H), o);
    for (const s of SEEDS) out['bd' + s] = tradeRows(market, M5, H, A, X, bandZones(H, seedOf(market, 'bd' + s), dom, A), o);
  }
  return out;
}

// ---- statistics -------------------------------------------------------------------------------------------------------
const mIdx = (t, from) => { const a = new Date(from * 1000), b = new Date(t * 1000); return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth(); };
const nMonths = (from, to) => mIdx(to - 1, from) + 1;
export function monthT(sums) { const n = sums.length; if (n < 3) return null; const m = sums.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(sums.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)); return sd > 0 ? m / (sd / Math.sqrt(n)) : null; }
// one cell of a stream over [from, to): before / after costs, month-sum t over every month of the window
export function cell(st, col, ccol, from, to) {
  const c = COLS.indexOf(col), cc = COLS.indexOf(ccol), NMo = nMonths(from, to), sb = new Float64Array(NMo), sa = new Float64Array(NMo), xs = [];
  let n = 0, tb = 0, tc = 0;
  for (let i = 0; i < st.t.length; i++) { const tt = st.t[i]; if (tt < from || tt >= to) continue; const r = st.vals[i * NC + c]; if (Number.isNaN(r)) continue;
    const k = st.vals[i * NC + cc], m = mIdx(tt, from); n++; tb += r; tc += k; sb[m] += r; sa[m] += r - k; xs.push(r); }
  const tB = monthT([...sb]), tA = monthT([...sa]);
  return { n, before: n ? +(tb / n).toFixed(4) : null, tBefore: tB == null ? null : +tB.toFixed(2), pOne: tB == null ? 1 : tB > 0 ? K.pFromT(tB, NMo - 1) / 2 : 1 - K.pFromT(tB, NMo - 1) / 2,
    after: n ? +((tb - tc) / n).toFixed(4) : null, tAfter: tA == null ? null : +tA.toFixed(2), _x: xs };
}
const mom = (v) => { const n = v.length, m = n ? v.reduce((a, b) => a + b, 0) / n : 0; return { n, m, v: n > 1 ? v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1) : 0 }; };
export function welch(a, b) { const A = mom(a), B = mom(b); if (A.n < 2 || B.n < 2) return { diff: null, t: null };
  return { diff: +(A.m - B.m).toFixed(4), t: +((A.m - B.m) / Math.sqrt(A.v / A.n + B.v / B.n)).toFixed(2) }; }
// month t of the per-month difference of mean R (months where both traded)
export function monthDiffT(st1, st2, col, from, to) {
  const c = COLS.indexOf(col), per = (st) => { const s = new Map(); for (let i = 0; i < st.t.length; i++) { const tt = st.t[i]; if (tt < from || tt >= to) continue;
    const r = st.vals[i * NC + c]; if (Number.isNaN(r)) continue; const m = mIdx(tt, from), o = s.get(m) || [0, 0]; o[0] += r; o[1]++; s.set(m, o); } return s; };
  const a = per(st1), b = per(st2), v = []; for (const [m, x] of a) { const y = b.get(m); if (y) v.push(x[0] / x[1] - y[0] / y[1]); }
  const t = monthT(v); return t == null ? null : +t.toFixed(2);
}
const pub = (c) => { const { _x, pOne, ...o } = c; return o; };
export const join = (list) => { let n = 0; for (const s of list) n += s.t.length; const t = new Int32Array(n), vals = new Float32Array(n * NC); let k = 0;
  for (const s of list) { t.set(s.t, k); vals.set(s.vals, k * NC); k += s.t.length; } return { t, vals }; };

export const CELLS = { C1: { name: 'zone stop, 1R', col: 'z1', cc: 'zc' }, C2: { name: 'touch-candle stop, trail', col: 'st', cc: 'sc' } };
const EXTRA = { zt: 'zc', z2: 'zc', s1: 'sc', s2: 'sc' };
const PLAC = { C1: ['pz1', 'pzc'], C2: ['pst', 'psc'] };

export function report(dir) {
  const read = (set, m) => { const j = JSON.parse(fs.readFileSync(path.join(dir, `${set}-${m}.json`), 'utf8')); const o = {};
    for (const [k, s] of Object.entries(j)) { const b1 = Buffer.from(s.t, 'base64'), b2 = Buffer.from(s.vals, 'base64');
      o[k] = { t: new Int32Array(b1.buffer, b1.byteOffset, b1.byteLength / 4), vals: new Float32Array(b2.buffer, b2.byteOffset, b2.byteLength / 4) }; } return o; };
  const data = {}; for (const set of Object.keys(SETS)) { data[set] = {}; for (const m of SETS[set].markets) data[set][m] = read(set, m); }
  const pool = (set, k) => join(SETS[set].markets.map((m) => data[set][m][k]));
  const D = SETS.d, halves = [[D.from, D.half], [D.half, D.to]];

  // gate: grid6-dom-confirm result.json
  const g6 = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'grid6-dom-confirm', 'result.json'), 'utf8'));
  const find = (stop, exit) => g6.real.passes.find((p) => p.chain === '1h>5m' && p.visit === 1 && p.msnr === 'any' && p.session === 'any' && p.conf === 'none' && p.stop === stop && p.exit === exit);
  const view = (stop) => g6.view.find((v) => v.chain === '1h>5m' && v.conf === 'none' && v.stop === stop)['2R'];
  const want = { z1: [find('zone', '1R').h2010, find('zone', '1R').h2015], zt: [find('zone', 'trail').h2010, find('zone', 'trail').h2015],
    st: [find('swing', 'trail').h2010, find('swing', 'trail').h2015], z2: [view('zone').d2010, view('zone').d2015], s2: [view('swing').d2010, view('swing').d2015] };
  const dom = pool('d', 'dom'), gate = {}; let gateOk = true;
  for (const [col, w] of Object.entries(want)) {
    const cc = col[0] === 'z' ? 'zc' : 'sc';
    gate[col] = halves.map(([a, b], h) => { const g = pub(cell(dom, col, cc, a, b)), x = w[h];
      const ok = g.n === x.n && g.before === x.before && g.tBefore === x.tBefore && g.after === x.after && g.tAfter === x.tAfter; if (!ok) gateOk = false;
      return { got: g, grid6: { n: x.n, before: x.before, tBefore: x.tBefore, after: x.after, tAfter: x.tAfter }, ok }; });
  }

  // Q1
  const ctrl = { rb: join(SEEDS.map((s) => pool('d', 'rb' + s))), ob: pool('d', 'ob'), bd: join(SEEDS.map((s) => pool('d', 'bd' + s))) };
  const CTRL_NAME = { rb: '(a) random same-colour body, 5 seeds', ob: '(b) last opposite-colour body', bd: '(c) random band, 5 seeds' };
  const q1 = {};
  for (const [ck, C] of Object.entries(CELLS)) {
    q1[ck] = { dom: halves.map(([a, b]) => pub(cell(dom, C.col, C.cc, a, b))), controls: {} };
    for (const [k, st] of Object.entries(ctrl)) {
      const hs = halves.map(([a, b]) => { const x = cell(dom, C.col, C.cc, a, b), c = cell(st, C.col, C.cc, a, b);
        return { control: pub(c), diff: welch(x._x, c._x), monthDiffT: monthDiffT(dom, st, C.col, a, b) }; });
      const seeds = k === 'ob' ? null : SEEDS.map((s) => halves.map(([a, b]) => { const c = cell(pool('d', k + s), C.col, C.cc, a, b); return { before: pub(c).before, n: c.n, diff: welch(cell(dom, C.col, C.cc, a, b)._x, c._x) }; }));
      q1[ck].controls[k] = { name: CTRL_NAME[k], halves: hs, beats: hs.every((h) => h.diff.diff > 0 && h.diff.t >= 2), seeds };
    }
    q1[ck].holds = Object.values(q1[ck].controls).every((c) => c.beats);
  }

  // Q2
  const q2 = {}, prim = [];
  for (const set of ['a', 'b', 'c']) { const S = SETS[set], st = pool(set, 'dom'); q2[set] = { name: S.name, cells: {}, extra: {}, placebo: {}, perMarket: {} };
    for (const [ck, C] of Object.entries(CELLS)) { const c = cell(st, C.col, C.cc, S.from, S.to); q2[set].cells[ck] = { ...pub(c), pOne: +c.pOne.toPrecision(3) };
      if (set !== 'c') prim.push([set, ck, c.pOne]);
      q2[set].placebo[ck] = pub(cell(st, PLAC[ck][0], PLAC[ck][1], S.from, S.to));
      q2[set].perMarket[ck] = Object.fromEntries(S.markets.map((m) => [m, pub(cell(data[set][m].dom, C.col, C.cc, S.from, S.to))])); }
    for (const [col, cc] of Object.entries(EXTRA)) q2[set].extra[col] = pub(cell(st, col, cc, S.from, S.to)); }
  const hp = K.holm(prim.map((x) => x[2]));
  prim.forEach(([set, ck], i) => { const c = q2[set].cells[ck]; c.holm = +hp[i].toPrecision(3); c.pass = c.before > 0 && c.tBefore >= 2 && hp[i] < 0.05; });
  const q2holds = Object.fromEntries(Object.keys(CELLS).map((ck) => [ck, q2.a.cells[ck].pass && q2.b.cells[ck].pass]));
  const thin = Object.keys(CELLS).some((ck) => q2.a.cells[ck].n < 1000 || q2.b.cells[ck].n < 1000);
  const passCells = Object.keys(CELLS).filter((ck) => q2holds[ck] && q1[ck].holds);
  const verdict = !gateOk ? 'INCONCLUSIVE' : passCells.length ? 'PASS' : thin ? 'INCONCLUSIVE' : 'FAIL';

  // 2010-19 per market and placebo (reported)
  const perMarketD = Object.fromEntries(Object.keys(CELLS).map((ck) => [ck, Object.fromEntries(D.markets.map((m) => [m, pub(cell(data.d[m].dom, CELLS[ck].col, CELLS[ck].cc, D.from, D.to))]))]));
  const placeboD = Object.fromEntries(Object.keys(CELLS).map((ck) => [ck, pub(cell(dom, PLAC[ck][0], PLAC[ck][1], D.from, D.to))]));
  const domWhole = Object.fromEntries(Object.keys(CELLS).map((ck) => [ck, pub(cell(dom, CELLS[ck].col, CELLS[ck].cc, D.from, D.to))]));
  const f = (x) => (x >= 0 ? '+' : '') + x.toFixed(3);
  const qa = q2.a.cells.C1, qb = q2.b.cells.C1;
  const headline = `Zone stop, 1R, before costs: Set A ${f(qa.before)}R a trade (n ${qa.n}, month t ${qa.tBefore}), Set B ${f(qb.before)}R (n ${qb.n}, t ${qb.tBefore}); `
    + `Q2 ${Object.values(q2holds).some(Boolean) ? 'holds' : 'fails'}, Q1 ${Object.values(q1).some((x) => x.holds) ? 'holds' : 'fails'} (DOM beats every control in ${Object.keys(q1).filter((k) => q1[k].holds).join(', ') || 'no cell'}).`;
  return { study: 'dom-touch-market', built: '2026-11-23', basis: 'judged before costs (pre-registered); after costs beside', verdict, headline,
    gate: { ok: gateOk, cells: gate }, q1, q2, q2holds, passCells, domWhole2010: domWhole, perMarket2010: perMarketD, placebo2010: placeboD,
    trades: Object.fromEntries(Object.keys(SETS).map((s) => [s, Object.fromEntries(SETS[s].markets.map((m) => [m, data[s][m].dom.t.length]))])) };
}

const main = process.argv[1] === fileURLToPath(import.meta.url);
if (main && process.argv[2] === 'market') {
  const [, , , m, set, dir] = process.argv; fs.mkdirSync(dir, { recursive: true });
  const o = runMarket(m, set), j = {};
  for (const [k, s] of Object.entries(o)) j[k] = { t: Buffer.from(s.t.buffer, s.t.byteOffset, s.t.byteLength).toString('base64'), vals: Buffer.from(s.vals.buffer, s.vals.byteOffset, s.vals.byteLength).toString('base64') };
  fs.writeFileSync(path.join(dir, `${set}-${m}.json`), JSON.stringify(j));
  console.log(set, m, Object.fromEntries(Object.entries(o).map(([k, s]) => [k, s.t.length])));
}
if (main && process.argv[2] === 'report') {
  const res = report(process.argv[3]);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  console.log(JSON.stringify({ verdict: res.verdict, headline: res.headline, gate: res.gate.ok }, null, 1));
}
