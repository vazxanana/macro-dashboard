// Volatility-managed exposure on equity index CFDs (pre-registered: PREREGISTRATION.md, committed first).
// Paper research only: no council file is read for a rule, nothing live changes, gold is never read.
//
//   node research/edge/vol-managed-index/run.mjs          reads council-data with git show (no network), writes result.json
//   node research/edge/vol-managed-index/run.mjs --dry    prints the summary without writing
//
// Every position is a portfolio weight from one daily close to the next (no trade, no stop: see PREREGISTRATION.md).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

export const MARKETS = ['spx500', 'nas100', 'us30', 'de40'];
export const PRIMARY = 'spx500';
export const DECISIVE_FROM = '2016-01-01';
export const LOOK = 20;            // sigma20
export const CAP = 2;              // weight cap
export const COST = 0.0004;        // 0.04 % of notional per unit of weight change
export const MARKUP = 0.025;       // financing markup over the US 2-year yield
export const FALLBACK_Y = 4;       // percent, before the cache's first DGS2 value
export const BLOCK = 21, DRAWS = 5000, SEED = 20261114, PLACEBO_SEEDS = 40;
const DAY = 86400;

export const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);

// weekday closes only (Saturday / Sunday candles dropped)
export function weekdays(rows) {
  return rows.filter((r) => { const d = new Date(r[0] * 1000).getUTCDay(); return d !== 0 && d !== 6; }).map((r) => ({ t: r[0], d: iso(r[0]), c: r[4] }));
}

// daily returns and sigma20 (annualised; at index i it uses returns up to and including i)
export function series(bars) {
  const r = new Array(bars.length).fill(null), s = new Array(bars.length).fill(null);
  for (let i = 1; i < bars.length; i++) r[i] = bars[i].c / bars[i - 1].c - 1;
  for (let i = LOOK; i < bars.length; i++) {
    let m = 0; for (let k = i - LOOK + 1; k <= i; k++) m += r[k]; m /= LOOK;
    let v = 0; for (let k = i - LOOK + 1; k <= i; k++) v += (r[k] - m) ** 2;
    s[i] = Math.sqrt(v / (LOOK - 1)) * Math.sqrt(252);
  }
  return { r, s };
}

// the DGS2 value (percent) in force for a return landing on day `d`: latest dated strictly before it, floored at 0
export function rateFn(dgs2) {
  const xs = (dgs2 || []).filter((x) => Number.isFinite(x[1])).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return (d) => {
    let lo = 0, hi = xs.length - 1, k = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (xs[m][0] < d) { k = m; lo = m + 1; } else hi = m - 1; }
    return k < 0 ? { y: FALLBACK_Y, fallback: true } : { y: Math.max(0, xs[k][1]), fallback: false };
  };
}

export const weightOf = (kind, c, sig) => kind === 'A' ? 1 : Math.min(CAP, kind === 'B' ? c / (sig * sig) : c / sig);

