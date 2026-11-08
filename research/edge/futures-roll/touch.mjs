// Replay A-setups that a contract switch "touched" (preregistration): the switch moment (18:00 New York before the first daily candle
// of the new contract, the start of its first session) inside the signal's candles (sweep - 96 H1 .. signal) or its exit window
// (signal .. close), or the switch day inside the 50 daily candles its bias reads. Index switches from rollAdjust on CNBC's cash-index
// closes, gold's from mkshifts (shifts.json). node touch.mjs <replay.json> <shifts.json> [out.json]
import fs from 'node:fs';
const [REP, SH, OUT] = process.argv.slice(2);
const rep = JSON.parse(fs.readFileSync(REP)), shifts = JSON.parse(fs.readFileSync(SH));
const SYM = { nq: '@ND.1', es: '@SP.1', ym: '@DJ.1', rty: '@TFS.1', gc: '@GC.1' };
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');
const out = { signal: [], exit: [], d1: {} };
for (const x of rep.trades.filter((y) => y.aset)) {
  const sw = (shifts[SYM[x.market]] || []).filter((s) => s.from > 0).map((s) => s.from);
  const inSig = sw.find((t) => t > x.sweep.t - 96 * 3600 && t <= x.signalAt), inExit = sw.find((t) => t > x.signalAt && t < (x.closed || Infinity));
  const inD1 = sw.find((t) => t < x.signalAt && t > x.signalAt - 72 * 86400);   // ~50 trading days
  const row = { market: x.market, side: x.side, signal: iso(x.signalAt), closed: x.closed ? iso(x.closed) : null, R: x.R, exit: x.exit, cash: !!x.cash };
  if (inSig) out.signal.push({ ...row, switch: iso(inSig) });
  if (inExit) out.exit.push({ ...row, switch: iso(inExit) });
  out.d1[x.market] = out.d1[x.market] || { a: 0, touched: 0 }; out.d1[x.market].a++; if (inD1) out.d1[x.market].touched++;
}
console.log('A-setups whose 50-day bias window holds a switch day, per market:', JSON.stringify(out.d1));
console.log(`signal candles span a switch: ${out.signal.length}`); for (const r of out.signal) console.log(' ', JSON.stringify(r));
console.log(`exit window spans a switch: ${out.exit.length}`); for (const r of out.exit) console.log(' ', JSON.stringify(r));
if (OUT) fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
