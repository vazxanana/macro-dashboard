// Edge research · gold-vol-breakout-risk: a descriptive risk profile of the gold-vol-breakout study's T1 (UTC open ± 0.5 × the
// previous folded day's range, stop back at the open, out at 21:00 UTC) on OANDA spot gold M5, 2007-01 → 2026-10, as fixed in
// PREREGISTRATION.md. No hypothesis test, no rule change. Every trading function comes from replicate.mjs and original.mjs,
// verbatim copies of the replicate study's run.mjs and of the original study's run.mjs (sha256 pinned below); this file builds
// the daily R series, the risk table, the month-block bootstrap bands, the stop lines, the overlap with gold and the report.
//   node research/edge/gold-vol-breakout-risk/run.mjs <dir>      (<dir>/xau-5m.json.gz, OANDA mid M5 rows [t,o,h,l,c], out of git)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as O from './original.mjs';
import { daysOf, tradesIn } from './replicate.mjs';

export const ORIG_SHA = 'afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f';
export const REPL_SHA = '02002e8029c737e7804456bf22c6f3b7f2460c134782c2e6c280f7e68cb2449e';
export const T1 = O.TESTS.T1;
export const W = ['2007-01-01', '2026-10-31'];
export const IS = ['2007-01-01', '2016-12-31'], OOS = ['2017-01-01', '2026-10-31'];
export const GATE = {
  main: { w: ['2007-01-01', '2015-12-31'], want: { n: 1657, netR: 0.111, grossR: 0.203, t: 3.19, grossT: 5.96, net2R: 0.018 } },
  pooled: { w: ['2007-01-01', '2026-11-12'], want: { n: 3713, netR: 0.073, grossR: 0.155, t: 3.35, grossT: 7.24, net2R: -0.009 } },
};
export const HORIZONS = [12, 24, 36], PROTOCOL_M = 36, TEN_Y = 120;
export const DRAWS = 20000, SEED = 44, SEED_TEN = 45;
export const RISKS = [0.001, 0.0025, 0.005, 0.01];
export const WORLDS = { measured: 0, none: 1, losing: 2 };
export const YEAR_DAYS = 261;

const rN = (d) => (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(d));
const r1 = rN(1), r2 = rN(2), r3 = rN(3);
const sum = (a) => a.reduce((s, x) => s + x, 0);
const mean = (a) => (a.length ? sum(a) / a.length : NaN);
const sdv = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : NaN; };
const inW = (day, [a, b]) => day >= a && day <= b;

// ─── the record ───
// one value per built weekday in w: the trade's R (field `key`) on a trading day, 0 otherwise
export function dailySeries(days, trades, w, key = 'net') {
  const by = new Map(trades.map((x) => [x.day, x[key]])), keys = [], v = [];
  for (const d of days) if (inW(d.day, w)) { keys.push(d.day); v.push(by.get(d.day) ?? 0); }
  return { keys, v };
}
// worst closed drawdown from the running high (the record starts at 0), and the longest stretch under a running high
export function drawdown(v, keys = v.map((_, i) => i)) {
  let c = 0, pk = 0, pkI = -1, dd = 0, ddFrom = -1, ddLow = -1, under = 0, uFrom = -1, uTo = -1;
  for (let i = 0; i < v.length; i++) {
    c += v[i];
    if (c > pk) { if (i - pkI - 1 > under) { under = i - pkI - 1; uFrom = pkI; uTo = i; } pk = c; pkI = i; }
    else if (pk - c > dd) { dd = pk - c; ddFrom = pkI; ddLow = i; }
  }
  const open = v.length - 1 - pkI;                       // still under the last high at the end
  let regained = false; if (open > under) { under = open; uFrom = pkI; uTo = null; } else regained = true;
  // recovery of the worst drawdown: first index after its low above the high it fell from
  let rec = null;
  if (ddLow >= 0) { let cc = 0, hi = 0; for (let i = 0; i < v.length; i++) { cc += v[i]; if (i === ddFrom) hi = cc; if (i > ddLow && cc > hi) { rec = i; break; } } }
  const at = (i) => (i == null ? null : i < 0 ? 'start' : keys[i]);
  return { dd, ddFrom: at(ddFrom), ddLow: at(ddLow), ddRecovered: at(rec), under, underFrom: at(uFrom), underTo: uTo == null ? null : at(uTo), underOpenAtEnd: !regained && uTo == null };
}
export function losingStreak(trades) { let s = 0, best = 0; for (const x of trades) { s = x.net < 0 ? s + 1 : 0; if (s > best) best = s; } return best; }
export function monthsOf(keys, v) { const m = new Map(); keys.forEach((d, i) => { const k = d.slice(0, 7); if (!m.has(k)) m.set(k, []); m.get(k).push(v[i]); }); return m; }
export function yearSums(keys, v) { const y = {}; keys.forEach((d, i) => { const k = d.slice(0, 4); y[k] = (y[k] || 0) + v[i]; }); return y; }

