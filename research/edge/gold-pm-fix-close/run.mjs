// Gold's close against the 15:00 London (PM auction) price as a next-day signal (pre-registered: PREREGISTRATION.md, pushed
// alone before any result). Signal s = close at 17:00 New York / price at 15:00 London - 1; trade the NEXT 17:00-New-York day
// from its first candle to its 17:00 close, stop 1 x ATR(14) of daily candles, $0.60 a round trip plus gold-long financing.
// Stand-alone research rule on XAU/USD: never a gate, exit, entry or size of the live gold book. Nothing live reads this file.
//
//   node --use-env-proxy research/edge/gold-pm-fix-close/run.mjs fetch <xau-5m.json.gz>   (OANDA mid M5 via /md/bars; out of git)
//   node research/edge/gold-pm-fix-close/run.mjs <xau-5m.json.gz>                         (writes result.json next to this file)
import fs from 'node:fs';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { nyOffsetH, euSummer } from '../../../council/histdata.mjs';
import { nights, FIN } from '../../../council/fills.mjs';

const M5 = 300, DAY = 86400;
export const COST = 0.60, COST_DEMO = 0.16, COST_2X = 1.20;
export const ATR_N = 14, MED_N = 250, PLACEBO = 40, STOP_ATR = 1.0;
export const IS = ['2007-01-01', '2016-12-31'], OOS = ['2017-01-01', '2026-10-31'];
export const TESTS = ['T1', 'T2', 'T3'];

// UTC seconds of a wall-clock time on date y-m-d (offsets read at 12:00 UTC of that date, after any switch)
export function nyUtc(y, m, d, hh, mm) { return Date.UTC(y, m - 1, d, hh, mm) / 1000 + nyOffsetH(Date.UTC(y, m - 1, d, 12) / 1000) * 3600; }
export function londonUtc(y, m, d, hh, mm) { return Date.UTC(y, m - 1, d, hh, mm) / 1000 - (euSummer(Date.UTC(y, m - 1, d, 12) / 1000) ? 3600 : 0); }
const ymd = (ms) => { const x = new Date(ms); return [x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()]; };
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// trading days (Mon-Fri New York dates), each with its 17:00-to-17:00 New York window
export function tradingDays(from, to) {
  const out = [], P = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  let prev = null;
  for (let t = P(from); t <= P(to); t += DAY * 1000) {
    const wd = new Date(t).getUTCDay(); if (wd === 0 || wd === 6) continue;
    const [y, m, d] = ymd(t), end = nyUtc(y, m, d, 17, 0);
    let start = prev;
    if (start === null) { let p = t - DAY * 1000; while ([0, 6].includes(new Date(p).getUTCDay())) p -= DAY * 1000; start = nyUtc(...ymd(p), 17, 0); }
    out.push({ date: iso(y, m, d), y, m, d, start, end });
    prev = end;
  }
  return out;
}

export const indexBars = (bars) => new Map(bars.map((b) => [b[0], b]));
// price at X: close of the candle ending at X, else of the last one ending in the 15 minutes before X; none -> null
export function priceAt(map, X) {
  for (const e of [X, X - M5, X - 2 * M5, X - 3 * M5]) { const b = map.get(e - M5); if (b) return b[4]; }
  return null;
}
// first index i with bars[i][0] >= t
export function lowerBound(bars, t) { let lo = 0, hi = bars.length; while (lo < hi) { const m = (lo + hi) >> 1; if (bars[m][0] < t) lo = m + 1; else hi = m; } return lo; }

