// Edge research · gold-london-orb: a breakout of gold's first London hour range (08:00-08:59 London local) on OANDA spot gold
// M5, as fixed in PREREGISTRATION.md. A stand-alone intraday rule, never a gate, exit, entry or size of the live gold book.
// Pure pieces are exported for tests/gold-london-orb.test.mjs. Imports nothing from the repository.
//   node research/edge/gold-london-orb/run.mjs <file xau-5m.json.gz>   (writes result.json and RESULT.md)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const COST = 0.60;                         // $ a round trip per ounce, spread + slippage together
export const ORDER_END = 16 * 60, EXIT = 20 * 60, MIN_RANGE = 10, NEED = 60, MED_N = 20, TGT2 = 1.5;
export const TESTS = {
  T1: { name: 'Breakout, stop at the opposite side, out at 20:00 UTC', tgt: 0 },
  T2: { name: 'T1 with a 1.5R target', tgt: TGT2 },
  T3: { name: 'T1 on a range under its 20-day median width', tgt: 0, narrow: true },
};
export const WINDOWS = { IS: ['2008-01-01', '2016-12-31'], OOS: ['2017-01-01', '2026-11-13'] };
export const HALVES = { H1: ['2017-01-01', '2021-12-31'], H2: ['2022-01-01', '2026-11-13'] };
export const SEEDS = 40, PLACEBO = { from: 9 * 60, to: 15 * 60 + 55 };

// ─── British Summer Time: last Sunday of March 01:00 UTC → last Sunday of October 01:00 UTC ───
const lastSunday = (y, m) => { const d = new Date(Date.UTC(y, m + 1, 0)); return d.getUTCDate() - d.getUTCDay(); };
export function bst(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  if (m < 3 || m > 10) return false;
  if (m > 3 && m < 10) return true;
  const ls = lastSunday(y, m - 1);
  return m === 3 ? d >= ls : d < ls;              // the switch is at 01:00 UTC on the Sunday; weekdays only are traded
}
export const rangeHour = (ymd) => (bst(ymd) ? 7 : 8); // the UTC hour of London 08:00-08:59
export const weekday = (ymd) => { const w = new Date(Date.parse(ymd + 'T00:00:00Z')).getUTCDay(); return w >= 1 && w <= 5; };

// candles grouped by UTC calendar day
export function groupDays(rows) {
  const cal = new Map();
  for (const r of rows) {
    const d = new Date(r[0] * 1000), ymd = d.toISOString().slice(0, 10), min = d.getUTCHours() * 60 + d.getUTCMinutes();
    if (!cal.has(ymd)) cal.set(ymd, []);
    cal.get(ymd).push({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4], min });
  }
  return cal;
}

export function rangeOf(bars, rh) {
  const rs = rh * 60, r = bars.filter((b) => b.min >= rs && b.min < rs + 60);
  if (r.length < MIN_RANGE) return null;
  const hi = Math.max(...r.map((b) => b.h)), lo = Math.min(...r.map((b) => b.l));
  return hi > lo ? { hi, lo, width: hi - lo } : null;
}

// manage an open position from candle index k of `post` (the fill candle included); stop first, a gap fills at the open
export function manage(post, k, side, entry, stop, target, fillCandle = true) {
  for (let i = k; i < post.length; i++) {
    const b = post[i];
    if (!(fillCandle && i === k) && side * (b.o - stop) <= 0) return { exit: b.o, how: 'stop', at: b.min };
    const hitS = side > 0 ? b.l <= stop : b.h >= stop;
    const hitT = target != null && (side > 0 ? b.h >= target : b.l <= target);
    if (hitS) return { exit: stop, how: 'stop', at: b.min };
    if (hitT) return { exit: target, how: 'target', at: b.min };
  }
  return { exit: post.at(-1).c, how: 'time', at: post.at(-1).min };
}

