// Edge research · bigfade-target-sweep: the Big-candle fade's best target, chosen on 2005-14 and judged on 2015-26
// (PREREGISTRATION.md, pushed alone first). Paper research only.
//   EDGE_DATA=<cache> node research/edge/bigfade-target-sweep/run.mjs
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
export const SHARES = [0.5, 0.6, 0.65, 0.7, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 99];   // 99 = no target
export const label = (m) => (m >= 99 ? 'none (stop or 1 day)' : Math.round(m * 100) + ' %');
const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
const r3 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 1000) / 1000), r2 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);
export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }), big = signals(frames(M5)).big.filter((g) => g.tf === 0 && !g.brk), cost = COSTS[market], X = exclusions(market), out = [];
  for (const g of big) { const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const t = M5[fi].t; if (t < FROM || t >= TO) continue; if (X.length && inBad(X, t)) continue;
    const r = trade(M5, g, cost, SHARES); if (!r) continue; out.push({ m: monthOf(t), w: t < SPLIT ? 0 : 1, cr: cost / r.risk, R: r.R }); }
  return out;
}
// the curve of one window: per share { gross, net, win, t, tNet, diff vs 50 % (mean, t) }
export function curve(rows, w) {
  const R = rows.filter((x) => x.w === w), a = w ? DM : 0, b = w ? NM : DM, n = R.length;
  return { n, pts: SHARES.map((sh, k) => { const ms = new Float64Array(NM), msn = new Float64Array(NM), md = new Float64Array(NM); let s = 0, sn = 0, win = 0, sd = 0;
    for (const x of R) { ms[x.m] += x.R[k]; msn[x.m] += x.R[k] - x.cr; md[x.m] += x.R[k] - x.R[0]; s += x.R[k]; sn += x.R[k] - x.cr; sd += x.R[k] - x.R[0]; if (x.R[k] > 0) win++; }
    return { share: sh, gross: r3(s / n), net: r3(sn / n), netRaw: sn / n, win: r3(win / n), t: r2(mstat(ms, a, b).t), tNet: r2(mstat(msn, a, b).t), diff: r3(sd / n), diffT: k ? r2(mstat(md, a, b).t) : null }; }) };
}
export const best = (C) => C.pts.reduce((q, p) => (p.netRaw > q.netRaw ? p : q));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const by = {}; let all = [];
  for (const m of MARKETS) { by[m] = runMarket(m); all = all.concat(by[m]); console.log(m, by[m].length); }
  const D = curve(all, 0), C = curve(all, 1);
  const gate = { d: { n: D.n, mean: D.pts[0].gross }, c: { n: C.n, mean: C.pts[0].gross } }; gate.ok = gate.d.n === GATE.d.n && gate.c.n === GATE.c.n && Math.abs(gate.d.mean - GATE.d.mean) <= 0.001 && Math.abs(gate.c.mean - GATE.c.mean) <= 0.001;
  console.log('gate', JSON.stringify(gate));
  if (!gate.ok) { fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ study: 'bigfade-target-sweep', gate, verdict: 'STOPPED: the harness gate failed' }, null, 1) + '\n'); process.exit(2); }
  const pick = best(D), j = C.pts.find((p) => p.share === pick.share), hind = best(C), base = C.pts[0];
  const a = j.diff > 0 && j.diffT >= 2, b = j.net > 0 && j.tNet >= 2, sg = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(3)}R`;
  const verdict = `${a && b ? 'PASS' : 'FAIL'}. Chosen on 2005-14: ${pick.share >= 99 ? 'no target at all, the stop or the 1-day limit ends the trade' : 'a target at ' + label(pick.share) + ' of the candle'} (${sg(pick.net)} a trade after costs there). Judged on 2015-26 it makes ${sg(j.gross)} before costs and ${sg(j.net)} after (n ${C.n}, ${(100 * j.win).toFixed(0)} % winners, month t ${j.tNet}), against ${sg(base.net)} with the desk's 50 %: ${a ? 'a better exit' : 'not shown to be a better exit'} (${sg(j.diff)} a trade, month t ${j.diffT})${b ? '' : ', and still a loss after costs'}. With hindsight the best of 2015-26 itself is ${hind.share >= 99 ? 'the same, no target' : label(hind.share)}, ${sg(hind.net)} after costs. There is no sweet spot: the further the target, the smaller the loss, and no target makes the rule pay its costs.`;
  const markets = Object.fromEntries(MARKETS.map((m) => { const d = curve(by[m], 0), c = curve(by[m], 1), p = best(d), q = c.pts.find((x) => x.share === p.share); return [m, { assumed: ASSUMED.includes(m), n: c.n, pick: p.share, discNet: p.net, base: c.pts[0].net, net: q.net, tNet: q.tNet, hind: best(c).share, hindNet: best(c).net }]; }));
  const strip = (S) => ({ n: S.n, pts: S.pts.map(({ netRaw, ...r }) => r) });
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ study: 'bigfade-target-sweep', built: '2026-11-24', verdict, gate, pick: pick.share, hindsight: hind.share, pooled: { d: strip(D), c: strip(C) }, markets }, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), ['# Big-candle fade: the best target, chosen on 2005-14 and judged on 2015-26 (result, 24 Nov 2026)', '', `**Verdict: ${verdict}**`, '',
    'Paper research only, run once as pre-registered (`PREREGISTRATION.md`, pushed alone first); gate reproduced. Nothing live changed; the desk keeps its 50 % target.', '',
    '| Target (share of the candle) | 2005-14 winners | 2005-14 before costs | 2005-14 after costs | 2015-26 winners | 2015-26 before costs | 2015-26 after costs (month t) |', '|---|---|---|---|---|---|---|',
    ...SHARES.map((sh, k) => { const d = D.pts[k], c = C.pts[k]; return `| ${label(sh)}${sh === pick.share ? ' **(chosen)**' : ''}${sh === 0.5 ? ' (the desk)' : ''} | ${(100 * d.win).toFixed(1)} % | ${sg(d.gross)} | ${sg(d.net)} | ${(100 * c.win).toFixed(1)} % | ${sg(c.gross)} | ${sg(c.net)} (${c.tNet}) |`; }), '',
    `Trades: ${D.n} in 2005-14, ${C.n} in 2015-26. Costs: the shared table (assumed on five of the ten markets).`, '',
    '## By market: the target chosen on 2005-14, judged on 2015-26 (after costs)', '', '| Market | Trades 2015-26 | Chosen target | 50 % (the desk) | Chosen target (month t) | Best with hindsight |', '|---|---|---|---|---|---|',
    ...MARKETS.map((m) => { const q = markets[m]; return `| ${m}${q.assumed ? ' (cost assumed)' : ''} | ${q.n} | ${label(q.pick)} | ${sg(q.base)} | ${sg(q.net)} (${q.tNet}) | ${label(q.hind)}: ${sg(q.hindNet)} |`; }), ''].join('\n'));
  console.log(verdict);
}
