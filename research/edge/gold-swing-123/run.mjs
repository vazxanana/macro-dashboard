// Gold's daily swing-structure flip, the "1-2-3" (pre-registered 14 Nov 2026, PREREGISTRATION.md, commit beb8ab81a): fractal swings
// 2 a side; a higher low followed by the first close above the swing high between the two lows -> long at the next open, stop
// $0.30 under the higher low, out at the close of the 10th day held; the mirror short. T1 both sides (primary), T2 longs, T3
// shorts; $0.60 a trade and long financing; t on calendar-month sums, Holm over three, 40 seeded random-timing placebos.
// Paper research only: nothing live reads this file.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

export const P = {
  SIDE: 2, BUF: 0.30, MIN_ATR: 0.5, HOLD: 10, ATR_N: 20, SPREAD: 0.30, SLIP: 0.15, SEEDS: 40, DRIFT_ATR: 1.5,
  IS: { from: '2007-01', to: '2016-12' }, OOS: { from: '2017-01', to: '2026-10' },
};
export const DATA_COMMIT = 'f6288251e';
export const PREREG_COMMIT = 'beb8ab81a';
const DIR = fileURLToPath(new URL('.', import.meta.url));

export const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);
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

// ─── swings: day i is a swing high / low when its high / low is strictly beyond the two days on each side; known at day i + 2 ───
export function isSwingHigh(bars, i, k = P.SIDE) {
  if (i < k || i + k >= bars.length) return false;
  for (let j = i - k; j <= i + k; j++) if (j !== i && !(bars[i].high > bars[j].high)) return false;
  return true;
}
export function isSwingLow(bars, i, k = P.SIDE) {
  if (i < k || i + k >= bars.length) return false;
  for (let j = i - k; j <= i + k; j++) if (j !== i && !(bars[i].low < bars[j].low)) return false;
  return true;
}
export function swings(bars) {
  return { hi: bars.map((_, i) => isSwingHigh(bars, i)), lo: bars.map((_, i) => isSwingLow(bars, i)) };
}
const lastBefore = (flags, from) => { for (let i = from; i >= 0; i--) if (flags[i]) return i; return -1; };

// the signal at the close of day t (reads days <= t only: a swing at i is used only when i + 2 <= t). side +1 = long, -1 = short
export function signal(bars, sw, t, side) {
  const [lows, highs] = side > 0 ? [sw.lo, sw.hi] : [sw.hi, sw.lo];
  const c = lastBefore(lows, t - P.SIDE); if (c < 0) return null;
  const b = lastBefore(highs, c - 1); if (b < 0) return null;
  const a = lastBefore(lows, b - 1); if (a < 0) return null;
  const ext = (i) => (side > 0 ? bars[i].low : bars[i].high);
  const lvl = (i) => (side > 0 ? bars[i].high : bars[i].low);
  if (!(side * (ext(c) - ext(a)) > 0)) return null; // a higher low / a lower high
  const B = lvl(b);
  if (!(side * (bars[t].close - B) > 0)) return null; // close through point 2
  for (let j = b + 1; j < t; j++) if (side * (bars[j].close - B) > 0) return null; // the first close through it
  for (let j = c + 1; j <= t; j++) if (side * (ext(j) - ext(c)) < 0) return null; // point 3 still holds
  return { t, side, a, b, c, level: B, stop: ext(c) - side * P.BUF };
}

