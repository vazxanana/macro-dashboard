// Edge research · candle-patterns (PREREGISTRATION.md, pushed first).
//   Six textbook daily candlestick reversal patterns (bullish / bearish engulfing, hammer, shooting star, morning / evening
//   star) on 28 CFD markets (indices, metals but gold, energies, currency majors), at a 10-day extreme, next open, stop past
//   the pattern by 0.1 ATR(20), 2R or 5 candles, net of costs and financing; IS 2005-16, OOS 2017-2026-10.
//   node run.mjs fetch <dir>   copies the council's daily candle cache out of the council-data branch (git show, no network)
//   node run.mjs full <dir>    writes result.json next to this file
// Paper research: nothing here is read by the council, the mirror or the page.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend } from '../../../council/fills.mjs';
import { nights } from '../trend-breadth/run.mjs';

const DAY = 86400, T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
export const P = {
  START: '2005-01-01', IS_TO: '2016-12-31', OOS_FROM: '2017-01-01', OOS_TO: '2026-10-31',
  LOOK: 10, ATR: 20, BUF: 0.1, TARGET: 2, HOLD: 5, DRAWS: 40, SEED: 20261114,
  FIN_LONG: 0.00015, FIN_FX: 0.00004,
};
export const GROUPS = {
  index: 'au200 ch20 de40 eu50 fr40 hk33 jp225 nas100 nl25 sg30 spx500 uk100 us2000 us30'.split(' '),
  metal: 'xag xcu xpd xpt'.split(' '),
  energy: 'bco wtico natgas'.split(' '),
  fx: 'eurusd gbpusd audusd nzdusd usdjpy usdcad usdchf'.split(' '),
};
export const MARKETS = Object.values(GROUPS).flat();
const COST_OF = { index: 0.0004, fx: 0.00015, xag: 0.001, xcu: 0.001, xpd: 0.002, xpt: 0.002, energy: 0.001 };
export const groupOf = (k) => Object.keys(GROUPS).find((g) => GROUPS[g].includes(k));
export const costOf = (k) => COST_OF[k] ?? COST_OF[groupOf(k)];
export const PATTERNS = [
  { id: 'beng', name: 'Bullish engulfing', side: 1 },
  { id: 'seng', name: 'Bearish engulfing', side: -1 },
  { id: 'ham', name: 'Hammer', side: 1 },
  { id: 'star', name: 'Shooting star', side: -1 },
  { id: 'mst', name: 'Morning star', side: 1 },
  { id: 'est', name: 'Evening star', side: -1 },
];
const r3 = (v) => (Number.isFinite(v) ? +v.toFixed(3) : null);

// ── candle parts ──
const body = (b) => Math.abs(b.close - b.open), rng = (b) => b.high - b.low;
const up = (b) => b.close > b.open, dn = (b) => b.close < b.open;
const upper = (b) => b.high - Math.max(b.open, b.close), lower = (b) => Math.min(b.open, b.close) - b.low;

// pattern on candle i (its last candle): returns its number of candles, or 0. Reads candles i-2 … i only.
export function match(id, D, i) {
  const c = D[i], p = D[i - 1], q = D[i - 2];
  switch (id) {
    case 'beng': return p && dn(p) && up(c) && c.open <= p.close && c.close >= p.open && body(c) > body(p) ? 2 : 0;
    case 'seng': return p && up(p) && dn(c) && c.open >= p.close && c.close <= p.open && body(c) > body(p) ? 2 : 0;
    case 'ham': return rng(c) > 0 && body(c) <= rng(c) / 3 && lower(c) >= 2 * body(c) && upper(c) <= 0.1 * rng(c) ? 1 : 0;
    case 'star': return rng(c) > 0 && body(c) <= rng(c) / 3 && upper(c) >= 2 * body(c) && lower(c) <= 0.1 * rng(c) ? 1 : 0;
    case 'mst': return q && dn(q) && body(q) >= 0.6 * rng(q) && body(p) <= 0.3 * body(q) && Math.max(p.open, p.close) <= q.close
      && up(c) && c.close > (q.open + q.close) / 2 ? 3 : 0;
    case 'est': return q && up(q) && body(q) >= 0.6 * rng(q) && body(p) <= 0.3 * body(q) && Math.min(p.open, p.close) >= q.close
      && dn(c) && c.close < (q.open + q.close) / 2 ? 3 : 0;
  }
  return 0;
}

