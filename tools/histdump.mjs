// Research dump: PAXG 1m candles (Kraken trades) for 25 Dec 2025 - 6 Jun 2026, and NQ (Dukascopy USATECHIDXUSD) 1m from 1 Jan 2026
import fs from 'node:fs';
import zlib from 'node:zlib';
const mode = process.argv[2], out = process.argv[3];
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
if (mode === 'xau') {
  const { krakenMinutes } = await import('../council/krakenhist.mjs');
  const K = await krakenMinutes('PAXGUSD', T('2025-12-25'), T('2026-06-07'), { cacheDir: '.kcache', budget: 6000 });
  console.log('xau bars', K.bars.length, 'from', new Date(K.from * 1000).toISOString(), 'calls', K.calls);
  fs.writeFileSync(out, zlib.gzipSync(JSON.stringify(K.bars.map((b) => [b.time, b.open, b.high, b.low, b.close]))));
} else {
  const { dukaMinutes } = await import('../council/duka.mjs');
  let all = [];
  for (const pt of [1e3]) {
    for (let d = T('2026-01-01'); d < T('2026-11-04'); d += 7 * 86400) {
      try { const b = await dukaMinutes('USATECHIDXUSD', d, Math.min(d + 7 * 86400, T('2026-11-04')), pt); all = all.concat(b); console.log(new Date(d * 1000).toISOString().slice(0, 10), b.length, b[0] && b[0].close); }
      catch (e) { console.log('fail', new Date(d * 1000).toISOString().slice(0, 10), e.message); }
    }
  }
  console.log('nq bars', all.length);
  fs.writeFileSync(out, zlib.gzipSync(JSON.stringify(all.map((b) => [b.time, b.open, b.high, b.low, b.close]))));
}
