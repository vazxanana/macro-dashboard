// Does spot gold drift up into US market holidays? (PREREGISTRATION.md, pushed alone first)
//   node --use-env-proxy research/edge/gold-pre-holiday/run.mjs fetch <dir>   OANDA mid H1 gold from 2006 via the site's proxy
//   node research/edge/gold-pre-holiday/run.mjs full <dir>                   the study -> result.json (+ prints the tables)
// Pure pieces are exported for the test.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nyDay } from '../gold-drd-long/run.mjs';
import { cmeYear } from '../../../ict/calendar.mjs';
import { nights, FIN } from '../../../council/fills.mjs';

const H = 3600, D = 86400;
export const COST = 0.6, ATR_N = 14, STOP_ATR = 1.0;
export const WIN = { is: [2007, 2016], oos: [2017, 2026] }, OOS_END = '2026-10-31', SEEDS = 40;
const SKIP = new Set(['Independence Day eve', 'Day after Thanksgiving', 'Christmas Eve']);
const ymd = (d) => new Date(d * D * 1000).toISOString().slice(0, 10);
const dayOf = (s) => Date.parse(s) / 1000 / D;

// NYSE full holidays of year y: [{ date, d, name }] (cmeYear's full holidays + its early-close days that are NYSE holidays)
export function holidays(y) {
  const Y = cmeYear(y);
  return [...[...Y.full].map(([k, n]) => [k, n]), ...[...Y.early].map(([k, v]) => [k, v.name])]
    .filter(([, n]) => !SKIP.has(n)).map(([date, name]) => ({ date, d: dayOf(date), name })).sort((a, b) => a.d - b.d);
}

// 17:00 New York days from H1 rows { time, open, high, low, close }: [{ d, open, high, low, close, i0, i1 }] (i0..i1 = H1 indices)
export function buildDays(h1) {
  const out = []; let cur = null;
  h1.forEach((b, i) => { const d = nyDay(b.time); if (d == null) return;
    if (!cur || cur.d !== d) { cur = { d, open: b.open, high: b.high, low: b.low, close: b.close, i0: i, i1: i }; out.push(cur); }
    else { cur.high = Math.max(cur.high, b.high); cur.low = Math.min(cur.low, b.low); cur.close = b.close; cur.i1 = i; } });
  return out;
}
// ATR(n) of the days strictly before index k (simple mean of true range); null when fewer than n earlier days
export function atrBefore(ds, k, n = ATR_N) {
  if (k < n + 1) return null; let s = 0;
  for (let j = k - n; j < k; j++) { const b = ds[j], p = ds[j - 1]; s += Math.max(b.high - b.low, Math.abs(b.high - p.close), Math.abs(b.low - p.close)); }
  return s / n;
}
// one long from the open of day index a to the close of day index b (a <= b), stop STOP_ATR x ATR below: gross / net R
export function trade(h1, ds, a, b, { cost = COST, finMul = 1 } = {}) {
  const atr = atrBefore(ds, a); if (!atr) return null;
  const entry = ds[a].open, stop = entry - STOP_ATR * atr, t0 = h1[ds[a].i0].time;
  let exit = null, exitT = null, stopped = false;
  for (let i = ds[a].i0; i <= ds[b].i1 && exit == null; i++) { const c = h1[i];
    if (i > ds[a].i0 && c.open <= stop) { exit = c.open; exitT = c.time; stopped = true; }
    else if (c.low <= stop) { exit = stop; exitT = c.time + H; stopped = true; } }
  if (exit == null) { exit = ds[b].close; exitT = h1[ds[b].i1].time + H; }
  const gross = (exit - entry) / atr, n = nights(t0, exitT), fin = finMul * n * FIN.xau.long * entry / atr, c = cost / atr;
  return { entry, stop, exit, atr, stopped, nights: n, gross, finR: fin, costR: c, net: gross - c - fin, t0, exitT };
}
// the events of one holiday: indices of the last two trading days before it and the first after it (null when missing)
export function eventDays(ds, hol, holSet) {
  let k = ds.findIndex((x) => x.d >= hol.d); if (k < 0) return null;
  const isHol = (x) => holSet.has(x.d);
  let p1 = k - 1; while (p1 >= 0 && isHol(ds[p1])) p1--;
  let p2 = p1 - 1; while (p2 >= 0 && isHol(ds[p2])) p2--;
  let a = k; while (a < ds.length && isHol(ds[a])) a++;
  const ok = (i, lo, hi) => i >= 0 && i < ds.length && ds[i].d >= lo && ds[i].d <= hi;
  return { pre1: ok(p1, hol.d - 5, hol.d - 1) ? p1 : null, pre2: ok(p2, hol.d - 7, hol.d - 2) ? p2 : null, post: ok(a, hol.d + 1, hol.d + 5) ? a : null };
}

