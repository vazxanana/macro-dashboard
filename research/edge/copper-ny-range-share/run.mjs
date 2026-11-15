// Copper: gold-ny-range-share's rule replicated on a market it was not found on (PREREGISTRATION.md, pushed first)
//   node --use-env-proxy research/edge/copper-ny-range-share/run.mjs fetch <dir>   OANDA mid XCU/USD H1 via /md/bars -> <dir>/xcu-1h.json
//   node research/edge/copper-ny-range-share/run.mjs count <dir>                   event counts per window (no outcome read)
//   node research/edge/copper-ny-range-share/run.mjs full <dir>                    runs the study, writes result.json next to this file
// The rule, thresholds, hold, stop and measures are gold-ny-range-share's, unchanged; only the market, the cost and the windows (if the history is short) differ.
// A stand-alone rule: it does not read or change the gold book. Research only, nothing live.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nights } from '../../../council/fills.mjs';
// council/fills.mjs FIN has no copper rate: copper buys are charged NO financing (stated in PREREGISTRATION.md).
// Cost: 0.10 % of the entry price a round trip (research/edge/trend-breadth's cost group "silver, copper, energies").

const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
export const P = { minBars: 18, minPre: 10, minNy: 6, atrN: 14, k: 2, nyHi: 0.6, costPct: 0.001, isStart: T('2007-01-01'), isEnd: T('2017-01-01'),
  half: T('2022-01-01'), dataEnd: T('2026-11-01'), seeds: 40, warm: 30 };
// segments by the UTC hour a H1 candle opens: before New York 00-12 (Asia + London), New York 13-20; 21-23 UTC unused
export const SEG = { pre: [0, 12], ny: [13, 20] };
export const TESTS = {
  T1: { name: 'New York made >= 60% of the day range: follow the New York move, 5-day hold, out of sample 2017-26 (primary)', kind: 'ny', hold: 5, win: 'oos' },
  T2: { name: 'New York made >= 60% of the day range: follow the New York move, 2-day hold, out of sample 2017-26', kind: 'ny', hold: 2, win: 'oos' },
  T3: { name: 'New York made >= 60% of the day range: follow the New York move, 5-day hold, 2007-26 pooled as one test', kind: 'ny', hold: 5, win: 'all' },
};
const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);
const r4 = (x) => +x.toFixed(4);

