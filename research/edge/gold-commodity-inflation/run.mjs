// Does a commodity-price impulse lead spot gold? (research/edge/gold-commodity-inflation; rules fixed in PREREGISTRATION.md)
// Basket of eight non-precious commodity CFDs (energy, grains, sugar, copper): its past month (T1), the part gold did not
// follow (T2) and its past quarter (T3) as a lead for gold over the next 20 candles, both sides.
// Paper research only: a stand-alone rule on gold, never a gate / entry / exit / size of the live gold book (decision 44).
//   node research/edge/gold-commodity-inflation/run.mjs fetch <dir>   copy the daily caches out of origin/council-data
//   node research/edge/gold-commodity-inflation/run.mjs full <dir>    run the study, write result.json next to this file
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FIN, nights, foldWeekend } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DAY = 86400;
export const LOOK = 52, Z = 1, ATR_N = 20, HOLD = 20, STOP_ATR = 3, STALE = 5, SPREAD = 0.30, SLIP = SPREAD / 2, SEEDS = 40, PLACEBO_NEED = 38;
export const RT = SPREAD + 2 * SLIP;   // $0.60 a round trip
export const BASKET = ['wtico', 'bco', 'natgas', 'corn', 'wheat', 'soybn', 'sugar', 'xcu'];
export const KEYS = ['xau', ...BASKET];
export const IS_FROM = Date.UTC(2007, 0, 1) / 1000;
export const SPLIT = Date.UTC(2017, 0, 1) / 1000;
export const OOS_END = Date.UTC(2026, 9, 31, 23, 59, 59) / 1000;
export const TESTS = [
  { id: 'T1', sig: 'z4', what: 'basket month impulse (4 weeks) beyond 1 sd: gold the same way for the next 20 candles (primary)' },
  { id: 'T2', sig: 'zr', what: 'basket month move gold did not follow (residual on gold, 4 weeks) beyond 1 sd: gold the same way' },
  { id: 'T3', sig: 'z13', what: 'basket quarter impulse (13 weeks) beyond 1 sd: gold the same way for the next 20 candles' },
];

// ── data ──
export const toBars = (j) => j.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
export const load = (dir, key) => foldWeekend(toBars(JSON.parse(fs.readFileSync(path.join(dir, key + '.json'), 'utf8'))));
export const dayOf = (t) => Math.floor(t / DAY) * DAY;
export const weekOf = (t) => { const d = dayOf(t), wd = (new Date(d * 1000).getUTCDay() + 6) % 7; return d - wd * DAY; };

