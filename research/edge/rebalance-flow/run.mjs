// Edge research · rebalance-flow: the month-end balanced-fund rebalancing flow on SPX500 and NAS100 (PREREGISTRATION.md).
// At the close of the month's fifth-to-last NYSE trading day, the SPX500-minus-USB10Y return since the previous month-end is ranked
// against the 36 prior months: top third -> sell, bottom third -> buy, exit at the month's last trading-day close. Stop 2.5 x ATR(20)
// daily with gap fill; spread and financing in R. Four tests (all months / quarter-end x SPX500 / NAS100), Holm, 40-seed placebo.
//   node research/edge/rebalance-flow/run.mjs <candleDir>   (spx500.json, nas100.json, usb10y.json from council-data research/daily;
//                                                             writes result.json beside this file)
// The calendar, ATR / stop and financing code is copied from the turn-of-month study (sibling branch), adapted to daily candles.
import fs from 'node:fs';
import path from 'node:path';
import { cmeYear } from '../../../ict/calendar.mjs';

export const MARKETS = { spx500: { name: 'S&P 500 (SPX500)', pts: 1 }, nas100: { name: 'Nasdaq 100 (NAS100)', pts: 3 } };
export const FIN_ADD = 2.5;              // percent a year over / under the 2-year yield
export const ATR_N = 20, STOP_ATR = 2.5, LOOK = 36, THIRD = 24, SEEDS = 40, SEEDS_NEED = 38;
export const DEC = ['2016-01', '2026-10'], REP = ['2008-01', '2015-12'];
export const QUARTER = new Set([3, 6, 9, 12]);
export const TESTS = { A: { mk: 'spx500', q: false }, B: { mk: 'spx500', q: true }, C: { mk: 'nas100', q: false }, D: { mk: 'nas100', q: true } };
// NYSE closures that are not on the CME calendar's list (stated in the pre-registration)
export const SPECIAL = new Set(['2007-01-02', '2012-10-29', '2012-10-30', '2018-12-05', '2025-01-09']);
const NYSE_FROM_EARLY = new Set(['Martin Luther King Day', "Presidents' Day", 'Memorial Day', 'Juneteenth', 'Independence Day', 'Labor Day', 'Thanksgiving Day']);

export const ymdOf = (sec) => new Date(sec * 1000).toISOString().slice(0, 10);
export function isTradingDay(ymd) {
  const wd = new Date(ymd + 'T12:00:00Z').getUTCDay();
  if (wd === 0 || wd === 6 || SPECIAL.has(ymd)) return false;
  const Y = cmeYear(+ymd.slice(0, 4));
  if (Y.full.has(ymd)) return false;
  const e = Y.early.get(ymd);
  return !(e && NYSE_FROM_EARLY.has(e.name));
}
// the NYSE trading days of a month 'YYYY-MM'
export function monthDays(ym) {
  const [y, m] = ym.split('-').map(Number), out = [];
  for (let d = 1; d <= 31; d++) { const t = Date.UTC(y, m - 1, d); if (new Date(t).getUTCMonth() !== m - 1) break; const s = ymdOf(t / 1000); if (isTradingDay(s)) out.push(s); }
  return out;
}
export const prevMonth = (ym) => { const [y, m] = ym.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; };
export const addMonths = (ym, k) => { const [y, m] = ym.split('-').map(Number); const n = y * 12 + (m - 1) + k; return `${Math.floor(n / 12)}-${String(n % 12 + 1).padStart(2, '0')}`; };
export const signalDay = (ym) => monthDays(ym).at(-5);
export const lastDay = (ym) => monthDays(ym).at(-1);

// rows [t, o, h, l, c, v] -> folded weekday candles { d, o, h, l, c }
export function fold(rows) {
  const out = []; let pend = null;
  for (const r of rows) {
    const d = ymdOf(r[0]), wd = new Date(r[0] * 1000).getUTCDay();
    if (wd === 0 || wd === 6) { pend = pend ? { o: pend.o, h: Math.max(pend.h, r[2]), l: Math.min(pend.l, r[3]) } : { o: r[1], h: r[2], l: r[3] }; continue; }
    const b = { d, o: r[1], h: r[2], l: r[3], c: r[4] };
    if (pend) { b.o = pend.o; b.h = Math.max(b.h, pend.h); b.l = Math.min(b.l, pend.l); pend = null; }
    out.push(b);
  }
  return out;
}
// ATR(n) of the n folded candles ending with index k (true range against the previous close); null without n + 1 candles
export function atrAt(B, k, n = ATR_N) {
  if (k - n < 0) return null;
  let s = 0;
  for (let j = k - n + 1; j <= k; j++) { const a = B[j], p = B[j - 1]; s += Math.max(a.h - a.l, Math.abs(a.h - p.c), Math.abs(a.l - p.c)); }
  return s / n;
}
export function rateOf(dgs2) {
  return (ymd) => { let v = null; for (const [d, x] of dgs2) { if (d > ymd) break; v = x; } return v; };
}
export const nights = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400e3);

