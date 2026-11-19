// Edge research · index-futures-cost: the trades of index-overnight, index-ibs and turn-of-month re-costed as CME micro
// futures (PREREGISTRATION.md, pushed alone first). Cost accounting only: the trades are the studies' own (rows.json.gz,
// written by dump.mjs from their unchanged code), never re-selected; no rule and no verdict changes.
//   node research/edge/index-futures-cost/run.mjs          -> result.json and RESULT.md beside this file (offline)
// Paper research only.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---------- the futures cost model (pre-registered) ----------
// allIn = the repository's all-in micro round trip in points (research/edge/costs RESULT.md; council/digest.mjs ICT_COST_PTS)
export const CONTRACTS = {
  spx500: { root: 'MES', pv: 5, tick: 0.25, allIn: 1.0, div: 'spx' },
  nas100: { root: 'MNQ', pv: 2, tick: 0.25, allIn: 1.37, div: 'ndx' },
  us30: { root: 'MYM', pv: 0.5, tick: 1, allIn: 5.5, div: 'dji' },
};
export const TICKS_SIDE = 1;          // spread-equivalent, a side
export const COMM_SIDE = 0.62;        // $ a side a micro contract, commission and fees (research/edge/costs: $1.24 a round trip)
const DAY = 86400;
const dayNum = (d) => Date.parse(d + 'T00:00:00Z') / 1000 / DAY;
export const daysBetween = (a, b) => dayNum(b) - dayNum(a);

// the 2-year yield on a date (last weekly value on or before it; before the first, rates.before2006)
export function rateAt(rates, d) {
  const xs = rates.DGS2; let lo = 0, hi = xs.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (xs[m][0] <= d) lo = m + 1; else hi = m; }
  return lo ? xs[lo - 1][1] : rates.before2006;
}
export const divAt = (rates, key, d) => { const t = rates.divYield[key]; const y = +d.slice(0, 4); return t[y] ?? t[Math.min(...Object.keys(t).map(Number))]; };
// quarterly roll dates: 8 days before the third Friday of Mar / Jun / Sep / Dec (council/futures.mjs, index rule)
export function rollDate(y, m) {
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(), fri3 = 1 + ((5 - first + 7) % 7) + 14;
  return new Date(Date.UTC(y, m - 1, fri3) - 8 * DAY * 1000).toISOString().slice(0, 10);
}
export function rollsBetween(a, b) { // roll dates strictly between the entry date and the exit date
  let n = 0;
  for (let y = +a.slice(0, 4); y <= +b.slice(0, 4); y++) for (const m of [3, 6, 9, 12]) { const r = rollDate(y, m); if (r > a && r < b) n++; }
  return n;
}
// one trade's futures cost in index points. x: { entry, entryD, exitD, days? }. mode F1 (default) | F2 (all-in round trip)
// | F3 (no dividend); mult multiplies the trading cost (ticks + commission), not the carry.
export function futCost(x, mk, rates, { mode = 'F1', mult = 1 } = {}) {
  const C = CONTRACTS[mk];
  const days = x.days != null ? x.days : daysBetween(x.entryD, x.exitD);
  const r = rateAt(rates, x.entryD), q = mode === 'F3' ? 0 : divAt(rates, C.div, x.entryD);
  let tick = 2 * TICKS_SIDE * C.tick * mult, comm = 2 * COMM_SIDE / C.pv * mult;
  if (mode === 'F2') { tick = C.allIn * mult; comm = 0; }
  const rolls = rollsBetween(x.entryD, x.exitD), roll = rolls * (tick + comm);
  const carry = (r - q) / 100 * days / 365 * x.entry;
  return { tick, comm, carry, roll, rolls, days, r, q, total: tick + comm + carry + roll };
}
// the dividend a CFD long is credited over the hold, points (not in the published CFD figures)
export function cfdDiv(x, mk, rates) { const days = x.days != null ? x.days : daysBetween(x.entryD, x.exitD); return divAt(rates, CONTRACTS[mk].div, x.entryD) / 100 * days / 365 * x.entry; }
// a study's unit: 1R = entry - stop (points) for overnight and ibs; turn-of-month was published in % of price
export const unitOf = (study, x) => (study === 'tom' ? x.entry / 100 : x.entry - x.stop);

// ---------- statistics (the studies' own forms) ----------
export function stats(xs) {
  const n = xs.length; if (!n) return { n: 0, mean: null, t: null };
  const mean = xs.reduce((a, b) => a + b, 0) / n, sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  return { n, mean, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : null };
}
const erf = (x) => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
export const pOne = (t) => (t == null ? 1 : 0.5 * (1 - erf(t / Math.SQRT2)));
export function holm(ps) {
  const ord = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = Array(ps.length); let run = 0;
  ord.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (ps.length - k) * p)); out[i] = run; });
  return out;
}
// month sums by entry month; `months` given = every month of the window counts (empty 0), else only months with a trade
export function monthT(trs, key, months = null) {
  const m = new Map(months ? months.map((k) => [k, 0]) : []);
  for (const t of trs) { const k = t.entryD.slice(0, 7); if (months && !m.has(k)) continue; m.set(k, (m.get(k) || 0) + t[key]); }
  return stats([...m.values()]).t;
}
export function monthsBetween(fromY, toYmd) {
  const out = []; let y = fromY, m = 1; const ty = +toYmd.slice(0, 4), tm = +toYmd.slice(5, 7);
  while (y < ty || (y === ty && m <= tm)) { out.push(`${y}-${String(m).padStart(2, '0')}`); if (++m > 12) { m = 1; y++; } }
  return out;
}
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000);
const r2 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
// index-overnight's percentile; index-ibs's percentile
const pctIO = (xs, q) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 0.5))]; };
const pctIBS = (xs, q) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.round(q * (s.length - 1))]; };

