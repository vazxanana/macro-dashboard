// Why each A-setup appears / disappears between two replays: the signal's 50-day bias on CNBC's daily candles as printed (old) and
// back-adjusted (new, rollAdjust), and otherwise the one-open-A-trade rule (busy).
// node why.mjs <old replay.json> <new replay.json> <cnbc.json.gz> <probe.json.gz> [out.json]
import fs from 'node:fs';
import zlib from 'node:zlib';
import { MARKETS, rollAdjust } from '../../../ict/tracker.mjs';
const [A, B, DUMP, PROBE, OUT] = process.argv.slice(2);
const dump = JSON.parse(zlib.gunzipSync(fs.readFileSync(DUMP))).series, probe = JSON.parse(zlib.gunzipSync(fs.readFileSync(PROBE))).series;
const rows1 = (a) => (a || []).map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] }));
const D = {}; for (const [k, M] of Object.entries(MARKETS)) { const d1 = rows1(dump[`${M.cnbc[0]}|1D|adjusted`]); D[k] = { old: d1, new: M.cash ? rollAdjust(d1, rows1(probe[`${M.cash}|1D`])).d1 : d1 }; }
const biasAt = (Dd, close, side) => { const di = Dd.findLastIndex((d) => d.time + 86400 <= close); if (di < 50) return null;
  const sma = Dd.slice(di - 49, di + 1).reduce((s, d) => s + d.close, 0) / 50; return (side === 'buy' ? Dd[di].close > sma : Dd[di].close < sma) ? 'with' : 'against'; };
const a = JSON.parse(fs.readFileSync(A)), b = JSON.parse(fs.readFileSync(B));
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');
const key = (x) => `${x.market}-${x.side}-${x.signalAt}`;
const all = (r) => new Map(r.trades.map((x) => [key(x), x]));
const ma = all(a), mb = all(b);
const As = (m) => new Set([...m.values()].filter((x) => x.aset).map(key));
const sa = As(ma), sb = As(mb);
const rows = [];
for (const k of new Set([...sa, ...sb])) {
  if (sa.has(k) && sb.has(k)) continue;
  const x = ma.get(k), y = mb.get(k), z = x || y;
  const bo = biasAt(D[z.market].old, z.signalAt, z.side), bn = biasAt(D[z.market].new, z.signalAt, z.side);
  const why = bo !== bn ? `50-day bias ${bo} -> ${bn} (roll step in the daily candles)` : sa.has(k) ? 'busy: an A-trade that only the new data has was still open' : 'busy: the old data had an A-trade open then';
  rows.push({ change: sa.has(k) ? 'A-setup removed' : 'A-setup added', market: z.market, side: z.side, signal: iso(z.signalAt), cash: !!z.cash, R: (x && x.aset ? x : y).R, size: (x && x.aset ? x : y).size, why });
}
rows.sort((p, q) => (p.signal < q.signal ? -1 : 1));
// bias flips among signals that are A-setups in both (no status change, recorded feature only)
const flips = [...sa].filter((k) => sb.has(k) && ma.get(k).feat.bias !== mb.get(k).feat.bias).length;
const tot = (r) => { const C = r.trades.filter((x) => x.aset && x.closed); return { n: C.length, R: +C.reduce((s, x) => s + x.R, 0).toFixed(2) }; };
const sameR = [...sa].filter((k) => sb.has(k)).every((k) => ma.get(k).R === mb.get(k).R && ma.get(k).exit === mb.get(k).exit && ma.get(k).entry === mb.get(k).entry);
const res = { old: tot(a), new: tot(b), changes: rows, keptA: [...sa].filter((k) => sb.has(k)).length, keptSameExit: sameR };
console.log(JSON.stringify({ old: res.old, new: res.new, keptA: res.keptA, keptSameEntryExitR: sameR, biasFlipsWithoutStatusChange: flips }));
for (const r of rows) console.log(`${r.change.padEnd(16)} ${r.market.padEnd(3)} ${r.side.padEnd(4)} ${r.signal}${r.cash ? ' (cash fill)' : ''}  R ${r.R} size ${r.size}  ${r.why}`);
if (OUT) fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
