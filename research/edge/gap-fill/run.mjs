// Edge research · gap-fill: fade the 09:30 New York opening gap on OANDA NAS100 and SPX500 M5 candles, as fixed in
// PREREGISTRATION.md. Pure pieces are exported for tests/gap-fill.test.mjs.
//   node --use-env-proxy research/edge/gap-fill/fetch.mjs <dir>    (candles, out of git; the orb-nas100 files)
//   node research/edge/gap-fill/run.mjs <dir>                       (writes result.json and RESULT.md)
// The calendar (nthWd, nyOffsetH, nyTime, nyse, dayKind), the seeded generator and the month-sum t / Holm / quantile helpers
// are the ones of research/edge/orb-nas100/run.mjs, written out here because that study was not on main when this one was
// written; tests/gap-fill.test.mjs compares them with that file whenever it is present.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

export const COST = { nas100: 2, spx500: 1 };
export const BAND = [0.0015, 0.01];
export const WINDOWS = { A: ['2016-01-01', '2020-12-31'], B: ['2021-01-01', '2099-12-31'] };
export const BUCKETS = [[0, 0.0015], [0.0015, 0.003], [0.003, 0.005], [0.005, 0.01], [0.01, Infinity]];
export const SEEDS = 40;
export const RULES = ['all', 'against'];
const DAY = 86400, M5 = 300;

// ─── calendar (as orb-nas100) ───
const ymd = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const utcDay = (y, m, d) => Date.UTC(y, m, d) / 1000;
const wdOf = (y, m, d) => new Date(Date.UTC(y, m, d)).getUTCDay();
export function nthWd(y, m, wd, n) {
  if (n > 0) { const f = wdOf(y, m, 1); return 1 + ((wd - f + 7) % 7) + 7 * (n - 1); }
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(), l = wdOf(y, m, last);
  return last - ((l - wd + 7) % 7);
}
export function nyOffsetH(t) {
  const y = new Date(t * 1000).getUTCFullYear();
  const on = utcDay(y, 2, nthWd(y, 2, 0, 2)) + 7 * 3600;
  const off = utcDay(y, 10, nthWd(y, 10, 0, 1)) + 6 * 3600;
  return t >= on && t < off ? -4 : -5;
}
export function nyTime(y, m, d, hh, mm) {
  const local = utcDay(y, m, d) + (hh * 60 + mm) * 60;
  return local - nyOffsetH(local + 5 * 3600) * 3600;
}
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7, mm = Math.floor((a + 11 * h + 22 * l) / 451);
  return [Math.floor((h + l - 7 * mm + 114) / 31) - 1, ((h + l - 7 * mm + 114) % 31) + 1];
}
const shift = (y, m, d, k) => { const x = new Date(Date.UTC(y, m, d + k)); return ymd(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()); };
function observed(y, m, d, satToFri = true) { const w = wdOf(y, m, d); return w === 6 ? (satToFri ? shift(y, m, d, -1) : null) : w === 0 ? shift(y, m, d, 1) : ymd(y, m, d); }
const SPECIAL = ['2018-12-05', '2025-01-09'];
const CACHE = new Map();
export function nyse(y) {
  if (CACHE.has(y)) return CACHE.get(y);
  const closed = new Set([observed(y, 0, 1, false), ymd(y, 0, nthWd(y, 0, 1, 3)), ymd(y, 1, nthWd(y, 1, 1, 3)), shift(y, ...easter(y), -2),
    ymd(y, 4, nthWd(y, 4, 1, -1)), observed(y, 6, 4), ymd(y, 8, nthWd(y, 8, 1, 1)), ymd(y, 10, nthWd(y, 10, 4, 4)), observed(y, 11, 25),
    ...SPECIAL.filter((s) => s.startsWith(String(y)))].filter(Boolean));
  if (y >= 2022) closed.add(observed(y, 5, 19));
  const early = new Set([shift(y, 10, nthWd(y, 10, 4, 4), 1)]);
  const w3 = wdOf(y, 6, 3); if (w3 >= 1 && w3 <= 4) early.add(ymd(y, 6, 3));
  const w24 = wdOf(y, 11, 24); if (w24 >= 1 && w24 <= 4) early.add(ymd(y, 11, 24));
  const r = { closed, early }; CACHE.set(y, r); return r;
}
export function dayKind(y, m, d) {
  const w = wdOf(y, m, d); if (w === 0 || w === 6) return 'weekend';
  const c = nyse(y), s = ymd(y, m, d);
  return c.closed.has(s) ? 'holiday' : c.early.has(s) ? 'early' : 'trade';
}

