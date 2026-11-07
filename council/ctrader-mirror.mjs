// Council → cTrader DEMO mirror (owner, 7 Nov: "mirror to the cTrader demo, that's the goal of all this").
//   node council/ctrader-mirror.mjs <dataDir>      (runs after each Trader round in council.yml)
//
// Copies the council's LIVE paper trades (never shadows) on gold and forex into the cTrader DEMO account as market orders with
// the same stop and target, and closes the position when the council closes the trade. Safety, enforced here in code:
//   * DEMO ONLY: the host is the cTrader demo endpoint, CTRADER_ENV must be "demo", and the account must report isLive:false
//     before account auth is sent. A live account is refused (the owner decides on live separately, with demo results).
//   * OFF unless CTRADER_MIRROR=on. Without the CTRADER_* secrets it does nothing.
//   * Only these message types can be sent: auth, account list, trader, reconcile, symbols, token refresh, heartbeat, NEW MARKET
//     ORDER and CLOSE POSITION. No amend, no cancel, no pending orders.
//   * Small and capped: 0.01 lot (or the symbol's minimum), at most MAX_OPEN mirror positions, no new order once the account is
//     down DAY_STOP of its balance on the UTC day, only trades opened in the last FRESH seconds (no catch-up of old trades).
//   * It only ever touches positions it opened (label "council", tracked in ctrader/mirror.json).
//   * Secrets come from the environment, are never written in plain text or logged; a rotated token pair is kept encrypted
//     (AES-256-GCM, key from the client secret) in ctrader/tokens.json.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const DEMO_HOST = 'wss://demo.ctraderapi.com:5036';
export const PT = {
  APP_AUTH_REQ: 2100, APP_AUTH_RES: 2101, ACCOUNT_AUTH_REQ: 2102, ACCOUNT_AUTH_RES: 2103,
  NEW_ORDER_REQ: 2106, CLOSE_POSITION_REQ: 2111, SYMBOLS_LIST_REQ: 2114, SYMBOLS_LIST_RES: 2115,
  SYMBOL_BY_ID_REQ: 2116, SYMBOL_BY_ID_RES: 2117, TRADER_REQ: 2121, TRADER_RES: 2122, RECONCILE_REQ: 2124, RECONCILE_RES: 2125,
  EXECUTION_EVENT: 2126, ORDER_ERROR_EVENT: 2132, OA_ERROR_RES: 2142, ACCOUNTS_BY_TOKEN_REQ: 2149, ACCOUNTS_BY_TOKEN_RES: 2150,
  REFRESH_TOKEN_REQ: 2173, REFRESH_TOKEN_RES: 2174, ERROR_RES: 50, HEARTBEAT: 51,
};
export const ALLOWED = new Set([PT.APP_AUTH_REQ, PT.ACCOUNTS_BY_TOKEN_REQ, PT.ACCOUNT_AUTH_REQ, PT.TRADER_REQ, PT.RECONCILE_REQ,
  PT.SYMBOLS_LIST_REQ, PT.SYMBOL_BY_ID_REQ, PT.REFRESH_TOKEN_REQ, PT.HEARTBEAT, PT.NEW_ORDER_REQ, PT.CLOSE_POSITION_REQ]);
const NEED = ['CTRADER_CLIENT_ID', 'CTRADER_CLIENT_SECRET', 'CTRADER_ACCESS_TOKEN', 'CTRADER_REFRESH_TOKEN', 'CTRADER_ACCOUNT_ID', 'CTRADER_ENV'];
// council market -> broker symbol name (Fusion Markets cTrader names)
export const SYMBOLS = { xau: 'XAUUSD', eurusd: 'EURUSD', gbpusd: 'GBPUSD', audusd: 'AUDUSD', usdcad: 'USDCAD', usdchf: 'USDCHF' };
export const LIMITS = { lots: 0.01, maxOpen: 5, dayStop: 0.02, fresh: 15 * 60 };
const LABEL = 'council';
const OPEN = new Set(['open']), DONE = new Set(['win', 'loss', 'be', 'closed', 'expired', 'missed', 'cancelled', 'exit']);

// ---- secrets ------------------------------------------------------------------------------------------------------
export function scrubber(env) {
  const vals = NEED.map((k) => env[k]).filter((v) => v && String(v).length >= 6);
  return (s) => { let t = String(s == null ? '' : s); for (const v of vals) t = t.split(v).join('[redacted]'); return t.slice(0, 300); };
}
const keyFor = (env) => crypto.createHash('sha256').update(`${env.CTRADER_CLIENT_SECRET}|meridian-ctrader-tokens-v1`).digest();
export function seal(obj, env) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', keyFor(env), iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return { v: 1, iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') };
}
export function unseal(o, env) {
  const d = crypto.createDecipheriv('aes-256-gcm', keyFor(env), Buffer.from(o.iv, 'base64')); d.setAuthTag(Buffer.from(o.tag, 'base64'));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(o.data, 'base64')), d.final()]).toString('utf8'));
}

