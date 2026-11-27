// The H1 dominant-zone limit on the Council cTrader DEMO account (23 Nov 2026, owner: "Do h1 dom (all markets) to one of the
// demo acc use the one with no trades active"). A forward DEMO record of the one family the three combination grids
// (research/edge/combo-grid, -2, -3) found when judged BEFORE costs; after costs every grid failed, and the holdout test of the
// rule (research/edge/dom-zone-holdout) is still to run. Never call it an edge: it is a before-cost tilt being watched.
//
// The rule (the grids' own zone, imported, not copied: combo-grid-3 buildZones('dom')):
// - a DOM zone = two consecutive CLOSED H1 candles of one colour, the second closing beyond the first's extreme (up: close and
//   high above the first's high; down mirrors); zone = the FIRST candle's body; up -> a buy zone, down -> a sell zone. It stands
//   until a closed H1 candle closes through its far side or 120 H1 candles pass. A forming candle never makes or ends a zone.
// - the order: a LIMIT at the near edge (buy: body top; sell: body bottom); stop = far side -/+ (half the round-trip cost +
//   0.25 x ATR(14) of H1 at the order); target = entry +/- 2 x risk. Costs = combo-grid-2 COSTS.
// - armed only for a standing zone on the right side of the price (buy zone below it, sell zone above), its near edge within
//   1 x ATR(14) of the latest price, never traded before: one order per zone, ever (id <market>-<side>-<first candle time>).
//   GOOD_TILL_DATE 24 h; an expired order is recorded 'expired' and never re-armed; a resting order is cancelled at once when
//   its zone no longer stands (a closed H1 candle through its far side, or its 120 candles are over).
// - caps: at most 3 orders + positions a market, 20 on the account (this job's own; owner, 23 Nov 2026: "allow 20 positions
//   open, risk 0.5%"); risk 0.5 % of the balance a trade (config.json dom.risk, 0.0005-0.005); under the broker's smallest volume the smallest is used only while a stop-out costs
//   at most 1 % of the balance. config.json dom = { on: false } stops it.
//
// Every order carries stopLoss AND takeProfit as absolute prices (absolute rule 1); after a fill the position is read back and,
// should the broker show no stop, it is set by amend or the position is closed at once; any position labelled 'dom' found
// without a stop and without a record is closed. Paper and demo only (absolute rule 2): the demo host, an account that reports
// isLive false, the mirror's message allowlist (session()), through the gotobi job's connect(). Label 'dom' and comment
// "dom <id>": the mirror only manages its own label ('council'), and council/forward.mjs E5 leaves 'dom' items out.
//
// Account: the Council demo account (the mirror's 'council' book = CTRADER_ACCOUNT_ID); config.json dom.account overrides.
// Run by the council loop each round and quick pass (council.yml, `timeout 45`, never fails the round). It reads H1 candles of
// every market each pass; with no order to place and nothing resting or open it does not connect. Record: council-data
// dom/trades.json. The closing deal is not read (the mirror's allowlist has no deal list): an exit is inferred from the H1
// candles after the fill (stop first when one candle holds both) and marked `inferred`.
import fs from 'node:fs';
import path from 'node:path';
import { PT, scrubber, orderStep, pendingStep, cancelStep, amendStep, normName } from './ctrader-mirror.mjs';
import { connect, accountFor } from './gotobi.mjs';
import { buildZones } from '../research/edge/combo-grid-3/run.mjs';
import { COSTS } from '../research/edge/combo-grid-2/run.mjs';
import { readConfig } from './owner-config.mjs';

