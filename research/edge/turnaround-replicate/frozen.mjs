// Edge research · turnaround-tuesday: buy SPX500 / NAS100 at the New York close of a down "Monday" (the first trading day of
// the week), sell at the next trading day's close (PREREGISTRATION.md). R1 = any down Monday, R2 = down more than 1 %. Stop
// 2 x ATR(20) below the entry; costs and one (or more, over a holiday) night of financing; results in R. Four cells (2 markets x
// 2 rules), each judged on 2016-now: net R t >= 2 with Holm over the 4, n, the same sign on 2008-15, the rule's Tuesdays against
// all Tuesdays (Welch), a 40-seed placebo of random down days.
// Calendar, close, ATR, stop, cost and statistics code copied from the pre-holiday study (branch pre-holiday, not on main).
//   node research/edge/turnaround-tuesday/run.mjs <candleDir>   (the files fetch.mjs wrote; writes result.json beside this file)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { nyParts, cmeYear } from '../../../ict/calendar.mjs';

export const MARKETS = { spx500: { name: 'S&P 500 (SPX500)', cost: 0.0004 }, nas100: { name: 'Nasdaq 100 (NAS100)', cost: 0.0005 } };
export const RULES = { r1: { name: 'R1 any down Monday', drop: 0, minN: 100 }, r2: { name: 'R2 Monday down more than 1 %', drop: -0.01, minN: 30 } };
export const FIN_ADD = 2.5;            // percent a year over the 2-year yield
export const ATR_N = 20, STOP_ATR = 2, SEEDS = 40, SEEDS_NEED = 38;
export const SPLIT = 2016, FIRST = 2008;
export const SPECIAL = new Set(['2012-10-29', '2012-10-30', '2018-12-05', '2025-01-09']);
const NYSE_FROM_EARLY = new Set(['Martin Luther King Day', "Presidents' Day", 'Memorial Day', 'Juneteenth', 'Independence Day', 'Labor Day', 'Thanksgiving Day']);
const HALF = new Set(['Independence Day eve', 'Day after Thanksgiving', 'Christmas Eve']);

const ymdOf = (ms) => new Date(ms).toISOString().slice(0, 10);
const yr = (d) => +d.slice(0, 4);
export function dayKind(ymd) {
  const wd = new Date(ymd + 'T12:00:00Z').getUTCDay();
  if (wd === 0 || wd === 6) return 'weekend';
  if (SPECIAL.has(ymd)) return 'special';
  const Y = cmeYear(yr(ymd));
  if (Y.full.has(ymd)) return 'holiday';
  const e = Y.early.get(ymd);
  if (e && NYSE_FROM_EARLY.has(e.name)) return 'holiday';
  if (e && HALF.has(e.name)) return 'half';
  return 'open';
}
export const isTradingDay = (ymd) => { const k = dayKind(ymd); return k === 'open' || k === 'half'; };
const eachDay = (from, to, f) => { for (let t = Date.parse(from + 'T12:00:00Z'); ymdOf(t) <= to; t += 86400e3) f(ymdOf(t)); };
export function tradingDays(from, to) { const out = []; eachDay(from, to, (d) => { if (isTradingDay(d)) out.push(d); }); return out; }
// the Monday (New York date) of the calendar week holding ymd
export const weekOf = (ymd) => { const t = Date.parse(ymd + 'T12:00:00Z'), wd = (new Date(t).getUTCDay() + 6) % 7; return ymdOf(t - wd * 86400e3); };
// indexes into days: m = M, the first trading day of each calendar week, x = T, the next trading day (same week); a week
// whose only trading day is M has no T and is skipped (PREREGISTRATION).
export function weekPairs(days) {
  const out = [];
  for (let k = 1; k + 1 < days.length; k++) {
    const w = weekOf(days[k]);
    if (weekOf(days[k - 1]) === w) continue;           // not the first trading day of its week
    if (weekOf(days[k + 1]) !== w) continue;           // only one trading day that week
    out.push({ m: k, x: k + 1 });
  }
  return out;
}
export function closeCandle(ymd) {
  const hr = dayKind(ymd) === 'half' ? 12 : 15;
  const [y, m, d] = ymd.split('-').map(Number);
  for (const off of [4, 5]) { const t = Date.UTC(y, m - 1, d, hr + off) / 1000; const p = nyParts(t); if (p.ymd === ymd && p.min === hr * 60) return t; }
  throw new Error('no close candle for ' + ymd);
}
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
export const nights = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400e3);
// the day's close-to-close change (fraction), null without both closes
export const dayChg = (D, k) => (k >= 1 && D[k].close != null && D[k - 1].close != null) ? D[k].close / D[k - 1].close - 1 : null;

