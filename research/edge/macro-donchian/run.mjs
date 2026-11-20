// Edge research · macro-donchian: the macro rule book's Donchian execution layer on OANDA spot gold, net of costs and
// financing, with the Gold Macro Score split and a random-entry placebo (PREREGISTRATION.md, 20 Nov 2026).
//   node research/edge/macro-donchian/run.mjs fetch <dir>   → copies the inputs from origin/council-data (git, no network)
//   node research/edge/macro-donchian/run.mjs run <dir>     → writes result.json and RESULT.md here
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';
import { dxyDaily, dailyRows } from '../../../council/macroscore.mjs';
import { weeklyScore } from '../blowoff-veto/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), DAY = 86400;
export const P = { N: 20, EMA_F: 20, EMA_S: 50, ATR: 14, MULT: 2, HOLD: 5, COST: 0.0001, BUY: 0.25, SEEDS: 40, FROM: '2007-01-01', SPLIT: '2017-01-01' };
const FILES = ['research/daily/xau.json', 'research/daily/eurusd.json', 'research/daily/usdjpy.json', 'research/daily/gbpusd.json', 'research/daily/usdcad.json', 'research/daily/usdchf.json', 'macro/cache.json'];
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const sd = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : NaN; };
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);

export function ema(v, n) { const k = 2 / (n + 1), out = []; let e = v[0]; for (let i = 0; i < v.length; i++) { e = i ? v[i] * k + e * (1 - k) : v[0]; out.push(e); } return out; }
export function atr(b, n) {
  const tr = b.map((x, i) => (i ? Math.max(x.high - x.low, Math.abs(x.high - b[i - 1].close), Math.abs(x.low - b[i - 1].close)) : x.high - x.low));
  return tr.map((_, i) => (i >= n ? mean(tr.slice(i - n + 1, i + 1)) : NaN));
}
// indicators per day (closes known at the day's end)
export function frame(bars) {
  const c = bars.map((b) => b.close), ef = ema(c, P.EMA_F), es = ema(c, P.EMA_S), a = atr(bars, P.ATR);
  return bars.map((b, i) => {
    let hh = -Infinity, ll = Infinity; if (i >= P.N) for (let k = i - P.N; k < i; k++) { hh = Math.max(hh, bars[k].high); ll = Math.min(ll, bars[k].low); }
    return { i, t: b.time, day: iso(b.time), up: ef[i] > es[i], dn: ef[i] < es[i], atr: a[i], longSig: i >= P.N && b.close > hh && ef[i] > es[i], shortSig: i >= P.N && b.close < ll && ef[i] < es[i] };
  });
}
// one trade from a signal on day i (entry at day i+1's open); null when the data ends first
export function trade(bars, F, i, side) {
  if (i + P.HOLD >= bars.length || !(F[i].atr > 0)) return null;
  const e = bars[i + 1].open, r = P.MULT * F[i].atr, stop = e - side * r;
  let exit = null, xi = i + P.HOLD, how = 'time';
  for (let k = i + 1; k <= i + P.HOLD; k++) {
    const b = bars[k];
    if (k > i + 1 && (side > 0 ? b.open <= stop : b.open >= stop)) { exit = b.open; xi = k; how = 'gap'; break; }
    if (side > 0 ? b.low <= stop : b.high >= stop) { exit = stop; xi = k; how = 'stop'; break; }
  }
  if (exit == null) exit = bars[i + P.HOLD].close;
  const R = side * (exit - e) / r, fin = side > 0 ? nights(bars[i + 1].time, bars[xi].time + DAY) * FIN.xau.long * e : 0;
  return { sigI: i, day: F[i].day, side, entry: e, exit, how, R, net: (side * (exit - e) - P.COST * e - fin) / r, nextI: xi + 1 };
}
export function stream(bars, F, side, pick = (i) => (side > 0 ? F[i].longSig : F[i].shortSig)) {
  const out = []; let free = 0;
  for (let i = 0; i < bars.length; i++) { if (i < free || F[i].day < P.FROM || !pick(i)) continue; const x = trade(bars, F, i, side); if (!x) break; out.push(x); free = x.nextI; }
  return out;
}
export function monthT(tr, key = 'net') {
  const m = new Map(); for (const x of tr) { const k = x.day.slice(0, 7); m.set(k, (m.get(k) || 0) + x[key]); }
  const v = [...m.values()]; return v.length > 1 ? mean(v) / (sd(v) / Math.sqrt(v.length)) : NaN;
}
export function welch(a, b) { if (a.length < 2 || b.length < 2) return NaN; return (mean(a) - mean(b)) / Math.sqrt(sd(a) ** 2 / a.length + sd(b) ** 2 / b.length); }
export function normP(t) { const x = Math.abs(t) / Math.SQRT2, k = 1 / (1 + 0.3275911 * x), y = 1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-x * x); return 1 - y; }
export function holm(ps) { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = Array(ps.length); let run = 0; o.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, p * (ps.length - k))); out[i] = run; }); return out; }
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
export function summary(tr) {
  const n = tr.length, w = tr.filter((x) => x.net > 0).length, pos = tr.filter((x) => x.net > 0).reduce((s, x) => s + x.net, 0), neg = -tr.filter((x) => x.net < 0).reduce((s, x) => s + x.net, 0);
  return { n, win: n ? r3(w / n) : null, netR: r3(mean(tr.map((x) => x.net))), grossR: r3(mean(tr.map((x) => x.R))), total: r2(tr.reduce((s, x) => s + x.net, 0)), pf: neg ? r2(pos / neg) : null, t: r2(monthT(tr)) };
}

