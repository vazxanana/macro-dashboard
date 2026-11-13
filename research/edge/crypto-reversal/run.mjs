// Crypto short-term reversal after a sharp three-day drop (research/edge/crypto-reversal). Paper research only.
// The rule, stop, costs, windows, placebo and pass bar are fixed in PREREGISTRATION.md (committed before this file).
// Usage (repo root, after `git fetch origin council-data`): node research/edge/crypto-reversal/run.mjs
// Reads the Binance daily caches from origin/council-data with `git show` (or $CR_DATA/<SYM>_1d.json.gz), writes result.json.
// The pure pieces are exported for tests/crypto-reversal.test.mjs.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { CFD_CRYPTO, spreadOf } from '../../../council/fills.mjs';
import { nyOffsetH } from '../../../council/histdata.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const H = 3600, DAY = 86400;

export const P = {
  coins: { btc: 'BTCUSDT', eth: 'ETHUSDT', sol: 'SOLUSDT', xrp: 'XRPUSDT' },
  look: 3, sdN: 90, k: 2, smaN: 200, atrN: 14, atrK: 2.5,
  exits: [3, 7],
  cost: CFD_CRYPTO,                                   // CFD round trip, fraction of the entry price
  slip: spreadOf({ group: 'Crypto' }, 1) / 2,         // half a spread (0.02 % of price) on each market order
  // demo broker's crypto long swap, a year (council-data ctrader/symbols.json of 13 Nov 2026, type 1, rollover3Days 5 = Friday x3);
  // XRPUSD is not listed at the broker: the same rate is charged (pre-registered assumption)
  fin: { btc: 0.15, eth: 0.15, sol: 0.15, xrp: 0.15 },
  finSrc: { btc: 'broker', eth: 'broker', sol: 'broker', xrp: 'assumed (not listed at the broker)' },
  windows: { replication: ['2018-01-01', '2021-12-31'], decisive: ['2022-01-01', '2099-01-01'] },
  tMin: 2, holmAlpha: 0.05, seeds: 40, placeboQ: 0.95,
};
export const ts = (s) => Math.floor(Date.parse(s + 'T00:00:00Z') / 1000);
export const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export const inWin = (t, [a, b]) => t >= ts(a) && t < ts(b) + DAY;
export const month = (t) => day(t).slice(0, 7);

