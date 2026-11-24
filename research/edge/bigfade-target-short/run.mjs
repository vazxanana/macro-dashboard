// Edge research · bigfade-target-short: the Big-candle fade with a target NEARER than 50 % of the candle, chosen on 2005-14
// and judged on 2015-26 (PREREGISTRATION.md, pushed alone first). Paper research only.
//   EDGE_DATA=<cache> node research/edge/bigfade-target-short/run.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { startIdx } from '../dom-trade-through/run.mjs';
import { MARKETS, FROM, SPLIT, TO, NM, DM, monthOf, mstat } from '../grid7-wide-core/run.mjs';
import { signals } from '../big-candle-fade/run.mjs';
import { trade, GATE } from '../bigfade-target-65/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SHARES = [0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.1];
const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
const r3 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 1000) / 1000), r2 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);
// R per share; a target the fill has already passed closes at the fill (0R), flagged in `past`
export function shortR(r, g) { const past = SHARES.map((m) => r.s * ((g.ext + 2 * m * (g.mid - g.ext)) - r.fill) <= 0); return { R: r.R.map((v, k) => (past[k] ? 0 : v)), past }; }
export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }), big = signals(frames(M5)).big.filter((g) => g.tf === 0 && !g.brk), cost = COSTS[market], X = exclusions(market), out = [];
  for (const g of big) { const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const t = M5[fi].t; if (t < FROM || t >= TO) continue; if (X.length && inBad(X, t)) continue;
    const r = trade(M5, g, cost, SHARES); if (!r) continue; const q = shortR(r, g); out.push({ m: monthOf(t), w: t < SPLIT ? 0 : 1, cr: cost / r.risk, R: q.R, past: q.past }); }
  return out;
}
export function curve(rows, w) {
  const R = rows.filter((x) => x.w === w), a = w ? DM : 0, b = w ? NM : DM, n = R.length;
  return { n, pts: SHARES.map((sh, k) => { const msn = new Float64Array(NM), md = new Float64Array(NM); let s = 0, sn = 0, win = 0, sd = 0, past = 0;
    for (const x of R) { msn[x.m] += x.R[k] - x.cr; md[x.m] += x.R[k] - x.R[0]; s += x.R[k]; sn += x.R[k] - x.cr; sd += x.R[k] - x.R[0]; if (x.R[k] > 0) win++; if (x.past[k]) past++; }
    return { share: sh, gross: r3(s / n), net: r3(sn / n), netRaw: sn / n, win: r3(win / n), past: r3(past / n), tNet: r2(mstat(msn, a, b).t), diff: r3(sd / n), diffT: k ? r2(mstat(md, a, b).t) : null }; }) };
}
export const best = (C) => C.pts.reduce((q, p) => (p.netRaw > q.netRaw ? p : q));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  let all = []; for (const m of MARKETS) { const r = runMarket(m); all = all.concat(r); console.log(m, r.length); }
  const D = curve(all, 0), C = curve(all, 1);
  const gate = { d: { n: D.n, mean: D.pts[0].gross }, c: { n: C.n, mean: C.pts[0].gross } }; gate.ok = gate.d.n === GATE.d.n && gate.c.n === GATE.c.n && Math.abs(gate.d.mean - GATE.d.mean) <= 0.001 && Math.abs(gate.c.mean - GATE.c.mean) <= 0.001;
  console.log('gate', JSON.stringify(gate));
  if (!gate.ok) { fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ study: 'bigfade-target-short', gate, verdict: 'STOPPED: the harness gate failed' }, null, 1) + '\n'); process.exit(2); }
  const pick = best(D), j = C.pts.find((p) => p.share === pick.share), base = C.pts[0], sg = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(3)}R`, pc = (m) => Math.round(m * 100) + ' %';
  const a = pick.share !== 0.5 && j.diff > 0 && j.diffT >= 2, b = j.net > 0 && j.tNet >= 2, near = C.pts[C.pts.length - 1];
  const verdict = pick.share === 0.5
    ? `FAIL. A target nearer than 50 % is worse, not better. On 2005-14 the desk's 50 % is the best of the eight after costs (${sg(pick.net)} a trade), and on 2015-26 every nearer target loses more (50 %: ${sg(base.net)}; 40 %: ${sg(C.pts[2].net)}; 30 %: ${sg(C.pts[4].net)}; 20 %: ${sg(C.pts[6].net)}; 10 %: ${sg(near.net)} with ${(100 * near.win).toFixed(0)} % winners). More winners, smaller wins, the same cost.`
    : `${a && b ? 'PASS' : 'FAIL'}. Chosen on 2005-14: a target at ${pc(pick.share)} of the candle (${sg(pick.net)} after costs there). Judged on 2015-26: ${sg(j.gross)} before costs and ${sg(j.net)} after (${(100 * j.win).toFixed(0)} % winners, month t ${j.tNet}) against ${sg(base.net)} at 50 % (difference ${sg(j.diff)}, month t ${j.diffT})${b ? '' : ': still a loss after costs'}.`;
  const strip = (S) => ({ n: S.n, pts: S.pts.map(({ netRaw, ...r }) => r) });
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ study: 'bigfade-target-short', built: '2026-11-24', verdict, gate, pick: pick.share, pooled: { d: strip(D), c: strip(C) } }, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), ['# Big-candle fade with a target nearer than 50 % of the candle (result, 24 Nov 2026)', '', `**Verdict: ${verdict}**`, '',
    'Paper research only, run once as pre-registered (`PREREGISTRATION.md`, pushed alone first); gate reproduced. Nothing live changed; the desk keeps its 50 % target.', '',
    '| Target (share of the candle) | 2005-14 winners | 2005-14 before costs | 2005-14 after costs | 2015-26 winners | 2015-26 before costs | 2015-26 after costs (month t) | Already passed at the fill |', '|---|---|---|---|---|---|---|---|',
    ...SHARES.map((sh, k) => { const d = D.pts[k], c = C.pts[k]; return `| ${pc(sh)}${sh === 0.5 ? ' (the desk)' : ''}${sh === pick.share ? ' **(chosen)**' : ''} | ${(100 * d.win).toFixed(1)} % | ${sg(d.gross)} | ${sg(d.net)} | ${(100 * c.win).toFixed(1)} % | ${sg(c.gross)} | ${sg(c.net)} (${c.tNet}) | ${(100 * c.past).toFixed(1)} % |`; }), '',
    `Trades: ${D.n} in 2005-14, ${C.n} in 2015-26, the same for every target. Costs: the shared table (assumed on five of the ten markets).`, ''].join('\n'));
  console.log(verdict);
}
