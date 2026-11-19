// Gold: the Asian session after the New York cash session (PREREGISTRATION.md, pushed before any trade was computed).
// A new stand-alone intraday rule, NOT a gate, exit, entry or size of the gold book (item 44 respected). Paper research only.
//   node --use-env-proxy research/edge/gold-us-asia/run.mjs fetch <dir>   OANDA mid M15 gold from June 2006 via the site's proxy
//   node research/edge/gold-us-asia/run.mjs full <dir>                   the study -> result.json (+ prints the tables)
// Pure pieces are exported for tests/gold-us-asia.test.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { nights } from '../../../council/fills.mjs';

export const M = 900, H = 3600, D = 86400, COST = 0.30, LOOK = 20, ATR_N = 20, SEEDS = 40;
export const ASIA = { from: 0, to: 7 * H };   // seconds from 00:00 UTC of D
export const TESTS = {
  T1: { name: 'Fade the NY move in Asia (|NY| >= 0.5x its 20-day median)', dir: -1, min: 0.5, strict: false, nMin: 200 },
  T2: { name: 'Follow the NY move in Asia (|NY| >= 0.5x its 20-day median)', dir: 1, min: 0.5, strict: false, nMin: 200 },
  T3: { name: 'Fade, big NY days only (|NY| > 1.5x its 20-day median)', dir: -1, min: 1.5, strict: true, nMin: 100 },
};
export const WIN = { decisive: ['2016-01-01', '2099-12-31'], replication: ['2006-01-01', '2015-12-31'] };

