// Edge research · index-roll-week: index CFD longs over the quarterly futures roll window and the quarterly expiry week
// (PREREGISTRATION.md). W1: close of R-3 to close of R+1, R = the Thursday 8 days before the third Friday of Mar / Jun / Sep / Dec.
// W2: close of the expiry week's Monday to the expiry-day close. Stop 2 x ATR(20) daily with gap fill; spread 0.04 % and financing
// in R. Holm over eight tests; 40-seed placebo of a random other four-day window of the same quarter.
//   node research/edge/index-roll-week/run.mjs <candleDir>   (spx500.json, nas100.json, us30.json, de40.json from council-data
//                                                             research/daily; writes result.json beside this file)
// NYSE calendar, ATR / stop, financing and statistics follow the opex-week study (sibling branch), copied, not imported.
import fs from 'node:fs';
import path from 'node:path';
import { cmeYear } from '../../../ict/calendar.mjs';
import { foldWeekend } from '../../../council/fills.mjs';

export const MARKETS = {
  spx500: { name: 'S&P 500 (SPX500)', cal: 'nyse' }, nas100: { name: 'Nasdaq 100 (NAS100)', cal: 'nyse' },
  us30: { name: 'Dow 30 (US30)', cal: 'nyse' }, de40: { name: 'DAX 40 (DE40)', cal: 'eurex' },
};
export const SPREAD = 0.0004, FIN_ADD = 2.5;
export const ATR_N = 20, STOP_ATR = 2, SEEDS = 40, SEEDS_NEED = 38, HOLD = 4;
export const IS = ['2008-03', '2016-12'], OOS = ['2017-03', '2026-09'];
export const QMONTHS = ['03', '06', '09', '12'];
export const TESTS = {
  T1: { mk: 'spx500', w: 'W1' }, T2: { mk: 'spx500', w: 'W2' }, T3: { mk: 'nas100', w: 'W1' }, T4: { mk: 'nas100', w: 'W2' },
  T5: { mk: 'us30', w: 'W1' }, T6: { mk: 'us30', w: 'W2' }, T7: { mk: 'de40', w: 'W1' }, T8: { mk: 'de40', w: 'W2' },
};
export const PRIMARY = 'T1';
export const SPECIAL = new Set(['2007-01-02', '2012-10-29', '2012-10-30', '2018-12-05', '2025-01-09']);
const NYSE_FROM_EARLY = new Set(['Martin Luther King Day', "Presidents' Day", 'Memorial Day', 'Juneteenth', 'Independence Day', 'Labor Day', 'Thanksgiving Day']);

