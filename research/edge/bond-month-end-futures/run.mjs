// The bond month-end rule at Treasury futures cost (pre-registered: PREREGISTRATION.md, pushed alone first, 14 Nov 2026).
// A cost scenario: #939's frozen trades (frozen.mjs, byte for byte) re-costed as ZN / ZB futures; no trade is re-selected.
//   node research/edge/bond-month-end-futures/run.mjs fetch <dir>   (git show, no network; candles + #939's result, out of git)
//   node research/edge/bond-month-end-futures/run.mjs full <dir>    (gate, re-cost, writes result.json beside this file)
// Research only: nothing live reads this file.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import * as F from './frozen.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DATA_COMMIT = 'f6288251e85eb98814514be7f32c667f4f0667e3';   // council-data, the 7 Nov weekly cache #939 read
export const SOURCE = 'origin/bond-month-end:research/edge/bond-month-end/result.json';

// ─── the futures cost model (pre-registered), price points of par; 1 point = $1,000 on $100,000 face ───
export const POINT_USD = 1000;
export const FEE_SIDE = 1.00;          // $ a side: exchange 0.80 + clearing 0.19 + NFA 0.01 (broker ZN fee listing, search summary)
export const COMMISSION_SIDE = 0.85;   // $ a side, typical discount broker (from memory, not opened)
export const CONTRACTS = {
  usb10y: { root: 'ZN', test: 'T1', tick: 1 / 64, tickUsd: 15.625 },
  usb30y: { root: 'ZB', test: 'T2', tick: 1 / 32, tickUsd: 31.25 },
};
// one round trip in futures points: one tick of bid / ask (paid once on mid prices) + two sides of fees and commission
export function roundTripPts(key, mult = 1) {
  const C = CONTRACTS[key];
  return mult * (C.tick + 2 * (FEE_SIDE + COMMISSION_SIDE) / POINT_USD);
}
// a trade's futures cost in R: points over its own CFD stop distance (one CFD point taken as one futures point)
export const costR = (key, t, mult = 1) => roundTripPts(key, mult) / t.dist;
export const futNet = (key, t, mult = 1, rollExtra = false) =>
  t.gross - costR(key, t, mult) - (rollExtra && F.ROLL_MONTHS.includes(+t.entryD.slice(5, 7)) ? costR(key, t, 1) : 0);

const r3 = (x) => x == null ? null : +x.toFixed(3), r2 = (x) => x == null ? null : +x.toFixed(2), r4 = (x) => +x.toFixed(4);
const pct = (xs, q) => { const s = [...xs].sort((a, b) => a - b), i = (s.length - 1) * q, lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };
const row = (xs) => { const s = F.stats(xs); return { n: s.n, net: r3(s.mean), t: r2(s.t) }; };

// the frozen runMarket's preamble, rebuilt from its own exports (it does not hand back D)
export function setup(key, json) {
  const M = F.MARKETS[key], rows = json.rows.filter((r) => r.every(Number.isFinite));
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  const first = iso(rows[0][0] * 1000), last = iso(rows.at(-1)[0] * 1000);
  const lastMonthEnd = iso(Date.UTC(+last.slice(0, 4), +last.slice(5, 7), 0));
  const days = F.calendar(first, lastMonthEnd, (d) => F.isUsTradingDay(d)), L = F.fromEnd(days), D = F.buildDays(rows, days);
  return { M, rows, D, L };
}
// the frozen placebo's draw, net by any function of the trade (netFn = F.netOf reproduces #939)
export function placeboBy(rows, D, counts, cost, seed, netFn) {
  const R = F.rng(seed), elig = {};
  for (let e = 0; e + F.HOLD < D.length; e++) { const y = +D[e].d.slice(0, 4); if (!(y in counts)) continue; const t = F.trade(rows, D, e, e + F.HOLD, cost); if (t) (elig[y] ||= []).push(t); }
  const nets = [];
  for (const [y, n] of Object.entries(counts)) { const pool = elig[y] || []; for (let i = 0; i < n && pool.length; i++) nets.push(netFn(pool[Math.floor(R() * pool.length)])); }
  return F.stats(nets).mean;
}

export function recost(key, json, published) {
  const { M, rows, D, L } = setup(key, json);
  const all = F.windowTrades(rows, D, L, 4, M.cost).trades;
  const dec = all.filter(F.inDecisive), rep = all.filter(F.inReplication);
  const counts = {}; for (const t of dec) counts[+t.entryD.slice(0, 4)] = (counts[+t.entryD.slice(0, 4)] || 0) + 1;
  const cfdPl = [], futPl = [];
  for (let s = 1; s <= F.SEEDS; s++) { cfdPl.push(r3(placeboBy(rows, D, counts, M.cost, s, (t) => F.netOf(t)))); futPl.push(placeboBy(rows, D, counts, M.cost, s, (t) => futNet(key, t))); }
  const fut = (ts, mult = 1, roll = false) => row(ts.map((t) => futNet(key, t, mult, roll)));
  const decMean = F.stats(dec.map((t) => futNet(key, t))).mean;
  const perYear = {}; for (const t of all) (perYear[t.entryD.slice(0, 4)] ||= []).push(t);
  return {
    key, contract: CONTRACTS[key].root, test: CONTRACTS[key].test,
    roundTripPts: r4(roundTripPts(key)), tickPts: CONTRACTS[key].tick, feesPts: r4(2 * (FEE_SIDE + COMMISSION_SIDE) / POINT_USD),
    gate: { placeboMeans: isDeepStrictEqual(cfdPl, published.placebo.means), trades: all.length,
      rowsMatch: isDeepStrictEqual(all.map((t) => [t.entryD, t.exitD, +t.entry.toFixed(4), t.stop, +t.exit.toFixed(4), t.how, r3(t.gross), r3(F.netOf(t))]), published.trades) },
    costPerTrade: { futuresR: r3(F.stats(dec.map((t) => costR(key, t))).mean), cfdSpreadR: published.decisive.costR, cfdFinR: published.decisive.finR,
      medianStopPts: r3(pct(dec.map((t) => t.dist), 0.5)) },
    decisive: { ...fut(dec), gross: r3(F.stats(dec.map((t) => t.gross)).mean), tGross: r2(F.stats(dec.map((t) => t.gross)).t),
      win: r2(100 * dec.filter((t) => futNet(key, t) > 0).length / dec.length), cfdNet: published.decisive.net, cfdT: published.decisive.t },
    replication: { ...fut(rep), gross: r3(F.stats(rep.map((t) => t.gross)).mean), cfdNet: published.replication.net, cfdT: published.replication.t },
    cost: Object.fromEntries([0, 1, 2].map((m) => [`x${m}`, { decisive: fut(dec, m), replication: fut(rep, m) }])),
    rollExtra: { decisive: fut(dec, 1, true), replication: fut(rep, 1, true) },
    placebo: { seeds: F.SEEDS, means: futPl.map(r3), median: r3(pct(futPl, 0.5)), p95: r3(pct(futPl, 0.95)), beaten: futPl.filter((p) => decMean > p).length, ruleMean: r3(decMean) },
    perYear: Object.fromEntries(Object.entries(perYear).map(([y, ts]) => [y, { n: ts.length, total: r2(ts.reduce((a, t) => a + futNet(key, t), 0)) }])),
  };
}

