// Gold after a week that closed at its high or its low (pre-registered 14 Nov 2026, PREREGISTRATION.md): follow the close of a
// week that ended in the top (bottom) F of its own range; entry at the next week's first open, stop 2 x ATR(20), out at the
// last close of the next week (T1, T2) or the week after (T3). $0.60 a trade and long financing; baseline = the same-side trade
// on every trading day of the same year; t on calendar-month sums, Holm over three, 40 seeded random-week placebos.
// Paper research only: nothing live reads this file.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

export const P = {
  ATR_N: 20, ATR_MULT: 2, MIN_DAYS: 4, SPREAD: 0.30, SLIP: 0.15, SEEDS: 40,
  IS: { from: '2007-01', to: '2016-12' }, OOS: { from: '2017-01', to: '2026-10' },
};
export const DATA_COMMIT = 'd8d68407b';
export const PREREG_COMMIT = '2122e21a7';
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
// side after week k (reads week k only): +1 closed in the top F of its range, -1 in the bottom F, 0 otherwise
export function signal(W, k, F) {
  const w = W[k]; if (!w || w.n < P.MIN_DAYS) return 0;
  const r = w.high - w.low; if (!(r > 0)) return 0;
  if (w.close >= w.high - F * r) return 1;
  if (w.close <= w.low + F * r) return -1;
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
// the trade after signal week k, held H weeks
export function trade(bars, W, k, side, H, opt) {
  const first = W[k + 1], last = W[k + H]; if (!first || !last || !side) return null;
  const t = hold(bars, first.a, last.b, side, opt); if (!t) return null;
  return { ...t, k, week: new Date(first.key * 1000).toISOString().slice(0, 10) };
}
export function runTest(bars, W, T, opt) {
  const out = []; let busy = -1;
  for (let k = 0; k + T.H < W.length; k++) {
    if (k + 1 <= busy) continue; // one position at a time
    const t = trade(bars, W, k, signal(W, k, T.F), T.H, opt);
    if (t) { out.push(t); busy = k + T.H; }
  }
  return out;
}
// baseline: the same-side trade at every trading day's open, held D trading days; mean net R by side and entry year
export function baseline(bars, D, opt) {
  const m = { 1: {}, '-1': {} };
  for (let e = 1; e + D - 1 < bars.length; e++) for (const s of [1, -1]) {
    const t = hold(bars, e, e + D - 1, s, opt); if (!t) continue;
    const c = (m[s][t.year] = m[s][t.year] || { n: 0, sum: 0 }); c.n++; c.sum += t.net;
  }
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

// ─── placebo: each real OOS trade keeps its side; its signal week is drawn at random among weeks of the same trade year ───
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function placebo(bars, W, real, H, seed) {
  const rng = mulberry32(seed), byYear = new Map();
  for (let k = 0; k + H < W.length; k++) {
    if (W[k].n < P.MIN_DAYS) continue;
    const y = yearOf(W[k + 1].key); if (!byYear.has(y)) byYear.set(y, []); byYear.get(y).push(k);
  }
  return real.map((t) => { const ks = byYear.get(yearOf(W[t.k + 1].key)); return trade(bars, W, ks[Math.floor(rng() * ks.length)], t.side, H); }).filter(Boolean);
}

export const TESTS = [
  { id: 'T1', name: 'F 0.10, hold one week (primary)', F: 0.10, H: 1 },
  { id: 'T2', name: 'F 0.20, hold one week', F: 0.20, H: 1 },
  { id: 'T3', name: 'F 0.10, hold two weeks', F: 0.10, H: 2 },
];

export function study(bars) {
  const W = weeksOf(bars);
  const base = { 1: baseline(bars, 5), 2: baseline(bars, 10) }, base2 = { 1: baseline(bars, 5, { costX: 2 }), 2: baseline(bars, 10, { costX: 2 }) };
  const mark = (tr, b) => { for (const t of tr) { const c = b[t.side][t.year]; t.base = c ? c.mean : 0; t.excess = t.net - t.base; } return tr; };
  const tests = TESTS.map((T) => {
    const tr = mark(runTest(bars, W, T), base[T.H]), tr2 = mark(runTest(bars, W, T, { costX: 2 }), base2[T.H]);
    const is = windowStats(tr, P.IS), oos = windowStats(tr, P.OOS, tr2);
    const realOos = inWin(tr, P.OOS), pl = [];
    for (let s = 1; s <= P.SEEDS; s++) pl.push(tstat(monthly(placebo(bars, W, realOos, T.H, s), P.OOS)).t);
    pl.sort((a, b) => a - b);
    const q = (p) => r2(pl[Math.min(pl.length - 1, Math.floor(p * pl.length))]);
    const years = {};
    for (const t of tr) { if (t.exitMonth > P.OOS.to || t.exitMonth < P.IS.from) continue; const y = t.exitMonth.slice(0, 4); years[y] = years[y] || { n: 0, net: 0 }; years[y].n++; years[y].net += t.net; }
    for (const y in years) years[y].net = r2(years[y].net);
    return { ...T, is, oos, sides: { is: sides(tr, P.IS), oos: sides(tr, P.OOS) }, pOne: pOne(oos.monthNetT),
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
    const lab = `${H === 1 ? '5' : '10'}d ${s > 0 ? 'buy' : 'sell'}`, b = base[H][s];
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
  return `${pass && res.tests[0].pass ? 'PASS' : 'FAIL'}, ${pass} of 3: following a gold week that closed at its high or low made ${s3(T1.oos.netR)}R a trade net 2017-26 (n ${T1.oos.trades}, month t ${T1.oos.monthNetT.toFixed(2)}), ${s3(T1.oos.excessR)}R over the same-side baseline`;
}

const fT = (x) => (x > 0 ? '+' : x < 0 ? '-' : '') + Math.abs(x).toFixed(2);
export function report(res) {
  const L = [];
  L.push('# Result: gold after a week that closed at its high or its low (14 Nov 2026)', '');
  L.push(`**Verdict: ${verdictLine(res)}.**`, '');
  L.push(`Pre-registered in \`PREREGISTRATION.md\` (pushed alone first, commit ${PREREG_COMMIT}); the test ran once and nothing was changed after the result. Paper research only. A stand-alone weekly rule: not a gate, exit, entry or size of the live gold book (Gold trend / Gold daily engulf), and none of that book's 2006-17 positions was read (owner decision 44). Nothing live changed and no proposal follows. Not an edge without n and t.`, '');
  L.push('## Data and rule', '');
  L.push(`OANDA mid daily XAU_USD, council-data \`research/daily/xau.json\` at \`${DATA_COMMIT}\` (\`git show\`, no network), ${res.firstDay} to ${res.lastDay}, weekend candles folded into the next weekday (\`foldWeekend\`): ${res.days} trading days, ${res.weeks} weeks. A week of 4+ days that closed in the top F of its own high-low range is a buy, in the bottom F a sell. Entry at the next week's first open, stop 2 x ATR(20) (daily, up to the signal week's last day), gap fills at the open, out at the last close of the next week (T1, T2) or the week after (T3; one position at a time). Costs: $0.60 a round trip and, on buys, \`nights\` x \`FIN.xau.long\` (0.000148 of price a rollover) x entry. Baseline: the same-side trade with the same stop at every trading day's open of the same year, held 5 (T1, T2) or 10 (T3) trading days; excess = net R minus that year's same-side baseline mean. t on calendar-month sums of net R by exit month (empty months count), one-sided, Holm over three. Placebo: every OOS trade keeps its side, its signal week drawn at random from the same year's weeks, 40 seeds.`, '');
  L.push('## Tests (R a trade; IS 2007-01 to 2016-12, OOS 2017-01 to 2026-10)', '');
  L.push('| Test | Window | n (buy / sell) | Gross R | Net R | Spread R | Financing R | Won | Stopped | Month t net | Month t gross | Total net R | Worst DD R | Baseline R | Excess R (t) | 2x costs net R | Holm p | Placebo beaten | Pass |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const t of res.tests) for (const [w, lab] of [[t.is, 'IS'], [t.oos, 'OOS']]) {
    const o = lab === 'OOS';
    L.push(`| ${o ? '' : `${t.id} ${t.name}`} | ${lab} | ${w.trades} (${w.buys} / ${w.sells}) | ${s3(w.grossR)} | ${s3(w.netR)} | ${w.costR.toFixed(3)} | ${w.finR.toFixed(3)} | ${(w.won * 100).toFixed(1)}% | ${(w.stopped * 100).toFixed(1)}% | ${fT(w.monthNetT)} | ${fT(w.monthGrossT)} | ${fT(w.totalNet)} | ${fT(w.worstDD)} | ${s3(w.baseR)} | ${s3(w.excessR)} (${fT(w.excessT)}) | ${o ? s3(w.x2R) : ''} | ${o ? t.holmP.toFixed(3) : ''} | ${o ? `${t.placebo.below} of 40` : ''} | ${o ? (t.pass ? 'yes' : 'no') : ''} |`);
  }
  L.push('', 'Pass bar (pre-registered, each test): OOS month t >= 2 and Holm p < 0.05, in-sample net > 0, OOS net > 0 at 2x costs, OOS excess over the same-side baseline > 0, OOS t above at least 38 of 40 placebos. The verdict follows T1.', '');
  L.push('| Check | ' + res.tests.map((t) => t.id).join(' | ') + ' |', '|---|' + res.tests.map(() => '---').join('|') + '|');
  for (const k of Object.keys(res.tests[0].checks)) L.push(`| ${k} | ` + res.tests.map((t) => (t.checks[k] ? 'yes' : 'no')).join(' | ') + ' |');
  L.push('', '## Buys and sells apart (reported, not tests)', '');
  L.push('| Test | Window | Buy n | Buy gross R | Buy net R | Buy t | Buy excess R | Sell n | Sell gross R | Sell net R | Sell t | Sell excess R |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const t of res.tests) for (const [k, lab] of [['is', 'IS'], ['oos', 'OOS']]) {
    const g = t.sides[k];
    L.push(`| ${k === 'is' ? t.id : ''} | ${lab} | ${g.buy.trades} | ${s3(g.buy.grossR)} | ${s3(g.buy.netR)} | ${fT(g.buy.monthNetT)} | ${s3(g.buy.excessR)} | ${g.sell.trades} | ${s3(g.sell.grossR)} | ${s3(g.sell.netR)} | ${fT(g.sell.monthNetT)} | ${s3(g.sell.excessR)} |`);
  }
  L.push('', '## Baseline (every trading day, same stop and costs; net R a trade)', '', '| Hold | IS n | IS net R | OOS n | OOS net R |', '|---|---|---|---|---|');
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

// written after the run; the figures it quotes are checked against result.json by tests/gold-week-close-extreme.test.mjs
export const READING = [
  '- **Following a week that closed at its extreme (T1) is small, positive and not separate from noise.** Out of sample +0.053R a trade net (n 121, month t 0.80; +0.090R gross, month gross t 1.33); in sample +0.080R (n 115, t 1.13). Spread and slippage take 0.014R and financing on the buys 0.023R out of sample. At 2x costs +0.017R a trade. Holm p 0.636; it beat 31 of 40 random-week placebos (95th percentile t 1.76).',
  '- **Most of it is gold\'s drift, not the close location.** Against the same-side trade on every day of the same year the excess is +0.024R out of sample (t 0.33) and +0.060R in sample (t 0.82). The buys after a week that closed at its high made +0.066R out of sample, -0.015R against every-day buys of the same years; the sells after a week that closed at its low were better than every-day sells (+0.114R out of sample) only because every-day sells lost (-0.108R a trade on 5-day holds in 2017-26).',
  '- **The looser cut (T2, top / bottom fifth) is flat**: +0.010R out of sample (n 216, t 0.21), -0.014R against the baseline, -0.026R at 2x costs. **Two weeks (T3)** +0.049R (n 94, t 0.45), -0.005R against the baseline; its sells lost -0.214R. T3 had 90 trades in sample, under the 100 the pre-registration counted, because one position at a time skips a signal inside a held two-week position (115 signal weeks).',
  '- Nothing proposed. Not an edge, not a gate on the gold book; nothing live changed. No other cut, hold or stop was run.',
];

export function load(file) {
  const txt = file ? fs.readFileSync(file, 'utf8') : execFileSync('git', ['show', `${DATA_COMMIT}:research/daily/xau.json`], { encoding: 'utf8', maxBuffer: 64e6 });
  return toBars(JSON.parse(txt).rows);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const res = study(load(process.argv[2]));
  const out = { study: 'gold-week-close-extreme', built: '2026-11-14', dataCommit: DATA_COMMIT, preregCommit: PREREG_COMMIT, params: P,
    fin: FIN.xau.long, verdict: res.tests[0].pass ? 'PASS' : 'FAIL', headline: verdictLine(res), ...res };
  fs.writeFileSync(DIR + 'result.json', JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(DIR + 'RESULT.md', [...report(res), ...READING].join('\n') + '\n');
  console.log(verdictLine(res), verdictLine(res).length);
  for (const t of res.tests) console.log(t.id, JSON.stringify(t.is), '\n  ', JSON.stringify(t.oos), t.holmP, JSON.stringify(t.placebo), JSON.stringify(t.sides));
  console.log(JSON.stringify(res.baseline));
}
