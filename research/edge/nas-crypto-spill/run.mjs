// Edge research · nas-crypto-spill: does a big NAS100 cash session carry into BTC / ETH overnight (follow) or reverse (fade)?
// Rule, costs, windows and pass bar: PREREGISTRATION.md (committed before this file was run).
//   node --use-env-proxy run.mjs fetch <dir>   NAS100 M15 (OANDA proxy) + BTC / ETH 5m (council-data, git show) → <dir>/*.json.gz
//   node run.mjs full <dir>                    writes result.json and RESULT.md beside this file
// Rows are [t, o, h, l, c] (unix seconds, candle start). Keep <dir> out of git.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { nyOffsetH } from '../../../council/histdata.mjs';
import { CFD_CRYPTO } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const H = 3600, D = 86400, M5 = 300;
export const FROM = Date.UTC(2021, 10, 1) / 1000, END = Date.UTC(2026, 10, 13) / 1000;
export const WINDOWS = { dec: ['2022-01-03', '2026-12-31'], rep: ['2018-01-01', '2020-12-31'], h1: ['2022-01-03', '2023-12-31'], h2: ['2024-01-01', '2026-12-31'] };
export const LOOKBACK = 20, K = 1.5, ATR_N = 24, STOP_ATR = 1.5, SEEDS = 40, PCTL = 0.95;
export const SPREAD = 0.0002;                       // the spread part of CFD_CRYPTO; slippage = half of it on each of two market orders
export const COST_RT = CFD_CRYPTO + SPREAD;         // 0.0006 of the entry price
export const SWAP = { btc: { long: 0.15, short: 0.075 }, eth: { long: 0.15, short: 0.10 } };   // % a year paid, ctrader/symbols.json 13 Nov 2026
export const VARIANTS = { follow: 1, fade: -1 };

// ─── New York clock ───
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
export function nyTime(ymd, hh, mm = 0) {
  const local = Date.parse(ymd + 'T00:00:00Z') / 1000 + hh * H + mm * 60;
  let t = local + 5 * H;
  t = local + nyOffsetH(t) * H;
  return local + nyOffsetH(t) * H;
}
export const nyDate = (t) => iso((t - nyOffsetH(t) * H) * 1000);
const nyWall = (t) => new Date((t - nyOffsetH(t) * H) * 1000);

// ─── NYSE calendar ───
const wdOf = (ymd) => new Date(ymd + 'T00:00:00Z').getUTCDay();
export const addDays = (ymd, n) => iso(Date.parse(ymd + 'T00:00:00Z') + n * D * 1000);
const nth = (y, m, wd, n) => {
  if (n > 0) { let d = Date.UTC(y, m, 1); while (new Date(d).getUTCDay() !== wd) d += D * 1000; return iso(d + (n - 1) * 7 * D * 1000); }
  let d = Date.UTC(y, m + 1, 0); while (new Date(d).getUTCDay() !== wd) d -= D * 1000; return iso(d);
};
const observed = (y, m, d) => { const s = iso(Date.UTC(y, m, d)), w = wdOf(s); return w === 6 ? addDays(s, -1) : w === 0 ? addDays(s, 1) : s; };
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1; return Date.UTC(y, mo - 1, da);
}
const SPECIAL = new Set(['2007-01-02', '2012-10-29', '2012-10-30', '2018-12-05', '2025-01-09']);
const CAL = new Map();
export function nyseYear(y) {
  if (CAL.has(y)) return CAL.get(y);
  const closed = new Set([nth(y, 0, 1, 3), nth(y, 1, 1, 3), iso(easter(y) - 2 * D * 1000), nth(y, 4, 1, -1), observed(y, 6, 4), nth(y, 8, 1, 1),
    nth(y, 10, 4, 4), observed(y, 11, 25)]);
  const ny = iso(Date.UTC(y, 0, 1)); if (wdOf(ny) === 0) closed.add(addDays(ny, 1)); else if (wdOf(ny) !== 6) closed.add(ny);
  if (y >= 2022) closed.add(observed(y, 5, 19));
  const early = new Set();
  const j3 = iso(Date.UTC(y, 6, 3)); if (wdOf(j3) >= 1 && wdOf(j3) <= 5 && !closed.has(j3)) early.add(j3);
  early.add(addDays(nth(y, 10, 4, 4), 1));
  const c24 = iso(Date.UTC(y, 11, 24)); if (wdOf(c24) >= 1 && wdOf(c24) <= 5 && !closed.has(c24)) early.add(c24);
  const out = { closed, early }; CAL.set(y, out); return out;
}
// a day the exchange opens at 09:30 (half days included)
export function tradingDay(ymd) {
  const w = wdOf(ymd); if (w === 0 || w === 6 || SPECIAL.has(ymd)) return false;
  return !nyseYear(+ymd.slice(0, 4)).closed.has(ymd);
}
// a day with a 16:00 close (half days excluded)
export const fullDay = (ymd) => tradingDay(ymd) && !nyseYear(+ymd.slice(0, 4)).early.has(ymd);
export function nextTradingDay(ymd) { let d = addDays(ymd, 1); while (!tradingDay(d)) d = addDays(d, 1); return d; }

