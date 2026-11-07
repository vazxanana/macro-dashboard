// Runs bt_local.mjs (live engine replay) on local HistData, one job per year, N in parallel.
// Usage: node run_bt.mjs <outRoot> <histdataDir> <mkt> <years csv> [parallel=4]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const [outRoot, hd, mkt, ys, par = '4'] = process.argv.slice(2);
const here = new URL('.', import.meta.url).pathname;
const cfg = path.join(here, '..', '..', '..', 'council-config.json');
const jobs = ys.split(',').map((y) => ({ y, from: `${y}-01-01`, to: +y === 2026 ? '2026-10-30' : `${+y + 1}-01-01` }));
let running = 0, i = 0;
const next = () => {
  while (running < +par && i < jobs.length) {
    const j = jobs[i++], dir = path.join(outRoot, `${mkt}-${j.y}`); fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(path.join(outRoot, 'config.json'), path.join(dir, 'config.json'));
    running++;
    const p = spawn(process.execPath, [path.join(here, 'bt_local.mjs'), dir], { env: { ...process.env, BT_LOCAL: hd, BT_MKT: mkt, BT_FROM: j.from, BT_TO: j.to }, stdio: ['ignore', fs.openSync(path.join(dir, 'log.txt'), 'w'), 'inherit'] });
    p.on('exit', (c) => { running--; console.log(`${mkt} ${j.y} exit ${c}`); next(); });
  }
};
next();