// ── statistics
export function st(x) { const n = x.length; if (!n) return { n: 0, mean: null, sd: null, t: null };
  const m = x.reduce((s, v) => s + v, 0) / n, sd = n > 1 ? Math.sqrt(x.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1)) : 0;
  return { n, mean: m, sd, t: sd > 0 ? m / (sd / Math.sqrt(n)) : null }; }
export function welch(a, b) { const A = st(a), B = st(b), se = Math.sqrt(A.sd ** 2 / A.n + B.sd ** 2 / B.n); return { diff: A.mean - B.mean, t: se ? (A.mean - B.mean) / se : null }; }
function betacf(a, b, x) { let c = 1, d = 1 - (a + b) * x / (a + 1); d = 1 / d; let h = d;
  for (let m = 1; m <= 200; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d; c = 1 + aa / c; d = 1 / d; h *= d * c; aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d; c = 1 + aa / c; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-12) break; } return h; }
function lgamma(z) { const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = z, y = z, tmp = x + 5.5; tmp -= (x + 0.5) * Math.log(tmp); let s = 1.000000000190015; for (const c of g) s += c / ++y; return -tmp + Math.log(2.5066282746310005 * s / x); }
function ibeta(a, b, x) { if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
// one-sided p of Student t (H1: mean > 0)
export function pOne(t, df) { if (t == null || !(df > 0)) return 1; const x = df / (df + t * t), tail = 0.5 * ibeta(df / 2, 0.5, x); return t > 0 ? tail : 1 - tail; }
export function holm(ps) { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), m = ps.length, out = Array(m); let run = 0;
  o.forEach(([p, i], j) => { run = Math.max(run, Math.min(1, (m - j) * p)); out[i] = run; }); return out; }
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const monthT = (rows) => { const m = new Map(); for (const r of rows) { const k = ymd(Math.floor(r.t0 / D)).slice(0, 7); m.set(k, (m.get(k) || 0) + r.net); } const s = st([...m.values()]); return { months: s.n, t: s.t }; };
const r3 = (v) => v == null ? null : Math.round(v * 1000) / 1000, r2 = (v) => v == null ? null : Math.round(v * 100) / 100, r4 = (v) => v == null ? null : Math.round(v * 1e4) / 1e4;

export function summary(rows) {
  const g = st(rows.map((r) => r.gross)), n = st(rows.map((r) => r.net)), x2 = st(rows.map((r) => r.gross - 2 * (r.costR + r.finR)));
  return { n: n.n, grossR: r3(g.mean), grossT: r2(g.t), costR: r3(st(rows.map((r) => r.costR)).mean), finR: r3(st(rows.map((r) => r.finR)).mean),
    netR: r3(n.mean), netT: r2(n.t), net2x: r3(x2.mean), grossPct: r4(st(rows.map((r) => 100 * (r.exit - r.entry) / r.entry)).mean),
    won: n.n ? r2(100 * rows.filter((r) => r.net > 0).length / n.n) : null, stops: rows.filter((r) => r.stopped).length, monthT: r2(monthT(rows).t), months: monthT(rows).months };
}

