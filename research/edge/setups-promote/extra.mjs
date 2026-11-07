// Descriptive cuts for the report (not used to choose rules): gold M30->M1 by D1 x side x session, gross vs net per setup,
// and the gold-only view of every setup.   node extra.mjs <outDir>
import fs from 'node:fs';
import path from 'node:path';
const OUT = process.argv[2], SPLIT = Date.UTC(2024, 0, 1) / 1000;
const rows = [];
for (const f of fs.readdirSync(OUT).filter((f) => f.endsWith('.json'))) {
  const j = JSON.parse(fs.readFileSync(path.join(OUT, f)));
  for (const r of j.rows) { const o = Object.fromEntries(j.cols.map((c, i) => [c, r[i]])); o.market = j.key; rows.push(o); }
}
const T = rows.filter((x) => x.status === 'closed' && x.R != null && x.rr >= 1.2).map((x) => ({ ...x, net: x.R - x.cost, year: new Date(x.opened * 1000).getUTCFullYear() })).sort((a, b) => a.opened - b.opened);
const st = (a, f = 'net') => { const n = a.length; if (!n) return 'n0'; const s = a.reduce((q, x) => q + x[f], 0), m = s / n, sd = Math.sqrt(a.reduce((q, x) => q + (x[f] - m) ** 2, 0) / n); return `n${n} ${m >= 0 ? '+' : ''}${m.toFixed(3)} (${s.toFixed(1)}R, t${(m / sd * Math.sqrt(n)).toFixed(2)})`; };
const IS = (a) => a.filter((x) => x.opened < SPLIT), OOS = (a) => a.filter((x) => x.opened >= SPLIT);
const yrs = (a) => [...new Set(a.map((x) => x.year))].sort().map((y) => `${y} ${a.filter((x) => x.year === y).reduce((q, x) => q + x.net, 0).toFixed(1)}`).join('  ');
const m = T.filter((x) => x.k === 'm30m1' && !x.dupScalp);
console.log('gold M30->M1 (Scalp duplicates removed)');
for (const d of ['with', 'against']) for (const s of ['buy', 'sell']) { const a = m.filter((x) => x.d1 === d && x.side === s); console.log(`  D1 ${d.padEnd(7)} ${s.padEnd(4)} IS ${st(IS(a))} | OOS ${st(OOS(a))}`); }
for (const d of ['with', 'against']) { const a = m.filter((x) => x.d1 === d && x.session === 'london'); console.log(`  london + D1 ${d}: IS ${st(IS(a))} | OOS ${st(OOS(a))} | ${yrs(a)}`); }
{ const a = m.filter((x) => x.session === 'london'); console.log(`  london by year: ${yrs(a)}`); }
for (const d of ['with', 'against']) { const a = m.filter((x) => x.d1 === d); console.log(`  D1 ${d} gross: IS ${st(IS(a), 'R')} | OOS ${st(OOS(a), 'R')}`); }
{ const a = m; console.log(`  2018-2026 all: with ${st(a.filter((x) => x.d1 === 'with'))}  against ${st(a.filter((x) => x.d1 === 'against'))}`); }
console.log('\ngross (before spread) per setup, all markets');
for (const k of ['rscalp', 'intraday', 'rintra', 'swing', 'position', 'm30m1', 'rswing', 'scalp']) { const a = T.filter((x) => x.k === k && !x.dupScalp); console.log(`  ${k.padEnd(9)} IS ${st(IS(a), 'R')} | OOS ${st(OOS(a), 'R')}   mean cost ${(a.reduce((q, x) => q + x.cost, 0) / a.length).toFixed(3)}R`); }
console.log('\ngold only, net, no setup filter');
for (const k of ['rscalp', 'intraday', 'rintra', 'swing', 'position', 'rswing', 'scalp']) { const a = T.filter((x) => x.k === k && x.market === 'xau'); console.log(`  ${k.padEnd(9)} IS ${st(IS(a))} | OOS ${st(OOS(a))} | ${yrs(a)}`); }
console.log('\nswing current rule (against D1) by market');
for (const mk of ['xau', 'eurusd', 'gbpusd', 'audusd', 'usdcad', 'usdchf']) { const a = T.filter((x) => x.k === 'swing' && x.d1 === 'against' && x.market === mk); console.log(`  ${mk.padEnd(7)} IS ${st(IS(a))} | OOS ${st(OOS(a))}`); }
