// Edge research · bond-fomc-drift (14 Nov 2026): after a scheduled FOMC decision, follow the 2-year Treasury's reading of it in
// long-duration Treasuries. Signal = the USB02Y price change from the close of the M5 candle ending 5 min before the statement
// to the close of the one ending 16:00 New York on the decision day (up -> buy, down -> sell); trade USB10Y (T1) and USB30Y
// (T2) from the 09:30 New York open of the next trading day to the 16:00 close of the third, stop 1.5 x ATR(20) of daily
// candles, checked on hourly blocks. Everything here is fixed in PREREGISTRATION.md (committed before this file existed).
// Paper research only: nothing here trades or changes a live rule.
//   node --use-env-proxy research/edge/bond-fomc-drift/fetch.mjs <dir>   -> <dir>/usb02y|usb10y|usb30y-5m.json.gz (out of git)
//   git show origin/council-data:research/daily/usb10y.json > <dir>/usb10y-d.json   (and usb30y)
//   node research/edge/bond-fomc-drift/run.mjs <dir>                     -> result.json, RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { zonedToUtc } from '../../../council/events.mjs';
import { nights, foldWeekend } from '../../../council/fills.mjs';
import { fomcDates, clockOf, UNSCHEDULED, SOURCE } from './events.mjs';

export const P = { COST: 0.001, STOP_K: 1.5, ATR_N: 20, FIN_ADD: 2.5, SEEDS: 40, GAP_DAYS: 5, LOOK: 1800, M5: 300, H1: 3600,
  A: ['2008-01-01', '2015-12-31'], B: ['2016-01-01', '2026-11-13'], END: '2026-11-13', TZ: 'America/New_York' };
export const MARKETS = { T1: 'usb10y', T2: 'usb30y' };
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const RATES = JSON.parse(fs.readFileSync(path.join(HERE, 'rates.json'), 'utf8'));

// ─── calendar ───
export const ny = (date, hhmm) => zonedToUtc(date, hhmm, P.TZ);
export const addDay = (date, k = 1) => new Date(Date.parse(date + 'T12:00:00Z') + k * 86400e3).toISOString().slice(0, 10);
export const weekday = (date) => new Date(date + 'T12:00:00Z').getUTCDay();
export const windowOf = (date) => (date >= P.A[0] && date <= P.A[1] ? 'a' : date >= P.B[0] && date <= P.B[1] ? 'b' : null);

// ─── candles: rows [t, o, h, l, c] sorted by t; t = candle start ───
export function lastEndingBy(bars, endT, look = P.LOOK) {            // the last candle ending at or before endT, within `look`
  let lo = 0, hi = bars.length - 1, k = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (bars[m][0] + P.M5 <= endT) { k = m; lo = m + 1; } else hi = m - 1; }
  return k >= 0 && bars[k][0] + P.M5 > endT - look ? k : -1;
}
export function indexAt(bars, t) {                                  // the candle starting exactly at t
  let lo = 0, hi = bars.length - 1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (bars[m][0] === t) return m; if (bars[m][0] < t) lo = m + 1; else hi = m - 1; }
  return -1;
}
export function isTradingDay(bars, date) {
  const w = weekday(date); if (w === 0 || w === 6) return false;
  return indexAt(bars, ny(date, '09:30')) >= 0 && lastEndingBy(bars, ny(date, '16:00')) >= 0;
}
export function nextTradingDays(bars, date, n = 3) {                // the n trading days after `date`
  const out = []; let d = date;
  for (let k = 0; k < 15 && out.length < n; k++) { d = addDay(d); if (isTradingDay(bars, d)) out.push(d); }
  return out.length === n ? out : null;
}

// ─── signal: decision-day data only ───
export function signal(b2, date, at) {
  const T = ny(date, at), i0 = lastEndingBy(b2, T - P.M5), i1 = lastEndingBy(b2, ny(date, '16:00'));
  if (i0 < 0 || i1 < 0 || i1 <= i0) return { s: null, why: i0 < 0 ? 'no 2-year candle before the statement' : 'no 2-year candle at 16:00' };
  const s = +(b2[i1][4] - b2[i0][4]).toFixed(6);
  return { s, side: s > 0 ? 1 : s < 0 ? -1 : 0, from: b2[i0][4], to: b2[i1][4], t0: b2[i0][0] + P.M5, t1: b2[i1][0] + P.M5 };
}

