// Edge research · gold-day-range-used: when gold has already travelled a normal day's whole range by 15:00 UTC and sits at
// that day's extreme, fade (or follow) it to 21:00 UTC, measured against the same side taken on every eligible day of the same
// month, as fixed in PREREGISTRATION.md. A stand-alone intraday rule, never a gate, exit, entry or size of the live gold book.
// Pure pieces are exported for tests/gold-day-range-used.test.mjs. The only import from the repository is the financing rule of
// council/fills.mjs (read only).
//   node research/edge/gold-day-range-used/run.mjs <xau-1h.json.gz>   (OANDA mid H1 rows [unixSec, o, h, l, c]; writes result.json, RESULT.md)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { FIN, nights } from '../../../council/fills.mjs';

export const COST = 0.60;                       // $ a round trip per ounce, spread + slippage together
export const ADR_N = 20, STOP_K = 0.5, CHECK_H = 15, EXIT_H = 21, MORN_NEED = 12, DAY_NEED = 18, BAND = 0.2;
export const TESTS = {
  T1: { name: 'Fade a used-up day (U >= 1.0)', u: 1.0, follow: false },
  T2: { name: 'Fade a well over-used day (U >= 1.5)', u: 1.5, follow: false },
  T3: { name: 'Follow a used-up day (U >= 1.0)', u: 1.0, follow: true },
};
export const WINDOWS = { IS: ['2007-01-01', '2016-12-31'], OOS: ['2017-01-01', '2026-10-31'] };
export const HALVES = { H1: ['2017-01-01', '2021-12-31'], H2: ['2022-01-01', '2026-10-31'] };
export const SEEDS = 40;
export const inW = (day, [a, b]) => day >= a && day <= b;

// ─── days: UTC weekdays with their H1 candles keyed by hour ───
export function makeDays(rows) {
  const cal = new Map();
  for (const r of rows) {
    const d = new Date(r[0] * 1000), w = d.getUTCDay();
    if (w === 0 || w === 6) continue;
    const ymd = d.toISOString().slice(0, 10);
    if (!cal.has(ymd)) cal.set(ymd, new Map());
    cal.get(ymd).set(d.getUTCHours(), { t: r[0], o: r[1], h: r[2], l: r[3], c: r[4] });
  }
  const days = [...cal.keys()].sort().map((day) => ({ day, bars: cal.get(day) }));
  // ADR: mean whole-day range of the ADR_N latest complete weekdays BEFORE each day
  const full = [];
  for (const d of days) {
    d.adr = full.length >= ADR_N ? full.slice(-ADR_N).reduce((s, v) => s + v, 0) / ADR_N : null;
    if (d.bars.size >= DAY_NEED) { let h = -Infinity, l = Infinity; for (const b of d.bars.values()) { h = Math.max(h, b.h); l = Math.min(l, b.l); } full.push(h - l); }
  }
  return days;
}

// the reading at 15:00 UTC: only candles that START 00:00-14:00 UTC (closed by 15:00) are read
export function checkpoint(d) {
  if (!(d.adr > 0)) return { skip: 'noadr' };
  let h = -Infinity, l = Infinity, n = 0;
  for (let k = 0; k < CHECK_H; k++) { const b = d.bars.get(k); if (b) { h = Math.max(h, b.h); l = Math.min(l, b.l); n++; } }
  const last = d.bars.get(CHECK_H - 1);
  if (n < MORN_NEED || !last) return { skip: 'morning' };
  if (!(h > l)) return { skip: 'flat' };
  return { U: (h - l) / d.adr, P: (last.c - l) / (h - l), hi: h, lo: l, c: last.c };
}
// signal side for a test: +1 buy, -1 sell, 0 none
export function sideOf(cp, test) {
  if (cp.skip || cp.U < test.u) return 0;
  const ext = cp.P >= 1 - BAND ? 1 : cp.P <= BAND ? -1 : 0;   // +1 = at the day's high, -1 = at its low
  return test.follow ? ext : 0 - ext;
}
// one trade 15:00 → 21:00 UTC with stop STOP_K x ADR; stop first, a gap through the stop fills at the open
export function trade(d, side, cost = COST) {
  const post = []; for (let k = CHECK_H; k < EXIT_H; k++) { const b = d.bars.get(k); if (b) post.push(b); }
  if (!d.bars.get(CHECK_H) || !d.bars.get(EXIT_H - 1)) return null;
  const entry = post[0].o, r = STOP_K * d.adr, stop = entry - side * r;
  let exit = null, how = 'time', tx = post.at(-1).t + 3600;
  for (const b of post) {
    if (side > 0 ? b.l <= stop : b.h >= stop) { exit = side > 0 ? Math.min(b.o, stop) : Math.max(b.o, stop); how = 'stop'; tx = b.t + 3600; break; }
  }
  if (exit == null) exit = post.at(-1).c;
  const R = side * (exit - entry) / r, fin = side > 0 ? nights(post[0].t, tx) * FIN.xau.long * entry / r : 0;
  return { day: d.day, side, entry, stop, r, exit, how, R, fin, net: R - cost / r - fin, net2: R - 2 * cost / r - fin };
}
export const eligible = (d) => { const cp = checkpoint(d); return !cp.skip && d.bars.get(CHECK_H) && d.bars.get(EXIT_H - 1); };

