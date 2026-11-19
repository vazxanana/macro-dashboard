// Gold after a large intraday reversal in silver: does gold follow the way silver closed, better than gold's ordinary day of the
// same side? (research/edge/gold-silver-reversal-day; rules fixed in PREREGISTRATION.md). Paper research only: a stand-alone
// rule on gold, never a gate / entry / exit / size of the live gold book (decision 44).
//   node research/edge/gold-silver-reversal-day/run.mjs fetch <dir>   copy the daily caches out of origin/council-data (no network)
//   node research/edge/gold-silver-reversal-day/run.mjs full <dir>    run the study, write result.json next to this file
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FIN, nights, foldWeekend } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DAY = 86400;
export const SATR_N = 20, THRUST = 0.5, ATR_N = 20, STOP_ATR = 2, HOLD = 5, RT = 0.60, SEEDS = 40;
export const KEYS = ['xau', 'xag'];
export const IS_FROM = Date.UTC(2007, 0, 1) / 1000, SPLIT = Date.UTC(2017, 0, 1) / 1000, OOS_END = Date.UTC(2026, 9, 31, 23, 59, 59) / 1000;

// ── data ──
export const toBars = (j) => j.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
export const load = (dir, key) => foldWeekend(toBars(JSON.parse(fs.readFileSync(path.join(dir, key + '.json'), 'utf8'))));
export const dayOf = (t) => Math.floor(t / DAY) * DAY;
// common days: { t, xau: candle, xag: candle, ixau, ixag } (indices into each series)
export function commonDays(series) {
  const m = new Map();
  for (const k of KEYS) series[k].forEach((b, i) => { const d = dayOf(b.time); const r = m.get(d) || m.set(d, { t: d }).get(d); r[k] = b; r['i' + k] = i; });
  return [...m.values()].filter((r) => KEYS.every((k) => r[k] && r[k].close > 0)).sort((a, b) => a.t - b.t);
}
// silver ATR over the n silver candles BEFORE index i (needs n + 1 earlier candles)
export function atrBefore(bars, j, n = ATR_N) {
  if (j - n - 1 < 0) return null;
  let s = 0;
  for (let i = j - n; i < j; i++) { const b = bars[i], pc = bars[i - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}
// silver reversal on silver candle i: -1 bearish (ran >= THRUST x ATR above the previous close, closed below it), +1 bullish, 0 none.
// Reads candle i and earlier only.
export function silverRev(xag, i, k = THRUST) {
  const a = atrBefore(xag, i, SATR_N); if (!(a > 0)) return null;
  const b = xag[i], pc = xag[i - 1].close;
  if (b.high - pc >= k * a && b.close < pc) return -1;
  if (pc - b.low >= k * a && b.close > pc) return 1;
  return 0;
}
// signals per common day; goldRev = gold itself closed beyond its previous close the reversal's way
export function signals(series, days) {
  const out = [];
  for (const d of days) {
    const i = d.ixag, s = silverRev(series.xag, i); if (!s) continue;
    const g = series.xau, j = d.ixau; if (j < 1) continue;
    const gc = g[j].close, gpc = g[j - 1].close;
    out.push({ t: d.t, side: s, goldRev: s < 0 ? gc < gpc : gc > gpc });
  }
  return out;
}
// first gold candle whose UTC day is later than t
export function entryIndex(gold, t) {
  let lo = 0, hi = gold.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (dayOf(gold[m].time) > t) hi = m; else lo = m + 1; }
  return lo < gold.length ? lo : -1;
}
// a Friday candle ends at the 22:00 UTC weekly close, any other at the day end
export const exitStamp = (dayT) => dayT + (new Date(dayT * 1000).getUTCDay() === 5 ? 22 * 3600 - 1 : DAY - 1);

// one trade from candle j: stop 2 x ATR(20), out at the close of candle HOLD (entry candle = 1); stop first, a gap fills at the open
export function trade(gold, j, side, costX = 1) {
  const atr = atrBefore(gold, j);
  if (!(atr > 0)) return null;
  const risk = STOP_ATR * atr, e = gold[j].open, stop = e - side * risk, last = j + HOLD - 1;
  if (last >= gold.length) return null;   // runs past the data: left out
  const through = (px) => (side > 0 ? px <= stop : px >= stop);
  let exit = null, kind = null, k = j, c = null;
  for (; k <= last; k++) {
    const b = gold[k];
    if (k > j && through(b.open)) { exit = b.open; kind = 'gap'; c = b.time; break; }
    if (through(side > 0 ? b.low : b.high)) { exit = stop; kind = 'stop'; break; }
    if (k === last) { exit = b.close; kind = 'time'; break; }
  }
  if (c == null) c = exitStamp(dayOf(gold[k].time));
  const t = gold[j].time, nn = nights(t, c);
  const gross = side * (exit - e) / risk, fin = side > 0 ? nn * FIN.xau.long * e / risk : 0, rt = RT / risk;
  return { t, c, j, k, side, e, stop, risk, exit, kind, nights: nn, gross, fin, cost: rt + fin, net: gross - costX * (rt + fin) };
}
// one at a time over a list of signals (sorted by day)
export function stream(gold, sigs, costX = 1) {
  const out = []; let lastK = -1;
  for (const s of sigs) {
    const j = entryIndex(gold, s.t); if (j < 0 || j <= lastK) continue;
    const tr = trade(gold, j, s.side, costX); if (!tr) continue;
    out.push({ ...tr, sig: s.t, goldRev: s.goldRev }); lastK = tr.k;
  }
  return out;
}
// baseline: the same trade entered after EVERY common day of the window, overlapping; mean net R per side
export function baseline(gold, days, from, to, costX = 1) {
  const out = {}, seen = new Set();
  const acc = { 1: [], [-1]: [] };
  for (const d of days) {
    if (d.t < from || d.t > to) continue;
    const j = entryIndex(gold, d.t); if (j < 0 || seen.has(j)) continue; seen.add(j);
    for (const side of [1, -1]) { const tr = trade(gold, j, side, costX); if (tr) acc[side].push(tr.net); }
  }
  for (const side of [1, -1]) { const s = stat(acc[side]); out[side] = { n: s.n, net: s.mean }; }
  return out;
}
export const addExcess = (trs, base) => trs.map((x) => ({ ...x, excess: x.net - base[x.side].net }));

// ── statistics ──
const sd = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
export function stat(a) {
  const n = a.length; if (!n) return { n: 0, mean: null, t: null, sum: 0 };
  const m = a.reduce((x, y) => x + y, 0) / n, s = n > 1 ? sd(a) : 0;
  return { n, mean: m, sum: m * n, t: s > 0 ? m / (s / Math.sqrt(n)) : null };
}
const mk = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
// calendar-month sums of `key` by exit month over [from, end]; months with no trade are 0
export function monthSums(rows, from, end, key) {
  const a = mk(from), b = mk(end), m = new Array(b - a + 1).fill(0);
  for (const r of rows) { const x = mk(r.c) - a; if (x >= 0 && x < m.length) m[x] += r[key]; }
  return m;
}
export function normP(t) {
  if (t == null) return 1;
  const x = Math.abs(t) / Math.SQRT2, k = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-x * x);
  return t >= 0 ? (1 - erf) / 2 : (1 + erf) / 2;
}
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let run = 0;
  o.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, p * (ps.length - k))); out[i] = run; });
  return out;
}
// a fixed linear congruential generator (Numerical Recipes constants), seeds 1-40
export function lcg(seed) {
  let a = (seed * 2654435761) >>> 0;
  return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; };
}
export function sample(arr, n, r) {
  const a = [...arr];
  for (let i = 0; i < Math.min(n, a.length); i++) { const j = i + Math.floor(r() * (a.length - i)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n).sort((x, y) => x.t - y.t);
}

const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000), r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
export const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
function maxDD(trs) { let c = 0, pk = 0, dd = 0; for (const x of [...trs].sort((a, b) => a.c - b.c)) { c += x.net; pk = Math.max(pk, c); dd = Math.min(dd, c - pk); } return dd; }
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

