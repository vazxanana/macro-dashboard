// Momentum acceleration on spot gold (pre-registered 14 Nov 2026, PREREGISTRATION.md, pushed alone as da83cf932).
// Signal at a week's close: z = (13-week log return - the 13 weeks before) / (sd of 52 weekly returns x sqrt 26); z >= 1 long,
// z <= -1 short; entry at next week's first open, stop 2 x ATR(20), out at the close of the fourth week; one trade at a time.
// T1 (primary) excess R over the same-side every-week baseline, T2 net R, T3 the 26-week reading's excess R; t on
// calendar-month sums, Holm over three, 40 seeded side-shuffle placebos. Paper research only: nothing live reads this file.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

export const P = {
  ATR_N: 20, ATR_MULT: 2, HOLD_W: 4, SD_WEEKS: 52, Z: 1,
  SPREAD: 0.30, SLIP: 0.15, SEEDS: 40,
  IS: { from: '2007-01', to: '2016-12' }, OOS: { from: '2017-01', to: '2026-10' },
};
export const DATA_COMMIT = '2ad23e383';
export const PREREG = 'da83cf932';
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
// weeks: { key, a, b (first / last daily index), open, close }; a last week not ending on a Friday is left out
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
// sd of the 52 weekly log close-to-close returns ending at week k
export function weekSd(W, k) {
  if (k < P.SD_WEEKS) return null;
  const xs = []; for (let j = k - P.SD_WEEKS + 1; j <= k; j++) xs.push(Math.log(W[j].close / W[j - 1].close));
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}
// acceleration z at week k with half-window h (13 or 26); null when the history is short
export function accelZ(W, k, h) {
  if (k < 2 * h || k < P.SD_WEEKS) return null;
  const s = weekSd(W, k); if (!s) return null;
  const A = Math.log(W[k].close / W[k - h].close) - Math.log(W[k - h].close / W[k - 2 * h].close);
  return A / (s * Math.sqrt(2 * h));
}
const sideOf = (z) => (z == null ? 0 : z >= P.Z ? 1 : z <= -P.Z ? -1 : 0);
export const SIGNALS = { acc13: (W, k) => sideOf(accelZ(W, k, 13)), acc26: (W, k) => sideOf(accelZ(W, k, 26)) };

