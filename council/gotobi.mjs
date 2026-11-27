// Gotobi fade on a cTrader DEMO account (19 Nov 2026, owner: "start on any of the demo accounts ctrader", after being shown the
// study; docs/owner-decisions.md item 61). The rule is the gotobi study's T2, unchanged (research/edge/gotobi: PASS, replicated
// on four yen crosses and on a second feed): on a gotobi day (5th, 10th, 15th, 20th, 25th rolled back to the Tokyo business day,
// plus the month's last Tokyo business day) SELL USD/JPY at 00:55 UTC (09:55 Tokyo, the fix) and buy back at 06:00 UTC; stop
// D = 1.5 x the median of |price(06:00) - price(00:55)| over the 20 Tokyo business days before (at least 15 with both prices),
// at entry + D. No target. Every trade has its stop; it is checked at the broker right after the fill and the position is
// closed at once if it cannot be set (absolute rule 1).
//
// Paper and demo only (absolute rule 2): the demo host, an account that reports isLive false, the mirror's message allowlist
// (session()). Its own label "gotobi", so the mirror never touches these positions and these never touch the mirror's.
// Run by .github/workflows/gotobi.yml once a gotobi morning: it starts before 00:55, sends the order at 00:55:00 UTC (the study
// found one minute late keeps about a third of it), sleeps, and closes at 06:00:00 UTC. A run that starts after 00:56 does not
// enter (a late entry is a different trade). Results go to council-data gotobi/trades.json, one record a day, never edited
// after it closes. A forward record, not an edge: it is judged against the study's numbers once there are enough trades.
import fs from 'node:fs';
import path from 'node:path';
import { isGotobi, isTokyoBusinessDay, addD } from './gotobi-calendar.mjs';
import { PT, session, scrubber, unseal, relative, orderStep, amendStep } from './ctrader-mirror.mjs';
import { readConfig } from './owner-config.mjs';

export const RULE = { pair: 'usdjpy', symbol: 'USDJPY', side: 'sell', entry: 55 * 60, exit: 6 * 3600, K: 1.5, LOOKBACK: 20, MIN_LOOK: 15, EXIT_GRACE: 900 };
export const LABEL = 'gotobi';
export const LATE_S = 60;          // a run that cannot send by 00:56:00 does not enter
export const RISK = 0.0025;        // of the account balance a trade (the book's usual unit); config.gotobi.risk overrides (0.0005-0.01)
const median = (a) => { const s = [...a].sort((p, q) => p - q), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
export const dayStart = (ymd) => Date.parse(ymd + 'T00:00:00Z') / 1000;
export const ymdOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);

// price at time X = the open of the M5 candle that starts at X; an exit with its candle missing takes the close of the last
// candle that started 15 minutes or less before X (the study's exitPx)
export function priceAt(bars, t, exit = false) {
  const i = bars.findIndex((b) => b.time === t); if (i >= 0) return +bars[i].open;
  if (!exit) return null;
  let best = null; for (const b of bars) if (b.time < t && t - b.time <= RULE.EXIT_GRACE) best = b; return best ? +best.close : null;
}
// D for a trade on day ymd: 1.5 x the median absolute move of the same window over the 20 Tokyo business days strictly before
export function stopDistance(bars, ymd) {
  const moves = []; let d = ymd, seen = 0;
  while (seen < RULE.LOOKBACK) { d = addD(d, -1); if (!isTokyoBusinessDay(d)) continue; seen++;
    const t0 = dayStart(d), a = priceAt(bars, t0 + RULE.entry), b = priceAt(bars, t0 + RULE.exit, true);
    if (a != null && b != null) moves.push(Math.abs(b - a)); }
  return moves.length >= RULE.MIN_LOOK ? +(RULE.K * median(moves)).toFixed(5) : null;
}
// size: a stop hit loses risk x balance (USD). For USD/JPY one unit loses D yen = D / price USD.
export function units(balance, risk, D, price) { if (!(balance > 0 && risk > 0 && D > 0 && price > 0)) return 0; return Math.floor(balance * risk / (D / price)); }
// cTrader volume = units x 100, a multiple of the step, at least the minimum, at most the maximum (null = refuse)
export function volumeOf(info, u) { const step = +info.stepVolume || 1000, min = +info.minVolume || step, max = +info.maxVolume || Infinity;
  let v = Math.floor(u * 100 / step) * step; if (v < min) return null; if (v > max) v = Math.floor(max / step) * step; return v; }
