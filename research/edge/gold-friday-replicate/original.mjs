// The day-of-the-week effect on spot gold (PREREGISTRATION.md, pushed first).
//   node --use-env-proxy research/edge/gold-weekday/fetch.mjs <dir>     OANDA mid H1 gold (cache out of git)
//   node research/edge/gold-weekday/run.mjs <dir>                       the study -> result.json (+ prints it)
// Pure pieces are exported for the test.
import fs from 'node:fs';
import path from 'node:path';
import { days, nyDay } from '../gold-drd-long/run.mjs';
import { nights, FIN } from '../../../council/fills.mjs';

export const H = 3600, D = 86400;
export const SPREAD = 0.30, SLIP = SPREAD / 2, RT = SPREAD + 2 * SLIP;   // $0.60 a round trip
export const STOP_ATR = 1, ATR_N = 20;
export const WIN = { is: ['2007-01-01', '2016-12-31'], oos: ['2017-01-01', '2026-10-31'] };
export const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const wdOf = (d) => new Date(d * D * 1000).getUTCDay();   // weekday of a 17:00 New York day (its closing date)

// ATR(20) known BEFORE day i opens: the 20 true ranges of days i-20 .. i-1
export function enrich(ds) {
  const tr = ds.map((x, i) => (i ? Math.max(x.high, ds[i - 1].close) - Math.min(x.low, ds[i - 1].close) : null));
  return ds.map((x, i) => { let atr = null;
    if (i > ATR_N) { let s = 0; for (let k = i - ATR_N; k < i; k++) s += tr[k]; atr = s / ATR_N; }
    return { ...x, wd: wdOf(x.d), atr }; });
}
export function dayIndex(h1) { const a = new Map(), b = new Map();
  h1.forEach((c, k) => { const d = nyDay(c.time); if (d == null) return; if (!a.has(d)) a.set(d, k); b.set(d, k); }); return { a, b }; }

