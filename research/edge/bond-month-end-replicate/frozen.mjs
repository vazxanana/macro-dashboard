// The month-end index-extension effect in US Treasuries, out of sample (pre-registered: PREREGISTRATION.md, 14 Nov 2026).
// Long the bond CFD from the close of the month's 4th-to-last US trading day to the close of its last; stop 2 x ATR(20).
//   node research/edge/bond-month-end/run.mjs fetch <dir>   (git show from origin/council-data, no network; kept out of git)
//   node research/edge/bond-month-end/run.mjs full <dir>    (writes result.json beside this file)
// Research only: nothing live reads this file.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { usHolidays } from '../../../council/datacheck.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ATR_N = 20, STOP_ATR = 2, HOLD = 3, FIN_YEAR = 0.03, SEEDS = 40, PROFILE_K = 18, GAP_ATR = 1;
export const DECISIVE_FROM = 2016;
export const MARKETS = {
  usb10y: { label: 'US 10-year note (USB10Y)', cost: 0.0003, cal: 'us', judged: 'T1' },
  usb30y: { label: 'US 30-year bond (USB30Y)', cost: 0.0005, cal: 'us', judged: 'T2' },
  usb05y: { label: 'US 5-year note (USB05Y)', cost: 0.0003, cal: 'us' },
  usb02y: { label: 'US 2-year note (USB02Y)', cost: 0.0002, cal: 'us' },
  de10yb: { label: 'German Bund (DE10YB)', cost: 0.0003, cal: 'file' },
  uk10yb: { label: 'UK Gilt (UK10YB)', cost: 0.0004, cal: 'file' },
};
export const ROLL_MONTHS = [2, 5, 8, 11];

// ─── US bond-market trading days ───
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const SPECIAL = new Set(['2004-06-11', '2007-01-02', '2012-10-29', '2012-10-30', '2018-12-05', '2025-01-09']);
const HOLCACHE = new Map();
export function usBondHolidays(y) {
  if (HOLCACHE.has(y)) return HOLCACHE.get(y);
  const s = new Set();
  for (const d of usHolidays(y).keys()) if (+d.slice(0, 4) === y) s.add(d);
  const nov1 = new Date(Date.UTC(y, 10, 1)).getUTCDay(), thanks = 1 + ((4 - nov1 + 7) % 7) + 21;
  s.delete(iso(Date.UTC(y, 10, thanks + 1)));                      // day after Thanksgiving: a half day, trading
  if (new Date(Date.UTC(y, 11, 25)).getUTCDay() !== 6) s.delete(`${y}-12-24`); // Christmas Eve: a half day (unless Christmas is observed on it)
  if (y < 2022) for (const d of [...s]) if (d.slice(5, 7) === '06' && +d.slice(8) >= 18 && +d.slice(8) <= 20) s.delete(d); // Juneteenth from 2022
  const oct1 = new Date(Date.UTC(y, 9, 1)).getUTCDay(); s.add(iso(Date.UTC(y, 9, 1 + ((1 - oct1 + 7) % 7) + 7)));  // Columbus Day
  const v = new Date(Date.UTC(y, 10, 11)).getUTCDay(); s.add(iso(Date.UTC(y, 10, 11 + (v === 6 ? -1 : v === 0 ? 1 : 0)))); // Veterans Day
  for (const d of SPECIAL) if (+d.slice(0, 4) === y) s.add(d);
  HOLCACHE.set(y, s); return s;
}
export function isUsTradingDay(ymd, hol = usBondHolidays) {
  const w = new Date(ymd + 'T00:00:00Z').getUTCDay();
  return w >= 1 && w <= 5 && !hol(+ymd.slice(0, 4)).has(ymd);
}
export function calendar(from, to, isTrading) {
  const out = []; for (let t = Date.parse(from + 'T00:00:00Z'), e = Date.parse(to + 'T00:00:00Z'); t <= e; t += 86400e3) { const d = iso(t); if (isTrading(d)) out.push(d); }
  return out;
}
// offset from the month's end: -1 = last trading day of its calendar month
export function fromEnd(days) {
  const L = {}; let i = days.length - 1;
  while (i >= 0) { const m = days[i].slice(0, 7); let k = -1; while (i >= 0 && days[i].slice(0, 7) === m) { L[days[i]] = k--; i--; } }
  return L;
}

