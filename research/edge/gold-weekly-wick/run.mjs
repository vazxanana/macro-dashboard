// Gold after a weekly candle with a long wick (PREREGISTRATION.md, pushed alone first).
//   node --use-env-proxy research/edge/gold-weekly-wick/run.mjs fetch <dir>   OANDA mid H1 gold from 2006 via the site's proxy
//   node research/edge/gold-weekly-wick/run.mjs full <dir>                   the study -> result.json (+ prints the tables)
// Pure pieces are exported for the test. Paper research: nothing live reads this file.
import fs from 'node:fs';
import path from 'node:path';
import { days, nyDay } from '../gold-drd-long/run.mjs';
import { nights, FIN } from '../../../council/fills.mjs';

const H = 3600, D = 86400;
export const P = { wick: 0.6, buf: 0.3, cost: 0.6, minDays: 4, rangeLook: 20, rangeMin: 0.5, seed: 20261114, draws: 40 };
export const WIN = { is: ['2007-01-01', '2016-12-31'], oos: ['2017-01-01', '2026-10-31'] };
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const monday = (d) => d - ((new Date(d * D * 1000).getUTCDay() + 6) % 7);

// weeks of 17:00 New York days: { k (Monday's day number), open, high, low, close, nd (days), i0 (index of its first day) }
export function weeksOf(ds) {
  const w = [];
  ds.forEach((x, i) => { const k = monday(x.d), c = w.at(-1);
    if (!c || c.k !== k) w.push({ k, open: x.open, high: x.high, low: x.low, close: x.close, nd: 1, i0: i });
    else { c.high = Math.max(c.high, x.high); c.low = Math.min(c.low, x.low); c.close = x.close; c.nd++; } });
  return w;
}
// the wick reading of one week: +1 lower wick > 60 % of the range (buy), -1 upper wick > 60 % (sell), 0 otherwise
export function wickSide(w, thr = P.wick) {
  const r = w.high - w.low; if (!(r > 0)) return 0;
  if (Math.min(w.open, w.close) - w.low > thr * r) return 1;
  if (w.high - Math.max(w.open, w.close) > thr * r) return -1;
  return 0;
}
// eligible weeks (filter only, completed, a next week to enter): indices into wk; uses weeks up to i only
export function eligible(wk) {
  const out = [];
  for (let i = P.rangeLook; i < wk.length - 1; i++) {
    const w = wk[i]; if (w.nd < P.minDays) continue;
    let s = 0; for (let j = i - P.rangeLook; j < i; j++) s += wk[j].high - wk[j].low;
    if (w.high - w.low >= P.rangeMin * s / P.rangeLook) out.push(i);
  }
  return out;
}
// a signal on week i: entry on the first day of week i + 1, stop $0.30 past week i's extreme on the signal's side
export const signalOf = (wk, i, side) => ({ w: i, side, day: wk[i + 1].i0, stop: side > 0 ? wk[i].low - P.buf : wk[i].high + P.buf });
export function signals(wk) { return eligible(wk).map((i) => [i, wickSide(wk[i])]).filter(([, s]) => s).map(([i, s]) => signalOf(wk, i, s)); }

// one trade: market at the first H1 open of day `sg.day`, stop on every later H1 candle (an open through it fills at the open),
// else out at the close of the last H1 candle of the N-th day. start: Map(day number -> first H1 index). null = no trade.
export function simulate(h1, start, ds, sg, N, mult = 1) {
  const d0 = ds[sg.day], dEnd = ds[sg.day + N]; if (!d0 || !dEnd) return null;
  const k0 = start.get(d0.d), k1 = start.get(dEnd.d) - 1; if (k0 == null || !(k1 >= k0)) return null;
  const side = sg.side, entry = h1[k0].open, stop = sg.stop;
  if (side > 0 ? entry <= stop : entry >= stop) return null;
  const risk = Math.abs(entry - stop); let exit = null, exitT = null, how = 'time';
  for (let k = k0; k <= k1; k++) { const b = h1[k];
    if (k > k0 && (side > 0 ? b.open <= stop : b.open >= stop)) { exit = b.open; exitT = b.time; how = 'gap'; break; }
    if (side > 0 ? b.low <= stop : b.high >= stop) { exit = stop; exitT = b.time + H; how = 'stop'; break; } }
  if (exit == null) { exit = h1[k1].close; exitT = h1[k1].time + H; }
  const R = side * (exit - entry) / risk, costR = P.cost / risk;
  const finR = side > 0 ? nights(h1[k0].time, exitT) * FIN.xau.long * entry / risk : 0;
  return { w: sg.w, side, entryT: h1[k0].time, exitT, entry, stop, exit, risk, how, R, costR, finR,
    net: R - mult * (costR + finR), net2: R - 2 * (costR + finR) };
}
export function oneAtATime(T) { const out = []; let free = -Infinity; for (const x of [...T].sort((a, b) => a.entryT - b.entryT)) { if (x.entryT < free) continue; out.push(x); free = x.exitT; } return out; }

