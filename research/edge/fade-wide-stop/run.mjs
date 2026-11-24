// research/edge/fade-wide-stop/run.mjs - wider stops on the two Equinox fades, as pre-registered in PREREGISTRATION.md
// (24 Nov 2026): the break fade (grid7-wide-fade m15 none atr) and the big-candle fade (big-candle-fade m15 k1.5 nobreak), the
// SAME trades with the parent stop, 1.5 / 2 / 3 x the M15 ATR, or 1 x the H1 ATR; 2R target (1R beside); judged AFTER costs.
// Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/fade-wide-stop/run.mjs market <m> <outDir>
//   node research/edge/fade-wide-stop/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { MARKETS, ASSUMED, FROM, SPLIT, TO, NM, DM, monthOf, mstat, p1 } from '../grid7-wide-core/run.mjs';
import { signals as breakSignals, exits, CAP } from '../grid7-wide-fade/run.mjs';
import { signals as bigSignals, trade as bigTrade } from '../big-candle-fade/run.mjs';

export { MARKETS, ASSUMED };
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const RULES = ['break', 'big'], RULEN = { break: 'Break fade (m15 none)', big: 'Big-candle fade (m15 k1.5 nobreak)' };
export const STOPS = ['p', 'a15', 'a2', 'a3', 'h1'], MULT = { a15: 1.5, a2: 2, a3: 3 }, TGT = [1, 2];
export const NCELL = RULES.length * STOPS.length * TGT.length + 1;           // + the big-candle parent "half" (gate)
export const cellOf = (r, st, x) => (r * STOPS.length + st) * TGT.length + x;
export const HALF = NCELL - 1;
export const NPAIR = RULES.length * (STOPS.length - 1);                       // variant - parent stop, 2R, after costs
export const pairOf = (r, st) => r * (STOPS.length - 1) + (st - 1);
export const TESTS = [];                                                      // T1-T8: rule x wide stop, 2R
for (let r = 0; r < 2; r++) for (let st = 1; st < STOPS.length; st++) TESTS.push({ id: 'T' + (TESTS.length + 1), r, st, cell: cellOf(r, st, 1) });
export const cellName = (c) => c === HALF ? 'big parent-stop half' : (() => { const x = c % 2, q = (c - x) / 2, st = q % 5, r = (q - st) / 5; return `${RULES[r]} ${STOPS[st]} ${TGT[x]}R`; })();
const CAP15 = CAP['15m'];
const EPS = 1e-9;

// the distance of each stop variant from the fill; null = not available (the trade is dropped from every variant)
export function stopDists(par, a, h1a) {
  if (!(par > 0) || !(a > 0) || !(h1a > 0)) return null;
  return [par, 1.5 * a, 2 * a, 3 * a, h1a];
}
// outcome of one exit: 0 stop, 1 target, 2 time
export const kindOf = (R, k) => (R <= -1 + EPS ? 0 : R >= k - EPS ? 1 : 2);
// ATR(14) of the last H1 candle closed at time ts (closed candles only)
export function h1AtrAt(H1, atrH1, ts) { const n = K.closedCount(H1, ts); return n > 0 ? atrH1[n - 1] : 0; }

function newAcc(n) { const z = () => new Float64Array(n * 2);
  return { ms: new Float64Array(n * NM), msNet: new Float64Array(n * NM), n: z(), sum: z(), sq: z(), net: z(), nsq: z(), cr: z(), units: z(), stop: z(), tgt: z(), time: z(), both: z() }; }
function add(A, c, w, m, R, cr, k, units, both) { const i = c * 2 + w; A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; A.n[i]++; A.sum[i] += R; A.sq[i] += R * R;
  A.net[i] += R - cr; A.nsq[i] += (R - cr) * (R - cr); A.cr[i] += cr; A.units[i] += units; if (k === 0) A.stop[i]++; else if (k === 1) A.tgt[i]++; else A.time[i]++; if (both) A.both[i]++; }

