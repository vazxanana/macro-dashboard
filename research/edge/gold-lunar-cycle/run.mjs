// Spot gold over the lunar cycle (PREREGISTRATION.md, pushed first). A stand-alone calendar rule: no book rule or position
// is read or touched. Paper only.
//   node research/edge/gold-lunar-cycle/run.mjs   reads council-data research/daily/xau.json (git show, no network, no
//                                                 cache written) -> result.json and RESULT.md, prints the tables
// Pure pieces are exported for the test.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN, stopFill } from '../../../council/fills.mjs';

export const COST = 0.60, ATR_N = 20, ATR_K = 2, BASE_HOLD = 10, SEED = 20261114, SEEDS = 40, BEAT = 38, SYNODIC = 29.530588861;
export const IS = ['2007-01', '2016-12'], OOS = ['2017-01', '2026-10'];
const H = 3600, D2R = Math.PI / 180;
export const dateOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export const closeTime = (t) => t + (new Date(t * 1000).getUTCDay() === 5 ? 21 : 23) * H;

// Meeus, Astronomical Algorithms ch. 49: k integer + 0 new, .25 first quarter, .5 full, .75 last quarter -> unix seconds
// (TD taken as UTC: Delta T of about a minute is ignored; the planetary additional corrections are left out)
export function phaseTime(k) {
  const T = k / 1236.85, f = ((k % 1) + 1) % 1;
  let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T * T - 0.00000015 * T ** 3 + 0.00000000073 * T ** 4;
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;
  const M = (2.5534 + 29.1053567 * k - 0.0000014 * T * T - 0.00000011 * T ** 3) * D2R;
  const Mp = (201.5643 + 385.81693528 * k + 0.0107582 * T * T + 0.00001238 * T ** 3 - 0.000000058 * T ** 4) * D2R;
  const F = (160.7108 + 390.67050284 * k - 0.0016118 * T * T - 0.00000227 * T ** 3 + 0.000000011 * T ** 4) * D2R;
  const O = (124.7746 - 1.56375588 * k + 0.0020672 * T * T + 0.00000215 * T ** 3) * D2R;
  const s = Math.sin; let c;
  if (f < 0.01 || f > 0.99 || Math.abs(f - 0.5) < 0.01) {
    const full = Math.abs(f - 0.5) < 0.01;
    c = (full ? -0.40614 : -0.40720) * s(Mp) + (full ? 0.17302 : 0.17241) * E * s(M) + (full ? 0.01614 : 0.01608) * s(2 * Mp)
      + (full ? 0.01043 : 0.01039) * s(2 * F) + (full ? 0.00734 : 0.00739) * E * s(Mp - M) - (full ? 0.00515 : 0.00514) * E * s(Mp + M)
      + (full ? 0.00209 : 0.00208) * E * E * s(2 * M) - 0.00111 * s(Mp - 2 * F) - 0.00057 * s(Mp + 2 * F) + 0.00056 * E * s(2 * Mp + M)
      - 0.00042 * s(3 * Mp) + 0.00042 * E * s(M + 2 * F) + 0.00038 * E * s(M - 2 * F) - 0.00024 * E * s(2 * Mp - M) - 0.00017 * s(O);
  } else {
    c = -0.62801 * s(Mp) + 0.17172 * E * s(M) - 0.01183 * E * s(Mp + M) + 0.00862 * s(2 * Mp) + 0.00804 * s(2 * F)
      + 0.00454 * E * s(Mp - M) + 0.00204 * E * E * s(2 * M) - 0.0018 * s(Mp - 2 * F) - 0.0007 * s(Mp + 2 * F) - 0.0004 * s(3 * Mp)
      - 0.00034 * E * s(2 * Mp - M) + 0.00032 * E * s(M + 2 * F) + 0.00032 * E * s(M - 2 * F) - 0.00028 * E * E * s(Mp + 2 * M)
      + 0.00027 * E * s(2 * Mp + M) - 0.00017 * s(O);
    const cs = Math.cos, W = 0.00306 - 0.00038 * E * cs(M) + 0.00026 * cs(Mp) - 0.00002 * cs(Mp - M) + 0.00002 * cs(Mp + M) + 0.00002 * cs(2 * F);
    c += f < 0.5 ? W : -W;
  }
  jde += c;
  return (jde - 2440587.5) * 86400;
}
// every first-quarter / last-quarter time between two unix times, as switch points: side +1 from a last quarter (the half
// around the new moon), -1 from a first quarter (around the full moon). shift (days) moves every time (the placebo).
export function switches(from, to, shift = 0) {
  const k0 = Math.floor((from - 947182440) / 86400 / SYNODIC) - 2, out = [];
  for (let k = k0; ; k++) for (const q of [0.25, 0.75]) {
    const t = phaseTime(k + q) + shift * 86400;
    if (t > to) return out.sort((a, b) => a.t - b.t);
    if (t >= from) out.push({ t, side: q === 0.75 ? 1 : -1, q });
  }
}

