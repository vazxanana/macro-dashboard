// Turtle Soup (failed 20-day breaks) on spot gold daily (PREREGISTRATION.md, pushed first).
//   node --use-env-proxy research/edge/gold-daily-turtle-soup/fetch.mjs <dir>   OANDA mid H1 gold (cache out of git)
//   node research/edge/gold-daily-turtle-soup/run.mjs <dir>                     the study -> result.json
// Pure pieces are exported for the test.
import fs from 'node:fs';
import path from 'node:path';
import { days, nyDay } from '../gold-drd-long/run.mjs';
import { nights, FIN } from '../../../council/fills.mjs';

export const H = 3600;
export const N = 20, SPACING = 3, B = 0.30, RR = 2, HOLD = 3, ATR_N = 20;
export const SPREAD = 0.30, SLIP = SPREAD / 2;
export const WIN = { is: ['2007-01-01', '2016-12-31'], oos: ['2017-01-01', '2026-10-31'] };
export const TESTS = {
  T1: { name: 'T1 classic Turtle Soup, both sides', kind: 'classic', sides: [1, -1] },
  T2: { name: 'T2 Turtle Soup Plus One, both sides', kind: 'plus', sides: [1, -1] },
  T3: { name: 'T3 classic Turtle Soup, longs only', kind: 'classic', sides: [1] },
};

// H1 candles -> 17:00 New York days with the first / last H1 index of each day
export function build(h1) {
  const ds = days(h1), at = new Map(ds.map((x, j) => [x.d, j]));
  h1.forEach((c, k) => { const j = at.get(nyDay(c.time)); if (j == null) return; c.di = j; if (ds[j].a == null) ds[j].a = k; ds[j].b = k; });
  // ATR(20) of the 20 days ending at each day
  const tr = ds.map((x, i) => (i ? Math.max(x.high, ds[i - 1].close) - Math.min(x.low, ds[i - 1].close) : null));
  ds.forEach((x, i) => { if (i >= ATR_N) { let s = 0; for (let q = i - ATR_N + 1; q <= i; q++) s += tr[q]; x.atr = s / ATR_N; } else x.atr = null; });
  return ds;
}
// the prior 20-day extreme for day i and how many days back it was made (most recent occurrence); side 1 = lows
export function channel(ds, i, side) {
  if (i < N) return null; let v = null, k = null;
  for (let q = i - N; q <= i - 1; q++) { const x = side > 0 ? ds[q].low : ds[q].high;
    if (v == null || (side > 0 ? x <= v : x >= v)) { v = x; k = q; } }
  return { level: v, k, age: i - k };
}
const beyond = (side, px, lvl) => (side > 0 ? px < lvl : px > lvl);

// candidate entry of one test on day i for one side: { fillK, fill, stop, signalDay } or null
export function entryOf(h1, ds, i, side, kind) {
  const ch = channel(ds, i, side); if (!ch || ch.age < SPACING) return null;
  const d = ds[i]; if (d.a == null || i + 1 >= ds.length || ds[i + 1].a == null) return null;
  const level = ch.level + side * B; let from;
  if (kind === 'classic') {
    let arm = null; for (let k = d.a; k <= d.b; k++) if (beyond(side, side > 0 ? h1[k].low : h1[k].high, ch.level)) { arm = k; break; }
    if (arm == null) return null; from = arm + 1;
  } else {
    if (!beyond(side, d.close, ch.level)) return null; from = ds[i + 1].a;
  }
  const to = ds[i + 1].b;
  for (let k = from; k <= to; k++) { const c = h1[k];
    if (side > 0 ? c.high >= level : c.low <= level) {
      const fill = side > 0 ? Math.max(c.open, level) : Math.min(c.open, level);
      let ext = null; for (let q = d.a; q < k; q++) { const x = side > 0 ? h1[q].low : h1[q].high; ext = ext == null ? x : side > 0 ? Math.min(ext, x) : Math.max(ext, x); }
      if (ext == null) return null;
      const stop = ext - side * B;
      if (side > 0 ? stop >= fill : stop <= fill) return null;
      return { signalDay: i, fillK: k, fill, stop, level: ch.level, age: ch.age };
    } }
  return null;
}
// day index of an H1 candle (set by build; a weekend candle has none)
export const dayOfK = (h1, k) => h1[k].di;

