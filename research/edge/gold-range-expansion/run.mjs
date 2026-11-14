// Spot gold after a range-expansion day (PREREGISTRATION.md, pushed first). A stand-alone daily rule: no book rule or
// position is read or touched. Paper only.
//   node research/edge/gold-range-expansion/run.mjs   reads council-data research/daily/xau.json (git show, no network, no
//                                                    cache written) -> result.json and RESULT.md, prints the tables
// Pure pieces are exported for the test.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN, stopFill } from '../../../council/fills.mjs';

export const COST = 0.60, ATR_N = 20, ATR_K = 2, RANGE_K = 1.75, CL_HI = 0.75, CL_LO = 0.25, SEED = 20261114, SEEDS = 40, BEAT = 38;
export const IS = ['2007-01', '2016-12'], OOS = ['2017-01', '2026-10'];
// with: +1 = trade with the expansion day's close, -1 = against it; hold in trading days after the entry candle
export const TESTS = {
  T1: { with: 1, hold: 5, what: 'continuation: with the close, D close -> D+5 close' },
  T2: { with: -1, hold: 1, what: 'fade: against the close, D close -> D+1 close' },
  T3: { with: 1, hold: 20, what: 'continuation: with the close, D close -> D+20 close' },
};
const H = 3600;
export const dateOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const closeTime = (t) => t + (new Date(t * 1000).getUTCDay() === 5 ? 21 : 23) * H;

export function prepare(rows) {
  return { bars: foldWeekend(rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }))) };
}
const trOf = (bars, k) => { const x = bars[k], pc = bars[k - 1].close; return Math.max(x.high - x.low, Math.abs(x.high - pc), Math.abs(x.low - pc)); };
// ATR of the n candles ending at index e (inclusive)
export function atr(bars, e, n = ATR_N) { if (e - n + 1 < 1) return null; let s = 0; for (let k = e - n + 1; k <= e; k++) s += trOf(bars, k); return s / n; }
// the event on candle i: +1 up-expansion, -1 down-expansion, 0 none. Reads candles <= i only; ATR of the 20 candles BEFORE i.
export function eventAt(bars, i) {
  const a = atr(bars, i - 1); if (!a) return 0;
  const x = bars[i], rg = x.high - x.low; if (!(rg > 0) || !(rg >= RANGE_K * a)) return 0;
  const cl = (x.close - x.low) / rg;
  return cl >= CL_HI ? 1 : cl <= CL_LO ? -1 : 0;
}
// one trade: enter at the close of candle i, out at the close of candle j or at the stop. side +1 long, -1 short.
// Stop 2 x ATR(20) of the candles up to and including the entry candle (all closed at entry).
export function trade(P, i, j, side, { cost = COST, finMult = 1 } = {}) {
  const { bars } = P;
  if (i == null || j == null || !(j > i) || i < ATR_N || j >= bars.length) return null;
  const entry = bars[i].close, risk = ATR_K * atr(bars, i), stop = entry - side * risk;
  if (!(risk > 0)) return null;
  let exit = bars[j].close, how = 'time', tOut = closeTime(bars[j].time), k0 = j;
  for (let k = i + 1; k <= j; k++) { const x = bars[k];
    if (side > 0 ? x.low <= stop : x.high >= stop) { exit = stopFill(x, side < 0, stop, true); how = 'stop'; tOut = closeTime(x.time); k0 = k; break; } }
  const R = side * (exit - entry) / risk, nn = side > 0 ? nights(closeTime(bars[i].time), tOut) : 0;
  const fin = finMult * nn * FIN.xau.long * entry / risk;
  return { a: dateOf(bars[i].time), b: dateOf(bars[k0].time), out: k0, side, entry, stop, risk, exit, how, R, fin, net: R - cost / risk - fin };
}
// every event day with its direction; mk = the entry (event) candle's month
export function events(P) {
  const out = [];
  for (let i = ATR_N + 1; i < P.bars.length; i++) { const d = eventAt(P.bars, i); if (d) out.push({ i, dir: d, mk: dateOf(P.bars[i].time).slice(0, 7) }); }
  return out;
}
// one position at a time: walk the events in order, skip one whose entry comes before the previous trade's exit candle
export function run(P, evs, test, opt) {
  const { with: w, hold } = TESTS[test], T = []; let busy = -1, skipped = 0, offFile = 0;
  for (const e of evs) {
    if (e.i < busy) { skipped++; continue; }
    const t = trade(P, e.i, e.i + hold, w * e.dir, opt);
    if (!t) { offFile++; continue; }
    T.push({ ...t, mk: e.mk, dir: e.dir, i: e.i }); busy = t.out;
  }
  return { T, skipped, offFile };
}

