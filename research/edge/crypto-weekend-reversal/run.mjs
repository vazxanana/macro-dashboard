// Edge research · crypto-weekend-reversal (14 Nov 2026): do big BTC / ETH weekend moves partly reverse once the week starts?
// Weekend move = P(Sunday 22:00) - P(Friday 21:00) UTC; when |move| > 1 x ATR(20) of daily candles (20 complete UTC days
// through Thursday), trade AGAINST it: T1 at Monday 13:30 UTC, T2 at Sunday 22:00 UTC; stop and target 1 ATR, out at
// Wednesday 21:00 UTC; net of CFD_CRYPTO and the broker's crypto financing. Everything is fixed in PREREGISTRATION.md
// (committed alone before this file computed anything). Paper research only: nothing here trades or changes a live rule.
//   node run.mjs fetch <dir>   -> <dir>/{BTCUSDT,ETHUSDT}_{5m,1d}.json.gz from origin/council-data (git show, no network)
//   node run.mjs run <dir>     -> result.json + RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CFD_CRYPTO } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86400, M5 = 300;
export const P = {
  K_SIG: 1.0, K_STOP: 1.0, K_TGT: 1.0, ATR_N: 20, DAY_MIN: 270, COVER: 0.95, COST: CFD_CRYPTO,
  FIN: { btc: { long: 0.15, short: 0.075 }, eth: { long: 0.15, short: 0.10 } },
  WIN: ['2022-01-01', '2026-10-31'], H1: ['2022-01-01', '2023-12-31'], H2: ['2024-01-01', '2026-10-31'],
  DESC: ['2017-08-17', '2021-12-31'], MIN_N: 30, MIN_N_POOL: 60, T_MIN: 2.0, ALPHA: 0.05, SEEDS: 40, PCT: 95,
};
export const MARKETS = { btc: 'BTCUSDT', eth: 'ETHUSDT' };
// Offsets from the Friday 00:00 UTC of the weekend.
export const AT = { fri21: 21 * 3600, sun22: 2 * DAY + 22 * 3600, mon1330: 3 * DAY + 13.5 * 3600, wed21: 5 * DAY + 21 * 3600 };
export const TESTS = {
  T1: { name: 'enter Monday 13:30 UTC', entry: 'mon1330' },
  T2: { name: 'enter Sunday 22:00 UTC', entry: 'sun22' },
};
const ts = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 1000;
const r2 = (x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : null);
const r3 = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null);

// ─── calendar ───
// New York 17:00 in UTC on the UTC date of `dayStart`: 21:00 while US daylight time holds, else 22:00
// (daylight time: from the second Sunday of March to the first Sunday of November).
export function usDst(dayStart) {
  const d = new Date(dayStart * 1000), y = d.getUTCFullYear();
  const nthSun = (m, n) => { const f = new Date(Date.UTC(y, m, 1)).getUTCDay(); return Date.UTC(y, m, 1 + ((7 - f) % 7) + 7 * (n - 1)) / 1000; };
  return dayStart >= nthSun(2, 2) && dayStart < nthSun(10, 1);
}
export const ny17 = (dayStart) => dayStart + (usDst(dayStart) ? 21 : 22) * 3600;
// financing nights: each 17:00 New York instant in (entry, exit]; a Friday counts three
export function nights(entry, exit) {
  let n = 0;
  for (let d = Math.floor(entry / DAY) * DAY - DAY; d <= exit; d += DAY) {
    const x = ny17(d); if (x > entry && x <= exit) n += new Date(d * 1000).getUTCDay() === 5 ? 3 : 1;
  }
  return n;
}

