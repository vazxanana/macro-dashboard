// Bitcoin / Ether hour-of-day returns, out of sample (research/edge/crypto-hour). Paper research only.
// The rule, stop, costs, windows and pass bar are fixed in PREREGISTRATION.md (committed before this file).
// Usage (repo root, after `git fetch origin council-data`): node research/edge/crypto-hour/run.mjs
// Reads the Binance 5-minute cache from origin/council-data with `git show` (or $CH_DATA/<SYM>_5m.json.gz), writes result.json.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { CFD_CRYPTO } from '../../../council/fills.mjs';
import { nyOffsetH } from '../../../council/histdata.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const H = 3600, M5 = 300;

export const P = {
  coins: { btc: 'BTCUSDT', eth: 'ETHUSDT' },
  atrN: 24, atrK: 2, cost: CFD_CRYPTO,
  // demo broker's crypto swap, % a year as a fraction (council-data ctrader/symbols.json of 13 Nov 2026, type 1; Friday x3)
  fin: { btc: { long: 0.15, short: 0.075 }, eth: { long: 0.15, short: 0.10 } },
  windows: { discovery: ['2022-01-01', '2023-12-31'], decisive: ['2024-01-01', '2099-01-01'] },
  minN: 300, tMin: 2, alpha: 0.05, seeds: 40,
};
export const ts = (s) => Math.floor(Date.parse(s + 'T00:00:00Z') / 1000);
export const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const inWin = (t, [a, b]) => t >= ts(a) && t < ts(b) + 86400;

export function load5m(sym) {
  const buf = process.env.CH_DATA ? fs.readFileSync(path.join(process.env.CH_DATA, `${sym}_5m.json.gz`))
    : execFileSync('git', ['show', `origin/council-data:research/candles/crypto5m/${sym}_5m.json.gz`], { maxBuffer: 1 << 29 });
  return JSON.parse(zlib.gunzipSync(buf));
}

// H1 candles from 5-minute rows [t, o, h, l, c]: UTC hours with all twelve candles on file. Map hourStart -> { t, o, h, l, c, m5 }
export function hours(rows) {
  const by = new Map();
  for (const r of rows) {
    const T = r[0] - (r[0] % H);
    let x = by.get(T);
    if (!x) by.set(T, (x = { t: T, m5: [] }));
    x.m5.push(r);
  }
  const out = new Map();
  for (const [T, x] of by) {
    const m = x.m5.sort((a, b) => a[0] - b[0]);
    if (m.length !== 12 || m.some((r, k) => r[0] !== T + k * M5)) continue;
    out.set(T, { t: T, o: m[0][1], h: Math.max(...m.map((r) => r[2])), l: Math.min(...m.map((r) => r[3])), c: m[11][4], m5: m });
  }
  return out;
}

// ATR(n) of the n complete H1 candles that closed before hour T (needs the n+1 hours before T); null when one is missing
export function atrBefore(Hm, T, n = P.atrN) {
  let s = 0;
  for (let k = 1; k <= n; k++) {
    const b = Hm.get(T - k * H), p = Hm.get(T - (k + 1) * H);
    if (!b || !p) return null;
    s += Math.max(b.h - b.l, Math.abs(b.h - p.c), Math.abs(b.l - p.c));
  }
  return s / n;
}

// rollovers (17:00 New York) in (a, b]: { nights } with Friday's counting three
export function rolloverNights(a, b) {
  let n = 0;
  for (let t = Math.ceil((a + 1) / H) * H; t <= b; t += H) {
    const d = new Date(t * 1000);
    if (d.getUTCMinutes() === 0 && d.getUTCHours() === (17 + nyOffsetH(t)) % 24) n += d.getUTCDay() === 5 ? 3 : 1;
  }
  return n;
}

