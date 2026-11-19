// Gold's daily close outside its Bollinger band (20, 2): fade or follow? (PREREGISTRATION.md, pushed first)
//   node research/edge/gold-daily-bollinger/run.mjs fetch <dir>   copies xau.json from origin/council-data (git show, no network)
//   node research/edge/gold-daily-bollinger/run.mjs full <dir>    runs the three tests, writes result.json
// A new stand-alone daily rule judged on 2017-26; not a gate, exit, entry or size of the gold book (item 44).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

export const P = { bbN: 20, bbK: 2, atrN: 14, stopAtr: 1.5, maxHold: 10, cost: 0.60, isFrom: '2007-01-01', isTo: '2016-12-31', oosFrom: '2017-01-01', oosTo: '2026-10-31', half: '2022-01-01', seeds: 40, needBeat: 38 };
// sig: -1 close below the lower band, +1 above the upper; side: trade side; tgt: exit once side * (mid - close) <= 0 (fade) or the close is back through the middle (follow)
export const TESTS = [
  { id: 'T1', name: 'fade the low: buy after a close below the lower band', sig: -1, side: 1, exit: 'aboveMid' },
  { id: 'T2', name: 'fade the high: sell after a close above the upper band', sig: 1, side: -1, exit: 'belowMid' },
  { id: 'T3', name: 'follow the high: buy after a close above the upper band', sig: 1, side: 1, exit: 'belowMid' },
];
const D = 86400;
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const r3 = (v) => +v.toFixed(3);

export const toDays = (rows) => foldWeekend(rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })));

// band at day i from the closes of days i-n+1 .. i (population sd); null without enough history
export function bandAt(ds, i, n = P.bbN, k = P.bbK) {
  if (i < n - 1) return null;
  let s = 0;
  for (let j = i - n + 1; j <= i; j++) s += ds[j].close;
  const mid = s / n;
  let v = 0;
  for (let j = i - n + 1; j <= i; j++) v += (ds[j].close - mid) ** 2;
  const sd = Math.sqrt(v / n);
  return { mid, up: mid + k * sd, lo: mid - k * sd, sd };
}

export function atrAt(ds, i, n = P.atrN) {
  if (i < n) return null;
  let s = 0;
  for (let j = i - n + 1; j <= i; j++) s += Math.max(ds[j].high, ds[j - 1].close) - Math.min(ds[j].low, ds[j - 1].close);
  return s / n;
}

// signal of day i: +1 close above the upper band, -1 below the lower, 0 otherwise
export function signalAt(ds, i) {
  const b = bandAt(ds, i);
  if (!b) return 0;
  return ds[i].close > b.up ? 1 : ds[i].close < b.lo ? -1 : 0;
}
export function signals(ds, test) {
  const out = [];
  for (let i = 1; i < ds.length; i++) if (signalAt(ds, i) === test.sig) out.push(i);
  return out;
}

// one trade from signal day i: entry at the open of i+1, stop 1.5 x ATR(14);
// exit: 'aboveMid' | 'belowMid' at the first close on that side of that day's middle band, else the close of day maxHold;
// a number = a fixed hold of that many days (the placebo). The stop wins on its day; a later open past it fills at the open.
export function trade(ds, i, side, exit, costMult = 1) {
  const e = i + 1, atr = atrAt(ds, i);
  if (!atr || e >= ds.length) return null;
  const hold = typeof exit === 'number' ? exit : P.maxHold;
  const last = e + hold - 1;
  if (last >= ds.length) return null;
  const entry = ds[e].open, risk = P.stopAtr * atr, stop = entry - side * risk;
  let px = null, xi = null, why = 'time', xt = null;
  for (let j = e; j <= last; j++) {
    const b = ds[j];
    if (j > e && (side > 0 ? b.open <= stop : b.open >= stop)) { px = b.open; xi = j; why = 'gap'; xt = b.time; break; }
    if (side > 0 ? b.low <= stop : b.high >= stop) { px = stop; xi = j; why = 'stop'; xt = b.time + D / 2; break; }
    if (typeof exit === 'string') {
      const m = bandAt(ds, j);
      if (m && (exit === 'aboveMid' ? b.close >= m.mid : b.close <= m.mid)) { px = b.close; xi = j; why = 'mid'; xt = b.time + D; break; }
    }
  }
  if (px == null) { xi = last; px = ds[xi].close; xt = ds[xi].time + D; }
  const R = (px - entry) / risk * side, costR = P.cost * costMult / risk;
  const nn = side > 0 ? nights(ds[e].time, xt) : 0, finR = costMult * nn * FIN.xau.long * entry / risk;
  return { d: ymd(ds[e].time), si: i, ei: e, xi, held: xi - e + 1, side, entry, stop, exit: px, why, R, costR, nights: nn, finR, net: R - costR - finR };
}

