// Council → cTrader DEMO mirror (owner, 7 Nov: "mirror to the cTrader demo, that's the goal of all this").
//   node council/ctrader-mirror.mjs <dataDir>      (runs after each Trader round in council.yml)
//
// Copies the council's paper trades on gold, forex and crypto, LIVE and SHADOW (owner, 8 Nov: "everything the council does, mirror to cTrader,
// even the ones active now"; before that live only), and the ICT desk's A-setups (NQ/ES/YM/RTY/GC), into the cTrader DEMO account as market orders with
// the same stop and target, and closes the position when the council closes the trade. Safety, enforced here in code:
//   * DEMO ONLY: the host is the cTrader demo endpoint, CTRADER_ENV must be "demo", and the account must report isLive:false
//     before account auth is sent. A live account is refused (the owner decides on live separately, with demo results).
//   * OFF unless CTRADER_MIRROR=on. Without the CTRADER_* secrets it does nothing.
//   * Only these message types can be sent: auth, account list, trader, reconcile, symbols, token refresh, heartbeat, NEW MARKET
//     ORDER and CLOSE POSITION. No amend, no cancel, no pending orders.
//   * Small and capped: risk-based lots (see sizing below, valued with the broker's own specs from ctrader/symbols.json, written
//     each round by council/ctrader-symbols.mjs), one trade's margin at most LIMITS.maxMarginShare of the balance (LIMITS.maxLots
//     when the broker's margin is unknown), all open positions' margin at most LIMITS.maxTotalMarginShare, never above the broker's
//     own maximum, at most LIMITS.maxOpen mirror positions (unconfirmed orders included), no new order once the account is down
//     LIMITS.dayStop of its balance on the UTC day (closed P/L: balance), only trades opened in the last LIMITS.fresh seconds, except
//     ONE catch-up round (8 Nov, owner: "even the ones active now") that copies every open trade once (state.catchUpAt marks it done).
//   * Minimum lot (8 Nov): on a small demo the risk-based lot is below the broker's minimum for most trades; the order then goes at
//     the minimum lot (its real risk counted against maxOpenRisk) instead of being skipped. config.json mirrorShadow: false turns the
//     shadow copying off again (the CLI reads it; mirrorRound takes `shadows`).
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
// council / ICT desk market -> broker symbol names to try, in order (Fusion Markets cTrader names first). The ICT desk signals on
// CME futures (NQ, ES, YM, RTY, GC); the demo trades the matching cash index / spot gold CFD: only the stop distance is copied,
// so the futures-cash basis does not matter.
export const SYMBOLS = { xau: ['XAUUSD'], eurusd: ['EURUSD'], gbpusd: ['GBPUSD'], audusd: ['AUDUSD'], usdcad: ['USDCAD'], usdchf: ['USDCHF'],
  btc: ['BTCUSD'], eth: ['ETHUSD'], sol: ['SOLUSD'], xrp: ['XRPUSD'],   // 8 Nov: the council's crypto paper trades too (CFDs at the broker)
  nq: ['US100', 'NAS100', 'USTEC'], es: ['US500', 'SPX500', 'US500.cash'], ym: ['US30', 'DJ30', 'US30.cash'], rty: ['US2000', 'RUSSELL2000'], gc: ['XAUUSD'] };
