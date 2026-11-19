// Edge research · gotobi-early-years: the gotobi study's T2 fade (sell at the 09:55 Tokyo fix on gotobi days, buy back at
// 15:00 Tokyo) run unchanged on yen pair-years no gotobi study has used: EUR/JPY, GBP/JPY, AUD/JPY, CAD/JPY, CHF/JPY and NZD/JPY
// 2005-09 (U, the primary set), and NZD/JPY 2010-now (N, supporting only). The rule is frozen.mjs, a byte-for-byte copy of
// research/edge/gotobi-cost/frozen.mjs (= research/edge/gotobi/run.mjs at 5f341e069); nothing of it is re-implemented here
// (PREREGISTRATION.md, pushed alone first).
//   node research/edge/gotobi-early-years/run.mjs <candleDir>   (what fetch.mjs wrote; writes result.json and RESULT.md here)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as F from './frozen.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---- what differs from the original: the markets and the years ------------------------------------------------------------
export const LEG = 'fade';                                        // the original's T2 leg
export const ORIGINAL = { test: 'T2', pair: 'usdjpy', leg: 'fade' };
export const CROSSES = { eurjpy: 'EUR/JPY', gbpjpy: 'GBP/JPY', audjpy: 'AUD/JPY', cadjpy: 'CAD/JPY', chfjpy: 'CHF/JPY', nzdjpy: 'NZD/JPY' };
export const U_WINDOW = [null, '2009-12-31'], N_WINDOW = ['2010-01-01', '2026-11-11'], GATE_LAST = '2026-11-11';
export const GATE_WANT = { n: 771, netR: '0.148', t: '2.74' };   // #878 RESULT.md, T2 2016-now, to its published rounding
export const T_BAR = F.T_BAR, SEEDS = F.SEEDS, P_RANK = F.P_RANK;
export const FLOOR = { crosses: 3, years: 3, trades: 400 };
// gotobi-cost's published all-day average spreads (pips; web search summaries of 14 Nov 2026, not measured). None for EUR/JPY
// or NZD/JPY: the "all six" row gives them the largest published cross figure.
export const PUBLISHED = { gbpjpy: 0.49, audjpy: 0.29, cadjpy: 0.49, chfjpy: 1.39 };
export const PUB_STANDIN = Math.max(...Object.values(PUBLISHED));
// the multiple-testing ledger's stored inputs for the gotobi hypothesis (multiple-testing-update/result.json)
export const LEDGER = { original: { id: '#878 T2', t: 2.74 }, r2: { id: '#889 R2 USD/JPY 2005-09', t: 3.8 }, r1: { id: '#889 R1 crosses pooled 2010-26', t: 2.75 }, bonferroniP: 1.5e-4, calendarDisjointP: 3.6270045778326725e-6 };

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const median = (a) => { const s = [...a].sort((p, q) => p - q), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const sdv = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
const r4 = (v) => (v == null ? null : Math.round(v * 1e4) / 1e4);
const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);

// ---- Fisher, copied from research/edge/multiple-testing-update/run.mjs (not imported across branches) ------------------
export function erfc(x) {
  const z = Math.abs(x); const t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806
    + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}
