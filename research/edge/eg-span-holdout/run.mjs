// research/edge/eg-span-holdout/run.mjs - the next-candle engulf against the three-candle engulf on 2010-2019 (PREREGISTRATION.md).
// node research/edge/eg-span-holdout/run.mjs market <m> <outDir>   (one market, all years; EDGE_DATA = the candle cache)
// node research/edge/eg-span-holdout/run.mjs report <outDir>        (the tests, result.json beside this file)
// council/eg-methods.mjs is imported and never edited; its RR table is set for a run and put back after it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { methodTrades, RR, stopSize, outcome } from '../../../council/eg-methods.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const YEARS = [2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019];
export const SPLIT = Date.UTC(2015, 0, 1) / 1000;
export const DESK_RR = { 'eg-plan': 1, 'eg-plan-n': 1, 'eg-simple': 1, 'eg-simple-n': 4 };   // the desk's targets on 23 Nov 2026 (a test compares with RR)
export const KINDS = ['eg-plan', 'eg-simple', 'eg-plan-n', 'eg-simple-n'];
const ys = (y, m = 0, d = 1) => Date.UTC(y, m, d) / 1000;

// edgekit candles -> the method's shape
const conv = (a) => a.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));
export function frames(M5, D1) {
  return { '5m': conv(M5), '15m': conv(K.resample(M5, 900)), '1h': conv(K.resample(M5, 3600)), '4h': conv(K.resample(M5, 14400)), '1d': conv(D1) };
}
// one run of the method on candles B with a target table: plan / short-method trades only
export function runOnce(B, { market, from, span, target }) {
  const keep = { ...RR };
  try {
    if (target === 'desk') Object.assign(RR, DESK_RR); else for (const k of KINDS) RR[k] = target;
    return methodTrades(B, { from, market, span }).filter((r) => KINDS.includes(r.kind));
  } finally { for (const k of Object.keys(RR)) delete RR[k]; Object.assign(RR, keep); }
}
// the flipped-side placebo of a trade: same fill candle, entry, stop distance and target in R, opposite side
export function placebo(r, M5) {
  const fi = M5.findIndex((b) => b.time === r.t); if (fi < 0) return null;
  const d = -r.side, rr = r.target == null ? null : Math.abs(r.target - r.entry) / r.r0;
  const stop = r.entry - d * r.r0, target = r.entry + d * rr * r.r0, o = outcome(M5, fi, d, r.entry, stop, target, Infinity);
  return o.status === 'open' ? null : { R: o.R, endT: o.endT, status: o.status };
}
const inBad = (X, a, b) => X.some(([x, y]) => x <= b && y >= a);

// one market: every year x span x target; trades written to <out>/<market>.json
export function runMarket(market, outDir) {
  const X = exclusions(market), cost = COSTS[market], rows = [], skipped = { open: 0, excluded: 0 };
  for (const y of YEARS) {
    const M5 = K.load(market, '5m', { from: ys(y - 1, 10), to: ys(y + 1, 2) }), D1 = K.load(market, '1d', { from: ys(y - 1), to: ys(y + 1, 2) });
    const B = frames(M5, D1), from = ys(y), to = ys(y + 1);
    for (const span of ['next', 'any']) for (const target of ['desk', 2]) {
      const T = runOnce(B, { market, from, span, target });
      for (const r of T) { if (r.t >= to) continue;
        if (r.status === 'open' || r.R == null) { skipped.open++; continue; }
        if (inBad(X, r.t, r.endT)) { skipped.excluded++; continue; }
        const p = placebo(r, B['5m']), c = cost / r.r0;
        rows.push({ market, span, target, kind: r.kind, side: r.side, t: r.t, endT: r.endT, R: +r.R.toFixed(5), Rnet: +(r.R - c).toFixed(5), status: r.status,
          pR: p ? +p.R.toFixed(5) : null, pRnet: p ? +(p.R - c).toFixed(5) : null }); }
    }
    console.error(market, y, rows.length);
  }
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, market + '.json'), JSON.stringify({ market, skipped, rows }));
  return { market, skipped, n: rows.length };
}

// ---- statistics ----------------------------------------------------------------------------------------------------
const mom = (xs) => { const n = xs.length; if (!n) return { n: 0, mean: null, sd: null };
  const m = xs.reduce((a, b) => a + b, 0) / n, sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : null; return { n, mean: m, sd }; };
