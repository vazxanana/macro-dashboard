// Do big crude-oil days (and big copper days) lead spot gold? (research/edge/gold-oil-lead; rules fixed in PREREGISTRATION.md)
// Paper research only: a standalone cross-asset signal, never a gate / entry / exit / size of the live gold book (decision 44).
//   node research/edge/gold-oil-lead/run.mjs fetch <dir>   copy the daily caches out of origin/council-data (no network)
//   node research/edge/gold-oil-lead/run.mjs full <dir>    run the study, write result.json next to this file
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FIN, nights, foldWeekend } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DAY = 86400;
export const LOOK = 60, K = 2, ATR_N = 20, STOP_ATR = 2, HOLD = 3, SPREAD = 0.30, SLIP = SPREAD / 2, SEEDS = 40;
export const RT = SPREAD + 2 * SLIP;   // $0.60 a trade: the spread plus half a spread on the entry and on the exit
export const KEYS = ['xau', 'wtico', 'bco', 'xcu'];
export const SPLIT = Date.UTC(2017, 0, 1) / 1000;
export const OOS_END = Date.UTC(2026, 9, 31, 23, 59, 59) / 1000;
export const TESTS = [
  { id: 'T1', market: 'wtico', dir: 1, what: 'big WTI day, gold traded the same way for 3 days (primary)' },
  { id: 'T2', market: 'wtico', dir: -1, what: 'big WTI day, gold traded the other way for 3 days (fade)' },
  { id: 'T3', market: 'xcu', dir: 1, what: 'big copper day, gold traded the same way for 3 days' },
];
export const INFO = [{ id: 'B1', market: 'bco', dir: 1, what: 'big Brent day, gold the same way (informational, no test)' }];

// ── data ──
export const toBars = (j) => j.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
export const load = (dir, key) => foldWeekend(toBars(JSON.parse(fs.readFileSync(path.join(dir, key + '.json'), 'utf8'))));

// ── signal: |r_D| > K x sd of the LOOK returns before D (D's own return is not in the sd); s = sign(r_D) ──
export function bigDays(bars, look = LOOK, k = K) {
  const r = bars.map((b, i) => (i ? b.close / bars[i - 1].close - 1 : null)), out = [];
  for (let i = look + 1; i < bars.length; i++) {
    const w = r.slice(i - look, i), m = w.reduce((a, b) => a + b, 0) / look;
    const sd = Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / (look - 1));
    const big = sd > 0 && Math.abs(r[i]) > k * sd;
    out.push({ t: bars[i].time, r: r[i], sd, big, s: r[i] > 0 ? 1 : r[i] < 0 ? -1 : 0 });
  }
  return out;
}

// first gold candle whose UTC day is later than t (matched by day stamp, never by row number)
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

// one gold trade from candle j, side +1 long / -1 short, held `hold` candles, stop STOP_ATR x ATR from the open
export function tradeAt(gold, j, side, hold = HOLD, costX = 1) {
  const atr = atrBefore(gold, j);
  if (!(atr > 0) || j + hold - 1 >= gold.length) return null;
  const risk = STOP_ATR * atr, e = gold[j].open, stop = e - side * risk;
  const through = (px) => (side > 0 ? px <= stop : px >= stop);
  let exit = null, kind = 'time', k = j;
  for (; k < j + hold; k++) {
    const b = gold[k];
    if (k > j && through(b.open)) { exit = b.open; kind = 'gap'; break; }
    if (through(side > 0 ? b.low : b.high)) { exit = stop; kind = 'stop'; break; }
  }
  if (exit == null) { k = j + hold - 1; exit = gold[k].close; }
  const t = gold[j].time, c = exitStamp(gold[k].time), nn = nights(t, c);
  const gross = side * (exit - e) / risk, fin = side > 0 ? nn * FIN.xau.long * e / risk : 0, rt = RT / risk;
  return { t, c, j, k, side, e, stop, risk, exit, kind, nights: nn, gross, fin, cost: rt + fin, net: gross - costX * (rt + fin) };
}

// trades for a list of signal days ({ t, s }); side = dir x s; one at a time
export function simulate(days, gold, dir, { costX = 1, hold = HOLD } = {}) {
  const out = []; let lastK = -1;
  for (const d of days) {
    if (!d.s) continue;
    const j = entryIndex(gold, d.t); if (j < 0) continue;
    if (j <= lastK) continue;
    const tr = tradeAt(gold, j, dir * d.s, hold, costX); if (!tr) continue;
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
export function shuffle(arr, r) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
// placebo draw: n random eligible days, given the real sides in a random order (same long / short mix)
export function placeboDays(eligible, sides, r) {
  const pick = shuffle(eligible, r).slice(0, sides.length).sort((x, y) => x.t - y.t), sd = shuffle(sides, r);
  return pick.map((d, i) => ({ t: d.t, s: sd[i] }));
}

const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000), r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);

export function summarize(trades, from, to, x2) {
  const s = stat(trades.map((x) => x.net)), g = stat(trades.map((x) => x.gross));
  const mo = trades.length ? monthly(trades, from, to, 'net') : { t: null, months: 0 }, mg = trades.length ? monthly(trades, from, to, 'gross') : { t: null };
  return {
    n: s.n, long: trades.filter((x) => x.side > 0).length, short: trades.filter((x) => x.side < 0).length,
    win: s.n ? r3(trades.filter((x) => x.net > 0).length / s.n) : null, stops: trades.filter((x) => x.kind !== 'time').length,
    gross: r3(g.mean), net: r3(s.mean), netExact: s.mean == null ? null : +s.mean.toPrecision(4), total: r2(s.sum),
    x2: x2 ? r3(stat(x2.map((x) => x.net)).mean) : undefined,
    tMonth: r2(mo.t), tMonthGross: r2(mg.t), months: mo.months, tTrade: r2(s.t),
    meanCost: s.n ? r3(stat(trades.map((x) => x.cost)).mean) : null, meanRisk: s.n ? r2(stat(trades.map((x) => x.risk)).mean) : null,
  };
}

