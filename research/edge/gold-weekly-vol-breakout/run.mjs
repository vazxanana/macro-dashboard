// Edge research · gold-weekly-vol-breakout: the weekly volatility breakout (buy stop at the week's open + k × the previous
// week's range, sell stop at the open − k × that range, stop back at the open, out at Friday 20:55 UTC) on OANDA spot gold M5,
// as fixed in PREREGISTRATION.md. Pure pieces are exported for tests/gold-weekly-vol-breakout.test.mjs. Only council/fills.mjs
// (nights, FIN; read only) is imported.
//   node research/edge/gold-weekly-vol-breakout/run.mjs <dir>   (<dir>/xau-5m.json.gz, OANDA mid M5 rows [t,o,h,l,c], out of
//                                                                git; writes result.json and RESULT.md)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { nights, FIN } from '../../../council/fills.mjs';

export const COST = 0.60;                                   // $ a round trip per ounce (spread + slippage)
export const MIN_BARS = 600;
export const TESTS = {
  T1: { name: 'k 0.5, both sides', k: 0.5, sides: 'both' },
  T2: { name: 'k 0.3, both sides', k: 0.3, sides: 'both' },
  T3: { name: 'k 0.5, buys only', k: 0.5, sides: 'buy' },
};
export const WINDOWS = { IS: ['2007-01-01', '2016-12-31'], OOS: ['2017-01-01', '2026-12-31'] };
export const SEEDS = 40;
const DAY = 86400;
const ymdOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
// Monday 00:00 UTC of the week a candle belongs to: Sunday belongs to the next Monday, Saturday to the previous one
export function mondayOf(t) {
  const d0 = Math.floor(t / DAY) * DAY, wd = new Date(d0 * 1000).getUTCDay();
  return wd === 0 ? d0 + DAY : d0 - ((wd + 6) % 7) * DAY;
}
// Friday 20:55 UTC candle start of the week of Monday m; placebo window ends Thursday 20:55
export const lastStart = (m) => m + 4 * DAY + 20 * 3600 + 55 * 60;
export const placeboEnd = (m) => m + 3 * DAY + 20 * 3600 + 55 * 60;

// ─── weeks ───
export function buildWeeks(rows) {
  const by = new Map();
  for (const r of rows) { const m = mondayOf(r[0]); if (!by.has(m)) by.set(m, []); by.get(m).push(r); }
  const keys = [...by.keys()].sort((a, b) => a - b), weeks = [];
  let prev = null;
  for (const m of keys) {
    const rs = by.get(m), all = rs.map((r) => ({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4] }));
    const bars = all.filter((b) => b.t <= lastStart(m));
    const range = { high: Math.max(...rs.map((r) => r[2])), low: Math.min(...rs.map((r) => r[3])), n: rs.length };
    const prevOk = prev && prev.m === m - 7 * DAY;
    weeks.push({ week: ymdOf(m), m, bars, prevRange: prevOk ? prev.high - prev.low : null, prevN: prevOk ? prev.n : 0 });
    prev = { m, ...range };
  }
  return weeks;
}
// why a week cannot trade (null = it can)
export function weekSkip(w) {
  if (w.prevRange == null) return 'noprev';
  if (w.prevN < MIN_BARS) return 'thinprev';
  if (!(w.prevRange > 0)) return 'flatprev';
  if (w.bars.length < MIN_BARS) return 'thin';
  return null;
}