// ─── one day ───
// the close of the last candle starting before 16:00 New York on (y, m, d); and the 09:30 open
export function closeOf(bars, y, m, d) {
  const a = nyTime(y, m, d, 9, 30);
  for (let t = nyTime(y, m, d, 16, 0) - M5; t >= a; t -= M5) { const b = bars.get(t); if (b) return b[4]; }
  return null;
}
export const openOf = (bars, y, m, d) => { const b = bars.get(nyTime(y, m, d, 9, 30)); return b ? b[1] : null; };

// the gap of a day from the previous session's close: reads only candles up to today's 09:30 open
export function gapOf(bars, prev, cur) {
  const P = closeOf(bars, ...prev), O = openOf(bars, ...cur);
  if (P == null || O == null) return null;
  const po = openOf(bars, ...prev);
  return { P, O, g: O - P, size: Math.abs(O - P) / P, prevDir: po == null || P === po ? 0 : Math.sign(P - po) };
}

// one faded trade: side +1 buy / -1 sell, entry at the 09:35 open, target / stop at distance dist; stop first in one candle
export function simTrade(bars, y, m, d, side, entry, dist, cost = 0) {
  const target = entry + side * dist, stop = entry - side * dist, t35 = nyTime(y, m, d, 9, 35), tEnd = nyTime(y, m, d, 16, 0);
  let exit = null, how = null, last = null;
  for (let t = t35; t < tEnd; t += M5) {
    const b = bars.get(t); if (!b) continue; last = b;
    const [, o, h, l] = b;
    if (side * (o - stop) <= 0) { exit = o; how = 'stop'; break; }
    if (side * (o - target) >= 0) { exit = o; how = 'target'; break; }
    const hitS = side > 0 ? l <= stop : h >= stop, hitT = side > 0 ? h >= target : l <= target;
    if (hitS) { exit = stop; how = 'stop'; break; }
    if (hitT) { exit = target; how = 'target'; break; }
  }
  if (exit == null) { exit = last[4]; how = 'time'; }
  const R = side * (exit - entry) / dist;
  return { day: ymd(y, m, d), side, entry, stop, target, r: dist, exit, how, R, net: R - cost / dist };
}

// the rule on one day → { skip } or a trade (with `against`)
export function dayTrade(bars, prev, cur, { cost = 0, side = null } = {}) {
  const G = gapOf(bars, prev, cur); if (!G) return { skip: 'missing' };
  if (G.size < BAND[0] || G.size > BAND[1]) return { skip: 'band' };
  const E = bars.get(nyTime(...cur, 9, 35)); if (!E) return { skip: 'missing' };
  const fade = -Math.sign(G.g), entry = E[1], dist = fade * (G.P - entry);
  if (!(dist > 0)) return { skip: 'filled' };
  const x = simTrade(bars, ...cur, side ?? fade, entry, dist, cost);
  return { ...x, gapPct: G.size * 100, fade, against: G.prevDir !== 0 && Math.sign(G.g) === -G.prevDir };
}

// did price trade back to the previous close between 09:30 and the last candle before 16:00?
export function filled(bars, cur, P, O) {
  if (O === P) return true;
  const a = nyTime(...cur, 9, 30), e = nyTime(...cur, 16, 0);
  for (let t = a; t < e; t += M5) { const b = bars.get(t); if (b && (O > P ? b[3] <= P : b[2] >= P)) return true; }
  return false;
}

