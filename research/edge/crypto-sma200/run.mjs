// Bitcoin / Ether long only above the 200-day average (research/edge/crypto-sma200). Paper research only.
// The rule, stop, costs, windows and pass bar are fixed in PREREGISTRATION.md (committed before this file).
// Usage (repo root, after `git fetch origin council-data`): node research/edge/crypto-sma200/run.mjs
// Reads the Binance daily caches from origin/council-data with `git show` (or $CS_DATA/<SYM>_1d.json.gz), writes result.json.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { CFD_CRYPTO } from '../../../council/fills.mjs';
import { nyOffsetH } from '../../../council/histdata.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const H = 3600, DAY = 86400;

export const P = {
  coins: { btc: 'BTCUSDT', eth: 'ETHUSDT' },
  lengths: [200, 100],
  atrN: 20, atrK: 3, cost: CFD_CRYPTO,
  // demo broker's crypto long swap, % a year as a fraction (council-data ctrader/symbols.json of 13 Nov 2026, type 1; Friday x3)
  fin: { btc: 0.15, eth: 0.15 },
  windows: { discovery: ['2018-03-05', '2021-12-31'], decisive: ['2022-01-01', '2099-01-01'] },
  draws: 2000, seed: 20261113, pMin: 0.9, holmMax: 0.10, ddFrac: 2 / 3,
};
export const ts = (s) => Math.floor(Date.parse(s + 'T00:00:00Z') / 1000);
export const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export const inWin = (t, [a, b]) => t >= ts(a) && t < ts(b) + DAY;

export function load1d(sym) {
  const file = `${sym}_1d.json.gz`;
  const buf = process.env.CS_DATA ? fs.readFileSync(path.join(process.env.CS_DATA, file))
    : execFileSync('git', ['show', `origin/council-data:research/candles/crypto1d/${file}`], { maxBuffer: 1 << 26 });
  return JSON.parse(zlib.gunzipSync(buf));
}

// nights charged for holding a position through UTC day starting at t: the day's 17:00 New York instant; a Friday's counts fri
export function nightsOf(t, fri = 3) {
  const d0 = t - (t % DAY);
  for (let x = d0; x < d0 + DAY; x += H) {
    if (new Date(x * 1000).getUTCHours() === (17 + nyOffsetH(x)) % 24) {
      return new Date(x * 1000).getUTCDay() === 5 ? fri : 1;
    }
  }
  return 1;
}

// SMA_N of closes ending at index i (null before N closes); uses rows[i-N+1..i] only
export function sma(rows, i, N) {
  if (i < N - 1) return null;
  let s = 0;
  for (let k = i - N + 1; k <= i; k++) s += rows[k][4];
  return s / N;
}
// ATR_n ending at index i (true range uses the previous close)
export function atr(rows, i, n = P.atrN) {
  if (i < n) return null;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) {
    const [, , h, l] = rows[k], pc = rows[k - 1][4];
    s += Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
  }
  return s / n;
}

// the rule, day by day. Returns one record per day from index N (the first day a signal of day N-1 exists):
// { t, r (net), gross, cost, fin, fin1, long (held at some point that day), ev }
export function simulate(rows, N, rate) {
  const out = [];
  let pos = null; // { entry, stop }
  let armed = true;
  for (let d = N; d < rows.length; d++) {
    const [t, o, h, l, c] = rows[d], pc = rows[d - 1][4];
    const s = sma(rows, d - 1, N), sig = rows[d - 1][4] > s;
    if (!armed && !sig) armed = true; // re-armed by a close at or below the average (signal of day d-1)
    let gross = 0, cost = 0, fin = 0, fin1 = 0, ev = null, held = false;
    if (pos && !sig) { // sell at the open
      gross = o / pc - 1; cost += P.cost; pos = null; ev = 'exit'; held = true;
    } else if (!pos && sig && armed && atr(rows, d - 1) > 0) { // buy at the open (never without a stop)
      const a = atr(rows, d - 1);
      pos = { entry: o, stop: o - P.atrK * a };
      cost += P.cost; ev = 'entry'; held = true;
      if (l <= pos.stop) { gross = pos.stop / o - 1; cost += P.cost; pos = null; armed = false; ev = 'entry+stop'; }
      else { gross = c / o - 1; fin = nightsOf(t) * rate / 365; fin1 = nightsOf(t, 1) * rate / 365; }
    } else if (pos) { // held day
      held = true;
      if (o <= pos.stop) { gross = o / pc - 1; cost += P.cost; pos = null; armed = false; ev = 'stop-gap'; }
      else if (l <= pos.stop) { gross = pos.stop / pc - 1; cost += P.cost; pos = null; armed = false; ev = 'stop'; }
      else { gross = c / pc - 1; fin = nightsOf(t) * rate / 365; fin1 = nightsOf(t, 1) * rate / 365; }
    }
    out.push({ t, gross, cost, fin, r: gross - cost - fin, r1: gross - cost - fin1, held, ev });
  }
  return out;
}

// buy and hold over a window: first open to last close, swap every day, one cost at each end
export function buyHold(rows, win, rate) {
  const idx = rows.map((x, i) => i).filter((i) => inWin(rows[i][0], win));
  const out = [];
  idx.forEach((i, k) => {
    const [t, o, , , c] = rows[i];
    const gross = k === 0 ? c / o - 1 : c / rows[i - 1][4] - 1;
    let cost = 0;
    if (k === 0) cost += P.cost;
    if (k === idx.length - 1) cost += P.cost;
    const fin = nightsOf(t) * rate / 365, fin1 = nightsOf(t, 1) * rate / 365;
    out.push({ t, gross, cost, fin, r: gross - cost - fin, r1: gross - cost - fin1, held: true });
  });
  return out;
}

