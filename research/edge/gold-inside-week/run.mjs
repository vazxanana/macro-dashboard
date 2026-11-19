// Edge research · gold-inside-week (PREREGISTRATION.md, committed first): on spot gold, an OCO stop-order bracket at the range of
// T1 an inside week (orders the next week, exit at the end of the week after), T2 the narrowest week of four (same), T3 a Monday
// range held through Wednesday (orders Thursday / Friday, exit Friday's close). Stop = the other side of the range on every
// trade. Net of $0.30 spread + $0.15 slippage per market order and financing on buys; IS 2008-16, OOS 2017 to Oct 2026;
// month-sum t, Holm over three tests, 40-seed random-week placebo. A stand-alone rule, not the gold book (item 44).
//   node research/edge/gold-inside-week/run.mjs      daily candles from origin/council-data (git show), result.json here
// Paper research: nothing here is read by the council, the mirror or the page.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86400, T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const r3 = (v) => (Number.isFinite(v) ? +v.toFixed(3) : null), r2 = (v) => (Number.isFinite(v) ? +v.toFixed(2) : null);

export const P = {
  SPREAD: 0.30, SLIP: 0.15, MIN_DAYS: 4, SEEDS: 40, FROM: '2006-01-01',
  IS: ['2008-01-01', '2017-01-01'], OOS: ['2017-01-01', '2026-11-01'], EXIT_H: 21,
};
export const COST = P.SPREAD + 2 * P.SLIP;   // $0.60 a trade: spread + slippage on the entry and on the exit

// ── trading days and weeks ──
export const toBars = (rows) => rows.map(([t, o, h, l, c]) => ({ time: t, open: o, high: h, low: l, close: c }));
export const dow = (t) => new Date(t * 1000).getUTCDay();
// weeks of folded UTC trading days, Monday to Friday: { start, idx: [day indices], high, low, byDow: {1..5: index} }
export function weeksOf(days) {
  const out = [];
  days.forEach((d, i) => {
    const s = d.time - ((dow(d.time) + 6) % 7) * DAY;
    let w = out.at(-1);
    if (!w || w.start !== s) { w = { start: s, idx: [], high: -Infinity, low: Infinity, byDow: {} }; out.push(w); }
    w.idx.push(i); w.high = Math.max(w.high, d.high); w.low = Math.min(w.low, d.low); w.byDow[dow(d.time)] = i;
  });
  return out;
}
export const isInside = (W, w) => w >= 1 && W[w].high < W[w - 1].high && W[w].low > W[w - 1].low;
export function isNR4(W, w) {
  if (w < 3) return false;
  const r = W[w].high - W[w].low;
  if (!(r > 0)) return false;
  for (let k = w - 3; k < w; k++) if (!(r < W[k].high - W[k].low)) return false;
  return true;
}
// Monday's range held by Tuesday and Wednesday; Monday to Thursday present
export function mondayHeld(days, wk) {
  const b = wk.byDow;
  if (b[1] == null || b[2] == null || b[3] == null || b[4] == null) return false;
  const m = days[b[1]];
  return [b[2], b[3]].every((i) => days[i].high <= m.high && days[i].low >= m.low);
}

