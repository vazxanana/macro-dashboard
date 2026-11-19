// Gold in the month after a washout month (pre-registered 14 Nov 2026, PREREGISTRATION.md, commit 9c052f4e3).
// A calendar month that closes in the bottom tenth of its range (T1, primary, long), the worst monthly return of the past
// year (T2, long), a month closing in the top tenth (T3, short). A daily entry on every trading day of the NEXT month, stop
// 3 x ATR(20) of the day before, out at the close of the 10th day; $0.60 a trade and long financing; each trade also judged
// against the same-side trade on every day of the same year; t on calendar-month sums, Holm over three, 40 seeded random-month
// placebos. Paper research only: nothing live reads this file.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

export const P = {
  LO: 0.10, HI: 0.90, LOOKM: 12, ATR_N: 20, MULT: 3, HOLD: 10, SPREAD: 0.30, SLIP: 0.15, SEEDS: 40,
  IS: { from: '2007-01', to: '2016-12' }, OOS: { from: '2017-01', to: '2026-10' },
};
export const DATA_COMMIT = 'c721916f3';
export const PREREG_COMMIT = '9c052f4e3';
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
// calendar months from daily bars: { k, first, last (bar indices), o, h, l, c }
export function months(bars) {
  const M = [];
  bars.forEach((b, i) => {
    const k = ym(b.time); let m = M[M.length - 1];
    if (!m || m.k !== k) M.push(m = { k, first: i, last: i, o: b.open, h: b.high, l: b.low, c: b.close });
    m.h = Math.max(m.h, b.high); m.l = Math.min(m.l, b.low); m.c = b.close; m.last = i;
  });
  return M;
}
export const clv = (m) => (m.h > m.l ? (m.c - m.l) / (m.h - m.l) : 0.5);
// the signal of month index i reads months <= i only; it is acted on in month i+1
export function signals(M, i) {
  const m = M[i], c = clv(m), out = [];
  if (c <= P.LO) out.push('wash');
  if (c >= P.HI) out.push('top');
  if (i >= P.LOOKM) {
    const r = (k) => M[k].c / M[k - 1].c - 1, x = r(i); let worst = true;
    for (let j = 1; j < P.LOOKM; j++) if (!(x < r(i - j))) { worst = false; break; }
    if (worst) out.push('worst');
  }
  return out;
}

export const TESTS = [
  { id: 'T1', name: 'Long after a washout month (close in the bottom tenth of its range) (primary)', ev: 'wash', side: 1 },
  { id: 'T2', name: 'Long after the worst month of the past year', ev: 'worst', side: 1 },
  { id: 'T3', name: 'Short after a month closing in the top tenth of its range', ev: 'top', side: -1 },
];

// one trade: entry at day d's open, stop 3 x ATR(20) at day d-1, out at the close of day d+HOLD-1 or at the stop
export function trade(bars, d, side, { costX = 1 } = {}) {
  const last = d + P.HOLD - 1; if (last >= bars.length || d < 1) return null;
  const a = atr(bars, d - 1); if (!a) return null;
  const entry = bars[d].open, dist = P.MULT * a, stop = entry - side * dist;
  let exit = bars[last].close, how = 'time', xi = last, exitTime = bars[last].time + 22 * 3600;
  for (let k = d; k <= last; k++) {
    const b = bars[k];
    if (k > d && (side > 0 ? b.open <= stop : b.open >= stop)) { exit = b.open; how = 'gap'; xi = k; exitTime = b.time; break; }
    if (side > 0 ? b.low <= stop : b.high >= stop) { exit = stop; how = 'stop'; xi = k; exitTime = b.time + 12 * 3600; break; }
  }
  const gross = side * (exit - entry) / dist;
  const costR = costX * (P.SPREAD + 2 * P.SLIP) / dist;
  const n = side > 0 ? nights(bars[d].time, exitTime) : 0;
  const finR = side > 0 ? costX * n * FIN.xau.long * entry / dist : 0;
  return { d, xi, side, day: new Date(bars[d].time * 1000).toISOString().slice(0, 10), entryMonth: ym(bars[d].time), exitMonth: ym(bars[xi].time),
    entry, stop, exit, dist, how, gross, costR, finR, nights: n, net: gross - costR - finR };
}
// every trading day of month index j+1 after a signal at month j
export function tradesAfter(bars, M, j, side, opt) {
  const nx = M[j + 1]; if (!nx) return [];
  const out = [];
  for (let d = nx.first; d <= nx.last; d++) { const t = trade(bars, d, side, opt); if (t) out.push(t); }
  return out;
}
export function signalMonths(M, ev) { const out = []; for (let i = 0; i + 1 < M.length; i++) if (signals(M, i).includes(ev)) out.push(i); return out; }

