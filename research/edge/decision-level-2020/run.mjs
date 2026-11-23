// research/edge/decision-level-2020/run.mjs - the Decision Level entry after the Daily close (PREREGISTRATION.md, 23 Nov 2026).
// node research/edge/decision-level-2020/run.mjs run [outDir]   every market, the report, result.json beside this file
// Research only: reads the edgekit candle cache; imports edgekit and combo-grid-2 (COSTS, exclusions). Places nothing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { COSTS, GRID_MARKETS, exclusions } from '../combo-grid-2/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const START = Date.UTC(2020, 0, 1) / 1000, SPLIT = Date.UTC(2024, 0, 1) / 1000;
export const P = { lookback: 120, maxUses: 4, gapWin: 12, expT1: 2, expT2: 5, hold: 7 * 86400, rr: 2, targets: [1, 2, 3, 4] };
export const MARKETS = GRID_MARKETS; // 18

// ---- frames: complete candles only ------------------------------------------------------------------------------------
export function framesOf(M5) {
  const end = M5.length ? M5[M5.length - 1].e : 0;
  return { M5, D: K.dailyNY(M5).filter((d) => d.e <= end), H4: K.resample(M5, 14400).filter((b) => b.e <= end), end };
}
const lb = (A, t) => { let lo = 0, hi = A.length; while (lo < hi) { const m = (lo + hi) >> 1; if (A[m].t < t) lo = m + 1; else hi = m; } return lo; };

// ---- Daily key levels, freshness, rejections ---------------------------------------------------------------------------
// Returns per day j: { rej: [{ s, L }], touch: [{ s, L, rejected }] } computed from the level states BEFORE day j.
// rej = the level the day touched first among those it rejected, per side; touch = the first fresh level the day touched
// having opened on its right side (Control C), with whether the day then rejected it (a label).
export function dailyEvents(D) {
  const act = []; const out = [];
  for (let j = 0; j < D.length; j++) {
    const d = D[j], bLo = Math.min(d.o, d.c), bHi = Math.max(d.o, d.c);
    for (let k = act.length - 1; k >= 0; k--) if (act[k].i < j - P.lookback || act[k].uses >= P.maxUses) act.splice(k, 1);
    const ev = { rej: [], touch: [] };
    let bR = null, sR = null, bT = null, sT = null;
    for (const v of act) {
      if (v.i + 2 > j || !v.fresh || v.uses >= P.maxUses) continue;
      const L = v.L;
      if (d.l <= L && bLo > L && (bR == null || L > bR)) bR = L;
      if (d.h >= L && bHi < L && (sR == null || L < sR)) sR = L;
      if (d.o > L && d.l <= L && (bT == null || L > bT)) bT = L;
      if (d.o < L && d.h >= L && (sT == null || L < sT)) sT = L;
    }
    if (bR != null) ev.rej.push({ s: 1, L: bR });
    if (sR != null) ev.rej.push({ s: -1, L: sR });
    if (bT != null) ev.touch.push({ s: 1, L: bT, rejected: bLo > bT });
    if (sT != null) ev.touch.push({ s: -1, L: sT, rejected: bHi < sT });
    out.push(ev);
    for (const v of act) {
      if (v.i + 2 > j) continue;
      if (v.L >= bLo && v.L <= bHi) v.fresh = true;
      else if (v.L >= d.l && v.L <= d.h) { if (v.fresh) { v.uses++; v.fresh = false; } }
    }
    if (j >= 1) act.push({ i: j - 1, L: D[j - 1].c, fresh: true, uses: 0 });
  }
  return out;
}

