// Silver bought in its quiet stretches, held wide: gold-lowvol-hold's rule unchanged on silver (PREREGISTRATION.md, pushed
// first). A stand-alone daily rule: no book rule or position is read or touched. Paper only.
//   node research/edge/silver-lowvol-hold/run.mjs   reads council-data research/daily/xag.json (git show, no network, no cache
//                                                written) -> result.json and RESULT.md, prints the tables
// Pure pieces are exported for the test.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN, stopFill } from '../../../council/fills.mjs';

export const COST = 0.06, ATR_N = 20, ATR_K = 3, RV_N = 20, LOOK = 252, LO = 1 / 3, HI = 2 / 3, SEED = 20261194, SEEDS = 40, BEAT = 38;
export const IS = ['2007-01', '2016-12'], OOS = ['2017-01', '2026-10'];
export const TESTS = {
  T1: { state: 'quiet', hold: 20, lag: 1, what: 'buy on a quiet day (rv20 in the lowest third of the past year), out after 20 days' },
  T2: { state: 'quiet', hold: 60, lag: 3, what: 'buy on a quiet day, out after 60 days (the wide exit)' },
  T3: { state: 'loud', hold: 20, lag: 1, what: 'buy on a loud day (rv20 in the top third), out after 20 days (contrast)' },
};
const H = 3600;
export const dateOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const closeTime = (t) => t + (new Date(t * 1000).getUTCDay() === 5 ? 21 : 23) * H;

