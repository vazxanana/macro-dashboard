// Spot gold around the turn of the month (PREREGISTRATION.md, pushed first). A calendar study of its own: no book rule is
// read or touched. Paper only.
//   node research/edge/gold-turn-of-month/run.mjs   reads council-data research/daily/xau.json (git show, no network, no cache
//                                                  written) -> result.json, prints the tables
// Pure pieces are exported for the test.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN, stopFill } from '../../../council/fills.mjs';

export const COST = 0.60, ATR_N = 20, ATR_K = 2, SEED = 20261114, SEEDS = 40, BEAT = 38;
export const IS = ['2008-01', '2016-12'], OOS = ['2017-01', '2026-10'];
// each test: side, entry offset and exit offset from the month's last trading day (index of TD-1 = 0; TD-2 = -1; TD+1 = +1)
export const TESTS = {
  T1: { side: 1, a: -1, b: 3, what: 'long TD-2 close -> TD+3 close (TD-1, TD+1..+3)' },
  T2: { side: -1, a: -3, b: 0, what: 'short TD-4 close -> TD-1 close (TD-3..TD-1)' },
  T3: { side: 1, a: 0, b: 5, what: 'long TD-1 close -> TD+5 close (TD+1..+5)' },
};
const H = 3600;
export const dateOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const closeTime = (t) => t + (new Date(t * 1000).getUTCDay() === 5 ? 21 : 23) * H;