// ─── candles ───
export function loadRows(file) { return JSON.parse(zlib.gunzipSync(fs.readFileSync(file))); }
export function series(rows) {             // [[t,o,h,l,c]] -> columns + time index
  const n = rows.length, t = new Float64Array(n), o = new Float64Array(n), h = new Float64Array(n), l = new Float64Array(n), c = new Float64Array(n);
  rows.forEach((r, i) => { t[i] = r[0]; o[i] = r[1]; h[i] = r[2]; l[i] = r[3]; c[i] = r[4]; });
  const at = new Map(); for (let i = 0; i < n; i++) at.set(t[i], i);
  return { n, t, o, h, l, c, at };
}
export function firstAtOrAfter(S, time) { let lo = 0, hi = S.n; while (lo < hi) { const m = (lo + hi) >> 1; if (S.t[m] < time) lo = m + 1; else hi = m; } return lo; }
// UTC days from 5-minute candles: { time, open, high, low, close, count }
export function days(S) {
  const out = []; let g = null;
  for (let i = 0; i < S.n; i++) { const k = Math.floor(S.t[i] / DAY) * DAY;
    if (!g || g.time !== k) { g = { time: k, open: S.o[i], high: S.h[i], low: S.l[i], close: S.c[i], count: 1 }; out.push(g); }
    else { if (S.h[i] > g.high) g.high = S.h[i]; if (S.l[i] < g.low) g.low = S.l[i]; g.close = S.c[i]; g.count++; } }
  return out;
}
// ATR(20) for the weekend of Friday `fri` (00:00 UTC): 20 complete days ending at or before `fri` (the last starts Thursday),
// plus the day before them for the first true range; null when any of the 21 is missing or incomplete.
export function atrFor(dayMap, fri, minCount = P.DAY_MIN, N = P.ATR_N) {
  let sum = 0;
  for (let k = 1; k <= N; k++) {
    const d = dayMap.get(fri - k * DAY), p = dayMap.get(fri - (k + 1) * DAY);
    if (!d || !p || d.time + DAY > fri || (minCount && (d.count < minCount || p.count < minCount))) return null;
    sum += Math.max(d.high - d.low, Math.abs(d.high - p.close), Math.abs(d.low - p.close));
  }
  return sum / N;
}

// ─── one trade ───
// side +1 long / -1 short, entry at the open of the candle at `t0`; stop / target `k x atr`; out at `tEnd`.
export function simulate(S, t0, side, atr, tEnd, opt = {}) {
  const i0 = S.at.get(t0); if (i0 == null || !(atr > 0)) return null;
  const entry = S.o[i0], stop = entry - side * (opt.kStop ?? P.K_STOP) * atr, target = entry + side * (opt.kTgt ?? P.K_TGT) * atr;
  const iEnd = firstAtOrAfter(S, tEnd); if (iEnd >= S.n) return null;
  const expect = Math.round((tEnd - t0) / M5); if (expect <= 0 || (iEnd - i0) < (opt.cover ?? P.COVER) * expect) return null;
  let exit = null, how = 'time', at = S.t[iEnd];
  for (let i = i0; i < iEnd; i++) {
    const o = S.o[i], h = S.h[i], l = S.l[i];
    if (side > 0 ? o <= stop : o >= stop) { exit = o; how = 'stop'; at = S.t[i]; break; }
    if (side > 0 ? l <= stop : h >= stop) { exit = stop; how = 'stop'; at = S.t[i]; break; }
    if (side > 0 ? o >= target : o <= target) { exit = o; how = 'target'; at = S.t[i]; break; }
    if (side > 0 ? h >= target : l <= target) { exit = target; how = 'target'; at = S.t[i]; break; }
  }
  if (exit == null) exit = S.o[iEnd];
  return { t: t0, side, entry, stop, target, atr, exit, how, closed: at, R: side * (exit - entry) / atr };
}
// cost and financing in R (mult = 1 or 2)
export function costs(tr, mkt, mult = 1) {
  const fin = P.FIN[mkt][tr.side > 0 ? 'long' : 'short'], n = nights(tr.t, tr.closed);
  const cost = P.COST * tr.entry / tr.atr, finR = fin / 365 * tr.entry * n / tr.atr;
  return { cost: cost * mult, fin: finR * mult, nights: n, net: tr.R - (cost + finR) * mult };
}