// ---------- the published figures each gate must reproduce (from each branch's result.json, 13-14 Nov 2026) ----------
export const PUBLISHED = {"overnight":{"T1.decisive":{"n":2721,"gross":0.023,"net":-0.022,"t":-2.86,"tGross":2.87,"place":[-0.032,-0.018,-0.009]},"T1.replication":{"n":2743,"gross":0.014,"net":-0.025,"t":-3.96,"tGross":2.29,"place":[-0.03,-0.018,-0.006]},"T2.decisive":{"n":2721,"gross":0.026,"net":-0.006,"t":-0.84,"tGross":3.54,"place":[-0.023,-0.008,0]},"T2.replication":{"n":2743,"gross":0.028,"net":-0.004,"t":-0.69,"tGross":4.65,"place":[-0.022,-0.013,0.004]}},"ibs":{"T1.decisive":{"n":472,"gross":0.062,"net":0.013,"t":0.37,"place":[33,-0.073,-0.013,0.03]},"T1.replication":{"n":521,"gross":0.115,"net":0.071,"t":2.66},"T2.decisive":{"n":473,"gross":0.096,"net":0.056,"t":1.65,"place":[40,-0.069,-0.019,0.043]},"T2.replication":{"n":513,"gross":0.051,"net":0.01,"t":0.34},"T3.decisive":{"n":469,"gross":0.049,"net":-0.011,"t":-0.31,"place":[32,-0.081,-0.04,0.013]},"T3.replication":{"n":514,"gross":0.094,"net":0.041,"t":1.46},"P.decisive":{"n":1414,"gross":0.069,"net":0.02,"t":0.64,"place":[40,-0.055,-0.029,0.011]},"P.replication":{"n":1548,"gross":0.087,"net":0.041,"t":1.63}},"tom":{"spx500.is":{"n":93,"gross":-0.021,"net":-0.113,"t":-0.42,"tGross":-0.08},"spx500.oos":{"n":129,"gross":0.102,"net":-0.015,"t":-0.1,"tGross":0.63,"place":[15,0.033],"days":[0.006,0.11]},"us30.is":{"n":93,"gross":-0.091,"net":-0.193,"t":-0.81,"tGross":-0.38},"us30.oos":{"n":129,"gross":0.107,"net":-0.022,"t":-0.14,"tGross":0.7,"place":[17,-0.014],"days":[0.009,0.17]},"nas100.is":{"n":93,"gross":0.245,"net":0.143,"t":0.53,"tGross":0.92},"nas100.oos":{"n":129,"gross":0.389,"net":0.26,"t":1.24,"tGross":1.86,"place":[34,0.101],"days":[0.011,0.17]}}};
export const SOURCES = {
  overnight: 'branch index-overnight (PR #891), research/edge/index-overnight/result.json',
  ibs: 'branch index-ibs (PR #895), research/edge/index-ibs/result.json',
  tom: 'branch turn-of-month (PR #826), research/edge/turn-of-month/result.json',
};