export const ymdOf = (sec) => new Date(sec * 1000).toISOString().slice(0, 10);
export const addDays = (ymd, k) => ymdOf(Date.parse(ymd + 'T00:00:00Z') / 1000 + k * 86400);
const wdOf = (ymd) => new Date(ymd + 'T12:00:00Z').getUTCDay();
// Easter Sunday (Gregorian, anonymous algorithm)
export function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return `${y}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`;
}
export function isTradingDay(ymd, cal = 'nyse') {
  const wd = wdOf(ymd);
  if (wd === 0 || wd === 6) return false;
  if (cal === 'eurex') {
    const md = ymd.slice(5), E = easter(+ymd.slice(0, 4));
    if (['01-01', '05-01', '12-24', '12-25', '12-26', '12-31'].includes(md)) return false;
    return ymd !== addDays(E, -2) && ymd !== addDays(E, 1);
  }
  if (SPECIAL.has(ymd)) return false;
  const Y = cmeYear(+ymd.slice(0, 4));
  if (Y.full.has(ymd)) return false;
  const e = Y.early.get(ymd);
  return !(e && NYSE_FROM_EARLY.has(e.name));
}
export const onOrBefore = (ymd, cal = 'nyse') => { let d = ymd; while (!isTradingDay(d, cal)) d = addDays(d, -1); return d; };
// the k-th trading day after (k > 0) or before (k < 0) ymd
export function shiftTD(ymd, k, cal = 'nyse') {
  let d = ymd; const s = Math.sign(k);
  for (let n = Math.abs(k); n > 0;) { d = addDays(d, s); if (isTradingDay(d, cal)) n--; }
  return d;
}
export const addMonths = (ym, k) => { const [y, m] = ym.split('-').map(Number); const n = y * 12 + (m - 1) + k; return `${Math.floor(n / 12)}-${String(n % 12 + 1).padStart(2, '0')}`; };
export function thirdFriday(ym) { const first = ym + '-01', wd = wdOf(first); return addDays(first, ((5 - wd + 7) % 7) + 14); }
// every date of the rule for expiry month ym on calendar cal
export function datesOf(ym, cal = 'nyse') {
  const F = thirdFriday(ym), X = onOrBefore(F, cal), R = onOrBefore(addDays(F, -8), cal);
  return { F, X, R, w1: [shiftTD(R, -3, cal), shiftTD(R, 1, cal)], w2: [onOrBefore(addDays(F, -4), cal), X] };
}
// the trading days of the quarter ending with expiry month ym (the expiry month and the two before)
export function quarterDays(ym, cal = 'nyse') {
  const out = [];
  for (let d = addMonths(ym, -2) + '-01'; d.slice(0, 7) <= ym; d = addDays(d, 1)) if (isTradingDay(d, cal)) out.push(d);
  return out;
}

export function fold(rows) {
  return foldWeekend(rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] })))
    .map((b) => ({ d: ymdOf(b.time), o: b.open, h: b.high, l: b.low, c: b.close }));
}
export function atrAt(B, k, n = ATR_N) {
  if (k - n < 0) return null;
  let s = 0;
  for (let j = k - n + 1; j <= k; j++) { const a = B[j], p = B[j - 1]; s += Math.max(a.h - a.l, Math.abs(a.h - p.c), Math.abs(a.l - p.c)); }
  return s / n;
}
export function rateOf(dgs2) { return (ymd) => { let v = null; for (const [d, x] of dgs2) { if (d > ymd) break; v = x; } return v; }; }
export const nights = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400e3);

// one long trade: entry at the close of sD, exit at the close of xD unless stopped; cost multiplier cm (1 or 2)
export function trade(B, idx, sD, xD, { rate, cm = 1 }) {
  const e = idx.get(sD), x = idx.get(xD);
  if (e == null || x == null || x <= e) return null;
  const atr = atrAt(B, e);
  if (atr == null || !(atr > 0)) return null;
  const entry = B[e].c, risk = STOP_ATR * atr, stop = entry - risk;
  let exit = B[x].c, exitD = xD, how = 'time';
  for (let j = e + 1; j <= x; j++) {
    const b = B[j];
    if (b.o <= stop) { exit = b.o; how = 'stop-gap'; exitD = b.d; break; }
    if (b.l <= stop) { exit = stop; how = 'stop'; exitD = b.d; break; }
  }
  const r = rate(sD) ?? 0, n = nights(sD, exitD);
  const gross = (exit - entry) / risk, costR = cm * SPREAD * entry / risk, finR = cm * ((r + FIN_ADD) / 100 / 365) * n * entry / risk;
  return { sD, exitD, entry, stop, risk, exit, how, nights: n, gross, costR, finR, net: gross - costR - finR };
}