// one session trade on day i: entry at its first H1 open, exit at its last H1 close, stop side x 1 ATR checked on H1
export function simulate(h1, idx, ds, i, side) {
  const x = ds[i]; if (!(x.atr > 0)) return null;
  const ka = idx.a.get(x.d), kb = idx.b.get(x.d); if (ka == null) return null;
  const entry = h1[ka].open, risk = STOP_ATR * x.atr, stop = entry - side * risk;
  let exit = null, how = 'close', exitT = h1[kb].time + H;
  for (let k = ka; k <= kb; k++) { const c = h1[k];
    if (side > 0 ? c.low <= stop : c.high >= stop) { exit = side > 0 ? Math.min(c.open, stop) : Math.max(c.open, stop); exitT = c.time + H; how = 'stop'; break; } }
  if (exit == null) exit = h1[kb].close;
  const entryT = h1[ka].time, gross = side * (exit - entry) / risk, nn = side > 0 ? nights(entryT, exitT) : 0;
  const cost = RT / risk, fin = side > 0 ? nn * FIN.xau.long * entry / risk : 0;
  return { i, wd: x.wd, side, entryT, exitT, entry, stop, risk, exit, how, nights: nn, gross, cost, fin, net: gross - cost - fin, net2: gross - 2 * cost - 2 * fin };
}
export function runWeekday(h1, idx, ds, wd, side) {
  const out = []; for (let i = 0; i < ds.length; i++) { if (ds[i].wd !== wd) continue; const t = simulate(h1, idx, ds, i, side); if (t) out.push(t); } return out;
}
export const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export const inWin = (T, [f, t]) => T.filter((x) => { const s = ymd(x.entryT); return s >= f && s <= t; });
// T2's choice: the weekday whose in-sample mean GROSS R of a long is largest in absolute value; side = its sign
export function chooseWeekday(h1, idx, ds) {
  const by = {}; for (let wd = 1; wd <= 5; wd++) { const T = inWin(runWeekday(h1, idx, ds, wd, 1), WIN.is); by[wd] = T.length ? T.reduce((a, x) => a + x.gross, 0) / T.length : 0; }
  const wd = [1, 2, 3, 4, 5].reduce((b, w) => (Math.abs(by[w]) > Math.abs(by[b]) ? w : b), 1);
  return { wd, side: by[wd] >= 0 ? 1 : -1, isLongGross: by };
}
export function monthT(T, [f, t], key = 'net') {
  const sums = new Map(); for (let y = +f.slice(0, 4), m = +f.slice(5, 7); `${y}-${String(m).padStart(2, '0')}` <= t.slice(0, 7); m === 12 ? (y++, m = 1) : m++) sums.set(`${y}-${String(m).padStart(2, '0')}`, 0);
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
  const n = T.length, mean = (k) => (n ? T.reduce((a, x) => a + x[k], 0) / n : null), mt = monthT(T, w), m2 = monthT(T, w, 'gross');
  let eq = 0, pk = 0, dd = 0; for (const x of T) { eq += x.net; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  return { n, gross: r3(mean('gross')), net: r3(mean('net')), net2x: r3(mean('net2')), cost: r3(mean('cost')), fin: r3(mean('fin')),
    nights: T.reduce((a, x) => a + x.nights, 0), total: r2(T.reduce((a, x) => a + x.net, 0)), win: n ? r2(T.filter((x) => x.net > 0).length / n * 100) : null,
    stops: T.filter((x) => x.how === 'stop').length, months: mt.months, t: r2(mt.t), tGross: r2(m2.t), dd: r2(dd) };
}
// placebo: each real OOS trade -> a random trading day of the same year (any weekday), same side and rule
export function placebo(h1, idx, ds, real, seeds = 40) {
  const byYear = new Map(); ds.forEach((x, i) => { if (!(x.atr > 0)) return; const y = ymd(x.t).slice(0, 4); if (!byYear.has(y)) byYear.set(y, []); byYear.get(y).push(i); });
  const means = [];
  for (let s = 1; s <= seeds; s++) { const r = rng(2000 + s), T = [];
    for (const x of real) { const pool = byYear.get(ymd(x.entryT).slice(0, 4)); let tr = null;
      for (let k = 0; k < 20 && !tr; k++) tr = simulate(h1, idx, ds, pool[Math.floor(r() * pool.length)], x.side);
      if (tr) T.push(tr.net); }
    means.push(T.reduce((a, b) => a + b, 0) / T.length); }
  return means;
}

function main(dir) {
  const h1 = JSON.parse(fs.readFileSync(path.join(dir, 'xau-h1.json'), 'utf8')).map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
  const ds = enrich(days(h1)), idx = dayIndex(h1);
  const ch = chooseWeekday(h1, idx, ds);
  const TESTS = { T1: { name: 'T1 short every Monday session', wd: 1, side: -1 }, T2: { name: `T2 ${ch.side > 0 ? 'long' : 'short'} every ${WD[ch.wd]} session (chosen in sample)`, wd: ch.wd, side: ch.side } };
  const out = { built: '2026-11-14', data: { src: 'OANDA mid H1 XAU_USD via the site proxy (fetch.mjs), 17:00 New York days (gold-drd-long days())', from: ymd(ds[0].t), to: ymd(ds.at(-1).t), days: ds.length, h1: h1.length },
    costs: { spread: SPREAD, slippagePerOrder: SLIP, roundTrip: RT, stop: '1 x ATR(20) of the 20 days before', financing: { rate: FIN.xau.long, src: FIN.xau.src, side: 'longs only' } }, windows: WIN,
    choice: { weekday: WD[ch.wd], side: ch.side, isLongGross: Object.fromEntries(Object.entries(ch.isLongGross).map(([w, v]) => [WD[w], r3(v)])) }, tests: {} };
  const ps = [];
  for (const [k, test] of Object.entries(TESTS)) {
    const all = runWeekday(h1, idx, ds, test.wd, test.side), oos = inWin(all, WIN.oos), is = inWin(all, WIN.is);
    const so = summary(oos, WIN.oos), si = summary(is, WIN.is), pl = placebo(h1, idx, ds, oos), sorted = [...pl].sort((a, b) => a - b);
    const beaten = pl.filter((m) => so.net > m).length, p = 1 - phi(so.t || 0); ps.push(p);
    const years = {}; for (const x of all) { const y = ymd(x.entryT).slice(0, 4); (years[y] ||= []).push(x); }
    out.tests[k] = { name: test.name, weekday: WD[test.wd], side: test.side, oos: so, is: si, p: +p.toFixed(4),
      placebo: { beaten, of: pl.length, p5: r3(sorted[1]), median: r3(sorted[19]), p95: r3(sorted[37]), mean: r3(pl.reduce((a, b) => a + b, 0) / pl.length) },
      years: Object.fromEntries(Object.entries(years).filter(([y]) => y >= '2007' && y <= '2026').map(([y, T]) => [y, { n: T.length, net: r3(T.reduce((a, x) => a + x.net, 0) / T.length) }])) };
  }
  holm(ps).forEach((h, j) => { const x = Object.values(out.tests)[j]; x.holm = +h.toFixed(4);
    x.checks = { n: x.oos.n >= 100, oos: x.oos.net > 0 && x.oos.t >= 2 && x.holm < 0.05, is: x.is.net > 0, cost2x: x.oos.net2x > 0, placebo: x.placebo.beaten >= 38 };
    x.pass = Object.values(x.checks).every(Boolean); });
  // deciding nothing: mean gross R of a long held over each weekday's session, both windows
  out.byWeekday = {}; for (let wd = 1; wd <= 5; wd++) { const all = runWeekday(h1, idx, ds, wd, 1);
    out.byWeekday[WD[wd]] = Object.fromEntries(Object.entries(WIN).map(([wk, w]) => { const s = summary(inWin(all, w), w); return [wk, { n: s.n, longGross: s.gross, tGross: s.tGross }]; })); }
  out.verdict = out.tests.T1.pass ? 'PASS' : 'FAIL';
  out.passAlone = ['T2'].filter((k) => out.tests[k].pass);
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify(out, null, 1));
}
if (import.meta.url === `file://${process.argv[1]}`) main(process.argv[2]);
