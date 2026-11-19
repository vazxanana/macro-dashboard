// Fading clean 60-day trends on silver and platinum: a replication of the reverse reading of research/edge/gold-trend-r2
// (PREREGISTRATION.md, pushed alone first). The line fit, ATR, trade, month t, excess and Holm are copied from
// gold-trend-r2's run.mjs (branch gold-trend-r2); that folder is not edited. Only the side (against the slope), the
// markets, the costs and the tests differ.
//   node research/edge/metals-fade-clean-trend/run.mjs fetch <dir>   copies council-data research/daily/{xag,xpt}.json to <dir>
//   node research/edge/metals-fade-clean-trend/run.mjs full <dir>    runs the study and writes result.json next to this file
// Stand-alone research only: nothing live, no gold book, no ict/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { nights, FIN, foldWeekend } from '../../../council/fills.mjs';

export const P = { n: 60, r2Min: 0.70, hold: 10, atrN: 14, k: 2, cost: 0.03, warm: Date.UTC(2007, 0, 1) / 1000,
  half: Date.UTC(2017, 0, 1) / 1000, seeds: 40 };
// round trip a unit (pre-registered)
export const MK = { xag: { name: 'Silver', cost: 0.03 }, xpt: { name: 'Platinum', cost: 2.00 } };
// financing: fills.mjs has no silver / platinum rate, so the gold rate is applied as a fraction of each metal's price
export const FIN_RATE = { long: FIN.xau.long, short: 0,
  src: 'assumed: FIN.xau.long of council/fills.mjs (0.000148 of price a rollover) applied to each metal; no silver or platinum rate on file' };
export const TESTS = {
  T1: { name: 'Silver: fade trades on clean-trend days minus the same-month every-day fade (primary)', mk: ['xag'] },
  T2: { name: 'Platinum: the same', mk: ['xpt'] },
  T3: { name: 'Silver and platinum pooled by month', mk: ['xag', 'xpt'] },
};
const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);
const r4 = (x) => +x.toFixed(4);

export function barsOf(rows, now = Date.now() / 1000) {
  const today = Math.floor(now / 86400) * 86400;
  const raw = rows.filter((r) => r[0] < today).map(([t, o, h, l, c]) => ({ time: t, open: o, high: h, low: l, close: c }))
    .sort((a, b) => a.time - b.time);
  return foldWeekend(raw);
}
export function atr(bars, n = P.atrN) {
  const out = new Array(bars.length).fill(null), tr = bars.map((b, i) => i === 0 ? b.high - b.low
    : Math.max(b.high - b.low, Math.abs(b.high - bars[i - 1].close), Math.abs(b.low - bars[i - 1].close)));
  for (let i = n; i < bars.length; i++) { let s = 0; for (let k = i - n + 1; k <= i; k++) s += tr[k]; out[i] = s / n; }
  return out;
}
// OLS of ln(close) on 0..n-1 over the n closes up to and including day i: { slope, r2 } (null before n closes)
export function lineFit(bars, n = P.n) {
  const out = new Array(bars.length).fill(null), xm = (n - 1) / 2;
  let sxx = 0; for (let x = 0; x < n; x++) sxx += (x - xm) ** 2;
  for (let i = n - 1; i < bars.length; i++) {
    let ym0 = 0; for (let k = 0; k < n; k++) ym0 += Math.log(bars[i - n + 1 + k].close); ym0 /= n;
    let sxy = 0, syy = 0;
    for (let k = 0; k < n; k++) { const d = Math.log(bars[i - n + 1 + k].close) - ym0; sxy += (k - xm) * d; syy += d * d; }
    const slope = sxy / sxx, r2 = syy > 0 ? (sxy * sxy) / (sxx * syy) : 0;
    out[i] = { slope, r2 };
  }
  return out;
}
// one trade from signal day i: entry at bars[i+1].open, stop k x ATR(i), out at bars[i+1+hold].open or the stop
export function tradeAt(bars, A, i, side, p = P) {
  const e = i + 1, x = e + p.hold; if (x >= bars.length || !(A[i] > 0) || !side) return null;
  const entry = bars[e].open, dist = p.k * A[i], stop = entry - side * dist;
  for (let q = e; q < x; q++) { const b = bars[q];
    if (side > 0 && b.low <= stop) { const ex = Math.min(b.open, stop); return { side, entry, dist, stop, signalI: i, entryI: e, exitI: q, entryT: bars[e].time, exitT: b.time + (ex !== b.open ? 43200 : 0), exit: ex, why: 'stop' }; }
    if (side < 0 && b.high >= stop) { const ex = Math.max(b.open, stop); return { side, entry, dist, stop, signalI: i, entryI: e, exitI: q, entryT: bars[e].time, exitT: b.time + (ex !== b.open ? 43200 : 0), exit: ex, why: 'stop' }; }
  }
  return { side, entry, dist, stop, signalI: i, entryI: e, exitI: x, entryT: bars[e].time, exitT: bars[x].time, exit: bars[x].open, why: 'time' };
}
export function rOf(t, costMul = 1, p = P) {
  const gross = (t.exit - t.entry) * t.side / t.dist, cost = costMul * p.cost / t.dist;
  const nn = t.side > 0 ? nights(t.entryT, t.exitT) : 0;
  const fin = costMul * nn * (t.side > 0 ? FIN_RATE.long : FIN_RATE.short) * t.entry / t.dist;
  return { gross, cost, fin, nights: nn, net: gross - cost - fin };
}
const withR = (t, p) => { const r = rOf(t, 1, p), r2 = rOf(t, 2, p); return { ...t, gross: r.gross, cost: r.cost, fin: r.fin, nights: r.nights, net: r.net, net2: r2.net }; };