export function runTest(test, gold, sig, { seeds = SEEDS, end = OOS_END } = {}) {
  const first = gold[ATR_N + 1] ? gold[ATR_N + 1].time : Infinity;
  const ok = bigDays(sig).filter((d) => d.t >= first);
  const win = { is: [first, SPLIT - 1], oos: [SPLIT, Math.min(end, gold[gold.length - 1].time + DAY - 1)] };
  const out = { id: test.id, market: test.market, dir: test.dir, what: test.what };
  for (const [w, [from, to]] of Object.entries(win)) {
    const days = ok.filter((d) => d.t >= from && d.t <= to), big = days.filter((d) => d.big);
    const tr = simulate(big, gold, test.dir), tr2 = simulate(big, gold, test.dir, { costX: 2 });
    out[w] = { from: iso(from), to: iso(to), bigDays: big.length, eligible: days.length, ...summarize(tr, from, to, tr2) };
    if (w === 'oos') {
      out.trades = tr.map((x) => ({ sig: iso(x.sig), entry: iso(x.t), side: x.side, e: r2(x.e), risk: r2(x.risk), exit: r2(x.exit), kind: x.kind, gross: r3(x.gross), net: r3(x.net) }));
      if (seeds) {
        const sides = big.filter((d) => d.s).map((d) => d.s), ts = [];
        for (let s = 1; s <= seeds; s++) ts.push(summarize(simulate(placeboDays(days, sides, rng(s)), gold, test.dir), from, to).tMonth);
        const real = out.oos.tMonth, srt = [...ts].sort((a, b) => a - b);
        out.placebo = { seeds, draws: sides.length, t: ts, atLeast2: ts.filter((t) => t != null && t >= 2).length, atLeastReal: ts.filter((t) => t != null && real != null && t >= real).length, median: r2(srt[Math.floor(srt.length / 2)]), p5: r2(srt[1]), p95: r2(srt[38]) };
      }
    }
  }
  return out;
}

export function verdictOf(tests) {
  for (const t of tests) {
    const c1 = t.oos.tMonth != null && t.oos.tMonth >= 2 && t.holm < 0.05, c2 = t.is.netExact > 0, c3 = t.oos.x2 > 0, c4 = t.oos.n >= 30;
    t.checks = { oosTAndHolm: c1, isPositive: c2, x2Positive: c3, n30: c4 }; t.pass = c1 && c2 && c3 && c4;
  }
  if (tests.find((t) => t.id === 'T1').pass) return 'PASS';
  return tests.some((t) => t.pass) ? 'PARTIAL' : 'FAIL';
}

export function study(dir) {
  const gold = load(dir, 'xau'), m = Object.fromEntries(['wtico', 'bco', 'xcu'].map((k) => [k, load(dir, k)]));
  const tests = TESTS.map((t) => runTest(t, gold, m[t.market]));
  const ps = tests.map((t) => normP(t.oos.tMonth)), hs = holm(ps);
  tests.forEach((t, i) => { t.p = +ps[i].toPrecision(3); t.holm = +hs[i].toPrecision(3); });
  const verdict = verdictOf(tests);
  const info = INFO.map((t) => { const r = runTest(t, gold, m[t.market], { seeds: 0 }); delete r.trades; return r; });
  const span = (b) => ({ first: iso(b[0].time), last: iso(b[b.length - 1].time), days: b.length });
  return { data: { xau: span(gold), wtico: span(m.wtico), bco: span(m.bco), xcu: span(m.xcu) }, tests, info, verdict };
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
    const out = { title: 'Big crude-oil and copper days as a lead for spot gold', built: new Date().toISOString().slice(0, 10), prereg: 'PREREGISTRATION.md', councilData: src,
      rule: { signal: `|close-to-close return| > ${K} x sd of the ${LOOK} returns before the day`, entry: "gold's next folded UTC daily open (first gold day later than the signal day)", stop: `${STOP_ATR} x ${ATR_N}-day ATR from the entry`, exit: `close of the ${HOLD}rd gold candle (entry candle = 1)`, costs: `$${RT.toFixed(2)} a trade ($${SPREAD} spread + $${SLIP} slippage on each of two market orders) + nights() x FIN.xau.long on longs`, oneAtATime: true },
      fin: FIN.xau.long, split: '2017-01-01', oosEnd: '2026-10-31', ...r };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    for (const t of [...r.tests, ...r.info]) {
      for (const w of ['is', 'oos']) { const x = t[w]; console.log(t.id, w, x.from, x.to, 'n', x.n, `(${x.long}/${x.short})`, 'big', x.bigDays, 'gross', x.gross, 'net', x.net, 'x2', x.x2, 'tMo', x.tMonth, 'tMoG', x.tMonthGross, 'tTr', x.tTrade, 'win', x.win, 'stops', x.stops, 'cost', x.meanCost); }
      if (t.p != null) console.log(t.id, 'p', t.p, 'holm', t.holm, 'pass', t.pass, JSON.stringify(t.checks), 'placebo', JSON.stringify({ ...t.placebo, t: undefined }));
    }
    console.log('VERDICT', r.verdict);
  } else console.log('usage: run.mjs fetch <dir> | full <dir>');
};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
