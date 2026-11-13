// Edge research · rsi2-replicate (PREREGISTRATION.md, committed first).
// The 2-day RSI pullback of research/edge/rsi2-pullback, frozen, on six non-US indices: DE40, UK100, JP225, AU200, EU50, FR40.
// The rule's functions come from ./rsi2-pullback.mjs, an unchanged copy of that study's run.mjs (branch rsi2-pullback, PR #838,
// not merged when this was written; sha256 pinned in tests/rsi2-replicate.test.mjs). Nothing in it is edited.
// Costs: stated round-trip points + financing at (local policy rate + 2.5 %) a year per calendar night.
// Verdict: one pooled test (equal risk per trade, in R) on 2016-now; 2008-15 reported.
//   node run.mjs fetch <dir>   copies the six daily candle files (+ macro/cache.json for the USD sensitivity) out of council-data
//   node run.mjs full <dir>    writes result.json next to this file
// Paper research: nothing here is read by the council, the mirror or the page.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { P, candles, sma, atr, simulate, net, summary, tstat, monthSums, rng, placebo, pct } from './rsi2-pullback.mjs';

export const MARKETS = {
  de40: { inst: 'DE30_EUR', cost: 2.5, bank: 'ecb' },
  uk100: { inst: 'UK100_GBP', cost: 2.0, bank: 'boe' },
  jp225: { inst: 'JP225_USD', cost: 14.0, bank: 'boj' },
  au200: { inst: 'AU200_AUD', cost: 2.0, bank: 'rba' },
  eu50: { inst: 'EU50_EUR', cost: 2.5, bank: 'ecb' },
  fr40: { inst: 'FR40_EUR', cost: 2.0, bank: 'ecb' },
};
export const WINDOWS = { A: ['2008-01-01', '2015-12-31'], B: ['2016-01-01', '2099-12-31'] };
// Policy rates in force from each date (PREREGISTRATION.md lists the same; the test compares them).
const S = (s) => s.trim().split(/,\s*/).map((x) => { const [d, v] = x.trim().split(/\s+/); return [d, +v]; });
export const RATES = {
  ecb: S(`2007-06-13 3.00, 2008-07-09 3.25, 2008-11-12 2.75, 2008-12-10 2.00, 2009-01-21 1.00, 2009-03-11 0.50,
    2009-04-08 0.25, 2011-04-13 0.50, 2011-07-13 0.75, 2011-11-09 0.50, 2011-12-14 0.25, 2012-07-11 0.00, 2014-06-11 -0.10,
    2014-09-10 -0.20, 2015-12-09 -0.30, 2016-03-16 -0.40, 2019-09-18 -0.50, 2022-07-27 0.00, 2022-09-14 0.75, 2022-11-02 1.50,
    2022-12-21 2.00, 2023-02-08 2.50, 2023-03-22 3.00, 2023-05-10 3.25, 2023-06-21 3.50, 2023-08-02 3.75, 2023-09-20 4.00,
    2024-06-12 3.75, 2024-09-18 3.50, 2024-10-23 3.25, 2024-12-18 3.00, 2025-02-05 2.75, 2025-03-12 2.50, 2025-04-23 2.25,
    2025-06-11 2.00`),
  boe: S(`2007-07-05 5.75, 2007-12-06 5.50, 2008-02-07 5.25, 2008-04-10 5.00, 2008-10-08 4.50,
    2008-11-06 3.00, 2008-12-04 2.00, 2009-01-08 1.50, 2009-02-05 1.00, 2009-03-05 0.50, 2016-08-04 0.25, 2017-11-02 0.50,
    2018-08-02 0.75, 2020-03-11 0.25, 2020-03-19 0.10, 2021-12-16 0.25, 2022-02-03 0.50, 2022-03-17 0.75, 2022-05-05 1.00,
    2022-06-16 1.25, 2022-08-04 1.75, 2022-09-22 2.25, 2022-11-03 3.00, 2022-12-15 3.50, 2023-02-02 4.00, 2023-03-23 4.25,
    2023-05-11 4.50, 2023-06-22 5.00, 2023-08-03 5.25, 2024-08-01 5.00, 2024-11-07 4.75, 2025-02-06 4.50, 2025-05-08 4.25,
    2025-08-07 4.00`),
  boj: S(`2007-02-21 0.50, 2008-10-31 0.30, 2008-12-19 0.10, 2010-10-05 0.05, 2016-02-16 -0.10, 2024-03-19 0.05,
    2024-07-31 0.25, 2025-01-24 0.50`),
  rba: S(`2007-08-08 6.50, 2007-11-07 6.75, 2008-02-06 7.00, 2008-03-05 7.25, 2008-09-03 7.00, 2008-10-08 6.00,
    2008-11-05 5.25, 2008-12-03 4.25, 2009-02-04 3.25, 2009-04-08 3.00, 2009-10-07 3.25, 2009-11-04 3.50, 2009-12-02 3.75,
    2010-03-03 4.00, 2010-04-07 4.25, 2010-05-05 4.50, 2010-11-03 4.75, 2011-11-02 4.50, 2011-12-07 4.25, 2012-05-02 3.75,
    2012-06-06 3.50, 2012-10-03 3.25, 2012-12-05 3.00, 2013-05-08 2.75, 2013-08-07 2.50, 2015-02-04 2.25, 2015-05-06 2.00,
    2016-05-04 1.75, 2016-08-03 1.50, 2019-06-05 1.25, 2019-07-03 1.00, 2019-10-02 0.75, 2020-03-04 0.50, 2020-03-20 0.25,
    2020-11-04 0.10, 2022-05-04 0.35, 2022-06-08 0.85, 2022-07-06 1.35, 2022-08-03 1.85, 2022-09-07 2.35, 2022-10-05 2.60,
    2022-11-02 2.85, 2022-12-07 3.10, 2023-02-08 3.35, 2023-03-08 3.60, 2023-05-03 3.85, 2023-06-07 4.10, 2023-11-08 4.35,
    2025-02-19 4.10, 2025-05-21 3.85, 2025-08-13 3.60`),
};
export const US_NEAR_MISS = { spx500: { avgR: 0.112, tMonths: 1.83, holmP: 0.0651 }, us30: { avgR: 0.087, tMonths: 2.28, holmP: 0.0651 }, nas100: { avgR: 0.061, tMonths: 1.29 } };

