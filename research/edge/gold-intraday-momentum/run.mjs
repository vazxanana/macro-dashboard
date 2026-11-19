// Gold intraday momentum on the 17:00 New York day (pre-registered: PREREGISTRATION.md, pushed before any return was computed).
// Does gold's move from the previous 17:00 New York close (T1, T3) or from 08:30 (T2) to 10:00 New York predict the move into
// 16:55? One trade a day, stop 1 x ATR(14) of 17:00-New-York daily candles, costs $0.60 a round trip (judged).
// Stand-alone research rule: never a gate, exit, entry or size of the live gold book. Nothing live reads this file.
//
//   node research/edge/gold-intraday-momentum/run.mjs <xau-5m.json.gz>     (writes result.json next to this file)
import fs from 'node:fs';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { nyOffsetH } from '../../../council/histdata.mjs';

const M5 = 300, DAY = 86400;
export const COST = 0.60, COST_DEMO = 0.16, COST_2X = 1.20;
export const ATR_N = 14, MED_N = 250, PLACEBO = 40;
export const IS = ['2007-01-01', '2016-12-31'], OOS = ['2017-01-01', '2026-10-31'];

// UTC seconds of New York wall-clock hh:mm on the date y-m-d (the offset is read at 12:00 UTC of that date, after any switch)
export function nyUtc(y, m, d, hh, mm) {
  const off = nyOffsetH(Date.UTC(y, m - 1, d, 12) / 1000);
  return Date.UTC(y, m - 1, d, hh, mm) / 1000 + off * 3600;
}
const ymd = (ms) => { const x = new Date(ms); return [x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()]; };
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// candles [[start, o, h, l, c]] -> Map start -> candle
export const indexBars = (bars) => new Map(bars.map((b) => [b[0], b]));

// price at X: close of the candle ending at X, else the last one ending in the 15 minutes before; none -> null
export function priceAt(map, X) {
  for (const e of [X, X - M5, X - 2 * M5, X - 3 * M5]) { const b = map.get(e - M5); if (b) return b[4]; }
  return null;
}

// the trading days (Mon-Fri New York dates) between two dates, each with its 17:00-to-17:00 window
export function tradingDays(from, to) {
  const out = []; let t = Date.UTC(...from.split('-').map((v, i) => (i === 1 ? +v - 1 : +v)));
  const end = Date.UTC(...to.split('-').map((v, i) => (i === 1 ? +v - 1 : +v)));
  let prev = null;
  for (; t <= end; t += DAY * 1000) {
    const wd = new Date(t).getUTCDay(); if (wd === 0 || wd === 6) continue;
    const [y, m, d] = ymd(t), close = nyUtc(y, m, d, 17, 0);
    let pclose = prev;
    if (pclose === null) { let p = t - DAY * 1000; while ([0, 6].includes(new Date(p).getUTCDay())) p -= DAY * 1000; pclose = nyUtc(...ymd(p), 17, 0); }
    out.push({ date: iso(y, m, d), y, m, d, start: pclose, end: close });
    prev = close;
  }
  return out;
}

// daily candles over each trading day's window; ATR(14) of the 14 trading days BEFORE each day (D itself not used)
export function dailyAtr(bars, days) {
  let i = 0; const daily = [];
  for (const D of days) {
    while (i < bars.length && bars[i][0] < D.start) i++;
    let o = null, h = -Infinity, l = Infinity, c = null;
    let j = i; for (; j < bars.length && bars[j][0] < D.end; j++) { const b = bars[j]; if (o === null) o = b[1]; h = Math.max(h, b[2]); l = Math.min(l, b[3]); c = b[4]; }
    i = j;
    daily.push(o === null ? null : { o, h, l, c });
  }
  const trs = []; let pc = null; const atr = new Array(days.length).fill(null);
  for (let k = 0; k < days.length; k++) {
    if (trs.length >= ATR_N) atr[k] = trs.slice(-ATR_N).reduce((a, b) => a + b, 0) / ATR_N;
    const x = daily[k]; if (!x) continue;
    trs.push(pc === null ? x.h - x.l : Math.max(x.h - x.l, Math.abs(x.h - pc), Math.abs(x.l - pc))); pc = x.c;
  }
  return { daily, atr };
}

// one trade: enter at the price of entryT, stop at `stop`, checked on the candles that start at entryT .. exitT - 5 min
// (a candle opening beyond the stop fills at its open, else one reaching it fills at the stop), else out at P(exitT)
export function trade(map, side, entryT, exitT, entry, stop) {
  for (let s = entryT; s < exitT; s += M5) {
    const b = map.get(s); if (!b) continue;
    if (side > 0) { if (b[1] <= stop) return { exit: b[1], how: 'gap', at: s }; if (b[3] <= stop) return { exit: stop, how: 'stop', at: s }; }
    else { if (b[1] >= stop) return { exit: b[1], how: 'gap', at: s }; if (b[2] >= stop) return { exit: stop, how: 'stop', at: s }; }
  }
  const px = priceAt(map, exitT);
  return px === null ? null : { exit: px, how: 'time', at: exitT };
}

