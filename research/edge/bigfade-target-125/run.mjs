// Edge research · bigfade-target-125: the Big-candle fade (m15 k1.5 nobreak half) with its target 25 % further
// (PREREGISTRATION.md, pushed alone first). Paper research only.
//   EDGE_DATA=<cache> node research/edge/bigfade-target-125/run.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { startIdx } from '../dom-trade-through/run.mjs';
import { MARKETS, ASSUMED, FROM, SPLIT, TO, NM, DM, monthOf, mstat } from '../grid7-wide-core/run.mjs';
import { exits, CAP as FCAP, ATRK } from '../grid7-wide-fade/run.mjs';
import { signals } from '../big-candle-fade/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MULTS = [1, 1.25, 1.5, 2], GATE = { d: { n: 47354, mean: 0.307 }, c: { n: 54443, mean: 0.193 } };
const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
const r3 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 1000) / 1000), r2 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);
// one trade with every target multiple: { t, risk, R: [per multiple] } or null. The stop, the fill and the limit are the cell's own.
export function trade(M5, g, cost, mults = MULTS) {
  const fi = startIdx(M5, g.ts); if (fi >= M5.length) return null;
  const fill = M5[fi].o, s = -g.d, stop = g.ext + g.d * ATRK * g.a, risk = s * (fill - stop);
  if (!(risk > 0) || risk < cost) return null;
  const hr = (s * (g.mid - fill)) / risk; if (!(hr >= 1)) return null;
  const r = exits(M5, s, fi, stop, mults.map((m) => fill + s * m * hr * risk), FCAP['15m']); if (!r) return null;
  return { t: M5[fi].t, fill, stop, risk, s, hr, R: r.R };
}
export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }), big = signals(frames(M5)).big.filter((g) => g.tf === 0 && !g.brk), cost = COSTS[market], X = exclusions(market), out = [];
  for (const g of big) { const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const t = M5[fi].t; if (t < FROM || t >= TO) continue; if (X.length && inBad(X, t)) continue;
    const r = trade(M5, g, cost); if (!r) continue; out.push({ m: monthOf(t), w: t < SPLIT ? 0 : 1, cr: cost / r.risk, R: r.R }); }
  return out;
}
export function stats(rows, w) {
  const R = rows.filter((x) => x.w === w), a = w ? DM : 0, b = w ? NM : DM, n = R.length, out = { n, mults: [] };
  MULTS.forEach((mu, k) => { const ms = new Float64Array(NM), msn = new Float64Array(NM); let s = 0, sn = 0, win = 0; for (const x of R) { ms[x.m] += x.R[k]; msn[x.m] += x.R[k] - x.cr; s += x.R[k]; sn += x.R[k] - x.cr; if (x.R[k] > 0) win++; }
    out.mults.push({ mult: mu, gross: r3(s / n), net: r3(sn / n), win: r3(win / n), t: r2(mstat(ms, a, b).t), tNet: r2(mstat(msn, a, b).t) }); });
  const md = new Float64Array(NM); let sd = 0; for (const x of R) { md[x.m] += x.R[1] - x.R[0]; sd += x.R[1] - x.R[0]; }
  out.diff = { mean: r3(sd / n), t: r2(mstat(md, a, b).t) };
  return out;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const by = {}; let all = [];
  for (const m of MARKETS) { by[m] = runMarket(m); all = all.concat(by[m]); console.log(m, by[m].length); }
  const D = stats(all, 0), C = stats(all, 1);
  const gate = { d: { n: D.n, mean: D.mults[0].gross }, c: { n: C.n, mean: C.mults[0].gross } }; gate.ok = gate.d.n === GATE.d.n && gate.c.n === GATE.c.n && Math.abs(gate.d.mean - GATE.d.mean) <= 0.001 && Math.abs(gate.c.mean - GATE.c.mean) <= 0.001;
  console.log('gate', JSON.stringify(gate));
  if (!gate.ok) { fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ study: 'bigfade-target-125', gate, verdict: 'STOPPED: the harness gate failed' }, null, 1) + '\n'); process.exit(2); }
  const better = D.diff.mean > 0 && C.diff.mean > 0 && D.diff.t >= 2 && C.diff.t >= 2, worse = D.diff.mean < 0 && C.diff.mean < 0 && D.diff.t <= -2 && C.diff.t <= -2;
  const sg = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(3)}R`, x = C.mults[1], b = C.mults[0];
  const verdict = `${better ? (x.net > 0 ? 'PASS' : 'FAIL') : 'FAIL'}. The target 25 % further is ${better ? 'better' : worse ? 'worse' : 'not shown to differ'}: ${sg(C.diff.mean)} a trade against the candle's middle in 2015-26 (month t ${C.diff.t}; 2005-14 ${sg(D.diff.mean)}, t ${D.diff.t}). With it the rule makes ${sg(x.gross)} a trade before costs and ${sg(x.net)} after (n ${C.n}, ${(100 * x.win).toFixed(0)} % winners), against ${sg(b.gross)} and ${sg(b.net)} with the candle's middle (${(100 * b.win).toFixed(0)} % winners)${x.net > 0 ? '' : ': still a loss after costs'}.`;
  const markets = Object.fromEntries(MARKETS.map((m) => [m, { assumed: ASSUMED.includes(m), d: stats(by[m], 0), c: stats(by[m], 1) }]));
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ study: 'bigfade-target-125', built: '2026-11-24', verdict, gate, pooled: { d: D, c: C }, markets }, null, 1) + '\n');
  const row = (w, S) => S.mults.map((q) => `| ${w} | ${q.mult === 1 ? "candle's middle (the desk)" : q.mult + ' x the distance'} | ${S.n} | ${(100 * q.win).toFixed(1)} % | ${sg(q.gross)} (${q.t}) | ${sg(q.net)} (${q.tNet}) |`);
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), ['# Big-candle fade with the target 25 % further (result, 24 Nov 2026)', '', `**Verdict: ${verdict}**`, '',
    'Paper research only, run once as pre-registered (`PREREGISTRATION.md`, pushed alone first). Gate reproduced (' + `${gate.d.n} / ${gate.d.mean}R and ${gate.c.n} / ${gate.c.mean}R). Nothing live changed; the desk's target stays the candle's middle.`, '',
    '| Window | Target | Trades | Winners | R a trade before costs (month t) | After costs (month t) |', '|---|---|---|---|---|---|', ...row('2005-14', D), ...row('2015-26', C), '',
    'Only the 1.25 row is tested; 1.5 and 2 are context. Costs: the shared table (assumed on five of the ten markets).', '',
    '## By market, 2015-26, after costs', '', '| Market | Trades | Candle\'s middle | 25 % further | Difference (month t) |', '|---|---|---|---|---|',
    ...MARKETS.map((m) => { const c = markets[m].c; return `| ${m}${markets[m].assumed ? ' (cost assumed)' : ''} | ${c.n} | ${sg(c.mults[0].net)} | ${sg(c.mults[1].net)} | ${sg(c.diff.mean)} (${c.diff.t}) |`; }), ''].join('\n'));
  console.log(verdict);
}
