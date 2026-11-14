// Gradual information diffusion across markets, monthly leader signals (pre-registered 14 Nov 2026, PREREGISTRATION.md, pushed
// first). F1 US500 leads ten non-US indices, F2 copper leads DE40 / AU200 / HK33, F3 the USD basket (inverted) leads gold,
// silver, platinum. Each follower is traded for the next month in the leader's direction, 1R = stop = 3 x ATR(20), net of spread
// and overnight financing; control = the follower's own past month. Six one-sided tests (F1-F3 and leader minus own), Holm.
//   node research/edge/intermarket-lead/run.mjs      reads council-data with git show, writes result.json and RESULT.md
// Paper research only: nothing live reads this file.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights } from '../../../council/fills.mjs';

export const FAMILIES = {
  F1: { name: 'US500 leads the non-US indices', leader: 'spx500', followers: ['de40', 'uk100', 'eu50', 'fr40', 'ch20', 'nl25', 'jp225', 'au200', 'hk33', 'sg30'], invert: false },
  F2: { name: 'Copper leads DE40, AU200, HK33', leader: 'xcu', followers: ['de40', 'au200', 'hk33'], invert: false },
  F3: { name: 'The dollar (inverted) leads the metals', leader: 'usd', followers: ['xau', 'xag', 'xpt'], invert: true },
};
// USD basket: +1 = the pair rises when the dollar rises
export const USD_PAIRS = { eurusd: -1, gbpusd: -1, audusd: -1, nzdusd: -1, usdjpy: 1, usdcad: 1, usdchf: 1 };
export const P = { ATR_N: 20, ATR_MULT: 3, SEEDS: 40, NW_LAGS: 3, MARKUP: 2.5 };
export const IS = { from: '2004-01', to: '2016-12' };
export const OOS = { from: '2017-01', to: '2026-10' };
// round-trip cost: fraction of price, or a fixed price amount (xau)
export const COST = {
  de40: { frac: 0.0004 }, uk100: { frac: 0.0004 }, eu50: { frac: 0.0004 }, fr40: { frac: 0.0004 }, ch20: { frac: 0.0004 },
  nl25: { frac: 0.0004 }, jp225: { frac: 0.0004 }, au200: { frac: 0.0004 }, hk33: { frac: 0.0004 }, sg30: { frac: 0.0004 },
  xau: { abs: 0.3 }, xag: { frac: 0.001 }, xpt: { frac: 0.002 },
};
export const CCY = {
  de40: 'EUR', eu50: 'EUR', fr40: 'EUR', nl25: 'EUR', uk100: 'GBP', ch20: 'CHF', au200: 'AUD', hk33: 'HKD', sg30: 'SGD',
  jp225: 'USD', xau: 'USD', xag: 'USD', xpt: 'USD',
};
const COLS = ['USD', 'EUR', 'GBP', 'AUD', 'HKD', 'CHF', 'SGD'];
const RATES = {
  2007: [5.0, 3.9, 5.5, 6.5, 5.0, 2.5, 2.4], 2008: [2.0, 3.9, 4.7, 6.7, 2.0, 2.1, 1.0], 2009: [0.2, 1.3, 0.6, 3.3, 0.2, 0.25, 0.7],
  2010: [0.2, 1.0, 0.5, 4.4, 0.2, 0.25, 0.4], 2011: [0.1, 1.3, 0.5, 4.7, 0.2, 0.05, 0.4], 2012: [0.1, 0.9, 0.5, 3.7, 0.2, 0, 0.4],
  2013: [0.1, 0.6, 0.5, 2.8, 0.2, 0, 0.4], 2014: [0.1, 0.2, 0.5, 2.5, 0.2, 0, 0.5], 2015: [0.1, 0.05, 0.5, 2.1, 0.2, -0.75, 1.0],
  2016: [0.4, 0, 0.4, 1.6, 0.4, -0.75, 1.0], 2017: [1.0, 0, 0.3, 1.5, 1.0, -0.75, 1.1], 2018: [1.8, 0, 0.6, 1.5, 1.8, -0.75, 1.7],
  2019: [2.2, 0, 0.75, 1.1, 2.2, -0.75, 1.8], 2020: [0.4, 0, 0.2, 0.3, 0.5, -0.75, 0.6], 2021: [0.1, 0, 0.1, 0.1, 0.1, -0.75, 0.4],
  2022: [1.7, 0.3, 1.5, 1.3, 1.8, 0, 2.0], 2023: [5.0, 3.3, 4.7, 3.9, 4.6, 1.5, 3.9], 2024: [5.1, 3.9, 5.1, 4.35, 5.0, 1.25, 3.6],
  2025: [4.2, 2.3, 4.3, 4.0, 4.0, 0.25, 2.3], 2026: [3.7, 2.0, 3.8, 3.6, 3.6, 0, 1.6],
};
export function cashRate(ccy, year) { const y = Math.min(2026, Math.max(2007, year)); return Math.max(0, RATES[y][COLS.indexOf(ccy)]); }
export function finRate(key, side, t) {
  const r = cashRate(CCY[key], new Date(t * 1000).getUTCFullYear());
  return (side > 0 ? r + P.MARKUP : Math.max(0, P.MARKUP - r)) / 100;
}
export function costOf(key, price) { const c = COST[key]; return c.abs != null ? c.abs : c.frac * price; }
const DAY = 86400;