// ─── ATR(20) of complete daily candles (weekends folded) that ended at or before t ───
export function atrAt(daily, t, n = P.ATR_N) {
  let k = -1; for (let i = daily.length - 1; i >= 0; i--) if (daily[i].time + 86400 <= t) { k = i; break; }
  if (k < n) return null;
  let s = 0; for (let i = k - n + 1; i <= k; i++) { const b = daily[i], pc = daily[i - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}

// ─── one trade: entry open of the 09:30 candle, stop checked on hourly blocks from the entry, exit 16:00 close of day 3 ───
export function simulate(bars, entryT, exitEndT, side, stopDist) {
  const i0 = indexAt(bars, entryT), i1 = lastEndingBy(bars, exitEndT);
  if (i0 < 0 || i1 < i0) return null;
  const entry = bars[i0][1], stop = entry - side * stopDist;
  let k = i0;
  while (k <= i1) {
    const blockEnd = entryT + Math.floor((bars[k][0] - entryT) / P.H1 + 1) * P.H1;
    let j = k, hi = -Infinity, lo = Infinity; const open = bars[k][1];
    while (j <= i1 && bars[j][0] < blockEnd) { hi = Math.max(hi, bars[j][2]); lo = Math.min(lo, bars[j][3]); j++; }
    if (side > 0 ? open <= stop : open >= stop) return { entry, stop, exit: open, how: 'gap', exitT: bars[k][0] };
    if (side > 0 ? lo <= stop : hi >= stop) return { entry, stop, exit: stop, how: 'stop', exitT: Math.min(blockEnd, bars[i1][0] + P.M5) };
    k = j;
  }
  return { entry, stop, exit: bars[i1][4], how: 'time', exitT: bars[i1][0] + P.M5 };
}

// ─── costs ───
export function dgs2At(date, rows = RATES.DGS2) { let v = null; for (const [d, x] of rows) { if (d <= date) v = x; else break; } return v; }
export function finRate(side, r) { return side > 0 ? r + P.FIN_ADD : Math.max(0, P.FIN_ADD - r); }   // % a year
export function costs(tr, mult = 1) {
  const r = dgs2At(new Date(tr.entryT * 1000).toISOString().slice(0, 10)), n = nights(tr.entryT, tr.exitT);
  const spread = P.COST * tr.entry * mult, fin = n * finRate(tr.side, r) / 100 / 365 * tr.entry * mult;
  return { spread, fin, n, r };
}
export function trade(bars, daily, date, side) {
  const days = nextTradingDays(bars, date, 3); if (!days) return { skip: 'no three trading days after it' };
  const entryT = ny(days[0], '09:30'), exitEndT = ny(days[2], '16:00'), atr = atrAt(daily, entryT);
  if (!atr || !(atr > 0)) return { skip: 'no ATR' };
  const stopDist = P.STOP_K * atr, sim = simulate(bars, entryT, exitEndT, side, stopDist);
  if (!sim) return { skip: 'no entry candle' };
  const tr = { date, side, entryDay: days[0], exitDay: days[2], entryT, ...sim, stopDist, atr };
  tr.R = side * (sim.exit - sim.entry) / stopDist;
  const c1 = costs(tr), c2 = costs(tr, 2);
  tr.nights = c1.n; tr.dgs2 = c1.r; tr.costR = c1.spread / stopDist; tr.finR = c1.fin / stopDist;
  tr.noFin = tr.R - tr.costR; tr.net = tr.R - tr.costR - tr.finR; tr.net2 = tr.R - (c2.spread + c2.fin) / stopDist;
  return tr;
}

// ─── statistics ───
function lgamma(x) { const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (const k of c) s += k / ++y; return -t + Math.log(2.5066282746310005 * s / x); }
function betacf(a, b, x) { let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d; let h = d;
  for (let m = 1; m <= 200; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-14) break; }
  return h; }
function ibeta(a, b, x) { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
export function pOneSided(t, df) { if (!Number.isFinite(t) || df < 1) return 1; const x = df / (df + t * t), tail = 0.5 * ibeta(df / 2, 0.5, x); return t > 0 ? tail : 1 - tail; }
export function holm(ps) { const o = ps.map((p, i) => [p, i]).sort((x, y) => x[0] - y[0]), out = Array(ps.length); let run = 0;
  o.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (ps.length - k) * p)); out[i] = run; }); return out; }
