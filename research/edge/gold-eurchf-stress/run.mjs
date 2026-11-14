// Does European stress, read in EUR/CHF, lead spot gold over the next four weeks? (research/edge/gold-eurchf-stress)
// Rules fixed in PREREGISTRATION.md. Paper research only: a stand-alone cross-market rule, never a gate / entry / exit / size
// of the live gold book (owner decision 44).
//   node research/edge/gold-eurchf-stress/run.mjs fetch <dir>   copy the daily caches out of origin/council-data (no network)
//   node research/edge/gold-eurchf-stress/run.mjs full <dir>    run the study, write result.json next to this file
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FIN, nights, foldWeekend } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DAY = 86400;
export const LOOK = 20, THR = 0.02, HOLD = 20, ATR_N = 20, STOP_ATR = 2, SEEDS = 40;
export const RT = 0.30 + 2 * 0.15;   // $0.60 a round trip
export const KEYS = ['xau', 'eurchf'];
export const IS_FROM = Date.UTC(2007, 0, 1) / 1000;
export const SPLIT = Date.UTC(2017, 0, 1) / 1000;
export const OOS_END = Date.UTC(2026, 9, 31, 23, 59, 59) / 1000;
export const TESTS = [
  { id: 'T1', sides: [1, -1], what: 'EUR/CHF 20-day return <= -2 %: long gold; >= +2 %: short gold; 20 gold candles (primary, both-sided)' },
  { id: 'T2', sides: [1], what: 'long leg alone: EUR/CHF down 2 % or more over 20 days, long gold' },
  { id: 'T3', sides: [-1], what: 'short leg alone: EUR/CHF up 2 % or more over 20 days, short gold' },
];

// ── data ──
export const toBars = (j) => j.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
export const load = (dir, key) => foldWeekend(toBars(JSON.parse(fs.readFileSync(path.join(dir, key + '.json'), 'utf8'))));
export const dayOf = (t) => Math.floor(t / DAY) * DAY;
const weekOf = (t) => { const d = dayOf(t), wd = (new Date(d * 1000).getUTCDay() + 6) % 7; return d - wd * DAY; };

// weekly signal rows: gold's last candle of each Monday week; r = EUR/CHF close on that day / close LOOK candles earlier - 1;
// g = gold's own return over its last LOOK candles (informational baseline only). Only data up to that day is read.
export function weekRows(gold, fx, look = LOOK) {
  const fi = new Map(fx.map((b, i) => [dayOf(b.time), i]));
  const last = new Map();
  gold.forEach((g, i) => last.set(weekOf(g.time), i));
  const out = [];
  for (const i of last.values()) {
    const t = dayOf(gold[i].time), k = fi.get(t);
    if (k == null || k - look < 0 || i - look < 0) continue;
    out.push({ t, r: fx[k].close / fx[k - look].close - 1, g: gold[i].close / gold[i - look].close - 1 });
  }
  return out;
}
export const sideOf = (r, thr = THR) => (r <= -thr ? 1 : r >= thr ? -1 : 0);