// ─── the weekends of one market ───
// every Friday in [from, to]; for each: prices, ATR, move, signal side, and the long / short trade of each test (null when the
// data do not allow it). The signal side reads only P(Fri 21:00), P(Sun 22:00) and the ATR.
export function weekends(S, from, to) {
  const dmap = new Map(days(S).map((d) => [d.time, d])), out = [];
  let f = Math.floor(from / DAY) * DAY; while (new Date(f * 1000).getUTCDay() !== 5) f += DAY;
  for (; f <= to; f += 7 * DAY) {
    const atr = atrFor(dmap, f), iF = S.at.get(f + AT.fri21), iS = S.at.get(f + AT.sun22);
    const w = { fri: f, atr, ok: !!(atr && iF != null && iS != null) };
    if (w.ok) { w.pFri = S.o[iF]; w.pSun = S.o[iS]; w.move = w.pSun - w.pFri; w.k = w.move / atr;
      w.side = Math.abs(w.move) > P.K_SIG * atr ? -Math.sign(w.move) : 0;
      w.trades = {};
      for (const [tk, T] of Object.entries(TESTS)) w.trades[tk] = { '1': simulate(S, f + AT[T.entry], 1, atr, f + AT.wed21), '-1': simulate(S, f + AT[T.entry], -1, atr, f + AT.wed21) }; }
    out.push(w);
  }
  return out;
}

// ─── statistics ───
export function stat(xs) {
  const n = xs.length; if (!n) return { n: 0, mean: null, sd: null, t: null, sum: 0 };
  const sum = xs.reduce((a, b) => a + b, 0), mean = sum / n, sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : null;
  return { n, mean, sd, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : null, sum };
}
export const monthKey = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
// t on calendar-month sums of net R by exit month, every month of [from, to] counted (no trade = 0)
export function monthT(trades, from, to) {
  const a = monthKey(from), b = monthKey(to), m = new Array(b - a + 1).fill(0);
  for (const x of trades) { const k = monthKey(x.closed) - a; if (k >= 0 && k < m.length) m[k] += x.net; }
  return { ...stat(m), months: m.length };
}
export const normP = (t) => { if (!Number.isFinite(t)) return 1; const z = t, b = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * b * (0.3193815 + b * (-0.3565638 + b * (1.781478 + b * (-1.821256 + b * 1.330274)))); return z > 0 ? p : 1 - p; };   // one-sided P(Z > t)
export function holm(ps) {
  const o = ps.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p), out = new Array(ps.length); let run = 0;
  o.forEach((x, k) => { run = Math.max(run, Math.min(1, x.p * (ps.length - k))); out[x.i] = run; });
  return out;
}
export function maxDD(xs) { let c = 0, pk = 0, dd = 0; for (const x of xs) { c += x; pk = Math.max(pk, c); dd = Math.min(dd, c - pk); } return dd; }
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function shuffle(arr, rnd) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function pct(xs, q) { const a = xs.slice().sort((x, y) => x - y); if (!a.length) return null; const p = (a.length - 1) * q / 100, lo = Math.floor(p), hi = Math.ceil(p); return a[lo] + (a[hi] - a[lo]) * (p - lo); }

// the real trades of one market and test: signalled weekends in the decisive window whose trade the data allow
export function realTrades(W, mkt, tk, mult = 1) {
  const out = [];
  for (const w of W) { if (!w.ok || !w.side) continue; const tr = w.trades[tk][String(w.side)]; if (!tr) continue;
    out.push({ ...tr, ...costs(tr, mkt, mult), mkt, fri: w.fri, k: w.k }); }
  return out;
}
// placebo: same count and shuffled sides on random eligible weekends (without replacement), one mean net R per seed
export function placebo(W, mkt, tk, real, seeds = P.SEEDS) {
  const elig = W.filter((w) => w.ok && w.trades[tk]['1'] && w.trades[tk]['-1']), sides = real.map((x) => x.side), out = [];
  for (let s = 1; s <= seeds; s++) {
    const rnd = mulberry32(s), pick = shuffle(elig, rnd).slice(0, sides.length), sd = shuffle(sides, rnd);
    out.push(pick.map((w, i) => { const tr = w.trades[tk][String(sd[i])]; return { ...tr, ...costs(tr, mkt) }; }));
  }
  return out;
}