export function tOf(xs) { const n = xs.length; if (n < 2) return null; const m = xs.reduce((a, b) => a + b, 0) / n, v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1); return v > 0 ? m / Math.sqrt(v / n) : null; }
export function monthSums(trades, key = 'net') { const m = new Map(); for (const t of trades) { const k = t.date.slice(0, 7); m.set(k, (m.get(k) || 0) + t[key]); } return [...m.values()]; }
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
export function stats(trades) {
  const ms = monthSums(trades), t = tOf(ms);
  return { n: trades.length, months: ms.length, net: mean(trades.map((x) => x.net)), gross: mean(trades.map((x) => x.R)), noFin: mean(trades.map((x) => x.noFin)),
    net2: mean(trades.map((x) => x.net2)), t, tGross: tOf(monthSums(trades, 'R')), t2: tOf(monthSums(trades, 'net2')), tTrade: tOf(trades.map((x) => x.net)),
    p: pOneSided(t, ms.length - 1), win: trades.length ? trades.filter((x) => x.net > 0).length / trades.length : null,
    stops: trades.filter((x) => x.how !== 'time').length, gaps: trades.filter((x) => x.how === 'gap').length, total: trades.reduce((a, b) => a + b.net, 0),
    costR: mean(trades.map((x) => x.costR)), finR: mean(trades.map((x) => x.finR)), long: trades.filter((x) => x.side > 0).length, short: trades.filter((x) => x.side < 0).length };
}
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const pct = (xs, q) => { const s = [...xs].sort((a, b) => a - b); if (!s.length) return null; const i = (s.length - 1) * q, lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };

// placebo pool: weekdays of a window, not an announcement day and not within GAP_DAYS calendar days after one
export function placeboPool(win, announce) {
  const bad = new Set(); for (const a of announce) for (let k = 0; k <= P.GAP_DAYS; k++) bad.add(addDay(a, k));
  const out = []; for (let d = win[0]; d <= win[1]; d = addDay(d)) { const w = weekday(d); if (w && w !== 6 && !bad.has(d)) out.push(d); }
  return out;
}

export function conditions(b, a, plc) {
  return { positiveT2: b.net > 0 && b.t >= 2, holm: b.holm < 0.05, abovePlacebo: plc && b.net > plc.p95, replication: a.net > 0, costs2: b.net2 > 0 };
}