export function prepare(rows) {
  const bars = foldWeekend(rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })));
  return { bars };
}
// index of each month's last trading day (the last folded candle dated in that month), keyed 'YYYY-MM'
export function monthEnds(bars) {
  const out = new Map();
  for (let i = 0; i < bars.length; i++) {
    const mk = dateOf(bars[i].time).slice(0, 7), nx = bars[i + 1] ? dateOf(bars[i + 1].time).slice(0, 7) : null;
    if (nx && nx !== mk) out.set(mk, i);            // the file's own last month is not complete: no entry
  }
  return out;
}
// one trade: enter at the close of candle i, out at the close of candle j or at the stop. side +1 long, -1 short.
// Stop 2 x ATR(20) of the candles up to and including the entry candle (all closed at entry).
export function trade(P, i, j, side, { cost = COST, finMult = 1 } = {}) {
  const { bars } = P;
  if (i == null || j == null || !(j > i) || i < ATR_N || j >= bars.length) return null;
  let tr = 0;
  for (let k = i - ATR_N + 1; k <= i; k++) { const x = bars[k], pc = bars[k - 1].close; tr += Math.max(x.high - x.low, Math.abs(x.high - pc), Math.abs(x.low - pc)); }
  const entry = bars[i].close, risk = ATR_K * tr / ATR_N, stop = entry - side * risk;
  if (!(risk > 0)) return null;
  let exit = bars[j].close, how = 'time', tOut = closeTime(bars[j].time);
  for (let k = i + 1; k <= j; k++) { const x = bars[k];
    if (side > 0 ? x.low <= stop : x.high >= stop) { exit = stopFill(x, side < 0, stop, true); how = 'stop'; tOut = closeTime(x.time); break; } }
  const R = side * (exit - entry) / risk, nn = side > 0 ? nights(closeTime(bars[i].time), tOut) : 0;
  const fin = finMult * nn * FIN.xau.long * entry / risk;
  return { a: dateOf(bars[i].time), b: dateOf(bars[j].time), side, entry, stop, risk, exit, how, R, fin, net: R - cost / risk - fin, raw: Math.log(bars[j].close / entry) };
}
// events of one test: per month-end, entry / exit candle indices; mk = the ENTRY candle's month
export function events(P, test) {
  const { a, b } = TESTS[test], out = [];
  for (const [, e] of monthEnds(P.bars)) {
    const i = e + a, j = e + b; if (i < 0) continue;
    out.push({ test, i, j, mk: dateOf(P.bars[i].time).slice(0, 7), onFile: j < P.bars.length });
  }
  return out;
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
// t on calendar-month sums (trades grouped by the month of their entry)
export function monthT(T, key = 'net') {
  const by = new Map(); for (const x of T) { const k = x.a.slice(0, 7); by.set(k, (by.get(k) || 0) + x[key]); }
  const v = [...by.values()], n = v.length; if (n < 3) return { months: n, t: null, p: null };
  const sd = sdOf(v), t = sd ? mean(v) / (sd / Math.sqrt(n)) : 0;
  return { months: n, t, p: pUpper(t, n - 1) };
}
export function welch(a, b) {
  const va = sdOf(a) ** 2 / a.length, vb = sdOf(b) ** 2 / b.length, diff = mean(a) - mean(b), se = Math.sqrt(va + vb);
  const df = (va + vb) ** 2 / (va ** 2 / (a.length - 1) + vb ** 2 / (b.length - 1));
  return { diff, t: diff / se, df };
}
const inW = (mk, w) => mk >= w[0] && mk <= w[1];
const r3 = (x) => x == null ? null : +x.toFixed(3), r2 = (x) => x == null ? null : +x.toFixed(2), r4 = (x) => x == null ? null : +x.toFixed(4);
export function summary(T) {
  const mt = monthT(T), mg = monthT(T, 'R');
  return { n: T.length, net: r3(mean(T.map((x) => x.net))), gross: r3(mean(T.map((x) => x.R))), tNet: r2(mt.t), tGross: r2(mg.t), p: r4(mt.p), months: mt.months,
    win: r2(100 * T.filter((x) => x.net > 0).length / T.length), stops: T.filter((x) => x.how === 'stop').length, total: r2(T.reduce((s, x) => s + x.net, 0)) };
}
// candle indices of a calendar month
function monthIdx(P) {
  const m = new Map(); P.bars.forEach((b, i) => { const k = dateOf(b.time).slice(0, 7); if (!m.has(k)) m.set(k, []); m.get(k).push(i); });
  return m;
}
// placebo: every event replaced by a random window of the same length and side, entry another candle of the same calendar
// month as the event's entry; a seed's statistic = mean net R over the events given
export function placebo(P, evs, side, len, seeds = SEEDS, seed = SEED) {
  const M = monthIdx(P), out = [];
  for (let s = 0; s < seeds; s++) {
    const rng = mulberry32(seed + s), got = [];
    for (const e of evs) {
      const cand = (M.get(e.mk) || []).filter((i) => i !== e.i);
      for (let tries = 0; tries < 30 && cand.length; tries++) {
        const i = cand[Math.floor(rng() * cand.length)], t = trade(P, i, i + len, side);
        if (t) { got.push(t); break; }
      }
    }
    out.push(mean(got.map((x) => x.net)));
  }
  return out;
}
// gross log return of the event windows vs every other window of the same length with entry in the same months (long sign, bp)
export function others(P, evs, len) {
  const M = monthIdx(P), ev = [], ot = [];
  for (const e of evs) for (const i of M.get(e.mk) || []) {
    const j = i + len; if (j >= P.bars.length) continue;
    (i === e.i ? ev : ot).push(1e4 * Math.log(P.bars[j].close / P.bars[i].close));
  }
  const w = welch(ev, ot);
  return { nEvent: ev.length, nOther: ot.length, eventBp: r2(mean(ev)), otherBp: r2(mean(ot)), diffBp: r2(w.diff), t: r2(w.t) };
}

export function study(rows) {
  const P = prepare(rows);
  const out = { data: { first: dateOf(P.bars[0].time), last: dateOf(P.bars.at(-1).time), candles: P.bars.length, fold: 'UTC days, weekends folded into Monday (fills.mjs foldWeekend)' },
    rules: { cost: COST, cost2x: 2 * COST, atr: `${ATR_K} x ATR(${ATR_N})`, fin: FIN.xau.long, IS, OOS, tests: Object.fromEntries(Object.entries(TESTS).map(([k, v]) => [k, v.what])) },
    tests: {}, dropped: {} };
  const ps = [];
  for (const k of Object.keys(TESTS)) {
    const { side, a, b } = TESTS[k], len = b - a;
    const evs = events(P, k).filter((e) => inW(e.mk, [IS[0], OOS[1]])), r = {};
    const mk = (s, opt) => evs.map((e) => { const t = trade(P, e.i, e.j, s, opt); return t && { ...t, mk: e.mk }; }).filter(Boolean);
    const T = mk(side), T2x = mk(side, { cost: 2 * COST, finMult: 2 }), Tx = mk(-side);
    out.dropped[k] = evs.length - T.length;
    for (const [w, W] of [['is', IS], ['oos', OOS]]) {
      const f = (x) => inW(x.mk, W);
      r[w] = { ...summary(T.filter(f)), net2x: r3(mean(T2x.filter(f).map((x) => x.net))), opposite: summary(Tx.filter(f)),
        vsOthers: others(P, evs.filter((e) => inW(e.mk, W) && e.onFile), len) };
    }
    const byYear = {}; for (const x of T) { const y = x.a.slice(0, 4); (byYear[y] ||= []).push(x.net); }
    r.byYear = Object.fromEntries(Object.entries(byYear).map(([y, v]) => [y, { n: v.length, net: r3(mean(v)) }]));
    const pl = placebo(P, evs.filter((e) => inW(e.mk, OOS) && e.onFile), side, len), want = r.oos.net;
    r.placebo = { seeds: SEEDS, beaten: pl.filter((v) => want > v).length, mean: r3(mean(pl)), max: r3(Math.max(...pl)), min: r3(Math.min(...pl)) };
    r.side = side > 0 ? 'long' : 'short'; r.days = len;
    out.tests[k] = r; ps.push(r.oos.p);
  }
  const adj = holm(ps);
  Object.keys(TESTS).forEach((k, i) => { const r = out.tests[k]; r.holm = r4(adj[i]);
    r.checks = { oosNetPos: r.oos.net > 0, oosT2: r.oos.tNet >= 2, holm: adj[i] < 0.05, isSameSign: r.is.total > 0, cost2x: r.oos.net2x > 0, placebo: r.placebo.beaten >= BEAT };
    r.pass = Object.values(r.checks).every(Boolean); });
  out.verdict = out.tests.T1.pass ? 'PASS' : 'FAIL';
  out.passed = Object.keys(TESTS).filter((k) => out.tests[k].pass);
  return out;
}

const here = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const raw = execFileSync('git', ['show', 'origin/council-data:research/daily/xau.json'], { maxBuffer: 64e6 }).toString();
  const res = { study: 'gold-turn-of-month', built: '2026-11-14', ...study(JSON.parse(raw).rows) };
  fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  console.log(JSON.stringify({ verdict: res.verdict, data: res.data, dropped: res.dropped }, null, 0));
  for (const [k, r] of Object.entries(res.tests)) console.log(k, r.side, JSON.stringify({ is: r.is, oos: r.oos, placebo: r.placebo, holm: r.holm, checks: r.checks, byYear: r.byYear }));
}