// daily candles over each day's window, and ATR(14) of the 14 days up to and INCLUDING day k (atrIncl[k])
export function dailyAtr(bars, days) {
  const daily = []; let i = 0;
  for (const D of days) {
    while (i < bars.length && bars[i][0] < D.start) i++;
    let o = null, h = -Infinity, l = Infinity, c = null, j = i;
    for (; j < bars.length && bars[j][0] < D.end; j++) { const b = bars[j]; if (o === null) o = b[1]; h = Math.max(h, b[2]); l = Math.min(l, b[3]); c = b[4]; }
    i = j; daily.push(o === null ? null : { o, h, l, c });
  }
  const trs = [], atrIncl = new Array(days.length).fill(null); let pc = null;
  for (let k = 0; k < days.length; k++) {
    const x = daily[k];
    if (x) { trs.push(pc === null ? x.h - x.l : Math.max(x.h - x.l, Math.abs(x.h - pc), Math.abs(x.l - pc))); pc = x.c; }
    if (x && trs.length >= ATR_N) atrIncl[k] = trs.slice(-ATR_N).reduce((a, b) => a + b, 0) / ATR_N;
  }
  return { daily, atrIncl };
}

// the large-signal filter: |s| above the median |s| of the 250 PREVIOUS signal days; null while fewer than 250
export function aboveMedian(hist, s) {
  if (hist.length < MED_N) return null;
  const w = hist.slice(-MED_N).sort((a, b) => a - b), med = (w[MED_N / 2 - 1] + w[MED_N / 2]) / 2;
  return Math.abs(s) > med;
}

// signals and next-day setups (everything in a setup is known at its entry)
export function setups(bars, days) {
  const map = indexBars(bars), { atrIncl } = dailyAtr(bars, days), out = { T1: [], T2: [] }, hist = [], skipped = { signal: 0, trade: 0 };
  for (let k = 1; k + 1 < days.length; k++) {
    const D = days[k], N = days[k + 1];
    const fix = priceAt(map, londonUtc(D.y, D.m, D.d, 15, 0)), close = priceAt(map, D.end);
    if (fix === null || close === null) { skipped.signal++; continue; }
    const s = close / fix - 1, big = aboveMedian(hist, s);
    hist.push(Math.abs(s));
    const A = atrIncl[k]; if (!A || s === 0) continue;
    const i0 = lowerBound(bars, N.start), exitPx = priceAt(map, N.end);
    if (i0 >= bars.length || bars[i0][0] >= N.end || exitPx === null) { skipped.trade++; continue; }
    let i1 = lowerBound(bars, N.end);
    const u = { date: D.date, next: N.date, s, fix, close, i0, i1, entryT: bars[i0][0], exitT: N.end, entry: bars[i0][1], exitPx, atr: A };
    out.T1.push(u); if (big) out.T2.push(u);
  }
  return { out, skipped };
}

// one trade over bars[i0 .. i1-1]: a candle opening beyond the stop fills at its open, one reaching it fills at the stop
export function runSetup(bars, u, side) {
  const stop = u.entry - side * STOP_ATR * u.atr;
  let exit = u.exitPx, how = 'time', at = u.exitT;
  for (let i = u.i0; i < u.i1; i++) {
    const b = bars[i];
    if (side > 0) { if (b[1] <= stop) { exit = b[1]; how = 'gap'; at = b[0]; break; } if (b[3] <= stop) { exit = stop; how = 'stop'; at = b[0]; break; } }
    else { if (b[1] >= stop) { exit = b[1]; how = 'gap'; at = b[0]; break; } if (b[2] >= stop) { exit = stop; how = 'stop'; at = b[0]; break; } }
  }
  const R = ((exit - u.entry) * side) / u.atr;
  const finR = side > 0 ? (nights(u.entryT, at) * FIN.xau.long * u.entry) / u.atr : 0;
  return { R, how, finR };
}

export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const inW = (date, w) => date >= w[0] && date <= w[1];
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1)); };
export function monthT(rows, key = 'net') {
  const by = new Map(); for (const r of rows) { const k = r.date.slice(0, 7); by.set(k, (by.get(k) || 0) + r[key]); }
  const v = [...by.values()]; return { months: v.length, t: v.length > 1 && sd(v) > 0 ? (mean(v) / sd(v)) * Math.sqrt(v.length) : 0 };
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
  return { n, slope: +b.toFixed(4), t: +(b / Math.sqrt(sse / (n - 2) / sxx)).toFixed(2) };
}

