// Gold after a weekly spring (pre-registered 14 Nov 2026, PREREGISTRATION.md): a week of 4+ days whose low undercut the lowest
// low of the four weeks before and whose close is in the top half of its range is a buy; the mirror (upthrust) a sell. One
// trade at the open of every trading day of the next week, stop 2 x ATR(20), out at the last close of that week (T1, T3) or the
// week after (T2). $0.60 a trade and long financing; baseline = the same-side trade at every trading day's open of the same
// year with the same hold shape; t on calendar-month sums, Holm over three, 40 seeded random-week placebos.
// Paper research only: nothing live reads this file.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

export const P = {
  ATR_N: 20, ATR_MULT: 2, MIN_DAYS: 4, LOOK: 4, SPREAD: 0.30, SLIP: 0.15, SEEDS: 40,
  IS: { from: '2007-01', to: '2016-12' }, OOS: { from: '2017-01', to: '2026-10' },
};
export const DATA_COMMIT = '67bac79eb';
export const PREREG_COMMIT = '5dbb880dd';
const DIR = fileURLToPath(new URL('.', import.meta.url));
const DAY = 86400;

export const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export const yearOf = (t) => new Date(t * 1000).getUTCFullYear();
export const toBars = (rows) => foldWeekend(rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })));
export function monthsOf(w) {
  const out = []; let [y, m] = w.from.split('-').map(Number);
  const [ty, tm] = w.to.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } }
  return out;
}

// Monday (UTC) of the calendar week holding t
export const weekKey = (t) => { const d = Math.floor(t / DAY); return (d - ((new Date(t * 1000).getUTCDay() + 6) % 7)) * DAY; };
// weeks: { key, a, b (first / last daily index), n, open, high, low, close }; a last week not ending on a Friday is left out
export function weeksOf(bars) {
  const W = [];
  bars.forEach((b, i) => {
    const k = weekKey(b.time), w = W.at(-1);
    if (w && w.key === k) { w.b = i; w.n++; w.close = b.close; w.high = Math.max(w.high, b.high); w.low = Math.min(w.low, b.low); }
    else W.push({ key: k, a: i, b: i, n: 1, open: b.open, high: b.high, low: b.low, close: b.close });
  });
  if (W.length && new Date(bars[W.at(-1).b].time * 1000).getUTCDay() !== 5) W.pop();
  return W;
}
export function atr(bars, i, n = P.ATR_N) {
  if (i < n) return null;
  let a = 0;
  for (let j = i - n + 1; j <= i; j++) a += Math.max(bars[j].high - bars[j].low, Math.abs(bars[j].high - bars[j - 1].close), Math.abs(bars[j].low - bars[j - 1].close));
  return a / n;
}
// weekly spring / upthrust at the close of week k (reads weeks k-LOOK .. k only): +1 spring, -1 upthrust, 0 otherwise
export function signal(W, k) {
  const w = W[k]; if (!w || k < P.LOOK || w.n < P.MIN_DAYS) return 0;
  const prev = W.slice(k - P.LOOK, k), mid = (w.high + w.low) / 2;
  if (w.low < Math.min(...prev.map((x) => x.low)) && w.close >= mid) return 1;
  if (w.high > Math.max(...prev.map((x) => x.high)) && w.close <= mid) return -1;
  return 0;
}

