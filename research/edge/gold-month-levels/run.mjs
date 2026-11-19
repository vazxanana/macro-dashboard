// Gold's previous calendar month high / low (PREREGISTRATION.md, committed first).
//   git show origin/council-data:research/daily/xau.json > <file>   (no network; keep the file out of git)
//   node research/edge/gold-month-levels/run.mjs <file>             the study -> result.json (+ prints the tables)
// Pure pieces are exported for the test.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIN, nights, foldWeekend } from '../../../council/fills.mjs';

export const D = 86400, COST = 0.60, BUF = 0.30, HOLD = 10, ATRN = 14, ATRK = 1.5, MIN_PREV = 15;
const DIR = path.dirname(fileURLToPath(import.meta.url));
const T0 = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
export const WIN = { is: [T0('2008-01-01'), T0('2017-01-01') - 1], oos: [T0('2017-01-01'), null], h1: [T0('2017-01-01'), T0('2022-01-01') - 1], h2: [T0('2022-01-01'), null] };
export const ym = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };

// rows [t,o,h,l,c,v] -> folded weekdays { time, open, high, low, close, m (month index) }
export function daysOf(rows) {
  return foldWeekend(rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }))).map((b) => ({ ...b, m: ym(b.time) }));
}
// ATR(14), simple mean of the last 14 true ranges up to and including day i; null with too few days
export function atr(days, i, n = ATRN) {
  if (i < n) return null; let s = 0;
  for (let k = i - n + 1; k <= i; k++) { const b = days[k], pc = days[k - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}
// months: [{ m, a: first day index, b: last day index, hi, lo, open }]
export function monthsOf(days) {
  const out = [];
  days.forEach((d, i) => { const c = out.at(-1);
    if (!c || c.m !== d.m) out.push({ m: d.m, a: i, b: i, hi: d.high, lo: d.low, open: d.open });
    else { c.b = i; c.hi = Math.max(c.hi, d.high); c.lo = Math.min(c.lo, d.low); } });
  return out;
}
// the levels each month trades against: the previous month's range, or (placebo) random levels at the same signed distance
// from this month's first open, each distance scaled by U[0.7, 1.3]
export function levels(months, rnd = null) {
  const out = [];
  for (let k = 1; k < months.length; k++) { const p = months[k - 1], c = months[k];
    if (c.m - p.m !== 1 || p.b - p.a + 1 < MIN_PREV) continue;
    let hi = p.hi, lo = p.lo;
    if (rnd) { hi = c.open + (p.hi - c.open) * (0.7 + 0.6 * rnd()); lo = c.open + (p.lo - c.open) * (0.7 + 0.6 * rnd()); }
    out.push({ m: c.m, a: c.a, b: c.b, hi, lo });
  }
  return out;
}

// signals of one month. kind 'rev' (T1) or 'brk' (T2); side +1 buy / -1 sell. -> [{ i: signal day, side, stop?, target? }]
export function signals(days, L, kind) {
  const out = [];
  for (const side of [1, -1]) {
    for (let i = L.a; i <= L.b; i++) { const d = days[i];
      if (kind === 'rev') {
        if (side < 0 && d.high > L.hi && d.close < L.hi) { out.push({ i, side, stop: d.high + BUF, target: L.lo }); break; }
        if (side > 0 && d.low < L.lo && d.close > L.lo) { out.push({ i, side, stop: d.low - BUF, target: L.hi }); break; }
      } else {
        if (side > 0 && d.close > L.hi) { out.push({ i, side, atr: atr(days, i) }); break; }
        if (side < 0 && d.close < L.lo) { out.push({ i, side, atr: atr(days, i) }); break; }
      }
    }
  }
  return out;
}

// one trade from day e's open; stop first (gap fills at the open), then target, else the close of day e + HOLD - 1
export function simulate(days, e, side, stop, target, cost = COST, finK = 1) {
  if (e >= days.length) return null;
  const entry = days[e].open, risk = Math.abs(entry - stop);
  if (!(risk > 0) || (side > 0 ? entry <= stop : entry >= stop)) return null;
  if (target != null && (side > 0 ? entry >= target : entry <= target)) return null;
  const last = e + HOLD - 1; if (last >= days.length) return null;
  let exit = null, how = 'time', k = e;
  for (; k <= last; k++) { const b = days[k];
    if (side > 0 ? b.low <= stop : b.high >= stop) { exit = side > 0 ? Math.min(b.open, stop) : Math.max(b.open, stop); how = 'stop'; break; }
    if (target != null && (side > 0 ? b.high >= target : b.low <= target)) { exit = target; how = 'target'; break; }
    if (k === last) exit = b.close; }
  if (k > last) k = last;
  const entryT = days[e].time, exitT = days[k].time + D, R = side * (exit - entry) / risk;
  const nts = side > 0 ? nights(entryT, exitT) : 0, finR = side > 0 ? finK * nts * FIN.xau.long * entry / risk : 0;
  return { side, e, x: k, entryT, exitT, entry, stop, target, risk, exit, how, R, nights: nts, finR, net: R - cost / risk - finR };
}

// every trade of one test, one position at a time. test: 'T1' | 'T2' | 'T3'
export function trades(days, L, test, cost = COST, finK = 1) {
  const kind = test === 'T1' ? 'rev' : 'brk', sig = [];
  for (const lv of L) for (const s of signals(days, lv, kind)) if (test !== 'T3' || s.side > 0) sig.push(s);
  sig.sort((a, b) => a.i - b.i || b.side - a.side);
  const out = []; let busy = -1;
  for (const s of sig) { const e = s.i + 1; if (e <= busy) continue;
    let stop = s.stop, target = s.target ?? null;
    if (kind === 'brk') { if (!(s.atr > 0) || e >= days.length) continue; stop = days[e].open - s.side * ATRK * s.atr; }
    const tr = simulate(days, e, s.side, stop, target, cost, finK); if (!tr) continue;
    out.push({ ...tr, sigT: days[s.i].time }); busy = tr.x; }
  return out;
}

// the first touch of each level from inside (descriptive): did the touch day close back inside or beyond, and the 10-day
// close-to-close move from the next open, in the direction of the break (+ = beyond)
export function touches(days, L) {
  const out = [];
  for (const lv of L) for (const side of [1, -1]) {
    for (let i = lv.a; i <= lv.b; i++) { const d = days[i], lvl = side > 0 ? lv.hi : lv.lo;
      if (i === lv.a && (side > 0 ? d.open > lvl : d.open < lvl)) break;   // opened beyond: no touch from inside
      if (side > 0 ? d.high >= lvl : d.low <= lvl) {
        const beyond = side > 0 ? d.close > lvl : d.close < lvl, e = i + 1, x = e + HOLD - 1;
        const mv = x < days.length ? side * (days[x].close - days[e].open) / days[e].open * 100 : null;
        out.push({ t: d.time, side, beyond, move: mv }); break; }
    }
  }
  return out;
}

export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const phi = (z) => { const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z / 2); return z >= 0 ? (1 + y) / 2 : (1 - y) / 2; };
export const pOne = (t) => (Number.isFinite(t) ? 1 - phi(t) : 1);
export function holm(ps) { const ix = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), m = ps.length, adj = Array(m); let run = 0;
  ix.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (m - k) * p)); adj[i] = run; }); return adj; }