// T3's filter: abs(s) above the median of abs(s) of the 250 PREVIOUS signal days; null while fewer than 250
export function aboveMedian(hist, s) {
  if (hist.length < MED_N) return null;
  const w = hist.slice(-MED_N).slice().sort((a, b) => a - b), med = (w[MED_N / 2 - 1] + w[MED_N / 2]) / 2;
  return Math.abs(s) > med;
}

export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// signals and the setups each test trades (with everything known at entry), day by day
export function setups(bars, days) {
  const map = indexBars(bars), { atr } = dailyAtr(bars, days), out = { T1: [], T2: [], T3: [] }, hist = [], skipped = { T1: 0, T2: 0 };
  for (let k = 1; k < days.length; k++) {
    const D = days[k], at = (hh, mm) => nyUtc(D.y, D.m, D.d, hh, mm);
    const pc = priceAt(map, D.start), p10 = priceAt(map, at(10, 0)), p830 = priceAt(map, at(8, 30));
    const s1 = pc !== null && p10 !== null ? p10 / pc - 1 : null, s2 = p830 !== null && p10 !== null ? p10 / p830 - 1 : null;
    const big = s1 === null ? null : aboveMedian(hist, s1);
    if (s1 !== null) hist.push(Math.abs(s1)); else skipped.T1++;
    if (s2 === null) skipped.T2++;
    const A = atr[k]; if (!A) continue;
    const mk = (s, eh, em) => {
      if (s === null || s === 0) return null;
      const entryT = at(eh, em), exitT = at(16, 55), entry = priceAt(map, entryT), exitPx = priceAt(map, exitT);
      if (entry === null || exitPx === null) return null;
      return { date: D.date, s, entryT, exitT, entry, exitPx, atr: A };
    };
    const a = mk(s1, 15, 30), b = mk(s2, 15, 0);
    if (a) out.T1.push(a); if (b) out.T2.push(b); if (a && big) out.T3.push(a);
  }
  return { out, map, skipped };
}

// run a setup with a given side -> gross R
export function runSetup(map, u, side) {
  const stop = u.entry - side * u.atr, r = trade(map, side, u.entryT, u.exitT, u.entry, stop);
  if (!r) return null;
  return { R: ((r.exit - u.entry) * side) / u.atr, how: r.how };
}

const inW = (date, w) => date >= w[0] && date <= w[1];
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1)); };
export function monthT(rows, key = 'net') {
  const by = new Map(); for (const r of rows) { const k = r.date.slice(0, 7); by.set(k, (by.get(k) || 0) + r[key]); }
  const v = [...by.values()]; return { months: v.length, t: v.length > 1 ? (mean(v) / sd(v)) * Math.sqrt(v.length) : 0 };
}
const normCdf = (x) => { const t = 1 / (1 + 0.2316419 * Math.abs(x)), d = 0.3989423 * Math.exp(-x * x / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x > 0 ? 1 - p : p; };
export const pOne = (t) => 1 - normCdf(t);
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = new Array(ps.length); let run = 0;
  o.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, p * (ps.length - k))); adj[i] = run; });
  return adj;
}
export function ols(x, y) {
  const n = x.length, mx = mean(x), my = mean(y); let sxx = 0, sxy = 0; for (let i = 0; i < n; i++) { sxx += (x[i] - mx) ** 2; sxy += (x[i] - mx) * (y[i] - my); }
  const b = sxy / sxx, a = my - b * mx; let sse = 0; for (let i = 0; i < n; i++) sse += (y[i] - a - b * x[i]) ** 2;
  const se = Math.sqrt(sse / (n - 2) / sxx), sst = y.reduce((s, v) => s + (v - my) ** 2, 0);
  return { n, slope: +b.toFixed(4), t: +(b / se).toFixed(2), r2: +((1 - sse / sst) * 100).toFixed(2) };
}

const r3 = (v) => +v.toFixed(3), r2 = (v) => +v.toFixed(2);
function stats(rows) {
  const n = rows.length, mt = monthT(rows), mg = monthT(rows, 'R');
  return {
    n, gross: r3(mean(rows.map((r) => r.R))), net: r3(mean(rows.map((r) => r.net))), netDemo: r3(mean(rows.map((r) => r.netDemo))),
    net2x: r3(mean(rows.map((r) => r.net2x))), costR: r3(mean(rows.map((r) => r.R - r.net))), win: r2(100 * rows.filter((r) => r.net > 0).length / (n || 1)),
    stops: rows.filter((r) => r.how !== 'time').length, longs: rows.filter((r) => r.side > 0).length, total: r2(rows.reduce((s, r) => s + r.net, 0)),
    months: mt.months, tMonth: r2(mt.t), tMonthGross: r2(mg.t), tMonth2x: r2(monthT(rows, 'net2x').t),
  };
}
const book = (map, list, sideOf) => list.map((u, i) => { const side = sideOf(u, i), x = runSetup(map, u, side); return x && { date: u.date, side, R: x.R, how: x.how, net: x.R - COST / u.atr, netDemo: x.R - COST_DEMO / u.atr, net2x: x.R - COST_2X / u.atr }; }).filter(Boolean);