// ---------- rows -> trades with every cost column ----------
export function loadRows(file = path.join(HERE, 'rows.json.gz')) { return JSON.parse(zlib.gunzipSync(fs.readFileSync(file))); }
export function costed(study, mk, x, rates) {
  const u = unitOf(study, x), f1 = futCost(x, mk, rates), f2 = futCost(x, mk, rates, { mode: 'F2' }), f3 = futCost(x, mk, rates, { mode: 'F3' }), f1x2 = futCost(x, mk, rates, { mult: 2 });
  return { ...x, unit: u, tickR: f1.tick / u, commR: f1.comm / u, carryR: f1.carry / u, rollR: f1.roll / u, rolls: f1.rolls, r: f1.r, q: f1.q,
    fut: x.gross - f1.total / u, fut2x: x.gross - f1x2.total / u, f2: x.gross - f2.total / u, f3: x.gross - f3.total / u, cfdDiv: x.cfdNet + cfdDiv(x, mk, rates) / u };
}
export function tradesOf(R, rates) {
  const T = { overnight: {}, ibs: {}, tom: {} };
  for (const [id, o] of Object.entries(R.overnight.tests)) T.overnight[id] = o.rows.map(([date, t0, t1, entry, stop, exit, how, R0, net, spreadR, finR, nights]) =>
    costed('overnight', o.mk, { entryD: date, exitD: new Date(t1 * 1000).toISOString().slice(0, 10), days: (t1 - t0) / DAY, entry, stop, exit, how, gross: R0, cfdNet: net, cfdSpread: spreadR, cfdFin: finR, nights }, rates));
  for (const [id, o] of Object.entries(R.ibs.tests)) T.ibs[id] = o.rows.map(([entryD, exitD, entry, stop, exit, how, g, net, costR, finR, nights]) =>
    costed('ibs', o.mk, { entryD, exitD, entry, stop, exit, how, gross: g, cfdNet: net, cfdSpread: costR, cfdFin: finR, nights }, rates));
  for (const [id, o] of Object.entries(R.tom.tests)) T.tom[id] = o.rows.map(([entryD, exitD, entry, stop, exit, how, g, net, fin]) =>
    costed('tom', o.mk, { entryD, exitD, entry, stop, exit, how, gross: g, cfdNet: net, cfdSpread: g - net - fin, cfdFin: fin }, rates));
  return T;
}
const KEYS = ['gross', 'cfdNet', 'fut', 'f2', 'f3', 'cfdDiv'];
// one window's figures; mt = month-t function for that study
export function block(trs, mt) {
  const o = { n: trs.length };
  for (const k of [...KEYS, 'cfdSpread', 'cfdFin', 'tickR', 'commR', 'carryR', 'rollR', 'fut2x']) o[k] = r3(mean(trs.map((t) => t[k])));
  for (const k of KEYS) o['t_' + k] = r2(mt(trs, k));
  o.rolls = trs.reduce((a, t) => a + t.rolls, 0);
  o.total = { cfdNet: r2(trs.reduce((a, t) => a + t.cfdNet, 0)), fut: r2(trs.reduce((a, t) => a + t.fut, 0)) };
  o.medStopPct = r3(trs.map((t) => (t.entry - t.stop) / t.entry * 100).sort((a, b) => a - b)[trs.length >> 1]);
  o.meanDays = r2(mean(trs.map((t) => (t.days != null ? t.days : daysBetween(t.entryD, t.exitD)))));
  return o;
}