// one trade entered at the first open of week k+1, signal at the close of week k, out at the close of week k+HOLD_W
export function trade(bars, W, k, side, { costX = 1 } = {}) {
  const nw = W[k + 1], lw = W[k + P.HOLD_W]; if (!nw || !lw || !side) return null;
  const a = atr(bars, W[k].b); if (!a) return null;
  const e = nw.a, entry = bars[e].open, dist = P.ATR_MULT * a, stop = entry - side * dist;
  let exit = bars[lw.b].close, how = 'time', xi = lw.b, exitTime = bars[lw.b].time + 22 * 3600;
  for (let i = e; i <= lw.b; i++) {
    const b = bars[i];
    if (i > e && (side > 0 ? b.open <= stop : b.open >= stop)) { exit = b.open; how = 'gap'; xi = i; exitTime = b.time; break; }
    if (side > 0 ? b.low <= stop : b.high >= stop) { exit = stop; how = 'stop'; xi = i; exitTime = b.time; break; }
  }
  const gross = side * (exit - entry) / dist;
  const costR = costX * (P.SPREAD + 2 * P.SLIP) / dist;
  const n = side > 0 ? nights(bars[e].time, exitTime) : 0;
  const finR = side > 0 ? costX * n * FIN.xau.long * entry / dist : 0;
  const exitWeek = W.findIndex((w, j) => j > k && w.a <= xi && xi <= w.b);
  return { k, side, week: new Date(nw.key * 1000).toISOString().slice(0, 10), exitMonth: ym(bars[xi].time), exitWeek, entry, stop,
    exit, dist, how, gross, costR, finR, nights: n, net: gross - costR - finR };
}
// one at a time: after a trade, the next signal is read at the close of the week it left
export function runRule(bars, W, sig, opt = {}) {
  const out = []; let k = 0;
  while (k + 1 < W.length) {
    const t = trade(bars, W, k, SIGNALS[sig](W, k), opt);
    if (t) { out.push(t); k = t.exitWeek; } else k++;
  }
  return out;
}
// the same-side every-week baseline: a long and a short in every week k >= SD_WEEKS
export function baseline(bars, W, opt = {}) {
  const out = { long: [], short: [] };
  for (let k = P.SD_WEEKS; k + 1 < W.length; k++) for (const [s, key] of [[1, 'long'], [-1, 'short']]) { const t = trade(bars, W, k, s, opt); if (t) out[key].push(t); }
  return out;
}
const inW = (t, w) => t.exitMonth >= w.from && t.exitMonth <= w.to;
export function baseMeans(B, w) {
  const m = (xs) => { const y = xs.filter((t) => inW(t, w)); return y.length ? y.reduce((a, t) => a + t.net, 0) / y.length : 0; };
  return { long: m(B.long), short: m(B.short) };
}
// adds t.excess per window (IS trades against the IS baseline, OOS against the OOS one)
export function withExcess(trades, B) {
  const bi = baseMeans(B, P.IS), bo = baseMeans(B, P.OOS);
  return trades.map((t) => { const b = inW(t, P.OOS) ? bo : bi; return { ...t, excess: t.net - (t.side > 0 ? b.long : b.short) }; });
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
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
export function window(trades, w, f) {
  const x = trades.filter((t) => inW(t, w)), n = x.length;
  const ms = monthly(trades, w, f), tm = tstat(ms), tg = tstat(monthly(trades, w, 'gross'));
  const per = (k) => (n ? x.reduce((a, t) => a + t[k], 0) / n : 0);
  const gross = per('gross'), cost = per('costR') + per('finR');
  return { trades: n, longs: x.filter((t) => t.side > 0).length, months: ms.length, won: n ? r3(x.filter((t) => t.net > 0).length / n) : 0,
    stopped: n ? r3(x.filter((t) => t.how !== 'time').length / n) : 0,
    grossR: r3(gross), netR: r3(per('net')), excessR: f === 'excess' ? r3(per('excess')) : null, costR: r3(per('costR')), finR: r3(per('finR')),
    costShare: gross > 0 ? r3(cost / gross) : null, medianStop: r2(median(x.map((t) => t.dist))),
    monthGrossT: r2(tg.t), month: r3(tm.mean), monthT: r2(tm.t), total: r2(ms.reduce((a, b) => a + b, 0)), worstDD: r2(drawdown(ms)) };
}

// ─── placebo: the test's own trades, sides shuffled among them (same long / short share) ───
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function shuffleSides(real, seed) {
  const rng = mulberry32(seed), sides = real.map((t) => t.side);
  for (let i = sides.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [sides[i], sides[j]] = [sides[j], sides[i]]; }
  return sides;
}

export const TESTS = [
  { id: 'T1', name: '13-week acceleration, excess over the same-side baseline (primary)', sig: 'acc13', f: 'excess' },
  { id: 'T2', name: '13-week acceleration, own net R', sig: 'acc13', f: 'net' },
  { id: 'T3', name: '26-week acceleration, excess over the same-side baseline', sig: 'acc26', f: 'excess' },
];

export function study(bars) {
  const W = weeksOf(bars), B = baseline(bars, W), B2 = baseline(bars, W, { costX: 2 });
  const tests = TESTS.map((T) => {
    const tr = withExcess(runRule(bars, W, T.sig), B), tr2 = withExcess(runRule(bars, W, T.sig, { costX: 2 }), B2);
    const is = window(tr, P.IS, T.f), oos = window(tr, P.OOS, T.f), x2 = tstat(monthly(tr2, P.OOS, T.f));
    oos.x2 = r3(x2.mean); oos.x2T = r2(x2.t);
    const pl = [];
    for (let s = 1; s <= P.SEEDS; s++) {
      const sides = shuffleSides(tr, s);
      const pt = withExcess(tr.map((t, i) => trade(bars, W, t.k, sides[i])).filter(Boolean), B);
      pl.push(tstat(monthly(pt, P.OOS, T.f)).t);
    }
    pl.sort((a, b) => a - b);
    const q = (p) => r2(pl[Math.min(pl.length - 1, Math.floor(p * pl.length))]);
    const legs = {};
    for (const [wk, w] of [['is', P.IS], ['oos', P.OOS]]) legs[wk] = Object.fromEntries([['long', 1], ['short', -1]].map(([k, s]) => {
      const x = window(tr.filter((t) => t.side === s), w, 'excess'); return [k, { trades: x.trades, grossR: x.grossR, netR: x.netR, excessR: x.excessR, monthT: x.monthT, total: x.total }];
    }));
    const years = {};
    for (const t of tr) { if (t.exitMonth > P.OOS.to || t.exitMonth < P.IS.from) continue; const y = t.exitMonth.slice(0, 4); years[y] = years[y] || { n: 0, net: 0, excess: 0 }; years[y].n++; years[y].net += t.net; years[y].excess += t.excess; }
    for (const y in years) { years[y].net = r2(years[y].net); years[y].excess = r2(years[y].excess); }
    // how much of the reading is plain 13-week momentum of the same sign
    const h = T.sig === 'acc26' ? 26 : 13;
    const sameMom = tr.filter((t) => Math.sign(Math.log(W[t.k].close / W[t.k - h].close)) === t.side).length;
    return { ...T, is, oos, legs, pOne: pOne(oos.monthT), sameMomentumShare: tr.length ? r3(sameMom / tr.length) : 0,
      placebo: { p5: q(0.05), p50: q(0.5), p95: q(0.95), max: r2(pl.at(-1)), below: pl.filter((x) => x < oos.monthT).length }, years };
  });
  const hp = holm(tests.map((t) => t.pOne));
  tests.forEach((t, k) => {
    t.holmP = r3(hp[k]); t.pOne = r3(t.pOne);
    t.checks = { oosPositive: t.oos.month > 0, oosT2: t.oos.monthT >= 2, holm05: hp[k] < 0.05, isSameSign: t.is.month > 0,
      x2Positive: t.oos.x2 > 0, abovePlacebo95: t.placebo.below > 38 };
    t.pass = Object.values(t.checks).every(Boolean);
  });
  const base = {};
  for (const [wk, w] of [['is', P.IS], ['oos', P.OOS]]) base[wk] = { long: window(B.long, w, 'net'), short: window(B.short, w, 'net') };
  return { weeks: W.length, firstWeek: new Date(W[0].key * 1000).toISOString().slice(0, 10), lastWeek: new Date(W.at(-1).key * 1000).toISOString().slice(0, 10), tests, base };
}

const sg = (x) => (x >= 0 ? '+' : '') + x;
export function verdictLine(res) {
  const T1 = res.tests[0];
  return `${T1.pass ? 'PASS' : 'FAIL'}: 13-week acceleration added ${sg(T1.oos.excessR)}R a trade over the same-side baseline 2017-26 (n ${T1.oos.trades}, month t ${T1.oos.monthT}); own net ${sg(T1.oos.netR)}R`;
}

function fmt(x) { return x == null ? '' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(3); }
function fmtT(x) { return x == null ? '' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(2); }
export function report(res) {
  const L = [];
  L.push('# Momentum acceleration on spot gold: result (14 Nov 2026)', '');
  L.push(`**Verdict: ${verdictLine(res)}.**`, '');
  L.push(`Paper research only. No live rule, size, filter, council member or page changed. Rule, costs, windows, the baseline, the three tests and the placebo were fixed in \`PREREGISTRATION.md\`, pushed alone (${PREREG}) before any candle was read. Data: council-data \`research/daily/xau.json\` at \`${DATA_COMMIT}\`, OANDA mid daily candles, weekend stubs folded into Monday; ${res.weeks} complete weeks from ${res.firstWeek} to ${res.lastWeek}. A stand-alone rule, not a gate, exit, entry or size of the gold book (owner decision 44); not an edge without n and t.`, '');
  L.push('## The three tests (R a trade, 1R = 2 x ATR(20); monthly sums by exit month over every calendar month of the window)', '');
  L.push('Month column = the test\'s own measure (excess R for T1 / T3, net R for T2). Costs = $0.60 a round trip + financing on buys.', '');
  L.push('| Test | Window | Trades | Longs | Won | Stopped | Median stop $ | Gross R | Net R | Excess R | Cost share | Month (t) | Month gross t | Total | Worst DD | OOS at 2x costs (t) | One-sided p | Holm p | Pass |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const t of res.tests) {
    const row = (w, lab, last) => `| ${lab === 'IS' ? `${t.id} ${t.name}` : ''} | ${lab === 'IS' ? 'IS 2007-01 to 2016-12' : 'OOS 2017-01 to 2026-10'} | ${w.trades} | ${w.longs} | ${(w.won * 100).toFixed(0)}% | ${(w.stopped * 100).toFixed(0)}% | ${w.medianStop.toFixed(2)} | ${fmt(w.grossR)} | ${fmt(w.netR)} | ${fmt(w.excessR)} | ${w.costShare == null ? 'n/a' : (w.costShare * 100).toFixed(0) + '%'} | ${fmt(w.month)} (${fmtT(w.monthT)}) | ${fmtT(w.monthGrossT)} | ${fmtT(w.total)} | ${fmtT(w.worstDD)} | ${last ? `${fmt(w.x2)} (${fmtT(w.x2T)})` : ''} | ${last ? t.pOne.toFixed(3) : ''} | ${last ? t.holmP.toFixed(3) : ''} | ${last ? (t.pass ? 'yes' : 'no') : ''} |`;
    L.push(row(t.is, 'IS', false), row(t.oos, 'OOS', true));
  }
  L.push('', 'Pass bar (pre-registered, each test on its own, Holm over three; the verdict is T1\'s): OOS month mean > 0 with t >= 2 and Holm p < 0.05, the in-sample mean > 0, the OOS mean > 0 at 2x costs and financing (baseline recomputed at 2x), the OOS t above the placebo\'s 95th percentile.', '');
  L.push('| Check | ' + res.tests.map((t) => t.id).join(' | ') + ' |', '|---|' + res.tests.map(() => '---').join('|') + '|');
  for (const k of Object.keys(res.tests[0].checks)) L.push(`| ${k} | ` + res.tests.map((t) => (t.checks[k] ? 'yes' : 'no')).join(' | ') + ' |');
  L.push('', '## The baseline: a buy and a sell in every week (same entry, stop, four-week hold; overlapping)', '');
  L.push('| Window | Long n | Long gross R | Long net R | Long month t | Short n | Short gross R | Short net R | Short month t |', '|---|---|---|---|---|---|---|---|---|');
  for (const [wk, lab] of [['is', 'IS 2007-16'], ['oos', 'OOS 2017-26']]) { const b = res.base[wk]; L.push(`| ${lab} | ${b.long.trades} | ${fmt(b.long.grossR)} | ${fmt(b.long.netR)} | ${fmtT(b.long.monthT)} | ${b.short.trades} | ${fmt(b.short.grossR)} | ${fmt(b.short.netR)} | ${fmtT(b.short.monthT)} |`); }
  L.push('', '(Baseline month t is on overlapping trades and only describes the drift.)', '');
  L.push('## Long and short legs apart', '');
  L.push('| Test | Window | Long n | Long net R | Long excess R | Long excess t | Short n | Short net R | Short excess R | Short excess t |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const t of res.tests) for (const [w, lab] of [['is', 'IS'], ['oos', 'OOS']]) {
    const g = t.legs[w];
    L.push(`| ${w === 'is' ? t.id : ''} | ${lab} | ${g.long.trades} | ${fmt(g.long.netR)} | ${fmt(g.long.excessR)} | ${fmtT(g.long.monthT)} | ${g.short.trades} | ${fmt(g.short.netR)} | ${fmt(g.short.excessR)} | ${fmtT(g.short.monthT)} |`);
  }
  L.push('', '## Placebo (40 seeds: each test\'s own trades with their sides shuffled among them; OOS month t of the test\'s measure)', '');
  L.push('| Test | p5 | p50 | p95 | max | Real | Seeds below the real | Signals with plain momentum of the same sign |', '|---|---|---|---|---|---|---|---|');
  for (const t of res.tests) L.push(`| ${t.id} | ${fmtT(t.placebo.p5)} | ${fmtT(t.placebo.p50)} | ${fmtT(t.placebo.p95)} | ${fmtT(t.placebo.max)} | ${fmtT(t.oos.monthT)} | ${t.placebo.below} of 40 | ${(t.sameMomentumShare * 100).toFixed(0)}% |`);
  L.push('', '## Per year (sums by exit year; T2 shares T1\'s trades)', '');
  const ys = [...new Set(res.tests.flatMap((t) => Object.keys(t.years)))].sort();
  L.push('| Year | T1 n | T1 net | T1 excess | T3 n | T3 net | T3 excess |', '|---|---|---|---|---|---|---|');
  const [a, , c] = res.tests;
  for (const y of ys) L.push(`| ${y} | ${a.years[y]?.n || 0} | ${fmtT(a.years[y]?.net || 0)} | ${fmtT(a.years[y]?.excess || 0)} | ${c.years[y]?.n || 0} | ${fmtT(c.years[y]?.net || 0)} | ${fmtT(c.years[y]?.excess || 0)} |`);
  L.push('', '## Reading', '');
  return L;
}

// written after the run; the figures it quotes are checked against result.json by tests/gold-momentum-acceleration.test.mjs
export const READING = [
  '- **The primary test fails.** Out of sample the 13-week acceleration rule made +0.029R a trade more than the same-side every-week trade (n 76, month t 0.21, Holm p 1.000); in sample it made −0.165R less (n 68, t −1.20): the sign flips between the windows. Its sides beat 24 of 40 shuffles of the same sides (placebo 95th percentile t 1.62): no information in the direction.',
  '- **On its own the rule loses.** Net −0.015R a trade out of sample (+0.057R gross; spread 0.014R and financing 0.057R take more than the gross, cost share 126%) and −0.221R in sample (t −1.57). Median stop $48.69 out of sample, $38.24 in sample.',
  '- **The baseline is gold\'s drift.** A buy of every week with the same stop and hold made +0.187R net out of sample and +0.016R in sample; a sell lost −0.263R and −0.116R. The rule\'s long leg (+0.090R net out of sample) is under the plain buy (excess −0.097R); its short leg loses less than the plain sell (excess +0.149R, t 0.91), which is what the small positive T1 is made of.',
  '- **The 26-week reading (T3) reverses**: +0.384R excess in sample (n 44, t 1.76), −0.078R out of sample (n 61, t −0.44).',
  '- 83% (T1) and 91% (T3) of the signals point the same way as plain momentum over the last half-window: the reading is mostly momentum, and gold\'s momentum is already known not to pay here (`gold-tsmom`, `gold-weekly-momentum`). Nothing proposed; not an edge; nothing live changed.',
];

export function load(file) {
  const txt = file ? fs.readFileSync(file, 'utf8') : execFileSync('git', ['show', `${DATA_COMMIT}:research/daily/xau.json`], { encoding: 'utf8', maxBuffer: 64e6 });
  return toBars(JSON.parse(txt).rows);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const bars = load(process.argv[2]);
  const res = study(bars);
  const out = { study: 'gold-momentum-acceleration', built: '2026-11-14', dataCommit: DATA_COMMIT, prereg: PREREG, params: P, fin: FIN.xau.long,
    verdict: res.tests[0].pass ? 'PASS' : 'FAIL', headline: verdictLine(res), ...res };
  fs.writeFileSync(DIR + 'result.json', JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(DIR + 'RESULT.md', [...report(res), ...READING].join('\n') + '\n');
  console.log(verdictLine(res), verdictLine(res).length);
  for (const t of res.tests) console.log(t.id, JSON.stringify(t.is), '\n  ', JSON.stringify(t.oos), t.holmP, JSON.stringify(t.placebo), JSON.stringify(t.legs), t.sameMomentumShare);
  console.log('BASE', JSON.stringify(res.base));
}
