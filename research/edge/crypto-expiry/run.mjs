// Edge research · crypto-expiry (14 Nov 2026): BTC / ETH around the monthly crypto options / futures expiry (last Friday of
// the month, 08:00 UTC). Primary: Friday 08:00 -> Monday 08:00 UTC after expiry, WITH the 7 days before it, stop 1.5 x ATR(20),
// no target; net of CFD_CRYPTO and the broker's crypto financing. Reported only: Thursday 08:00 -> Friday 08:00 AGAINST its
// 7 days. Everything is fixed in PREREGISTRATION.md (committed alone before this file computed anything). Candle handling,
// financing clock and statistics follow the sibling study crypto-weekend-reversal (branch of that name), copied here.
// Paper research only: nothing here trades or changes a live rule.
//   node run.mjs fetch <dir>   -> <dir>/{BTCUSDT,ETHUSDT}_5m.json.gz from origin/council-data (git show, no network)
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
  K_STOP: 1.5, ATR_N: 20, DAY_MIN: 270, COVER: 0.95, COST: CFD_CRYPTO,
  FIN: { btc: { long: 0.15, short: 0.075 }, eth: { long: 0.15, short: 0.10 } },
  WIN: ['2022-01-01', '2026-10-31'], IS: ['2022-01-01', '2024-05-31'], OOS: ['2024-06-01', '2026-10-31'],
  T_MIN: 2.0, ALPHA: 0.05, SEEDS: 40, BEAT: 38,
};
export const MARKETS = { btc: 'BTCUSDT', eth: 'ETHUSDT' };
// Windows as offsets from the Friday 00:00 UTC of the week: entry, exit, the 7-day look-back, and the side rule (+1 with, -1 against).
export const WINDOWS = {
  post: { name: 'after expiry: Fri 08:00 -> Mon 08:00, with the 7 days before', entry: 8 * 3600, exit: 3 * DAY + 8 * 3600, dir: 1, primary: true },
  into: { name: 'into expiry: Thu 08:00 -> Fri 08:00, against the 7 days before', entry: -DAY + 8 * 3600, exit: 8 * 3600, dir: -1, primary: false },
};
const ts = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 1000;
const iso = (t) => new Date(t * 1000).toISOString();
const r2 = (x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : null);
const r3 = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null);

// ─── calendar ───
// The monthly expiry: the last Friday of the calendar month (UTC), as 00:00 UTC of that day.
export function lastFriday(y, m) {   // m 0-11
  let d = Date.UTC(y, m + 1, 0) / 1000;
  while (new Date(d * 1000).getUTCDay() !== 5) d -= DAY;
  return d;
}
export const isExpiry = (fri) => { const d = new Date(fri * 1000); return lastFriday(d.getUTCFullYear(), d.getUTCMonth()) === fri; };
export function usDst(dayStart) {
  const d = new Date(dayStart * 1000), y = d.getUTCFullYear();
  const nthSun = (m, n) => { const f = new Date(Date.UTC(y, m, 1)).getUTCDay(); return Date.UTC(y, m, 1 + ((7 - f) % 7) + 7 * (n - 1)) / 1000; };
  return dayStart >= nthSun(2, 2) && dayStart < nthSun(10, 1);
}
export const ny17 = (dayStart) => dayStart + (usDst(dayStart) ? 21 : 22) * 3600;
// financing nights: each 17:00 New York instant in (entry, exit]; a Friday counts three (as crypto-weekend-reversal)
export function nights(entry, exit) {
  let n = 0;
  for (let d = Math.floor(entry / DAY) * DAY - DAY; d <= exit; d += DAY) {
    const x = ny17(d); if (x > entry && x <= exit) n += new Date(d * 1000).getUTCDay() === 5 ? 3 : 1;
  }
  return n;
}

