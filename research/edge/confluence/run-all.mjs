// Runs meridian.mjs for every market x year, 4 at a time. Usage: CONFL_RAW=<dir> node run-all.mjs <outDir> [markets] [years]
import { spawn } from 'node:child_process';
import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname);
const [out, mk = 'xau,nas,eurusd', ys = '2018,2019,2020,2021,2022,2023,2024,2025,2026'] = process.argv.slice(2);
const jobs = []; for (const m of mk.split(',')) for (const y of ys.split(',')) jobs.push([m, y]);
const P = +(process.env.PAR || 4); let i = 0, live = 0;
const next = () => { while (live < P && i < jobs.length) { const [m, y] = jobs[i++]; live++;
  const c = spawn('node', [path.join(here, 'meridian.mjs'), m, y, out], { stdio: ['ignore', 'inherit', 'inherit'] });
  c.on('exit', () => { live--; next(); }); } };
next();