// one trade: side +1 buy / -1 sell, entry at the close of candle e (date sD), exit at the close of date xD unless stopped
export function trade(B, idx, sD, xD, side, { pts, rate }) {
  const e = idx.get(sD), x = idx.get(xD);
  if (e == null || x == null || x <= e) return null;
  const atr = atrAt(B, e);
  if (atr == null || !(atr > 0)) return null;
  const entry = B[e].c, risk = STOP_ATR * atr, stop = entry - side * risk;
  let exit = B[x].c, exitD = xD, how = 'time';
  for (let j = e + 1; j <= x; j++) {
    const b = B[j];
    if (side > 0 ? b.o <= stop : b.o >= stop) { exit = b.o; how = 'stop-gap'; exitD = b.d; break; }
    if (side > 0 ? b.l <= stop : b.h >= stop) { exit = stop; how = 'stop'; exitD = b.d; break; }
  }
  const r = rate(sD) ?? 0, n = nights(sD, exitD);
  const finCash = (side > 0 ? -(r + FIN_ADD) : (r - FIN_ADD)) / 100 / 365 * n * entry;   // + = received
  const gross = side * (exit - entry) / risk, costR = pts / risk, finR = finCash / risk;
  return { sD, exitD, side, entry, stop, risk, exit, how, nights: n, gross, costR, finR, net: gross - costR + finR };
}

// Diff(m) for every month with both closes on file
export function diffs(Beq, Ieq, Bbd, Ibd, from, to) {
  const out = new Map();
  for (let ym = from; ym <= to; ym = addMonths(ym, 1)) {
    const S = signalDay(ym), P = lastDay(prevMonth(ym));
    const a = Ieq.get(S), b = Ieq.get(P), c = Ibd.get(S), d = Ibd.get(P);
    if ([a, b, c, d].some((v) => v == null)) continue;
    out.set(ym, (Beq[a].c / Beq[b].c - 1) - (Bbd[c].c / Bbd[d].c - 1));
  }
  return out;
}
// the signal of month ym from the 36 prior months only: +1 buy (bottom third), -1 sell (top third), 0 middle, null no history
export function signalOf(D, ym) {
  const v = D.get(ym); if (v == null) return null;
  const prior = []; for (let k = 1; k <= LOOK; k++) { const p = D.get(addMonths(ym, -k)); if (p == null) return null; prior.push(p); }
  const below = prior.filter((p) => p < v).length, above = prior.filter((p) => p > v).length;
  return below >= THIRD ? -1 : above >= THIRD ? 1 : 0;
}

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

const r3 = (x) => x == null ? null : +x.toFixed(3), r2 = (x) => x == null ? null : +x.toFixed(2);
const inWin = (ym, w) => ym >= w[0] && ym <= w[1];
export function summ(ts) {
  const s = stats(ts.map((t) => t.net)), g = stats(ts.map((t) => t.gross));
  return { n: s.n, net: r3(s.mean), t: r2(s.t), gross: r3(g.mean), tGross: r2(g.t), win: s.n ? r2(100 * ts.filter((t) => t.net > 0).length / s.n) : null,
    stops: ts.filter((t) => t.how !== 'time').length, total: r2(ts.reduce((a, t) => a + t.net, 0)), cost: r3(s.n ? ts.reduce((a, t) => a + t.costR, 0) / s.n : null), fin: r3(s.n ? ts.reduce((a, t) => a + t.finR, 0) / s.n : null),
    buys: ts.filter((t) => t.side > 0).length, sells: ts.filter((t) => t.side < 0).length };
}

// every month's signal and trade for one traded market
export function ruleTrades(eq, bd, mk, rates) {
  const Beq = fold(eq), Bbd = fold(bd), Bmk = fold(mk);
  const I = (B) => new Map(B.map((b, i) => [b.d, i]));
  const Ieq = I(Beq), Ibd = I(Bbd), Imk = I(Bmk);
  const D = diffs(Beq, Ieq, Bbd, Ibd, '2003-04', DEC[1]);
  const out = [], counts = { noDiff: 0, noHistory: 0, middle: 0, noCandle: 0 };
  for (let ym = REP[0]; ym <= DEC[1]; ym = addMonths(ym, 1)) {
    const s = signalOf(D, ym);
    if (s == null) { counts[D.has(ym) ? 'noHistory' : 'noDiff']++; continue; }
    if (s === 0) { counts.middle++; continue; }
    const t = trade(Bmk, Imk, signalDay(ym), lastDay(ym), s, rates);
    if (!t) { counts.noCandle++; continue; }
    out.push({ ym, diff: D.get(ym), ...t });
  }
  return { trades: out, counts, B: Bmk, idx: Imk, D };
}

