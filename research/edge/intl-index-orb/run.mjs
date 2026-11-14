// Edge research · intl-index-orb: the 5-minute opening range breakout of research/edge/orb-nas100 (branch orb-nas100), its rule
// unchanged, at the local cash opens of six non-US indices, as fixed in PREREGISTRATION.md. Pure pieces are exported for
// tests/intl-index-orb.test.mjs. The day rule (dayTrade), the statistics and the placebo generator are orb-nas100's, with the
// New York clock replaced by each market's own clock and close.
//   node --use-env-proxy research/edge/intl-index-orb/fetch.mjs <dir>    (candles, out of git)
//   node research/edge/intl-index-orb/run.mjs <dir>                       (writes result.json and RESULT.md)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { isClosed } from './holidays.mjs';

export const TARGET_R = 10;
export const WINDOWS = { A: ['2016-01-01', '2020-12-31'], B: ['2021-01-01', '2099-12-31'], Bp: ['2023-03-01', '2099-12-31'] };
export const SEEDS = 40;
const DAY = 86400, M5 = 300;

// open / close in local hours and minutes; cost = round trip in index points (open-run-breadth tables), spread = spread only
export const MARKETS = {
  de40: { name: 'DAX', tz: 'cet', open: [9, 0], close: [17, 30], ex: 'xetra', cost: 2.0, spread: 1.2, early: [] },
  eu50: { name: 'Euro Stoxx 50', tz: 'cet', open: [9, 0], close: [17, 30], ex: 'xetra', cost: 3.5, spread: 1.5, early: [] },
  fr40: { name: 'CAC 40', tz: 'cet', open: [9, 0], close: [17, 30], ex: 'euronext', cost: 2.2, spread: 1.2, early: ['12-24', '12-31'] },
  uk100: { name: 'FTSE 100', tz: 'uk', open: [8, 0], close: [16, 30], ex: 'lse', cost: 2.0, spread: 1.0, early: ['12-24', '12-31'] },
  jp225: { name: 'Nikkei 225', tz: 'jst', open: [9, 0], close: [15, 0], close2: { from: '2024-11-05', at: [15, 30] }, ex: 'jpx', cost: 18.0, spread: 8.0, early: [] },
  au200: { name: 'ASX 200', tz: 'syd', open: [10, 0], close: [16, 0], ex: 'asx', cost: 4.0, spread: 2.0, early: ['12-24', '12-31'] },
};
export const TESTS = [
  ['T1', 'Europe pooled', ['de40', 'eu50', 'fr40', 'uk100']],
  ['T2', 'de40', ['de40']], ['T3', 'eu50', ['eu50']], ['T4', 'fr40', ['fr40']], ['T5', 'uk100', ['uk100']],
  ['T6', 'jp225', ['jp225']], ['T7', 'au200', ['au200']],
  ['T8', 'Asia pooled', ['jp225', 'au200']],
];

