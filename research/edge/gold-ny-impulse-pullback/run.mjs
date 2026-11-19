// Edge research · gold-ny-impulse-pullback: the first pullback (a limit at the 50 % retrace) after gold's 08:30-09:00 New York
// impulse, entered with the impulse, on OANDA spot gold M5, as fixed in PREREGISTRATION.md. A stand-alone intraday rule, never a
// gate, exit, entry or size of the live gold book. Pure pieces are exported for tests/gold-ny-impulse-pullback.test.mjs.
// Imports only `nights` / `FIN` from council/fills.mjs (financing on buys; zero by construction, checked).
//   node research/edge/gold-ny-impulse-pullback/run.mjs <file xau-5m.json.gz>   (writes result.json and RESULT.md)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { nights, FIN } from '../../../council/fills.mjs';

export const COST = 0.60;                        // $ a round trip per ounce, spread + slippage together
export const IMP_FROM = 8 * 60 + 30, IMP_TO = 9 * 60, ORDER_END = 11 * 60, EXIT = 16 * 60; // New York minutes
export const MIN_IMP = 5, FRAC = 0.5, BUF = 0.30, ATR_N = 14, SIZE1 = 0.25, SIZE3 = 0.5, TGT = 1.5;
export const TESTS = {
  T1: { name: '50 % retrace limit with the impulse, 1.5R target, out 16:00 NY', tgt: 'r', size: SIZE1 },
  T2: { name: 'T1 with the target at the impulse extreme', tgt: 'ext', size: SIZE1 },
  T3: { name: 'T1 on impulses of 0.5 x ATR(14) or more', tgt: 'r', size: SIZE3 },
};
export const WINDOWS = { IS: ['2007-01-01', '2016-12-31'], OOS: ['2017-01-01', '2026-11-13'] };
export const HALVES = { H1: ['2017-01-01', '2021-12-31'], H2: ['2022-01-01', '2026-11-13'] };
export const SEEDS = 40, PLACEBO = { from: IMP_TO, to: ORDER_END - 5 };

// ─── New York clock: daylight time from the 2nd Sunday of March 07:00 UTC to the 1st Sunday of November 06:00 UTC ───
const nthSunday = (y, m, n) => { const w = new Date(Date.UTC(y, m, 1)).getUTCDay(); return 1 + ((7 - w) % 7) + 7 * (n - 1); };
export function nyOffsetH(t) {
  const y = new Date(t * 1000).getUTCFullYear();
  const a = Date.UTC(y, 2, nthSunday(y, 2, 2), 7) / 1000, b = Date.UTC(y, 10, nthSunday(y, 10, 1), 6) / 1000;
  return t >= a && t < b ? -4 : -5;
}
export function nyOf(t) {
  const d = new Date((t + nyOffsetH(t) * 3600) * 1000);
  return { day: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes(), wd: d.getUTCDay() };
}

// candles grouped by New York calendar day (weekdays), and UTC weekday daily candles for the ATR
export function groupDays(rows) {
  const ny = new Map(), utc = new Map();
  for (const r of rows) {
    const n = nyOf(r[0]), b = { t: r[0], o: r[1], h: r[2], l: r[3], c: r[4], min: n.min };
    if (n.wd >= 1 && n.wd <= 5) { if (!ny.has(n.day)) ny.set(n.day, []); ny.get(n.day).push(b); }
    const u = new Date(r[0] * 1000), ud = u.toISOString().slice(0, 10), uw = u.getUTCDay();
    if (uw >= 1 && uw <= 5) { const x = utc.get(ud); if (!x) utc.set(ud, { day: ud, o: r[1], h: r[2], l: r[3], c: r[4] }); else { x.h = Math.max(x.h, r[2]); x.l = Math.min(x.l, r[3]); x.c = r[4]; } }
  }
  return { ny, utc: [...utc.values()].sort((a, b) => (a.day < b.day ? -1 : 1)) };
}
// ATR(14) of the 14 complete UTC weekdays strictly before `day`: map day -> atr
export function atrMap(utcDays, days) {
  const out = new Map(), tr = [];
  let j = 0;
  for (const D of days) {
    while (j < utcDays.length && utcDays[j].day < D) {
      const x = utcDays[j], pc = j > 0 ? utcDays[j - 1].c : x.o;
      tr.push(Math.max(x.h - x.l, Math.abs(x.h - pc), Math.abs(x.l - pc))); j++;
    }
    if (tr.length >= ATR_N) out.set(D, tr.slice(-ATR_N).reduce((s, v) => s + v, 0) / ATR_N);
  }
  return out;
}

