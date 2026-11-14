// One-week cross-sectional reversal in nine currencies against the dollar (pre-registered 14 Nov 2026, PREREGISTRATION.md).
// At each week's last trading day rank EUR GBP JPY AUD NZD CAD CHF SEK NOK (each as its value in USD) by the past 5-day return,
// buy the 2 that fell most and sell the 2 that rose most at the next open, 1R = stop = 2 x ATR(20), out at the next week's
// last close; R a week = sum of the four legs / 4; net of the raw-spread cost model and the demo broker's swaps.
// Loader, ATR, stop and statistics copied from the fx-xs-momentum study (branch fx-xs-momentum), not imported.
// Paper research only.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { foldWeekend, nights } from '../../../council/fills.mjs';

const ASSUMED_FIN = 4.0e-5;
// fin: rate a night as a fraction of price when LONG / SHORT the currency (positive = charge, negative = credit)
export const PAIRS = [
  { key: 'eurusd', ccy: 'EUR', inv: false, pip: 0.0001, spread: 0.3, slip: 0.15, fin: { long: 5.635e-5, short: -2.214e-5 } },
  { key: 'gbpusd', ccy: 'GBP', inv: false, pip: 0.0001, spread: 0.3, slip: 0.15, fin: { long: 1.355e-5, short: 1.537e-5 } },
  { key: 'usdjpy', ccy: 'JPY', inv: true, pip: 0.01, spread: 0.3, slip: 0.15, fin: { long: ASSUMED_FIN, short: ASSUMED_FIN } },
  { key: 'audusd', ccy: 'AUD', inv: false, pip: 0.0001, spread: 0.3, slip: 0.15, fin: { long: -6.053e-6, short: 4.03e-5 } },
  { key: 'nzdusd', ccy: 'NZD', inv: false, pip: 0.0001, spread: 0.3, slip: 0.15, fin: { long: ASSUMED_FIN, short: ASSUMED_FIN } },
  { key: 'usdcad', ccy: 'CAD', inv: true, pip: 0.0001, spread: 0.3, slip: 0.15, fin: { long: 6.195e-5, short: -1.535e-5 } },
  { key: 'usdchf', ccy: 'CHF', inv: true, pip: 0.0001, spread: 0.3, slip: 0.15, fin: { long: 1.567e-4, short: -5.21e-5 } },
  { key: 'usdsek', ccy: 'SEK', inv: true, pip: 0.0001, spread: 20, slip: 10, fin: { long: ASSUMED_FIN, short: ASSUMED_FIN } },
  { key: 'usdnok', ccy: 'NOK', inv: true, pip: 0.0001, spread: 20, slip: 10, fin: { long: ASSUMED_FIN, short: ASSUMED_FIN } },
];
export const P = { LOOK: 5, ATR_N: 20, ATR_MULT: 2, TOP: 2, COMM_RT: 0.000045, SEEDS: 40, MIN_WEEKS: 300 };
export const SCEN = { gross: { trade: 0, charge: 0, credit: 0 }, base: { trade: 1, charge: 1, credit: 1 }, x2: { trade: 2, charge: 2, credit: 1 } };
const DAY = 86400;
export const DECISIVE = { from: '2016-01-01', to: '9999-12-31' }, REPLICATION = { from: '0000-01-01', to: '2015-12-31' };
export const V2_CCYS = ['EUR', 'JPY', 'GBP', 'AUD'];

// ─── the series ───
export function invertBar(b) { return { time: b.time, open: 1 / b.open, high: 1 / b.low, low: 1 / b.high, close: 1 / b.close }; }
export function expressed(bars, inv) { return inv ? bars.map(invertBar) : bars.map((b) => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close })); }
export const rowsToBars = (rows) => rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
export function align(series) {
  const sets = series.map((s) => new Map(s.x.map((b, i) => [b.time, i])));
  const times = series[0].x.map((b) => b.time).filter((t) => sets.every((m) => m.has(t)));
  const X = {}, Q = {};
  series.forEach((s, k) => { X[s.ccy] = times.map((t) => s.x[sets[k].get(t)]); Q[s.ccy] = times.map((t) => s.q[sets[k].get(t)]); });
  return { times, X, Q };
}
export const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
// Monday-based week number of a unix time (1970-01-01 was a Thursday)
export const weekOf = (t) => Math.floor((Math.floor(t / DAY) + 3) / 7);
// indices of each week's last trading day
export function weekEnds(times) { const out = []; for (let i = 0; i < times.length; i++) if (i === times.length - 1 || weekOf(times[i + 1]) !== weekOf(times[i])) out.push(i); return out; }

