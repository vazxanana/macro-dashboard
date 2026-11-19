// Does silver lead gold (or gold lead silver) by a few minutes inside the day? (PREREGISTRATION.md, pushed first.)
//   node --use-env-proxy research/edge/gold-silver-lead-intraday/fetch.mjs <dir>   OANDA mid M5 xau / xag from 2016 (cache outside git)
//   node research/edge/gold-silver-lead-intraday/run.mjs <dir>                     writes result.json
// A stand-alone research rule (item 44): never a gate, exit, entry or size of the live gold book. Paper only.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { nyParts, dayInfo, cmeShut as cmeShutRaw } from '../../../ict/calendar.mjs';
// every CME boundary falls on a whole New York hour (13:00, 17:00, 18:00) and New York's offset is whole hours, so the answer is the
// same for every minute of a UTC hour: kept per hour (speed only)
const SHUT = new Map();
const cmeShut = (t) => { const h = Math.floor(t / 3600); let v = SHUT.get(h); if (v === undefined) { v = cmeShutRaw(h * 3600); SHUT.set(h, v); } return v; };

export const M5 = 300, D = 86400;
export const P = { k: 2, frac: 0.5, winDays: 28, minPairs: 3000, minBlocks: 200, holdT1: 1800, holdT2: 3600, holdT3: 1800, quietFrom: 16 * 60 + 30, quietTo: 18 * 60 + 30 };
export const START = Date.UTC(2016, 0, 1) / 1000, SPLIT = Date.UTC(2021, 0, 1) / 1000;
export const COST = 0.60;   // $0.30 spread + $0.15 slippage on the entry and on the exit (both market orders)

// inner join by exact candle start: { t, go, gh, gl, gc, sc } arrays, plus gold's own series index
export function join(G, S) {
  const sm = new Map(S.map((b) => [b.time, b]));
  const J = { t: [], go: [], gh: [], gl: [], gc: [], sc: [] };
  for (const b of G) { const s = sm.get(b.time); if (!s) continue; J.t.push(b.time); J.go.push(b.open); J.gh.push(b.high); J.gl.push(b.low); J.gc.push(b.close); J.sc.push(s.close); }
  return J;
}

// per joined candle i (with a defined return): g, s and the prior-window moments; returns arrays (NaN where undefined)
export function moments(J, p = P) {
  const n = J.t.length, g = new Float64Array(n).fill(NaN), s = new Float64Array(n).fill(NaN);
  for (let i = 1; i < n; i++) if (J.t[i] - J.t[i - 1] === M5) { g[i] = Math.log(J.gc[i] / J.gc[i - 1]); s[i] = Math.log(J.sc[i] / J.sc[i - 1]); }
  const sdG = new Float64Array(n).fill(NaN), sdS = new Float64Array(n).fill(NaN), beta = new Float64Array(n).fill(NaN), betaR = new Float64Array(n).fill(NaN);
  let lo = 1, hi = 1, c = 0, Sg = 0, Ss = 0, Sgg = 0, Sss = 0, Sgs = 0;
  const add = (k, w) => { if (Number.isNaN(g[k])) return; c += w; Sg += w * g[k]; Ss += w * s[k]; Sgg += w * g[k] * g[k]; Sss += w * s[k] * s[k]; Sgs += w * g[k] * s[k]; };
  for (let i = 1; i < n; i++) {
    while (hi < i) add(hi++, 1);                                     // window holds candles before i
    while (lo < hi && J.t[lo] < J.t[i] - p.winDays * D) add(lo++, -1); // ... starting in the 28 days before i
    if (Number.isNaN(g[i]) || c < p.minPairs) continue;
    const vg = (Sgg - Sg * Sg / c) / (c - 1), vs = (Sss - Ss * Ss / c) / (c - 1), cv = (Sgs - Sg * Ss / c) / (c - 1);
    if (!(vg > 0 && vs > 0)) continue;
    sdG[i] = Math.sqrt(vg); sdS[i] = Math.sqrt(vs); beta[i] = cv / vs; betaR[i] = cv / vg;
  }
  return { g, s, sdG, sdS, beta, betaR };
}

