// Edge research · h4-zone-trail: OANDA mid H1 candles 2006-12 to 2020-01 through the site's keyless candle proxy.
//   MD_BASE=https://aureumdesk.co.uk/md/ node --use-env-proxy fetch.mjs <outDir>     (files <market>-1h.json.gz, rows [t,o,h,l,c]; keep out of git)
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
const OUT = process.argv[2]; if (!OUT) throw new Error('usage: node fetch.mjs <outDir>');
const BASE = process.env.MD_BASE || 'https://aureumdesk.co.uk/md/', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000, FROM = T('2006-12-01'), END = T('2020-01-08');
fs.mkdirSync(OUT, { recursive: true });
for (const sym of ['xau', 'eurusd', 'gbpusd']) {
  const f = path.join(OUT, sym + '-1h.json.gz'); if (fs.existsSync(f)) continue; const m = new Map();
  for (let a = FROM; a < END;) { const b = Math.min(END, a + 4999 * 3600); let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) { try { const r = await fetch(`${BASE}bars?sym=${sym}&tf=1h&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
        if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : 'HTTP ' + r.status; } catch (e) { err = String(e.message || e); }
      if (!j) await sleep(2000 * (k + 1)); }
    if (!j) throw new Error(`${sym} ${new Date(a * 1000).toISOString()}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(150); }
  const rows = [...m.values()].sort((p, q) => p[0] - q[0]); fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(rows))); console.log(sym, rows.length, new Date(rows[0][0] * 1000).toISOString());
}
