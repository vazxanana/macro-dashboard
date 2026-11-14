// Spot gold sold for five days after a US equity index closes at a 52-week high (research/edge/gold-equity-record;
// rules fixed in PREREGISTRATION.md, pushed alone first). Paper research only: a stand-alone gold rule, never a gate on
// the live gold book (owner decision 44).
//   node research/edge/gold-equity-record/run.mjs fetch <dir>   copy the four daily caches out of origin/council-data
//   node research/edge/gold-equity-record/run.mjs count <dir>   event dates only (no gold return is read)
//   node research/edge/gold-equity-record/run.mjs full <dir>    run the study, write result.json next to this file
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FIN, nights, foldWeekend } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DAY = 86400;
export const SIDE = -1;
export const LOOK = 252, HOLD = 5, K_ATR = 2, ATR_N = 20, RT = 0.60, SEEDS = 40, NEED = 38;
export const KEYS = ['xau', 'spx500', 'nas100', 'us30'];
export const IS = [Date.UTC(2007, 0, 1) / 1000, Date.UTC(2017, 0, 1) / 1000 - 1];
export const OOS = [Date.UTC(2017, 0, 1) / 1000, Date.UTC(2026, 10, 1) / 1000 - 1];
export const TESTS = [
  { id: 'T1', markets: ['spx500'], what: 'S&P 500 closes at its 52-week closing high (primary)' },
  { id: 'T2', markets: ['nas100'], what: 'Nasdaq 100 closes at its 52-week closing high' },
  { id: 'T3', markets: ['us30'], what: 'Dow Jones 30 closes at its 52-week closing high' },
];

// ── data ──
export const toBars = (j) => j.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
export const load = (dir, key) => foldWeekend(toBars(JSON.parse(fs.readFileSync(path.join(dir, key + '.json'), 'utf8'))));

// ── signal: per index day D (from candle LOOK-1 on): is D's close at or above every close of the LOOK-1 candles before it ──
// Reads only candles at or before D.
export function recordDays(bars, look = LOOK) {
  const out = [];
  for (let i = look - 1; i < bars.length; i++) {
    let hi = -Infinity;
    for (let k = i - look + 1; k < i; k++) if (bars[k].close > hi) hi = bars[k].close;
    out.push({ t: bars[i].time, ev: bars[i].close >= hi });
  }
  return out;
}
// an event day for a set of indices: the same UTC day is a record day on every index of the set (each read on its own candles)
export function jointDays(lists) {
  const maps = lists.map((l) => new Map(l.map((d) => [d.t, d.ev])));
  return lists[0].filter((d) => maps.every((m) => m.has(d.t))).map((d) => ({ t: d.t, ev: maps.every((m) => m.get(d.t)) }));
}

