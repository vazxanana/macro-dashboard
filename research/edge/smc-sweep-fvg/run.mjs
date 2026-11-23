// research/edge/smc-sweep-fvg/run.mjs - liquidity sweep -> M5 change of character -> fair value gap limit (PREREGISTRATION.md,
// 23 Nov 2026). H4 structure gives the side; an H1 candle sweeps a pool (H1 swing low / Asia low / previous day low) and closes
// back; M5 closes beyond the last swing made after the sweep; a limit rests at the 50 % of the latest unfilled gap of that leg.
// node research/edge/smc-sweep-fvg/run.mjs run [outFile]     the five markets 2010-2019, writes result.json + RESULT tables
// Research only: imports edgekit, grid 3's multi() and grid 2's COSTS / exclusions (never edits them); places nothing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { multi } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const P = { k4: 3, k1: 3, k5: 2, window: 48, life: 24, cap: 86400, placeboBack: 24, oppMin: 1, oppMax: 10, oppBack: 2000 };
export const FROM = Date.UTC(2010, 0, 1) / 1000, TO = Date.UTC(2020, 0, 1) / 1000, HALF = Date.UTC(2015, 0, 1) / 1000;
const DAY = 86400, H = 3600;

// ---- signals ---------------------------------------------------------------------------------------------------------
// Every sweep -> CHoCH -> FVG setup of both sides (the H4 side recorded, not applied). Each signal:
// { s, j (CHoCH M5 index), t0 (its close), bias (H4 side), pool, sweepT, ext, e50, eEdge, stop50, stopEdge, risk, pdOk, oppPx,
//   fvg { k, bot, top } }. Uses only candles closed by t0.
export function signals(M5, market) {
  const cost = COSTS[market];
  const H1 = K.resample(M5, 3600), H4 = K.resample(M5, 14400), D = K.dailyNY(M5);
  // H1 / H4 / D candles still forming at the end of the series are not closed: they are only read through closedCount
  const st4 = K.structure(H4, P.k4).side;
  const sw4 = K.swings(H4, P.k4).sort((a, b) => a.ct - b.ct);
  const sw1 = K.swings(H1, P.k1).sort((a, b) => a.ct - b.ct);
  sw1.hiAt = new Float64Array(H1.length).fill(NaN); sw1.loAt = new Float64Array(H1.length).fill(NaN);
  for (const w of sw1) (w.type === 'H' ? sw1.hiAt : sw1.loAt)[w.i] = w.price;
  const sw5 = K.swings(M5, P.k5); const byCi = new Map();
  for (const w of sw5) { if (!byCi.has(w.ci)) byCi.set(w.ci, []); byCi.get(w.ci).push(w); }
  const m5At = (t) => { let lo = 0, hi = M5.length; while (lo < hi) { const m = (lo + hi) >> 1; if (M5[m].t < t) lo = m + 1; else hi = m; } return lo; };
  const pools = { 1: [], '-1': [] }; // alive pools below (buy) / above (sell): { level, kind, until }
  let k1 = 0, dk = 0, asiaDay = -1;
  const out = [];
  for (let h = 0; h < H1.length; h++) {
    const c = H1[h]; if (c.e > M5[M5.length - 1].e) break; // a candle still forming
    // add the pools known by this candle's start
    while (k1 < sw1.length && sw1[k1].ct <= c.t) { const w = sw1[k1++]; (w.type === 'L' ? pools[1] : pools[-1]).push({ level: w.price, kind: 'h1', until: Infinity }); }
    while (dk < D.length && D[dk].e <= c.t) dk++; // D[dk - 1] = the last closed trading day
    if (dk > 0 && D[dk - 1]._pooled !== true && D[dk - 1].e <= c.t) {
      const pd = D[dk - 1]; pd._pooled = true; const until = dk < D.length ? D[dk].e : Infinity;
      pools[1].push({ level: pd.l, kind: 'pdl', until }); pools[-1].push({ level: pd.h, kind: 'pdh', until });
    }
    const day = Math.floor(c.t / DAY) * DAY;
    if (c.t - day === 7 * H && asiaDay !== day) {
      asiaDay = day; let lo = Infinity, hi = -Infinity;
      for (let i = m5At(day); i < M5.length && M5[i].t < day + 7 * H; i++) { if (M5[i].l < lo) lo = M5[i].l; if (M5[i].h > hi) hi = M5[i].h; }
      if (lo < Infinity) { pools[1].push({ level: lo, kind: 'asia', until: day + 21 * H }); pools[-1].push({ level: hi, kind: 'asia', until: day + 21 * H }); }
    }
    for (const s of [1, -1]) {
      const list = pools[s]; const keep = []; const swept = [];
      for (const p of list) {
        if (c.t >= p.until) continue; // expired
        const through = s > 0 ? c.l < p.level : c.h > p.level;
        if (!through) { keep.push(p); continue; }
        if (s > 0 ? c.c > p.level : c.c < p.level) swept.push(p.kind);
      }
      pools[s] = keep;
      if (!swept.length || c.e <= FROM - 30 * DAY) continue;
      const pool = ['pdl', 'pdh'].some((x) => swept.includes(x)) ? 'pd' : swept.includes('asia') ? 'asia' : 'h1';
      const sig = choch(M5, byCi, s, m5At(c.t), m5At(c.e), cost);
      if (!sig) continue;
      const t0 = M5[sig.j].e;
      const i4 = K.closedCount(H4, c.e) - 1; const bias = i4 >= 0 ? st4[i4] : 0;
      // premium / discount: the latest H4 swing high and low confirmed by t0
      let hi4 = null, lo4 = null; for (let q = sw4.length - 1; q >= 0 && (hi4 == null || lo4 == null); q--) { const w = sw4[q]; if (w.ct > t0) continue; if (w.type === 'H' && hi4 == null) hi4 = w.price; if (w.type === 'L' && lo4 == null) lo4 = w.price; }
      const mid4 = hi4 != null && lo4 != null ? (hi4 + lo4) / 2 : null;
      const pdOk = mid4 != null && (s > 0 ? sig.e50 < mid4 : sig.e50 > mid4);
      const oppPx = oppPool(H1, sw1, D, M5, s, sig.j, t0, sig.e50);
      out.push({ s, j: sig.j, t0, bias, pool, sweepT: c.e, hour: new Date(t0 * 1000).getUTCHours(), pdOk, oppPx, ...sig });
    }
  }
  return out;
}

