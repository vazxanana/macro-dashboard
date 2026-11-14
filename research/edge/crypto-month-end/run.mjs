// Bitcoin / Ether turn of the month (research/edge/crypto-month-end). Paper research only.
// The rule, stop, costs, windows and pass bar are fixed in PREREGISTRATION.md (committed before this file).
// Usage (repo root, after `git fetch origin council-data`): node research/edge/crypto-month-end/run.mjs
// Reads the Binance daily caches from origin/council-data with `git show` (or $CME_DATA/<SYM>_1d.json.gz), writes result.json.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { CFD_CRYPTO } from '../../../council/fills.mjs';
import { nyOffsetH } from '../../../council/histdata.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const H = 3600, DAY = 86400;

export const P = {
  coins: { btc: 'BTCUSDT', eth: 'ETHUSDT' },
  primary: 'btc',
  atrN: 20, atrK: 2, cost: CFD_CRYPTO,
  // demo broker's crypto swap, % a year as a fraction (council-data ctrader/symbols.json of 13 Nov 2026, type 1; Friday x3)
  fin: { btc: 0.15, eth: 0.15 },
  seeds: 40, placeboBar: 38, tMin: 2,
  mirror: { entryDay: 13, exitDay: 17 },
};

export const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);

function loadGz(file) {
  const buf = process.env.CME_DATA ? fs.readFileSync(path.join(process.env.CME_DATA, file))
    : execFileSync('git', ['show', `origin/council-data:research/candles/crypto1d/${file}`], { maxBuffer: 1 << 28 });
  return JSON.parse(zlib.gunzipSync(buf));
}
export const load1d = (sym) => loadGz(`${sym}_1d.json.gz`);

// 17:00 New York rollovers in (a, b]; a Friday's counts `fri` nights (3 by the broker's rollover3Days)
export function rolloverNights(a, b, fri = 3) {
  let n = 0;
  for (let t = Math.ceil((a + 1) / H) * H; t <= b; t += H) {
    const d = new Date(t * 1000);
    if (d.getUTCMinutes() === 0 && d.getUTCHours() === (17 + nyOffsetH(t)) % 24) n += d.getUTCDay() === 5 ? fri : 1;
  }
  return n;
}

// rows [openTime, o, h, l, c] -> index by openTime
export const indexRows = (rows) => new Map(rows.map((r, i) => [r[0], i]));

// ATR(n) of the n daily candles up to and including index i (true range vs previous close); null without n+1 candles
export function atrAt(rows, i, n = P.atrN) {
  if (i - n < 0) return null;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) {
    const b = rows[k], pc = rows[k - 1][4];
    if (b[0] - rows[k - 1][0] !== DAY) return null;
    s += Math.max(b[2] - b[3], Math.abs(b[2] - pc), Math.abs(b[3] - pc));
  }
  return s / n;
}

// buy at the close of the day whose candle opens at tEntry, sell at the close of the day opening at tExit (both UTC 00:00)
export function simTrade(rows, ix, tEntry, tExit, coin, mult = 1) {
  const i = ix.get(tEntry), j = ix.get(tExit);
  if (i == null || j == null) return { skip: 'entry or exit candle missing' };
  if (j - i !== Math.round((tExit - tEntry) / DAY)) return { skip: 'hole inside the hold' };
  const atr = atrAt(rows, i);
  if (atr == null || !(atr > 0)) return { skip: 'ATR history missing' };
  const entry = rows[i][4], dist = P.atrK * atr, stop = entry - dist, T0 = tEntry + DAY;
  let exit = rows[j][4], exitT = tExit + DAY, stopped = false;
  for (let k = i + 1; k <= j; k++) {
    const r = rows[k];
    if (r[1] <= stop) { exit = r[1]; exitT = r[0]; stopped = true; break; }
    if (r[3] <= stop) { exit = stop; exitT = r[0] + DAY; stopped = true; break; }
  }
  const nights = rolloverNights(T0, exitT);
  const gross = (exit - entry) / dist, cost = mult * P.cost * entry / dist, fin = mult * nights * P.fin[coin] / 365 * entry / dist;
  return {
    entryDay: day(tEntry), t: tEntry, entry, stop, exit, exitDay: day(exitT - DAY), stopped, nights,
    gross, cost, fin, R: gross - cost - fin, pct: (rows[j][4] - entry) / entry * 100,
  };
}

