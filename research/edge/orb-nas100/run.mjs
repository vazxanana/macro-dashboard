// Edge research · orb-nas100: the 5-minute opening range breakout (Zarattini, Barbon and Aziz) on OANDA NAS100 and SPX500
// M5 candles, as fixed in PREREGISTRATION.md. Pure pieces are exported for tests/orb-nas100.test.mjs.
//   node --use-env-proxy research/edge/orb-nas100/fetch.mjs <dir>    (candles, out of git)
//   node research/edge/orb-nas100/run.mjs <dir>                       (writes result.json and RESULT.md)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

export const COST = { nas100: 2, spx500: 1 };
export const TARGET_R = 10;
export const WINDOWS = { A: ['2016-01-01', '2020-12-31'], B: ['2021-01-01', '2099-12-31'], Bp: ['2023-03-01', '2099-12-31'] };
export const SEEDS = 40;
const DAY = 86400, M5 = 300;

// ─── calendar ───
const ymd = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const utcDay = (y, m, d) => Date.UTC(y, m, d) / 1000;
const wdOf = (y, m, d) => new Date(Date.UTC(y, m, d)).getUTCDay();
// day of the month of the nth weekday wd (0 Sunday) of month m (0-based); n = -1 is the last one
export function nthWd(y, m, wd, n) {
  if (n > 0) { const f = wdOf(y, m, 1); return 1 + ((wd - f + 7) % 7) + 7 * (n - 1); }
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(), l = wdOf(y, m, last);
  return last - ((l - wd + 7) % 7);
}
// New York offset from UTC in hours at unix time t (US rules since 2007)
export function nyOffsetH(t) {
  const y = new Date(t * 1000).getUTCFullYear();
  const on = utcDay(y, 2, nthWd(y, 2, 0, 2)) + 7 * 3600;    // 02:00 EST = 07:00 UTC, second Sunday of March
  const off = utcDay(y, 10, nthWd(y, 10, 0, 1)) + 6 * 3600; // 02:00 EDT = 06:00 UTC, first Sunday of November
  return t >= on && t < off ? -4 : -5;
}
// unix time of hh:mm New York on the date (y, m 0-based, d)
export function nyTime(y, m, d, hh, mm) {
  const local = utcDay(y, m, d) + (hh * 60 + mm) * 60;
  return local - nyOffsetH(local + 5 * 3600) * 3600;
}
function easter(y) { // anonymous Gregorian algorithm → [month 0-based, day]
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7, mm = Math.floor((a + 11 * h + 22 * l) / 451);
  return [Math.floor((h + l - 7 * mm + 114) / 31) - 1, ((h + l - 7 * mm + 114) % 31) + 1];
}
const shift = (y, m, d, k) => { const x = new Date(Date.UTC(y, m, d + k)); return ymd(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()); };
// Saturday → Friday (unless satToFri is false: New Year), Sunday → Monday
function observed(y, m, d, satToFri = true) { const w = wdOf(y, m, d); return w === 6 ? (satToFri ? shift(y, m, d, -1) : null) : w === 0 ? shift(y, m, d, 1) : ymd(y, m, d); }
const SPECIAL = ['2018-12-05', '2025-01-09'];
const CACHE = new Map();
// NYSE full holidays and early (13:00) closes of year y → { closed: Set, early: Set } of 'YYYY-MM-DD'
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
// bars: Map time → [t, o, h, l, c]. side: 1 buy, -1 sell, or null = F's colour. → { skip } or a trade record
export function dayTrade(bars, y, m, d, { cost = 0, side = null, targetR = TARGET_R } = {}) {
  const t0 = nyTime(y, m, d, 9, 30), tEnd = nyTime(y, m, d, 16, 0);
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
  return { t: t0, day: ymd(y, m, d), side: s, entry, stop, target, r, exit, how, R, net: R - cost / r };
}

