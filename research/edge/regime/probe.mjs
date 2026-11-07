// Edge research · regime: robustness probe of the gates that passed the formal OOS screen in analyze.mjs.
// Usage: node research/edge/regime/probe.mjs <dir with <market>.json>
// Neighbouring thresholds, per year and per market, a 1.5x cost stress, and the IS sign, so a pass that rests on one
// threshold, one year or one market shows up.
import fs from 'node:fs';
import path from 'node:path';

const IN = process.argv[2];
const T = [];
for (const m of ['xau', 'eurusd', 'gbpusd', 'audusd', 'usdcad', 'usdchf']) {
  const j = JSON.parse(fs.readFileSync(path.join(IN, `${m}.json`), 'utf8'));
  for (const r of j.rows) { const o = Object.fromEntries(j.cols.map((c, i) => [c, r[i]])); o.m = m; o.year = new Date(o.opened * 1000).getUTCFullYear(); o.net = o.R - o.cost; o.net15 = o.R - 1.5 * o.cost; T.push(o); }
}
T.sort((a, b) => a.opened - b.opened);
const SPLIT = Date.UTC(2024, 0, 1) / 1000;
const st = (a, k = 'net') => { const n = a.length; if (!n) return '–'; const s = a.reduce((x, y) => x + y[k], 0), m = s / n, sd = Math.sqrt(a.reduce((x, y) => x + (y[k] - m) ** 2, 0) / Math.max(1, n - 1)); return `n${n} ${m >= 0 ? '+' : ''}${m.toFixed(3)} (${s.toFixed(1)}R, t ${(m / sd * Math.sqrt(n)).toFixed(2)})`; };
const SYS = {
  swing: (x) => x.k === 'swing' && x.d1 === 'against' && x.rr >= 1.2,
  intraday: (x) => x.k === 'intraday' && x.d1 === 'against' && x.session !== 'asia' && x.rr >= 1.2 && x.rr <= 10,
  scalp: (x) => x.k === 'scalp' && x.d1 === 'against' && !['asia', 'overlap'].includes(x.session) && x.m !== 'audusd' && x.rr >= 1.2,
};
const GATES = [
  ['swing', 'adx 19.4-29.2 (picked)', (x) => x.adx >= 19.398 && x.adx < 29.167],
  ['swing', 'adx 15-30', (x) => x.adx >= 15 && x.adx < 30],
  ['swing', 'adx 18-28', (x) => x.adx >= 18 && x.adx < 28],
  ['swing', 'adx 20-25', (x) => x.adx >= 20 && x.adx < 25],
  ['swing', 'adx 20-35', (x) => x.adx >= 20 && x.adx < 35],
  ['swing', 'adx >= 20', (x) => x.adx >= 20],
  ['swing', 'adx < 25', (x) => x.adx < 25],
  ['swing', 'dist20 0.02-1.26 (picked)', (x) => x.dist20 >= 0.022 && x.dist20 < 1.255],
  ['swing', 'wkExp < 0.875 (picked)', (x) => x.wkExp < 0.875],
  ['swing', 'dayRange >= 0.72 (picked)', (x) => x.dayRange >= 0.721],
  ['swing', 'atrPctD 0.08-0.45 (picked)', (x) => x.atrPctD >= 0.076 && x.atrPctD < 0.447],
  ['swing', 'atrPctD 30-80 (owner example)', (x) => x.atrPctD >= 0.3 && x.atrPctD < 0.8],
  ['swing', 'rvPct >= 0.56 (best IS pick)', (x) => x.rvPct >= 0.564],
  ['intraday', 'dayRange 0.41-0.69 (picked)', (x) => x.dayRange >= 0.413 && x.dayRange < 0.685],
  ['intraday', 'adist20 < 1.27 (picked)', (x) => x.adist20 < 1.267],
  ['intraday', 'wkExp >= 1.04 (picked)', (x) => x.wkExp >= 1.038],
  ['intraday', 'wkSoFar < 0.53 (picked)', (x) => x.wkSoFar < 0.528],
  ['scalp', 'atrPctD 30-80 (owner example)', (x) => x.atrPctD >= 0.3 && x.atrPctD < 0.8],
  ['scalp', 'atrPctH4 >= 0.54 (best IS pick)', (x) => x.atrPctH4 >= 0.541],
];
for (const [sk, f] of Object.entries(SYS)) {
  const a = T.filter(f);
  console.log(`\n${sk} baseline IS ${st(a.filter((x) => x.opened < SPLIT))} | OOS ${st(a.filter((x) => x.opened >= SPLIT))} | OOS 1.5x cost ${st(a.filter((x) => x.opened >= SPLIT), 'net15')}`);
  console.log('  by market OOS: ' + ['xau', 'eurusd', 'gbpusd', 'audusd', 'usdcad', 'usdchf'].map((m) => `${m} ${st(a.filter((x) => x.m === m && x.opened >= SPLIT))}`).join(' · '));
}
for (const [sk, name, g] of GATES) {
  const a = T.filter(SYS[sk]).filter((x) => g(x)), IS = a.filter((x) => x.opened < SPLIT), O = a.filter((x) => x.opened >= SPLIT);
  console.log(`\n[${sk}] ${name}\n  IS ${st(IS)} | OOS ${st(O)} | OOS 1.5x cost ${st(O, 'net15')} | OOS without 2026 ${st(O.filter((x) => x.year < 2026))}`);
  console.log('  years: ' + [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].map((y) => `${y} ${st(a.filter((x) => x.year === y))}`).join(' · '));
  console.log('  OOS by market: ' + ['xau', 'eurusd', 'gbpusd', 'audusd', 'usdcad', 'usdchf'].map((m) => `${m} ${st(O.filter((x) => x.m === m))}`).join(' · '));
}
