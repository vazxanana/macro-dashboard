// Gold at a 20-day closing high (low) in at least three of five other currencies while not in dollars: does XAU/USD
// follow? (research/edge/gold-fx-high-count; rules fixed in PREREGISTRATION.md). Paper research only: a stand-alone rule,
// never a gate / entry / exit / size of the live gold book (decision 44).
//   node research/edge/gold-fx-high-count/run.mjs fetch <dir>   copy the daily caches out of origin/council-data (no network)
//   node research/edge/gold-fx-high-count/run.mjs count <dir>   signal and trade counts only (no outcome is computed)
//   node research/edge/gold-fx-high-count/run.mjs full <dir>    run the study, write result.json and RESULT.md next to this file
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FIN, nights, foldWeekend } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DAY = 86400;
export const LOOK = 20, ATR_N = 20, RT = 0.60, SEEDS = 40, GAP = 5 * DAY, SHIFT_MIN = 250;
export const KEYS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'usdchf', 'audusd'];
export const IS_FROM = Date.UTC(2007, 0, 1) / 1000, SPLIT = Date.UTC(2017, 0, 1) / 1000, OOS_END = Date.UTC(2026, 9, 31, 23, 59, 59) / 1000;
export const TESTS = [
  { id: 'T1', need: 2, sides: [1, -1], hold: 5, stopAtr: 2, what: '2 of 5 currencies, both sides, hold 5 candles, stop 2 x ATR(20) (primary)' },
  { id: 'T2', need: 3, sides: [1, -1], hold: 3, stopAtr: 2, what: '3 of 5 currencies, both sides, hold 3 candles, stop 2 x ATR(20)' },
  { id: 'T3', need: 2, sides: [1, -1], hold: 3, stopAtr: 2, what: '2 of 5 currencies, both sides, hold 3 candles, stop 2 x ATR(20)' },
];

// ── data ──
export const toBars = (j) => j.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
export const load = (dir, key) => foldWeekend(toBars(JSON.parse(fs.readFileSync(path.join(dir, key + '.json'), 'utf8'))));
export const dayOf = (t) => Math.floor(t / DAY) * DAY;

// gold in the five other currencies from gold in dollars and the pair: EUR, GBP, AUD = gold / pair; JPY, CHF = gold x pair
export const CCY = [['EUR', 'eurusd', -1], ['GBP', 'gbpusd', -1], ['JPY', 'usdjpy', 1], ['CHF', 'usdchf', 1], ['AUD', 'audusd', -1]];
export const inCcy = (g, px, pow) => (pow > 0 ? g * px : g / px);
// common days: gold and all five pairs close on the same UTC day; fx[k] = that pair's close
export function matched(gold, pairs) {
  const maps = CCY.map(([, key]) => new Map(pairs[key].map((b) => [dayOf(b.time), b.close])));
  const out = [];
  for (const b of gold) {
    const t = dayOf(b.time), fx = maps.map((m) => m.get(t));
    if (fx.every((x) => x > 0)) out.push({ t, g: b.close, fx });
  }
  return out;
}
// signal rows: nHi / nLo = how many of the five non-USD gold prices close beyond their LOOK-day closing extreme;
// s = +1 when nHi >= need and gold in dollars is NOT above its own LOOK-day closing high; -1 the low mirror; else 0.
// Only the day's closes and the LOOK common days before it are read.
export function signals(pts, need = 3, look = LOOK) {
  const out = []; let start = 0;
  const val = (p, c) => inCcy(p.g, p.fx[c], CCY[c][2]);
  for (let i = 0; i < pts.length; i++) {
    if (i > 0 && pts[i].t - pts[i - 1].t > GAP) start = i;
    if (i - start < look) continue;
    const p = pts[i]; let gH = -Infinity, gL = Infinity, nHi = 0, nLo = 0;
    for (let k = i - look; k < i; k++) { gH = Math.max(gH, pts[k].g); gL = Math.min(gL, pts[k].g); }
    for (let c = 0; c < CCY.length; c++) {
      let h = -Infinity, l = Infinity;
      for (let k = i - look; k < i; k++) { const v = val(pts[k], c); h = Math.max(h, v); l = Math.min(l, v); }
      const v = val(p, c); if (v > h) nHi++; if (v < l) nLo++;
    }
    const s = nHi >= need && !(p.g > gH) ? 1 : nLo >= need && !(p.g < gL) ? -1 : 0;
    out.push({ t: p.t, s, nHi, nLo });
  }
  return out;
}
// control path: each pair's closes moved by its own circular offset of the common-day index (>= SHIFT_MIN days, and
// at least SHIFT_MIN days short of a full turn). Gold, the pairs' own drift and volatility are kept; the timing link
// between the pairs and gold is removed.
export function shiftPairs(pts, r) {
  const n = pts.length, offs = CCY.map(() => SHIFT_MIN + Math.floor(r() * (n - 2 * SHIFT_MIN)));
  return pts.map((p, i) => ({ t: p.t, g: p.g, fx: CCY.map((_, c) => pts[(i + offs[c]) % n].fx[c]) }));
}