const DAY = 86400, T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const r3 = (v) => (Number.isFinite(v) ? +v.toFixed(3) : null);
const r2 = (v) => (Number.isFinite(v) ? +v.toFixed(2) : null);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// The original `placebo` procedure, step for step, returning its trades instead of their mean % (so they can be read in R).
// The test checks that the mean of these trades' `ret` equals the original placebo() for the same seed.
export function placeboTrades(D, real, cost, rates, from, to, seed) {
  const s200 = sma(D, P.SMA_LONG), lo = T(from), hi = T(to) + DAY - 1, R = rng(seed);
  const elig = []; for (let i = P.SMA_LONG; i < D.length - 1; i++) if (D[i].time >= lo && D[i].time <= hi && D[i].close > s200[i] && atr(D, i) > 0) elig.push(i);
  const out = [];
  for (const tr of real) {
    const i = elig[Math.floor(R() * elig.length)], e = i + 1, risk = P.STOP_ATR * atr(D, i), entry = D[e].open, stop = entry - risk;
    const jEnd = Math.min(D.length - 1, e + tr.hold);
    let j = jEnd, exit = D[jEnd].open, why = 'hold';
    if (tr.hold === 0) { exit = D[e].close; }
    for (let k = e; k < jEnd || (tr.hold === 0 && k === e); k++) { if (D[k].low <= stop) { j = k; exit = Math.min(D[k].open, stop); why = 'stop'; break; } if (tr.hold === 0) break; }
    out.push(net({ i: e, j, entry, exit, why, stop, risk, tIn: D[e].time, tOut: D[j].time, hold: j - e }, cost, rates));
  }
  return out;
}

const inWin = (tr, from, to) => tr.filter((t) => t.tIn >= T(from) && t.tIn <= T(to) + DAY - 1);
const asR = (tr) => tr.map((t) => ({ tOut: t.tOut, ret: t.R }));