// ─── signal ───
export const index = (bars) => { const m = new Map(); bars.forEach((b, i) => m.set(b[0], i)); return m; };
// NAS100 M15 → [{ day, r }]: open of the 09:30 candle to the close of the 15:45 candle, full days only
export function sessionMoves(nas, from = FROM, to = END) {
  const ix = index(nas), out = [];
  for (let t = from; t < to; t += D) {
    const day = iso(t * 1000); if (!fullDay(day)) continue;
    const a = ix.get(nyTime(day, 9, 30)), b = ix.get(nyTime(day, 15, 45));
    if (a == null || b == null) continue;
    out.push({ day, r: nas[b][4] / nas[a][1] - 1 });
  }
  return out;
}
export const median = (xs) => { const s = xs.slice().sort((a, b) => a - b), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
export function signals(moves) {
  const out = [];
  for (let i = LOOKBACK; i < moves.length; i++) {
    const m = median(moves.slice(i - LOOKBACK, i).map((x) => Math.abs(x.r))), r = moves[i].r;
    if (Math.abs(r) > K * m) out.push({ ...moves[i], m20: m, dir: Math.sign(r) });
  }
  return out;
}

// ─── crypto ───
// 5m → complete UTC-hour H1 candles (an hour with at least one 5m candle)
export function toH1(m5) {
  const out = []; let cur = null;
  for (const b of m5) {
    const h = b[0] - (b[0] % H);
    if (!cur || cur[0] !== h) { if (cur) out.push(cur); cur = [h, b[1], b[2], b[3], b[4]]; }
    else { cur[2] = Math.max(cur[2], b[2]); cur[3] = Math.min(cur[3], b[3]); cur[4] = b[4]; }
  }
  if (cur) out.push(cur);
  return out;
}
// ATR of the n H1 candles that ended at or before `at` (true range, simple mean)
export function atrAt(h1, h1ix, at, n = ATR_N) {
  const k = h1ix.get(at - H); if (k == null || k < n) return null;   // the hour that ended exactly at `at`
  let s = 0;
  for (let j = k - n + 1; j <= k; j++) { const b = h1[j], p = h1[j - 1][4]; s += Math.max(b[2] - b[3], Math.abs(b[2] - p), Math.abs(b[3] - p)); }
  return s / n;
}
// 17:00 New York rollovers in (a, b], Monday-Friday, Friday x3
export function nights(a, b) {
  let n = 0;
  for (let t = a - (a % H) + H; t <= b; t += H) {
    const w = nyWall(t); if (w.getUTCHours() !== 17 || w.getUTCMinutes() !== 0) continue;
    const wd = w.getUTCDay(); if (wd >= 1 && wd <= 5) n += wd === 5 ? 3 : 1;
  }
  return n;
}
export const swapRate = (coin, side) => SWAP[coin][side > 0 ? 'long' : 'short'];
// one trade on one coin. c = { m5, ix, h1, h1ix }
export function trade(c, coin, day, side) {
  const at = nyTime(day, 16), exitAt = nyTime(nextTradingDay(day), 9, 30);
  const i = c.ix.get(at); if (i == null) return null;
  const a = atrAt(c.h1, c.h1ix, at); if (!(a > 0)) return null;
  const entry = c.m5[i][1], risk = STOP_ATR * a, stop = entry - side * risk;
  let exit = null, how = 'time', last = null, exitT = exitAt;
  for (let j = i; j < c.m5.length && c.m5[j][0] < exitAt; j++) {
    const b = c.m5[j];
    if (j > i && (side > 0 ? b[1] <= stop : b[1] >= stop)) { exit = b[1]; how = 'gap'; exitT = b[0]; break; }
    if (side > 0 ? b[3] <= stop : b[2] >= stop) { exit = stop; how = 'stop'; exitT = b[0] + M5; break; }
    last = j;
  }
  if (exit == null) {
    const k = c.ix.get(exitAt);
    if (k != null) exit = c.m5[k][1]; else if (last != null) { exit = c.m5[last][4]; how = 'time-last'; } else return null;
  }
  const n = nights(at, exitT), swap = n * swapRate(coin, side) / 365 * entry, fee = COST_RT * entry;
  const gross = side * (exit - entry) / risk, costR = fee / risk, swapR = swap / risk;
  return { coin, day, at, side, entry, stop, risk, exit, exitT, how, nights: n, gross, costR, swapR, net: gross - costR - swapR, net2: gross - 2 * (costR + swapR) };
}

// ─── statistics ───
const sdOf = (xs) => { const n = xs.length, m = xs.reduce((s, v) => s + v, 0) / n; return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1)); };
export function stats(rs) {
  const n = rs.length; if (!n) return { n: 0 };
  const m = rs.reduce((s, v) => s + v, 0) / n, sd = n > 1 ? sdOf(rs) : 0;
  return { n, mean: m, sd, t: sd > 0 ? m / (sd / Math.sqrt(n)) : 0, total: m * n, hit: rs.filter((v) => v > 0).length / n };
}
// monthly sums over every calendar month from..to (empty months = 0)
export function monthT(rows, from, to) {
  const sums = new Map();
  for (let y = +from.slice(0, 4), m = +from.slice(5, 7); `${y}-${String(m).padStart(2, '0')}` <= to.slice(0, 7); m === 12 ? (y++, m = 1) : m++) sums.set(`${y}-${String(m).padStart(2, '0')}`, 0);
  for (const x of rows) { const k = x.day.slice(0, 7); if (sums.has(k)) sums.set(k, sums.get(k) + x.net); }
  const v = [...sums.values()], s = stats(v);
  return { months: v.length, mean: s.mean, t: s.t };
}
const erf = (x) => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
export const pOne = (t) => 0.5 * (1 - erf(t / Math.SQRT2));
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = Array(ps.length); let run = 0;
  o.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, p * (ps.length - k))); adj[i] = run; });
  return adj;
}
export function quantile(xs, q) { const s = xs.slice().sort((a, b) => a - b), p = q * (s.length - 1), lo = Math.floor(p); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (p - lo); }
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let x = s; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
const shuffle = (a, r) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const inW = (day, w) => day >= w[0] && day <= w[1];

