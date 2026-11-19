// Edge research · index-cycle: the owner's market cycle ("if we are bullish on H4 and the pullback finished, focus only on buys,
// and vice versa") as an ENTRY on NAS100, SPX500 and US30 (OANDA mid H1, H4 built from it). Rule, costs, placebo and the pass bar:
// PREREGISTRATION.md (committed before this file produced a number). The swing and BO definitions are COPIED (not imported) from
// research/edge/mosha-level/run.mjs `swings` and research/edge/mosha-retrace/run.mjs `boEvents`; the H4 move's extreme from
// council/mosha-cycle.mjs `cycleState`. Paper research only: nothing here trades or changes a live rule.
//   node research/edge/index-cycle/fetch.mjs <dir>     (candles, kept out of git)
//   node research/edge/index-cycle/run.mjs <dir>       -> result.json
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

export const K = { W4: 3, W1: 1, ATR_N: 14, BUF: 0.1, MIN_R: 1, FIXED_R: 2, HOLD: 48, MAX_WAIT: 72 * 3600, H1: 3600, H4: 14400 };
export const MARKETS = ['nas100', 'spx500', 'us30'];
export const COST = { nas100: 3 + 1, spx500: 1 + 1, us30: 4 + 1 };   // spread round trip + 1 point of slippage, index points
export const FIN = { add: 2.5 };                                         // long: DGS2 + 2.5 %; short pays max(0, 2.5 % - DGS2)
export const WIN = { dec: { from: Date.UTC(2016, 0, 1) / 1000, to: Infinity, label: '2016-01 to 2026-11' },
  rep: { from: Date.UTC(2010, 0, 1) / 1000, to: Date.UTC(2016, 0, 1) / 1000, label: '2010-01 to 2015-12' } };
export const SEEDS = 40;

// ─── candles ───
export const toBars = (rows) => rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
export function h4Of(H1) {   // UTC 4-hour buckets; a bucket's candle closes at the bucket end
  const out = [];
  for (const b of H1) { const k = Math.floor(b.time / K.H4) * K.H4, c = out.at(-1);
    if (!c || c.time !== k) out.push({ time: k, open: b.open, high: b.high, low: b.low, close: b.close });
    else { if (b.high > c.high) c.high = b.high; if (b.low < c.low) c.low = b.low; c.close = b.close; } }
  return out;
}

// ─── swings and BOs (copied from mosha-level / mosha-retrace) ───
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
// a close beyond the most recent swing that existed when the candle opened (a swing at j exists from the close of j + w); each
// level is broken once; t = the candle's close
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

// ─── helpers ───
const NYF = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false });
export const nyHour = (t) => +NYF.format(new Date(t * 1000)) % 24;
export function atrAt(B, i, n = K.ATR_N) {   // mean true range of the n candles ending with candle i
  let s = 0, c = 0;
  for (let k = Math.max(1, i - n + 1); k <= i; k++) { const p = B[k - 1].close; s += Math.max(B[k].high - B[k].low, Math.abs(B[k].high - p), Math.abs(B[k].low - p)); c++; }
  return c ? s / c : NaN;
}
// 22:00 UTC instants N with a < N <= b
export function nights(a, b) { const first = Math.floor((a - 79200) / 86400) + 1, last = Math.floor((b - 79200) / 86400); return Math.max(0, last - first + 1); }
export function rateAt(rates, t) {   // last weekly DGS2 on or before the entry date (rates: [[YYYY-MM-DD, value]] sorted)
  const d = new Date(t * 1000).toISOString().slice(0, 10); let v = null;
  for (const [k, x] of rates) { if (k > d) break; v = x; }
  return v == null ? rates[0][1] : v;
}
export function finPoints(side, entry, n, dgs2) {
  const pct = side > 0 ? dgs2 + FIN.add : Math.max(0, FIN.add - dgs2);
  return (pct / 100 / 365) * entry * n;
}
const lowerT = (A, t) => { let a = 0, b = A.length; while (a < b) { const m = (a + b) >> 1; if (A[m] <= t) a = m + 1; else b = m; } return a - 1; };   // last index with A[i] <= t