// one position from the open of bar e to the close of bar x (inclusive), stop from the ATR ending at bar e - 1
export function hold(bars, e, x, side, { costX = 1 } = {}) {
  if (!side || e < 1 || x >= bars.length || x < e) return null;
  const a = atr(bars, e - 1); if (!a) return null;
  const entry = bars[e].open, dist = P.ATR_MULT * a, stop = entry - side * dist;
  let exit = bars[x].close, how = 'time', xi = x, exitTime = bars[x].time + 22 * 3600;
  for (let i = e; i <= x; i++) {
    const b = bars[i];
    if (i > e && (side > 0 ? b.open <= stop : b.open >= stop)) { exit = b.open; how = 'gap'; xi = i; exitTime = b.time; break; }
    if (side > 0 ? b.low <= stop : b.high >= stop) { exit = stop; how = 'stop'; xi = i; exitTime = b.time; break; }
  }
  const gross = side * (exit - entry) / dist;
  const costR = costX * (P.SPREAD + 2 * P.SLIP) / dist;
  const n = side > 0 ? nights(bars[e].time, exitTime) : 0;
  const finR = side > 0 ? costX * n * FIN.xau.long * entry / dist : 0;
  return { side, e, xi, year: yearOf(bars[e].time), exitMonth: ym(bars[xi].time), entry, stop, exit, dist, how, gross, costR, finR,
    nights: n, net: gross - costR - finR };
}
// the trades after signal week k: one at the open of every trading day of week k+1, all out at the last close of week k+H
export function trades(bars, W, k, side, H, opt) {
  const first = W[k + 1], last = W[k + H]; if (!first || !last || !side) return [];
  const out = [];
  for (let d = first.a; d <= first.b; d++) {
    const t = hold(bars, d, last.b, side, opt);
    if (t) out.push({ ...t, k, week: new Date(first.key * 1000).toISOString().slice(0, 10) });
  }
  return out;
}
export function runTest(bars, W, T, opt) {
  const out = [];
  for (let k = 0; k + T.H < W.length; k++) if (signal(W, k) === T.side) out.push(...trades(bars, W, k, T.side, T.H, opt));
  return out;
}
// baseline: the same-side trade at every trading day's open, out at the last close of that day's week + (H-1); mean by entry year
export function baseline(bars, W, H, opt) {
  const m = { 1: {}, '-1': {} };
  W.forEach((w, wi) => {
    const last = W[wi + H - 1]; if (!last) return;
    for (let e = Math.max(1, w.a); e <= w.b; e++) for (const s of [1, -1]) {
      const t = hold(bars, e, last.b, s, opt); if (!t) continue;
      const c = (m[s][t.year] = m[s][t.year] || { n: 0, sum: 0 }); c.n++; c.sum += t.net;
    }
  });
  for (const s of [1, -1]) for (const y in m[s]) m[s][y].mean = m[s][y].sum / m[s][y].n;
  return m;
}

