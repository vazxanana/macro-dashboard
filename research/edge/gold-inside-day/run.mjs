// Edge research · gold-inside-day (PREREGISTRATION.md, committed first): on spot gold, a daily inside day (high below the
// previous high, low above the previous low) brackets the next day with a buy stop at its high and a sell stop at its low,
// first filled wins, stop = the other side. T1 exit 21:00 UTC; T2 1R target else 21:00 UTC; T3 T1 on tight inside days
// (range < 0.6 x ATR14). Path on OANDA mid M5, days built from the same M5 candles and folded with foldWeekend. Net of $0.60 a
// round trip and financing on buys; IS 2008-16, OOS 2017 on; month-sum t, Holm over three tests, 40-seed placebo on random
// non-inside days. A stand-alone rule, not the gold book (item 44).
//   node research/edge/gold-inside-day/run.mjs <xau-5m.json.gz>    writes result.json and RESULT.md here
// Paper research: nothing here is read by the council, the mirror or the page.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86400, T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const r3 = (v) => (Number.isFinite(v) ? +v.toFixed(3) : null), r2 = (v) => (Number.isFinite(v) ? +v.toFixed(2) : null);

export const P = {
  COST: 0.60, MIN_CANDLES: 120, EXIT_H: 21, ATR_N: 14, TIGHT: 0.6, SEEDS: 40, MIN_OOS_N: 30, PLACEBO_BEAT: 38,
  IS: ['2008-01-01', '2017-01-01'], OOS: ['2017-01-01', '2100-01-01'], OOS_HALVES: [['2017-01-01', '2022-01-01'], ['2022-01-01', '2100-01-01']],
};

// ── days from M5: UTC days (first open, max high, min low, last close, candle index range), weekend folded into the next weekday ──
export function utcDays(m5) {
  const out = [];
  for (let i = 0; i < m5.length; i++) {
    const [t, o, h, l, c] = m5[i], d = Math.floor(t / DAY) * DAY;
    let b = out.at(-1);
    if (!b || b.time !== d) { b = { time: d, open: o, high: h, low: l, close: c, a: i, b: i, n: 0 }; out.push(b); }
    b.high = Math.max(b.high, h); b.low = Math.min(b.low, l); b.close = c; b.b = i; b.n++;
  }
  return out;
}
// the same fold as council/fills.mjs foldWeekend, carrying the M5 index range and candle count of the weekend into the weekday
export function foldDays(days) {
  const out = []; let w = null;
  for (const b of days) {
    const wd = new Date(b.time * 1000).getUTCDay();
    if (wd === 0 || wd === 6) { w = w ? { ...w, high: Math.max(w.high, b.high), low: Math.min(w.low, b.low), n: w.n + b.n } : { open: b.open, high: b.high, low: b.low, a: b.a, n: b.n }; continue; }
    out.push(w ? { ...b, open: w.open, high: Math.max(w.high, b.high), low: Math.min(w.low, b.low), a: w.a, n: w.n + b.n } : { ...b }); w = null;
  }
  return out;
}
export const full = (d) => !!d && d.n >= P.MIN_CANDLES;
export const isInside = (D, i) => i >= 1 && D[i].high < D[i - 1].high && D[i].low > D[i - 1].low;
// mean true range of the ATR_N folded days ending with day i (true range uses the previous day's close); null without history
export function atr(D, i, n = P.ATR_N) {
  if (i < n) return null;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) { const pc = D[k - 1].close; s += Math.max(D[k].high - D[k].low, Math.abs(D[k].high - pc), Math.abs(D[k].low - pc)); }
  return s / n;
}
export const tight = (D, i) => { const a = atr(D, i); return a != null && D[i].high - D[i].low < P.TIGHT * a; };