export function prepare(rows) {
  return { bars: foldWeekend(rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }))) };
}
const trOf = (bars, k) => { const x = bars[k], pc = bars[k - 1].close; return Math.max(x.high - x.low, Math.abs(x.high - pc), Math.abs(x.low - pc)); };
export function atr(bars, e, n = ATR_N) { if (e - n + 1 < 1) return null; let s = 0; for (let k = e - n + 1; k <= e; k++) s += trOf(bars, k); return s / n; }
// index of the first candle whose close time is at or after t (null if none on file)
export function candleAt(bars, t) {
  let lo = 0, hi = bars.length - 1; if (!bars.length || closeTime(bars[hi].time) < t) return null;
  while (lo < hi) { const m = (lo + hi) >> 1; if (closeTime(bars[m].time) >= t) hi = m; else lo = m + 1; }
  return lo;
}
// one trade: enter at the close of candle i, out at the close of candle j or at the stop
export function trade(P, i, j, side, { cost = COST, finMult = 1 } = {}) {
  const { bars } = P;
  if (i == null || j == null || !(j > i) || i < ATR_N || j >= bars.length) return null;
  const entry = bars[i].close, risk = ATR_K * atr(bars, i), stop = entry - side * risk;
  if (!(risk > 0)) return null;
  let exit = bars[j].close, how = 'time', tOut = closeTime(bars[j].time), k0 = j;
  for (let k = i + 1; k <= j; k++) { const x = bars[k];
    if (side > 0 ? x.low <= stop : x.high >= stop) { exit = stopFill(x, side < 0, stop, true); how = 'stop'; tOut = closeTime(x.time); k0 = k; break; } }
  const R = side * (exit - entry) / risk, nn = side > 0 ? nights(closeTime(bars[i].time), tOut) : 0;
  const fin = finMult * nn * FIN.xau.long * entry / risk;
  return { a: dateOf(bars[i].time), b: dateOf(bars[k0].time), i, j, out: k0, side, entry, stop, risk, exit, how, R, cost: cost / risk, fin, net: R - cost / risk - fin };
}
// the legs: each switch point opens a leg of its side at its candle, closed at the next switch point's candle
export function legs(P, sw, opt) {
  const T = []; let offFile = 0, empty = 0;
  for (let n = 0; n + 1 < sw.length; n++) {
    const i = candleAt(P.bars, sw[n].t), j = candleAt(P.bars, sw[n + 1].t);
    if (i == null || j == null) { offFile++; continue; }
    if (!(j > i)) { empty++; continue; }
    const t = trade(P, i, j, sw[n].side, opt);
    if (t) T.push({ ...t, mk: t.a.slice(0, 7) });
  }
  return { T, offFile, empty };
}
export const inW = (mk, w) => mk >= w[0] && mk <= w[1];
// the every-day baseline of one side in one window: entered at every close, out BASE_HOLD trading days later
export function baseline(P, side, W, opt) {
  const T = [];
  for (let i = ATR_N; i + BASE_HOLD < P.bars.length; i++) {
    if (!inW(dateOf(P.bars[i].time).slice(0, 7), W)) continue;
    const t = trade(P, i, i + BASE_HOLD, side, opt); if (t) T.push(t);
  }
  return { n: T.length, net: mean(T.map((x) => x.net)), gross: mean(T.map((x) => x.R)) };
}

