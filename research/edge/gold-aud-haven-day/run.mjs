// Gold after a "haven day" in Australian-dollar terms: gold up >= 0.5 sd while AUD/USD down >= 0.5 sd (research/edge/gold-aud-haven-day;
// rules fixed in PREREGISTRATION.md). Paper research only: a stand-alone rule, never a gate / entry / exit / size of the
// live gold book (decision 44).
//   node research/edge/gold-aud-haven-day/run.mjs fetch <dir>   copy the daily caches out of origin/council-data (no network)
//   node research/edge/gold-aud-haven-day/run.mjs full <dir>    run the study, write result.json and RESULT.md next to this file
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FIN, nights, foldWeekend } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DAY = 86400;
export const VOL_N = 60, ATR_N = 20, RT = 0.60, SEEDS = 40, GAP = 5 * DAY;
export const KEYS = ['xau', 'audusd'];
export const IS_FROM = Date.UTC(2007, 0, 1) / 1000, SPLIT = Date.UTC(2017, 0, 1) / 1000, OOS_END = Date.UTC(2026, 9, 31, 23, 59, 59) / 1000;
export const TESTS = [
  { id: 'T1', zg: 0.5, za: 0.5, sides: [1], hold: 5, stopAtr: 2, what: 'z 0.5 / 0.5, hold 5 candles, stop 2 x ATR(20) (primary)' },
  { id: 'T2', zg: 0.5, za: 0.5, sides: [1], hold: 10, stopAtr: 3, what: 'z 0.5 / 0.5, hold 10 candles, stop 3 x ATR(20)' },
  { id: 'T3', zg: 1.0, za: 0.5, sides: [1], hold: 5, stopAtr: 2, what: 'z 1.0 / 0.5, hold 5 candles, stop 2 x ATR(20)' },
];

// ── data ──
export const toBars = (j) => j.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
export const load = (dir, key) => foldWeekend(toBars(JSON.parse(fs.readFileSync(path.join(dir, key + '.json'), 'utf8'))));
export const dayOf = (t) => Math.floor(t / DAY) * DAY;

// matched days: gold (USD) and AUD/USD closes on the same UTC day
export function matched(gold, aud) {
  const am = new Map(aud.map((b) => [dayOf(b.time), b.close]));
  return gold.map((b) => ({ t: dayOf(b.time), g: b.close, a: am.get(dayOf(b.time)) })).filter((p) => p.a > 0);
}
const sdOf = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
// signal rows: s = +1 on a haven day (gold's log return >= zg x sd, AUD/USD's <= -za x sd; sd of the VOL_N matched returns
// BEFORE the day), else 0. Only closes up to and including the day are read.
export function signals(pts, zg, za, n = VOL_N) {
  const out = []; let start = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0 && pts[i].t - pts[i - 1].t > GAP) start = i;
    if (i - start < n + 1) continue;
    const rg = [], ra = [];
    for (let k = i - n; k < i; k++) { rg.push(Math.log(pts[k].g / pts[k - 1].g)); ra.push(Math.log(pts[k].a / pts[k - 1].a)); }
    const g = Math.log(pts[i].g / pts[i - 1].g), a = Math.log(pts[i].a / pts[i - 1].a);
    out.push({ t: pts[i].t, s: g >= zg * sdOf(rg) && a <= -za * sdOf(ra) ? 1 : 0 });
  }
  return out;
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
const yearOf = (t) => new Date(t * 1000).getUTCFullYear();

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

