// No-network stub for the ICT tracker / replay: CNBC futures requests are served from OANDA candles cached on disk (stand-ins:
// NQ <- nas100, ES <- spx500, YM <- us30, RTY <- de40, GC <- xau), the site's /md/bars proxy from the same cache (xag ...).
// Clock fixed by env NOW (ISO), sleeps are instant.
import fs from 'node:fs';
const DIR = process.env.STUB_DIR, T = Date.parse(process.env.NOW);
globalThis.Date = class extends Date { constructor(...a) { if (a.length) super(...a); else super(T); } static now() { return T; } };
const NOWS = Math.floor(T / 1000);
globalThis.setTimeout = ((st) => (f, ms, ...a) => st(f, 0, ...a))(globalThis.setTimeout);
const cache = new Map();
const data = (k, tf) => { const key = `${k}-${tf}`; if (!cache.has(key)) { let a = []; try { a = JSON.parse(fs.readFileSync(`${DIR}/${key}.json`, 'utf8')); } catch (e) { a = []; } cache.set(key, a); } return cache.get(key); };
const CN = { '@ND.1': 'nas100', '@SP.1': 'spx500', '@DJ.1': 'us30', '@TFS.1': 'de40', '@GC.1': 'xau' };
const NYF = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'shortOffset' });
const nyOff = (t) => (NYF.formatToParts(new Date(t * 1000)).find((x) => x.type === 'timeZoneName').value.includes('-4') ? 4 : 5);
const et = (s) => { const g = Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10), +s.slice(10, 12)) / 1000; return g + nyOff(g + 5 * 3600) * 3600; };
function daily(H) { const out = []; let cur = null, key = null;
  for (const b of H) { const off = nyOff(b[0]), day = Math.floor((b[0] - off * 3600 + 7 * 3600) / 86400);
    if (day !== key) { key = day; cur = [(day + 1) * 86400 - 7 * 3600 + off * 3600 - 86400, b[1], b[2], b[3], b[4]]; out.push(cur); } else { cur[2] = Math.max(cur[2], b[2]); cur[3] = Math.min(cur[3], b[3]); cur[4] = b[4]; } }
  return out; }
const json = (o, ok = true) => ({ ok, status: ok ? 200 : 404, json: async () => o, text: async () => JSON.stringify(o) });
globalThis.fetch = async (u) => {
  u = String(u);
  if (u.includes('cnbc.com')) {
    const p = u.split('/'), i = p.indexOf('bars'), sym = decodeURIComponent(p[i + 1]), iv = p[i + 2], from = et(p[i + 3]), to = et(p[i + 4]), k = CN[sym];
    if (!k) return json({ barData: { priceBars: [] } });
    const sec = iv === '5M' ? 300 : 3600;
    let b = iv === '1D' ? daily(data(k, '1h').filter((x) => x[0] + 3600 <= NOWS)) : data(k, iv === '5M' ? '5m' : '1h');
    b = b.filter((x) => x[0] >= from && x[0] <= to && x[0] < NOWS - (iv === '1D' ? 0 : 0) && (iv === '1D' || x[0] + sec <= NOWS + sec));
    return json({ barData: { priceBars: b.map((x) => ({ open: x[1], high: x[2], low: x[3], close: x[4], tradeTimeinMills: x[0] * 1000 })) } });
  }
  if (u.includes('/md/bars')) {
    const q = new URL(u).searchParams, sym = q.get('sym'), tf = q.get('tf'), sec = tf === '5m' ? 300 : 3600;
    let b = data(sym, tf).filter((x) => x[0] < NOWS);
    if (q.get('from')) { const from = +q.get('from'), to = Math.min(NOWS, +q.get('to')); b = b.filter((x) => x[0] >= Math.max(from, to - 4999 * sec) && x[0] <= to); }
    else b = b.slice(-(+q.get('n') || 500));
    return json({ src: 'OANDA', bars: b.map((x) => ({ time: x[0], open: x[1], high: x[2], low: x[3], close: x[4], ...(x[0] + sec > NOWS ? { live: true } : {}) })) });
  }
  return json(null, false);
};
