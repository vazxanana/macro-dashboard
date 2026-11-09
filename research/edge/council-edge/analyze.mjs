// Council edge · scores the three pre-registered hypotheses (preregistration.md) on the harness output of run.mjs.
//   node research/edge/council-edge/analyze.mjs <OUT_DIR of run.mjs> [<council-data dir> for the forward cost diagnostic]
// -> result.json next to this file (and the tables on stdout). Pure helpers exported for tests/council-edge.test.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { summarize, pairedDiff, sessionOf } from './stats.mjs';
import { breakdown, collectRows, load as loadData } from './breakdown.mjs';

export const COST = { gross: 0, x1: 0.60, x2: 1.20 };          // $ a unit round trip on gold (council/fills.mjs model: 0.30 + 2 x 0.15)
export const T0 = Date.parse('2020-01-01T00:00:00Z') / 1000, SPLIT = Date.parse('2023-06-01T00:00:00Z') / 1000;
export const END = Date.parse('2026-11-07T00:00:00Z') / 1000;
export const WF = { from: Date.parse('2021-01-01T00:00:00Z') / 1000, split: Date.parse('2024-01-01T00:00:00Z') / 1000, months: 24, n: 15, t: -1.0 };
export const GATE = 0.10;

// ─── positions: { sys, id, T, r0, legs: [{ R, size, r0 }], timeExit } ───
export function fromReplica(j, sys = 'replica') {
  return (j.positions || []).map((p) => ({ sys, id: p.id, T: p.T, r0: p.legs.find((l) => !l.add).r0,
    legs: p.legs.map((l) => ({ R: l.R, size: l.size || 1, r0: l.r0 })), timeExit: p.legs.some((l) => l.exitKind === 'time') }));
}
// replica independent signals that pass the live gates at the signal (solo: no portfolio state), size 1
export function fromSolo(j) {
  return (j.solo || []).filter((s) => s.volOk && s.d1w && !s.news).map((s) => ({ sys: 'replica-solo', id: `solo-${s.T}`, T: s.T, r0: s.legs.find((l) => !l.add).r0,
    legs: s.legs.map((l) => ({ R: l.R, size: l.size || 1, r0: l.r0 })), timeExit: s.legs.some((l) => l.exitKind === 'time') }));
}
export function fromGold(legs) {
  const filled = legs.filter((l) => l.filled != null && Number.isFinite(l.R) && l.status === 'closed');
  const out = new Map();
  for (const l of filled) if (!l.addOf) out.set(l.id, { sys: l.k, id: l.id, T: l.filled, r0: l.r0, legs: [], timeExit: false });
  for (const l of filled) { const p = out.get(l.addOf || l.id); if (!p) continue; p.legs.push({ R: l.R, size: l.size || 1, r0: l.r0 }); if (/ h$/.test(l.exit || '')) p.timeExit = true; }
  return [...out.values()];
}
export const netOf = (p, c) => p.legs.reduce((s, l) => s + l.size * (l.R - (l.r0 > 0 ? c / l.r0 : 0)), 0);
export const costR = (p, c = COST.x1) => p.r0 > 0 ? c / p.r0 : Infinity;
const inWin = (p, a = T0, b = END) => p.T >= a && p.T < b;
const S = (ps, c) => summarize(ps.map((p) => netOf(p, c)));

// ─── H1: paired difference holdOpen − live on the positions both runs took ───
export function pairUp(live, alt) {
  const m = new Map(alt.map((p) => [`${p.sys}|${p.id}`, p])), pairs = [];
  for (const p of live) { const q = m.get(`${p.sys}|${p.id}`); if (q) pairs.push([p, q]); }
  return { pairs, onlyLive: live.length - pairs.length, onlyAlt: alt.length - pairs.length };
}
export function h1(live, alt, c = COST.x1) {
  const { pairs, onlyLive, onlyAlt } = pairUp(live.filter((p) => inWin(p)), alt.filter((p) => inWin(p)));
  const d = (ps) => pairedDiff(ps.map(([, q]) => netOf(q, c)), ps.map(([p]) => netOf(p, c)));
  const touched = pairs.filter(([p, q]) => p.timeExit || q.timeExit);
  const bySys = {};
  for (const sys of [...new Set(pairs.map(([p]) => p.sys))]) { const ps = pairs.filter(([p]) => p.sys === sys); bySys[sys] = { n: ps.length, timeExits: ps.filter(([p, q]) => p.timeExit || q.timeExit).length, diff: d(ps), live: S(ps.map(([p]) => p), c), alt: S(ps.map(([, q]) => q), c) }; }
  const all = d(pairs), A = d(pairs.filter(([p]) => p.T < SPLIT)), B = d(pairs.filter(([p]) => p.T >= SPLIT)), onTouched = d(touched);
  const pass = all.mean > 0 && all.t >= 2 && A.mean > 0 && B.mean > 0 && Object.values(bySys).every((s) => s.diff.total >= -1);
  return { n: pairs.length, onlyLive, onlyAlt, timeExits: touched.length, all, A, B, onTouched, bySys, pass };
}

