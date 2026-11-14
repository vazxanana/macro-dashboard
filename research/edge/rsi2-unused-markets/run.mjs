// Edge research · rsi2-unused-markets (PREREGISTRATION.md, committed first).
// The 2-day RSI pullback (frozen.mjs = the original rsi2-pullback run.mjs, byte for byte) on the six OANDA index CFDs that
// neither #838 (spx500 / nas100 / us30) nor rsi2-replicate (de40 / uk100 / jp225 / au200 / eu50 / fr40) read:
// us2000, ch20, nl25, hk33, cn50, sg30 (es35 and in50 fail the pre-registered coverage rule).
// Gate: the frozen study reproduces #838's published figures. Test: rsi2-replicate's pooled bar, window B 2016-now.
//   node run.mjs fetch <dir>   copies the daily candles + macro/cache.json out of council-data (git show, no network)
//   node run.mjs full <dir>    writes result.json next to this file
// Paper research: nothing here is read by the council, the mirror or the page.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { P, MARKETS as US, candles, sma, atr, simulate, net, summary, tstat, monthSums, rng, placebo, pct, holm, study as frozenStudy } from './frozen.mjs';

export const FROZEN = { branch: 'rsi2-pullback', commit: '4e1b4e1dd', file: 'research/edge/rsi2-pullback/run.mjs',
  sha256: 'edade889f2825fa71d911e039bfe5b9fdaaf5677e7b2fd55742e742830d5ab65' };
// Round trip in index points (PREREGISTRATION.md; us2000 = 2 x the demo's measured median spread, the rest assumed).
export const MARKETS = {
  us2000: { inst: 'US2000_USD', cost: 0.6 },
  ch20: { inst: 'CH20_CHF', cost: 5.0 },
  nl25: { inst: 'NL25_EUR', cost: 0.4 },
  hk33: { inst: 'HK33_HKD', cost: 16.0 },
  cn50: { inst: 'CN50_USD', cost: 12.0 },
  sg30: { inst: 'SG30_SGD', cost: 0.6 },
};
export const CANDIDATES = ['us2000', 'ch20', 'nl25', 'es35', 'hk33', 'cn50', 'sg30', 'in50'];
export const USED = { '838': ['spx500', 'nas100', 'us30'], replicate: ['de40', 'uk100', 'jp225', 'au200', 'eu50', 'fr40'] };
export const WINDOWS = { A: ['2008-01-01', '2015-12-31'], B: ['2016-01-01', '2099-12-31'] };
export const QUALIFY = { firstSignalBy: '2016-01-04', lastWithinDays: 14, maxHoleDays: 14 };
// #838's published figures (origin/rsi2-pullback result.json, built 2026-11-13), as rsi2-early-years lists them.
export const ORIGINAL = {
  verdict: 'FAIL',
  spx500: { A: [67, 0.559, 0.134, 8.95, 3.15, 3.23], B: [99, 0.318, 0.112, 11.14, 2.02, 1.83, 0.233, 0.0217], holm: 0.0651 },
  nas100: { A: [75, 0.444, 0.104, 7.82, 2.02, 1.97], B: [99, 0.292, 0.061, 6.03, 1.24, 1.29, 0.477, 0.1073], holm: 0.1073 },
  us30: { A: [67, 0.228, 0.052, 3.45, 1.22, 1.39], B: [102, 0.288, 0.087, 8.82, 1.88, 2.28, 0.175, 0.0301], holm: 0.0651 },
};

const DAY = 86400, T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const r3 = (v) => (Number.isFinite(v) ? +v.toFixed(3) : null);
const r2 = (v) => (Number.isFinite(v) ? +v.toFixed(2) : null);
const r4 = (v) => (Number.isFinite(v) ? +v.toFixed(4) : null);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
// one-sided P(Z > t): the frozen file's normP (not exported there), same formula
export const normP = (t) => {
  const z = Math.abs(t), k = 1 / (1 + 0.2316419 * z), d = 0.3989422804014327 * Math.exp(-z * z / 2);
  const p = d * k * (0.31938153 + k * (-0.356563782 + k * (1.781477937 + k * (-1.821255978 + k * 1.330274429))));
  return t >= 0 ? p : 1 - p;
};

// ── gate: the frozen study must give #838's published figures exactly ──
export function gate(data, rates) {
  const r = frozenStudy(data, rates), rows = [];
  let ok = r.verdict === ORIGINAL.verdict;
  for (const k of Object.keys(US)) {
    const m = r.markets[k], o = ORIGINAL[k];
    const A = [m.A.n, m.A.avgRet, m.A.avgR, m.A.totalR, m.A.tTrades, m.A.tMonths];
    const B = [m.B.n, m.B.avgRet, m.B.avgR, m.B.totalR, m.B.tTrades, m.B.tMonths, m.B.placebo.p95, m.B.p];
    const same = JSON.stringify(A) === JSON.stringify(o.A) && JSON.stringify(B) === JSON.stringify(o.B) && m.holmP === o.holm;
    ok = ok && same;
    rows.push({ market: k, same, A, B, holmP: m.holmP });
  }
  return { pass: ok, verdict: r.verdict, rows };
}

