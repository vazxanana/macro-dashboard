// research/edge/grid5-cycle-box/run.mjs - PREREGISTRATION.md (23 Nov 2026): the market cycle stage of the timeframe above
// (phase.mjs) x side agreement x a swing-box event on the working timeframe x entry (market / trade-through limit) x stop x exit.
// Research only: reads the edgekit candle cache, writes <dir> and its own result.json. Nothing live imports it.
//   node --max-old-space-size=6000 research/edge/grid5-cycle-box/run.mjs market <m> <dir>   one market -> <dir>/<m>.json
//   node research/edge/grid5-cycle-box/run.mjs report <dir>                                  pool, the bar -> result.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { readPhase, readTf } from '../_lib/phase.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx, findFill, manage } from '../dom-trade-through/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (n) => Date.UTC(n, 0, 1) / 1000;
export const FROM = y(2010), TO = y(2020), NM = 120, HALF_M = 60;
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const CHAINS = [['1d', '4h'], ['4h', '1h'], ['1h', '15m']];
export const ABOVE_U = { '1d': '1w', '4h': '1d', '1h': '4h' };
export const STAGES = ['any', 'move', 'pullback', 'continuation'];
export const SIDES = ['none', 'one', 'two'];
export const EVENTS = ['break', 'false', 'retest'];
export const ENTRIES = ['mkt', 'lim'];
export const STOPS = ['box', 'atr'];
export const EXITS = ['1R', '2R', '3R', 'trail', 'box'];
const XSLOT = [0, 1, 2, 6, 5]; // manage(): 1R 2R 3R ... opp (slot 5, here the box height) trail (slot 6)
export const NC = CHAINS.length * STAGES.length * SIDES.length * EVENTS.length * ENTRIES.length * STOPS.length * EXITS.length; // 2160
export const cellIndex = (ch, sg, sd, ev, e, st, x) => ((((((ch * 4 + sg) * 3 + sd) * 3 + ev) * 2 + e) * 2 + st) * 5 + x);
export function cellName(c) {
  const x = c % 5; c = (c - x) / 5; const st = c % 2; c = (c - st) / 2; const e = c % 2; c = (c - e) / 2; const ev = c % 3; c = (c - ev) / 3;
  const sd = c % 3; c = (c - sd) / 3; const sg = c % 4; const ch = (c - sg) / 4;
  return { chain: CHAINS[ch].join('>'), stage: STAGES[sg], side: SIDES[sd], event: EVENTS[ev], entry: ENTRIES[e], stop: STOPS[st], exit: EXITS[x] };
}
export const CAP = { '4h': 5 * 86400, '1h': 2 * 86400, '15m': 86400 };
const FALSE_N = 6, RETEST_N = 12, LIM_N = 12, TAIL = 650;

// ---- box events on the working timeframe ---------------------------------------------------------------------------
// Each: { j (trigger index), d (trade direction), edge (the broken box edge), stopBox, height, kind 0 break | 1 false | 2 retest }.
// An event at j reads candles up to j only.
export function boxEvents(W) {
  const out = [];
  for (const b of K.boxesHL(W, 3)) {
    if (!b.dir || b.bi < 0) continue;
    const d = b.dir, bi = b.bi, edge = d > 0 ? b.hi : b.lo, height = b.hi - b.lo; if (!(height > 0)) continue;
    let lo = Math.min(b.lo, W[bi].l), hi = Math.max(b.hi, W[bi].h);
    out.push({ j: bi, d, edge, stopBox: d > 0 ? lo : hi, height, kind: 0 });
    for (let j = bi + 1; j < W.length && j <= bi + RETEST_N; j++) {
      const c = W[j]; lo = Math.min(lo, c.l); hi = Math.max(hi, c.h);
      const inside = d > 0 ? c.c <= b.hi : c.c >= b.lo;
      if (inside) { if (j <= bi + FALSE_N) out.push({ j, d: -d, edge, stopBox: -d > 0 ? lo : hi, height, kind: 1 }); break; }
      if (d > 0 ? c.l <= b.hi : c.h >= b.lo) { out.push({ j, d, edge, stopBox: d > 0 ? lo : hi, height, kind: 2 }); break; }
    }
  }
  return out.sort((a, b) => a.j - b.j || a.kind - b.kind);
}

