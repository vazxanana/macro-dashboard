// Spot gold's first week of the month, followed to the month's end (PREREGISTRATION.md, pushed first). A stand-alone rule
// of its own: no book rule or position is read or touched. Paper only.
//   node research/edge/gold-first-week/run.mjs   reads council-data research/daily/xau.json (git show, no network, no cache
//                                               written) -> result.json and RESULT.md, prints the tables
// Pure pieces are exported for the test.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN, stopFill } from '../../../council/fills.mjs';

export const COST = 0.60, ATR_N = 20, ATR_K = 2, SEED = 20261114, SEEDS = 40, BEAT = 38;
export const IS = ['2007-01', '2016-12'], OOS = ['2017-01', '2026-10'];
// k = the trading day of the month whose close gives the signal; minAtr = the strong-start threshold in ATR(20)
export const TESTS = {
  T1: { k: 5, minAtr: 0, what: 'sign of the first 5 trading days (TD-1 close -> TD+5 close), held to the month\'s last close' },
  T2: { k: 10, minAtr: 0, what: 'sign of the first 10 trading days, held to the month\'s last close' },
  T3: { k: 5, minAtr: 1, what: 'as T1, only when the first-week move is at least 1 x ATR(20)' },
};
const H = 3600;
export const dateOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const closeTime = (t) => t + (new Date(t * 1000).getUTCDay() === 5 ? 21 : 23) * H;

export function prepare(rows) {
  const bars = foldWeekend(rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })));
  return { bars };
}
// per calendar month 'YYYY-MM': indices of its folded candles; complete only when a later month's candle is on file
export function months(bars) {
  const m = new Map();
  bars.forEach((b, i) => { const k = dateOf(b.time).slice(0, 7); if (!m.has(k)) m.set(k, []); m.get(k).push(i); });
  const keys = [...m.keys()], out = [];
  keys.forEach((k, n) => { const idx = m.get(k); out.push({ mk: k, first: idx[0], last: idx.at(-1), days: idx.length, complete: n < keys.length - 1 }); });
  return out;
}
export function atr(bars, i, n = ATR_N) {
  if (i < n) return null;
  let tr = 0;
  for (let k = i - n + 1; k <= i; k++) { const x = bars[k], pc = bars[k - 1].close; tr += Math.max(x.high - x.low, Math.abs(x.high - pc), Math.abs(x.low - pc)); }
  return tr / n;
}
// the signal of one month for one test, read only from candles up to and including the entry candle
export function signal(P, M, test) {
  const { k, minAtr } = TESTS[test], { bars } = P;
  const ref = M.first - 1, i = M.first + k - 1;
  if (ref < 0 || i > M.last || i >= M.last) return null;   // the entry must leave at least one candle of the month to hold
  const a = atr(bars, i); if (!(a > 0)) return null;
  const move = bars[i].close - bars[ref].close;
  if (move === 0 || Math.abs(move) < minAtr * a) return null;
  return { i, side: Math.sign(move), move, atr: a };
}
// one trade: enter at the close of candle i, out at the close of candle j or at the stop. side +1 long, -1 short.
export function trade(P, i, j, side, { cost = COST, finMult = 1 } = {}) {
  const { bars } = P;
  if (i == null || j == null || !(j > i) || j >= bars.length) return null;
  const a = atr(bars, i); if (!(a > 0)) return null;
  const entry = bars[i].close, risk = ATR_K * a, stop = entry - side * risk;
  let exit = bars[j].close, how = 'time', tOut = closeTime(bars[j].time);
  for (let k = i + 1; k <= j; k++) { const x = bars[k];
    if (side > 0 ? x.low <= stop : x.high >= stop) { exit = stopFill(x, side < 0, stop, true); how = 'stop'; tOut = closeTime(x.time); break; } }
  const R = side * (exit - entry) / risk, nn = side > 0 ? nights(closeTime(bars[i].time), tOut) : 0;
  const fin = finMult * nn * FIN.xau.long * entry / risk, costR = cost / risk + fin;
  return { a: dateOf(bars[i].time), b: dateOf(bars[j].time), side, entry, stop, risk, exit, how, R, fin, costR, net: R - costR };
}