// ─── the study ───
export function study(data) {
  const { b2, bars, daily } = data, dates = fomcDates().filter((d) => d <= P.END && windowOf(d));
  const events = [], skipped = [], trades = { T1: [], T2: [] };
  for (const date of dates) {
    const sg = signal(b2, date, clockOf(date)), ev = { date, at: clockOf(date), s: sg.s, from: sg.from, to: sg.to };
    if (sg.s === null) { skipped.push({ date, why: sg.why }); events.push(ev); continue; }
    if (!sg.side) { skipped.push({ date, why: 'no change in the 2-year' }); events.push(ev); continue; }
    ev.side = sg.side;
    for (const k of Object.keys(MARKETS)) { const mk = MARKETS[k], tr = trade(bars[mk], daily[mk], date, sg.side);
      if (tr.skip) skipped.push({ date, market: mk, why: tr.skip }); else { tr.market = mk; trades[k].push(tr); ev[k] = +tr.net.toFixed(3); } }
    events.push(ev);
  }
  // release-minute check of the event list (decides nothing)
  const check = [];
  for (const date of dates) { const T = ny(date, clockOf(date)), i = indexAt(b2, T), rg = (j) => b2[j][2] - b2[j][3];
    if (i < 0) { check.push({ date, ratio: null }); continue; }
    const others = []; for (let k = -25; k <= 25; k++) { const d = addDay(date, k), w = weekday(d); if (!k || !w || w === 6) continue; const j = indexAt(b2, ny(d, clockOf(date))); if (j >= 0) others.push(rg(j)); }
    const med = pct(others, 0.5); check.push({ date, ratio: med > 0 ? +(rg(i) / med).toFixed(2) : null }); }
  // tests
  const announce = [...fomcDates(), ...UNSCHEDULED];
  const tests = {};
  for (const k of [...Object.keys(MARKETS), 'POOL']) {
    const all = k === 'POOL' ? [...trades.T1, ...trades.T2] : trades[k];
    tests[k] = { a: stats(all.filter((x) => windowOf(x.date) === 'a')), b: stats(all.filter((x) => windowOf(x.date) === 'b')) };
  }
  const hp = holm([tests.T1.b.p, tests.T2.b.p]); tests.T1.b.holm = hp[0]; tests.T2.b.holm = hp[1]; tests.POOL.b.holm = tests.POOL.b.p;
  // placebo
  const placebo = {};
  for (const w of ['a', 'b']) {
    const pool = placeboPool(w === 'a' ? P.A : P.B, announce), need = { T1: tests.T1[w].n, T2: tests.T2[w].n }, seeds = { T1: [], T2: [], POOL: [] };
    for (let seed = 1; seed <= P.SEEDS; seed++) {
      const r = rng(seed), order = [...pool]; for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      const got = { T1: [], T2: [] };
      for (const d of order) {
        if (got.T1.length >= need.T1 && got.T2.length >= need.T2) break;
        const sg = signal(b2, d, '14:00'); if (!sg.side) continue;
        for (const k of ['T1', 'T2']) { if (got[k].length >= need[k]) continue; const mk = MARKETS[k], tr = trade(bars[mk], daily[mk], d, sg.side); if (!tr.skip) got[k].push(tr); }
      }
      for (const k of ['T1', 'T2']) { const s = stats(got[k]); seeds[k].push({ net: s.net, t: s.t }); }
      const s = stats([...got.T1, ...got.T2]); seeds.POOL.push({ net: s.net, t: s.t });
    }
    placebo[w] = Object.fromEntries(Object.entries(seeds).map(([k, v]) => [k, { mean: mean(v.map((x) => x.net)), p5: pct(v.map((x) => x.net), 0.05), p50: pct(v.map((x) => x.net), 0.5), p95: pct(v.map((x) => x.net), 0.95),
      t5: pct(v.map((x) => x.t), 0.05), t50: pct(v.map((x) => x.t), 0.5), t95: pct(v.map((x) => x.t), 0.95), beats: v.filter((x) => tests[k][w].net > x.net).length, pool: pool.length }]));
  }
  for (const k of Object.keys(tests)) { tests[k].cond = conditions(tests[k].b, tests[k].a, placebo.b[k]); tests[k].pass = Object.values(tests[k].cond).every(Boolean); }
  const verdict = tests.T1.pass || tests.T2.pass ? 'PASS' : 'FAIL';
  const years = {}; for (const k of ['T1', 'T2']) { years[k] = {}; for (const x of trades[k]) { const y = x.date.slice(0, 4); (years[k][y] ??= { n: 0, net: 0 }); years[k][y].n++; years[k][y].net += x.net; } }
  const bySide = {}; for (const k of ['T1', 'T2']) for (const w of ['a', 'b']) for (const s of [1, -1]) { const xs = trades[k].filter((x) => windowOf(x.date) === w && x.side === s); bySide[`${k}.${w}.${s > 0 ? 'buy' : 'sell'}`] = { n: xs.length, net: mean(xs.map((x) => x.net)), t: tOf(xs.map((x) => x.net)) }; }
  return { events, skipped, check, trades, tests, placebo, verdict, years, bySide };
}

