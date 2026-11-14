// The measured move (ABCD) on gold H4 (PREREGISTRATION.md, committed first).
//   node --use-env-proxy research/edge/gold-measured-move/run.mjs fetch <dir>   OANDA mid H1 gold from March 2006 via the site's proxy
//   node research/edge/gold-measured-move/run.mjs full <dir>                    the study -> result.json (+ prints it)
// Pure pieces are exported for the test. A stand-alone rule: never a gate, exit, entry or size of the live gold book.
import fs from 'node:fs';
import path from 'node:path';
import { nyDay } from '../gold-drd-long/run.mjs';
import { nights, FIN } from '../../../council/fills.mjs';

const H = 3600, H4 = 4 * H, D = 86400;
export const PIV = 3, ATR_N = 14, AB_ATR = 2, BC_MIN = 0.382, BC_MAX = 0.786, BUF = 0.30, COST = 0.60, HOLD = 30, WAIT = 30, SMA_N = 50, SEEDS = 40;
export const IS = ['2008-01-01', '2016-12-31'], OOS = ['2017-01-01', '2026-10-31'];
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);

// H1 rows [t, o, h, l, c] -> H4 candles in fixed UTC buckets starting 02/06/10/14/18/22 (the last bucket, maybe forming, dropped)
export const bucketOf = (t) => Math.floor((t - 2 * H) / H4) * H4 + 2 * H;
export function h4(rows, dropLast = true) {
  const out = []; let cur = null;
  for (const [t, o, h, l, c] of rows) { const s = bucketOf(t);
    if (!cur || cur.time !== s) { cur = { time: s, open: o, high: h, low: l, close: c, n: 1 }; out.push(cur); }
    else { cur.high = Math.max(cur.high, h); cur.low = Math.min(cur.low, l); cur.close = c; cur.n++; } }
  if (dropLast && out.length) out.pop();
  return out;
}

// ATR(14): simple mean of the true range of the 14 candles ending with i (null before)
export function atr(bars, n = ATR_N) {
  const tr = bars.map((b, i) => (i ? Math.max(b.high - b.low, Math.abs(b.high - bars[i - 1].close), Math.abs(b.low - bars[i - 1].close)) : b.high - b.low));
  const out = new Array(bars.length).fill(null); let s = 0;
  for (let i = 0; i < bars.length; i++) { s += tr[i]; if (i >= n) s -= tr[i - n]; if (i >= n) out[i] = s / n; }
  return out;
}

const isHigh = (bars, j, p) => { for (let q = j - p; q <= j + p; q++) if (q !== j && !(bars[q].high < bars[j].high)) return false; return true; };
const isLow = (bars, j, p) => { for (let q = j - p; q <= j + p; q++) if (q !== j && !(bars[q].low > bars[j].low)) return false; return true; };

// Setups, each evaluated at the close of the candle that confirms its C (conf = c + PIV). Only candles <= conf are read.
export function setups(bars, piv = PIV) {
  const A = atr(bars), list = [], out = [];
  const push = (kind, j, conf) => {
    const px = kind > 0 ? bars[j].high : bars[j].low, last = list.at(-1);
    if (last && last.kind === kind) { if (kind > 0 ? px > last.px : px < last.px) { last.i = j; last.px = px; } else return; }
    else list.push({ kind, i: j, px });
    if (list.length < 3) return;
    const [a, b, c] = list.slice(-3);
    if (!(a.i < b.i && b.i < c.i) || A[b.i] == null) return;
    const side = b.kind > 0 ? 1 : -1;   // B a high -> long (A, C lows); B a low -> short
    const ab = side * (b.px - a.px), bc = side * (b.px - c.px);
    if (!(side * (c.px - a.px) > 0) || !(ab >= AB_ATR * A[b.i])) return;
    const r = bc / ab; if (r < BC_MIN || r > BC_MAX) return;
    out.push({ side, a: a.i, b: b.i, c: c.i, A: a.px, B: b.px, C: c.px, conf, atr: A[b.i], ratio: r });
  };
  for (let k = 2 * piv; k < bars.length; k++) { const j = k - piv;
    if (isHigh(bars, j, piv)) push(1, j, k);
    if (isLow(bars, j, piv)) push(-1, j, k); }
  return out;
}

