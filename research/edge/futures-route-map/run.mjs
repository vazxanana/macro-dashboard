// Futures route map: re-cost the cost-blocked tests at exchange-futures cost (PREREGISTRATION.md). Offline: reads only
// collected.json beside this file, writes result.json and RESULT.md.   node research/edge/futures-route-map/run.mjs
// Accounting only: no rule is tested, nothing live changes, nothing is called an edge.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ─── section 2: the futures equivalents (fixed in the pre-registration) ───
// kind: 'pt' = price in points, tick in points, pv = currency a point (fee in the same currency);
//       'fxd' = currency future quoted in USD per unit of the pair's base (EUR/USD ...): tick in USD, M = contract size;
//       'fxi' = the pair is USD/XXX and the future is quoted USD per XXX (6J, 6C, 6S): fraction of price = 2 (tick + fee / M) x P;
//       'cnh' = USD/CNH quoted CNH per USD, fee in USD converted at the price.
export const CONTRACTS = {
  spx500: { root: 'MES', kind: 'pt', tick: 0.25, pv: 5, fee: 0.62, src: 'index-futures-cost (#900)' },
  nas100: { root: 'MNQ', kind: 'pt', tick: 0.25, pv: 2, fee: 0.62, src: 'index-futures-cost (#900)' },
  us30: { root: 'MYM', kind: 'pt', tick: 1, pv: 0.5, fee: 0.62, src: 'index-futures-cost (#900)' },
  us2000: { root: 'M2K', kind: 'pt', tick: 0.1, pv: 5, fee: 0.62, src: 'assumed (tick, value); fee #900' },
  de40: { root: 'FDXM', kind: 'pt', tick: 1, pv: 5, fee: 1, src: 'assumed' },
  eu50: { root: 'FESX', kind: 'pt', tick: 1, pv: 10, fee: 1, src: 'assumed' },
  uk100: { root: 'Z (FTSE 100)', kind: 'pt', tick: 0.5, pv: 10, fee: 1, src: 'assumed' },
  jp225: { root: 'Nikkei 225 mini', kind: 'pt', tick: 5, pv: 100, fee: 150, src: 'assumed' },
  xau: { root: 'MGC', kind: 'pt', tick: 0.1, pv: 10, fee: 1.06, src: 'council/futures.mjs (tick, value); gold-carry ($2.12 a round trip)' },
  usb02y: { root: 'ZT', kind: 'pt', tick: 0.00390625, pv: 2000, fee: 1.85, src: '#943 fees; tick from memory (bond-month-end-replicate)' },
  usb05y: { root: 'ZF', kind: 'pt', tick: 0.0078125, pv: 1000, fee: 1.85, src: '#943 fees; tick from memory (bond-month-end-replicate)' },
  usb10y: { root: 'ZN', kind: 'pt', tick: 0.015625, pv: 1000, fee: 1.85, src: 'bond-month-end-futures (#943)' },
  usb30y: { root: 'ZB', kind: 'pt', tick: 0.03125, pv: 1000, fee: 1.85, src: 'bond-month-end-futures (#943)' },
  de10yb: { root: 'FGBL', kind: 'pt', tick: 0.01, pv: 1000, fee: 1.85, src: 'bond-month-end-replicate (tick from memory; fee #943 in EUR, assumed)' },
  uk10yb: { root: 'Long Gilt', kind: 'pt', tick: 0.01, pv: 1000, fee: 1.85, src: 'bond-month-end-replicate (tick from memory; fee #943 in GBP, assumed)' },
  eurusd: { root: '6E', kind: 'fxd', tick: 0.00005, M: 125000, fee: 2.5, src: 'from memory, not opened; fee assumed' },
  gbpusd: { root: '6B', kind: 'fxd', tick: 0.0001, M: 62500, fee: 2.5, src: 'from memory, not opened; fee assumed' },
  audusd: { root: '6A', kind: 'fxd', tick: 0.00005, M: 100000, fee: 2.5, src: 'from memory, not opened; fee assumed' },
  nzdusd: { root: '6N', kind: 'fxd', tick: 0.00005, M: 100000, fee: 2.5, src: 'from memory, not opened; fee assumed' },
  usdcad: { root: '6C', kind: 'fxi', tick: 0.00005, M: 100000, fee: 2.5, src: 'from memory, not opened; fee assumed' },
  usdchf: { root: '6S', kind: 'fxi', tick: 0.00005, M: 125000, fee: 2.5, src: 'from memory, not opened; fee assumed' },
  usdjpy: { root: '6J', kind: 'fxi', tick: 0.0000005, M: 12500000, fee: 2.5, src: 'from memory, not opened; fee assumed' },
  usdcnh: { root: 'CNH (USD/offshore RMB)', kind: 'cnh', tick: 0.0001, M: 100000, fee: 2.5, src: 'from memory, not opened; fee assumed; thin' },
  btc: { root: 'MBT', kind: 'pt', tick: 5, pv: 0.1, fee: 3.35, src: 'assumed (from memory, not opened)' },
  eth: { root: 'MET', kind: 'pt', tick: 0.5, pv: 0.1, fee: 3.35, src: 'assumed (from memory, not opened)' },
};