// ─── report ───
const f3 = (x) => (x == null || !Number.isFinite(x) ? 'n/a' : (x < 0 ? '−' : '+') + Math.abs(x).toFixed(3));
const f2 = (x) => (x == null || !Number.isFinite(x) ? 'n/a' : (x < 0 ? '−' : '+') + Math.abs(x).toFixed(2));
const fp = (x) => (x == null ? 'n/a' : x < 0.0001 ? '<0.0001' : x.toFixed(4));
const yn = (b) => (b ? 'yes' : 'no');
export const NAME = { T1: 'T1 USB10Y', T2: 'T2 USB30Y', POOL: 'Pooled (both)' };
export function headline(S) {
  const b = S.tests.T1.b, c = S.tests.T2.b;
  return `**Verdict: ${S.verdict}.** ${S.verdict === 'PASS' ? 'A test passes every pre-registered condition.' : 'Neither test passes the pre-registered bar.'} 2016 → now, net of costs: USB10Y ${f3(b.net)}R a trade (n ${b.n}, month t ${f2(b.t)}), USB30Y ${f3(c.net)}R (n ${c.n}, month t ${f2(c.t)}).`;
}
export function report(S, meta) {
  const L = [];
  L.push('# Treasuries after the FOMC, following the 2-year\'s reading of the decision: result', '', headline(S), '');
  L.push(`Paper research only. No live rule, size, filter, stop, config or council member changed. Rule, costs, windows, placebo and pass bar were fixed in \`PREREGISTRATION.md\` (commit ${meta.prereg}) before any candle of this study was fetched.`, '');
  L.push('## What was tested', '');
  L.push(`Scheduled FOMC decision days 2008 to October 2026 (${S.events.length} in the two windows; ${SOURCE}). Signal: the USB02Y (US 2-year Treasury CFD, OANDA mid M5) change from the close of the candle ending 5 minutes before the statement to the close of the candle ending 16:00 New York that day; up (yield down) → buy, down → sell. Trade: USB10Y (T1) and USB30Y (T2) at the 09:30 New York open of the next trading day, out at the 16:00 New York close of the third trading day; stop 1.5 × ATR(20) of complete daily candles (weekends folded), checked on hourly blocks from the entry (a block opening beyond the stop exits at its open). Costs: 0.10 % of price a round trip (the tsmom bond CFD assumption) and financing per rollover (\`council/fills.mjs\` \`nights\`; long DGS2 + 2.5 % a year, short max(0, 2.5 % − DGS2)). t on calendar-month sums of net R; Holm over T1 and T2; placebo 40 seeds of random non-FOMC weekdays with the same construction (13:55 → 16:00 on that day). Decisive 2016-01-01 → 2026-11-13; replication 2008-2015. Candles to ${meta.dataTo}.`, '');
  L.push('## The tests', '');
  L.push('| Test | Window | n | Gross R a trade | Net R a trade | Net at x2 costs | Month t (net) | One-sided p | Holm p | Win | Stops (gaps) | Total net R | Placebo net p5 / p50 / p95 | Beats seeds |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const k of ['T1', 'T2', 'POOL']) for (const w of ['b', 'a']) { const s = S.tests[k][w], pl = S.placebo[w][k];
    L.push(`| ${NAME[k]} | ${w === 'b' ? '2016 → now' : '2008-2015'} | ${s.n} | ${f3(s.gross)} | ${f3(s.net)} | ${f3(s.net2)} | ${f2(s.t)} | ${fp(s.p)} | ${w === 'b' ? fp(s.holm) : '—'} | ${Math.round(100 * s.win)} % | ${s.stops} (${s.gaps}) | ${f2(s.total)} | ${f3(pl.p5)} / ${f3(pl.p50)} / ${f3(pl.p95)} | ${pl.beats} / ${P.SEEDS} |`); }
  L.push('', '| Test | 1: net > 0 and t ≥ 2 | 2: Holm p < 0.05 | 3: above placebo p95 | 4: replication > 0 | 5: > 0 at x2 costs | Pass |', '|---|---|---|---|---|---|---|');
  for (const k of ['T1', 'T2', 'POOL']) { const c = S.tests[k].cond; L.push(`| ${NAME[k]} | ${yn(c.positiveT2)} | ${yn(c.holm)} | ${yn(c.abovePlacebo)} | ${yn(c.replication)} | ${yn(c.costs2)} | ${yn(S.tests[k].pass)} |`); }
  L.push('', 'The pooled test is reported with the same checks and does not decide alone (as pre-registered).', '');
  L.push('## Costs and placebo t (descriptive)', '');
  L.push('| Test | Window | Without financing | Spread a trade (R) | Financing a trade (R) | Month t gross | Month t at x2 costs | Per-trade t | Long / short | Placebo month t p5 / p50 / p95 |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const k of ['T1', 'T2', 'POOL']) for (const w of ['b', 'a']) { const s = S.tests[k][w], pl = S.placebo[w][k];
    L.push(`| ${NAME[k]} | ${w === 'b' ? '2016 → now' : '2008-2015'} | ${f3(s.noFin)} | ${s.costR.toFixed(3)} | ${s.finR.toFixed(3)} | ${f2(s.tGross)} | ${f2(s.t2)} | ${f2(s.tTrade)} | ${s.long} / ${s.short} | ${f2(pl.t5)} / ${f2(pl.t50)} / ${f2(pl.t95)} |`); }
  L.push('', '## By side (net R a trade, descriptive)', '');
  L.push('| Test | Window | Buy n | Buy net | Sell n | Sell net |', '|---|---|---|---|---|---|');
  for (const k of ['T1', 'T2']) for (const w of ['b', 'a']) { const bu = S.bySide[`${k}.${w}.buy`], se = S.bySide[`${k}.${w}.sell`]; L.push(`| ${NAME[k]} | ${w === 'b' ? '2016 → now' : '2008-2015'} | ${bu.n} | ${f3(bu.net)} | ${se.n} | ${f3(se.net)} |`); }
  L.push('', '## By year (net R summed, n)', '');
  for (const k of ['T1', 'T2']) L.push(`- ${NAME[k]}: ` + Object.entries(S.years[k]).map(([y, v]) => `${y} ${f2(v.net)} (${v.n})`).join(' · '));
  const low = S.check.filter((c) => c.ratio !== null && c.ratio < 1).map((c) => c.date), none = S.check.filter((c) => c.ratio === null).map((c) => c.date);
  const rs = S.check.map((c) => c.ratio).filter((x) => x !== null);
  L.push('', '## Event list check', '', `USB02Y range of the M5 candle at the statement minute against the same clock candle on weekdays within ±25 days: median ${pct(rs, 0.5).toFixed(2)}x. Below 1x (listed, not dropped): ${low.join(', ') || 'none'}. No candle at the statement minute: ${none.join(', ') || 'none'}.`);
  L.push('', `Skipped: ${S.skipped.length ? S.skipped.map((s) => `${s.date}${s.market ? ' ' + s.market : ''} (${s.why})`).join('; ') : 'none'}.`, '');
  L.push('## What this means', '');
  if (S.verdict === 'FAIL') L.push('The pre-registered bar is not met: following the 2-year\'s decision-day move in the 10-year or 30-year Treasury CFD over the next three trading days is not an edge on the council\'s feed after costs. No proposal is written and nothing live changed. Any other version (a threshold on the 2-year\'s move, another hold, other maturities, European bonds) would need its own pre-registration on data not used here.');
  else L.push('A test passes the pre-registered bar. That is a hypothesis for a forward paper shadow the owner decides on; it is not a live rule and nothing live changed.');
  L.push('', '## Caveats', '', '- The 2008-2021 decision dates were written from memory in the pre-fomc-drift study (federalreserve.gov could not be reached from the build sandbox); check them against the Federal Reserve\'s calendars. 2022 on are the repository\'s own calendar.', '- The bond CFD spread (0.10 % of price a round trip) is the tsmom study\'s assumption, not a measured spread; the financing markup (2.5 %) is assumed too, and the Wednesday triple rollover of `nights` is the gold rule (a week counts seven nights either way). DGS2 is weekly.', '- The 2008-2012 statements at 14:15 / 12:30 use a signal window starting 5 minutes before the statement (the pre-registration\'s rule); the placebo always uses 13:55 → 16:00.', `- Seen after the run (post hoc, changes nothing): OANDA's USB02Y M5 history is thin at times (${S.skipped.filter((s) => !s.market).length} decision days skipped for a missing 2-year candle or no change, most in 2013-14 and 2018); and on the 10-year the assumed spread alone is about ${S.tests.T1.b.costR.toFixed(2)}R a trade, larger than the gross result in either window.`, '');
  return L.join('\n');
}

