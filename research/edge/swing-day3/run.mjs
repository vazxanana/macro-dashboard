// A daily three-candle swing failure on gold (PREREGISTRATION.md, committed first).
//   node --use-env-proxy research/edge/swing-day3/run.mjs fetch <dir>   OANDA mid M15 gold + silver from 2020 via the site's proxy
//   node research/edge/swing-day3/run.mjs full <dir>                   the study -> result.json (+ prints the tables)
// Pure pieces are exported for the test. Days are 17:00 New York trading days (gold-drd-long's nyDay).
import fs from 'node:fs';
import path from 'node:path';
import { nyDay } from '../gold-drd-long/run.mjs';
import { financing } from '../../../council/fills.mjs';

const M = 900, H = 3600, D = 86400;
export const BUF = 0.30, COST = 0.30, PIV = 3, SEEDS = 40, FULL_DAY = 88;
export const HALVES = { a: ['2020-01-01', '2023-12-31'], b: ['2024-01-01', '2099-12-31'] };
const ymd = (d) => new Date(d * D * 1000).toISOString().slice(0, 10);

// New York offset in hours for any time (IANA zone, daylight saving included)
const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
export function nyLocal(t) { const p = Object.fromEntries(fmt.formatToParts(new Date(t * 1000)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) / 1000; }
// true when the candle starting at t starts at 00:00 New York
export const isNyMidnight = (t) => nyLocal(t) % D === 0;

// group M15 candles into 17:00 New York days: { d, t0, i0, i1 (exclusive), open, high, low, close, n }
export function days(bars) {
  const out = []; let cur = null;
  for (let i = 0; i < bars.length; i++) { const b = bars[i], d = nyDay(b.time); if (d == null) continue;
    if (!cur || cur.d !== d) { if (cur) cur.i1 = i; cur = { d, t0: b.time, i0: i, i1: i + 1, open: b.open, high: b.high, low: b.low, close: b.close, n: 1 }; out.push(cur); }
    else { cur.high = Math.max(cur.high, b.high); cur.low = Math.min(cur.low, b.low); cur.close = b.close; cur.n++; cur.i1 = i + 1; } }
  return out;
}

// Day 2 against Day 1: +1 buy (low swept, close back inside), -1 sell, 0 none or both sides taken
export function failure(d1, d2) {
  const lo = d2.low < d1.low, hi = d2.high > d1.high, inside = d2.close >= d1.low && d2.close <= d1.high;
  if (!inside || lo === hi) return 0;
  return lo ? 1 : -1;
}
// silver agreement: gold took Day 1's extreme on the setup side, silver did not take its own
export function smt(side, g1, g2, s1, s2) {
  if (!s1 || !s2) return null;
  const goldTook = side > 0 ? g2.low < g1.low : g2.high > g1.high, silverTook = side > 0 ? s2.low < s1.low : s2.high > s1.high;
  return goldTook && !silverTook;
}

// the active 3-a-side swing at each candle: level[k] = active swing high (side +1) / low (side -1) known BEFORE candle k closes
// (confirmed by candle k-1 at the latest), or null. A close beyond it uses it up.
export function activeLevels(bars, side, piv = PIV) {
  const n = bars.length, lv = new Array(n).fill(null); let act = null;
  for (let k = 0; k < n; k++) {
    lv[k] = act;
    const c = bars[k].close; if (act != null && (side > 0 ? c > act : c < act)) act = null;
    const j = k - piv;   // candle k closes: the pivot j = k - piv is now confirmed (used from candle k + 1 on)
    if (j >= piv) { const v = side > 0 ? bars[j].high : bars[j].low; let ok = true;
      for (let q = j - piv; q <= j + piv && ok; q++) if (q !== j) ok = side > 0 ? bars[q].high < v : bars[q].low > v;
      if (ok) act = v; }
  }
  return lv;
}

// one Day 3 trade: entry at the close of the first break of structure; stop first; out at the day's close
export function trade(bars, day3, side, stop, target, lv, cost = COST) {
  for (let k = day3.i0; k < day3.i1; k++) {
    const b = bars[k];
    if (side > 0 ? b.low <= stop : b.high >= stop) return { skip: 'stop-before' };
    if (side > 0 ? b.high >= target : b.low <= target) return { skip: 'target-before' };
    const L = lv[k]; if (L == null || !(side > 0 ? b.close > L : b.close < L)) continue;
    if (k === day3.i1 - 1) return { skip: 'last-candle' };
    const entry = b.close, risk = side * (entry - stop), reward = side * (target - entry);
    if (!(risk > 0) || reward < risk) return { skip: 'under-1R' };
    return { ...run(bars, k, day3.i1, side, entry, stop, target, cost), k };
  }
  return { skip: 'no-break' };
}
// manage from the candle after k to the end of the day (exclusive i1)
export function run(bars, k, i1, side, entry, stop, target, cost = COST) {
  const risk = side * (entry - stop); let exit = bars[k].close, how = 'time', exitT = bars[k].time + M;
  for (let q = k + 1; q < i1; q++) { const b = bars[q];
    if (side > 0 ? b.low <= stop : b.high >= stop) { exit = side > 0 ? Math.min(b.open, stop) : Math.max(b.open, stop); how = 'stop'; exitT = b.time + M; break; }
    if (side > 0 ? b.high >= target : b.low <= target) { exit = target; how = 'target'; exitT = b.time + M; break; }
    exit = b.close; exitT = b.time + M; }
  const R = side * (exit - entry) / risk, entryT = bars[k].time + M;
  const fin = side > 0 ? financing({ market: 'xau', side: 'buy', entry, stop, r0: risk, filled: entryT, closed: exitT }).finR : 0;
  return { entry, stop, target, risk, R, fin, net: R - cost / risk - fin, how, entryT, exitT };
}

export function stats(T) {
  const n = T.length, s = T.reduce((a, x) => a + x.net, 0), m = n ? s / n : 0, sd = n > 1 ? Math.sqrt(T.reduce((a, x) => a + (x.net - m) ** 2, 0) / (n - 1)) : 0;
  const win = T.filter((x) => x.net > 0).reduce((a, x) => a + x.net, 0), loss = -T.filter((x) => x.net < 0).reduce((a, x) => a + x.net, 0);
  let eq = 0, pk = 0, dd = 0; for (const x of T) { eq += x.net; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  return { n, avg: +m.toFixed(3), total: +s.toFixed(1), pf: loss ? +(win / loss).toFixed(2) : null, wr: n ? +(T.filter((x) => x.net > 0).length / n * 100).toFixed(1) : null, t: sd ? +(m / (sd / Math.sqrt(n))).toFixed(2) : null, dd: +dd.toFixed(1), sd };
}
// t of calendar-month sums, every month from..to counted (0 when no trade)
export function monthT(T, from, to) {
  const m = new Map(); for (const x of T) { const k = ymd(x.d).slice(0, 7); m.set(k, (m.get(k) || 0) + x.net); }
  const v = []; let [y, mo] = from.split('-').map(Number); const [ey, em] = to.split('-').map(Number);
  while (y < ey || (y === ey && mo <= em)) { v.push(m.get(`${y}-${String(mo).padStart(2, '0')}`) || 0); mo++; if (mo > 12) { mo = 1; y++; } }
  const n = v.length, a = v.reduce((p, q) => p + q, 0) / n, sd = Math.sqrt(v.reduce((p, q) => p + (q - a) ** 2, 0) / (n - 1));
  return { months: n, avg: +a.toFixed(3), t: sd ? +(a / (sd / Math.sqrt(n))).toFixed(2) : null };
}
export function welch(a, b) { const A = stats(a), B = stats(b), se = Math.sqrt(A.sd ** 2 / A.n + B.sd ** 2 / B.n); return { diff: +(A.avg - B.avg).toFixed(3), t: se ? +((A.avg - B.avg) / se).toFixed(2) : null }; }
function erfc(x) { const z = Math.abs(x), t = 1 / (1 + 0.5 * z), r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? r : 2 - r; }
export const p1 = (t) => 0.5 * erfc(t / Math.SQRT2), p2 = (t) => erfc(Math.abs(t) / Math.SQRT2);
export function holm(ps) { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = Array(ps.length); let m = 0;
  o.forEach(([p, i], r) => { m = Math.max(m, Math.min(1, p * (ps.length - r))); adj[i] = m; }); return adj; }
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// the whole model on gold (+ silver for the SMT split)
export function model(gold, silver) {
  const gd = days(gold), sd = silver ? days(silver) : [], sByD = new Map(sd.map((x) => [x.d, x]));
  const lv = { 1: activeLevels(gold, 1), [-1]: activeLevels(gold, -1) }, T = [], funnel = { setups: 0 };
  // the data's last day may still be forming (the run stops at the latest closed candle): never a Day 3
  for (let i = 2; i < gd.length - 1; i++) {
    const d1 = gd[i - 2], d2 = gd[i - 1], d3 = gd[i], side = failure(d1, d2); if (!side) continue;
    if (d3.d - d1.d > 6) continue;   // three consecutive trading days (a weekend between is allowed, a data hole is not)
    funnel.setups++;
    const stop = side > 0 ? d2.low - BUF : d2.high + BUF, target = side > 0 ? d1.high : d1.low;
    const r = trade(gold, d3, side, stop, target, lv[side]);
    if (r.skip) { funnel[r.skip] = (funnel[r.skip] || 0) + 1; continue; }
    // the 00:00 New York open of Day 3, known only from that candle on
    let mid = null; for (let k = d3.i0; k < d3.i1; k++) if (isNyMidnight(gold[k].time)) { mid = { k, open: gold[k].open }; break; }
    const below = mid != null && r.k >= mid.k && (side > 0 ? r.entry < mid.open : r.entry > mid.open);
    T.push({ ...r, d: d3.d, side, minute: (gold[r.k].time - d3.t0) / 60, smt: smt(side, d1, d2, sByD.get(d1.d), sByD.get(d2.d)), mid: below });
  }
  return { T, funnel, days: gd };
}

// one placebo seed: each real trade gets a random full day of the same half, same side, stop and target distances, entry minute
export function placebo(gold, gd, T, seed) {
  const r = rng(seed), pools = {};
  for (const [h, [f, t]] of Object.entries(HALVES)) pools[h] = gd.filter((x) => x.n >= FULL_DAY && ymd(x.d) >= f && ymd(x.d) <= t);
  const half = (d) => (ymd(d) <= HALVES.a[1] ? 'a' : 'b'), out = [];
  for (const x of T) { const pool = pools[half(x.d)];
    for (let tries = 0; tries < 50; tries++) { const day = pool[Math.floor(r() * pool.length)], want = day.t0 + x.minute * 60;
      let k = -1; for (let q = day.i0; q < day.i1; q++) if (gold[q].time === want) { k = q; break; }
      if (k < 0 || k >= day.i1 - 1) continue;
      const e = gold[k].close, stop = e - (x.entry - x.stop), target = e + (x.target - x.entry);   // same signed distances
      out.push({ ...run(gold, k, day.i1, x.side, e, stop, target), d: day.d }); break; } }
  return out;
}

async function fetchSym(sym, dir) {
  let from = Math.floor(Date.parse('2020-01-01') / 1000); const now = Math.floor(Date.now() / 1000), all = [];
  while (from < now) { const to = Math.min(now, from + 4990 * M);
    let j, ok = false;
    for (let a = 0; a < 4 && !ok; a++) { try { const r = await fetch(`https://meridianx.dev/md/bars?sym=${sym}&tf=15m&from=${from}&to=${to}`); j = await r.json(); ok = r.ok; } catch { ok = false; } if (!ok) await new Promise((s) => setTimeout(s, 4000 * (a + 1))); }
    if (!ok) throw new Error(`proxy failed ${sym} ${from}`);
    for (const b of j.bars || []) if (!b.live) all.push([b.time, b.open, b.high, b.low, b.close]);
    process.stderr.write(`${sym} ${new Date(from * 1000).toISOString().slice(0, 10)} ${all.length}\n`); from = to; await new Promise((s) => setTimeout(s, 2200)); }
  const seen = new Set(), rows = all.filter((x) => !seen.has(x[0]) && seen.add(x[0])).sort((a, b) => a[0] - b[0]);
  // drop the forming candle
  while (rows.length && rows.at(-1)[0] + M > now) rows.pop();
  fs.writeFileSync(path.join(dir, `${sym}-m15.json`), JSON.stringify(rows));
}
const load = (dir, sym) => JSON.parse(fs.readFileSync(path.join(dir, `${sym}-m15.json`), 'utf8')).map(([time, open, high, low, close]) => ({ time, open, high, low, close }));

function full(dir) {
  const gold = load(dir, 'xau'), silver = load(dir, 'xag'), { T, funnel, days: gd } = model(gold, silver);
  const cut = (X, [f, t]) => X.filter((x) => ymd(x.d) >= f && ymd(x.d) <= t), S = (X) => { const s = stats(X); delete s.sd; return s; };
  const last = ymd(gd.at(-1).d), all = ['2020-01-01', last];
  const out = { built: new Date().toISOString().slice(0, 10), data: { from: ymd(gd[0].d), to: last, days: gd.length, m15: gold.length, m15Silver: silver.length, src: 'OANDA mid M15 XAU_USD / XAG_USD via the site proxy' }, cost: COST, buffer: BUF, funnel };
  out.T1 = { all: S(T), a: S(cut(T, HALVES.a)), b: S(cut(T, HALVES.b)), monthly: monthT(T, all[0].slice(0, 7), last.slice(0, 7)) };
  out.T1.fin = +T.reduce((a, x) => a + x.fin, 0).toFixed(2);
  const split = (f) => { const r = { all: welch(T.filter(f), T.filter((x) => !f(x))) };
    for (const h of ['a', 'b']) { const X = cut(T, HALVES[h]); r[h] = welch(X.filter(f), X.filter((x) => !f(x))); r[h + 'In'] = S(X.filter(f)); r[h + 'Out'] = S(X.filter((x) => !f(x))); }
    r.in = S(T.filter(f)); r.out = S(T.filter((x) => !f(x))); return r; };
  out.T2 = split((x) => x.smt === true); out.T2.noSilver = T.filter((x) => x.smt == null).length;
  out.T3 = split((x) => x.mid);
  // placebo
  const pm = []; for (let s = 1; s <= SEEDS; s++) { const P = placebo(gold, gd, T, s); pm.push(+stats(P).avg.toFixed(3)); }
  const real = out.T1.all.avg, beaten = pm.filter((v) => real > v).length;
  out.placebo = { seeds: SEEDS, means: pm, beaten, min: Math.min(...pm), max: Math.max(...pm), median: [...pm].sort((a, b) => a - b)[SEEDS / 2] };
  // Holm
  const ps = [p1(out.T1.monthly.t ?? 0), p2(out.T2.all.t ?? 0), p2(out.T3.all.t ?? 0)], adj = holm(ps);
  const t1 = out.T1.a.avg > 0 && out.T1.b.avg > 0 && out.T1.monthly.t >= 2 && adj[0] < 0.05 && beaten >= 38;
  const sp = (r, i) => Math.abs(r.all.t) >= 2 && adj[i] < 0.05 && Math.sign(r.a.diff) === Math.sign(r.b.diff) && r.a.diff !== 0;
  out.tests = { T1: { p: +ps[0].toFixed(4), pHolm: +adj[0].toFixed(4), pass: t1 }, T2: { p: +ps[1].toFixed(4), pHolm: +adj[1].toFixed(4), pass: sp(out.T2, 1) }, T3: { p: +ps[2].toFixed(4), pHolm: +adj[2].toFixed(4), pass: sp(out.T3, 2) } };
  out.verdict = t1 ? 'PASS' : 'FAIL';
  // splits, reported
  out.bySide = { buy: S(T.filter((x) => x.side > 0)), sell: S(T.filter((x) => x.side < 0)) };
  out.byExit = Object.fromEntries(['stop', 'target', 'time'].map((h) => [h, T.filter((x) => x.how === h).length]));
  out.years = {}; for (let y = 2020; y <= 2026; y++) { const X = cut(T, [`${y}-01-01`, `${y}-12-31`]); if (X.length) { const s = stats(X); out.years[y] = { n: s.n, avg: s.avg, total: s.total }; } }
  out.grossAvg = +(T.reduce((a, x) => a + x.R, 0) / T.length).toFixed(3);
  // descriptive: previous day's high / low taken the next day
  let n = 0, hi = 0, lo = 0, either = 0, both = 0;
  for (let i = 1; i < gd.length; i++) { const a = gd[i - 1], b = gd[i]; if (b.d - a.d > 3 || a.n < FULL_DAY || b.n < FULL_DAY) continue; n++;
    const h = b.high > a.high, l = b.low < a.low; hi += h; lo += l; either += h || l; both += h && l; }
  const pc = (v) => +(v / n * 100).toFixed(1);
  out.pdhpdl = { days: n, high: pc(hi), low: pc(lo), either: pc(either), both: pc(both) };
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify(out, null, 1));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') { fs.mkdirSync(dir, { recursive: true }); await fetchSym('xau', dir); await fetchSym('xag', dir); }
  else if (cmd === 'full') full(dir); else console.log('usage: run.mjs fetch|full <dir>');
}