export const LABEL = 'dom';
// A second, separate record (26 Nov 2026, owner: "yes do gold dom 4r on demo"): `node council/dom-demo.mjs data --variant gold4r`.
// The same zone, order, stop and guards on GOLD ONLY with a 4R target (the cell of research/edge/dom-gold-hourcost that made
// +0.072R a trade at measured costs in 2024-now and -0.015R in 2021-23: it FAILED its test, so this is a forward demo record to
// see which half repeats, never an edge). Its own label ('dom4': the base job never touches its orders, nor it the base job's),
// its own file dom4/trades.json and config key (config.dom4 = { on, account, risk }). Account: config.dom4.account, else the
// gotobi job's (the Shadows + LIT demo account), never the base job's small account. Risk 0.25 % of the balance a trade.
export const VARIANTS = { gold4r: { key: 'dom4', label: 'dom4', rr: 4, markets: ['xau'], risk: 0.0025, name: 'Gold DOM 4R demo' } };
const BASE = { key: 'dom', label: LABEL, rr: null, markets: null, risk: null, name: 'H1 DOM demo' };
let V = BASE;
export const RISK = 0.005, RISK_MIN = 0.0005, RISK_MAX = 0.01, MAX_RISK = 0.01, MAX_MARKET = 3, MAX_TOTAL = 20, LIFE_S = 24 * 3600, RR = 2, ATR_K = 0.25, NEAR_ATR = 1;
export const STALE_S = 2 * 3600;          // a market whose newest candle is older than this is shut: nothing is armed there
const H = 3600, DAY = 86400;
// market -> broker names to try (normalised) and the currency its price is quoted in (for the size)
export const DESK_MARKETS = ['xau', 'audusd', 'usdjpy', 'usdcad', 'eurjpy', 'audjpy', 'eurgbp', 'nas100'];
export const MARKETS = {
  xau: { names: ['XAUUSD'], quote: 'USD' }, xag: { names: ['XAGUSD'], quote: 'USD' },
  eurusd: { names: ['EURUSD'], quote: 'USD' }, gbpusd: { names: ['GBPUSD'], quote: 'USD' }, audusd: { names: ['AUDUSD'], quote: 'USD' }, nzdusd: { names: ['NZDUSD'], quote: 'USD' },
  usdjpy: { names: ['USDJPY'], quote: 'JPY' }, usdcad: { names: ['USDCAD'], quote: 'CAD' }, usdchf: { names: ['USDCHF'], quote: 'CHF' },
  eurjpy: { names: ['EURJPY'], quote: 'JPY' }, gbpjpy: { names: ['GBPJPY'], quote: 'JPY' }, audjpy: { names: ['AUDJPY'], quote: 'JPY' }, cadjpy: { names: ['CADJPY'], quote: 'JPY' },
  eurgbp: { names: ['EURGBP'], quote: 'GBP' }, euraud: { names: ['EURAUD'], quote: 'AUD' },
  nas100: { names: ['NAS100', 'US100', 'USTEC'], quote: 'USD' },                    // the mirror's names (ctrader/symbols.json: NAS100)
  spx500: { names: ['US500', 'SPX500', 'US500.cash'], quote: 'USD' },               // ctrader/symbols.json: US500
  de40: { names: ['GER40', 'DE40', 'GER30', 'DE30', 'DAX40', 'GER40.cash'], quote: 'EUR' } };   // not in any file yet: the first name the broker lists wins
// the USD value of one unit of a quote currency, from the latest prices of the job's own markets (null = unknown: no trade)
export function usdPer(quote, px) {
  if (quote === 'USD') return 1;
  const p = (k) => (px && px[k] > 0 ? px[k] : null);
  if (quote === 'JPY') return p('usdjpy') ? 1 / p('usdjpy') : null;
  if (quote === 'CAD') return p('usdcad') ? 1 / p('usdcad') : null;
  if (quote === 'CHF') return p('usdchf') ? 1 / p('usdchf') : null;
  if (quote === 'GBP') return p('gbpusd');
  if (quote === 'AUD') return p('audusd');
  if (quote === 'EUR') return p('eurusd');
  return null;
}