// t of calendar-month sums over every month of the half (empty months 0)
export function monthT(rows, key, a, b) {
  const sums = new Map(); for (let y = new Date(a * 1000).getUTCFullYear(); ys(y) < b; y++) for (let m = 0; m < 12; m++) if (ys(y, m) >= a && ys(y, m) < b) sums.set(`${y}-${m}`, 0);
  for (const r of rows) { const d = new Date(r.t * 1000), k = `${d.getUTCFullYear()}-${d.getUTCMonth()}`; if (sums.has(k)) sums.set(k, sums.get(k) + r[key]); }
  const s = mom([...sums.values()]); return s.sd > 0 ? s.mean / (s.sd / Math.sqrt(s.n)) : null;
}
export function welch(a, b) { const A = mom(a), B = mom(b); if (A.n < 2 || B.n < 2) return { diff: null, t: null, df: null };
  const va = A.sd ** 2 / A.n, vb = B.sd ** 2 / B.n, se = Math.sqrt(va + vb), df = (va + vb) ** 2 / (va ** 2 / (A.n - 1) + vb ** 2 / (B.n - 1));
  return { diff: A.mean - B.mean, t: se > 0 ? (A.mean - B.mean) / se : null, df }; }
const oneSided = (t, df) => (t == null ? 1 : t > 0 ? K.pFromT(t, df) / 2 : 1 - K.pFromT(t, df) / 2);
const r4 = (v) => (v == null ? null : +v.toFixed(4)), r2 = (v) => (v == null ? null : +v.toFixed(2));
export function summ(rows, a, b) {
  const xs = rows.filter((r) => r.t >= a && r.t < b), R = mom(xs.map((r) => r.R)), N = mom(xs.map((r) => r.Rnet)), P = xs.filter((r) => r.pR != null);
  const months = Math.round((b - a) / (86400 * 30.44));
  return { n: R.n, meanR: r4(R.mean), tMonth: r2(monthT(xs, 'R', a, b)), months, meanNet: r4(N.mean), tMonthNet: r2(monthT(xs, 'Rnet', a, b)),
    win: R.n ? r4(xs.filter((r) => r.status === 'target').length / R.n) : null,
    placebo: { n: P.length, meanR: r4(mom(P.map((r) => r.pR)).mean), meanNet: r4(mom(P.map((r) => r.pRnet)).mean) },
    vsPlacebo: (() => { const w = welch(P.map((r) => r.R), P.map((r) => r.pR)); return { diff: r4(w.diff), t: r2(w.t), df: w.df }; })() };
}
export const HALVES = { discovery: [ys(2010), SPLIT], confirmation: [SPLIT, ys(2020)], all: [ys(2010), ys(2020)] };