export function atr(D, i, n = P.ATR) {
  let a = 0;
  for (let j = i - n + 1; j <= i; j++) a += Math.max(D[j].high - D[j].low, Math.abs(D[j].high - D[j - 1].close), Math.abs(D[j].low - D[j - 1].close));
  return a / n;
}

// every signal of one pattern on candles D (already folded and cut). { i, side, ext } ext = the pattern's extreme.
export function signals(D, id, { context = true } = {}) {
  const pat = PATTERNS.find((x) => x.id === id), out = [];
  for (let i = Math.max(P.ATR, P.LOOK - 1); i < D.length; i++) {
    const n = match(id, D, i);
    if (!n) continue;
    let flat = false, lo = Infinity, hi = -Infinity;
    for (let j = i - n + 1; j <= i; j++) { if (rng(D[j]) <= 0) flat = true; lo = Math.min(lo, D[j].low); hi = Math.max(hi, D[j].high); }
    if (flat) continue;
    if (context) {
      let wlo = Infinity, whi = -Infinity;
      for (let j = i - P.LOOK + 1; j <= i; j++) { wlo = Math.min(wlo, D[j].low); whi = Math.max(whi, D[j].high); }
      if (pat.side > 0 && lo > wlo) continue;
      if (pat.side < 0 && hi < whi) continue;
    }
    out.push({ i, side: pat.side, ext: pat.side > 0 ? lo : hi, pat: id });
  }
  return out;
}

// one trade from a signal on candle i; r0 forced (placebo) keeps the stop distance of the real trade
export function trade(D, s, { side = s.side, r0: force } = {}) {
  const e = s.i + 1;
  if (e >= D.length) return null;
  const entry = D[e].open, A = atr(D, s.i);
  let stop, r0;
  if (force != null) { r0 = force; stop = entry - side * r0; }
  else { stop = s.side > 0 ? s.ext - P.BUF * A : s.ext + P.BUF * A; r0 = side * (entry - stop); }
  if (!(r0 > 0)) return null;
  const tgt = entry + side * P.TARGET * r0;
  let exit = null, x = e, why = 'time', end = false;
  for (let j = e; j <= Math.min(e + P.HOLD - 1, D.length - 1); j++) {
    const b = D[j]; x = j;
    if (j > e && side * (b.open - stop) <= 0) { exit = b.open; why = 'stop'; break; }
    if (j > e && side * (b.open - tgt) >= 0) { exit = b.open; why = 'target'; break; }
    if (side > 0 ? b.low <= stop : b.high >= stop) { exit = stop; why = 'stop'; break; }
    if (side > 0 ? b.high >= tgt : b.low <= tgt) { exit = tgt; why = 'target'; break; }
  }
  if (exit == null) { exit = D[x].close; end = x < e + P.HOLD - 1; }
  const exitT = why === 'time' ? D[x].time + DAY : D[x].time + DAY / 2;
  return { t: D[e].time, c: D[x].time, ie: e, ix: x, side, entry, stop, r0, exit, why, end: end || undefined,
    g: side * (exit - entry) / r0, nights: nights(D[e].time, exitT) };
}

export function net(tr, k, mult = 1) {
  const fx = groupOf(k) === 'fx', fin = fx ? P.FIN_FX : tr.side > 0 ? P.FIN_LONG : 0;
  const cost = mult * costOf(k) * tr.entry / tr.r0, f = fin * tr.nights * tr.entry / tr.r0;
  return { n: tr.g - cost - f, cost, fin: f };
}

// a stream on one market: the union of the given patterns' signals, one position at a time
export function stream(D, ids, { context = true, dirs = null } = {}) {
  const by = new Map();
  for (const id of ids) for (const s of signals(D, id, { context })) {
    const o = by.get(s.i);
    if (!o) by.set(s.i, { ...s, pats: [id] });
    else if (o.side !== s.side) o.conflict = true;
    else { o.pats.push(id); o.ext = s.side > 0 ? Math.min(o.ext, s.ext) : Math.max(o.ext, s.ext); }
  }
  const sig = [...by.values()].filter((s) => !s.conflict).sort((a, b) => a.i - b.i), out = [];
  let busy = -1;
  for (const s of sig) {
    if (s.i < busy) continue;               // the position of this stream is still open on candle s.i
    const tr = dirs ? dirs(s) : trade(D, s);
    if (!tr) continue;
    out.push({ ...tr, pats: s.pats, sigI: s.i });
    busy = tr.ix;                           // a new signal may come on the exit candle itself or later
  }
  return out;
}

