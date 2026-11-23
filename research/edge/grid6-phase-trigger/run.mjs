// research/edge/grid6-phase-trigger/run.mjs - PREREGISTRATION.md (23 Nov 2026): the market cycle (phase.mjs: D1 / H4 / H1
// stage, the H4 side, the H4 position) as context for an M15 trigger (structure break / box close-out / engulf / sweep) x
// session, entered at market, stop past the trigger's swing + 0.1 H1 ATR, exits 1R / 2R / 3R / H4 far side / trail.
// Research only: reads the edgekit candle cache, writes <dir> and its own result.json. Nothing live imports it.
//   node --max-old-space-size=6000 research/edge/grid6-phase-trigger/run.mjs market <m> <dir>   one market -> <dir>/<m>.json
//   node --max-old-space-size=8000 research/edge/grid6-phase-trigger/run.mjs report <dir>      pool, the bar -> result.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { readPhase } from '../_lib/phase.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx, manage } from '../dom-trade-through/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (n) => Date.UTC(n, 0, 1) / 1000;
export const FROM = y(2010), TO = y(2020), NM = 120, HALF_M = 60;
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const STAGE = ['move', 'pullback', 'continuation', 'range'];
export const SIDES = ['none', 'with', 'against'];
export const POS = ['none', 'cheap', 'dear'];
export const TRIGS = ['bo', 'box', 'eg', 'sweep'];
export const SESS = ['any', 'london', 'newyork', 'other'];
export const EXITS = ['1R', '2R', '3R', 'far', 'trail'];
const XSLOT = [0, 1, 2, 5, 6]; // manage(): slots 0..2 = 1R 2R 3R, 5 = opp (here the H4 far side), 6 = trail
export const CAP = 2 * 86400, TAIL = 650, PAIR_MIN = 0.03, FAR_MIN = 0.5, SWING_N = 6;

// ---- stage levels: any, 12 singles, 16 H4 x H1 pairs, 16 D1 x H4 pairs (pairs kept by the collapse rule) ------------
export const ALL_LEVELS = (() => {
  const L = [{ name: 'any' }];
  for (const [k, tf] of [[0, 'D1'], [1, 'H4'], [2, 'H1']]) for (let s = 0; s < 4; s++) L.push({ name: `${tf} ${STAGE[s]}`, one: [k, s] });
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) L.push({ name: `H4 ${STAGE[a]} + H1 ${STAGE[b]}`, pair: [1, a, 2, b] });
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) L.push({ name: `D1 ${STAGE[a]} + H4 ${STAGE[b]}`, pair: [0, a, 1, b] });
  return L;
})();
// levels a context (stage indices [d1, h4, h1]) belongs to, among the kept ones (indices into `kept`)
export function levelsOf(st, kept) {
  const out = [];
  kept.forEach((L, i) => {
    if (!L.one && !L.pair) out.push(i);
    else if (L.one) { if (st[L.one[0]] === L.one[1]) out.push(i); }
    else if (st[L.pair[0]] === L.pair[1] && st[L.pair[2]] === L.pair[3]) out.push(i);
  });
  return out;
}
export const cellIndex = (lv, sd, ps, tg, ss, x) => ((((lv * 3 + sd) * 3 + ps) * 4 + tg) * 4 + ss) * 5 + x;
export function cellName(c, kept) {
  const x = c % 5; c = (c - x) / 5; const ss = c % 4; c = (c - ss) / 4; const tg = c % 4; c = (c - tg) / 4; const ps = c % 3; c = (c - ps) / 3;
  const sd = c % 3; const lv = (c - sd) / 3;
  return { stage: kept[lv].name, side: SIDES[sd], pos: POS[ps], trigger: TRIGS[tg], session: SESS[ss], exit: EXITS[x] };
}

// ---- M15 triggers; a trigger at j reads candles 0..j only ---------------------------------------------------------
// Each: { j, d, tg }
export function triggers(W) {
  const out = [];
  for (const e of K.structure(W, 3).events) out.push({ j: e.i, d: e.dir, tg: 0 });
  for (const b of K.boxesHL(W, 3)) if (b.dir && b.bi >= 0) out.push({ j: b.bi, d: b.dir, tg: 1 });
  for (let j = 1; j < W.length; j++) {
    const p = W[j - 1], c = W[j];
    if (p.c < p.o && c.c > c.o && c.c > p.h) out.push({ j, d: 1, tg: 2 });
    else if (p.c > p.o && c.c < c.o && c.c < p.l) out.push({ j, d: -1, tg: 2 });
  }
  const sw = K.swings(W, 3).sort((a, b) => a.ci - b.ci || a.i - b.i);
  let k = 0, H = null, L = null;
  for (let j = 0; j < W.length; j++) {
    while (k < sw.length && sw[k].ci < j) { const s = sw[k++]; if (s.type === 'H') H = s; else L = s; }
    const b = W[j];
    if (L && b.l < L.price) { if (b.c > L.price) out.push({ j, d: 1, tg: 3 }); L = null; }
    if (H && b.h > H.price) { if (b.c < H.price) out.push({ j, d: -1, tg: 3 }); H = null; }
  }
  return out.sort((a, b) => a.j - b.j || a.tg - b.tg);
}

