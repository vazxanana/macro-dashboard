// Gold's daily Heikin-Ashi colour flip after a run, both sides (PREREGISTRATION.md, pushed first)
//   node research/edge/gold-heikin-ashi/run.mjs fetch <dir>   copies xau.json from origin/council-data (git show, no network)
//   node research/edge/gold-heikin-ashi/run.mjs full <dir>    runs the three tests, writes result.json
// A new stand-alone daily rule judged on 2017-26; not a gate, exit, entry or size of the gold book (item 44).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

export const P = { atrN: 14, stopAtr: 2, cost: 0.60, maxHold: 20, isFrom: '2007-01-01', isTo: '2016-12-31', oosFrom: '2017-01-01', oosTo: '2026-10-31', half: '2022-01-01', seeds: 40, needBeat: 38, baseHold: 10 };
export const TESTS = [
  { id: 'T1', name: 'flip after a 3+ day run, follow it, colour exit (primary)', k: 3, exit: 'colour', hold: 20 },
  { id: 'T2', name: 'flip after a 5+ day run, follow it, colour exit', k: 5, exit: 'colour', hold: 20 },
  { id: 'T3', name: 'flip after a 3+ day run, follow it, 10-day hold', k: 3, exit: 'time', hold: 10 },
];
const D = 86400;
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const r3 = (v) => +v.toFixed(3);

// rows [t, o, h, l, c, v] -> trading days (weekend candles folded into the next weekday)
export const toDays = (rows) => foldWeekend(rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })));

// Heikin-Ashi colour per day: +1 green, -1 red, 0 equal; each value uses days 0..i only
export function haColours(ds) {
  const col = new Array(ds.length).fill(0);
  let hO = null, hC = null;
  for (let i = 0; i < ds.length; i++) {
    const b = ds[i], c = (b.open + b.high + b.low + b.close) / 4;
    const o = i === 0 ? (b.open + b.close) / 2 : (hO + hC) / 2;
    hO = o; hC = c;
    col[i] = Math.sign(c - o);
  }
  return col;
}

// run length of the colour ending at day i (0 for a colourless day)
export function runs(col) {
  const r = new Array(col.length).fill(0);
  for (let i = 0; i < col.length; i++) r[i] = col[i] === 0 ? 0 : (i > 0 && col[i - 1] === col[i] ? r[i - 1] + 1 : 1);
  return r;
}

// flip days: colour(i) opposite to colour(i-1), whose run was >= k; side = the new colour
export function flips(ds, k, col = haColours(ds)) {
  const r = runs(col), out = [];
  for (let i = 1; i < ds.length; i++) if (col[i] !== 0 && col[i - 1] === -col[i] && r[i - 1] >= k) out.push({ i, side: col[i] });
  return out;
}

// ATR(n) at day i = mean true range of days i-n+1 .. i (all closed at the signal); null without enough history
export function atrAt(ds, i, n = P.atrN) {
  if (i < n) return null;
  let s = 0;
  for (let j = i - n + 1; j <= i; j++) s += Math.max(ds[j].high, ds[j - 1].close) - Math.min(ds[j].low, ds[j - 1].close);
  return s / n;
}