// ─── statistics ───
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const sdv = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : NaN; };
// t of the calendar-month sums of x[key]
export function monthT(trades, key = 'net') {
  const by = new Map(); for (const x of trades) { const k = x.day.slice(0, 7); by.set(k, (by.get(k) || 0) + x[key]); }
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
export function days(from, to) {
  const out = [];
  for (let t = Date.parse(from + 'T00:00:00Z') / 1000; t <= Date.parse(to + 'T00:00:00Z') / 1000; t += DAY) { const x = new Date(t * 1000); out.push([x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()]); }
  return out;
}
const inW = (day, [a, b]) => day >= a && day <= b;
export function runMarket(rows, mk, endDay) {
  const bars = new Map(rows.map((r) => [r[0], r])), cost = COST[mk], all = [], eligible = [];
  const skips = { holiday: 0, early: 0, missing: 0, doji: 0, norisk: 0 };
  for (const [y, m, d] of days('2016-01-01', endDay)) {
    const k = dayKind(y, m, d); if (k === 'weekend') continue; if (k !== 'trade') { skips[k]++; continue; }
    const x = dayTrade(bars, y, m, d, { cost }); if (x.skip) { skips[x.skip]++; continue; }
    all.push(x); eligible.push([y, m, d]);
  }
  const windows = Object.fromEntries(Object.entries(WINDOWS).map(([w, ab]) => [w, summary(all.filter((x) => inW(x.day, ab)))]));
  const placebo = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    const rand = rng(seed), tr = [];
    for (const [y, m, d] of eligible) {
      const s = rand() < 0.5 ? 1 : -1;
      if (!inW(ymd(y, m, d), WINDOWS.B)) continue;
      const x = dayTrade(bars, y, m, d, { cost, side: s }); if (!x.skip) tr.push(x);
    }
    placebo.push(r3(mean(tr.map((x) => x.net))));
  }
  return { candles: rows.length, from: new Date(rows[0][0] * 1000).toISOString().slice(0, 10), to: new Date(rows.at(-1)[0] * 1000).toISOString().slice(0, 10),
    costPts: cost, skips, windows, placebo: { seeds: SEEDS, p95: r3(quantile(placebo, 0.95)), median: r3(quantile(placebo, 0.5)), values: placebo }, trades: all };
}
export function decide(markets) {
  const ks = Object.keys(markets), ps = ks.map((k) => normP(markets[k].windows.B.t)), adj = holm(ps), out = {};
  ks.forEach((k, i) => {
    const B = markets[k].windows.B, pl = markets[k].placebo.p95;
    const checks = { positive: B.netR > 0, t2: B.t >= 2, placebo: B.netR > pl, holm: adj[i] <= 0.05 };
    out[k] = { p: r3(ps[i]), pHolm: r3(adj[i]), checks, pass: Object.values(checks).every(Boolean) };
  });
  return { byMarket: out, verdict: Object.values(out).some((x) => x.pass) ? 'PASS' : 'FAIL' };
}

// the one-line verdict: class, then the decisive window of each market
export function headline(markets, decision) {
  const ks = Object.keys(markets), np = ks.filter((k) => decision.byMarket[k].pass).length;
  return `${decision.verdict}: ${np} of ${ks.length} markets pass in 2021 → now; ` + ks.map((k) => { const B = markets[k].windows.B;
    return `${k.toUpperCase()} ${sg(B.netR)}R a trade net (n ${B.n}, monthly t ${sg2(B.t)}, gross ${sg(B.grossR)}R)`; }).join(', ');
}

