// research/edge/zone-use-count-2020/run.mjs - does an engulf zone react less with each touch? (PREREGISTRATION.md, 23 Nov 2026)
// node research/edge/zone-use-count-2020/run.mjs market <market> <outDir>   one market: every touch of every EG / EF zone, one trade each
// node research/edge/zone-use-count-2020/run.mjs cut <market> <outDir>      the cut test on real candles
// node research/edge/zone-use-count-2020/run.mjs report <outDir>            pool, the four difference tests, the bar, write result.json
// Research only: imports the combo grid's zones and fill engine (not edited); writes only to <outDir> and its own folder.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { buildZones, multi, mstat, MONTHS, NM, IS_M, START, SPLIT } from '../combo-grid/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS18 = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy', 'xag',
  'gbpjpy', 'eurgbp', 'audjpy', 'cadjpy', 'euraud', 'nas100', 'spx500', 'de40'];
export const KINDS = ['eg', 'ef'];
export const TFS = [['4h', '1h', 5 * 86400], ['1h', '15m', 2 * 86400]]; // zone timeframe, touch timeframe, time limit
const SEC = { '15m': 900, '1h': 3600, '4h': 14400 };
const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };

// The 2R trade with the same fill rules as multi, except that a 5-minute candle that reaches the limit is a fill even when it
// also closes past the stop (multi cancels the order then). Sensitivity check only; returns { t, risk, R } like multi.
export function sim2R(M5, s, entry, stop, t0, expire, cap) {
  let lo = 0, hi = M5.length; while (lo < hi) { const m = (lo + hi) >> 1; if (M5[m].t < t0) lo = m + 1; else hi = m; }
  let i = lo, fill = null;
  for (; i < M5.length; i++) { const b = M5[i]; if (b.t >= expire) return null;
    if (s > 0 ? b.l <= entry : b.h >= entry) { fill = s > 0 ? Math.min(b.o, entry) : Math.max(b.o, entry); break; }
    if (s > 0 ? b.c < stop : b.c > stop) return null; }
  if (fill == null) return null;
  const plan = s * (entry - stop);
  if (s * (fill - stop) <= 0) return { t: M5[i].t, risk: plan, R: 0 };    // gapped past the stop: in and out at the open
  const risk = s * (fill - stop), tgt = fill + s * 2 * risk, deadline = M5[i].t + cap;
  for (let j = i; j < M5.length; j++) { const b = M5[j];
    if (j > i) { if (s * (b.o - stop) <= 0) return { t: M5[i].t, risk, R: (s * (b.o - fill)) / risk };
      if (s * (b.o - tgt) >= 0) return { t: M5[i].t, risk, R: (s * (b.o - fill)) / risk }; }
    if (s * ((s > 0 ? b.l : b.h) - stop) <= 0) return { t: M5[i].t, risk, R: -1 };
    if (j > i && s * ((s > 0 ? b.h : b.l) - tgt) >= 0) return { t: M5[i].t, risk, R: 2 };
    if (b.e >= deadline) return { t: M5[i].t, risk, R: (s * (b.c - fill)) / risk };
  }
  return null;
}