// ---------- the study, per study, with its own bar ----------
export function analyse(R, rates) {
  const T = tradesOf(R, rates), out = { gates: {}, studies: {} };
  const fails = [];
  const eq = (a, b, what) => { if (a !== b && !(a === 0 && b === 0)) fails.push(`${what}: ${a} vs ${b}`); };

  // index-overnight: windows by date; month t over months with a trade
  {
    const W = { decisive: ['2016-01-01', '2026-10-31'], replication: ['2005-01-01', '2015-12-31'] }, mt = (trs, k) => monthT(trs, k);
    const S = { tests: {} };
    for (const id of ['T1', 'T2']) {
      S.tests[id] = { market: id === 'T1' ? 'US500 → MES' : 'NAS100 → MNQ' };
      for (const [w, [a, b]] of Object.entries(W)) {
        const trs = T.overnight[id].filter((t) => t.entryD >= a && t.entryD <= b), bl = block(trs, mt), P = PUBLISHED.overnight[`${id}.${w}`];
        eq(bl.n, P.n, `overnight ${id} ${w} n`); eq(bl.gross, P.gross, `overnight ${id} ${w} gross`); eq(bl.cfdNet, P.net, `overnight ${id} ${w} net`);
        eq(bl.t_cfdNet, P.t, `overnight ${id} ${w} t`); eq(bl.t_gross, P.tGross, `overnight ${id} ${w} tGross`);
        const seeds = R.overnight.placebo[id][w], cm = seeds.map((s) => s.cfd / s.n), fm = seeds.map((s) => s.fut / s.n);
        const pc = [pctIO(cm, 0.05), pctIO(cm, 0.5), pctIO(cm, 0.95)].map(r3);
        pc.forEach((v, i) => eq(v, P.place[i], `overnight ${id} ${w} placebo p${[5, 50, 95][i]}`));
        bl.placebo = { cfd: pc, fut: [pctIO(fm, 0.05), pctIO(fm, 0.5), pctIO(fm, 0.95)].map(r3) }; bl._p95 = pctIO(fm, 0.95);
        bl._trs = trs; S.tests[id][w] = bl;
      }
    }
    const ps = ['T1', 'T2'].map((id) => pOne(S.tests[id].decisive.t_fut)), adj = holm(ps), cond = {};
    ['T1', 'T2'].forEach((id, i) => {
      const d = S.tests[id].decisive, r = S.tests[id].replication, fmean = mean(d._trs.map((t) => t.fut));
      const c = { n: d.n >= 300 && r.n >= 300, tDecisive: fmean > 0 && d.t_fut >= 2, replication: mean(r._trs.map((t) => t.fut)) > 0, holm: adj[i] < 0.05,
        placebo: fmean > d._p95, twiceCost: mean(d._trs.map((t) => t.fut2x)) > 0 };
      c.pass = Object.values(c).every(Boolean); c.core = c.tDecisive && c.replication; c.holmP = r3(adj[i]); cond[id] = c;
    });
    const pooled = {};
    for (const [w, [a, b]] of Object.entries(W)) {
      const all = ['T1', 'T2'].flatMap((id) => T.overnight[id].filter((t) => t.entryD >= a && t.entryD <= b)), m = new Map();
      for (const t of all) { const k = t.entryD.slice(0, 7); m.set(k, (m.get(k) || 0) + t.fut); }
      const xs = [...m.values()]; pooled[w] = { months: xs.length, meanMonthFut: r3(mean(xs)), tFut: r2(stats(xs).t), tCfd: r2(monthT(all, 'cfdNet')) };
    }
    const pooledOk = pooled.decisive.tFut >= 2 && pooled.decisive.meanMonthFut > 0 && pooled.replication.meanMonthFut > 0;
    S.pooled = pooled; S.conditions = cond; S.pooledOk = pooledOk;
    S.verdictOnFutures = (cond.T1.pass || cond.T2.pass) && pooledOk ? 'PASS' : !cond.T1.core && !cond.T2.core ? 'FAIL' : 'INCONCLUSIVE';
    S.published = 'FAIL';
    out.studies.overnight = S;
  }

  // index-ibs: windows by entry year; month t over every calendar month (empty 0)
  {
    const mDec = monthsBetween(2016, R.ibs.lastDay), mRep = monthsBetween(2005, '2015-12-31');
    const S = { tests: {} }, decT = {}, repT = {};
    const names = { T1: 'SPX500 → MES', T2: 'NAS100 → MNQ', T3: 'US30 → MYM' };
    for (const id of ['T1', 'T2', 'T3']) {
      const all = T.ibs[id]; decT[id] = all.filter((t) => +t.entryD.slice(0, 4) >= 2016); repT[id] = all.filter((t) => +t.entryD.slice(0, 4) < 2016);
      S.tests[id] = { market: names[id], decisive: block(decT[id], (trs, k) => monthT(trs, k, mDec)), replication: block(repT[id], (trs, k) => monthT(trs, k, mRep)) };
    }
    S.tests.P = { market: 'pooled', decisive: block(Object.values(decT).flat(), (trs, k) => monthT(trs, k, mDec)), replication: block(Object.values(repT).flat(), (trs, k) => monthT(trs, k, mRep)) };
    for (const id of ['T1', 'T2', 'T3', 'P']) for (const w of ['decisive', 'replication']) {
      const bl = S.tests[id][w], P = PUBLISHED.ibs[`${id}.${w}`];
      eq(bl.n, P.n, `ibs ${id} ${w} n`); eq(bl.gross, P.gross, `ibs ${id} ${w} gross`); eq(bl.cfdNet, P.net, `ibs ${id} ${w} net`); eq(bl.t_cfdNet, P.t, `ibs ${id} ${w} t`);
    }
    // placebo: per seed means; pooled = the three markets' draws together
    const seedSets = { T1: R.ibs.placebo.T1, T2: R.ibs.placebo.T2, T3: R.ibs.placebo.T3 };
    seedSets.P = seedSets.T1.map((_, s) => ['T1', 'T2', 'T3'].reduce((a, id) => ({ n: a.n + seedSets[id][s].n, cfd: a.cfd + seedSets[id][s].cfd, fut: a.fut + seedSets[id][s].fut }), { n: 0, cfd: 0, fut: 0 }));
    const plac = {};
    for (const id of ['T1', 'T2', 'T3', 'P']) {
      const sd = seedSets[id], cm = sd.map((s) => s.cfd / s.n), fm = sd.map((s) => s.fut / s.n), P = PUBLISHED.ibs[`${id}.decisive`].place;
      const trs = id === 'P' ? Object.values(decT).flat() : decT[id], ruleC = mean(trs.map((t) => t.cfdNet)), ruleF = mean(trs.map((t) => t.fut));
      const pc = [cm.filter((m) => ruleC > m).length, r3(pctIBS(cm, 0.05)), r3(pctIBS(cm, 0.5)), r3(pctIBS(cm, 0.95))];
      pc.forEach((v, i) => eq(v, P[i], `ibs ${id} placebo ${['beaten', 'p5', 'p50', 'p95'][i]}`));
      plac[id] = { cfd: pc, fut: [fm.filter((m) => ruleF > m).length, r3(pctIBS(fm, 0.05)), r3(pctIBS(fm, 0.5)), r3(pctIBS(fm, 0.95))] };
      S.tests[id].decisive.placebo = plac[id];
    }
    const pT = (id) => monthT(decT[id], 'fut', mDec), adj = holm(['T1', 'T2', 'T3'].map((id) => pOne(pT(id)))), checks = {};
    ['T1', 'T2', 'T3'].forEach((id, i) => {
      const d = decT[id], t = pT(id);
      const ch = { a: d.length >= 100, b: mean(d.map((x) => x.fut)) > 0, c: t != null && t >= 2 && adj[i] < 0.05, d: mean(repT[id].map((x) => x.fut)) > 0, e: plac[id].fut[0] >= 38 };
      checks[id] = { holmP: r3(adj[i]), checks: ch, pass: Object.values(ch).every(Boolean) };
    });
    const pd = Object.values(decT).flat(), pr = Object.values(repT).flat(), pt = monthT(pd, 'fut', mDec);
    const pch = { b: mean(pd.map((x) => x.fut)) > 0, c: pt != null && pt >= 2, d: mean(pr.map((x) => x.fut)) > 0, e: plac.P.fut[0] >= 38 };
    checks.P = { checks: pch, pass: Object.values(pch).every(Boolean) };
    S.conditions = checks; S.verdictOnFutures = Object.values(checks).some((c) => c.pass) ? 'PASS' : 'FAIL'; S.published = 'FAIL';
    out.studies.ibs = S;
  }

  // turn-of-month: in % of price; IS 2008-15, OOS 2016 on; its own t is the trade t
  {
    const S = { tests: {} }, mt = (trs, k) => monthT(trs, k), oosT = {};
    const names = { spx500: 'SPX500 → MES', us30: 'US30 → MYM', nas100: 'NAS100 → MNQ' };
    for (const k of ['spx500', 'us30', 'nas100']) {
      const all = T.tom[k], is = all.filter((t) => +t.entryD.slice(0, 4) < 2016), oos = all.filter((t) => +t.entryD.slice(0, 4) >= 2016); oosT[k] = oos;
      S.tests[k] = { market: names[k] };
      for (const [w, trs] of [['is', is], ['oos', oos]]) {
        const bl = block(trs, mt); for (const kk of KEYS) bl['tt_' + kk] = r2(stats(trs.map((t) => t[kk])).t);
        const P = PUBLISHED.tom[`${k}.${w}`];
        eq(bl.n, P.n, `tom ${k} ${w} n`); eq(bl.gross, P.gross, `tom ${k} ${w} gross`); eq(bl.cfdNet, P.net, `tom ${k} ${w} net`); eq(bl.tt_cfdNet, P.t, `tom ${k} ${w} t`); eq(bl.tt_gross, P.tGross, `tom ${k} ${w} tGross`);
        S.tests[k][w] = bl;
      }
      const sd = R.tom.placebo[k], cm = sd.map((s) => r3(s.cfd / s.n)), fm = sd.map((s) => s.fut / s.n), P = PUBLISHED.tom[`${k}.oos`];
      const ruleC = mean(oos.map((t) => t.cfdNet)), ruleF = mean(oos.map((t) => t.fut));
      eq(cm.filter((m) => ruleC > m).length, P.place[0], `tom ${k} placebo beaten`); eq(r3([...cm].sort((a, b) => a - b)[20]), P.place[1], `tom ${k} placebo median`);
      S.tests[k].oos.placebo = { cfd: [cm.filter((m) => ruleC > m).length, P.place[1]], fut: [fm.filter((m) => ruleF > m).length, r3([...fm].sort((a, b) => a - b)[20])] };
      S.tests[k].oos.days = { diff: P.days[0], t: P.days[1] };
    }
    const keys = ['spx500', 'us30', 'nas100'], adj = holm(keys.map((k) => pOne(stats(oosT[k].map((t) => t.fut)).t))), checks = {};
    keys.forEach((k, i) => {
      const o = S.tests[k].oos, st = stats(oosT[k].map((t) => t.fut));
      const c = { t1: st.mean > 0 && st.t >= 2, t2: o.placebo.fut[0] >= 38, t3: o.days.diff > 0 && o.days.t >= 2, holmP: r3(adj[i]) };
      c.pass = c.t1 && c.t2 && c.t3 && adj[i] < 0.05; checks[k] = c;
    });
    S.conditions = checks; S.verdictOnFutures = checks.spx500.pass ? 'PASS' : 'FAIL'; S.published = 'FAIL';
    out.studies.tom = S;
  }
  for (const S of Object.values(out.studies)) for (const t of Object.values(S.tests)) for (const w of Object.values(t)) if (w && typeof w === 'object') { delete w._trs; delete w._p95; }
  out.gates = { G1: 'each study\'s unchanged run.mjs re-run in a temporary directory wrote a result.json byte-identical to its branch\'s (checked by hand when rows.json.gz was written: index-overnight, index-ibs, turn-of-month)',
    G2G3: fails.length ? 'FAILED' : 'passed', failures: fails };
  return out;
}