// ─── candles ───
export function loadRows(file) { return JSON.parse(zlib.gunzipSync(fs.readFileSync(file))); }
export function series(rows) {
  const n = rows.length, t = new Float64Array(n), o = new Float64Array(n), h = new Float64Array(n), l = new Float64Array(n), c = new Float64Array(n);
  rows.forEach((r, i) => { t[i] = r[0]; o[i] = r[1]; h[i] = r[2]; l[i] = r[3]; c[i] = r[4]; });
  const at = new Map(); for (let i = 0; i < n; i++) at.set(t[i], i);
  return { n, t, o, h, l, c, at };
}
export function firstAtOrAfter(S, time) { let lo = 0, hi = S.n; while (lo < hi) { const m = (lo + hi) >> 1; if (S.t[m] < time) lo = m + 1; else hi = m; } return lo; }
export function days(S) {
  const out = []; let g = null;
  for (let i = 0; i < S.n; i++) { const k = Math.floor(S.t[i] / DAY) * DAY;
    if (!g || g.time !== k) { g = { time: k, open: S.o[i], high: S.h[i], low: S.l[i], close: S.c[i], count: 1 }; out.push(g); }
    else { if (S.h[i] > g.high) g.high = S.h[i]; if (S.l[i] < g.low) g.low = S.l[i]; g.close = S.c[i]; g.count++; } }
  return out;
}
// ATR(20) of the 20 complete UTC days ending before `day0` (00:00 UTC of the entry day); null when any of the 21 is missing.
export function atrBefore(dayMap, day0, minCount = P.DAY_MIN, N = P.ATR_N) {
  let sum = 0;
  for (let k = 1; k <= N; k++) {
    const d = dayMap.get(day0 - k * DAY), p = dayMap.get(day0 - (k + 1) * DAY);
    if (!d || !p || (minCount && (d.count < minCount || p.count < minCount))) return null;
    sum += Math.max(d.high - d.low, Math.abs(d.high - p.close), Math.abs(d.low - p.close));
  }
  return sum / N;
}

// ─── one trade: entry at the open of the candle at t0, stop k x atr, no target, out at tEnd ───
export function simulate(S, t0, side, atr, tEnd, kStop = P.K_STOP) {
  const i0 = S.at.get(t0); if (i0 == null || !(atr > 0) || !side) return null;
  const entry = S.o[i0], risk = kStop * atr, stop = entry - side * risk;
  const iEnd = firstAtOrAfter(S, tEnd); if (iEnd >= S.n) return null;
  const expect = Math.round((tEnd - t0) / M5); if (expect <= 0 || (iEnd - i0) < P.COVER * expect) return null;
  let exit = null, how = 'time', at = S.t[iEnd];
  for (let i = i0; i < iEnd; i++) {
    const o = S.o[i], h = S.h[i], l = S.l[i];
    if (side > 0 ? o <= stop : o >= stop) { exit = o; how = 'stop'; at = S.t[i]; break; }
    if (side > 0 ? l <= stop : h >= stop) { exit = stop; how = 'stop'; at = S.t[i]; break; }
  }
  if (exit == null) exit = S.o[iEnd];
  return { t: t0, side, entry, stop, atr, risk, exit, how, closed: at, R: side * (exit - entry) / risk };
}
export function costs(tr, mkt, mult = 1) {
  const fin = P.FIN[mkt][tr.side > 0 ? 'long' : 'short'], n = nights(tr.t, tr.closed);
  const cost = P.COST * tr.entry / tr.risk, finR = fin / 365 * tr.entry * n / tr.risk;
  return { cost: cost * mult, fin: finR * mult, nights: n, net: tr.R - (cost + finR) * mult };
}

