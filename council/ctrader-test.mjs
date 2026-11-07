// cTrader DEMO test order (owner, 7 Nov: "place some test trades to see if it works").
//   node council/ctrader-test.mjs <dataDir>      (runs after the mirror in each council round; does nothing without a request)
//
// A request in council-data ctrader/test.json  { "request": "<id>", "symbols": ["BTCUSD", ...], "side": "buy", "holdSec": 300 }
// places ONE 0.01-lot (or the symbol's minimum) market order on the cTrader DEMO account: the first listed symbol the broker
// accepts (markets that are closed reject the order and the next symbol is tried). The position gets a stop and target ~1%
// away when a reference price can be read, and is closed again after holdSec. Every step and the broker's replies are written
// back to test.json. Same safety as the mirror: demo host only, the account must report isLive:false, the mirror's message
// allowlist (market NEW ORDER and CLOSE POSITION are the only trading messages), secrets never logged. One request runs once.
import fs from 'node:fs';
import path from 'node:path';
import { PT, session, scrubber, unseal, volumeFor, relative } from './ctrader-mirror.mjs';

const NEED = ['CTRADER_CLIENT_ID', 'CTRADER_CLIENT_SECRET', 'CTRADER_ACCESS_TOKEN', 'CTRADER_REFRESH_TOKEN', 'CTRADER_ACCOUNT_ID', 'CTRADER_ENV'];
const KRAKEN = { BTCUSD: 'XBTUSD', ETHUSD: 'ETHUSD', XAUUSD: 'PAXGUSD' };