// one trade in hour bar `b`: side +1 / -1, stop dist = atrK x atr. Stop checked on the twelve 5-minute candles in order.
export function simHour(b, side, atr, coin) {
  const entry = b.o, dist = P.atrK * atr, stop = entry - side * dist;
  let exit = b.c, exitT = b.t + H, stopped = false;
  for (const r of b.m5) {
    if (side > 0 && r[3] <= stop) { exit = Math.min(r[1], stop); exitT = r[0] + M5; stopped = true; break; }
    if (side < 0 && r[2] >= stop) { exit = Math.max(r[1], stop); exitT = r[0] + M5; stopped = true; break; }
  }
  const nights = rolloverNights(b.t, exitT), rate = P.fin[coin][side > 0 ? 'long' : 'short'];
  const gross = side * (exit - entry) / dist, cost = P.cost * entry / dist, fin = nights * rate / 365 * entry / dist;
  return { t: b.t, side, entry, stop, exit, stopped, nights, gross, cost, fin, R: gross - cost - fin };
}

// every trade of one coin in UTC hour h with side, inside window
export function legTrades(Hm, coin, h, side, win) {
  const out = [];
  for (const b of Hm.values()) {
    if (new Date(b.t * 1000).getUTCHours() !== h || !inWin(b.t, win)) continue;
    const a = atrBefore(Hm, b.t);
    if (a == null || !(a > 0)) continue;
    out.push(simHour(b, side, a, coin));
  }
  return out.sort((x, y) => x.t - y.t);
}

// ── statistics ──
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const sd = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)) : 0; };
export const tStat = (a) => (sd(a) > 0 ? mean(a) / (sd(a) / Math.sqrt(a.length)) : 0);
export function monthT(trades, key = 'R') {
  const m = new Map();
  for (const x of trades) { const k = day(x.t).slice(0, 7); m.set(k, (m.get(k) || 0) + x[key]); }
  const s = [...m.values()];
  return { months: s.length, t: tStat(s) };
}
export const phi = (z) => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };
export function holm(ps) {
  const o = ps.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p), adj = new Array(ps.length); let run = 0;
  o.forEach((x, k) => { run = Math.max(run, Math.min(1, x.p * (ps.length - k))); adj[x.i] = run; });
  return adj;
}
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const r4 = (x) => +x.toFixed(4);

// hour-of-day table of gross hour returns (close / open - 1), pooled over the coins given
export function hourTable(Hs, win) {
  const rows = [];
  for (let h = 0; h < 24; h++) {
    const r = [];
    for (const Hm of Hs) for (const b of Hm.values()) if (new Date(b.t * 1000).getUTCHours() === h && inWin(b.t, win)) r.push(b.c / b.o - 1);
    rows.push({ h, n: r.length, meanBp: +(mean(r) * 1e4).toFixed(3), t: +tStat(r).toFixed(2) });
  }
  return rows;
}
// the one choice of the study: long = highest t, short = lowest t (discovery only)
export function chooseHours(table) {
  const s = [...table].sort((a, b) => b.t - a.t);
  return { long: s[0].h, short: s[s.length - 1].h };
}
export function stats(trades) {
  const mt = monthT(trades);
  return { n: trades.length, R: r4(mean(trades.map((x) => x.R))), gross: r4(mean(trades.map((x) => x.gross))), costR: r4(mean(trades.map((x) => x.cost))), finR: r4(mean(trades.map((x) => x.fin))), total: +trades.reduce((s, x) => s + x.R, 0).toFixed(2), t: +tStat(trades.map((x) => x.R)).toFixed(2), monthT: +mt.t.toFixed(2), months: mt.months, stops: trades.filter((x) => x.stopped).length, withFin: trades.filter((x) => x.nights > 0).length };
}
export function judge(tests) {
  const ps = tests.map((x) => 1 - phi(x.monthT)), adj = holm(ps);
  return tests.map((x, i) => {
    const c = { n300: x.n >= P.minN, positive: x.R > 0, t2: x.monthT >= P.tMin, holm: adj[i] < P.alpha };
    return { ...x, p: r4(ps[i]), pHolm: r4(adj[i]), checks: c, pass: Object.values(c).every(Boolean) };
  });
}