// one trade: entry at day t + 1's open, stop given, out at the close of the HOLD-th day held or at the stop
export function trade(bars, t, side, stop, { costX = 1 } = {}) {
  const e = t + 1, last = e + P.HOLD - 1;
  if (last >= bars.length) return null;
  const entry = bars[e].open, dist = side * (entry - stop);
  if (!(dist > 0)) return { skip: 'wrong-side' };
  const a = atr(bars, t); if (!a) return null;
  if (dist < P.MIN_ATR * a) return { skip: 'near' };
  let exit = bars[last].close, how = 'time', xi = last, exitTime = bars[last].time + 22 * 3600;
  for (let i = e; i <= last; i++) {
    const b = bars[i];
    if (i > e && (side > 0 ? b.open <= stop : b.open >= stop)) { exit = b.open; how = 'gap'; xi = i; exitTime = b.time; break; }
    if (side > 0 ? b.low <= stop : b.high >= stop) { exit = stop; how = 'stop'; xi = i; exitTime = b.time; break; }
  }
  const gross = side * (exit - entry) / dist;
  const costR = costX * (P.SPREAD + 2 * P.SLIP) / dist;
  const n = side > 0 ? nights(bars[e].time, exitTime) : 0;
  const finR = side > 0 ? costX * n * FIN.xau.long * entry / dist : 0;
  return { t, xi, side, date: day(bars[e].time), exitMonth: ym(bars[xi].time), entry, stop, exit, dist, atrU: dist / a, how,
    gross, costR, finR, nights: n, net: gross - costR - finR };
}