export function trade(bars, D, e, x, { cost, rate }) {
  const E = D[e], X = D[x];
  if (!E || !X || E.close == null || X.close == null) return null;
  const atr = atrAt(D, e);
  if (atr == null || !(atr > 0)) return null;
  const entry = E.close, risk = STOP_ATR * atr, stop = entry - risk;
  let exit = X.close, exitD = X.d, how = 'time';
  for (let j = E.i + 1; j <= X.i; j++) {
    const b = bars[j];
    if (b[1] <= stop) { exit = b[1]; how = 'stop-gap'; break; }
    if (b[3] <= stop) { exit = stop; how = 'stop'; break; }
  }
  const r = rate(E.d), finShare = ((r == null ? 0 : Math.max(0, r)) + FIN_ADD) / 100 / 365 * nights(E.d, exitD);
  const gross = (exit - entry) / entry;
  return { entryD: E.d, exitD, entry, stop, exit, how, nights: nights(E.d, exitD),
    gross: gross * 100, net: (gross - cost - finShare) * 100, fin: finShare * 100,
    grossR: (exit - entry) / risk, R: (exit - entry - (cost + finShare) * entry) / risk };
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
const meanOf = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const r3 = (x) => x == null ? null : +x.toFixed(3), r2 = (x) => x == null ? null : +x.toFixed(2);
export const ruleOn = (chg, drop) => chg != null && (drop === 0 ? chg < 0 : chg < drop);

// One market: both rules. bars = H1 candles, days = the shared trading-day list
export function cellsFor(k, bars, days, rate) {
  const D = buildDays(bars, days), pairs = weekPairs(days), opt = { cost: MARKETS[k].cost, rate };
  const isW = (d) => yr(d) >= FIRST && yr(d) < SPLIT, oosW = (d) => yr(d) >= SPLIT;
  const summ = (ts) => { const s = stats(ts.map((t) => t.R)), g = stats(ts.map((t) => t.grossR)), pc = stats(ts.map((t) => t.net));
    return { n: s.n, R: r3(s.mean), t: r2(s.t), grossR: r3(g.mean), tGross: r2(g.t), netPct: r3(pc.mean), win: s.n ? r2(100 * ts.filter((t) => t.R > 0).length / s.n) : null, stops: ts.filter((t) => t.how !== 'time').length, totalR: r2(ts.reduce((a, t) => a + t.R, 0)) }; };
  // all T days: close(M) -> close(T) before costs, %
  const allT = (inW) => pairs.filter((p) => inW(days[p.m])).map((p) => { const a = D[p.m].close, b = D[p.x].close; return a != null && b != null ? 100 * (b / a - 1) : null; }).filter((v) => v != null);
  const out = {};
  for (const [rk, rule] of Object.entries(RULES)) {
    const trades = [], skipped = [], entryIdx = new Set(), ruleT = { is: [], oos: [] };
    for (const p of pairs) {
      const d = days[p.m];
      if (yr(d) < FIRST) continue;
      if (!ruleOn(dayChg(D, p.m), rule.drop)) continue;
      entryIdx.add(p.m);
      const t = trade(bars, D, p.m, p.x, opt);
      if (!t) { skipped.push(d); continue; }
      trades.push(t);
      (oosW(d) ? ruleT.oos : ruleT.is).push(100 * (D[p.x].close / D[p.m].close - 1));
    }
    const IS = trades.filter((t) => isW(t.entryD)), OOS = trades.filter((t) => oosW(t.entryD));
    const cmp = (rt, inW) => { const A = allT(inW), w = welch(rt, A); return { ruleN: rt.length, ruleMean: r3(stats(rt).mean), allN: A.length, allMean: r3(stats(A).mean), diff: r3(w.diff), t: r2(w.t) }; };
    // placebo: random down days (not this rule's entries), same counts per year as the OOS trades
    const counts = new Map(); for (const t of OOS) counts.set(yr(t.entryD), (counts.get(yr(t.entryD)) || 0) + 1);
    const pool = new Map();
    days.forEach((d, x) => { if (x >= 1 && x + 1 < days.length && !entryIdx.has(x) && ruleOn(dayChg(D, x), rule.drop)) { if (!pool.has(yr(d))) pool.set(yr(d), []); pool.get(yr(d)).push(x); } });
    const ruleMean = stats(OOS.map((t) => t.R)).mean, seeds = [];
    for (let s = 1; s <= SEEDS; s++) {
      const Rn = rng(s), obs = [];
      for (const [y, n] of counts) {
        const K = pool.get(y) || []; let got = 0, tries = 0;
        while (K.length && got < n && tries < n * 50) { tries++; const x = K[Math.floor(Rn() * K.length)]; const t = trade(bars, D, x, x + 1, opt); if (t) { obs.push(t.R); got++; } }
      }
      seeds.push(obs.length ? meanOf(obs) : null);
    }
    const beaten = seeds.filter((m) => m != null && ruleMean != null && ruleMean > m).length;
    const byYear = {}; for (const t of trades) (byYear[yr(t.entryD)] ||= []).push(t.R);
    out[rk] = { market: k, rule: rk, name: `${MARKETS[k].name}, ${rule.name}`, minN: rule.minN,
      is: summ(IS), oos: summ(OOS), pOne: pOneSided(stats(OOS.map((t) => t.R)).t), skipped,
      vsAllIS: cmp(ruleT.is, isW), vsAllOOS: cmp(ruleT.oos, oosW),
      placebo: { seeds: seeds.map(r3), beaten, need: SEEDS_NEED, median: r3([...seeds].sort((a, b) => a - b)[SEEDS / 2]) },
      byYear: Object.fromEntries(Object.entries(byYear).map(([y, xs]) => { const s = stats(xs); return [y, { n: s.n, R: r3(s.mean) }]; })),
      trades: trades.map((t) => [t.entryD, t.exitD, t.how, t.nights, r3(t.gross), r3(t.net), r3(t.R)]) };
  }
  const allOOS = stats(allT(oosW)), allIS = stats(allT(isW));
  return { cells: out, allWeeks: { is: { n: allIS.n, meanPct: r3(allIS.mean), t: r2(allIS.t) }, oos: { n: allOOS.n, meanPct: r3(allOOS.mean), t: r2(allOOS.t) } } };
}

export function study(M, dgs2) {
  const keys = Object.keys(M);
  const first = keys.map((k) => nyParts(M[k][0][0]).ymd).sort().at(-1), last = keys.map((k) => nyParts(M[k].at(-1)[0]).ymd).sort()[0];
  const days = tradingDays(first, last), rate = rateOf(dgs2);
  const cells = {}, allWeeks = {};
  for (const k of keys) { const c = cellsFor(k, M[k], days, rate); allWeeks[k] = c.allWeeks; for (const [rk, v] of Object.entries(c.cells)) cells[`${k}-${rk}`] = v; }
  return { from: first, to: last, cells, allWeeks };
}

export function verdictOf(S) {
  const ids = Object.keys(S.cells), adj = holm(ids.map((id) => S.cells[id].pOne));
  const out = {};
  ids.forEach((id, i) => {
    const c = S.cells[id], o = c.oos;
    const checks = {
      c1: o.R > 0 && o.t >= 2 && adj[i] < 0.05,
      c2: o.n >= c.minN,
      c3: c.is.R > 0,
      c4: c.vsAllOOS.diff > 0 && c.vsAllOOS.t >= 2,
      c5: c.placebo.beaten >= SEEDS_NEED,
    };
    out[id] = { holmP: +adj[i].toFixed(4), checks, pass: Object.values(checks).every(Boolean) };
  });
  return { verdict: Object.values(out).some((c) => c.pass) ? 'PASS' : 'FAIL', cells: out };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candleDir>');
  const here = path.dirname(new URL(import.meta.url).pathname);
  const rates = JSON.parse(fs.readFileSync(path.join(here, 'rates.json'), 'utf8'));
  const M = {};
  for (const k of Object.keys(MARKETS)) M[k] = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${k}-1h.json.gz`))));
  const S = study(M, rates.DGS2), v = verdictOf(S);
  const out = { built: '2026-11-13', study: 'turnaround-tuesday', title: 'Turnaround Tuesday on US indices, out of sample', verdict: v.verdict, checks: v.cells,
    data: { src: 'OANDA mid H1 via the site candle proxy (fetch.mjs); close = the H1 candle ending 16:00 New York (13:00 half days); 2-year yield FRED DGS2 weekly (rates.json)', costs: Object.fromEntries(Object.entries(MARKETS).map(([k, m]) => [k, m.cost])), financing: `DGS2 + ${FIN_ADD}% a year, calendar nights` },
    ...S };
  fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(v.verdict);
  for (const [id, c] of Object.entries(S.cells)) console.log(id, 'OOS', JSON.stringify(c.oos), 'IS', JSON.stringify(c.is), 'vsAll', JSON.stringify(c.vsAllOOS), 'placebo', c.placebo.beaten, c.placebo.median, 'skip', c.skipped.length, JSON.stringify(v.cells[id]));
  console.log('allWeeks', JSON.stringify(S.allWeeks));
}
