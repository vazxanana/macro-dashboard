// Edge research · weekend-gap-late-entry: Rule G of research/edge/fx-weekend-gap (#880, branch fx-weekend-gap), FROZEN, with
// only its entry moved later: the close of the first M5 candle at or after the reopen candle's start + 30 / 60 / 120 minutes
// (60 = 18:05 New York, the primary test), when the gap has not closed and Rule G's own stop has not been touched meanwhile.
// Gap, side, target (Friday's close), stop LEVEL, exit (stop first, Monday 12:00 New York) and the cost formula are the frozen
// code's. frozen.mjs is #880's run.mjs byte for byte (sha256 pinned in the test); nothing in it is edited. The frozen ruleG
// enters at the reopen candle's close with no way to pass another time, so this file wraps it: it takes ruleG's trade and
// books the same side / target / stop from a later candle through the frozen book(). At delay 0 that is ruleG's own trade.
// 18 pairs (the union of #880, #928 and #938's headline tests); decisive 2016 to now, replication 2010-15.
// PREREGISTRATION.md was committed alone before this file existed. Paper research only: nothing here trades.
//   CANDLES=<dir> GATE=<dir of #880's files> R880=<#880 result.json> R928=<#928 result.json> R938=<#938 result.json> \
//     node run.mjs run
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { K, PAIRS, weeks, ruleG, book, stats, tOf, normP, mulberry, lowerT, toBars, costPx, pipOf, study } from './frozen.mjs';

export const FROZEN_SHA256 = '3dfd1dd71f1c1bb2512c5ee0f26573bcb38944f152634ccd622efc1b7002b273';
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
export const G880 = PAIRS.slice();                                                       // #880's six
export const G928 = ['eurgbp', 'gbpjpy', 'audjpy', 'euraud', 'gbpaud', 'eurchf'];         // #928's crosses (also #938 S1)
export const G938 = ['nzdusd', 'usdcad', 'cadjpy', 'nzdjpy', 'audnzd', 'audcad'];         // #938 S2
export const ALL = [...G880, ...G928, ...G938];
// the studies' own quoted spreads (pips), as frozen in their tables
export const SPREAD = { eurusd: 0.3, gbpusd: 0.3, usdjpy: 0.3, audusd: 0.3, usdchf: 0.3, eurjpy: 0.3,
  eurgbp: 0.4, eurchf: 0.5, audjpy: 0.6, gbpjpy: 0.9, euraud: 0.9, gbpaud: 1.3,
  usdcad: 0.3, nzdusd: 0.4, audcad: 0.8, cadjpy: 0.8, audnzd: 1.0, nzdjpy: 1.0 };
// the added entry spread (pips; assumed from the settled reads of 8 Nov 2026): 0.6 on the dollar pairs, 1.0 on the rest
export const USD_PAIRS = ['eurusd', 'gbpusd', 'usdjpy', 'audusd', 'usdchf', 'usdcad', 'nzdusd'];
export const ENTRY = Object.fromEntries(ALL.map((p) => [p, USD_PAIRS.includes(p) ? 0.6 : 1.0]));
export const WIN = { dec: [T('2016-01-01'), Infinity], rep: [T('2010-01-01'), T('2016-01-01')] };
export const DELAYS = [0, 30, 60, 120]; export const PRIMARY = 60; export const TESTS = [30, 60, 120];
export const CUT = T('2026-11-13');
const inWin = (F, w) => F >= WIN[w][0] && F < WIN[w][1];

// the frozen cost formula with the pair's quoted spread: K.SPREAD_PIPS set only while that pair's trade is booked
export function withSpread(spread, fn) { const s = K.SPREAD_PIPS; K.SPREAD_PIPS = spread; try { return fn(); } finally { K.SPREAD_PIPS = s; } }

