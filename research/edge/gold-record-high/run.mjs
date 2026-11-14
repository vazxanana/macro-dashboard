// Gold after a new record closing high (pre-registered 14 Nov 2026, PREREGISTRATION.md): long after an all-time closing high
// (T1), long after a 52-week closing high (T2), short after a 52-week closing high (T3); entry at the next open, stop 3 x ATR(20),
// out at the close of the 20th candle, one position at a time; $0.60 a trade and long financing; t on calendar-month sums,
// Holm over three, 40 seeded random-day placebos. Paper research only: nothing live reads this file.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

export const P = {
  ATR_N: 20, ATR_MULT: 3, HOLD: 20, H52: 252, PRIOR_RECORD: 850, GAP: 60,
  SPREAD: 0.30, SLIP: 0.15, SEEDS: 40,
  IS: { from: '2008-01', to: '2016-12' }, OOS: { from: '2017-01', to: '2026-10' },
};
export const DATA_COMMIT = '389931b46';
const DIR = fileURLToPath(new URL('.', import.meta.url));

export const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export const yr = (t) => new Date(t * 1000).getUTCFullYear();
export const toBars = (rows) => foldWeekend(rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })));
export function monthsOf(w) {
  const out = []; let [y, m] = w.from.split('-').map(Number);
  const [ty, tm] = w.to.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } }
  return out;
}

// ─── signals: index i uses closes 0..i only ───
export function athSignals(bars, prior = P.PRIOR_RECORD) {
  let mx = prior; return bars.map((b) => { const s = b.close > mx; if (s) mx = b.close; return s; });
}
export function h52Signals(bars, n = P.H52) {
  return bars.map((b, i) => {
    if (i < n) return false;
    let h = -Infinity; for (let j = i - n; j < i; j++) h = Math.max(h, bars[j].close);
    return b.close > h;
  });
}
// all-time highs with more than `gap` candles since the previous one (the first ever counts)
export function firstAfterGap(ath, gap = P.GAP) {
  let last = -Infinity; return ath.map((s, i) => { if (!s) return false; const f = i - last > gap; last = i; return f; });
}
export function atr(bars, i, n = P.ATR_N) {
  if (i < n) return null;
  let a = 0;
  for (let j = i - n + 1; j <= i; j++) a += Math.max(bars[j].high - bars[j].low, Math.abs(bars[j].high - bars[j - 1].close), Math.abs(bars[j].low - bars[j - 1].close));
  return a / n;
}

