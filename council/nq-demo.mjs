// The two Nasdaq leads that passed at the broker's own ticks, on a cTrader DEMO account (26 Nov 2026, owner: "Get the nasdaq
// ready"; rules "l1 and l5 only"; risk 1 % a trade, owner the same day: "1% for both"). The rules are the auto-researcher's frozen genomes (NQ1_LEADS l1, l5 in
// council/edge-desks-2.mjs; research/edge/nq1-leads-exec: +0.269R and +0.364R a trade after financing, in years the search had
// already read, so a candidate and not an edge): at the close of an H1 candle of NAS100 the engine's own triggers are read
// (research/edge/auto-researcher/engine.mjs sig / atr / sma / atrPct); a signal is a BUY at market at the next hour's open,
// stop `g.stop` x ATR(14) below the fill, target `g.rr` x that distance above, out after `g.hold` H1 candles; one position at
// a time a rule.
//
// Every order carries its stop (absolute rule 1): the market order goes WITH relativeStopLoss and relativeTakeProfit, the fill
// is read back and, should the broker show no stop, the stop is set by amend or the position is closed at once.
// DEMO ONLY (absolute rule 2): the demo host, CTRADER_ENV=demo and an account that reports isLive false, through the gotobi
// job's connect(), which refuses anything else. The owner has said he wants this job on a real account; that account does not
// exist yet and NOTHING here can reach one: a live switch is a separate, deliberate change with its own record.
// Its own labels ("nq-l1", "nq-l5"): the mirror never touches these and these never touch the mirror's.
//
// Run by the council loop each round and quick pass (council.yml, `timeout 45`, never fails the round). Once an hour, in its
// first minutes, it reads H1 candles; it connects only when a rule signals or one of its positions is open (stop guard, a
// position the broker closed, the time exit). A forward demo record, judged against the study's numbers.
import fs from 'node:fs';
import path from 'node:path';
import { PT, scrubber, orderStep, amendStep, relative } from './ctrader-mirror.mjs';
import { connect, accountFor, volumeOf } from './gotobi.mjs';
import { NQ1_LEADS, NQ2_GOLD } from './edge-desks-2.mjs';
import { modeOf, dayGate } from './live.mjs';
import { prep, toArrays, sig, atr, sma, atrPct } from '../research/edge/auto-researcher/engine.mjs';

// 26 Nov 2026 (owner: "usdjpy run", then "So the usdjpy risk 2%"): a third rule, `uj` = the auto-researcher's USD/JPY morning breakout (research/edge/usdjpy-brk-exec:
// PASS at the broker's own ticks, +0.250R a trade, n 131, in years the search had read; a candidate, not an edge), 2 % of the balance a trade. Its genome is that
// study's `G` (a test compares). Each rule names its market; the Nasdaq rules keep 1 %.
export const UJ = { id: 'uj', name: 'USD/JPY morning breakout', label: 'nq-uj', market: 'usdjpy', symbol: 'USDJPY', risk: 0.02, maxRisk: 0.02, dp: 3,
  g: { mk: 'usdjpy', trig: [{ kind: 'brk', N: 10 }], side: 'long', hours: [7, 13], dows: [2, 3, 4], trend: 'with', vol: 'none', volP: 0.5, stop: 3, rr: 3, hold: 8 } };
export const IDS = ['l1', 'l5', 'uj'], RISK = 0.01, MAX_RISK = 0.01, LOOK_FROM = 8, LOOK_UNTIL = 720, MAX_DRIFT = 0.25, MIN_BARS = 600, WARM = 210;
export const RULES = Object.fromEntries(IDS.map((id) => { if (id === UJ.id) return [id, UJ]; const L = NQ1_LEADS.find((x) => x.id === id); return [id, { id, name: L.name, label: `nq-${id}`, market: 'nas100', symbol: 'NAS100', dp: 2, g: L.g }]; }));
export const MARKETS = [...new Set(IDS.map((id) => RULES[id].market))];
// the live account (27 Nov 2026, owner: rules "All"): the three rules above and the gold 8-swing break (NQ2_GOLD: research/edge/gold-bo8-exec,
// PASS at the broker's own ticks on years the search had read, a candidate, not an edge), every rule at config.live.risk (council/live.mjs)
export const BO8 = { id: 'bo8', name: NQ2_GOLD.name, label: 'nq-bo8', market: 'xau', symbol: 'XAUUSD', dp: 2, g: NQ2_GOLD.g, costSkip: NQ2_GOLD.costSkip };
RULES.bo8 = BO8;
export const LIVE_IDS = [...IDS, 'bo8'], LIVE_MARKETS = [...new Set(LIVE_IDS.map((id) => RULES[id].market))];
// the dollars one unit loses over a stop distance: a Nasdaq unit one dollar a point; a USD/JPY unit `dist` yen = dist / price dollars
export const usdPerUnit = (market, dist, px) => (market === 'usdjpy' ? dist / px : dist);
const H = 3600, hourOf = (t) => Math.floor(t / H) * H;