// ---------- report ----------
const f3 = (x) => (x == null ? '–' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(3));
const f2 = (x) => (x == null ? '–' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(2));
const yn = (b) => (b ? 'yes' : 'no');
export function verdictLine(res) {
  const o = res.studies.overnight.tests, i = res.studies.ibs.tests, t = res.studies.tom.tests;
  return `INCONCLUSIVE (cost accounting, no rule tested; no study's verdict changes): on CME micro futures the same trades net ` +
    `index-overnight US500 ${f3(o.T1.decisive.fut)}R / NAS100 ${f3(o.T2.decisive.fut)}R a trade (CFD ${f3(o.T1.decisive.cfdNet)} / ${f3(o.T2.decisive.cfdNet)}), ` +
    `index-ibs SPX500 ${f3(i.T1.decisive.fut)} / NAS100 ${f3(i.T2.decisive.fut)} / US30 ${f3(i.T3.decisive.fut)}R (CFD ${f3(i.T1.decisive.cfdNet)} / ${f3(i.T2.decisive.cfdNet)} / ${f3(i.T3.decisive.cfdNet)}), ` +
    `turn-of-month SPX500 ${f3(t.spx500.oos.fut)} % / NAS100 ${f3(t.nas100.oos.fut)} % (CFD ${f3(t.spx500.oos.cfdNet)} / ${f3(t.nas100.oos.cfdNet)}), 2016 on; ` +
    `under each study's own bar with futures costs: index-overnight ${res.studies.overnight.verdictOnFutures}, index-ibs ${res.studies.ibs.verdictOnFutures}, turn-of-month ${res.studies.tom.verdictOnFutures}.`;
}

