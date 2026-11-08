// Raw CNBC candle dump for the futures-roll check (research/edge/futures-roll/preregistration.md). Runs in GitHub Actions
// (.github/workflows/futures-roll-data.yml): CNBC refuses the research sandbox. No filter is applied: the analysis applies the
// desk's own halt / shut filters. node fetch-cnbc.mjs <out.json.gz>
import fs from 'node:fs';
import zlib from 'node:zlib';
const OUT = process.argv[2];
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nyFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const etStamp = (t) => { const o = {}; for (const p of nyFmt.formatToParts(new Date(t * 1000))) o[p.type] = p.value; return `${o.year}${o.month}${o.day}${o.hour}${o.minute}00`; };
async function bars(sym, iv, from, to, mode) {
  if (iv !== '1D') from = Math.floor(from / 3600) * 3600;   // as ict/tracker.mjs cnbcBars
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(`https://ts-api.cnbc.com/harmony/app/bars/${encodeURIComponent(sym)}/${iv}/${etStamp(from)}/${etStamp(to)}/${mode}/EST5EDT.json`, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
      const j = await r.json().catch(() => null), pb = j && j.barData && j.barData.priceBars;
      if (!pb) return { bars: [], msg: (j && j.statusMessage) || `HTTP ${r.status}` };
      return { bars: pb.map((b) => [Math.round(+b.tradeTimeinMills / 1000), +b.open, +b.high, +b.low, +b.close, +b.volume || 0]).filter((x) => x.slice(0, 5).every((v) => isFinite(v) && v > 0)), msg: 'ok' };
    } catch (e) { await sleep(1500 * (a + 1)); }
  }
  return { bars: [], msg: 'error' };
}
const now = Math.floor(Date.now() / 1000), T = (s) => Date.parse(s) / 1000;
const out = { at: new Date().toISOString(), log: {}, series: {} };
async function grab(sym, iv, mode, from, step) {
  const key = `${sym}|${iv}|${mode}`, m = new Map(), log = [];
  if (iv === '1D') { const g = await bars(sym, iv, from, now + 86400, mode); for (const b of g.bars) m.set(b[0], b); log.push(`${g.msg}:${g.bars.length}`); }
  else for (let t = from; t < now; t += step) { const g = await bars(sym, iv, t, Math.min(now + 3600, t + step), mode); for (const b of g.bars) m.set(b[0], b); log.push(`${new Date(t * 1000).toISOString().slice(0, 10)} ${g.msg}:${g.bars.length}`); await sleep(250); }
  out.series[key] = [...m.values()].sort((a, b) => a[0] - b[0]); out.log[key] = log;
  const s = out.series[key]; console.log(key, s.length, s.length ? `${new Date(s[0][0] * 1000).toISOString()} .. ${new Date(s.at(-1)[0] * 1000).toISOString()}` : log.slice(0, 3).join(' '));
}
const ROOTS = ['@ND', '@SP', '@DJ', '@TFS', '@GC'];
for (const r of ROOTS) {
  await grab(`${r}.1`, '1D', 'adjusted', T('2024-01-01'));
  await grab(`${r}.1`, '1D', 'unadjusted', T('2024-01-01'));
  await grab(`${r}.2`, '1D', 'adjusted', T('2024-01-01'));
  await grab(`${r}.1`, '1H', 'adjusted', T('2025-01-01'), 10 * 86400);
  await grab(`${r}.1`, '1H', 'unadjusted', T('2025-01-01'), 10 * 86400);
  await grab(`${r}.2`, '1H', 'adjusted', T('2025-01-01'), 10 * 86400);
  await grab(`${r}.1`, '5M', 'adjusted', T('2026-03-01'), 2 * 86400);
}
fs.writeFileSync(OUT, zlib.gzipSync(JSON.stringify(out)));
console.log('wrote', OUT, fs.statSync(OUT).size);
