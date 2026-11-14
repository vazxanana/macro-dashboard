// Edge research · vol-spike-crypto (PREREGISTRATION.md, committed alone first).
// #860's volatility-spike rebound, frozen (frozen.mjs byte for byte, sha256 pinned in the test), run on crypto daily candles.
// The wrapper builds the candle list from every UTC day (crypto trades 7 days a week; the frozen candles() would drop weekends)
// and hands it to the frozen simulate(). 10-day hold decides; costs = CFD_CRYPTO + the broker's crypto long swap.
//   node run.mjs fetch <dir>   copies the crypto daily caches, #860's data and #860's result.json (git show, no network)
//   node run.mjs full <dir>    gate on #860, then the primary test, secondary rows, placebo; writes result.json
// Paper research: nothing here is read by the council, the mirror or the page.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { study, simulate, signals, sma, hold, atr, tstat, monthSums, summary, holm, normP, rng, pct, P, MARKETS as US } from './frozen.mjs';
import { CFD_CRYPTO } from '../../../council/fills.mjs';
import { nyOffsetH } from '../../../council/histdata.mjs';

export const H = 10, H2 = 5;
export const PRIMARY = { btc: 'BTCUSDT', eth: 'ETHUSDT', sol: 'SOLUSDT', xrp: 'XRPUSDT' };
export const OTHER = { ada: 'ADAUSDT', bnb: 'BNBUSDT', doge: 'DOGEUSDT', link: 'LINKUSDT', ltc: 'LTCUSDT', trx: 'TRXUSDT' };
export const COINS = { ...PRIMARY, ...OTHER };
export const WIN = { W: ['2017-01-01', '2019-12-31'], D: ['2020-01-01', '2099-12-31'] };
export const FIN_YEAR = 0.15; // broker crypto long swap, % a year (ctrader/symbols.json: BTCUSD/ETHUSD/SOLUSD swap.long -15, type 1)
export const SEEDS = 40, SEED0 = 7000, MIN_W = 10, MIN_TEST = 10;
const DAY = 86400, HR = 3600, T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const r3 = (v) => (Number.isFinite(v) ? +v.toFixed(3) : null);
const r2 = (v) => (Number.isFinite(v) ? +v.toFixed(2) : null);
const r6 = (v) => (Number.isFinite(v) ? +v.toPrecision(6) : null);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// every UTC daily candle, seven days a week (NOT the frozen candles(), which drops Saturday and Sunday)
export function cryptoCandles(rows) {
  return rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })).sort((a, b) => a.time - b.time);
}
export const missingDays = (D) => D.reduce((a, b, i) => a + (i ? Math.max(0, Math.round((b.time - D[i - 1].time) / DAY) - 1) : 0), 0);

// nights charged for holding through the UTC day starting at t: its 17:00 New York rollover; a Friday's counts three
// (crypto-reversal's nightsOf, copied)
export function nightsOf(t) {
  const d0 = t - (t % DAY);
  const x = d0 + ((17 + nyOffsetH(d0 + 12 * HR)) % 24) * HR;
  return new Date(x * 1000).getUTCDay() === 5 ? 3 : 1;
}
export function nightsHeld(D, tr) {
  let n = 0;
  for (let k = tr.i; k <= tr.j; k++) {
    if (k === tr.j && k > tr.i && tr.why === 'stop' && D[k].open <= tr.stop) break; // gap at the open: no night that day
    n += nightsOf(D[k].time);
  }
  return n;
}
// costs on a frozen trade; mult 0 = before costs, 1 = base, 2 = doubled
export function netCrypto(D, tr, mult = 1) {
  const nt = nightsHeld(D, tr), cfd = CFD_CRYPTO * tr.entry * mult, fin = FIN_YEAR / 365 * nt * tr.entry * mult;
  const pts = tr.exit - tr.entry - cfd - fin;
  return { ...tr, nights: nt, cfd, fin, gross: (tr.exit - tr.entry) / tr.entry * 100, ret: pts / tr.entry * 100, R: pts / tr.risk, costR: (cfd + fin) / tr.risk };
}
export const inW = (t, w) => t.tIn >= T(WIN[w][0]) && t.tIn <= T(WIN[w][1]) + DAY - 1;