// every day's baseline FADE trade (side = minus the slope sign) and whether that day is a signal day
export function dayTrades(bars, p = P) {
  const fit = lineFit(bars, p.n), A = atr(bars, p.atrN), out = [];
  for (let i = 0; i < bars.length; i++) {
    if (bars[i].time < p.warm || !fit[i]) continue;
    const side = -Math.sign(fit[i].slope), t = tradeAt(bars, A, i, side, p);
    if (t) out.push({ ...withR(t, p), r2: fit[i].r2, sig: fit[i].r2 >= p.r2Min });
  }
  return out;
}
// one position at a time over the signal days (reference only)
export function oneAtATime(days) {
  const out = []; let freeAt = -1;
  for (const d of days) { if (!d.sig || d.entryI <= freeAt) continue; out.push(d); freeAt = d.exitI; }
  return out;
}

// statistics
function lgamma(x) { const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5; tmp -= (x + 0.5) * Math.log(tmp); let s = 1.000000000190015; for (const c of g) s += c / ++y; return -tmp + Math.log(2.5066282746310005 * s / x); }
function betacf(a, b, x) { let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d; let h = d;
  for (let m = 1; m <= 200; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-12) break; }
  return h; }
function ibeta(a, b, x) { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
export function pTwo(t, df) { if (!Number.isFinite(t) || df < 1) return 1; return ibeta(df / 2, 0.5, df / (df + t * t)); }
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let run = 0;
  idx.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (ps.length - r) * p)); out[i] = run; });
  return out;
}
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function monthsOf(from, to) {
  const months = []; const d = new Date(from * 1000); let y = d.getUTCFullYear(), m = d.getUTCMonth(); const end = ym(to - 1);
  for (;;) { const s = `${y}-${String(m + 1).padStart(2, '0')}`; months.push(s); if (s >= end) break; m++; if (m > 11) { m = 0; y++; } }
  return months;
}
// month t over every calendar month of [from, to): values v summed by month of the item's time field
export function monthT(items, from, to, key = 'net', tf = 'exitT') {
  const months = monthsOf(from, to), sum = Object.fromEntries(months.map((s) => [s, 0]));
  for (const t of items) { const s = ym(t[tf]); if (s in sum) sum[s] += t[key]; }
  const v = months.map((s) => sum[s]), n = v.length, mean = v.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  const t = sd > 0 ? mean / (sd / Math.sqrt(n)) : 0;
  return { months: n, t: +t.toFixed(3), p: +pTwo(t, n - 1).toFixed(5) };
}
// excess of each signal trade over the mean net (and net2) of the baseline trades entered in the same calendar month
export function excessOf(days) {
  const by = {};
  for (const d of days) { const s = ym(d.entryT); (by[s] ||= { n: 0, net: 0, net2: 0 }); by[s].n++; by[s].net += d.net; by[s].net2 += d.net2; }
  return days.filter((d) => d.sig).map((d) => { const b = by[ym(d.entryT)];
    return { ...d, ex: d.net - b.net / b.n, ex2: d.net2 - b.net2 / b.n }; });
}
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const avgOf = (L, k) => (L.length ? L.reduce((a, t) => a + t[k], 0) / L.length : 0);
export function exSummary(ex, from, to) {
  const m = monthT(ex, from, to, 'ex', 'entryT'), g = ex.reduce((a, t) => a + t.gross, 0), c = ex.reduce((a, t) => a + t.cost + t.fin, 0);
  return { n: ex.length, ex: r4(avgOf(ex, 'ex')), ex2: r4(avgOf(ex, 'ex2')), sigGross: r4(avgOf(ex, 'gross')), sigNet: r4(avgOf(ex, 'net')),
    sigNet2: r4(avgOf(ex, 'net2')), long: ex.filter((t) => t.side > 0).length, medStop: +med(ex.map((t) => t.dist)).toFixed(3),
    costShare: g > 0 ? r4(c / g) : null, ...m, t2: monthT(ex, from, to, 'ex2', 'entryT').t };
}
export function baseSummary(days, from, to) {
  return { n: days.length, gross: r4(avgOf(days, 'gross')), net: r4(avgOf(days, 'net')), net2: r4(avgOf(days, 'net2')),
    sigShare: days.length ? r4(days.filter((d) => d.sig).length / days.length) : 0, ...monthT(days, from, to, 'net', 'entryT') };
}
export function soloSummary(tr, from, to) {
  return { n: tr.length, gross: r4(avgOf(tr, 'gross')), net: r4(avgOf(tr, 'net')), net2: r4(avgOf(tr, 'net2')),
    total: +tr.reduce((a, t) => a + t.net, 0).toFixed(2), stops: tr.filter((t) => t.why === 'stop').length, ...monthT(tr, from, to, 'net', 'exitT') };
}
// placebo: per market and calendar year, the same number of random days of that year's baseline marked as signals
export function fakeSig(days, rnd) {
  const byY = {}; for (const d of days) (byY[ym(d.entryT).slice(0, 4)] ||= []).push(d);
  const fake = [];
  for (const L of Object.values(byY)) {
    const k = L.filter((d) => d.sig).length, idx = L.map((_, i) => i);
    for (let j = idx.length - 1; j > 0; j--) { const r = Math.floor(rnd() * (j + 1)); [idx[j], idx[r]] = [idx[r], idx[j]]; }
    const pick = new Set(idx.slice(0, k)); L.forEach((d, i) => fake.push({ ...d, sig: pick.has(i) }));
  }
  return fake;
}