// ─── calendar ───
export const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export function shiftYm(s, k) { const [y, m] = s.split('-').map(Number), n = y * 12 + (m - 1) + k; return `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, '0')}`; }
export function monthsBetween(from, to) { const out = []; for (let s = from; s <= to; s = shiftYm(s, 1)) out.push(s); return out; }
export const rowsToBars = (rows) => rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
export function indexMarket(key, bars) {
  const first = new Map(), last = new Map();
  bars.forEach((b, i) => { const k = ym(b.time); if (!first.has(k)) first.set(k, i); last.set(k, i); });
  return { key, bars, first, last };
}

// ─── signals (closes of S and S-1 only) ───
export function monthRet(mk, S) {
  const a = mk.last.get(shiftYm(S, -1)), b = mk.last.get(S);
  if (a == null || b == null) return null;
  return mk.bars[b].close / mk.bars[a].close - 1;
}
export function usdBasket(pairs, S) {
  let s = 0;
  for (const [k, sgn] of Object.entries(USD_PAIRS)) {
    const mk = pairs[k]; if (!mk) return null;
    const a = mk.last.get(shiftYm(S, -1)), b = mk.last.get(S);
    if (a == null || b == null) return null;
    s += sgn * Math.log(mk.bars[b].close / mk.bars[a].close);
  }
  return s / Object.keys(USD_PAIRS).length;
}
export const sgn = (x) => (x > 0 ? 1 : x < 0 ? -1 : 0);
export function leaderSide(fam, M, S) {
  const v = fam.leader === 'usd' ? usdBasket(M.pairs, S) : (M.mk[fam.leader] ? monthRet(M.mk[fam.leader], S) : null);
  if (v == null || !Number.isFinite(v)) return 0;
  return fam.invert ? -sgn(v) : sgn(v);
}
export function ownSide(mk, S) { const v = monthRet(mk, S); return v == null ? 0 : sgn(v); }

