// Gold session drift (PREREGISTRATION.md, pushed before any trade was computed).
// A new stand-alone intraday rule, NOT a gate, exit, entry or size of the gold book (item 44 respected). Paper research only.
//   node --use-env-proxy research/edge/gold-session-drift/run.mjs fetch <dir>   OANDA mid H1 gold from 2006 via the site's proxy
//   node research/edge/gold-session-drift/run.mjs full <dir>                   the study -> result.json (+ prints the tables)
// Pure pieces are exported for tests/gold-session-drift.test.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { nights, FIN } from '../../../council/fills.mjs';

export const H = 3600, D = 86400, COST = 0.30, STOP_X = 1.5, LOOK = 20, SMA_N = 50, LEN = 8, SEEDS = 40;
// a test: side +1 long / -1 short; off = the window's start in hours from 00:00 UTC of day D (the exit date); trend filter
export const TESTS = {
  T1: { name: 'Session short 13:00 -> 21:00 UTC', side: -1, off: 13, trend: false, test: true },
  T2: { name: 'Session long 23:00 -> 07:00 UTC, trend on (close > 50-day average)', side: 1, off: -1, trend: true, test: true },
  T3: { name: 'Session short 13:00 -> 21:00 UTC, trend on (close < 50-day average)', side: -1, off: 13, trend: true, test: true },
  R0: { name: 'Reference only: session long 23:00 -> 07:00 UTC, every day (the seasonality H5 window, not a test)', side: 1, off: -1, trend: false, test: false },
};
export const WIN = { decisive: ['2020-01-01', '2099-12-31'], replication: ['2008-01-01', '2019-12-31'] };

export const ymd = (d) => new Date(d * D * 1000).toISOString().slice(0, 10);
// a trade day D (days since 1970, UTC): Monday-Friday, not 25 December or 1 January
export function isTradeDay(d) {
  const x = new Date(d * D * 1000), w = x.getUTCDay(), m = x.getUTCMonth(), dd = x.getUTCDate();
  return w >= 1 && w <= 5 && !(m === 11 && dd === 25) && !(m === 0 && dd === 1);
}
// the LEN H1 candles of the window starting at `start` (unix), or null if any is missing
export function windowAt(byTime, start, len = LEN) {
  const out = []; for (let k = 0; k < len; k++) { const b = byTime.get(start + k * H); if (!b) return null; out.push(b); } return out;
}
// daily closes: the close of the 20:00 UTC candle of each weekday, known at its end (21:00 UTC)
export function dailyCloses(h1) {
  const out = []; for (const b of h1) { if (b.time % D !== 20 * H) continue; const w = new Date(b.time * 1000).getUTCDay(); if (w >= 1 && w <= 5) out.push({ end: b.time + H, close: b.close }); } return out;
}
// the latest daily close that ENDED at or before t, and the mean of the SMA_N closes up to it (null with fewer)
export function trendAt(dc, t, n = SMA_N) {
  let lo = 0, hi = dc.length - 1, j = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (dc[m].end <= t) { j = m; lo = m + 1; } else hi = m - 1; }
  if (j < n - 1) return null; let s = 0; for (let k = j - n + 1; k <= j; k++) s += dc[k].close;
  return { close: dc[j].close, sma: s / n, end: dc[j].end };
}
export const median = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
// one trade over its window: entry at the first candle's open, stop first, a gap through fills at the candle's open
export function simulate(cs, side, dist) {
  const entry = cs[0].open, stop = entry - side * dist; let exit = cs.at(-1).close, how = 'time';
  for (const b of cs) {
    if (side > 0 && b.low <= stop) { exit = Math.min(b.open, stop); how = 'stop'; break; }
    if (side < 0 && b.high >= stop) { exit = Math.max(b.open, stop); how = 'stop'; break; }
  }
  return { entry, stop, exit, how, R: side * (exit - entry) / dist };
}
// every complete session of one window offset, in date order: { d, start, end, cs, range }
export function sessions(byTime, d0, d1, off) {
  const out = [];
  for (let d = d0; d <= d1; d++) { if (!isTradeDay(d)) continue; const start = d * D + off * H, cs = windowAt(byTime, start); if (!cs) continue;
    out.push({ d, start, end: start + LEN * H, cs, range: Math.max(...cs.map((b) => b.high)) - Math.min(...cs.map((b) => b.low)) }); }
  return out;
}
// the trades of one window offset and side on the given sessions; filter(s) -> keep; stop = STOP_X x median of the LOOK before
export function trades(ss, side, keep = () => true, cost = COST) {
  const out = [];
  for (let i = LOOK; i < ss.length; i++) { const s = ss[i]; if (!keep(s)) continue;
    const dist = STOP_X * median(ss.slice(i - LOOK, i).map((x) => x.range)); if (!(dist > 0)) continue;
    const tr = simulate(s.cs, side, dist), nn = side > 0 ? nights(s.start, s.end) : 0, fin = nn * FIN.xau.long * tr.entry / dist;
    out.push({ d: s.d, start: s.start, side, dist, ...tr, nights: nn, fin, net: tr.R - cost / dist - fin }); }
  return out;
}
// Student t CDF (regularized incomplete beta, continued fraction)
function betacf(a, b, x) { let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d; let h = d;
  for (let m = 1; m <= 300; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-12) break; } return h; }
