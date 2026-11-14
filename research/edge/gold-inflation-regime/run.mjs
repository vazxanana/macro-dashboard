// Long gold while stocks and bonds move together (pre-registered 14 Nov 2026, PREREGISTRATION.md, commit ec2a2ced8).
// C = correlation of the 63 latest common daily log returns of the S&P 500 CFD and the US 10-year note CFD (a price).
// T1 long gold when C > 0 (primary), T2 long when C > 0.3, T3 short when C < 0. Entry at the next open, stop 2 x ATR(20),
// out at the close of the 10th day; $0.60 a trade and long financing. Excess = net R minus the mean net R of the same trade
// taken on every eligible day of the window; t on calendar-month sums, Holm over three, 40 seeded placebos.
// Paper research only: nothing live reads this file.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

export const P = {
  C_N: 63, ATR_N: 20, MULT: 2, HOLD: 10, SPREAD: 0.30, SLIP: 0.15, SEEDS: 40,
  IS: { from: '2007-01', to: '2016-12' }, OOS: { from: '2017-01', to: '2026-10' },
};
export const DATA_COMMIT = 'fff1565f5';
export const PREREG_COMMIT = 'ec2a2ced8';
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
// the days gold, the S&P 500 and the note all have a candle of: for each gold index its position in that list (or -1)
export function common(gold, spx, bond) {
  const sc = new Map(spx.map((b) => [b.time, b.close])), bc = new Map(bond.map((b) => [b.time, b.close]));
  const list = [], pos = new Array(gold.length).fill(-1);
  gold.forEach((b, i) => { if (sc.has(b.time) && bc.has(b.time)) { pos[i] = list.length; list.push({ i, s: sc.get(b.time), b: bc.get(b.time) }); } });
  return { list, pos };
}
export function pearson(x, y) {
  const n = x.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let q = 0; q < n; q++) { sxy += (x[q] - mx) * (y[q] - my); sxx += (x[q] - mx) ** 2; syy += (y[q] - my) ** 2; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
}
// stock-bond correlation of the C_N latest common log returns ending at gold day i (reads closes up to day i only)
export function corrAt(cm, i, n = P.C_N) {
  const k = cm.pos[i]; if (k < n) return null;
  const x = [], y = [];
  for (let j = k - n + 1; j <= k; j++) { x.push(Math.log(cm.list[j].s / cm.list[j - 1].s)); y.push(Math.log(cm.list[j].b / cm.list[j - 1].b)); }
  return pearson(x, y);
}

