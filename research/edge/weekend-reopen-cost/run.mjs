// Edge research · weekend-reopen-cost: what Rule G (the forex Sunday-reopen gap fade of branches fx-weekend-gap #880,
// fx-weekend-gap-replicate #928, fx-weekend-gap-replicate2 #938) costs at its real entry and exit spreads. Cost measurement
// only: no rule is tested; the three studies' own trade lists are re-costed with the frozen cost formula (frozen.mjs = #880's
// run.mjs byte for byte). Measurement, coverage rule, re-costing rule and verdict wording: PREREGISTRATION.md (committed
// alone, first). Paper research only: nothing here trades or changes a live rule, a cost constant or an API.
//   node run.mjs run <quotes.json> <dir with r880.json r928.json r938.json>   -> result.json
// quotes.json = every distinct (symbol, quoteAt, bid, ask, pipPosition) of the git history of council-data
// ctrader/symbols.json (the demo broker's quotes), extracted outside git.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { K, pipOf, costPx, stats, nyTime, nyParts } from './frozen.mjs';

export const FROZEN_SHA256 = '3dfd1dd71f1c1bb2512c5ee0f26573bcb38944f152634ccd622efc1b7002b273';
export const MIN_REOPENS = 20, YEAR_MIN = 5, NEAR_S = 600;
export const BROKER = { EURUSD: 'eurusd', GBPUSD: 'gbpusd', AUDUSD: 'audusd', USDCAD: 'usdcad', USDCHF: 'usdchf', USDJPY: 'usdjpy', EURJPY: 'eurjpy', NZDUSD: 'nzdusd' };

// ─── the measurement ───
const r4 = (x) => +x.toFixed(4), r2 = (x) => +x.toFixed(2);
export const median = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export const p90 = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length, Math.ceil(0.9 * s.length)) - 1]; };
// reads: [{ pair, t (unix s), bid, ask, pipPos }] -> spread in pips
export const spreadPips = (q) => r2((q.ask - q.bid) / 10 ** -q.pipPos);
// the Sundays (New York date) between two unix times
export function sundays(t0, t1) {
  const out = []; let d = new Date(Date.UTC(nyParts(t0).y, nyParts(t0).mo - 1, nyParts(t0).d));
  while (d.getUTCDay() !== 0) d = new Date(d.getTime() + 86400000);
  for (; ; d = new Date(d.getTime() + 7 * 86400000)) { const y = d.getUTCFullYear(), mo = d.getUTCMonth() + 1, dd = d.getUTCDate(); if (nyTime(y, mo, dd, 17) > t1) break; out.push({ y, mo, d: dd }); }
  return out;
}
// one pair's reads -> per reopen: the entry read (nearest Sunday 17:05 New York within ±10 min, earlier on a tie) and the
// exit-window reads (Sunday 17:10 to Monday 12:00 New York)
export function reopens(reads) {
  if (!reads.length) return [];
  const R = reads.slice().sort((a, b) => a.t - b.t), out = [];
  for (const s of sundays(R[0].t, R.at(-1).t)) {
    const E = nyTime(s.y, s.mo, s.d, 17, 5), mon = new Date(Date.UTC(s.y, s.mo - 1, s.d + 1));
    const a = nyTime(s.y, s.mo, s.d, 17, 10), b = nyTime(mon.getUTCFullYear(), mon.getUTCMonth() + 1, mon.getUTCDate(), 12);
    let best = null; for (const q of R) { const dt = Math.abs(q.t - E); if (dt <= NEAR_S && (!best || dt < Math.abs(best.t - E))) best = q; }
    const ex = R.filter((q) => q.t >= a && q.t <= b);
    out.push({ sunday: `${s.y}-${String(s.mo).padStart(2, '0')}-${String(s.d).padStart(2, '0')}`, year: s.y, entryAt: E, entry: best ? { t: best.t, sec: best.t - E, pips: spreadPips(best) } : null, exit: ex.map(spreadPips) });
  }
  return out;
}
const summ = (a) => ({ n: a.length, median: a.length ? r2(median(a)) : null, p90: a.length ? r2(p90(a)) : null });
export function measurePair(reads) {
  const ro = reopens(reads), withEntry = ro.filter((r) => r.entry), years = {};
  for (const r of withEntry) (years[r.year] ||= []).push(r);
  return { reopens: ro.length, withEntry: withEntry.length, measured: withEntry.length >= MIN_REOPENS,
    entry: summ(withEntry.map((r) => r.entry.pips)), exit: summ(withEntry.flatMap((r) => r.exit)),
    byYear: Object.fromEntries(Object.entries(years).map(([y, a]) => [y, { reopens: a.length, entry: summ(a.map((r) => r.entry.pips)), exit: summ(a.flatMap((r) => r.exit)) }])), detail: ro };
}
// the spread a trade of pair / year is charged (only for a measured pair; base = medians, stress = 90th percentiles)
export function spreadFor(m, year, which = 'median') {
  if (!m || !m.measured) return null;
  const y = m.byYear[year], src = y && y.reopens >= YEAR_MIN ? y : m;
  return { entry: src.entry[which], exit: src.exit[which] };
}

