// Gold after a run of daily closes broken by ONE opposite close (PREREGISTRATION.md, pushed first)
//   node research/edge/gold-run-pause/run.mjs fetch <dir>   copies xau.json from origin/council-data (git show, no network)
//   node research/edge/gold-run-pause/run.mjs full <dir>    runs the three tests, writes result.json
// A new stand-alone daily rule judged on 2017-26; not a gate, exit, entry or size of the gold book (item 44).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

export const P = { atrN: 14, stopAtr: 2, hold: 5, k: 3, cost: 0.60, isFrom: '2007-01-01', isTo: '2016-12-31', oosFrom: '2017-01-01', oosTo: '2026-10-31', seeds: 40, needBeat: 38, pBar: 0.0228 };
export const TESTS = [
  { id: 'T1', name: 'buy after 3+ up closes broken by one down close, 5 days', run: 1, side: 1 },
  { id: 'T2', name: 'sell after 3+ down closes broken by one up close, 5 days', run: -1, side: -1 },
  { id: 'T3', name: 'buy after 3+ down closes broken by one up close, 5 days', run: -1, side: 1 },
];
const D = 86400;
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const r3 = (v) => +v.toFixed(3);

export const toDays = (rows) => foldWeekend(rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })));

// signed run length at day i: +n = n up closes in a row ending at i, -n down; 0 on an equal close
export function runs(ds) {
  const s = new Array(ds.length).fill(0);
  for (let i = 1; i < ds.length; i++) {
    const d = Math.sign(ds[i].close - ds[i - 1].close);
    s[i] = d === 0 ? 0 : (Math.sign(s[i - 1]) === d ? s[i - 1] + d : d);
  }
  return s;
}

// signal days: a run of >= k closes in direction `run` ending at i-1, broken by exactly one opposite close at i
export function signals(ds, run, k = P.k) {
  const s = runs(ds), out = [];
  for (let i = 2; i < ds.length; i++) if (s[i] === -run && s[i - 1] * run >= k) out.push(i);
  return out;
}

export function atrAt(ds, i, n = P.atrN) {
  if (i < n) return null;
  let s = 0;
  for (let j = i - n + 1; j <= i; j++) s += Math.max(ds[j].high, ds[j - 1].close) - Math.min(ds[j].low, ds[j - 1].close);
  return s / n;
}

