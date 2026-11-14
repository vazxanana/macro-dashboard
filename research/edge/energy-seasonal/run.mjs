// Energy seasonal windows (pre-registered in PREREGISTRATION.md, pushed before this file): crude long mid-Feb -> end of
// April (WTI, Brent), natural gas long Sep-Oct, natural gas short Feb-Mar; one trade a year, a fixed 3 x ATR(20) stop,
// net of a spread round trip and nightly financing. Decisive 2016-2026, replication 2008-2015, Holm over four tests,
// a 40-seed random-window placebo. Paper research only: nothing live reads this.
// Run: node research/edge/energy-seasonal/run.mjs   (reads origin/council-data with git show; no network)
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights } from '../../../council/fills.mjs';

export const P = { ATR_N: 20, STOP_K: 3, VOL_FRAC: 0.25, VOL_N: 20, EXIT_H: 21, CARRY: 2.5, SEEDS: 40, MIN_POS: 7 };
export const SPREAD = { wtico: 0.03, bco: 0.03, natgas: 0.005 };
export const DECISIVE = [2016, 2026], REPLICATION = [2008, 2015];
export const TESTS = [
  { id: 'T1', name: 'Crude driving season (WTI)', key: 'wtico', side: 1, from: [2, 15], to: [4, 30], L: 74 },
  { id: 'T2', name: 'Crude driving season (Brent)', key: 'bco', side: 1, from: [2, 15], to: [4, 30], L: 74 },
  { id: 'T3', name: 'Natural gas winter build', key: 'natgas', side: 1, from: [9, 1], to: [10, 31], L: 60 },
  { id: 'T4', name: 'Natural gas spring weakness (short)', key: 'natgas', side: -1, from: [2, 1], to: [3, 31], L: 58 },
];

const DAY = 86400;
export const dayKey = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const utc = (y, m, d) => Date.UTC(y, m - 1, d) / 1000;
const median = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };

// rows [t,o,h,l,c,v] -> folded weekday bars
export const toBars = (rows) => foldWeekend(rows.map(([time, open, high, low, close, volume]) => ({ time, open, high, low, close, volume })));

// trading day: a weekday candle (all folded bars are) with volume >= 25 % of the median of the 20 candles before it
export function tradingDays(bars) {
  return bars.map((b, i) => {
    if (i < P.VOL_N) return true;
    const m = median(bars.slice(i - P.VOL_N, i).map((x) => +x.volume || 0));
    return m <= 0 || (+b.volume || 0) >= P.VOL_FRAC * m;
  });
}
// first trading day with time >= t0 / last trading day with time <= t1 (indices), -1 when none
export function firstOnOrAfter(bars, td, t0) { for (let i = 0; i < bars.length; i++) if (td[i] && bars[i].time >= t0) return i; return -1; }
export function lastOnOrBefore(bars, td, t1) { for (let i = bars.length - 1; i >= 0; i--) if (td[i] && bars[i].time <= t1) return i; return -1; }

