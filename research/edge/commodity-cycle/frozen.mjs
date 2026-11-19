// Edge research · crypto-cycle: the owner's market cycle ("bullish on H4 and the pullback finished: buys only, and vice versa") as
// an ENTRY on BTC, ETH and SOL. Every definition is PREREGISTRATION.md's (copied from research/edge/index-cycle, branch
// index-cycle, commit ab8a1b05a); the code is copied from research/edge/fx-cycle/run.mjs (branch fx-cycle, commit cfd928e8d),
// nothing imported from a sibling branch. Only markets, data, windows, the (absent) skip window and costs are crypto's.
// Paper research only.
//   node research/edge/crypto-cycle/fetch.mjs <dir>   (5-minute candles out of council-data, kept out of git)
//   node research/edge/crypto-cycle/run.mjs <dir>     (writes result.json and RESULT.md beside this file)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { CFD_CRYPTO } from '../../../council/fills.mjs';

export const MARKETS = ['btc', 'eth', 'sol'];
export const K = {
  W4: 3, W1: 1, ATR_N: 14, BUF: 0.1, MIN_R: 1, FIXED_R: 2, HOLD: 48, MAX_WAIT: 72 * 3600,
  H1: 3600, H4: 14400, DAY: 86400, ROLL: 22 * 3600,
  COST_RT: CFD_CRYPTO, FIN_LONG: 0.15, FIN_SHORT: { btc: 0.075, eth: 0.10, sol: 0.10 },
  SEEDS: 40,
};
export const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
export const WINDOWS = {
  decisive: { from: T('2022-01-01'), to: Infinity },
  half1: { from: T('2022-01-01'), to: T('2024-01-01') },
  half2: { from: T('2024-01-01'), to: Infinity },
};

// 1. swings (as research/edge/mosha-level/run.mjs swings): a high not below the w before it and strictly above the w after it
export function swings(B, w) {
  const n = B.length, hi = new Int8Array(n), lo = new Int8Array(n);
  for (let j = w; j < n - w; j++) {
    let h = 1, l = 1;
    for (let k = 1; k <= w && (h || l); k++) {
      if (B[j - k].high > B[j].high || B[j + k].high >= B[j].high) h = 0;
      if (B[j - k].low < B[j].low || B[j + k].low <= B[j].low) l = 0;
    }
    hi[j] = h; lo[j] = l;
  }
  return { hi, lo };
}
// 2. BO (as research/edge/mosha-retrace/run.mjs boEvents): a close beyond the most recent swing that existed when the candle
// opened (a swing at j exists from the close of j + w); each level broken once; time = the candle's close
export function boEvents(B, w, sec) {
  const { hi, lo } = swings(B, w), ev = [];
  let a = -1, v = -1, aDone = false, vDone = false;
  for (let i = 0; i < B.length; i++) {
    const j = i - w - 1;
    if (j >= 0) { if (hi[j]) { a = j; aDone = false; } if (lo[j]) { v = j; vDone = false; } }
    if (a >= 0 && !aDone && B[i].close > B[a].high) { ev.push({ t: B[i].time + sec, dir: 1, level: B[a].high, i }); aDone = true; }
    if (v >= 0 && !vDone && B[i].close < B[v].low) { ev.push({ t: B[i].time + sec, dir: -1, level: B[v].low, i }); vDone = true; }
  }
  return ev;
}
// candles of a coarser timeframe in UTC buckets floor(t / sec): open of the first, close of the last, high / low over all
export function bucket(rows, sec) {
  const out = [];
  for (const b of rows) {
    const k = Math.floor(b.time / sec) * sec, c = out.at(-1);
    if (!c || c.time !== k) out.push({ time: k, open: b.open, high: b.high, low: b.low, close: b.close });
    else { if (b.high > c.high) c.high = b.high; if (b.low < c.low) c.low = b.low; c.close = b.close; }
  }
  return out;
}
export const toH1 = (M5) => bucket(M5, K.H1);
export const toH4 = (H1) => bucket(H1, K.H4);
// ATR(14) H1 = mean true range of the 14 candles ending with candle i
export function atrAt(B, i, n = K.ATR_N) {
  if (i - n + 1 < 1) return null;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) s += Math.max(B[k].high - B[k].low, Math.abs(B[k].high - B[k - 1].close), Math.abs(B[k].low - B[k - 1].close));
  return s / n;
}