// statistics
const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
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
  const o = ps.map((p, i) => [p, i]).sort((x, y) => x[0] - y[0]), out = Array(ps.length); let r0 = 0;
  o.forEach(([p, i], r) => { r0 = Math.max(r0, Math.min(1, (ps.length - r) * p)); out[i] = r0; });
  return out;
}
export function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// t on calendar-month sums (legs grouped by the month of their entry)
export function monthT(T, key = 'net') {
  const by = new Map(); for (const x of T) { const k = x.a.slice(0, 7); by.set(k, (by.get(k) || 0) + x[key]); }
  const v = [...by.values()], n = v.length; if (n < 3) return { months: n, t: null, p: null };
  const sd = sdOf(v), t = sd ? mean(v) / (sd / Math.sqrt(n)) : 0;
  return { months: n, t, p: pUpper(t, n - 1) };
}
const r3 = (x) => x == null || !Number.isFinite(x) ? null : +x.toFixed(3), r2 = (x) => x == null || !Number.isFinite(x) ? null : +x.toFixed(2), r4 = (x) => x == null ? null : +x.toFixed(4);
const median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
// key: the per-leg figure judged (net for T1, ex for T2 / T3)
export function summary(T, key = 'net') {
  if (!T.length) return { n: 0 };
  const mt = monthT(T, key), mg = monthT(T, 'R'), costs = mean(T.map((x) => x.cost + x.fin)), absG = mean(T.map((x) => Math.abs(x.R)));
  return { n: T.length, mean: r3(mean(T.map((x) => x[key]))), net: r3(mean(T.map((x) => x.net))), gross: r3(mean(T.map((x) => x.R))),
    t: r2(mt.t), tGross: r2(mg.t), p: r4(mt.p), months: mt.months,
    win: r2(100 * T.filter((x) => x.net > 0).length / T.length), stops: T.filter((x) => x.how === 'stop').length, total: r2(T.reduce((s, x) => s + x[key], 0)),
    longs: T.filter((x) => x.side > 0).length, costR: r3(costs), costShare: r2(100 * costs / absG), medianStop: r2(median(T.map((x) => x.risk))) };
}

export const TESTS = {
  T1: { what: 'both legs: long last quarter -> first quarter, short first quarter -> last quarter (net R)', key: 'net', pick: () => true },
  T2: { what: 'long legs (around the new moon) minus the every-day long baseline (excess R)', key: 'ex', pick: (x) => x.side > 0 },
  T3: { what: 'short legs (around the full moon) minus the every-day short baseline (excess R)', key: 'ex', pick: (x) => x.side < 0 },
};

