// research/edge/gold-smallcap-stress: gold after small caps fall behind large caps (pre-registered, PREREGISTRATION.md).
// Paper research only; a stand-alone gold rule, never a gate / entry / exit / size of the live gold book.
//   node research/edge/gold-smallcap-stress/run.mjs fetch <dir>   copies the three daily files out of council-data (no network)
//   node research/edge/gold-smallcap-stress/run.mjs full <dir>    runs the study and writes result.json
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, FIN, nights } from '../../../council/fills.mjs';

export const DAY = 86400;
export const IDX = ['spx500', 'us2000'];
export const H_REL = 5;          // 5-common-day relative return
export const LOOK = 250;         // values of rel in its scale
export const TH = 1.25;          // fresh crossing of |z|
export const STOP_ATR = 2;       // 1R = 2 x ATR20
export const ATR_N = 20;
export const RT = 0.6;           // $ a round trip
export const IS_FROM = Date.UTC(2007, 0, 1) / 1000;
export const SPLIT = Date.UTC(2017, 0, 1) / 1000;
export const OOS_END = Date.UTC(2026, 9, 31) / 1000 + DAY - 1;
export const TESTS = [
  { id: 'T1', mode: 'buy', sig: 'stress', hold: 5, what: 'buy gold after a small-cap stress day, hold 5 candles (primary)' },
  { id: 'T2', mode: 'sell', sig: 'rally', hold: 5, what: 'sell gold after a small-cap rally day, hold 5 candles' },
  { id: 'T3', mode: 'buy', sig: 'stress', hold: 10, what: 'buy gold after a small-cap stress day, hold 10 candles' },
];
const DIR = path.dirname(fileURLToPath(import.meta.url));
const dayOf = (t) => Math.floor(t / DAY) * DAY;

export function load(dir, k) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, k + '.json'), 'utf8'));
  return foldWeekend(j.rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] })));
}

const sd = (a) => { const m = a.reduce((s, x) => s + x, 0) / a.length; return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };

// rows: one per common day D with a full look-back: { t, z, stress, rally }. Uses closes up to D only.
// gold is only used to require a gold candle that day (common day); its prices are not read here.
export function rows(gold, spx, rut) {
  const maps = [gold, spx, rut].map((b) => new Map(b.map((x) => [dayOf(x.time), x.close])));
  const days = [...maps[0].keys()].filter((d) => maps.every((m) => m.has(d))).sort((a, b) => a - b);
  const rel = days.map((d, i) => (i >= H_REL
    ? Math.log(maps[2].get(d) / maps[2].get(days[i - H_REL])) - Math.log(maps[1].get(d) / maps[1].get(days[i - H_REL])) : NaN));
  const z = days.map((d, i) => (i >= H_REL + LOOK ? rel[i] / sd(rel.slice(i - LOOK, i)) : NaN));
  const out = [];
  for (let i = H_REL + LOOK + 1; i < days.length; i++) {
    out.push({ t: days[i], z: z[i], stress: z[i] <= -TH && !(z[i - 1] <= -TH), rally: z[i] >= TH && !(z[i - 1] >= TH) });
  }
  return out;
}

// index of gold's first candle after signal day d (null when none)
export function entryIndex(gold, d) {
  let lo = 0, hi = gold.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (dayOf(gold[m].time) <= d) lo = m + 1; else hi = m; }
  return lo < gold.length ? lo : null;
}

// one trade from candle j, side +1 / -1, hold H candles; costs mult x ($0.60 + financing on buys)
export function tradeAt(gold, j, side, hold, mult = 1) {
  if (j == null || j < ATR_N + 1 || j + hold - 1 >= gold.length) return null;
  let tr = 0;
  for (let k = j - ATR_N; k < j; k++) tr += Math.max(gold[k].high, gold[k - 1].close) - Math.min(gold[k].low, gold[k - 1].close);
  const risk = STOP_ATR * tr / ATR_N, entry = gold[j].open, stop = entry - side * risk;
  let exit = null, k = j, kind = 'time', tExit;
  for (; k < j + hold; k++) {
    const b = gold[k];
    if (side > 0 ? b.open <= stop : b.open >= stop) { exit = b.open; kind = 'stop'; tExit = b.time + DAY / 2; break; }
    if (side > 0 ? b.low <= stop : b.high >= stop) { exit = stop; kind = 'stop'; tExit = b.time + DAY / 2; break; }
  }
  if (exit == null) { k = j + hold - 1; exit = gold[k].close; tExit = gold[k].time + DAY; }
  const gross = side * (exit - entry) / risk;
  const n = side > 0 ? nights(gold[j].time, tExit) : 0;
  const cost = mult * (RT + n * FIN.xau.long * entry) / risk;
  return { j, k, side, entry, stop, risk, exit, kind, nights: n, gross, net: gross - cost, t: gold[j].time };
}