// steps 3-5: one signal at most per H4 BO
export function cycles(H1, H4) {
  const E4 = boEvents(H4, K.W4, K.H4), E1 = boEvents(H1, K.W1, K.H1), out = [];
  let p = 0;
  for (let n = 0; n < E4.length; n++) {
    const e = E4[n], next = n + 1 < E4.length ? E4[n + 1].t : Infinity;
    while (p < E1.length && E1[p].t <= e.t) p++;
    let q = p, ch = null;
    for (; q < E1.length && E1[q].t < next; q++) if (E1[q].dir === -e.dir) { ch = E1[q]; break; }
    if (!ch) continue;
    let fin = null;
    for (q = q + 1; q < E1.length; q++) if (E1[q].dir === e.dir) { fin = E1[q]; break; }
    if (!fin || next <= fin.t) continue;          // a newer H4 BO at or before "pullback finished": the cycle is the newer one's
    out.push({ dir: e.dir, h4t: e.t, h4start: H4[e.i].time, ch: ch.i, fin: fin.i, sigT: fin.t });
  }
  return out;
}
// steps 6-9: the planned trade for one exit stream ('A' extreme, 'B' 2R), or { skip: reason }. Crypto: no skip window (24/7).
export function plan(H1, s, exit) {
  const k = s.fin + 1, d = s.dir;
  if (k >= H1.length) return { skip: 'no-data' };
  const t = H1[k].time;
  if (t - s.sigT > K.MAX_WAIT) return { skip: 'late' };
  let ext = d > 0 ? -Infinity : Infinity, pb = d > 0 ? Infinity : -Infinity;
  for (let i = s.ch; i <= s.fin; i++) pb = d > 0 ? Math.min(pb, H1[i].low) : Math.max(pb, H1[i].high);
  let i0 = s.ch; while (i0 > 0 && H1[i0 - 1].time >= s.h4start) i0--;
  for (let i = i0; i <= s.ch; i++) ext = d > 0 ? Math.max(ext, H1[i].high) : Math.min(ext, H1[i].low);
  const atr = atrAt(H1, s.fin);
  if (atr == null) return { skip: 'no-atr' };
  const entry = H1[k].open, stop = pb - d * K.BUF * atr, r0 = d * (entry - stop);
  if (!(r0 > 0)) return { skip: 'gap' };
  let target, rm;
  if (exit === 'A') { rm = d * (ext - entry) / r0; if (!(rm >= K.MIN_R)) return { skip: 'room' }; target = ext; }
  else { rm = K.FIXED_R; target = entry + d * K.FIXED_R * r0; }
  return { k, t, dir: d, entry, stop, r0, target, rm, ext, sigT: s.sigT };
}
// step 10: fills on H1 from the entry candle, stop first, gaps at the open, out at the close of the 48th candle
export function simulate(H1, p) {
  const d = p.dir;
  for (let j = 0; j < K.HOLD; j++) {
    const c = H1[p.k + j];
    if (!c) return null;                                       // data ends: unresolved
    const end = c.time + K.H1;
    if (d * (c.open - p.stop) <= 0) return { px: c.open, why: 'gap', t: c.time, n: j + 1 };
    if (d * (c.open - p.target) >= 0) return { px: p.target, why: 'target', t: c.time, n: j + 1 };
    if (d > 0 ? c.low <= p.stop : c.high >= p.stop) return { px: p.stop, why: 'stop', t: end, n: j + 1 };
    if (d > 0 ? c.high >= p.target : c.low <= p.target) return { px: p.target, why: 'target', t: end, n: j + 1 };
    if (j === K.HOLD - 1) return { px: c.close, why: 'time', t: end, n: j + 1 };
  }
  return null;
}
// financing nights: every calendar 22:00 UTC with entry < it <= exit, weekends included, no Wednesday triple
export function cryptoNights(t, c) {
  let n = 0;
  for (let d = Math.floor(t / K.DAY) * K.DAY + K.ROLL; d <= c; d += K.DAY) if (d > t) n++;
  return n;
}
export const finRate = (m, dir) => (dir > 0 ? K.FIN_LONG : K.FIN_SHORT[m]);
// costs in R: CFD_CRYPTO of the entry price a round trip, financing rate / 365 x entry a night
export function costR(m, p, x, mult = 1) {
  const fin = finRate(m, p.dir) / 365 * cryptoNights(p.t, x.t) * p.entry;
  return mult * (K.COST_RT * p.entry + fin) / p.r0;
}
export function trade(m, H1, p) {
  const x = simulate(H1, p);
  if (!x) return { m, ...p, open: true };
  const gross = p.dir * (x.px - p.entry) / p.r0, c = costR(m, p, x), c2 = costR(m, p, x, 2);
  return { m, t: p.t, exitT: x.t, dir: p.dir, entry: p.entry, stop: p.stop, target: p.target, r0: p.r0, rm: p.rm, why: x.why, n: x.n,
    nights: cryptoNights(p.t, x.t), gross, net: gross - c, net2: gross - c2, cost: c };
}
// step 11 + the whole market for one exit stream
export function runMarket(m, H1, exit) {
  const H4 = toH4(H1), sig = cycles(H1, H4), trades = [], skips = {};
  let busy = -Infinity;
  for (const s of sig) {
    const p = plan(H1, s, exit);
    if (p.skip) { skips[p.skip] = (skips[p.skip] || 0) + 1; continue; }
    if (p.t < busy) { skips.busy = (skips.busy || 0) + 1; continue; }
    const tr = trade(m, H1, p);
    trades.push(tr);
    busy = tr.open ? Infinity : tr.exitT;
  }
  return { signals: sig.length, trades, skips };
}