export const ymd = (d) => new Date(d * D * 1000).toISOString().slice(0, 10);
const nthSunday = (y, mo, n) => { const f = new Date(Date.UTC(y, mo, 1)).getUTCDay(); return Date.UTC(y, mo, 1 + ((7 - f) % 7) + 7 * (n - 1)) / 1000; };
const lastSunday = (y, mo) => { const l = new Date(Date.UTC(y, mo + 1, 0)); return Date.UTC(y, mo, l.getUTCDate() - l.getUTCDay()) / 1000; };
// US daylight time at unix t, by the rule in force that year; switches at 02:00 local (07:00 UTC on, 06:00 UTC off)
export function usDst(t) {
  const y = new Date(t * 1000).getUTCFullYear();
  const on = (y >= 2007 ? nthSunday(y, 2, 2) : nthSunday(y, 3, 1)) + 7 * H, off = (y >= 2007 ? nthSunday(y, 10, 1) : lastSunday(y, 9)) + 6 * H;
  return t >= on && t < off;
}
export const nyOff = (t) => (usDst(t) ? 4 : 5);   // hours behind UTC
// the NY cash session of UTC date d (days since 1970): 09:30 -> 16:00 New York
export function nySession(d) { const o = nyOff(d * D + 12 * H); return { start: d * D + (9.5 + o) * H, end: d * D + (16 + o) * H }; }
export const isWeekday = (d) => { const w = new Date(d * D * 1000).getUTCDay(); return w >= 1 && w <= 5; };
export function isTradeDay(d) { if (!isWeekday(d)) return false; const x = new Date(d * D * 1000), m = x.getUTCMonth(), dd = x.getUTCDate(); return !(m === 11 && dd === 25) && !(m === 0 && dd === 1); }
export const prevWeekday = (d) => { let p = d - 1; while (!isWeekday(p)) p--; return p; };
// NY move of day d: { d, start, end, open, close, move } or null
export function nyMove(byTime, d) {
  const s = nySession(d), a = byTime.get(s.start), b = byTime.get(s.end - M);
  return a && b ? { d, start: s.start, end: s.end, open: a.open, close: b.close, move: b.close - a.open } : null;
}
// New York trading days (17:00 -> 17:00 NY), labelled by the weekday they end: [{ end, high, low, close }]
export function nyDays(m15) {
  const map = new Map();
  for (const b of m15) {
    const o = nyOff(b.time), local = b.time - o * H, ld = Math.floor(local / D), lh = (local - ld * D) / H;
    const lab = lh >= 17 ? ld + 1 : ld; if (!isWeekday(lab)) continue;
    let x = map.get(lab); if (!x) { x = { lab, high: -Infinity, low: Infinity, close: null, last: 0 }; map.set(lab, x); }
    x.high = Math.max(x.high, b.high); x.low = Math.min(x.low, b.low); if (b.time >= x.last) { x.last = b.time; x.close = b.close; }
  }
  return [...map.values()].sort((a, b) => a.lab - b.lab).map((x) => ({ lab: x.lab, end: x.lab * D + (17 + nyOff(x.lab * D + 12 * H)) * H, high: x.high, low: x.low, close: x.close }));
}
// ATR over the last n days that ENDED at or before t (null with fewer than n + 1 days)
export function atrAt(days, t, n = ATR_N) {
  let lo = 0, hi = days.length - 1, j = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (days[m].end <= t) { j = m; lo = m + 1; } else hi = m - 1; }
  if (j < n) return null; let s = 0;
  for (let k = j - n + 1; k <= j; k++) { const c0 = days[k - 1].close, x = days[k]; s += Math.max(x.high - x.low, Math.abs(x.high - c0), Math.abs(x.low - c0)); }
  return s / n;
}
export const median = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
// M15 candles of the Asian window of day d (holes not read); null without the 00:00 and the 06:45 candle
export function asiaCandles(byTime, d) {
  const t0 = d * D + ASIA.from, t1 = d * D + ASIA.to; if (!byTime.get(t0) || !byTime.get(t1 - M)) return null;
  const out = []; for (let t = t0; t < t1; t += M) { const b = byTime.get(t); if (b) out.push(b); } return out;
}
// one trade: entry at the first candle's open, stop first, a gap through fills at the open, out at the last close
export function simulate(cs, side, dist) {
  const entry = cs[0].open, stop = entry - side * dist; let exit = cs.at(-1).close, how = 'time';
  for (const b of cs) {
    if (side > 0 && b.low <= stop) { exit = Math.min(b.open, stop); how = 'stop'; break; }
    if (side < 0 && b.high >= stop) { exit = Math.max(b.open, stop); how = 'stop'; break; }
  }
  return { entry, stop, exit, how, R: side * (exit - entry) / dist };
}
// candidate days: each trade day with its preceding NY move, the 20-session median, the ATR stop and the Asian candles
export function candidates(m15) {
  const byTime = new Map(m15.map((b) => [b.time, b])), days = nyDays(m15), d0 = Math.floor(m15[0].time / D), d1 = Math.floor(m15.at(-1).time / D);
  const moves = new Map(), hist = [], out = [], skip = { noNy: 0, look: 0, noAsia: 0, noAtr: 0, flat: 0 };
  for (let d = d0; d <= d1; d++) { if (!isWeekday(d)) continue; const m = nyMove(byTime, d); if (m) moves.set(d, m); }
  const order = [...moves.keys()].sort((a, b) => a - b), idx = new Map(order.map((d, i) => [d, i]));
  for (let d = d0 + 1; d <= d1; d++) {
    if (!isTradeDay(d)) continue; const p = prevWeekday(d), ny = moves.get(p);
    if (!ny) { skip.noNy++; continue; }
    const i = idx.get(p); if (i < LOOK) { skip.look++; continue; }
    const med = median(order.slice(i - LOOK, i).map((k) => Math.abs(moves.get(k).move)));
    const cs = asiaCandles(byTime, d); if (!cs) { skip.noAsia++; continue; }
    const dist = atrAt(days, cs[0].time); if (!(dist > 0)) { skip.noAtr++; continue; }
    if (ny.move === 0) { skip.flat++; continue; }
    const nyNext = byTime.get(d * D), gapEnd = nyNext ? nyNext.open : null;
    out.push({ d, ny, med, ratio: med > 0 ? Math.abs(ny.move) / med : Infinity, dist, cs, overnight: gapEnd != null ? gapEnd - ny.close : null });
    hist.push(d);
  }
  return { cands: out, skip, nyDays: days.length, nySessions: moves.size };
}
export function keepFor(te, c) { return te.strict ? c.ratio > te.min : c.ratio >= te.min; }
export function trades(cands, te, cost = COST) {
  const out = [];
  for (const c of cands) { if (!keepFor(te, c)) continue; const side = te.dir * Math.sign(c.ny.move), tr = simulate(c.cs, side, c.dist);
    const nn = nights(c.cs[0].time, c.cs.at(-1).time + M); if (nn !== 0) throw new Error('a 00:00 -> 07:00 UTC hold crossed a rollover');
    out.push({ d: c.d, side, dist: c.dist, ...tr, nights: nn, net: tr.R - cost / c.dist }); }
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
export function monthSums(T, from, to, key = 'net') {
  const m = new Map(); let [y, mo] = from.split('-').map(Number); const [y1, m1] = to.split('-').map(Number);
  while (y < y1 || (y === y1 && mo <= m1)) { m.set(`${y}-${String(mo).padStart(2, '0')}`, 0); if (++mo > 12) { mo = 1; y++; } }
  for (const x of T) { const k = ymd(x.d).slice(0, 7); if (m.has(k)) m.set(k, m.get(k) + x[key]); } return [...m.values()];
}
export function monthT(ms) { const n = ms.length, mm = ms.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(ms.reduce((a, b) => a + (b - mm) ** 2, 0) / (n - 1)); return sd > 0 ? mm / (sd / Math.sqrt(n)) : 0; }
export function stats(T, from, to) {
  const n = T.length, s = T.reduce((a, x) => a + x.net, 0), g = T.reduce((a, x) => a + x.R, 0);
  let eq = 0, pk = 0, dd = 0; for (const x of T) { eq += x.net; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  const ms = monthSums(T, from, to), t = monthT(ms), tg = monthT(monthSums(T, from, to, 'R'));
  return { n, buys: T.filter((x) => x.side > 0).length, sells: T.filter((x) => x.side < 0).length,
    gross: n ? +(g / n).toFixed(4) : 0, avg: n ? +(s / n).toFixed(4) : 0, total: +s.toFixed(2),
    avgX2: n ? +((s - T.reduce((a, x) => a + COST / x.dist, 0)) / n).toFixed(4) : 0,
    wr: n ? +(T.filter((x) => x.net > 0).length / n * 100).toFixed(1) : null, stopped: T.filter((x) => x.how === 'stop').length,
    dd: +dd.toFixed(2), months: ms.length, tGross: +tg.toFixed(2), t: +t.toFixed(2), p: +(1 - tCdf(t, ms.length - 1)).toFixed(4),
    medStop: n ? +median(T.map((x) => x.dist)).toFixed(2) : null };
}
// Holm step-down adjusted p: { id: p } -> { id: adjusted p }
export function holmAdj(ps) {
  const e = Object.entries(ps).sort((a, b) => a[1] - b[1]), m = e.length, out = {}; let run = 0;
  e.forEach(([k, p], i) => { run = Math.max(run, Math.min(1, (m - i) * p)); out[k] = +run.toFixed(4); }); return out;
}
export function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function pctl(a, q) { const s = [...a].sort((x, y) => x - y), i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); }
// random-sign placebo: same days, entry, stop and exit; side drawn at random per trade
export function placebo(cs, seeds = SEEDS) {
  const res = [];
  for (let s = 1; s <= seeds; s++) { const rnd = mulberry32(s); let sum = 0;
    for (const c of cs) { const side = rnd() < 0.5 ? 1 : -1, tr = simulate(c.cs, side, c.dist); sum += tr.R - COST / c.dist; }
    res.push(cs.length ? sum / cs.length : 0); }
  return res;
}
export function corr(x, y) { const n = x.length; if (n < 3) return null; const mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sx = 0, sy = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sx += (x[i] - mx) ** 2; sy += (y[i] - my) ** 2; } return sx > 0 && sy > 0 ? sxy / Math.sqrt(sx * sy) : null; }