export const plan = (t) => { const ymd = ymdOf(t), t0 = dayStart(ymd); return { ymd, gotobi: isGotobi(ymd), entryAt: t0 + RULE.entry, exitAt: t0 + RULE.exit }; };

// ---------------------------------------------------------------------------------------------------------------- runner
const NEED = ['CTRADER_CLIENT_ID', 'CTRADER_CLIENT_SECRET', 'CTRADER_ACCESS_TOKEN', 'CTRADER_ENV'];
const sleepUntil = async (t, clock) => { for (;;) { const ms = t * 1000 - clock(); if (ms <= 0) return; await new Promise((r) => setTimeout(r, Math.min(ms, 30000))); } };

export function accountFor(dir, env, cfg) {   // config.gotobi.account, else env CTRADER_GOTOBI_ACCOUNT, else the LIT book's demo account (idle since 17 Nov)
  if (cfg && cfg.gotobi && cfg.gotobi.account) return String(cfg.gotobi.account);
  if (env.CTRADER_GOTOBI_ACCOUNT) return String(env.CTRADER_GOTOBI_ACCOUNT).trim();
  try { const m = JSON.parse(fs.readFileSync(path.join(dir, 'ctrader', 'mirror-accounts.json'), 'utf8')); const g = (m.groups || []).find((x) => (x.books || []).includes('lit')); if (g) return String(g.account); } catch (e) {}
  return null;
}

export async function connect({ env, dir, account, WS, scrub }) {
  let tok = { accessToken: env.CTRADER_ACCESS_TOKEN };
  try { const tf = path.join(dir, 'ctrader', 'tokens.json'); if (fs.existsSync(tf)) { const t = unseal(JSON.parse(fs.readFileSync(tf, 'utf8')), env); if (t && t.accessToken) { scrub.add(t.accessToken, t.refreshToken); tok = t; } } } catch (e) {}
  const s = session(WS, scrub);
  try {   // 23 Nov 2026: a refusal here left the session's heartbeat running, so the job's process never ended (it sat to its time limit)
    await s.send(PT.APP_AUTH_REQ, { clientId: env.CTRADER_CLIENT_ID, clientSecret: env.CTRADER_CLIENT_SECRET }, PT.APP_AUTH_RES);
    const list = await s.send(PT.ACCOUNTS_BY_TOKEN_REQ, { accessToken: tok.accessToken }, PT.ACCOUNTS_BY_TOKEN_RES), all = list.ctidTraderAccount || [], id = Number(account);
    // '*6154' (24 Nov 2026, owner gave a new demo account by the end of its login): the ONE demo account whose login ends so
    const suf = /^\*(\d{3,})$/.exec(String(account).trim()), tail = suf ? all.filter((a) => a.isLive === false && String(a.traderLogin).endsWith(suf[1])) : null;
    if (tail && tail.length !== 1) throw Object.assign(new Error(`${tail.length} demo accounts on this token have a login ending ${suf[1]}`), { final: true });
    const acc = tail ? tail[0] : all.find((a) => Number(a.ctidTraderAccountId) === id) || all.find((a) => Number(a.traderLogin) === id);
    if (!acc) throw Object.assign(new Error('the gotobi account is not on this token'), { final: true });
    if (acc.isLive !== false) throw Object.assign(new Error('refused: not a demo account'), { final: true });
    const ctid = Number(acc.ctidTraderAccountId);
    await s.send(PT.ACCOUNT_AUTH_REQ, { ctidTraderAccountId: ctid, accessToken: tok.accessToken }, PT.ACCOUNT_AUTH_RES);
    return { s, ctid };
  } catch (e) { s.close(); throw e; }
}
// the connection, tried again on a refusal or a dropped line (never a live or a missing account: `final`), up to `tries` times
// and only while the clock is before `until` (unix s). Only connecting is retried: no order or close is ever sent twice.
export async function connectRetry(o, { tries = 4, gap = 5000, until = Infinity, now = () => Math.floor(Date.now() / 1000), pause = (ms) => new Promise((r) => setTimeout(r, ms)), log = () => {} } = {}) {
  let last;
  for (let k = 1; k <= tries; k++) {
    try { return await connect(o); }
    catch (e) { last = e; if (e.final || k === tries || now() + gap / 1000 > until) break; log(`gotobi: connection ${k} failed (${o.scrub ? o.scrub(e.message) : e.message}), trying again`); await pause(gap); }
  }
  throw last;
}
const ours = (p, ymd) => { const td = p.tradeData || {}; return td.label === LABEL && (!ymd || String(td.comment || '').includes(ymd)); };