// ---- the phase reading at a moment (readPhase on tails of closed candles; equal to readPhase on the whole series) ----
const tailOf = (B, t) => { const n = K.closedCount(B, t); return B.slice(Math.max(0, n - TAIL), n); };
export function phaseAt(F, chain, t) {
  const [U, W] = chain, need = new Set([U, W]); if (ABOVE_U[U] !== '1w') need.add(ABOVE_U[U]);
  const by = {}; for (const k of ['1d', '4h', '1h', '15m', '5m']) by[k] = need.has(k) ? tailOf(F[k], t) : [];
  const ph = readPhase(by, t);
  const up = ABOVE_U[U] === '1w' ? readTf(tailOf(F['1w'], t).slice(-600)).side : ph.tf[ABOVE_U[U]].side;
  return { stage: ph.tf[U].stage, side: ph.tf[U].side, above: up };
}

// ---- one trade (R of the five exits before costs, or null) -----------------------------------------------------------
export function tradeOne(M5, s, type, entry, stop, t0, expire, cap, height, cost) {
  let fi, fill, firstFull;
  if (type === 'mkt') { fi = startIdx(M5, t0); if (fi >= M5.length) return null; fill = M5[fi].o; firstFull = true; }
  else { const f = findFill(M5, s, entry, stop, t0, expire, 'through', cost / 2); if (!f) return null; fi = f.i; fill = f.fill; firstFull = false; }
  const risk = s * (fill - stop); if (!(risk >= cost) || !(risk > 0)) return null;
  const r = manage(M5, s, fi, fill, stop, cap, firstFull, height / risk); if (!r) return null;
  return { t: r.t, risk, cr: cost / risk, R: XSLOT.map((k) => r.R[k]) };
}

// ---- every trade of one market ---------------------------------------------------------------------------------------
// Returns rows { ch, sg (stage index 1..3, 0 = other), sd (agreement level 0..2), ev, e, st, t, cr, R[5], P (placebo) }.
export function tradesOf(M5, F, cost, { from = FROM, to = TO, X = [] } = {}) {
  const bad = (t) => X.some(([a, b]) => t >= a && t <= b), out = [];
  for (let ch = 0; ch < CHAINS.length; ch++) {
    const [U, Wk] = CHAINS[ch], W = F[Wk], A = atr14(W), sec = K.TF[Wk], cap = CAP[Wk];
    for (const ev of boxEvents(W)) {
      const tc = W[ev.j].e; if (tc < from - 86400 * 7 || tc >= to) continue;
      if (ev.j < 15) continue;
      const ph = phaseAt(F, CHAINS[ch], tc), s = ev.d, close = W[ev.j].c;
      const sg = Math.max(0, STAGES.indexOf(ph.stage));
      const sd = ph.side === s ? (ph.above === s ? 2 : 1) : 0;
      const stops = [ev.stopBox, null];
      for (let e = 0; e < 2; e++) {
        const type = ENTRIES[e], ref = type === 'mkt' ? close : ev.edge;
        if (type === 'lim' && !(s * (close - ref) >= 0)) continue; // a limit already on the wrong side is not placed
        for (let st = 0; st < 2; st++) {
          const stop = st === 0 ? stops[0] : ref - s * A[ev.j];
          const dist = s * (ref - stop); if (!(dist >= 2 * cost)) continue;
          const r = tradeOne(M5, s, type, ref, stop, tc, tc + LIM_N * sec, cap, ev.height, cost);
          const p = tradeOne(M5, -s, 'mkt', close, close + s * dist, tc, 0, cap, ev.height, cost);
          const ok = (x) => x && x.t >= from && x.t < to && !bad(x.t) && x.R.every(Number.isFinite);
          if (!(stop < ref ? s > 0 : s < 0)) throw new Error('stop on the wrong side');
          if (!ok(r) && !ok(p)) continue;
          out.push({ ch, sg, sd, ev: ev.kind, e, st, tc, d: s, o: ok(r) ? r : null, p: ok(p) ? p : null });
        }
      }
    }
  }
  return out;
}

