// Gold's autocorrelation regime switching 5-day momentum and 5-day reversal (pre-registered 14 Nov 2026, PREREGISTRATION.md,
// commit 9aeba8af3): AC = lag-1 autocorrelation of the 60 latest daily log returns; AC > 0 follow the 5-day move, AC < 0 fade
// it. T1 the switch (primary, both sides), T2 the momentum leg alone, T3 the reversal leg alone; entry at the next open, stop
// 2 x ATR(20), out at the close of the 5th day; $0.60 a trade and long financing; t on calendar-month sums, Holm over three,
// 40 seeded random placebos. Paper research only: nothing live reads this file.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

export const P = {
  AC_N: 60, RET: 5, ATR_N: 20, MULT: 2, HOLD: 5, SPREAD: 0.30, SLIP: 0.15, SEEDS: 40,
  IS: { from: '2007-01', to: '2016-12' }, OOS: { from: '2017-01', to: '2026-10' },
};
export const DATA_COMMIT = 'f6288251e';
export const PREREG_COMMIT = '9aeba8af3';
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
const lr = (bars, j) => Math.log(bars[j].close / bars[j - 1].close);
// lag-1 autocorrelation of the AC_N returns ending at i, each against the one before it (reads closes i-AC_N-1 .. i)
export function acAt(bars, i, n = P.AC_N) {
  if (i < n + 1) return null;
  const x = [], y = [];
  for (let j = i - n + 1; j <= i; j++) { x.push(lr(bars, j - 1)); y.push(lr(bars, j)); }
  const mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let k = 0; k < n; k++) { sxy += (x[k] - mx) * (y[k] - my); sxx += (x[k] - mx) ** 2; syy += (y[k] - my) ** 2; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
}
export const m5 = (bars, i) => (i >= P.RET ? bars[i].close / bars[i - P.RET].close - 1 : null);
// signal at the close of day i: { regime: 'mom' | 'rev', side }; null when AC or M5 is 0 or not computable
export function eventAt(bars, i) {
  const ac = acAt(bars, i), m = m5(bars, i);
  if (ac == null || m == null || ac === 0 || m === 0) return null;
  const dir = Math.sign(m);
  return ac > 0 ? { regime: 'mom', side: dir, ac } : { regime: 'rev', side: -dir, ac };
}

