// Edge research · bigfade-cost-ratio: the Big-candle fade, only the trades whose round-trip cost is at most 10 % of their risk
// (PREREGISTRATION.md, pushed alone first). Paper research only.
//   EDGE_DATA=<cache> node research/edge/bigfade-cost-ratio/run.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { startIdx } from '../dom-trade-through/run.mjs';
import { MARKETS, ASSUMED, FROM, SPLIT, TO, NM, DM, monthOf, mstat } from '../grid7-wide-core/run.mjs';
import { signals } from '../big-candle-fade/run.mjs';
import { trade, GATE } from '../bigfade-target-65/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const KEEP = 0.10, CONTEXT = [0.05, 0.15, 0.2, 0.3], SHARES = [0.5, 99];   // 99 = no target (context)
const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
const r3 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 1000) / 1000), r2 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);
export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }), big = signals(frames(M5)).big.filter((g) => g.tf === 0 && !g.brk), cost = COSTS[market], X = exclusions(market), out = [];
  for (const g of big) { const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const t = M5[fi].t; if (t < FROM || t >= TO) continue; if (X.length && inBad(X, t)) continue;
    const r = trade(M5, g, cost, SHARES); if (!r) continue; out.push({ k: market, m: monthOf(t), w: t < SPLIT ? 0 : 1, cr: cost / r.risk, R: r.R }); }
  return out;
}
// one group of rows in one window, exit k (0 = the desk's 50 % target, 1 = no target), costs times `mult`
export function stat(rows, w, k = 0, mult = 1) {
  const R = rows.filter((x) => x.w === w), a = w ? DM : 0, b = w ? NM : DM, n = R.length, ms = new Float64Array(NM), msn = new Float64Array(NM); let s = 0, sn = 0, win = 0, c = 0;
  for (const x of R) { const net = x.R[k] - mult * x.cr; ms[x.m] += x.R[k]; msn[x.m] += net; s += x.R[k]; sn += net; c += x.cr; if (x.R[k] > 0) win++; }
  return { n, gross: n ? r3(s / n) : null, net: n ? r3(sn / n) : null, win: n ? r3(win / n) : null, cost: n ? r3(c / n) : null, t: r2(mstat(ms, a, b).t), tNet: r2(mstat(msn, a, b).t) };
}
export const keep = (rows, th) => rows.filter((x) => x.cr <= th);
export function passOf(d, c, c2) { return d.n >= 300 && c.n >= 300 && d.net > 0 && c.net > 0 && d.tNet >= 2 && c.tNet >= 2 && c2.net > 0; }
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  let all = []; for (const m of MARKETS) { const r = runMarket(m); all = all.concat(r); console.log(m, r.length); }
  const A = [stat(all, 0), stat(all, 1)], gate = { d: { n: A[0].n, mean: A[0].gross }, c: { n: A[1].n, mean: A[1].gross } };
  gate.ok = gate.d.n === GATE.d.n && gate.c.n === GATE.c.n && Math.abs(gate.d.mean - GATE.d.mean) <= 0.001 && Math.abs(gate.c.mean - GATE.c.mean) <= 0.001;
  console.log('gate', JSON.stringify(gate));
  if (!gate.ok) { fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ study: 'bigfade-cost-ratio', gate, verdict: 'STOPPED: the harness gate failed' }, null, 1) + '\n'); process.exit(2); }
  const Kp = keep(all, KEEP), D = stat(Kp, 0), C = stat(Kp, 1), C2 = stat(Kp, 1, 0, 2), pass = passOf(D, C, C2);
  const sg = (v) => (v == null ? 'n/a' : `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(3)}R`);
  const drop = all.filter((x) => x.cr > KEEP), ctx = [KEEP, ...CONTEXT].sort((a, b) => a - b).map((th) => ({ th, d: stat(keep(all, th), 0), c: stat(keep(all, th), 1), dNo: stat(keep(all, th), 0, 1), cNo: stat(keep(all, th), 1, 1) }));
  const verdict = `${pass ? 'PASS' : 'FAIL'}. Keeping only trades whose cost is at most 10 % of their risk leaves ${C.n} of ${A[1].n} trades in 2015-26. They make ${sg(C.gross)} a trade before costs and ${sg(C.net)} after (month t ${C.tNet}); in 2005-14 ${sg(D.net)} after costs (n ${D.n}, t ${D.tNet}); at twice the cost ${sg(C2.net)}. All trades: ${sg(A[1].net)} after costs.`;
  const markets = Object.fromEntries(MARKETS.map((m) => { const r = Kp.filter((x) => x.k === m); return [m, { assumed: ASSUMED.includes(m), d: stat(r, 0), c: stat(r, 1) }]; }));
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ study: 'bigfade-cost-ratio', built: '2026-11-24', verdict, gate, keep: KEEP, all: { d: A[0], c: A[1] }, kept: { d: D, c: C, c2x: C2 }, dropped: { d: stat(drop, 0), c: stat(drop, 1) }, context: ctx, markets }, null, 1) + '\n');
  const row = (name, d, c) => `| ${name} | ${d.n} | ${sg(d.gross)} | ${sg(d.net)} (${d.tNet}) | ${c.n} | ${sg(c.gross)} | ${sg(c.net)} (${c.tNet}) |`;
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), ['# Big-candle fade, only the trades whose cost is small against their risk (result, 24 Nov 2026)', '', `**Verdict: ${verdict}**`, '',
    `Paper research only, run once as pre-registered (\`PREREGISTRATION.md\`, pushed alone first). Gate reproduced (${gate.d.n} / ${gate.d.mean}R and ${gate.c.n} / ${gate.c.mean}R). Nothing live changed.`, '',
    '| Trades | 2005-14 n | Before costs | After costs (month t) | 2015-26 n | Before costs | After costs (month t) |', '|---|---|---|---|---|---|---|',
    row('All (the desk)', A[0], A[1]), row('**Kept: cost at most 10 % of the risk (the test)**', D, C), row('Dropped', stat(drop, 0), stat(drop, 1)), '',
    `Average cost of a kept trade: ${C.cost}R (all trades: ${A[1].cost}R). Winners among the kept trades: ${(100 * C.win).toFixed(1)} % in 2015-26.`, '',
    '## Context only (no verdict; no threshold is adopted from this)', '', '| Cost at most | 2005-14 n | After costs (t) | 2015-26 n | After costs (t) | No target: 2005-14 after costs (t) | 2015-26 after costs (t) |', '|---|---|---|---|---|---|---|',
    ...ctx.map((x) => `| ${Math.round(x.th * 100)} % of the risk${x.th === KEEP ? ' (the test)' : ''} | ${x.d.n} | ${sg(x.d.net)} (${x.d.tNet}) | ${x.c.n} | ${sg(x.c.net)} (${x.c.tNet}) | ${sg(x.dNo.net)} (${x.dNo.tNet}) | ${sg(x.cNo.net)} (${x.cNo.tNet}) |`), '',
    '## Kept trades by market, after costs', '', '| Market | 2005-14 n | After costs (t) | 2015-26 n | After costs (t) |', '|---|---|---|---|---|',
    ...MARKETS.map((m) => { const x = markets[m]; return `| ${m}${x.assumed ? ' (cost assumed)' : ''} | ${x.d.n} | ${sg(x.d.net)} (${x.d.tNet}) | ${x.c.n} | ${sg(x.c.net)} (${x.c.tNet}) |`; }), '',
    'Costs: the shared table (assumed, not measured, on five of the ten markets). The 2015-26 window had been read by five studies of these trades before this one.', ''].join('\n'));
  console.log(verdict);
}