export function runTest(rt, q, rates) {
  const keep = rt.trades.filter((t) => !q || QUARTER.has(+t.ym.slice(5)));
  const dec = keep.filter((t) => inWin(t.ym, DEC)), rep = keep.filter((t) => inWin(t.ym, REP));
  const ruleMean = stats(dec.map((t) => t.net)).mean;
  const seeds = [];
  for (let s = 1; s <= SEEDS; s++) {
    const R = rng(s), nets = dec.map((t) => trade(rt.B, rt.idx, t.sD, lastDay(t.ym), R() < 0.5 ? 1 : -1, rates).net);
    seeds.push(r3(stats(nets).mean));
  }
  const sorted = [...seeds].sort((a, b) => a - b);
  const o = summ(dec);
  return {
    dec: o, rep: summ(rep), pOne: pOneSided(o.t),
    bySide: { dec: { buy: summ(dec.filter((t) => t.side > 0)), sell: summ(dec.filter((t) => t.side < 0)) }, rep: { buy: summ(rep.filter((t) => t.side > 0)), sell: summ(rep.filter((t) => t.side < 0)) } },
    byYear: Object.fromEntries([...new Set(keep.map((t) => t.ym.slice(0, 4)))].map((y) => [y, summ(keep.filter((t) => t.ym.startsWith(y)))])),
    placebo: { seeds, ruleMean: r3(ruleMean), beaten: seeds.filter((m) => ruleMean > m).length, need: SEEDS_NEED, p95: sorted[Math.ceil(0.95 * SEEDS) - 1], median: sorted[SEEDS / 2] },
    trades: keep.map((t) => [t.ym, t.sD, t.exitD, t.side, t.how, r3(t.diff * 100), r3(t.gross), r3(t.net)]),
  };
}

export function verdictOf(T) {
  const keys = Object.keys(TESTS), adj = holm(keys.map((k) => T[k].pOne)), checks = {};
  keys.forEach((k, i) => {
    const x = T[k];
    const c = { net: x.dec.net > 0, t: x.dec.t != null && x.dec.t >= 2, rep: x.rep.net > 0, holmP: +adj[i].toFixed(4), placebo: x.placebo.beaten >= SEEDS_NEED };
    c.holm = c.holmP < 0.05; c.pass = c.net && c.t && c.rep && c.holm && c.placebo;
    checks[k] = c;
  });
  const passed = keys.filter((k) => checks[k].pass);
  return { verdict: passed.length ? 'PASS' : 'FAIL', passed, checks };
}

export function runAll(files, dgs2) {
  const rate = rateOf(dgs2), T = {}, M = {};
  for (const mk of Object.keys(MARKETS)) M[mk] = ruleTrades(files.spx500, files.usb10y, files[mk], { pts: MARKETS[mk].pts, rate });
  for (const [k, def] of Object.entries(TESTS)) T[k] = { market: def.mk, quarterEnd: def.q, ...runTest(M[def.mk], def.q, { pts: MARKETS[def.mk].pts, rate }) };
  return { T, counts: Object.fromEntries(Object.entries(M).map(([k, m]) => [k, m.counts])), v: verdictOf(T) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candleDir>');
  const here = path.dirname(new URL(import.meta.url).pathname);
  const rates = JSON.parse(fs.readFileSync(path.join(here, 'rates.json'), 'utf8'));
  const files = {}, meta = {};
  for (const k of ['spx500', 'nas100', 'usb10y']) { const j = JSON.parse(fs.readFileSync(path.join(dir, k + '.json'), 'utf8')); files[k] = j.rows; meta[k] = { inst: j.inst || j.sym, src: j.src, updated: j.updated, rows: j.rows.length, from: ymdOf(j.rows[0][0]), to: ymdOf(j.rows.at(-1)[0]) }; }
  const { T, counts, v } = runAll(files, rates.DGS2);
  for (const k of Object.keys(T)) console.log(k, T[k].market, T[k].quarterEnd ? 'Q' : 'all', 'dec', JSON.stringify(T[k].dec), 'rep', JSON.stringify(T[k].rep), 'placebo', T[k].placebo.beaten, T[k].placebo.p95);
  const out = { built: '2026-11-13', study: 'rebalance-flow', title: 'The month-end rebalancing flow on US indices, out of sample', verdict: v.verdict, passed: v.passed, checks: v.checks,
    data: { src: 'OANDA mid daily candles, council-data research/daily (commit 48fdf4f89), weekend candles folded into the next weekday; 2-year yield FRED DGS2 weekly (rates.json)', files: meta,
      costs: Object.fromEntries(Object.entries(MARKETS).map(([k, m]) => [k, m.pts + ' points round trip'])), financing: `buy pays DGS2 + ${FIN_ADD}% a year, sell receives DGS2 - ${FIN_ADD}% a year, calendar nights`,
      windows: { decisive: DEC, replication: REP }, signal: 'SPX500 minus USB10Y return from the previous month-end to TD-5, ranked against the 36 prior months', stop: `${STOP_ATR} x ATR(${ATR_N}) daily, gap fill` },
    counts, tests: T };
  fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(v.verdict, JSON.stringify(v.checks));
}
