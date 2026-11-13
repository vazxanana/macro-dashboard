// The 10-month moving-average timing rule (Faber 2007), out of sample, on SPX500, NAS100, US30, XAU and their equal-weight book.
// Pre-registered in PREREGISTRATION.md (committed before any return was computed). Paper research only: nothing live reads this.
//   node research/edge/sma10-timing/run.mjs fetch <dir>   (git show from origin/council-data, no network)
//   node research/edge/sma10-timing/run.mjs full <dir>    (writes result.json next to this file)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FIN, nights, foldWeekend } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['spx500', 'nas100', 'us30', 'xau'];
export const NAMES = { spx500: 'SPX500', nas100: 'NAS100', us30: 'US30', xau: 'Gold (XAU)' };
export const SPREAD = { spx500: 0.5, nas100: 1.5, us30: 3.0, xau: 0.30 };         // price units, charged on every entry and exit
export const DIV = { spx500: 0.018, nas100: 0.008, us30: 0.020, xau: 0 };         // sensitivity only: dividend yield a year while long
export const MARKUP = 0.025;                                                      // index financing: DGS2 + 2.5 % a year
export const N_SMA = 10, ATR_N = 20, ATR_K = 3;
export const WINDOWS = { W1: { from: '2008-01-01', to: '2016-01-01', label: '2008-15 (check)' }, W2: { from: '2016-01-01', to: '2100-01-01', label: '2016 to now (decisive)' } };
export const DRAWS = 2000, SEED = 20261113;

const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);
const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);

export function barsOf(json) {
  return foldWeekend(json.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })));
}

// index of the last candle of each calendar month, the last month only once a later month has begun (a month in progress has no month end)
export function monthEnds(bars) {
  const out = [];
  for (let i = 0; i + 1 < bars.length; i++) if (ym(bars[i].time) !== ym(bars[i + 1].time)) out.push(i);
  return out;
}

// the signal made at month-end candle i: reads bars[0..i] only
export function signalAt(bars, ends, j) {
  const i = ends[j];
  if (j + 1 < N_SMA || i < ATR_N) return null;
  const closes = ends.slice(j + 1 - N_SMA, j + 1).map((k) => bars[k].close);
  const sma = closes.reduce((a, b) => a + b, 0) / N_SMA;
  let tr = 0;
  for (let k = i - ATR_N + 1; k <= i; k++) tr += Math.max(bars[k].high - bars[k].low, Math.abs(bars[k].high - bars[k - 1].close), Math.abs(bars[k].low - bars[k - 1].close));
  const atr = tr / ATR_N, close = bars[i].close;
  return { i, t: bars[i].time, close, sma, long: close > sma, atr, stop: close - ATR_K * atr };
}

// as-of lookup in a sorted [[YYYY-MM-DD, value]] list
export function asOfRate(list) {
  return (t) => {
    const d = day(t); let lo = 0, hi = list.length - 1, v = null;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (list[m][0] <= d) { v = list[m][1]; lo = m + 1; } else hi = m - 1; }
    return v;
  };
}

// financing a night as a share of price: gold FIN.xau.long; an index (DGS2 + markup) / 365, DGS2 floored at 0
export function nightRate(mk, dgs2) {
  if (mk === 'xau') return () => FIN.xau.long;
  return (t) => (Math.max(0, dgs2(t) ?? 0) / 100 + MARKUP) / 365;
}