// ─── the signal (closes up to and including day d only) ───
export function lookbackReturn(bars, d, n) { return d - n < 0 ? null : bars[d].close / bars[d - n].close - 1; }
// lowest past return first (the reversal buys the head of this list, sells its tail); ties by list order
export function rankAsc(X, ccys, d, n) {
  const r = ccys.map((c, k) => ({ c, k, r: lookbackReturn(X[c], d, n) }));
  if (r.some((x) => x.r == null || !Number.isFinite(x.r))) return null;
  return r.sort((a, b) => a.r - b.r || a.k - b.k).map((x) => x.c);
}
export const reversal = (ranked) => ({ long: ranked.slice(0, P.TOP), short: ranked.slice(-P.TOP) });
export function atr(bars, d, n = P.ATR_N) {
  if (d - n < 1) return null;
  let s = 0;
  for (let i = d - n + 1; i <= d; i++) { const b = bars[i], pc = bars[i - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}

// ─── one leg: entry at bars[e].open, stop at 1R, exit at bars[x].close or the stop (gap fill at the open) ───
export function simLeg(bars, e, x, side, dist) {
  const entry = bars[e].open, stop = side > 0 ? entry - dist : entry + dist;
  for (let i = e; i <= x; i++) {
    const b = bars[i];
    if (side > 0 && b.low <= stop) { const gap = i > e && b.open <= stop; return { entry, stop, exit: gap ? b.open : stop, exitIdx: i, how: gap ? 'gap' : 'stop' }; }
    if (side < 0 && b.high >= stop) { const gap = i > e && b.open >= stop; return { entry, stop, exit: gap ? b.open : stop, exitIdx: i, how: gap ? 'gap' : 'stop' }; }
  }
  return { entry, stop, exit: bars[x].close, exitIdx: x, how: 'close' };
}
// round-trip trading cost as a fraction of the pair's price (the same fraction in the quoted and the inverted series)
export function costFrac(pair, pairPx) { return ((pair.spread + 2 * pair.slip) * pair.pip) / pairPx + P.COMM_RT; }
export function exitTime(t, how) {
  if (how === 'gap') return t;
  if (how === 'stop') return t + DAY / 2;
  return new Date(t * 1000).getUTCDay() === 5 ? t + 20 * 3600 : t + DAY;
}
export function legResult(D, pair, e, x, side, dist) {
  const L = simLeg(D.X[pair.ccy], e, x, side, dist);
  const gross = (side * (L.exit - L.entry)) / dist;
  const costR = (costFrac(pair, D.Q[pair.ccy][e].open) * L.entry) / dist;
  const n = nights(D.times[e], exitTime(D.times[L.exitIdx], L.how));
  const rate = side > 0 ? pair.fin.long : pair.fin.short, finR = (n * rate * L.entry) / dist;
  return { ccy: pair.ccy, side, gross, costR, charge: Math.max(finR, 0), credit: Math.max(-finR, 0), nights: n, how: L.how };
}
export const legNet = (l, s = SCEN.base) => l.gross - s.trade * l.costR - s.charge * l.charge + s.credit * l.credit;

// ─── the book ───
// opts: { ccys, look, daily }; pick(ranked, k) -> { long, short }
export function runBook(D, pick, opts = {}) {
  const ccys = opts.ccys || PAIRS.map((p) => p.ccy), look = opts.look || P.LOOK;
  const byCcy = Object.fromEntries(PAIRS.map((p) => [p.ccy, p]));
  const dec = opts.daily ? D.times.map((_, i) => i) : weekEnds(D.times), weeks = [];
  for (let k = 0; k + 1 < dec.length; k++) {
    const d = dec[k], e = d + 1, x = opts.daily ? e : dec[k + 1];
    if (e >= D.times.length || x >= D.times.length) break;
    const ranked = rankAsc(D.X, ccys, d, look);
    if (!ranked) continue;
    const pk = pick(ranked, k), legs = [];
    let ok = true;
    for (const [cs, side] of [[pk.long, 1], [pk.short, -1]]) for (const c of cs) {
      const a = atr(D.X[c], d); if (!a) { ok = false; continue; }
      legs.push(legResult(D, byCcy[c], e, x, side, P.ATR_MULT * a));
    }
    if (!ok) continue;
    const per = (s) => legs.reduce((a, l) => a + legNet(l, s), 0) / legs.length;
    weeks.push({ exit: ymd(D.times[x]), long: pk.long, short: pk.short, legs, gross: per(SCEN.gross), net: per(SCEN.base), x2: per(SCEN.x2) });
  }
  return weeks;
}

// ─── statistics ───
export function stats(vals) {
  const n = vals.length; if (!n) return { n: 0 };
  const mean = vals.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  let cum = 0, peak = 0, dd = 0; for (const v of vals) { cum += v; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak); }
  const r = (v, k = 4) => +v.toFixed(k);
  return { n, mean: r(mean), total: r(cum, 2), t: sd ? r((mean / sd) * Math.sqrt(n), 2) : 0, dd: r(dd, 2), pos: r((vals.filter((v) => v > 0).length / n) * 100, 1) };
}
// calendar-month sums of weekly values (by exit month), in time order
export function monthSums(weeks, key = 'net') {
  const m = new Map(); for (const w of weeks) { const k = w.exit.slice(0, 7); m.set(k, (m.get(k) || 0) + w[key]); }
  return [...m.values()];
}
export const inWin = (w) => (x) => x.exit >= w.from && x.exit <= w.to;
export function percentile(vals, q) {
  const s = [...vals].sort((a, b) => a - b), h = (s.length - 1) * q, lo = Math.floor(h);
  return lo + 1 < s.length ? s[lo] + (h - lo) * (s[lo + 1] - s[lo]) : s[lo];
}
export function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function randomPick(rng, ccys = PAIRS.map((p) => p.ccy)) {
  return () => { const c = [...ccys]; for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; } return { long: c.slice(0, 2), short: c.slice(2, 4) }; };
}
function legStats(weeks) {
  const legs = weeks.flatMap((w) => w.legs), n = legs.length, avg = (f) => +(legs.reduce((s, l) => s + f(l), 0) / n).toFixed(4);
  return { n, win: +((legs.filter((l) => legNet(l) > 0).length / n) * 100).toFixed(1), stopped: +((legs.filter((l) => l.how !== 'close').length / n) * 100).toFixed(1), gaps: legs.filter((l) => l.how === 'gap').length, gross: avg((l) => l.gross), net: avg((l) => legNet(l)), cost: avg((l) => l.costR), finCharge: avg((l) => l.charge), finCredit: avg((l) => l.credit), nights: avg((l) => l.nights) };
}
export function windowSummary(weeks, w) {
  const ws = weeks.filter(inWin(w)), ms = (k) => stats(monthSums(ws, k));
  return { from: ws[0]?.exit, to: ws.at(-1)?.exit, weeks: ws.length, weekly: { gross: stats(ws.map((x) => x.gross)), net: stats(ws.map((x) => x.net)), x2: stats(ws.map((x) => x.x2)) }, monthly: { gross: ms('gross'), net: ms('net'), x2: ms('x2') }, legs: legStats(ws) };
}
function years(weeks) { const y = {}; for (const w of weeks) { const k = w.exit.slice(0, 4); y[k] = +((y[k] || 0) + w.net).toFixed(2); } return y; }
function drivers(weeks) {
  const o = {};
  for (const w of weeks) for (const l of w.legs) { const s = (o[l.ccy] ||= { long: { n: 0, net: 0, gross: 0 }, short: { n: 0, net: 0, gross: 0 } })[l.side > 0 ? 'long' : 'short']; s.n++; s.net += legNet(l) / 4; s.gross += l.gross / 4; }
  for (const c of Object.values(o)) for (const s of [c.long, c.short]) { s.net = +s.net.toFixed(2); s.gross = +s.gross.toFixed(2); }
  return o;
}

