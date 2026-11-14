// Edge research · gold-regime-switch (PREREGISTRATION.md, pushed first): spot gold H4, the 20-bar efficiency ratio labels each
// closed candle TREND (> 0.35), RANGE (< 0.20) or NEUTRAL. TREND: buy a close above the prior 20-bar high (sell below the low)
// in the 20-bar direction, out on the opposite 10-bar channel close. RANGE: fade a close outside the Bollinger 20 / 2 bands,
// out on a close back to the middle band. Market at the next open, stop 1.5 ATR(14), 30-candle time exit, one at a time.
// T1 the switch, T2 the breakout leg alone, T3 the fade leg alone. $0.30 spread + half a spread of slippage each way,
// financing on buys (council/fills.mjs FIN). IS 2016-20, OOS 2021-now, t on calendar-month sums, Holm over three, 40 seeds
// of block-shuffled regime labels. A stand-alone rule: not the gold book (item 44); no candle before 2016.
//   node research/edge/gold-regime-switch/run.mjs <dir>    (dir from fetch.mjs) -> result.json next to this file
// Paper research: nothing here is read by the council, the mirror or the page.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nights, FIN } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const r3 = (v) => (Number.isFinite(v) ? +v.toFixed(3) : null), r2 = (v) => (Number.isFinite(v) ? +v.toFixed(2) : null);

export const P = {
  ER_LEN: 20, ER_TREND: 0.35, ER_RANGE: 0.20, ATR_LEN: 14, DON: 20, DON_EXIT: 10, BB_LEN: 20, BB_K: 2,
  STOP_ATR: 1.5, HOLD: 30, SPREAD: 0.30, SLIP: 0.5, SEEDS: 40, BLOCK: 20,
  START: '2016-01-01', IS: ['2016-01-01', '2021-01-01'], OOS: ['2021-01-01', '2100-01-01'],
};
export const TESTS = {
  T1: { legs: ['brk', 'fade'], label: 'The switch: breakout in TREND, fade in RANGE (primary)' },
  T2: { legs: ['brk'], label: 'Breakout leg alone, TREND regimes only' },
  T3: { legs: ['fade'], label: 'Fade leg alone, RANGE regimes only' },
};
export const TREND = 'T', RANGE = 'R', NEUTRAL = 'N';

export const toBars = (rows) => rows.filter((r) => r[0] >= T(P.START)).map(([t, o, h, l, c]) => ({ time: t, open: o, high: h, low: l, close: c }));

// ── indicators on closed candles: index i reads candles 0..i only ──
export function indicators(bars, p = P) {
  const n = bars.length, nul = () => new Array(n).fill(null);
  const er = nul(), dir = nul(), atr = nul(), h20 = nul(), l20 = nul(), h10 = nul(), l10 = nul(), mid = nul(), up = nul(), lo = nul();
  const tr = bars.map((b, i) => (i ? Math.max(b.high - b.low, Math.abs(b.high - bars[i - 1].close), Math.abs(b.low - bars[i - 1].close)) : null));
  for (let i = 0; i < n; i++) {
    const c = bars[i].close;
    if (i >= p.ER_LEN) {
      let s = 0; for (let j = i - p.ER_LEN + 1; j <= i; j++) s += Math.abs(bars[j].close - bars[j - 1].close);
      const ch = c - bars[i - p.ER_LEN].close;
      er[i] = s > 0 ? Math.abs(ch) / s : 0; dir[i] = Math.sign(ch);
    }
    if (i >= p.ATR_LEN) { let a = 0; for (let j = i - p.ATR_LEN + 1; j <= i; j++) a += tr[j]; atr[i] = a / p.ATR_LEN; }
    if (i >= p.DON) { let h = -Infinity, l = Infinity; for (let j = i - p.DON; j < i; j++) { h = Math.max(h, bars[j].high); l = Math.min(l, bars[j].low); } h20[i] = h; l20[i] = l; }
    if (i >= p.DON_EXIT) { let h = -Infinity, l = Infinity; for (let j = i - p.DON_EXIT; j < i; j++) { h = Math.max(h, bars[j].high); l = Math.min(l, bars[j].low); } h10[i] = h; l10[i] = l; }
    if (i >= p.BB_LEN - 1) {
      let s = 0; for (let j = i - p.BB_LEN + 1; j <= i; j++) s += bars[j].close;
      const m = s / p.BB_LEN; let v = 0; for (let j = i - p.BB_LEN + 1; j <= i; j++) v += (bars[j].close - m) ** 2;
      const sd = Math.sqrt(v / p.BB_LEN); mid[i] = m; up[i] = m + p.BB_K * sd; lo[i] = m - p.BB_K * sd;
    }
  }
  const regime = er.map((e) => (e == null ? null : e > p.ER_TREND ? TREND : e < p.ER_RANGE ? RANGE : NEUTRAL));
  return { er, dir, atr, h20, l20, h10, l10, mid, up, lo, regime };
}