export function prepare(m5) { const h1 = toH1(m5); return { m5, ix: index(m5), h1, h1ix: index(h1) }; }

export function analyse(nas, coins) {
  const C = Object.fromEntries(Object.entries(coins).map(([k, v]) => [k, prepare(v)]));
  const moves = sessionMoves(nas), sig = signals(moves);
  const lastData = Math.min(...Object.values(C).map((c) => c.m5[c.m5.length - 1][0]));
  const ok = (day) => Object.keys(C).every((k) => trade(C[k], k, day, 1));   // both coins have an entry and an exit
  const out = { sessions: moves.length, signals: { all: sig.length, up: sig.filter((s) => s.dir > 0).length }, lastData, variants: {} };
  const sigDec = sig.filter((s) => inW(s.day, WINDOWS.dec));
  const pool = moves.filter((x) => inW(x.day, WINDOWS.dec) && ok(x.day)).map((x) => x.day);
  out.pool = pool.length;
  for (const [v, mult] of Object.entries(VARIANTS)) {
    const rows = [];
    for (const s of sig) for (const k of Object.keys(C)) { const tr = trade(C[k], k, s.day, mult * s.dir); if (tr) rows.push({ ...tr, dir: s.dir, fri: wdOf(s.day) === 5 }); }
    const part = (w, xs = rows) => xs.filter((x) => inW(x.day, w));
    const sum = (xs) => ({ ...stats(xs.map((x) => x.net)), gross: stats(xs.map((x) => x.gross)).mean, net2: stats(xs.map((x) => x.net2)).mean,
      costR: xs.length ? xs.reduce((s, x) => s + x.costR, 0) / xs.length : 0, swapR: xs.length ? xs.reduce((s, x) => s + x.swapR, 0) / xs.length : 0,
      stops: xs.length ? xs.filter((x) => x.how === 'stop' || x.how === 'gap').length / xs.length : 0 });
    const dec = part(WINDOWS.dec), decDays = [...new Set(dec.map((x) => x.day))], last = decDays.length ? decDays[decDays.length - 1] : WINDOWS.dec[0];
    const lastMonth = new Date(Math.min(lastData, END) * 1000).toISOString().slice(0, 10);
    const mt = monthT(dec, WINDOWS.dec[0], lastMonth);
    const daySide = new Map(dec.map((x) => [x.day, x.side]));
    const nLong = [...daySide.values()].filter((s) => s > 0).length, plac = [];
    for (let seed = 1; seed <= SEEDS; seed++) {
      const r = rng(seed), days = shuffle(pool.slice(), r).slice(0, daySide.size), sides = shuffle(days.map((_, k) => (k < nLong ? 1 : -1)), r);
      const rs = []; days.forEach((d, k) => { for (const c of Object.keys(C)) { const tr = trade(C[c], c, d, sides[k]); if (tr) rs.push(tr.net); } });
      plac.push(+stats(rs).mean.toFixed(4));
    }
    const p95 = quantile(plac, PCTL);
    const years = {}; for (const x of rows) (years[x.day.slice(0, 4)] ||= []).push(x.net);
    const byCoin = Object.fromEntries(Object.keys(C).map((k) => [k, { dec: sum(dec.filter((x) => x.coin === k)), h1: sum(part(WINDOWS.h1).filter((x) => x.coin === k)), h2: sum(part(WINDOWS.h2).filter((x) => x.coin === k)) }]));
    out.variants[v] = {
      dec: sum(dec), month: mt, h1: sum(part(WINDOWS.h1)), h2: sum(part(WINDOWS.h2)), rep: { n: 0, note: 'not available: no 2018-2020 crypto intraday candles reachable' },
      byCoin, decUp: sum(dec.filter((x) => x.dir > 0)), decDown: sum(dec.filter((x) => x.dir < 0)), decFri: sum(dec.filter((x) => x.fri)), decNoFri: sum(dec.filter((x) => !x.fri)),
      years: Object.fromEntries(Object.entries(years).map(([y, a]) => [y, stats(a)])),
      signalDays: daySide.size, longDays: nLong, lastSignal: last,
      placebo: { means: plac, p95, beaten: plac.filter((m) => sum(dec).mean > m).length },
      timeLast: rows.filter((x) => x.how === 'time-last').length,
    };
  }
  const names = Object.keys(out.variants), ps = names.map((v) => pOne(out.variants[v].month.t)), adj = holm(ps);
  names.forEach((v, k) => {
    const x = out.variants[v];
    const c = { positive: x.dec.mean > 0, t2: x.month.t >= 2, holm: adj[k] < 0.05, sameSign: null, placebo: x.dec.mean > x.placebo.p95 };
    const rest = c.positive && c.t2 && c.holm && c.placebo;
    x.test = { p: ps[k], holmP: adj[k], checks: c, result: rest ? 'INCONCLUSIVE' : 'FAIL' };
  });
  out.verdict = names.some((v) => out.variants[v].test.result === 'INCONCLUSIVE') ? 'INCONCLUSIVE' : 'FAIL';
  return out;
}

