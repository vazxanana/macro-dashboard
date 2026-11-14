// Relative momentum between Ether and Bitcoin (research/edge/eth-btc-ratio). Paper research only.
// The rules, stops, costs, windows, placebo and pass bar are fixed in PREREGISTRATION.md (committed before this file).
// Usage (repo root, after `git fetch origin council-data`): node research/edge/eth-btc-ratio/run.mjs
// Reads the Binance daily caches from origin/council-data with `git show` (or $EB_DATA/<SYM>_1d.json.gz), writes result.json.
// The cost / swap model is copied from research/edge/crypto-reversal (not imported). Pure pieces exported for the tests.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { CFD_CRYPTO, spreadOf } from '../../../council/fills.mjs';
import { nyOffsetH } from '../../../council/histdata.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const H = 3600, DAY = 86400;

export const P = {
  coins: { btc: 'BTCUSDT', eth: 'ETHUSDT' },
  look: 28, atrN: 14, atrK: 2.5,
  cost: CFD_CRYPTO,                                   // CFD round trip, fraction of the entry price, per leg
  slip: spreadOf({ group: 'Crypto' }, 1) / 2,         // half a spread (0.01 % of price) on each market order
  // demo broker swap, % a year as a charge (council-data ctrader/symbols.json, type 1, rollover3Days 5 = Friday x3)
  swap: { btc: { long: 0.15, short: 0.075 }, eth: { long: 0.15, short: 0.10 } },
  windows: { replication: ['2018-01-01', '2021-12-31'], decisive: ['2022-01-01', '2099-01-01'] },
  tMin: 2, holmAlpha: 0.05, seeds: 40, placeboQ: 0.95,
};
export const ts = (s) => Math.floor(Date.parse(s + 'T00:00:00Z') / 1000);
export const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export const inWin = (t, [a, b]) => t >= ts(a) && t < ts(b) + DAY;

export function load1d(sym) {
  const file = `${sym}_1d.json.gz`;
  const buf = process.env.EB_DATA ? fs.readFileSync(path.join(process.env.EB_DATA, file))
    : execFileSync('git', ['show', `origin/council-data:research/candles/crypto1d/${file}`], { maxBuffer: 1 << 26 });
  return JSON.parse(zlib.gunzipSync(buf));
}

// nights charged for holding through the UTC day starting at t: its 17:00 New York instant, a Friday's counts three
export function nightsOf(t) {
  const d0 = t - (t % DAY);
  const x = d0 + ((17 + nyOffsetH(d0 + 12 * H)) % 24) * H;
  return new Date(x * 1000).getUTCDay() === 5 ? 3 : 1;
}

// --- indicators: each reads rows[..i] only (no look-ahead) ---
export const ret4 = (rows, i, n = P.look) => (i < n ? null : rows[i][4] / rows[i - n][4] - 1);
export function ratio4(eth, btc, i, n = P.look) {
  if (i < n) return null;
  return (eth[i][4] / btc[i][4]) / (eth[i - n][4] / btc[i - n][4]) - 1;
}
export function atr(rows, i, n = P.atrN) {
  if (i < n) return null;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) {
    const [, , h, l] = rows[k], pc = rows[k - 1][4];
    s += Math.max(h, pc) - Math.min(l, pc);
  }
  return s / n;
}

// one leg held from the open of day e to the close of day x at the latest; side +1 long, -1 short.
// Returns fractions of notional: pnl, cost (CFD + slippage), fin (swap).
export function leg(rows, e, x, side, atrV, swap) {
  const entry = rows[e][1], dist = P.atrK * atrV, stop = entry - side * dist;
  let exit = rows[x][4], exitIdx = x, how = 'time', nights = 0;
  for (let k = e; k <= x; k++) {
    const [t, o, h, l] = rows[k];
    if (k > e && (side > 0 ? o <= stop : o >= stop)) { exit = o; exitIdx = k; how = 'gap'; break; }
    nights += nightsOf(t);
    if (side > 0 ? l <= stop : h >= stop) { exit = stop; exitIdx = k; how = 'stop'; break; }
  }
  const pnl = side * (exit / entry - 1);
  const cost = P.cost + P.slip + P.slip * exit / entry;
  const fin = (side > 0 ? swap.long : swap.short) / 365 * nights;
  return { side, entry, stop, exit, exitT: rows[exitIdx][0], how, nights, f: dist / entry, pnl, cost, fin };
}