// the futures round trip as a fraction of price at price P: one tick a side + fee a side, twice (section 2)
export function futFrac(key, P, { feeMult = 1, tickMult = 1 } = {}) {
  const c = CONTRACTS[key];
  if (!c) throw new Error(`no route for ${key}`);
  const tk = c.tick * tickMult, fe = c.fee * feeMult;
  if (c.kind === 'pt') return (2 * (tk + fe / c.pv)) / P;
  if (c.kind === 'fxd') return (2 * (tk + fe / c.M)) / P;
  if (c.kind === 'fxi') return 2 * (tk + fe / c.M) * P;
  if (c.kind === 'cnh') return (2 * (tk + (fe * P) / c.M)) / P;
  throw new Error(`kind ${c.kind}`);
}
// the CFD side's transaction round trip as a fraction of price (the study's own definition, never financing)
export function cfdFrac(def, P) {
  if (def.frac != null) return def.frac + (def.comm || 0);
  if (def.pips != null) return (def.pips * def.pip) / P + (def.comm || 0);
  if (def.pts != null) return def.pts / P + (def.comm || 0);
  throw new Error('cfd cost definition');
}

// ─── statistics ───
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
export function tStat(xs) {
  const n = xs.length; if (n < 2) return null;
  const m = mean(xs), v = xs.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1);
  return v > 0 ? m / Math.sqrt(v / n) : null;
}
const ym = (s) => [+s.slice(0, 4), +s.slice(5, 7)];
export function monthRange(from, to) { const out = []; let [y, m] = ym(from); const [Y, M] = ym(to); while (y < Y || (y === Y && m <= M)) { out.push(`${y}-${String(m).padStart(2, '0')}`); if (++m > 12) { m = 1; y++; } } return out; }
// t on calendar-month sums: over months with a trade (all = null) or over every month of a range
export function monthT(rows, val, all = null) {
  const s = new Map(); for (const r of rows) s.set(r[0], (s.get(r[0]) || 0) + val(r));
  const xs = all ? monthRange(all[0], all[1]).map((k) => s.get(k) || 0) : [...s.values()];
  return { t: tStat(xs), months: xs.length };
}
export function Phi(z) {             // normal CDF (Abramowitz-Stegun 7.1.26 on erf)
  const x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + 0.3275911 * x);
  const e = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + e) : 0.5 * (1 - e);
}
export const pOne = (t) => (t == null ? null : 1 - Phi(t));
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = Array(ps.length); let run = 0;
  idx.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (ps.length - k) * p)); out[i] = run; });
  return out;
}
export function bh(ps) {
  const n = ps.length, idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = Array(n); let run = 1;
  for (let k = n - 1; k >= 0; k--) { const [p, i] = idx[k]; run = Math.min(run, (p * n) / (k + 1)); out[i] = run; }
  return out;
}
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3)), r2 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(2)), r4 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(4));

// ─── section 3: re-cost one test ───
export function recost(T, refs) {
  const R = { pr: T.pr, topic: T.topic, test: T.test, inst: T.inst, insts: T.insts, unit: T.unit, role: T.role, family: T.family, cls: T.cls, route: T.route,
    n: T.n, gross: T.gross, cfdNet: T.net, tCfd: T.tNet, tGross: T.tGross, s: T.s };
  if (T.route === 'none') return { ...R, method: 'no route', why: T.why };
  const P = (k) => refs[T.refs.find((id) => id.startsWith(`${k}|`))].median;
  if (T.route === 'B') {
    if (T.unitPct) {
      const ws = T.insts.map((k) => 100 * futFrac(k, P(k))), fc = mean(ws);
      const fut = T.gross - fc, t = fut / T.s, fut2 = T.gross - 2 * fc;
      return { ...R, method: 'approx (constant cost, % of price)', futCost: r4(fc), futNet: r4(fut), tFut: r2(t), fut2x: r4(fut2), t2x: r2(fut2 / T.s),
        cfdTrans: T.transPct ?? null, weights: T.weights ?? null, transSrc: T.transSrc, perInst: Object.fromEntries(T.insts.map((k, i) => [k, { ref: P(k), futPct: r4(ws[i]) }])) };
    }
    let ratio, fc, perInst = {};
    if (T.perMarket) {           // per-market transaction cost, weighted by n
      let num = 0, den = 0;
      for (const k of T.insts) { const pm = T.perMarket[k], F = futFrac(k, P(k)), C = cfdFrac(T.C[k], P(k)); perInst[k] = { ref: P(k), F: r6(F), C: r6(C), ratio: r3(F / C), n: pm.n, trans: pm.trans }; num += pm.n * pm.trans * (F / C); den += pm.n; }
      fc = num / den; ratio = fc / T.trans;
    } else {
      const rs = T.insts.map((k) => { const F = futFrac(k, P(k)), C = cfdFrac(T.C[k], P(k)); perInst[k] = { ref: P(k), F: r6(F), C: r6(C), ratio: r3(F / C) }; return F / C; });
      ratio = mean(rs); fc = T.trans * ratio;
    }
    const fut = T.gross - fc;
    return { ...R, method: 'approx (constant cost)', cfdTrans: T.trans, transSrc: T.transSrc, ratio: r3(ratio), futCost: r4(fc), futNet: r4(fut), tFut: r2(fut / T.s),
      fut2x: r4(T.gross - 2 * fc), t2x: r2((T.gross - 2 * fc) / T.s), weights: T.weights ?? null, perInst };
  }
  return { ...R, ...perTrade(T, refs) };
}
const r6 = (x) => +(+x).toFixed(6);

