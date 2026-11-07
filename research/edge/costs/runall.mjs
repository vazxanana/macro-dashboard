// Runs scalp.mjs for every market x year, 4 at a time.  node research/edge/costs/runall.mjs <dataRoot> <outDir>
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const [ROOT, OUT] = process.argv.slice(2), P = +(process.env.PAR || 4);
const here = path.dirname(new URL(import.meta.url).pathname);
const jobs = [];
for (const m of ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDCAD', 'USDCHF', 'AUDUSD']) for (let y = 2018; y <= 2026; y++) jobs.push([m, y]);
let next = 0, running = 0;
const go = () => {
  while (running < P && next < jobs.length) {
    const [m, y] = jobs[next++], out = path.join(OUT, `scalp_${m}_${y}.json`);
    if (fs.existsSync(out)) continue;
    running++;
    const ch = spawn(process.execPath, [path.join(here, 'scalp.mjs'), ROOT, m, String(y), String(y), out], { stdio: ['ignore', 'pipe', 'pipe'] });
    const log = fs.createWriteStream(path.join(OUT, `log_${m}_${y}.txt`)); ch.stdout.pipe(log); ch.stderr.pipe(log);
    ch.on('exit', (c) => { running--; console.log(m, y, 'exit', c); go(); });
  }
};
go();