// ── one bracket on order day E (folded day object): returns null when nothing filled by the exit, else the trade ──
// { side, fill, stop, r0, R (gross), t (fill candle time), c (exit time), why: 'stop'|'gap'|'target'|'time'|'both' }
export function walk(m5, E, hi, lo, { target = 0 } = {}) {
  if (!(hi > lo)) return null;
  const end = E.time + P.EXIT_H * 3600;
  let last = -1;
  for (let i = E.a; i <= E.b && m5[i][0] < end; i++) last = i;
  if (last < 0) return null;
  for (let i = E.a; i <= last; i++) {
    const [t, o, h, l] = m5[i], up = h >= hi, dn = l <= lo;
    if (!up && !dn) continue;
    if (up && dn) {   // both levels in the fill candle: a full loss, whichever side the open favours
      const s = o >= hi ? 1 : o <= lo ? -1 : (hi - o <= o - lo ? 1 : -1);
      const fill = s > 0 ? Math.max(hi, o) : Math.min(lo, o), stop = s > 0 ? lo : hi, r0 = Math.abs(fill - stop);
      return { side: s, fill, stop, r0, R: s * (stop - fill) / r0, t, c: t + 300, why: 'both', fillStop: true };
    }
    const s = up ? 1 : -1, fill = s > 0 ? Math.max(hi, o) : Math.min(lo, o), stop = s > 0 ? lo : hi, r0 = Math.abs(fill - stop);
    const tgt = target ? fill + s * target * r0 : null;
    const done = (px, j, why) => ({ side: s, fill, stop, r0, R: s * (px - fill) / r0, t, c: m5[j][0] + 300, why });
    for (let j = i + 1; j <= last; j++) {
      const [, oj, hj, lj] = m5[j];
      if (s > 0 ? lj <= stop : hj >= stop) { const px = s > 0 ? Math.min(stop, oj) : Math.max(stop, oj); return done(px, j, px === stop ? 'stop' : 'gap'); }
      if (tgt != null && (s > 0 ? hj >= tgt : lj <= tgt)) return done(s > 0 ? Math.max(tgt, oj) : Math.min(tgt, oj), j, 'target');
    }
    return done(m5[last][4], last, 'time');
  }
  return null;
}

// ── signals: inside day i (full, previous full) with a full next day ──
export const TESTS = {
  T1: { label: 'inside day; OCO stops at its high / low the next day, stop the other side, exit 21:00 UTC', target: 0, tight: false },
  T2: { label: 'inside day; the same bracket, 1R target, else exit 21:00 UTC', target: 1, tight: false },
  T3: { label: 'tight inside day (range < 0.6 x ATR14); the T1 bracket and exit', target: 0, tight: true },
};
export function signals(D, test) {
  const def = TESTS[test], out = [];
  for (let i = 1; i + 1 < D.length; i++) {
    if (!isInside(D, i) || !full(D[i]) || !full(D[i - 1]) || !full(D[i + 1])) continue;
    if (def.tight && !tight(D, i)) continue;
    out.push(i);
  }
  return out;
}

// ── costs in R ──
export function costs(tr, mult = 1) {
  const spread = mult * P.COST / tr.r0, nn = tr.side > 0 ? nights(tr.t, tr.c) : 0;
  return { spread, fin: nn * FIN.xau.long * tr.fill / tr.r0, nights: nn };
}
export const netOf = (tr, mult = 1) => { const c = costs(tr, mult); return tr.R - c.spread - c.fin; };

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
  return { n, gross: r3(mean('R')), net: r3(mean('net')), net2: r3(mean('net2')), totalNet: r2(rows.reduce((a, r) => a + r.net, 0)), win: n ? r3(rows.filter((r) => r.net > 0).length / n) : null, maxDD: r2(maxDD(rows)), months: m.months, t: r2(m.t), p: n ? +pOne(m.t).toFixed(4) : null, fillStops: rows.filter((r) => r.fillStop).length };
}
export function holm(ps, alpha = 0.05) {
  const idx = ps.map((p, i) => [p, i]).sort((x, y) => x[0] - y[0]), ok = new Array(ps.length).fill(false);
  for (let k = 0; k < idx.length; k++) { if (idx[k][0] <= alpha / (idx.length - k)) ok[idx[k][1]] = true; else break; }
  return ok;
}
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const q = (xs, p) => { const s = [...xs].sort((a, b) => a - b); const k = (s.length - 1) * p, lo = Math.floor(k); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (k - lo); };