// first gold candle whose day is later than t
export function entryIndex(gold, t) {
  let lo = 0, hi = gold.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (gold[m].time > t) hi = m; else lo = m + 1; }
  return lo < gold.length ? lo : -1;
}
// ATR(n) of the n true ranges of the candles before index j
export function atrBefore(gold, j, n = ATR_N) {
  if (j - n - 1 < 0) return null;
  let s = 0;
  for (let i = j - n; i < j; i++) { const b = gold[i], pc = gold[i - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}
// exit stamp: the day's end Monday-Thursday, 21:59:59 UTC on Friday (spot shut at the Friday rollover)
export const exitStamp = (dayT) => dayT + (new Date(dayT * 1000).getUTCDay() === 5 ? 22 * 3600 - 1 : DAY - 1);

// one gold trade from candle j (side -1 = sell, the tested side; +1 = buy), held `hold` candles, stop K_ATR x ATR(20)
// beyond the open; financing is charged on buys only (council/fills.mjs: a sell pays nothing and is credited nothing)
export function tradeAt(gold, j, hold = HOLD, costX = 1, side = SIDE) {
  const atr = atrBefore(gold, j);
  if (!(atr > 0) || j + hold - 1 >= gold.length) return null;
  const risk = K_ATR * atr, e = gold[j].open, stop = e - side * risk;
  let exit = null, kind = 'time', k = j;
  for (; k < j + hold; k++) {
    const b = gold[k];
    if (k > j && side * (b.open - stop) <= 0) { exit = b.open; kind = 'gap'; break; }
    if (side > 0 ? b.low <= stop : b.high >= stop) { exit = stop; kind = 'stop'; break; }
  }
  if (exit == null) { k = j + hold - 1; exit = gold[k].close; }
  const t = gold[j].time, c = exitStamp(gold[k].time), nn = nights(t, c);
  const gross = side * (exit - e) / risk, fin = side > 0 ? nn * FIN.xau.long * e / risk : 0, rt = RT / risk;
  return { t, c, j, k, e, stop, risk, exit, kind, nights: nn, gross, fin, cost: rt + fin, net: gross - costX * (rt + fin) };
}

// trades for a list of signal days; one at a time unless free = true
export function simulate(days, gold, hold = HOLD, { free = false, costX = 1 } = {}) {
  const out = []; let lastK = -1;
  for (const d of days) {
    const j = entryIndex(gold, d.t); if (j < 0) continue;
    if (!free && j <= lastK) continue;
    const tr = tradeAt(gold, j, hold, costX); if (!tr) continue;
    out.push({ ...tr, sig: d.t }); lastK = tr.k;
  }
  return out;
}
// the baseline: the same trade on every gold candle whose day is in [from, to]
export function baseline(gold, from, to, costX = 1) {
  const out = [];
  for (let j = 0; j < gold.length; j++) {
    if (gold[j].time < from || gold[j].time > to) continue;
    const tr = tradeAt(gold, j, HOLD, costX); if (tr) out.push(tr);
  }
  return out;
}

// ── statistics ──
export function stat(a) {
  const n = a.length; if (!n) return { n: 0, mean: null, t: null, sum: 0 };
  const m = a.reduce((x, y) => x + y, 0) / n, sd = n > 1 ? Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (n - 1)) : 0;
  return { n, mean: m, sum: m * n, t: sd > 0 ? m / (sd / Math.sqrt(n)) : null };
}
export const mk = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
// t on calendar-month sums (by exit stamp); every month from `from` to the later of `to` and the last exit counts, empty ones 0
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
// control: each event day replaced by a random non-event day of the same calendar month
export function sameMonth(days, r) {
  const pool = new Map();
  for (const d of days) if (!d.ev) { const m = mk(d.t); if (!pool.has(m)) pool.set(m, []); pool.get(m).push(d); }
  const out = [];
  for (const d of days) if (d.ev) { const p = pool.get(mk(d.t)); if (p && p.length) out.push(p[Math.floor(r() * p.length)]); }
  return out.sort((x, y) => x.t - y.t);
}

const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000), r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);

// statistics of one stream against the baseline mean of the same window
export function summarize(trades, base, from, to, x2 = null, base2 = null) {
  const bNet = stat(base.map((x) => x.net)).mean ?? 0, bGross = stat(base.map((x) => x.gross)).mean ?? 0;
  const rows = trades.map((x) => ({ ...x, ex: x.net - bNet }));
  const s = stat(rows.map((x) => x.net)), g = stat(rows.map((x) => x.gross)), ex = stat(rows.map((x) => x.ex));
  const cost = stat(rows.map((x) => x.cost)).mean;
  const mo = rows.length ? monthly(rows, from, to, 'ex') : { t: null, months: 0 };
  const moNet = rows.length ? monthly(rows, from, to, 'net') : { t: null }, moG = rows.length ? monthly(rows, from, to, 'gross') : { t: null };
  const out = {
    n: s.n, months: new Set(rows.map((x) => mk(x.c))).size, win: s.n ? r3(rows.filter((x) => x.net > 0).length / s.n) : null,
    stops: rows.filter((x) => x.kind !== 'time').length,
    gross: r3(g.mean), net: r3(s.mean), total: r2(s.sum), excess: r3(ex.mean), excessGross: r3((g.mean ?? 0) - bGross),
    tMonth: r2(mo.t), tMonthNet: r2(moNet.t), tMonthGross: r2(moG.t), tTrade: r2(ex.t),
    cost: r3(cost), base: { n: base.length, net: r3(bNet), gross: r3(bGross) },
  };
  if (x2) {
    const b2 = stat(base2.map((x) => x.net)).mean ?? 0, n2 = stat(x2.map((x) => x.net)).mean;
    out.x2 = { net: r3(n2), excess: r3(n2 - b2), base: r3(b2) };
  }
  return out;
}

export function eventDays(test, bars) {
  return test.markets.length === 1 ? recordDays(bars[test.markets[0]]) : jointDays(test.markets.map((m) => recordDays(bars[m])));
}