// ─── signals: H4 BO -> first H1 BO against (ChoCh) -> first H1 BO back with the H4 (pullback finished) ───
export function signals(H1, H4) {
  const E4 = boEvents(H4, K.W4, K.H4), E1 = boEvents(H1, K.W1, K.H1), out = [];
  const f = { h4bo: E4.length, h1bo: E1.length, noChoch: 0, noFinish: 0, signals: 0 };
  let p = 0;
  for (let q = 0; q < E4.length; q++) {
    const e4 = E4[q], d = e4.dir, tNext = q + 1 < E4.length ? E4[q + 1].t : Infinity;
    while (p < E1.length && E1[p].t <= e4.t) p++;
    let k = p, ch = null, fin = null;
    for (; k < E1.length && E1[k].t < tNext; k++) if (E1[k].dir === -d) { ch = E1[k]; break; }
    if (!ch) { f.noChoch++; continue; }
    for (k++; k < E1.length && E1[k].t < tNext; k++) if (E1[k].dir === d) { fin = E1[k]; break; }
    if (!fin) { f.noFinish++; continue; }
    // the H4 move's extreme (cycleState): H1 candles from the start of the H4 BO candle to the ChoCh candle, inclusive
    let ext = null; const h4start = e4.t - K.H4;
    for (let i = ch.i; i >= 0 && H1[i].time + K.H1 > h4start; i--) { const x = d > 0 ? H1[i].high : H1[i].low; if (ext == null || (d > 0 ? x > ext : x < ext)) ext = x; }
    // the pullback's extreme: ChoCh candle through the finish candle
    let pb = null;
    for (let i = ch.i; i <= fin.i; i++) { const x = d > 0 ? H1[i].low : H1[i].high; if (pb == null || (d > 0 ? x < pb : x > pb)) pb = x; }
    out.push({ dir: d, h4t: e4.t, h4i: e4.i, chT: ch.t, chI: ch.i, finT: fin.t, finI: fin.i, ext, pb, atr: atrAt(H1, fin.i) });
    f.signals++;
  }
  return { sigs: out, funnel: f, E4 };
}

// one trade on H1 from entry candle e: stop first, gaps at the open past the stop, the target filled at the target, out at
// the close of the HOLD-th candle; null when the data ends first
export function simulate(H1, e, side, stop, target, hold = K.HOLD) {
  const entry = H1[e].open;
  for (let k = e; k < H1.length && k < e + hold; k++) {
    const b = H1[k], end = b.time + K.H1;
    if (k > e) {
      if (side > 0 ? b.open <= stop : b.open >= stop) return { exit: b.open, exitT: b.time, how: 'stop-gap' };
      if (side > 0 ? b.open >= target : b.open <= target) return { exit: target, exitT: b.time, how: 'target' };
    }
    if (side > 0 ? b.low <= stop : b.high >= stop) return { exit: stop, exitT: end, how: 'stop' };
    if (side > 0 ? b.high >= target : b.low <= target) return { exit: target, exitT: end, how: 'target' };
    if (k === e + hold - 1) return { exit: b.close, exitT: end, how: 'time' };
  }
  return null;
}

// a trade's net R: gross minus (spread + slippage + financing) in points over r0
export function costed(mk, side, entry, r0, exit, entryT, exitT, rates, mult = 1) {
  const gross = (exit - entry) * side / r0, n = nights(entryT, exitT), fp = finPoints(side, entry, n, rateAt(rates, entryT));
  return { gross, costR: COST[mk] * mult / r0, finR: fp * mult / r0, nights: n, net: gross - (COST[mk] + fp) * mult / r0 };
}

// both exit streams of one market; each one trade at a time
export function trades(mk, H1, H4, rates) {
  const { sigs, funnel } = signals(H1, H4), out = { A: [], B: [] }, f = { ...funnel, late: 0, hour17: 0, noStop: 0, noData: 0, A: { lowRoom: 0, busy: 0 }, B: { busy: 0 } };
  const busy = { A: -Infinity, B: -Infinity };
  for (const s of sigs) {
    const e = s.finI + 1;
    if (e >= H1.length) { f.noData++; continue; }
    if (H1[e].time - s.finT > K.MAX_WAIT) { f.late++; continue; }
    if (nyHour(H1[e].time) === 17) { f.hour17++; continue; }
    const side = s.dir, entry = H1[e].open, stop = s.pb - side * K.BUF * s.atr, r0 = (entry - stop) * side;
    if (!(r0 > 0)) { f.noStop++; continue; }   // a stop on the losing side or no trade
    for (const x of ['A', 'B']) {
      let target, rr;
      if (x === 'A') { rr = (s.ext - entry) * side / r0; if (!(rr >= K.MIN_R)) { f.A.lowRoom++; continue; } target = s.ext; }
      else { rr = K.FIXED_R; target = entry + side * K.FIXED_R * r0; }
      if (H1[e].time < busy[x]) { f[x].busy++; continue; }
      const sim = simulate(H1, e, side, stop, target);
      if (!sim) { f.noData++; continue; }
      const c = costed(mk, side, entry, r0, sim.exit, H1[e].time, sim.exitT, rates);
      out[x].push({ mk, side, entryT: H1[e].time, exitT: sim.exitT, entry, stop, target, r0, rr, how: sim.how, ...c, c2: costed(mk, side, entry, r0, sim.exit, H1[e].time, sim.exitT, rates, 2).net, sig: { h4t: s.h4t, chT: s.chT, finT: s.finT } });
      busy[x] = sim.exitT;
    }
  }
  return { trades: out, funnel: f };
}

