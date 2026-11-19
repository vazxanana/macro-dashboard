// Gold's 10-day momentum split by its 60-day correlation with the S&P 500 (pre-registered 14 Nov 2026, PREREGISTRATION.md,
// commit 63bf5d75b). C = correlation of the 60 latest common daily log returns of gold and the S&P 500 CFD; M = gold's 10-day
// return. T1 trade sign(M) when C < 0 (haven regime, primary), T2 when C >= 0 (risk regime), T3 the month series T1 - T2.
// Entry at the next open, stop 2 x ATR(20), out at the close of the 10th day; $0.60 a trade and long financing; t on
// calendar-month sums, Holm over three, 40 seeded placebos. Paper research only: nothing live reads this file.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

export const P = {
  C_N: 60, RET: 10, ATR_N: 20, MULT: 2, HOLD: 10, SPREAD: 0.30, SLIP: 0.15, SEEDS: 40,
  IS: { from: '2007-01', to: '2016-12' }, OOS: { from: '2017-01', to: '2026-10' },
};
export const DATA_COMMIT = '67bac79eb';
export const PREREG_COMMIT = '63bf5d75b';
const DIR = fileURLToPath(new URL('.', import.meta.url));

export const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export const toBars = (rows) => foldWeekend(rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })));
export function monthsOf(w) {
  const out = []; let [y, m] = w.from.split('-').map(Number);
  const [ty, tm] = w.to.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } }
  return out;
}
export function atr(bars, i, n = P.ATR_N) {
  if (i < n) return null;
  let a = 0;
  for (let j = i - n + 1; j <= i; j++) a += Math.max(bars[j].high - bars[j].low, Math.abs(bars[j].high - bars[j - 1].close), Math.abs(bars[j].low - bars[j - 1].close));
  return a / n;
}
// the common days of gold and the index: for each gold index, its position in the common list (or -1)
export function common(gold, spx) {
  const sc = new Map(spx.map((b) => [b.time, b.close]));
  const list = [], pos = new Array(gold.length).fill(-1);
  gold.forEach((b, i) => { if (sc.has(b.time)) { pos[i] = list.length; list.push({ i, g: b.close, s: sc.get(b.time) }); } });
  return { list, pos };
}
// correlation of the C_N latest common log returns ending at gold day i (reads common closes up to day i only)
export function corrAt(cm, i, n = P.C_N) {
  const k = cm.pos[i]; if (k < n) return null;
  const x = [], y = [];
  for (let j = k - n + 1; j <= k; j++) { x.push(Math.log(cm.list[j].g / cm.list[j - 1].g)); y.push(Math.log(cm.list[j].s / cm.list[j - 1].s)); }
  const mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let q = 0; q < n; q++) { sxy += (x[q] - mx) * (y[q] - my); sxx += (x[q] - mx) ** 2; syy += (y[q] - my) ** 2; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
}
export const mom = (bars, i) => (i >= P.RET ? bars[i].close / bars[i - P.RET].close - 1 : null);
// signal at the close of day i: { regime: 'haven' | 'risk', side, c }; null when M is 0 or C not computable
export function eventAt(bars, cm, i) {
  const c = corrAt(cm, i), m = mom(bars, i);
  if (c == null || m == null || m === 0) return null;
  return { regime: c < 0 ? 'haven' : 'risk', side: Math.sign(m), c };
}

export const TESTS = [
  { id: 'T1', name: 'Haven regime (C < 0): follow the 10-day move (primary)', regimes: ['haven'] },
  { id: 'T2', name: 'Risk regime (C >= 0): follow the 10-day move', regimes: ['risk'] },
  { id: 'T3', name: 'Does the regime matter: month series T1 minus T2', diff: true },
];

