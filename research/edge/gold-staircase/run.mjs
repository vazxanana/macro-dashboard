// After a staircase of daily candles (higher highs AND higher lows in a row), does gold continue or turn? (PREREGISTRATION.md, pushed first)
//   node research/edge/gold-staircase/run.mjs fetch <dir>   copies xau.json from origin/council-data (git show, no network)
//   node research/edge/gold-staircase/run.mjs full <dir>    runs the three tests, writes result.json
// A new stand-alone daily rule judged on 2017-26; not a gate, exit, entry or size of the gold book (item 44).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

export const P = { atrN: 14, stopAtr: 1.5, cost: 0.60, isFrom: '2007-01-01', isTo: '2016-12-31', oosFrom: '2017-01-01', oosTo: '2026-10-31', half: '2022-01-01', seeds: 40, needBeat: 38 };
export const TESTS = [
  { id: 'T1', name: 'buy after 3+ up steps (continuation), hold 3 days', dir: 1, k: 3, side: 1, hold: 3 },
  { id: 'T2', name: 'sell after 3+ down steps (continuation), hold 3 days', dir: -1, k: 3, side: -1, hold: 3 },
  { id: 'T3', name: 'buy after 3+ down steps (turn), hold 3 days', dir: -1, k: 3, side: 1, hold: 3 },
];
const D = 86400;
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const r3 = (v) => +v.toFixed(3);

// rows [t, o, h, l, c, v] -> trading days (weekend candles folded into the next weekday)
export const toDays = (rows) => foldWeekend(rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })));

// step at day i: +1 = higher high AND higher low than day i-1, -1 = lower high AND lower low, 0 otherwise
export const step = (ds, i) => (ds[i].high > ds[i - 1].high && ds[i].low > ds[i - 1].low ? 1 : ds[i].high < ds[i - 1].high && ds[i].low < ds[i - 1].low ? -1 : 0);
// signed staircase at day i: +n = n up steps in a row ending at i, -n down steps; 0 on any other day
export function stairs(ds) {
  const s = new Array(ds.length).fill(0);
  for (let i = 1; i < ds.length; i++) {
    const d = step(ds, i);
    s[i] = d === 0 ? 0 : (Math.sign(s[i - 1]) === d ? s[i - 1] + d : d);
  }
  return s;
}

// ATR(n) at day i = mean true range of days i-n+1 .. i (all closed at the signal); null without enough history
export function atrAt(ds, i, n = P.atrN) {
  if (i < n) return null;
  let s = 0;
  for (let j = i - n + 1; j <= i; j++) s += Math.max(ds[j].high, ds[j - 1].close) - Math.min(ds[j].low, ds[j - 1].close);
  return s / n;
}

// one trade from signal day i: entry at the open of i+1, stop 1.5 x ATR, out at the close of day i+hold or the stop
export function trade(ds, i, side, hold, costMult = 1) {
  const e = i + 1, atr = atrAt(ds, i);
  if (!atr || e + hold - 1 >= ds.length) return null;
  const entry = ds[e].open, risk = P.stopAtr * atr, stop = entry - side * risk;
  let exit = null, xi = null, why = 'time', xt = null;
  for (let j = e; j <= e + hold - 1; j++) {
    const b = ds[j];
    if (j > e && (side > 0 ? b.open <= stop : b.open >= stop)) { exit = b.open; xi = j; why = 'gap'; xt = b.time; break; }
    if (side > 0 ? b.low <= stop : b.high >= stop) { exit = stop; xi = j; why = 'stop'; xt = b.time + D / 2; break; }
  }
  if (exit == null) { xi = e + hold - 1; exit = ds[xi].close; xt = ds[xi].time + D; }
  const R = (exit - entry) / risk * side, costR = P.cost * costMult / risk;
  const nn = side > 0 ? nights(ds[e].time, xt) : 0, finR = costMult * nn * FIN.xau.long * entry / risk;
  return { d: ymd(ds[e].time), si: i, ei: e, xi, side, entry, stop, exit, why, R, costR, nights: nn, finR, net: R - costR - finR };
}

