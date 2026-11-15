// Spot gold when US equity volatility turns, on the S&P 500's own candles (PREREGISTRATION.md, pushed first). A stand-alone
// study: no book rule is read or touched. Paper only.
//   node research/edge/gold-spx-vol-regime/run.mjs   reads council-data research/daily/xau.json and spx500.json (git show, no
//                                                    network, no cache written) -> result.json, prints the tables
// Pure pieces are exported for the test.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN, stopFill } from '../../../council/fills.mjs';

export const COST = 0.60, ATR_N = 20, ATR_K = 2, K = 1.5, SHORT = 5, LONG = 60, MED = 252, COOL = 5;
export const SEED = 20261114, CSEED = 20261214, SEEDS = 40, BEAT = 38;
export const IS = ['2007-01', '2016-12'], OOS = ['2017-01', '2026-10'];
export const TESTS = { T1: { ev: 'E1', side: 1, hold: 5 }, T2: { ev: 'E2', side: 1, hold: 10 }, T3: { ev: 'E3', side: -1, hold: 10 } };
const H = 3600;
export const dateOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const closeTime = (t) => t + (new Date(t * 1000).getUTCDay() === 5 ? 21 : 23) * H;
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sdOf = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
const median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export function bars(rows) { return foldWeekend(rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }))); }

// RVn per bar: sd of the last n log returns up to and including bar i (null before n returns exist)
export function rv(B, n) {
  const r = B.map((x, i) => (i ? Math.log(x.close / B[i - 1].close) : null));
  return B.map((_, i) => (i >= n ? sdOf(r.slice(i - n + 1, i + 1)) : null));
}

// E1: q = (SPX RV5/RV60) / (XAU RV5/RV60) crosses up through K; d-1 = the previous day with both candles. Cooldown in signal days.
export function eventsE1(S, G, { k = K, cool = COOL } = {}) {
  const gi = new Map(G.map((b, i) => [dateOf(b.time), i])), s5 = rv(S, SHORT), s60 = rv(S, LONG), g5 = rv(G, SHORT), g60 = rv(G, LONG);
  const out = []; let prev = null, last = -1e9;
  for (let i = LONG; i < S.length; i++) {
    const j = gi.get(dateOf(S[i].time)); if (j == null || g5[j] == null || g60[j] == null) continue;
    const q = (s5[i] / s60[i]) / (g5[j] / g60[j]);
    if (!Number.isFinite(q)) continue;
    if (q >= k && prev != null && prev < k && i - last > cool) { out.push({ d: dateOf(S[i].time), q }); last = i; }
    prev = q;
  }
  return out;
}

// E2 / E3: SPX RV5 crosses above / below the median of RV5 over the MED signal days ending at that day. Cooldown per kind.
export function eventsMed(S, dir, { cool = COOL } = {}) {
  const v = rv(S, SHORT), M = v.map((_, i) => (i >= SHORT + MED - 1 ? median(v.slice(i - MED + 1, i + 1)) : null));
  const out = []; let last = -1e9;
  for (let i = 1; i < S.length; i++) {
    if (M[i] == null || M[i - 1] == null) continue;
    const hit = dir > 0 ? v[i] > M[i] && v[i - 1] <= M[i - 1] : v[i] < M[i] && v[i - 1] >= M[i - 1];
    if (hit && i - last > cool) { out.push({ d: dateOf(S[i].time), rv: v[i], med: M[i] }); last = i; }
  }
  return out;
}

// one trade on gold: enter at the close of bar i, out at the close of bar i + hold or at the stop (2 x ATR(20) up to bar i)
export function trade(G, i, hold, side, { cost = COST, finMult = 1 } = {}) {
  const j = i + hold;
  if (i < ATR_N || j >= G.length) return null;
  let tr = 0;
  for (let k = i - ATR_N + 1; k <= i; k++) { const x = G[k], pc = G[k - 1].close; tr += Math.max(x.high - x.low, Math.abs(x.high - pc), Math.abs(x.low - pc)); }
  const entry = G[i].close, risk = ATR_K * tr / ATR_N, stop = entry - side * risk;
  if (!(risk > 0)) return null;
  let exit = G[j].close, how = 'time', tOut = closeTime(G[j].time);
  for (let k = i + 1; k <= j; k++) { const x = G[k];
    if (side > 0 ? x.low <= stop : x.high >= stop) { exit = stopFill(x, side < 0, stop, true); how = 'stop'; tOut = closeTime(x.time); break; } }
  const R = side * (exit - entry) / risk, nn = side > 0 ? nights(closeTime(G[i].time), tOut) : 0;
  const fin = finMult * nn * FIN.xau.long * entry / risk;
  return { a: dateOf(G[i].time), entry, risk, exit, how, R, fin, net: R - cost / risk - fin };
}