// ---- the context at the last closed H1 candle (tails of closed candles; equal to readPhase on the whole series) ----
const tailOf = (B, t) => { const n = K.closedCount(B, t); return B.slice(Math.max(0, n - TAIL), n); };
export function contextAt(F, T) {
  const by = { '1d': tailOf(F['1d'], T), '4h': tailOf(F['4h'], T), '1h': tailOf(F['1h'], T), '15m': tailOf(F['15m'], T), '5m': [] };
  const ph = readPhase(by, T), h4 = ph.tf['4h'];
  const st = ['1d', '4h', '1h'].map((k) => STAGE.indexOf(ph.tf[k].stage));
  const R = h4.rangeUsed === 'internal' ? h4.internal : h4.external;
  const h1 = by['1h'], px = h1.length ? h1[h1.length - 1].c : null;
  return { st, side: h4.side, half: h4.half, hi: R ? R.hi : null, lo: R ? R.lo : null, px };
}

// ---- one trade at market (R of the five exits before costs, or null) ---------------------------------------------
export function tradeOne(M5, s, stop, t0, far, cost) {
  const fi = startIdx(M5, t0); if (fi >= M5.length) return null;
  const fill = M5[fi].o, risk = s * (fill - stop); if (!(risk > 0) || !(risk >= cost)) return null;
  const farR = far == null ? NaN : (s * (far - fill)) / risk;
  const r = manage(M5, s, fi, fill, stop, CAP, true, Number.isFinite(farR) ? farR : 99); if (!r) return null;
  const R = XSLOT.map((k) => r.R[k]); if (!(farR >= FAR_MIN)) R[3] = NaN;
  return { t: r.t, risk, cr: cost / risk, R };
}

// ---- every trade of one market -------------------------------------------------------------------------------------
// rows { tc, d, tg, ss (1..3), st [d1 h4 h1], sd (0..2), ps (0..2), o, p } ; also the context counts for the collapse rule.
export function tradesOf(M5, F, cost, { from = FROM, to = TO, X = [] } = {}) {
  const bad = (t) => X.some(([a, b]) => t >= a && t <= b), out = [];
  const W = F['15m'], H1 = F['1h'], A = atr14(H1), cache = new Map();
  const ctx = (T) => { let c = cache.get(T); if (!c) { c = contextAt(F, T); cache.set(T, c); } return c; };
  for (const g of triggers(W)) {
    const j = g.j, tc = W[j].e; if (tc < from - 86400 * 3 || tc >= to || j < SWING_N) continue;
    const T = Math.floor(tc / 3600) * 3600, hi1 = K.closedCount(H1, T) - 1; if (hi1 < 15) continue;
    const c = ctx(T); if (c.st.some((x) => x < 0)) continue;
    const s = g.d, close = W[j].c, a = A[hi1];
    let lo = Infinity, hi = -Infinity; for (let k = j - SWING_N + 1; k <= j; k++) { lo = Math.min(lo, W[k].l); hi = Math.max(hi, W[k].h); }
    const stop = s > 0 ? lo - 0.1 * a : hi + 0.1 * a;
    if (!(s * (close - stop) > 0)) throw new Error('stop on the wrong side');
    const dist = s * (close - stop); if (!(dist >= 2 * cost)) continue;
    const hr = new Date(W[j].t * 1000).getUTCHours(), ss = hr >= 7 && hr < 12 ? 1 : hr >= 12 && hr < 17 ? 2 : 3;
    const sd = c.side === s ? 1 : c.side === -s ? 2 : 0;
    const ps = c.half == null || c.px == null ? 0 : (s > 0 ? c.px < c.half : c.px > c.half) ? 1 : 2;
    const far = (d) => (d > 0 ? c.hi : c.lo);
    const r = tradeOne(M5, s, stop, tc, far(s), cost);
    const p = tradeOne(M5, -s, close + s * dist, tc, far(-s), cost);
    const ok = (x) => x && x.t >= from && x.t < to && !bad(x.t);
    if (!ok(r) && !ok(p)) continue;
    out.push({ tc, d: s, tg: g.tg, ss, st: c.st, sd, ps, o: ok(r) ? r : null, p: ok(p) ? p : null });
  }
  // context counts at every H1 close of the discovery years (for the collapse rule)
  const cnt = { n: 0, pairs: new Array(32).fill(0) };
  for (const b of H1) { if (b.e < from || b.e >= y(2015) || b.e >= to) continue; const c = ctx(b.e); if (c.st.some((x) => x < 0)) continue;
    cnt.n++; cnt.pairs[c.st[1] * 4 + c.st[2]]++; cnt.pairs[16 + c.st[0] * 4 + c.st[1]]++; }
  return { rows: out, cnt };
}

