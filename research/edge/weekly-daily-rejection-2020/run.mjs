// The weekly-structure daily rejection rule (long) and its mirror short on the 17 other markets of the desk's cache,
// 2020-now (PREREGISTRATION.md, committed first). Gold 2020-now is reported as a known in-sample row only.
//   nice -n 10 node research/edge/weekly-daily-rejection-2020/run.mjs     -> result.json (+ prints the tables)
// Days, weeks, the weekly state, the signals, the trade and the per-trade statistics are gold-drd-long's (imported, never
// edited); only the stop is re-priced with a per-market buffer and the cost is the desk's per-market round trip.
import fs from 'node:fs';
import * as K from '../_lib/edgekit.mjs';
import { nyDay, days, weeks, weekState, signals, simulate, stats as tstats, welch } from '../gold-drd-long/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';

export const MARKETS = ['eurusd', 'gbpusd', 'usdjpy', 'audusd', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy', 'xag',
  'gbpjpy', 'eurgbp', 'audjpy', 'cadjpy', 'euraud', 'nas100', 'spx500', 'de40'];
export const BUF = 0.0001, RR = 3, HOLD = 10, THR = 0.7;
export const LOAD_FROM = '2019-01-01', START = Date.UTC(2020, 0, 1) / 1000, SPLIT = Date.UTC(2024, 0, 1) / 1000;
const D = 86400;
const ymd = (d) => new Date(d * D * 1000).toISOString().slice(0, 10);

// the cache's 5-minute candles -> whole UTC hours in gold-drd-long's shape
export const toH1 = (m5) => K.resample(m5, 3600).map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));

// the per-market stop: 0.01 % of the signal day's low (long) / high (short)
export const stopOf = (day, side, buf = BUF) => (side > 0 ? day.low * (1 - buf) : day.high * (1 + buf));

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };

// every trade of one market and side: { rule: [...], base: [...] } (base = every day of the same weekly side)
export function marketTrades(h1, side, cost, { bad = [], from = START, rr = RR } = {}) {
  const ds = days(h1), wk = weeks(ds), wst = weekState(wk), start = new Map();
  h1.forEach((b, k) => { const d = nyDay(b.time); if (d != null && !start.has(d)) start.set(d, k); });
  const rule = [], base = []; let dropped = 0;
  for (const sg0 of signals(ds, wk, wst, THR, side)) {
    if (sg0.i + HOLD > ds.length - 2) continue;                 // the 10th day must be a complete day on file
    const sg = { ...sg0, stop: stopOf(ds[sg0.i], side) };
    const tr = simulate(h1, start, ds, sg, rr, side); if (!tr) continue;
    if (tr.entryT < from) continue;
    if (inBad(bad, tr.entryT)) { dropped++; continue; }
    const c = cost / tr.risk;
    Object.assign(tr, { t: tr.entryT, net: tr.R - c, net2: tr.R - 2 * c, costR: c });
    base.push(tr); if (sg.rule) rule.push(tr);
  }
  return { ds, rule, base, dropped };
}

// signals (day, side, stop) before a cut, read on every candle and on the candles before the cut only
export function cutCheck(h1, side, cutT) {
  const sig = (bars) => { const ds = days(bars), wk = weeks(ds), wst = weekState(wk);
    return signals(ds, wk, wst, THR, side).filter((s) => s.rule).map((s) => `${s.d}:${stopOf(ds[s.i], side)}`); };
  const cut = h1.filter((b) => b.time + 3600 <= cutT), a = sig(cut), lastD = nyDay(cut.at(-1).time);
  const b = sig(h1).filter((x) => +x.split(':')[0] < lastD);
  return { before: a.length, same: a.length === b.length && a.every((x, i) => x === b[i]) };
}

const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
const r2 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(2));
export function block(T) {
  if (!T.length) return { n: 0 };
  const s = K.stats(T, { key: 'net', time: 't' }), s2 = K.stats(T, { key: 'net2', time: 't' });
  return { n: s.n, avg: r3(s.meanR), total: +s.total.toFixed(1), wr: +(s.wins / s.n * 100).toFixed(1), tTrade: r2(s.tTrade), months: s.months,
    tMonth: r2(s.tMonth), pMonth: s.pMonth == null ? null : +s.pMonth.toFixed(4), avg2x: r3(s2.meanR), maxDD: +s.maxDD.toFixed(1) };
}
const windows = (T) => ({ all: block(T), disc: block(T.filter((x) => x.t < SPLIT)), conf: block(T.filter((x) => x.t >= SPLIT)) });
const years = (T) => { const y = {}; for (const x of T) { const k = new Date(x.t * 1000).getUTCFullYear(); (y[k] ||= []).push(x); }
  return Object.fromEntries(Object.entries(y).map(([k, v]) => [k, { n: v.length, total: +v.reduce((a, x) => a + x.net, 0).toFixed(1) }])); };

