// Four Equinox rules on one cTrader DEMO account (24 Nov 2026, owner: "Break fade / Big-candle fade / FVG return / gold breakout
// — put all these running on demo account finishing 144 risking 0.25% per trade max 30 trades open at same time").
// A forward DEMO record of paper rules. The three fade / gap rules passed their studies BEFORE costs and lose after costs; the gold
// breakout passed at the broker's own quotes on in-sample years and its forward record is short. None of it is an edge.
//
// The signals are the Equinox desks' own code (council/edge-desks-2.mjs, which runs each study's exported signal code), read LIVE
// on this job's own OANDA 5-minute candles (MD_BASE, as the Trader): closed candles plus the FORMING candle's open only (its high /
// low / close are set to its open), so a signal is known at the close of its candle and the fill candle is the one now forming.
//   fade     Break fade (grid7-wide-fade m15 none atr 2R all): market, stop 1 ATR(14) of M15 from the fill, 2R, out after a day
//   bigfade  Big-candle fade (big-candle-fade m15 k1.5 nobreak half): market, stop past the candle's extreme + 0.1 ATR, its 50 %
//   fvg      FVG return (grid7-fvg-wide 1h mkt large 1R): market with the gap, stop past its far side + 0.1 ATR, 1R, out after 2 days
//   goldvb   gold breakout T1: council/vb-demo.mjs's own step (levels, stop orders, fill handling, 21:00 UTC exit) under this label
// The three fades enter at market, so: a signal is taken only while FRESH (its fill candle opened at most FRESH_S ago), and only
// when the price now is not past its stop or target and not more than LATE_R of its risk into the trade (late-copy check). Then
// a market order with the rule's stop and target as distances from the price now (relativeStopLoss / relativeTakeProfit, the way
// the mirror copies), read back after the fill. One order per signal id, ever.
//
// Rule 1: every order carries its stop; a filled position is read back and, with no stop at the broker, the stop is set by amend
// or the position is closed at once; any 'eqx' position found without a stop is amended to its record's stop or closed. Rule 2:
// the demo host, CTRADER_ENV=demo, an account reporting isLive false (gotobi's connect(), the mirror's message allowlist).
// Label 'eqx', comment "eqx <desk> <id>": the mirror (its own label) never touches these and these never touch its ICT copies.
// Caps: 0.25 % of the balance a trade (config eqx.risk; the smallest volume only while a stop-out costs at most 1 %), at most 30
// 'eqx' positions + resting orders on the account (only label eqx is counted); at the cap a new signal is recorded 'skip: cap'.
// Exits: the broker's stop and target, and the rule's own time limit (closed at market when reached). An exit not seen at the broker
// is inferred from the 5-minute candles after the fill (stop first in one candle) and marked `inferred`.
// Account: config eqx.account, default 10152144. config.json eqx = { on: false } stops it. Record: council-data eqx/trades.json.
import fs from 'node:fs';
import path from 'node:path';
import { PT, scrubber, orderStep, amendStep, normName, relative } from './ctrader-mirror.mjs';
import { connect } from './gotobi.mjs';
import { MARKETS as DOMK, usdPer } from './dom-demo.mjs';
import { fadeTrades, bigTrades, fvgTrades, STUDY_MARKETS } from './edge-desks-2.mjs';
import * as VB from './vb-demo.mjs';

export const LABEL = 'eqx', ACCOUNT = '10152144', RISK = 0.0025, MAX_OPEN = 30, MAX_RISK = 0.01, FRESH_S = 600, LATE_R = 0.25, KEEP = 5000;
const DAY = 86400, M5S = 300;
export const DESKS = {
  fade: { read: fadeTrades, cap: DAY, markets: STUDY_MARKETS, name: 'Break fade' },
  bigfade: { read: bigTrades, cap: DAY, markets: STUDY_MARKETS, name: 'Big-candle fade' },
  fvg: { read: fvgTrades, cap: 2 * DAY, markets: STUDY_MARKETS, name: 'FVG return' } };
export const ALL = ['fade', 'bigfade', 'fvg', 'goldvb'];
export const commentOf = (desk, id) => `${LABEL} ${desk} ${id}`;
// the gold breakout through vb-demo's own step, under this label (record market key 'goldvb', the candles of 'xau')
export const VB_MARKETS = { goldvb: { ...VB.MARKETS.xau, label: LABEL, comment: (day) => commentOf('goldvb', `xau-${day}`) } };
const LIVE = (x) => x.status === 'placed' || x.status === 'open';
const NOTNOW = /MARKET_CLOSED|SYMBOL_HAS_HOLIDAY|NO_QUOTES|TRADING_DISABLED|not tradable now/;

