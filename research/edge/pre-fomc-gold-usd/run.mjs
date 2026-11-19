// Edge research · pre-fomc-gold-usd: the pre-FOMC drift in gold and the US dollar, out of sample, net of CFD costs.
// Rules, costs, windows, statistics, placebo and pass bar: PREREGISTRATION.md (committed first). A stand-alone rule: never a
// gate, exit, entry or size of the live gold book (docs/owner-decisions.md item 44).
//   node --use-env-proxy research/edge/pre-fomc-gold-usd/fetch.mjs <dir>   (OANDA M15 candles, kept out of git)
//   node research/edge/pre-fomc-gold-usd/run.mjs <dir>                     (writes result.json and RESULT.md here)
// The windows, the event list, nyDays / atrAt / lastEnding / the placebo draw follow pre-fomc-drift's run.mjs (copied, never
// imported across branches); the bar is M15 and the stop 1.0 x ATR(20). Pure pieces are exported for the test.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { zonedToUtc } from '../../../council/events.mjs';
import { nights, FIN } from '../../../council/fills.mjs';
import { nyOffsetH } from '../../../council/histdata.mjs';
import { fomcEvents, ALL_ANNOUNCE, SOURCE, UNSCHEDULED } from './events.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86400, BAR = 900, US = 'America/New_York';
const T0 = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
export const UNTIL = T0('2026-11-14');
export const P = Object.freeze({
  K: 1.0, ATR: 20, HOLD: DAY, PRE: 900, LOOK: 3600,
  WIN: Object.freeze({ A: [T0('2008-01-01'), T0('2016-01-01')], B: [T0('2016-01-01'), UNTIL] }),
  SEEDS: 40, EXCL_DAYS: 3, HALF: 182, TRIES: 50, Q: 0.95, ALPHA: 0.05, MIN_N: 60,
});
// Costs (PREREGISTRATION.md "Costs"): gold $0.30 + FIN.xau.long per night; forex commission 0.000045 of price a round trip + one
// default spread of slippage (two half spreads) + the charged swap of ctrader/symbols.json (pips a night; credits count 0).
export const COM_RT = 0.000045;
export const COSTS = Object.freeze({
  xau: Object.freeze({ fixed: 0.30, finLong: FIN.xau.long }),
  eurusd: Object.freeze({ com: COM_RT, slip: 0.0001, pip: 0.0001, swapLong: 0.621, swapShort: 0 }),
  gbpusd: Object.freeze({ com: COM_RT, slip: 0.0001, pip: 0.0001, swapLong: 0.179, swapShort: 0 }),
  audusd: Object.freeze({ com: COM_RT, slip: 0.0001, pip: 0.0001, swapLong: 0, swapShort: 0 }),   // long is a credit (+0.041): nothing
  usdjpy: Object.freeze({ com: COM_RT, slip: 0.01, pip: 0.01, swapLong: 0, swapShort: 0 }),        // not in symbols.json: no swap
});
export const TESTS = Object.freeze({
  T1: Object.freeze({ name: 'T1: long gold (XAU/USD)', legs: [['xau', 1]] }),
  T2: Object.freeze({ name: 'T2: short USD (long EUR/USD, GBP/USD, AUD/USD; short USD/JPY), equal risk', legs: [['eurusd', 1], ['gbpusd', 1], ['audusd', 1], ['usdjpy', -1]] }),
});
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'audusd', 'usdjpy'];
export const T3_DROPPED = 'the event list has no decision (rate-change) field, so T3 was dropped before any data was seen';

// ── times: entry = close of the M15 candle ending at T - 24 h, exit = the one ending at T - 15 min ──
export const timesOf = (T) => ({ tE: T - P.HOLD, tX: T - P.PRE });
export const nyDate = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: US }).format(new Date(t * 1000));