export function study(m15, opt = {}) {
  const { cands, skip, nyDays: nd, nySessions } = candidates(m15), endDay = ymd(Math.floor(m15.at(-1).time / D)), seeds = opt.seeds ?? SEEDS;
  const startDay = ymd(Math.floor(m15[0].time / D));
  const win = { decisive: [WIN.decisive[0], endDay], replication: [startDay > WIN.replication[0] ? startDay : WIN.replication[0], WIN.replication[1]] };
  const inW = (A, [f, t]) => A.filter((x) => ymd(x.d) >= f && ymd(x.d) <= t);
  const out = { tests: {} };
  for (const [id, te] of Object.entries(TESTS)) {
    const T = trades(cands, te), row = { name: te.name, nMin: te.nMin };
    for (const [k, w] of Object.entries(win)) {
      row[k] = stats(inW(T, w), w[0], w[1]);
      const P = placebo(inW(cands, w).filter((c) => keepFor(te, c)), seeds);
      row[k].placebo = { seeds: P.length, p5: +pctl(P, 0.05).toFixed(4), p50: +pctl(P, 0.5).toFixed(4), p95: +pctl(P, 0.95).toFixed(4), rank: P.filter((a) => row[k].avg > a).length };
    }
    row.years = {}; for (let y = +startDay.slice(0, 4); y <= +endDay.slice(0, 4); y++) { const r = inW(T, [`${y}-01-01`, `${y}-12-31`]); if (r.length) row.years[y] = { n: r.length, total: +r.reduce((a, x) => a + x.net, 0).toFixed(2) }; }
    out.tests[id] = row;
  }
  const adj = holmAdj(Object.fromEntries(Object.entries(out.tests).map(([k, r]) => [k, r.decisive.p])));
  for (const [id, row] of Object.entries(out.tests)) {
    row.holmP = adj[id];
    const c = { decisivePositive: row.decisive.avg > 0, replicationPositive: row.replication.avg > 0, holm: adj[id] < 0.05,
      nDecisive: row.decisive.n >= row.nMin, nReplication: row.replication.n >= row.nMin };
    row.checks = c; row.pass = Object.values(c).every(Boolean);
  }
  out.verdict = Object.values(out.tests).some((r) => r.pass) ? 'PASS' : 'FAIL';
  out.passed = Object.values(out.tests).filter((r) => r.pass).length;
  out.descriptive = {};
  for (const [k, w] of Object.entries(win)) { const C = inW(cands, w), A = C.map((c) => (c.cs.at(-1).close - c.cs[0].open) / c.dist), N = C.map((c) => c.ny.move / c.dist);
    const G = C.filter((c) => c.overnight != null);
    const r3 = (v) => (v == null ? null : +v.toFixed(3));
    out.descriptive[k] = { n: C.length, nyVsAsia: r3(corr(N, A)), nyVsOvernight: r3(corr(G.map((c) => c.ny.move / c.dist), G.map((c) => c.overnight / c.dist))), nOvernight: G.length }; }
  out.data = { from: startDay, to: endDay, m15: m15.length, nySessions, nyDays: nd, candidates: cands.length, skipped: skip, src: 'OANDA mid M15 XAU_USD via the site proxy (/md/bars)' };
  out.windows = win;
  out.financing = { nights: nights(0, 7 * H), rule: 'council/fills.mjs nights: rollovers at 22:00 UTC; a 00:00 -> 07:00 UTC hold crosses none' };
  return out;
}

