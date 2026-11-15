// The council's own OANDA candle service (15 Nov 2026). The Trader, the data check, the macro strategist and the replay read
// candles from MD_BASE, which defaulted to the website's proxy (meridianx.dev/md/). When Vercel blocked the account at 10:21
// UTC that day every gold and forex market fell to the Kraken fallback (one-feed rule: records priced on OANDA held, then
// adopted). With the OANDA_TOKEN secret set, council.yml starts this on localhost and points MD_BASE at it, so trading no longer
// depends on the website (the VPS live runner has done the same since 8 Nov: council/live.mjs startProxy). It serves only
// /md/bars through the site's own handler (api/bars.js, unchanged); the token stays in this process's environment.
//   node council/md-proxy.mjs [port]      (default 8790; needs OANDA_TOKEN, OANDA_ENV optional)
import http from 'node:http';
import { createRequire } from 'node:module';
import { serveHandler } from './live.mjs';
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