// statistics
export const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
export function tOf(a) {
  if (a.length < 2) return NaN;
  const mu = mean(a), sd = Math.sqrt(a.reduce((s, v) => s + (v - mu) ** 2, 0) / (a.length - 1));
  return sd > 0 ? mu / (sd / Math.sqrt(a.length)) : NaN;
}
const ym = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
export function monthly(trades, from, to, key = 'net') {
  const a = ym(from), b = ym(to), s = new Array(b - a + 1).fill(0);
  for (const x of trades) { const k = ym(x.exitT) - a; if (k >= 0 && k < s.length) s[k] += x[key]; }
  return s;
}
function erf(x) { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); }
export const pTwo = (t) => (Number.isFinite(t) ? 2 * (1 - 0.5 * (1 + erf(Math.abs(t) / Math.SQRT2))) : 1);
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length);
  let run = 0;
  o.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (ps.length - r) * p)); out[i] = run; });
  return out;
}
export function pct(a, q) { const s = [...a].sort((x, y) => x - y), pos = q * (s.length - 1), lo = Math.floor(pos); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (pos - lo); }
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const r4 = (v) => (Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : null);
const r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
export function summary(trades, from, to) {
  const net = trades.map((x) => x.net), mo = monthly(trades, from, to), mt = tOf(mo);
  return { n: trades.length, wins: trades.filter((x) => x.net > 0).length, netR: r2(net.reduce((s, v) => s + v, 0)), meanNet: r4(mean(net)), tTrade: r2(tOf(net)),
    meanGross: r4(mean(trades.map((x) => x.gross))), meanNet2: r4(mean(trades.map((x) => x.net2))), months: mo.length, tMonth: r2(mt), p: r4(pTwo(mt)) };
}
// bias at the open of each H1 candle: the latest H4 BO with time at or before it
export function biasAtOpen(H1, H4) {
  const E4 = boEvents(H4, K.W4, K.H4), out = new Int8Array(H1.length);
  let p = 0, d = 0;
  for (let i = 0; i < H1.length; i++) { while (p < E4.length && E4[p].t <= H1[i].time) d = E4[p++].dir; out[i] = d; }
  return out;
}
export function placebo(data, real, exit, seeds = K.SEEDS) {
  const pools = {};
  for (const m of Object.keys(data)) {
    const H1 = data[m], bias = biasAtOpen(H1, toH4(H1)), P = { 1: [], '-1': [] };
    for (let i = 1; i + K.HOLD - 1 < H1.length; i++) if (H1[i].time >= WINDOWS.decisive.from && bias[i]) P[bias[i]].push(i);
    pools[m] = P;
  }
  const out = [];
  for (let s = 1; s <= seeds; s++) {
    const R = rng(s), nets = [];
    for (const x of real) {
      const pool = pools[x.m][x.dir], k = pool[Math.floor(R() * pool.length)], H1 = data[x.m], entry = H1[k].open;
      const p = { k, t: H1[k].time, dir: x.dir, entry, r0: x.r0, stop: entry - x.dir * x.r0, rm: exit === 'A' ? x.rm : K.FIXED_R };
      p.target = entry + x.dir * p.rm * x.r0;
      const tr = trade(x.m, H1, p);
      if (!tr.open) nets.push(tr.net);
    }
    out.push(mean(nets));
  }
  const real0 = mean(real.map((x) => x.net));
  return { seeds: out.map(r4), p5: r4(pct(out, 0.05)), median: r4(pct(out, 0.5)), p95: r4(pct(out, 0.95)), best: r4(Math.max(...out)), better: out.filter((v) => v > real0).length };
}