// ── statistics ──
export function stat(xs) {
  const n = xs.length; if (!n) return { n: 0, mean: null, sd: null, t: null };
  const m = xs.reduce((a, b) => a + b, 0) / n, sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : 0;
  return { n, mean: m, sd, t: sd > 0 ? m / (sd / Math.sqrt(n)) : null };
}
export function monthly(rows, from, to, key = 'n') {
  const mk = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
  const a = mk(from), b = mk(to), m = new Array(b - a + 1).fill(0);
  for (const r of rows) { const k = mk(r.c); if (k >= a && k <= b) m[k - a] += r[key]; }
  return stat(m);
}
export function p2(t) {                     // two-sided normal p
  if (t == null) return 1;
  const x = Math.abs(t) / Math.SQRT2, k = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-x * x);
  return 1 - erf;
}
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let run = 0;
  o.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, p * (ps.length - k))); out[i] = run; });
  return out;
}
export function rng32(seed) {               // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// rows over markets with g / n / x2
function rowsOf(byMk) {
  const rows = [];
  for (const [k, trs] of Object.entries(byMk)) for (const tr of trs) {
    const a = net(tr, k), b = net(tr, k, 2);
    rows.push({ k, t: tr.t, c: tr.c, side: tr.side, g: tr.g, n: a.n, x2: b.n, cost: a.cost, fin: a.fin, why: tr.why, pats: tr.pats });
  }
  return rows;
}
export function window(rows, from, to) {
  const a = T(from), b = T(to) + DAY - 1, R = rows.filter((r) => r.t >= a && r.t <= b);
  const g = stat(R.map((r) => r.g)), n = stat(R.map((r) => r.n)), x2 = stat(R.map((r) => r.x2));
  const mg = monthly(R, a, b, 'g'), mn = monthly(R, a, b, 'n'), m2 = monthly(R, a, b, 'x2');
  return { n: R.length, win: R.length ? r3(R.filter((r) => r.n > 0).length / R.length) : null,
    gross: r3(g.mean), net: r3(n.mean), x2: r3(x2.mean), tGross: r3(mg.t), tNet: r3(mn.t), tX2: r3(m2.t),
    cost: r3(stat(R.map((r) => r.cost)).mean), fin: r3(stat(R.map((r) => r.fin)).mean), months: mn.n };
}

// ── files ──
export function load(dir, k) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, `${k}.json`), 'utf8'));
  const raw = j.rows.map(([t, o, h, l, c]) => ({ time: t, open: o, high: h, low: l, close: c }));
  return foldWeekend(raw).filter((b) => b.time >= T(P.START));
}
function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const k of MARKETS) fs.writeFileSync(path.join(dir, `${k}.json`), execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
  console.log(`${MARKETS.length} files in ${dir}`);
}

export const TESTS = [
  { id: 'T1', name: 'All six, at a 10-day extreme', ids: PATTERNS.map((p) => p.id), context: true },
  ...PATTERNS.map((p, j) => ({ id: `T${j + 2}`, name: `${p.name}, at a 10-day extreme`, ids: [p.id], context: true })),
  { id: 'T8', name: 'All six, no context filter', ids: PATTERNS.map((p) => p.id), context: false },
  ...PATTERNS.map((p, j) => ({ id: `T${j + 9}`, name: `${p.name}, no context filter`, ids: [p.id], context: false })),
];

