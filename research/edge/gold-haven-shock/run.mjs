// Gold as a safe haven after equity shock days (research/edge/gold-haven-shock; rules fixed in PREREGISTRATION.md).
// Paper research only: a standalone signal, never a gate on the live gold systems (owner decision 44).
//   node research/edge/gold-haven-shock/run.mjs fetch <dir>   copy the three daily caches out of origin/council-data (no network)
//   node research/edge/gold-haven-shock/run.mjs full <dir>    run the study, write result.json next to this file
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FIN, nights, foldWeekend } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DAY = 86400;
export const LOOK = 20, K = 2, ATR_N = 20, RT = 0.30, SEEDS = 40;
export const KEYS = ['xau', 'spx500', 'nas100'];
export const SPLIT = Date.UTC(2016, 0, 1) / 1000;
export const TESTS = [
  { id: 'T1', market: 'spx500', hold: 1, what: 'spx500 shock, gold held 1 day' },
  { id: 'T2', market: 'spx500', hold: 5, what: 'spx500 shock, gold held 5 days' },
  { id: 'T3', market: 'nas100', hold: 5, what: 'nas100 shock, gold held 5 days (replication market)' },
];

// ── data ──
export const toBars = (j) => j.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
export const load = (dir, key) => foldWeekend(toBars(JSON.parse(fs.readFileSync(path.join(dir, key + '.json'), 'utf8'))));

// ── signal: r_D < -K x sd of the LOOK returns before D (D's own return is not in the sd) ──
export function shockDays(bars, look = LOOK, k = K) {
  const r = bars.map((b, i) => (i ? b.close / bars[i - 1].close - 1 : null)), out = [];
  for (let i = look + 1; i < bars.length; i++) {
    const w = r.slice(i - look, i), m = w.reduce((a, b) => a + b, 0) / look;
    const sd = Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / (look - 1));
    out.push({ t: bars[i].time, r: r[i], sd, shock: sd > 0 && r[i] < -k * sd });
  }
  return out;
}