// ─── one trade from signal candle s: enter at bars[s+1].open ───
export function trade(bars, s, side, { costX = 1 } = {}) {
  const e = s + 1, last = e + P.HOLD - 1, a = atr(bars, s);
  if (!a || last >= bars.length) return null;
  const entry = bars[e].open, dist = P.ATR_MULT * a, stop = entry - side * dist;
  let exit = bars[last].close, how = 'time', xi = last, exitTime = bars[last].time + 86400;
  for (let i = e; i <= last; i++) {
    const b = bars[i];
    if (i > e && (side > 0 ? b.open <= stop : b.open >= stop)) { exit = b.open; how = 'gap'; xi = i; exitTime = b.time; break; }
    if (side > 0 ? b.low <= stop : b.high >= stop) { exit = stop; how = 'stop'; xi = i; exitTime = b.time; break; }
  }
  const gross = side * (exit - entry) / dist;
  const costR = costX * (P.SPREAD + 2 * P.SLIP) / dist;
  const n = side > 0 ? nights(bars[e].time, exitTime) : 0;
  const finR = side > 0 ? costX * n * FIN.xau.long * entry / dist : 0;
  return { s, e, xi, side, signal: bars[s].time, entryTime: bars[e].time, exitMonth: ym(bars[xi].time), entry, stop, exit, dist,
    how, gross, costR, finR, nights: n, net: gross - costR - finR };
}
// one position at a time: a signal on or after the previous exit candle may open the next
export function runTest(bars, sig, side, opt = {}) {
  const out = []; let free = 0;
  for (let i = 0; i < bars.length; i++) {
    if (!sig[i] || i < free) continue;
    const t = trade(bars, i, side, opt); if (!t) continue;
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
export function window(trades, w, trades2x) {
  const inW = trades.filter((t) => t.exitMonth >= w.from && t.exitMonth <= w.to), n = inW.length;
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

// ─── placebo ───
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function placebo(bars, real, side, seed) {
  const rng = mulberry32(seed), byYear = new Map();
  bars.forEach((b, i) => { if (i >= P.ATR_N && i + P.HOLD < bars.length) { const y = yr(b.time); if (!byYear.has(y)) byYear.set(y, []); byYear.get(y).push(i); } });
  return real.map((t) => { const pool = byYear.get(yr(bars[t.s].time)); return trade(bars, pool[Math.floor(rng() * pool.length)], side); }).filter(Boolean);
}

export const TESTS = [
  { id: 'T1', name: 'Long after an all-time closing high (primary)', sig: 'ath', side: 1 },
  { id: 'T2', name: 'Long after a 52-week closing high', sig: 'h52', side: 1 },
  { id: 'T3', name: 'Short (fade) after a 52-week closing high', sig: 'h52', side: -1 },
];

export function study(bars) {
  const sigs = { ath: athSignals(bars), h52: h52Signals(bars) };
  const tests = TESTS.map((T) => {
    const tr = runTest(bars, sigs[T.sig], T.side), tr2 = runTest(bars, sigs[T.sig], T.side, { costX: 2 });
    const is = window(tr, P.IS), oos = window(tr, P.OOS, tr2);
    const pl = []; for (let s = 1; s <= P.SEEDS; s++) pl.push(tstat(monthly(placebo(bars, tr, T.side, s), P.OOS)).t);
    pl.sort((a, b) => a - b);
    const q = (p) => r2(pl[Math.min(pl.length - 1, Math.floor(p * pl.length))]);
    const years = {};
    for (const t of tr) { const y = t.exitMonth.slice(0, 4); if (t.exitMonth > P.OOS.to || t.exitMonth < P.IS.from) continue; years[y] = years[y] || { n: 0, gross: 0, net: 0 }; years[y].n++; years[y].gross += t.gross; years[y].net += t.net; }
    for (const y in years) { years[y].gross = r2(years[y].gross); years[y].net = r2(years[y].net); }
    return { ...T, is, oos, pOne: pOne(oos.monthNetT), placebo: { p5: q(0.05), p50: q(0.5), p95: q(0.95), max: r2(pl.at(-1)), atOrAbove: pl.filter((x) => x >= oos.monthNetT).length },
      years, trades: tr.filter((t) => t.exitMonth <= P.OOS.to).map((t) => ({ signal: new Date(t.signal * 1000).toISOString().slice(0, 10), exitMonth: t.exitMonth, entry: r2(t.entry), stop: r2(t.stop), exit: r2(t.exit), how: t.how, gross: r3(t.gross), net: r3(t.net) })) };
  });
  const hp = holm(tests.map((t) => t.pOne));
  tests.forEach((t, k) => {
    t.holmP = r3(hp[k]); t.pOne = r3(t.pOne);
    t.checks = { oosPositive: t.oos.monthNet > 0, oosT2: t.oos.monthNetT >= 2, holm05: hp[k] < 0.05, isSameSign: t.is.monthNet > 0, x2Positive: t.oos.x2Net > 0 };
    t.pass = Object.values(t.checks).every(Boolean);
  });
  const fg = firstAfterGap(sigs.ath);
  const gapTrades = []; fg.forEach((s, i) => { if (s) { const t = trade(bars, i, 1); if (t) gapTrades.push({ signal: new Date(t.signal * 1000).toISOString().slice(0, 10), how: t.how, gross: r3(t.gross), net: r3(t.net) }); } });
  return { tests, firstAfterGap: gapTrades };
}

export function verdictLine(res) {
  const T1 = res.tests[0], pass = res.tests.filter((t) => t.pass).length;
  return `${T1.pass ? 'PASS' : 'FAIL'}: long 20 days after an all-time closing high made ${T1.oos.netR >= 0 ? '+' : ''}${T1.oos.netR}R a trade net 2017-26 (n ${T1.oos.trades}, month t ${T1.oos.monthNetT}); ${pass} of 3 tests pass`;
}

function fmt(x) { return (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(3); }
function fmtT(x) { return (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(2); }
export function report(res) {
  const L = [];
  L.push('# Gold after a new record closing high: result (14 Nov 2026)', '');
  L.push(`**Verdict: ${verdictLine(res)}.**`, '');
  L.push('Paper research only. No live rule, size, filter, council member or page changed. Rule, costs, windows, the three tests and the placebo were fixed in `PREREGISTRATION.md`, pushed alone before any trade was simulated. Data: council-data `research/daily/xau.json` at `' + DATA_COMMIT + '`, OANDA mid daily candles, weekend stubs folded into Monday. Not a gate, exit, entry or size of the gold book (owner decision 44); not an edge without n and t.', '');
  L.push('## The three tests (R a trade; monthly sums of net R on every calendar month of the window, by exit month)', '');
  L.push('| Test | Window | Trades | Won | Stopped | Gross R | Net R | Month net (t) | Month gross t | Total net R | Worst DD R | OOS at 2x costs (t) | One-sided p | Holm p | Pass |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const t of res.tests) {
    const row = (w, lab, last) => `| ${lab === 'IS' ? `${t.id} ${t.name}` : ''} | ${lab === 'IS' ? 'IS 2008-01 to 2016-12' : 'OOS 2017-01 to 2026-10'} | ${w.trades} | ${(w.won * 100).toFixed(0)}% | ${(w.stopped * 100).toFixed(0)}% | ${fmt(w.grossR)} | ${fmt(w.netR)} | ${fmt(w.monthNet)} (${fmtT(w.monthNetT)}) | ${fmtT(w.monthGrossT)} | ${fmtT(w.totalNet)} | ${fmtT(w.worstDD)} | ${last ? `${fmt(w.x2Net)} (${fmtT(w.x2T)})` : ''} | ${last ? t.pOne.toFixed(3) : ''} | ${last ? t.holmP.toFixed(3) : ''} | ${last ? (t.pass ? 'yes' : 'no') : ''} |`;
    L.push(row(t.is, 'IS', false), row(t.oos, 'OOS', true));
  }
  L.push('', 'Pass bar (pre-registered, judged on T1; T2 / T3 against the same bar as secondary findings): OOS net month mean > 0 with t >= 2 and Holm p < 0.05, the in-sample mean of the same sign, the OOS mean > 0 at 2x costs and financing.', '');
  L.push('| Check | ' + res.tests.map((t) => t.id).join(' | ') + ' |', '|---|' + res.tests.map(() => '---').join('|') + '|');
  for (const k of Object.keys(res.tests[0].checks)) L.push(`| ${k} | ` + res.tests.map((t) => (t.checks[k] ? 'yes' : 'no')).join(' | ') + ' |');
  L.push('', '## Placebo (40 seeds: each trade moved to a random weekday of the same year, same side, stop, hold and costs; OOS net month t)', '');
  L.push('| Test | p5 | p50 | p95 | max | Real | Seeds at or above the real |', '|---|---|---|---|---|---|---|');
  for (const t of res.tests) L.push(`| ${t.id} | ${fmtT(t.placebo.p5)} | ${fmtT(t.placebo.p50)} | ${fmtT(t.placebo.p95)} | ${fmtT(t.placebo.max)} | ${fmtT(t.oos.monthNetT)} | ${t.placebo.atOrAbove} of 40 |`);
  L.push('', '## Per year (sum of net R by exit year)', '');
  const ys = [...new Set(res.tests.flatMap((t) => Object.keys(t.years)))].sort();
  L.push('| Year | ' + res.tests.map((t) => `${t.id} n | ${t.id} net`).join(' | ') + ' |', '|---|' + res.tests.map(() => '---|---').join('|') + '|');
  for (const y of ys) L.push(`| ${y} | ` + res.tests.map((t) => (t.years[y] ? `${t.years[y].n} | ${fmtT(t.years[y].net)}` : '0 | 0')).join(' | ') + ' |');
  L.push('', '## First record after more than 60 trading days without one (descriptive, not a test: n too small)', '');
  L.push('| Signal day | Exit | Gross R | Net R |', '|---|---|---|---|');
  for (const g of res.firstAfterGap) L.push(`| ${g.signal} | ${g.how} | ${fmt(g.gross)} | ${fmt(g.net)} |`);
  L.push('', '## Reading', '');
  return L;
}

// written after the run; the figures it quotes are checked against result.json by tests/gold-record-high.test.mjs
export const READING = [
  '- **Continuation, but no more than owning gold.** After a record close gold went on up on average (T1 +0.319R a trade net out of sample, T2 +0.285R), and the in-sample sign agrees (T1 +0.563R, month t 1.87). But the monthly t is under 1 out of sample for T1 (0.93) and 1.21 for T2, far from 2, and the placebo answers the real question: the same number of 20-day longs on random days of the same years did as well or better (T1: 37 of 40 seeds at or above the real t, median placebo t 1.56; T2: 24 of 40). The record day adds nothing measurable to gold\'s drift in those years.',
  '- **No reversal either.** Fading a 52-week high (T3) lost −0.404R a trade net out of sample (n 53, month t −2.47) and −0.301R in sample: shorting gold at a record is the wrong side, as shorting it on random days of the same years was (placebo median t −2.97).',
  '- **The first record after a gap** (descriptive, 9 events in 2008-26): 5 time exits up, 4 stopped; too few to say anything.',
  '- **Samples are thin.** Gold made no all-time closing high from September 2011 to July 2020, so T1 has 17 trades out of sample, nearly all in 2024-26. Financing (about 0.09R a long) is most of the cost; the $0.60 a trade is about 0.01R at a 3 x ATR stop.',
  '- Nothing proposed. Not an edge, not a gate on the gold book; nothing live changed.',
];

export function load(file) {
  const txt = file ? fs.readFileSync(file, 'utf8') : execFileSync('git', ['show', `${DATA_COMMIT}:research/daily/xau.json`], { encoding: 'utf8', maxBuffer: 64e6 });
  return toBars(JSON.parse(txt).rows);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const bars = load(process.argv[2]);
  const res = study(bars);
  const out = { study: 'gold-record-high', built: '2026-11-14', dataCommit: DATA_COMMIT, params: P, fin: FIN.xau.long,
    verdict: res.tests[0].pass ? 'PASS' : 'FAIL', headline: verdictLine(res), ...res };
  fs.writeFileSync(DIR + 'result.json', JSON.stringify(out, null, 1) + '\n');
  const L = report(res);
  fs.writeFileSync(DIR + 'RESULT.md', [...L, ...READING].join('\n') + '\n');
  console.log(verdictLine(res));
  for (const t of res.tests) console.log(t.id, JSON.stringify(t.is), '\n  ', JSON.stringify(t.oos), t.holmP, JSON.stringify(t.placebo));
  console.log(JSON.stringify(res.firstAfterGap));
}