function full(dir) {
  const data = Object.fromEntries(MARKETS.map((k) => [k, load(dir, k)]));
  const out = [];
  const trades = {};
  for (const t of TESTS) {
    const byMk = Object.fromEntries(MARKETS.map((k) => [k, stream(data[k], t.ids, { context: t.context })]));
    if (t.id === 'T1') trades.T1 = byMk;
    const rows = rowsOf(byMk);
    out.push({ id: t.id, name: t.name, context: t.context, patterns: t.ids,
      is: window(rows, P.START, P.IS_TO), oos: window(rows, P.OOS_FROM, P.OOS_TO),
      stopped: rows.length ? r3(rows.filter((r) => r.why === 'stop').length / rows.length) : null,
      target: rows.length ? r3(rows.filter((r) => r.why === 'target').length / rows.length) : null, _rows: rows });
  }
  const hp = holm(out.map((t) => p2(t.oos.tNet)));
  out.forEach((t, j) => { t.p = r3(p2(t.oos.tNet)); t.holm = r3(hp[j]); });

  // T1 by group and by OOS year
  const t1 = out[0]._rows;
  const byGroup = Object.fromEntries(Object.keys(GROUPS).map((g) => [g, { is: window(t1.filter((r) => groupOf(r.k) === g), P.START, P.IS_TO), oos: window(t1.filter((r) => groupOf(r.k) === g), P.OOS_FROM, P.OOS_TO) }]));
  const bySide = Object.fromEntries([['long', 1], ['short', -1]].map(([n, s]) => [n, { is: window(t1.filter((r) => r.side === s), P.START, P.IS_TO), oos: window(t1.filter((r) => r.side === s), P.OOS_FROM, P.OOS_TO) }]));
  const years = {};
  for (let y = 2005; y <= 2026; y++) { const w = window(t1, `${y}-01-01`, y === 2026 ? P.OOS_TO : `${y}-12-31`); years[y] = { n: w.n, net: w.net, sum: r3((w.net || 0) * w.n) }; }

  // placebo: same markets and signal candles as T1, same r0, random direction, one at a time per market
  const draws = [];
  const rnd = rng32(P.SEED);
  for (let d = 0; d < P.DRAWS; d++) {
    const byMk = {};
    for (const k of MARKETS) {
      const D = data[k], real = trades.T1[k];
      const sig = real.map((tr) => ({ i: tr.sigI, side: tr.side, r0: tr.r0 }));
      const res = []; let busy = -1;
      // the real T1 trades never overlap; random directions can change exits, so the one-at-a-time rule is applied again
      for (const s of sig) {
        const side = rnd() < 0.5 ? 1 : -1;
        if (s.i < busy) continue;
        const tr = trade(D, { i: s.i, side, ext: 0 }, { side, r0: s.r0 });
        if (!tr) continue;
        res.push(tr); busy = tr.ix;
      }
      byMk[k] = res;
    }
    const w = window(rowsOf(byMk), P.OOS_FROM, P.OOS_TO);
    draws.push({ net: w.net, tNet: w.tNet, n: w.n });
  }
  const q = (xs, f) => { const s = [...xs].sort((a, b) => a - b); return r3(s[Math.min(s.length - 1, Math.floor(f * (s.length - 1) + 0.5))]); };
  const T1 = out[0];
  const placebo = { seed: P.SEED, draws: P.DRAWS,
    oosNet: { median: q(draws.map((d) => d.net), 0.5), p5: q(draws.map((d) => d.net), 0.05), p95: q(draws.map((d) => d.net), 0.95) },
    oosT: { median: q(draws.map((d) => d.tNet), 0.5), p5: q(draws.map((d) => d.tNet), 0.05), p95: q(draws.map((d) => d.tNet), 0.95) },
    atOrAboveT1: draws.filter((d) => d.tNet >= T1.oos.tNet).length };

  const c1 = T1.oos.tNet >= 2 && T1.holm < 0.05, c2 = T1.is.net > 0, c3 = T1.oos.x2 > 0;
  const verdict = c1 && c2 && c3 ? 'PASS' : 'FAIL';
  const res = {
    built: '2026-11-14', topic: 'candle-patterns', verdict,
    title: 'Classic daily candlestick reversal patterns on 28 CFD markets',
    system: 'Six textbook daily candlestick reversal patterns (engulfing, hammer / shooting star, morning / evening star) at a 10-day extreme on index, metal (not gold), energy and currency CFDs, next open, 2R or 5 days, net of costs and financing',
    data: 'council-data research/daily (OANDA mid, UTC days, weekends folded), from 2005-01-01',
    windows: { is: [P.START, P.IS_TO], oos: [P.OOS_FROM, P.OOS_TO] }, params: P, groups: GROUPS, costs: COST_OF,
    bar: { c1: !!c1, c2: !!c2, c3: !!c3 },
    tests: out.map(({ _rows, ...t }) => t), byGroup, bySide, years, placebo,
  };
  fs.writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'result.json'), JSON.stringify(res, null, 1) + '\n');
  console.log(verdict, JSON.stringify(res.bar));
  for (const t of res.tests) console.log(t.id, t.name.padEnd(42), 'IS', t.is.n, t.is.gross, t.is.net, t.is.tNet, '| OOS', t.oos.n, t.oos.gross, t.oos.net, t.oos.tGross, t.oos.tNet, 'x2', t.oos.x2, 'holm', t.holm);
  console.log(JSON.stringify(placebo)); console.log(JSON.stringify(byGroup, null, 0)); console.log(JSON.stringify(bySide));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch' && dir) fetchAll(dir);
  else if (cmd === 'full' && dir) full(dir);
  else console.log('usage: node run.mjs fetch <dir> | full <dir>');
}