// ─── statistics ───
export function monthly(trades, w, f = 'net') {
  const m = new Map(monthsOf(w).map((k) => [k, 0]));
  for (const t of trades) if (m.has(t.exitMonth)) m.set(t.exitMonth, m.get(t.exitMonth) + t[f]);
  return [...m.values()];
}
export function tstat(xs) {
  const n = xs.length; if (n < 2) return { n, mean: n ? xs[0] : 0, t: 0 };
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
const inWin = (trades, w) => trades.filter((t) => t.exitMonth >= w.from && t.exitMonth <= w.to);
export function windowStats(trades, w, trades2x) {
  const tw = inWin(trades, w), n = tw.length;
  const net = monthly(trades, w, 'net'), gross = monthly(trades, w, 'gross'), tn = tstat(net), tg = tstat(gross);
  const per = (f) => (n ? tw.reduce((a, t) => a + t[f], 0) / n : 0);
  const ex = tstat(tw.map((t) => t.excess));
  const o = { trades: n, buys: tw.filter((t) => t.side > 0).length, sells: tw.filter((t) => t.side < 0).length,
    won: n ? r3(tw.filter((t) => t.net > 0).length / n) : 0, stopped: n ? r3(tw.filter((t) => t.how !== 'time').length / n) : 0,
    grossR: r3(per('gross')), netR: r3(per('net')), costR: r3(per('costR')), finR: r3(per('finR')),
    monthGross: r3(tg.mean), monthGrossT: r2(tg.t), monthNet: r3(tn.mean), monthNetT: r2(tn.t),
    totalNet: r2(net.reduce((a, b) => a + b, 0)), worstDD: r2(drawdown(net)),
    baseR: r3(per('base')), excessR: r3(ex.mean), excessT: r2(ex.t) };
  if (trades2x) { const t2 = tstat(monthly(trades2x, w, 'net')); o.x2Net = r3(t2.mean); o.x2T = r2(t2.t); o.x2R = r3(inWin(trades2x, w).reduce((a, t) => a + t.net, 0) / Math.max(1, inWin(trades2x, w).length)); }
  return o;
}
const sides = (tr, w) => Object.fromEntries([['buy', 1], ['sell', -1]].map(([k, s]) => {
  const x = windowStats(tr.filter((t) => t.side === s), w); return [k, { trades: x.trades, grossR: x.grossR, netR: x.netR, monthNetT: x.monthNetT, excessR: x.excessR }];
}));

// ─── placebo: every real OOS signal week is replaced by a week drawn at random among the weeks of the same year (of week k+1) ───
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function placebo(bars, W, real, side, H, seed) {
  const rng = mulberry32(seed), byYear = new Map();
  for (let k = 0; k + H < W.length; k++) {
    if (W[k].n < P.MIN_DAYS) continue;
    const y = yearOf(W[k + 1].key); if (!byYear.has(y)) byYear.set(y, []); byYear.get(y).push(k);
  }
  const ks = [...new Set(real.map((t) => t.k))];
  return ks.flatMap((k) => { const c = byYear.get(yearOf(W[k + 1].key)); return trades(bars, W, c[Math.floor(rng() * c.length)], side, H); });
}

export const TESTS = [
  { id: 'T1', name: 'spring, buy, out at the end of the next week (primary)', side: 1, H: 1 },
  { id: 'T2', name: 'spring, buy, out at the end of the week after', side: 1, H: 2 },
  { id: 'T3', name: 'upthrust, sell, out at the end of the next week', side: -1, H: 1 },
];

export function study(bars) {
  const W = weeksOf(bars);
  const base = { 1: baseline(bars, W, 1), 2: baseline(bars, W, 2) }, base2 = { 1: baseline(bars, W, 1, { costX: 2 }), 2: baseline(bars, W, 2, { costX: 2 }) };
  const mark = (tr, b) => { for (const t of tr) { const c = b[t.side][t.year]; t.base = c ? c.mean : 0; t.excess = t.net - t.base; } return tr; };
  const tests = TESTS.map((T) => {
    const tr = mark(runTest(bars, W, T), base[T.H]), tr2 = mark(runTest(bars, W, T, { costX: 2 }), base2[T.H]);
    const is = windowStats(tr, P.IS), oos = windowStats(tr, P.OOS, tr2);
    const realOos = inWin(tr, P.OOS), pl = [];
    const weeks = { is: new Set(inWin(tr, P.IS).map((t) => t.k)).size, oos: new Set(realOos.map((t) => t.k)).size };
    for (let s = 1; s <= P.SEEDS; s++) pl.push(tstat(monthly(placebo(bars, W, realOos, T.side, T.H, s), P.OOS)).t);
    pl.sort((a, b) => a - b);
    const q = (p) => r2(pl[Math.min(pl.length - 1, Math.floor(p * pl.length))]);
    const years = {};
    for (const t of tr) { if (t.exitMonth > P.OOS.to || t.exitMonth < P.IS.from) continue; const y = t.exitMonth.slice(0, 4); years[y] = years[y] || { n: 0, net: 0 }; years[y].n++; years[y].net += t.net; }
    for (const y in years) years[y].net = r2(years[y].net);
    return { ...T, weeks, is, oos, sides: { is: sides(tr, P.IS), oos: sides(tr, P.OOS) }, pOne: pOne(oos.monthNetT),
      placebo: { p5: q(0.05), p50: q(0.5), p95: q(0.95), max: r2(pl.at(-1)), below: pl.filter((x) => x < oos.monthNetT).length }, years };
  });
  const hp = holm(tests.map((t) => t.pOne));
  tests.forEach((t, k) => {
    t.holmP = r3(hp[k]); t.pOne = r3(t.pOne);
    t.checks = { oosT2: t.oos.monthNetT >= 2, holm05: hp[k] < 0.05, isPositive: t.is.netR > 0, x2Positive: t.oos.x2R > 0,
      excessPositive: t.oos.excessR > 0, beats38of40: t.placebo.below >= 38 };
    t.pass = Object.values(t.checks).every(Boolean);
  });
  const baseRows = {};
  for (const H of [1, 2]) for (const s of [1, -1]) {
    const lab = `${H === 1 ? 'to its week end' : 'to next week end'} ${s > 0 ? 'buy' : 'sell'}`, b = base[H][s];
    for (const [wk, w] of [['is', P.IS], ['oos', P.OOS]]) {
      const ys = Object.keys(b).filter((y) => y >= w.from.slice(0, 4) && y <= w.to.slice(0, 4));
      const n = ys.reduce((a, y) => a + b[y].n, 0), sum = ys.reduce((a, y) => a + b[y].sum, 0);
      (baseRows[lab] = baseRows[lab] || {})[wk] = { trades: n, netR: r3(sum / n) };
    }
  }
  return { days: bars.length, weeks: W.length, firstDay: new Date(bars[0].time * 1000).toISOString().slice(0, 10),
    lastDay: new Date(bars.at(-1).time * 1000).toISOString().slice(0, 10), tests, baseline: baseRows };
}

const s3 = (x) => (x > 0 ? '+' : x < 0 ? '-' : '') + Math.abs(x).toFixed(3);
export function verdictLine(res) {
  const pass = res.tests.filter((t) => t.pass).length, T1 = res.tests[0];
  return `${pass && res.tests[0].pass ? 'PASS' : 'FAIL'}, ${pass} of 3: buying gold the week after a weekly spring made ${s3(T1.oos.netR)}R a trade net 2017-26 (n ${T1.oos.trades}, month t ${T1.oos.monthNetT.toFixed(2)}), ${s3(T1.oos.excessR)}R over the same-side baseline`;
}

const fT = (x) => (x > 0 ? '+' : x < 0 ? '-' : '') + Math.abs(x).toFixed(2);
export function report(res) {
  const L = [];
  L.push('# Result: gold after a weekly spring (14 Nov 2026)', '');
  L.push(`**Verdict: ${verdictLine(res)}.**`, '');
  L.push(`Pre-registered in \`PREREGISTRATION.md\` (pushed alone first, commit ${PREREG_COMMIT}); the test ran once and nothing was changed after the result. Paper research only. A stand-alone weekly rule: not a gate, exit, entry or size of the live gold book (Gold trend / Gold daily engulf), and none of that book's 2006-17 positions was read (owner decision 44). Nothing live changed and no proposal follows. Not an edge without n and t.`, '');
  L.push('## Data and rule', '');
  L.push(`OANDA mid daily XAU_USD, council-data \`research/daily/xau.json\` at \`${DATA_COMMIT}\` (\`git show\`, no network), ${res.firstDay} to ${res.lastDay}, weekend candles folded into the next weekday (\`foldWeekend\`): ${res.days} trading days, ${res.weeks} weeks. Spring: a week of 4+ days whose low is below the lowest low of the four weeks before and whose close is in the top half of its own range (buy); upthrust: the mirror (sell). One trade at the open of every trading day of the next week (the signal is too rare for 100 single entries a window, so the daily entries inside the week are the trades), stop 2 x ATR(20) (daily, up to the day before the entry), gap fills at the open, out at the last close of that week (T1, T3) or the week after (T2). Costs: $0.60 a round trip and, on buys, \`nights\` x \`FIN.xau.long\` (0.000148 of price a rollover) x entry. Baseline: the same-side trade with the same stop at every trading day's open of the same year, out at the last close of its own week (T1, T3) or the next week (T2); excess = net R minus that year's same-side baseline mean. t on calendar-month sums of net R by exit month (empty months count), one-sided, Holm over three. Placebo: each OOS signal week replaced by a random week of the same year, same entries, 40 seeds.`, '');
  L.push('## Tests (R a trade; IS 2007-01 to 2016-12, OOS 2017-01 to 2026-10)', '');
  L.push('| Test | Window | Signal weeks | n (buy / sell) | Gross R | Net R | Spread R | Financing R | Won | Stopped | Month t net | Month t gross | Total net R | Worst DD R | Baseline R | Excess R (t) | 2x costs net R | Holm p | Placebo beaten | Pass |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const t of res.tests) for (const [w, lab] of [[t.is, 'IS'], [t.oos, 'OOS']]) {
    const o = lab === 'OOS';
    L.push(`| ${o ? '' : `${t.id} ${t.name}`} | ${lab} | ${o ? t.weeks.oos : t.weeks.is} | ${w.trades} (${w.buys} / ${w.sells}) | ${s3(w.grossR)} | ${s3(w.netR)} | ${w.costR.toFixed(3)} | ${w.finR.toFixed(3)} | ${(w.won * 100).toFixed(1)}% | ${(w.stopped * 100).toFixed(1)}% | ${fT(w.monthNetT)} | ${fT(w.monthGrossT)} | ${fT(w.totalNet)} | ${fT(w.worstDD)} | ${s3(w.baseR)} | ${s3(w.excessR)} (${fT(w.excessT)}) | ${o ? s3(w.x2R) : ''} | ${o ? t.holmP.toFixed(3) : ''} | ${o ? `${t.placebo.below} of 40` : ''} | ${o ? (t.pass ? 'yes' : 'no') : ''} |`);
  }
  L.push('', 'Pass bar (pre-registered, each test): OOS month t >= 2 and Holm p < 0.05, in-sample net > 0, OOS net > 0 at 2x costs, OOS excess over the same-side baseline > 0, OOS t above at least 38 of 40 placebos. The verdict follows T1.', '');
  L.push('| Check | ' + res.tests.map((t) => t.id).join(' | ') + ' |', '|---|' + res.tests.map(() => '---').join('|') + '|');
  for (const k of Object.keys(res.tests[0].checks)) L.push(`| ${k} | ` + res.tests.map((t) => (t.checks[k] ? 'yes' : 'no')).join(' | ') + ' |');
  L.push('', '## Baseline (every trading day of the window, same stop, costs and hold shape; net R a trade)', '', '| Hold | IS n | IS net R | OOS n | OOS net R |', '|---|---|---|---|---|');
  for (const [k, b] of Object.entries(res.baseline)) L.push(`| ${k} | ${b.is.trades} | ${s3(b.is.netR)} | ${b.oos.trades} | ${s3(b.oos.netR)} |`);
  L.push('', '## Placebo (40 seeds, OOS month t)', '', '| Test | p5 | p50 | p95 | max | Real | Seeds below the real |', '|---|---|---|---|---|---|---|');
  for (const t of res.tests) L.push(`| ${t.id} | ${fT(t.placebo.p5)} | ${fT(t.placebo.p50)} | ${fT(t.placebo.p95)} | ${fT(t.placebo.max)} | ${fT(t.oos.monthNetT)} | ${t.placebo.below} of 40 |`);
  L.push('', '## Per year (sum of net R by exit year)', '');
  const ys = [...new Set(res.tests.flatMap((t) => Object.keys(t.years)))].sort();
  L.push('| Year | ' + res.tests.map((t) => `${t.id} n | ${t.id} net`).join(' | ') + ' |', '|---|' + res.tests.map(() => '---|---').join('|') + '|');
  for (const y of ys) L.push(`| ${y} | ` + res.tests.map((t) => (t.years[y] ? `${t.years[y].n} | ${fT(t.years[y].net)}` : '0 | 0')).join(' | ') + ' |');
  L.push('', '## Reading', '');
  return L;
}

// written after the run; the figures it quotes are checked against result.json by tests/gold-weekly-spring.test.mjs
export const READING = [
  '- **Buying the week after a spring (T1) is flat and not separate from noise.** Out of sample +0.040R a trade net (218 daily entries in 44 signal weeks, month t 0.49; +0.073R gross, month gross t 0.90); in sample -0.022R (184 entries, 37 weeks, t -0.31). Spread and slippage take 0.015R and financing 0.019R a trade out of sample; at 2x costs +0.006R. Holm p 0.936; it beat 32 of 40 random-week placebos of the same years (95th percentile t 1.40).',
  '- **Against an ordinary buy of the same year it adds about nothing.** Excess over the same-side baseline +0.030R out of sample (t 0.81) and -0.037R in sample (t -0.99): the sign flips between the windows. **Two weeks (T2)** +0.038R out of sample (t 0.26), +0.007R over its baseline, negative at 2x costs.',
  '- **Selling after an upthrust (T3) loses** (-0.025R a trade out of sample, n 297 in 60 weeks, t -0.41; -0.054R in sample), as every gold sell has. It loses less than an ordinary sell of the same years (excess +0.071R, t 2.20 out of sample; +0.022R in sample) and beat 38 of 40 placebos, but those placebos are random sells that lose too (median t -1.64): a smaller loss is not a rule. Not a test that passes, not pursued.',
  '- Nothing proposed. Not an edge, not a gate on the gold book; nothing live changed. No other lookback, close cut, hold or stop was run.',
];

export function load(file) {
  const txt = file ? fs.readFileSync(file, 'utf8') : execFileSync('git', ['show', `${DATA_COMMIT}:research/daily/xau.json`], { encoding: 'utf8', maxBuffer: 64e6 });
  return toBars(JSON.parse(txt).rows);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const res = study(load(process.argv[2]));
  const out = { study: 'gold-weekly-spring', built: '2026-11-14', dataCommit: DATA_COMMIT, preregCommit: PREREG_COMMIT, params: P,
    fin: FIN.xau.long, verdict: res.tests[0].pass ? 'PASS' : 'FAIL', headline: verdictLine(res), ...res };
  fs.writeFileSync(DIR + 'result.json', JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(DIR + 'RESULT.md', [...report(res), ...READING].join('\n') + '\n');
  console.log(verdictLine(res), verdictLine(res).length);
  for (const t of res.tests) console.log(t.id, t.weeks, JSON.stringify(t.is), '\n  ', JSON.stringify(t.oos), t.holmP, JSON.stringify(t.placebo));
  console.log(JSON.stringify(res.baseline));
}