export function runTest(test, gold, pts, { seeds = SEEDS, end = OOS_END } = {}) {
  const win = { is: [IS_FROM, SPLIT - 1], oos: [SPLIT, Math.min(end, dayOf(gold[gold.length - 1].time) + DAY - 1)] };
  const rows = signals(pts, test.zg, test.za);
  const out = { id: test.id, zg: test.zg, za: test.za, sides: test.sides, hold: test.hold, stopAtr: test.stopAtr, what: test.what };
  for (const [w, [from, to]] of Object.entries(win)) {
    const days = rows.filter((d) => d.t >= from && d.t <= to);
    const sig = days.filter((d) => test.sides.includes(d.s));
    const tr = simulate(sig, gold, test.hold, test.stopAtr), tr2 = simulate(sig, gold, test.hold, test.stopAtr, { costX: 2 });
    const base = baselines(days, gold, test.hold, test.stopAtr, test.sides);
    for (const x of tr) x.excess = x.net - base[x.side][yearOf(x.sig)];
    const ex = stat(tr.map((x) => x.excess)), exM = tr.length ? monthly(tr, from, to, 'excess') : { t: null };
    const bySide = Object.fromEntries(test.sides.map((sd0) => { const a = tr.filter((x) => x.side === sd0); return [sd0 > 0 ? 'long' : 'short', { n: a.length, gross: r3(stat(a.map((x) => x.gross)).mean), net: r3(stat(a.map((x) => x.net)).mean), base: r3(base[sd0].all) }]; }));
    out[w] = { from: iso(from), to: iso(to), eligible: days.length, signals: sig.length, ...summarize(tr, from, to, tr2),
      excess: r3(ex.mean), excessExact: ex.mean == null ? null : +ex.mean.toPrecision(4), tExcessMonth: r2(exM.t), bySide };
    if (w === 'oos') {
      out.trades = tr.map((x) => ({ sig: iso(x.sig), entry: iso(x.t), side: x.side, e: r2(x.e), risk: r2(x.risk), exit: r2(x.exit), kind: x.kind, gross: r3(x.gross), net: r3(x.net), excess: r3(x.excess) }));
      if (seeds) {
        const ts = [], sides = sig.map((d) => d.s);
        for (let s = 1; s <= seeds; s++) {
          const pick = shuffle(days, rng(s)).slice(0, sig.length).sort((a, b) => a.t - b.t).map((d, i) => ({ t: d.t, s: sides[i] }));
          ts.push(summarize(simulate(pick, gold, test.hold, test.stopAtr), from, to).tMonth);
        }
        const real = out.oos.tMonth, srt = [...ts].sort((a, b) => a - b);
        out.placebo = { seeds, draws: sig.length, t: ts, beaten: ts.filter((t) => real != null && t != null && real > t).length, atLeast2: ts.filter((t) => t != null && t >= 2).length, median: r2(srt[Math.floor(srt.length / 2)]), p5: r2(srt[1]), p95: r2(srt[38]) };
      }
    }
  }
  return out;
}

export function verdictOf(tests) {
  for (const t of tests) {
    const ch = { oosTAndHolm: t.oos.tMonth != null && t.oos.tMonth >= 2 && t.holm < 0.05, isPositive: t.is.netExact > 0,
      x2Positive: t.oos.x2 > 0, excessPositive: t.oos.excessExact > 0, placebo38: (t.placebo?.beaten ?? 0) >= 38, n30: t.oos.n >= 30 };
    t.checks = ch; t.pass = Object.values(ch).every(Boolean);
  }
  if (tests.find((t) => t.id === 'T1').pass) return 'PASS';
  return tests.some((t) => t.pass) ? 'PARTIAL' : 'FAIL';
}