const ready = (ind, i) => ind.regime[i] != null && ind.atr[i] != null && ind.h20[i] != null && ind.mid[i] != null && ind.h10[i] != null;

// ── signal at closed bar i for one leg, under a regime label series (real or shuffled); `any` ignores the label ──
export function legSignal(bars, ind, i, leg, regime = ind.regime, any = false) {
  if (!ready(ind, i)) return 0;
  const c = bars[i].close, g = regime[i];
  if (leg === 'brk' && (any || g === TREND)) {
    if (c > ind.h20[i] && (any || ind.dir[i] === 1)) return 1;
    if (c < ind.l20[i] && (any || ind.dir[i] === -1)) return -1;
  }
  if (leg === 'fade' && (any || g === RANGE)) {
    if (c > ind.up[i]) return -1;
    if (c < ind.lo[i]) return 1;
  }
  return 0;
}

// ── one trade from signal { i, side, leg }: entry at bars[i+1].open ──
export function trade(bars, ind, s, p = P) {
  const e = s.i + 1; if (e >= bars.length) return null;
  const side = s.side, fill = bars[e].open, r0 = p.STOP_ATR * ind.atr[s.i], stop = fill - side * r0;
  const done = (px, k, why, c) => ({ leg: s.leg, side, t: bars[e].time, c, fill, stop, r0, R: side * (px - fill) / r0, exitIdx: k, why, held: k - e + 1 });
  for (let k = e; k < bars.length; k++) {
    const b = bars[k], span = (bars[k + 1]?.time ?? b.time + 14400) - b.time;
    const hit = side > 0 ? b.low <= stop : b.high >= stop;
    if (hit) { const gap = side > 0 ? b.open < stop : b.open > stop; return done(gap ? b.open : stop, k, gap ? 'gap' : 'stop', b.time + span); }
    if (k - e + 1 >= p.HOLD) return done(b.close, k, 'time', b.time + span);
    const out = s.leg === 'brk'
      ? (side > 0 ? b.close < ind.l10[k] : b.close > ind.h10[k])
      : (side > 0 ? b.close >= ind.mid[k] : b.close <= ind.mid[k]);
    if (out) {
      if (k + 1 >= bars.length) return null;   // exit candle not printed yet: still open, left out
      return done(bars[k + 1].open, k + 1, s.leg === 'brk' ? 'channel' : 'mid', bars[k + 1].time);
    }
  }
  return null;
}

// ── costs in R ──
export function costs(tr, mult = 1, p = P) {
  const price = (p.SPREAD + 2 * p.SLIP * p.SPREAD) * mult;
  const nn = nights(tr.t, tr.c), fin = tr.side > 0 ? mult * nn * FIN.xau.long * tr.fill / tr.r0 : 0;
  return { spread: price / tr.r0, fin, nights: nn };
}
export const withNet = (tr) => { const c1 = costs(tr, 1), c2 = costs(tr, 2); return { ...tr, net: tr.R - c1.spread - c1.fin, net2: tr.R - c2.spread - c2.fin, fin: c1.fin, nights: c1.nights }; };