// the impulse leg of the 08:30-08:59 New York window
export function impulseOf(bars) {
  const w = bars.filter((b) => b.min >= IMP_FROM && b.min < IMP_TO);
  if (w.length < MIN_IMP) return null;
  const d = Math.sign(w.at(-1).c - w[0].o);
  if (!d) return null;
  let k = 0;
  for (let i = 1; i < w.length; i++) if (d > 0 ? w[i].h > w[k].h : w[i].l < w[k].l) k = i;
  const E = d > 0 ? w[k].h : w[k].l, part = w.slice(0, k + 1);
  const O = d > 0 ? Math.min(...part.map((b) => b.l)) : Math.max(...part.map((b) => b.h));
  const L = d * (E - O);
  return L > 0 ? { d, E, O, L } : null;
}

// manage a position from index k of `post` (the fill candle: stop only); stop first, a gap through the stop fills at the open
export function manage(post, k, side, stop, target) {
  for (let i = k; i < post.length; i++) {
    const b = post[i], fillC = i === k;
    if (!fillC && side * (b.o - stop) <= 0) return { exit: b.o, how: 'stop', at: b.min, t: b.t };
    if (side > 0 ? b.l <= stop : b.h >= stop) return { exit: stop, how: 'stop', at: b.min, t: b.t };
    if (!fillC && target != null && (side > 0 ? b.h >= target : b.l <= target)) return { exit: target, how: 'target', at: b.min, t: b.t };
  }
  const z = post.at(-1);
  return { exit: z.c, how: 'time', at: z.min, t: z.t + 300 };
}
const finR = (side, entry, r, t0, t1) => (side > 0 ? nights(t0, t1) * FIN.xau.long * entry / r : 0);

// ─── one day, one rule ───  bars: the New York day's M5 candles in time order ({t,o,h,l,c,min}); atr of earlier days
export function impulseTrade(bars, { atr, tgt = 'r', size = SIZE1, cost = COST } = {}) {
  if (!(atr > 0)) return { skip: 'warmup' };
  const im = impulseOf(bars);
  if (!im) return { skip: 'impulse' };
  if (im.L < size * atr) return { skip: 'small' };
  const { d, E, O, L } = im, M = E - d * FRAC * L, stop = O - d * BUF;
  const post = bars.filter((b) => b.min >= IMP_TO && b.min < EXIT);
  let k = -1, entry = NaN;
  for (let i = 0; i < post.length && post[i].min < ORDER_END; i++) {
    const b = post[i];
    if (d > 0 ? b.l <= M : b.h >= M) { entry = d > 0 ? Math.min(b.o, M) : Math.max(b.o, M); k = i; break; }
  }
  if (k < 0) return { skip: 'nofill' };
  const r = d * (entry - stop);
  if (!(r > 0)) return { skip: 'paststop' };
  const target = tgt === 'ext' ? E : entry + d * TGT * r;
  const x = manage(post, k, d, stop, target);
  const R = d * (x.exit - entry) / r, fin = finR(d, entry, r, post[k].t, x.t);
  return { side: d, E, O, L, atr, M, fillAt: post[k].min, entry, stop, target, r, exit: x.exit, how: x.how, exitAt: x.at,
    fin, R, net: R - cost / r - fin, net2: R - 2 * cost / r - fin };
}