// T1 at signal day i (a Sunday): side +1 = long ETH / short BTC, -1 = the reverse (forced for the placebo)
export function t1Trade(eth, btc, i, forceSide) {
  const q = ratio4(eth, btc, i), aE = atr(eth, i), aB = atr(btc, i);
  if (q == null || aE == null || aB == null || i + 7 >= eth.length) return null;
  const s = forceSide ?? Math.sign(q);
  if (!s) return null;
  const e = i + 1, x = i + 7;
  const E = leg(eth, e, x, s, aE, P.swap.eth), B = leg(btc, e, x, -s, aB, P.swap.btc);
  const risk = E.f + B.f, gross = E.pnl + B.pnl, costs = E.cost + B.cost, fin = E.fin + B.fin;
  return {
    t: eth[e][0], side: s, ratio4: q, legs: { eth: E, btc: B }, risk,
    R: gross / risk, costR: costs / risk, finR: fin / risk, net: (gross - costs - fin) / risk,
    ret: gross - costs - fin,                      // net return per unit of notional on each leg
  };
}

// T2 at signal day i: long the coin with the higher 4-week return (ties: BTC); force 'btc' / 'eth' for placebo / benchmark
export function t2Trade(eth, btc, i, force) {
  const rE = ret4(eth, i), rB = ret4(btc, i);
  if (rE == null || rB == null || atr(eth, i) == null || i + 7 >= eth.length) return null;
  const coin = force ?? (rE > rB ? 'eth' : 'btc'), rows = coin === 'eth' ? eth : btc;
  const L = leg(rows, i + 1, i + 7, 1, atr(rows, i), P.swap[coin]);
  return {
    t: rows[i + 1][0], coin, ret4: { eth: rE, btc: rB }, leg: L,
    R: L.pnl / L.f, costR: L.cost / L.f, finR: L.fin / L.f, net: (L.pnl - L.cost - L.fin) / L.f, ret: L.pnl - L.cost - L.fin,
  };
}

// signal days: every Sunday candle
export function sundays(rows) {
  const out = [];
  for (let i = 0; i < rows.length; i++) if (new Date(rows[i][0] * 1000).getUTCDay() === 0) out.push(i);
  return out;
}
// the weeks of a window: signal days whose entry Monday falls in it and whose Sunday exit is on file
export function weeksOf(rows, win) {
  return sundays(rows).filter((i) => i + 7 < rows.length && inWin(rows[i + 1][0], win));
}

// --- statistics ---
export const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
export const sdOf = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
export function tOf(a) {
  if (a.length < 2) return NaN;
  const s = sdOf(a);
  return s > 0 ? mean(a) / (s / Math.sqrt(a.length)) : NaN;
}
export const sharpe = (a) => (a.length > 1 && sdOf(a) > 0 ? mean(a) / sdOf(a) * Math.sqrt(52) : NaN);
const erf = (x) => {   // Abramowitz-Stegun 7.1.26
  const s = Math.sign(x); x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
};
export const pOneSided = (t) => (Number.isFinite(t) ? 1 - 0.5 * (1 + erf(t / Math.SQRT2)) : 1);
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = new Array(ps.length);
  let run = 0;
  idx.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (ps.length - r) * p)); adj[i] = run; });
  return adj;
}
export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function quantile(sorted, q) {
  const p = q * (sorted.length - 1), lo = Math.floor(p), hi = Math.ceil(p);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (p - lo);
}
function maxDD(v) {
  let c = 0, hi = 0, dd = 0;
  for (const x of v) { c += x; hi = Math.max(hi, c); dd = Math.max(dd, hi - c); }
  return dd;
}
const r3d = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);

