// Gold absorption days: heavy activity, small range (PREREGISTRATION.md, pushed first). A stand-alone rule on spot gold; no
// rule or position of the live gold book is read or touched. Paper only.
//   node research/edge/gold-absorption/run.mjs   reads council-data research/daily/xau.json (git show, no network, no cache)
//                                                -> result.json, prints the tables
// Pure pieces are exported for the test.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN, stopFill } from '../../../council/fills.mjs';

export const COST = 0.60, ATR_N = 20, ATR_K = 2, HOLD = 5, VOL_N = 50, PCT_N = 250, PCT = 0.9, LOOK = 10;
export const SEED = 20261114, SEEDS = 40, BEAT = 38, MIN_OOS = 60;
export const IS = ['2007-01', '2016-12'], OOS = ['2017-01', '2026-12'];
const H = 3600;
export const dateOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const closeTime = (t) => t + (new Date(t * 1000).getUTCDay() === 5 ? 21 : 23) * H;

export function prepare(rows) {
  return foldWeekend(rows.map(([time, open, high, low, close, v]) => ({ time, open, high, low, close, v })));
}
const trueRange = (bars, k) => { const x = bars[k], pc = bars[k - 1].close; return Math.max(x.high - x.low, Math.abs(x.high - pc), Math.abs(x.low - pc)); };

// per day: the signal inputs, all from candles closed at day i's close (nothing after i is read)
export function features(bars) {
  const F = Array(bars.length).fill(null);
  for (let i = Math.max(VOL_N, ATR_N + 1, LOOK); i < bars.length; i++) {
    let vs = 0; for (let k = i - VOL_N; k < i; k++) vs += bars[k].v;
    let tr = 0; for (let k = i - ATR_N; k < i; k++) tr += trueRange(bars, k);
    const va = bars[i].v / (vs / VOL_N), atr = tr / ATR_N, rr = (bars[i].high - bars[i].low) / atr;
    if (!(va > 0) || !(rr > 0) || !Number.isFinite(va)) continue;
    F[i] = { va, rr, E: va / rr, move: Math.sign(bars[i].close - bars[i - LOOK].close) };
  }
  // absorption: E over the 90th percentile of the previous 250 days' E (those days only), and va >= 1
  for (let i = 0; i < bars.length; i++) {
    if (!F[i]) continue;
    const past = []; for (let k = Math.max(0, i - PCT_N); k < i; k++) if (F[k]) past.push(F[k].E);
    if (past.length < PCT_N * 0.9) { F[i].eligible = false; continue; }
    past.sort((a, b) => a - b);
    const q = past[Math.floor(PCT * (past.length - 1))];
    F[i].eligible = true; F[i].q = q; F[i].abs = F[i].E > q && F[i].va >= 1;
  }
  return F;
}

// one trade: enter at the close of day i, out at the close of day i+HOLD or at the stop (2 x ATR(20) of days i-19 … i)
export function trade(bars, i, side, { cost = COST, finMult = 1 } = {}) {
  const j = i + HOLD;
  if (j >= bars.length || i < ATR_N) return null;
  let tr = 0; for (let k = i - ATR_N + 1; k <= i; k++) tr += trueRange(bars, k);
  const entry = bars[i].close, risk = ATR_K * tr / ATR_N, stop = entry - side * risk;
  if (!(risk > 0)) return null;
  let exit = bars[j].close, how = 'time', tOut = closeTime(bars[j].time);
  for (let k = i + 1; k <= j; k++) { const x = bars[k];
    if (side > 0 ? x.low <= stop : x.high >= stop) { exit = stopFill(x, side < 0, stop, true); how = 'stop'; tOut = closeTime(x.time); break; } }
  const R = side * (exit - entry) / risk, nn = side > 0 ? nights(closeTime(bars[i].time), tOut) : 0;
  const fin = finMult * nn * FIN.xau.long * entry / risk;
  return { i, a: dateOf(bars[i].time), side, entry, stop, risk, exit, how, R, fin, net: R - cost / risk - fin };
}

