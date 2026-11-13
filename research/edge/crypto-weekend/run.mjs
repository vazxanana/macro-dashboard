// Bitcoin / Ether weekend long and Monday short, out of sample (research/edge/crypto-weekend). Paper research only.
// The rules, stop, costs, windows and pass bar are fixed in PREREGISTRATION.md (committed before this file).
// Usage (repo root, after `git fetch origin council-data`): node research/edge/crypto-weekend/run.mjs
// Reads the Binance 5-minute and daily caches from origin/council-data with `git show` (or $CW_DATA/<SYM>_5m.json.gz and
// <SYM>_1d.json.gz), writes result.json.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { CFD_CRYPTO } from '../../../council/fills.mjs';
import { nyOffsetH } from '../../../council/histdata.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const H = 3600, M5 = 300, DAY = 86400;

export const P = {
  coins: { btc: 'BTCUSDT', eth: 'ETHUSDT' },
  rules: {
    W: { side: 1, dow: 5, hour: 21, hold: 50 * H, name: 'Long the weekend (Fri 21:00 to Sun 23:00 UTC)' },
    M: { side: -1, dow: 1, hour: 0, hold: 24 * H, name: 'Short Monday (Mon 00:00 to Tue 00:00 UTC)' },
  },
  atrN: 24, atrK: 2, cost: CFD_CRYPTO, cover: 0.95,
  // demo broker's crypto swap, % a year as a fraction (council-data ctrader/symbols.json of 13 Nov 2026, type 1; Friday x3)
  fin: { btc: { long: 0.15, short: 0.075 }, eth: { long: 0.15, short: 0.10 } },
  windows: { discovery: ['2022-01-01', '2023-12-31'], decisive: ['2024-01-01', '2099-01-01'], context: ['2017-08-17', '2021-12-31'] },
  minN: 100, tMin: 2, alpha: 0.05, seeds: 40, placeboBar: 36,
  placeboDays: { W: [1, 2, 3], M: [2, 3, 4, 5] },
};
export const ts = (s) => Math.floor(Date.parse(s + 'T00:00:00Z') / 1000);
export const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export const inWin = (t, [a, b]) => t >= ts(a) && t < ts(b) + DAY;

function loadGz(rel, file) {
  const buf = process.env.CW_DATA ? fs.readFileSync(path.join(process.env.CW_DATA, file))
    : execFileSync('git', ['show', `origin/council-data:research/candles/${rel}/${file}`], { maxBuffer: 1 << 29 });
  return JSON.parse(zlib.gunzipSync(buf));
}
export const load5m = (sym) => loadGz('crypto5m', `${sym}_5m.json.gz`);
export const load1d = (sym) => loadGz('crypto1d', `${sym}_1d.json.gz`);

// 5-minute rows [t, o, h, l, c] -> { m5: Map t -> row, Hm: Map hourStart -> {t,o,h,l,c} (complete hours only) }
export function index(rows) {
  const m5 = new Map();
  for (const r of rows) m5.set(r[0], r);
  const Hm = new Map(), seen = new Set();
  for (const r of rows) {
    const T = r[0] - (r[0] % H);
    if (seen.has(T)) continue;
    seen.add(T);
    const m = [];
    for (let k = 0; k < 12; k++) { const x = m5.get(T + k * M5); if (!x) break; m.push(x); }
    if (m.length !== 12) continue;
    let hi = -Infinity, lo = Infinity;
    for (const x of m) { if (x[2] > hi) hi = x[2]; if (x[3] < lo) lo = x[3]; }
    Hm.set(T, { t: T, o: m[0][1], h: hi, l: lo, c: m[11][4] });
  }
  return { m5, Hm };
}

// ATR(n) of the n complete H1 candles that closed at or before entry time T (needs the n+1 hours before T)
export function atrBefore(Hm, T, n = P.atrN) {
  const T0 = T - (T % H);
  let s = 0;
  for (let k = 1; k <= n; k++) {
    const b = Hm.get(T0 - k * H), p = Hm.get(T0 - (k + 1) * H);
    if (!b || !p) return null;
    s += Math.max(b.h - b.l, Math.abs(b.h - p.c), Math.abs(b.l - p.c));
  }
  return s / n;
}

// 17:00 New York rollovers in (a, b]; a Friday's counts `fri` nights (3 by the broker's rollover3Days)
export function rolloverNights(a, b, fri = 3) {
  let n = 0;
  for (let t = Math.ceil((a + 1) / H) * H; t <= b; t += H) {
    const d = new Date(t * 1000);
    if (d.getUTCMinutes() === 0 && d.getUTCHours() === (17 + nyOffsetH(t)) % 24) n += d.getUTCDay() === 5 ? fri : 1;
  }
  return n;
}