// weekly series of a window: one value per week (a week with no trade = 0)
function weekly(trades, weeks, key) {
  const byT = new Map(trades.map((x) => [x.t, x]));
  return weeks.map((t) => (byT.has(t) ? byT.get(t)[key] : 0));
}
function summary(trades, weeks, legsOf) {
  const w = weekly(trades, weeks, 'net'), wr = weekly(trades, weeks, 'ret');
  const legs = trades.flatMap(legsOf);
  const years = {};
  for (const x of trades) { const y = day(x.t).slice(0, 4); years[y] = (years[y] || 0) + x.net; }
  return {
    weeks: weeks.length, trades: trades.length,
    net: r3d(mean(w)), gross: r3d(mean(trades.map((x) => x.R))), totalNet: r3d(w.reduce((a, b) => a + b, 0)),
    t: r3d(tOf(w)), win: r3d(trades.filter((x) => x.net > 0).length / (trades.length || 1)),
    legsStopped: legs.filter((l) => l.how !== 'time').length, gaps: legs.filter((l) => l.how === 'gap').length,
    costR: r3d(mean(trades.map((x) => x.costR))), finR: r3d(mean(trades.map((x) => x.finR))),
    maxDD: r3d(maxDD(w)), sharpeR: r3d(sharpe(w)), sharpeRet: r3d(sharpe(wr)), meanRetPct: r3d(mean(wr) * 100),
    byYear: Object.fromEntries(Object.entries(years).map(([y, v]) => [y, r3d(v)])),
  };
}