export function stats(xs) {
  const n = xs.length; if (!n) return { n: 0, mean: null, sd: null, t: null };
  const mean = xs.reduce((a, b) => a + b, 0) / n, sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  return { n, mean, sd, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : null };
}
// t on calendar-month sums (months that hold a trade)
export function monthT(ts, key = 'net') {
  const m = new Map();
  for (const t of ts) { const k = t.sD.slice(0, 7); m.set(k, (m.get(k) || 0) + t[key]); }
  return stats([...m.values()]);
}
const erf = (x) => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
export const pOneSided = (t) => t == null ? 1 : 0.5 * (1 - erf(t / Math.SQRT2));
export function holm(ps) {
  const order = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = new Array(ps.length);
  let run = 0;
  order.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, p * (ps.length - k))); adj[i] = run; });
  return adj;
}
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const r3 = (x) => x == null ? null : +x.toFixed(3), r2 = (x) => x == null ? null : +x.toFixed(2);
const inWin = (ym, w) => ym >= w[0] && ym <= w[1];
export function summ(ts, ts2) {
  const s = monthT(ts), g = monthT(ts, 'gross'), s2 = ts2 ? monthT(ts2) : null;
  return { n: ts.length, months: s.n, net: r3(s.mean), t: r2(s.t), gross: r3(g.mean), tGross: r2(g.t), net2x: s2 ? r3(s2.mean) : undefined, t2x: s2 ? r2(s2.t) : undefined,
    win: ts.length ? r2(100 * ts.filter((t) => t.net > 0).length / ts.length) : null, stops: ts.filter((t) => t.how !== 'time').length,
    total: r2(ts.reduce((a, t) => a + t.net, 0)), cost: r3(ts.length ? ts.reduce((a, t) => a + t.costR, 0) / ts.length : null), fin: r3(ts.length ? ts.reduce((a, t) => a + t.finR, 0) / ts.length : null) };
}

// other four-day windows of the quarter: [start, exit] pairs, exit inside the quarter, start != the rule's
export function otherWindows(days, ruleStart) {
  const out = [];
  for (let i = 0; i + HOLD < days.length; i++) if (days[i] !== ruleStart) out.push([days[i], days[i + HOLD]]);
  return out;
}

export function runTest(B, idx, test, cal, rate) {
  const trades = [], trades2 = [], counts = { noCandle: 0 }, excess = [];
  for (let ym = IS[0]; ym <= OOS[1]; ym = addMonths(ym, 1)) {
    if (!QMONTHS.includes(ym.slice(5))) continue;
    const D = datesOf(ym, cal), [sD, xD] = test.w === 'W1' ? D.w1 : D.w2;
    const t = trade(B, idx, sD, xD, { rate }), t2 = trade(B, idx, sD, xD, { rate, cm: 2 });
    if (!t) { counts.noCandle++; continue; }
    const tr = { ym, ...t, R: D.R, X: D.X, F: D.F };
    trades.push(tr); trades2.push({ ym, ...t2 });
    const others = otherWindows(quarterDays(ym, cal), sD).map(([a, b]) => trade(B, idx, a, b, { rate })).filter(Boolean);
    const om = stats(others.map((o) => o.net)).mean;
    if (om != null) excess.push({ ym, sD, net: t.net - om, others: others.length });
  }
  const sel = (w) => (x) => inWin(x.ym, w);
  const oos = trades.filter(sel(OOS)), is = trades.filter(sel(IS));
  const d = summ(oos, trades2.filter(sel(OOS))), i = summ(is, trades2.filter(sel(IS)));
  // placebo: per seed and OOS quarter, one random other four-day window of the quarter
  const seeds = [];
  for (let s = 1; s <= SEEDS; s++) {
    const R = rng(s), nets = [];
    for (const t of oos) {
      const W = otherWindows(quarterDays(t.ym, cal), t.sD);
      for (let k = 0; k < 50 && W.length; k++) { const [a, b] = W[Math.floor(R() * W.length)], p = trade(B, idx, a, b, { rate }); if (p) { nets.push(p.net); break; } }
    }
    seeds.push(stats(nets).mean);
  }
  const sorted = [...seeds].sort((a, b) => a - b), ruleMean = stats(oos.map((t) => t.net)).mean;
  const ex = (w) => { const s = stats(excess.filter(sel(w)).map((e) => e.net)); return { n: s.n, mean: r3(s.mean), t: r2(s.t) }; };
  const years = [...new Set(oos.map((t) => t.ym.slice(0, 4)))];
  return {
    mk: test.mk, w: test.w, counts, oos: d, is: i, pOne: pOneSided(d.t),
    placebo: { ruleMean: r3(ruleMean), beaten: seeds.filter((m) => ruleMean > m).length, need: SEEDS_NEED, median: r3((sorted[19] + sorted[20]) / 2), p95: r3(sorted[37] + 0.05 * (sorted[38] - sorted[37])), seeds: seeds.map(r3) },
    vsQuarter: { is: ex(IS), oos: ex(OOS) },
    byYear: Object.fromEntries(years.map((y) => [y, r3(oos.filter((t) => t.ym.startsWith(y)).reduce((a, t) => a + t.net, 0))])),
    trades: trades.map((t) => [t.ym, t.sD, t.exitD, t.how, r3(t.gross), r3(t.net)]),
  };
}