export function toBars(rows) {
  const n = rows.length, b = { t: new Float64Array(n), o: new Float64Array(n), h: new Float64Array(n), l: new Float64Array(n), c: new Float64Array(n), n };
  rows.forEach((r, i) => { b.t[i] = r[0]; b.o[i] = r[1]; b.h[i] = r[2]; b.l[i] = r[3]; b.c[i] = r[4]; });
  return b;
}
export function lastEnding(b, end, look = P.LOOK) {
  let lo = 0, hi = b.n;
  while (lo < hi) { const m = (lo + hi) >> 1; if (b.t[m] + BAR <= end) lo = m + 1; else hi = m; }
  const i = lo - 1;
  return i >= 0 && b.t[i] + BAR >= end - look ? i : -1;
}
export function nyDays(b) {
  const out = []; let cur = null;
  for (let i = 0; i < b.n; i++) {
    const t = b.t[i], loc = t - nyOffsetH(t) * 3600, key = Math.floor((loc + 7 * 3600) / DAY);
    if (!cur || cur.key !== key) {
      if (cur) out.push(cur);
      const e0 = key * DAY + 17 * 3600;
      cur = { key, end: e0 + nyOffsetH(e0 + 5 * 3600) * 3600, o: b.o[i], h: b.h[i], l: b.l[i], c: b.c[i] };
    } else { if (b.h[i] > cur.h) cur.h = b.h[i]; if (b.l[i] < cur.l) cur.l = b.l[i]; cur.c = b.c[i]; }
  }
  if (cur) out.push(cur);
  return out;
}
export function atrAt(days, t, n = P.ATR) {
  let lo = 0, hi = days.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (days[m].end <= t) lo = m + 1; else hi = m; }
  const k = lo;
  if (k < n + 1) return null;
  let s = 0;
  for (let j = k - n; j < k; j++) { const d = days[j], pc = days[j - 1].c; s += Math.max(d.h - d.l, Math.abs(d.h - pc), Math.abs(d.l - pc)); }
  return s / n;
}
// cost of one round trip in price, at cost multiple `mult`
export function legCost(sym, side, entry, nN, mult = 1) {
  const c = COSTS[sym];
  if (sym === 'xau') return mult * (c.fixed + (side > 0 ? nN * c.finLong * entry : 0));
  const swap = (side > 0 ? c.swapLong : c.swapShort) * c.pip * nN;
  return mult * (c.com * entry + c.slip + swap);
}
// one leg: enter at the entry close, stop K x ATR on the losing side, out at the exit close or at the stop (a gap at the open)
export function leg(b, days, T, sym, side) {
  const { tE, tX } = timesOf(T), iE = lastEnding(b, tE), iX = lastEnding(b, tX);
  if (iE < 0 || iX < 0 || iX <= iE) return { skip: iE < 0 ? 'no entry candle' : iX < 0 ? 'no exit candle' : 'no candle between' };
  const entryT = b.t[iE] + BAR, A = atrAt(days, entryT);
  if (!(A > 0)) return { skip: 'no ATR' };
  const entry = b.c[iE], stop = entry - side * P.K * A, risk = Math.abs(entry - stop);
  let exit = b.c[iX], why = 'time', exitT = b.t[iX] + BAR;
  for (let i = iE + 1; i <= iX; i++) {
    if (side > 0 ? b.o[i] <= stop : b.o[i] >= stop) { exit = b.o[i]; why = 'gap'; exitT = b.t[i]; break; }
    if (side > 0 ? b.l[i] <= stop : b.h[i] >= stop) { exit = stop; why = 'stop'; exitT = b.t[i] + BAR; break; }
  }
  const nN = nights(entryT, exitT), R = side * (exit - entry) / risk;
  const costR = legCost(sym, side, entry, nN) / risk, cost2R = legCost(sym, side, entry, nN, 2) / risk;
  return { sym, side, entryT, exitT, entry, stop, risk, exit, why, nights: nN, R, costR, net: R - costR, net2: R - cost2R,
    pct: side * (b.c[iX] - entry) / entry * 100 };
}
// one event of a test: the mean of its legs (every leg must be priced)
export function eventTrade(data, T, test) {
  const legs = [];
  for (const [sym, side] of test.legs) { const x = leg(data[sym].b, data[sym].days, T, sym, side); if (x.skip) return { skip: `${sym}: ${x.skip}` }; legs.push(x); }
  const avg = (k) => legs.reduce((a, x) => a + x[k], 0) / legs.length;
  return { T, legs, R: avg('R'), costR: avg('costR'), net: avg('net'), net2: avg('net2'), pct: avg('pct'), stops: legs.filter((x) => x.why !== 'time').length };
}