// ─── one day, one rule ───  bars: the UTC day's candles in time order ({t,o,h,l,c,min}); rh: the range's UTC hour
export function londonTrade(bars, { rh, tgt = 0, cost = COST } = {}) {
  const rg = rangeOf(bars, rh);
  if (!rg) return { skip: 'range' };
  const re = rh * 60 + 60, post = bars.filter((b) => b.min >= re && b.min < EXIT);
  if (post.length < NEED) return { skip: 'missing' };
  let k = -1, side = 0, entry = NaN;
  for (let i = 0; i < post.length && post[i].min < ORDER_END; i++) {
    const b = post[i], up = b.h >= rg.hi, dn = b.l <= rg.lo;
    if (up && dn) side = Math.abs(b.o - rg.hi) <= Math.abs(b.o - rg.lo) ? 1 : -1;
    else if (up) side = 1; else if (dn) side = -1; else continue;
    entry = side > 0 ? Math.max(b.o, rg.hi) : Math.min(b.o, rg.lo); k = i; break;
  }
  if (k < 0) return { skip: 'nofill' };
  const stop = side > 0 ? rg.lo : rg.hi, r = side * (entry - stop);
  if (!(r > 0)) return { skip: 'norisk' };
  const target = tgt ? entry + side * tgt * r : null;
  const x = manage(post, k, side, entry, stop, target, true);
  const R = side * (x.exit - entry) / r;
  return { rangeUtcHour: rh, side, fillAt: post[k].min, hi: rg.hi, lo: rg.lo, width: rg.width, entry, stop, target, r,
    exit: x.exit, how: x.how, exitAt: x.at, R, net: R - cost / r, net2: R - 2 * cost / r };
}

// a placebo trade: market at the open of the first candle starting at or after `start` (before 16:00), stop `width` away
export function placeboTrade(bars, { start, side, width, tgt = 0, cost = COST }) {
  const post = bars.filter((b) => b.min >= start && b.min < EXIT), k = post.findIndex((b) => b.min < ORDER_END);
  if (k < 0 || !(width > 0)) return null;
  const entry = post[k].o, stop = entry - side * width, target = tgt ? entry + side * tgt * width : null;
  const x = manage(post, k, side, entry, stop, target, true), R = side * (x.exit - entry) / width;
  return { R, net: R - cost / width, net2: R - 2 * cost / width };
}

// narrow flag: width under the median of the previous MED_N days that had a range (strictly earlier days)
export function narrowFlags(days) {
  const hist = [], out = new Map();
  for (const d of days) {
    const rg = rangeOf(d.bars, d.rh);
    if (hist.length >= MED_N && rg) { const w = hist.slice(-MED_N).sort((a, b) => a - b); out.set(d.day, rg.width < (w[MED_N / 2 - 1] + w[MED_N / 2]) / 2); }
    if (rg) hist.push(rg.width);
  }
  return out;
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
  const hours = {}; for (const x of tr) hours[x.rangeUtcHour] = (hours[x.rangeUtcHour] || 0) + 1;
  return { n: tr.length, win: r3(tr.filter((x) => x.net > 0).length / (tr.length || 1)), netR: r3(mean(net)), grossR: r3(mean(tr.map((x) => x.R))),
    net2R: r3(mean(tr.map((x) => x.net2))), costR: r3(mean(tr.map((x) => x.R - x.net))), total: r2(net.reduce((s, v) => s + v, 0)),
    months: mt.months, t: r2(mt.t), grossT: r2(gt.t), t2x: r2(t2.t), stops: tr.filter((x) => x.how === 'stop').length,
    targets: tr.filter((x) => x.how === 'target').length, time: tr.filter((x) => x.how === 'time').length, maxDD: r2(dd),
    medianStop: rs.length ? r2(rs[Math.floor(rs.length / 2)]) : null, buys: side(1), sells: side(-1), rangeUtcHours: hours, byYear };
}