// ─── trading-day bars (weekend / holiday candles folded into the next trading day) ───
export function buildDays(rows, days) {
  const byD = new Map(rows.map((r, i) => [iso(r[0] * 1000), i]));
  const D = []; let ri = 0;
  for (const d of days) {
    const own = byD.get(d), end = Date.parse(d + 'T00:00:00Z') / 1000;
    const from = ri; while (ri < rows.length && rows[ri][0] <= end) ri++;
    if (own == null) { D.push({ d, c: null, ri: null }); continue; }
    const seg = rows.slice(from, ri);
    D.push({ d, t: rows[own][0], o: seg[0][1], h: Math.max(...seg.map((r) => r[2])), l: Math.min(...seg.map((r) => r[3])), c: rows[own][4], ri: own });
  }
  return D;
}
export function atrAt(D, k, n = ATR_N) {
  if (k < n) return null; let s = 0;
  for (let j = k - n + 1; j <= k; j++) { const x = D[j], p = D[j - 1]; if (x.c == null || p.c == null) return null; s += Math.max(x.h - x.l, Math.abs(x.h - p.c), Math.abs(x.l - p.c)); }
  return s / n;
}
const nights = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400e3);

// one long trade: entry at the close of D[e], exit at the close of D[x]; the stop on every raw candle after the entry candle
export function trade(rows, D, e, x, cost) {
  const E = D[e], X = D[x]; if (!E || !X || E.c == null || X.c == null) return null;
  const atr = atrAt(D, e); if (atr == null || !(atr > 0)) return null;
  const entry = E.c, dist = STOP_ATR * atr, stop = entry - dist;
  let exit = X.c, how = 'time', exitD = X.d;
  for (let i = E.ri + 1; i <= X.ri; i++) {
    const r = rows[i];
    if (r[1] <= stop) { exit = r[1]; how = 'gap'; exitD = iso(r[0] * 1000); break; }
    if (r[3] <= stop) { exit = stop; how = 'stop'; exitD = iso(r[0] * 1000); break; }
  }
  const n = nights(E.d, exitD);
  return { entryD: E.d, exitD, t0: E.t, t1: X.t, entry, stop: +stop.toFixed(5), dist, exit, how, nights: n,
    gross: (exit - entry) / dist, costR: cost * entry / dist, finR: FIN_YEAR / 365 * n * entry / dist };
}
export const netOf = (t, mult = 1) => t.gross - mult * (t.costR + t.finR);

// ─── statistics (copied from research/edge/turn-of-month, branch turn-of-month) ───
export function stats(xs) {
  const n = xs.length; if (!n) return { n: 0, mean: null, sd: null, t: null };
  const mean = xs.reduce((a, b) => a + b, 0) / n, sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  return { n, mean, sd, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : null };
}
const erf = (x) => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
export const pOneSided = (t) => t == null ? 1 : 0.5 * (1 - erf(t / Math.SQRT2));
export function holm(ps) {
  const order = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = new Array(ps.length);
  let run = 0;
  order.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, p * (ps.length - k))); adj[i] = run; });
  return adj;
}
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pct = (xs, q) => { const s = [...xs].sort((a, b) => a - b), i = (s.length - 1) * q, lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };

// entry at TD-k of each month, exit HOLD trading days later; k = 4 is the rule (exit at TD-1)
export function windowTrades(rows, D, L, k, cost) {
  const out = [], skipped = [], lastD = iso(rows.at(-1)[0] * 1000);
  for (let e = 0; e < D.length; e++) {
    if (L[D[e].d] !== -k) continue;
    const x = e + HOLD; if (x >= D.length || D[x].d > lastD) continue;   // exit not on file yet: not a trade, not a skip
    const t = trade(rows, D, e, x, cost);
    if (t) out.push(t); else skipped.push(D[e].d);
  }
  return { trades: out, skipped };
}
const yr = (d) => +d.slice(0, 4), mon = (d) => +d.slice(5, 7);
const r3 = (x) => x == null ? null : +x.toFixed(3), r2 = (x) => x == null ? null : +x.toFixed(2);
function summ(ts, mult = 1) {
  const s = stats(ts.map((t) => netOf(t, mult))), g = stats(ts.map((t) => t.gross));
  return { n: s.n, net: r3(s.mean), t: r2(s.t), gross: r3(g.mean), tGross: r2(g.t), win: s.n ? r2(100 * ts.filter((t) => netOf(t, mult) > 0).length / s.n) : null,
    stops: ts.filter((t) => t.how !== 'time').length, gapStops: ts.filter((t) => t.how === 'gap').length, total: r2(ts.reduce((a, t) => a + netOf(t, mult), 0)),
    costR: r3(stats(ts.map((t) => t.costR)).mean), finR: r3(stats(ts.map((t) => t.finR)).mean) };
}
export const inDecisive = (t) => yr(t.entryD) >= DECISIVE_FROM;
export const inReplication = (t) => yr(t.entryD) < DECISIVE_FROM;