// ─── bootstrap (path-to-live's method) ───
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const quant = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)))];
const sorted = (arr) => Array.from(arr).sort((a, b) => a - b);
const share = (arr, f) => { let n = 0; for (const x of arr) if (f(x)) n++; return n / arr.length; };
// DRAWS paths of whole months drawn with replacement; cum[h] and dd[h] over the draws at each horizon
export function simulate(months, horizons = HORIZONS, draws = DRAWS, seed = SEED) {
  const rnd = mulberry32(seed), H = Math.max(...horizons), cum = {}, dd = {};
  for (const h of horizons) { cum[h] = new Float64Array(draws); dd[h] = new Float64Array(draws); }
  for (let k = 0; k < draws; k++) {
    let c = 0, pk = 0, d = 0;
    for (let j = 1; j <= H; j++) {
      for (const x of months[Math.floor(rnd() * months.length)]) { c += x; if (c > pk) pk = c; else if (pk - c > d) d = pk - c; }
      if (cum[j]) { cum[j][k] = c; dd[j][k] = d; }
    }
  }
  return { cum, dd, draws };
}
// the stop lines from the as-measured world; their crossing rates in any world
export function stopLines(E) {
  const floor = Object.fromEntries(HORIZONS.map((h) => [h, quant(sorted(E.cum[h]), 0.05)]));
  return { S1: quant(sorted(E.dd[PROTOCOL_M]), 0.95), floor };
}
export function crossing(X, L) {
  const out = { S1: share(X.dd[PROTOCOL_M], (x) => x > L.S1) };
  HORIZONS.forEach((h, i) => { out['S' + (i + 2)] = share(X.cum[h], (x) => x < L.floor[h]); });
  let any = 0; for (let i = 0; i < X.draws; i++) if (X.dd[PROTOCOL_M][i] > L.S1 || HORIZONS.some((h) => X.cum[h][i] < L.floor[h])) any++;
  out.any = any / X.draws;
  return out;
}
// trades (or months) a record needs for t >= 2 at this mean and sd
export function needForT2(m, s) { return m > 0 && s > 0 ? Math.ceil((2 * s / m) ** 2) : null; }
export function pearson(a, b) {
  const ma = mean(a), mb = mean(b); let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < a.length; i++) { const x = a[i] - ma, y = b[i] - mb; sab += x * y; saa += x * x; sbb += y * y; }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : null;
}
// UTC-day closes (last candle of each UTC day) and each built weekday's return over the previous built weekday's close
export function goldReturns(rows, days) {
  const close = new Map(); for (const r of rows) close.set(Math.floor(r[0] / 86400) * 86400, r[4]);
  const ret = new Map(), closeOf = new Map();
  for (let i = 0; i < days.length; i++) {
    const c = close.get(days[i].d0); closeOf.set(days[i].day, c);
    if (i > 0) { const p = close.get(days[i - 1].d0); if (p > 0 && c > 0) ret.set(days[i].day, c / p - 1); }
  }
  return { ret, closeOf };
}
// the replicate's placeboIn with each seed's trades kept (same draws, same order; parity with placeboIn tested)
export function placeboRecords(pool, test = T1, seeds = O.SEEDS) {
  const grid = (O.PLACEBO.to - O.PLACEBO.from) / 300 + 1, res = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const rand = O.rng(seed), tr = [];
    for (const d of pool) {
      const startT = d.d0 + O.PLACEBO.from + 300 * Math.floor(rand() * grid), coin = rand();
      const side = test.sides === 'buy' ? 1 : coin < 0.5 ? 1 : -1;
      const x = O.placeboTrade(d.bars, { startT, side, dist: test.k * d.prevRange }); if (x) tr.push({ day: d.day, ...x });
    }
    res.push(tr);
  }
  return res;
}