// Every touch of every zone of one market. Rows: [kind 0 eg / 1 ef, tf 0 H4 / 1 H1, touch, fill t, R 2R gross (multi),
// cost/risk, excluded 0/1, R gross of sim2R or NaN, cost/risk of sim2R]. Rows of a dropped multi trade keep R = NaN.
export function touchTrades(M5, cost, { excl = [], start = START } = {}) {
  const F = { '15m': K.resample(M5, 900), '1h': K.resample(M5, 3600), '4h': K.resample(M5, 14400) };
  const rows = [], info = { zones: 0, touches: 0, smallRisk: 0, noFill: 0, tinyFill: 0, excluded: 0 };
  KINDS.forEach((kind, ki) => TFS.forEach(([tfL, tfT, cap], ti) => {
    const L = F[tfL], T = F[tfT], buf = cost / 2;
    for (const z of buildZones(kind, L)) {
      info.zones++;
      const over = (b) => b.l <= z.top && b.h >= z.bot;
      let k = K.closedCount(T, z.at); while (k < T.length && T[k].t < z.at) k++;
      let touch = 0;
      while (k < T.length && T[k].t < z.end) {
        while (k < T.length && T[k].t < z.end && !over(T[k])) k++;
        if (k >= T.length || T[k].t >= z.end) break;
        touch++; info.touches++; const k0 = k;
        while (k < T.length && T[k].t < z.end && over(T[k])) k++;
        const expire = k < T.length ? T[k].e : Infinity;  // the touch ends at the close of the first candle wholly outside
        k++;
        if (T[k0].e + cap < start - 10 * 86400) continue;  // long before the window: not traded
        const d = z.d, entry = d > 0 ? z.top : z.bot, stop = d > 0 ? z.bot - buf : z.top + buf;
        if (!(d * (entry - stop) >= 2 * cost)) { info.smallRisk++; continue; }
        const r = multi(M5, d, entry, stop, 'lim', T[k0].t, expire, 2, cap);
        const f = sim2R(M5, d, entry, stop, T[k0].t, expire, cap);
        const ft = r ? r.t : f ? f.t : null; if (ft == null || ft < start) { if (ft == null) info.noFill++; continue; }
        let R = NaN, cr = NaN; if (r) { if (r.risk < cost) info.tinyFill++; else { R = r.R[1]; cr = cost / r.risk; } }
        const ex = inBad(excl, ft) ? 1 : 0; if (ex) info.excluded++;
        rows.push([ki, ti, touch, ft, R, cr, ex, f && f.risk >= cost ? f.R : NaN, f && f.risk >= cost ? cost / f.risk : NaN]);
      }
    }
  }));
  rows.sort((a, b) => a[3] - b[3] || a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[4] - b[4]);
  return { rows, info };
}

export function runMarket(market, { from = '2019-03-01', to } = {}) {
  const M5 = K.load(market, '5m', { from, to });
  const out = touchTrades(M5, COSTS[market], { excl: exclusions(market) });
  return { ...out, bars: M5.length, last: M5[M5.length - 1].t, excl: exclusions(market).length };
}

// ---- statistics ---------------------------------------------------------------------------------------------------------
const mIdx = (t) => { let lo = 0, hi = NM; while (lo < hi) { const m = (lo + hi) >> 1; if (MONTHS[m] <= t) lo = m + 1; else hi = m; } return lo - 1; };
function mom(xs) { const n = xs.length; if (!n) return { n: 0, mean: null, v: null }; let s = 0; for (const x of xs) s += x; const mean = s / n;
  let q = 0; for (const x of xs) q += (x - mean) ** 2; return { n, mean, v: n > 1 ? q / (n - 1) : null }; }
export function welch(a, b) {
  const A = mom(a), B = mom(b); if (A.n < 2 || B.n < 2) return { diff: null, t: null, df: null, p: null, nA: A.n, nB: B.n };
  const sa = A.v / A.n, sb = B.v / B.n, se = Math.sqrt(sa + sb), t = (A.mean - B.mean) / se;
  const df = (sa + sb) ** 2 / (sa * sa / (A.n - 1) + sb * sb / (B.n - 1));
  return { diff: A.mean - B.mean, t, df, p: K.pFromT(t, df), nA: A.n, nB: B.n, meanA: A.mean, meanB: B.mean };
}
// group summary over trades [{ t, Rg, cr }]: n, win rate, mean before / after costs, month-sum t in each half, 2x cost
export function group(tr) {
  const ms = new Float64Array(NM); let nI = 0, nO = 0, sI = 0, sO = 0, c2O = 0, gI = 0, gO = 0, wins = 0;
  for (const x of tr) { const m = mIdx(x.t); if (m < 0) continue; const rn = x.Rg - x.cr; ms[m] += rn; if (x.Rg > 0) wins++;
    if (x.t < SPLIT) { nI++; sI += rn; gI += x.Rg; } else { nO++; sO += rn; gO += x.Rg; c2O += x.cr; } }
  const a = mstat(ms, 0, IS_M), b = mstat(ms, IS_M, NM), all = mstat(ms, 0, NM), n = nI + nO;
  const r4 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(4)), r2 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(2));
  return { n, win: n ? r4(wins / n) : null, mean: n ? r4((sI + sO) / n) : null, meanGross: n ? r4((gI + gO) / n) : null, tMonth: r2(all.t),
    disc: { n: nI, mean: nI ? r4(sI / nI) : null, meanGross: nI ? r4(gI / nI) : null, tMonth: r2(a.t) },
    conf: { n: nO, mean: nO ? r4(sO / nO) : null, meanGross: nO ? r4(gO / nO) : null, tMonth: r2(b.t), mean2c: nO ? r4((sO - c2O) / nO) : null } };
}