// the late entry: Rule G's trade g (from the frozen ruleG) entered at the close of the first candle starting at or after the
// reopen candle's start + delay minutes; same side, target (Friday's close) and stop LEVEL; booked by the frozen book()
export function lateTrade(pair, M5, w, g, delay, entryPips = ENTRY[pair], spread = SPREAD[pair]) {
  const iR = w.iR, s = g.side, fc = w.fc, S = g.stop;
  const iE = delay === 0 ? iR : lowerT(M5, M5[iR].time + delay * 60);
  if (iE >= M5.length || M5[iE].time + K.M5 > w.noon) return { skip: 'late' };
  for (let k = iR + 1; k <= iE; k++) { const b = M5[k];
    if (s > 0 ? b.low <= S : b.high >= S) return { skip: 'stopped' };
    if (s > 0 ? b.high >= fc : b.low <= fc) return { skip: 'filled' }; }
  // at Rule G's own candle the risk is ruleG's r0 itself (|entry − S| would differ from it by float rounding only)
  const entry = M5[iE].close, r = iE === iR ? g.r0 : Math.abs(entry - S);
  if (r < K.R0_MIN * w.atr) return { skip: 'small' };
  const t = withSpread(spread, () => book(pair, M5, w, iE, s, entry, r, fc, S));
  const cB = withSpread(spread, () => costPx(pair, entry)) + entryPips * pipOf(pair);
  return { ...t, delay, atr: w.atr, rr: +(Math.abs(fc - entry) / r).toFixed(4), netFrozen: t.net,
    costB: +(cB / r).toFixed(4), netB: +(t.R - cB / r).toFixed(4), net2x: +(t.R - 2 * cB / r).toFixed(4) };
}

// one pair: the frozen weeks, #880's eligibility, the frozen ruleG, then every delay; plus the non-gap weeks for the placebo
export function pairRun(pair, M5, delays = DELAYS) {
  const W = weeks(M5).filter((w) => inWin(w.F, 'dec') || inWin(w.F, 'rep')), skipped = {};
  for (const w of W) if (w.skip) skipped[w.skip] = (skipped[w.skip] || 0) + 1;
  const used = W.filter((w) => !w.skip), elig = used.filter((w) => w.gapAtr >= K.GAP_MIN && w.gapAtr <= K.GAP_MAX);
  const by = Object.fromEntries(delays.map((d) => [d, []])), no = Object.fromEntries(delays.map((d) => [d, {}])), G = [], gNo = {};
  for (const w of elig) {
    const g = withSpread(SPREAD[pair], () => ruleG(pair, M5, w));
    if (g.skip) { gNo[g.skip] = (gNo[g.skip] || 0) + 1; continue; }
    G.push(g);
    for (const d of delays) { const t = lateTrade(pair, M5, w, g, d); if (t.skip) no[d][t.skip] = (no[d][t.skip] || 0) + 1; else by[d].push(t); }
  }
  return { pair, M5, weeks: { total: W.length, used: used.length, eligible: elig.length, skipped }, G, gNo, by, no,
    nonGap: used.filter((w) => w.gapAtr < K.GAP_MIN) };
}

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const r4 = (x) => +x.toFixed(4);
const med = (a) => (a.length ? r4(a.slice().sort((x, y) => x - y)[a.length >> 1]) : 0);
export function seriesStats(T0, val) {
  const Tr = T0.slice().sort((a, b) => a.filled - b.filled), x = Tr.map(val);
  let cum = 0, hi = 0, dd = 0; for (const v of x) { cum += v; if (cum > hi) hi = cum; if (hi - cum > dd) dd = hi - cum; }
  const mon = new Map(); Tr.forEach((t, i) => { const k = new Date(t.F * 1000).toISOString().slice(0, 7); mon.set(k, (mon.get(k) || 0) + x[i]); });
  return { mean: r4(mean(x)), t: r4(tOf(x)), tMonth: r4(tOf([...mon.values()])), months: mon.size, total: r4(cum), maxDD: r4(dd) };
}
// n, win rate, exits and, at 0 / base / 2x cost, mean R, trade t, monthly t, total, worst closed drawdown
export function statsL(T0) {
  const ex = {}; for (const t of T0) ex[t.exit] = (ex[t.exit] || 0) + 1;
  return { n: T0.length, win: T0.length ? r4(T0.filter((t) => t.R > 0).length / T0.length) : 0,
    gross: seriesStats(T0, (t) => t.R), base: seriesStats(T0, (t) => t.netB), x2: seriesStats(T0, (t) => t.net2x),
    frozenOnly: seriesStats(T0, (t) => t.netFrozen), medRiskPips: med(T0.map((t) => t.r0Pips)), medCostR: med(T0.map((t) => t.costB)),
    meanRR: r4(mean(T0.map((t) => t.rr))), nights: T0.reduce((s, t) => s + t.nights, 0), exits: ex };
}
// Holm-adjusted one-sided p (step-down, monotone; #928's function)
export function holmAdj(ps) {
  const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = ps.map(() => 1); let run = 0;
  o.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (o.length - r) * p)); out[i] = run; });
  return out;
}
// the pre-registered bar (primary only)
export function bar(dec, rep) {
  const checks = { decNet: dec.base.mean > 0, repNet: rep.base.mean > 0, decTMonth: dec.base.tMonth >= 2, dec2x: dec.x2.mean > 0 };
  return { checks, pass: Object.values(checks).every(Boolean) };
}

