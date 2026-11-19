// Gold's place among the four precious metals by 20-day return (research/edge/gold-metals-rank; rules fixed in
// PREREGISTRATION.md). Rank = how many of silver / platinum / palladium have a higher 20-day return than gold on the common day.
// T1 gold last -> buy, T2 gold first -> sell, T3 gold first -> buy. Next open, stop 2 x ATR(20), out at the 5th close, one at a
// time. Judged against the same-side trade after every common day of the same year, a placebo of random days of the same year,
// and a control that shuffles the other metals' 20-day returns across days of the same year (gold's own path unchanged).
// Paper research only: a stand-alone rule on gold, never a gate / entry / exit / size of the live gold book (decision 44).
//   node research/edge/gold-metals-rank/run.mjs fetch <dir>   copy the daily caches out of origin/council-data
//   node research/edge/gold-metals-rank/run.mjs full <dir>    run the study, write result.json next to this file
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FIN, nights, foldWeekend } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DAY = 86400;
export const LOOK = 20, HOLD = 5, STOP_ATR = 2, ATR_N = 20, SPREAD = 0.30, SLIP = SPREAD / 2, SEEDS = 40, NEED = 38, MIN_N = 100;
export const RT = SPREAD + 2 * SLIP;   // $0.60 a round trip
export const KEYS = ['xau', 'xag', 'xpt', 'xpd'];
export const IS_START = Date.UTC(2007, 0, 1) / 1000;
export const SPLIT = Date.UTC(2017, 0, 1) / 1000;
export const OOS_END = Date.UTC(2026, 9, 31, 23, 59, 59) / 1000;
export const TESTS = [
  { id: 'T1', rank: 3, side: 1, what: 'gold last of the four by 20-day return: buy gold (primary)' },
  { id: 'T2', rank: 0, side: -1, what: 'gold first of the four by 20-day return: sell gold' },
  { id: 'T3', rank: 0, side: 1, what: 'gold first of the four by 20-day return: buy gold' },
];

// ── data ──
export const toBars = (j) => j.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
export const load = (dir, key) => foldWeekend(toBars(JSON.parse(fs.readFileSync(path.join(dir, key + '.json'), 'utf8'))));
export const dayOf = (t) => Math.floor(t / DAY) * DAY;
export const yearOf = (t) => new Date(t * 1000).getUTCFullYear();

// one row per common day with 20 earlier common days: { t, g (gold R20), o: [silver, platinum, palladium R20] }
export function returns(series, look = LOOK) {
  const maps = series.map((b) => new Map(b.map((x) => [dayOf(x.time), x.close])));
  const days = [...maps[0].keys()].filter((d) => maps.every((m) => m.has(d))).sort((a, b) => a - b), out = [];
  for (let i = look; i < days.length; i++) {
    const r = maps.map((m) => m.get(days[i]) / m.get(days[i - look]) - 1);
    out.push({ t: days[i], g: r[0], o: r.slice(1) });
  }
  return out;
}
export const rankOf = (g, o) => o.filter((x) => x > g).length;   // 0 = gold first, 3 = gold last

// ── trade ──
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
export function tradeAt(gold, j, side, costX = 1, hold = HOLD) {
  const atr = atrBefore(gold, j);
  if (!(atr > 0) || j + hold - 1 >= gold.length) return null;
  const risk = STOP_ATR * atr, e = gold[j].open, stop = e - side * risk;
  let exit = null, kind = 'time', k = j;
  for (; k < j + hold; k++) {
    const b = gold[k];
    if (k > j && side * (b.open - stop) <= 0) { exit = b.open; kind = 'gap'; break; }
    if (side > 0 ? b.low <= stop : b.high >= stop) { exit = stop; kind = 'stop'; break; }
  }
  if (exit == null) { k = j + hold - 1; exit = gold[k].close; }
  const t = dayOf(gold[j].time), c = exitStamp(dayOf(gold[k].time)), nn = nights(t, c);
  const gross = side * (exit - e) / risk, fin = side > 0 ? nn * FIN.xau.long * e / risk : 0, rt = RT / risk;
  return { t, c, j, k, e, stop, risk, exit, kind, nights: nn, gross, fin, cost: rt + fin, net: gross - costX * (rt + fin) };
}
export function simulate(sigDays, gold, side, { costX = 1 } = {}) {
  const out = []; let lastK = -1;
  for (const t of sigDays) {
    const j = entryIndex(gold, t); if (j < 0 || j <= lastK) continue;
    const tr = tradeAt(gold, j, side, costX); if (!tr) continue;
    out.push({ ...tr, sig: t }); lastK = tr.k;
  }
  return out;
}
export function yearBaseline(days, gold, side) {
  const by = {};
  for (const t of days) {
    const j = entryIndex(gold, t); if (j < 0) continue;
    const tr = tradeAt(gold, j, side); if (!tr) continue;
    (by[yearOf(t)] ||= []).push(tr.net);
  }
  return Object.fromEntries(Object.entries(by).map(([y, a]) => [y, { n: a.length, net: a.reduce((x, z) => x + z, 0) / a.length }]));
}

