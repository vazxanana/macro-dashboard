// The live account's snapshot for the site (27 Nov 2026, owner: "okey" to a live account card). READ ONLY: it connects the way the
// live jobs do (council/live.mjs liveConnect: CTRADER_LIVE=on, config.json live on, the one live account named there) and sends
// only TRADER_REQ, RECONCILE_REQ and SYMBOLS_LIST_REQ: no order, amend or close message is in this file (a test reads it).
// Writes council-data live/account.json: balance, the day's start and loss against the daily stop (live/day.json), open positions
// and resting orders. The login is masked; no token or account id is written.
//   node council/live-account.mjs <dataDir>
import fs from 'node:fs';
import path from 'node:path';
import { PT, scrubber } from './ctrader-mirror.mjs';
import { liveConfig, liveEnvOk, liveConnect } from './live.mjs';
import { readConfig } from './owner-config.mjs';

const SIDE = { 1: 'buy', 2: 'sell' };
// pure: the broker's answers -> the file's shape
export function shape({ trader, positions, orders, names, day, at, cfg }) {
  const md = Number.isFinite(+trader.moneyDigits) ? +trader.moneyDigits : 2, money = (v) => (v == null ? null : +(Number(v) / 10 ** md).toFixed(2));
  const nameOf = (id) => (names.find((n) => String(n.symbolId) === String(id)) || {}).symbolName || String(id);
  const balance = money(trader.balance), L = liveConfig(cfg);
  const pos = (positions || []).map((p) => {
    const td = p.tradeData || {};
    return { symbol: nameOf(td.symbolId), side: SIDE[td.tradeSide] || String(td.tradeSide), volume: +td.volume || null, entry: +p.price || null,
      stop: +p.stopLoss > 0 ? +p.stopLoss : null, target: +p.takeProfit > 0 ? +p.takeProfit : null, label: td.label || null,
      openedAt: td.openTimestamp ? new Date(+td.openTimestamp).toISOString() : null, swap: money(p.swap) };
  });
  const ord = (orders || []).map((o) => { const td = o.tradeData || {};
    return { symbol: nameOf(td.symbolId), side: SIDE[td.tradeSide] || String(td.tradeSide), volume: +td.volume || null, price: +o.limitPrice || +o.stopPrice || null,
      stop: +o.stopLoss > 0 ? +o.stopLoss : null, target: +o.takeProfit > 0 ? +o.takeProfit : null, label: td.label || null }; });
  const today = at.slice(0, 10), d = day && day.day === today && day.start > 0 ? day : null;
  return { at, account: L.tail ? '…' + L.tail.slice(-3) : null, balance, dayStop: L.dayStop || null, risk: L.risk || null, goldRisk: L.goldRisk || null,
    day: d ? { day: d.day, start: d.start, loss: balance > 0 ? +((d.start - balance) / d.start).toFixed(4) : null } : { day: today, start: null, loss: null },
    positions: pos, orders: ord, noStop: pos.filter((p) => p.stop == null).length };
}

export async function snapshot({ env = process.env, dir = 'data', WS = globalThis.WebSocket, now = Date.now() } = {}) {
  const cfg = readConfig(dir), L = liveConfig(cfg);
  if (L.off) return { off: L.off };
  if (!liveEnvOk(env)) return { off: 'CTRADER_LIVE is not on' };
  const scrub = scrubber(); let s;
  try {
    let ctid; ({ s, ctid } = await liveConnect({ env, dir, account: L.account, WS, scrub }));
    const trader = (await s.send(PT.TRADER_REQ, { ctidTraderAccountId: ctid }, PT.TRADER_RES)).trader || {};
    const rc = await s.send(PT.RECONCILE_REQ, { ctidTraderAccountId: ctid }, PT.RECONCILE_RES);
    const names = (await s.send(PT.SYMBOLS_LIST_REQ, { ctidTraderAccountId: ctid }, PT.SYMBOLS_LIST_RES)).symbol || [];
    let day = null; try { day = JSON.parse(fs.readFileSync(path.join(dir, 'live', 'day.json'), 'utf8')); } catch (e) {}
    return shape({ trader, positions: rc.position, orders: rc.order, names, day, at: new Date(now).toISOString(), cfg });
  } finally { if (s) s.close(); }
}

if (process.argv[1] && process.argv[1].endsWith('live-account.mjs')) {
  const dir = process.argv[2] || 'data';
  try {
    const out = await snapshot({ dir });
    if (out.off) { console.log('live account:', out.off); process.exit(0); }
    const f = path.join(dir, 'live', 'account.json'); fs.mkdirSync(path.dirname(f), { recursive: true });
    const tmp = f + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(out, null, 1)); fs.renameSync(tmp, f);
    console.log(`live account: balance ${out.balance}, ${out.positions.length} open, ${out.orders.length} resting`);
  } catch (e) { console.log('live account: could not be read:', String(e && e.message || e).slice(0, 160)); }
}
