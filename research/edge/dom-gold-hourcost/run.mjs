// research/edge/dom-gold-hourcost/run.mjs - the H1 dominant-zone limit on gold (grid 3's family) charged the demo broker's
// measured spread of its fill and exit hours + commission + 0.05 x M stop slippage + long financing (PREREGISTRATION.md).
//   EDGE_DATA=<cache> node --max-old-space-size=6000 research/edge/dom-gold-hourcost/run.mjs <ticks-XAUUSD.json at 0459ec37>
// Writes result.json and RESULT.md next to this file. Research only: imports the grid 3 engine, the hourcost study's
// medRange, council/fills.mjs nights / FIN; edits none of them.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames, signalsFor, multi, COSTS, exclusions, NONE } from '../combo-grid-3/run.mjs';
import { medRange } from '../gold-vol-breakout-hourcost/costs.mjs';
import { nights, FIN } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (n) => Date.UTC(n, 0, 1) / 1000;
export const FROM = y(2021), SPLIT = y(2024);
export const COMMISSION = 0.000024, PROBE_COMMIT = '0459ec37';
export const EXITS = { '2R': 1, '3R': 2, '4R': 3, trail: 6 }; // multi() R slots
export const GRID_GOLD_4R_B = { n: 8909, before: 0.142 };      // combo-grid-3 RESULT.md, gold 4R, 2024-now, before costs
export const CUTS = ['2022-06-15', '2024-03-15', '2025-09-15'];
const CAP = 2 * 86400, cost0 = COSTS.xau;

function atr14(B) { const a = new Float64Array(B.length); let s = 0; const tr = (i) => Math.max(B[i].h - B[i].l, Math.abs(B[i].h - B[i - 1].c), Math.abs(B[i].l - B[i - 1].c));
  for (let i = 1; i < B.length; i++) { s += tr(i); if (i > 14) s -= tr(i - 14); a[i] = i >= 14 ? s / 14 : 0; } return a; }
const firstAt = (B, t) => { let lo = 0, hi = B.length; while (lo < hi) { const m = (lo + hi) >> 1; if (B[m].t < t) lo = m + 1; else hi = m; } return lo; };

// One exit of multi() walked again to learn its exit candle (multi returns R only). Same order of checks as multi() for a
// limit entry: from the second candle a gap through the stop / target at the open; the low against the stop; from the second
// candle the high against the target and the trail's move; the 2-day limit at a candle's end. Returns { R, j } or null.
export function walk(M5, s, fi, fill, stop, risk, kind) {
  const deadline = M5[fi].t + CAP, tgt = kind === 'trail' ? null : fill + s * (+kind[0]) * risk;
  let tStop = stop, best = fill;
  for (let j = fi; j < M5.length; j++) { const b = M5[j], first = j === fi;
    if (kind === 'trail') {
      if (!first && s * (b.o - tStop) <= 0) return { R: (s * (b.o - fill)) / risk, j };
      const low = s > 0 ? b.l : b.h, high = s > 0 ? b.h : b.l;
      if (s * (low - tStop) <= 0) return { R: (s * (tStop - fill)) / risk, j };
      if (!first) { if (s * (high - best) > 0) best = high; if (s * (best - fill) >= risk) { const ns = best - s * risk; if (s * (ns - tStop) > 0) tStop = ns; } }
    } else {
      if (!first) { if (s * (b.o - stop) <= 0) return { R: (s * (b.o - fill)) / risk, j }; if (s * (b.o - tgt) >= 0) return { R: (s * (b.o - fill)) / risk, j }; }
      const low = s > 0 ? b.l : b.h, high = s > 0 ? b.h : b.l;
      if (s * (low - stop) <= 0) return { R: (s * (stop - fill)) / risk, j };
      if (!first && s * (high - tgt) >= 0) return { R: (s * (tgt - fill)) / risk, j };
    }
    if (b.e >= deadline) return { R: (s * (b.c - fill)) / risk, j };
  }
  return null;
}