// statistics
const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const sdOf = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
const median = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
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
  const o = ps.map((p, i) => [p, i]).sort((x, y) => x[0] - y[0]), out = Array(ps.length); let run = 0;
  o.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (ps.length - r) * p)); out[i] = run; });
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
  let eq = 0, hi = 0, dd = 0; for (const x of T) { eq += x.net; hi = Math.max(hi, eq); dd = Math.min(dd, eq - hi); }
  return { n: T.length, longs: T.filter((x) => x.side > 0).length, net: r3(mean(T.map((x) => x.net))), gross: r3(mean(T.map((x) => x.R))),
    tNet: r2(mt.t), tGross: r2(mg.t), p: r4(mt.p), months: mt.months,
    win: r2(100 * T.filter((x) => x.net > 0).length / T.length), stops: T.filter((x) => x.how === 'stop').length,
    total: r2(T.reduce((s, x) => s + x.net, 0)), worstDD: r2(dd), medStop: r2(median(T.map((x) => x.risk))), medCostR: r3(median(T.map((x) => x.costR))) };
}
// placebo: every trade's side replaced by a fair coin (same entry, exit, stop and costs); a seed's statistic = mean net R
export function placebo(P, evs, seeds = SEEDS, seed = SEED) {
  const out = [];
  for (let s = 0; s < seeds; s++) {
    const rng = mulberry32(seed + s);
    const got = evs.map((e) => trade(P, e.i, e.j, rng() < 0.5 ? 1 : -1)).filter(Boolean);
    out.push(mean(got.map((x) => x.net)));
  }
  return out;
}