// t of calendar-month sums (by exit month) over every month from the window's first month to its last (or the last exit)
export function monthT(T, [f, t], key = 'net') {
  const m = new Map(); for (const x of T) { const k = ymd(x.exitT).slice(0, 7); m.set(k, (m.get(k) || 0) + x[key]); }
  let [y, mo] = f.slice(0, 7).split('-').map(Number); const last = [t.slice(0, 7), ...m.keys()].sort().at(-1), v = [];
  for (;;) { const k = `${y}-${String(mo).padStart(2, '0')}`; v.push(m.get(k) || 0); if (k >= last) break; if (++mo > 12) { mo = 1; y++; } }
  const n = v.length, a = v.reduce((s, x) => s + x, 0) / n, sd = Math.sqrt(v.reduce((s, x) => s + (x - a) ** 2, 0) / (n - 1));
  return { months: n, t: sd ? +(a / (sd / Math.sqrt(n))).toFixed(2) : 0 };
}
const mean = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
export function stats(T, win) {
  let eq = 0, pk = 0, dd = 0; for (const x of [...T].sort((a, b) => a.exitT - b.exitT)) { eq += x.net; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  const r3 = (x) => +x.toFixed(3);
  return { n: T.length, buys: T.filter((x) => x.side > 0).length, sells: T.filter((x) => x.side < 0).length,
    gross: r3(mean(T.map((x) => x.R))), net: r3(mean(T.map((x) => x.net))), net2x: r3(mean(T.map((x) => x.net2))),
    costR: r3(mean(T.map((x) => x.costR))), finR: r3(mean(T.map((x) => x.finR))), totalNet: +T.reduce((s, x) => s + x.net, 0).toFixed(1),
    win: T.length ? +(T.filter((x) => x.net > 0).length / T.length * 100).toFixed(1) : null, stops: T.filter((x) => x.how !== 'time').length,
    medianStop: T.length ? +median(T.map((x) => x.risk)).toFixed(2) : null, tNet: monthT(T, win, 'net').t, tGross: monthT(T, win, 'R').t,
    months: monthT(T, win).months, dd: +dd.toFixed(1) };
}
// Holm over two-sided normal p values
const phi = (z) => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };
export const pOf = (t) => 2 * (1 - phi(Math.abs(t)));
export function holm(ps) { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = Array(ps.length); let mx = 0;
  o.forEach(([p, i], r) => { mx = Math.max(mx, Math.min(1, (ps.length - r) * p)); adj[i] = mx; }); return adj; }
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

async function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  let from = Math.floor(Date.parse('2006-01-01') / 1000); const now = Math.floor(Date.now() / 1000), all = [];
  while (from < now) { const to = Math.min(now, from + 4990 * H);
    const r = await fetch(`https://meridianx.dev/md/bars?sym=xau&tf=1h&from=${from}&to=${to}`); const j = await r.json();
    if (!r.ok) throw new Error(`proxy ${r.status} ${j.error || ''}`);
    for (const b of j.bars || []) if (!b.live) all.push([b.time, b.open, b.high, b.low, b.close]);
    process.stderr.write(`${ymd(from)} ${all.length}\n`); from = to; await new Promise((s) => setTimeout(s, 2200)); }
  const seen = new Set(), rows = all.filter((x) => !seen.has(x[0]) && seen.add(x[0])).sort((a, b) => a[0] - b[0]);
  fs.writeFileSync(path.join(dir, 'xau-h1.json'), JSON.stringify(rows));
}

