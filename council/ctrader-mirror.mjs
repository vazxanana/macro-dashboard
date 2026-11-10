// Council → cTrader DEMO mirror (owner, 7 Nov: "mirror to the cTrader demo, that's the goal of all this").
//   node council/ctrader-mirror.mjs <dataDir>      (runs after each Trader round in council.yml)
//
// Copies the council's paper trades on gold, forex and crypto, LIVE and SHADOW (owner, 8 Nov: "everything the council does, mirror to cTrader,
// even the ones active now"; before that live only), and the ICT desk's A-setups (NQ/ES/YM/RTY/GC), into the cTrader DEMO account as market orders with
// the same stop and target, and closes the position when the council closes the trade. Safety, enforced here in code:
//   * DEMO ONLY: the host is the cTrader demo endpoint, CTRADER_ENV must be "demo", and the account must report isLive:false
//     before account auth is sent. A live account is refused (the owner decides on live separately, with demo results).
//   * OFF unless CTRADER_MIRROR=on. Without the CTRADER_* secrets it does nothing.
//   * Only these message types can be sent: auth, account list, trader, reconcile, symbols, token refresh, heartbeat, NEW ORDER
//     (market, or a LIMIT order for a council trade that is still pending), CANCEL ORDER (only the mirror's own pending orders, by
//     label + comment), AMEND POSITION SL/TP (only the mirror's own positions, when the council moves a stop or target: break-even,
//     trailing; 8 Nov, owner: "yes, mirror the stop moves to ctrader, i approve the amend") and CLOSE POSITION. No amend of orders,
//     no close-all.
//   * Same time as the council (8 Nov, owner): the council records a trade as `pending` at its entry level and fills it when a
//     later candle touches that level. The mirror now places the same LIMIT order at the broker (price = the council entry, absolute
//     stop and target = the council levels, valid until the council's own expiry), so the demo fills on the same touch at the same
//     price. When the council marks the trade filled while the broker's limit is still resting (a feed saw the touch first) the
//     limit is cancelled and a market order follows; when the broker fills first, the position is adopted by label + comment; when
//     the council expires, misses or drops the trade, the limit is cancelled. A pending entry on the wrong side of the current
//     price (a buy above it) is left to the council's next candle (it fills there) and then copied as a market order.
//   * Small and capped: risk-based lots (see sizing below, valued with the broker's own specs from ctrader/symbols.json, written
//     each round by council/ctrader-symbols.mjs), one trade's margin at most LIMITS.maxMarginShare of the balance (LIMITS.maxLots
//     when the broker's margin is unknown), all open positions' margin at most LIMITS.maxTotalMarginShare, never above the broker's
//     own maximum, at most LIMITS.maxOpen mirror positions (unconfirmed orders included), no new order once the account is down
//     LIMITS.dayStop of its balance on the UTC day (closed P/L: balance).
//   * Everything the council has open (8 Nov, owner: "even the ones active now"): an open council trade stays eligible for as long
//     as it is open, whatever its age; a closed market, a holiday or a capacity cap (open count, open risk, margin, daily stop) only
//     waits (state.wait, the symbol paused LIMITS.pause seconds after a closed-market answer), a broker rejection or an unusable
//     price skips the trade for good (state.skipped). Both notes live as long as the trade is open.
//   * Levels (8 Nov audit): a market order carries RELATIVE stop/target distances from its fill. Measured from the council's entry
//     they land at the wrong prices for a trade copied late, so for council trades they are measured from the council's latest
//     price of the market (`marks`, the Trader's snapshot.json), and the demo stop/target then equal the council's levels within the
//     quote gap; the lot is sized on that real distance too. A trade whose price has already passed the council stop or target, or
//     has run more than LIMITS.maxDriftR of its risk from the entry, is a different trade now and is skipped. ICT trades keep the
//     entry-relative distances (futures levels on a cash CFD: only the distance carries over).
//   * Minimum lot (8 Nov): on a small demo the risk-based lot is below the broker's minimum for most trades; the order then goes at
//     the minimum lot (its real risk counted against maxOpenRisk) instead of being skipped, unless even that risks more than
//     LIMITS.maxMinLotRisk of the balance (then it waits for a bigger balance). config.json mirrorShadow: false turns the shadow
//     copying off again (the CLI reads it; mirrorRound takes `shadows`).
//   * It only ever touches positions it opened (label "council" + comment naming the trade, tracked in ctrader/mirror.json); a
//     position whose round never saved is found again by that label/comment, so a trade is never opened twice.
//   * Secrets come from the environment, are never written in plain text or logged; a rotated token pair is kept encrypted
//     (AES-256-GCM, key from the client secret) in ctrader/tokens.json.
//   * Phone alerts (best-effort, through council/alerts.mjs: ntfy + Telegram, the same NTFY_TOPIC / TELEGRAM_* settings as the
//     council's alerts) when a mirror order opens, closes, is rejected or is not filled. Sent after mirror.json is saved; a failed
//     alert never changes or stops the trading. Each is sent once (flags in the saved state), so a restart never re-alerts.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { sendAlerts, when, NTFY_DEFAULT } from './alerts.mjs';
import { writeAtomic } from './jsonio.mjs';   // state files: a killed run never leaves one cut short (the live runner's child timeout)

export const DEMO_HOST = 'wss://demo.ctraderapi.com:5036';
export const PT = {
  APP_AUTH_REQ: 2100, APP_AUTH_RES: 2101, ACCOUNT_AUTH_REQ: 2102, ACCOUNT_AUTH_RES: 2103,
  NEW_ORDER_REQ: 2106, CANCEL_ORDER_REQ: 2108, AMEND_POSITION_SLTP_REQ: 2110, CLOSE_POSITION_REQ: 2111, SYMBOLS_LIST_REQ: 2114, SYMBOLS_LIST_RES: 2115,
  SYMBOL_BY_ID_REQ: 2116, SYMBOL_BY_ID_RES: 2117, TRADER_REQ: 2121, TRADER_RES: 2122, RECONCILE_REQ: 2124, RECONCILE_RES: 2125,
  EXECUTION_EVENT: 2126, ORDER_ERROR_EVENT: 2132, OA_ERROR_RES: 2142, ACCOUNTS_BY_TOKEN_REQ: 2149, ACCOUNTS_BY_TOKEN_RES: 2150,
  REFRESH_TOKEN_REQ: 2173, REFRESH_TOKEN_RES: 2174, ERROR_RES: 50, HEARTBEAT: 51,
};
export const ALLOWED = new Set([PT.APP_AUTH_REQ, PT.ACCOUNTS_BY_TOKEN_REQ, PT.ACCOUNT_AUTH_REQ, PT.TRADER_REQ, PT.RECONCILE_REQ,
  PT.SYMBOLS_LIST_REQ, PT.SYMBOL_BY_ID_REQ, PT.REFRESH_TOKEN_REQ, PT.HEARTBEAT, PT.NEW_ORDER_REQ, PT.CANCEL_ORDER_REQ, PT.AMEND_POSITION_SLTP_REQ, PT.CLOSE_POSITION_REQ]);
export const AMEND_TRIES = 3;   // a stop move the broker keeps rejecting is given up after this many rounds (logged once)
// the council's pending-order validity when a trade carries no validFor (council/trader.mjs WAIT, kept in step)
export const WAIT = { '1d': 5 * 86400, '4h': 2 * 86400, '1h': 12 * 3600, '30m': 6 * 3600, '15m': 3 * 3600 };
export const validUntil = (t) => (+t.opened || 0) + (+t.validFor || WAIT[t.h] || 86400);
const NEED = ['CTRADER_CLIENT_ID', 'CTRADER_CLIENT_SECRET', 'CTRADER_ACCESS_TOKEN', 'CTRADER_REFRESH_TOKEN', 'CTRADER_ACCOUNT_ID', 'CTRADER_ENV'];
// council / ICT desk market -> broker symbol names to try, in order (Fusion Markets cTrader names first). The ICT desk signals on
// CME futures (NQ, ES, YM, RTY, GC); the demo trades the matching cash index / spot gold CFD: only the stop distance is copied,
// so the futures-cash basis does not matter.
export const SYMBOLS = { xau: ['XAUUSD'], eurusd: ['EURUSD'], gbpusd: ['GBPUSD'], audusd: ['AUDUSD'], usdcad: ['USDCAD'], usdchf: ['USDCHF'],
  btc: ['BTCUSD'], eth: ['ETHUSD'], sol: ['SOLUSD'], xrp: ['XRPUSD'],   // 8 Nov: the council's crypto paper trades too (CFDs at the broker)
  nq: ['US100', 'NAS100', 'USTEC'], es: ['US500', 'SPX500', 'US500.cash'], ym: ['US30', 'DJ30', 'US30.cash'], rty: ['US2000', 'RUSSELL2000'], gc: ['XAUUSD'] };
// the ICT desk's trades as mirror candidates: only its A-setups (the part that holds up after costs: research/edge/costs), with
// their own id space; everything else is treated like a shadow (never sent)
export const ictCandidates = (ict) => (Array.isArray(ict) ? ict : []).map((t) => ({ ...t, id: 'ict:' + t.id, k: 'ict-' + (t.aplus ? 'A+' : 'A'), shadow: !t.aset, rr: t.t1 == null ? 99 : t.rr }));
// The replica's forward paper trades (10 Nov, owner: "the mirror is not taking the replica trades"). The Trader records them in
// research.json (k 'replica', gold, forex and crypto), never in trades.json, which holds only the live gold replica; the mirror
// used to read trades.json and the ICT desk alone, so the Replica demo account stayed empty. They are candidates for the
// 'replica' book like any other trade (same stop rules, same limits). A record that is also in trades.json is taken from there
// (never twice); one whose own filter failed (`pass: false`) counts as a shadow, so config.json mirrorShadow: false leaves it out.
export const replicaCandidates = (research, have = []) => {
  const ids = new Set(), sigs = new Set(); for (const t of have || []) { if (!t) continue; ids.add(t.id); if (t.k === 'replica') sigs.add(`${t.market}|${t.side}|${t.opened}`); }
  return (Array.isArray(research) ? research : []).filter((t) => t && t.k === 'replica' && typeof t.id === 'string' && !ids.has(t.id) && !sigs.has(`${t.market}|${t.side}|${t.opened}`))
    .map((t) => ({ ...t, shadow: t.shadow === true || t.pass === false, research: true }));
};
// true only while the replica book trades on a different demo account from the council book
export const replicaHasOwnAccount = (byBook) => !!(byBook && byBook.replica && byBook.council && byBook.replica !== byBook.council);
// sizing (owner, 7 Nov: "risk-based lots, bigger demo", from research/portfolio.md): each order risks a share of the balance per 1R:
// ICT A-setups 0.20% x the desk's size field (A+ half-size trades 0.10%), Meridian 0.02%; total open risk at most 1%.
// The lot follows from the stop distance; below the broker's minimum lot the trade is skipped (never rounded up to more risk).
// Lot cap (owner, 7 Nov: "cap by risk, not lots"): a lot means very different things per symbol (1 US2000 lot = $1 a point, 1 gold lot
// = 100 oz), so a flat lot cap skipped normal-risk Russell trades on a $50k demo (18-point stop: 5.55 lots for $100). The risk caps
// above do the real limiting; a trade's margin (broker's marginPerLot from ctrader/symbols.json) may use at most maxMarginShare of the
// balance; maxLots stays only as the cap when that margin is unknown.
// 8 Nov (owner: mirror everything): maxOpen 5 -> 40, maxOpenRisk 1% -> 50% (minimum-lot orders on a ~$1,000 demo risk about 1% each),
// minLot fallback on, total margin of all open mirror positions at most 80% of the balance.
export const LIMITS = { lots: 0.01, maxLots: 5, maxMarginShare: 0.2, maxTotalMarginShare: 0.8, maxOpen: 40, dayStop: 0.02, retries: 3, keepDays: 30,
  risk: { ict: 0.002, council: 0.0002 }, maxOpenRisk: 0.5, minLot: true, maxMinLotRisk: 0.02, maxDriftR: 1, markMaxAge: 30 * 60, pause: 10 * 60, settle: 20 * 60 };   // settle: market orders wait this long after the last "market closed" answer (>= ~10 min after the real open)
