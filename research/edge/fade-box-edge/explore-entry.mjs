// research/edge/fade-box-edge/explore-entry.mjs - EXPLORATION (24 Nov 2026, owner: "what if we reduce the stop loss or get a
// better entry"): the E1 fade's signals (grid6-box-in-box, chain H4-H1-M15, trigger out) under tighter stops and better entries,
// on data already read by the fade studies (sets gate, A-E of discover.mjs). Not evidence: it proposes what entry.PREREG tests on
// set F (eight markets no fade study has read).
//   node --max-old-space-size=4500 explore-entry.mjs <set> <m> <dir>      set: gate | A | B | C | D | E | F (F after its pre-registration)
// Variants (all with the fade side s = -close-out side, stop beyond the close-out, cost = combo-grid-2 COSTS):
//   m50 / m75 / m100   market at the next 5-minute open, stop at 0.5 / 0.75 / 1 x the grid distance dist (m100 = E1's trade)
//   l25 / l50          a LIMIT 0.25 / 0.5 x dist beyond the close-out close (a better price for the fade), stop at 1 x dist
//                      (the same stop price as m100), valid 8 M15 candles, filled only when traded through by half the round trip
//   cf                 confirmation: the first M15 close back inside the box within 6 candles, market at the next open, stop past
//                      the extreme made since the close-out by half the round trip
// Each with the trailing exit (1R behind the best price from +1R) and 1R, out 2 days after the fill.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import * as BOX from '../grid6-box-in-box/run.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { SETS as S0 } from './discover.mjs';

const y = (n) => Date.UTC(n, 0, 1) / 1000;
export const F_MARKETS = ['gbpjpy', 'eurgbp', 'audjpy', 'cadjpy', 'euraud', 'nas100', 'spx500', 'de40'];
export const SETS = { ...S0, F: { markets: F_MARKETS, from: y(2020), to: S0.C.to } };
export const VARS = ['m50', 'm75', 'm100', 'l25', 'l50', 'cf'];
const LIM_LIFE = 8 * 900, CF_WAIT = 6;
const yearBefore = (t) => Date.UTC(new Date(t * 1000).getUTCFullYear() - 1, 0, 1) / 1000;

export function runMarket(set, market, dir) {
  const S = SETS[set], M5 = K.load(market, '5m', { from: yearBefore(S.from), to: S.to }); if (!M5.length) throw new Error('no candles ' + market);
  const F = frames(M5), cost = COSTS[market], X = exclusions(market), inBad = (t) => X.some(([a, b]) => t >= a && t <= b);
  const M15 = F['15m'], rows = [];
  for (const sg of BOX.signals(F, { from: S.from, to: S.to })) {
    if (sg.ch !== 1 || sg.trig !== 0) continue;
    const d = sg.d, s = -d, buf = cost / 2, ts = sg.ts, cap = BOX.CAPS[1];
    const stop0 = d > 0 ? sg.box.lo - buf : sg.box.hi + buf, dist = d * (sg.c0 - stop0);
    if (!(dist >= 2 * cost)) continue;
    const R = {};
    const put = (name, r) => { if (!r || r.t < S.from || r.t >= S.to || inBad(r.t)) return; R[name] = { cr: +(cost / r.risk).toFixed(5), r1: +r.R[0].toFixed(4), tr: +r.R[3].toFixed(4) }; };
    for (const [name, k] of [['m50', 0.5], ['m75', 0.75], ['m100', 1]]) put(name, BOX.trade(M5, s, 'mkt', null, sg.c0 + d * k * dist, ts, ts + LIM_LIFE, 2, cost, cap));
    for (const [name, x] of [['l25', 0.25], ['l50', 0.5]]) put(name, BOX.trade(M5, s, 'lim', sg.c0 + d * x * dist, sg.c0 + d * dist, ts, ts + LIM_LIFE, 2, cost, cap));
    // confirmation: the first M15 close back inside the box after the close-out candle (M15 index sg.j)
    let ext = d > 0 ? -Infinity : Infinity;
    for (let j = sg.j; j < M15.length && j <= sg.j + CF_WAIT; j++) { const b = M15[j];
      ext = d > 0 ? Math.max(ext, b.h) : Math.min(ext, b.l);
      if (j > sg.j && (d > 0 ? b.c < sg.box.hi : b.c > sg.box.lo)) { const stop = d > 0 ? ext + buf : ext - buf;
        if (s * (b.c - stop) >= 2 * cost) put('cf', BOX.trade(M5, s, 'mkt', null, stop, b.e, b.e + LIM_LIFE, 2, cost, cap)); break; } }
    if (!Object.keys(R).length) continue;
    rows.push({ t: ts, rc: +(dist / cost).toFixed(2), topPos: sg.topPos, R });
  }
  if (dir) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, `${set}.${market}.json`), JSON.stringify(rows)); }
  return rows;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [set, m, dir] = process.argv.slice(2);
  if (set === 'F' && !fs.existsSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'ENTRY-PREREGISTRATION.md'))) throw new Error('set F is read only after ENTRY-PREREGISTRATION.md is committed');
  const t0 = Date.now(); const rows = runMarket(set, m, dir); console.log(set, m, rows.length, ((Date.now() - t0) / 1000).toFixed(0) + 's');
}