export function study(rows) {
  const P = prepare(rows), from = P.bars[0].time, to = closeTime(P.bars.at(-1).time) + 40 * 86400;
  const W2 = [IS[0], OOS[1]], within = (T) => T.filter((x) => inW(x.mk, W2));
  const sw = switches(from, to), L = legs(P, sw), L2 = legs(P, sw, { cost: 2 * COST, finMult: 2 });
  const base = {}, base2 = {}, o2 = { cost: 2 * COST, finMult: 2 };
  for (const [w, W] of [['is', IS], ['oos', OOS]]) {
    base[w] = { long: baseline(P, 1, W), short: baseline(P, -1, W) };
    base2[w] = { long: baseline(P, 1, W, o2), short: baseline(P, -1, W, o2) };
  }
  const wOf = (x) => inW(x.mk, IS) ? 'is' : inW(x.mk, OOS) ? 'oos' : null;
  const exOf = (T, B) => T.map((x) => { const w = wOf(x); return { ...x, ex: w ? x.net - B[w][x.side > 0 ? 'long' : 'short'].net : null }; });
  const A = exOf(within(L.T), base), A2 = exOf(within(L2.T), base2);
  const out = { data: { first: dateOf(P.bars[0].time), last: dateOf(P.bars.at(-1).time), candles: P.bars.length, fold: 'UTC days, weekends folded into the next weekday (fills.mjs foldWeekend)' },
    rules: { cost: COST, cost2x: 2 * COST, stop: `${ATR_K} x ATR(${ATR_N})`, baseHold: BASE_HOLD, fin: FIN.xau.long, IS, OOS,
      phases: 'Meeus ch. 49 (periodic terms to 0.00017 day), TD taken as UTC', tests: Object.fromEntries(Object.entries(TESTS).map(([k, v]) => [k, v.what])) },
    legs: { offFile: L.offFile, empty: L.empty, holdDays: r2(median(A.map((x) => x.j - x.i))) },
    baseline: Object.fromEntries(['is', 'oos'].map((w) => [w, Object.fromEntries(['long', 'short'].map((s) => [s,
      { n: base[w][s].n, net: r3(base[w][s].net), gross: r3(base[w][s].gross), net2x: r3(base2[w][s].net) }]))])),
    tests: {} };
  const ps = [];
  for (const [k, def] of Object.entries(TESTS)) {
    const r = {};
    for (const [w, W] of [['is', IS], ['oos', OOS]]) {
      const f = (x) => inW(x.mk, W) && def.pick(x), T2 = A2.filter(f);
      r[w] = { ...summary(A.filter(f), def.key), mean2x: T2.length ? r3(mean(T2.map((x) => x[def.key]))) : null };
    }
    if (k === 'T1') {
      const byYear = {}; for (const x of A) { const y = x.a.slice(0, 4); (byYear[y] ||= []).push(x.net); }
      r.byYear = Object.fromEntries(Object.entries(byYear).map(([y, v]) => [y, { n: v.length, net: r3(mean(v)) }]));
      // the opposite direction (long around the full moon), reported only
      const X = within(legs(P, sw.map((s) => ({ ...s, side: -s.side }))).T);
      r.opposite = Object.fromEntries([['is', IS], ['oos', OOS]].map(([w, W]) => [w, summary(X.filter((x) => inW(x.mk, W)))]));
      const pl = [];
      for (let s = 0; s < SEEDS; s++) {
        const sh = mulberry32(SEED + s)() * SYNODIC;
        pl.push(mean(within(legs(P, switches(from, to, sh)).T).filter((x) => inW(x.mk, OOS)).map((x) => x.net)));
      }
      r.placebo = { seeds: SEEDS, beaten: pl.filter((v) => r.oos.mean > v).length, mean: r3(mean(pl)), max: r3(Math.max(...pl)), min: r3(Math.min(...pl)) };
    }
    out.tests[k] = r; ps.push(r.oos.p);
  }
  const adj = holm(ps);
  Object.keys(TESTS).forEach((k, i) => { const r = out.tests[k]; r.holm = r4(adj[i]);
    r.checks = { oosPos: r.oos.mean > 0, oosT2: r.oos.t >= 2, holm: adj[i] < 0.05, isSameSign: r.is.mean > 0, cost2x: r.oos.mean2x > 0 };
    if (k === 'T1') r.checks.placebo = r.placebo.beaten >= BEAT;
    r.pass = Object.values(r.checks).every(Boolean); });
  out.verdict = out.tests.T1.pass ? 'PASS' : 'FAIL';
  out.passed = Object.keys(TESTS).filter((k) => out.tests[k].pass);
  return out;
}

