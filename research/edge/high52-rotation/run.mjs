// Edge research · high52-rotation (PREREGISTRATION.md, committed first).
// Cross-sectional 52-week-high proximity rotation across eleven equity-index CFDs: each month end hold the 3 indices nearest
// their 52-week high (inverse 60-day volatility weights), 3 x ATR(20) catastrophe stop, against the equal-weight book of all
// eleven with the same stop and costs; net of trading costs and financing; 40-seed random-pick placebo.
//   node run.mjs fetch <dir>   copies the daily candle cache out of the council-data branch (git show, no network)
//   node run.mjs full <dir>    writes result.json and RESULT.md next to this file
// Paper research: nothing here is read by the council, the mirror or the page.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights } from '../../../council/fills.mjs';

export const KEYS = ['spx500', 'nas100', 'us30', 'us2000', 'de40', 'uk100', 'jp225', 'eu50', 'fr40', 'au200', 'hk33'];
export const P = {
  LOOK: 252, VOL: 60, ATR: 20, STOP_ATR: 3, TOP: 3, STALE_D: 5, MARKUP: 2.5, LATEST_START: '2006-12-31',
  REP: ['2008-01', '2015-12'], DEC_FROM: '2016-01', NW_LAGS: 3, SEEDS: 40, PLACEBO_Q: 0.95,
};
// round trip as a fraction of price (PREREGISTRATION.md "Costs")
export const RT = { spx500: 0.0002, nas100: 0.0002, us30: 0.0002, de40: 0.0002, uk100: 0.0003, eu50: 0.0003, fr40: 0.0003, jp225: 0.0004, au200: 0.0004, us2000: 0.0005, hk33: 0.0005 };
export const CCY = { spx500: 'USD', nas100: 'USD', us30: 'USD', us2000: 'USD', jp225: 'USD', de40: 'EUR', eu50: 'EUR', fr40: 'EUR', uk100: 'GBP', au200: 'AUD', hk33: 'HKD' };
// cash rate % a year by calendar year (PREREGISTRATION.md table), columns USD EUR GBP AUD HKD
const RATE_ROWS = {
  2007: [5.0, 3.9, 5.5, 6.5, 5.0], 2008: [2.0, 3.9, 4.7, 6.7, 2.0], 2009: [0.2, 1.3, 0.6, 3.3, 0.2], 2010: [0.2, 1.0, 0.5, 4.4, 0.2],
  2011: [0.1, 1.3, 0.5, 4.7, 0.2], 2012: [0.1, 0.9, 0.5, 3.7, 0.2], 2013: [0.1, 0.6, 0.5, 2.8, 0.2], 2014: [0.1, 0.2, 0.5, 2.5, 0.2],
  2015: [0.1, 0.05, 0.5, 2.1, 0.2], 2016: [0.4, 0, 0.4, 1.6, 0.4], 2017: [1.0, 0, 0.3, 1.5, 1.0], 2018: [1.8, 0, 0.6, 1.5, 1.8],
  2019: [2.2, 0, 0.75, 1.1, 2.2], 2020: [0.4, 0, 0.2, 0.3, 0.5], 2021: [0.1, 0, 0.1, 0.1, 0.1], 2022: [1.7, 0.3, 1.5, 1.3, 1.8],
  2023: [5.0, 3.3, 4.7, 3.9, 4.6], 2024: [5.1, 3.9, 5.1, 4.35, 5.0], 2025: [4.2, 2.3, 4.3, 4.0, 4.0], 2026: [3.7, 2.0, 3.8, 3.6, 3.6],
};
const COLS = ['USD', 'EUR', 'GBP', 'AUD', 'HKD'];
export function cashRate(ccy, year) {
  const y = Math.min(2026, Math.max(2007, year));
  return Math.max(0, RATE_ROWS[y][COLS.indexOf(ccy)]);
}
// financing a night per unit of notional (fraction): (cash + 2.5 %) / 365
export const finPerNight = (k, t) => (cashRate(CCY[k], new Date(t * 1000).getUTCFullYear()) + P.MARKUP) / 100 / 365;

