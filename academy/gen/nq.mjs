// NQ New York open run (nq-open): candidates and outcomes from the study's own functions, imported as they are:
//   research/edge/nq-open-oos/lib.mjs   dayTrade (signal nqOpenSweep + the nyflip midnight filter + the live trade loop)
//   research/edge/nq-open-oos/load.mjs  loadHistData (HistData NSXUSD M1, New York labels -> UTC)
// with the study's options for its HistData run (run.mjs: `run(HD, { cost: COST })`, COST = 1 point).
// dayTrade returns the result but not the candle it closed on. The day's candles are therefore handed over as an array
// whose iterator remembers the last candle it gave out: the trade loop stops (break) on the exit candle, so that is it.
// The array is otherwise an ordinary array and the rule code is not touched.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, round, excursions, stamps } from './study.mjs';
import { edgeById, poolOf } from '../edges.mjs';
import { dayTrade, stats } from '../../research/edge/nq-open-oos/lib.mjs';
import { loadHistData } from '../../research/edge/nq-open-oos/load.mjs';

const PX = 2;
function must(ok, msg) { if (!ok) throw new Error('academy/gen/nq: ' + msg); }
class Traced extends Array { *[Symbol.iterator]() { for (let i = 0; i < this.length; i++) { this.last = this[i]; yield this[i]; } } }

export function generateNq(dir) {
  const edge = edgeById('nq-open'), days = loadHistData(dir), cands = [], outs = {}, net = [];
  for (const [d, a] of days) {
    const T = Traced.from(a), x = dayTrade(T, { cost: edge.costPerRoundTrip }); if (!x) continue;
    const xb = T.last, side = x.side, r0 = x.r0, entry = x.entry, stop = entry - side * r0, t1 = entry + side * 10 * r0, t = x.t + 60;   // the signal candle closes at t
    must(xb && xb.time > x.t, `${d}: no exit candle after the entry`);
    // the exit price, by the trade loop's own cases (lib.mjs dayTrade): 11:00 = that candle's open; target = t1; a full stop =
    // the stop, a gapped stop = the open; a trailed stop = what its R says (R is kept to 0.01 there)
    let exit;
    if (x.exit === '11:00') { exit = xb.open; must(xb.time >= x.t + (660 - x.m) * 60, `${d}: 11:00 exit before 11:00`); }
    else if (x.exit === 'target') { exit = t1; must(side > 0 ? xb.high >= t1 : xb.low <= t1, `${d}: target not reached on the exit candle`); }
    else if (x.exit === 'stop') { exit = x.gross === -1 ? stop : xb.open; must(side > 0 ? xb.low <= stop : xb.high >= stop, `${d}: stop not reached on the exit candle`); }
    else if (x.exit === 'trail') exit = entry + side * x.gross * r0;
    else must(false, `${d}: unknown exit ${x.exit}`);
    must(Math.abs((exit - entry) * side / r0 - x.gross) <= 0.0051, `${d}: exit price ${exit} does not give the study's ${x.gross}R`);
    const id = `nq-open-${t}${side > 0 ? 'b' : 's'}`; must(!outs[id], 'duplicate id ' + id);
    cands.push({ id, edge: edge.id, market: edge.market, t, side: side > 0 ? 'buy' : 'sell', entry: round(entry, PX), stop: round(stop, PX), target: round(t1, PX), tf: edge.signalTf,
      rule: { order: 'market', session: 'ny', day: d, entryMinNY: x.m, open0930: round(x.lv, PX), runExtreme: round(x.ext, PX), runPct: round(Math.abs(x.ext - x.lv) / x.lv * 100, 3), midnightOpen: round(x.ndo, PX),
        exit: 'trail 1R behind from +2R; 10R cap; out at 11:00 New York', risk: round(r0, PX), ...stamps(t) },
      edgeVersion: edge.version, pool: poolOf(edge.id, t) });
    const after = a.filter((b) => b.time > x.t && b.time < xb.time);
    const ex = excursions({ side, entry, r0, kFill: 0, kExit: after.length, exitR: x.gross, bar: (k) => after[k] });
    outs[id] = { id, R: x.gross, netR: x.R, exitT: xb.time, exit: round(exit, PX), reason: x.exit === '11:00' ? 'time' : x.exit, ...ex };
    net.push(x.R);
  }
  // the study's published HistData cross-check (result.json histdata.all), with its own statistics function
  const st = stats(net), pub = JSON.parse(fs.readFileSync(path.join(ROOT, edge.study.path), 'utf8')).histdata.all;
  must(st.n === pub.n && st.avg === pub.avg && st.R === pub.R, `reproduced n ${st.n}, ${st.avg}R (${st.R}R); published n ${pub.n}, ${pub.avg}R (${pub.R}R)`);
  must(st.n === edge.study.n && st.avg === edge.study.netR, 'registry study numbers differ from result.json');
  for (let i = 1; i < cands.length; i++) must(cands[i].t > cands[i - 1].t, 'candidates out of order');
  return { cands, outs, repro: { n: st.n, orders: st.n, netR: st.avg, sumNetR: st.R } };
}