// baseline: mean net R of the same trade on every gold bar of each calendar year
export function baseline(G, hold, side, opt) {
  const by = new Map();
  for (let i = 0; i < G.length; i++) { const t = trade(G, i, hold, side, opt); if (!t) continue;
    const y = t.a.slice(0, 4), v = by.get(y) || [0, 0]; v[0] += t.net; v[1]++; by.set(y, v); }
  return new Map([...by].map(([y, [s, n]]) => [y, s / n]));
}

// control path: within each calendar year the candles (relative to the previous close) are shuffled, dates stay in place
export function shuffled(G, rng) {
  const rel = G.map((x, i) => (i ? { o: x.open / G[i - 1].close, h: x.high / G[i - 1].close, l: x.low / G[i - 1].close, c: x.close / G[i - 1].close } : null));
  const byY = new Map();
  for (let i = 1; i < G.length; i++) { const y = dateOf(G[i].time).slice(0, 4); (byY.get(y) || byY.set(y, []).get(y)).push(i); }
  const perm = new Array(G.length);
  for (const idx of byY.values()) { const p = [...idx];
    for (let k = p.length - 1; k > 0; k--) { const m = Math.floor(rng() * (k + 1)); [p[k], p[m]] = [p[m], p[k]]; }
    idx.forEach((i, k) => { perm[i] = p[k]; }); }
  const out = [{ ...G[0] }];
  for (let i = 1; i < G.length; i++) { const r = rel[perm[i]], pc = out[i - 1].close;
    out.push({ time: G[i].time, open: pc * r.o, high: pc * r.h, low: pc * r.l, close: pc * r.c }); }
  return out;
}

// statistics
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
export function monthT(T, key = 'ex') {
  const by = new Map(); for (const x of T) { const k = x.a.slice(0, 7); by.set(k, (by.get(k) || 0) + x[key]); }
  const v = [...by.values()], n = v.length; if (n < 3) return { months: n, t: null, p: null };
  const sd = sdOf(v), t = sd ? mean(v) / (sd / Math.sqrt(n)) : 0;
  return { months: n, t, p: pUpper(t, n - 1) };
}
const inW = (d, w) => d.slice(0, 7) >= w[0] && d.slice(0, 7) <= w[1];
const r3 = (x) => x == null ? null : +x.toFixed(3), r2 = (x) => x == null ? null : +x.toFixed(2), r4 = (x) => x == null ? null : +x.toFixed(4);
export function summary(T) {
  const me = monthT(T), mn = monthT(T, 'net'), mg = monthT(T, 'R');
  return { n: T.length, ex: r3(mean(T.map((x) => x.ex))), tEx: r2(me.t), p: r4(me.p), months: me.months,
    net: r3(mean(T.map((x) => x.net))), tNet: r2(mn.t), gross: r3(mean(T.map((x) => x.R))), tGross: r2(mg.t), base: r3(mean(T.map((x) => x.base))),
    win: r2(100 * T.filter((x) => x.net > 0).length / T.length), stops: T.filter((x) => x.how === 'stop').length };
}


export function allEvents(S, G) {
  return { E1: eventsE1(S, G), E2: eventsMed(S, 1), E3: eventsMed(S, -1) };
}

