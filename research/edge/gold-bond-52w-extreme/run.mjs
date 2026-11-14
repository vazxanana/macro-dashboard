// Spot gold while the US 30-year bond sits at an extreme of its 52-week range (PREREGISTRATION.md, pushed first). A
// stand-alone study: no book rule is read or touched. Paper only.
//   node research/edge/gold-bond-52w-extreme/run.mjs  reads council-data research/daily/xau.json and usb30y.json (git show, no
//                                                    network, no cache written) -> result.json, prints the tables
// Pure pieces are exported for the test.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN, stopFill } from '../../../council/fills.mjs';

export const COST = 0.60, ATR_N = 20, ATR_K = 2, Q = 0.10, LOOK = 252;
export const SEED = 20261114, SEEDS = 40, BEAT = 38;
export const IS = ['2007-01', '2016-12'], OOS = ['2017-01', '2026-10'];
export const TESTS = { T1: { side: 1, hold: 1, zone: 'lo' }, T2: { side: 1, hold: 1, zone: 'hi' } };
const H = 3600;
export const dateOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const closeTime = (t) => t + (new Date(t * 1000).getUTCDay() === 5 ? 21 : 23) * H;
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sdOf = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };

export function bars(rows) { return foldWeekend(rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }))); }

// zone days: pos = (close - min) / (max - min) over the LOOK + 1 closes up to and including bar i. Closes up to i only.
export function zoneDays(B, { q = Q, look = LOOK } = {}) {
  const out = [];
  for (let i = look; i < B.length; i++) {
    let mn = Infinity, mx = -Infinity;
    for (let k = i - look; k <= i; k++) { const c = B[k].close; if (c < mn) mn = c; if (c > mx) mx = c; }
    if (!(mx > mn)) continue;
    const pos = (B[i].close - mn) / (mx - mn);
    if (pos <= q) out.push({ d: dateOf(B[i].time), zone: 'lo', pos });
    else if (pos >= 1 - q) out.push({ d: dateOf(B[i].time), zone: 'hi', pos });
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

export function study(gRows, bRows) {
  const G = bars(gRows), B = bars(bRows), gi = new Map(G.map((b, i) => [dateOf(b.time), i]));
  const all = zoneDays(B).filter((e) => inW(e.d, [IS[0], OOS[1]]));
  const yearIdx = new Map(); G.forEach((b, i) => { const y = dateOf(b.time).slice(0, 4); (yearIdx.get(y) || yearIdx.set(y, []).get(y)).push(i); });
  const cnt = (z, W) => all.filter((e) => e.zone === z && inW(e.d, W)).length;
  const out = { data: { gold: [dateOf(G[0].time), dateOf(G.at(-1).time), G.length], bond: [dateOf(B[0].time), dateOf(B.at(-1).time), B.length],
    fold: 'UTC days, weekends folded into Monday (fills.mjs foldWeekend)' },
  rules: { q: Q, look: LOOK + 1, cost: COST, cost2x: 2 * COST, atr: `${ATR_K} x ATR(${ATR_N})`, fin: FIN.xau.long, IS, OOS },
  events: { lo: { is: cnt('lo', IS), oos: cnt('lo', OOS) }, hi: { is: cnt('hi', IS), oos: cnt('hi', OOS) },
    noGoldBar: all.filter((e) => !gi.has(e.d)).length }, tests: {} };
  const ps = [];
  for (const [k, { side, hold, zone }] of Object.entries(TESTS)) {
    const ev = all.filter((e) => e.zone === zone);
    const base = baseline(G, hold, side), base2 = baseline(G, hold, side, { cost: 2 * COST, finMult: 2 });
    const run = (opt, bm) => ev.map((e) => { const i = gi.get(e.d); const t = i == null ? null : trade(G, i, hold, side, opt);
      return t && { ...t, base: bm.get(t.a.slice(0, 4)), ex: t.net - bm.get(t.a.slice(0, 4)) }; }).filter(Boolean);
    const T = run(undefined, base), T2 = run({ cost: 2 * COST, finMult: 2 }, base2), r = { side: side > 0 ? 'long' : 'short', hold, zone };
    for (const [w, W] of [['is', IS], ['oos', OOS]]) {
      const f = (x) => inW(x.a, W), S = T.filter(f), S2 = T2.filter(f);
      r[w] = { ...summary(S), net2x: r3(mean(S2.map((x) => x.net))), ex2x: r3(mean(S2.map((x) => x.ex))),
        totalNetPerDay: r3(S.reduce((x, y) => x + y.net, 0) / S.length) };
    }
    // placebo: each out-of-sample event replaced by a random gold day of the same calendar year (with replacement)
    const oosEv = T.filter((x) => inW(x.a, OOS)), pl = [];
    for (let s = 0; s < SEEDS; s++) {
      const rng = mulberry32(SEED + s), got = [];
      for (const e of oosEv) {
        const cand = yearIdx.get(e.a.slice(0, 4));
        for (let tries = 0; tries < 30; tries++) { const t = trade(G, cand[Math.floor(rng() * cand.length)], hold, side);
          if (t) { got.push(t.net - base.get(t.a.slice(0, 4))); break; } }
      }
      pl.push(mean(got));
    }
    r.placebo = { seeds: SEEDS, beaten: pl.filter((v) => r.oos.ex > v).length, mean: r3(mean(pl)), max: r3(Math.max(...pl)), min: r3(Math.min(...pl)) };
    out.tests[k] = r; ps.push(r.oos.p);
  }
  const adj = holm(ps);
  Object.keys(TESTS).forEach((k, i) => { const r = out.tests[k]; r.holm = r4(adj[i]);
    r.checks = { oosExPos: r.oos.ex > 0, oosT2: r.oos.tEx >= 2, holm: adj[i] < 0.05, isSameSign: r.is.ex > 0, cost2x: r.oos.net2x > 0 && r.oos.ex2x > 0, placebo: r.placebo.beaten >= BEAT };
    r.pass = Object.values(r.checks).every(Boolean); });
  out.verdict = out.tests.T1.pass ? 'PASS' : 'FAIL';
  out.passed = Object.keys(TESTS).filter((k) => out.tests[k].pass);
  return out;
}

const here = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const get = (k) => JSON.parse(execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 64e6 }).toString()).rows;
  const res = { study: 'gold-bond-52w-extreme', built: '2026-11-14', ...study(get('xau'), get('usb30y')) };
  fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  console.log(JSON.stringify({ verdict: res.verdict, data: res.data, events: res.events }));
  for (const [k, r] of Object.entries(res.tests)) console.log(k, JSON.stringify({ is: r.is, oos: r.oos, placebo: r.placebo, holm: r.holm, checks: r.checks }));
}