export function prepare(rows) {
  const bars = foldWeekend(rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })));
  return { bars, rv: rvSeries(bars) };
}
// rv20 at i: sample sd of the 20 log close-to-close returns ending at i's close (candles <= i only)
export function rvSeries(bars, n = RV_N) {
  return bars.map((_, i) => {
    if (i < n) return null;
    const r = []; for (let k = i - n + 1; k <= i; k++) r.push(Math.log(bars[k].close / bars[k - 1].close));
    const m = r.reduce((a, b) => a + b, 0) / n; return Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1));
  });
}
// share of the LOOK previous rv20 values strictly below rv20(i); null until a full year exists
export function pctAt(rv, i, look = LOOK) {
  if (i - look < RV_N || rv[i] == null) return null;
  let b = 0; for (let k = i - look; k < i; k++) if (rv[k] < rv[i]) b++;
  return b / look;
}
export const stateOf = (p) => p == null ? null : p < LO ? 'quiet' : p >= HI ? 'loud' : 'mid';
const trOf = (bars, k) => { const x = bars[k], pc = bars[k - 1].close; return Math.max(x.high - x.low, Math.abs(x.high - pc), Math.abs(x.low - pc)); };
export function atr(bars, e, n = ATR_N) { if (e - n + 1 < 1) return null; let s = 0; for (let k = e - n + 1; k <= e; k++) s += trOf(bars, k); return s / n; }
// one buy: enter at the close of candle i, out at the close of candle i + hold or at the stop (3 x ATR(20) of candles <= i)
// finRate: none is judged (no silver rate in fills.mjs); FIN.xau.long per unit of price is the reported sensitivity
export const FIN_SENS = FIN.xau.long;
export function trade(P, i, hold, { cost = COST, finMult = 1, finRate = 0 } = {}) {
  const { bars } = P, j = i + hold;
  if (i == null || i < ATR_N || !(hold > 0) || j >= bars.length) return null;
  const entry = bars[i].close, risk = ATR_K * atr(bars, i), stop = entry - risk;
  if (!(risk > 0)) return null;
  let exit = bars[j].close, how = 'time', tOut = closeTime(bars[j].time), k0 = j;
  for (let k = i + 1; k <= j; k++) { const x = bars[k];
    if (x.low <= stop) { exit = stopFill(x, false, stop, true); how = 'stop'; tOut = closeTime(x.time); k0 = k; break; } }
  const R = (exit - entry) / risk, nn = nights(closeTime(bars[i].time), tOut);
  const fin = finMult * nn * finRate * entry / risk;
  return { i, a: dateOf(bars[i].time), b: dateOf(bars[k0].time), out: k0, entry, stop, risk, exit, how, R, fin, nights: nn, net: R - cost / risk - fin };
}
// every day with its volatility state and entry month
export function days(P) {
  const out = [];
  for (let i = 0; i < P.bars.length; i++) { const p = pctAt(P.rv, i); if (p == null) continue; out.push({ i, p, state: stateOf(p), mk: dateOf(P.bars[i].time).slice(0, 7) }); }
  return out;
}
// every-day baseline: mean net R (and gross) of the same trade entered on every trading day of each calendar year
export function baseline(P, hold, opt) {
  const by = {};
  for (let i = ATR_N; i < P.bars.length; i++) { const t = trade(P, i, hold, opt); if (!t) continue; const y = t.a.slice(0, 4); (by[y] ||= { n: 0, net: 0, R: 0, ids: [] }); by[y].n++; by[y].net += t.net; by[y].R += t.R; by[y].ids.push(i); }
  for (const y of Object.keys(by)) { by[y].net /= by[y].n; by[y].R /= by[y].n; }
  return by;
}
// every qualifying day is a trade (overlapping); excess = net minus that year's baseline mean
export function run(P, D, test, opt) {
  const { state, hold } = TESTS[test], base = baseline(P, hold, opt), T = []; let offFile = 0;
  for (const d of D) { if (d.state !== state) continue;
    const t = trade(P, d.i, hold, opt); if (!t) { offFile++; continue; }
    const b = base[t.a.slice(0, 4)];
    T.push({ ...t, mk: d.mk, ex: t.net - b.net, exG: t.R - b.R }); }
  return { T, offFile, base };
}
// one position at a time (reported, not judged)
export function runSingle(P, D, test) {
  const { state, hold } = TESTS[test], base = baseline(P, hold), T = []; let busy = -1;
  for (const d of D) { if (d.state !== state || d.i < busy) continue;
    const t = trade(P, d.i, hold); if (!t) continue; T.push({ ...t, mk: d.mk, ex: t.net - base[t.a.slice(0, 4)].net, exG: 0 }); busy = t.out; }
  return T;
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
  const o = ps.map((p, i) => [p, i]).sort((x, y) => x[0] - y[0]), out = Array(ps.length); let r0 = 0;
  o.forEach(([p, i], r) => { r0 = Math.max(r0, Math.min(1, (ps.length - r) * p)); out[i] = r0; });
  return out;
}
export function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function monthSums(T, key) { const by = new Map(); for (const x of [...T].sort((p, q) => p.a < q.a ? -1 : 1)) { const k = x.a.slice(0, 7); by.set(k, (by.get(k) || 0) + x[key]); } return [...by.values()]; }
// t of the mean of v: plain (lag 0) or Newey-West with Bartlett weights
export function nwT(v, lag = 0) {
  const n = v.length; if (n < 3) return { months: n, t: null, p: null };
  const m = mean(v), g = (l) => { let s = 0; for (let k = l; k < n; k++) s += (v[k] - m) * (v[k - l] - m); return s / n; };
  let s2 = lag === 0 ? sdOf(v) ** 2 : g(0); for (let l = 1; l <= lag; l++) s2 += 2 * (1 - l / (lag + 1)) * g(l);
  const t = s2 > 0 ? m / Math.sqrt(s2 / n) : 0;
  return { months: n, t, p: pUpper(t, n - 1) };
}
const inW = (mk, w) => mk >= w[0] && mk <= w[1];
const r3 = (x) => x == null ? null : +x.toFixed(3), r2 = (x) => x == null ? null : +x.toFixed(2), r4 = (x) => x == null ? null : +x.toFixed(4);
export function summary(T, lag) {
  if (!T.length) return { n: 0 };
  const e = nwT(monthSums(T, 'ex'), lag), e0 = nwT(monthSums(T, 'ex'), 0), g = nwT(monthSums(T, 'exG'), lag), nt = nwT(monthSums(T, 'net'), lag);
  return { n: T.length, months: e.months, net: r3(mean(T.map((x) => x.net))), gross: r3(mean(T.map((x) => x.R))), tNet: r2(nt.t),
    excess: r3(mean(T.map((x) => x.ex))), tEx: r2(e.t), tExPlain: r2(e0.t), p: r4(e.p), excessGross: r3(mean(T.map((x) => x.exG))), tExGross: r2(g.t),
    win: r2(100 * T.filter((x) => x.net > 0).length / T.length), stops: T.filter((x) => x.how === 'stop').length,
    fin: r3(mean(T.map((x) => x.fin))), nights: r2(mean(T.map((x) => x.nights))) };
}
// placebo: every out-of-sample rule trade replaced by the trade of a random trading day of the same calendar year
export function placebo(P, T, test, base, seeds = SEEDS, seed = SEED) {
  const out = [], hold = TESTS[test].hold;
  for (let s = 0; s < seeds; s++) {
    const rng = mulberry32(seed + s), got = [];
    for (const e of T) { const y = e.a.slice(0, 4), ids = base[y].ids, i = ids[Math.floor(rng() * ids.length)], t = trade(P, i, hold);
      got.push(t.net - base[y].net); }
    out.push(mean(got));
  }
  return out;
}