export function passOf(w, pHolm) {
  const d = w.disc, c = w.conf;
  return d.n >= 100 && d.avg > 0 && d.tMonth >= 2 && c.n >= 50 && c.avg > 0 && c.tMonth >= 2 && pHolm < 0.05 && d.avg2x > 0 && c.avg2x > 0;
}

function main() {
  const out = { built: new Date().toISOString().slice(0, 10), rule: { thr: THR, rr: RR, hold: HOLD, buffer: BUF, loadFrom: LOAD_FROM, from: ymd(START / D), split: ymd(SPLIT / D) },
    costs: {}, data: {}, markets: {}, gold: null, pooled: {}, tests: {}, cut: {} };
  const pool = { 1: [], [-1]: [] };
  for (const m of [...MARKETS, 'xau']) {
    const h1 = toH1(K.load(m, '5m', { from: LOAD_FROM }));
    const X = exclusions(m), cost = COSTS[m]; out.costs[m] = cost;
    out.data[m] = { from: new Date(h1[0].time * 1000).toISOString().slice(0, 10), to: new Date(h1.at(-1).time * 1000).toISOString().slice(0, 16), h1: h1.length, excl: X.length };
    const row = {};
    for (const side of [1, -1]) {
      const { rule, base, dropped } = marketTrades(h1, side, cost, { bad: X });
      const key = side > 0 ? 'long' : 'short', w = windows(rule);
      w.base = block(base); w.lift = welch(rule, base); w.years = years(rule); w.dropped = dropped;
      w.medianCostR = rule.length ? r3(rule.map((x) => x.costR).sort((a, b) => a - b)[rule.length >> 1]) : null;
      row[key] = w;
      if (m !== 'xau') pool[side].push(...rule);
    }
    if (m === 'xau') out.gold = { note: 'known in-sample row (gold-drd-long covers it); not part of any test', ...row };
    else out.markets[m] = row;
    // cut test on every market: the signals before 2023-06-15 do not change when the later candles are removed
    out.cut[m] = { long: cutCheck(h1, 1, Date.UTC(2023, 5, 15) / 1000), short: cutCheck(h1, -1, Date.UTC(2023, 5, 15) / 1000) };
    process.stderr.write(`${m} long ${row.long.all.n} short ${row.short.all.n}\n`);
  }
  out.pooled.T1 = { ...windows(pool[1]), years: years(pool[1]) };
  out.pooled.T2 = { ...windows(pool[-1]), years: years(pool[-1]) };
  const p = ['T1', 'T2'].map((k) => (out.pooled[k].conf.tMonth > 0 ? out.pooled[k].conf.pMonth : 1)), adj = K.holm(p);
  ['T1', 'T2'].forEach((k, i) => { const w = out.pooled[k]; out.tests[k] = { side: k === 'T1' ? 'long' : 'short', discN: w.disc.n, discAvg: w.disc.avg, discT: w.disc.tMonth,
    confN: w.conf.n, confAvg: w.conf.avg, confT: w.conf.tMonth, pConf: p[i], pHolm: +adj[i].toFixed(4), disc2x: w.disc.avg2x, conf2x: w.conf.avg2x, pass: passOf(w, adj[i]) }; });
  out.cutAllSame = Object.values(out.cut).every((c) => c.long.same && c.short.same);
  const any = Object.values(out.tests).some((x) => x.pass);
  const few = Object.values(out.tests).some((x) => x.discN < 100 || x.confN < 50);
  out.verdict = any ? 'PASS' : few ? 'INCONCLUSIVE' : 'FAIL';
  const T1 = out.pooled.T1.all, T2 = out.pooled.T2.all;
  out.headline = `${out.verdict}: longs pooled over 17 markets ${T1.avg >= 0 ? '+' : ''}${T1.avg}R a trade after costs (n ${T1.n}, month t ${T1.tMonth}), shorts ${T2.avg >= 0 ? '+' : ''}${T2.avg}R (n ${T2.n}, month t ${T2.tMonth}), 2020-now.`;
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify(out.tests, null, 1));
  for (const k of ['T1', 'T2']) console.log(k, JSON.stringify({ all: out.pooled[k].all, disc: out.pooled[k].disc, conf: out.pooled[k].conf }));
  for (const [m, r] of Object.entries({ ...out.markets, xau: out.gold })) for (const s of ['long', 'short']) { const w = r[s];
    console.log(m.padEnd(7), s.padEnd(5), `n ${w.all.n} avg ${w.all.avg} t ${w.all.tMonth} | disc ${w.disc.n} ${w.disc.avg} ${w.disc.tMonth} | conf ${w.conf.n} ${w.conf.avg} ${w.conf.tMonth} | 2x ${w.all.avg2x} | base ${w.base.avg} lift ${w.lift.lift} t ${w.lift.t} | cost ${w.medianCostR}`); }
  console.log('cut all same', out.cutAllSame, 'verdict', out.verdict);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