// ── the study ──
export function study(m5, D) {
  const lastT = D.at(-1).time;
  const inWin = (i, [a, b]) => { const t = D[i + 1].time; return t >= T(a) && t < T(b); };
  const winTo = (w) => Math.min(T(w[1]) - 1, lastT + DAY - 1);
  const rowOf = (tr) => ({ ...tr, net: netOf(tr), net2: netOf(tr, 2) });
  const out = { tests: {} };
  for (const [tk, def] of Object.entries(TESTS)) {
    const st = signals(D, tk).map((i) => { const tr = walk(m5, D[i + 1], D[i].high, D[i].low, { target: def.target }); return { i, tr, row: tr ? rowOf(tr) : null }; });
    const res = { label: def.label, windows: {} };
    const wins = { inSample: P.IS, outOfSample: P.OOS, oosFirstHalf: P.OOS_HALVES[0], oosSecondHalf: P.OOS_HALVES[1] };
    for (const [wk, w] of Object.entries(wins)) {
      const sig = st.filter((s) => inWin(s.i, w)), rows = sig.filter((s) => s.row).map((s) => s.row), from = T(w[0]), to = winTo(w);
      const byYear = {};
      for (const r of rows) { const y = new Date(r.t * 1000).getUTCFullYear(); (byYear[y] ||= []).push(r); }
      const why = {};
      for (const r of rows) why[r.why] = (why[r.why] || 0) + 1;
      res.windows[wk] = {
        from: w[0], to: iso(to), ...summary(rows, from, to), signals: sig.length, unfilled: sig.filter((s) => !s.tr).length, exits: why,
        buys: summary(rows.filter((r) => r.side > 0), from, to), sells: summary(rows.filter((r) => r.side < 0), from, to),
        byYear: Object.fromEntries(Object.entries(byYear).map(([y, rs]) => [y, { n: rs.length, net: r3(rs.reduce((a, r) => a + r.net, 0) / rs.length), total: r2(rs.reduce((a, r) => a + r.net, 0)) }])),
        medianRisk: rows.length ? r2(q(rows.map((r) => r.r0), 0.5)) : null,
      };
    }
    // placebo, out of sample: random non-inside full days with a full next day (T3: also tight), the same bracket, exit, costs
    const pool = [];
    for (let i = 1; i + 1 < D.length; i++) {
      if (isInside(D, i) || !full(D[i]) || !full(D[i + 1]) || !inWin(i, P.OOS)) continue;
      if (def.tight && !tight(D, i)) continue;
      pool.push(i);
    }
    const nSig = res.windows.outOfSample.signals, seeds = [];
    for (let sd = 1; sd <= P.SEEDS; sd++) {
      const rnd = mulberry32(sd), xs = [];
      for (let k = 0; k < nSig; k++) { const i = pool[Math.floor(rnd() * pool.length)], tr = walk(m5, D[i + 1], D[i].high, D[i].low, { target: def.target }); if (tr) xs.push(netOf(tr)); }
      seeds.push(xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : 0);
    }
    const real = res.windows.outOfSample.net;
    res.placebo = { seeds: P.SEEDS, pool: pool.length, perSeed: nSig, p95: r3(q(seeds, 0.95)), median: r3(q(seeds, 0.5)), min: r3(Math.min(...seeds)), max: r3(Math.max(...seeds)), real, beaten: seeds.filter((x) => real > x).length, means: seeds.map(r3) };
    out.tests[tk] = res;
  }
  const keys = Object.keys(out.tests), hp = holm(keys.map((k) => out.tests[k].windows.outOfSample.p ?? 1));
  keys.forEach((k, j) => {
    const v = out.tests[k], o = v.windows.outOfSample, i = v.windows.inSample;
    v.checks = { oosPositive: o.net > 0, oosT2: o.t != null && o.t >= 2, holm: hp[j], isPositive: i.net > 0, oos2xCosts: o.net2 > 0, placebo: v.placebo.beaten >= P.PLACEBO_BEAT, oosN30: o.n >= P.MIN_OOS_N };
    v.pass = Object.values(v.checks).every(Boolean);
  });
  out.passed = keys.filter((k) => out.tests[k].pass).length;
  out.verdict = out.passed ? 'PASS' : 'FAIL';
  return out;
}

export function loadM5(file) {
  const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString());
  rows.sort((a, b) => a[0] - b[0]);
  return rows.filter((r, k) => k === 0 || r[0] !== rows[k - 1][0]);
}