export function study(rows) {
  const P = prepare(rows), D = days(P).filter((d) => inW(d.mk, [IS[0], OOS[1]]));
  const cnt = (W) => { const x = D.filter((d) => inW(d.mk, W)); return { days: x.length, quiet: x.filter((d) => d.state === 'quiet').length, loud: x.filter((d) => d.state === 'loud').length }; };
  const out = { data: { first: dateOf(P.bars[0].time), last: dateOf(P.bars.at(-1).time), candles: P.bars.length, firstDay: D.length ? dateOf(P.bars[D[0].i].time) : null,
      fold: 'UTC days, weekends folded into Monday (fills.mjs foldWeekend)' },
    rules: { cost: COST, cost2x: 2 * COST, stop: `${ATR_K} x ATR(${ATR_N})`, rv: `sd of ${RV_N} daily log returns`, pct: `share of the ${LOOK} previous rv20 below today's`,
      quiet: 'pct < 1/3', loud: 'pct >= 2/3', fin: 0, finSens: FIN_SENS, IS, OOS, tests: Object.fromEntries(Object.entries(TESTS).map(([k, v]) => [k, v.what])) },
    counts: { is: cnt(IS), oos: cnt(OOS) }, tests: {} };
  const ps = [];
  for (const k of Object.keys(TESTS)) {
    const { lag } = TESTS[k], r = {};
    const A = run(P, D, k), A2 = run(P, D, k, { cost: 2 * COST, finMult: 2 });
    r.offFile = A.offFile;
    for (const [w, W] of [['is', IS], ['oos', OOS]]) {
      const f = (x) => inW(x.mk, W), T2 = A2.T.filter(f), Tb = Object.entries(A.base).filter(([y]) => inW(`${y}-06`, W));
      r[w] = { ...summary(A.T.filter(f), lag), net2x: T2.length ? r3(mean(T2.map((x) => x.net))) : null, excess2x: T2.length ? r3(mean(T2.map((x) => x.ex))) : null,
        baseline: r3(Tb.reduce((s, [, v]) => s + v.net * v.n, 0) / Tb.reduce((s, [, v]) => s + v.n, 0)) };
    }
    const byYear = {}; for (const x of A.T) { const y = x.a.slice(0, 4); (byYear[y] ||= []).push(x); }
    r.byYear = Object.fromEntries(Object.entries(byYear).map(([y, v]) => [y, { n: v.length, net: r3(mean(v.map((x) => x.net))), base: r3(A.base[y].net), excess: r3(mean(v.map((x) => x.ex))) }]));
    const pl = placebo(P, A.T.filter((x) => inW(x.mk, OOS)), k, A.base);
    r.placebo = { seeds: SEEDS, beaten: pl.filter((v) => r.oos.excess > v).length, mean: r3(mean(pl)), max: r3(Math.max(...pl)), min: r3(Math.min(...pl)) };
    // reported only: gold's financing rate per unit of price charged on silver (2x = twice the cost and twice that rate)
    const F = run(P, D, k, { finRate: FIN_SENS }), F2 = run(P, D, k, { cost: 2 * COST, finMult: 2, finRate: FIN_SENS });
    r.finSens = Object.fromEntries([['is', IS], ['oos', OOS]].map(([w, W]) => { const f = (x) => inW(x.mk, W), T = F.T.filter(f), T2 = F2.T.filter(f), s = summary(T, lag);
      return [w, { n: s.n, net: s.net, tNet: s.tNet, excess: s.excess, tEx: s.tEx, fin: s.fin, net2x: r3(mean(T2.map((x) => x.net))), excess2x: r3(mean(T2.map((x) => x.ex))) }]; }));
    r.hold = TESTS[k].hold; r.lag = lag; r.state = TESTS[k].state;
    out.tests[k] = r; ps.push(r.oos.p);
  }
  const S = runSingle(P, D, 'T1');
  out.single = Object.fromEntries([['is', IS], ['oos', OOS]].map(([w, W]) => { const T = S.filter((x) => inW(x.mk, W)); const e = nwT(monthSums(T, 'ex'), 0);
    return [w, { n: T.length, net: r3(mean(T.map((x) => x.net))), excess: r3(mean(T.map((x) => x.ex))), tEx: r2(e.t) }]; }));
  const adj = holm(ps);
  Object.keys(TESTS).forEach((k, i) => { const r = out.tests[k]; r.holm = r4(adj[i]);
    r.checks = { oosExT2: r.oos.excess > 0 && r.oos.tEx >= 2, holm: adj[i] < 0.05, oosNetPos: r.oos.net > 0, isSameSign: r.is.excess > 0,
      cost2x: r.oos.net2x > 0 && r.oos.excess2x > 0, placebo: r.placebo.beaten >= BEAT };
    r.pass = Object.values(r.checks).every(Boolean); });
  out.verdict = out.tests.T1.pass ? 'PASS' : 'FAIL';
  out.passed = Object.keys(TESTS).filter((k) => out.tests[k].pass);
  return out;
}

