// Gold: does the Sydney/Tokyo overlap (22:00-01:59 UTC) lead the rest of the day? (PREREGISTRATION.md, pushed first)
//   node --use-env-proxy research/edge/gold-overlap-lead/run.mjs fetch <dir>   OANDA mid XAU/USD H1 via /md/bars -> <dir>/xau-1h.json
//   node research/edge/gold-overlap-lead/run.mjs count <dir>                   event counts per window (no outcome read)
//   node research/edge/gold-overlap-lead/run.mjs full <dir>                    runs the study, writes result.json next to this file
// A stand-alone rule: it does not read or change the gold book. Research only, nothing live.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nights, FIN } from '../../../council/fills.mjs';

const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
export const P = { minBars: 16, minOv: 3, atrN: 14, k: 1, cost: 0.60, entryH: 2, exitH: 19, isStart: T('2007-01-01'), isEnd: T('2017-01-01'),
  half: T('2022-01-01'), dataEnd: T('2026-11-01'), seeds: 40, warm: 20 };
// thr = |overlap move| as a share of the previous session day's high-low range; sides = which signal sides are traded
export const TESTS = {
  T1: { name: 'Follow the overlap move, both sides, |move| >= 0.10 x prior day range (primary)', thr: 0.10, sides: 'both' },
  T2: { name: 'Follow an UP overlap move only (buys), |move| >= 0.10 x prior day range', thr: 0.10, sides: 'long' },
  T3: { name: 'Follow a strong overlap move, both sides, |move| >= 0.25 x prior day range', thr: 0.25, sides: 'both' },
};
const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);
const r4 = (x) => +x.toFixed(4);
// session hour of a candle: UTC hour shifted by +2, so 22:00 UTC -> 0 and 01:00 UTC -> 3 (the overlap = session hours 0-3)
export const sHour = (t) => (new Date(t * 1000).getUTCHours() + 2) % 24;

// H1 rows [t,o,h,l,c] -> session days (a session day runs 22:00 UTC of the day before to 21:59 UTC; Sunday's 22:00 reopen
// belongs to Monday; a session day falling on Saturday or Sunday is dropped; >= minBars candles)
export function daysOf(rows, p = P) {
  const by = new Map();
  for (const r of rows) {
    const d = Math.floor((r[0] + 7200) / 86400) * 86400, w = new Date(d * 1000).getUTCDay();
    if (w === 0 || w === 6) continue;
    if (!by.has(d)) by.set(d, []); by.get(d).push(r);
  }
  const out = [];
  for (const [day, b] of [...by.entries()].sort((a, c) => a[0] - c[0])) {
    if (b.length < p.minBars) continue;
    b.sort((x, y) => x[0] - y[0]);
    out.push({ day, bars: b, high: Math.max(...b.map((x) => x[2])), low: Math.min(...b.map((x) => x[3])), close: b.at(-1)[4] });
  }
  return out;
}
// the overlap of one session day: candles of session hours 0-3 (22:00-01:59 UTC); move = last close - first open, range = high - low
export function overlap(bars, p = P) {
  const L = bars.filter((b) => sHour(b[0]) <= 3);
  if (L.length < p.minOv) return null;
  return { move: L.at(-1)[4] - L[0][1], range: Math.max(...L.map((x) => x[2])) - Math.min(...L.map((x) => x[3])), n: L.length };
}
export function atr(days, n = P.atrN) {
  const out = new Array(days.length).fill(null), tr = days.map((b, i) => i === 0 ? b.high - b.low
    : Math.max(b.high - b.low, Math.abs(b.high - days[i - 1].close), Math.abs(b.low - days[i - 1].close)));
  for (let i = n; i < days.length; i++) { let s = 0; for (let k = i - n + 1; k <= i; k++) s += tr[k]; out[i] = s / n; }
  return out;
}
// day i's overlap reading; the threshold uses the PREVIOUS session day's range only, nothing of day i after 01:59 UTC
export function signals(days, p = P) {
  const out = new Array(days.length).fill(null);
  for (let i = Math.max(p.warm, p.atrN + 1); i < days.length; i++) {
    const o = overlap(days[i].bars, p), pr = days[i - 1].high - days[i - 1].low;
    if (!o || !(pr > 0)) continue;
    if (!days[i].bars.some((b) => sHour(b[0]) === p.entryH + 2)) continue; // a 02:00 UTC candle to enter on
    out[i] = { dir: Math.sign(o.move), ratio: r4(Math.abs(o.move) / pr), move: r4(o.move), ovRange: r4(o.range), prior: r4(pr) };
  }
  return out;
}
// one trade on day i: entry at the 02:00 UTC candle's open, stop k x ATR14 of the days BEFORE i, out at the close of the
// 19:00 UTC candle (20:00 UTC, before any rollover) or the stop
export function tradeAt(days, A, i, side, p = P) {
  const a = A[i - 1]; if (!(a > 0) || !side) return null;
  const L = days[i].bars.filter((b) => { const h = sHour(b[0]); return h >= p.entryH + 2 && h <= p.exitH + 2; });
  if (!L.length || sHour(L[0][0]) !== p.entryH + 2) return null;
  const entry = L[0][1], dist = p.k * a, stop = entry - side * dist, entryT = L[0][0];
  for (const [t, o, h, l] of L) {
    if (side > 0 && l <= stop) { const ex = Math.min(o, stop); return { side, entry, dist, stop, i, entryT, exitT: t + (ex === o ? 0 : 1800), exit: ex, why: 'stop' }; }
    if (side < 0 && h >= stop) { const ex = Math.max(o, stop); return { side, entry, dist, stop, i, entryT, exitT: t + (ex === o ? 0 : 1800), exit: ex, why: 'stop' }; }
  }
  const lb = L.at(-1);
  return { side, entry, dist, stop, i, entryT, exitT: lb[0] + 3600, exit: lb[4], why: 'time' };
}
export function rOf(t, costMul = 1, p = P) {
  const gross = (t.exit - t.entry) * t.side / t.dist, cost = costMul * p.cost / t.dist;
  const nn = t.side > 0 ? nights(t.entryT, t.exitT) : 0;
  const fin = costMul * nn * FIN.xau.long * t.entry / t.dist;
  return { gross, cost, fin, nights: nn, net: gross - cost - fin };
}
const withR = (t, p) => { const r = rOf(t, 1, p), r2 = rOf(t, 2, p); return { ...t, gross: r.gross, cost: r.cost, fin: r.fin, nights: r.nights, net: r.net, net2: r2.net }; };