// ---- Open API session (JSON over WebSocket) ---------------------------------------------------------------------------
export function session(WS, scrub, url = DEMO_HOST) {
  if (url !== DEMO_HOST) throw new Error('refusing a non-demo host');
  const ws = new WS(url), waiting = new Map();
  let n = 0, beat, closed = false;
  const opened = new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = () => fail(new Error('could not reach the cTrader demo server')); });
  ws.onmessage = (ev) => {
    let m; try { m = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data)); } catch (e) { return; }
    const w = m.clientMsgId && waiting.get(m.clientMsgId); if (!w) return;   // spontaneous events (heartbeats, other fills) are ignored
    waiting.delete(m.clientMsgId); clearTimeout(w.t);
    if (m.payloadType === PT.OA_ERROR_RES || m.payloadType === PT.ERROR_RES || m.payloadType === PT.ORDER_ERROR_EVENT) {
      const p = m.payload || {}; const e = new Error(scrub(`${p.errorCode || 'ERROR'}: ${p.description || ''}`)); e.code = p.errorCode; w.fail(e);
    } else if (w.expect && m.payloadType !== w.expect) w.fail(new Error(`unexpected reply ${m.payloadType}`));
    else w.ok(m.payload || {});
  };
  ws.onclose = () => { clearInterval(beat); for (const w of waiting.values()) { clearTimeout(w.t); w.fail(new Error('connection closed')); } waiting.clear(); };
  async function send(payloadType, payload, expect) {
    if (!ALLOWED.has(payloadType)) throw new Error(`blocked: message ${payloadType} is not allowed`);
    if (closed) throw new Error('session closed');
    await opened;
    const clientMsgId = `m${++n}`;
    return new Promise((ok, fail) => {
      const t = setTimeout(() => { waiting.delete(clientMsgId); fail(new Error(`timeout waiting for ${expect}`)); }, 10000);
      waiting.set(clientMsgId, { ok, fail, t, expect });
      ws.send(JSON.stringify({ clientMsgId, payloadType, payload }));
    });
  }
  opened.then(() => { if (closed) return; beat = setInterval(() => { try { ws.send(JSON.stringify({ payloadType: PT.HEARTBEAT, payload: {} })); } catch (e) {} }, 10000); }).catch(() => {});
  return { send, close: () => { closed = true; clearInterval(beat); try { ws.close(); } catch (e) {} } };
}

// ---- sizing ---------------------------------------------------------------------------------------------------------
// cTrader volume is in hundredths of a unit; lotSize is the volume of one lot. 0.01 lot, rounded to the step, at least the minimum.
export function volumeFor(sym, lots = LIMITS.lots) {
  const lot = +sym.lotSize || 10000000, step = +sym.stepVolume || 1, min = +sym.minVolume || step;
  let v = Math.round((lot * lots) / step) * step;
  if (v < min) v = min;
  if (sym.maxVolume && v > +sym.maxVolume) v = +sym.maxVolume;
  return v;
}
// relative stop/target for a market order: in 1/100000 of the price, a multiple of the symbol's smallest step
export function relative(dist, digits = 5) {
  const unit = 10 ** Math.max(0, 5 - digits);
  return Math.max(unit, Math.round((Math.abs(dist) * 100000) / unit) * unit);
}

