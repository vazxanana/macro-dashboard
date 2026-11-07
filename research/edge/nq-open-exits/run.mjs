// NQ New York open run: five pre-registered exit variants on the same entries (preregistration.md, committed before this ran).
// Entries, the midnight filter and the live trade loop come from research/edge/nq-open-oos (OANDA NAS100 1m 2004-26, #511).
//   node research/edge/nq-open-exits/run.mjs <oandaCacheDir> > out.txt        (writes result.json next to this file)
// Paper research only; nothing here is imported by the council.
import fs from 'node:fs';
import path from 'node:path';
import { nqOpenSweep, midnightPrice, stats, nyParts, fixedR, dayTrade } from '../nq-open-oos/lib.mjs';
import { loadOanda } from '../nq-open-oos/load.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const [OANDA] = process.argv.slice(2);
if (!OANDA) { console.error('usage: run.mjs <oandaCacheDir>'); process.exit(1); }
const COST = 1, LATE = '2023-01-01', MID = '2025-01-01';
const CLEAN = (d) => d >= '2004-01-01';                       // #511 cleanliness rule: 2003 dropped, 2004-26 clean
const yearOf = (d) => +d.slice(0, 4);

// ── the six cells (five families) exactly as pre-registered; B = the live exit ──
export const CELLS = {
  B:       { name: 'live: 10R cap, trail 1R from +2R, out 11:00 ET', trail: [2, 1], exitM: 660 },
  fixed2R: { name: 'fixed 2R target, out 11:00 ET', fixed: true, trail: null, exitM: 660 },
  trail1:  { name: 'trail 1R from +1R, 10R cap, out 11:00 ET', trail: [1, 1], exitM: 660 },
  trail3:  { name: 'trail 1R from +3R, 10R cap, out 11:00 ET', trail: [3, 1], exitM: 660 },
  t1030:   { name: 'live exit, out 10:30 ET', trail: [2, 1], exitM: 630 },
  t1200:   { name: 'live exit, out 12:00 ET', trail: [2, 1], exitM: 720 },
  half:    { name: 'half off at +2R, the rest trails 1R from +2R, 10R cap, out 11:00 ET', half: true, trail: [2, 1], exitM: 660 },
};
const stopFill = (b, sell, stop, afterFill = true) => !afterFill ? stop : sell ? Math.max(stop, b.open) : Math.min(stop, b.open);
const exitR = (sell, entry, px, r0) => +(((sell ? entry - px : px - entry)) / r0).toFixed(2);

// The live loop (council/trader.mjs open-trade loop / nq-open-oos lib.dayTrade) with the exit as a parameter. Within a candle:
// stop, then target, then (half) the 2R half-off, then the trail from the candle's best price, then the time exit at the open.
export function manage(D, g, v, cost = COST) {
  const s = !g.sell, dir = s ? -1 : 1, r0 = Math.abs(g.entry - g.stop); if (!(r0 > 0)) return null;
  const at = (k) => g.entry + dir * k * r0, opened = g.t + 60, exitAt = g.t + (v.exitM - g.m) * 60;
  let stop = at(-1), mfe = 0, trailMoved = false, halfR = null, R = null, exit = null, closed = null;
  const t1 = v.fixed ? at(2) : at(10), lvl2 = at(2);
  const mix = (r) => (halfR == null ? r : +(0.5 * halfR + 0.5 * r).toFixed(4));
  for (const b of D) {
    if (b.time <= opened) continue;                              // the live loop: checked = opened (first minute not checked)
    if (s ? b.high >= stop : b.low <= stop) { const px = stopFill(b, s, stop, b.time > opened);
      const r = trailMoved ? exitR(s, g.entry, px, r0) : px === stop ? -1 : exitR(s, g.entry, px, r0);
      R = mix(r); exit = trailMoved ? 'trail' : 'stop'; closed = b.time; break; }
    if (s ? b.low <= t1 : b.high >= t1) { R = mix(fixedR(Math.abs(t1 - g.entry) / r0)); exit = 'target'; closed = b.time; break; }
    if (v.half && halfR == null && (s ? b.low <= lvl2 : b.high >= lvl2)) {
      const gapped = b.time > opened && (s ? b.open <= lvl2 : b.open >= lvl2);
      halfR = exitR(s, g.entry, gapped ? b.open : lvl2, r0); }
    mfe = fixedR(Math.max(mfe, (s ? g.entry - b.low : b.high - g.entry) / r0));
    if (v.trail && mfe >= v.trail[0]) { const ns = fixedR(g.entry + dir * (mfe - v.trail[1]) * r0); if (s ? ns < stop : ns > stop) { stop = ns; trailMoved = true; } }
    if (b.time >= exitAt) { R = mix(fixedR(dir * (b.open - g.entry) / r0)); exit = 'time'; closed = b.time; break; }
  }
  if (R == null) return null;                                     // candles end before the exit: not counted for this cell
  return { gross: +R.toFixed(4), R: +(R - cost / r0).toFixed(4), R2: +(R - 2 * cost / r0).toFixed(4), exit, closed, mfe, half: halfR };
}

