// research/edge/mosha-market-holdout/run.mjs - the one cell grid 6 confirmed, asked once on data the grid never read
// (PREREGISTRATION.md, 23 Nov 2026). Research only: reads the edgekit candle cache, places nothing.
//   node --max-old-space-size=6000 research/edge/mosha-market-holdout/run.mjs market <set> <m> <dir>   -> <dir>/<set>.<m>.json
//   node research/edge/mosha-market-holdout/run.mjs cut <set> <m> <dir>                                -> <dir>/<set>.<m>.cut.json
//   node research/edge/mosha-market-holdout/run.mjs report <dir>                                        the bar -> result.json
// Sets: gate (gold 2009-19, must reproduce the grid's figures), A (gold 2006-09), B (silver + eight pairs 2010-19, costs
// assumed), C (gold 2020 on). Imports grid6-mosha-market, grid5-mosha-cycle, combo-grid-2 and edgekit; none edited.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import * as G from '../grid6-mosha-market/run.mjs';
import { atr14 } from '../grid5-mosha-cycle/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (n) => Date.UTC(n, 0, 1) / 1000;
// the cell: ladder M30>M5 (index 3), break any, any place, entry MKT (es 0), stop cfz (st 1), exit 1R (R[0]), London (1), MSNR with (1)
export const CELL = { h: '30m', v: '5m', brk: 'any', es: G.ENTRY.indexOf('MKT'), st: G.STOP.indexOf('cfz'), x1R: G.EXITS.indexOf('1R'), xTr: G.EXITS.indexOf('trail'), sess: 1, call: 1 };
export const C_END = Date.UTC(2026, 10, 1) / 1000; // last complete month in the cache at the run (23 Nov 2026)
export const B_MARKETS = ['xag', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy'];
export const SETS = {
  gate: { markets: ['xau'], warm: y(2009), from: y(2010), to: y(2020) },
  A: { markets: ['xau'], warm: y(2006), from: Date.UTC(2006, 3, 1) / 1000, to: y(2010) },
  B: { markets: B_MARKETS, warm: y(2009), from: y(2010), to: y(2020), assumedCosts: true },
  C: { markets: ['xau'], warm: y(2019), from: y(2020), to: C_END },
};
export const GRID = { n1014: 302, mean1014: 0.1141, t1014: 2.16, n1519: 290, mean1519: 0.2249, t1519: 4.25 };

// every MKT / cfz trade of the ladder (all sessions and calls, so the cell and its context can be read), the grid's step
export function marketTrades(set, market) {
  const S = SETS[set]; const M5 = K.load(market, '5m', { from: S.warm, to: S.to });
  if (!M5.length) throw new Error('no candles ' + market);
  const F = G.frames(M5), cost = COSTS[market], calls = G.msnrCalls(F), atrV = atr14(F[CELL.v]);
  const bad = exclusions(market), badHit = (a, b) => bad.some(([p, q]) => p <= b && q >= a);
  const S5 = G.storylines(F, CELL.h, CELL.v, CELL.brk, calls, {});
  const out = []; const cnt = { storylines: S5.length, gate: 0, instant: 0, dropped: 0 };
  for (const s of S5) for (const o of G.entries(s, F, atrV, M5, cost)) {
    if (o.es !== CELL.es || o.st !== CELL.st) continue;
    if (o.gate) { cnt.gate++; continue; }
    const r = G.simulate(M5, o, s.d, s.x, G.CAP[CELL.h]); if (!r) continue;
    if (r.instant || !(r.risk > 0) || !(s.d * (r.fill - o.stop) > 0)) { cnt.instant++; continue; }
    if (r.fillT < S.from || r.fillT >= S.to) continue;
    if (badHit(r.fillT, r.exitT)) { cnt.dropped++; continue; }
    if (!(s.d * (r.fill - o.stop) > 0)) throw new Error('stop not on the losing side');
    const pl = G.placebo(M5, o, s, r);
    const fin = (v) => (Number.isFinite(v) ? +v.toFixed(6) : null);
    out.push({ t: r.fillT, d: s.d, sess: G.sessionOf(r.fillT), call: s.call, r1: fin(r.R[CELL.x1R]), tr: fin(r.R[CELL.xTr]), cr: +(cost / r.risk).toFixed(6),
      p1: pl ? fin(pl.R[CELL.x1R]) : null, ptr: pl ? fin(pl.R[CELL.xTr]) : null, pcr: pl ? +(cost / pl.risk).toFixed(6) : null });
  }
  return { meta: { set, market, bars: M5.length, first: new Date(M5[0].t * 1000).toISOString(), last: new Date(M5[M5.length - 1].t * 1000).toISOString(), cost: COSTS[market], ...cnt, trades: out.length }, trades: out };
}
export const inCell = (r) => r.sess === CELL.sess && r.call === CELL.call;

// cut test: the ladder's storylines known before a cut are the same when the candles stop at the cut
export function cutTest(set, market) {
  const S = SETS[set]; const M5 = K.load(market, '5m', { from: S.warm, to: S.to });
  const Fw = G.frames(M5), whole = G.storylines(Fw, CELL.h, CELL.v, CELL.brk, G.msnrCalls(Fw), {});
  const out = [];
  for (const f of [0.2, 0.45, 0.7, 0.9]) {
    const C = S.from + Math.round(((S.to - S.from) * f) / 86400) * 86400 + 13 * 3600 + 37 * 60;
    const Fc = G.cutFrames(M5, C), part = G.storylines(Fc, CELL.h, CELL.v, CELL.brk, G.msnrCalls(Fc), {});
    const A = new Set(whole.filter((s) => s.T <= C).map(G.sigKey)), B = new Set(part.filter((s) => s.T <= C).map(G.sigKey));
    let miss = 0, extra = 0; for (const k of A) if (!B.has(k)) miss++; for (const k of B) if (!A.has(k)) extra++;
    out.push({ cut: new Date(C * 1000).toISOString().slice(0, 16), storylines: A.size, missing: miss, extra });
  }
  return out;
}

// ---- statistics: month sums over the set's calendar, empty months 0 ---------------------------------------------------
const monthKey = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
export function statOf(rows, from, to, field, costField) {
  const m0 = monthKey(from), m1 = monthKey(to - 1), NMo = m1 - m0 + 1, ms = new Float64Array(NMo);
  const R = rows.filter((r) => Number.isFinite(r[field]));
  let s = 0, w = 0; for (const r of R) { const v = r[field] - (costField ? r[costField] : 0); s += v; if (v > 0) w++; ms[monthKey(r.t) - m0] += v; }
  const n = R.length, mm = ms.reduce((a, b) => a + b, 0) / NMo;
  const sd = Math.sqrt(ms.reduce((a, b) => a + (b - mm) ** 2, 0) / (NMo - 1));
  const t = sd > 0 ? mm / (sd / Math.sqrt(NMo)) : 0;
  const p = K.pFromT(t, NMo - 1); const p1 = p == null ? 1 : t > 0 ? p / 2 : 1 - p / 2;
  return { n, mean: n ? +(s / n).toFixed(4) : null, win: n ? +(w / n).toFixed(3) : null, months: NMo, t: +t.toFixed(2), p1: +p1.toPrecision(3), sumR: +s.toFixed(2) };
}
const blk = (R, from, to) => ({ r1: statOf(R, from, to, 'r1'), r1Net: statOf(R, from, to, 'r1', 'cr'), trail: statOf(R, from, to, 'tr'), trailNet: statOf(R, from, to, 'tr', 'cr'),
  placebo1R: statOf(R, from, to, 'p1'), placebo1RNet: statOf(R, from, to, 'p1', 'pcr'), placeboTrail: statOf(R, from, to, 'ptr') });
const passes = (st) => st.n >= 50 && st.mean > 0 && st.t >= 2;
function byYear(R) { const o = {}; for (const r of R) { const yy = new Date(r.t * 1000).getUTCFullYear(); (o[yy] ||= { n: 0, grossR: 0, netR: 0 }); o[yy].n++; o[yy].grossR += r.r1; o[yy].netR += r.r1 - r.cr; }
  return Object.entries(o).map(([k, v]) => ({ year: +k, n: v.n, grossR: +v.grossR.toFixed(2), netR: +v.netR.toFixed(2) })); }

export function report(dir) {
  const sets = {};
  for (const [name, S] of Object.entries(SETS)) {
    const all = [], meta = {};
    for (const m of S.markets) { const f = path.join(dir, `${name}.${m}.json`); if (!fs.existsSync(f)) throw new Error('missing ' + f);
      const j = JSON.parse(fs.readFileSync(f, 'utf8')); meta[m] = j.meta; for (const r of j.trades) all.push({ ...r, m }); }
    const cell = all.filter(inCell);
    const per = {}; for (const m of S.markets) { const R = cell.filter((r) => r.m === m); per[m] = { r1: statOf(R, S.from, S.to, 'r1'), r1Net: statOf(R, S.from, S.to, 'r1', 'cr'), trail: statOf(R, S.from, S.to, 'tr') }; }
    const ctx = { anySessionWith: statOf(all.filter((r) => r.call === 1), S.from, S.to, 'r1'), londonAnyCall: statOf(all.filter((r) => r.sess === 1), S.from, S.to, 'r1'),
      londonAgainst: statOf(all.filter((r) => r.sess === 1 && r.call === 2), S.from, S.to, 'r1') };
    const cut = S.markets.flatMap((m) => { const f = path.join(dir, `${name}.${m}.cut.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).map((c) => ({ market: m, ...c })) : []; });
    sets[name] = { markets: S.markets, from: new Date(S.from * 1000).toISOString().slice(0, 10), to: new Date(S.to * 1000).toISOString().slice(0, 10), assumedCosts: !!S.assumedCosts,
      real: blk(cell, S.from, S.to), perMarket: per, context: ctx, byYear: byYear(cell), meta, cut };
  }
  // gate: the grid's two halves on its fixed 60-month calendars
  const g = JSON.parse(fs.readFileSync(path.join(dir, 'gate.xau.json'), 'utf8')).trades.filter(inCell);
  const H = y(2015), a = statOf(g.filter((r) => r.t < H), y(2010), H, 'r1'), b = statOf(g.filter((r) => r.t >= H), H, y(2020), 'r1');
  const at = statOf(g.filter((r) => r.t < H), y(2010), H, 'tr'), bt = statOf(g.filter((r) => r.t >= H), H, y(2020), 'tr');
  const gate = { n1014: a.n, mean1014: a.mean, t1014: a.t, n1519: b.n, mean1519: b.mean, t1519: b.t, trail1014: at.mean, trail1519: bt.mean, want: GRID };
  gate.ok = gate.n1014 === GRID.n1014 && gate.n1519 === GRID.n1519 && Math.abs(gate.mean1014 - GRID.mean1014) < 1e-4 && Math.abs(gate.mean1519 - GRID.mean1519) < 1e-4
    && Math.abs(gate.t1014 - GRID.t1014) < 0.006 && Math.abs(gate.t1519 - GRID.t1519) < 0.006;
  const adj = K.holm([sets.A.real.r1.p1, sets.B.real.r1.p1]);
  const passA = passes(sets.A.real.r1) && adj[0] < 0.05, passB = passes(sets.B.real.r1) && adj[1] < 0.05, passC = passes(sets.C.real.r1);
  const few = sets.A.real.r1.n < 50 || sets.B.real.r1.n < 50;
  const verdict = !gate.ok ? 'INCONCLUSIVE' : passA && passB ? 'PASS' : few || passA || passB ? 'INCONCLUSIVE' : 'FAIL';
  return { gate, holm: { A: +adj[0].toPrecision(3), B: +adj[1].toPrecision(3) }, pass: { A: passA, B: passB, C: passC }, verdict, sets };
}

const main = process.argv[1] === fileURLToPath(import.meta.url);
if (main) {
  const [cmd, a, b, c] = process.argv.slice(2);
  if (cmd === 'market') { const t0 = Date.now(); const out = marketTrades(a, b); fs.mkdirSync(c, { recursive: true }); fs.writeFileSync(path.join(c, `${a}.${b}.json`), JSON.stringify(out)); console.log(JSON.stringify(out.meta), ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { const r = cutTest(a, b); fs.mkdirSync(c, { recursive: true }); fs.writeFileSync(path.join(c, `${a}.${b}.cut.json`), JSON.stringify(r)); console.log(a, b, JSON.stringify(r)); }
  else if (cmd === 'report') {
    const R = report(a); const A = R.sets.A.real.r1, B = R.sets.B.real.r1, C = R.sets.C.real.r1;
    const f = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
    const headline = `${R.verdict}: 1R exit before costs, set A (gold 2006-09) ${f(A.mean)}R a trade (n ${A.n}, month t ${A.t.toFixed(2)}), set B (silver and eight pairs 2010-19) ${f(B.mean)}R (n ${B.n}, t ${B.t.toFixed(2)}); gold 2020 on ${f(C.mean)}R (n ${C.n}, t ${C.t.toFixed(2)}), ${R.pass.C ? 'repeated' : 'not repeated'}`;
    const out = { study: 'mosha-market-holdout', built: '2026-11-23', verdict: R.verdict, headline, basis: 'judged before costs (pre-registered); after costs beside',
      rule: 'Mosha storyline M30 BO, M5 VR and CF (edgekit structure, 3 a side), market entry at the CF close, stop past the CF zone by 0.1 ATR(14) M5, London fills, with the Daily MSNR call; exit 1R (primary), trail (secondary)',
      ...R };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n'); console.log(headline); console.log(JSON.stringify({ gate: R.gate, holm: R.holm, pass: R.pass }));
  } else console.log('usage: run.mjs market <set> <m> <dir> | cut <set> <m> <dir> | report <dir>');
}
