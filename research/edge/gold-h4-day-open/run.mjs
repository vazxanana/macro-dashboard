// The first H4 candle of the New York day as gold's direction for the rest of the day (PREREGISTRATION.md, pushed first).
//   node --use-env-proxy research/edge/gold-h4-day-open/run.mjs fetch <dir>   OANDA mid H1 gold -> <dir>/xau-h1.json (keep out of git)
//   node research/edge/gold-h4-day-open/run.mjs full <dir>                    the study -> result.json (+ prints a summary)
// A stand-alone intraday rule: never a gate, exit, entry or size of the live gold book. Pure pieces are exported for the test.
import fs from 'node:fs';
import path from 'node:path';
import { nights, FIN } from '../../../council/fills.mjs';
import { nyOffsetH } from '../../../council/histdata.mjs';

export const H = 3600, DAY = 86400;
export const SPREAD = 0.30, SLIP = SPREAD / 2, RT = SPREAD + 2 * SLIP;   // $0.60 a round trip
export const ATR_N = 20, SMA_N = 20, STOP_ATR = 1, B1 = 0.1, B2 = 0.3;
export const WIN = { is: ['2007-01-01', '2016-12-31'], oos: ['2017-01-01', '2026-10-31'] };
export const SEED = 20261114, SEEDS = 40;

// New York day key (days since epoch of the New York calendar day the 17:00 session ends on) and New York start hour
export function nyOf(t) {
  const loc = t - nyOffsetH(t) * H;
  return { key: Math.floor((loc + 7 * H) / DAY), hour: Math.floor((((loc % DAY) + DAY) % DAY) / H) };
}
// H1 rows [t,o,h,l,c] -> New York days { key, bars: [{t,o,h,l,c,hr}], high, low, close }
export function toDays(h1) {
  const m = new Map();
  for (const [t, o, h, l, c] of h1) { const { key, hour } = nyOf(t); if (!m.has(key)) m.set(key, []); m.get(key).push({ t, o, h, l, c, hr: hour }); }
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([key, bars]) => ({
    key, bars, high: Math.max(...bars.map((x) => x.h)), low: Math.min(...bars.map((x) => x.l)), close: bars.at(-1).c }));
}
export const ymdKey = (k) => new Date(k * DAY * 1000).toISOString().slice(0, 10);
const firstH4 = (b) => b.hr >= 17 && b.hr <= 20;

// the setup of day i, read from day i's first H4 and the days before only; null when the day is not usable
export function setup(D, i) {
  if (i < ATR_N + 1) return null;
  const d = D[i], f = d.bars.filter(firstH4), rest = d.bars.filter((b) => !firstH4(b));
  if (f.length < 2 || rest.length < 8 || d.bars.length < 15) return null;
  if (rest.some((b, j) => j && b.t <= rest[j - 1].t) || rest[0].t <= f.at(-1).t) return null;
  let s = 0, sm = 0;
  for (let j = i - ATR_N; j < i; j++) s += Math.max(D[j].high, D[j - 1].close) - Math.min(D[j].low, D[j - 1].close);
  for (let j = i - SMA_N; j < i; j++) sm += D[j].close;
  const atr = s / ATR_N, body = f.at(-1).c - f[0].o, trend = Math.sign(D[i - 1].close - sm / SMA_N);
  return { i, day: ymdKey(d.key), atr, body, trend, rest };
}
export const TESTS = {
  T1: { name: 'T1 follow the first H4 (|body| >= 0.1 ATR)', side: (s) => (Math.abs(s.body) >= B1 * s.atr ? Math.sign(s.body) : 0) },
  T2: { name: 'T2 fade a large first H4 (|body| >= 0.3 ATR)', side: (s) => (Math.abs(s.body) >= B2 * s.atr ? -Math.sign(s.body) : 0) },
  T3: { name: 'T3 follow the first H4 when it agrees with the 20-day trend', side: (s) => (Math.abs(s.body) >= B1 * s.atr && Math.sign(s.body) === s.trend ? Math.sign(s.body) : 0) },
};
// one trade on the day's bars from 21:00 New York: entry at the first open, stop 1 ATR, out at the last close; stop first
export function simulate(s, side) {
  const r = s.rest, entry = r[0].o, risk = STOP_ATR * s.atr, stop = entry - side * risk;
  let exit = null, how = 'time', j = 0;
  for (; j < r.length; j++) {
    const x = r[j];
    if (side > 0 ? x.l <= stop : x.h >= stop) { exit = side > 0 ? Math.min(x.o, stop) : Math.max(x.o, stop); how = 'stop'; break; }
  }
  if (exit == null) { j = r.length - 1; exit = r[j].c; }
  const entryT = r[0].t, exitT = r[j].t + H, gross = side * (exit - entry) / risk, nn = side > 0 ? nights(entryT, exitT) : 0;
  const cost = RT / risk, fin = side > 0 ? nn * FIN.xau.long * entry / risk : 0;
  return { day: s.day, side, entryT, exitT, entry, stop, risk, exit, how, nights: nn, gross, cost, fin,
    net: gross - (cost + fin), net2: gross - 2 * (cost + fin) };
}
export function allSetups(D) { const out = []; for (let i = 0; i < D.length; i++) { const s = setup(D, i); if (s) out.push(s); } return out; }
export function runTest(S, test) { const out = []; for (const s of S) { const side = test.side(s); if (side) out.push(simulate(s, side)); } return out; }