export function study(data) {
  const Hs = {}; for (const c of Object.keys(data)) Hs[c] = hours(data[c]);
  const D = P.windows.discovery, W = P.windows.decisive;
  const discovery = hourTable(Object.values(Hs), D), pick = chooseHours(discovery);
  const legs = [['L', pick.long, 1], ['S', pick.short, -1]];
  const tests = [], trades = {};
  for (const [leg, h, side] of legs) for (const c of Object.keys(Hs)) {
    const tr = legTrades(Hs[c], c, h, side, W);
    trades[`${leg}-${c}`] = tr;
    const byYear = {};
    for (const x of tr) (byYear[day(x.t).slice(0, 4)] ||= []).push(x);
    tests.push({ test: `${leg}-${c}`, leg, coin: c, hourUTC: h, side: side > 0 ? 'long' : 'short', ...stats(tr), byYear: Object.fromEntries(Object.entries(byYear).map(([y, a]) => [y, { n: a.length, R: r4(mean(a.map((x) => x.R))), total: +a.reduce((s, x) => s + x.R, 0).toFixed(2) }])) });
  }
  const judged = judge(tests);
  // descriptive decisive table: gross hour returns + net R of a long / short in each hour, per coin and pooled
  const decisive = { pooled: hourTable(Object.values(Hs), W), byCoin: {} };
  for (const c of Object.keys(Hs)) {
    const tb = hourTable([Hs[c]], W);
    for (const row of tb) {
      const L = legTrades(Hs[c], c, row.h, 1, W), S = legTrades(Hs[c], c, row.h, -1, W);
      row.longR = r4(mean(L.map((x) => x.R))); row.shortR = r4(mean(S.map((x) => x.R)));
    }
    decisive.byCoin[c] = tb;
  }
  // placebo: random long hour and a different random short hour, pooled net R a trade per leg on the decisive window
  const pooledR = (h, side) => { const a = Object.keys(Hs).flatMap((c) => legTrades(Hs[c], c, h, side, W)); return r4(mean(a.map((x) => x.R))); };
  const realL = pooledR(pick.long, 1), realS = pooledR(pick.short, -1), seeds = [];
  for (let s = 1; s <= P.seeds; s++) {
    const r = rng(s), hl = Math.floor(r() * 24); let hs = Math.floor(r() * 23); if (hs >= hl) hs += 1;
    seeds.push({ seed: s, long: hl, short: hs, longR: pooledR(hl, 1), shortR: pooledR(hs, -1) });
  }
  const placebo = { realLongR: realL, realShortR: realS, beatsLong: seeds.filter((x) => realL > x.longR).length, beatsShort: seeds.filter((x) => realS > x.shortR).length, of: P.seeds, seeds };
  const data_ = {}; for (const c of Object.keys(data)) data_[c] = { from: day(data[c][0][0]), to: day(data[c].at(-1)[0]), m5: data[c].length, hours: Hs[c].size };
  return { pick, discovery, tests: judged, decisive, placebo, data: data_, trades };
}

function main() {
  const data = {}; for (const [c, s] of Object.entries(P.coins)) data[c] = load5m(s);
  const S = study(data);
  const R = {
    built: '2026-11-13', verdict: S.tests.some((x) => x.pass) ? 'PASS' : 'FAIL',
    system: 'Hour-of-day returns on BTC and ETH (Binance spot 5m, CFD costs and financing)', prereg: 'PREREGISTRATION.md',
    source: 'council-data research/candles/crypto5m (Binance spot); exchange APIs refused by the sandbox proxy', windows: P.windows,
    params: { atrN: P.atrN, atrK: P.atrK, cost: P.cost, fin: P.fin }, data: S.data, pick: S.pick,
    tests: S.tests, discovery: S.discovery, decisive: S.decisive, placebo: S.placebo,
  };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  console.log(JSON.stringify({ verdict: R.verdict, pick: R.pick, data: R.data, tests: R.tests.map(({ byYear, ...x }) => x), placebo: { ...R.placebo, seeds: undefined } }, null, 1));
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