// One market, one window: daily returns of the rule and of buy-and-hold on one unit of notional.
// opts: { spread, rate(t) a night, div (a year), from, to (unix s) }
export function simulate(bars, opts) {
  const { spread, rate, div = 0, from, to } = opts;
  const ends = monthEnds(bars), endSet = new Map(ends.map((i, j) => [i, j]));
  const k0 = bars.findIndex((b) => b.time >= from);
  if (k0 < 1) return null;
  let k1 = k0; while (k1 + 1 < bars.length && bars[k1 + 1].time < to) k1++;
  // the signal in force at the window's first candle: the last month end before it
  let jPrev = -1; for (let j = 0; j < ends.length; j++) if (ends[j] < k0) jPrev = j;
  const carry = (k) => { const n = nights(bars[k].time, k + 1 < bars.length ? bars[k + 1].time : bars[k].time + 86400); return n * (rate(bars[k].time) - div / 365); };
  const rule = [], bh = [], trades = [];
  let pos = false, stop = null, entry = null, open = null, stops = 0, switches = 0, held = 0;
  for (let k = k0; k <= k1; k++) {
    const b = bars[k], prev = bars[k - 1].close;
    let r = 0, entered = false;
    // month start (or the window's first candle): act on the signal of the month end before it
    const monthStart = k === k0 || endSet.has(k - 1);
    if (monthStart) {
      const j = k === k0 ? jPrev : endSet.get(k - 1), s = j >= 0 ? signalAt(bars, ends, j) : null;
      if (pos && !(s && s.long)) {                                                   // switch out at the open
        r = (b.open - spread) / prev - 1; pos = false; switches++; trades.push({ ...open, exit: b.open - spread, exitT: b.time, why: 'signal' }); open = null;
        rule.push({ t: b.time, r }); bh.push({ t: b.time, r: b.close / prev - 1 - carry(k) });   // never on the first candle: nothing is held there yet
        continue;
      }
      if (pos && s) stop = Math.max(stop, s.stop);                                   // a kept position: the stop is never loosened
      if (!pos && s && s.long) {                                                     // switch in at the open, with its stop
        entry = b.open + spread; stop = s.stop; pos = true; entered = true; switches++; open = { entry, entryT: b.time, stop0: stop };
        if (b.open <= stop) { r = (b.open - spread) / entry - 1; pos = false; stops++; trades.push({ ...open, exit: b.open - spread, exitT: b.time, why: 'stop' }); open = null; }
        else if (b.low <= stop) { r = (stop - spread) / entry - 1; pos = false; stops++; trades.push({ ...open, exit: stop - spread, exitT: b.time, why: 'stop' }); open = null; }
        else r = b.close / entry - 1;
      }
    }
    if (pos && !entered) {
      if (b.open <= stop) { r = (b.open - spread) / prev - 1; pos = false; stops++; trades.push({ ...open, exit: b.open - spread, exitT: b.time, why: 'stop' }); open = null; }
      else if (b.low <= stop) { r = (stop - spread) / prev - 1; pos = false; stops++; trades.push({ ...open, exit: stop - spread, exitT: b.time, why: 'stop' }); open = null; }
      else r = b.close / prev - 1;
    }
    if (pos) { r -= carry(k); held++; }
    rule.push({ t: b.time, r });
    bh.push({ t: b.time, r: (k === k0 ? b.close / (b.open + spread) - 1 : b.close / prev - 1) - carry(k) });
  }
  return { rule, bh, stops, switches, held, days: k1 - k0 + 1, trades, openAtEnd: pos, from: day(bars[k0].time), to: day(bars[k1].time) };
}

// equal-weight book: per date the mean of the markets' returns, a market with no candle that day counting 0
export function book(series) {
  const m = new Map();
  for (const s of series) for (const { t, r } of s) m.set(t, (m.get(t) || 0) + r / series.length);
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([t, r]) => ({ t, r }));
}