// first gold candle whose day is later than t
export function entryIndex(gold, t) {
  let lo = 0, hi = gold.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (gold[m].time > t) hi = m; else lo = m + 1; }
  return lo < gold.length ? lo : -1;
}
// ATR(n) of the n true ranges of the candles before index j (needs n + 1 candles before it)
export function atrBefore(gold, j, n = ATR_N) {
  if (j - n - 1 < 0) return null;
  let s = 0;
  for (let i = j - n; i < j; i++) { const b = gold[i], pc = gold[i - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}
// exit stamp: the day's end Monday-Thursday, 21:59:59 UTC on Friday (spot shut at the Friday rollover)
export const exitStamp = (dayT) => dayT + (new Date(dayT * 1000).getUTCDay() === 5 ? 22 * 3600 - 1 : DAY - 1);

// one long gold trade from candle j, held `hold` candles, stop 1 x ATR below the open
export function tradeAt(gold, j, hold, costX = 1) {
  const risk = atrBefore(gold, j);
  if (!(risk > 0) || j + hold - 1 >= gold.length) return null;
  const e = gold[j].open, stop = e - risk;
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

// trades for a list of signal days; one at a time unless free = true
export function simulate(days, gold, hold, { free = false, costX = 1 } = {}) {
  const out = []; let lastK = -1;
  for (const d of days) {
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
// t on calendar-month sums (by exit stamp); every month from `from` to `to` counts, empty ones as 0
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

// statistics of one stream against the baseline mean of the same window
export function summarize(trades, base, from, to, costX2 = null) {
  const bNet = stat(base.map((x) => x.net)).mean ?? 0, bGross = stat(base.map((x) => x.gross)).mean ?? 0;
  const rows = trades.map((x) => ({ ...x, ex: x.net - bNet, exG: x.gross - bGross }));
  const s = stat(rows.map((x) => x.net)), g = stat(rows.map((x) => x.gross)), ex = stat(rows.map((x) => x.ex));
  const mo = rows.length ? monthly(rows, from, to, 'ex') : { t: null, months: 0 }, moNet = rows.length ? monthly(rows, from, to, 'net') : { t: null };
  return {
    n: s.n, win: s.n ? r3(rows.filter((x) => x.net > 0).length / s.n) : null, stops: rows.filter((x) => x.kind !== 'time').length,
    gross: r3(g.mean), net: r3(s.mean), netExact: s.mean == null ? null : +s.mean.toPrecision(4), total: r2(s.sum), excess: r3(ex.mean), excessGross: r3(stat(rows.map((x) => x.exG)).mean),
    tMonth: r2(mo.t), months: mo.months, tMonthNet: r2(moNet.t), tTrade: r2(ex.t),
    base: { n: base.length, net: r3(bNet), gross: r3(bGross) },
    x2: costX2 ? r3(stat(costX2.map((x) => x.net)).mean) : undefined,
    meanRisk: s.n ? r2(stat(rows.map((x) => x.risk)).mean) : null, meanNights: s.n ? r2(stat(rows.map((x) => x.nights)).mean) : null,
  };
}

export function runTest(test, gold, idx, seeds = SEEDS) {
  const sh = shockDays(idx), first = gold[ATR_N + 1] ? gold[ATR_N + 1].time : Infinity;
  const ok = sh.filter((d) => d.t >= first);
  const end = gold[gold.length - 1].time + DAY - 1;
  const win = { rep: [first, SPLIT - 1], dec: [SPLIT, end] };
  const out = { id: test.id, market: test.market, hold: test.hold, what: test.what };
  for (const [w, [from, to]] of Object.entries(win)) {
    const days = ok.filter((d) => d.t >= from && d.t <= to), sig = days.filter((d) => d.shock), ord = days.filter((d) => !d.shock);
    const base = simulate(ord, gold, test.hold, { free: true }), tr = simulate(sig, gold, test.hold), tr2 = simulate(sig, gold, test.hold, { costX: 2 });
    out[w] = { from: new Date(from * 1000).toISOString().slice(0, 10), to: new Date(Math.min(to, end) * 1000).toISOString().slice(0, 10), shockDays: sig.length, eligible: days.length, ...summarize(tr, base, from, to, tr2) };
    if (w === 'dec') {
      out.trades = tr.map((x) => ({ sig: new Date(x.sig * 1000).toISOString().slice(0, 10), entry: new Date(x.t * 1000).toISOString().slice(0, 10), e: r2(x.e), risk: r2(x.risk), exit: r2(x.exit), kind: x.kind, gross: r3(x.gross), net: r3(x.net) }));
      const ts = [];
      for (let s = 1; s <= seeds; s++) {
        const pick = sample(days, sig.length, rng(s));
        ts.push(summarize(simulate(pick, gold, test.hold), base, from, to).tMonth);
      }
      const real = out.dec.tMonth;
      out.placebo = { seeds, draws: sig.length, t: ts, atLeast2: ts.filter((t) => t != null && t >= 2).length, above: ts.filter((t) => t != null && real != null && t >= real).length, median: r2([...ts].sort((a, b) => a - b)[Math.floor(ts.length / 2)]) };
    }
  }
  return out;
}

export function verdictOf(tests) {
  for (const t of tests) {
    const c1 = t.rep.netExact > 0 && t.dec.netExact > 0, c2 = t.dec.tMonth != null && t.dec.tMonth >= 2 && t.holm < 0.05, c3 = t.dec.n >= 30;
    t.pass = c1 && c2 && c3; t.checks = { bothWindowsPositive: c1, tAndHolm: c2, n30: c3 };
    t.fragile = t.pass && !(t.dec.x2 > 0);
  }
  const by = Object.fromEntries(tests.map((t) => [t.id, t.pass]));
  const n = tests.filter((t) => t.pass).length;
  return by.T2 && by.T3 ? 'PASS' : n ? 'PARTIAL' : 'FAIL';
}

export function study(dir) {
  const gold = load(dir, 'xau'), idx = { spx500: load(dir, 'spx500'), nas100: load(dir, 'nas100') };
  const tests = TESTS.map((t) => runTest(t, gold, idx[t.market]));
  const ps = tests.map((t) => normP(t.dec.tMonth)), hs = holm(ps);
  tests.forEach((t, i) => { t.p = +ps[i].toPrecision(3); t.holm = +hs[i].toPrecision(3); });
  const verdict = verdictOf(tests);
  return { gold: { first: new Date(gold[0].time * 1000).toISOString().slice(0, 10), last: new Date(gold[gold.length - 1].time * 1000).toISOString().slice(0, 10), days: gold.length }, tests, verdict };
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
    const out = { title: 'Gold as a safe haven after equity shock days', built: new Date().toISOString().slice(0, 10), prereg: 'PREREGISTRATION.md', councilData: src,
      rule: { shock: `index close-to-close return < -${K} x sd of the ${LOOK} returns before the day`, entry: "gold's next folded UTC daily open", stop: `entry - ${ATR_N}-day ATR`, exits: 'close of day 1 (T1) or day 5 (T2, T3)', costs: `$${RT} a round trip + nights() x FIN.xau.long`, oneAtATime: true },
      fin: FIN.xau.long, split: '2016-01-01', ...r };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    for (const t of r.tests) {
      for (const w of ['rep', 'dec']) { const x = t[w]; console.log(t.id, w, x.from, x.to, 'n', x.n, 'shock', x.shockDays, 'gross', x.gross, 'net', x.net, 'ex', x.excess, 'exG', x.excessGross, 'tMo', x.tMonth, 'tTr', x.tTrade, 'x2', x.x2, 'base', JSON.stringify(x.base), 'win', x.win, 'stops', x.stops); }
      console.log(t.id, 'p', t.p, 'holm', t.holm, 'pass', t.pass, JSON.stringify(t.checks), 'placebo', JSON.stringify({ ...t.placebo, t: undefined }));
    }
    console.log('VERDICT', r.verdict);
  } else console.log('usage: run.mjs fetch <dir> | full <dir>');
};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