export function study(dir) {
  const gold = load(dir, 'xau'), aud = load(dir, 'audusd');
  const pts = matched(gold, aud);
  const tests = TESTS.map((t) => runTest(t, gold, pts));
  const ps = tests.map((t) => normP(t.oos.tMonth)), hs = holm(ps);
  tests.forEach((t, i) => { t.p = +ps[i].toPrecision(3); t.holm = +hs[i].toPrecision(3); });
  const verdict = verdictOf(tests);
  const ctx = {};
  for (const [z, zg, za] of [['z05', 0.5, 0.5], ['z10', 1.0, 0.5]]) {
    const rows = signals(pts, zg, za);
    ctx[z] = {};
    for (const [w, a, b] of [['is', IS_FROM, SPLIT - 1], ['oos', SPLIT, OOS_END]]) {
      const rs = rows.filter((r) => r.t >= a && r.t <= b);
      ctx[z][w] = { days: rs.length, haven: rs.filter((r) => r.s > 0).length };
    }
  }
  const span = (b) => ({ first: iso(b[0].time), last: iso(b[b.length - 1].time), days: b.length });
  return { data: { xau: span(gold), audusd: span(aud), matched: pts.length }, context: ctx, tests, verdict };
}

// ── report ──
const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(3));
const f2 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(2));
export function headline(r) {
  const t1 = r.tests[0];
  return `**Verdict: ${r.verdict}, ${r.tests.filter((t) => t.pass).length} of 3: buying gold after a day it rose while the Australian dollar fell makes ${f3(t1.oos.net)}R a trade net out of sample 2017-26 (n ${t1.oos.n}, month t ${f2(t1.oos.tMonth)}), excess ${f3(t1.oos.excess)}R over the year's buy.**`;
}
export function report(r) {
  const L = [];
  L.push('# Result: gold after a haven day in Australian-dollar terms (14 Nov 2026)', '', headline(r), '');
  L.push('Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (pushed alone before any trade result was computed). Paper research',
    'only, a **stand-alone rule on gold**: not a gate, entry, exit or size of the live gold book, and nothing here was compared with',
    'or applied to that book; its 2006-17 positions were not read (owner decision 44). No live rule, size, filter, stop, config, cost',
    'constant or council member changed. No proposal is written. This page is written by `run.mjs` from `result.json`.', '');
  L.push('## What was tested', '');
  L.push(`- Data: OANDA mid daily candles (UTC), council-data \`research/daily/xau.json\` and \`audusd.json\` at commit \`${(r.councilData || '').slice(0, 8)}\`` +
    ` (gold ${r.data.xau.first} to ${r.data.xau.last}), weekends folded into Monday with \`council/fills.mjs\` \`foldWeekend\`.`);
  L.push('- Signal (haven day): gold\'s daily log return >= z_g x sd AND AUD/USD\'s <= -z_a x sd, sd of the 60 matched daily returns before',
    `  the day; buy XAU/USD at the next daily open (long only). Haven days with z 0.5 / 0.5: ${r.context.z05.is.haven} in sample, ${r.context.z05.oos.haven} out of sample; with z 1.0 / 0.5: ${r.context.z10.is.haven} and ${r.context.z10.oos.haven}.`);
  L.push('  (The pre-registration counted 134 out-of-sample haven days through November 2026; the window ends 31 Oct 2026.)');
  L.push('- Trade: stop k x ATR(20) of the 20 gold candles before the entry (1R), gaps through the stop fill at the open, one position at',
    '  a time per test. Costs $0.60 a round trip plus financing on buys, `nights()` x `FIN.xau.long` x entry (today\'s demo rate for every year).');
  L.push('- Baseline: the same trade entered after every eligible day of the same calendar year, same side; excess = net R minus that mean.');
  L.push('- t on calendar-month sums of net R (empty months 0), Holm over T1-T3 on the one-sided OOS p; 40 seeded placebos per test.', '');
  L.push('## Results', '', '| Test | Window | n | gross R | net R | net at 2x | month t (gross) | month t (net) | excess R | excess t | stops |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const t of r.tests) for (const w of ['is', 'oos']) {
    const x = t[w];
    L.push(`| ${t.id} | ${w === 'is' ? '2007-16' : '2017-26'} | ${x.n} | ${f3(x.gross)} | ${f3(x.net)} | ${f3(x.x2)} | ${f2(x.tMonthGross)} | ${f2(x.tMonth)} | ${f3(x.excess)} | ${f2(x.tExcessMonth)} | ${x.stops} |`);
  }
  L.push('', '| Test | what | OOS p | Holm p | placebo beaten | placebo median t | pass |', '|---|---|---|---|---|---|---|');
  for (const t of r.tests) L.push(`| ${t.id} | ${t.what} | ${t.p} | ${t.holm} | ${t.placebo.beaten} of 40 | ${f2(t.placebo.median)} | ${t.pass ? 'yes' : 'no'} |`);
  L.push('', '## Against the baseline (the same buy after every day of the year)', '', '| Test | Window | side | n | gross R | net R | baseline net R a trade |', '|---|---|---|---|---|---|---|');
  for (const t of r.tests) for (const w of ['is', 'oos']) for (const [s, v] of Object.entries(t[w].bySide)) L.push(`| ${t.id} | ${w === 'is' ? '2007-16' : '2017-26'} | ${s} | ${v.n} | ${f3(v.gross)} | ${f3(v.net)} | ${f3(v.base)} |`);
  L.push('', `Median risk (1R) per T1 trade: $${r.tests[0].is.medianRisk} in sample, $${r.tests[0].oos.medianRisk} out of sample; mean cost ${r.tests[0].is.meanCost}R / ${r.tests[0].oos.meanCost}R.`);
  L.push('', '## Reading', '');
  L.push(r.verdict === 'PASS' ? 'T1 met every pre-registered check. A pass is evidence for one stand-alone rule, not a proven edge and not a change to anything live.'
    : 'A day on which gold rises while the Australian dollar falls does not lead XAU/USD by enough to trade on the pre-registered bar. Not an edge; never use it as a filter, gate or size step. No re-run with other thresholds, holds or stops (any such look would be post hoc).');
  L.push('', '## To repeat', '', '`node research/edge/gold-aud-haven-day/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then',
    '`node research/edge/gold-aud-haven-day/run.mjs full <dir>`; delete `<dir>` afterwards. Tests: `tests/gold-aud-haven-day.test.mjs`.', '');
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
  } else if (cmd === 'full') {
    const r = study(dir), src = fs.existsSync(path.join(dir, 'SOURCE')) ? fs.readFileSync(path.join(dir, 'SOURCE'), 'utf8').trim() : null;
    const out = { title: 'Gold after a haven day in Australian-dollar terms', built: '2026-11-14', prereg: 'PREREGISTRATION.md', councilData: src,
      system: 'Stand-alone gold rule (XAU/USD), signal from XAU/USD and AUD/USD; not the live gold book',
      rule: { signal: `gold log return >= z_g x sd and AUD/USD's <= -z_a x sd (sd of the ${VOL_N} matched returns before the day): long`, entry: 'next XAU/USD open',
        stop: `k x ATR(${ATR_N}) before the entry`, costs: `$${RT.toFixed(2)} a trade + nights() x FIN.xau.long on buys`, oneAtATime: true },
      fin: FIN.xau.long, isFrom: '2007-01-01', split: '2017-01-01', oosEnd: '2026-10-31', ...r };
    out.headline = headline(r).replace(/^\*\*Verdict: /, '').replace(/\*\*$/, '');
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(out));
    for (const t of r.tests) {
      for (const w of ['is', 'oos']) { const x = t[w]; console.log(t.id, w, 'sig', x.signals, 'n', x.n, 'gross', x.gross, 'net', x.net, 'x2', x.x2, 'tMoG', x.tMonthGross, 'tMo', x.tMonth, 'exc', x.excess, 'tExc', x.tExcessMonth, JSON.stringify(x.bySide)); }
      console.log(t.id, 'p', t.p, 'holm', t.holm, 'pass', t.pass, JSON.stringify(t.checks), 'placebo', t.placebo.beaten, t.placebo.median);
    }
    console.log(headline(r).length, 'VERDICT', r.verdict);
  } else console.log('usage: run.mjs fetch <dir> | full <dir>');
};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