async function refPrice(name) {   // a reference price for the ~1% stop/target (Kraken public ticker); null when unavailable
  const k = KRAKEN[name]; if (!k) return null;
  try { const r = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${k}`, { signal: AbortSignal.timeout(8000) }); const j = await r.json();
    const v = Object.values(j.result || {})[0]; const p = v && +v.c[0]; return p > 0 ? p : null; } catch (e) { return null; }
}

export async function testRound({ env, req, WS = globalThis.WebSocket, now = Math.floor(Date.now() / 1000), price = refPrice }) {
  const scrub = scrubber(env), log = (msg) => { req.log = (req.log || []).concat({ at: new Date(now * 1000).toISOString(), msg: scrub(msg) }).slice(-40); };
  if (!req || !req.request || req.done) return req;
  if (String(env.CTRADER_MIRROR || '').trim().toLowerCase() !== 'on') { log('mirror is off: test not run'); req.done = true; return req; }
  if (NEED.some((k) => !env[k]) || String(env.CTRADER_ENV).trim().toLowerCase() !== 'demo') { log('not configured for demo: test not run'); req.done = true; return req; }
  let tok = { accessToken: env.CTRADER_ACCESS_TOKEN };
  try { const t = req._tokens && unseal(req._tokens, env); if (t) scrub.add(t.accessToken, t.refreshToken); if (t && t.accessToken) tok = t; } catch (e) {}
  const s = session(WS, scrub);
  try {
    await s.send(PT.APP_AUTH_REQ, { clientId: env.CTRADER_CLIENT_ID, clientSecret: env.CTRADER_CLIENT_SECRET }, PT.APP_AUTH_RES);
    const list = await s.send(PT.ACCOUNTS_BY_TOKEN_REQ, { accessToken: tok.accessToken }, PT.ACCOUNTS_BY_TOKEN_RES);
    const id = Number(String(env.CTRADER_ACCOUNT_ID).trim()), all = list.ctidTraderAccount || [];
    const acc = all.find((a) => Number(a.ctidTraderAccountId) === id) || all.find((a) => Number(a.traderLogin) === id);
    if (!acc) { log('account not found for this token'); req.done = true; return req; }
    if (acc.isLive !== false) { log('refused: not a demo account'); req.done = true; return req; }
    const ctid = Number(acc.ctidTraderAccountId);
    await s.send(PT.ACCOUNT_AUTH_REQ, { ctidTraderAccountId: ctid, accessToken: tok.accessToken }, PT.ACCOUNT_AUTH_RES);

    if (req.positionId && !req.closedAt) {   // phase 2: close after the hold
      const rc = await s.send(PT.RECONCILE_REQ, { ctidTraderAccountId: ctid }, PT.RECONCILE_RES);
      const p = (rc.position || []).find((x) => String(x.positionId) === String(req.positionId));
      if (!p) { req.closedAt = new Date(now * 1000).toISOString(); req.done = true; log(`position ${req.positionId} already closed at the broker (stop/target)`); return req; }
      if (now - Date.parse(req.openedAt) / 1000 < (+req.holdSec || 300)) { log(`holding position ${req.positionId} (${req.symbol}) until the hold ends`); return req; }
      await s.send(PT.CLOSE_POSITION_REQ, { ctidTraderAccountId: ctid, positionId: Number(req.positionId), volume: (p.tradeData && +p.tradeData.volume) || req.volume }, PT.EXECUTION_EVENT);
      req.closedAt = new Date(now * 1000).toISOString(); req.done = true; log(`closed position ${req.positionId} (${req.symbol}): test complete`); return req;
    }
    if (req.positionId) { req.done = true; return req; }

    // phase 1: open one position on the first symbol the broker accepts right now
    const names = await s.send(PT.SYMBOLS_LIST_REQ, { ctidTraderAccountId: ctid }, PT.SYMBOLS_LIST_RES);
    const idOf = new Map((names.symbol || []).map((x) => [String(x.symbolName).toUpperCase(), x.symbolId]));
    req.tried = req.tried || [];
    for (const name of (req.symbols || ['BTCUSD', 'ETHUSD', 'EURUSD', 'XAUUSD']).map((x) => String(x).toUpperCase())) {
      if (req.tried.includes(name)) continue;
      req.tried.push(name);
      const symbolId = idOf.get(name); if (!symbolId) { log(`${name}: not offered by the broker`); continue; }
      const info = ((await s.send(PT.SYMBOL_BY_ID_REQ, { ctidTraderAccountId: ctid, symbolId: [symbolId] }, PT.SYMBOL_BY_ID_RES)).symbol || [])[0] || {};
      const volume = volumeFor(info), d = Number.isFinite(+info.digits) ? +info.digits : 2, side = req.side === 'sell' ? 2 : 1;
      const order = { ctidTraderAccountId: ctid, symbolId, orderType: 1, tradeSide: side, volume, label: 'council-test', comment: `test ${req.request}`.slice(0, 100), clientOrderId: `test-${req.request}`.slice(0, 50) };
      const ref = await price(name); if (ref) { order.relativeStopLoss = relative(ref * 0.01, d); order.relativeTakeProfit = relative(ref * 0.01, d); }
      try {
        const ev = await s.send(PT.NEW_ORDER_REQ, order, PT.EXECUTION_EVENT);
        const pid = ev.position && ev.position.positionId;
        Object.assign(req, { symbol: name, volume, positionId: pid != null ? String(pid) : null, openedAt: new Date(now * 1000).toISOString(), execution: ev.executionType || null, sl_tp: ref ? '~1% from ' + ref : 'none (no reference price)' });
        log(`opened ${side === 1 ? 'buy' : 'sell'} ${name} volume ${volume}${ref ? ` with stop/target ~1% (ref ${ref})` : ''}: ${ev.executionType || 'accepted'}, position ${pid != null ? pid : '?'}`);
        if (pid == null) req.done = true;
        return req;
      } catch (e) { log(`${name}: order rejected: ${e.message}`); }
    }
    log('no symbol accepted the order now (markets closed?): test ends; request again when markets are open'); req.done = true; return req;
  } catch (e) { log(`error: ${e.message}`); req.errors = (req.errors || 0) + 1; if (req.errors >= 3) req.done = true; return req; }
  finally { s.close(); }
}

if (process.argv[1] && process.argv[1].endsWith('ctrader-test.mjs')) {
  const f = path.join(process.argv[2] || 'data', 'ctrader', 'test.json');
  if (!fs.existsSync(f)) process.exit(0);
  let req; try { req = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { process.exit(0); }
  if (!req || req.done) process.exit(0);
  try { const tf = path.join(path.dirname(f), 'tokens.json'); if (fs.existsSync(tf)) req._tokens = JSON.parse(fs.readFileSync(tf, 'utf8')); } catch (e) {}
  const out = await testRound({ env: process.env, req });
  delete out._tokens;
  fs.writeFileSync(f, JSON.stringify(out, null, 1));
  console.log(`cTrader test: ${(out.log || []).slice(-1).map((l) => l.msg).join('') || 'no change'}`);
}
