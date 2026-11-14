// Gold's outside (engulfing) month, held through the next month (PREREGISTRATION.md, pushed first)
//   node research/edge/gold-month-engulf/run.mjs fetch <dir>   copies xau.json from origin/council-data (git show, no network)
//   node research/edge/gold-month-engulf/run.mjs full <dir>    runs the three tests, writes result.json
// A new stand-alone monthly rule judged on 2017-26; not a gate, exit, entry or size of the gold book (item 44).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

export const P = { atrN: 20, stopAtr: 3, cost: 0.60, isFrom: '2007-01', isTo: '2016-12', oosFrom: '2017-01', oosTo: '2026-10', h1To: '2021-12', h2From: '2022-01', seeds: 40, needBeat: 38 };
export const TESTS = [
  { id: 'T1', name: 'outside month, follow both sides (primary)' },
  { id: 'T2', name: 'bullish outside month buys, excess over buying every month' },
  { id: 'T3', name: 'body-engulfing month, follow both sides' },
];
const D = 86400;
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const r3 = (v) => +v.toFixed(3);

export const toDays = (rows) => foldWeekend(rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })));

// trading days -> calendar months { key, first, last (day indexes), open, high, low, close }; the last month on file is
// complete only when a later day exists, so it is dropped (the file's last month may still be forming)
export function months(ds) {
  const M = [];
  ds.forEach((d, i) => {
    const key = ymd(d.time).slice(0, 7), m = M.at(-1);
    if (!m || m.key !== key) M.push({ key, first: i, last: i, open: d.open, high: d.high, low: d.low, close: d.close });
    else { m.last = i; m.high = Math.max(m.high, d.high); m.low = Math.min(m.low, d.low); m.close = d.close; }
  });
  return M;
}

// +1 bullish / -1 bearish outside month at index k (needs k-1), else 0
export function outside(M, k) {
  if (k < 1) return 0;
  const a = M[k], b = M[k - 1];
  if (!(a.high > b.high && a.low < b.low)) return 0;
  return Math.sign(a.close - a.open);
}
// +1 / -1 body-engulfing month: previous body the opposite colour, this body covers it (and is not the same body)
export function bodyEngulf(M, k) {
  if (k < 1) return 0;
  const a = M[k], b = M[k - 1], sa = Math.sign(a.close - a.open), sb = Math.sign(b.close - b.open);
  if (!sa || !sb || sa === sb) return 0;
  const aHi = Math.max(a.open, a.close), aLo = Math.min(a.open, a.close), bHi = Math.max(b.open, b.close), bLo = Math.min(b.open, b.close);
  if (aHi >= bHi && aLo <= bLo && (aHi > bHi || aLo < bLo)) return sa;
  return 0;
}

export function atrAt(ds, i, n = P.atrN) {
  if (i < n) return null;
  let s = 0;
  for (let j = i - n + 1; j <= i; j++) s += Math.max(ds[j].high, ds[j - 1].close) - Math.min(ds[j].low, ds[j - 1].close);
  return s / n;
}

// trade of month M[k+1] decided at the end of M[k]: entry at its first open, 3 x ATR(20) stop, exit at its last close
export function trade(ds, M, k, side, costMult = 1) {
  const nx = M[k + 1];
  if (!nx) return null;
  const atr = atrAt(ds, M[k].last);
  if (!atr) return null;
  const e = nx.first, entry = ds[e].open, risk = P.stopAtr * atr, stop = entry - side * risk;
  let exit = null, why = 'time', xt = null, xi = null;
  for (let j = e; j <= nx.last; j++) {
    const b = ds[j];
    if (j > e && (side > 0 ? b.open <= stop : b.open >= stop)) { exit = b.open; why = 'gap'; xt = b.time; xi = j; break; }
    if (side > 0 ? b.low <= stop : b.high >= stop) { exit = stop; why = 'stop'; xt = b.time + D / 2; xi = j; break; }
  }
  if (exit == null) { xi = nx.last; exit = ds[xi].close; xt = ds[xi].time + D; }
  const R = (exit - entry) / risk * side, costR = P.cost * costMult / risk;
  const nn = side > 0 ? nights(ds[e].time, xt) : 0, finR = costMult * nn * FIN.xau.long * entry / risk;
  return { m: nx.key, k, side, entry, stop, risk, exit, why, R, costR, nights: nn, finR, net: R - costR - finR };
}

