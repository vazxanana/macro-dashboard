// research/edge/ltf-choch-entry/run.mjs - a lower-timeframe ChoCh as the entry at an H4 / H1 key zone (PREREGISTRATION.md).
// node research/edge/ltf-choch-entry/run.mjs market <market> <outDir>   one market: every trade of every entry timeframe
// node research/edge/ltf-choch-entry/run.mjs report <outDir>            pool, the four pre-registered tests, result.json
// Research only: reads the edgekit candle cache (EDGE_DATA), imports the grids' zone code; writes only <outDir> and its folder.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { buildZones, frames } from '../combo-grid/run.mjs';
import { COSTS, exclusions, GRID_MARKETS } from '../combo-grid-2/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const START = Date.UTC(2020, 0, 1) / 1000, SPLIT = Date.UTC(2024, 0, 1) / 1000;
export const MARKETS = GRID_MARKETS;                     // the 18 markets of the cache
export const M1_MARKETS = ['xau', 'eurusd', 'gbpusd'];   // markets with 1-minute candles
export const ZTFS = ['4h', '1h'], KINDS = ['eg', 'ef', 'bar', 'dom'];
export const WAIT = { '4h': 12 * 3600, '1h': 4 * 3600 }, CAP = { '4h': 5 * 86400, '1h': 2 * 86400 };
export const SEC = { '1m': 60, '5m': 300, '15m': 900 };
export const LIMIT_LIFE = 12, MIN_STOP_COSTS = 2, FAR_MIN = 3;
export const EXITS = ['2R', '3R', 'far'];

// first index with bars[i].t >= t
function firstAt(B, t) { let lo = 0, hi = B.length; while (lo < hi) { const m = (lo + hi) >> 1; if (B[m].t < t) lo = m + 1; else hi = m; } return lo; }

// One trade, three exits in one pass (the rules of combo-grid's multi, with exit times kept).
// S: simulation candles. type 'mkt' (fill at the open of the first candle starting at or after t0) or 'lim' (entry price,
// valid until expire; a candle closing past the stop before the fill cancels it; on the fill candle only the stop counts).
// targets: 2R and 3R from the fill, and a far price (or null). cap: seconds after the fill, time exit at that candle's close.
// Returns null (no fill, bad, or still open at the end of the file) or { fillT, fill, risk, R: [3], X: [3] exit times }.
export function sim(S, s, entry, stop, type, t0, expire, far, cap) {
  let i = firstAt(S, t0), fill = null;
  if (type === 'mkt') { if (i >= S.length) return null; fill = S[i].o; }
  else {
    for (; i < S.length; i++) { const b = S[i]; if (b.t >= expire) return null;
      if (s > 0 ? b.l <= entry : b.h >= entry) { fill = s > 0 ? Math.min(b.o, entry) : Math.max(b.o, entry); break; }
      if (s > 0 ? b.c < stop : b.c > stop) return null; }
    if (fill == null) return null;
  }
  const risk = s * (fill - stop); if (!(risk > 0)) return null;
  const tg = [fill + s * 2 * risk, fill + s * 3 * risk, far];
  const R = [null, null, null], X = [null, null, null], done = [false, false, far == null]; let left = far == null ? 2 : 3;
  const fin = (k, px, t) => { if (!done[k]) { done[k] = true; R[k] = (s * (px - fill)) / risk; X[k] = t; left--; } };
  const fi = i, deadline = S[fi].t + cap;
  for (let j = fi; j < S.length && left; j++) {
    const b = S[j], first = j === fi;
    if (!first) { if (s * (b.o - stop) <= 0) for (let k = 0; k < 3; k++) fin(k, b.o, b.t);
      for (let k = 0; k < 3; k++) if (!done[k] && s * (b.o - tg[k]) >= 0) fin(k, b.o, b.t); }
    const low = s > 0 ? b.l : b.h, high = s > 0 ? b.h : b.l;
    if (s * (low - stop) <= 0) for (let k = 0; k < 3; k++) fin(k, stop, b.e);
    if (!(first && type !== 'mkt')) for (let k = 0; k < 3; k++) if (!done[k] && s * (high - tg[k]) >= 0) fin(k, tg[k], b.e);
    if (b.e >= deadline) for (let k = 0; k < 3; k++) fin(k, b.c, b.e);
  }
  if (left) return null;
  return { fillT: S[fi].t, fill, risk, R, X };
}

