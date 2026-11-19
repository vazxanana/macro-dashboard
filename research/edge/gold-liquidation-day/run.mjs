// Buying gold after a cross-asset liquidation day (research/edge/gold-liquidation-day; rules fixed in PREREGISTRATION.md).
// Paper research only: a stand-alone gold rule, never a gate on the live gold book (owner decision 44).
//   node research/edge/gold-liquidation-day/run.mjs fetch <dir>   copy the three daily caches out of origin/council-data (no network)
//   node research/edge/gold-liquidation-day/run.mjs full <dir>    run the study, write result.json next to this file
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FIN, nights, foldWeekend } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DAY = 86400;
export const LOOK = 60, ATR_N = 20, STOP_ATR = 2, RT = 0.60, SEEDS = 40;
export const KEYS = ['xau', 'spx500', 'usb10y'];
export const IS = [Date.UTC(2007, 0, 1) / 1000, Date.UTC(2017, 0, 1) / 1000 - 1];
export const OOS = [Date.UTC(2017, 0, 1) / 1000, Date.UTC(2026, 10, 1) / 1000 - 1];
export const TESTS = [
  { id: 'T1', k: 1.0, hold: 10, what: 'all three <= -1 sd, gold held 10 candles (primary)' },
  { id: 'T2', k: 1.0, hold: 5, what: 'all three <= -1 sd, gold held 5 candles' },
  { id: 'T3', k: 0.5, hold: 10, what: 'all three <= -0.5 sd, gold held 10 candles' },
];

// ── data ──
export const toBars = (j) => j.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
export const load = (dir, key) => foldWeekend(toBars(JSON.parse(fs.readFileSync(path.join(dir, key + '.json'), 'utf8'))));

// z of each day's return against the sd of the LOOK returns before it: Map time -> z
export function zMap(bars, look = LOOK) {
  const r = bars.map((b, i) => (i ? b.close / bars[i - 1].close - 1 : null)), out = new Map();
  for (let i = look + 1; i < bars.length; i++) {
    const w = r.slice(i - look, i), m = w.reduce((a, b) => a + b, 0) / look;
    const sd = Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / (look - 1));
    if (sd > 0) out.set(bars[i].time, r[i] / sd);
  }
  return out;
}
// eligible days (all three z known), each with its liquidation flag at threshold k
export function days(gold, spx, bond, k, look = LOOK) {
  const zg = zMap(gold, look), zs = zMap(spx, look), zb = zMap(bond, look), out = [];
  for (const [t, g] of zg) {
    if (!zs.has(t) || !zb.has(t)) continue;
    const s = zs.get(t), b = zb.get(t);
    out.push({ t, zg: g, zs: s, zb: b, liq: g <= -k && s <= -k && b <= -k });
  }
  return out.sort((a, b) => a.t - b.t);
}