// baseline: the same-side trade on every trading day, mean net R by entry year
export function baselineByYear(bars, side, opt) {
  const sum = {}, cnt = {}, all = [];
  for (let d = P.ATR_N + 1; d < bars.length; d++) {
    const t = trade(bars, d, side, opt); if (!t) continue;
    all.push(t); const y = t.entryMonth.slice(0, 4); sum[y] = (sum[y] || 0) + t.net; cnt[y] = (cnt[y] || 0) + 1;
  }
  const mean = {}; for (const y in sum) mean[y] = sum[y] / cnt[y];
  return { mean, all };
}
export const withExcess = (trades, base) => trades.map((t) => ({ ...t, excess: t.net - (base.mean[t.entryMonth.slice(0, 4)] ?? 0) }));

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
export const inWin = (t, w) => t.exitMonth >= w.from && t.exitMonth <= w.to;
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
export function window(trades, w, trades2x) {
  const inW = trades.filter((t) => inWin(t, w)), n = inW.length;
  const net = monthly(trades, w, 'net'), gross = monthly(trades, w, 'gross'), tn = tstat(net), tg = tstat(gross);
  const per = (f) => (n ? inW.reduce((a, t) => a + t[f], 0) / n : 0);
  const o = { trades: n, signalMonths: new Set(inW.map((t) => t.entryMonth)).size, months: net.length, won: n ? r3(inW.filter((t) => t.net > 0).length / n) : 0,
    stopped: n ? r3(inW.filter((t) => t.how !== 'time').length / n) : 0, medStop: r2(median(inW.map((t) => t.dist))),
    grossR: r3(per('gross')), netR: r3(per('net')), costR: r3(per('costR')), finR: r3(per('finR')),
    monthGross: r3(tg.mean), monthGrossT: r2(tg.t), monthNet: r3(tn.mean), monthNetT: r2(tn.t),
    totalNet: r2(net.reduce((a, b) => a + b, 0)), worstDD: r2(drawdown(net)) };
  if (inW.length && 'excess' in inW[0]) { const te = tstat(monthly(trades, w, 'excess')); o.excessR = r3(per('excess')); o.monthExcess = r3(te.mean); o.monthExcessT = r2(te.t); }
  if (trades2x) { const t2 = tstat(monthly(trades2x, w, 'net')); o.x2Net = r3(t2.mean); o.x2T = r2(t2.t); }
  return o;
}

// ─── placebo: as many random months as the test has signal months in the window; baseline trades of the month after each ───
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function placebo(bars, M, w, k, side, seed) {
  const cand = []; for (let i = 0; i + 1 < M.length; i++) if (M[i + 1].k >= w.from && M[i + 1].k <= w.to) cand.push(i);
  const rng = mulberry32(seed), pick = [];
  const c = [...cand]; for (let n = 0; n < k && c.length; n++) pick.push(c.splice(Math.floor(rng() * c.length), 1)[0]);
  return pick.flatMap((j) => tradesAfter(bars, M, j, side));
}

export function study(bars) {
  const M = months(bars), bases = { 1: baselineByYear(bars, 1), '-1': baselineByYear(bars, -1) };
  const tests = TESTS.map((T) => {
    const sm = signalMonths(M, T.ev);
    const tr = withExcess(sm.flatMap((j) => tradesAfter(bars, M, j, T.side)), bases[T.side]);
    const tr2 = sm.flatMap((j) => tradesAfter(bars, M, j, T.side, { costX: 2 }));
    const is = window(tr, P.IS), oos = window(tr, P.OOS, tr2);
    const kOos = sm.filter((j) => M[j + 1].k >= P.OOS.from && M[j + 1].k <= P.OOS.to).length;
    const pl = [];
    for (let s = 1; s <= P.SEEDS; s++) pl.push(tstat(monthly(placebo(bars, M, P.OOS, kOos, T.side, s), P.OOS)).t);
    pl.sort((a, b) => a - b);
    const q = (p) => r2(pl[Math.min(pl.length - 1, Math.floor(p * pl.length))]);
    const sig = sm.filter((j) => M[j + 1].k >= P.IS.from && M[j + 1].k <= P.OOS.to).map((j) => {
      const ts = tr.filter((t) => t.entryMonth === M[j + 1].k);
      return { month: M[j].k, clv: r3(clv(M[j])), ret: r3(M[j].c / M[j - 1].c - 1), next: M[j + 1].k, n: ts.length,
        net: r2(ts.reduce((a, t) => a + t.net, 0)), excess: r2(ts.reduce((a, t) => a + t.excess, 0)) };
    });
    return { id: T.id, name: T.name, ev: T.ev, side: T.side, is, oos, pOne: pOne(oos.monthNetT),
      placebo: { months: kOos, p5: q(0.05), p50: q(0.5), p95: q(0.95), max: r2(pl.at(-1)), below: pl.filter((x) => x < oos.monthNetT).length },
      signals: sig };
  });
  const hp = holm(tests.map((t) => t.pOne));
  tests.forEach((t, k) => {
    t.holmP = r3(hp[k]); t.pOne = r3(t.pOne);
    t.checks = { oosPositive: t.oos.monthNet > 0, oosT2: t.oos.monthNetT >= 2, holm05: hp[k] < 0.05,
      excessT2: t.oos.monthExcess > 0 && t.oos.monthExcessT >= 2, isSameSign: t.is.monthNet > 0,
      x2Positive: t.oos.x2Net > 0, placebo38: t.placebo.below >= 38 };
    t.pass = Object.values(t.checks).every(Boolean);
  });
  const baseline = {};
  for (const [k, side] of [['long', 1], ['short', -1]]) { const a = bases[side].all; baseline[k] = { is: window(a, P.IS), oos: window(a, P.OOS) }; }
  return { days: bars.length, firstDay: new Date(bars[0].time * 1000).toISOString().slice(0, 10), lastDay: new Date(bars.at(-1).time * 1000).toISOString().slice(0, 10), tests, baseline };
}