export function stats(rs) {
  const r = rs.map((x) => x.r), n = r.length;
  if (!n) return null;
  const months = new Set(rs.map((x) => ym(x.t))).size;
  let eq = 1, peak = 1, dd = 0;
  for (const v of r) { eq *= 1 + v; peak = Math.max(peak, eq); dd = Math.max(dd, 1 - eq / peak); }
  const mean = r.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(r.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  const cagr = eq ** (12 / months) - 1;
  return { days: n, months, total: eq - 1, cagr, vol: sd * Math.sqrt(252), sharpe: sd > 0 ? mean / sd * Math.sqrt(252) : 0, maxDD: dd, rod: dd > 0 ? cagr / dd : Infinity };
}

export function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// paired monthly-block bootstrap of return / drawdown: the same drawn months for both series
export function bootstrap(a, b, draws = DRAWS, seed = SEED) {
  const byM = (s) => { const m = new Map(); for (const x of s) { const k = ym(x.t); if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; };
  const A = byM(a), B = byM(b), keys = [...A.keys()].filter((k) => B.has(k)), rnd = mulberry32(seed);
  let better = 0;
  const diffs = [];
  for (let d = 0; d < draws; d++) {
    const ra = [], rb = [];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[Math.floor(rnd() * keys.length)];
      for (const x of A.get(k)) ra.push(x);
      for (const x of B.get(k)) rb.push(x);
    }
    const sa = rodOf(ra, keys.length), sb = rodOf(rb, keys.length);
    if (sa > sb) better++;
    diffs.push(sa - sb);
  }
  diffs.sort((x, y) => x - y);
  const q = (p) => diffs[Math.min(diffs.length - 1, Math.floor(p * diffs.length))];
  return { draws, seed, months: keys.length, pBetter: better / draws, diffP05: q(0.05), diffP50: q(0.5), diffP95: q(0.95) };
}
function rodOf(rs, months) {
  let eq = 1, peak = 1, dd = 0;
  for (const { r } of rs) { eq *= 1 + r; peak = Math.max(peak, eq); dd = Math.max(dd, 1 - eq / peak); }
  const cagr = eq ** (12 / months) - 1;
  return dd > 0 ? cagr / dd : (cagr > 0 ? 1e9 : 0);
}

export function passOf(w) {
  const c = (x) => ({ sharpe: x.rule.sharpe >= x.bh.sharpe, dd: x.rule.maxDD <= (2 / 3) * x.bh.maxDD });
  const w2 = c(w.W2.book), w1 = c(w.W1.book), boot = w.W2.book.boot.pBetter >= 0.9;
  const checks = { w2Sharpe: w2.sharpe, w2Drawdown: w2.dd, w2Bootstrap: boot, w1Sharpe: w1.sharpe, w1Drawdown: w1.dd };
  return { checks, pass: Object.values(checks).every(Boolean) };
}

const r4 = (x) => (Number.isFinite(x) ? +x.toFixed(4) : x);
const slim = (s) => s && Object.fromEntries(Object.entries(s).map(([k, v]) => [k, r4(v)]));

export function runAll(dir, { div = false } = {}) {
  const cache = JSON.parse(fs.readFileSync(path.join(dir, 'cache.json'), 'utf8'));
  const dgs2 = asOfRate(cache.score.fred.DGS2);
  const data = Object.fromEntries(MARKETS.map((mk) => [mk, barsOf(JSON.parse(fs.readFileSync(path.join(dir, mk + '.json'), 'utf8')))]));
  const out = {};
  for (const [w, { from, to, label }] of Object.entries(WINDOWS)) {
    const per = {}, rules = [], bhs = [];
    for (const mk of MARKETS) {
      const s = simulate(data[mk], { spread: SPREAD[mk], rate: nightRate(mk, dgs2), div: div ? DIV[mk] : 0, from: T(from), to: T(to) });
      rules.push(s.rule); bhs.push(s.bh);
      per[mk] = { name: NAMES[mk], from: s.from, to: s.to, rule: slim(stats(s.rule)), bh: slim(stats(s.bh)), inMarket: r4(s.held / s.days), switches: s.switches, stops: s.stops, positions: s.trades.length + (s.openAtEnd ? 1 : 0) };
    }
    const rb = book(rules), bb = book(bhs);
    out[w] = { label, from, to: day(rb[rb.length - 1].t), markets: per, book: { rule: slim(stats(rb)), bh: slim(stats(bb)), boot: Object.fromEntries(Object.entries(bootstrap(rb, bb)).map(([k, v]) => [k, r4(v)])) } };
  }
  return { windows: out, data: Object.fromEntries(MARKETS.map((mk) => [mk, { candles: data[mk].length, first: day(data[mk][0].time), last: day(data[mk].at(-1).time) }])) };
}

function main() {
  const [mode, dir] = process.argv.slice(2);
  if (mode === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    for (const mk of MARKETS) fs.writeFileSync(path.join(dir, mk + '.json'), execFileSync('git', ['show', `origin/council-data:research/daily/${mk}.json`], { maxBuffer: 1 << 28 }));
    fs.writeFileSync(path.join(dir, 'cache.json'), execFileSync('git', ['show', 'origin/council-data:macro/cache.json'], { maxBuffer: 1 << 28 }));
    console.log('fetched into', dir);
    return;
  }
  if (mode !== 'full' || !dir) { console.log('usage: run.mjs fetch <dir> | full <dir>'); return; }
  const prim = runAll(dir), sens = runAll(dir, { div: true }), p = passOf(prim.windows);
  const res = {
    built: '2026-11-13',
    prereg: 'research/edge/sma10-timing/PREREGISTRATION.md',
    rule: 'paper research only: a stand-alone long / flat allocation rule; not a gate, size or exit of the gold book (owner decision 44 untouched); no live change',
    source: 'Faber (2007), A Quantitative Approach to Tactical Asset Allocation, Journal of Wealth Management; its sample ends 2006, so every window here is after it',
    params: { nSma: N_SMA, atrN: ATR_N, atrK: ATR_K, spread: SPREAD, indexFinancing: 'DGS2 + 2.5 % a year / 365 a night', goldFinancing: FIN.xau.long, dividendSensitivity: DIV, draws: DRAWS, seed: SEED },
    data: prim.data,
    windows: prim.windows,
    dividendSensitivity: Object.fromEntries(Object.entries(sens.windows).map(([w, x]) => [w, { book: x.book }])),
    pass: p,
    verdict: p.pass ? 'PASS' : 'FAIL',
  };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  console.log(JSON.stringify({ verdict: res.verdict, checks: p.checks, W1: prim.windows.W1.book, W2: prim.windows.W2.book }, null, 1));
  for (const w of ['W1', 'W2']) for (const mk of MARKETS) { const m = prim.windows[w].markets[mk]; console.log(w, mk, 'rule', m.rule.cagr, m.rule.sharpe, m.rule.maxDD, '| bh', m.bh.cagr, m.bh.sharpe, m.bh.maxDD, '| in', m.inMarket, 'sw', m.switches, 'st', m.stops); }
  console.log('div', JSON.stringify(res.dividendSensitivity));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