// placebo: market at the open of the first candle at or after `start` (before 11:00 NY), the impulse's side, stop `width` away
export function placeboTrade(bars, { start, side, width, tdist, cost = COST }) {
  const post = bars.filter((b) => b.min >= start && b.min < EXIT);
  if (!post.length || post[0].min >= ORDER_END || !(width > 0)) return null;
  const entry = post[0].o, stop = entry - side * width, target = entry + side * tdist;
  const x = manage(post, 0, side, stop, target), R = side * (x.exit - entry) / width, fin = finR(side, entry, width, post[0].t, x.t);
  return { R, net: R - cost / width - fin, net2: R - 2 * cost / width - fin };
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
  const rs = tr.map((x) => x.r).sort((a, b) => a - b);
  const side = (s) => { const a = tr.filter((x) => x.side === s); return { n: a.length, netR: r3(mean(a.map((x) => x.net))), grossR: r3(mean(a.map((x) => x.R))), t: r2(monthT(a).t) }; };
  return { n: tr.length, win: r3(tr.filter((x) => x.net > 0).length / (tr.length || 1)), netR: r3(mean(net)), grossR: r3(mean(tr.map((x) => x.R))),
    net2R: r3(mean(tr.map((x) => x.net2))), costR: r3(mean(tr.map((x) => x.R - x.net))), finR: r3(mean(tr.map((x) => x.fin))),
    total: r2(net.reduce((s, v) => s + v, 0)), months: mt.months, t: r2(mt.t), grossT: r2(gt.t), t2x: r2(t2.t),
    stops: tr.filter((x) => x.how === 'stop').length, targets: tr.filter((x) => x.how === 'target').length, time: tr.filter((x) => x.how === 'time').length,
    maxDD: r2(dd), medianStop: rs.length ? r2(rs[Math.floor(rs.length / 2)]) : null, buys: side(1), sells: side(-1), byYear };
}

// ─── the whole run ───
export const inW = (day, [a, b]) => day >= a && day <= b;
export function prepare(rows) {
  const { ny, utc } = groupDays(rows);
  const keys = [...ny.keys()].sort().filter((D) => D >= WINDOWS.IS[0] && D <= WINDOWS.OOS[1]);
  const atr = atrMap(utc, keys);
  return keys.map((D) => ({ day: D, atr: atr.get(D), bars: ny.get(D) }));
}
export function runTest(days, test) {
  const tr = [], skips = {};
  for (const d of days) {
    const x = impulseTrade(d.bars, { atr: d.atr, tgt: test.tgt, size: test.size });
    if (x.skip) skips[x.skip] = (skips[x.skip] || 0) + 1; else tr.push({ day: d.day, ...x });
  }
  return { tr, skips };
}
export function placebo(days, trades, seeds = SEEDS) {
  const byDay = new Map(days.map((d) => [d.day, d.bars])), grid = (PLACEBO.to - PLACEBO.from) / 5 + 1, out = [];
  const oos = trades.filter((x) => inW(x.day, WINDOWS.OOS));
  for (let seed = 1; seed <= seeds; seed++) {
    const rand = rng(seed), v = [];
    for (const x of oos) {
      const start = PLACEBO.from + 5 * Math.floor(rand() * grid);
      const p = placeboTrade(byDay.get(x.day), { start, side: x.side, width: x.r, tdist: Math.abs(x.target - x.entry) });
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
    const checks = { netPos: o.netR > 0, n30: o.n >= 30, t2: o.t >= 2, holm: adj[i] < 0.05, isPos: res[k].IS.netR > 0, cost2x: o.net2R > 0, placebo: beaten >= 38 };
    d[k] = { p: r3(ps[i]), pHolm: r3(adj[i]), beaten, checks, pass: Object.values(checks).every(Boolean) };
  });
  return d;
}

