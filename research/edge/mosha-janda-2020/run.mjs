// research/edge/mosha-janda-2020/run.mjs - the Janda two-step barrier entry on 18 markets, 2020 to now (pre-registered
// 23 Nov 2026 in PREREGISTRATION.md, committed before this file). Research only: nothing live reads it.
//   node research/edge/mosha-janda-2020/run.mjs           every market, writes result.json next to this file
//   node research/edge/mosha-janda-2020/run.mjs cut        the gold cut test only (prints it)
// Imports the barrier zones, the touch and the engulf of research/edge/barrier-qm-janda (unchanged), edgekit, and the costs and
// data-quality exclusions of research/edge/combo-grid-2.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { zones, touchOf, engulfs } from '../barrier-qm-janda/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';

export const MARKETS18 = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy', 'xag', 'gbpjpy', 'eurgbp', 'audjpy', 'cadjpy', 'euraud', 'nas100', 'spx500', 'de40'];
export const PAIRS = [['4h', '15m'], ['1h', '5m']];
export const P = { K: 3, qmWin: 48, secondWin: 48, life: 24, hold: 20, bufAtr: 0.1, minCostX: 3, shallow: 0.5, atrN: 14 };
export const RRS = [2, 3];
export const START = Date.UTC(2020, 0, 1) / 1000, SPLIT = Date.UTC(2024, 0, 1) / 1000;
export const TESTS = [
  { id: 'T1', label: 'every Janda trade, buys and sells', keep: () => true },
  { id: 'T2', label: 'buys only', keep: (x) => x.side > 0 },
  { id: 'T3', label: 'shallow turns only (QM head at most half way into the barrier zone)', keep: (x) => x.shallow },
];

const lowerBound = (arr, v, f) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (f(arr[m]) < v) lo = m + 1; else hi = m; } return lo; };

export function atr(C, n = P.atrN) { // simple mean of the true range of the last n candles, known at each close
  const out = new Float64Array(C.length); let s = 0; const tr = [];
  for (let i = 0; i < C.length; i++) {
    const p = i ? C[i - 1].c : C[i].o, x = Math.max(C[i].h - C[i].l, Math.abs(C[i].h - p), Math.abs(C[i].l - p));
    tr.push(x); s += x; if (tr.length > n) s -= tr[tr.length - n - 1];
    out[i] = s / Math.min(n, tr.length);
  }
  return out;
}

// Janda orders of one pair. B = barrier candles, C = confirmation candles, cost = round trip in price units.
// Returns { orders: [{ side, t, entry, stop, expire, depth, shallow, kind, j2 }], counts }.
export function janda(B, C, cost, pre = null) {
  const Q = pre?.Q || K.qms(C, P.K), G = pre?.G || engulfs(C);
  const SwC = pre?.SwC || K.swings(C, P.K).sort((a, b) => a.ci - b.ci);
  const Z = pre?.Z || zones(B), A = pre?.A || atr(C);
  const Gi = G.map((g) => g.i);
  const counts = { zones: Z.length, touched: 0, qm: 0, second: 0, noEngulf: 0, wrongSide: 0, smallStop: 0, orders: 0 };
  const out = [];
  for (const z of Z) {
    const tj = touchOf(B, z); if (tj < 0) continue;
    counts.touched++;
    const s = z.side, touchT = B[tj].e;
    if (s > 0 ? B[tj].c < z.lo : B[tj].c > z.hi) continue;
    const c0 = K.closedCount(C, touchT);
    let endFar = Infinity;
    for (let j = c0; j < C.length && j < c0 + P.qmWin; j++) if (s > 0 ? C[j].c < z.lo : C[j].c > z.hi) { endFar = j; break; }
    let qm = null;
    for (let x = lowerBound(Q, c0, (q) => q.i); x < Q.length && Q[x].i < c0 + P.qmWin; x++) {
      const q = Q[x]; if (q.i > endFar) break;
      if (q.side === s && q.head >= z.lo && q.head <= z.hi) { qm = q; break; }
    }
    if (!qm) continue;
    counts.qm++;
    let j2 = -1, sw = null, k = lowerBound(SwC, qm.i + 1, (w) => w.ci);
    for (let j = qm.i + 1; j < C.length && j <= qm.i + P.secondWin; j++) {
      while (k < SwC.length && SwC[k].ci < j) { const w = SwC[k++]; if (w.type === (s > 0 ? 'H' : 'L')) sw = w; }
      if (s > 0 ? C[j].c < qm.head : C[j].c > qm.head) break;
      if (sw && (s > 0 ? C[j].c > sw.price : C[j].c < sw.price)) { j2 = j; break; }
    }
    if (j2 < 0) continue;
    counts.second++;
    let ex = qm.i + 1;
    for (let x = qm.i + 1; x <= j2; x++) if (s > 0 ? C[x].l < C[ex].l : C[x].h > C[ex].h) ex = x;
    let g = null;
    for (let x = lowerBound(Gi, j2 + 1, (v) => v) - 1; x >= 0 && G[x].i >= ex; x--) if (G[x].side === s && G[x].b >= ex) { g = G[x]; break; }
    if (!g) { counts.noEngulf++; continue; }
    const lo = Math.min(C[g.b].l, C[g.i].l), hi = Math.max(C[g.b].h, C[g.i].h), entry = (lo + hi) / 2;
    if (s > 0 ? !(entry < C[j2].c) : !(entry > C[j2].c)) { counts.wrongSide++; continue; }
    const extreme = s > 0 ? C[ex].l : C[ex].h, buf = P.bufAtr * A[j2];
    const stop = extreme - s * buf, risk = s * (entry - stop);
    if (!(risk >= P.minCostX * cost)) { counts.smallStop++; continue; }
    const t = C[j2].e, step = C.length > 1 ? C[1].t - C[0].t : 0;
    let expire = j2 + P.life < C.length ? C[j2 + P.life].e : t + P.life * step;
    for (let j = j2 + 1; j < C.length && C[j].e <= expire; j++) if (s > 0 ? C[j].c < stop : C[j].c > stop) { expire = C[j].e; break; }
    const depth = s > 0 ? (z.hi - qm.head) / (z.hi - z.lo) : (qm.head - z.lo) / (z.hi - z.lo);
    counts.orders++;
    out.push({ side: s, t, entry, stop, expire, depth, shallow: depth <= P.shallow, kind: z.kind, j2 });
  }
  out.sort((a, b) => a.t - b.t || a.entry - b.entry);
  return { orders: out, counts };
}