export const GROUPS = { g1: (n) => n === 1, g23: (n) => n === 2 || n === 3, g4: (n) => n >= 4 };
export const TOUCHES = [1, 2, 3, 4, 5, 6]; // 6 = 6+

export function analyse(trades) {
  // trades: [{ kind, tf, touch, t, Rg, cr, market }] (already filtered: scored, not excluded)
  const by = (kind, f, extra = () => true) => trades.filter((x) => x.kind === kind && f(x.touch) && extra(x));
  const tests = [], r4 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(4)), r2 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(2));
  for (const kind of KINDS) for (const [id, a, b] of [['T1', 'g1', 'g23'], ['T2', 'g23', 'g4']]) {
    const A = by(kind, GROUPS[a]), B = by(kind, GROUPS[b]), net = (xs) => xs.map((x) => x.Rg - x.cr), gross = (xs) => xs.map((x) => x.Rg);
    const half = (h) => { const f = (x) => (h ? x.t >= SPLIT : x.t < SPLIT); return welch(net(A.filter(f)), net(B.filter(f))); };
    const w = welch(net(A), net(B)), wg = welch(gross(A), gross(B)), d = half(0), c = half(1);
    tests.push({ id: `${id}-${kind.toUpperCase()}`, kind, a, b, nA: w.nA, nB: w.nB, meanA: r4(w.meanA), meanB: r4(w.meanB), diff: r4(w.diff), t: r2(w.t), df: Math.round(w.df ?? 0), p: w.p,
      diffGross: r4(wg.diff), tGross: r2(wg.t), disc: { diff: r4(d.diff), t: r2(d.t), nA: d.nA, nB: d.nB }, conf: { diff: r4(c.diff), t: r2(c.t), nA: c.nA, nB: c.nB } });
  }
  const adj = K.holm(tests.map((x) => x.p));
  tests.forEach((x, i) => { x.holm = +adj[i].toPrecision(3); x.p = +x.p.toPrecision(3);
    x.sameSign = x.disc.diff != null && x.conf.diff != null && Math.sign(x.disc.diff) === Math.sign(x.conf.diff);
    x.holds = x.holm < 0.05 && x.sameSign; x.weakens = x.holds && x.diff > 0; });
  // the bar for the six groups
  const bar = [];
  for (const kind of KINDS) for (const g of Object.keys(GROUPS)) { const s = group(by(kind, GROUPS[g])); bar.push({ id: `${kind}-${g}`, kind, g, ...s }); }
  const p1 = (t, df) => { if (t == null) return 1; const p = K.pFromT(t, df); return t > 0 ? p / 2 : 1 - p / 2; };
  const badj = K.holm(bar.map((x) => p1(x.conf.tMonth, NM - IS_M - 1)));
  bar.forEach((x, i) => { x.holm = +badj[i].toPrecision(3);
    x.pass = x.disc.n >= 100 && x.disc.mean > 0 && x.disc.tMonth >= 2 && x.conf.n >= 50 && x.conf.mean > 0 && x.conf.tMonth >= 2 && x.holm < 0.05 && x.conf.mean2c > 0; });
  // descriptive: each touch number, by zone timeframe, by market
  const byTouch = {}, byTf = {}, byMarket = {};
  for (const kind of KINDS) {
    byTouch[kind] = TOUCHES.map((n) => ({ touch: n === 6 ? '6+' : String(n), ...group(by(kind, (x) => (n === 6 ? x >= 6 : x === n))) }));
    byTf[kind] = {}; for (const [tf, ti] of [['4h', 0], ['1h', 1]]) byTf[kind][tf] = Object.fromEntries(Object.keys(GROUPS).map((g) => [g, group(by(kind, GROUPS[g], (x) => x.tf === ti))]));
    byMarket[kind] = {}; for (const m of [...new Set(trades.map((x) => x.market))]) byMarket[kind][m] = Object.fromEntries(Object.keys(GROUPS).map((g) => {
      const s = group(by(kind, GROUPS[g], (x) => x.market === m)); return [g, { n: s.n, mean: s.mean, meanGross: s.meanGross }]; }));
  }
  return { tests, bar, byTouch, byTf, byMarket };
}

