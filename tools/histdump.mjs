// Research dump: PAXG 1m candles (Kraken trades) for 25 Dec 2025 - 6 Jun 2026, and NQ (Dukascopy USATECHIDXUSD) 1m from 1 Jan 2026
import fs from 'node:fs';
import zlib from 'node:zlib';
const mode = process.argv[2], out = process.argv[3]; let out_;
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
if (mode === 'xaub') {
  // Binance PAXGUSDT 1m (the same source as the 150-day dump), 20 Dec 2025 - 8 Jun 2026
  let t = T('2025-12-20') * 1000; const end = T('2026-06-08') * 1000, out = [];
  while (t < end) {
    let j = null;
    for (let a = 0; a < 5 && !j; a++) { try { const r = await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=PAXGUSDT&interval=1m&startTime=${t}&limit=1000`); if (r.ok) j = await r.json(); } catch (e) {} if (!j) await new Promise((r) => setTimeout(r, 2000 * (a + 1))); }
    if (!j || !j.length) break;
    for (const k of j) if (k[0] < end) out.push([k[0] / 1000, +k[1], +k[2], +k[3], +k[4]]);
    t = j.at(-1)[0] + 60000;
  }
  console.log('xau binance bars', out.length, out[0] && new Date(out[0][0] * 1000).toISOString(), out.at(-1) && new Date(out.at(-1)[0] * 1000).toISOString());
  fs.writeFileSync(out_ = process.argv[3], zlib.gzipSync(JSON.stringify(out)));
} else if (mode === 'xau') {
  const { krakenMinutes } = await import('../council/krakenhist.mjs');
  const K = await krakenMinutes('PAXGUSD', T('2025-12-25'), T('2026-06-07'), { cacheDir: '.kcache', budget: 6000 });
  console.log('xau bars', K.bars.length, 'from', new Date(K.from * 1000).toISOString(), 'calls', K.calls);
  fs.writeFileSync(out, zlib.gzipSync(JSON.stringify(K.bars.map((b) => [b.time, b.open, b.high, b.low, b.close]))));
} else {
  const { dukaMinutes } = await import('../council/duka.mjs');
  let all = [];
  for (const pt of [1e3]) {
    for (let d = T('2025-12-01'); d < T('2026-09-20'); d += 7 * 86400) {
      try { const b = await dukaMinutes('USATECHIDXUSD', d, Math.min(d + 7 * 86400, T('2026-09-20')), pt); all = all.concat(b); console.log(new Date(d * 1000).toISOString().slice(0, 10), b.length, b[0] && b[0].close); }
      catch (e) { console.log('fail', new Date(d * 1000).toISOString().slice(0, 10), e.message); }
    }
  }
  console.log('nq bars', all.length);
  fs.writeFileSync(out, zlib.gzipSync(JSON.stringify(all.map((b) => [b.time, b.open, b.high, b.low, b.close]))));
}