// ---- one mirror round -----------------------------------------------------------------------------------------------
const TOKEN_ERR = /ACCESS_TOKEN|INVALID_TOKEN|TOKEN_EXPIRED|CH_ACCESS_TOKEN_INVALID|NOT_AUTHORIZED|UNAUTHORIZED/i;
export async function mirrorRound({ env, trades, state, tokens, WS = globalThis.WebSocket, now = Math.floor(Date.now() / 1000) }) {
  const scrub = scrubber(env), log = [], say = (msg, x = {}) => log.push({ at: new Date(now * 1000).toISOString(), msg: scrub(msg), ...x });
  const st = { map: {}, day: null, startedAt: null, ...(state || {}) };
  const out = { state: st, tokens: tokens || null, log, sent: [] };
  if (String(env.CTRADER_MIRROR || '').toLowerCase() !== 'on') { st.status = 'off (CTRADER_MIRROR is not "on")'; return out; }
  const missing = NEED.filter((k) => !env[k]);
  if (missing.length) { st.status = `not configured: ${missing.join(', ')} missing`; return out; }
  if (String(env.CTRADER_ENV).toLowerCase() !== 'demo') { st.status = 'refused: CTRADER_ENV must be "demo"'; return out; }
  if (!WS) { st.status = 'no WebSocket in this runtime'; return out; }
  const accountId = Number(env.CTRADER_ACCOUNT_ID);
  if (!st.startedAt) st.startedAt = new Date(now * 1000).toISOString();   // trades before the mirror existed are never copied

  let tok = { accessToken: env.CTRADER_ACCESS_TOKEN, refreshToken: env.CTRADER_REFRESH_TOKEN };
  if (tokens) { try { const t = unseal(tokens, env); if (t.accessToken && t.refreshToken) tok = t; } catch (e) { say('stored tokens unreadable; using the configured ones'); } }

  const s = session(WS, scrub);
  try {
    await s.send(PT.APP_AUTH_REQ, { clientId: env.CTRADER_CLIENT_ID, clientSecret: env.CTRADER_CLIENT_SECRET }, PT.APP_AUTH_RES);
    let list;
    try { list = await s.send(PT.ACCOUNTS_BY_TOKEN_REQ, { accessToken: tok.accessToken }, PT.ACCOUNTS_BY_TOKEN_RES); }
    catch (e) {
      if (!TOKEN_ERR.test(String(e.code || e.message))) throw e;
      const r = await s.send(PT.REFRESH_TOKEN_REQ, { refreshToken: tok.refreshToken }, PT.REFRESH_TOKEN_RES);
      if (!r.accessToken || !r.refreshToken) throw new Error('token refresh returned no tokens');
      tok = { accessToken: r.accessToken, refreshToken: r.refreshToken, rotatedAt: new Date(now * 1000).toISOString() };
      out.tokens = seal(tok, env); say('access token refreshed (stored encrypted)');
      list = await s.send(PT.ACCOUNTS_BY_TOKEN_REQ, { accessToken: tok.accessToken }, PT.ACCOUNTS_BY_TOKEN_RES);
    }
    const all = list.ctidTraderAccount || [];
    const acc = all.find((a) => Number(a.ctidTraderAccountId) === accountId) || all.find((a) => Number(a.traderLogin) === accountId);
    if (!acc) { st.status = 'refused: CTRADER_ACCOUNT_ID not found for this token'; return out; }
    if (acc.isLive !== false) { st.status = 'refused: the account is not a demo account'; say(st.status); return out; }
    const ctid = Number(acc.ctidTraderAccountId);
    await s.send(PT.ACCOUNT_AUTH_REQ, { ctidTraderAccountId: ctid, accessToken: tok.accessToken }, PT.ACCOUNT_AUTH_RES);

    const tr = (await s.send(PT.TRADER_REQ, { ctidTraderAccountId: ctid }, PT.TRADER_RES)).trader || {};
    const digits = Number.isFinite(+tr.moneyDigits) ? +tr.moneyDigits : 2, balance = tr.balance != null ? Number(tr.balance) / 10 ** digits : null;
    const today = new Date(now * 1000).toISOString().slice(0, 10);
    if (!st.day || st.day.date !== today) st.day = { date: today, startBalance: balance };
    const rc = await s.send(PT.RECONCILE_REQ, { ctidTraderAccountId: ctid }, PT.RECONCILE_RES);
    const positions = new Map((rc.position || []).map((p) => [String(p.positionId), p]));

    // 1) positions closed at the broker (stop/target hit there) -> mark done
    for (const [id, m] of Object.entries(st.map)) if (m.status === 'open' && !positions.has(String(m.positionId))) { m.status = 'closed at broker'; m.closedAt = new Date(now * 1000).toISOString(); say(`${m.symbol} position ${m.positionId} closed at the broker`, { trade: id }); }
    // 2) council closed the trade -> close our position
    const byId = new Map(trades.map((t) => [t.id, t]));
    for (const [id, m] of Object.entries(st.map)) {
      if (m.status !== 'open') continue;
      const t = byId.get(id); if (!t || !DONE.has(t.status)) continue;
      const p = positions.get(String(m.positionId)); if (!p) continue;
      const vol = (p.tradeData && +p.tradeData.volume) || m.volume;
      try { await s.send(PT.CLOSE_POSITION_REQ, { ctidTraderAccountId: ctid, positionId: Number(m.positionId), volume: vol }, PT.EXECUTION_EVENT);
        m.status = 'closed by council'; m.closedAt = new Date(now * 1000).toISOString(); out.sent.push({ type: 'close', trade: id }); say(`closed ${m.symbol} position ${m.positionId} (council: ${t.status})`, { trade: id }); }
      catch (e) { say(`close ${m.symbol} ${m.positionId} failed: ${e.message}`, { trade: id }); }
    }
    // 3) new live council trades -> open
    const dayDown = st.day.startBalance && balance != null ? (st.day.startBalance - balance) / st.day.startBalance : 0;
    const openCount = () => Object.values(st.map).filter((m) => m.status === 'open').length;
    const since = Date.parse(st.startedAt) / 1000;
    const fresh = trades.filter((t) => !t.shadow && OPEN.has(t.status) && SYMBOLS[t.market] && !st.map[t.id] && !(st.skipped || {})[t.id]
      && (t.filled || t.opened) >= since && now - (t.filled || t.opened) <= LIMITS.fresh && t.stop != null && t.entry != null);
    if (fresh.length) {
      const names = await s.send(PT.SYMBOLS_LIST_REQ, { ctidTraderAccountId: ctid }, PT.SYMBOLS_LIST_RES);
      const idOf = new Map((names.symbol || []).map((x) => [String(x.symbolName).toUpperCase(), x.symbolId]));
      for (const t of fresh) {
        const skip = (why) => { (st.skipped = st.skipped || {})[t.id] = why; say(`not mirrored ${t.id}: ${why}`, { trade: t.id }); };
        if (dayDown >= LIMITS.dayStop) { skip(`daily loss stop (${(dayDown * 100).toFixed(1)}% down today)`); continue; }
        if (openCount() >= LIMITS.maxOpen) { skip(`${LIMITS.maxOpen} mirror positions already open`); continue; }
        const symbolId = idOf.get(SYMBOLS[t.market]); if (!symbolId) { skip(`symbol ${SYMBOLS[t.market]} not found at the broker`); continue; }
        const info = ((await s.send(PT.SYMBOL_BY_ID_REQ, { ctidTraderAccountId: ctid, symbolId: [symbolId] }, PT.SYMBOL_BY_ID_RES)).symbol || [])[0] || {};
        const volume = volumeFor(info), sell = t.side === 'sell', d = Number.isFinite(+info.digits) ? +info.digits : 5;
        const order = { ctidTraderAccountId: ctid, symbolId, orderType: 1, tradeSide: sell ? 2 : 1, volume, label: LABEL,
          comment: `council ${t.k} ${t.id}`.slice(0, 100), clientOrderId: String(t.id).slice(0, 50), relativeStopLoss: relative(t.entry - t.stop, d) };
        if (t.t1 != null && !(t.rr >= 50)) order.relativeTakeProfit = relative(t.t1 - t.entry, d);   // trailing systems: no fixed target
        try {
          const ev = await s.send(PT.NEW_ORDER_REQ, order, PT.EXECUTION_EVENT);
          const pid = ev.position && ev.position.positionId;
          st.map[t.id] = { positionId: pid != null ? String(pid) : null, symbol: SYMBOLS[t.market], side: t.side, volume, setup: t.k, status: pid != null ? 'open' : 'sent', openedAt: new Date(now * 1000).toISOString(), councilEntry: t.entry, stop: t.stop, t1: t.t1 };
          out.sent.push({ type: 'open', trade: t.id }); say(`opened ${sell ? 'sell' : 'buy'} ${SYMBOLS[t.market]} ${volume / (+info.lotSize || 10000000)} lot (council ${t.k})`, { trade: t.id });
        } catch (e) { skip(`order rejected: ${e.message}`); }
      }
    }
    st.status = `ok · demo ${acc.brokerTitleShort || ''} · balance ${balance} · ${openCount()} open`.trim();
    st.balance = balance; st.lastRun = new Date(now * 1000).toISOString();
    return out;
  } catch (e) { st.status = `error: ${scrub(e.message || e)}`; say(st.status); return out; }
  finally { s.close(); }
}

