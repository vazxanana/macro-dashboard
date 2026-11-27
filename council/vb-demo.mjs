// The volatility breakout on a cTrader DEMO account (21 Nov 2026, owner: "3 and 4": put the two rules that passed their tests
// on a demo account). The rule is the studies' T1, unchanged (research/edge/gold-vol-breakout and usdjpy-vol-breakout-early:
// PASS; filled at the demo broker's own ticks in gold-vol-breakout-exec and usdjpy-vol-breakout-exec): at the day's 00:00 UTC
// open O, a buy stop at O + 0.5 x the previous trading day's range and a sell stop at O - 0.5 x that range; the first one
// reached fills and the other is cancelled; the stop is the open O; out at 21:00 UTC unless stopped; one trade a day a market.
// Markets: gold (XAUUSD) and USD/JPY.
//
// Every order carries its stop (absolute rule 1): both resting orders are placed WITH stopLoss = O; after a fill the position
// is read back and, should the broker show no stop, the stop is set by amend or the position is closed at once.
// Paper and demo only (absolute rule 2): the demo host, an account that reports isLive false, the mirror's message allowlist
// (session()), through the gotobi job's connect(). Its own labels ("vb-xau", "vb-usdjpy"): the mirror never touches these and
// these never touch the mirror's.
//
// Run by the council loop each round and quick pass (council.yml, `timeout 45`, never fails the round): step() looks at the
// clock and at its own record (council-data vb/trades.json) and does at most what the minute needs: place the two orders in
// the first twenty minutes of the day, cancel the other order once one filled (or once the trade stopped), close and cancel at
// 21:00 UTC. With nothing to do it does not connect. A forward record, not an edge: judged against the studies' numbers.
import fs from 'node:fs';
import path from 'node:path';
import { PT, scrubber, orderStep, pendingStep, cancelStep, amendStep } from './ctrader-mirror.mjs';
import { connect, accountFor, units, volumeOf } from './gotobi.mjs';
import { buildDays } from '../research/edge/gold-vol-breakout/run.mjs';
import { modeOf, dayGate } from './live.mjs';

export const K = 0.5, EXIT_S = 21 * 3600, PLACE_FROM = 15, PLACE_UNTIL = 1200, RISK = 0.0025, MAX_RISK = 0.01;
export const MARKETS = {
  xau: { sym: 'xau', symbol: 'XAUUSD', label: 'vb-xau', name: 'gold', usdPerUnit: (D) => D },                 // one ounce loses D dollars
  usdjpy: { sym: 'usdjpy', symbol: 'USDJPY', label: 'vb-usdjpy', name: 'USD/JPY', usdPerUnit: (D, px) => D / px } };   // one unit loses D yen
const DAY = 86400, ymdOf = (t) => new Date(t * 1000).toISOString().slice(0, 10), d0Of = (t) => Math.floor(t / DAY) * DAY;
const weekday = (t) => { const w = new Date(t * 1000).getUTCDay(); return w >= 1 && w <= 5; };

// the day's two levels from closed 5-minute candles plus the day's first candle (its open is fixed once it starts):
// the study's own days (buildDays: weekend candles folded into the next weekday) give the previous trading day's range
export function levels(rows, t) {
  const d0 = d0Of(t), days = buildDays(rows.filter((r) => r[0] < d0 + DAY)), d = days.find((x) => x.d0 === d0);
  if (!d || !d.bars.length) return { why: 'no candle of the day yet' };
  if (d.bars[0].t - d0 >= 3600) return { why: 'the day has no candle in its first hour' };
  if (!(d.prevRange > 0)) return { why: 'no range for the previous trading day' };
  const O = d.bars[0].o, D = K * d.prevRange, hi = Math.max(...d.bars.map((b) => b.h)), lo = Math.min(...d.bars.map((b) => b.l));
  return { O, D, prevRange: d.prevRange, buyAt: O + D, sellAt: O - D, hi, lo };   // hi / lo: the day so far (a level already traded is a missed day)
}
// what the minute needs for one market's record of the day: 'place' | 'watch' | 'exit' | null
export function due(rec, t) {
  const d0 = d0Of(t), s = t - d0;
  if (!rec) return weekday(t) && s >= PLACE_FROM && s <= PLACE_UNTIL ? 'place' : null;
  if (rec.status !== 'placed' && rec.status !== 'open') return null;
  return t >= rec.exitAt ? 'exit' : 'watch';
}
const sizeOf = (M, info, balance, risk, D, px) => volumeOf(info, units(balance, risk, M.usdPerUnit(D, px) * px, px));   // units(): balance x risk / (D / price); here D / price is the dollar loss a unit
const oursPos = (M, day) => (p) => { const td = p.tradeData || {}; return td.label === M.label && String(td.comment || '').includes(day); };
const R1 = (rec, exit) => (rec.fill != null && exit != null && rec.O != null && rec.fill !== rec.O ? +((rec.side === 'buy' ? 1 : -1) * (exit - rec.fill) / Math.abs(rec.fill - rec.O)).toFixed(3) : null);