export function load1d(sym) {
  const file = `${sym}_1d.json.gz`;
  const buf = process.env.CR_DATA ? fs.readFileSync(path.join(process.env.CR_DATA, file))
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
export const r3 = (rows, i, n = P.look) => (i < n ? null : rows[i][4] / rows[i - n][4] - 1);
export function sdBefore(rows, i, N = P.sdN, n = P.look) {
  if (i - N < n) return null;
  const v = [];
  for (let k = i - N; k < i; k++) v.push(r3(rows, k, n));
  const m = v.reduce((a, b) => a + b, 0) / N;
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (N - 1));
}
export function sma(rows, i, N = P.smaN) {
  if (i < N - 1) return null;
  let s = 0;
  for (let k = i - N + 1; k <= i; k++) s += rows[k][4];
  return s / N;
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
// signal at the close of day i (null = indicators not standing yet)
export function signalAt(rows, i, filter) {
  const sd = sdBefore(rows, i), a = atr(rows, i);
  if (sd == null || a == null) return null;
  if (filter) { const s = sma(rows, i); if (s == null) return null; if (!(rows[i][4] > s)) return false; }
  return r3(rows, i) < -P.k * sd;
}

// one trade from a signal at day i: entry at the open of i+1, exit at the close of the hold-th candle (entry day = 1)
export function trade(rows, i, hold, fin) {
  const e = i + 1, x = e + hold - 1;
  if (x >= rows.length) return null;
  const entry = rows[e][1], stop = entry - P.atrK * atr(rows, i), r0 = entry - stop;
  let exit = rows[x][4], exitIdx = x, how = 'time', nights = 0;
  for (let k = e; k <= x; k++) {
    const [t, o, , l] = rows[k];
    if (k > e && o <= stop) { exit = o; exitIdx = k; how = 'gap'; break; }
    nights += nightsOf(t);
    if (l <= stop) { exit = stop; exitIdx = k; how = 'stop'; break; }
  }
  const costPx = entry * (P.cost + P.slip) + exit * P.slip, finPx = fin / 365 * nights * entry;
  const R = (exit - entry) / r0;
  return {
    sig: rows[i][0], t: rows[e][0], exitT: rows[exitIdx][0], entry, stop, r0, exit, how, nights,
    R, costR: costPx / r0, finR: finPx / r0, net: R - (costPx + finPx) / r0,
  };
}

export function runCoin(rows, { hold, filter, fin }) {
  const out = [];
  for (let i = 0; i < rows.length - 1; i++) {
    if (!signalAt(rows, i, filter)) continue;
    const tr = trade(rows, i, hold, fin);
    if (!tr) break;
    out.push(tr);
    i = rows.findIndex((r) => r[0] === tr.exitT) - 1;      // next signal may come on the exit day itself
  }
  return out;
}

// --- statistics ---
export const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
export function tOf(a) {
  if (a.length < 2) return NaN;
  const m = mean(a), sd = Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1));
  return sd > 0 ? m / (sd / Math.sqrt(a.length)) : NaN;
}
export function monthsOf([a, b], lastT) {
  const end = Math.min(ts(b) + DAY - 1, lastT), out = [];
  let [y, m] = a.split('-').map(Number);
  for (;;) {
    const s = `${y}-${String(m).padStart(2, '0')}`;
    if (ts(s + '-01') > end) break;
    out.push(s);
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}
export function monthT(trades, months) {
  const sums = Object.fromEntries(months.map((m) => [m, 0]));
  for (const x of trades) if (month(x.t) in sums) sums[month(x.t)] += x.net;
  return tOf(Object.values(sums));
}
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
function maxDD(trades) {
  let c = 0, hi = 0, dd = 0;
  for (const x of [...trades].sort((a, b) => a.exitT - b.exitT)) { c += x.net; hi = Math.max(hi, c); dd = Math.max(dd, hi - c); }
  return dd;
}
const r3d = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);
function summary(trades, months) {
  return {
    n: trades.length,
    net: r3d(mean(trades.map((x) => x.net))), gross: r3d(mean(trades.map((x) => x.R))),
    totalNet: r3d(trades.reduce((a, x) => a + x.net, 0)),
    tTrades: r3d(tOf(trades.map((x) => x.net))), tMonths: months ? r3d(monthT(trades, months)) : null,
    win: r3d(trades.filter((x) => x.net > 0).length / (trades.length || 1)),
    stops: trades.filter((x) => x.how !== 'time').length, gaps: trades.filter((x) => x.how === 'gap').length,
    costR: r3d(mean(trades.map((x) => x.costR))), finR: r3d(mean(trades.map((x) => x.finR))),
    maxDD: r3d(maxDD(trades)),
  };
}

export function placebo(data, { hold, filter, counts, seed }) {
  const rnd = mulberry32(seed), all = [];
  for (const [c, rows] of Object.entries(data)) {
    const pool = [];
    for (let i = 0; i < rows.length - hold; i++) {
      if (signalAt(rows, i, filter) == null) continue;
      if (filter && !(rows[i][4] > sma(rows, i))) continue;
      if (!inWin(rows[i + 1][0], P.windows.decisive)) continue;
      pool.push(i);
    }
    const need = Math.min(counts[c] || 0, pool.length);
    for (let j = 0; j < need; j++) {                       // partial Fisher-Yates: draw without replacement
      const r = j + Math.floor(rnd() * (pool.length - j));
      [pool[j], pool[r]] = [pool[r], pool[j]];
      all.push(trade(rows, pool[j], hold, P.fin[c]));
    }
  }
  return mean(all.map((x) => x.net));
}