// ─── the re-costing (trade rows of the studies' result.json) ───
// row: [pair, fri, side, entry, r0Pips, exitPx, exit, R, net, net2]
export function toTrade(row) {
  const [pair, fri, side, entry, r0Pips, exitPx, exit, R, net, net2] = row, [y, mo, d] = fri.split('-').map(Number), F = nyTime(y, mo, d, 17);
  return { pair, fri, side, entry, r0Pips, exitPx, exit, R, net, net2, F, filled: F, nights: 0, costR: r4(R - net) };
}
// the gate's per-trade check: the frozen formula with the study's own spread gives the published base net R
export function frozenNet(t, spreadPipsAssumed) {
  const keep = K.SPREAD_PIPS; K.SPREAD_PIPS = spreadPipsAssumed;
  try { return t.R - costPx(t.pair, t.entry) / (t.r0Pips * pipOf(t.pair)); } finally { K.SPREAD_PIPS = keep; }
}
// a trade re-costed: the assumed round-trip quoted spread replaced by C pips (= (entry spread + exit spread) / 2)
export const recost = (t, assumed, C) => ({ ...t, net: r4(t.net + (assumed - C) / t.r0Pips), net2: r4(t.net2 + (assumed - C) / t.r0Pips) });
export const pick = (s) => ({ n: s.n, gross: s.gross, net: s.net, net2: s.net2, t: s.t, tMonth: s.tMonth, total: s.total });
// break-even: the smallest C (0.01 pip) at which f(C) <= 0 (f decreasing in C); null when f(0) <= 0 (not met even at a zero
// spread) or f(hi) > 0
export function breakEven(f, hi = 50) {
  if (f(0) <= 0 || f(hi) > 0) return null; let a = 0, b = hi;
  while (b - a > 0.005) { const m = (a + b) / 2; if (f(m) > 0) a = m; else b = m; }
  return r2(b);
}