export function ddOf(tr) { let eq = 0, pk = 0, dd = 0; for (const x of [...tr].sort((a, b) => a.tOut - b.tOut).map((t) => t.R)) { eq += x; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); } return r2(dd); }
export function block(tr, from, to) {
  if (!tr.length) return { n: 0 };
  const s = summary(tr, from, to), t = tstat(tr.map((x) => x.R));
  return { from, to, ...s, tTrades: r2(t), p: t == null ? null : r6(normP(t)), tMonths: r2(tstat(monthSums(tr, from, to))) };
}

// placebo: per coin the same count, signal days whose fill is in D, close < SMA20, not a signal day; frozen hold, same costs
export function placeboTrades(D, count, lo, hi, R) {
  const sig = signals(D), s20 = sma(D, P.SMA_N), elig = [];
  for (let i = P.ATR_N; i < D.length - 1; i++) {
    const t = D[i + 1].time;
    if (t < lo || t > hi || sig[i] || s20[i] == null || !(D[i].close < s20[i]) || !(atr(D, i) > 0)) continue;
    elig.push(i);
  }
  const out = [];
  for (let c = 0; c < count && elig.length; c++) {
    const i = elig[Math.floor(R() * elig.length)], risk = P.STOP_ATR * atr(D, i), x = hold(D, i + 1, risk, H);
    out.push(netCrypto(D, { i: i + 1, j: x.j, entry: x.entry, exit: x.exit, why: x.why, stop: x.stop, risk, tIn: D[i + 1].time, tOut: D[x.j].time }));
  }
  return out;
}

export function verdictOf(d, w, x2) {
  if (d.n < P.MIN_N || w.n < MIN_W) return `NOT MEASURABLE (inconclusive: ${d.n} decisive trades (need ${P.MIN_N}), ${w.n} replication trades (need ${MIN_W}))`;
  const checks = { positive: d.avgR > 0, monthT: d.tMonths >= 2, replication: w.avgR > 0, positive2x: x2.avgR > 0 };
  return Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL';
}

// first index whose signal can stand (RV5 and 120 earlier RV5 values, SMA20, ATR20)
function readyDay(D) {
  const i = P.RV_N + P.MED_N; return i < D.length ? ymd(D[i].time) : null;
}