// ─── report ───
const f = (v, d = 3) => (v == null || !Number.isFinite(v) ? 'n/a' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d));
const pct = (v) => (100 * v).toFixed(1) + ' %';
const VN = { follow: 'Follow', fade: 'Fade' };
export function report(res) {
  const V = res.variants, L = [];
  const NAME = { positive: 'net R not above 0', t2: 'monthly t under 2', holm: 'Holm p over 0.05', placebo: 'placebo 95th percentile not beaten' };
  const fails = (v) => Object.entries(V[v].test.checks).filter(([k, ok]) => k !== 'sameSign' && !ok).map(([k]) => NAME[k]);
  L.push('# Result: big NAS100 cash sessions into BTC / ETH overnight (13 Nov 2026)', '');
  const nPass = Object.values(V).filter((x) => x.test.result !== 'FAIL').length;
  L.push(`**Verdict: ${res.verdict}, ${nPass} of 2 variants clear the checks that could be run.** ` + Object.keys(V).map((v) =>
    `${VN[v]} ${f(V[v].dec.mean)}R a trade net on ${WINDOWS.dec[0].slice(0, 7)} to ${V[v].lastSignal.slice(0, 7)} (BTC + ETH pooled, n ${V[v].dec.n}, monthly t ${f(V[v].month.t, 2)}, ` +
    `${V[v].test.result === 'FAIL' ? 'fails: ' + fails(v).join(', ') : 'clears every check run; replication pending'})`).join('; ') +
    '. The 2018-2020 replication could not be run (no crypto intraday candles before 2022 reachable), so no variant could pass in this run. Not an edge; no proposal, nothing live changed.', '');
  L.push(`Data: OANDA mid NAS100 M15 (session = open of the 09:30 to close of the 15:45 New York candle) on ${res.sessions} full NYSE days from Nov 2021; ` +
    `${res.signals.all} signal days with |move| > 1.5 × the median |move| of the previous 20 days (${res.signals.up} up). Binance BTCUSDT / ETHUSDT 5-minute candles from council-data ` +
    `(Jan 2022 to ${new Date(res.lastData * 1000).toISOString().slice(0, 10)}). Each trade: the coin's 16:00 New York open, stop 1.5 × ATR(24 H1), out at the next trading day's 09:30 New York open. ` +
    'Costs: CFD round trip 0.04 % + one spread of slippage 0.02 % of price, swap per 17:00 New York rollover (Friday x3) at the broker\'s rates: longs 15 % a year, shorts 7.5 % (BTC) / 10 % (ETH).', '');
  L.push('| Variant | window | n | net R a trade | t (trades) | gross R | cost R | swap R | x2 costs | hit | stopped |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const v of Object.keys(V)) for (const [w, lab] of [['dec', 'decisive, pooled'], ['h1', '2022-23 (half)'], ['h2', '2024-26 (half)']]) {
    const x = V[v][w]; L.push(`| ${VN[v]} | ${lab} | ${x.n} | ${f(x.mean)} | ${f(x.t, 2)} | ${f(x.gross)} | ${f(x.costR)} | ${f(x.swapR)} | ${f(x.net2)} | ${pct(x.hit)} | ${pct(x.stops)} |`);
  }
  for (const v of Object.keys(V)) for (const c of Object.keys(V[v].byCoin)) for (const [w, lab] of [['dec', 'decisive'], ['h1', '2022-23'], ['h2', '2024-26']]) {
    const x = V[v].byCoin[c][w]; L.push(`| ${VN[v]} ${c.toUpperCase()} | ${lab} | ${x.n} | ${f(x.mean)} | ${f(x.t, 2)} | ${f(x.gross)} | ${f(x.costR)} | ${f(x.swapR)} | ${f(x.net2)} | ${pct(x.hit)} | ${pct(x.stops)} |`);
  }
  L.push('| Both | 2018-2020 (replication) | not run | | | | | | | | |');
  L.push('', '## The bar, check by check (decisive window, pooled)', '',
    '| Variant | net > 0 | monthly t ≥ 2 | Holm p | same sign 2018-20 | above placebo 95th pct | result |', '|---|---|---|---|---|---|---|');
  for (const v of Object.keys(V)) { const t = V[v].test, c = t.checks, y = (b) => (b ? 'yes' : 'no');
    L.push(`| ${VN[v]} | ${y(c.positive)} | ${y(c.t2)} (${f(V[v].month.t, 2)}, ${V[v].month.months} months) | ${t.holmP.toFixed(3)} | not run | ${y(c.placebo)} (${f(V[v].dec.mean)} vs ${f(V[v].placebo.p95)}; beats ${V[v].placebo.beaten} of 40) | ${t.result} |`); }
  L.push('', '## Descriptive (not part of the bar)', '');
  for (const v of Object.keys(V)) {
    const x = V[v];
    L.push(`- **${VN[v]}**: ${x.signalDays} signal days traded (${x.longDays} long). After up sessions ${f(x.decUp.mean)}R (n ${x.decUp.n}, t ${f(x.decUp.t, 2)}), after down sessions ${f(x.decDown.mean)}R (n ${x.decDown.n}, t ${f(x.decDown.t, 2)}); ` +
      `Friday signals ${f(x.decFri.mean)}R (n ${x.decFri.n}), the rest ${f(x.decNoFri.mean)}R (n ${x.decNoFri.n}). Placebo means ${f(Math.min(...x.placebo.means))} to ${f(Math.max(...x.placebo.means))}R (pool ${res.pool} days). ` +
      `By year (net R a trade, n): ${Object.entries(x.years).map(([y, s]) => `${y} ${f(s.mean, 2)} (${s.n})`).join(', ')}. Exits on the last close before 09:30 (candle missing): ${x.timeLast}.`);
  }
  L.push('', 'Follow and Fade take the same days with the side reversed. Their gross R are not exact mirrors (each has its own stop, on the other side of the entry, and a stopped trade is −1R either way); costs and swap are paid by both.',
    '', 'To repeat: `node --use-env-proxy research/edge/nas-crypto-spill/run.mjs fetch <dir>` (candles outside git), then `node research/edge/nas-crypto-spill/run.mjs full <dir>`. ' +
    'For the replication, put 2017-11 to 2020-12 BTCUSDT / ETHUSDT 5-minute candles and NAS100 M15 in a directory and rerun on the 2018-2020 window. Tests: `tests/nas-crypto-spill.test.mjs`.', '');
  return L.join('\n');
}