export function placebo(rows, D, counts, cost, seed) {
  const R = rng(seed), elig = {};
  for (let e = 0; e + HOLD < D.length; e++) { const y = yr(D[e].d); if (!(y in counts)) continue; const t = trade(rows, D, e, e + HOLD, cost); if (t) (elig[y] ||= []).push(t); }
  const nets = [];
  for (const [y, n] of Object.entries(counts)) { const pool = elig[y] || []; for (let i = 0; i < n && pool.length; i++) nets.push(netOf(pool[Math.floor(R() * pool.length)])); }
  return stats(nets).mean;
}
export function gapsOf(rows, D) {
  const out = [], idx = D.map((x, k) => x.t == null ? null : k).filter((k) => k != null); let j = -1;
  for (let i = 1; i < rows.length; i++) {
    while (j + 1 < idx.length && D[idx[j + 1]].t <= rows[i - 1][0]) j++;
    if (j < 0) continue;
    const atr = atrAt(D, idx[j]); if (atr == null) continue;
    const g = (rows[i][1] - rows[i - 1][4]) / atr;
    if (Math.abs(g) > GAP_ATR) out.push({ d: iso(rows[i][0] * 1000), t: rows[i][0], atr: r2(g) });
  }
  return out;
}

export function runMarket(key, json) {
  const M = MARKETS[key], rows = json.rows.filter((r) => r.every(Number.isFinite));
  const first = iso(rows[0][0] * 1000), last = iso(rows.at(-1)[0] * 1000);
  const fileDays = new Set(rows.map((r) => iso(r[0] * 1000)));
  const isT = M.cal === 'us' ? (d) => isUsTradingDay(d) : (d) => { const w = new Date(d + 'T00:00:00Z').getUTCDay(); return w >= 1 && w <= 5 && fileDays.has(d); };
  // the calendar runs to the end of the last month on file, so the last (incomplete) month's TD labels are right; days past the file have no close
  const lastMonthEnd = iso(Date.UTC(+last.slice(0, 4), +last.slice(5, 7), 0));
  const days = calendar(first, lastMonthEnd, isT), L = fromEnd(days), D = buildDays(rows, days);
  const rule = windowTrades(rows, D, L, 4, M.cost);
  const dec = rule.trades.filter(inDecisive), rep = rule.trades.filter(inReplication);
  const gaps = gapsOf(rows, D);
  const hasGap = (t) => gaps.some((g) => g.t > t.t0 && g.t <= t.t1);
  const rollOut = (t) => (M.cal === 'us' && ROLL_MONTHS.includes(mon(t.entryD))) || hasGap(t);
  const counts = {}; for (const t of dec) counts[yr(t.entryD)] = (counts[yr(t.entryD)] || 0) + 1;
  const pl = []; for (let s = 1; s <= SEEDS; s++) pl.push(placebo(rows, D, counts, M.cost, s));
  const decMean = stats(dec.map((t) => netOf(t))).mean;
  const profile = [];
  for (let k = 1; k <= PROFILE_K; k++) { const w = windowTrades(rows, D, L, k, M.cost).trades.filter(inDecisive), s = stats(w.map((t) => netOf(t))); profile.push({ k, entry: `TD-${k}`, n: s.n, net: r3(s.mean), t: r2(s.t), gross: r3(stats(w.map((t) => t.gross)).mean) }); }
  const rank = 1 + profile.filter((p) => p.k !== 4 && p.net > profile[3].net).length;
  const perYear = {}; for (const t of rule.trades) { const y = yr(t.entryD); (perYear[y] ||= []).push(t); }
  return {
    key, label: M.label, judged: M.judged || null, inst: json.inst, first, last, costPct: M.cost * 100, calendar: M.cal,
    decisive: summ(dec), replication: summ(rep),
    cost: Object.fromEntries([0, 1, 2].map((m) => [`x${m}`, { decisive: (({ n, net, t }) => ({ n, net, t }))(summ(dec, m)), replication: (({ n, net, t }) => ({ n, net, t }))(summ(rep, m)) }])),
    placebo: { seeds: SEEDS, means: pl.map(r3), median: r3(pct(pl, 0.5)), p95: r3(pct(pl, 0.95)), beaten: pl.filter((p) => decMean > p).length, ruleMean: r3(decMean) },
    profile, rank, rankOf: profile.length,
    roll: { rule: 'entered in Feb / May / Aug / Nov (US) or a gap candle over 1 x ATR inside the window', decisive: summ(dec.filter((t) => !rollOut(t))), replication: summ(rep.filter((t) => !rollOut(t))),
      removedDecisive: dec.filter(rollOut).length, removedReplication: rep.filter(rollOut).length,
      rollMonthsDecisive: summ(dec.filter((t) => ROLL_MONTHS.includes(mon(t.entryD)))) },
    gaps, gapsInRule: rule.trades.filter(hasGap).map((t) => t.entryD),
    perYear: Object.fromEntries(Object.entries(perYear).map(([y, ts]) => [y, { n: ts.length, net: r3(stats(ts.map((t) => netOf(t))).mean), total: r2(ts.reduce((a, t) => a + netOf(t), 0)) }])),
    skipped: rule.skipped,
    trades: rule.trades.map((t) => [t.entryD, t.exitD, +t.entry.toFixed(4), t.stop, +t.exit.toFixed(4), t.how, r3(t.gross), r3(netOf(t))]),
  };
}