const pick = (s) => ({ n: s.n, netR: s.netR, grossR: s.grossR, t: s.t, grossT: s.grossT, net2R: s.net2R });
export function gateCheck(got, want) { return { got: pick(got), want, ok: Object.keys(want).every((k) => got[k] === want[k]) }; }

// ─── everything, from the built days and the rows ───
export function profile(days, rows, { draws = DRAWS, placebo = true } = {}) {
  const gate = {};
  for (const [k, g] of Object.entries(GATE)) gate[k] = gateCheck(O.summary(tradesIn(days, g.w).tr), g.want);
  gate.ok = gate.main.ok && gate.pooled.ok;
  const { tr, pool, skips } = tradesIn(days, W);
  const S = O.summary(tr), sIS = O.summary(tr.filter((x) => inW(x.day, IS))), sOOS = O.summary(tr.filter((x) => inW(x.day, OOS)));
  const nov = O.summary(tradesIn(days, ['2026-11-01', '2026-11-30']).tr);
  const one = (key) => {
    const { keys, v } = dailySeries(days, tr, W, key), years = keys.length / YEAR_DAYS, dd = drawdown(v, keys);
    const mo = monthsOf(keys, v), mSums = [...mo.entries()].map(([k, a]) => [k, sum(a)]), ys = yearSums(keys, v);
    const worstM = mSums.reduce((a, b) => (b[1] < a[1] ? b : a)), yArr = Object.entries(ys).filter(([y]) => y !== '2026'), worstY = yArr.reduce((a, b) => (b[1] < a[1] ? b : a));
    let c = 0; const eq = mSums.map(([k, s]) => [k, r2(c += s)]);
    return { keys, v, mo, years, total: sum(v), perYear: sum(v) / years, dd, mSums, ys, worstM, worstY, eq,
      posMonths: mSums.filter(([, s]) => s > 0).length / mSums.length, streak: losingStreak(tr.map((x) => ({ net: x[key] }))) };
  };
  const R1 = one('net'), R2 = one('net2');
  const recOut = (R) => ({ total: r1(R.total), perYear: r2(R.perYear), tradesPerYear: r1(tr.length / R.years), weekdays: R.keys.length, years: r2(R.years), months: R.mSums.length,
    ddClosed: r2(R.dd.dd), ddFrom: R.dd.ddFrom, ddLow: R.dd.ddLow, ddRecovered: R.dd.ddRecovered,
    underWeekdays: R.dd.under, underYears: r2(R.dd.under / YEAR_DAYS), underFrom: R.dd.underFrom, underTo: R.dd.underTo, underOpenAtEnd: R.dd.underOpenAtEnd,
    worstMonth: { month: R.worstM[0], R: r2(R.worstM[1]) }, worstYear: { year: R.worstY[0], R: r2(R.worstY[1]), of: '2007-2025' }, partialYear: '2026 to October', byYear: Object.fromEntries(Object.entries(R.ys).map(([y, s]) => [y, r2(s)])), losingStreak: R.streak, posMonths: r3(R.posMonths), equity: R.eq });
  const record = { cost1: recOut(R1), cost2: recOut(R2) };

  // ── bootstrap worlds ──
  const meanT = mean(tr.map((x) => x.net)), sdT = sdv(tr.map((x) => x.net));
  const world = {}, raw = {};
  for (const [name, k] of Object.entries(WORLDS)) {
    const t2 = tr.map((x) => ({ ...x, net: x.net - k * meanT }));
    const { keys, v } = dailySeries(days, t2, W);
    raw[name] = simulate([...monthsOf(keys, v).values()], HORIZONS, draws, SEED);
  }
  const L = stopLines(raw.measured);
  for (const name of Object.keys(WORLDS)) {
    const X = raw[name];
    world[name] = { horizons: Object.fromEntries(HORIZONS.map((h) => { const c = sorted(X.cum[h]), d = sorted(X.dd[h]);
      return [h, { trades: Math.round(tr.length / R1.years * h / 12), cum: { p5: r1(quant(c, 0.05)), p50: r1(quant(c, 0.5)), p95: r1(quant(c, 0.95)) }, pLoss: r3(share(X.cum[h], (x) => x < 0)), dd: { p50: r1(quant(d, 0.5)), p95: r1(quant(d, 0.95)) } }]; })),
      crossing: Object.fromEntries(Object.entries(crossing(X, L)).map(([k, x]) => [k, r3(x)])) };
  }
  const ten = sorted(simulate([...R1.mo.values()], [TEN_Y], draws, SEED_TEN).dd[TEN_Y]), ddTen95 = quant(ten, 0.95), ddTen50 = quant(ten, 0.5);
  const risk = RISKS.map((r) => ({ risk: r, perYearPct: r2(R1.perYear * r * 100), ddClosedPct: r2(R1.dd.dd * r * 100), ddTenYears95Pct: r2(ddTen95 * r * 100), yearsUnder: r2(R1.dd.under / YEAR_DAYS),
    perYearPct2x: r2(R2.perYear * r * 100), ddClosedPct2x: r2(R2.dd.dd * r * 100) }));

  // ── trades needed for t >= 2 ──
  const mS = R1.mSums.map(([, s]) => s), mS2 = R2.mSums.map(([, s]) => s), perYear = tr.length / R1.years;
  const net2 = tr.map((x) => x.net2), need = (m, s) => needForT2(m, s);
  const prove = { cost1: { mean: r3(meanT), sd: r3(sdT), trades: need(meanT, sdT), years: r1(need(meanT, sdT) / perYear), monthMean: r3(mean(mS)), monthSd: r3(sdv(mS)), months: need(mean(mS), sdv(mS)) },
    cost2: { mean: r3(mean(net2)), sd: r3(sdv(net2)), trades: need(mean(net2), sdv(net2)), years: need(mean(net2), sdv(net2)) == null ? null : r1(need(mean(net2), sdv(net2)) / perYear), monthMean: r3(mean(mS2)), monthSd: r3(sdv(mS2)), months: need(mean(mS2), sdv(mS2)) } };

  // ── overlap with gold ──
  const { ret, closeOf } = goldReturns(rows, days);
  const allI = R1.keys.map((d, i) => i).filter((i) => ret.has(R1.keys[i]));
  const trDays = new Set(tr.map((x) => x.day)), tdI = allI.filter((i) => trDays.has(R1.keys[i]));
  const mClose = new Map(); for (const d of days) if (closeOf.get(d.day) > 0) mClose.set(d.day.slice(0, 7), closeOf.get(d.day));
  const mk = [...mClose.keys()], mRet = new Map(); for (let i = 1; i < mk.length; i++) mRet.set(mk[i], mClose.get(mk[i]) / mClose.get(mk[i - 1]) - 1);
  const mPairs = R1.mSums.filter(([k]) => mRet.has(k));
  const trUp = tr.filter((x) => ret.get(x.day) > 0), trDn = tr.filter((x) => ret.get(x.day) < 0);
  const sideOf = (s) => { const a = tr.filter((x) => x.side === s); return { n: a.length, netR: r3(mean(a.map((x) => x.net))) }; };
  const overlap = { dailyAll: { n: allI.length, r: r3(pearson(allI.map((i) => R1.v[i]), allI.map((i) => ret.get(R1.keys[i])))) },
    dailyTrades: { n: tdI.length, r: r3(pearson(tdI.map((i) => R1.v[i]), tdI.map((i) => ret.get(R1.keys[i])))) },
    monthly: { n: mPairs.length, r: r3(pearson(mPairs.map(([, s]) => s), mPairs.map(([k]) => mRet.get(k)))) },
    goldUp: { n: trUp.length, netR: r3(mean(trUp.map((x) => x.net))) }, goldDown: { n: trDn.length, netR: r3(mean(trDn.map((x) => x.net))) },
    buys: sideOf(1), sells: sideOf(-1) };

  // ── placebo ──
  let pl = null;
  if (placebo) {
    const recs = placeboRecords(pool), means = recs.map((a) => mean(a.map((x) => x.net))), dds = recs.map((a) => drawdown(dailySeries(days, a, W).v).dd);
    pl = { seeds: recs.length, means: means.map(r3), median: r3(O.quantile(means, 0.5)), p95: r3(O.quantile(means, 0.95)), beaten: means.filter((m) => meanT > m).length,
      dd: { median: r1(O.quantile(dds, 0.5)), min: r1(Math.min(...dds)), max: r1(Math.max(...dds)) }, n: r1(mean(recs.map((a) => a.length))) };
  }

  return { gate, window: W, skips, summary: { all: S, IS: sIS, OOS: sOOS, nov2026: pick(nov) }, record, prove,
    bands: { draws, seed: SEED, method: 'month-block bootstrap of the daily net R series of W (whole calendar months with replacement); "none" and "losing" take 1x and 2x the mean net R a trade off every trade',
      lines: { S1: r1(L.S1), S2: r1(L.floor[12]), S3: r1(L.floor[24]), S4: r1(L.floor[36]) }, worlds: world },
    tenYear: { draws, seed: SEED_TEN, p50: r1(ddTen50), p95: r1(ddTen95) }, risk, overlap, placebo: pl };
}