// statistics
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sdOf = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
function betacf(a, b, x) {
  let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d; let h = d;
  for (let m = 1; m <= 300; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d;
    const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-14) break; }
  return h;
}
function lgamma(z) { const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = z, y = z, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (const c of g) s += c / ++y; return -t + Math.log(2.5066282746310005 * s / x); }
function ibeta(x, a, b) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
}
export const pUpper = (t, df) => { const p2 = ibeta(df / (df + t * t), df / 2, 0.5) / 2; return t >= 0 ? p2 : 1 - p2; };
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((x, y) => x[0] - y[0]), out = Array(ps.length); let r0 = 0;
  o.forEach(([p, i], r) => { r0 = Math.max(r0, Math.min(1, (ps.length - r) * p)); out[i] = r0; });
  return out;
}
export function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// t on calendar-month sums (trades grouped by the month of their entry)
export function monthT(T, key = 'net') {
  const by = new Map(); for (const x of T) { const k = x.a.slice(0, 7); by.set(k, (by.get(k) || 0) + x[key]); }
  const v = [...by.values()], n = v.length; if (n < 3) return { months: n, t: null, p: null };
  const sd = sdOf(v), t = sd ? mean(v) / (sd / Math.sqrt(n)) : 0;
  return { months: n, t, p: pUpper(t, n - 1) };
}
const inW = (mk, w) => mk >= w[0] && mk <= w[1];
const r3 = (x) => x == null ? null : +x.toFixed(3), r2 = (x) => x == null ? null : +x.toFixed(2), r4 = (x) => x == null ? null : +x.toFixed(4);
export function summary(T) {
  if (!T.length) return { n: 0 };
  const mt = monthT(T), mg = monthT(T, 'R');
  return { n: T.length, net: r3(mean(T.map((x) => x.net))), gross: r3(mean(T.map((x) => x.R))), tNet: r2(mt.t), tGross: r2(mg.t), p: r4(mt.p), months: mt.months,
    win: r2(100 * T.filter((x) => x.net > 0).length / T.length), stops: T.filter((x) => x.how === 'stop').length, total: r2(T.reduce((s, x) => s + x.net, 0)),
    longs: T.filter((x) => x.side > 0).length };
}
// placebo: every out-of-sample trade replaced by a trade of the same side and hold, entry a random other candle of the same
// calendar month as the event's entry; a seed's statistic = mean net R
export function placebo(P, T, hold, seeds = SEEDS, seed = SEED) {
  const M = new Map(); P.bars.forEach((b, i) => { const k = dateOf(b.time).slice(0, 7); if (!M.has(k)) M.set(k, []); M.get(k).push(i); });
  const out = [];
  for (let s = 0; s < seeds; s++) {
    const rng = mulberry32(seed + s), got = [];
    for (const e of T) {
      const cand = (M.get(e.mk) || []).filter((i) => i !== e.i);
      for (let tries = 0; tries < 30 && cand.length; tries++) {
        const i = cand[Math.floor(rng() * cand.length)], t = trade(P, i, i + hold, e.side);
        if (t) { got.push(t); break; }
      }
    }
    out.push(mean(got.map((x) => x.net)));
  }
  return out;
}