export function verdictOf(M) {
  const J = ['usb10y', 'usb30y'].map((k) => M[k]);
  const adj = holm(J.map((m) => pOneSided(m.decisive.t)));
  const tests = J.map((m, i) => {
    const c = { decisivePositive: m.decisive.net > 0, replicationPositive: m.replication.net > 0, tAtLeast2: m.decisive.t != null && m.decisive.t >= 2,
      holm: adj[i] < 0.05, placebo: m.placebo.ruleMean > m.placebo.p95 };
    return { test: m.judged, market: m.key, holmP: +adj[i].toFixed(4), pOneSided: +pOneSided(m.decisive.t).toFixed(4), checks: c, pass: Object.values(c).every(Boolean) };
  });
  const passed = tests.filter((t) => t.pass).length;
  return { tests, passed, verdict: passed ? 'PASS' : 'FAIL' };
}

function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const k of [...Object.keys(MARKETS), '_index']) fs.writeFileSync(path.join(dir, `${k}.json`), execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
  console.log('wrote', dir);
}
function full(dir) {
  const idx = JSON.parse(fs.readFileSync(path.join(dir, '_index.json'), 'utf8')).symbols;
  const M = {};
  for (const k of Object.keys(MARKETS)) { if (idx[k]?.status !== 'ok') throw new Error(`${k} not ok in _index.json`); M[k] = runMarket(k, JSON.parse(fs.readFileSync(path.join(dir, `${k}.json`), 'utf8'))); }
  const V = verdictOf(M);
  const out = { study: 'bond-month-end', built: '2026-11-14', verdict: V.verdict, passed: V.passed, of: 2, tests: V.tests,
    rule: 'long at the close of TD-4, exit at the close of TD-1 (US trading days), stop 2 x ATR(20), costs + 3 % a year financing',
    decisive: `${DECISIVE_FROM}-01 on`, markets: M };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  for (const k of Object.keys(M)) { const m = M[k]; console.log(k, 'dec', JSON.stringify(m.decisive), 'rep', JSON.stringify(m.replication), 'pl', m.placebo.p95, m.placebo.beaten, 'rank', m.rank); }
  console.log(JSON.stringify(V, null, 1));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') fetchAll(dir); else if (cmd === 'full') full(dir); else console.log('usage: run.mjs fetch|full <dir>');
}