// ATR(20): simple mean of true range over the 20 trading days before entry index i0 (previous close = previous trading day)
export function atrBefore(bars, td, i0, n = P.ATR_N) {
  const idx = []; for (let i = i0 - 1; i >= 0 && idx.length < n + 1; i--) if (td[i]) idx.unshift(i);
  if (idx.length < n + 1) return null;
  let s = 0;
  for (let k = 1; k <= n; k++) { const b = bars[idx[k]], pc = bars[idx[k - 1]].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}

// one trade: entry at the open of i0, fixed stop, every candle i0..i1 checked in order (gap at the open, then the range)
export function simTrade(bars, i0, i1, side, atr) {
  const entry = bars[i0].open, risk = P.STOP_K * atr, stop = entry - side * risk;
  for (let i = i0; i <= i1; i++) {
    const b = bars[i];
    if (i > i0 && (side > 0 ? b.open <= stop : b.open >= stop)) return { entry, stop, risk, exit: b.open, how: 'gap', iExit: i };
    if (side > 0 ? b.low <= stop : b.high >= stop) return { entry, stop, risk, exit: stop, how: 'stop', iExit: i };
  }
  return { entry, stop, risk, exit: bars[i1].close, how: 'close', iExit: i1 };
}

// DGS2 (weekly [date, value]) on or before a time; annual financing rate (fraction) for a side
export function dgs2At(series, t) { const k = dayKey(t); let v = null; for (const [d, x] of series) { if (d <= k) v = x; else break; } return v; }
export const finRate = (side, dgs2) => side > 0 ? (dgs2 + P.CARRY) / 100 : Math.max(0, P.CARRY - dgs2) / 100;

// costs and R of one trade
export function costTrade(tr, bars, i0, side, key, dgs2) {
  const gross = side * (tr.exit - tr.entry) / tr.risk, spreadR = SPREAD[key] / tr.risk;
  const t0 = bars[i0].time, t1 = bars[tr.iExit].time + P.EXIT_H * 3600, nn = nights(t0, t1), rate = finRate(side, dgs2);
  const finR = nn * rate / 365 * tr.entry / tr.risk;
  return { gross, spreadR, finR, nights: nn, rate, preFin: gross - spreadR, net: gross - spreadR - finR };
}

// the trade of one window [t0 nominal start, t1 nominal end], or { skip }
export function windowTrade(M, test, t0, t1) {
  const { bars, td, dgs2 } = M;
  if (!bars.length || bars[bars.length - 1].time <= t1) return { skip: 'window not complete in the file' };
  const i0 = firstOnOrAfter(bars, td, t0), i1 = lastOnOrBefore(bars, td, t1);
  if (i0 < 0 || i1 < i0) return { skip: 'no trading day in the window' };
  const atr = atrBefore(bars, td, i0);
  if (!atr) return { skip: 'fewer than 21 trading days before entry' };
  const tr = simTrade(bars, i0, i1, test.side, atr), d2 = dgs2At(dgs2, bars[i0].time);
  if (d2 == null) return { skip: 'no 2Y yield on file' };
  const c = costTrade(tr, bars, i0, test.side, test.key, d2);
  return { entryDay: dayKey(bars[i0].time), exitDay: dayKey(bars[tr.iExit].time), plannedExit: dayKey(bars[i1].time),
    entry: tr.entry, stop: +tr.stop.toFixed(5), atr: +atr.toFixed(5), exit: tr.exit, how: tr.how, dgs2: d2, ...c };
}
export const yearWindow = (test, y) => [utc(y, ...test.from), utc(y, ...test.to)];

// statistics
export function tStat(xs) {
  const n = xs.length; if (n < 2) return { n, mean: n ? xs[0] : 0, sd: 0, t: 0 };
  const mean = xs.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  return { n, mean, sd, t: sd > 0 ? mean / sd * Math.sqrt(n) : 0 };
}
function lgamma(x) { const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5; tmp -= (x + 0.5) * Math.log(tmp); let s = 1.000000000190015; for (const k of c) s += k / ++y; return -tmp + Math.log(2.5066282746310005 * s / x); }
function betacf(a, b, x) { let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d; let h = d;
  for (let m = 1; m <= 200; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-12) break; }
  return h; }
export function ibeta(a, b, x) { if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
// one-sided p = P(T >= t), Student's t with df degrees of freedom
export function pOneSided(t, df) { if (!(df > 0)) return 1; const tail = 0.5 * ibeta(df / 2, 0.5, df / (df + t * t)); return t >= 0 ? tail : 1 - tail; }
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let run = 0;
  o.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, p * (ps.length - k))); out[i] = run; });
  return out;
}
export function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const pct95of40 = (vals) => [...vals].sort((a, b) => a - b)[37];

const r3 = (x) => +x.toFixed(3), r4 = (x) => +x.toFixed(4);
function summarize(trades) {
  const net = trades.map((x) => x.net), s = tStat(net);
  return { n: s.n, avg: r3(s.mean), sd: r3(s.sd), t: +s.t.toFixed(2), df: s.n - 1, pos: net.filter((x) => x > 0).length,
    gross: r3(tStat(trades.map((x) => x.gross)).mean), preFin: r3(tStat(trades.map((x) => x.preFin)).mean),
    tPreFin: +tStat(trades.map((x) => x.preFin)).t.toFixed(2), finR: r3(tStat(trades.map((x) => x.finR)).mean),
    spreadR: r3(tStat(trades.map((x) => x.spreadR)).mean), stopped: trades.filter((x) => x.how !== 'close').length,
    worst: net.length ? r3(Math.min(...net)) : null, best: net.length ? r3(Math.max(...net)) : null };
}
const inYears = (trades, [a, b]) => trades.filter((x) => x.year >= a && x.year <= b);

export function runTest(M, test, years) {
  const trades = [], skipped = [];
  for (let y = years[0]; y <= years[1]; y++) {
    const [t0, t1] = yearWindow(test, y), r = windowTrade(M, test, t0, t1);
    if (r.skip) skipped.push({ year: y, why: r.skip }); else trades.push({ year: y, ...r });
  }
  return { trades, skipped };
}
export function placeboMeans(M, test, j) {
  const out = [];
  for (let k = 1; k <= P.SEEDS; k++) {
    const u = Math.floor(mulberry32(1000 * j + k)() * 365), net = [];
    for (let y = DECISIVE[0]; y <= DECISIVE[1]; y++) {
      const t0 = utc(y, 1, 1) + u * DAY, r = windowTrade(M, test, t0, t0 + test.L * DAY);
      if (!r.skip) net.push(r.net);
    }
    out.push({ seed: k, offset: u, n: net.length, avg: net.length ? tStat(net).mean : 0 });
  }
  return out;
}