// ── coverage from candle dates only ──
export function coverage(rows, newest) {
  const D = candles(rows);
  if (D.length <= P.SMA_LONG) return { first: D.length ? ymd(D[0].time) : null, firstSignal: null, last: D.length ? ymd(D.at(-1).time) : null, maxHoleB: null, ok: false, why: 'too few candles' };
  const first = ymd(D[0].time), firstSignal = ymd(D[P.SMA_LONG].time), last = ymd(D.at(-1).time);
  let maxHoleB = 0;
  for (let i = 1; i < D.length; i++) if (D[i].time >= T(WINDOWS.B[0])) maxHoleB = Math.max(maxHoleB, Math.round((D[i].time - D[i - 1].time) / DAY));
  const why = [];
  if (firstSignal > QUALIFY.firstSignalBy) why.push(`first signal ${firstSignal} after ${QUALIFY.firstSignalBy}`);
  if ((T(newest) - T(last)) / DAY > QUALIFY.lastWithinDays) why.push(`last candle ${last}, over ${QUALIFY.lastWithinDays} days before ${newest}`);
  if (maxHoleB > QUALIFY.maxHoleDays) why.push(`a ${maxHoleB}-day hole in window B`);
  return { first, firstSignal, last, maxHoleB, ok: why.length === 0, why: why.join('; ') || null };
}

// The frozen `placebo` procedure, step for step, returning its trades (as rsi2-replicate's placeboTrades).
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
function dd(Rs) { let eq = 0, pk = 0, d = 0; for (const x of Rs) { eq += x; pk = Math.max(pk, eq); d = Math.min(d, eq - pk); } return d; }
function pooledStats(tr, from, to) {
  const s = [...tr].sort((a, b) => a.tIn - b.tIn), Rs = s.map((t) => t.R);
  return {
    from, to, n: s.length, avgR: r3(mean(Rs)), avgGrossR: r3(mean(s.map((t) => (t.exit - t.entry) / t.risk))), totalR: r2(Rs.reduce((a, b) => a + b, 0)),
    wr: s.length ? r2(100 * s.filter((t) => t.R > 0).length / s.length) : null, tTradesR: r2(tstat(Rs)), tMonthsR: r2(tstat(monthSums(asR(s), from, to))), ddR: r2(dd(Rs)),
  };
}

