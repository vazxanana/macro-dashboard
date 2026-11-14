// Weekly momentum or reversal on spot gold (pre-registered 14 Nov 2026, PREREGISTRATION.md): T1 the sign of last week, T2 the
// sign of the last four weeks, T3 against an extreme week (> 2 sd of the 52 weeks before); entry at next week's first open, stop
// 2 x ATR(20), out at that week's last close; $0.60 a trade and long financing; t on calendar-month sums, Holm over three,
// 40 seeded side-shuffle placebos. Paper research only: nothing live reads this file.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

export const P = {
  ATR_N: 20, ATR_MULT: 2, LOOK4: 4, SD_WEEKS: 52, SD_MULT: 2,
  SPREAD: 0.30, SLIP: 0.15, SEEDS: 40,
  IS: { from: '2008-01', to: '2016-12' }, OOS: { from: '2017-01', to: '2026-10' },
};
export const DATA_COMMIT = '2e8d6a5c0';
const DIR = fileURLToPath(new URL('.', import.meta.url));
const DAY = 86400;

export const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export const toBars = (rows) => foldWeekend(rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })));
export function monthsOf(w) {
  const out = []; let [y, m] = w.from.split('-').map(Number);
  const [ty, tm] = w.to.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } }
  return out;
}

// Monday (UTC) of the calendar week holding t
export const weekKey = (t) => { const d = Math.floor(t / DAY); return (d - ((new Date(t * 1000).getUTCDay() + 6) % 7)) * DAY; };
// weeks: { key, a, b (first / last daily index), open, close, r }; a last week not ending on a Friday is left out
export function weeksOf(bars) {
  const W = [];
  bars.forEach((b, i) => {
    const k = weekKey(b.time), w = W.at(-1);
    if (w && w.key === k) { w.b = i; w.close = b.close; } else W.push({ key: k, a: i, b: i, open: b.open, close: b.close });
  });
  if (W.length && new Date(bars[W.at(-1).b].time * 1000).getUTCDay() !== 5) W.pop();
  for (const w of W) w.r = w.close / w.open - 1;
  return W;
}
export function atr(bars, i, n = P.ATR_N) {
  if (i < n) return null;
  let a = 0;
  for (let j = i - n + 1; j <= i; j++) a += Math.max(bars[j].high - bars[j].low, Math.abs(bars[j].high - bars[j - 1].close), Math.abs(bars[j].low - bars[j - 1].close));
  return a / n;
}
const sign = (x) => (x > 0 ? 1 : x < 0 ? -1 : 0);
// side for the week after week k (0 = no trade); reads weeks 0..k only
export const SIGNALS = {
  mom1: (W, k) => sign(W[k].r),
  mom4: (W, k) => (k >= P.LOOK4 - 1 ? sign(W[k].close / W[k - P.LOOK4 + 1].open - 1) : 0),
  rev: (W, k) => {
    if (k < P.SD_WEEKS) return 0;
    const xs = W.slice(k - P.SD_WEEKS, k).map((w) => w.r), m = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
    return Math.abs(W[k].r) > P.SD_MULT * sd ? -sign(W[k].r) : 0;
  },
  long: () => 1,
};