const sideOf = (mode) => (mode === 'buy' ? 1 : -1);

// one-at-a-time run over signal rows
export function simulate(gold, sigs, test, mult = 1) {
  const out = []; let busy = -1, skipped = 0;
  for (const r of sigs) {
    const side = sideOf(test.mode); if (!side) continue;
    const j = entryIndex(gold, r.t); if (j == null) continue;
    if (j <= busy) { skipped++; continue; }
    const tr = tradeAt(gold, j, side, test.hold, mult); if (!tr) continue;
    tr.sig = r.t; out.push(tr); busy = tr.k;
  }
  return { trades: out, skipped };
}

// mean net R of the same trade after every eligible day, per side
export function baseline(gold, pool, hold, mult = 1) {
  const acc = { 1: [], [-1]: [] };
  for (const r of pool) for (const side of [1, -1]) { const tr = tradeAt(gold, entryIndex(gold, r.t), side, hold, mult); if (tr) acc[side].push(tr.net); }
  const m = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  return { 1: m(acc[1]), [-1]: m(acc[-1]), n: acc[1].length };
}

const monthKey = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
export function monthT(items, from, to) {
  const m0 = monthKey(from), m1 = monthKey(to), sums = new Array(m1 - m0 + 1).fill(0);
  for (const { t, v } of items) sums[monthKey(t) - m0] += v;
  const n = sums.length, mean = sums.reduce((s, x) => s + x, 0) / n, s = sd(sums);
  return s > 0 ? mean / (s / Math.sqrt(n)) : 0;
}
const ncdf = (z) => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2); const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };
export const pOne = (t) => 1 - ncdf(t);
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = new Array(ps.length); let run = 0;
  idx.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (ps.length - r) * p)); adj[i] = run; });
  return adj;
}

export function summarize(trades, base, from, to) {
  const n = trades.length, mean = (f) => (n ? trades.reduce((s, x) => s + f(x), 0) / n : 0);
  const ex = (x) => x.net - base[x.side];
  return {
    n, gross: mean((x) => x.gross), net: mean((x) => x.net), excess: mean(ex),
    win: n ? trades.filter((x) => x.net > 0).length / n : 0, stops: trades.filter((x) => x.kind === 'stop').length,
    totalNet: trades.reduce((s, x) => s + x.net, 0),
    tExcess: monthT(trades.map((x) => ({ t: x.sig, v: ex(x) })), from, to),
    tNet: monthT(trades.map((x) => ({ t: x.sig, v: x.net })), from, to),
    tGross: monthT(trades.map((x) => ({ t: x.sig, v: x.gross })), from, to),
  };
}