// signal days of a test (staircase at day i in the test's direction of at least k)
export function signals(ds, test) {
  const s = stairs(ds), out = [];
  for (let i = 1; i < ds.length; i++) if (s[i] * test.dir >= test.k) out.push(i);
  return out;
}

// a rule over signal days, one position at a time; sideOf(i, n) picks the side (the placebo draws it)
export function run(ds, days, hold, sideOf, costMult = 1) {
  const T = []; let busy = -1;
  for (const i of days) {
    if (i + 1 <= busy) continue;
    const tr = trade(ds, i, sideOf(i, T.length), hold, costMult);
    if (!tr) continue;
    T.push(tr); busy = tr.xi;
  }
  return T;
}

const Phi = (x) => { const t = 1 / (1 + 0.2316419 * Math.abs(x)), y = 0.3989423 * Math.exp(-x * x / 2) * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x >= 0 ? 1 - y : y; };
const mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const sdv = (xs) => { const m = mean(xs); return xs.length > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)) : 0; };

// every calendar month from..to (YYYY-MM), 0 when nothing closed
export function monthSums(T, from, to, key = 'net') {
  const m = {};
  for (let y = +from.slice(0, 4), mo = +from.slice(5, 7); `${y}-${String(mo).padStart(2, '0')}` <= to.slice(0, 7); mo === 12 ? (y++, mo = 1) : mo++) m[`${y}-${String(mo).padStart(2, '0')}`] = 0;
  for (const x of T) { const k = x.d.slice(0, 7); if (k in m) m[k] += x[key]; }
  return Object.values(m);
}
export function monthT(T, from, to, key = 'net') {
  const xs = monthSums(T, from, to, key), s = sdv(xs);
  return s > 0 ? mean(xs) / (s / Math.sqrt(xs.length)) : 0;
}
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
const welch = (a, b) => { const va = sdv(a) ** 2 / a.length, vb = sdv(b) ** 2 / b.length; return va + vb > 0 ? (mean(a) - mean(b)) / Math.sqrt(va + vb) : 0; };

const inW = (from, to) => (x) => x.d >= from && x.d <= to;