function lgamma(z) { const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = z, y = z, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (const c of g) s += c / ++y; return -t + Math.log(2.5066282746310005 * s / x); }
function ibeta(a, b, x) { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
export function tCdf(t, df) { const x = df / (df + t * t), p = 0.5 * ibeta(df / 2, 0.5, x); return t >= 0 ? 1 - p : p; }
// monthly sums over every calendar month of [from, to] (0 for a month with no trade)
export function monthSums(T, from, to) {
  const m = new Map(); let [y, mo] = from.split('-').map(Number); const [y1, m1] = to.split('-').map(Number);
  while (y < y1 || (y === y1 && mo <= m1)) { m.set(`${y}-${String(mo).padStart(2, '0')}`, 0); if (++mo > 12) { mo = 1; y++; } }
  for (const x of T) { const k = ymd(x.d).slice(0, 7); if (m.has(k)) m.set(k, m.get(k) + x.net); } return [...m.values()];
}
export function stats(T, from, to) {
  const n = T.length, s = T.reduce((a, x) => a + x.net, 0), avg = n ? s / n : 0, g = n ? T.reduce((a, x) => a + x.R, 0) / n : 0;
  let eq = 0, pk = 0, dd = 0; for (const x of T) { eq += x.net; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  const ms = monthSums(T, from, to), M = ms.length, mm = ms.reduce((a, b) => a + b, 0) / M, sd = Math.sqrt(ms.reduce((a, b) => a + (b - mm) ** 2, 0) / (M - 1));
  const t = sd > 0 ? mm / (sd / Math.sqrt(M)) : 0;
  return { n, avg: +avg.toFixed(4), gross: +g.toFixed(4), total: +s.toFixed(2), wr: n ? +(T.filter((x) => x.net > 0).length / n * 100).toFixed(1) : null,
    stopped: T.filter((x) => x.how === 'stop').length, dd: +dd.toFixed(2), months: M, t: +t.toFixed(2), p: +(1 - tCdf(t, M - 1)).toFixed(4),
    avgX2: n ? +((s - T.reduce((a, x) => a + COST / x.dist, 0)) / n).toFixed(4) : 0, nights: T.reduce((a, x) => a + x.nights, 0) };
}
// Holm step-down: { id: p } -> { id: pass }
export function holm(ps, alpha = 0.05) {
  const e = Object.entries(ps).sort((a, b) => a[1] - b[1]), out = {}, m = e.length; let go = true;
  e.forEach(([k, p], i) => { if (go && p <= alpha / (m - i)) out[k] = true; else { go = false; out[k] = false; } }); return out;
}
export function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function pctl(a, q) { const s = [...a].sort((x, y) => x - y), i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); }
const ownHour = (off) => ((off % 24) + 24) % 24;
// placebo: per seed, each of the test's days gets a random start hour (not the test's own) on day D; same side, stop rule, fills, cost
export function placebo(test, days, byOff, seeds = SEEDS) {
  const own = ownHour(test.off), hours = [...Array(24).keys()].filter((h) => h !== own), res = [];
  const idx = {}; for (const h of hours) { idx[h] = new Map(byOff[h].map((s, i) => [s.d, i])); }
  for (let s = 1; s <= seeds; s++) { const rnd = mulberry32(s); let sum = 0, n = 0, skip = 0;
    for (const d of days) { const h = hours[Math.floor(rnd() * hours.length)], i = idx[h].get(d);
      if (i == null || i < LOOK) { skip++; continue; }
      const T = trades(byOff[h].slice(i - LOOK, i + 1), test.side); if (!T.length) { skip++; continue; } sum += T[0].net; n++; }
    res.push({ seed: s, n, skip, avg: n ? +(sum / n).toFixed(4) : 0 }); }
  return res;
}

export function study(h1, opt = {}) {
  const byTime = new Map(h1.map((b) => [b.time, b])), d0 = Math.floor(h1[0].time / D) + 1, d1 = Math.floor(h1.at(-1).time / D);
  const dc = dailyCloses(h1), endDay = ymd(d1), seeds = opt.seeds ?? SEEDS;
  const win = { decisive: [WIN.decisive[0], endDay], replication: WIN.replication };
  const inW = (T, [f, t]) => T.filter((x) => ymd(x.d) >= f && ymd(x.d) <= t);
  const S = {}, out = { tests: {}, ref: {} };
  for (const [id, te] of Object.entries(TESTS)) {
    const ss = S[te.off] || (S[te.off] = sessions(byTime, d0, d1, te.off));
    const keep = te.trend ? (s) => { const tr = trendAt(dc, s.start); return !!tr && (te.side > 0 ? tr.close > tr.sma : tr.close < tr.sma); } : () => true;
    const T = trades(ss, te.side, keep), row = { name: te.name, side: te.side > 0 ? 'long' : 'short', trend: te.trend, all: T };
    for (const [k, w] of Object.entries(win)) row[k] = stats(inW(T, w), w[0], w[1]);
    row.years = {}; for (let y = 2008; y <= +endDay.slice(0, 4); y++) { const r = inW(T, [`${y}-01-01`, `${y}-12-31`]); if (r.length) row.years[y] = { n: r.length, total: +r.reduce((a, x) => a + x.net, 0).toFixed(2) }; }
    row.complete = ss.length;
    (te.test ? out.tests : out.ref)[id] = row;
  }
  // placebo on the decisive window
  const byOff = {}; for (let h = 0; h < 24; h++) byOff[h] = S[h] || sessions(byTime, d0, d1, h);
  for (const [id, row] of Object.entries(out.tests)) {
    const te = TESTS[id], days = inW(row.all, win.decisive).map((x) => x.d), P = placebo(te, days, byOff, seeds), avgs = P.map((x) => x.avg);
    row.placebo = { seeds: P.length, p95: +pctl(avgs, 0.95).toFixed(4), median: +pctl(avgs, 0.5).toFixed(4), max: +Math.max(...avgs).toFixed(4), above: avgs.filter((a) => row.decisive.avg > a).length, runs: P };
  }
  const H_ = holm(Object.fromEntries(Object.entries(out.tests).map(([k, r]) => [k, r.decisive.p])));
  for (const [id, row] of Object.entries(out.tests)) {
    const c = { decisivePositive: row.decisive.avg > 0, decisiveT2: row.decisive.t >= 2, sameSign: row.replication.avg > 0, holm: H_[id], placebo: row.decisive.avg > row.placebo.p95 };
    row.checks = c; row.pass = Object.values(c).every(Boolean);
  }
  out.verdict = Object.values(out.tests).some((r) => r.pass) ? 'PASS' : 'FAIL';
  out.passed = Object.values(out.tests).filter((r) => r.pass).length;
  out.data = { from: ymd(d0), to: endDay, h1: h1.length, dailyCloses: dc.length, src: 'OANDA mid H1 XAU_USD via the site proxy (/md/bars)' };
  out.windows = win;
  out.financing = { T1: nights(13 * H, 21 * H), T2: nights(-1 * H, 7 * H), rule: 'council/fills.mjs nights: rollovers at 22:00 UTC' };
  return out;
}

async function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  let from = Math.floor(Date.parse('2006-01-01') / 1000); const now = Math.floor(Date.now() / 1000), all = [];
  while (from < now) { const to = Math.min(now, from + 4990 * H);
    const r = await fetch(`https://meridianx.dev/md/bars?sym=xau&tf=1h&from=${from}&to=${to}`); const j = await r.json();
    if (!r.ok) throw new Error(`proxy ${r.status} ${j.error || ''}`);
    for (const b of j.bars || []) if (!b.live) all.push([b.time, b.open, b.high, b.low, b.close]);
    process.stderr.write(`${new Date(from * 1000).toISOString().slice(0, 10)} ${all.length}\n`); from = to; await new Promise((s) => setTimeout(s, 2200)); }
  const seen = new Set(), rows = all.filter((x) => !seen.has(x[0]) && seen.add(x[0])).sort((a, b) => a[0] - b[0]);
  fs.writeFileSync(path.join(dir, 'xau-h1.json'), JSON.stringify(rows));
}

