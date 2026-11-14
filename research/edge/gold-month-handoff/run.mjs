// Spot gold's first week follows the previous month (PREREGISTRATION.md, pushed first). A calendar study of its own: no
// book rule or book position is read or touched. Paper only.
//   node research/edge/gold-month-handoff/run.mjs   reads council-data research/daily/xau.json (git show, no network, no
//                                                   cache written) -> result.json, prints the tables
// Pure pieces are exported for the test.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN, stopFill } from '../../../council/fills.mjs';

export const COST = 0.60, ATR_N = 20, ATR_K = 2, SEED = 20261114, SEEDS = 40, BEAT = 38, LOOK = 21;
export const IS = ['2007-01', '2016-12'], OOS = ['2017-01', '2026-10'];
// hold in trading days after TD-1 (entry at the close of TD-1)
export const TESTS = {
  T1: { h: 5, what: 'previous month\'s sign, TD-1 close -> TD+5 close' },
  T2: { h: 3, what: 'previous month\'s sign, TD-1 close -> TD+3 close' },
  T3: { h: 10, what: 'previous month\'s sign, TD-1 close -> TD+10 close' },
};
const H = 3600;
export const dateOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const closeTime = (t) => t + (new Date(t * 1000).getUTCDay() === 5 ? 21 : 23) * H;

export function prepare(rows) {
  return { bars: foldWeekend(rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }))) };
}
// index of each month's last trading day, in order: [[ 'YYYY-MM', i ], ...]; the file's own last month is not complete
export function monthEnds(bars) {
  const out = [];
  for (let i = 0; i + 1 < bars.length; i++) {
    const mk = dateOf(bars[i].time).slice(0, 7);
    if (dateOf(bars[i + 1].time).slice(0, 7) !== mk) out.push([mk, i]);
  }
  return out;
}
// the signal at a month end: sign of ln(close TD-1 / close of the previous month's TD-1); uses closes up to i only
export function signals(bars) {
  const me = monthEnds(bars), out = [];
  for (let k = 1; k < me.length; k++) {
    const [mk, i] = me[k], p = me[k - 1][1], r = Math.log(bars[i].close / bars[p].close);
    if (r === 0) continue;
    out.push({ mk, i, r, side: r > 0 ? 1 : -1 });
  }
  return out;
}
// one trade: enter at the close of candle i, out at the close of i + h or at the stop. side +1 long, -1 short.
export function trade(P, i, h, side, { cost = COST, finMult = 1 } = {}) {
  const { bars } = P, j = i + h;
  if (!(h > 0) || i < ATR_N || j >= bars.length) return null;
  let tr = 0;
  for (let k = i - ATR_N + 1; k <= i; k++) { const x = bars[k], pc = bars[k - 1].close; tr += Math.max(x.high - x.low, Math.abs(x.high - pc), Math.abs(x.low - pc)); }
  const entry = bars[i].close, risk = ATR_K * tr / ATR_N, stop = entry - side * risk;
  if (!(risk > 0)) return null;
  let exit = bars[j].close, how = 'time', tOut = closeTime(bars[j].time);
  for (let k = i + 1; k <= j; k++) { const x = bars[k];
    if (side > 0 ? x.low <= stop : x.high >= stop) { exit = stopFill(x, side < 0, stop, true); how = 'stop'; tOut = closeTime(x.time); break; } }
  const R = side * (exit - entry) / risk, nn = side > 0 ? nights(closeTime(bars[i].time), tOut) : 0;
  const fin = finMult * nn * FIN.xau.long * entry / risk;
  return { a: dateOf(bars[i].time), side, entry, stop, risk, exit, how, R, fin, net: R - cost / risk - fin };
}
// baseline: mean net R of the same-side trade of hold h entered on every candle of each calendar year
export function baselines(P, h, opt = {}) {
  const acc = new Map();
  for (let i = ATR_N; i + h < P.bars.length; i++) for (const side of [1, -1]) {
    const t = trade(P, i, h, side, opt); if (!t) continue;
    const k = `${t.a.slice(0, 4)}|${side}`, v = acc.get(k) || [0, 0]; v[0] += t.net; v[1]++; acc.set(k, v);
  }
  return new Map([...acc].map(([k, [s, n]]) => [k, s / n]));
}
export const baseOf = (B, a, side) => B.get(`${a.slice(0, 4)}|${side}`);

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
// t on calendar-month sums (grouped by the month of entry)
export function monthT(T, key = 'net') {
  const by = new Map(); for (const x of T) { const k = x.a.slice(0, 7); by.set(k, (by.get(k) || 0) + x[key]); }
  const v = [...by.values()], n = v.length; if (n < 3) return { months: n, t: null, p: null };
  const sd = sdOf(v), t = sd ? mean(v) / (sd / Math.sqrt(n)) : 0;
  return { months: n, t, p: pUpper(t, n - 1) };
}
const inW = (mk, w) => mk >= w[0] && mk <= w[1];
const r3 = (x) => x == null || Number.isNaN(x) ? null : +x.toFixed(3), r2 = (x) => x == null || Number.isNaN(x) ? null : +x.toFixed(2), r4 = (x) => x == null ? null : +x.toFixed(4);
export function summary(T) {
  if (!T.length) return { n: 0 };
  const me = monthT(T, 'ex'), mn = monthT(T, 'net'), mg = monthT(T, 'R');
  return { n: T.length, excess: r3(mean(T.map((x) => x.ex))), tExcess: r2(me.t), p: r4(me.p), net: r3(mean(T.map((x) => x.net))), tNet: r2(mn.t),
    gross: r3(mean(T.map((x) => x.R))), tGross: r2(mg.t), base: r3(mean(T.map((x) => x.base))), months: me.months,
    win: r2(100 * T.filter((x) => x.net > 0).length / T.length), stops: T.filter((x) => x.how === 'stop').length,
    buys: T.filter((x) => x.side > 0).length, sells: T.filter((x) => x.side < 0).length };
}
function monthIdx(P) {
  const m = new Map(); P.bars.forEach((b, i) => { const k = dateOf(b.time).slice(0, 7); if (!m.has(k)) m.set(k, []); m.get(k).push(i); });
  return m;
}
// side of the placebo's "last month's direction" at candle i: sign of the 21-candle log return up to i
export const lookSide = (bars, i) => { if (i < LOOK) return 0; const r = Math.log(bars[i].close / bars[i - LOOK].close); return r > 0 ? 1 : r < 0 ? -1 : 0; };
export function placebo(P, evs, h, B, seeds = SEEDS, seed = SEED) {
  const M = monthIdx(P), out = [];
  for (let s = 0; s < seeds; s++) {
    const rng = mulberry32(seed + s), got = [];
    for (const e of evs) {
      const cand = (M.get(e.mk) || []).filter((i) => i !== e.i);
      for (let tries = 0; tries < 30 && cand.length; tries++) {
        const i = cand[Math.floor(rng() * cand.length)], side = lookSide(P.bars, i); if (!side) continue;
        const t = trade(P, i, h, side), b = t && baseOf(B, t.a, side);
        if (t && b != null) { got.push(t.net - b); break; }
      }
    }
    out.push(mean(got));
  }
  return out;
}