// same-side baseline: mean net R of each side over every eligible day of each calendar month
export function baselineByMonth(days) {
  const acc = new Map();
  for (const d of days) {
    if (!eligible(d)) continue;
    for (const s of [1, -1]) { const x = trade(d, s); if (!x) continue; const k = d.day.slice(0, 7) + '|' + s; const a = acc.get(k) || [0, 0]; a[0] += x.net; a[1]++; acc.set(k, a); }
  }
  const out = new Map(); for (const [k, [s, n]] of acc) out.set(k, s / n); return out;
}
export function runTest(days, test, base) {
  const tr = [], skips = {};
  for (const d of days) {
    const cp = checkpoint(d);
    if (cp.skip) { skips[cp.skip] = (skips[cp.skip] || 0) + 1; continue; }
    const s = sideOf(cp, test); if (!s) continue;
    const x = trade(d, s); if (!x) { skips.window = (skips.window || 0) + 1; continue; }
    x.U = cp.U; x.P = cp.P; x.base = base.get(d.day.slice(0, 7) + '|' + s); x.excess = x.net - x.base;
    tr.push(x);
  }
  return { tr, skips };
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
  const net = tr.map((x) => x.net);
  let eq = 0, pk = 0, dd = 0; for (const v of net) { eq += v; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  const byYear = {}; for (const x of tr) { const y = x.day.slice(0, 4); (byYear[y] ||= { n: 0, net: 0, ex: 0 }); byYear[y].n++; byYear[y].net += x.net; byYear[y].ex += x.excess; }
  for (const y in byYear) byYear[y] = { n: byYear[y].n, netR: r3(byYear[y].net / byYear[y].n), excessR: r3(byYear[y].ex / byYear[y].n) };
  const side = (s) => { const a = tr.filter((x) => x.side === s); return { n: a.length, netR: r3(mean(a.map((x) => x.net))), excessR: r3(mean(a.map((x) => x.excess))) }; };
  const rs = tr.map((x) => x.r);
  return { n: tr.length, win: r3(tr.filter((x) => x.net > 0).length / (tr.length || 1)), grossR: r3(mean(tr.map((x) => x.R))), netR: r3(mean(net)),
    net2R: r3(mean(tr.map((x) => x.net2))), costR: r3(mean(tr.map((x) => x.R - x.net))), finR: r3(mean(tr.map((x) => x.fin))),
    baseR: r3(mean(tr.map((x) => x.base))), excessR: r3(mean(tr.map((x) => x.excess))), total: r2(net.reduce((s, v) => s + v, 0)),
    months: monthT(tr).months, t: r2(monthT(tr).t), grossT: r2(monthT(tr, 'R').t), t2x: r2(monthT(tr, 'net2').t), excessT: r2(monthT(tr, 'excess').t),
    stops: tr.filter((x) => x.how === 'stop').length, maxDD: r2(dd), medianStop: rs.length ? r2(quantile(rs, 0.5)) : null, buys: side(1), sells: side(-1), byYear };
}
export function placebo(days, trades, seeds = SEEDS) {
  const pool = days.filter((d) => inW(d.day, WINDOWS.OOS) && eligible(d)), oos = trades.filter((x) => inW(x.day, WINDOWS.OOS)), out = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const rand = rng(seed), v = [];
    for (const x of oos) { let d; do d = pool[Math.floor(rand() * pool.length)]; while (d.day === x.day); const y = trade(d, x.side); if (y) v.push(y.net); }
    out.push(r3(mean(v)));
  }
  return out;
}
export function decide(res, pl) {
  const ks = Object.keys(TESTS), ps = ks.map((k) => normP(res[k].OOS.excessT)), adj = holm(ps), d = {};
  ks.forEach((k, i) => {
    const o = res[k].OOS, beaten = pl[k].filter((m) => o.netR > m).length;
    const checks = { excessPos: o.excessR > 0, t2: o.excessT >= 2, holm: adj[i] < 0.05, isExcessPos: res[k].IS.excessR > 0, netPos: o.netR > 0, cost2x: o.net2R > 0, placebo: beaten >= 38, n30: o.n >= 30 };
    d[k] = { p: r3(ps[i]), pHolm: r3(adj[i]), beaten, checks, pass: Object.values(checks).every(Boolean) };
  });
  return d;
}