async function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  let from = Math.floor(Date.parse('2006-01-01') / 1000); const now = Math.floor(Date.now() / 1000), all = [];
  while (from < now) { const to = Math.min(now, from + 4990 * M); let j, ok = false;
    for (let k = 0; k < 4 && !ok; k++) { try { const r = await fetch(`https://meridianx.dev/md/bars?sym=xau&tf=15m&from=${from}&to=${to}`); j = await r.json(); ok = r.ok; } catch (e) { j = { error: String(e) }; } if (!ok) await new Promise((s) => setTimeout(s, 8000)); }
    if (!ok) throw new Error(`proxy ${j && j.error}`);
    for (const b of j.bars || []) if (!b.live) all.push([b.time, b.open, b.high, b.low, b.close]);
    process.stderr.write(`${new Date(from * 1000).toISOString().slice(0, 10)} ${all.length}\n`); from = to; await new Promise((s) => setTimeout(s, 2200)); }
  const seen = new Set(), rows = all.filter((x) => !seen.has(x[0]) && seen.add(x[0])).sort((a, b) => a[0] - b[0]);
  fs.writeFileSync(path.join(dir, 'xau-m15.json'), JSON.stringify(rows));
}

function full(dir) {
  const m15 = JSON.parse(fs.readFileSync(path.join(dir, 'xau-m15.json'), 'utf8')).map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
  const r = study(m15);
  r.built = new Date().toISOString().slice(0, 10);
  r.note = 'A new stand-alone intraday rule, not a gate, exit, entry or size of the gold book (item 44). Paper research only.';
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(r, null, 1) + '\n');
  for (const [id, row] of Object.entries(r.tests)) {
    console.log(`\n${id} ${row.name}  holm ${row.holmP} pass ${row.pass} ${JSON.stringify(row.checks)}`);
    for (const k of ['decisive', 'replication']) { const x = row[k]; console.log(`  ${k.padEnd(11)} n ${x.n} (${x.buys}/${x.sells}) gross ${x.gross} net ${x.avg} x2 ${x.avgX2} total ${x.total} wr ${x.wr} stopped ${x.stopped} dd ${x.dd} tG ${x.tGross} t ${x.t} p ${x.p} stop ${x.medStop} | placebo ${x.placebo.p5}/${x.placebo.p50}/${x.placebo.p95} rank ${x.placebo.rank}`); }
  }
  console.log('\nverdict', r.verdict, JSON.stringify(r.descriptive), JSON.stringify(r.data));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') await fetchAll(dir); else if (cmd === 'full') full(dir); else console.log('usage: run.mjs fetch|full <dir>');
}