export function verdictOf(T) {
  const keys = Object.keys(TESTS), adj = holm(keys.map((k) => T[k].pOne)), checks = {};
  keys.forEach((k, j) => {
    const x = T[k];
    const c = { oosPos: x.oos.net > 0, t2: x.oos.t != null && x.oos.t >= 2, holmP: +adj[j].toFixed(4), isPos: x.is.net > 0, cost2x: x.oos.net2x > 0, placebo: x.placebo.beaten >= SEEDS_NEED };
    c.holm = c.holmP < 0.05;
    c.pass = c.oosPos && c.t2 && c.holm && c.isPos && c.cost2x && c.placebo;
    checks[k] = c;
  });
  return { verdict: checks[PRIMARY].pass ? 'PASS' : 'FAIL', passed: keys.filter((k) => checks[k].pass), checks };
}

export function runAll(rowsBy, dgs2) {
  const T = {}, info = {}, rate = rateOf(dgs2);
  for (const mk of Object.keys(MARKETS)) {
    const B = fold(rowsBy[mk]), idx = new Map(B.map((b, i) => [b.d, i]));
    info[mk] = { candles: B.length, from: B[0].d, to: B.at(-1).d };
    for (const [k, test] of Object.entries(TESTS)) if (test.mk === mk) T[k] = runTest(B, idx, test, MARKETS[mk].cal, rate);
  }
  return { T, info, v: verdictOf(T) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candleDir>');
  const here = path.dirname(new URL(import.meta.url).pathname);
  const rates = JSON.parse(fs.readFileSync(path.join(here, 'rates.json'), 'utf8'));
  const rowsBy = {};
  for (const mk of Object.keys(MARKETS)) rowsBy[mk] = JSON.parse(fs.readFileSync(path.join(dir, `${mk}.json`), 'utf8')).rows;
  const { T, info, v } = runAll(rowsBy, rates.DGS2);
  for (const k of Object.keys(T)) console.log(k, T[k].mk, T[k].w, 'oos', JSON.stringify(T[k].oos), 'is', JSON.stringify(T[k].is), 'placebo', T[k].placebo.beaten, T[k].placebo.median, 'vsQ', JSON.stringify(T[k].vsQuarter), JSON.stringify(T[k].counts));
  const out = { built: '2026-11-14', study: 'index-roll-week', title: 'Index CFD longs over the quarterly futures roll window and expiry week', verdict: v.verdict, primary: PRIMARY, passed: v.passed, checks: v.checks,
    data: { src: 'OANDA mid daily candles, council-data research/daily (6279e8bd5), weekend stubs folded (council/fills.mjs foldWeekend); close = 00:00 UTC; 2-year yield FRED DGS2 weekly (rates.json)',
      markets: info, spread: `${SPREAD * 100}% of entry a round trip`, financing: `long pays DGS2 + ${FIN_ADD}% a year per calendar night (de40 too)`,
      stop: `${STOP_ATR} x ATR(${ATR_N}) daily, gap fill`, windows: { inSample: IS, outOfSample: OOS } },
    tests: T };
  fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(v.verdict, JSON.stringify(v.checks));
}