const LABEL = 'council';
const OPEN = new Set(['open']), isDone = (t) => !!t.status && t.status !== 'open' && t.status !== 'pending';
// the order comment is also the key that finds our position at the broker again (ProtoOATradeData.label + comment)
export const commentFor = (t) => `${String(t.id).startsWith('ict:') ? 'ict' : 'council'} ${t.k} ${t.id}`.slice(0, 100);
export const normName = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9.]/g, '');   // "EUR/USD" (the proto's own example) == "EURUSD"
// broker answers meaning "not now" (the order was certainly not placed): retried while the trade is still fresh. Timeouts and
// dropped connections are NOT retried (the order may have gone through); step 0 finds such a position next round.
const RETRY = /MARKET_CLOSED|SYMBOL_HAS_HOLIDAY|NO_QUOTES|SERVER_IS_UNDER_MAINTENANCE|CH_SERVER_NOT_REACHABLE|REQUEST_FREQUENCY_EXCEEDED|TRADING_DISABLED|not tradable now/;
// session errors with no broker answer behind them (session() below): the order's outcome is unknown
const UNSURE = /^timeout waiting|connection closed|session closed/;
// "not now" answers that are nobody's fault and never count as a try: the symbol is paused LIMITS.pause seconds, the trade waits
const PAUSE = /MARKET_CLOSED|SYMBOL_HAS_HOLIDAY|NO_QUOTES|not tradable now/;
// the council's latest price of a market (marks: { market: price | { price, at } }), null when unknown or older than LIMITS.markMaxAge
export function markOf(marks, market, now) {
  const m = marks && marks[market], px = m != null && typeof m === 'object' ? +m.price : +m, at = m != null && typeof m === 'object' ? m.at : null;
  if (!(px > 0)) return null;
  const t = at == null ? null : typeof at === 'number' ? (at > 1e11 ? at / 1000 : at) : Date.parse(at) / 1000;
  return t != null && Number.isFinite(t) && now - t > LIMITS.markMaxAge ? null : px;
}

// ---- secrets ------------------------------------------------------------------------------------------------------
// scrub(text) hides the configured secrets; scrub.add(...) also hides tokens learnt later (the stored or rotated pair), so a
// broker error that repeats one never reaches the published mirror.json / test.json / suite.json
export function scrubber(env) {
  const vals = [];
  const scrub = (s) => { let t = String(s == null ? '' : s); for (const v of vals) t = t.split(v).join('[redacted]'); return t.slice(0, 300); };
  scrub.add = (...xs) => { for (const v of xs) if (v && String(v).length >= 6 && !vals.includes(String(v))) vals.push(String(v)); vals.sort((a, b) => b.length - a.length); };
  scrub.add(...NEED.map((k) => env[k]));
  return scrub;
}
const baseOf = (env) => crypto.createHash('sha256').update(`${env.CTRADER_REFRESH_TOKEN}|base`).digest('hex').slice(0, 16);   // kept sealed only
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
// ProtoOAExecutionType (OpenApiModelMessages.proto). The JSON API sends enums as numbers; names are accepted too.
export const EXEC = { ORDER_ACCEPTED: 2, ORDER_FILLED: 3, ORDER_REPLACED: 4, ORDER_CANCELLED: 5, ORDER_EXPIRED: 6, ORDER_REJECTED: 7, ORDER_CANCEL_REJECTED: 8, ORDER_PARTIAL_FILL: 11 };
const execType = (v) => (typeof v === 'number' ? v : EXEC[v] != null ? EXEC[v] : Number(v));
// A NEW_ORDER / CLOSE_POSITION request is answered by SEVERAL execution events carrying its clientMsgId: ORDER_ACCEPTED (validated,
// not filled yet), then ORDER_FILLED, or ORDER_REJECTED / CANCELLED / EXPIRED, or an ORDER_ERROR_EVENT. Wait past ACCEPTED for the
// outcome; a rejection inside an execution event is an error, not a success.
export function orderStep(p) {
  const x = execType(p.executionType);
  if (x === EXEC.ORDER_ACCEPTED) return 'wait';
  if ([EXEC.ORDER_REJECTED, EXEC.ORDER_CANCELLED, EXEC.ORDER_EXPIRED, EXEC.ORDER_CANCEL_REJECTED].includes(x)) {
    const e = new Error(String(p.errorCode || Object.keys(EXEC).find((k) => EXEC[k] === x))); e.code = p.errorCode || ''; return e;
  }
  return 'done';
}
// a LIMIT order is done once ACCEPTED (it rests; a fill, if the price is already there, shows up as a position next round)
export function pendingStep(p) {
  const x = execType(p.executionType);
  if ([EXEC.ORDER_REJECTED, EXEC.ORDER_CANCELLED, EXEC.ORDER_EXPIRED, EXEC.ORDER_CANCEL_REJECTED].includes(x)) {
    const e = new Error(String(p.errorCode || Object.keys(EXEC).find((k) => EXEC[k] === x))); e.code = p.errorCode || ''; return e;
  }
  return 'done';
}
// a CANCEL is done at ORDER_CANCELLED; CANCEL_REJECTED (the order filled or is gone meanwhile) is an error; anything else: keep waiting
export function cancelStep(p) {
  const x = execType(p.executionType);
  if (x === EXEC.ORDER_CANCELLED) return 'done';
  if ([EXEC.ORDER_CANCEL_REJECTED, EXEC.ORDER_REJECTED].includes(x)) { const e = new Error(String(p.errorCode || 'ORDER_CANCEL_REJECTED')); e.code = p.errorCode || 'ORDER_CANCEL_REJECTED'; return e; }
  return 'wait';
}
// an SL/TP amendment is done on any non-error execution event (the broker answers ORDER_REPLACED or ORDER_ACCEPTED for the
// protective orders); REJECTED / CANCEL_REJECTED is an error
export function amendStep(p) {
  const x = execType(p.executionType);
  if ([EXEC.ORDER_REJECTED, EXEC.ORDER_CANCEL_REJECTED].includes(x)) { const e = new Error(String(p.errorCode || 'ORDER_REJECTED')); e.code = p.errorCode || ''; return e; }
  return 'done';
}
export function session(WS, scrub, url = DEMO_HOST, { timeout = 10000 } = {}) {
  if (url !== DEMO_HOST) throw new Error('refusing a non-demo host');
  const ws = new WS(url), waiting = new Map();
  let n = 0, beat, closed = false;
  const opened = new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = () => fail(new Error('could not reach the cTrader demo server')); });
  // a request that already had an interim answer (ORDER_ACCEPTED) resolves with it, flagged interim, instead of failing on timeout/close
  const finish = (id, w, why) => { waiting.delete(id); clearTimeout(w.t); if (w.interim) w.ok({ ...w.interim, interim: true }); else w.fail(new Error(why)); };
  const drop = (id, w) => { waiting.delete(id); clearTimeout(w.t); };
  ws.onmessage = (ev) => {
    let m; try { m = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data)); } catch (e) { return; }
    const w = m.clientMsgId && waiting.get(m.clientMsgId); if (!w) return;   // spontaneous events (heartbeats, other fills) are ignored
    if (m.payloadType === PT.OA_ERROR_RES || m.payloadType === PT.ERROR_RES || m.payloadType === PT.ORDER_ERROR_EVENT) {
      drop(m.clientMsgId, w);
      const p = m.payload || {}; const e = new Error(scrub(`${p.errorCode || 'ERROR'}: ${p.description || ''}`)); e.code = p.errorCode; w.fail(e);
    } else if (w.expect && m.payloadType !== w.expect) { drop(m.clientMsgId, w); w.fail(new Error(`unexpected reply ${m.payloadType}`)); }
    else {
      const p = m.payload || {}, r = w.step ? w.step(p) : 'done';
      if (r === 'wait') { w.interim = p; return; }   // keep waiting: the fill (or the rejection) follows with the same clientMsgId
      drop(m.clientMsgId, w);
      if (r instanceof Error) { const e = new Error(scrub(r.message)); e.code = r.code; w.fail(e); } else w.ok(p);
    }
  };
  ws.onclose = () => { clearInterval(beat); for (const [id, w] of [...waiting]) finish(id, w, 'connection closed'); };
  async function send(payloadType, payload, expect, step) {
    if (!ALLOWED.has(payloadType)) throw new Error(`blocked: message ${payloadType} is not allowed`);
    if (closed) throw new Error('session closed');
    await opened;
    const clientMsgId = `m${++n}`;
    return new Promise((ok, fail) => {
      const w = { ok, fail, expect, step };
      w.t = setTimeout(() => finish(clientMsgId, w, `timeout waiting for ${expect}`), timeout);
      waiting.set(clientMsgId, w);
      ws.send(JSON.stringify({ clientMsgId, payloadType, payload }));
    });
  }
  opened.then(() => { if (closed) return; beat = setInterval(() => { try { ws.send(JSON.stringify({ payloadType: PT.HEARTBEAT, payload: {} })); } catch (e) {} }, 10000); }).catch(() => {});
  return { send, close: () => { closed = true; clearInterval(beat); try { ws.close(); } catch (e) {} } };
}

