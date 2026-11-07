// Live OANDA prices as Server-Sent Events: /md/stream?sym=xau. One upstream pricing stream per viewer, forwarded tick by tick
// (at most ~5 messages a second). It closes after ~4.5 min and the browser's EventSource reconnects on its own.
const { SYM } = require('./_oanda');
let acct = null;
module.exports = async (req, res) => {
  const inst = SYM[String((req.query && req.query.sym) || '')], tok = process.env.OANDA_TOKEN;
  if (!inst) return res.status(400).json({ error: 'unknown sym' });
  if (!tok) return res.status(503).json({ error: 'OANDA_TOKEN not set' });
  const live = process.env.OANDA_ENV === 'live', api = live ? 'api-fxtrade.oanda.com' : 'api-fxpractice.oanda.com', st = live ? 'stream-fxtrade.oanda.com' : 'stream-fxpractice.oanda.com';
  const H = { Authorization: `Bearer ${tok}`, 'Accept-Datetime-Format': 'UNIX' };
  try {
    if (!acct) { const r = await fetch(`https://${api}/v3/accounts`, { headers: H }); if (!r.ok) throw new Error(`OANDA accounts ${r.status}`); acct = ((await r.json()).accounts || [])[0]?.id; if (!acct) throw new Error('no OANDA account'); }
  } catch (e) { return res.status(502).json({ error: String(e.message || e) }); }
  const ac = new AbortController(), stop = setTimeout(() => ac.abort(), 270e3);
  req.on('close', () => ac.abort());
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write('retry: 1500\n\n');
  let last = 0, pend = null, flushT = null;
  const send = (o) => { try { res.write(`data: ${JSON.stringify(o)}\n\n`); } catch (e) { ac.abort(); } };
  const flush = () => { flushT = null; if (pend) { send(pend); pend = null; last = Date.now(); } };
  try {
    const r = await fetch(`https://${st}/v3/accounts/${acct}/pricing/stream?instruments=${inst}&snapshot=true`, { headers: H, signal: ac.signal });
    if (!r.ok || !r.body) { send({ error: `OANDA ${r.status}` }); throw new Error('upstream'); }
    const dec = new TextDecoder(); let buf = '';
    for await (const chunk of r.body) {
      buf += dec.decode(chunk, { stream: true });
      let i; while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line) continue;
        let m; try { m = JSON.parse(line); } catch (e) { continue; }
        if (m.type === 'HEARTBEAT') { res.write(': hb\n\n'); continue; }
        if (m.type !== 'PRICE' || !m.bids || !m.asks) continue;
        pend = { t: +m.time, b: +m.bids[0].price, a: +m.asks[0].price, ok: m.tradeable !== false };
        const wait = 200 - (Date.now() - last); if (wait <= 0) flush(); else if (!flushT) flushT = setTimeout(flush, wait);
      }
    }
  } catch (e) { /* aborted or closed: the browser reconnects */ }
  clearTimeout(stop); clearTimeout(flushT); flush();
  try { res.end(); } catch (e) {}
};