// M5 change of character after a sweep hour [a, b) (M5 indices) and the fair value gap of its leg.
export function choch(M5, byCi, s, a, b, cost) {
  if (a >= b) return null;
  let xi = a; for (let i = a; i < b; i++) if (s > 0 ? M5[i].l < M5[xi].l : M5[i].h > M5[xi].h) xi = i;
  let ext = s > 0 ? M5[a].l : M5[a].h; for (let i = a; i <= xi; i++) ext = s > 0 ? Math.min(ext, M5[i].l) : Math.max(ext, M5[i].h);
  let sw = null; const last = Math.min(M5.length - 1, b - 1 + P.window);
  for (let j = xi + 1; j <= last; j++) {
    const ws = byCi.get(j - 1); if (ws) for (const w of ws) if (w.i > xi && w.type === (s > 0 ? 'H' : 'L')) sw = w;
    const x = M5[j];
    if (s > 0 ? x.c < ext : x.c > ext) return null; // a close beyond the running extreme cancels
    ext = s > 0 ? Math.min(ext, x.l) : Math.max(ext, x.h);
    if (sw && (s > 0 ? x.c > sw.price : x.c < sw.price)) {
      if (j < b - 1) { sw = null; continue; } // broken inside the sweep hour: that swing is used up
      const g = fvg(M5, s, xi, j); if (!g) return null;
      const e50 = (g.bot + g.top) / 2, eEdge = s > 0 ? g.top : g.bot;
      const stop = ext - s * cost / 2;
      return { j, xi, ext, fvg: g, e50, eEdge, stop, risk: s * (e50 - stop), riskEdge: s * (eEdge - stop), swing: sw.price };
    }
  }
  return null;
}