// Zone touches on 5-minute candles: first and second visit of each standing zone. t0 = the touching candle's start.
export function touches(Z, M5, start) {
  const out = [];
  for (const z of Z) {
    if (z.at < start - 30 * 86400) continue;
    let k = firstAt(M5, z.at), visit = 0;
    while (k < M5.length && M5[k].t < z.end && visit < 2) {
      while (k < M5.length && M5[k].t < z.end && !(M5[k].l <= z.top && M5[k].h >= z.bot)) k++;
      if (k >= M5.length || M5[k].t >= z.end) break;
      visit++; out.push({ z, visit, t0: M5[k].t });
      while (k < M5.length && M5[k].t < z.end && M5[k].l <= z.top && M5[k].h >= z.bot) k++;
      k++;
    }
  }
  return out;
}

// The far target: the near edge of the nearest opposite H4 / D1 eg or ef zone standing at t and ahead of ref.
function farFinder(F) {
  const Z = [];
  for (const tf of ['4h', '1d']) for (const kind of ['eg', 'ef']) for (const z of buildZones(kind, F[tf])) Z.push(z);
  Z.sort((a, b) => a.at - b.at);
  return (s, t, ref) => { let best = null;
    for (const z of Z) { if (z.at > t) break; if (z.end <= t || z.d !== -s) continue;
      const edge = s > 0 ? z.bot : z.top; if (s * (edge - ref) > 0 && (best == null || s * (best - edge) > 0)) best = edge; }
    return best; };
}

// Every trade of one market. M5: 5-minute candles; M1: 1-minute candles or null. X: bad intervals [[from, to]].
// Each trade (R before costs; cr = the cost in R): { etf, entry 'A'|'B', ztf, kind, visit, side, t (fill), risk, cr (cost / risk), R: [2R, 3R, far|null], X: [..] }.
export function runMarket({ M5, M1 = null, cost, X = [], start = START }) {
  const F = frames(M5);
  const far = farFinder(F);
  const sigs = [];
  ZTFS.forEach((ztf, zo) => KINDS.forEach((kind, ko) => {
    for (const tc of touches(buildZones(kind, F[ztf]), M5, start)) sigs.push({ ...tc, ztf, kind, ord: zo * 10 + ko });
  }));
  sigs.sort((a, b) => a.t0 - b.t0 || a.ord - b.ord || a.visit - b.visit);
  const etfs = [['15m', F['15m'], M5], ['5m', M5, M5]]; if (M1 && M1.length) etfs.push(['1m', M1, M1]);
  const inBad = (t) => X.some((x) => t >= x[0] && t <= x[1]);
  const trades = []; let dropped = 0;
  for (const [etf, E, S] of etfs) {
    const evs = K.structure(E, 2).events.filter((e) => e.kind === 'ChoCh');
    const by = { 1: evs.filter((e) => e.dir > 0), '-1': evs.filter((e) => e.dir < 0) };
    const seen = new Set();
    for (const sg of sigs) {
      const d = sg.z.d, list = by[d];
      let lo = 0, hi = list.length; while (lo < hi) { const m = (lo + hi) >> 1; if (list[m].t <= sg.t0) lo = m + 1; else hi = m; }
      const ev = list[lo]; if (!ev) continue;
      if (ev.t > sg.t0 + WAIT[sg.ztf] || ev.t >= sg.z.end) continue;
      if (seen.has(ev.i)) continue; seen.add(ev.i);     // one trade per ChoCh: the earliest touch (sigs are in that order)
      // the extreme since the touch, from simulation candles closed by the ChoCh close
      let ext = d > 0 ? Infinity : -Infinity;
      for (let j = firstAt(S, sg.t0); j < S.length && S[j].e <= ev.t; j++) ext = d > 0 ? Math.min(ext, S[j].l) : Math.max(ext, S[j].h);
      if (!Number.isFinite(ext)) continue;
      const stop = ext - d * cost / 2;
      for (const ent of ['A', 'B']) {
        const ref = ent === 'A' ? E[ev.i].c : ev.level;
        if (!(d * (ref - stop) >= MIN_STOP_COSTS * cost)) continue;
        const edge = far(d, ev.t, ref), farPx = edge != null && (d * (edge - ref)) / (d * (ref - stop)) >= FAR_MIN ? edge : null;
        const r = ent === 'A' ? sim(S, d, null, stop, 'mkt', ev.t, null, farPx, CAP[sg.ztf])
          : sim(S, d, ev.level, stop, 'lim', ev.t, ev.t + LIMIT_LIFE * SEC[etf], farPx, CAP[sg.ztf]);
        if (!r || r.fillT < start) continue;
        if (inBad(r.fillT)) { dropped++; continue; }
        trades.push({ etf, entry: ent, ztf: sg.ztf, kind: sg.kind, visit: sg.visit, side: d, t: r.fillT, risk: r.risk, cr: cost / r.risk, R: r.R, X: r.X });
      }
    }
  }
  return { trades, dropped, zones: sigs.length };
}

