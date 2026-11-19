// Does gold catch up with a large multi-day crude-oil move it has not followed yet? (research/edge/gold-oil-catchup;
// rules fixed in PREREGISTRATION.md). Paper research only: a stand-alone rule on spot gold, never a gate / entry / exit / size
// of the live gold book, and nothing of that book's 2006-17 positions is read (owner decision 44).
//   node research/edge/gold-oil-catchup/run.mjs fetch <dir>   copy the daily caches out of origin/council-data (no network)
//   node research/edge/gold-oil-catchup/run.mjs count <dir>   signal and position counts only (no outcome is computed)
//   node research/edge/gold-oil-catchup/run.mjs full <dir>    run the study, write result.json next to this file
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FIN, nights, foldWeekend } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DAY = 86400;
export const N = 10;            // the 10-day return of oil and of gold (close of day i over close of day i - 10)
export const WIN = 500;         // trailing window of 10-day returns for the percentiles (days i-500 .. i-1, never day i)
export const OIL_Q = 0.10;      // oil's 10-day return at or beyond its trailing 10th / 90th percentile
export const GOLD_Q = 0.50;     // gold's |10-day return| at or under its trailing median: gold has not followed
export const ATR_N = 20, STOP_ATR = 3, SPREAD = 0.30, SLIP = SPREAD / 2, SEEDS = 40;
export const RT = SPREAD + 2 * SLIP;   // $0.60 a round trip: spread + half a spread on each of the two market orders
export const KEYS = ['xau', 'wtico', 'bco'];
export const IS_FROM = Date.UTC(2007, 0, 1) / 1000;
export const SPLIT = Date.UTC(2017, 0, 1) / 1000;
export const OOS_END = Date.UTC(2026, 9, 31, 23, 59, 59) / 1000;
export const TESTS = [
  { id: 'T1', market: 'wtico', hold: 3, what: 'WTI 10-day move in its top / bottom decile, gold flat: gold the way of oil for 3 days (primary)' },
  { id: 'T2', market: 'bco', hold: 3, what: 'the same rule on Brent, 3 days' },
  { id: 'T3', market: 'wtico', hold: 10, what: 'the WTI rule held 10 days' },
];

// ── data ──
export const toBars = (j) => j.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
export const load = (dir, key) => foldWeekend(toBars(JSON.parse(fs.readFileSync(path.join(dir, key + '.json'), 'utf8'))));

// value at quantile q of a sorted copy (linear interpolation)
export function quantile(arr, q) {
  const a = arr.slice().sort((x, y) => x - y), p = (a.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p);
  return a[lo] + (a[hi] - a[lo]) * (p - lo);
}

// ── signal, evaluated at the close of gold day i (oil matched by the same UTC day stamp) ──
// s = +1 when oil's 10-day log return is at or above the 90th percentile of its previous WIN 10-day returns, -1 at or under
// the 10th; and gold's |10-day log return| at or under the median of its previous WIN |10-day returns|. Everything read is
// a close at or before day i.
export function signals(gold, oil, { n = N, win = WIN, oilQ = OIL_Q, goldQ = GOLD_Q } = {}) {
  const om = new Map(oil.map((b) => [b.time, b.close]));
  // aligned series: gold days that have an oil close on the same day
  const rows = gold.map((b, i) => ({ i, t: b.time, g: b.close, o: om.get(b.time) })).filter((r) => r.o > 0);
  const out = [];
  const oR = [], gR = [];
  for (let k = 0; k < rows.length; k++) {
    if (k < n) { oR.push(null); gR.push(null); continue; }
    oR.push(Math.log(rows[k].o / rows[k - n].o)); gR.push(Math.abs(Math.log(rows[k].g / rows[k - n].g)));
  }
  for (let k = n + win; k < rows.length; k++) {
    const po = oR.slice(k - win, k), pg = gR.slice(k - win, k);
    const hiO = quantile(po, 1 - oilQ), loO = quantile(po, oilQ), medG = quantile(pg, goldQ);
    const s = oR[k] >= hiO ? 1 : oR[k] <= loO ? -1 : 0;
    out.push({ t: rows[k].t, i: rows[k].i, oil10: oR[k], gold10: gR[k], s: s && gR[k] <= medG ? s : 0, oilOnly: s });
  }
  return out;
}