// ── RESULT.md, written from result.json ──
const sg = (v, d = 3) => (v == null ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d));
const pct = (v) => (v == null ? '—' : (100 * v).toFixed(1));
export function headline(res) {
  const o = res.tests.T1.windows.outOfSample, i = res.tests.T1.windows.inSample;
  return `**Verdict: ${res.verdict}, ${res.passed} of 3: the gold inside-day breakout (exit 21:00 UTC) made ${sg(o.net)}R a trade net out of sample (n ${o.n}, month t ${sg(o.t, 2)}), ${sg(i.net)}R in sample; T2 and T3 fail too.**`;
}
export function report(res) {
  const L = [];
  L.push(`# Daily inside-day breakout on spot gold: result (${res.built})`, '', headline(res), '');
  L.push('Pre-registered in `PREREGISTRATION.md` (pushed alone before any trade was computed; sha256 in `result.json`). A new stand-alone',
    'rule, not a gate, exit, entry or size of the gold book (docs/owner-decisions.md item 44); nothing of that book was read. Paper',
    'research only: nothing live changed and no proposal is written. This page is written by `run.mjs` from `result.json`.', '');
  L.push('## Rule (as pre-registered)', '',
    '- Spot gold, OANDA mid XAU/USD M5 candles; daily candles built from the same M5 candles (UTC days, weekend folded into Monday',
    '  as `council/fills.mjs` `foldWeekend`). A day needs 120+ M5 candles; the inside day, the day before and the order day must be full.',
    '- Inside day: high below the previous day\'s high, low above its low. Next day: buy stop at its high, sell stop at its low, first',
    '  filled wins, the other cancelled; orders live until 21:00 UTC. **Stop = the other side of the inside day on every trade.**',
    '- M5 path: a gap fills at the open; a fill candle that also reaches the stop is a full loss; later candles exit at the stop (or',
    '  the open when gapped). T1 exit 21:00 UTC; T2 1R target (stop first in one candle), else 21:00 UTC; T3 = T1 when the inside',
    '  day\'s range is under 0.6 x ATR14.',
    `- Costs: $${res.params.COST.toFixed(2)} a round trip (2x = $${(2 * res.params.COST).toFixed(2)}), financing on buys by \`nights\` x \`FIN.xau.long\` (${res.params.finGoldLong}).`,
    '- In sample: order days 2008-2016; out of sample (decisive): 2017 to the last day on file. t on calendar-month sums of net R;',
    '  Holm over the three out-of-sample p values; placebo = 40 seeds of random non-inside days under the same rule.', '');
  L.push('## Results', '',
    '| Test | Window | Signals | Unfilled | n | Gross R | Net R | Net at 2x | Win % | Total net R | Worst DD R | Month t | One-sided p | Median risk $ | Fill-candle stops |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  const wl = { inSample: 'IS 2008-16', outOfSample: 'OOS 2017-now', oosFirstHalf: 'OOS 2017-21 (reported)', oosSecondHalf: 'OOS 2022-now (reported)' };
  for (const [k, v] of Object.entries(res.tests)) for (const [wk, nm] of Object.entries(wl)) {
    const w = v.windows[wk];
    L.push(`| ${k} | ${nm} | ${w.signals} | ${w.unfilled} | ${w.n} | ${sg(w.gross)} | ${sg(w.net)} | ${sg(w.net2)} | ${pct(w.win)} | ${sg(w.totalNet, 2)} | ${sg(w.maxDD, 2)} | ${sg(w.t, 2)} | ${w.p ?? '—'} | ${w.medianRisk ?? '—'} | ${w.fillStops} |`);
  }
  L.push('', 'Tests: ' + Object.entries(res.tests).map(([k, v]) => `${k} ${v.label}`).join('; ') + '.', '');
  L.push('## The checks', '', '| Test | OOS net > 0 | OOS t ≥ 2 | Holm | IS net > 0 | OOS at 2x > 0 | Beats ≥ 38 of 40 placebos | OOS n ≥ 30 | Pass |', '|---|---|---|---|---|---|---|---|---|');
  const yn = (b) => (b ? 'yes' : 'no');
  for (const [k, v] of Object.entries(res.tests)) { const c = v.checks; L.push(`| ${k} | ${yn(c.oosPositive)} | ${yn(c.oosT2)} | ${yn(c.holm)} | ${yn(c.isPositive)} | ${yn(c.oos2xCosts)} | ${yn(c.placebo)} | ${yn(c.oosN30)} | ${v.pass ? '**yes**' : 'no'} |`); }
  L.push('', '## Placebo (out of sample, 40 seeds)', '', 'Each seed draws as many random non-inside full days of the window as the test has real signals (T3: non-inside days that are also under 0.6 x ATR14) and runs the same bracket, exit and costs.', '',
    '| Test | Real net R a trade | Seeds beaten | Placebo median | Placebo 95th pct | Placebo min / max | Pool |', '|---|---|---|---|---|---|---|');
  for (const [k, v] of Object.entries(res.tests)) { const p = v.placebo; L.push(`| ${k} | ${sg(p.real)} | ${p.beaten} of ${p.seeds} | ${sg(p.median)} | ${sg(p.p95)} | ${sg(p.min)} / ${sg(p.max)} | ${p.pool} |`); }
  L.push('', '## Buys and sells (reported, not judged)', '', '| Test | Window | Buys n | Buys net R | Sells n | Sells net R |', '|---|---|---|---|---|---|');
  for (const [k, v] of Object.entries(res.tests)) for (const wk of ['inSample', 'outOfSample']) { const w = v.windows[wk]; L.push(`| ${k} | ${wl[wk]} | ${w.buys.n} | ${sg(w.buys.net)} | ${w.sells.n} | ${sg(w.sells.net)} |`); }
  L.push('', '## By year, T1 (reported)', '', '| Year | n | Net R a trade | Total net R |', '|---|---|---|---|');
  const by = { ...res.tests.T1.windows.inSample.byYear, ...res.tests.T1.windows.outOfSample.byYear };
  for (const y of Object.keys(by).sort()) L.push(`| ${y} | ${by[y].n} | ${sg(by[y].net)} | ${sg(by[y].total, 2)} |`);
  L.push('', '## Data', '', `- ${res.src}`, `- ${res.dailyCheck}`,
    '- To repeat: `node research/edge/gold-inside-day/run.mjs <xau-5m.json.gz>` (M5 cache outside git). Tests: `tests/gold-inside-day.test.mjs`.', '');
  return L.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const file = process.argv[2];
  if (!file) { console.error('usage: run.mjs <xau-5m.json.gz>'); process.exit(2); }
  const m5 = loadM5(file), raw = utcDays(m5), D = foldDays(raw);
  // the fold equals council/fills.mjs foldWeekend on the same day candles
  const fw = foldWeekend(raw.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));
  if (fw.length !== D.length || fw.some((b, k) => b.time !== D[k].time || b.open !== D[k].open || b.high !== D[k].high || b.low !== D[k].low || b.close !== D[k].close)) throw new Error('fold differs from foldWeekend');
  let dailyCheck = 'council-data research/daily/xau.json: not read';
  try {
    const cd = JSON.parse(execFileSync('git', ['show', 'origin/council-data:research/daily/xau.json'], { cwd: HERE, maxBuffer: 1 << 28 }).toString());
    const cf = new Map(foldWeekend(cd.rows.map(([t, o, h, l, c]) => ({ time: t, open: o, high: h, low: l, close: c }))).map((b) => [b.time, b]));
    let both = 0, diff = 0;
    for (const d of D) { const b = cf.get(d.time); if (!b || !full(d)) continue; both++; if (Math.abs(b.high - d.high) > 0.05 || Math.abs(b.low - d.low) > 0.05) diff++; }
    dailyCheck = `Check only: of ${both} full days also in council-data research/daily/xau.json (folded the same way), ${diff} differ by more than $0.05 in high or low.`;
  } catch (e) { dailyCheck += ` (${e.message.split('\n')[0]})`; }
  const r = study(m5, D);
  const res = {
    study: 'gold-inside-day', built: '2026-11-14', verdict: r.verdict, passed: r.passed, of: 3,
    rule: 'Spot gold daily inside day (high < previous high, low > previous low); next day OCO buy stop at its high / sell stop at its low until 21:00 UTC, stop the other side. T1 exit 21:00 UTC; T2 1R target else 21:00 UTC; T3 T1 when range < 0.6 x ATR14. M5 path.',
    params: { ...P, finGoldLong: FIN.xau.long },
    prereg: crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex'),
    src: `OANDA mid XAU/USD M5 candles (${m5.length} candles, ${iso(m5[0][0])} to ${iso(m5.at(-1)[0])}), daily candles built from them (${D.length} folded days, ${D.filter(full).length} full)`,
    dailyCheck,
    note: 'A stand-alone rule, not a test of the gold book (item 44). Paper research; nothing live changed.',
    tests: r.tests,
  };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(res));
  for (const [k, v] of Object.entries(r.tests)) {
    const s = (w) => { const { byYear: _a, buys: _b, sells: _c, ...x } = w; return JSON.stringify(x); };
    console.log(k, v.pass, JSON.stringify(v.checks), '\n IS', s(v.windows.inSample), '\n OOS', s(v.windows.outOfSample), '\n placebo', v.placebo.p95, v.placebo.median, v.placebo.beaten);
  }
  console.log(headline(res), headline(res).length, '\n', dailyCheck);
}
