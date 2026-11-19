// The council's own OANDA candle service (15 Nov 2026). The Trader, the data check, the macro strategist and the replay read
// candles from MD_BASE, which defaulted to the website's proxy (meridianx.dev/md/). When Vercel blocked the account at 10:21
// UTC that day every gold and forex market fell to the Kraken fallback (one-feed rule: records priced on OANDA held, then
// adopted). With the OANDA_TOKEN secret set, council.yml starts this on localhost and points MD_BASE at it, so trading no longer
// depends on the website (the VPS live runner did the same from 8 Nov until it was removed on 17 Nov). It serves only
// /md/bars through the site's own handler (api/bars.js, unchanged); the token stays in this process's environment.
//   node council/md-proxy.mjs [port]      (default 8790; needs OANDA_TOKEN, OANDA_ENV optional)
import http from 'node:http';
import { createRequire } from 'node:module';
// The handler's (req, res) shape over node:http (moved here from council/live.mjs when that file was removed, 17 Nov 2026).
export function serveHandler(handler, req, res) {
  const u = new URL(req.url, 'http://127.0.0.1'); const q = Object.fromEntries(u.searchParams.entries());
  let status = 200; const headers = {};
  const shim = { setHeader: (k, v) => { headers[k] = v; }, status: (c) => { status = c; return shim; }, json: (o) => { res.writeHead(status, { 'content-type': 'application/json', ...headers }); res.end(JSON.stringify(o)); return shim; }, end: (s) => { res.writeHead(status, headers); res.end(s); } };
  return Promise.resolve(handler({ query: q, url: req.url, method: req.method, headers: req.headers }, shim)).catch((e) => { try { res.writeHead(500, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: String(e.message || e) })); } catch (x) {} });
}
export function start(port = 8790, env = process.env) {
  if (!env.OANDA_TOKEN) return null;
  const handler = createRequire(import.meta.url)('../api/bars.js');
  const srv = http.createServer((req, res) => { if (req.url.startsWith('/md/bars')) serveHandler(handler, req, res); else { res.writeHead(404); res.end(); } });
  srv.listen(port, '127.0.0.1'); return srv;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = +(process.argv[2] || 8790);
  if (!start(port)) { console.log('md-proxy: OANDA_TOKEN not set, not started'); process.exit(0); }
  console.log(`md-proxy: OANDA candles on http://127.0.0.1:${port}/md/bars`);
}
