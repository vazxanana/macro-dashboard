// OANDA 5m candles (NAS100, SPX500, US30, XAU/USD) from 20 Jul 2025 through the site's /md/bars proxy, for exits.mjs.
// node fetch-oanda.mjs <out dir>  ->  <out>/{nq,es,ym,gc}.json as [time, open, high, low, close]
import fs from 'node:fs';
const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const syms = { nq: 'nas100', es: 'spx500', ym: 'us30', gc: 'xau' };
const FROM = Date.parse('2025-07-20T00:00:00Z') / 1000, NOW = Math.floor(Date.now() / 1000), STEP = 4900 * 300;
for (const [k, s] of Object.entries(syms)) {
  const m = new Map();
  for (let t = FROM; t < NOW; t += STEP) {
    for (let a = 0; a < 4; a++) {
      try { const j = await (await fetch(`https://meridianx.dev/md/bars?sym=${s}&tf=5m&from=${t}&to=${Math.min(NOW, t + STEP)}`)).json();
        for (const b of j.bars || []) if (!b.live) m.set(b.time, [b.time, b.open, b.high, b.low, b.close]); break;
      } catch (e) { await new Promise((r) => setTimeout(r, 3000)); }
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  fs.writeFileSync(`${OUT}/${k}.json`, JSON.stringify([...m.values()].sort((a, b) => a[0] - b[0])));
  console.log(k, m.size);
}