export function study(h1raw) {
  const h1 = h1raw.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
  const ds = buildDays(h1), y0 = 2006, y1 = 2026;
  const hols = []; for (let y = y0; y <= y1; y++) hols.push(...holidays(y));
  const holSet = new Set(hols.map((h) => h.d)), lastD = dayOf(OOS_END);
  const near = new Set(), events = { T1: [], T2: [], T3: [] }, skipped = { T1: 0, T2: 0, T3: 0 };
  for (const h of hols) {
    const yr = +h.date.slice(0, 4); if (yr < WIN.is[0] || h.d > lastD) continue;
    const e = eventDays(ds, h, holSet);
    const add = (k, a, b) => { if (a == null || b == null) { skipped[k]++; return; } const tr = trade(h1, ds, a, b); if (!tr) { skipped[k]++; return; }
      events[k].push({ ...tr, holiday: h.name, date: h.date, year: yr, win: yr <= WIN.is[1] ? 'is' : 'oos', day: ymd(ds[a].d) }); };
    add('T1', e && e.pre1, e && e.pre1); add('T2', e && e.pre2, e && e.pre1); add('T3', e && e.post, e && e.post);
  }
  for (const h of hols) { const e = eventDays(ds, h, holSet); if (e) for (const i of [e.pre1, e.pre2, e.post]) if (i != null) near.add(ds[i].d); }
  const ordinary = []; ds.forEach((x, i) => { if (!holSet.has(x.d) && !near.has(x.d) && i > ATR_N) ordinary.push(i); });
  const ordSet = new Set(ordinary);
  const yearOf = (i) => +ymd(ds[i].d).slice(0, 4);
  // the same one-day long on every ordinary day, per window
  const ordRows = { is: [], oos: [] };
  for (const i of ordinary) { const y = yearOf(i); if (y < WIN.is[0] || ds[i].d > lastD) continue; const tr = trade(h1, ds, i, i); if (tr) ordRows[y <= WIN.is[1] ? 'is' : 'oos'].push(tr); }
  // results
  const res = {}, pOos = [];
  for (const k of ['T1', 'T2', 'T3']) {
    const E = events[k], is = E.filter((r) => r.win === 'is'), oos = E.filter((r) => r.win === 'oos');
    const S = { is: summary(is), oos: summary(oos), whole: summary(E) };
    // placebo: per OOS year as many ordinary days as events that year
    const perYear = new Map(); for (const r of oos) perYear.set(r.year, (perYear.get(r.year) || 0) + 1);
    const pool = new Map(); for (const i of ordinary) { const y = yearOf(i); if (!perYear.has(y) || ds[i].d > lastD) continue;
      if (k === 'T2' && !(ordSet.has(i + 1) && ds[i + 1].d - ds[i].d <= 4)) continue; (pool.get(y) || pool.set(y, []).get(y)).push(i); }
    const means = [];
    for (let s = 1; s <= SEEDS; s++) { const R = rng(s), net = [];
      for (const [y, c] of perYear) { const P = (pool.get(y) || []).slice();
        for (let j = 0; j < c && P.length; j++) { const i = P.splice(Math.floor(R() * P.length), 1)[0]; const tr = trade(h1, ds, i, k === 'T2' ? i + 1 : i); if (tr) net.push(tr.net); } }
      means.push(st(net).mean); }
    const beat = means.filter((m) => S.oos.netR > m).length;
    const byHol = {}; for (const r of E) (byHol[r.holiday] ||= []).push(r);
    const byYear = {}; for (const r of E) (byYear[r.year] ||= []).push(r);
    const welchOrd = { is: welch(is.map((r) => r.net), ordRows.is.map((r) => r.net)), oos: welch(oos.map((r) => r.net), ordRows.oos.map((r) => r.net)) };
    // reported only (not judged, chosen after the run): the OOS halves, and the OOS without its best holiday
    const oosHol = {}; for (const r of oos) (oosHol[r.holiday] ||= []).push(r.net);
    const best = Object.entries(oosHol).sort((a, b) => st(b[1]).mean - st(a[1]).mean)[0][0];
    const extra = { oos2017_21: summary(oos.filter((r) => r.year <= 2021)), oos2022_26: summary(oos.filter((r) => r.year >= 2022)),
      oosWithoutBest: { holiday: best, ...summary(oos.filter((r) => r.holiday !== best)) } };
    res[k] = { ...S, extra, skipped: skipped[k], placebo: { beat, of: SEEDS, min: r3(Math.min(...means)), median: r3([...means].sort((a, b) => a - b)[20]), max: r3(Math.max(...means)) },
      vsOrdinary: { is: { diff: r3(welchOrd.is.diff), t: r2(welchOrd.is.t) }, oos: { diff: r3(welchOrd.oos.diff), t: r2(welchOrd.oos.t) } },
      byHoliday: Object.fromEntries(Object.entries(byHol).sort().map(([h, rs]) => [h, { n: rs.length, netR: r3(st(rs.map((r) => r.net)).mean), t: r2(st(rs.map((r) => r.net)).t) }])),
      byYear: Object.fromEntries(Object.entries(byYear).map(([y, rs]) => [y, { n: rs.length, netR: r3(st(rs.map((r) => r.net)).mean) }])),
      trades: E.map((r) => ({ date: r.date, holiday: r.holiday, day: r.day, entry: r2(r.entry), exit: r2(r.exit), atr: r2(r.atr), stopped: r.stopped, nights: r.nights, gross: r3(r.gross), net: r3(r.net) })) };
    pOos.push(pOne(S.oos.netT, S.oos.n - 1));
  }
  const adj = holm(pOos);
  ['T1', 'T2', 'T3'].forEach((k, j) => { const r = res[k]; r.pOne = r4(pOos[j]); r.pHolm = r4(adj[j]);
    r.checks = { oosT: r.oos.netT >= 2 && adj[j] < 0.05, isSign: r.is.netR > 0, cost2x: r.oos.net2x > 0, placebo: r.placebo.beat >= 38 };
    r.pass = Object.values(r.checks).every(Boolean); });
  const ord = { is: summary(ordRows.is), oos: summary(ordRows.oos) };
  const pass = ['T1', 'T2', 'T3'].some((k) => res[k].pass);
  return { study: 'gold-pre-holiday', built: '2026-11-14', verdict: pass ? 'PASS' : 'FAIL', data: { from: ymd(ds[0].d), to: ymd(ds.at(-1).d), days: ds.length, h1: h1.length },
    holidays: hols.length, windows: { is: '2007-2016', oos: `2017 to ${OOS_END}` }, costs: { roundTrip: COST, finLong: FIN.xau.long, stopAtr: STOP_ATR, atrN: ATR_N },
    tests: res, ordinary: ord };
}