// ---- sizing ---------------------------------------------------------------------------------------------------------
// cTrader volume is in hundredths of a unit; lotSize is the volume of one lot. 0.01 lot, rounded to the step, at least the minimum.
// No lotSize (optional in ProtoOASymbol) -> null: guessing the forex lot (10,000,000) would make an index order 1,000 contracts.
// A minimum above LIMITS.maxLots -> null too: never more than 0.1 lot just because the broker's minimum is large.
export function volumeFor(sym, lots = LIMITS.lots, maxLots = 0.1) {   // fixed-lot helper (demo test order/suite): capped at 0.1 lot
  const lot = +sym.lotSize; if (!(lot > 0)) return null;
  const step = +sym.stepVolume || 1, min = +sym.minVolume || step;
  let v = Math.round((lot * lots) / step) * step;
  if (v < min) v = min;
  if (sym.maxVolume && v > +sym.maxVolume) v = +sym.maxVolume;
  return v > lot * maxLots + 1e-9 ? null : v;
}
// What one unit of the symbol's quote currency is worth in the account currency (the currency of the balance the risk is taken
// from). cTrader values a position as volume/100 units x the price move, in the quote currency: there is no other contract-size
// field in ProtoOASymbol, and the demo's own closed deals agree (BTCUSD 0.01 lot, 17.68 move: 0.18 USD gross; SOLUSD 0.01 lot,
// 0.198 move: 1.98 USD with its 1,000-unit lot). spec = the symbol's entry in ctrader/symbols.json (council/ctrader-symbols.mjs:
// the broker's own base / quote asset names, the account currency in `deposit`, and quoteToDeposit from the broker's quotes along
// its conversion chain). Without a spec (file not written yet) the old rule, right for a USD account only: USD-quoted 1, USD-base
// FX pairs 1/price, anything else (a USD-less cross) refused. Returns { rate, src } or null.
export const RATE_MAX_AGE = 3 * 86400;   // a broker conversion rate older than this is not used
export function quoteRate({ name, px, spec = null, now = Math.floor(Date.now() / 1000) }) {
  if (spec && spec.quote && spec.deposit) {
    const q = String(spec.quote).toUpperCase(), d = String(spec.deposit).toUpperCase(), b = String(spec.base || '').toUpperCase();
    if (q === d) return { rate: 1, src: 'broker' };
    if (b === d && px > 0) return { rate: 1 / px, src: 'broker' };   // e.g. USDCAD on a USD account: 1 CAD = 1/price USD, at the trade's own price
    const r = +spec.quoteToDeposit, at = Date.parse(spec.rateAt || '') / 1000;
    if (r > 0 && Number.isFinite(at) && now - at <= RATE_MAX_AGE) return { rate: r, src: 'broker quotes' };
    return null;
  }
  const N = String(name || '').toUpperCase(), fx = /^[A-Z]{6}$/.test(N) && !/^XA[UG]/.test(N);
  const rate = !fx || N.slice(3) === 'USD' ? 1 : N.slice(0, 3) === 'USD' && px > 0 ? 1 / px : null;
  return rate ? { rate, src: 'assumed USD' } : null;
}
// ctrader/symbols.json -> the spec quoteRate() wants for one broker symbol (null when the file has none)
export function specFor(file, name) {
  const s = file && file.symbols && file.symbols[name], d = file && file.account && file.account.currency;
  return s && d ? { ...s, deposit: d } : null;
}
// risk-based volume: one lot moves lotSize/100 units x the stop distance (quote currency), converted to the account currency by
// quoteRate(). Returns { volume, riskCash, lots, perLot } (perLot: account currency lost at the stop per lot) or { skip: reason }.
export function riskVolume({ info, t, balance, name, openRisk = 0, openMargin = 0, spec = null, now, minLot = LIMITS.minLot }) {
  const lot = +info.lotSize, dist = Math.abs(+t.entry - +t.stop), px = Math.abs(+t.entry);
  if (!(lot > 0)) return { skip: `${name}: no lot size` };
  if (!(dist > 0) || !(balance > 0)) return { skip: `${name}: no stop distance or balance` };
  const qr = quoteRate({ name, px, spec, now }), toAcc = qr && qr.rate;
  if (!toAcc) return { skip: `${name}: cannot value its quote currency${spec && spec.quote ? ` (${spec.quote})` : ''} in the account currency${spec && spec.deposit ? ` (${spec.deposit})` : ''}` };
  const isIct = String(t.id).startsWith('ict:'), size = isIct && Number.isFinite(+t.size) && +t.size > 0 ? +t.size : 1;
  let riskCash = balance * (isIct ? LIMITS.risk.ict : LIMITS.risk.council) * size;
  const perLot = (lot / 100) * dist * toAcc, lots = riskCash / perLot;
  const step = +info.stepVolume || 1, min = +info.minVolume || step;
  let v = Math.floor((lots * lot) / step + 1e-9) * step, atMin = false;   // epsilon: 0.01 lot must not floor to 0 on float noise
  if (v < min) {
    if (!minLot) return { skip: `${name}: ${lots.toFixed(4)} lot needed for ${(riskCash).toFixed(2)} risk is below the broker minimum (${min / lot} lot); a bigger demo balance fixes this` };
    v = min; atMin = true; riskCash = perLot * (min / lot);   // the minimum lot: its real risk is what counts against the open-risk cap
    if (riskCash > balance * LIMITS.maxMinLotRisk + 1e-9) return { skip: `${name}: even the minimum lot (${min / lot}) risks ${riskCash.toFixed(2)}, ${(riskCash / balance * 100).toFixed(1)}% of the balance (cap ${LIMITS.maxMinLotRisk * 100}%); a bigger demo balance fixes this`, retry: true };
  }
  // capacity answers (retry: true) are tried again next round: the account or the open book may have changed
  if (openRisk + riskCash > balance * LIMITS.maxOpenRisk + 1e-9) return { skip: `open risk would pass ${LIMITS.maxOpenRisk * 100}% of the balance${atMin ? ` (${name} at the minimum lot risks ${riskCash.toFixed(2)})` : ''}`, retry: true };
  if (info.maxVolume && v > +info.maxVolume) return { skip: `${name}: ${(v / lot).toFixed(2)} lot is above the broker maximum (${+info.maxVolume / lot} lot)` };
  const mpl = spec && +spec.marginPerLot > 0 ? +spec.marginPerLot : null, margin = mpl ? (v / lot) * mpl : null;
  if (mpl && openMargin + margin > balance * LIMITS.maxTotalMarginShare + 1e-9) return { skip: `${name}: ${margin.toFixed(2)} margin would take all open mirror positions over ${LIMITS.maxTotalMarginShare * 100}% of the balance`, retry: true };
  if (mpl && margin > balance * LIMITS.maxMarginShare + 1e-9) return { skip: `${name}: ${(v / lot).toFixed(2)} lot would use ${margin.toFixed(2)} margin, over ${LIMITS.maxMarginShare * 100}% of the balance` };
  if (!mpl && v > lot * LIMITS.maxLots + 1e-9) return { skip: `${name}: ${(v / lot).toFixed(2)} lot is above the ${LIMITS.maxLots}-lot cap (the broker's margin is not known)` };
  return { volume: v, riskCash: +riskCash.toFixed(2), lots: +(v / lot).toFixed(4), perLot: +perLot.toFixed(4), ...(atMin ? { minLot: true } : {}), ...(margin != null ? { margin: +margin.toFixed(2) } : {}) };
}
// owner reset (council/ctrader-reset.json { at }): the owner closed every demo position by hand and wants the book copied afresh, so
// the saved record of the copied trades, the skip/wait notes, the pauses and the day's start balance are dropped once per `at`.
// Positions still open at the broker under the mirror's label are adopted again by the next round (never opened twice).
export function applyReset(state, reset, now = Math.floor(Date.now() / 1000)) {
  const at = reset && reset.at; if (!at || !state || state.resetAt === at) return { state, applied: false };
  const dropped = Object.keys(state.map || {}).length;
  return { applied: true, dropped, state: { ...state, map: {}, skipped: {}, wait: {}, paused: {}, day: null, resetAt: at, resetDoneAt: new Date(now * 1000).toISOString() } };
}
// every trade id an account's saved state has copied, whatever became of the copy (open, sent, closed at the broker, not filled), or
// rests a limit order for: another account never opens these (bug hunt 9 Nov: only open / sent ones were excluded, so four trades
// the base account had copied and seen stopped at the broker were opened and lost a second time on the shadow account, 8 Nov)
// ICT futures roll (bug hunt 9 Nov): on a contract switch ict/tracker.mjs shiftTrade moves every level of an open trade by the
// offset (often 0.5-1.5% of the price) and appends { at, by } to `rolled`. The demo trades the cash CFD, which did not move: before,
// step 2c moved the broker stop by the whole offset (a sell's stop loosened by it, a buy's pushed up to or past the price). The
// copy's saved council levels (stop, t1, councilEntry) take each roll once; `rollsSeen` counts the ones taken (a copy saved before
// this code takes only the rolls after its open).
export function absorbRolls(m, t) {
  const rolls = Array.isArray(t && t.rolled) ? t.rolled : [];
  if (m.rollsSeen == null) { const since = Date.parse(m.openedAt) / 1000; m.rollsSeen = Number.isFinite(since) ? rolls.filter((x) => !(+x.at > since)).length : rolls.length; }
  if (rolls.length <= m.rollsSeen) return 0;
  const by = rolls.slice(m.rollsSeen).reduce((a, x) => a + (Number.isFinite(+x.by) ? +x.by : 0), 0);
  for (const k of ['stop', 't1', 'councilEntry']) if (m[k] != null && Number.isFinite(+m[k])) m[k] = +(+m[k] + by).toFixed(6);
  m.rollsSeen = rolls.length; m.rolledBy = +((+m.rolledBy || 0) + by).toFixed(6);
  return by;
}
// a resting limit whose council order changed its levels since it was placed: the reason to cancel it, else null
export function requoted(o, t) {
  const d = Number.isFinite(+o.digits) ? +o.digits : 5, tick = 0.5 * 10 ** -d, num = (v) => v != null && v !== '' && Number.isFinite(+v);
  const moved = (a, b) => (num(a) !== num(b)) || (num(a) && num(b) && Math.abs(+a - +b) >= tick);
  if (moved(o.limitPrice, num(t.entry) ? +(+t.entry).toFixed(d) : null)) return `the council re-quoted the order (entry ${o.limitPrice} -> ${t.entry})`;
  if (moved(o.stop, t.stop)) return `the council re-quoted the order (stop ${o.stop} -> ${t.stop})`;
  if (o.t1 !== undefined && moved(o.t1, t.t1)) return `the council re-quoted the order (target ${o.t1} -> ${t.t1})`;
  return null;
}
export const copiedIds = (state) => new Set([...Object.keys((state && state.map) || {}), ...Object.keys((state && state.orders) || {})]);
// ---- books and accounts (8 Nov, owner: "4 extra accounts, one for the shadow trades, the other LIT") -----------------------------
// Every trade belongs to one book; each book can have its own demo account (same cTrader ID, same token). Account numbers are
// not secrets: council-data config.json { mirrorAccounts: { council, ict, shadow, lit } }, or the env CTRADER_ACCOUNTS
// "council:123,ict:456,shadow:789,lit:321,replica:654" (wins). A book without its own number trades on CTRADER_ACCOUNT_ID.
export const BOOKS = ['council', 'ict', 'shadow', 'lit', 'replica'];
export const bookOf = (t) => (String(t.id).startsWith('ict:') ? 'ict' : t.k === 'lit' ? 'lit' : t.k === 'replica' ? 'replica' : t.shadow ? 'shadow' : 'council');
export function accountsFor(env, cfg) {
  const out = {}, base = String(env.CTRADER_ACCOUNT_ID || '').trim();
  const c = (cfg && cfg.mirrorAccounts) || {}; for (const b of BOOKS) if (c[b] != null && String(c[b]).trim()) out[b] = String(c[b]).trim();
  for (const part of String(env.CTRADER_ACCOUNTS || '').split(',')) { const [b, id] = part.split(':').map((x) => (x || '').trim()); if (BOOKS.includes(b) && id) out[b] = id; }
  for (const b of BOOKS) if (!out[b]) out[b] = base;
  // group the books by account: one session and one state per account
  const groups = new Map(); for (const b of BOOKS) { if (!out[b]) continue; const g = groups.get(out[b]) || { account: out[b], books: [] }; g.books.push(b); groups.set(out[b], g); }
  return { byBook: out, groups: [...groups.values()] };
}
// relative stop/target for a market order: in 1/100000 of the price, a multiple of the symbol's smallest step
export function relative(dist, digits = 5) {
  const unit = 10 ** Math.max(0, 5 - digits);
  return Math.max(unit, Math.round((Math.abs(dist) * 100000) / unit) * unit);
}