export function summarize(trs, from, end) {
  const net = stat(trs.map((x) => x.net)), g = stat(trs.map((x) => x.gross)), ex = stat(trs.map((x) => x.excess ?? 0));
  const mNet = stat(monthSums(trs, from, end, 'net')), mEx = stat(monthSums(trs, from, end, 'excess')), mG = stat(monthSums(trs, from, end, 'gross'));
  const kinds = {}; for (const x of trs) kinds[x.kind] = (kinds[x.kind] || 0) + 1;
  const absG = stat(trs.map((x) => Math.abs(x.gross))).mean, cost = stat(trs.map((x) => x.cost)).mean;
  return {
    n: net.n, longs: trs.filter((x) => x.side > 0).length, shorts: trs.filter((x) => x.side < 0).length,
    win: net.n ? r3(trs.filter((x) => x.net > 0).length / net.n) : null, exits: kinds,
    gross: r3(g.mean), net: r3(net.mean), excess: r3(ex.mean), excessExact: ex.mean == null ? null : +ex.mean.toPrecision(4),
    totalNet: r2(net.sum), totalExcess: r2(ex.sum), months: mNet.n,
    tMonthNet: r2(mNet.t), tMonthExcess: r2(mEx.t), tMonthGross: r2(mG.t), tTradeNet: r2(net.t), tTradeExcess: r2(ex.t),
    meanCost: r3(cost), costShare: absG ? r3(cost / absG) : null, medianStop: r2(median(trs.map((x) => x.risk))),
    worstDD: r2(maxDD(trs)),
  };
}
const sideSplit = (tr) => Object.fromEntries([['long', 1], ['short', -1]].map(([k, s]) => {
  const a = tr.filter((x) => x.side === s); return [k, { n: a.length, net: r3(stat(a.map((x) => x.net)).mean), excess: r3(stat(a.map((x) => x.excess)).mean) }];
}));
const byYear = (tr) => { const y = {}; for (const x of tr) { const k = new Date(x.sig * 1000).getUTCFullYear(); (y[k] ||= { n: 0, net: 0, excess: 0 }); y[k].n++; y[k].net += x.net; y[k].excess += x.excess; } for (const k in y) { y[k].net = r2(y[k].net); y[k].excess = r2(y[k].excess); } return y; };

