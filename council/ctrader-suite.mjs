// cTrader DEMO test suite (owner, 7 Nov: "more tests for the cTrader trades: the delay to place an order, limit orders,
// changing SL or TP, different pairs").
//   node council/ctrader-suite.mjs <dataDir>      (runs after the mirror in each council round; does nothing without a request)
//
// A request in council-data ctrader/suite.json  { "request": "<id>", "symbols": ["BTCUSD", "ETHUSD", "EURUSD", ...] }
// runs, once per request, for each symbol (the smallest volume the broker allows, label "council-test"):
//   1. market BUY  -> times to ORDER_ACCEPTED and ORDER_FILLED, fill price
//   2. set SL/TP on the position (absolute, ~1%/~2% away)  -> time, then read back with reconcile
//   3. change SL/TP (~1.5%/~3%)                              -> time, read back
//   4. close the position                                     -> time
//   5. LIMIT BUY 2% below the fill                            -> time to ORDER_ACCEPTED, then reconcile shows it pending
//   6. cancel that limit order                                -> time to ORDER_CANCELLED
// A closed market's rejection is recorded with its time. Results (ms, broker replies) go back to suite.json.
// DEMO ONLY: demo host, CTRADER_ENV=demo, the account must report isLive:false, the mirror must be on. Amend/cancel/limit
// messages are allowed HERE ONLY (the mirror itself never sends them), and only on positions/orders this suite opened.
import fs from 'node:fs';
import path from 'node:path';
import { PT, DEMO_HOST, scrubber, unseal, volumeFor } from './ctrader-mirror.mjs';

export const PT2 = { ...PT, CANCEL_ORDER_REQ: 2108, AMEND_POSITION_SLTP_REQ: 2110 };
export const SUITE_ALLOWED = new Set([PT.APP_AUTH_REQ, PT.ACCOUNTS_BY_TOKEN_REQ, PT.ACCOUNT_AUTH_REQ, PT.TRADER_REQ, PT.RECONCILE_REQ,
  PT.SYMBOLS_LIST_REQ, PT.SYMBOL_BY_ID_REQ, PT.HEARTBEAT, PT.NEW_ORDER_REQ, PT.CLOSE_POSITION_REQ, PT2.CANCEL_ORDER_REQ, PT2.AMEND_POSITION_SLTP_REQ]);
const EXEC = { 2: 'ACCEPTED', 3: 'FILLED', 4: 'REPLACED', 5: 'CANCELLED', 6: 'EXPIRED', 7: 'REJECTED', 8: 'CANCEL_REJECTED', 11: 'PARTIAL_FILL' };
export const execName = (t) => (typeof t === 'string' ? t.replace(/^ORDER_/, '') : EXEC[t] || String(t));
const NEED = ['CTRADER_CLIENT_ID', 'CTRADER_CLIENT_SECRET', 'CTRADER_ACCESS_TOKEN', 'CTRADER_ACCOUNT_ID', 'CTRADER_ENV'];
const LABEL = 'council-test';

// a session that keeps listening after the first reply: a trading request gets several execution events (ACCEPTED, FILLED…)
export function suiteSession(WS, scrub, url = DEMO_HOST, clock = () => Date.now()) {
  if (url !== DEMO_HOST) throw new Error('refusing a non-demo host');
  const ws = new WS(url), waiting = new Map(); let n = 0, closed = false;
  const opened = new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = () => fail(new Error('could not reach the cTrader demo server')); });
  ws.onmessage = (ev) => {
    let m; try { m = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data)); } catch (e) { return; }
    const w = m.clientMsgId && waiting.get(m.clientMsgId); if (!w) return;
    const at = clock() - w.t0, p = m.payload || {};
    if (m.payloadType === PT.OA_ERROR_RES || m.payloadType === PT.ERROR_RES || m.payloadType === PT.ORDER_ERROR_EVENT) {
      w.events.push({ ms: at, error: scrub(`${p.errorCode || 'ERROR'}: ${p.description || ''}`) }); return w.finish();
    }
    if (m.payloadType === PT.EXECUTION_EVENT) {
      const name = execName(p.executionType); w.events.push({ ms: at, event: name, payload: p });
      if (w.done(name, p)) w.finish(); return;
    }
    w.events.push({ ms: at, reply: m.payloadType, payload: p }); w.finish();
  };
  async function send(payloadType, payload, done = () => true, timeout = 10000) {
    if (!SUITE_ALLOWED.has(payloadType)) throw new Error(`blocked: message ${payloadType} is not allowed`);
    if (closed) throw new Error('session closed');
    await opened;
    const clientMsgId = `s${++n}`;
    return new Promise((ok) => {
      const w = { t0: clock(), events: [], done };
      w.finish = () => { clearTimeout(w.t); waiting.delete(clientMsgId); ok(w.events); };
      w.t = setTimeout(() => { w.events.push({ ms: clock() - w.t0, timeout: true }); w.finish(); }, timeout);
      waiting.set(clientMsgId, w);
      ws.send(JSON.stringify({ clientMsgId, payloadType, payload }));
    });
  }
  return { send, close: () => { closed = true; try { ws.close(); } catch (e) {} } };
}
const lastPayload = (ev) => { const x = [...ev].reverse().find((e) => e.payload); return x ? x.payload : {}; };
const errOf = (ev) => (ev.find((e) => e.error) || {}).error || (ev.find((e) => e.timeout) ? 'timeout' : null);
const msOf = (ev, name) => { const e = ev.find((x) => x.event === name); return e ? e.ms : null; };
const round = (p, d) => +(+p).toFixed(d);