// ─── statistics (as orb-nas100) ───
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const sdv = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : NaN; };
export function monthT(trades, key = 'net') {
  const by = new Map(); for (const x of trades) { const k = x.day.slice(0, 7); by.set(k, (by.get(k) || 0) + x[key]); }
  const v = [...by.values()], s = sdv(v);
  return { months: v.length, t: v.length > 1 && s > 0 ? mean(v) / (s / Math.sqrt(v.length)) : 0 };
}
export function normP(t) {
  const z = t / Math.SQRT2, a = Math.abs(z), k = 1 / (1 + 0.3275911 * a);
  const erf = 1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-a * a);
  return 0.5 * (1 - (z >= 0 ? erf : -erf));
}
export function quantile(v, q) { const s = [...v].sort((a, b) => a - b), i = q * (s.length - 1), lo = Math.floor(i); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo); }
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = Array(ps.length); let run = 0;
  o.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (ps.length - k) * p)); out[i] = run; });
  return out;
}
const r3 = (v) => Math.round(v * 1000) / 1000, r2 = (v) => Math.round(v * 100) / 100;
export function summary(tr) {
  const net = tr.map((x) => x.net), mt = monthT(tr), gt = monthT(tr, 'R');
  let eq = 0, pk = 0, dd = 0; for (const v of net) { eq += v; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  const byYear = {}; for (const x of tr) { const y = x.day.slice(0, 4); (byYear[y] ||= { n: 0, net: 0 }); byYear[y].n++; byYear[y].net += x.net; }
  for (const y in byYear) byYear[y] = { n: byYear[y].n, netR: r3(byYear[y].net / byYear[y].n), total: r2(byYear[y].net) };
  const rs = tr.map((x) => x.r).sort((a, b) => a - b);
  return { n: tr.length, win: r3(tr.filter((x) => x.net > 0).length / (tr.length || 1)), netR: r3(mean(net)), grossR: r3(mean(tr.map((x) => x.R))),
    costR: r3(mean(tr.map((x) => x.R - x.net))), total: r2(net.reduce((s, v) => s + v, 0)), months: mt.months, t: r2(mt.t), grossT: r2(gt.t),
    stops: tr.filter((x) => x.how === 'stop').length, targets: tr.filter((x) => x.how === 'target').length, time: tr.filter((x) => x.how === 'time').length,
    maxDD: r2(dd), medianRiskPts: rs.length ? r2(rs[Math.floor(rs.length / 2)]) : null, longs: tr.filter((x) => x.side > 0).length, byYear };
}

// ─── a market ───
export function sessions(from, to) { // [y, m, d, kind] of every NYSE session (full or early) from → to
  const out = [];
  for (let t = Date.parse(from + 'T00:00:00Z') / 1000; t <= Date.parse(to + 'T00:00:00Z') / 1000; t += DAY) {
    const x = new Date(t * 1000), y = x.getUTCFullYear(), m = x.getUTCMonth(), d = x.getUTCDate(), k = dayKind(y, m, d);
    if (k === 'trade' || k === 'early') out.push([y, m, d, k]);
  }
  return out;
}
const inW = (day, [a, b]) => day >= a && day <= b;
const bucketOf = (s) => BUCKETS.findIndex(([a, b]) => s >= a && s < b);
export function runMarket(rows, mk, endDay) {
  const bars = new Map(rows.map((r) => [r[0], r])), cost = COST[mk], S = sessions('2015-12-01', endDay);
  const trades = [], skips = { early: 0, prevEarly: 0, missing: 0, band: 0, filled: 0 };
  const fill = Object.fromEntries(Object.keys(WINDOWS).map((w) => [w, BUCKETS.map(() => ({ days: 0, filled: 0 }))]));
  for (let i = 1; i < S.length; i++) {
    const [y, m, d, k] = S[i], day = ymd(y, m, d); if (day < '2016-01-01') continue;
    if (k === 'early') { skips.early++; continue; }
    if (S[i - 1][3] === 'early') { skips.prevEarly++; continue; }
    const prev = S[i - 1].slice(0, 3), cur = [y, m, d];
    const G = gapOf(bars, prev, cur);
    if (G) for (const w of Object.keys(WINDOWS)) if (inW(day, WINDOWS[w])) { const c = fill[w][bucketOf(G.size)]; c.days++; if (filled(bars, cur, G.P, G.O)) c.filled++; }
    const x = dayTrade(bars, prev, cur, { cost }); if (x.skip) { skips[x.skip]++; continue; }
    trades.push({ ...x, prev, cur });
  }
  const tests = {};
  for (const rule of RULES) {
    const tr = trades.filter((x) => rule === 'all' || x.against);
    const windows = Object.fromEntries(Object.entries(WINDOWS).map(([w, ab]) => [w, summary(tr.filter((x) => inW(x.day, ab)))]));
    const placebo = [];
    for (let seed = 1; seed <= SEEDS; seed++) {
      const rand = rng(seed), pt = [];
      for (const x of tr) { const s = rand() < 0.5 ? 1 : -1; if (!inW(x.day, WINDOWS.B)) continue; pt.push(simTrade(bars, ...x.cur, s, x.entry, x.r, cost)); }
      placebo.push(r3(mean(pt.map((p) => p.net))));
    }
    const { byYear, ...wB } = windows.B, { byYear: yA, ...wA } = windows.A;
    tests[rule] = { windows: { A: wA, B: wB }, byYear: summary(tr).byYear,
      placebo: { seeds: SEEDS, p95: r3(quantile(placebo, 0.95)), median: r3(quantile(placebo, 0.5)), values: placebo } };
  }
  const fillRate = Object.fromEntries(Object.entries(fill).map(([w, bs]) => [w, bs.map((c, i) => ({ from: BUCKETS[i][0] * 100, to: BUCKETS[i][1] === Infinity ? null : BUCKETS[i][1] * 100,
    days: c.days, filled: c.filled, rate: c.days ? r3(c.filled / c.days) : null }))]));
  return { candles: rows.length, from: new Date(rows[0][0] * 1000).toISOString().slice(0, 10), to: new Date(rows.at(-1)[0] * 1000).toISOString().slice(0, 10),
    costPts: cost, skips, trades: trades.length, against: trades.filter((x) => x.against).length, tests, fillRate };
}
export function decide(markets) {
  const keys = []; for (const mk of Object.keys(markets)) for (const rule of RULES) keys.push([mk, rule]);
  const ps = keys.map(([mk, rule]) => normP(markets[mk].tests[rule].windows.B.t)), adj = holm(ps), out = {};
  keys.forEach(([mk, rule], i) => {
    const T = markets[mk].tests[rule], B = T.windows.B, A = T.windows.A;
    const checks = { positive: B.netR > 0, t2: B.t >= 2, holm: adj[i] <= 0.05, n150: B.n >= 150, replicates: A.netR > 0, placebo: B.netR > T.placebo.p95 };
    out[`${mk}/${rule}`] = { p: r3(ps[i]), pHolm: r3(adj[i]), checks, pass: Object.values(checks).every(Boolean) };
  });
  return { byTest: out, verdict: Object.values(out).some((x) => x.pass) ? 'PASS' : 'FAIL' };
}

const sg = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(3);
const sg2 = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2);
const yn = (b) => (b ? 'yes' : 'no');
const RN = { all: 'every gap 0.15-1.0 %', against: 'gaps against the prior day' };
export function headline(markets, D) {
  const np = Object.values(D.byTest).filter((x) => x.pass).length, n = Object.keys(D.byTest).length;
  return `${D.verdict}: ${np} of ${n} tests pass in 2021 → now; ` + Object.keys(markets).map((mk) => { const B = markets[mk].tests.all.windows.B;
    return `${mk.toUpperCase()} fade of every gap ${sg(B.netR)}R a trade net (n ${B.n}, monthly t ${sg2(B.t)}, gross ${sg(B.grossR)}R)`; }).join(', ');
}