// the trigger of one setup: { k (trigger close), e (entry candle) } or { skip }
export function trigger(bars, s, piv = PIV, wait = WAIT) {
  for (let k = s.c + 1; k < bars.length; k++) { const b = bars[k];
    if (k > s.c + piv + wait) return { skip: 'expired' };
    if (s.side > 0 ? b.low <= s.C : b.high >= s.C) return { skip: 'through-C' };
    if (s.side > 0 ? b.close > s.B : b.close < s.B) {
      if (k < s.c + piv) return { skip: 'before-confirm' };
      if (k + 1 >= bars.length) return { skip: 'no-entry-candle' };
      return { k, e: k + 1 }; } }
  return { skip: 'no-data' };
}

export const targetD = (s) => s.C + (s.B - s.A);
export const targetHalf = (s) => s.B + 0.5 * (targetD(s) - s.B);

// manage one trade from the entry candle e (candle 1) for at most `hold` candles; stop first
export function manage(bars, e, side, stop, target, hold = HOLD) {
  const entry = bars[e].open, risk = side * (entry - stop);
  let q = e, exit = null, how = 'time';
  for (; q < bars.length && q < e + hold; q++) { const b = bars[q];
    if (side > 0 ? b.low <= stop : b.high >= stop) { exit = side > 0 ? Math.min(b.open, stop) : Math.max(b.open, stop); how = 'stop'; break; }
    if (side > 0 ? b.high >= target : b.low <= target) { exit = target; how = 'target'; break; } }
  if (exit == null) { q = Math.min(q, bars.length) - 1; if (q - e + 1 < hold) return { open: true }; exit = bars[q].close; }
  return { entry, stop, target, risk, R: side * (exit - entry) / risk, how, exitIdx: q, entryT: bars[e].time, exitT: bars[q].time + H4 };
}

// net of costs: $0.60 a round trip + financing on buys (nights x FIN.xau.long x entry / risk), both x mult
export function cost(tr, side, mult = 1) {
  const n = side > 0 ? nights(tr.entryT, tr.exitT) : 0, fin = n * FIN.xau.long * tr.entry / tr.risk;
  return { nights: n, fin, net: tr.R - mult * (COST / tr.risk + fin) };
}

// 17:00 New York trading days with their end time; sma = 50-day mean of closes up to and including the day
export function tradingDays(rows) {
  const out = []; let cur = null;
  for (const [t, , h, l, c] of rows) { const d = nyDay(t); if (d == null) continue;
    if (!cur || cur.d !== d) { cur = { d, high: h, low: l, close: c, end: t + H }; out.push(cur); }
    else { cur.high = Math.max(cur.high, h); cur.low = Math.min(cur.low, l); cur.close = c; cur.end = t + H; } }
  let s = 0; out.forEach((x, i) => { s += x.close; if (i >= SMA_N) s -= out[i - SMA_N].close; x.sma = i >= SMA_N - 1 ? s / SMA_N : null; });
  return out;
}
// the last trading day ended at or before t (binary search)
export function dayBefore(days, t) { let lo = 0, hi = days.length - 1, r = null;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (days[m].end <= t) { r = days[m]; lo = m + 1; } else hi = m - 1; } return r; }
// the last day may still be open: only days whose end is in the past of the candle file count (dayBefore handles it)
export const trendOk = (days, t, side) => { const d = dayBefore(days, t); return !!(d && d.sma != null && (side > 0 ? d.close > d.sma : d.close < d.sma)); };

// one test's stream: one position at a time; candidates sorted by entry candle
export function stream(bars, cands, targetOf, filter = () => true) {
  const T = []; let busy = -1;
  for (const x of cands) { if (x.e <= busy || !filter(x)) continue;
    const s = x.s, stop = s.C - s.side * BUF, target = targetOf(s), entry = bars[x.e].open;
    if (s.side * (target - entry) <= 0) { continue; }
    const tr = manage(bars, x.e, s.side, stop, target); if (tr.open) continue;
    busy = tr.exitIdx; const c1 = cost(tr, s.side), c2 = cost(tr, s.side, 2);
    T.push({ ...tr, side: s.side, e: x.e, t: tr.entryT, nights: c1.nights, fin: c1.fin, net: c1.net, net2: c2.net, A: s.A, B: s.B, C: s.C }); }
  return T;
}