// the ICT desk's trades as mirror candidates: only its A-setups (the part that holds up after costs: research/edge/costs), with
// their own id space; everything else is treated like a shadow (never sent)
export const ictCandidates = (ict) => (Array.isArray(ict) ? ict : []).map((t) => ({ ...t, id: 'ict:' + t.id, k: 'ict-' + (t.aplus ? 'A+' : 'A'), shadow: !t.aset, rr: t.t1 == null ? 99 : t.rr }));
// sizing (owner, 7 Nov: "risk-based lots, bigger demo", from research/portfolio.md): each order risks a share of the balance per 1R:
// ICT A-setups 0.20% x the desk's size field (A+ half-size trades 0.10%), Meridian 0.02%; total open risk at most 1%.
// The lot follows from the stop distance; below the broker's minimum lot the trade is skipped (never rounded up to more risk).
// Lot cap (owner, 7 Nov: "cap by risk, not lots"): a lot means very different things per symbol (1 US2000 lot = $1 a point, 1 gold lot
// = 100 oz), so a flat lot cap skipped normal-risk Russell trades on a $50k demo (18-point stop: 5.55 lots for $100). The risk caps
// above do the real limiting; a trade's margin (broker's marginPerLot from ctrader/symbols.json) may use at most maxMarginShare of the
// balance; maxLots stays only as the cap when that margin is unknown.
// 8 Nov (owner: mirror everything): maxOpen 5 -> 40, maxOpenRisk 1% -> 50% (minimum-lot orders on a ~$1,000 demo risk about 1% each),
// minLot fallback on, total margin of all open mirror positions at most 80% of the balance.
export const LIMITS = { lots: 0.01, maxLots: 5, maxMarginShare: 0.2, maxTotalMarginShare: 0.8, maxOpen: 40, dayStop: 0.02, fresh: 15 * 60, retries: 3, keepDays: 30,
  risk: { ict: 0.002, council: 0.0002 }, maxOpenRisk: 0.5, minLot: true };
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
  }
  if (openRisk + riskCash > balance * LIMITS.maxOpenRisk + 1e-9) return { skip: `open risk would pass ${LIMITS.maxOpenRisk * 100}% of the balance${atMin ? ` (${name} at the minimum lot risks ${riskCash.toFixed(2)})` : ''}` };
  if (info.maxVolume && v > +info.maxVolume) return { skip: `${name}: ${(v / lot).toFixed(2)} lot is above the broker maximum (${+info.maxVolume / lot} lot)` };
  const mpl = spec && +spec.marginPerLot > 0 ? +spec.marginPerLot : null, margin = mpl ? (v / lot) * mpl : null;
  if (mpl && openMargin + margin > balance * LIMITS.maxTotalMarginShare + 1e-9) return { skip: `${name}: ${margin.toFixed(2)} margin would take all open mirror positions over ${LIMITS.maxTotalMarginShare * 100}% of the balance` };
  if (mpl && margin > balance * LIMITS.maxMarginShare + 1e-9) return { skip: `${name}: ${(v / lot).toFixed(2)} lot would use ${margin.toFixed(2)} margin, over ${LIMITS.maxMarginShare * 100}% of the balance` };
  if (!mpl && v > lot * LIMITS.maxLots + 1e-9) return { skip: `${name}: ${(v / lot).toFixed(2)} lot is above the ${LIMITS.maxLots}-lot cap (the broker's margin is not known)` };
  return { volume: v, riskCash: +riskCash.toFixed(2), lots: +(v / lot).toFixed(4), perLot: +perLot.toFixed(4), ...(atMin ? { minLot: true } : {}), ...(margin != null ? { margin: +margin.toFixed(2) } : {}) };
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
  const head = `${sideTxt(e)} ${e.symbol || ''}`.trim(), at = when(now), up = e.side === 'sell' ? 'chart_with_downwards_trend' : 'chart_with_upwards_trend';
  if (e.kind === 'open') {
    const p = px(e.price, e.digits), lv = [px(e.entry, e.digits) && `council entry ${px(e.entry, e.digits)}`, px(e.stop, e.digits) && `stop ${px(e.stop, e.digits)}`,
      e.noTarget || px(e.t1, e.digits) == null ? 'no fixed target' : `target ${px(e.t1, e.digits)}`].filter(Boolean).join(' · ');
    return { title: `Demo mirror: ${head}${lotTxt(e)}`, msg: `${e.filled === false ? 'Order accepted, fill not confirmed yet' : `Opened${p ? ` at ${p}` : ''}`} · ${lv}\n${councilTxt(e)}\n${at}`, tags: `robot,${up}` };
  }
  if (e.kind === 'close') {
    const p = px(e.price, e.digits), pl = e.pnl != null && Number.isFinite(+e.pnl) ? `gross P/L ${+e.pnl >= 0 ? '+' : ''}${(+e.pnl).toFixed(2)}` : '';
    const why = e.by === 'council' ? `The council closed the trade${e.council ? `: ${e.council}${rTxt(e.R)}` : ''}` : 'Closed at the broker (its stop or target)';
    const good = e.pnl != null ? +e.pnl : e.R != null ? +e.R : NaN, top = [p && `Closed at ${p}`, pl].filter(Boolean).join(' · ');
    return { title: `Demo mirror: closed ${head}${lotTxt(e)}`, msg: `${top ? top + '\n' : ''}${why}\n${councilTxt(e)}\n${at}`,
      tags: `robot,${good > 0 ? 'white_check_mark' : good < 0 ? 'x' : 'checkered_flag'}` };
  }
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

