// Buy gold when platinum's own short trend is up and gold's is down (research/edge/gold-platinum-catchup; rules fixed in
// PREREGISTRATION.md). Signal: platinum close > its SMA20 and gold close < its SMA20 (T1); platinum OR silver above (T2).
// Long gold at the next open, stop 2 x ATR(20), out at the 5th close, one at a time. Judged against the same-side long on every
// day of the same year and a placebo of random gold-below-SMA20 days (same count per year).
// Paper research only: a stand-alone rule on gold, never a gate / entry / exit / size of the live gold book (decision 44).
//   node research/edge/gold-platinum-catchup/run.mjs fetch <dir>   copy the daily caches out of origin/council-data
//   node research/edge/gold-platinum-catchup/run.mjs full <dir>    run the study, write result.json next to this file
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FIN, nights, foldWeekend } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DAY = 86400;
export const N = 20, HOLD = 5, STOP_ATR = 2, ATR_N = 20, SPREAD = 0.30, SLIP = SPREAD / 2, SEEDS = 40, PLACEBO_NEED = 38;
export const RT = SPREAD + 2 * SLIP;   // $0.60 a round trip
export const KEYS = ['xau', 'xpt', 'xag'];
export const IS_START = Date.UTC(2007, 0, 1) / 1000;
export const SPLIT = Date.UTC(2017, 0, 1) / 1000;
export const OOS_END = Date.UTC(2026, 9, 31, 23, 59, 59) / 1000;
export const TESTS = [
  { id: 'T1', metals: ['xpt'], what: 'platinum close above its SMA20 and gold close below its SMA20: buy gold (primary)' },
  { id: 'T2', metals: ['xpt', 'xag'], what: 'platinum OR silver close above its SMA20 and gold close below its SMA20: buy gold' },
];

// ── data ──
export const toBars = (j) => j.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
export const load = (dir, key) => foldWeekend(toBars(JSON.parse(fs.readFileSync(path.join(dir, key + '.json'), 'utf8'))));
export const dayOf = (t) => Math.floor(t / DAY) * DAY;
export const yearOf = (t) => new Date(t * 1000).getUTCFullYear();

