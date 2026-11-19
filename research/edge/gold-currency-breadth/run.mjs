// Gold rising (or falling) in every major currency at once: does the move persist? (research/edge/gold-currency-breadth;
// rules fixed in PREREGISTRATION.md). Paper research only: a stand-alone rule on gold, never a gate / entry / exit / size of
// the live gold book (decision 44).
//   node research/edge/gold-currency-breadth/run.mjs fetch <dir>   copy the daily caches out of origin/council-data (no network)
//   node research/edge/gold-currency-breadth/run.mjs full <dir>    run the study, write result.json next to this file
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FIN, nights, foldWeekend } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DAY = 86400;
export const ATR_N = 20, STOP_ATR = 2, MAX_HOLD = 60, RT = 0.60, SEEDS = 40, GAP = 5 * DAY, REDRAW = 50;
export const PAIRS = ['eurusd', 'gbpusd', 'usdjpy', 'usdchf', 'audusd'];
export const KEYS = ['xau', ...PAIRS];
// gold in each currency from the USD gold close and the pair's close
export const CCY = {
  USD: (g) => g.xau, EUR: (g) => g.xau / g.eurusd, GBP: (g) => g.xau / g.gbpusd, AUD: (g) => g.xau / g.audusd,
  JPY: (g) => g.xau * g.usdjpy, CHF: (g) => g.xau * g.usdchf,
};
export const IS_FROM = Date.UTC(2007, 0, 1) / 1000, SPLIT = Date.UTC(2017, 0, 1) / 1000, OOS_END = Date.UTC(2026, 9, 31, 23, 59, 59) / 1000;
const ALL = Object.keys(CCY);
export const TESTS = [
  { id: 'T1', look: 20, sides: [1, -1], ccy: ALL, what: 'gold up (down) over 20 days in all six currencies: buy (sell), both sides (primary)' },
  { id: 'T2', look: 20, sides: [-1], ccy: ALL, what: 'gold down over 20 days in all six currencies: sell (sells only)' },
  { id: 'T3', look: 60, sides: [1, -1], ccy: ALL, what: 'gold up (down) over 60 days in all six currencies: buy (sell), both sides' },
];
export const CONTEXT = { id: 'USD', look: 20, sides: [1, -1], ccy: ['USD'], what: 'context only: the same mechanics, state from gold in USD alone' };

// ── data ──
export const toBars = (j) => j.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
export const load = (dir, key) => foldWeekend(toBars(JSON.parse(fs.readFileSync(path.join(dir, key + '.json'), 'utf8'))));
export const dayOf = (t) => Math.floor(t / DAY) * DAY;