// ── statistics ──
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const sd = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)) : 0; };
export const sharpe = (a) => (sd(a) > 0 ? mean(a) / sd(a) * Math.sqrt(365) : 0);
export function maxDD(a) {
  let eq = 1, hi = 1, dd = 0;
  for (const r of a) { eq *= 1 + r; if (eq > hi) hi = eq; dd = Math.max(dd, 1 - eq / hi); }
  return dd;
}
export const cagr = (a) => (a.length ? a.reduce((e, r) => e * (1 + r), 1) ** (365 / a.length) - 1 : 0);
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function holm(ps) {
  const o = ps.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p), adj = new Array(ps.length); let run = 0;
  o.forEach((x, k) => { run = Math.max(run, Math.min(1, x.p * (ps.length - k))); adj[x.i] = run; });
  return adj;
}
// paired monthly block bootstrap: a and b are aligned daily records (same t); share of draws where Sharpe(a) > Sharpe(b)
export function bootstrap(a, b, draws = P.draws, seed = P.seed) {
  const months = new Map();
  a.forEach((x, i) => { if (x.t !== b[i].t) throw new Error('unaligned'); const k = day(x.t).slice(0, 7); (months.get(k) || months.set(k, []).get(k)).push(i); });
  const blocks = [...months.values()], R = rng(seed);
  let win = 0;
  for (let k = 0; k < draws; k++) {
    const ra = [], rb = [];
    for (let m = 0; m < blocks.length; m++) for (const i of blocks[Math.floor(R() * blocks.length)]) { ra.push(a[i].r); rb.push(b[i].r); }
    if (sharpe(ra) > sharpe(rb)) win++;
  }
  return win / draws;
}

const r4 = (x) => +x.toFixed(4);
export function summary(recs, key = 'r') {
  const r = recs.map((x) => x[key]);
  return {
    days: recs.length, sharpe: r4(sharpe(r)), cagr: r4(cagr(r)), maxDD: r4(maxDD(r)),
    inMarket: r4(recs.filter((x) => x.held).length / (recs.length || 1)),
    entries: recs.filter((x) => x.ev && x.ev.startsWith('entry')).length,
    stops: recs.filter((x) => x.ev && /stop/.test(x.ev)).length,
    costSum: r4(recs.reduce((s, x) => s + x.cost, 0)), finSum: r4(recs.reduce((s, x) => s + x.fin, 0)),
    sharpe_fri1: r4(sharpe(recs.map((x) => x.r1))),
  };
}
export function byYear(recs) {
  const y = {};
  for (const x of recs) (y[day(x.t).slice(0, 4)] ||= []).push(x.r);
  return Object.fromEntries(Object.entries(y).map(([k, v]) => [k, r4(v.reduce((e, r) => e * (1 + r), 1) - 1)]));
}

export function runAll(data) {
  const tests = [];
  for (const [coin] of Object.entries(P.coins)) {
    const rows = data[coin], rate = P.fin[coin];
    for (const N of P.lengths) {
      const all = simulate(rows, N, rate);
      const w = {};
      for (const [k, win] of Object.entries(P.windows)) {
        const rule = all.filter((x) => inWin(x.t, win)), bh = buyHold(rows, win, rate);
        w[k] = { rule: summary(rule), bh: summary(bh), ruleYears: byYear(rule), bhYears: byYear(bh), _r: rule, _b: bh };
      }
      const P_ = bootstrap(w.decisive._r, w.decisive._b);
      tests.push({ id: `${coin}-sma${N}`, coin, N, P: r4(P_), p: Math.max(1 - P_, 1 / P.draws), w });
    }
  }
  const adj = holm(tests.map((x) => x.p));
  tests.forEach((x, i) => {
    const d = x.w.decisive, ds = x.w.discovery;
    x.holmP = r4(adj[i]);
    x.checks = {
      sharpeAbove: d.rule.sharpe > d.bh.sharpe,
      bootstrap: x.P >= P.pMin && x.holmP <= P.holmMax,
      drawdown: d.rule.maxDD <= P.ddFrac * d.bh.maxDD,
      discovery: ds.rule.sharpe > ds.bh.sharpe,
    };
    x.pass = Object.values(x.checks).every(Boolean);
    for (const k of Object.keys(x.w)) { delete x.w[k]._r; delete x.w[k]._b; }
  });
  return tests;
}

function main() {
  const data = Object.fromEntries(Object.entries(P.coins).map(([k, s]) => [k, load1d(s)]));
  const tests = runAll(data);
  const R = {
    built: '2026-11-13', verdict: tests.some((x) => x.pass) ? 'PASS' : 'FAIL',
    system: 'BTC / ETH long only above the 200-day (and 100-day) average, 3 x ATR20 stop, CFD costs and financing',
    prereg: 'PREREGISTRATION.md',
    source: 'council-data research/candles/crypto1d (Binance spot daily); exchange APIs refused by the sandbox proxy',
    data: Object.fromEntries(Object.entries(data).map(([k, r]) => [k, { days: r.length, from: day(r[0][0]), to: day(r.at(-1)[0]) }])),
    params: { ...P, cost: P.cost },
    passed: tests.filter((x) => x.pass).map((x) => x.id),
    tests,
  };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  console.log(JSON.stringify({ verdict: R.verdict, tests: tests.map((x) => ({ id: x.id, P: x.P, holmP: x.holmP, pass: x.pass, checks: x.checks, dec: { rule: x.w.decisive.rule, bh: x.w.decisive.bh }, disc: { rule: x.w.discovery.rule.sharpe, bh: x.w.discovery.bh.sharpe } })) }, null, 1));
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