// ---- files --------------------------------------------------------------------------------------------------------------
function save(dir, market, out) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${market}.json`), JSON.stringify({ market, info: out.info, bars: out.bars, excl: out.excl,
    last: new Date(out.last * 1000).toISOString(), rows: out.rows.map((r) => r.map((x) => (typeof x === 'number' && !Number.isInteger(x) ? +x.toPrecision(7) : x))) }));
}
function cutTest(market, dir) {
  const M5 = K.load(market, '5m', { from: '2019-03-01' }), cost = COSTS[market], cut = Date.UTC(2023, 6, 1) / 1000;
  const full = touchTrades(M5, cost).rows, part = touchTrades(M5.filter((b) => b.e <= cut), cost).rows;
  const done = (r) => r[3] + 5 * 86400 + 86400 < cut, key = (r) => JSON.stringify(r.map((x) => (Number.isNaN(x) ? 'nan' : x)));
  const a = full.filter(done).map(key), b = part.filter(done).map(key), sb = new Set(b);
  const res = { market, cut: '2023-07-01', before: a.length, cutRun: b.length, missing: a.filter((x) => !sb.has(x)).length, equal: a.length === b.length && a.every((x, i) => x === b[i]) };
  fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, `cut-${market}.json`), JSON.stringify(res)); return res;
}
export function report(dir, markets = MARKETS18) {
  const trades = [], fixTrades = [], info = {};
  for (const m of markets) { const J = JSON.parse(fs.readFileSync(path.join(dir, `${m}.json`), 'utf8'));
    info[m] = { ...J.info, bars: J.bars, last: J.last, exclIntervals: J.excl, scored: 0 };
    for (const r of J.rows) { if (r[6]) continue; const [kind, tf, touch, t] = r;
      if (Number.isFinite(r[4])) { trades.push({ market: m, kind: KINDS[kind], tf, touch, t, Rg: r[4], cr: r[5] }); info[m].scored++; }
      if (Number.isFinite(r[7])) fixTrades.push({ market: m, kind: KINDS[kind], tf, touch, t, Rg: r[7], cr: r[8] }); } }
  const A = analyse(trades), FX = analyse(fixTrades);
  const cut = fs.readdirSync(dir).filter((f) => f.startsWith('cut-')).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  const holds = A.tests.filter((x) => x.holds), passes = A.bar.filter((x) => x.pass);
  const verdict = passes.length ? 'PASS' : 'FAIL';
  const t1 = (k) => A.tests.find((x) => x.id === k);
  const g = (k, gg) => A.bar.find((x) => x.id === `${k}-${gg}`);
  const headline = `Use count: ${holds.length} of 4 differences hold (T1-EG touch 1 minus 2-3 ${t1('T1-EG').diff}R, t ${t1('T1-EG').t}; T2-EG ${t1('T2-EG').diff}R, t ${t1('T2-EG').t}; ` +
    `T1-EF ${t1('T1-EF').diff}R, t ${t1('T1-EF').t}; T2-EF ${t1('T2-EF').diff}R, t ${t1('T2-EF').t}). Bar: ${passes.length} of 6 groups pass ` +
    `(EG touch 1 ${g('eg', 'g1').mean}R a trade after costs, n ${g('eg', 'g1').n}, month t ${g('eg', 'g1').tMonth}).`;
  const res = { topic: 'zone-use-count-2020', built: new Date().toISOString().slice(0, 10), verdict, headline, markets, nTrades: trades.length,
    window: { from: '2020-01-01', split: '2024-01-01', last: Object.values(info).map((x) => x.last).sort().pop() },
    tests: A.tests, bar: A.bar, byTouch: A.byTouch, byTf: A.byTf, byMarket: A.byMarket,
    sensitivity: { what: 'a 5-minute candle that reaches the limit and closes past the stop counted as filled (multi cancels it)', nTrades: fixTrades.length,
      tests: FX.tests, byTouch: FX.byTouch, bar: FX.bar.map((x) => ({ id: x.id, n: x.n, mean: x.mean, tMonth: x.tMonth, pass: x.pass })) },
    cut, info };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  return res;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { const t0 = Date.now(); const out = runMarket(a); save(b, a, out); console.log(a, out.rows.length, 'trades', JSON.stringify(out.info), ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') console.log(JSON.stringify(cutTest(a, b)));
  else if (cmd === 'report') { const R = report(a); console.log(R.headline); console.log(JSON.stringify(R.tests, null, 1)); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