// study over { xag: bars, xpt: bars }
export function study(barsBy, p = P) {
  const mks = Object.keys(MK).filter((m) => barsBy[m]);
  const end = Math.max(...mks.map((m) => barsBy[m][barsBy[m].length - 1].time)) + 86400;
  const W = { full: [p.warm, end], h1: [p.warm, p.half], h2: [p.half, end] };
  const days = Object.fromEntries(mks.map((m) => [m, dayTrades(barsBy[m], { ...p, cost: MK[m].cost })]));
  const inW = (L, a, b) => L.filter((t) => t.entryT >= a && t.entryT < b);
  const ex = {}; for (const [w, [a, b]] of Object.entries(W)) ex[w] = Object.fromEntries(mks.map((m) => [m, excessOf(inW(days[m], a, b))]));
  const out = { markets: {}, tests: {} };
  for (const m of mks) {
    const solo = oneAtATime(days[m]);
    out.markets[m] = { name: MK[m].name, cost: MK[m].cost, candles: barsBy[m].length,
      baseline: Object.fromEntries(Object.entries(W).map(([w, [a, b]]) => [w, baseSummary(inW(days[m], a, b), a, b)])),
      solo: Object.fromEntries(Object.entries(W).map(([w, [a, b]]) => [w, soloSummary(inW(solo, a, b), a, b)])) };
  }
  // placebo draws per seed and market over the full window
  const pl = []; for (let s = 1; s <= p.seeds; s++) { const rnd = mulberry32(s), o = {};
    for (const m of mks) o[m] = excessOf(fakeSig(inW(days[m], p.warm, end), rnd)); pl.push(o); }
  for (const [id, T] of Object.entries(TESTS)) {
    if (!T.mk.every((m) => days[m])) continue;
    const x = { name: T.name, markets: T.mk };
    for (const [w, [a, b]] of Object.entries(W)) x[w] = exSummary(T.mk.flatMap((m) => ex[w][m]), a, b);
    const ts = pl.map((o) => monthT(T.mk.flatMap((m) => o[m]), p.warm, end, 'ex', 'entryT').t);
    x.placebo = { seeds: ts, beaten: ts.filter((t) => x.full.t > t).length, median: med(ts) };
    out.tests[id] = x;
  }
  const ids = Object.keys(out.tests), adj = holm(ids.map((id) => out.tests[id].full.p));
  ids.forEach((id, i) => {
    const x = out.tests[id]; x.holmP = +adj[i].toFixed(5);
    x.checks = { monthT: x.full.t >= 2 && x.holmP < 0.05, halves: x.h1.ex > 0 && x.h2.ex > 0, costs2x: x.full.ex2 > 0 && x.full.sigNet2 > 0 };
    x.pass = Object.values(x.checks).every(Boolean);
  });
  const last = new Date((end - 86400) * 1000).toISOString().slice(0, 10);
  out.window = { full: `2007-01-01..${last}`, h1: '2007-01-01..2016-12-31', h2: `2017-01-01..${last}` };
  out.passCount = ids.filter((id) => out.tests[id].pass).length;
  out.pass = !!out.tests.T1?.pass;
  return out;
}

