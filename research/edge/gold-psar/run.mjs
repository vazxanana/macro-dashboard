// Gold's daily Parabolic SAR stop-and-reverse, both sides (PREREGISTRATION.md, pushed first)
//   node research/edge/gold-psar/run.mjs fetch <dir>   copies xau.json from origin/council-data (git show, no network)
//   node research/edge/gold-psar/run.mjs full <dir>    runs the three tests, writes result.json
// A new stand-alone daily rule judged on 2017-26; not a gate, exit, entry or size of the gold book (item 44).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

export const P = { atrN: 14, baseStopAtr: 2, baseHold: 10, maxHold: 60, smaN: 200, cost: 0.60, isFrom: '2007-01-01', isTo: '2016-12-31', oosFrom: '2017-01-01', oosTo: '2026-10-31', half: '2022-01-01', seeds: 40, needBeat: 38 };
export const TESTS = [
  { id: 'T1', name: 'SAR 0.02 / 0.02 / 0.20, both sides (primary)', af: [0.02, 0.02, 0.20], sma: false },
  { id: 'T2', name: 'SAR 0.01 / 0.01 / 0.10, both sides', af: [0.01, 0.01, 0.10], sma: false },
  { id: 'T3', name: 'SAR 0.02 / 0.02 / 0.20, flips with the 200-day average only', af: [0.02, 0.02, 0.20], sma: true },
];
const D = 86400;
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const r3 = (v) => +v.toFixed(3);

// rows [t, o, h, l, c, v] -> trading days (weekend candles folded into the next weekday)
export const toDays = (rows) => foldWeekend(rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })));

// Wilder's Parabolic SAR. sar[j] = the SAR that applies to day j (known from days 0..j-1); flip[j] = +1 / -1 when day j reversed
// the trend to long / short, else 0. Days 0 and 1 seed it (no SAR, no flip).
export function psar(ds, start, step, max) {
  const n = ds.length, sar = new Array(n).fill(null), flip = new Array(n).fill(0);
  if (n < 3) return { sar, flip };
  let trend = ds[1].close >= ds[0].close ? 1 : -1, cur = trend > 0 ? ds[0].low : ds[0].high, ep = trend > 0 ? ds[1].high : ds[1].low, af = start;
  const next = (j) => { let s = cur + af * (ep - cur); if (trend > 0) s = Math.min(s, ds[j].low, ds[j - 1].low); else s = Math.max(s, ds[j].high, ds[j - 1].high); return s; };
  sar[2] = next(1);
  for (let j = 2; j < n; j++) {
    const b = ds[j], s = sar[j];
    if (trend > 0 && b.low <= s) { trend = -1; cur = Math.max(ep, b.high); ep = b.low; af = start; flip[j] = -1; }
    else if (trend < 0 && b.high >= s) { trend = 1; cur = Math.min(ep, b.low); ep = b.high; af = start; flip[j] = 1; }
    else {
      cur = s;
      if (trend > 0 && b.high > ep) { ep = b.high; af = Math.min(af + step, max); }
      if (trend < 0 && b.low < ep) { ep = b.low; af = Math.min(af + step, max); }
    }
    if (j + 1 < n) sar[j + 1] = next(j);
  }
  return { sar, flip };
}

// simple average of closes i-n+1..i (null without enough history)
export function smaAt(ds, i, n = P.smaN) {
  if (i < n - 1) return null;
  let s = 0; for (let j = i - n + 1; j <= i; j++) s += ds[j].close;
  return s / n;
}
// ATR(n) at day i = mean true range of days i-n+1 .. i
export function atrAt(ds, i, n = P.atrN) {
  if (i < n) return null;
  let s = 0;
  for (let j = i - n + 1; j <= i; j++) s += Math.max(ds[j].high, ds[j - 1].close) - Math.min(ds[j].low, ds[j - 1].close);
  return s / n;
}

function finish(ds, e, side, entry, risk, exit, xi, why, xt, costMult, extra = {}) {
  const R = (exit - entry) / risk * side, costR = P.cost * costMult / risk;
  const nn = side > 0 ? nights(ds[e].time, xt) : 0, finR = costMult * nn * FIN.xau.long * entry / risk;
  return { d: ymd(ds[e].time), ei: e, xi, side, entry, risk, exit, why, held: xi - e + 1, R, costR, nights: nn, finR, net: R - costR - finR, ...extra };
}

// one SAR trade from flip day i: entry next open, stop = the day's SAR (trails), exit at its touch / a gap / day 60's close.
// null when the entry is on the wrong side of its first stop, or the trade is still open at the data end.
export function sarTrade(ds, sar, i, side, costMult = 1) {
  const e = i + 1;
  if (e >= ds.length || sar[e] == null) return null;
  const entry = ds[e].open, stop0 = sar[e], risk = (entry - stop0) * side;
  if (!(risk > 0)) return null;
  for (let j = e; j < ds.length; j++) {
    const b = ds[j], s = sar[j];
    if (j > e && (side > 0 ? b.open <= s : b.open >= s)) return finish(ds, e, side, entry, risk, b.open, j, 'gap', b.time, costMult, { stop0 });
    if (side > 0 ? b.low <= s : b.high >= s) return finish(ds, e, side, entry, risk, s, j, 'sar', b.time + D / 2, costMult, { stop0 });
    if (j === e + P.maxHold - 1) return finish(ds, e, side, entry, risk, b.close, j, 'time', b.time + D, costMult, { stop0 });
  }
  return null;
}

// signals [{ i, side }] one position at a time
export function runSar(ds, sar, sigs, costMult = 1) {
  const T = []; let busy = -1;
  for (const s of sigs) {
    if (s.i + 1 <= busy) continue;
    const tr = sarTrade(ds, sar, s.i, s.side, costMult);
    if (!tr) continue;
    T.push(tr); busy = tr.xi;
  }
  return T;
}