// ---- phone alerts ---------------------------------------------------------------------------------------------------
// mirrorRound collects short events in out.alerts: { kind: 'open' | 'close' | 'reject' | 'unfilled' | 'closefail', trade, symbol,
// side, lots, price, digits, ... }. Position events are flagged on the saved position (m.alerted), a rejection comes with its
// one-time skip note, so each is sent once, also after a restart. A position found again by label/comment (its round never
// saved) gets no open alert: that round may already have sent it; its close still alerts. An order that got no answer at all is
// not alerted as rejected; if its position turns up next round, that round sends the open alert.
const px = (v, d) => (v == null || v === '' || !Number.isFinite(+v) ? null : d != null && Number.isFinite(+d) ? (+v).toFixed(+d) : String(+v));
const sideTxt = (e) => String(e.side || '').toUpperCase(), lotTxt = (e) => (e.lots != null && Number.isFinite(+e.lots) ? ` ${+(+e.lots).toFixed(2)} lot` : '');
const councilTxt = (e) => (e.setup ? `Council ${e.setup} · ${e.trade}` : String(e.trade || ''));
const rTxt = (r) => (r == null || !Number.isFinite(+r) ? '' : ` ${+r > 0 ? '+' : ''}${(+r).toFixed(2)}R`);
export function mirrorAlertText(e, now) {
  const t = mirrorAlertText0(e, now); if (t && e && e.book) t.title = t.title.replace(/^Demo mirror/, `Demo mirror [${e.book}]`); return t;
}
function mirrorAlertText0(e, now) {
  const head = `${sideTxt(e)} ${e.symbol || ''}`.trim(), at = when(now), up = e.side === 'sell' ? 'chart_with_downwards_trend' : 'chart_with_upwards_trend';
  if (e.kind === 'open') {
    const p = px(e.price, e.digits), lv = [px(e.entry, e.digits) && `council entry ${px(e.entry, e.digits)}`, px(e.stop, e.digits) && `stop ${px(e.stop, e.digits)}`,
      e.noTarget || px(e.t1, e.digits) == null ? 'no fixed target' : `target ${px(e.t1, e.digits)}`].filter(Boolean).join(' · ');
    return { title: `Demo mirror: ${head}${lotTxt(e)}`, msg: `${e.filled === false ? 'Order accepted, fill not confirmed yet' : `${e.viaLimit ? 'Limit filled' : 'Opened'}${p ? ` at ${p}` : ''}`} · ${lv}\n${councilTxt(e)}\n${at}`, tags: `robot,${up}` };
  }
  if (e.kind === 'close') {
    const p = px(e.price, e.digits), pl = e.pnl != null && Number.isFinite(+e.pnl) ? `gross P/L ${+e.pnl >= 0 ? '+' : ''}${(+e.pnl).toFixed(2)}` : '';
    const why = e.by === 'council' ? `The council closed the trade${e.council ? `: ${e.council}${rTxt(e.R)}` : ''}` : 'Closed at the broker (its stop or target)';
    const good = e.pnl != null ? +e.pnl : e.R != null ? +e.R : NaN, top = [p && `Closed at ${p}`, pl].filter(Boolean).join(' · ');
    return { title: `Demo mirror: closed ${head}${lotTxt(e)}`, msg: `${top ? top + '\n' : ''}${why}\n${councilTxt(e)}\n${at}`,
      tags: `robot,${good > 0 ? 'white_check_mark' : good < 0 ? 'x' : 'checkered_flag'}` };
  }
  if (e.kind === 'pending') {
    const lv = [px(e.stop, e.digits) && `stop ${px(e.stop, e.digits)}`, e.noTarget || px(e.t1, e.digits) == null ? 'no fixed target' : `target ${px(e.t1, e.digits)}`].filter(Boolean).join(' · ');
    return { title: `Demo mirror: limit placed · ${head}${lotTxt(e)}`, msg: `Resting at ${px(e.price, e.digits)} · ${lv}${e.expires ? ` · valid to ${String(e.expires).slice(0, 16)}Z` : ''}\nFills on the same touch as the council.\n${councilTxt(e)}\n${at}`, tags: `robot,hourglass_flowing_sand` };
  }
  if (e.kind === 'amend') return { title: `Demo mirror: stop moved · ${head}${lotTxt(e)}`, msg: `Stop ${px(e.stopFrom, e.digits) ?? '—'} → ${px(e.stop, e.digits)}${e.t1 != null ? ` · target ${px(e.t1From, e.digits) ?? '—'} → ${px(e.t1, e.digits)}` : ''}${e.brokerStop != null && px(e.brokerStop, e.digits) !== px(e.stop, e.digits) ? ` (broker stop ${px(e.brokerStop, e.digits)})` : ''}\n${e.why || 'the council moved its levels'}\n${councilTxt(e)}\n${at}`, tags: 'robot,shield' };
  if (e.kind === 'cancel') return { title: `Demo mirror: limit cancelled · ${head}${lotTxt(e)}`, msg: `${e.reason || 'cancelled'}${e.council === 'open' ? ' (a market order follows)' : ''}\n${councilTxt(e)}\n${at}`, tags: 'robot,wastebasket' };
  if (e.kind === 'reject') return { title: `Demo mirror: order rejected · ${head}${lotTxt(e)}`, msg: `${e.result || 'rejected'}\nNot retried.\n${councilTxt(e)}\n${at}`, tags: 'robot,no_entry_sign' };
  if (e.kind === 'unfilled') return { title: `Demo mirror: order not filled · ${head}`, msg: `No position at the broker 10 min after the order was accepted.\n${councilTxt(e)}\n${at}`, tags: 'robot,no_entry_sign' };
  if (e.kind === 'summary') return { title: `Demo mirror: ${e.n} orders this round`, msg: `${e.opens} opened, ${e.closes} closed, ${e.other} other events${e.catchUp ? ' (catch-up of the council\'s open trades, shadows included)' : ''}. Details in Council → Desk & mirror.\n${when(now)}`, tags: 'robot,package' };
  if (e.kind === 'closefail') return { title: `Demo mirror: close failed · ${head}${lotTxt(e)}`, msg: `${e.result || 'close failed'}\nThe council closed the trade; the demo position is still open (the close is retried each round).\n${councilTxt(e)}\n${at}`, tags: 'robot,warning' };
  return null;
}
// Sends the round's events through the council's alert channel. Never throws; returns { sent, errors } with secrets scrubbed.
// COUNCIL_ALERTS=off sends nothing (as for the council's own alerts).
export async function sendMirrorAlerts(alerts, { env = {}, now = Math.floor(Date.now() / 1000), tgChat = null, fetchFn = fetch } = {}) {
  const errors = {};
  try {
    if (!Array.isArray(alerts) || !alerts.length || env.COUNCIL_ALERTS === 'off') return { sent: 0, errors };
    const ev = [];
    for (const a of alerts) { try { const x = mirrorAlertText(a, now); if (x) ev.push(x); } catch (e) { errors.format = 'an alert could not be formatted'; } }
    if (!ev.length) return { sent: 0, errors };
    const topic = env.NTFY_TOPIC || NTFY_DEFAULT, tgTok = env.TELEGRAM_BOT_TOKEN || null, chat = env.TELEGRAM_CHAT_ID || tgChat || null;
    const hide = [tgTok, chat, env.NTFY_TOPIC].filter((v) => v && String(v).length >= 4).map(String), scrub = scrubber(env);
    for (const [k, v] of Object.entries(await sendAlerts(ev, { topic, tgTok, tgChat: chat, fetchFn }))) { let t = scrub(v); for (const h of hide) t = t.split(h).join('***'); errors[k] = t; }
    return { sent: Math.min(ev.length, 8), errors };
  } catch (e) { errors.alerts = 'alert send failed'; return { sent: 0, errors }; }
}

// ---- one mirror round -----------------------------------------------------------------------------------------------
const TOKEN_ERR = /ACCESS_TOKEN|INVALID_TOKEN|TOKEN_EXPIRED|CH_ACCESS_TOKEN_INVALID|NOT_AUTHORIZED|UNAUTHORIZED/i;
// execution quality (7 Nov): how the demo fill compares with the council's paper entry. slipR > 0 means a worse fill than the
// council assumed, in units of the trade's risk (entry to stop); lagSec is the time from the council's fill to the demo order.
// The ICT desk's prices are CME futures (NQ / ES / YM / RTY / GC) while the demo fills the cash index / spot gold CFD: fill - entry
// there is the futures-cash basis (often several R), not slippage, so those fills keep the price and the delay only.
const otherInstrument = (t) => String(t.id).startsWith('ict:');
export function fillQuality(t, price, now) {
  const px = +price, risk = Math.abs(t.entry - t.stop);
  if (!(px > 0) || !(risk > 0)) return {};
  const sign = t.side === 'sell' ? -1 : 1, when = t.filled || t.opened, lagSec = Number.isFinite(+when) ? Math.max(0, Math.round(now - when)) : null;
  if (otherInstrument(t)) return { fillPrice: px, lagSec };
  return { fillPrice: px, slipR: +((sign * (px - t.entry)) / risk).toFixed(3), lagSec };
}
export function executionStats(map, { since = 0 } = {}) {
  const all = Object.values(map || {}).filter((m) => (Date.parse(m.openedAt) / 1000 || 0) >= since);
  const F = all.filter((m) => m.slipR != null && Number.isFinite(+m.slipR));
  // the delay of every recorded fill (ICT desk fills too); a missing delay is left out, not counted as 0 s
  const lag = all.filter((m) => m.lagSec != null && Number.isFinite(+m.lagSec) && (m.fillPrice != null || m.slipR != null)).map((m) => +m.lagSec).sort((a, b) => a - b);
  const med = (a) => (a.length ? (a.length % 2 ? a[a.length >> 1] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2) : null);
  if (!F.length) return lag.length ? { n: 0, medianLagSec: med(lag) } : { n: 0 };
  const sl = F.map((m) => +m.slipR).sort((a, b) => a - b);
  const by = {}; for (const m of F) { const k = m.symbol; (by[k] = by[k] || []).push(+m.slipR); }
  return { n: F.length, meanSlipR: +(sl.reduce((a, b) => a + b, 0) / sl.length).toFixed(3), medianSlipR: +med(sl).toFixed(3), worstSlipR: sl[sl.length - 1],
    medianLagSec: lag.length ? med(lag) : null, bySymbol: Object.fromEntries(Object.entries(by).map(([k, a]) => [k, { n: a.length, meanSlipR: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(3) }])) };
}