export function verdictOf(R) {
  const J = ['usb10y', 'usb30y'].map((k) => R[k]);
  const adj = F.holm(J.map((m) => F.pOneSided(m.decisive.t)));
  const tests = J.map((m, i) => {
    const c = { decisivePositive: m.decisive.net > 0, replicationPositive: m.replication.net > 0, tAtLeast2: m.decisive.t != null && m.decisive.t >= 2,
      holm: adj[i] < 0.05, placebo: m.placebo.ruleMean > m.placebo.p95 };
    return { test: m.test, market: m.key, contract: m.contract, holmP: r4(adj[i]), pOneSided: r4(F.pOneSided(m.decisive.t)), checks: c, pass: Object.values(c).every(Boolean) };
  });
  const passed = tests.filter((t) => t.pass).length;
  return { tests, passed, verdict: passed ? 'PASSES AT FUTURES COST' : 'FAILS AT FUTURES COST' };
}

function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const k of ['usb10y', 'usb30y', '_index']) fs.writeFileSync(path.join(dir, `${k}.json`), execFileSync('git', ['show', `${DATA_COMMIT}:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
  fs.writeFileSync(path.join(dir, 'published.json'), execFileSync('git', ['show', SOURCE], { maxBuffer: 1 << 28 }));
  console.log('wrote', dir);
}
function full(dir) {
  const pub = JSON.parse(fs.readFileSync(path.join(dir, 'published.json'), 'utf8'));
  const J = {}, R = {};
  for (const k of ['usb10y', 'usb30y']) J[k] = JSON.parse(fs.readFileSync(path.join(dir, `${k}.json`), 'utf8'));
  // G1: the frozen code reproduces #939's published market objects and tests block exactly
  const FM = {}; for (const k of ['usb10y', 'usb30y']) FM[k] = F.runMarket(k, J[k]);
  const FV = F.verdictOf(FM);
  const g1 = { usb10y: isDeepStrictEqual(FM.usb10y, pub.markets.usb10y), usb30y: isDeepStrictEqual(FM.usb30y, pub.markets.usb30y),
    tests: isDeepStrictEqual(FV.tests, pub.tests) && FV.verdict === pub.verdict };
  for (const k of ['usb10y', 'usb30y']) R[k] = recost(k, J[k], pub.markets[k]);
  const g2 = { usb10y: R.usb10y.gate.placeboMeans, usb30y: R.usb30y.gate.placeboMeans };
  const gatePass = Object.values(g1).every(Boolean) && Object.values(g2).every(Boolean) && R.usb10y.gate.rowsMatch && R.usb30y.gate.rowsMatch;
  if (!gatePass) { console.log('GATE FAILED', JSON.stringify({ g1, g2 })); process.exitCode = 1; return; }
  const V = verdictOf(R);
  const out = { study: 'bond-month-end-futures', built: '2026-11-14', verdict: V.verdict, passed: V.passed, of: 2, tests: V.tests,
    scenario: 'cost scenario: #939 frozen trades re-costed as Treasury futures (ZN, ZB); not tradable on the current CFD demo accounts',
    gate: { pass: gatePass, frozenSha256: '624ac805a9b361949906bf5e0c94e576433d2d019e2e3470f9b57f5d8f630144', dataCommit: DATA_COMMIT,
      g1, g2, published: { T1: pub.markets.usb10y.decisive, T2: pub.markets.usb30y.decisive } },
    costModel: { pointUsd: POINT_USD, feeSide: FEE_SIDE, commissionSide: COMMISSION_SIDE, financing: 0, rolls: 'none (enter the most traded contract); extra round trip in Feb/May/Aug/Nov as a reported row' },
    markets: R };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  for (const k of Object.keys(R)) { const m = R[k]; console.log(k, JSON.stringify({ cost: m.costPerTrade, dec: m.decisive, rep: m.replication, x: m.cost, roll: m.rollExtra, pl: [m.placebo.p95, m.placebo.beaten, m.placebo.median] })); }
  console.log(JSON.stringify({ g1, g2 }), JSON.stringify(V, null, 1));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') fetchAll(dir); else if (cmd === 'full') full(dir); else console.log('usage: run.mjs fetch|full <dir>');
}
