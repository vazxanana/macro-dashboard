// Runs replay.mjs for every market in yearly chunks, P at a time.  node run.mjs <candleDir> <outDir> [P=4]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const [C, O, P = '4'] = process.argv.slice(2);
fs.mkdirSync(O, { recursive: true });
const here = path.dirname(new URL(import.meta.url).pathname);
const CH = [['2018-07-01', '2019-01-01']].concat([2019, 2020, 2021, 2022, 2023, 2024, 2025].map((y) => [`${y}-01-01`, `${y + 1}-01-01`]), [['2026-01-01', '2026-11-01']]);
const jobs = [];
for (const k of ['xau', 'eurusd', 'gbpusd', 'audusd', 'usdcad', 'usdchf']) for (const [a, b] of CH) jobs.push([k, a, b]);
const log = fs.createWriteStream(path.join(O, 'log.txt'), { flags: 'a' });
let running = 0;
const next = () => {
  while (running < +P && jobs.length) {
    const [k, a, b] = jobs.shift(), out = path.join(O, `${k}_${a}.json`);
    if (fs.existsSync(out) || fs.existsSync(out + '.lock')) continue;
    fs.writeFileSync(out + '.lock', '');
    running++;
    const p = spawn(process.execPath, [path.join(here, 'replay.mjs'), k, C, out, a, b], { stdio: ['ignore', 'ignore', 'pipe'] });
    p.stderr.on('data', (d) => log.write(d));
    p.on('exit', (code) => { fs.rmSync(out + '.lock', { force: true }); log.write(`${k} ${a} exit ${code}\n`); running--; next(); });
  }
};
next();