// ── the study ──
export function study(data, rates, { mult = 1, finRates = rates, placeboSeeds = P.SEEDS } = {}) {
  const markets = {}, pooled = { A: [], B: [] }, Ds = {}, real = {};
  let lastDay = '0000';
  for (const [k, m] of Object.entries(MARKETS)) {
    const D = candles(data[k].rows); Ds[k] = D;
    if (ymd(D.at(-1).time) > lastDay) lastDay = ymd(D.at(-1).time);
  }
  for (const [k, m] of Object.entries(MARKETS)) {
    const D = Ds[k], cost = m.cost * mult, all = simulate(D).map((t) => net(t, cost, finRates)), win = {};
    for (const [w, [from, to0]] of Object.entries(WINDOWS)) {
      const to = to0 > ymd(D.at(-1).time) ? ymd(D.at(-1).time) : to0, tr = inWin(all, from, to);
      win[w] = { from, to, ...summary(tr, from, to), tMonthsR: r2(tstat(monthSums(asR(tr), from, to))) };
      if (w === 'B') { win.B.p = r4(normP(tstat(tr.map((t) => t.ret)) ?? 0)); real[k] = tr; }
      pooled[w].push(...tr.map((t) => ({ ...t, market: k })));
    }
    markets[k] = { inst: m.inst, cost, data: { from: ymd(D[0].time), to: ymd(D.at(-1).time), days: D.length }, ...win, years: byYear(all) };
  }
  const h = holm(Object.keys(MARKETS).map((k) => markets[k].B.p));
  Object.keys(MARKETS).forEach((k, i) => { markets[k].B.holmP = r4(h[i].adj); });
  const pool = {};
  for (const [w, [from, to0]] of Object.entries(WINDOWS)) {
    pool[w] = { ...pooledStats(pooled[w], from, to0 > lastDay ? lastDay : to0), positiveMarkets: Object.values(markets).filter((m) => m[w].avgR > 0).length };
  }
  if (placeboSeeds) {
    const seedMeans = [];
    for (let s = 1; s <= placeboSeeds; s++) {
      const all = [];
      for (const [k, m] of Object.entries(MARKETS)) all.push(...placeboTrades(Ds[k], real[k], m.cost * mult, finRates, WINDOWS.B[0], ymd(Ds[k].at(-1).time), s));
      seedMeans.push(mean(all.map((t) => t.R)));
    }
    pool.B.placebo = { seeds: placeboSeeds, mean: r3(mean(seedMeans)), p95: r3(pct(seedMeans, 0.95)), max: r3(Math.max(...seedMeans)), beatenBy: seedMeans.filter((x) => x >= mean(pooled.B.map((t) => t.R))).length };
  }
  const days = new Map(); for (const t of pooled.B) { const d = ymd(t.tIn); days.set(d, (days.get(d) || 0) + 1); }
  pool.B.entryDays = days.size; pool.B.sharedEntryTrades = pooled.B.filter((t) => days.get(ymd(t.tIn)) > 1).length;
  const B = pool.B;
  const checks = placeboSeeds ? { positive: B.avgR > 0, tMonths: B.tMonthsR >= 2, markets4of6: B.positiveMarkets >= 4, placebo: B.avgR > B.placebo.p95 } : null;
  return { verdict: checks ? (Object.values(checks).every(Boolean) ? 'REPLICATES' : 'DOES NOT REPLICATE') : null, checks, pool, markets };
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
  const keys = [...new Set([...Object.keys(US), ...CANDIDATES])];
  if (mode === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    const show = (p) => execFileSync('git', ['show', `origin/council-data:${p}`], { cwd: HERE, maxBuffer: 1 << 28 });
    for (const k of keys) fs.writeFileSync(path.join(dir, k + '.json'), show(`research/daily/${k}.json`));
    fs.writeFileSync(path.join(dir, 'cache.json'), show('macro/cache.json'));
    console.log('fetched into', dir);
  } else if (mode === 'full') {
    const data = Object.fromEntries(keys.map((k) => [k, JSON.parse(fs.readFileSync(path.join(dir, k + '.json')))]));
    const rates = JSON.parse(fs.readFileSync(path.join(dir, 'cache.json'))).score.fred.DGS2;
    const g = gate(data, rates);
    const newest = CANDIDATES.map((k) => ymd(Math.max(...data[k].rows.map((r) => r[0])))).sort().at(-1);
    const cov = Object.fromEntries(CANDIDATES.map((k) => [k, coverage(data[k].rows, newest)]));
    const qualified = CANDIDATES.filter((k) => cov[k].ok);
    if (JSON.stringify(qualified) !== JSON.stringify(Object.keys(MARKETS))) throw new Error('qualified set differs from the pre-registered one: ' + qualified);
    const r = study(data, rates);
    const costRows = Object.fromEntries([0, 1, 2].map((x) => {
      const s = x === 1 ? r : study(data, rates, { mult: x, placeboSeeds: 0 });
      return [x + 'x', { A: s.pool.A, B: s.pool.B, perMarketB: Object.fromEntries(Object.entries(s.markets).map(([k, m]) => [k, { n: m.B.n, avgR: m.B.avgR, tMonthsR: m.B.tMonthsR, ddR: m.B.ddR }])) }];
    }));
    const fin0 = study(data, rates, { finRates: [], placeboSeeds: 0 });
    const out = {
      built: '2026-11-14', title: 'The 2-day RSI pullback, frozen, on the six OANDA index CFDs no earlier study used', verdict: r.verdict,
      system: 'Long when close > SMA200 and Wilder RSI(2) < 10 (OANDA daily close), fill next open; exit next open after the first close > SMA5; stop 3 x ATR(20). frozen.mjs = rsi2-pullback run.mjs byte for byte',
      test: "rsi2-replicate's bar: pooled six-market book, equal risk per trade (R), window B 2016-now: avg R > 0, month-sum t >= 2, >= 4 of 6 markets positive, beats the placebo p95 (40 seeds). Single test, no Holm",
      frozen: FROZEN, used: USED, gate: g, coverage: cov, newest, qualified,
      costs: { roundTripPoints: Object.fromEntries(Object.entries(MARKETS).map(([k, m]) => [k, m.cost])), financing: 'DGS2 + 2.5 % a year per calendar night (the frozen net), every market', basis: 'us2000 = 2 x demo median spread 0.3; the rest assumed (PREREGISTRATION.md)' },
      src: 'OANDA mid daily candles, council-data research/daily/<key>.json; DGS2 from council-data macro/cache.json',
      windows: WINDOWS, checks: r.checks, pool: r.pool, markets: r.markets, costRows,
      financingZeroB: { note: 'benchmark 0 (2.5 % a year only); sensitivity, not decisive', pool: fin0.pool.B },
    };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    console.log(JSON.stringify({ gate: g.pass, qualified, verdict: r.verdict, checks: r.checks, pool: r.pool }, null, 1));
    for (const [k, m] of Object.entries(r.markets)) console.log(k, JSON.stringify({ A: [m.A.n, m.A.avgR, m.A.tMonthsR], B: [m.B.n, m.B.avgRet, m.B.avgR, m.B.wr, m.B.tTrades, m.B.tMonthsR, m.B.ddR, m.B.p, m.B.holmP] }));
    for (const [x, c] of Object.entries(costRows)) console.log(x, JSON.stringify({ A: [c.A.n, c.A.avgR, c.A.tMonthsR, c.A.ddR], B: [c.B.n, c.B.avgR, c.B.tMonthsR, c.B.ddR, c.B.positiveMarkets], per: c.perMarketB }));
    console.log('fin0', JSON.stringify(fin0.pool.B));
  }
}