export function cryptoStudy(data) {
  const Ds = Object.fromEntries(Object.keys(COINS).map((k) => [k, cryptoCandles(data[k])]));
  const lastDay = ymd(Math.max(...Object.values(Ds).map((D) => D.at(-1).time)));
  const wr = (w) => [WIN[w][0], WIN[w][1] > lastDay ? lastDay : WIN[w][1]];
  const run = (k, h, mult) => simulate(Ds[k], h).map((t) => ({ ...netCrypto(Ds[k], t, mult), coin: k }));
  const trades = {};
  for (const k of Object.keys(COINS)) for (const h of [H, H2]) for (const m of [0, 1, 2]) trades[`${k}:${h}:${m}`] = run(k, h, m);
  const pool = (keys, h, m, w) => keys.flatMap((k) => trades[`${k}:${h}:${m}`].filter((t) => inW(t, w)));
  const P4 = Object.keys(PRIMARY), O6 = Object.keys(OTHER);
  const holdBlock = (keys, h) => ({
    D: { base: block(pool(keys, h, 1, 'D'), ...wr('D')), x2: block(pool(keys, h, 2, 'D'), ...wr('D')), zero: block(pool(keys, h, 0, 'D'), ...wr('D')) },
    W: { base: block(pool(keys, h, 1, 'W'), ...wr('W')), x2: block(pool(keys, h, 2, 'W'), ...wr('W')), zero: block(pool(keys, h, 0, 'W'), ...wr('W')) },
  });
  const primary = holdBlock(P4, H);
  const verdict = verdictOf(primary.D.base, primary.W.base, primary.D.x2);
  const checks = { n: primary.D.base.n >= P.MIN_N, nW: primary.W.base.n >= MIN_W, positive: primary.D.base.avgR > 0, monthT: primary.D.base.tMonths >= 2, replication: primary.W.base.avgR > 0, positive2x: primary.D.x2.avgR > 0 };
  // per coin
  const coins = {};
  for (const k of Object.keys(COINS)) {
    const D = Ds[k], row = { set: PRIMARY[k] ? 'primary' : 'reported only', sym: COINS[k], data: { from: ymd(D[0].time), to: ymd(D.at(-1).time), days: D.length, missing: missingDays(D) }, ready: readyDay(D) };
    for (const w of ['D', 'W']) {
      const tr = trades[`${k}:${H}:1`].filter((t) => inW(t, w));
      row[w] = { ...block(tr, ...wr(w)), avgR0: r3(mean(trades[`${k}:${H}:0`].filter((t) => inW(t, w)).map((t) => t.R))), avgR2x: r3(mean(trades[`${k}:${H}:2`].filter((t) => inW(t, w)).map((t) => t.R))) };
      row[w].ddBase = ddOf(tr);
    }
    coins[k] = row;
  }
  const tested = P4.filter((k) => coins[k].D.n >= MIN_TEST && coins[k].D.p != null), hm = holm(tested.map((k) => coins[k].D.p));
  tested.forEach((k, i) => { coins[k].D.holm = { adj: r6(hm[i].adj), pass: hm[i].pass }; });
  const dd = { zero: ddOf(pool(P4, H, 0, 'D')), base: ddOf(pool(P4, H, 1, 'D')), x2: ddOf(pool(P4, H, 2, 'D')) };
  // placebo
  const lo = T(WIN.D[0]), hi = T(wr('D')[1]) + DAY - 1;
  const rulePool = pool(P4, H, 1, 'D'), ruleMean = mean(rulePool.map((t) => t.R));
  const seeds = [...Array(SEEDS)].map((_, s) => {
    const R = rng(SEED0 + s + 1), tr = [];
    for (const k of P4) if (coins[k].D.n) tr.push(...placeboTrades(Ds[k], coins[k].D.n, lo, hi, R));
    return mean(tr.map((t) => t.R));
  });
  const placebo = { seeds: SEEDS, seedFrom: SEED0 + 1, what: 'signal days below SMA20 without a spike, fill in D, same count per coin', mean: r3(mean(seeds)), p95: r3(pct(seeds, 0.95)), beats: seeds.filter((x) => ruleMean > x).length, values: seeds.map(r3) };
  placebo.underP95 = ruleMean <= pct(seeds, 0.95);
  const years = {};
  for (const t of [...pool(P4, H, 1, 'W'), ...rulePool]) { const y = ymd(t.tIn).slice(0, 4); const o = (years[y] ||= { n: 0, sumR: 0 }); o.n++; o.sumR += t.R; }
  for (const o of Object.values(years)) o.sumR = r2(o.sumR);
  return {
    verdict, checks, lastDay, primary, hold5: holdBlock(P4, H2), others: holdBlock(O6, H), dd, coins, placebo, years,
    costs: { avgCostR: r3(mean(rulePool.map((t) => t.costR))), avgNights: r2(mean(rulePool.map((t) => t.nights))) },
  };
}

