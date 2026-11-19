// Gold's outside week with a strong close, followed for two weeks (PREREGISTRATION.md, pushed first)
//   node research/edge/gold-outside-week/run.mjs fetch <dir>   copies xau.json from origin/council-data (git show, no network)
//   node research/edge/gold-outside-week/run.mjs full <dir>    runs the three tests, writes result.json
// A new stand-alone weekly rule judged on 2017-26; not a gate, exit, entry or size of the gold book (item 44).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

export const P = { buf: 0.30, cost: 0.60, hi: 2 / 3, lo: 1 / 3, minDays: 4, isFrom: '2007-01', isTo: '2016-12', oosFrom: '2017-01', oosTo: '2026-10', h1To: '2021-12', h2From: '2022-01', seeds: 40, needBeat: 38 };
export const TESTS = [
  { id: 'T1', name: 'outside week, strong close, follow both sides, 10 days (primary)', hold: 10 },
  { id: 'T2', name: 'outside week, strong close, follow both sides, 5 days', hold: 5 },
  { id: 'T3', name: 'outside week, strong close, follow both sides, 20 days', hold: 20 },
];
const D = 86400;
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const r3 = (v) => +v.toFixed(3);

export const toDays = (rows) => foldWeekend(rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })));

// Monday of the UTC week of t (unix seconds)
export const weekOf = (t) => { const d = Math.floor(t / D), dow = (d + 3) % 7; return (d - dow) * D; }; // 1970-01-01 was a Thursday (dow 3 from Monday)

// trading days -> Monday-Friday weeks { mon, first, last (day indexes), days, open, high, low, close }
export function weeks(ds) {
  const W = [];
  ds.forEach((d, i) => {
    const mon = weekOf(d.time), w = W.at(-1);
    if (!w || w.mon !== mon) W.push({ mon, first: i, last: i, days: 1, open: d.open, high: d.high, low: d.low, close: d.close });
    else { w.last = i; w.days++; w.high = Math.max(w.high, d.high); w.low = Math.min(w.low, d.low); w.close = d.close; }
  });
  return W;
}

// close location side of week k: +1 top third, -1 bottom third, 0 middle / flat week
export function strong(w) {
  const rg = w.high - w.low;
  if (!(rg > 0)) return 0;
  const loc = (w.close - w.low) / rg;
  return loc >= P.hi ? 1 : loc <= P.lo ? -1 : 0;
}
// outside week k with a strong close: needs the previous calendar week, both with 4+ days
export function outsideSignal(W, k) {
  if (k < 1) return 0;
  const a = W[k], b = W[k - 1];
  if (a.mon - b.mon !== 7 * D || a.days < P.minDays || b.days < P.minDays) return 0;
  if (!(a.high > b.high && a.low < b.low)) return 0;
  return strong(a);
}
// baseline: any 4+-day week with a strong close
export const baseSignal = (W, k) => (W[k].days >= P.minDays ? strong(W[k]) : 0);

// trade decided at the end of week k: entry at the next week's first open, stop past week k's other extreme, `hold` days
export function trade(ds, W, k, side, hold, costMult = 1) {
  const nx = W[k + 1];
  if (!nx) return null;
  const e = nx.first, entry = ds[e].open, stop = side > 0 ? W[k].low - P.buf : W[k].high + P.buf, risk = (entry - stop) * side;
  if (!(risk > 0)) return null; // opened beyond the stop: no trade (counted)
  const end = e + hold - 1;
  if (end >= ds.length) return null; // the hold is not complete on file
  let exit = null, why = 'time', xt = null, xi = null;
  for (let j = e; j <= end; j++) {
    const b = ds[j];
    if (j > e && (side > 0 ? b.open <= stop : b.open >= stop)) { exit = b.open; why = 'gap'; xt = b.time; xi = j; break; }
    if (side > 0 ? b.low <= stop : b.high >= stop) { exit = stop; why = 'stop'; xt = b.time + D / 2; xi = j; break; }
  }
  if (exit == null) { xi = end; exit = ds[xi].close; xt = ds[xi].time + D; }
  const R = (exit - entry) / risk * side, costR = P.cost * costMult / risk;
  const nn = side > 0 ? nights(ds[e].time, xt) : 0, finR = costMult * nn * FIN.xau.long * entry / risk;
  return { m: ymd(ds[e].time).slice(0, 7), day: ymd(ds[e].time), k, e, xi, side, entry, stop, risk, exit, why, R, costR, nights: nn, finR, net: R - costR - finR };
}

// signals [k, side] in order, then one position at a time (an entry must come after the open trade's exit day)
export function signalsOf(W, fn) { const out = []; for (let k = 1; k + 1 < W.length; k++) { const s = fn(W, k); if (s) out.push([k, s]); } return out; }
export function run(ds, W, sigs, hold, costMult = 1, sideOf = (s) => s) {
  const T = []; let busy = -1;
  for (const [k, s] of sigs) {
    if (W[k + 1].first <= busy) continue;
    const t = trade(ds, W, k, sideOf(s, k), hold, costMult);
    if (!t) continue;
    T.push(t); busy = t.xi;
  }
  return T;
}