// one trade: signal at the close of day i, entry at day i+1's open, out at the close of day i+HOLD or at the stop
export function trade(bars, i, side, { costX = 1 } = {}) {
  const e = i + 1, last = i + P.HOLD; if (last >= bars.length) return null;
  const a = atr(bars, i); if (!a) return null;
  const entry = bars[e].open, dist = P.MULT * a, stop = entry - side * dist;
  let exit = bars[last].close, how = 'time', xi = last, exitTime = bars[last].time + 22 * 3600;
  for (let k = e; k <= last; k++) {
    const b = bars[k];
    if (k > e && (side > 0 ? b.open <= stop : b.open >= stop)) { exit = b.open; how = 'gap'; xi = k; exitTime = b.time; break; }
    if (side > 0 ? b.low <= stop : b.high >= stop) { exit = stop; how = 'stop'; xi = k; exitTime = b.time + 12 * 3600; break; }
  }
  const gross = side * (exit - entry) / dist;
  const costR = costX * (P.SPREAD + 2 * P.SLIP) / dist;
  const n = side > 0 ? nights(bars[e].time, exitTime) : 0;
  const finR = side > 0 ? costX * n * FIN.xau.long * entry / dist : 0;
  return { i, xi, side, day: new Date(bars[i].time * 1000).toISOString().slice(0, 10), exitMonth: ym(bars[xi].time),
    entry, stop, exit, dist, how, gross, costR, finR, nights: n, net: gross - costR - finR };
}
export function events(bars, cm) { const ev = []; for (let i = 0; i < bars.length; i++) { const e = eventAt(bars, cm, i); if (e) ev.push({ i, ...e }); } return ev; }
export function runTest(bars, evs, regimes, opt = {}) {
  const out = []; let free = -1;
  for (const e of evs) {
    if (e.i <= free || !regimes.includes(e.regime)) continue;
    const t = trade(bars, e.i, e.side, opt); if (!t) continue;
    t.regime = e.regime; out.push(t); free = t.xi;
  }
  return out;
}
export function every(bars, side, start) {
  const out = []; let i = start;
  while (i + P.HOLD < bars.length) { const t = trade(bars, i, side); if (t) { out.push(t); i = Math.max(i + P.HOLD, t.xi) + 1; } else i++; }
  return out;
}
export function uncond(bars, start) {
  const out = []; let free = -1;
  for (let i = start; i + P.HOLD < bars.length; i++) {
    if (i <= free) continue;
    const m = mom(bars, i); if (!m) continue;
    const t = trade(bars, i, Math.sign(m)); if (!t) continue;
    out.push(t); free = t.xi;
  }
  return out;
}
// ─── statistics ───
export function monthly(trades, w, f = 'net') {
  const m = new Map(monthsOf(w).map((k) => [k, 0]));
  for (const t of trades) if (m.has(t.exitMonth)) m.set(t.exitMonth, m.get(t.exitMonth) + t[f]);
  return [...m.values()];
}
export function tstat(xs) {
  const n = xs.length; if (n < 2) return { n, mean: 0, t: 0 };
  const mean = xs.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  return { n, mean, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : 0 };
}
function erfc(x) { // Abramowitz-Stegun 7.1.26
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807
    + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}