// ---- statistics --------------------------------------------------------------------------------------------------------
const monthIdx = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2020) * 12 + d.getUTCMonth(); };
const p1 = (t, df) => { if (t == null || !(df > 0)) return 1; const p = K.pFromT(t, df); return t > 0 ? p / 2 : 1 - p / 2; };
const rnet = (x, k, c = 1) => x.R[k] - c * x.cr;
function mean(a) { return a.length ? a.reduce((s, v) => s + v, 0) / a.length : null; }
function sd(a) { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : null; }
// The judging basis (amendment before the run, 23 Nov 2026, owner): R BEFORE costs (cost multiplier 0).
export const JUDGE_COST = 0;
const mt = (xs, k, a, b, c) => { const nm = b - a; const ms = new Array(nm).fill(0);
  for (const x of xs) ms[monthIdx(x.t) - a] += rnet(x, k, c);
  const mm = mean(ms), msd = sd(ms); return msd > 0 ? mm / (msd / Math.sqrt(nm)) : null; };
// one window: n, mean before costs (the judged figure), after costs, at twice the cost, month-sum t of each (empty months = 0)
export function win(xs, k, a, b) {
  const v = xs.map((x) => rnet(x, k, JUDGE_COST)); const nm = b - a; const tM = mt(xs, k, a, b, JUDGE_COST);
  return { n: xs.length, mean: mean(v), net: mean(xs.map((x) => rnet(x, k))), cost2: mean(xs.map((x) => rnet(x, k, 2))),
    wins: v.filter((r) => r > 0).length, tMonth: tM, tNet: mt(xs, k, a, b, 1), months: nm, p1: p1(tM, nm - 1) };
}
export function welch(a, b) {
  const ma = mean(a), mb = mean(b), va = sd(a) ** 2, vb = sd(b) ** 2; if (!(a.length > 1 && b.length > 1)) return { diff: null, t: null, df: null };
  const se2 = va / a.length + vb / b.length, t = (ma - mb) / Math.sqrt(se2);
  const df = se2 ** 2 / ((va / a.length) ** 2 / (a.length - 1) + (vb / b.length) ** 2 / (b.length - 1));
  return { diff: ma - mb, t, df, p1: p1(t, df) };
}
const r4 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(4)), r2 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(2));
const slim = (w) => ({ n: w.n, mean: r4(w.mean), tMonth: r2(w.tMonth), wins: w.wins, net: r4(w.net), tNet: r2(w.tNet), cost2: r4(w.cost2) });

