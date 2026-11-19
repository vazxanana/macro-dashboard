// Gold's realised-volatility term structure and its 60-day trend (PREREGISTRATION.md, pushed first). A stand-alone daily rule:
// when the 5-day realised volatility is far below (T1) or above (T2) the 60-day one, trade gold's 60-day trend for ten days,
// judged as the EXCESS over the same trend trade on every day of the same year. No book rule or position is read or touched.
//   node research/edge/gold-rv-term/run.mjs   reads council-data research/daily/xau.json (git show, no network, no cache)
//                                             -> result.json and RESULT.md, prints the tables
// Pure pieces are exported for the test. Paper only.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN, stopFill } from '../../../council/fills.mjs';

export const COST = 0.60, ATR_N = 20, ATR_K = 2, SHORT = 5, LONG = 60, TREND = 60, HOLD = 10, SEED = 20261114, SEEDS = 40, BEAT = 38;
export const IS = ['2007-01', '2016-12'], OOS = ['2017-01', '2026-10'];
export const TESTS = {
  T1: { lo: 0.6, what: 'compression: RV5 / RV60 < 0.6, trade the 60-day trend' },
  T2: { hi: 1.2, what: 'expansion: RV5 / RV60 > 1.2, trade the 60-day trend' },
};
const H = 3600;
export const dateOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const closeTime = (t) => t + (new Date(t * 1000).getUTCDay() === 5 ? 21 : 23) * H;
const inW = (mk, w) => mk >= w[0] && mk <= w[1];
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sdOf = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };

