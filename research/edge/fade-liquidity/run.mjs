// Edge research · fade-liquidity: the Big-candle fade (M15) and the Break fade (M15) tagged by an H1 dominant zone and by
// liquidity sweeps (PREREGISTRATION.md, committed alone first). Paper research only: nothing live imports it.
//   EDGE_DATA=<cache> node research/edge/fade-liquidity/run.mjs            (all markets, then the cut test, then the report)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames, buildZones } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { startIdx } from '../dom-trade-through/run.mjs';
import { MARKETS, ASSUMED, FROM, SPLIT, TO, NM, DM, monthOf, mstat, p1 } from '../grid7-wide-core/run.mjs';
import { exits, CAP as FCAP, ATRK, signals as breakSignals } from '../grid7-wide-fade/run.mjs';
import { signals as bigSignals } from '../big-candle-fade/run.mjs';
import { trade as bigTrade, GATE } from '../bigfade-target-65/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TAGS = ['dom', 'pdl', 'hi24', 'asia'], DESKS = ['big', 'brk'], N24 = 96;
const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
const r3 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 1000) / 1000), r2 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);

// tags of one signal g (T15 = the M15 candles, g.j its candle), from candles closed at or before g.ts only
export function tagsOf(g, fill, s, ctx) {
  const { T15, D1, zones, maxLife } = ctx, out = { dom: false, domSide: 0, pdl: false, hi24: false, asia: null };
  // dom: a standing H1 zone that holds the fill
  let lo = 0, hi = zones.length; while (lo < hi) { const m = (lo + hi) >> 1; if (zones[m].at <= g.ts) lo = m + 1; else hi = m; }
  for (let k = lo - 1; k >= 0 && zones[k].at >= g.ts - maxLife; k--) { const z = zones[k];
    if (z.end > g.ts && fill >= z.bot && fill <= z.top) { out.dom = true; out.domSide = z.d === s ? 1 : -1; break; } }
  // pdl: the previous closed New York day
  let a = 0, b = D1.length; while (a < b) { const m = (a + b) >> 1; if (D1[m].e <= g.ts) a = m + 1; else b = m; }
  if (a > 0) { const d1 = D1[a - 1]; out.pdl = g.d > 0 ? g.ext > d1.h : g.ext < d1.l; }
  // hi24: the previous 96 M15 candles
  if (g.j >= N24) { let mx = -Infinity, mn = Infinity; for (let i = g.j - N24; i < g.j; i++) { if (T15[i].h > mx) mx = T15[i].h; if (T15[i].l < mn) mn = T15[i].l; }
    out.hi24 = g.d > 0 ? g.ext > mx : g.ext < mn; }
  // asia: that UTC day's 00:00-07:00 range, for signals closing 07:00-17:00 UTC
  const hr = ((g.ts % 86400) / 3600), day = g.ts - (g.ts % 86400);
  if (hr >= 7 && hr < 17) { let mx = -Infinity, mn = Infinity, c = 0; for (let i = g.j; i >= 0 && T15[i].t >= day - 3600; i--) { const t = T15[i].t; if (t >= day && T15[i].e <= day + 7 * 3600) { c++; if (T15[i].h > mx) mx = T15[i].h; if (T15[i].l < mn) mn = T15[i].l; } }
    if (c >= 20) out.asia = g.d > 0 ? g.ext > mx : g.ext < mn; }
  return out;
}
function ctxOf(M5) { const F = frames(M5), zones = buildZones('dom', F['1h']).sort((x, y) => x.at - y.at);
  let maxLife = 0; for (const z of zones) if (Number.isFinite(z.end)) maxLife = Math.max(maxLife, z.end - z.at); return { F, ctx: { T15: F['15m'], D1: F['1d'], zones, maxLife } }; }