const DAY = 86400;
export const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);
const r4 = (v) => (Number.isFinite(v) ? +v.toFixed(4) : null);
const r2 = (v) => (Number.isFinite(v) ? +v.toFixed(2) : null);
export const addMonths = (k, n) => { const [y, m] = k.split('-').map(Number), z = y * 12 + (m - 1) + n; return `${Math.floor(z / 12)}-${String(z % 12 + 1).padStart(2, '0')}`; };
const monthEndDay = (k) => { const [y, m] = k.split('-').map(Number); return Date.UTC(y, m, 0) / 1000; };
export const rng = ([a, b]) => { const out = []; for (let k = a; k <= b; k = addMonths(k, 1)) out.push(k); return out; };

// ── per-index inputs read at the decision candle i (nothing after i) ──
export function score(D, i, n = P.LOOK) {
  if (i < n - 1) return null;
  let hi = -Infinity;
  for (let j = i - n + 1; j <= i; j++) hi = Math.max(hi, D[j].close);
  return D[i].close / hi;
}
export function vol(D, i, n = P.VOL) {
  if (i < n) return null;
  const r = [];
  for (let j = i - n + 1; j <= i; j++) r.push(D[j].close / D[j - 1].close - 1);
  const m = r.reduce((a, b) => a + b, 0) / n;
  return Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1));
}
export function atrAt(D, i, n = P.ATR) {
  if (i < n) return null;
  let a = 0;
  for (let j = i - n + 1; j <= i; j++) a += Math.max(D[j].high - D[j].low, Math.abs(D[j].high - D[j - 1].close), Math.abs(D[j].low - D[j - 1].close));
  return a / n;
}
export function monthEnds(D) { const out = new Map(); D.forEach((b, i) => out.set(ym(b.time), i)); return out; }
// the decision of month k for one index: { score, vol, atr, i } or null (not eligible)
export function decide(D, ends, k) {
  const i = ends.get(k);
  if (i == null || D[i].time < monthEndDay(k) - P.STALE_D * DAY) return null;
  const s = score(D, i), v = vol(D, i), a = atrAt(D, i);
  if (s == null || !v || !a) return null;
  return { score: s, vol: v, atr: a, i };
}
// the 3 nearest their 52-week high (ties: lower key)
export function pickTop(dec, n = P.TOP) {
  const ks = Object.keys(dec).filter((k) => dec[k]).sort((a, b) => dec[b].score - dec[a].score || (a < b ? -1 : 1));
  return ks.length >= n ? ks.slice(0, n) : [];
}
export function invVol(dec, ks) {
  const s = ks.reduce((a, k) => a + 1 / dec[k].vol, 0), w = {};
  for (const k of ks) w[k] = 1 / dec[k].vol / s;
  return w;
}
export const rotation = (dec) => invVol(dec, pickTop(dec));
export const benchEqual = (dec) => { const ks = Object.keys(dec).filter((k) => dec[k]), w = {}; for (const k of ks) w[k] = 1 / ks.length; return w; };
export const benchInvVol = (dec) => invVol(dec, Object.keys(dec).filter((k) => dec[k]));
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function placebo(seed) {
  const r = mulberry32(seed);
  return (dec) => {
    const ks = Object.keys(dec).filter((k) => dec[k]).sort();
    if (ks.length < P.TOP) return {};
    for (let i = ks.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ks[i], ks[j]] = [ks[j], ks[i]]; }
    return invVol(dec, ks.slice(0, P.TOP));
  };
}

// one index through one holding month (long only). bars = its candles of the month; prevClose = last close before; wOld =
// weight held at the end of the previous month (0 if stopped or flat). Daily rows { t, ret, cost, fin }, weight at the end.
export function holdMonth(k, bars, prevClose, wOld, w, stop, { costX = 1, finX = 1 } = {}) {
  const one = RT[k] / 2 * costX, rows = [];
  let pos = w, stopped = false, prev = prevClose;
  bars.forEach((b, n) => {
    let ret = 0, cost = 0;
    if (n === 0) {
      if (Number.isFinite(prev)) ret += wOld * (b.open / prev - 1);
      cost += Math.abs(w - wOld) * one;
      prev = b.open;
    }
    let exit = null;
    if (pos && Number.isFinite(stop)) {
      if (b.open <= stop) exit = b.open;
      else if (b.low <= stop) exit = stop;
    }
    const held = pos;
    ret += pos * ((exit ?? b.close) / prev - 1);
    const fin = Math.abs(held) * finPerNight(k, b.time) * nights(b.time, b.time + DAY) * finX;
    if (exit != null) { cost += Math.abs(pos) * one; pos = 0; stopped = true; }
    prev = b.close;
    rows.push({ t: b.time, ret, cost, fin });
  });
  return { rows, wEnd: pos, stopped };
}