// one signal on all stops: { fill, s, D: [dist], R: [[1R,2R] per stop], M: mirror, ok } or a skip reason
export function simAll(M5, fi, s, D) {
  const fill = M5[fi].o, R = [], M = [];
  for (const d of D) {
    const stop = fill - s * d; if (!(s * (fill - stop) > 0)) throw new Error('stop on the wrong side');
    const r = exits(M5, s, fi, stop, TGT.map((k) => fill + s * k * d), CAP15);
    const p = exits(M5, -s, fi, fill + s * d, TGT.map((k) => fill - s * k * d), CAP15);
    if (!r || !p) return null; R.push(r.R); M.push(p.R);
  }
  return { fill, R, M };
}

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5);
  const H1 = F['1h'], aH1 = atr14(H1), cost = COSTS[market], X = exclusions(market);
  const inBad = (t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
  const fade = newAcc(NCELL), mirr = newAcc(NCELL), pr = { ms: new Float64Array(NPAIR * NM), n: new Float64Array(NPAIR * 2), sum: new Float64Array(NPAIR * 2) };
  const cnt = { break: { sigs: 0, trades: 0, small: 0, bad: 0, open: 0, noH1: 0, dropped: 0 }, big: { sigs: 0, trades: 0, small: 0, bad: 0, open: 0, noH1: 0, nohalf: 0, dropped: 0 } };
  const book = (r, g, fi, s, D, extraHalf) => {
    const t = M5[fi].t, w = t < SPLIT ? 0 : 1, m = monthOf(t);
    const sim = simAll(M5, fi, s, D); if (!sim) { cnt[RULES[r]].open++; return; }
    cnt[RULES[r]].trades++;
    const parStop = [kindOf(sim.R[0][0], 1), kindOf(sim.R[0][1], 2)];
    const netPar2 = sim.R[0][1] - cost / D[0];
    for (let st = 0; st < STOPS.length; st++) { const d = D[st], cr = cost / d, units = d / g.a;
      for (let x = 0; x < 2; x++) { const c = cellOf(r, st, x), k = kindOf(sim.R[st][x], TGT[x]);
        add(fade, c, w, m, sim.R[st][x], cr, k, units, k === 0 && parStop[x] === 0);
        const km = kindOf(sim.M[st][x], TGT[x]); add(mirr, c, w, m, sim.M[st][x], cr, km, units, false); }
      if (st > 0) { const q = pairOf(r, st), dlt = (sim.R[st][1] - cr) - netPar2; pr.ms[q * NM + m] += dlt; pr.n[q * 2 + w]++; pr.sum[q * 2 + w] += dlt; } }
    if (extraHalf) { const cr = cost / D[0]; add(fade, HALF, w, m, extraHalf.R, cr, kindOf(extraHalf.R, extraHalf.k), 1, false); add(mirr, HALF, w, m, extraHalf.M, cr, kindOf(extraHalf.M, extraHalf.k), 1, false); }
  };
  const window = (fi) => { if (fi >= M5.length) return null; const t = M5[fi].t; if (t < FROM || t >= TO) return null; return t; };
  // break fade: grid7-wide-fade signals, M15 (tf 1), context none (cx 0); parent stop 1 x ATR
  for (const g of breakSignals(F)) { if (g.tf !== 1 || g.cx !== 0) continue;
    const fi = startIdx(M5, g.ts), t = window(fi); if (t == null) continue; cnt.break.sigs++;
    if (X.length && inBad(t)) { cnt.break.dropped++; continue; }
    const s = -g.d, fill = M5[fi].o, risk = g.a; if (!(risk > 0)) { cnt.break.bad++; continue; } if (risk < cost) { cnt.break.small++; continue; }
    void fill; const D = stopDists(risk, g.a, h1AtrAt(H1, aH1, g.ts)); if (!D) { cnt.break.noH1++; continue; }
    book(0, g, fi, s, D, null); }
  // big-candle fade: big-candle-fade signals, M15 (tf 0), body over 1.5 x ATR, not a break the same way; its own trade() for the parent
  for (const g of bigSignals(F).big) { if (g.tf !== 0 || g.kmax < 0 || g.brk) continue;
    const fi = startIdx(M5, g.ts), t = window(fi); if (t == null) continue; cnt.big.sigs++;
    if (X.length && inBad(t)) { cnt.big.dropped++; continue; }
    const p = bigTrade(M5, g, cost); if (!p) continue; if (p.skip) { cnt.big[p.skip]++; continue; }
    if (!Number.isFinite(p.ks[2])) { cnt.big.nohalf++; continue; }        // the parent "half" cell: half target 1R or more away
    const D = stopDists(p.risk, g.a, h1AtrAt(H1, aH1, g.ts)); if (!D) { cnt.big.noH1++; continue; }
    book(1, g, fi, p.s, D, { R: p.R[2], M: p.M[2], k: p.ks[2] }); }
  const J = (A) => Object.fromEntries(Object.entries(A).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, assumed: ASSUMED.includes(market), first: M5[0]?.t ?? null, last: M5.length ? M5[M5.length - 1].t : null, cnt, fade: J(fade), mirror: J(mirr), pair: J(pr) };
}