export const idOf = (market, side, t) => `${market}-${side}-${t}`;
export const commentOf = (id) => `${V.label} ${id}`;
// ATR(14): the mean true range of the last 14 closed candles (needs 15)
export function atr14(L) { if (L.length < 15) return null; let s = 0; for (let i = L.length - 14; i < L.length; i++) s += Math.max(L[i].h - L[i].l, Math.abs(L[i].h - L[i - 1].c), Math.abs(L[i].l - L[i - 1].c)); return s / 14; }
// rows [[t, o, h, l, c]] (the forming candle may be the last) -> closed candles, the zones (all, with `stands`), ATR, last price
export function read(rows, now) {
  const L = (rows || []).filter((r) => r[0] + H <= now).map((r) => ({ t: r[0], o: +r[1], h: +r[2], l: +r[3], c: +r[4], e: r[0] + H }));
  const last = rows && rows.length ? rows[rows.length - 1] : null, price = last ? +last[4] : null, lastT = last ? last[0] : null;
  const zones = L.length >= 2 ? buildZones('dom', L).map((z) => { const side = z.d > 0 ? 'buy' : 'sell', t1 = L[z.i - 1].t;
    return { side, bot: z.bot, top: z.top, t: t1, formed: z.at, end: z.end, stands: !Number.isFinite(z.end) || z.end > now }; }) : [];
  return { L, zones, atr: atr14(L), price, lastT };
}
// the order for one zone (prices unrounded); null when the levels leave no room
export function plan(z, atr, cost, rr = V.rr || RR) {
  const s = z.side === 'buy' ? 1 : -1, entry = s > 0 ? z.top : z.bot, pad = cost / 2 + ATR_K * atr, stop = s > 0 ? z.bot - pad : z.top + pad, risk = Math.abs(entry - stop);
  if (!(risk > 0)) return null;
  return { entry, stop, target: entry + s * rr * risk, risk };
}
// zones to arm on one market now: standing, right side of the price, near edge within 1 ATR, not traded before
export function armable(market, R, have) {
  if (!(R.atr > 0) || !(R.price > 0)) return [];
  return R.zones.filter((z) => z.stands && !have.has(idOf(market, z.side, z.t)) && (z.side === 'buy' ? R.price > z.top && R.price - z.top <= NEAR_ATR * R.atr : R.price < z.bot && z.bot - R.price <= NEAR_ATR * R.atr));
}
// the exit after a fill read from H1 candles (stop first when one candle holds both); null = neither reached on the candles
export function inferExit(rec, L, from) {
  const s = rec.side === 'buy' ? 1 : -1;
  for (const b of L) { if (b.e <= from) continue;
    const hitS = s > 0 ? b.l <= rec.stop : b.h >= rec.stop, hitT = s > 0 ? b.h >= rec.target : b.l <= rec.target;
    if (hitS) return { exit: rec.stop, how: 'stop (inferred from the H1 candles)', at: b.t };
    if (hitT) return { exit: rec.target, how: 'target (inferred from the H1 candles)', at: b.t }; }
  return null;
}
const Rof = (rec, exit) => (rec.fill != null && exit != null && rec.fill !== rec.stop ? +((rec.side === 'buy' ? 1 : -1) * (exit - rec.fill) / Math.abs(rec.fill - rec.stop)).toFixed(3) : null);
const LIVE = (x) => x.status === 'placed' || x.status === 'open';
const NOTNOW = /MARKET_CLOSED|SYMBOL_HAS_HOLIDAY|NO_QUOTES|TRADING_DISABLED|not tradable now/;