// The most recent three-candle gap of the leg (k after the extreme, at or before j) whose 50 % no later candle up to j reached.
export function fvg(M5, s, xi, j) {
  let reach = s > 0 ? Infinity : -Infinity; // the extreme traded by candles k+1..j
  for (let k = j; k >= xi + 2; k--) {
    if (k < j) reach = s > 0 ? Math.min(reach, M5[k + 1].l) : Math.max(reach, M5[k + 1].h);
    const gap = s > 0 ? M5[k].l > M5[k - 2].h : M5[k].h < M5[k - 2].l;
    if (!gap) continue;
    const bot = s > 0 ? M5[k - 2].h : M5[k].h, top = s > 0 ? M5[k].l : M5[k - 2].l, mid = (bot + top) / 2;
    if (s > 0 ? reach > mid : reach < mid) return { k, bot, top };
  }
  return null;
}

// The nearest opposite pool beyond the entry: the previous day's high (low) and the alive H1 swing highs (lows) at t0.
export function oppPool(H1, sw1, D, M5, s, j, t0, entry) {
  const cands = [];
  const dc = K.closedCount(D, t0); if (dc > 0) cands.push(s > 0 ? D[dc - 1].h : D[dc - 1].l);
  const n1 = K.closedCount(H1, t0); // H1 candles closed by t0
  let part = s > 0 ? -Infinity : Infinity; // the M5 candles of the hour still forming, up to j
  const hs = n1 < H1.length ? H1[n1].t : Infinity;
  for (let i = j; i >= 0 && M5[i].t >= hs; i--) part = s > 0 ? Math.max(part, M5[i].h) : Math.min(part, M5[i].l);
  // alive H1 swing extremes: walk back from the last closed H1 candle with the running extreme of the candles after each
  const swAt = s > 0 ? sw1.hiAt : sw1.loAt;
  let run = part;
  for (let i = n1 - 1; i >= 0 && i >= n1 - P.oppBack; i--) {
    if (i + P.k1 < n1 && !Number.isNaN(swAt[i])) { const px = swAt[i]; if (s > 0 ? px > run : px < run) cands.push(px); }
    run = s > 0 ? Math.max(run, H1[i].h) : Math.min(run, H1[i].l);
  }
  return cands.filter((x) => s * (x - entry) > 0).sort((a, b) => s * (a - b));
}

// ---- trades ------------------------------------------------------------------------------------------------------------
// Fill index and exit time of one exit (multi()'s rules), for the one-at-a-time rule; R itself comes from multi().
export function track(M5, s, entry, stop, target, t0, expire, cap) {
  let lo = 0, hi = M5.length; while (lo < hi) { const m = (lo + hi) >> 1; if (M5[m].t < t0) lo = m + 1; else hi = m; }
  let i = lo, fill = null;
  for (; i < M5.length; i++) { const b = M5[i]; if (b.t >= expire) return { fill: null, busy: expire };
    if (s > 0 ? b.l <= entry : b.h >= entry) { fill = s > 0 ? Math.min(b.o, entry) : Math.max(b.o, entry); break; }
    if (s > 0 ? b.c < stop : b.c > stop) return { fill: null, busy: b.e }; }
  if (fill == null) return { fill: null, busy: expire };
  const fi = i, deadline = M5[fi].t + cap;
  for (let j = fi; j < M5.length; j++) { const b = M5[j], first = j === fi;
    if (!first && (s * (b.o - stop) <= 0 || s * (b.o - target) >= 0)) return { fill, busy: b.t, px: b.o };
    if (s > 0 ? b.l <= stop : b.h >= stop) return { fill, busy: b.e, px: stop };
    if (!first && (s > 0 ? b.h >= target : b.l <= target)) return { fill, busy: b.e, px: target };
    if (b.e >= deadline) return { fill, busy: b.e, px: b.c };
  }
  return { fill, busy: Infinity };
}

const welch = (a, b) => { const m = (x) => x.reduce((p, q) => p + q, 0) / x.length; const v = (x, mu) => x.reduce((p, q) => p + (q - mu) ** 2, 0) / (x.length - 1);
  if (a.length < 2 || b.length < 2) return { diff: null, t: null }; const ma = m(a), mb = m(b), se = Math.sqrt(v(a, ma) / a.length + v(b, mb) / b.length);
  return { diff: ma - mb, t: se > 0 ? (ma - mb) / se : null }; };
export { welch };