const r3 = (v) => +v.toFixed(3), r2 = (v) => +v.toFixed(2);
const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
function stats(rows) {
  const n = rows.length, mt = monthT(rows);
  return {
    n, gross: r3(mean(rows.map((r) => r.R))), net: r3(mean(rows.map((r) => r.net))), netDemo: r3(mean(rows.map((r) => r.netDemo))),
    net2x: r3(mean(rows.map((r) => r.net2x))), costR: r3(mean(rows.map((r) => r.R - r.net))), finR: r3(mean(rows.map((r) => r.finR))),
    win: r2(100 * rows.filter((r) => r.net > 0).length / (n || 1)), stopped: r2(100 * rows.filter((r) => r.how !== 'time').length / (n || 1)),
    longs: rows.filter((r) => r.side > 0).length, total: r2(rows.reduce((s, r) => s + r.net, 0)), medStop: r2(median(rows.map((r) => r.atr * STOP_ATR)) || 0),
    months: mt.months, tMonth: r2(mt.t), tMonthGross: r2(monthT(rows, 'R').t), tMonth2x: r2(monthT(rows, 'net2x').t),
  };
}
export const book = (bars, list, sideOf) => list.map((u, i) => {
  const side = sideOf(u, i), x = runSetup(bars, u, side);
  return { date: u.date, side, R: x.R, how: x.how, finR: x.finR, atr: u.atr, net: x.R - COST / u.atr - x.finR, netDemo: x.R - COST_DEMO / u.atr - x.finR, net2x: x.R - COST_2X / u.atr - 2 * x.finR };
});