export function stats(T, k = 'net') {
  const n = T.length, v = T.map((x) => x[k]), s = v.reduce((a, x) => a + x, 0), m = n ? s / n : 0, sd = n > 1 ? Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1)) : 0;
  const win = v.filter((x) => x > 0).reduce((a, x) => a + x, 0), loss = -v.filter((x) => x < 0).reduce((a, x) => a + x, 0);
  let eq = 0, pk = 0, dd = 0; for (const x of v) { eq += x; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  return { n, avg: +m.toFixed(3), total: +s.toFixed(1), pf: loss ? +(win / loss).toFixed(2) : null, wr: n ? +(v.filter((x) => x > 0).length / n * 100).toFixed(1) : null, t: sd ? +(m / (sd / Math.sqrt(n))).toFixed(2) : null, dd: +dd.toFixed(1) };
}
// t of calendar-month sums, every month from..to (YYYY-MM) counted, 0 when no trade
export function monthT(T, from, to, k = 'net') {
  const m = new Map(); for (const x of T) { const key = ymd(x.t).slice(0, 7); m.set(key, (m.get(key) || 0) + x[k]); }
  const v = []; let [y, mo] = from.split('-').map(Number); const [ey, em] = to.split('-').map(Number);
  while (y < ey || (y === ey && mo <= em)) { v.push(m.get(`${y}-${String(mo).padStart(2, '0')}`) || 0); mo++; if (mo > 12) { mo = 1; y++; } }
  const n = v.length, a = v.reduce((p, q) => p + q, 0) / n, sd = Math.sqrt(v.reduce((p, q) => p + (q - a) ** 2, 0) / (n - 1));
  return { months: n, avg: +a.toFixed(3), t: sd ? +(a / (sd / Math.sqrt(n))).toFixed(2) : null };
}
function erfc(x) { const z = Math.abs(x), t = 1 / (1 + 0.5 * z), r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? r : 2 - r; }
export const p1 = (t) => 0.5 * erfc(t / Math.SQRT2);
export function holm(ps) { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = Array(ps.length); let m = 0;
  o.forEach(([p, i], r) => { m = Math.max(m, Math.min(1, p * (ps.length - r))); adj[i] = m; }); return adj; }
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// one placebo seed: each real trade at its entry candle, same stop and target distances, random side
export function placebo(bars, T, seed) {
  const r = rng(seed), out = [];
  for (const x of T) { const side = r() < 0.5 ? 1 : -1, entry = bars[x.e].open, sd = Math.abs(x.entry - x.stop), td = Math.abs(x.target - x.entry);
    const tr = manage(bars, x.e, side, entry - side * sd, entry + side * td); if (tr.open) continue;
    out.push({ ...tr, side, t: tr.entryT, net: cost(tr, side).net }); }
  return out;
}

export const within = (T, [f, t]) => T.filter((x) => ymd(x.t) >= f && ymd(x.t) <= t);

export function study(rows) {
  const bars = h4(rows), days = tradingDays(rows), S = setups(bars), funnel = { setups: S.length, long: S.filter((s) => s.side > 0).length, short: S.filter((s) => s.side < 0).length };
  const cands = [];
  for (const s of S) { const g = trigger(bars, s); if (g.skip) { funnel[g.skip] = (funnel[g.skip] || 0) + 1; continue; } cands.push({ s, e: g.e }); }
  funnel.triggered = cands.length;
  cands.sort((a, b) => a.e - b.e);
  // the same entry candle can come from two setups (a replaced C): keep the first one found
  const seen = new Set(), uniq = cands.filter((x) => { const key = `${x.e}:${x.s.side}`; if (seen.has(key)) return false; seen.add(key); return true; });
  funnel.duplicates = cands.length - uniq.length;
  const tests = {
    T1: stream(bars, uniq, targetD),
    T2: stream(bars, uniq, targetHalf),
    T3: stream(bars, uniq, targetD, (x) => trendOk(days, bars[x.e].time, x.s.side)),
  };
  return { bars, days, setups: S, funnel, tests };
}