// ---- pooled statistics ----------------------------------------------------------------------------------------------------
export function pool(list, kind) { const out = {}; for (const d of list) for (const [k, v] of Object.entries(d[kind])) { if (!out[k]) out[k] = new Float64Array(v.length); for (let i = 0; i < v.length; i++) out[k][i] += v[i]; } return out; }
export function cellStats(A, c) {
  const ms = A.ms.subarray(c * NM, (c + 1) * NM), msn = A.msNet.subarray(c * NM, (c + 1) * NM);
  const win = (w) => { const i = c * 2 + w, n = A.n[i], a = w ? DM : 0, b = w ? NM : DM;
    return { n, mean: n ? A.sum[i] / n : null, t: mstat(ms, a, b).t, meanNet: n ? A.net[i] / n : null, tNet: mstat(msn, a, b).t, months: b - a,
      costR: n ? A.cr[i] / n : null, units: n ? A.units[i] / n : null, stop: n ? A.stop[i] / n : null, tgt: n ? A.tgt[i] / n : null, time: n ? A.time[i] / n : null, both: A.both[i] }; };
  return { d: win(0), c: win(1) };
}
export const passOf = (x, h) => x.d.n >= 200 && x.c.n >= 200 && x.d.meanNet > 0 && x.c.meanNet > 0 && x.c.tNet >= 2 && h < 0.05;
export const bars13 = (x) => x.d.n >= 200 && x.c.n >= 200 && x.d.meanNet > 0 && x.c.meanNet > 0 && x.c.tNet >= 2;
export function judge(data) {
  const F = pool(data, 'fade'), M = pool(data, 'mirror'), P = pool(data, 'pair');
  const tests = TESTS.map((T) => { const s = cellStats(F, T.cell), m = cellStats(M, T.cell);
    return { ...T, name: `${RULES[T.r]} ${STOPS[T.st]} 2R`, d: s.d, c: s.c, p: p1(s.c.tNet, s.c.months - 1), mir: { d: m.d, c: m.c, sep: !bars13(m) } }; });
  const H = K.holm(tests.map((x) => x.p));
  tests.forEach((x, i) => { x.holm = H[i]; x.pass = passOf(x, H[i]) && x.mir.sep; });
  const cells = Array.from({ length: NCELL }, (_, c) => ({ cell: c, name: cellName(c), ...cellStats(F, c), mir: cellStats(M, c) }));
  const pairs = []; for (let r = 0; r < 2; r++) for (let st = 1; st < STOPS.length; st++) { const q = pairOf(r, st);
    const w = (k) => { const a = k ? DM : 0, b = k ? NM : DM, n = P.n[q * 2 + k]; return { n, mean: n ? P.sum[q * 2 + k] / n : null, t: mstat(P.ms.subarray(q * NM, (q + 1) * NM), a, b).t }; };
    pairs.push({ name: `${RULES[r]} ${STOPS[st]} - p, 2R, after costs`, d: w(0), c: w(1) }); }
  return { tests, cells, pairs };
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
const pc = (x) => (x == null ? 'n/a' : (100 * x).toFixed(1) + '%');
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(4), t: +w.t.toFixed(2), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(4), tNet: +w.tNet.toFixed(2),
  costR: w.costR == null ? null : +w.costR.toFixed(4), units: w.units == null ? null : +w.units.toFixed(3), stop: w.stop == null ? null : +w.stop.toFixed(4),
  tgt: w.tgt == null ? null : +w.tgt.toFixed(4), time: w.time == null ? null : +w.time.toFixed(4) });

