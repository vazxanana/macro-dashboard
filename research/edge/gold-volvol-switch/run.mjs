// Gold's volatility trend picks the trade: a 20-day breakout while the 20-day ATR is rising, a 5-day close reversal while it
// is falling (PREREGISTRATION.md, pushed first). A stand-alone daily rule: no book rule or position is read or touched.
//   node research/edge/gold-volvol-switch/run.mjs   reads council-data research/daily/xau.json (git show, no network, no
//                                                  cache written) -> result.json and RESULT.md, prints the tables
// Pure pieces are exported for the test. Paper only.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN, stopFill } from '../../../council/fills.mjs';

export const COST = 0.60, ATR_N = 20, ATR_LAG = 10, ATR_K = 2, BO_N = 20, RV_N = 5, HOLD = 10, SEED = 20261114, SEEDS = 40, BEAT = 38;
export const IS = ['2007-01', '2016-12'], OOS = ['2017-01', '2026-10'];
// which signal each regime takes: B = 20-day breakout, V = 5-day close reversal, null = none
export const TESTS = {
  T1: { rising: 'B', falling: 'V', what: 'the switch: breakout when ATR rises, reversal when it falls' },
  T2: { rising: 'B', falling: null, what: 'breakout leg alone (rising ATR)' },
  T3: { rising: null, falling: 'V', what: 'reversal leg alone (falling ATR)' },
};
export const EXTRA = {
  inverted: { rising: 'V', falling: 'B', what: 'inverted switch (reversal when ATR rises, breakout when it falls)' },
  allB: { rising: 'B', falling: 'B', what: 'every breakout signal, no regime' },
  allV: { rising: 'V', falling: 'V', what: 'every reversal signal, no regime' },
};
const H = 3600;
export const dateOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const closeTime = (t) => t + (new Date(t * 1000).getUTCDay() === 5 ? 21 : 23) * H;