// rows [[t, o, h, l, c]] (the forming candle may be last) -> the desks' candles: closed ones plus the forming candle's open alone
export function feed(rows, now) {
  const out = [], last = rows && rows.length ? rows[rows.length - 1] : null;
  for (const r of rows || []) if (r[0] + M5S <= now) out.push({ time: r[0], open: +r[1], high: +r[2], low: +r[3], close: +r[4] });
  if (last && last[0] + M5S > now && last[0] <= now) out.push({ time: last[0], open: +last[1], high: +last[1], low: +last[1], close: +last[1] });
  return { '5m': out };
}
// fresh signals of one desk on one market: the rule's record, its fill candle opened within FRESH_S, still open on the candles
export function signals(desk, market, rows, now) {
  const D = DESKS[desk]; if (!D || !D.markets.includes(market)) return [];
  return D.read(feed(rows, now), { from: now - FRESH_S, market })
    .filter((r) => r.t <= now && now - r.t <= FRESH_S && r.status === 'open' && (r.log || []).every((x) => x.t == null || x.t <= r.t + M5S))
    .map((r) => ({ desk, market, id: r.id, side: r.side, t: r.t, entry: r.entry, stop: r.stop, target: r.target, deadline: r.t + D.cap }));
}
// the late-copy check at the price now: null = placeable, else why not
export function lateCheck(g, px) {
  const s = g.side, risk = Math.abs(g.entry - g.stop);
  if (!(px > 0) || !(risk > 0) || !(s * (g.entry - g.stop) > 0)) return 'no price or no stop on the losing side';
  if (s * (px - g.stop) <= 0) return 'the price is past the stop';
  if (g.target != null && s * (g.target - px) <= 0) return 'the price is past the target';
  if ((s * (px - g.entry)) / risk > LATE_R) return `the price is more than ${LATE_R}R into the trade`;
  return null;
}
// the exit after a fill read from 5-minute candles (stop first when one candle holds both)
export function inferExit(rec, rows, from) {
  const s = rec.side;
  for (const r of rows || []) { if (r[0] + M5S <= from) continue; const h = +r[2], l = +r[3];
    if (s > 0 ? l <= rec.stop : h >= rec.stop) return { exit: rec.stop, how: 'stop (inferred from the 5-minute candles)', at: r[0] };
    if (rec.target != null && (s > 0 ? h >= rec.target : l <= rec.target)) return { exit: rec.target, how: 'target (inferred from the 5-minute candles)', at: r[0] }; }
  return null;
}
const Rof = (rec, exit) => (rec.fill != null && exit != null && rec.fill !== rec.stop ? +((rec.side * (exit - rec.fill)) / Math.abs(rec.fill - rec.stop)).toFixed(3) : null);
// live 'eqx' items in the records: a goldvb day with two resting stop orders counts 2
export const recCount = (J) => J.trades.reduce((n, x) => n + (!LIVE(x) ? 0 : x.market === 'goldvb' && x.status === 'placed' ? 2 : 1), 0);