// c so that the average capped weight over the sigmas equals 1 (bisection on a monotone function)
export function fitC(kind, sigs) {
  if (kind === 'A') return 1;
  const avg = (c) => sigs.reduce((a, s) => a + weightOf(kind, c, s), 0) / sigs.length;
  let lo = 0, hi = 1;
  while (avg(hi) < 1) hi *= 2;
  for (let k = 0; k < 200; k++) { const m = (lo + hi) / 2; if (avg(m) < 1) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

// return-day indices of a window: i with bars[i].d in [from, to] and a sigma at i-1
export function windowIdx(bars, s, from, to) {
  const out = [];
  for (let i = 1; i < bars.length; i++) if (bars[i].d >= from && bars[i].d <= to && s[i - 1] != null) out.push(i);
  return out;
}

// one market, one strategy, one window → daily net returns keyed by date
// opts: { c, cost, sigOverride (array aligned with idx: the sigma used for the weight set at idx[j]-1) }
export function simulate(bars, ser, idx, kind, rate, opts = {}) {
  const cost = opts.cost ?? COST;
  const sigAt = (j) => (opts.sigOverride ? opts.sigOverride[j] : ser.s[idx[j] - 1]);
  const sigs = idx.map((_, j) => sigAt(j));
  const c = opts.c ?? fitC(kind, sigs);
  const out = []; let prevW = null, spread = 0, fin = 0, turn = 0, capped = 0, wsum = 0, fallbackDays = 0;
  for (let j = 0; j < idx.length; j++) {
    const i = idx[j], w = weightOf(kind, c, sigs[j]);
    const dw = prevW == null ? Math.abs(w) : Math.abs(w - prevW);
    const sc = cost * dw;
    const days = Math.round((bars[i].t - bars[i - 1].t) / DAY);
    const rt = rate(bars[i].d); if (rt.fallback) fallbackDays++;
    const f = opts.gross ? 0 : w * (rt.y / 100 + MARKUP) / 365 * days;
    out.push({ d: bars[i].d, t: bars[i].t, ret: w * ser.r[i] - sc - f, w });
    spread += sc; fin += f; if (prevW != null) turn += dw; if (w >= CAP - 1e-12) capped++; wsum += w; prevW = w;
  }
  return { c, rets: out, spread, fin, turn, capped: capped / idx.length, avgW: wsum / idx.length, fallbackDays };
}

// ---- statistics ----
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
export const sharpe = (a) => mean(a) / sd(a) * Math.sqrt(252);
export const sortino = (a) => mean(a) / Math.sqrt(a.reduce((x, y) => x + (y < 0 ? y * y : 0), 0) / a.length) * Math.sqrt(252);
export function maxDD(a) { let e = 1, pk = 1, dd = 0; for (const x of a) { e *= 1 + x; if (e > pk) pk = e; dd = Math.min(dd, e / pk - 1); } return dd; }
export function stats(rets, firstT, lastT) {
  const a = rets.map((x) => x.ret), eq = a.reduce((e, x) => e * (1 + x), 1);
  const yrs = (lastT - firstT) / DAY / 365.25, ann = eq ** (1 / yrs) - 1, dd = maxDD(a);
  return { n: a.length, sharpe: sharpe(a), sortino: sortino(a), maxDD: dd, annual: ann, calmar: ann / Math.abs(dd), years: yrs };
}

// seeded RNG (mulberry32)
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// paired circular block bootstrap, one-sided p for Sharpe(b) > Sharpe(a), centred on the null
export function bootP(a, b, { block = BLOCK, draws = DRAWS, seed = SEED } = {}) {
  const n = a.length, obs = sharpe(b) - sharpe(a), R = rng(seed); let hit = 0;
  const xa = new Array(n), xb = new Array(n);
  for (let k = 0; k < draws; k++) {
    let m = 0;
    while (m < n) { const st = Math.floor(R() * n); for (let q = 0; q < block && m < n; q++, m++) { const i = (st + q) % n; xa[m] = a[i]; xb[m] = b[i]; } }
    if (sharpe(xb) - sharpe(xa) - obs >= obs) hit++;
  }
  return { obs, p: (hit + 1) / (draws + 1) };
}

// Jobson-Korkie with Memmel's correction, one-sided (b better), per-period Sharpe ratios
export function jkm(a, b) {
  const n = a.length, sa = mean(a) / sd(a), sb = mean(b) / sd(b);
  const ma = mean(a), mb = mean(b); let cov = 0; for (let i = 0; i < n; i++) cov += (a[i] - ma) * (b[i] - mb);
  const rho = cov / (n - 1) / (sd(a) * sd(b));
  const v = (2 - 2 * rho + 0.5 * (sa * sa + sb * sb - 2 * sa * sb * rho * rho)) / n;
  const z = (sb - sa) / Math.sqrt(v);
  return { z, p: 1 - phi(z), rho };
}
export function phi(z) { // standard normal CDF (Abramowitz-Stegun 26.2.17)
  const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989422804014327 * Math.exp(-z * z / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - p : p;
}
export function holm(ps) {
  const o = ps.map((p, i) => ({ p, i })).sort((x, y) => x.p - y.p), adj = new Array(ps.length); let run = 0;
  o.forEach((x, k) => { run = Math.max(run, Math.min(1, (ps.length - k) * x.p)); adj[x.i] = run; });
  return adj;
}

// equal-weight portfolio of per-market return lists (union of dates, 0 for a market with no close that day)
export function pool(lists) {
  const by = new Map();
  for (const L of lists) for (const x of L) { const e = by.get(x.d) || { d: x.d, t: x.t, s: 0 }; e.s += x.ret; by.set(x.d, e); }
  return [...by.values()].sort((a, b) => a.t - b.t).map((e) => ({ d: e.d, t: e.t, ret: e.s / lists.length }));
}

// block-shuffle an array (non-circular blocks of `block`, block order permuted)
export function blockShuffle(arr, seed, block = BLOCK) {
  const R = rng(seed), blocks = [];
  for (let i = 0; i < arr.length; i += block) blocks.push(arr.slice(i, i + block));
  for (let i = blocks.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [blocks[i], blocks[j]] = [blocks[j], blocks[i]]; }
  return blocks.flat();
}

// ---- the study ----
export function study(daily, dgs2, { draws = DRAWS, placeboSeeds = PLACEBO_SEEDS } = {}) {
  const rate = rateFn(dgs2);
  const M = {};
  for (const k of MARKETS) { const bars = weekdays(daily[k].rows); M[k] = { bars, ser: series(bars) }; }
  const last = MARKETS.map((k) => M[k].bars.at(-1).d).sort().at(-1);
  const firstSig = MARKETS.map((k) => M[k].bars[LOOK + 1].d).sort().at(-1);
  const WIN = { replication: [firstSig, '2015-12-31'], decisive: [DECISIVE_FROM, last] };
  const res = { windows: WIN, markets: {}, pooled: {} }, keep = {};
  const span = (rets) => [rets[0].t - Math.round((rets[1].t - rets[0].t)), rets.at(-1).t];
  const one = (sim) => { const [a, b] = span(sim.rets); return { ...stats(sim.rets, a, b), c: sim.c, avgW: sim.avgW, capShare: sim.capped,
    turnoverYr: sim.turn / ((b - a) / DAY / 365.25), spreadYr: sim.spread / ((b - a) / DAY / 365.25), finYr: sim.fin / ((b - a) / DAY / 365.25), fallbackDays: sim.fallbackDays }; };
  for (const k of MARKETS) {
    const { bars, ser } = M[k]; res.markets[k] = {}; keep[k] = {};
    for (const [w, [from, to]] of Object.entries(WIN)) {
      const idx = windowIdx(bars, ser.s, from, to); res.markets[k][w] = {}; keep[k][w] = { idx };
      for (const kind of ['A', 'B', 'C']) {
        for (const cost of [COST, 2 * COST]) {
          const sim = simulate(bars, ser, idx, kind, rate, { cost });
          const key = cost === COST ? kind : kind + '@2x';
          res.markets[k][w][key] = one(sim); keep[k][w][key] = sim;
        }
      }
    }
    // post hoc (labelled in RESULT.md): before any cost or financing
    res.markets[k].grossDecisive = {}; res.markets[k].grossReplication = {};
    for (const kind of ['A', 'B', 'C']) {
      res.markets[k].grossDecisive[kind] = one(simulate(bars, ser, keep[k].decisive.idx, kind, rate, { cost: 0, gross: true }));
      res.markets[k].grossReplication[kind] = one(simulate(bars, ser, keep[k].replication.idx, kind, rate, { cost: 0, gross: true }));
    }
    // out-of-sample variant: c from the replication window, applied to the decisive window
    for (const kind of ['B', 'C']) {
      const sim = simulate(bars, ser, keep[k].decisive.idx, kind, rate, { c: keep[k].replication[kind].c });
      res.markets[k].decisive[kind + '-oos'] = one(sim); keep[k].decisive[kind + '-oos'] = sim;
    }
  }
  // pooled
  for (const w of Object.keys(WIN)) {
    res.pooled[w] = {}; keep.pooled = keep.pooled || {}; keep.pooled[w] = {};
    for (const key of ['A', 'B', 'C', 'A@2x', 'B@2x', 'C@2x']) {
      const p = pool(MARKETS.map((k) => keep[k][w][key].rets)); keep.pooled[w][key] = p;
      const [a, b] = span(p); res.pooled[w][key] = stats(p, a, b);
    }
  }
  const r = (L) => L.map((x) => x.ret);
  const sp = keep[PRIMARY];
  const tests = [
    { id: 'T1', what: 'spx500 B - A', a: sp.decisive.A.rets, b: sp.decisive.B.rets, ra: sp.replication.A.rets, rb: sp.replication.B.rets,
      a2: sp.decisive['A@2x'].rets, b2: sp.decisive['B@2x'].rets, ddA: res.markets[PRIMARY].decisive.A.maxDD, ddM: res.markets[PRIMARY].decisive.B.maxDD },
    { id: 'T2', what: 'spx500 C - A', a: sp.decisive.A.rets, b: sp.decisive.C.rets, ra: sp.replication.A.rets, rb: sp.replication.C.rets,
      a2: sp.decisive['A@2x'].rets, b2: sp.decisive['C@2x'].rets, ddA: res.markets[PRIMARY].decisive.A.maxDD, ddM: res.markets[PRIMARY].decisive.C.maxDD },
    { id: 'T3', what: 'pooled B - A', a: keep.pooled.decisive.A, b: keep.pooled.decisive.B, ra: keep.pooled.replication.A, rb: keep.pooled.replication.B,
      a2: keep.pooled.decisive['A@2x'], b2: keep.pooled.decisive['B@2x'], ddA: res.pooled.decisive.A.maxDD, ddM: res.pooled.decisive.B.maxDD },
  ];
  const T = tests.map((x, i) => {
    const bs = bootP(r(x.a), r(x.b), { draws, seed: SEED + i });
    const j = jkm(r(x.a), r(x.b));
    return { id: x.id, what: x.what, gainDecisive: bs.obs, gainReplication: sharpe(r(x.rb)) - sharpe(r(x.ra)),
      gainDecisive2x: sharpe(r(x.b2)) - sharpe(r(x.a2)), pBoot: bs.p, pJKM: j.p, zJKM: j.z, rho: j.rho,
      maxDDA: x.ddA, maxDDManaged: x.ddM };
  });
  const adj = holm(T.map((x) => x.pBoot));
  T.forEach((x, i) => {
    x.pHolm = adj[i];
    x.checks = { bothWindows: x.gainDecisive > 0 && x.gainReplication > 0, holm: x.pHolm < 0.05, drawdown: x.maxDDManaged >= x.maxDDA };
    x.pass = x.checks.bothWindows && x.checks.holm && x.checks.drawdown;
    x.robust2x = x.gainDecisive2x > 0;
  });
  // placebo: spx500 decisive sigma shuffled in 21-day blocks
  const { bars, ser } = M[PRIMARY], idx = keep[PRIMARY].decisive.idx, sig = idx.map((i) => ser.s[i - 1]);
  const aS = sharpe(r(sp.decisive.A.rets)), plac = { B: [], C: [] };
  for (let s = 1; s <= placeboSeeds; s++) {
    const sh = blockShuffle(sig, SEED + 1000 + s);
    for (const kind of ['B', 'C']) plac[kind].push(sharpe(r(simulate(bars, ser, idx, kind, rate, { sigOverride: sh }).rets)) - aS);
  }
  const placebo = {};
  for (const kind of ['B', 'C']) {
    const real = T[kind === 'B' ? 0 : 1].gainDecisive, g = plac[kind];
    placebo[kind] = { seeds: g.length, mean: mean(g), max: Math.max(...g), min: Math.min(...g), atLeastReal: g.filter((x) => x >= real).length, real };
  }
  const t1 = T[0];
  const verdict = t1.pass ? (t1.robust2x ? 'PASS' : 'PASS, not robust to costs') : 'FAIL';
  return { study: 'vol-managed-index', windows: WIN, params: { LOOK, CAP, COST, MARKUP, FALLBACK_Y, BLOCK, DRAWS: draws, SEED, PLACEBO_SEEDS: placeboSeeds },
    verdict, tests: T, placebo, markets: res.markets, pooled: res.pooled, rateLast: dgs2?.at?.(-1) || null };
}

export function load() {
  const sh = (p) => JSON.parse(execFileSync('git', ['show', `origin/council-data:${p}`], { maxBuffer: 1 << 28 }));
  const daily = {}; for (const k of MARKETS) daily[k] = sh(`research/daily/${k}.json`);
  const cache = sh('macro/cache.json');
  return { daily, dgs2: cache?.score?.fred?.DGS2 || [] };
}

const here = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { daily, dgs2 } = load();
  const out = study(daily, dgs2);
  out.built = new Date().toISOString().slice(0, 10);
  out.data = Object.fromEntries(MARKETS.map((k) => [k, { inst: daily[k].inst, rows: daily[k].rows.length, first: iso(daily[k].rows[0][0]), last: iso(daily[k].rows.at(-1)[0]) }]));
  const f = (x, d = 2) => (x >= 0 ? '+' : '') + x.toFixed(d);
  console.log('verdict', out.verdict);
  for (const t of out.tests) console.log(t.id, t.what, 'dec', f(t.gainDecisive, 3), 'rep', f(t.gainReplication, 3), '2x', f(t.gainDecisive2x, 3), 'pBoot', t.pBoot.toFixed(4), 'pHolm', t.pHolm.toFixed(4), 'pJKM', t.pJKM.toFixed(4), 'DD', (t.maxDDManaged * 100).toFixed(1), 'vs', (t.maxDDA * 100).toFixed(1), t.pass ? 'PASS' : 'fail');
  for (const k of [...MARKETS, 'pooled']) for (const w of ['decisive', 'replication']) {
    const o = k === 'pooled' ? out.pooled[w] : out.markets[k][w];
    console.log(k.padEnd(7), w.padEnd(11), ['A', 'B', 'C', 'B-oos', 'C-oos'].filter((s) => o[s]).map((s) => `${s} SR ${o[s].sharpe.toFixed(2)} DD ${(o[s].maxDD * 100).toFixed(1)} ann ${(o[s].annual * 100).toFixed(1)}${o[s].avgW != null ? ' w ' + o[s].avgW.toFixed(2) : ''}`).join(' | '));
  }
  for (const k of MARKETS) console.log('gross', k, ['grossDecisive', 'grossReplication'].map((g) => g + ' ' + ['A', 'B', 'C'].map((s) => s + ' ' + out.markets[k][g][s].sharpe.toFixed(2)).join(' ')).join(' | '));
  console.log('placebo', JSON.stringify(out.placebo));
  if (!process.argv.includes('--dry')) fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(out, null, 1) + '\n');
}