const trOf = (bars, k) => { const x = bars[k], pc = bars[k - 1].close; return Math.max(x.high - x.low, Math.abs(x.high - pc), Math.abs(x.low - pc)); };
export function atr(bars, e, n = ATR_N) { if (e - n + 1 < 1) return null; let s = 0; for (let k = e - n + 1; k <= e; k++) s += trOf(bars, k); return s / n; }
// sample sd of the n log close returns ending at candle i (i included); candles <= i only
export function rv(bars, i, n) {
  if (i - n < 0) return null; const a = [];
  for (let k = i - n + 1; k <= i; k++) a.push(Math.log(bars[k].close / bars[k - 1].close));
  return sdOf(a);
}
export function ratioAt(bars, i) { const a = rv(bars, i, SHORT), b = rv(bars, i, LONG); return a == null || b == null || !(b > 0) ? null : a / b; }
export function sideAt(bars, i) { if (i < TREND) return 0; return Math.sign(bars[i].close - bars[i - TREND].close); }
export function prepare(rows) {
  const bars = Array.isArray(rows[0]) ? foldWeekend(rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }))) : rows;
  return { bars, q: bars.map((_, i) => ratioAt(bars, i)), s: bars.map((_, i) => sideAt(bars, i)) };
}
// one trade on signal candle i: enter at the open of i+1, stop 2 x ATR20(i), out at the close of i+HOLD or at the stop
export function trade(P, i, side, { cost = COST, finMult = 1 } = {}) {
  const { bars } = P, j = i + HOLD;
  if (!side || i < ATR_N || j >= bars.length) return null;
  const a = atr(bars, i); if (!(a > 0)) return null;
  const entry = bars[i + 1].open, risk = ATR_K * a, stop = entry - side * risk, tIn = bars[i + 1].time;
  let exit = bars[j].close, how = 'time', tOut = closeTime(bars[j].time), k0 = j;
  for (let k = i + 1; k <= j; k++) { const x = bars[k];
    if (side > 0 ? x.low <= stop : x.high >= stop) { exit = stopFill(x, side < 0, stop, k > i + 1); how = 'stop'; tOut = closeTime(x.time); k0 = k; break; } }
  const R = side * (exit - entry) / risk, nn = side > 0 ? nights(tIn, tOut) : 0;
  const fin = finMult * nn * FIN.xau.long * entry / risk;
  return { a: dateOf(bars[i].time), b: dateOf(bars[k0].time), out: k0, side, entry, stop, risk, exit, how, R, fin, net: R - cost / risk - fin };
}
export const isSignal = (P, test, i) => { const q = P.q[i], t = TESTS[test]; if (q == null || !P.s[i]) return false; return t.lo != null ? q < t.lo : q > t.hi; };
export function signals(P, test) {
  const out = [];
  for (let i = Math.max(LONG, TREND, ATR_N); i < P.bars.length; i++) {
    const mk = dateOf(P.bars[i].time).slice(0, 7); if (!inW(mk, [IS[0], OOS[1]])) continue;
    if (isSignal(P, test, i)) out.push({ i, dir: P.s[i], mk });
  }
  return out;
}
export function run(P, sigs, opt) {
  const T = []; let busy = -1, skipped = 0, offFile = 0;
  for (const e of sigs) {
    if (e.i + 1 <= busy) { skipped++; continue; }
    const t = trade(P, e.i, e.dir, opt);
    if (!t) { offFile++; continue; }
    T.push({ ...t, mk: e.mk, i: e.i }); busy = t.out;
  }
  return { T, skipped, offFile };
}
// every-day trend trade, overlapping: the reference distribution. Returns the trades and b(side, year) for net and gross.
export function everyDay(P, opt) {
  const D = [];
  for (let i = Math.max(LONG, TREND, ATR_N); i < P.bars.length; i++) {
    const mk = dateOf(P.bars[i].time).slice(0, 7); if (!inW(mk, [IS[0], OOS[1]]) || !P.s[i]) continue;
    const t = trade(P, i, P.s[i], opt); if (t) D.push({ ...t, mk, i });
  }
  const acc = {};
  for (const x of D) { const k = `${x.side}:${x.a.slice(0, 4)}`; (acc[k] ||= { n: 0, net: 0, R: 0 }); acc[k].n++; acc[k].net += x.net; acc[k].R += x.R; }
  const base = Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, { n: v.n, net: v.net / v.n, R: v.R / v.n }]));
  return { D, base };
}
export const withExcess = (T, base) => T.map((x) => { const b = base[`${x.side}:${x.a.slice(0, 4)}`];
  return { ...x, ex: x.net - b.net, exG: x.R - b.R }; });

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
  const o = ps.map((p, i) => [p, i]).sort((x, y) => x[0] - y[0]), out = Array(ps.length); let r0 = 0;
  o.forEach(([p, i], r) => { r0 = Math.max(r0, Math.min(1, (ps.length - r) * p)); out[i] = r0; });
  return out;
}
export function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function monthT(T, key = 'ex') {
  const by = new Map(); for (const x of T) { const k = x.a.slice(0, 7); by.set(k, (by.get(k) || 0) + x[key]); }
  const v = [...by.values()], n = v.length; if (n < 3) return { months: n, t: null, p: null };
  const sd = sdOf(v), t = sd ? mean(v) / (sd / Math.sqrt(n)) : 0;
  return { months: n, t, p: pUpper(t, n - 1) };
}
const r3 = (x) => x == null ? null : +x.toFixed(3), r2 = (x) => x == null ? null : +x.toFixed(2), r4 = (x) => x == null ? null : +x.toFixed(4);
const median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export function summary(T) {
  if (!T.length) return { n: 0 };
  const me = monthT(T, 'ex'), mg = monthT(T, 'exG'), mn = monthT(T, 'net');
  return { n: T.length, ex: r3(mean(T.map((x) => x.ex))), tEx: r2(me.t), p: r4(me.p), months: me.months,
    exGross: r3(mean(T.map((x) => x.exG))), tExGross: r2(mg.t), net: r3(mean(T.map((x) => x.net))), tNet: r2(mn.t), gross: r3(mean(T.map((x) => x.R))),
    win: r2(100 * T.filter((x) => x.net > 0).length / T.length), stops: T.filter((x) => x.how === 'stop').length, total: r2(T.reduce((s, x) => s + x.net, 0)),
    longs: T.filter((x) => x.side > 0).length, medStop: r2(median(T.map((x) => x.risk))), costShare: r4(mean(T.map((x) => COST / x.risk))),
    fin: r3(mean(T.map((x) => x.fin))) };
}
// placebo: each out-of-sample rule trade replaced by the every-day trade of a random candle of the same year
export function placebo(oosT, D, base, seeds = SEEDS, seed = SEED) {
  const byYear = {}; for (const x of D) (byYear[x.a.slice(0, 4)] ||= []).push(x);
  const out = [];
  for (let s = 0; s < seeds; s++) { const rng = mulberry32(seed + s); let sum = 0;
    for (const t of oosT) { const pool = byYear[t.a.slice(0, 4)], x = pool[Math.floor(rng() * pool.length)]; sum += x.net - base[`${x.side}:${x.a.slice(0, 4)}`].net; }
    out.push(sum / oosT.length); }
  return out;
}
// control: the folded candles' relative moves permuted within each calendar year, the path rebuilt, the whole rule run again
export function shuffledPath(bars, rng) {
  const out = [bars[0]], byYear = new Map();
  for (let k = 1; k < bars.length; k++) { const y = dateOf(bars[k].time).slice(0, 4), pc = bars[k - 1].close, x = bars[k];
    if (!byYear.has(y)) byYear.set(y, []); byYear.get(y).push([x.open / pc, x.high / pc, x.low / pc, x.close / pc]); }
  for (const v of byYear.values()) for (let k = v.length - 1; k > 0; k--) { const j = Math.floor(rng() * (k + 1)); [v[k], v[j]] = [v[j], v[k]]; }
  const ptr = new Map();
  for (let k = 1; k < bars.length; k++) { const y = dateOf(bars[k].time).slice(0, 4), n = ptr.get(y) || 0; ptr.set(y, n + 1);
    const [o, h, l, c] = byYear.get(y)[n], pc = out[k - 1].close; out.push({ time: bars[k].time, open: pc * o, high: pc * h, low: pc * l, close: pc * c }); }
  return out;
}
export function oosExcess(P, test) {
  const { base } = everyDay(P), T = withExcess(run(P, signals(P, test)).T, base).filter((x) => inW(x.mk, OOS));
  return T.length ? mean(T.map((x) => x.ex)) : 0;
}
export function control(bars, seeds = SEEDS, seed = SEED + 1000) {
  const out = { T1: [], T2: [] };
  for (let s = 0; s < seeds; s++) { const P = prepare(shuffledPath(bars, mulberry32(seed + s)));
    const { base } = everyDay(P);
    for (const k of Object.keys(TESTS)) { const T = withExcess(run(P, signals(P, k)).T, base).filter((x) => inW(x.mk, OOS)); out[k].push(T.length ? mean(T.map((x) => x.ex)) : 0); } }
  return out;
}