// ── a book: weights(dec, month) each month from the decisions of the month before ──
export function prepare(data) {
  const ends = {}, starts = {};
  for (const k of Object.keys(data)) { ends[k] = monthEnds(data[k]); starts[k] = new Map(); data[k].forEach((b, i) => { const y = ym(b.time); if (!starts[k].has(y)) starts[k].set(y, i); }); }
  const months = [...new Set(Object.values(data).flatMap((D) => D.map((b) => ym(b.time))))].sort();
  const decs = new Map();
  for (const m of months) { const dec = {}; for (const k of Object.keys(data)) dec[k] = decide(data[k], ends[k], m); decs.set(m, dec); }
  return { data, ends, starts, months, decs };
}
export function simulate(prep, wfn, opt = {}) {
  const { data, ends, starts, months, decs } = prep, held = {}, monthly = {}, daily = new Map(), picks = {};
  let stops = 0;
  for (let mi = 1; mi < months.length; mi++) {
    const h = months[mi], dec = decs.get(addMonths(h, -1)) || {}, w = wfn(dec);
    for (const k in w) picks[k] = (picks[k] || 0) + 1;
    for (const k of Object.keys(data)) {
      const D = data[k], a = starts[k].get(h);
      const wk = w[k] || 0, wOld = held[k] || 0;
      if (a == null) { held[k] = wOld; continue; }
      const bars = D.slice(a, ends[k].get(h) + 1), d = dec[k];
      const stop = wk && d && !opt.noStop ? bars[0].open - P.STOP_ATR * d.atr : null;
      const r = holdMonth(k, bars, a > 0 ? D[a - 1].close : NaN, wOld, wk, stop, opt);
      for (const x of r.rows) { const v = x.ret - x.cost - x.fin; daily.set(x.t, (daily.get(x.t) || 0) + v); monthly[h] = (monthly[h] || 0) + v; }
      if (r.stopped) stops++;
      held[k] = r.wEnd;
    }
  }
  return { monthly, daily: [...daily.entries()].sort((a, b) => a[0] - b[0]), stops, picks };
}

// ── statistics on monthly returns ──
export function nwT(xs, L = P.NW_LAGS) {
  const n = xs.length, m = xs.reduce((a, b) => a + b, 0) / n, e = xs.map((x) => x - m);
  const g = (l) => { let s = 0; for (let i = l; i < n; i++) s += e[i] * e[i - l]; return s / n; };
  let v = g(0);
  for (let l = 1; l <= L; l++) v += 2 * (1 - l / (L + 1)) * g(l);
  return v > 0 ? m / Math.sqrt(v / n) : null;
}
export function stats(xs) {
  const n = xs.length, mean = xs.reduce((a, b) => a + b, 0) / (n || 1);
  const sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  let c = 0, pk = 0, dd = 0;
  for (const x of xs) { c += x; pk = Math.max(pk, c); dd = Math.min(dd, c - pk); }
  return { n, mean, sd, sharpe: sd ? mean / sd * Math.sqrt(12) : null, t: sd ? mean / (sd / Math.sqrt(n)) : null, nwT: n > 4 ? nwT(xs) : null, total: c, maxDD: dd };
}
const round = (s) => ({ n: s.n, meanPct: r4(s.mean * 100), sharpe: r2(s.sharpe), t: r2(s.t), nwT: r2(s.nwT), totalPct: r2(s.total * 100), annRetPct: r2(s.mean * 1200), maxDDPct: r2(s.maxDD * 100) });
export function windowOf(sims, W) {
  const ks = rng(W), x = (s) => ks.map((k) => s.monthly[k] || 0);
  const rot = x(sims.rot), eq = x(sims.eq), iv = x(sims.iv);
  return { months: `${W[0]} to ${W[1]}`, rotation: round(stats(rot)), benchmark: round(stats(eq)), invVolBenchmark: round(stats(iv)),
    excess: round(stats(rot.map((v, i) => v - eq[i]))), excessVsInvVol: round(stats(rot.map((v, i) => v - iv[i]))) };
}
export const quantile = (xs, q) => { const s = [...xs].sort((a, b) => a - b), p = (s.length - 1) * q, lo = Math.floor(p); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (p - lo); };
export function verdictOf(rep, dec, plQ95) {
  const c1 = dec.excess.meanPct > 0 && dec.excess.nwT >= 2, c2 = rep.excess.meanPct > 0, c3 = dec.rotation.sharpe >= dec.benchmark.sharpe;
  const c4 = dec.excess.meanPct > plQ95;
  return { pass: !!(c1 && c2 && c3 && c4), c1: !!c1, c2: !!c2, c3: !!c3, c4: !!c4 };
}