export function study(data) {
  const lastT = Math.min(...Object.values(data).map((r) => r[r.length - 1][0]));
  const mDec = monthsOf(P.windows.decisive, lastT), mRep = monthsOf(P.windows.replication, lastT);
  const tests = [];
  for (const hold of P.exits) for (const filter of [false, true]) {
    const id = `day${hold}${filter ? '-sma200' : ''}`;
    const byCoin = {}, dec = [], rep = [];
    for (const [c, rows] of Object.entries(data)) {
      const tr = runCoin(rows, { hold, filter, fin: P.fin[c] });
      const d = tr.filter((x) => inWin(x.t, P.windows.decisive)), r = tr.filter((x) => inWin(x.t, P.windows.replication));
      byCoin[c] = { decisive: summary(d, mDec), replication: summary(r, mRep) };
      dec.push(...d); rep.push(...r);
    }
    const counts = Object.fromEntries(Object.keys(data).map((c) => [c, byCoin[c].decisive.n]));
    const pl = [];
    for (let s = 1; s <= P.seeds; s++) pl.push(placebo(data, { hold, filter, counts, seed: s }));
    const sorted = [...pl].sort((a, b) => a - b);
    const decisive = summary(dec, mDec);
    tests.push({
      id, hold, filter, decisive, replication: summary(rep, mRep), byCoin,
      p: pOneSided(decisive.tMonths),
      placebo: { seeds: P.seeds, mean: r3d(mean(pl)), p95: r3d(quantile(sorted, P.placeboQ)), max: r3d(sorted[sorted.length - 1]), values: pl.map(r3d) },
      _pl95: quantile(sorted, P.placeboQ), _net: mean(dec.map((x) => x.net)), _rep: mean(rep.map((x) => x.net)), _t: monthT(dec, mDec),
    });
  }
  const adj = holm(tests.map((x) => x.p));
  tests.forEach((x, i) => {
    x.p = r3d(x.p); x.holm = r3d(adj[i]);
    x.checks = {
      netPositive: x._net > 0, tMonths: x._t >= P.tMin, holm: adj[i] <= P.holmAlpha,
      replicationSameSign: x._rep > 0, beatsPlacebo: x._net > x._pl95,
    };
    x.pass = Object.values(x.checks).every(Boolean);
    delete x._pl95; delete x._net; delete x._rep; delete x._t;
  });
  return { tests, months: { decisive: mDec.length, replication: mRep.length }, lastT };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const data = {}, info = {};
  for (const [c, sym] of Object.entries(P.coins)) {
    const rows = load1d(sym);
    let gaps = 0;
    for (let k = 1; k < rows.length; k++) if (rows[k][0] - rows[k - 1][0] !== DAY) gaps++;
    data[c] = rows;
    info[c] = { days: rows.length, from: day(rows[0][0]), to: day(rows[rows.length - 1][0]), missingSteps: gaps, finRate: P.fin[c], finSrc: P.finSrc[c] };
  }
  const s = study(data);
  const passed = s.tests.filter((x) => x.pass).map((x) => x.id);
  const out = {
    built: '2026-11-13',
    verdict: passed.length ? 'PASS' : 'FAIL',
    passed,
    system: 'Crypto short-term reversal: long after a 3-day return below -2 x its trailing 90-day sd, 2.5 x ATR14 stop, exit day 3 / 7, optional SMA200 filter',
    prereg: 'PREREGISTRATION.md',
    source: 'council-data research/candles/crypto1d (Binance spot daily); exchange APIs refused by the sandbox proxy',
    data: info,
    costs: { cfdRoundTrip: P.cost, slipEachSide: P.slip, financing: 'long swap 15 % a year, nights at 17:00 New York, Friday x3 (ctrader/symbols.json, 13 Nov 2026)' },
    params: { look: P.look, sdN: P.sdN, k: P.k, smaN: P.smaN, atrN: P.atrN, atrK: P.atrK, exits: P.exits, windows: P.windows, tMin: P.tMin, holmAlpha: P.holmAlpha, seeds: P.seeds },
    months: s.months,
    tests: s.tests,
  };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  for (const x of s.tests) {
    console.log(x.id, 'dec', JSON.stringify(x.decisive), 'rep', JSON.stringify(x.replication), 'holm', x.holm, 'pl95', x.placebo.p95, 'pass', x.pass, JSON.stringify(x.checks));
    for (const [c, v] of Object.entries(x.byCoin)) console.log('  ', c, 'dec n', v.decisive.n, v.decisive.net, v.decisive.tMonths, '| rep n', v.replication.n, v.replication.net, v.replication.tMonths);
  }
  console.log('verdict', out.verdict, passed);
}