// ---- the collapse rule: keep a pair holding >= 3% of the discovery H1 closes, pooled --------------------------------
export function keptLevels(counts) {
  let n = 0; const pairs = new Array(32).fill(0);
  for (const c of counts) { n += c.n; c.pairs.forEach((v, i) => { pairs[i] += v; }); }
  const kept = [], dropped = [];
  ALL_LEVELS.forEach((L, i) => {
    if (!L.pair) { kept.push(L); return; }
    const share = pairs[i - 13] / n; (share >= PAIR_MIN ? kept : dropped).push({ ...L, share: +share.toFixed(4) });
  });
  return { kept, dropped, n };
}

// ---- accumulate into cells ------------------------------------------------------------------------------------------
const monthOf = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2010) * 12 + d.getUTCMonth(); };
export function accumulate(rows, kept) {
  const NC = kept.length * 3 * 3 * 4 * 4 * 5;
  const A = { NC, n: new Uint32Array(NC * 2 * 2), b: new Float64Array(NC * 2 * NM), a: new Float64Array(NC * 2 * NM) };
  for (const r of rows) {
    const lvs = levelsOf(r.st, kept), sds = r.sd ? [0, r.sd] : [0], pss = r.ps ? [0, r.ps] : [0], sss = [0, r.ss];
    for (const [pl, tr] of [[0, r.o], [1, r.p]]) {
      if (!tr) continue; const m = monthOf(tr.t); if (m < 0 || m >= NM) continue; const half = m < HALF_M ? 0 : 1;
      for (const lv of lvs) for (const sd of sds) for (const ps of pss) for (const ss of sss) for (let x = 0; x < 5; x++) {
        const R = tr.R[x]; if (!Number.isFinite(R)) continue;
        const c = pl * NC + cellIndex(lv, sd, ps, r.tg, ss, x);
        A.n[c * 2 + half]++; A.b[c * NM + m] += R; A.a[c * NM + m] += R - tr.cr;
      }
    }
  }
  return A;
}

// ---- statistics on 60-month windows (empty months = 0) ---------------------------------------------------------------
export function winStats(n, ms, off) {
  let s = 0; for (let k = 0; k < HALF_M; k++) s += ms[off + k]; const mean = s / HALF_M;
  let v = 0; for (let k = 0; k < HALF_M; k++) v += (ms[off + k] - mean) ** 2; const sd = Math.sqrt(v / (HALF_M - 1));
  return { n, mean: n ? s / n : null, t: sd > 0 ? mean / (sd / Math.sqrt(HALF_M)) : null };
}
const p1 = (t) => (t == null ? 1 : t > 0 ? K.pFromT(t, HALF_M - 1) / 2 : 1 - K.pFromT(t, HALF_M - 1) / 2);
const r4 = (x) => (x == null ? null : +x.toFixed(4)), r2 = (x) => (x == null ? null : +x.toFixed(2));
function cellStats(A, pl, c) {
  const k = pl * A.NC + c, o = {};
  for (const [w, off] of [['d', 0], ['c', HALF_M]]) {
    const n = A.n[k * 2 + (off ? 1 : 0)];
    const b = winStats(n, A.b.subarray(k * NM, k * NM + NM), off), a = winStats(n, A.a.subarray(k * NM, k * NM + NM), off);
    o[w] = { n, before: b.mean, tB: b.t, after: a.mean, tA: a.t };
  }
  return o;
}
export const winD = (s) => s.d.n >= 100 && s.d.before > 0 && s.d.tB >= 2;
export const confRaw = (s) => s.c.n >= 100 && s.c.before > 0 && s.c.tB >= 2;
const winDA = (s) => s.d.n >= 100 && s.d.after > 0 && s.d.tA >= 2;
const confRawA = (s) => s.c.n >= 100 && s.c.after > 0 && s.c.tA >= 2;