function full(dir) {
  const h1 = JSON.parse(fs.readFileSync(path.join(dir, 'xau-h1.json'), 'utf8')).map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
  const ds = days(h1), wk = weeksOf(ds), start = new Map();
  h1.forEach((b, k) => { const d = nyDay(b.time); if (d != null && !start.has(d)) start.set(d, k); });
  const inWin = (x, [f, t]) => ymd(x.entryT) >= f && ymd(x.entryT) <= t;
  const S = signals(wk), el = eligible(wk);
  const book = (sigs, N) => oneAtATime(sigs.map((sg) => simulate(h1, start, ds, sg, N)).filter(Boolean));
  const T = { T1: book(S, 10), T2: book(S, 5), T3: book(S.filter((s) => s.side > 0), 10) };
  const base = book(el.map((i) => signalOf(wk, i, 1)), 10);
  const out = { built: '2026-11-14', data: { from: ymd(h1[0].time), to: ymd(h1.at(-1).time), h1: h1.length, days: ds.length, weeks: wk.length, eligible: el.length,
    signals: { buy: S.filter((s) => s.side > 0).length, sell: S.filter((s) => s.side < 0).length }, src: 'OANDA mid H1 XAU_USD via the site proxy' },
    params: P, windows: WIN, tests: {} };
  for (const [k, tr] of Object.entries(T)) out.tests[k] = { is: stats(tr.filter((x) => inWin(x, WIN.is)), WIN.is), oos: stats(tr.filter((x) => inWin(x, WIN.oos)), WIN.oos) };
  out.baselineT3 = { is: stats(base.filter((x) => inWin(x, WIN.is)), WIN.is), oos: stats(base.filter((x) => inWin(x, WIN.oos)), WIN.oos) };
  const adj = holm(['T1', 'T2', 'T3'].map((k) => pOf(out.tests[k].oos.tNet)));
  ['T1', 'T2', 'T3'].forEach((k, i) => { out.tests[k].oos.p = +pOf(out.tests[k].oos.tNet).toFixed(4); out.tests[k].oos.holm = +adj[i].toFixed(4); });
  // years of T1
  out.yearsT1 = {}; for (let y = 2007; y <= 2026; y++) { const r = T.T1.filter((x) => ymd(x.entryT).startsWith(String(y))); if (r.length) out.yearsT1[y] = { n: r.length, net: +r.reduce((s, x) => s + x.net, 0).toFixed(2) }; }
  // placebo: T1's counts of buy / sell signals per window, on random eligible weeks
  const R = rng(P.seed), pl = [];
  const winOfWeek = (i) => ymd(ds[wk[i + 1].i0].d * D);
  for (let dr = 0; dr < P.draws; dr++) {
    const sigs = [];
    for (const win of [WIN.is, WIN.oos]) {
      const pool = el.filter((i) => winOfWeek(i) >= win[0] && winOfWeek(i) <= win[1]);
      const inS = S.filter((s) => { const d = ymd(ds[s.day].d * D); return d >= win[0] && d <= win[1]; });
      const nb = inS.filter((s) => s.side > 0).length, n = inS.length, p = [...pool];
      for (let j = p.length - 1; j > 0; j--) { const r = Math.floor(R() * (j + 1)); [p[j], p[r]] = [p[r], p[j]]; }
      const pick = p.slice(0, n), sides = pick.map((_, j) => (j < nb ? 1 : -1));
      for (let j = sides.length - 1; j > 0; j--) { const r = Math.floor(R() * (j + 1)); [sides[j], sides[r]] = [sides[r], sides[j]]; }
      pick.forEach((i, j) => sigs.push(signalOf(wk, i, sides[j])));
    }
    const tr = book(sigs, 10).filter((x) => inWin(x, WIN.oos));
    pl.push(stats(tr, WIN.oos).tNet);
  }
  const ps = [...pl].sort((a, b) => a - b), q = (f) => ps[Math.min(ps.length - 1, Math.floor(f * ps.length))];
  out.placebo = { draws: P.draws, seed: P.seed, tOOS: pl, median: q(0.5), p95: q(0.95), beatenBy: pl.filter((x) => x >= out.tests.T1.oos.tNet).length };
  const t1 = out.tests.T1, checks = {
    oosT: t1.oos.tNet >= 2 && t1.oos.holm < 0.05, isSign: t1.is.net > 0, cost2x: t1.oos.net2x > 0, placebo: t1.oos.tNet > out.placebo.p95 };
  out.checks = checks; out.verdict = Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL';
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
  for (const [k, v] of Object.entries(out.tests)) for (const w of ['is', 'oos']) console.log(k, w, JSON.stringify(v[w]));
  console.log('base', JSON.stringify(out.baselineT3));
  console.log('years', JSON.stringify(out.yearsT1));
  console.log('placebo', JSON.stringify({ ...out.placebo, tOOS: undefined }), 'checks', JSON.stringify(checks), out.verdict);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') await fetchAll(dir); else if (cmd === 'full') full(dir); else console.log('usage: run.mjs fetch|full <dir>');
}