// gate: the frozen study() on #860's own data must give its committed result's 10-day hold
export function gate(data860, rates, published) {
  const r = JSON.parse(JSON.stringify(study(data860, rates)));
  const equal = JSON.stringify(r.holds['10']) === JSON.stringify(published.holds['10']) && r.verdict === published.verdict;
  const b = published.holds['10'].B, a = published.holds['10'].A;
  return { what: "frozen study() on #860's data (council-data research/daily spx500 / nas100 / us30 + macro/cache.json DGS2) against #860's committed result.json holds['10']", source: 'origin/vol-spike-rebound', equal, published: { B: { n: b.n, avgR: b.avgR, tTrades: b.tTrades }, A: { n: a.n, avgR: a.avgR } } };
}

// ── CLI ──
const HERE = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, dir] = process.argv.slice(2);
  if (!dir) { console.error('usage: node run.mjs fetch|full <dir>'); process.exit(2); }
  if (mode === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    const show = (ref, p) => execFileSync('git', ['show', `${ref}:${p}`], { cwd: HERE, maxBuffer: 1 << 28 });
    for (const s of Object.values(COINS)) fs.writeFileSync(path.join(dir, `${s}_1d.json.gz`), show('origin/council-data', `research/candles/crypto1d/${s}_1d.json.gz`));
    for (const k of Object.keys(US)) fs.writeFileSync(path.join(dir, k + '.json'), show('origin/council-data', `research/daily/${k}.json`));
    fs.writeFileSync(path.join(dir, 'cache.json'), show('origin/council-data', 'macro/cache.json'));
    fs.writeFileSync(path.join(dir, 'published-860.json'), show('origin/vol-spike-rebound', 'research/edge/vol-spike-rebound/result.json'));
    console.log('fetched into', dir);
  } else if (mode === 'full') {
    const d860 = Object.fromEntries(Object.keys(US).map((k) => [k, JSON.parse(fs.readFileSync(path.join(dir, k + '.json')))]));
    const rates = JSON.parse(fs.readFileSync(path.join(dir, 'cache.json'))).score.fred.DGS2;
    const g = gate(d860, rates, JSON.parse(fs.readFileSync(path.join(dir, 'published-860.json'))));
    if (!g.equal) { console.error('GATE FAILED'); fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ built: '2026-11-14', gate: g, verdict: 'gate failed' }, null, 1) + '\n'); process.exit(1); }
    const data = Object.fromEntries(Object.entries(COINS).map(([k, s]) => [k, JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${s}_1d.json.gz`))))]));
    const r = cryptoStudy(data);
    const out = {
      built: '2026-11-14', title: 'The frozen vol-spike rebound on crypto', verdict: r.verdict,
      system: "#860's rule frozen (frozen.mjs, byte for byte) on UTC daily crypto candles, seven days a week: long when 5-day realised vol > 2 x its prior 120-day median and close < SMA20, fill next open, hold 10 days, stop 3 x ATR(20)",
      costs: { cfdRoundTrip: CFD_CRYPTO, financingYear: FIN_YEAR, financing: '15 % a year / 365 x nights x entry; 17:00 New York rollover of each held UTC day, Friday x3 (crypto-reversal method); XRP and the six reported coins assumed at the broker BTC/ETH/SOL rate' },
      src: 'Binance spot UTC daily candles, council-data research/candles/crypto1d/<COIN>USDT_1d.json.gz',
      windows: WIN, coinSets: { primary: Object.keys(PRIMARY), reportedOnly: Object.keys(OTHER) },
      gate: g, ...r,
    };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    console.log(JSON.stringify({ gate: g.equal, verdict: r.verdict, checks: r.checks, primary: r.primary, hold5: r.hold5, others: r.others, dd: r.dd, placebo: { ...r.placebo, values: undefined }, costs: r.costs, years: r.years }, null, 1));
    for (const [k, m] of Object.entries(r.coins)) console.log(k, m.set, m.ready, JSON.stringify(m.data), 'D', m.D.n, m.D.avgR, m.D.tTrades, m.D.tMonths, m.D.p, m.D.holm?.adj, m.D.avgR0, m.D.avgR2x, m.D.ddBase, '| W', m.W.n, m.W.avgR, m.W.tTrades);
  }
}
