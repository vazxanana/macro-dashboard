// Edge research · turn-of-month: the published turn-of-the-month effect on SPX500, US30 and NAS100 (PREREGISTRATION.md).
// Buy at the New York close of the month's second-to-last trading day, sell at the close of the next month's third; stop
// 2 x ATR(20) below the entry; costs and financing as stated. Tests on 2016-now: net return t >= 2, a 40-seed placebo of
// random four-day windows, turn days against the other days (Welch), Holm over the three markets.
//   node research/edge/turn-of-month/run.mjs <candleDir>     (the files fetch.mjs wrote; writes result.json beside this file)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { nyParts, cmeYear } from '../../../ict/calendar.mjs';

export const MARKETS = { spx500: { name: 'S&P 500 (SPX500)', cost: 0.0004 }, us30: { name: 'Dow 30 (US30)', cost: 0.0005 }, nas100: { name: 'Nasdaq 100 (NAS100)', cost: 0.0005 } };
export const PRIMARY = 'spx500';
export const FIN_ADD = 2.5;            // percent a year over the 2-year yield
export const ATR_N = 20, STOP_ATR = 2, HOLD = 4, SEEDS = 40, SEEDS_NEED = 38;
export const SPLIT = 2016, FIRST = 2008;
// NYSE closures that are not on the CME calendar's list (stated in the pre-registration)
export const SPECIAL = new Set(['2012-10-29', '2012-10-30', '2018-12-05', '2025-01-09']);
const NYSE_FROM_EARLY = new Set(['Martin Luther King Day', "Presidents' Day", 'Memorial Day', 'Juneteenth', 'Independence Day', 'Labor Day', 'Thanksgiving Day']);
const HALF = new Set(['Independence Day eve', 'Day after Thanksgiving', 'Christmas Eve']);

const ymdOf = (ms) => new Date(ms).toISOString().slice(0, 10);
export function dayKind(ymd) {
  const wd = new Date(ymd + 'T12:00:00Z').getUTCDay();
  if (wd === 0 || wd === 6) return 'closed';
  if (SPECIAL.has(ymd)) return 'closed';
  const Y = cmeYear(+ymd.slice(0, 4));
  if (Y.full.has(ymd)) return 'closed';
  const e = Y.early.get(ymd);
  if (e && NYSE_FROM_EARLY.has(e.name)) return 'closed';
  if (e && HALF.has(e.name)) return 'half';
  return 'open';
}
export const isTradingDay = (ymd) => dayKind(ymd) !== 'closed';
// every trading day from `from` to `to` (YYYY-MM-DD, inclusive)
export function tradingDays(from, to) {
  const out = [];
  for (let t = Date.parse(from + 'T12:00:00Z'); ymdOf(t) <= to; t += 86400e3) if (isTradingDay(ymdOf(t))) out.push(ymdOf(t));
  return out;
}
// the unix start of the H1 candle that ends at the day's close (16:00 New York, 13:00 on a half day)
export function closeCandle(ymd) {
  const hr = dayKind(ymd) === 'half' ? 12 : 15;
  const [y, m, d] = ymd.split('-').map(Number);
  for (const off of [4, 5]) { const t = Date.UTC(y, m - 1, d, hr + off) / 1000; const p = nyParts(t); if (p.ymd === ymd && p.min === hr * 60) return t; }
  throw new Error('no close candle for ' + ymd);
}
// turn-of-month labels: { ymd: { pos: k (1-based from the start), neg: -k (from the end) } }
export function labels(days) {
  const by = new Map();
  for (const d of days) { const k = d.slice(0, 7); if (!by.has(k)) by.set(k, []); by.get(k).push(d); }
  const out = {};
  for (const L of by.values()) L.forEach((d, i) => { out[d] = { pos: i + 1, neg: i - L.length }; });
  return out;
}
export const isTurn = (l) => l && (l.neg === -1 || l.pos <= 3);

// the New York days from H1 candles: close, and high / low of the candles after the previous close up to this close
export function buildDays(bars, days) {
  const at = new Map(bars.map((b, i) => [b[0], i]));
  const out = [];
  let prevEnd = null;
  for (const d of days) {
    const t = closeCandle(d), i = at.get(t);
    if (i == null) { out.push({ d, t, close: null }); prevEnd = null; continue; }
    let hi = -Infinity, lo = Infinity, j = i;
    for (; j >= 0 && (prevEnd == null ? j >= i - 23 : bars[j][0] > prevEnd); j--) { hi = Math.max(hi, bars[j][2]); lo = Math.min(lo, bars[j][3]); }
    out.push({ d, t, i, close: bars[i][4], hi, lo });
    prevEnd = t;
  }
  return out;
}
// ATR(n) of the n completed days before index k (true range against the previous close); null without n clean days
export function atrAt(D, k, n = ATR_N) {
  if (k - n < 1) return null;
  let s = 0;
  for (let j = k - n; j < k; j++) {
    const a = D[j], p = D[j - 1];
    if (a.close == null || p.close == null) return null;
    s += Math.max(a.hi - a.lo, Math.abs(a.hi - p.close), Math.abs(a.lo - p.close));
  }
  return s / n;
}
export function rateOf(dgs2) {
  return (ymd) => { let v = null; for (const [d, x] of dgs2) { if (d > ymd) break; v = x; } return v; };
}
const nights = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400e3);