// ── load: the #511 cache plus the 11:05-12:05 candles (fetch-noon.mjs) ──
const days = loadOanda(OANDA); let noonDays = 0;
for (const f of fs.readdirSync(OANDA).filter((f) => /^nas100-noon-\d{4}\.json$/.test(f)).sort()) {
  const j = JSON.parse(fs.readFileSync(path.join(OANDA, f), 'utf8'));
  for (const [d, rows] of Object.entries(j)) { const a = days.get(d); if (!a) continue; noonDays++;
    for (const [time, open, high, low, close, vol] of rows) if (!a.some((b) => b.time === time)) a.push({ time, open, high, low, close, vol, m: nyParts(time).m });
    a.sort((x, y) => x.time - y.time); }
}
// ── entries (identical for every cell) ──
const sigs = [];
for (const [d, D] of days) {
  if (!CLEAN(d)) continue;
  const g = nqOpenSweep(D, 570, 0.0008); if (!g) continue;
  const ndo = midnightPrice(D); if (ndo == null) continue;
  if (!((ndo - g.entry) * (g.sell ? 1 : -1) > 0)) continue;
  sigs.push({ d, D, g });
}
console.log('entries', sigs.length, 'first', sigs[0].d, 'last', sigs.at(-1).d, '| days with noon candles', noonDays);

// ── run every cell on the same entries ──
const trades = {};
for (const [id, v] of Object.entries(CELLS)) trades[id] = sigs.map(({ d, g, D }) => { const x = manage(D, g, v); return x && { d, m: g.m, side: g.sell ? -1 : 1, entry: g.entry, r0: Math.abs(g.entry - g.stop), ...x }; }).filter(Boolean);
// B must reproduce #511's lib.dayTrade exactly
{ const ref = sigs.map(({ d, D }) => { const x = dayTrade(D, { cost: COST }); return x && { d, R: x.R }; }).filter(Boolean);
  const m = new Map(ref.map((x) => [x.d, x.R])); let diff = 0; for (const x of trades.B) if (Math.abs((m.get(x.d) ?? NaN) - x.R) > 1e-6) diff++;
  console.log('B vs #511 lib.dayTrade: n', trades.B.length, 'vs', ref.length, '| trades that differ', diff);
  if (diff || ref.length !== trades.B.length) throw new Error('baseline does not reproduce #511'); }

const R = (tr, k = 'R') => tr.map((x) => x[k]);
const sel = (tr) => tr.filter((x) => x.d < LATE), conf = (tr) => tr.filter((x) => x.d >= LATE), h1 = (tr) => tr.filter((x) => x.d >= LATE && x.d < MID), h2 = (tr) => tr.filter((x) => x.d >= MID);
const periods = { sel, conf, h1, h2 };
const exits = (tr) => Object.fromEntries([...new Set(tr.map((x) => x.exit))].sort().map((e) => [e, { n: tr.filter((x) => x.exit === e).length, avg: stats(R(tr.filter((x) => x.exit === e))).avg }]));

const out = { generated: new Date().toISOString(), preregistration: 'preregistration.md (committed 13c4ae5b before this ran)', data: 'OANDA NAS100_USD 1m via meridianx.dev/md/bars, clean years 2004-26 (#511 cache) + 11:05-12:05 ET candles (fetch-noon.mjs)',
  cost: `${COST} point round trip, 1 / stop (pts) in R; x2 and gross reported`, entries: sigs.length, periods: { selection: '2004-01-01..2022-12-31', confirmation: '2023-01-01..2026-11-06', halves: ['2023-2024', '2025-2026'] }, cells: {} };
for (const [id, v] of Object.entries(CELLS)) {
  const tr = trades[id], c = { name: v.name, n: tr.length, notCounted: sigs.length - tr.length };
  for (const [p, f] of Object.entries(periods)) c[p] = { net1: stats(R(f(tr))), net2: stats(R(f(tr), 'R2')), gross: stats(R(f(tr), 'gross')), exits: exits(f(tr)) };
  c.byYear = Object.fromEntries([...new Set(tr.map((x) => yearOf(x.d)))].map((y) => [y, stats(R(tr.filter((x) => yearOf(x.d) === y)))]));
  out.cells[id] = c;
}
// t1200 loses the trades whose candles stop before 12:00: the baseline on the same trades, for a fair pair
{ const keep = new Set(trades.t1200.map((x) => x.d)), Bp = trades.B.filter((x) => keep.has(x.d)); out.cells.t1200.pairedB = {};
  for (const [p, f] of Object.entries(periods)) out.cells.t1200.pairedB[p] = stats(R(f(Bp))); }