export function summary(trades, from, to) {
  const net = trades.map((x) => x.net), s = stat(net), g = stat(trades.map((x) => x.R)), mo = monthT(trades, from, to);
  const wins = net.filter((x) => x > 0), loss = net.filter((x) => x < 0);
  const pf = loss.length ? wins.reduce((a, b) => a + b, 0) / -loss.reduce((a, b) => a + b, 0) : null;
  const exits = {}; for (const x of trades) exits[x.how] = (exits[x.how] || 0) + 1;
  return { n: s.n, win: s.n ? r3(wins.length / s.n) : null, grossR: r3(g.mean), netR: r3(s.mean), tTrade: r2(s.t), tMonth: r2(mo.t), months: mo.months,
    total: r2(s.sum), pf: r2(pf), maxDD: r2(maxDD(net)), exits,
    cost: r3(stat(trades.map((x) => x.cost)).mean), fin: r3(stat(trades.map((x) => x.fin)).mean), nights: r2(stat(trades.map((x) => x.nights)).mean) };
}
const inWin = (x, [a, b]) => x.t >= ts(a) && x.t < ts(b) + DAY;

export function evaluate(byMkt) {
  const [wf, wt] = [ts(P.WIN[0]), ts(P.WIN[1]) + DAY - 1], tests = {}, ps = [];
  const one = (key, trades, trades2, placeboMeans, minN) => {
    const all = summary(trades, wf, wt), h1 = summary(trades.filter((x) => inWin(x, P.H1)), ts(P.H1[0]), ts(P.H1[1]) + DAY - 1),
      h2 = summary(trades.filter((x) => inWin(x, P.H2)), ts(P.H2[0]), ts(P.H2[1]) + DAY - 1), x2 = summary(trades2, wf, wt);
    const pl = { p5: r3(pct(placeboMeans, 5)), p50: r3(pct(placeboMeans, 50)), p95: r3(pct(placeboMeans, P.PCT)),
      above: placeboMeans.filter((m) => all.netR != null && m < all.netR).length, of: placeboMeans.length };
    const sideSplit = {}; for (const s of [1, -1]) sideSplit[s > 0 ? 'long' : 'short'] = summary(trades.filter((x) => x.side === s), wf, wt);
    const years = {}; for (const x of trades) { const y = new Date(x.t * 1000).getUTCFullYear(); (years[y] ||= []).push(x.net); }
    const byYear = Object.fromEntries(Object.entries(years).map(([y, v]) => [y, { n: v.length, netR: r3(stat(v).mean), total: r2(stat(v).sum) }]));
    tests[key] = { all, h1, h2, x2, placebo: pl, side: sideSplit, byYear, minN };
    ps.push(normP(all.tMonth));
  };
  for (const tk of Object.keys(TESTS)) for (const m of Object.keys(MARKETS)) {
    const d = byMkt[m];
    one(`${tk}-${m.toUpperCase()}`, d.real[tk], d.real2[tk], d.placebo[tk].map((tr) => stat(tr.map((x) => x.net)).mean), P.MIN_N);
  }
  const pool = [...byMkt.btc.real.T1, ...byMkt.eth.real.T1].sort((a, b) => a.t - b.t), pool2 = [...byMkt.btc.real2.T1, ...byMkt.eth.real2.T1];
  const poolPl = byMkt.btc.placebo.T1.map((tr, i) => stat([...tr, ...byMkt.eth.placebo.T1[i]].map((x) => x.net)).mean);
  one('POOL', pool, pool2, poolPl, P.MIN_N_POOL);
  const keys = Object.keys(tests), adj = holm(ps);
  keys.forEach((k, i) => {
    const T = tests[k], a = T.all; T.p = r3(ps[i]); T.pHolm = r3(adj[i]);
    T.cond = { n: a.n >= T.minN, tMonth: a.netR > 0 && a.tMonth >= P.T_MIN, holm: adj[i] < P.ALPHA, halves: T.h1.netR > 0 && T.h2.netR > 0,
      x2: T.x2.netR > 0, placebo: a.netR != null && T.placebo.p95 != null && a.netR > T.placebo.p95 };
    T.pass = Object.values(T.cond).every(Boolean);
  });
  const verdict = keys.some((k) => tests[k].pass) ? 'PASS' : keys.some((k) => tests[k].cond.tMonth) ? 'INCONCLUSIVE' : 'FAIL';
  return { tests, verdict };
}

