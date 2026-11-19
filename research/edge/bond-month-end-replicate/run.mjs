// The bond month-end rule, frozen, on four other bond CFDs (pre-registered: PREREGISTRATION.md, pushed alone first, 14 Nov 2026).
// #939's run.mjs is frozen.mjs (byte for byte, never edited); its MARKETS table already holds usb02y, usb05y, de10yb, uk10yb.
//   node research/edge/bond-month-end-replicate/run.mjs fetch <dir>   (git show, no network; candles + #939's result, out of git)
//   node research/edge/bond-month-end-replicate/run.mjs full <dir>    (gate, pooled test, writes result.json beside this file)
// Research only: nothing live reads this file.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import * as F from './frozen.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FROZEN_SHA = '624ac805a9b361949906bf5e0c94e576433d2d019e2e3470f9b57f5d8f630144';
export const DATA_COMMIT = 'f6288251e85eb98814514be7f32c667f4f0667e3';   // council-data, the 7 Nov weekly cache #939 / #943 read
export const SOURCE = 'origin/bond-month-end:research/edge/bond-month-end/result.json';
export const POOL = ['usb02y', 'usb05y', 'de10yb', 'uk10yb'];
export const GATE = ['usb10y', 'usb30y'];
export const T939 = 0.77;                    // #939's T1 (usb10y) decisive net t, published
export const FAMILY_N = 333;                 // multiple-testing-update's family size
export const NOT_ME = [2, 3, 4, 5, 6];       // TD-k entries whose three held days touch TD-3..TD-1

// futures equivalents (pre-registered table): round trip = one tick + fees / point value
export const FUT = {
  usb02y: { root: 'ZT', tick: 1 / 256, feesPts: 3.70 / 2000 },
  usb05y: { root: 'ZF', tick: 1 / 128, feesPts: 3.70 / 1000 },
  de10yb: { root: 'FGBL', tick: 0.01, feesPts: 3.70 / 1000 },
  uk10yb: { root: 'Long Gilt', tick: 0.01, feesPts: 3.70 / 1000 },
};
export const futRT = (key, mult = 1) => mult * (FUT[key].tick + FUT[key].feesPts);
export const futNet = (key, t, mult = 1) => t.gross - futRT(key, mult) / t.dist;