const MODE = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (MODE) {
  const DIR = process.argv[2]; if (!DIR) throw new Error('usage: node run.mjs <dataDir>');
  const gz = (f) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, f))).toString());
  const b2 = gz('usb02y-5m.json.gz'), bars = { usb10y: gz('usb10y-5m.json.gz'), usb30y: gz('usb30y-5m.json.gz') };
  const daily = {}; for (const mk of ['usb10y', 'usb30y']) { const j = JSON.parse(fs.readFileSync(path.join(DIR, `${mk}-d.json`), 'utf8')); daily[mk] = foldWeekend(j.rows.map(([t, o, h, l, c]) => ({ time: t, open: o, high: h, low: l, close: c }))); }
  const S = study({ b2, bars, daily });
  const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
  const meta = { prereg: process.env.PREREG || '465368d0e', dataTo: iso(Math.min(b2.at(-1)[0], bars.usb10y.at(-1)[0], bars.usb30y.at(-1)[0])) };
  const r3 = (x) => (typeof x === 'number' ? +x.toFixed(4) : x);
  const clean = (o) => JSON.parse(JSON.stringify(o, (k, v) => r3(v)));
  const out = { study: 'bond-fomc-drift', built: '2026-11-14', preregistration: 'research/edge/bond-fomc-drift/PREREGISTRATION.md', prereg: meta.prereg,
    title: 'Treasuries after the FOMC, following the 2-year\'s reading of the decision', system: 'USB10Y / USB30Y CFDs (OANDA), FOMC decision days 2008-2026',
    verdict: `${S.verdict}: ${S.verdict === 'PASS' ? 'a test passes every condition' : 'neither USB10Y nor USB30Y passes the pre-registered bar'}; 2016 → now USB10Y ${f3(S.tests.T1.b.net)}R a trade net (n ${S.tests.T1.b.n}, month t ${f2(S.tests.T1.b.t)}), USB30Y ${f3(S.tests.T2.b.net)}R (n ${S.tests.T2.b.n}, month t ${f2(S.tests.T2.b.t)})`,
    source: SOURCE, unscheduledExcluded: UNSCHEDULED, data: { candles: 'OANDA mid M5 USB02Y, USB10Y, USB30Y through /md/bars', to: meta.dataTo, daily: 'council-data research/daily/usb10y.json, usb30y.json (302f01eae)' },
    params: P, costs: { spreadPctRoundTrip: 0.10, financing: 'long DGS2 + 2.5 %/yr, short max(0, 2.5 % - DGS2), per nights() rollover', rates: 'rates.json' },
    tests: clean(S.tests), placebo: clean(S.placebo), years: clean(S.years), bySide: clean(S.bySide), check: S.check, skipped: S.skipped,
    events: clean(S.events),
    candidates: ['T1', 'T2', 'POOL'].map((k) => ({ rule: NAME[k], verdict: S.tests[k].pass ? 'PASS' : 'FAIL', is: { n: S.tests[k].a.n, avgR: r3(S.tests[k].a.net), t: r3(S.tests[k].a.t) }, oos: { n: S.tests[k].b.n, avgR: r3(S.tests[k].b.net), t: r3(S.tests[k].b.t) } })) };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(S, meta));
  console.log(out.verdict);
}