export async function step({ env = process.env, dir = 'data', WS = globalThis.WebSocket, clock = () => Date.now(), bars: barsFn, save = () => {}, log = console.log, pause = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const scrub = scrubber(env), file = path.join(dir, 'eqx', 'trades.json'), now = Math.floor(clock() / 1000), iso = () => new Date(Math.floor(clock() / 1000) * 1000).toISOString();
  const read = () => { try { const J = JSON.parse(fs.readFileSync(file, 'utf8')); J.trades = J.trades || []; J.notOffered = J.notOffered || {}; return J; } catch (e) { if (fs.existsSync(file)) return null; return { trades: [], notOffered: {} }; } };
  let J = read(); if (!J) { log('eqx: eqx/trades.json does not parse: left as it is'); return { skipped: 'file' }; }
  let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8')); } catch (e) {}
  const C = cfg.eqx || {}; if (C.on === false) return { skipped: 'off' };
  if (String(env.CTRADER_MIRROR || '').trim().toLowerCase() !== 'on' || ['CTRADER_CLIENT_ID', 'CTRADER_CLIENT_SECRET', 'CTRADER_ACCESS_TOKEN', 'CTRADER_ENV'].some((x) => !env[x]) || String(env.CTRADER_ENV).trim().toLowerCase() !== 'demo') { log('eqx: cTrader demo not configured'); return { skipped: 'config' }; }
  const account = (C.account && String(C.account).trim()) || ACCOUNT;
  const risk = Math.min(0.005, Math.max(0.0005, +C.risk || RISK)), maxOpen = Math.max(1, Math.min(60, +C.maxOpen || MAX_OPEN));
  const desks = Array.isArray(C.desks) ? ALL.filter((d) => C.desks.includes(d)) : ALL;
  const write = () => { fs.mkdirSync(path.dirname(file), { recursive: true }); const tmp = file + '.tmp'; if (J.trades.length > KEEP) J.trades = J.trades.slice(-KEEP); J.at = iso(); fs.writeFileSync(tmp, JSON.stringify(J, null, 1)); fs.renameSync(tmp, file); save(); };
  // candles of every market a desk reads (a failed market is left out of this pass)
  const mk = [...new Set(desks.filter((d) => DESKS[d]).flatMap((d) => DESKS[d].markets))], rows = {}, px = {};
  await Promise.all(mk.map(async (k) => { try { rows[k] = await barsFn(k, now); const L = rows[k]; if (L.length) px[k] = +L[L.length - 1][4]; } catch (e) { log(`eqx: ${k}: ${scrub(String(e.message || e)).slice(0, 100)}`); } }));
  const have = new Set(J.trades.map((x) => x.id)), fresh = [];
  for (const d of desks) { if (!DESKS[d]) continue; for (const k of DESKS[d].markets) { if (!rows[k] || (J.notOffered[k] && now - J.notOffered[k] < DAY)) continue;
    try { for (const g of signals(d, k, rows[k], now)) if (!have.has(g.id)) { have.add(g.id); fresh.push(g); } } catch (e) { log(`eqx: ${d} ${k}: ${scrub(String(e.message || e)).slice(0, 120)}`); } } }
  const mine = J.trades.filter((x) => LIVE(x) && DESKS[x.desk]);
  const did = []; let dirty = false;
  if (fresh.length || mine.length) {
    let s = null, ctid;
    try {
      ({ s, ctid } = await connect({ env, dir, account, WS, scrub }));
      let rc = await s.send(PT.RECONCILE_REQ, { ctidTraderAccountId: ctid }, PT.RECONCILE_RES), positions = rc.position || [], orders = rc.order || [];
      const ours = (x) => (x.tradeData || {}).label === LABEL, cm = (x) => String((x.tradeData || {}).comment || '');
      const closePos = (p) => s.send(PT.CLOSE_POSITION_REQ, { ctidTraderAccountId: ctid, positionId: Number(p.positionId), volume: +p.tradeData.volume }, PT.EXECUTION_EVENT, orderStep);
      const guard = async (rec, p) => {   // RULE 1
        if (+p.stopLoss > 0) { rec.brokerStop = +p.stopLoss; return true; }
        try { const q = { ctidTraderAccountId: ctid, positionId: Number(p.positionId), stopLoss: rec.stop }; if (rec.target != null) q.takeProfit = rec.target;
          await s.send(PT.AMEND_POSITION_SLTP_REQ, q, PT.EXECUTION_EVENT, amendStep); rec.stopSetBy = 'amend'; rec.brokerStop = rec.stop; return true; }
        catch (e) { const ev = await closePos(p); Object.assign(rec, { status: 'closed', exit: +(ev.deal && ev.deal.executionPrice) || null, how: 'closed at once: the broker took no stop', closedSeen: iso() }); rec.R = Rof(rec, rec.exit); return false; }
      };
      // 1. open positions of this job's three market rules
      for (const rec of mine) {
        try {
          const p = positions.find((x) => ours(x) && cm(x) === commentOf(rec.desk, rec.id));
          if (p) {
            if (rec.status === 'placed') Object.assign(rec, { status: 'open', fill: +p.price || rec.fill || null, positionId: String(p.positionId) });
            const had = rec.brokerStop; if (!(await guard(rec, p))) { dirty = true; did.push(`${rec.id} closed: no stop`); continue; } if (rec.brokerStop !== had) dirty = true;
            if (now >= rec.deadline) { const ev = await closePos(p); Object.assign(rec, { status: 'closed', exit: +(ev.deal && ev.deal.executionPrice) || null, how: now - rec.deadline > 300 ? 'time exit, late' : 'time exit', closedSeen: iso() }); rec.R = Rof(rec, rec.exit); dirty = true; did.push(`${rec.id} time exit`); }
            continue;
          }
          const fT = rec.filledAt ? Date.parse(rec.filledAt) / 1000 : rec.t, x = inferExit(rec, rows[rec.market], fT - M5S);
          Object.assign(rec, { status: 'closed', closedSeen: iso(), inferred: true, exit: x ? x.exit : null, how: x ? x.how : 'closed at the broker; exit unknown (neither level on the 5-minute candles yet)' }); rec.R = x ? Rof(rec, x.exit) : null;
          dirty = true; did.push(`${rec.id} closed`);
        } catch (e) { log(`eqx: ${rec.id}: ${scrub(String(e.message || e)).slice(0, 160)}`); }
      }
      // 2. any 'eqx' position without a stop: amended to its record's stop, else closed (rule 1)
      for (const p of positions.filter(ours)) { if (+p.stopLoss > 0) continue;
        const rec = J.trades.find((x) => LIVE(x) && (DESKS[x.desk] ? commentOf(x.desk, x.id) : x.market === 'goldvb' ? VB_MARKETS.goldvb.comment(x.day) : null) === cm(p)), stop = rec ? rec.stop ?? rec.O : null;
        try { if (stop > 0) { await guard({ ...(rec || {}), stop, target: rec && DESKS[rec.desk] ? rec.target : null }, p); continue; } await closePos(p); log(`eqx: closed an 'eqx' position without a stop and without a record (${cm(p)})`); did.push('orphan closed'); }
        catch (e) { log('eqx: a position without a stop could not be closed: ' + scrub(String(e.message || e)).slice(0, 120)); } }
      // 3. new signals
      if (fresh.length) {
        let count = Math.max(recCount(J), positions.filter(ours).length + orders.filter(ours).length);
        const names = await s.send(PT.SYMBOLS_LIST_REQ, { ctidTraderAccountId: ctid }, PT.SYMBOLS_LIST_RES), idOfName = new Map((names.symbol || []).filter((x) => x.enabled !== false).map((x) => [normName(x.symbolName), x.symbolId]));
        const tr = (await s.send(PT.TRADER_REQ, { ctidTraderAccountId: ctid }, PT.TRADER_RES)).trader || {}, md = Number.isFinite(+tr.moneyDigits) ? +tr.moneyDigits : 2, balance = tr.balance != null ? Number(tr.balance) / 10 ** md : null;
        const infoOf = {}, placed = [];
        for (const g of fresh) {
          const M = DOMK[g.market], base = { id: g.id, desk: g.desk, market: g.market, side: g.side, t: g.t, entry: g.entry, stop: g.stop, target: g.target, deadline: g.deadline, seenAt: iso(), account: `…${String(account).slice(-3)}` };
          if (count >= maxOpen) { J.trades.push({ ...base, status: 'skip', why: 'cap' }); dirty = true; did.push(`${g.id} skip: cap`); continue; }
          const p0 = px[g.market], late = lateCheck(g, p0);
          if (late) { J.trades.push({ ...base, status: 'skip', why: late, price: p0 }); dirty = true; did.push(`${g.id} skip: late`); continue; }
          const symName = M && M.names.find((n) => idOfName.has(normName(n)));
          if (!symName) { J.notOffered[g.market] = now; dirty = true; log(`eqx: ${g.market} is not offered on this account: skipped for a day`); continue; }
          if (positions.some((x) => ours(x) && cm(x) === commentOf(g.desk, g.id))) { J.trades.push({ ...base, status: 'open', adopted: true }); count++; dirty = true; continue; }   // a lost record: never placed twice
          try {
            const symbolId = idOfName.get(normName(symName)), info = infoOf[symbolId] ||= ((await s.send(PT.SYMBOL_BY_ID_REQ, { ctidTraderAccountId: ctid, symbolId: [symbolId] }, PT.SYMBOL_BY_ID_RES)).symbol || [])[0] || {};
            const digits = Number.isFinite(+info.digits) ? +info.digits : 5, q = usdPer(M.quote, px);
            if (!(q > 0)) throw Object.assign(new Error(`no ${M.quote} rate for the size`), { skip: true });
            if (!(balance > 0)) throw new Error('no balance read');
            const lossUnit = Math.abs(p0 - g.stop) * q, stepV = +info.stepVolume || 1, min = +info.minVolume || stepV, max = +info.maxVolume || Infinity;
            let volume = Math.floor((balance * risk / lossUnit) * 100 / stepV) * stepV, riskNow = risk;
            if (volume > max) volume = Math.floor(max / stepV) * stepV;
            if (!(volume >= min)) { riskNow = (min / 100) * lossUnit / balance; if (!(riskNow <= MAX_RISK)) throw Object.assign(new Error('the smallest volume would risk more than 1 % of the balance'), { skip: true }); volume = min; }
            const order = { ctidTraderAccountId: ctid, symbolId, orderType: 1, tradeSide: g.side > 0 ? 1 : 2, volume, relativeStopLoss: relative(p0 - g.stop, digits),
              label: LABEL, comment: commentOf(g.desk, g.id), clientOrderId: `eqx-${g.id}`.slice(0, 50) };   // 1: MARKET
            if (g.target != null) order.relativeTakeProfit = relative(g.target - p0, digits);
            const ev = await s.send(PT.NEW_ORDER_REQ, order, PT.EXECUTION_EVENT, orderStep);
            const pos = ev.position || {}, rec = { ...base, status: 'open', price: p0, volume, balance, digits, risk: +riskNow.toFixed(5), fill: +(ev.deal && ev.deal.executionPrice) || +pos.price || null, positionId: pos.positionId != null ? String(pos.positionId) : null, filledAt: iso() };
            J.trades.push(rec); placed.push(rec); count++; dirty = true; did.push(`${g.id} placed`); log(`eqx: ${g.desk} ${g.market} ${g.side > 0 ? 'buy' : 'sell'} at market near ${p0}, stop ${g.stop}, target ${g.target}, volume ${volume}`);
          } catch (e) { const why = scrub(String((e && e.message) || e)).slice(0, 160);
            if (NOTNOW.test(why)) { log(`eqx: ${g.id}: ${why} (not tradable now)`); J.trades.push({ ...base, status: 'skip', why }); dirty = true; continue; }
            J.trades.push({ ...base, status: e.skip ? 'skip' : 'error', why }); dirty = true; did.push(`${g.id} ${e.skip ? 'skip' : 'error'}`); log(`eqx: ${g.id}: ${why}`); }
        }
        // read the new positions back: a stop at the broker, else amend, else close (rule 1)
        if (placed.length) { await pause(1500); rc = await s.send(PT.RECONCILE_REQ, { ctidTraderAccountId: ctid }, PT.RECONCILE_RES); positions = rc.position || [];
          for (const rec of placed) { const p = positions.find((x) => ours(x) && cm(x) === commentOf(rec.desk, rec.id)); if (!p) continue;
            if (rec.positionId == null) rec.positionId = String(p.positionId); if (!rec.fill) rec.fill = +p.price || null;
            try { await guard(rec, p); } catch (e) { log(`eqx: ${rec.id}: the stop could not be checked: ${scrub(String(e.message || e)).slice(0, 120)}`); } } }
      }
    } catch (e) { log('eqx: ' + scrub(String((e && e.message) || e)).slice(0, 160)); did.push('error'); }
    finally { if (s) s.close(); if (dirty) write(); }
  }
  // 4. the gold breakout: vb-demo's step on this account, this label and this file; its two resting orders count toward the cap
  if (desks.includes('goldvb')) {
    const J2 = read() || J;
    const out = await VB.step({ env, dir, WS, clock, bars: barsFn ? (sym, t) => barsFn(sym, t) : undefined, save, log, pause, markets: VB_MARKETS, file, conf: { on: true, risk }, account, keep: KEEP, canPlace: () => recCount(J2) + 2 <= maxOpen, tag: 'eqx goldvb' });
    if (out && out.did) did.push(...out.did.map((x) => 'gold breakout ' + x));
  }
  return { did };
}

if (process.argv[1] && process.argv[1].endsWith('eqx-demo.mjs')) {
  const dir = process.argv[2] || 'data'; const { execFileSync } = await import('node:child_process');
  const save = () => { try { execFileSync('node', ['council/datasync.mjs', dir, 'save', `Equinox demo ${new Date().toISOString().slice(0, 16)}Z`, 'eqx/trades.json'], { stdio: 'inherit' }); } catch (e) { console.log('eqx: save failed (kept locally)'); } };
  const out = await step({ dir, bars: VB.oandaRows, save }); if (out.did && out.did.length) console.log('eqx:', out.did.join(', '));
}