export function entryIndex(gold, t) {
  let lo = 0, hi = gold.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (dayOf(gold[m].time) > t) hi = m; else lo = m + 1; }
  return lo < gold.length ? lo : -1;
}
export function atrBefore(gold, j, n = ATR_N) {
  if (j - n - 1 < 0) return null;
  let s = 0;
  for (let i = j - n; i < j; i++) { const b = gold[i], pc = gold[i - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}
export const exitStamp = (dayT) => dayT + (new Date(dayT * 1000).getUTCDay() === 5 ? 22 * 3600 - 1 : DAY - 1);

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
  const t = dayOf(gold[j].time), c = exitStamp(dayOf(gold[k].time)), nn = nights(t, c);
  const gross = side * (exit - e) / risk, fin = side > 0 ? nn * FIN.xau.long * e / risk : 0, rt = RT / risk;
  return { t, c, j, k, side, e, stop, risk, exit, kind, nights: nn, gross, fin, cost: rt + fin, net: gross - costX * (rt + fin) };
}
export function simulate(days, gold, hold = HOLD, { costX = 1 } = {}) {
  const out = []; let lastK = -1;
  for (const d of days) {
    if (!d.s) continue;
    const j = entryIndex(gold, d.t); if (j < 0 || j <= lastK) continue;
    const tr = tradeAt(gold, j, d.s, hold, costX); if (!tr) continue;
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
  const a = mk(from), b = mk(to), m = new Array(b - a + 1).fill(0);
  for (const r of rows) { const x = mk(r.c) - a; if (x >= 0 && x < m.length) m[x] += r[key]; else m[m.length - 1] += r[key]; }
  return { ...stat(m), months: m.length };
}
export function normP(t) {
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
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function shuffle(arr, r) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function placeboDays(eligible, sides, r) {
  const pick = shuffle(eligible, r).slice(0, sides.length).sort((x, y) => x.t - y.t), sd = shuffle(sides, r);
  return pick.map((d, i) => ({ t: d.t, s: sd[i] }));
}

const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000), r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
export const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

export function summarize(trades, from, to, x2) {
  const s = stat(trades.map((x) => x.net)), g = stat(trades.map((x) => x.gross));
  const mo = monthly(trades, from, to, 'net'), mg = monthly(trades, from, to, 'gross');
  const absG = trades.length ? trades.reduce((a, x) => a + Math.abs(x.gross), 0) / trades.length : null;
  const mc = trades.length ? stat(trades.map((x) => x.cost)).mean : null;
  return {
    n: s.n, long: trades.filter((x) => x.side > 0).length, short: trades.filter((x) => x.side < 0).length,
    win: s.n ? r3(trades.filter((x) => x.net > 0).length / s.n) : null, stops: trades.filter((x) => x.kind !== 'time').length,
    gross: r3(g.mean), net: r3(s.mean), netExact: s.mean == null ? null : +s.mean.toPrecision(4), total: r2(s.sum),
    x2: x2 ? r3(stat(x2.map((x) => x.net)).mean) : undefined,
    tMonth: r2(mo.t), tMonthGross: r2(mg.t), months: mo.months, tTrade: r2(s.t),
    meanCost: r3(mc), costShare: mc != null && absG > 0 ? r3(mc / absG) : null,
    medianStop: s.n ? r2(median(trades.map((x) => x.risk))) : null,
  };
}

export function windows(gold) {
  return { is: [IS_FROM, SPLIT - 1], oos: [SPLIT, Math.min(OOS_END, dayOf(gold[gold.length - 1].time) + DAY - 1)] };
}

export function runTest(test, gold, rows, { seeds = SEEDS, sideFn = (d) => sideOf(d.r) } = {}) {
  const out = { id: test.id, sides: test.sides, what: test.what };
  for (const [w, [from, to]] of Object.entries(windows(gold))) {
    const days = rows.filter((d) => d.t >= from && d.t <= to).map((d) => { const s = sideFn(d); return { t: d.t, s: test.sides.includes(s) ? s : 0 }; });
    const sig = days.filter((d) => d.s);
    const tr = simulate(sig, gold), tr2 = simulate(sig, gold, HOLD, { costX: 2 });
    out[w] = { from: iso(from), to: iso(to), eligible: days.length, signals: sig.length, ...summarize(tr, from, to, tr2) };
    if (w === 'oos') {
      out.trades = tr.map((x) => ({ sig: iso(x.sig), entry: iso(x.t), side: x.side, e: r2(x.e), risk: r2(x.risk), exit: r2(x.exit), kind: x.kind, gross: r3(x.gross), net: r3(x.net) }));
      if (seeds) {
        const sides = tr.map((x) => x.side), ts = [];
        for (let s = 1; s <= seeds; s++) ts.push(summarize(simulate(placeboDays(days, sides, rng(s)), gold), from, to).tMonth);
        const real = out.oos.tMonth, srt = [...ts].sort((a, b) => a - b);
        out.placebo = { seeds, draws: sides.length, t: ts, atLeastReal: ts.filter((t) => t != null && real != null && t >= real).length, below: ts.filter((t) => t != null && real != null && t < real).length, median: r2(srt[Math.floor(srt.length / 2)]), p5: r2(srt[1]), p95: r2(srt[38]) };
      }
    }
  }
  return out;
}

export function verdictOf(tests) {
  for (const t of tests) {
    const c1 = t.oos.tMonth != null && t.oos.tMonth >= 2 && t.holm < 0.05, c2 = t.is.netExact > 0, c3 = t.oos.x2 > 0, c4 = t.oos.n >= 30, c5 = t.placebo ? t.placebo.below >= 38 : false;
    t.checks = { oosTAndHolm: c1, isPositive: c2, x2Positive: c3, n30: c4, placebo38: c5 }; t.pass = c1 && c2 && c3 && c4 && c5;
  }
  if (tests.find((t) => t.id === 'T1').pass) return 'PASS';
  return tests.some((t) => t.pass) ? 'PARTIAL' : 'FAIL';
}

export function study(dir) {
  const gold = load(dir, 'xau'), fx = load(dir, 'eurchf');
  const first = dayOf(gold[ATR_N + 1].time);
  const rows = weekRows(gold, fx).filter((r) => r.t >= first);
  const tests = TESTS.map((t) => runTest(t, gold, rows));
  const ps = tests.map((t) => normP(t.oos.tMonth)), hs = holm(ps);
  tests.forEach((t, i) => { t.p = +ps[i].toPrecision(3); t.holm = +hs[i].toPrecision(3); });
  const verdict = verdictOf(tests);
  const base = [
    { id: 'B-long', sides: [1], what: 'unconditional long: every weekly signal day, the same hold, stop and costs', sideFn: () => 1 },
    { id: 'B-short', sides: [-1], what: 'unconditional short: every weekly signal day', sideFn: () => -1 },
    { id: 'B-own', sides: [1, -1], what: 'gold\'s own 20-day sign, both sides (does EUR/CHF add anything to gold\'s own trend?)', sideFn: (d) => (d.g > 0 ? 1 : d.g < 0 ? -1 : 0) },
  ].map((b) => { const r = runTest(b, gold, rows, { seeds: 0, sideFn: b.sideFn }); delete r.trades; return r; });
  // descriptive: signals by year and by side
  const byYear = {};
  for (const d of rows) { const y = new Date(d.t * 1000).getUTCFullYear(), s = sideOf(d.r); if (!s) continue; (byYear[y] ||= { long: 0, short: 0 })[s > 0 ? 'long' : 'short']++; }
  const span = (b) => ({ first: iso(b[0].time), last: iso(b[b.length - 1].time), days: b.length });
  return { data: { xau: span(gold), eurchf: span(fx), weeks: rows.length }, signalsByYear: byYear, tests, baselines: base, verdict };
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
    const out = { title: 'European stress read in EUR/CHF as a four-week lead for spot gold', built: new Date().toISOString().slice(0, 10), prereg: 'PREREGISTRATION.md', councilData: src,
      rule: { signal: `EUR/CHF return over its last ${LOOK} daily closes at gold's last candle of each week: <= -${THR * 100} % long gold, >= +${THR * 100} % short gold`, entry: 'open of the next gold candle on a later UTC day', stop: `${STOP_ATR} x ATR(${ATR_N}) of the gold candles before the entry`, exit: `close of the ${HOLD}th gold candle held`, costs: `$${RT.toFixed(2)} a round trip + nights() x FIN.xau.long on buys`, oneAtATime: true },
      fin: FIN.xau.long, inSample: '2007-01-01 to 2016-12-31', split: '2017-01-01', oosEnd: '2026-10-31', ...r };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    for (const t of [...r.tests, ...r.baselines]) {
      for (const w of ['is', 'oos']) { const x = t[w]; console.log(t.id, w, x.from, x.to, 'elig', x.eligible, 'sig', x.signals, 'n', x.n, `(${x.long}/${x.short})`, 'gross', x.gross, 'net', x.net, 'x2', x.x2, 'tMo', x.tMonth, 'tMoG', x.tMonthGross, 'win', x.win, 'stops', x.stops, 'cost', x.meanCost, 'share', x.costShare, 'medStop', x.medianStop, 'tot', x.total); }
      if (t.p != null) console.log(t.id, 'p', t.p, 'holm', t.holm, 'pass', t.pass, JSON.stringify(t.checks), 'placebo', JSON.stringify({ ...t.placebo, t: undefined }));
    }
    console.log('byYear', JSON.stringify(r.signalsByYear));
    console.log('VERDICT', r.verdict);
  } else console.log('usage: run.mjs fetch <dir> | full <dir>');
};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