// ATR(n) of the n true ranges of the candles before index j
export function atrBefore(gold, j, n = ATR_N) {
  if (j - n - 1 < 0) return null;
  let s = 0;
  for (let i = j - n; i < j; i++) { const b = gold[i], pc = gold[i - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}
// exit stamp: the day's end Monday-Thursday, 21:59:59 UTC on Friday
export const exitStamp = (dayT) => dayT + (new Date(dayT * 1000).getUTCDay() === 5 ? 22 * 3600 - 1 : DAY - 1);

// one gold trade opened at the open of candle j, side +1 / -1, held `hold` candles, stop STOP_ATR x ATR(20) from the open
export function tradeAt(gold, j, side, hold, costX = 1) {
  const atr = atrBefore(gold, j);
  if (!(atr > 0) || j + hold - 1 >= gold.length) return null;
  const risk = STOP_ATR * atr, e = gold[j].open, stop = e - side * risk;
  const through = (px) => (side > 0 ? px <= stop : px >= stop);
  let exit = null, kind = 'time', k = j;
  for (; k < j + hold; k++) {
    const b = gold[k];
    if (k > j && through(b.open)) { exit = b.open; kind = 'gap'; break; }
    if (through(side > 0 ? b.low : b.high)) { exit = stop; kind = 'stop'; break; }
  }
  if (exit == null) { k = j + hold - 1; exit = gold[k].close; }
  const t = gold[j].time, c = exitStamp(gold[k].time), nn = nights(t, c);
  const gross = side * (exit - e) / risk, fin = side > 0 ? nn * FIN.xau.long * e / risk : 0, rt = RT / risk;
  return { t, c, j, k, side, e, stop, risk, exit, kind, nights: nn, gross, fin, cost: rt + fin, net: gross - costX * (rt + fin) };
}

// trades from signal days ({ i: gold index of the signal close, s }): entry at gold[i + 1].open, one position at a time
export function simulate(days, gold, hold, { costX = 1 } = {}) {
  const out = []; let lastK = -1;
  for (const d of days) {
    if (!d.s) continue;
    const j = d.i + 1; if (j >= gold.length || j <= lastK) continue;
    const tr = tradeAt(gold, j, d.s, hold, costX); if (!tr) continue;
    out.push({ ...tr, sig: d.t }); lastK = tr.k;
  }
  return out;
}

// the same-side every-day baseline: a trade of each side opened at every gold open of the window (overlapping), its mean
export function baseline(gold, from, to, hold) {
  const res = { long: [], short: [] };
  for (let j = ATR_N + 2; j < gold.length; j++) {
    const t = gold[j].time; if (t < from || t > to) continue;
    for (const side of [1, -1]) { const tr = tradeAt(gold, j, side, hold); if (tr) res[side > 0 ? 'long' : 'short'].push(tr.net); }
  }
  return { long: stat(res.long).mean, short: stat(res.short).mean, nLong: res.long.length, nShort: res.short.length };
}

// ── statistics ──
export function stat(a) {
  const n = a.length; if (!n) return { n: 0, mean: null, t: null, sum: 0 };
  const m = a.reduce((x, y) => x + y, 0) / n, sd = n > 1 ? Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (n - 1)) : 0;
  return { n, mean: m, sum: m * n, t: sd > 0 ? m / (sd / Math.sqrt(n)) : null };
}
const mk = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
// t on calendar-month sums (by exit stamp); every month from `from` to `to` counts, empty ones as 0
export function monthly(rows, from, to, key) {
  const a = mk(from), b = mk(Math.max(to, ...rows.map((r) => r.c))), m = new Array(b - a + 1).fill(0);
  for (const r of rows) m[mk(r.c) - a] += r[key];
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
// placebo: the real signal days, each given a seeded random side (removes the direction oil gives)
export function placeboDays(days, r) { return days.map((d) => ({ ...d, s: r() < 0.5 ? 1 : -1 })); }
// control: each real signal moved to a random gold day of the same calendar year, keeping its side (keeps each year's
// drift and volatility, removes the timing the oil move gives)
export function controlDays(days, gold, from, to, r) {
  const byYear = new Map();
  gold.forEach((b, i) => { if (b.time < from || b.time > to || i < ATR_N + 2) return; const y = new Date(b.time * 1000).getUTCFullYear(); (byYear.get(y) || byYear.set(y, []).get(y)).push(i); });
  return days.map((d) => { const pool = byYear.get(new Date(d.t * 1000).getUTCFullYear()); const i = pool[Math.floor(r() * pool.length)]; return { t: gold[i].time, i, s: d.s }; })
    .sort((a, b) => a.t - b.t);
}

const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000), r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);

