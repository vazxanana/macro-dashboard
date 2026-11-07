// fetch OANDA M5 + H1 (via meridianx.dev proxy), cache to <out>/
import fs from 'node:fs';
const OUT = process.argv[2];
const syms = process.argv.slice(3);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url) { for (let a = 0; a < 5; a++) { try { const r = await fetch(url, { signal: AbortSignal.timeout(30000) }); const j = await r.json(); if (r.ok && j.bars) return j.bars; console.log('retry', url, r.status, JSON.stringify(j).slice(0, 120)); } catch (e) { console.log('err', String(e)); } await sleep(2000 * (a + 1)); } throw new Error('fail ' + url); }
const now = Math.floor(Date.now() / 1000);
for (const sym of syms) {
  for (const [tf, sec, start] of [['5m', 300, Date.UTC(2025, 5, 15) / 1000], ['1h', 3600, Date.UTC(2024, 9, 1) / 1000]]) {
    const f = `${OUT}/${sym}-${tf}.json`; if (fs.existsSync(f)) continue;
    const all = new Map();
    for (let t = start; t < now; t += 4999 * sec) {
      const to = Math.min(now, t + 4999 * sec);
      const b = await get(`https://meridianx.dev/md/bars?sym=${sym}&tf=${tf}&from=${t}&to=${to}`);
      for (const x of b) if (!x.live) all.set(x.time, [x.time, x.open, x.high, x.low, x.close]);
      await sleep(150);
    }
    const arr = [...all.values()].sort((a, b) => a[0] - b[0]);
    fs.writeFileSync(f, JSON.stringify(arr)); console.log(sym, tf, arr.length, new Date(arr[0][0] * 1000).toISOString(), new Date(arr.at(-1)[0] * 1000).toISOString());
  }
}