// ── statistics ──
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sdev = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
export function stat(a) {
  const n = a.length; if (!n) return { n: 0, mean: null, t: null, sum: 0 };
  const m = mean(a), sd = n > 1 ? sdev(a) : 0;
  return { n, mean: m, sum: m * n, t: sd > 0 ? m / (sd / Math.sqrt(n)) : null };
}
const mk = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
export function monthly(rowsIn, from, to, key) {
  const a = mk(from), b = mk(Math.max(to, ...rowsIn.map((r) => r.c))), m = new Array(b - a + 1).fill(0);
  for (const r of rowsIn) m[mk(r.c) - a] += r[key];
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
// placebo: per year, as many days as the real entries, drawn from that year's common days
export function placeboDays(pool, sigDays, r) {
  const need = {}, byY = {};
  for (const t of sigDays) need[yearOf(t)] = (need[yearOf(t)] || 0) + 1;
  for (const t of pool) (byY[yearOf(t)] ||= []).push(t);
  const out = [];
  for (const y of Object.keys(need).sort()) out.push(...shuffle(byY[y] || [], r).slice(0, need[y]));
  return out.sort((a, b) => a - b);
}
// control: within each year the other metals' R20 triplets are shuffled across days; gold's own R20 stays on its day
export function controlRows(rs, r) {
  const byY = {}; for (const x of rs) (byY[yearOf(x.t)] ||= []).push(x);
  const out = [];
  for (const y of Object.keys(byY).sort()) { const a = byY[y], o = shuffle(a.map((x) => x.o), r); a.forEach((x, i) => out.push({ t: x.t, g: x.g, o: o[i] })); }
  return out;
}

const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000), r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
export const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

export function excessT(trades, from, to, base) {
  if (!trades.length) return { excess: null, tExcess: null };
  const ex = trades.map((x) => ({ c: x.c, ex: x.net - (base[yearOf(x.sig)]?.net ?? 0) }));
  return { excess: mean(ex.map((x) => x.ex)), tExcess: monthly(ex, from, to, 'ex').t };
}
export function summarize(trades, from, to, x2, base) {
  const s = stat(trades.map((x) => x.net)), g = stat(trades.map((x) => x.gross));
  const mo = trades.length ? monthly(trades, from, to, 'net') : { t: null, months: 0 }, mg = trades.length ? monthly(trades, from, to, 'gross') : { t: null };
  const cost = s.n ? stat(trades.map((x) => x.cost)).mean : null, ex = excessT(trades, from, to, base);
  return {
    n: s.n, win: s.n ? r3(trades.filter((x) => x.net > 0).length / s.n) : null, stops: trades.filter((x) => x.kind !== 'time').length,
    gross: r3(g.mean), net: r3(s.mean), netExact: s.mean == null ? null : +s.mean.toPrecision(4), total: r2(s.sum),
    x2: x2 ? r3(stat(x2.map((x) => x.net)).mean) : undefined,
    tMonth: r2(mo.t), tMonthGross: r2(mg.t), months: mo.months, tTrade: r2(s.t),
    excess: r3(ex.excess), excessExact: ex.excess == null ? null : +ex.excess.toPrecision(4), tExcess: r2(ex.tExcess),
    meanCost: r3(cost), medianStop: s.n ? r2(median(trades.map((x) => x.risk))) : null,
  };
}

