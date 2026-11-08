// replay-a-changes.txt: every replay A-setup that appears, disappears or changes R / exit / size, per fix stage.
// node changes.mjs <base replay> <stage-1 replay> <final replay> <out.txt>
import fs from 'node:fs';
const [BASE, S1, FIN, OUT] = process.argv.slice(2);
const L = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');
const key = (x) => `${x.market}-${x.side}-${x.signalAt}`;
const tot = (r) => { const C = r.trades.filter((x) => x.aset && x.closed); return `${C.length} A-trades, ${C.reduce((s, x) => s + x.R, 0) >= 0 ? '+' : ''}${C.reduce((s, x) => s + x.R, 0).toFixed(2)}R`; };
function diff(a, b) {
  const A = new Map(a.trades.filter((x) => x.aset).map((x) => [key(x), x])), B = new Map(b.trades.filter((x) => x.aset).map((x) => [key(x), x])), rows = [];
  for (const [k, x] of A) { const y = B.get(k); if (!y) rows.push([x, 'removed', x.R, null]); else if (x.R !== y.R || x.exit !== y.exit || x.size !== y.size) rows.push([x, 'changed', x.R, y.R, `${x.exit}/${x.size} -> ${y.exit}/${y.size}`]); }
  for (const [k, y] of B) if (!A.has(k)) rows.push([y, 'added', null, y.R]);
  return rows.sort((p, q) => p[0].signalAt - q[0].signalAt).map(([x, w, r0, r1, e]) => `${w.padEnd(8)} ${x.market.padEnd(3)} ${x.side.padEnd(4)} ${iso(x.signalAt)}${x.cash ? ' cash' : '     '}  R ${r0 ?? '-'} -> ${r1 ?? '-'}${e ? `  (exit/size ${e})` : ''}`);
}
const base = L(BASE), s1 = L(S1), fin = L(FIN);
const d1 = diff(base, s1), d2 = diff(s1, fin);
const txt = [
  '# Replay A-setups that change. Base: council-data ict/replay.json at 475f6bc3 (7 Nov 2026 21:16 run), reproduced exactly from the CNBC dump.',
  `# Base ${tot(base)}. Columns: change, market, side, signal (UTC, inversion candle close), "cash" = back-filled hours, R old -> new.`,
  '',
  `# Stage 1 - daily candles back-adjusted across rolls (ict/tracker.mjs rollAdjust): ${tot(base)} -> ${tot(s1)}; ${d1.length} rows, all 50-day-bias flips.`,
  ...d1, '',
  `# Stage 2 - deferred-contract CNBC hours replaced by the back-fill (ict/replay.mjs liquidFrom; indices from 13 Sep 2026, gold from 27 Jul): ${tot(s1)} -> ${tot(fin)}; ${d2.length} rows.`,
  '# Every other back-filled A-trade only moves its prices by the new fill scale (e.g. NQ x1.0084 instead of x1.0221) with the same R.',
  ...d2, '',
];
fs.writeFileSync(OUT, txt.join('\n'));
console.log(txt.slice(0, 16).join('\n')); console.log(`... stage 2 rows ${d2.length}`);