export function report(dir) {
  const data = MARKETS.map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const { tests, cells, pairs } = judge(data);
  const pass = tests.filter((x) => x.pass), verdict = pass.length ? 'PASS' : 'FAIL';
  const best = [...tests].sort((a, b) => b.c.tNet - a.c.tNet)[0];
  const headline = verdict === 'PASS'
    ? `${pass.length} of 8 wider-stop tests pass after costs; best ${pass[0].name}, ${f3(pass[0].c.meanNet)}R a trade after costs in 2015-26 (n ${N(pass[0].c.n)}, month t ${f2(pass[0].c.tNet)})`
    : `0 of 8 wider-stop tests are positive after costs in both windows; the best, ${best.name}, made ${f3(best.c.meanNet)}R a trade after costs in 2015-26 (n ${N(best.c.n)}, month t ${f2(best.c.tNet)}; ${f3(best.c.mean)}R before costs)`;
  // stopped either way: of the parent's trades stopped at the parent stop (2R), the share also stopped at each wider stop
  const either = []; for (let r = 0; r < 2; r++) { const par = cells[cellOf(r, 0, 1)];
    for (let st = 1; st < STOPS.length; st++) { const v = cells[cellOf(r, st, 1)];
      const pS = par.d.stop * par.d.n + par.c.stop * par.c.n, both = v.d.both + v.c.both, n = v.d.n + v.c.n;
      either.push({ rule: RULES[r], stop: STOPS[st], parentStopped: +(pS / n).toFixed(4), variantStopped: +((v.d.stop * v.d.n + v.c.stop * v.c.n) / n).toFixed(4),
        alsoStopped: +(both / pS).toFixed(4), bothShare: +(both / n).toFixed(4) }); } }
  const gate = { break: { d: cells[cellOf(0, 0, 1)].d, c: cells[cellOf(0, 0, 1)].c }, bigHalf: { d: cells[HALF].d, c: cells[HALF].c } };
  const out = { study: 'fade-wide-stop', built: '2026-11-24', verdict, headline,
    basis: 'judged AFTER costs on calendar-month sums (pre-registered); before costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' },
    markets: MARKETS, assumedCosts: ASSUMED, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    gate: { break2R: { want: { d: { n: 171523, mean: 0.054 }, c: { n: 201769, mean: 0.042 } }, got: { d: slim(gate.break.d), c: slim(gate.break.c) } },
      bigHalf: { want: { d: { n: 47354, mean: 0.307 }, c: { n: 54443, mean: 0.193 } }, got: { d: slim(gate.bigHalf.d), c: slim(gate.bigHalf.c) } } },
    meta: data.map((d) => ({ market: d.market, cost: d.cost, assumed: d.assumed, cnt: d.cnt })),
    tests: tests.map((x) => ({ id: x.id, name: x.name, disc: slim(x.d), conf: slim(x.c), p: +x.p.toFixed(6), holm: +x.holm.toFixed(6), pass: x.pass,
      mirror: { disc: slim(x.mir.d), conf: slim(x.mir.c), separated: x.mir.sep } })),
    passed: pass.map((x) => x.name),
    cells: cells.map((c) => ({ name: c.name, disc: slim(c.d), conf: slim(c.c), mirror: { disc: slim(c.mir.d), conf: slim(c.mir.c) } })),
    pairs: pairs.map((q) => ({ name: q.name, disc: { n: q.d.n, mean: +q.d.mean.toFixed(4), t: +q.d.t.toFixed(2) }, conf: { n: q.c.n, mean: +q.c.mean.toFixed(4), t: +q.c.t.toFixed(2) } })),
    stoppedEitherWay: either };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  return out;
}

const [, , cmd, a1, a2] = process.argv;
if (cmd === 'market') { const r = runMarket(a1); fs.mkdirSync(a2, { recursive: true }); fs.writeFileSync(path.join(a2, a1 + '.json'), JSON.stringify(r)); console.log(a1, JSON.stringify(r.cnt)); }
else if (cmd === 'report') { const o = report(a1); console.log(o.verdict, o.headline); }
export { f3, f2, N, pc };