const r3 = (x) => +x.toFixed(3), r2 = (x) => +x.toFixed(2);
// t on calendar-month sums of net R (by the exit's UTC month), every month of from..to counted
export function monthT(T, from, to) {
  const a = ym(from), b = ym(to), s = Array(b - a + 1).fill(0); for (const x of T) { const m = ym(x.exitT) - a; if (m >= 0 && m < s.length) s[m] += x.net; }
  const n = s.length, mu = s.reduce((p, q) => p + q, 0) / n, sd = Math.sqrt(s.reduce((p, q) => p + (q - mu) ** 2, 0) / (n - 1));
  return { months: n, t: sd ? mu / (sd / Math.sqrt(n)) : 0 };
}
export function stats(T, from, to) {
  const n = T.length, s = T.reduce((a, x) => a + x.net, 0), g = T.reduce((a, x) => a + x.R, 0), win = T.filter((x) => x.net > 0).reduce((a, x) => a + x.net, 0), loss = -T.filter((x) => x.net < 0).reduce((a, x) => a + x.net, 0);
  let eq = 0, pk = 0, dd = 0; for (const x of T) { eq += x.net; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  const mo = monthT(T, from, to);
  return { n, avg: n ? r3(s / n) : 0, gross: n ? r3(g / n) : 0, total: r2(s), wr: n ? r2(T.filter((x) => x.net > 0).length / n * 100) : 0, pf: loss ? r2(win / loss) : null, dd: r2(dd), tMonth: r2(mo.t), months: mo.months,
    stops: T.filter((x) => x.how === 'stop').length, targets: T.filter((x) => x.how === 'target').length, times: T.filter((x) => x.how === 'time').length,
    medRisk: n ? r2(T.map((x) => x.risk).sort((p, q) => p - q)[Math.floor(n / 2)]) : null };
}
const avgOf = (T) => (T.length ? T.reduce((a, x) => a + x.net, 0) / T.length : 0);

export const TESTS = ['T1', 'T2', 'T3'];
export function study(rows) {
  const days = daysOf(rows), months = monthsOf(days), L = levels(months), end = days.at(-1).time + D;
  const inWin = (T, [a, b]) => T.filter((x) => x.entryT >= a && x.entryT <= (b ?? end));
  const out = { tests: {} };
  for (const k of TESTS) {
    const T = trades(days, L, k), T2x = trades(days, L, k, 2 * COST, 2);
    const oos = inWin(T, WIN.oos), is = inWin(T, WIN.is);
    const so = stats(oos, WIN.oos[0], end), si = stats(is, ...WIN.is);
    const h1 = stats(inWin(T, WIN.h1), ...WIN.h1), h2 = stats(inWin(T, WIN.h2), WIN.h2[0], end);
    const x2 = { oos: stats(inWin(T2x, WIN.oos), WIN.oos[0], end), is: stats(inWin(T2x, WIN.is), ...WIN.is) };
    const years = {}; for (const x of T) { const y = new Date(x.entryT * 1000).getUTCFullYear(); if (y < 2008) continue; (years[y] ||= []).push(x); }
    const yr = Object.fromEntries(Object.entries(years).map(([y, a]) => [y, { n: a.length, avg: r3(avgOf(a)), total: r2(a.reduce((p, q) => p + q.net, 0)) }]));
    const sides = Object.fromEntries([['buy', 1], ['sell', -1]].map(([nm, v]) => [nm, { is: stats(is.filter((x) => x.side === v), ...WIN.is), oos: stats(oos.filter((x) => x.side === v), WIN.oos[0], end) }]));
    const pl = []; for (let s = 1; s <= 40; s++) pl.push(avgOf(inWin(trades(days, levels(months, mulberry32(s)), k), WIN.oos)));
    const beat = pl.filter((v) => so.avg > v).length, ps = [...pl].sort((a, b) => a - b);
    out.tests[k] = { is: si, oos: so, halves: { h1, h2 }, x2, years: yr, sides, placebo: { seeds: 40, beat, median: r3((ps[19] + ps[20]) / 2), min: r3(ps[0]), max: r3(ps[39]) }, p: pOne(so.tMonth) };
  }
  const adj = holm(TESTS.map((k) => out.tests[k].p));
  TESTS.forEach((k, i) => { const r = out.tests[k]; r.p = +r.p.toFixed(4); r.holmP = +adj[i].toFixed(4);
    r.checks = { oosNet: r.oos.avg > 0, t: r.oos.tMonth >= 2 && r.holmP <= 0.05, isNet: r.is.avg > 0, halves: r.halves.h1.avg > 0 && r.halves.h2.avg > 0, x2: r.x2.oos.avg > 0, placebo: r.placebo.beat >= 38, n: r.oos.n >= 30 };
    r.pass = Object.values(r.checks).every(Boolean); });
  out.verdict = TESTS.some((k) => out.tests[k].pass) ? 'PASS' : 'FAIL';
  const tc = touches(days, L), tw = (w) => { const a = tc.filter((x) => x.t >= w[0] && x.t <= (w[1] ?? end)), f = (arr) => { const m = arr.filter((x) => x.move != null).map((x) => x.move); return { n: arr.length, avgMovePct: m.length ? r3(m.reduce((p, q) => p + q, 0) / m.length) : null }; };
    return { n: a.length, closedBeyondPct: a.length ? r2(a.filter((x) => x.beyond).length / a.length * 100) : 0, beyond: f(a.filter((x) => x.beyond)), inside: f(a.filter((x) => !x.beyond)) }; };
  out.touches = { note: 'descriptive, not tested; move = 10-day close vs next open in the direction of the level (+ = beyond), %', is: tw(WIN.is), oos: tw(WIN.oos) };
  out.data = { src: 'council-data research/daily/xau.json (OANDA mid, UTC days, weekends folded)', from: new Date(days[0].time * 1000).toISOString().slice(0, 10), to: new Date(days.at(-1).time * 1000).toISOString().slice(0, 10), days: days.length, months: L.length };
  out.costs = { roundTrip: COST, x2RoundTrip: 2 * COST, financing: { rate: FIN.xau.long, asOf: FIN.xau.asOf, longsOnly: true } };
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const f = process.argv[2]; if (!f) { console.error('usage: run.mjs <xau.json>'); process.exit(2); }
  const j = JSON.parse(fs.readFileSync(f, 'utf8')), res = study(j.rows);
  res.data.updated = j.updated; res.built = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(DIR, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  for (const k of TESTS) { const r = res.tests[k]; console.log(k, JSON.stringify({ is: [r.is.n, r.is.gross, r.is.avg, r.is.tMonth], oos: [r.oos.n, r.oos.gross, r.oos.avg, r.oos.tMonth, r.oos.pf, r.oos.dd], h: [r.halves.h1.avg, r.halves.h2.avg], x2: r.x2.oos.avg, pl: r.placebo, holm: r.holmP, checks: r.checks })); }
  console.log(res.verdict, JSON.stringify(res.touches));
}
