// Weekly time-series momentum of the gold / silver (and gold / platinum) ratio, traded as a two-leg pair
// (research/edge/gold-silver-ratio-trend; rules fixed in PREREGISTRATION.md). Paper research only: a stand-alone
// relative-value rule, never a gate / entry / exit / size of the live gold book, and none of its 2006-17 positions is read
// (owner decision 44).
//   node research/edge/gold-silver-ratio-trend/run.mjs fetch <dir>   copy the daily caches out of origin/council-data (no network)
//   node research/edge/gold-silver-ratio-trend/run.mjs count <dir>   count the signal weeks per window (no R computed)
//   node research/edge/gold-silver-ratio-trend/run.mjs full <dir>    run the study, write result.json next to this file
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FIN, nights, foldWeekend } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DAY = 86400;
export const ATR_N = 20, STOP_ATR = 3, SEEDS = 40, LEG = 0.5;
// round trip a leg in dollars: gold $0.60 ($0.30 spread + half a spread of slippage on entry and exit); silver $0.06 (the
// $0.03 spread of gold-drd-silver / gold-silver-ratio, doubled the same way); platinum $2.00 (an assumed $1.00 spread, doubled)
export const COST = { xau: 0.60, xag: 0.06, xpt: 2.00 };
export const FIN_LONG = FIN.xau.long;   // a night, fraction of price, charged on every long leg (silver and platinum assumed equal)
export const KEYS = ['xau', 'xag', 'xpt'];
export const IS_FROM = Date.UTC(2007, 0, 1) / 1000;
export const SPLIT = Date.UTC(2017, 0, 1) / 1000;
export const OOS_END = Date.UTC(2026, 9, 31, 23, 59, 59) / 1000;
export const TESTS = [
  { id: 'T1', metal: 'xag', look: 13, what: 'gold / silver ratio, sign of its 13-week change -> the same side for the next week (primary)' },
  { id: 'T2', metal: 'xpt', look: 13, what: 'gold / platinum ratio, sign of its 13-week change -> the same side for the next week' },
  { id: 'T3', metal: 'xag', look: 4, what: 'gold / silver ratio, sign of its 4-week change -> the same side for the next week' },
];

// ── data ──
export const toBars = (j) => j.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
export const load = (dir, key) => foldWeekend(toBars(JSON.parse(fs.readFileSync(path.join(dir, key + '.json'), 'utf8'))));
export function joint(gold, metal) {
  const m = new Map(metal.map((b) => [b.time, b.close]));
  return gold.filter((b) => m.has(b.time)).map((b) => ({ t: b.time, g: b.close, m: m.get(b.time) }));
}
// Monday-based week number of a UTC day stamp (1970-01-01 was a Thursday)
export const weekOf = (t) => Math.floor((Math.floor(t / DAY) + 3) / 7);

// weeks of joint days: { w, first, last (UTC day stamps), L = ln(gold / metal) at the last joint close }
export function weeks(j) {
  const out = [];
  for (const x of j) {
    const w = weekOf(x.t), cur = out[out.length - 1];
    if (cur && cur.w === w) { cur.last = x.t; cur.L = Math.log(x.g / x.m); } else out.push({ w, first: x.t, last: x.t, L: Math.log(x.g / x.m) });
  }
  return out;
}

// signal at the close of week i (uses that close and the close `look` weeks before only), traded in week i + 1;
// s = +1 long gold / short metal (the ratio rose), -1 the reverse, 0 no trade
export function signals(wk, look) {
  const out = [];
  for (let i = look; i + 1 < wk.length; i++) {
    if (wk[i + 1].w !== wk[i].w + 1) continue;   // the next week must be the next calendar week
    const mom = wk[i].L - wk[i - look].L;
    out.push({ sig: wk[i].last, from: wk[i + 1].first, to: wk[i + 1].last, mom, s: mom > 0 ? 1 : mom < 0 ? -1 : 0 });
  }
  return out;
}