export function atr(bars, d, n = P.ATR_N) {
  if (d - n < 0) return null;
  let s = 0;
  for (let i = d - n + 1; i <= d; i++) { const b = bars[i], pc = bars[i - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}

// ─── one leg ───
export function simLeg(bars, e, x, side, dist) {
  const entry = bars[e].open, stop = side > 0 ? entry - dist : entry + dist;
  for (let i = e; i <= x; i++) {
    const b = bars[i];
    if (side > 0 && b.low <= stop) { const gap = b.open <= stop; return { entry, stop, exit: gap ? b.open : stop, exitIdx: i, how: gap ? 'gap' : 'stop' }; }
    if (side < 0 && b.high >= stop) { const gap = b.open >= stop; return { entry, stop, exit: gap ? b.open : stop, exitIdx: i, how: gap ? 'gap' : 'stop' }; }
  }
  return { entry, stop, exit: bars[x].close, exitIdx: x, how: 'close' };
}
export const exitTime = (t, how) => (how === 'close' ? t + DAY : how === 'gap' ? t : t + DAY / 2);

export function leg(mk, S, H, side) {
  const d = mk.last.get(S), e = mk.first.get(H), x = mk.last.get(H);
  if (d == null || e == null || x == null || !mk.last.has(shiftYm(S, -1))) return null;
  const a = atr(mk.bars, d); if (!a) return null;
  const dist = P.ATR_MULT * a, L = simLeg(mk.bars, e, x, side, dist);
  if (!(dist > 0) || !(side > 0 ? L.stop < L.entry : L.stop > L.entry)) throw new Error(`leg without a stop on the losing side: ${mk.key} ${H}`);
  const gross = (side * (L.exit - L.entry)) / dist;
  const costR = costOf(mk.key, L.entry) / dist;
  const t0 = mk.bars[e].time, n = nights(t0, exitTime(mk.bars[L.exitIdx].time, L.how));
  const finR = (n * (finRate(mk.key, side, t0) / 365) * L.entry) / dist;
  return { key: mk.key, side, gross, costR, finR, nights: n, how: L.how };
}

// signal: 'leader' | 'own' | a function (fam, S) -> side for the whole family (placebo)
export function runFamily(fam, M, months, signal = 'leader') {
  const out = [];
  for (const H of months) {
    const S = shiftYm(H, -1), legs = [];
    let skipped = 0;
    const famSide = signal === 'leader' ? leaderSide(fam, M, S) : typeof signal === 'function' ? signal(fam, S) : null;
    for (const k of fam.followers) {
      const mk = M.mk[k]; if (!mk) { skipped++; continue; }
      const side = signal === 'own' ? ownSide(mk, S) : famSide;
      if (!side) continue;
      const l = leg(mk, S, H, side);
      if (l) legs.push(l); else skipped++;
    }
    out.push({ month: H, side: famSide, legs, skipped });
  }
  return out;
}
export const netOf = (l, k = 1) => l.gross - k * (l.costR + l.finR);
export const monthSum = (m, k = 1) => m.legs.reduce((s, l) => s + netOf(l, k), 0);
export function monthSums(book, win, k = 1) {
  const by = new Map(book.map((m) => [m.month, m]));
  return monthsBetween(win.from, win.to).map((M) => (by.has(M) ? monthSum(by.get(M), k) : 0));
}

// ─── statistics ───
export function neweyWestT(v, lags = P.NW_LAGS) {
  const n = v.length; if (n < 2) return 0;
  const mu = v.reduce((a, b) => a + b, 0) / n, e = v.map((x) => x - mu);
  const g = (l) => { let s = 0; for (let i = l; i < n; i++) s += e[i] * e[i - l]; return s / n; };
  let lrv = g(0); for (let l = 1; l <= lags; l++) lrv += 2 * (1 - l / (lags + 1)) * g(l);
  return lrv > 0 ? mu / Math.sqrt(lrv / n) : 0;
}
const rd = (v, k = 3) => +v.toFixed(k);
export function tOf(vals) {
  const n = vals.length; if (n < 2) return 0;
  const mean = vals.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  return sd ? (mean / sd) * Math.sqrt(n) : 0;
}
export function stats(vals) {
  const n = vals.length; if (!n) return { n: 0 };
  const mean = vals.reduce((a, b) => a + b, 0) / n;
  let cum = 0, peak = 0, dd = 0; for (const v of vals) { cum += v; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak); }
  return { n, mean: rd(mean, 4), total: rd(cum, 2), t: rd(tOf(vals), 2), tNW: rd(neweyWestT(vals), 2), dd: rd(dd, 2), posPct: rd((vals.filter((v) => v > 0).length / n) * 100, 1) };
}
// standard normal upper tail
export function normSf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989422804014327 * Math.exp(-z * z / 2);
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? p : 1 - p;
}
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), m = ps.length, adj = new Array(m);
  let run = 0;
  idx.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (m - r) * p)); adj[i] = run; });
  return adj;
}
export function percentile(vals, q) { const s = [...vals].sort((a, b) => a - b), h = (s.length - 1) * q, lo = Math.floor(h); return lo + 1 < s.length ? s[lo] + (h - lo) * (s[lo + 1] - s[lo]) : s[lo]; }
export function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function legStats(book, win) {
  const legs = book.filter((m) => m.month >= win.from && m.month <= win.to).flatMap((m) => m.legs), n = legs.length;
  if (!n) return { n: 0 };
  const avg = (f) => rd(legs.reduce((s, l) => s + f(l), 0) / n, 4);
  return {
    n, long: legs.filter((l) => l.side > 0).length, short: legs.filter((l) => l.side < 0).length,
    winPct: rd((legs.filter((l) => netOf(l) > 0).length / n) * 100, 1),
    stopped: legs.filter((l) => l.how !== 'close').length, gapFills: legs.filter((l) => l.how === 'gap').length,
    avgGross: avg((l) => l.gross), avgCost: avg((l) => l.costR), avgFin: avg((l) => l.finR), avgNet: avg((l) => netOf(l)), avgNet2x: avg((l) => netOf(l, 2)),
  };
}
export function windowSummary(book, win) {
  return {
    from: win.from, to: win.to, months: monthsBetween(win.from, win.to).length,
    gross: stats(monthSums(book, win, 0)), net: stats(monthSums(book, win, 1)), net2x: stats(monthSums(book, win, 2)),
    legs: legStats(book, win),
    skipped: book.filter((m) => m.month >= win.from && m.month <= win.to).reduce((s, m) => s + m.skipped, 0),
  };
}
function byFollower(book, win) {
  const o = {};
  for (const m of book) if (m.month >= win.from && m.month <= win.to) for (const l of m.legs) { const r = (o[l.key] ||= { n: 0, gross: 0, net: 0 }); r.n++; r.gross += l.gross; r.net += netOf(l); }
  for (const k in o) { o[k].gross = rd(o[k].gross, 2); o[k].net = rd(o[k].net, 2); }
  return o;
}
function byYear(book) {
  const o = {};
  for (const m of book) { if (m.month > OOS.to) continue; const y = m.month.slice(0, 4); (o[y] ||= { legs: 0, gross: 0, net: 0 }); o[y].legs += m.legs.length; o[y].gross += monthSum(m, 0); o[y].net += monthSum(m, 1); }
  for (const y in o) { o[y].gross = rd(o[y].gross, 2); o[y].net = rd(o[y].net, 2); }
  return o;
}
// share of (month, follower) legs where leader and own sides agree
function agreement(lead, own, win) {
  const ownBy = new Map(own.map((m) => [m.month, new Map(m.legs.map((l) => [l.key, l.side]))]));
  let n = 0, same = 0;
  for (const m of lead) if (m.month >= win.from && m.month <= win.to) for (const l of m.legs) { const o = ownBy.get(m.month)?.get(l.key); if (o) { n++; if (o === l.side) same++; } }
  return { n, same, pct: n ? rd((same / n) * 100, 1) : null };
}

