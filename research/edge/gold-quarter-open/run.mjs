// The quarterly open as a level on spot gold (PREREGISTRATION.md, pushed first).
//   node research/edge/gold-quarter-open/run.mjs fetch <dir>   copies council-data research/daily/xau.json to <dir> (git show, no network)
//   node research/edge/gold-quarter-open/run.mjs full <dir>    runs the study and writes result.json next to this file
// A stand-alone rule: it does not read or change the gold book. Research only, nothing live.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { nights, FIN, foldWeekend } from '../../../council/fills.mjs';

export const P = { atrN: 14, arm: 2, far: 3, k: 1.5, hold: 5, holdMagnet: 10, cost: 0.60,
  start: Date.UTC(2007, 0, 1) / 1000, isEnd: Date.UTC(2017, 0, 1) / 1000, half: Date.UTC(2022, 0, 1) / 1000, seeds: 40 };
export const TESTS = {
  T1: { name: 'Quarter open holds (touch after a 2 ATR move away)', kind: 'hold' },
  T2: { name: 'Quarter open breaks (close through it after a 2 ATR move away)', kind: 'break' },
  T3: { name: 'Quarter open pulls (3 ATR away, target the open)', kind: 'magnet' },
};
const OPEN = 0, MID = 43200, CLOSE = 79200;
const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);

// rows [t,o,h,l,c,v] -> folded weekday bars, complete days only (a row dated `now`'s day or later is dropped)
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
export const quarterOf = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 4 + Math.floor(d.getUTCMonth() / 3); };
// { q: open of the quarter's first bar, first: its index } for every quarter whose first bar is at or after p.start
export function levels(bars, p = P) {
  const out = new Map();
  bars.forEach((b, i) => { const q = quarterOf(b.time); if (!out.has(q) && b.time >= p.start) out.set(q, { q, level: b.open, first: i }); });
  return out;
}