// seeded RNG (mulberry32)
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (arr, k, R) => { const a = arr.slice(); for (let i = 0; i < k; i++) { const j = i + Math.floor(R() * (a.length - i)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, k).sort((x, y) => x.t - y.t); };
export function placebo(gold, pool, nSig, test, base, from, to, seed, draws = 40) {
  const R = rng(seed), ts = [];
  for (let d = 0; d < draws; d++) ts.push(summarize(simulate(gold, pick(pool, nSig, R), test).trades, base, from, to).tExcess);
  return ts;
}
export function control(gold, pool, sigs, test, base, from, to, seed, draws = 40) {
  const R = rng(seed), byYear = new Map(), ts = [];
  for (const r of pool) { const y = new Date(r.t * 1000).getUTCFullYear(); if (!byYear.has(y)) byYear.set(y, []); byYear.get(y).push(r); }
  for (let d = 0; d < draws; d++) {
    const s = sigs.map((r) => { const a = byYear.get(new Date(r.t * 1000).getUTCFullYear()); return a[Math.floor(R() * a.length)]; }).sort((x, y) => x.t - y.t);
    ts.push(summarize(simulate(gold, s, test).trades, base, from, to).tExcess);
  }
  return ts;
}

export function study(gold, spx, rut) {
  const all = rows(gold, spx, rut);
  const win = { is: [IS_FROM, SPLIT - 1], oos: [SPLIT, OOS_END] };
  const res = { context: {}, tests: [] };
  const pools = {}, sigs = {};
  for (const [w, [a, b]] of Object.entries(win)) {
    pools[w] = all.filter((r) => r.t >= a && r.t <= b && entryIndex(gold, r.t) != null);
    sigs[w] = { stress: pools[w].filter((r) => r.stress), rally: pools[w].filter((r) => r.rally) };
    res.context[w] = { days: pools[w].length, stress: sigs[w].stress.length, rally: sigs[w].rally.length };
  }
  for (const test of TESTS) {
    const row = { id: test.id, what: test.what, mode: test.mode, hold: test.hold };
    for (const [w, [a, b]] of Object.entries(win)) {
      const base = baseline(gold, pools[w], test.hold), base2 = baseline(gold, pools[w], test.hold, 2);
      const sg = sigs[w][test.sig];
      const sim = simulate(gold, sg, test), sim2 = simulate(gold, sg, test, 2);
      const s = summarize(sim.trades, base, a, b);
      s.signals = sg.length; s.skipped = sim.skipped; s.baseBuy = base[1]; s.baseSell = base[-1]; s.baseN = base.n;
      s.net2x = summarize(sim2.trades, base2, a, b).net;
      s.excess2x = summarize(sim2.trades, base2, a, b).excess;
      s.p = pOne(s.tExcess);
      if (w === 'oos') {
        const pl = placebo(gold, pools[w], sg.length, test, base, a, b, 125 + TESTS.indexOf(test));
        const ct = control(gold, pools[w], sg, test, base, a, b, 1125 + TESTS.indexOf(test));
        s.placebo = { draws: 40, beats: pl.filter((x) => s.tExcess > x).length, median: med(pl), max: Math.max(...pl) };
        s.control = { draws: 40, beats: ct.filter((x) => s.tExcess > x).length, median: med(ct), max: Math.max(...ct) };
        s.trades = sim.trades.map((x) => [x.sig, x.t, x.side, +x.entry.toFixed(2), +x.exit.toFixed(2), +x.risk.toFixed(2), x.kind, +x.net.toFixed(4)]);
      }
      row[w] = s;
    }
    res.tests.push(row);
  }
  const adj = holm(res.tests.map((r) => r.oos.p));
  res.tests.forEach((r, i) => { r.oos.holm = adj[i]; r.pass = passes(r); });
  const t1 = res.tests[0];
  res.verdict = t1.pass ? 'PASS' : res.tests.slice(1).some((r) => r.pass) ? 'INCONCLUSIVE' : 'FAIL';
  return res;
}
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
export const passes = (r) => r.oos.tExcess >= 2 && r.oos.holm < 0.05 && r.oos.net > 0 && r.oos.tNet >= 2 && r.is.excess > 0
  && r.oos.net2x > 0 && r.oos.placebo.beats >= 38 && r.oos.control.beats >= 38;

const r3 = (x) => (typeof x === 'number' ? +x.toFixed(4) : x);
function roundAll(o) { if (Array.isArray(o)) return o.map(roundAll); if (o && typeof o === 'object') { const z = {}; for (const [k, v] of Object.entries(o)) z[k] = roundAll(v); return z; } return r3(o); }

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (!dir) { console.error('usage: run.mjs fetch|full <dir>'); process.exit(1); }
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    for (const k of ['xau', ...IDX]) fs.writeFileSync(path.join(dir, k + '.json'), execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
    fs.writeFileSync(path.join(dir, 'commit.txt'), execFileSync('git', ['rev-parse', 'origin/council-data']).toString().trim());
    console.log('fetched into', dir);
  } else if (cmd === 'full') {
    const gold = load(dir, 'xau'), [spx, rut] = IDX.map((k) => load(dir, k));
    const res = study(gold, spx, rut);
    const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
    const out = roundAll({
      title: 'Gold after small caps fall behind large caps',
      built: '2026-11-14', prereg: 'PREREGISTRATION.md',
      councilData: fs.existsSync(path.join(dir, 'commit.txt')) ? fs.readFileSync(path.join(dir, 'commit.txt'), 'utf8').trim() : null,
      rule: {
        signal: 'z = (5-day log return of US2000 minus SPX500) / sd of its 250 values before the day; stress = fresh crossing z <= -1.25, rally = fresh crossing z >= +1.25',
        entry: 'open of gold\'s first folded daily candle after the signal day', stop: '2 x ATR20 (1R)', costs: '$0.60 a round trip + nights() x FIN.xau.long x entry on buys',
        excess: 'net R minus the mean net R of the same side and hold after every eligible day of the window', oneAtATime: true,
      },
      fin: FIN.xau.long, isFrom: iso(IS_FROM), split: iso(SPLIT), oosEnd: iso(OOS_END),
      data: { xau: { first: iso(gold[0].time), last: iso(gold[gold.length - 1].time), days: gold.length } },
      ...res,
    });
    fs.writeFileSync(path.join(DIR, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    for (const t of out.tests) console.log(t.id, JSON.stringify({ is: { n: t.is.n, g: t.is.gross, net: t.is.net, ex: t.is.excess, tEx: t.is.tExcess, tNet: t.is.tNet }, oos: { n: t.oos.n, g: t.oos.gross, net: t.oos.net, ex: t.oos.excess, tEx: t.oos.tExcess, tNet: t.oos.tNet, tG: t.oos.tGross, holm: t.oos.holm, net2x: t.oos.net2x, pl: t.oos.placebo, ct: t.oos.control }, pass: t.pass }));
    console.log(out.context, out.verdict);
  }
}