async function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  let from = Math.floor(Date.parse('2006-01-01') / 1000); const now = Math.floor(Date.now() / 1000), all = [];
  while (from < now) { const to = Math.min(now, from + 4990 * H);
    const r = await fetch(`https://meridianx.dev/md/bars?sym=xau&tf=1h&from=${from}&to=${to}`); const j = await r.json();
    if (!r.ok) throw new Error(`proxy ${r.status} ${j.error || ''}`);
    for (const b of j.bars || []) if (!b.live) all.push([b.time, b.open, b.high, b.low, b.close]);
    from = to; await new Promise((s) => setTimeout(s, 2200)); }
  const seen = new Set(), rows = all.filter((x) => !seen.has(x[0]) && seen.add(x[0])).sort((a, b) => a[0] - b[0]);
  fs.writeFileSync(path.join(dir, 'xau-h1.json'), JSON.stringify(rows));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') await fetchAll(dir);
  else if (cmd === 'full') { const r = study(JSON.parse(fs.readFileSync(path.join(dir, 'xau-h1.json'), 'utf8')));
    fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(r, null, 1) + '\n');
    for (const k of ['T1', 'T2', 'T3']) { const t = r.tests[k]; console.log(k, JSON.stringify({ is: t.is, oos: t.oos, p: t.pHolm, placebo: t.placebo, vs: t.vsOrdinary, checks: t.checks })); }
    console.log('ordinary', JSON.stringify(r.ordinary)); console.log(r.verdict); }
  else console.log('usage: run.mjs fetch|full <dir>');
}