// openBooks: only trades of these books are opened here (every trade is still managed: closes, stop moves, cancels for what this
// account already holds, so a book moved to another account hands over without orphans); exclude: ids another account holds
// (never opened twice across accounts)
export async function mirrorRound({ env, trades, state, tokens, specs = null, WS = globalThis.WebSocket, now = Math.floor(Date.now() / 1000), timeout, onTokens, slWaitMs = 1500, shadows = true, marks = null, openBooks = null, exclude = null }) {
  const scrub = scrubber(env), log = [], say = (msg, x = {}) => log.push({ at: new Date(now * 1000).toISOString(), msg: scrub(msg), ...x });
  const st = { map: {}, day: null, startedAt: null, ...(state || {}) };
  const out = { state: st, tokens: tokens || null, log, sent: [], alerts: [] };
  // phone alert events (see mirrorAlertText): collected only, sent by the caller; never allowed to throw into the trading, so the
  // extra fields come as a function evaluated in here
  const alert = (kind, id, m, extra) => { try {
    if (m && Array.isArray(m.alerted) && m.alerted.includes(kind)) return;
    const x = typeof extra === 'function' ? extra() : extra || {}, t = Array.isArray(trades) ? trades.find((y) => y && y.id === id) : null;
    out.alerts.push({ kind, trade: id, symbol: m ? m.symbol : null, side: m ? m.side : null, lots: m ? m.lots ?? null : null, digits: m ? m.digits ?? null : null,
      setup: (m && m.setup) || (t && t.k) || null, ...x });
    if (m) (Array.isArray(m.alerted) ? m.alerted : (m.alerted = [])).push(kind);
  } catch (e) {} };
  if (String(env.CTRADER_MIRROR || '').trim().toLowerCase() !== 'on') { st.status = `off (CTRADER_MIRROR is ${env.CTRADER_MIRROR ? `"${String(env.CTRADER_MIRROR).trim().slice(0, 8)}", not "on"` : 'not set'})`; return out; }
  const missing = NEED.filter((k) => !env[k]);
  if (missing.length) { st.status = `not configured: ${missing.join(', ')} missing`; return out; }
  if (String(env.CTRADER_ENV).trim().toLowerCase() !== 'demo') { st.status = 'refused: CTRADER_ENV must be "demo"'; return out; }
  if (!WS) { st.status = 'no WebSocket in this runtime'; return out; }
  const accountId = Number(String(env.CTRADER_ACCOUNT_ID).trim());
  if (!st.startedAt) st.startedAt = new Date(now * 1000).toISOString();   // trades before the mirror existed are never copied

  let tok = { accessToken: env.CTRADER_ACCESS_TOKEN, refreshToken: env.CTRADER_REFRESH_TOKEN };
  // the stored (rotated) pair wins, unless the owner has since configured a new pair (re-authorised): then the configured one is used
  if (tokens) { try { const t = unseal(tokens, env); scrub.add(t.accessToken, t.refreshToken); if (t.accessToken && t.refreshToken) { if (t.base && t.base !== baseOf(env)) say('new tokens configured; stored ones ignored'); else tok = t; } } catch (e) { say('stored tokens unreadable; using the configured ones'); } }

  const s = session(WS, scrub, DEMO_HOST, timeout ? { timeout } : {});
  try {
    await s.send(PT.APP_AUTH_REQ, { clientId: env.CTRADER_CLIENT_ID, clientSecret: env.CTRADER_CLIENT_SECRET }, PT.APP_AUTH_RES);
    let list;
    try { list = await s.send(PT.ACCOUNTS_BY_TOKEN_REQ, { accessToken: tok.accessToken }, PT.ACCOUNTS_BY_TOKEN_RES); }
    catch (e) {
      if (!TOKEN_ERR.test(String(e.code || e.message))) throw e;
      const r = await s.send(PT.REFRESH_TOKEN_REQ, { refreshToken: tok.refreshToken }, PT.REFRESH_TOKEN_RES);
      scrub.add(r.accessToken, r.refreshToken);
      if (!r.accessToken || !r.refreshToken) throw new Error('token refresh returned no tokens');
      tok = { accessToken: r.accessToken, refreshToken: r.refreshToken, rotatedAt: new Date(now * 1000).toISOString(), base: baseOf(env) };
      out.tokens = seal(tok, env); say('access token refreshed (stored encrypted)');
      // the old refresh token is spent now: persist the new pair at once, not only at the end of the round (a cancelled job loses it)
      if (onTokens) { try { onTokens(out.tokens); } catch (e) { say('could not store the refreshed tokens'); } }
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
    if (st.day.startBalance == null && balance != null) st.day.startBalance = balance;   // first readable balance of the day
    const rc = await s.send(PT.RECONCILE_REQ, { ctidTraderAccountId: ctid }, PT.RECONCILE_RES);
    const positions = new Map((rc.position || []).map((p) => [String(p.positionId), p]));
    const bOrders = new Map((rc.order || []).map((o) => [String(o.orderId), o]));   // pending orders resting at the broker
    const iso = new Date(now * 1000).toISOString(), byId = new Map(trades.map((t) => [t.id, t]));
    st.orders = st.orders || {};   // the mirror's own resting LIMIT orders, by council trade id
    const PAUSE_KEY = (name, pending) => (pending ? `${name}:pending` : name);
    const skipT = (t, why) => { (st.skipped = st.skipped || {})[t.id] = why; if (st.wait) delete st.wait[t.id]; say(`not mirrored ${t.id}: ${why}`, { trade: t.id }); };
    // "not now" answers: tried again next round for as long as the trade is open or pending. Only a counted answer (count: a broker
    // rejection that is not a closed market) can run out of tries, LIMITS.retries in all; a repeat of the same reason is not logged again
    const laterT = (t, why, count = false) => { const w = (st.wait || {})[t.id] || { n: 0 }, n = w.n + (count ? 1 : 0); (st.wait = st.wait || {})[t.id] = { why, n, at: iso };
      if (count && n >= LIMITS.retries) skipT(t, `${why} (${n} tries)`); else if (w.why !== why) say(`not mirrored yet ${t.id}: ${why} (will retry)`, { trade: t.id }); };

    // 0) find our positions by label + comment: confirms orders whose fill was not seen ("sent"), and adopts positions whose round
    //    never saved (job cancelled mid-round, timeout), so they are managed and the trade is never opened twice
    const ours = new Map();
    for (const p of positions.values()) { const td = p.tradeData || {}; if (td.label === LABEL && td.comment) ours.set(td.comment, p); }
    for (const t of trades) {
      if ((t.shadow && !shadows) || !SYMBOLS[t.market]) continue;
      const p = ours.get(commentFor(t)); if (!p) continue;
      const pid = String(p.positionId), m = st.map[t.id];
      if (m && m.status !== 'sent') continue;   // already managed (open or finished): never re-adopted
      // a skip note means the round that sent the order saved its state (the order got no answer) and sent no open alert: alert now.
      // Without one, the round that sent it may have been lost after alerting: no open alert (never twice).
      const unanswered = !m && !!(st.skipped && st.skipped[t.id]);
      // the mirror's own LIMIT order filled at the broker (same touch as the council's): the position is ours from now on
      const o = st.orders[t.id] || null;
      // (bug hunt 9 Nov) a filled limit holds the levels the order was placed with: saved as such, so a council level that moved since
      // (a re-quote) is seen by step 2c and sent to the broker
      st.map[t.id] = { ...(m || { symbol: o ? o.symbol : t.market.toUpperCase(), side: t.side, setup: t.k, openedAt: iso, councilEntry: t.entry, stop: o && o.stop != null ? o.stop : t.stop, t1: o && o.t1 !== undefined ? o.t1 : t.t1, adopted: !o, alerted: unanswered || o ? [] : ['open'],
          ...(o ? { viaLimit: true, limitPrice: o.limitPrice, digits: o.digits, lots: o.lots, riskCash: o.riskCash, ...(o.margin != null ? { margin: o.margin } : {}), ...(o.minLot ? { minLot: true } : {}), ...(o.shadow ? { shadow: true } : {}),
            ...fillQuality(t, p.price ?? o.limitPrice, now) } : {}) }),
        positionId: pid, volume: +(p.tradeData || {}).volume || (m && m.volume) || (o && o.volume), status: 'open' };
      if (o) delete st.orders[t.id];
      if (st.skipped) delete st.skipped[t.id]; if (st.wait) delete st.wait[t.id];
      say(`${o ? 'limit filled:' : m ? 'confirmed' : 'found'} ${st.map[t.id].symbol} position ${pid} at the broker`, { trade: t.id });
      if (unanswered || o) alert('open', t.id, st.map[t.id], () => ({ filled: true, viaLimit: !!o, price: p.price ?? (o ? o.limitPrice : null), entry: t.entry, stop: t.stop, t1: t.t1, noTarget: t.t1 == null || t.rr >= 50 }));
    }
    for (const [id, m] of Object.entries(st.map)) {
      if (m.status !== 'sent') continue;
      if (m.positionId && positions.has(String(m.positionId))) { m.status = 'open'; continue; }
      if (now - Date.parse(m.openedAt) / 1000 > 600) { m.status = 'not filled'; m.closedAt = iso; say(`${m.symbol} order for ${id}: no position at the broker`, { trade: id }); alert('unfilled', id, m); }
    }
    // 0b) our resting LIMIT orders: gone at the broker without a position (expired there, or cancelled by hand) -> the trade may be
    //     placed again while the council still has it pending (counted, so a broker that keeps dropping it stops after LIMITS.retries)
    for (const [id, o] of Object.entries(st.orders)) {
      if (bOrders.has(String(o.orderId))) continue;
      delete st.orders[id]; const t = byId.get(id);
      say(`${o.symbol} limit order ${o.orderId} for ${id} is gone at the broker (expired or cancelled there)`, { trade: id });
      if (t && t.status === 'pending') laterT(t, `${o.symbol} limit order gone at the broker`, true);
    }
    // 0c) cancel our LIMIT order when the council no longer has the trade pending: filled on the council's feed first (a market
    //     order follows in step 3 this round), expired / missed / dropped (nothing follows). A cancel the broker rejects means the
    //     order filled meanwhile: the position is adopted next round (step 0), nothing is sent now.
    for (const [id, o] of Object.entries(st.orders)) {
      // (bug hunt 9 Nov) a pending order the council re-quoted (council/feed.mjs re-derives a resting order's levels when the feed
      // changes) is cancelled too and placed again at the new levels below: the broker must not fill at the old entry with the old stop
      const t = byId.get(id), reason = !t ? 'the council dropped the trade' : t.status === 'pending' ? requoted(o, t) : t.status === 'open' ? 'the council filled it on its feed first' : `the council ended it: ${t.status}`;
      if (!reason) continue;
      try { await s.send(PT.CANCEL_ORDER_REQ, { ctidTraderAccountId: ctid, orderId: Number(o.orderId) }, PT.EXECUTION_EVENT, cancelStep);
        delete st.orders[id]; out.sent.push({ type: 'cancel', trade: id }); say(`cancelled ${o.symbol} limit order ${o.orderId} for ${id}: ${reason}`, { trade: id });
        alert('cancel', id, o, { reason, council: t ? t.status : null }); }
      catch (e) { say(`cancel of ${o.symbol} limit order ${o.orderId} for ${id} failed: ${e.message} (checked again next round)`, { trade: id }); }
    }
    // 1) positions gone at the broker (stop/target hit there, or our accepted close filled after its round) -> mark done
    for (const [id, m] of Object.entries(st.map)) if (m.status === 'open' && !positions.has(String(m.positionId))) {
      m.status = m.closing ? 'closed by council' : 'closed at broker'; m.closedAt = iso; say(`${m.symbol} position ${m.positionId} ${m.closing ? 'close filled' : 'closed at the broker'}`, { trade: id });
      const t = byId.get(id); alert('close', id, m, { by: m.closing ? 'council' : 'broker', council: t && isDone(t) ? t.status : null, R: t ? t.R ?? null : null }); }
    // 2) council closed the trade -> close our position (waits for the fill; an accepted-only close is confirmed by step 1 next round)
    for (const [id, m] of Object.entries(st.map)) {
      if (m.status !== 'open') continue;
      const t = byId.get(id); if (!t || !isDone(t)) continue;
      const p = positions.get(String(m.positionId)); if (!p) continue;
      const vol = (p.tradeData && +p.tradeData.volume) || m.volume;
      try { const ev = await s.send(PT.CLOSE_POSITION_REQ, { ctidTraderAccountId: ctid, positionId: Number(m.positionId), volume: vol }, PT.EXECUTION_EVENT, orderStep);
        if (ev.interim) { m.closing = iso; say(`close ${m.symbol} ${m.positionId} accepted, fill not confirmed yet`, { trade: id }); continue; }
        m.status = 'closed by council'; m.closedAt = iso; out.sent.push({ type: 'close', trade: id });
        { const px = ev.deal && +ev.deal.executionPrice; if (px > 0) { m.exitPrice = px; m.councilExit = t.exitPx ?? null; m.councilR = t.R ?? null; } } say(`closed ${m.symbol} position ${m.positionId} (council: ${t.status})`, { trade: id });
        alert('close', id, m, () => { const dl = ev.deal || {}, cd = dl.closePositionDetail || {}, md = Number.isFinite(+cd.moneyDigits) ? +cd.moneyDigits : digits;
          return { by: 'council', council: t.status, R: t.R ?? null, price: dl.executionPrice ?? null, pnl: cd.grossProfit != null && Number.isFinite(+cd.grossProfit) ? +cd.grossProfit / 10 ** md : null }; }); }
      catch (e) { say(`close ${m.symbol} ${m.positionId} failed: ${e.message}`, { trade: id }); alert('closefail', id, m, { result: scrub(e.message) }); }
    }
    // 2a) ICT futures rolls: the tracker shifts an open trade's levels by the contract switch (records carry `rolled`); the cash CFD
    //     at the broker did not move, so the copy's saved council levels take the same shift and step 2c never reads it as a move
    for (const [id, m] of Object.entries(st.map)) { const t = byId.get(id); if (m.status === 'open' && t && String(id).startsWith('ict:')) absorbRolls(m, t); }
    // 2b) RULE (owner, 8 Nov): a mirrored position never sits without a stop. A market order's relative stop is measured from the
    //     fill, and when the stop distance is inside the spread the broker drops the stop and keeps the position. ensureStop sets
    //     the council's absolute stop (an ICT trade: the council's distance from the fill) by amend, right at the fill and again on
    //     every round for any held position without one; a stop the broker refuses means the position is closed at once (the
    //     council would be out too). Only no answer at all (timeout) is left for the next round, with a nostop alert.
    const ensureStop = async (id, m, t, p) => {
      const d = Number.isFinite(+m.digits) ? +m.digits : 5, at = (v) => +(+v).toFixed(d);
      const isIct = String(id).startsWith('ict:'), fill = Number.isFinite(+p.price) && +p.price > 0 ? +p.price : null;
      const num = (v) => v != null && v !== '' && Number.isFinite(+v);
      let want = !num(t.stop) ? null : isIct ? (fill != null && num(t.entry) ? at(fill + (+t.stop - +t.entry)) : null) : at(t.stop);
      // a stop must sit on the losing side of the fill and above zero (9 Nov audit: a missing level once read as 0)
      // (a trailed stop may sit past the entry, so the side is checked against the current price, when known; else the broker judges)
      { const side = m.side || t.side, nowPx = t.market && !isIct ? markOf(marks, t.market, now) : null;   // ICT: futures price vs a cash-CFD stop, never comparable
        if (want != null && (!(want > 0) || (nowPx != null && ((side === 'buy' && want >= nowPx) || (side === 'sell' && want <= nowPx))))) want = null; }
      const wantT1 = t.t1 != null && !(t.rr >= 50) ? (isIct ? (fill != null ? at(fill + (+t.t1 - +t.entry)) : null) : at(t.t1)) : null;
      const vol = (p.tradeData && +p.tradeData.volume) || m.volume, mk = markOf(marks, t.market, now);
      const closeNow = async (why) => {
        try { const ev = await s.send(PT.CLOSE_POSITION_REQ, { ctidTraderAccountId: ctid, positionId: Number(m.positionId), volume: vol }, PT.EXECUTION_EVENT, orderStep);
          if (ev.interim) { m.closing = iso; say(`no stop on ${m.symbol} ${m.positionId}: close accepted, fill not confirmed yet (${why})`, { trade: id }); return; }
          m.status = 'closed by mirror'; m.closedAt = iso; m.closedWhy = `no stop at the broker: ${why}`; out.sent.push({ type: 'close', trade: id });
          { const px = ev.deal && +ev.deal.executionPrice; if (px > 0) m.exitPrice = px; }
          say(`closed ${m.symbol} position ${m.positionId}: the broker held it without a stop and refused one (${why})`, { trade: id });
          alert('close', id, m, { by: 'mirror', council: t.status, R: null, why: `no stop at the broker: ${why}` }); }
        catch (e2) { m.noStopTries = (m.noStopTries || 0) + 1; say(`close of unprotected ${m.symbol} ${m.positionId} failed: ${e2.message} (again next round)`, { trade: id }); alert('nostop', id, m, { result: scrub(e2.message), stop: want }); }
      };
      if (want == null) { await closeNow('no valid stop level (missing, zero, or on the wrong side of the fill)'); return; }
      const req = { ctidTraderAccountId: ctid, positionId: Number(m.positionId), stopLoss: want, ...(wantT1 != null ? { takeProfit: wantT1 } : p.takeProfit != null ? { takeProfit: +p.takeProfit } : {}) };
      try {
        await s.send(PT.AMEND_POSITION_SLTP_REQ, req, PT.EXECUTION_EVENT, amendStep);
        m.stop = t.stop; m.stopSetAt = iso; m.stopSetBy = 'guard'; delete m.noStopTries; out.sent.push({ type: 'amend', trade: id });
        // (9 Nov audit 2) the reconcile snapshot is stale now: step 2c reads it this round, and an ICT target-only move built from
        // a null stop would send no stopLoss (cTrader removes the stop) and shift the just-set target a second time
        p.stopLoss = want; if (req.takeProfit != null) p.takeProfit = req.takeProfit; else delete p.takeProfit; m.t1 = t.t1; m.rr = t.rr;
        say(`set the missing stop on ${m.symbol} ${m.positionId} at ${want} (the broker had opened it without one)`, { trade: id });
        alert('amend', id, m, () => ({ stopFrom: null, stop: t.stop, t1From: m.t1 ?? null, t1: wantT1, brokerStop: want, brokerT1: req.takeProfit ?? null, why: 'the broker opened the position without a stop (the stop distance was inside the spread)' }));
      } catch (e) {
        if (!e.code && UNSURE.test(e.message)) { m.noStopTries = (m.noStopTries || 0) + 1; say(`stop for ${id} on ${m.symbol} ${m.positionId}: no answer (${e.message}); checked again next round`, { trade: id }); alert('nostop', id, m, { result: scrub(e.message), stop: want }); return; }
        await closeNow(`${e.message}${mk != null ? `, price ${mk} vs stop ${want}` : ''}`);
      }
    };
    for (const [id, m] of Object.entries(st.map)) {
      if (m.status !== 'open' || m.closing) continue;
      const p = positions.get(String(m.positionId)); if (!p || p.stopLoss != null) continue;
      // (9 Nov audit) the council's trade may have left its list or lost its levels: the stop saved at the open still protects it
      const t0 = byId.get(id), t = t0 && t0.stop != null && !isDone(t0) ? t0 : m.stop != null ? { id, market: null, side: m.side, stop: m.stop, entry: m.councilEntry ?? m.stop, t1: m.t1 ?? null, rr: m.rr, status: 'open' } : null;
      if (!t) { await ensureStop(id, m, { id, stop: null, entry: null, t1: null, status: 'open' }, p); continue; }   // no level anywhere: ensureStop closes it
      await ensureStop(id, m, t, p);
    }
    // 2d) RULE: a position with our label that the mirror does not manage (state lost, or another run's) and has no stop is closed
    //     at once; one with a stop is reported once and left to its stop (9 Nov audit)
    { const known = new Set(Object.values(st.map).map((m) => String(m.positionId)));
      for (const p of positions.values()) { const td = p.tradeData || {}; if (td.label !== LABEL || known.has(String(p.positionId))) continue;
        const key = String(p.positionId); st.orphans = st.orphans || {};
        if (p.stopLoss == null) {
          try { await s.send(PT.CLOSE_POSITION_REQ, { ctidTraderAccountId: ctid, positionId: Number(p.positionId), volume: +td.volume }, PT.EXECUTION_EVENT, orderStep);
            say(`closed unmanaged position ${key} (${td.comment || 'no comment'}): it had no stop`); alert('close', `orphan:${key}`, { symbol: td.comment || 'position', positionId: key }, { by: 'mirror', why: 'unmanaged position without a stop' }); }
          catch (e) { say(`close of unmanaged position ${key} without a stop failed: ${e.message} (again next round)`); alert('nostop', `orphan:${key}`, { symbol: td.comment || 'position', positionId: key }, { result: scrub(e.message) }); }
        } else if (!st.orphans[key]) { st.orphans[key] = iso; say(`unmanaged position ${key} (${td.comment || 'no comment'}) found at the broker with a stop at ${p.stopLoss}: left to its stop`); }
      } }
    // 2c) the council moved a stop or target on an open trade (break-even, trailing, a re-planned target) -> the demo position's
    //     protection follows (8 Nov, owner). Council trades take the council's absolute levels; an ICT trade (futures levels on a
    //     cash CFD) moves its broker stop by the same distance the council moved its own. A move the broker rejects is retried
    //     next round, AMEND_TRIES times in all.
    for (const [id, m] of Object.entries(st.map)) {
      if (m.status !== 'open') continue;
      // (bug hunt 9 Nov) a broker-filled limit whose council order is still pending follows the council's levels too
      const t = byId.get(id); if (!t || !(OPEN.has(t.status) || t.status === 'pending')) continue;
      const p = positions.get(String(m.positionId)); if (!p) continue;
      const d = Number.isFinite(+m.digits) ? +m.digits : 5, at = (v) => +(+v).toFixed(d), tick = 0.5 * 10 ** -d;
      const wantT1 = t.t1 != null && !(t.rr >= 50) ? +t.t1 : null, hadT1 = m.t1 != null && !(m.rr >= 50) ? +m.t1 : null;
      const stopMoved = t.stop != null && m.stop != null && Math.abs(+t.stop - +m.stop) >= tick, t1Moved = (wantT1 == null) !== (hadT1 == null) || (wantT1 != null && hadT1 != null && Math.abs(wantT1 - hadT1) >= tick);
      if (!stopMoved && !t1Moved) continue;
      if ((m.amendFails || 0) >= AMEND_TRIES) continue;
      const isIct = String(id).startsWith('ict:'), bSL = p.stopLoss != null ? +p.stopLoss : null, bTP = p.takeProfit != null ? +p.takeProfit : null;
      const req = { ctidTraderAccountId: ctid, positionId: Number(m.positionId) };
      if (isIct) { if (stopMoved) { if (bSL == null) { say(`stop move for ${id} skipped: the broker reports no stop on ${m.symbol} ${m.positionId}`, { trade: id }); m.amendFails = (m.amendFails || 0) + 1; continue; } req.stopLoss = at(bSL + (+t.stop - +m.stop)); } else if (bSL != null) req.stopLoss = at(bSL);
        if (wantT1 != null) req.takeProfit = at(bTP != null && hadT1 != null ? bTP + (wantT1 - hadT1) : wantT1); }
      else { req.stopLoss = at(t.stop); if (wantT1 != null) req.takeProfit = at(wantT1); }
      try {
        await s.send(PT.AMEND_POSITION_SLTP_REQ, req, PT.EXECUTION_EVENT, amendStep);
        const from = { stop: m.stop, t1: m.t1 }; m.stop = t.stop; m.t1 = t.t1; m.rr = t.rr; m.amended = (m.amended || 0) + 1; m.amendedAt = iso; delete m.amendFails;
        out.sent.push({ type: 'amend', trade: id }); say(`moved ${m.symbol} ${m.positionId} protection: stop ${from.stop} -> ${t.stop}${t1Moved ? `, target ${from.t1} -> ${wantT1 == null ? 'none' : t.t1}` : ''} (council ${t.k || 'ict'})`, { trade: id });
        alert('amend', id, m, () => ({ stopFrom: from.stop, stop: t.stop, t1From: from.t1, t1: wantT1, brokerStop: req.stopLoss, brokerT1: req.takeProfit ?? null, why: t.beAt || t.be ? 'break-even / trail' : 'the council moved its levels' }));
      } catch (e) { m.amendFails = (m.amendFails || 0) + 1; say(`stop move for ${id} on ${m.symbol} ${m.positionId} failed: ${e.message}${m.amendFails >= AMEND_TRIES ? ` (${m.amendFails} tries, giving up)` : ' (retried next round)'}`, { trade: id }); }
    }
    // 3) new live council trades -> open
    const dayDown = st.day.startBalance && balance != null ? (st.day.startBalance - balance) / st.day.startBalance : 0;
    const openCount = () => Object.values(st.map).filter((m) => m.status === 'open' || m.status === 'sent').length + Object.keys(st.orders).length;   // unconfirmed and resting orders count too
    // every open council trade not yet copied or skipped is eligible, whatever its age (8 Nov, owner: "even the ones active now");
    // a pending council trade (not ICT) is eligible for a resting LIMIT order at its entry
    const fresh = trades.filter((t) => (!t.shadow || shadows) && (OPEN.has(t.status) || (t.status === 'pending' && !String(t.id).startsWith('ict:'))) && SYMBOLS[t.market]
      && (!openBooks || openBooks.includes(bookOf(t))) && !(exclude && exclude.has(t.id))
      && !st.map[t.id] && !st.orders[t.id] && !(st.skipped || {})[t.id]
      && (t.side === 'buy' || t.side === 'sell') && t.stop != null && t.entry != null && Math.abs(t.entry - t.stop) > 0);
    if (shadows && !st.catchUpAt) { st.catchUpAt = iso; say(`catch-up round: ${fresh.length} open council trade${fresh.length === 1 ? '' : 's'} (shadows included) considered`); }
    st.paused = Object.fromEntries(Object.entries(st.paused || {}).filter(([, until]) => Date.parse(until) / 1000 > now));
    if (st.closedSeen) st.closedSeen = Object.fromEntries(Object.entries(st.closedSeen).filter(([, at]) => now - Date.parse(at) / 1000 < 86400));   // closed-market pauses still running
    if (fresh.length) {
      const names = await s.send(PT.SYMBOLS_LIST_REQ, { ctidTraderAccountId: ctid }, PT.SYMBOLS_LIST_RES);
      const idOf = new Map((names.symbol || []).filter((x) => x.enabled !== false).map((x) => [normName(x.symbolName), x.symbolId]));
      for (const t of fresh) {
        const skip = (why) => skipT(t, why), later = (why, count = false) => laterT(t, why, count);
        const pending = t.status === 'pending';
        if (dayDown >= LIMITS.dayStop) { later(`daily loss stop (${(dayDown * 100).toFixed(1)}% down today)`); continue; }
        if (openCount() >= LIMITS.maxOpen) { later(`${LIMITS.maxOpen} mirror positions already open`); continue; }
        const name = SYMBOLS[t.market].find((n) => idOf.has(normName(n))), symbolId = name && idOf.get(normName(name));
        if (!symbolId) { skip(`none of ${SYMBOLS[t.market].join('/')} found at the broker`); continue; }
        if (st.paused[PAUSE_KEY(name, pending)]) { later(`${name} market closed (paused until ${st.paused[PAUSE_KEY(name, pending)].slice(11, 16)} UTC)`); continue; }
        // a market that just reopened has its widest spreads, where a stop inside the spread is dropped by the broker: market orders
        // wait LIMITS.settle seconds after the last "market closed" answer (9 Nov, every reopen copy needed the stop guard)
        { const seen = st.closedSeen && st.closedSeen[name]; if (!pending && seen && now - Date.parse(seen) / 1000 < LIMITS.settle) { later(`${name} market closed or just reopened: next try after ${new Date(Date.parse(seen) + LIMITS.settle * 1000).toISOString().slice(11, 16)} UTC, once spreads settle`); continue; } }
        const sell = t.side === 'sell', sgn = sell ? -1 : 1, isIct = String(t.id).startsWith('ict:');
        const mark = isIct ? null : markOf(marks, t.market, now); let from = t.entry;
        if (pending) {
          // a resting LIMIT order at the council's entry: the broker fills it on the same touch the council fills on
          const exp = validUntil(t);
          if (exp - now < 60) { later('the council order expires within a minute'); continue; }
          if (!mark) { later('no current council price to place the limit against'); continue; }
          if (sgn * (mark - t.entry) <= 0) { later(`entry ${t.entry} is ${sell ? 'below' : 'above'} the price ${mark}: the council fills it on its next candle, copied then`); continue; }
          const info = ((await s.send(PT.SYMBOL_BY_ID_REQ, { ctidTraderAccountId: ctid, symbolId: [symbolId] }, PT.SYMBOL_BY_ID_RES)).symbol || [])[0] || {};
          const live = Object.values(st.map).filter((m) => m.status === 'open' || m.status === 'sent').concat(Object.values(st.orders));
          const openRisk = live.reduce((a, m) => a + (+m.riskCash || 0), 0), openMargin = live.reduce((a, m) => a + (+m.margin || 0), 0);
          const rv = riskVolume({ info, t, balance, name, openRisk, openMargin, spec: specFor(specs, name), now });
          if (rv.skip) { (rv.retry ? later : skip)(rv.skip); continue; }
          const d = Number.isFinite(+info.digits) ? +info.digits : 5, at = (v) => +(+v).toFixed(d);
          if (info.tradingMode != null && info.tradingMode !== 0 && info.tradingMode !== 'ENABLED') { later(`${name} not tradable now (mode ${info.tradingMode})`); continue; }
          const order = { ctidTraderAccountId: ctid, symbolId, orderType: 2, tradeSide: sell ? 2 : 1, volume: rv.volume, limitPrice: at(t.entry), stopLoss: at(t.stop), label: LABEL,
            comment: commentFor(t), clientOrderId: String(t.id).slice(0, 50), timeInForce: 1, expirationTimestamp: exp * 1000 };   // 1: GOOD_TILL_DATE
          if (t.t1 != null && !(t.rr >= 50)) order.takeProfit = at(t.t1);
          try {
            const ev = await s.send(PT.NEW_ORDER_REQ, order, PT.EXECUTION_EVENT, pendingStep);
            const oid = ev.order && ev.order.orderId; if (oid == null) throw Object.assign(new Error('order accepted without an order id'), { code: 'NO_ORDER_ID' });
            st.orders[t.id] = { orderId: String(oid), symbol: name, side: t.side, volume: rv.volume, lots: rv.lots, digits: d, setup: t.k, limitPrice: order.limitPrice, stop: t.stop, t1: t.t1, placedAt: iso,
              expires: new Date(exp * 1000).toISOString(), riskCash: rv.riskCash, ...(rv.margin != null ? { margin: rv.margin } : {}), ...(rv.minLot ? { minLot: true } : {}), ...(t.shadow ? { shadow: true } : {}) };
            if (st.wait) delete st.wait[t.id];
            out.sent.push({ type: 'limit', trade: t.id }); say(`placed ${sell ? 'sell' : 'buy'} limit ${name} ${rv.lots} lot at ${order.limitPrice} (council ${t.k}, valid to ${st.orders[t.id].expires.slice(0, 16)}Z)`, { trade: t.id });
            alert('pending', t.id, st.orders[t.id], () => ({ price: order.limitPrice, stop: t.stop, t1: t.t1, noTarget: !('takeProfit' in order), expires: st.orders[t.id].expires }));
          } catch (e) { const txt = `${e.code || ''} ${e.message}`;
            if (PAUSE.test(txt)) { st.paused[PAUSE_KEY(name, true)] = new Date((now + LIMITS.pause) * 1000).toISOString(); (st.closedSeen = st.closedSeen || {})[name] = iso; later(`${name} market closed: ${e.message}`); }
            else if (RETRY.test(txt)) later(`limit rejected: ${e.message}`, true); else skip(`limit rejected: ${e.message}`);
            if ((st.skipped || {})[t.id] && !(!e.code && UNSURE.test(e.message))) alert('reject', t.id, null, () => ({ symbol: name, side: t.side, lots: rv.lots, result: st.skipped[t.id] })); }
          continue;
        }
        // council trades: distances measured from the council's latest price, so the demo stop/target sit at the council's levels
        if (mark) {
          const R = Math.abs(t.entry - t.stop), ran = (sgn * (mark - t.entry)) / R;
          if (sgn * (mark - t.stop) <= 0) { skip(`price ${mark} is already past the council stop ${t.stop}`); continue; }
          if (t.t1 != null && !(t.rr >= 50) && sgn * (t.t1 - mark) <= 0) { skip(`price ${mark} is already past the council target ${t.t1}`); continue; }
          if (ran > LIMITS.maxDriftR) { skip(`price ${mark} has run ${ran.toFixed(2)}R from the council entry ${t.entry}: a different trade now`); continue; }
          from = mark;
        }
        // a stop closer than the spread cannot be set at the broker (a sell fills at the bid, its stop triggers on the ask): the
        // broker would open the position and drop the stop. Such a trade is not mirrored (8 Nov).
        { const sp = specFor(specs, name), spr = sp && Number.isFinite(+sp.spread) ? +sp.spread : 0, dist = Math.abs(from - t.stop);
          if (spr > 0 && dist <= spr * 1.25) { skip(`stop distance ${+dist.toFixed(6)} sits inside the broker spread ${spr} on ${name}: no stop could be set`); continue; } }
        const info = ((await s.send(PT.SYMBOL_BY_ID_REQ, { ctidTraderAccountId: ctid, symbolId: [symbolId] }, PT.SYMBOL_BY_ID_RES)).symbol || [])[0] || {};
        const live = Object.values(st.map).filter((m) => m.status === 'open' || m.status === 'sent').concat(Object.values(st.orders));
        const openRisk = live.reduce((a, m) => a + (+m.riskCash || 0), 0), openMargin = live.reduce((a, m) => a + (+m.margin || 0), 0);
        const rv = riskVolume({ info, t: { ...t, entry: from }, balance, name, openRisk, openMargin, spec: specFor(specs, name), now });
        if (rv.skip) { (rv.retry ? later : skip)(rv.skip); continue; }
        const volume = rv.volume, d = Number.isFinite(+info.digits) ? +info.digits : 5;
        if (info.tradingMode != null && info.tradingMode !== 0 && info.tradingMode !== 'ENABLED') { later(`${name} not tradable now (mode ${info.tradingMode})`); continue; }
        const order = { ctidTraderAccountId: ctid, symbolId, orderType: 1, tradeSide: sell ? 2 : 1, volume, label: LABEL,
          comment: commentFor(t), clientOrderId: String(t.id).slice(0, 50), relativeStopLoss: relative(from - t.stop, d) };
        if (t.t1 != null && !(t.rr >= 50)) order.relativeTakeProfit = relative(t.t1 - from, d);   // trailing systems: no fixed target
        try {
          const ev = await s.send(PT.NEW_ORDER_REQ, order, PT.EXECUTION_EVENT, orderStep);
          const pid = (ev.position && ev.position.positionId) ?? (ev.order && ev.order.positionId), filled = !ev.interim && pid != null;
          st.map[t.id] = { positionId: pid != null ? String(pid) : null, symbol: name, side: t.side, volume, lots: volume / +info.lotSize, digits: d, setup: t.k, status: filled ? 'open' : 'sent', openedAt: iso, councilEntry: t.entry, stop: t.stop, t1: t.t1, riskCash: rv.riskCash, ...(rv.margin != null ? { margin: rv.margin } : {}), ...(rv.minLot ? { minLot: true } : {}), ...(t.shadow ? { shadow: true } : {}), ...(mark ? { mark, levelsFrom: 'mark' } : {}),
            ...fillQuality(t, (ev.deal && ev.deal.executionPrice) ?? (filled && ev.position ? ev.position.price : null), now) };
          if (st.wait) delete st.wait[t.id];
          out.sent.push({ type: 'open', trade: t.id }); say(`${filled ? 'opened' : 'sent (fill not confirmed yet)'} ${sell ? 'sell' : 'buy'} ${name} ${volume / +info.lotSize} lot (council ${t.k})`, { trade: t.id });
          alert('open', t.id, st.map[t.id], () => ({ filled, price: (ev.deal && ev.deal.executionPrice) ?? (filled && ev.position ? ev.position.price : null) ?? null,
            entry: t.entry, stop: t.stop, t1: t.t1, noTarget: !('relativeTakeProfit' in order) }));
          // RULE: never a position without a stop. The fill event carries the position's levels; a missing stop is set now, or the position closed
          // (9 Nov, owner: "the most important part"): the fill event can arrive before the broker attaches the relative stop, so the
          // position is read back from the broker first; only a stop that is really missing is set (or the position closed)
          if (filled && (!ev.position || ev.position.stopLoss == null)) {   // no position body in the event: checked the same way
            let pr = null;
            try { if (slWaitMs > 0) await new Promise((r) => setTimeout(r, slWaitMs)); const rc2 = await s.send(PT.RECONCILE_REQ, { ctidTraderAccountId: ctid }, PT.RECONCILE_RES); pr = (rc2.position || []).find((x) => String(x.positionId) === String(pid)) || null; } catch (e) { pr = null; }
            if (pr && pr.stopLoss != null) { st.map[t.id].stopCheckedAt = iso; st.map[t.id].brokerStop = +pr.stopLoss; }
            else { const ep = ev.position || { positionId: pid }, base = pr || ep, pf = { ...base, price: base.price ?? ep.price ?? (ev.deal && ev.deal.executionPrice) ?? null, tradeData: base.tradeData || ep.tradeData || { volume } };
              await ensureStop(t.id, st.map[t.id], t, pf); }
          }
        } catch (e) { const txt = `${e.code || ''} ${e.message}`;
          if (PAUSE.test(txt)) { st.paused[name] = new Date((now + LIMITS.pause) * 1000).toISOString(); (st.closedSeen = st.closedSeen || {})[name] = iso; later(`${name} market closed: ${e.message}`); }
          else if (RETRY.test(txt)) later(`order rejected: ${e.message}`, true); else skip(`order rejected: ${e.message}`);
          // no answer at all (timeout, dropped connection) is not a rejection: the order may be live and is looked up by label/comment
          // next round (step 0, which then sends the open alert); only a broker's answer is alerted as a rejection
          if ((st.skipped || {})[t.id] && !(!e.code && UNSURE.test(e.message))) alert('reject', t.id, null, () => ({ symbol: name, side: t.side, lots: volume / +info.lotSize, result: st.skipped[t.id] })); }
      }
    }
    // housekeeping: skip/retry notes matter only while the council trade is open; finished positions are kept LIMITS.keepDays
    for (const k of ['skipped', 'wait']) for (const id of Object.keys(st[k] || {})) { const t = byId.get(id); if (!t || !(OPEN.has(t.status) || t.status === 'pending')) delete st[k][id]; }
    // (bug hunt 9 Nov) never while the council trade is still open or pending: the record is what stops it being copied a second time
    // (a position / trend trade lives for weeks; one stopped at the broker would have been opened again 30 days later)
    for (const [id, m] of Object.entries(st.map)) { const t = byId.get(id);
      if (m.closedAt && now - Date.parse(m.closedAt) / 1000 > LIMITS.keepDays * 86400 && !(t && (OPEN.has(t.status) || t.status === 'pending'))) delete st.map[id]; }
    st.status = `ok · demo ${acc.brokerTitleShort || ''} · balance ${balance} · ${openCount() - Object.keys(st.orders).length} open${Object.keys(st.orders).length ? ` · ${Object.keys(st.orders).length} resting` : ''}`.trim();
    st.balance = balance; st.lastRun = new Date(now * 1000).toISOString();
    return out;
  } catch (e) { st.status = `error: ${scrub(e.message || e)}`; say(st.status); return out; }
  finally { s.close(); }
}

if (process.argv[1] && process.argv[1].endsWith('ctrader-mirror.mjs')) {
  const DIR = process.argv[2] || 'data', CD = path.join(DIR, 'ctrader');
  const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(CD, f), 'utf8')); } catch (e) { return d; } };
  const anySet = ['CTRADER_MIRROR', 'CTRADER_CLIENT_ID', 'CTRADER_ACCOUNT_ID', 'CTRADER_ENV'].some((k) => process.env[k]);
  if (!anySet && !fs.existsSync(path.join(CD, 'mirror.json'))) process.exit(0);   // never set up: stay silent; once any cTrader setting exists, always report status
  const raw = JSON.parse(fs.readFileSync(path.join(DIR, 'trades.json'), 'utf8'));
  let ict = []; try { ict = JSON.parse(fs.readFileSync(path.join(DIR, 'ict', 'trades.json'), 'utf8')); } catch (e) {}
  let research = []; try { research = JSON.parse(fs.readFileSync(path.join(DIR, 'research.json'), 'utf8')); } catch (e) {}
  const own = Array.isArray(raw) ? raw : raw.trades || [];
  const saveTokens = (t) => { fs.mkdirSync(CD, { recursive: true }); writeAtomic(path.join(CD, 'tokens.json'), JSON.stringify(t)); };
  let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(path.join(DIR, 'config.json'), 'utf8')) || {}; } catch (e) {}
  const shadows = cfg.mirrorShadow !== false;   // 8 Nov, owner: shadows mirrored too; config.json mirrorShadow: false turns it off
  // the council's latest prices (Trader snapshot): stop/target distances of a council trade are measured from them, see the header
  let marks = null; try { const sn = JSON.parse(fs.readFileSync(path.join(DIR, 'snapshot.json'), 'utf8'));
    marks = Object.fromEntries(Object.entries(sn.markets || {}).filter(([, m]) => m && +m.price > 0).map(([k, m]) => [k, { price: +m.price, at: sn.at }])); } catch (e) {}
  let resetFile = null; try { resetFile = JSON.parse(fs.readFileSync(new URL('./ctrader-reset.json', import.meta.url), 'utf8')); } catch (e) {}
  fs.mkdirSync(CD, { recursive: true });
  // one round per demo account (books routed by bookOf): the base account keeps mirror.json; another account's file is
  // mirror-<account>.json. The token pair is shared (one cTrader ID), so a refresh in one round is handed to the next.
  // account numbers: council/ctrader-accounts.json on main (owner gives the numbers in chat, a PR records them; no secrets), then
  // council-data config.json mirrorAccounts, then the env CTRADER_ACCOUNTS
  let accFile = {}; try { accFile = JSON.parse(fs.readFileSync(new URL('./ctrader-accounts.json', import.meta.url), 'utf8')); } catch (e) {}
  const { groups, byBook } = accountsFor(process.env, { mirrorAccounts: { ...(accFile.mirrorAccounts || {}), ...(cfg.mirrorAccounts || {}) } }), allAlerts = [], base = String(process.env.CTRADER_ACCOUNT_ID || '').trim();
  // the replica's research trades are copied only while the replica book has a demo account of its own: without one they
  // would land on the council's account (a book without a number trades on the base account)
  const replicaOwn = replicaHasOwnAccount(byBook);
  const trades = own.concat(ictCandidates(ict), replicaOwn ? replicaCandidates(research, own) : []);
  let tokens = rd('tokens.json', null), summaryLines = [];
  // what each account has copied (any status, resting orders too; after the owner's reset, if one applies): another account never
  // opens the same trade
  const fileOf = (acc) => (acc === base ? 'mirror.json' : `mirror-${acc}.json`), held = new Map();
  for (const g of groups) { const st = (rd(fileOf(g.account), {}).state) || {}; held.set(g.account, copiedIds(applyReset(st, resetFile).state)); }
  for (const g of groups) {
    const file = fileOf(g.account), prev = rd(file, {});
    const exclude = new Set(); for (const [acc, ids] of held) if (acc !== g.account) for (const id of ids) exclude.add(id);
    const reset = applyReset(prev.state, resetFile);
    if (reset.applied) prev.log = (prev.log || []).concat({ at: new Date().toISOString(), msg: `owner reset ${resetFile.at}: ${reset.dropped} copied-trade records, the skip/wait notes and the day's start balance dropped; the open book is copied afresh` });
    // every trade is passed (this account keeps managing what it already holds); only its books are opened here
    const r = await mirrorRound({ env: { ...process.env, CTRADER_ACCOUNT_ID: g.account }, trades, state: reset.state, tokens, specs: rd('symbols.json', null), onTokens: saveTokens, shadows, marks, openBooks: g.books, exclude });
    if (r.tokens) tokens = r.tokens;
    writeAtomic(path.join(CD, file), JSON.stringify({ account: g.account, books: g.books, state: r.state, log: (prev.log || []).concat(r.log).slice(-300), limits: LIMITS, symbols: SYMBOLS, execution: executionStats(r.state.map) }, null, 1));
    summaryLines.push(`${g.books.join('+')} (${g.account}): ${r.state.status}${r.sent.length ? ` · ${r.sent.length} sent` : ''}`);
    // a burst (the catch-up round, or many closes at once) goes as one summary instead of a phone message per position
    if (r.alerts.length > 6) { const n = r.alerts.length, opens = r.alerts.filter((a) => a.kind === 'open').length, closes = r.alerts.filter((a) => a.kind === 'close').length;
      r.alerts = [{ kind: 'summary', n, opens, closes, other: n - opens - closes, catchUp: !(prev.state && prev.state.catchUpAt) && !!r.state.catchUpAt }]; }
    for (const a of r.alerts) allAlerts.push(groups.length > 1 ? { ...a, book: g.books.join('+') } : a);
  }
  writeAtomic(path.join(CD, 'mirror-accounts.json'), JSON.stringify({ at: new Date().toISOString(), groups: groups.map((g) => ({ account: g.account, books: g.books, file: g.account === base ? 'mirror.json' : `mirror-${g.account}.json` })) }, null, 1));
  if (tokens && JSON.stringify(tokens) !== JSON.stringify(rd('tokens.json', null))) saveTokens(tokens);
  console.log(`cTrader mirror: ${summaryLines.join(' | ')}`);
  const r = { alerts: allAlerts };
  // phone alerts, after the files are saved (already flagged there, so a crash here never re-sends them): best-effort only
  if (r.alerts.length) {
    let tgChat = null; try { tgChat = JSON.parse(fs.readFileSync(path.join(DIR, 'state.json'), 'utf8')).tgChat || null; } catch (e) {}   // the council's remembered chat
    const a = await sendMirrorAlerts(r.alerts, { env: process.env, tgChat });
    const errs = Object.entries(a.errors).map(([k, v]) => `${k} ${v}`).join('; ');
    console.log(`cTrader mirror alerts: ${a.sent} sent${errs ? ` · errors: ${errs}` : ''}`);
  }
}
