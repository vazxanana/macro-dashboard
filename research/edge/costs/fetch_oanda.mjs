// OANDA M1 (mid) for the 30-day council replay window, via the site's own proxy (meridianx.dev/md/bars, 5000 bars a call).
//   node research/edge/costs/fetch_oanda.mjs <from ISO> <to ISO> <outDir>
import fs from 'node:fs';
import path from 'node:path';
const [FROM, TO, OUT] = process.argv.slice(2);
const f = Math.floor(Date.parse(FROM) / 1000), t = Math.floor(Date.parse(TO) / 1000);
for (const sym of ['xau', 'eurusd', 'gbpusd', 'audusd', 'usdcad', 'usdchf']) {
  const bars = new Map();
  for (let a = f; a < t; a += 4800 * 60) {
    const b = Math.min(t, a + 4800 * 60);
    const r = await fetch(`https://meridianx.dev/md/bars?sym=${sym}&tf=1m&from=${a}&to=${b}`); const j = await r.json();
    for (const x of j.bars || []) if (!x.live) bars.set(x.time, [x.time, x.open, x.high, x.low, x.close]);
  }
  const arr = [...bars.values()].sort((x, y) => x[0] - y[0]);
  fs.writeFileSync(path.join(OUT, `oanda_${sym}_1m.json`), JSON.stringify(arr));
  console.log(sym, arr.length, arr.length ? new Date(arr[0][0] * 1000).toISOString() : '', arr.length ? new Date(arr.at(-1)[0] * 1000).toISOString() : '');
}