if (process.argv[1] && process.argv[1].endsWith('ctrader-mirror.mjs')) {
  const DIR = process.argv[2] || 'data', CD = path.join(DIR, 'ctrader');
  const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(CD, f), 'utf8')); } catch (e) { return d; } };
  if (String(process.env.CTRADER_MIRROR || '').toLowerCase() !== 'on' && !fs.existsSync(path.join(CD, 'mirror.json'))) process.exit(0);   // never set up: stay silent
  const raw = JSON.parse(fs.readFileSync(path.join(DIR, 'trades.json'), 'utf8')), trades = Array.isArray(raw) ? raw : raw.trades || [];
  const prev = rd('mirror.json', {}), r = await mirrorRound({ env: process.env, trades, state: prev.state, tokens: rd('tokens.json', null) });
  fs.mkdirSync(CD, { recursive: true });
  fs.writeFileSync(path.join(CD, 'mirror.json'), JSON.stringify({ state: r.state, log: (prev.log || []).concat(r.log).slice(-300), limits: LIMITS, symbols: SYMBOLS }, null, 1));
  if (r.tokens && JSON.stringify(r.tokens) !== JSON.stringify(rd('tokens.json', null))) fs.writeFileSync(path.join(CD, 'tokens.json'), JSON.stringify(r.tokens));
  console.log(`cTrader mirror: ${r.state.status}${r.sent.length ? ` · ${r.sent.length} sent` : ''}`);
}