export function runMarket(market, cutT = null) {
  let M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); if (cutT) M5 = M5.filter((b) => b.e <= cutT);
  const { F, ctx } = ctxOf(M5), cost = COSTS[market], X = exclusions(market), rows = [];
  const bigs = bigSignals(F).big.filter((g) => g.tf === 0 && !g.brk), brks = breakSignals(F).filter((g) => g.tf === 1 && g.cx === 0);
  const push = (desk, g, r, fi, s, fill) => { const t = M5[fi].t; if (t < FROM || t >= TO || (X.length && inBad(X, t))) return;
    rows.push({ k: market, desk, ts: g.ts, d: g.d, m: monthOf(t), w: t < SPLIT ? 0 : 1, cr: cost / r.risk, R: r.R, tag: tagsOf(g, fill, s, ctx) }); };
  for (const g of bigs) { const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const r = bigTrade(M5, g, cost, [0.5]); if (!r) continue;
    push('big', g, { risk: r.risk, R: r.R[0] }, fi, r.s, r.fill); }
  for (const g of brks) { const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const fill = M5[fi].o, s = -g.d, stop = fill + g.d * g.a, risk = s * (fill - stop);
    if (!(risk > 0) || risk < cost) continue; const r = exits(M5, s, fi, stop, [fill + s * 2 * risk], FCAP['15m']); if (!r) continue;
    push('brk', g, { risk, R: r.R[0] }, fi, s, fill); }
  return rows;
}
const mult = (x, c2) => x.R - (c2 ? 2 : 1) * x.cr;
export function stat(rows, w, c2 = false) {
  const R = rows.filter((x) => x.w === w), a = w ? DM : 0, b = w ? NM : DM, ms = new Float64Array(NM), mg = new Float64Array(NM); let s = 0, sq = 0, g = 0, win = 0;
  for (const x of R) { const v = mult(x, c2); ms[x.m] += v; mg[x.m] += x.R; s += v; sq += v * v; g += x.R; if (x.R > 0) win++; }
  const n = R.length; return { n, gross: n ? r3(g / n) : null, net: n ? r3(s / n) : null, win: n ? r3(win / n) : null, t: r2(mstat(ms, a, b).t), sum: s, sq };
}
export const welch = (A, B) => { if (A.n < 2 || B.n < 2) return null; const ma = A.sum / A.n, mb = B.sum / B.n, va = (A.sq - A.n * ma * ma) / (A.n - 1), vb = (B.sq - B.n * mb * mb) / (B.n - 1), se = Math.sqrt(va / A.n + vb / B.n); return se > 0 ? (ma - mb) / se : null; };
export const holm = (ps) => { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = Array(ps.length); let run = 0; o.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, p * (ps.length - k))); out[i] = +run.toFixed(4); }); return out; };
const has = (x, tag) => (tag === 'asia' ? x.tag.asia === true : x.tag[tag] === true);
const known = (x, tag) => (tag === 'asia' ? x.tag.asia !== null : true);
const strip = (s) => ({ n: s.n, gross: s.gross, net: s.net, win: s.win, t: s.t });

