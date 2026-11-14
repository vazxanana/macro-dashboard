// A gold 20-day closing breakout confirmed by silver, platinum and palladium: does it beat gold's ordinary day of the same side?
// (research/edge/gold-metals-confirm; rules fixed in PREREGISTRATION.md). Paper research only: a stand-alone rule on gold, never
// a gate / entry / exit / size of the live gold book (decision 44).
//   node research/edge/gold-metals-confirm/run.mjs fetch <dir>   copy the daily caches out of origin/council-data (no network)
//   node research/edge/gold-metals-confirm/run.mjs full <dir>    run the study, write result.json next to this file
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FIN, nights, foldWeekend } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DAY = 86400;
export const LOOK = 20, WIN = 3, ATR_N = 20, STOP_ATR = 2, HOLD = 15, RT = 0.60, SEEDS = 40, GAP = 5 * DAY, MIN_CONF = 2;
export const METALS = ['xag', 'xpt', 'xpd'];
export const KEYS = ['xau', ...METALS];
export const IS_FROM = Date.UTC(2007, 0, 1) / 1000, SPLIT = Date.UTC(2017, 0, 1) / 1000, OOS_END = Date.UTC(2026, 9, 31, 23, 59, 59) / 1000;

// ── data ──
export const toBars = (j) => j.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
export const load = (dir, key) => foldWeekend(toBars(JSON.parse(fs.readFileSync(path.join(dir, key + '.json'), 'utf8'))));
export const dayOf = (t) => Math.floor(t / DAY) * DAY;
export function commonDays(series) {
  const m = new Map();
  for (const k of KEYS) for (const b of series[k] || []) { const d = dayOf(b.time); (m.get(d) || m.set(d, { t: d }).get(d))[k] = b.close; }
  return [...m.values()].filter((r) => KEYS.every((k) => r[k] > 0)).sort((a, b) => a.t - b.t);
}
// breakout per common day for one key: +1 close above the highest close of the LOOK days before, -1 below the lowest, 0 neither,
// null while history is short (a hole over GAP restarts it). Only the day and earlier days are read.
export function breakouts(days, key, look = LOOK) {
  const out = []; let start = 0;
  for (let i = 0; i < days.length; i++) {
    if (i > 0 && days[i].t - days[i - 1].t > GAP) start = i;
    if (i - start < look) { out.push(null); continue; }
    let hi = -Infinity, lo = Infinity;
    for (let k = i - look; k < i; k++) { hi = Math.max(hi, days[k][key]); lo = Math.min(lo, days[k][key]); }
    const c = days[i][key];
    out.push(c > hi ? 1 : c < lo ? -1 : 0);
  }
  return out;
}
// gold breakout signals with their confirmation count (metals breaking the same side on the day or the WIN-1 days before)
export function signals(days) {
  const g = breakouts(days, 'xau'), m = Object.fromEntries(METALS.map((k) => [k, breakouts(days, k)]));
  const out = [];
  for (let i = 0; i < days.length; i++) {
    const s = g[i]; if (!s) continue;
    let conf = 0;
    for (const k of METALS) { for (let q = Math.max(0, i - WIN + 1); q <= i; q++) if (m[k][q] === s) { conf++; break; } }
    out.push({ t: days[i].t, i, side: s, conf, confirmed: conf >= MIN_CONF });
  }
  return out;
}
// first gold candle whose UTC day is later than t
export function entryIndex(gold, t) {
  let lo = 0, hi = gold.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (dayOf(gold[m].time) > t) hi = m; else lo = m + 1; }
  return lo < gold.length ? lo : -1;
}
export function atrBefore(gold, j, n = ATR_N) {
  if (j - n - 1 < 0) return null;
  let s = 0;
  for (let i = j - n; i < j; i++) { const b = gold[i], pc = gold[i - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
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
    out.push({ ...tr, sig: s.t, conf: s.conf }); lastK = tr.k;
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

export function windowRun(gold, days, sigs, from, to, costX = 1) {
  const end = Math.max(to, ...[]);
  const base = baseline(gold, days, from, to, costX);
  const inW = sigs.filter((s) => s.t >= from && s.t <= to);
  const conf = addExcess(stream(gold, inW.filter((s) => s.confirmed), costX), base);
  const unc = addExcess(stream(gold, inW.filter((s) => !s.confirmed), costX), base);
  const all = addExcess(stream(gold, inW, costX), base);
  const e = Math.max(end, ...conf.map((x) => x.c), ...unc.map((x) => x.c));
  return { base, conf, unc, all, end: e, inW };
}

export function study(dir, { seeds = SEEDS } = {}) {
  const series = Object.fromEntries(KEYS.map((k) => [k, load(dir, k)])), gold = series.xau, days = commonDays(series);
  const sigs = signals(days);
  const lastDay = dayOf(gold[gold.length - 1].time) + DAY - 1;
  const W = { is: [IS_FROM, SPLIT - 1], oos: [SPLIT, Math.min(OOS_END, lastDay)] };
  const res = {}; const tests = { T1: { id: 'T1', what: 'confirmed breakouts, both sides: excess net R over the same-side every-day baseline (primary)' },
    T2: { id: 'T2', what: 'confirmed minus unconfirmed: monthly difference of excess net R' },
    T3: { id: 'T3', what: 'confirmed breakouts, both sides: raw net R' } };
  for (const [w, [from, to]] of Object.entries(W)) {
    const r1 = windowRun(gold, days, sigs, from, to, 1), r2x = windowRun(gold, days, sigs, from, to, 2);
    const sC = summarize(r1.conf, from, r1.end), sU = summarize(r1.unc, from, r1.end), sA = summarize(r1.all, from, r1.end);
    const diff = stat(monthSums(r1.conf, from, r1.end, 'excess').map((v, i) => v - monthSums(r1.unc, from, r1.end, 'excess')[i]));
    const confCounts = [0, 1, 2, 3].map((c) => r1.inW.filter((s) => s.conf === c).length);
    res[w] = {
      from: iso(from), to: iso(to),
      baseline: { long: { n: r1.base[1].n, net: r3(r1.base[1].net) }, short: { n: r1.base[-1].n, net: r3(r1.base[-1].net) },
        x2: { long: r3(r2x.base[1].net), short: r3(r2x.base[-1].net) } },
      signals: { n: r1.inW.length, up: r1.inW.filter((s) => s.side > 0).length, down: r1.inW.filter((s) => s.side < 0).length, byConf: confCounts },
      confirmed: { ...sC, x2Excess: r3(stat(r2x.conf.map((x) => x.excess)).mean), x2Net: r3(stat(r2x.conf.map((x) => x.net)).mean), split: sideSplit(r1.conf), years: byYear(r1.conf) },
      unconfirmed: { ...sU, split: sideSplit(r1.unc) },
      allBreakouts: { ...sA, split: sideSplit(r1.all) },
      diff: { meanMonth: r3(diff.mean), tMonth: r2(diff.t), months: diff.n },
    };
    tests.T1[w] = { n: sC.n, mean: sC.excess, meanExact: sC.excessExact, tMonth: sC.tMonthExcess, x2: res[w].confirmed.x2Excess };
    tests.T2[w] = { nConf: sC.n, nUnc: sU.n, mean: r3(diff.mean), meanExact: diff.mean == null ? null : +diff.mean.toPrecision(4), tMonth: r2(diff.t) };
    tests.T3[w] = { n: sC.n, mean: sC.net, meanExact: sC.net, tMonth: sC.tMonthNet, x2: res[w].confirmed.x2Net };
    if (w === 'oos') {
      res.oos.trades = r1.conf.map((x) => ({ sig: iso(x.sig), entry: iso(x.t), side: x.side, conf: x.conf, e: r2(x.e), risk: r2(x.risk), exit: r2(x.exit), kind: x.kind, gross: r3(x.gross), net: r3(x.net), excess: r3(x.excess) }));
      if (seeds) {
        const nUp = r1.inW.filter((s) => s.confirmed && s.side > 0).length, nDn = r1.inW.filter((s) => s.confirmed && s.side < 0).length;
        const ups = r1.inW.filter((s) => s.side > 0), dns = r1.inW.filter((s) => s.side < 0), ts = [];
        for (let k = 1; k <= seeds; k++) {
          const rr = lcg(k), pick = [...sample(ups, nUp, rr), ...sample(dns, nDn, rr)].sort((a, b) => a.t - b.t);
          const tr = addExcess(stream(gold, pick), r1.base);
          ts.push(r2(stat(monthSums(tr, from, Math.max(r1.end, ...tr.map((x) => x.c)), 'excess')).t));
        }
        const real = sC.tMonthExcess, srt = [...ts].sort((a, b) => a - b);
        tests.T1.placebo = { seeds, drawsUp: nUp, drawsDown: nDn, t: ts, beaten: ts.filter((t) => real != null && t != null && real > t).length, median: srt[20], p95: srt[38] };
      }
    }
  }
  const list = [tests.T1, tests.T2, tests.T3];
  const ps = list.map((t) => normP(t.oos.tMonth)), hs = holm(ps);
  list.forEach((t, i) => { t.p = +ps[i].toPrecision(3); t.holm = +hs[i].toPrecision(3); });
  const T1 = tests.T1;
  T1.checks = { oosTAndHolm: T1.oos.tMonth != null && T1.oos.tMonth >= 2 && T1.holm < 0.05, isPositive: T1.is.meanExact > 0,
    x2Positive: T1.oos.x2 > 0, placebo38: (T1.placebo?.beaten ?? 0) >= 38, medianStop10: res.oos.confirmed.medianStop >= 10 };
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
    const out = { title: 'Gold 20-day breakout confirmed by silver, platinum and palladium, against the same-side every-day baseline', built: '2026-11-14',
      prereg: 'PREREGISTRATION.md', councilData: src, system: 'stand-alone gold rule (research only)',
      rule: { breakout: `close beyond the ${LOOK}-day close extreme`, confirmation: `>= ${MIN_CONF} of ${METALS.join(', ')} breaking the same side within ${WIN} days`,
        entry: 'next gold open', stop: `${STOP_ATR} x ATR(${ATR_N})`, exit: `close of candle ${HOLD}`, costs: `$${RT.toFixed(2)} a round trip + nights() x FIN.xau.long on buys`, oneAtATime: true },
      fin: FIN.xau.long, isFrom: '2007-01-01', split: '2017-01-01', oosEnd: '2026-10-31', ...r };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    for (const t of r.tests) console.log(t.id, JSON.stringify({ is: t.is, oos: t.oos, p: t.p, holm: t.holm, pass: t.pass, lead: t.lead, checks: t.checks, placebo: t.placebo && { ...t.placebo, t: undefined } }));
    for (const w of ['is', 'oos']) { const x = r.windows[w]; console.log(w, JSON.stringify({ baseline: x.baseline, signals: x.signals, diff: x.diff }));
      for (const s of ['confirmed', 'unconfirmed', 'allBreakouts']) console.log(' ', s, JSON.stringify({ ...x[s], years: undefined })); }
    console.log('data', JSON.stringify(r.data));
    console.log('VERDICT', r.verdict);
  } else console.log('usage: run.mjs fetch <dir> | full <dir>');
};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