const dim = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); // m 0-based
const at = (y, m, d) => Date.UTC(y, m, d) / 1000;                     // 00:00 UTC open of that day (m may overflow)

// the month's events: entry close of the 3rd-to-last day of month (y, m), exit close of day 2 of the next month
export function turnDates(y, m) {
  const last = dim(y, m);
  return { tEntry: at(y, m, last - 2), tExit: at(y, m + 1, 2) };
}
export function mirrorDates(y, m) { return { tEntry: at(y, m, P.mirror.entryDay), tExit: at(y, m, P.mirror.exitDay) }; }

export function months(rows) {
  const a = new Date(rows[0][0] * 1000), b = new Date(rows.at(-1)[0] * 1000), out = [];
  for (let y = a.getUTCFullYear(), m = a.getUTCMonth(); y < b.getUTCFullYear() || (y === b.getUTCFullYear() && m <= b.getUTCMonth()); ) {
    out.push([y, m]); m++; if (m === 12) { m = 0; y++; }
  }
  return out;
}

export function events(rows, coin, dates, mult = 1) {
  const ix = indexRows(rows), out = [], skipped = {};
  for (const [y, m] of months(rows)) {
    const { tEntry, tExit } = dates(y, m);
    const x = simTrade(rows, ix, tEntry, tExit, coin, mult);
    if (x.skip) { skipped[x.skip] = (skipped[x.skip] || 0) + 1; continue; }
    out.push({ ...x, month: `${y}-${String(m + 1).padStart(2, '0')}`, y, m });
  }
  return { out, skipped };
}

export function stats(xs, key = 'R') {
  const v = xs.map((x) => x[key]), n = v.length;
  if (!n) return { n: 0 };
  const mean = v.reduce((s, x) => s + x, 0) / n;
  const sd = n > 1 ? Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1)) : 0;
  return { n, mean, sd, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : 0, total: mean * n, win: v.filter((x) => x > 0).length / n };
}
export function monthSumT(xs) {
  const by = new Map();
  for (const x of xs) by.set(x.month, (by.get(x.month) || 0) + x.R);
  return stats([...by.values()].map((R) => ({ R }))).t;
}

// deterministic generator (mulberry32)
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// one seed: for each event month, a random 4-day window inside the month away from the turn (entry close of day 2..last-6)
export function placeboSeed(rows, coin, evs, seed) {
  const ix = indexRows(rows), r = rng(seed), out = [];
  for (const e of evs) {
    const last = dim(e.y, e.m), lo = 2, hi = last - 6;
    const d = lo + Math.floor(r() * (hi - lo + 1));
    const x = simTrade(rows, ix, at(e.y, e.m, d), at(e.y, e.m, d + 4), coin);
    if (!x.skip) out.push(x);
  }
  return stats(out).mean;
}

const r4 = (x) => (x == null || !Number.isFinite(x) ? x : Math.round(x * 1e4) / 1e4);
const r2 = (x) => Math.round(x * 100) / 100;
function sum(s) { return s.n ? { n: s.n, R: r4(s.mean), t: r2(s.t), total: r2(s.total), win: r4(s.win) } : { n: 0 }; }