export const TESTS = [
  { id: 'T1', name: 'Both sides (primary)', sides: [1, -1] },
  { id: 'T2', name: 'Longs only', sides: [1] },
  { id: 'T3', name: 'Shorts only', sides: [-1] },
];
export function runTest(bars, sw, T, opt = {}) {
  const out = [], skipped = { near: 0, 'wrong-side': 0, both: 0 }; let free = 0;
  for (let t = 0; t < bars.length; t++) {
    if (t < free) continue;
    const L = signal(bars, sw, t, 1), S = signal(bars, sw, t, -1);
    if (L && S) { if (T.sides.length > 1) skipped.both++; continue; }
    const s = L || S; if (!s || !T.sides.includes(s.side)) continue;
    const tr = trade(bars, t, s.side, s.stop, opt); if (!tr) continue;
    if (tr.skip) { skipped[tr.skip]++; continue; }
    out.push(tr); free = tr.xi;
  }
  return { trades: out, skipped };
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
export const inWin = (t, w) => t.exitMonth >= w.from && t.exitMonth <= w.to;
const median = (xs) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export function window(trades, w, trades2x) {
  const inW = trades.filter((t) => inWin(t, w)), n = inW.length;
  const net = monthly(trades, w, 'net'), gross = monthly(trades, w, 'gross'), tn = tstat(net), tg = tstat(gross);
  const per = (f) => (n ? inW.reduce((a, t) => a + t[f], 0) / n : 0);
  const o = { trades: n, longs: inW.filter((t) => t.side > 0).length, months: net.length, won: n ? r3(inW.filter((t) => t.net > 0).length / n) : 0,
    stopped: n ? r3(inW.filter((t) => t.how !== 'time').length / n) : 0,
    grossR: r3(per('gross')), netR: r3(per('net')), costR: r3(per('costR')), finR: r3(per('finR')), medianStop: r2(median(inW.map((t) => t.dist))),
    monthGross: r3(tg.mean), monthGrossT: r2(tg.t), monthNet: r3(tn.mean), monthNetT: r2(tn.t),
    totalNet: r2(net.reduce((a, b) => a + b, 0)), worstDD: r2(drawdown(net)) };
  if (trades2x) { const t2 = tstat(monthly(trades2x, w, 'net')); o.x2Net = r3(t2.mean); o.x2T = r2(t2.t); }
  return o;
}

// ─── placebo: each real trade's entry day replaced by a random day whose trade (same side, same stop in ATR units) exits in the same window ───
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function placeboTrade(bars, t, side, atrU) {
  const a = atr(bars, t); if (!a) return null;
  const e = t + 1; if (e + P.HOLD - 1 >= bars.length) return null;
  const tr = trade(bars, t, side, bars[e].open - side * atrU * a);
  return tr && !tr.skip ? tr : null;
}
export function placebo(bars, real, seed) {
  const rng = mulberry32(seed), out = [];
  const range = (w) => { const lo = bars.findIndex((b) => ym(b.time) >= w.from) - P.HOLD - 1, hi = bars.findLastIndex((b) => ym(b.time) <= w.to); return [Math.max(P.ATR_N, lo), hi]; };
  const R = { IS: range(P.IS), OOS: range(P.OOS) };
  for (const t of real) {
    const w = inWin(t, P.OOS) ? P.OOS : inWin(t, P.IS) ? P.IS : null; if (!w) continue;
    const [lo, hi] = w === P.OOS ? R.OOS : R.IS;
    for (let tries = 0; tries < 1000; tries++) {
      const d = lo + Math.floor(rng() * (hi - lo + 1));
      const p = placeboTrade(bars, d, t.side, t.atrU);
      if (p && inWin(p, w)) { out.push(p); break; }
    }
  }
  return out;
}

export function study(bars) {
  const sw = swings(bars);
  const tests = TESTS.map((T) => {
    const { trades: tr, skipped } = runTest(bars, sw, T), tr2 = runTest(bars, sw, T, { costX: 2 }).trades;
    const is = window(tr, P.IS), oos = window(tr, P.OOS, tr2);
    const pl = [];
    for (let s = 1; s <= P.SEEDS; s++) pl.push(tstat(monthly(placebo(bars, tr, s), P.OOS)).t);
    pl.sort((a, b) => a - b);
    const q = (p) => r2(pl[Math.min(pl.length - 1, Math.floor(p * pl.length))]);
    const years = {};
    for (const t of tr) { if (t.exitMonth > P.OOS.to || t.exitMonth < P.IS.from) continue; const y = t.exitMonth.slice(0, 4); years[y] = years[y] || { n: 0, gross: 0, net: 0 }; years[y].n++; years[y].gross += t.gross; years[y].net += t.net; }
    for (const y in years) { years[y].gross = r2(years[y].gross); years[y].net = r2(years[y].net); }
    return { ...T, skipped, is, oos, pOne: pOne(oos.monthNetT),
      placebo: { p5: q(0.05), p50: q(0.5), p95: q(0.95), max: r2(pl.at(-1)), below: pl.filter((x) => x < oos.monthNetT).length },
      years, trades: tr.filter((t) => t.exitMonth >= P.IS.from && t.exitMonth <= P.OOS.to).map((t) => ({ date: t.date, side: t.side, exitMonth: t.exitMonth, how: t.how, stop$: r2(t.dist), gross: r3(t.gross), net: r3(t.net) })) };
  });
  const hp = holm(tests.map((t) => t.pOne));
  tests.forEach((t, k) => {
    t.holmP = r3(hp[k]); t.pOne = r3(t.pOne);
    t.checks = { oosPositive: t.oos.monthNet > 0, oosT2: t.oos.monthNetT >= 2, holm05: hp[k] < 0.05, isSameSign: t.is.monthNet > 0,
      x2Positive: t.oos.x2Net > 0, abovePlacebo95: t.placebo.below > 38 };
    t.pass = Object.values(t.checks).every(Boolean);
  });
  // drift comparison: long every 10th day, same hold, stop 1.5 x ATR(20), costs
  const dr = [];
  for (let t = P.ATR_N; t + P.HOLD < bars.length; t += P.HOLD) { const a = atr(bars, t), p = a && trade(bars, t, 1, bars[t + 1].open - P.DRIFT_ATR * a); if (p && !p.skip) dr.push(p); }
  const drift = { is: window(dr, P.IS), oos: window(dr, P.OOS) };
  return { days: bars.length, firstDay: day(bars[0].time), lastDay: day(bars.at(-1).time), tests, drift };
}

const s = (x) => (x >= 0 ? '+' : '') + x;
export function verdictLine(res) {
  const [T1, T2, T3] = res.tests;
  return `${T1.pass ? 'PASS' : 'FAIL'}: the daily 1-2-3 flip made ${s(T1.oos.netR)}R a trade net 2017-26 both sides (n ${T1.oos.trades}, month t ${T1.oos.monthNetT}); longs ${s(T2.oos.netR)}R (t ${T2.oos.monthNetT}), shorts ${s(T3.oos.netR)}R (t ${T3.oos.monthNetT})`;
}

function fmt(x) { return (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(3); }
function fmtT(x) { return (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(2); }
export function report(res) {
  const L = [];
  L.push('# Gold\'s daily swing-structure flip, the "1-2-3": result (14 Nov 2026)', '');
  L.push(`**Verdict: ${verdictLine(res)}.**`, '');
  L.push(`Paper research only. No live rule, size, filter, council member or page changed. Rule, costs, windows, the three tests and the placebo were fixed in \`PREREGISTRATION.md\`, pushed alone (${PREREG_COMMIT}) before any swing was located. Data: council-data \`research/daily/xau.json\` at \`${DATA_COMMIT}\`, OANDA mid daily candles, weekend stubs folded into Monday; ${res.days} days from ${res.firstDay} to ${res.lastDay}. A stand-alone rule, not a gate, exit, entry or size of the gold book (owner decision 44); not an edge without n and t.`, '');
  L.push('## The three tests (R a trade, 1R = the stop distance; monthly sums of net R on every calendar month of the window, by exit month)', '');
  L.push('| Test | Window | Trades | Longs | Won | Stopped | Median stop $ | Gross R | Cost R | Financing R | Net R | Month net (t) | Month gross t | Total net R | Worst DD R | OOS at 2x costs (t) | One-sided p | Holm p | Pass |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  const row = (lab, w, last, t) => `| ${lab} | ${last ? 'OOS 2017-01 to 2026-10' : 'IS 2007-01 to 2016-12'} | ${w.trades} | ${w.longs} | ${(w.won * 100).toFixed(0)}% | ${(w.stopped * 100).toFixed(0)}% | ${w.medianStop.toFixed(2)} | ${fmt(w.grossR)} | ${fmt(w.costR)} | ${fmt(w.finR)} | ${fmt(w.netR)} | ${fmt(w.monthNet)} (${fmtT(w.monthNetT)}) | ${fmtT(w.monthGrossT)} | ${fmtT(w.totalNet)} | ${fmtT(w.worstDD)} | ${last && t ? `${fmt(w.x2Net)} (${fmtT(w.x2T)})` : ''} | ${last && t ? t.pOne.toFixed(3) : ''} | ${last && t ? t.holmP.toFixed(3) : ''} | ${last && t ? (t.pass ? 'yes' : 'no') : ''} |`;
  for (const t of res.tests) L.push(row(`${t.id} ${t.name}`, t.is, false, t), row('', t.oos, true, t));
  L.push(row('Long every 10th day, 1.5 x ATR stop (comparison, not a test)', res.drift.is, false, null), row('', res.drift.oos, true, null));
  L.push('', 'Pass bar (pre-registered; T1 decides): OOS net month mean > 0 with t >= 2 and Holm p < 0.05, the in-sample mean > 0, the OOS mean > 0 at 2x costs and financing, the OOS t above the placebo\'s 95th percentile.', '');
  L.push('| Check | ' + res.tests.map((t) => t.id).join(' | ') + ' |', '|---|' + res.tests.map(() => '---').join('|') + '|');
  for (const k of Object.keys(res.tests[0].checks)) L.push(`| ${k} | ` + res.tests.map((t) => (t.checks[k] ? 'yes' : 'no')).join(' | ') + ' |');
  L.push('', 'Signals not taken (all years): ' + res.tests.map((t) => `${t.id} stop nearer than 0.5 x ATR ${t.skipped.near}, stop on the wrong side of the open ${t.skipped['wrong-side']}, long and short the same day ${t.skipped.both}`).join('; ') + '.', '');
  L.push('## Placebo (40 seeds: each real trade\'s entry day replaced by a random day, same side, same stop in ATR units, same hold and costs, exiting in the same window; OOS net month t)', '');
  L.push('| Test | p5 | p50 | p95 | max | Real | Seeds below the real |', '|---|---|---|---|---|---|---|');
  for (const t of res.tests) L.push(`| ${t.id} | ${fmtT(t.placebo.p5)} | ${fmtT(t.placebo.p50)} | ${fmtT(t.placebo.p95)} | ${fmtT(t.placebo.max)} | ${fmtT(t.oos.monthNetT)} | ${t.placebo.below} of 40 |`);
  L.push('', '## Per year (sum of net R by exit year)', '');
  const ys = [...new Set(res.tests.flatMap((t) => Object.keys(t.years)))].sort();
  L.push('| Year | ' + res.tests.map((t) => `${t.id} n | ${t.id} net`).join(' | ') + ' |', '|---|' + res.tests.map(() => '---|---').join('|') + '|');
  for (const y of ys) L.push(`| ${y} | ` + res.tests.map((t) => (t.years[y] ? `${t.years[y].n} | ${fmtT(t.years[y].net)}` : '0 | 0')).join(' | ') + ' |');
  L.push('', '## Reading', '');
  return L;
}

// written after the run; the figures it quotes are checked against result.json by tests/gold-swing-123.test.mjs
export const READING = [
  '- **The structure flip does not pick better entries than chance.** Both sides together (T1, the primary) made +0.024R a trade net out of sample (n 93, month t 0.22; +0.077R gross) and -0.100R in sample (n 108, t -1.17); at 2x costs it loses out of sample (-0.022R a month). Its t sits above 28 of 40 random-timing seeds (placebo median -0.28, 95th percentile 1.48): inside the noise band.',
  '- **The long side earns no more than gold\'s drift.** T2 made +0.121R a trade net out of sample (n 56, t 0.74), -0.093R in sample (n 64, t -0.86). Random-day longs with the same stop size gave a median t of 0.91; the real t sits above only 19 of 40 seeds. Long every 10th day (same hold, a 1.5 x ATR stop, same costs) made +0.219R a trade net out of sample (n 256, month t 2.37): buying gold at any time beat buying it on a 1-2-3.',
  '- **The short side loses in both windows**: T3 -0.146R a trade net out of sample (n 38, t -1.15), -0.118R in sample (n 49, t -0.99).',
  '- **Costs are small here**: the median stop is $41.17 in sample and $52.03 out of sample (the higher low is far from the break), so spread and slippage take 0.013-0.016R a trade and long financing 0.028-0.040R across T1. The rule fails before costs too (T1 gross month t -0.64 in sample, +0.69 out of sample).',
  '- Nothing proposed. Not an edge, not a gate on the gold book; nothing live changed.',
];

export function load(file) {
  const txt = file ? fs.readFileSync(file, 'utf8') : execFileSync('git', ['show', `${DATA_COMMIT}:research/daily/xau.json`], { encoding: 'utf8', maxBuffer: 64e6 });
  return toBars(JSON.parse(txt).rows);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const bars = load(process.argv[2]);
  const res = study(bars);
  const out = { study: 'gold-swing-123', built: '2026-11-14', dataCommit: DATA_COMMIT, preregCommit: PREREG_COMMIT, params: P, fin: FIN.xau.long,
    verdict: res.tests[0].pass ? 'PASS' : 'FAIL', headline: verdictLine(res), ...res };
  fs.writeFileSync(DIR + 'result.json', JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(DIR + 'RESULT.md', [...report(res), ...READING].join('\n') + '\n');
  console.log(verdictLine(res), verdictLine(res).length);
  for (const t of res.tests) console.log(t.id, JSON.stringify(t.skipped), '\n IS ', JSON.stringify(t.is), '\n OOS', JSON.stringify(t.oos), t.holmP, JSON.stringify(t.placebo), JSON.stringify(t.years));
  console.log('DRIFT', JSON.stringify(res.drift));
}