export function study(rows) {
  const P = prepare(rows), E = everyDay(P), E2 = everyDay(P, { cost: 2 * COST, finMult: 2 }), ctl = control(P.bars);
  const out = { data: { first: dateOf(P.bars[0].time), last: dateOf(P.bars.at(-1).time), candles: P.bars.length, fold: 'UTC days, weekends folded into the next weekday (fills.mjs foldWeekend)' },
    rules: { cost: COST, cost2x: 2 * COST, stop: `${ATR_K} x ATR(${ATR_N}) of the signal candle`, hold: `${HOLD} trading days, entry at the next open`,
      ratio: `sd of ${SHORT} / sd of ${LONG} daily log close returns`, side: `sign(close - close ${TREND} candles earlier)`, fin: FIN.xau.long, IS, OOS,
      tests: Object.fromEntries(Object.entries(TESTS).map(([k, v]) => [k, v.what])) },
    baseline: {}, tests: {} };
  for (const [w, W] of [['is', IS], ['oos', OOS]]) for (const sd of [1, -1]) {
    const v = E.D.filter((x) => inW(x.mk, W) && x.side === sd);
    out.baseline[`${w}_${sd > 0 ? 'buy' : 'sell'}`] = { n: v.length, net: r3(mean(v.map((x) => x.net))), gross: r3(mean(v.map((x) => x.R))) };
  }
  const ps = [];
  for (const k of Object.keys(TESTS)) {
    const sig = signals(P, k), A = run(P, sig), A2 = run(P, sig, { cost: 2 * COST, finMult: 2 });
    const T = withExcess(A.T, E.base), T2 = withExcess(A2.T, E2.base), r = { signals: sig.length, skipped: A.skipped, offFile: A.offFile };
    for (const [w, W] of [['is', IS], ['oos', OOS]]) { const f = (x) => inW(x.mk, W), X = T.filter(f), X2 = T2.filter(f);
      r[w] = { ...summary(X), ex2x: r3(mean(X2.map((x) => x.ex))), net2x: r3(mean(X2.map((x) => x.net))),
        bySide: { buy: summary(X.filter((x) => x.side > 0)), sell: summary(X.filter((x) => x.side < 0)) } }; }
    const byYear = {}; for (const x of T) { const y = x.a.slice(0, 4); (byYear[y] ||= []).push(x); }
    r.byYear = Object.fromEntries(Object.entries(byYear).map(([y, v]) => [y, { n: v.length, ex: r3(mean(v.map((x) => x.ex))), net: r3(mean(v.map((x) => x.net))) }]));
    const oosT = T.filter((x) => inW(x.mk, OOS)), pl = placebo(oosT, E.D.filter((x) => inW(x.mk, OOS)), E.base), cl = ctl[k];
    r.placebo = { seeds: SEEDS, beaten: pl.filter((v) => r.oos.ex > v).length, mean: r3(mean(pl)), min: r3(Math.min(...pl)), max: r3(Math.max(...pl)) };
    r.control = { seeds: SEEDS, beaten: cl.filter((v) => r.oos.ex > v).length, mean: r3(mean(cl)), min: r3(Math.min(...cl)), max: r3(Math.max(...cl)) };
    out.tests[k] = r; ps.push(r.oos.p);
  }
  const adj = holm(ps);
  Object.keys(TESTS).forEach((k, i) => { const r = out.tests[k]; r.holm = r4(adj[i]);
    r.checks = { oosExPos: r.oos.ex > 0, oosT2: r.oos.tEx >= 2, holm: adj[i] < 0.05, isSameSign: r.is.ex > 0, cost2x: r.oos.ex2x > 0 && r.oos.net2x > 0,
      placebo: r.placebo.beaten >= BEAT, control: r.control.beaten >= BEAT };
    r.pass = Object.values(r.checks).every(Boolean); });
  out.verdict = out.tests.T1.pass ? 'PASS' : 'FAIL';
  out.passed = Object.keys(TESTS).filter((k) => out.tests[k].pass);
  return out;
}

