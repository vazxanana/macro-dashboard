// Which CNBC symbols can measure a roll from CNBC alone: cash indices / spot gold (daily basis) and single contracts.
// node probe-cnbc.mjs <out.json.gz>   (GitHub Actions only; CNBC refuses the research sandbox)
import fs from 'node:fs';
import zlib from 'node:zlib';
const OUT = process.argv[2];
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const nyFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const etStamp = (t) => { const o = {}; for (const p of nyFmt.formatToParts(new Date(t * 1000))) o[p.type] = p.value; return `${o.year}${o.month}${o.day}${o.hour}${o.minute}00`; };
const now = Math.floor(Date.now() / 1000), from = Date.parse('2024-06-01') / 1000;
const out = { at: new Date().toISOString(), series: {}, log: {} };
const SYMS = ['.NDX', '.SPX', '.DJI', '.RUT', 'XAU=', 'XAUUSD=', '@ND.1', '@SP.1', '@DJ.1', '@TFS.1', '@GC.1',
  '@ND.Z26', '@NDZ26', 'NQZ26', '@NQZ6', '@ND.U26', '@SP.Z26', '@SPZ26', 'ESZ26', '@GC.Z26', '@GCZ26', 'GCZ26', '@GC.G27', 'GCG27'];
for (const sym of SYMS) for (const iv of ['1D', '1H']) {
  const f = iv === '1D' ? from : now - 30 * 86400;
  try {
    const r = await fetch(`https://ts-api.cnbc.com/harmony/app/bars/${encodeURIComponent(sym)}/${iv}/${etStamp(f)}/${etStamp(now + 86400)}/adjusted/EST5EDT.json`, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
    const j = await r.json().catch(() => null), pb = (j && j.barData && j.barData.priceBars) || [];
    out.series[`${sym}|${iv}`] = pb.map((b) => [Math.round(+b.tradeTimeinMills / 1000), +b.open, +b.high, +b.low, +b.close, +b.volume || 0]);
    out.log[`${sym}|${iv}`] = `${r.status} ${(j && j.statusMessage) || ''} ${pb.length}`;
  } catch (e) { out.log[`${sym}|${iv}`] = String(e.message || e); }
  console.log(sym, iv, out.log[`${sym}|${iv}`]);
  await new Promise((r) => setTimeout(r, 300));
}
fs.writeFileSync(OUT, zlib.gzipSync(JSON.stringify(out)));