// ─── fetch / main ───
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function range(sym, tf, sec, dir) {
  const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', part = path.join(dir, `${sym}-${tf}.part.json`);
  const m = new Map(fs.existsSync(part) ? JSON.parse(fs.readFileSync(part, 'utf8')).map((x) => [x[0], x]) : []);
  let a = m.size ? Math.max(...m.keys()) + sec : FROM;
  for (; a < END;) {
    const b = Math.min(END, a + 4999 * sec); let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) {
      try { const r = await fetch(`${BASE}bars?sym=${sym}&tf=${tf}&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
        if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; } catch (e) { err = String(e.message || e); }
      if (!j) await sleep(2000 * (k + 1));
    }
    if (!j) throw new Error(`${sym} ${tf} ${new Date(a * 1000).toISOString()}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; fs.writeFileSync(part, JSON.stringify([...m.values()])); await sleep(150);
  }
  return [...m.values()].sort((p, q) => p[0] - q[0]);
}
const load = (dir, name) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, name))));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (!dir) throw new Error('usage: node run.mjs fetch|full <dir>');
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    for (const c of ['BTC', 'ETH']) {
      const fp = path.join(dir, `${c.toLowerCase()}-5m.json.gz`); if (fs.existsSync(fp)) continue;
      fs.writeFileSync(fp, execFileSync('git', ['show', `origin/council-data:research/candles/crypto5m/${c}USDT_5m.json.gz`], { cwd: HERE, maxBuffer: 1 << 30 }));
    }
    const fp = path.join(dir, 'nas100-15m.json.gz');
    if (!fs.existsSync(fp)) { const bars = await range('nas100', '15m', 900, dir); fs.writeFileSync(fp, zlib.gzipSync(JSON.stringify(bars))); console.log('nas100 15m', bars.length); }
  } else if (cmd === 'full') {
    const res = analyse(load(dir, 'nas100-15m.json.gz'), { btc: load(dir, 'btc-5m.json.gz'), eth: load(dir, 'eth-5m.json.gz') });
    const out = { built: '2026-11-13', study: 'nas-crypto-spill', verdict: res.verdict,
      data: 'OANDA mid NAS100 M15 from Nov 2021; Binance BTCUSDT / ETHUSDT 5m from council-data, Jan 2022 to Oct 2026',
      cost: { cfdRT: CFD_CRYPTO, slippage: SPREAD, swap: SWAP, swapRule: 'per 17:00 New York rollover, Mon-Fri, Friday x3, rate / 365 of entry' }, windows: WINDOWS, ...res };
    const round = (o) => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'number' && !Number.isInteger(v) ? +v.toFixed(6) : v)));
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(round(out), null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(round(out)));
    console.log(report(round(out)));
  }
}