// manage from the entry: worst = true when the entry was a stop order inside candle k0 (only the stop counts on k0)
export function manage(h1, ds, side, entry, stop, k0, d0, hold, worst) {
  const risk = side * (entry - stop), tgt = entry + side * RR * risk, last = d0 + hold;
  if (last >= ds.length || ds[last].b == null) return null;
  const end = ds[last].b;
  for (let k = k0; k <= end; k++) { const c = h1[k];
    const first = k === k0;
    if (first && worst) { if (side > 0 ? c.low <= stop : c.high >= stop) return { exit: stop, k, how: 'stop' }; continue; }
    const openThroughStop = side > 0 ? c.open <= stop : c.open >= stop;
    if (openThroughStop && !first) return { exit: c.open, k, how: 'stop' };
    if (side > 0 ? c.low <= stop : c.high >= stop) return { exit: stop, k, how: 'stop' };
    if (side > 0 ? c.high >= tgt : c.low <= tgt) return { exit: tgt, k, how: 'target' };
  }
  return { exit: h1[end].close, k: end, how: 'time' };
}
export function cost(side, entry, stop, res, mult, entryT, exitT) {
  const risk = side * (entry - stop), gross = side * (res.exit - entry) / risk;
  const px = SPREAD + SLIP + (res.how === 'target' ? 0 : SLIP), nn = side > 0 ? nights(entryT, exitT) : 0;
  const c = px / risk, fin = side > 0 ? nn * FIN.xau.long * entry / risk : 0;
  return { gross, cost: c, fin, nights: nn, net: gross - mult * (c + fin), net2: gross - 2 * (c + fin) };
}
export function trade(h1, ds, e, side) {
  const d0 = dayOfK(h1, e.fillK), res = manage(h1, ds, side, e.fill, e.stop, e.fillK, d0, HOLD, true); if (!res) return null;
  const entryT = h1[e.fillK].time, exitT = h1[res.k].time + H, c = cost(side, e.fill, e.stop, res, 1, entryT, exitT);
  return { ...e, side, d0, entryT, exitT, exitK: res.k, exitDay: dayOfK(h1, res.k), hold: dayOfK(h1, res.k) - d0, risk: side * (e.fill - e.stop),
    riskAtr: ds[d0 - 1] && ds[d0 - 1].atr ? side * (e.fill - e.stop) / ds[d0 - 1].atr : null, exit: res.exit, how: res.how, ...c };
}
export function runTest(h1, ds, test) {
  const cands = [];
  for (let i = N; i < ds.length - 1; i++) for (const s of test.sides) { const e = entryOf(h1, ds, i, s, test.kind); if (e) cands.push({ e, s }); }
  cands.sort((p, q) => p.e.fillK - q.e.fillK || p.s - q.s);
  const out = []; let free = -1;
  for (const { e, s } of cands) { if (e.fillK <= free) continue; const t = trade(h1, ds, e, s); if (!t) continue; out.push(t); free = t.exitK; }
  return out;
}

