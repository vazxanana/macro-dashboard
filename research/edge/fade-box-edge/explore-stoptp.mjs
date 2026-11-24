// research/edge/fade-box-edge/explore-stoptp.mjs - EXPLORATION (24 Nov 2026, owner: "10% less stop loss and 10% extra tp"):
// E1's signals (H4-H1-M15 box close-out faded, risk >= 8 round trips, inside the H4 box) on the sets already read, with
//   the stop at 1.0 x or 0.9 x the grid distance, and the exit: trailing; a target at 1R / 2R of the ORIGINAL stop distance;
//   or that target 10 % further away (1.1 x / 2.2 x the original distance). R is always in units of the stop actually used.
//   node explore-stoptp.mjs <set> <m> <dir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import * as BOX from '../grid6-box-in-box/run.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { SETS } from './discover.mjs';

const yearBefore = (t) => Date.UTC(new Date(t * 1000).getUTCFullYear() - 1, 0, 1) / 1000;
export const TGT = { t1: 1, t11: 1.1, t2: 2, t22: 2.2 }; // target distance in units of the ORIGINAL distance
export function runMarket(set, market, dir) {
  const S = SETS[set], M5 = K.load(market, '5m', { from: yearBefore(S.from), to: S.to });
  const F = frames(M5), cost = COSTS[market], X = exclusions(market), inBad = (t) => X.some(([a, b]) => t >= a && t <= b), rows = [];
  for (const sg of BOX.signals(F, { from: S.from, to: S.to })) {
    if (sg.ch !== 1 || sg.trig !== 0 || sg.topPos !== 0) continue;
    const d = sg.d, s = -d, buf = cost / 2, ts = sg.ts, cap = BOX.CAPS[1];
    const dist = d * (sg.c0 - (d > 0 ? sg.box.lo - buf : sg.box.hi + buf));
    if (!(dist >= 8 * cost)) continue;
    const R = {};
    for (const k of [1, 0.9]) for (const [name, m] of Object.entries(TGT)) {
      // the target at m / k R of the filled risk, i.e. about m x the original distance from the fill
      const r = BOX.trade(M5, s, 'mkt', null, sg.c0 + d * k * dist, ts, ts + 7200, m / k, cost, cap);
      if (!r || r.t < S.from || r.t >= S.to || inBad(r.t)) continue;
      const key = 'k' + k; R[key] ||= { cr: +(cost / r.risk).toFixed(5), tr: +r.R[3].toFixed(4) }; R[key][name] = +r.R[4].toFixed(4);
    }
    if (R.k1 && R['k0.9']) rows.push({ t: ts, R });
  }
  if (dir) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, `${set}.${market}.json`), JSON.stringify(rows)); }
  return rows;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) { const [set, m, dir] = process.argv.slice(2); console.log(set, m, runMarket(set, m, dir).length); }