// ---- the approach gap and its break ------------------------------------------------------------------------------------
// Gaps of the approach colour whose pair ends in [h - gapWin + 1, h], beyond L; newest first.
export function approachGaps(H4, h, s, L) {
  const out = [];
  for (let q = h; q >= Math.max(1, h - P.gapWin + 1); q--) {
    const a = H4[q - 1], b = H4[q];
    const col = (x) => (x.c > x.o ? 1 : x.c < x.o ? -1 : 0);
    if (col(a) !== -s || col(b) !== -s) continue;
    const G = a.c; if (!(s * (G - L) > 0)) continue;
    out.push({ p: q - 1, G });
  }
  return out;
}
// first H4 index k >= max(h, p + 2) closing beyond G, closed by `until`; strict: nothing traded to G before it
export function breakOf(H4, h, g, s, until, strict) {
  for (let k = g.p + 2; k < H4.length && H4[k].e <= until; k++) {
    const b = H4[k];
    if (k >= h && s * (b.c - g.G) > 0) return k;
    if (strict && (s > 0 ? b.h >= g.G : b.l <= g.G)) return -1;
  }
  return -1;
}
function extreme(M5, ti, P0, s) { // lowest low (highest high) of 5m candles from the touch candle to those closed by P0
  let x = s > 0 ? Infinity : -Infinity;
  for (let i = ti; i < M5.length && M5[i].e <= P0; i++) x = s > 0 ? Math.min(x, M5[i].l) : Math.max(x, M5[i].h);
  return x;
}
function touchIdx(M5, d, s, L) {
  for (let i = lb(M5, d.t); i < M5.length && M5[i].e <= d.e; i++) if (s > 0 ? M5[i].l <= L : M5[i].h >= L) return i;
  return -1;
}

