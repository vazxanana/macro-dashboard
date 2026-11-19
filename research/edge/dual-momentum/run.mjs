// Dual momentum (Antonacci 2014): each month hold the better of SPX500 and gold on its 12-month return, only if that return
// beats the 2Y yield's accrual; otherwise flat. Pre-registered in PREREGISTRATION.md (committed before any return was computed).
// Paper research only: a stand-alone allocation rule, not a test of the gold book (owner decision 44); nothing live reads this.
//   node research/edge/dual-momentum/run.mjs fetch <dir>   (git show from origin/council-data, no network)
//   node research/edge/dual-momentum/run.mjs full <dir>    (writes result.json next to this file)
// Cost / financing conventions are COPIED from the 13 Nov monthly timing studies (sma10-timing, gold-tsmom, tsmom-portfolio,
// vol-managed; not on main), not imported.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FIN, nights, foldWeekend } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['spx500', 'xau'];
export const NAMES = { spx500: 'SPX500', xau: 'Gold (XAU)' };
export const SPREAD = { spx500: 0.5, xau: 0.30 };       // price units, a full spread on every entry and exit
export const DIV = { spx500: 0.018, xau: 0 };            // sensitivity only: dividend yield a year while long
export const MARKUP = 0.025;                             // index financing: DGS2 + 2.5 % a year
export const LOOKBACKS = { L12: 252, L6: 126 };
export const ATR_N = 20, ATR_K = 3;
export const WINDOWS = { W1: { from: '2008-01-01', to: '2016-01-01', label: '2008-15 (check)' }, W2: { from: '2016-01-01', to: '2100-01-01', label: '2016 to now (decisive)' } };
export const DRAWS = 2000, SEED = 20261113, BLOCK = 6;

const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);
const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);

export function barsOf(json) {
  return foldWeekend(json.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })));
}

// put both markets on the dates both have: a candle on a date the other lacks folds into its next common candle
export function align(a, b) {
  const tb = new Set(b.map((x) => x.time)), common = new Set(a.map((x) => x.time).filter((t) => tb.has(t)));
  const fold = (bars) => {
    const out = []; let pend = null;
    for (const x of bars) {
      if (!common.has(x.time)) { pend = pend ? { open: pend.open, high: Math.max(pend.high, x.high), low: Math.min(pend.low, x.low) } : { open: x.open, high: x.high, low: x.low }; continue; }
      out.push(pend ? { time: x.time, open: pend.open, high: Math.max(pend.high, x.high), low: Math.min(pend.low, x.low), close: x.close } : { ...x });
      pend = null;
    }
    return out;
  };
  return [fold(a), fold(b)];
}

// index of the last candle of each calendar month, the last month only once a later month has begun
export function monthEnds(bars) {
  const out = [];
  for (let i = 0; i + 1 < bars.length; i++) if (ym(bars[i].time) !== ym(bars[i + 1].time)) out.push(i);
  return out;
}

export function atrAt(bars, i, n = ATR_N) {
  let tr = 0;
  for (let k = i - n + 1; k <= i; k++) tr += Math.max(bars[k].high - bars[k].low, Math.abs(bars[k].high - bars[k - 1].close), Math.abs(bars[k].low - bars[k - 1].close));
  return tr / n;
}

// as-of lookup in a sorted [[YYYY-MM-DD, value]] list
export function asOfRate(list) {
  return (t) => {
    const d = day(t); let lo = 0, hi = list.length - 1, v = null;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (list[m][0] <= d) { v = list[m][1]; lo = m + 1; } else hi = m - 1; }
    return v;
  };
}

// cash hurdle over a lookback of L trading days: mean DGS2 dated in the L/252 years up to t (inclusive) / 100 x L/252
export function hurdleOf(list) {
  const asOf = asOfRate(list);
  return (t, L) => {
    const yrs = L / 252, d1 = day(t), d0 = day(t - Math.round(yrs * 365.25 * 86400));
    const vals = list.filter(([d]) => d > d0 && d <= d1).map(([, v]) => v);
    const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : asOf(t);
    return mean == null ? null : (mean / 100) * yrs;
  };
}