export function runTest(test, gold, rs, { seeds = SEEDS, end = OOS_END } = {}) {
  const win = { is: [IS_START, SPLIT - 1], oos: [SPLIT, Math.min(end, dayOf(gold[gold.length - 1].time) + DAY - 1)] };
  const out = { id: test.id, rank: test.rank, side: test.side, what: test.what };
  for (const [w, [from, to]] of Object.entries(win)) {
    const days = rs.filter((r) => r.t >= from && r.t <= to), all = days.map((r) => r.t);
    const sig = days.filter((r) => rankOf(r.g, r.o) === test.rank).map((r) => r.t);
    const base = yearBaseline(all, gold, test.side);
    const tr = simulate(sig, gold, test.side), tr2 = simulate(sig, gold, test.side, { costX: 2 });
    out[w] = { from: iso(from), to: iso(to), eligible: days.length, signals: sig.length, ...summarize(tr, from, to, tr2, base),
      baseline: Object.fromEntries(Object.entries(base).map(([y, b]) => [y, { n: b.n, net: r3(b.net) }])),
      baselineMean: r3(mean(Object.values(base).map((b) => b.net))) };
    if (w === 'oos') {
      out.trades = tr.map((x) => ({ sig: iso(x.sig), entry: iso(x.t), e: r2(x.e), risk: r2(x.risk), exit: r2(x.exit), kind: x.kind, gross: r3(x.gross), net: r3(x.net) }));
      if (seeds) {
        const real = out.oos.tExcess, realSig = tr.map((x) => x.sig);
        const pl = [], plEx = [], co = [], coEx = [], coN = [];
        for (let s = 1; s <= seeds; s++) {
          const p = excessT(simulate(placeboDays(all, realSig, rng(s)), gold, test.side), from, to, base);
          pl.push(r2(p.tExcess)); plEx.push(r3(p.excess));
          const cr = controlRows(days, rng(1000 + s)), csig = cr.filter((r) => rankOf(r.g, r.o) === test.rank).map((r) => r.t).sort((a, b) => a - b);
          const ct = simulate(csig, gold, test.side), c = excessT(ct, from, to, base);
          co.push(r2(c.tExcess)); coEx.push(r3(c.excess)); coN.push(ct.length);
        }
        const beat = (arr) => arr.filter((t) => real != null && (t == null || real > t)).length;
        const pack = (ts, exs) => { const srt = [...ts].sort((a, b) => a - b); return { t: ts, excess: exs, beaten: beat(ts), median: srt[Math.floor(srt.length / 2)], p5: srt[1], p95: srt[38], medianExcess: r3(median(exs)) }; };
        out.placebo = { seeds, draws: realSig.length, ...pack(pl, plEx) };
        out.control = { seeds, what: 'other metals\' R20 triplets shuffled across days of the same year', n: coN, ...pack(co, coEx) };
      }
    }
  }
  return out;
}

export function verdictOf(tests) {
  for (const t of tests) {
    const c = {
      oosTAndHolm: t.oos.tExcess != null && t.oos.tExcess >= 2 && t.holm < 0.05,
      isExcessPositive: t.is.excessExact > 0,
      x2Positive: t.oos.x2 > 0,
      placebo38: (t.placebo?.beaten ?? 0) >= NEED,
      control38: (t.control?.beaten ?? 0) >= NEED,
      n100: t.oos.n >= MIN_N,
    };
    t.checks = c; t.pass = Object.values(c).every(Boolean);
  }
  if (tests.find((t) => t.id === 'T1').pass) return 'PASS';
  return tests.some((t) => t.pass) ? 'PARTIAL' : 'FAIL';
}

export function study(dir) {
  const series = KEYS.map((k) => load(dir, k)), gold = series[0], rs = returns(series);
  const tests = TESTS.map((t) => runTest(t, gold, rs));
  const ps = tests.map((t) => normP(t.oos.tExcess)), hs = holm(ps);
  tests.forEach((t, i) => { t.p = +ps[i].toPrecision(3); t.holm = +hs[i].toPrecision(3); });
  const verdict = verdictOf(tests);
  const span = (b) => ({ first: iso(b[0].time), last: iso(b[b.length - 1].time), days: b.length });
  return { data: Object.fromEntries(KEYS.map((k, i) => [k, span(series[i])])), commonDays: rs.length, tests, verdict };
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
    const out = { title: "Gold's place among the four precious metals by 20-day return", built: '2026-11-14', prereg: 'PREREGISTRATION.md', councilData: src,
      rule: { signal: `rank of gold's ${LOOK}-day return among xau / xag / xpt / xpd on a common day`, entry: `next gold daily open, stop ${STOP_ATR} x ATR(${ATR_N}), out at the ${HOLD}th close, one at a time`, costs: `$${RT.toFixed(2)} a round trip + nights() x FIN.xau.long x entry on buys`, baseline: 'same-side trade after every common day of the same calendar year', placebo: `${SEEDS} seeds: same entry count per year drawn from that year's common days`, control: `${SEEDS} seeds: other metals' ${LOOK}-day returns shuffled across days of the same year` },
      fin: FIN.xau.long, split: '2017-01-01', oosEnd: '2026-10-31', ...r };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    for (const t of r.tests) {
      for (const w of ['is', 'oos']) { const x = t[w]; console.log(t.id, w, JSON.stringify({ ...x, baseline: undefined })); }
      console.log(t.id, 'p', t.p, 'holm', t.holm, 'pass', t.pass, JSON.stringify(t.checks));
      console.log('  placebo', JSON.stringify({ ...t.placebo, t: undefined, excess: undefined }), '\n  control', JSON.stringify({ ...t.control, t: undefined, excess: undefined, n: undefined }), 'ctrl n median', median(t.control.n));
    }
    console.log('VERDICT', r.verdict);
  } else console.log('usage: run.mjs fetch <dir> | full <dir>');
};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