// the silver-shock (lead 's') and gold-shock (lead 'g') candidates: [{ i, t, side }] before the clock / holiday exclusions
export function shocks(J, m, lead, p = P) {
  const out = [];
  for (let i = 1; i < J.t.length; i++) {
    if (Number.isNaN(m.sdG[i])) continue;
    if (lead === 's') {
      const r = m.s[i], b = m.beta[i]; if (!(b > 0) || !(Math.abs(r) > p.k * m.sdS[i])) continue;
      if (Math.sign(r) * m.g[i] < p.frac * b * Math.abs(r)) out.push({ i, t: J.t[i], side: Math.sign(r) });
    } else {
      const r = m.g[i], b = m.betaR[i]; if (!(b > 0) || !(Math.abs(r) > p.k * m.sdG[i])) continue;
      if (Math.sign(r) * m.s[i] < p.frac * b * Math.abs(r)) out.push({ i, t: J.t[i], side: -Math.sign(r) });
    }
  }
  return out;
}

// is a signal candle starting at t with this hold allowed? (not a CME holiday / early-close New York date; the window from the
// signal start to the planned exit does not touch 16:30-18:30 New York)
const NYC = new Map();
const ny = (t) => { let v = NYC.get(t); if (!v) { v = nyParts(t); NYC.set(t, v); } return v; };
export function allowed(t, hold, p = P) {
  const q = ny(t); if (q.wd === 'Sat' || q.wd === 'Sun' && q.min < 18 * 60) return false;
  if (dayInfo(q.ymd).kind !== 'open') return false;
  for (let k = q.min; k < q.min + 5 + hold / 60; k += 5) { const mm = k % 1440; if (mm >= p.quietFrom && mm < p.quietTo) return false; }
  return true;
}

// 20-day mean 30-minute gold range: complete 6-candle blocks starting on :00 / :30 UTC ([start, range]); rangeCursor(blocks)(t) =
// mean over blocks starting in the 28 days before t (null under minBlocks). A cursor restarts when t goes back.
export function rangeBlocks(G) {
  const idx = new Map(G.map((b, i) => [b.time, i])), blocks = [];
  for (let i = 0; i < G.length; i++) {
    const t = G[i].time; if (t % 1800) continue;
    let hi = -Infinity, lo = Infinity, ok = true;
    for (let k = 0; k < 6; k++) { const j = idx.get(t + k * M5); if (j == null) { ok = false; break; } hi = Math.max(hi, G[j].high); lo = Math.min(lo, G[j].low); }
    if (ok) blocks.push([t, hi - lo]);
  }
  return blocks;
}
export function rangeCursor(blocks, p = P) {
  let lo = 0, hi = 0, sum = 0, last = -Infinity;
  const f = (t) => {
    if (t < last) { lo = 0; hi = 0; sum = 0; }
    last = t;
    while (hi < blocks.length && blocks[hi][0] < t) sum += blocks[hi++][1];
    while (lo < hi && blocks[lo][0] < t - p.winDays * D) sum -= blocks[lo++][1];
    return hi - lo >= p.minBlocks ? sum / (hi - lo) : null;
  };
  return f;
}

// one gold trade from signal candle start t: entry at the next candle's open (a joined candle), stop 1 x the range mean
export function trade(G, gi, joinedSet, rangeAt, t, side, hold, cost = COST) {
  const e0 = gi.get(t + M5); if (e0 == null || !joinedSet.has(t + M5)) return null;
  const risk = rangeAt(t); if (!(risk > 0)) return null;
  const entry = G[e0].open, stop = entry - side * risk;
  let exit = null, how = 'time', exitT = null;
  for (let k = e0; k < G.length && G[k].time < t + M5 + hold; k++) {
    const b = G[k]; if (cmeShut(b.time)) return null;
    if (side > 0 ? b.low <= stop : b.high >= stop) { exit = side > 0 ? Math.min(b.open, stop) : Math.max(b.open, stop); how = 'stop'; exitT = b.time + M5; break; }
    exit = b.close; exitT = b.time + M5;
  }
  if (exit == null) return null;
  const R = side * (exit - entry) / risk;
  return { t, entryT: G[e0].time, exitT, side, entry, stop, risk, exit, how, R, cost: cost / risk, net: R - cost / risk };
}

// one stream: signals [{ t, side }] in time order, one position at a time
export function stream(ctx, sigs, hold, mult = 1) {
  const out = []; let busyTo = -Infinity;
  for (const s of sigs) {
    if (s.t + M5 < busyTo) continue;
    const tr = trade(ctx.G, ctx.gi, ctx.js, ctx.rangeAt(), s.t, s.side, hold, mult * COST); if (!tr) continue;
    out.push(tr); busyTo = tr.exitT;
  }
  return out;
}

