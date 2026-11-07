// Extract the M1 history this study needs from the council-data branch into a scratch folder (no network).
//   node research/edge/scalp-exits/extract.mjs <outDir>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] || 'data';
fs.mkdirSync(OUT, { recursive: true });
const git = (...a) => execFileSync('git', a, { maxBuffer: 1 << 30 });
for (const d of ['EURUSD', 'GBPUSD', 'USDCAD', 'USDCHF', 'xau-histdata']) {
  const files = git('ls-tree', '-r', '--name-only', 'origin/council-data', `research/candles/${d}/`).toString().trim().split('\n');
  for (const f of files) fs.writeFileSync(path.join(OUT, path.basename(f)), git('show', `origin/council-data:${f}`));
  console.log(d, files.length);
}