export function loadMarket(key, root) {
  const show = (p) => execFileSync('git', ['show', `origin/council-data:${p}`], { cwd: root, maxBuffer: 1 << 28 }).toString();
  const j = JSON.parse(show(`research/daily/${key}.json`)), bars = toBars(j.rows);
  return { key, inst: j.inst, updated: j.updated, bars, td: tradingDays(bars) };
}

function main() {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const cache = JSON.parse(execFileSync('git', ['show', 'origin/council-data:macro/cache.json'], { cwd: root, maxBuffer: 1 << 28 }).toString());
  const dgs2 = cache.score.fred.DGS2, syms = JSON.parse(execFileSync('git', ['show', 'origin/council-data:ctrader/symbols.json'], { cwd: root, maxBuffer: 1 << 28 }).toString());
  const brokerEnergy = Object.keys(syms.symbols || {}).filter((k) => /OIL|WTI|BRENT|XTI|XBR|NGAS|NATGAS|UKO|USO|XNG/i.test(k));
  const mk = {}; for (const k of ['wtico', 'bco', 'natgas']) mk[k] = { ...loadMarket(k, root), dgs2 };
  const rows = {}, ps = [];
  TESTS.forEach((test, j) => {
    const M = mk[test.key], dec = runTest(M, test, DECISIVE), rep = runTest(M, test, REPLICATION);
    const D = summarize(dec.trades), R = summarize(rep.trades), pl = placeboMeans(M, test, j + 1);
    const p = pOneSided(D.t, D.df); ps.push(p);
    const plAvg = pl.map((x) => x.avg), p95 = pct95of40(plAvg);
    rows[test.id] = { name: test.name, market: M.inst, side: test.side > 0 ? 'long' : 'short',
      window: `${test.from.join('/')} -> ${test.to.join('/')} (month/day)`, decisive: D, replication: R, p: r4(p),
      placebo: { distinct: new Set(pl.map((x) => x.offset)).size, p95: r3(p95), median: r3(median(plAvg)), max: r3(Math.max(...plAvg)), rank: plAvg.filter((x) => x < D.avg).length,
        seeds: pl.map((x) => ({ ...x, avg: r3(x.avg) })) },
      years: [...rep.trades, ...dec.trades].map((x) => ({ year: x.year, entryDay: x.entryDay, exitDay: x.exitDay, entry: x.entry, stop: x.stop,
        exit: x.exit, how: x.how, gross: r3(x.gross), preFin: r3(x.preFin), finR: r3(x.finR), net: r3(x.net), nights: x.nights, dgs2: x.dgs2 })),
      skipped: [...rep.skipped, ...dec.skipped] };
    // post hoc, reported only: every weekday candle a trading day (no volume rule)
    const Mw = { ...M, td: M.td.map(() => true) }, dw = runTest(Mw, test, DECISIVE), Sw = summarize(dw.trades);
    rows[test.id].weekdaysOnly = { moved: dec.trades.filter((x) => { const w = dw.trades.find((z) => z.year === x.year); return !w || w.entryDay !== x.entryDay || w.exitDay !== x.exitDay; }).map((x) => x.year),
      n: Sw.n, avg: Sw.avg, t: Sw.t, pos: Sw.pos };
  });
  const ph = holm(ps), tests = {};
  TESTS.forEach((test, j) => {
    const r = rows[test.id], D = r.decisive;
    const checks = { meanPositive: D.avg > 0, holm: ph[j] < 0.05, years: D.pos >= P.MIN_POS, replication: r.replication.avg > 0, placebo: D.avg > r.placebo.p95 };
    r.pHolm = r4(ph[j]);
    tests[test.id] = { ...checks, pass: Object.values(checks).every(Boolean) };
  });
  const passed = TESTS.filter((t) => tests[t.id].pass).map((t) => t.id);
  const out = { built: '2026-11-14', title: 'Energy seasonal windows', data: { src: 'council-data research/daily (OANDA mid daily, weekend stubs folded)',
      files: Object.fromEntries(Object.values(mk).map((m) => [m.key, { inst: m.inst, updated: m.updated, last: dayKey(m.bars[m.bars.length - 1].time) }])),
      dgs2: 'council-data macro/cache.json score.fred.DGS2 (weekly)', brokerEnergySymbols: brokerEnergy },
    params: { ...P, spread: SPREAD, decisive: DECISIVE, replication: REPLICATION },
    rows, tests, passed, verdict: passed.length ? 'PASS' : 'FAIL' };
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
  console.log(out.verdict, passed);
  for (const t of TESTS) { const r = rows[t.id]; console.log(t.id, JSON.stringify(r.decisive), 'rep', JSON.stringify(r.replication), 'p', r.p, 'holm', r.pHolm, 'placebo', r.placebo.p95, r.placebo.median, 'rank', r.placebo.rank, r.skipped); }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) main();
