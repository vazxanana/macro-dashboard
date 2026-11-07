// Replay A-setups before vs after the deferred-contract cut, per market, in the window the cut re-sources (from the first CNBC-sourced
// signal of the old replay to the new CNBC start), and over the whole replay. Matched = same market and side, signal within 1 hour.
// node deferred.mjs <replay before cut> <replay after cut> [out.json]
import fs from 'node:fs';
const [A, B, OUT] = process.argv.slice(2);
const a = JSON.parse(fs.readFileSync(A)), b = JSON.parse(fs.readFileSync(B));
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const tot = (x) => ({ n: x.length, R: +x.reduce((s, y) => s + (y.R || 0), 0).toFixed(2), perTrade: x.length ? +(x.reduce((s, y) => s + (y.R || 0), 0) / x.length).toFixed(3) : null });
const res = {};
for (const k of ['nq', 'es', 'ym', 'rty', 'gc']) {
  const Aa = a.trades.filter((x) => x.market === k && x.aset && x.closed), Bb = b.trades.filter((x) => x.market === k && x.aset && x.closed);
  const from = (Aa.find((x) => !x.cash) || {}).signalAt, to = (Bb.find((x) => !x.cash) || {}).signalAt || Infinity;
  const wa = Aa.filter((x) => x.signalAt >= from && x.signalAt < to), wb = Bb.filter((x) => x.signalAt >= from && x.signalAt < to);
  const match = wa.filter((x) => wb.some((y) => y.side === x.side && Math.abs(y.signalAt - x.signalAt) <= 3600)).length;
  res[k] = { window: from ? `${iso(from)} .. ${to === Infinity ? 'end' : iso(to)}` : null, before: tot(wa), after: tot(wb), sameSignal: match, wholeReplay: { before: tot(Aa), after: tot(Bb) } };
  console.log(k.padEnd(4), JSON.stringify(res[k]));
}
if (OUT) fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