// ─── report (RESULT.md is this function of result.json) ───
const sg = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(3);
const sg2 = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2);
const yn = (b) => (b ? 'yes' : 'no');
export function report(R) {
  const L = [], mk = R.markets, D = R.decision, ks = Object.keys(mk);
  L.push('# The 5-minute opening range breakout on NAS100 and SPX500, out of sample', '');
  L.push('Paper research only. No live rule, size, filter, stop, config or council member changed; ICT not involved. The rule, costs,');
  L.push('windows, placebo and pass bar were committed first (`PREREGISTRATION.md`). This page is written by `run.mjs` from `result.json`.', '');
  L.push(`## Verdict: ${R.verdict}`, '');
  for (const k of ks) {
    const B = mk[k].windows.B, d = D.byMarket[k];
    L.push(`- **${k.toUpperCase()}**, 2021 → ${mk[k].to} (decides): ${sg(B.netR)}R a trade net of ${mk[k].costPts} point${mk[k].costPts > 1 ? 's' : ''} ` +
      `(n ${B.n}, t ${sg2(B.t)} on ${B.months} monthly sums; before costs ${sg(B.grossR)}R, t ${sg2(B.grossT)}); placebo 95th percentile ${sg(mk[k].placebo.p95)}R; ` +
      `Holm p ${d.pHolm.toFixed(3)}. Net > 0: ${yn(d.checks.positive)}; t ≥ 2: ${yn(d.checks.t2)}; beats the placebo: ${yn(d.checks.placebo)}; Holm: ${yn(d.checks.holm)} → **${d.pass ? 'pass' : 'fail'}**.`);
  }
  if (R.reading) L.push('', R.reading);
  L.push('', '## Windows', '', '| Market | Window | n | Win | Net R/trade | Gross R/trade | Cost R/trade | Total R | t (months) | Stops / targets / time | Max DD R | Median risk (pts) |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  const WN = { A: '2016-2020 (inside the paper)', B: '2021 → now (decides)', Bp: 'Mar 2023 → now (after the paper)' };
  for (const k of ks) for (const w of ['A', 'B', 'Bp']) {
    const s = mk[k].windows[w];
    L.push(`| ${k.toUpperCase()} | ${WN[w]} | ${s.n} | ${(s.win * 100).toFixed(1)} % | ${sg(s.netR)} | ${sg(s.grossR)} | ${s.costR.toFixed(3)} | ${sg2(s.total)} | ${sg2(s.t)} | ${s.stops} / ${s.targets} / ${s.time} | ${sg2(s.maxDD)} | ${s.medianRiskPts} |`);
  }
  L.push('', '## Placebo (window B, a random side each day, 40 seeds)', '', '| Market | Real net R/trade | Placebo median | Placebo 95th percentile |', '|---|---|---|---|');
  for (const k of ks) L.push(`| ${k.toUpperCase()} | ${sg(mk[k].windows.B.netR)} | ${sg(mk[k].placebo.median)} | ${sg(mk[k].placebo.p95)} |`);
  L.push('', '## By year (net R a trade, n)', '', '| Year | ' + ks.map((k) => k.toUpperCase()).join(' | ') + ' |', '|---' + '|---'.repeat(ks.length) + '|');
  const yrs = [...new Set(ks.flatMap((k) => Object.keys(mk[k].byYear)))].sort();
  for (const y of yrs) L.push(`| ${y} | ` + ks.map((k) => { const b = mk[k].byYear[y]; return b ? `${sg(b.netR)} (${b.n})` : '—'; }).join(' | ') + ' |');
  L.push('', '## Data and days', '');
  for (const k of ks) {
    const s = mk[k].skips;
    L.push(`- ${k.toUpperCase()}: ${mk[k].candles} OANDA mid M5 candles ${mk[k].from} → ${mk[k].to}; ${mk[k].trades} trades; days skipped: ${s.holiday} NYSE holidays, ${s.early} early closes, ` +
      `${s.missing} with the 09:30 or 09:35 candle missing, ${s.doji} doji, ${s.norisk} with the entry already at or past the stop.`);
  }
  if (R.notes && R.notes.length) L.push('', '## Notes', '', ...R.notes.map((n) => `- ${n}`));
  L.push('', 'To repeat: `node --use-env-proxy research/edge/orb-nas100/fetch.mjs <dir>`, then `node research/edge/orb-nas100/run.mjs <dir>`.', '');
  return L.join('\n');
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candle dir>');
  const markets = {};
  for (const k of ['nas100', 'spx500']) {
    const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${k}-5m.json.gz`))));
    const endDay = new Date(rows.at(-1)[0] * 1000).toISOString().slice(0, 10);
    const { trades, windows, ...rest } = runMarket(rows, k, endDay);
    markets[k] = { ...rest, windows: Object.fromEntries(Object.entries(windows).map(([w, s]) => { const { byYear, ...x } = s; return [w, x]; })), byYear: summary(trades).byYear, trades: trades.length };
    console.log(k, JSON.stringify(markets[k].windows), 'placebo', markets[k].placebo.median, markets[k].placebo.p95);
  }
  const decision = decide(markets);
  const f = path.join(HERE, 'result.json'), old = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
  const result = { study: 'orb-nas100', built: '2026-11-13', preregistration: 'research/edge/orb-nas100/PREREGISTRATION.md',
    claim: 'Zarattini, Barbon and Aziz (SSRN 2023/2024): 5-minute opening range breakout on QQQ, sample January 2016 to February 2023',
    rule: 'side of the 09:30-09:35 New York M5 candle (doji = no trade); entry at the 09:35 open; stop at the other end of that candle; target 10R; stop first when one candle holds both; out at the 15:55 candle close',
    verdict: headline(markets, decision), decision, markets, reading: old.reading || '', notes: old.notes || [] };
  fs.writeFileSync(f, JSON.stringify(result, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(result));
  console.log('verdict', decision.verdict);
}
