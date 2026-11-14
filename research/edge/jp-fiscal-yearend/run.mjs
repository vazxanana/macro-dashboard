// The Japanese fiscal year-end yen seasonal (PREREGISTRATION.md, pushed first).
//   node research/edge/jp-fiscal-yearend/run.mjs fetch <dir>   copies usdjpy / eurjpy / audjpy daily files, ctrader/symbols.json
//                                                              (council-data) and the fx-carry study's rates.json (git show, no network)
//   node research/edge/jp-fiscal-yearend/run.mjs full <dir>    the study -> result.json (+ prints the tables)
// Pure pieces are exported for the test. Paper only: nothing here is read by the council or the page.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { foldWeekend, nights, stopFill } from '../../../council/fills.mjs';

export const PAIRS = {
  usdjpy: { k: 'usdjpy', sym: 'USDJPY', base: 'usd', quote: 'jpy', pip: 1e-2 },
  eurjpy: { k: 'eurjpy', sym: 'EURJPY', base: 'eur', quote: 'jpy', pip: 1e-2 },
  audjpy: { k: 'audjpy', sym: 'AUDJPY', base: 'aud', quote: 'jpy', pip: 1e-2 },
};
export const SPREAD_PIP = 0.3, SLIP_PIP = 0.15, COMM_SIDE = 22.5e-6, MARKUP = 0.5;   // markup: percent a year, every position
export const ATR_N = 20, ATR_K = 3, T2_DAYS = 10, T1_LAST_DAY = 29, SEED = 20261114, DRAWS = 20000, PL_SEEDS = 40, PL_DRAWS = 2000;
export const DATA_FROM = Date.UTC(2005, 0, 1) / 1000, DECISIVE = [2016, 2026], REPLICATION = [2005, 2015];
export const TESTS = { T1: { side: -1, label: 'short, first trading day on/after 1 March to the last trading day on/before 29 March' },
  T2: { side: 1, label: 'long, the first 10 trading days from the first trading day on/after 1 April' } };
const H = 3600;
export const dOf = (y, m, d) => Date.UTC(y, m, d) / 1000;
const ymd = (t) => { const d = new Date(t * 1000); return [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()]; };

// folded weekday candles from 1 Jan 2005
export function prep(rows) {
  return foldWeekend(rows.filter((r) => r[0] >= DATA_FROM).map(([time, open, high, low, close]) => ({ time, open, high, low, close })));
}
// index of the first candle whose time is >= t (bars.length if none)
export function firstOnOrAfter(bars, t) { let lo = 0, hi = bars.length; while (lo < hi) { const m = (lo + hi) >> 1; if (bars[m].time < t) lo = m + 1; else hi = m; } return lo; }
const exitTime = (t) => t + (new Date(t * 1000).getUTCDay() === 5 ? 21 : 23) * H;

// T1: first trading day on/after 1 March to the last trading day on/before 29 March; complete only when a later candle exists
export function t1Window(bars, y) {
  const i0 = firstOnOrAfter(bars, dOf(y, 2, 1)), iN = firstOnOrAfter(bars, dOf(y, 2, T1_LAST_DAY + 1));
  if (i0 >= bars.length || iN >= bars.length || i0 >= iN) return null;
  return { i0, i1: iN - 1, n: iN - i0 };
}
// T2: the first 10 trading days from the first trading day on/after 1 April
export function t2Window(bars, y) {
  const i0 = firstOnOrAfter(bars, dOf(y, 3, 1)); if (i0 >= bars.length || ymd(bars[i0].time)[1] !== 3) return null;
  const i1 = i0 + T2_DAYS - 1; return i1 < bars.length ? { i0, i1, n: T2_DAYS } : null;
}
export const WIN = { T1: t1Window, T2: t2Window };