export const TESTS = [
  { id: 'T1', name: 'Long gold when the stock-bond correlation is positive, C > 0 (primary)', side: 1, ok: (c) => c > 0 },
  { id: 'T2', name: 'Long gold when C > 0.3', side: 1, ok: (c) => c > 0.3 },
  { id: 'T3', name: 'Short gold when C < 0 (hedging regime)', side: -1, ok: (c) => c < 0 },
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
export const inWin = (t, w) => t.exitMonth >= w.from && t.exitMonth <= w.to;
export const winOf = (t) => (inWin(t, P.OOS) ? 'oos' : inWin(t, P.IS) ? 'is' : null);
// every gold day with a computable C (no look-ahead: C at day i reads closes up to day i)
export function signals(bars, cm) { const out = []; for (let i = 0; i < bars.length; i++) { const c = corrAt(cm, i); if (c != null) out.push({ i, c }); } return out; }
// the same-side baseline: the trade started on every signal day, per window; mean net R at 1x and 2x costs
export function baseline(bars, sig, side) {
  const tr = { is: [], oos: [] }, tr2 = { is: [], oos: [] };
  for (const s of sig) {
    const t = trade(bars, s.i, side); if (!t) continue; const w = winOf(t); if (!w) continue;
    tr[w].push(t); tr2[w].push(trade(bars, s.i, side, { costX: 2 }));
  }
  const mean = (a, f) => (a.length ? a.reduce((x, t) => x + t[f], 0) / a.length : 0);
  return { trades: tr, mean: { is: mean(tr.is, 'net'), oos: mean(tr.oos, 'net') }, mean2: { is: mean(tr2.is, 'net'), oos: mean(tr2.oos, 'net') },
    gross: { is: mean(tr.is, 'gross'), oos: mean(tr.oos, 'gross') }, n: { is: tr.is.length, oos: tr.oos.length } };
}
export function stamp(t, base, x2) { const w = winOf(t); t.ex = w ? t.net - (x2 ? base.mean2[w] : base.mean[w]) : 0; return t; }
export function runTest(bars, sig, T, base, { costX = 1 } = {}) {
  const out = []; let free = -1;
  for (const s of sig) {
    if (s.i <= free || !T.ok(s.c)) continue;
    const t = trade(bars, s.i, T.side, { costX }); if (!t) continue;
    t.c = s.c; out.push(stamp(t, base, costX === 2)); free = t.xi;
  }
  return out;
}
// ─── statistics ───
export function monthly(trades, w, f = 'ex') {
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
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
export function window(trades, w, trades2x) {
  const inW = trades.filter((t) => inWin(t, w)), n = inW.length;
  const ex = tstat(monthly(trades, w, 'ex')), net = tstat(monthly(trades, w, 'net')), gross = tstat(monthly(trades, w, 'gross'));
  const per = (f) => (n ? inW.reduce((a, t) => a + t[f], 0) / n : 0);
  const o = { trades: n, months: monthsOf(w).length, won: n ? r3(inW.filter((t) => t.net > 0).length / n) : 0,
    stopped: n ? r3(inW.filter((t) => t.how !== 'time').length / n) : 0, medStop: r2(median(inW.map((t) => t.dist))),
    grossR: r3(per('gross')), netR: r3(per('net')), exR: r3(per('ex')), costR: r3(per('costR')), finR: r3(per('finR')),
    costShare: per('gross') > 0 ? r3((per('costR') + per('finR')) / per('gross')) : null,
    monthGrossT: r2(gross.t), monthNet: r3(net.mean), monthNetT: r2(net.t), monthEx: r3(ex.mean), monthExT: r2(ex.t),
    totalNet: r2(per('net') * n), totalEx: r2(per('ex') * n), worstDD: r2(drawdown(monthly(trades, w, 'net'))) };
  if (trades2x) {
    const a = tstat(monthly(trades2x, w, 'net')), b = tstat(monthly(trades2x, w, 'ex'));
    o.x2Net = r3(a.mean); o.x2NetT = r2(a.t); o.x2Ex = r3(b.mean); o.x2ExT = r2(b.t);
  }
  return o;
}
// ─── placebo: each real trade replaced by a random baseline trade of the same side exiting in the same window ───
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function placebo(real, base, seed) {
  const rng = mulberry32(seed), out = [];
  for (const t of real) {
    const w = winOf(t); const src = w ? base.trades[w] : null;
    if (src && src.length) out.push(stamp({ ...src[Math.floor(rng() * src.length)] }, base));
  }
  return out;
}
function placeboStats(pl, real) {
  pl.sort((a, b) => a - b);
  const q = (p) => r2(pl[Math.min(pl.length - 1, Math.floor(p * pl.length))]);
  return { p5: q(0.05), p50: q(0.5), p95: q(0.95), max: r2(pl.at(-1)), below: pl.filter((x) => x < real).length };
}
function yearsOf(tr) {
  const years = {};
  for (const t of tr) { if (!winOf(t)) continue; const y = t.exitMonth.slice(0, 4); years[y] = years[y] || { n: 0, net: 0, ex: 0 }; years[y].n++; years[y].net += t.net; years[y].ex += t.ex; }
  for (const y in years) { years[y].net = r2(years[y].net); years[y].ex = r2(years[y].ex); }
  return years;
}

export function study(bars, spx, bond) {
  const cm = common(bars, spx, bond), sig = signals(bars, cm);
  const share = (w) => { const s = sig.filter((x) => { const m = ym(bars[x.i].time); return m >= w.from && m <= w.to; }); return { days: s.length, pos: r3(s.filter((x) => x.c > 0).length / (s.length || 1)), pos03: r3(s.filter((x) => x.c > 0.3).length / (s.length || 1)) }; };
  const regime = { is: share(P.IS), oos: share(P.OOS) };
  const bases = { 1: baseline(bars, sig, 1), '-1': baseline(bars, sig, -1) };
  const bw = (b) => ({ n: b.n, grossR: { is: r3(b.gross.is), oos: r3(b.gross.oos) }, netR: { is: r3(b.mean.is), oos: r3(b.mean.oos) }, netR2x: { is: r3(b.mean2.is), oos: r3(b.mean2.oos) } });
  const tests = TESTS.map((T) => {
    const base = bases[T.side], tr = runTest(bars, sig, T, base), tr2 = runTest(bars, sig, T, base, { costX: 2 });
    const is = window(tr, P.IS), oos = window(tr, P.OOS, tr2), pl = [];
    for (let s = 1; s <= P.SEEDS; s++) pl.push(tstat(monthly(placebo(tr, base, s), P.OOS, 'ex')).t);
    return { id: T.id, name: T.name, side: T.side, is, oos, pOne: pOne(oos.monthExT), placebo: placeboStats(pl, oos.monthExT), years: yearsOf(tr),
      trades: tr.filter((t) => winOf(t)).map((t) => ({ day: t.day, c: r3(t.c), exitMonth: t.exitMonth, how: t.how, stop: r2(t.dist), gross: r3(t.gross), net: r3(t.net), ex: r3(t.ex) })) };
  });
  const hp = holm(tests.map((t) => t.pOne));
  tests.forEach((t, k) => {
    t.holmP = r3(hp[k]); t.pOne = r3(t.pOne);
    t.checks = { oosExPositive: t.oos.monthEx > 0, oosExT2: t.oos.monthExT >= 2, holm05: hp[k] < 0.05, isSameSign: t.is.monthEx > 0,
      x2NetPositive: t.oos.x2Net > 0, x2ExPositive: t.oos.x2Ex > 0, abovePlacebo95: t.placebo.below > 38 };
    t.pass = Object.values(t.checks).every(Boolean);
  });
  return { days: bars.length, commonDays: cm.list.length, firstDay: new Date(bars[0].time * 1000).toISOString().slice(0, 10), lastDay: new Date(bars.at(-1).time * 1000).toISOString().slice(0, 10),
    regime, baseline: { long: bw(bases[1]), short: bw(bases[-1]) }, tests };
}

const s = (x, d = 3) => (x >= 0 ? '+' : '') + x.toFixed(d);
export function verdictLine(res) {
  const [T1] = res.tests;
  return `${T1.pass ? 'PASS' : 'FAIL'}, ${res.tests.filter((t) => t.pass).length} of 3: longs while stocks and bonds co-move beat gold's drift by ${s(T1.oos.exR)}R a trade net 2017-26 (n ${T1.oos.trades}, month t ${s(T1.oos.monthExT, 2)}), ${s(T1.is.exR)}R in 2007-16 (n ${T1.is.trades})`;
}

function fmt(x) { return (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(3); }
function fmtT(x) { return (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(2); }
export function report(res) {
  const L = [];
  L.push('# Long gold while stocks and bonds move together: result (14 Nov 2026)', '');
  L.push(`**Verdict: ${verdictLine(res)}.**`, '');
  L.push(`Paper research only. No live rule, size, filter, council member or page changed. Rule, costs, windows, the three tests and the placebo were fixed in \`PREREGISTRATION.md\`, pushed alone (${PREREG_COMMIT}) before any trade was simulated. Data: council-data \`research/daily/xau.json\`, \`spx500.json\` and \`usb10y.json\` at \`${DATA_COMMIT}\`, OANDA mid daily candles, weekend stubs folded into the next weekday; ${res.days} gold days from ${res.firstDay} to ${res.lastDay}, ${res.commonDays} of them with an S&P 500 and a 10-year note candle. Share of signal days with C > 0: 2007-16 ${(res.regime.is.pos * 100).toFixed(1)} % (C > 0.3: ${(res.regime.is.pos03 * 100).toFixed(1)} %), 2017-26 ${(res.regime.oos.pos * 100).toFixed(1)} % (${(res.regime.oos.pos03 * 100).toFixed(1)} %). One position at a time per test. A stand-alone rule, not a gate, exit, entry or size of the gold book, and none of its positions is read (owner decision 44); not an edge without n and t.`, '');
  L.push('## The three tests (R a trade, 1R = the stop distance, 2 x ATR(20), ten days held; excess = net R minus the mean net R of the same-side trade on every eligible day of the window; monthly sums by exit month)', '');
  L.push('| Test | Window | Trades | Won | Stopped | Median stop $ | Gross R | Net R | Excess R | Cost share | Month net t | Month excess (t) | Total net R | Worst DD R | OOS 2x costs: net (t), excess (t) | One-sided p | Holm p | Pass |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  const row = (w, lab, last, t) => `| ${lab} | ${last ? 'OOS 2017-01 to 2026-10' : 'IS 2007-01 to 2016-12'} | ${w.trades} | ${(w.won * 100).toFixed(0)}% | ${(w.stopped * 100).toFixed(0)}% | ${w.medStop.toFixed(2)} | ${fmt(w.grossR)} | ${fmt(w.netR)} | ${fmt(w.exR)} | ${w.costShare == null ? 'n/a (gross ≤ 0)' : (w.costShare * 100).toFixed(0) + '%'} | ${fmtT(w.monthNetT)} | ${fmt(w.monthEx)} (${fmtT(w.monthExT)}) | ${fmtT(w.totalNet)} | ${fmtT(w.worstDD)} | ${last ? `${fmt(w.x2Net)} (${fmtT(w.x2NetT)}), ${fmt(w.x2Ex)} (${fmtT(w.x2ExT)})` : ''} | ${last ? t.pOne.toFixed(3) : ''} | ${last ? t.holmP.toFixed(3) : ''} | ${last ? (t.pass ? 'yes' : 'no') : ''} |`;
  for (const t of res.tests) L.push(row(t.is, `${t.id} ${t.name}`, false, t), row(t.oos, '', true, t));
  L.push('', '| Same-side baseline (every eligible day, overlapping; not a test) | n IS | n OOS | Gross R IS | Gross R OOS | Net R IS | Net R OOS | Net R 2x OOS |', '|---|---|---|---|---|---|---|---|');
  for (const [k, lab] of [['long', 'Long every day'], ['short', 'Short every day']]) { const b = res.baseline[k]; L.push(`| ${lab} | ${b.n.is} | ${b.n.oos} | ${fmt(b.grossR.is)} | ${fmt(b.grossR.oos)} | ${fmt(b.netR.is)} | ${fmt(b.netR.oos)} | ${fmt(b.netR2x.oos)} |`); }
  L.push('', 'Pass bar (pre-registered, each test on its own, Holm over three; the verdict follows T1): OOS month mean of excess > 0 with t >= 2 and Holm p < 0.05, the in-sample excess > 0, the OOS plain net and the OOS excess > 0 at 2x costs and financing, the OOS excess t above the placebo\'s 95th percentile.', '');
  L.push('| Check | ' + res.tests.map((t) => t.id).join(' | ') + ' |', '|---|' + res.tests.map(() => '---').join('|') + '|');
  for (const k of Object.keys(res.tests[0].checks)) L.push(`| ${k} | ` + res.tests.map((t) => (t.checks[k] ? 'yes' : 'no')).join(' | ') + ' |');
  L.push('', '## Placebo (40 seeds: each real trade replaced by a random same-side baseline trade exiting in the same window; OOS month t of excess)', '');
  L.push('| Test | p5 | p50 | p95 | max | Real | Seeds below the real |', '|---|---|---|---|---|---|---|');
  for (const t of res.tests) L.push(`| ${t.id} | ${fmtT(t.placebo.p5)} | ${fmtT(t.placebo.p50)} | ${fmtT(t.placebo.p95)} | ${fmtT(t.placebo.max)} | ${fmtT(t.oos.monthExT)} | ${t.placebo.below} of 40 |`);
  L.push('', '## Per year (by exit year: trades, sum of net R, sum of excess R)', '');
  const ys = [...new Set(res.tests.flatMap((t) => Object.keys(t.years)))].sort();
  L.push('| Year | ' + res.tests.map((t) => `${t.id} n | ${t.id} net | ${t.id} excess`).join(' | ') + ' |', '|---|' + res.tests.map(() => '---|---|---').join('|') + '|');
  for (const y of ys) L.push(`| ${y} | ` + res.tests.map((t) => (t.years[y] ? `${t.years[y].n} | ${fmtT(t.years[y].net)} | ${fmtT(t.years[y].ex)}` : '0 | 0 | 0')).join(' | ') + ' |');
  L.push('', '## Reading', '');
  return L;
}

// written after the run; the figures it quotes are checked against result.json by tests/gold-inflation-regime.test.mjs
export const READING = [
  '- **The positive stock-bond correlation adds nothing to a gold long.** Out of sample T1 made +0.143R a trade net (n 93, month t +1.18), but the same long taken on every eligible day made +0.124R: the excess is +0.019R a trade (month t +0.16), and 27 of 40 placebo seeds (random long days of the same window) sit below it, so it is inside the noise. In sample the excess was −0.056R (n 32, t −0.44): the sign is not even stable.',
  '- **The stronger regime (T2, C > 0.3) is no better.** It existed on 0.2 % of in-sample days (2 trades) and 16.3 % of out-of-sample days; out of sample its 48 longs matched the every-day long exactly (excess +0.000R, t 0.00).',
  '- **Shorting gold in the hedging regime (T3) loses, and only because gold rose.** Out of sample −0.196R a trade net (n 195, month t −2.78), but the every-day short lost −0.168R: excess −0.028R (t −0.42). The regime does not pick weak gold days.',
  '- What the plain long figures show is gold\'s 2017-26 drift (the every-day long: +0.124R net out of sample, +0.013R in sample), which this test was built to take out. Nothing proposed. Not an edge, not a gate on the gold book; nothing live changed.',
];

export function load(key, file) {
  const txt = file ? fs.readFileSync(file, 'utf8') : execFileSync('git', ['show', `${DATA_COMMIT}:research/daily/${key}.json`], { encoding: 'utf8', maxBuffer: 64e6 });
  return toBars(JSON.parse(txt).rows);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const bars = load('xau', process.argv[2]), spx = load('spx500', process.argv[3]), bond = load('usb10y', process.argv[4]);
  const res = study(bars, spx, bond);
  const out = { study: 'gold-inflation-regime', built: '2026-11-14', dataCommit: DATA_COMMIT, preregCommit: PREREG_COMMIT, params: P, fin: FIN.xau.long,
    verdict: res.tests[0].pass ? 'PASS' : 'FAIL', headline: verdictLine(res), ...res };
  fs.writeFileSync(DIR + 'result.json', JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(DIR + 'RESULT.md', [...report(res), ...READING].join('\n') + '\n');
  console.log(verdictLine(res), verdictLine(res).length);
  console.log('regime', JSON.stringify(res.regime), JSON.stringify(res.baseline));
  for (const t of res.tests) console.log(t.id, JSON.stringify(t.is), '\n  ', JSON.stringify(t.oos), t.holmP, JSON.stringify(t.placebo), JSON.stringify(t.checks));
}