// one long trade from day index e to day index x: stop checked on every H1 candle after the entry candle up to the exit candle
export function trade(bars, D, e, x, { cost, rate }) {
  const E = D[e], X = D[x];
  if (!E || !X || E.close == null || X.close == null) return null;
  const atr = atrAt(D, e);
  if (atr == null) return null;
  const entry = E.close, stop = entry - STOP_ATR * atr;
  let exit = X.close, exitD = X.d, how = 'time';
  for (let j = E.i + 1; j <= X.i; j++) {
    const b = bars[j];
    if (b[1] <= stop) { exit = b[1]; how = 'stop-gap'; exitD = nyParts(b[0] + 3600).ymd; break; }
    if (b[3] <= stop) { exit = stop; how = 'stop'; exitD = nyParts(b[0] + 3600).ymd; break; }
  }
  const r = rate(E.d), finPct = ((r == null ? 0 : Math.max(0, r)) + FIN_ADD) / 100 / 365 * nights(E.d, exitD);
  const gross = (exit - entry) / entry;
  return { entryD: E.d, exitD, entry, stop: +stop.toFixed(4), exit, how, gross: gross * 100, net: (gross - cost - finPct) * 100, fin: finPct * 100 };
}

export function stats(xs) {
  const n = xs.length; if (!n) return { n: 0, mean: null, sd: null, t: null };
  const mean = xs.reduce((a, b) => a + b, 0) / n, sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  return { n, mean, sd, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : null };
}
export function welch(a, b) {
  const A = stats(a), B = stats(b);
  return { diff: A.mean - B.mean, t: (A.mean - B.mean) / Math.sqrt(A.sd ** 2 / A.n + B.sd ** 2 / B.n) };
}
const erf = (x) => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
export const pOneSided = (t) => t == null ? 1 : 0.5 * (1 - erf(t / Math.SQRT2));
export function holm(ps) {
  const order = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = new Array(ps.length);
  let run = 0;
  order.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, p * (ps.length - k))); adj[i] = run; });
  return adj;
}
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// the rule's trades: entry at TD-2 of each month, exit at TD+3 of the next
export function ruleTrades(bars, D, L, opt) {
  const out = [], skipped = [];
  for (let k = 0; k < D.length; k++) {
    if (L[D[k].d].neg !== -2) continue;
    let x = k + 1; while (x < D.length && !(L[D[x].d].pos === 3 && D[x].d.slice(0, 7) !== D[k].d.slice(0, 7))) x++;
    if (x >= D.length) break;
    if (x - k !== HOLD) throw new Error('window is not four trading days at ' + D[k].d);
    const t = trade(bars, D, k, x, opt);
    if (t) out.push(t); else skipped.push(D[k].d);
  }
  return { trades: out, skipped };
}
const yr = (d) => +d.slice(0, 4);
const meanOf = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function placebo(bars, D, counts, opt, seed) {
  const R = rng(seed), byYear = new Map();
  D.forEach((x, k) => { if (k + HOLD < D.length) { const y = yr(x.d); if (!byYear.has(y)) byYear.set(y, []); byYear.get(y).push(k); } });
  const nets = [];
  for (const [y, n] of counts) {
    const K = byYear.get(y) || [];
    let got = 0, tries = 0;
    while (got < n && tries < n * 50) { tries++; const k = K[Math.floor(R() * K.length)]; const t = trade(bars, D, k, k + HOLD, opt); if (t) { nets.push(t.net); got++; } }
  }
  return nets;
}

const r3 = (x) => x == null ? null : +x.toFixed(3), r2 = (x) => x == null ? null : +x.toFixed(2);
function summ(ts) { const s = stats(ts.map((t) => t.net)), g = stats(ts.map((t) => t.gross)); return { n: s.n, net: r3(s.mean), t: r2(s.t), gross: r3(g.mean), tGross: r2(g.t), win: s.n ? r2(100 * ts.filter((t) => t.net > 0).length / s.n) : null, stops: ts.filter((t) => t.how !== 'time').length, total: r2(ts.reduce((a, t) => a + t.net, 0)) }; }

