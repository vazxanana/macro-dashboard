// Edge research · gold-vol-breakout: the intraday volatility breakout (buy stop at the UTC open + k × the previous day's range,
// sell stop at the open − k × that range, stop back at the open, out at 21:00 UTC) on OANDA spot gold M5, as fixed in
// PREREGISTRATION.md. Pure pieces are exported for tests/gold-vol-breakout.test.mjs. Only council/fills.mjs (foldWeekend,
// nights, FIN; read only) is imported.
//   node research/edge/gold-vol-breakout/run.mjs <dir>   (<dir>/xau-5m-vol.json.gz, OANDA mid M5 rows [t,o,h,l,c,v], out of git;
//                                                         writes result.json and RESULT.md)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

export const COST = 0.60;                                   // $ a round trip per ounce (spread + slippage)
export const EXIT_S = 21 * 3600, OPEN_WIN = 3600, MIN_BARS = 200, SMA_N = 20;
export const TESTS = {
  T1: { name: 'k 0.5, both sides', k: 0.5, sides: 'both' },
  T2: { name: 'k 0.7, both sides', k: 0.7, sides: 'both' },
  T3: { name: 'k 0.5, buys only, previous D1 close above its 20-day mean', k: 0.5, sides: 'buy', trend: true },
};
export const WINDOWS = { IS: ['2016-01-01', '2020-12-31'], OOS: ['2021-01-01', '2026-12-31'] };
export const SEEDS = 40, PLACEBO = { from: 1 * 3600, to: 18 * 3600 };
const DAY = 86400;
const ymdOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);

// ─── days: folded D1 from the M5 candles, and each weekday's 00:00-20:55 UTC candles ───
export function buildDays(rows) {
  const byDay = new Map();
  for (const r of rows) { const d0 = Math.floor(r[0] / DAY) * DAY; if (!byDay.has(d0)) byDay.set(d0, []); byDay.get(d0).push(r); }
  const keys = [...byDay.keys()].sort((a, b) => a - b), d1 = [];
  for (const d0 of keys) {
    const rs = byDay.get(d0);
    d1.push({ time: d0, open: rs[0][1], high: Math.max(...rs.map((r) => r[2])), low: Math.min(...rs.map((r) => r[3])), close: rs.at(-1)[4] });
  }
  const folded = foldWeekend(d1), idx = new Map(folded.map((b, i) => [b.time, i])), days = [];
  for (const d0 of keys) {
    const i = idx.get(d0); if (i === undefined) continue;          // weekend: folded into the next weekday
    const bars = byDay.get(d0).filter((r) => r[0] - d0 < EXIT_S).map((r) => ({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4] }));
    const prev = i > 0 ? folded[i - 1] : null;
    let trendUp = null;
    if (i >= SMA_N) { const cl = folded.slice(i - SMA_N, i).map((b) => b.close); trendUp = prev.close > cl.reduce((s, v) => s + v, 0) / SMA_N; }
    days.push({ day: ymdOf(d0), d0, bars, prevRange: prev ? prev.high - prev.low : null, trendUp });
  }
  return days;
}

// why a day cannot trade (null = it can)
export function daySkip(d) {
  if (d.prevRange == null) return 'noprev';
  if (!(d.prevRange > 0)) return 'flatprev';
  if (!d.bars.length || d.bars[0].t - d.d0 >= OPEN_WIN) return 'noopen';
  if (d.bars.length < MIN_BARS) return 'thin';
  return null;
}