// ─── report (RESULT.md is this function of result.json) ───
export function report(R) {
  const L = [], mk = R.markets, D = R.decision, ks = Object.keys(mk);
  L.push('# Fading the opening gap on NAS100 and SPX500', '');
  L.push('Paper research only. No live rule, size, filter, stop, config or council member changed; ICT not involved. The rule, costs,');
  L.push('windows, placebo and pass bar were committed first (`PREREGISTRATION.md`). This page is written by `run.mjs` from `result.json`.', '');
  L.push(`## Verdict: ${R.verdict}`, '');
  for (const k of ks) for (const rule of RULES) {
    const T = mk[k].tests[rule], B = T.windows.B, A = T.windows.A, d = D.byTest[`${k}/${rule}`];
    L.push(`- **${k.toUpperCase()}, ${RN[rule]}**, 2021 → ${mk[k].to} (decides): ${sg(B.netR)}R a trade net of ${mk[k].costPts} point${mk[k].costPts > 1 ? 's' : ''} ` +
      `(n ${B.n}, t ${sg2(B.t)} on ${B.months} monthly sums; before costs ${sg(B.grossR)}R); 2016-20 ${sg(A.netR)}R (n ${A.n}); placebo 95th percentile ${sg(T.placebo.p95)}R; ` +
      `Holm p ${d.pHolm.toFixed(3)}. Net > 0: ${yn(d.checks.positive)}; t ≥ 2: ${yn(d.checks.t2)}; Holm: ${yn(d.checks.holm)}; n ≥ 150: ${yn(d.checks.n150)}; ` +
      `2016-20 positive: ${yn(d.checks.replicates)}; beats the placebo: ${yn(d.checks.placebo)} → **${d.pass ? 'pass' : 'fail'}**.`);
  }
  if (R.reading) L.push('', R.reading);
  L.push('', '## How often the gap fills (descriptive, no test)', '', 'Share of trading days on which price traded back to the previous 16:00 close between 09:30 and 16:00 New York, by gap size.', '',
    '| Market | Window | ' + BUCKETS.map(([a, b]) => b === Infinity ? `over ${(a * 100).toFixed(2)} %` : `${(a * 100).toFixed(2)}-${(b * 100).toFixed(2)} %`).join(' | ') + ' |', '|---|---' + '|---'.repeat(BUCKETS.length) + '|');
  const WF = { A: '2016-2020', B: '2021 → now' };
  for (const k of ks) for (const w of ['A', 'B']) L.push(`| ${k.toUpperCase()} | ${WF[w]} | ` + mk[k].fillRate[w].map((c) => c.days ? `${(c.rate * 100).toFixed(1)} % (${c.days})` : '—').join(' | ') + ' |');
  L.push('', '## Windows', '', '| Market | Rule | Window | n | Win | Net R/trade | Gross R/trade | Cost R/trade | Total R | t (months) | Stops / targets / time | Max DD R | Median risk (pts) |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  const WN = { A: '2016-2020 (replication)', B: '2021 → now (decides)' };
  for (const k of ks) for (const rule of RULES) for (const w of ['A', 'B']) {
    const s = mk[k].tests[rule].windows[w];
    L.push(`| ${k.toUpperCase()} | ${RN[rule]} | ${WN[w]} | ${s.n} | ${(s.win * 100).toFixed(1)} % | ${sg(s.netR)} | ${sg(s.grossR)} | ${s.costR.toFixed(3)} | ${sg2(s.total)} | ${sg2(s.t)} | ${s.stops} / ${s.targets} / ${s.time} | ${sg2(s.maxDD)} | ${s.medianRiskPts} |`);
  }
  L.push('', '## Placebo (window B, a random side each traded day, same distance, 40 seeds)', '', '| Market | Rule | Real net R/trade | Placebo median | Placebo 95th percentile |', '|---|---|---|---|---|');
  for (const k of ks) for (const rule of RULES) { const T = mk[k].tests[rule]; L.push(`| ${k.toUpperCase()} | ${RN[rule]} | ${sg(T.windows.B.netR)} | ${sg(T.placebo.median)} | ${sg(T.placebo.p95)} |`); }
  L.push('', '## By year (net R a trade, n; every gap 0.15-1.0 %)', '', '| Year | ' + ks.map((k) => k.toUpperCase()).join(' | ') + ' |', '|---' + '|---'.repeat(ks.length) + '|');
  const yrs = [...new Set(ks.flatMap((k) => Object.keys(mk[k].tests.all.byYear)))].sort();
  for (const y of yrs) L.push(`| ${y} | ` + ks.map((k) => { const b = mk[k].tests.all.byYear[y]; return b ? `${sg(b.netR)} (${b.n})` : '—'; }).join(' | ') + ' |');
  L.push('', '## Data and days', '');
  for (const k of ks) {
    const s = mk[k].skips;
    L.push(`- ${k.toUpperCase()}: ${mk[k].candles} OANDA mid M5 candles ${mk[k].from} → ${mk[k].to}; ${mk[k].trades} trades (${mk[k].against} against the prior day); days skipped: ` +
      `${s.early} early closes, ${s.prevEarly} after an early close, ${s.missing} with a needed candle missing, ${s.band} with the gap outside 0.15-1.0 %, ${s.filled} with the gap already filled at 09:35.`);
  }
  if (R.notes && R.notes.length) L.push('', '## Notes', '', ...R.notes.map((n) => `- ${n}`));
  L.push('', 'To repeat: `node --use-env-proxy research/edge/gap-fill/fetch.mjs <dir>`, then `node research/edge/gap-fill/run.mjs <dir>`.', '');
  return L.join('\n');
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candle dir>');
  const markets = {};
  for (const k of ['nas100', 'spx500']) {
    const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${k}-5m.json.gz`))));
    markets[k] = runMarket(rows, k, new Date(rows.at(-1)[0] * 1000).toISOString().slice(0, 10));
    for (const r of RULES) console.log(k, r, JSON.stringify(markets[k].tests[r].windows.B), 'placebo p95', markets[k].tests[r].placebo.p95);
  }
  const decision = decide(markets);
  const f = path.join(HERE, 'result.json'), old = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
  const result = { study: 'gap-fill', built: '2026-11-13', preregistration: 'research/edge/gap-fill/PREREGISTRATION.md',
    claim: 'the gap between the previous 16:00 New York close and the 09:30 open tends to fill during the session',
    rule: 'gap 0.15-1.0 % of price; enter at the 09:35 open against the gap; target the previous close; stop the same distance beyond the entry (1R); stop first when one candle holds both; out at the 15:55 candle close; variant: only gaps against the prior session',
    verdict: headline(markets, decision), decision, markets, reading: old.reading || '', notes: old.notes || [] };
  fs.writeFileSync(f, JSON.stringify(result, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(result));
  console.log('verdict', decision.verdict);
}