export function judge(all, lastMonth) {
  const IS = [0, 48], OOS = [48, lastMonth + 1];
  const sel = (f, k) => { const xs = all.filter((x) => f(x) && x.R[k] != null);
    return { xs, d: xs.filter((x) => x.t < SPLIT), c: xs.filter((x) => x.t >= SPLIT) }; };
  const level = (f, k = 0) => { const s = sel(f, k); return { disc: win(s.d, k, ...IS), conf: win(s.c, k, ...OOS) }; };
  const diff = (fa, fb, k = 0) => { const A = sel(fa, k), B = sel(fb, k);
    const one = (a, b, c = JUDGE_COST) => welch(a.map((x) => rnet(x, k, c)), b.map((x) => rnet(x, k, c)));
    return { disc: { ...one(A.d, B.d), nA: A.d.length, nB: B.d.length }, conf: { ...one(A.c, B.c), nA: A.c.length, nB: B.c.length },
      confNet: one(A.c, B.c, 1), discNet: one(A.d, B.d, 1), a: level(fa, k), b: level(fb, k) }; };
  const isA = (etf) => (x) => x.etf === etf && x.entry === 'A';
  const m1 = (x) => M1_MARKETS.includes(x.market);
  const T = {
    T1: level(isA('5m')),
    T2: level((x) => isA('1m')(x) && m1(x)),
    T3: diff(isA('5m'), isA('15m')),
    T4: diff((x) => isA('1m')(x) && m1(x), (x) => isA('5m')(x) && m1(x)),
  };
  const ps = [T.T1.conf.p1, T.T2.conf.p1, T.T3.conf.p1, T.T4.conf.p1]; const adj = K.holm(ps);
  const out = {};
  ['T1', 'T2'].forEach((k, i) => { const { disc: D, conf: C } = T[k];
    const pass = D.n >= 100 && D.mean > 0 && D.tMonth >= 2 && C.n >= 50 && C.mean > 0 && C.tMonth >= 2 && adj[i] < 0.05;
    const fail = !(C.mean > 0) || !(D.mean > 0);
    out[k] = { verdict: pass ? 'PASS' : fail ? 'FAIL' : 'INCONCLUSIVE', disc: slim(D), conf: slim(C), holm: +adj[i].toPrecision(3) }; });
  ['T3', 'T4'].forEach((k, j) => { const i = j + 2, { disc: D, conf: C, confNet: CN, discNet: DN } = T[k];
    const enough = D.nA >= 100 && D.nB >= 100 && C.nA >= 50 && C.nB >= 50;
    const pass = enough && D.diff > 0 && D.t >= 2 && C.diff > 0 && C.t >= 2 && adj[i] < 0.05;
    const fail = !(C.diff > 0) || !(D.diff > 0);
    out[k] = { verdict: pass ? 'PASS' : fail ? 'FAIL' : 'INCONCLUSIVE', holm: +adj[i].toPrecision(3),
      disc: { diff: r4(D.diff), t: r2(D.t), nA: D.nA, nB: D.nB }, conf: { diff: r4(C.diff), t: r2(C.t), nA: C.nA, nB: C.nB },
      afterCosts: { disc: { diff: r4(DN.diff), t: r2(DN.t) }, conf: { diff: r4(CN.diff), t: r2(CN.t) } },
      lower: { disc: slim(T[k].a.disc), conf: slim(T[k].a.conf) }, higher: { disc: slim(T[k].b.disc), conf: slim(T[k].b.conf) } }; });
  // descriptive
  const desc = {};
  for (const etf of ['15m', '5m', '1m']) for (const ent of ['A', 'B']) EXITS.forEach((ex, k) => {
    const f = (x) => x.etf === etf && x.entry === ent;
    const L = level(f, k); desc[`${etf} ${ent} ${ex}`] = { disc: slim(L.disc), conf: slim(L.conf) };
    if (etf !== '15m') { const L3 = level((x) => f(x) && m1(x), k); desc[`${etf} ${ent} ${ex} (3 mkts)`] = { disc: slim(L3.disc), conf: slim(L3.conf) }; }
  });
  const split = (f0, key, vals, k = 0) => Object.fromEntries(vals.map((v) => { const L = level((x) => f0(x) && x[key] === v, k); return [v, { disc: slim(L.disc), conf: slim(L.conf) }]; }));
  const markets = [...new Set(all.map((x) => x.market))];
  desc.byZoneTf = { m5: split(isA('5m'), 'ztf', ZTFS), m1: split(isA('1m'), 'ztf', ZTFS), m15: split(isA('15m'), 'ztf', ZTFS) };
  desc.byKind = { m5: split(isA('5m'), 'kind', KINDS), m1: split(isA('1m'), 'kind', KINDS), m15: split(isA('15m'), 'kind', KINDS) };
  desc.byVisit = { m5: split(isA('5m'), 'visit', [1, 2]) };
  desc.byMarket = { m5: split(isA('5m'), 'market', markets), m15: split(isA('15m'), 'market', markets), m1: split(isA('1m'), 'market', M1_MARKETS) };
  const byYear = {}; for (const x of all.filter(isA('5m'))) { const y = new Date(x.t * 1000).getUTCFullYear(); (byYear[y] ||= []).push(rnet(x, 0, JUDGE_COST)); }
  desc.yearT1 = Object.fromEntries(Object.entries(byYear).map(([y, v]) => [y, { n: v.length, mean: r4(mean(v)) }]));
  return { tests: out, holmInputs: ps.map((p) => +p.toPrecision(3)), desc };
}