// ─── statistics ───
export function stat(xs) {
  const n = xs.length; if (!n) return { n: 0, mean: 0, sd: 0, t: 0, sum: 0 };
  const sum = xs.reduce((a, b) => a + b, 0), mean = sum / n, sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  return { n, mean, sd, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : 0, sum };
}
const ym = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
export function monthly(rows, from, to, key = 'net') {   // every calendar month of [from, to) counted, empty months 0
  const a = ym(from), b = ym(to - 1), m = new Array(b - a + 1).fill(0);
  for (const r of rows) if (r.exitT >= from && r.exitT < to) m[ym(r.exitT) - a] += r[key];
  return { ...stat(m), months: m.length };
}
export const pNorm = (t) => { const x = Math.abs(t) / Math.SQRT2, u = 1 / (1 + 0.3275911 * x), y = u * (0.254829592 + u * (-0.284496736 + u * (1.421413741 + u * (-1.453152027 + u * 1.061405429)))) * Math.exp(-x * x); return y; };   // two-sided
export function holm(ps) { const o = ps.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p), adj = new Array(ps.length); let top = 0; o.forEach((r, k) => { top = Math.max(top, Math.min(1, r.p * (ps.length - k))); adj[r.i] = top; }); return adj; }
export function pct(xs, q) { const s = [...xs].sort((a, b) => a - b), r = q * (s.length - 1), lo = Math.floor(r); return lo + 1 < s.length ? s[lo] + (s[lo + 1] - s[lo]) * (r - lo) : s[lo]; }
const r3 = (x) => +x.toFixed(3), r2 = (x) => +x.toFixed(2);
export function block(rows, w, end) {
  const to = Math.min(w.to, end), x = rows.filter((r) => r.exitT >= w.from && r.exitT < to), s = stat(x.map((r) => r.net)), g = stat(x.map((r) => r.gross)), m = monthly(rows, w.from, to);
  const won = x.filter((r) => r.gross > 0).length;
  return { n: s.n, net: r3(s.mean), tTrade: r2(s.t), totalR: r2(s.sum), gross: r3(g.mean), net2x: r3(stat(x.map((r) => r.c2)).mean), win: s.n ? r3(won / s.n) : 0,
    tMonthly: r2(m.t), months: m.months, costR: r3(stat(x.map((r) => r.costR + r.finR)).mean), longs: x.filter((r) => r.side > 0).length };
}

// ─── placebo: random H1 entries with the H4 bias, the same r0, R target, exit and costs ───
export function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function biasPools(H1, E4, w) {   // candle indices of the window, not 17:00 NY, by the H4 bias at the candle's open
  const T = E4.map((e) => e.t), pool = { 1: [], '-1': [] };
  for (let i = 0; i < H1.length - K.HOLD; i++) {
    const t = H1[i].time; if (t < w.from || t >= w.to) continue;
    const q = lowerT(T, t); if (q < 0) continue;
    if (nyHour(t) === 17) continue;
    pool[E4[q].dir].push(i);
  }
  return pool;
}
export function placebo(real, data, rates, seed, w) {
  const rnd = mulberry(seed), out = [];
  for (const r of real) {
    const { H1, pools } = data[r.mk], P = pools[r.side]; if (!P.length) continue;
    const e = P[Math.floor(rnd() * P.length)], entry = H1[e].open, stop = entry - r.side * r.r0, target = entry + r.side * r.rr * r.r0;
    const sim = simulate(H1, e, r.side, stop, target); if (!sim) continue;
    out.push(costed(r.mk, r.side, entry, r.r0, sim.exit, H1[e].time, sim.exitT, rates).net);
  }
  return stat(out).mean;
}