// ─── one week, one rule ───
function close(side, entry, stop, exit, fillT, exitT, how, cost) {
  const r = Math.abs(entry - stop), R = side * (exit - entry) / r;
  const n = side > 0 ? nights(fillT, exitT) : 0, fin = side > 0 ? n * FIN.xau.long * entry / r : 0;
  return { side, entry, stop, r, exit, exitT, how, R, nights: n, finR: fin, net: R - cost / r - fin, net2: R - 2 * cost / r - 2 * fin };
}
function walk(bars, j, side, stop) {
  for (let i = j; i < bars.length; i++) {
    const b = bars[i];
    if (side * (b.o - stop) <= 0) return { exit: b.o, how: 'stop', t: b.t };
    if (side > 0 ? b.l <= stop : b.h >= stop) return { exit: stop, how: 'stop', t: b.t };
  }
  const b = bars.at(-1); return { exit: b.c, how: 'time', t: b.t + 300 };
}
// bars: the week's trading-window candles in time order ({t,o,h,l,c}); opt: { k, sides 'both' | 'buy', prevRange, cost }
export function wvbTrade(bars, { k, sides = 'both', prevRange, cost = COST } = {}) {
  if (!bars.length || !(prevRange > 0)) return { skip: 'input' };
  const O = bars[0].o, up = O + k * prevRange, dn = O - k * prevRange, both = sides === 'both';
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i], hitUp = b.h >= up, hitDn = both && b.l <= dn;
    if (!hitUp && !hitDn) continue;
    const side = hitUp && hitDn ? (Math.abs(up - b.o) <= Math.abs(b.o - dn) ? 1 : -1) : hitUp ? 1 : -1;
    const entry = side > 0 ? Math.max(up, b.o) : Math.min(dn, b.o), stop = O;
    let x;
    if (side > 0 ? b.l <= stop : b.h >= stop) x = { exit: stop, how: 'stop', t: b.t };   // fill and stop in one candle: the stop
    else x = walk(bars, i + 1, side, stop);
    return { open: O, up, dn, fillT: b.t, ...close(side, entry, stop, x.exit, b.t, x.t, x.how, cost) };
  }
  return { skip: 'nofill' };
}
// placebo / comparison: market entry at the open of the first candle at or after startT, side ±1, stop dist away
export function marketTrade(bars, { startT, side, dist, cost = COST }) {
  const i = bars.findIndex((b) => b.t >= startT);
  if (i < 0 || !(dist > 0)) return null;
  const entry = bars[i].o, stop = entry - side * dist, x = walk(bars, i, side, stop);
  return { fillT: bars[i].t, ...close(side, entry, stop, x.exit, bars[i].t, x.t, x.how, cost) };
}