// statistics
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sdOf = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
function betacf(a, b, x) {
  let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d; let h = d;
  for (let m = 1; m <= 300; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d;
    const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-14) break; }
  return h;
}
function lgamma(z) { const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = z, y = z, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (const c of g) s += c / ++y; return -t + Math.log(2.5066282746310005 * s / x); }
function ibeta(x, a, b) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
}
export const pUpper = (t, df) => { const p2 = ibeta(df / (df + t * t), df / 2, 0.5) / 2; return t >= 0 ? p2 : 1 - p2; };
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((x, y) => x[0] - y[0]), out = Array(ps.length); let run = 0;
  o.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (ps.length - r) * p)); out[i] = run; });
  return out;
}
export function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function monthT(T, key) {
  const by = new Map(); for (const x of T) { const k = x.a.slice(0, 7); by.set(k, (by.get(k) || 0) + x[key]); }
  const v = [...by.values()], n = v.length; if (n < 3) return { months: n, t: null, p: null };
  const sd = sdOf(v), t = sd ? mean(v) / (sd / Math.sqrt(n)) : 0;
  return { months: n, t, p: pUpper(t, n - 1) };
}
const inW = (d, w) => d.slice(0, 7) >= w[0] && d.slice(0, 7) <= w[1];
const r3 = (x) => x == null ? null : +x.toFixed(3), r2 = (x) => x == null ? null : +x.toFixed(2), r4 = (x) => x == null ? null : +x.toFixed(4);

// excess = net R minus the same-year mean net R of the baseline (non-event) trades of the same side and prior move
export function withExcess(ev, base, key = 'net') {
  const by = new Map(); for (const b of base) { const y = b.a.slice(0, 4); const s = by.get(y) || [0, 0]; s[0] += b[key]; s[1]++; by.set(y, s); }
  return ev.map((e) => { const s = by.get(e.a.slice(0, 4)); return { ...e, ex: s ? e[key] - s[0] / s[1] : null }; }).filter((e) => e.ex != null);
}
function summary(T, stat) {
  if (!T.length) return { n: 0 };
  const mt = monthT(T, stat), mg = monthT(T, 'R');
  return { n: T.length, gross: r3(mean(T.map((x) => x.R))), net: r3(mean(T.map((x) => x.net))), excess: T[0].ex == null ? null : r3(mean(T.map((x) => x.ex))),
    stat: r3(mean(T.map((x) => x[stat]))), t: r2(mt.t), p: r4(mt.p), months: mt.months, tGross: r2(mg.t),
    win: r2(100 * T.filter((x) => x.net > 0).length / T.length), stops: T.filter((x) => x.how === 'stop').length, total: r2(T.reduce((s, x) => s + x.net, 0)) };
}

export const TESTS = { T1: { move: -1, side: 1, stat: 'ex' }, T2: { move: 1, side: -1, stat: 'ex' }, T3: { move: -1, side: 1, stat: 'net' } };

