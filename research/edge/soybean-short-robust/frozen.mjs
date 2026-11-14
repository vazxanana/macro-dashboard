// Grain seasonality (pre-harvest decline): research/edge/grain-seasonality. Pre-registered in PREREGISTRATION.md (committed
// alone, before any price was read). Paper research only: nothing here is read by the council, the mirror or any page.
//   node run.mjs fetch <dir>   copies the council's daily candle cache out of the council-data branch (git show, no network)
//   node run.mjs full <dir>    runs the study and writes result.json
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights } from '../../../council/fills.mjs';

export const P = {
  ATR: 20, K: 3, MONTHS: 3,
  SPREAD: 0.002,            // round trip, fraction of the entry price (x1)
  FIN_YEAR: 0.03,           // a short is charged this a year (x1), per rollover night / 365
  MULTS: [0, 1, 2],
  DECISIVE: [2016, 2026], REPLICATION_TO: 2015,
  DRAWS: 200000, SEED: 20261114, PLACEBO_SEEDS: 40,
  GAP_PCT: 0.03, GAP_ATR: 2, ALPHA: 0.05,
};
export const TESTS = [
  { id: 'T1', key: 'corn', name: 'corn', m0: 7, judged: true },
  { id: 'T2', key: 'soybn', name: 'soybeans', m0: 7, judged: true },
  { id: 'T3', key: 'wheat', name: 'wheat', m0: 6, judged: true },
  { id: 'control', key: 'sugar', name: 'sugar', m0: 7, judged: false },
];
const DAY = 86400;
const ym = (t) => { const d = new Date(t * 1000); return [d.getUTCFullYear(), d.getUTCMonth() + 1]; };

// weekday candles only (weekend buckets folded into the next weekday, as council/fills.mjs foldWeekend)
export function prep(rows) { return foldWeekend(rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }))); }

// mean true range of the n candles closed BEFORE index i (needs i >= n + 1: the first one's previous close)
export function atrBefore(B, i, n = P.ATR) {
  if (i < n + 1) return null;
  let s = 0;
  for (let j = i - n; j < i; j++) s += Math.max(B[j].high - B[j].low, Math.abs(B[j].high - B[j - 1].close), Math.abs(B[j].low - B[j - 1].close));
  return s / n;
}

// [first index of month m0 of `year`, last index of month m0+months-1] or null when the data does not hold the whole window
export function windowOf(B, year, m0, months = P.MONTHS) {
  const endAbs = year * 12 + (m0 - 1) + (months - 1);
  const ey = Math.floor(endAbs / 12), em = endAbs % 12 + 1;
  let i0 = -1, i1 = -1;
  for (let i = 0; i < B.length; i++) {
    const [y, m] = ym(B[i].time);
    if (i0 < 0 && y === year && m === m0) i0 = i;
    if (y === ey && m === em) i1 = i;
  }
  if (i0 < 0 || i1 < i0) return null;
  const endOfMonth = Date.UTC(ey, em, 1) / 1000;             // the month after the window's last month starts here
  if (B[B.length - 1].time + DAY < endOfMonth) return null;  // the last month is not complete in the data
  if (ym(B[0].time)[0] * 12 + ym(B[0].time)[1] >= year * 12 + m0) return null; // window starts at the data's first month
  return [i0, i1];
}

// one short from the open of i0 to the close of i1 with a fixed 3 x ATR(20) stop; R and its costs at multiplier mult
export function trade(B, i0, i1, mult = 1) {
  const a = atrBefore(B, i0);
  if (a == null || !(a > 0)) return null;
  const entry = B[i0].open, dist = P.K * a, stop = entry + dist;
  let exit = B[i1].close, why = 'window', exitT = B[i1].time + DAY - 1, xi = i1;
  for (let j = i0; j <= i1; j++) {
    if (B[j].open >= stop) { exit = B[j].open; why = 'stop-gap'; exitT = B[j].time; xi = j; break; }
    if (B[j].high >= stop) { exit = stop; why = 'stop'; exitT = B[j].time + DAY - 1; xi = j; break; }
  }
  const g = (entry - exit) / dist, nn = nights(B[i0].time, exitT);
  // post-hoc diagnostic (not in the pre-registration): the part of gross R made between a close and the next open
  let gapR = 0; for (let j = i0 + 1; j <= xi; j++) gapR += (B[j - 1].close - B[j].open) / dist;
  const cost = mult * P.SPREAD * entry / dist, fin = mult * nn * (P.FIN_YEAR / 365) * entry / dist;
  return { t: B[i0].time, exitT, entry, stop, exit, why, atr: a, dist, nights: nn, g, cost, fin, net: g - cost - fin, gapR, days: i1 - i0 + 1, xi };
}