// every eligible day: the long and the short trade, the day's overlap direction and ratio
export function dayTrades(days, S, A, p = P) {
  const out = [];
  for (let i = 0; i < days.length; i++) {
    if (!S[i]) continue;
    for (const side of [1, -1]) { const t = tradeAt(days, A, i, side, p); if (t) out.push({ ...withR(t, p), dir: S[i].dir, ratio: S[i].ratio }); }
  }
  return out;
}
export const mark = (all, thr) => all.map((d) => ({ ...d, sig: d.dir !== 0 && d.dir === d.side && d.ratio >= thr }));
// excess of each signal trade over the mean net (and net2) of ALL eligible days' trades of the same side in the same calendar year
export function excessOf(all, sides = 'both') {
  const yr = (t) => ym(t).slice(0, 4), by = {};
  for (const d of all) { const s = yr(d.entryT) + ':' + d.side; (by[s] ||= { n: 0, net: 0, net2: 0 }); by[s].n++; by[s].net += d.net; by[s].net2 += d.net2; }
  return all.filter((d) => d.sig && (sides === 'both' || d.side > 0)).map((d) => { const b = by[yr(d.entryT) + ':' + d.side];
    return { ...d, ex: d.net - b.net / b.n, ex2: d.net2 - b.net2 / b.n }; });
}

// statistics (the gold-session-agreement study's functions, copied)
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
    medStop: +med(ex.map((t) => t.dist)).toFixed(2), ...m, t2: monthT(ex, from, to, 'ex2').t, netT: monthT(ex, from, to, 'net').t,
    grossT: monthT(ex, from, to, 'gross').t };
}
export function baseSummary(all, from, to) {
  const o = {};
  for (const [k, s] of [['long', 1], ['short', -1]]) { const L = all.filter((d) => d.side === s), n = L.length, avg = (q) => (n ? L.reduce((a, t) => a + t[q], 0) / n : 0);
    o[k] = { n, gross: r4(avg('gross')), net: r4(avg('net')), netT: monthT(L, from, to, 'net').t }; }
  return o;
}
// placebo: per calendar year, the same number of random eligible days as signal days, each given one of that year's signal
// directions (shuffled): keeps the year's drift, volatility, signal count and long / short mix, removes the overlap's information
export function placebo(marked, seed, from, to, sides = 'both') {
  const rnd = mulberry32(seed), W = marked.filter((d) => d.entryT >= from && d.entryT < to), byY = {};
  const days = new Map(); for (const d of W) if (!days.has(d.i)) days.set(d.i, d);
  for (const d of days.values()) (byY[ym(d.entryT).slice(0, 4)] ||= []).push(d.i);
  const fakeDir = new Map();
  for (const [y, L] of Object.entries(byY)) {
    const dirs = W.filter((d) => d.sig && ym(d.entryT).slice(0, 4) === y).map((d) => d.side), idx = L.slice();
    for (let j = idx.length - 1; j > 0; j--) { const r = Math.floor(rnd() * (j + 1)); [idx[j], idx[r]] = [idx[r], idx[j]]; }
    dirs.forEach((s, q) => fakeDir.set(idx[q], s));
  }
  const fake = W.map((d) => ({ ...d, sig: fakeDir.get(d.i) === d.side }));
  return monthT(excessOf(fake, sides), from, to, 'ex').t;
}