const NAMES = { oosExPos: 'out-of-sample excess > 0', oosT2: 'out-of-sample month t >= 2', holm: 'Holm p < 0.05', isSameSign: 'in-sample excess > 0',
  cost2x: 'excess and net R > 0 at 2x costs', placebo: '38 of 40 placebos', control: '38 of 40 shuffled-path controls' };
const sg = (v, d = 3) => v == null ? 'n/a' : (v >= 0 ? '+' : '') + v.toFixed(d);
const tt = (v) => v == null ? 'n/a' : v.toFixed(2);
export function verdictLine(res) {
  const T1 = res.tests.T1;
  return `**Verdict: ${res.verdict}, ${res.passed.length} of 2: the trend trade after a 5 / 60-day volatility compression beat the every-day trend trade by ${sg(T1.oos.ex)}R out of sample (n ${T1.oos.n}, month t ${tt(T1.oos.tEx)}), ${sg(T1.is.ex)}R in sample.**`;
}
export function report(res) {
  const L = [], ru = res.rules, d = res.data, T1 = res.tests.T1, T2 = res.tests.T2;
  L.push(`# Result: gold's realised-volatility term structure and its 60-day trend (14 Nov 2026)`, '', verdictLine(res), '');
  L.push('A stand-alone daily rule of its own: no rule or position of the live gold book was read, tested or touched',
    '(docs/owner-decisions.md item 44). Pre-registration: `PREREGISTRATION.md` (pushed alone before any figure). Code: `run.mjs`.',
    'Every figure: `result.json`; this page is written by `run.mjs` from it. Nothing is an edge here; nothing live changed and no',
    'proposal is written.', '');
  L.push('## Data and rule', '',
    `Council-data \`research/daily/xau.json\` (OANDA mid spot gold, UTC daily candles, weekends folded into the next weekday), ${d.first} to`,
    `${d.last}, ${d.candles} trading days. Ratio = ${ru.ratio}; side = ${ru.side}. Entry at the next open, stop ${ru.stop} (a gap`,
    `through it fills at the open), out after ${HOLD} trading days, one position at a time per test, $${ru.cost.toFixed(2)} a round trip and \`FIN\``,
    `financing (${ru.fin} of price a rollover) on buys; 2x costs = $1.20 and twice the financing. Excess = net R minus the mean net R of`,
    'the every-day trend trade of the same side and signal year (overlapping, same rule). Windows by signal month: in sample ' + ru.IS.join(' to '),
    'and out of sample ' + ru.OOS.join(' to ') + '. t on calendar-month sums of excess, one-sided, Holm over the two tests.', '');
  L.push('## The tests (R a trade)', '',
    '| Test | Rule | Window | n | Excess net | Month t | Excess gross | Gross t | Net R | Net t | Gross R | Win % | Stops | Excess at 2x | Net at 2x | Median stop $ | Holm p | Placebo | Control | Pass |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, r] of Object.entries(res.tests)) for (const w of ['is', 'oos']) { const x = r[w];
    L.push(`| ${k} | ${ru.tests[k]} | ${w === 'is' ? 'in sample' : 'out of sample'} | ${x.n} | ${sg(x.ex)} | ${tt(x.tEx)} | ${sg(x.exGross)} | ${tt(x.tExGross)} | ${sg(x.net)} | ${tt(x.tNet)} | ${sg(x.gross)} | ${x.win} | ${x.stops} | ${sg(x.ex2x)} | ${sg(x.net2x)} | ${x.medStop.toFixed(2)} | ` +
      (w === 'oos' ? `${r.holm} | ${r.placebo.beaten} of 40 | ${r.control.beaten} of 40 | ${r.pass ? 'yes' : 'no'} |` : '| | | |')); }
  L.push('', 'Signals skipped because the previous trade of the same test was still open: ' + Object.entries(res.tests).map(([k, r]) => `${k} ${r.skipped}`).join(', ') +
    '; dropped because the exit is not on file: ' + Object.entries(res.tests).map(([k, r]) => `${k} ${r.offFile}`).join(', ') + '.', '');
  L.push('## The every-day baseline (overlapping, reference only)', '', '| Window | Side | n | Net R | Gross R |', '|---|---|---|---|---|');
  for (const [k, v] of Object.entries(res.baseline)) { const [w, s] = k.split('_'); L.push(`| ${w === 'is' ? 'in sample' : 'out of sample'} | ${s} | ${v.n} | ${sg(v.net)} | ${sg(v.gross)} |`); }
  L.push('', '## Checks (all must hold)', '', '| Test | OOS excess > 0 | OOS month t >= 2 | Holm p < 0.05 | in sample > 0 | > 0 at 2x costs | >= 38 of 40 placebos | >= 38 of 40 controls |', '|---|---|---|---|---|---|---|---|');
  for (const [k, r] of Object.entries(res.tests)) { const c = r.checks, y = (b) => b ? 'yes' : 'no';
    L.push(`| ${k} | ${y(c.oosExPos)} | ${y(c.oosT2)} | ${y(c.holm)} | ${y(c.isSameSign)} | ${y(c.cost2x)} | ${y(c.placebo)} | ${y(c.control)} |`); }
  L.push('', '## Placebo and control (40 seeded draws each, out-of-sample mean excess)', '',
    'Placebo: each out-of-sample rule trade replaced by the every-day trend trade of a random candle of the same year. Control: each',
    "year's candles (relative moves) shuffled within the year, the path rebuilt and the whole rule run again: drift and volatility level kept,",
    'the volatility clustering the ratio reads removed.', '',
    '| Test | Rule excess | Placebo mean | min | max | beaten | Control mean | min | max | beaten |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, r] of Object.entries(res.tests)) L.push(`| ${k} | ${sg(r.oos.ex)} | ${sg(r.placebo.mean)} | ${sg(r.placebo.min)} | ${sg(r.placebo.max)} | ${r.placebo.beaten} | ${sg(r.control.mean)} | ${sg(r.control.min)} | ${sg(r.control.max)} | ${r.control.beaten} |`);
  L.push('', '## By side (reported, not judged)', '', '| Test | Window | Side | n | Excess net | Month t | Net R |', '|---|---|---|---|---|---|---|');
  for (const [k, r] of Object.entries(res.tests)) for (const w of ['is', 'oos']) for (const s of ['buy', 'sell']) { const x = r[w].bySide[s];
    L.push(`| ${k} | ${w === 'is' ? 'in sample' : 'out of sample'} | ${s} | ${x.n} | ${x.n ? sg(x.ex) : 'n/a'} | ${x.n ? tt(x.tEx) : 'n/a'} | ${x.n ? sg(x.net) : 'n/a'} |`); }
  L.push('', '## By year (excess net R a trade)', '', '| Year | T1 n | T1 excess | T2 n | T2 excess |', '|---|---|---|---|---|');
  const ys = [...new Set([...Object.keys(T1.byYear), ...Object.keys(T2.byYear)])].sort();
  for (const y of ys) { const a = T1.byYear[y], b = T2.byYear[y]; L.push(`| ${y} | ${a ? a.n : 0} | ${a ? sg(a.ex) : 'n/a'} | ${b ? b.n : 0} | ${b ? sg(b.ex) : 'n/a'} |`); }
  L.push('', '## Reading', '');
  const fails = (r) => Object.entries(r.checks).filter(([, v]) => !v).map(([c]) => NAMES[c]).join(', ');
  L.push(res.verdict === 'PASS'
    ? 'T1 passes every pre-registered check. One study is a lead for the owner to see replicated, not a live rule; nothing live changed.'
    : `Not an edge. T1 fails: ${fails(T1)}. T2 ${T2.pass ? 'passes every check (secondary; the verdict rests on T1 and a secondary pass is not called an edge)' : `fails: ${fails(T2)}`}. ` +
      `Against random days of the same year the compression trades' excess beat ${T1.placebo.beaten} of 40 draws, and against the shuffled paths ${T1.control.beaten} of 40. No proposal; nothing live changed.`, '');
  return L.join('\n');
}

const here = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const raw = execFileSync('git', ['show', 'origin/council-data:research/daily/xau.json'], { maxBuffer: 64e6 }).toString();
  const res = { study: 'gold-rv-term', built: '2026-11-14', ...study(JSON.parse(raw).rows) };
  fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  fs.writeFileSync(path.join(here, 'RESULT.md'), report(res) + '\n');
  console.log(verdictLine(res));
  for (const [k, r] of Object.entries(res.tests)) console.log(k, JSON.stringify({ is: { ...r.is, bySide: undefined }, oos: { ...r.oos, bySide: undefined }, placebo: r.placebo, control: r.control, holm: r.holm, checks: r.checks }));
  console.log(JSON.stringify(res.baseline));
}
