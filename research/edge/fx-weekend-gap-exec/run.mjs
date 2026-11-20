// Edge research · fx-weekend-gap-exec: Rule G frozen (research/edge/fx-weekend-gap-replicate2/frozen.mjs, imported unchanged),
// charged the demo broker's measured spread at each trade's entry and exit minute (PREREGISTRATION.md).
//   node research/edge/fx-weekend-gap-exec/run.mjs marks <fxDir>              -> trades.json + marks.json (the moments to read)
//   node research/edge/fx-weekend-gap-exec/run.mjs report <probeDir> [commit] -> result.json (probeDir: ticks-<PAIR>.json files)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { pipOf, monthSums, tOf } from '../fx-weekend-gap-replicate2/frozen.mjs';
import { pairTrades, MAJORS, CROSSES, NEWPAIRS } from '../fx-weekend-gap-replicate2/run.mjs';
import { toBars } from '../fx-weekend-gap-replicate2/frozen.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PAIRS18 = [...MAJORS, ...CROSSES, ...NEWPAIRS];
export const FROM = Date.parse('2023-11-24T00:00:00Z') / 1000, TO = Date.parse('2026-11-14T00:00:00Z') / 1000;   // Fridays inside the broker history
export const COMM = 22.5e-6, STRESS_PIPS = 0.5, MAX_AGE = 120, N_MIN = 150;
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const med = (a) => { const v = [...a].sort((x, y) => x - y), n = v.length; return n ? (n % 2 ? v[n >> 1] : (v[n / 2 - 1] + v[n / 2]) / 2) : null; };
const pct = (a, p) => { const v = [...a].sort((x, y) => x - y); return v.length ? v[Math.min(v.length - 1, Math.floor(p * (v.length - 1) + 0.5))] : null; };
const r4 = (v) => (Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : null);
export const sym = (p) => p.toUpperCase();

// the measured quote at a mark: [t, bid, ask, ageS, spreadMedian] -> spread in price, or null when stale / missing
export function spreadAt(rows, t) {
  const q = rows && rows.get(t); if (!q) return null;
  const [, bid, ask, age, medSp] = q; if (!(bid > 0) || !(ask > 0) || age == null || age > MAX_AGE) return null;
  const s = medSp != null ? medSp : ask - bid; return s >= 0 ? s : null;
}
// net R of one trade with the measured spreads (half at each end) and commission, plus stress slippage a side
export function charge(t, sE, sX, slipPips = 0) {
  const pip = pipOf(t.pair), cost = sE / 2 + sX / 2 + 2 * COMM * t.entry + 2 * slipPips * pip;
  return { net: t.R - cost / t.r0, costPips: cost / pip };
}
export function statsOf(T) {
  const net = T.map((x) => x.net), months = monthSums(T.map((x) => ({ F: x.F, net: x.net })));
  return { n: T.length, net: r4(mean(net)), gross: r4(mean(T.map((x) => x.R))), tTrades: r4(tOf(net)), tMonth: r4(tOf(months)), months: months.length, won: r4(T.filter((x) => x.net > 0).length / (T.length || 1)) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [mode, dir, commit] = process.argv.slice(2);
  if (mode === 'marks') {
    const trades = [], marks = {};
    for (const p of PAIRS18) {
      const M5 = toBars(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${p}-5m.json.gz`)))));
      const { trades: tr } = pairTrades(p, M5, FROM, TO, 0);
      for (const t of tr) { trades.push({ pair: p, F: t.F, side: t.side, entry: t.entry, r0: t.r0, R: t.R, filled: t.filled, exitT: t.exitT, exit: t.exit });
        (marks[sym(p)] = marks[sym(p)] || []).push(t.filled, t.exitT); }
    }
    for (const k of Object.keys(marks)) marks[k] = [...new Set(marks[k])].sort((a, b) => a - b);
    fs.writeFileSync(path.join(HERE, 'trades.json'), JSON.stringify(trades));
    fs.writeFileSync(path.join(HERE, 'marks.json'), JSON.stringify(marks));
    console.log(`${trades.length} trades, ${Object.values(marks).reduce((s, v) => s + v.length, 0)} marks`);
  } else if (mode === 'report') {
    const trades = JSON.parse(fs.readFileSync(path.join(HERE, 'trades.json'), 'utf8')), Q = {}, listed = {};
    for (const p of PAIRS18) { const f = path.join(dir, `ticks-${sym(p)}.json`); if (!fs.existsSync(f)) { listed[p] = 'no probe file'; continue; }
      const j = JSON.parse(fs.readFileSync(f, 'utf8')); if (j.error || !Array.isArray(j.marks)) { listed[p] = j.error || 'no marks'; continue; }
      Q[p] = new Map(j.marks.map((m) => [m[0], m])); listed[p] = 'ok'; }
    const done = [], dropped = { pair: 0, quote: 0 }, costs = [], entrySp = [];
    for (const t of trades) {
      if (!Q[t.pair]) { dropped.pair++; continue; }
      const sE = spreadAt(Q[t.pair], t.filled), sX = spreadAt(Q[t.pair], t.exitT); if (sE == null || sX == null) { dropped.quote++; continue; }
      const a = charge(t, sE, sX), b = charge(t, sE, sX, STRESS_PIPS);
      done.push({ ...t, net: a.net, netStress: b.net }); costs.push(a.costPips); entrySp.push(sE / pipOf(t.pair));
    }
    const base = statsOf(done), stress = statsOf(done.map((x) => ({ ...x, net: x.netStress })));
    const byGroup = Object.fromEntries([['majors', MAJORS], ['crosses', CROSSES], ['s2', NEWPAIRS]].map(([k, ps]) => [k, statsOf(done.filter((x) => ps.includes(x.pair)))]));
    const verdict = base.n < N_MIN ? `TOO FEW (n ${base.n})` : base.net > 0 && base.tMonth >= 2 && stress.net > 0 ? 'PASS' : 'FAIL';
    const out = { study: 'fx-weekend-gap-exec', built: new Date().toISOString().slice(0, 10), probeCommit: commit || null, listed, dropped,
      cost: { medianPips: r4(med(costs)), p90Pips: r4(pct(costs, 0.9)), entrySpreadPips: { median: r4(med(entrySp)), p90: r4(pct(entrySp, 0.9)), max: r4(entrySp.length ? Math.max(...entrySp) : null) }, assumedPips: 2.3 },
      base, stress, byGroup, verdict: `${verdict}: Rule G at the demo's measured spreads, ${base.n} trades ${done.length ? done[0].F && new Date(done[0].F * 1000).toISOString().slice(0, 10) : ''} → 2026-11-13, net ${base.net}R a trade (month t ${base.tMonth}); stress ${stress.net}R; measured cost ${r4(med(costs))} pips median`,
      byPair: Object.fromEntries(PAIRS18.map((p) => [p, statsOf(done.filter((x) => x.pair === p))])) };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1));
    console.log(out.verdict); console.log(JSON.stringify({ cost: out.cost, base, stress, byGroup, dropped }));
  } else throw new Error('usage: run.mjs marks <fxDir> | report <probeDir> [commit]');
}