// ─── calendar and clocks ───
const ymd = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const utcDay = (y, m, d) => Date.UTC(y, m, d) / 1000;
const wdOf = (y, m, d) => new Date(Date.UTC(y, m, d)).getUTCDay();
// day of the month of the nth weekday wd (0 Sunday) of month m (0-based); n = -1 is the last one
export function nthWd(y, m, wd, n) {
  if (n > 0) { const f = wdOf(y, m, 1); return 1 + ((wd - f + 7) % 7) + 7 * (n - 1); }
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(), l = wdOf(y, m, last);
  return last - ((l - wd + 7) % 7);
}
// EU summer time at unix t: last Sunday of March 01:00 UTC to last Sunday of October 01:00 UTC
export function euSummer(t) {
  const y = new Date(t * 1000).getUTCFullYear();
  return t >= utcDay(y, 2, nthWd(y, 2, 0, -1)) + 3600 && t < utcDay(y, 9, nthWd(y, 9, 0, -1)) + 3600;
}
// Sydney daylight time at unix t (rules since 2008): first Sunday of October 02:00 AEST (= Saturday 16:00 UTC) to the first
// Sunday of April 03:00 AEDT (= Saturday 16:00 UTC)
export function sydSummer(t) {
  const y = new Date(t * 1000).getUTCFullYear();
  const end = utcDay(y, 3, nthWd(y, 3, 0, 1)) - 8 * 3600, start = utcDay(y, 9, nthWd(y, 9, 0, 1)) - 8 * 3600;
  return t < end || t >= start;
}
// offset from UTC in hours of the zone at unix time t
export function offsetH(tz, t) {
  if (tz === 'cet') return euSummer(t) ? 2 : 1;
  if (tz === 'uk') return euSummer(t) ? 1 : 0;
  if (tz === 'jst') return 9;
  if (tz === 'syd') return sydSummer(t) ? 11 : 10;
  throw new Error('unknown zone ' + tz);
}
// unix time of hh:mm local on the local date (y, m 0-based, d): the offset is the one at that date's local noon
export function localTime(tz, y, m, d, hh, mm) {
  const noonGuess = utcDay(y, m, d) + 12 * 3600 - offsetH(tz, utcDay(y, m, d) + 12 * 3600) * 3600;
  return utcDay(y, m, d) + (hh * 60 + mm) * 60 - offsetH(tz, noonGuess) * 3600;
}
export function closeOf(mk, day) { const M = MARKETS[mk]; return M.close2 && day >= M.close2.from ? M.close2.at : M.close; }
export function dayKind(mk, y, m, d) {
  const w = wdOf(y, m, d); if (w === 0 || w === 6) return 'weekend';
  const s = ymd(y, m, d), M = MARKETS[mk];
  if (isClosed(M.ex, s)) return 'holiday';
  if (M.early.includes(s.slice(5))) return 'early';
  return 'trade';
}

// ─── one day (orb-nas100's dayTrade with the local open and close) ───
// bars: Map time → [t, o, h, l, c]. side: 1 buy, -1 sell, or null = F's colour. → { skip } or a trade record
export function dayTrade(bars, mk, y, m, d, { cost = 0, side = null, targetR = TARGET_R } = {}) {
  const M = MARKETS[mk], day = ymd(y, m, d), cl = closeOf(mk, day);
  const t0 = localTime(M.tz, y, m, d, ...M.open), tEnd = localTime(M.tz, y, m, d, ...cl);
  const F = bars.get(t0), E = bars.get(t0 + M5);
  if (!F || !E) return { skip: 'missing' };
  let s = side;
  if (s == null) { if (F[4] > F[1]) s = 1; else if (F[4] < F[1]) s = -1; else return { skip: 'doji' }; }
  const entry = E[1], stop = s > 0 ? F[3] : F[2], r = s * (entry - stop);
  if (!(r > 0)) return { skip: 'norisk' };
  const target = entry + s * targetR * r;
  let exit = null, how = null, last = null;
  for (let t = t0 + M5; t < tEnd; t += M5) {
    const b = bars.get(t); if (!b) continue; last = b;
    const [, o, h, l] = b;
    if (s * (o - stop) <= 0) { exit = o; how = 'stop'; break; }             // opened at or past the stop: a gap fills at the open
    const hitS = s > 0 ? l <= stop : h >= stop, hitT = s > 0 ? h >= target : l <= target;
    if (hitS) { exit = stop; how = 'stop'; break; }                          // stop first when one candle holds both
    if (hitT) { exit = target; how = 'target'; break; }
  }
  if (exit == null) { exit = last[4]; how = 'time'; }
  const R = s * (exit - entry) / r;
  return { mk, t: t0, day, side: s, entry, stop, target, r, exit, how, R, net: R - cost / r };
}