// ---- orders --------------------------------------------------------------------------------------------------------------
// version 't1' | 't2' | 'c'. An order: { v, s, j, day, L, G, P (placement), entry, stop, expire, ti, label? }.
// T2 re-entries are made in simulateAll (they depend on exits).
export function buildOrders(F, cost, version) {
  const { M5, D, H4 } = F; const E = dailyEvents(D); const out = [];
  const exp = version === 't2' ? P.expT2 : P.expT1;
  for (let j = 0; j + exp < D.length; j++) {
    const list = version === 'c' ? E[j].touch : E[j].rej;
    for (const ev of list) {
      const { s, L } = ev; const ti = touchIdx(M5, D[j], s, L); if (ti < 0) continue;
      const h = K.barAt(H4, M5[ti].t); if (h < 1) continue;
      let gaps = approachGaps(H4, h, s, L); if (!gaps.length) continue;
      if (version !== 't2') gaps = gaps.slice(0, 1);
      for (const g of gaps) {
        const until = version === 'c' ? D[j].e - 1 : D[j + 1].e;
        const k = breakOf(H4, h, g, s, until, version !== 't2'); if (k < 0) continue;
        const P0 = version === 'c' ? H4[k].e : Math.max(D[j].e, H4[k].e);
        const x = extreme(M5, ti, P0, s); if (!Number.isFinite(x)) continue;
        const stop = x - s * cost / 2, entry = g.G;
        if (!(s * (entry - stop) >= 2 * cost)) continue;
        out.push({ v: version, s, j, day: D[j].date, L, G: g.G, p: g.p, P: P0, entry, stop, expire: D[j + exp].e, ti,
          ...(version === 'c' ? { rejected: ev.rejected } : {}) });
      }
    }
  }
  return out;
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
function sim(M5, o, P0, stop, rr, cost) {
  const risk = o.s * (o.entry - stop);
  return K.simulate({ side: o.s, entry: o.entry, stop, target: o.entry + o.s * rr * risk, t: P0, type: 'limit', expire: o.expire, maxHold: P.hold }, M5, { cost });
}
// every order -> trades { market, v, s, day, t (fill), exitT, R (2R), Rnet, Rnet2, R1, R3, R4 (net), risk, rejected? }
export function simulateAll(F, orders, cost, market, X = []) {
  const { M5 } = F; const out = [];
  for (const o of orders) {
    let P0 = o.P, stop = o.stop, guard = 0;
    while (P0 < o.expire && guard++ < 50) {
      const r = sim(M5, o, P0, stop, P.rr, cost);
      if (r.status === 'nofill' || r.status === 'bad' || r.status === 'open') break;
      if (!(o.s * (r.fill - stop) > 0) && r.reason !== 'stop') break;
      const net = (rr) => { const q = sim(M5, o, P0, stop, rr, cost); return q.Rnet ?? null; };
      if (r.fillT >= START && !(X.length && inBad(X, r.fillT))) {
        out.push({ market, v: o.v, s: o.s, day: o.day, t: r.fillT, exitT: r.exitT, reason: r.reason, risk: r.risk, R: r.R, Rnet: r.Rnet,
          Rnet2: r.R - (2 * cost) / r.risk, R1: net(1), R3: net(3), R4: net(4), ...(o.rejected != null ? { rejected: o.rejected } : {}) });
      }
      if (o.v !== 't2' || r.reason === 'stop') break;
      // T2: the next retest of the same gap, placed at the exit, the stop again beyond the extreme since the touch
      const np = r.exitT; if (!(np > P0)) break;
      const x = extreme(M5, o.ti, np, o.s); const ns = x - o.s * cost / 2;
      if (!(o.s * (o.entry - ns) >= 2 * cost)) break;
      P0 = np; stop = ns;
    }
  }
  return out;
}

// ---- statistics -----------------------------------------------------------------------------------------------------
const p1 = (t, df) => { const p = K.pFromT(t, df); if (p == null) return 1; return t > 0 ? p / 2 : 1 - p / 2; };
const r4 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(4));
export function summary(trades, key = 'Rnet') {
  const st = K.stats(trades.filter((x) => Number.isFinite(x[key])), { key, time: 't' });
  const pf = (arr) => { let w = 0, l = 0; for (const x of arr) { if (x[key] > 0) w += x[key]; else l -= x[key]; } return l > 0 ? +(w / l).toFixed(3) : null; };
  const part = (s, arr) => ({ n: s.n, meanR: r4(s.meanR), total: r4(s.total), win: s.n ? +(s.wins / s.n).toFixed(3) : null, pf: pf(arr),
    tMonth: s.tMonth == null ? null : +s.tMonth.toFixed(2), months: s.months, maxDD: r4(s.maxDD) });
  const isA = trades.filter((x) => x.t < SPLIT), oosA = trades.filter((x) => x.t >= SPLIT);
  return { all: part(st, trades), IS: part(st.IS, isA), OOS: part(st.OOS, oosA) };
}
export function judge(T) { // T: { t1: trades, t2: trades }
  const tests = ['t1', 't2'].map((k) => {
    const s = summary(T[k]); const s2 = summary(T[k], 'Rnet2');
    const p = p1(s.OOS.tMonth ?? 0, (s.OOS.months || 2) - 1);
    return { k, ...s, oos2c: s2.OOS.meanR, pOne: p };
  });
  const adj = K.holm(tests.map((x) => x.pOne));
  tests.forEach((x, i) => {
    x.holm = +adj[i].toPrecision(3);
    x.checks = { isN: x.IS.n >= 100, isMean: x.IS.meanR > 0, isT: x.IS.tMonth >= 2, oosN: x.OOS.n >= 50, oosMean: x.OOS.meanR > 0,
      oosT: x.OOS.tMonth >= 2, holm: x.holm < 0.05, cost2: x.oos2c > 0 };
    x.pass = Object.values(x.checks).every(Boolean);
    x.onlyN = !x.pass && Object.entries(x.checks).every(([c, v]) => v || c === 'isN' || c === 'oosN');
  });
  const verdict = tests.some((x) => x.pass) ? 'PASS' : tests.some((x) => x.onlyN) ? 'INCONCLUSIVE' : 'FAIL';
  return { verdict, tests };
}