// first gold candle whose day is later than t
export function entryIndex(gold, t) {
  let lo = 0, hi = gold.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (gold[m].time > t) hi = m; else lo = m + 1; }
  return lo < gold.length ? lo : -1;
}
// ATR(n) of the n candles before index j
export function atrBefore(gold, j, n = ATR_N) {
  if (j - n - 1 < 0) return null;
  let s = 0;
  for (let i = j - n; i < j; i++) { const b = gold[i], pc = gold[i - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}
export const exitStamp = (dayT) => dayT + (new Date(dayT * 1000).getUTCDay() === 5 ? 22 * 3600 - 1 : DAY - 1);

// one long gold trade from candle j, held `hold` candles, stop STOP_ATR x ATR below the open
export function tradeAt(gold, j, hold, costX = 1) {
  const atr = atrBefore(gold, j);
  if (!(atr > 0) || j + hold - 1 >= gold.length) return null;
  const risk = STOP_ATR * atr, e = gold[j].open, stop = e - risk;
  let exit = null, kind = 'time', k = j;
  for (; k < j + hold; k++) {
    const b = gold[k];
    if (k > j && b.open <= stop) { exit = b.open; kind = 'gap'; break; }
    if (b.low <= stop) { exit = stop; kind = 'stop'; break; }
  }
  if (exit == null) { k = j + hold - 1; exit = gold[k].close; }
  const t = gold[j].time, c = exitStamp(gold[k].time), nn = nights(t, c);
  const gross = (exit - e) / risk, fin = nn * FIN.xau.long * e / risk, rt = RT / risk;
  return { t, c, j, k, e, stop, risk, exit, kind, nights: nn, gross, fin, cost: rt + fin, net: gross - costX * (rt + fin) };
}
export function simulate(ds, gold, hold, { free = false, costX = 1 } = {}) {
  const out = []; let lastK = -1;
  for (const d of ds) {
    const j = entryIndex(gold, d.t); if (j < 0) continue;
    if (!free && j <= lastK) continue;
    const tr = tradeAt(gold, j, hold, costX); if (!tr) continue;
    out.push({ ...tr, sig: d.t }); lastK = tr.k;
  }
  return out;
}

// ── statistics ──
export function stat(a) {
  const n = a.length; if (!n) return { n: 0, mean: null, t: null, sum: 0 };
  const m = a.reduce((x, y) => x + y, 0) / n, sd = n > 1 ? Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (n - 1)) : 0;
  return { n, mean: m, sum: m * n, t: sd > 0 ? m / (sd / Math.sqrt(n)) : null };
}
const mk = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
export function monthly(rows, from, to, key) {
  const a = mk(from), b = mk(Math.max(to, ...rows.map((r) => r.c))), m = new Array(b - a + 1).fill(0);
  for (const r of rows) m[mk(r.c) - a] += r[key];
  return { ...stat(m), months: m.length };
}
export function normP(t) {   // one-sided upper tail
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
export function rng(seed) {   // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function sample(arr, n, r) {
  const a = arr.slice();
  for (let i = 0; i < n && i < a.length; i++) { const j = i + Math.floor(r() * (a.length - i)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n).sort((x, y) => x.t - y.t);
}
const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000), r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
const median = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export function summarize(trades, base, from, to, x2 = null) {
  const bNet = stat(base.map((x) => x.net)).mean ?? 0, bGross = stat(base.map((x) => x.gross)).mean ?? 0;
  const rows = trades.map((x) => ({ ...x, ex: x.net - bNet }));
  const s = stat(rows.map((x) => x.net)), g = stat(rows.map((x) => x.gross)), ex = stat(rows.map((x) => x.ex));
  const mo = rows.length ? monthly(rows, from, to, 'ex') : { t: null, months: 0 }, moNet = rows.length ? monthly(rows, from, to, 'net') : { t: null };
  const b2 = x2 ? stat(x2.base.map((x) => x.net)).mean ?? 0 : null;
  const meanCost = stat(rows.map((x) => x.cost)).mean, meanAbs = stat(rows.map((x) => Math.abs(x.gross))).mean;
  return {
    n: s.n, win: s.n ? r3(rows.filter((x) => x.net > 0).length / s.n) : null, stops: rows.filter((x) => x.kind !== 'time').length,
    gross: r3(g.mean), net: r3(s.mean), total: r2(s.sum), excess: r3(ex.mean),
    excessGross: r3(g.mean == null ? null : g.mean - bGross),
    tMonth: r2(mo.t), months: mo.months, tMonthNet: r2(moNet.t), tTrade: r2(ex.t),
    base: { n: base.length, net: r3(bNet), gross: r3(bGross), x2: b2 == null ? null : r3(b2) },
    net2x: x2 ? r3(stat(x2.trades.map((x) => x.net)).mean) : null,
    excess2x: x2 && x2.trades.length ? r3(stat(x2.trades.map((x) => x.net)).mean - b2) : null,
    stopMedian: r2(median(rows.map((x) => x.risk))), nightsMean: r2(stat(rows.map((x) => x.nights)).mean),
    costR: r3(meanCost), costShare: meanAbs > 0 ? r3(meanCost / meanAbs) : null,
  };
}

export function runTest(test, gold, spx, bond, seeds = SEEDS) {
  const all = days(gold, spx, bond, test.k).filter((d) => d.t >= gold[ATR_N + 1].time);
  const out = { id: test.id, k: test.k, hold: test.hold, what: test.what };
  for (const [w, [from, to]] of Object.entries({ is: IS, oos: OOS })) {
    const ds = all.filter((d) => d.t >= from && d.t <= to), sig = ds.filter((d) => d.liq);
    const base = simulate(ds, gold, test.hold, { free: true }), tr = simulate(sig, gold, test.hold);
    const x2 = { base: simulate(ds, gold, test.hold, { free: true, costX: 2 }), trades: simulate(sig, gold, test.hold, { costX: 2 }) };
    out[w] = { liqDays: sig.length, eligible: ds.length, ...summarize(tr, base, from, to, x2) };
    if (w === 'oos') {
      out.trades = tr.map((x) => ({ sig: new Date(x.sig * 1000).toISOString().slice(0, 10), entry: new Date(x.t * 1000).toISOString().slice(0, 10), e: r2(x.e), risk: r2(x.risk), exit: r2(x.exit), kind: x.kind, gross: r3(x.gross), net: r3(x.net) }));
      const ts = [];
      for (let s = 1; s <= seeds; s++) ts.push(summarize(simulate(sample(ds, sig.length, rng(s)), gold, test.hold), base, from, to).tMonth);
      const real = out.oos.tMonth;
      out.placebo = { seeds, tMonths: ts, beaten: real == null ? 0 : ts.filter((x) => x != null && x < real).length };
    }
  }
  return out;
}

export function verdictOf(tests) {
  const ps = holm(tests.map((t) => normP(t.oos.tMonth)));
  tests.forEach((t, i) => {
    t.holmP = r3(ps[i]);
    t.checks = {
      tOOS: t.oos.tMonth != null && t.oos.tMonth >= 2, holm: ps[i] <= 0.05, isPositive: (t.is.excess ?? -1) > 0,
      netPositive: (t.oos.net ?? -1) > 0, costs2x: (t.oos.excess2x ?? -1) > 0, placebo: t.placebo.beaten >= 38,
    };
    t.pass = Object.values(t.checks).every(Boolean);
  });
  const v = tests[0].pass ? 'PASS' : tests.some((t) => t.pass) ? 'LEAD' : 'FAIL';
  return { verdict: v, passed: tests.filter((t) => t.pass).length };
}

export function run(dir) {
  const [gold, spx, bond] = KEYS.map((k) => load(dir, k));
  const tests = TESTS.map((t) => runTest(t, gold, spx, bond));
  const v = verdictOf(tests);
  return {
    study: 'gold-liquidation-day', built: '2026-11-14', ...v,
    rule: { look: LOOK, atrN: ATR_N, stopAtr: STOP_ATR, roundTrip: RT, finLong: FIN.xau.long, markets: KEYS },
    windows: { is: ['2007-01-01', '2016-12-31'], oos: ['2017-01-01', '2026-10-31'] },
    data: { goldFrom: new Date(gold[0].time * 1000).toISOString().slice(0, 10), goldTo: new Date(gold[gold.length - 1].time * 1000).toISOString().slice(0, 10) },
    tests,
  };
}

const [, , cmd, dir] = process.argv;
if (cmd === 'fetch' && dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const k of KEYS) fs.writeFileSync(path.join(dir, k + '.json'), execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 26 }));
  console.log('fetched', KEYS.join(', '), 'to', dir);
} else if (cmd === 'full' && dir) {
  const res = run(dir);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  for (const t of res.tests) console.log(t.id, JSON.stringify({ is: t.is, oos: t.oos, placebo: t.placebo.beaten, holm: t.holmP, pass: t.pass }));
  console.log('verdict', res.verdict);
}