// ─── statistics (orb-nas100's) ───
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const sdv = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : NaN; };
// t of the calendar-month sums of the value fn(x)
export function monthT(trades, fn = (x) => x.net) {
  const by = new Map(); for (const x of trades) { const k = x.day.slice(0, 7); by.set(k, (by.get(k) || 0) + fn(x)); }
  const v = [...by.values()], s = sdv(v);
  return { months: v.length, t: v.length > 1 && s > 0 ? mean(v) / (s / Math.sqrt(v.length)) : 0 };
}
export function normP(t) { // one-sided p = 1 − Φ(t)
  const z = t / Math.SQRT2, a = Math.abs(z), k = 1 / (1 + 0.3275911 * a);
  const erf = 1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-a * a);
  return 0.5 * (1 - (z >= 0 ? erf : -erf));
}
export function quantile(v, q) { const s = [...v].sort((a, b) => a - b), i = q * (s.length - 1), lo = Math.floor(i); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo); }
export function holm(ps) { // adjusted p, same order
  const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = Array(ps.length); let run = 0;
  o.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (ps.length - k) * p)); out[i] = run; });
  return out;
}
const r3 = (v) => Math.round(v * 1000) / 1000, r2 = (v) => Math.round(v * 100) / 100;
// x.cost = the market's round trip (points), x.spread = its spread only
export function summary(tr) {
  const net = tr.map((x) => x.net), mt = monthT(tr), gt = monthT(tr, (x) => x.R);
  const net2 = tr.map((x) => x.R - 2 * x.cost / x.r), netS = tr.map((x) => x.R - x.spread / x.r);
  let eq = 0, pk = 0, dd = 0; for (const v of [...tr].sort((a, b) => a.t - b.t).map((x) => x.net)) { eq += v; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  const byYear = {}; for (const x of tr) { const y = x.day.slice(0, 4); (byYear[y] ||= { n: 0, net: 0 }); byYear[y].n++; byYear[y].net += x.net; }
  for (const y in byYear) byYear[y] = { n: byYear[y].n, netR: r3(byYear[y].net / byYear[y].n), total: r2(byYear[y].net) };
  const rs = tr.map((x) => x.r).sort((a, b) => a - b);
  return { n: tr.length, win: r3(tr.filter((x) => x.net > 0).length / (tr.length || 1)), netR: r3(mean(net)), grossR: r3(mean(tr.map((x) => x.R))),
    net2R: r3(mean(net2)), netSpreadR: r3(mean(netS)),
    costR: r3(mean(tr.map((x) => x.R - x.net))), total: r2(net.reduce((s, v) => s + v, 0)), months: mt.months, t: r2(mt.t), grossT: r2(gt.t),
    stops: tr.filter((x) => x.how === 'stop').length, targets: tr.filter((x) => x.how === 'target').length, time: tr.filter((x) => x.how === 'time').length,
    maxDD: r2(dd), medianRiskPts: rs.length ? r2(rs[Math.floor(rs.length / 2)]) : null, longs: tr.filter((x) => x.side > 0).length, byYear };
}

// ─── a market ───
export function days(from, to) {
  const out = [];
  for (let t = Date.parse(from + 'T00:00:00Z') / 1000; t <= Date.parse(to + 'T00:00:00Z') / 1000; t += DAY) { const x = new Date(t * 1000); out.push([x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()]); }
  return out;
}
export const inW = (day, [a, b]) => day >= a && day <= b;
// → real trades (all days 2016 → endDay) and, per seed, the placebo trades of window B
export function runMarket(rows, mk, endDay) {
  const bars = new Map(rows.map((r) => [r[0], r])), M = MARKETS[mk], cost = M.cost, all = [], eligible = [];
  const tag = (x) => Object.assign(x, { cost: M.cost, spread: M.spread });
  const skips = { holiday: 0, early: 0, missing: 0, doji: 0, norisk: 0 };
  for (const [y, m, d] of days('2016-01-01', endDay)) {
    const k = dayKind(mk, y, m, d); if (k === 'weekend') continue; if (k !== 'trade') { skips[k]++; continue; }
    const x = dayTrade(bars, mk, y, m, d, { cost }); if (x.skip) { skips[x.skip]++; continue; }
    all.push(tag(x)); eligible.push([y, m, d]);
  }
  const placebo = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    const rand = rng(seed), tr = [];
    for (const [y, m, d] of eligible) {
      const s = rand() < 0.5 ? 1 : -1;
      if (!inW(ymd(y, m, d), WINDOWS.B)) continue;
      const x = dayTrade(bars, mk, y, m, d, { cost, side: s }); if (!x.skip) tr.push(tag(x));
    }
    placebo.push(tr);
  }
  return { candles: rows.length, from: new Date(rows[0][0] * 1000).toISOString().slice(0, 10), to: new Date(rows.at(-1)[0] * 1000).toISOString().slice(0, 10),
    costPts: M.cost, spreadPts: M.spread, skips, trades: all, placebo };
}
// one test over the union of its markets' trades
export function testOf(runs, keys) {
  const tr = keys.flatMap((k) => runs[k].trades);
  const windows = Object.fromEntries(Object.entries(WINDOWS).map(([w, ab]) => [w, summary(tr.filter((x) => inW(x.day, ab)))]));
  const pl = Array.from({ length: SEEDS }, (_, i) => r3(mean(keys.flatMap((k) => runs[k].placebo[i]).map((x) => x.net))));
  return { markets: keys, windows, placebo: { seeds: SEEDS, p95: r3(quantile(pl, 0.95)), median: r3(quantile(pl, 0.5)), values: pl } };
}
export function decide(tests) {
  const ks = Object.keys(tests), ps = ks.map((k) => normP(tests[k].windows.B.t)), adj = holm(ps), out = {};
  ks.forEach((k, i) => {
    const { A, B } = tests[k].windows, pl = tests[k].placebo.p95;
    const checks = { positive: B.netR > 0, t2: B.t >= 2, holm: adj[i] <= 0.05, placebo: B.netR > pl, inSample: A.netR > 0, cost2x: B.net2R > 0 };
    out[k] = { p: r3(ps[i]), pHolm: r3(adj[i]), checks, pass: Object.values(checks).every(Boolean) };
  });
  return { byTest: out, verdict: out.T1.pass ? 'PASS' : 'FAIL' };
}