// one trade from signal day i: entry at the open of i+1, stop 2 x ATR; exit by stop, colour against (next open) or time
export function trade(ds, col, i, side, exitKind, hold, costMult = 1) {
  const e = i + 1, atr = atrAt(ds, i);
  if (!atr || e >= ds.length) return null;
  const entry = ds[e].open, risk = P.stopAtr * atr, stop = entry - side * risk;
  let exit = null, xi = null, why = null, xt = null;
  for (let j = e; j < ds.length; j++) {
    const b = ds[j];
    if (j > e && (side > 0 ? b.open <= stop : b.open >= stop)) { exit = b.open; xi = j; why = 'gap'; xt = b.time; break; }
    if (side > 0 ? b.low <= stop : b.high >= stop) { exit = stop; xi = j; why = 'stop'; xt = b.time + D / 2; break; }
    if (j === e + hold - 1) { exit = b.close; xi = j; why = 'time'; xt = b.time + D; break; }
    if (exitKind === 'colour' && col[j] === -side) {
      if (j + 1 >= ds.length) return null;
      exit = ds[j + 1].open; xi = j + 1; why = 'colour'; xt = ds[j + 1].time; break;
    }
  }
  if (exit == null) return null; // still open at the end of the data
  const R = (exit - entry) / risk * side, costR = P.cost * costMult / risk;
  const nn = side > 0 ? nights(ds[e].time, xt) : 0, finR = costMult * nn * FIN.xau.long * entry / risk;
  return { d: ymd(ds[e].time), si: i, ei: e, xi, side, entry, stop, risk, exit, why, held: xi - e + 1, R, costR, nights: nn, finR, net: R - costR - finR };
}

// signals [{ i, side }] one position at a time; sideOf(sig, n) may replace the side (the placebo draws it)
export function run(ds, col, sigs, exitKind, hold, sideOf = (s) => s.side, costMult = 1) {
  const T = []; let busy = -1;
  for (const s of sigs) {
    if (s.i + 1 <= busy) continue;
    const tr = trade(ds, col, s.i, sideOf(s, T.length), exitKind, hold, costMult);
    if (!tr) continue;
    T.push(tr); busy = tr.xi;
  }
  return T;
}

const Phi = (x) => { const t = 1 / (1 + 0.2316419 * Math.abs(x)), y = 0.3989423 * Math.exp(-x * x / 2) * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x >= 0 ? 1 - y : y; };
const mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const sdv = (xs) => { const m = mean(xs); return xs.length > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)) : 0; };
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };

// every calendar month from..to, 0 when nothing closed (trades are dated by entry)
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
const welch = (a, b) => { const va = sdv(a) ** 2 / a.length, vb = sdv(b) ** 2 / b.length; return a.length > 1 && va + vb > 0 ? (mean(a) - mean(b)) / Math.sqrt(va + vb) : 0; };
const inW = (from, to) => (x) => x.d >= from && x.d <= to;

