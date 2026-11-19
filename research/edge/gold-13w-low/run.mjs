// Gold after a weekly close at a 13-week low (pre-registered 14 Nov 2026, PREREGISTRATION.md, commit 3fce40edc): T1 long for four
// weeks after a 13-week closing low, T2 the same held one week, T3 short for four weeks after a 13-week closing high; entry at the
// next week's first open, stop 3 x ATR(20) (2 x for T2), one position at a time; $0.60 a trade and long financing; t on
// calendar-month sums, Holm over three, 40 seeded random-timing placebos. Paper research only: nothing live reads this file.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

export const P = {
  LOOK: 12, ATR_N: 20, SPREAD: 0.30, SLIP: 0.15, SEEDS: 40,
  IS: { from: '2008-01', to: '2016-12' }, OOS: { from: '2017-01', to: '2026-10' },
};
export const DATA_COMMIT = 'f6288251e';
export const PREREG_COMMIT = '3fce40edc';
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
export const weekKey = (t) => { const d = Math.floor(t / DAY); return (d - ((new Date(t * 1000).getUTCDay() + 6) % 7)) * DAY; };
export function weeksOf(bars) {
  const W = [];
  bars.forEach((b, i) => {
    const k = weekKey(b.time), w = W.at(-1);
    if (w && w.key === k) { w.b = i; w.close = b.close; } else W.push({ key: k, a: i, b: i, open: b.open, close: b.close });
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
// events at the close of week k; read weeks k-12 .. k only
export function lowEvent(W, k) {
  if (k < P.LOOK) return false;
  for (let j = k - P.LOOK; j < k; j++) if (!(W[k].close < W[j].close)) return false;
  return true;
}
export function highEvent(W, k) {
  if (k < P.LOOK) return false;
  for (let j = k - P.LOOK; j < k; j++) if (!(W[k].close > W[j].close)) return false;
  return true;
}

export const TESTS = [
  { id: 'T1', name: 'Long 4 weeks after a 13-week closing low (primary)', ev: 'low', side: 1, hold: 4, mult: 3 },
  { id: 'T2', name: 'Long 1 week after a 13-week closing low', ev: 'low', side: 1, hold: 1, mult: 2 },
  { id: 'T3', name: 'Short 4 weeks after a 13-week closing high', ev: 'high', side: -1, hold: 4, mult: 3 },
];

// one trade: signal at the close of week k, entry at week k+1's first open, out at the close of week k+hold or at the stop
export function trade(bars, W, k, T, { costX = 1 } = {}) {
  const last = W[k + T.hold]; if (!last) return null;
  const a = atr(bars, W[k].b); if (!a) return null;
  const side = T.side, e = W[k + 1].a, entry = bars[e].open, dist = T.mult * a, stop = entry - side * dist;
  let exit = bars[last.b].close, how = 'time', xi = last.b, exitTime = bars[last.b].time + 22 * 3600;
  for (let i = e; i <= last.b; i++) {
    const b = bars[i];
    if (i > e && (side > 0 ? b.open <= stop : b.open >= stop)) { exit = b.open; how = 'gap'; xi = i; exitTime = b.time; break; }
    if (side > 0 ? b.low <= stop : b.high >= stop) { exit = stop; how = 'stop'; xi = i; exitTime = b.time; break; }
  }
  const gross = side * (exit - entry) / dist;
  const costR = costX * (P.SPREAD + 2 * P.SLIP) / dist;
  const n = side > 0 ? nights(bars[e].time, exitTime) : 0;
  const finR = side > 0 ? costX * n * FIN.xau.long * entry / dist : 0;
  const exitWeek = W.findIndex((w, j) => j > k && w.a <= xi && xi <= w.b);
  return { k, side, week: new Date(W[k + 1].key * 1000).toISOString().slice(0, 10), exitMonth: ym(bars[xi].time), exitWeek,
    entry, stop, exit, dist, how, gross, costR, finR, nights: n, net: gross - costR - finR };
}
export function runTest(bars, W, T, opt = {}) {
  const out = []; let free = 0;
  for (let k = 0; k + T.hold < W.length; k++) {
    if (k < free) continue;
    const ev = T.ev === 'low' ? lowEvent(W, k) : T.ev === 'high' ? highEvent(W, k) : T.ev === 'every' ? (k - P.LOOK) % T.hold === 0 && k >= P.LOOK : false;
    if (!ev) continue;
    const t = trade(bars, W, k, T, opt); if (!t) continue;
    out.push(t); free = t.exitWeek;
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
export function window(trades, w, trades2x) {
  const inW = trades.filter((t) => inWin(t, w)), n = inW.length;
  const net = monthly(trades, w, 'net'), gross = monthly(trades, w, 'gross'), tn = tstat(net), tg = tstat(gross);
  const per = (f) => (n ? inW.reduce((a, t) => a + t[f], 0) / n : 0);
  const o = { trades: n, months: net.length, won: n ? r3(inW.filter((t) => t.net > 0).length / n) : 0,
    stopped: n ? r3(inW.filter((t) => t.how !== 'time').length / n) : 0,
    grossR: r3(per('gross')), netR: r3(per('net')), costR: r3(per('costR')), finR: r3(per('finR')),
    monthGross: r3(tg.mean), monthGrossT: r2(tg.t), monthNet: r3(tn.mean), monthNetT: r2(tn.t),
    totalNet: r2(net.reduce((a, b) => a + b, 0)), worstDD: r2(drawdown(net)) };
  if (trades2x) { const t2 = tstat(monthly(trades2x, w, 'net')); o.x2Net = r3(t2.mean); o.x2T = r2(t2.t); }
  return o;
}

// ─── placebo: each real trade's signal week replaced by a random week whose trade exits in the same window ───
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function pool(bars, W, T) {
  const all = [];
  for (let k = P.LOOK; k + T.hold < W.length; k++) { const t = trade(bars, W, k, T); if (t) all.push(t); }
  return { is: all.filter((t) => inWin(t, P.IS)), oos: all.filter((t) => inWin(t, P.OOS)) };
}
export function placebo(real, pl, seed) {
  const rng = mulberry32(seed), out = [];
  for (const t of real) {
    const src = inWin(t, P.OOS) ? pl.oos : inWin(t, P.IS) ? pl.is : null;
    if (src && src.length) out.push(src[Math.floor(rng() * src.length)]);
  }
  return out;
}

export function study(bars) {
  const W = weeksOf(bars);
  const tests = TESTS.map((T) => {
    const tr = runTest(bars, W, T), tr2 = runTest(bars, W, T, { costX: 2 });
    const is = window(tr, P.IS), oos = window(tr, P.OOS, tr2);
    const pp = pool(bars, W, T), pl = [];
    for (let s = 1; s <= P.SEEDS; s++) pl.push(tstat(monthly(placebo(tr, pp, s), P.OOS)).t);
    pl.sort((a, b) => a - b);
    const q = (p) => r2(pl[Math.min(pl.length - 1, Math.floor(p * pl.length))]);
    const years = {};
    for (const t of tr) { if (t.exitMonth > P.OOS.to || t.exitMonth < P.IS.from) continue; const y = t.exitMonth.slice(0, 4); years[y] = years[y] || { n: 0, gross: 0, net: 0 }; years[y].n++; years[y].gross += t.gross; years[y].net += t.net; }
    for (const y in years) { years[y].gross = r2(years[y].gross); years[y].net = r2(years[y].net); }
    return { ...T, is, oos, pOne: pOne(oos.monthNetT),
      placebo: { p5: q(0.05), p50: q(0.5), p95: q(0.95), max: r2(pl.at(-1)), below: pl.filter((x) => x < oos.monthNetT).length },
      years, trades: tr.filter((t) => t.exitMonth >= P.IS.from && t.exitMonth <= P.OOS.to).map((t) => ({ week: t.week, exitMonth: t.exitMonth, how: t.how, gross: r3(t.gross), net: r3(t.net) })) };
  });
  const hp = holm(tests.map((t) => t.pOne));
  tests.forEach((t, k) => {
    t.holmP = r3(hp[k]); t.pOne = r3(t.pOne);
    t.checks = { oosPositive: t.oos.monthNet > 0, oosT2: t.oos.monthNetT >= 2, holm05: hp[k] < 0.05, isSameSign: t.is.monthNet > 0,
      x2Positive: t.oos.x2Net > 0, abovePlacebo95: t.placebo.below > 38 };
    t.pass = Object.values(t.checks).every(Boolean);
  });
  const ev = runTest(bars, W, { ev: 'every', side: 1, hold: 4, mult: 3 });
  const everyFourth = { is: window(ev, P.IS), oos: window(ev, P.OOS) };
  return { weeks: W.length, firstWeek: new Date(W[0].key * 1000).toISOString().slice(0, 10), lastWeek: new Date(W.at(-1).key * 1000).toISOString().slice(0, 10), tests, everyFourth };
}

const s = (x) => (x >= 0 ? '+' : '') + x;
export function verdictLine(res) {
  const pass = res.tests.filter((t) => t.pass).length, [T1, , T3] = res.tests;
  return `${pass ? 'PASS' : 'FAIL'}, ${pass} of 3: buying 4 weeks after a 13-week closing low made ${s(T1.oos.netR)}R a trade net 2017-26 (n ${T1.oos.trades}, month t ${T1.oos.monthNetT}); fading a 13-week high ${s(T3.oos.netR)}R (n ${T3.oos.trades}, t ${T3.oos.monthNetT})`;
}

function fmt(x) { return (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(3); }
function fmtT(x) { return (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(2); }
export function report(res) {
  const L = [];
  L.push('# Gold after a weekly close at a 13-week low: result (14 Nov 2026)', '');
  L.push(`**Verdict: ${verdictLine(res)}.**`, '');
  L.push(`Paper research only. No live rule, size, filter, council member or page changed. Rule, costs, windows, the three tests and the placebo were fixed in \`PREREGISTRATION.md\`, pushed alone (${PREREG_COMMIT}) before any week was simulated. Data: council-data \`research/daily/xau.json\` at \`${DATA_COMMIT}\`, OANDA mid daily candles, weekend stubs folded into Monday; ${res.weeks} complete weeks from ${res.firstWeek} to ${res.lastWeek}. A stand-alone rule, not a gate, exit, entry or size of the gold book (owner decision 44); not an edge without n and t.`, '');
  L.push('## The three tests (R a trade, 1R = the stop distance; monthly sums of net R on every calendar month of the window, by exit month)', '');
  L.push('| Test | Window | Trades | Won | Stopped | Gross R | Net R | Month net (t) | Month gross t | Total net R | Worst DD R | OOS at 2x costs (t) | One-sided p | Holm p | Pass |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const t of res.tests) {
    const row = (w, lab, last) => `| ${lab === 'IS' ? `${t.id} ${t.name}` : ''} | ${lab === 'IS' ? 'IS 2008-01 to 2016-12' : 'OOS 2017-01 to 2026-10'} | ${w.trades} | ${(w.won * 100).toFixed(0)}% | ${(w.stopped * 100).toFixed(0)}% | ${fmt(w.grossR)} | ${fmt(w.netR)} | ${fmt(w.monthNet)} (${fmtT(w.monthNetT)}) | ${fmtT(w.monthGrossT)} | ${fmtT(w.totalNet)} | ${fmtT(w.worstDD)} | ${last ? `${fmt(w.x2Net)} (${fmtT(w.x2T)})` : ''} | ${last ? t.pOne.toFixed(3) : ''} | ${last ? t.holmP.toFixed(3) : ''} | ${last ? (t.pass ? 'yes' : 'no') : ''} |`;
    L.push(row(t.is, 'IS', false), row(t.oos, 'OOS', true));
  }
  const ef = res.everyFourth;
  for (const [w, lab] of [[ef.is, 'IS'], [ef.oos, 'OOS']]) L.push(`| ${lab === 'IS' ? 'Long every fourth week, 4-week hold (comparison, not a test)' : ''} | ${lab} | ${w.trades} | ${(w.won * 100).toFixed(0)}% | ${(w.stopped * 100).toFixed(0)}% | ${fmt(w.grossR)} | ${fmt(w.netR)} | ${fmt(w.monthNet)} (${fmtT(w.monthNetT)}) | ${fmtT(w.monthGrossT)} | ${fmtT(w.totalNet)} | ${fmtT(w.worstDD)} | | | | |`);
  L.push('', 'Pass bar (pre-registered, each test on its own, Holm over three): OOS net month mean > 0 with t >= 2 and Holm p < 0.05, the in-sample mean > 0, the OOS mean > 0 at 2x costs and financing, the OOS t above the placebo\'s 95th percentile.', '');
  L.push('| Check | ' + res.tests.map((t) => t.id).join(' | ') + ' |', '|---|' + res.tests.map(() => '---').join('|') + '|');
  for (const k of Object.keys(res.tests[0].checks)) L.push(`| ${k} | ` + res.tests.map((t) => (t.checks[k] ? 'yes' : 'no')).join(' | ') + ' |');
  L.push('', '## Placebo (40 seeds: each real trade\'s signal week replaced by a random week whose trade, same side, hold and stop rule, exits in the same window; OOS net month t)', '');
  L.push('| Test | p5 | p50 | p95 | max | Real | Seeds below the real |', '|---|---|---|---|---|---|---|');
  for (const t of res.tests) L.push(`| ${t.id} | ${fmtT(t.placebo.p5)} | ${fmtT(t.placebo.p50)} | ${fmtT(t.placebo.p95)} | ${fmtT(t.placebo.max)} | ${fmtT(t.oos.monthNetT)} | ${t.placebo.below} of 40 |`);
  L.push('', '## Per year (sum of net R by exit year)', '');
  const ys = [...new Set(res.tests.flatMap((t) => Object.keys(t.years)))].sort();
  L.push('| Year | ' + res.tests.map((t) => `${t.id} n | ${t.id} net`).join(' | ') + ' |', '|---|' + res.tests.map(() => '---|---').join('|') + '|');
  for (const y of ys) L.push(`| ${y} | ` + res.tests.map((t) => (t.years[y] ? `${t.years[y].n} | ${fmtT(t.years[y].net)}` : '0 | 0')).join(' | ') + ' |');
  L.push('', '## Reading', '');
  return L;
}

// written after the run; the figures it quotes are checked against result.json by tests/gold-13w-low.test.mjs
export const READING = [
  '- **Buying a 13-week closing low (T1) does not beat buying at random.** Out of sample it made +0.043R a trade net (n 25, month t 0.20; +0.147R gross); financing on a four-week hold takes 0.093R of it and spread and slippage 0.011R. In sample −0.033R (n 37, t −0.23). At 2x costs it loses. The same number of long four-week holds started in random weeks gave a median t of 0.96: the real t sits below 32 of 40 seeds, so the 13-week low picked WORSE entries than chance.',
  '- **Gold\'s drift is the whole story.** Long every fourth week (same hold, stop and costs) made +0.145R a trade net out of sample (n 129, month t 1.69, +18.73R) against T1\'s +1.07R. Only 25 low events fell in 2017-26, a rising market: few chances, and those few did not bounce more than any other week.',
  '- **The one-week bounce (T2) is negative out of sample**: −0.110R a trade net (n 41, t −1.04), flat in sample (+0.001R, n 64).',
  '- **Fading a 13-week high (T3) lost**: −0.333R a trade out of sample (n 62, t −2.65), −0.143R in sample (n 46, t −0.89). Random four-week shorts lost too (placebo median t −1.61), so most of it is shorting a rising market; the real t sits below 32 of 40 seeds. A long-after-a-13-week-high rule was not pre-registered and is not tested here (seen after the result: not evidence; `gold-record-high` tested the 52-week version and failed).',
  '- Nothing proposed. Not an edge, not a gate on the gold book; nothing live changed.',
];

export function load(file) {
  const txt = file ? fs.readFileSync(file, 'utf8') : execFileSync('git', ['show', `${DATA_COMMIT}:research/daily/xau.json`], { encoding: 'utf8', maxBuffer: 64e6 });
  return toBars(JSON.parse(txt).rows);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const bars = load(process.argv[2]);
  const res = study(bars);
  const out = { study: 'gold-13w-low', built: '2026-11-14', dataCommit: DATA_COMMIT, preregCommit: PREREG_COMMIT, params: P, fin: FIN.xau.long,
    verdict: res.tests.some((t) => t.pass) ? 'PASS' : 'FAIL', headline: verdictLine(res), ...res };
  fs.writeFileSync(DIR + 'result.json', JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(DIR + 'RESULT.md', [...report(res), ...READING].join('\n') + '\n');
  console.log(verdictLine(res), verdictLine(res).length);
  for (const t of res.tests) console.log(t.id, JSON.stringify(t.is), '\n  ', JSON.stringify(t.oos), t.holmP, JSON.stringify(t.placebo));
  console.log('EF', JSON.stringify(res.everyFourth));
}