// H1 rows [t,o,h,l,c] -> eligible days (UTC day; Saturday / Sunday candles belong to the next Monday; >= minBars candles)
export function daysOf(rows, p = P) {
  const by = new Map();
  for (const r of rows) {
    let d = Math.floor(r[0] / 86400) * 86400; const w = new Date(d * 1000).getUTCDay();
    if (w === 6) d += 2 * 86400; else if (w === 0) d += 86400;
    if (!by.has(d)) by.set(d, []); by.get(d).push(r);
  }
  const out = [];
  for (const [day, b] of [...by.entries()].sort((a, c) => a[0] - c[0])) {
    if (b.length < p.minBars) continue;
    b.sort((x, y) => x[0] - y[0]);
    out.push({ day, bars: b, open: b[0][1], high: Math.max(...b.map((x) => x[2])), low: Math.min(...b.map((x) => x[3])), close: b.at(-1)[4] });
  }
  return out;
}
const hourOf = (t) => new Date(t * 1000).getUTCHours();
// the two segments of one day: high, low, move (close of the last candle - open of the first); candles of THIS UTC day only
export function segments(day, p = P) {
  const out = {};
  for (const [k, [h0, h1]] of Object.entries(SEG)) {
    const L = day.bars.filter((b) => b[0] >= day.day && b[0] < day.day + 86400 && hourOf(b[0]) >= h0 && hourOf(b[0]) <= h1);
    out[k] = L.length >= (k === 'pre' ? p.minPre : p.minNy) ? { hi: Math.max(...L.map((x) => x[2])), lo: Math.min(...L.map((x) => x[3])),
      move: L.at(-1)[4] - L[0][1], n: L.length } : null;
  }
  return out;
}
// share of the 00-21 UTC range New York made = the part of that range outside what 00-13 UTC had already made
export function nyMade(s) {
  if (!s.pre || !s.ny) return null;
  const hi = Math.max(s.pre.hi, s.ny.hi), lo = Math.min(s.pre.lo, s.ny.lo), R = hi - lo;
  return R > 0 ? 1 - (s.pre.hi - s.pre.lo) / R : null;
}
export function atr(days, n = P.atrN) {
  const out = new Array(days.length).fill(null), tr = days.map((b, i) => i === 0 ? b.high - b.low
    : Math.max(b.high - b.low, Math.abs(b.high - days[i - 1].close), Math.abs(b.low - days[i - 1].close)));
  for (let i = n; i < days.length; i++) { let s = 0; for (let k = i - n + 1; k <= i; k++) s += tr[k]; out[i] = s / n; }
  return out;
}
// per eligible day: the share, and the side the rule takes on it: ny = sign of New York's move (a signal when share >= nyHi)
export function signals(days, p = P) {
  const out = new Array(days.length).fill(null);
  for (let i = Math.max(p.warm, p.atrN + 1); i < days.length; i++) {
    const s = segments(days[i], p), sh = nyMade(s); if (sh == null) continue;
    out[i] = { share: r4(sh), ny: Math.sign(s.ny.move), sigNy: sh >= p.nyHi && s.ny.move !== 0 };
  }
  return out;
}
// one trade from day i: entry at the first H1 open of day i+1, stop k x ATR(i), out at the close of day i+hold or the stop
export function tradeAt(days, A, i, side, hold, p = P) {
  const e = i + 1, x = i + hold; if (x >= days.length || !(A[i] > 0) || !side) return null;
  const entry = days[e].bars[0][1], dist = p.k * A[i], stop = entry - side * dist, entryT = days[e].bars[0][0];
  for (let q = e; q <= x; q++) for (const b of days[q].bars) {
    const [t, o, h, l] = b;
    if (side > 0 && l <= stop) { const ex = Math.min(o, stop); return { side, entry, dist, stop, i, entryT, exitT: t + (ex === o ? 0 : 1800), exit: ex, why: 'stop' }; }
    if (side < 0 && h >= stop) { const ex = Math.max(o, stop); return { side, entry, dist, stop, i, entryT, exitT: t + (ex === o ? 0 : 1800), exit: ex, why: 'stop' }; }
  }
  const lb = days[x].bars.at(-1);
  return { side, entry, dist, stop, i, entryT, exitT: lb[0] + 3600, exit: lb[4], why: 'time' };
}
export function rOf(t, costMul = 1, p = P) {
  const gross = (t.exit - t.entry) * t.side / t.dist, cost = costMul * p.costPct * t.entry / t.dist;
  const nn = t.side > 0 ? nights(t.entryT, t.exitT) : 0;
  const fin = 0; // no copper financing rate on file: none charged (flatters the buys; said in the report)
  return { gross, cost, fin, nights: nn, net: gross - cost - fin };
}
const withR = (t, p) => { const r = rOf(t, 1, p), r2 = rOf(t, 2, p); return { ...t, gross: r.gross, cost: r.cost, fin: r.fin, nights: r.nights, net: r.net, net2: r2.net }; };

// every eligible day: the long and the short trade for one hold; `ev` = the day is a signal day of this kind,
// `dir` = the side this kind of test takes on that day, `sig` = this trade is the signal trade
export function dayTrades(days, S, A, kind, hold, p = P) {
  const out = [], sk = 'sigNy';
  for (let i = 0; i < days.length; i++) {
    if (!S[i]) continue;
    for (const side of [1, -1]) {
      const t = tradeAt(days, A, i, side, hold, p);
      if (t) out.push({ ...withR(t, p), dir: S[i][kind], ev: S[i][sk], sig: S[i][sk] && S[i][kind] === side });
    }
  }
  return out;
}
// excess of each signal trade over the mean net (and net2) of the baseline trades of the same side entered in the same calendar year
export function excessOf(all) {
  const yr = (t) => ym(t).slice(0, 4);
  const by = {};
  for (const d of all) { const s = yr(d.entryT) + ':' + d.side; (by[s] ||= { n: 0, net: 0, net2: 0 }); by[s].n++; by[s].net += d.net; by[s].net2 += d.net2; }
  return all.filter((d) => d.sig).map((d) => { const b = by[yr(d.entryT) + ':' + d.side];
    return { ...d, ex: d.net - b.net / b.n, ex2: d.net2 - b.net2 / b.n }; });
}