// descriptive daily check (2017-21): Sunday close -> Wednesday close against a weekend move > 1 ATR, no stop, net in ATR units
export function describeDaily(rows, mkt, from, to) {
  const dm = new Map(rows.map((r) => [r[0], { time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], count: 288 }])), out = [];
  let f = Math.floor(from / DAY) * DAY; while (new Date(f * 1000).getUTCDay() !== 5) f += DAY;
  for (; f <= to; f += 7 * DAY) {
    const atr = atrFor(dm, f, 0), fr = dm.get(f), su = dm.get(f + 2 * DAY), we = dm.get(f + 5 * DAY);
    if (!atr || !fr || !su || !we) continue;
    const move = su.close - fr.close; if (!(Math.abs(move) > P.K_SIG * atr)) continue;
    const side = -Math.sign(move), t0 = f + 3 * DAY, t1 = f + 6 * DAY, entry = su.close;
    const tr = { t: t0, closed: t1, side, entry, atr, R: side * (we.close - entry) / atr };
    out.push({ ...tr, ...costs(tr, mkt) });
  }
  const years = {}; for (const x of out) { const y = new Date(x.t * 1000).getUTCFullYear(); (years[y] ||= []).push(x.net); }
  const s = stat(out.map((x) => x.net));
  return { n: s.n, netR: r3(s.mean), tTrade: r2(s.t), grossR: r3(stat(out.map((x) => x.R)).mean),
    byYear: Object.fromEntries(Object.entries(years).map(([y, v]) => [y, { n: v.length, netR: r3(stat(v).mean) }])) };
}

export function study(data) {        // data: { btc: { m5: rows, d1: rows }, eth: … }
  const byMkt = {}, [wf, wt] = [ts(P.WIN[0]), ts(P.WIN[1])], funnel = {};
  for (const m of Object.keys(MARKETS)) {
    const S = series(data[m].m5), W = weekends(S, wf, wt);
    const real = {}, real2 = {}, pl = {};
    for (const tk of Object.keys(TESTS)) { real[tk] = realTrades(W, m, tk); real2[tk] = realTrades(W, m, tk, 2); pl[tk] = placebo(W, m, tk, real[tk]); }
    funnel[m] = { weekends: W.length, priced: W.filter((w) => w.ok).length, signals: W.filter((w) => w.ok && w.side).length,
      longs: W.filter((w) => w.ok && w.side > 0).length, shorts: W.filter((w) => w.ok && w.side < 0).length,
      T1: real.T1.length, T2: real.T2.length, firstSignal: (W.find((w) => w.ok && w.side) || {}).fri ?? null,
      medianK: r2(pct(W.filter((w) => w.ok).map((w) => Math.abs(w.k)), 50)) };
    byMkt[m] = { real, real2, placebo: pl };
  }
  const ev = evaluate(byMkt), desc = {};
  for (const m of Object.keys(MARKETS)) if (data[m].d1) desc[m] = describeDaily(data[m].d1, m, ts(P.DESC[0]), ts(P.DESC[1]));
  const trades = {}; for (const m of Object.keys(MARKETS)) for (const tk of Object.keys(TESTS))
    trades[`${tk}-${m}`] = byMkt[m].real[tk].map((x) => [new Date(x.t * 1000).toISOString().slice(0, 16), x.side, r3(x.k), x.how, r3(x.R), r3(x.net)]);
  return { verdict: ev.verdict, tests: ev.tests, funnel, descriptive: desc, trades };
}