// ── one bracket: orders on days `ord` (ascending indices), exit at the close of day `exitI` (or the stop) ──
// Returns null when no order filled, else { side, fill, stop, r0, R (gross), t, c, entryI, exitI, why, both? }.
export function bracket(days, hi, lo, ord, exitI) {
  if (!(hi > lo) || !ord.length || exitI < ord[0]) return null;
  for (const k of ord) {
    const b = days[k], up = b.high >= hi, dn = b.low <= lo;
    if (!up && !dn) continue;
    if (up && dn) {   // both levels in one day: booked as a loss of the full distance, whichever came first
      const s = b.open <= lo ? -1 : 1, fill = s > 0 ? Math.max(hi, b.open) : Math.min(lo, b.open), stop = s > 0 ? lo : hi;
      return { side: s, fill, stop, r0: Math.abs(fill - stop), R: -1, t: b.time, c: b.time + P.EXIT_H * 3600, entryI: k, exitI: k, why: 'both', both: true };
    }
    const s = up ? 1 : -1, fill = s > 0 ? Math.max(hi, b.open) : Math.min(lo, b.open), stop = s > 0 ? lo : hi, r0 = Math.abs(fill - stop);
    const done = (px, j, why) => ({ side: s, fill, stop, r0, R: s * (px - fill) / r0, t: b.time, c: days[j].time + P.EXIT_H * 3600, entryI: k, exitI: j, why });
    const last = Math.max(exitI, k);
    for (let j = k + 1; j <= last; j++) {
      const d = days[j], hit = s > 0 ? d.low <= stop : d.high >= stop;
      if (hit) { const px = s > 0 ? Math.min(stop, d.open) : Math.max(stop, d.open); return done(px, j, px === stop ? 'stop' : 'gap'); }
    }
    return done(days[last].close, last, 'time');
  }
  return null;
}

// ── the three tests: signal → { key, ordStart, hi, lo, ord, exitI } ──
export const TESTS = {
  T1: { label: 'inside week; orders the next week, exit at the end of the week after' },
  T2: { label: 'narrowest week of four (NR4 week); orders the next week, exit at the end of the week after' },
  T3: { label: 'Monday range held Tuesday-Wednesday; orders Thursday-Friday, exit Friday close' },
};
const weekPlan = (W, w) => (W[w + 2] ? { hi: W[w].high, lo: W[w].low, ord: W[w + 1].idx, exitI: W[w + 2].idx.at(-1) } : null);
const thuFri = (wk) => [wk.byDow[4], wk.byDow[5]].filter((i) => i != null);
export function signals(days, W, test) {
  const out = [];
  for (let w = 0; w < W.length; w++) {
    const wk = W[w];
    if (wk.idx.length < P.MIN_DAYS) continue;
    let plan = null;
    if (test === 'T1' && isInside(W, w)) plan = weekPlan(W, w);
    else if (test === 'T2' && isNR4(W, w)) plan = weekPlan(W, w);
    else if (test === 'T3' && mondayHeld(days, wk)) { const m = days[wk.byDow[1]]; plan = { hi: m.high, lo: m.low, ord: thuFri(wk), exitI: wk.idx.at(-1) }; }
    if (plan) out.push({ w, ...plan });
  }
  return out;
}
// placebo stand-ins: any week of the window (T1 / T2: >= 4 days and two weeks after it; T3: Monday to Thursday present)
export function placeboPlan(days, W, w, test) {
  const wk = W[w];
  if (test === 'T3') {
    const b = wk.byDow;
    if (wk.idx.length < P.MIN_DAYS || [1, 2, 3, 4].some((d) => b[d] == null)) return null;
    const mw = [b[1], b[2], b[3]].map((i) => days[i]);
    return { hi: Math.max(...mw.map((d) => d.high)), lo: Math.min(...mw.map((d) => d.low)), ord: thuFri(wk), exitI: wk.idx.at(-1) };
  }
  return wk.idx.length >= P.MIN_DAYS ? weekPlan(W, w) : null;
}
// one position at a time: a signal whose first order day is not after the open trade's exit day is skipped
export function stream(days, W, test) {
  const out = []; let busyTo = -1;
  for (const s of signals(days, W, test)) {
    if (s.ord[0] <= busyTo) { out.push({ ...s, skipped: true }); continue; }
    const tr = bracket(days, s.hi, s.lo, s.ord, s.exitI);
    out.push({ ...s, tr });
    if (tr) busyTo = tr.exitI;
  }
  return out;
}

// ── costs in R ──
export function costs(tr, { mult = 1 } = {}) {
  const spread = mult * COST / tr.r0, nn = tr.side > 0 ? nights(tr.t, tr.c) : 0;
  return { spread, fin: nn * FIN.xau.long * tr.fill / tr.r0, nights: nn };
}
export const netOf = (tr, o) => { const c = costs(tr, o); return tr.R - c.spread - c.fin; };