// ─── one day, one rule ───
// bars: the day's 00:00-20:55 UTC candles in time order ({t,o,h,l,c}); opt: { k, sides 'both' | 'buy', prevRange, cost }
function close(side, entry, stop, exit, fillT, exitT, how, cost) {
  const r = Math.abs(entry - stop), R = side * (exit - entry) / r;
  const n = side > 0 ? nights(fillT, exitT) : 0, fin = side > 0 ? n * FIN.xau.long * entry / r : 0;
  return { side, entry, stop, r, exit, how, R, nights: n, finR: fin, net: R - cost / r - fin, net2: R - 2 * cost / r - 2 * fin };
}
// walk an open position from candle j (the fill candle is checked by the caller)
function walk(bars, j, side, stop) {
  for (let i = j; i < bars.length; i++) {
    const b = bars[i];
    if (side * (b.o - stop) <= 0) return { exit: b.o, how: 'stop', t: b.t };
    if (side > 0 ? b.l <= stop : b.h >= stop) return { exit: stop, how: 'stop', t: b.t };
  }
  const b = bars.at(-1); return { exit: b.c, how: 'time', t: b.t + 300 };
}
export function vbTrade(bars, { k, sides = 'both', prevRange, cost = COST } = {}) {
  if (!bars.length || !(prevRange > 0)) return { skip: 'input' };
  const O = bars[0].o, up = O + k * prevRange, dn = O - k * prevRange, both = sides === 'both';
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i], hitUp = b.h >= up, hitDn = both && b.l <= dn;
    if (!hitUp && !hitDn) continue;
    const side = hitUp && hitDn ? (Math.abs(up - b.o) <= Math.abs(b.o - dn) ? 1 : -1) : hitUp ? 1 : -1;
    const entry = side > 0 ? Math.max(up, b.o) : Math.min(dn, b.o), stop = O;
    let x;
    if (side > 0 ? b.l <= stop : b.h >= stop) x = { exit: stop, how: 'stop', t: b.t };   // worst case inside the fill candle
    else x = walk(bars, i + 1, side, stop);
    const fillT = b.t, res = close(side, entry, stop, x.exit, fillT, x.t, x.how, cost);
    return { open: O, up, dn, fillT, fillMin: (b.t - Math.floor(b.t / DAY) * DAY) / 60, ...res };
  }
  return { skip: 'nofill' };
}

// placebo: a market entry at the open of the candle starting at startT (side ±1), stop dist away, out at 21:00 or the stop
export function placeboTrade(bars, { startT, side, dist, cost = COST }) {
  const i = bars.findIndex((b) => b.t >= startT);
  if (i < 0 || !(dist > 0)) return null;
  const entry = bars[i].o, stop = entry - side * dist, x = walk(bars, i, side, stop);
  return close(side, entry, stop, x.exit, bars[i].t, x.t, x.how, cost);
}

// ─── statistics ───
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
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
export function summary(tr) {
  const net = tr.map((x) => x.net), mt = monthT(tr), gt = monthT(tr, 'R'), t2 = monthT(tr, 'net2');
  let eq = 0, pk = 0, dd = 0; for (const v of net) { eq += v; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  const byYear = {}; for (const x of tr) { const y = x.day.slice(0, 4); (byYear[y] ||= { n: 0, net: 0 }); byYear[y].n++; byYear[y].net += x.net; }
  for (const y in byYear) byYear[y] = { n: byYear[y].n, netR: r3(byYear[y].net / byYear[y].n), total: r2(byYear[y].net) };
  const rs = tr.map((x) => x.r).sort((a, b) => a - b), side = (s) => { const a = tr.filter((x) => x.side === s); return { n: a.length, netR: r3(mean(a.map((x) => x.net))) }; };
  return { n: tr.length, win: r3(tr.filter((x) => x.net > 0).length / (tr.length || 1)), netR: r3(mean(net)), grossR: r3(mean(tr.map((x) => x.R))),
    net2R: r3(mean(tr.map((x) => x.net2))), costR: r3(mean(tr.map((x) => x.R - x.net))), finR: r3(mean(tr.map((x) => x.finR))),
    total: r2(net.reduce((s, v) => s + v, 0)), months: mt.months, t: r2(mt.t), grossT: r2(gt.t), t2x: r2(t2.t),
    stops: tr.filter((x) => x.how === 'stop').length, time: tr.filter((x) => x.how === 'time').length, maxDD: r2(dd),
    medianStop: rs.length ? r2(rs[Math.floor(rs.length / 2)]) : null, buys: side(1), sells: side(-1), byYear };
}

// ─── the whole run ───
const inW = (day, [a, b]) => day >= a && day <= b;
export function eligible(days, test) {
  const out = [], skips = {};
  for (const d of days) {
    if (!inW(d.day, [WINDOWS.IS[0], WINDOWS.OOS[1]])) continue;
    const s = daySkip(d) || (test.trend && d.trendUp == null ? 'warmup' : null) || (test.trend && !d.trendUp ? 'trenddown' : null);
    if (s) { skips[s] = (skips[s] || 0) + 1; continue; }
    out.push(d);
  }
  return { out, skips };
}
export function runTest(days, test) {
  const { out, skips } = eligible(days, test), tr = [];
  for (const d of out) {
    const x = vbTrade(d.bars, { ...test, prevRange: d.prevRange });
    if (x.skip) skips[x.skip] = (skips[x.skip] || 0) + 1; else tr.push({ day: d.day, ...x });
  }
  return { tr, skips, days: out.length };
}
export function placebo(days, test, seeds = SEEDS) {
  const pool = eligible(days, test).out.filter((d) => inW(d.day, WINDOWS.OOS)), grid = (PLACEBO.to - PLACEBO.from) / 300 + 1, res = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const rand = rng(seed), tr = [];
    for (const d of pool) {
      const startT = d.d0 + PLACEBO.from + 300 * Math.floor(rand() * grid), coin = rand();
      const side = test.sides === 'buy' ? 1 : coin < 0.5 ? 1 : -1;
      const x = placeboTrade(d.bars, { startT, side, dist: test.k * d.prevRange }); if (x) tr.push(x);
    }
    res.push(r3(mean(tr.map((x) => x.net))));
  }
  return res;
}
export function decide(res, pl) {
  const ks = Object.keys(TESTS), ps = ks.map((k) => normP(res[k].OOS.t)), adj = holm(ps), d = {};
  ks.forEach((k, i) => {
    const o = res[k].OOS, is = res[k].IS, beaten = pl[k].filter((v) => o.netR > v).length;
    const checks = { netPos: o.netR > 0, t2: o.t >= 2, holm: adj[i] < 0.05, isPos: is.netR > 0, cost2x: o.net2R > 0, placebo: beaten >= 38, n30: o.n >= 30 };
    d[k] = { p: r3(ps[i]), pHolm: r3(adj[i]), placeboBeaten: beaten, checks, pass: Object.values(checks).every(Boolean) };
  });
  return d;
}

