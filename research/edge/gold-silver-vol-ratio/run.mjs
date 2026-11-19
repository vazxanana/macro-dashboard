// Silver's volatility against gold's as a gold signal (pre-registered 14 Nov 2026, PREREGISTRATION.md, commit 37ea13f80):
// Q = 20-day realised vol of XAG / that of XAU, its trailing 252-day percentile; buy gold for five days when Q is in the
// bottom fifth (T1, primary), sell when in the top fifth (T2), both (T3); stop 1.5 x ATR(20); compared with the same side
// on every eligible day. $0.60 a trade and long financing; t on calendar-month sums, Holm over three, 40 seeded placebos.
// Paper research only: nothing live reads this file.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

export const P = {
  RV_N: 20, PCT_N: 252, LOW: 0.20, HIGH: 0.80, HOLD: 5, ATR_N: 20, MULT: 1.5, SPREAD: 0.30, SLIP: 0.15, SEEDS: 40,
  IS: { from: '2007-01', to: '2016-12' }, OOS: { from: '2017-01', to: '2026-10' },
};
export const DATA_COMMIT = '67bac79eb';
export const PREREG_COMMIT = '37ea13f80';
const DIR = fileURLToPath(new URL('.', import.meta.url));

export const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export const toBars = (rows) => foldWeekend(rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })));
// join gold and silver on the day time; silver keeps only its close
export function join(gold, silver) {
  const s = new Map(silver.map((b) => [b.time, b.close]));
  return gold.filter((b) => s.has(b.time)).map((b) => ({ ...b, sc: s.get(b.time) }));
}
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
function sdLog(cl, i, n) {
  if (i < n) return null;
  const r = []; for (let j = i - n + 1; j <= i; j++) r.push(Math.log(cl[j] / cl[j - 1]));
  const m = r.reduce((a, b) => a + b, 0) / n;
  return Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1));
}
// Q(i) and pct(i) for every joined day; each reads closes up to day i only
export function ratios(bars) {
  const g = bars.map((b) => b.close), s = bars.map((b) => b.sc), Q = [], pct = [];
  for (let i = 0; i < bars.length; i++) {
    const a = sdLog(g, i, P.RV_N), b = sdLog(s, i, P.RV_N);
    Q.push(a && b ? b / a : null);
    if (i < P.PCT_N - 1 || Q[i] == null || Q[i - P.PCT_N + 1] == null) { pct.push(null); continue; }
    let k = 0; for (let j = i - P.PCT_N + 1; j <= i; j++) if (Q[j] <= Q[i]) k++;
    pct.push(k / P.PCT_N);
  }
  return { Q, pct };
}
export const sideAt = (p) => (p == null ? 0 : p <= P.LOW ? 1 : p >= P.HIGH ? -1 : 0);

export const TESTS = [
  { id: 'T1', name: 'Buy gold when silver is calm against gold (primary)', sides: [1] },
  { id: 'T2', name: 'Sell gold when silver is wild against gold', sides: [-1] },
  { id: 'T3', name: 'Both together', sides: [1, -1] },
];

// one trade: signal at the close of day i, entry at day i+1's open, out at the close of day i+HOLD or at the stop
export function trade(bars, i, side, { costX = 1 } = {}) {
  const e = i + 1, last = i + P.HOLD; if (last >= bars.length) return null;
  const a = atr(bars, i); if (!a) return null;
  const entry = bars[e].open, dist = P.MULT * a, stop = entry - side * dist;
  let exit = bars[last].close, how = 'time', xi = last, exitTime = bars[last].time + 22 * 3600;
  for (let j = e; j <= last; j++) {
    const b = bars[j];
    if (j > e && (side > 0 ? b.open <= stop : b.open >= stop)) { exit = b.open; how = 'gap'; xi = j; exitTime = b.time; break; }
    if (side > 0 ? b.low <= stop : b.high >= stop) { exit = stop; how = 'stop'; xi = j; exitTime = b.time + 12 * 3600; break; }
  }
  const gross = side * (exit - entry) / dist;
  const costR = costX * (P.SPREAD + 2 * P.SLIP) / dist;
  const n = side > 0 ? nights(bars[e].time, exitTime) : 0;
  const finR = side > 0 ? costX * n * FIN.xau.long * entry / dist : 0;
  return { i, xi, side, day: new Date(bars[i].time * 1000).toISOString().slice(0, 10), exitMonth: ym(bars[xi].time),
    entry, stop, exit, dist, how, gross, costR, finR, nights: n, net: gross - costR - finR };
}
// one stream, one trade at a time: a signal day must be at or after the previous trade's exit day
export function runTest(bars, pct, T, opt = {}) {
  const out = []; let free = 0;
  for (let i = 0; i < bars.length; i++) {
    if (i < free) continue;
    const side = sideAt(pct[i]); if (!side || !T.sides.includes(side)) continue;
    const t = trade(bars, i, side, opt); if (!t) continue;
    out.push(t); free = t.xi;
  }
  return out;
}
export function baselineTrades(bars, pct, side, opt = {}) {
  const out = [];
  for (let i = 0; i < bars.length; i++) { if (pct[i] == null) continue; const t = trade(bars, i, side, opt); if (t) out.push(t); }
  return out;
}