export function report(res) {
  const L = [], S = res.studies;
  L.push(`**Verdict:** ${res.verdict}`, '');
  L.push('# The same index trades on CME micro futures (14 Nov 2026)', '');
  L.push('Paper research, **cost accounting only** (`PREREGISTRATION.md`, pushed alone first). The trades are the three studies\' own,',
    'produced by their unchanged code and re-costed, never re-selected. No rule is tested here and **no verdict of the three studies',
    'changes**: a micro future is a different instrument, and a route picked after seeing the CFD loss, on the same history the rule',
    'was judged on, is not evidence of an edge. A futures route would need its own pre-registration and its own forward record.', '');
  L.push('## Gates', '');
  L.push(`- G1: ${res.gates.G1}.`);
  L.push(`- G2 / G3: the stored rows reproduce every published n, mean gross, mean CFD net, t and placebo figure used here: **${res.gates.G2G3}**${res.gates.failures.length ? ` (${res.gates.failures.join('; ')})` : ''}.`, '');
  L.push('## Cost model (pre-registered)', '');
  L.push('Per trade, in index points, divided by the trade\'s own 1R (turn-of-month: by its entry price, in %): **2 ticks** a round trip (1 tick a side: MES 0.25, MNQ 0.25, MYM 1 pt),',
    '**$1.24 commission and fees** a round trip a micro contract ($0.62 a side, the figure of `research/edge/costs/RESULT.md`; broker-dependent, not verified),',
    '**carry** (r − q) × days held / 365 × entry (r = FRED DGS2 as of the entry date, 3.85 % before 2006; q = the index\'s dividend yield, a yearly figure **from memory, not verified**;',
    'not floored, so a credit when q > r), and one more round trip per quarterly roll held through (none in these holds). F2 = the repository\'s all-in micro round trip',
    '(`ICT_COST_PTS`: MES 1.00, MNQ 1.37, MYM 5.5 pt), F3 = no dividend (q = 0). "CFD + div" = the published CFD net plus the dividend a CFD long is credited, which the published figures leave out.', '');
  const hdr = '| Test | Window | n | Gross | CFD net (published) | Futures net F1 | F2 all-in | F3 q = 0 | CFD + div | t gross | t CFD | t futures | t F2 |';
  const sep = '|---|---|---|---|---|---|---|---|---|---|---|---|---|';
  const row = (name, w, b, tk = 't_') => L.push(`| ${name} | ${w} | ${b.n} | ${f3(b.gross)} | ${f3(b.cfdNet)} | **${f3(b.fut)}** | ${f3(b.f2)} | ${f3(b.f3)} | ${f3(b.cfdDiv)} | ${f2(b[tk + 'gross'])} | ${f2(b[tk + 'cfdNet'])} | **${f2(b[tk + 'fut'])}** | ${f2(b[tk + 'f2'])} |`);
  const comp = '| Test | Window | CFD spread | CFD financing | ticks | commission | carry | rolls | median stop % of price | mean days held |';
  const csep = '|---|---|---|---|---|---|---|---|---|---|';
  const crow = (name, w, b) => L.push(`| ${name} | ${w} | ${f3(b.cfdSpread)} | ${f3(b.cfdFin)} | ${f3(b.tickR)} | ${f3(b.commR)} | ${f3(b.carryR)} | ${b.rolls} | ${b.medStopPct} | ${b.meanDays} |`);

  L.push('## index-overnight (R a trade; month-sum t over months with a trade, its own form)', '', hdr, sep);
  for (const id of ['T1', 'T2']) for (const w of ['decisive', 'replication']) row(`${id} ${S.overnight.tests[id].market}`, w === 'decisive' ? '2016-26' : '2005-15', S.overnight.tests[id][w]);
  L.push('', 'Cost components (R a trade):', '', comp, csep);
  for (const id of ['T1', 'T2']) for (const w of ['decisive', 'replication']) crow(`${id}`, w === 'decisive' ? '2016-26' : '2005-15', S.overnight.tests[id][w]);
  L.push('', 'Its own bar with futures costs:', '', '| Test | n ≥ 300 both | net > 0, t ≥ 2 (2016-26) | net > 0 (2005-15) | Holm p < 0.05 | above placebo p95 | net > 0 at 2x trading cost | Pass |', '|---|---|---|---|---|---|---|---|');
  for (const id of ['T1', 'T2']) { const c = S.overnight.conditions[id]; L.push(`| ${id} | ${yn(c.n)} | ${yn(c.tDecisive)} | ${yn(c.replication)} | ${yn(c.holm)} (p ${c.holmP}) | ${yn(c.placebo)} (p95 ${f3(S.overnight.tests[id].decisive.placebo.fut[2])}) | ${yn(c.twiceCost)} | ${c.pass ? 'PASS' : 'no'} |`); }
  const po = S.overnight.pooled;
  L.push('', `Pooled (monthly sums of T1 + T2, futures): 2016-26 ${f3(po.decisive.meanMonthFut)}R a month, t ${f2(po.decisive.tFut)}; 2005-15 ${f3(po.replication.meanMonthFut)}R, t ${f2(po.replication.tFut)}. Pooled condition met: ${yn(S.overnight.pooledOk)}. **On futures costs its bar reads ${S.overnight.verdictOnFutures}** (published on CFD costs: FAIL).`, '');

  L.push('## index-ibs (R a trade; month-sum t over every calendar month, empty 0, its own form)', '', hdr, sep);
  for (const id of ['T1', 'T2', 'T3', 'P']) for (const w of ['decisive', 'replication']) row(`${id} ${S.ibs.tests[id].market}`, w === 'decisive' ? '2016-now' : '2005-15', S.ibs.tests[id][w]);
  L.push('', 'Cost components (R a trade):', '', comp, csep);
  for (const id of ['T1', 'T2', 'T3', 'P']) for (const w of ['decisive', 'replication']) crow(id, w === 'decisive' ? '2016-now' : '2005-15', S.ibs.tests[id][w]);
  L.push('', 'Its own bar with futures costs:', '', '| Test | (a) n ≥ 100 | (b) net > 0 | (c) month t ≥ 2, Holm p < 0.05 | (d) 2005-15 net > 0 | (e) placebo beaten ≥ 38 / 40 | Pass |', '|---|---|---|---|---|---|---|');
  for (const id of ['T1', 'T2', 'T3', 'P']) { const c = S.ibs.conditions[id], ch = c.checks; L.push(`| ${id} | ${ch.a == null ? '–' : yn(ch.a)} | ${yn(ch.b)} | ${yn(ch.c)}${c.holmP != null ? ` (Holm p ${c.holmP})` : ''} | ${yn(ch.d)} | ${yn(ch.e)} (${S.ibs.tests[id].decisive.placebo.fut[0]} / 40) | ${c.pass ? 'PASS' : 'no'} |`); }
  L.push('', `**On futures costs its bar reads ${S.ibs.verdictOnFutures}** (published on CFD costs: FAIL).`, '');

  L.push('## turn-of-month (% of price a trade; its own t is the trade t; month-sum t equals it here, one trade a month)', '', hdr, sep);
  for (const k of ['spx500', 'us30', 'nas100']) for (const w of ['oos', 'is']) row(S.tom.tests[k].market, w === 'oos' ? '2016-now' : '2008-15', S.tom.tests[k][w], 'tt_');
  L.push('', 'Cost components (% of price a trade):', '', comp.replace('median stop % of price', 'median stop % of price (2 x ATR)'), csep);
  for (const k of ['spx500', 'us30', 'nas100']) for (const w of ['oos', 'is']) crow(k, w === 'oos' ? '2016-now' : '2008-15', S.tom.tests[k][w]);
  L.push('', 'Its own bar with futures costs (T3, turn days against the rest before costs, is unchanged by any cost):', '', '| Market | T1 net > 0, t ≥ 2 | T2 placebo ≥ 38 / 40 | T3 Welch t ≥ 2 | Holm p | Pass |', '|---|---|---|---|---|---|');
  for (const k of ['spx500', 'us30', 'nas100']) { const c = S.tom.conditions[k]; L.push(`| ${k} | ${yn(c.t1)} | ${yn(c.t2)} (${S.tom.tests[k].oos.placebo.fut[0]}) | ${yn(c.t3)} (t ${S.tom.tests[k].oos.days.t}) | ${c.holmP} | ${c.pass ? 'PASS' : 'no'} |`); }
  L.push('', `**On futures costs its bar reads ${S.tom.verdictOnFutures}** (published on CFD costs: FAIL; the verdict is on SPX500).`, '');
  L.push('## Reading', '', ...res.reading, '');
  L.push('## Assumptions and limits', '', ...res.limits, '');
  L.push('To repeat: see the head of `dump.mjs` (each branch\'s own code in a temporary directory, its own fetch), then `node research/edge/index-futures-cost/run.mjs`. Tests: `tests/index-futures-cost.test.mjs`.');
  return L.join('\n') + '\n';
}