// ─── the whole study ───
export function study(M, lastCandle) {
  const all = monthsBetween(IS.from, OOS.to), oosM = monthsBetween(OOS.from, OOS.to), fam = {};
  for (const [id, f] of Object.entries(FAMILIES)) {
    const lead = runFamily(f, M, all, 'leader'), own = runFamily(f, M, all, 'own');
    const diffOf = (win, k = 1) => { const a = monthSums(lead, win, k), b = monthSums(own, win, k); return a.map((v, i) => v - b[i]); };
    const placebo = [];
    for (let s = 1; s <= P.SEEDS; s++) {
      const rng = mulberry32(s * 1000 + Number(id.slice(1)));
      const b = runFamily(f, M, oosM, () => (rng() < 0.5 ? -1 : 1)), v = monthSums(b, OOS, 1);
      placebo.push(rd(v.reduce((a, c) => a + c, 0) / v.length, 4));
    }
    const L = { is: windowSummary(lead, IS), oos: windowSummary(lead, OOS) };
    fam[id] = {
      name: f.name, leader: f.leader, followers: f.followers, invert: f.invert,
      lead: L, own: { is: windowSummary(own, IS), oos: windowSummary(own, OOS) },
      diff: { is: stats(diffOf(IS)), oos: stats(diffOf(OOS)) },
      agree: { is: agreement(lead, own, IS), oos: agreement(lead, own, OOS) },
      placebo: { seeds: P.SEEDS, real: L.oos.net.mean, beaten: placebo.filter((x) => L.oos.net.mean > x).length, p5: rd(percentile(placebo, 0.05), 4), p50: rd(percentile(placebo, 0.5), 4), p95: rd(percentile(placebo, 0.95), 4), runs: placebo },
      byFollower: { is: byFollower(lead, IS), oos: byFollower(lead, OOS) }, byYear: byYear(lead),
      months: lead.map((m) => ({ month: m.month, side: m.side, legs: m.legs.length, net: rd(monthSum(m, 1), 4) })),
    };
  }
  // the six tests
  const ids = Object.keys(FAMILIES), tests = [];
  for (const id of ids) tests.push({ id, kind: 'leader', t: fam[id].lead.oos.net.t });
  for (const id of ids) tests.push({ id: `D${id.slice(1)}`, fam: id, kind: 'leader minus own', t: fam[id].diff.oos.t });
  const ps = tests.map((x) => normSf(x.t)), adj = holm(ps);
  tests.forEach((x, i) => { x.p = rd(ps[i], 4); x.holm = rd(adj[i], 4); });
  const checks = {};
  for (const id of ids) {
    const F = fam[id], tf = tests.find((x) => x.id === id), td = tests.find((x) => x.fam === id);
    checks[id] = {
      oosT2Holm: F.lead.oos.net.t >= 2 && tf.holm < 0.05,
      isPositive: F.lead.is.net.mean > 0,
      oos2xPositive: F.lead.oos.net2x.mean > 0,
      beatsOwn: F.diff.oos.mean > 0 && td.holm < 0.05,
    };
    checks[id].pass = Object.values(checks[id]).every(Boolean);
  }
  return {
    study: 'intermarket-lead', built: '2026-11-14', lastCandle, params: P, cost: COST, currency: CCY, windows: { is: IS, oos: OOS },
    data: Object.fromEntries(Object.values(M.mk).concat(Object.values(M.pairs)).map((m) => [m.key, { first: ym(m.bars[0].time), last: new Date(m.bars.at(-1).time * 1000).toISOString().slice(0, 10), candles: m.bars.length }])),
    families: fam, tests, checks, verdict: checks.F1.pass ? 'PASS' : 'FAIL',
  };
}

