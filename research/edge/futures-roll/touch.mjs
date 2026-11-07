// Replay A-setups whose signal or exit window contains a detected roll hour (preregistration "Which replay A-setups touched a
// roll"). node touch.mjs <replay.json> <rolls.json from rolls.mjs> [series: cash|cashUnadj|spread2Steps]
import fs from 'node:fs';
const [REP, ROLLS, SER = 'cash'] = process.argv.slice(2);
const rep = JSON.parse(fs.readFileSync(REP)), R = JSON.parse(fs.readFileSync(ROLLS));
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');
const out = [];
for (const [k, M] of Object.entries(R.markets)) {
  const rolls = ((M[SER] && M[SER].steps) || []).filter((s) => s.t && s.window);
  for (const x of rep.trades.filter((x) => x.market === k && x.aset && !x.cash)) {
    for (const r of rolls) {
      const sig = r.t > x.sweep.t - 96 * 3600 && r.t < x.signalAt, ex = r.t >= x.signalAt && r.t < (x.closed || Infinity);
      const d1 = r.t < x.signalAt && r.t > x.signalAt - 75 * 86400;   // inside the ~50 trading days the D1 features read
      if (sig || ex || d1) out.push({ market: k, id: x.id, side: x.side, signal: iso(x.signalAt), closed: x.closed ? iso(x.closed) : null, R: x.R, exit: x.exit, roll: r.at, jump: r.jump, how: sig ? 'signal' : ex ? 'exit' : 'D1 only' });
    }
  }
}
for (const o of out.filter((o) => o.how !== 'D1 only')) console.log(JSON.stringify(o));
console.log('signal', out.filter((o) => o.how === 'signal').length, 'exit', out.filter((o) => o.how === 'exit').length, 'D1 only', out.filter((o) => o.how === 'D1 only').length);