// placebo: per trade (pairs in ALL order, fill order), a random non-gap week of the same pair and window, a random side, entry
// at the same delay after that week's reopen, the trade's own stop / target distances in ATR units, the same base cost
export function placebo(runs, delay, seeds = K.SEEDS) {
  const out = { dec: [], rep: [] }, lateSkips = [];
  for (let seed = 1; seed <= seeds; seed++) { const rnd = mulberry(seed), acc = { dec: [], rep: [] }; let late = 0;
    for (const p of runs) { const pool = { dec: p.nonGap.filter((w) => inWin(w.F, 'dec')), rep: p.nonGap.filter((w) => inWin(w.F, 'rep')) };
      for (const x of p.by[delay].slice().sort((a, b) => a.filled - b.filled)) { const win = inWin(x.F, 'dec') ? 'dec' : 'rep', P = pool[win];
        const u = P[Math.floor(rnd() * P.length)], side = rnd() < 0.5 ? -1 : 1;
        const iE = lowerT(p.M5, p.M5[u.iR].time + delay * 60);
        if (iE >= p.M5.length || p.M5[iE].time + K.M5 > u.noon) { late++; continue; }
        const dS = Math.abs(x.entry - x.stop) / x.atr, dT = Math.abs(x.target - x.entry) / x.atr, entry = p.M5[iE].close, r = dS * u.atr;
        const t = withSpread(SPREAD[p.pair], () => book(p.pair, p.M5, u, iE, side, entry, r, entry + side * dT * u.atr, entry - side * r));
        const cB = withSpread(SPREAD[p.pair], () => costPx(p.pair, entry)) + ENTRY[p.pair] * pipOf(p.pair);
        acc[win].push(t.R - cB / r); } }
    out.dec.push(r4(mean(acc.dec))); out.rep.push(r4(mean(acc.rep))); lateSkips.push(late); }
  const sum = (a) => { const s = a.slice().sort((x, y) => x - y), q = (f) => s[Math.min(s.length - 1, Math.floor(f * s.length))];
    return { min: s[0], p5: q(0.05), median: q(0.5), p95: q(0.95), max: s.at(-1), runs: a }; };
  return { seeds, dec: sum(out.dec), rep: sum(out.rep), lateSkipped: lateSkips.reduce((a, b) => a + b, 0) };
}

// join two candle files of one pair: the later from its first candle on, the earlier before it; overlap compared
export function join(early, late) {
  const t0 = late[0][0], lm = new Map(late.map((r) => [r[0], r])); let both = 0, diff = 0;
  for (const r of early) if (r[0] >= t0) { const q = lm.get(r[0]); if (q) { both++; if (JSON.stringify(q) !== JSON.stringify(r)) diff++; } }
  return { rows: [...early.filter((r) => r[0] < t0), ...late], overlap: { both, diff } };
}