export function indexAt(bars, t) {   // last bar with time <= t
  let lo = 0, hi = bars.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (bars[m].time <= t) lo = m + 1; else hi = m; }
  return lo - 1;
}
export function atrUpTo(bars, i, n = ATR_N) {   // ATR of the n candles ending at bar i (inclusive)
  if (i - n < 0) return null;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) { const b = bars[k], pc = bars[k - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}
export const exitStamp = (dayT) => dayT + (new Date(dayT * 1000).getUTCDay() === 5 ? 22 * 3600 - 1 : DAY - 1);

// one leg: entry at the open of the first bar from `from`, fixed stop STOP_ATR x ATR(20) known at the signal close,
// out at the stop (at the open when gapped through) or at the close of the last bar up to `to`
export function leg(bars, sigT, from, to, side, rt, costX = 1) {
  const si = indexAt(bars, sigT), atr = atrUpTo(bars, si);
  let j = si + 1;
  if (!(atr > 0) || j >= bars.length || bars[j].time < from || bars[j].time > to) return null;
  const risk = STOP_ATR * atr, e = bars[j].open, stop = e - side * risk;
  const through = (px) => (side > 0 ? px <= stop : px >= stop);
  let exit = null, kind = 'time', k = j;
  for (; k < bars.length && bars[k].time <= to; k++) {
    const b = bars[k];
    if (k > j && through(b.open)) { exit = b.open; kind = 'gap'; break; }
    if (through(side > 0 ? b.low : b.high)) { exit = stop; kind = 'stop'; break; }
  }
  if (exit == null) { k = Math.min(k, bars.length) - 1; exit = bars[k].close; }
  const t = bars[j].time, c = exitStamp(bars[k].time), nn = nights(t, c);
  const gross = side * (exit - e) / risk, fin = side > 0 ? nn * FIN_LONG * e / risk : 0, trade = rt / risk;
  return { t, c, side, e, stop, risk, exit, kind, nights: nn, gross, fin, cost: trade + fin, net: gross - costX * (trade + fin) };
}

// the pair: each leg risks LEG (0.5R) at its stop, so 1R = the two stops together
export function pair(gold, metal, mk, sg, side, costX = 1) {
  const a = leg(gold, sg.sig, sg.from, sg.to, side, COST.xau, costX), b = leg(metal, sg.sig, sg.from, sg.to, -side, COST[mk], costX);
  if (!a || !b) return null;
  return { sig: sg.sig, t: Math.min(a.t, b.t), c: Math.max(a.c, b.c), side, gold: a, metal: b,
    gross: LEG * (a.gross + b.gross), cost: LEG * (a.cost + b.cost), fin: LEG * (a.fin + b.fin), net: LEG * (a.net + b.net),
    stops: (a.kind !== 'time') + (b.kind !== 'time') };
}

export function simulate(sigs, gold, metal, mk, { costX = 1, sides = null } = {}) {
  const out = [];
  sigs.forEach((sg, i) => {
    const s = sides ? sides[i] : sg.s; if (!s) return;
    const p = pair(gold, metal, mk, sg, s, costX); if (p) out.push(p);
  });
  return out;
}

// ── statistics ──
export function stat(a) {
  const n = a.length; if (!n) return { n: 0, mean: null, t: null, sum: 0 };
  const m = a.reduce((x, y) => x + y, 0) / n, sd = n > 1 ? Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (n - 1)) : 0;
  return { n, mean: m, sum: m * n, t: sd > 0 ? m / (sd / Math.sqrt(n)) : null };
}
const mkey = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
// calendar-month sums by exit month over every month of the window (months with no exit count as 0)
export function monthly(rows, from, to, key) {
  const a = mkey(from), b = mkey(Math.max(to, ...rows.map((r) => r.c))), m = new Array(b - a + 1).fill(0);
  for (const r of rows) m[mkey(r.c) - a] += r[key];
  return { ...stat(m), months: m.length };
}
export function normP(t) {   // one-sided upper tail
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
export function rng(seed) {   // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000), r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);

export function summarize(tr, from, to, x2) {
  const s = stat(tr.map((x) => x.net)), g = stat(tr.map((x) => x.gross));
  const mo = tr.length ? monthly(tr, from, to, 'net') : { t: null, months: 0 }, mg = tr.length ? monthly(tr, from, to, 'gross') : { t: null };
  return {
    n: s.n, long: tr.filter((x) => x.side > 0).length, short: tr.filter((x) => x.side < 0).length,
    win: s.n ? r3(tr.filter((x) => x.net > 0).length / s.n) : null, legStops: tr.reduce((a, x) => a + x.stops, 0),
    gross: r3(g.mean), net: r3(s.mean), netExact: s.mean == null ? null : +s.mean.toPrecision(4), total: r2(s.sum),
    x2: x2 ? r3(stat(x2.map((x) => x.net)).mean) : undefined,
    tMonth: r2(mo.t), tMonthGross: r2(mg.t), months: mo.months, tTrade: r2(s.t),
    meanCost: s.n ? r3(stat(tr.map((x) => x.cost)).mean) : null, meanFin: s.n ? r3(stat(tr.map((x) => x.fin)).mean) : null,
  };
}

export const windows = (end) => ({ is: [IS_FROM, SPLIT - 1], oos: [SPLIT, end] });

export function runTest(test, gold, metal, { seeds = SEEDS, end = OOS_END } = {}) {
  const sigs = signals(weeks(joint(gold, metal)), test.look), out = { id: test.id, metal: test.metal, look: test.look, what: test.what };
  for (const [w, [from, to]] of Object.entries(windows(Math.min(end, gold[gold.length - 1].time + DAY - 1)))) {
    const ws = sigs.filter((x) => x.from >= from && x.from <= to);
    const tr = simulate(ws, gold, metal, test.metal), tr2 = simulate(ws, gold, metal, test.metal, { costX: 2 });
    const fixed = (v) => summarize(simulate(ws, gold, metal, test.metal, { sides: ws.map(() => v) }), from, to);
    const up = fixed(1), dn = fixed(-1);
    out[w] = { from: iso(from), to: iso(to), weeks: ws.length, ...summarize(tr, from, to, tr2),
      everyWeekLongRatio: { n: up.n, net: up.net, tMonth: up.tMonth }, everyWeekShortRatio: { n: dn.n, net: dn.net, tMonth: dn.tMonth } };
    if (seeds) {
      const ms = [];
      for (let s = 1; s <= seeds; s++) { const r = rng(s); ms.push(stat(simulate(ws, gold, metal, test.metal, { sides: ws.map(() => (r() < 0.5 ? 1 : -1)) }).map((x) => x.net)).mean); }
      const real = out[w].netExact, srt = [...ms].sort((a, b) => a - b);
      out[w].placebo = { seeds, means: ms.map(r3), below: ms.filter((m) => real != null && m < real).length, median: r3((srt[19] + srt[20]) / 2), p95: r3(srt[37]) };
    }
    if (w === 'oos') out.trades = tr.map((x) => ({ sig: iso(x.sig), side: x.side, gross: r3(x.gross), net: r3(x.net), stops: x.stops }));
  }
  return out;
}

export function verdictOf(tests) {
  for (const t of tests) {
    const c1 = t.oos.tMonth != null && t.oos.tMonth >= 2 && t.holm < 0.05, c2 = t.is.netExact > 0, c3 = t.oos.x2 > 0;
    const c4 = t.oos.placebo ? t.oos.placebo.below >= 38 : false, c5 = t.is.n >= 100 && t.oos.n >= 100;
    t.checks = { oosTAndHolm: c1, isPositive: c2, x2Positive: c3, abovePlacebo38of40: c4, n100: c5 }; t.pass = c1 && c2 && c3 && c4 && c5;
  }
  if (tests.find((t) => t.id === 'T1').pass) return 'PASS';
  return tests.some((t) => t.pass) ? 'PARTIAL' : 'FAIL';
}

export function study(dir) {
  const gold = load(dir, 'xau'), m = { xag: load(dir, 'xag'), xpt: load(dir, 'xpt') };
  const tests = TESTS.map((t) => runTest(t, gold, m[t.metal]));
  const ps = tests.map((t) => normP(t.oos.tMonth)), hs = holm(ps);
  tests.forEach((t, i) => { t.p = +ps[i].toPrecision(3); t.holm = +hs[i].toPrecision(3); });
  const verdict = verdictOf(tests);
  const span = (b) => ({ first: iso(b[0].time), last: iso(b[b.length - 1].time), days: b.length });
  return { data: { xau: span(gold), xag: span(m.xag), xpt: span(m.xpt) }, tests, verdict };
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
    const gold = load(dir, 'xau');
    for (const t of TESTS) {
      const sigs = signals(weeks(joint(gold, load(dir, t.metal))), t.look);
      for (const [w, [from, to]] of Object.entries(windows(OOS_END))) console.log(t.id, w, 'signal weeks', sigs.filter((x) => x.from >= from && x.from <= to && x.s).length);
    }
  } else if (cmd === 'full') {
    const r = study(dir), src = fs.existsSync(path.join(dir, 'SOURCE')) ? fs.readFileSync(path.join(dir, 'SOURCE'), 'utf8').trim() : null;
    const out = { title: 'Weekly momentum of the gold / silver and gold / platinum ratios, traded as a pair', built: '2026-11-14', prereg: 'PREREGISTRATION.md', councilData: src,
      rule: { signal: 'sign of ln(gold / metal) at the last joint close of a week minus the same `look` weeks before', trade: 'the next calendar week: long gold / short metal when the ratio rose, the reverse when it fell; entry at each leg\'s first open of the week, out at its last close', stop: `${STOP_ATR} x ${ATR_N}-day ATR a leg, fixed at entry; each leg risks 0.5R`, costs: `round trip a leg: gold $${COST.xau}, silver $${COST.xag}, platinum $${COST.xpt}; nights() x ${FIN_LONG} of price on the long leg` },
      fin: FIN_LONG, split: '2017-01-01', isFrom: '2007-01-01', oosEnd: '2026-10-31', ...r };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    for (const t of r.tests) {
      for (const w of ['is', 'oos']) { const x = t[w]; console.log(t.id, w, 'n', x.n, `(${x.long}/${x.short})`, 'gross', x.gross, 'net', x.net, 'x2', x.x2, 'tMo', x.tMonth, 'tMoG', x.tMonthGross, 'win', x.win, 'legStops', x.legStops, 'cost', x.meanCost, 'fin', x.meanFin, 'up', JSON.stringify(x.everyWeekLongRatio), 'dn', JSON.stringify(x.everyWeekShortRatio), 'placebo', JSON.stringify({ ...x.placebo, means: undefined })); }
      console.log(t.id, 'p', t.p, 'holm', t.holm, 'pass', t.pass, JSON.stringify(t.checks));
    }
    console.log(JSON.stringify(r.data)); console.log('VERDICT', r.verdict);
  } else console.log('usage: run.mjs fetch <dir> | count <dir> | full <dir>');
};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