// ── files ──
const HERE = path.dirname(fileURLToPath(import.meta.url));
export function load(dir, k) {
  const f = path.join(dir, `${k}.json`);
  if (!fs.existsSync(f)) return null;
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  return foldWeekend(j.rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] })));
}
function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const k of KEYS) {
    const f = path.join(dir, `${k}.json`);
    if (fs.existsSync(f)) continue;
    try { fs.writeFileSync(f, execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 28 })); console.log('saved', k); }
    catch { console.log('missing', k); }
  }
}

export function build(dir) {
  const data = {}, starts = {}, dropped = [];
  for (const k of KEYS) {
    const D = load(dir, k);
    if (!D || !D.length) { dropped.push({ k, why: 'not in the cache' }); continue; }
    starts[k] = new Date(D[0].time * 1000).toISOString().slice(0, 10);
    if (starts[k] > P.LATEST_START) { dropped.push({ k, why: `starts ${starts[k]}` }); continue; }
    data[k] = D;
  }
  const last = Math.max(...Object.values(data).map((D) => D.at(-1).time)), lm = ym(last);
  const lastFull = last >= monthEndDay(lm) - P.STALE_D * DAY ? lm : addMonths(lm, -1);
  const REP = P.REP, DEC = [P.DEC_FROM, lastFull];
  const prep = prepare(data);
  const run = (o = {}) => ({ rot: simulate(prep, rotation, o), eq: simulate(prep, benchEqual, o), iv: simulate(prep, benchInvVol, o) });
  const base = run(), x2 = run({ costX: 2, finX: 2 }), nofin = run({ finX: 0 }), gross = run({ costX: 0, finX: 0 });
  const rep = windowOf(base, REP), dec = windowOf(base, DEC);
  const plRows = [];
  for (let s = 1; s <= P.SEEDS; s++) {
    const sim = simulate(prep, placebo(s)), ex = (W) => stats(rng(W).map((k) => (sim.monthly[k] || 0) - (base.eq.monthly[k] || 0)));
    plRows.push({ seed: s, decMeanPct: r4(ex(DEC).mean * 100), decNwT: r2(ex(DEC).nwT), repMeanPct: r4(ex(REP).mean * 100) });
  }
  const plQ95 = r4(quantile(plRows.map((x) => x.decMeanPct), P.PLACEBO_Q));
  const above = plRows.filter((x) => x.decMeanPct >= dec.excess.meanPct).length;
  const pickW = (W) => { const sim = simulate({ ...prep, months: prep.months.filter((m) => m >= addMonths(W[0], -1) && m <= W[1]) }, rotation); return sim.picks; };
  const sens = (S) => { const a = windowOf(S, REP), b = windowOf(S, DEC); return { replication: pickS(a), decisive: pickS(b) }; };
  return {
    study: 'high52-rotation', built: new Date(last * 1000).toISOString().slice(0, 10),
    rule: 'each month end hold the 3 of 11 equity-index CFDs with the highest close / 252-day closing high, inverse 60-day volatility weights (gross 1x, long only), rebalanced at the next open, 3 x ATR(20) catastrophe stop; benchmark = all eligible indices at equal weight with the same stop, costs and financing',
    universe: KEYS, starts, dropped, lastCandle: new Date(last * 1000).toISOString().slice(0, 10), windows: { replication: REP, decisive: DEC },
    costs: { roundTrip: RT, currency: CCY, markupPctYear: P.MARKUP },
    replication: rep, decisive: dec,
    placebo: { seeds: P.SEEDS, q95DecMeanPct: plQ95, seedsAtOrAbove: above, medianDecMeanPct: r4(quantile(plRows.map((x) => x.decMeanPct), 0.5)), rows: plRows },
    verdict: verdictOf(rep, dec, plQ95),
    stops: { rotation: base.rot.stops, benchmark: base.eq.stops },
    picks: { replication: pickW(REP), decisive: pickW(DEC) },
    sensitivity: { costsX2: sens(x2), noFinancing: sens(nofin), grossNoCosts: sens(gross) },
    monthlyPct: Object.fromEntries(rng([REP[0], DEC[1]]).map((k) => [k, { rot: r2((base.rot.monthly[k] || 0) * 100), eq: r2((base.eq.monthly[k] || 0) * 100) }])),
  };
}
const pickS = (w) => ({ excessMeanPct: w.excess.meanPct, excessNwT: w.excess.nwT, rotSharpe: w.rotation.sharpe, benchSharpe: w.benchmark.sharpe, rotAnnRetPct: w.rotation.annRetPct, benchAnnRetPct: w.benchmark.annRetPct });

