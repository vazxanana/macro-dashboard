// One TEST order on a cTrader DEMO account (24 Nov 2026, owner: "place a order as a test i will cancel it manually").
//   node council/test-order.mjs <dataDir>      (workflow demo-test-order.yml, started by hand only)
// A resting BUY LIMIT on EUR/USD 3 % under the price (it is not meant to fill), the broker's smallest volume, WITH a stop and a
// target on the order (absolute rule 1) and a 24-hour expiry, so it leaves by itself if nobody cancels it. Label 'aureum-test':
// the mirror and the demo jobs manage only their own labels, so nothing touches it. Demo only (absolute rule 2): the gotobi
// job's connect() (demo host, an account that reports isLive false, the mirror's message allowlist). Account: TEST_ACCOUNT
// ("*144" = the one demo account whose login ends so), else the Equinox book's account of council/ctrader-accounts.json.
// It writes nothing to council-data and never cancels, amends or closes anything.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PT, scrubber, pendingStep, normName } from './ctrader-mirror.mjs';
import { connect } from './gotobi.mjs';

export const LABEL = 'aureum-test', SYMBOL = 'EURUSD', MARKET = 'eurusd', BELOW = 0.03, STOP = 0.005, TARGET = 0.01, LIFE_S = 24 * 3600;
// the order's three prices from the latest price: entry far under it, the stop under the entry, the target over it
export function plan(px, digits = 5) {
  const at = (v) => +(+v).toFixed(digits), entry = at(px * (1 - BELOW)), stop = at(entry * (1 - STOP)), target = at(entry * (1 + TARGET));
  if (!(px > 0) || !(stop > 0 && stop < entry && entry < target && entry < px)) throw new Error('no usable price for the test order');
  return { entry, stop, target };
}
export function accountOf(env, file) {
  const t = String(env.TEST_ACCOUNT || '').trim(); if (t) return t;
  try { const a = JSON.parse(fs.readFileSync(file, 'utf8')).mirrorAccounts || {}; return String(a.eqx || '').trim() || null; } catch (e) { return null; }
}
export async function lastPrice(base = process.env.MD_BASE || 'https://aureumdesk.co.uk/md/', f = fetch) {
  const r = await f(`${base}bars?sym=${MARKET}&tf=5m&n=3`); if (!r.ok) throw new Error(`candles: HTTP ${r.status}`);
  const j = await r.json(), rows = j.bars || j.rows || j, last = rows[rows.length - 1], c = Array.isArray(last) ? +last[4] : +(last && (last.close ?? last.c));
  if (!(c > 0)) throw new Error('candles: no price'); return c;
}
export async function run({ env = process.env, dir = 'data', WS = globalThis.WebSocket, now = () => Math.floor(Date.now() / 1000), price = lastPrice, log = console.log } = {}) {
  const scrub = scrubber(env);
  if (String(env.CTRADER_ENV || '').trim().toLowerCase() !== 'demo') { log('test order: refused, CTRADER_ENV is not demo'); return { error: 'not demo' }; }
  const account = accountOf(env, path.join(path.dirname(fileURLToPath(import.meta.url)), 'ctrader-accounts.json'));
  if (!account) { log('test order: no demo account named'); return { error: 'no account' }; }
  const px = await price(), { s, ctid } = await connect({ env, dir, account, WS, scrub });
  try {
    const names = await s.send(PT.SYMBOLS_LIST_REQ, { ctidTraderAccountId: ctid }, PT.SYMBOLS_LIST_RES), sym = (names.symbol || []).find((x) => x.enabled !== false && normName(x.symbolName) === normName(SYMBOL));
    if (!sym) throw new Error(`${SYMBOL} is not offered on this account`);
    const info = ((await s.send(PT.SYMBOL_BY_ID_REQ, { ctidTraderAccountId: ctid, symbolId: [sym.symbolId] }, PT.SYMBOL_BY_ID_RES)).symbol || [])[0] || {};
    const digits = Number.isFinite(+info.digits) ? +info.digits : 5, P = plan(px, digits), volume = +info.minVolume || +info.stepVolume || 100000;
    const order = { ctidTraderAccountId: ctid, symbolId: sym.symbolId, orderType: 2, tradeSide: 1, volume, limitPrice: P.entry, stopLoss: P.stop, takeProfit: P.target,
      label: LABEL, comment: 'test order: cancel me', timeInForce: 1, expirationTimestamp: (now() + LIFE_S) * 1000 };   // 2: LIMIT, 1: BUY, 1: GOOD_TILL_DATE
    if (!(order.stopLoss > 0 && order.stopLoss < order.limitPrice)) throw new Error('no stop on the losing side: nothing sent');
    const ev = await s.send(PT.NEW_ORDER_REQ, order, PT.EXECUTION_EVENT, pendingStep);
    log(`test order placed on the demo account ending ${String(account).replace(/\D/g, '').slice(-3)}: ${SYMBOL} buy limit ${P.entry}, stop ${P.stop}, target ${P.target}, volume ${volume / 100} units, price now ${px}, expires in 24 h`);
    return { ok: true, ...P, volume, orderId: ev.order && ev.order.orderId != null ? String(ev.order.orderId) : null };
  } finally { s.close(); }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  run({ dir: process.argv[2] || 'data' }).then((r) => { if (!r || !r.ok) process.exitCode = 1; }).catch((e) => { console.log('test order: ' + scrubber(process.env)(String((e && e.message) || e)).slice(0, 200)); process.exitCode = 1; });
}