// ── statistics ──
export function stat(xs) {
  const n = xs.length; if (!n) return { n: 0, mean: null, sd: null, t: null };
  const mean = xs.reduce((a, x) => a + x, 0) / n, sd = n > 1 ? Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1)) : null;
  return { n, mean, sd, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : null };
}
export function quantile(xs, q) {
  const s = xs.filter(Number.isFinite).slice().sort((a, b) => a - b); if (!s.length) return null;
  const x = (s.length - 1) * q, lo = Math.floor(x), hi = Math.ceil(x);
  return s[lo] + (s[hi] - s[lo]) * (x - lo);
}
const lgamma = (z) => { const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = z, y = z, tmp = x + 5.5; tmp -= (x + 0.5) * Math.log(tmp); let s = 1.000000000190015; for (const c of g) s += c / ++y; return -tmp + Math.log(2.5066282746310005 * s / x); };
function betacf(a, b, x) {
  const qab = a + b, qap = a + 1, qam = a - 1; let c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d; let h = d;
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < 3e-12) break;
  }
  return h;
}
function ibeta(a, b, x) { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
// one-sided p, P[T >= t], Student t with df degrees of freedom
export function pOneSided(t, df) { if (!Number.isFinite(t) || !(df > 0)) return null; const x = df / (df + t * t), tail = 0.5 * ibeta(df / 2, 0.5, x); return t >= 0 ? tail : 1 - tail; }
// Holm step-down adjusted p-values, in the input order
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), m = ps.length, out = new Array(m);
  let run = 0;
  idx.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (m - k) * p)); out[i] = run; });
  return out;
}
export function rng(seed) {   // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const dnum = (s) => Date.parse(s + 'T00:00:00Z') / (DAY * 1000);
const dstr = (n) => new Date(n * DAY * 1000).toISOString().slice(0, 10);
export function standIns(ev, win, banned = ALL_ANNOUNCE()) {
  const d0 = dnum(ev.date), w = new Date(d0 * DAY * 1000).getUTCDay(), ban = banned.map(dnum), out = [];
  for (let d = d0 - P.HALF; d <= d0 + P.HALF; d++) {
    if (new Date(d * DAY * 1000).getUTCDay() !== w) continue;
    if (ban.some((x) => Math.abs(x - d) <= P.EXCL_DAYS)) continue;
    const T = zonedToUtc(dstr(d), ev.at, US);
    if (T < win[0] || T >= win[1]) continue;
    out.push({ date: dstr(d), at: ev.at, T });
  }
  return out;
}
export function placeboMeans(price, evs, win, seeds = P.SEEDS) {
  const banned = ALL_ANNOUNCE(), pools = evs.map((e) => standIns(e, win, banned)), means = [], cache = new Map();
  const tr = (c) => { if (!cache.has(c.T)) cache.set(c.T, price(c.T)); return cache.get(c.T); };
  for (let s = 1; s <= seeds; s++) {
    const r = rng(s), xs = [];
    for (const pool of pools) {
      for (let k = 0; k < P.TRIES && pool.length; k++) { const x = tr(pool[Math.floor(r() * pool.length)]); if (!x.skip) { xs.push(x.net); break; } }
    }
    means.push(stat(xs).mean);
  }
  return means;
}
// release-minute check on EUR/USD (descriptive): range of the M15 candle starting at T against the same candle on weekdays ±25 days
export function spike(b, ev) {
  const at = (T) => { const i = lastEnding(b, T + BAR, 0); return i >= 0 && b.t[i] === T ? b.h[i] - b.l[i] : null; };
  const r0 = at(ev.T); if (r0 == null) return null;
  const xs = [];
  for (let d = dnum(ev.date) - 25; d <= dnum(ev.date) + 25; d++) {
    const w = new Date(d * DAY * 1000).getUTCDay(); if (w === 0 || w === 6 || d === dnum(ev.date)) continue;
    const r = at(zonedToUtc(dstr(d), ev.at, US)); if (r != null) xs.push(r);
  }
  const med = quantile(xs, 0.5);
  return med > 0 ? r0 / med : null;
}
// the pre-registered bar for one test: net > 0 in A and B, Holm-adjusted p of B < 0.05, n of B >= 60
export function judge(A, B, pHolm) {
  const c = { positiveA: A.netR > 0, positiveB: B.netR > 0, holm: pHolm != null && pHolm < P.ALPHA, n60: B.n >= P.MIN_N };
  return { ...c, pass: c.positiveA && c.positiveB && c.holm && c.n60 };
}

const r2 = (x, d = 3) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d);
export function summarize(trs) {
  const net = stat(trs.map((x) => x.net)), gross = stat(trs.map((x) => x.R)), n2 = stat(trs.map((x) => x.net2)), pct = stat(trs.map((x) => x.pct));
  const byYear = {};
  for (const x of trs) { const y = nyDate(x.T).slice(0, 4); (byYear[y] ||= []).push(x.net); }
  return { n: net.n, grossR: r2(gross.mean), grossT: r2(gross.t, 2), netR: r2(net.mean), t: r2(net.t, 2), sd: r2(net.sd),
    p: r2(net.n > 1 ? pOneSided(net.t, net.n - 1) : null, 4), net2R: r2(n2.mean), t2x: r2(n2.t, 2),
    win: r2(trs.filter((x) => x.net > 0).length / (trs.length || 1), 3), stops: trs.reduce((a, x) => a + x.stops, 0),
    costR: r2(stat(trs.map((x) => x.costR)).mean), pctNoStop: r2(pct.mean, 4), pctNoStopT: r2(pct.t, 2),
    byYear: Object.fromEntries(Object.entries(byYear).map(([y, xs]) => [y, { n: xs.length, netR: r2(stat(xs).mean) }])) };
}