// financing a night as a fraction of the entry price, side s (+1 long the pair), month before the entry; markup paid by both sides
export function finPerNight(pair, s, t, rates) {
  const [y, m] = ymd(t), pm = m === 0 ? `${y - 1}-12` : `${y}-${String(m).padStart(2, '0')}`;
  const row = rates.monthEnd[pm] || rates.monthEnd[Object.keys(rates.monthEnd).sort().at(-1)], ix = (c) => rates.order.indexOf(c);
  return (s * (row[ix(pair.base)] - row[ix(pair.quote)]) - MARKUP) / 100 / 365;
}
export const costOf = (pair, entry) => (SPREAD_PIP + 2 * SLIP_PIP) * pair.pip + 2 * COMM_SIDE * entry;   // price units

// ATR(20) of the 20 candles before index i0 (true range against the previous close)
export function atrBefore(bars, i0) {
  let tr = 0; for (let j = i0 - ATR_N; j < i0; j++) { const b = bars[j], pc = bars[j - 1] ? bars[j - 1].close : b.open;
    tr += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return tr / ATR_N;
}
// one position: candles i0..i1, side s; null without 20 candles before it or past the data. Reads candles up to i1 only.
// level: 0 = no cost / no financing, 1 = base, 2 = both doubled. Returns R units of the stop distance.
export function position(bars, i0, i1, s, pair, rates, level = 1) {
  if (i0 < ATR_N || i1 >= bars.length || i1 < i0) return null;
  const entry = bars[i0].open, risk = ATR_K * atrBefore(bars, i0), stop = entry - s * risk;
  if (!(risk > 0)) return null;
  let exit = null, tEnd = null, how = 'close', exitIx = i1;
  for (let j = i0; j <= i1; j++) { const b = bars[j];
    if (s > 0 ? b.low <= stop : b.high >= stop) { exit = stopFill(b, s < 0, stop, j > i0); tEnd = exitTime(b.time); how = 'stop'; exitIx = j; break; } }
  if (exit == null) { exit = bars[i1].close; tEnd = exitTime(bars[i1].time); }
  const grossR = s * (exit - entry) / risk, nn = nights(bars[i0].time, tEnd);
  const costR = level * costOf(pair, entry) / risk, finR = level * nn * finPerNight(pair, s, bars[i0].time, rates) * entry / risk;
  return { entry, stop, risk, exit, exitIx, how, nights: nn, grossR, costR, finR, netR: grossR - costR + finR };
}

// every year of a test: the claimed position and the comparison set C(y) (same length and side, every other trading day of the
// year as a start, complete, no shared trading day with the claimed window), each { k: offset in the year, r: net R }
export function yearRows(bars, pair, rates, side, winOf, level = 1) {
  const years = [...new Set(bars.map((b) => ymd(b.time)[0]))].sort((a, b) => a - b), out = [];
  for (const y of years) {
    const w = winOf(bars, y); if (!w) continue;
    const pos = position(bars, w.i0, w.i1, side, pair, rates, level); if (!pos) continue;
    const first = firstOnOrAfter(bars, dOf(y, 0, 1)), comps = [];
    for (let j = first; j < bars.length && ymd(bars[j].time)[0] === y; j++) {
      const j1 = j + w.n - 1; if (j === w.i0 || j1 >= bars.length) continue;
      if (!(j1 < w.i0 || j > w.i1)) continue;
      const p = position(bars, j, j1, side, pair, rates, level); if (p) comps.push({ k: j - first, r: p.netR });
    }
    if (!comps.length) continue;
    out.push({ y, n: w.n, k: w.i0 - first, from: new Date(bars[w.i0].time * 1000).toISOString().slice(0, 10),
      to: new Date(bars[w.i1].time * 1000).toISOString().slice(0, 10), pos, comps,
      rank: 1 + comps.filter((c) => c.r > pos.netR).length, of: comps.length + 1 });
  }
  return out;
}

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sdOf = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
export function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// permutation p: one comparison window per year, drawn independently; p = (1 + draws >= S) / (1 + draws)
export function permP(rows, draws = DRAWS, seed = SEED) {
  const S = mean(rows.map((r) => r.pos.netR)), rng = mulberry32(seed); let ge = 0;
  for (let i = 0; i < draws; i++) { let s = 0; for (const r of rows) s += r.comps[Math.floor(rng() * r.comps.length)].r; if (s / rows.length >= S - 1e-12) ge++; }
  return { S, p: (1 + ge) / (1 + draws), ge, draws };
}
// rank of S among the same-offset statistics (offsets present in every year)
export function offsetRank(rows) {
  const S = mean(rows.map((r) => r.pos.netR)), by = new Map();
  for (const r of rows) for (const c of r.comps) { if (!by.has(c.k)) by.set(c.k, []); by.get(c.k).push(c.r); }
  const stats = [...by.values()].filter((a) => a.length === rows.length).map(mean);
  return { rank: 1 + stats.filter((x) => x > S).length, of: stats.length + 1 };
}
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((x, y) => x[0] - y[0]), out = Array(ps.length); let run = 0;
  o.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (ps.length - r) * p)); out[i] = run; });
  return out;
}
const inW = (rows, [a, b]) => rows.filter((r) => r.y >= a && r.y <= b);
const r3 = (x) => +x.toFixed(3), r4 = (x) => +x.toFixed(4);
export function summ(rows, perm = true, draws = DRAWS, seed = SEED) {
  if (!rows.length) return null;
  const net = rows.map((r) => r.pos.netR), gross = rows.map((r) => r.pos.grossR), sd = sdOf(net);
  const o = { years: rows.length, from: rows[0].y, to: rows.at(-1).y, meanGrossR: r3(mean(gross)), meanNetR: r3(mean(net)), sdNetR: r3(sd),
    t: r3(mean(net) / (sd / Math.sqrt(net.length))), won: net.filter((x) => x > 0).length, stopped: rows.filter((r) => r.pos.how === 'stop').length,
    meanCompR: r3(mean(rows.map((r) => mean(r.comps.map((c) => c.r))))) };
  if (perm) { const P = permP(rows, draws, seed), R = offsetRank(rows); o.permP = r4(P.p); o.offsetRank = R.rank; o.offsetOf = R.of; }
  return o;
}
const yearTable = (rows) => rows.map((r) => ({ y: r.y, from: r.from, to: r.to, n: r.n, grossR: r3(r.pos.grossR), costR: r3(r.pos.costR),
  finR: r3(r.pos.finR), netR: r3(r.pos.netR), how: r.pos.how, rank: r.rank, of: r.of }));