export function analyse(bars, scoreAt) {
  const F = frame(bars), L = stream(bars, F, 1), S = stream(bars, F, -1);
  for (const x of L) x.score = scoreAt(bars[x.sigI].time);
  const half = (tr, a) => tr.filter((x) => (a ? x.day < P.SPLIT : x.day >= P.SPLIT));
  // placebo: random longs on up-trend days at the real rule's rate
  const upDays = F.filter((f) => f.day >= P.FROM && f.up).length, rate = F.filter((f) => f.day >= P.FROM && f.longSig).length / Math.max(1, upDays);
  const pl = [];
  for (let s = 1; s <= P.SEEDS; s++) { const rnd = rng(s); pl.push(mean(stream(bars, F, 1, (i) => F[i].up && rnd() < Math.min(1, rate)).map((x) => x.net))); }
  const sorted = [...pl].sort((a, b) => a - b), p95 = sorted[Math.floor(0.95 * (sorted.length - 1))];
  const hi = L.filter((x) => x.score != null && x.score > P.BUY).map((x) => x.net), lo = L.filter((x) => x.score != null && x.score <= P.BUY).map((x) => x.net);
  const t1 = monthT(L), t2 = welch(hi, lo), [h1, h2] = holm([normP(t1), normP(t2)]);
  const long = summary(L), checks = { netPos: long.netR > 0, t2: t1 >= 2, halves: summary(half(L, true)).netR > 0 && summary(half(L, false)).netR > 0, placebo: mean(L.map((x) => x.net)) > p95, holm: h1 < 0.05 };
  return { long, longHalves: { a: summary(half(L, true)), b: summary(half(L, false)) }, short: summary(S), shortHalves: { a: summary(half(S, true)), b: summary(half(S, false)) },
    scoreSplit: { above: { n: hi.length, netR: r3(mean(hi)), win: r3(hi.filter((v) => v > 0).length / hi.length) }, atOrBelow: { n: lo.length, netR: r3(mean(lo)), win: r3(lo.filter((v) => v > 0).length / lo.length) }, unscored: L.filter((x) => x.score == null).length, t: r2(t2), pHolm: r3(h2), pass: t2 >= 2 && h2 < 0.05 },
    placebo: { seeds: P.SEEDS, rate: r3(rate), median: r3(sorted[Math.floor(sorted.length / 2)]), p95: r3(p95), min: r3(sorted[0]), max: r3(sorted.at(-1)) },
    T1: { t: r2(t1), pHolm: r3(h1), checks, pass: Object.values(checks).every(Boolean) },
    byYear: Object.fromEntries([...new Set(L.map((x) => x.day.slice(0, 4)))].map((y) => [y, summary(L.filter((x) => x.day.startsWith(y)))])),
    trades: L.map((x) => [x.day, x.side, r2(x.entry), r2(x.exit), x.how, r3(x.R), r3(x.net), x.score == null ? null : r3(x.score)]) };
}

export function load(dir) {
  const J = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const g = J('research/daily/xau.json'), ci = Object.fromEntries(g.cols.map((c, i) => [c, i]));
  const bars = foldWeekend(g.rows.map((r) => ({ time: r[ci.t], open: r[ci.o], high: r[ci.h], low: r[ci.l], close: r[ci.c] })));
  const daily = {}; for (const k of ['eurusd', 'usdjpy', 'gbpusd', 'usdcad', 'usdchf']) daily[k] = dailyRows(J(`research/daily/${k}.json`));
  const fred = J('macro/cache.json').score.fred, S = (k) => fred[k].map(([d, v]) => ({ t: Date.parse(d + 'T00:00:00Z') / 1000, v: +v }));
  const W = weeklyScore({ ry: S('DFII10'), y2: S('DGS2'), y10: S('DGS10'), dxy: dxyDaily(daily) }).filter((w) => w.score != null);
  const scoreAt = (t) => { let s = null; for (const w of W) { if (w.t <= t) s = w.score; else break; } return s; };
  return { bars, scoreAt, weeks: W.length };
}