export function study(bars) {
  const days = tradingDays('2006-11-01', '2026-11-13'), { out, skipped } = setups(bars, days), tests = {};
  const plan = { T1: [out.T1, (u) => Math.sign(u.s)], T2: [out.T2, (u) => Math.sign(u.s)], T3: [out.T2, (u) => -Math.sign(u.s)] };
  for (const name of TESTS) {
    const [list, sideOf] = plan[name], rows = book(bars, list, sideOf), is = rows.filter((r) => inW(r.date, IS)), oos = rows.filter((r) => inW(r.date, OOS));
    const place = [];
    for (let seed = 1; seed <= PLACEBO; seed++) {
      const rnd = mulberry32(seed), pr = book(bars, list, () => (rnd() < 0.5 ? -1 : 1));
      place.push({ is: mean(pr.filter((r) => inW(r.date, IS)).map((r) => r.net)), oos: mean(pr.filter((r) => inW(r.date, OOS)).map((r) => r.net)) });
    }
    const S = { is: stats(is), oos: stats(oos) }, po = place.map((p) => p.oos).sort((a, b) => a - b), mo = mean(oos.map((r) => r.net)), mi = mean(is.map((r) => r.net));
    const placebo = { oosMean: r3(mean(po)), oos95: r3(po[Math.floor(0.95 * (po.length - 1))]), oosMax: r3(po[po.length - 1]), beats: place.filter((p) => mo > p.oos).length, isBeats: place.filter((p) => mi > p.is).length };
    const years = {}; for (const r of rows) { if (r.date < IS[0] || r.date > OOS[1]) continue; (years[r.date.slice(0, 4)] ||= []).push(r); }
    const byYear = Object.fromEntries(Object.entries(years).map(([y, a]) => [y, { n: a.length, gross: r3(mean(a.map((r) => r.R))), net: r3(mean(a.map((r) => r.net))), total: r2(a.reduce((s, r) => s + r.net, 0)) }]));
    tests[name] = { ...S, placebo, byYear, pOne: pOne(S.oos.tMonth) };
  }
  // reported only: next day's return (entry -> 17:00 close, %) on the signal (%)
  const reg = Object.fromEntries([['is', IS], ['oos', OOS]].map(([k, w]) => { const L = out.T1.filter((u) => inW(u.date, w)); return [k, ols(L.map((u) => u.s * 100), L.map((u) => (u.exitPx / u.entry - 1) * 100))]; }));
  const adj = holm(TESTS.map((k) => tests[k].pOne));
  TESTS.forEach((k, i) => {
    const x = tests[k]; x.pOne = +x.pOne.toFixed(4); x.holm = +adj[i].toFixed(4);
    x.checks = { netBoth: x.is.net > 0 && x.oos.net > 0, tHolm: x.oos.tMonth >= 2 && x.holm < 0.05, n: x.oos.n >= 200, placebo: x.placebo.beats >= 38, cost2x: x.oos.net2x > 0 };
    x.pass = Object.values(x.checks).every(Boolean);
  });
  const pass = TESTS.filter((k) => tests[k].pass);
  return {
    built: '2026-11-14', study: 'gold-pm-fix-close', system: 'stand-alone research rule on XAU/USD (not the live gold book)',
    data: { file: 'OANDA mid XAU/USD M5, local cache (out of git)', candles: bars.length, from: new Date(bars[0][0] * 1000).toISOString().slice(0, 10), to: new Date(bars[bars.length - 1][0] * 1000).toISOString().slice(0, 10), skipped },
    rule: 'signal s = P(17:00 New York) / P(15:00 London) - 1 on day D; trade day D+1 from its first M5 open to its 17:00 New York close, stop 1 x ATR(14) daily (known at entry)',
    costs: { judged: COST, demo: COST_DEMO, double: COST_2X, financing: `buys: nights x FIN.xau.long (${FIN.xau.long}) x entry / ATR` },
    windows: { is: IS, oos: OOS }, tests, regression: reg, passed: pass,
    verdict: pass.includes('T1') ? 'PASS: T1' : pass.length ? `FAIL on the primary; ${pass.join(', ')} pass (a lead only)` : 'FAIL: 0 of 3 tests pass',
  };
}

export function loadBars(file) { return JSON.parse(zlib.gunzipSync(fs.readFileSync(file))).sort((a, b) => a[0] - b[0]); }

async function fetchAll(file) {
  const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const FROM = Date.UTC(2006, 10, 1) / 1000, END = Date.UTC(2026, 10, 14) / 1000, m = new Map();
  for (let a = FROM; a < END;) {
    const b = Math.min(END, a + 4999 * M5); let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) {
      try { const r = await fetch(`${BASE}bars?sym=xau&tf=5m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null; if (x && Array.isArray(x.bars)) j = x; else err = `HTTP ${r.status}`; }
      catch (e) { err = String(e.message || e); }
      if (!j) await sleep(2000 * (k + 1));
    }
    if (!j) throw new Error(`xau 5m ${new Date(a * 1000).toISOString()}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(150);
  }
  fs.writeFileSync(file, zlib.gzipSync(JSON.stringify([...m.values()].sort((p, q) => p[0] - q[0]))));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [a, b] = process.argv.slice(2);
  if (a === 'fetch') { if (!b) throw new Error('usage: run.mjs fetch <file>'); await fetchAll(b); process.exit(0); }
  if (!a) { console.error('usage: run.mjs <xau-5m.json.gz>'); process.exit(2); }
  const res = study(loadBars(a));
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(res, null, 2) + '\n');
  for (const k of TESTS) { const x = res.tests[k]; console.log(k, JSON.stringify({ is: x.is, oos: x.oos, placebo: x.placebo, holm: x.holm, checks: x.checks })); }
  console.log('reg', JSON.stringify(res.regression), JSON.stringify(res.data.skipped));
  console.log(res.verdict);
}