export function evaluate(all) {
  const tests = [];
  for (const desk of DESKS) for (const tag of TAGS) { const D = all.filter((x) => x.desk === desk && known(x, tag)), T = D.filter((x) => has(x, tag)), O = D.filter((x) => !has(x, tag));
    const t0 = stat(T, 0), t1 = stat(T, 1), o1 = stat(O, 1), t1x = stat(T, 1, true), wt = welch(t1, o1), p = t1.n > 2 ? p1(t1.t, NM - DM - 1) : 1;
    tests.push({ desk, tag, tagged: { d: strip(t0), c: strip(t1), c2x: strip(t1x) }, untagged: strip(o1), welch: r2(wt), p }); }
  const adj = holm(tests.map((x) => x.p));
  tests.forEach((x, i) => { x.holm = adj[i]; const a = x.tagged.d, c = x.tagged.c;
    x.pass = a.n >= 300 && c.n >= 300 && a.net > 0 && c.net > 0 && c.t >= 2 && x.welch >= 2 && x.tagged.c2x.net > 0 && x.holm < 0.05; });
  return tests;
}
const sg = (v) => (v == null ? 'n/a' : `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(3)}R`);
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  // cut test first: tags of the entries before a date are unchanged when later candles are removed
  const cuts = ['2012-03-14', '2018-09-21', '2023-02-17'], cutRes = [];
  for (const m of ['xau', 'eurusd']) { const full = runMarket(m); const key = (x) => [x.desk, x.ts, x.d, x.tag.dom, x.tag.pdl, x.tag.hi24, x.tag.asia, x.R.toFixed(9)].join('|');
    for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000 - 3 * 86400, cut = new Set(runMarket(m, T + 3 * 86400).filter((x) => x.ts <= T).map(key)), ref = full.filter((x) => x.ts <= T).map(key);
      const miss = ref.filter((k) => !cut.has(k)).length; cutRes.push({ m, cut: c, signals: ref.length, mismatches: miss }); console.log('cut', m, c, ref.length, miss); } }
  const cutOk = cutRes.every((r) => r.mismatches === 0);
  let all = []; for (const m of MARKETS) { const r = runMarket(m); all = all.concat(r); console.log(m, r.length); }
  const big = all.filter((x) => x.desk === 'big'), gate = { d: { n: stat(big, 0).n, mean: stat(big, 0).gross }, c: { n: stat(big, 1).n, mean: stat(big, 1).gross } };
  gate.ok = gate.d.n === GATE.d.n && gate.c.n === GATE.c.n && Math.abs(gate.d.mean - GATE.d.mean) <= 0.001 && Math.abs(gate.c.mean - GATE.c.mean) <= 0.001;
  console.log('gate', JSON.stringify(gate), 'cutOk', cutOk);
  const brkAll = all.filter((x) => x.desk === 'brk'); console.log('break fade', JSON.stringify([stat(brkAll, 0), stat(brkAll, 1)].map(strip)));
  if (!gate.ok || !cutOk) { fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ study: 'fade-liquidity', gate, cutRes, verdict: 'STOPPED: a gate or the cut test failed' }, null, 1) + '\n'); process.exit(2); }
  const tests = evaluate(all), pass = tests.some((x) => x.pass), thin = tests.every((x) => x.tagged.d.n < 300 || x.tagged.c.n < 300);
  const best = [...tests].sort((a, b) => b.tagged.c.t - a.tagged.c.t)[0];
  const verdict = `${pass ? 'PASS' : thin ? 'INCONCLUSIVE' : 'FAIL'}. ${pass ? 'At least one tag passed every check' : 'No tag passed every check'}; the best month t in 2015-26 is ${best.desk} + ${best.tag} at ${sg(best.tagged.c.net)} after costs (n ${best.tagged.c.n}, t ${best.tagged.c.t}, Holm p ${best.holm}).`;
  const dom = ['big', 'brk'].map((desk) => { const D = all.filter((x) => x.desk === desk), W = D.filter((x) => x.tag.dom && x.tag.domSide === 1), A = D.filter((x) => x.tag.dom && x.tag.domSide === -1);
    return { desk, all: [strip(stat(D, 0)), strip(stat(D, 1))], domWith: [strip(stat(W, 0)), strip(stat(W, 1))], domAgainst: [strip(stat(A, 0)), strip(stat(A, 1))] }; });
  const byMarket = Object.fromEntries(MARKETS.map((m) => [m, Object.fromEntries(DESKS.map((d) => [d, strip(stat(all.filter((x) => x.k === m && x.desk === d && x.tag.dom), 1))]))]));
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ study: 'fade-liquidity', built: '2026-11-25', verdict, gate, cutRes, assumed: ASSUMED, tests: tests.map((x) => ({ ...x, p: +x.p.toFixed(4) })), dom, byMarket }, null, 1) + '\n');
  const row = (x) => `| ${x.desk === 'big' ? 'Big-candle fade' : 'Break fade'} | ${x.tag} | ${x.tagged.d.n} | ${sg(x.tagged.d.net)} | ${x.tagged.c.n} | ${sg(x.tagged.c.gross)} | ${sg(x.tagged.c.net)} (${x.tagged.c.t}) | ${sg(x.untagged.net)} | ${x.welch} | ${sg(x.tagged.c2x.net)} | ${x.holm} | ${x.pass ? 'PASS' : 'no'} |`;
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), ['# Fades inside an H1 dominant zone, and liquidity sweeps as a filter (result, 25 Nov 2026)', '', `**Verdict: ${verdict}**`, '',
    `Paper research only, run once as pre-registered (\`PREREGISTRATION.md\`, committed alone first). Gate reproduced (${gate.d.n} / ${gate.d.mean}R and ${gate.c.n} / ${gate.c.mean}R); cut test ${cutOk ? 'passed' : 'FAILED'}. Nothing live changed.`, '',
    '| Desk | Tag | 2005-14 n | After costs | 2015-26 n | Before costs | After costs (month t) | Untagged after costs | Welch t | After 2x costs | Holm p | Test |', '|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...tests.map(row), '', '## Inside an H1 DOM zone, by the zone\'s side (2015-26, after costs)', '', '| Desk | All trades | In a zone the trade is WITH | In a zone the trade is AGAINST |', '|---|---|---|---|',
    ...dom.map((x) => `| ${x.desk} | ${x.all[1].n} / ${sg(x.all[1].net)} | ${x.domWith[1].n} / ${sg(x.domWith[1].net)} (t ${x.domWith[1].t}) | ${x.domAgainst[1].n} / ${sg(x.domAgainst[1].net)} (t ${x.domAgainst[1].t}) |`), '',
    'Costs: the shared table (assumed, not measured, on five of the ten markets). 2015-26 had been read by many studies of the Big-candle fade before this one.', ''].join('\n'));
  console.log(verdict);
}