export const TESTS = [
  { id: 'T1', name: 'The switch: follow the 5-day move when AC > 0, fade it when AC < 0 (primary)', regimes: ['mom', 'rev'] },
  { id: 'T2', name: 'Momentum leg alone (AC > 0)', regimes: ['mom'] },
  { id: 'T3', name: 'Reversal leg alone (AC < 0)', regimes: ['rev'] },
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
export function events(bars) { const ev = []; for (let i = 0; i < bars.length; i++) { const e = eventAt(bars, i); if (e) ev.push({ i, ...e }); } return ev; }
export function runTest(bars, evs, T, opt = {}) {
  const out = []; let free = -1;
  for (const e of evs) {
    if (e.i <= free) continue;
    if (!T.regimes.includes(e.regime)) continue;
    const t = trade(bars, e.i, e.side, opt); if (!t) continue;
    t.regime = e.regime;
    out.push(t); free = t.xi;
  }
  return out;
}
// comparisons: a fixed side, or the unconditional 5-day momentum (k = 1) / reversal (k = -1) every day, one at a time
export function every(bars, side, start) {
  const out = []; let i = start;
  while (i + P.HOLD < bars.length) { const t = trade(bars, i, side); if (t) { out.push(t); i = Math.max(i + P.HOLD, t.xi) + 1; } else i++; }
  return out;
}
export function uncond(bars, k, start) {
  const out = []; let free = -1;
  for (let i = start; i + P.HOLD < bars.length; i++) {
    if (i <= free) continue;
    const m = m5(bars, i); if (!m) continue;
    const t = trade(bars, i, k * Math.sign(m)); if (!t) continue;
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
export function window(trades, w, trades2x) {
  const inW = trades.filter((t) => inWin(t, w)), n = inW.length;
  const net = monthly(trades, w, 'net'), gross = monthly(trades, w, 'gross'), tn = tstat(net), tg = tstat(gross);
  const per = (f) => (n ? inW.reduce((a, t) => a + t[f], 0) / n : 0);
  const o = { trades: n, buys: inW.filter((t) => t.side > 0).length, months: net.length, won: n ? r3(inW.filter((t) => t.net > 0).length / n) : 0,
    stopped: n ? r3(inW.filter((t) => t.how !== 'time').length / n) : 0, medStop: r2(median(inW.map((t) => t.dist))),
    grossR: r3(per('gross')), netR: r3(per('net')), costR: r3(per('costR')), finR: r3(per('finR')),
    monthGross: r3(tg.mean), monthGrossT: r2(tg.t), monthNet: r3(tn.mean), monthNetT: r2(tn.t),
    totalNet: r2(net.reduce((a, b) => a + b, 0)), worstDD: r2(drawdown(net)) };
  if (trades2x) { const t2 = tstat(monthly(trades2x, w, 'net')); o.x2Net = r3(t2.mean); o.x2T = r2(t2.t); }
  return o;
}

// ─── placebo: each real trade's signal day replaced by a random day whose same-side trade exits in the same window ───
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function pool(bars, side) {
  const all = [];
  for (let i = P.AC_N + 1; i + P.HOLD < bars.length; i++) { const t = trade(bars, i, side); if (t) all.push(t); }
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

export function study(bars) {
  const evs = events(bars), pools = { 1: pool(bars, 1), '-1': pool(bars, -1) };
  const inRange = (i) => { const m = ym(bars[i].time); return m >= P.IS.from && m <= P.OOS.to; };
  const share = (w) => { const inW = evs.filter((e) => { const m = ym(bars[e.i].time); return m >= w.from && m <= w.to; }); const mom = inW.filter((e) => e.regime === 'mom').length; return { days: inW.length, mom, rev: inW.length - mom, momShare: r3(inW.length ? mom / inW.length : 0) }; };
  const evCount = { is: share(P.IS), oos: share(P.OOS) };
  const tests = TESTS.map((T) => {
    const tr = runTest(bars, evs, T), tr2 = runTest(bars, evs, T, { costX: 2 });
    const is = window(tr, P.IS), oos = window(tr, P.OOS, tr2);
    const pl = [];
    for (let s = 1; s <= P.SEEDS; s++) pl.push(tstat(monthly(placebo(tr, pools, s), P.OOS)).t);
    pl.sort((a, b) => a - b);
    const q = (p) => r2(pl[Math.min(pl.length - 1, Math.floor(p * pl.length))]);
    const years = {};
    for (const t of tr) { if (t.exitMonth > P.OOS.to || t.exitMonth < P.IS.from) continue; const y = t.exitMonth.slice(0, 4); years[y] = years[y] || { n: 0, gross: 0, net: 0 }; years[y].n++; years[y].gross += t.gross; years[y].net += t.net; }
    for (const y in years) { years[y].gross = r2(years[y].gross); years[y].net = r2(years[y].net); }
    return { id: T.id, name: T.name, side: T.side, is, oos, pOne: pOne(oos.monthNetT),
      placebo: { p5: q(0.05), p50: q(0.5), p95: q(0.95), max: r2(pl.at(-1)), below: pl.filter((x) => x < oos.monthNetT).length },
      years, trades: tr.filter((t) => t.exitMonth >= P.IS.from && t.exitMonth <= P.OOS.to).map((t) => ({ day: t.day, side: t.side, exitMonth: t.exitMonth, how: t.how, stop: r2(t.dist), gross: r3(t.gross), net: r3(t.net) })) };
  });
  const hp = holm(tests.map((t) => t.pOne));
  tests.forEach((t, k) => {
    t.holmP = r3(hp[k]); t.pOne = r3(t.pOne);
    t.checks = { oosPositive: t.oos.monthNet > 0, oosT2: t.oos.monthNetT >= 2, holm05: hp[k] < 0.05, isSameSign: t.is.monthNet > 0,
      x2Positive: t.oos.x2Net > 0, abovePlacebo95: t.placebo.below > 38 };
    t.pass = Object.values(t.checks).every(Boolean);
  });
  const start = P.AC_N + 1, eL = every(bars, 1, start), eS = every(bars, -1, start), uM = uncond(bars, 1, start), uR = uncond(bars, -1, start);
  const ws = (tr) => ({ is: window(tr, P.IS), oos: window(tr, P.OOS) });
  const baseline = { long: ws(eL), short: ws(eS), momentum: ws(uM), reversal: ws(uR) };
  return { days: bars.length, firstDay: new Date(bars[0].time * 1000).toISOString().slice(0, 10), lastDay: new Date(bars.at(-1).time * 1000).toISOString().slice(0, 10), events: evCount, tests, baseline };
}

const s = (x) => (x >= 0 ? '+' : '') + x;
export function verdictLine(res) {
  const [T1, T2, T3] = res.tests, pass = T1.pass;
  return `${pass ? 'PASS' : 'FAIL'}, ${res.tests.filter((t) => t.pass).length} of 3: the autocorrelation switch made ${s(T1.oos.netR)}R a trade net 2017-26 (n ${T1.oos.trades}, month t ${T1.oos.monthNetT.toFixed(2)}) and ${s(T1.is.netR)}R in 2007-16 (t ${T1.is.monthNetT.toFixed(2)}); the momentum leg ${s(T2.oos.netR)}R (t ${T2.oos.monthNetT.toFixed(2)})`;
}

function fmt(x) { return (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(3); }
function fmtT(x) { return (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(2); }
export function report(res) {
  const L = [];
  L.push('# Gold\'s autocorrelation regime switching 5-day momentum and reversal: result (14 Nov 2026)', '');
  L.push(`**Verdict: ${verdictLine(res)}.**`, '');
  L.push(`Paper research only. No live rule, size, filter, council member or page changed. Rule, costs, windows, the three tests and the placebo were fixed in \`PREREGISTRATION.md\`, pushed alone (${PREREG_COMMIT}) before any trade was simulated. Data: council-data \`research/daily/xau.json\` at \`${DATA_COMMIT}\`, OANDA mid daily candles, weekend stubs folded into the next weekday; ${res.days} trading days from ${res.firstDay} to ${res.lastDay}. Signal days (AC and M5 both non-zero): 2007-16 ${res.events.is.days}, of which ${(res.events.is.momShare * 100).toFixed(1)} % in the momentum regime (AC > 0); 2017-26 ${res.events.oos.days}, ${(res.events.oos.momShare * 100).toFixed(1)} % momentum. One position at a time per test. A stand-alone rule, not a gate, exit, entry or size of the gold book, and none of its 2006-17 positions is read (owner decision 44); not an edge without n and t.`, '');
  L.push('## The three tests (R a trade, 1R = the stop distance, 2 x ATR(20), five days held; monthly sums of net R on every calendar month of the window, by exit month)', '');
  L.push('| Test | Window | Trades (buys) | Won | Stopped | Median stop $ | Gross R | Net R | Month net (t) | Month gross t | Total net R | Worst DD R | OOS at 2x costs (t) | One-sided p | Holm p | Pass |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  const row = (w, lab, last, t) => `| ${lab} | ${last ? 'OOS 2017-01 to 2026-10' : 'IS 2007-01 to 2016-12'} | ${w.trades} (${w.buys}) | ${(w.won * 100).toFixed(0)}% | ${(w.stopped * 100).toFixed(0)}% | ${w.medStop.toFixed(2)} | ${fmt(w.grossR)} | ${fmt(w.netR)} | ${fmt(w.monthNet)} (${fmtT(w.monthNetT)}) | ${fmtT(w.monthGrossT)} | ${fmtT(w.totalNet)} | ${fmtT(w.worstDD)} | ${last && t ? `${fmt(w.x2Net)} (${fmtT(w.x2T)})` : ''} | ${last && t ? t.pOne.toFixed(3) : ''} | ${last && t ? t.holmP.toFixed(3) : ''} | ${last && t ? (t.pass ? 'yes' : 'no') : ''} |`;
  for (const t of res.tests) L.push(row(t.is, `${t.id} ${t.name}`, false, t), row(t.oos, '', true, t));
  for (const [k, lab] of [['momentum', 'Unconditional 5-day momentum (comparison, not a test)'], ['reversal', 'Unconditional 5-day reversal (comparison, not a test)'], ['long', 'Long every 5th day (baseline, not a test)'], ['short', 'Short every 5th day (baseline, not a test)']]) L.push(row(res.baseline[k].is, lab, false), row(res.baseline[k].oos, '', true));
  L.push('', 'Pass bar (pre-registered, each test on its own, Holm over three; the verdict follows T1): OOS net month mean > 0 with t >= 2 and Holm p < 0.05, the in-sample mean > 0, the OOS mean > 0 at 2x costs and financing, the OOS t above the placebo\'s 95th percentile.', '');
  L.push('| Check | ' + res.tests.map((t) => t.id).join(' | ') + ' |', '|---|' + res.tests.map(() => '---').join('|') + '|');
  for (const k of Object.keys(res.tests[0].checks)) L.push(`| ${k} | ` + res.tests.map((t) => (t.checks[k] ? 'yes' : 'no')).join(' | ') + ' |');
  L.push('', '## Placebo (40 seeds: each real trade\'s signal day replaced by a random day whose trade, same side, hold and stop rule, exits in the same window; OOS net month t)', '');
  L.push('| Test | p5 | p50 | p95 | max | Real | Seeds below the real |', '|---|---|---|---|---|---|---|');
  for (const t of res.tests) L.push(`| ${t.id} | ${fmtT(t.placebo.p5)} | ${fmtT(t.placebo.p50)} | ${fmtT(t.placebo.p95)} | ${fmtT(t.placebo.max)} | ${fmtT(t.oos.monthNetT)} | ${t.placebo.below} of 40 |`);
  L.push('', '## Per year (sum of net R by exit year)', '');
  const ys = [...new Set(res.tests.flatMap((t) => Object.keys(t.years)))].sort();
  L.push('| Year | ' + res.tests.map((t) => `${t.id} n | ${t.id} net`).join(' | ') + ' |', '|---|' + res.tests.map(() => '---|---').join('|') + '|');
  for (const y of ys) L.push(`| ${y} | ` + res.tests.map((t) => (t.years[y] ? `${t.years[y].n} | ${fmtT(t.years[y].net)}` : '0 | 0')).join(' | ') + ' |');
  L.push('', '## Reading', '');
  return L;
}

// written after the run; the figures it quotes are checked against result.json by tests/gold-autocorr-switch.test.mjs
export const READING = [
  '- **The switch (T1) does nothing.** Out of sample it made −0.015R a trade net (n 441, month t −0.43; +0.016R gross), in sample −0.007R (n 454, month t −0.22), and 19 of 40 placebo seeds sit below it. Costs are small (0.014R spread and slippage, 0.017R financing a trade out of sample, a median stop near $48): the failure is the signal.',
  '- **The autocorrelation sign does not tell momentum days from reversal days.** The momentum leg alone (T2) made +0.116R net out of sample (n 204, t 1.92; Holm p 0.082) and +0.053R in sample (n 225, t 1.00): close to the bar, but unconditional 5-day momentum on every day, with no regime read, made +0.075R out of sample (n 438, t 2.23) and +0.008R in sample (n 452, t 0.22). The reversal leg (T3) lost −0.074R out of sample (n 272, t −1.61) and −0.067R in sample, like unconditional reversal (−0.119R out of sample, n 456, t −3.35). Gold\'s 5-day move tends to continue whatever the 60-day autocorrelation says; fading it loses in both regimes.',
  '- The unconditional momentum comparison is not a test of this study and was not pre-registered as one (it fails the in-sample sign by itself: t 0.22 in 2007-16); it also leans on gold\'s rise (long every 5th day +0.082R out of sample, n 426, t 2.12). Nothing is proposed from it.',
  '- Nothing proposed. Not an edge, not a gate on the gold book; nothing live changed.',
];

export function load(file) {
  const txt = file ? fs.readFileSync(file, 'utf8') : execFileSync('git', ['show', `${DATA_COMMIT}:research/daily/xau.json`], { encoding: 'utf8', maxBuffer: 64e6 });
  return toBars(JSON.parse(txt).rows);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const bars = load(process.argv[2]);
  const res = study(bars);
  const out = { study: 'gold-autocorr-switch', built: '2026-11-14', dataCommit: DATA_COMMIT, preregCommit: PREREG_COMMIT, params: P, fin: FIN.xau.long,
    verdict: res.tests[0].pass ? 'PASS' : 'FAIL', headline: verdictLine(res), ...res };
  fs.writeFileSync(DIR + 'result.json', JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(DIR + 'RESULT.md', [...report(res), ...READING].join('\n') + '\n');
  console.log(verdictLine(res), verdictLine(res).length);
  console.log('events', res.events);
  for (const t of res.tests) console.log(t.id, JSON.stringify(t.is), '\n  ', JSON.stringify(t.oos), t.holmP, JSON.stringify(t.placebo));
  for (const k in res.baseline) console.log('BL', k, JSON.stringify(res.baseline[k]));
}