// first gold candle whose UTC day is later than t
export function entryIndex(gold, t) {
  let lo = 0, hi = gold.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (dayOf(gold[m].time) > t) hi = m; else lo = m + 1; }
  return lo < gold.length ? lo : -1;
}
export function atrBefore(gold, j, n = ATR_N) {
  if (j - n - 1 < 0) return null;
  let s = 0;
  for (let i = j - n; i < j; i++) { const b = gold[i], pc = gold[i - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}
// exit stamp: a Friday candle ends at the 22:00 UTC weekly close, any other at the day end
export const exitStamp = (dayT) => dayT + (new Date(dayT * 1000).getUTCDay() === 5 ? 22 * 3600 - 1 : DAY - 1);

export function tradeAt(gold, j, side, hold, stopAtr, costX = 1) {
  const atr = atrBefore(gold, j);
  if (!(atr > 0) || j + hold - 1 >= gold.length) return null;
  const risk = stopAtr * atr, e = gold[j].open, stop = e - side * risk;
  const through = (px) => (side > 0 ? px <= stop : px >= stop);
  let exit = null, kind = 'time', k = j;
  for (; k < j + hold; k++) {
    const b = gold[k];
    if (k > j && through(b.open)) { exit = b.open; kind = 'gap'; break; }
    if (through(side > 0 ? b.low : b.high)) { exit = stop; kind = 'stop'; break; }
  }
  if (exit == null) { k = j + hold - 1; exit = gold[k].close; }
  const t = dayOf(gold[j].time), c = exitStamp(dayOf(gold[k].time)), nn = nights(t, c);
  const gross = side * (exit - e) / risk, fin = side > 0 ? nn * FIN.xau.long * e / risk : 0, rt = RT / risk;
  return { t, c, j, k, side, e, stop, risk, exit, kind, nights: nn, gross, fin, cost: rt + fin, net: gross - costX * (rt + fin) };
}
export function simulate(days, gold, hold, stopAtr, { costX = 1, oneAtATime = true } = {}) {
  const out = []; let lastK = -1;
  for (const d of days) {
    if (!d.s) continue;
    const j = entryIndex(gold, d.t); if (j < 0 || (oneAtATime && j <= lastK)) continue;
    const tr = tradeAt(gold, j, d.s, hold, stopAtr, costX); if (!tr) continue;
    out.push({ ...tr, sig: d.t }); lastK = tr.k;
  }
  return out;
}

// ── statistics ──
const sd = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
export function stat(a) {
  const n = a.length; if (!n) return { n: 0, mean: null, t: null, sum: 0 };
  const m = a.reduce((x, y) => x + y, 0) / n, s = n > 1 ? sd(a) : 0;
  return { n, mean: m, sum: m * n, t: s > 0 ? m / (s / Math.sqrt(n)) : null };
}
const mk = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
export function monthly(rows, from, to, key) {
  const a = mk(from), b = mk(Math.max(to, ...rows.map((r) => r.c))), m = new Array(b - a + 1).fill(0);
  for (const r of rows) m[mk(r.c) - a] += r[key];
  return { ...stat(m), months: m.length };
}
export function normP(t) {
  if (t == null) return 1;
  const x = Math.abs(t) / Math.SQRT2, k = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-x * x);
  return t >= 0 ? (1 - erf) / 2 : (1 + erf) / 2;
}
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let run = 0;
  o.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, p * (ps.length - k))); out[i] = run; });
  return out;
}
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function shuffle(arr, r) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000), r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
export const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export const yearOf = (t) => new Date(t * 1000).getUTCFullYear();