export function runMarket(bars, dgs2, key) {
  const first = nyParts(bars[0][0]).ymd, last = nyParts(bars.at(-1)[0]).ymd;
  const days = tradingDays(first, last), L = labels(tradingDays(first.slice(0, 7) + '-01', last.slice(0, 8) + '31'));
  const D = buildDays(bars, days), opt = { cost: MARKETS[key].cost, rate: rateOf(dgs2) };
  const { trades, skipped } = ruleTrades(bars, D, L, opt);
  const inWin = (t, a, b) => yr(t.entryD) >= a && yr(t.entryD) <= b;
  const IS = trades.filter((t) => inWin(t, FIRST, SPLIT - 1)), OOS = trades.filter((t) => inWin(t, SPLIT, 9999));
  // T2
  const counts = new Map(); for (const t of OOS) counts.set(yr(t.entryD), (counts.get(yr(t.entryD)) || 0) + 1);
  const ruleMean = meanOf(OOS.map((t) => t.net));
  const seeds = [];
  for (let s = 1; s <= SEEDS; s++) { const p = placebo(bars, D.filter((x) => yr(x.d) >= SPLIT - 1), counts, opt, s); seeds.push(r3(meanOf(p))); }
  const beaten = seeds.filter((m) => ruleMean > m).length;
  // T3: daily close-to-close returns, before costs
  const daily = (a, b) => { const turn = [], rest = []; for (let k = 1; k < D.length; k++) { const x = D[k], p = D[k - 1]; if (yr(x.d) < a || yr(x.d) > b || x.close == null || p.close == null) continue; (isTurn(L[x.d]) ? turn : rest).push(100 * (x.close / p.close - 1)); } const w = welch(turn, rest); return { turnN: turn.length, turnMean: r3(stats(turn).mean), restN: rest.length, restMean: r3(stats(rest).mean), diff: r3(w.diff), t: r2(w.t) }; };
  const o = summ(OOS);
  return {
    name: MARKETS[key].name, cost: MARKETS[key].cost, candles: bars.length, from: first, to: last, skipped,
    is: summ(IS), oos: o, byYear: Object.fromEntries([...new Set(trades.map((t) => yr(t.entryD)))].filter((y) => y >= FIRST).map((y) => [y, summ(trades.filter((t) => yr(t.entryD) === y))])),
    placebo: { seeds, ruleMean: r3(ruleMean), beaten, need: SEEDS_NEED, median: r3([...seeds].sort((a, b) => a - b)[SEEDS / 2]) },
    daysIS: daily(FIRST, SPLIT - 1), daysOOS: daily(SPLIT, 9999),
    pOne: pOneSided(o.t), trades: trades.filter((t) => yr(t.entryD) >= FIRST).map((t) => [t.entryD, t.exitD, t.how, r3(t.gross), r3(t.net)]),
  };
}

export function verdictOf(M) {
  const keys = Object.keys(MARKETS), adj = holm(keys.map((k) => M[k].pOne));
  const checks = {};
  keys.forEach((k, i) => { const m = M[k]; checks[k] = { t1: m.oos.net > 0 && m.oos.t >= 2, t2: m.placebo.beaten >= SEEDS_NEED, t3: m.daysOOS.diff > 0 && m.daysOOS.t >= 2, holmP: +adj[i].toFixed(4) }; checks[k].pass = checks[k].t1 && checks[k].t2 && checks[k].t3 && adj[i] < 0.05; });
  return { verdict: checks[PRIMARY].pass ? 'PASS' : 'FAIL', checks };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candleDir>');
  const here = path.dirname(new URL(import.meta.url).pathname);
  const rates = JSON.parse(fs.readFileSync(path.join(here, 'rates.json'), 'utf8'));
  const M = {};
  for (const k of Object.keys(MARKETS)) {
    const bars = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${k}-1h.json.gz`))));
    M[k] = runMarket(bars, rates.DGS2, k);
    console.log(k, JSON.stringify(M[k].oos), 'placebo', M[k].placebo.beaten, 'days', JSON.stringify(M[k].daysOOS));
  }
  const v = verdictOf(M);
  const out = { built: '2026-11-13', study: 'turn-of-month', title: 'The turn-of-the-month effect on US indices, out of sample', verdict: v.verdict, checks: v.checks,
    data: { src: 'OANDA mid H1 via the site candle proxy (fetch.mjs); 2-year yield FRED DGS2 weekly (rates.json)', costs: Object.fromEntries(Object.entries(MARKETS).map(([k, m]) => [k, m.cost])), financing: `DGS2 + ${FIN_ADD}% a year, calendar nights` },
    markets: M };
  fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(v.verdict, JSON.stringify(v.checks));
}