const Phi = (x) => { const t = 1 / (1 + 0.2316419 * Math.abs(x)), y = 0.3989423 * Math.exp(-x * x / 2) * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x >= 0 ? 1 - y : y; };
const mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const sdv = (xs) => { const m = mean(xs); return xs.length > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)) : 0; };
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };

// every calendar month from..to (YYYY-MM), 0 when nothing was entered
export function monthSums(T, from, to, key = 'net') {
  const m = {};
  for (let y = +from.slice(0, 4), mo = +from.slice(5, 7); `${y}-${String(mo).padStart(2, '0')}` <= to; mo === 12 ? (y++, mo = 1) : mo++) m[`${y}-${String(mo).padStart(2, '0')}`] = 0;
  for (const x of T) if (x.m in m) m[x.m] += x[key];
  return Object.values(m);
}
export function monthT(T, from, to, key = 'net') { const xs = monthSums(T, from, to, key), s = sdv(xs); return s > 0 ? mean(xs) / (s / Math.sqrt(xs.length)) : 0; }
export function stats(T, from, to, key = 'net') {
  const n = T.length, xs = T.map((x) => x[key]), t = monthT(T, from, to, key);
  return { n, mean: r3(mean(xs)), total: +xs.reduce((a, b) => a + b, 0).toFixed(2), monthT: +t.toFixed(2), p: +(1 - Phi(t)).toFixed(4), win: n ? +(xs.filter((v) => v > 0).length / n).toFixed(3) : 0 };
}
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = new Array(ps.length); let m = 0;
  o.forEach(([p, i], k) => { m = Math.max(m, Math.min(1, p * (ps.length - k))); adj[i] = m; });
  return adj;
}
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const welch = (a, b) => { if (a.length < 2 || b.length < 2) return 0; const va = sdv(a) ** 2 / a.length, vb = sdv(b) ** 2 / b.length; return va + vb > 0 ? (mean(a) - mean(b)) / Math.sqrt(va + vb) : 0; };

const inW = (from, to) => (x) => x.m >= from && x.m <= to;