// ─── report ───
const sg = (x) => (x == null ? 'n/a' : (x > 0 ? '+' : '') + x);
export function headline(res) {
  const t = res.tests, row = (k) => `${k} ${sg(t[k].all.netR)}R a trade (n ${t[k].all.n}, month t ${t[k].all.tMonth})`;
  return `${Object.values(t).filter((x) => x.pass).length} of 5 tests pass; ${['T1-BTC', 'T1-ETH', 'T2-BTC', 'T2-ETH', 'POOL'].map(row).join('; ')}, 2022-26 after costs and financing.`;
}
export function report(res) {
  const t = res.tests, L = [];
  L.push('# Crypto weekend reversal: result', '', `Run on ${res.built}. Pre-registration: \`PREREGISTRATION.md\` (committed alone before this ran). Paper research only.`, '');
  L.push(`**Verdict: ${res.verdict}.** ${headline(res)}`, '');
  L.push('## Tests (decisive window, entries 2022-01 to 2026-10, net of CFD_CRYPTO and financing)', '',
    '| Test | n | win % | gross R | net R a trade | month-sum t | trade t | total R | max DD | net 2022-23 | net 2024-26 | net at 2x costs | placebo p5 / p50 / p95 | Holm p | pass |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, T] of Object.entries(t)) { const a = T.all;
    L.push(`| ${k} | ${a.n} | ${a.win == null ? 'n/a' : Math.round(a.win * 100)} | ${sg(a.grossR)} | ${sg(a.netR)} | ${a.tMonth} | ${a.tTrade} | ${sg(a.total)} | ${a.maxDD} | ${sg(T.h1.netR)} (n ${T.h1.n}) | ${sg(T.h2.netR)} (n ${T.h2.n}) | ${sg(T.x2.netR)} | ${sg(T.placebo.p5)} / ${sg(T.placebo.p50)} / ${sg(T.placebo.p95)} (real above ${T.placebo.above} of ${T.placebo.of}) | ${T.pHolm} | ${T.pass ? 'yes' : 'no'} |`); }
  L.push('', 'Conditions met per test (n, net > 0 with month t >= 2, Holm, both halves, 2x costs, above placebo p95):', '');
  for (const [k, T] of Object.entries(t)) L.push(`- ${k}: ${Object.entries(T.cond).map(([c, v]) => `${c} ${v ? 'yes' : 'no'}`).join(', ')}`);
  L.push('', '## Detail', '');
  for (const [k, T] of Object.entries(t)) {
    const a = T.all;
    L.push(`- **${k}**: exits ${Object.entries(a.exits).map(([h, n]) => `${h} ${n}`).join(', ')}; mean cost ${a.cost}R, financing ${a.fin}R (${a.nights} nights); long ${sg(T.side.long.netR)}R (n ${T.side.long.n}), short ${sg(T.side.short.netR)}R (n ${T.side.short.n}); by year ${Object.entries(T.byYear).map(([y, v]) => `${y} ${sg(v.netR)} (n ${v.n})`).join(', ')}.`);
  }
  L.push('', '## Funnel', '', '| Market | weekends | priced | signals (long / short) | T1 trades | T2 trades | median abs(move) / ATR |', '|---|---|---|---|---|---|---|');
  for (const [m, f] of Object.entries(res.funnel)) L.push(`| ${m.toUpperCase()} | ${f.weekends} | ${f.priced} | ${f.signals} (${f.longs} / ${f.shorts}) | ${f.T1} | ${f.T2} | ${f.medianK} |`);
  L.push('', '## Descriptive only: 2017-08 to 2021-12 on daily candles (Sunday close to Wednesday close, no stop)', '');
  for (const [m, d] of Object.entries(res.descriptive)) L.push(`- ${m.toUpperCase()}: n ${d.n}, ${sg(d.netR)}R a trade net (gross ${sg(d.grossR)}R), trade t ${d.tTrade}; by year ${Object.entries(d.byYear).map(([y, v]) => `${y} ${sg(v.netR)} (n ${v.n})`).join(', ')}. Not a test.`);
  L.push('', '## Reading', '', ...res.reading, '');
  L.push('## What was not done, and why', '', ...res.notDone, '');
  L.push('## To repeat', '', '```sh', 'node research/edge/crypto-weekend-reversal/run.mjs fetch <dir>   # git show from origin/council-data, no network', 'node research/edge/crypto-weekend-reversal/run.mjs run <dir>', '```', '');
  return L.join('\n');
}