const NAMES = { oosExT2: 'out-of-sample excess > 0 with month t >= 2', holm: 'Holm p < 0.05', oosNetPos: 'out-of-sample net R > 0',
  isSameSign: 'in-sample excess > 0', cost2x: 'net R and excess > 0 at 2x costs', placebo: '38 of 40 placebos' };
const sg = (v, d = 3) => v == null ? 'n/a' : (v >= 0 ? '+' : '') + v.toFixed(d);
export function verdictLine(res) {
  const T1 = res.tests.T1;
  return `**Verdict: ${res.verdict}, ${res.passed.length} of 3: silver bought on quiet days for 20 days vs every-day buys ${sg(T1.oos.excess)}R a trade out of sample (n ${T1.oos.n}, month t ${T1.oos.tEx.toFixed(2)}), ${sg(T1.is.excess)}R in sample; ${T1.placebo.beaten} of 40 placebos.**`;
}
export function report(res) {
  const L = [];
  L.push('# Result: silver bought in its quiet stretches, held wide (gold-lowvol-hold replicated, 14 Nov 2026)', '');
  L.push(verdictLine(res), '');
  L.push('gold-lowvol-hold\'s rule (branch `gold-lowvol-hold`: gold OOS excess +0.152R, t 1.14, in sample -0.084R, FAIL) run unchanged',
    'on silver; only the market and its cost change. A stand-alone daily rule: no rule or position of the live gold book was read, tested or touched',
    '(docs/owner-decisions.md item 44). Pre-registration: `PREREGISTRATION.md` (pushed alone before any figure). Code: `run.mjs`.',
    'Every figure: `result.json`; this page is written by `run.mjs` from it. Nothing is an edge here; nothing live changed and no',
    'proposal is written.', '');
  const d = res.data, c = res.counts;
  L.push('## Data and rule', '',
    `Council-data \`research/daily/xag.json\` (OANDA mid spot silver, UTC daily candles, weekends folded into Monday with`,
    `\`fills.mjs\` \`foldWeekend\`), ${d.first} to ${d.last}, ${d.candles} trading days; first day with a full year of volatility ${d.firstDay}.`,
    `rv20 = ${res.rules.rv}; pct = ${res.rules.pct}; quiet = ${res.rules.quiet}, loud = ${res.rules.loud}.`,
    `Days by entry month: in sample ${res.rules.IS.join(' to ')} ${c.is.days} (${c.is.quiet} quiet, ${c.is.loud} loud), out of sample`,
    `${res.rules.OOS.join(' to ')} ${c.oos.days} (${c.oos.quiet} quiet, ${c.oos.loud} loud). Buy at the day's close, every qualifying day a trade`,
    `(overlapping), stop ${res.rules.stop} (a gap through it fills at the open), $${res.rules.cost.toFixed(2)} a round trip ($0.03 spread + $0.015 slippage`,
    `a side, as silver-rates-shrug); **no financing**: \`council/fills.mjs\` has no silver rate (gold's ${res.rules.finSens} of price a rollover is`,
    `charged only in the sensitivity table below). 2x costs = $${res.rules.cost2x.toFixed(2)}. Excess = a trade's net R minus the mean net R of`,
    'the same trade entered on every trading day of its year. t on calendar-month sums of the excess, Newey-West (lag 1 for 20 days,',
    '3 for 60), one-sided, Holm over the three tests.', '');
  L.push('## The tests (R a trade)', '',
    '| Test | Rule | Window | n | Months | Net R | Net t | Every-day net R | Excess | Month t (NW) | Plain t | Gross excess | Gross t | Net at 2x | Excess at 2x | Stops | Holm p | Placebo beaten | Pass |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, r] of Object.entries(res.tests)) for (const w of ['is', 'oos']) { const x = r[w];
    L.push(`| ${k} | ${res.rules.tests[k]} | ${w === 'is' ? 'in sample' : 'out of sample'} | ${x.n} | ${x.months} | ${sg(x.net)} | ${x.tNet.toFixed(2)} | ${sg(x.baseline)} | ${sg(x.excess)} | ${x.tEx.toFixed(2)} | ${x.tExPlain.toFixed(2)} | ${sg(x.excessGross)} | ${x.tExGross.toFixed(2)} | ${sg(x.net2x)} | ${sg(x.excess2x)} | ${x.stops} | ${w === 'oos' ? `${r.holm} | ${r.placebo.beaten} | ${r.pass ? 'yes' : 'no'}` : '| |'} |`); }
  L.push('', 'Nights held a trade (out of sample): ' + Object.entries(res.tests).map(([k, r]) => `${k} ${r.oos.nights}`).join(', ') +
    '. Dropped because the exit is not on file yet: ' + Object.entries(res.tests).map(([k, r]) => `${k} ${r.offFile}`).join(', ') + '.', '');
  L.push('## Checks of each test (all must hold)', '', '| Test | OOS excess > 0, t >= 2 | Holm p < 0.05 | OOS net > 0 | in-sample excess > 0 | > 0 at 2x costs | >= 38 of 40 placebos |', '|---|---|---|---|---|---|---|');
  for (const [k, r] of Object.entries(res.tests)) { const c2 = r.checks, y = (b) => b ? 'yes' : 'no';
    L.push(`| ${k} | ${y(c2.oosExT2)} | ${y(c2.holm)} | ${y(c2.oosNetPos)} | ${y(c2.isSameSign)} | ${y(c2.cost2x)} | ${y(c2.placebo)} |`); }
  L.push('', '## Sensitivity: gold\'s financing rate per unit of price charged on silver (reported, not judged)', '',
    '| Test | Window | n | Financing R a trade | Net R | Net t | Excess | Excess t (NW) | Net at 2x | Excess at 2x |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, r] of Object.entries(res.tests)) for (const w of ['is', 'oos']) { const x = r.finSens[w];
    L.push(`| ${k} | ${w === 'is' ? 'in sample' : 'out of sample'} | ${x.n} | ${sg(x.fin)} | ${sg(x.net)} | ${x.tNet.toFixed(2)} | ${sg(x.excess)} | ${x.tEx.toFixed(2)} | ${sg(x.net2x)} | ${sg(x.excess2x)} |`); }
  L.push('', '## Placebo (40 seeded draws, out of sample)', '',
    'Every out-of-sample rule trade replaced by the same buy entered on a random trading day of the same calendar year; statistic = mean excess.', '',
    '| Test | Rule excess | Placebo mean | min | max | Seeds beaten |', '|---|---|---|---|---|---|');
  for (const [k, r] of Object.entries(res.tests)) L.push(`| ${k} | ${sg(r.oos.excess)} | ${sg(r.placebo.mean)} | ${sg(r.placebo.min)} | ${sg(r.placebo.max)} | ${r.placebo.beaten} of ${r.placebo.seeds} |`);
  const s = res.single;
  L.push('', '## One position at a time (T1, reported, not judged)', '', '| Window | n | Net R | Excess | Plain month t |', '|---|---|---|---|---|',
    `| in sample | ${s.is.n} | ${sg(s.is.net)} | ${sg(s.is.excess)} | ${s.is.tEx == null ? 'n/a' : s.is.tEx.toFixed(2)} |`,
    `| out of sample | ${s.oos.n} | ${sg(s.oos.net)} | ${sg(s.oos.excess)} | ${s.oos.tEx == null ? 'n/a' : s.oos.tEx.toFixed(2)} |`);
  L.push('', '## T1 by year (net R a trade)', '', '| Year | n | Quiet-day buys | Every-day buys | Excess |', '|---|---|---|---|---|');
  for (const [y, v] of Object.entries(res.tests.T1.byYear)) L.push(`| ${y} | ${v.n} | ${sg(v.net)} | ${sg(v.base)} | ${sg(v.excess)} |`);
  L.push('', '## Reading', '');
  const T1 = res.tests.T1;
  L.push(res.verdict === 'PASS'
    ? 'T1 passes every pre-registered check. A pass on one study is a lead for the owner, to be replicated on other markets or years, not a live rule; nothing live changed.'
    : `Not an edge. T1 fails: ${Object.entries(T1.checks).filter(([, v]) => !v).map(([k]) => NAMES[k]).join('; ')}. ${res.passed.length ? `Passed: ${res.passed.join(', ')} (secondary; the verdict rests on T1).` : 'T2 and T3 fail too.'} ` +
      'On silver, as on gold, a quiet stretch picks no better moment to buy than any other day of the same year once the year\'s drift is taken out. No proposal; nothing live changed.', '');
  return L.join('\n');
}

const here = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const raw = execFileSync('git', ['show', 'origin/council-data:research/daily/xag.json'], { maxBuffer: 64e6 }).toString();
  const res = { study: 'silver-lowvol-hold', built: '2026-11-14', ...study(JSON.parse(raw).rows) };
  fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  fs.writeFileSync(path.join(here, 'RESULT.md'), report(res) + '\n');
  console.log(JSON.stringify({ verdict: res.verdict, data: res.data, counts: res.counts, single: res.single }));
  for (const [k, r] of Object.entries(res.tests)) console.log(k, JSON.stringify({ is: r.is, oos: r.oos, placebo: r.placebo, holm: r.holm, checks: r.checks }));
}