const sg = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(3);
const sg2 = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2);
const yn = (b) => (b ? 'yes' : 'no');
// the one-line verdict (kept under 220 characters)
export function headline(tests, decision) {
  const T1 = tests.T1.windows, np = Object.values(decision.byTest).filter((x) => x.pass).length;
  return `${decision.verdict}: European ORB book ${sg(T1.B.netR)}R a trade net 2021 on (n ${T1.B.n}, monthly t ${sg2(T1.B.t)}; gross ${sg(T1.B.grossR)}R); ` +
    `${np} of ${Object.keys(tests).length} tests pass after Holm`;
}

// ─── report (RESULT.md is this function of result.json) ───
export function report(R) {
  const L = [], T = R.tests, D = R.decision, ks = Object.keys(T), mk = R.markets;
  L.push('# The 5-minute opening range breakout at the European and Asian cash opens', '');
  L.push('Paper research only. No live rule, size, filter, stop, config or council member changed; ICT not involved. The rule (orb-nas100\'s,');
  L.push('unchanged), markets, costs, windows, placebo and pass bar were committed first (`PREREGISTRATION.md`). This page is written by');
  L.push('`run.mjs` from `result.json`.', '');
  L.push(`**Verdict: ${R.verdict}**`, '');
  for (const k of ks) {
    const B = T[k].windows.B, A = T[k].windows.A, d = D.byTest[k];
    L.push(`- **${k} ${T[k].label}**, 2021 → now: ${sg(B.netR)}R a trade net (n ${B.n}, t ${sg2(B.t)} on ${B.months} monthly sums; before costs ${sg(B.grossR)}R, t ${sg2(B.grossT)}; ` +
      `2× costs ${sg(B.net2R)}R); 2016-20 ${sg(A.netR)}R (n ${A.n}, t ${sg2(A.t)}); placebo 95th percentile ${sg(T[k].placebo.p95)}R; Holm p ${d.pHolm.toFixed(3)}. ` +
      `Net > 0: ${yn(d.checks.positive)}; t ≥ 2: ${yn(d.checks.t2)}; Holm: ${yn(d.checks.holm)}; beats the placebo: ${yn(d.checks.placebo)}; in sample > 0: ${yn(d.checks.inSample)}; ` +
      `2× costs > 0: ${yn(d.checks.cost2x)} → **${d.pass ? 'pass' : 'fail'}**.`);
  }
  if (R.reading) L.push('', R.reading);
  L.push('', '## Windows', '', '| Test | Window | n | Win | Net R/trade | Gross R/trade | Spread-only net | 2× cost net | Cost R/trade | Total R | t (months) | Gross t | Stops / targets / time | Max DD R |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  const WN = { A: '2016-2020 (in sample)', B: '2021 → now (decides)', Bp: 'Mar 2023 → now' };
  for (const k of ks) for (const w of ['A', 'B', 'Bp']) {
    const s = T[k].windows[w];
    L.push(`| ${k} ${T[k].label} | ${WN[w]} | ${s.n} | ${(s.win * 100).toFixed(1)} % | ${sg(s.netR)} | ${sg(s.grossR)} | ${sg(s.netSpreadR)} | ${sg(s.net2R)} | ${s.costR.toFixed(3)} | ${sg2(s.total)} | ${sg2(s.t)} | ${sg2(s.grossT)} | ${s.stops} / ${s.targets} / ${s.time} | ${sg2(s.maxDD)} |`);
  }
  L.push('', '## Placebo (window B, a random side each day, 40 seeds)', '', '| Test | Real net R/trade | Placebo median | Placebo 95th percentile |', '|---|---|---|---|');
  for (const k of ks) L.push(`| ${k} ${T[k].label} | ${sg(T[k].windows.B.netR)} | ${sg(T[k].placebo.median)} | ${sg(T[k].placebo.p95)} |`);
  const mks = Object.keys(mk);
  L.push('', '## By year (net R a trade, n)', '', '| Year | ' + mks.join(' | ') + ' |', '|---' + '|---'.repeat(mks.length) + '|');
  const yrs = [...new Set(mks.flatMap((k) => Object.keys(mk[k].byYear)))].sort();
  for (const y of yrs) L.push(`| ${y} | ` + mks.map((k) => { const b = mk[k].byYear[y]; return b ? `${sg(b.netR)} (${b.n})` : '—'; }).join(' | ') + ' |');
  L.push('', '## Data, days and costs', '');
  for (const k of mks) {
    const s = mk[k].skips, M = mk[k];
    L.push(`- ${k} (${M.name}, open ${M.open} local, close ${M.close}): ${M.candles} OANDA mid M5 candles ${M.from} → ${M.to}; ${M.trades} trades; cost ${M.costPts} points round trip ` +
      `(spread only ${M.spreadPts}); median risk 2021 on ${M.medianRiskB} points; days skipped: ${s.holiday} exchange holidays, ${s.early} early closes, ${s.missing} with the first or entry candle missing, ` +
      `${s.doji} doji, ${s.norisk} with the entry at or past the stop.`);
  }
  if (R.notes && R.notes.length) L.push('', '## Notes', '', ...R.notes.map((n) => `- ${n}`));
  L.push('', 'To repeat: `node --use-env-proxy research/edge/intl-index-orb/fetch.mjs <dir>`, then `node research/edge/intl-index-orb/run.mjs <dir>`.', '');
  return L.join('\n');
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candle dir>');
  const runs = {}, markets = {};
  for (const k of Object.keys(MARKETS)) {
    const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${k}-5m.json.gz`))));
    const endDay = new Date(rows.at(-1)[0] * 1000).toISOString().slice(0, 10);
    runs[k] = runMarket(rows, k, endDay);
    const M = MARKETS[k], hm = ([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, x = runs[k];
    markets[k] = { name: M.name, open: hm(M.open), close: hm(M.close) + (M.close2 ? `, ${hm(M.close2.at)} from ${M.close2.from}` : ''), candles: x.candles, from: x.from, to: x.to,
      costPts: x.costPts, spreadPts: x.spreadPts, skips: x.skips, trades: x.trades.length, byYear: summary(x.trades).byYear,
      medianRiskB: summary(x.trades.filter((t) => inW(t.day, WINDOWS.B))).medianRiskPts };
  }
  const tests = {};
  for (const [id, label, keys] of TESTS) {
    const t = testOf(runs, keys);
    tests[id] = { label, markets: keys, windows: Object.fromEntries(Object.entries(t.windows).map(([w, s]) => { const { byYear, ...rest } = s; return [w, rest]; })), placebo: t.placebo };
    console.log(id, label, JSON.stringify(tests[id].windows.B), 'A', tests[id].windows.A.netR, 'placebo', t.placebo.p95);
  }
  const decision = decide(tests);
  const f = path.join(HERE, 'result.json'), old = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
  const result = { study: 'intl-index-orb', built: '2026-11-14', preregistration: 'research/edge/intl-index-orb/PREREGISTRATION.md', source: 'orb-nas100 (branch orb-nas100), rule unchanged',
    rule: 'side of the first M5 candle after the local cash open (doji = no trade); entry at the next candle\'s open; stop at the other end of the first candle; target 10R; stop first when one candle holds both; out at the last candle before the local cash close',
    verdict: headline(tests, decision), decision, tests, markets, reading: old.reading || '', notes: old.notes || [] };
  fs.writeFileSync(f, JSON.stringify(result, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(result));
  console.log('verdict', result.verdict, result.verdict.length);
}