// every month index whose signal fires (the signal month must have a complete following month on file)
export function signalsOf(M, fn) { const out = []; for (let k = 1; k + 1 < M.length; k++) { const s = fn(M, k); if (s) out.push([k, s]); } return out; }

const Phi = (x) => { const t = 1 / (1 + 0.2316419 * Math.abs(x)), y = 0.3989423 * Math.exp(-x * x / 2) * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x >= 0 ? 1 - y : y; };
const mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const sdv = (xs) => { const m = mean(xs); return xs.length > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)) : 0; };
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };

// every calendar month from..to (YYYY-MM), 0 when nothing was held
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

const inW = (from, to) => (x) => x.m >= from && x.m <= to;

export function analyse(rows) {
  const ds = toDays(rows), M = months(ds).slice(0, -1); // the file's last month may be incomplete
  const IS = inW(P.isFrom, P.isTo), OOS = inW(P.oosFrom, P.oosTo), H1 = inW(P.oosFrom, P.h1To), H2 = inW(P.h2From, P.oosTo);
  const mk = (sigs, mult = 1, sideOf = (s) => s) => sigs.map(([k, s]) => trade(ds, M, k, sideOf(s), mult)).filter(Boolean);
  const all = []; for (let k = 0; k + 1 < M.length; k++) all.push([k, 1]);
  const base = mk(all), base2 = mk(all, 2), baseBy = new Map(base.map((x) => [x.m, x])), base2By = new Map(base2.map((x) => [x.m, x]));
  const out = { data: { from: ymd(ds[0].time), to: ymd(ds.at(-1).time), days: ds.length, months: M.length, lastMonth: M.at(-1).key }, baseline: { is: stats(base.filter(IS), P.isFrom, P.isTo), oos: stats(base.filter(OOS), P.oosFrom, P.oosTo), oosGross: stats(base.filter(OOS), P.oosFrom, P.oosTo, 'R') }, tests: {} };
  const sigOut = signalsOf(M, outside), sigBody = signalsOf(M, bodyEngulf);
  const excess = (T, by) => T.map((x) => ({ ...x, R: x.R - by.get(x.m).R, net: x.net - by.get(x.m).net }));
  const build = {
    T1: (mult) => mk(sigOut, mult),
    T2: (mult) => excess(mk(sigOut.filter(([, s]) => s > 0), mult), mult === 2 ? base2By : baseBy),
    T3: (mult) => mk(sigBody, mult),
  };
  for (const tst of TESTS) {
    const T = build[tst.id](1), T2 = build[tst.id](2), o = T.filter(OOS), years = {};
    for (const x of T) { const y = x.m.slice(0, 4); (years[y] = years[y] || { n: 0, net: 0 }); years[y].n++; years[y].net = +(years[y].net + x.net).toFixed(2); }
    const r = {
      name: tst.name, signals: T.length, buys: T.filter((x) => x.side > 0).length,
      is: stats(T.filter(IS), P.isFrom, P.isTo), isGross: stats(T.filter(IS), P.isFrom, P.isTo, 'R'),
      oos: stats(o, P.oosFrom, P.oosTo), oosGross: stats(o, P.oosFrom, P.oosTo, 'R'),
      oos2x: stats(T2.filter(OOS), P.oosFrom, P.oosTo),
      half1: stats(T.filter(H1), P.oosFrom, P.h1To), half2: stats(T.filter(H2), P.h2From, P.oosTo),
      costs: { costR: r3(o.reduce((s, x) => s + x.costR, 0)), finR: r3(o.reduce((s, x) => s + x.finR, 0)), costRPerTrade: r3(mean(o.map((x) => x.costR))), finRPerTrade: r3(mean(o.map((x) => x.finR))) },
      stopUsd: { is: +median(T.filter(IS).map((x) => x.risk)).toFixed(2), oos: +median(o.map((x) => x.risk)).toFixed(2) },
      exits: Object.fromEntries(['stop', 'gap', 'time'].map((w) => [w, o.filter((x) => x.why === w).length])),
      trades: o.map((x) => [x.m, x.side, r3(x.R), r3(x.net), x.why]),
      years,
    };
    if (tst.id === 'T1') {
      const pl = [];
      for (let s = 1; s <= P.seeds; s++) {
        const rnd = mulberry32(s);
        const Tp = sigOut.filter(([k]) => OOS({ m: M[k + 1].key })).map(([k]) => trade(ds, M, k, rnd() < 0.5 ? 1 : -1)).filter(Boolean);
        pl.push(r3(mean(Tp.map((x) => x.net))));
      }
      r.placebo = { draws: pl, beaten: pl.filter((v) => mean(o.map((x) => x.net)) > v).length, median: r3(median(pl)), max: Math.max(...pl) };
    }
    out.tests[tst.id] = r;
  }
  const ids = TESTS.map((t) => t.id), adj = holm(ids.map((id) => out.tests[id].oos.p));
  out.checks = {};
  ids.forEach((id, k) => {
    const r = out.tests[id];
    const c = { oosPositive: r.oos.mean > 0, holmP: +adj[k].toFixed(4), tHolm: r.oos.monthT >= 2 && adj[k] <= 0.0228, isAndHalves: r.is.mean > 0 && r.half1.mean > 0 && r.half2.mean > 0, cost2x: r.oos2x.mean > 0 };
    if (r.placebo) c.placebo = r.placebo.beaten >= P.needBeat;
    c.pass = c.oosPositive && c.tHolm && c.isAndHalves && c.cost2x && c.placebo !== false;
    out.checks[id] = c;
  });
  // T2 as pre-registered is identically 0: a signal month's buy IS the baseline's buy of that month (same entry, stop, exit).
  // Reported as written; the comparison it was meant to make (signal-month buys against ALL months' buys) is added as a
  // post-hoc description, outside the pass bar and the Holm family.
  const buysOos = mk(sigOut.filter(([, s]) => s > 0)).filter(OOS), buysIs = mk(sigOut.filter(([, s]) => s > 0)).filter(IS);
  const bo = base.filter(OOS), bi = base.filter(IS);
  const welch = (a, b) => { const va = sdv(a) ** 2 / a.length, vb = sdv(b) ** 2 / b.length; return va + vb > 0 ? (mean(a) - mean(b)) / Math.sqrt(va + vb) : 0; };
  out.t2PostHoc = {
    why: 'T2 as written subtracts the same trade from itself (0 in every month); this compares signal-month buys with the mean of every month\'s buy',
    is: { n: buysIs.length, buys: r3(mean(buysIs.map((x) => x.net))), base: r3(mean(bi.map((x) => x.net))), welchT: +welch(buysIs.map((x) => x.net), bi.map((x) => x.net)).toFixed(2) },
    oos: { n: buysOos.length, buys: r3(mean(buysOos.map((x) => x.net))), base: r3(mean(bo.map((x) => x.net))), welchT: +welch(buysOos.map((x) => x.net), bo.map((x) => x.net)).toFixed(2) },
  };
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
    for (const [id, r] of Object.entries(g.tests)) brief[id] = { n: r.signals, buys: r.buys, is: r.is, isG: r.isGross, oos: r.oos, oosG: r.oosGross, x2: r.oos2x.mean, h1: r.half1.mean, h2: r.half2.mean, pl: r.placebo && { beaten: r.placebo.beaten, median: r.placebo.median, max: r.placebo.max }, exits: r.exits, costs: r.costs, stop: r.stopUsd };
    console.log(JSON.stringify({ data: g.data, baseline: g.baseline, t2PostHoc: g.t2PostHoc, brief, checks: g.checks, verdict: g.verdict }, null, 1));
  } else console.log('usage: run.mjs fetch|full <dir>');
}