export async function step({ env = process.env, dir = 'data', WS = globalThis.WebSocket, clock = () => Date.now(), bars: barsFn, save = () => {}, log: log0 = console.log, variant = null } = {}) {
  V = variant ? VARIANTS[variant] : BASE; if (!V) throw new Error('dom: unknown variant ' + variant);
  const log = V === BASE ? log0 : (m) => log0(String(m).replace(/^dom:/, V.key + ':'));
  const scrub = scrubber(env), file = path.join(dir, V.key, 'trades.json'), now = Math.floor(clock() / 1000), iso = () => new Date(Math.floor(clock() / 1000) * 1000).toISOString();
  let J; try { J = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { if (fs.existsSync(file)) { log(`dom: ${V.key}/trades.json does not parse: left as it is`); return { skipped: 'file' }; } J = { trades: [] }; }
  J.trades = J.trades || []; J.notOffered = J.notOffered || {};
  const cfg = readConfig(dir);   // config.json with the owner's demo settings on top (council/owner-config.mjs)
  const C = cfg[V.key] || {}; if (C.on === false) return { skipped: 'off' };
  if (String(env.CTRADER_MIRROR || '').trim().toLowerCase() !== 'on' || ['CTRADER_CLIENT_ID', 'CTRADER_CLIENT_SECRET', 'CTRADER_ACCESS_TOKEN', 'CTRADER_ENV'].some((x) => !env[x]) || String(env.CTRADER_ENV).trim().toLowerCase() !== 'demo') { log('dom: cTrader demo not configured'); return { skipped: 'config' }; }
  const account = (C.account && String(C.account).trim()) || (V === BASE ? String(env.CTRADER_ACCOUNT_ID || '').trim() : String(accountFor(dir, env, cfg) || '').trim()); if (!account) { log('dom: no demo account for it'); return { skipped: 'account' }; }
  const risk = Math.min(RISK_MAX, Math.max(RISK_MIN, +C.risk || V.risk || RISK));
  // 25 Nov 2026 (owner: "All the orders must be the ones included in the edge"): the job arms the DOM desk's eight markets (a test
  // compares DESK_MARKETS with council/edge-desks-2.mjs); config.dom.markets may narrow them further, never widen
  const markets = Object.keys(MARKETS).filter((k) => DESK_MARKETS.includes(k) && (!V.markets || V.markets.includes(k)) && (!Array.isArray(C.markets) || C.markets.includes(k)));
  // candles of every market (a failed market is left out of this pass)
  const R = {}, px = {};
  await Promise.all(markets.map(async (k) => { try { const rows = await barsFn(k, now); R[k] = read(rows, now); if (R[k].price > 0) px[k] = R[k].price; } catch (e) { log(`dom: ${k}: ${scrub(String(e.message || e)).slice(0, 100)}`); } }));
  // 24 Nov 2026 (owner: the DOM job moved to a new $100 demo account): a record belongs to the account it was placed on (`acct`;
  // a record from before has none = the default account). Records of another account are left as they are: their orders and
  // positions carry their own stop, target and 24 h expiry at the broker, and this pass never reads or counts them.
  const tag = (a) => '…' + String(a || '').replace('*', '').trim().slice(-4), cur = tag(account), dflt = tag(env.CTRADER_ACCOUNT_ID), here = (x) => (x.acct || dflt) === cur;   // a tag, never the account number
  const have = new Set(J.trades.map((x) => x.id)), live = J.trades.filter((x) => LIVE(x) && here(x)), perMarket = (k) => J.trades.filter((x) => LIVE(x) && here(x) && x.market === k).length;
  const arms = [];
  for (const k of markets) { const r = R[k]; if (!r || !(r.lastT != null && now - r.lastT <= STALE_S)) continue;
    if (J.notOffered[k] && now - J.notOffered[k] < DAY) continue;
    for (const z of armable(k, r, have)) arms.push({ k, z }); }
  if (!arms.length && !live.length) return { skipped: 'nothing due' };
  const write = () => { fs.mkdirSync(path.dirname(file), { recursive: true }); const tmp = file + '.tmp'; if (J.trades.length > 5000) J.trades = J.trades.slice(-5000); J.at = iso(); fs.writeFileSync(tmp, JSON.stringify(J, null, 1)); fs.renameSync(tmp, file); save(); };
  const did = []; let s = null, ctid, dirty = false;
  try {
    ({ s, ctid } = await connect({ env, dir, account, WS, scrub }));
    if (J.conn && J.conn.error) { J.conn = { ok: true, acct: cur, since: iso() }; dirty = true; }   // back after a refusal: said once
    const rc = await s.send(PT.RECONCILE_REQ, { ctidTraderAccountId: ctid }, PT.RECONCILE_RES), positions = rc.position || [], orders = rc.order || [];
    const mine = (x) => (x.tradeData || {}).label === V.label, byComment = (list, id) => list.find((x) => mine(x) && String((x.tradeData || {}).comment || '') === commentOf(id));
    const sideOf = (td) => (+td.tradeSide === 2 || td.tradeSide === 'SELL' ? 'sell' : 'buy');
    const closePos = async (p) => s.send(PT.CLOSE_POSITION_REQ, { ctidTraderAccountId: ctid, positionId: Number(p.positionId), volume: +p.tradeData.volume }, PT.EXECUTION_EVENT, orderStep);
    // RULE 1 on a filled position: a stop at the broker, else set by amend, else closed at once
    const guard = async (rec, p) => {
      if (+p.stopLoss > 0) { rec.brokerStop = +p.stopLoss; return true; }
      try { await s.send(PT.AMEND_POSITION_SLTP_REQ, { ctidTraderAccountId: ctid, positionId: Number(p.positionId), stopLoss: rec.stop, takeProfit: rec.target }, PT.EXECUTION_EVENT, amendStep); rec.stopSetBy = 'amend'; rec.brokerStop = rec.stop; return true; }
      catch (e) { const ev = await closePos(p); Object.assign(rec, { status: 'closed', exit: +(ev.deal && ev.deal.executionPrice) || null, how: 'closed at once: the broker took no stop', closedSeen: iso() }); rec.R = Rof(rec, rec.exit); return false; }
    };
    // 1. what is resting or open
    for (const rec of live) {
      try {
        const p = byComment(positions, rec.id), o = byComment(orders, rec.id), r = R[rec.market];
        if (p) {
          if (rec.status === 'placed') { Object.assign(rec, { status: 'open', fill: +p.price || null, positionId: String(p.positionId), filledAt: p.tradeData.openTimestamp ? new Date(+p.tradeData.openTimestamp).toISOString() : iso() }); dirty = true; did.push(`${rec.id} filled`); }
          const had = rec.brokerStop; await guard(rec, p); if (rec.brokerStop !== had || rec.status === 'closed') dirty = true;
          if (o) { try { await s.send(PT.CANCEL_ORDER_REQ, { ctidTraderAccountId: ctid, orderId: Number(o.orderId) }, PT.EXECUTION_EVENT, cancelStep); } catch (e) {} }
          continue;
        }
        if (rec.status === 'open') {   // the position is gone: its stop or its target at the broker (the deal is not read)
          const fT = rec.filledAt ? Date.parse(rec.filledAt) / 1000 : Date.parse(rec.placedAt) / 1000, x = r ? inferExit(rec, r.L, fT - H) : null;
          Object.assign(rec, { status: 'closed', closedSeen: iso(), inferred: true, exit: x ? x.exit : null, how: x ? x.how : 'closed at the broker; exit unknown (neither level on the H1 candles yet)' }); rec.R = x ? Rof(rec, x.exit) : null;
          dirty = true; did.push(`${rec.id} closed`); continue;
        }
        // placed, no position
        const zone = r ? r.zones.find((z) => z.t === rec.zone.t && z.side === rec.side) : null, gone = r && (!zone || !zone.stands);
        if (o) {
          if (gone || now >= rec.expiresAt) {
            try { await s.send(PT.CANCEL_ORDER_REQ, { ctidTraderAccountId: ctid, orderId: Number(o.orderId) }, PT.EXECUTION_EVENT, cancelStep);
              Object.assign(rec, { status: now >= rec.expiresAt ? 'expired' : 'cancelled', how: now >= rec.expiresAt ? 'not filled in 24 h' : 'the zone no longer stands (a closed H1 candle through its far side, or its 120 candles are over)', closedSeen: iso() }); dirty = true; did.push(`${rec.id} ${rec.status}`); }
            catch (e) { /* filled meanwhile: the next look sees the position */ }
          }
          continue;
        }
        if (now >= rec.expiresAt - 60) { Object.assign(rec, { status: 'expired', how: 'not filled in 24 h (removed by the broker)', closedSeen: iso() }); dirty = true; did.push(`${rec.id} expired`); continue; }
        // the order left before its expiry with no position: filled and closed between two looks, or removed by hand
        const pT = Date.parse(rec.placedAt) / 1000, filled = r && r.L.some((b) => b.e > pT && (rec.side === 'buy' ? b.l <= rec.entry : b.h >= rec.entry));
        if (filled) { const x = inferExit({ ...rec, fill: rec.entry }, r.L, pT); rec.fill = rec.entry;
          Object.assign(rec, { status: 'closed', closedSeen: iso(), inferred: true, exit: x ? x.exit : null, how: 'filled and closed between two looks: ' + (x ? x.how : 'exit unknown') }); rec.R = x ? Rof(rec, x.exit) : null; }
        else Object.assign(rec, { status: 'cancelled', how: 'the order left the account before its expiry, unfilled (removed outside this job)', closedSeen: iso() });
        dirty = true; did.push(`${rec.id} ${rec.status}`);
      } catch (e) { log(`dom: ${rec.id}: ${scrub(String(e.message || e)).slice(0, 160)}`); }
    }
    // 2. any 'dom' position with no stop and no record: closed (rule 1)
    for (const p of positions.filter(mine)) { const c = String((p.tradeData || {}).comment || ''); if (+p.stopLoss > 0 || J.trades.some((x) => here(x) && commentOf(x.id) === c && x.status === 'open')) continue;
      try { await closePos(p); log(`dom: closed a 'dom' position without a stop and without a record (${c})`); did.push('orphan closed'); } catch (e) { log('dom: an orphan without a stop could not be closed: ' + scrub(String(e.message || e)).slice(0, 120)); } }
    // 3. new orders
    if (arms.length) {
      const names = await s.send(PT.SYMBOLS_LIST_REQ, { ctidTraderAccountId: ctid }, PT.SYMBOLS_LIST_RES), idOfName = new Map((names.symbol || []).filter((x) => x.enabled !== false).map((x) => [normName(x.symbolName), x.symbolId]));
      const tr = (await s.send(PT.TRADER_REQ, { ctidTraderAccountId: ctid }, PT.TRADER_RES)).trader || {}, md = Number.isFinite(+tr.moneyDigits) ? +tr.moneyDigits : 2, balance = tr.balance != null ? Number(tr.balance) / 10 ** md : null;
      const infoOf = {};
      for (const { k, z } of arms) {
        const id = idOf(k, z.side, z.t), M = MARKETS[k], r = R[k];
        if (J.trades.filter((x) => LIVE(x) && here(x)).length >= MAX_TOTAL) { log(`dom: ${MAX_TOTAL} orders and positions already: nothing more this pass`); break; }
        if (perMarket(k) >= MAX_MARKET) continue;
        if (J.trades.some((x) => x.id === id)) continue;
        const symName = M.names.find((n) => idOfName.has(normName(n)));
        if (!symName) { J.notOffered[k] = now; dirty = true; log(`dom: ${k} is not offered on this account (${M.names.join(', ')}): skipped for a day`); did.push(`${k} not offered`); continue; }
        const symbolId = idOfName.get(normName(symName));
        // adopted: the broker already holds this zone's order or position (a pass whose record was lost): never placed twice
        const po = byComment(orders, id), pp = byComment(positions, id);
        const P = plan(z, r.atr, COSTS[k] || 0), base = { id, market: k, side: z.side, zone: { t: z.t, bot: z.bot, top: z.top, formed: z.formed }, atr: +r.atr.toPrecision(6), symbol: symName, placedAt: iso(), expiresAt: now + LIFE_S, account: `…${String(account).slice(-3)}`, acct: cur };
        if (po || pp) { Object.assign(base, P || {}, { status: pp ? 'open' : 'placed', adopted: true }); if (pp) { Object.assign(base, { fill: +pp.price || null, positionId: String(pp.positionId) }); await guard(base, pp); } J.trades.push(base); dirty = true; did.push(`${id} adopted`); continue; }
        try {
          if (!P) throw Object.assign(new Error('the levels leave no room'), { skip: true });
          const info = infoOf[symbolId] ||= ((await s.send(PT.SYMBOL_BY_ID_REQ, { ctidTraderAccountId: ctid, symbolId: [symbolId] }, PT.SYMBOL_BY_ID_RES)).symbol || [])[0] || {};
          const digits = Number.isFinite(+info.digits) ? +info.digits : 5, at = (v) => +(+v).toFixed(digits), sgn = z.side === 'buy' ? 1 : -1;
          const entry = at(P.entry), stop = at(P.stop), target = at(P.target);
          if (!(sgn * (entry - stop) > 0) || !(sgn * (target - entry) > 0)) throw Object.assign(new Error('after rounding the stop or the target is not on its side'), { skip: true });
          const q = usdPer(M.quote, px); if (!(q > 0)) throw Object.assign(new Error(`no ${M.quote} rate for the size`), { skip: true });
          // volume: cTrader units x 100, a multiple of the step; one unit loses |entry - stop| in the quote currency at the stop
          const lossUnit = Math.abs(entry - stop) * q, stepV = +info.stepVolume || 1, min = +info.minVolume || stepV, max = +info.maxVolume || Infinity;
          if (!(balance > 0)) throw new Error('no balance read');
          let volume = Math.floor((balance * risk / lossUnit) * 100 / stepV) * stepV, riskNow = risk;
          if (volume > max) volume = Math.floor(max / stepV) * stepV;
          if (!(volume >= min)) { riskNow = (min / 100) * lossUnit / balance; if (!(riskNow <= MAX_RISK)) throw Object.assign(new Error('the smallest volume would risk more than 1 % of the balance'), { skip: true }); volume = min; }
          const order = { ctidTraderAccountId: ctid, symbolId, orderType: 2, tradeSide: sgn > 0 ? 1 : 2, volume, limitPrice: entry, stopLoss: stop, takeProfit: target,
            label: V.label, comment: commentOf(id), clientOrderId: id.slice(0, 50), timeInForce: 1, expirationTimestamp: (now + LIFE_S) * 1000 };   // 2: LIMIT, 1: GOOD_TILL_DATE
          const ev = await s.send(PT.NEW_ORDER_REQ, order, PT.EXECUTION_EVENT, pendingStep);
          Object.assign(base, { entry, stop, target, risk: +riskNow.toFixed(5), volume, balance, digits, status: 'placed', orderId: ev.order && ev.order.orderId != null ? String(ev.order.orderId) : null });
          J.trades.push(base); dirty = true; did.push(`${id} placed`); log(`dom: ${k} ${z.side} limit ${entry}, stop ${stop}, target ${target}, volume ${volume}`);
        } catch (e) { const why = scrub(String((e && e.message) || e)).slice(0, 160);
          if (NOTNOW.test(why)) { log(`dom: ${id}: ${why} (tried again next pass)`); continue; }
          J.trades.push({ ...base, status: e.skip ? 'skip' : 'error', why }); dirty = true; did.push(`${id} ${e.skip ? 'skip' : 'error'}`); log(`dom: ${id}: ${why}`); }
      }
    }
  } catch (e) { const msg = scrub(String((e && e.message) || e)).slice(0, 160); log('dom: ' + msg);
    // 24 Nov 2026: a refused connection (an account the token does not hold, say) is written down once, so the file says why
    // nothing happens (it was only in the run's log)
    if (!s && (!J.conn || J.conn.error !== msg || J.conn.acct !== cur)) { J.conn = { error: msg, acct: cur, since: iso() }; dirty = true; }
    return { error: true, did }; }
  finally { if (s) s.close(); if (dirty) write(); }
  return { did };
}

// OANDA mid H1 candles through the site's candle proxy (the forming one included), the last 16 days
export async function oandaRows(sym, now, base = process.env.MD_BASE || 'https://aureumdesk.co.uk/md/') {
  const r = await fetch(`${base.replace(/\/?$/, '/')}bars?sym=${sym}&tf=1h&from=${now - 16 * DAY}&to=${now + H}`, { signal: AbortSignal.timeout(12000) }); if (!r.ok) throw new Error(`candles: HTTP ${r.status}`);
  const j = await r.json(); return (j.bars || []).map((b) => [b.time, +b.open, +b.high, +b.low, +b.close]).sort((a, b) => a[0] - b[0]);
}
if (process.argv[1] && process.argv[1].endsWith('dom-demo.mjs')) {
  const dir = process.argv[2] || 'data'; const { execFileSync } = await import('node:child_process');
  const vi = process.argv.indexOf('--variant'), variant = vi > 0 ? process.argv[vi + 1] : null, W = variant ? VARIANTS[variant] : BASE;
  if (!W) { console.log('dom: unknown variant ' + variant); process.exit(1); }
  const save = () => { try { execFileSync('node', ['council/datasync.mjs', dir, 'save', `${W.name} ${new Date().toISOString().slice(0, 16)}Z`, `${W.key}/trades.json`], { stdio: 'inherit' }); } catch (e) { console.log(W.key + ': save failed (kept locally)'); } };
  const out = await step({ dir, bars: oandaRows, save, variant }); if (out.did && out.did.length) console.log(W.key + ':', out.did.join(', '));
}