// excess of each trade = its net R minus the same-side every-day baseline mean of the window
export const withExcess = (trades, base) => trades.map((x) => ({ ...x, ex: x.net - (x.side > 0 ? base.long : base.short) }));

export function summarize(trades, from, to, x2, base) {
  const tr = withExcess(trades, base);
  const s = stat(tr.map((x) => x.net)), g = stat(tr.map((x) => x.gross)), e = stat(tr.map((x) => x.ex));
  const mo = tr.length ? monthly(tr, from, to, 'net') : { t: null, months: 0 }, mg = tr.length ? monthly(tr, from, to, 'gross') : { t: null };
  const me = tr.length ? monthly(tr, from, to, 'ex') : { t: null };
  return {
    n: s.n, long: tr.filter((x) => x.side > 0).length, short: tr.filter((x) => x.side < 0).length,
    win: s.n ? r3(tr.filter((x) => x.net > 0).length / s.n) : null, stops: tr.filter((x) => x.kind !== 'time').length,
    gross: r3(g.mean), net: r3(s.mean), netExact: s.mean == null ? null : +s.mean.toPrecision(4), total: r2(s.sum),
    excess: r3(e.mean), excessExact: e.mean == null ? null : +e.mean.toPrecision(4),
    x2: x2 ? r3(stat(x2.map((x) => x.net)).mean) : undefined,
    x2Excess: x2 ? r3(stat(withExcess(x2, base.x2).map((x) => x.ex)).mean) : undefined,
    tExcess: r2(me.t), tMonth: r2(mo.t), tMonthGross: r2(mg.t), months: mo.months, tTrade: r2(s.t),
    meanCost: s.n ? r3(stat(tr.map((x) => x.cost)).mean) : null, meanRisk: s.n ? r2(stat(tr.map((x) => x.risk)).mean) : null,
  };
}

const pct = (arr, real) => ({ atLeastReal: arr.filter((t) => t != null && real != null && t >= real).length, median: r2(quantile(arr.filter((x) => x != null), 0.5)), p95: r2(quantile(arr.filter((x) => x != null), 0.95)) });

export function runTest(test, gold, oil, { seeds = SEEDS, end = OOS_END } = {}) {
  const sig = signals(gold, oil);
  const win = { is: [IS_FROM, SPLIT - 1], oos: [SPLIT, Math.min(end, gold[gold.length - 1].time + DAY - 1)] };
  const out = { id: test.id, market: test.market, hold: test.hold, what: test.what };
  for (const [w, [from, to]] of Object.entries(win)) {
    const days = sig.filter((d) => d.t >= from && d.t <= to), ev = days.filter((d) => d.s);
    const base = baseline(gold, from, to, test.hold);
    base.x2 = (() => { const b = { long: [], short: [] }; for (let j = ATR_N + 2; j < gold.length; j++) { const t = gold[j].time; if (t < from || t > to) continue; for (const side of [1, -1]) { const tr = tradeAt(gold, j, side, test.hold, 2); if (tr) b[side > 0 ? 'long' : 'short'].push(tr.net); } } return { long: stat(b.long).mean, short: stat(b.short).mean }; })();
    const tr = simulate(ev, gold, test.hold), tr2 = simulate(ev, gold, test.hold, { costX: 2 });
    out[w] = { from: iso(from), to: iso(to), signalDays: ev.length, up: ev.filter((d) => d.s > 0).length, down: ev.filter((d) => d.s < 0).length,
      oilOnlyDays: days.filter((d) => d.oilOnly).length, baseline: { long: r3(base.long), short: r3(base.short), n: base.nLong },
      ...summarize(tr, from, to, tr2, base) };
    if (seeds) {
      const pl = [], co = [];
      for (let s = 1; s <= seeds; s++) {
        pl.push(summarize(simulate(placeboDays(ev, rng(s)), gold, test.hold), from, to, null, base).tExcess);
        co.push(summarize(simulate(controlDays(ev, gold, from, to, rng(1000 + s)), gold, test.hold), from, to, null, base).tExcess);
      }
      out[w].placebo = { seeds, t: pl, ...pct(pl, out[w].tExcess) };
      out[w].control = { seeds, t: co, ...pct(co, out[w].tExcess) };
    }
    if (w === 'oos') out.trades = withExcess(tr, base).map((x) => ({ sig: iso(x.sig), entry: iso(x.t), side: x.side, e: r2(x.e), risk: r2(x.risk), exit: r2(x.exit), kind: x.kind, gross: r3(x.gross), net: r3(x.net), ex: r3(x.ex) }));
  }
  return out;
}