export async function step({ env = process.env, dir = 'data', WS = globalThis.WebSocket, clock = () => Date.now(), bars: barsFn, save = () => {}, log = console.log, pause = (ms) => new Promise((r) => setTimeout(r, ms)), mode = 'demo' } = {}) {
  let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8')); } catch (e) {}
  const X = modeOf(mode, cfg, env, { dir, name: 'vb', file: path.join(dir, 'vb', 'trades.json'), label: (x) => x, connect });   // the live account (27 Nov 2026): council/live.mjs
  if (X.live && X.off) return { skipped: 'off', why: X.off };
  const LM = (M) => (X.live ? { ...M, label: X.label(M.label) } : M);
  const scrub = scrubber(env), file = X.file, now = Math.floor(clock() / 1000), day = ymdOf(now), iso = () => new Date(Math.floor(clock() / 1000) * 1000).toISOString();
  let J; try { J = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { if (fs.existsSync(file)) { log('vb: vb/trades.json does not parse: left as it is'); return { skipped: 'file' }; } J = { trades: [] }; }
  J.trades = J.trades || [];
  if (!X.live && cfg.vb && cfg.vb.on === false) return { skipped: 'off' };
  // what is there to do this minute? (an open record of an earlier day is still due its exit)
  const work = [];
  for (const k of Object.keys(MARKETS)) { const open = J.trades.filter((x) => x.market === k && (x.status === 'placed' || x.status === 'open'));
    for (const r of open) work.push({ k, rec: r, what: due(r, now) });
    if (!J.trades.some((x) => x.market === k && x.day === day) && due(null, now) === 'place') work.push({ k, rec: null, what: 'place' }); }
  // a weekday whose first twenty minutes no pass looked at (the loop down or handing over) is written as missed, once, without
  // connecting (23 Nov 2026: such a day left no record, so the demo record could not be set beside the forward record day by day)
  const s0 = now - d0Of(now), late = weekday(now) && s0 > PLACE_UNTIL && s0 < EXIT_S ? Object.keys(MARKETS).filter((k) => !J.trades.some((x) => x.market === k && x.day === day)) : [];
  if (!work.length && !late.length) return { skipped: 'nothing due' };
  if (!X.live && (String(env.CTRADER_MIRROR || '').trim().toLowerCase() !== 'on' || ['CTRADER_CLIENT_ID', 'CTRADER_CLIENT_SECRET', 'CTRADER_ACCESS_TOKEN', 'CTRADER_ENV'].some((x) => !env[x]) || String(env.CTRADER_ENV).trim().toLowerCase() !== 'demo')) { log('vb: cTrader demo not configured'); return { skipped: 'config' }; }
  const account = X.live ? X.account : (cfg.vb && cfg.vb.account && String(cfg.vb.account)) || accountFor(dir, env, { gotobi: cfg.gotobi }); if (!account) { log('vb: no demo account for it'); return { skipped: 'account' }; }
  const risk = X.live ? X.risk : Math.min(0.01, Math.max(0.0005, +(cfg.vb && cfg.vb.risk) || RISK));
  const write = () => { fs.mkdirSync(path.dirname(file), { recursive: true }); const tmp = file + '.tmp'; if (J.trades.length > 2000) J.trades = J.trades.slice(-2000); fs.writeFileSync(tmp, JSON.stringify(J, null, 1)); fs.renameSync(tmp, file); save(); };
  const did = []; let s = null, ctid, dirty = false;
  for (const k of late) { J.trades.push({ id: `${k}-${day}`, market: k, day, status: 'missed', why: 'no order was placed in the first twenty minutes of the day, 00:00-00:20 UTC (no pass looked, or the demo could not be reached)', exitAt: d0Of(now) + EXIT_S, account: `…${String(account).slice(-3)}` }); dirty = true; did.push(`${k} missed`); }
  if (!work.length) { write(); return { did }; }
  try {
    ({ s, ctid } = await X.connect({ env, dir, account, WS, scrub }));
    const rc = await s.send(PT.RECONCILE_REQ, { ctidTraderAccountId: ctid }, PT.RECONCILE_RES), positions = rc.position || [], orders = rc.order || [];
    const cancel = async (M, d) => { for (const o of orders.filter((x) => (x.tradeData || {}).label === M.label && String((x.tradeData || {}).comment || '').includes(d) && !x._gone)) { try { await s.send(PT.CANCEL_ORDER_REQ, { ctidTraderAccountId: ctid, orderId: Number(o.orderId) }, PT.EXECUTION_EVENT, cancelStep); } catch (e) { /* filled or gone meanwhile: the next look sees it */ } o._gone = true; } };
    for (const w of work) { const M = LM(MARKETS[w.k]);
      try {
        if (w.what === 'place') {
          const rows = await barsFn(M.sym, now), L = levels(rows, now), last = rows.length ? rows[rows.length - 1][4] : null;
          const rec = { id: `${w.k}-${day}`, market: w.k, day, status: 'skip', exitAt: d0Of(now) + EXIT_S, account: `…${String(account).slice(-3)}` };
          if (L.why) { rec.why = L.why; J.trades.push(rec); dirty = true; did.push(`${w.k} skip`); continue; }
          Object.assign(rec, { O: L.O, prevRange: L.prevRange, D: L.D, buyAt: L.buyAt, sellAt: L.sellAt });
          if (orders.some(oursPos(M, day)) || positions.some(oursPos(M, day))) {   // placed by a pass whose record was lost: never placed twice
            const mine = orders.filter(oursPos(M, day)), ids = {}; for (const o of mine) ids[+o.tradeData.tradeSide === 2 || o.tradeData.tradeSide === 'SELL' ? 'sell' : 'buy'] = String(o.orderId);
            Object.assign(rec, { status: 'placed', placedAt: iso(), stop: +(mine[0] ? mine[0].stopLoss : L.O), orders: ids, adopted: true }); J.trades.push(rec); dirty = true; did.push(`${w.k} adopted`); continue; }
          if (!(L.hi < L.buyAt && L.lo > L.sellAt && last > L.sellAt && last < L.buyAt)) { rec.status = 'missed'; rec.why = 'a level had already traded when the orders were to be placed'; J.trades.push(rec); dirty = true; did.push(`${w.k} missed`); continue; }
          const names = await s.send(PT.SYMBOLS_LIST_REQ, { ctidTraderAccountId: ctid }, PT.SYMBOLS_LIST_RES), sym = (names.symbol || []).find((x) => String(x.symbolName).toUpperCase().replace(/[^A-Z]/g, '') === M.symbol);
          if (!sym) throw new Error(`${M.symbol} is not offered on this account`);
          const info = ((await s.send(PT.SYMBOL_BY_ID_REQ, { ctidTraderAccountId: ctid, symbolId: [sym.symbolId] }, PT.SYMBOL_BY_ID_RES)).symbol || [])[0] || {}, digits = Number.isFinite(+info.digits) ? +info.digits : 2, at = (v) => +(+v).toFixed(digits);
          const tr = (await s.send(PT.TRADER_REQ, { ctidTraderAccountId: ctid }, PT.TRADER_RES)).trader || {}, md = Number.isFinite(+tr.moneyDigits) ? +tr.moneyDigits : 2, balance = tr.balance != null ? Number(tr.balance) / 10 ** md : null;
          // the size that risks `risk` of the balance; when that is under the broker's smallest volume, the smallest volume is
          // used as long as a stop-out then costs no more than MAX_RISK of the balance (gold on a small demo balance), else no trade
          if (X.live) { const gt = dayGate(dir, balance, now, X.dayStop); if (!gt.ok) { rec.why = gt.why; J.trades.push(rec); dirty = true; did.push(`${w.k} daily stop`); continue; } }
          let volume = sizeOf(M, info, balance, risk, L.D, last), riskNow = risk;
          if (!volume) { const min = +info.minVolume || +info.stepVolume || 0, loss = (min / 100) * M.usdPerUnit(L.D, last); riskNow = balance > 0 ? loss / balance : Infinity;
            if (!(min > 0 && riskNow <= MAX_RISK)) throw new Error('the smallest volume would risk more than 1 % of the balance'); volume = min; }
          const stop = at(L.O), base = { ctidTraderAccountId: ctid, symbolId: sym.symbolId, orderType: 3, volume, stopLoss: stop, label: M.label, comment: `${M.label} ${day}`, timeInForce: 1, expirationTimestamp: rec.exitAt * 1000 };   // 3: STOP order, 1: GOOD_TILL_DATE
          if (!(stop < at(L.buyAt) && stop > at(L.sellAt))) throw new Error('the levels do not leave a stop on the losing side');
          const ids = {};
          const b = await s.send(PT.NEW_ORDER_REQ, { ...base, tradeSide: 1, stopPrice: at(L.buyAt), clientOrderId: `${rec.id}-b` }, PT.EXECUTION_EVENT, pendingStep); ids.buy = b.order && b.order.orderId != null ? String(b.order.orderId) : null;
          try { const q = await s.send(PT.NEW_ORDER_REQ, { ...base, tradeSide: 2, stopPrice: at(L.sellAt), clientOrderId: `${rec.id}-s` }, PT.EXECUTION_EVENT, pendingStep); ids.sell = q.order && q.order.orderId != null ? String(q.order.orderId) : null; }
          catch (e) { if (ids.buy) try { await s.send(PT.CANCEL_ORDER_REQ, { ctidTraderAccountId: ctid, orderId: Number(ids.buy) }, PT.EXECUTION_EVENT, cancelStep); } catch (e2) {} throw new Error('the sell order was refused (the buy order was cancelled): ' + e.message); }
          Object.assign(rec, { status: 'placed', placedAt: iso(), volume, balance, risk: +riskNow.toFixed(5), stop, orders: ids, digits });
          J.trades.push(rec); dirty = true; did.push(`${w.k} placed`); log(`vb: ${M.name} buy stop ${at(L.buyAt)} / sell stop ${at(L.sellAt)}, stop ${stop}, volume ${volume}`); continue;
        }
        const rec = w.rec, p = positions.find(oursPos(M, rec.day));
        if (p && rec.status === 'placed') {   // one order filled: it is the day's trade
          Object.assign(rec, { status: 'open', side: +p.tradeData.tradeSide === 2 || p.tradeData.tradeSide === 'SELL' ? 'sell' : 'buy', fill: +p.price || null, positionId: String(p.positionId), filledSeen: iso() }); dirty = true;
          if (!(+p.stopLoss > 0)) {   // RULE 1
            try { await s.send(PT.AMEND_POSITION_SLTP_REQ, { ctidTraderAccountId: ctid, positionId: Number(p.positionId), stopLoss: rec.stop }, PT.EXECUTION_EVENT, amendStep); rec.stopSetBy = 'amend'; }
            catch (e) { const ev = await s.send(PT.CLOSE_POSITION_REQ, { ctidTraderAccountId: ctid, positionId: Number(p.positionId), volume: +p.tradeData.volume }, PT.EXECUTION_EVENT, orderStep); Object.assign(rec, { status: 'closed', exitAt2: iso(), exit: +(ev.deal && ev.deal.executionPrice) || null, how: 'closed at once: the broker took no stop' }); rec.R = R1(rec, rec.exit); }
          } else rec.brokerStop = +p.stopLoss;
          await cancel(M, rec.day); did.push(`${w.k} filled ${rec.side}`);
        } else if (!p && rec.status === 'open') {   // the position is gone before 21:00: its stop
          Object.assign(rec, { status: 'closed', exit: rec.stop, how: 'stopped at the broker', closedSeen: iso() }); rec.R = R1(rec, rec.exit); dirty = true; await cancel(M, rec.day); did.push(`${w.k} stopped`);
        } else if (!p && rec.status === 'placed' && w.what === 'watch') {   // an order that filled AND stopped between two looks leaves one order behind
          const left = orders.filter((x) => (x.tradeData || {}).label === M.label && String((x.tradeData || {}).comment || '').includes(rec.day)).length;
          if (left < 2 && now - Date.parse(rec.placedAt) / 1000 > 90) { Object.assign(rec, { status: 'closed', how: 'an order filled and stopped between two looks (the other was cancelled)', exit: rec.stop, R: -1, closedSeen: iso() }); dirty = true; await cancel(M, rec.day); did.push(`${w.k} filled and stopped`); }
        }
        if (w.what === 'exit' && (rec.status === 'placed' || rec.status === 'open')) {
          await cancel(M, rec.day);
          if (rec.status === 'open' && p) { const ev = await s.send(PT.CLOSE_POSITION_REQ, { ctidTraderAccountId: ctid, positionId: Number(p.positionId), volume: +p.tradeData.volume }, PT.EXECUTION_EVENT, orderStep);
            Object.assign(rec, { status: 'closed', exit: +(ev.deal && ev.deal.executionPrice) || null, how: now - rec.exitAt > 300 ? 'time exit, late' : 'time exit 21:00', closedSeen: iso() }); rec.R = R1(rec, rec.exit); }
          else if (rec.status === 'placed') Object.assign(rec, { status: 'nofill', how: 'neither level was reached by 21:00', closedSeen: iso() });
          dirty = true; did.push(`${w.k} ${rec.status}`);
        }
      } catch (e) { const why = scrub(String((e && e.message) || e)).slice(0, 160); log(`vb: ${w.k}: ${why}`);
        if (w.what === 'place') { J.trades.push({ id: `${w.k}-${day}`, market: w.k, day, status: 'error', why }); dirty = true; } did.push(`${w.k} error`); }
    }
  } catch (e) { log('vb: ' + scrub(String((e && e.message) || e)).slice(0, 160)); return { error: true, did }; }
  finally { if (s) s.close(); if (dirty) write(); }
  await pause(0); return { did };
}

// OANDA mid 5-minute candles (the studies' feed), the last 8 days, the forming candle included (the day's open is its open)
export async function oandaRows(sym, now, base = process.env.MD_BASE || 'https://aureumdesk.co.uk/md/') {
  const r = await fetch(`${base.replace(/\/?$/, '/')}bars?sym=${sym}&tf=5m&from=${now - 8 * DAY}&to=${now + 300}`, { signal: AbortSignal.timeout(15000) }); if (!r.ok) throw new Error(`candles: HTTP ${r.status}`);
  const j = await r.json(); return (j.bars || []).map((b) => [b.time, +b.open, +b.high, +b.low, +b.close]).sort((a, b) => a[0] - b[0]);
}
if (process.argv[1] && process.argv[1].endsWith('vb-demo.mjs')) {
  const dir = process.argv[2] || 'data'; const { execFileSync } = await import('node:child_process');
  const live = process.argv.includes('--live'), rel = live ? 'live' : 'vb/trades.json';
  const save = () => { try { execFileSync('node', ['council/datasync.mjs', dir, 'save', `Breakout ${live ? 'live' : 'demo'} ${new Date().toISOString().slice(0, 16)}Z`, rel], { stdio: 'inherit' }); } catch (e) { console.log('vb: save failed (kept locally)'); } };
  const out = await step({ dir, bars: oandaRows, save, mode: live ? 'live' : 'demo' }); if (out.did && out.did.length) console.log('vb:', out.did.join(', '));
}