// financing a night as a share of price: gold FIN.xau.long; the index (DGS2 + markup) / 365, DGS2 floored at 0
export function nightRate(mk, dgs2) {
  if (mk === 'xau') return () => FIN.xau.long;
  return (t) => (Math.max(0, dgs2(t) ?? 0) / 100 + MARKUP) / 365;
}

// the signal made at month end j: reads candles 0..ends[j] only
export function signalAt(A, ends, j, L, hurdle) {
  const i = ends[j];
  if (i < L || i < ATR_N) return null;
  const R = {};
  for (const mk of MARKETS) R[mk] = A[mk][i].close / A[mk][i - L].close - 1;
  const pick = R.spx500 >= R.xau ? 'spx500' : 'xau';
  const h = hurdle(A[pick][i].time, L);
  const hold = h != null && R[pick] > h ? pick : null;
  const stop = hold ? A[hold][i].close - ATR_K * atrAt(A[hold], i) : null;
  return { i, t: A.spx500[i].time, R, hurdle: h, pick, hold, stop };
}

// one window: daily returns of the rule, the 50/50 and each buy-and-hold. A = { spx500: bars, xau: bars } on one calendar.
// opts: { L, spread, rate: { mk: fn(t) a night }, hurdle(t, L), div: { mk: a year }, from, to (unix s) }
export function simulate(A, opts) {
  const { L, spread = SPREAD, rate, hurdle, div = { spx500: 0, xau: 0 }, from, to } = opts;
  const base = A.spx500, ends = monthEnds(base), endSet = new Map(ends.map((i, j) => [i, j]));
  const k0 = base.findIndex((b) => b.time >= from);
  if (k0 < 1) return null;
  let k1 = k0; while (k1 + 1 < base.length && base[k1 + 1].time < to) k1++;
  let jPrev = -1; for (let j = 0; j < ends.length; j++) if (ends[j] < k0) jPrev = j;
  const carry = (mk, k) => { const n = nights(base[k].time, k + 1 < base.length ? base[k + 1].time : base[k].time + 86400); return n * (rate[mk](base[k].time) - (div[mk] || 0) / 365); };
  const rule = [], bh = { spx500: [], xau: [] }, mix = [], trades = [], signals = [];
  const held = { spx500: 0, xau: 0 };
  let pos = null, stops = 0, switches = 0;
  const leg = { spx500: 0.5, xau: 0.5 };
  const exitAt = (px, k, why) => { trades.push({ ...pos, exit: px, exitT: base[k].time, why }); pos = null; };
  for (let k = k0; k <= k1; k++) {
    let f = 1, entered = false;
    const monthStart = k === k0 || endSet.has(k - 1);
    if (monthStart) {
      const j = k === k0 ? jPrev : endSet.get(k - 1), s = j >= 0 ? signalAt(A, ends, j, L, hurdle) : null;
      if (s) signals.push({ t: s.t, pick: s.pick, hold: s.hold, R: s.R, hurdle: s.hurdle });
      const target = s ? s.hold : null;
      if (pos && pos.mk !== target) {
        const b = A[pos.mk][k], sp = spread[pos.mk];
        f *= (b.open - sp) / A[pos.mk][k - 1].close; switches++; exitAt(b.open - sp, k, 'signal');
      } else if (pos) pos.stop = Math.max(pos.stop, s.stop);
      if (!pos && target) {
        const b = A[target][k], sp = spread[target], entry = b.open + sp;
        pos = { mk: target, entry, entryT: b.time, stop: s.stop, stop0: s.stop }; entered = true; switches++;
        if (b.open <= pos.stop) { f *= (b.open - sp) / entry; stops++; exitAt(b.open - sp, k, 'stop'); }
        else if (b.low <= pos.stop) { f *= (pos.stop - sp) / entry; stops++; exitAt(pos.stop - sp, k, 'stop'); }
        else f *= b.close / entry;
      }
    }
    if (pos && !entered) {
      const b = A[pos.mk][k], prev = A[pos.mk][k - 1].close, sp = spread[pos.mk];
      if (b.open <= pos.stop) { f *= (b.open - sp) / prev; stops++; exitAt(b.open - sp, k, 'stop'); }
      else if (b.low <= pos.stop) { f *= (pos.stop - sp) / prev; stops++; exitAt(pos.stop - sp, k, 'stop'); }
      else f *= b.close / prev;
    }
    let r = f - 1;
    if (pos) { r -= carry(pos.mk, k); held[pos.mk]++; }
    rule.push({ t: base[k].time, r });
    // buy-and-hold of each market
    for (const mk of MARKETS) {
      const b = A[mk][k];
      bh[mk].push({ t: b.time, r: (k === k0 ? b.close / (b.open + spread[mk]) - 1 : b.close / A[mk][k - 1].close - 1) - carry(mk, k) });
    }
    // 50/50, rebalanced at the open of each month's first candle
    const V0 = leg.spx500 + leg.xau;
    if (k === k0) {
      for (const mk of MARKETS) { const b = A[mk][k]; leg[mk] = 0.5 * b.close / (b.open + spread[mk]); }
    } else {
      if (endSet.has(k - 1)) {
        const atOpen = {}; let V = 0;
        for (const mk of MARKETS) { atOpen[mk] = leg[mk] * A[mk][k].open / A[mk][k - 1].close; V += atOpen[mk]; }
        let cost = 0;
        for (const mk of MARKETS) cost += Math.abs(V / 2 - atOpen[mk]) * spread[mk] / A[mk][k].open;
        for (const mk of MARKETS) leg[mk] = ((V - cost) / 2) * A[mk][k].close / A[mk][k].open;
      } else for (const mk of MARKETS) leg[mk] *= A[mk][k].close / A[mk][k - 1].close;
    }
    for (const mk of MARKETS) leg[mk] *= 1 - carry(mk, k);
    mix.push({ t: base[k].time, r: (leg.spx500 + leg.xau) / (k === k0 ? 1 : V0) - 1 });
  }
  const days = k1 - k0 + 1;
  return { rule, bh, mix, trades, signals, stops, switches, openAtEnd: pos ? pos.mk : null, days, share: { spx500: held.spx500 / days, xau: held.xau / days, flat: 1 - (held.spx500 + held.xau) / days }, from: day(base[k0].time), to: day(base[k1].time) };
}