export async function run({ env = process.env, dir = 'data', WS = globalThis.WebSocket, clock = () => Date.now(), wait = null, bars: barsFn, save = () => {}, pull = () => {}, log = console.log, pause = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const until = wait || ((t) => sleepUntil(t, clock));
  const scrub = scrubber(env), file = path.join(dir, 'gotobi', 'trades.json');
  const read = () => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return { trades: [] }; } };
  const write = (j) => { fs.mkdirSync(path.dirname(file), { recursive: true }); const tmp = file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(j, null, 1)); fs.renameSync(tmp, file); save(); };
  const cfg = readConfig(dir);   // config.json with the owner's demo settings on top (council/owner-config.mjs)
  if (cfg.gotobi && cfg.gotobi.on === false) { log('gotobi: switched off in config'); return { skipped: 'off' }; }
  if (String(env.CTRADER_MIRROR || '').trim().toLowerCase() !== 'on' || NEED.some((k) => !env[k]) || String(env.CTRADER_ENV).trim().toLowerCase() !== 'demo') { log('gotobi: cTrader demo not configured'); return { skipped: 'config' }; }
  const account = accountFor(dir, env, cfg); if (!account) { log('gotobi: no demo account for it'); return { skipped: 'account' }; }
  const risk = Math.min(0.01, Math.max(0.0005, +(cfg.gotobi && cfg.gotobi.risk) || RISK));
  const now = () => Math.floor(clock() / 1000), P = plan(now()), J = read(); J.trades = J.trades || [];
  let rec = J.trades.find((x) => x.day === P.ymd);

  // 0) a position of an earlier day still open past its exit (a run that died) is closed now, late, and said so
  for (const r of J.trades.filter((x) => x.status === 'open' && x.day !== P.ymd)) {
    try { const { s, ctid } = await connect({ env, dir, account, WS, scrub });
      try { const rc = await s.send(PT.RECONCILE_REQ, { ctidTraderAccountId: ctid }, PT.RECONCILE_RES), p = (rc.position || []).find((x) => String(x.positionId) === String(r.positionId));
        if (p) { const ev = await s.send(PT.CLOSE_POSITION_REQ, { ctidTraderAccountId: ctid, positionId: Number(r.positionId), volume: +p.tradeData.volume }, PT.EXECUTION_EVENT, orderStep);
          Object.assign(r, { status: 'closed', exitAt: new Date(now() * 1000).toISOString(), exit: +(ev.deal && ev.deal.executionPrice) || null, late: true }); }
        else Object.assign(r, { status: 'closed', exitAt: null, exit: r.stop, how: 'gone at the broker (the stop, presumably)' }); } finally { s.close(); }
      write(J); } catch (e) { log('gotobi: late close failed: ' + scrub(e.message)); }
  }

  if (!P.gotobi) { log(`gotobi: ${P.ymd} is not a gotobi day`); return { skipped: 'day' }; }
  if (rec && rec.status !== 'open' && rec.status !== 'planned') { log(`gotobi: ${P.ymd} already ${rec.status}`); return { skipped: 'done', rec }; }

  // 1) enter at 00:55:00 UTC
  if (!rec) {
    if (now() > P.entryAt + LATE_S) { rec = { day: P.ymd, status: 'missed', why: `the run started at ${new Date(now() * 1000).toISOString()}, after 00:56` }; J.trades.push(rec); write(J); log('gotobi: too late to enter'); return { skipped: 'late', rec }; }
    let bars; try { bars = await barsFn(P.ymd); } catch (e) { rec = { day: P.ymd, status: 'error', why: 'candles: ' + scrub(String((e && e.message) || e)).slice(0, 120) }; J.trades.push(rec); write(J); log('gotobi: ' + rec.why); return { error: rec.why, rec }; }
    const D = stopDistance(bars, P.ymd);
    if (!(D > 0)) { rec = { day: P.ymd, status: 'no-stop', why: 'fewer than 15 of the 20 days before have both prices' }; J.trades.push(rec); write(J); return { skipped: 'nostop', rec }; }
    await until(P.entryAt - 40); pull();   // the council may have refreshed the cTrader token since the job started
    let s = null, ctid;
    try {
      ({ s, ctid } = await connectRetry({ env, dir, account, WS, scrub }, { tries: 5, gap: 5000, until: P.entryAt + LATE_S - 5, now, pause, log }));
      const tr = (await s.send(PT.TRADER_REQ, { ctidTraderAccountId: ctid }, PT.TRADER_RES)).trader || {}, md = Number.isFinite(+tr.moneyDigits) ? +tr.moneyDigits : 2, balance = tr.balance != null ? Number(tr.balance) / 10 ** md : null;
      const names = await s.send(PT.SYMBOLS_LIST_REQ, { ctidTraderAccountId: ctid }, PT.SYMBOLS_LIST_RES), sym = (names.symbol || []).find((x) => String(x.symbolName).toUpperCase().replace(/[^A-Z]/g, '') === RULE.symbol);
      if (!sym) throw new Error('USDJPY is not offered on this account');
      const info = ((await s.send(PT.SYMBOL_BY_ID_REQ, { ctidTraderAccountId: ctid, symbolId: [sym.symbolId] }, PT.SYMBOL_BY_ID_RES)).symbol || [])[0] || {}, digits = Number.isFinite(+info.digits) ? +info.digits : 3;
      const ref = (bars.length && +bars[bars.length - 1].close) || 0, volume = volumeOf(info, units(balance, risk, D, ref));
      if (!volume) throw new Error('the risk is below the broker\'s minimum volume');
      await until(P.entryAt);
      if (now() > P.entryAt + LATE_S) throw new Error('missed 00:55 (connection too slow)');
      const order = { ctidTraderAccountId: ctid, symbolId: sym.symbolId, orderType: 1, tradeSide: 2, volume, relativeStopLoss: relative(D, digits), label: LABEL, comment: `gotobi ${P.ymd}`, clientOrderId: `gotobi-${P.ymd}` };
      const ev = await s.send(PT.NEW_ORDER_REQ, order, PT.EXECUTION_EVENT, orderStep);
      const pos = ev.position || {}, pid = pos.positionId ?? (ev.order && ev.order.positionId), fill = +(ev.deal && ev.deal.executionPrice) || +pos.price || null;
      rec = { day: P.ymd, status: 'open', D, risk, volume, balance, positionId: pid != null ? String(pid) : null, sentAt: new Date(now() * 1000).toISOString(), fill, stop: fill ? +(fill + D).toFixed(digits) : null, account: `…${String(account).slice(-3)}` };
      // RULE 1: read the position back; a missing stop is set by amend, or the position is closed at once
      await pause(1500);
      const rc = await s.send(PT.RECONCILE_REQ, { ctidTraderAccountId: ctid }, PT.RECONCILE_RES), p = (rc.position || []).find((x) => String(x.positionId) === rec.positionId);
      if (p && !(+p.stopLoss > 0)) {
        try { await s.send(PT.AMEND_POSITION_SLTP_REQ, { ctidTraderAccountId: ctid, positionId: Number(rec.positionId), stopLoss: rec.stop }, PT.EXECUTION_EVENT, amendStep); rec.stopSetBy = 'amend'; }
        catch (e) { await s.send(PT.CLOSE_POSITION_REQ, { ctidTraderAccountId: ctid, positionId: Number(rec.positionId), volume }, PT.EXECUTION_EVENT, orderStep); Object.assign(rec, { status: 'closed', exitAt: new Date(now() * 1000).toISOString(), how: 'closed at once: the broker took no stop' }); }
      } else if (p) rec.brokerStop = +p.stopLoss;
      J.trades.push(rec); write(J); log(`gotobi: sold USDJPY at ${fill} stop ${rec.stop} volume ${volume}`);
    } catch (e) { rec = { day: P.ymd, status: 'error', why: scrub(e.message) }; J.trades.push(rec); write(J); log('gotobi: ' + rec.why); return { error: rec.why, rec }; }
    finally { if (s) s.close(); }
  }
  if (rec.status !== 'open') return { rec };

  // 2) out at 06:00:00 UTC
  await until(P.exitAt); pull();
  let s, ctid;
  try { ({ s, ctid } = await connectRetry({ env, dir, account, WS, scrub }, { tries: 6, gap: 10000, now, pause, log })); }
  catch (e) { rec.exitError = `could not connect at the exit: ${scrub(String((e && e.message) || e)).slice(0, 120)}`; write(J); log('gotobi: ' + rec.exitError + ' (left open with its stop; the next run closes it)'); return { error: rec.exitError, rec }; }
  try {
    const rc = await s.send(PT.RECONCILE_REQ, { ctidTraderAccountId: ctid }, PT.RECONCILE_RES), p = (rc.position || []).find((x) => String(x.positionId) === rec.positionId);
    if (p) { const ev = await s.send(PT.CLOSE_POSITION_REQ, { ctidTraderAccountId: ctid, positionId: Number(rec.positionId), volume: +p.tradeData.volume }, PT.EXECUTION_EVENT, orderStep);
      Object.assign(rec, { status: 'closed', exitAt: new Date(now() * 1000).toISOString(), exit: +(ev.deal && ev.deal.executionPrice) || null, how: 'time exit 06:00' }); }
    else Object.assign(rec, { status: 'closed', exitAt: null, exit: rec.stop, how: 'stopped at the broker' });
    if (rec.fill && rec.exit && rec.D) rec.R = +((rec.fill - rec.exit) / rec.D).toFixed(3);   // a sell: R = (entry - exit) / D, before costs
    write(J); log(`gotobi: closed ${rec.how}, R ${rec.R}`);
  } finally { s.close(); }
  return { rec };
}