const flip = (sigs) => sigs.map((s) => ({ ...s, side: -s.side }));
export function windowRun(gold, days, sigs, from, to, costX = 1) {
  const base = baseline(gold, days, from, to, costX);
  const inW = sigs.filter((s) => s.t >= from && s.t <= to);
  const all = addExcess(stream(gold, inW, costX), base);
  const quiet = addExcess(stream(gold, inW.filter((s) => !s.goldRev), costX), base);
  const follow = addExcess(stream(gold, flip(inW), costX), base);
  const end = Math.max(to, ...all.map((x) => x.c), ...quiet.map((x) => x.c), ...follow.map((x) => x.c));
  return { base, all, quiet, follow, end, inW };
}

export function study(dir, { seeds = SEEDS } = {}) {
  const series = Object.fromEntries(KEYS.map((k) => [k, load(dir, k)])), gold = series.xau, days = commonDays(series);
  const sigs = signals(series, days);
  const lastDay = dayOf(gold[gold.length - 1].time) + DAY - 1;
  const W = { is: [IS_FROM, SPLIT - 1], oos: [SPLIT, Math.min(OOS_END, lastDay)] };
  const res = {}; const tests = { T1: { id: 'T1', what: 'all silver reversals, both sides, gold traded the way silver closed: excess net R over the same-side every-day baseline (primary)' },
    T2: { id: 'T2', what: 'silver reversals on days gold did not itself close the reversal way: excess net R' },
    T3: { id: 'T3', what: 'the T1 stream: raw net R' } };
  for (const [w, [from, to]] of Object.entries(W)) {
    const r1 = windowRun(gold, days, sigs, from, to, 1), r2x = windowRun(gold, days, sigs, from, to, 2);
    const sA = summarize(r1.all, from, r1.end), sQ = summarize(r1.quiet, from, r1.end), sF = summarize(r1.follow, from, r1.end);
    res[w] = {
      from: iso(from), to: iso(to),
      baseline: { long: { n: r1.base[1].n, net: r3(r1.base[1].net) }, short: { n: r1.base[-1].n, net: r3(r1.base[-1].net) },
        x2: { long: r3(r2x.base[1].net), short: r3(r2x.base[-1].net) } },
      signals: { n: r1.inW.length, bearish: r1.inW.filter((s) => s.side < 0).length, bullish: r1.inW.filter((s) => s.side > 0).length,
        goldAlsoReversed: r1.inW.filter((s) => s.goldRev).length },
      all: { ...sA, x2Excess: r3(stat(r2x.all.map((x) => x.excess)).mean), x2Net: r3(stat(r2x.all.map((x) => x.net)).mean), split: sideSplit(r1.all), years: byYear(r1.all) },
      quiet: { ...sQ, x2Excess: r3(stat(r2x.quiet.map((x) => x.excess)).mean), split: sideSplit(r1.quiet) },
      followMirror: { ...sF, split: sideSplit(r1.follow) },
    };
    tests.T1[w] = { n: sA.n, mean: sA.excess, meanExact: sA.excessExact, tMonth: sA.tMonthExcess, x2: res[w].all.x2Excess, gross: sA.gross, net: sA.net, tMonthGross: sA.tMonthGross };
    tests.T2[w] = { n: sQ.n, mean: sQ.excess, meanExact: sQ.excessExact, tMonth: sQ.tMonthExcess, x2: res[w].quiet.x2Excess, gross: sQ.gross, net: sQ.net };
    tests.T3[w] = { n: sA.n, mean: sA.net, meanExact: sA.net, tMonth: sA.tMonthNet, x2: res[w].all.x2Net, gross: sA.gross, tMonthGross: sA.tMonthGross };
    if (w === 'oos') {
      res.oos.trades = r1.all.map((x) => ({ sig: iso(x.sig), entry: iso(x.t), side: x.side, goldRev: x.goldRev, e: r2(x.e), risk: r2(x.risk), exit: r2(x.exit), kind: x.kind, gross: r3(x.gross), net: r3(x.net), excess: r3(x.excess) }));
      if (seeds) {
        const nUp = r1.all.filter((x) => x.side > 0).length, nDn = r1.all.filter((x) => x.side < 0).length;
        const pool = days.filter((d) => d.t >= from && d.t <= to).map((d) => ({ t: d.t })), ts = [];
        for (let k = 1; k <= seeds; k++) {
          const rr = lcg(k), a = sample(pool, nUp + nDn, rr);
          // the first nUp drawn (before sorting by time, a second shuffle decides sides) are buys
          const order = sample(a.map((x, i) => ({ ...x, i })), a.length, rr);
          const pick = order.map((x, q) => ({ t: x.t, side: q < nUp ? 1 : -1 })).sort((p, q) => p.t - q.t);
          const tr = addExcess(stream(gold, pick), r1.base);
          ts.push(r2(stat(monthSums(tr, from, Math.max(r1.end, ...tr.map((x) => x.c)), 'excess')).t));
        }
        const real = sA.tMonthExcess, srt = [...ts].sort((a, b) => a - b);
        tests.T1.placebo = { seeds, drawsUp: nUp, drawsDown: nDn, t: ts, beaten: ts.filter((t) => real != null && t != null && real > t).length, median: srt[20], p95: srt[38] };
      }
    }
  }
  const list = [tests.T1, tests.T2, tests.T3];
  const ps = list.map((t) => normP(t.oos.tMonth)), hs = holm(ps);
  list.forEach((t, i) => { t.p = +ps[i].toPrecision(3); t.holm = +hs[i].toPrecision(3); });
  const T1 = tests.T1;
  T1.checks = { oosTAndHolm: T1.oos.tMonth != null && T1.oos.tMonth >= 2 && T1.holm < 0.05, isPositive: T1.is.meanExact > 0,
    x2Positive: T1.oos.x2 > 0, placebo38: (T1.placebo?.beaten ?? 0) >= 38, medianStop10: res.oos.all.medianStop >= 10 };
  T1.pass = Object.values(T1.checks).every(Boolean);
  for (const t of [tests.T2, tests.T3]) t.lead = t.oos.tMonth != null && t.oos.tMonth >= 2 && t.holm < 0.05 && t.is.meanExact > 0;
  const verdict = T1.pass ? 'PASS' : 'FAIL';
  const span = (b) => ({ first: iso(b[0].time), last: iso(b[b.length - 1].time), days: b.length });
  return { data: { ...Object.fromEntries(KEYS.map((k) => [k, span(series[k])])), common: { first: iso(days[0].t), last: iso(days[days.length - 1].t), days: days.length } },
    windows: res, tests: list, verdict };
}