export function analyse(rows) {
  const ds = toDays(rows), W = weeks(ds).slice(0, -1); // the file's last week may be forming
  const IS = inW(P.isFrom, P.isTo), OOS = inW(P.oosFrom, P.oosTo), H1 = inW(P.oosFrom, P.h1To), H2 = inW(P.h2From, P.oosTo);
  const sig = signalsOf(W, outsideSignal), bsig = signalsOf(W, baseSignal);
  const out = { data: { from: ymd(ds[0].time), to: ymd(ds.at(-1).time), days: ds.length, weeks: W.length, lastWeek: ymd(W.at(-1).mon), outsideStrong: sig.length, outsideBuys: sig.filter(([, s]) => s > 0).length }, tests: {} };
  const base = run(ds, W, bsig, 10), bi = base.filter(IS), bo = base.filter(OOS);
  out.baseline = { name: 'every 4+-day week with a strong close (no outside condition), 10 days, both sides', is: stats(bi, P.isFrom, P.isTo), oos: stats(bo, P.oosFrom, P.oosTo), oosGross: stats(bo, P.oosFrom, P.oosTo, 'R'), isBuys: r3(mean(bi.filter((x) => x.side > 0).map((x) => x.net))), isSells: r3(mean(bi.filter((x) => x.side < 0).map((x) => x.net))), oosBuys: r3(mean(bo.filter((x) => x.side > 0).map((x) => x.net))), oosSells: r3(mean(bo.filter((x) => x.side < 0).map((x) => x.net))), oosN: { buys: bo.filter((x) => x.side > 0).length, sells: bo.filter((x) => x.side < 0).length } };
  for (const tst of TESTS) {
    const T = run(ds, W, sig, tst.hold), T2 = run(ds, W, sig, tst.hold, 2), o = T.filter(OOS), i = T.filter(IS), years = {};
    for (const x of T) { const y = x.m.slice(0, 4); (years[y] = years[y] || { n: 0, net: 0 }); years[y].n++; years[y].net = +(years[y].net + x.net).toFixed(2); }
    const gross = o.reduce((s, x) => s + x.R, 0), cost = o.reduce((s, x) => s + x.costR + x.finR, 0);
    const r = {
      name: tst.name, hold: tst.hold, trades: T.length, buys: T.filter((x) => x.side > 0).length,
      is: stats(i, P.isFrom, P.isTo), isGross: stats(i, P.isFrom, P.isTo, 'R'),
      oos: stats(o, P.oosFrom, P.oosTo), oosGross: stats(o, P.oosFrom, P.oosTo, 'R'),
      oos2x: stats(T2.filter(OOS), P.oosFrom, P.oosTo),
      half1: stats(T.filter(H1), P.oosFrom, P.h1To), half2: stats(T.filter(H2), P.h2From, P.oosTo),
      sides: { isBuys: r3(mean(i.filter((x) => x.side > 0).map((x) => x.net))), isSells: r3(mean(i.filter((x) => x.side < 0).map((x) => x.net))), oosBuys: r3(mean(o.filter((x) => x.side > 0).map((x) => x.net))), oosSells: r3(mean(o.filter((x) => x.side < 0).map((x) => x.net))), oosN: { buys: o.filter((x) => x.side > 0).length, sells: o.filter((x) => x.side < 0).length } },
      costs: { costR: r3(o.reduce((s, x) => s + x.costR, 0)), finR: r3(o.reduce((s, x) => s + x.finR, 0)), grossR: r3(gross), shareOfAbsGross: Math.abs(gross) > 0 ? r3(cost / Math.abs(gross)) : null, perTrade: r3(o.length ? cost / o.length : 0) },
      stopUsd: { is: +median(i.map((x) => x.risk)).toFixed(2), oos: +median(o.map((x) => x.risk)).toFixed(2) },
      exits: Object.fromEntries(['stop', 'gap', 'time'].map((w) => [w, o.filter((x) => x.why === w).length])),
      trades_oos: o.map((x) => [x.day, x.side, r3(x.R), r3(x.net), x.why]),
      years,
    };
    if (tst.id === 'T1') {
      const pl = [], m0 = mean(o.map((x) => x.net)), sigO = sig.filter(([k]) => OOS({ m: ymd(ds[W[k + 1].first].time).slice(0, 7) }));
      for (let s = 1; s <= P.seeds; s++) {
        const rnd = mulberry32(s);
        const Tp = run(ds, W, sigO, tst.hold, 1, () => (rnd() < 0.5 ? 1 : -1));
        pl.push(r3(mean(Tp.map((x) => x.net))));
      }
      r.placebo = { seeds: `1..${P.seeds}`, draws: pl, beaten: pl.filter((v) => m0 > v).length, median: r3(median(pl)), max: Math.max(...pl) };
      r.vsBaseline = {
        is: { t1: r.is.mean, base: out.baseline.is.mean, welchT: +welch(i.map((x) => x.net), bi.map((x) => x.net)).toFixed(2) },
        oos: { t1: r.oos.mean, base: out.baseline.oos.mean, welchT: +welch(o.map((x) => x.net), bo.map((x) => x.net)).toFixed(2) },
        oosBuys: { t1: r.sides.oosBuys, base: out.baseline.oosBuys, welchT: +welch(o.filter((x) => x.side > 0).map((x) => x.net), bo.filter((x) => x.side > 0).map((x) => x.net)).toFixed(2) },
        oosSells: { t1: r.sides.oosSells, base: out.baseline.oosSells, welchT: +welch(o.filter((x) => x.side < 0).map((x) => x.net), bo.filter((x) => x.side < 0).map((x) => x.net)).toFixed(2) },
      };
    }
    out.tests[tst.id] = r;
  }
  const ids = TESTS.map((t) => t.id), adj = holm(ids.map((id) => out.tests[id].oos.p));
  out.checks = {};
  ids.forEach((id, k) => {
    const r = out.tests[id];
    const c = { oosPositive: r.oos.mean > 0, holmP: +adj[k].toFixed(4), tHolm: r.oos.monthT >= 2 && adj[k] <= 0.0228, isSameSign: r.is.mean > 0, halves: r.half1.mean > 0 && r.half2.mean > 0, cost2x: r.oos2x.mean > 0 };
    if (r.placebo) c.placebo = r.placebo.beaten >= P.needBeat;
    c.pass = c.oosPositive && c.tHolm && c.isSameSign && c.halves && c.cost2x && c.placebo !== false;
    out.checks[id] = c;
  });
  out.verdict = out.checks.T1.pass ? 'PASS' : 'FAIL';
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'xau.json'), execFileSync('git', ['show', 'origin/council-data:research/daily/xau.json'], { maxBuffer: 1 << 28 }));
  } else if (cmd === 'full') {
    const xau = JSON.parse(fs.readFileSync(path.join(dir, 'xau.json'), 'utf8'));
    const g = analyse(xau.rows);
    const out = { built: '2026-11-14', verdict: g.verdict, params: P, tests: TESTS, costs: '$0.60 a round trip + FIN.xau.long financing on buys (council/fills.mjs); 2x = both doubled', src: `OANDA daily XAU_USD via council-data research/daily/xau.json (updated ${xau.updated})`, gold: g };
    fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
    const brief = {};
    for (const [id, r] of Object.entries(g.tests)) brief[id] = { n: r.trades, buys: r.buys, is: r.is, isG: r.isGross, oos: r.oos, oosG: r.oosGross, x2: r.oos2x.mean, h1: r.half1.mean, h2: r.half2.mean, sides: r.sides, pl: r.placebo && { beaten: r.placebo.beaten, median: r.placebo.median, max: r.placebo.max }, vs: r.vsBaseline, exits: r.exits, costs: r.costs, stop: r.stopUsd };
    console.log(JSON.stringify({ data: g.data, baseline: g.baseline, brief, checks: g.checks, verdict: g.verdict }, null, 1));
  } else console.log('usage: run.mjs fetch|full <dir>');
}