export function analyse(rows, coin) {
  const base = events(rows, coin, turnDates), x0 = events(rows, coin, turnDates, 0), x2 = events(rows, coin, turnDates, 2);
  const N = base.out.length, h = Math.floor(N / 2);
  const split = (arr) => ({ is: arr.slice(0, h), oos: arr.slice(h) });
  const b = split(base.out), z = split(x0.out), d = split(x2.out);
  const win = (k) => {
    const xs = b[k], s = stats(xs);
    return {
      from: xs[0].entryDay, to: xs.at(-1).exitDay, ...sum(s), monthT: r2(monthSumT(xs)),
      gross: r4(stats(xs, 'gross').mean), costR: r4(stats(xs, 'cost').mean), finR: r4(stats(xs, 'fin').mean),
      nights: r2(stats(xs, 'nights').mean), stops: xs.filter((x) => x.stopped).length,
      cost0: sum(stats(z[k])), cost2: sum(stats(d[k])), pctNoStop: r4(stats(xs, 'pct').mean),
    };
  };
  const is = win('is'), oos = win('oos');
  const seeds = [];
  for (let s = 1; s <= P.seeds; s++) seeds.push({ seed: s, R: r4(placeboSeed(rows, coin, b.oos, s)) });
  const beats = seeds.filter((s) => stats(b.oos).mean > s.R).length;
  const mir = events(rows, coin, mirrorDates).out, mh = mir.filter((x) => x.t >= b.oos[0].t);
  const years = {};
  for (const x of base.out) (years[x.y] ||= []).push(x);
  return {
    N, skipped: base.skipped, is, oos,
    placebo: { beats, of: P.seeds, median: r4(seeds.map((s) => s.R).sort((a, c) => a - c)[P.seeds / 2]), seeds },
    mirror: { all: sum(stats(mir)), oos: sum(stats(mh)), is: sum(stats(mir.filter((x) => x.t < b.oos[0].t))) },
    years: Object.fromEntries(Object.entries(years).map(([y, xs]) => [y, sum(stats(xs))])),
    trades: base.out.map((x) => ({ m: x.month, in: x.entryDay, out: x.exitDay, e: r2(x.entry), s: r2(x.stop), x: r2(x.exit), st: x.stopped, n: x.nights, R: r4(x.R) })),
  };
}

export function judge(a) {
  const c = {
    oosT: a.oos.t >= P.tMin, isPos: a.is.R > 0, cost2Pos: (a.oos.cost2.R ?? -1) > 0, placebo: a.placebo.beats >= P.placeboBar,
  };
  return { ...c, pass: Object.values(c).every(Boolean) };
}

function main() {
  const res = {};
  for (const [coin, sym] of Object.entries(P.coins)) {
    const rows = load1d(sym);
    res[coin] = { data: { from: day(rows[0][0]), to: day(rows.at(-1)[0]), days: rows.length }, ...analyse(rows, coin) };
    res[coin].checks = judge(res[coin]);
  }
  const b = res.btc, pass = b.checks.pass;
  const head = `BTC turn of the month OOS ${b.oos.R >= 0 ? '+' : ''}${b.oos.R}R an event (n ${b.oos.n}, t ${b.oos.t}), in sample ${b.is.R >= 0 ? '+' : ''}${b.is.R}R; beats ${b.placebo.beats} of 40 placebo seeds`;
  const out = {
    built: '2026-11-14',
    verdict: pass ? 'PASS' : 'FAIL',
    headline: head,
    system: 'Turn-of-the-month long on BTC (ETH reported), Binance spot daily, CFD costs and financing',
    prereg: 'PREREGISTRATION.md',
    source: 'council-data research/candles/crypto1d (Binance spot UTC days)',
    params: { atrN: P.atrN, atrK: P.atrK, cost: P.cost, finLong: P.fin, seeds: P.seeds, placeboBar: P.placeboBar, tMin: P.tMin, mirror: P.mirror },
    ...res,
  };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  for (const c of ['btc', 'eth']) {
    const r = res[c];
    console.log(c, 'N', r.N, 'IS', JSON.stringify(r.is), '\nOOS', JSON.stringify(r.oos), '\nplacebo', r.placebo.beats, r.placebo.median, 'mirror', JSON.stringify(r.mirror), JSON.stringify(r.checks));
  }
  console.log(out.verdict, head);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