// same-side baseline: mean net R of the trade entered after EVERY eligible day of a year, per side (overlapping)
export function baselines(days, gold, hold, stopAtr, sides) {
  const out = {};
  for (const side of sides) {
    const tr = simulate(days.map((d) => ({ t: d.t, s: side })), gold, hold, stopAtr, { oneAtATime: false });
    const by = {};
    for (const x of tr) (by[yearOf(x.sig)] ||= []).push(x.net);
    out[side] = Object.fromEntries(Object.entries(by).map(([y, a]) => [y, stat(a).mean]));
    out[side].all = stat(tr.map((x) => x.net)).mean;
  }
  return out;
}

export function summarize(trades, from, to, x2) {
  const s = stat(trades.map((x) => x.net)), g = stat(trades.map((x) => x.gross));
  const mo = trades.length ? monthly(trades, from, to, 'net') : { t: null, months: 0 }, mg = trades.length ? monthly(trades, from, to, 'gross') : { t: null };
  const risks = trades.map((x) => x.risk).sort((a, b) => a - b);
  return {
    n: s.n, win: s.n ? r3(trades.filter((x) => x.net > 0).length / s.n) : null, stops: trades.filter((x) => x.kind !== 'time').length,
    gross: r3(g.mean), net: r3(s.mean), netExact: s.mean == null ? null : +s.mean.toPrecision(4), total: r2(s.sum),
    x2: x2 ? r3(stat(x2.map((x) => x.net)).mean) : undefined,
    tMonth: r2(mo.t), tMonthGross: r2(mg.t), months: mo.months, tTrade: r2(s.t),
    meanCost: s.n ? r3(stat(trades.map((x) => x.cost)).mean) : null, medianRisk: s.n ? r2(risks[Math.floor(risks.length / 2)]) : null,
  };
}
const winOf = (gold, end) => ({ is: [IS_FROM, SPLIT - 1], oos: [SPLIT, Math.min(end, dayOf(gold[gold.length - 1].time) + DAY - 1)] });
const dist = (ts, real) => {
  const srt = ts.filter((t) => t != null).sort((a, b) => a - b);
  return { t: ts, beaten: ts.filter((t) => real != null && (t == null || real > t)).length, atLeast2: ts.filter((t) => t != null && t >= 2).length,
    median: r2(srt[Math.floor(srt.length / 2)]), p5: r2(srt[Math.floor(srt.length * 0.05)]), p95: r2(srt[Math.min(srt.length - 1, Math.floor(srt.length * 0.95))]) };
};

// placebo: the test's out-of-sample signal days, each moved to a random eligible day of the SAME calendar year, same side
export function placeboDays(days, sig, r) {
  const byYear = {};
  for (const d of days) (byYear[yearOf(d.t)] ||= []).push(d);
  const out = [];
  for (const d of sig) { const pool = byYear[yearOf(d.t)]; out.push({ t: pool[Math.floor(r() * pool.length)].t, s: d.s }); }
  return out.sort((a, b) => a.t - b.t);
}