export function study(eth, btc) {
  const W = {}, sig = {};
  for (const [k, win] of Object.entries(P.windows)) {
    sig[k] = weeksOf(eth, win);
    W[k] = sig[k].map((i) => eth[i + 1][0]);
  }
  const defs = {
    T1: { make: (i, f) => t1Trade(eth, btc, i, f), legs: (x) => [x.legs.eth, x.legs.btc], rand: (r) => (r() < 0.5 ? 1 : -1) },
    T2: { make: (i, f) => t2Trade(eth, btc, i, f), legs: (x) => [x.leg], rand: (r) => (r() < 0.5 ? 'btc' : 'eth') },
  };
  const tests = [], series = {};
  for (const [id, d] of Object.entries(defs)) {
    const res = {};
    const tr = {};
    for (const k of Object.keys(P.windows)) {
      tr[k] = sig[k].map((i) => d.make(i)).filter(Boolean);
      res[k] = summary(tr[k], W[k], d.legs);
    }
    series[id] = tr;
    const decI = sig.decisive.filter((i) => d.make(i));
    const pl = [];
    for (let s = 1; s <= P.seeds; s++) {
      const rnd = mulberry32(s);
      pl.push(mean(decI.map((i) => d.make(i, d.rand(rnd)).net)));
    }
    const sorted = [...pl].sort((a, b) => a - b), p95 = quantile(sorted, P.placeboQ);
    const wDec = weekly(tr.decisive, W.decisive, 'net');
    tests.push({
      id, decisive: res.decisive, replication: res.replication,
      p: pOneSided(tOf(wDec)),
      placebo: { seeds: P.seeds, mean: r3d(mean(pl)), p95: r3d(p95), max: r3d(sorted[sorted.length - 1]), values: pl.map(r3d) },
      _net: mean(wDec), _t: tOf(wDec), _rep: mean(weekly(tr.replication, W.replication, 'net')), _pl95: p95,
    });
  }
  const adj = holm(tests.map((x) => x.p));
  tests.forEach((x, i) => {
    x.p = r3d(x.p); x.holm = r3d(adj[i]);
    x.checks = {
      netPositive: x._net > 0, tWeeks: x._t >= P.tMin, holm: adj[i] <= P.holmAlpha,
      replicationSameSign: x._rep > 0, beatsPlacebo: x._net > x._pl95,
    };
    x.pass = Object.values(x.checks).every(Boolean);
    delete x._net; delete x._t; delete x._rep; delete x._pl95;
  });

  // T2 against BTC holding (reported, not part of the pass)
  const vsBtc = {};
  for (const k of Object.keys(P.windows)) {
    const t2 = series.T2[k], bt = sig[k].map((i) => t2Trade(eth, btc, i, 'btc')).filter(Boolean);
    const t2r = weekly(t2, W[k], 'ret'), btr = weekly(bt, W[k], 'ret');
    const bh = sig[k].map((i) => btc[i + 7][4] / btc[i][4] - 1);
    const diff = t2r.map((v, j) => v - btr[j]);
    vsBtc[k] = {
      weeksInEth: t2.filter((x) => x.coin === 'eth').length,
      t2: { meanRetPct: r3d(mean(t2r) * 100), sharpe: r3d(sharpe(t2r)), netR: r3d(mean(weekly(t2, W[k], 'net'))) },
      btcSameStop: { meanRetPct: r3d(mean(btr) * 100), sharpe: r3d(sharpe(btr)), netR: r3d(mean(weekly(bt, W[k], 'net'))), tR: r3d(tOf(weekly(bt, W[k], 'net'))) },
      btcBuyHold: { meanRetPct: r3d(mean(bh) * 100), sharpe: r3d(sharpe(bh)) },
      diffT2minusBtcPct: r3d(mean(diff) * 100), diffT: r3d(tOf(diff)),
    };
  }
  return { tests, vsBtc, weeks: { decisive: W.decisive.length, replication: W.replication.length },
    lastWeek: day(W.decisive[W.decisive.length - 1]) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const eth = load1d(P.coins.eth), btc = load1d(P.coins.btc), info = {};
  for (const [c, rows] of [['btc', btc], ['eth', eth]]) {
    let gaps = 0;
    for (let k = 1; k < rows.length; k++) if (rows[k][0] - rows[k - 1][0] !== DAY) gaps++;
    info[c] = { days: rows.length, from: day(rows[0][0]), to: day(rows[rows.length - 1][0]), missingSteps: gaps };
  }
  if (eth.length !== btc.length || eth.some((r, k) => r[0] !== btc[k][0])) throw new Error('ETH and BTC days do not line up');
  const s = study(eth, btc);
  const passed = s.tests.filter((x) => x.pass).map((x) => x.id);
  const out = {
    built: '2026-11-14',
    verdict: passed.length ? 'PASS' : 'FAIL',
    passed,
    system: 'ETH/BTC relative momentum: T1 4-week ETH/BTC ratio trend as an equal-notional two-leg spread; T2 long-only weekly rotation into the stronger coin; 2.5 x ATR14 stop per leg, weekly exit',
    prereg: 'PREREGISTRATION.md',
    source: 'council-data research/candles/crypto1d (Binance spot daily); exchange APIs refused by the sandbox proxy',
    data: info,
    costs: {
      cfdRoundTrip: P.cost, slipEachSide: P.slip,
      swapYear: P.swap,
      financing: 'swap % a year of notional, nights at 17:00 New York, Friday x3 (council-data ctrader/symbols.json: BTCUSD long -15 / short -7.5, ETHUSD long -15 / short -10)',
    },
    params: { look: P.look, atrN: P.atrN, atrK: P.atrK, windows: P.windows, tMin: P.tMin, holmAlpha: P.holmAlpha, seeds: P.seeds },
    weeks: s.weeks, lastWeek: s.lastWeek,
    tests: s.tests,
    vsBtc: s.vsBtc,
  };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  for (const x of s.tests) {
    const { byYear: a, ...d } = x.decisive, { byYear: b, ...r } = x.replication;
    console.log(x.id, 'dec', JSON.stringify(d), '\n   rep', JSON.stringify(r), '\n   holm', x.holm, 'pl', x.placebo.mean, x.placebo.p95, 'pass', x.pass, JSON.stringify(x.checks));
    console.log('   years', JSON.stringify(a), JSON.stringify(b));
  }
  console.log(JSON.stringify(s.vsBtc, null, 1));
  console.log('verdict', out.verdict, passed);
}