function targetFirst(m5, side, target, from, to) {
  for (let i = lowerBound(m5, from, (b) => b.t); i < m5.length && m5[i].t < to; i++) if (side > 0 ? m5[i].h >= target : m5[i].l <= target) return m5[i].t;
  return Infinity;
}
const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };

// Trades of one pair and one target. X = bad intervals. Only trades closed by `end` are booked.
export function trades(U, m5, B, cost, rr, { X = [], end = Infinity } = {}) {
  const counts = { blocked: 0, nofill: 0, filled: 0, open: 0, bad: 0 };
  const out = []; let busy = -Infinity;
  for (const u of U) {
    if (u.t < busy) { counts.blocked++; continue; }
    const risk0 = u.side * (u.entry - u.stop), target = u.entry + u.side * rr * risk0;
    const expire = Math.min(u.expire, targetFirst(m5, u.side, target, u.t, u.expire));
    const base = { side: u.side, entry: u.entry, stop: u.stop, target, t: u.t, type: 'limit', expire };
    let r = K.simulate(base, m5, { cost });
    if (r.status === 'nofill' || r.status === 'bad') { counts.nofill++; busy = Math.max(busy, expire); continue; }
    let bi = K.barAt(B, r.fillT); if (bi < 0) bi = K.closedCount(B, r.fillT);
    const deadline = bi + P.hold < B.length ? B[bi + P.hold].e : Infinity;
    if (deadline !== Infinity) r = K.simulate({ ...base, maxHold: deadline - r.fillT }, m5, { cost });
    if (r.status === 'open' || deadline === Infinity || r.exitT > end) { counts.open++; busy = Infinity; continue; }
    busy = r.exitT;
    if (inBad(X, r.fillT)) { counts.bad++; continue; }
    counts.filled++;
    const cR = cost / r.risk;
    out.push({ side: u.side, t: u.t, fillT: r.fillT, exitT: r.exitT, entry: u.entry, stop: u.stop, target, fill: r.fill, exit: r.exit,
      reason: r.reason, risk: r.risk, R: r.R, Rnet: r.R - cR, R2: r.R - 2 * cR, depth: u.depth, shallow: u.shallow, kind: u.kind });
  }
  return { trades: out, counts };
}