// one trade from signal day i: entry at the open of i+1, stop 2 x ATR(14), out at the close of day i+hold or the stop
export function trade(ds, i, side, costMult = 1, hold = P.hold) {
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

// a rule over signal days, one position at a time
export function run(ds, days, sideOf, costMult = 1) {
  const T = []; let busy = -1;
  for (const i of days) {
    if (i + 1 <= busy) continue;
    const tr = trade(ds, i, sideOf(i), costMult);
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
export const welch = (a, b) => { const va = sdv(a) ** 2 / a.length, vb = sdv(b) ** 2 / b.length; return va + vb > 0 ? (mean(a) - mean(b)) / Math.sqrt(va + vb) : 0; };
const inW = (from, to) => (x) => x.d >= from && x.d <= to;

// control: per OOS year, the test's trade count on random trading days of that year, same side, one position at a time
export function control(ds, T, side, seed) {
  const rnd = mulberry32(seed), byYear = {};
  for (const x of T) byYear[x.d.slice(0, 4)] = (byYear[x.d.slice(0, 4)] || 0) + 1;
  const out = [];
  for (const [y, n] of Object.entries(byYear)) {
    const pool = [];
    for (let i = P.atrN; i < ds.length - 1; i++) if (ymd(ds[i + 1].time).slice(0, 4) === y && ymd(ds[i + 1].time) <= P.oosTo) pool.push(i);
    for (let k = pool.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [pool[k], pool[j]] = [pool[j], pool[k]]; }
    const taken = []; let tries = 0;
    for (const i of pool) {
      if (taken.length >= n || tries > 5000) break; tries++;
      const tr = trade(ds, i, side);
      if (!tr) continue;
      if (taken.some((x) => !(tr.xi < x.ei || tr.ei > x.xi))) continue;
      taken.push(tr);
    }
    out.push(...taken);
  }
  return out;
}

export function analyse(rows) {
  const ds = toDays(rows), IS = inW(P.isFrom, P.isTo), OOS = inW(P.oosFrom, P.oosTo);
  const all = [];
  for (let i = P.atrN; i < ds.length; i++) all.push(i);
  const pool = (side) => all.map((i) => trade(ds, i, side)).filter(Boolean);
  const base = { 1: pool(1), [-1]: pool(-1) };
  const out = { data: { from: ymd(ds[0].time), to: ymd(ds.at(-1).time), days: ds.length }, baseline: {}, tests: {} };
  for (const s of [1, -1]) out.baseline[s > 0 ? 'buy' : 'sell'] = { is: { n: base[s].filter(IS).length, mean: r3(mean(base[s].filter(IS).map((x) => x.net))), gross: r3(mean(base[s].filter(IS).map((x) => x.R))) }, oos: { n: base[s].filter(OOS).length, mean: r3(mean(base[s].filter(OOS).map((x) => x.net))), gross: r3(mean(base[s].filter(OOS).map((x) => x.R))) } };
  for (const tst of TESTS) {
    const days = signals(ds, tst.run), T = run(ds, days, () => tst.side), T2 = run(ds, days, () => tst.side, 2);
    const o = T.filter(OOS), iw = T.filter(IS), oNet = mean(o.map((x) => x.net));
    const bo = base[tst.side].filter(OOS), bi = base[tst.side].filter(IS);
    const pl = [];
    for (let s = 1; s <= P.seeds; s++) {
      const rnd = mulberry32(s), sides = new Map();
      const P_ = run(ds, o.map((x) => x.si), (i) => { if (!sides.has(i)) sides.set(i, rnd() < 0.5 ? 1 : -1); return sides.get(i); });
      pl.push(r3(mean(P_.map((x) => x.net))));
    }
    const ct = [];
    for (let s = 101; s <= 100 + P.seeds; s++) ct.push(r3(mean(control(ds, o, tst.side, s).map((x) => x.net))));
    const years = {};
    for (const x of T) { const y = x.d.slice(0, 4); (years[y] = years[y] || { n: 0, net: 0 }); years[y].n++; years[y].net = +(years[y].net + x.net).toFixed(2); }
    const sorted = (a) => [...a].sort((p, q) => p - q);
    out.tests[tst.id] = {
      name: tst.name, signals: { is: days.filter((i) => ymd(ds[i].time) >= P.isFrom && ymd(ds[i].time) <= P.isTo).length, oos: days.filter((i) => ymd(ds[i].time) >= P.oosFrom && ymd(ds[i].time) <= P.oosTo).length },
      is: stats(iw, P.isFrom, P.isTo), isGross: stats(iw, P.isFrom, P.isTo, 'R'),
      oos: stats(o, P.oosFrom, P.oosTo), oosGross: stats(o, P.oosFrom, P.oosTo, 'R'),
      oos2x: stats(T2.filter(OOS), P.oosFrom, P.oosTo),
      excess: {
        is: { diff: r3(mean(iw.map((x) => x.net)) - mean(bi.map((x) => x.net))), welchT: +welch(iw.map((x) => x.net), bi.map((x) => x.net)).toFixed(2) },
        oos: { diff: r3(oNet - mean(bo.map((x) => x.net))), welchT: +welch(o.map((x) => x.net), bo.map((x) => x.net)).toFixed(2) },
      },
      costs: { costR: r3(o.reduce((s, x) => s + x.costR, 0)), finR: r3(o.reduce((s, x) => s + x.finR, 0)) },
      exits: Object.fromEntries(['stop', 'gap', 'time'].map((w) => [w, o.filter((x) => x.why === w).length])),
      placebo: { draws: pl, beaten: pl.filter((v) => oNet > v).length, median: sorted(pl)[P.seeds / 2], max: Math.max(...pl) },
      control: { draws: ct, beaten: ct.filter((v) => oNet > v).length, median: sorted(ct)[P.seeds / 2], max: Math.max(...ct) },
      years,
    };
  }
  const ids = TESTS.map((t) => t.id), adj = holm(ids.map((id) => out.tests[id].oos.p));
  out.checks = {};
  ids.forEach((id, k) => {
    const r = out.tests[id];
    const c = { holmP: +adj[k].toFixed(4), tHolm: r.oos.monthT >= 2 && adj[k] <= P.pBar, isPositive: r.is.mean > 0, cost2x: r.oos2x.mean > 0, excess: r.excess.oos.diff > 0, placebo: r.placebo.beaten >= P.needBeat, control: r.control.beaten >= P.needBeat };
    c.pass = c.tHolm && c.isPositive && c.cost2x && c.excess && c.placebo && c.control;
    out.checks[id] = c;
  });
  out.passed = ids.filter((id) => out.checks[id].pass);
  out.verdict = out.checks.T1.pass ? 'PASS' : 'FAIL';
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, dir] = process.argv.slice(2);
  if (!dir) { console.error('usage: run.mjs fetch|full <dir>'); process.exit(2); }
  const f = path.join(dir, 'xau.json');
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(f, execFileSync('git', ['show', 'origin/council-data:research/daily/xau.json'], { maxBuffer: 64e6 }));
    console.log('wrote', f);
  } else if (cmd === 'full') {
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    const out = { study: 'gold-run-pause', built: '2026-11-14', params: P, tests: TESTS, ...analyse(j.rows) };
    fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
    for (const id of Object.keys(out.tests)) { const r = out.tests[id]; console.log(id, JSON.stringify({ is: r.is, oos: r.oos, gross: r.oosGross.mean, x2: r.oos2x.mean, ex: r.excess, pl: r.placebo.beaten, ct: r.control.beaten, chk: out.checks[id] })); }
    console.log('baseline', JSON.stringify(out.baseline), 'verdict', out.verdict);
  }
}