// ─── report (RESULT.md is this function of result.json) ───
const sg = (v, d = 3) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
const s2 = (v) => sg(v, 2), s1 = (v) => sg(v, 1);
const pc = (v) => (v == null ? '—' : (v * 100).toFixed(1) + ' %');
const neg = (v, d = 1) => (v == null ? '—' : '−' + Math.abs(v).toFixed(d));
export function verdictLine(R) {
  const c = R.record.cost1, m = R.bands.worlds.measured.horizons[12], L = R.bands.lines;
  return `Descriptive risk profile, no test: T1 2007-26 ${sg(R.summary.all.netR)}R a trade net (n ${R.summary.all.n}, month t ${s2(R.summary.all.t)}), worst drawdown ${neg(c.ddClosed)}R, 12-month band ${s1(m.cum.p5)} to ${s1(m.cum.p95)}R, stop line ${s1(L.S2)}R`;
}
export function reading(R) {
  const c = R.record.cost1, P = R.prove.cost1, W = R.bands.worlds, L = R.bands.lines, m12 = W.measured.horizons[12], n12 = W.none.horizons[12];
  return `A 12-month paper record of T1 is about ${m12.trades} trades. If the rule is exactly as measured on 2007-26, its year ends between ${s1(m12.cum.p5)}R and ${s1(m12.cum.p95)}R nine times in ten (median ${s1(m12.cum.p50)}R) and is a losing year ${pc(m12.pLoss)} of the time; if it has no edge at all, the year ends between ${s1(n12.cum.p5)}R and ${s1(n12.cum.p95)}R (median ${s1(n12.cum.p50)}R). The two ranges overlap almost entirely, so one year cannot show that the rule works or that it does not: the 12-month line (${s1(L.S2)}R) stops a rule with no edge only ${pc(W.none.crossing.S2)} of the time and a losing one ${pc(W.losing.crossing.S2)}, and a forward t of 2 at the measured mean takes about ${P.trades} trades, ${P.years} years. The history itself had a ${c.underYears}-year stretch under water (${c.underFrom} to ${c.underTo}) and the out-of-sample stretch 2017-26 made ${sg(R.summary.OOS.netR)}R a trade (month t ${s2(R.summary.OOS.t)}). What a year can show is the part the backtest cannot: whether every trade really carries its stop at the open, whether the orders fill near the levels, and above all what a round trip really costs. Costs are ${sg(R.summary.all.costR).replace('+', '')}R of the ${sg(R.summary.all.grossR)}R gross a trade, and at twice the assumed $0.60 the 2007-26 record is ${sg(R.summary.all.net2R)}R a trade (${s1(R.record.cost2.total)}R in all, under water since ${R.record.cost2.underFrom}); a measured demo cost is the one figure a 12-month record can settle.`;
}
export function report(R) {
  const L = [], c = R.record.cost1, c2 = R.record.cost2, B = R.bands, yn = (b) => (b ? 'yes' : 'no');
  const srow = (lab, x) => `| ${lab} | ${x.n} | ${sg(x.netR)} | ${sg(x.grossR)} | ${s2(x.t)} | ${s2(x.grossT)} | ${sg(x.net2R)} |`;
  L.push('# Gold: what to expect from the intraday volatility breakout (risk profile)', '');
  L.push('Paper research only. A descriptive risk profile of a stand-alone intraday rule on spot gold, the `gold-vol-breakout` study\'s T1, for the owner to read before any paper or demo step. No hypothesis is tested and nothing passes or fails. The rule is not a gate, exit, entry or size of the live gold book, and none of that book\'s records were read (owner decision 44). Nothing live changed; no proposal is written. The plan was pushed first (`PREREGISTRATION.md`, sha256 in `result.json`); the trading code is the replicate study\'s, copied verbatim (`replicate.mjs`, `original.mjs`, sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.', '');
  L.push(`**Verdict: ${R.verdict}**`, '');
  L.push('## Harness gate', '', '| Window | n | Net R | Gross R | Month t | Gross t | Net 2x | Replicate study | Exact |', '|---|---|---|---|---|---|---|---|---|');
  for (const [k, lab] of [['main', '2007-2015'], ['pooled', `2007 → ${R.dataEnd}`]]) { const g = R.gate[k], x = g.got, w = g.want; L.push(`| ${lab} | ${x.n} | ${sg(x.netR)} | ${sg(x.grossR)} | ${s2(x.t)} | ${s2(x.grossT)} | ${sg(x.net2R)} | ${w.n} / ${sg(w.netR)} / ${s2(w.t)} | ${yn(g.ok)} |`); }
  L.push('', `## The record, ${R.window[0]} → ${R.window[1]} (whole months)`, '');
  L.push('| Window | n | Net R/trade | Gross R/trade | Month t (net) | Month t (gross) | Net at 2x cost |', '|---|---|---|---|---|---|---|');
  L.push(srow('2007-2026-10', R.summary.all), srow('in sample 2007-2016', R.summary.IS), srow('out of sample 2017-2026-10', R.summary.OOS));
  L.push('', `Outside every figure: 1-12 Nov 2026, ${R.summary.nov2026.n} trades, ${sg(R.summary.nov2026.netR)}R a trade net. The month t figures describe the record; they are not tests (no p-value, no Holm).`, '');
  L.push('| At | Total R | R a year | Trades a year | Worst closed drawdown | Drawdown from → low → regained | Longest under water | Worst month | Worst year (2007-25) | Longest losing streak | Months positive |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [lab, x] of [['$0.60 a round trip', c], ['2x costs ($1.20)', c2]]) L.push(`| ${lab} | ${s1(x.total)} | ${s2(x.perYear)} | ${x.tradesPerYear} | ${neg(x.ddClosed, 2)}R | ${x.ddFrom} → ${x.ddLow} → ${x.ddRecovered ?? 'not regained'} | ${x.underYears} years (${x.underFrom} → ${x.underTo ?? 'still under'}) | ${x.worstMonth.month} ${s2(x.worstMonth.R)}R | ${x.worstYear.year} ${s2(x.worstYear.R)}R | ${x.losingStreak} trades | ${pc(x.posMonths)} |`);
  L.push('', '| Year | Net R at $0.60 | Net R at 2x |', '|---|---|---|');
  for (const y of Object.keys(c.byYear)) L.push(`| ${y}${y === '2026' ? ' (to October)' : ''} | ${s2(c.byYear[y])} | ${s2(c2.byYear[y])} |`);
  L.push('', '## Risk a trade, in % of the account (simple, not compounded)', '');
  L.push(`One trade a day at most, so the open risk is never more than one trade's. Simple % means R × risk with no compounding, so a figure past −100 % says the account would be gone, not a real percentage. The 1-in-20 ten-year drawdown is the 95th percentile of the worst closed drawdown over 120 months drawn by month-block bootstrap (${R.tenYear.draws} draws, seed ${R.tenYear.seed}): ${neg(R.tenYear.p95)}R (median ${neg(R.tenYear.p50)}R).`, '');
  L.push('| Risk a trade | % a year | Worst drawdown % (history) | 1-in-20 ten-year drawdown % | Years under water (history) | % a year at 2x costs | Worst drawdown % at 2x costs |', '|---|---|---|---|---|---|---|');
  for (const r of R.risk) L.push(`| ${+(r.risk * 100).toFixed(2)} % | ${s2(r.perYearPct)} | ${neg(r.ddClosedPct, 2)} | ${neg(r.ddTenYears95Pct, 2)} | ${r.yearsUnder} | ${s2(r.perYearPct2x)} | ${neg(r.ddClosedPct2x, 2)} |`);
  L.push('', '## Forward bands and pre-committed stop lines', '');
  L.push(`Month-block bootstrap of the daily net R of the record (${B.draws} draws, seed ${B.seed}): each path draws whole calendar months with replacement. "No edge" and "losing" take 1x and 2x the mean net R a trade (${sg(R.prove.cost1.mean)}R) off every trade.`, '');
  L.push('| World | Months | Trades | Total p5 | p50 | p95 | Total below 0 | Drawdown p50 | Drawdown p95 |', '|---|---|---|---|---|---|---|---|---|');
  const wn = { measured: 'as measured', none: 'no edge', losing: 'losing (2x mean off)' };
  for (const [k, lab] of Object.entries(wn)) for (const h of [12, 24, 36]) { const x = B.worlds[k].horizons[h]; L.push(`| ${lab} | ${h} | ${x.trades} | ${s1(x.cum.p5)} | ${s1(x.cum.p50)} | ${s1(x.cum.p95)} | ${pc(x.pLoss)} | ${neg(x.dd.p50)} | ${neg(x.dd.p95)} |`); }
  L.push('', 'Stop lines, fixed from the as-measured world before any forward record exists. A line crossed would send the rule back off paper by the owner\'s decision; it never closes a trade.', '');
  L.push('| Line | Level | False alarm (as measured) | Detected: no edge | Detected: losing |', '|---|---|---|---|---|');
  const lines = [['S1', `worst closed drawdown over ${Math.abs(B.lines.S1).toFixed(1)}R at any time in 36 months`], ['S2', `total under ${s1(B.lines.S2)}R at 12 months`], ['S3', `total under ${s1(B.lines.S3)}R at 24 months`], ['S4', `total under ${s1(B.lines.S4)}R at 36 months`], ['any', 'any of S1-S4 within 36 months']];
  for (const [k, lab] of lines) L.push(`| ${k} | ${lab} | ${pc(B.worlds.measured.crossing[k])} | ${pc(B.worlds.none.crossing[k])} | ${pc(B.worlds.losing.crossing[k])} |`);
  const P = R.prove;
  L.push('', '## How long a forward record needs for t ≥ 2', '');
  L.push('| At | Mean net R a trade | sd | Trades for t ≥ 2 | Years | Month mean / sd | Months for t ≥ 2 |', '|---|---|---|---|---|---|---|');
  for (const [lab, x] of [['$0.60', P.cost1], ['2x costs', P.cost2]]) L.push(`| ${lab} | ${sg(x.mean)} | ${x.sd} | ${x.trades ?? 'never (mean not positive)'} | ${x.years ?? '—'} | ${sg(x.monthMean)} / ${x.monthSd} | ${x.months ?? 'never'} |`);
  const V = R.overlap;
  L.push('', '## Overlap with gold (descriptive)', '', 'The live book\'s records were not read (owner decision 44); gold\'s own return stands in for a long-gold holding.', '');
  L.push('| Measure | n | Value |', '|---|---|---|');
  L.push(`| Correlation, T1 daily net R with gold's same-day return, every weekday | ${V.dailyAll.n} | ${sg(V.dailyAll.r)} |`, `| The same, trading days only | ${V.dailyTrades.n} | ${sg(V.dailyTrades.r)} |`, `| Correlation, T1 monthly R with long-gold buy-and-hold's monthly return | ${V.monthly.n} | ${sg(V.monthly.r)} |`);
  L.push(`| Net R a trade on days gold closed up | ${V.goldUp.n} | ${sg(V.goldUp.netR)} |`, `| Net R a trade on days gold closed down | ${V.goldDown.n} | ${sg(V.goldDown.netR)} |`, `| Buys | ${V.buys.n} | ${sg(V.buys.netR)} |`, `| Sells | ${V.sells.n} | ${sg(V.sells.netR)} |`);
  const p = R.placebo;
  L.push('', '## Placebo (40 seeds, context)', '', 'The replicate study\'s placebo on the days T1 could trade: a market entry at a random 5-minute mark 01:00-18:00 UTC, fair-coin side, stop 0.5 × the previous day\'s range away, out at 21:00 UTC or the stop, the same costs. It trades on every eligible day (no fill needed), so it takes more trades than T1 and its drawdowns are larger for that reason too.', '');
  L.push('| T1 net R a trade | Placebo median | Placebo 95th percentile | Seeds beaten | Placebo trades a record | Placebo worst drawdown median (min / max) | T1 worst drawdown |', '|---|---|---|---|---|---|---|');
  L.push(`| ${sg(R.summary.all.netR)} | ${sg(p.median)} | ${sg(p.p95)} | ${p.beaten} of ${p.seeds} | ${p.n} | ${neg(p.dd.median)}R (${neg(p.dd.min)} / ${neg(p.dd.max)}) | ${neg(c.ddClosed, 2)}R |`);
  L.push('', '## What a 12-month paper record could and could not show', '', R.reading, '');
  L.push('## Data and method', '');
  L.push(`- ${R.data}`, `- Rule: ${R.rule}`, '- Costs: $0.60 a round trip per ounce (the original study\'s fixed figure, today\'s level; older spreads were not measured), 2x reported; financing `FIN.xau.long` × `nights` on buys (no trade crosses the 22:00 UTC rollover: 0).', '- Daily R series: one value per built weekday, 0 on a day without a trade; drawdowns are closed (end of day), from the running high, the record starting at 0. Risk figures are simple %, not compounded.', '- To repeat: `node research/edge/gold-vol-breakout-risk/run.mjs <dir>` with `<dir>/xau-5m.json.gz` (OANDA mid M5 XAU/USD 2006-11 on, from the candle proxy, out of git).');
  return L.join('\n') + '\n';
}

// ─── main ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candleDir>');
  const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, f))).digest('hex');
  if (sha('original.mjs') !== ORIG_SHA || sha('replicate.mjs') !== REPL_SHA) throw new Error('original.mjs / replicate.mjs are not the verbatim copies');
  const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'xau-5m.json.gz'))));
  const { days, dataEnd } = daysOf(rows);
  const P = profile(days, rows);
  if (!P.gate.ok) { console.log(JSON.stringify(P.gate, null, 1)); throw new Error('harness gate: the replicate study\'s figures are not reproduced exactly'); }
  const result = { study: 'gold-vol-breakout-risk', built: '2026-11-14', preregistration: 'research/edge/gold-vol-breakout-risk/PREREGISTRATION.md', planSha256: sha('PREREGISTRATION.md'),
    copies: { 'original.mjs': ORIG_SHA, 'replicate.mjs': REPL_SHA, from: 'branch gold-vol-breakout-replicate, commit 3360a2cfd' },
    claim: 'none: a descriptive risk profile of the gold-vol-breakout T1 rule (what a paper or demo record should look like), no test',
    rule: 'O = open of the first M5 candle 00:00-00:55 UTC; prevRange = high − low of the previous weekend-folded UTC D1; buy stop O + 0.5 × prevRange and sell stop O − 0.5 × prevRange live 00:00-20:55 UTC, first filled wins; stop back at O (worst case in the fill candle); out at the 20:55 candle close',
    data: `OANDA mid XAU/USD M5 through the keyless candle proxy; ${days.length} weekdays built ${days[0].day} → ${dataEnd}; D1 = complete UTC days folded with council/fills.mjs foldWeekend`,
    dataEnd, cost: O.COST, paperOnly: true, ...P };
  result.verdict = verdictLine(result);
  result.reading = reading(result);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(result, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(result));
  console.log(result.verdict);
}