// ---- statistics: month sums by exit month, empty months counted as zero ----------------------------------------------
const ym = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
export function windowStats(T, a, b, key = 'Rnet') {
  const xs = T.filter((x) => x.fillT >= a && x.fillT < b && Number.isFinite(x[key]));
  const n = xs.length, vals = xs.map((x) => x[key]);
  const mean = n ? vals.reduce((p, q) => p + q, 0) / n : null;
  const m0 = ym(a), m1 = ym(b - 1), sums = new Array(m1 - m0 + 1).fill(0);
  for (const x of xs) { const m = Math.min(m1, ym(x.exitT)) - m0; sums[m] += x[key]; }
  const M = sums.length, mm = sums.reduce((p, q) => p + q, 0) / M;
  const sd = M > 1 ? Math.sqrt(sums.reduce((p, q) => p + (q - mm) ** 2, 0) / (M - 1)) : 0;
  const tMonth = sd > 0 && n ? mm / (sd / Math.sqrt(M)) : null;
  return { n, wins: xs.filter((x) => x.R > 1e-9).length, meanR: mean, total: vals.reduce((p, q) => p + q, 0), months: M, tMonth,
    pMonth: tMonth == null ? null : K.pFromT(tMonth, M - 1) };
}
export function evaluate(T, end) {
  const e = { disc: windowStats(T, START, SPLIT), conf: windowStats(T, SPLIT, end) };
  e.disc2x = windowStats(T, START, SPLIT, 'R2'); e.conf2x = windowStats(T, SPLIT, end, 'R2');
  e.discGross = windowStats(T, START, SPLIT, 'R'); e.confGross = windowStats(T, SPLIT, end, 'R');
  const byYear = {};
  for (const x of T) { const y = new Date(x.fillT * 1000).getUTCFullYear(); const s = (byYear[y] ||= { n: 0, Rnet: 0 }); s.n++; s.Rnet += x.Rnet; }
  for (const y of Object.keys(byYear)) byYear[y].meanRnet = byYear[y].Rnet / byYear[y].n;
  e.byYear = byYear;
  return e;
}
export function bar(e, pHolm) {
  const lines = {
    discN100: e.disc.n >= 100, discMean: e.disc.meanR > 0, discT2: e.disc.tMonth != null && e.disc.tMonth >= 2,
    confN50: e.conf.n >= 50, confMean: e.conf.meanR > 0, confT2: e.conf.tMonth != null && e.conf.tMonth >= 2,
    confHolm: pHolm != null && pHolm < 0.05 && e.conf.tMonth > 0,
    twiceCost: e.disc2x.meanR > 0 && e.conf2x.meanR > 0,
  };
  return { lines, pass: Object.values(lines).every(Boolean) };
}
export function verdictOf(tests) {
  const v = Object.values(tests);
  if (v.some((x) => x.bar.pass)) return 'PASS';
  if (v.some((x) => x.eval.conf.n < 50)) return 'INCONCLUSIVE';
  if (v.some((x) => x.eval.disc.meanR > 0 && x.eval.conf.meanR > 0 && x.eval.conf.tMonth >= 1)) return 'INCONCLUSIVE';
  return 'FAIL';
}

function frames(m5) { return { '5m': m5, '15m': K.resample(m5, 900), '1h': K.resample(m5, 3600), '4h': K.resample(m5, 14400) }; }
function pre(B, C) { return { Q: K.qms(C, P.K), G: engulfs(C), SwC: K.swings(C, P.K).sort((a, b) => a.ci - b.ci), Z: zones(B), A: atr(C) }; }

// Cut test on real candles: orders placed before `cut` with every candle are the orders made from candles before `cut`.
export function cutTest(m5, cost, cut) {
  const F = frames(m5), G = frames(m5.filter((b) => b.e <= cut));
  const res = {};
  for (const [b, c] of PAIRS) {
    const key = (o) => [o.side, o.t, o.entry.toFixed(8), o.stop.toFixed(8)].join('|');
    const full = janda(F[b], F[c], cost).orders.filter((o) => o.t <= cut).map(key);
    const part = janda(G[b], G[c], cost).orders.filter((o) => o.t <= cut).map(key);
    res[b + '>' + c] = { full: full.length, cut: part.length, same: JSON.stringify(full) === JSON.stringify(part) };
  }
  return res;
}