export const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export const inWin = (T, [f, t]) => T.filter((x) => { const s = ymd(x.entryT); return s >= f && s <= t; });
export function monthT(T, [f, t], key = 'net') {
  const sums = new Map(); for (let y = +f.slice(0, 4), m = +f.slice(5, 7); `${y}-${String(m).padStart(2, '0')}` <= t.slice(0, 7); m === 12 ? (y++, m = 1) : m++) sums.set(`${y}-${String(m).padStart(2, '0')}`, 0);
  for (const x of T) { const k = ymd(x.exitT).slice(0, 7); if (sums.has(k)) sums.set(k, sums.get(k) + x[key]); }
  const v = [...sums.values()], n = v.length, m = v.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1));
  return { months: n, t: sd ? m / (sd / Math.sqrt(n)) : 0 };
}
export const phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
function erf(x) { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); }
export function holm(ps) { const o = ps.map((p, k) => [p, k]).sort((a, b) => a[0] - b[0]), adj = new Array(ps.length); let run = 0;
  o.forEach(([p, k], r) => { run = Math.max(run, Math.min(1, (ps.length - r) * p)); adj[k] = run; }); return adj; }
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const r3 = (v) => (v == null || !Number.isFinite(v) ? null : +v.toFixed(3)), r2 = (v) => (v == null || !Number.isFinite(v) ? null : +v.toFixed(2));
export function summary(T, w) {
  const n = T.length, mean = (k) => (n ? T.reduce((a, x) => a + x[k], 0) / n : null), mt = monthT(T, w), m2 = monthT(T, w, 'gross');
  let eq = 0, pk = 0, dd = 0; for (const x of T) { eq += x.net; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  const how = (h) => T.filter((x) => x.how === h).length;
  return { n, gross: r3(mean('gross')), net: r3(mean('net')), net2x: r3(mean('net2')), cost: r3(mean('cost')), fin: r3(mean('fin')),
    total: r2(T.reduce((a, x) => a + x.net, 0)), win: n ? r2(T.filter((x) => x.net > 0).length / n * 100) : null,
    stops: how('stop'), targets: how('target'), times: how('time'), hold: r2(mean('hold')), riskUsd: r2(n ? [...T].map((x) => x.risk).sort((a, b) => a - b)[n >> 1] : null),
    months: mt.months, t: r2(mt.t), tGross: r2(m2.t), dd: r2(dd) };
}
// placebo: each real OOS trade -> entry at the first H1 open of a random day of the same year, same side, stop at the same
// multiple of ATR(20) (20 days ending the day before), 2R target, held at most the same number of days, no one-at-a-time rule
export function placebo(h1, ds, real, seeds = 40) {
  const byYear = new Map(); for (let e = ATR_N + 1; e < ds.length; e++) { if (ds[e].a == null || !ds[e - 1].atr) continue; const y = ymd(ds[e].t).slice(0, 4); if (!byYear.has(y)) byYear.set(y, []); byYear.get(y).push(e); }
  const means = [];
  for (let s = 1; s <= seeds; s++) { const r = rng(1000 + s), T = [];
    for (const x of real) { const pool = (byYear.get(ymd(x.entryT).slice(0, 4)) || []).filter((e) => e + x.hold < ds.length); let tr = null;
      for (let k = 0; k < 20 && !tr && pool.length; k++) { const e = pool[Math.floor(r() * pool.length)], k0 = ds[e].a, entry = h1[k0].open;
        const stop = entry - x.side * x.riskAtr * ds[e - 1].atr, res = manage(h1, ds, x.side, entry, stop, k0, e, x.hold, false);
        if (res) tr = cost(x.side, entry, stop, res, 1, h1[k0].time, h1[res.k].time + H); }
      if (tr) T.push(tr.net); }
    means.push(T.reduce((a, b) => a + b, 0) / T.length); }
  return means;
}

function main(dir) {
  const h1 = JSON.parse(fs.readFileSync(path.join(dir, 'xau-h1.json'), 'utf8')).map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
  const ds = build(h1);
  const out = { built: '2026-11-14', data: { src: 'OANDA mid H1 XAU_USD via the site proxy (fetch.mjs), 17:00 New York days (gold-drd-long days())', from: ymd(ds[0].t), to: ymd(ds.at(-1).t), days: ds.length, h1: h1.length },
    rule: { channel: N, spacing: SPACING, buffer: B, target: RR, holdDays: HOLD },
    costs: { spread: SPREAD, slippagePerMarketOrder: SLIP, stopOrTimeExit: SPREAD + 2 * SLIP, targetExit: SPREAD + SLIP, financing: { rate: FIN.xau.long, src: FIN.xau.src, side: 'longs only' } },
    windows: WIN, tests: {} };
  const ps = [];
  for (const [k, test] of Object.entries(TESTS)) {
    const all = runTest(h1, ds, test), oos = inWin(all, WIN.oos), is = inWin(all, WIN.is);
    const so = summary(oos, WIN.oos), si = summary(is, WIN.is), pl = placebo(h1, ds, oos.filter((x) => x.riskAtr != null)), sorted = [...pl].sort((a, b) => a - b);
    const beaten = pl.filter((m) => so.net > m).length, p = 1 - phi(so.t || 0); ps.push(p);
    const years = {}; for (const x of all) { const y = ymd(x.entryT).slice(0, 4); (years[y] ||= []).push(x); }
    const sides = {}; for (const s of test.sides) { const nm = s > 0 ? 'buys' : 'sells'; sides[nm] = { oos: summary(oos.filter((x) => x.side === s), WIN.oos), is: summary(is.filter((x) => x.side === s), WIN.is) }; }
    out.tests[k] = { name: test.name, oos: so, is: si, p: +p.toFixed(4), sides,
      placebo: { beaten, of: pl.length, p5: r3(sorted[1]), median: r3(sorted[19]), p95: r3(sorted[37]), mean: r3(pl.reduce((a, b) => a + b, 0) / pl.length) },
      years: Object.fromEntries(Object.entries(years).filter(([y]) => y >= '2007').map(([y, T]) => [y, { n: T.length, net: r3(T.reduce((a, x) => a + x.net, 0) / T.length), total: r2(T.reduce((a, x) => a + x.net, 0)) }])) };
  }
  holm(ps).forEach((h, j) => { const x = Object.values(out.tests)[j]; x.holm = +h.toFixed(4);
    x.checks = { n: x.oos.n >= 50, oos: x.oos.net > 0 && x.oos.t >= 2 && x.holm < 0.05, is: x.is.net > 0, cost2x: x.oos.net2x > 0, placebo: x.placebo.beaten >= 38 };
    x.pass = Object.values(x.checks).every(Boolean); });
  out.verdict = out.tests.T1.pass ? 'PASS' : 'FAIL';
  out.passAlone = ['T2', 'T3'].filter((k) => out.tests[k].pass);
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify(out, null, 1));
}
if (import.meta.url === `file://${process.argv[1]}`) main(process.argv[2]);