// scopes: { name: rows[] }. Only cells that reach n >= 100 in discovery (either the rule or its placebo) are kept in memory.
export function report(scopes, kept) {
  const all = []; let reach100 = 0, cells = 0;
  for (const [sc, rows] of Object.entries(scopes)) {
    const A = accumulate(rows, kept); cells += A.NC;
    for (let c = 0; c < A.NC; c++) {
      const s = cellStats(A, 0, c); if (s.d.n >= 100) reach100++;
      const p = cellStats(A, 1, c);
      if (s.d.n >= 100 || p.d.n >= 100 || s.c.n >= 50) all.push({ scope: sc, c, s, p });
    }
  }
  const grid = (key, wD, cR, tk) => {
    const wins = all.filter((x) => wD(x[key])), testable = wins.filter((x) => x[key].c.n >= 100);
    const pv = testable.map((x) => (x[key].c[tk === 'B' ? 'before' : 'after'] > 0 ? p1(x[key].c['t' + tk]) : 1));
    const h = K.holm(pv); testable.forEach((x, i) => { x['holm_' + key + tk] = h[i]; });
    return { wins, raw: wins.filter((x) => cR(x[key])), holm: testable.filter((x, i) => h[i] < 0.05 && cR(x[key])) };
  };
  const G = grid('s', winD, confRaw, 'B'), P = grid('p', winD, confRaw, 'B'), GA = grid('s', winDA, confRawA, 'A');
  const name = (x) => ({ scope: x.scope, ...cellName(x.c, kept) });
  const rnd = (w) => ({ n: w.n, before: r4(w.before), tB: r2(w.tB), after: r4(w.after), tA: r2(w.tA) });
  const fmt = (x, key = 's') => ({ ...name(x), discovery: rnd(x[key].d), confirmation: rnd(x[key].c) });
  const confirmed = G.holm.map((x) => ({ ...fmt(x), holm: +x.holm_sB.toPrecision(3), placebo: { discovery: rnd(x.p.d), confirmation: rnd(x.p.c), passes: confRaw(x.p) } }));
  const passing = confirmed.filter((x) => !x.placebo.passes);
  const by = (list) => { const o = {}; for (const f of ['scope', 'stage', 'side', 'pos', 'trigger', 'session', 'exit']) { o[f] = {}; for (const x of list) { const v = name(x)[f]; o[f][v] = (o[f][v] || 0) + 1; } } return o; };
  const best = (w, key = 's') => { const pool = all.filter((x) => x.scope === 'pooled' && x[key][w].n >= 100);
    pool.sort((a, b) => (b[key][w].tB ?? -99) - (a[key][w].tB ?? -99)); return pool.slice(0, 5).map((x) => fmt(x, key)); };
  const verdict = reach100 < 100 ? 'INCONCLUSIVE' : passing.length ? 'PASS' : 'FAIL';
  return {
    cells, reach100, verdict,
    counts: { discovery: G.wins.length, raw: G.raw.length, chance: +(G.wins.length * 0.0228).toFixed(1), holm: G.holm.length, holmNotPlacebo: passing.length,
      placebo: { discovery: P.wins.length, raw: P.raw.length, chance: +(P.wins.length * 0.0228).toFixed(1), holm: P.holm.length,
        holmAlsoAfterCosts: P.holm.filter((x) => winDA(x.p) && confRawA(x.p)).length, holmOtherSession: P.holm.filter((x) => name(x).session === 'other').length },
      afterCosts: { discovery: GA.wins.length, raw: GA.raw.length, holm: GA.holm.length } },
    byDiscovery: by(G.wins), byRaw: by(G.raw), byHolm: by(G.holm), placeboByRaw: by(P.raw),
    confirmed, bestDiscovery: best('d'), bestConfirmation: best('c'),
    placeboConfirmed: P.holm.slice(0, 60).map((x) => ({ ...fmt(x, 'p'), holm: +x.holm_pB.toPrecision(3) })), bestPlaceboConfirmation: best('c', 'p'),
    rawConfirmations: G.raw.sort((a, b) => b.s.c.tB - a.s.c.tB).slice(0, 40).map((x) => ({ ...fmt(x), placeboPasses: confRaw(x.p) })),
  };
}

