// Gold momentum pullback (gmp): candidates and outcomes from the only replay of the rule in the repo, the robustness audit's
// port `goldMP` (research/edge/robustness/systems.mjs, the function under the "Gold momentum pullback (trader.mjs 705-735)"
// banner). systems.mjs is a script, so the function's source text is taken VERBATIM (study.mjs grabFunction) and run with
// the audit's own simTrade (research/edge/robustness/lib.mjs) wrapped only to keep each call's order and result.
//   data     as the script's `gold()` helper and its `if (run('gmp'))` block: loadM1('xau-histdata'), daily candles from
//            17:00 New York (aggregate(A, 86400, 'ny17')), H1 and M5 in UTC buckets
//   params   the `base` literal of that block, read from the script; the rule part must equal the live config.goldMP
// Needs ROB_DATA = the folder that holds research/candles/xau-histdata (set by run.mjs BEFORE this module is imported).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, grabFunction, round, excursions, sessionOf, stamps } from './study.mjs';
import { edgeById, poolOf } from '../edges.mjs';

const PX = 2;
function must(ok, msg) { if (!ok) throw new Error('academy/gen/gmp: ' + msg); }

export async function generateGmp() {
  const edge = edgeById('gmp');
  const lib = await import('../../research/edge/robustness/lib.mjs');
  const src = fs.readFileSync(path.join(ROOT, 'research/edge/robustness/systems.mjs'), 'utf8');
  const calls = [];
  const simTrade = (A, s) => { const r = lib.simTrade(A, s); calls.push({ s, r }); return r; };
  const goldMP = new Function('simTrade', `'use strict';\n${grabFunction(src, 'goldMP')}\nreturn goldMP;`)(simTrade);

  const mt = src.match(/if \(run\('gmp'\)\) \{\s*[^\n]*?const base = (\{[^}]*\})/); must(mt, 'the gmp block of systems.mjs was not found');
  const base = new Function(`return ${mt[1]};`)();
  const lv = fs.readFileSync(path.join(ROOT, 'council/trader.mjs'), 'utf8').match(/c\.goldMP = (\{[^}]*\})/); must(lv, 'config.goldMP not found in council/trader.mjs');
  const live = new Function(`return ${lv[1]};`)();
  for (const k of Object.keys(live)) must(live[k] === base[k], `the study's ${k} = ${base[k]} but live config.goldMP has ${live[k]}`);
  must(base.cost === edge.costPerRoundTrip, 'registry cost differs from the study');

  const A = lib.loadM1('xau-histdata'), D = lib.aggregate(A, 86400, 'ny17'), H = lib.aggregate(A, 3600), M5 = lib.aggregate(A, 300);
  const trades = goldMP(A, H, M5, D, base);
  must(trades.length === calls.length, 'one simTrade call per trade expected');

  // every trade must be the published one (out/gmp.json keeps the full list)
  const pub = JSON.parse(fs.readFileSync(path.join(ROOT, edge.study.path), 'utf8'));
  must(pub.trades.length === trades.length, `reproduced ${trades.length} trades; published ${pub.trades.length}`);
  trades.forEach((x, i) => { const q = pub.trades[i]; must(x.t === q.t && x.side === q.side && Math.abs(x.R - q.R) < 1e-9, `trade ${i} differs from the published list`); });
  const exp = round(trades.reduce((a, x) => a + x.R, 0) / trades.length, 3);
  must(trades.length === edge.study.n && exp === edge.study.netR && exp === pub.live.all.exp, `reproduced n ${trades.length}, ${exp}R; published ${edge.study.n}, ${edge.study.netR}R`);

  const hAt = new Map(H.map((b, i) => [b.time, i])), cands = [], outs = {};
  calls.forEach(({ s, r }, ix) => {
    const side = s.side, t = A.t[s.i], entry = A.o[s.i], r0 = s.r0, stop = s.stopPx;
    must(trades[ix].t === t && Math.abs(Math.abs(entry - stop) - r0) < 1e-9, 'call and trade out of step');
    // the H1 momentum candle: the newest closed one within the 6 h wait whose far end is the stop (goldMP: stop = low - 0.1 / high + 0.1)
    let b = null, n = null;
    for (let h = Math.floor(t / 3600) * 3600 - 3600; h >= t - (base.wait + 2) * 3600 && !b; h -= 3600) { const i = hAt.get(h); if (i == null) continue; const c = H[i]; if (c.time + 3600 <= t && (side > 0 ? c.low - 0.1 : c.high + 0.1) === stop) { b = c; n = i + 1; } }
    must(b, 'no H1 momentum candle found for the trade at ' + t);
    const rg = b.high - b.low, avg = H.slice(n - 15, n - 1).reduce((a, x) => a + (x.high - x.low), 0) / 14;
    const zone = side > 0 ? [b.high - base.z2 * rg, b.high - base.z1 * rg] : [b.low + base.z1 * rg, b.low + base.z2 * rg];
    const id = `gmp-${t}${side > 0 ? 'b' : 's'}`; must(!outs[id], 'duplicate id ' + id);
    cands.push({ id, edge: edge.id, market: edge.market, t, side: side > 0 ? 'buy' : 'sell', entry: round(entry, PX), stop: round(stop, PX), target: round(entry + side * s.cap * r0, PX), tf: edge.signalTf,
      rule: { order: 'market', session: sessionOf(t), h1: b.time, h1Range: round(rg, PX), rangeMult: round(rg / avg, 2), zone: zone.map((x) => round(x, PX)), d1: side > 0 ? 'above 20-day average' : 'below 20-day average',
        exit: 'trail 1R behind from +2R; 10R cap; out after 8 h', risk: round(r0, PX), ...stamps(t) },
      edgeVersion: edge.version, pool: poolOf(edge.id, t) });
    // lib.mjs simTrade: the time exit is checked first in a bar, then the stop, then the cap
    const ended = r.exitI > A.n - 1, kx = Math.min(r.exitI, A.n - 1);
    const reason = ended ? 'end' : A.t[kx] >= s.exitAt ? 'time' : r.gross >= s.cap - 1e-9 ? 'target' : r.gross > 0 ? 'trail' : 'stop';
    const ex = excursions({ side, entry, r0, kFill: s.i, kExit: kx, exitR: r.gross, bar: (k) => ({ high: A.h[k], low: A.l[k] }) });
    outs[id] = { id, R: round(r.gross, 4), netR: round(r.R, 4), exitT: A.t[kx], exit: round(entry + side * r.gross * r0, PX), reason, ...ex };
  });
  for (let i = 1; i < cands.length; i++) must(cands[i].t > cands[i - 1].t, 'candidates out of order');
  return { cands, outs, repro: { n: trades.length, orders: trades.length, netR: exp, sumNetR: round(trades.reduce((a, x) => a + x.R, 0), 2) } };
}