// one trade: enter at the open of the 5m candle at T0, hold `hold` seconds, stop = atrK x ATR; null when data is missing
export function simTrade(ix, T0, hold, side, coin) {
  const first = ix.m5.get(T0), lastT = T0 + hold - M5, last = ix.m5.get(lastT);
  if (!first || !last) return { skip: 'entry or exit candle missing' };
  const atr = atrBefore(ix.Hm, T0);
  if (atr == null || !(atr > 0)) return { skip: 'ATR hours missing' };
  let have = 0;
  for (let t = T0; t <= lastT; t += M5) if (ix.m5.has(t)) have++;
  if (have < P.cover * (hold / M5)) return { skip: 'hold under 95 % covered' };
  const entry = first[1], dist = P.atrK * atr, stop = entry - side * dist;
  let exit = last[4], exitT = T0 + hold, stopped = false;
  for (let t = T0; t <= lastT; t += M5) {
    const r = ix.m5.get(t);
    if (!r) continue;
    if (side > 0 && r[3] <= stop) { exit = Math.min(r[1], stop); exitT = t + M5; stopped = true; break; }
    if (side < 0 && r[2] >= stop) { exit = Math.max(r[1], stop); exitT = t + M5; stopped = true; break; }
  }
  const rate = P.fin[coin][side > 0 ? 'long' : 'short'];
  const nights = rolloverNights(T0, exitT), nights1 = rolloverNights(T0, exitT, 1);
  const gross = side * (exit - entry) / dist, cost = P.cost * entry / dist;
  const fin = nights * rate / 365 * entry / dist, fin1 = nights1 * rate / 365 * entry / dist;
  return { t: T0, side, entry, stop, exit, exitT, stopped, nights, gross, cost, fin, R: gross - cost - fin, R1: gross - cost - fin1 };
}

// every week's start (UTC weekday dow 0=Sun, hour) between the first and last 5m candle
export function starts(rows, dow, hour) {
  const a = rows[0][0], b = rows.at(-1)[0];
  const d0 = a - (a % DAY);
  const out = [];
  for (let d = d0; d <= b; d += DAY) if (new Date(d * 1000).getUTCDay() === dow) out.push(d + hour * H);
  return out;
}