// (A) per trade, with the gate (section 3)
function perTrade(T, refs) {
  const Pref = (k) => refs[T.refs.find((id) => id.startsWith(`${k}|`))].median;
  let rows, tf, gate;
  if (T.trades || T.tradesBy) {
    // rows: [month, entry, stop, grossR, cfdNet(, inst)]
    const mk = (r, k) => { const inst = r[5] || k || T.insts[0], risk = Math.abs(r[1] - r[2]); return { m: r[0], g: r[3], c: r[4], f: r[3] - (futFrac(inst, r[1]) * r[1]) / risk, f2: r[3] - (2 * futFrac(inst, r[1]) * r[1]) / risk, fc: (futFrac(inst, r[1]) * r[1]) / risk, inst }; };
    if (T.tradesBy) {                // bond-month-end-replicate: equal-weight monthly pool of the four markets, decisive 2016-01 to 2026-10
      const all = []; for (const [k, ts] of Object.entries(T.tradesBy)) for (const r of ts) if (r[0] >= '2016-01-01' && r[0] <= '2026-10-31') all.push(mk([r[0].slice(0, 7), r[1], r[2], r[3], r[4]], k));
      const by = new Map(); for (const x of all) { if (!by.has(x.m)) by.set(x.m, []); by.get(x.m).push(x); }
      const months = [...by.keys()].sort(), pv = (f) => months.map((m) => mean(by.get(m).map(f)));
      const g = pv((x) => x.g), c = pv((x) => x.c), f = pv((x) => x.f), f2 = pv((x) => x.f2);
      gate = gateOf(T, { n: months.length, gross: mean(g), net: mean(c), t: tStat(c) });
      return { method: 'per trade', tForm: T.tForm, gate, trades: all.length, futCost: r4(mean(all.map((x) => x.fc))), futNet: r4(mean(f)), tFut: r2(tStat(f)), fut2x: r4(mean(f2)), t2x: r2(tStat(f2)),
        theirs: T.theirFutures ? { net: T.theirFutures.x1.decisive.net, t: T.theirFutures.x1.decisive.t, how: 'bond-month-end-replicate\'s own futures row: one tick a ROUND TRIP' } : null };
    }
    rows = T.trades.map((r) => mk(r));
    tf = (val) => T.tForm.startsWith('trade t') ? tStat(rows.map(val)) : monthT(rows.map((x) => [x.m, x]), (r) => val(r[1]), T.monthsFrom ? [T.monthsFrom, T.monthsTo] : null).t;
    gate = gateOf(T, { n: rows.length, gross: mean(rows.map((x) => x.g)), net: mean(rows.map((x) => x.c)), t: tf((x) => x.c) });
    const out = { method: 'per trade', tForm: T.tForm, gate, futCost: r4(mean(rows.map((x) => x.fc))), futNet: r4(mean(rows.map((x) => x.f))), tFut: r2(tf((x) => x.f)), fut2x: r4(mean(rows.map((x) => x.f2))), t2x: r2(tf((x) => x.f2)) };
    if (T.replication) {
      const rr = T.replication.map((r) => mk(r)), tr = T.repMonthsFrom ? [T.repMonthsFrom, T.repMonthsTo] : null;
      out.replication = { n: rr.length, gross: r4(mean(rr.map((x) => x.g))), cfdNet: r4(mean(rr.map((x) => x.c))), futNet: r4(mean(rr.map((x) => x.f))),
        tFut: r2(T.tForm.startsWith('trade t') ? tStat(rr.map((x) => x.f)) : monthT(rr.map((x) => [x.m, x]), (r) => r[1].f, tr).t) };
    }
    if (!gate.pass) return { ...out, ...fallback(T, refs, out) };
    return out;
  }
  // turnaround tuples [month, gross %, net %, net R]: the stop as a fraction of price = net % / 100 / net R
  const tuples = T.tuples ? T.tuples.map((t) => [t, T.insts[0]]) : Object.entries(T.tuplesBy).flatMap(([k, ts]) => ts.map((t) => [t, k]));
  let skipped = 0; rows = [];
  for (const [t, k] of tuples) {
    const sf = t[2] / 100 / t[3];
    if (!Number.isFinite(sf) || sf <= 0 || Math.abs(t[3]) < 0.005) { skipped++; rows.push({ m: t[0], g: null, c: t[3], inst: k }); continue; }
    const g = t[1] / 100 / sf, fc = futFrac(k, Pref(k)) / sf;
    rows.push({ m: t[0], g, c: t[3], f: g - fc, f2: g - 2 * fc, fc, inst: k });
  }
  const ok = rows.filter((x) => x.g != null);
  const tfm = (val, list) => T.tForm.startsWith('trade t') ? tStat(list.map(val)) : monthT(list.map((x) => [x.m, x]), (r) => val(r[1]), ['2016-01', monthRange('2016-01', '2026-11').at(-1)]).t;
  gate = gateOf(T, { n: rows.length, gross: skipped ? null : mean(ok.map((x) => x.g)), net: mean(rows.map((x) => x.c)), t: tfm((x) => x.c, rows) }, skipped);
  const out = { method: 'per trade (stop recovered from net % / net R; futures cost at the window\'s reference price)', tForm: T.tForm, gate, skipped,
    futCost: r4(mean(ok.map((x) => x.fc))), futNet: r4(mean(ok.map((x) => x.f))), tFut: r2(tfm((x) => x.f, ok)), fut2x: r4(mean(ok.map((x) => x.f2))), t2x: r2(tfm((x) => x.f2, ok)) };
  if (!gate.pass) return { ...out, ...fallback(T, refs, out) };
  return out;
}
function gateOf(T, got, skipped = 0) {
  const P = T.published, eq3 = (a, b) => a != null && b != null && Math.abs(a - b) <= 0.0005 + 1e-9;
  const checks = { n: got.n === P.n, gross: eq3(+got.gross?.toFixed(3), +(+P.gross).toFixed(3)), net: eq3(+got.net?.toFixed(3), +(+P.net).toFixed(3)), t: got.t != null && Math.abs(got.t - P.t) <= 0.02 };
  return { pass: Object.values(checks).every(Boolean) && !skipped, checks, got: { n: got.n, gross: r4(got.gross), net: r4(got.net), t: r2(got.t) }, published: P, skipped };
}
// a list that fails its gate falls back to (B): the mean futures cost a trade from the list, constant, t = net / s
function fallback(T, refs, out) {
  const fc = out.futCost, fut = T.gross - fc;
  return { method: `approx (the trade list failed its gate; mean futures cost of the list, constant cost)`, futNet: r4(fut), tFut: r2(fut / T.s), fut2x: r4(T.gross - 2 * fc), t2x: r2((T.gross - 2 * fc) / T.s), listFigures: { futNet: out.futNet, tFut: out.tFut } };
}