// statistics (the gold-trend-r2 study's functions, copied)
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
export function monthT(items, from, to, key = 'net', tf = 'entryT') {
  const months = monthsOf(from, to), sum = Object.fromEntries(months.map((s) => [s, 0]));
  for (const t of items) { const s = ym(t[tf]); if (s in sum) sum[s] += t[key]; }
  const v = months.map((s) => sum[s]), n = v.length, mean = v.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  const t = sd > 0 ? mean / (sd / Math.sqrt(n)) : 0;
  return { months: n, t: +t.toFixed(3), p: +pTwo(t, n - 1).toFixed(5) };
}
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
export function exSummary(ex, from, to) {
  const n = ex.length, avg = (k) => (n ? ex.reduce((a, t) => a + t[k], 0) / n : 0), m = monthT(ex, from, to, 'ex');
  return { n, long: ex.filter((t) => t.side > 0).length, ex: r4(avg('ex')), ex2: r4(avg('ex2')), sigGross: r4(avg('gross')), sigNet: r4(avg('net')),
    sigNet2: r4(avg('net2')), win: n ? r4(ex.filter((t) => t.net > 0).length / n) : 0, stops: ex.filter((t) => t.why === 'stop').length,
    medStop: +med(ex.map((t) => t.dist)).toFixed(2), ...m, t2: monthT(ex, from, to, 'ex2').t, netT: monthT(ex, from, to, 'net').t };
}
export function baseSummary(all, from, to) {
  const o = {};
  for (const [k, s] of [['long', 1], ['short', -1]]) { const L = all.filter((d) => d.side === s), n = L.length, avg = (q) => (n ? L.reduce((a, t) => a + t[q], 0) / n : 0);
    o[k] = { n, gross: r4(avg('gross')), net: r4(avg('net')), netT: monthT(L, from, to, 'net').t }; }
  return o;
}
// placebo: the real signal days, each given a seeded random side (keeps the timing, drops the direction)
export function placebo(all, seed, from, to) {
  const rnd = mulberry32(seed), W = all.filter((d) => d.entryT >= from && d.entryT < to), side = new Map();
  for (const d of W) if (d.ev && !side.has(d.i)) side.set(d.i, rnd() < 0.5 ? 1 : -1);
  const fake = W.map((d) => ({ ...d, sig: d.ev && side.get(d.i) === d.side }));
  return monthT(excessOf(fake), from, to, 'ex').t;
}
// control: per calendar year, as many random eligible days as the year has signal days, each traded on that day's own
// rule side (keeps each year's drift, volatility and the side mix of the rule; drops which days were signals)
export function control(all, seed, from, to) {
  const rnd = mulberry32(1000 + seed), W = all.filter((d) => d.entryT >= from && d.entryT < to), byY = {}, nSig = {};
  const first = new Map(); for (const d of W) if (!first.has(d.i)) first.set(d.i, d);
  for (const d of first.values()) { const y = ym(d.entryT).slice(0, 4); (byY[y] ||= []).push(d); if (d.ev) nSig[y] = (nSig[y] || 0) + 1; }
  const pick = new Set();
  for (const [y, L] of Object.entries(byY)) {
    const idx = L.map((_, i) => i);
    for (let j = idx.length - 1; j > 0; j--) { const r = Math.floor(rnd() * (j + 1)); [idx[j], idx[r]] = [idx[r], idx[j]]; }
    for (const q of idx.slice(0, nSig[y] || 0)) pick.add(L[q].i);
  }
  const fake = W.map((d) => ({ ...d, sig: pick.has(d.i) && d.dir === d.side }));
  return monthT(excessOf(fake), from, to, 'ex').t;
}