// ─── report (RESULT.md is this function of result.json) ───
const sg = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3));
const s2 = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2));
export function verdictLine(res, dec) {
  const n = Object.values(dec).filter((x) => x.pass).length, o = res.T1.OOS;
  return `${dec.T1.pass ? 'PASS' : 'FAIL'}, ${n} of 3: gold open ± 0.5 × prior range breakout 2021 → now ${sg(o.netR)}R a trade net (n ${o.n}, month t ${s2(o.t)}, gross ${sg(o.grossR)}R); 2016-20 ${sg(res.T1.IS.netR)}R`;
}
export function report(R) {
  const L = [], T = R.tests, yn = (b) => (b ? 'yes' : 'no');
  L.push('# Gold: the intraday volatility breakout (UTC open ± k × the previous day\'s range)', '');
  L.push('Paper research only. A new stand-alone intraday rule, not a gate, exit, entry or size of the live gold book (owner decision 44: none of the book\'s records read). Nothing live changed, no proposal. The rule, costs, windows, placebo and pass bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.', '');
  L.push(`**Verdict: ${R.verdict}**`, '');
  L.push('## Tests', '');
  L.push('| Test | Rule | Period | n | Win | Net R/trade | Gross R/trade | Net at 2x cost | Cost R/trade | Total R | t (months) | Gross t | Stops / time | Max DD R | Median stop $ |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const k of Object.keys(T)) for (const w of ['IS', 'OOS']) {
    const x = T[k][w];
    L.push(`| ${k} | ${T[k].name} | ${w === 'IS' ? '2016-2020' : `2021 → ${R.dataEnd}`} | ${x.n} | ${(x.win * 100).toFixed(1)} % | ${sg(x.netR)} | ${sg(x.grossR)} | ${sg(x.net2R)} | ${sg(x.costR)} | ${s2(x.total)} | ${s2(x.t)} | ${s2(x.grossT)} | ${x.stops} / ${x.time} | ${s2(x.maxDD)} | ${x.medianStop} |`);
  }
  L.push('', '## Decision (out of sample, Holm over the three tests)', '');
  L.push('| Test | p | Holm p | net > 0 | t ≥ 2 | Holm < 0.05 | in sample > 0 | 2x cost > 0 | placebos beaten (need 38 of 40) | n ≥ 30 | pass |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, d] of Object.entries(R.decision)) { const c = d.checks; L.push(`| ${k} | ${d.p} | ${d.pHolm} | ${yn(c.netPos)} | ${yn(c.t2)} | ${yn(c.holm)} | ${yn(c.isPos)} | ${yn(c.cost2x)} | ${d.placeboBeaten} | ${yn(c.n30)} | **${d.pass ? 'pass' : 'fail'}** |`); }
  L.push('', '## Placebo (out of sample, 40 seeds)', '', 'Every day the test could trade, one market entry at a random 5-minute mark 01:00-18:00 UTC, side by a fair coin (T3: buy), stop k × the previous day\'s range away, out at 21:00 UTC or the stop, the same costs.', '');
  L.push('| Test | Real net R a trade | Placebo median | Placebo 95th percentile | Placebo min / max |', '|---|---|---|---|---|');
  for (const k of Object.keys(T)) { const p = R.placebo[k]; L.push(`| ${k} | ${sg(T[k].OOS.netR)} | ${sg(p.median)} | ${sg(p.p95)} | ${sg(p.min)} / ${sg(p.max)} |`); }
  L.push('', '## Sides and skipped days', '');
  for (const k of Object.keys(T)) L.push(`- ${k}, 2021 → now: buys n ${T[k].OOS.buys.n} ${sg(T[k].OOS.buys.netR)}R, sells n ${T[k].OOS.sells.n} ${sg(T[k].OOS.sells.netR)}R; financing ${sg(T[k].OOS.finR)}R a trade; days without a trade, whole period: ${Object.entries(T[k].skips).map(([a, b]) => `${a} ${b}`).join(', ') || 'none'}.`);
  L.push('', '## By year (net R a trade, n)', '');
  const ys = [...new Set(Object.values(T).flatMap((x) => [...Object.keys(x.IS.byYear), ...Object.keys(x.OOS.byYear)]))].sort();
  L.push('| Year | ' + Object.keys(T).join(' | ') + ' |', '|---|' + Object.keys(T).map(() => '---|').join(''));
  for (const y of ys) L.push(`| ${y} | ` + Object.keys(T).map((k) => { const b = T[k].IS.byYear[y] || T[k].OOS.byYear[y]; return b ? `${sg(b.netR)} (${b.n})` : '—'; }).join(' | ') + ' |');
  L.push('', '## Reading', '', R.reading, '');
  L.push('## Data and method', '');
  L.push(`- ${R.data}`);
  L.push(`- Rule: ${R.rule}`);
  L.push(`- Costs: $${R.cost.toFixed(2)} a round trip per ounce (spread and slippage), 2x reported; financing \`FIN.xau.long\` × \`nights\` on buys (no trade crosses the 22:00 UTC rollover: 0).`);
  L.push('- To repeat: `node research/edge/gold-vol-breakout/run.mjs <dir>` with `<dir>/xau-5m-vol.json.gz` (OANDA mid M5 XAU/USD from the candle proxy, kept out of git).');
  return L.join('\n') + '\n';
}

// ─── main ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candleDir>');
  const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'xau-5m-vol.json.gz'))));
  rows.sort((a, b) => a[0] - b[0]);
  const lastFull = Math.floor(rows.at(-1)[0] / DAY) * DAY;                    // the forming last day is left out
  const days = buildDays(rows.filter((r) => r[0] < lastFull)), res = {}, pl = {};
  const dataEnd = ymdOf(lastFull - DAY);
  for (const [k, t] of Object.entries(TESTS)) {
    const { tr, skips, days: nd } = runTest(days, t);
    res[k] = { name: t.name, k: t.k, sides: t.sides, eligibleDays: nd, skips, IS: summary(tr.filter((x) => inW(x.day, WINDOWS.IS))), OOS: summary(tr.filter((x) => inW(x.day, WINDOWS.OOS))) };
    pl[k] = placebo(days, t);
  }
  const dec = decide(res, pl);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const o = res.T1.OOS, fail = (k) => Object.entries(dec[k].checks).filter(([, v]) => !v).map(([c]) => c).join(', ');
  const early = (() => { const ys = Object.entries(o.byYear).filter(([y]) => y < '2025'); const n = ys.reduce((a, [, b]) => a + b.n, 0); const tot = ys.reduce((a, [, b]) => a + b.total, 0); return { n, total: r2(tot), netR: r3(tot / n) }; })();
  const one = (k) => `${k} ${sg(res[k].OOS.netR)}R net (n ${res[k].OOS.n}, t ${s2(res[k].OOS.t)}; gross ${sg(res[k].OOS.grossR)}R, t ${s2(res[k].OOS.grossT)}; 2016-20 ${sg(res[k].IS.netR)}R; ${dec[k].placeboBeaten} of 40 placebos beaten${dec[k].pass ? ', passes' : `; failed: ${fail(k)}`})`;
  const reading = (dec.T1.pass ? 'T1 passes every pre-registered check. Paper research only; at most a proposal for the owner, with its own forward record. '
    : `The primary rule (T1) does not pass the pre-registered bar (failed: ${fail('T1')}). `)
    + `Out of sample: ${one('T1')}; ${one('T2')}; ${one('T3')}. Costs take ${sg(o.costR).replace('+', '')}R a trade on T1 at a median stop of $${o.medianStop}. `
    + `T1 by year out of sample: ${Object.entries(o.byYear).map(([y, b]) => `${y} ${sg(b.netR)}R`).join(', ')}; 2021-24 together ${s2(early.total)}R in all (n ${early.n}), so most of the out-of-sample gain is 2025-26, the years of gold's widest daily ranges. Before costs the rule leans the right way in both windows (gross month t ${s2(res.T1.IS.grossT)} in 2016-20, ${s2(o.grossT)} after), and it beats every placebo seed, but after costs the out-of-sample t is under 2 and in sample it is flat. `
    + (dec.T1.pass ? '' : 'Not an edge; nothing live changes and no proposal is written.')
    + ((!dec.T1.pass && (dec.T2.pass || dec.T3.pass)) ? ' A T2 or T3 pass alone is a hypothesis for its own pre-registration on other data, not an edge.' : '');
  const result = { study: 'gold-vol-breakout', built: '2026-11-14', preregistration: 'research/edge/gold-vol-breakout/PREREGISTRATION.md', planSha256: sha,
    claim: 'a move of k × the previous day\'s range away from the UTC open continues to 21:00 UTC on spot gold (volatility breakout, dual-thrust family)',
    rule: 'O = open of the first M5 candle 00:00-00:55 UTC; prevRange = high − low of the previous weekend-folded UTC D1; buy stop O + k × prevRange and sell stop O − k × prevRange live 00:00-20:55 UTC, first filled wins (a gap fills at the open; both in one candle: the level nearer its open); stop back at O (worst case in the fill candle); out at the 20:55 candle close; T1 k 0.5, T2 k 0.7, T3 k 0.5 buys only when the previous D1 close is above its 20-day mean',
    data: `OANDA mid XAU/USD M5 through the keyless candle proxy; ${days.length} weekdays built ${days[0].day} → ${days.at(-1).day}; D1 = complete UTC days folded with council/fills.mjs foldWeekend`,
    dataEnd, cost: COST, windows: { IS: WINDOWS.IS, OOS: [WINDOWS.OOS[0], dataEnd] }, verdict: verdictLine(res, dec), decision: dec, tests: res,
    placebo: Object.fromEntries(Object.keys(TESTS).map((k) => [k, { seeds: SEEDS, start: '01:00-18:00 UTC', means: pl[k], min: Math.min(...pl[k]), max: Math.max(...pl[k]), median: r3(quantile(pl[k], 0.5)), p95: r3(quantile(pl[k], 0.95)) }])),
    reading };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(result, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(result));
  console.log(result.verdict);
  for (const k of Object.keys(TESTS)) console.log(k, JSON.stringify({ IS: { n: res[k].IS.n, net: res[k].IS.netR, gross: res[k].IS.grossR, t: res[k].IS.t, gt: res[k].IS.grossT }, OOS: { n: res[k].OOS.n, net: res[k].OOS.netR, gross: res[k].OOS.grossR, t: res[k].OOS.t, gt: res[k].OOS.grossT, n2: res[k].OOS.net2R } }), dec[k].pHolm, dec[k].placeboBeaten, res[k].skips);
}