// the plain reading, written after the numbers were seen (not part of any condition)
export const READING = [
  '- **Where the CFD money went, and what futures keep of it.** On the decisive windows the CFD route paid 0.044R (US500 overnight), 0.033R (NAS100 overnight) and 0.041-0.060R (IBS) a trade in spread and financing; the same trades on micros pay 0.011-0.022R in ticks, commission and carry. Overnight financing is the line that disappears: the futures carry is (r − q), and the dividend offsets most of the rate, so it costs 0.002-0.004R a one-night trade. The ticks and the commission are fixed in points, so they are cheap at 2016-26 index levels and dear at 2005-15 levels (US500 overnight 0.044R on futures against 0.040R on the CFD in 2005-15).',
  '- **Against each study\'s own bar, with futures costs in place of CFD costs**: index-overnight still FAILS (NAS100 meets every condition on 2016-26, +0.015R, t 2.02, Holm p 0.043, but loses on 2005-15, −0.008R; US500 +0.001R, t 0.08); turn-of-month still FAILS (no market reaches t 2: SPX500 +0.068 %, t 0.42; NAS100 +0.350 %, t 1.68; its T3, turn days against the rest, is before costs and fails whatever the cost); **index-ibs T2 (NAS100) meets all five of its conditions**: +0.086R a trade on 2016-now (n 473, month-sum t 2.56, Holm p 0.016), 2005-15 +0.016R (t 0.56), above 40 of 40 placebo seeds. The all-in sensitivity F2 gives +0.084R, t 2.51; q = 0 gives +0.084R. SPX500, US30 and the pooled test still fall short of t 2.',
  '- **That is not a new verdict and not an edge.** It is a different instrument chosen after the CFD result was seen, on the same 2005-26 history the rule was judged on, with three studies and nine tests looked at here; the NAS100 IBS long never replicated on 2005-15 on any cost basis (gross +0.051R, t 1.82; futures t 0.56); micros did not exist before May 2019 (from June 2019 on, post hoc: +0.073R, t 2.08, n 347); and one MNQ at these stops risked a median of about $1,090 in 2026, so 0.25 % a trade needs an account of about $435,000. index-ibs\'s own pre-registration said a PASS would at most go to the owner as a forward paper shadow, never a live rule; the most this result can support is that question, put with its own pre-registration and judged only on a forward record. No proposal is written here.',
  '- **The CFD figures were also a little harsher than the CFD itself**: they leave out the dividend a CFD long is credited, worth 0.002-0.007R a one- or two-night trade and 0.01-0.03 % of price a turn-of-month hold. With it the CFD nets move up a little (column "CFD + div") and futures are still ahead on every decisive window.',
];