// common days with all six closes: { t, xau, eurusd, ... }
export function commonDays(series) {
  const m = new Map();
  for (const k of KEYS) for (const b of series[k] || []) { const d = dayOf(b.time); (m.get(d) || m.set(d, { t: d }).get(d))[k] = b.close; }
  return [...m.values()].filter((r) => KEYS.every((k) => r[k] > 0)).sort((a, b) => a.t - b.t);
}
// state per common day: +1 all currencies up over `look` common days, -1 all down, 0 otherwise; null while history is short.
// Only the day itself and earlier days are read.
export function states(days, look, ccy = ALL) {
  const out = []; let start = 0;
  for (let i = 0; i < days.length; i++) {
    if (i > 0 && days[i].t - days[i - 1].t > GAP) start = i;
    if (i - start < look) { out.push({ t: days[i].t, s: null }); continue; }
    const r = ccy.map((c) => CCY[c](days[i]) / CCY[c](days[i - look]) - 1);
    out.push({ t: days[i].t, s: r.every((x) => x > 0) ? 1 : r.every((x) => x < 0) ? -1 : 0 });
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

// one trade from candle j; exitAt = candle whose OPEN ends the trade (state exit), else the close of the MAX_HOLD-th candle
export function trade(gold, j, side, exitAt, costX = 1) {
  const atr = atrBefore(gold, j);
  if (!(atr > 0)) return null;
  const risk = STOP_ATR * atr, e = gold[j].open, stop = e - side * risk, last = j + MAX_HOLD - 1;
  const through = (px) => (side > 0 ? px <= stop : px >= stop);
  let exit = null, kind = null, k = j, c = null;
  for (; k < gold.length; k++) {
    const b = gold[k];
    if (k > j && exitAt != null && k >= exitAt) { exit = b.open; kind = 'state'; c = b.time; break; }
    if (k > j && through(b.open)) { exit = b.open; kind = 'gap'; c = b.time; break; }
    if (through(side > 0 ? b.low : b.high)) { exit = stop; kind = 'stop'; break; }
    if (k === last) { exit = b.close; kind = 'time'; break; }
  }
  if (exit == null) return null;   // runs past the data: left out
  if (c == null) c = exitStamp(dayOf(gold[k].time));
  const t = gold[j].time, nn = nights(t, c);
  const gross = side * (exit - e) / risk, fin = side > 0 ? nn * FIN.xau.long * e / risk : 0, rt = RT / risk;
  return { t, c, j, k, side, e, stop, risk, exit, kind, nights: nn, gross, fin, cost: rt + fin, net: gross - costX * (rt + fin) };
}

// trades of a state series: entry when the state turns to a side in `sides` (signal day in [from, to]), one at a time
export function simulate(st, gold, { sides = [1, -1], from = -Infinity, to = Infinity, costX = 1 } = {}) {
  const out = []; let lastK = -1;
  for (let i = 1; i < st.length; i++) {
    const s = st[i].s;
    if (s == null || s === 0 || s === st[i - 1].s || !sides.includes(s)) continue;
    if (st[i].t < from || st[i].t > to) continue;
    const j = entryIndex(gold, st[i].t); if (j < 0 || j <= lastK) continue;
    let x = i + 1; while (x < st.length && st[x].s === s) x++;
    const ex = x < st.length ? entryIndex(gold, st[x].t) : -1;
    const tr = trade(gold, j, s, ex >= 0 ? ex : null, costX); if (!tr) continue;
    out.push({ ...tr, sig: st[i].t }); lastK = tr.k;
  }
  return out;
}

// ── statistics ──
const sd = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
export function stat(a) {
  const n = a.length; if (!n) return { n: 0, mean: null, t: null, sum: 0 };
  const m = a.reduce((x, y) => x + y, 0) / n, s = n > 1 ? sd(a) : 0;
  return { n, mean: m, sum: m * n, t: s > 0 ? m / (s / Math.sqrt(n)) : null };
}
const mk = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
export function monthly(rows, from, to, key) {
  const a = mk(from), b = mk(Math.max(to, ...rows.map((r) => r.c))), m = new Array(b - a + 1).fill(0);
  for (const r of rows) m[mk(r.c) - a] += r[key];
  return { ...stat(m), months: m.length };
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
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// placebo: each real trade keeps its side and length (candles to its exit) and moves to a random entry candle in the window
export function placeboTrades(gold, trades, from, to, seed) {
  const r = rng(seed), lo = entryIndex(gold, from - 1), e = entryIndex(gold, to), hi = (e < 0 ? gold.length : e) - 1;
  const used = [], out = [];
  for (const tr of trades) {
    const len = tr.kind === 'state' ? tr.k - tr.j : tr.k - tr.j + 1;
    for (let a = 0; a < REDRAW; a++) {
      const j = lo + Math.floor(r() * (hi - lo + 1));
      if (j + len >= gold.length || used.some(([p, q]) => j <= q && j + len >= p)) continue;
      const x = trade(gold, j, tr.side, tr.kind === 'state' ? j + len : null);
      if (!x) continue;
      // a time-exit length shorter than MAX_HOLD (stop / gap exits) is held by time for the same candles
      const y = tr.kind === 'state' || tr.kind === 'time' ? x : trade(gold, j, tr.side, j + len);
      if (!y) continue;
      used.push([j, y.k]); out.push(y); break;
    }
  }
  return out;
}

const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000), r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
export const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);

export function summarize(trades, from, to, x2) {
  const s = stat(trades.map((x) => x.net)), g = stat(trades.map((x) => x.gross));
  const mo = trades.length ? monthly(trades, from, to, 'net') : { t: null, months: 0 }, mg = trades.length ? monthly(trades, from, to, 'gross') : { t: null };
  const kinds = {}; for (const x of trades) kinds[x.kind] = (kinds[x.kind] || 0) + 1;
  return {
    n: s.n, longs: trades.filter((x) => x.side > 0).length, shorts: trades.filter((x) => x.side < 0).length,
    win: s.n ? r3(trades.filter((x) => x.net > 0).length / s.n) : null, exits: kinds,
    gross: r3(g.mean), net: r3(s.mean), netExact: s.mean == null ? null : +s.mean.toPrecision(4), total: r2(s.sum),
    x2: x2 ? r3(stat(x2.map((x) => x.net)).mean) : undefined,
    tMonth: r2(mo.t), tMonthGross: r2(mg.t), months: mo.months, tTrade: r2(s.t),
    meanCost: s.n ? r3(stat(trades.map((x) => x.cost)).mean) : null, meanRisk: s.n ? r2(stat(trades.map((x) => x.risk)).mean) : null,
    meanCandles: s.n ? r2(stat(trades.map((x) => x.k - x.j + 1)).mean) : null,
  };
}
const sideSplit = (tr) => Object.fromEntries([['long', 1], ['short', -1]].map(([k, s]) => {
  const a = tr.filter((x) => x.side === s).map((x) => x.net); return [k, { n: a.length, net: r3(stat(a).mean), total: r2(stat(a).sum) }];
}));

export function runTest(test, gold, days, { seeds = SEEDS, end = OOS_END } = {}) {
  const st = states(days, test.look, test.ccy);
  const win = { is: [IS_FROM, SPLIT - 1], oos: [SPLIT, Math.min(end, dayOf(gold[gold.length - 1].time) + DAY - 1)] };
  const out = { id: test.id, look: test.look, sides: test.sides, what: test.what };
  for (const [w, [from, to]] of Object.entries(win)) {
    const o = { sides: test.sides, from, to };
    const tr = simulate(st, gold, o), tr2 = simulate(st, gold, { ...o, costX: 2 });
    const byYear = {};
    for (const x of tr) { const y = new Date(x.t * 1000).getUTCFullYear(); (byYear[y] ||= []).push(x.net); }
    out[w] = { from: iso(from), to: iso(to), ...summarize(tr, from, to, tr2), split: sideSplit(tr),
      years: Object.fromEntries(Object.entries(byYear).map(([y, a]) => [y, { n: a.length, sum: r2(a.reduce((p, q) => p + q, 0)) }])) };
    if (w === 'oos') {
      out.trades = tr.map((x) => ({ sig: iso(x.sig), entry: iso(x.t), side: x.side, e: r2(x.e), risk: r2(x.risk), exit: r2(x.exit), kind: x.kind, candles: x.k - x.j + 1, gross: r3(x.gross), net: r3(x.net) }));
      if (seeds) {
        const ts = [];
        for (let s = 1; s <= seeds; s++) ts.push(summarize(placeboTrades(gold, tr, from, to, s), from, to).tMonth);
        const real = out.oos.tMonth, srt = [...ts].sort((a, b) => a - b);
        out.placebo = { seeds, draws: tr.length, t: ts, beaten: ts.filter((t) => real != null && t != null && real > t).length, median: r2(srt[Math.floor(srt.length / 2)]), p5: r2(srt[1]), p95: r2(srt[38]) };
      }
    }
  }
  return out;
}

export function verdictOf(tests) {
  for (const t of tests) {
    const ch = { oosNetPositive: t.oos.netExact > 0, oosTAndHolm: t.oos.tMonth != null && t.oos.tMonth >= 2 && t.holm < 0.05,
      isPositive: t.is.netExact > 0, x2Positive: t.oos.x2 > 0, placebo38: (t.placebo?.beaten ?? 0) >= 38, n30: t.oos.n >= 30 };
    t.checks = ch; t.pass = Object.values(ch).every(Boolean);
  }
  if (tests.find((t) => t.id === 'T1').pass) return 'PASS';
  return tests.some((t) => t.pass) ? 'PARTIAL' : 'FAIL';
}

export function study(dir) {
  const series = Object.fromEntries(KEYS.map((k) => [k, load(dir, k)])), gold = series.xau, days = commonDays(series);
  const tests = TESTS.map((t) => runTest(t, gold, days));
  const ps = tests.map((t) => normP(t.oos.tMonth)), hs = holm(ps);
  tests.forEach((t, i) => { t.p = +ps[i].toPrecision(3); t.holm = +hs[i].toPrecision(3); });
  const verdict = verdictOf(tests);
  const context = runTest(CONTEXT, gold, days, { seeds: 0 });
  delete context.trades;
  const share = {};
  for (const L of [20, 60]) {
    const st = states(days, L);
    for (const [w, a, b] of [['is', IS_FROM, SPLIT - 1], ['oos', SPLIT, OOS_END]]) {
      const s = st.filter((x) => x.t >= a && x.t <= b && x.s != null);
      share[`L${L}_${w}`] = { days: s.length, up: s.filter((x) => x.s > 0).length, down: s.filter((x) => x.s < 0).length };
    }
  }
  const span = (b) => ({ first: iso(b[0].time), last: iso(b[b.length - 1].time), days: b.length });
  return { data: { ...Object.fromEntries(KEYS.map((k) => [k, span(series[k])])), common: { first: iso(days[0].t), last: iso(days[days.length - 1].t), days: days.length } },
    share, tests, context, verdict };
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
    const out = { title: 'Gold rising or falling in every major currency at once: persistence', built: '2026-11-14', prereg: 'PREREGISTRATION.md', councilData: src,
      rule: { currencies: ALL, state: 'all six L-day returns of gold in each currency > 0 (+1) or < 0 (-1)', entry: 'next gold open after the state turns',
        exit: 'next gold open after the state leaves the side, or the close of candle 60', stop: `${STOP_ATR} x ATR(${ATR_N}) before the entry`,
        costs: `$${RT.toFixed(2)} a trade + nights() x FIN.xau.long on buys`, oneAtATime: true },
      fin: FIN.xau.long, isFrom: '2007-01-01', split: '2017-01-01', oosEnd: '2026-10-31', ...r };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    for (const t of [...r.tests, r.context]) {
      for (const w of ['is', 'oos']) { const x = t[w]; console.log(t.id, w, 'n', x.n, 'L/S', x.longs, x.shorts, 'gross', x.gross, 'net', x.net, 'x2', x.x2, 'tMo', x.tMonth, 'tMoG', x.tMonthGross, 'win', x.win, JSON.stringify(x.exits), 'cost', x.meanCost, 'risk', x.meanRisk, 'cand', x.meanCandles, 'tot', x.total, JSON.stringify(x.split)); }
      if (t.p != null) console.log(t.id, 'p', t.p, 'holm', t.holm, 'pass', t.pass, JSON.stringify(t.checks), 'placebo', JSON.stringify({ ...t.placebo, t: undefined }));
    }
    console.log('share', JSON.stringify(r.share));
    console.log('VERDICT', r.verdict);
  } else console.log('usage: run.mjs fetch <dir> | full <dir>');
};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