export function study(rows) {
  const bars = prepare(rows), F = features(bars);
  const out = { data: { first: dateOf(bars[0].time), last: dateOf(bars.at(-1).time), candles: bars.length, fold: 'UTC days, weekends folded into Monday (fills.mjs foldWeekend)' },
    rules: { cost: COST, cost2x: 2 * COST, atr: `${ATR_K} x ATR(${ATR_N})`, hold: HOLD, fin: FIN.xau.long, volN: VOL_N, pctN: PCT_N, pct: PCT, look: LOOK, IS, OOS }, counts: {}, tests: {} };
  const elig = F.map((f, i) => f && f.eligible && bars[i + HOLD] ? i : -1).filter((i) => i >= 0);
  for (const [w, W] of [['is', IS], ['oos', OOS]]) {
    const d = elig.filter((i) => inW(dateOf(bars[i].time), W));
    out.counts[w] = { eligible: d.length, absorption: d.filter((i) => F[i].abs).length, afterDecline: d.filter((i) => F[i].abs && F[i].move < 0).length, afterAdvance: d.filter((i) => F[i].abs && F[i].move > 0).length };
  }
  const ps = [];
  for (const [k, def] of Object.entries(TESTS)) {
    const pool = elig.filter((i) => F[i].move === def.move);
    const build = (opt) => {
      const ev = pool.filter((i) => F[i].abs).map((i) => trade(bars, i, def.side, opt)).filter(Boolean);
      const base = pool.filter((i) => !F[i].abs).map((i) => trade(bars, i, def.side, opt)).filter(Boolean);
      return { ev: withExcess(ev, base), base };
    };
    const A = build(), B = build({ cost: 2 * COST, finMult: 2 }), r = { side: def.side > 0 ? 'long' : 'short', after: def.move < 0 ? 'decline' : 'advance', stat: def.stat === 'ex' ? 'excess over the same-side baseline' : 'net R' };
    for (const [w, W] of [['is', IS], ['oos', OOS]]) {
      const f = (x) => inW(x.a, W), T = A.ev.filter(f);
      r[w] = { ...summary(T, def.stat), stat2x: r3(mean(B.ev.filter(f).map((x) => x[def.stat]))), baseline: { n: A.base.filter(f).length, net: r3(mean(A.base.filter(f).map((x) => x.net))), gross: r3(mean(A.base.filter(f).map((x) => x.R))) } };
      const years = {}; for (const x of T) { const y = x.a.slice(0, 4); (years[y] ||= []).push(x); }
      r[w].byYear = Object.fromEntries(Object.entries(years).map(([y, a]) => [y, { n: a.length, net: r3(mean(a.map((x) => x.net))), stat: r3(mean(a.map((x) => x[def.stat]))) }]));
    }
    // placebo: each OOS event replaced by a random eligible non-event day of the same prior move in the same calendar year
    const oosEv = A.ev.filter((x) => inW(x.a, OOS)), nonByYear = new Map();
    for (const i of pool) if (!F[i].abs) { const y = dateOf(bars[i].time).slice(0, 4); (nonByYear.get(y) || nonByYear.set(y, []).get(y)).push(i); }
    const pl = [];
    for (let s = 0; s < SEEDS; s++) {
      const rng = mulberry32(SEED + s), got = [];
      for (const e of oosEv) { const c = nonByYear.get(e.a.slice(0, 4)); if (!c) continue;
        const t = trade(bars, c[Math.floor(rng() * c.length)], def.side); if (t) got.push(t); }
      const g = withExcess(got, A.base);
      pl.push(mean(g.map((x) => x[def.stat])));
    }
    const want = r.oos.stat;
    r.placebo = { seeds: SEEDS, beaten: pl.filter((v) => want > v).length, mean: r3(mean(pl)), max: r3(Math.max(...pl)), min: r3(Math.min(...pl)) };
    out.tests[k] = r; ps.push(r.oos.p ?? 1);
  }
  const adj = holm(ps);
  Object.keys(TESTS).forEach((k, i) => { const r = out.tests[k]; r.holm = r4(adj[i]);
    r.checks = { enough: r.oos.n >= MIN_OOS, oosPos: r.oos.stat > 0, oosT2: r.oos.t >= 2, holm: adj[i] < 0.05, isSameSign: r.is.stat > 0, cost2x: r.oos.stat2x > 0, placebo: r.placebo.beaten >= BEAT };
    r.pass = Object.values(r.checks).every(Boolean); });
  out.verdict = out.tests.T1.pass ? 'PASS' : 'FAIL';
  out.passed = Object.keys(TESTS).filter((k) => out.tests[k].pass);
  return out;
}

const here = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const raw = execFileSync('git', ['show', 'origin/council-data:research/daily/xau.json'], { maxBuffer: 64e6 }).toString();
  const res = { study: 'gold-absorption', built: '2026-11-14', ...study(JSON.parse(raw).rows) };
  fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  console.log(JSON.stringify({ verdict: res.verdict, data: res.data, counts: res.counts }));
  for (const [k, r] of Object.entries(res.tests)) { const { byYear: a, ...is } = r.is, { byYear: b, ...oos } = r.oos; console.log(k, r.side, JSON.stringify({ is, oos, placebo: r.placebo, holm: r.holm, checks: r.checks })); }
}