// plain per-trigger totals (every trade, pooled), for the report
export function plain(rows) {
  const out = {};
  for (let tg = 0; tg < 4; tg++) for (const [w, a, b] of [['d', 0, HALF_M], ['c', HALF_M, NM]]) {
    for (const [pl, key] of [[0, 'o'], [1, 'p']]) {
      const ms = new Float64Array(NM), msA = new Float64Array(NM); let n = 0;
      for (const r of rows) { const tr = r[key]; if (r.tg !== tg || !tr) continue; const m = monthOf(tr.t); if (m < a || m >= b) continue; n++; ms[m] += tr.R[4]; msA[m] += tr.R[4] - tr.cr; }
      const sB = winStats(n, ms, a), sA = winStats(n, msA, a);
      (out[TRIGS[tg]] ||= {})[(pl ? 'placebo_' : '') + w] = { n, before: r4(sB.mean), tB: r2(sB.t), after: r4(sA.mean), tA: r2(sA.t) };
    }
  }
  return out;
}

// ---- command line --------------------------------------------------------------------------------------------------
const main = process.argv[1] === fileURLToPath(import.meta.url);
if (main && process.argv[2] === 'market') {
  const m = process.argv[3], dir = process.argv[4]; fs.mkdirSync(dir, { recursive: true });
  const M5 = K.load(m, '5m', { from: '2009-01-01', to: TO }), F = frames(M5);
  const t0 = Date.now(); const { rows, cnt } = tradesOf(M5, F, COSTS[m], { X: exclusions(m) });
  const f5 = (x) => (Number.isFinite(x) ? +x.toFixed(5) : null);
  const enc = (tr) => (tr ? [tr.t, f5(tr.cr), ...tr.R.map(f5)] : null);
  fs.writeFileSync(path.join(dir, m + '.json'), JSON.stringify({ market: m, cnt,
    rows: rows.map((r) => [r.tg, r.ss, r.st[0], r.st[1], r.st[2], r.sd, r.ps, enc(r.o), enc(r.p)]) }));
  console.log(m, rows.length, 'trigger rows', ((Date.now() - t0) / 1000).toFixed(0) + 's');
}
if (main && process.argv[2] === 'report') {
  const dir = process.argv[3], scopes = {}, counts = [];
  const dec = (e) => (e ? { t: e[0], cr: e[1], R: e.slice(2).map((v) => (v == null ? NaN : v)) } : null);
  for (const m of MARKETS) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')); counts.push(j.cnt);
    scopes[m] = j.rows.map((r) => ({ tg: r[0], ss: r[1], st: [r[2], r[3], r[4]], sd: r[5], ps: r[6], o: dec(r[7]), p: dec(r[8]) }));
  }
  scopes.pooled = MARKETS.flatMap((m) => scopes[m]);
  const { kept, dropped, n } = keptLevels(counts);
  const res = report(scopes, kept);
  const out = { study: 'grid6-phase-trigger', built: '2026-11-23', basis: 'judged before costs (pre-registered); after costs beside',
    window: 'fills 2010-01-01 to 2019-12-31; discovery 2010-2014, confirmation 2015-2019', markets: MARKETS,
    stageLevels: kept.map((L) => L.name), droppedPairs: dropped.map((L) => ({ name: L.name, share: L.share })), h1Closes: n,
    rows: Object.fromEntries(MARKETS.map((m) => [m, scopes[m].length])), plainTrail: plain(scopes.pooled), ...res };
  const c = out.counts, b = out.bestDiscovery[0], f = (x) => (x >= 0 ? '+' : '') + x.toFixed(3);
  out.headline = `${out.cells.toLocaleString('en-GB')} cells: ${c.discovery} discovery winners before costs, ${c.raw} raw confirmations on 2015-19 (${c.chance} expected by chance), ${c.holm} after Holm (${c.holmNotPlacebo} whose placebo fails). Best pooled discovery cell (${b.stage} / ${b.side} / ${b.pos} / ${b.trigger} / ${b.session} / ${b.exit}): ${f(b.discovery.before)}R a trade in 2010-14 (n ${b.discovery.n}, month t ${b.discovery.tB}), ${f(b.confirmation.before)}R in 2015-19 (n ${b.confirmation.n}, t ${b.confirmation.tB}). Placebo: ${c.placebo.discovery} discovery winners, ${c.placebo.holm} Holm.`;
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify({ verdict: out.verdict, counts: out.counts, reach100: out.reach100, cells: out.cells, kept: kept.length }, null, 1));
  console.log(out.headline);
}