// ─── the whole run ───
export const inW = (day, [a, b]) => day >= a && day <= b;
export function prepare(rows) {
  const cal = groupDays(rows), days = [];
  for (const D of [...cal.keys()].sort()) if (D >= '2007-11-01' && D <= WINDOWS.OOS[1] && weekday(D)) days.push({ day: D, rh: rangeHour(D), bars: cal.get(D) });
  return days;
}
export function runTest(days, test, narrow) {
  const tr = [], skips = {};
  for (const d of days) {
    if (d.day < WINDOWS.IS[0]) continue;
    if (test.narrow) { const f = narrow.get(d.day); if (f === undefined) { skips.warmup = (skips.warmup || 0) + 1; continue; } if (!f) { skips.wide = (skips.wide || 0) + 1; continue; } }
    const x = londonTrade(d.bars, { rh: d.rh, tgt: test.tgt });
    if (x.skip) skips[x.skip] = (skips[x.skip] || 0) + 1; else tr.push({ day: d.day, ...x });
  }
  return { tr, skips };
}
// per test: on each OOS day the test traded, a random start 09:00-15:55 UTC, a random side, the day's range width as the stop
export function placebo(days, trades, test, seeds = SEEDS) {
  const byDay = new Map(days.map((d) => [d.day, d.bars])), grid = (PLACEBO.to - PLACEBO.from) / 5 + 1, out = [];
  const oos = trades.filter((x) => inW(x.day, WINDOWS.OOS));
  for (let seed = 1; seed <= seeds; seed++) {
    const rand = rng(seed), v = [];
    for (const x of oos) {
      const start = PLACEBO.from + 5 * Math.floor(rand() * grid), side = rand() < 0.5 ? 1 : -1;
      const p = placeboTrade(byDay.get(x.day), { start, side, width: x.width, tgt: test.tgt });
      if (p) v.push(p.net);
    }
    out.push(r3(mean(v)));
  }
  return out;
}
export function decide(res, pl) {
  const ks = Object.keys(TESTS), ps = ks.map((k) => normP(res[k].OOS.t)), adj = holm(ps), d = {};
  ks.forEach((k, i) => {
    const o = res[k].OOS, beaten = pl[k].filter((m) => o.netR > m).length;
    const checks = { netPos: o.netR > 0, t2: o.t >= 2, holm: adj[i] < 0.05, isPos: res[k].IS.netR > 0, h1Pos: res[k].H1.netR > 0, h2Pos: res[k].H2.netR > 0,
      cost2x: o.net2R > 0, placebo: beaten >= 38, n30: o.n >= 30 };
    d[k] = { p: r3(ps[i]), pHolm: r3(adj[i]), beaten, checks, pass: Object.values(checks).every(Boolean) };
  });
  return d;
}