export function study(gRows, sRows, { seeds = SEEDS } = {}) {
  const G = bars(gRows), S = bars(sRows), gi = new Map(G.map((b, i) => [dateOf(b.time), i]));
  const EV = allEvents(S, G);
  for (const k of Object.keys(EV)) EV[k] = EV[k].filter((e) => inW(e.d, [IS[0], OOS[1]]));
  const out = { data: { gold: [dateOf(G[0].time), dateOf(G.at(-1).time), G.length], spx: [dateOf(S[0].time), dateOf(S.at(-1).time), S.length],
    fold: 'UTC days, weekends folded into Monday (fills.mjs foldWeekend)' },
  rules: { E1: `(SPX RV${SHORT}/RV${LONG}) / (XAU RV${SHORT}/RV${LONG}) crosses up through ${K}`, E2: `SPX RV${SHORT} crosses above its ${MED}-day median`,
    E3: `SPX RV${SHORT} crosses below its ${MED}-day median`, cooldown: COOL, cost: COST, cost2x: 2 * COST, atr: `${ATR_K} x ATR(${ATR_N})`, fin: FIN.xau.long, IS, OOS },
  events: Object.fromEntries(Object.entries(EV).map(([k, ev]) => [k, { is: ev.filter((e) => inW(e.d, IS)).length, oos: ev.filter((e) => inW(e.d, OOS)).length,
    noGoldBar: ev.filter((e) => !gi.has(e.d)).map((e) => e.d) }])), tests: {} };
  const ps = [];
  // control paths, shared by the three tests (same seeds)
  const CP = Array.from({ length: seeds }, (_, s) => shuffled(G, mulberry32(CSEED + s)));
  for (const [k, { ev: ek, side, hold }] of Object.entries(TESTS)) {
    const ev = EV[ek];
    const base = baseline(G, hold, side), base2 = baseline(G, hold, side, { cost: 2 * COST, finMult: 2 });
    const run = (P, opt, bm) => ev.map((e) => { const i = gi.get(e.d); const t = i == null ? null : trade(P, i, hold, side, opt);
      return t && { ...t, base: bm.get(t.a.slice(0, 4)), ex: t.net - bm.get(t.a.slice(0, 4)) }; }).filter(Boolean);
    const T = run(G, undefined, base), T2 = run(G, { cost: 2 * COST, finMult: 2 }, base2), r = { event: ek, side: side > 0 ? 'long' : 'short', hold };
    for (const [w, W] of [['is', IS], ['oos', OOS]]) {
      const f = (x) => inW(x.a, W), Sx = T.filter(f), S2 = T2.filter(f);
      r[w] = { ...summary(Sx), net2x: r3(mean(S2.map((x) => x.net))), ex2x: r3(mean(S2.map((x) => x.ex))) };
    }
    // placebo: each out-of-sample event replaced by a random gold day of the same calendar month (not the event day)
    const oosEv = T.filter((x) => inW(x.a, OOS)), pl = [];
    for (let s = 0; s < seeds; s++) {
      const rng = mulberry32(SEED + s), got = [];
      for (const e of oosEv) {
        const cand = G.map((b, i) => i).filter((i) => dateOf(G[i].time).slice(0, 7) === e.a.slice(0, 7) && dateOf(G[i].time) !== e.a);
        for (let tries = 0; tries < 30 && cand.length; tries++) { const t = trade(G, cand[Math.floor(rng() * cand.length)], hold, side);
          if (t) { got.push(t.net - base.get(t.a.slice(0, 4))); break; } }
      }
      pl.push(mean(got));
    }
    r.placebo = { seeds, beaten: pl.filter((v) => r.oos.ex > v).length, mean: r3(mean(pl)), max: r3(Math.max(...pl)), min: r3(Math.min(...pl)) };
    // control: the real event dates traded on a within-year day-shuffled gold path (drift and volatility kept)
    const cl = CP.map((P) => { const b = baseline(P, hold, side), C = run(P, undefined, b).filter((x) => inW(x.a, OOS)); return mean(C.map((x) => x.ex)); });
    r.control = { seeds, beaten: cl.filter((v) => r.oos.ex > v).length, mean: r3(mean(cl)), max: r3(Math.max(...cl)), min: r3(Math.min(...cl)) };
    out.tests[k] = r; ps.push(r.oos.p);
  }
  const adj = holm(ps);
  Object.keys(TESTS).forEach((k, i) => { const r = out.tests[k]; r.holm = r4(adj[i]);
    r.checks = { oosExPos: r.oos.ex > 0, oosT2: r.oos.tEx >= 2, holm: adj[i] < 0.05, isSameSign: r.is.ex > 0, cost2x: r.oos.net2x > 0 && r.oos.ex2x > 0,
      placebo: r.placebo.beaten >= BEAT, control: r.control.beaten >= BEAT };
    r.pass = Object.values(r.checks).every(Boolean); });
  out.verdict = out.tests.T1.pass ? 'PASS' : 'FAIL';
  out.passed = Object.keys(TESTS).filter((k) => out.tests[k].pass);
  return out;
}

const here = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const get = (k) => JSON.parse(execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 64e6 }).toString()).rows;
  const res = { study: 'gold-spx-vol-regime', built: '2026-11-14', ...study(get('xau'), get('spx500')) };
  fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  console.log(JSON.stringify({ verdict: res.verdict, data: res.data, events: res.events }));
  for (const [k, r] of Object.entries(res.tests)) console.log(k, JSON.stringify({ is: r.is, oos: r.oos, placebo: r.placebo, control: r.control, holm: r.holm, checks: r.checks }));
}