// One test's trade list. lev = Map(quarter -> { level }). Each test is one position at a time.
export function simulate(bars, lev, kind, p = P) {
  const A = atr(bars, p.atrN), trades = [];
  let pos = null, arm = 0, armQ = null, pend = null;
  const done = (exit, i, stamp, why) => { trades.push({ ...pos, exit, exitI: i, exitT: bars[i].time + stamp, why, bars: i - pos.entryI }); pos = null; };
  const manage = (i, entryDay) => {   // stop first, then the target, then the time exit; a day opening beyond a level fills at the open
    const b = bars[i], s = pos.side;
    if (!entryDay && (s > 0 ? b.open <= pos.stop : b.open >= pos.stop)) return done(b.open, i, OPEN, 'stop');
    if (s > 0 ? b.low <= pos.stop : b.high >= pos.stop) return done(pos.stop, i, MID, 'stop');
    if (pos.target != null) {
      if (!entryDay && (s > 0 ? b.open >= pos.target : b.open <= pos.target)) return done(b.open, i, OPEN, 'target');
      if (s > 0 ? b.high >= pos.target : b.low <= pos.target) return done(pos.target, i, MID, 'target');
    }
    if (i >= pos.exitI) return done(b.close, i, CLOSE, 'time');
  };
  for (let i = 1; i < bars.length; i++) {
    const b = bars[i], q = quarterOf(b.time), L = lev.get(q)?.level;
    if (pend) {   // T2 / T3: the signal of yesterday's close, filled at today's open
      const { side, dist, target } = pend; pend = null;
      if (!(target != null && (side > 0 ? b.open >= target : b.open <= target))) {
        pos = { side, entry: b.open, stop: b.open - side * dist, dist, target, entryI: i, entryT: b.time + OPEN, exitI: i + (target != null ? p.holdMagnet : p.hold) };
        manage(i, true); continue;
      }
    }
    if (pos) { manage(i, false); if (pos || bars[i - 1] == null) continue; }
    const exitedToday = trades.length && trades[trades.length - 1].exitI === i;
    if (armQ !== q) { arm = 0; armQ = q; }
    if (L == null || !(A[i] > 0)) continue;
    // T1: an armed touch of the level today (the arm came from an earlier close)
    if (kind === 'hold' && arm && !exitedToday && A[i - 1] > 0 && (arm > 0 ? b.low <= L : b.high >= L)) {
      const side = arm, gap = side > 0 ? b.open <= L : b.open >= L, entry = gap ? b.open : L, dist = p.k * A[i - 1];
      pos = { side, entry, stop: entry - side * dist, dist, target: null, entryI: i, entryT: b.time + (gap ? OPEN : MID), exitI: i + p.hold };
      arm = 0; manage(i, true); continue;
    }
    if (kind === 'break' && arm && (arm > 0 ? b.close < L : b.close > L)) {
      pend = { side: -arm, dist: p.k * A[i], target: null }; arm = 0; continue;
    }
    if (kind === 'magnet') {
      if (b.close >= L + p.far * A[i]) pend = { side: -1, dist: p.k * A[i], target: L };
      else if (b.close <= L - p.far * A[i]) pend = { side: 1, dist: p.k * A[i], target: L };
      continue;
    }
    if (b.close >= L + p.arm * A[i]) arm = 1; else if (b.close <= L - p.arm * A[i]) arm = -1;
  }
  if (pos) { const i = bars.length - 1; trades.push({ ...pos, exit: bars[i].close, exitI: i, exitT: bars[i].time + CLOSE, why: 'open', bars: i - pos.entryI }); }
  return trades;
}
// R of a trade: gross, cost, financing, net (costMul 1 or 2)
export function rOf(t, costMul = 1, p = P) {
  const gross = (t.exit - t.entry) * t.side / t.dist, cost = costMul * p.cost / t.dist;
  const nn = t.side > 0 ? nights(t.entryT, t.exitT) : 0;
  const fin = costMul * nn * (t.side > 0 ? FIN.xau.long : FIN.xau.short) * t.entry / t.dist;
  return { gross, cost, fin, nights: nn, net: gross - cost - fin };
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
export function monthT(trades, from, to, key = 'net') {
  const months = []; const d = new Date(from * 1000); let y = d.getUTCFullYear(), m = d.getUTCMonth();
  const end = ym(to - 1);
  for (;;) { const s = `${y}-${String(m + 1).padStart(2, '0')}`; months.push(s); if (s >= end) break; m++; if (m > 11) { m = 0; y++; } }
  const sum = Object.fromEntries(months.map((s) => [s, 0]));
  for (const t of trades) { const s = ym(t.exitT); if (s in sum) sum[s] += t[key]; }
  const v = months.map((s) => sum[s]), n = v.length, mean = v.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  const t = sd > 0 ? mean / (sd / Math.sqrt(n)) : 0;
  return { months: n, t: +t.toFixed(3), p: +pTwo(t, n - 1).toFixed(5) };
}
const r4 = (x) => +x.toFixed(4);
const median = (xs) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export function summary(trades, from, to) {
  const n = trades.length, avg = (k) => (n ? trades.reduce((a, t) => a + t[k], 0) / n : 0);
  let eq = 0, hi = 0, dd = 0; for (const t of trades) { eq += t.net; hi = Math.max(hi, eq); dd = Math.min(dd, eq - hi); }
  return { n, win: n ? r4(trades.filter((t) => t.net > 0).length / n) : 0, gross: r4(avg('gross')), net: r4(avg('net')), net2: r4(avg('net2')),
    cost: r4(avg('cost')), fin: r4(avg('fin')), medStop: +median(trades.map((t) => t.dist)).toFixed(2),
    total: +trades.reduce((a, t) => a + t.net, 0).toFixed(2), maxDD: +dd.toFixed(2), longs: trades.filter((t) => t.side > 0).length,
    stops: trades.filter((t) => t.why === 'stop').length, avgBars: +avg('bars').toFixed(1), ...monthT(trades, from, to) };
}
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const costed = (trades, p) => trades.map((t) => { const r = rOf(t, 1, p), r2 = rOf(t, 2, p);
  return { ...t, gross: r.gross, cost: r.cost, fin: r.fin, nights: r.nights, net: r.net, net2: r2.net }; });
// placebo: every quarter's level moved by s x u x ATR(14) of the day before its first day, u in [1, 3], s a random sign
export function placeboLevels(bars, lev, seed, p = P) {
  const A = atr(bars, p.atrN), rnd = mulberry32(seed), out = new Map();
  for (const [q, x] of lev) { const a = A[x.first - 1] || A[x.first] || 0, u = 1 + 2 * rnd(), s = rnd() < 0.5 ? -1 : 1;
    out.set(q, { ...x, level: x.level + s * u * a }); }
  return out;
}

export function study(bars, p = P) {
  const end = bars[bars.length - 1].time + 86400, out = { tests: {} }, ps = [], lev = levels(bars, p);
  const placeLev = Array.from({ length: p.seeds }, (_, s) => placeboLevels(bars, lev, s + 1, p));
  for (const [id, T] of Object.entries(TESTS)) {
    const trades = costed(simulate(bars, lev, T.kind, p), p);
    const IS = trades.filter((t) => t.entryT >= p.start && t.entryT < p.isEnd), OOS = trades.filter((t) => t.entryT >= p.isEnd);
    const h1 = OOS.filter((t) => t.entryT < p.half), h2 = OOS.filter((t) => t.entryT >= p.half);
    const pl = placeLev.map((L) => { const o = costed(simulate(bars, L, T.kind, p), p).filter((t) => t.entryT >= p.isEnd);
      return o.length ? r4(o.reduce((a, t) => a + t.net, 0) / o.length) : 0; });
    const o = summary(OOS, p.isEnd, end);
    const side = (L, s) => { const x = L.filter((t) => t.side === s); return { n: x.length, net: x.length ? r4(x.reduce((a, t) => a + t.net, 0) / x.length) : 0 }; };
    out.tests[id] = { ...T, IS: summary(IS, p.start, p.isEnd), OOS: o, oosH1: summary(h1, p.isEnd, p.half), oosH2: summary(h2, p.half, end),
      sides: { IS: { long: side(IS, 1), short: side(IS, -1) }, OOS: { long: side(OOS, 1), short: side(OOS, -1) } },
      placebo: { seeds: pl, beaten: pl.filter((x) => o.net > x).length, median: r4(median(pl)) },
      openAtEnd: trades.filter((t) => t.why === 'open').length,
      trades: OOS.map((t) => [new Date(t.entryT * 1000).toISOString().slice(0, 10), t.side, +t.entry.toFixed(2), +t.dist.toFixed(2), +t.exit.toFixed(2), t.why, +t.net.toFixed(3)]) };
    ps.push(o.p);
  }
  const adj = holm(ps);
  Object.keys(TESTS).forEach((id, i) => {
    const x = out.tests[id]; x.holmP = +adj[i].toFixed(5);
    const checks = { oos: x.OOS.net > 0 && x.OOS.t >= 2 && x.holmP < 0.05, inSample: x.IS.net > 0, costs2x: x.OOS.net2 > 0,
      placebo: x.placebo.beaten >= 38, n: x.OOS.n >= 30 };
    x.checks = checks; x.pass = Object.values(checks).every(Boolean);
  });
  out.window = { is: '2007-01-01..2016-12-31', oos: `2017-01-01..${new Date((end - 86400) * 1000).toISOString().slice(0, 10)}`, candles: bars.length, quarters: lev.size };
  out.pass = out.tests.T1.pass;
  out.secondary = ['T2', 'T3'].filter((id) => out.tests[id].pass);
  return out;
}

const here = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'xau.json'), execFileSync('git', ['show', 'origin/council-data:research/daily/xau.json'], { maxBuffer: 1 << 26 }));
    console.log('wrote', path.join(dir, 'xau.json'));
  } else if (cmd === 'full') {
    const f = JSON.parse(fs.readFileSync(path.join(dir, 'xau.json'), 'utf8'));
    const bars = barsOf(f.rows, Date.parse(f.updated) / 1000);
    const r = study(bars);
    const res = { topic: 'gold-quarter-open', built: '2026-11-14', data: `council-data research/daily/xau.json (${f.src}, updated ${f.updated})`,
      verdict: r.pass ? 'PASS' : 'FAIL', ...r };
    fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(res, null, 1) + '\n');
    for (const [id, x] of Object.entries(r.tests)) console.log(id, x.name, '\nIS', JSON.stringify(x.IS), '\nOOS', JSON.stringify(x.OOS), '\nH1', x.oosH1.net, x.oosH1.n, 'H2', x.oosH2.net, x.oosH2.n,
      'sides', JSON.stringify(x.sides), '\nholm', x.holmP, 'placebo', x.placebo.beaten, 'med', x.placebo.median, 'pass', x.pass, JSON.stringify(x.checks));
    console.log(r.window, 'verdict', res.verdict, 'secondary', r.secondary);
  } else console.log('usage: run.mjs fetch|full <dir>');
}