export function verdictOf(tests) {
  if (tests.T1.verdict === 'PASS' || tests.T2.verdict === 'PASS') return 'PASS';
  if (Object.values(tests).every((t) => t.verdict === 'FAIL')) return 'FAIL';
  return 'INCONCLUSIVE';
}

// ---- CLI -----------------------------------------------------------------------------------------------------------------
function packTrades(market, xs) { return xs.map((x) => [x.etf, x.entry, x.ztf, x.kind, x.visit, x.side, x.t, +x.risk.toPrecision(6), +x.cr.toPrecision(5), ...x.R.map((r) => (r == null ? null : +r.toFixed(4)))]); }
function unpack(market, rows) { return rows.map((r) => ({ market, etf: r[0], entry: r[1], ztf: r[2], kind: r[3], visit: r[4], side: r[5], t: r[6], risk: r[7], cr: r[8], R: [r[9], r[10], r[11]] })); }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') {
    const t0 = Date.now(); const M5 = K.load(a, '5m', { from: '2019-03-01' });
    const M1 = M1_MARKETS.includes(a) ? K.load(a, '1m', { from: '2019-06-01' }) : null;
    const out = runMarket({ M5, M1, cost: COSTS[a], X: exclusions(a) });
    fs.mkdirSync(b, { recursive: true });
    fs.writeFileSync(path.join(b, `${a}.json`), JSON.stringify({ market: a, last: M5[M5.length - 1].t, m1: M1 ? M1.length : 0, dropped: out.dropped, touches: out.zones, trades: packTrades(a, out.trades) }));
    console.log(a, out.trades.length, 'trades', out.zones, 'touches', ((Date.now() - t0) / 1000).toFixed(0) + 's');
  } else if (cmd === 'report') {
    const all = []; let last = 0; const info = {};
    for (const m of MARKETS) { const f = path.join(a, `${m}.json`); if (!fs.existsSync(f)) throw new Error('missing ' + m);
      const j = JSON.parse(fs.readFileSync(f, 'utf8')); all.push(...unpack(m, j.trades)); last = Math.max(last, j.last);
      info[m] = { trades: j.trades.length, touches: j.touches, dropped: j.dropped, m1Candles: j.m1, last: new Date(j.last * 1000).toISOString().slice(0, 16) }; }
    const lastMonth = new Date(last * 1000); const lm = (lastMonth.getUTCFullYear() - 2020) * 12 + lastMonth.getUTCMonth();
    const J = judge(all, lm); const verdict = verdictOf(J.tests);
    const out = { study: 'ltf-choch-entry', built: '2026-11-23', verdict, ...J, markets: info, lastCandle: new Date(last * 1000).toISOString().slice(0, 16),
      params: { zones: KINDS, zoneTfs: ZTFS, waitH: { '4h': 12, '1h': 4 }, swing: 2, limitLife: LIMIT_LIFE, minStopCosts: MIN_STOP_COSTS, farMinR: FAR_MIN, capDays: { '4h': 5, '1h': 2 } }, costs: COSTS };
    fs.writeFileSync(path.join(b || HERE, 'result.raw.json'), JSON.stringify(out, null, 1));
    console.log(JSON.stringify({ verdict, tests: J.tests, holmInputs: J.holmInputs }, null, 1));
  } else console.log('usage: run.mjs market <m> <dir> | report <dir> [outDir]');
}
