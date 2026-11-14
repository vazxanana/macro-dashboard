// Edge research · fx-weekend-gap-replicate: Rule G of research/edge/fx-weekend-gap (#880, branch fx-weekend-gap), FROZEN,
// on data #880 did not use. frozen.mjs is #880's run.mjs byte for byte (sha256 pinned in the test); nothing in it is edited.
// This file only loads candles, picks the weeks of each window, sets the pre-registered quoted spread per pair (the frozen
// parameter K.SPREAD_PIPS, the frozen cost formula), pools and reports. PREREGISTRATION.md was committed before it existed.
//   R1 six crosses, weeks 2020-01-01 to the end of the data   R2 #880's six majors, weeks 2010-01-01 to 2015-12-31   R3 pooled
// Paper research only: nothing here trades or changes a live rule.
//   CANDLES=<dir of fetch.mjs files> GATE=<dir of #880's <pair>-5m.json.gz> GATE_RESULT=<#880 result.json> node run.mjs run
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { K, PAIRS, weeks, ruleG, book, stats, tOf, normP, mulberry, lowerT, toBars, costPx, study } from './frozen.mjs';

export const FROZEN_SHA256 = '3dfd1dd71f1c1bb2512c5ee0f26573bcb38944f152634ccd622efc1b7002b273';
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
export const CROSSES = ['eurgbp', 'gbpjpy', 'audjpy', 'euraud', 'gbpaud', 'eurchf'];
export const MAJORS = PAIRS.slice();
// quoted spread in pips (PREREGISTRATION.md, fixed before any data): the majors keep #880's 0.3; the crosses are stated
// assumptions (no cross is measured in the repository)
export const SPREAD = { eurgbp: 0.4, eurchf: 0.5, audjpy: 0.6, gbpjpy: 0.9, euraud: 0.9, gbpaud: 1.3,
  eurusd: 0.3, gbpusd: 0.3, usdjpy: 0.3, audusd: 0.3, usdchf: 0.3, eurjpy: 0.3 };
export const TESTS = { R1: { pairs: CROSSES, from: T('2020-01-01'), to: Infinity }, R2: { pairs: MAJORS, from: T('2010-01-01'), to: T('2016-01-01') } };
export const ALPHA = 0.05;

// the frozen cost formula with the pair's quoted spread: K.SPREAD_PIPS set only while that pair's trades are booked
export function withSpread(spread, fn) { const s = K.SPREAD_PIPS; K.SPREAD_PIPS = spread; try { return fn(); } finally { K.SPREAD_PIPS = s; } }

// one pair, one window: the frozen weeks, #880's eligibility, the frozen Rule G
export function pairTrades(pair, M5, from, to, spread = SPREAD[pair]) {
  const W = weeks(M5), inW = (w) => w.F >= from && w.F < to, skipped = {};
  for (const w of W) if (w.skip && inW(w)) skipped[w.skip] = (skipped[w.skip] || 0) + 1;
  const used = W.filter((w) => !w.skip && inW(w)), elig = used.filter((w) => w.gapAtr >= K.GAP_MIN && w.gapAtr <= K.GAP_MAX);
  const trades = [], noTrade = {};
  for (const w of elig) { const r = withSpread(spread, () => ruleG(pair, M5, w)); if (r.skip) noTrade[r.skip] = (noTrade[r.skip] || 0) + 1; else trades.push({ ...r, spread }); }
  return { pair, weeks: { total: W.filter(inW).length, used: used.length, eligible: elig.length, skipped }, noTrade, trades, elig };
}

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const r4 = (x) => +x.toFixed(4);
// the frozen stats, plus the 2x-cost figures (every trade's base cost doubled)
export function statsX(T0) {
  const s = stats(T0), x2 = T0.map((t) => t.net - t.costR);
  const mon = new Map(); for (const t of T0) { const k = new Date(t.F * 1000).toISOString().slice(0, 7); mon.set(k, (mon.get(k) || 0) + t.net - t.costR); }
  return { ...s, net2x: r4(mean(x2)), total2x: r4(x2.reduce((a, b) => a + b, 0)), tMonth2x: r4(tOf([...mon.values()])) };
}
// Holm-adjusted one-sided p over the tests given (step-down, monotone)
export function holmAdj(ps) {
  const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = ps.map(() => 1); let run = 0;
  o.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (o.length - r) * p)); out[i] = run; });
  return out;
}
export function reading(r1, r2) {
  const both = [r1, r2].every((r) => r.net > 0 && r.pAdj < ALPHA);
  if (both) return 'REPLICATES';
  if ([r1, r2].some((r) => r.net > 0 && r.tMonth >= 1)) return 'PARTLY';
  return 'DOES NOT REPLICATE';
}
// placebo: each test's own trades (pairs in set order), direction at random, booked by the frozen book with the same costs
export function placebo(groups, seeds = K.SEEDS) {
  const runs = [];
  for (let seed = 1; seed <= seeds; seed++) { const rnd = mulberry(seed), out = [];
    for (const g of groups) for (const t of g.trades) { const w = g.elig.find((x) => x.F === t.F), s = rnd() < 0.5 ? -1 : 1, iE = lowerT(g.M5, t.filled - K.M5);
      out.push(withSpread(t.spread, () => book(g.pair, g.M5, w, iE, s, t.entry, t.r0, t.entry + s * t.r0, t.entry - s * t.r0)).net); }
    runs.push(r4(mean(out))); }
  const s = runs.slice().sort((a, b) => a - b), q = (f) => s[Math.min(s.length - 1, Math.floor(f * s.length))];
  return { seeds, min: s[0], p5: q(0.05), median: q(0.5), p95: q(0.95), max: s.at(-1), runs };
}
const row = (t) => [t.pair, t.fri, t.side, t.entry, t.r0Pips, +t.exitPx.toFixed(5), t.exit, t.R, t.net, t.net2];
function byYear(T0) { const by = {}; for (const t of T0) (by[t.fri.slice(0, 4)] ||= []).push(t);
  return Object.fromEntries(Object.entries(by).sort().map(([y, a]) => [y, { n: a.length, net: r4(mean(a.map((t) => t.net))), total: r4(a.reduce((s, t) => s + t.net, 0)) }])); }

