// Gold held to an ATR barrier against gold held for a fixed time (PREREGISTRATION.md, committed alone first).
// A stand-alone study of gold's own daily path: it reads no trade record of the gold book and changes nothing live.
// Run: node research/edge/gold-atr-barrier-hold/run.mjs   (reads origin/council-data with git show, no network, no cache)
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86400;
export const P = { atrN: 14, spread: 0.60, fin: FIN.xau.long, seed: 20261114, placebo: 40,
  is: ['2007-01-01', '2016-12-31'], oos: ['2017-01-01', '2026-10-31'] };
// the arms: stop and target in ATR, the most days held (null target = time hold)
export const ARMS = { A: { stop: 2, target: 2, max: 20 }, A2: { stop: 1, target: 3, max: 20 }, B: { stop: 2, target: null, max: 10 } };
export const TESTS = { T1: { side: 1, arm: 'A' }, T2: { side: 1, arm: 'A2' }, T3: { side: -1, arm: 'A' } };

export const days = (rows) => foldWeekend(rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })));
// simple mean true range of the n days ending at i (reads bars[i - n .. i] only)
export function atr(bars, i, n = P.atrN) {
  if (i < n) return null;
  let s = 0;
  for (let j = i - n + 1; j <= i; j++) { const b = bars[j], pc = bars[j - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}
// one trade signalled at day i's close, entered at day i + 1's open. side 1 buy, -1 sell. Returns null if it has not exited by the last bar.
export function hold(bars, i, side, arm, a, { costMult = 1, finMult = 1 } = {}) {
  if (i + 1 >= bars.length || !(a > 0)) return null;
  const E = bars[i + 1].open, stop = E - side * arm.stop * a, tgt = arm.target == null ? null : E + side * arm.target * a;
  let exit = null, k = 0, why = null;
  for (let j = i + 1; j < bars.length; j++) {
    const b = bars[j]; k++;
    const lo = side > 0 ? b.low : -b.high, hi = side > 0 ? b.high : -b.low, op = side * b.open, st = side * stop, tg = tgt == null ? null : side * tgt;
    if (j > i + 1 && op <= st) { exit = b.open; why = 'stop'; }
    else if (j > i + 1 && tg != null && op >= tg) { exit = b.open; why = 'target'; }
    else if (lo <= st) { exit = stop; why = 'stop'; }
    else if (tg != null && hi >= tg) { exit = tgt; why = 'target'; }
    else if (k >= arm.max) { exit = b.close; why = 'time'; }
    if (exit != null) {
      const gross = side * (exit - E);
      const fin = side > 0 ? nights(bars[i + 1].time, b.time + DAY) * P.fin * E * finMult : 0;
      const net = gross - P.spread * costMult - fin;
      return { gross: gross / a, net: net / a, days: k, why, fin: fin / a };
    }
  }
  return null;
}
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const mean = (x) => x.reduce((p, q) => p + q, 0) / x.length;
const sd = (x) => { const m = mean(x); return Math.sqrt(x.reduce((p, q) => p + (q - m) ** 2, 0) / (x.length - 1)); };
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const Phi = (z) => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2); const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((x, y) => x[0] - y[0]), adj = Array(ps.length); let run = 0;
  o.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (ps.length - k) * p)); adj[i] = run; });
  return adj;
}
// t on calendar-month sums of the per-trade values; rows carry { t (entry time), v }
export function monthT(rows) {
  const m = new Map(); for (const r of rows) { const k = ymd(r.t).slice(0, 7); m.set(k, (m.get(k) || 0) + r.v); }
  const s = [...m.values()];
  return { months: s.length, t: s.length > 2 ? (mean(s) / sd(s)) * Math.sqrt(s.length) : 0 };
}
// the paired rows of one test in one window: per entry, the barrier arm, the time arm and d = q(A) - q(B)
export function pairs(bars, test, win, opt = {}) {
  const out = [];
  for (let i = P.atrN; i < bars.length - 1; i++) {
    const d = ymd(bars[i + 1].time); if (d < win[0] || d > win[1]) continue;
    const a = atr(bars, i); const x = hold(bars, i, test.side, ARMS[test.arm], a, opt), y = hold(bars, i, test.side, ARMS.B, a, opt);
    if (!x || !y) continue;
    out.push({ i, t: bars[i + 1].time, a, x, y, d: x.net / x.days - y.net / y.days, dg: x.gross / x.days - y.gross / y.days });
  }
  return out;
}
function summary(rows, key) {
  const arm = (f) => ({ n: rows.length, gross: mean(rows.map((r) => r[f].gross)), net: mean(rows.map((r) => r[f].net)), days: mean(rows.map((r) => r[f].days)),
    netPerDay: rows.reduce((s, r) => s + r[f].net, 0) / rows.reduce((s, r) => s + r[f].days, 0) });
  const mt = monthT(rows.map((r) => ({ t: r.t, v: r.d }))), mg = monthT(rows.map((r) => ({ t: r.t, v: r.dg })));
  return { n: rows.length, d: mean(rows.map((r) => r.d)), dGross: mean(rows.map((r) => r.dg)), t: mt.t, tGross: mg.t, months: mt.months, barrier: arm('x'), time: arm('y'), key };
}
// placebo: the barrier arm replaced by a time exit at a random number of days from its own days held, same stop, no target
export function placebo(bars, rows, test, seed) {
  const R = rng(seed), pool = rows.map((r) => r.x.days), arm = ARMS[test.arm], out = [];
  for (const r of rows) {
    const h = pool[Math.floor(R() * pool.length)];
    const z = hold(bars, r.i, test.side, { stop: arm.stop, target: null, max: h }, r.a);
    if (z) out.push(z.net / z.days - r.y.net / r.y.days);
  }
  return mean(out);
}

