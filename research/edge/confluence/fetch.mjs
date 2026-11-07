// Extract council-data candle files into a local raw dir. Run from the repo root after `git fetch origin council-data`:
//   node research/edge/confluence/fetch.mjs <rawDir> research/candles/xau-histdata research/candles/nsxusd-histdata research/candles/EURUSD
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const [OUT, ...dirs] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const list = execFileSync('git', ['ls-tree', '-r', '--name-only', 'origin/council-data', ...dirs], { maxBuffer: 1e8 }).toString().trim().split('\n');
for (const p of list) fs.writeFileSync(`${OUT}/${p.split('/').pop()}`, execFileSync('git', ['show', `origin/council-data:${p}`], { maxBuffer: 1e9 }));
console.log(list.length, 'files');