export async function suiteRound({ env, req, WS = globalThis.WebSocket, clock = () => Date.now() }) {
  const scrub = scrubber(env), now = new Date(clock()).toISOString();
  if (!req || !req.request || req.done) return req;
  req.startedAt = now; req.results = [];
  if (String(env.CTRADER_MIRROR || '').trim().toLowerCase() !== 'on' || NEED.some((k) => !env[k]) || String(env.CTRADER_ENV).trim().toLowerCase() !== 'demo') {
    req.done = true; req.status = 'not run: mirror off or not configured for demo'; return req;
  }
  let tok = { accessToken: env.CTRADER_ACCESS_TOKEN };
  try { const t = req._tokens && unseal(req._tokens, env); if (t) scrub.add(t.accessToken, t.refreshToken); if (t && t.accessToken) tok = t; } catch (e) {}
  const s = suiteSession(WS, scrub, DEMO_HOST, clock);
  try {
    const one = async (pt, payload, expect) => { const ev = await s.send(pt, payload); const e = errOf(ev); if (e) throw new Error(e); const p = lastPayload(ev); if (expect && !ev.some((x) => x.reply === expect)) throw new Error(`unexpected reply`); return p; };
    await one(PT.APP_AUTH_REQ, { clientId: env.CTRADER_CLIENT_ID, clientSecret: env.CTRADER_CLIENT_SECRET }, PT.APP_AUTH_RES);
    const list = await one(PT.ACCOUNTS_BY_TOKEN_REQ, { accessToken: tok.accessToken }, PT.ACCOUNTS_BY_TOKEN_RES);
    const id = Number(String(env.CTRADER_ACCOUNT_ID).trim()), all = list.ctidTraderAccount || [];
    const acc = all.find((a) => Number(a.ctidTraderAccountId) === id) || all.find((a) => Number(a.traderLogin) === id);
    if (!acc) { req.done = true; req.status = 'account not found for this token'; return req; }
    if (acc.isLive !== false) { req.done = true; req.status = 'refused: not a demo account'; return req; }
    const ctid = Number(acc.ctidTraderAccountId);
    await one(PT.ACCOUNT_AUTH_REQ, { ctidTraderAccountId: ctid, accessToken: tok.accessToken }, PT.ACCOUNT_AUTH_RES);
    const names = await one(PT.SYMBOLS_LIST_REQ, { ctidTraderAccountId: ctid }, PT.SYMBOLS_LIST_RES);
    const idOf = new Map((names.symbol || []).map((x) => [String(x.symbolName).toUpperCase().replace(/[^A-Z0-9]/g, ''), x.symbolId]));
    const reconcile = async () => one(PT.RECONCILE_REQ, { ctidTraderAccountId: ctid }, PT.RECONCILE_RES);
    const filledOrRejected = (n) => ['FILLED', 'REJECTED', 'CANCELLED', 'EXPIRED'].includes(n);

    for (const sym of (req.symbols || ['BTCUSD', 'ETHUSD', 'EURUSD', 'XAUUSD']).slice(0, 8)) {
      const r = { symbol: sym, steps: [] }; req.results.push(r);
      const step = (name, ev, extra = {}) => { const st = { step: name, events: ev.map((e) => ({ ms: e.ms, ...(e.event ? { event: e.event } : {}), ...(e.error ? { error: e.error } : {}), ...(e.timeout ? { timeout: true } : {}) })), ...extra }; r.steps.push(st); return st; };
      const symbolId = idOf.get(sym.toUpperCase().replace(/[^A-Z0-9]/g, '')); if (!symbolId) { r.skipped = 'not offered by the broker'; continue; }
      const info = (await one(PT.SYMBOL_BY_ID_REQ, { ctidTraderAccountId: ctid, symbolId: [symbolId] }, PT.SYMBOL_BY_ID_RES)).symbol?.[0] || {};
      if (!(+info.lotSize > 0)) { r.skipped = 'broker gave no lot size'; continue; }
      const volume = volumeFor({ ...info, minVolume: info.minVolume }, 0.0001), d = Number.isFinite(+info.digits) ? +info.digits : 2;   // the broker's minimum
      r.volume = volume; r.digits = d;
      // 1. market buy
      const ev1 = await s.send(PT.NEW_ORDER_REQ, { ctidTraderAccountId: ctid, symbolId, orderType: 1, tradeSide: 1, volume, label: LABEL, comment: `suite ${req.request} ${sym}` }, filledOrRejected);
      const p1 = lastPayload(ev1), st1 = step('market buy', ev1, { acceptedMs: msOf(ev1, 'ACCEPTED'), filledMs: msOf(ev1, 'FILLED') });
      const pid = p1.position && p1.position.positionId, fill = (p1.deal && +p1.deal.executionPrice) || (p1.position && +p1.position.price) || null;
      st1.fillPrice = fill; st1.positionId = pid != null ? String(pid) : null;
      if (errOf(ev1) || pid == null || !fill) { r.result = `market order not filled (${errOf(ev1) || 'no position/fill'})`; continue; }
      // 2-3. set, then change SL/TP (absolute prices), each read back from the broker
      for (const [name, slPct, tpPct] of [['set SL/TP', 0.01, 0.02], ['change SL/TP', 0.015, 0.03]]) {
        const sl = round(fill * (1 - slPct), d), tp = round(fill * (1 + tpPct), d);
        const ev = await s.send(PT2.AMEND_POSITION_SLTP_REQ, { ctidTraderAccountId: ctid, positionId: Number(pid), stopLoss: sl, takeProfit: tp }, () => true);
        const pos = ((await reconcile()).position || []).find((x) => String(x.positionId) === String(pid)) || {};
        step(name, ev, { asked: { sl, tp }, broker: { sl: pos.stopLoss ?? null, tp: pos.takeProfit ?? null }, match: pos.stopLoss != null && Math.abs(+pos.stopLoss - sl) < 10 ** -d * 1.5 && Math.abs(+pos.takeProfit - tp) < 10 ** -d * 1.5 });
      }
      // 4. close
      const ev4 = await s.send(PT.CLOSE_POSITION_REQ, { ctidTraderAccountId: ctid, positionId: Number(pid), volume }, filledOrRejected);
      step('close', ev4, { filledMs: msOf(ev4, 'FILLED') });
      const still = ((await reconcile()).position || []).some((x) => String(x.positionId) === String(pid));
      if (still) { r.result = 'close not confirmed: the position is still open (it has a stop and target set)'; continue; }
      // 5-6. limit buy 2% below, then cancel it
      const lp = round(fill * 0.98, d);
      const ev5 = await s.send(PT.NEW_ORDER_REQ, { ctidTraderAccountId: ctid, symbolId, orderType: 2, tradeSide: 1, volume, limitPrice: lp, label: LABEL, comment: `suite ${req.request} ${sym} limit` }, (n) => n === 'ACCEPTED' || filledOrRejected(n));
      const p5 = lastPayload(ev5), oid = p5.order && p5.order.orderId;
      const pending = ((await reconcile()).order || []).some((o) => String(o.orderId) === String(oid));
      step('limit buy', ev5, { limitPrice: lp, acceptedMs: msOf(ev5, 'ACCEPTED'), orderId: oid != null ? String(oid) : null, pendingAtBroker: pending });
      if (oid != null) {
        const ev6 = await s.send(PT2.CANCEL_ORDER_REQ, { ctidTraderAccountId: ctid, orderId: Number(oid) }, (n) => n === 'CANCELLED' || n === 'CANCEL_REJECTED');
        const left = ((await reconcile()).order || []).some((o) => String(o.orderId) === String(oid));
        step('cancel limit', ev6, { cancelledMs: msOf(ev6, 'CANCELLED'), goneAtBroker: !left });
      }
      r.result = 'ok';
    }
    req.status = 'done';
  } catch (e) { req.status = `error: ${scrub(e.message || e)}`; }
  finally { s.close(); req.done = true; req.finishedAt = new Date(clock()).toISOString(); }
  // summary: the order-to-fill delay per symbol
  req.summary = (req.results || []).map((r) => { const m = r.steps.find((x) => x.step === 'market buy'); return `${r.symbol}: ${r.result || r.skipped}${m && m.filledMs != null ? ` · fill ${m.filledMs} ms` : m && m.events[0] && m.events[0].error ? ` · ${m.events[0].error} in ${m.events[0].ms} ms` : ''}`; });
  return req;
}

if (process.argv[1] && process.argv[1].endsWith('ctrader-suite.mjs')) {
  const f = path.join(process.argv[2] || 'data', 'ctrader', 'suite.json');
  if (!fs.existsSync(f)) process.exit(0);
  let req; try { req = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { process.exit(0); }
  if (!req || req.done) process.exit(0);
  try { const tf = path.join(path.dirname(f), 'tokens.json'); if (fs.existsSync(tf)) req._tokens = JSON.parse(fs.readFileSync(tf, 'utf8')); } catch (e) {}
  const out = await suiteRound({ env: process.env, req });
  delete out._tokens;
  fs.writeFileSync(f, JSON.stringify(out, null, 1));
  console.log(`cTrader suite: ${out.status} · ${(out.summary || []).join(' | ')}`);
}