export async function mirrorRound({ env, trades, state, tokens, specs = null, WS = globalThis.WebSocket, now = Math.floor(Date.now() / 1000), timeout, onTokens, shadows = true }) {
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
    const iso = new Date(now * 1000).toISOString(), byId = new Map(trades.map((t) => [t.id, t]));

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
      st.map[t.id] = { ...(m || { symbol: t.market.toUpperCase(), side: t.side, setup: t.k, openedAt: iso, councilEntry: t.entry, stop: t.stop, t1: t.t1, adopted: true, alerted: unanswered ? [] : ['open'] }),
        positionId: pid, volume: +(p.tradeData || {}).volume || (m && m.volume), status: 'open' };
      if (st.skipped) delete st.skipped[t.id]; if (st.wait) delete st.wait[t.id];
      say(`${m ? 'confirmed' : 'found'} ${st.map[t.id].symbol} position ${pid} at the broker`, { trade: t.id });
      if (unanswered) alert('open', t.id, st.map[t.id], () => ({ filled: true, price: p.price ?? null, entry: t.entry, stop: t.stop, t1: t.t1, noTarget: t.t1 == null || t.rr >= 50 }));
    }
    for (const [id, m] of Object.entries(st.map)) {
      if (m.status !== 'sent') continue;
      if (m.positionId && positions.has(String(m.positionId))) { m.status = 'open'; continue; }
      if (now - Date.parse(m.openedAt) / 1000 > 600) { m.status = 'not filled'; m.closedAt = iso; say(`${m.symbol} order for ${id}: no position at the broker`, { trade: id }); alert('unfilled', id, m); }
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
    // 3) new live council trades -> open
    const dayDown = st.day.startBalance && balance != null ? (st.day.startBalance - balance) / st.day.startBalance : 0;
    const openCount = () => Object.values(st.map).filter((m) => m.status === 'open' || m.status === 'sent').length;   // unconfirmed orders count too
    const since = Date.parse(st.startedAt) / 1000;
    // catch-up (8 Nov, owner: "even the ones active now"): the first round with shadows on copies every open trade whatever its age, once
    const catchUp = shadows && !st.catchUpAt;
    const fresh = trades.filter((t) => (!t.shadow || shadows) && OPEN.has(t.status) && SYMBOLS[t.market] && !st.map[t.id] && !(st.skipped || {})[t.id]
      && (t.side === 'buy' || t.side === 'sell') && (catchUp || ((t.filled || t.opened) >= since && now - (t.filled || t.opened) <= LIMITS.fresh))
      && t.stop != null && t.entry != null && Math.abs(t.entry - t.stop) > 0);
    if (catchUp) { st.catchUpAt = iso; say(`catch-up round: ${fresh.length} open council trade${fresh.length === 1 ? '' : 's'} (shadows included) considered`); }
    if (fresh.length) {
      const names = await s.send(PT.SYMBOLS_LIST_REQ, { ctidTraderAccountId: ctid }, PT.SYMBOLS_LIST_RES);
      const idOf = new Map((names.symbol || []).filter((x) => x.enabled !== false).map((x) => [normName(x.symbolName), x.symbolId]));
      for (const t of fresh) {
        const skip = (why) => { (st.skipped = st.skipped || {})[t.id] = why; if (st.wait) delete st.wait[t.id]; say(`not mirrored ${t.id}: ${why}`, { trade: t.id }); };
        // "not now" answers: tried again next round while the trade is fresh, at most LIMITS.retries times in all
        const later = (why) => { const n = (((st.wait || {})[t.id] || {}).n || 0) + 1; (st.wait = st.wait || {})[t.id] = { why, n };
          if (n >= LIMITS.retries) skip(`${why} (${n} tries)`); else say(`not mirrored yet ${t.id}: ${why} (will retry)`, { trade: t.id }); };
        if (dayDown >= LIMITS.dayStop) { skip(`daily loss stop (${(dayDown * 100).toFixed(1)}% down today)`); continue; }
        if (openCount() >= LIMITS.maxOpen) { skip(`${LIMITS.maxOpen} mirror positions already open`); continue; }
        const name = SYMBOLS[t.market].find((n) => idOf.has(normName(n))), symbolId = name && idOf.get(normName(name));
        if (!symbolId) { skip(`none of ${SYMBOLS[t.market].join('/')} found at the broker`); continue; }
        const info = ((await s.send(PT.SYMBOL_BY_ID_REQ, { ctidTraderAccountId: ctid, symbolId: [symbolId] }, PT.SYMBOL_BY_ID_RES)).symbol || [])[0] || {};
        const live = Object.values(st.map).filter((m) => m.status === 'open' || m.status === 'sent');
        const openRisk = live.reduce((a, m) => a + (+m.riskCash || 0), 0), openMargin = live.reduce((a, m) => a + (+m.margin || 0), 0);
        const rv = riskVolume({ info, t, balance, name, openRisk, openMargin, spec: specFor(specs, name), now });
        if (rv.skip) { skip(rv.skip); continue; }
        const volume = rv.volume, sell = t.side === 'sell', d = Number.isFinite(+info.digits) ? +info.digits : 5;
        if (info.tradingMode != null && info.tradingMode !== 0 && info.tradingMode !== 'ENABLED') { later(`${name} not tradable now (mode ${info.tradingMode})`); continue; }
        const order = { ctidTraderAccountId: ctid, symbolId, orderType: 1, tradeSide: sell ? 2 : 1, volume, label: LABEL,
          comment: commentFor(t), clientOrderId: String(t.id).slice(0, 50), relativeStopLoss: relative(t.entry - t.stop, d) };
        if (t.t1 != null && !(t.rr >= 50)) order.relativeTakeProfit = relative(t.t1 - t.entry, d);   // trailing systems: no fixed target
        try {
          const ev = await s.send(PT.NEW_ORDER_REQ, order, PT.EXECUTION_EVENT, orderStep);
          const pid = (ev.position && ev.position.positionId) ?? (ev.order && ev.order.positionId), filled = !ev.interim && pid != null;
          st.map[t.id] = { positionId: pid != null ? String(pid) : null, symbol: name, side: t.side, volume, lots: volume / +info.lotSize, digits: d, setup: t.k, status: filled ? 'open' : 'sent', openedAt: iso, councilEntry: t.entry, stop: t.stop, t1: t.t1, riskCash: rv.riskCash, ...(rv.margin != null ? { margin: rv.margin } : {}), ...(rv.minLot ? { minLot: true } : {}), ...(t.shadow ? { shadow: true } : {}),
            ...fillQuality(t, (ev.deal && ev.deal.executionPrice) ?? (filled && ev.position ? ev.position.price : null), now) };
          if (st.wait) delete st.wait[t.id];
          out.sent.push({ type: 'open', trade: t.id }); say(`${filled ? 'opened' : 'sent (fill not confirmed yet)'} ${sell ? 'sell' : 'buy'} ${name} ${volume / +info.lotSize} lot (council ${t.k})`, { trade: t.id });
          alert('open', t.id, st.map[t.id], () => ({ filled, price: (ev.deal && ev.deal.executionPrice) ?? (filled && ev.position ? ev.position.price : null) ?? null,
            entry: t.entry, stop: t.stop, t1: t.t1, noTarget: !('relativeTakeProfit' in order) }));
        } catch (e) { if (RETRY.test(`${e.code || ''} ${e.message}`)) later(`order rejected: ${e.message}`); else skip(`order rejected: ${e.message}`);
          // no answer at all (timeout, dropped connection) is not a rejection: the order may be live and is looked up by label/comment
          // next round (step 0, which then sends the open alert); only a broker's answer is alerted as a rejection
          if ((st.skipped || {})[t.id] && !(!e.code && UNSURE.test(e.message))) alert('reject', t.id, null, () => ({ symbol: name, side: t.side, lots: volume / +info.lotSize, result: st.skipped[t.id] })); }
      }
    }
    // housekeeping: skip/retry notes matter only while a trade can still be copied; finished positions are kept LIMITS.keepDays
    for (const k of ['skipped', 'wait']) for (const id of Object.keys(st[k] || {})) { const t = byId.get(id); if (!t || now - (t.filled || t.opened) > LIMITS.fresh) delete st[k][id]; }
    for (const [id, m] of Object.entries(st.map)) if (m.closedAt && now - Date.parse(m.closedAt) / 1000 > LIMITS.keepDays * 86400) delete st.map[id];
    st.status = `ok · demo ${acc.brokerTitleShort || ''} · balance ${balance} · ${openCount()} open`.trim();
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
  const trades = (Array.isArray(raw) ? raw : raw.trades || []).concat(ictCandidates(ict));
  const saveTokens = (t) => { fs.mkdirSync(CD, { recursive: true }); fs.writeFileSync(path.join(CD, 'tokens.json'), JSON.stringify(t)); };
  let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(path.join(DIR, 'config.json'), 'utf8')) || {}; } catch (e) {}
  const shadows = cfg.mirrorShadow !== false;   // 8 Nov, owner: shadows mirrored too; config.json mirrorShadow: false turns it off
  const prev = rd('mirror.json', {}), r = await mirrorRound({ env: process.env, trades, state: prev.state, tokens: rd('tokens.json', null), specs: rd('symbols.json', null), onTokens: saveTokens, shadows });
  fs.mkdirSync(CD, { recursive: true });
  fs.writeFileSync(path.join(CD, 'mirror.json'), JSON.stringify({ state: r.state, log: (prev.log || []).concat(r.log).slice(-300), limits: LIMITS, symbols: SYMBOLS, execution: executionStats(r.state.map) }, null, 1));
  if (r.tokens && JSON.stringify(r.tokens) !== JSON.stringify(rd('tokens.json', null))) saveTokens(r.tokens);
  console.log(`cTrader mirror: ${r.state.status}${r.sent.length ? ` · ${r.sent.length} sent` : ''}`);
  // phone alerts, after mirror.json is saved (already flagged there, so a crash here never re-sends them): best-effort only
  // a burst (the catch-up round, or many closes at once) goes as one summary instead of a phone message per position
  if (r.alerts.length > 6) { const n = r.alerts.length, opens = r.alerts.filter((a) => a.kind === 'open').length, closes = r.alerts.filter((a) => a.kind === 'close').length;
    r.alerts = [{ kind: 'summary', n, opens, closes, other: n - opens - closes, catchUp: !(prev.state && prev.state.catchUpAt) && !!r.state.catchUpAt }]; }
  if (r.alerts.length) {
    let tgChat = null; try { tgChat = JSON.parse(fs.readFileSync(path.join(DIR, 'state.json'), 'utf8')).tgChat || null; } catch (e) {}   // the council's remembered chat
    const a = await sendMirrorAlerts(r.alerts, { env: process.env, tgChat });
    const errs = Object.entries(a.errors).map(([k, v]) => `${k} ${v}`).join('; ');
    console.log(`cTrader mirror alerts: ${a.sent} sent${errs ? ` · errors: ${errs}` : ''}`);
  }
}