export function run(bars) {
  const res = { tests: {}, placebo: {} };
  for (const [k, test] of Object.entries(TESTS)) {
    const is = pairs(bars, test, P.is), oos = pairs(bars, test, P.oos), oos2 = pairs(bars, test, P.oos, { costMult: 2, finMult: 2 }), is2 = pairs(bars, test, P.is, { costMult: 2, finMult: 2 });
    const S = summary(oos), I = summary(is);
    const pl = []; for (let s = 0; s < P.placebo; s++) pl.push(placebo(bars, oos, test, P.seed + s));
    res.tests[k] = { side: test.side > 0 ? 'buy' : 'sell', arm: test.arm, is: I, oos: S, oos2x: mean(oos2.map((r) => r.d)), is2x: mean(is2.map((r) => r.d)), pOos: 1 - Phi(S.t), pIs: 1 - Phi(I.t) };
    res.placebo[k] = { means: pl, above: pl.filter((x) => S.d > x).length, max: Math.max(...pl), min: Math.min(...pl) };
  }
  const ks = Object.keys(TESTS), ho = holm(ks.map((k) => res.tests[k].pOos)), hi = holm(ks.map((k) => res.tests[k].pIs));
  ks.forEach((k, j) => {
    const t = res.tests[k]; t.pHolm = ho[j]; t.pHolmIs = hi[j];
    t.checks = { tHolm: t.oos.t >= 2 && t.pHolm <= 0.05, isSign: t.is.d > 0, cost2x: t.oos2x > 0, placebo: res.placebo[k].above >= 38 };
    t.pass = Object.values(t.checks).every(Boolean);
  });
  res.passCount = ks.filter((k) => res.tests[k].pass).length;
  res.verdict = res.tests.T1.pass ? 'PASS' : 'FAIL';
  return res;
}