export function runTest(test, bars, seeds = SEEDS) {
  const gold = bars.xau, all = eventDays(test, bars);
  const out = { id: test.id, markets: test.markets, what: test.what };
  for (const [w, [from, to]] of Object.entries({ is: IS, oos: OOS })) {
    const days = all.filter((d) => d.t >= from && d.t <= to && entryIndex(gold, d.t) >= 0);
    const sig = days.filter((d) => d.ev);
    const base = baseline(gold, from, to), base2 = baseline(gold, from, to, 2);
    const tr = simulate(sig, gold), tr2 = simulate(sig, gold, HOLD, { costX: 2 });
    out[w] = { from: new Date(from * 1000).toISOString().slice(0, 10), to: new Date(to * 1000).toISOString().slice(0, 10), events: sig.length, ...summarize(tr, base, from, to, tr2, base2) };
    if (w === 'oos') {
      out.trades = tr.map((x) => ({ sig: new Date(x.sig * 1000).toISOString().slice(0, 10), entry: new Date(x.t * 1000).toISOString().slice(0, 10), e: r2(x.e), risk: r2(x.risk), exit: r2(x.exit), kind: x.kind, gross: r3(x.gross), net: r3(x.net) }));
      const real = out.oos.tMonth, realEx = out.oos.excess;
      const ts = [];
      for (let s = 1; s <= seeds; s++) ts.push(summarize(simulate(sample(days, sig.length, rng(s)), gold), base, from, to).tMonth);
      out.placebo = { seeds, beaten: real == null ? 0 : ts.filter((x) => x != null && real > x).length, ts };
      const cx = [];
      for (let s = 101; s <= 100 + seeds; s++) cx.push(summarize(simulate(sameMonth(days, rng(s)), gold), base, from, to).excess);
      out.control = { seeds, what: 'each event day replaced by a random non-event day of the same calendar month', beaten: realEx == null ? 0 : cx.filter((x) => x != null && realEx > x).length, mean: r3(stat(cx).mean), excess: cx };
    }
  }
  return out;
}

export function run(dir) {
  const bars = Object.fromEntries(KEYS.map((k) => [k, load(dir, k)]));
  const tests = TESTS.map((t) => runTest(t, bars));
  const p = tests.map((t) => normP(t.oos.tMonth)), hp = holm(p);
  tests.forEach((t, i) => {
    t.p = r3(p[i]); t.holm = r3(hp[i]);
    t.pass = t.oos.tMonth != null && t.oos.tMonth >= 2 && hp[i] < 0.05 && t.is.excess > 0 && t.oos.x2.net > 0 && t.oos.x2.excess > 0
      && t.placebo.beaten >= NEED && t.control.beaten >= NEED;
  });
  const t1 = tests[0], sg = (v) => (v >= 0 ? '+' : '') + v;
  const verdict = t1.pass ? 'PASS' : 'FAIL';
  return {
    study: 'gold-equity-record', built: '2026-11-14', verdict,
    passed: tests.filter((t) => t.pass).length, of: tests.length,
    headline: `${verdict}, ${tests.filter((t) => t.pass).length} of 3: a 5-day gold sell after an S&P 500 52-week closing high beat gold's every-day sell by ${sg(t1.oos.excess)}R net out of sample 2017-26 (n ${t1.oos.n}, month t ${t1.oos.tMonth}); ${sg(t1.is.excess)}R in 2007-16.`,
    rule: { side: 'sell', look: LOOK, hold: HOLD, stop: `${K_ATR} x ATR(${ATR_N})`, rt: RT, fin: FIN.xau.long, finSrc: FIN.xau.src },
    windows: { is: ['2007-01-01', '2016-12-31'], oos: ['2017-01-01', '2026-10-31'] },
    data: Object.fromEntries(KEYS.map((k) => [k, { first: new Date(bars[k][0].time * 1000).toISOString().slice(0, 10), last: new Date(bars[k].at(-1).time * 1000).toISOString().slice(0, 10), rows: bars[k].length }])),
    tests,
  };
}

const [, , cmd, dir] = process.argv;
if (cmd === 'fetch' && dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const k of KEYS) fs.writeFileSync(path.join(dir, k + '.json'), execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
  console.log('fetched', KEYS.join(', '), 'to', dir);
} else if (cmd === 'count' && dir) {
  const bars = Object.fromEntries(KEYS.map((k) => [k, load(dir, k)]));
  for (const t of TESTS) {
    const all = eventDays(t, bars);
    for (const [w, [from, to]] of Object.entries({ is: IS, oos: OOS })) {
      const sig = all.filter((d) => d.ev && d.t >= from && d.t <= to && entryIndex(bars.xau, d.t) >= 0);
      let last = -1, n = 0;   // one trade at a time: entries at least HOLD gold candles apart (dates only, no price read)
      for (const d of sig) { const j = entryIndex(bars.xau, d.t); if (j > last) { n++; last = j + HOLD - 1; } }
      console.log(t.id, w, 'event days', sig.length, 'one-at-a-time entries', n, 'months', new Set(sig.map((d) => mk(d.t))).size);
    }
  }
} else if (cmd === 'full' && dir) {
  const res = run(dir);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  console.log(res.headline);
  for (const t of res.tests) console.log(t.id, JSON.stringify({ is: t.is, oos: t.oos, p: t.p, holm: t.holm, placebo: t.placebo.beaten, control: [t.control.beaten, t.control.mean], pass: t.pass }));
}