// placebo i: one calendar start (1 Jan - 1 Dec, not 1 Mar - 15 Apr), a T1-like (short, the claimed N per year) and a T2-like
// (long, 10 days) test on USD/JPY, the same statistic, 2,000 permutation draws and bar 1-2 without Holm
export function placeboDate(seed) {
  const rng = mulberry32(seed);
  for (;;) { const doy = Math.floor(rng() * 335), t = dOf(2025, 0, 1) + doy * 86400, [, m, d] = ymd(t);
    if ((m === 2) || (m === 3 && d <= 15)) continue; return [m, d]; }
}
export function placebo(bars, pair, rates, nOfYear) {
  const out = { T1: [], T2: [] };
  for (let i = 1; i <= PL_SEEDS; i++) {
    const [m, d] = placeboDate(i);
    for (const [k, side] of [['T1', -1], ['T2', 1]]) {
      const winOf = (b, y) => { const n = k === 'T1' ? nOfYear[y] : T2_DAYS; if (!n) return null;
        const i0 = firstOnOrAfter(b, dOf(y, m, d)); if (i0 >= b.length || ymd(b[i0].time)[0] !== y) return null;
        const i1 = i0 + n - 1; return i1 < b.length ? { i0, i1, n } : null; };
      const rows = yearRows(bars, pair, rates, side, winOf), dec = summ(inW(rows, DECISIVE), true, PL_DRAWS, SEED + i), rep = summ(inW(rows, REPLICATION), false);
      out[k].push({ seed: i, start: `${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, decNetR: dec && dec.meanNetR, repNetR: rep && rep.meanNetR,
        p: dec && dec.permP, pass: !!(dec && rep && dec.meanNetR > 0 && rep.meanNetR > 0 && dec.permP < 0.05) });
    }
  }
  return out;
}

export function study(data, rates) {
  const bars = Object.fromEntries(Object.keys(PAIRS).map((k) => [k, prep(data[k])]));
  const out = { tests: {}, costLevels: {}, years: {}, cross: {}, placebo: {} }, rawP = {};
  for (const [T, def] of Object.entries(TESTS)) {
    const rows = yearRows(bars.usdjpy, PAIRS.usdjpy, rates, def.side, WIN[T]);
    out.tests[T] = { decisive: summ(inW(rows, DECISIVE)), replication: summ(inW(rows, REPLICATION), false) };
    rawP[T] = out.tests[T].decisive.permP;
    out.years[T] = yearTable(rows);
    out.costLevels[T] = {};
    for (const [name, lv] of [['zero', 0], ['base', 1], ['x2', 2]]) {
      const rs = lv === 1 ? rows : yearRows(bars.usdjpy, PAIRS.usdjpy, rates, def.side, WIN[T], lv);
      const d = summ(inW(rs, DECISIVE)), r = summ(inW(rs, REPLICATION), false);
      out.costLevels[T][name] = { decNetR: d.meanNetR, decT: d.t, decP: d.permP, decWon: d.won, repNetR: r.meanNetR, repWon: r.won };
    }
    out.cross[T] = {};
    for (const k of ['eurjpy', 'audjpy']) {
      const rs = yearRows(bars[k], PAIRS[k], rates, def.side, WIN[T]);
      out.cross[T][k] = { decisive: summ(inW(rs, DECISIVE)), replication: summ(inW(rs, REPLICATION), false), years: yearTable(rs) };
    }
  }
  const ks = Object.keys(TESTS), adj = holm(ks.map((k) => rawP[k]));
  out.holm = Object.fromEntries(ks.map((k, i) => [k, r4(adj[i])]));
  out.pass = {};
  for (const [i, k] of ks.entries()) {
    const T = out.tests[k], b = { bothWindows: T.decisive.meanNetR > 0 && T.replication.meanNetR > 0, holm: adj[i] < 0.05 };
    b.pass = b.bothWindows && b.holm; out.pass[k] = b;
  }
  const n = ks.filter((k) => out.pass[k].pass).length;
  out.verdict = n === ks.length ? 'PASS' : n ? 'PARTIAL' : 'FAIL';
  const nOfYear = Object.fromEntries(out.years.T1.map((r) => [r.y, r.n])), pl = placebo(bars.usdjpy, PAIRS.usdjpy, rates, nOfYear);
  for (const k of ks) {
    const S = out.tests[k].decisive.meanNetR, vals = pl[k].map((x) => x.decNetR).filter((x) => x != null);
    out.placebo[k] = { seeds: pl[k].length, wouldPass: pl[k].filter((x) => x.pass).length, claimedRank: 1 + vals.filter((x) => x > S).length,
      of: vals.length + 1, runs: pl[k] };
  }
  return out;
}

const FILES = ['usdjpy', 'eurjpy', 'audjpy'];
async function main() {
  const [cmd, dir] = process.argv.slice(2);
  if (!dir) { console.error('usage: run.mjs fetch|full <dir>'); process.exit(2); }
  const show = (ref) => execFileSync('git', ['show', ref], { maxBuffer: 1 << 28 });
  if (cmd === 'fetch') { fs.mkdirSync(dir, { recursive: true });
    for (const k of FILES) fs.writeFileSync(path.join(dir, `${k}.json`), show(`origin/council-data:research/daily/${k}.json`));
    fs.writeFileSync(path.join(dir, 'symbols.json'), show('origin/council-data:ctrader/symbols.json'));
    fs.writeFileSync(path.join(dir, 'rates.json'), show('origin/fx-carry:research/edge/fx-carry/rates.json'));
    console.log('wrote', dir); return; }
  const data = {}, sha = {}, span = {};
  for (const k of FILES) { const raw = fs.readFileSync(path.join(dir, `${k}.json`)), j = JSON.parse(raw); data[k] = j.rows;
    sha[k] = crypto.createHash('sha256').update(raw).digest('hex');
    span[k] = { first: new Date(j.rows[0][0] * 1000).toISOString().slice(0, 10), last: new Date(j.rows.at(-1)[0] * 1000).toISOString().slice(0, 10) }; }
  const symRaw = fs.readFileSync(path.join(dir, 'symbols.json')), sym = JSON.parse(symRaw), ratesRaw = fs.readFileSync(path.join(dir, 'rates.json'));
  const yenOnFile = Object.keys(sym.symbols || {}).filter((s) => /JPY/.test(s));
  if (yenOnFile.length) console.warn('note: symbols.json now has', yenOnFile, '(the pre-registration uses the assumed rate)');
  const rates = JSON.parse(ratesRaw), res = study(data, rates);
  const doc = { study: 'jp-fiscal-yearend', built: '2026-11-14', verdict: res.verdict,
    claim: { T1: TESTS.T1.label + ', USD/JPY (yen stronger before the Japanese fiscal year-end)', T2: TESTS.T2.label + ', USD/JPY (yen weaker in the new fiscal year)' },
    data: { files: FILES.map((k) => `council-data research/daily/${k}.json`), usedFrom: '2005-01-01', span, sha256: sha,
      symbols: { file: 'council-data ctrader/symbols.json', at: sym.at, yenPairs: yenOnFile, sha256: crypto.createHash('sha256').update(symRaw).digest('hex') },
      rates: { file: 'fx-carry research/edge/fx-carry/rates.json', asOf: rates.asOf, sha256: crypto.createHash('sha256').update(ratesRaw).digest('hex') } },
    windows: { decisive: DECISIVE, replication: REPLICATION },
    costs: { spreadPip: SPREAD_PIP, slipPipEachSide: SLIP_PIP, commissionPerSide: COMM_SIDE,
      financing: `assumed: policy-rate differential (fx-carry rates.json monthEnd, month before entry) minus a ${MARKUP} % a year markup on every position; no yen pair in ctrader/symbols.json` },
    stop: `${ATR_K} x ATR(${ATR_N}) of daily candles from the entry`, units: 'R = signed move / stop distance; net = gross - cost + financing (both in R)',
    permutation: { draws: DRAWS, seed: SEED }, ...res,
    note: 'Paper only. One trade per rule per year: 11 decisive observations per test, low power. Nothing in the council reads this study.' };
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(doc, null, 1) + '\n');
  console.log(JSON.stringify({ verdict: res.verdict, tests: res.tests, holm: res.holm, pass: res.pass, costLevels: res.costLevels,
    placebo: Object.fromEntries(Object.entries(res.placebo).map(([k, v]) => [k, { wouldPass: v.wouldPass, claimedRank: v.claimedRank, of: v.of }])),
    cross: Object.fromEntries(Object.entries(res.cross).map(([k, v]) => [k, { eurjpy: v.eurjpy.decisive, eurjpyRep: v.eurjpy.replication, audjpy: v.audjpy.decisive, audjpyRep: v.audjpy.replication }])) }, null, 1));
  for (const k of Object.keys(TESTS)) { console.log(k); console.table(res.years[k]); }
  for (const k of Object.keys(TESTS)) for (const c of ['eurjpy', 'audjpy']) { console.log(k, c); console.table(res.cross[k][c].years.map(({ y, grossR, netR, how, rank, of }) => ({ y, grossR, netR, how, rank, of }))); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