export function study(rows) {
  const P = prepare(rows), sig = signals(P.bars).filter((e) => inW(e.mk, [IS[0], OOS[1]]));
  const out = { data: { first: dateOf(P.bars[0].time), last: dateOf(P.bars.at(-1).time), candles: P.bars.length, fold: 'UTC days, weekends folded into Monday (fills.mjs foldWeekend)',
    eventsIS: sig.filter((e) => inW(e.mk, IS)).length, eventsOOS: sig.filter((e) => inW(e.mk, OOS)).length },
    rules: { cost: COST, cost2x: 2 * COST, atr: `${ATR_K} x ATR(${ATR_N})`, fin: FIN.xau.long, IS, OOS, baseline: 'same-side trade of the same hold on every candle of the same calendar year',
      tests: Object.fromEntries(Object.entries(TESTS).map(([k, v]) => [k, v.what])) },
    tests: {}, dropped: {} };
  const ps = [];
  for (const k of Object.keys(TESTS)) {
    const { h } = TESTS[k], B = baselines(P, h), B2 = baselines(P, h, { cost: 2 * COST, finMult: 2 }), r = {};
    const mk = (flip, opt, BB) => sig.map((e) => { const s = flip ? -e.side : e.side, t = trade(P, e.i, h, s, opt); if (!t) return null;
      const base = baseOf(BB, t.a, s); return { ...t, mk: e.mk, base, ex: t.net - base }; }).filter(Boolean);
    const T = mk(false, {}, B), T2x = mk(false, { cost: 2 * COST, finMult: 2 }, B2), Tx = mk(true, {}, B);
    out.dropped[k] = sig.length - T.length;
    for (const [w, W] of [['is', IS], ['oos', OOS]]) {
      const f = (x) => inW(x.mk, W), TW = T.filter(f);
      r[w] = { ...summary(TW), excess2x: r3(mean(T2x.filter(f).map((x) => x.ex))), opposite: summary(Tx.filter(f)),
        buys: summary(TW.filter((x) => x.side > 0)), sells: summary(TW.filter((x) => x.side < 0)) };
    }
    const byYear = {}; for (const x of T) { const y = x.a.slice(0, 4); (byYear[y] ||= []).push(x); }
    r.byYear = Object.fromEntries(Object.entries(byYear).map(([y, v]) => [y, { n: v.length, net: r3(mean(v.map((x) => x.net))), excess: r3(mean(v.map((x) => x.ex))) }]));
    const pl = placebo(P, sig.filter((e) => inW(e.mk, OOS)), h, B), want = r.oos.excess;
    r.placebo = { seeds: SEEDS, beaten: pl.filter((v) => want > v).length, mean: r3(mean(pl)), max: r3(Math.max(...pl)), min: r3(Math.min(...pl)) };
    r.hold = h;
    out.tests[k] = r; ps.push(r.oos.p);
  }
  const adj = holm(ps);
  Object.keys(TESTS).forEach((k, i) => { const r = out.tests[k]; r.holm = r4(adj[i]);
    r.checks = { oosExcessPos: r.oos.excess > 0, oosT2: r.oos.tExcess >= 2, holm: adj[i] < 0.05, isSameSign: r.is.excess > 0, cost2x: r.oos.excess2x > 0, placebo: r.placebo.beaten >= BEAT };
    r.pass = Object.values(r.checks).every(Boolean); });
  out.verdict = out.tests.T1.pass ? 'PASS' : 'FAIL';
  out.passed = Object.keys(TESTS).filter((k) => out.tests[k].pass);
  return out;
}

const here = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const raw = execFileSync('git', ['show', 'origin/council-data:research/daily/xau.json'], { maxBuffer: 64e6 }).toString();
  const res = { study: 'gold-month-handoff', built: '2026-11-14', ...study(JSON.parse(raw).rows) };
  fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  console.log(JSON.stringify({ verdict: res.verdict, data: res.data, dropped: res.dropped }));
  for (const [k, r] of Object.entries(res.tests)) console.log(k, JSON.stringify({ is: r.is, oos: r.oos, placebo: r.placebo, holm: r.holm, checks: r.checks }));
}