export function stats(rs) {
  const r = rs.map((x) => x.r), n = r.length;
  if (!n) return null;
  const months = new Set(rs.map((x) => ym(x.t))).size;
  let eq = 1, peak = 1, dd = 0;
  for (const v of r) { eq *= 1 + v; peak = Math.max(peak, eq); dd = Math.max(dd, 1 - eq / peak); }
  const mean = r.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(r.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  const cagr = eq ** (12 / months) - 1;
  return { days: n, months, total: eq - 1, cagr, vol: sd * Math.sqrt(252), sharpe: sd > 0 ? mean / sd * Math.sqrt(252) : 0, maxDD: dd };
}

export function sharpeOf(r) {
  const n = r.length; if (n < 2) return 0;
  const mean = r.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(r.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  return sd > 0 ? mean / sd * Math.sqrt(252) : 0;
}

// monthly compounded returns and the t of the monthly difference a - b (plain t on calendar months)
export function monthly(rs) {
  const m = new Map();
  for (const { t, r } of rs) m.set(ym(t), (m.get(ym(t)) ?? 1) * (1 + r));
  return new Map([...m].map(([k, v]) => [k, v - 1]));
}
export function diffT(a, b) {
  const A = monthly(a), B = monthly(b), d = [...A.keys()].filter((k) => B.has(k)).map((k) => A.get(k) - B.get(k)), n = d.length;
  const mean = d.reduce((x, y) => x + y, 0) / n, sd = Math.sqrt(d.reduce((x, y) => x + (y - mean) ** 2, 0) / (n - 1));
  return { months: n, meanDiff: mean, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : 0 };
}

export function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// paired 6-month block bootstrap of the Sharpe: the same drawn months for both series
export function bootstrap(a, b, draws = DRAWS, seed = SEED, block = BLOCK) {
  const byM = (s) => { const m = new Map(); for (const x of s) { const k = ym(x.t); if (!m.has(k)) m.set(k, []); m.get(k).push(x.r); } return m; };
  const A = byM(a), B = byM(b), keys = [...A.keys()].filter((k) => B.has(k)), M = keys.length, starts = M - block + 1, rnd = mulberry32(seed);
  let better = 0; const diffs = [];
  for (let d = 0; d < draws; d++) {
    const ra = [], rb = []; let got = 0;
    while (got < M) {
      const s0 = Math.floor(rnd() * starts);
      for (let q = 0; q < block && got < M; q++, got++) { const k = keys[s0 + q]; for (const x of A.get(k)) ra.push(x); for (const x of B.get(k)) rb.push(x); }
    }
    const da = sharpeOf(ra) - sharpeOf(rb);
    if (da > 0) better++;
    diffs.push(da);
  }
  diffs.sort((x, y) => x - y);
  const q = (p) => diffs[Math.min(diffs.length - 1, Math.floor(p * diffs.length))];
  return { draws, seed, block, months: M, pBetter: better / draws, diffP05: q(0.05), diffP50: q(0.5), diffP95: q(0.95) };
}

// Holm over the lookbacks at a family level of 0.10, p = 1 - P
export function holm(ps, alpha = 0.10) {
  const keys = Object.keys(ps).sort((x, y) => ps[x] - ps[y]), out = {};
  let go = true;
  keys.forEach((k, i) => { const bar = alpha / (keys.length - i); go = go && ps[k] <= bar; out[k] = { p: ps[k], bar, reject: go }; });
  return out;
}

export function passOf(win) {
  const ps = Object.fromEntries(Object.keys(LOOKBACKS).map((L) => [L, 1 - win.W2[L].boot.pBetter]));
  const h = holm(ps), res = {};
  for (const L of Object.keys(LOOKBACKS)) {
    const w2 = win.W2[L], w1 = win.W1[L];
    const checks = { w2Sharpe: w2.rule.sharpe > w2.mix.sharpe, w2Holm: h[L].reject, w2Drawdown: w2.rule.maxDD <= w2.mix.maxDD, w1Sharpe: w1.rule.sharpe > w1.mix.sharpe };
    res[L] = { checks, holm: h[L], pass: Object.values(checks).every(Boolean) };
  }
  const verdict = res.L12.pass ? 'PASS' : res.L6.pass ? 'PASS (6-month only)' : 'FAIL';
  return { byLookback: res, verdict };
}

const r4 = (x) => (Number.isFinite(x) ? +x.toFixed(4) : x);
const slim = (s) => s && Object.fromEntries(Object.entries(s).map(([k, v]) => [k, typeof v === 'number' ? r4(v) : v]));

export function load(dir) {
  const cache = JSON.parse(fs.readFileSync(path.join(dir, 'cache.json'), 'utf8'));
  const list = cache.score.fred.DGS2;
  const raw = Object.fromEntries(MARKETS.map((mk) => [mk, barsOf(JSON.parse(fs.readFileSync(path.join(dir, mk + '.json'), 'utf8')))]));
  const [s, x] = align(raw.spx500, raw.xau);
  return { A: { spx500: s, xau: x }, list, raw };
}

export function runAll({ A, list }, { div = false } = {}) {
  const dgs2 = asOfRate(list), hurdle = hurdleOf(list), rate = Object.fromEntries(MARKETS.map((mk) => [mk, nightRate(mk, dgs2)]));
  const out = {};
  for (const [w, { from, to, label }] of Object.entries(WINDOWS)) {
    out[w] = { label, from };
    for (const [Lk, L] of Object.entries(LOOKBACKS)) {
      const s = simulate(A, { L, rate, hurdle, div: div ? DIV : { spx500: 0, xau: 0 }, from: T(from), to: T(to) });
      const picks = s.signals.reduce((m, x) => { const k = x.hold || 'flat'; m[k] = (m[k] || 0) + 1; return m; }, {});
      const pos = s.trades.length + (s.openAtEnd ? 1 : 0);
      const byMk = MARKETS.reduce((m, mk) => { m[mk] = s.trades.filter((x) => x.mk === mk).length + (s.openAtEnd === mk ? 1 : 0); return m; }, {});
      out[w].to = s.to;
      out[w][Lk] = {
        lookbackDays: L, rule: slim(stats(s.rule)), mix: slim(stats(s.mix)), bh: { spx500: slim(stats(s.bh.spx500)), xau: slim(stats(s.bh.xau)) },
        vsMix: slim(diffT(s.rule, s.mix)), boot: slim(bootstrap(s.rule, s.mix)),
        share: slim(s.share), monthEnds: s.signals.length, monthsHeld: picks, positions: pos, positionsBy: byMk, switches: s.switches, stops: s.stops, openAtEnd: s.openAtEnd,
      };
    }
  }
  return out;
}

function main() {
  const [mode, dir] = process.argv.slice(2);
  if (mode === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    for (const mk of MARKETS) fs.writeFileSync(path.join(dir, mk + '.json'), execFileSync('git', ['show', `origin/council-data:research/daily/${mk}.json`], { maxBuffer: 1 << 28 }));
    fs.writeFileSync(path.join(dir, 'cache.json'), execFileSync('git', ['show', 'origin/council-data:macro/cache.json'], { maxBuffer: 1 << 28 }));
    console.log('fetched into', dir);
    return;
  }
  if (mode !== 'full' || !dir) { console.log('usage: run.mjs fetch <dir> | full <dir>'); return; }
  const data = load(dir), prim = runAll(data), sens = runAll(data, { div: true }), p = passOf(prim);
  const res = {
    built: '2026-11-13',
    prereg: 'research/edge/dual-momentum/PREREGISTRATION.md',
    rule: 'paper research only: a stand-alone monthly allocation rule (SPX500 / gold / flat); not a test, gate, size or exit of the gold book (owner decision 44 untouched); no live change',
    source: 'G. Antonacci (2014), Dual Momentum Investing; 2016 on is after the book',
    params: { lookbacks: LOOKBACKS, atrN: ATR_N, atrK: ATR_K, spread: SPREAD, indexFinancing: 'DGS2 + 2.5 % a year / 365 a night', goldFinancing: FIN.xau.long, cashWhileFlat: 0, hurdle: 'mean DGS2 over the lookback / 100 x L/252', dividendSensitivity: DIV, draws: DRAWS, seed: SEED, block: BLOCK },
    data: { calendar: 'common SPX500 / XAU candles', candles: data.A.spx500.length, first: day(data.A.spx500[0].time), last: day(data.A.spx500.at(-1).time), raw: Object.fromEntries(MARKETS.map((mk) => [mk, { candles: data.raw[mk].length, first: day(data.raw[mk][0].time), last: day(data.raw[mk].at(-1).time) }])) },
    windows: prim,
    dividendSensitivity: Object.fromEntries(Object.entries(sens).map(([w, x]) => [w, Object.fromEntries(Object.keys(LOOKBACKS).map((L) => [L, { rule: x[L].rule, mix: x[L].mix }]))])),
    pass: p.byLookback,
    verdict: p.verdict,
  };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  console.log(res.verdict, JSON.stringify(p.byLookback, null, 1));
  for (const w of ['W1', 'W2']) for (const L of Object.keys(LOOKBACKS)) { const x = prim[w][L]; console.log(w, L, 'rule', JSON.stringify(x.rule), '\n   mix', JSON.stringify(x.mix), '\n   spx', JSON.stringify(x.bh.spx500), '\n   xau', JSON.stringify(x.bh.xau), '\n   ', JSON.stringify({ vs: x.vsMix, boot: x.boot, share: x.share, held: x.monthsHeld, pos: x.positions, by: x.positionsBy, sw: x.switches, st: x.stops })); }
  console.log('div', JSON.stringify(res.dividendSensitivity));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