// every trade of the rule on candles up to `to` (unix s), fills from FROM; each with its exits' R and exit candles
export function trades(M5) {
  const F = frames(M5), H = F['1h'], T = F['5m'], A = atr14(H), X = exclusions('xau');
  const bad = (t) => X.some(([a, b]) => t >= a && t <= b);
  const out = []; let walkMismatch = 0;
  for (const sg of signalsFor(F, '1h', '5m', 'dom', {}, FROM)) {
    if (sg.trig !== NONE) continue;
    const z = sg.z, d = z.d, ts = T[sg.k0].t;
    const li = K.closedCount(H, ts) - 1; if (li < 15) continue;
    const entry = d > 0 ? z.top : z.bot, stop = d > 0 ? z.bot - cost0 / 2 - 0.25 * A[li] : z.top + cost0 / 2 + 0.25 * A[li];
    if (!(d * (entry - stop) >= 2 * cost0)) continue;
    const r = multi(M5, d, entry, stop, 'lim', ts, ts + 12 * 300, 2, null, CAP, null);
    if (!r || r.risk < cost0 || r.t < FROM || bad(r.t)) continue;
    const fi = firstAt(M5, r.t), fill = stop + d * r.risk;
    if (!(d * (fill - stop) > 0)) throw new Error('stop not on the losing side');
    const row = { t: r.t, side: d, entry, stop, fill: +fill.toFixed(5), risk: r.risk, M: medRange(M5, fi), ex: {} };
    for (const [k, slot] of Object.entries(EXITS)) {
      const w = walk(M5, d, fi, fill, stop, r.risk, k);
      if (!w || Math.abs(w.R - r.R[slot]) > 1e-9) { walkMismatch++; continue; }
      row.ex[k] = { R: r.R[slot], te: M5[w.j].t, end: M5[w.j].e };
    }
    out.push(row);
  }
  return { rows: out, walkMismatch };
}