export const pOne = (t) => 0.5 * erfc(t / Math.SQRT2);
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = Array(ps.length); let run = 0;
  idx.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (ps.length - k) * p)); out[i] = run; });
  return out;
}
export function drawdown(xs) { let c = 0, pk = 0, dd = 0; for (const x of xs) { c += x; pk = Math.max(pk, c); dd = Math.min(dd, c - pk); } return dd; }
const r3 = (x) => Math.round(x * 1000) / 1000, r2 = (x) => Math.round(x * 100) / 100;
const inWin = (t, w) => t.exitMonth >= w.from && t.exitMonth <= w.to;
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const sub = (a, b) => a.map((x, k) => x - b[k]);
export function window(trades, w, trades2x) {
  const inW = trades.filter((t) => inWin(t, w)), n = inW.length;
  const net = monthly(trades, w, 'net'), gross = monthly(trades, w, 'gross'), tn = tstat(net), tg = tstat(gross);
  const per = (f) => (n ? inW.reduce((a, t) => a + t[f], 0) / n : 0);
  const o = { trades: n, buys: inW.filter((t) => t.side > 0).length, months: net.length, won: n ? r3(inW.filter((t) => t.net > 0).length / n) : 0,
    stopped: n ? r3(inW.filter((t) => t.how !== 'time').length / n) : 0, medStop: r2(median(inW.map((t) => t.dist))),
    grossR: r3(per('gross')), netR: r3(per('net')), costR: r3(per('costR')), finR: r3(per('finR')),
    costShare: per('gross') > 0 ? r3((per('costR') + per('finR')) / per('gross')) : null,
    monthGross: r3(tg.mean), monthGrossT: r2(tg.t), monthNet: r3(tn.mean), monthNetT: r2(tn.t),
    totalNet: r2(net.reduce((a, b) => a + b, 0)), worstDD: r2(drawdown(net)) };
  if (trades2x) { const t2 = tstat(monthly(trades2x, w, 'net')); o.x2Net = r3(t2.mean); o.x2T = r2(t2.t); }
  return o;
}
// the difference of two streams' month series
export function diffWindow(a, b, w, a2, b2) {
  const tn = tstat(sub(monthly(a, w, 'net'), monthly(b, w, 'net'))), tg = tstat(sub(monthly(a, w, 'gross'), monthly(b, w, 'gross')));
  const o = { months: monthsOf(w).length, trades: a.filter((t) => inWin(t, w)).length + b.filter((t) => inWin(t, w)).length,
    monthGross: r3(tg.mean), monthGrossT: r2(tg.t), monthNet: r3(tn.mean), monthNetT: r2(tn.t) };
  if (a2) { const t2 = tstat(sub(monthly(a2, w, 'net'), monthly(b2, w, 'net'))); o.x2Net = r3(t2.mean); o.x2T = r2(t2.t); }
  return o;
}

// ─── placebo: each real trade's signal day replaced by a random day whose same-side trade exits in the same window ───
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function pool(bars, side, start) {
  const all = [];
  for (let i = start; i + P.HOLD < bars.length; i++) { const t = trade(bars, i, side); if (t) all.push(t); }
  return { is: all.filter((t) => inWin(t, P.IS)), oos: all.filter((t) => inWin(t, P.OOS)) };
}
export function placebo(real, pools, seed) {
  const rng = mulberry32(seed), out = [];
  for (const t of real) {
    const pl = pools[t.side], src = inWin(t, P.OOS) ? pl.oos : inWin(t, P.IS) ? pl.is : null;
    if (src && src.length) out.push(src[Math.floor(rng() * src.length)]);
  }
  return out;
}

function placeboStats(pl) {
  pl.sort((a, b) => a - b);
  const q = (p) => r2(pl[Math.min(pl.length - 1, Math.floor(p * pl.length))]);
  return (real) => ({ p5: q(0.05), p50: q(0.5), p95: q(0.95), max: r2(pl.at(-1)), below: pl.filter((x) => x < real).length });
}
function yearsOf(tr) {
  const years = {};
  for (const t of tr) { if (t.exitMonth > P.OOS.to || t.exitMonth < P.IS.from) continue; const y = t.exitMonth.slice(0, 4); years[y] = years[y] || { n: 0, gross: 0, net: 0 }; years[y].n++; years[y].gross += t.gross; years[y].net += t.net; }
  for (const y in years) { years[y].gross = r2(years[y].gross); years[y].net = r2(years[y].net); }
  return years;
}