export function analyse(rows) {
  const ds = toDays(rows), col = haColours(ds), IS = inW(P.isFrom, P.isTo), OOS = inW(P.oosFrom, P.oosTo);
  const H1 = inW(P.oosFrom, '2021-12-31'), H2 = inW(P.half, P.oosTo);
  const every = (side) => ds.map((_, i) => ({ i, side }));
  const bBuy = run(ds, col, every(1), 'time', P.baseHold).filter(OOS), bSell = run(ds, col, every(-1), 'time', P.baseHold).filter(OOS);
  const bBuyIs = run(ds, col, every(1), 'time', P.baseHold).filter(IS), bSellIs = run(ds, col, every(-1), 'time', P.baseHold).filter(IS);
  const out = {
    data: { from: ymd(ds[0].time), to: ymd(ds.at(-1).time), days: ds.length },
    baseline: { buy: { is: stats(bBuyIs, P.isFrom, P.isTo), oos: stats(bBuy, P.oosFrom, P.oosTo), oosGross: stats(bBuy, P.oosFrom, P.oosTo, 'R') }, sell: { is: stats(bSellIs, P.isFrom, P.isTo), oos: stats(bSell, P.oosFrom, P.oosTo), oosGross: stats(bSell, P.oosFrom, P.oosTo, 'R') } },
    tests: {},
  };
  for (const tst of TESTS) {
    const sigs = flips(ds, tst.k, col);
    const T = run(ds, col, sigs, tst.exit, tst.hold), T2 = run(ds, col, sigs, tst.exit, tst.hold, (s) => s.side, 2);
    const o = T.filter(OOS), years = {};
    for (const x of T) { const y = x.d.slice(0, 4); (years[y] = years[y] || { n: 0, net: 0 }); years[y].n++; years[y].net = +(years[y].net + x.net).toFixed(2); }
    const pl = [];
    for (let s = 1; s <= P.seeds; s++) {
      const rnd = mulberry32(s), sides = new Map();
      const pt = run(ds, col, o.map((x) => ({ i: x.si, side: x.side })), tst.exit, tst.hold, (sg) => { if (!sides.has(sg.i)) sides.set(sg.i, rnd() < 0.5 ? 1 : -1); return sides.get(sg.i); });
      pl.push(r3(mean(pt.map((x) => x.net))));
    }
    const ob = o.filter((x) => x.side > 0), os = o.filter((x) => x.side < 0);
    out.tests[tst.id] = {
      name: tst.name, signals: sigs.length,
      is: stats(T.filter(IS), P.isFrom, P.isTo), isGross: stats(T.filter(IS), P.isFrom, P.isTo, 'R'),
      oos: stats(o, P.oosFrom, P.oosTo), oosGross: stats(o, P.oosFrom, P.oosTo, 'R'),
      oos2x: stats(T2.filter(OOS), P.oosFrom, P.oosTo),
      half1: stats(T.filter(H1), P.oosFrom, '2021-12-31'), half2: stats(T.filter(H2), P.half, P.oosTo),
      oosBuys: stats(ob, P.oosFrom, P.oosTo), oosSells: stats(os, P.oosFrom, P.oosTo),
      vsBaseline: {
        buy: { diff: r3(mean(ob.map((x) => x.net)) - mean(bBuy.map((x) => x.net))), welchT: +welch(ob.map((x) => x.net), bBuy.map((x) => x.net)).toFixed(2) },
        sell: { diff: r3(mean(os.map((x) => x.net)) - mean(bSell.map((x) => x.net))), welchT: +welch(os.map((x) => x.net), bSell.map((x) => x.net)).toFixed(2) },
      },
      costs: { costR: r3(mean(o.map((x) => x.costR))), finR: r3(mean(o.map((x) => x.finR))), share: r3(mean(o.map((x) => x.costR + x.finR))) },
      stopUsd: { median: +median(o.map((x) => x.risk)).toFixed(2), min: +Math.min(...o.map((x) => x.risk)).toFixed(2) },
      heldMedian: median(o.map((x) => x.held)),
      exits: Object.fromEntries(['stop', 'gap', 'colour', 'time'].map((w) => [w, o.filter((x) => x.why === w).length])),
      placebo: { draws: pl, beaten: pl.filter((v) => mean(o.map((x) => x.net)) > v).length, median: [...pl].sort((a, b) => a - b)[P.seeds / 2], max: Math.max(...pl) },
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
    const out = { built: '2026-11-14', params: P, tests: TESTS, costs: '$0.60 a round trip + FIN.xau.long financing on buys (council/fills.mjs); 2x = both doubled', src: `OANDA daily XAU_USD via council-data research/daily/xau.json (updated ${xau.updated})`, gold: analyse(xau.rows) };
    out.verdict = out.gold.verdict;
    fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
    const g = out.gold, brief = {};
    for (const [id, r] of Object.entries(g.tests)) brief[id] = { sig: r.signals, is: r.is, isG: r.isGross, oos: r.oos, oosG: r.oosGross, x2: r.oos2x.mean, h1: r.half1.mean, h2: r.half2.mean, buys: r.oosBuys, sells: r.oosSells, vsB: r.vsBaseline, pl: { beaten: r.placebo.beaten, median: r.placebo.median, max: r.placebo.max }, exits: r.exits, costs: r.costs, stop: r.stopUsd, held: r.heldMedian };
    console.log(JSON.stringify({ data: g.data, baseline: g.baseline, brief, checks: g.checks, verdict: out.verdict }, null, 1));
  } else console.log('usage: run.mjs fetch|full <dir>');
}