export function study(rows) {
  const P = prepare(rows), all = events(P), evs = all.filter((e) => inW(e.mk, [IS[0], OOS[1]]));
  const cnt = (W) => { const x = evs.filter((e) => inW(e.mk, W)); return { all: x.length, up: x.filter((e) => e.dir > 0).length, down: x.filter((e) => e.dir < 0).length }; };
  const out = { data: { first: dateOf(P.bars[0].time), last: dateOf(P.bars.at(-1).time), candles: P.bars.length, fold: 'UTC days, weekends folded into Monday (fills.mjs foldWeekend)' },
    rules: { cost: COST, cost2x: 2 * COST, stop: `${ATR_K} x ATR(${ATR_N})`, event: `range >= ${RANGE_K} x ATR(${ATR_N}) of the 20 candles before, close in the outer quarter (CL >= ${CL_HI} up, <= ${CL_LO} down)`,
      fin: FIN.xau.long, IS, OOS, tests: Object.fromEntries(Object.entries(TESTS).map(([k, v]) => [k, v.what])) },
    events: { is: cnt(IS), oos: cnt(OOS) }, tests: {} };
  const ps = [];
  for (const k of Object.keys(TESTS)) {
    const { hold } = TESTS[k], r = {};
    const A = run(P, evs, k), A2 = run(P, evs, k, { cost: 2 * COST, finMult: 2 });
    const X = run(P, evs.map((e) => ({ ...e, dir: -e.dir })), k);
    r.skipped = A.skipped; r.offFile = A.offFile;
    for (const [w, W] of [['is', IS], ['oos', OOS]]) {
      const f = (x) => inW(x.mk, W), T2 = A2.T.filter(f);
      r[w] = { ...summary(A.T.filter(f)), net2x: T2.length ? r3(mean(T2.map((x) => x.net))) : null, opposite: summary(X.T.filter(f)) };
    }
    const byYear = {}; for (const x of A.T) { const y = x.a.slice(0, 4); (byYear[y] ||= []).push(x.net); }
    r.byYear = Object.fromEntries(Object.entries(byYear).map(([y, v]) => [y, { n: v.length, net: r3(mean(v)) }]));
    const pl = placebo(P, A.T.filter((x) => inW(x.mk, OOS)), hold);
    r.placebo = { seeds: SEEDS, beaten: pl.filter((v) => r.oos.net > v).length, mean: r3(mean(pl)), max: r3(Math.max(...pl)), min: r3(Math.min(...pl)) };
    r.hold = hold; r.with = TESTS[k].with > 0 ? 'with the close' : 'against the close';
    out.tests[k] = r; ps.push(r.oos.p);
  }
  const adj = holm(ps);
  Object.keys(TESTS).forEach((k, i) => { const r = out.tests[k]; r.holm = r4(adj[i]);
    r.checks = { oosNetPos: r.oos.net > 0, oosT2: r.oos.tNet >= 2, holm: adj[i] < 0.05, isSameSign: r.is.net > 0, cost2x: r.oos.net2x > 0, placebo: r.placebo.beaten >= BEAT };
    r.pass = Object.values(r.checks).every(Boolean); });
  out.verdict = out.tests.T1.pass ? 'PASS' : 'FAIL';
  out.passed = Object.keys(TESTS).filter((k) => out.tests[k].pass);
  return out;
}

const NAMES = { oosNetPos: 'out-of-sample net R > 0', oosT2: 'out-of-sample month t >= 2', holm: 'Holm p < 0.05', isSameSign: 'in-sample net R > 0',
  cost2x: 'net R > 0 at 2x costs', placebo: '38 of 40 placebos' };