// ─── section 4 B: the rest of each study's own bar, for the tests that pass Step A ───
// cost-floor-map's scale rule (its section 3): mean per unit of t
export function scaleOf({ gross, net, tGross, tNet }) {
  if (tGross != null && tNet != null && tGross - tNet >= 0.1) return (gross - net) / (tGross - tNet);
  if (tNet != null && Math.abs(tNet) >= 0.2) return net / tNet;
  if (tGross != null) return gross / tGross;
  return null;
}
// the turnaround tuples [month, gross %, net %, net R]: mean futures cost in R a trade (stop = net % / net R), F at price P
function tupleCost(tuples, key, P) {
  const fs = []; for (const t of tuples) { const sf = t[2] / 100 / t[3]; if (Number.isFinite(sf) && sf > 0 && Math.abs(t[3]) >= 0.005) fs.push(futFrac(key, P) / sf); }
  return fs.length ? mean(fs) : null;
}
// carry a long future pays over the hold, % of price ((r - q) x nights / 365), mean over the window: reported, never judged
export function carryPct(rates, idx, from, to, nights) {
  const xs = rates.DGS2.filter(([d]) => d >= from && d <= to);
  const r = mean(xs.map((x) => x[1])), ys = Object.entries(rates.divYield[idx]).filter(([y]) => +y >= +from.slice(0, 4) && +y <= +to.slice(0, 4)).map((x) => x[1]);
  return ((r - mean(ys)) * nights) / 365;
}
const DIV = { spx500: 'spx', nas100: 'ndx', us30: 'dji' };