export function runTest(test, gold, pts, { seeds = SEEDS, end = OOS_END } = {}) {
  const rows = signals(pts, test.need);
  const win = winOf(gold, end);
  const out = { id: test.id, need: test.need, sides: test.sides, hold: test.hold, stopAtr: test.stopAtr, what: test.what };
  for (const [w, [from, to]] of Object.entries(win)) {
    const days = rows.filter((d) => d.t >= from && d.t <= to);
    const sig = days.filter((d) => test.sides.includes(d.s));
    const tr = simulate(sig, gold, test.hold, test.stopAtr), tr2 = simulate(sig, gold, test.hold, test.stopAtr, { costX: 2 });
    const base = baselines(days, gold, test.hold, test.stopAtr, test.sides);
    for (const x of tr) x.excess = x.net - base[x.side][yearOf(x.sig)];
    const ex = stat(tr.map((x) => x.excess)), exM = tr.length ? monthly(tr, from, to, 'excess') : { t: null };
    const bySide = Object.fromEntries(test.sides.map((sd0) => { const a = tr.filter((x) => x.side === sd0); return [sd0 > 0 ? 'long' : 'short', { n: a.length, gross: r3(stat(a.map((x) => x.gross)).mean), net: r3(stat(a.map((x) => x.net)).mean), excess: r3(stat(a.map((x) => x.excess)).mean), base: r3(base[sd0].all) }]; }));
    out[w] = { from: iso(from), to: iso(to), eligible: days.length, signals: sig.length, ...summarize(tr, from, to, tr2),
      excess: r3(ex.mean), excessExact: ex.mean == null ? null : +ex.mean.toPrecision(4), tExcessMonth: r2(exM.t), bySide };
    if (w === 'oos') {
      out.trades = tr.map((x) => ({ sig: iso(x.sig), entry: iso(x.t), side: x.side, e: r2(x.e), risk: r2(x.risk), exit: r2(x.exit), kind: x.kind, gross: r3(x.gross), net: r3(x.net), excess: r3(x.excess) }));
      if (seeds) {
        const real = out.oos.tMonth, pl = [], ct = [], ctN = [];
        for (let s = 1; s <= seeds; s++) pl.push(summarize(simulate(placeboDays(days, sig, rng(s)), gold, test.hold, test.stopAtr), from, to).tMonth);
        for (let s = 1; s <= seeds; s++) {
          const cr = signals(shiftPairs(pts, rng(1000 + s)), test.need).filter((d) => d.t >= from && d.t <= to && test.sides.includes(d.s));
          const ctr = simulate(cr, gold, test.hold, test.stopAtr); ctN.push(ctr.length);
          ct.push(ctr.length ? summarize(ctr, from, to).tMonth : null);
        }
        out.placebo = { seeds, draws: sig.length, how: 'signal days moved to random days of the same year, same side', ...dist(pl, real) };
        out.control = { seeds, how: 'each pair circularly shifted by its own random offset (>= 250 common days) against gold; signals rebuilt', n: ctN, ...dist(ct, real) };
      }
    }
  }
  return out;
}

export function verdictOf(tests) {
  for (const t of tests) {
    const ch = { oosTAndHolm: t.oos.tMonth != null && t.oos.tMonth >= 2 && t.holm < 0.05, isPositive: t.is.netExact > 0,
      x2Positive: t.oos.x2 > 0, excessPositive: t.oos.excessExact > 0, placebo38: (t.placebo?.beaten ?? 0) >= 38,
      control38: (t.control?.beaten ?? 0) >= 38, n100: t.oos.n >= 100 && t.is.n >= 100 };
    t.checks = ch; t.pass = Object.values(ch).every(Boolean);
  }
  if (tests.find((t) => t.id === 'T1').pass) return 'PASS';
  return tests.some((t) => t.pass) ? 'PARTIAL' : 'FAIL';
}

export function loadAll(dir) {
  const gold = load(dir, 'xau'), pairs = Object.fromEntries(KEYS.slice(1).map((k) => [k, load(dir, k)]));
  return { gold, pairs, pts: matched(gold, pairs) };
}
export function counts(dir) {
  const { gold, pts } = loadAll(dir), out = [];
  for (const t of TESTS) {
    const rows = signals(pts, t.need);
    for (const [w, [from, to]] of Object.entries(winOf(gold, OOS_END))) {
      const sig = rows.filter((d) => d.t >= from && d.t <= to && d.s);
      const tr = simulate(sig, gold, t.hold, t.stopAtr);
      out.push({ test: t.id, w, signalDays: sig.length, long: sig.filter((d) => d.s > 0).length, short: sig.filter((d) => d.s < 0).length, trades: tr.length });
    }
  }
  return out;
}

export function study(dir) {
  const { gold, pairs, pts } = loadAll(dir);
  const tests = TESTS.map((t) => runTest(t, gold, pts));
  const ps = tests.map((t) => normP(t.oos.tMonth)), hs = holm(ps);
  tests.forEach((t, i) => { t.p = +ps[i].toPrecision(3); t.holm = +hs[i].toPrecision(3); });
  const verdict = verdictOf(tests);
  const span = (b) => ({ first: iso(b[0].time), last: iso(b[b.length - 1].time), days: b.length });
  return { data: { xau: span(gold), ...Object.fromEntries(Object.entries(pairs).map(([k, b]) => [k, span(b)])), commonDays: pts.length }, tests, verdict };
}