// statistics: t on calendar-month sums
const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);
const erfc = (x) => { const z = Math.abs(x), t = 1 / (1 + 0.5 * z), r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? r : 2 - r; };
export const pOne = (t) => 0.5 * erfc(t / Math.SQRT2);
export function monthT(T, key = 'net') {
  const m = new Map(); for (const x of T) m.set(ym(x.entryT), (m.get(ym(x.entryT)) || 0) + x[key]);
  const v = [...m.values()], n = v.length; if (n < 3) return { months: n, t: null };
  const a = v.reduce((p, q) => p + q, 0) / n, sd = Math.sqrt(v.reduce((p, q) => p + (q - a) ** 2, 0) / (n - 1));
  return { months: n, t: sd > 0 ? +(a / (sd / Math.sqrt(n))).toFixed(2) : null };
}
export function holm(ps) { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = Array(ps.length); let m = 0;
  o.forEach(([p, i], r) => { m = Math.max(m, Math.min(1, p * (ps.length - r))); adj[i] = m; }); return adj; }
const r3 = (x) => +x.toFixed(3);
export function stats(T) {
  const n = T.length; if (!n) return { n: 0 };
  const g = T.reduce((p, x) => p + x.R, 0), s = T.reduce((p, x) => p + x.net, 0);
  let eq = 0, pk = 0, dd = 0; for (const x of T) { eq += x.net; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  const mt = monthT(T);
  return { n, gross: r3(g), grossAvg: r3(g / n), net: r3(s), avg: r3(s / n), win: +(T.filter((x) => x.net > 0).length / n).toFixed(3),
    stopped: +(T.filter((x) => x.how === 'stop').length / n).toFixed(3), dd: r3(dd), months: mt.months, t: mt.t, tGross: monthT(T, 'R').t };
}

// seeded RNG (mulberry32)
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// placebo: each signal replaced by a random allowed joined candle (defined return) of the same calendar year, same side
export function placeboSigs(sigs, poolByYear, seed) {
  const R = rng(seed), out = [];
  for (const s of sigs) { const a = poolByYear.get(new Date(s.t * 1000).getUTCFullYear()); if (!a || !a.length) continue; out.push({ t: a[Math.floor(R() * a.length)], side: s.side }); }
  return out.sort((x, y) => x.t - y.t);
}

export function analyse(G, S, { seeds = 40, p = P } = {}) {
  G = G.filter((b) => b.time >= START); S = S.filter((b) => b.time >= START);
  const J = join(G, S), m = moments(J, p), gi = new Map(G.map((b, i) => [b.time, i])), js = new Set(J.t);
  const blocks = rangeBlocks(G), rangeAt = () => rangeCursor(blocks, p);
  const ctx = { G, gi, js, rangeAt };
  const sS = shocks(J, m, 's', p), sG = shocks(J, m, 'g', p);
  const TESTS = {
    T1: { hold: p.holdT1, raw: sS, what: 'silver shock, gold lagging: trade gold with silver, out after 30 minutes' },
    T2: { hold: p.holdT2, raw: sS, what: 'silver shock, gold lagging: trade gold with silver, out after 60 minutes' },
    T3: { hold: p.holdT3, raw: sG, what: 'gold shock, silver lagging: fade gold, out after 30 minutes' },
  };
  const win = { inSample: (x) => x.entryT < SPLIT, outOfSample: (x) => x.entryT >= SPLIT };
  const pools = new Map();
  const poolFor = (hold) => { if (pools.has(hold)) return pools.get(hold); const pm = new Map();
    for (let i = 1; i < J.t.length; i++) { if (Number.isNaN(m.sdG[i]) || !allowed(J.t[i], hold, p)) continue; const y = new Date(J.t[i] * 1000).getUTCFullYear(); let a = pm.get(y); if (!a) pm.set(y, a = []); a.push(J.t[i]); }
    pools.set(hold, pm); return pm; };
  const out = { joined: J.t.length, rangeBlocks: blocks.length, shocks: { silver: sS.length, silverUp: sS.filter((x) => x.side > 0).length, gold: sG.length, goldUp: sG.filter((x) => x.side < 0).length }, tests: {} };
  for (const [k, T] of Object.entries(TESTS)) {
    process.stderr.write(`${k} ${new Date().toISOString()}\n`);
    const sigs = T.raw.filter((x) => allowed(x.t, T.hold, p)).map(({ t, side }) => ({ t, side }));
    const tr = stream(ctx, sigs, T.hold), tr2 = stream(ctx, sigs, T.hold, 2);
    const o = { what: T.what, hold: T.hold / 60, signals: sigs.length, windows: {}, cost2x: {}, years: {}, bySide: {} };
    for (const [w, f] of Object.entries(win)) { o.windows[w] = stats(tr.filter(f)); o.cost2x[w] = stats(tr2.filter(f)); }
    for (const x of tr) { const y = new Date(x.entryT * 1000).getUTCFullYear(); (o.years[y] = o.years[y] || []).push(x); }
    for (const y of Object.keys(o.years)) { const s = stats(o.years[y]); o.years[y] = { n: s.n, gross: s.grossAvg, avg: s.avg, net: s.net }; }
    for (const sd of [1, -1]) { const s = stats(tr.filter((x) => win.outOfSample(x) && x.side === sd)); o.bySide[sd > 0 ? 'buy' : 'sell'] = { n: s.n, gross: s.grossAvg, avg: s.avg, t: s.t }; }
    const pool = poolFor(T.hold), pl = [];
    for (let s = 1; s <= seeds; s++) { const st = stats(stream(ctx, placeboSigs(sigs, pool, s * 7919 + k.charCodeAt(1)), T.hold).filter(win.outOfSample)); pl.push({ seed: s, n: st.n, gross: st.grossAvg, avg: st.avg, t: st.t }); }
    const ts = pl.map((x) => x.t ?? -Infinity).sort((a, b) => a - b), avgs = pl.map((x) => x.avg).sort((a, b) => a - b), gs = pl.map((x) => x.gross).sort((a, b) => a - b);
    o.placebo = { seeds, t95: ts[37], tMedian: ts[seeds >> 1], tMax: ts.at(-1), avgMedian: avgs[seeds >> 1], avgMin: avgs[0], avgMax: avgs.at(-1), grossMedian: gs[seeds >> 1], grossMax: gs.at(-1),
      atOrAboveRealT: pl.filter((x) => (x.t ?? -Infinity) >= (o.windows.outOfSample.t ?? -Infinity)).length, runs: pl };
    const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
    o.medianStop = tr.length ? +med(tr.map((x) => x.risk)).toFixed(3) : null; o.medianCostR = tr.length ? +med(tr.map((x) => x.cost)).toFixed(3) : null;
    out.tests[k] = o;
  }
  const keys = Object.keys(TESTS), ps = keys.map((k) => { const t = out.tests[k].windows.outOfSample.t; return t == null ? 1 : pOne(t); }), adj = holm(ps);
  keys.forEach((k, i) => { const o = out.tests[k], d = o.windows.outOfSample, r = o.windows.inSample;
    o.p = +ps[i].toFixed(4); o.pHolm = +adj[i].toFixed(4);
    o.checks = { oosPositiveHolm: d.avg > 0 && adj[i] < 0.05, isSameSign: r.avg > 0, cost2x: o.cost2x.outOfSample.avg > 0, n150: d.n >= 150, abovePlacebo95: (d.t ?? -Infinity) > o.placebo.t95 };
    o.pass = Object.values(o.checks).every(Boolean); });
  out.verdict = keys.some((k) => out.tests[k].pass) ? 'PASS' : 'FAIL';
  out.passed = keys.filter((k) => out.tests[k].pass);
  return out;
}

const load = (dir, sym) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${sym}-5m.json.gz`)))).map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');

function full(dir) {
  const G = load(dir, 'xau').filter((b) => b.time >= START), S = load(dir, 'xag').filter((b) => b.time >= START);
  const span = (x) => ({ from: iso(x[0].time), to: iso(x.at(-1).time), candles: x.length });
  const res = analyse(G, S);
  const out = { built: new Date().toISOString().slice(0, 10), study: 'gold-silver-lead-intraday', verdict: res.verdict,
    scope: 'Stand-alone intraday research rule (item 44): not a gate, exit, entry or size of the live gold book; no candle before 2016. Paper only.',
    data: { src: 'OANDA mid M5 via the site candle proxy, joined by exact candle start', xau: span(G), xag: span(S) }, params: P,
    windows: { inSample: '2016-01-01 to 2020-12-31', outOfSample: '2021-01-01 to the end of the data' },
    costs: `$${COST} a round trip in gold price ($0.30 spread + half a spread of slippage on the entry and on the exit); 2x = $${2 * COST}; no financing (no trade spans the rollover)`,
    ...res };
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify(out.data), res.joined, JSON.stringify(res.shocks));
  for (const [k, o] of Object.entries(res.tests)) { const { placebo, years, ...rest } = o; const { runs, ...pl } = placebo; console.log(k, JSON.stringify(rest)); console.log('  placebo', JSON.stringify(pl)); console.log('  years', JSON.stringify(years)); }
  console.log(res.verdict, res.passed);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [dir] = process.argv.slice(2);
  if (!dir) console.log('usage: run.mjs <dir>'); else full(dir);
}