// ─── statistics ───
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const sdv = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : NaN; };
// calendar-month sums, each trade booked in the month of its exit
export function monthT(trades, key = 'net') {
  const by = new Map(); for (const x of trades) { const k = x.exitMonth; by.set(k, (by.get(k) || 0) + x[key]); }
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
  const byYear = {}; for (const x of tr) { const y = x.week.slice(0, 4); (byYear[y] ||= { n: 0, net: 0 }); byYear[y].n++; byYear[y].net += x.net; }
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
export function eligible(weeks, end) {
  const out = [], skips = {};
  for (const w of weeks) {
    if (!inW(w.week, [WINDOWS.IS[0], end])) continue;
    const s = weekSkip(w); if (s) { skips[s] = (skips[s] || 0) + 1; continue; }
    out.push(w);
  }
  return { out, skips };
}
export function runTest(weeks, test, end = WINDOWS.OOS[1]) {
  const { out, skips } = eligible(weeks, end), tr = [];
  for (const w of out) {
    const x = wvbTrade(w.bars, { ...test, prevRange: w.prevRange });
    if (x.skip) skips[x.skip] = (skips[x.skip] || 0) + 1;
    else tr.push({ week: w.week, exitMonth: exitMonthOf(w, x), ...x });
  }
  return { tr, skips, weeks: out.length };
}
// the exit candle's month (time exits: the week's last candle; stop exits: the stop candle)
export function exitMonthOf(w, x) { return ymdOf(x.exitT ?? w.bars.at(-1).t).slice(0, 7); }
export function placebo(weeks, test, trades, seeds = SEEDS) {
  const byWeek = new Map(weeks.map((w) => [w.week, w])), oos = trades.filter((x) => inW(x.week, WINDOWS.OOS));
  const pBuy = test.sides === 'buy' ? 1 : oos.filter((x) => x.side > 0).length / (oos.length || 1), res = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const rand = rng(seed), tr = [];
    for (const x of oos) {
      const w = byWeek.get(x.week), cand = w.bars.filter((b) => b.t <= placeboEnd(w.m));
      const b = cand[Math.floor(rand() * cand.length)], side = rand() < pBuy ? 1 : -1;
      const p = marketTrade(w.bars, { startT: b.t, side, dist: x.r }); if (p) tr.push(p);
    }
    res.push(r3(mean(tr.map((v) => v.net))));
  }
  return res;
}
export function comparison(weeks, end) {
  const { out } = eligible(weeks, end), tr = [];
  for (const w of out) { const x = marketTrade(w.bars, { startT: w.bars[0].t, side: 1, dist: 0.5 * w.prevRange }); if (x) tr.push({ week: w.week, exitMonth: exitMonthOf(w, x), ...x }); }
  return tr;
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
  return `${dec.T1.pass ? 'PASS' : 'FAIL'}, ${n} of 3: gold week open ± 0.5 × prior week range breakout 2017 → now ${sg(o.netR)}R a trade net (n ${o.n}, month t ${s2(o.t)}); 2007-16 ${sg(res.T1.IS.netR)}R`;
}
export function report(R) {
  const L = [], T = R.tests, yn = (b) => (b ? 'yes' : 'no');
  L.push('# Gold: the weekly volatility breakout (week open ± k × the previous week\'s range)', '');
  L.push('Paper research only. A new stand-alone weekly rule on spot gold, not a gate, exit, entry or size of the live gold book (owner decision 44: none of the book\'s records read). No claim carries over from the daily rule (`gold-vol-breakout`). Nothing live changed, no proposal. The rule, costs, windows, placebo and pass bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.', '');
  L.push(`**Verdict: ${R.verdict}**`, '');
  L.push('## Tests', '');
  L.push('| Test | Rule | Period | n | Win | Net R/trade | Gross R/trade | Net at 2x cost | Cost R/trade | Financing R/trade | Total R | t (months) | Gross t | Stops / time | Max DD R | Median stop $ |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  const row = (k, name, w, x) => `| ${k} | ${name} | ${w === 'IS' ? '2007-2016' : `2017 → ${R.dataEnd}`} | ${x.n} | ${(x.win * 100).toFixed(1)} % | ${sg(x.netR)} | ${sg(x.grossR)} | ${sg(x.net2R)} | ${sg(x.costR)} | ${sg(x.finR)} | ${s2(x.total)} | ${s2(x.t)} | ${s2(x.grossT)} | ${x.stops} / ${x.time} | ${s2(x.maxDD)} | ${x.medianStop} |`;
  for (const k of Object.keys(T)) for (const w of ['IS', 'OOS']) L.push(row(k, T[k].name, w, T[k][w]));
  for (const w of ['IS', 'OOS']) L.push(row('Comparison', 'long every week, open to Friday, stop 0.5 × prior range (not a test)', w, R.comparison[w]));
  L.push('', '## Decision (out of sample, Holm over the three tests)', '');
  L.push('| Test | p | Holm p | net > 0 | t ≥ 2 | Holm < 0.05 | in sample > 0 | 2x cost > 0 | placebos beaten (need 38 of 40) | n ≥ 30 | pass |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, d] of Object.entries(R.decision)) { const c = d.checks; L.push(`| ${k} | ${d.p} | ${d.pHolm} | ${yn(c.netPos)} | ${yn(c.t2)} | ${yn(c.holm)} | ${yn(c.isPos)} | ${yn(c.cost2x)} | ${d.placeboBeaten} | ${yn(c.n30)} | **${d.pass ? 'pass' : 'fail'}** |`); }
  L.push('', '## Placebo (out of sample, 40 seeds)', '', 'For every real trade, one market entry in the same week at a random 5-minute mark from the week\'s first candle to Thursday 20:55 UTC, side drawn with the test\'s own out-of-sample share of buys (T3: buy), stop at the real trade\'s 1R distance, out at the week\'s exit or the stop, the same costs and financing.', '');
  L.push('| Test | Real net R a trade | Placebo median | Placebo 95th percentile | Placebo min / max |', '|---|---|---|---|---|');
  for (const k of Object.keys(T)) { const p = R.placebo[k]; L.push(`| ${k} | ${sg(T[k].OOS.netR)} | ${sg(p.median)} | ${sg(p.p95)} | ${sg(p.min)} / ${sg(p.max)} |`); }
  L.push('', '## Sides and skipped weeks', '');
  for (const k of Object.keys(T)) L.push(`- ${k}, 2017 → now: buys n ${T[k].OOS.buys.n} ${sg(T[k].OOS.buys.netR)}R, sells n ${T[k].OOS.sells.n} ${sg(T[k].OOS.sells.netR)}R; weeks without a trade, whole period: ${Object.entries(T[k].skips).map(([a, b]) => `${a} ${b}`).join(', ') || 'none'}.`);
  L.push('', '## By year (net R a trade, n)', '');
  const ys = [...new Set(Object.values(T).flatMap((x) => [...Object.keys(x.IS.byYear), ...Object.keys(x.OOS.byYear)]))].sort();
  L.push('| Year | ' + Object.keys(T).join(' | ') + ' |', '|---|' + Object.keys(T).map(() => '---|').join(''));
  for (const y of ys) L.push(`| ${y} | ` + Object.keys(T).map((k) => { const b = T[k].IS.byYear[y] || T[k].OOS.byYear[y]; return b ? `${sg(b.netR)} (${b.n})` : '—'; }).join(' | ') + ' |');
  L.push('', '## Reading', '', R.reading, '');
  L.push('## Data and method', '');
  L.push(`- ${R.data}`);
  L.push(`- Rule: ${R.rule}`);
  L.push(`- Costs: $${R.cost.toFixed(2)} a round trip per ounce (spread and slippage), 2x reported; financing \`FIN.xau.long\` (${R.finRate} of price a rollover, the demo broker's swap of 11 Nov 2026, today's rate for every year) × \`nights\` × entry / 1R on buys.`);
  L.push('- Limited power, said before the result: one trade a week at most, month sums of a few trades; a FAIL is "not shown", not "shown not to work".');
  L.push('- To repeat: `node research/edge/gold-weekly-vol-breakout/run.mjs <dir>` with `<dir>/xau-5m.json.gz` (OANDA mid M5 XAU/USD from the candle proxy, kept out of git).');
  return L.join('\n') + '\n';
}

// ─── main ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candleDir>');
  const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'xau-5m.json.gz'))));
  rows.sort((a, b) => a[0] - b[0]);
  // the last complete week: its Friday 20:55 candle is on file
  let weeks = buildWeeks(rows); const lastT = rows.at(-1)[0];
  weeks = weeks.filter((w) => lastT >= lastStart(w.m));
  const end = weeks.at(-1).week, res = {}, pl = {};
  for (const [k, t] of Object.entries(TESTS)) {
    const { tr, skips, weeks: nw } = runTest(weeks, t, end);
    res[k] = { name: t.name, k: t.k, sides: t.sides, eligibleWeeks: nw, skips, IS: summary(tr.filter((x) => inW(x.week, WINDOWS.IS))), OOS: summary(tr.filter((x) => inW(x.week, WINDOWS.OOS))) };
    pl[k] = placebo(weeks, t, tr);
  }
  const cmp = comparison(weeks, end);
  const comp = { IS: summary(cmp.filter((x) => inW(x.week, WINDOWS.IS))), OOS: summary(cmp.filter((x) => inW(x.week, WINDOWS.OOS))) };
  const dec = decide(res, pl);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const o = res.T1.OOS, fail = (k) => Object.entries(dec[k].checks).filter(([, v]) => !v).map(([c]) => c).join(', ');
  const one = (k) => `${k} ${sg(res[k].OOS.netR)}R net (n ${res[k].OOS.n}, t ${s2(res[k].OOS.t)}; gross ${sg(res[k].OOS.grossR)}R, t ${s2(res[k].OOS.grossT)}; 2007-16 ${sg(res[k].IS.netR)}R, t ${s2(res[k].IS.t)}; ${dec[k].placeboBeaten} of 40 placebos beaten${dec[k].pass ? ', passes' : `; failed: ${fail(k)}`})`;
  const reading = (dec.T1.pass ? 'T1 passes every pre-registered check. Paper research only; at most a proposal for the owner, with its own forward record. '
    : `The primary rule (T1) does not pass the pre-registered bar (failed: ${fail('T1')}). `)
    + `Out of sample: ${one('T1')}; ${one('T2')}; ${one('T3')}. `
    + `On weeks the median stop is $${o.medianStop} out of sample (${res.T1.IS.medianStop} in sample); costs and financing take ${sg(o.costR).replace('+', '')}R a trade on T1, of which financing ${sg(o.finR).replace('+', '')}R. `
    + `The comparison (long every week from the open, same stop) made ${sg(comp.OOS.netR)}R a trade net out of sample (n ${comp.OOS.n}, t ${s2(comp.OOS.t)}) and ${sg(comp.IS.netR)}R in sample. `
    + `On T1 the buys made ${sg(o.buys.netR)}R a trade and the sells ${sg(o.sells.netR)}R out of sample, which is gold's rise more than the breakout. `
    + 'The placebo as pre-registered draws its entries from the weeks the test filled; for the buys-only T3 those are weeks in which price rose half a range above the open, so random buys earlier in the same week catch that rise (placebo median far above T3): a flaw of that placebo\'s design, said here and not repaired after the result; T3 fails on its t and Holm p in any case. '
    + (dec.T1.pass ? '' : 'Not an edge; nothing live changes and no proposal is written.')
    + ((!dec.T1.pass && (dec.T2.pass || dec.T3.pass)) ? ' A T2 or T3 pass alone is a hypothesis for its own pre-registration on other data, not an edge.' : '');
  const result = { study: 'gold-weekly-vol-breakout', built: '2026-11-14', preregistration: 'research/edge/gold-weekly-vol-breakout/PREREGISTRATION.md', planSha256: sha,
    claim: 'a move of k × the previous week\'s range away from the week\'s open continues to Friday 20:55 UTC on spot gold (weekly volatility breakout)',
    rule: 'O = open of the week\'s first M5 candle (Sunday reopen); prevRange = high − low of all the previous week\'s candles; buy stop O + k × prevRange and sell stop O − k × prevRange live to the Friday 20:55 UTC candle, first filled wins (a gap fills at the open; both in one candle: the level nearer its open); stop at O (fill and stop in one candle: the stop); out at the close of the Friday 20:55 candle; T1 k 0.5, T2 k 0.3, T3 k 0.5 buys only; weeks with fewer than 600 candles (or a previous week with fewer) skipped',
    data: `OANDA mid XAU/USD M5 through the keyless candle proxy, ${ymdOf(rows[0][0])} → ${ymdOf(lastT)}; ${weeks.length} complete weeks, last Monday ${end}`,
    dataEnd: end, cost: COST, finRate: FIN.xau.long, windows: { IS: WINDOWS.IS, OOS: [WINDOWS.OOS[0], end] }, verdict: verdictLine(res, dec), decision: dec, tests: res,
    comparison: comp,
    placebo: Object.fromEntries(Object.keys(TESTS).map((k) => [k, { seeds: SEEDS, entry: 'random 5-minute mark, week start to Thursday 20:55 UTC', means: pl[k], min: Math.min(...pl[k]), max: Math.max(...pl[k]), median: r3(quantile(pl[k], 0.5)), p95: r3(quantile(pl[k], 0.95)) }])),
    reading };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(result, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(result));
  console.log(result.verdict);
  for (const k of Object.keys(TESTS)) console.log(k, JSON.stringify({ IS: { n: res[k].IS.n, net: res[k].IS.netR, gross: res[k].IS.grossR, t: res[k].IS.t, gt: res[k].IS.grossT }, OOS: { n: res[k].OOS.n, net: res[k].OOS.netR, gross: res[k].OOS.grossR, t: res[k].OOS.t, gt: res[k].OOS.grossT, n2: res[k].OOS.net2R, stop: res[k].OOS.medianStop } }), dec[k].pHolm, dec[k].placeboBeaten, res[k].skips);
}