// Every Friday of [from, to] for one market and window: is it an expiry, the 7-day move, the side, the trade (or null), and
// the absolute window return in ATR (descriptive).
export function fridays(S, wk, from, to) {
  const W = WINDOWS[wk], dmap = new Map(days(S).map((d) => [d.time, d])), out = [];
  let f = Math.floor(from / DAY) * DAY; while (new Date(f * 1000).getUTCDay() !== 5) f += DAY;
  for (; f <= to; f += 7 * DAY) {
    const t0 = f + W.entry, t1 = f + W.exit, day0 = Math.floor(t0 / DAY) * DAY;
    const atr = atrBefore(dmap, day0), i0 = S.at.get(t0), iB = S.at.get(t0 - 7 * DAY), i1 = S.at.get(t1);
    const x = { fri: f, expiry: isExpiry(f), atr, ok: !!(atr && i0 != null && iB != null) };
    if (x.ok) {
      x.move7 = S.o[i0] - S.o[iB]; x.side = W.dir * Math.sign(x.move7);
      x.trade = x.side ? simulate(S, t0, x.side, atr, t1) : null;
      x.absK = i1 != null ? Math.abs(S.o[i1] - S.o[i0]) / atr : null;
    }
    out.push(x);
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
export function monthT(trades, from, to) {
  const a = monthKey(from), b = monthKey(to), m = new Array(b - a + 1).fill(0);
  for (const x of trades) { const k = monthKey(x.closed) - a; if (k >= 0 && k < m.length) m[k] += x.net; }
  return { ...stat(m), months: m.length };
}
export const normP = (t) => { if (!Number.isFinite(t)) return 1; const z = t, b = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * b * (0.3193815 + b * (-0.3565638 + b * (1.781478 + b * (-1.821256 + b * 1.330274)))); return z > 0 ? p : 1 - p; };
export function holm(ps) {
  const o = ps.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p), out = new Array(ps.length); let run = 0;
  o.forEach((x, k) => { run = Math.max(run, Math.min(1, x.p * (ps.length - k))); out[x.i] = run; });
  return out;
}
export function maxDD(xs) { let c = 0, pk = 0, dd = 0; for (const x of xs) { c += x; pk = Math.max(pk, c); dd = Math.min(dd, c - pk); } return dd; }
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function shuffle(arr, rnd) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function pct(xs, q) { const a = xs.filter(Number.isFinite).sort((x, y) => x - y); if (!a.length) return null; const p = (a.length - 1) * q / 100, lo = Math.floor(p), hi = Math.ceil(p); return a[lo] + (a[hi] - a[lo]) * (p - lo); }

const inWin = (x, [a, b]) => x.fri >= ts(a) && x.fri < ts(b) + DAY;
const withCost = (F, mkt, mult) => F.filter((x) => x.trade).map((x) => ({ ...x.trade, ...costs(x.trade, mkt, mult), mkt, fri: x.fri, move7: x.move7 }));

export function summary(trades, [a, b]) {
  const net = trades.map((x) => x.net), s = stat(net), g = stat(trades.map((x) => x.R)), mo = monthT(trades, ts(a), ts(b) + DAY - 1);
  const wins = net.filter((x) => x > 0), loss = net.filter((x) => x < 0);
  return { n: s.n, win: s.n ? r3(wins.length / s.n) : null, grossR: r3(g.mean), netR: r3(s.mean), tTrade: r2(s.t), tMonth: r2(mo.t), months: mo.months,
    total: r2(s.sum), maxDD: r2(maxDD(net)), stops: trades.filter((x) => x.how === 'stop').length,
    cost: r3(stat(trades.map((x) => x.cost)).mean), fin: r3(stat(trades.map((x) => x.fin)).mean), nights: r2(stat(trades.map((x) => x.nights)).mean),
    _p: normP(mo.t) };
}
const clean = (s) => { const { _p, ...o } = s; return o; };

// One window for both coins: per coin and POOL, IS / OOS, at 0x / 1x / 2x cost, by side and year.
export function evaluateWindow(F, wk) {
  const out = { name: WINDOWS[wk].name, primary: WINDOWS[wk].primary, tests: {} };
  const sets = {}; for (const m of Object.keys(MARKETS)) sets[m] = [0, 1, 2].map((k) => withCost(F[m].filter((x) => x.expiry), m, k));
  const keyOf = { btc: 'BTC', eth: 'ETH' }, ps = [];
  const one = (key, s0, s1, s2) => {
    const T = {};
    for (const [w, win] of [['all', P.WIN], ['is', P.IS], ['oos', P.OOS]]) {
      const f = (arr) => arr.filter((x) => inWin(x, win)).sort((a, b) => a.t - b.t);
      const b1 = summary(f(s1), win); T[w] = { ...clean(b1), gross0: clean(summary(f(s0), win)).netR, net2: clean(summary(f(s2), win)).netR };
      if (w === 'oos') ps.push(b1._p);
    }
    const oos = s1.filter((x) => inWin(x, P.OOS));
    T.side = { long: clean(summary(oos.filter((x) => x.side > 0), P.OOS)), short: clean(summary(oos.filter((x) => x.side < 0), P.OOS)) };
    const years = {}; for (const x of s1) { const y = new Date(x.t * 1000).getUTCFullYear(); (years[y] ||= []).push(x.net); }
    T.byYear = Object.fromEntries(Object.entries(years).map(([y, v]) => [y, { n: v.length, netR: r3(stat(v).mean), total: r2(stat(v).sum) }]));
    out.tests[key] = T;
  };
  for (const m of Object.keys(MARKETS)) one(keyOf[m], ...sets[m]);
  one('POOL', ...[0, 1, 2].map((k) => [...sets.btc[k], ...sets.eth[k]]));
  const adj = holm(ps); Object.keys(out.tests).forEach((k, i) => { out.tests[k].oos.p = r3(ps[i]); out.tests[k].oos.pHolm = r3(adj[i]); });
  // descriptive: median absolute window return in ATR, expiry Fridays against all other Fridays
  out.absMove = {}; for (const m of Object.keys(MARKETS)) {
    const ok = F[m].filter((x) => x.ok && x.absK != null);
    out.absMove[m] = { expiry: r3(pct(ok.filter((x) => x.expiry).map((x) => x.absK), 50)), nExpiry: ok.filter((x) => x.expiry).length,
      other: r3(pct(ok.filter((x) => !x.expiry).map((x) => x.absK), 50)), nOther: ok.filter((x) => !x.expiry).length };
  }
  return out;
}

// placebo: the same rule on random non-expiry Fridays of the OOS window, as many per coin as the coin's real OOS trades
export function placebo(F, nReal, seeds = P.SEEDS) {
  const elig = {}; for (const m of Object.keys(MARKETS)) elig[m] = F[m].filter((x) => !x.expiry && x.trade && inWin(x, P.OOS));
  const means = [];
  for (let s = 1; s <= seeds; s++) {
    const rnd = mulberry32(s), all = [];
    for (const m of Object.keys(MARKETS)) all.push(...withCost(shuffle(elig[m], rnd).slice(0, nReal[m]), m, 1));
    means.push(stat(all.map((x) => x.net)).mean);
  }
  return { means: means.map(r3), eligible: Object.fromEntries(Object.entries(elig).map(([m, v]) => [m, v.length])) };
}

export function study(data) {
  const [wf, wt] = [ts(P.WIN[0]), ts(P.WIN[1])], F = {}, windows = {};
  const S = {}; for (const m of Object.keys(MARKETS)) S[m] = series(data[m].m5);
  for (const wk of Object.keys(WINDOWS)) {
    F[wk] = {}; for (const m of Object.keys(MARKETS)) F[wk][m] = fridays(S[m], wk, wf, wt);
    windows[wk] = evaluateWindow(F[wk], wk);
  }
  const prim = windows.post, pool = prim.tests.POOL;
  const nReal = { btc: prim.tests.BTC.oos.n, eth: prim.tests.ETH.oos.n };
  const pl = placebo(F.post, nReal), beat = pl.means.filter((m) => pool.oos.netR != null && m < pool.oos.netR).length;
  prim.placebo = { p5: r3(pct(pl.means, 5)), p50: r3(pct(pl.means, 50)), p95: r3(pct(pl.means, 95)), beat, of: pl.means.length, eligible: pl.eligible, means: pl.means };
  const cond = {
    oosT: pool.oos.netR > 0 && pool.oos.tMonth >= P.T_MIN,
    isPositive: pool.is.netR > 0,
    x2: pool.oos.net2 > 0,
    placebo: beat >= P.BEAT,
  };
  const verdict = Object.values(cond).every(Boolean) ? 'PASS' : 'FAIL';
  const funnel = {}; for (const m of Object.keys(MARKETS)) {
    const E = F.post[m].filter((x) => x.expiry);
    funnel[m] = { expiries: E.length, priced: E.filter((x) => x.ok).length, trades: E.filter((x) => x.trade).length,
      longs: E.filter((x) => x.trade && x.side > 0).length, shorts: E.filter((x) => x.trade && x.side < 0).length,
      first: (E.find((x) => x.trade) || {}).fri ? iso(E.find((x) => x.trade).fri).slice(0, 10) : null,
      last: (E.filter((x) => x.trade).at(-1) || {}).fri ? iso(E.filter((x) => x.trade).at(-1).fri).slice(0, 10) : null };
  }
  const trades = {}; for (const m of Object.keys(MARKETS))
    trades[m] = withCost(F.post[m].filter((x) => x.expiry), m, 1).map((x) => [iso(x.fri).slice(0, 10), x.side, x.how, r3(x.R), r3(x.net)]);
  return { verdict, cond, primary: 'post', windows, funnel, trades };
}

// ─── report ───
const sg = (x) => (x == null ? 'n/a' : (x > 0 ? '+' : '') + x);
export function headline(res) {
  const p = res.windows.post.tests.POOL;
  return `After the monthly crypto expiry, BTC and ETH with the 7-day trend made ${sg(p.oos.netR)}R a trade net out of sample (n ${p.oos.n}, month t ${p.oos.tMonth}), ${sg(p.is.netR)}R in sample.`;
}
export function report(res) {
  const L = [], pr = res.windows.post, pl = pr.placebo;
  L.push('# Crypto monthly expiry: result', '', `Run on ${res.built}. Pre-registration: \`PREREGISTRATION.md\` (committed alone before this ran). Paper research only.`, '');
  L.push(`**Verdict: ${res.verdict}.** ${headline(res)}`, '');
  L.push('## Pass bar (POOL, primary window)', '',
    `- OOS net R > 0 with month-sum t >= 2: ${res.cond.oosT ? 'yes' : 'no'} (${sg(pr.tests.POOL.oos.netR)}R, t ${pr.tests.POOL.oos.tMonth})`,
    `- IS net R > 0: ${res.cond.isPositive ? 'yes' : 'no'} (${sg(pr.tests.POOL.is.netR)}R)`,
    `- OOS net R > 0 at 2x cost and financing: ${res.cond.x2 ? 'yes' : 'no'} (${sg(pr.tests.POOL.oos.net2)}R)`,
    `- beats >= 38 of 40 placebo runs: ${res.cond.placebo ? 'yes' : 'no'} (beats ${pl.beat} of ${pl.of}; placebo p5 / p50 / p95 ${sg(pl.p5)} / ${sg(pl.p50)} / ${sg(pl.p95)}R)`, '');
  for (const wk of ['post', 'into']) {
    const W = res.windows[wk];
    L.push(`## ${W.primary ? 'Primary' : 'Reported only'}: ${W.name}`, '',
      '| Test | window | n | win % | R before costs | net R a trade | event t | month-sum t | total R | max DD | net at 2x | stops |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const [k, T] of Object.entries(W.tests)) for (const w of ['is', 'oos', 'all']) { const a = T[w];
      L.push(`| ${k} | ${w.toUpperCase()} | ${a.n} | ${a.win == null ? 'n/a' : Math.round(a.win * 100)} | ${sg(a.gross0)} | ${sg(a.netR)} | ${a.tTrade} | ${a.tMonth} | ${sg(a.total)} | ${a.maxDD} | ${sg(a.net2)} | ${a.stops} |`); }
    L.push('', `OOS one-sided p from the month-sum t, Holm over BTC / ETH / POOL: ${Object.entries(W.tests).map(([k, T]) => `${k} p ${T.oos.p}, Holm ${T.oos.pHolm}`).join('; ')}.`, '');
    for (const [k, T] of Object.entries(W.tests)) L.push(`- **${k}**: OOS long ${sg(T.side.long.netR)}R (n ${T.side.long.n}), short ${sg(T.side.short.netR)}R (n ${T.side.short.n}); mean cost ${T.all.cost}R, financing ${T.all.fin}R (${T.all.nights} nights); by year ${Object.entries(T.byYear).map(([y, v]) => `${y} ${sg(v.netR)} (n ${v.n})`).join(', ')}.`);
    L.push('', `Median absolute window move in ATR (descriptive): ${Object.entries(W.absMove).map(([m, a]) => `${m.toUpperCase()} expiry ${a.expiry} (n ${a.nExpiry}) against other Fridays ${a.other} (n ${a.nOther})`).join('; ')}.`, '');
  }
  L.push('## Funnel (primary window, expiry Fridays 2022-01 to 2026-10)', '', '| Market | expiries | priced | trades (long / short) | first | last |', '|---|---|---|---|---|---|');
  for (const [m, f] of Object.entries(res.funnel)) L.push(`| ${m.toUpperCase()} | ${f.expiries} | ${f.priced} | ${f.trades} (${f.longs} / ${f.shorts}) | ${f.first} | ${f.last} |`);
  L.push('', '## Reading', '', ...res.reading, '', '## What was not done, and why', '', ...res.notDone, '',
    '## To repeat', '', '```sh', 'node research/edge/crypto-expiry/run.mjs fetch <dir>   # git show from origin/council-data, no network', 'node research/edge/crypto-expiry/run.mjs run <dir>', '```', '');
  return L.join('\n');
}
// wording only; every number comes from the result
export function reading(res) {
  const pr = res.windows.post, p = pr.tests.POOL, a = res.windows.into.tests.POOL, out = [];
  out.push(`- Primary (POOL, Friday 08:00 to Monday 08:00 with the 7-day trend): OOS ${sg(p.oos.netR)}R a trade net (n ${p.oos.n}, month t ${p.oos.tMonth}, event t ${p.oos.tTrade}; ${sg(p.oos.gross0)}R before costs), IS ${sg(p.is.netR)}R (n ${p.is.n}), OOS at 2x costs ${sg(p.oos.net2)}R.`);
  out.push(`- Against the placebo (the same rule on random non-expiry Fridays of the OOS window): the real figure beats ${pr.placebo.beat} of ${pr.placebo.of} runs (placebo middle ${sg(pr.placebo.p50)}R).`);
  out.push(`- Reported only, into expiry against the 7-day move: POOL OOS ${sg(a.oos.netR)}R (n ${a.oos.n}, month t ${a.oos.tMonth}), IS ${sg(a.is.netR)}R. Pinning as a smaller Thursday-to-Friday move: median ${Object.entries(res.windows.into.absMove).map(([m, x]) => `${m.toUpperCase()} ${x.expiry} on expiry against ${x.other} ATR otherwise`).join(', ')} (descriptive).`);
  out.push(`- n is small by construction (one event a month a coin); a 1R stop of 1.5 daily ATRs is rarely hit over three days, so the result is mostly the sign of the weekend move.`);
  out.push(`- ${res.verdict === 'PASS' ? 'A pass is a hypothesis for a forward paper stream at most; the owner decides (absolute rule 3).' : 'Not an edge. Do not trade it, do not add it to the council, and do not re-test other windows, directions or stops of the expiry calendar on these candles.'}`);
  return out;
}
export const NOT_DONE = [
  '- No open-interest or strike data are on file and no exchange API is reachable from the build sandbox, so "max pain" itself was not computed: this is a calendar test of the release.',
  '- No hourly or finer BTC / ETH candles before 2022 exist in the repository or council-data; the study covers 2022-01 to 2026-10 only (about 28 events a coin each half).',
  '- Binance spot prices stand in for the broker\'s CFD prices; today\'s financing rates are charged for every year. CME\'s 16:00 London settlement was not tested separately.',
];

// ─── CLI ───
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (!dir) { console.error('usage: node run.mjs fetch|run <dir>'); process.exit(2); }
  const files = Object.values(MARKETS).map((s) => `research/candles/crypto5m/${s}_5m.json.gz`);
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    for (const f of files) { const buf = execFileSync('git', ['show', `origin/council-data:${f}`], { maxBuffer: 1 << 28 }); fs.writeFileSync(path.join(dir, path.basename(f)), buf); console.log(f, buf.length); }
  } else if (cmd === 'run') {
    const data = {}; for (const [m, s] of Object.entries(MARKETS)) data[m] = { m5: loadRows(path.join(dir, `${s}_5m.json.gz`)) };
    const res = { study: 'crypto-expiry', built: '2026-11-14', ...study(data) };
    res.headline = headline(res); res.reading = reading(res); res.notDone = NOT_DONE;
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(res));
    console.log(res.headline);
  }
}