// POST HOC (not pre-registered, added after the first run; RESULT.md says so). Two checks of what the pre-registered statistic
// measures. (1) The exposure-weighted rate: sum of net over sum of days held per arm, A minus B (the quantity whose equality under
// a random walk with drift the pre-registration's argument is about; the mean of per-trade ratios is not). (2) Shuffled paths: the
// window's days are re-ordered at random (each day kept as open / high / low / close relative to the previous close, times kept),
// which keeps gold's drift, volatility and day shapes but removes any order between days; the statistics are recomputed.
export const rate = (rows, f) => rows.reduce((s, r) => s + r[f].net, 0) / rows.reduce((s, r) => s + r[f].days, 0);
export function shuffled(bars, win, seed) {
  const from = Math.max(1, bars.findIndex((b) => ymd(b.time) >= win[0]) - P.atrN - 1);
  let to = bars.findIndex((b) => ymd(b.time) > win[1]); to = to < 0 ? bars.length : Math.min(bars.length, to + ARMS.A.max + 2);
  const seg = []; for (let j = from; j < to; j++) { const pc = bars[j - 1].close, b = bars[j]; seg.push([b.open / pc, b.high / pc, b.low / pc, b.close / pc]); }
  const R = rng(seed); for (let j = seg.length - 1; j > 0; j--) { const k = Math.floor(R() * (j + 1)); [seg[j], seg[k]] = [seg[k], seg[j]]; }
  const out = bars.slice(0, from); let pc = bars[from - 1].close;
  seg.forEach(([o, h, l, c], n) => { const b = { time: bars[from + n].time, open: o * pc, high: h * pc, low: l * pc, close: c * pc }; out.push(b); pc = b.close; });
  return out.concat(bars.slice(to)); // past the window plus the longest hold: unchanged, never reached by a window's trade
}
export function control(bars, k = 'T1', win = P.oos, draws = P.placebo) {
  const test = TESTS[k], real = pairs(bars, test, win), sh = [];
  for (let s = 0; s < draws; s++) {
    const rows = pairs(shuffled(bars, win, P.seed + 1000 + s), test, win);
    sh.push({ d: mean(rows.map((r) => r.d)), rateDiff: rate(rows, 'x') - rate(rows, 'y') });
  }
  const d = mean(real.map((r) => r.d)), rateDiff = rate(real, 'x') - rate(real, 'y');
  return { d, rateDiff, rateA: rate(real, 'x'), rateB: rate(real, 'y'), shuffledD: { min: Math.min(...sh.map((x) => x.d)), max: Math.max(...sh.map((x) => x.d)), mean: mean(sh.map((x) => x.d)), realAbove: sh.filter((x) => d > x.d).length },
    shuffledRate: { min: Math.min(...sh.map((x) => x.rateDiff)), max: Math.max(...sh.map((x) => x.rateDiff)), mean: mean(sh.map((x) => x.rateDiff)), realAbove: sh.filter((x) => rateDiff > x.rateDiff).length } };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = path.resolve(HERE, '../../..');
  const rows = JSON.parse(execSync('git show origin/council-data:research/daily/xau.json', { cwd: root, maxBuffer: 64 << 20 }).toString()).rows;
  const bars = days(rows);
  const r = run(bars);
  const out = { study: 'gold-atr-barrier-hold', built: '2026-11-14', verdict: r.verdict, passCount: r.passCount,
    data: { market: 'XAU/USD OANDA mid daily (council-data research/daily/xau.json), weekends folded', first: ymd(bars[0].time), last: ymd(bars.at(-1).time) },
    params: { ...P, arms: ARMS, tests: TESTS }, tests: r.tests, placebo: Object.fromEntries(Object.entries(r.placebo).map(([k, v]) => [k, { above: v.above, min: v.min, max: v.max }])) };
  out.preRegisteredBar = r.verdict;
  out.postHoc = {};
  for (const k of Object.keys(TESTS)) out.postHoc[k] = { is: control(bars, k, P.is), oos: control(bars, k, P.oos) };
  // the pre-registered statistic reads PASS only if the real path beats paths with no order between days; otherwise it is mechanical
  const real = out.postHoc.T1.oos;
  if (r.verdict === 'PASS' && real.shuffledD.realAbove < 38) {
    out.verdict = 'FAIL';
    out.why = 'The pre-registered mean of per-trade daily rates is positive on gold paths shuffled day by day too: the T1 pass is an artifact of the statistic, not of gold\'s path (post hoc, RESULT.md).';
  }
  console.log(JSON.stringify(out.postHoc, (k, v) => (typeof v === 'number' ? +v.toFixed(4) : v), 1));
  console.log(out.placebo, out.verdict);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
}