// ─── report (RESULT.md is this function of result.json) ───
const sg = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3));
const s2 = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2));
export function verdictLine(res, dec) {
  const n = Object.values(dec).filter((x) => x.pass).length, o = res.T1.OOS;
  return `${n ? 'PASS' : 'FAIL'}, ${n} of 3: buying / selling the 50 % pullback of gold's 08:30 NY impulse, 2017 → now ${sg(o.netR)}R a trade net (n ${o.n}, month t ${s2(o.t)}, gross ${sg(o.grossR)}R); 2007-16 ${sg(res.T1.IS.netR)}R`;
}
const PER = { IS: '2007-2016', OOS: '2017 → 2026-11-13', H1: '2017-2021', H2: '2022 → 2026-11-13' };
export function report(R) {
  const L = [], T = R.tests, yn = (b) => (b ? 'yes' : 'no');
  L.push('# Gold: the first pullback after the 08:30 New York impulse', '');
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
  L.push('| Test | p | Holm p | net > 0 | n ≥ 30 | t ≥ 2 | Holm < 0.05 | 2007-16 > 0 | 2x cost > 0 | placebos beaten (need 38 of 40) | pass |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, d] of Object.entries(R.decision)) { const c = d.checks; L.push(`| ${k} | ${d.p} | ${d.pHolm} | ${yn(c.netPos)} | ${yn(c.n30)} | ${yn(c.t2)} | ${yn(c.holm)} | ${yn(c.isPos)} | ${yn(c.cost2x)} | ${d.beaten} | **${d.pass ? 'pass' : 'fail'}** |`); }
  L.push('', `**Placebo** (an unconditional same-side baseline: on each out-of-sample day the test traded, market entry at a random M5 open 09:00-10:55 New York on the impulse's side, stop at the trade's own 1R distance, the test's target and 16:00 New York exit, same cost; ${R.placebo.seeds} seeds):`, '');
  for (const k of Object.keys(T)) { const p = R.placebo[k]; L.push(`- ${k}: seed means ${sg(p.min)} to ${sg(p.max)}R a trade, median ${sg(p.median)}, 95th percentile ${sg(p.p95)}R.`); }
  L.push('', '## Buys and sells (net R a trade, n, month t)', '');
  L.push('| Test | Period | Buys | Sells |', '|---|---|---|---|');
  for (const k of Object.keys(T)) for (const w of ['IS', 'OOS']) { const x = T[k][w]; L.push(`| ${k} | ${PER[w]} | ${sg(x.buys.netR)} (n ${x.buys.n}, t ${s2(x.buys.t)}; gross ${sg(x.buys.grossR)}) | ${sg(x.sells.netR)} (n ${x.sells.n}, t ${s2(x.sells.t)}; gross ${sg(x.sells.grossR)}) |`); }
  L.push('', 'Days without a trade, whole period: ' + Object.keys(T).map((k) => `${k} ${Object.entries(T[k].skips).map(([a, b]) => `${a} ${b}`).join(', ')}`).join('; ') + '.', '');
  L.push('## By year (net R a trade, n)', '');
  const ys = [...new Set(Object.values(T).flatMap((x) => [...Object.keys(x.IS.byYear), ...Object.keys(x.OOS.byYear)]))].sort();
  L.push('| Year | ' + Object.keys(T).join(' | ') + ' |', '|---|' + Object.keys(T).map(() => '---|').join(''));
  for (const y of ys) L.push(`| ${y} | ` + Object.keys(T).map((k) => { const b = T[k].IS.byYear[y] || T[k].OOS.byYear[y]; return b ? `${sg(b.netR)} (${b.n})` : '—'; }).join(' | ') + ' |');
  L.push('', '## Reading', '', R.reading, '');
  L.push('## Data and method', '');
  L.push(`- ${R.data}`);
  L.push(`- Rule: ${R.rule}`);
  L.push(`- Costs: $${R.cost.toFixed(2)} a round trip per ounce (spread and slippage), 2x reported; financing on buys by \`council/fills.mjs\` \`nights\` x \`FIN.xau.long\` (${R.fin.rate} of price a rollover): ${R.fin.note}`);
  L.push('- Decided while coding, before the first run: the ATR\'s "complete UTC days" are Monday-Friday UTC days (the Sunday reopen stub is left out); 2006 New York days are not traded, so the old US daylight rule of 2006 is not needed.');
  L.push('- To repeat: `node research/edge/gold-ny-impulse-pullback/run.mjs <xau-5m.json.gz>` (OANDA mid M5 XAU/USD as `[unixSec, o, h, l, c]` rows, kept out of git).');
  return L.join('\n') + '\n';
}

// ─── main ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const file = process.argv[2]; if (!file) throw new Error('usage: node run.mjs <xau-5m.json.gz>');
  const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)));
  const days = prepare(rows), res = {}, pl = {};
  let finSum = 0, finN = 0;
  for (const [k, t] of Object.entries(TESTS)) {
    const { tr, skips } = runTest(days, t), f = (w) => summary(tr.filter((x) => inW(x.day, w)));
    for (const x of tr) { finSum += x.fin; finN++; }
    res[k] = { name: t.name, skips, IS: f(WINDOWS.IS), OOS: f(WINDOWS.OOS), H1: f(HALVES.H1), H2: f(HALVES.H2) };
    pl[k] = placebo(days, tr);
  }
  if (finSum !== 0) throw new Error('a trade was charged financing: the 16:00 New York exit should be before every rollover');
  const dec = decide(res, pl);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const o = res.T1.OOS, fail = (k) => Object.entries(dec[k].checks).filter(([, v]) => !v).map(([c]) => c).join(', ');
  const line = (k) => `${k} ${sg(res[k].OOS.netR)}R (n ${res[k].OOS.n}, t ${s2(res[k].OOS.t)}, gross ${sg(res[k].OOS.grossR)}R; 2007-16 ${sg(res[k].IS.netR)}R; ${dec[k].pass ? 'passes' : `failed: ${fail(k)}`})`;
  const pass = Object.values(dec).some((d) => d.pass);
  const reading = (pass ? 'At least one test passes every pre-registered check. Paper research only; at most a lead for the owner, to be replicated before anything else. ' : 'No test passes the pre-registered bar. ')
    + `Out of sample: ${line('T1')}; ${line('T2')}; ${line('T3')}. Costs take ${sg(o.costR).replace('+', '')}R a trade on T1 at a median stop of $${o.medianStop}. `
    + `Buys ${sg(o.buys.netR)}R (n ${o.buys.n}) and sells ${sg(o.sells.netR)}R (n ${o.sells.n}) out of sample on T1. `
    + `Placebo seeds beaten: T1 ${dec.T1.beaten}, T2 ${dec.T2.beaten}, T3 ${dec.T3.beaten} of 40. `
    + (pass ? '' : 'Not an edge; nothing live changes and no proposal is written.');
  const result = { study: 'gold-ny-impulse-pullback', built: '2026-11-14', preregistration: 'research/edge/gold-ny-impulse-pullback/PREREGISTRATION.md', planSha256: sha,
    claim: 'the first pullback to the middle of gold\'s 08:30-09:00 New York impulse, entered with the impulse, carries on through the US session',
    rule: 'New York weekdays; impulse = the M5 candles 08:30-08:55 NY (5+), direction = sign(last close - first open), leg from the origin (low/high up to the extreme) to the extreme, at least 0.25 x ATR(14) of the earlier UTC weekdays; at 09:00 NY a limit at the 50 % retrace, live on candles 09:00-10:55 NY (a gap fills at the open); stop $0.30 beyond the origin; in the fill candle only the stop counts; T1 target 1.5R else out 16:00 NY; T2 target = the impulse extreme; T3 = T1 with the leg at least 0.5 x ATR; stop first, a gap through the stop fills at the open; one trade a day',
    data: `OANDA mid XAU/USD M5 (keyless candle proxy), ${days.length} New York weekdays ${days[0].day} → ${days.at(-1).day}, New York time by the US daylight rule since 2007`,
    cost: COST, fin: { rate: FIN.xau.long, src: FIN.xau.src, charged: finSum, trades: finN, note: `charged on ${finN} test trades, total ${finSum}R: every exit is at or before 16:00 New York, before the rollover.` },
    windows: WINDOWS, halves: HALVES, verdict: verdictLine(res, dec), decision: dec, tests: res,
    placebo: { seeds: SEEDS, start: '09:00-10:55 New York, the impulse\'s side', ...Object.fromEntries(Object.keys(TESTS).map((k) => [k, { means: pl[k], min: Math.min(...pl[k]), max: Math.max(...pl[k]), median: r3(quantile(pl[k], 0.5)), p95: r3(quantile(pl[k], 0.95)) }])) },
    reading };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(result, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(result));
  console.log(result.verdict);
  for (const k of Object.keys(TESTS)) console.log(k, JSON.stringify({ IS: [res[k].IS.n, res[k].IS.netR, res[k].IS.grossR, res[k].IS.t], OOS: [res[k].OOS.n, res[k].OOS.netR, res[k].OOS.grossR, res[k].OOS.t, res[k].OOS.grossT, res[k].OOS.net2R], H: [res[k].H1.netR, res[k].H2.netR] }), dec[k].pHolm, dec[k].beaten, res[k].skips);
}