// ─── report (RESULT.md is this function of result.json) ───
const sg = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3));
const s2 = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2));
export function verdictLine(res, dec) {
  const o = res.T1.OOS, pass = dec.T1.pass, n = Object.values(dec).filter((x) => x.pass).length;
  return `${pass ? 'PASS' : 'FAIL'}, ${n} of 3: fading gold's used-up day 15-21 UTC made ${sg(o.netR)}R a trade net 2017-26 (n ${o.n}), ${sg(o.excessR)}R over the same side every day (month t ${s2(o.excessT)}); 2007-16 ${sg(res.T1.IS.excessR)}R.`;
}
const PER = { IS: '2007-2016', OOS: '2017 → 2026-10', H1: '2017-2021', H2: '2022 → 2026-10' };
export function report(R) {
  const L = [], T = R.tests, yn = (b) => (b ? 'yes' : 'no');
  L.push('# Gold: a day range already used up by 15:00 UTC, faded (or followed) to 21:00 UTC', '');
  L.push('Paper research only. A new stand-alone intraday rule, **not a gate, exit, entry or size of the live gold book** (owner decision 44: none of the book\'s records read). Nothing live changed, no proposal. The rule, costs, windows, baseline, placebo and pass bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.', '');
  L.push(`**Verdict: ${R.verdict}**`, '');
  L.push('## Tests (R of the 0.5 x ADR stop; t on calendar-month sums)', '');
  L.push('| Test | Period | n | Win | Gross R | Net R | Net at 2x | Same-side baseline R | Excess R | t net | t gross | t excess | t 2x | Stops | Max DD R | Median stop $ |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const k of Object.keys(T)) for (const w of ['IS', 'OOS', 'H1', 'H2']) {
    const x = T[k][w];
    L.push(`| ${k} ${T[k].name} | ${PER[w]} | ${x.n} | ${(x.win * 100).toFixed(1)} % | ${sg(x.grossR)} | ${sg(x.netR)} | ${sg(x.net2R)} | ${sg(x.baseR)} | ${sg(x.excessR)} | ${s2(x.t)} | ${s2(x.grossT)} | ${s2(x.excessT)} | ${s2(x.t2x)} | ${x.stops} | ${s2(x.maxDD)} | ${x.medianStop} |`);
  }
  L.push('', '## Decision (out of sample, Holm over the three tests on the excess t)', '');
  L.push('| Test | p | Holm p | excess > 0 | excess t ≥ 2 | Holm < 0.05 | 2007-16 excess > 0 | net > 0 | 2x cost > 0 | placebos beaten (need 38 of 40) | n ≥ 30 | pass |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, d] of Object.entries(R.decision)) { const c = d.checks; L.push(`| ${k} | ${d.p} | ${d.pHolm} | ${yn(c.excessPos)} | ${yn(c.t2)} | ${yn(c.holm)} | ${yn(c.isExcessPos)} | ${yn(c.netPos)} | ${yn(c.cost2x)} | ${d.beaten} | ${yn(c.n30)} | **${d.pass ? 'pass' : 'fail'}** |`); }
  L.push('', `**Placebo** (each out-of-sample trade moved to a random other eligible weekday of 2017-26, same side and mechanics; ${R.placebo.seeds} seeds):`, '');
  for (const k of Object.keys(T)) { const p = R.placebo[k]; L.push(`- ${k}: seed means ${sg(p.min)} to ${sg(p.max)}R a trade, median ${sg(p.median)}, 95th percentile ${sg(p.p95)}R; the test's own ${sg(T[k].OOS.netR)}R beats ${R.decision[k].beaten}.`); }
  L.push('', '## Sides and skipped days', '');
  for (const k of Object.keys(T)) { const o = T[k].OOS; L.push(`- ${k}, 2017 → 2026-10: buys n ${o.buys.n} net ${sg(o.buys.netR)}R excess ${sg(o.buys.excessR)}R; sells n ${o.sells.n} net ${sg(o.sells.netR)}R excess ${sg(o.sells.excessR)}R; cost ${sg(o.costR)}R a trade; financing ${sg(o.finR)}R.`); }
  L.push(`- Weekdays without a reading, whole file: ${Object.entries(T.T1.skips).map(([a, b]) => `${a} ${b}`).join(', ') || 'none'}.`);
  L.push('', '## By year (net R / excess R a trade, n)', '');
  const ys = [...new Set(Object.values(T).flatMap((x) => [...Object.keys(x.IS.byYear), ...Object.keys(x.OOS.byYear)]))].sort();
  L.push('| Year | ' + Object.keys(T).join(' | ') + ' |', '|---|' + Object.keys(T).map(() => '---|').join(''));
  for (const y of ys) L.push(`| ${y} | ` + Object.keys(T).map((k) => { const b = T[k].IS.byYear[y] || T[k].OOS.byYear[y]; return b ? `${sg(b.netR)} / ${sg(b.excessR)} (${b.n})` : '—'; }).join(' | ') + ' |');
  L.push('', '## Reading', '', R.reading, '');
  L.push('## Data and method', '');
  L.push(`- ${R.data}`);
  L.push(`- Rule: ${R.rule}`);
  L.push(`- Costs: $${R.cost.toFixed(2)} a round trip per ounce (spread and slippage), 2x reported; financing \`nights\` x \`FIN.xau.long\` on buys from \`council/fills.mjs\` (0 here: every trade is out at 21:00 UTC, before the 22:00 UTC rollover).`);
  L.push('- To repeat: `node research/edge/gold-day-range-used/run.mjs <xau-1h.json.gz>` (OANDA mid H1 XAU/USD as `[unixSec, o, h, l, c]` rows from the keyless candle proxy `/md/bars?sym=xau&tf=1h`, kept out of git).');
  return L.join('\n') + '\n';
}

// ─── main ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const file = process.argv[2]; if (!file) throw new Error('usage: node run.mjs <xau-1h.json.gz>');
  const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)));
  const days = makeDays(rows), base = baselineByMonth(days), res = {}, pl = {};
  const inStudy = (d) => d.day >= WINDOWS.IS[0] && d.day <= WINDOWS.OOS[1];
  const sd = days.filter(inStudy);
  for (const [k, t] of Object.entries(TESTS)) {
    const { tr, skips } = runTest(sd, t, base);
    const f = (w) => summary(tr.filter((x) => inW(x.day, w)));
    res[k] = { name: t.name, skips, IS: f(WINDOWS.IS), OOS: f(WINDOWS.OOS), H1: f(HALVES.H1), H2: f(HALVES.H2) };
    pl[k] = placebo(sd, tr);
  }
  // the baseline itself (every eligible day, each side)
  const bl = { IS: {}, OOS: {} };
  for (const w of ['IS', 'OOS']) for (const s of [1, -1]) {
    const v = []; for (const d of sd) if (inW(d.day, WINDOWS[w]) && eligible(d)) { const x = trade(d, s); if (x) v.push(x); }
    bl[w][s > 0 ? 'buy' : 'sell'] = { n: v.length, grossR: r3(mean(v.map((x) => x.R))), netR: r3(mean(v.map((x) => x.net))), t: r2(monthT(v).t) };
  }
  const dec = decide(res, pl);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const fail = (k) => Object.entries(dec[k].checks).filter(([, v]) => !v).map(([c]) => c).join(', ');
  const line = (k) => { const o = res[k].OOS; return `${k} net ${sg(o.netR)}R, gross ${sg(o.grossR)}R, excess ${sg(o.excessR)}R (n ${o.n}, excess t ${s2(o.excessT)}; 2007-16 excess ${sg(res[k].IS.excessR)}R, t ${s2(res[k].IS.excessT)}; ${dec[k].pass ? 'passes' : `failed: ${fail(k)}`})`; };
  const any = dec.T1.pass;
  const reading = (any ? 'The primary test passes every pre-registered check: a lead to replicate on years or markets it did not use, never an edge on its own and never a council rule without the owner. ' : 'The primary test does not pass the pre-registered bar. ')
    + `Out of sample: ${line('T1')}; ${line('T2')}; ${line('T3')}. `
    + `The same-side baseline (15:00 → 21:00 UTC on every eligible day) made 2017-26 buys ${sg(bl.OOS.buy.netR)}R and sells ${sg(bl.OOS.sell.netR)}R a trade net (2007-16 ${sg(bl.IS.buy.netR)}R / ${sg(bl.IS.sell.netR)}R): the cost alone is about ${sg(res.T1.OOS.costR).replace('+', '')}R a trade at a median stop of $${res.T1.OOS.medianStop}. `
    + `Placebo seeds beaten: T1 ${dec.T1.beaten}, T2 ${dec.T2.beaten}, T3 ${dec.T3.beaten} of 40. `
    + (any ? '' : 'Not an edge; nothing live changes and no proposal is written.');
  const result = { study: 'gold-day-range-used', built: '2026-11-14', preregistration: 'research/edge/gold-day-range-used/PREREGISTRATION.md', planSha256: sha,
    system: 'stand-alone gold intraday rule (not the live book)',
    claim: 'once gold has travelled a normal day\'s whole range by 15:00 UTC and sits at that day\'s extreme, the rest of the session gives some of it back',
    rule: 'U = range of the 00:00-14:00 UTC H1 candles / ADR (mean whole-day range of the 20 previous complete weekdays); P = place of the 14:00 candle close in that range; T1 U >= 1.0 and P >= 0.8 sell / P <= 0.2 buy; T2 the same with U >= 1.5; T3 the opposite side (follow) with U >= 1.0; market at the 15:00 UTC open, stop 0.5 x ADR, out at the 20:00 candle close (21:00 UTC); stop first, a gap through fills at the open; excess = net R minus the mean net R of the same side on every eligible day of the same calendar month',
    data: `OANDA mid XAU/USD H1 (keyless candle proxy), ${sd.length} weekdays ${sd[0].day} → ${sd.at(-1).day}, UTC hours`,
    cost: COST, financing: { rate: FIN.xau.long, src: FIN.xau.src }, windows: WINDOWS, halves: HALVES, baseline: bl, verdict: verdictLine(res, dec), decision: dec, tests: res,
    placebo: { seeds: SEEDS, how: 'random other eligible OOS weekday, same side and mechanics', ...Object.fromEntries(Object.keys(TESTS).map((k) => [k, { means: pl[k], min: Math.min(...pl[k]), max: Math.max(...pl[k]), median: r3(quantile(pl[k], 0.5)), p95: r3(quantile(pl[k], 0.95)) }])) },
    reading };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(result, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(result));
  console.log(result.verdict, result.verdict.length);
  for (const k of Object.keys(TESTS)) console.log(k, JSON.stringify({ IS: [res[k].IS.n, res[k].IS.grossR, res[k].IS.netR, res[k].IS.excessR, res[k].IS.t, res[k].IS.excessT], OOS: [res[k].OOS.n, res[k].OOS.grossR, res[k].OOS.netR, res[k].OOS.excessR, res[k].OOS.t, res[k].OOS.excessT, res[k].OOS.net2R] }), dec[k].pHolm, dec[k].beaten);
  console.log(JSON.stringify(bl));
}