// ---- the cut test (no look-ahead) -------------------------------------------------------------------------------------
export function cutCheck(M5, cost, cutT) {
  const full = framesOf(M5), cut = framesOf(M5.filter((b) => b.e <= cutT));
  const key = (o) => [o.v, o.s, o.day, o.P, o.entry, o.stop, o.expire].join('|');
  const res = {};
  for (const v of ['t1', 't2', 'c']) {
    const a = buildOrders(full, cost, v).filter((o) => o.expire <= cutT).map(key);
    const b = buildOrders(cut, cost, v).filter((o) => o.expire <= cutT).map(key);
    res[v] = { n: a.length, same: a.length === b.length && a.every((x, i) => x === b[i]) };
  }
  return res;
}

// ---- run ----------------------------------------------------------------------------------------------------------------
function runAll(outDir) {
  const T = { t1: [], t2: [], c: [] }; const meta = {};
  let cut = null;
  for (const m of MARKETS) {
    const t0 = Date.now();
    const M5 = K.load(m, '5m', { from: '2019-01-01' }); const F = framesOf(M5); const cost = COSTS[m]; const X = exclusions(m);
    if (m === 'xau') cut = cutCheck(M5, cost, Date.UTC(2023, 5, 1) / 1000);
    const n = {};
    for (const v of ['t1', 't2', 'c']) { const O = buildOrders(F, cost, v); const tr = simulateAll(F, O, cost, m, X); T[v].push(...tr); n[v] = { orders: O.length, trades: tr.length }; }
    meta[m] = { first: new Date(M5[0].t * 1000).toISOString().slice(0, 10), last: new Date(F.end * 1000).toISOString(), days: F.D.length, cost, excluded: X.length, ...n };
    process.stderr.write(`${m}: t1 ${n.t1.trades} t2 ${n.t2.trades} c ${n.c.trades} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
  }
  if (outDir) { fs.mkdirSync(outDir, { recursive: true }); fs.writeFileSync(path.join(outDir, 'trades.json'), JSON.stringify(T)); }
  const J = judge(T);
  const desc = (arr) => ({ R1: summary(arr, 'R1'), R3: summary(arr, 'R3'), R4: summary(arr, 'R4') });
  const per = {}; for (const m of MARKETS) per[m] = { t1: summary(T.t1.filter((x) => x.market === m)).all, t2: summary(T.t2.filter((x) => x.market === m)).all };
  const gold = { t1: summary(T.t1.filter((x) => x.market === 'xau')), t2: summary(T.t2.filter((x) => x.market === 'xau')), c: summary(T.c.filter((x) => x.market === 'xau')) };
  const control = { all: summary(T.c), rejectionDays: summary(T.c.filter((x) => x.rejected)), otherDays: summary(T.c.filter((x) => !x.rejected)) };
  const t1 = J.tests[0], t2 = J.tests[1];
  const f = (x) => `n ${x.OOS.n}, ${x.OOS.meanR >= 0 ? '+' : ''}${x.OOS.meanR}R a trade after costs, month t ${x.OOS.tMonth}`;
  const headline = `${J.verdict === 'PASS' ? 'PASS' : J.verdict === 'FAIL' ? 'FAIL, 0 of 2' : 'INCONCLUSIVE'}: confirmation 2024-now T1 ${f(t1)}; T2 ${f(t2)} (18 markets pooled).`;
  const result = { topic: 'decision-level-2020', built: new Date().toISOString().slice(0, 10), verdict: J.verdict, headline,
    rule: 'Daily rejection of a fresh Daily key level, known at the Daily close; the newest H4 approach gap broken; a limit on its retest after the close; stop beyond the reversal extreme; 2R.',
    params: P, tests: J.tests, descriptive: { t1: desc(T.t1), t2: desc(T.t2) }, gold, control, perMarket: per, markets: meta, cutCheck: cut,
    stopsOnLosingSide: true };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(result, null, 1) + '\n');
  console.log(JSON.stringify({ verdict: J.verdict, headline, cut }, null, 1));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'run') runAll(dir);
  else console.log('usage: run.mjs run [outDir]');
}