// ── statistics ──
export function erfc(x) { const z = Math.abs(x), t = 1 / (1 + 0.5 * z); const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? r : 2 - r; }
export const pOne = (t) => (Number.isFinite(t) ? 0.5 * erfc(t / Math.SQRT2) : 1);
const ym = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
export function monthT(rows, from, to) {
  const a = ym(from), b = ym(to), s = new Array(b - a + 1).fill(0);
  for (const r of rows) { const k = ym(r.c) - a; if (k >= 0 && k < s.length) s[k] += r.net; }
  const n = s.length, mu = s.reduce((x, y) => x + y, 0) / n, sd = Math.sqrt(s.reduce((x, y) => x + (y - mu) ** 2, 0) / (n - 1));
  return { months: n, t: sd > 0 ? mu / sd * Math.sqrt(n) : null };
}
export function maxDD(rows) {
  let c = 0, pk = 0, dd = 0;
  for (const r of [...rows].sort((x, y) => x.c - y.c)) { c += r.net; pk = Math.max(pk, c); dd = Math.min(dd, c - pk); }
  return dd;
}
export function summary(rows, from, to) {
  const n = rows.length, mean = (k) => (n ? rows.reduce((a, r) => a + r[k], 0) / n : null);
  const m = n ? monthT(rows, from, to) : { months: 0, t: null };
  return { n, gross: r3(mean('R')), net: r3(mean('net')), net2: r3(mean('net2')), totalNet: r2(rows.reduce((a, r) => a + r.net, 0)), win: n ? r3(rows.filter((r) => r.net > 0).length / n) : null, maxDD: r2(maxDD(rows)), months: m.months, t: r2(m.t), p: n ? +pOne(m.t).toFixed(4) : null, both: rows.filter((r) => r.both).length };
}
export function holm(ps, alpha = 0.05) {
  const idx = ps.map((p, i) => [p, i]).sort((x, y) => x[0] - y[0]), ok = new Array(ps.length).fill(false);
  for (let k = 0; k < idx.length; k++) { if (idx[k][0] <= alpha / (idx.length - k)) ok[idx[k][1]] = true; else break; }
  return ok;
}
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const q = (xs, p) => { const s = [...xs].sort((a, b) => a - b); const k = (s.length - 1) * p, lo = Math.floor(k); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (k - lo); };