export function study(bars) {
  const days = tradingDays('2006-11-01', OOS[1]), { out, map, skipped } = setups(bars, days), tests = {};
  for (const name of ['T1', 'T2', 'T3']) {
    const rows = book(map, out[name], (u) => Math.sign(u.s)), is = rows.filter((r) => inW(r.date, IS)), oos = rows.filter((r) => inW(r.date, OOS));
    const place = []; for (let seed = 1; seed <= PLACEBO; seed++) {
      const rnd = mulberry32(seed), pr = book(map, out[name], () => (rnd() < 0.5 ? -1 : 1));
      place.push({ is: r3(mean(pr.filter((r) => inW(r.date, IS)).map((r) => r.net))), oos: r3(mean(pr.filter((r) => inW(r.date, OOS)).map((r) => r.net))) });
    }
    const S = { is: stats(is), oos: stats(oos) }, po = place.map((p) => p.oos).sort((a, b) => a - b);
    const placebo = { oosMean: r3(mean(po)), oos95: po[Math.floor(0.95 * (po.length - 1))], oosMax: po[po.length - 1], beats: place.filter((p) => mean(oos.map((r) => r.net)) > p.oos).length, isBeats: place.filter((p) => mean(is.map((r) => r.net)) > p.is).length };
    const years = {}; for (const r of rows) { if (r.date < IS[0]) continue; const y = r.date.slice(0, 4); (years[y] ||= []).push(r); }
    const byYear = Object.fromEntries(Object.entries(years).map(([y, a]) => [y, { n: a.length, gross: r3(mean(a.map((r) => r.R))), net: r3(mean(a.map((r) => r.net))), total: r2(a.reduce((s, r) => s + r.net, 0)) }]));
    let reg = null;
    if (name !== 'T3') {
      const R = (w) => { const L = out[name].filter((u) => inW(u.date, w)); return ols(L.map((u) => u.s * 100), L.map((u) => (u.exitPx / u.entry - 1) * 100)); };
      reg = { is: R(IS), oos: R(OOS) };
    }
    tests[name] = { ...S, placebo, byYear, reg, pOne: pOne(S.oos.tMonth) };
  }
  const adj = holm(['T1', 'T2', 'T3'].map((k) => tests[k].pOne));
  ['T1', 'T2', 'T3'].forEach((k, i) => {
    const x = tests[k]; x.pOne = +x.pOne.toFixed(4); x.holm = +adj[i].toFixed(4);
    x.checks = { netBoth: x.is.net > 0 && x.oos.net > 0, tHolm: x.oos.tMonth >= 2 && x.holm < 0.05, n: x.oos.n >= 200, placebo: x.placebo.beats >= 38, cost2x: x.oos.net2x > 0 };
    x.pass = Object.values(x.checks).every(Boolean);
  });
  const pass = ['T1', 'T2', 'T3'].filter((k) => tests[k].pass);
  return {
    built: '2026-11-14', study: 'gold-intraday-momentum', system: 'stand-alone research rule on XAU/USD (not the live gold book)',
    data: { file: 'OANDA mid XAU/USD M5, local cache (out of git)', candles: bars.length, from: new Date(bars[0][0] * 1000).toISOString().slice(0, 10), to: new Date(bars[bars.length - 1][0] * 1000).toISOString().slice(0, 10), skippedSignalDays: skipped },
    costs: { judged: COST, demo: COST_DEMO, double: COST_2X, financing: 'none: every trade closes before the 17:00 New York rollover' },
    windows: { is: IS, oos: OOS }, tests, passed: pass,
    verdict: pass.length ? `PASS: ${pass.join(', ')}` : 'FAIL: 0 of 3 tests pass',
  };
}

export function loadBars(file) { return JSON.parse(zlib.gunzipSync(fs.readFileSync(file))).sort((a, b) => a[0] - b[0]); }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2]; if (!file) { console.error('usage: run.mjs <xau-5m.json.gz>'); process.exit(2); }
  const res = study(loadBars(file));
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(res, null, 2) + '\n');
  for (const k of ['T1', 'T2', 'T3']) { const x = res.tests[k]; console.log(k, JSON.stringify({ is: x.is, oos: x.oos, placebo: x.placebo, holm: x.holm, checks: x.checks, reg: x.reg })); }
  console.log(res.verdict);
}