// ─── run ───
export function loadMarket(dir, mk) { const H1 = toBars(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${mk}-1h.json.gz`))))); return { H1, H4: h4Of(H1) }; }

export function study(data, rates) {
  const end = Math.max(...MARKETS.map((m) => data[m].H1.at(-1).time + K.H1));
  const all = { A: [], B: [] }, perMarket = {}, funnels = {};
  for (const mk of MARKETS) {
    const { H1, H4 } = data[mk], r = trades(mk, H1, H4, rates);
    funnels[mk] = r.funnel; perMarket[mk] = {};
    for (const x of ['A', 'B']) { all[x].push(...r.trades[x]); perMarket[mk][x] = { dec: block(r.trades[x], WIN.dec, end), rep: block(r.trades[x], WIN.rep, end) }; }
    data[mk].pools = biasPools(H1, signals(H1, H4).E4, { from: WIN.dec.from, to: end });
  }
  const exits = {};
  for (const x of ['A', 'B']) {
    all[x].sort((a, b) => a.exitT - b.exitT);
    const dec = block(all[x], WIN.dec, end), rep = block(all[x], WIN.rep, end);
    const realDec = all[x].filter((r) => r.exitT >= WIN.dec.from && r.exitT < end);
    const seeds = []; for (let s = 1; s <= SEEDS; s++) seeds.push(placebo(realDec, data, rates, s, WIN.dec));
    const years = {}; for (const r of all[x]) { const y = new Date(r.exitT * 1000).getUTCFullYear(); if (y < 2010) continue; (years[y] ||= []).push(r.net); }
    exits[x] = { dec, rep, p: pNorm(dec.tMonthly), placebo: { seeds: seeds.map(r3), mean: r3(stat(seeds).mean), p95: r3(pct(seeds, 0.95)), max: r3(Math.max(...seeds)), beats: seeds.filter((v) => v >= dec.net).length },
      years: Object.fromEntries(Object.entries(years).map(([y, v]) => { const s = stat(v); return [y, { n: s.n, net: r3(s.mean), total: r2(s.sum) }]; })) };
  }
  const adj = holm([exits.A.p, exits.B.p]);
  exits.A.pHolm = r3(adj[0]); exits.B.pHolm = r3(adj[1]); exits.A.p = r3(exits.A.p); exits.B.p = r3(exits.B.p);
  for (const x of ['A', 'B']) {
    const e = exits[x], lines = { positive: e.dec.net > 0, tMonthly: e.dec.tMonthly >= 2, holm: e.pHolm < 0.05, replication: e.rep.net > 0, placebo: e.dec.net > e.placebo.p95 };
    e.lines = lines; e.pass = Object.values(lines).every(Boolean);
  }
  return { exits, perMarket, funnels, end, trades: all };
}

export function verdictText(S) {
  const sg = (v) => `${v >= 0 ? '+' : ''}${v}`, any = S.exits.A.pass || S.exits.B.pass;
  const one = (x, name) => { const e = S.exits[x]; return `${name} ${sg(e.dec.net)}R a trade net on 2016-26 (n ${e.dec.n}, monthly t ${e.dec.tMonthly}; 2010-15 ${sg(e.rep.net)}R, n ${e.rep.n}; placebo 95th percentile ${sg(e.placebo.p95)}R)`; };
  return `${any ? 'PASS' : 'FAIL'}: ${any ? 'at least one exit passes every pre-registered line' : `${[S.exits.A, S.exits.B].filter((e) => e.pass).length} of 2 exits pass`}; ${one('A', 'exit A (H4 extreme)')}; ${one('B', 'exit B (2R)')}`;
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const DIR = process.argv[2]; if (!DIR) throw new Error('usage: node run.mjs <candle dir>');
  const rates = JSON.parse(fs.readFileSync(path.join(HERE, 'rates.json'), 'utf8')).DGS2, data = {}, candles = {};
  for (const mk of MARKETS) { data[mk] = loadMarket(DIR, mk); const H = data[mk].H1; candles[mk] = { h1: H.length, h4: data[mk].H4.length, from: new Date(H[0].time * 1000).toISOString().slice(0, 16), to: new Date(H.at(-1).time * 1000).toISOString().slice(0, 16) }; }
  const S = study(data, rates);
  const out = { topic: 'index-cycle', built: '2026-11-13', system: 'The owner\'s market cycle as an entry (H4 BO bias, H1 ChoCh, H1 BO back with the H4; enter next H1 open), NAS100 / SPX500 / US30, OANDA mid H1',
    verdict: verdictText(S), window: { decisive: WIN.dec.label, replication: WIN.rep.label, end: new Date(S.end * 1000).toISOString().slice(0, 16) },
    params: { ...K, COST, FIN, SEEDS }, candles, funnels: S.funnels, exits: S.exits, perMarket: S.perMarket,
    candidates: ['A', 'B'].map((x) => ({ rule: x === 'A' ? 'Exit A: target the H4 move\'s extreme (>= 1R), out after 48 H1' : 'Exit B: fixed 2R target, out after 48 H1', verdict: S.exits[x].pass ? 'PASS' : 'FAIL', is: S.exits[x].rep, oos: S.exits[x].dec })) };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(out.verdict);
  for (const x of ['A', 'B']) { const e = S.exits[x]; console.log(x, 'dec', JSON.stringify(e.dec), '\n  rep', JSON.stringify(e.rep), '\n  placebo', JSON.stringify({ mean: e.placebo.mean, p95: e.placebo.p95 }), 'p', e.p, 'holm', e.pHolm, JSON.stringify(e.lines)); }
  for (const mk of MARKETS) console.log(mk, JSON.stringify(S.funnels[mk]), 'A', JSON.stringify(S.perMarket[mk].A.dec), 'B', JSON.stringify(S.perMarket[mk].B.dec));
}