// seeded random numbers
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
export function tStat(a) { if (a.length < 2) return null; const m = mean(a), v = a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1); return v > 0 ? m / Math.sqrt(v / a.length) : null; }

// permutation null: per year one of its available start-month values, drawn uniformly; one-sided p of the real mean
export function permP(real, pools, draws = P.DRAWS, seed = P.SEED) {
  const r = rng(seed), n = pools.length; let ge = 0;
  for (let d = 0; d < draws; d++) {
    let s = 0;
    for (const p of pools) s += p[Math.floor(r() * p.length)];
    if (s / n >= real - 1e-12) ge++;
  }
  return (1 + ge) / (1 + draws);
}
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = Array(ps.length); let run = 0;
  o.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (ps.length - k) * p)); out[i] = run; });
  return out;
}

// candles whose open sits far from the previous close (contract switches show up here)
export function gaps(B) {
  const out = [];
  for (let i = 1; i < B.length; i++) {
    const d = B[i].open - B[i - 1].close, a = atrBefore(B, i);
    if (Math.abs(d) / B[i - 1].close > P.GAP_PCT || (a && Math.abs(d) > P.GAP_ATR * a)) out.push({ i, t: B[i].time, day: new Date(B[i].time * 1000).toISOString().slice(0, 10), pct: +(100 * d / B[i - 1].close).toFixed(2), atrs: a ? +(d / a).toFixed(2) : null });
  }
  return out;
}

const r3 = (x) => x == null ? null : +x.toFixed(3);
const r4 = (x) => x == null ? null : +x.toFixed(4);

export function runTest(B, test, years) {
  const rows = [], pools = { 0: [], 1: [], 2: [] }, byMonth = {}, gp = gaps(B);
  for (const y of years) {
    const w = windowOf(B, y, test.m0);
    if (!w) continue;
    const tr = {}; for (const m of P.MULTS) tr[m] = trade(B, w[0], w[1], m);
    if (!tr[1]) continue;
    const pool = { 0: [], 1: [], 2: [] };
    for (let m0 = 1; m0 <= 12; m0++) {
      const ww = windowOf(B, y, m0); if (!ww) continue;
      for (const k of P.MULTS) { const x = trade(B, ww[0], ww[1], k); if (x) { pool[k].push(x.net); if (k === 1) (byMonth[m0] ||= []).push(x.net); } }
    }
    for (const k of P.MULTS) pools[k].push(pool[k]);
    const t = tr[1], gapIn = gp.filter((g) => g.i > w[0] && g.i <= t.xi);
    rows.push({ year: y, entryDay: new Date(t.t * 1000).toISOString().slice(0, 10), exitDay: new Date(t.exitT * 1000).toISOString().slice(0, 10), entry: r4(t.entry), stop: r4(t.stop), exit: r4(t.exit), why: t.why, days: t.days, nights: t.nights, g: r3(t.g), cost: r3(t.cost), fin: r3(t.fin), net: r3(t.net), net0: r3(tr[0].net), net2: r3(tr[2].net), gapR: r3(t.gapR), gapsInHold: gapIn.map((g) => g.day) });
  }
  return { rows, pools, byMonth, gaps: gp };
}

export function summarize(res, test, placeboFn) {
  const { rows, pools, byMonth } = res, n = rows.length;
  if (!n) return { n: 0 };
  const g = rows.map((r) => r.g), nets = { 0: rows.map((r) => r.net0), 1: rows.map((r) => r.net), 2: rows.map((r) => r.net2) };
  const out = { n, won: nets[1].filter((x) => x > 0).length, meanG: r3(mean(g)), meanNet: r3(mean(nets[1])), meanNet0: r3(mean(nets[0])), meanNet2: r3(mean(nets[2])), t: r3(tStat(nets[1])), stopped: rows.filter((r) => r.why !== 'window').length };
  out.perm = {}; for (const k of P.MULTS) out.perm[k] = +permP(mean(nets[k]), pools[k]).toFixed(5);
  const months = Object.entries(byMonth).map(([m, a]) => ({ m: +m, n: a.length, mean: r3(mean(a)) })).sort((a, b) => b.mean - a.mean);
  out.startMonths = months.sort((a, b) => a.m - b.m);
  out.rank = 1 + months.filter((x) => x.m !== test.m0 && x.mean > mean(nets[1])).length;
  out.of = months.length;
  const clean = rows.filter((r) => !r.gapsInHold.length);
  out.overnight = { gapR: r3(rows.reduce((a, r) => a + r.gapR, 0)), totalG: r3(g.reduce((a, x) => a + x, 0)), postHoc: true };
  out.noGapYears = { n: clean.length, meanNet: clean.length ? r3(mean(clean.map((r) => r.net))) : null };
  if (placeboFn) { const pl = placeboFn(); out.placebo = { means: pl.map(r3), atOrAbove: pl.filter((x) => x >= mean(nets[1]) - 1e-12).length, of: pl.length }; }
  return out;
}