// Written after the run, from the figures above (wording only; no number is typed here).
export function reading(res) {
  const t = res.tests, out = [];
  const pos = Object.entries(t).filter(([, T]) => T.all.netR > 0).map(([k]) => k);
  out.push(`- Tests with a positive net R a trade: ${pos.length ? pos.join(', ') : 'none'}. Largest month-sum t: ${Math.max(...Object.values(t).map((T) => T.all.tMonth ?? -99))}.`);
  out.push(`- POOL against its placebo: ${sg(t.POOL.all.netR)}R against a placebo middle of ${sg(t.POOL.placebo.p50)}R (p95 ${sg(t.POOL.placebo.p95)}R); the real figure is above ${t.POOL.placebo.above} of ${t.POOL.placebo.of} placebo runs.`);
  const f = res.funnel;
  out.push(`- The signal is rare: a weekend move over one daily ATR came on ${f.btc.signals} of ${f.btc.priced} priced BTC weekends and ${f.eth.signals} of ${f.eth.priced} ETH weekends (median weekend move ${f.btc.medianK} / ${f.eth.medianK} ATR), so no single-market test reaches the pre-registered 30 trades and the pool has ${t.POOL.all.n} against 60.`);
  out.push(`- The halves disagree (POOL ${sg(t.POOL.h1.netR)}R in 2022-23, ${sg(t.POOL.h2.netR)}R in 2024-26), and the daily-candle description of 2017-21 goes the other way to the hypothesis (BTC ${sg(res.descriptive.btc?.netR)}R, ETH ${sg(res.descriptive.eth?.netR)}R a trade, Sunday to Wednesday close, no stop): there, big weekend moves tended to continue, not reverse. Descriptive only.`);
  out.push('- 1R is one daily ATR, so the round trip and financing are small in R (see "mean cost" and "financing" above); the result is the price behaviour, not the costs.');
  out.push(`- ${res.verdict === 'PASS' ? 'A pass is a hypothesis for a forward paper stream at most; the owner decides (absolute rule 3).' : 'Not an edge. Do not trade it, do not add it to the council, and do not re-test it with other thresholds, hours or exits on these candles.'}`);
  return out;
}
export const NOT_DONE = [
  '- The brief asked for a decisive window from January 2021 and a 2017-2020 replication. No hourly or finer BTC / ETH candles before 2022 exist in the repository or council-data, and every exchange API was refused by the sandbox network on 14 Nov 2026; the decisive window is 2022-01 to 2026-10 and the 2017-21 years are a daily-candle description without stops (above), not a replication.',
  '- Binance spot prices stand in for the broker\'s CFD prices; the broker\'s past financing rates are unknown (today\'s rates for every year).',
];

// ─── CLI ───
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (!dir) { console.error('usage: node run.mjs fetch|run <dir>'); process.exit(2); }
  const files = Object.values(MARKETS).flatMap((s) => [`research/candles/crypto5m/${s}_5m.json.gz`, `research/candles/crypto1d/${s}_1d.json.gz`]);
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    for (const f of files) { const buf = execFileSync('git', ['show', `origin/council-data:${f}`], { maxBuffer: 1 << 28 }); fs.writeFileSync(path.join(dir, path.basename(f)), buf); console.log(f, buf.length); }
  } else if (cmd === 'run') {
    const data = {}; for (const [m, s] of Object.entries(MARKETS)) data[m] = { m5: loadRows(path.join(dir, `${s}_5m.json.gz`)), d1: loadRows(path.join(dir, `${s}_1d.json.gz`)) };
    const res = { study: 'crypto-weekend-reversal', built: '2026-11-14', ...study(data) };
    res.headline = headline(res); res.reading = reading(res); res.notDone = NOT_DONE;
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(res));
    console.log(res.headline);
  }
}