export function report(outDir) {
  const all = []; const skipped = {};
  for (const m of MARKETS) { const f = path.join(outDir, m + '.json'); if (!fs.existsSync(f)) throw new Error('missing ' + f);
    const j = JSON.parse(fs.readFileSync(f, 'utf8')); skipped[m] = j.skipped; all.push(...j.rows); }
  const sel = (o) => all.filter((r) => Object.entries(o).every(([k, v]) => (k === 'kinds' ? v.includes(r.kind) : r[k] === v)));
  const block = (rows) => Object.fromEntries(Object.entries(HALVES).map(([h, [a, b]]) => [h, summ(rows, a, b)]));
  const streams = {};
  for (const target of ['desk', 2]) for (const kind of KINDS) { const key = `${kind}@${target === 'desk' ? 'desk' : '2R'}`, rows = sel({ target, kinds: [kind] });
    streams[key] = { ...block(rows), byMarket: Object.fromEntries(MARKETS.map((m) => [m, block(rows.filter((r) => r.market === m))])) }; }
  const diff = (target) => { const n = sel({ target, span: 'next' }), a = sel({ target, span: 'any' });
    return Object.fromEntries(Object.entries(HALVES).map(([h, [x, y]]) => { const w = welch(n.filter((r) => r.t >= x && r.t < y).map((r) => r.R), a.filter((r) => r.t >= x && r.t < y).map((r) => r.R));
      const wn = welch(n.filter((r) => r.t >= x && r.t < y).map((r) => r.Rnet), a.filter((r) => r.t >= x && r.t < y).map((r) => r.Rnet));
      return [h, { nNext: n.filter((r) => r.t >= x && r.t < y).length, nThree: a.filter((r) => r.t >= x && r.t < y).length, diff: r4(w.diff), t: r2(w.t), df: w.df, diffNet: r4(wn.diff), tNet: r2(wn.t) }]; })); };
  const D2 = diff(2), Dd = diff('desk');
  // T1 / T2 / T3
  const st = (k) => streams[k], ok1 = (s) => s.n >= 100;
  const T = [
    { id: 'T1', what: 'plan, next-candle engulf (eg-plan-n), desk target 1R', s: st('eg-plan-n@desk') },
    { id: 'T2', what: 'short method, next-candle engulf (eg-simple-n), desk target 4R', s: st('eg-simple-n@desk') }];
  const tests = T.map(({ id, what, s }) => { const d = s.discovery, c = s.confirmation, months = c.months;
    const cond = d.meanR > 0 && d.tMonth >= 2 && c.meanR > 0 && c.tMonth >= 2 && c.vsPlacebo.diff > 0 && c.vsPlacebo.t >= 2;
    return { id, what, discovery: { n: d.n, meanR: d.meanR, tMonth: d.tMonth, meanNet: d.meanNet, tMonthNet: d.tMonthNet }, confirmation: { n: c.n, meanR: c.meanR, tMonth: c.tMonth, meanNet: c.meanNet, tMonthNet: c.tMonthNet },
      placeboConfirmation: { meanR: c.placebo.meanR, vsDiff: c.vsPlacebo.diff, vsT: c.vsPlacebo.t }, enough: ok1(d) && ok1(c), conditions: cond, p: oneSided(c.tMonth, months - 1) }; });
  { const d = D2.discovery, c = D2.confirmation;
    tests.push({ id: 'T3', what: 'next-candle minus three-candle, plan + short method, common 2R, pooled', discovery: d, confirmation: c,
      enough: Math.min(d.nNext, d.nThree, c.nNext, c.nThree) >= 100, conditions: d.diff > 0 && d.t >= 2 && c.diff > 0 && c.t >= 2, p: oneSided(c.t, c.df) }); }
  const H = K.holm(tests.map((x) => x.p)); tests.forEach((x, i) => { x.holm = r4(H[i]); x.p = r4(x.p); x.pass = x.enough && x.conditions && H[i] < 0.05; });
  const verdict = tests.some((x) => x.pass) ? 'PASS' : tests.some((x) => !x.enough) && !tests.some((x) => x.enough && x.conditions) ? 'INCONCLUSIVE' : 'FAIL';
  const passed = tests.filter((x) => x.pass).length, t1 = tests[0], t2 = tests[1], t3 = tests[2];
  const headline = `${passed} of 3. Before costs in 2015-2019: plan next-candle ${fmt(t1.confirmation.meanR)}R a trade (n ${t1.confirmation.n}, month t ${t1.confirmation.tMonth}), `
    + `short method next-candle ${fmt(t2.confirmation.meanR)}R (n ${t2.confirmation.n}, t ${t2.confirmation.tMonth}); next-candle minus three-candle at 2R ${fmt(t3.confirmation.diff)}R (Welch t ${t3.confirmation.t}).`;
  const out = { topic: 'eg-span-holdout', title: 'Next-candle engulf against the three-candle engulf, 2010-2019', built: new Date().toISOString().slice(0, 10), verdict, headline,
    basis: 'before costs (after costs beside)', markets: MARKETS, years: '2010-2019', halves: { discovery: '2010-2014', confirmation: '2015-2019' }, deskRR: DESK_RR,
    tests, streams, diff: { at2R: D2, deskTargets: Dd }, skipped };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  return out;
}
const fmt = (v) => (v == null ? 'n/a' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') console.log(JSON.stringify(runMarket(a, b)));
  else if (cmd === 'report') { const R = report(a); console.log(JSON.stringify({ verdict: R.verdict, headline: R.headline, tests: R.tests.map(({ id, pass, holm, conditions, enough }) => ({ id, pass, holm, conditions, enough })) }, null, 1)); }
  else console.log('usage: run.mjs market <m> <outDir> | report <outDir>');
}