export function study(days, p = P) {
  const S = signals(days, p), A = atr(days, p.atrN), out = { tests: {} };
  const from = p.isStart, end = p.dataEnd;
  const inW = (L, a, b) => L.filter((t) => t.entryT >= a && t.entryT < b);
  const el = S.filter(Boolean), sh = el.map((s) => s.share).sort((a, b) => a - b);
  out.signals = { eligibleDays: el.length, nyDays: el.filter((s) => s.sigNy).length,
    shareMedian: sh[Math.floor(sh.length / 2)], nyUp: el.filter((s) => s.sigNy && s.ny > 0).length };
  const cache = {};
  for (const [id, x] of Object.entries(TESTS)) {
    const all = (cache[x.kind + ':' + x.hold] ||= dayTrades(days, S, A, x.kind, x.hold, p));
    const IS = inW(all, from, p.isEnd), OOS = inW(all, p.isEnd, end), ALL = inW(all, from, end);
    const o = { name: x.name, kind: x.kind, hold: x.hold, win: x.win, IS: exSummary(excessOf(IS), from, p.isEnd), OOS: exSummary(excessOf(OOS), p.isEnd, end),
      ALL: exSummary(excessOf(ALL), from, end),
      oosH1: exSummary(excessOf(inW(all, p.isEnd, p.half)), p.isEnd, p.half), oosH2: exSummary(excessOf(inW(all, p.half, end)), p.half, end),
      baseline: { IS: baseSummary(IS, from, p.isEnd), OOS: baseSummary(OOS, p.isEnd, end) } };
    // the judged window: out of sample for T1 / T2, the whole 2007-26 period for T3
    const [a, b] = x.win === 'all' ? [from, end] : [p.isEnd, end];
    o.judged = x.win === 'all' ? o.ALL : o.OOS;
    const pl = [], co = []; for (let s = 1; s <= p.seeds; s++) { pl.push(placebo(all, s, a, b)); co.push(control(all, s, a, b)); }
    o.placebo = { seeds: pl, beaten: pl.filter((v) => o.judged.t > v).length, median: med(pl) };
    o.control = { seeds: co, beaten: co.filter((v) => o.judged.t > v).length, median: med(co) };
    out.tests[id] = o;
  }
  const ids = Object.keys(TESTS), adj = holm(ids.map((id) => out.tests[id].judged.p));
  ids.forEach((id, i) => {
    const x = out.tests[id], J = x.judged; x.holmP = +adj[i].toFixed(5);
    x.checks = { monthT: J.t >= 2 && x.holmP < 0.05, netT: J.netT >= 2 && J.sigNet > 0, isSign: x.IS.ex > 0,
      costs2x: J.ex2 > 0 && J.sigNet2 > 0, placebo: x.placebo.beaten >= 38, control: x.control.beaten >= 38, n: x.OOS.n >= 100 && x.IS.n >= 100 };
    x.pass = Object.values(x.checks).every(Boolean);
  });
  out.window = { is: `${new Date(from * 1000).toISOString().slice(0, 10)}..2016-12-31`, oos: `2017-01-01..${new Date((end - 86400) * 1000).toISOString().slice(0, 10)}`, days: days.length };
  out.pass = out.tests.T1.pass;
  return out;
}

const here = path.dirname(fileURLToPath(import.meta.url));
async function fetchH1(dir) {
  const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const m = new Map();
  for (let a = T('2006-01-01'); a < P.dataEnd;) {
    const b = Math.min(P.dataEnd, a + 4999 * 3600); let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) {
      try { const r = await fetch(`${BASE}bars?sym=xcu&tf=1h&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
        if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; }
      catch (e) { err = String(e.message || e); }
      if (!j) await sleep(2000 * (k + 1));
    }
    if (!j) throw new Error(`xcu 1h ${new Date(a * 1000).toISOString()}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(150);
  }
  const rows = [...m.values()].sort((p, q) => p[0] - q[0]);
  fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'xcu-1h.json'), JSON.stringify(rows));
  console.log('xcu 1h', rows.length, new Date(rows[0][0] * 1000).toISOString(), new Date(rows.at(-1)[0] * 1000).toISOString());
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') await fetchH1(dir);
  else if (cmd === 'count') {
    const rows = JSON.parse(fs.readFileSync(path.join(dir, 'xcu-1h.json'), 'utf8')), days = daysOf(rows), S = signals(days);
    const c = (a, b, k) => S.filter((s, i) => s && s[k] && days[i].day >= a && days[i].day < b).length;
    console.log('IS ny', c(P.isStart, P.isEnd, 'sigNy'), '| OOS ny', c(P.isEnd, P.dataEnd, 'sigNy'), '| eligible', S.filter(Boolean).length,
      '| first', new Date(rows[0][0] * 1000).toISOString(), 'last', new Date(rows.at(-1)[0] * 1000).toISOString(), rows.length);
  } else if (cmd === 'full') {
    const rows = JSON.parse(fs.readFileSync(path.join(dir, 'xcu-1h.json'), 'utf8'));
    const days = daysOf(rows), r = study(days);
    const res = { topic: 'copper-ny-range-share', built: '2026-11-14',
      data: `OANDA mid XCU/USD H1 via /md/bars, ${rows.length} candles ${new Date(rows[0][0] * 1000).toISOString().slice(0, 10)} to ${new Date(rows.at(-1)[0] * 1000).toISOString().slice(0, 10)}`,
      costs: { roundTripPct: P.costPct, roundTripSrc: 'research/edge/trend-breadth cost group "silver, copper, energies" (0.10 % of entry price)', finLong: 0, finNote: 'no copper rate in council/fills.mjs FIN: no financing charged on buys or sells' }, verdict: r.pass ? 'PASS' : 'FAIL', ...r };
    fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(res, null, 1) + '\n');
    console.log('signals', JSON.stringify(r.signals), r.window);
    for (const [id, x] of Object.entries(r.tests)) { const { placebo: pl, control: co, ...rest } = x; console.log(id, JSON.stringify(rest), 'placebo', pl.beaten, pl.median, 'control', co.beaten, co.median); }
    console.log('verdict', res.verdict);
  } else console.log('usage: run.mjs fetch|count|full <dir>');
}