function stepB(row, T, J) {
  const C = {}, bd = J.barData, refP = (id) => J.refs[id].median;
  const shift = row.futNet - row.cfdNet;     // change of the decisive mean when the CFD cost is replaced by the futures cost
  const done = (src, extra = {}) => ({ conditions: C, src, pass: Object.values(C).every((v) => v === true), ...extra });
  if (T.ifc) {                                // #900's own futures bar (its carry line included), with this study's no-carry decisive and replication figures
    const c = T.ifc.conditions || {};
    if (T.topic === 'index-ibs') {
      const ch = c.checks;
      C['(a) n >= 100'] = ch.a; C['(b) net > 0'] = row.futNet > 0; C['(c) month t >= 2 and Holm p < 0.05 over T1-T3 (#900)'] = ch.c;
      C['(d) 2005-15 net > 0'] = (row.replication?.futNet ?? -1) > 0; C['(e) above 38 of 40 placebo seeds, re-costed (#900)'] = ch.e;
    } else {
      C['n >= 300 both windows'] = c.n; C['net > 0, month t >= 2 (2016-26)'] = row.futNet > 0 && row.tFut >= 2; C['net > 0 (2005-15)'] = (row.replication?.futNet ?? -1) > 0;
      C['Holm p < 0.05 over T1, T2 (#900)'] = c.holm; C['above the placebo p95, re-costed (#900)'] = c.placebo; C['net > 0 at twice the trading cost'] = row.fut2x > 0;
      C['pooled T1 + T2 condition (#900)'] = !!T.ifc.pooledOk;
    }
    return done('index-futures-cost (#900) conditions, with this study\'s no-carry figures where they differ', { cfdPass: false, cfdPassSrc: `${T.topic} verdict FAIL (published), #900 published on CFD costs: FAIL` });
  }
  if (T.topic === 'gotobi') {
    const G = bd.gotobi, ratioRep = futFrac('usdjpy', refP(G.refRep)) / cfdFrac(G.C, refP(G.refRep));
    const ts = Object.fromEntries(['T1', 'T2', 'T3', 'T4'].map((id) => [id, J._rows.find((r) => r.topic === 'gotobi' && r.test === id).tFut]));
    const H = holm(['T1', 'T2', 'T3', 'T4'].map((id) => pOne(ts[id]))), hp = H[['T1', 'T2', 'T3', 'T4'].indexOf(T.test)];
    const rp = G.tests[T.test].rep, repFut = rp.gross - rp.trans * ratioRep;
    C['net > 0'] = row.futNet > 0; C['month t >= 2'] = row.tFut >= 2; C['2010-15 replication: same sign'] = repFut > 0;
    C['Holm p < 0.05 over T1-T4 (futures p of all four)'] = hp < 0.05; C['above the placebo p95 (38 of 40), shifted by the cost change'] = row.futNet > G.tests[T.test].placeboP95 + shift;
    return done('gotobi result.json (bar, replication, placebo)', { holmP: r4(hp), replicationFutNet: r4(repFut), ratioReplication: r3(ratioRep), cfdPass: G.tests[T.test].pass });
  }
  if (T.topic === 'gotobi-replicate') {
    C['net > 0'] = row.futNet > 0; C['month t >= 1.5 (R2\'s own bar)'] = row.tFut >= bd['gotobi-replicate'].bar.monthT;
    return done('gotobi-replicate bar.r2', { cfdPass: bd['gotobi-replicate'].r2Pass });
  }
  if (T.topic === 'overnight-drift') {
    const O = bd['overnight-drift'], u = O.us30, P = refP(u.ref), fu = u.gross - u.trans * (futFrac('us30', P) / cfdFrac(u.C, P)), tu = fu / u.s;
    const tAll = { nas100: J._rows.find((r) => r.topic === 'overnight-drift' && r.test === 'nas100').tFut, spx500: J._rows.find((r) => r.topic === 'overnight-drift' && r.test === 'spx500').tFut, us30: tu };
    const H = holm(Object.values(tAll).map(pOne)), hp = H[Object.keys(tAll).indexOf(T.test)];
    const F = 100 * futFrac(T.test, refP(T.refs[0])), lg = O.legs[T.test];
    const nightPerH = (lg.night.grossPct - F) / lg.night.hours, dayPerH = (lg.day.grossPct - F) / lg.day.hours;
    C['net > 0, month t >= 2'] = row.futNet > 0 && row.tFut >= 2; C['Holm p < 0.05 over the three indices (futures p; US30 re-costed the same way)'] = hp < 0.05;
    C['overnight beats the cash session per hour held, both legs at futures cost'] = nightPerH > dayPerH;
    return done('overnight-drift pass rule (PREREGISTRATION.md "Pass rule")', { holmP: r4(hp), us30: { futNet: r4(fu), tFut: r2(tu) }, perHour: { night: r6(nightPerH), day: r6(dayPerH) }, cfdPass: O.checks[T.test].pass });
  }
  if (T.topic === 'rsi2-pullback') {
    const M = bd['rsi2-pullback'].markets, fut = {}, tt = {};
    for (const [k, m] of Object.entries(M)) { const F = 100 * futFrac(k, refP(m.ref)); fut[k] = m.gross - F; tt[k] = fut[k] / (m.net / m.tTrades); }
    const H = holm(['spx500', 'nas100', 'us30'].map((k) => pOne(tt[k]))), hp = H[['spx500', 'nas100', 'us30'].indexOf(T.test)], m = M[T.test];
    const tMonths = fut[T.test] / (m.net / m.tMonths);
    C['positive'] = fut[T.test] > 0; C['trade t >= 2'] = tt[T.test] >= 2; C['month t >= 2 (scaled with the mean)'] = tMonths >= 2;
    C['above the placebo p95, shifted by the cost change'] = fut[T.test] > m.placeboP95 + (fut[T.test] - m.net); C['Holm p < 0.05 over the three markets (futures p)'] = hp < 0.05;
    return done('rsi2-pullback RESULT.md "Checks, window B (all five needed)"', { holmP: r4(hp), tMonthsFut: r2(tMonths), carryPct: r4(carryPct(bd.rates, DIV[T.test], '2016-01-01', '2026-11-06', m.nights)), cfdPass: Object.values(m.checks).every(Boolean) });
  }
  if (T.topic === 'vol-spike-rebound') {
    const V = bd['vol-spike-rebound'].holds, h = T.test.startsWith('10') ? '10' : '5';
    const ts = { 5: J._rows.find((r) => r.topic === T.topic && r.test === '5-day hold').tFut, 10: J._rows.find((r) => r.topic === T.topic && r.test === '10-day hold').tFut };
    const H = holm([pOne(ts[5]), pOne(ts[10])]), hp = H[h === '5' ? 0 : 1], A = V[h].A;
    const costAPct = A.gross - A.net, futA = row.futCost;           // window A: the futures cost (% of price) is below the CFD's all-in cost, so its net R can only rise
    C['pooled n >= 40'] = V[h].B.n >= 40; C['net > 0'] = row.futNet > 0; C['t >= 2'] = row.tFut >= 2; C['Holm p < 0.05 over the two holds (futures p)'] = hp < 0.05;
    C['window A (2008-15) pooled net R > 0'] = A.avgR > 0 && futA <= costAPct;
    const carry = mean(['spx500', 'nas100', 'us30'].map((k) => carryPct(bd.rates, DIV[k], '2016-01-01', '2026-11-06', V[h].B.nights)));
    return done('vol-spike-rebound PREREGISTRATION.md "Test and pass bar"', { holmP: r4(hp), windowA: { avgRcfd: A.avgR, cfdCostPct: r4(costAPct), futCostPct: r4(futA) }, carryPct: r4(carry), cfdPass: h === '10' && bd['vol-spike-rebound'].verdict === 'PASS' });
  }
  if (T.topic === 'turnaround-tuesday') {
    const TT = bd['turnaround-tuesday'], cells = TT.cells, fut = {}, tt = {};
    for (const [k, c] of Object.entries(cells)) {
      const key = c.market || k.split('-')[0], fc = tupleCost(c.tuples, key, refP(TT.refs[key])), s = scaleOf({ gross: c.oos.grossR, net: c.oos.R, tGross: c.oos.tGross, tNet: c.oos.t });
      fut[k] = c.oos.grossR - fc; tt[k] = fut[k] / s;
    }
    const ids = Object.keys(cells), H = holm(ids.map((k) => pOne(tt[k]))), hp = H[ids.indexOf(T.test)], c = cells[T.test], key = c.market || T.test.split('-')[0];
    const isFc = tupleCost(c.isTuples, key, refP(TT.refs[`${key}IS`])), isFut = c.is.grossR - isFc;
    const beaten = c.placebo.seeds.filter((x) => row.futNet > x + shift).length;
    C['C1 net > 0, trade t >= 2'] = row.futNet > 0 && row.tFut >= 2; C['C1 Holm p < 0.05 over the four cells (futures p)'] = hp < 0.05; C['C2 n'] = c.oos.n >= (c.minN ?? 30);
    C['C3 2008-15 net > 0'] = isFut > 0; C['C4 against all Tuesdays (before costs, as published)'] = TT.checks[T.test].checks.c4; C['C5 placebo: 38 of 40 seeds, shifted by the cost change'] = beaten >= c.placebo.need;
    return done('turnaround-tuesday PREREGISTRATION.md C1-C5', { holmP: r4(hp), isFutNet: r4(isFut), placeboBeaten: beaten, cfdPass: TT.checks[T.test].pass });
  }
  if (T.topic === 'turnaround-replicate') {
    const TR = bd['turnaround-replicate'], pos = [];
    for (const [k, m] of Object.entries(TR.markets)) { const fc = tupleCost(T.tuplesBy[k], k, refP(T.refs.find((id) => id.startsWith(`${k}|`)))); pos.push([k, m.oos.grossR - fc]); }
    const beaten = TR.placebo.seeds.filter((x) => row.futNet > x + shift).length;
    C['P1 net > 0, month t >= 2'] = row.futNet > 0 && row.tFut >= 2; C['P2 at least 4 of 6 markets net > 0'] = pos.filter(([, v]) => v > 0).length >= 4; C['P3 placebo: 38 of 40 seeds, shifted by the cost change'] = beaten >= TR.placebo.need;
    return done('turnaround-replicate PREREGISTRATION.md P1-P3', { perMarket: Object.fromEntries(pos.map(([k, v]) => [k, r4(v)])), placeboBeaten: beaten, cfdPass: TR.verdict === 'PASS' });
  }
  C['net > 0, t >= 2'] = row.futNet > 0 && row.tFut >= 2;
  C['the rest of its own bar'] = 'not computable from stored figures';
  return done('not read');
}