// signals of a test: every flip; T3 only flips on the side of close(i) against its 200-day average
export function signals(ds, flip, sma) {
  const out = [];
  for (let i = 0; i < ds.length; i++) {
    if (!flip[i]) continue;
    if (sma) { const m = smaAt(ds, i); if (m == null || Math.sign(ds[i].close - m) !== flip[i]) continue; }
    out.push({ i, side: flip[i] });
  }
  return out;
}

// baseline: same side at every day's open, 2 x ATR stop never moved, 10-day hold, one at a time
export function baseline(ds, side, costMult = 1) {
  const T = []; let busy = -1;
  for (let i = 0; i + 1 < ds.length; i++) {
    if (i + 1 <= busy) continue;
    const e = i + 1, atr = atrAt(ds, i);
    if (!atr) continue;
    const entry = ds[e].open, risk = P.baseStopAtr * atr, stop = entry - side * risk;
    let tr = null;
    for (let j = e; j < ds.length; j++) {
      const b = ds[j];
      if (j > e && (side > 0 ? b.open <= stop : b.open >= stop)) { tr = finish(ds, e, side, entry, risk, b.open, j, 'gap', b.time, costMult); break; }
      if (side > 0 ? b.low <= stop : b.high >= stop) { tr = finish(ds, e, side, entry, risk, stop, j, 'stop', b.time + D / 2, costMult); break; }
      if (j === e + P.baseHold - 1) { tr = finish(ds, e, side, entry, risk, b.close, j, 'time', b.time + D, costMult); break; }
    }
    if (!tr) break;
    T.push(tr); busy = tr.xi;
  }
  return T;
}

// placebo trade: the original's entry day, risk and exit day, a drawn side; fixed stop, else out at the exit day's open
export function placeboTrade(ds, x, side) {
  const e = x.ei, entry = ds[e].open, stop = entry - side * x.risk;
  for (let j = e; j <= x.xi; j++) {
    const b = ds[j];
    if (j > e && (side > 0 ? b.open <= stop : b.open >= stop)) return finish(ds, e, side, entry, x.risk, b.open, j, 'gap', b.time, 1);
    if (j === x.xi && j > e) return finish(ds, e, side, entry, x.risk, b.open, j, 'exit', b.time, 1);
    if (side > 0 ? b.low <= stop : b.high >= stop) return finish(ds, e, side, entry, x.risk, stop, j, 'stop', b.time + D / 2, 1);
  }
  return finish(ds, e, side, entry, x.risk, entry, e, 'exit', ds[e].time, 1);
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
  const ds = toDays(rows), IS = inW(P.isFrom, P.isTo), OOS = inW(P.oosFrom, P.oosTo);
  const H1 = inW(P.oosFrom, '2021-12-31'), H2 = inW(P.half, P.oosTo);
  const bb = baseline(ds, 1), bs = baseline(ds, -1);
  const bBuy = bb.filter(OOS), bSell = bs.filter(OOS);
  const out = {
    data: { from: ymd(ds[0].time), to: ymd(ds.at(-1).time), days: ds.length },
    baseline: { buy: { is: stats(bb.filter(IS), P.isFrom, P.isTo), oos: stats(bBuy, P.oosFrom, P.oosTo), oosGross: stats(bBuy, P.oosFrom, P.oosTo, 'R') }, sell: { is: stats(bs.filter(IS), P.isFrom, P.isTo), oos: stats(bSell, P.oosFrom, P.oosTo), oosGross: stats(bSell, P.oosFrom, P.oosTo, 'R') } },
    tests: {},
  };
  for (const tst of TESTS) {
    const { sar, flip } = psar(ds, ...tst.af), sigs = signals(ds, flip, tst.sma);
    const T = runSar(ds, sar, sigs), T2 = runSar(ds, sar, sigs, 2);
    const o = T.filter(OOS), years = {};
    for (const x of T) { const y = x.d.slice(0, 4); (years[y] = years[y] || { n: 0, net: 0 }); years[y].n++; years[y].net = +(years[y].net + x.net).toFixed(2); }
    const pl = [];
    for (let s = 1; s <= P.seeds; s++) {
      const rnd = mulberry32(s);
      pl.push(r3(mean(o.map((x) => placeboTrade(ds, x, rnd() < 0.5 ? 1 : -1).net))));
    }
    const ob = o.filter((x) => x.side > 0), os = o.filter((x) => x.side < 0), m = mean(o.map((x) => x.net));
    out.tests[tst.id] = {
      name: tst.name, flips: flip.filter(Boolean).length, signals: sigs.length,
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
      exits: Object.fromEntries(['sar', 'gap', 'time'].map((w) => [w, o.filter((x) => x.why === w).length])),
      placebo: { draws: pl, beaten: pl.filter((v) => m > v).length, median: [...pl].sort((a, b) => a - b)[P.seeds / 2], max: Math.max(...pl) },
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
    for (const [id, r] of Object.entries(g.tests)) brief[id] = { flips: r.flips, sig: r.signals, is: r.is, isG: r.isGross, oos: r.oos, oosG: r.oosGross, x2: r.oos2x.mean, h1: r.half1.mean, h2: r.half2.mean, buys: r.oosBuys, sells: r.oosSells, vsB: r.vsBaseline, pl: { beaten: r.placebo.beaten, median: r.placebo.median, max: r.placebo.max }, exits: r.exits, costs: r.costs, stop: r.stopUsd, held: r.heldMedian };
    console.log(JSON.stringify({ data: g.data, baseline: g.baseline, brief, checks: g.checks, verdict: out.verdict }, null, 1));
  } else console.log('usage: run.mjs fetch|full <dir>');
}