export const Phi = (x) => 0.5 * erfc(-x / Math.SQRT2);
export const pOneSided = (t) => 1 - Phi(t);
export function PhiInv(p) {
  let lo = -40, hi = 40;
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (Phi(m) < p) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
export const tOfP = (p) => (p >= 1 ? -Infinity : p <= 0 ? Infinity : -PhiInv(p));
export function chi2SfEven(x, df) {
  if (df % 2) throw new Error('even df only');
  let term = 1, sum = 1; for (let k = 1; k < df / 2; k++) { term *= x / 2 / k; sum += term; }
  return Math.exp(-x / 2) * sum;
}
export function fisher(ps) { const x = -2 * ps.reduce((a, p) => a + Math.log(p), 0); const df = 2 * ps.length; return { x, df, p: chi2SfEven(x, df) }; }
const fisherOut = (ids, ps) => { const f = fisher(ps); return { ids, x: r4(f.x), df: f.df, p: f.p, z: r4(tOfP(f.p)), belowBonferroni: f.p < LEDGER.bonferroniP }; };

// ---- the day loop: gotobi-replicate's runLeg, copied (every Tokyo business day in [from, to] through the frozen trade) -----
export function runLeg(bars, from, to) {
  const ix = F.index(bars), moves = new Map();
  const moveOf = (d) => { if (!moves.has(d)) moves.set(d, F.windowMove(ix, LEG, d)); return moves.get(d); };
  const G = F.gotobiSet(+from.slice(0, 4) - 1, +to.slice(0, 4)), all = new Map(), noData = { gotobi: 0, other: 0 }, days = [];
  for (let d = from; d <= to; d = F.addD(d, 1)) {
    if (!F.isTokyoBusinessDay(d)) continue;
    days.push(d);
    const t = F.trade(ix, LEG, d, F.stopDist(moveOf, d));
    if (t) all.set(d, t); else noData[G.has(d) ? 'gotobi' : 'other']++;
  }
  const got = [...all.values()].filter((t) => G.has(t.day)), pool = [...all.values()].filter((t) => !G.has(t.day));
  return { G, days, got, pool, noData, gotobiDays: days.filter((d) => G.has(d)).length };
}

// ---- costs: net R of a stored trade at another cost (costs never change a trade's path in the frozen rule) ----------------
export const atMult = (k) => (t) => t.R - k * t.costR;                              // 0 = gross, 1 = base (C1), 2 = 2 x cost
export const atX = (x) => (t) => t.R - (x * F.PIP + 2 * F.COMMISSION * t.entry) / t.D;   // x = spread + 2 x slippage, pips
export const pubOf = (pair, slip) => { const s = PUBLISHED[pair] ?? PUB_STANDIN; return s + 2 * slip; };

// worst drawdown of cumulative R, trades in order of entry time then pair, starting from 0
export function worstDD(trades, fn) {
  const s = [...trades].sort((a, b) => a.entryT - b.entryT || String(a.pair).localeCompare(String(b.pair)));
  let cum = 0, peak = 0, dd = 0;
  for (const t of s) { cum += fn(t); peak = Math.max(peak, cum); dd = Math.max(dd, peak - cum); }
  return dd;
}
// the figures at one cost: n, mean, trade t, month t (frozen monthT), worst drawdown
export function at(trades, fn) {
  if (!trades.length) return { n: 0 };
  const v = trades.map(fn), mt = F.monthT(trades.map((t) => ({ day: t.day, net: fn(t) })));
  return { n: v.length, meanR: r4(mean(v)), tradeT: v.length > 1 ? r2(mean(v) / (sdv(v) / Math.sqrt(v.length))) : null, monthT: mt.t == null ? null : r2(mt.t), months: mt.months, totalR: r2(v.reduce((a, b) => a + b, 0)), worstDD: r2(worstDD(trades, fn)) };
}
export function costs(trades) {
  return { gross: at(trades, atMult(0)), base: at(trades, atMult(1)), x2: at(trades, atMult(2)) };
}
// the original's placebo: per seed, F.draw the same number of non-gotobi days from each market's pool; pooled net R a trade
export function placebo(parts) {
  const vals = [];
  for (let s = 1; s <= SEEDS; s++) {
    const nets = [];
    for (const p of parts) for (const t of F.draw(p.pool, p.n, s)) nets.push(t.net);
    vals.push(mean(nets));
  }
  const sorted = [...vals].sort((a, b) => a - b);
  return { seeds: SEEDS, rank: P_RANK, p95: r4(sorted[P_RANK - 1]), median: r4(median(vals)), values: vals.map(r4) };
}
const byYear = (trades) => {
  const y = {}; for (const t of trades) (y[t.day.slice(0, 4)] ||= []).push(t);
  return Object.fromEntries(Object.entries(y).sort().map(([k, a]) => { const s = F.summary(a); return [k, { n: s.n, netR: s.netR, totalR: s.totalR }]; }));
};
export function corrByDay(a, b) {
  const u = new Map(b.map((t) => [t.day, t.net])), x = [], y = [];
  for (const t of a) if (u.has(t.day)) { x.push(t.net); y.push(u.get(t.day)); }
  if (x.length < 3) return { days: x.length, r: null };
  const mx = mean(x), my = mean(y); let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return { days: x.length, r: r2(sxy / Math.sqrt(sxx * syy)) };
}

// ---- the gate: the frozen file's own T2 loop on USD/JPY must give #878's published figures ---------------------------------
export function gate(usdjpy) {
  const { G, all } = F.runPair(usdjpy, LEG, GATE_LAST);
  const got = [...all.values()].filter((t) => G.has(t.day) && t.day >= F.DECISIVE[0]);
  const s = F.summary(got);
  const ok = s.n === GATE_WANT.n && s.netR.toFixed(3) === GATE_WANT.netR && s.t.toFixed(2) === GATE_WANT.t;
  return { summary: s, want: GATE_WANT, pass: ok, trades: got };
}

// ---- U, the primary set ---------------------------------------------------------------------------------------------------
export function primary(early) {
  const per = {}, parts = [], pooled = [];
  for (const [k, name] of Object.entries(CROSSES)) {
    const bars = early[k]; if (!bars || !bars.length) { per[k] = { pair: name, firstCandle: null, all: { n: 0 } }; continue; }
    const first = new Date(bars[0][0] * 1000).toISOString().slice(0, 10);
    const run = runLeg(bars, first, U_WINDOW[1]);
    const got = run.got.map((t) => ({ ...t, pair: k }));
    parts.push({ pool: run.pool, n: got.length }); pooled.push(...got);
    const pl = placebo([{ pool: run.pool, n: got.length }]);
    per[k] = {
      pair: name, firstCandle: first, firstTrade: got.length ? got[0].day : null, gotobiDays: run.gotobiDays, noData: run.noData,
      all: F.summary(got), costs: costs(got), years: Object.keys(byYear(got)).length, byYear: byYear(got),
      pub: { c2a: at(got, (t) => atX(pubOf(k, 0))(t)), c2b: at(got, (t) => atX(pubOf(k, F.SLIP_PIPS))(t)), xC2a: pubOf(k, 0), xC2b: pubOf(k, F.SLIP_PIPS), published: k in PUBLISHED },
      placebo: { ...pl, beats: pl.values.filter((v) => F.summary(got).netR > v).length },
      everyOtherDay: F.summary(run.pool),
    };
  }
  const fourPub = pooled.filter((t) => t.pair in PUBLISHED);
  const pubFn = (slip) => (t) => atX(pubOf(t.pair, slip))(t);
  const c = costs(pooled), pl = placebo(parts);
  const enough = Object.values(per).filter((x) => x.years >= FLOOR.years).length >= FLOOR.crosses && pooled.length >= FLOOR.trades;
  const checks = { netPositive: c.base.meanR > 0, monthT: c.base.monthT != null && c.base.monthT >= T_BAR, positiveAt2x: c.x2.meanR > 0 };
  return {
    window: [pooled.length ? pooled.map((t) => t.day).sort()[0] : null, U_WINDOW[1]], crosses: per,
    pooled: { all: F.summary(pooled), costs: c, byYear: byYear(pooled), positiveCrosses: Object.values(per).filter((x) => x.all.netR > 0).length,
      pub: { c2aFour: at(fourPub, pubFn(0)), c2bFour: at(fourPub, pubFn(F.SLIP_PIPS)), c2aSix: at(pooled, pubFn(0)), c2bSix: at(pooled, pubFn(F.SLIP_PIPS)) },
      pOneSided: c.base.monthT == null ? 1 : pOneSided(c.base.monthT) },
    placebo: { ...pl, beats: pl.values.filter((v) => c.base.meanR > v).length, beatsP95: c.base.meanR > pl.p95 },
    checks, pass: Object.values(checks).every(Boolean), enough,
  };
}

// ---- N, supporting only ----------------------------------------------------------------------------------------------------
export function supporting(nzd, ujTrades) {
  const run = runLeg(nzd, N_WINDOW[0], N_WINDOW[1]);
  const got = run.got;
  return {
    pair: 'NZD/JPY', window: N_WINDOW, gotobiDays: run.gotobiDays, noData: run.noData,
    all: F.summary(got), costs: costs(got), h2016: F.summary(got.filter((t) => t.day >= '2016-01-01')), h2010: F.summary(got.filter((t) => t.day < '2016-01-01')),
    byYear: byYear(got), corrWithUsdjpyT2: corrByDay(got, ujTrades),
  };
}

// ---- Fisher, the ledger's way ----------------------------------------------------------------------------------------------
export function fisherBlock(uT) {
  const pO = pOneSided(LEDGER.original.t), pR2 = pOneSided(LEDGER.r2.t), pR1 = pOneSided(LEDGER.r1.t), pU = uT == null ? 1 : pOneSided(uT);
  const withR2 = fisherOut([LEDGER.original.id, LEDGER.r2.id], [pO, pR2]);
  const withU = fisherOut([LEDGER.original.id, 'U crosses 2005-09'], [pO, pU]);
  const weaker = withU.p > withR2.p ? withU : withR2;
  return {
    inputs: { original: { ...LEDGER.original, p: pO }, r2: { ...LEDGER.r2, p: pR2 }, r1: { ...LEDGER.r1, p: pR1 }, u: { id: 'U crosses 2005-09', t: uT, p: pU } },
    calendarDisjoint: { reading: 'U shares 2005-09 with #889 R2 on another instrument and no study pools them: each is combined with the original on its own, the weaker is shown (the ledger rule).', withR2, withU, weaker },
    threeWay: { ...fisherOut([LEDGER.original.id, LEDGER.r2.id, 'U crosses 2005-09'], [pO, pR2, pU]), upperBound: true, why: 'U and #889 R2 share the same 2005-09 days on correlated instruments: counted twice' },
    allCells: { ...fisherOut([LEDGER.original.id, LEDGER.r2.id, LEDGER.r1.id, 'U crosses 2005-09'], [pO, pR2, pR1, pU]), upperBound: true },
    bonferroniP: LEDGER.bonferroniP, ledgerCalendarDisjointP: LEDGER.calendarDisjointP,
  };
}

export function verdictOf(gateRes, U) {
  if (!gateRes.pass) return `NOT MEASURABLE (inconclusive: the gate failed, USD/JPY T2 2016-now gave n ${gateRes.summary.n}, ${gateRes.summary.netR}R, t ${gateRes.summary.t} against n 771, +0.148R, t 2.74)`;
  if (!U.enough) return `NOT MEASURABLE (inconclusive: U is under its floor, ${U.pooled.all.n} pooled trades)`;
  return U.pass ? 'REPLICATES' : 'DOES NOT REPLICATE';
}

// ---- report -----------------------------------------------------------------------------------------------------------------
const fmt = (v, d = 3) => (v == null ? 'n/a' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
const yn = (b) => (b ? 'yes' : 'no');
const fp = (p) => (p < 1e-3 ? p.toExponential(2) : p.toFixed(4));
const NAMES = { netPositive: 'pooled net R a trade > 0 at the base cost', monthT: 'pooled month t >= 2 at the base cost', positiveAt2x: 'pooled net R a trade > 0 at 2 x cost' };
export function report(o) {
  const L = [], U = o.u, P = U.pooled, C = P.costs, Fi = o.fisher;
  L.push('# Gotobi early years: the frozen T2 fade on yen pair-years no gotobi study has used', '');
  const fails = Object.entries(U.checks).filter(([, v]) => !v).map(([k]) => NAMES[k]);
  const why = o.verdict === 'REPLICATES' ? 'All three pre-registered conditions hold' : o.verdict === 'DOES NOT REPLICATE' ? `It fails on ${fails.join(', ')}` : 'See the gate and floor below';
  L.push(`**Verdict: ${o.verdict}.** ${why}: the six yen crosses EUR/JPY, GBP/JPY, AUD/JPY, CAD/JPY, CHF/JPY, NZD/JPY pooled, ${U.window[0]} to ${U.window[1]} (OANDA mid M5), n ${C.base.n}, ${fmt(C.base.meanR)}R a trade net at the original 1.30-pip cost, month t ${fmt(C.base.monthT, 2)}; at 2 x cost ${fmt(C.x2.meanR)}R (month t ${fmt(C.x2.monthT, 2)}). These pair-years were never used by a gotobi study, but they are the SAME calendar days as #889 R2 (USD/JPY 2005-09): no calendar year with intraday USD/JPY data is left unused. **Still not a net edge**: the spread and slippage at 00:55 and 06:00 UTC have not been measured on any yen pair, and the crosses' 0.3 pip spread is assumed. The rule is the gotobi study's T2, frozen byte for byte (frozen.mjs); pre-registered in PREREGISTRATION.md (first commit of the branch). Paper research only; nothing live changed.`, '');
  L.push(`**Gate: ${o.gate.pass ? 'PASSED' : 'FAILED'}.** The frozen file's own loop on USD/JPY (OANDA mid M5, fetched again) gives T2 2016-01-01 to ${GATE_LAST}: n ${o.gate.summary.n}, ${fmt(o.gate.summary.netR, 4)}R a trade, month t ${fmt(o.gate.summary.t, 2)} (#878: n 771, +0.148R, t 2.74).`, '');
  L.push('## The unused set', '');
  for (const n of o.coverage) L.push(`- ${n}`);
  L.push('', '## U pooled, at three costs', '');
  L.push('| Cost | n | Mean R a trade | Trade t | Month t | Months | Total R | Worst drawdown (R) |', '|---|---|---|---|---|---|---|---|');
  const crow = (name, s) => L.push(`| ${name} | ${s.n} | ${fmt(s.meanR)} | ${fmt(s.tradeT, 2)} | ${fmt(s.monthT, 2)} | ${s.months} | ${fmt(s.totalR, 1)} | ${s.worstDD.toFixed(1)} |`);
  crow('0 (gross)', C.gross); crow('**base, 1.30 pips + commission (C1)**', C.base); crow('2 x base', C.x2);
  crow('C2a published spread, no slippage (4 crosses with a figure)', P.pub.c2aFour); crow('C2b published spread + 2 x 0.5 slippage (4 crosses)', P.pub.c2bFour);
  crow(`C2a all six (EUR/JPY, NZD/JPY at ${PUB_STANDIN}, assumed)`, P.pub.c2aSix); crow(`C2b all six (EUR/JPY, NZD/JPY at ${PUB_STANDIN} + 1.0, assumed)`, P.pub.c2bSix);
  L.push('', '## The pre-registered conditions', '');
  L.push('| Condition | Value | Holds |', '|---|---|---|');
  L.push(`| Pooled net R a trade > 0 at the base cost | ${fmt(C.base.meanR)} | ${yn(U.checks.netPositive)} |`);
  L.push(`| Pooled month t >= 2 at the base cost | ${fmt(C.base.monthT, 2)} | ${yn(U.checks.monthT)} |`);
  L.push(`| Pooled net R a trade > 0 at 2 x cost | ${fmt(C.x2.meanR)} | ${yn(U.checks.positiveAt2x)} |`);
  L.push(`| Floor: >= ${FLOOR.crosses} crosses with >= ${FLOOR.years} years of trades, >= ${FLOOR.trades} pooled trades | ${Object.values(U.crosses).filter((x) => x.years >= FLOOR.years).length} crosses, ${P.all.n} trades | ${yn(U.enough)} |`);
  L.push('', '## Each cross (2005-09)', '');
  L.push('| Cross | First candle | n | Gross R | Net R (base) | Month t (base) | Net R (2 x) | Month t (2 x) | Worst DD base (R) | Win % | Stopped % | Median stop (pips) | Gotobi days lost |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of Object.values(U.crosses)) {
    if (!c.all.n) { L.push(`| ${c.pair} | ${c.firstCandle || 'none'} | 0 | | | | | | | | | | |`); continue; }
    L.push(`| ${c.pair} | ${c.firstCandle} | ${c.all.n} | ${fmt(c.costs.gross.meanR)} | ${fmt(c.costs.base.meanR)} | ${fmt(c.costs.base.monthT, 2)} | ${fmt(c.costs.x2.meanR)} | ${fmt(c.costs.x2.monthT, 2)} | ${c.costs.base.worstDD.toFixed(1)} | ${(c.all.win * 100).toFixed(1)} | ${(c.all.stopShare * 100).toFixed(1)} | ${c.all.stopPips} | ${c.noData.gotobi} of ${c.gotobiDays} |`);
  }
  L.push('', 'Published-cost case per cross (C2b = published spread + 2 x 0.5 pip slippage, commission on top; EUR/JPY and NZD/JPY have no published figure and take the stand-in, assumed):', '');
  L.push('| Cross | x C2a (pips) | C2a net R / month t | x C2b (pips) | C2b net R / month t |', '|---|---|---|---|---|');
  for (const c of Object.values(U.crosses)) if (c.all.n) L.push(`| ${c.pair}${c.pub.published ? '' : ' (stand-in)'} | ${c.pub.xC2a.toFixed(2)} | ${fmt(c.pub.c2a.meanR)} / ${fmt(c.pub.c2a.monthT, 2)} | ${c.pub.xC2b.toFixed(2)} | ${fmt(c.pub.c2b.meanR)} / ${fmt(c.pub.c2b.monthT, 2)} |`);
  L.push('', '## Placebo and every other day (reported, not a condition)', '');
  L.push('Each seed draws, from each cross\'s non-gotobi Tokyo business days of the same window, as many days as that cross has gotobi trades and runs the identical leg (#889\'s design), at the base cost.', '');
  L.push('| Market | Placebo median net R | Placebo 95th pct (38th of 40) | Gotobi beats | Every non-gotobi day: n | net R | month t |', '|---|---|---|---|---|---|---|');
  for (const c of Object.values(U.crosses)) if (c.all.n) L.push(`| ${c.pair} | ${fmt(c.placebo.median)} | ${fmt(c.placebo.p95)} | ${c.placebo.beats} of 40 | ${c.everyOtherDay.n} | ${fmt(c.everyOtherDay.netR)} | ${fmt(c.everyOtherDay.t, 2)} |`);
  L.push(`| **U pooled** | ${fmt(U.placebo.median)} | ${fmt(U.placebo.p95)} | ${U.placebo.beats} of 40 | | | |`);
  L.push('', '## By year (net R total at the base cost, gotobi trades)', '');
  const ys = Object.keys(P.byYear).sort();
  L.push(`| Market | ${ys.join(' | ')} |`, `|---|${ys.map(() => '---').join('|')}|`);
  for (const c of Object.values(U.crosses)) if (c.all.n) L.push(`| ${c.pair} | ${ys.map((y) => (c.byYear[y] ? fmt(c.byYear[y].totalR, 1) : '')).join(' | ')} |`);
  L.push(`| Pooled | ${ys.map((y) => (P.byYear[y] ? `${fmt(P.byYear[y].totalR, 1)} (${P.byYear[y].n})` : '')).join(' | ')} |`);
  L.push('', '## Fisher, the multiple-testing ledger\'s rule', '');
  L.push(`p = 1 − Φ(month t), one-sided; Fisher −2 Σ ln p on 2k df (functions copied from multiple-testing-update/run.mjs). Inputs: #878 T2 t ${LEDGER.original.t} (p ${fp(Fi.inputs.original.p)}), #889 R2 t ${LEDGER.r2.t} (p ${fp(Fi.inputs.r2.p)}), #889 R1 t ${LEDGER.r1.t} (p ${fp(Fi.inputs.r1.p)}), U t ${fmt(Fi.inputs.u.t, 2)} (p ${fp(Fi.inputs.u.p)}). Bonferroni line of the ledger: p < 1.50e-4.`, '');
  L.push('| Combination | Reading | Fisher p | z | Under Bonferroni |', '|---|---|---|---|---|');
  L.push(`| #878 T2 + #889 R2 | calendar-disjoint (the ledger's own figure) | ${fp(Fi.calendarDisjoint.withR2.p)} | ${fmt(Fi.calendarDisjoint.withR2.z, 2)} | ${yn(Fi.calendarDisjoint.withR2.belowBonferroni)} |`);
  L.push(`| #878 T2 + U | calendar-disjoint | ${fp(Fi.calendarDisjoint.withU.p)} | ${fmt(Fi.calendarDisjoint.withU.z, 2)} | ${yn(Fi.calendarDisjoint.withU.belowBonferroni)} |`);
  L.push(`| **the weaker of the two (the pre-registered reading)** | U and R2 share 2005-09 on other instruments | **${fp(Fi.calendarDisjoint.weaker.p)}** | ${fmt(Fi.calendarDisjoint.weaker.z, 2)} | ${yn(Fi.calendarDisjoint.weaker.belowBonferroni)} |`);
  L.push(`| #878 T2 + #889 R2 + U | upper bound: the same 2005-09 days counted twice | ${fp(Fi.threeWay.p)} | ${fmt(Fi.threeWay.z, 2)} | ${yn(Fi.threeWay.belowBonferroni)} |`);
  L.push(`| #878 T2 + #889 R2 + #889 R1 + U | upper bound: all cells | ${fp(Fi.allCells.p)} | ${fmt(Fi.allCells.z, 2)} | ${yn(Fi.allCells.belowBonferroni)} |`);
  const N = o.n;
  L.push('', '## Supporting: NZD/JPY 2010-now (never used by a gotobi study; same calendar days as #878 and #889 R1; not in the verdict or Fisher)', '');
  L.push('| Window | n | Gross R | Net R (base) | Month t (base) | Net R (2 x) | Month t (2 x) | Worst DD base (R) |', '|---|---|---|---|---|---|---|---|');
  L.push(`| ${N.window[0]} to ${N.window[1]} | ${N.costs.base.n} | ${fmt(N.costs.gross.meanR)} | ${fmt(N.costs.base.meanR)} | ${fmt(N.costs.base.monthT, 2)} | ${fmt(N.costs.x2.meanR)} | ${fmt(N.costs.x2.monthT, 2)} | ${N.costs.base.worstDD.toFixed(1)} |`);
  L.push(`| 2016-now | ${N.h2016.n} | ${fmt(N.h2016.grossR)} | ${fmt(N.h2016.netR)} | ${fmt(N.h2016.t, 2)} | | | |`);
  L.push(`| 2010-15 | ${N.h2010.n} | ${fmt(N.h2010.grossR)} | ${fmt(N.h2010.netR)} | ${fmt(N.h2010.t, 2)} | | | |`);
  L.push('', `Correlation of NZD/JPY's gotobi-day net R with USD/JPY's own T2 trade the same day (2016-now, the gate's trades): ${N.corrWithUsdjpyT2.r} over ${N.corrWithUsdjpyT2.days} days.`);
  L.push('', '## Notes', '');
  for (const n of o.notes) L.push(`- ${n}`);
  return L.join('\n') + '\n';
}

function notes(o) {
  const n = [], U = o.u, P = U.pooled;
  n.push(`Data: OANDA mid M5 through the /md/bars proxy (fetch.mjs), only candles starting 00:00-06:55 UTC kept. U: ${Object.values(U.crosses).map((c) => `${c.pair} from ${c.firstCandle}`).join(', ')}, through 2009-12-31. N: NZD/JPY ${o.data.nzdFirst} to ${o.data.nzdLast}. Gate: USD/JPY ${o.data.ujFirst} to ${o.data.ujLast}.`);
  n.push(`Costs: the frozen formula (0.3 pip spread + 2 x 0.5 pip slippage + 2 x USD 22.5 per million a side, the original 1.30-pip assumption) on every cross; the 0.3 pip spread is assumed, not measured, for every cross. Before costs U makes ${fmt(P.costs.gross.meanR)}R a trade; the base cost takes ${P.all.costR.toFixed(3)}R; at twice the cost ${fmt(P.costs.x2.meanR)}R. The C2 figures are gotobi-cost's published all-day averages (web search summaries, not measured, none for EUR/JPY or NZD/JPY).`);
  n.push(`Placebo (reported, not a condition): U's pooled ${fmt(P.costs.base.meanR)}R a trade is ${U.placebo.beatsP95 ? 'above' : 'not above'} the 95th percentile of 40 seeded draws of non-gotobi days (${fmt(U.placebo.p95)}R; beats ${U.placebo.beats} of 40).`);
  n.push(`Read after the verdict, not part of it: before costs U has month t ${fmt(P.costs.gross.monthT, 2)} (${fmt(P.costs.gross.meanR)}R a trade) and the gotobi days beat all ${U.placebo.beats === 40 ? '40' : U.placebo.beats} placebo draws, so on these pair-years the gotobi mornings are better than ordinary ones before costs; what fails is the cost bar: at the assumed 1.30 pips the pooled month t is ${fmt(P.costs.base.monthT, 2)} and at twice the cost the pooled figure is negative. Crosses split: GBP/JPY, CHF/JPY and EUR/JPY positive at the base cost, CAD/JPY about zero (+0.009R), AUD/JPY and NZD/JPY below zero, as on 2010-26 (#889: AUD/JPY weakest). 2007 is the one losing year of the pool.`);
  n.push('Read after the verdict: U is new pair-years, not new calendar years. The crosses\' gotobi-day results move with USD/JPY\'s on the same day (#889: correlation 0.5-0.8 on 2010-now), and #889 R2 already measured USD/JPY on these 2005-09 days, so U is mostly a second look at the same yen flow on the same mornings, through other pairs. The month t is on calendar-month sums of net R across the six crosses, which carries that correlation; the trade t treats every trade as independent and is shown only.');
  n.push('Worst drawdown: the largest peak-to-trough fall of cumulative R, the pooled trades in order of entry time then pair (six trades of a gotobi morning count one after another), at a fixed 1R a trade.');
  n.push('No calendar year with intraday USD/JPY data is unused: OANDA serves one stub candle a day before 2005 (20:55 UTC, nothing at 00:55 or 06:00), council-data HistData USD/JPY covers 2018-26 only (used by #894 / #912), and Dukascopy is not reachable from this sandbox.');
  return n;
}

async function main() {
  const [dir] = process.argv.slice(2);
  if (!dir) throw new Error('usage: node run.mjs <candleDir>');
  const rd = (f) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, f))));
  const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);
  const uj = rd('usdjpy-gate.json.gz');
  const g = gate(uj);
  console.log('gate', JSON.stringify(g.summary), g.pass);
  const early = {}; for (const k of Object.keys(CROSSES)) early[k] = rd(`${k}-early.json.gz`);
  const nzd = rd('nzdjpy-late.json.gz');
  const o = {
    study: 'gotobi-early-years', built: '2026-11-14', verdict: null,
    rule: 'The gotobi study\'s T2, frozen (frozen.mjs, sha256 645f2731…5e32): on gotobi days sell at the open of the 00:55 UTC M5 candle (09:55 Tokyo fix), buy back at 06:00 UTC; stop 1.5 x the 20-Tokyo-business-day median absolute move of the same window; net of 0.3 pip spread, 0.5 pip slippage a side and USD 22.5 per million a side.',
    data: { source: 'OANDA mid M5 through the /md/bars proxy, 00:00-06:55 UTC candles', ujFirst: day(uj[0][0]), ujLast: day(uj.at(-1)[0]), nzdFirst: day(nzd[0][0]), nzdLast: day(nzd.at(-1)[0]) },
    gate: { summary: g.summary, want: g.want, pass: g.pass },
  };
  if (!g.pass) {
    o.verdict = verdictOf(g, null);
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(o, null, 1) + '\n');
    console.log(o.verdict); return;
  }
  o.u = primary(early);
  o.n = supporting(nzd, g.trades);
  o.fisher = fisherBlock(o.u.pooled.costs.base.monthT);
  o.verdict = verdictOf(g, o.u);
  o.coverage = [
    'Used by the gotobi studies: USD/JPY 2005-01 to 2026-11 (OANDA; HistData 2018-26), EUR/JPY, GBP/JPY, AUD/JPY, CAD/JPY, CHF/JPY 2010-01 to 2026-11. Never used: NZD/JPY, and every cross before 2010.',
    'USD/JPY before 2005: OANDA serves one stub candle a day (20:55 UTC), nothing at 00:55 or 06:00 UTC: not computable. HistData in council-data: USD/JPY 2018-26 only, no yen cross.',
    `Primary set U: the six crosses from their first OANDA M5 candle (${Object.values(o.u.crosses).map((c) => `${c.pair} ${c.firstCandle}`).join(', ')}; first trade ${o.u.window[0]}) to 2009-12-31: ${o.u.pooled.all.n} gotobi trades, ${Object.values(o.u.crosses).map((c) => `${c.pair} ${c.all.n}`).join(', ')}.`,
    'U shares its calendar days with #889 R2 (USD/JPY 2005-09). Supporting set N: NZD/JPY 2010-01-01 to 2026-11-11 (same calendar as #878 and #889 R1).',
  ];
  o.notes = notes(o);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(o, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(o));
  console.log(o.verdict, JSON.stringify(o.u.pooled.costs));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