// one position at a time; sideOf(i) picks the side, exitOf(i) the exit
export function run(ds, days, sideOf, exitOf, costMult = 1) {
  const T = []; let busy = -1;
  for (const i of days) {
    if (i + 1 <= busy) continue;
    const tr = trade(ds, i, sideOf(i), exitOf(i), costMult);
    if (!tr) continue;
    T.push(tr); busy = tr.xi;
  }
  return T;
}

const Phi = (x) => { const t = 1 / (1 + 0.2316419 * Math.abs(x)), y = 0.3989423 * Math.exp(-x * x / 2) * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x >= 0 ? 1 - y : y; };
const mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const sdv = (xs) => { const m = mean(xs); return xs.length > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)) : 0; };

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
const inW = (from, to) => (x) => x.d >= from && x.d <= to;

export function analyse(rows) {
  const ds = toDays(rows), IS = inW(P.isFrom, P.isTo), OOS = inW(P.oosFrom, P.oosTo);
  const H1 = inW(P.oosFrom, '2021-12-31'), H2 = inW(P.half, P.oosTo);
  const base = run(ds, ds.map((_, i) => i), () => 1, () => 1), baseOos = base.filter(OOS);
  const out = { data: { from: ymd(ds[0].time), to: ymd(ds.at(-1).time), days: ds.length }, baseline: { is: stats(base.filter(IS), P.isFrom, P.isTo), oos: stats(baseOos, P.oosFrom, P.oosTo), oosGross: stats(baseOos, P.oosFrom, P.oosTo, 'R') }, tests: {} };
  for (const tst of TESTS) {
    const days = signals(ds, tst), T = run(ds, days, () => tst.side, () => tst.exit), T2 = run(ds, days, () => tst.side, () => tst.exit, 2);
    const o = T.filter(OOS), om = mean(o.map((x) => x.net)), years = {};
    for (const x of T) { const y = x.d.slice(0, 4); (years[y] = years[y] || { n: 0, net: 0 }); years[y].n++; years[y].net = +(years[y].net + x.net).toFixed(2); }
    // placebo: the same OOS entry days and days held, the same stop, the side drawn at random per trade
    const pl = [];
    for (let s = 1; s <= P.seeds; s++) {
      const rnd = mulberry32(s), held = new Map(o.map((x) => [x.si, x.held])), sides = new Map();
      const Q = run(ds, o.map((x) => x.si), (i) => { if (!sides.has(i)) sides.set(i, rnd() < 0.5 ? 1 : -1); return sides.get(i); }, (i) => held.get(i));
      pl.push(r3(mean(Q.map((x) => x.net))));
    }
    out.tests[tst.id] = {
      name: tst.name, signals: days.length,
      is: stats(T.filter(IS), P.isFrom, P.isTo), isGross: stats(T.filter(IS), P.isFrom, P.isTo, 'R'),
      oos: stats(o, P.oosFrom, P.oosTo), oosGross: stats(o, P.oosFrom, P.oosTo, 'R'),
      oos2x: stats(T2.filter(OOS), P.oosFrom, P.oosTo),
      half1: stats(T.filter(H1), P.oosFrom, '2021-12-31'), half2: stats(T.filter(H2), P.half, P.oosTo),
      heldMean: +mean(o.map((x) => x.held)).toFixed(2),
      costs: { costR: r3(o.reduce((s, x) => s + x.costR, 0)), finR: r3(o.reduce((s, x) => s + x.finR, 0)) },
      exits: Object.fromEntries(['mid', 'stop', 'gap', 'time'].map((w) => [w, o.filter((x) => x.why === w).length])),
      placebo: { draws: pl, beaten: pl.filter((v) => om > v).length, median: [...pl].sort((a, b) => a - b)[P.seeds / 2], max: Math.max(...pl) },
      years,
    };
  }
  const ids = TESTS.map((t) => t.id), adj = holm(ids.map((id) => out.tests[id].oos.p));
  out.checks = {};
  ids.forEach((id, k) => {
    const r = out.tests[id];
    const c = { oosPositive: r.oos.mean > 0, holmP: +adj[k].toFixed(4), tHolm: r.oos.monthT >= 2 && adj[k] <= 0.0228, isSameSign: r.is.mean > 0, cost2x: r.oos2x.mean > 0, placebo: r.placebo.beaten >= P.needBeat };
    c.pass = c.oosPositive && c.tHolm && c.isSameSign && c.cost2x && c.placebo;
    out.checks[id] = c;
  });
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
    for (const [id, r] of Object.entries(g.tests)) brief[id] = { sig: r.signals, is: r.is, isG: r.isGross, oos: r.oos, oosG: r.oosGross, x2: r.oos2x.mean, h1: r.half1.mean, h2: r.half2.mean, held: r.heldMean, pl: { beaten: r.placebo.beaten, median: r.placebo.median, max: r.placebo.max }, exits: r.exits, costs: r.costs };
    console.log(JSON.stringify({ data: g.data, baseline: g.baseline, brief, checks: g.checks, verdict: out.verdict }, null, 1));
  } else console.log('usage: run.mjs fetch|full <dir>');
}