function seedOf(market, stream) { let h = 2166136261; for (const ch of market + '|' + stream) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

// A placebo limit for a real trade: the 50 % of a random same-colour M5 body of the 24 candles before the CHoCH candle,
// below (above for a sell) the CHoCH close and not reached since.
export function placeboEntry(M5, s, j, R) {
  const ok = []; let reach = s > 0 ? Infinity : -Infinity;
  for (let q = j - 1; q >= Math.max(0, j - P.placeboBack); q--) {
    reach = s > 0 ? Math.min(reach, M5[q + 1].l) : Math.max(reach, M5[q + 1].h);
    const b = M5[q]; if (!(s * (b.c - b.o) > 0)) continue; const mid = (b.o + b.c) / 2;
    if (s * (M5[j].c - mid) > 0 && (s > 0 ? reach > mid : reach < mid)) ok.push(mid);
  }
  return ok.length ? ok[Math.floor(R() * ok.length)] : null;
}

// One stream of one market: sig filter, entry kind, target kind -> trades (one at a time) and their placebo trades.
export function stream(M5, sigs, market, { filter, entry = 'e50', target = '2R', name }) {
  const cost = COSTS[market], X = exclusions(market);
  const bad = (t) => X.some((x) => t >= x[0] && t <= x[1]);
  const run = (list, placebo) => {
    const out = []; let busy = -Infinity; const R0 = K.rng(seedOf(market, name + (placebo ? '|placebo' : '')));
    for (const g of list) {
      if (g.t0 < busy) continue;
      let e = g.e, stop = g.stop, oppR = g.oppR;
      if (placebo) { e = placeboEntry(M5, g.s, g.j, R0); if (e == null) continue; stop = e - g.s * g.risk; }
      const risk = g.s * (e - stop); if (!(risk >= cost)) continue;
      const tgt = target === '2R' ? 2 : oppR; const tgtPx = e + g.s * tgt * risk;
      const exp = g.t0 + P.life * 300;
      const tr = track(M5, g.s, e, stop, tgtPx, g.t0, exp, P.cap); busy = tr.busy;
      const r = multi(M5, g.s, e, stop, 'lim', g.t0, exp, target === '2R' ? 2 : oppR, null, P.cap, null);
      if (!r) continue;
      const R = target === '2R' ? r.R[1] : r.R[5];
      out.push({ t: r.t, exitT: Math.min(tr.busy, TO + 30 * DAY), R, Rnet: R - cost / r.risk, s: g.s, hour: g.hour, pool: g.pool, market, src: g });
    }
    return out;
  };
  const cand = [];
  for (const g of sigs) {
    if (g.t0 < FROM || g.t0 >= TO || bad(g.t0) || !filter(g)) continue;
    const e = entry === 'e50' ? g.e50 : g.eEdge; const risk = g.s * (e - g.stop);
    let oppR = null;
    if (target === 'opp') { const px = g.oppPx.find((x) => { const d = g.s * (x - e) / risk; return d >= P.oppMin; }); if (px == null) continue;
      oppR = g.s * (px - e) / risk; if (oppR > P.oppMax) continue; }
    cand.push({ ...g, e, risk, oppR });
  }
  const real = run(cand, false);
  const placebo = run(real.map((x) => x.src), true);
  return { real, placebo };
}

// ---- statistics and the run ------------------------------------------------------------------------------------------
export function summ(trades, key = 'R') {
  const s = K.stats(trades, { key, time: 'exitT', isFrom: 2010, isTo: 2015 });
  const f = (o) => ({ n: o.n, meanR: o.meanR == null ? null : +o.meanR.toFixed(4), tMonth: o.tMonth == null ? null : +o.tMonth.toFixed(2), months: o.months });
  return { all: f(s), disc: f(s.IS), conf: f(s.OOS), wins: s.wins };
}

export const TESTS = [
  { id: 'T1', name: 'base model, 50 % entry, 2R', filter: (g) => g.bias === g.s, entry: 'e50', target: '2R' },
  { id: 'T2', name: 'T1 + premium / discount', filter: (g) => g.bias === g.s && g.pdOk, entry: 'e50', target: '2R' },
  { id: 'T3', name: 'base model, opposite-pool target', filter: (g) => g.bias === g.s, entry: 'e50', target: 'opp' },
];
const REPORTED = [
  { id: 'R-edge', name: 'near-edge entry, 2R', filter: (g) => g.bias === g.s, entry: 'edge', target: '2R' },
  { id: 'R-noside', name: 'no H4 side (every sweep), 2R', filter: () => true, entry: 'e50', target: '2R' },
];

export function judge(real, placebo) {
  const a = summ(real), c = summ(real, 'Rnet'), p = summ(placebo);
  const w = welch(real.map((x) => x.R), placebo.map((x) => x.R));
  const pTwo = a.all.tMonth == null ? 1 : K.pFromT(a.all.tMonth, a.all.months - 1);
  return { before: a, after: c, placebo: p, vsPlacebo: { diff: w.diff == null ? null : +w.diff.toFixed(4), t: w.t == null ? null : +w.t.toFixed(2) }, p: pTwo };
}

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv[2] === 'run') {
  const all = Object.fromEntries([...TESTS, ...REPORTED].map((x) => [x.id, { real: [], placebo: [] }]));
  const perMarket = {};
  for (const m of K.MARKETS) {
    const t0 = Date.now(); const M5 = K.load(m, '5m', { from: '2009-01-01', to: '2020-01-02' });
    const sigs = signals(M5, m); perMarket[m] = { signals: sigs.length };
    for (const T of [...TESTS, ...REPORTED]) { const r = stream(M5, sigs, m, T); all[T.id].real.push(...r.real); all[T.id].placebo.push(...r.placebo);
      perMarket[m][T.id] = { before: summ(r.real).all, after: summ(r.real, 'Rnet').all, placebo: summ(r.placebo).all }; }
    console.log(m, sigs.length, 'signals', ((Date.now() - t0) / 1000).toFixed(0) + 's', JSON.stringify(perMarket[m].T1));
  }
  const res = {}; for (const T of [...TESTS, ...REPORTED]) res[T.id] = { name: T.name, ...judge(all[T.id].real, all[T.id].placebo) };
  const holm = K.holm(TESTS.map((T) => res[T.id].p));
  TESTS.forEach((T, i) => { const r = res[T.id]; r.holm = +holm[i].toPrecision(3);
    r.thin = r.before.disc.n < 100 || r.before.conf.n < 100;
    r.pass = r.before.disc.meanR > 0 && r.before.conf.meanR > 0 && r.before.disc.tMonth >= 2 && r.before.conf.tMonth >= 2 && r.holm < 0.05 && r.vsPlacebo.t >= 2; });
  // sessions and pools of T1
  const split = (arr, f) => { const g = {}; for (const x of arr) (g[f(x)] ||= []).push(x); return Object.fromEntries(Object.entries(g).map(([k, v]) => [k, { before: summ(v).all, after: summ(v, 'Rnet').all }])); };
  const sess = (x) => (x.hour >= 7 && x.hour < 12 ? 'london' : x.hour >= 12 && x.hour < 17 ? 'newyork' : 'other');
  const out = { study: 'smc-sweep-fvg', built: '2026-11-23', basis: 'judged before costs (owner); after costs beside',
    window: '2010-01-01 to 2019-12-31 (discovery 2010-2014, confirmation 2015-2019)', markets: K.MARKETS, params: P,
    tests: res, sessionsT1: split(all.T1.real, sess), poolsT1: split(all.T1.real, (x) => x.pool),
    sideT1: split(all.T1.real, (x) => (x.s > 0 ? 'buy' : 'sell')), perMarket };
  const thin = TESTS.some((T) => res[T.id].thin), pass = TESTS.some((T) => res[T.id].pass);
  out.verdict = pass ? 'PASS' : thin && !pass ? 'INCONCLUSIVE' : 'FAIL';
  const t1 = res.T1.before.all;
  out.headline = `${out.verdict}, ${TESTS.filter((T) => res[T.id].pass).length} of 3. T1 base model ${t1.meanR >= 0 ? '+' : ''}${t1.meanR.toFixed(3)}R a trade before costs (n ${t1.n}, month t ${t1.tMonth}); placebo difference ${res.T1.vsPlacebo.diff >= 0 ? '+' : ''}${res.T1.vsPlacebo.diff}R (Welch t ${res.T1.vsPlacebo.t}).`;
  fs.writeFileSync(process.argv[3] || path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(out.headline);
}