// per day: is the close above its own SMA(n), using the n closes up to and including that day
export function aboveMap(bars, n = N) {
  const mp = new Map(); let s = 0;
  bars.forEach((b, i) => { s += b.close; if (i >= n) s -= bars[i - n].close; if (i >= n - 1) mp.set(dayOf(b.time), b.close > s / n); });
  return mp;
}
// one row per gold day where gold and every metal of the test have a state: { t, goldUp, metalUp (any metal above) }
export function rows(gold, metals, n = N) {
  const gs = aboveMap(gold, n), ms = metals.map((b) => aboveMap(b, n)), out = [];
  for (const g of gold) {
    const d = dayOf(g.time); if (!gs.has(d) || ms.some((m) => !m.has(d))) continue;
    out.push({ t: d, goldUp: gs.get(d), metalUp: ms.some((m) => m.get(d)) });
  }
  return out;
}
export const isSignal = (r) => r.metalUp && !r.goldUp;

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
export function tradeAt(gold, j, hold = HOLD, stopAtr = STOP_ATR, costX = 1) {
  const atr = atrBefore(gold, j);
  if (!(atr > 0) || j + hold - 1 >= gold.length) return null;
  const risk = stopAtr * atr, e = gold[j].open, stop = e - risk;
  let exit = null, kind = 'time', k = j;
  for (; k < j + hold; k++) {
    const b = gold[k];
    if (k > j && b.open <= stop) { exit = b.open; kind = 'gap'; break; }
    if (b.low <= stop) { exit = stop; kind = 'stop'; break; }
  }
  if (exit == null) { k = j + hold - 1; exit = gold[k].close; }
  const t = dayOf(gold[j].time), c = exitStamp(dayOf(gold[k].time)), nn = nights(t, c);
  const gross = (exit - e) / risk, fin = nn * FIN.xau.long * e / risk, rt = RT / risk;
  return { t, c, j, k, e, stop, risk, exit, kind, nights: nn, gross, fin, cost: rt + fin, net: gross - costX * (rt + fin) };
}
// one at a time: signal days in time order; a signal while a trade is open is skipped
export function simulate(sigDays, gold, { costX = 1 } = {}) {
  const out = []; let lastK = -1;
  for (const t of sigDays) {
    const j = entryIndex(gold, t); if (j < 0 || j <= lastK) continue;
    const tr = tradeAt(gold, j, HOLD, STOP_ATR, costX); if (!tr) continue;
    out.push({ ...tr, sig: t }); lastK = tr.k;
  }
  return out;
}
// same-side baseline per calendar year: the long after EVERY eligible day of that year (overlap allowed)
export function yearBaseline(days, gold) {
  const by = {};
  for (const t of days) {
    const j = entryIndex(gold, t); if (j < 0) continue;
    const tr = tradeAt(gold, j); if (!tr) continue;
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
// placebo: per year, as many days as the real signal days, drawn from that year's gold-below-SMA20 days
export function placeboDays(pool, sigDays, r) {
  const need = {}, byY = {};
  for (const t of sigDays) need[yearOf(t)] = (need[yearOf(t)] || 0) + 1;
  for (const t of pool) (byY[yearOf(t)] ||= []).push(t);
  const out = [];
  for (const y of Object.keys(need).sort()) out.push(...shuffle(byY[y] || [], r).slice(0, need[y]));
  return out.sort((a, b) => a - b);
}

const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000), r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
export const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

export function summarize(trades, from, to, x2, base) {
  const s = stat(trades.map((x) => x.net)), g = stat(trades.map((x) => x.gross));
  const mo = trades.length ? monthly(trades, from, to, 'net') : { t: null, months: 0 }, mg = trades.length ? monthly(trades, from, to, 'gross') : { t: null };
  const cost = s.n ? stat(trades.map((x) => x.cost)).mean : null;
  const out = {
    n: s.n, win: s.n ? r3(trades.filter((x) => x.net > 0).length / s.n) : null, stops: trades.filter((x) => x.kind !== 'time').length,
    gross: r3(g.mean), net: r3(s.mean), netExact: s.mean == null ? null : +s.mean.toPrecision(4), total: r2(s.sum),
    x2: x2 ? r3(stat(x2.map((x) => x.net)).mean) : undefined,
    tMonth: r2(mo.t), tMonthGross: r2(mg.t), months: mo.months, tTrade: r2(s.t),
    meanCost: r3(cost), costShare: cost != null && g.mean ? r3(cost / Math.abs(g.mean)) : null,
    medianStop: s.n ? r2(median(trades.map((x) => x.risk))) : null,
  };
  if (base && trades.length) {
    const ex = trades.map((x) => ({ c: x.c, ex: x.net - (base[yearOf(x.sig)]?.net ?? 0) }));
    out.excess = r3(mean(ex.map((x) => x.ex))); out.tExcess = r2(monthly(ex, from, to, 'ex').t);
  }
  return out;
}

export function runTest(test, gold, metals, { seeds = SEEDS, end = OOS_END } = {}) {
  const rs = rows(gold, test.metals.map((k) => metals[k]));
  const win = { is: [IS_START, SPLIT - 1], oos: [SPLIT, Math.min(end, dayOf(gold[gold.length - 1].time) + DAY - 1)] };
  const out = { id: test.id, metals: test.metals, what: test.what };
  for (const [w, [from, to]] of Object.entries(win)) {
    const days = rs.filter((r) => r.t >= from && r.t <= to), sig = days.filter(isSignal).map((r) => r.t);
    const pool = days.filter((r) => !r.goldUp).map((r) => r.t);
    const base = yearBaseline(days.map((r) => r.t), gold);
    const tr = simulate(sig, gold), tr2 = simulate(sig, gold, { costX: 2 });
    out[w] = { from: iso(from), to: iso(to), eligible: days.length, signals: sig.length, goldBelowDays: pool.length, ...summarize(tr, from, to, tr2, base),
      baseline: Object.fromEntries(Object.entries(base).map(([y, b]) => [y, { n: b.n, net: r3(b.net) }])),
      baselineMean: r3(mean(Object.values(base).map((b) => b.net))) };
    if (w === 'oos') {
      out.trades = tr.map((x) => ({ sig: iso(x.sig), entry: iso(x.t), e: r2(x.e), risk: r2(x.risk), exit: r2(x.exit), kind: x.kind, gross: r3(x.gross), net: r3(x.net) }));
      if (seeds) {
        const realSig = tr.map((x) => x.sig), ts = [], nets = [];
        for (let s = 1; s <= seeds; s++) { const p = summarize(simulate(placeboDays(pool, realSig, rng(s)), gold), from, to); ts.push(p.tMonth); nets.push(p.net); }
        const real = out.oos.tMonth, srt = [...ts].sort((a, b) => a - b);
        out.placebo = { seeds, draws: realSig.length, t: ts, net: nets, beaten: ts.filter((t) => real != null && (t == null || real > t)).length, median: r2(srt[Math.floor(srt.length / 2)]), p5: r2(srt[1]), p95: r2(srt[38]), medianNet: r3(median(nets)) };
      }
    }
  }
  return out;
}

export function verdictOf(tests) {
  for (const t of tests) {
    const c1 = t.oos.tMonth != null && t.oos.tMonth >= 2 && t.holm < 0.05, c2 = t.is.netExact > 0, c3 = t.oos.x2 > 0, c4 = t.oos.excess > 0, c5 = (t.placebo?.beaten ?? 0) >= PLACEBO_NEED, c6 = t.oos.n >= 30;
    t.checks = { oosTAndHolm: c1, isPositive: c2, x2Positive: c3, beatsBaseline: c4, placebo38: c5, n30: c6 }; t.pass = c1 && c2 && c3 && c4 && c5 && c6;
  }
  if (tests.find((t) => t.id === 'T1').pass) return 'PASS';
  return tests.some((t) => t.pass) ? 'PARTIAL' : 'FAIL';
}

export function study(dir) {
  const gold = load(dir, 'xau'), metals = { xpt: load(dir, 'xpt'), xag: load(dir, 'xag') };
  const tests = TESTS.map((t) => runTest(t, gold, metals));
  const ps = tests.map((t) => normP(t.oos.tMonth)), hs = holm(ps);
  tests.forEach((t, i) => { t.p = +ps[i].toPrecision(3); t.holm = +hs[i].toPrecision(3); });
  const verdict = verdictOf(tests);
  const span = (b) => ({ first: iso(b[0].time), last: iso(b[b.length - 1].time), days: b.length });
  return { data: { xau: span(gold), xpt: span(metals.xpt), xag: span(metals.xag) }, tests, verdict };
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
    const out = { title: "Buy gold when platinum's own short trend is up and gold's is down", built: '2026-11-14', prereg: 'PREREGISTRATION.md', councilData: src,
      rule: { signal: `metal close > its SMA${N} and gold close < its SMA${N}`, entry: `next gold daily open, long only, stop ${STOP_ATR} x ATR(${ATR_N}), out at the ${HOLD}th close, one at a time`, costs: `$${RT.toFixed(2)} a round trip + nights() x FIN.xau.long x entry`, baseline: 'same-side long after every eligible day of the same calendar year', placebo: `${SEEDS} seeds: same signal count per year drawn from gold-below-SMA${N} days` },
      fin: FIN.xau.long, split: '2017-01-01', oosEnd: '2026-10-31', ...r };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    for (const t of r.tests) {
      for (const w of ['is', 'oos']) { const x = t[w]; console.log(t.id, w, JSON.stringify({ ...x, baseline: undefined })); }
      console.log(t.id, 'p', t.p, 'holm', t.holm, 'pass', t.pass, JSON.stringify(t.checks), 'placebo', JSON.stringify({ ...t.placebo, t: undefined, net: undefined }));
    }
    console.log('VERDICT', r.verdict);
  } else console.log('usage: run.mjs fetch <dir> | full <dir>');
};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