const main = async () => {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    const sha = execFileSync('git', ['rev-parse', 'origin/council-data'], { encoding: 'utf8' }).trim();
    for (const k of KEYS) fs.writeFileSync(path.join(dir, k + '.json'), execFileSync('git', ['show', `${sha}:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
    fs.writeFileSync(path.join(dir, 'SOURCE'), sha + '\n');
    console.log('council-data', sha, '->', dir);
  } else if (cmd === 'full') {
    const r = study(dir), src = fs.existsSync(path.join(dir, 'SOURCE')) ? fs.readFileSync(path.join(dir, 'SOURCE'), 'utf8').trim() : null;
    const out = { title: 'Gold after a large intraday reversal in silver, against the same-side every-day baseline', built: '2026-11-14',
      prereg: 'PREREGISTRATION.md', councilData: src, system: 'stand-alone gold rule (research only)',
      rule: { event: `silver runs >= ${THRUST} x ATR(${SATR_N}) beyond its previous close and closes on the other side of it`,
        side: 'gold traded the way silver closed', entry: 'next gold open', stop: `${STOP_ATR} x ATR(${ATR_N})`, exit: `close of candle ${HOLD}`,
        costs: `$${RT.toFixed(2)} a round trip + nights() x FIN.xau.long on buys`, oneAtATime: true },
      fin: FIN.xau.long, isFrom: '2007-01-01', split: '2017-01-01', oosEnd: '2026-10-31', ...r };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    for (const t of r.tests) console.log(t.id, JSON.stringify({ is: t.is, oos: t.oos, p: t.p, holm: t.holm, pass: t.pass, lead: t.lead, checks: t.checks, placebo: t.placebo && { ...t.placebo, t: undefined } }));
    for (const w of ['is', 'oos']) { const x = r.windows[w]; console.log(w, JSON.stringify({ baseline: x.baseline, signals: x.signals }));
      for (const s of ['all', 'quiet', 'followMirror']) console.log(' ', s, JSON.stringify({ ...x[s], years: undefined })); }
    console.log('data', JSON.stringify(r.data));
    console.log('VERDICT', r.verdict);
  } else console.log('usage: run.mjs fetch <dir> | full <dir>');
};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