// baseline: mean net R of the same trade on every usable day, per calendar year and side
export function baseline(S) {
  const acc = new Map();
  for (const s of S) for (const side of [1, -1]) { const k = `${s.day.slice(0, 4)}:${side}`, tr = simulate(s, side);
    const a = acc.get(k) || { n: 0, sum: 0 }; a.n++; a.sum += tr.net; acc.set(k, a); }
  return new Map([...acc].map(([k, a]) => [k, a.sum / a.n]));
}
export const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export const inWin = (T, [f, t]) => T.filter((x) => x.day >= f && x.day <= t);
export function monthT(T, [f, t], key = 'net') {
  const sums = new Map();
  for (let y = +f.slice(0, 4), m = +f.slice(5, 7); `${y}-${String(m).padStart(2, '0')}` <= t.slice(0, 7); m === 12 ? (y++, m = 1) : m++) sums.set(`${y}-${String(m).padStart(2, '0')}`, 0);
  for (const x of T) { const k = ymd(x.exitT).slice(0, 7); if (sums.has(k)) sums.set(k, sums.get(k) + x[key]); }
  const v = [...sums.values()], n = v.length, m = v.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1));
  return { months: n, t: sd ? m / (sd / Math.sqrt(n)) : 0 };
}
export const phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
function erf(x) { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); }
export function holm(ps) { const o = ps.map((p, k) => [p, k]).sort((a, b) => a[0] - b[0]), adj = new Array(ps.length); let run = 0;
  o.forEach(([p, k], r) => { run = Math.max(run, Math.min(1, (ps.length - r) * p)); adj[k] = run; }); return adj; }
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const r3 = (v) => (v == null || !Number.isFinite(v) ? null : +v.toFixed(3)), r2 = (v) => (v == null || !Number.isFinite(v) ? null : +v.toFixed(2));
export function summary(T, w) {
  const n = T.length, mean = (k) => (n ? T.reduce((a, x) => a + x[k], 0) / n : null);
  const mt = monthT(T, w), mg = monthT(T, w, 'gross'), m2 = monthT(T, w, 'net2'), ml = monthT(T, w, 'lift');
  let eq = 0, pk = 0, dd = 0; for (const x of T) { eq += x.net; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  return { n, gross: r3(mean('gross')), net: r3(mean('net')), net2x: r3(mean('net2')), cost: r3(mean('cost')), fin: r3(mean('fin')),
    lift: r3(mean('lift')), tLift: r2(ml.t), total: r2(T.reduce((a, x) => a + x.net, 0)), win: n ? r2(T.filter((x) => x.net > 0).length / n * 100) : null,
    stops: T.filter((x) => x.how === 'stop').length, longs: T.filter((x) => x.side > 0).length,
    months: mt.months, t: r2(mt.t), tGross: r2(mg.t), t2x: r2(m2.t), dd: r2(dd) };
}
// placebo: each real OOS trade -> a random usable day of the same calendar year, same side, same trade construction
export function placebo(S, real, seeds = SEEDS) {
  const pool = new Map(); for (const s of S) { const y = s.day.slice(0, 4); if (!pool.has(y)) pool.set(y, []); pool.get(y).push(s); }
  const means = [];
  for (let k = 1; k <= seeds; k++) { const r = rng(SEED + k); let sum = 0, n = 0;
    for (const x of real) { const P = pool.get(x.day.slice(0, 4)); if (!P) continue; sum += simulate(P[Math.floor(r() * P.length)], x.side).net; n++; }
    means.push(n ? sum / n : 0); }
  return means;
}

async function fetchH1(dir) {
  const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  fs.mkdirSync(dir, { recursive: true });
  const now = Math.floor(Date.now() / 1000), m = new Map();
  for (let a = Math.floor(Date.parse('2006-01-01T00:00:00Z') / 1000); a < now;) {
    const b = Math.min(now, a + 4990 * H); let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) {
      try { const r = await fetch(`${BASE}bars?sym=xau&tf=1h&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
        if (x && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; }
      catch (e) { err = String(e.message || e); }
      if (!j) await sleep(2500 * (k + 1));
    }
    if (!j) throw new Error(`${new Date(a * 1000).toISOString()}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(2200);
  }
  const rows = [...m.values()].sort((p, q) => p[0] - q[0]);
  fs.writeFileSync(path.join(dir, 'xau-h1.json'), JSON.stringify(rows));
  console.log(`xau 1h: ${rows.length} candles`);
}

function full(dir) {
  const h1 = JSON.parse(fs.readFileSync(path.join(dir, 'xau-h1.json'), 'utf8'));
  const D = toDays(h1), S = allSetups(D), base = baseline(S);
  const usable = (w) => S.filter((s) => s.day >= w[0] && s.day <= w[1]).length;
  const out = { built: '2026-11-14',
    data: { src: 'OANDA mid H1 XAU_USD via the site proxy, grouped into New York days (17:00 to 17:00 New York, council/histdata.mjs nyOffsetH)',
      from: ymd(h1[0][0]), to: ymd(h1.at(-1)[0]), h1: h1.length, days: D.length, usableIS: usable(WIN.is), usableOOS: usable(WIN.oos) },
    costs: { spread: SPREAD, slippagePerOrder: SLIP, roundTrip: RT, financing: { rate: FIN.xau.long, src: FIN.xau.src, side: 'longs only' } },
    rule: { atrN: ATR_N, smaN: SMA_N, stopAtr: STOP_ATR, body1: B1, body2: B2, firstH4: '17:00-20:59 New York', hold: '21:00 New York to 17:00 New York' },
    windows: WIN, seed: SEED, baseline: Object.fromEntries([...base].map(([k, v]) => [k, r3(v)])), tests: {} };
  const ps = [];
  for (const [k, test] of Object.entries(TESTS)) {
    const all = runTest(S, test); for (const x of all) x.lift = x.net - (base.get(`${x.day.slice(0, 4)}:${x.side}`) ?? 0);
    const oos = inWin(all, WIN.oos), is = inWin(all, WIN.is);
    const so = summary(oos, WIN.oos), si = summary(is, WIN.is), pl = placebo(S, oos), sorted = [...pl].sort((a, b) => a - b);
    const beaten = pl.filter((m) => so.net > m).length, p = 1 - phi(so.t || 0); ps.push(p);
    const years = {}; for (const x of all) { const y = x.day.slice(0, 4); if (y < '2007' || x.day > WIN.oos[1]) continue; (years[y] ||= []).push(x); }
    const side = (T, s, w) => summary(T.filter((x) => x.side === s), w);
    out.tests[k] = { name: test.name, oos: so, is: si, p: +p.toFixed(4),
      bySide: { oosLong: side(oos, 1, WIN.oos), oosShort: side(oos, -1, WIN.oos), isLong: side(is, 1, WIN.is), isShort: side(is, -1, WIN.is) },
      placebo: { beaten, of: pl.length, p5: r3(sorted[1]), median: r3(sorted[19]), p95: r3(sorted[37]), mean: r3(pl.reduce((a, b) => a + b, 0) / pl.length) },
      years: Object.fromEntries(Object.entries(years).map(([y, T]) => [y, { n: T.length, net: r3(T.reduce((a, x) => a + x.net, 0) / T.length) }])) };
  }
  holm(ps).forEach((h, j) => { const x = Object.values(out.tests)[j]; x.holm = +h.toFixed(4);
    x.checks = { oosNet: x.oos.net > 0, oosT: x.oos.t >= 2 && x.holm < 0.05, is: x.is.net > 0, cost2x: x.oos.net2x > 0, lift: x.oos.lift > 0, placebo: x.placebo.beaten >= 38, n: x.oos.n >= 100 };
    x.pass = Object.values(x.checks).every(Boolean); });
  out.verdict = out.tests.T1.pass ? 'PASS' : 'FAIL';
  out.passAlone = ['T2', 'T3'].filter((k) => out.tests[k].pass);
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify(out.data));
  for (const [k, x] of Object.entries(out.tests)) console.log(k, JSON.stringify({ oos: x.oos, is: x.is, holm: x.holm, placebo: x.placebo, checks: x.checks, bySide: x.bySide }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, dir] = process.argv.slice(2);
  if (!dir) throw new Error('usage: run.mjs fetch|full <dir>');
  if (cmd === 'fetch') await fetchH1(dir); else full(dir);
}
