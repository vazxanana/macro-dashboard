// Edge research · crypto-cycle: copies the Binance spot 5-minute candles of BTC / ETH / SOL out of the council-data branch
// (research/candles/crypto5m, 1 Jan 2022 on) with `git show`, no network. Keep the output out of git.
//   node research/edge/crypto-cycle/fetch.mjs <outDir>   (from a checkout that has origin/council-data fetched)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const MARKETS = ['btc', 'eth', 'sol'];
const OUT = process.argv[2];
if (!OUT) throw new Error('usage: node fetch.mjs <outDir>');
fs.mkdirSync(OUT, { recursive: true });
for (const m of MARKETS) {
  const buf = execFileSync('git', ['show', `origin/council-data:research/candles/crypto5m/${m.toUpperCase()}USDT_5m.json.gz`], { maxBuffer: 1 << 28 });
  fs.writeFileSync(path.join(OUT, `${m}-5m.json.gz`), buf);
  console.log(`${m}: ${buf.length} bytes`);
}