const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const r3 = (x) => x == null ? null : +x.toFixed(3), r2 = (x) => x == null ? null : +x.toFixed(2);
const pct = (xs, q) => { const s = [...xs].sort((a, b) => a - b), i = (s.length - 1) * q, lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

// ─── local calendars (sensitivity only) ───
export function easter(y) {  // anonymous Gregorian algorithm
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(y, mo - 1, da);
}
const addD = (ms, n) => iso(ms + n * 86400e3);
export function deHolidays(y) {
  const E = easter(y);
  return new Set([`${y}-01-01`, addD(E, -2), addD(E, 1), `${y}-05-01`, `${y}-12-24`, `${y}-12-25`, `${y}-12-26`, `${y}-12-31`]);
}
const firstMon = (y, m) => { const w = new Date(Date.UTC(y, m, 1)).getUTCDay(); return Date.UTC(y, m, 1 + ((1 - w + 7) % 7)); };
const lastMon = (y, m) => { const end = new Date(Date.UTC(y, m + 1, 0)), w = end.getUTCDay(); return Date.UTC(y, m, end.getUTCDate() - ((w - 1 + 7) % 7)); };
export function ukHolidays(y) {
  const E = easter(y), s = new Set([addD(E, -2), addD(E, 1)]);
  const nyW = new Date(Date.UTC(y, 0, 1)).getUTCDay(); s.add(iso(Date.UTC(y, 0, 1 + (nyW === 6 ? 2 : nyW === 0 ? 1 : 0))));
  s.add(y === 2020 ? '2020-05-08' : iso(firstMon(y, 4)));
  s.add(y === 2012 ? '2012-06-04' : y === 2022 ? '2022-06-02' : iso(lastMon(y, 4)));
  s.add(iso(lastMon(y, 7)));
  const cw = new Date(Date.UTC(y, 11, 25)).getUTCDay();   // Christmas / Boxing Day observed
  if (cw === 6) { s.add(`${y}-12-27`); s.add(`${y}-12-28`); } else if (cw === 0) { s.add(`${y}-12-26`); s.add(`${y}-12-27`); }
  else if (cw === 5) { s.add(`${y}-12-25`); s.add(`${y}-12-28`); } else { s.add(`${y}-12-25`); s.add(`${y}-12-26`); }
  for (const d of ['2011-04-29', '2012-06-05', '2022-06-03', '2022-09-19', '2023-05-08']) if (+d.slice(0, 4) === y) s.add(d);
  return s;
}
const LOCAL = { de10yb: deHolidays, uk10yb: ukHolidays };

// the frozen runMarket's preamble, rebuilt from its exports (it does not hand back D); cal 'local' = the sensitivity calendar
export function setup(key, json, cal = null) {
  const M = F.MARKETS[key], rows = json.rows.filter((r) => r.every(Number.isFinite));
  const first = iso(rows[0][0] * 1000), last = iso(rows.at(-1)[0] * 1000);
  const fileDays = new Set(rows.map((r) => iso(r[0] * 1000)));
  const wk = (d) => { const w = new Date(d + 'T00:00:00Z').getUTCDay(); return w >= 1 && w <= 5; };
  const isT = cal === 'local' ? (d) => wk(d) && !LOCAL[key](+d.slice(0, 4)).has(d)
    : M.cal === 'us' ? (d) => F.isUsTradingDay(d) : (d) => wk(d) && fileDays.has(d);
  const lastMonthEnd = iso(Date.UTC(+last.slice(0, 4), +last.slice(5, 7), 0));
  const days = F.calendar(first, lastMonthEnd, isT), L = F.fromEnd(days), D = F.buildDays(rows, days);
  return { M, rows, D, L };
}
// the frozen placebo's draw (same rng sequence), net by netFn, entries restricted by eligible(e) (null = the frozen draw)
export function placeboBy(rows, D, counts, cost, seed, netFn = (t) => F.netOf(t), eligible = null) {
  const R = F.rng(seed), elig = {};
  for (let e = 0; e + F.HOLD < D.length; e++) {
    const y = +D[e].d.slice(0, 4); if (!(y in counts)) continue; if (eligible && !eligible(e)) continue;
    const t = F.trade(rows, D, e, e + F.HOLD, cost); if (t) (elig[y] ||= []).push(t);
  }
  const nets = [];
  for (const [y, n] of Object.entries(counts)) { const pool = elig[y] || []; for (let i = 0; i < n && pool.length; i++) nets.push(netFn(pool[Math.floor(R() * pool.length)])); }
  return F.stats(nets).mean;
}
export function drawdown(xs) { let c = 0, hi = 0, dd = 0; for (const x of xs) { c += x; hi = Math.max(hi, c); dd = Math.min(dd, c - hi); } return dd; }
export const rowRow = (t) => [t.entryD, t.exitD, +t.entry.toFixed(4), t.stop, +t.exit.toFixed(4), t.how, r3(t.gross), r3(F.netOf(t))];

// monthly equal-weight pool: { 'YYYY-MM': mean of the markets' net R that month }
export function poolMonths(byMarket, netFn) {
  const m = new Map();
  for (const [key, ts] of Object.entries(byMarket)) for (const t of ts) { const k = t.entryD.slice(0, 7); if (!m.has(k)) m.set(k, []); m.get(k).push(netFn(key, t)); }
  return [...m.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([k, xs]) => [k, mean(xs)]);
}
export function chi2SfEven(x, df) { let term = 1, sum = 1; for (let k = 1; k < df / 2; k++) { term *= x / 2 / k; sum += term; } return Math.exp(-x / 2) * sum; }
export function fisher(ps) { const x = -2 * ps.reduce((a, p) => a + Math.log(p), 0), df = 2 * ps.length; return { x, df, p: chi2SfEven(x, df) }; }

export function poolVerdict(P) {
  const p = F.pOneSided(P.decisive.t), adj = F.holm([p])[0];
  const checks = { decisivePositive: P.decisive.net > 0, replicationPositive: P.replication.net > 0, tAtLeast2: P.decisive.t != null && P.decisive.t >= 2,
    holm: adj < 0.05, placebo: P.placebo.ruleMean > P.placebo.p95 };
  const pass = Object.values(checks).every(Boolean);
  return { checks, pOneSided: +p.toFixed(4), holmP: +adj.toFixed(4), pass, verdict: pass ? 'REPLICATES' : 'DOES NOT REPLICATE' };
}

const dec = (t) => F.inDecisive(t), rep = (t) => F.inReplication(t);
const st = (xs) => { const s = F.stats(xs); return { n: s.n, net: r3(s.mean), t: r2(s.t) }; };

function marketExtra(key, json) {
  const { M, rows, D, L } = setup(key, json);
  // the pre-registered windows end with the last COMPLETE month on file: on the file calendar (de10yb, uk10yb) the frozen code
  // also books the month of the last candle (its 'last four trading days' are the days on file so far); that trade is left out
  const lastMonth = iso(rows.at(-1)[0] * 1000).slice(0, 7), done = (t) => t.entryD.slice(0, 7) < lastMonth;
  const allRaw = F.windowTrades(rows, D, L, 4, M.cost).trades, all = allRaw.filter(done), d = all.filter(dec), r = all.filter(rep);
  const incomplete = allRaw.filter((t) => !done(t)).map(rowRow);
  const counts = {}; for (const t of d) counts[+t.entryD.slice(0, 4)] = (counts[+t.entryD.slice(0, 4)] || 0) + 1;
  const notMe = (e) => !NOT_ME.includes(-L[D[e].d]);
  const plAny = [], plNot = [], plFut = [];
  for (let s = 1; s <= F.SEEDS; s++) {
    plAny.push(placeboBy(rows, D, counts, M.cost, s));
    plNot.push(placeboBy(rows, D, counts, M.cost, s, undefined, notMe));
    plFut.push(placeboBy(rows, D, counts, M.cost, s, FUT[key] ? (t) => futNet(key, t) : undefined));
  }
  const out = { allRaw, all, d, r, plAny, plNot, plFut, incomplete };
  if (LOCAL[key]) {
    const S = setup(key, json, 'local'), w = F.windowTrades(S.rows, S.D, S.L, 4, M.cost);
    const ld = w.trades.filter(done).filter(dec), lr = w.trades.filter(done).filter(rep);
    const fileIds = new Set(d.map((t) => t.entryD));
    out.local = { decisive: st(ld.map((t) => F.netOf(t))), replication: st(lr.map((t) => F.netOf(t))), skipped: w.skipped.length,
      entryDaysChanged: ld.filter((t) => !fileIds.has(t.entryD)).length,
      holidayCandles: rows.filter((x) => { const dd = iso(x[0] * 1000), wd = new Date(dd + 'T00:00:00Z').getUTCDay(); return wd >= 1 && wd <= 5 && LOCAL[key](+dd.slice(0, 4)).has(dd); }).length };
    out.localTrades = { d: ld, r: lr };
  }
  return out;
}

export function analyse(J, pub) {
  // G1: #939's published usb10y / usb30y objects and tests block
  const FM = {}; for (const k of GATE) FM[k] = F.runMarket(k, J[k]);
  const FV = F.verdictOf(FM);
  const g1 = { usb10y: isDeepStrictEqual(FM.usb10y, pub.markets.usb10y), usb30y: isDeepStrictEqual(FM.usb30y, pub.markets.usb30y),
    tests: isDeepStrictEqual(FV.tests, pub.tests) && FV.verdict === pub.verdict };
  // G2: the placebo loop reproduces #939's 40 means (frozen draw, no filter)
  const g2 = {};
  for (const k of GATE) {
    const { M, rows, D, L } = setup(k, J[k]);
    const d = F.windowTrades(rows, D, L, 4, M.cost).trades.filter(dec), counts = {};
    for (const t of d) counts[+t.entryD.slice(0, 4)] = (counts[+t.entryD.slice(0, 4)] || 0) + 1;
    const pl = []; for (let s = 1; s <= F.SEEDS; s++) pl.push(r3(placeboBy(rows, D, counts, M.cost, s)));
    g2[k] = isDeepStrictEqual(pl, pub.markets[k].placebo.means);
  }
  // the four markets
  const RM = {}, X = {}, g3 = {}, crossMatch = {};
  for (const k of POOL) {
    RM[k] = F.runMarket(k, J[k]); X[k] = marketExtra(k, J[k]);
    g3[k] = isDeepStrictEqual(X[k].allRaw.map(rowRow), RM[k].trades);
    crossMatch[k] = JSON.stringify(RM[k]) === JSON.stringify(pub.markets[k]);   // as published (JSON: -0 is written 0)
  }
  const gatePass = [...Object.values(g1), ...Object.values(g2), ...Object.values(g3)].every(Boolean);
  const res = { gate: { pass: gatePass, frozenSha256: FROZEN_SHA, dataCommit: DATA_COMMIT, g1, g2, g3, crossCheckObjectsMatch939: crossMatch,
    published: { T1: pub.markets.usb10y.decisive, T2: pub.markets.usb30y.decisive } } };
  if (!gatePass) return res;

  // ─── primary: monthly equal-weight pool ───
  const netCfd = (k, t, m = 1) => F.netOf(t, m);
  const pool = (sel, netFn) => { const ms = poolMonths(Object.fromEntries(POOL.map((k) => [k, X[k].all.filter(sel)])), netFn), v = ms.map((x) => x[1]); return { v, ...st(v) }; };
  const P = {};
  const pd = pool(dec, (k, t) => netCfd(k, t)), pr = pool(rep, (k, t) => netCfd(k, t));
  const plPool = Array.from({ length: F.SEEDS }, (_, i) => mean(POOL.map((k) => X[k].plAny[i])));
  const plPoolNot = Array.from({ length: F.SEEDS }, (_, i) => mean(POOL.map((k) => X[k].plNot[i])));
  const pdG = pool(dec, (k, t) => t.gross);
  P.decisive = { n: pd.n, net: pd.net, t: pd.t, gross: pdG.net, tGross: pdG.t, months: pd.n, trades: POOL.reduce((a, k) => a + X[k].d.length, 0), worstDD: r2(drawdown(pd.v)) };
  P.replication = { n: pr.n, net: pr.net, t: pr.t, trades: POOL.reduce((a, k) => a + X[k].r.length, 0) };
  P.placebo = { seeds: F.SEEDS, design: '#939 frozen draw (any trading day), pooled = mean of the four markets\' seed means', means: plPool.map(r3), median: r3(pct(plPool, 0.5)), p95: r3(pct(plPool, 0.95)), beaten: plPool.filter((p) => mean(pd.v) > p).length, ruleMean: r3(mean(pd.v)) };
  P.placeboNotMonthEnd = { seeds: F.SEEDS, excluded: 'entries at TD-2..TD-6', means: plPoolNot.map(r3), median: r3(pct(plPoolNot, 0.5)), p95: r3(pct(plPoolNot, 0.95)), beaten: plPoolNot.filter((p) => mean(pd.v) > p).length, ruleMean: r3(mean(pd.v)) };
  P.cost = Object.fromEntries([0, 1, 2].map((m) => [`x${m}`, { decisive: (({ n, net, t }) => ({ n, net, t }))(pool(dec, (k, t) => netCfd(k, t, m))), replication: (({ n, net, t }) => ({ n, net, t }))(pool(rep, (k, t) => netCfd(k, t, m))) }]));
  P.futures = Object.fromEntries([0, 1, 2].map((m) => [`x${m}`, { decisive: (({ n, net, t }) => ({ n, net, t }))(pool(dec, (k, t) => futNet(k, t, m))), replication: (({ n, net, t }) => ({ n, net, t }))(pool(rep, (k, t) => futNet(k, t, m))) }]));
  const plPoolFut = Array.from({ length: F.SEEDS }, (_, i) => mean(POOL.map((k) => X[k].plFut[i])));
  const pfd = pool(dec, (k, t) => futNet(k, t));
  P.futures.worstDD = r2(drawdown(pfd.v));
  P.futures.placebo = { median: r3(pct(plPoolFut, 0.5)), p95: r3(pct(plPoolFut, 0.95)), beaten: plPoolFut.filter((p) => mean(pfd.v) > p).length, ruleMean: r3(mean(pfd.v)) };
  const allD = POOL.flatMap((k) => X[k].d.map((t) => F.netOf(t)));
  P.perTrade = { decisive: st(allD), replication: st(POOL.flatMap((k) => X[k].r.map((t) => F.netOf(t)))) };
  // local-calendar pool (de10yb, uk10yb on local holidays; US markets unchanged)
  const locBy = (sel) => Object.fromEntries(POOL.map((k) => [k, X[k].localTrades ? (sel === dec ? X[k].localTrades.d : X[k].localTrades.r) : X[k].all.filter(sel)]));
  const ld = poolMonths(locBy(dec), (k, t) => F.netOf(t)).map((x) => x[1]), lr = poolMonths(locBy(rep), (k, t) => F.netOf(t)).map((x) => x[1]);
  P.localCalendar = { decisive: st(ld), replication: st(lr) };
  const V = poolVerdict(P);

  // ─── secondary: per market ───
  const mk = {};
    const summ = (ts, mult = 1) => { const s = F.stats(ts.map((t) => F.netOf(t, mult))), g = F.stats(ts.map((t) => t.gross));
    return { n: s.n, net: r3(s.mean), t: r2(s.t), gross: r3(g.mean), tGross: r2(g.t), win: r2(100 * ts.filter((t) => F.netOf(t, mult) > 0).length / s.n),
      stops: ts.filter((t) => t.how !== 'time').length, costR: r3(mean(ts.map((t) => t.costR))), finR: r3(mean(ts.map((t) => t.finR))) }; };
  const pk = POOL.map((k) => F.pOneSided(F.stats(X[k].d.map((t) => F.netOf(t))).t)), adj = F.holm(pk);
  POOL.forEach((k, i) => {
    const m = RM[k], x = X[k], dm = F.stats(x.d.map((t) => F.netOf(t))).mean;
    mk[k] = { label: m.label, future: FUT[k].root, futRoundTripPts: +futRT(k).toFixed(6), cal: m.calendar, first: m.first, costPct: m.costPct,
      decisive: summ(x.d), replication: summ(x.r),
      cost: Object.fromEntries([0, 1, 2].map((mu) => [`x${mu}`, { decisive: (({ n, net, t }) => ({ n, net, t }))(summ(x.d, mu)), replication: (({ n, net, t }) => ({ n, net, t }))(summ(x.r, mu)) }])),
      placebo: { p95: r3(pct(x.plAny, 0.95)), median: r3(pct(x.plAny, 0.5)), beaten: x.plAny.filter((p) => dm > p).length },
      placeboNotMonthEnd: { p95: r3(pct(x.plNot, 0.95)), median: r3(pct(x.plNot, 0.5)), beaten: x.plNot.filter((p) => dm > p).length },
      holmP: +adj[i].toFixed(4), pOneSided: +pk[i].toFixed(4), worstDD: r2(drawdown(x.d.map((t) => F.netOf(t)))),
      futures: Object.fromEntries([0, 1, 2].map((mu) => [`x${mu}`, { decisive: st(x.d.map((t) => futNet(k, t, mu))), replication: st(x.r.map((t) => futNet(k, t, mu))) }])),
      futCostR: r3(mean(x.d.map((t) => futRT(k) / t.dist))), futWorstDD: r2(drawdown(x.d.map((t) => futNet(k, t)))),
      frozenRows: { decisive: (({ n, net, t }) => ({ n, net, t }))(m.decisive), replication: (({ n, net, t }) => ({ n, net, t }))(m.replication) },
      incompleteMonthTrade: x.incomplete, rank: m.rank, local: x.local || null, skipped: m.skipped,
      trades: x.all.map(rowRow) };
  });

  // ─── Fisher ───
  const p939 = F.pOneSided(T939), pPool = F.pOneSided(P.decisive.t), fz = fisher([p939, pPool]);
  const fisherOut = { p939: +p939.toFixed(4), pPool: +pPool.toFixed(4), x: +fz.x.toFixed(3), df: fz.df, p: +fz.p.toFixed(4),
    bonferroni: +(0.05 / FAMILY_N).toExponential(2), belowBonferroni: fz.p < 0.05 / FAMILY_N,
    note: 'instrument-disjoint, same calendar days: positively dependent p values, so this p is too small (an upper bound on the evidence)' };
  return { ...res, verdict: V.verdict, primary: { ...P, ...V }, markets: mk, fisher: fisherOut };
}

function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const k of [...GATE, ...POOL, '_index']) fs.writeFileSync(path.join(dir, `${k}.json`), execFileSync('git', ['show', `${DATA_COMMIT}:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
  fs.writeFileSync(path.join(dir, 'published.json'), execFileSync('git', ['show', SOURCE], { maxBuffer: 1 << 28 }));
  console.log('wrote', dir);
}
function full(dir) {
  const idx = JSON.parse(fs.readFileSync(path.join(dir, '_index.json'), 'utf8')).symbols;
  const pub = JSON.parse(fs.readFileSync(path.join(dir, 'published.json'), 'utf8'));
  const J = {};
  for (const k of [...GATE, ...POOL]) { if (idx[k]?.status !== 'ok') throw new Error(`${k} not ok`); J[k] = JSON.parse(fs.readFileSync(path.join(dir, `${k}.json`), 'utf8')); }
  const A = analyse(J, pub);
  const out0 = !A.gate.pass ? 'NOT MEASURABLE (inconclusive: the gate failed)' : A.verdict === 'REPLICATES' ? 'REPLICATES (the pool passes #939\'s bar)' : 'DOES NOT REPLICATE (the pool fails #939\'s bar)';
  const out = { study: 'bond-month-end-replicate', built: '2026-11-14',
    rule: '#939 frozen: long at the close of TD-4, exit at the close of TD-1, stop 2 x ATR(20), costs + 3 % a year financing',
    pool: 'equal-weight monthly pool of usb02y, usb05y, de10yb, uk10yb; #939 bar verbatim', decisive: '2016-01 on', ...A, verdictPool: A.verdict ?? null, verdict: out0 };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify(A.gate));
  if (!A.gate.pass) { process.exitCode = 1; return; }
  const { v, ...pp } = A.primary; console.log(JSON.stringify(pp, null, 1));
  for (const k of POOL) console.log(k, JSON.stringify(A.markets[k]));
  console.log(JSON.stringify(A.fisher));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') fetchAll(dir); else if (cmd === 'full') full(dir); else console.log('usage: run.mjs fetch|full <dir>');
}