// ── a stream: one position at a time ──
export function stream(bars, ind, legs, regime = ind.regime, any = false) {
  const out = []; let busy = -1, skipped = 0;
  for (let i = 0; i < bars.length - 1; i++) {
    let s = null;
    for (const leg of legs) { const side = legSignal(bars, ind, i, leg, regime, any); if (side) { s = { i, side, leg }; break; } }
    if (!s) continue;
    if (i < busy) { skipped++; continue; }
    const tr = trade(bars, ind, s);
    if (!tr) continue;
    out.push(withNet(tr)); busy = tr.exitIdx;
  }
  return { trades: out, skipped };
}

// ── statistics ──
export function erfc(x) { const z = Math.abs(x), t = 1 / (1 + 0.5 * z); const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? r : 2 - r; }
export const pOne = (t) => (Number.isFinite(t) ? 0.5 * erfc(t / Math.SQRT2) : 1);
const ym = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
// calendar-month sums of the window [from, to]; a trade counts in its exit month, a trade entered in the window and closed
// just after it counts in the window's last month
export function monthT(rows, from, to, key = 'net') {
  const a = ym(from), b = ym(to), s = new Array(b - a + 1).fill(0);
  for (const r of rows) s[Math.min(s.length - 1, Math.max(0, ym(r.c) - a))] += r[key];
  const n = s.length, mu = s.reduce((x, y) => x + y, 0) / n, sd = Math.sqrt(s.reduce((x, y) => x + (y - mu) ** 2, 0) / (n - 1));
  return { months: n, t: sd > 0 ? mu / sd * Math.sqrt(n) : null };
}
export function maxDD(rows) { let eq = 0, hi = 0, dd = 0; for (const r of rows) { eq += r.net; hi = Math.max(hi, eq); dd = Math.min(dd, eq - hi); } return dd; }
export function summary(rows, from, to) {
  const n = rows.length, mean = (k) => (n ? rows.reduce((a, r) => a + r[k], 0) / n : null);
  const m = n ? monthT(rows, from, to) : { months: 0, t: null }, g = n ? monthT(rows, from, to, 'R') : { t: null };
  const why = {}; for (const r of rows) why[r.why] = (why[r.why] || 0) + 1;
  return { n, buys: rows.filter((r) => r.side > 0).length, gross: r3(mean('R')), net: r3(mean('net')), net2: r3(mean('net2')), fin: r3(mean('fin')),
    totalNet: r2(rows.reduce((a, r) => a + r.net, 0)), win: n ? r3(rows.filter((r) => r.net > 0).length / n) : null, maxDD: r2(maxDD(rows)),
    months: m.months, t: r2(m.t), tGross: r2(g.t), p: +pOne(m.t).toFixed(4), heldMedian: n ? [...rows].map((r) => r.held).sort((a, b) => a - b)[n >> 1] : null, why };
}
export function holm(ps, alpha = 0.05) {
  const idx = ps.map((p, i) => [p, i]).sort((x, y) => x[0] - y[0]), adj = new Array(ps.length).fill(1); let run = 0;
  idx.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (ps.length - k) * p)); adj[i] = run; });
  return adj.map((a) => ({ adj: +a.toFixed(4), ok: a <= alpha }));
}
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// the label series cut into blocks of BLOCK bars, blocks shuffled (Fisher-Yates, seeded); same length, same label counts
export function shuffleBlocks(labels, seed, block = P.BLOCK) {
  const blocks = []; for (let i = 0; i < labels.length; i += block) blocks.push(labels.slice(i, i + block));
  const r = rng(seed);
  for (let i = blocks.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [blocks[i], blocks[j]] = [blocks[j], blocks[i]]; }
  return blocks.flat();
}

export function placebo(bars, ind, legs, from, seeds = P.SEEDS) {
  const means = [];
  for (let s = 1; s <= seeds; s++) {
    const rows = stream(bars, ind, legs, shuffleBlocks(ind.regime, s)).trades.filter((r) => r.t >= from);
    means.push(rows.length ? rows.reduce((a, y) => a + y.net, 0) / rows.length : 0);
  }
  means.sort((a, b) => a - b);
  const q = (f) => means[Math.min(means.length - 1, Math.floor(f * means.length))];
  return { seeds, median: r3(q(0.5)), p95: r3(q(0.95)), min: r3(means[0]), max: r3(means.at(-1)) };
}

