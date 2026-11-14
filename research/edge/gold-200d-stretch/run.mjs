// Gold stretched far from its 200-day average (z beyond +/-2): does it snap back? (PREREGISTRATION.md, pushed first)
//   node research/edge/gold-200d-stretch/run.mjs fetch <dir>   copies xau.json from origin/council-data (git show, no network)
//   node research/edge/gold-200d-stretch/run.mjs full <dir>    runs the three tests, writes result.json
// A new stand-alone daily rule judged on 2017-26; not a gate, exit, entry or size of the gold book (item 44).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

export const P = { maN: 200, zIn: 2, zOut: 1, atrN: 14, stopAtr: 2, maxHold: 20, cost: 0.60, minN: 20, isFrom: '2007-01-01', isTo: '2016-12-31', oosFrom: '2017-01-01', oosTo: '2026-10-31', half: '2022-01-01', seeds: 40, needBeat: 38 };
// sides: which stretches the test trades (-1 = buy the low stretch, +1 = sell the high stretch)
export const TESTS = [
  { id: 'T1', name: 'buy the low stretch: z < -2', sides: [-1] },
  { id: 'T2', name: 'sell the high stretch: z > +2', sides: [1] },
  { id: 'T3', name: 'both sides (primary): T1 and T2 as one stream', sides: [-1, 1] },
];
const D = 86400;
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const r3 = (v) => +v.toFixed(3);

export const toDays = (rows) => foldWeekend(rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })));

// z of day i from the closes of days i-n+1 .. i (population sd); null without enough history
export function zAt(ds, i, n = P.maN) {
  if (i < n - 1) return null;
  let s = 0;
  for (let j = i - n + 1; j <= i; j++) s += ds[j].close;
  const mid = s / n;
  let v = 0;
  for (let j = i - n + 1; j <= i; j++) v += (ds[j].close - mid) ** 2;
  const sd = Math.sqrt(v / n);
  return sd > 0 ? (ds[i].close - mid) / sd : null;
}
export function atrAt(ds, i, n = P.atrN) {
  if (i < n) return null;
  let s = 0;
  for (let j = i - n + 1; j <= i; j++) s += Math.max(ds[j].high, ds[j - 1].close) - Math.min(ds[j].low, ds[j - 1].close);
  return s / n;
}
// z of every day, computed once (each value reads only its own and earlier closes)
export const zs = (ds) => ds.map((_, i) => zAt(ds, i));

// stretch of day i: -1 low (z < -2), +1 high (z > +2), 0 otherwise
export const stretchOf = (z) => (z == null ? 0 : z < -P.zIn ? -1 : z > P.zIn ? 1 : 0);
export function signals(Z, test) {
  const out = [];
  for (let i = 0; i < Z.length; i++) { const s = stretchOf(Z[i]); if (s && test.sides.includes(s)) out.push(i); }
  return out;
}

// one trade from signal day i: entry at the open of i+1, stop 2 x ATR(14);
// exit 'z' = the first close whose own z is back toward the average (buy z >= -1, sell z <= +1), else day maxHold;
// a number = a fixed hold of that many days (baseline, placebo). The stop wins on its day; a later open past it fills at the open.
export function trade(ds, Z, i, side, exit, costMult = 1) {
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
    if (exit === 'z' && Z[j] != null && (side > 0 ? Z[j] >= -P.zOut : Z[j] <= P.zOut)) { px = b.close; xi = j; why = 'back'; xt = b.time + D; break; }
  }
  if (px == null) { xi = last; px = ds[xi].close; xt = ds[xi].time + D; }
  const R = (px - entry) / risk * side, costR = P.cost * costMult / risk;
  const nn = side > 0 ? nights(ds[e].time, xt) : 0, finR = costMult * nn * FIN.xau.long * entry / risk;
  return { d: ymd(ds[e].time), si: i, ei: e, xi, held: xi - e + 1, side, entry, stop, exit: px, why, R, costR, nights: nn, finR, net: R - costR - finR };
}