// ─── run ───
const MODE = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ? process.argv[2] : null;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');
const load = (f) => toBars(JSON.parse(zlib.gunzipSync(fs.readFileSync(f))));
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
if (MODE === 'run') {
  const frozenSha = sha(path.join(HERE, 'frozen.mjs'));
  if (frozenSha !== FROZEN_SHA256) throw new Error('frozen.mjs is not the pinned copy');
  // ── gate: the frozen study on #880's own files reproduces its published Rule G; the window path gives the same trades
  const pub = JSON.parse(fs.readFileSync(process.env.GATE_RESULT, 'utf8')), gd = {}, gfiles = {};
  for (const p of PAIRS) { const f = path.join(process.env.GATE, `${p}-5m.json.gz`); gd[p] = load(f).filter((b) => b.time >= K.DATA_FROM); gfiles[p] = { sha256: sha(f), m5: gd[p].length, from: iso(gd[p][0].time), to: iso(gd[p].at(-1).time) }; }
  const g = study(gd), same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const winPath = PAIRS.flatMap((p) => pairTrades(p, gd[p], K.DEC_FROM, Infinity, 0.3).trades);
  const gate = { files: gfiles, published: { dec: pub.rules.G.dec, rep: pub.rules.G.rep, nTrades: pub.trades.G.length },
    got: { dec: g.rules.G.dec, rep: g.rules.G.rep, nTrades: g.trades.G.length },
    decSame: same(g.rules.G.dec, pub.rules.G.dec), repSame: same(g.rules.G.rep, pub.rules.G.rep), tradesSame: same(g.trades.G, pub.trades.G),
    windowPathSame: same(stats(winPath), pub.rules.G.dec) };
  gate.pass = gate.decSame && gate.repSame && gate.tradesSame && gate.windowPathSame;
  for (const k of Object.keys(gd)) delete gd[k];
  console.log('gate', JSON.stringify({ pass: gate.pass, decSame: gate.decSame, repSame: gate.repSame, tradesSame: gate.tradesSame, windowPathSame: gate.windowPathSame }));
  if (!gate.pass) { fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ topic: 'fx-weekend-gap-replicate', verdict: 'GATE FAILED', gate }, null, 1) + '\n'); process.exit(1); }
  // ── the replication
  const groups = {}, candles = {};
  for (const [name, te] of Object.entries(TESTS)) { groups[name] = [];
    for (const p of te.pairs) { const f = path.join(process.env.CANDLES, `${name}-${p}-5m.json.gz`), M5 = load(f);
      candles[`${name}-${p}`] = { sha256: sha(f), m5: M5.length, from: iso(M5[0].time), to: iso(M5.at(-1).time) };
      groups[name].push({ ...pairTrades(p, M5, te.from, te.to), M5 }); } }
  groups.R3 = [...groups.R1, ...groups.R2];
  const tests = {};
  for (const name of ['R1', 'R2', 'R3']) { const G = groups[name], Tr = G.flatMap((x) => x.trades), no = {};
    for (const x of G) for (const [s, n] of Object.entries(x.noTrade)) no[s] = (no[s] || 0) + n;
    tests[name] = { pairs: G.map((x) => x.pair), ...statsX(Tr), noTrade: no,
      weeks: Object.fromEntries(G.map((x) => [x.pair, x.weeks])),
      byPair: Object.fromEntries(G.map((x) => [x.pair, { spread: SPREAD[x.pair], ...statsX(x.trades) }])), byYear: byYear(Tr),
      placebo: placebo(G) };
    tests[name].p = r4(normP(tests[name].tMonth));
    tests[name].placebo.atOrAbove = tests[name].placebo.runs.filter((x) => x >= tests[name].net).length;
    tests[name].robust = tests[name].net > tests[name].placebo.p95; }
  const adj = holmAdj([tests.R1.p, tests.R2.p]); tests.R1.pAdj = r4(adj[0]); tests.R2.pAdj = r4(adj[1]);
  // sensitivity (not in the reading): the crosses at #880's flat 0.3-pip quote
  const flat = statsX(groups.R1.flatMap((x) => pairTrades(x.pair, x.M5, TESTS.R1.from, TESTS.R1.to, 0.3).trades));
  const verdict = reading(tests.R1, tests.R2);
  const out = { topic: 'fx-weekend-gap-replicate', built: '2026-11-14', at: new Date().toISOString(),
    system: 'Forex Sunday-open gap fade, Rule G of fx-weekend-gap frozen: enter toward Friday\'s close at the reopen candle\'s close, target Friday\'s close, 1R stop, out Monday 12:00 New York; replicated on six crosses 2020-now and the six majors 2010-15 (OANDA mid M5)',
    prereg: 'research/edge/fx-weekend-gap-replicate/PREREGISTRATION.md', frozenFrom: 'research/edge/fx-weekend-gap/run.mjs (branch fx-weekend-gap, #880)', frozenSha256: frozenSha,
    windows: { R1: `weeks with Friday 2020-01-01 to ${iso(Math.min(...groups.R1.map((x) => x.M5.at(-1).time))).slice(0, 10)}`, R2: 'weeks with Friday 2010-01-01 to 2015-12-31', used880: 'candles 2015-11-01 to 2026-11-12; traded weeks with Friday 2016-01-01 to 2026-11-12' },
    spread: SPREAD, params: K, alpha: ALPHA, reading: verdict, verdict, gate, candles,
    tests: Object.fromEntries(Object.entries(tests).map(([k, v]) => [k, { ...v, placebo: { ...v.placebo } }])), sensitivityFlat03: flat,
    trades: { R1: groups.R1.flatMap((x) => x.trades).sort((a, b) => a.filled - b.filled).map(row), R2: groups.R2.flatMap((x) => x.trades).sort((a, b) => a.filled - b.filled).map(row) } };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  for (const k of ['R1', 'R2', 'R3']) { const v = tests[k]; console.log(k, JSON.stringify({ n: v.n, win: v.win, gross: v.gross, net: v.net, net2: v.net2, net2x: v.net2x, t: v.t, tMonth: v.tMonth, tMonth2x: v.tMonth2x, p: v.p, pAdj: v.pAdj, total: v.total, maxDD: v.maxDD, months: v.months, exits: v.exits, noTrade: v.noTrade, nights: v.nights, medR0Pips: v.medR0Pips, medCostR: v.medCostR, placebo: { ...v.placebo, runs: undefined }, robust: v.robust })); }
  for (const k of ['R1', 'R2']) for (const [p, v] of Object.entries(tests[k].byPair)) console.log(k, p, v.n, v.net, v.t, v.tMonth, JSON.stringify(tests[k].weeks[p]));
  for (const k of ['R1', 'R2']) console.log(k, 'byYear', JSON.stringify(tests[k].byYear));
  console.log('flat0.3', JSON.stringify({ n: flat.n, net: flat.net, tMonth: flat.tMonth })); console.log('reading', verdict);
}