// ─── H2: cost gate ───
export function h2(ps, c = COST.x1, gate = GATE) {
  const w = ps.filter((p) => inWin(p)), cut = (p) => costR(p, COST.x1) > gate;
  const kept = w.filter((p) => !cut(p)), gone = w.filter(cut);
  const half = (a, b) => { const x = w.filter((p) => inWin(p, a, b)); return { all: S(x, c).total, kept: S(x.filter((p) => !cut(p)), c).total }; };
  const bySys = {};
  for (const sys of [...new Set(w.map((p) => p.sys))]) { const x = w.filter((p) => p.sys === sys); bySys[sys] = { all: S(x, c), kept: S(x.filter((p) => !cut(p)), c), removed: S(x.filter(cut), c) }; }
  const A = half(T0, SPLIT), B = half(SPLIT, END), removed = S(gone, c);
  const big = Object.values(bySys).filter((s) => s.removed.n >= 10), better = big.filter((s) => s.kept.mean > s.all.mean).length;
  return { gate, n: w.length, removed, kept: S(kept, c), all: S(w, c), A, B, bySys, better, of: big.length,
    pass: removed.n > 0 && removed.mean < 0 && removed.t <= -2 && A.kept > A.all && B.kept > B.all && big.length > 0 && better >= Math.min(3, big.length) };
}

// ─── H3: walk-forward session gate ───
const qStart = (t) => { const d = new Date(t * 1000); return Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / 3) * 3, 1) / 1000; };
export function sessionGate(ps, closedAt, c = COST.x1, cfg = WF) {
  const off = new Map(), drop = new Set();   // `${sys}|${quarter}` -> sessions off
  for (const p of ps) {
    if (p.T < cfg.from) continue;
    const q = qStart(p.T), key = `${p.sys}|${q}`;
    if (!off.has(key)) {
      const lo = Math.max(T0, q - cfg.months * 30.4375 * 86400), hist = ps.filter((x) => x.sys === p.sys && x.T >= lo && closedAt(x) < q), set = [];
      for (const s of ['asia', 'london', 'overlap', 'newyork', 'late']) { const st = S(hist.filter((x) => sessionOf(x.T) === s), c); if (st.n >= cfg.n && st.mean < 0 && st.t <= cfg.t) set.push(s); }
      off.set(key, set);
    }
    if (off.get(key).includes(sessionOf(p.T))) drop.add(p);
  }
  return { drop, off: Object.fromEntries([...off].filter(([, v]) => v.length)) };
}
export function h3(ps, closedAt, c = COST.x1) {
  const w = ps.filter((p) => p.T >= WF.from && p.T < END), { drop, off } = sessionGate(ps, closedAt, COST.x1);
  const kept = w.filter((p) => !drop.has(p)), gone = w.filter((p) => drop.has(p));
  const half = (a, b) => ({ all: S(w.filter((p) => p.T >= a && p.T < b), c).total, kept: S(kept.filter((p) => p.T >= a && p.T < b), c).total });
  const A = half(WF.from, WF.split), B = half(WF.split, END), dropped = S(gone, c);
  return { n: w.length, dropped, kept: S(kept, c), all: S(w, c), A, B, off,
    pass: dropped.n > 0 && dropped.mean < 0 && dropped.t <= -2 && A.kept > A.all && B.kept > B.all };
}

// forward diagnostic: the engine's closed paper trades split by the costR the Trader stamped
export function forwardCost(trades, gate = GATE) {
  const done = trades.filter((t) => ['win', 'loss', 'be'].includes(t.status) && Number.isFinite(t.costR) && Number.isFinite(t.Rnet));
  return { gate, low: summarize(done.filter((t) => t.costR <= gate).map((t) => t.Rnet)), high: summarize(done.filter((t) => t.costR > gate).map((t) => t.Rnet)),
    highGross: summarize(done.filter((t) => t.costR > gate).map((t) => t.R)) };
}

// post-hoc diagnostic (not pre-registered): the council's 150-day engine replay (council-data research/backtest-150d.json) split at
// the same 0.10R; its `cost` column is the spread in R, so the round trip with half a spread of slippage each way is 2 x cost
export function replayCost(bt, gate = GATE) {
  const ix = Object.fromEntries(bt.tradeCols.map((c, i) => [c, i])), rows = bt.trades.filter((r) => r[ix.fill] && Number.isFinite(r[ix.R_none]));
  const rt = (r) => 2 * r[ix.cost], part = (a) => ({ net: summarize(a.map((r) => r[ix.R_none] - rt(r))), gross: summarize(a.map((r) => r[ix.R_none])).mean });
  return { from: bt.from, to: bt.to, gate, low: part(rows.filter((r) => rt(r) <= gate)), high: part(rows.filter((r) => rt(r) > gate)) };
}