// ── report ──
const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(3));
const f2 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(2));
export function headline(r) {
  const t1 = r.tests[0];
  return `**Verdict: ${r.verdict}, ${r.tests.filter((t) => t.pass).length} of 3: gold at a 20-day high (low) in 2 of 5 other currencies but not in dollars makes ${f3(t1.oos.net)}R a trade net 2017-26 (n ${t1.oos.n}, month t ${f2(t1.oos.tMonth)}, Holm p ${t1.holm}); beats ${t1.placebo.beaten} of 40 placebos, ${t1.control.beaten} of 40 controls.**`;
}
export function report(r) {
  const L = [];
  L.push('# Result: gold at a 20-day high in most other currencies but not in dollars (14 Nov 2026)', '', headline(r), '');
  L.push('Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (pushed alone before any trade result was computed). Paper research',
    'only, a **stand-alone rule on gold**: not a gate, entry, exit or size of the live gold book, and nothing here was compared with',
    'or applied to that book; its 2006-17 positions were not read (owner decision 44). No live rule, size, filter, stop, config, cost',
    'constant or council member changed. No proposal is written. This page is written by `run.mjs` from `result.json`.', '');
  L.push('## What was tested', '');
  L.push(`- Data: OANDA mid daily candles (UTC), council-data \`research/daily/\` \`${KEYS.join('`, `')}\` at commit \`${(r.councilData || '').slice(0, 8)}\`` +
    ` (gold ${r.data.xau.first} to ${r.data.xau.last}; ${r.data.commonDays} common days), weekends folded into Monday with \`council/fills.mjs\` \`foldWeekend\`.`);
  L.push('- Gold in EUR, GBP, AUD = gold / the pair; in JPY, CHF = gold x the pair. Signal: at least `need` of the five close above (below) the',
    '  highest (lowest) close of their 20 common days before while XAU/USD does not: long (short) XAU/USD at the next daily open.');
  L.push('- Trade: stop k x ATR(20) of the 20 gold candles before the entry (1R), gaps through the stop fill at the open, one position at',
    '  a time per test. Costs $0.60 a round trip plus financing on buys, `nights()` x `FIN.xau.long` x entry (today\'s demo rate for every year).');
  L.push('- Baseline: the same trade entered after every eligible day of the same calendar year, same side; excess = net R minus that mean.');
  L.push('- t on calendar-month sums of net R (empty months 0), Holm over T1-T3 on the one-sided OOS p.');
  L.push('- Placebo (40 seeds): each out-of-sample signal day moved to a random day of the same year, same side. Control (40 seeds):',
    '  each pair shifted in time by its own random offset of at least 250 common days, signals rebuilt; the pairs keep their drift and',
    '  volatility, gold is untouched, the timing link between the currencies and gold is gone.', '');
  L.push('## Results', '', '| Test | Window | signal days | n | gross R | net R | net at 2x | month t (gross) | month t (net) | excess R | excess t | stops |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const t of r.tests) for (const w of ['is', 'oos']) {
    const x = t[w];
    L.push(`| ${t.id} | ${w === 'is' ? '2007-16' : '2017-26'} | ${x.signals} | ${x.n} | ${f3(x.gross)} | ${f3(x.net)} | ${f3(x.x2)} | ${f2(x.tMonthGross)} | ${f2(x.tMonth)} | ${f3(x.excess)} | ${f2(x.tExcessMonth)} | ${x.stops} |`);
  }
  L.push('', '| Test | what | OOS p | Holm p | placebo beaten (median t) | control beaten (median t) | pass |', '|---|---|---|---|---|---|---|');
  for (const t of r.tests) L.push(`| ${t.id} | ${t.what} | ${t.p} | ${t.holm} | ${t.placebo.beaten} of 40 (${f2(t.placebo.median)}) | ${t.control.beaten} of 40 (${f2(t.control.median)}) | ${t.pass ? 'yes' : 'no'} |`);
  L.push('', '## By side (reported, not judged)', '', '| Test | Window | side | n | gross R | net R | excess R | baseline net R (every day) |', '|---|---|---|---|---|---|---|---|');
  for (const t of r.tests) for (const w of ['is', 'oos']) for (const [s, v] of Object.entries(t[w].bySide)) L.push(`| ${t.id} | ${w === 'is' ? '2007-16' : '2017-26'} | ${s} | ${v.n} | ${f3(v.gross)} | ${f3(v.net)} | ${f3(v.excess)} | ${f3(v.base)} |`);
  L.push('', `Median risk (1R) per T1 trade: $${r.tests[0].is.medianRisk} in sample, $${r.tests[0].oos.medianRisk} out of sample; mean cost ${r.tests[0].is.meanCost}R / ${r.tests[0].oos.meanCost}R.`);
  L.push('', '## Reading', '');
  L.push(r.verdict === 'PASS' ? 'T1 met every pre-registered check. A pass is evidence for one stand-alone rule, not a proven edge and not a change to anything live.'
    : 'Gold reaching a 20-day extreme in most other currencies while it does not in dollars does not lead XAU/USD by enough to trade on the pre-registered bar. Not an edge; never use it as a filter, gate or size step. No re-run with other counts, look-backs, holds or stops (any such look would be post hoc).');
  L.push('', '## To repeat', '', '`node research/edge/gold-fx-high-count/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then',
    '`node research/edge/gold-fx-high-count/run.mjs full <dir>`; delete `<dir>` afterwards. Tests: `tests/gold-fx-high-count.test.mjs`.', '');
  return L.join('\n');
}