// one position at a time; the side is the stretch faded (low -> buy, high -> sell)
export function run(ds, Z, days, costMult = 1) {
  const T = []; let busy = -1;
  for (const i of days) {
    if (i + 1 <= busy) continue;
    const tr = trade(ds, Z, i, -stretchOf(Z[i]), 'z', costMult);
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

// unconditional baseline: a trade of the given side at every OOS day's open, fixed hold, same stop, overlap allowed
export function baseline(ds, Z, side, hold) {
  const out = [];
  for (let i = 0; i < ds.length - 1; i++) {
    const d = ymd(ds[i + 1].time);
    if (d < P.oosFrom || d > P.oosTo) continue;
    const tr = trade(ds, Z, i, side, hold);
    if (tr) out.push(tr);
  }
  return out;
}

export function analyse(rows) {
  const ds = toDays(rows), Z = zs(ds), IS = inW(P.isFrom, P.isTo), OOS = inW(P.oosFrom, P.oosTo);
  const H1 = inW(P.oosFrom, '2021-12-31'), H2 = inW(P.half, P.oosTo);
  const oosDays = []; for (let i = 0; i < ds.length - 1; i++) { const d = ymd(ds[i + 1].time); if (d >= P.oosFrom && d <= P.oosTo) oosDays.push(i); }
  const baseCache = new Map(), baseMean = (side, hold) => { const k = `${side}:${hold}`; if (!baseCache.has(k)) baseCache.set(k, mean(baseline(ds, Z, side, hold).map((x) => x.net))); return baseCache.get(k); };
  const out = { data: { from: ymd(ds[0].time), to: ymd(ds.at(-1).time), days: ds.length, firstZ: ymd(ds[Z.findIndex((z) => z != null)].time), stretchDays: { low: Z.filter((z) => stretchOf(z) < 0).length, high: Z.filter((z) => stretchOf(z) > 0).length } }, tests: {} };
  for (const tst of TESTS) {
    const days = signals(Z, tst), T = run(ds, Z, days), T2 = run(ds, Z, days, 2);
    const o = T.filter(OOS), om = mean(o.map((x) => x.net)), years = {};
    for (const x of T) { const y = x.d.slice(0, 4); (years[y] = years[y] || { n: 0, net: 0 }); years[y].n++; years[y].net = +(years[y].net + x.net).toFixed(2); }
    const heldMean = mean(o.map((x) => x.held)), H = Math.max(1, Math.round(heldMean || 1));
    const nb = o.filter((x) => x.side > 0).length, ns = o.length - nb;
    const bBuy = nb ? baseMean(1, H) : null, bSell = ns ? baseMean(-1, H) : null;
    const base = o.length ? ((nb ? nb * bBuy : 0) + (ns ? ns * bSell : 0)) / o.length : null;
    // placebo: each OOS trade moved to a random OOS entry day, keeping its side and days held, same stop
    const pl = [];
    for (let s = 1; s <= P.seeds; s++) {
      const rnd = mulberry32(s), Q = [];
      for (const x of o) { const i = oosDays[Math.floor(rnd() * oosDays.length)]; const q = trade(ds, Z, i, x.side, x.held); if (q) Q.push(q); }
      pl.push(r3(mean(Q.map((x) => x.net))));
    }
    out.tests[tst.id] = {
      name: tst.name, signals: days.length,
      is: stats(T.filter(IS), P.isFrom, P.isTo), isGross: stats(T.filter(IS), P.isFrom, P.isTo, 'R'),
      oos: stats(o, P.oosFrom, P.oosTo), oosGross: stats(o, P.oosFrom, P.oosTo, 'R'),
      oos2x: stats(T2.filter(OOS), P.oosFrom, P.oosTo),
      half1: stats(T.filter(H1), P.oosFrom, '2021-12-31'), half2: stats(T.filter(H2), P.half, P.oosTo),
      oosSides: { buy: nb, sell: ns }, heldMean: +heldMean.toFixed(2),
      baseline: { hold: H, buy: bBuy == null ? null : r3(bBuy), sell: bSell == null ? null : r3(bSell), mix: base == null ? null : r3(base) },
      costs: { costR: r3(o.reduce((s, x) => s + x.costR, 0)), finR: r3(o.reduce((s, x) => s + x.finR, 0)) },
      exits: Object.fromEntries(['back', 'stop', 'gap', 'time'].map((w) => [w, o.filter((x) => x.why === w).length])),
      placebo: { draws: pl, beaten: pl.filter((v) => om > v).length, median: [...pl].sort((a, b) => a - b)[P.seeds / 2], max: Math.max(...pl) },
      years,
    };
  }
  const ids = TESTS.map((t) => t.id), adj = holm(ids.map((id) => out.tests[id].oos.p));
  out.checks = {};
  ids.forEach((id, k) => {
    const r = out.tests[id];
    const c = { enoughN: r.oos.n >= P.minN, oosPositive: r.oos.mean > 0, holmP: +adj[k].toFixed(4), tHolm: r.oos.monthT >= 2 && adj[k] <= 0.0228, isSameSign: r.is.mean > 0, cost2x: r.oos2x.mean > 0, aboveBaseline: r.baseline.mix != null && r.oos.mean > r.baseline.mix, placebo: r.placebo.beaten >= P.needBeat };
    c.pass = c.enoughN && c.oosPositive && c.tHolm && c.isSameSign && c.cost2x && c.aboveBaseline && c.placebo;
    out.checks[id] = c;
  });
  out.passed = ids.filter((id) => out.checks[id].pass);
  out.verdict = out.checks.T3.pass ? 'PASS' : 'FAIL';
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
    for (const [id, r] of Object.entries(g.tests)) brief[id] = { sig: r.signals, is: r.is, isG: r.isGross, oos: r.oos, oosG: r.oosGross, x2: r.oos2x.mean, h1: r.half1, h2: r.half2, sides: r.oosSides, held: r.heldMean, base: r.baseline, pl: { beaten: r.placebo.beaten, median: r.placebo.median, max: r.placebo.max }, exits: r.exits, costs: r.costs };
    console.log(JSON.stringify({ data: g.data, brief, checks: g.checks, verdict: out.verdict }, null, 1));
  } else console.log('usage: run.mjs fetch|full <dir>');
}