function main() {
  const t0 = Date.now();
  const all = { 2: [], 3: [] }; const perMarket = {}; let end = 0;
  for (const mk of MARKETS18) {
    const m5 = K.load(mk, '5m', { from: '2019-09-01' });
    if (!m5.length) { perMarket[mk] = { error: 'no candles' }; continue; }
    const mEnd = m5[m5.length - 1].e; end = Math.max(end, mEnd);
    const F = frames(m5), cost = COSTS[mk], X = exclusions(mk);
    perMarket[mk] = { from: new Date(m5[0].t * 1000).toISOString().slice(0, 10), to: new Date(mEnd * 1000).toISOString().slice(0, 10), pairs: {} };
    for (const [b, c] of PAIRS) {
      const S = janda(F[b], F[c], cost, pre(F[b], F[c]));
      const pc = { ...S.counts };
      for (const rr of RRS) {
        const r = trades(S.orders, m5, F[b], cost, rr, { X, end: mEnd });
        for (const x of r.trades) { x.market = mk; x.pair = b + '>' + c; all[rr].push(x); }
        pc['rr' + rr] = r.counts;
      }
      perMarket[mk].pairs[b + '>' + c] = pc;
    }
    console.error(mk, JSON.stringify(perMarket[mk].pairs), ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  const endDay = Math.floor(end / 86400) * 86400;
  const tests = {};
  for (const T of TESTS) tests[T.id] = { label: T.label, eval: evaluate(all[2].filter(T.keep), endDay), rr3: evaluate(all[3].filter(T.keep), endDay) };
  const ph = K.holm(TESTS.map((T) => tests[T.id].eval.conf.pMonth ?? 1));
  TESTS.forEach((T, i) => { tests[T.id].pHolm = ph[i]; tests[T.id].bar = bar(tests[T.id].eval, ph[i]); });
  const verdict = verdictOf(tests);
  const report = {
    gold: evaluate(all[2].filter((x) => x.market === 'xau'), endDay),
    goldBuys: evaluate(all[2].filter((x) => x.market === 'xau' && x.side > 0), endDay),
    goldShallow: evaluate(all[2].filter((x) => x.market === 'xau' && x.shallow), endDay),
    sells: evaluate(all[2].filter((x) => x.side < 0), endDay),
    byPair: Object.fromEntries(PAIRS.map(([b, c]) => [b + '>' + c, evaluate(all[2].filter((x) => x.pair === b + '>' + c), endDay)])),
    byMarket: Object.fromEntries(MARKETS18.map((m) => { const e = evaluate(all[2].filter((x) => x.market === m), endDay); return [m, { disc: e.disc, conf: e.conf }]; })),
    shareTarget: all[2].length ? all[2].filter((x) => x.reason === 'target').length / all[2].length : null,
    shareStop: all[2].length ? all[2].filter((x) => x.reason === 'stop').length / all[2].length : null,
    shareTime: all[2].length ? all[2].filter((x) => x.reason === 'time').length / all[2].length : null,
  };
  const cut = cutTest(K.load('xau', '5m', { from: '2023-06-01', to: '2024-07-01' }), COSTS.xau, Date.UTC(2024, 3, 15) / 1000);
  const T1 = tests.T1.eval;
  const r3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '') + x.toFixed(3));
  const headline = `T1 confirmation 2024-26: ${r3(T1.conf.meanR)}R a trade after costs (n ${T1.conf.n}, month t ${T1.conf.tMonth?.toFixed(2)}); discovery 2020-23 ${r3(T1.disc.meanR)}R (n ${T1.disc.n}, t ${T1.disc.tMonth?.toFixed(2)}).`;
  const r4 = (x) => (x == null || !Number.isFinite(x) ? x : Math.round(x * 1e4) / 1e4);
  const result = JSON.parse(JSON.stringify({
    study: 'mosha-janda-2020', built: new Date().toISOString().slice(0, 10), verdict, headline, primary: 'T1..T3 at 2R, Holm over the three',
    windows: { discovery: '2020-01-01 to 2023-12-31', confirmation: '2024-01-01 to ' + new Date(endDay * 1000).toISOString().slice(0, 10) + ' (exclusive)' },
    markets: MARKETS18, pairs: PAIRS.map((p) => p.join('>')), params: P, costs: Object.fromEntries(MARKETS18.map((m) => [m, COSTS[m]])),
    tests, report, perMarket, cutTest: cut, minutes: +((Date.now() - t0) / 60000).toFixed(1),
  }, (k, v) => (typeof v === 'number' ? r4(v) : v)));
  fs.writeFileSync(new URL('result.json', import.meta.url), JSON.stringify(result, null, 1) + '\n');
  console.error('done', verdict, headline, JSON.stringify(cut));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === 'cut') console.log(JSON.stringify(cutTest(K.load('xau', '5m', { from: '2023-06-01', to: '2024-07-01' }), COSTS.xau, Date.UTC(2024, 3, 15) / 1000)));
  else main();
}