// ── the study ──
export function loadDays(rows) { return foldWeekend(toBars(rows.filter((r) => r[0] >= T(P.FROM)))); }
export function study(days) {
  const W = weeksOf(days), lastC = days.at(-1).time + P.EXIT_H * 3600;
  const inWin = (s, [a, b]) => { const t = days[s.ord[0]].time; return t >= T(a) && t < T(b) && days[s.exitI].time + P.EXIT_H * 3600 <= lastC; };
  const winTo = (w) => Math.min(T(w[1]) - 1, lastC);
  const out = { tests: {} };
  for (const [tk, def] of Object.entries(TESTS)) {
    const st = stream(days, W, tk).map((s) => (s.tr ? { ...s, row: { ...s.tr, net: netOf(s.tr), net2: netOf(s.tr, { mult: 2 }) } } : s));
    const res = { label: def.label, windows: {} };
    for (const [wk, w] of Object.entries({ inSample: P.IS, outOfSample: P.OOS })) {
      const sig = st.filter((s) => inWin(s, w)), rows = sig.filter((s) => s.row).map((s) => s.row), from = T(w[0]), to = winTo(w);
      const byYear = {};
      for (const r of rows) { const y = new Date(r.t * 1000).getUTCFullYear(); (byYear[y] ||= []).push(r); }
      res.windows[wk] = {
        from: w[0], to: new Date(to * 1000).toISOString().slice(0, 10), ...summary(rows, from, to),
        signals: sig.filter((s) => !s.skipped).length, skipped: sig.filter((s) => s.skipped).length, unfilled: sig.filter((s) => !s.skipped && !s.tr).length,
        buys: summary(rows.filter((r) => r.side > 0), from, to), sells: summary(rows.filter((r) => r.side < 0), from, to),
        byYear: Object.fromEntries(Object.entries(byYear).map(([y, rs]) => [y, { n: rs.length, net: r3(rs.reduce((a, r) => a + r.net, 0) / rs.length), total: r2(rs.reduce((a, r) => a + r.net, 0)) }])),
        medianRisk: rows.length ? r2(q(rows.map((r) => r.r0), 0.5)) : null,
      };
    }
    // placebo on the out-of-sample window: random weeks, the same bracket, exit and costs
    const pool = [];
    for (let w = 0; w < W.length; w++) { const pl = placeboPlan(days, W, w, tk); if (pl && pl.ord.length && inWin(pl, P.OOS)) pool.push(pl); }
    const nSig = res.windows.outOfSample.signals, seeds = [];
    for (let sd = 1; sd <= P.SEEDS; sd++) {
      const rnd = mulberry32(sd), xs = [];
      for (let c = 0; c < nSig; c++) { const pl = pool[Math.floor(rnd() * pool.length)], tr = bracket(days, pl.hi, pl.lo, pl.ord, pl.exitI); if (tr) xs.push(netOf(tr)); }
      seeds.push(xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : 0);
    }
    res.placebo = { seeds: P.SEEDS, pool: pool.length, perSeed: nSig, p95: r3(q(seeds, 0.95)), median: r3(q(seeds, 0.5)), min: r3(Math.min(...seeds)), max: r3(Math.max(...seeds)), real: res.windows.outOfSample.net, beaten: seeds.filter((x) => res.windows.outOfSample.net > x).length, means: seeds.map(r3) };
    out.tests[tk] = res;
  }
  const keys = Object.keys(out.tests), hp = holm(keys.map((k) => out.tests[k].windows.outOfSample.p ?? 1));
  keys.forEach((k, j) => {
    const v = out.tests[k], o = v.windows.outOfSample, i = v.windows.inSample;
    v.checks = { oosPositive: o.net > 0, oosT2: o.t != null && o.t >= 2, holm: hp[j], isSameSign: i.net > 0, oos2xCosts: o.net2 > 0, placebo: o.net > v.placebo.p95 };
    v.pass = Object.values(v.checks).every(Boolean);
  });
  out.passed = keys.filter((k) => out.tests[k].pass).length;
  out.verdict = out.passed ? 'PASS' : 'FAIL';
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const d = JSON.parse(execFileSync('git', ['show', 'origin/council-data:research/daily/xau.json'], { cwd: HERE, maxBuffer: 1 << 28 }).toString());
  const days = loadDays(d.rows), r = study(days);
  const res = {
    study: 'gold-inside-week', built: '2026-11-14', verdict: r.verdict, passed: r.passed, of: 3,
    rule: 'OCO buy stop / sell stop at a range on spot gold, stop the other side of the range, both levels in one day = a loss. T1 inside week (orders next week, exit end of the week after); T2 NR4 week (same); T3 Monday range held Tue-Wed (orders Thu-Fri, exit Friday close)',
    params: { ...P, costPerTrade: COST, finGoldLong: FIN.xau.long },
    src: `OANDA mid XAU/USD daily candles, council-data research/daily/xau.json (${d.rows.length} rows to ${new Date(d.rows.at(-1)[0] * 1000).toISOString().slice(0, 10)}), folded with council/fills.mjs foldWeekend`,
    note: 'A stand-alone rule, not a test of the gold book (item 44). Paper research; nothing live changed.',
    tests: r.tests,
  };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  for (const [k, v] of Object.entries(r.tests)) {
    const { byYear: _a, buys: _b, sells: _c, ...is } = v.windows.inSample, { byYear: _d, buys: _e, sells: _f, ...oos } = v.windows.outOfSample;
    console.log(k, v.pass, JSON.stringify(v.checks), '\n IS', JSON.stringify(is), '\n OOS', JSON.stringify(oos), '\n placebo', v.placebo.p95, v.placebo.median, v.placebo.beaten);
  }
  console.log('verdict', r.verdict, r.passed);
}