// the 5-minute rows [t, o, h, l, c] -> H1 candles
export function fromRows(rows) { return toH1(rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }))); }
export function load(dir, m) { return fromRows(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${m}-5m.json.gz`))))); }
const inWin = (w) => (x) => !x.open && x.exitT >= w.from && x.exitT < w.to;

export function study(data) {
  const last = Math.max(...Object.values(data).map((B) => B.at(-1).time + K.H1));
  const W = { decisive: { ...WINDOWS.decisive, to: last }, half1: WINDOWS.half1, half2: { ...WINDOWS.half2, to: last } };
  const res = { exits: {} }, mPs = [], mKeys = [];
  for (const exit of ['A', 'B']) {
    const all = [], info = {};
    for (const m of Object.keys(data)) { const r = runMarket(m, data[m], exit); all.push(...r.trades); info[m] = { signals: r.signals, skips: r.skips, open: r.trades.filter((x) => x.open).length }; }
    const D = all.filter(inWin(W.decisive)), H1s = all.filter(inWin(W.half1)), H2s = all.filter(inWin(W.half2));
    const byM = {}, byWhy = {}, byYear = {}, sum = (a, w) => summary(a, w.from, w.to - 1);
    for (const m of Object.keys(data)) {
      const f = (x) => x.m === m;
      byM[m] = { decisive: sum(D.filter(f), W.decisive), half1: sum(H1s.filter(f), W.half1), half2: sum(H2s.filter(f), W.half2), ...info[m],
        meanR0Pct: r4(mean(D.filter(f).map((x) => 100 * x.r0 / x.entry))) };
      mPs.push(byM[m].decisive.p); mKeys.push([exit, m]);
    }
    for (const w of ['target', 'stop', 'gap', 'time']) { const a = D.filter((x) => x.why === w); byWhy[w] = { n: a.length, meanNet: r4(mean(a.map((x) => x.net))), meanGross: r4(mean(a.map((x) => x.gross))) }; }
    for (const x of D) { const y = new Date(x.exitT * 1000).getUTCFullYear(); (byYear[y] ||= []).push(x.net); }
    for (const s of [1, -1]) { const a = D.filter((x) => x.dir === s); byWhy[s > 0 ? 'buys' : 'sells'] = { n: a.length, meanNet: r4(mean(a.map((x) => x.net))), meanGross: r4(mean(a.map((x) => x.gross))) }; }
    res.exits[exit] = {
      decisive: sum(D, W.decisive), half1: sum(H1s, W.half1), half2: sum(H2s, W.half2),
      byMarket: byM, byExit: byWhy,
      byYear: Object.fromEntries(Object.entries(byYear).map(([y, a]) => [y, { n: a.length, meanNet: r4(mean(a)), netR: r2(a.reduce((s, v) => s + v, 0)) }])),
      meanCostR: r4(mean(D.map((x) => x.cost))), winRate: r4(D.filter((x) => x.gross > 0).length / D.length),
      placebo: placebo(data, D, exit),
    };
  }
  const mAdj = holm(mPs);
  mKeys.forEach(([e, m], i) => { res.exits[e].byMarket[m].holmP6 = r4(mAdj[i]); });
  const ps = ['A', 'B'].map((e) => res.exits[e].decisive.p), adj = holm(ps);
  ['A', 'B'].forEach((e, i) => {
    const x = res.exits[e]; x.holmP = r4(adj[i]);
    x.lines = { meanPositive: x.decisive.meanNet > 0, tMonth2: x.decisive.tMonth >= 2, holm05: adj[i] < 0.05, halvesPositive: x.half1.meanNet > 0 && x.half2.meanNet > 0, abovePlacebo: x.decisive.meanNet > x.placebo.p95 };
    x.pass = Object.values(x.lines).every(Boolean);
  });
  res.verdict = res.exits.A.pass || res.exits.B.pass ? 'PASS' : 'FAIL';
  res.data = Object.fromEntries(Object.entries(data).map(([m, B]) => [m, { candles: B.length, from: new Date(B[0].time * 1000).toISOString().slice(0, 16), to: new Date(B.at(-1).time * 1000).toISOString().slice(0, 16) }]));
  res.windows = { decisive: { from: '2022-01-01', to: new Date(last * 1000).toISOString().slice(0, 16) }, half1: { from: '2022-01-01', to: '2023-12-31' }, half2: { from: '2024-01-01', to: new Date(last * 1000).toISOString().slice(0, 16) },
    replication: 'not run: no intraday crypto before 2022 reachable (see PREREGISTRATION.md)' };
  res.params = K;
  return res;
}

const f2 = (v) => (v == null ? 'n/a' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3));
const ft = (v) => (v == null ? 'n/a' : (v < 0 ? '−' : '') + Math.abs(v).toFixed(2));
const yes = (b) => (b ? 'yes' : 'no');
const fp = (v) => (v == null ? 'n/a' : v < 0.0001 ? '< 0.0001' : String(v));
const NAME = { btc: 'BTC', eth: 'ETH', sol: 'SOL' };
export function report(r) {
  const L = [];
  const A = r.exits.A, B = r.exits.B;
  L.push('# The owner\'s market cycle as an entry on crypto: result', '');
  L.push(`**Verdict: ${r.verdict}.** ${r.verdict === 'PASS' ? 'At least one exit passed every pre-registered line.' : 'Neither exit passed every pre-registered line.'}`
    + ` Exit A (target the H4 move's extreme): ${f2(A.decisive.meanNet)}R a trade net on 2022-${r.windows.decisive.to.slice(0, 4)} (n ${A.decisive.n}, monthly t ${ft(A.decisive.tMonth)}).`
    + ` Exit B (fixed 2R): ${f2(B.decisive.meanNet)}R (n ${B.decisive.n}, monthly t ${ft(B.decisive.tMonth)}).`, '');
  L.push('Pre-registration: `PREREGISTRATION.md` (copied from `research/edge/index-cycle/PREREGISTRATION.md`, branch `index-cycle`; markets, data,',
    'windows, skip window and costs changed for crypto). Paper research only: nothing live changed. Never call this rule an edge on crypto.',
    'Data: Binance spot 5-minute candles of BTC, ETH and SOL from council-data (1 Jan 2022 to 31 Oct 2026), built into H1 / H4 in UTC buckets.',
    '**No 2018-2021 replication**: no intraday crypto before 2022 can be reached from the build sandbox, so the pre-registered halves line',
    '(2022-23 and 2024-now both positive) stands in for it.', '');
  L.push('## Pass bar', '', '| Line | Exit A | Exit B |', '|---|---|---|');
  const row = (name, k) => L.push(`| ${name} | ${yes(A.lines[k])} | ${yes(B.lines[k])} |`);
  row('Decisive mean net R > 0', 'meanPositive'); row('Monthly t >= 2', 'tMonth2'); row('Holm p < 0.05 (2 exits)', 'holm05'); row('Both halves mean net R > 0', 'halvesPositive'); row('Above the placebo 95th percentile', 'abovePlacebo');
  L.push(`| **Exit passes** | **${yes(A.pass)}** | **${yes(B.pass)}** |`, '');
  if ((A.lines.holm05 && A.decisive.meanNet <= 0) || (B.lines.holm05 && B.decisive.meanNet <= 0))
    L.push('The p is two-sided, as pre-registered: where the Holm line reads "yes" with a negative mean, the result is significant in the losing direction.', '');
  L.push('## Pooled results (three coins, net of costs and financing)', '', '| Exit | Window | n | Net R | Mean net R | Mean gross R | t (trades) | Months | t (monthly) | p | Holm p |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [e, x] of [['A', A], ['B', B]]) {
    L.push(`| ${e} | 2022-now (decisive) | ${x.decisive.n} | ${f2(x.decisive.netR)} | ${f2(x.decisive.meanNet)} | ${f2(x.decisive.meanGross)} | ${ft(x.decisive.tTrade)} | ${x.decisive.months} | ${ft(x.decisive.tMonth)} | ${fp(x.decisive.p)} | ${fp(x.holmP)} |`);
    L.push(`| ${e} | 2022-2023 (half 1) | ${x.half1.n} | ${f2(x.half1.netR)} | ${f2(x.half1.meanNet)} | ${f2(x.half1.meanGross)} | ${ft(x.half1.tTrade)} | ${x.half1.months} | ${ft(x.half1.tMonth)} | ${fp(x.half1.p)} | |`);
    L.push(`| ${e} | 2024-now (half 2) | ${x.half2.n} | ${f2(x.half2.netR)} | ${f2(x.half2.meanNet)} | ${f2(x.half2.meanGross)} | ${ft(x.half2.tTrade)} | ${x.half2.months} | ${ft(x.half2.tMonth)} | ${fp(x.half2.p)} | |`);
  }
  L.push('', `Win rate before costs (decisive): Exit A ${(100 * A.winRate).toFixed(1)} %, Exit B ${(100 * B.winRate).toFixed(1)} %.`);
  L.push('', '## Placebo: random entries with the H4 bias, same market, direction, stop distance and target in R (40 seeds)', '', '| Exit | Rule, decisive mean net R | Placebo 5th pct | Placebo median | Placebo 95th pct | Placebo best | Seeds better than the rule |', '|---|---|---|---|---|---|---|');
  for (const [e, x] of [['A', A], ['B', B]]) L.push(`| ${e} | ${f2(x.decisive.meanNet)} | ${f2(x.placebo.p5)} | ${f2(x.placebo.median)} | ${f2(x.placebo.p95)} | ${f2(x.placebo.best)} | ${x.placebo.better} of ${x.placebo.seeds.length} |`);
  L.push('', `Read: the entry after "the pullback finished" did ${A.decisive.meanNet < A.placebo.median ? 'worse' : 'better'} than the median random entry with the same H4 bias for Exit A`
    + ` and ${B.decisive.meanNet < B.placebo.median ? 'worse' : 'better'} for Exit B.`);
  L.push('', '## Per coin (reported, never decisive; Holm over the 6 coin x exit tests)', '', '| Exit | Coin | Signals 2022-now | n | Mean net R | Mean gross R | t (monthly) | Holm p (6) | Half 1 n / net R | Half 2 n / net R | Mean stop (% of price) |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [e, x] of [['A', A], ['B', B]]) for (const [m, v] of Object.entries(x.byMarket))
    L.push(`| ${e} | ${NAME[m]} | ${v.signals} | ${v.decisive.n} | ${f2(v.decisive.meanNet)} | ${f2(v.decisive.meanGross)} | ${ft(v.decisive.tMonth)} | ${fp(v.holmP6)} | ${v.half1.n} / ${f2(v.half1.meanNet)} | ${v.half2.n} / ${f2(v.half2.meanNet)} | ${v.meanR0Pct} |`);
  L.push('', '## By exit reason and side, decisive window', '', '| Exit | Group | n | Mean gross R | Mean net R |', '|---|---|---|---|---|');
  for (const [e, x] of [['A', A], ['B', B]]) for (const [w, v] of Object.entries(x.byExit)) L.push(`| ${e} | ${w} | ${v.n} | ${f2(v.meanGross)} | ${f2(v.meanNet)} |`);
  L.push('', '## Costs', '', `Mean cost a trade in the decisive window: Exit A ${f2(A.meanCostR)}R, Exit B ${f2(B.meanCostR)}R (0.04 % of price a round trip,`,
    '`CFD_CRYPTO`; financing long 15 %, short 7.5 % BTC / 10 % ETH and SOL a year, every calendar 22:00 UTC held). Twice the costs, decisive',
    'mean net R: Exit A ' + f2(A.decisive.meanNet2) + 'R, Exit B ' + f2(B.decisive.meanNet2) + 'R.', '');
  L.push('## By year of exit, decisive window (Exit A | Exit B, mean net R, n)', '', '| Year | Exit A | Exit B |', '|---|---|---|');
  for (const y of Object.keys(B.byYear)) L.push(`| ${y} | ${A.byYear[y] ? f2(A.byYear[y].meanNet) + ' (' + A.byYear[y].n + ')' : 'n/a'} | ${f2(B.byYear[y].meanNet)} (${B.byYear[y].n}) |`);
  L.push('', '## Data', '', 'Binance spot 5-minute candles from council-data `research/candles/crypto5m/` (copied out with `node research/edge/crypto-cycle/fetch.mjs <dir>`,',
    'kept out of git), then `node research/edge/crypto-cycle/run.mjs <dir>`. H1 candles built:', '');
  for (const [m, v] of Object.entries(r.data)) L.push(`- ${NAME[m]}: ${v.candles} H1 candles, ${v.from} to ${v.to} UTC`);
  L.push('', '## What follows', '', r.verdict === 'PASS'
    ? 'A PASS here is unreplicated on independent years (no pre-2022 intraday data): it needs a replication on other data before any proposal (pre-registered). Never a live rule without the owner (absolute rule 3).'
    : 'A FAIL ends this reading on crypto: no parameter will be varied after seeing the result (pre-registered). Not a council rule, not a filter; nothing live changed.', '');
  return L.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2];
  if (!dir) throw new Error('usage: node run.mjs <candleDir>');
  const data = Object.fromEntries(MARKETS.map((m) => [m, load(dir, m)]));
  const res = study(data), here = path.dirname(fileURLToPath(import.meta.url));
  fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  fs.writeFileSync(path.join(here, 'RESULT.md'), report(res));
  console.log(res.verdict, JSON.stringify({ A: res.exits.A.decisive, B: res.exits.B.decisive }));
}