const trOf = (bars, k) => { const x = bars[k], pc = bars[k - 1].close; return Math.max(x.high - x.low, Math.abs(x.high - pc), Math.abs(x.low - pc)); };
// ATR of the n candles ending at index e (inclusive)
export function atr(bars, e, n = ATR_N) { if (e - n + 1 < 1) return null; let s = 0; for (let k = e - n + 1; k <= e; k++) s += trOf(bars, k); return s / n; }
// regime on candle i: 1 rising, 0 falling, null not enough history. Candles <= i only.
export function regimeAt(bars, i) { const a = atr(bars, i), b = atr(bars, i - ATR_LAG); if (a == null || b == null) return null; return a > b ? 1 : 0; }
// 20-day breakout on the close of i against the highs / lows of i-20..i-1
export function breakoutAt(bars, i) {
  if (i < BO_N) return 0; let hi = -Infinity, lo = Infinity;
  for (let k = i - BO_N; k < i; k++) { hi = Math.max(hi, bars[k].high); lo = Math.min(lo, bars[k].low); }
  const c = bars[i].close; return c > hi ? 1 : c < lo ? -1 : 0;
}
// 5-day close reversal: a new 5-day closing low -> buy (+1), a new 5-day closing high -> sell (-1)
export function reversalAt(bars, i) {
  if (i < RV_N) return 0; let hi = -Infinity, lo = Infinity;
  for (let k = i - RV_N; k < i; k++) { hi = Math.max(hi, bars[k].close); lo = Math.min(lo, bars[k].close); }
  const c = bars[i].close; return c < lo ? 1 : c > hi ? -1 : 0;
}
export function prepare(rows) {
  const bars = foldWeekend(rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })));
  const reg = bars.map((_, i) => regimeAt(bars, i)), B = bars.map((_, i) => breakoutAt(bars, i)), V = bars.map((_, i) => reversalAt(bars, i));
  return { bars, reg, B, V };
}
// one trade on signal candle i: enter at the open of i+1, stop 2 x ATR20(i), out at the close of i+HOLD or at the stop.
export function trade(P, i, side, { cost = COST, finMult = 1, hold = HOLD } = {}) {
  const { bars } = P, j = i + hold;
  if (i < ATR_N || j >= bars.length) return null;
  const a = atr(bars, i); if (!(a > 0)) return null;
  const entry = bars[i + 1].open, risk = ATR_K * a, stop = entry - side * risk, tIn = bars[i + 1].time;
  let exit = bars[j].close, how = 'time', tOut = closeTime(bars[j].time), k0 = j;
  for (let k = i + 1; k <= j; k++) { const x = bars[k];
    if (side > 0 ? x.low <= stop : x.high >= stop) { exit = stopFill(x, side < 0, stop, k > i + 1); how = 'stop'; tOut = closeTime(x.time); k0 = k; break; } }
  const R = side * (exit - entry) / risk, nn = side > 0 ? nights(tIn, tOut) : 0;
  const fin = finMult * nn * FIN.xau.long * entry / risk;
  return { a: dateOf(bars[i].time), b: dateOf(bars[k0].time), out: k0, side, entry, stop, risk, exit, how, R, fin, net: R - cost / risk - fin };
}
// the signals of a test with a given regime label array (reg[i] 1 / 0 / null)
export function signals(P, test, reg = P.reg) {
  const spec = TESTS[test] || EXTRA[test], out = [];
  for (let i = ATR_N + ATR_LAG; i < P.bars.length; i++) {
    if (reg[i] == null) continue;
    const leg = reg[i] ? spec.rising : spec.falling; if (!leg) continue;
    const d = leg === 'B' ? P.B[i] : P.V[i]; if (!d) continue;
    out.push({ i, dir: d, leg, mk: dateOf(P.bars[i].time).slice(0, 7) });
  }
  return out;
}
// one position at a time: a signal whose entry candle (i+1) comes before the previous trade's exit candle is skipped
export function run(P, sigs, opt) {
  const T = []; let busy = -1, skipped = 0, offFile = 0;
  for (const e of sigs) {
    if (e.i + 1 <= busy) { skipped++; continue; }
    const t = trade(P, e.i, e.dir, opt);
    if (!t) { offFile++; continue; }
    T.push({ ...t, mk: e.mk, leg: e.leg, i: e.i }); busy = t.out;
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
// t on calendar-month sums (trades grouped by the month of their signal)
export function monthT(T, key = 'net') {
  const by = new Map(); for (const x of T) { const k = x.a.slice(0, 7); by.set(k, (by.get(k) || 0) + x[key]); }
  const v = [...by.values()], n = v.length; if (n < 3) return { months: n, t: null, p: null };
  const sd = sdOf(v), t = sd ? mean(v) / (sd / Math.sqrt(n)) : 0;
  return { months: n, t, p: pUpper(t, n - 1) };
}
const inW = (mk, w) => mk >= w[0] && mk <= w[1];
const r3 = (x) => x == null ? null : +x.toFixed(3), r2 = (x) => x == null ? null : +x.toFixed(2), r4 = (x) => x == null ? null : +x.toFixed(4);
const median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export function summary(T) {
  if (!T.length) return { n: 0 };
  const mt = monthT(T), mg = monthT(T, 'R');
  return { n: T.length, net: r3(mean(T.map((x) => x.net))), gross: r3(mean(T.map((x) => x.R))), tNet: r2(mt.t), tGross: r2(mg.t), p: r4(mt.p), months: mt.months,
    win: r2(100 * T.filter((x) => x.net > 0).length / T.length), stops: T.filter((x) => x.how === 'stop').length, total: r2(T.reduce((s, x) => s + x.net, 0)),
    longs: T.filter((x) => x.side > 0).length, medStop: r2(median(T.map((x) => x.risk))), costShare: r4(mean(T.map((x) => COST / x.risk))),
    fin: r3(mean(T.map((x) => x.fin))) };
}
// placebo: every candle's regime label replaced by a random one (rising with probability q), the same rule run; out-of-sample mean net R
export function placebo(P, test, q, seeds = SEEDS, seed = SEED) {
  const out = [];
  for (let s = 0; s < seeds; s++) {
    const rng = mulberry32(seed + s), reg = P.reg.map((r) => r == null ? null : (rng() < q ? 1 : 0));
    const T = run(P, signals(P, test, reg).filter((e) => inW(e.mk, [IS[0], OOS[1]]))).T.filter((x) => inW(x.mk, OOS));
    out.push(T.length ? mean(T.map((x) => x.net)) : 0);
  }
  return out;
}

function block(P, key, judged) {
  const sig = signals(P, key).filter((e) => inW(e.mk, [IS[0], OOS[1]]));
  const A = run(P, sig), A2 = run(P, sig, { cost: 2 * COST, finMult: 2 }), r = { skipped: A.skipped, offFile: A.offFile, signals: sig.length };
  for (const [w, W] of [['is', IS], ['oos', OOS]]) {
    const f = (x) => inW(x.mk, W), T = A.T.filter(f), T2 = A2.T.filter(f);
    r[w] = { ...summary(T), net2x: T2.length ? r3(mean(T2.map((x) => x.net))) : null };
    if (judged) {
      r[w].byLeg = Object.fromEntries(['B', 'V'].map((g) => [g, summary(T.filter((x) => x.leg === g))]));
      r[w].bySide = { buy: summary(T.filter((x) => x.side > 0)), sell: summary(T.filter((x) => x.side < 0)) };
    }
  }
  if (judged) { const byYear = {}; for (const x of A.T) { const y = x.a.slice(0, 4); (byYear[y] ||= []).push(x.net); }
    r.byYear = Object.fromEntries(Object.entries(byYear).map(([y, v]) => [y, { n: v.length, net: r3(mean(v)) }])); }
  return r;
}

export function study(rows) {
  const P = prepare(rows), lab = P.reg.filter((x, i) => x != null && inW(dateOf(P.bars[i].time).slice(0, 7), [IS[0], OOS[1]]));
  const q = lab.filter((x) => x === 1).length / lab.length;
  const share = (W) => { const v = P.reg.filter((x, i) => x != null && inW(dateOf(P.bars[i].time).slice(0, 7), W)); return r3(v.filter((x) => x === 1).length / v.length); };
  const out = { data: { first: dateOf(P.bars[0].time), last: dateOf(P.bars.at(-1).time), candles: P.bars.length, fold: 'UTC days, weekends folded into Monday (fills.mjs foldWeekend)' },
    rules: { cost: COST, cost2x: 2 * COST, stop: `${ATR_K} x ATR(${ATR_N}) of the signal candle`, hold: `${HOLD} trading days, entry at the next open`,
      regime: `rising = ATR(${ATR_N}) > ATR(${ATR_N}) ${ATR_LAG} candles earlier`, breakout: `close beyond the ${BO_N}-candle high / low`,
      reversal: `new ${RV_N}-day closing low -> buy, high -> sell`, fin: FIN.xau.long, IS, OOS,
      tests: Object.fromEntries(Object.entries(TESTS).map(([k, v]) => [k, v.what])), extra: Object.fromEntries(Object.entries(EXTRA).map(([k, v]) => [k, v.what])) },
    regime: { rising: r3(q), risingIS: share(IS), risingOOS: share(OOS) }, tests: {}, extra: {} };
  const ps = [];
  for (const k of Object.keys(TESTS)) {
    const r = block(P, k, true), pl = placebo(P, k, q);
    r.placebo = { seeds: SEEDS, beaten: pl.filter((v) => r.oos.net > v).length, mean: r3(mean(pl)), max: r3(Math.max(...pl)), min: r3(Math.min(...pl)) };
    out.tests[k] = r; ps.push(r.oos.p);
  }
  for (const k of Object.keys(EXTRA)) out.extra[k] = block(P, k, false);
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
const tt = (v) => v == null ? 'n/a' : v.toFixed(2);
export function verdictLine(res) {
  const T1 = res.tests.T1;
  return `**Verdict: ${res.verdict}, ${res.passed.length} of 3: the ATR-trend switch (breakout / reversal) made ${sg(T1.oos.net)}R a trade net out of sample (n ${T1.oos.n}, month t ${tt(T1.oos.tNet)}), ${sg(T1.is.net)}R in sample; ${T1.placebo.beaten} of 40 placebos.**`;
}
export function report(res) {
  const L = [];
  L.push(`# Result: gold's volatility trend picks the trade, breakout or reversal (14 Nov 2026)`, '');
  L.push(verdictLine(res), '');
  L.push('A stand-alone, two-sided daily rule of its own: no rule or position of the live gold book was read, tested or touched',
    '(docs/owner-decisions.md item 44). Pre-registration: `PREREGISTRATION.md` (pushed alone before any figure). Code: `run.mjs`.',
    'Every figure: `result.json`; this page is written by `run.mjs` from it. Nothing is an edge here; nothing live changed and no',
    'proposal is written.', '');
  const d = res.data, ru = res.rules;
  L.push('## Data and rule', '',
    `Council-data \`research/daily/xau.json\` (OANDA mid spot gold, UTC daily candles, weekends folded into Monday with`,
    `\`fills.mjs\` \`foldWeekend\`), ${d.first} to ${d.last}, ${d.candles} trading days. Regime: ${ru.regime} (rising on`,
    `${(100 * res.regime.risingIS).toFixed(1)} % of in-sample days, ${(100 * res.regime.risingOOS).toFixed(1)} % out of sample). Breakout: ${ru.breakout}; reversal: ${ru.reversal}.`,
    `Entry at the next open, stop ${ru.stop} (a gap through it fills at the open), out after ${HOLD} trading days, one position at`,
    `a time per test, $${ru.cost.toFixed(2)} a round trip and \`FIN\` financing (${ru.fin} of price a rollover) on buys; 2x costs = $1.20 and`,
    'twice the financing. Windows by signal month: in sample ' + ru.IS.join(' to ') + ', out of sample ' + ru.OOS.join(' to ') + '. t on calendar-month sums,',
    'one-sided, Holm over the three tests.', '');
  L.push('## The tests (R a trade)', '',
    '| Test | Rule | Window | n | Net R | Month t | Gross R | Gross t | Win % | Stops | Total net R | Net at 2x | Median stop $ | Cost share | Financing R | Holm p | Placebo beaten | Pass |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, r] of Object.entries(res.tests)) for (const w of ['is', 'oos']) { const x = r[w];
    L.push(`| ${k} | ${ru.tests[k]} | ${w === 'is' ? 'in sample' : 'out of sample'} | ${x.n} | ${sg(x.net)} | ${tt(x.tNet)} | ${sg(x.gross)} | ${tt(x.tGross)} | ${x.win} | ${x.stops} | ${sg(x.total, 2)} | ${sg(x.net2x)} | ${x.medStop.toFixed(2)} | ${(100 * x.costShare).toFixed(1)} % | ${x.fin.toFixed(3)} | ${w === 'oos' ? `${r.holm} | ${r.placebo.beaten} | ${r.pass ? 'yes' : 'no'}` : '| |'} |`); }
  L.push('', 'Signals skipped because the previous trade of the same test was still open: ' +
    Object.entries(res.tests).map(([k, r]) => `${k} ${r.skipped}`).join(', ') + '; dropped because the exit is not on file yet: ' +
    Object.entries(res.tests).map(([k, r]) => `${k} ${r.offFile}`).join(', ') + '. Cost share = $0.60 / stop, the mean over trades; financing R = mean over all trades (sells pay none).', '');
  L.push('## Checks of each test (all must hold)', '', '| Test | OOS net > 0 | OOS month t >= 2 | Holm p < 0.05 | in sample > 0 | > 0 at 2x costs | >= 38 of 40 placebos |', '|---|---|---|---|---|---|---|');
  for (const [k, r] of Object.entries(res.tests)) { const c = r.checks, y = (b) => b ? 'yes' : 'no';
    L.push(`| ${k} | ${y(c.oosNetPos)} | ${y(c.oosT2)} | ${y(c.holm)} | ${y(c.isSameSign)} | ${y(c.cost2x)} | ${y(c.placebo)} |`); }
  L.push('', '## Placebo (40 seeded draws, out of sample)', '',
    `Every candle's regime label replaced by a random one (rising with probability ${res.regime.rising}, the whole file's share), the same rule run.`, '',
    '| Test | Rule net R | Placebo mean | min | max | Seeds beaten |', '|---|---|---|---|---|---|');
  for (const [k, r] of Object.entries(res.tests)) L.push(`| ${k} | ${sg(r.oos.net)} | ${sg(r.placebo.mean)} | ${sg(r.placebo.min)} | ${sg(r.placebo.max)} | ${r.placebo.beaten} of ${r.placebo.seeds} |`);
  L.push('', '## T1 inside: by leg and by side', '', '| Window | Part | n | Net R | Month t | Gross R |', '|---|---|---|---|---|---|');
  for (const w of ['is', 'oos']) { const x = res.tests.T1[w];
    for (const [nm, s] of [['breakout leg', x.byLeg.B], ['reversal leg', x.byLeg.V], ['buys', x.bySide.buy], ['sells', x.bySide.sell]])
      L.push(`| ${w === 'is' ? 'in sample' : 'out of sample'} | ${nm} | ${s.n} | ${s.n ? sg(s.net) : 'n/a'} | ${s.n ? tt(s.tNet) : 'n/a'} | ${s.n ? sg(s.gross) : 'n/a'} |`); }
  L.push('', '## Baselines (reported, not judged): the same trades without the regime, and the inverted switch', '',
    '| Stream | Window | n | Net R | Month t | Gross R | Net at 2x |', '|---|---|---|---|---|---|---|');
  for (const [k, r] of Object.entries(res.extra)) for (const w of ['is', 'oos']) { const x = r[w];
    L.push(`| ${ru.extra[k]} | ${w === 'is' ? 'in sample' : 'out of sample'} | ${x.n} | ${sg(x.net)} | ${tt(x.tNet)} | ${sg(x.gross)} | ${sg(x.net2x)} |`); }
  L.push('', '## T1 by year (net R a trade)', '', '| Year | n | Net R |', '|---|---|---|');
  for (const [y, v] of Object.entries(res.tests.T1.byYear)) L.push(`| ${y} | ${v.n} | ${sg(v.net)} |`);
  L.push('', '## Reading', '');
  const T1 = res.tests.T1;
  L.push(res.verdict === 'PASS'
    ? 'T1 passes every pre-registered check. A pass on one study is a lead for the owner, to be replicated, not a live rule; nothing live changed.'
    : `Not an edge. T1 fails ${Object.entries(T1.checks).filter(([, v]) => !v).map(([c]) => NAMES[c]).join(', ')}. ${res.passed.length ? `Passed: ${res.passed.join(', ')} (secondary; the verdict rests on T1, and a secondary pass is not called an edge).` : 'T2 and T3 fail too.'} ` +
      `The placebo (random regime labels on the same signals) made ${sg(T1.placebo.mean)}R a trade on average out of sample against the rule's ${sg(T1.oos.net)}R: ` +
      `${T1.placebo.beaten >= BEAT ? 'the regime label adds more than chance would' : 'whether the 20-day ATR is rising or falling does not pick the better of the two trades by more than chance'}. The reversal leg (T3) lost in both windows (month t ${tt(res.tests.T3.is.tNet)} in sample, ${tt(res.tests.T3.oos.tNet)} out of sample, the wrong way for the rule), and every reversal signal without the regime lost too: over ten days gold did not give back a new 5-day closing extreme. The breakout leg (T2) fails ${Object.entries(res.tests.T2.checks).filter(([, v]) => !v).map(([c]) => NAMES[c]).join(', ')}, and the same breakouts without the regime made ${sg(res.extra.allB.oos.net)}R (month t ${tt(res.extra.allB.oos.tNet)}) out of sample. No proposal; nothing live changed.`, '');
  return L.join('\n');
}

const here = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const raw = execFileSync('git', ['show', 'origin/council-data:research/daily/xau.json'], { maxBuffer: 64e6 }).toString();
  const res = { study: 'gold-volvol-switch', built: '2026-11-14', ...study(JSON.parse(raw).rows) };
  fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  fs.writeFileSync(path.join(here, 'RESULT.md'), report(res) + '\n');
  console.log(JSON.stringify({ verdict: res.verdict, data: res.data, regime: res.regime }));
  for (const [k, r] of Object.entries(res.tests)) console.log(k, JSON.stringify({ is: { ...r.is, byLeg: undefined, bySide: undefined }, oos: { ...r.oos, byLeg: undefined, bySide: undefined }, placebo: r.placebo, holm: r.holm, checks: r.checks }));
  for (const [k, r] of Object.entries(res.extra)) console.log(k, JSON.stringify({ is: r.is, oos: r.oos }));
}