// ── the study ──
export function study(data, { usdRates = null } = {}) {
  const markets = {}, pooled = { A: [], B: [] }, Ds = {};
  let lastDay = '0000';
  for (const [k, m] of Object.entries(MARKETS)) {
    const D = candles(data[k].rows); Ds[k] = D;
    if (ymd(D.at(-1).time) > lastDay) lastDay = ymd(D.at(-1).time);
    const all = simulate(D).map((t) => net(t, m.cost, RATES[m.bank]));
    const win = {};
    for (const [w, [from, to0]] of Object.entries(WINDOWS)) {
      const to = to0 > ymd(D.at(-1).time) ? ymd(D.at(-1).time) : to0;
      const tr = inWin(all, from, to);
      win[w] = { from, to, ...summary(tr, from, to), tMonthsR: r2(tstat(monthSums(asR(tr), from, to))) };
      pooled[w].push(...tr.map((t) => ({ ...t, market: k })));
    }
    markets[k] = { inst: m.inst, cost: m.cost, bank: m.bank, data: { from: ymd(D[0].time), to: ymd(D.at(-1).time), days: D.length }, ...win, years: byYear(all) };
    if (k === 'jp225' && usdRates) {
      const B = inWin(simulate(D).map((t) => net(t, m.cost, usdRates)), WINDOWS.B[0], ymd(D.at(-1).time));
      markets[k].usdFinancingB = { note: 'DGS2 + 2.5 % instead of the BoJ rate (sensitivity, not decisive)', avgR: r3(mean(B.map((t) => t.R))), avgRet: r3(mean(B.map((t) => t.ret))) };
    }
  }
  const pool = {};
  for (const [w, [from, to0]] of Object.entries(WINDOWS)) {
    const to = to0 > lastDay ? lastDay : to0, tr = pooled[w].sort((a, b) => a.tIn - b.tIn);
    const Rs = tr.map((t) => t.R);
    let eq = 0, pk = 0, dd = 0; for (const x of Rs) { eq += x; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
    pool[w] = {
      from, to, n: tr.length, avgR: r3(mean(Rs)), avgGrossR: r3(mean(tr.map((t) => (t.exit - t.entry) / t.risk))), totalR: r2(eq),
      wr: r2(100 * tr.filter((t) => t.R > 0).length / tr.length), tTradesR: r2(tstat(Rs)), tMonthsR: r2(tstat(monthSums(asR(tr), from, to))),
      ddR: r2(dd), positiveMarkets: Object.values(markets).filter((m) => m[w].avgR > 0).length,
    };
  }
  // placebo, window B, pooled in R
  const seedMeans = [];
  for (let s = 1; s <= P.SEEDS; s++) {
    const all = [];
    for (const [k, m] of Object.entries(MARKETS)) {
      const D = Ds[k], to = ymd(D.at(-1).time);
      const real = inWin(simulate(D).map((t) => net(t, m.cost, RATES[m.bank])), WINDOWS.B[0], to);
      all.push(...placeboTrades(D, real, m.cost, RATES[m.bank], WINDOWS.B[0], to, s));
    }
    seedMeans.push(mean(all.map((t) => t.R)));
  }
  pool.B.placebo = { seeds: P.SEEDS, mean: r3(mean(seedMeans)), p95: r3(pct(seedMeans, 0.95)) };
  // same-day entries across markets (descriptive)
  const days = new Map(); for (const t of pooled.B) { const d = ymd(t.tIn); days.set(d, (days.get(d) || 0) + 1); }
  pool.B.entryDays = days.size; pool.B.sharedEntryTrades = pooled.B.filter((t) => days.get(ymd(t.tIn)) > 1).length;
  const B = pool.B;
  const checks = { positive: B.avgR > 0, tMonths: B.tMonthsR >= 2, markets4of6: B.positiveMarkets >= 4, placebo: B.avgR > B.placebo.p95 };
  return { verdict: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL', checks, pool, markets };
}
function byYear(tr) {
  const y = {};
  for (const t of tr) { const k = ymd(t.tIn).slice(0, 4); (y[k] ||= []).push(t); }
  return Object.fromEntries(Object.entries(y).map(([k, v]) => [k, { n: v.length, sumR: r2(v.reduce((a, t) => a + t.R, 0)) }]));
}

// ── CLI ──
const HERE = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, dir] = process.argv.slice(2);
  if (!dir) { console.error('usage: node run.mjs fetch|full <dir>'); process.exit(2); }
  if (mode === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    const show = (p) => execFileSync('git', ['show', `origin/council-data:${p}`], { cwd: HERE, maxBuffer: 1 << 28 });
    for (const k of Object.keys(MARKETS)) fs.writeFileSync(path.join(dir, k + '.json'), show(`research/daily/${k}.json`));
    fs.writeFileSync(path.join(dir, 'cache.json'), show('macro/cache.json'));
    console.log('fetched into', dir);
  } else if (mode === 'full') {
    const data = Object.fromEntries(Object.keys(MARKETS).map((k) => [k, JSON.parse(fs.readFileSync(path.join(dir, k + '.json')))]));
    let usdRates = null; try { usdRates = JSON.parse(fs.readFileSync(path.join(dir, 'cache.json'))).score.fred.DGS2; } catch { /* sensitivity only */ }
    const r = study(data, { usdRates });
    const out = {
      built: '2026-11-13', title: 'The 2-day RSI pullback, frozen, on six non-US indices (replication of rsi2-pullback)', verdict: r.verdict,
      system: 'Long when close > SMA200 and Wilder RSI(2) < 10 (OANDA daily close), fill next open; exit next open after the first close > SMA5; stop 3 x ATR(20). Unchanged copy of the rsi2-pullback rule',
      test: 'One pooled test (equal risk per trade, R), window B 2016-now: avg R > 0, month-sum t >= 2, >= 4 of 6 markets positive, beats the placebo p95 (40 seeds). No Holm (single test)',
      costs: { roundTripPoints: Object.fromEntries(Object.entries(MARKETS).map(([k, m]) => [k, m.cost])), financing: 'local policy rate + 2.5 % a year, per calendar night', banks: Object.fromEntries(Object.entries(MARKETS).map(([k, m]) => [k, m.bank])) },
      src: 'OANDA mid daily candles, council-data research/daily/<key>.json; policy rates as listed in PREREGISTRATION.md',
      windows: WINDOWS, checks: r.checks, pool: r.pool, markets: r.markets, usNearMiss: US_NEAR_MISS,
    };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    console.log(JSON.stringify({ verdict: r.verdict, checks: r.checks, pool: r.pool }, null, 1));
    for (const [k, m] of Object.entries(r.markets)) console.log(k, JSON.stringify({ A: m.A, B: m.B, usd: m.usdFinancingB }));
  }
}