export function study(days, p = P) {
  const S = signals(days, p), A = atr(days, p.atrN), out = { tests: {} }, from = p.isStart, end = p.dataEnd;
  const inW = (L, a, b) => L.filter((t) => t.entryT >= a && t.entryT < b);
  const all = dayTrades(days, S, A, p), el = S.filter(Boolean);
  out.signals = { eligibleDays: el.length, medRatio: med(el.map((s) => s.ratio)), up: el.filter((s) => s.dir > 0).length,
    over10: el.filter((s) => s.ratio >= 0.10).length, over25: el.filter((s) => s.ratio >= 0.25).length };
  for (const [id, x] of Object.entries(TESTS)) {
    const M = mark(all, x.thr), IS = inW(M, from, p.isEnd), OOS = inW(M, p.isEnd, end);
    const o = { name: x.name, thr: x.thr, sides: x.sides, IS: exSummary(excessOf(IS, x.sides), from, p.isEnd), OOS: exSummary(excessOf(OOS, x.sides), p.isEnd, end),
      oosH1: exSummary(excessOf(inW(M, p.isEnd, p.half), x.sides), p.isEnd, p.half), oosH2: exSummary(excessOf(inW(M, p.half, end), x.sides), p.half, end),
      baseline: { IS: baseSummary(IS, from, p.isEnd), OOS: baseSummary(OOS, p.isEnd, end) } };
    const pl = []; for (let s = 1; s <= p.seeds; s++) pl.push(placebo(M, s, p.isEnd, end, x.sides));
    o.placebo = { seeds: pl, beaten: pl.filter((v) => o.OOS.t > v).length, median: med(pl) };
    out.tests[id] = o;
  }
  const ids = Object.keys(TESTS), adj = holm(ids.map((id) => out.tests[id].OOS.p));
  ids.forEach((id, i) => {
    const x = out.tests[id]; x.holmP = +adj[i].toFixed(5);
    x.checks = { monthT: x.OOS.t >= 2 && x.holmP < 0.05, isSign: x.IS.ex > 0, costs2x: x.OOS.ex2 > 0 && x.OOS.sigNet2 > 0,
      placebo: x.placebo.beaten >= 38, n: x.OOS.n >= 100 && x.IS.n >= 100 };
    x.pass = Object.values(x.checks).every(Boolean);
  });
  out.window = { is: '2007-01-01..2016-12-31', oos: `2017-01-01..${new Date((end - 86400) * 1000).toISOString().slice(0, 10)}`, days: days.length };
  out.pass = out.tests.T1.pass;
  out.passCount = ids.filter((id) => out.tests[id].pass).length;
  return out;
}

const here = path.dirname(fileURLToPath(import.meta.url));
async function fetchH1(dir) {
  const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const m = new Map();
  for (let a = T('2006-06-01'); a < P.dataEnd;) {
    const b = Math.min(P.dataEnd, a + 4999 * 3600); let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) {
      try { const r = await fetch(`${BASE}bars?sym=xau&tf=1h&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
        if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; }
      catch (e) { err = String(e.message || e); }
      if (!j) await sleep(2000 * (k + 1));
    }
    if (!j) throw new Error(`xau 1h ${new Date(a * 1000).toISOString()}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(150);
  }
  const rows = [...m.values()].sort((p, q) => p[0] - q[0]);
  fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'xau-1h.json'), JSON.stringify(rows));
  console.log('xau 1h', rows.length, new Date(rows[0][0] * 1000).toISOString(), new Date(rows.at(-1)[0] * 1000).toISOString());
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') await fetchH1(dir);
  else if (cmd === 'count') {
    const rows = JSON.parse(fs.readFileSync(path.join(dir, 'xau-1h.json'), 'utf8')), days = daysOf(rows), S = signals(days);
    for (const [id, x] of Object.entries(TESTS)) {
      const c = (a, b) => S.filter((s, i) => s && s.dir !== 0 && s.ratio >= x.thr && (x.sides === 'both' || s.dir > 0) && days[i].day >= a && days[i].day < b).length;
      console.log(id, 'IS', c(P.isStart, P.isEnd), 'OOS', c(P.isEnd, P.dataEnd));
    }
    console.log('eligible', S.filter(Boolean).length);
  } else if (cmd === 'full') {
    const rows = JSON.parse(fs.readFileSync(path.join(dir, 'xau-1h.json'), 'utf8'));
    const days = daysOf(rows), r = study(days);
    const res = { topic: 'gold-overlap-lead', built: '2026-11-14',
      data: `OANDA mid XAU/USD H1 via /md/bars, ${rows.length} candles ${new Date(rows[0][0] * 1000).toISOString().slice(0, 10)} to ${new Date(rows.at(-1)[0] * 1000).toISOString().slice(0, 10)}`,
      costs: { roundTrip: P.cost, finLong: FIN.xau.long }, verdict: r.pass ? 'PASS' : 'FAIL', ...r };
    fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(res, null, 1) + '\n');
    console.log('signals', JSON.stringify(r.signals), r.window);
    for (const [id, x] of Object.entries(r.tests)) { const { placebo: pl, baseline, ...rest } = x; console.log(id, JSON.stringify(rest), 'placebo', pl.beaten, pl.median, JSON.stringify(baseline)); }
    console.log('verdict', res.verdict, r.passCount);
  } else console.log('usage: run.mjs fetch|count|full <dir>');
}
