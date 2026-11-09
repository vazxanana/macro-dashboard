// Fakes for tests/mcp.test.mjs: a deterministic OANDA candle server and a GitHub API router, behind one fetch. No network.
import zlib from 'node:zlib';

// deterministic noise in [-1, 1] for a time stamp and a salt
const noise = (t, s = 0) => { let x = Math.imul((t / 60) ^ (s * 0x9e3779b1), 0x85ebca6b) >>> 0; x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35) >>> 0; x ^= x >>> 16; return (x / 0xffffffff) * 2 - 1; };
// a wavy price path with noise: swings, sweeps and gaps for the iFVG model to find
export const price = (t) => 10000 + 500 * Math.sin((2 * Math.PI * t) / (86400 * 23)) + 180 * Math.sin((2 * Math.PI * t) / (86400 * 3.1)) + 70 * Math.sin((2 * Math.PI * t) / (3600 * 9.3)) + 30 * noise(t, 1);
export function candle(t, sec) {
  const o = price(t), c = price(t + sec), hi = Math.max(o, c) + Math.abs(noise(t, 2)) * 12 * Math.sqrt(sec / 3600), lo = Math.min(o, c) - Math.abs(noise(t, 3)) * 12 * Math.sqrt(sec / 3600);
  return { time: t, open: +o.toFixed(2), high: +hi.toFixed(2), low: +lo.toFixed(2), close: +c.toFixed(2) };
}
const SEC = { M5: 300, M15: 900, H1: 3600, H4: 14400, D: 86400 };
const weekend = (t) => new Date(t * 1000).getUTCDay() === 6;
export function oandaCandles(gran, from, to, now = Math.floor(Date.now() / 1000)) {
  const sec = SEC[gran], out = [];
  for (let t = Math.ceil(from / sec) * sec; t < to && out.length < 5000; t += sec) { if (weekend(t) || t > now) continue; const b = candle(t, sec);
    out.push({ time: String(t), complete: t + sec <= now, volume: 100, mid: { o: String(b.open), h: String(b.high), l: String(b.low), c: String(b.close) } }); }
  return out;
}
// Dukascopy-style research file: gzip JSON rows [t, o, h, l, c] of 5m candles for one year
export function dukaYear(y) {
  const rows = []; for (let t = Date.UTC(y, 0, 1) / 1000; t < Date.UTC(y + 1, 0, 1) / 1000; t += 300) { if (weekend(t)) continue; const b = candle(t, 300); rows.push([t, b.open, b.high, b.low, b.close]); }
  return zlib.gzipSync(JSON.stringify(rows));
}
const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json' } });

// one fetch for everything. gh: { files: { 'branch:path': value | Buffer | string }, routes: [[method, RegExp, (m, body, url) => Response]] }
export function fakeFetch({ files = {}, routes = [], oanda = true } = {}) {
  const calls = [];
  const f = async (url, o = {}) => {
    const u = String(url), method = (o.method || 'GET').toUpperCase(), body = o.body ? JSON.parse(o.body) : null; calls.push({ method, url: u, body, headers: o.headers || {} });
    if (/oanda\.com\/v3\/instruments\//.test(u)) {
      if (!oanda) return new Response('no', { status: 401 });
      const q = new URL(u).searchParams; return json({ candles: oandaCandles(q.get('granularity'), +q.get('from'), +q.get('to')) });
    }
    if (u.startsWith('https://api.github.com/repos/')) {
      const path = u.replace(/^https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+/, '');
      for (const [m, re, fn] of routes) { const mm = method === m && re.exec(path); if (mm) return fn(mm, body, u); }
      const c = /^\/contents\/(.+)\?ref=(.+)$/.exec(path);
      if (c && method === 'GET') { const v = files[`${c[2]}:${decodeURIComponent(c[1])}`]; if (v === undefined) return new Response('{"message":"Not Found"}', { status: 404 });
        return Buffer.isBuffer(v) ? new Response(v, { status: 200 }) : new Response(typeof v === 'string' ? v : JSON.stringify(v), { status: 200 }); }
      return new Response('{"message":"no route"}', { status: 404 });
    }
    return new Response('blocked in tests', { status: 599 });
  };
  f.calls = calls; return f;
}
// a fake Vercel req / res pair driven like an MCP client
export function drive(handler, { method = 'POST', query = {}, headers = {}, body } = {}) {
  const out = { code: 0, headers: {}, body: null, ended: false };
  const res = { setHeader: (k, v) => { out.headers[k.toLowerCase()] = v; }, status: (c) => { out.code = c; return res; }, json: (b) => { out.body = b; out.ended = true; return res; }, end: () => { out.ended = true; return res; } };
  return Promise.resolve(handler({ method, query, headers, body }, res)).then(() => out);
}