const rd = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
export function loadRun(dir) {
  const R = (v) => rd(path.join(dir, `replica-${v}`, 'trades.json')), G = (v) => rd(path.join(dir, `gold-${v}`, 'trades.json'));
  const out = {};
  for (const v of ['live', 'holdOpen']) {
    const rj = R(v), gl = G(v), closed = new Map();
    for (const p of rj.positions) closed.set(p.id, Math.max(...p.legs.map((l) => l.closed)));
    for (const l of gl) if (l.filled != null) closed.set(l.addOf || l.id, Math.max(closed.get(l.addOf || l.id) || 0, l.closed));
    out[v] = { positions: fromReplica(rj).concat(fromGold(gl)), solo: fromSolo(rj), closedAt: (p) => closed.get(p.id) ?? Infinity };
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [dir, cdata] = process.argv.slice(2);
  const run = loadRun(dir), L = run.live, H = run.holdOpen, res = { built: '2026-11-09', topic: 'council-edge',
    system: 'Gold replica, gtrend, gtrend5, gtl, geg on OANDA XAU/USD M5 2020-01-01..2026-11-06 (live rules of 7 Nov); Meridian engine paper records',
    note: 'net R a position; x1 = $0.60 a unit round trip, x2 = $1.20; halves A to 2023-05-31, B from 2023-06-01; H3 from 2021 (halves at 2024-01-01)' };
  const sysList = [...new Set(L.positions.map((p) => p.sys))];
  res.base = {};
  for (const sys of sysList.concat(['replica-solo'])) {
    const ps = (sys === 'replica-solo' ? L.solo : L.positions.filter((p) => p.sys === sys)).filter((p) => inWin(p));
    res.base[sys] = Object.fromEntries(Object.entries(COST).map(([k, c]) => [k, S(ps, c)]));
    res.base[sys].A = S(ps.filter((p) => p.T < SPLIT), COST.x1); res.base[sys].B = S(ps.filter((p) => p.T >= SPLIT), COST.x1);
    res.base[sys].years = Object.fromEntries([2020, 2021, 2022, 2023, 2024, 2025, 2026].map((y) => [y, S(ps.filter((p) => new Date(p.T * 1000).getUTCFullYear() === y), COST.x1)]).map(([y, s]) => [y, { n: s.n, mean: s.mean, total: s.total }]));
    res.base[sys].r0 = { median: +ps.map((p) => p.r0).sort((a, b) => a - b)[ps.length >> 1]?.toFixed(2), under6: ps.filter((p) => p.r0 < 6).length };
  }
  const tm = (ps) => ps.filter((p) => ['replica', 'gtl', 'geg'].includes(p.sys));
  res.h1 = { x1: h1(tm(L.positions), tm(H.positions), COST.x1), x2: h1(tm(L.positions), tm(H.positions), COST.x2), solo: h1(L.solo, H.solo, COST.x1) };
  res.h2 = { x1: h2(L.positions, COST.x1), x2: h2(L.positions, COST.x2), solo: h2(L.solo, COST.x1),
    diag: Object.fromEntries([0.05, 0.15, 0.20].map((g) => [g, h2(L.positions, COST.x1, g)])) };
  res.h3 = { x1: h3(tm(L.positions), L.closedAt, COST.x1), x2: h3(tm(L.positions), L.closedAt, COST.x2) };
  if (cdata) {
    try { res.forward = forwardCost(rd(path.join(cdata, 'trades.json'))); } catch (e) { res.forward = { error: String(e.message) }; }
    try { res.replay150 = replayCost(rd(path.join(cdata, 'research', 'backtest-150d.json'))); } catch (e) { res.replay150 = { error: String(e.message) }; }
    const bd = breakdown(collectRows(loadData(cdata)));
    res.breakdown = { books: Object.fromEntries(Object.entries(bd.books).map(([k, v]) => [k, v.all])), negative: bd.negative };
  }
  res.verdict = 'FAIL: none of the three pre-registered changes passes; keep the live rules';
  res.verdicts = { h1: res.h1.x1.pass && res.h1.x2.pass ? 'pass' : 'fail', h2: res.h2.x1.pass && res.h2.x2.pass ? 'pass' : 'fail', h3: res.h3.x1.pass && res.h3.x2.pass ? 'pass' : 'fail' };
  const strip = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v instanceof Set ? undefined : v)));
  fs.writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'result.json'), JSON.stringify(strip(res), null, 1) + '\n');
  console.log(JSON.stringify(strip({ base: res.base, verdicts: res.verdicts }), null, 1));
}