// ─── run ───
const MODE = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ? process.argv[2] : null;
const HERE = path.dirname(fileURLToPath(import.meta.url));
if (MODE === 'run') {
  const [qFile, rDir] = process.argv.slice(3), J = (f) => JSON.parse(fs.readFileSync(path.join(rDir, f)));
  const sha = (await import('node:crypto')).createHash('sha256').update(fs.readFileSync(path.join(HERE, 'frozen.mjs'))).digest('hex');
  if (sha !== FROZEN_SHA256) throw new Error('frozen.mjs is not the pinned file');
  // the quotes
  const Q = JSON.parse(fs.readFileSync(qFile)), reads = {};
  for (const q of Q) { const pair = BROKER[q.sym]; if (!pair) continue; (reads[pair] ||= []).push({ pair, t: Math.round(Date.parse(q.at) / 1000), bid: q.bid, ask: q.ask, pipPos: q.pip }); }
  const allT = Q.filter((q) => BROKER[q.sym]).map((q) => Date.parse(q.at) / 1000), iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');
  const meas = Object.fromEntries(Object.entries(reads).map(([p, r]) => [p, measurePair(r)]));
  // the studies, their tests, their assumed spreads, their published stats
  const s880 = J('r880.json'), s928 = J('r928.json'), s938 = J('r938.json');
  const sp880 = Object.fromEntries(s880.pairs.map((p) => [p, s880.params.SPREAD_PIPS]));
  const G = s880.trades.G;
  const TESTS = [
    { study: '#880', branch: 'fx-weekend-gap', test: 'G 2020 to now', headline: true, rows: G.filter((r) => r[1] >= '2020'), spread: sp880, pub: s880.rules.G.dec },
    { study: '#928', branch: 'fx-weekend-gap-replicate', test: 'R1', headline: true, rows: s928.trades.R1, spread: s928.spread, pub: s928.tests.R1 },
    { study: '#938', branch: 'fx-weekend-gap-replicate2', test: 'S2', headline: true, rows: s938.trades.S2, spread: s938.spread, pub: s938.tests.S2 },
    { study: '#880', branch: 'fx-weekend-gap', test: 'G 2016-19', headline: false, rows: G.filter((r) => r[1] < '2020'), spread: sp880, pub: s880.rules.G.rep },
    { study: '#928', branch: 'fx-weekend-gap-replicate', test: 'R2', headline: false, rows: s928.trades.R2, spread: s928.spread, pub: s928.tests.R2 },
    { study: '#938', branch: 'fx-weekend-gap-replicate2', test: 'S1', headline: false, rows: s938.trades.S1, spread: s938.spread, pub: s938.tests.S1 },
  ];
  // the gate
  const gate = { ok: true, tests: [] };
  for (const T of TESTS) {
    const tr = T.rows.map(toTrade), maxDiff = Math.max(...tr.map((t) => Math.abs(frozenNet(t, T.spread[t.pair]) - t.net)));
    const mine = pick(stats(tr)), pub = pick(T.pub), same = ['n', 'gross', 'net', 'net2', 't', 'tMonth'].every((k) => mine[k] === pub[k]);
    const ok = same && maxDiff <= 0.0001 + 1e-9; gate.ok &&= ok;
    gate.tests.push({ study: T.study, test: T.test, ok, maxNetDiff: +maxDiff.toFixed(6), stats: mine, published: pub });
  }
  if (!gate.ok) throw new Error('gate failed: ' + JSON.stringify(gate.tests.filter((g) => !g.ok)));
  // coverage per test
  const tests = TESTS.map((T) => {
    const tr = T.rows.map(toTrade), pairs = [...new Set(tr.map((t) => t.pair))].sort();
    const missing = pairs.filter((p) => !(meas[p] && meas[p].measured));
    const out = { study: T.study, branch: T.branch, test: T.test, headline: T.headline, pairs, assumed: Object.fromEntries(pairs.map((p) => [p, T.spread[p]])),
      published: pick(T.pub), measuredPairs: pairs.filter((p) => !missing.includes(p)), missing, recostable: missing.length === 0, recost: null };
    if (out.recostable) {
      const run = (which) => pick(stats(tr.map((t) => { const s = spreadFor(meas[t.pair], +t.fri.slice(0, 4), which); return recost(t, T.spread[t.pair], (s.entry + s.exit) / 2); })));
      out.recost = { median: run('median'), p90: run('p90') };
    }
    // break-even round-trip spread cost C (pips, every pair of the test), not a measurement
    const at = (C) => stats(tr.map((t) => recost(t, T.spread[t.pair], C)));
    out.breakEven = { netZero: breakEven((C) => at(C).net), tMonth2: breakEven((C) => at(C).tMonth - 2),
      assumedMean: r2(tr.reduce((s, t) => s + T.spread[t.pair], 0) / tr.length), medR0Pips: r2(median(tr.map((t) => t.r0Pips))) };
    out.breakEven.entryIfExitZero = { netZero: out.breakEven.netZero == null ? null : r2(2 * out.breakEven.netZero), tMonth2: out.breakEven.tMonth2 == null ? null : r2(2 * out.breakEven.tMonth2) };
    return out;
  });
  const judged = tests.filter((t) => t.headline && t.recostable);
  const verdict = judged.length === 0 ? 'NOT MEASURABLE'
    : judged.every((t) => t.recost.median.net > 0 && t.recost.median.tMonth >= 2) ? 'SURVIVES' : 'DOES NOT SURVIVE';
  // what one weekend shows (descriptive): every reopen in the history, per pair
  const weekend = Object.fromEntries(Object.entries(meas).map(([p, m]) => [p, m.detail.map((r) => {
    const fh = reads[p].filter((q) => q.t >= r.entryAt - 300 && q.t < r.entryAt + 3300).sort((a, b) => a.t - b.t);
    return { sunday: r.sunday, entryAtUtc: iso(r.entryAt), entryRead: r.entry ? { atUtc: iso(r.entry.t), secAfterEntry: r.entry.sec, pips: r.entry.pips } : null,
      firstHour: fh.map((q) => [iso(q.t).slice(11), spreadPips(q)]), exitWindow: summ(r.exit), exitZeroShare: r.exit.length ? r4(r.exit.filter((x) => x === 0).length / r.exit.length) : null };
  })]));
  const measurement = Object.fromEntries(Object.entries(meas).map(([p, m]) => [p, { reopens: m.reopens, withEntry: m.withEntry, measured: m.measured, entry: m.entry, exit: m.exit, byYear: m.byYear }]));
  const out = { topic: 'weekend-reopen-cost', built: '2026-11-14', at: new Date().toISOString(),
    system: 'Cost measurement: the bid / ask spread at the Sunday reopen entry and exits of the forex gap fade Rule G (#880, #928, #938), no rule tested',
    prereg: 'research/edge/weekend-reopen-cost/PREREGISTRATION.md', frozenFrom: 'research/edge/fx-weekend-gap/run.mjs (branch fx-weekend-gap)', frozenSha256: sha,
    sources: {
      proxy: { usable: false, why: 'api/bars.js asks OANDA for mid prices only (price M) and keeps c.mid; no bid or ask candles; not modified' },
      broker: { usable: true, file: 'council-data ctrader/symbols.json, every copy in its git history', reads: Q.filter((q) => BROKER[q.sym]).length, forexSymbols: Object.keys(reads).sort(),
        first: iso(Math.min(...allT)), last: iso(Math.max(...allT)), sundayReopens: Math.max(0, ...Object.values(meas).map((m) => m.reopens)) },
      other: { usable: false, why: 'no other council-data file holds bid / ask with a time (HistData and Kraken candles carry one price; trades.json carries model costR only)' } },
    rule: { entry: 'close of the first OANDA mid M5 candle starting at or after Sunday 17:00 New York (Sunday 17:05 New York)', exit: 'stop or target on a later M5 candle, else the close of the last M5 candle ending by Monday 12:00 New York' },
    params: { MIN_REOPENS, YEAR_MIN, NEAR_S }, gate, measurement, weekend, tests, reading: verdict,
    // the Edge lab classes a verdict starting with "not" as a failed rule; this one is a cost that could not be measured
    verdict: verdict === 'NOT MEASURABLE' ? 'NOT MEASURABLE (inconclusive: the reopen cost could not be measured; no rule was tested)' : verdict };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  console.log('gate', gate.ok, gate.tests.map((g) => `${g.study} ${g.test} ${g.ok} ${g.maxNetDiff}`).join(' | '));
  for (const [p, m] of Object.entries(measurement)) console.log(p, JSON.stringify({ reopens: m.reopens, withEntry: m.withEntry, measured: m.measured, entry: m.entry, exit: m.exit }));
  for (const t of tests) console.log(t.study, t.test, 'missing', t.missing.join(','), 'be', JSON.stringify(t.breakEven));
  console.log(JSON.stringify(weekend, null, 0)); console.log('verdict', verdict);
}
