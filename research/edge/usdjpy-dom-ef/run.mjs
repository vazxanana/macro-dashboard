// research/edge/usdjpy-dom-ef/run.mjs - the one rule of PREREGISTRATION.md, with the combination grid's own functions.
// node research/edge/usdjpy-dom-ef/run.mjs   -> result.json (gate: the grid's 2020-now cell reproduced first)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames, signalsFor, multi } from '../combo-grid/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export function trades(market, from, to, start) {
  const M5 = K.load(market, '5m', { from, to }); const F = frames(M5), T = F['15m'], cost = K.COSTS[market];
  const out = [];
  for (const sg of signalsFor(F, '4h', '15m', 'dom', {}, start)) {
    if (sg.trig !== 1) continue;
    const z = sg.z, d = z.d, ts = T[sg.j].e, buf = cost / 2, stop = d > 0 ? z.bot - buf : z.top + buf;
    if (!(d * (T[sg.j].c - stop) >= 2 * cost)) continue;
    const r = multi(M5, d, null, stop, 'mkt', ts, 0, 2, 5 * 86400);
    if (!r || r.risk < cost || r.t < start) continue;
    out.push({ market, side: d, t: r.t, exitT: r.t, R: r.R[1], Rnet: r.R[1] - cost / r.risk, R2c: r.R[1] - (2 * cost) / r.risk });
  }
  return out;
}
const y = (s) => Date.UTC(s, 0, 1) / 1000;
const sum = (xs) => { const s = K.stats(xs, { key: 'Rnet', time: 't' }); return { n: s.n, meanR: s.meanR, tMonth: s.tMonth, total: s.total, maxDD: s.maxDD }; };
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // gate: the grid's cell usdjpy 4h>15m dom first2 none ef mkt/zone 2R on 2020-now
  const g = trades('usdjpy', '2019-03-01', null, y(2020));
  const gIS = g.filter((x) => x.t < y(2024)), gOOS = g.filter((x) => x.t >= y(2024));
  const gate = { IS: { n: gIS.length, meanR: gIS.reduce((a, x) => a + x.Rnet, 0) / gIS.length }, OOS: { n: gOOS.length, meanR: gOOS.reduce((a, x) => a + x.Rnet, 0) / gOOS.length } };
  const res = { study: 'usdjpy-dom-ef', built: '2026-11-23', gate, markets: {} };
  for (const m of [...K.MARKETS, ...K.HOLDOUT_MARKETS]) {
    let xs; try { xs = trades(m, '2004-09-01', '2020-01-01', y(2005)); } catch (e) { res.markets[m] = { error: String(e.message) }; continue; }
    res.markets[m] = { all: sum(xs), early: sum(xs.filter((x) => x.t < y(2012))), late: sum(xs.filter((x) => x.t >= y(2012))),
      buys: sum(xs.filter((x) => x.side > 0)), sells: sum(xs.filter((x) => x.side < 0)),
      at2c: xs.length ? xs.reduce((a, x) => a + x.R2c, 0) / xs.length : null };
    console.error(m, JSON.stringify(res.markets[m].all));
  }
  const u = res.markets.usdjpy;
  res.pass = !!(u.all && u.all.meanR > 0 && u.all.tMonth >= 2 && u.early.meanR > 0 && u.late.meanR > 0 && u.at2c > 0);
  res.verdict = res.pass ? 'PASS' : 'FAIL';
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1));
  console.log(JSON.stringify({ gate, usdjpy: u, verdict: res.verdict }, null, 1));
}