export function verdictOf(tests) {
  for (const t of tests) {
    const c1 = t.oos.tExcess != null && t.oos.tExcess >= 2 && t.holm < 0.05, c2 = t.is.excessExact > 0, c3 = t.oos.x2Excess > 0 && t.oos.x2 > 0;
    const c4 = t.oos.placebo.atLeastReal <= 2, c5 = t.oos.control.atLeastReal <= 2;
    t.checks = { oosTAndHolm: c1, isSameSign: c2, x2Positive: c3, placebo: c4, control: c5 }; t.pass = c1 && c2 && c3 && c4 && c5;
  }
  if (tests.find((t) => t.id === 'T1').pass) return 'PASS';
  return tests.some((t) => t.pass) ? 'PARTIAL' : 'FAIL';
}

export function study(dir) {
  const gold = load(dir, 'xau'), m = { wtico: load(dir, 'wtico'), bco: load(dir, 'bco') };
  const tests = TESTS.map((t) => runTest(t, gold, m[t.market]));
  const ps = tests.map((t) => normP(t.oos.tExcess)), hs = holm(ps);
  tests.forEach((t, i) => { t.p = +ps[i].toPrecision(3); t.holm = +hs[i].toPrecision(3); });
  const verdict = verdictOf(tests);
  const span = (b) => ({ first: iso(b[0].time), last: iso(b[b.length - 1].time), days: b.length });
  return { data: { xau: span(gold), wtico: span(m.wtico), bco: span(m.bco) }, tests, verdict };
}

// counts only: signal days and the positions they would open (one at a time), no price after a signal is read
export function counts(dir) {
  const gold = load(dir, 'xau'), out = {};
  for (const test of TESTS) {
    const sig = signals(gold, load(dir, test.market));
    for (const [w, from, to] of [['is', IS_FROM, SPLIT - 1], ['oos', SPLIT, OOS_END]]) {
      const ev = sig.filter((d) => d.t >= from && d.t <= to && d.s);
      let last = -1, pos = 0; for (const d of ev) { if (d.i + 1 > last) { pos++; last = d.i + test.hold; } }
      out[test.id + ' ' + w] = { signalDays: ev.length, positions: pos };
    }
  }
  return out;
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
    console.log(JSON.stringify(counts(dir), null, 1));
  } else if (cmd === 'full') {
    const r = study(dir), src = fs.existsSync(path.join(dir, 'SOURCE')) ? fs.readFileSync(path.join(dir, 'SOURCE'), 'utf8').trim() : null;
    const out = { title: 'Gold catching up with a large crude-oil move it has not followed', built: new Date().toISOString().slice(0, 10), prereg: 'PREREGISTRATION.md', councilData: src,
      rule: { signal: `oil ${N}-day log return at or beyond its ${OIL_Q * 100}th / ${(1 - OIL_Q) * 100}th percentile of the previous ${WIN}, and gold's |${N}-day log return| at or under the median of its previous ${WIN}`,
        entry: "gold's next folded UTC daily open, the way of oil's move", stop: `${STOP_ATR} x ${ATR_N}-day ATR from the entry`, exit: 'close of the hold-th gold candle (entry candle = 1)',
        baseline: 'the same side opened at every gold open of the window (same stop, hold and costs), its mean net R',
        costs: `$${RT.toFixed(2)} a round trip + nights() x FIN.xau.long x entry on longs`, oneAtATime: true },
      fin: FIN.xau.long, isFrom: '2007-01-01', split: '2017-01-01', oosEnd: '2026-10-31', ...r };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    for (const t of r.tests) {
      for (const w of ['is', 'oos']) { const x = t[w]; console.log(t.id, w, 'sig', x.signalDays, 'n', x.n, `(${x.long}/${x.short})`, 'gross', x.gross, 'net', x.net, 'base', JSON.stringify(x.baseline), 'ex', x.excess, 'tEx', x.tExcess, 'tNet', x.tMonth, 'x2', x.x2, 'x2ex', x.x2Excess, 'win', x.win, 'stops', x.stops, 'cost', x.meanCost, 'pl>=', x.placebo.atLeastReal, x.placebo.median, 'co>=', x.control.atLeastReal, x.control.median); }
      console.log(t.id, 'p', t.p, 'holm', t.holm, 'pass', t.pass, JSON.stringify(t.checks));
    }
    console.log('VERDICT', r.verdict);
  } else console.log('usage: run.mjs fetch <dir> | count <dir> | full <dir>');
};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