// ─── run ───
export function analyse(J) {
  const rows = J.tests.map((T) => recost(T, J.refs)); J._rows = rows;
  for (const [i, r] of rows.entries()) {
    if (r.tFut == null) { r.stepA = null; continue; }
    r.stepA = r.futNet > 0 && r.tFut >= 2;
    if (r.stepA) r.stepB = stepB(r, J.tests[i], J);
    r.wouldPass = !!(r.stepA && r.stepB?.pass);
  }
  // section 5: multiple testing
  const recosted = rows.filter((r) => r.tFut != null), fam = recosted.filter((r) => r.role === 'family');
  const count = (list, key) => { const ps = list.map((r) => pOne(r[key])), H = holm(ps), B = bh(ps); return { N: list.length, holm05: list.filter((_, i) => H[i] < 0.05).map(idOf), bh05: list.filter((_, i) => B[i] <= 0.05).map(idOf), bh10: list.filter((_, i) => B[i] <= 0.1).map(idOf), t2: list.filter((r) => r[key] >= 2).map(idOf), rows: list.map((r, i) => ({ id: idOf(r), t: r[key], p: r4(ps[i]), holm: r4(H[i]), bh: r4(B[i]) })) }; };
  const primary = { futures: count(fam, 'tFut'), cfd: count(fam, 'tCfd') };
  const withAll = { futures: count(recosted, 'tFut'), cfd: count(recosted, 'tCfd') };
  // in the 333 family: replace the re-costed family tests' p with their futures p
  const famIds = new Map(fam.map((r) => [mtId(r), r]));
  const replaced = [], ps333 = J.family.map(([id, t, p]) => { const r = famIds.get(id); if (r) { replaced.push(id); return pOne(r.tFut); } return p; });
  const H = holm(ps333), B = bh(ps333);
  const in333 = { N: J.family.length, replaced: replaced.length, notInFamily: fam.filter((r) => !J.family.some(([id]) => id === mtId(r))).map(idOf),
    holm05: J.family.filter((_, i) => H[i] < 0.05).map((x) => x[0]), bh05: J.family.filter((_, i) => B[i] <= 0.05).map((x) => x[0]), bh10: J.family.filter((_, i) => B[i] <= 0.1).map((x) => x[0]),
    bonferroniT: r2(invPhi(1 - 0.05 / J.family.length)) };
  // families as a whole: Stouffer over the family-role re-costed tests, Holm across families
  const fams = [...new Set(rows.map((r) => r.family))];
  const famRows = fams.map((f) => {
    const all = rows.filter((r) => r.family === f), F = all.filter((r) => r.role === 'family' && r.tFut != null);
    const z = F.length ? F.reduce((a, r) => a + r.tFut, 0) / Math.sqrt(F.length) : null, zc = F.length ? F.reduce((a, r) => a + r.tCfd, 0) / Math.sqrt(F.length) : null;
    return { family: f, tests: all.length, noRoute: all.filter((r) => r.route === 'none').length, recostedFamily: F.length, stepA: all.filter((r) => r.stepA).length, wouldPass: all.filter((r) => r.wouldPass).length,
      zFut: r2(z), pFut: r4(pOne(z)), zCfd: r2(zc), pCfd: r4(pOne(zc)), replications: all.filter((r) => r.role !== 'family' && r.tFut != null).map((r) => ({ id: idOf(r), tFut: r.tFut })) };
  });
  const withZ = famRows.filter((f) => f.zFut != null), hz = holm(withZ.map((f) => f.pFut)), hzc = holm(withZ.map((f) => f.pCfd));
  withZ.forEach((f, i) => { f.holmFut = r4(hz[i]); f.holmCfd = r4(hzc[i]); f.survives = hz[i] < 0.05; });
  const n = rows.filter((r) => r.wouldPass).length, k = primary.futures.holm05.length;
  for (const r of rows) if (r.wouldPass) r.routeOnly = r.stepB.cfdPass === false;
  const j = rows.filter((r) => r.routeOnly).length;
  const verdict = (n >= 1 ? `ROUTE-SENSITIVE: ${n} test${n === 1 ? '' : 's'} would pass at futures cost (Holm ${k})` : 'NOT ROUTE-SENSITIVE') + ' (accounting, no rule tested: inconclusive as evidence for any rule)';
  const verdictNote = `${n - j} of the ${n} already passed their own bar at the CFD cost; ${j} pass only at futures cost; ${k ? `${k} survive${k === 1 ? 's' : ''}` : 'none survives'} Holm over the ${primary.futures.N} re-costed family tests`;
  return { verdict, verdictNote, counts: { routeOnly: j, tests: rows.length, noRoute: rows.filter((r) => r.route === 'none').length, recosted: recosted.length, perTrade: rows.filter((r) => r.method?.startsWith('per trade')).length,
    approx: rows.filter((r) => r.method?.startsWith('approx')).length, stepA: rows.filter((r) => r.stepA).length, wouldPass: n, holm: k, familiesSurviving: withZ.filter((f) => f.survives).length },
    rows, primary, withAll, in333, families: famRows };
}
export const idOf = (r) => `${r.pr ? `#${r.pr} ` : ''}${r.topic} ${r.test}`;
export function mtId(r) {
  if (r.topic === 'bond-month-end' && r.test === 'USB10Y') return '#939 bond-month-end: T1 usb10y';
  return `#${r.pr} ${r.topic}: ${r.test}`;
}
function invPhi(p) { let lo = -10, hi = 10; for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if (Phi(m) < p) lo = m; else hi = m; } return (lo + hi) / 2; }