// ─── run ───
const MODE = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ? process.argv[2] : null;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');
const raw = (f) => JSON.parse(zlib.gunzipSync(fs.readFileSync(f)));
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const row = (t) => [t.pair, t.fri, t.side, t.entry, t.r0Pips, +t.exitPx.toFixed(5), t.exit, t.R, t.netB, t.net2x];
if (MODE === 'run') {
  if (sha(path.join(HERE, 'frozen.mjs')) !== FROZEN_SHA256) throw new Error('frozen.mjs is not the pinned copy');
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b), C = process.env.CANDLES, R = (k) => JSON.parse(fs.readFileSync(process.env[k], 'utf8'));
  const r880 = R('R880'), r928 = R('R928'), r938 = R('R938');
  // ── gate 1: the frozen study() on #880's own files
  const gd = {}; for (const p of PAIRS) gd[p] = toBars(raw(path.join(process.env.GATE, `GATE-${p}-5m.json.gz`))).filter((b) => b.time >= K.DATA_FROM);
  const g1s = study(gd);
  const gate1 = { decSame: same(g1s.rules.G.dec, r880.rules.G.dec), repSame: same(g1s.rules.G.rep, r880.rules.G.rep), tradesSame: same(g1s.trades.G, r880.trades.G),
    got: { dec: g1s.rules.G.dec, rep: g1s.rules.G.rep, nTrades: g1s.trades.G.length } };
  gate1.pass = gate1.decSame && gate1.repSame && gate1.tradesSame;
  for (const k of Object.keys(gd)) delete gd[k];
  console.log('gate1', JSON.stringify({ pass: gate1.pass, decSame: gate1.decSame, repSame: gate1.repSame, tradesSame: gate1.tradesSame }));
  // ── the joined candles
  const SRC = { early: {}, late: {} };
  for (const p of G880) { SRC.early[p] = `fxrep/R2-${p}-5m.json.gz`; SRC.late[p] = `fxrep2/GATE-${p}-5m.json.gz`; }
  for (const p of G928) { SRC.early[p] = `fxrep2/S1-${p}-5m.json.gz`; SRC.late[p] = `fxrep/R1-${p}-5m.json.gz`; }
  for (const p of G938) { SRC.early[p] = `wglate/E/E-${p}-5m.json.gz`; SRC.late[p] = `fxrep2/S2-${p}-5m.json.gz`; }
  const runs = [], candles = {};
  for (const p of ALL) { const fe = path.join(C, SRC.early[p]), fl = path.join(C, SRC.late[p]), j = join(raw(fe), raw(fl));
    const M5 = toBars(j.rows.filter((r) => r[0] < CUT));
    candles[p] = { early: { file: SRC.early[p], sha256: sha(fe) }, late: { file: SRC.late[p], sha256: sha(fl) }, overlap: j.overlap, m5: M5.length, from: iso(M5[0].time), to: iso(M5.at(-1).time) };
    runs.push(pairRun(p, M5)); }
  // ── gate 2: delay 0, no entry spread, #880's six at 0.3 pip = #880's published Rule G; delay 0 = ruleG trade by trade
  const zero = (p) => p.by[0];
  const g880 = runs.filter((p) => G880.includes(p.pair)).flatMap(zero);
  const dec880 = stats(g880.filter((t) => t.F >= K.DEC_FROM)), rep880 = stats(g880.filter((t) => t.F >= K.REP[0] && t.F < K.REP[1]));
  const key = (t) => [t.pair, t.F, t.side, t.entry, t.r0, t.exitPx, t.exit, t.R].join('|');
  const tbt = runs.every((p) => same(p.G.map(key), p.by[0].map(key)));
  const gate2 = { decSame: same(dec880, r880.rules.G.dec), repSame: same(rep880, r880.rules.G.rep), tradeByTrade: tbt, got: { dec: dec880, rep: rep880 } };
  gate2.pass = gate2.decSame && gate2.repSame && gate2.tradeByTrade;
  // ── gate 3: delay 0, no entry spread, at their own spreads = #928 R1 / R2 and #938 S1 / S2
  const pick = (pairs, from, to) => runs.filter((p) => pairs.includes(p.pair)).flatMap(zero).filter((t) => t.F >= from && t.F < to);
  const cmp = (got, pub) => { const s = stats(got); return { got: { n: s.n, net: s.net, tMonth: s.tMonth }, pub: { n: pub.n, net: pub.net, tMonth: pub.tMonth }, same: s.n === pub.n && s.net === pub.net && s.tMonth === pub.tMonth }; };
  const gate3 = { R1: cmp(pick(G928, T('2020-01-01'), Infinity), r928.tests.R1), R2: cmp(pick(G880, T('2010-01-01'), T('2016-01-01')), r928.tests.R2),
    S1: cmp(pick(G928, T('2010-01-01'), T('2020-01-01')), r938.tests.S1), S2: cmp(pick(G938, T('2016-01-01'), Infinity), r938.tests.S2) };
  gate3.pass = ['R1', 'R2', 'S1', 'S2'].every((k) => gate3[k].same);
  const gate = { gate1, gate2, gate3, pass: gate1.pass && gate2.pass && gate3.pass };
  console.log('gate2', JSON.stringify({ pass: gate2.pass, decSame: gate2.decSame, repSame: gate2.repSame, tradeByTrade: tbt }));
  console.log('gate3', JSON.stringify(Object.fromEntries(['R1', 'R2', 'S1', 'S2'].map((k) => [k, gate3[k].same ? 'same' : gate3[k]]))));
  console.log('overlap', JSON.stringify(Object.fromEntries(ALL.map((p) => [p, candles[p].overlap]))));
  const base = { topic: 'weekend-gap-late-entry', built: '2026-11-14', at: new Date().toISOString(), prereg: 'research/edge/weekend-gap-late-entry/PREREGISTRATION.md',
    frozenFrom: 'research/edge/fx-weekend-gap/run.mjs (branch fx-weekend-gap, #880)', frozenSha256: FROZEN_SHA256 };
  if (!gate.pass) { fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ ...base, verdict: 'GATE FAILED', gate, candles }, null, 1) + '\n'); console.log('GATE FAILED'); process.exit(1); }
  // ── the tests
  const lastF = Math.max(...runs.flatMap((p) => p.by[0].map((t) => t.F)));
  const tests = {};
  for (const d of DELAYS) { const all = runs.flatMap((p) => p.by[d]), no = {};
    for (const p of runs) for (const [s, n] of Object.entries(p.no[d])) no[s] = (no[s] || 0) + n;
    const o = { delay: d, noTrade: no };
    for (const w of ['dec', 'rep']) { const Tw = all.filter((t) => inWin(t.F, w));
      o[w] = statsL(Tw);
      o[w].byGroup = Object.fromEntries([['880', G880], ['928', G928], ['938', G938]].map(([k, ps]) => { const s = statsL(Tw.filter((t) => ps.includes(t.pair))); return [k, { n: s.n, net: s.base.mean, t: s.base.t, tMonth: s.base.tMonth, gross: s.gross.mean }]; }));
      o[w].byPair = Object.fromEntries(ALL.map((p) => { const s = statsL(Tw.filter((t) => t.pair === p)); return [p, { n: s.n, gross: s.gross.mean, net: s.base.mean, t: s.base.t, tMonth: s.base.tMonth }]; }));
      const by = {}; for (const t of Tw) (by[t.fri.slice(0, 4)] ||= []).push(t);
      o[w].byYear = Object.fromEntries(Object.entries(by).sort().map(([y, a]) => [y, { n: a.length, net: r4(mean(a.map((t) => t.netB))), total: r4(a.reduce((s, t) => s + t.netB, 0)) }])); }
    tests[d] = o; }
  const ps = TESTS.map((d) => normP(tests[d].dec.base.tMonth)), adj = holmAdj(ps);
  TESTS.forEach((d, i) => { tests[d].p = r4(ps[i]); tests[d].pAdj = r4(adj[i]); });
  for (const d of TESTS) { tests[d].placebo = placebo(runs, d); tests[d].placebo.atOrAbove = { dec: tests[d].placebo.dec.runs.filter((x) => x >= tests[d].dec.base.mean).length, rep: tests[d].placebo.rep.runs.filter((x) => x >= tests[d].rep.base.mean).length }; }
  const b = bar(tests[PRIMARY].dec, tests[PRIMARY].rep);
  const robust = { holm: tests[PRIMARY].pAdj < 0.05, placebo: tests[PRIMARY].dec.base.mean > tests[PRIMARY].placebo.dec.p95 };
  const verdict = b.pass ? (robust.holm && robust.placebo ? 'PASS' : 'PASS (not robust)') : 'FAIL';
  const out = { ...base, system: 'Forex Sunday-open gap fade (Rule G of fx-weekend-gap, frozen) entered later: at the close of the first M5 candle 30 / 60 / 120 min after the reopen candle (60 = 18:05 New York, primary), same side, target Friday\'s close, Rule G\'s own stop level, out Monday 12:00 New York; 18 pairs, OANDA mid M5',
    pairs: ALL, spread: SPREAD, entrySpread: ENTRY, params: K, windows: { decisive: `weeks with Friday 2016-01-01 to ${new Date(lastF * 1000).toISOString().slice(0, 10)}`, replication: 'weeks with Friday 2010-01-01 to 2015-12-31' },
    primary: PRIMARY, bar: b, robust, verdict, gate, candles, weeks: Object.fromEntries(runs.map((p) => [p.pair, { ...p.weeks, ruleGNoTrade: p.gNo }])), tests,
    trades: Object.fromEntries(DELAYS.map((d) => [d, runs.flatMap((p) => p.by[d]).sort((a, c) => a.filled - c.filled).map(row)])) };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  for (const d of DELAYS) for (const w of ['dec', 'rep']) { const v = tests[d][w];
    console.log(d, w, JSON.stringify({ n: v.n, win: v.win, gross: v.gross, base: v.base, x2: v.x2, frozenOnly: v.frozenOnly.mean, medRisk: v.medRiskPips, medCostR: v.medCostR, rr: v.meanRR, exits: v.exits, nights: v.nights })); }
  for (const d of DELAYS) console.log(d, 'noTrade', JSON.stringify(tests[d].noTrade), 'p', tests[d].p, 'pAdj', tests[d].pAdj);
  for (const d of TESTS) console.log(d, 'placebo', JSON.stringify({ dec: { ...tests[d].placebo.dec, runs: undefined }, rep: { ...tests[d].placebo.rep, runs: undefined }, at: tests[d].placebo.atOrAbove, late: tests[d].placebo.lateSkipped }));
  for (const d of DELAYS) for (const w of ['dec', 'rep']) console.log(d, w, 'groups', JSON.stringify(tests[d][w].byGroup));
  console.log('bar', JSON.stringify(b), 'robust', JSON.stringify(robust), 'verdict', verdict);
}