export function analyse(rows) {
  const ds = toDays(rows), IS = inW(P.isFrom, P.isTo), OOS = inW(P.oosFrom, P.oosTo);
  const H1 = inW(P.oosFrom, '2021-12-31'), H2 = inW(P.half, P.oosTo);
  const all = ds.map((_, i) => i).filter((i) => atrAt(ds, i) != null);
  const oosDays = all.filter((i) => i + 1 < ds.length && ymd(ds[i + 1].time) >= P.oosFrom && ymd(ds[i + 1].time) <= P.oosTo);
  const out = { data: { from: ymd(ds[0].time), to: ymd(ds.at(-1).time), days: ds.length }, baseline: {}, tests: {} };
  for (const tst of TESTS) {
    const bkey = `${tst.side > 0 ? 'buy' : 'sell'}${tst.hold}`;
    if (!out.baseline[bkey]) {
      const b = run(ds, all, tst.hold, () => tst.side);
      out.baseline[bkey] = { is: stats(b.filter(IS), P.isFrom, P.isTo), oos: stats(b.filter(OOS), P.oosFrom, P.oosTo), oosGross: stats(b.filter(OOS), P.oosFrom, P.oosTo, 'R'), _oos: b.filter(OOS).map((x) => x.net) };
    }
    const baseOos = out.baseline[bkey]._oos;
    const days = signals(ds, tst), T = run(ds, days, tst.hold, () => tst.side), T2 = run(ds, days, tst.hold, () => tst.side, 2);
    const o = T.filter(OOS), years = {};
    for (const x of T) { const y = x.d.slice(0, 4); (years[y] = years[y] || { n: 0, net: 0 }); years[y].n++; years[y].net = +(years[y].net + x.net).toFixed(2); }
    // placebo: as many OOS entry days as the test had, drawn at random from the eligible OOS days, same side / stop / hold
    const pl = [];
    for (let s = 1; s <= P.seeds; s++) {
      const rnd = mulberry32(s), pick = new Set();
      while (pick.size < Math.min(o.length, oosDays.length)) pick.add(oosDays[Math.floor(rnd() * oosDays.length)]);
      const P_ = run(ds, [...pick].sort((a, b) => a - b), tst.hold, () => tst.side);
      pl.push(r3(mean(P_.map((x) => x.net))));
    }
    out.tests[tst.id] = {
      name: tst.name, signals: days.length,
      is: stats(T.filter(IS), P.isFrom, P.isTo), isGross: stats(T.filter(IS), P.isFrom, P.isTo, 'R'),
      oos: stats(o, P.oosFrom, P.oosTo), oosGross: stats(o, P.oosFrom, P.oosTo, 'R'),
      oos2x: stats(T2.filter(OOS), P.oosFrom, P.oosTo),
      half1: stats(T.filter(H1), P.oosFrom, '2021-12-31'), half2: stats(T.filter(H2), P.half, P.oosTo),
      vsBaseline: { diff: r3(mean(o.map((x) => x.net)) - mean(baseOos)), welchT: +welch(o.map((x) => x.net), baseOos).toFixed(2) },
      costs: { costR: r3(o.reduce((s, x) => s + x.costR, 0)), finR: r3(o.reduce((s, x) => s + x.finR, 0)) },
      exits: Object.fromEntries(['stop', 'gap', 'time'].map((w) => [w, o.filter((x) => x.why === w).length])),
      placebo: { draws: pl, beaten: pl.filter((v) => mean(o.map((x) => x.net)) > v).length, median: [...pl].sort((a, b) => a - b)[P.seeds / 2], max: Math.max(...pl) },
      years,
    };
  }
  const ids = TESTS.map((t) => t.id), adj = holm(ids.map((id) => out.tests[id].oos.p));
  out.checks = {};
  ids.forEach((id, k) => {
    const r = out.tests[id];
    const c = { oosPositive: r.oos.mean > 0, holmP: +adj[k].toFixed(4), tHolm: r.oos.monthT >= 2 && adj[k] <= 0.0228, bothHalvesAndIs: r.is.mean > 0 && r.half1.mean > 0 && r.half2.mean > 0, cost2x: r.oos2x.mean > 0, excess: r.vsBaseline.diff > 0 && r.vsBaseline.welchT >= 2, placebo: r.placebo.beaten >= P.needBeat };
    c.pass = c.oosPositive && c.tHolm && c.bothHalvesAndIs && c.cost2x && c.excess && c.placebo;
    out.checks[id] = c;
  });
  for (const b of Object.values(out.baseline)) delete b._oos;
  out.passed = ids.filter((id) => out.checks[id].pass);
  out.verdict = out.passed.length ? 'PASS' : 'FAIL';
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'xau.json'), execFileSync('git', ['show', 'origin/council-data:research/daily/xau.json'], { maxBuffer: 1 << 28 }));
  } else if (cmd === 'full') {
    const xau = JSON.parse(fs.readFileSync(path.join(dir, 'xau.json'), 'utf8'));
    const out = { built: '2026-11-14', params: P, tests: TESTS, costs: '$0.60 a round trip + FIN.xau.long financing on buys (council/fills.mjs); 2x = both doubled', src: `OANDA daily XAU_USD via council-data research/daily/xau.json (updated ${xau.updated})`, gold: analyse(xau.rows) };
    out.verdict = out.gold.verdict;
    fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
    const g = out.gold, brief = {};
    for (const [id, r] of Object.entries(g.tests)) brief[id] = { is: r.is, isG: r.isGross, oos: r.oos, oosG: r.oosGross, x2: r.oos2x.mean, h1: r.half1.mean, h2: r.half2.mean, vsB: r.vsBaseline, pl: { beaten: r.placebo.beaten, median: r.placebo.median, max: r.placebo.max }, exits: r.exits, costs: r.costs };
    console.log(JSON.stringify({ data: g.data, baseline: g.baseline, brief, checks: g.checks, verdict: out.verdict }, null, 1));
  } else console.log('usage: run.mjs fetch|full <dir>');
}