const s = (x) => (x >= 0 ? '+' : '') + x.toFixed(3);
export function verdictLine(res) {
  const [T1] = res.tests;
  return `${T1.pass ? 'PASS' : 'FAIL'}, ${res.tests.filter((t) => t.pass).length} of 3: buying the month after a washout month made ${s(T1.oos.netR)}R a trade net 2017-26 (n ${T1.oos.trades} in ${T1.oos.signalMonths} traded months, month t ${T1.oos.monthNetT.toFixed(2)}, over baseline ${s(T1.oos.excessR)}R, t ${T1.oos.monthExcessT.toFixed(2)})`;
}

function fmt(x) { return (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(3); }
function fmtT(x) { return (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(2); }
export function report(res) {
  const L = [];
  L.push('# Gold in the month after a washout month: result (14 Nov 2026)', '');
  L.push(`**Verdict: ${verdictLine(res)}.**`, '');
  L.push(`Paper research only. No live rule, size, filter, council member or page changed. Rule, costs, windows, the three tests, the baseline and the placebo were fixed in \`PREREGISTRATION.md\`, pushed alone (${PREREG_COMMIT}) before any trade was simulated. Data: council-data \`research/daily/xau.json\` at \`${DATA_COMMIT}\`, OANDA mid daily candles, weekend stubs folded into the next weekday; ${res.days} trading days from ${res.firstDay} to ${res.lastDay}. A daily entry on every trading day of the month after a signal month (overlapping positions), so the trades of one signal month move together: the independent count is the number of signal months. A stand-alone rule, not a gate, exit, entry or size of the gold book, and none of its 2006-17 positions is read (owner decision 44); not an edge without n and t.`, '');
  L.push('## The three tests (R a trade, 1R = 3 x ATR(20); monthly sums on every calendar month of the window, by exit month)', '');
  L.push('| Test | Window | Trades (signal months) | Won | Stopped | Median stop $ | Gross R | Net R | Over baseline R | Month net (t) | Month gross t | Month excess t | Total net R | Worst DD R | OOS at 2x costs (t) | One-sided p | Holm p | Pass |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  const row = (w, lab, last, t) => `| ${lab} | ${last ? 'OOS 2017-01 to 2026-10' : 'IS 2007-01 to 2016-12'} | ${w.trades} (${w.signalMonths}) | ${(w.won * 100).toFixed(0)}% | ${(w.stopped * 100).toFixed(0)}% | ${w.medStop.toFixed(2)} | ${fmt(w.grossR)} | ${fmt(w.netR)} | ${w.excessR !== undefined ? fmt(w.excessR) : ''} | ${fmt(w.monthNet)} (${fmtT(w.monthNetT)}) | ${fmtT(w.monthGrossT)} | ${w.monthExcessT !== undefined ? fmtT(w.monthExcessT) : ''} | ${fmtT(w.totalNet)} | ${fmtT(w.worstDD)} | ${last && t ? `${fmt(w.x2Net)} (${fmtT(w.x2T)})` : ''} | ${last && t ? t.pOne.toFixed(3) : ''} | ${last && t ? t.holmP.toFixed(3) : ''} | ${last && t ? (t.pass ? 'yes' : 'no') : ''} |`;
  for (const t of res.tests) L.push(row(t.is, `${t.id} ${t.name}`, false, t), row(t.oos, '', true, t));
  for (const [k, lab] of [['long', 'Long every day (baseline, not a test)'], ['short', 'Short every day (baseline, not a test)']]) L.push(row(res.baseline[k].is, lab, false), row(res.baseline[k].oos, '', true));
  L.push('', 'Pass bar (pre-registered, each test on its own, Holm over three; the verdict follows T1): OOS net month mean > 0 with t >= 2 and Holm p < 0.05, OOS excess over the same-year baseline > 0 with month t >= 2, the in-sample net mean > 0, the OOS mean > 0 at 2x costs and financing, above at least 38 of 40 placebos. Baseline rows: the same-side trade entered on every trading day (overlapping), so their month t counts heavily overlapping trades.', '');
  L.push('| Check | ' + res.tests.map((t) => t.id).join(' | ') + ' |', '|---|' + res.tests.map(() => '---').join('|') + '|');
  for (const k of Object.keys(res.tests[0].checks)) L.push(`| ${k} | ` + res.tests.map((t) => (t.checks[k] ? 'yes' : 'no')).join(' | ') + ' |');
  L.push('', '## Placebo (40 seeds: as many random months as the test has OOS signal months, the baseline trades of the month after each; OOS net month t)', '');
  L.push('| Test | Months drawn | p5 | p50 | p95 | max | Real | Seeds below the real |', '|---|---|---|---|---|---|---|---|');
  for (const t of res.tests) L.push(`| ${t.id} | ${t.placebo.months} | ${fmtT(t.placebo.p5)} | ${fmtT(t.placebo.p50)} | ${fmtT(t.placebo.p95)} | ${fmtT(t.placebo.max)} | ${fmtT(t.oos.monthNetT)} | ${t.placebo.below} of 40 |`);
  L.push('', '## Every signal month (sum of the next month\'s trades)', '');
  L.push('| Test | Signal month | Close location | Month return | Traded month | Trades | Net R | Over baseline R |', '|---|---|---|---|---|---|---|---|');
  for (const t of res.tests) for (const g of t.signals) L.push(`| ${t.id} | ${g.month} | ${g.clv.toFixed(3)} | ${(g.ret * 100).toFixed(1)}% | ${g.next} | ${g.n} | ${fmtT(g.net)} | ${fmtT(g.excess)} |`);
  L.push('', '## Reading', '');
  return L;
}

// written after the run; the figures it quotes are checked against result.json by tests/gold-month-washout.test.mjs
export const READING = [
  '- **Buying after a washout month (T1) flips sign between the windows.** In sample it lost −0.284R a trade net (n 120 in 6 traded months, month t −2.30) and −0.289R a trade below the same-year long baseline (t −2.41). Out of sample +0.108R net (n 164, month t 0.59; +0.169R gross, t 0.91), only +0.068R over the baseline (t 0.39), and it beat 21 of 40 random-month placebos. Costs are small (0.011R spread and slippage, 0.050R financing a trade out of sample, median stop $63.5): the failure is the signal.',
  '- **The worst month of the year (T2)** is the nearest: +0.024R in sample (n 250, t 0.24) and +0.139R out of sample (n 254, t 1.15, +0.106R over the baseline, t 0.93, Holm p 0.375, 28 of 40 placebos). Twelve signal months a window: not told apart from gold\'s drift (long every day made +0.078R a trade net out of sample).',
  '- **Shorting after a top-close month (T3)** lost in both windows (−0.169R and −0.194R a trade net) and is no different from the same-year short baseline (+0.001R and 0.000R a trade over it, month t 0.01 and 0.00): a month closing at its high says nothing about the next month beyond the year\'s trend.',
  '- Nothing proposed. Not an edge, not a gate on the gold book; nothing live changed.',
];

export function load(file) {
  const txt = file ? fs.readFileSync(file, 'utf8') : execFileSync('git', ['show', `${DATA_COMMIT}:research/daily/xau.json`], { encoding: 'utf8', maxBuffer: 64e6 });
  return toBars(JSON.parse(txt).rows);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const bars = load(process.argv[2]);
  const res = study(bars);
  const out = { study: 'gold-month-washout', built: '2026-11-14', dataCommit: DATA_COMMIT, preregCommit: PREREG_COMMIT, params: P, fin: FIN.xau.long,
    verdict: res.tests[0].pass ? 'PASS' : 'FAIL', headline: verdictLine(res), ...res };
  fs.writeFileSync(DIR + 'result.json', JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(DIR + 'RESULT.md', [...report(res), ...READING].join('\n') + '\n');
  console.log(verdictLine(res), verdictLine(res).length);
  for (const t of res.tests) console.log(t.id, JSON.stringify(t.is), '\n  ', JSON.stringify(t.oos), t.holmP, JSON.stringify(t.placebo), JSON.stringify(t.checks));
  console.log('BL', JSON.stringify(res.baseline));
}