const sg = (v, d = 3) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
export function report(R) {
  const row = (name, s) => `| ${name} | ${s.n} | ${s.win == null ? '—' : (s.win * 100).toFixed(1) + ' %'} | ${sg(s.netR)} | ${sg(s.grossR)} | ${sg(s.total, 2)} | ${s.pf ?? '—'} | ${sg(s.t, 2)} |`;
  return [`# The macro rule book's Donchian swing rule on gold (OANDA spot, net of costs)`, '',
    'Paper research only; a stand-alone rule, not part of the live gold book. The rule, costs, tests and placebo were pushed first (`PREREGISTRATION.md`). This page is written by `run.mjs`.', '',
    `**Verdict: ${R.verdict}**`, '',
    '| Stream | n | Win | Net R/trade | Gross R/trade | Total R | PF | t (months) |', '|---|---|---|---|---|---|---|---|',
    row('Longs 2007 → end', R.long), row('Longs 2007-16', R.longHalves.a), row('Longs 2017 → end', R.longHalves.b),
    row('Shorts 2007 → end', R.short), row('Shorts 2007-16', R.shortHalves.a), row('Shorts 2017 → end', R.shortHalves.b), '',
    `T1 checks: ${Object.entries(R.T1.checks).map(([k, v]) => `${k} ${v ? 'yes' : 'no'}`).join(', ')} (Holm p ${R.T1.pHolm}).`, '',
    `Placebo (random longs in the same up-trend, ${R.placebo.seeds} seeds): median ${sg(R.placebo.median)}R, 95th percentile ${sg(R.placebo.p95)}R, range ${sg(R.placebo.min)} to ${sg(R.placebo.max)}R.`, '',
    `T2, the score's sizing claim: longs with score > +0.25 ${sg(R.scoreSplit.above.netR)}R (n ${R.scoreSplit.above.n}, ${(R.scoreSplit.above.win * 100).toFixed(0)} % won) against ${sg(R.scoreSplit.atOrBelow.netR)}R (n ${R.scoreSplit.atOrBelow.n}, ${(R.scoreSplit.atOrBelow.win * 100).toFixed(0)} % won); Welch t ${sg(R.scoreSplit.t, 2)}, Holm p ${R.scoreSplit.pHolm}: ${R.scoreSplit.pass ? 'passes' : 'fails'}. Longs before the score's first reading: ${R.scoreSplit.unscored}.`, '',
    '## Longs by year', '', '| Year | n | Net R/trade | Total |', '|---|---|---|---|',
    ...Object.entries(R.byYear).map(([y, s]) => `| ${y} | ${s.n} | ${sg(s.netR)} | ${sg(s.total, 2)} |`), '',
    '## Reading', '', R.reading, ''].join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') { for (const f of FILES) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), execFileSync('git', ['show', 'origin/council-data:' + f], { maxBuffer: 1 << 28 })); } console.log('fetched', FILES.length); }
  else if (cmd === 'run') {
    const D = load(dir), A = analyse(D.bars, D.scoreAt), sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
    const verdict = A.T1.pass
      ? `PASS: longs ${sg(A.long.netR)}R a trade net (n ${A.long.n}, month t ${sg(A.long.t, 2)}), both halves positive, above every placebo bar; a replication on the author's own years, not an untouched test`
      : `FAIL: longs ${sg(A.long.netR)}R a trade net (n ${A.long.n}, month t ${sg(A.long.t, 2)}; failed: ${Object.entries(A.T1.checks).filter(([, v]) => !v).map(([k]) => k).join(', ')}); score split ${A.scoreSplit.pass ? 'passes' : 'fails'} (t ${sg(A.scoreSplit.t, 2)})`;
    const res = { study: 'macro-donchian', title: "The macro rule book's Donchian swing rule on gold", built: '2026-11-20', planSha256: sha, params: P, dataEnd: iso(D.bars.at(-1).time), weeks: D.weeks, verdict, ...A, reading: '' };
    res.reading = `The rule book quotes +0.24R a trade on 174 longs before costs (futures, 2007-26). On OANDA spot, folded trading days, the same rule gives ${A.long.n} longs at ${sg(A.long.grossR)}R before costs and ${sg(A.long.netR)}R after costs and financing (month t ${sg(A.long.t, 2)}); random longs in the same up-trend made ${sg(A.placebo.median)}R (95th percentile ${sg(A.placebo.p95)}R). Shorts ${sg(A.short.netR)}R (n ${A.short.n}). ` + (A.T1.pass ? 'It replicates, on years its author had seen: at most a proposal for a forward record.' : 'Not supported as an edge on this data; nothing live changes.');
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(res));
    console.log(verdict); console.log(JSON.stringify({ long: A.long, halves: A.longHalves, short: A.short, split: A.scoreSplit, placebo: A.placebo }));
  }
}