// ─── report ───
const f3 = (x) => (x == null ? '—' : (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? '—' : (x < 0 ? '−' : '') + Math.abs(x).toFixed(2));
export function report(A, J) {
  const L = [];
  L.push(`# Futures route map: the cost-blocked tests of 13-14 Nov at exchange-futures cost (${J.built})`, '');
  L.push(`**Verdict: ${A.verdict}.** ${A.verdictNote[0].toUpperCase()}${A.verdictNote.slice(1)}. Accounting, no rule tested. **The demo accounts trade CFDs only (absolute rule 2): no route, account or broker change is proposed, and nothing here is called an edge.** A route chosen after seeing the CFD loss, on the same history each rule was judged on, is not evidence of an edge; it would need its own pre-registration and a forward record.`, '');
  L.push('Pre-registration: `PREREGISTRATION.md` (pushed alone first). Inputs: `collected.json` (`collect.mjs`, `git show` of each branch, no network). Every figure: `result.json`.', '');
  const c = A.counts;
  L.push('## What was read', '',
    `- ${c.tests} tests: the 43 of cost-floor-map (#948) classed cost-blocked (31) or net t ≥ 2 (12), plus bond-month-end-replicate's pooled test (added by name).`,
    `- **No route: ${c.noRoute}** (a forex cross in the test, section 2). **Re-costed: ${c.recosted}** (${c.perTrade} per trade from a stored list, ${c.approx} by the constant-cost approximation, labelled "approx").`,
    `- **Step A** (decisive futures net > 0 and t ≥ 2): **${c.stepA}**. **Would pass the study's own bar at futures cost: ${c.wouldPass}.** Holm over the re-costed family tests: **${c.holm}** survive.`, '');
  L.push('## The futures equivalents (section 2 of the pre-registration)', '', '| Instrument | Contract | Tick | Value | Fee a side | Round trip at the reference price, % of price | Source |', '|---|---|---|---|---|---|---|');
  const used = new Map(); for (const r of Object.values(J.refs)) if (CONTRACTS[r.key] && !used.has(r.key)) used.set(r.key, r.median);
  for (const [k, P] of used) { const C = CONTRACTS[k]; L.push(`| ${k} | ${C.root} | ${C.tick} | ${C.pv != null ? `${C.pv} a point` : `${C.M.toLocaleString('en-US')} units`} | ${C.fee} | ${(100 * futFrac(k, P)).toFixed(4)} % (at ${P}) | ${C.src} |`); }
  L.push('', 'One tick of slippage a side and the fee a side, twice; no financing; no roll charge. Crosses: no route. Reference price = the median daily close of the decisive window (council-data, pinned commit).', '');
  L.push('## Per test (decisive window; R a trade unless the unit says %)', '', '| Study | Test | Role | Family | Unit | n | Gross | CFD net | CFD t | Futures cost | Futures net | Futures t | 2 x futures cost: net, t | Method | Step A | Own bar |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  const order = [...A.rows].sort((a, b) => (b.tFut ?? -99) - (a.tFut ?? -99));
  for (const r of order) {
    const bar = r.route === 'none' ? 'no route' : r.wouldPass ? (r.routeOnly ? '**PASS** (fails at CFD cost)' : 'PASS (passed at CFD cost too)') : r.stepA ? `no (${Object.entries(r.stepB?.conditions || {}).filter(([, v]) => v !== true).map(([k]) => k).join('; ')})` : 'no';
    L.push(`| ${r.pr ? `${r.topic} (#${r.pr})` : r.topic} | ${r.test} | ${r.role} | ${r.family} | ${r.unit} | ${r.n} | ${f3(r.gross)} | ${f3(r.cfdNet)} | ${f2(r.tCfd)} | ${r.route === 'none' ? '—' : f3(r.futCost)} | ${r.route === 'none' ? '—' : f3(r.futNet)} | ${r.route === 'none' ? '—' : f2(r.tFut)} | ${r.route === 'none' ? '—' : `${f3(r.fut2x)}, ${f2(r.t2x)}`} | ${r.route === 'none' ? `no route: ${r.why}` : r.method} | ${r.stepA == null ? '—' : r.stepA ? 'yes' : 'no'} | ${bar} |`);
  }
  L.push('', '## Gates of the per-trade re-costs', '', '| Test | n | gross | CFD net | CFD t (its form) | Published | Gate |', '|---|---|---|---|---|---|---|');
  for (const r of A.rows.filter((x) => x.gate)) { const g = r.gate; L.push(`| ${idOf(r)} | ${g.got.n} | ${f3(g.got.gross)} | ${f3(g.got.net)} | ${f2(g.got.t)} | n ${g.published.n}, ${f3(g.published.gross)}, ${f3(g.published.net)}, t ${f2(g.published.t)} | ${g.pass ? 'passed' : `failed (${Object.entries(g.checks).filter(([, v]) => !v).map(([k]) => k).join(', ')}${g.skipped ? `; ${g.skipped} trades with no recoverable stop` : ''}): falls back to the approximation`} |`); }
  L.push('', '## Multiple testing (the counting rule of multiple-testing-update)', '');
  const P = A.primary;
  L.push(`- **Primary, the ${P.futures.N} re-costed family tests:** at futures cost Holm 0.05: ${P.futures.holm05.length} (${P.futures.holm05.join('; ') || 'none'}); BH q 0.05: ${P.futures.bh05.length}; q 0.10: ${P.futures.bh10.length}; t ≥ 2: ${P.futures.t2.length} (${P.futures.t2.join('; ') || 'none'}). At the CFD cost: Holm ${P.cfd.holm05.length}, BH q 0.10 ${P.cfd.bh10.length}, t ≥ 2 ${P.cfd.t2.length}.`);
  L.push(`- Sensitivity, every re-costed test (${A.withAll.futures.N}, replication and robustness rows included): Holm ${A.withAll.futures.holm05.length} (${A.withAll.futures.holm05.join('; ') || 'none'}), BH q 0.10 ${A.withAll.futures.bh10.length}.`);
  L.push(`- Sensitivity, the full family of multiple-testing-update (N ${A.in333.N}; ${A.in333.replaced} re-costed family tests replaced by their futures p): Holm ${A.in333.holm05.length} (${A.in333.holm05.join('; ') || 'none'}), BH q 0.05 ${A.in333.bh05.length}, q 0.10 ${A.in333.bh10.length}; Bonferroni needs t ≥ ${A.in333.bonferroniT}. Not in that family (counted per bank there): ${A.in333.notInFamily.join('; ') || 'none'}.`, '');
  L.push('## Families as a whole (Stouffer of the family-role tests, Holm across families)', '', '| Family | Tests | No route | Re-costed (family role) | Step A | Would pass | Stouffer z futures | Holm p | z CFD | Holm p CFD | Survives | Replication / robustness rows (futures t) |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const f of A.families) L.push(`| ${f.family} | ${f.tests} | ${f.noRoute} | ${f.recostedFamily} | ${f.stepA} | ${f.wouldPass} | ${f2(f.zFut)} | ${f.holmFut ?? '—'} | ${f2(f.zCfd)} | ${f.holmCfd ?? '—'} | ${f.survives == null ? '—' : f.survives ? 'yes' : 'no'} | ${f.replications.map((x) => `${x.id} ${f2(x.tFut)}`).join('; ') || '—'} |`);
  L.push('', 'The tests of one family share days and markets: the Stouffer z treats them as independent and overstates the evidence (an upper bound).', '');
  return L;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const J = JSON.parse(readFileSync(path.join(HERE, 'collected.json'), 'utf8'));
  const A = analyse(J);
  const L = report(A, J);
  const extra = (await import('./notes.mjs')).notes(A, J, { futFrac, cfdFrac, idOf });
  writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ built: J.built, ...A }, null, 1) + '\n');
  writeFileSync(path.join(HERE, 'RESULT.md'), [...L, ...extra].join('\n') + '\n');
  console.log(A.verdict); console.log(JSON.stringify(A.counts));
}