function full(dir) {
  const h1 = JSON.parse(fs.readFileSync(path.join(dir, 'xau-h1.json'), 'utf8')).map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
  const r = study(h1), slim = JSON.parse(JSON.stringify(r));
  for (const g of [slim.tests, slim.ref]) for (const row of Object.values(g)) delete row.all;
  slim.built = new Date().toISOString().slice(0, 10);
  slim.note = 'A new stand-alone intraday rule, not a gate, exit, entry or size of the gold book (item 44). Paper research only.';
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(slim, null, 1) + '\n');
  for (const [id, row] of [...Object.entries(slim.tests), ...Object.entries(slim.ref)]) {
    console.log(`\n${id} ${row.name}`);
    for (const k of ['decisive', 'replication']) { const x = row[k]; console.log(`  ${k.padEnd(11)} n ${x.n} net ${x.avg} gross ${x.gross} x2 ${x.avgX2} total ${x.total} wr ${x.wr} stopped ${x.stopped} dd ${x.dd} t ${x.t} p ${x.p}`); }
    if (row.placebo) console.log(`  placebo p95 ${row.placebo.p95} median ${row.placebo.median} max ${row.placebo.max} above ${row.placebo.above}/40 | checks ${JSON.stringify(row.checks)} pass ${row.pass}`);
  }
  console.log('\nverdict', slim.verdict, 'financing nights', JSON.stringify(slim.financing));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') await fetchAll(dir); else if (cmd === 'full') full(dir); else console.log('usage: run.mjs fetch|full <dir>');
}