export function study(bars, spx) {
  const cm = common(bars, spx), evs = events(bars, cm);
  const start = Math.max(P.C_N, P.RET, P.ATR_N) + 1;
  const pools = { 1: pool(bars, 1, start), '-1': pool(bars, -1, start) };
  const share = (w) => { const inW = evs.filter((e) => { const m = ym(bars[e.i].time); return m >= w.from && m <= w.to; }); const h = inW.filter((e) => e.regime === 'haven').length; return { days: inW.length, haven: h, risk: inW.length - h, havenShare: r3(inW.length ? h / inW.length : 0) }; };
  const evCount = { is: share(P.IS), oos: share(P.OOS) };
  const tr = {}, tr2 = {};
  for (const T of TESTS.filter((x) => !x.diff)) { tr[T.id] = runTest(bars, evs, T.regimes); tr2[T.id] = runTest(bars, evs, T.regimes, { costX: 2 }); }
  const tests = TESTS.map((T) => {
    if (T.diff) {
      const is = diffWindow(tr.T1, tr.T2, P.IS), oos = diffWindow(tr.T1, tr.T2, P.OOS, tr2.T1, tr2.T2);
      const real2 = monthly(tr.T2, P.OOS), pl = [];
      for (let s = 1; s <= P.SEEDS; s++) pl.push(tstat(sub(monthly(placebo(tr.T1, pools, s), P.OOS), real2)).t);
      return { id: T.id, name: T.name, is, oos, pOne: pOne(oos.monthNetT), placebo: placeboStats(pl)(oos.monthNetT) };
    }
    const t1 = tr[T.id], is = window(t1, P.IS), oos = window(t1, P.OOS, tr2[T.id]), pl = [];
    for (let s = 1; s <= P.SEEDS; s++) pl.push(tstat(monthly(placebo(t1, pools, s), P.OOS)).t);
    return { id: T.id, name: T.name, is, oos, pOne: pOne(oos.monthNetT), placebo: placeboStats(pl)(oos.monthNetT), years: yearsOf(t1),
      trades: t1.filter((t) => t.exitMonth >= P.IS.from && t.exitMonth <= P.OOS.to).map((t) => ({ day: t.day, side: t.side, exitMonth: t.exitMonth, how: t.how, stop: r2(t.dist), gross: r3(t.gross), net: r3(t.net) })) };
  });
  const hp = holm(tests.map((t) => t.pOne));
  tests.forEach((t, k) => {
    t.holmP = r3(hp[k]); t.pOne = r3(t.pOne);
    t.checks = { oosPositive: t.oos.monthNet > 0, oosT2: t.oos.monthNetT >= 2, holm05: hp[k] < 0.05, isSameSign: t.is.monthNet > 0,
      x2Positive: t.oos.x2Net > 0, abovePlacebo95: t.placebo.below > 38 };
    t.pass = Object.values(t.checks).every(Boolean);
  });
  const eL = every(bars, 1, start), eS = every(bars, -1, start), uM = uncond(bars, start);
  const ws = (x) => ({ is: window(x, P.IS), oos: window(x, P.OOS) });
  const baseline = { long: ws(eL), short: ws(eS), momentum: ws(uM) };
  return { days: bars.length, commonDays: cm.list.length, firstDay: new Date(bars[0].time * 1000).toISOString().slice(0, 10), lastDay: new Date(bars.at(-1).time * 1000).toISOString().slice(0, 10), events: evCount, tests, baseline };
}

const s = (x, d = 3) => (x >= 0 ? '+' : '') + x.toFixed(d);
export function verdictLine(res) {
  const [T1, T2] = res.tests;
  return `${T1.pass ? 'PASS' : 'FAIL'}, ${res.tests.filter((t) => t.pass).length} of 3: haven-regime gold momentum made ${s(T1.oos.netR)}R a trade net 2017-26 (n ${T1.oos.trades}, month t ${s(T1.oos.monthNetT, 2)}), ${s(T1.is.netR)}R in 2007-16; the risk regime ${s(T2.oos.netR)}R (t ${s(T2.oos.monthNetT, 2)})`;
}