const main = async () => {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    const sha = execFileSync('git', ['rev-parse', 'origin/council-data'], { encoding: 'utf8' }).trim();
    for (const k of KEYS) fs.writeFileSync(path.join(dir, k + '.json'), execFileSync('git', ['show', `${sha}:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
    fs.writeFileSync(path.join(dir, 'SOURCE'), sha + '\n');
    console.log('council-data', sha, '->', dir);
  } else if (cmd === 'count') {
    console.table(counts(dir));
  } else if (cmd === 'full') {
    const r = study(dir), src = fs.existsSync(path.join(dir, 'SOURCE')) ? fs.readFileSync(path.join(dir, 'SOURCE'), 'utf8').trim() : null;
    const out = { title: 'Gold at a 20-day high in most other currencies but not in dollars', built: '2026-11-14', prereg: 'PREREGISTRATION.md', councilData: src,
      system: 'Stand-alone gold rule (XAU/USD), signal from gold in EUR, GBP, JPY, CHF, AUD; not the live gold book',
      rule: { signal: `>= need of 5 non-USD gold prices close beyond their ${LOOK}-day closing extreme while XAU/USD's does not: long (high) / short (low)`, entry: 'next XAU/USD open',
        stop: `k x ATR(${ATR_N}) before the entry`, costs: `$${RT.toFixed(2)} a trade + nights() x FIN.xau.long on buys`, oneAtATime: true },
      fin: FIN.xau.long, isFrom: '2007-01-01', split: '2017-01-01', oosEnd: '2026-10-31', ...r };
    out.headline = headline(r).replace(/^\*\*Verdict: /, '').replace(/\*\*$/, '');
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(out));
    for (const t of r.tests) {
      for (const w of ['is', 'oos']) { const x = t[w]; console.log(t.id, w, 'sig', x.signals, 'n', x.n, 'gross', x.gross, 'net', x.net, 'x2', x.x2, 'tMoG', x.tMonthGross, 'tMo', x.tMonth, 'exc', x.excess, 'tExc', x.tExcessMonth, JSON.stringify(x.bySide)); }
      console.log(t.id, 'p', t.p, 'holm', t.holm, 'pass', t.pass, JSON.stringify(t.checks), 'placebo', t.placebo.beaten, t.placebo.median, 'control', t.control.beaten, t.control.median);
    }
    console.log(headline(r).length, 'VERDICT', r.verdict);
  } else console.log('usage: run.mjs fetch <dir> | count <dir> | full <dir>');
};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