// ---- costs ---------------------------------------------------------------------------------------------------------
const hourOf = (t) => new Date(t * 1000).getUTCHours();
export function costR(row, k, prof, route) {
  const e = row.ex[k]; const key = route === 'C2' ? 'frac90' : 'frac', s = route === 'C2' ? 0.10 : 0.05;
  if (route === 'flat') return cost0 / row.risk;
  const spread = (0.5 * prof[hourOf(row.t)][key] + 0.5 * prof[hourOf(e.te)][key] + COMMISSION) * row.fill + s * row.M;
  const fin = row.side > 0 ? nights(row.t, e.end) * FIN.xau.long * row.fill : 0;
  return (spread + fin) / row.risk;
}
const monthKey = (t) => new Date(t * 1000).toISOString().slice(0, 7);
function monthsBetween(a, b) { const out = []; const d = new Date(a * 1000); d.setUTCDate(1); while (d.getTime() / 1000 < b) { out.push(d.toISOString().slice(0, 7)); d.setUTCMonth(d.getUTCMonth() + 1); } return out; }
export function stat(rows, k, prof, route, from, to) {
  const sel = rows.filter((r) => r.t >= from && r.t < to && r.ex[k]); const n = sel.length; if (!n) return { n: 0 };
  const ms = new Map(monthsBetween(from, Math.min(to, sel[n - 1].t + 1)).map((m) => [m, 0]));
  let g = 0, c = 0;
  for (const r of sel) { const R = r.ex[k].R, cr = route ? costR(r, k, prof, route) : 0; g += R; c += cr; ms.set(monthKey(r.t), (ms.get(monthKey(r.t)) || 0) + R - cr); }
  const v = [...ms.values()], m = v.length, mean = v.reduce((a, b) => a + b, 0) / m, sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (m - 1));
  return { n, R: +((g - c) / n).toFixed(4), gross: +(g / n).toFixed(4), costR: +(c / n).toFixed(4), months: m, t: +(sd > 0 ? mean / (sd / Math.sqrt(m)) : 0).toFixed(2) };
}
export const p1 = (t, df) => (t > 0 ? K.pFromT(t, df) / 2 : 1 - K.pFromT(t, df) / 2);
const sg = (v) => (v >= 0 ? '+' : '') + v.toFixed(3);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const prof = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).hourProfile;
  for (let h = 0; h < 24; h++) if (!(prof[h] && prof[h].frac > 0 && prof[h].frac90 > 0)) throw new Error('hour ' + h + ' has no measured spread');
  const M5 = K.load('xau', '5m', { from: FROM - 200 * 86400 }); const END = M5[M5.length - 1].e;
  const { rows, walkMismatch } = trades(M5);
  const g2 = stat(rows, '4R', prof, null, SPLIT, END);
  const G = { G1: walkMismatch === 0, G2: Math.abs(g2.n - GRID_GOLD_4R_B.n) / GRID_GOLD_4R_B.n <= 0.02 && Math.abs(g2.gross - GRID_GOLD_4R_B.before) <= 0.01 };
  // G3 cut test
  const key = (r) => JSON.stringify([r.t, r.side, r.entry, r.stop, r.fill, Object.entries(r.ex).map(([k, e]) => [k, e.R, e.te])]);
  const cut = CUTS.map((c) => { const C = Date.parse(c + 'T00:00:00Z') / 1000; const part = trades(M5.filter((b) => b.e <= C)).rows;
    const full = rows.filter((r) => r.t + CAP + 600 <= C).map(key);
    const mine = new Set(part.filter((r) => r.t + CAP + 600 <= C).map(key));
    return { cut: c, compared: full.length, same: full.length === mine.size && full.every((k) => mine.has(k)) }; });
  G.G3 = cut.every((x) => x.same);
  const W = { A: [FROM, SPLIT], B: [SPLIT, END] };
  const table = {}; for (const k of Object.keys(EXITS)) { table[k] = {}; for (const [w, [a, b]] of Object.entries(W)) table[k][w] = { before: stat(rows, k, prof, null, a, b), C1: stat(rows, k, prof, 'C1', a, b), C2: stat(rows, k, prof, 'C2', a, b), flat: stat(rows, k, prof, 'flat', a, b) }; }
  const years = {}; for (let yr = 2021; yr <= 2026; yr++) { years[yr] = {}; for (const k of Object.keys(EXITS)) { const b = stat(rows, k, prof, null, y(yr), Math.min(y(yr + 1), END)), c = stat(rows, k, prof, 'C1', y(yr), Math.min(y(yr + 1), END)); years[yr][k] = { n: c.n, before: b.R, C1: c.R, tC1: c.t }; } }
  const tests = [['T1', '4R'], ['T2', 'trail']].map(([id, k]) => { const A_ = table[k].A.C1, B_ = table[k].B.C1, weak = A_.t <= B_.t ? A_ : B_;
    return { id, exit: k, A: A_, B: B_, p: p1(weak.t, weak.months - 1), bar: A_.R > 0 && A_.t >= 2 && B_.R > 0 && B_.t >= 2 }; });
  const holm = K.holm(tests.map((x) => x.p)); tests.forEach((x, i) => { x.holm = +holm[i].toPrecision(3); x.p = +x.p.toPrecision(3); x.pass = x.bar && holm[i] < 0.05; });
  const share = {}; for (const k of Object.keys(EXITS)) { const s = stat(rows, k, prof, 'C1', FROM, END); share[k] = { gross: s.gross, costR: s.costR, share: +(s.costR / s.gross).toFixed(3), n: s.n, net: s.R, t: s.t }; }
  const dollars = rows.filter((r) => r.ex['4R']).map((r) => costR(r, '4R', prof, 'C1') * r.risk).sort((a, b) => a - b);
  const risks = rows.map((r) => r.risk).sort((a, b) => a - b);
  const SESS = [['Asia', 0, 7], ['London', 7, 12], ['New York', 12, 21], ['late', 21, 24]];
  const sessions = {}; for (const [nm, a, b] of SESS) { const sel = rows.filter((r) => hourOf(r.t) >= a && hourOf(r.t) < b); sessions[nm] = { '4R': stat(sel, '4R', prof, 'C1', FROM, END), trail: stat(sel, 'trail', prof, 'C1', FROM, END) }; }
  const gatesOk = G.G1 && G.G2 && G.G3;
  const passed = tests.filter((x) => x.pass).map((x) => x.id);
  const verdict = !gatesOk ? 'STOPPED' : passed.length ? 'PASS' : 'FAIL';
  const t1 = tests[0], t2 = tests[1];
  const headline = gatesOk ? `At measured costs the 4R exit made ${sg(t1.A.R)}R a trade in 2021-23 (n ${t1.A.n}, month t ${t1.A.t}) and ${sg(t1.B.R)}R in 2024-now (n ${t1.B.n}, t ${t1.B.t}); the trail ${sg(t2.A.R)}R (t ${t2.A.t}) and ${sg(t2.B.R)}R (t ${t2.B.t})` : 'a gate failed: ' + JSON.stringify(G);
  const res = { study: 'dom-gold-hourcost', built: '2026-11-23', verdict, headline, passed, gates: G, gateG2: { got: g2, want: GRID_GOLD_4R_B }, cut, dataEnd: new Date(END * 1000).toISOString(),
    probe: { commit: PROBE_COMMIT, frac: prof.map((p) => p.frac), frac90: prof.map((p) => p.frac90) }, commission: COMMISSION, finLong: FIN.xau.long,
    tests, table, years, share, costDollars: { median: +dollars[dollars.length >> 1].toFixed(3), p90: +dollars[Math.floor(dollars.length * 0.9)].toFixed(3) }, riskDollars: { median: +risks[risks.length >> 1].toFixed(2) }, sessions,
    caution: '2020-26 has been read by three grids that picked this family; a pass is a candidate for the forward demo record, not evidence on new data.' };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1));
  console.log(JSON.stringify({ verdict, headline, gates: G, g2, cut, tests: tests.map(({ id, pass, holm }) => ({ id, pass, holm })), share }, null, 1));
}