function fmt(x) { return (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(3); }
function fmtT(x) { return (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(2); }
export function report(res) {
  const L = [];
  L.push('# Gold\'s 10-day momentum split by its correlation with the S&P 500: result (14 Nov 2026)', '');
  L.push(`**Verdict: ${verdictLine(res)}.**`, '');
  L.push(`Paper research only. No live rule, size, filter, council member or page changed. Rule, costs, windows, the three tests and the placebo were fixed in \`PREREGISTRATION.md\`, pushed alone (${PREREG_COMMIT}) before any trade was simulated. Data: council-data \`research/daily/xau.json\` and \`spx500.json\` at \`${DATA_COMMIT}\`, OANDA mid daily candles, weekend stubs folded into the next weekday; ${res.days} gold days from ${res.firstDay} to ${res.lastDay}, ${res.commonDays} of them with an S&P 500 candle. Signal days: 2007-16 ${res.events.is.days}, ${(res.events.is.havenShare * 100).toFixed(1)} % in the haven regime (C < 0); 2017-26 ${res.events.oos.days}, ${(res.events.oos.havenShare * 100).toFixed(1)} % haven. One position at a time per test. A stand-alone rule, not a gate, exit, entry or size of the gold book, and none of its 2006-17 positions is read (owner decision 44); not an edge without n and t.`, '');
  L.push('## The three tests (R a trade, 1R = the stop distance, 2 x ATR(20), ten days held; monthly sums of net R on every calendar month of the window, by exit month)', '');
  L.push('| Test | Window | Trades (buys) | Won | Stopped | Median stop $ | Gross R | Net R | Cost share | Month net (t) | Month gross t | Total net R | Worst DD R | OOS at 2x costs (t) | One-sided p | Holm p | Pass |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  const row = (w, lab, last, t) => w.netR === undefined
    ? `| ${lab} | ${last ? 'OOS 2017-01 to 2026-10' : 'IS 2007-01 to 2016-12'} | ${w.trades} | | | | | | | ${fmt(w.monthNet)} (${fmtT(w.monthNetT)}) | ${fmtT(w.monthGrossT)} | | | ${last && t ? `${fmt(w.x2Net)} (${fmtT(w.x2T)})` : ''} | ${last && t ? t.pOne.toFixed(3) : ''} | ${last && t ? t.holmP.toFixed(3) : ''} | ${last && t ? (t.pass ? 'yes' : 'no') : ''} |`
    : `| ${lab} | ${last ? 'OOS 2017-01 to 2026-10' : 'IS 2007-01 to 2016-12'} | ${w.trades} (${w.buys}) | ${(w.won * 100).toFixed(0)}% | ${(w.stopped * 100).toFixed(0)}% | ${w.medStop.toFixed(2)} | ${fmt(w.grossR)} | ${fmt(w.netR)} | ${w.costShare == null ? 'n/a (gross ≤ 0)' : (w.costShare * 100).toFixed(0) + '%'} | ${fmt(w.monthNet)} (${fmtT(w.monthNetT)}) | ${fmtT(w.monthGrossT)} | ${fmtT(w.totalNet)} | ${fmtT(w.worstDD)} | ${last && t ? `${fmt(w.x2Net)} (${fmtT(w.x2T)})` : ''} | ${last && t ? t.pOne.toFixed(3) : ''} | ${last && t ? t.holmP.toFixed(3) : ''} | ${last && t ? (t.pass ? 'yes' : 'no') : ''} |`;
  for (const t of res.tests) L.push(row(t.is, `${t.id} ${t.name}`, false, t), row(t.oos, '', true, t));
  for (const [k, lab] of [['momentum', 'Unconditional 10-day momentum (comparison, not a test)'], ['long', 'Long every 10th day (same-side baseline, not a test)'], ['short', 'Short every 10th day (same-side baseline, not a test)']]) L.push(row(res.baseline[k].is, lab, false), row(res.baseline[k].oos, '', true));
  L.push('', 'Pass bar (pre-registered, each test on its own, Holm over three; the verdict follows T1): OOS net month mean > 0 with t >= 2 and Holm p < 0.05, the in-sample mean > 0, the OOS mean > 0 at 2x costs and financing, the OOS t above the placebo\'s 95th percentile. T3 is the month series of T1 minus T2; its placebo is each T1 placebo minus the real T2 series.', '');
  L.push('| Check | ' + res.tests.map((t) => t.id).join(' | ') + ' |', '|---|' + res.tests.map(() => '---').join('|') + '|');
  for (const k of Object.keys(res.tests[0].checks)) L.push(`| ${k} | ` + res.tests.map((t) => (t.checks[k] ? 'yes' : 'no')).join(' | ') + ' |');
  L.push('', '## Placebo (40 seeds: each real trade\'s signal day replaced by a random day whose trade, same side, hold and stop rule, exits in the same window; OOS net month t)', '');
  L.push('| Test | p5 | p50 | p95 | max | Real | Seeds below the real |', '|---|---|---|---|---|---|---|');
  for (const t of res.tests) L.push(`| ${t.id} | ${fmtT(t.placebo.p5)} | ${fmtT(t.placebo.p50)} | ${fmtT(t.placebo.p95)} | ${fmtT(t.placebo.max)} | ${fmtT(t.oos.monthNetT)} | ${t.placebo.below} of 40 |`);
  L.push('', '## Per year (sum of net R by exit year)', '');
  const tt = res.tests.filter((t) => t.years), ys = [...new Set(tt.flatMap((t) => Object.keys(t.years)))].sort();
  L.push('| Year | ' + tt.map((t) => `${t.id} n | ${t.id} net`).join(' | ') + ' |', '|---|' + tt.map(() => '---|---').join('|') + '|');
  for (const y of ys) L.push(`| ${y} | ` + tt.map((t) => (t.years[y] ? `${t.years[y].n} | ${fmtT(t.years[y].net)}` : '0 | 0')).join(' | ') + ' |');
  L.push('', '## Reading', '');
  return L;
}

// written after the run; the figures it quotes are checked against result.json by tests/gold-equity-corr-momentum.test.mjs
export const READING = [
  '- **Haven-regime momentum (T1) does nothing.** Out of sample it made −0.059R a trade net (n 131, month t −0.61; −0.001R gross), in sample −0.021R (n 125, month t −0.24; +0.022R gross), and only 7 of 40 placebo seeds (random same-side days) sit below it. With a median stop of $34.03 out of sample, spread and slippage cost 0.018R and financing 0.041R a trade: there is no gross return for the costs to take.',
  '- **The regime does not tell persistent moves from the rest.** The risk regime (T2) made +0.017R net out of sample (n 159, t +0.21) and −0.043R in sample; the difference T1 minus T2 is −0.089R a month out of sample (t −0.60). If anything the haven regime is the worse one for following gold\'s 10-day move.',
  '- **Against the baselines.** Unconditional 10-day momentum on every day made −0.007R out of sample (n 268, t −0.11). The same-side baselines show the drift the test is built to separate: long every 10th day +0.111R out of sample (n 233, t +1.64), short every 10th day −0.156R (n 231, t −2.79). T1\'s buys and sells together do no better than a coin-flip side on the same days.',
  '- Nothing proposed. Not an edge, not a gate on the gold book; nothing live changed.',
];

export function load(key, file) {
  const txt = file ? fs.readFileSync(file, 'utf8') : execFileSync('git', ['show', `${DATA_COMMIT}:research/daily/${key}.json`], { encoding: 'utf8', maxBuffer: 64e6 });
  return toBars(JSON.parse(txt).rows);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const bars = load('xau', process.argv[2]), spx = load('spx500', process.argv[3]);
  const res = study(bars, spx);
  const out = { study: 'gold-equity-corr-momentum', built: '2026-11-14', dataCommit: DATA_COMMIT, preregCommit: PREREG_COMMIT, params: P, fin: FIN.xau.long,
    verdict: res.tests[0].pass ? 'PASS' : 'FAIL', headline: verdictLine(res), ...res };
  fs.writeFileSync(DIR + 'result.json', JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(DIR + 'RESULT.md', [...report(res), ...READING].join('\n') + '\n');
  console.log(verdictLine(res), verdictLine(res).length);
  console.log('events', res.events);
  for (const t of res.tests) console.log(t.id, JSON.stringify(t.is), '\n  ', JSON.stringify(t.oos), t.holmP, JSON.stringify(t.placebo));
  for (const k in res.baseline) console.log('BL', k, JSON.stringify(res.baseline[k]));
}