// ── the pre-registered pass bar, each cell on its own against B ──
const B = out.cells.B;
const better = (a, b) => a.avg != null && b.avg != null && a.avg > b.avg;
out.verdicts = {};
for (const id of Object.keys(CELLS)) {
  if (id === 'B') continue; const c = out.cells[id];
  const v = {
    selBetter: better(c.sel.net1, B.sel.net1), selDD: c.sel.net1.dd <= 1.2 * B.sel.net1.dd,
    confBetter: better(c.conf.net1, B.conf.net1), h1Better: better(c.h1.net1, B.h1.net1), h2Better: better(c.h2.net1, B.h2.net1), confDD: c.conf.net1.dd <= 1.2 * B.conf.net1.dd };
  v.selection = v.selBetter && v.selDD; v.confirmation = v.confBetter && v.h1Better && v.h2Better && v.confDD; v.pass = v.selection && v.confirmation;
  out.verdicts[id] = v;
}
const passing = Object.entries(out.verdicts).filter(([, v]) => v.pass).map(([k]) => k).sort((a, b) => out.cells[b].sel.net1.avg - out.cells[a].sel.net1.avg);
out.passing = passing; out.implement = passing[0] || null;

// ── print ──
const f3 = (x) => (x == null ? '   –  ' : (x >= 0 ? '+' : '') + x.toFixed(3));
console.log('\n## Net of 1 point: R a trade (t) | max DD, by cell and period');
console.log('cell'.padEnd(8), '| 2004-22 (select)'.padEnd(30), '| 2023-26 (confirm)'.padEnd(30), '| 2023-24'.padEnd(18), '| 2025-26'.padEnd(18), '| n');
for (const [id, c] of Object.entries(out.cells)) {
  const cell = (s) => `${f3(s.avg)} (t ${s.t == null ? '–' : s.t.toFixed(2)}) dd ${s.dd.toFixed(1)}`.padEnd(29);
  console.log(id.padEnd(8), '|', cell(c.sel.net1), '|', cell(c.conf.net1), '|', `${f3(c.h1.net1.avg)} n${c.h1.net1.n}`.padEnd(16), '|', `${f3(c.h2.net1.avg)} n${c.h2.net1.n}`.padEnd(16), '|', c.n, c.notCounted ? `(${c.notCounted} not counted)` : '');
}
console.log('\n## Gross and 2 points (R a trade): select | confirm');
for (const [id, c] of Object.entries(out.cells)) console.log(id.padEnd(8), 'gross', f3(c.sel.gross.avg), f3(c.conf.gross.avg), '| 2pt', f3(c.sel.net2.avg), f3(c.conf.net2.avg), '| exits sel', JSON.stringify(c.sel.exits), '| conf', JSON.stringify(c.conf.exits));
console.log('\nt1200 paired baseline (same trades):', JSON.stringify(out.cells.t1200.pairedB));
console.log('\n## Verdicts (pre-registered bar)'); for (const [id, v] of Object.entries(out.verdicts)) console.log(id.padEnd(8), JSON.stringify(v));
console.log('passing', JSON.stringify(passing), '| implement', out.implement);
console.log('\n## Year by year (net R a trade): B then each cell');
const years = Object.keys(B.byYear);
console.log('year'.padEnd(6), Object.keys(out.cells).map((k) => k.padStart(8)).join(''));
for (const y of years) console.log(y.padEnd(6), Object.values(out.cells).map((c) => f3(c.byYear[y]?.avg).padStart(8)).join(''));
// paired difference against B (same entries, same days): mean and t, select | confirm
out.paired = {};
{ const Bm = new Map(trades.B.map((x) => [x.d, x.R]));
  for (const id of Object.keys(CELLS)) { if (id === 'B') continue; out.paired[id] = {};
    for (const [p, f] of Object.entries(periods)) { const d = f(trades[id]).filter((x) => Bm.has(x.d)).map((x) => x.R - Bm.get(x.d)), n = d.length, m = d.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(d.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1));
      out.paired[id][p] = { n, diff: +m.toFixed(4), t: +(m / (sd / Math.sqrt(n))).toFixed(2) }; } }
  console.log('\n## Paired difference vs B (R a trade, t): select | confirm'); for (const [id, v] of Object.entries(out.paired)) console.log(id.padEnd(8), f3(v.sel.diff), `(t ${v.sel.t})`, '|', f3(v.conf.diff), `(t ${v.conf.t})`); }
// one row per entry: day, side, stop (pts), then each cell's net R (and exit as a letter: s stop, t target, m time, r trail)
const ex = { stop: 's', target: 't', time: 'm', trail: 'r' };
out.trades = sigs.map(({ d, g }) => { const row = { d, side: g.sell ? -1 : 1, r0: +Math.abs(g.entry - g.stop).toFixed(2) };
  for (const id of Object.keys(CELLS)) { const x = trades[id].find((t) => t.d === d); row[id] = x ? [x.R, ex[x.exit]] : null; } return row; });
const { trades: T, ...head } = out;
fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(head, null, 1).replace(/\n}$/, ',\n "trades": [\n' + T.map((r) => '  ' + JSON.stringify(r)).join(',\n') + '\n ]\n}'));
console.log('\nwrote result.json');