// last close at or before day d, no older than STALE days
export function closeAt(bars, d) {
  let lo = 0, hi = bars.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (dayOf(bars[m].time) > d) hi = m; else lo = m + 1; }
  const b = bars[lo - 1];
  return b && d - dayOf(b.time) <= STALE * DAY && b.close > 0 ? b.close : null;
}
// weekly rows: b = mean basket log return, g = gold log return, between consecutive qualifying week ends
export function weeks(gold, mk) {
  const last = new Map();
  for (const x of gold) last.set(weekOf(x.time), x);
  const pts = [];
  for (const x of [...last.values()].sort((a, b) => a.time - b.time)) {
    const d = dayOf(x.time), v = BASKET.map((k) => closeAt(mk[k], d));
    if (v.every((c) => c != null)) pts.push({ t: d, gc: x.close, v });
  }
  const out = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], z = pts[i];
    out.push({ t: z.t, b: z.v.reduce((s, c, k) => s + Math.log(c / a.v[k]), 0) / BASKET.length, g: Math.log(z.gc / a.gc), brk: z.t - a.t > 14 * DAY });
  }
  return out;
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sdev = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
// signal rows; each uses only weeks at or before it (one unbroken history)
export function signals(wk, look = LOOK) {
  const out = []; let start = 0;
  for (let i = 0; i < wk.length; i++) {
    if (wk[i].brk) { start = i + 1; continue; }
    const row = { t: wk[i].t, i, z4: null, zr: null, z13: null };
    // T1: last 4 b, sd of the 52 before the oldest of them
    if (i - 3 - look >= start) {
      const sd = sdev(wk.slice(i - 3 - look, i - 3).map((p) => p.b)), s = wk.slice(i - 3, i + 1).reduce((a, p) => a + p.b, 0);
      if (sd > 0) row.z4 = s / (2 * sd);
    }
    // T3: last 13 b, sd of the 52 before the oldest
    if (i - 12 - look >= start) {
      const sd = sdev(wk.slice(i - 12 - look, i - 12).map((p) => p.b)), s = wk.slice(i - 12, i + 1).reduce((a, p) => a + p.b, 0);
      if (sd > 0) row.z13 = s / (Math.sqrt(13) * sd);
    }
    // T2: OLS of b on g over the 52 weeks before this week; residuals of the last 4 weeks under that fit
    if (i - look >= start && i - 3 >= start) {
      const w = wk.slice(i - look, i), bs = w.map((p) => p.b), gs = w.map((p) => p.g), mb = mean(bs), mg = mean(gs);
      let sxy = 0, sxx = 0; for (let k = 0; k < look; k++) { sxy += (gs[k] - mg) * (bs[k] - mb); sxx += (gs[k] - mg) ** 2; }
      const beta = sxx > 0 ? sxy / sxx : 0, alpha = mb - beta * mg, sdE = sdev(w.map((p) => p.b - alpha - beta * p.g));
      if (sdE > 0) row.zr = wk.slice(i - 3, i + 1).reduce((a, p) => a + p.b - alpha - beta * p.g, 0) / (2 * sdE);
      row.beta = beta;
    }
    out.push(row);
  }
  return out;
}
export const sideOf = (row, sig, z = Z) => (row[sig] == null ? 0 : row[sig] > z ? 1 : row[sig] < -z ? -1 : 0);

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
export function tradeAt(gold, j, side, hold = HOLD, stopAtr = STOP_ATR, costX = 1) {
  const atr = atrBefore(gold, j);
  if (!(atr > 0) || j + hold - 1 >= gold.length) return null;
  const risk = stopAtr * atr, e = gold[j].open, stop = e - side * risk;
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
export function simulate(days, gold, { costX = 1 } = {}) {
  const out = []; let lastK = -1;
  for (const d of days) {
    if (!d.s) continue;
    const j = entryIndex(gold, d.t); if (j < 0 || j <= lastK) continue;
    const tr = tradeAt(gold, j, d.s, HOLD, STOP_ATR, costX); if (!tr) continue;
    out.push({ ...tr, sig: d.t }); lastK = tr.k;
  }
  return out;
}

// ── statistics ──
export function stat(a) {
  const n = a.length; if (!n) return { n: 0, mean: null, t: null, sum: 0 };
  const m = mean(a), sd = n > 1 ? sdev(a) : 0;
  return { n, mean: m, sum: m * n, t: sd > 0 ? m / (sd / Math.sqrt(n)) : null };
}
const mk = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
export function monthly(rows, from, to, key) {
  const a = mk(from), b = mk(Math.max(to, ...rows.map((r) => r.c))), m = new Array(b - a + 1).fill(0);
  for (const r of rows) m[mk(r.c) - a] += r[key];
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
  const mo = trades.length ? monthly(trades, from, to, 'net') : { t: null, months: 0 }, mg = trades.length ? monthly(trades, from, to, 'gross') : { t: null };
  const side = (sd) => { const a = trades.filter((x) => x.side === sd); return { n: a.length, net: a.length ? r3(stat(a.map((x) => x.net)).mean) : null }; };
  const absG = trades.reduce((a, x) => a + Math.abs(x.gross), 0), costSum = trades.reduce((a, x) => a + x.cost, 0);
  return {
    n: s.n, longs: side(1), shorts: side(-1),
    win: s.n ? r3(trades.filter((x) => x.net > 0).length / s.n) : null, stops: trades.filter((x) => x.kind !== 'time').length,
    gross: r3(g.mean), net: r3(s.mean), netExact: s.mean == null ? null : +s.mean.toPrecision(4), total: r2(s.sum),
    x2: x2 ? r3(stat(x2.map((x) => x.net)).mean) : undefined,
    tMonth: r2(mo.t), tMonthGross: r2(mg.t), months: mo.months, tTrade: r2(s.t),
    meanCost: s.n ? r3(costSum / s.n) : null, costShare: absG > 0 ? r3(costSum / absG) : null,
    medianStop: s.n ? r2(median(trades.map((x) => x.risk))) : null,
  };
}

export function runTest(test, gold, rows, { seeds = SEEDS, end = OOS_END } = {}) {
  const first = gold[ATR_N + 1] ? dayOf(gold[ATR_N + 1].time) : Infinity;
  const ok = rows.filter((r) => r.t >= Math.max(first, IS_FROM) && r[test.sig] != null);
  const win = { is: [IS_FROM, SPLIT - 1], oos: [SPLIT, Math.min(end, dayOf(gold[gold.length - 1].time) + DAY - 1)] };
  const out = { id: test.id, sig: test.sig, hold: HOLD, stopAtr: STOP_ATR, what: test.what };
  for (const [w, [from, to]] of Object.entries(win)) {
    const days = ok.filter((d) => d.t >= from && d.t <= to).map((d) => ({ t: d.t, s: sideOf(d, test.sig) })), sig = days.filter((d) => d.s);
    const tr = simulate(sig, gold), tr2 = simulate(sig, gold, { costX: 2 });
    const base = (s) => summarize(simulate(days.map((d) => ({ t: d.t, s })), gold), from, to);
    const bl = base(1), bs = base(-1);
    out[w] = { from: iso(from), to: iso(to), eligible: days.length, signals: sig.length, ...summarize(tr, from, to, tr2),
      baseline: { long: { n: bl.n, net: bl.net, tMonth: bl.tMonth }, short: { n: bs.n, net: bs.net, tMonth: bs.tMonth } } };
    if (w === 'oos') {
      out.trades = tr.map((x) => ({ sig: iso(x.sig), entry: iso(x.t), side: x.side, e: r2(x.e), risk: r2(x.risk), exit: r2(x.exit), kind: x.kind, gross: r3(x.gross), net: r3(x.net) }));
      if (seeds) {
        const sides = tr.map((x) => x.side), ts = [];
        for (let s = 1; s <= seeds; s++) ts.push(summarize(simulate(placeboDays(days, sides, rng(s)), gold), from, to).tMonth);
        const real = out.oos.tMonth, srt = [...ts].sort((a, b) => a - b);
        out.placebo = { seeds, draws: sides.length, t: ts, beaten: ts.filter((t) => real != null && (t == null || real > t)).length, median: r2(srt[Math.floor(srt.length / 2)]), p5: r2(srt[1]), p95: r2(srt[38]) };
      }
    }
  }
  return out;
}

export function verdictOf(tests) {
  for (const t of tests) {
    const c1 = t.oos.tMonth != null && t.oos.tMonth >= 2 && t.holm < 0.05, c2 = t.is.netExact > 0, c3 = t.oos.x2 > 0, c4 = (t.placebo?.beaten ?? 0) >= PLACEBO_NEED, c5 = t.oos.n >= 30;
    t.checks = { oosTAndHolm: c1, isPositive: c2, x2Positive: c3, placebo38: c4, n30: c5 }; t.pass = c1 && c2 && c3 && c4 && c5;
  }
  if (tests.find((t) => t.id === 'T1').pass) return 'PASS';
  return tests.some((t) => t.pass) ? 'PARTIAL' : 'FAIL';
}

export function study(dir) {
  const gold = load(dir, 'xau'), mkts = Object.fromEntries(BASKET.map((k) => [k, load(dir, k)]));
  const wk = weeks(gold, mkts), rows = signals(wk);
  const tests = TESTS.map((t) => runTest(t, gold, rows));
  const ps = tests.map((t) => normP(t.oos.tMonth)), hs = holm(ps);
  tests.forEach((t, i) => { t.p = +ps[i].toPrecision(3); t.holm = +hs[i].toPrecision(3); });
  const verdict = verdictOf(tests);
  const span = (b) => ({ first: iso(b[0].time), last: iso(b[b.length - 1].time), days: b.length });
  return { data: { xau: span(gold), ...Object.fromEntries(Object.entries(mkts).map(([k, b]) => [k, span(b)])), weeks: wk.length }, tests, verdict };
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
    const out = { title: 'A broad commodity-price impulse (energy, grains, sugar, copper) as a lead for spot gold', built: '2026-11-14', prereg: 'PREREGISTRATION.md', councilData: src,
      rule: { basket: 'equal-weight mean of weekly log returns of ' + BASKET.join(', '), entry: `next gold daily open, held ${HOLD} candles, stop ${STOP_ATR} x ATR(${ATR_N})`, costs: `$${RT.toFixed(2)} a round trip + nights() x FIN.xau.long on longs`, oneAtATime: true },
      fin: FIN.xau.long, split: '2017-01-01', oosEnd: '2026-10-31', ...r };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    for (const t of r.tests) {
      for (const w of ['is', 'oos']) { const x = t[w]; console.log(t.id, w, x.from, x.to, 'elig', x.eligible, 'sig', x.signals, 'n', x.n, JSON.stringify(x.longs), JSON.stringify(x.shorts), 'gross', x.gross, 'net', x.net, 'x2', x.x2, 'tMo', x.tMonth, 'tMoG', x.tMonthGross, 'win', x.win, 'stops', x.stops, 'cost', x.meanCost, 'share', x.costShare, 'stop$', x.medianStop, 'base', JSON.stringify(x.baseline)); }
      console.log(t.id, 'p', t.p, 'holm', t.holm, 'pass', t.pass, JSON.stringify(t.checks), 'placebo', JSON.stringify({ ...t.placebo, t: undefined }));
    }
    console.log('VERDICT', r.verdict);
  } else console.log('usage: run.mjs fetch <dir> | full <dir>');
};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
