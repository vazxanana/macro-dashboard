// Runs replay.mjs for every market x year, a few at a time, skipping jobs whose output exists.
//   node research/edge/timing/run-all.mjs <candlesDir> <outDir> [parallel=3]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [DIR, OUT, P = '3'] = process.argv.slice(2);
const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdcad', 'usdchf', 'audusd'];
const YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const script = new URL('./replay.mjs', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const run = (args) => new Promise((res) => { const c = spawn(process.execPath, [script, ...args], { stdio: ['ignore', 'inherit', 'inherit'] }); c.on('exit', res); });
// D1 trend caches first, one market at a time (each job would otherwise build it)
for (const m of MARKETS) if (!fs.existsSync(path.join(OUT, `d1-${m}.json`))) { process.env.LIMIT_DAYS = '1'; await run([DIR, m, '2018', path.join(OUT, `_warm-${m}.json`)]); delete process.env.LIMIT_DAYS; }
// newest years first, so the out-of-sample part is ready early
const jobs = [];
for (const y of YEARS.slice().reverse()) for (const m of MARKETS) { const f = path.join(OUT, `${m}-${y}.json`); if (!fs.existsSync(f)) jobs.push([DIR, m, String(y), f]); }
let k = 0;
await Promise.all(Array.from({ length: +P }, async () => { while (k < jobs.length) { const j = jobs[k++]; await run(j); } }));
console.log('all done');