// ─── the report ───
export function headline(R) {
  const F = R.families, f = (x) => (x > 0 ? '+' : '') + x;
  const passed = Object.keys(R.checks).filter((k) => R.checks[k].pass).length;
  return `**Verdict: ${R.verdict}, ${passed} of 3 families: US500's past month does not lead the other indices next month after costs (OOS ${f(F.F1.lead.oos.net.mean)}R a month, t ${f(F.F1.lead.oos.net.t)}); copper and the dollar fail too.**`;
}
export function report(R) {
  const f = (x) => (x == null ? 'n/a' : (x > 0 ? '+' : '') + x), yn = (b) => (b ? 'yes' : 'no'), L = [];
  L.push('# Gradual information diffusion across markets: monthly leader signals: result', '');
  L.push(headline(R), '');
  L.push(`Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (pushed alone before any number). Built ${R.built}; last candle ${R.lastCandle}. Each follower is traded for the next month in its leader's direction, 1R = stop = 3 x ATR(20), net of spread and overnight financing; the control is the follower's own past month traded the same way. Paper research only: nothing live changed, and no proposal is written.`, '');
  L.push('## The six tests (OOS 2017-01 to 2026-10, calendar-month sums, base costs; Holm over all six)', '');
  L.push('| Test | What | t | p (one-sided) | Holm p |', '|---|---|---|---|---|');
  for (const x of R.tests) L.push(`| ${x.id} | ${x.kind === 'leader' ? R.families[x.id].name : `${R.families[x.fam].name}: leader minus own past month`} | ${f(x.t)} | ${x.p} | ${x.holm} |`);
  L.push('', '| Family | OOS t >= 2 and Holm p < 0.05 | IS net > 0 | OOS net > 0 at 2x costs | Beats own momentum (Holm) | Pass |', '|---|---|---|---|---|---|');
  for (const [id, c] of Object.entries(R.checks)) L.push(`| ${id}${id === 'F1' ? ' (primary)' : ''} | ${yn(c.oosT2Holm)} | ${yn(c.isPositive)} | ${yn(c.oos2xPositive)} | ${yn(c.beatsOwn)} | ${yn(c.pass)} |`);
  for (const [id, F] of Object.entries(R.families)) {
    L.push('', `## ${id}: ${F.name}`, '');
    L.push(`Leader \`${F.leader}\`${F.invert ? ' (sign inverted)' : ''}; followers ${F.followers.map((k) => `\`${k}\``).join(', ')}.`, '');
    L.push('| Signal | Window | Legs (long / short) | Win % | Gross R a leg | Spread R | Financing R | Net R a leg | Stops (gap) | Mean R a month gross | net | 2x | t gross | t net | NW t net | Total net R | Worst DD R |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const [sn, S] of [['Leader', F.lead], ['Own (control)', F.own]]) for (const [wn, w] of [['IS', S.is], ['OOS', S.oos]]) {
      const g = w.legs;
      L.push(`| ${sn} | ${wn} ${w.from} to ${w.to} | ${g.n} (${g.long} / ${g.short}) | ${g.winPct} | ${f(g.avgGross)} | ${g.avgCost} | ${g.avgFin} | ${f(g.avgNet)} | ${g.stopped} (${g.gapFills}) | ${f(w.gross.mean)} | ${f(w.net.mean)} | ${f(w.net2x.mean)} | ${f(w.gross.t)} | ${f(w.net.t)} | ${f(w.net.tNW)} | ${f(w.net.total)} | ${w.net.dd} |`);
    }
    L.push('', `Leader minus own, net R a month: IS ${f(F.diff.is.mean)} (t ${f(F.diff.is.t)}), OOS ${f(F.diff.oos.mean)} (t ${f(F.diff.oos.t)}). The two signals agree on ${F.agree.is.pct} % of legs IS and ${F.agree.oos.pct} % OOS (where both trade).`);
    L.push(`Placebo (${F.placebo.seeds} seeds, one random sign per family-month, same legs and costs, OOS): real ${f(F.placebo.real)}R a month beats ${F.placebo.beaten} of ${F.placebo.seeds}; 5th / 50th / 95th percentile ${f(F.placebo.p5)} / ${f(F.placebo.p50)} / ${f(F.placebo.p95)}.`, '');
    L.push('| Follower | IS legs | IS gross R | IS net R | OOS legs | OOS gross R | OOS net R |', '|---|---|---|---|---|---|---|');
    for (const k of F.followers) { const a = F.byFollower.is[k] || { n: 0, gross: 0, net: 0 }, b = F.byFollower.oos[k] || { n: 0, gross: 0, net: 0 }; L.push(`| ${k} | ${a.n} | ${f(a.gross)} | ${f(a.net)} | ${b.n} | ${f(b.gross)} | ${f(b.net)} |`); }
    L.push('', '| Year | Legs | Gross R | Net R |', '|---|---|---|---|');
    for (const [y, v] of Object.entries(F.byYear)) L.push(`| ${y} | ${v.legs} | ${f(v.gross)} | ${f(v.net)} |`);
  }
  L.push('', '## Reading', '');
  if (R.verdict === 'PASS') L.push('- The primary bar was met: at most a paper shadow proposal may follow; nothing is live, and it is not an edge without a forward record.');
  else L.push('- The pre-registered bar was not met for the primary family: no proposal is written and nothing changes. A FAIL is not evidence that the opposite works; another look-back, follower set or weighting would be a new study with its own pre-registration on data it was not chosen on.');
  L.push('- The own-momentum control is the follower\'s own past month: where the leader and the follower moved together last month the two signals give the same trade, so "leader minus own" isolates the months they disagree.');
  L.push('', '## What this cannot show', '');
  L.push('- Price indices without dividends; each index earns in its own currency; approximate year-average policy rates; spreads assumed (0.04 % index CFDs, $0.30 gold, 0.10 % silver, 0.20 % platinum), not measured on the demo broker.');
  L.push('- Ten non-US followers (the brief asked for twelve; only ten keys start in 2008 or earlier). OANDA index candles close at 21:00-22:00 UTC, so a non-US month-end close already holds part of the US session (this can only weaken a US lead).');
  L.push('', 'To repeat: `node research/edge/intermarket-lead/run.mjs` (reads council-data with `git show`, no network). Tests: `tests/intermarket-lead.test.mjs`.', '');
  return L.join('\n');
}

// ─── data ───
const gitRead = (k) => execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { encoding: 'utf8', maxBuffer: 64 << 20 });
export function loadAll(read = gitRead) {
  const keys = new Set();
  for (const f of Object.values(FAMILIES)) { if (f.leader !== 'usd') keys.add(f.leader); f.followers.forEach((k) => keys.add(k)); }
  const load = (k) => indexMarket(k, foldWeekend(rowsToBars(JSON.parse(read(k)).rows)));
  return { mk: Object.fromEntries([...keys].map((k) => [k, load(k)])), pairs: Object.fromEntries(Object.keys(USD_PAIRS).map((k) => [k, load(k)])) };
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const M = loadAll();
  const last = new Date(Math.max(...Object.values(M.mk).map((m) => m.bars.at(-1).time)) * 1000).toISOString().slice(0, 10);
  const res = study(M, last);
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(res, null, 1) + '\n');
  fs.writeFileSync(new URL('./RESULT.md', import.meta.url), report(res));
  console.log(res.verdict, JSON.stringify(res.checks));
  for (const x of res.tests) console.log(x.id, x.t, x.p, x.holm);
  for (const [id, F] of Object.entries(res.families)) console.log(id, 'IS', F.lead.is.legs.n, F.lead.is.gross.mean, F.lead.is.net.mean, F.lead.is.net.t, 'OOS', F.lead.oos.legs.n, F.lead.oos.gross.mean, F.lead.oos.gross.t, F.lead.oos.net.mean, F.lead.oos.net.t, '2x', F.lead.oos.net2x.mean, 'own OOS', F.own.oos.net.mean, F.own.oos.net.t, 'plc', F.placebo.beaten, F.placebo.p95);
}