// ── the report (RESULT.md is this function's output; the test regenerates it from result.json) ──
export function report(R) {
  const v = R.verdict, A = R.replication, B = R.decisive, f = (x) => (x == null ? 'n/a' : (x > 0 ? '+' : '') + x), L = [];
  const mk = (b) => (b ? 'met' : 'missed');
  L.push('# 52-week-high proximity rotation across equity indices: result', '');
  L.push(`**Verdict: ${v.pass ? 'PASS' : 'FAIL'}** (pre-registered bar: decisive excess > 0 with Newey-West t >= 2 ${mk(v.c1)}; 2008-15 excess > 0 ${mk(v.c2)}; decisive Sharpe >= benchmark ${mk(v.c3)}; above the placebo's 95th percentile ${mk(v.c4)}).`, '');
  L.push(`Decisive window ${B.months} (${B.excess.n} months): the rotation made ${f(B.rotation.annRetPct)} % a year (Sharpe ${f(B.rotation.sharpe)}) against ${f(B.benchmark.annRetPct)} % (Sharpe ${f(B.benchmark.sharpe)}) for the equal-weight book of all eleven; excess ${f(B.excess.meanPct)} % a month, Newey-West t ${f(B.excess.nwT)}.`);
  L.push(`Replication ${A.months} (${A.excess.n} months): excess ${f(A.excess.meanPct)} % a month (Newey-West t ${f(A.excess.nwT)}); rotation Sharpe ${f(A.rotation.sharpe)}, benchmark ${f(A.benchmark.sharpe)}.`);
  L.push(`Placebo (${R.placebo.seeds} seeds of 3 random indices a month, same weights, stop and costs): 95th percentile of the decisive excess ${f(R.placebo.q95DecMeanPct)} % a month, median ${f(R.placebo.medianDecMeanPct)} %; ${R.placebo.seedsAtOrAbove} of ${R.placebo.seeds} seeds did at least as well as the rule.`, '');
  L.push('Net of the pre-registered trading costs and financing (each index currency\'s cash rate for the year + 2.5 % a year on every long). Returns summed on a constant equity of 1 (not compounded). Paper research: no live rule, size, filter, stop or council member changed.', '');
  L.push('## Setup', '');
  L.push(`Rule: ${R.rule}. Universe: ${R.universe.join(', ')}; dropped: ${R.dropped.length ? R.dropped.map((d) => `${d.k} (${d.why})`).join(', ') : 'none (every history starts in 2003-04)'}. Data: council-data \`research/daily/<key>.json\`, OANDA mid daily candles to ${R.lastCandle}, weekend stubs folded into Monday. Catastrophe stops hit: ${R.stops.rotation} (rotation) and ${R.stops.benchmark} (benchmark).`, '');
  L.push('## Windows', '');
  for (const W of [A, B]) {
    L.push(`### ${W.months}`, '', '| Stream | Months | Mean % a month | % a year | Sharpe | t | Newey-West t | Total % | Worst drawdown % |', '|---|---|---|---|---|---|---|---|---|');
    for (const [name, s] of [['Rotation (top 3)', W.rotation], ['Benchmark (all, equal weight)', W.benchmark], ['All, inverse-volatility weight (descriptive)', W.invVolBenchmark], ['**Excess over the benchmark**', W.excess], ['Excess over the inverse-volatility book (descriptive)', W.excessVsInvVol]])
      L.push(`| ${name} | ${s.n} | ${f(s.meanPct)} | ${f(s.annRetPct)} | ${f(s.sharpe)} | ${f(s.t)} | ${f(s.nwT)} | ${f(s.totalPct)} | ${f(s.maxDDPct)} |`);
    L.push('');
  }
  L.push('## How often each index was held (months)', '', `| Index | ${KEYS.join(' | ')} |`, `|---|${KEYS.map(() => '---|').join('')}`);
  for (const [name, p] of [['2008-15', R.picks.replication], ['Decisive', R.picks.decisive]]) L.push(`| ${name} | ${KEYS.map((k) => p[k] || 0).join(' | ')} |`);
  L.push('');
  L.push('## Sensitivities (never deciding)', '', '| Variant | Window | Excess % a month | Newey-West t | Rotation Sharpe | Benchmark Sharpe | Rotation % a year | Benchmark % a year |', '|---|---|---|---|---|---|---|---|');
  for (const [name, s] of [['Costs x2 (trading and financing)', R.sensitivity.costsX2], ['No financing', R.sensitivity.noFinancing], ['No costs, no financing', R.sensitivity.grossNoCosts]])
    for (const [w, x] of [['2008-15', s.replication], ['Decisive', s.decisive]]) L.push(`| ${name} | ${w} | ${f(x.excessMeanPct)} | ${f(x.excessNwT)} | ${f(x.rotSharpe)} | ${f(x.benchSharpe)} | ${f(x.rotAnnRetPct)} | ${f(x.benchAnnRetPct)} |`);
  L.push('');
  L.push('## Reading', '');
  if (!v.pass) L.push('- The pre-registered bar was not met: no proposal is written and nothing changes. Any variant (another look-back, top 2 or 4, a different weighting, total-return data, more indices) would be a new study with its own pre-registration, judged on data it was not chosen on.');
  else L.push('- The bar was met: a paper shadow book may be proposed to the owner; nothing is live.');
  L.push(`- The placebo shows how much of any excess is simply holding three of these eleven at inverse-volatility weights: its median excess is ${f(R.placebo.medianDecMeanPct)} % a month against the equal-weight book.`);
  L.push('', '## What this cannot show', '');
  L.push('- Dividends: a CFD long is credited the index dividend; the OANDA mid is a price index, so high-yield indices (UK, Hong Kong, euro area) are understated against low-yield ones (Nasdaq). Not corrected.');
  L.push('- Currency: each index earns in its own currency (no FX translation). Financing uses approximate year-average policy rates stated in the pre-registration.');
  L.push('- Eleven correlated indices are a narrow cross-section; the published effect is across thousands of stocks.');
  L.push('- Not an edge in the council: no forward record exists. Never call it one without n, t and a forward record.');
  L.push('', 'To repeat: `node research/edge/high52-rotation/run.mjs fetch <dir>`, then `node research/edge/high52-rotation/run.mjs full <dir>`. Tests: `tests/high52-rotation.test.mjs`.', '');
  return L.join('\n');
}

function full(dir) {
  const R = build(dir);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
  console.log(JSON.stringify({ verdict: R.verdict, dec: R.decisive.excess, rep: R.replication.excess, pl: R.placebo.q95DecMeanPct }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch' && dir) fetchAll(dir);
  else if (cmd === 'full' && dir) full(dir);
  else { console.error('usage: node run.mjs fetch|full <dir>'); process.exit(1); }
}