// one trade in week k+1, signal at the close of week k
export function trade(bars, W, k, side, { costX = 1 } = {}) {
  const nw = W[k + 1]; if (!nw || !side) return null;
  const a = atr(bars, W[k].b); if (!a) return null;
  const e = nw.a, entry = bars[e].open, dist = P.ATR_MULT * a, stop = entry - side * dist;
  let exit = bars[nw.b].close, how = 'time', xi = nw.b, exitTime = bars[nw.b].time + 22 * 3600;
  for (let i = e; i <= nw.b; i++) {
    const b = bars[i];
    if (i > e && (side > 0 ? b.open <= stop : b.open >= stop)) { exit = b.open; how = 'gap'; xi = i; exitTime = b.time; break; }
    if (side > 0 ? b.low <= stop : b.high >= stop) { exit = stop; how = 'stop'; xi = i; exitTime = b.time; break; }
  }
  const gross = side * (exit - entry) / dist;
  const costR = costX * (P.SPREAD + 2 * P.SLIP) / dist;
  const n = side > 0 ? nights(bars[e].time, exitTime) : 0;
  const finR = side > 0 ? costX * n * FIN.xau.long * entry / dist : 0;
  return { k, side, week: new Date(nw.key * 1000).toISOString().slice(0, 10), exitMonth: ym(bars[xi].time), entry, stop, exit, dist,
    how, gross, costR, finR, nights: n, net: gross - costR - finR };
}
export function runTest(bars, W, sig, opt = {}) {
  const out = [];
  for (let k = 0; k + 1 < W.length; k++) { const t = trade(bars, W, k, SIGNALS[sig](W, k), opt); if (t) out.push(t); }
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
export function window(trades, w, trades2x) {
  const inW = trades.filter((t) => t.exitMonth >= w.from && t.exitMonth <= w.to), n = inW.length;
  const net = monthly(trades, w, 'net'), gross = monthly(trades, w, 'gross'), tn = tstat(net), tg = tstat(gross);
  const per = (f) => (n ? inW.reduce((a, t) => a + t[f], 0) / n : 0);
  const o = { trades: n, longs: inW.filter((t) => t.side > 0).length, months: net.length, won: n ? r3(inW.filter((t) => t.net > 0).length / n) : 0,
    stopped: n ? r3(inW.filter((t) => t.how !== 'time').length / n) : 0,
    grossR: r3(per('gross')), netR: r3(per('net')), costR: r3(per('costR')), finR: r3(per('finR')),
    monthGross: r3(tg.mean), monthGrossT: r2(tg.t), monthNet: r3(tn.mean), monthNetT: r2(tn.t),
    totalNet: r2(net.reduce((a, b) => a + b, 0)), worstDD: r2(drawdown(net)) };
  if (trades2x) { const t2 = tstat(monthly(trades2x, w, 'net')); o.x2Net = r3(t2.mean); o.x2T = r2(t2.t); }
  return o;
}
const legs = (tr, w) => Object.fromEntries([['long', 1], ['short', -1]].map(([k, s]) => {
  const x = window(tr.filter((t) => t.side === s), w); return [k, { trades: x.trades, grossR: x.grossR, netR: x.netR, monthNetT: x.monthNetT, totalNet: x.totalNet }];
}));

// ─── placebo: the test's own trades, sides shuffled among them (same long / short share) ───
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function placebo(bars, W, real, seed) {
  const rng = mulberry32(seed), sides = real.map((t) => t.side);
  for (let i = sides.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [sides[i], sides[j]] = [sides[j], sides[i]]; }
  return real.map((t, i) => trade(bars, W, t.k, sides[i])).filter(Boolean);
}

export const TESTS = [
  { id: 'T1', name: 'One-week momentum (primary)', sig: 'mom1' },
  { id: 'T2', name: 'Four-week momentum', sig: 'mom4' },
  { id: 'T3', name: 'Reversal after a week over 2 sd', sig: 'rev' },
];

export function study(bars) {
  const W = weeksOf(bars);
  const tests = TESTS.map((T) => {
    const tr = runTest(bars, W, T.sig), tr2 = runTest(bars, W, T.sig, { costX: 2 });
    const is = window(tr, P.IS), oos = window(tr, P.OOS, tr2);
    const pl = []; for (let s = 1; s <= P.SEEDS; s++) pl.push(tstat(monthly(placebo(bars, W, tr, s), P.OOS)).t);
    pl.sort((a, b) => a - b);
    const q = (p) => r2(pl[Math.min(pl.length - 1, Math.floor(p * pl.length))]);
    const years = {};
    for (const t of tr) { if (t.exitMonth > P.OOS.to || t.exitMonth < P.IS.from) continue; const y = t.exitMonth.slice(0, 4); years[y] = years[y] || { n: 0, gross: 0, net: 0 }; years[y].n++; years[y].gross += t.gross; years[y].net += t.net; }
    for (const y in years) { years[y].gross = r2(years[y].gross); years[y].net = r2(years[y].net); }
    return { ...T, is, oos, legs: { is: legs(tr, P.IS), oos: legs(tr, P.OOS) }, pOne: pOne(oos.monthNetT),
      placebo: { p5: q(0.05), p50: q(0.5), p95: q(0.95), max: r2(pl.at(-1)), below: pl.filter((x) => x < oos.monthNetT).length, atOrAbove: pl.filter((x) => x >= oos.monthNetT).length },
      years };
  });
  const hp = holm(tests.map((t) => t.pOne));
  tests.forEach((t, k) => {
    t.holmP = r3(hp[k]); t.pOne = r3(t.pOne);
    t.checks = { oosPositive: t.oos.monthNet > 0, oosT2: t.oos.monthNetT >= 2, holm05: hp[k] < 0.05, isSameSign: t.is.monthNet > 0,
      x2Positive: t.oos.x2Net > 0, abovePlacebo95: t.placebo.below > 38 };
    t.pass = Object.values(t.checks).every(Boolean);
  });
  const al = runTest(bars, W, 'long');
  const alwaysLong = { is: window(al, P.IS), oos: window(al, P.OOS) };
  return { weeks: W.length, firstWeek: new Date(W[0].key * 1000).toISOString().slice(0, 10), lastWeek: new Date(W.at(-1).key * 1000).toISOString().slice(0, 10), tests, alwaysLong };
}

export function verdictLine(res) {
  const pass = res.tests.filter((t) => t.pass).length, T1 = res.tests[0], T3 = res.tests[2];
  const s = (x) => (x >= 0 ? '+' : '') + x;
  return `${pass ? 'PASS' : 'FAIL'}, ${pass} of 3: last week's sign made ${s(T1.oos.netR)}R a trade net 2017-26 (n ${T1.oos.trades}, month t ${T1.oos.monthNetT}); fading a 2-sd week ${s(T3.oos.netR)}R (n ${T3.oos.trades}, t ${T3.oos.monthNetT})`;
}

function fmt(x) { return (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(3); }
function fmtT(x) { return (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(2); }
export function report(res) {
  const L = [];
  L.push('# Weekly momentum or reversal on spot gold: result (14 Nov 2026)', '');
  L.push(`**Verdict: ${verdictLine(res)}.**`, '');
  L.push(`Paper research only. No live rule, size, filter, council member or page changed. Rule, costs, windows, the three tests and the placebo were fixed in \`PREREGISTRATION.md\`, pushed alone (7721466b6) before any week was simulated. Data: council-data \`research/daily/xau.json\` at \`${DATA_COMMIT}\`, OANDA mid daily candles, weekend stubs folded into Monday; ${res.weeks} complete weeks from ${res.firstWeek} to ${res.lastWeek}. A stand-alone rule, not a gate, exit, entry or size of the gold book (owner decision 44); not an edge without n and t.`, '');
  L.push('## The three tests (R a trade, 1R = 2 x ATR(20); monthly sums of net R on every calendar month of the window, by exit month)', '');
  L.push('| Test | Window | Trades | Longs | Won | Stopped | Gross R | Net R | Month net (t) | Month gross t | Total net R | Worst DD R | OOS at 2x costs (t) | One-sided p | Holm p | Pass |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const t of res.tests) {
    const row = (w, lab, last) => `| ${lab === 'IS' ? `${t.id} ${t.name}` : ''} | ${lab === 'IS' ? 'IS 2008-01 to 2016-12' : 'OOS 2017-01 to 2026-10'} | ${w.trades} | ${w.longs} | ${(w.won * 100).toFixed(0)}% | ${(w.stopped * 100).toFixed(0)}% | ${fmt(w.grossR)} | ${fmt(w.netR)} | ${fmt(w.monthNet)} (${fmtT(w.monthNetT)}) | ${fmtT(w.monthGrossT)} | ${fmtT(w.totalNet)} | ${fmtT(w.worstDD)} | ${last ? `${fmt(w.x2Net)} (${fmtT(w.x2T)})` : ''} | ${last ? t.pOne.toFixed(3) : ''} | ${last ? t.holmP.toFixed(3) : ''} | ${last ? (t.pass ? 'yes' : 'no') : ''} |`;
    L.push(row(t.is, 'IS', false), row(t.oos, 'OOS', true));
  }
  const al = res.alwaysLong;
  L.push(`| Always long every week (comparison, not a test) | IS | ${al.is.trades} | ${al.is.longs} | ${(al.is.won * 100).toFixed(0)}% | ${(al.is.stopped * 100).toFixed(0)}% | ${fmt(al.is.grossR)} | ${fmt(al.is.netR)} | ${fmt(al.is.monthNet)} (${fmtT(al.is.monthNetT)}) | ${fmtT(al.is.monthGrossT)} | ${fmtT(al.is.totalNet)} | ${fmtT(al.is.worstDD)} | | | | |`);
  L.push(`| | OOS | ${al.oos.trades} | ${al.oos.longs} | ${(al.oos.won * 100).toFixed(0)}% | ${(al.oos.stopped * 100).toFixed(0)}% | ${fmt(al.oos.grossR)} | ${fmt(al.oos.netR)} | ${fmt(al.oos.monthNet)} (${fmtT(al.oos.monthNetT)}) | ${fmtT(al.oos.monthGrossT)} | ${fmtT(al.oos.totalNet)} | ${fmtT(al.oos.worstDD)} | | | | |`);
  L.push('', 'Pass bar (pre-registered, each test on its own, Holm over three): OOS net month mean > 0 with t >= 2 and Holm p < 0.05, the in-sample mean > 0, the OOS mean > 0 at 2x costs and financing, the OOS t above the placebo\'s 95th percentile.', '');
  L.push('| Check | ' + res.tests.map((t) => t.id).join(' | ') + ' |', '|---|' + res.tests.map(() => '---').join('|') + '|');
  for (const k of Object.keys(res.tests[0].checks)) L.push(`| ${k} | ` + res.tests.map((t) => (t.checks[k] ? 'yes' : 'no')).join(' | ') + ' |');
  L.push('', '## Long and short legs apart (net R a trade, month t of the leg alone)', '');
  L.push('| Test | Window | Long n | Long gross R | Long net R | Long t | Long total | Short n | Short gross R | Short net R | Short t | Short total |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const t of res.tests) for (const [w, lab] of [['is', 'IS'], ['oos', 'OOS']]) {
    const g = t.legs[w];
    L.push(`| ${w === 'is' ? t.id : ''} | ${lab} | ${g.long.trades} | ${fmt(g.long.grossR)} | ${fmt(g.long.netR)} | ${fmtT(g.long.monthNetT)} | ${fmtT(g.long.totalNet)} | ${g.short.trades} | ${fmt(g.short.grossR)} | ${fmt(g.short.netR)} | ${fmtT(g.short.monthNetT)} | ${fmtT(g.short.totalNet)} |`);
  }
  L.push('', '## Placebo (40 seeds: each test\'s own trades with their sides shuffled among them, same long / short share, same weeks, stops and costs; OOS net month t)', '');
  L.push('| Test | p5 | p50 | p95 | max | Real | Seeds below the real |', '|---|---|---|---|---|---|---|');
  for (const t of res.tests) L.push(`| ${t.id} | ${fmtT(t.placebo.p5)} | ${fmtT(t.placebo.p50)} | ${fmtT(t.placebo.p95)} | ${fmtT(t.placebo.max)} | ${fmtT(t.oos.monthNetT)} | ${t.placebo.below} of 40 |`);
  L.push('', '## Per year (sum of net R by exit year)', '');
  const ys = [...new Set(res.tests.flatMap((t) => Object.keys(t.years)))].sort();
  L.push('| Year | ' + res.tests.map((t) => `${t.id} n | ${t.id} net`).join(' | ') + ' |', '|---|' + res.tests.map(() => '---|---').join('|') + '|');
  for (const y of ys) L.push(`| ${y} | ` + res.tests.map((t) => (t.years[y] ? `${t.years[y].n} | ${fmtT(t.years[y].net)}` : '0 | 0')).join(' | ') + ' |');
  L.push('', '## Reading', '');
  return L;
}

// written after the run; the figures it quotes are checked against result.json by tests/gold-weekly-momentum.test.mjs
export const READING = [
  '- **One-week momentum (T1) is small and not separate from noise.** Out of sample it made +0.029R a trade net (n 513, month t 0.95; +0.062R gross, month gross t 1.99); spread and slippage (0.014R) and financing (0.019R) take about half of the gross. In sample +0.007R (n 470, t 0.23). At 2x costs it loses (−0.016R a month). Holm p 0.513. Its sides did beat 39 of 40 shuffles of the same sides (placebo 95th percentile t 0.42), so the ordering carries a little information, but far under the t of 2 the bar asks for.',
  '- **Most of it is gold\'s long drift.** Always long every week made +0.045R a trade net out of sample (n 513, month t 1.34, +23.27R in total) against T1\'s +15.01R. T1\'s long leg (weeks after an up week) made +0.090R (n 290, t 1.92, +26.23R) and its short leg lost −0.050R (n 223, t −1.22, −11.22R): the shorts cost more than the selection of long weeks added. In sample both legs are about flat (+0.011R and +0.004R).',
  '- **Four-week momentum (T2) is flat**: −0.003R out of sample (n 513, t −0.08), −0.014R in sample; its shorts lost −0.099R a trade out of sample (t −2.48).',
  '- **Fading an extreme week (T3) is thin and negative**: 28 trades out of sample, −0.061R (t −0.29); 29 in sample, −0.171R (t −1.41). Too few to say anything beyond "no sign of reversal".',
  '- Nothing proposed. Not an edge, not a gate on the gold book; nothing live changed. A long-only "after an up week" variant was not pre-registered and is not tested here (chosen after seeing the legs: not evidence).',
];

export function load(file) {
  const txt = file ? fs.readFileSync(file, 'utf8') : execFileSync('git', ['show', `${DATA_COMMIT}:research/daily/xau.json`], { encoding: 'utf8', maxBuffer: 64e6 });
  return toBars(JSON.parse(txt).rows);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const bars = load(process.argv[2]);
  const res = study(bars);
  const out = { study: 'gold-weekly-momentum', built: '2026-11-14', dataCommit: DATA_COMMIT, params: P, fin: FIN.xau.long,
    verdict: res.tests.some((t) => t.pass) ? 'PASS' : 'FAIL', headline: verdictLine(res), ...res };
  fs.writeFileSync(DIR + 'result.json', JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(DIR + 'RESULT.md', [...report(res), ...READING].join('\n') + '\n');
  console.log(verdictLine(res), verdictLine(res).length);
  for (const t of res.tests) console.log(t.id, JSON.stringify(t.is), '\n  ', JSON.stringify(t.oos), t.holmP, JSON.stringify(t.placebo), JSON.stringify(t.legs));
  console.log('AL', JSON.stringify(res.alwaysLong));
}