// ---- accumulate into cells ------------------------------------------------------------------------------------------
const monthOf = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2010) * 12 + d.getUTCMonth(); };
export function accumulate(rows) {
  const A = { n: new Uint32Array(NC * 2 * 2), b: new Float64Array(NC * 2 * NM), a: new Float64Array(NC * 2 * NM) }; // [placebo][cell]
  for (const r of rows) for (const [pl, tr] of [[0, r.o], [1, r.p]]) {
    if (!tr) continue; const m = monthOf(tr.t); if (m < 0 || m >= NM) continue; const half = m < HALF_M ? 0 : 1;
    for (const sg of r.sg ? [0, r.sg] : [0]) for (let sd = 0; sd <= r.sd; sd++) for (let x = 0; x < 5; x++) {
      const c = pl * NC + cellIndex(r.ch, sg, sd, r.ev, r.e, r.st, x);
      A.n[c * 2 + half]++; A.b[c * NM + m] += tr.R[x]; A.a[c * NM + m] += tr.R[x] - tr.cr;
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
  const k = pl * NC + c, o = {};
  for (const [w, off] of [['d', 0], ['c', HALF_M]]) {
    const n = A.n[k * 2 + (off ? 1 : 0)];
    const b = winStats(n, A.b.subarray(k * NM, k * NM + NM), off), a = winStats(n, A.a.subarray(k * NM, k * NM + NM), off);
    o[w] = { n, before: b.mean, tB: b.t, after: a.mean, tA: a.t };
  }
  return o;
}
const winD = (s) => s.d.n >= 100 && s.d.before > 0 && s.d.tB >= 2;
const confRaw = (s) => s.c.n >= 50 && s.c.before > 0 && s.c.tB >= 2;
const winDA = (s) => s.d.n >= 100 && s.d.after > 0 && s.d.tA >= 2;
const confRawA = (s) => s.c.n >= 50 && s.c.after > 0 && s.c.tA >= 2;

export function report(acc) {
  const scopes = [...MARKETS, 'pooled'];
  const pooled = { n: new Uint32Array(NC * 4), b: new Float64Array(NC * 2 * NM), a: new Float64Array(NC * 2 * NM) };
  for (const m of MARKETS) for (const k of ['n', 'b', 'a']) for (let i = 0; i < pooled[k].length; i++) pooled[k][i] += acc[m][k][i];
  const ACC = { ...acc, pooled };
  const all = []; let reach100 = 0;
  for (const sc of scopes) for (let c = 0; c < NC; c++) {
    const s = cellStats(ACC[sc], 0, c), p = cellStats(ACC[sc], 1, c);
    if (s.d.n >= 100) reach100++;
    all.push({ scope: sc, c, s, p });
  }
  const grid = (key, wD, cR) => {
    const wins = all.filter((x) => wD(x[key])), testable = wins.filter((x) => x[key].c.n >= 50);
    const pv = testable.map((x) => (x[key].c[cR === confRaw ? 'before' : 'after'] > 0 ? p1(x[key].c[cR === confRaw ? 'tB' : 'tA']) : 1));
    const h = K.holm(pv); testable.forEach((x, i) => { x['holm_' + key + (cR === confRaw ? 'B' : 'A')] = h[i]; });
    const raw = wins.filter((x) => cR(x[key])), holm = testable.filter((x, i) => h[i] < 0.05 && cR(x[key]));
    return { wins, raw, holm };
  };
  const G = grid('s', winD, confRaw), P = grid('p', winD, confRaw), GA = grid('s', winDA, confRawA);
  const name = (x) => ({ scope: x.scope, ...cellName(x.c) });
  const fmt = (x, key = 's') => ({ ...name(x), discovery: rnd(x[key].d), confirmation: rnd(x[key].c) });
  const rnd = (w) => ({ n: w.n, before: r4(w.before), tB: r2(w.tB), after: r4(w.after), tA: r2(w.tA) });
  const confirmed = G.holm.map((x) => ({ ...fmt(x), holm: +x.holm_sB.toPrecision(3), placebo: { discovery: rnd(x.p.d), confirmation: rnd(x.p.c), passes: confRaw(x.p) } }));
  const passing = confirmed.filter((x) => !x.placebo.passes);
  const by = (list) => { const o = {}; for (const f of ['scope', 'chain', 'stage', 'side', 'event', 'entry', 'stop', 'exit']) { o[f] = {}; for (const x of list) { const v = name(x)[f]; o[f][v] = (o[f][v] || 0) + 1; } } return o; };
  const best = (w, key = 's') => { const pool = all.filter((x) => x.scope === 'pooled' && x[key][w].n >= (w === 'd' ? 100 : 50));
    pool.sort((a, b) => (b[key][w].tB ?? -99) - (a[key][w].tB ?? -99)); return pool.slice(0, 5).map((x) => fmt(x, key)); };
  const verdict = reach100 < 100 ? 'INCONCLUSIVE' : passing.length ? 'PASS' : 'FAIL';
  return {
    study: 'grid5-cycle-box', built: '2026-11-23', basis: 'judged before costs (pre-registered); after costs beside',
    window: 'fills 2010-01-01 to 2019-12-31; discovery 2010-2014, confirmation 2015-2019', markets: MARKETS,
    cells: all.length, rulesPerScope: NC, reach100, verdict,
    counts: { discovery: G.wins.length, raw: G.raw.length, chance: +(G.wins.length * 0.0228).toFixed(1), holm: G.holm.length, holmNotPlacebo: passing.length,
      placebo: { discovery: P.wins.length, raw: P.raw.length, chance: +(P.wins.length * 0.0228).toFixed(1), holm: P.holm.length },
      afterCosts: { discovery: GA.wins.length, raw: GA.raw.length, holm: GA.holm.length } },
    byDiscovery: by(G.wins), byRaw: by(G.raw), byHolm: by(G.holm),
    confirmed, bestDiscovery: best('d'), bestConfirmation: best('c'),
    placeboConfirmed: P.holm.map((x) => ({ ...fmt(x, 'p'), holm: +x.holm_pB.toPrecision(3) })), bestPlaceboConfirmation: best('c', 'p'),
    placeboByRaw: by(P.raw),
    rawConfirmations: G.raw.slice(0, 60).map((x) => ({ ...fmt(x), placeboPasses: confRaw(x.p) })),
  };
}

// ---- command line --------------------------------------------------------------------------------------------------
const main = process.argv[1] === fileURLToPath(import.meta.url);
if (main && process.argv[2] === 'market') {
  const m = process.argv[3], dir = process.argv[4]; fs.mkdirSync(dir, { recursive: true });
  const M5 = K.load(m, '5m', { from: '2009-01-01', to: TO }), F = frames(M5);
  const t0 = Date.now(); const rows = tradesOf(M5, F, COSTS[m], { X: exclusions(m) });
  const A = accumulate(rows);
  const enc = (a) => Array.from(a, (v) => +v.toFixed(5));
  fs.writeFileSync(path.join(dir, m + '.json'), JSON.stringify({ market: m, rows: rows.length, n: Array.from(A.n), b: enc(A.b), a: enc(A.a) }));
  console.log(m, rows.length, 'signal-entry-stop rows', ((Date.now() - t0) / 1000).toFixed(0) + 's');
}
if (main && process.argv[2] === 'report') {
  const dir = process.argv[3], acc = {};
  for (const m of MARKETS) { const j = JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')); acc[m] = { n: Uint32Array.from(j.n), b: Float64Array.from(j.b), a: Float64Array.from(j.a), rows: j.rows }; }
  const res = report(acc), c = res.counts, b = res.bestDiscovery[0], f = (x) => (x >= 0 ? '+' : '') + x.toFixed(3);
  res.headline = `${res.cells.toLocaleString('en-GB')} cells: ${c.discovery} discovery winners before costs, ${c.raw} raw confirmations on 2015-19 (${c.chance} expected by chance), ${c.holm} after Holm. Best pooled discovery cell (${b.chain} ${b.stage} ${b.side} ${b.event} ${b.entry}/${b.stop} ${b.exit}): ${f(b.discovery.before)}R a trade in 2010-14 (n ${b.discovery.n}, month t ${b.discovery.tB}), ${f(b.confirmation.before)}R in 2015-19 (n ${b.confirmation.n}, t ${b.confirmation.tB}). The side-flipped placebo did better (${c.placebo.discovery} discovery winners, ${c.placebo.holm} Holm).`;
  res.rows = Object.fromEntries(MARKETS.map((m) => [m, acc[m].rows]));
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  console.log(JSON.stringify({ verdict: res.verdict, counts: res.counts, reach100: res.reach100, confirmed: res.confirmed.length }, null, 1));
}