// ─── data ───
export function loadSeries(read) {
  return PAIRS.map((p) => { const q = foldWeekend(rowsToBars(JSON.parse(read(p.key)).rows)); return { ccy: p.ccy, q, x: expressed(q, p.inv) }; });
}
const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 << 20 });
const gitRead = (k) => git(['show', `origin/council-data:research/daily/${k}.json`]);

export function main(read = gitRead, commit = null) {
  const series = loadSeries(read), D = align(series);
  const res = { built: '2026-11-14', councilData: commit, data: { from: ymd(D.times[0]), to: ymd(D.times.at(-1)), days: D.times.length, src: 'council-data research/daily (OANDA mid, UTC daily), weekend stubs folded', flatCandles2008on: Object.fromEntries(series.map((s) => [s.ccy, s.q.filter((b) => b.time >= 1199145600 && b.high === b.low).length])) }, params: P, pairs: PAIRS };
  const book = runBook(D, reversal);
  const dec = windowSummary(book, DECISIVE), rep = windowSummary(book, REPLICATION);
  const plT = [], plMean = [];
  for (let seed = 1; seed <= P.SEEDS; seed++) {
    const ws = runBook(D, randomPick(mulberry32(seed))).filter(inWin(DECISIVE));
    plT.push(stats(monthSums(ws)).t); plMean.push(stats(ws.map((w) => w.net)).mean);
  }
  res.placebo = { seeds: P.SEEDS, t: { p5: +percentile(plT, 0.05).toFixed(2), p50: +percentile(plT, 0.5).toFixed(2), p95: +percentile(plT, 0.95).toFixed(2), max: Math.max(...plT) }, mean: { p5: +percentile(plMean, 0.05).toFixed(4), p50: +percentile(plMean, 0.5).toFixed(4), p95: +percentile(plMean, 0.95).toFixed(4) }, tAll: plT, beats: plT.filter((t) => t < dec.monthly.net.t).length };
  res.primary = { decisive: dec, replication: rep, years: years(book), driversDecisive: drivers(book.filter(inWin(DECISIVE))) };
  res.checks = { decisivePositive: dec.weekly.net.mean > 0, replicationPositive: rep.weekly.net.mean > 0, decisiveT2: dec.monthly.net.t >= 2, enoughWeeks: dec.weeks >= P.MIN_WEEKS, placebo: dec.monthly.net.t > res.placebo.t.p95 };
  res.verdict = Object.values(res.checks).every(Boolean) ? 'PASS' : 'FAIL';
  const V = (ws) => ({ decisive: windowSummary(ws, DECISIVE), replication: windowSummary(ws, REPLICATION) });
  res.variants = { daily: V(runBook(D, reversal, { daily: true, look: 1 })), fourCcy: V(runBook(D, reversal, { ccys: V2_CCYS })) };
  return res;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const r = main(gitRead, git(['rev-parse', 'origin/council-data']).trim());
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(r, null, 1) + '\n');
  const sh = (s) => JSON.stringify({ w: s.weeks, g: s.weekly.gross.mean, n: s.weekly.net.mean, tw: s.weekly.net.t, tm: s.monthly.net.t, tg: s.monthly.gross.t, x2: s.weekly.x2.mean, dd: s.weekly.net.dd, tot: s.weekly.net.total });
  console.log('dec', sh(r.primary.decisive), '\nrep', sh(r.primary.replication), '\nlegs', JSON.stringify(r.primary.decisive.legs));
  for (const [k, v] of Object.entries(r.variants)) console.log(k, sh(v.decisive), sh(v.replication));
  console.log('placebo', JSON.stringify(r.placebo.t), 'beats', r.placebo.beats, JSON.stringify(r.checks), r.verdict, r.data.from, r.data.to);
  console.log(JSON.stringify(r.primary.years)); console.log(JSON.stringify(r.primary.driversDecisive));
}