// placebo: per seed and year, a random start candle in that year, same number of trading days as that year's real window
export function placebo(B, rows, seeds = P.PLACEBO_SEEDS) {
  const out = [];
  for (let s = 1; s <= seeds; s++) {
    const r = rng(P.SEED + s), vals = [];
    for (const row of rows) {
      const idx = []; for (let i = 0; i < B.length; i++) if (ym(B[i].time)[0] === row.year && i >= P.ATR + 1 && i + row.days - 1 < B.length) idx.push(i);
      if (!idx.length) continue;
      const i0 = idx[Math.floor(r() * idx.length)], x = trade(B, i0, i0 + row.days - 1, 1);
      if (x) vals.push(x.net);
    }
    out.push(mean(vals));
  }
  return out;
}

export function verdictOf(tests) {
  const judged = tests.filter((t) => t.judged);
  const ps = holm(judged.map((t) => t.decisive.perm[1]));
  judged.forEach((t, i) => { t.holmP = +ps[i].toFixed(5); t.pass = t.decisive.meanNet > 0 && t.replication.meanNet > 0 && t.holmP < P.ALPHA; });
  return judged.some((t) => t.pass) ? 'PASS' : 'FAIL';
}

// ── files ──
const HERE = path.dirname(fileURLToPath(import.meta.url));
function load(dir, k) { return prep(JSON.parse(fs.readFileSync(path.join(dir, `${k}.json`), 'utf8')).rows); }
function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const t of TESTS) {
    const f = path.join(dir, `${t.key}.json`);
    if (fs.existsSync(f)) continue;
    fs.writeFileSync(f, execFileSync('git', ['show', `origin/council-data:research/daily/${t.key}.json`], { maxBuffer: 1 << 28 }));
    console.log('saved', t.key);
  }
}

function full(dir) {
  const tests = [];
  for (const test of TESTS) {
    const B = load(dir, test.key), first = ym(B[0].time)[0];
    const dec = [], rep = [];
    for (let y = P.DECISIVE[0]; y <= P.DECISIVE[1]; y++) dec.push(y);
    for (let y = first; y <= P.REPLICATION_TO; y++) rep.push(y);
    const D = runTest(B, test, dec), R = runTest(B, test, rep);
    const out = { id: test.id, market: test.key, name: test.name, window: test.m0 === 7 ? 'July-September' : 'June-August', judged: test.judged, candles: B.length,
      first: new Date(B[0].time * 1000).toISOString().slice(0, 10), last: new Date(B[B.length - 1].time * 1000).toISOString().slice(0, 10),
      decisive: summarize(D, test, () => placebo(B, D.rows)), replication: summarize(R, test, () => placebo(B, R.rows)),
      years: { decisive: D.rows, replication: R.rows }, gaps: { n: D.gaps.length, list: D.gaps.slice(0, 400) } };
    tests.push(out);
    console.log(test.id, test.key, 'dec', out.decisive.n, out.decisive.meanNet, 'p', out.decisive.perm[1], 'rank', out.decisive.rank, '| rep', out.replication.n, out.replication.meanNet, 'p', out.replication.perm[1]);
  }
  const verdict = verdictOf(tests);
  const J = { topic: 'grain-seasonality', built: '2026-11-14', title: 'Grain seasonality: the pre-harvest decline as a short on OANDA CFDs', system: 'corn, soybeans, wheat short over the harvest window (sugar control); OANDA mid daily candles, council-data research/daily',
    params: P, verdict, tests };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(J, null, 1) + '\n');
  console.log('verdict', verdict, tests.filter((t) => t.judged).map((t) => `${t.id} holm ${t.holmP} ${t.pass ? 'pass' : 'fail'}`).join(' | '));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [mode, dir] = process.argv.slice(2);
  if (mode === 'fetch' && dir) fetchAll(dir);
  else if (mode === 'full' && dir) full(dir);
  else { console.error('usage: node run.mjs fetch <dir> | full <dir>'); process.exit(1); }
}