export function run(dir) {
  const evs = fomcEvents(UNTIL), data = {};
  for (const sym of MARKETS) {
    const b = toBars(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${sym}-15m.json.gz`)))));
    data[sym] = { b, days: nyDays(b) };
  }
  const out = { study: 'pre-fomc-gold-usd', built: '2026-11-14', preregistration: 'research/edge/pre-fomc-gold-usd/PREREGISTRATION.md',
    standAlone: 'a stand-alone rule: never a gate, exit, entry or size of the live gold book (docs/owner-decisions.md item 44)',
    source: SOURCE, datesUnverified: '2008-2021 event dates written from memory in a sandbox that cannot reach federalreserve.gov: unverified (2016-21 inside the decisive window); 2022 on from council/events.mjs',
    unscheduledExcluded: UNSCHEDULED, t3: T3_DROPPED,
    rule: 'enter at the close of the M15 candle ending 24 h before the scheduled FOMC statement, exit at the close of the one ending 15 min before it; each leg a stop 1.0 x ATR(20) of New York days on its losing side',
    costs: { xau: '$0.30 a round trip + FIN.xau.long x nights x entry (council/fills.mjs)', forex: 'commission 0.000045 of price a round trip + one default spread of slippage (0.0001; USD/JPY 0.01) + charged swaps from council-data ctrader/symbols.json: EUR/USD long 0.621 pip a night, GBP/USD long 0.179 pip; AUD/USD long is a credit (counted 0); USD/JPY short not in the file (counted 0)' },
    candles: Object.fromEntries(MARKETS.map((s) => [s, { n: data[s].b.n, from: new Date(data[s].b.t[0] * 1000).toISOString().slice(0, 10), to: new Date(data[s].b.t[data[s].b.n - 1] * 1000).toISOString().slice(0, 10) }])),
    events: evs.length, tests: {} };
  const sp = evs.map((e) => ({ date: e.date, ratio: r2(spike(data.eurusd.b, e), 2) }));
  out.spikeCheck = { market: 'eurusd', median: r2(quantile(sp.map((x) => x.ratio).filter((x) => x != null), 0.5), 2),
    noSpike: sp.filter((x) => x.ratio != null && x.ratio < 1).map((x) => x.date), noCandle: sp.filter((x) => x.ratio == null).map((x) => x.date) };
  for (const [k, test] of Object.entries(TESTS)) {
    const price = (T) => eventTrade(data, T, test), o = { name: test.name, windows: {} };
    for (const [w, win] of Object.entries(P.WIN)) {
      const we = evs.filter((e) => e.T >= win[0] && e.T < win[1]), trs = [], skipped = [];
      for (const e of we) { const x = price(e.T); if (x.skip) skipped.push({ date: e.date, why: x.skip }); else trs.push({ ...x, date: e.date }); }
      const s = summarize(trs), pm = placeboMeans(price, we, win), p95 = quantile(pm, P.Q);
      o.windows[w] = { events: we.length, skipped, ...s,
        placebo: { seeds: pm.length, mean: r2(stat(pm).mean), p95: r2(p95), max: r2(Math.max(...pm)), beaten: pm.filter((x) => s.netR > x).length },
        trades: trs.map((x) => ({ date: x.date, R: r2(x.R), net: r2(x.net), stops: x.stops, legs: x.legs.map((l) => ({ m: l.sym, entry: r2(l.entry, 5), stop: r2(l.stop, 5), exit: r2(l.exit, 5), why: l.why, R: r2(l.R) })) })) };
    }
    out.tests[k] = o;
  }
  const keys = Object.keys(TESTS), ph = holm(keys.map((k) => out.tests[k].windows.B.p ?? 1));
  keys.forEach((k, i) => {
    const o = out.tests[k], B = o.windows.B;
    o.pHolmB = r2(ph[i], 4);
    Object.assign(o, judge(o.windows.A, B, ph[i]));
    o.abovePlacebo = B.placebo.p95 != null && B.netR > B.placebo.p95;
  });
  out.passed = keys.filter((k) => out.tests[k].pass);
  out.verdict = out.passed.length ? 'PASS' : 'FAIL';
  return out;
}

const f = (x, d = 3) => (x == null ? 'n/a' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d));
const WN = { A: '2008-2015 (replication, dates unverified)', B: '2016 → now (decisive)' };
export function report(r) {
  const L = [], T1 = r.tests.T1, T2 = r.tests.T2;
  const one = (o) => `n ${o.windows.B.n}, ${f(o.windows.B.netR)}R a trade net, t ${f(o.windows.B.t, 2)}, Holm p ${o.pHolmB}; 2008-15 ${f(o.windows.A.netR)}R (n ${o.windows.A.n})`;
  L.push('# The pre-FOMC drift in gold and the US dollar: result', '');
  L.push(`**Verdict: ${r.verdict}.** ${r.verdict === 'PASS' ? `Passed: ${r.passed.join(', ')}.` : '0 of 2 tests meet the pre-registered bar.'} ` +
    `T1 long gold, 2016 → now: ${one(T1)}. T2 short USD basket, 2016 → now: ${one(T2)}. T3 (gold before rate changes) was not run: ${r.t3}.`, '');
  L.push(`A stand-alone rule, pre-registered in \`PREREGISTRATION.md\` (committed before any candle was fetched). It is not, and cannot become by this study, a gate, exit, entry or size of the live gold book (docs/owner-decisions.md item 44). Paper research only; nothing live changed.`, '');
  L.push(`Events: ${r.events} scheduled FOMC statements, 2008 to November 2026 (${r.source}); unscheduled ${r.unscheduledExcluded.join(', ')} excluded. **The 2008-2021 dates are unverified** (${r.datesUnverified}). Rule: ${r.rule}. Data: OANDA mid M15 candles through the candle proxy.`, '');
  L.push(`Costs: gold ${r.costs.xau}; forex ${r.costs.forex}.`, '');
  L.push('## Per test and window', '', '| test | window | n | gross R | net R a trade | t | one-sided p | net R at 2x costs | win | stops (legs) | placebo mean | placebo 95th pct | beats seeds |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const k of Object.keys(r.tests)) for (const w of ['A', 'B']) {
    const x = r.tests[k].windows[w];
    L.push(`| ${k} | ${WN[w]} | ${x.n} | ${f(x.grossR)} | ${f(x.netR)} | ${f(x.t, 2)} | ${x.p ?? 'n/a'} | ${f(x.net2R)} | ${(x.win * 100).toFixed(0)} % | ${x.stops} | ${f(x.placebo.mean)} | ${f(x.placebo.p95)} | ${x.placebo.beaten} / 40 |`);
  }
  L.push('', '## The bar', '', '| test | net R > 0, 2008-15 | net R > 0, 2016 → now | Holm p (2016 → now) < 0.05 | n ≥ 60 | pass | above placebo 95th pct |', '|---|---|---|---|---|---|---|');
  for (const k of Object.keys(r.tests)) { const o = r.tests[k]; L.push(`| ${o.name} | ${o.positiveA ? 'yes' : 'no'} | ${o.positiveB ? 'yes' : 'no'} | ${o.holm ? 'yes' : 'no'} (${o.pHolmB}) | ${o.n60 ? 'yes' : 'no'} | **${o.pass ? 'yes' : 'no'}** | ${o.abovePlacebo ? 'yes' : 'no'} |`); }
  L.push('', 'Holm is over the two window-B tests. The placebo and the 2x-cost column are reported beside the bar, as pre-registered.', '');
  L.push('## Without the stop and the costs (descriptive)', '', 'Mean signed % move from the entry close to the exit close (gold long; the basket = mean of the four legs, USD/JPY short):', '');
  for (const k of Object.keys(r.tests)) L.push(`- ${k}: 2008-2015 ${f(r.tests[k].windows.A.pctNoStop, 4)} % (t ${f(r.tests[k].windows.A.pctNoStopT, 2)}); 2016 → now ${f(r.tests[k].windows.B.pctNoStop, 4)} % (t ${f(r.tests[k].windows.B.pctNoStopT, 2)}).`);
  L.push('', '## By year (net R a trade, n)', '');
  for (const k of Object.keys(r.tests)) { const y = { ...r.tests[k].windows.A.byYear, ...r.tests[k].windows.B.byYear }; L.push(`- ${k}: ` + Object.entries(y).map(([yy, x]) => `${yy} ${f(x.netR, 2)} (${x.n})`).join(' · ')); }
  L.push('', '## Skipped events', '');
  for (const k of Object.keys(r.tests)) for (const w of ['A', 'B']) { const s = r.tests[k].windows[w].skipped; L.push(`- ${k} ${w}: ${s.length ? s.map((x) => `${x.date} (${x.why})`).join(', ') : 'none'}`); }
  L.push('', '## Event list check (descriptive, nothing dropped)', '', `Range of the EUR/USD M15 candle starting at the statement time against the same candle on nearby weekdays: median ${r.spikeCheck.median}x. Below 1x: ${r.spikeCheck.noSpike.join(', ') || 'none'}. No candle at the statement time: ${r.spikeCheck.noCandle.join(', ') || 'none'}.`, '');
  L.push('## What this means', '');
  if (r.verdict === 'PASS') L.push(`The bar is met by ${r.passed.join(' and ')}. This is a hypothesis for a forward paper shadow only, as a stand-alone rule outside the live gold book; the owner decides. Nothing live changed.`);
  else L.push('The pre-registered bar is not met by either test, so the pre-FOMC drift is not an edge in gold or the dollar on the council\'s feeds after costs. No proposal is written and nothing live changed. Any other version (another hold, a rate-change filter, other pairs) would need its own pre-registration on data not used here.');
  L.push('', 'To repeat: `node --use-env-proxy research/edge/pre-fomc-gold-usd/fetch.mjs <dir>`, then `node research/edge/pre-fomc-gold-usd/run.mjs <dir>`. Tests: `tests/pre-fomc-gold-usd.test.mjs`.', '');
  return L.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candle dir>');
  const r = run(dir);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(r, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(r));
  for (const k of Object.keys(r.tests)) for (const w of ['A', 'B']) { const x = r.tests[k].windows[w]; console.log(k, w, x.n, 'gross', x.grossR, 'net', x.netR, 't', x.t, '2x', x.net2R, 'p95', x.placebo.p95, 'beaten', x.placebo.beaten); }
  for (const k of Object.keys(r.tests)) console.log(k, 'holmB', r.tests[k].pHolmB, 'pass', r.tests[k].pass);
  console.log('verdict', r.verdict);
}