// OANDA mid M5 candles of USD/JPY (the study's feed) from the council's candle service, 35 days back
export async function oandaBars(ymd, base = process.env.MD_BASE || 'https://aureumdesk.co.uk/md/') {
  const to = dayStart(ymd), from = to - 35 * 86400, out = [];
  for (let a = from; a < to; a += 4999 * 300) { const r = await fetch(`${base}bars?sym=usdjpy&tf=5m&from=${a}&to=${Math.min(to, a + 4999 * 300)}`, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`candles: HTTP ${r.status}`); const j = await r.json(); for (const b of j.bars || []) if (!b.live && (!out.length || b.time > out[out.length - 1].time)) out.push(b); }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('gotobi.mjs')) {
  const dir = process.argv[2] || 'data';
  const { execFileSync } = await import('node:child_process');
  const save = () => { try { execFileSync('node', ['council/datasync.mjs', dir, 'save', `Gotobi ${new Date().toISOString().slice(0, 16)}Z`, 'gotobi/trades.json'], { stdio: 'inherit' }); } catch (e) { console.log('gotobi: save failed (kept locally)'); } };
  const pull = () => { try { execFileSync('node', ['council/datasync.mjs', dir, 'pull'], { stdio: 'inherit' }); } catch (e) {} };
  const out = await run({ dir, bars: (ymd) => oandaBars(ymd), save, pull });
  console.log('gotobi:', JSON.stringify(out.skipped || out.error || (out.rec && out.rec.status) || 'done'));
}