// the engine's entry test at the close of bar i (research/edge/nq1-leads-exec/orders.mjs `orders`, one bar): null = no signal.
// nextT = the open time of the bar the order would fill in (the rule's hour and weekday filters read that bar).
export function signalAt(D, g, i, nextT) {
  if (!(i >= WARM && i < D.n)) return null;
  const A = atr(D)[i]; if (!(A > 0)) return null;
  let s = 0; for (const tr of g.trig) { const q = sig(D, tr, i); if (q === 0 || (s !== 0 && q !== s)) { s = 0; break; } s = q; } if (s === 0) return null;
  if ((g.side === 'long' && s < 0) || (g.side === 'short' && s > 0)) return null;
  if (g.trend !== 'none') { const m = sma(D.c, 200)[i]; if (!(m === m)) return null; const up = D.c[i] > m ? 1 : -1; if (g.trend === 'with' ? up !== s : up === s) return null; }
  const d = new Date((nextT != null ? nextT : D.t[i] + H) * 1000);
  if (g.hours) { const h = d.getUTCHours(), [a, b] = g.hours; if (a <= b ? !(h >= a && h < b) : !(h >= a || h < b)) return null; }
  if (g.dows && !g.dows.includes(d.getUTCDay())) return null;
  if (g.vol !== 'none') { const p = atrPct(D)[i]; if (!(p === p)) return null; if (g.vol === 'low' ? !(p <= g.volP) : !(p >= 1 - g.volP)) return null; }
  const dist = g.stop * A; if (!(dist > 0)) return null;
  return { side: s, atr: A, dist, rr: g.rr, hold: g.hold };
}
// rows [t, o, h, l, c] (the forming hour included) -> the closed candles as the engine's arrays, and the forming one
export function frame(rows, now, mk = 'nas100') {
  const h0 = hourOf(now), closed = rows.filter((r) => r[0] + H <= now && r[0] < h0), forming = rows.find((r) => r[0] === h0) || null;
  if (closed.length < MIN_BARS) return { why: 'too few H1 candles' };
  return { D: prep(toArrays(closed.map((r) => ({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4] }))), mk), forming, h0, closed };
}
// how a position the broker closed ended, from the H1 candles since its fill moved onto the broker's price basis (stop first)
export function inferExit(rec, rows) {
  const b = +rec.basis || 0;
  for (const r of rows) { if (r[0] < rec.barT) continue; const lo = r[3] + b, hi = r[2] + b;
    if (lo <= rec.stop) return { how: 'stop', exit: rec.stop, R: -1 };
    if (rec.target != null && hi >= rec.target) return { how: 'target', exit: rec.target, R: rec.rr }; }
  return { how: 'closed at the broker, exit not read', exit: null, R: null };
}
const ours = (label, barT) => (p) => { const td = p.tradeData || {}; return td.label === label && String(td.comment || '').includes(String(barT)); };

