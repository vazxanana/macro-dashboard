// Edge research · fx-reversal: copy the council's OANDA daily candles of the seven USD majors out of the council-data branch
// (git show, no network). node research/edge/fx-reversal/fetch.mjs <dir>   (the files stay out of git)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const KEYS = ['eurusd', 'gbpusd', 'usdjpy', 'audusd', 'usdcad', 'usdchf', 'nzdusd'];
const dir = process.argv[2];
if (!dir) { console.error('usage: node fetch.mjs <dir>'); process.exit(1); }
fs.mkdirSync(dir, { recursive: true });
for (const k of KEYS) {
  const f = path.join(dir, `${k}.json`);
  if (fs.existsSync(f)) continue;
  fs.writeFileSync(f, execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
  console.log('saved', k);
}