export function study(rows) {
  const P = prepare(rows), MS = months(P.bars).filter((m) => inW(m.mk, [IS[0], OOS[1]]));
  const out = { data: { first: dateOf(P.bars[0].time), last: dateOf(P.bars.at(-1).time), candles: P.bars.length, fold: 'UTC days, weekends folded into Monday (fills.mjs foldWeekend)' },
    rules: { cost: COST, cost2x: 2 * COST, atr: `${ATR_K} x ATR(${ATR_N})`, fin: FIN.xau.long, IS, OOS, tests: Object.fromEntries(Object.entries(TESTS).map(([k, v]) => [k, v.what])) },
    tests: {}, dropped: {} };
  const ps = [];
  for (const k of Object.keys(TESTS)) {
    const evs = [];
    let dropped = 0;
    for (const M of MS) {
      if (!M.complete) { dropped++; continue; }
      const s = signal(P, M, k); if (s) evs.push({ mk: M.mk, i: s.i, j: M.last, side: s.side });
    }
    const mk = (side, opt) => evs.map((e) => { const t = trade(P, e.i, e.j, side ?? e.side, opt); return t && { ...t, mk: e.mk }; }).filter(Boolean);
    const T = mk(null), T2x = mk(null, { cost: 2 * COST, finMult: 2 }), AL = mk(1), AS = mk(-1);
    out.dropped[k] = dropped + evs.length - T.length;
    const r = {};
    for (const [w, W] of [['is', IS], ['oos', OOS]]) {
      const f = (x) => inW(x.mk, W), t = T.filter(f), al = AL.filter(f), as = AS.filter(f);
      const longMk = new Set(t.filter((x) => x.side > 0).map((x) => x.mk)), shortMk = new Set(t.filter((x) => x.side < 0).map((x) => x.mk));
      r[w] = { ...summary(t), net2x: r3(mean(T2x.filter(f).map((x) => x.net))),
        longs: summary(t.filter((x) => x.side > 0)), shorts: summary(t.filter((x) => x.side < 0)),
        alwaysLong: summary(al), alwaysShort: summary(as),
        // the same months seen from the other side: the rule's buys against being long in the months it sold
        longInShortMonths: summary(al.filter((x) => shortMk.has(x.mk))), shortInLongMonths: summary(as.filter((x) => longMk.has(x.mk))) };
    }
    const byYear = {}; for (const x of T) { const y = x.a.slice(0, 4); (byYear[y] ||= []).push(x.net); }
    r.byYear = Object.fromEntries(Object.entries(byYear).map(([y, v]) => [y, { n: v.length, net: r3(mean(v)) }]));
    const pl = placebo(P, evs.filter((e) => inW(e.mk, OOS))), want = r.oos.net;
    r.placebo = { seeds: SEEDS, beaten: pl.filter((v) => want > v).length, mean: r3(mean(pl)), max: r3(Math.max(...pl)), min: r3(Math.min(...pl)) };
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

// RESULT.md, written from result.json only
const sg = (v, d = 3) => v == null ? '–' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d);
const tt = (v) => v == null ? '–' : (v >= 0 ? '' : '−') + Math.abs(v).toFixed(2);
export function verdictLine(res) {
  const T1 = res.tests.T1, n = res.passed.length;
  return `**Verdict: ${res.verdict}, ${n} of 3: following gold's first-week direction to the month's end made ${sg(T1.oos.net)}R a trade net out of sample (n ${T1.oos.n}, month t ${tt(T1.oos.tNet)}), ${sg(T1.is.net)}R in sample; ${T1.placebo.beaten} of 40 placebos.**`;
}
export function report(res) {
  const L = [];
  L.push('# Result: spot gold\'s first week of the month, followed to the month\'s end (14 Nov 2026)', '', verdictLine(res), '');
  L.push('A stand-alone calendar-direction rule on spot gold: no rule or position of the live gold book was read, tested or',
    'touched (docs/owner-decisions.md item 44). Pre-registration: `PREREGISTRATION.md` (pushed alone before any figure). Code:',
    '`run.mjs`. Every figure: `result.json`; this page is written by `run.mjs` from it. Nothing here is called an edge;',
    'nothing live changed and no proposal is written.', '');
  L.push('## Data and rule', '',
    `Council-data \`research/daily/xau.json\` (OANDA mid spot gold, UTC daily candles, weekends folded into Monday with`,
    `\`fills.mjs\` \`foldWeekend\`), ${res.data.first} to ${res.data.last}, ${res.data.candles} trading days. Signal at the close of`,
    'the month\'s k-th trading day: the sign of that close against the previous month\'s last close; trade that way to the',
    `month's last close. Stop ${res.rules.atr} (a gap through it fills at the open). $${res.rules.cost.toFixed(2)} a round trip and`,
    `\`FIN\` financing (${res.rules.fin} of price a rollover) on buys; 2x costs = $${res.rules.cost2x.toFixed(2)} and twice the financing.`,
    'In sample: months 2007-01 to 2016-12; out of sample: 2017-01 to 2026-10. t on calendar-month sums, one-sided, Holm over three.', '');
  for (const [k, v] of Object.entries(res.rules.tests)) L.push(`- **${k}**: ${v}.`);
  L.push('', '## The tests (R a trade)', '',
    '| Test | Window | n | Net R | Month t | Gross R | Gross t | Win % | Stops | Longs | Total R | Worst DD R | Net at 2x | Median stop $ | Median cost R |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, r] of Object.entries(res.tests)) for (const [w, lab] of [['is', 'in sample'], ['oos', 'out of sample']]) { const x = r[w];
    L.push(`| ${k} | ${lab} | ${x.n} | ${sg(x.net)} | ${tt(x.tNet)} | ${sg(x.gross)} | ${tt(x.tGross)} | ${x.win} | ${x.stops} | ${x.longs.n} | ${sg(x.total, 2)} | ${sg(x.worstDD, 2)} | ${sg(x.net2x)} | ${x.medStop} | ${sg(x.medCostR)} |`); }
  L.push('', '| Test | OOS one-sided p | Holm p | Placebo beaten (of 40) | Placebo mean / max | Pass |', '|---|---|---|---|---|---|');
  for (const [k, r] of Object.entries(res.tests)) L.push(`| ${k} | ${r.oos.p} | ${r.holm} | ${r.placebo.beaten} | ${sg(r.placebo.mean)} / ${sg(r.placebo.max)} | ${r.pass ? 'yes' : 'no'} |`);
  L.push('', '## Longs, shorts and the unconditional baselines (net R a trade, n)', '',
    'Same months, same entry day, hold, stop and costs. "Always long / short" trades every month of the window; "long in the',
    'rule\'s short months" is the always-long trade in the months the rule sold (the side it skipped).', '',
    '| Test | Window | Rule longs | Rule shorts | Always long | Always short | Long in the rule\'s short months | Short in the rule\'s long months |',
    '|---|---|---|---|---|---|---|---|');
  const c = (x) => x.n ? `${sg(x.net)} (${x.n})` : '– (0)';
  for (const [k, r] of Object.entries(res.tests)) for (const [w, lab] of [['is', 'in sample'], ['oos', 'out of sample']]) { const x = r[w];
    L.push(`| ${k} | ${lab} | ${c(x.longs)} | ${c(x.shorts)} | ${c(x.alwaysLong)} | ${c(x.alwaysShort)} | ${c(x.longInShortMonths)} | ${c(x.shortInLongMonths)} |`); }
  const T1 = res.tests.T1;
  L.push('', '## Checks of the pass bar (T1)', '');
  const ck = T1.checks, yn = (b) => b ? 'yes' : 'no';
  L.push(`- Out-of-sample net R > 0: ${yn(ck.oosNetPos)} (${sg(T1.oos.net)}).`, `- Out-of-sample month t >= 2: ${yn(ck.oosT2)} (${tt(T1.oos.tNet)}).`,
    `- Holm p < 0.05: ${yn(ck.holm)} (${T1.holm}).`, `- In-sample net R > 0: ${yn(ck.isSameSign)} (${sg(T1.is.net)}).`,
    `- Out of sample positive at 2x costs: ${yn(ck.cost2x)} (${sg(T1.oos.net2x)}).`, `- Above at least 38 of 40 placebos: ${yn(ck.placebo)} (${T1.placebo.beaten}).`);
  L.push('', '## Net R a trade by entry year (T1)', '', '| Year | n | Net R |', '|---|---|---|');
  for (const [y, v] of Object.entries(T1.byYear)) L.push(`| ${y} | ${v.n} | ${sg(v.net)} |`);
  L.push('', '## Reading', '');
  L.push(...reading(res), '');
  L.push('To repeat: `node research/edge/gold-first-week/run.mjs` (reads council-data with `git show`, no network). Test:',
    '`tests/gold-first-week.test.mjs`.', '');
  return L.join('\n');
}
function reading(res) {
  const T1 = res.tests.T1, o = T1.oos, i = T1.is;
  const out = [];
  out.push(`- T1 ${res.tests.T1.pass ? 'passes' : 'does not pass'} the pre-registered bar; T2 ${res.tests.T2.pass ? 'passes' : 'does not'}, T3 ${res.tests.T3.pass ? 'passes' : 'does not'}. ` +
    `Out of sample T1 is ${sg(o.net)}R a trade net (gross ${sg(o.gross)}R, month t ${tt(o.tNet)}, n ${o.n}); in sample ${sg(i.net)}R (t ${tt(i.tNet)}, n ${i.n}).`);
  out.push(`- Against being long every month (out of sample ${sg(o.alwaysLong.net)}R, n ${o.alwaysLong.n}) the rule's buys made ${sg(o.longs.net)}R (n ${o.longs.n}) and its sells ${sg(o.shorts.net)}R (n ${o.shorts.n}); ` +
    `in the months it sold, a buy would have made ${sg(o.longInShortMonths.net)}R. The coin-flip placebo averaged ${sg(T1.placebo.mean)}R; T1 beat ${T1.placebo.beaten} of 40.`);
  out.push(`- Costs: median stop $${o.medStop} out of sample ($${i.medStop} in sample); median cost ${sg(o.medCostR)}R a trade (buys carry the financing).`);
  out.push('- Not an edge: never a council rule, filter, gate or size of the gold book. A further test of this idea needs its own pre-registration on other data.');
  return out;
}

const here = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const raw = execFileSync('git', ['show', 'origin/council-data:research/daily/xau.json'], { maxBuffer: 64e6 }).toString();
  const res = { study: 'gold-first-week', built: '2026-11-14', ...study(JSON.parse(raw).rows) };
  fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  fs.writeFileSync(path.join(here, 'RESULT.md'), report(res));
  console.log(JSON.stringify({ verdict: res.verdict, data: res.data, dropped: res.dropped }, null, 0));
  for (const [k, r] of Object.entries(res.tests)) console.log(k, JSON.stringify({ is: { n: r.is.n, net: r.is.net, t: r.is.tNet, g: r.is.gross }, oos: { n: r.oos.n, net: r.oos.net, t: r.oos.tNet, g: r.oos.gross, tg: r.oos.tGross, net2x: r.oos.net2x }, placebo: r.placebo, holm: r.holm, checks: r.checks }));
}