const here = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    for (const m of Object.keys(MK)) {
      fs.writeFileSync(path.join(dir, `${m}.json`), execFileSync('git', ['show', `origin/council-data:research/daily/${m}.json`], { maxBuffer: 1 << 26 }));
      console.log('wrote', path.join(dir, `${m}.json`));
    }
  } else if (cmd === 'full') {
    const barsBy = {}, src = {};
    for (const m of Object.keys(MK)) {
      const f = JSON.parse(fs.readFileSync(path.join(dir, `${m}.json`), 'utf8'));
      barsBy[m] = barsOf(f.rows, Date.parse(f.updated) / 1000 + 86400); src[m] = `${f.src}, updated ${f.updated}`;
    }
    const r = study(barsBy);
    const res = { topic: 'metals-fade-clean-trend', built: '2026-11-14', replicates: 'gold-trend-r2 (reverse reading, not pre-registered there)',
      data: `council-data research/daily/xag.json (${src.xag}), research/daily/xpt.json (${src.xpt})`, financing: FIN_RATE.src,
      verdict: r.pass ? 'PASS' : 'FAIL', ...r };
    fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(res, null, 1) + '\n');
    for (const [m, x] of Object.entries(r.markets)) console.log(m, 'baseline', JSON.stringify(x.baseline), '\n solo', JSON.stringify(x.solo));
    for (const [id, x] of Object.entries(r.tests)) { const { placebo, ...rest } = x; console.log(id, JSON.stringify(rest), 'placebo', placebo.beaten, placebo.median); }
    console.log(r.window, 'verdict', res.verdict, r.passCount);
  } else console.log('usage: run.mjs fetch|full <dir>');
}