// ─── statistics ───
const inWin = (t, w) => t.exitMonth >= w.from && t.exitMonth <= w.to;
export function monthly(trades, w, f = 'net') {
  const m = new Map(monthsOf(w).map((k) => [k, 0]));
  for (const t of trades) if (m.has(t.exitMonth)) m.set(t.exitMonth, m.get(t.exitMonth) + t[f]);
  return [...m.values()];
}
export function tstat(xs) {
  const n = xs.length; if (n < 2) return { n, mean: 0, t: 0, sd: 0 };
  const mean = xs.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  return { n, mean, sd, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : 0 };
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
// matched same-side baseline: per side the pool's mean net R in the window; excess with a Welch-type error
export function excessOf(inW, base, w) {
  const cells = new Map();
  for (const b of base) { if (!inWin(b, w)) continue; if (!cells.has(b.side)) cells.set(b.side, []); cells.get(b.side).push(b.net); }
  const stat = new Map([...cells].map(([c, xs]) => [c, tstat(xs)]));
  const use = inW.filter((t) => stat.has(t.side) && stat.get(t.side).n >= 2), n = use.length;
  if (n < 2) return { baseNet: 0, excess: 0, t: 0 };
  const bm = use.map((t) => stat.get(t.side).mean), d = use.map((t, k) => t.net - bm[k]);
  const ts = tstat(use.map((t) => t.net));
  const cnt = new Map(); for (const t of use) cnt.set(t.side, (cnt.get(t.side) || 0) + 1);
  let v = ts.sd ** 2 / n; for (const [c, m] of cnt) { const s = stat.get(c); v += (m / n) ** 2 * (s.sd ** 2 / s.n); }
  const ex = d.reduce((a, b) => a + b, 0) / n;
  return { baseNet: r3(bm.reduce((a, b) => a + b, 0) / n), excess: r3(ex), t: r2(v > 0 ? ex / Math.sqrt(v) : 0) };
}
export function window(trades, w, trades2x, base) {
  const inW = trades.filter((t) => inWin(t, w)), n = inW.length;
  const net = monthly(trades, w, 'net'), gross = monthly(trades, w, 'gross'), tn = tstat(net), tg = tstat(gross);
  const per = (f) => (n ? inW.reduce((a, t) => a + t[f], 0) / n : 0);
  const o = { trades: n, buys: inW.filter((t) => t.side > 0).length, months: net.length, won: n ? r3(inW.filter((t) => t.net > 0).length / n) : 0,
    stopped: n ? r3(inW.filter((t) => t.how !== 'time').length / n) : 0, medStop: r2(median(inW.map((t) => t.dist))),
    grossR: r3(per('gross')), netR: r3(per('net')), costR: r3(per('costR')), finR: r3(per('finR')),
    monthGross: r3(tg.mean), monthGrossT: r2(tg.t), monthNet: r3(tn.mean), monthNetT: r2(tn.t),
    totalNet: r2(net.reduce((a, b) => a + b, 0)), worstDD: r2(drawdown(net)) };
  if (trades2x) { const t2 = tstat(monthly(trades2x, w, 'net')); o.x2Net = r3(t2.mean); o.x2T = r2(t2.t); }
  if (base) Object.assign(o, (({ baseNet, excess, t }) => ({ baseNet, excess, excessT: t }))(excessOf(inW, base, w)));
  return o;
}

// ─── placebo: each real trade replaced by a baseline trade of a random eligible day, same window and side ───
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function placebo(real, base, seed) {
  const rng = mulberry32(seed), out = [], by = new Map();
  for (const b of base) { const w = inWin(b, P.OOS) ? 'o' : inWin(b, P.IS) ? 'i' : null; if (!w) continue; const k = w + b.side; if (!by.has(k)) by.set(k, []); by.get(k).push(b); }
  for (const t of real) {
    const w = inWin(t, P.OOS) ? 'o' : inWin(t, P.IS) ? 'i' : null; if (!w) continue;
    const src = by.get(w + t.side); if (src && src.length) out.push(src[Math.floor(rng() * src.length)]);
  }
  return out;
}

export function study(bars) {
  const { Q, pct } = ratios(bars);
  const base = [...baselineTrades(bars, pct, 1), ...baselineTrades(bars, pct, -1)];
  const sig = {};
  for (const [k, w] of [['is', P.IS], ['oos', P.OOS]]) {
    const idx = bars.map((b, i) => i).filter((i) => { const m = ym(bars[i].time); return m >= w.from && m <= w.to && pct[i] != null; });
    sig[k] = { days: idx.length, low: idx.filter((i) => sideAt(pct[i]) > 0).length, high: idx.filter((i) => sideAt(pct[i]) < 0).length, medianQ: r2(median(idx.map((i) => Q[i]))) };
  }
  const tests = TESTS.map((T) => {
    const tr = runTest(bars, pct, T), tr2 = runTest(bars, pct, T, { costX: 2 });
    const is = window(tr, P.IS, null, base), oos = window(tr, P.OOS, tr2, base);
    const pl = [];
    for (let s = 1; s <= P.SEEDS; s++) pl.push(tstat(monthly(placebo(tr, base, s), P.OOS)).t);
    pl.sort((a, b) => a - b);
    const q = (p) => r2(pl[Math.min(pl.length - 1, Math.floor(p * pl.length))]);
    const years = {};
    for (const t of tr) {
      if (t.exitMonth > P.OOS.to || t.exitMonth < P.IS.from) continue;
      const y = t.exitMonth.slice(0, 4); years[y] = years[y] || { n: 0, gross: 0, net: 0 }; years[y].n++; years[y].gross += t.gross; years[y].net += t.net;
    }
    for (const y in years) { years[y].gross = r2(years[y].gross); years[y].net = r2(years[y].net); }
    return { id: T.id, name: T.name, is, oos, pOne: pOne(oos.monthNetT),
      placebo: { p5: q(0.05), p50: q(0.5), p95: q(0.95), max: r2(pl.at(-1)), below: pl.filter((x) => x < oos.monthNetT).length },
      years,
      trades: tr.filter((t) => t.exitMonth >= P.IS.from && t.exitMonth <= P.OOS.to).map((t) => ({ day: t.day, side: t.side, exitMonth: t.exitMonth, how: t.how, stop: r2(t.dist), gross: r3(t.gross), net: r3(t.net) })) };
  });
  const hp = holm(tests.map((t) => t.pOne));
  tests.forEach((t, k) => {
    t.holmP = r3(hp[k]); t.pOne = r3(t.pOne);
    t.checks = { oosPositive: t.oos.monthNet > 0, oosT2: t.oos.monthNetT >= 2, holm05: hp[k] < 0.05, isSameSign: t.is.monthNet > 0,
      x2Positive: t.oos.x2Net > 0, abovePlacebo: t.placebo.below > 38, beatsBaseline: t.oos.excess > 0 };
    t.pass = Object.values(t.checks).every(Boolean);
  });
  const ws = (tr) => ({ is: window(tr, P.IS), oos: window(tr, P.OOS) });
  const baseline = { long: ws(base.filter((b) => b.side > 0)), short: ws(base.filter((b) => b.side < 0)) };
  return { days: bars.length, firstDay: new Date(bars[0].time * 1000).toISOString().slice(0, 10), lastDay: new Date(bars.at(-1).time * 1000).toISOString().slice(0, 10), signals: sig, tests, baseline };
}

const s = (x) => (x >= 0 ? '+' : '') + x;
export function verdictLine(res) {
  const [T1] = res.tests, pass = T1.pass;
  return `${pass ? 'PASS' : 'FAIL'}, ${res.tests.filter((t) => t.pass).length} of 3: buying gold when silver is calm against gold made ${s(T1.oos.netR)}R a trade net 2017-26 (n ${T1.oos.trades}, month t ${T1.oos.monthNetT.toFixed(2)}), ${s(T1.oos.excess)}R over buying every day`;
}

function fmt(x) { return (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(3); }
function fmtT(x) { return (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(2); }
export function report(res) {
  const L = [];
  L.push('# Silver\'s volatility against gold\'s as a gold signal: result (14 Nov 2026)', '');
  L.push(`**Verdict: ${verdictLine(res)}.**`, '');
  L.push(`Paper research only. No live rule, size, filter, council member or page changed. Rule, costs, windows, the three tests, the same-side baseline and the placebo were fixed in \`PREREGISTRATION.md\`, pushed alone (${PREREG_COMMIT}) before any signal or trade was computed. Data: council-data \`research/daily/xau.json\` and \`xag.json\` at \`${DATA_COMMIT}\`, OANDA mid daily candles joined on the day, weekend stubs folded into the next weekday; ${res.days} joined trading days from ${res.firstDay} to ${res.lastDay}. Q = silver's 20-day realised volatility over gold's (median ${res.signals.is.medianQ} in 2007-16, ${res.signals.oos.medianQ} in 2017-26); signal days (Q in the bottom / top fifth of its trailing 252 days): 2007-16 ${res.signals.is.low} low and ${res.signals.is.high} high of ${res.signals.is.days} days, 2017-26 ${res.signals.oos.low} low and ${res.signals.oos.high} high of ${res.signals.oos.days}. A stand-alone rule, not a gate, exit, entry or size of the gold book, and none of its 2006-17 positions is read (owner decision 44); not an edge without n and t.`, '');
  L.push('## The three tests (R a trade, 1R = the stop distance, 1.5 x ATR(20), held five trading days; one trade at a time; monthly sums of net R on every calendar month of the window, by exit month)', '');
  L.push('| Test | Window | Trades (buys) | Won | Stopped | Median stop $ | Gross R | Cost R | Financing R | Net R | Same-side baseline net R | Excess R (t) | Month net (t) | Month gross t | Total net R | Worst DD R | OOS at 2x costs (t) | One-sided p | Holm p | Pass |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  const row = (w, lab, last, t) => `| ${lab} | ${last ? 'OOS 2017-01 to 2026-10' : 'IS 2007-01 to 2016-12'} | ${w.trades} (${w.buys}) | ${(w.won * 100).toFixed(0)}% | ${(w.stopped * 100).toFixed(0)}% | ${w.medStop.toFixed(2)} | ${fmt(w.grossR)} | ${fmt(w.costR)} | ${fmt(w.finR)} | ${fmt(w.netR)} | ${w.baseNet != null ? fmt(w.baseNet) : ''} | ${w.excess != null ? `${fmt(w.excess)} (${fmtT(w.excessT)})` : ''} | ${fmt(w.monthNet)} (${fmtT(w.monthNetT)}) | ${fmtT(w.monthGrossT)} | ${fmtT(w.totalNet)} | ${fmtT(w.worstDD)} | ${last && t ? `${fmt(w.x2Net)} (${fmtT(w.x2T)})` : ''} | ${last && t ? t.pOne.toFixed(3) : ''} | ${last && t ? t.holmP.toFixed(3) : ''} | ${last && t ? (t.pass ? 'yes' : 'no') : ''} |`;
  for (const t of res.tests) L.push(row(t.is, `${t.id} ${t.name}`, false, t), row(t.oos, '', true, t));
  for (const [k, lab] of [['long', 'Long on every eligible day, five days (baseline pool, overlapping, not a test)'], ['short', 'Short on every eligible day, five days (baseline pool, overlapping, not a test)']]) L.push(row(res.baseline[k].is, lab, false), row(res.baseline[k].oos, '', true));
  L.push('', 'The baseline pool rows overlap (a trade opens every day), so their month t is not a test statistic; they are the source of each test\'s matched baseline (same side, same window).', '');
  L.push('Pass bar (pre-registered, each test on its own, Holm over three; the verdict follows T1): OOS net month mean > 0 with t >= 2 and Holm p < 0.05, the in-sample mean > 0, the OOS mean > 0 at 2x costs and financing, more than 38 of 40 placebo seeds below the real OOS t, and the OOS excess over the same-side baseline > 0.', '');
  L.push('| Check | ' + res.tests.map((t) => t.id).join(' | ') + ' |', '|---|' + res.tests.map(() => '---').join('|') + '|');
  for (const k of Object.keys(res.tests[0].checks)) L.push(`| ${k} | ` + res.tests.map((t) => (t.checks[k] ? 'yes' : 'no')).join(' | ') + ' |');
  L.push('', '## Placebo (40 seeds: each real trade replaced by the same-side five-day trade of a random eligible day of the same window; OOS net month t)', '');
  L.push('| Test | p5 | p50 | p95 | max | Real | Seeds below the real |', '|---|---|---|---|---|---|---|');
  for (const t of res.tests) L.push(`| ${t.id} | ${fmtT(t.placebo.p5)} | ${fmtT(t.placebo.p50)} | ${fmtT(t.placebo.p95)} | ${fmtT(t.placebo.max)} | ${fmtT(t.oos.monthNetT)} | ${t.placebo.below} of 40 |`);
  L.push('', '## Per year (sum of net R by exit year)', '');
  const ys = [...new Set(res.tests.flatMap((t) => Object.keys(t.years)))].sort();
  L.push('| Year | ' + res.tests.map((t) => `${t.id} n | ${t.id} net`).join(' | ') + ' |', '|---|' + res.tests.map(() => '---|---').join('|') + '|');
  for (const y of ys) L.push(`| ${y} | ` + res.tests.map((t) => (t.years[y] ? `${t.years[y].n} | ${fmtT(t.years[y].net)}` : '0 | 0')).join(' | ') + ' |');
  L.push('', '## Reading', '');
  return L;
}

// written after the run; the figures it quotes are checked against result.json by tests/gold-silver-vol-ratio.test.mjs
export const READING = [
  '- **Silver calm against gold is no reason to buy gold.** Out of sample T1 made +0.007R a trade net (n 151, month t 0.10; +0.061R gross), in sample −0.014R (n 157, month t −0.18); only 6 of 40 placebo seeds sit below it, and it lost at 2x costs (−0.061R). Buying gold for five days on every eligible day made +0.098R net out of sample, so the signal days were 0.091R a trade WORSE than an ordinary day (t −1.29); in sample −0.012R (t −0.15).',
  '- **Silver wild against gold is no reason to sell it.** T2 lost −0.185R a trade net out of sample (n 152, month t −1.93) and −0.089R in sample, below even the short baseline (−0.065R out of sample, t −0.82): a short of gold in a rising decade loses, and the froth story does not soften it. T3, both together, lost −0.089R net out of sample (n 303, month t −1.51).',
  '- Costs are not the reason: the round trip took about 0.02R and a buy\'s financing about 0.04R a trade out of sample (median stop $37), against gross results near zero for T1 and negative for T2. The ratio of silver\'s volatility to gold\'s carries no five-day information about gold on 2007-26 daily candles that gold\'s own drift does not.',
  '- Nothing proposed. Not an edge, not a gate on the gold book; nothing live changed. No variant (percentile cut, lookback, hold, stop) is tried here.',
];

export function load(goldFile, silverFile) {
  const rd = (f, k) => (f ? fs.readFileSync(f, 'utf8') : execFileSync('git', ['show', `${DATA_COMMIT}:research/daily/${k}.json`], { encoding: 'utf8', maxBuffer: 64e6 }));
  return join(toBars(JSON.parse(rd(goldFile, 'xau')).rows), toBars(JSON.parse(rd(silverFile, 'xag')).rows));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const bars = load(process.argv[2], process.argv[3]);
  const res = study(bars);
  const out = { study: 'gold-silver-vol-ratio', built: '2026-11-14', dataCommit: DATA_COMMIT, preregCommit: PREREG_COMMIT, params: P, fin: FIN.xau.long,
    verdict: res.tests[0].pass ? 'PASS' : 'FAIL', headline: verdictLine(res), ...res };
  fs.writeFileSync(DIR + 'result.json', JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(DIR + 'RESULT.md', [...report(res), ...READING].join('\n') + '\n');
  console.log(verdictLine(res), verdictLine(res).length);
  console.log('signals', JSON.stringify(res.signals));
  for (const t of res.tests) console.log(t.id, JSON.stringify(t.is), '\n  ', JSON.stringify(t.oos), t.holmP, JSON.stringify(t.placebo));
  for (const k in res.baseline) console.log('BL', k, JSON.stringify(res.baseline[k]));
}