const NAMES = { oosPos: 'out-of-sample mean > 0', oosT2: 'out-of-sample month t >= 2', holm: 'Holm p < 0.05', isSameSign: 'in-sample mean > 0',
  cost2x: 'mean > 0 at 2x costs', placebo: '38 of 40 placebos' };
const sg = (v, d = 3) => v == null ? 'n/a' : (v >= 0 ? '+' : '') + v.toFixed(d);
const tt = (v) => v == null ? 'n/a' : v.toFixed(2);
export function verdictLine(res) {
  const T1 = res.tests.T1;
  return `**Verdict: ${res.verdict}, ${res.passed.length} of 3: long gold around the new moon and short around the full moon made ${sg(T1.oos.mean)}R a leg net 2017-26 (n ${T1.oos.n}, month t ${tt(T1.oos.t)}), ${sg(T1.is.mean)}R in 2007-16; ${T1.placebo.beaten} of 40 placebos.**`;
}
export function report(res) {
  const L = [], b = res.baseline, T1 = res.tests.T1, d = res.data;
  L.push('# Result: spot gold over the lunar cycle (14 Nov 2026)', '', verdictLine(res), '');
  L.push('A stand-alone calendar rule of its own: no rule or position of the live gold book was read, tested or touched',
    '(docs/owner-decisions.md item 44). Pre-registration: `PREREGISTRATION.md` (pushed alone before any figure). Code: `run.mjs`.',
    'Every figure: `result.json`; this page is written by `run.mjs` from it. Nothing is an edge here; nothing live changed and no',
    'proposal is written.', '');
  L.push('## Data and rule', '',
    'Council-data `research/daily/xau.json` (OANDA mid spot gold, UTC daily candles, weekends folded into the next weekday with',
    `\`fills.mjs\` \`foldWeekend\`), ${d.first} to ${d.last}, ${d.candles} trading days. Moon phases: ${res.rules.phases}.`,
    'Long from the close at or after each last quarter to the close at or after the next first quarter (the half month around',
    'the new moon), short from the first quarter to the next last quarter (around the full moon); a leg exits on the candle the',
    `next one enters (median ${res.legs.holdDays} trading days). Stop ${res.rules.stop} (a gap through it fills at the open; a stopped leg stays flat`,
    `until the next phase), $${res.rules.cost.toFixed(2)} a round trip and \`FIN\` financing (${res.rules.fin} of price a rollover) on buys; 2x costs = $1.20`,
    'and twice the financing. t on calendar-month sums, one-sided, Holm over the three tests.', '');
  L.push('## The every-day baseline (same side, entered every trading day, out 10 trading days later)', '',
    '| Window | Side | n | Gross R | Net R | Net at 2x |', '|---|---|---|---|---|---|');
  for (const w of ['is', 'oos']) for (const s of ['long', 'short']) { const x = b[w][s];
    L.push(`| ${w === 'is' ? 'in sample 2007-16' : 'out of sample 2017-26'} | ${s} | ${x.n} | ${sg(x.gross)} | ${sg(x.net)} | ${sg(x.net2x)} |`); }
  L.push('', '## The tests (T1 net R a leg; T2 / T3 excess R a leg over the same-side baseline)', '',
    '| Test | Rule | Window | n | Mean R | Month t | Net R | Gross R | Gross t | Win % | Stops | Median stop $ | Cost share % | Total R | Mean at 2x | Holm p | Pass |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, r] of Object.entries(res.tests)) for (const w of ['is', 'oos']) { const x = r[w];
    L.push(`| ${k} | ${res.rules.tests[k]} | ${w === 'is' ? 'in sample' : 'out of sample'} | ${x.n} | ${sg(x.mean)} | ${tt(x.t)} | ${sg(x.net)} | ${sg(x.gross)} | ${tt(x.tGross)} | ${x.win} | ${x.stops} | ${x.medianStop} | ${x.costShare} | ${sg(x.total, 2)} | ${sg(x.mean2x)} | ${w === 'oos' ? `${r.holm} | ${r.pass ? 'yes' : 'no'}` : ' |'} |`); }
  L.push('', `Legs dropped because their exit is not on file yet: ${res.legs.offFile}; legs with no trading candle between two phases: ${res.legs.empty}.`, '');
  L.push('## Checks of each test (all must hold)', '', '| Test | OOS mean > 0 | OOS month t >= 2 | Holm p < 0.05 | in sample > 0 | > 0 at 2x costs | >= 38 of 40 placebos |', '|---|---|---|---|---|---|---|');
  for (const [k, r] of Object.entries(res.tests)) { const c = r.checks, y = (v) => v == null ? 'n/a' : v ? 'yes' : 'no';
    L.push(`| ${k} | ${y(c.oosPos)} | ${y(c.oosT2)} | ${y(c.holm)} | ${y(c.isSameSign)} | ${y(c.cost2x)} | ${y(c.placebo)} |`); }
  L.push('', '## Placebo (40 seeded draws, T1 out of sample)', '',
    'Every phase time shifted by one random offset (uniform over 0 to 29.53 days) and T1 run again.', '',
    '| Rule net R | Placebo mean | min | max | Seeds beaten |', '|---|---|---|---|---|',
    `| ${sg(T1.oos.mean)} | ${sg(T1.placebo.mean)} | ${sg(T1.placebo.min)} | ${sg(T1.placebo.max)} | ${T1.placebo.beaten} of ${T1.placebo.seeds} |`);
  L.push('', '## The opposite direction (long around the full moon, short around the new moon; reported, not judged)', '', '| Window | n | Net R | Month t |', '|---|---|---|---|');
  for (const w of ['is', 'oos']) { const x = T1.opposite[w]; L.push(`| ${w === 'is' ? 'in sample' : 'out of sample'} | ${x.n} | ${sg(x.net)} | ${tt(x.t)} |`); }
  L.push('', '## T1 by year (net R a leg)', '', '| Year | n | Net R |', '|---|---|---|');
  for (const [y, v] of Object.entries(T1.byYear)) L.push(`| ${y} | ${v.n} | ${sg(v.net)} |`);
  L.push('', '## Reading', '');
  L.push(res.verdict === 'PASS'
    ? 'T1 passes every pre-registered check. A pass on one study is a proposal for the owner, not a live rule; nothing live changed.'
    : `Not an edge. T1 fails: ${Object.entries(T1.checks).filter(([, v]) => !v).map(([c]) => NAMES[c]).join(', ')}. ${res.passed.length ? `Passed: ${res.passed.join(', ')} (secondary; the verdict rests on T1).` : 'T2 and T3 fail too.'} ` +
      `The both-sided stream is long half the time and short half the time, so it cannot ride gold's rise; costs and financing take ${T1.oos.costShare} % of the mean absolute gross R a leg out of sample (median stop $${T1.oos.medianStop}). ` +
      'Against the every-day baseline of each side (T2, T3) the half month around the new moon and the half month around the full moon ' +
      'are no measurably different from an ordinary day of the same side. The published index effect does not carry to gold here. ' +
      'No proposal; nothing live changed.', '');
  return L.join('\n');
}

const here = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const raw = execFileSync('git', ['show', 'origin/council-data:research/daily/xau.json'], { maxBuffer: 64e6 }).toString();
  const res = { study: 'gold-lunar-cycle', built: '2026-11-14', ...study(JSON.parse(raw).rows) };
  fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  fs.writeFileSync(path.join(here, 'RESULT.md'), report(res) + '\n');
  console.log(JSON.stringify({ verdict: res.verdict, data: res.data, legs: res.legs, baseline: res.baseline }));
  for (const [k, r] of Object.entries(res.tests)) console.log(k, JSON.stringify({ is: r.is, oos: r.oos, placebo: r.placebo, holm: r.holm, checks: r.checks }));
}