function report(rows) {
  const { bars, funnel, tests } = study(rows), out = {
    built: new Date().toISOString().slice(0, 10),
    data: { src: 'OANDA mid H1 XAU_USD via the site proxy, H4 in UTC buckets 02/06/10/14/18/22', from: ymd(bars[0].time), to: ymd(bars.at(-1).time), h1: rows.length, h4: bars.length },
    rule: { piv: PIV, atr: ATR_N, abAtr: AB_ATR, bc: [BC_MIN, BC_MAX], buffer: BUF, cost: COST, hold: HOLD, wait: WAIT, sma: SMA_N, fin: FIN.xau.long },
    windows: { is: IS, oos: OOS }, funnel, tests: {},
  };
  const ps = [];
  for (const [k, T] of Object.entries(tests)) {
    const I = within(T, IS), O = within(T, OOS), r = {
      is: { net: stats(I), gross: stats(I, 'R'), month: monthT(I, IS[0].slice(0, 7), IS[1].slice(0, 7)) },
      oos: { net: stats(O), gross: stats(O, 'R'), x2: stats(O, 'net2'), month: monthT(O, OOS[0].slice(0, 7), OOS[1].slice(0, 7)), monthGross: monthT(O, OOS[0].slice(0, 7), OOS[1].slice(0, 7), 'R') },
      fin: +O.reduce((a, x) => a + x.fin, 0).toFixed(2),
      byExit: Object.fromEntries(['stop', 'target', 'time'].map((h) => [h, { is: I.filter((x) => x.how === h).length, oos: O.filter((x) => x.how === h).length }])),
      bySide: { long: { is: stats(I.filter((x) => x.side > 0)), oos: stats(O.filter((x) => x.side > 0)) }, short: { is: stats(I.filter((x) => x.side < 0)), oos: stats(O.filter((x) => x.side < 0)) } },
      years: {},
    };
    for (let y = 2008; y <= 2026; y++) { const X = within(T, [`${y}-01-01`, `${y}-12-31`]); if (X.length) { const s = stats(X); r.years[y] = { n: s.n, avg: s.avg, total: s.total }; } }
    const pm = [], ph = []; for (let s = 1; s <= SEEDS; s++) { const P = placebo(bars, O, s); pm.push(stats(P).avg); ph.push(+(P.filter((x) => x.how === 'target').length / P.length * 100).toFixed(1)); }
    const sorted = [...pm].sort((a, b) => a - b);
    r.placebo = { seeds: SEEDS, means: pm, beaten: pm.filter((v) => r.oos.net.avg > v).length, min: sorted[0], median: sorted[SEEDS / 2], max: sorted.at(-1), targetShare: { real: +(O.filter((x) => x.how === 'target').length / O.length * 100).toFixed(1), placeboMedian: [...ph].sort((a, b) => a - b)[SEEDS / 2] } };
    out.tests[k] = r; ps.push(p1(r.oos.month.t ?? 0));
  }
  const adj = holm(ps);
  Object.keys(tests).forEach((k, i) => { const r = out.tests[k];
    r.p = +ps[i].toFixed(4); r.pHolm = +adj[i].toFixed(4);
    r.checks = { oosPositive: r.oos.net.avg > 0, monthT2: (r.oos.month.t ?? 0) >= 2, holm: adj[i] < 0.05, isPositive: r.is.net.avg > 0, x2Positive: r.oos.x2.avg > 0, placebo38: r.placebo.beaten >= 38, n30: r.oos.net.n >= 30 };
    r.pass = Object.values(r.checks).every(Boolean); });
  out.passed = Object.keys(tests).filter((k) => out.tests[k].pass);
  out.verdict = out.passed.length ? 'PASS' : 'FAIL';
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify(out, null, 1));
}

async function fetchH1(dir) {
  let from = Math.floor(Date.parse('2006-03-01') / 1000); const now = Math.floor(Date.now() / 1000), all = [];
  while (from < now) { const to = Math.min(now, from + 4990 * H);
    let j, ok = false;
    for (let a = 0; a < 4 && !ok; a++) { try { const r = await fetch(`https://meridianx.dev/md/bars?sym=xau&tf=1h&from=${from}&to=${to}`); j = await r.json(); ok = r.ok; } catch { ok = false; } if (!ok) await new Promise((s) => setTimeout(s, 4000 * (a + 1))); }
    if (!ok) throw new Error(`proxy failed ${from}`);
    for (const b of j.bars || []) if (!b.live) all.push([b.time, b.open, b.high, b.low, b.close]);
    process.stderr.write(`xau ${ymd(from)} ${all.length}\n`); from = to; await new Promise((s) => setTimeout(s, 2200)); }
  const seen = new Set(), rows = all.filter((x) => !seen.has(x[0]) && seen.add(x[0])).sort((a, b) => a[0] - b[0]);
  while (rows.length && rows.at(-1)[0] + H > now) rows.pop();
  fs.writeFileSync(path.join(dir, 'xau-h1.json'), JSON.stringify(rows));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') { fs.mkdirSync(dir, { recursive: true }); await fetchH1(dir); }
  else if (cmd === 'full') report(JSON.parse(fs.readFileSync(path.join(dir, 'xau-h1.json'), 'utf8')));
  else console.log('usage: run.mjs fetch|full <dir>');
}