// ─── report (RESULT.md is this function of result.json) ───
const sg = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3));
const s2 = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2));
export function verdictLine(res, dec) {
  const n = Object.values(dec).filter((x) => x.pass).length, o = res.T1.OOS;
  return `${n ? 'PASS' : 'FAIL'}, ${n} of 3: gold London first-hour range breakout 2017 → now ${sg(o.netR)}R a trade net (n ${o.n}, month t ${s2(o.t)}, gross ${sg(o.grossR)}R); 2008-16 ${sg(res.T1.IS.netR)}R`;
}
const PER = { IS: '2008-2016', OOS: '2017 → 2026-11-13', H1: '2017-2021', H2: '2022 → 2026-11-13' };
export function report(R) {
  const L = [], T = R.tests, yn = (b) => (b ? 'yes' : 'no');
  L.push('# Gold: a breakout of the first London hour range (08:00-08:59 London)', '');
  L.push('Paper research only. A new stand-alone intraday rule, **not a gate, exit, entry or size of the live gold book** (owner decision 44: none of the book\'s records read). Nothing live changed, no proposal. The rule, costs, windows, placebo and pass bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.', '');
  L.push(`**Verdict: ${R.verdict}**`, '');
  L.push('## Tests (R of the actual stop distance; t on calendar-month sums of net R)', '');
  L.push('| Test | Rule | Period | n | Win | Net R/trade | Gross R/trade | Net at 2x cost | Cost R/trade | Total R | t (months) | Gross t | Stops / targets / time | Max DD R | Median stop $ |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const k of Object.keys(T)) for (const w of ['IS', 'OOS', 'H1', 'H2']) {
    const x = T[k][w];
    L.push(`| ${k} | ${T[k].name} | ${PER[w]} | ${x.n} | ${(x.win * 100).toFixed(1)} % | ${sg(x.netR)} | ${sg(x.grossR)} | ${sg(x.net2R)} | ${sg(x.costR)} | ${s2(x.total)} | ${s2(x.t)} | ${s2(x.grossT)} | ${x.stops} / ${x.targets} / ${x.time} | ${s2(x.maxDD)} | ${x.medianStop} |`);
  }
  L.push('', '## Decision (out of sample, Holm over the three tests)', '');
  L.push('| Test | p | Holm p | net > 0 | t ≥ 2 | Holm < 0.05 | 2008-16 > 0 | 2017-21 > 0 | 2022-now > 0 | 2x cost > 0 | placebos beaten (need 38 of 40) | n ≥ 30 | pass |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, d] of Object.entries(R.decision)) { const c = d.checks; L.push(`| ${k} | ${d.p} | ${d.pHolm} | ${yn(c.netPos)} | ${yn(c.t2)} | ${yn(c.holm)} | ${yn(c.isPos)} | ${yn(c.h1Pos)} | ${yn(c.h2Pos)} | ${yn(c.cost2x)} | ${d.beaten} | ${yn(c.n30)} | **${d.pass ? 'pass' : 'fail'}** |`); }
  L.push('', `**Placebo** (on each out-of-sample day the test traded: market entry at a random M5 open 09:00-15:55 UTC, random side, stop at that day's range width, the test's exit and cost; ${R.placebo.seeds} seeds):`, '');
  for (const k of Object.keys(T)) { const p = R.placebo[k]; L.push(`- ${k}: seed means ${sg(p.min)} to ${sg(p.max)}R a trade, median ${sg(p.median)}, 95th percentile ${sg(p.p95)}R.`); }
  L.push('', '## Sides, range hours and skipped days', '');
  for (const k of Object.keys(T)) { const o = T[k].OOS; L.push(`- ${k}, 2017 → now: buys n ${o.buys.n} ${sg(o.buys.netR)}R, sells n ${o.sells.n} ${sg(o.sells.netR)}R; range hour (UTC) used: ${Object.entries(o.rangeUtcHours).map(([h, n]) => `${h}:00 on ${n} days`).join(', ')}; days without a trade, whole period: ${Object.entries(T[k].skips).map(([a, b]) => `${a} ${b}`).join(', ') || 'none'}.`); }
  L.push('', '## By year (net R a trade, n)', '');
  const ys = [...new Set(Object.values(T).flatMap((x) => [...Object.keys(x.IS.byYear), ...Object.keys(x.OOS.byYear)]))].sort();
  L.push('| Year | ' + Object.keys(T).join(' | ') + ' |', '|---|' + Object.keys(T).map(() => '---|').join(''));
  for (const y of ys) L.push(`| ${y} | ` + Object.keys(T).map((k) => { const b = T[k].IS.byYear[y] || T[k].OOS.byYear[y]; return b ? `${sg(b.netR)} (${b.n})` : '—'; }).join(' | ') + ' |');
  L.push('', '## Reading', '', R.reading, '');
  L.push('## Data and method', '');
  L.push(`- ${R.data}`);
  L.push(`- Rule: ${R.rule}`);
  L.push(`- Costs: $${R.cost.toFixed(2)} a round trip per ounce (spread and slippage), 2x reported; no financing (flat by 20:00 UTC, before the 17:00 New York rollover).`);
  L.push('- Not in the pre-registration, decided while coding before the first run: a target reached inside the fill candle (and not the stop) counts as reached, since price must cross the range level before it can reach a target beyond it.');
  L.push('- To repeat: `node research/edge/gold-london-orb/run.mjs <xau-5m.json.gz>` (OANDA mid M5 XAU/USD as `[unixSec, o, h, l, c]` rows, kept out of git).');
  return L.join('\n') + '\n';
}

// ─── main ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const file = process.argv[2]; if (!file) throw new Error('usage: node run.mjs <xau-5m.json.gz>');
  const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)));
  const days = prepare(rows), narrow = narrowFlags(days), res = {}, pl = {};
  for (const [k, t] of Object.entries(TESTS)) {
    const { tr, skips } = runTest(days, t, narrow), f = (w) => summary(tr.filter((x) => inW(x.day, w)));
    res[k] = { name: t.name, skips, IS: f(WINDOWS.IS), OOS: f(WINDOWS.OOS), H1: f(HALVES.H1), H2: f(HALVES.H2) };
    pl[k] = placebo(days, tr, t);
  }
  const dec = decide(res, pl);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const o = res.T1.OOS, fail = (k) => Object.entries(dec[k].checks).filter(([, v]) => !v).map(([c]) => c).join(', ');
  const line = (k) => `${k} ${sg(res[k].OOS.netR)}R (n ${res[k].OOS.n}, t ${s2(res[k].OOS.t)}, gross ${sg(res[k].OOS.grossR)}R; 2008-16 ${sg(res[k].IS.netR)}R; ${dec[k].pass ? 'passes' : `failed: ${fail(k)}`})`;
  const reading = (Object.values(dec).some((d) => d.pass)
    ? 'At least one test passes every pre-registered check. Paper research only; at most a proposal for the owner, with its own forward record. '
    : 'No test passes the pre-registered bar. ')
    + `Out of sample: ${line('T1')}; ${line('T2')}; ${line('T3')}. Costs take ${sg(o.costR).replace('+', '')}R a trade on T1 at a median stop of $${o.medianStop}. `
    + `Before costs T1 leans with the break (gross ${sg(res.T1.IS.grossR)}R, t ${s2(res.T1.IS.grossT)} in 2008-16; ${sg(o.grossR)}R, t ${s2(o.grossT)} after), but the range is a few dollars wide and $${COST.toFixed(2)} a round trip takes more than the lean. `
    + `Placebo seeds beaten:T1 ${dec.T1.beaten}, T2 ${dec.T2.beaten}, T3 ${dec.T3.beaten} of 40. `
    + (Object.values(dec).some((d) => d.pass) ? '' : 'Not an edge; nothing live changes and no proposal is written.');
  const result = { study: 'gold-london-orb', built: '2026-11-14', preregistration: 'research/edge/gold-london-orb/PREREGISTRATION.md', planSha256: sha,
    claim: 'a breakout of the high or low of gold\'s first London hour (08:00-08:59 London) carries on to the US afternoon',
    rule: 'range = high/low of the twelve M5 candles of 08:00-08:59 London (07:00 UTC in British Summer Time, else 08:00 UTC, recorded per day); after it closes a buy stop at the high and a sell stop at the low, live until 16:00 UTC, first fill wins (a gap fills at the open; a candle touching both = the level nearer its open, then stopped); stop at the opposite side; T1 out at 20:00 UTC; T2 a 1.5R target else 20:00; T3 = T1 on days whose range is under the median of the previous 20; stop first, a gap through the stop fills at the open; one trade a day',
    data: `OANDA mid XAU/USD M5 (keyless candle proxy), ${days.length} weekdays ${days[0].day} → ${days.at(-1).day} (from 2007-11 for the T3 warm-up only), UTC`,
    cost: COST, windows: WINDOWS, halves: HALVES, verdict: verdictLine(res, dec), decision: dec, tests: res,
    placebo: { seeds: SEEDS, start: '09:00-15:55 UTC', ...Object.fromEntries(Object.keys(TESTS).map((k) => [k, { means: pl[k], min: Math.min(...pl[k]), max: Math.max(...pl[k]), median: r3(quantile(pl[k], 0.5)), p95: r3(quantile(pl[k], 0.95)) }])) },
    reading };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(result, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(result));
  console.log(result.verdict);
  for (const k of Object.keys(TESTS)) console.log(k, JSON.stringify({ IS: [res[k].IS.n, res[k].IS.netR, res[k].IS.grossR, res[k].IS.t], OOS: [res[k].OOS.n, res[k].OOS.netR, res[k].OOS.grossR, res[k].OOS.t, res[k].OOS.grossT, res[k].OOS.net2R], H: [res[k].H1.netR, res[k].H2.netR] }), dec[k].pHolm, dec[k].beaten, res[k].skips);
}