export async function step({ env = process.env, dir = 'data', WS = globalThis.WebSocket, clock = () => Date.now(), bars: barsFn, save = () => {}, log = console.log, pause = (ms) => new Promise((r) => setTimeout(r, ms)), mode = 'demo' } = {}) {
  let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8')); } catch (e) {}
  const X = modeOf(mode, cfg, env, { dir, name: 'nq', file: path.join(dir, 'nq', 'trades.json'), label: (x) => x, connect }), lab = X.label, ids = X.live ? LIVE_IDS : IDS, markets = X.live ? LIVE_MARKETS : MARKETS, NM = X.live ? 'nq live' : 'nq';
  if (X.live && X.off) return { skipped: 'off', why: X.off };
  const scrub = scrubber(env), file = X.file, now = Math.floor(clock() / 1000), h0 = hourOf(now), sec = now - h0, iso = () => new Date(Math.floor(clock() / 1000) * 1000).toISOString();
  let J; try { J = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { if (fs.existsSync(file)) { log('nq: nq/trades.json does not parse: left as it is'); return { skipped: 'file' }; } J = { trades: [] }; }
  J.trades = J.trades || [];
  const C = X.live ? {} : cfg.nq || {}; if (C.on === false) return { skipped: 'off' };
  if (!(sec >= LOOK_FROM && sec <= LOOK_UNTIL) || J.looked === h0) return { skipped: 'nothing due' };
  const write = (push) => { fs.mkdirSync(path.dirname(file), { recursive: true }); const tmp = file + '.tmp'; if (J.trades.length > 2000) J.trades = J.trades.slice(-2000); fs.writeFileSync(tmp, JSON.stringify(J, null, 1)); fs.renameSync(tmp, file); if (push) save(); };
  const FR = {}, ROWS = {}; let shut = 0;   // one read a market; a failed read is not marked looked: the next pass tries again
  for (const mk of markets) { let rows; try { rows = await barsFn(now, mk); } catch (e) { log(NM + ': ' + scrub(String((e && e.message) || e)).slice(0, 160)); return { error: true }; }
    const F = frame(rows || [], now, mk); ROWS[mk] = rows || []; if (F.why || !F.forming) { shut++; continue; } FR[mk] = F; }
  if (shut === markets.length) { J.looked = h0; write(false); return { skipped: 'market shut (no candle of this hour)' }; }
  const work = [];
  for (const id of ids) { const R = RULES[id], F = FR[R.market]; if (!F) continue; const open = J.trades.find((x) => x.rule === id && x.status === 'open');
    if (open) { const held = F.closed.filter((r) => r[0] >= open.barT).length; work.push({ R, F, rec: open, what: held >= open.hold ? 'exit' : 'watch', held }); continue; }
    if (J.trades.some((x) => x.rule === id && x.barT === h0)) continue;
    const sg = signalAt(F.D, R.g, F.D.n - 1, h0); if (sg && !(R.costSkip && F.D.cost / sg.dist > R.costSkip)) work.push({ R, F, what: 'enter', sg }); }
  if (!work.length) { J.looked = h0; write(false); return { skipped: 'no signal' }; }
  if (!X.live && (String(env.CTRADER_MIRROR || '').trim().toLowerCase() !== 'on' || ['CTRADER_CLIENT_ID', 'CTRADER_CLIENT_SECRET', 'CTRADER_ACCESS_TOKEN', 'CTRADER_ENV'].some((x) => !env[x]) || String(env.CTRADER_ENV).trim().toLowerCase() !== 'demo')) { log('nq: cTrader demo not configured'); return { skipped: 'config' }; }
  const account = X.live ? X.account : (C.account && String(C.account)) || accountFor(dir, env, { gotobi: cfg.gotobi }); if (!account) { log('nq: no demo account for it'); return { skipped: 'account' }; }
  const risk = X.live ? X.risk : Math.min(MAX_RISK, Math.max(0.0005, +C.risk || RISK)), tag = `…${String(account).slice(-3)}`;
  const did = []; let s = null, ctid, dirty = false, failed = false;
  try {
    ({ s, ctid } = await X.connect({ env, dir, account, WS, scrub }));
    const reconcile = async () => (await s.send(PT.RECONCILE_REQ, { ctidTraderAccountId: ctid }, PT.RECONCILE_RES)).position || [];
    const closeNow = async (p) => { const ev = await s.send(PT.CLOSE_POSITION_REQ, { ctidTraderAccountId: ctid, positionId: Number(p.positionId), volume: +p.tradeData.volume }, PT.EXECUTION_EVENT, orderStep); return +(ev.deal && ev.deal.executionPrice) || null; };
    // RULE 1: a position of ours with no stop gets the record's stop by amend; refused -> closed at once
    const guard = async (rec, p) => {
      if (+p.stopLoss > 0) { rec.brokerStop = +p.stopLoss; return true; }
      try { await s.send(PT.AMEND_POSITION_SLTP_REQ, { ctidTraderAccountId: ctid, positionId: Number(p.positionId), stopLoss: rec.stop, ...(rec.target != null ? { takeProfit: rec.target } : {}) }, PT.EXECUTION_EVENT, amendStep); rec.stopSetBy = 'amend'; return true; }
      catch (e) { const px = await closeNow(p); Object.assign(rec, { status: 'closed', exit: px, how: 'closed at once: the broker took no stop', closedSeen: iso(), R: px != null && rec.fill != null ? +((px - rec.fill) / rec.dist).toFixed(3) : null }); return false; } };
    let positions = await reconcile();
    for (const w of work) { const R = w.R, { D, forming } = w.F, i = D.n - 1, rows = ROWS[R.market], r5 = (v) => +(+v).toFixed(R.dp + 2), ruleRisk = !X.live && R.risk ? Math.min(R.maxRisk, Math.max(0.0005, +C[R.id + 'Risk'] || R.risk)) : risk, capRisk = X.live ? X.maxRisk : R.maxRisk || MAX_RISK, LB = lab(R.label);
      try {
        if (w.what === 'enter') {
          const sg = w.sg, rec = { id: `${R.id}-${h0}`, rule: R.id, barT: h0, status: 'skip', side: 'buy', signalBar: D.t[i], market: R.market, atr: r5(sg.atr), dist: r5(sg.dist), rr: sg.rr, hold: sg.hold, account: tag };
          if (positions.some(ours(LB, h0))) { const p = positions.find(ours(LB, h0));   // sent by a pass whose record was lost: never sent twice
            Object.assign(rec, { status: 'open', fill: +p.price || null, positionId: String(p.positionId), volume: +p.tradeData.volume, adopted: true, openedAt: iso() }); rec.stop = +p.stopLoss > 0 ? +p.stopLoss : +(rec.fill - sg.dist).toFixed(R.dp); rec.target = +p.takeProfit > 0 ? +p.takeProfit : +(rec.fill + sg.rr * sg.dist).toFixed(R.dp); rec.basis = r5(rec.fill - forming[1]);
            J.trades.push(rec); dirty = true; await guard(rec, p); did.push(`${R.id} adopted`); continue; }
          const drift = Math.abs(forming[4] - forming[1]) / sg.dist;
          if (drift > MAX_DRIFT) { Object.assign(rec, { status: 'missed', why: `the price had moved ${drift.toFixed(2)}R from the hour's open when the order was to be sent (${sec} s into the hour)` }); J.trades.push(rec); dirty = true; did.push(`${R.id} missed`); continue; }
          const names = await s.send(PT.SYMBOLS_LIST_REQ, { ctidTraderAccountId: ctid }, PT.SYMBOLS_LIST_RES), sym = (names.symbol || []).find((x) => String(x.symbolName).toUpperCase().replace(/[^A-Z0-9]/g, '') === R.symbol);
          if (!sym) throw new Error(R.symbol + ' is not offered on this account');
          const info = ((await s.send(PT.SYMBOL_BY_ID_REQ, { ctidTraderAccountId: ctid, symbolId: [sym.symbolId] }, PT.SYMBOL_BY_ID_RES)).symbol || [])[0] || {}, digits = Number.isFinite(+info.digits) ? +info.digits : R.dp, at = (v) => +(+v).toFixed(digits);
          const tr = (await s.send(PT.TRADER_REQ, { ctidTraderAccountId: ctid }, PT.TRADER_RES)).trader || {}, md = Number.isFinite(+tr.moneyDigits) ? +tr.moneyDigits : 2, balance = tr.balance != null ? Number(tr.balance) / 10 ** md : null;
          // units = balance x risk / the dollars one unit loses over the stop distance (USD account), fractions of a unit kept
          if (X.live) { const gt = dayGate(dir, balance, now, X.dayStop); if (!gt.ok) { Object.assign(rec, { status: 'skip', why: gt.why }); J.trades.push(rec); dirty = true; did.push(`${R.id} daily stop`); continue; } }
          const per = usdPerUnit(R.market, sg.dist, forming[4]);
          let volume = balance > 0 ? volumeOf(info, balance * ruleRisk / per) : null, riskNow = ruleRisk;
          if (!volume) { const min = +info.minVolume || +info.stepVolume || 0, loss = (min / 100) * per; riskNow = balance > 0 ? loss / balance : Infinity;
            if (!(min > 0 && riskNow <= capRisk)) throw new Error(`the smallest volume would risk more than ${capRisk * 100} % of the balance`); volume = min; }
          const order = { ctidTraderAccountId: ctid, symbolId: sym.symbolId, orderType: 1, tradeSide: 1, volume, relativeStopLoss: relative(sg.dist, digits), relativeTakeProfit: relative(sg.rr * sg.dist, digits), label: LB, comment: `${LB} ${h0}`, clientOrderId: rec.id };
          if (!(order.relativeStopLoss > 0)) throw new Error('no stop distance: no order');
          const ev = await s.send(PT.NEW_ORDER_REQ, order, PT.EXECUTION_EVENT, orderStep);
          const fill = +(ev.deal && ev.deal.executionPrice) || +(ev.position && ev.position.price) || null;
          Object.assign(rec, { status: 'open', openedAt: iso(), lateS: sec, drift: +drift.toFixed(3), volume, balance, risk: +riskNow.toFixed(5), fill, digits, positionId: ev.position && ev.position.positionId != null ? String(ev.position.positionId) : null,
            stop: fill != null ? at(fill - sg.dist) : null, target: fill != null ? at(fill + sg.rr * sg.dist) : null, basis: fill != null ? r5(fill - forming[1]) : 0 });
          J.trades.push(rec); dirty = true; did.push(`${R.id} bought`); log(`${NM}: ${R.id} buy ${R.symbol} at ${fill}, stop ${rec.stop}, target ${rec.target}, volume ${volume}`);
          await pause(1500); positions = await reconcile();
          const p = positions.find(ours(LB, h0));
          if (p) { if (rec.fill == null && +p.price > 0) { rec.fill = +p.price; rec.stop = at(rec.fill - sg.dist); rec.target = at(rec.fill + sg.rr * sg.dist); rec.basis = r5(rec.fill - forming[1]); } rec.positionId = String(p.positionId); await guard(rec, p); }
          else rec.note = 'the position was not on the account at the read-back: the next hour looks again';
          continue;
        }
        const rec = w.rec, p = positions.find(ours(LB, rec.barT));
        if (!p) { Object.assign(rec, { status: 'closed', closedSeen: iso(), inferred: true }, inferExit(rec, rows)); dirty = true; did.push(`${R.id} ${rec.how}`); continue; }
        if (!(await guard(rec, p))) { dirty = true; did.push(`${R.id} closed (no stop)`); continue; }
        if (rec.stopSetBy) dirty = true;
        if (w.what === 'exit') { const px = await closeNow(p); Object.assign(rec, { status: 'closed', exit: px, how: `time exit after ${rec.hold} H1 candles`, closedSeen: iso(), R: px != null && rec.fill != null ? +((px - rec.fill) / rec.dist).toFixed(3) : null }); dirty = true; did.push(`${R.id} time exit`); }
      } catch (e) { const why = scrub(String((e && e.message) || e)).slice(0, 160); log(`${NM}: ${R.id}: ${why}`); failed = true;
        if (w.what === 'enter' && !J.trades.some((x) => x.id === `${R.id}-${h0}`)) { J.trades.push({ id: `${R.id}-${h0}`, rule: R.id, barT: h0, status: 'error', why, account: tag }); dirty = true; failed = false; } did.push(`${R.id} error`); }
    }
  } catch (e) { log(NM + ': ' + scrub(String((e && e.message) || e)).slice(0, 160)); return { error: true, did }; }
  finally { if (s) s.close(); if (!failed && s) J.looked = h0; if (dirty || (!failed && s)) write(dirty); }
  await pause(0); return { did };
}

// OANDA mid H1 candles of NAS100 (the search's and the study's feed), the last 900, the forming hour included
export async function oandaH1(now, mk = 'nas100', base = process.env.MD_BASE || 'https://aureumdesk.co.uk/md/') {
  const r = await fetch(`${base.replace(/\/?$/, '/')}bars?sym=${mk}&tf=1h&n=900`, { signal: AbortSignal.timeout(15000) }); if (!r.ok) throw new Error(`candles: HTTP ${r.status}`);
  const j = await r.json(); return (j.bars || []).map((b) => [b.time, +b.open, +b.high, +b.low, +b.close]).filter((b) => b[0] <= now).sort((a, b) => a[0] - b[0]);
}
if (process.argv[1] && process.argv[1].endsWith('nq-demo.mjs')) {
  const dir = process.argv[2] || 'data'; const { execFileSync } = await import('node:child_process');
  const live = process.argv.includes('--live'), rel = live ? 'live' : 'nq/trades.json';
  const save = () => { try { execFileSync('node', ['council/datasync.mjs', dir, 'save', `Nasdaq ${live ? 'live' : 'demo'} ${new Date().toISOString().slice(0, 16)}Z`, rel], { stdio: 'inherit' }); } catch (e) { console.log('nq: save failed (kept locally)'); } };
  const out = await step({ dir, bars: oandaH1, save, mode: live ? 'live' : 'demo' }); if (out.did && out.did.length) console.log('nq:', out.did.join(', '));
}