export function ruleTrades(ix, rows, coin, rule, win) {
  const tr = [], skipped = {};
  for (const T0 of starts(rows, rule.dow, rule.hour)) {
    if (!inWin(T0, win)) continue;
    const x = simTrade(ix, T0, rule.hold, rule.side, coin);
    if (x.skip) { skipped[x.skip] = (skipped[x.skip] || 0) + 1; continue; }
    tr.push(x);
  }
  return { trades: tr, skipped };
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
export function stats(trades) {
  const R = trades.map((x) => x.R), mt = monthT(trades);
  return { n: trades.length, R: r4(mean(R)), gross: r4(mean(trades.map((x) => x.gross))), costR: r4(mean(trades.map((x) => x.cost))), finR: r4(mean(trades.map((x) => x.fin))), R_fri1: r4(mean(trades.map((x) => x.R1))), total: +R.reduce((s, x) => s + x, 0).toFixed(2), t: +tStat(R).toFixed(2), monthT: +mt.t.toFixed(2), months: mt.months, win: trades.length ? r4(trades.filter((x) => x.R > 0).length / trades.length) : 0, stops: trades.filter((x) => x.stopped).length, nights: r4(mean(trades.map((x) => x.nights))) };
}
export function byYear(trades) {
  const y = {};
  for (const x of trades) (y[day(x.t).slice(0, 4)] ||= []).push(x);
  return Object.fromEntries(Object.entries(y).map(([k, a]) => [k, { n: a.length, R: r4(mean(a.map((x) => x.R))), gross: r4(mean(a.map((x) => x.gross))), total: +a.reduce((s, x) => s + x.R, 0).toFixed(2) }]));
}
export function judge(tests) {
  const ps = tests.map((x) => 1 - phi(x.t)), adj = holm(ps);
  return tests.map((x, i) => {
    const c = { n100: x.n >= P.minN, positive: x.R > 0, t2: x.t >= P.tMin, holm: adj[i] < P.alpha, sameSignDiscovery: x.discovery.R > 0 };
    return { ...x, p: r4(ps[i]), pHolm: r4(adj[i]), checks: c, pass: Object.values(c).every(Boolean) };
  });
}

// daily context: Saturday open -> Sunday close, Monday open -> close, % mean and t
export function dailyContext(d1, win) {
  const by = new Map(d1.map((r) => [r[0], r]));
  const we = [], mo = [];
  for (const r of d1) {
    if (!inWin(r[0], win)) continue;
    const dw = new Date(r[0] * 1000).getUTCDay();
    if (dw === 6) { const s = by.get(r[0] + DAY); if (s) we.push(s[4] / r[1] - 1); }
    if (dw === 1) mo.push(r[4] / r[1] - 1);
  }
  const f = (a) => ({ n: a.length, meanPct: +(mean(a) * 100).toFixed(3), t: +tStat(a).toFixed(2) });
  return { weekendSatSun: f(we), monday: f(mo) };
}

export function study(data, d1 = {}) {
  const ix = {}; for (const c of Object.keys(data)) ix[c] = index(data[c]);
  const D = P.windows.discovery, W = P.windows.decisive;
  const tests = [], trades = {};
  for (const [k, rule] of Object.entries(P.rules)) for (const c of Object.keys(data)) {
    const dec = ruleTrades(ix[c], data[c], c, rule, W), dis = ruleTrades(ix[c], data[c], c, rule, D);
    trades[`${k}-${c}`] = dec.trades;
    tests.push({ test: `${k}-${c}`, rule: k, coin: c, side: rule.side > 0 ? 'long' : 'short', ...stats(dec.trades), skipped: dec.skipped, byYear: byYear(dec.trades), discovery: { ...stats(dis.trades), skipped: dis.skipped, byYear: byYear(dis.trades) } });
  }
  const judged = judge(tests);
  // placebo: one random start a seed (same side, hold, stop, costs), every week of the decisive window
  const placebo = {};
  for (const [k, rule] of Object.entries(P.rules)) {
    const days = P.placeboDays[k], seeds = [];
    for (let s = 1; s <= P.seeds; s++) {
      const r = rng(s), dow = days[Math.floor(r() * days.length)], hour = Math.floor(r() * 24), row = { seed: s, dow, hour };
      for (const c of Object.keys(data)) row[c] = r4(mean(ruleTrades(ix[c], data[c], c, { ...rule, dow, hour }, W).trades.map((x) => x.R)));
      seeds.push(row);
    }
    const beats = {};
    for (const c of Object.keys(data)) { const real = judged.find((x) => x.test === `${k}-${c}`).R; beats[c] = seeds.filter((x) => real > x[c]).length; }
    placebo[k] = { beats, of: P.seeds, seeds };
  }
  const context = {};
  for (const c of Object.keys(d1)) context[c] = { early: dailyContext(d1[c], P.windows.context), discovery: dailyContext(d1[c], D), decisive: dailyContext(d1[c], W), from: day(d1[c][0][0]) };
  const info = {}; for (const c of Object.keys(data)) info[c] = { from: day(data[c][0][0]), to: day(data[c].at(-1)[0]), m5: data[c].length, hours: ix[c].Hm.size };
  return { tests: judged, placebo, context, data: info, trades };
}

function main() {
  const data = {}, d1 = {};
  for (const [c, s] of Object.entries(P.coins)) { data[c] = load5m(s); d1[c] = load1d(s); }
  const S = study(data, d1);
  const R = {
    built: '2026-11-13', verdict: S.tests.some((x) => x.pass) ? 'PASS' : 'FAIL',
    system: 'Weekend long and Monday short on BTC and ETH (Binance spot 5m, CFD costs and financing)', prereg: 'PREREGISTRATION.md',
    source: 'council-data research/candles/crypto5m and crypto1d (Binance spot); exchange APIs refused by the sandbox proxy',
    windows: P.windows, params: { rules: P.rules, atrN: P.atrN, atrK: P.atrK, cost: P.cost, fin: P.fin, cover: P.cover },
    data: S.data, tests: S.tests, placebo: S.placebo, context: S.context,
  };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  console.log(JSON.stringify({ verdict: R.verdict, data: R.data, tests: R.tests.map(({ byYear: _y, discovery, ...x }) => ({ ...x, discovery: { n: discovery.n, R: discovery.R, t: discovery.t, gross: discovery.gross } })), placebo: Object.fromEntries(Object.entries(R.placebo).map(([k, v]) => [k, v.beats])), context: R.context }, null, 1));
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