const sg = (v, d = 3) => v == null ? 'n/a' : (v >= 0 ? '+' : '') + v.toFixed(d);
export function verdictLine(res) {
  const T1 = res.tests.T1;
  return `**Verdict: ${res.verdict}, ${res.passed.length} of 3: buying or selling with a wide gold day's close for 5 days made ${sg(T1.oos.net)}R a trade net out of sample (n ${T1.oos.n}, month t ${T1.oos.tNet.toFixed(2)}), ${sg(T1.is.net)}R in sample; ${T1.placebo.beaten} of 40 placebos.**`;
}
export function report(res) {
  const L = [];
  L.push(`# Result: spot gold after a range-expansion day (14 Nov 2026)`, '');
  L.push(verdictLine(res), '');
  L.push('A stand-alone daily rule of its own: no rule or position of the live gold book was read, tested or touched',
    '(docs/owner-decisions.md item 44). Pre-registration: `PREREGISTRATION.md` (pushed alone before any figure). Code: `run.mjs`.',
    'Every figure: `result.json`; this page is written by `run.mjs` from it. Nothing is an edge here; nothing live changed and no',
    'proposal is written.', '');
  const d = res.data, e = res.events;
  L.push('## Data and rule', '',
    `Council-data \`research/daily/xau.json\` (OANDA mid spot gold, UTC daily candles, weekends folded into Monday with`,
    `\`fills.mjs\` \`foldWeekend\`), ${d.first} to ${d.last}, ${d.candles} trading days. Event day D: ${res.rules.event}.`,
    `Event days by entry month: in sample ${res.rules.IS.join(' to ')} ${e.is.all} (${e.is.up} up, ${e.is.down} down), out of sample`,
    `${res.rules.OOS.join(' to ')} ${e.oos.all} (${e.oos.up} up, ${e.oos.down} down). Entry at D's close, one position at a time per test, stop`,
    `${res.rules.stop} (a gap through it fills at the open), $${res.rules.cost.toFixed(2)} a round trip and \`FIN\` financing (${res.rules.fin} of price a`,
    'rollover) on buys; 2x costs = $1.20 and twice the financing. t on calendar-month sums, one-sided, Holm over the three tests.', '');
  L.push('## The tests (net of costs, R a trade)', '',
    '| Test | Rule | Window | n | Net R | Month t | Gross R | Gross t | Win % | Stops | Total R | Net at 2x | Holm p | Placebo beaten | Pass |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, r] of Object.entries(res.tests)) for (const w of ['is', 'oos']) { const x = r[w];
    L.push(`| ${k} | ${res.rules.tests[k]} | ${w === 'is' ? 'in sample' : 'out of sample'} | ${x.n} | ${sg(x.net)} | ${x.tNet.toFixed(2)} | ${sg(x.gross)} | ${x.tGross.toFixed(2)} | ${x.win} | ${x.stops} | ${sg(x.total, 2)} | ${sg(x.net2x)} | ${w === 'oos' ? `${r.holm} | ${r.placebo.beaten} | ${r.pass ? 'yes' : 'no'}` : '| |'} |`); }
  L.push('', 'Events skipped because the previous trade of the same test was still open: ' +
    Object.entries(res.tests).map(([k, r]) => `${k} ${r.skipped}`).join(', ') + '; dropped because the exit is not on file yet: ' +
    Object.entries(res.tests).map(([k, r]) => `${k} ${r.offFile}`).join(', ') + '.', '');
  L.push('## Checks of each test (all must hold)', '', '| Test | OOS net > 0 | OOS month t >= 2 | Holm p < 0.05 | in sample > 0 | > 0 at 2x costs | >= 38 of 40 placebos |', '|---|---|---|---|---|---|---|');
  for (const [k, r] of Object.entries(res.tests)) { const c = r.checks, y = (b) => b ? 'yes' : 'no';
    L.push(`| ${k} | ${y(c.oosNetPos)} | ${y(c.oosT2)} | ${y(c.holm)} | ${y(c.isSameSign)} | ${y(c.cost2x)} | ${y(c.placebo)} |`); }
  L.push('', '## Placebo (40 seeded draws, out of sample)', '',
    'Every out-of-sample trade replaced by one of the same side and hold entered on a random other day of the same calendar month.', '',
    '| Test | Rule net R | Placebo mean | min | max | Seeds beaten |', '|---|---|---|---|---|---|');
  for (const [k, r] of Object.entries(res.tests)) L.push(`| ${k} | ${sg(r.oos.net)} | ${sg(r.placebo.mean)} | ${sg(r.placebo.min)} | ${sg(r.placebo.max)} | ${r.placebo.beaten} of ${r.placebo.seeds} |`);
  L.push('', '## The opposite side (reported, not judged)', '', '| Test | Window | n | Net R | Month t |', '|---|---|---|---|---|');
  for (const [k, r] of Object.entries(res.tests)) for (const w of ['is', 'oos']) { const x = r[w].opposite;
    L.push(`| ${k} reversed | ${w === 'is' ? 'in sample' : 'out of sample'} | ${x.n} | ${sg(x.net)} | ${x.tNet.toFixed(2)} |`); }
  L.push('', '## T1 by year (net R a trade)', '', '| Year | n | Net R |', '|---|---|---|');
  for (const [y, v] of Object.entries(res.tests.T1.byYear)) L.push(`| ${y} | ${v.n} | ${sg(v.net)} |`);
  L.push('', '## Reading', '');
  const T1 = res.tests.T1;
  L.push(res.verdict === 'PASS'
    ? `T1 passes every pre-registered check. A pass on one study is a proposal for the owner, not a live rule; nothing live changed.`
    : `Not an edge. T1 fails ${Object.entries(T1.checks).filter(([, v]) => !v).map(([c]) => NAMES[c]).join(', ')}. ${res.passed.length ? `Passed: ${res.passed.join(', ')} (secondary; the verdict rests on T1).` : 'T2 and T3 fail too.'} ` +
      `The placebo says why the in-sample figure misleads: a trade of the same side entered on a random other day of the same month made ${sg(T1.placebo.mean)}R on average out of sample, more than the rule's ${sg(T1.oos.net)}R, so the wide day picks no better moment than any other day of the same month to trade that way (the placebo knows the month, so it is a hard comparison, as pre-registered). No proposal; nothing live changed.`, '');
  return L.join('\n');
}

const here = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const raw = execFileSync('git', ['show', 'origin/council-data:research/daily/xau.json'], { maxBuffer: 64e6 }).toString();
  const res = { study: 'gold-range-expansion', built: '2026-11-14', ...study(JSON.parse(raw).rows) };
  fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  fs.writeFileSync(path.join(here, 'RESULT.md'), report(res) + '\n');
  console.log(JSON.stringify({ verdict: res.verdict, data: res.data, events: res.events }));
  for (const [k, r] of Object.entries(res.tests)) console.log(k, JSON.stringify({ is: r.is, oos: r.oos, placebo: r.placebo, holm: r.holm, checks: r.checks, skipped: r.skipped }));
}