export const LIMITS = [
  '- **Micro index futures started trading in May 2019.** Every figure before that assumes the micro tick and fee schedule anyway (a hypothetical instrument). The E-minis (ES, NQ, YM) existed with the same tick in points and ten times the dollars a point, so a tenth of the commission in points, but one E-mini risks ten times a micro (about $4,000-11,000 at these stops in 2026).',
  '- **Whole contracts are ignored**: every trade is 1R, as in the studies. In 2026 one MES at these stops risked about $320-590 (median $430-470), one MNQ $740-1,430 (median $1,000-1,090), one MYM $280-420 (10th to 90th percentile of the trades): at 0.25 % a trade that is an account of $110,000 (MYM) to $435,000 (MNQ). A smaller account cannot hold these trades on micros at the studies\' risk.',
  '- **The price path is the OANDA CFD mid**, taken as the cash index; a future trades the same points plus a basis. The 16:00 and 09:30 prices of a future are not the cash index\'s and the futures spread outside the cash session is wider than one tick (the overnight leg enters at 16:00 and exits at 09:30, both inside or at the edge of the cash session). Slippage beyond one tick a side is in F2 only.',
  '- **r is a 2-year Treasury yield**, not the 3-month rate a front future discounts; q is a yearly approximation from memory. The carry is a few thousandths of an R for one-day holds, so neither moves a figure here by more than about 0.005R.',
  '- **Commission $0.62 a side** is the repository\'s figure; brokers charge from about $0.25 to over $1 a side a micro, plus exchange and regulatory fees.',
  '- Nothing here touches a stop: every trade keeps the stop its study gave it. Paper only; nothing live changed and no proposal is written.',
];

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rates = JSON.parse(fs.readFileSync(path.join(HERE, 'rates.json'), 'utf8'));
  const res0 = analyse(loadRows(), rates);
  const res = { study: 'index-futures-cost', title: 'The same index trades on CME micro futures (cost accounting)', built: '2026-11-14', verdictClass: 'INCONCLUSIVE',
    system: 'index-overnight, index-ibs and turn-of-month trades re-costed as MES / MNQ / MYM (not a council system)', sources: SOURCES,
    model: { contracts: CONTRACTS, ticksSide: TICKS_SIDE, commSide: COMM_SIDE, rate: 'FRED DGS2 weekly as of the entry date (rates.json, from research/edge/gold-carry/rates.json); 3.85 % before 2006', divYield: 'rates.json divYield, from memory, not verified' },
    ...res0 };
  res.verdict = verdictLine(res);
  res.reading = READING;
  res.limits = LIMITS;
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(res));
  console.log(res.verdict); console.log('gates', res.gates.G2G3, res.gates.failures.slice(0, 10));
}