export function load(dir) { return toBars(JSON.parse(fs.readFileSync(path.join(dir, 'xau-4h.json'), 'utf8'))); }

function split(trades, isF, isT, oF, now) {
  const isR = trades.filter((r) => r.t >= isF && r.t < isT), oR = trades.filter((r) => r.t >= oF);
  return { isR, oR, is: summary(isR, isF, isT - 1), oos: summary(oR, oF, now) };
}

export function run(bars) {
  const now = bars.at(-1).time, ind = indicators(bars), res = {}, ps = [];
  const isF = T(P.IS[0]), isT = T(P.IS[1]), oF = T(P.OOS[0]);
  for (const [k, test] of Object.entries(TESTS)) {
    const { trades, skipped } = stream(bars, ind, test.legs);
    const { oR, is, oos } = split(trades, isF, isT, oF, now);
    const years = {}; for (const r of trades) { const y = new Date(r.t * 1000).getUTCFullYear(); (years[y] ||= { n: 0, net: 0 }); years[y].n++; years[y].net += r.net; }
    for (const y in years) years[y].net = r2(years[y].net);
    res[k] = { ...test, skipped, is, oos, placebo: placebo(bars, ind, test.legs, oF), years,
      byLeg: Object.fromEntries(test.legs.map((l) => [l, summary(oR.filter((r) => r.leg === l), oF, now)])),
      bySide: { buy: summary(oR.filter((r) => r.side > 0), oF, now), sell: summary(oR.filter((r) => r.side < 0), oF, now) } };
    ps.push(oos.p);
  }
  const h = holm(ps);
  Object.keys(TESTS).forEach((k, j) => {
    const r = res[k];
    r.holm = h[j];
    r.checks = { tHolm: (r.oos.t ?? 0) >= 2 && h[j].ok, isSign: r.is.net > 0, x2: r.oos.net2 > 0, placebo: r.oos.net > r.placebo.p95 };
    r.pass = Object.values(r.checks).every(Boolean);
  });
  // descriptive only: each leg on every bar whatever the regime
  const descriptive = {};
  for (const leg of ['brk', 'fade']) { const { is, oos } = split(stream(bars, ind, [leg], ind.regime, true).trades, isF, isT, oF, now); descriptive[leg + 'AnyRegime'] = { is, oos }; }
  const share = (from, to) => { const c = { T: 0, R: 0, N: 0 }; let n = 0; bars.forEach((b, i) => { if (b.time >= from && b.time < to && ind.regime[i]) { c[ind.regime[i]]++; n++; } }); return { trend: r3(c.T / n), range: r3(c.R / n), neutral: r3(c.N / n), bars: n }; };
  descriptive.regimeShare = { is: share(isF, isT), oos: share(oF, now + 1) };
  const verdict = res.T1.pass ? 'PASS' : 'FAIL';
  return { study: 'gold-regime-switch', title: 'Gold H4 regime switch: 20-bar breakout when trending, Bollinger fade when ranging (efficiency ratio)',
    built: new Date(now * 1000).toISOString().slice(0, 10), verdict,
    data: { h4: { n: bars.length, from: bars[0].time, to: now } }, params: P,
    costs: { spread: P.SPREAD, slippageEachWay: P.SLIP * P.SPREAD, financingLong: FIN.xau.long, financingSrc: FIN.xau.src },
    tests: res, descriptive };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2]; if (!dir) { console.error('usage: run.mjs <dir>'); process.exit(1); }
  const out = run(load(dir));
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  for (const [k, r] of Object.entries(out.tests)) console.log(k, JSON.stringify({ is: r.is, oos: r.oos, placebo: r.placebo, holm: r.holm, checks: r.checks, byLeg: r.byLeg }));
  console.log('descriptive', JSON.stringify(out.descriptive));
  console.log('verdict', out.verdict);
}
