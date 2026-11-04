// Council · Trader (+ daily statistical Coach)
// Runs every ~4 minutes in GitHub Actions: pulls candles for every market, runs the Mosha rules,
// paper-trades every Ready setup, manages open trades and writes everything to the data folder.
// Usage: node council/trader.mjs <dataDir>
import fs from 'node:fs';
import path from 'node:path';
import { msAnalyze, CFG, PAIRS, RETR, LBL, buildSetup, buildRetrace, setMarket } from './engine.mjs';
import { entryContext, startReview, watchReview, judge, newsNear, lessons } from './review.mjs';
import { m15cFeat } from './choch.mjs';

const DIR = process.argv[2] || 'data';
fs.mkdirSync(DIR, { recursive: true });
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { return d; } };
const wr = (f, v) => fs.writeFileSync(path.join(DIR, f), JSON.stringify(v, null, 1));

const MARKETS = {
  xau:    { label: 'XAU/USD', name: 'Gold',     group: 'Metals', kraken: 'PAXGUSD', dec: 1, spot: true },
  btc:    { label: 'BTC/USD', name: 'Bitcoin',  group: 'Crypto', kraken: 'XBTUSD',  dec: 1 },
  eth:    { label: 'ETH/USD', name: 'Ethereum', group: 'Crypto', kraken: 'ETHUSD',  dec: 2 },
  sol:    { label: 'SOL/USD', name: 'Solana',   group: 'Crypto', kraken: 'SOLUSD',  dec: 2 },
  xrp:    { label: 'XRP/USD', name: 'XRP',      group: 'Crypto', kraken: 'XRPUSD',  dec: 4 },
  eurusd: { label: 'EUR/USD', name: 'Euro',     group: 'Forex',  kraken: 'EURUSD',  dec: 5 },
  gbpusd: { label: 'GBP/USD', name: 'Pound',    group: 'Forex',  kraken: 'GBPUSD',  dec: 5 },
  audusd: { label: 'AUD/USD', name: 'Aussie',   group: 'Forex',  kraken: 'AUDUSD',  dec: 5 },
  usdcad: { label: 'USD/CAD', name: 'Loonie',   group: 'Forex',  kraken: 'USDCAD',  dec: 5 },
  usdchf: { label: 'USD/CHF', name: 'Swissy',   group: 'Forex',  kraken: 'USDCHF',  dec: 5 },
};
const TFS = [['1d', 1440, 86400], ['4h', 240, 14400], ['1h', 60, 3600], ['15m', 15, 900], ['5m', 5, 300], ['1m', 1, 60]];
// gold also reads M30: the trader marks M30 structure, and M30 → M1 against D1 is the gold setup that held in the 150-day replay
const M30_MARKETS = new Set(['xau']);
const TFS_M30 = TFS.slice(0, 3).concat([['30m', 30, 1800]], TFS.slice(3));
LBL['30m'] = 'M30';
const PAIRS_T = PAIRS.concat([{ k: 'm30m1', name: 'M30', h: '30m', l: '1m', e: 'M1', up: '1h' }]);
// How long an unfilled order waits, by the higher timeframe of its pair
const WAIT = { '1d': 5 * 86400, '4h': 2 * 86400, '1h': 12 * 3600, '30m': 6 * 3600, '15m': 3 * 3600 };
// Only fresh signals: the CF break must be at most this many lower-timeframe candles old
const FRESH = 12;
const MAX_OPEN = 2;   // live trades per market
const MAX_USD = 3;    // live gold/forex trades betting the same way on the US dollar (one USD move hits them all)
// +1 = the trade wins if the dollar rises, -1 if it falls, 0 = not a dollar pair (crypto is left out)
const usdDir = (M, side) => { if (M.group === 'Crypto') return 0; const [a, b] = M.label.split('/'), buy = side === 'buy' ? 1 : -1; return b === 'USD' ? -buy : a === 'USD' ? buy : 0; };
const SEC = Object.fromEntries(TFS_M30.map(([id, , s]) => [id, s]));
// Market-structure conditions at a signal (the backtest computes the same two):
//   cf    — is the confirming lower-timeframe break itself a CHoCH (it flipped that timeframe's trend) or a continuation BO?
//   choch — has M15 or M5 printed a fresh CHoCH in the trade's direction (within its last FRESH candles)? The user's rule:
//           "once we had a CHoCH on M15 or M5, we enter".
function structFeat(t, def, src, at) {
  const dir = t.sell ? -1 : 1, lp = src[def.l], ll = lp && lp.A && lp.A.last;
  const cf = ll && ll.dir === dir && ll.structure ? 'choch' : 'bo';
  const choch = ['15m', '5m'].some((id) => { const s = src[id]; return s && s.A && s.A.events.some((e) => e.dir === dir && e.structure && at - s.bars[e.breakIdx].time <= FRESH * SEC[id]); }) ? 'yes' : 'no';
  return { cf, choch };
}
// conditions a setup can be filtered on, the two sides of each, and how a rule reads
const CONDS = [['d1', 'with', 'against', (v) => `${v} D1`], ['cf', 'choch', 'bo', (v) => v === 'choch' ? 'a CHoCH as the confirming break' : 'a continuation BO as the confirming break'], ['choch', 'yes', 'no', (v) => v === 'yes' ? 'a fresh M15/M5 CHoCH' : 'no fresh M15/M5 CHoCH'],
  // the trader's M15 CHoCH (choch.mjs): an M15 close back through the pullback's last lower high (higher low) within the hour
  ['m15c', 'yes', 'no', (v) => v === 'yes' ? "the trader's M15 CHoCH within the hour" : "no M15 CHoCH (the trader's) within the hour"]];
const passesFilters = (t, f) => CONDS.every(([c]) => !f[c] || t[c] === f[c]);
function emptyFilter(fl) { return !fl.struct && !(fl.noSession || []).length && !fl.off && !fl.minRR && !fl.maxRR && !(fl.noMarket || []).length && CONDS.every(([c]) => !fl[c]); }

// Trading session by UTC hour (rough, ignores daylight saving)
const sessionOf = (t) => { const h = new Date(t * 1000).getUTCHours(); return h < 7 ? 'asia' : h < 12 ? 'london' : h < 16 ? 'overlap' : h < 21 ? 'newyork' : 'late'; };
// Spot gold and forex close for the weekend (Fri 21:00 – Sun 22:00 UTC); crypto never closes.
// PAXG keeps trading 24/7, but those candles aren't the gold market, so no new gold/forex trades then,
// nor in the first hour after the Sunday reopen.
const marketOpen = (M, t) => { if (M.group === 'Crypto') return true; const d = new Date(t * 1000), wd = d.getUTCDay(), h = d.getUTCHours();
  return !(wd === 6 || (wd === 0 && h < 23) || (wd === 5 && h >= 21)); };   // Sunday 22:00–23:00 too: the reopen gaps and spreads are wide
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function kraken(pair, interval) {
  for (let a = 0; a < 4; a++) {
    try {
      const r = await fetch(`https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=${interval}`);
      const j = await r.json();
      if (j.error && j.error.length) { if (/too many|rate/i.test(j.error[0])) { await sleep(2500 * (a + 1)); continue; } throw new Error(j.error[0]); }
      const key = Object.keys(j.result).find((k) => k !== 'last');
      return j.result[key].map((k) => ({ time: +k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4] }));
    } catch (e) { if (a === 3) throw e; await sleep(1500); }
  }
}

// ─── Config: the Coach's knobs, with their allowed ranges ───
const LIMITS = { buf: [0.10, 0.25], minRR: [1.2, 2.5], minRisk: [0.4, 1.2], maxUsd: [2, 4] };
const config = Object.assign({ buf: 0.15, minRR: 1.2, minRisk: 0.6, be: null, fresh: FRESH, newsGuard: false, maxUsd: MAX_USD, paused: {}, pausedMarkets: {}, filters: {}, history: [] }, rd('config.json', {}));
config.filters = config.filters || {};
const now = Math.floor(Date.now() / 1000), nowISO = new Date(now * 1000).toISOString();
// a rule change stamped in the future (the AI Coach wrote 21:30 at 21:10 on 2 Nov) would hide the shadow trades a rule is
// re-checked on until then: any future history time or filter 'since' is set to now
for (const h of config.history || []) if (Date.parse(h.at) / 1000 > now) h.at = nowISO;
for (const f of Object.values(config.filters)) for (const [c, v] of Object.entries(f.since || {})) if (Date.parse(v) / 1000 > now) f.since[c] = nowISO;
config.pausedMarkets = config.pausedMarkets || {};
for (const [k, until] of Object.entries(config.pausedMarkets)) if (Date.parse(until) / 1000 <= now) { delete config.pausedMarkets[k]; config.history.push({ at: nowISO, by: 'coach-stats', change: `Resumed market ${k}`, why: 'Pause period ended.' }); }
for (const [k, until] of Object.entries(config.paused)) if (Date.parse(until) / 1000 <= now) { delete config.paused[k]; (config.resumedAt = config.resumedAt || {})[k] = now; config.history.push({ at: nowISO, by: 'coach-stats', change: `Resumed ${k}`, why: 'Pause period ended.' }); }
CFG.buf = Math.min(LIMITS.buf[1], Math.max(LIMITS.buf[0], config.buf));
CFG.minRisk = Math.min(LIMITS.minRisk[1], Math.max(LIMITS.minRisk[0], config.minRisk));
// Rules from the trader (the user), applied once and logged. The Coach undoes one only when a backtest shows it clearly losing.
const USER_RULES = [
  // 2 Nov, 16:00: read as "hold the H1 retracement to the H1 Origin" (the engine's Origin, 4,019.8: the start of the
  // whole sell-off leg). The trader's marked chart (TP 3,965.08) shows they meant the Origin of the sell-off's last H1
  // break (3,965-3,975), which the first target (50% line, 3,962.6) already matched, so it is undone below.
  { id: 'rintra-origin-chart', apply: (c) => { if ((c.targetBy || {}).rintra === 'user') { delete c.target.rintra; delete c.targetBy.rintra; } },
    change: 'rintra: first target again (user chart)',
    why: 'The trader\'s marked gold chart (2 Nov): long 3,900.71, stop 3,896.79, take profit 3,965.08 = the bottom of the H1 Origin of the sell-off (the 3,975 break). That is where the H1 retracement\'s first target sits (the 50% line, 3,962.6), not the start of the whole leg (4,019.8) that "hold to the Origin" pointed at. The setup never got to trade it anyway: it signalled at 13:43, after the breakout; the trader was in at 11:45 from the base.' },
  // 2 Nov, 23:00: the trader asked for the final rule set from the 150-day research (5 Jun – 2 Nov, 20,524 replayed signals).
  // Each rule was picked on the first 100 days only and kept because it also helped on the last 50 days.
  { id: 'research-150d', apply: (c) => {
      c.filters = c.filters || {};
      const set = (k, v) => { c.filters[k] = Object.assign(c.filters[k] || {}, v); (c.filters[k].src = c.filters[k].src || {}); for (const x of Object.keys(v)) c.filters[k].src[x] = 'user'; };
      set('position', { off: true }); set('swing', { d1: 'against' }); set('intraday', { maxRR: 10 });
      set('scalp', { noMarket: ['audusd'] }); set('rscalp', { minRR: 3 }); set('rintra', { noMarket: ['usdchf'] });
      c.maxUsd = 2;
    },
    change: 'Research rule set (user): Position off; Swing only against D1; Intraday reward:risk ≤ 10; Scalp skips AUD/USD; Retrace M15→M1 only at reward:risk ≥ 3; Retrace H1→M5 skips USD/CHF; dollar cap 2',
    why: '150-day replay (5 Jun – 2 Nov): today\'s rules −0.09R a trade (−369R over 4,113). With this set −0.001R (−3R over 2,565); on the last 50 days, which did not pick the rules, +0.031R a trade, +161R better than today\'s rules (t = 6.4). The dollar cap of 2 instead of 3 cut the portfolio loss from −176R to −56R in the same replay. Break-even, not a proven edge: paper trading only.' },
  // 3 Nov, 07:30: the trader's rule: no pauses. Every setup and market keeps trading (paper) so there is content to study;
  // the research filters still apply (their blocked signals run as shadow trades). Clears today's pauses.
  { id: 'no-pause', apply: (c) => { c.noPause = true; c.paused = {}; c.pausedMarkets = {}; },
    change: 'No pauses (user): every setup and market keeps trading; what the Coach would pause is kept in wouldPause',
    why: 'The trader wants every setup producing trades to study and analyse. Retrace H1→M5 (paused 06:05 after four live losses) resumes now.' },
  // 3 Nov, 19:50: the trader's rule: take the shadow trades live. Every signal trades (paper); the rule, limit or cap that
  // would have blocked it is still recorded in blockedBy, so results split into "the rules would take it" and "would block it".
  // Only a literal duplicate (same stop and target as a trade already open) is still skipped.
  { id: 'take-all', apply: (c) => { c.takeAll = true; },
    change: 'Take all signals (user): the shadow trades trade live; blockedBy still records which rule would have blocked each',
    why: 'On 3 Nov live made −3.8R while the blocked signals made +16.2R. The 150-day replay says trading every signal loses (about −0.2R a trade); the trader wants to see it forward on paper.' },  // 3 Nov, 20:05: the trader's rule: focus on gold only. Gold trades live (with take-all, every gold signal); the other
  // markets keep running as shadow trades marked 'focus' so their data keeps building.
  { id: 'gold-only', apply: (c) => { c.focus = ['xau']; },
    change: 'Gold only (user): only XAU/USD trades live; the other markets run as shadow trades (focus)',
    why: 'The trader wants to concentrate on gold. On 3 Nov gold\'s blocked Retrace M15→M1 sells at the 3,946–3,969 supply made +25.7R while its live scalps into the demand box lost −3R.' },
  // 3 Nov, 20:30: M30 → M1 for gold, only against D1 (research, from the trader's M30 markups)
  { id: 'gold-m30', apply: (c) => { c.filters = c.filters || {}; c.filters.m30m1 = { d1: 'against', src: 'user', since: new Date().toISOString() }; },
    change: 'Gold M30 → M1 setup (user research): new setup on gold, only against D1',
    why: '150-day replay on gold: M30 → M1 against D1 made +0.13R a trade on the first 100 days (162) and +0.20R on the last 50 (110); with the live limits gold went from +12R to +33R (train +1 → +11, test +11 → +22). Concentrated: +3R without its 5 best trades; August and September negative.' },
  // 3 Nov, 22:00: the gold replica goes live (the trader: "do what you think is best"). Gold trades only the replica's
  // passing signals (v4); the engine's gold setups run as shadow trades (blockedBy 'replica', their other blockers still
  // recorded); take-all ends, since every engine signal on gold loses about 0.2R a trade on the 150-day replay.
  { id: 'replica-live', apply: (c) => { c.replicaLive = ['xau']; c.takeAll = false; },
    change: 'Gold replica live (v4): gold trades the replica live; the engine setups run as shadows; take-all off',
    why: '150-day gold replay: the replica v4 +0.19R a trade on the first 100 days and +0.13R on the last 50 (no losing month, +86R over 527 trades, all four of the trader\'s marked trades); the engine setups on gold, every signal taken, −0.15 to −0.2R a trade (−146R), with the rules +53R.' },
  // 4 Nov: only v5 counts. The two trades still open from the earlier council strategies (EUR/USD Position, USD/CHF Swing,
  // opened before gold-only) close at market on the next run, and any non-replica live trade is closed the same way from now on.
  { id: 'retire-legacy', apply: (c) => { c.retireLegacy = true; },
    change: 'Retire the older strategies (user): live trades left from the engine setups close at market; only the gold replica trades live',
    why: 'The trader asked for a clean live record: the replica v5 is the system. The engine setups keep running as shadow trades for research.' },
];
config.userRules = config.userRules || [];
for (const u of USER_RULES) if (!config.userRules.includes(u.id)) { u.apply(config); config.userRules.push(u.id); config.history.push({ at: nowISO, by: 'user', change: u.change, why: u.why }); }
const state = Object.assign({ seen: {}, lastRun: 0 }, rd('state.json', {}));
let trades = rd('trades.json', []);
// Trades closed by a bad print (a Kraken-only spike, found by the raw-candle probe) are reopened once, so they keep running on the
// cleaned candles and end with their real result instead of teaching the Coach a move that never happened
const BAD_PRINT_CLOSES = [
  { at: '2026-11-03', ids: ['audusd-intraday-1793666828', 'audusd-intraday-1793676728', 'audusd-intraday-1793681494', 'audusd-intraday-1793694924', 'audusd-scalp-1793694924', 'usdcad-intraday-1793648789', 'usdcad-scalp-1793673149'],
    why: 'AUD/USD 10:12 (one order spiked 35 pips for a minute; Yahoo saw nothing), USD/CAD and USD/CHF 06:14 (582-range spike)' },
];
config.repairs = config.repairs || [];
for (const rp of BAD_PRINT_CLOSES) {
  const key = 'badprint-' + rp.at + '-' + rp.ids.length; if (config.repairs.includes(key)) continue;
  let n = 0;
  for (const tr of trades) if (rp.ids.includes(tr.id) && (tr.status === 'win' || tr.status === 'loss' || tr.status === 'be') && tr.closed) {
    tr.badPrint = { status: tr.status, R: tr.R, closed: tr.closed }; tr.checked = tr.closed; tr.status = 'open'; tr.R = null; delete tr.closed; delete tr.pm; n++;
  }
  config.repairs.push(key); config.history.push({ at: nowISO, by: 'system', change: `Reopened ${n} trades closed by a bad print`, why: rp.why });
}
// Reviews written before the entry-slip sign fix scored better-than-planned fills as "late entry": flip and re-judge them once
for (const x of trades) if (x.pm && x.pm.slip != null && x.pm.sv !== 2) { x.pm.slip = -x.pm.slip; x.pm.sv = 2; Object.assign(x.pm, judge(x)); }
const snapshot = { at: nowISO, markets: {}, errors: {} };

// This week's economic calendar (high-impact news), refreshed every 6 hours: the review checks every loss against it
if (!state.news || now - (state.news.at || 0) > 6 * 3600) {
  try { const j = await (await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json')).json(); if (Array.isArray(j)) state.news = { at: now, data: j.filter((e) => e.impact === 'High').map((e) => ({ title: e.title, country: e.country, date: e.date, impact: e.impact })) }; } catch (e) {}
}
const NEWS = (state.news && state.news.data) || [];

let spot = null, spotAt = null;
try { const j = await (await fetch('https://api.gold-api.com/price/XAU')).json(); spot = +j.price || null; const u = Date.parse(j.updatedAt); if (isFinite(u)) spotAt = Math.floor(u / 1000); } catch (e) {}
// Gold trades on PAXG candles shifted onto XAU/USD spot. One spot quote against one PAXG close is noisy: a fixed D1 level
// moved $2.70 per run on average (up to $8), more than a gold scalp's whole risk, so stops and targets were hit by the
// shift, not by price. The shift is now the median of the last 2 hours of samples, each quote matched to the PAXG minute
// it was quoted in; a stale quote (weekend, feed down) adds no sample and the last shift is kept.
function basisFor(key, bars) {
  const B = (state.basis = state.basis || {}), b = (B[key] = B[key] || { s: [], off: null });
  b.s = b.s.filter(([t]) => now - t <= 2 * 3600);
  if (spot && (!spotAt || now - spotAt <= 600)) {
    const m = Math.floor((spotAt || now) / 60) * 60, bar = bars.find((x) => x.time === m) || bars.at(-1), o = spot - bar.close;
    if (Math.abs(o) < 150) b.s = b.s.concat([[now, +o.toFixed(3)]]).slice(-24);
  }
  if (b.s.length) { const v = b.s.map(([, o]) => o).sort((x, y) => x - y), n = v.length; b.off = +(n % 2 ? v[n >> 1] : (v[n / 2 - 1] + v[n / 2]) / 2).toFixed(3); }
  return b.off || 0;
}

const BUILDERS = PAIRS_T.map((p) => [p, buildSetup]).concat(RETR.map((p) => [p, buildRetrace]));

// ─── Research setup, paper only: the Daily Cycle (Liquidity Trading notes; 150-day replay +0.17R a trade on crypto) ───
// London (07:00–12:00 UTC) sets the bias: bullish when London's low came before its high and price closed above the London
// open at 12:00 (bearish mirrored). In the New York open (12:00–15:00 UTC), when price retraces into 62–70% of the London leg,
// buy (sell) at market, stop past the London low (high), target 3R, and close at 21:00 UTC if neither is hit. Crypto only.
// Kept in research.json, never in trades.json, so the Coach's learning, stats and lessons never see it.
function dailyCycle(src, price, t) {
  const d = Math.floor(t / 86400) * 86400;
  if (t < d + 12 * 3600 || t >= d + 15 * 3600) return null;
  const b5 = src['5m'].bars, ldn = b5.filter((b) => b.time >= d + 7 * 3600 && b.time < d + 12 * 3600);
  if (ldn.length < 50) return null;
  let hi = -Infinity, lo = Infinity, hiT = 0, loT = 0;
  for (const b of ldn) { if (b.high > hi) { hi = b.high; hiT = b.time; } if (b.low < lo) { lo = b.low; loT = b.time; } }
  const open = ldn[0].open, close = ldn[ldn.length - 1].close, leg = hi - lo;
  if (!(leg > 0)) return null;
  const bull = loT < hiT && close > open, bear = hiT < loT && close < open;
  if (!bull && !bear) return null;
  const ny = b5.filter((b) => b.time >= d + 12 * 3600);
  if (bull && ny.some((b) => b.low < lo)) return null;
  if (bear && ny.some((b) => b.high > hi)) return null;
  const e62 = bull ? hi - 0.62 * leg : lo + 0.62 * leg, e70 = bull ? hi - 0.70 * leg : lo + 0.70 * leg;
  if (bull ? !(price <= e62 && price >= e70) : !(price >= e62 && price <= e70)) return null;
  const spr = price * 0.0002, buf = Math.max(3 * spr, 0.05 * leg), stop = bull ? lo - buf : hi + buf, r = Math.abs(price - stop);
  if (!(r > 0)) return null;
  return { sell: bear, entry: price, stop, t1: price + (bull ? 3 : -3) * r, closeBy: t + 8 * 3600, day: d, londonHigh: hi, londonLow: lo };
}
// Bad prints: thin feeds (Kraken FX trades, stitched Yahoo/Dukascopy) carry the odd off-market tick that makes a 1,000-pip
// candle and a fake 160R trade. A wick longer than 50 times the median candle range of the last 100 candles is clipped to the
// body plus one median range; a candle whose body jumps 50 ranges away and comes straight back is flattened to the prior close.
// Forex (opts.wickK = 15) also clips a lone wick past 15 ranges that the next 3 candles never trade back into: on
// 3 Nov 10:12 one Kraken order spiked AUD/USD 35 pips for a minute (Yahoo saw nothing) and hit five stops. News spikes get revisited.
const LTF_CLEAN = new Set(['1m', '5m', '15m', '30m']);   // the lone-wick rule: the timeframes trades are managed on, not the structure TFs
function cleanBars(arr, o = {}) {
  const K = o.k || 50, WK = o.wickK || 0, RV = o.revisit || 3;
  let fixed = 0; const win = [], log = [];
  for (let i = 0; i < arr.length; i++) {
    const b = arr[i];
    const med = win.length >= 20 ? [...win].sort((x, y) => x - y)[win.length >> 1] : 0;
    if (med > 0) {
      const lim = K * med, p = arr[i - 1], n = arr[i + 1];
      if (p && n && Math.abs(b.close - p.close) > lim && Math.abs(n.open - p.close) < lim / 2) {
        Object.assign(b, { open: p.close, high: p.close, low: p.close, close: p.close }); fixed++; log.push([b.time, 'body']);
      }
      const top = Math.max(b.open, b.close), bot = Math.min(b.open, b.close);
      // a lone wick: far past the body and never traded near again in the next RV candles (needs those candles to exist)
      const next = arr.slice(i + 1, i + 1 + RV), lone = WK && next.length === RV;
      const hiLim = lone && next.every((x) => x.high < top + (b.high - top) / 2) ? WK * med : lim;
      const loLim = lone && next.every((x) => x.low > bot - (bot - b.low) / 2) ? WK * med : lim;
      if (b.high - top > hiLim) { log.push([b.time, 'high', +((b.high - top) / med).toFixed(0)]); b.high = top + med; fixed++; }
      if (bot - b.low > loLim) { log.push([b.time, 'low', +((bot - b.low) / med).toFixed(0)]); b.low = bot - med; fixed++; }
    }
    const r = b.high - b.low; if (r > 0) { win.push(r); if (win.length > 100) win.shift(); }
  }
  return o.log ? log : fixed;
}
let research = rd('research.json', []);
// ─── Research setup (paper only): the trader's gold replica (3 Nov) ───
// Rebuilt from the four marked gold trades of 2-3 Nov: a leg of at least 2 M15 ATRs in the last 3 h or 6 h; M5 (1-candle
// swings) closes back through the last swing against the leg (the CHoCH) = the signal. Limit entry at the 30% retest from
// the CHoCH level toward the extreme, valid 4 h; stop past the extreme; target the leg's start; out after 48 h. On the
// 150-day replay it fires on all four of his trades (3 of 4 win on his days) but is about break-even overall, so it runs on
// paper to compare with his trades and learn which turns he takes.
// The gold platform's own engulfing (gold-trading.html detectEngulfings): body at least the 20-candle average and bigger than
// the engulfed body, 15% tolerance on the engulfed side; ★ when its mid sits within 0.12% of PDH/PDL, the Asia high/low or a
// $50/$100 round number (VWAP left out: no volume here)
function platformEngulfs(bars, bull) {
  const out = [], body = bars.map((c) => Math.abs(c.close - c.open));
  for (let i = 1; i < bars.length; i++) {
    const p = bars[i - 1], c = bars[i], st = Math.max(0, i - 20), avg = body.slice(st, i).reduce((a, b) => a + b, 0) / (i - st);
    if (body[i] < avg || body[i] < body[i - 1]) continue;
    const eps = Math.max(0.05, body[i - 1] * 0.15), pT = Math.max(p.open, p.close), pB = Math.min(p.open, p.close);
    if (bull ? c.close > c.open && p.close < p.open && c.close >= pT && c.open <= pB + eps : c.close < c.open && p.close > p.open && c.close <= pB && c.open >= pT - eps) out.push({ i, p, c });
  }
  return out;
}
function goldLevels(src, t) {
  const d0 = Math.floor(t / 86400) * 86400, L = [];
  const prev = src['1h'].bars.filter((b) => b.time >= d0 - 86400 && b.time < d0);
  if (prev.length) L.push(Math.max(...prev.map((b) => b.high)), Math.min(...prev.map((b) => b.low)));
  if (t >= d0 + 7 * 3600) { const asia = src['15m'].bars.filter((b) => b.time >= d0 && b.time < d0 + 7 * 3600); if (asia.length) L.push(Math.max(...asia.map((b) => b.high)), Math.min(...asia.map((b) => b.low))); }
  return L;
}
function replicaSignals(src) {
  const B5 = src['5m'].bars.slice(0, -1), B15 = src['15m'].bars.slice(0, -1), out = [];
  if (B5.length < 90 || B15.length < 20) return out;
  const atr15 = (() => { const b = B15.slice(-15); let s = 0; for (let i = 1; i < b.length; i++) s += Math.max(b[i].high - b[i].low, Math.abs(b[i].high - b[i - 1].close), Math.abs(b[i].low - b[i - 1].close)); return s / (b.length - 1); })();
  for (const L of [36, 72]) {
    const bars = B5.slice(-(L + 8)), n = bars.length;
    for (const sell of [false, true]) {
      const x = (b) => sell ? b.high : -b.low, y = (b) => sell ? -b.low : b.high;
      let iS = n - 1; for (let j = n - 1; j >= n - L; j--) if (y(bars[j]) > y(bars[iS])) iS = j;
      let iE = iS; for (let j = iS + 1; j < n; j++) if (x(bars[j]) > x(bars[iE])) iE = j;
      const ext = sell ? bars[iE].high : bars[iE].low, start = sell ? bars[iS].low : bars[iS].high;
      if (iS === iE || Math.abs(start - ext) < 2 * atr15) continue;
      const piv = (j, hi) => j - 1 >= 0 && j + 1 < n && (hi ? bars[j - 1].high <= bars[j].high && bars[j + 1].high < bars[j].high : bars[j - 1].low >= bars[j].low && bars[j + 1].low > bars[j].low);
      let iP = -1; for (let j = iE - 1; j > iS; j--) if (piv(j, !sell)) { iP = j; break; }
      const lvl = iP >= 0 ? (sell ? bars[iP].low : bars[iP].high) : start;
      let iC = -1; for (let j = iE + 1; j < n; j++) if (sell ? bars[j].close < lvl : bars[j].close > lvl) { iC = j; break; }
      if (iC < 0 || iC < n - 2) continue;   // the CHoCH must be one of the last two closed M5 candles
      // engulfing at the extreme (M5, last 2 h): the reversal candle body covers the previous opposite candle, near the extreme
      let eg = false; const B5r = B5.slice(-25);
      for (let j = 1; j < B5r.length && !eg; j++) { const p = B5r[j - 1], c = B5r[j];
        const ok = sell ? (p.close > p.open && c.close < c.open && c.close <= p.close && c.open >= p.open) : (p.close < p.open && c.close > c.open && c.close >= p.open && c.open <= p.close);
        if (ok && Math.abs((sell ? Math.max(p.high, c.high) : Math.min(p.low, c.low)) - ext) <= 0.5 * atr15) eg = true; }
      // the platform's engulfing at the extreme (M5 last 2 h, M15 last 2 h) and its ★ (at structure)
      let peg = false, star = false; const lv = goldLevels(src, bars.at(-1).time + 300);
      for (const [B, look] of [[B5, 24], [B15, 8]]) {
        const bb = B.slice(-(look + 25));
        for (const { i, p, c } of platformEngulfs(bb, !sell)) {
          if (i < bb.length - look) continue;
          if (Math.abs((sell ? Math.max(p.high, c.high) : Math.min(p.low, c.low)) - ext) > 0.5 * atr15) continue;
          peg = true; const mid = (c.high + c.low) / 2;
          if (lv.concat([Math.round(mid / 100) * 100, Math.round(mid / 50) * 50]).some((l) => Math.abs(mid - l) <= mid * 0.0012)) star = true;
        }
      }
      out.push({ sell, ext, lvl, start, atr: atr15, tc: bars[iC].time, L, eg, peg, star });
    }
  }
  return out;
}
for (const [key, M] of Object.entries(MARKETS)) {
  try {
    const src = {};
    for (const [id, iv] of (M30_MARKETS.has(key) ? TFS_M30 : TFS)) {
      const bars = await kraken(M.kraken, iv);
      await sleep(1100);
      const nBad = cleanBars(bars, M.group === 'Forex' && LTF_CLEAN.has(id) ? { wickK: 15 } : {});
      if (nBad) { snapshot.cleaned = snapshot.cleaned || {}; (snapshot.cleaned[key] = snapshot.cleaned[key] || {})[id] = nBad; }
      src[id] = { bars };
    }
    const off = M.spot ? basisFor(key, src['1m'].bars) : 0;
    for (const id of Object.keys(src)) {
      src[id].bars = src[id].bars.map((b) => ({ time: b.time, open: b.open + off, high: b.high + off, low: b.low + off, close: b.close + off }));
      src[id].A = msAnalyze(src[id].bars, 6);
    }
    const price = src['1m'].bars.at(-1).close;
    setMarket(M);
    const setups = BUILDERS.map(([pr, fn]) => { try { return fn(pr, price, src); } catch (e) { return null; } }).filter(Boolean);
    snapshot.markets[key] = {
      label: M.label, name: M.name, price, dec: M.dec,
      trend: Object.fromEntries(['1d', '4h', '1h'].map((k) => [k, src[k].A.trend])),
      setups: setups.map((t) => ({ k: t.k, name: t.name, pair: t.pair, side: t.sell ? 'sell' : 'buy', state: t.state, entry: t.entry, stop: t.stop, t1: t.t1, rr: +t.rr.toFixed(2), next: t.next, retrace: !!t.retrace })),
    };

    if (config.retireLegacy) for (const tr of trades.filter((x) => x.market === key && !x.shadow && x.k !== 'replica' && (x.status === 'open' || x.status === 'pending'))) {
      if (tr.status === 'pending') { tr.status = 'expired'; tr.R = 0; } else { const r0 = tr.r0 || Math.abs(tr.entry - tr.stop), R = +(((tr.side === 'sell' ? -1 : 1) * (price - tr.entry)) / r0).toFixed(2); tr.R = R; tr.status = R > 0 ? 'win' : R < 0 ? 'loss' : 'be'; }
      tr.closed = now; tr.exit = 'retired';
    }
    // ─── Manage open trades on this market with the candles since the last check ───
    for (const tr of trades.filter((x) => x.market === key && (x.status === 'pending' || x.status === 'open'))) {
      const bars = (src['1m'].bars[0].time <= tr.checked ? src['1m'] : src['5m'].bars[0].time <= tr.checked ? src['5m'] : src['15m']).bars;
      const s = tr.side === 'sell';
      let exitBar = null, next = bars.at(-1).time;
      // forex: leave the newest 3 one-minute candles for the next run, so a lone spike is judged (and clipped) before it can
      // fill, stop or target a trade
      const settle = M.group === 'Forex' && bars === src['1m'].bars ? bars.at(-1).time - 3 * 60 : Infinity;
      for (const b of bars) {
        if (b.time < tr.checked) continue;
        if (b.time > settle) { next = b.time; break; }
        if (tr.status === 'pending') {
          if (s ? b.high >= tr.entry : b.low <= tr.entry) { tr.status = 'open'; tr.filled = b.time; }
          else if (s ? b.low <= tr.t1 : b.high >= tr.t1) { tr.status = 'missed'; tr.closed = b.time; tr.R = 0; break; }
          else continue;
        }
        const r0 = tr.r0 || (tr.r0 = Math.abs(tr.entry - tr.stop));
        if (s ? b.high >= tr.stop : b.low <= tr.stop) {
          if (tr.trail && tr.trailMoved) { tr.R = +(((s ? tr.entry - tr.stop : tr.stop - tr.entry)) / r0).toFixed(2); tr.status = tr.R > 0 ? 'win' : tr.R < 0 ? 'loss' : 'be'; tr.exit = 'trailing stop'; }
          else if (tr.beMoved) { tr.status = 'be'; tr.R = 0; } else { tr.status = 'loss'; tr.R = -1; }
          tr.closed = b.time; exitBar = b; break;
        }
        if (s ? b.low <= tr.t1 : b.high >= tr.t1) { tr.status = 'win'; tr.closed = b.time; tr.R = tr.rr; exitBar = b; break; }
        if (tr.maxHold && b.time >= tr.filled + tr.maxHold) { const R = +((s ? tr.entry - b.close : b.close - tr.entry) / r0).toFixed(2); tr.status = R > 0 ? 'win' : R < 0 ? 'loss' : 'be'; tr.R = R; tr.closed = b.time; tr.exit = `${tr.maxHold / 3600} h`; exitBar = b; break; }
        // how far the trade went for (MFE) and against (MAE), in R: the Coach learns trade management from these
        tr.mfe = +Math.max(tr.mfe || 0, ((s ? tr.entry - b.low : b.high - tr.entry) / r0)).toFixed(2);
        tr.mae = +Math.max(tr.mae || 0, ((s ? b.high - tr.entry : tr.entry - b.low) / r0)).toFixed(2);
        // break-even rule from the Coach: once the trade is config.be R in profit, the stop moves to the entry
        // only on a candle that actually reached +be R: a trade that was past it before the rule existed and is now
        // back near the entry can't place a stop on the wrong side of price, so it waits until it gets there again
        // trailing stop (replica, 4 Nov): once the trade is trail[0] R in profit, the stop follows trail[1] R behind the best price
        if (tr.trail && tr.mfe >= tr.trail[0]) { const ns = tr.entry + (s ? -1 : 1) * (tr.mfe - tr.trail[1]) * r0; if (s ? ns < tr.stop : ns > tr.stop) { tr.stop = +ns.toFixed(2); tr.trailMoved = true; } }
        if (config.be && !tr.noBe && !tr.beMoved && ((s ? tr.entry - b.low : b.high - tr.entry) / r0) >= config.be) { tr.stop = tr.entry; tr.beMoved = true; }
      }
      tr.checked = exitBar ? bars.at(-1).time : next;
      // half-size trades (replica equity filter): the score counts R × size; rawR keeps the full-size result
      if (tr.size && tr.size !== 1 && tr.R != null && tr.rawR == null) { tr.rawR = tr.R; tr.R = +(tr.R * tr.size).toFixed(2); }
      if (exitBar) startReview(tr, exitBar, key, NEWS);
      if (tr.status === 'pending' && now - tr.opened > (WAIT[tr.h] || 86400)) { tr.status = 'expired'; tr.closed = now; tr.R = 0; }
    }

    // ─── Review closed trades: keep watching price after the exit, then give a verdict (system error or market) ───
    for (const tr of trades.filter((x) => x.market === key && (x.status === 'win' || x.status === 'loss' || x.status === 'be') && (!x.pm || x.pm.phase === 'watch'))) {
      if (!tr.pm) { if (now - tr.closed > 7 * 86400) continue; startReview(tr, null, key, NEWS); }   // trades closed before reviews existed
      const bars = (src['1m'].bars[0].time <= tr.pm.checked ? src['1m'] : src['5m'].bars[0].time <= tr.pm.checked ? src['5m'] : src['15m']).bars;
      watchReview(tr, bars);
    }

    // ─── Research (paper only, research.json): manage open Daily Cycle trades, then look for today's signal ───
    for (const r of research.filter((x) => x.market === key && x.k === 'replica' && (x.status === 'pending' || x.status === 'open'))) {
      const bars = (src['1m'].bars[0].time <= r.checked ? src['1m'] : src['5m'].bars[0].time <= r.checked ? src['5m'] : src['15m']).bars;
      const s = r.side === 'sell', r0 = Math.abs(r.entry - r.stop);
      for (const b of bars) {
        if (b.time < r.checked) continue;
        if (r.status === 'pending') {
          if (s ? b.high >= r.entry : b.low <= r.entry) { r.status = 'open'; r.filled = b.time; }
          else if (s ? b.low <= r.t1 : b.high >= r.t1) { r.status = 'missed'; r.R = 0; r.closed = b.time; break; }
          else { if (b.time > r.validUntil) { r.status = 'expired'; r.R = 0; r.closed = b.time; break; } continue; }
        }
        if (s ? b.high >= r.stop : b.low <= r.stop) { r.status = 'loss'; r.R = -1; r.closed = b.time; break; }
        if (s ? b.low <= r.t1 : b.high >= r.t1) { r.status = 'win'; r.R = +((Math.abs(r.t1 - r.entry)) / r0).toFixed(2); r.closed = b.time; break; }
        if (b.time >= r.filled + 48 * 3600) { const R = +((s ? r.entry - b.close : b.close - r.entry) / r0).toFixed(2); r.status = R > 0 ? 'win' : R < 0 ? 'loss' : 'be'; r.R = R; r.closed = b.time; r.exit = '48 h'; break; }
      }
      r.checked = bars.at(-1).time;
    }
    // 4 Nov: the replica runs unchanged on every market as research (paper, 2R): an out-of-sample test of the method itself.
    // Only gold trades it live (config.replicaLive). The 0.30 stop floor is in gold dollars, so other markets use 0.1 ATR alone.
    if (marketOpen(M, now)) {
      let sigs = []; try { sigs = replicaSignals(src); } catch (e) {}
      for (const g of sigs) {
        const sig = `replica|${g.sell ? 's' : 'b'}|${g.tc}`;
        if (research.some((x) => x.market === key && x.sig === sig)) continue;
        // v2 (3 Nov): market entry at the CHoCH, target 2R; the filter = clear of live H1 Origins OR an M5 engulfing at the
        // extreme (150-day gold replay: +0.075R / +0.077R a trade in both halves, keeps all four of the trader's trades)
        const entry = price, buf = key === 'xau' ? Math.max(0.1 * g.atr, 0.3) : 0.1 * g.atr, stop = g.sell ? g.ext + buf : g.ext - buf, r0 = Math.abs(entry - stop);
        if (!(r0 > 0) || (g.sell ? entry >= stop : entry <= stop)) continue;
        const h1live = src['1h'].A.events.filter((e) => e.endIdx == null && e.top > e.bot), h1clear = !h1live.some((e) => entry <= e.top && entry >= e.bot);
        // v3: pass = clear of H1 Origins or the platform's ★ engulfing at the extreme; star = the ★ engulfing alone
        // v4: and a stop of at least one M15 ATR (tighter stops sit inside M15 noise: −0.04R / −0.13R a trade on the replay)
        const riskAtr = r0 / g.atr, pass = (h1clear || g.star) && riskAtr >= 1, t1 = entry + (g.sell ? -2 : 2) * r0;
        // v5 (4 Nov): live only against the H4 trend (Mosha N=6). Year replay with this code: v4 +81.5R over 1,020 trades (Jan-May
        // −11.2R), v5 +74.8R over 500 (Jan-May +26.2R), 9 of 11 months positive, max drawdown −23.6R vs −29.9R. The H4 split was
        // logged as a candidate on Jun-Nov data before Jan-May existed, so Jan-May is its out-of-sample test.
        // latency (4 Nov): entries come about 4 min after the CHoCH candle closes. Year replay of v5 + trailing + 0.30 spread: on time
        // +0.20R a trade, 4–5 min late +0.19–0.20R (+0.16R with 0.2 slippage), 8 min +0.17R, 10 min +0.14R. A limit order back at the
        // signal close was worse (+0.08R: it fills the losers). Live entries more than 8 min late are skipped (kept as research).
        const lag = now - g.tc - 300, stale = lag > 480;
        const h4 = src['4h'].A.trend === (g.sell ? 1 : -1) ? 'against' : src['4h'].A.trend === (g.sell ? -1 : 1) ? 'with' : 'none', v5 = pass && h4 === 'against';
        research.push({ id: `${key}-replica-${now}-${g.sell ? 's' : 'b'}`, sig, market: key, label: M.label, dec: M.dec, k: 'replica', name: key === 'xau' ? 'Gold replica' : `${M.label} replica (method test)`, lag, side: g.sell ? 'sell' : 'buy',
          entry: +entry.toFixed(2), stop: +stop.toFixed(2), t1: +t1.toFixed(2), rr: 2, opened: now, filled: now, checked: now, status: 'open', R: null, v: 5,
          pass, v5, h4, h1clear, eg: g.eg, peg: g.peg, star: g.star, riskAtr: +riskAtr.toFixed(2), legStart: +g.start.toFixed(2), leg: g.L === 36 ? '3h' : '6h', ext: +g.ext.toFixed(2), chochLevel: +g.lvl.toFixed(2), d1: src['1d'].A.trend === (g.sell ? -1 : 1) ? 'with' : 'against', session: sessionOf(now),
          note: `Research (paper only): gold replica v5${!pass ? '' : h4 !== 'against' ? ' (v4 passes; v5 skips it: H4 trend not against the trade)' : ''}${pass ? '' : riskAtr < 1 ? ' (filter fails: stop under one M15 ATR)' : ' (filter fails: inside a live H1 Origin, no ★ engulfing)'}. ${g.L === 36 ? '3 h' : '6 h'} leg to ${g.ext.toFixed(2)}, M5 CHoCH through ${g.lvl.toFixed(2)}${g.star ? ', ★ engulfing at structure at the extreme' : g.peg ? ', engulfing at the extreme (not at a level)' : ''}${h1clear ? ', clear of H1 Origins' : ''}; ${g.sell ? 'sell' : 'buy'} ${entry.toFixed(2)}, stop ${stop.toFixed(2)}, target 2R ${t1.toFixed(2)}.` });
        // live (config.replicaLive): every passing signal also trades on the live book, as on the replay (no slot limit),
        // at market, 2R target, out after 48 h, no break-even move
        // exit (4 Nov): no fixed 2R target; once +1.5R the stop trails 1R behind the best price (cap 10R, out after 48 h). Year replay
        // of v5: 2R +74.8R (Jan-Jun +0.08R / Jun-Nov +0.22R a trade) vs trailing +98.7R (+0.17R / +0.23R); every nearby setting beat 2R
        // risk cap (4 Nov): at most 3 replica trades open at once (3R at risk). Year replay: +101.5R vs +98.7R uncapped, both halves
        // slightly better, worst drawdown −20.8R vs −21.8R. A daily −2R stop was tested and rejected (−4.4R a year: the skipped trades won).
        const capped = trades.filter((x) => x.k === 'replica' && x.market === key && !x.shadow && x.status === 'open').length >= 3;
        // risk (4 Nov, year replay: drawdown −20.8R → −14.2R, worst month −14.1R → −8.4R, profit +101.5R → +91.2R, both halves):
        // daily stop: no new replica trade once today's closed replica trades reach −1.5R (UTC day);
        // equity filter: half size while the replica's equity is below its own 50-trade average (seeded with the replay history)
        const liveRp = trades.filter((x) => x.k === 'replica' && x.market === key && !x.shadow && x.R != null && x.closed);
        const dayR = liveRp.filter((x) => Math.floor(x.closed / 86400) === Math.floor(now / 86400)).reduce((a, x) => a + x.R, 0), dayStop = dayR <= -1.5;
        let size = 1;
        { const hist = rd('research/replay-2w.json', { trades: [] }).trades.filter((x) => x.market === key && x.k === 'replica' && x.R != null && x.closed < (liveRp.length ? Math.min(...liveRp.map((y) => y.opened)) : Infinity))
            .concat(liveRp.map((x) => ({ R: x.rawR != null ? x.rawR : x.R, closed: x.closed }))).sort((a, b) => a.closed - b.closed);
          if (hist.length > 50) { let e = 0; const eq = hist.map((x) => (e += x.R)); const avg = eq.slice(-50).reduce((a, v) => a + v, 0) / 50; if (eq.at(-1) < avg) size = 0.5; } }
        if (v5 && capped) research.at(-1).capped = true;
        if (v5 && dayStop) research.at(-1).dayStop = true;
        if (v5 && stale) research.at(-1).stale = true;
        if (v5 && !capped && !dayStop && !stale && (config.replicaLive || []).includes(key)) trades.push({ id: `${key}-replica-${now}-${g.sell ? 's' : 'b'}`, market: key, label: M.label, dec: M.dec, k: 'replica', name: 'Replica', pair: 'M5 CHoCH', h: '5m', side: g.sell ? 'sell' : 'buy',
          entry: +entry.toFixed(2), stop: +stop.toFixed(2), t1: +(entry + (g.sell ? -10 : 10) * r0).toFixed(2), tp1: +t1.toFixed(2), rr: 10, trail: [1.5, 1.0], size, buf: CFG.buf, opened: now, filled: now, checked: now, status: 'open', R: null, r0: Math.abs(+entry.toFixed(2) - +stop.toFixed(2)), maxHold: 48 * 3600, noBe: true, entryMode: 'market', lag,
          feat: { d1: src['1d'].A.trend === (g.sell ? -1 : 1) ? 'with' : 'against', h4, session: sessionOf(now), star: g.star, h1clear, riskAtr: +riskAtr.toFixed(2), leg: g.L === 36 ? '3h' : '6h' }, shadow: false, blockedBy: [],
          note: `Gold replica (v5, against the H4 trend): ${g.L === 36 ? '3 h' : '6 h'} leg to ${g.ext.toFixed(2)}, M5 CHoCH through ${g.lvl.toFixed(2)}${g.star ? ', ★ engulfing at structure at the extreme' : g.peg ? ', engulfing at the extreme' : ''}${h1clear ? ', clear of H1 Origins' : ''}. ${g.sell ? 'Sell' : 'Buy'} at market, stop past the extreme; from +1.5R the stop trails 1R behind the best price (2R mark ${t1.toFixed(2)}), out after 48 h.` });
      }
    }
    for (const r of research.filter((x) => x.market === key && x.k !== 'replica' && x.status === 'open')) {
      const bars = (src['1m'].bars[0].time <= r.checked ? src['1m'] : src['5m'].bars[0].time <= r.checked ? src['5m'] : src['15m']).bars;
      const s = r.side === 'sell', r0 = Math.abs(r.entry - r.stop);
      for (const b of bars) {
        if (b.time < r.checked) continue;
        if (s ? b.high >= r.stop : b.low <= r.stop) { r.status = 'loss'; r.R = -1; r.closed = b.time; break; }
        if (s ? b.low <= r.t1 : b.high >= r.t1) { r.status = 'win'; r.R = +((Math.abs(r.t1 - r.entry)) / r0).toFixed(2); r.closed = b.time; break; }
        if (b.time >= r.closeBy) { const R = +((s ? r.entry - b.close : b.close - r.entry) / r0).toFixed(2); r.status = R > 0 ? 'win' : R < 0 ? 'loss' : 'be'; r.R = R; r.closed = b.time; r.exit = '8 h'; break; }
      }
      r.checked = bars.at(-1).time;
    }
    if (M.group === 'Crypto') {
      let cyc = null; try { cyc = dailyCycle(src, price, now); } catch (e) {}
      if (cyc && !research.some((x) => x.market === key && x.k === 'cycle' && x.day === cyc.day)) {
        research.push({ id: `${key}-cycle-${now}`, market: key, label: M.label, dec: M.dec, k: 'cycle', name: 'Daily Cycle', side: cyc.sell ? 'sell' : 'buy',
          entry: cyc.entry, stop: cyc.stop, t1: cyc.t1, rr: 3, opened: now, filled: now, checked: now, status: 'open', R: null, closeBy: cyc.closeBy, day: cyc.day,
          londonHigh: cyc.londonHigh, londonLow: cyc.londonLow, d1: src['1d'].A.trend === (cyc.sell ? -1 : 1) ? 'with' : 'against',
          note: `Research (paper only): London ${cyc.sell ? 'sold off' : 'rallied'} ${cyc.londonLow.toFixed(M.dec)}–${cyc.londonHigh.toFixed(M.dec)}; NY-open retracement into the 62–70% zone. Target 3R, out at 21:00 UTC.` });
      }
    }

    // ─── Take new Ready setups ───
    snapshot.markets[key].open = marketOpen(M, now);
    for (const t of (marketOpen(M, now) ? setups : [])) {
      // signals are remembered per market: the signature is only the setup and two candle times, which correlated
      // markets (EUR/USD and GBP/USD on the same dollar news) share, so a global memory dropped the second market's signal.
      // An unprefixed key is from before this and still counts, so nothing already handled is taken again.
      const sk = `${key}|${t.sig}`;
      if (t.state !== 'READY' || state.seen[sk] || state.seen[t.sig]) continue;
      state.seen[sk] = now;
      // the same setup re-signalling the same idea (same side and target, a fresh M1 break a few candles later) while
      // that idea is still open: skip it, live or shadow, so risk isn't stacked and the Coach doesn't count one idea three times
      if (trades.some((x) => x.market === key && x.k === t.k && x.side === (t.sell ? 'sell' : 'buy') && (x.status === 'open' || x.status === 'pending') && Math.abs(x.t1 - t.t1) <= Math.abs(t.t1) * 1e-5)) continue;
      const def = PAIRS_T.concat(RETR).find((p) => p.k === t.k), cfT = +String(t.sig).split('|')[2];
      if (!cfT || now - cfT > (config.fresh || FRESH) * SEC[def.l]) continue;   // an old CF: the move already happened
      // Conditions at the signal: the Coach learns which of them win
      const feat = { d1: src['1d'].A.trend === (t.sell ? -1 : 1) ? 'with' : 'against', struct: t.retr == null ? 'n/a' : t.retr >= 0.5 ? 'main' : 'internal', session: sessionOf(now), ...structFeat(t, def, src, now), m15c: m15cFeat(src['15m'].bars, t.sell, now) };
      // Rules from the Coach. A blocked setup is still followed as a SHADOW trade (no score), so the Coach can check the rule was right
      const f = config.filters[t.k] || {}, blockedBy = [];
      if (config.paused[t.k]) blockedBy.push('paused');
      if (config.pausedMarkets[key]) blockedBy.push('market');
      // a market fill changes the reward:risk, so judge the rule on the price we would really get
      // fill at market when price is already through the entry, or when the Coach set this setup to enter at market
      // (the backtest showed waiting for the pullback misses more than it saves)
      const mktEntry = (config.entry || {})[t.k] === 'market', mkt = (t.sell ? price >= t.entry : price <= t.entry) || mktEntry;
      // target: the first target (default) or, where the trader or the backtest set it, the second (a retracement's Origin)
      const toT2 = (config.target || {})[t.k] === 't2' && t.t2 != null && (t.t2 - t.t1) * (t.sell ? -1 : 1) > 0, T1 = toT2 ? t.t2 : t.t1;
      const rrNow = (T1 - (mkt ? price : t.entry)) * (t.sell ? -1 : 1) / Math.abs((mkt ? price : t.entry) - t.stop);
      if (!(rrNow >= config.minRR)) blockedBy.push('minRR');
      // news guard (the Coach turns it on when news keeps stopping trades out): no short-term trade from 15 min before to 45 min after high-impact news
      if (config.newsGuard && (def.h === '15m' || def.h === '1h') && newsNear(key, M.label, NEWS, now - 15 * 60, now + 45 * 60).length) blockedBy.push('news');
      if (f.d1 && feat.d1 !== f.d1) blockedBy.push('d1');
      if (f.cf && feat.cf !== f.cf) blockedBy.push('cf');
      if (f.choch && feat.choch !== f.choch) blockedBy.push('choch');
      if (f.m15c && feat.m15c !== f.m15c) blockedBy.push('m15c');
      if (f.struct && feat.struct !== 'n/a' && feat.struct !== f.struct) blockedBy.push('struct');
      if (f.noSession && f.noSession.includes(feat.session)) blockedBy.push('session');
      // per-setup rules from the 150-day research (2 Nov): a setup switched off, a reward:risk band, markets it skips
      if (f.off) blockedBy.push('off');
      if (f.minRR && !(rrNow >= f.minRR)) blockedBy.push('rrBand');
      if (f.maxRR && rrNow > f.maxRR) blockedBy.push('rrBand');
      if ((f.noMarket || []).includes(key)) blockedBy.push('market');
      // exposure: at most MAX_OPEN live trades per market, and never long and short the same market at once
      const live = trades.filter((x) => x.market === key && !x.shadow && (x.status === 'open' || x.status === 'pending'));
      if (live.length >= MAX_OPEN || live.some((x) => x.side !== (t.sell ? 'sell' : 'buy'))) blockedBy.push('exposure');
      // the same idea twice (another setup with the same stop and target, e.g. intraday and scalp sharing one M5 structure) doubles the risk: take it once
      const tick = Math.abs(t.entry) * 1e-5;
      if (live.some((x) => Math.abs(x.stop - t.stop) <= tick && Math.abs(x.t1 - t.t1) <= tick)) blockedBy.push('duplicate');
      const ud = usdDir(M, t.sell ? 'sell' : 'buy');
      if (ud && trades.filter((x) => !x.shadow && (x.status === 'open' || x.status === 'pending') && MARKETS[x.market] && usdDir(MARKETS[x.market], x.side) === ud).length >= (config.maxUsd || MAX_USD)) blockedBy.push('usd');
      if (config.focus && config.focus.length && !config.focus.includes(key)) blockedBy.push('focus');
      if ((config.replicaLive || []).includes(key)) blockedBy.push('replica');   // this market trades the replica live
      // re-entry (3 Nov, gold 150-day replay): a Scalp in the same direction within 3 h of a Scalp loss on this market loses
      // in every month (−0.24R a trade on the first 100 days, −0.52R, t −4.1, on the last 50; the other Scalps net +0.6R).
      // Like a duplicate it stays a shadow even under take-all, so its results keep being recorded.
      if (t.k === 'scalp' && trades.some((x) => x.market === key && x.k === 'scalp' && x.side === (t.sell ? 'sell' : 'buy') && x.status === 'loss' && x.closed && now - x.closed <= 3 * 3600)) blockedBy.push('reentry');
      // take-all (user): only a literal duplicate (or a market outside the focus) stays a shadow; every other blocked signal
      // trades, with its blockers recorded
      const shadow = config.takeAll ? blockedBy.includes('duplicate') || blockedBy.includes('focus') || blockedBy.includes('reentry') || blockedBy.includes('replica') : blockedBy.length > 0;
      const why = { paused: `paused until ${String(config.paused[t.k]).slice(0, 10)}`, minRR: `reward:risk ${(isFinite(rrNow) ? rrNow : 0).toFixed(2)} under ${config.minRR}`, d1: `rule: only ${f.d1} D1`, cf: `rule: only ${f.cf === 'choch' ? 'a CHoCH' : 'a continuation BO'} as the confirming break`, choch: `rule: ${f.choch === 'yes' ? 'needs' : 'no'} fresh M15/M5 CHoCH`, m15c: `rule: ${f.m15c === 'yes' ? 'needs' : 'no'} M15 CHoCH (the trader's) within the hour`, struct: `rule: only ${f.struct} structure`, session: `rule: not in ${feat.session}`, exposure: 'already 2 trades or an opposite trade open on this market', news: 'high-impact news within the hour', duplicate: 'same stop and target as a trade already open', reentry: 'a Scalp the same way lost on this market in the last 3 hours', replica: 'this market trades the gold replica live', usd: `already ${config.maxUsd || MAX_USD} trades betting the same way on the dollar`, market: (f.noMarket || []).includes(key) ? `rule: ${t.k} skips ${key}` : `market paused until ${String(config.pausedMarkets[key]).slice(0, 10)}`, off: `rule: ${t.k} is switched off`, focus: `focus: only ${(config.focus || []).join(', ')} trades live`, rrBand: `rule: ${t.k} only at reward:risk ${f.minRR ? `≥ ${f.minRR}` : ''}${f.minRR && f.maxRR ? ' and ' : ''}${f.maxRR ? `≤ ${f.maxRR}` : ''}` };
      const h = def.h;
      const tr = { id: `${key}-${t.k}-${now}`, market: key, label: M.label, dec: M.dec, k: t.k, name: t.name, pair: t.pair, h, side: t.sell ? 'sell' : 'buy',
        entry: t.entry, stop: t.stop, t1: T1, rr: +(toT2 ? Math.abs(T1 - t.entry) / Math.abs(t.entry - t.stop) : t.rr).toFixed(2), buf: CFG.buf, opened: now, checked: now, status: 'pending', R: null, feat,
        shadow, blockedBy, note: shadow ? `Shadow (${blockedBy.map((b) => why[b]).join(', ')})` : blockedBy.length ? `${t.next} Taken under take-all; the rules would block it (${blockedBy.map((b) => why[b]).join(', ')}).` : t.next };
      // held to the second target: the first one is kept for the record, and the order stays valid until price reaches the Origin
      if (toT2) { tr.tp1 = t.t1; tr.target = 't2'; if (!shadow) tr.note += ` Holding to ${T1.toFixed(M.dec)}, ${t.retrace ? `the ${String(t.pair).split(' ')[0]} Origin` : 'the second target'} (${(config.targetBy || {})[t.k] === 'user' ? "the trader's rule" : 'backtest'}).`; }
      try { tr.ctx = entryContext(t, src, def, M, price); } catch (e) {}
      if (mkt) {
        // fill at the market price, never at a better level than was available
        if (mktEntry) tr.entryMode = 'market';
        tr.entry = price; tr.status = 'open'; tr.filled = now;
        const r = Math.abs(tr.entry - tr.stop), rw = (tr.t1 - tr.entry) * (t.sell ? -1 : 1);
        if (!(r > 0) || (t.sell ? price >= tr.stop : price <= tr.stop) || rw <= 0) { tr.status = 'skipped'; tr.note = 'Price already past the stop or target when the signal came in.'; }
        else tr.rr = +(rw / r).toFixed(2);
      }
      trades.push(tr);
    }
  } catch (e) { snapshot.errors[key] = String(e.message || e); }
}

// forget signatures older than 30 days, keep the last 3000 trades
for (const [sig, t] of Object.entries(state.seen)) if (now - t > 30 * 86400) delete state.seen[sig];
trades = trades.slice(-3000);
state.lastRun = now;

// ─── Daily statistical Coach: small, bounded rule changes from the results ───
// ─── Self-evolution: learn condition filters (D1 / structure / session) from the trades that lose.
// Runs every 6 hours (the other Coach rules stay daily), so a clearly losing condition is filtered within hours, not a day.
const exp = (arr) => arr.length ? arr.reduce((a, x) => a + x.R, 0) / arr.length : 0;
// ─── Backtest evidence (council/backtest.mjs replays 30 days of real candles through these same rules, daily) ───
// A finding becomes a rule only when it is large, holds in BOTH halves of the replayed period, and is statistically
// clear. Trades on the same market and UTC day are not independent (one move fires several setups), so standard
// errors are clustered by market-day. It outranks the small live samples (a handful of trades) it would otherwise fight.
const BT = (() => {
  const b = rd('backtest.json', null);
  if (!b || b.fake || !Array.isArray(b.trades) || !b.trades.length || now - Date.parse(b.at) / 1000 > 3 * 86400) return null;
  const T = b.trades.map((r) => Object.fromEntries(b.tradeCols.map((c, i) => [c, r[i]])));
  // judge every result after costs: each backtest trade carries its spread in R (one spread per round trip)
  if (b.tradeCols.includes('cost')) for (const t of T) for (const k of ['R_none', 'R_be1', 'R_be15', 'R_tp2']) if (t[k] != null) t[k] = +(t[k] - (t.cost || 0)).toFixed(3);
  // TA: every row, incl. market-entry twins ('<k>@mkt') and resting orders that never filled (fill 0, 0R);
  // T: the trades as the Trader takes them now (filled, no twins) — what every rule except the entry style is judged on
  const TA = T, TT = TA.filter((t) => t.fill !== 0 && !String(t.setup).includes('@'));
  return { b, T: TT, TA, mid: TT.map((t) => t.opened).sort((x, y) => x - y)[TT.length >> 1] };
})();
const DEF_KEYS = new Set(PAIRS_T.concat(RETR).map((p) => p.k));   // setups the Trader actually trades (research setups are only backtested)
// mean R with a market-day clustered standard error (CR1) and its t-value; g = number of market-day clusters
function btE(arr, key = 'R_none') {
  const v = arr.filter((t) => t[key] != null && isFinite(t[key])), n = v.length;
  if (!n) return { n: 0, e: 0, se: Infinity, t: 0, g: 0 };
  const e = v.reduce((a, t) => a + t[key], 0) / n, cl = new Map();
  for (const t of v) { const c = `${t.market}|${Math.floor(t.opened / 86400)}`; cl.set(c, (cl.get(c) || 0) + (t[key] - e)); }
  const g = cl.size; let ss = 0; for (const u of cl.values()) ss += u * u;
  const se = g > 1 ? Math.sqrt(ss * g / (g - 1)) / n : Infinity;
  const t = !isFinite(se) ? 0 : se > 0 ? e / se : e === 0 ? 0 : Math.sign(e) * Infinity;   // identical results in 2+ clusters: as clear as it gets
  return { n, e, se, t, g };
}
const btHalves = (arr, key) => [btE(arr.filter((t) => t.opened < BT.mid), key), btE(arr.filter((t) => t.opened >= BT.mid), key)];
// two groups: t-value of the gap between their means (their covariance is ignored, which only makes this stricter)
const btGapT = (a, b) => { const se = Math.hypot(a.se, b.se); return isFinite(se) && se > 0 ? (a.e - b.e) / se : 0; };
// one group, two management variants of the same trades: clustered mean and t-value of the per-trade difference
const btPaired = (arr, k1, k2) => btE(arr.map((t) => ({ market: t.market, opened: t.opened, d: t[k1] - t[k2] })), 'd');
const tTxt = (t) => !isFinite(t) ? 'every trade alike' : `t = ${t.toFixed(1)}`;
// the backtest's verdict on a setup as it trades now (with its D1 filter): clearly profitable?
function btPositive(k) {
  if (!BT) return null;
  const f = config.filters[k] || {}, a = BT.T.filter((t) => t.setup === k && passesFilters(t, f)), all = btE(a), [h1, h2] = btHalves(a);
  return all.n >= 100 && all.e >= 0.1 && all.t >= 2.5 && h1.e > 0 && h2.e > 0 ? all : null;
}
function learnFromBacktest(change) {
  if (!BT || config.btAt === BT.b.at) return;
  config.btAt = BT.b.at;
  const days = BT.b.days || 30, f2 = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}R`;
  // decisions only for the setups the Trader trades (research setups such as the sweeps are only reported)
  const setups = [...new Set(BT.T.map((t) => t.setup))].filter((k) => DEF_KEYS.has(k)), TD = BT.T.filter((t) => DEF_KEYS.has(t.setup));
  const sides = (k, c, vals) => { const a = BT.T.filter((t) => t.setup === k);
    return Object.fromEntries(vals.map((v) => { const arr = a.filter((t) => t[c] === v); return [v, { ...btE(arr), h: btHalves(arr) }]; })); };
  // 1. condition filters per setup (D1 with/against; confirming break CHoCH/BO; fresh M15/M5 CHoCH yes/no): one side
  //    clearly wins and the other clearly loses, in both halves, and the gap is statistically clear (t >= 3: about 7
  //    setups x 3 conditions are tested at once, so a looser bar would find chance "rules")
  for (const k of setups) for (const [c, v1, v2, txt] of CONDS) {
    if (!BT.b.tradeCols.includes(c)) continue;   // an older backtest without this condition
    const S = sides(k, c, [v1, v2]), fl = config.filters[k] || {}, other = (v) => v === v1 ? v2 : v1;
    // a filter the backtest set earlier, whose excluded side is no longer worse: drop it
    if (fl[c] && (fl.src || {})[c] === 'backtest') {
      const kept = S[fl[c]], out = S[other(fl[c])];
      if (kept.n >= 15 && out.n >= 15 && out.e >= kept.e) {
        change(`${k}: "only ${txt(fl[c])}" dropped (backtest)`, `${f2(kept.e)} each over ${kept.n}, the excluded side ${f2(out.e)} over ${out.n}: the filter no longer helps.`);
        delete fl[c]; if (fl.since) delete fl.since[c]; if (fl.src) delete fl.src[c];
      }
    }
    if (S[v1].n < 30 || S[v2].n < 30) continue;
    const win = S[v1].e > S[v2].e ? v1 : v2, lose = other(win), gap = btGapT(S[win], S[lose]);
    if (!(S[win].e >= 0.1 && S[lose].e <= -0.1 && gap >= 3 && S[win].h[0].e > S[lose].h[0].e && S[win].h[1].e > S[lose].h[1].e)) continue;
    const f = config.filters[k] = config.filters[k] || {};
    if (f[c] === win && (f.src || {})[c] === 'backtest') continue;
    const was = f[c];
    f[c] = win; (f.since = f.since || {})[c] = nowISO; (f.src = f.src || {})[c] = 'backtest';
    change(`${k}: only ${txt(win)} (backtest)${was && was !== win ? `, replacing "only ${txt(was)}"` : ''}`, `${S[win].n + S[lose].n} trades over the last ${days} days: ${txt(win)} ${f2(S[win].e)} each, ${txt(lose)} ${f2(S[lose].e)} (gap ${tTxt(gap)}); true in both halves.`);
  }
  for (const [k, fl] of Object.entries(config.filters)) if (emptyFilter(fl)) delete config.filters[k];
  // 2. Break-even: compared trade by trade with no break-even; a level is used only if it clearly adds R (t >= 2)
  //    and adds R in both halves
  if (TD.length >= 300) {
    const none = btE(TD, 'R_none'), cand = [[1, 'R_be1'], [1.5, 'R_be15']].map(([be, key]) => {
      const d = btPaired(TD, key, 'R_none'), [h1, h2] = [btPaired(TD.filter((t) => t.opened < BT.mid), key, 'R_none'), btPaired(TD.filter((t) => t.opened >= BT.mid), key, 'R_none')];
      return { be, d, ok: d.e >= 0.02 && d.t >= 2 && h1.e > 0 && h2.e > 0 };
    });
    const best = cand.filter((c) => c.ok).sort((x, y) => y.d.e - x.d.e)[0], want = best ? best.be : null;
    if ((config.be || null) !== want) {
      change(want ? `Break-even at +${want}R (backtest)` : 'Break-even turned off (backtest)', `${none.n} trades over the last ${days} days: no break-even ${f2(none.e)} each; break-even at +1R changes that by ${f2(cand[0].d.e)} (${tTxt(cand[0].d.t)}), at +1.5R by ${f2(cand[1].d.e)} (${tTxt(cand[1].d.t)}).`);
      config.be = want; if (want) config.beSince = nowISO; else delete config.beSince;
    }
    config.beSrc = 'backtest';
  }
  // 3. a setup the backtest shows clearly losing as it trades now (10+ trades at -0.3R or worse each, or 8+ at
  //    -0.5R or worse; negative in both halves; t <= -2): pause it until the next backtest can re-check it
  for (const k of setups) {
    if (!DEF_KEYS.has(k) || config.paused[k]) continue;
    const f = config.filters[k] || {}, a = BT.T.filter((t) => t.setup === k && passesFilters(t, f)), all = btE(a), [h1, h2] = btHalves(a);
    if (((all.n >= 10 && all.e <= -0.3) || (all.n >= 8 && all.e <= -0.5)) && all.t <= -2 && h1.e < 0 && h2.e < 0) {
      if (config.noPause) { wouldPause(k, `backtest: ${all.n} trades at ${f2(all.e)} each`); continue; }
      config.paused[k] = new Date((now + 3 * 86400) * 1000).toISOString();
      change(`Paused ${k} for 3 days (backtest)`, `${all.n} past trades as it trades now made ${f2(all.e)} each (${tTxt(all.t)}, ${all.g} market-days), negative in both halves of the last ${days} days.`);
    }
  }
  // 4. a setup paused on a small live sample that the backtest shows is clearly profitable: resume it
  for (const k of Object.keys(config.paused)) {
    const pos = btPositive(k), live = pauseSample(trades.filter((x) => x.k === k && (x.status === 'win' || x.status === 'loss' || x.status === 'be') && now - x.closed < 30 * 86400));
    if (pos && live.length < 15) { delete config.paused[k]; change(`Resumed ${k} (backtest)`, `Paused on ${live.length} trades, but ${pos.n} past trades as it trades now made ${f2(pos.e)} each (${tTxt(pos.t)}), in both halves of the last ${days} days.`); }
  }
  // 5. target per setup: the first target, or the
  //    second one (a retracement's Origin, a main setup's next level). Compared trade by trade with the first. The
  //    backtest sets the second at >= +0.05R per trade, t >= 2.5, both halves, and keeps it while it is still ahead; a
  //    target the trader set stays unless the second target is clearly worse (<= -0.05R per trade, t <= -2, both halves).
  config.target = config.target || {}; config.targetBy = config.targetBy || {};
  for (const k of setups.filter((x) => DEF_KEYS.has(x))) {
    const f = config.filters[k] || {}, a = BT.T.filter((t) => t.setup === k && passesFilters(t, f) && t.R_tp2 != null);
    if (a.length < 30) continue;
    const d = btPaired(a, 'R_tp2', 'R_none'), h1 = btPaired(a.filter((t) => t.opened < BT.mid), 'R_tp2', 'R_none'), h2 = btPaired(a.filter((t) => t.opened >= BT.mid), 'R_tp2', 'R_none');
    const on = config.target[k] === 't2', by = config.targetBy[k];
    const why = `${a.length} trades over the last ${days} days: the second target ${f2(d.e)} per trade versus the first (${tTxt(d.t)}), ${f2(h1.e)} and ${f2(h2.e)} in the two halves.`;
    if (!on && d.e >= 0.05 && d.t >= 2.5 && h1.e > 0 && h2.e > 0) { config.target[k] = 't2'; config.targetBy[k] = 'backtest'; change(`${k}: hold to the second target (backtest)`, why); }
    else if (on && (by === 'user' ? d.e <= -0.05 && d.t <= -2 && h1.e < 0 && h2.e < 0 : d.e <= 0)) { delete config.target[k]; delete config.targetBy[k]; change(`${k}: back to the first target (backtest${by === 'user' ? ", overriding the trader's rule" : ''})`, why); }
  }
  // 6. entry style per setup: a resting order at the CF level (default) or entering at market at the signal. Compared
  //    signal by signal on the same signals (a resting order that never fills counts 0R), after spread, on the signals
  //    the setup's D1 filter lets through. Market entry needs >= +0.05R per signal at t >= 2.5 and to win in both halves;
  //    once on, it stays while it is still ahead. Judged at the target the setup uses (step 5).
  config.entry = config.entry || {};
  for (const k of setups.filter((x) => DEF_KEYS.has(x))) {
    const f = config.filters[k] || {}, lim = new Map(BT.TA.filter((t) => t.setup === k && passesFilters(t, f)).map((t) => [`${t.market}|${t.opened}`, t]));
    const col = config.target[k] === 't2' ? 'R_tp2' : 'R_none';
    const pairs = BT.TA.filter((t) => t.setup === `${k}@mkt` && lim.has(`${t.market}|${t.opened}`)).map((t) => ({ market: t.market, opened: t.opened, d: t[col] - lim.get(`${t.market}|${t.opened}`)[col] }));
    if (pairs.length < 30) continue;
    const dd = btE(pairs, 'd'), h1 = btE(pairs.filter((p) => p.opened < BT.mid), 'd'), h2 = btE(pairs.filter((p) => p.opened >= BT.mid), 'd');
    const clear = dd.e >= 0.05 && dd.t >= 2.5 && h1.e > 0 && h2.e > 0, want = clear || (config.entry[k] === 'market' && dd.e > 0) ? 'market' : 'limit';
    if ((config.entry[k] || 'limit') === want) continue;
    if (want === 'market') config.entry[k] = 'market'; else delete config.entry[k];
    change(want === 'market' ? `${k}: enter at market (backtest)` : `${k}: back to waiting for the pullback (backtest)`, `${pairs.length} signals over the last ${days} days: entering at market ${f2(dd.e)} per signal versus the resting order (${tTxt(dd.t)}), ${f2(h1.e)} and ${f2(h2.e)} in the two halves.`);
  }
}

// trade management: losers that were +1R or more first (live and shadow, last 14 days) turn break-even at +1R on.
// mfe is known at the close, so this doesn't wait for the post-exit review window. Defers to the backtest once it has spoken.
function learnManagement(closedAll, change) {
  if (config.be || config.beSrc === 'backtest') return;
  const losses = closedAll.filter((x) => x.status === 'loss' && now - x.closed < 14 * 86400), gave = losses.filter((x) => (x.mfe || 0) >= 1);
  if (losses.length >= 6 && gave.length >= 4 && gave.length / losses.length >= 0.25) {
    config.be = 1; config.beSince = nowISO;
    change('Break-even at +1R turned on', `${gave.length} of ${losses.length} recent losers (live and shadow) were +1R or more before turning around.`);
  }
}

function learnFilters(closedAll, change) {
  // ─── Self-evolution: learn filters from the conditions that lose, and drop them when shadow trades prove them wrong ───
  // evidence for condition filters: scored trades plus shadow trades blocked for reasons unrelated to the conditions
  // (reward:risk, exposure, duplicate, dollar cap…): their outcomes are just as informative about D1/structure/session
  const learnBy = {};
  for (const t of closedAll) if (!t.shadow || !(t.blockedBy || []).some((b) => b === 'd1' || b === 'struct' || b === 'session')) (learnBy[t.k] = learnBy[t.k] || []).push(t);
  for (const [k, arr] of Object.entries(learnBy)) {
    if (arr.length < 8) continue;
    const fl = config.filters[k] = config.filters[k] || {};
    for (const fe of ['d1', 'struct']) {
      if (fl[fe]) continue;
      const g = {}; arr.forEach((x) => { const v = x.feat && x.feat[fe]; if (v && v !== 'n/a') (g[v] = g[v] || []).push(x); });
      const vals = Object.entries(g).map(([v, a]) => ({ v, n: a.length, e: exp(a) }));
      const bad = vals.find((x) => x.n >= 5 && x.e < -0.2), good = vals.find((x) => x.n >= 3 && x.e > 0.1);
      if (bad && good) { fl[fe] = good.v; (fl.since = fl.since || {})[fe] = nowISO; change(`${k}: only ${good.v} ${fe === 'd1' ? 'D1' : 'structure'}`, `${bad.v}: ${bad.e.toFixed(2)}R over ${bad.n} trades; ${good.v}: +${good.e.toFixed(2)}R over ${good.n}.`); }
      else if (bad && bad.n >= 6 && bad.e <= -0.6) {
        // a condition that keeps losing badly is filtered even before the other side has proven itself; its shadow trades can undo this
        const other = { against: 'with', internal: 'main' }[bad.v];   // only ever narrows to the trend side / main structure
        if (other) { fl[fe] = other; (fl.since = fl.since || {})[fe] = nowISO; change(`${k}: only ${other} ${fe === 'd1' ? 'D1' : 'structure'}`, `${bad.v}: ${bad.e.toFixed(2)}R over ${bad.n} trades, too costly to keep taking while ${other} is tested.`); }
      }
    }
    const gs = {}; arr.forEach((x) => { const v = x.feat && x.feat.session; if (v) (gs[v] = gs[v] || []).push(x); });
    for (const [v, a] of Object.entries(gs)) {
      if ((fl.noSession || []).includes(v) || a.length < 5 || exp(a) >= -0.2) continue;
      const rest = arr.filter((x) => !(x.feat && x.feat.session === v));
      if (rest.length >= 3 && exp(rest) > 0) { fl.noSession = (fl.noSession || []).concat(v); (fl.since = fl.since || {})['session:' + v] = nowISO; change(`${k}: skip the ${v} session`, `${exp(a).toFixed(2)}R over ${a.length} trades there; +${exp(rest).toFixed(2)}R elsewhere.`); }
    }
  }
}

// setups: pause one for 3 days when it loses (6+ trades worse than -0.25R each, or 4 losses in a row).
// The sample is live trades plus shadows blocked only for portfolio reasons (exposure, dollar cap, duplicate):
// those say nothing about the setup's quality, so they count as real evidence (scalps lost 20 such trades
// before 6 live ones triggered the pause). Checked on every run, not once a day.
const NEUTRAL = new Set(['exposure', 'usd', 'duplicate']);
const pauseSample = (closedAll) => closedAll.filter((x) => !x.shadow || ((x.blockedBy || []).length && x.blockedBy.every((b) => NEUTRAL.has(b))));
// the backtest's verdict on a setup as it trades now: at least break-even over 50+ trades (after spread)?
function btNonNeg(k) {
  if (!BT) return null;
  const f = config.filters[k] || {}, all = btE(BT.T.filter((t) => t.setup === k && passesFilters(t, f)));
  return all.n >= 50 && all.e >= 0 ? all : null;
}
// config.noPause (the trader's rule, 3 Nov): nothing is paused, every setup and market keeps trading so there is data to
// study; what the Coach would have paused is kept in config.wouldPause instead (latest reason per setup or market)
function wouldPause(key, why) { config.wouldPause = config.wouldPause || {}; config.wouldPause[key] = { at: nowISO, why }; }
function learnPauses(sample, change) {
  const bySetup = {};
  for (const t of [...sample].sort((a, b) => a.closed - b.closed)) (bySetup[t.k] = bySetup[t.k] || []).push(t);
  const ex = (arr) => arr.length ? arr.reduce((a, x) => a + x.R, 0) / arr.length : 0;
  // a losing streak inside a record that pays is variance: a setup paused on one resumes once its own trades and the
  // backtest both make money (2 Nov: rintra paused at 19:07 on four losses in a row, its 9 trades +0.68R overall, two
  // gold winners zeroed by the old break-even rule, the backtest +0.16R a trade over 96)
  // resume a paused setup early when the trades it would really have taken recover: shadows blocked only by the pause
  // and portfolio limits (a shadow its own D1/condition rules also block was never going to be taken). Every run.
  // 2 Nov: scalp's 21 paused shadows made +0.16R each, but the 11 it would have taken +0.70R.
  for (const k of Object.keys(config.paused)) {
    const sh = trades.filter((x) => x.k === k && x.shadow && (x.status === 'win' || x.status === 'loss' || x.status === 'be') && now - x.closed < 30 * 86400
      && (x.blockedBy || []).includes('paused') && x.blockedBy.every((b) => b === 'paused' || NEUTRAL.has(b)));
    const e = ex(sh);
    if (sh.length >= 4 && e > 0.3) { delete config.paused[k]; (config.resumedAt = config.resumedAt || {})[k] = now; change(`Resumed ${k} early`, `The ${sh.length} trades it would have taken while paused (blocked only by the pause or portfolio limits) made +${e.toFixed(2)}R each.`); }
  }
  for (const k of Object.keys(config.paused)) {
    const arr = bySetup[k] || [], bt = btNonNeg(k);
    if (arr.length >= 6 && ex(arr) >= 0 && bt) { delete config.paused[k]; (config.resumedAt = config.resumedAt || {})[k] = now; change(`Resumed ${k}`, `Its last ${arr.length} trades made ${ex(arr) >= 0 ? '+' : ''}${ex(arr).toFixed(2)}R each and the backtest ${bt.e >= 0 ? '+' : ''}${bt.e.toFixed(2)}R over ${bt.n}: a losing streak inside a record that pays is variance.`); }
  }
  for (const [k, all] of Object.entries(bySetup)) {
    if (config.paused[k]) continue;
    // after a resume, only trades opened since then count: the ones that caused the pause were already judged
    const arr = all.filter((x) => x.opened >= ((config.resumedAt || {})[k] || 0));
    if (btPositive(k) && arr.length < 15) continue;   // the backtest says it pays: a few live losses aren't enough to pause it
    const n = arr.length, e = ex(arr), last4 = arr.slice(-4);
    // four losses in a row pause only a setup that is losing overall and that the backtest doesn't show paying
    const streak = last4.length === 4 && last4.every((x) => x.status === 'loss') && e < 0 && !btNonNeg(k);
    if ((n >= 6 && e < -0.25) || streak) {
      if (config.noPause) { wouldPause(k, n >= 6 && e < -0.25 ? `expectancy ${e.toFixed(2)}R over ${n} trades` : 'four losses in a row'); continue; }
      config.paused[k] = new Date((now + 3 * 86400) * 1000).toISOString();
      const sh = arr.filter((x) => x.shadow).length, mix = sh ? ` (${n - sh} live, ${sh} shadow blocked only by exposure or the dollar cap)` : '';
      change(`Paused ${k} for 3 days`, n >= 6 && e < -0.25 ? `Expectancy ${e.toFixed(2)}R over ${n} trades${mix}.` : `Four losses in a row${mix}.`);
    }
  }
}

const coach = rd('coach.json', { date: '' });
const today = nowISO.slice(0, 10);
if (coach.date !== today) {
  const closedAll = trades.filter((x) => (x.status === 'win' || x.status === 'loss' || x.status === 'be') && now - x.closed < 30 * 86400);
  const closed = closedAll.filter((x) => !x.shadow), shadows = closedAll.filter((x) => x.shadow);
  const stat = (arr) => { const w = arr.filter((x) => x.status === 'win').length; const R = arr.reduce((a, x) => a + x.R, 0); return { n: arr.length, w, wr: arr.length ? w / arr.length : null, R: +R.toFixed(2), exp: arr.length ? +(R / arr.length).toFixed(2) : null }; };
  const bySetup = {};
  for (const t of closed) (bySetup[t.k] = bySetup[t.k] || []).push(t);
  const stats = Object.fromEntries(Object.entries(bySetup).map(([k, arr]) => [k, stat(arr)]));
  const notes = [];
  const change = (what, why) => { config.history.push({ at: nowISO, by: 'coach-stats', change: what, why }); notes.push(`${what}: ${why}`); };
  learnPauses(pauseSample(closedAll), change);
  const recent = closed.filter((x) => now - x.closed < 14 * 86400), rs = stat(recent);
  if (rs.n >= 10) {
    if (rs.wr < 0.35 && config.minRisk < LIMITS.minRisk[1]) { const v = +Math.min(LIMITS.minRisk[1], config.minRisk + 0.1).toFixed(2); change(`Minimum stop ${config.minRisk} → ${v} ATR`, `Win rate ${Math.round(rs.wr * 100)}% over ${rs.n} trades: stops get hit by normal candle noise.`); config.minRisk = v; }
    else if (rs.wr < 0.35 && config.buf < LIMITS.buf[1]) { const v = +Math.min(LIMITS.buf[1], config.buf + 0.02).toFixed(2); change(`Stop buffer ${config.buf} → ${v} ATR`, `Win rate ${Math.round(rs.wr * 100)}% over ${rs.n} trades: stops may sit inside the noise.`); config.buf = v; }
    else if (rs.wr > 0.6 && config.buf > LIMITS.buf[0]) { const v = +Math.max(LIMITS.buf[0], config.buf - 0.01).toFixed(2); change(`Stop buffer ${config.buf} → ${v} ATR`, `Win rate ${Math.round(rs.wr * 100)}% over ${rs.n} trades: a tighter stop gives more R.`); config.buf = v; }
  }
  const low = recent.filter((x) => x.rr < 1.5), ls = stat(low);
  if (ls.n >= 6 && ls.exp < 0 && config.minRR < 1.5) { change(`Minimum reward:risk ${config.minRR} → 1.5`, `Trades under 1.5R returned ${ls.exp}R each over ${ls.n} trades.`); config.minRR = 1.5; }
  learnFilters(closedAll, change);
  learnManagement(closedAll, change);
  // drop a rule when the trades it blocked would have paid (shadow expectancy > +0.2R over 5+), or after 21 days to re-test it
  for (const [k, fl] of Object.entries(config.filters)) {
    for (const fe of ['d1', 'struct']) {
      if (!fl[fe] || (fl.src || {})[fe] === 'backtest') continue;
      const sh = shadows.filter((x) => x.k === k && (x.blockedBy || []).includes(fe));
      const old = fl.since && fl.since[fe] && now - Date.parse(fl.since[fe]) / 1000 > 21 * 86400;
      if ((sh.length >= 5 && exp(sh) > 0.2) || old) { change(`${k}: dropped the ${fe === 'd1' ? 'D1' : 'structure'} rule`, old ? '21 days old: re-testing without it.' : `The trades it blocked made +${exp(sh).toFixed(2)}R over ${sh.length}.`); delete fl[fe]; if (fl.since) delete fl.since[fe]; }
    }
    for (const v of (fl.noSession || []).slice()) {
      const sh = shadows.filter((x) => x.k === k && (x.blockedBy || []).includes('session') && x.feat && x.feat.session === v);
      const old = fl.since && fl.since['session:' + v] && now - Date.parse(fl.since['session:' + v]) / 1000 > 21 * 86400;
      if ((sh.length >= 5 && exp(sh) > 0.2) || old) { fl.noSession = fl.noSession.filter((x) => x !== v); if (fl.since) delete fl.since['session:' + v]; change(`${k}: trading the ${v} session again`, old ? '21 days old: re-testing.' : `Blocked trades made +${exp(sh).toFixed(2)}R over ${sh.length}.`); }
    }
    if (emptyFilter(fl)) delete config.filters[k];
  }
  // trade management: turn break-even on when 40%+ of recent losers had been +1R first; re-test it after 21 days
  const recentLoss = closed.filter((x) => x.status === 'loss' && now - x.closed < 14 * 86400);
  if (!config.be && recentLoss.length >= 8) {
    const gaveBack = recentLoss.filter((x) => (x.mfe || 0) >= 1).length;
    if (gaveBack / recentLoss.length >= 0.4) { config.be = 1; config.beSince = nowISO; change('Break-even at +1R turned on', `${gaveBack} of ${recentLoss.length} recent losers were +1R or more before turning around.`); }
  } else if (config.be && config.beSince && now - Date.parse(config.beSince) / 1000 > 21 * 86400) {
    const bes = closed.filter((x) => x.status === 'be'), wins = closed.filter((x) => x.status === 'win');
    change('Break-even rule off for a re-test', `${bes.length} trades closed at break-even and ${wins.length} won over the last 30 days; testing without it.`);
    config.be = null; delete config.beSince;
  }
  // ─── Lessons from the trade reviews: act on system errors that keep repeating (live and shadow losses, last 14 days) ───
  const rl = trades.filter((x) => x.status === 'loss' && x.pm && x.pm.phase === 'done' && now - x.closed < 14 * 86400);
  const cnt = (c) => rl.filter((x) => x.pm.cause === c || (x.pm.factors || []).includes(c)).length, share = (c) => rl.length ? cnt(c) / rl.length : 0;
  if (rl.length >= 6) {
    if (cnt('hunt') >= 3 && share('hunt') >= 0.3 && config.buf < LIMITS.buf[1]) { const v = +Math.min(LIMITS.buf[1], config.buf + 0.02).toFixed(2); change(`Stop buffer ${config.buf} → ${v} ATR`, `Reviews: ${cnt('hunt')} of ${rl.length} losses were stopped out and then went to the target (stop hunted).`); config.buf = v; }
    if (cnt('noise') >= 3 && config.minRisk < LIMITS.minRisk[1]) { const v = +Math.min(LIMITS.minRisk[1], config.minRisk + 0.1).toFixed(2); change(`Minimum stop ${config.minRisk} → ${v} ATR`, `Reviews: ${cnt('noise')} losses had a stop inside one normal candle.`); config.minRisk = v; }
    if (cnt('late') >= 3 && share('late') >= 0.3 && (config.fresh || FRESH) > 6) { const v = (config.fresh || FRESH) - 2; change(`Fresh signals only: ${config.fresh || FRESH} → ${v} candles`, `Reviews: ${cnt('late')} of ${rl.length} losses were late entries.`); config.fresh = v; }
    if (cnt('news') >= 3 && !config.newsGuard) { config.newsGuard = true; config.newsSince = nowISO; change('News guard on', `Reviews: ${cnt('news')} losses came from high-impact news; no short-term trades from 15 min before to 45 min after news.`); }
  }
  // break-even that keeps costing wins: move it later
  const beR = trades.filter((x) => x.status === 'be' && x.pm && x.pm.phase === 'done' && now - x.closed < 14 * 86400);
  const beCost = beR.filter((x) => x.pm.cause === 'becost').length;
  if (config.be && config.be < 2 && beCost >= 3 && beCost > beR.length - beCost) { change(`Break-even ${config.be}R → ${config.be + 0.5}R`, `Reviews: ${beCost} of ${beR.length} break-even exits then went on to the target.`); config.be = config.be + 0.5; }
  // re-test the news guard after 21 days, using its shadow trades
  if (config.newsGuard && config.newsSince && now - Date.parse(config.newsSince) / 1000 > 21 * 86400) {
    const sh = shadows.filter((x) => (x.blockedBy || []).includes('news'));
    if (!(sh.length >= 3 && exp(sh) < 0)) { config.newsGuard = false; delete config.newsSince; change('News guard off for a re-test', sh.length ? `Trades it blocked made ${exp(sh).toFixed(2)}R over ${sh.length}.` : '21 days old: re-testing without it.'); }
    else config.newsSince = nowISO;
  }

  // dollar cap: loosen it when the trades it blocks keep winning, tighten it when correlated dollar trades lose together
  {
    const cap = config.maxUsd || MAX_USD, sh = shadows.filter((x) => (x.blockedBy || []).length === 1 && x.blockedBy[0] === 'usd' && now - x.closed < 14 * 86400);
    const fx = closed.filter((x) => ['xau', 'eurusd', 'gbpusd', 'audusd', 'usdcad', 'usdchf'].includes(x.market) && now - x.closed < 14 * 86400);
    if (sh.length >= 5 && exp(sh) > 0.3 && cap < LIMITS.maxUsd[1]) { config.maxUsd = cap + 1; change(`Dollar cap ${cap} → ${cap + 1} trades`, `Trades blocked only by the dollar cap made +${exp(sh).toFixed(2)}R over ${sh.length}.`); }
    else if (sh.length >= 5 && exp(sh) < -0.3 && fx.length >= 8 && exp(fx) < -0.3 && cap > LIMITS.maxUsd[0]) { config.maxUsd = cap - 1; change(`Dollar cap ${cap} → ${cap - 1} trades`, `Gold/forex trades lost ${exp(fx).toFixed(2)}R each and the blocked ones would have lost too.`); }
  }

  // markets: pause one for 3 days when it loses (6+ trades, worse than -0.3R each); resume early if its shadow trades recover
  const byMarket = {}; closed.forEach((x) => (byMarket[x.market] = byMarket[x.market] || []).push(x));
  for (const [m, arr] of Object.entries(byMarket)) {
    if (config.pausedMarkets[m] || arr.length < 6) continue;
    const e = exp(arr);
    if (e < -0.3 && config.noPause) { wouldPause(m, `market: ${e.toFixed(2)}R per trade over ${arr.length} trades`); continue; }
    if (e < -0.3) { config.pausedMarkets[m] = new Date((now + 3 * 86400) * 1000).toISOString(); change(`Paused market ${m} for 3 days`, `${e.toFixed(2)}R per trade over ${arr.length} trades.`); }
  }
  for (const m of Object.keys(config.pausedMarkets)) {
    const sh = shadows.filter((x) => x.market === m && (x.blockedBy || []).includes('market'));
    if (sh.length >= 4 && exp(sh) > 0.3) { delete config.pausedMarkets[m]; change(`Resumed market ${m} early`, `Shadow trades while paused made +${exp(sh).toFixed(2)}R over ${sh.length}.`); }
  }
  wr('coach.json', { date: today, at: nowISO, stats, last14: rs, lessons: lessons(trades, now), fslot: nowISO.slice(0, 11) + String(Math.floor(+nowISO.slice(11, 13) / 6) * 6).padStart(2, '0'), notes: notes.length ? notes : ['No change today: not enough evidence to move a rule.'] });
}
// every run: pause a setup as soon as its live record says so
{
  const sample = pauseSample(trades.filter((x) => (x.status === 'win' || x.status === 'loss' || x.status === 'be') && now - x.closed < 30 * 86400));
  const added = [];
  learnFromBacktest((what, why) => { config.history.push({ at: nowISO, by: 'coach-backtest', change: what, why }); added.push(`${what}: ${why}`); });
  learnPauses(sample, (what, why) => { config.history.push({ at: nowISO, by: 'coach-stats', change: what, why }); added.push(`${what}: ${why}`); });
  if (added.length) { const cj = rd('coach.json', {}); cj.notes = (cj.notes || []).filter((n) => !/^No change today/.test(n)).concat(added); wr('coach.json', cj); }
}
// between the daily runs: re-check the condition filters every 6 hours
const fslot = nowISO.slice(0, 11) + String(Math.floor(+nowISO.slice(11, 13) / 6) * 6).padStart(2, '0');
{
  const cj = rd('coach.json', {});
  if (cj.fslot !== fslot) {
    const closedAll = trades.filter((x) => (x.status === 'win' || x.status === 'loss' || x.status === 'be') && now - x.closed < 30 * 86400);
    const added = [];
    const ch = (what, why) => { config.history.push({ at: nowISO, by: 'coach-stats', change: what, why }); added.push(`${what}: ${why}`); };
    learnFilters(closedAll, ch);
    learnManagement(closedAll, ch);
    for (const [k, fl] of Object.entries(config.filters)) if (emptyFilter(fl)) delete config.filters[k];
    cj.fslot = fslot;
    if (added.length) cj.notes = (cj.notes || []).filter((n) => !/^No change today/.test(n)).concat(added);
    wr('coach.json', cj);
  }
}
config.history = config.history.slice(-200);

wr('config.json', config);
wr('state.json', state);
wr('trades.json', trades);
research = research.slice(-2000);
// ─── Research (paper only): NQ New York open liquidity sweep (the trader's rule, 3 Nov) ───
// After the 9:30 New York open, price takes liquidity: it trades through the overnight (18:00–9:30 ET), previous-day
// (9:30–16:00) or pre-market (8:00–9:30) high or low. The first 1-minute candle that closes back inside the swept level, in
// the reversal's direction, within the first hour is the signal: trade the opposite way at market, stop 2 points past the
// sweep's extreme, target 1.2R, out at 16:00. One trade a day. Candles: Yahoo NQ=F (NQ futures, 1 minute).
// On 50 days of 5-minute and 21 days of 1-minute history it is about break-even (+0.02R / −0.06R a trade), so it runs on
// paper to build a forward record.
const nyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' });
function nyParts(t) { const o = {}; for (const p of nyFmt.formatToParts(new Date(t * 1000))) o[p.type] = p.value; return { d: `${o.year}-${o.month}-${o.day}`, m: +o.hour * 60 + +o.minute, wd: o.weekday }; }
async function yahoo1m(sym) {
  // 4 Nov: Yahoo answers GitHub's runners with 429 "Too Many Requests" now and then: try both hosts, back off, retry (3 rounds)
  let last = '';
  for (let a = 0; a < 3; a++) {
    for (const host of ['query1', 'query2']) {
      let r; try { r = await fetch(`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1m&range=5d&includePrePost=true`, { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', Accept: 'application/json' }, signal: AbortSignal.timeout(15000) }); }
      catch (e) { last = String(e.message || e); continue; }
      if (r.status === 429 || r.status >= 500) { last = `HTTP ${r.status}`; continue; }
      const j = await r.json().catch(() => null), res = j && j.chart && j.chart.result && j.chart.result[0];
      if (!res) throw new Error(`Yahoo ${sym}: HTTP ${r.status}`);
      const ts = res.timestamp || [], q = res.indicators.quote[0], out = [];
      for (let i = 0; i < ts.length; i++) { const o = q.open[i], h = q.high[i], l = q.low[i], c = q.close[i]; if ([o, h, l, c].every((v) => v != null && isFinite(v) && v > 0)) out.push({ time: ts[i], open: o, high: Math.max(h, o, c), low: Math.min(l, o, c), close: c }); }
      return out;
    }
    await sleep(3000 * (a + 1));
  }
  throw new Error(`Yahoo ${sym}: throttled (${last})`);
}
// 4 Nov: Yahoo refused every GitHub runner from 14:26 UTC (429 on both hosts, NQ and MNQ). CNBC's chart service answers them:
// @ND.1 = the front Nasdaq-100 future (the same contract as NQ=F), 1-minute bars, about 10 min delayed like Yahoo. Fallback.
const etStamp = (t) => { const o = {}; for (const p of nyFmt.formatToParts(new Date(t * 1000))) o[p.type] = p.value; return `${o.year}${o.month}${o.day}${o.hour}${o.minute}00`; };
async function cnbc1m(sym) {
  const r = await fetch(`https://ts-api.cnbc.com/harmony/app/bars/${sym}/1M/${etStamp(now - 4 * 86400)}/${etStamp(now + 120)}/adjusted/EST5EDT.json`, { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
  const j = await r.json().catch(() => null), pb = j && j.barData && j.barData.priceBars;
  if (!pb || !pb.length) throw new Error(`CNBC ${sym}: ${(j && j.statusMessage) || `HTTP ${r.status}`}`);
  const out = [];
  for (const b of pb) { const o = +b.open, h = +b.high, l = +b.low, c = +b.close, t = Math.round(+b.tradeTimeinMills / 1000); if ([o, h, l, c, t].every((v) => isFinite(v) && v > 0)) out.push({ time: t, open: o, high: Math.max(h, o, c), low: Math.min(l, o, c), close: c }); }
  return out.sort((a, b) => a.time - b.time);
}
async function nq1m() {
  try { const b = await yahoo1m('NQ=F'); snapshot.nqSrc = 'yahoo'; return b; }
  catch (e) { const b = await cnbc1m('@ND.1'); snapshot.nqSrc = 'cnbc'; snapshot.nqYahoo = String(e.message || e); return b; }
}
function nqOpenSignal(bars, today) {
  const B = bars.map((b) => ({ ...b, ...nyParts(b.time) })), days = [...new Set(B.filter((b) => b.m >= 570 && b.m < 960 && b.d < today).map((b) => b.d))].sort();
  const pd = days.at(-1); if (!pd) return null;
  const rthPrev = B.filter((b) => b.d === pd && b.m >= 570 && b.m < 960), on = B.filter((b) => (b.d === pd && b.m >= 1080) || (b.d === today && b.m < 570)), pre = B.filter((b) => b.d === today && b.m >= 480 && b.m < 570);
  if (!rthPrev.length || !on.length) return null;
  const mx = (a) => Math.max(...a.map((b) => b.high)), mn = (a) => Math.min(...a.map((b) => b.low));
  const L = { PDH: mx(rthPrev), PDL: mn(rthPrev), ONH: mx(on), ONL: mn(on) }; if (pre.length) { L.PMH = mx(pre); L.PML = mn(pre); }
  const hiL = ['ONH', 'PDH', 'PMH'].filter((k) => L[k] != null), loL = ['ONL', 'PDL', 'PML'].filter((k) => L[k] != null);
  const S = B.filter((b) => b.d === today && b.m >= 570 && b.m < 630);
  let swH = null, swL = null, eH = -Infinity, eL = Infinity;
  for (const b of S) {
    eH = Math.max(eH, b.high); eL = Math.min(eL, b.low);
    if (swH == null) { const k = hiL.find((k) => b.high > L[k]); if (k) swH = k; }
    if (swL == null) { const k = loL.find((k) => b.low < L[k]); if (k) swL = k; }
    if (swH != null && b.close < L[swH] && b.close < b.open) return { sell: true, level: swH, lv: L[swH], ext: eH, stop: eH + 2, t: b.time, entry: b.close, L };
    if (swL != null && b.close > L[swL] && b.close > b.open) return { sell: false, level: swL, lv: L[swL], ext: eL, stop: eL - 2, t: b.time, entry: b.close, L };
  }
  return null;
}
// The same sweep rule at the Asian opens (the trader, 4 Nov): Tokyo 00:00 UTC and Shanghai 01:30 UTC. Liquidity = the previous
// New York session's high/low (9:30–16:00 ET), the evening high/low since the 18:00 ET reopen, and the high/low of the hour
// before the open. First 1-minute close back inside a swept level within the first hour → the other way, stop 2 points past
// the extreme, 1.2R, out at 07:00 UTC (London open). One trade per session per day. History (4 Nov): Tokyo −0.19R a trade on
// 50 days of 5-minute candles but +0.29R on the last 21 days of 1-minute; Shanghai about break-even to negative: paper only.
// 4 Nov: Shanghai dropped (negative on every test: 5-minute history, the 1-minute replay −2.4R over 9, forward). Tokyo stays.
const NQ_ASIA = [{ id: 'tokyo', name: 'NQ Tokyo open sweep', at: 0 }];
function nqAsiaSignal(bars, t0) {
  const B = bars.map((b) => ({ ...b, ...nyParts(b.time) }));
  // the last New York session that ended before this open (on Monday that is Friday, not Sunday)
  const nyd = [...new Set(B.filter((b) => b.m >= 570 && b.m < 960 && b.time < t0).map((b) => b.d))].sort().at(-1);
  if (!nyd) return null;
  const rth = B.filter((b) => b.d === nyd && b.m >= 570 && b.m < 960), ev = B.filter((b) => b.time < t0 && b.time > t0 - 12 * 3600 && ((b.d === nyd && b.m >= 1080) || b.d > nyd)), pre = B.filter((b) => b.time >= t0 - 3600 && b.time < t0);
  if (rth.length < 10 || ev.length < 5) return null;
  const mx = (a) => Math.max(...a.map((b) => b.high)), mn = (a) => Math.min(...a.map((b) => b.low));
  const L = { NYH: mx(rth), NYL: mn(rth), EVH: mx(ev), EVL: mn(ev) }; if (pre.length) { L.PRH = mx(pre); L.PRL = mn(pre); }
  const hiL = ['NYH', 'EVH', 'PRH'].filter((k) => L[k] != null), loL = ['NYL', 'EVL', 'PRL'].filter((k) => L[k] != null);
  let swH = null, swL = null, eH = -Infinity, eL = Infinity;
  for (const b of bars.filter((b) => b.time >= t0 && b.time < t0 + 3600)) {
    eH = Math.max(eH, b.high); eL = Math.min(eL, b.low);
    if (swH == null) { const k = hiL.find((k) => b.high > L[k]); if (k) swH = k; }
    if (swL == null) { const k = loL.find((k) => b.low < L[k]); if (k) swL = k; }
    if (swH != null && b.close < L[swH] && b.close < b.open) return { sell: true, level: swH, lv: L[swH], ext: eH, stop: eH + 2, t: b.time, entry: b.close, L };
    if (swL != null && b.close > L[swL] && b.close > b.open) return { sell: false, level: swL, lv: L[swL], ext: eL, stop: eL - 2, t: b.time, entry: b.close, L };
  }
  return null;
}
let nqLast = null;
// London sweep before New York (the trader's NQ chart, 4 Nov): the London range = 02:00–05:00 ET high/low. Between 05:00 and
// 09:25 ET, the first 1-minute close back inside after a sweep of that low (high) is a buy (sell); stop 2 points past the
// extreme, target 2R, out at 11:00 ET. History (4 Nov): no reliable edge yet (5-minute, 44 days: +0.21R a trade at 2R, t 0.9;
// 1-minute, 17 days: too few): paper only, to build a forward record.
function nqLondonSignal(bars, today) {
  const B = bars.map((b) => ({ ...b, ...nyParts(b.time) })), L = B.filter((b) => b.d === today && b.m >= 120 && b.m < 300);
  if (L.length < 30) return null;
  const H = Math.max(...L.map((b) => b.high)), Lo = Math.min(...L.map((b) => b.low));
  let swH = false, swL = false, eH = -Infinity, eL = Infinity;
  for (const b of B.filter((b) => b.d === today && b.m >= 300 && b.m < 565)) {
    eH = Math.max(eH, b.high); eL = Math.min(eL, b.low);
    if (b.high > H) swH = true; if (b.low < Lo) swL = true;
    if (swL && b.close > Lo && b.close > b.open) return { sell: false, level: 'LNL', lv: Lo, ext: eL, stop: eL - 2, t: b.time, m: b.m, entry: b.close, L: { LNH: H, LNL: Lo } };
    if (swH && b.close < H && b.close < b.open) return { sell: true, level: 'LNH', lv: H, ext: eH, stop: eH + 2, t: b.time, m: b.m, entry: b.close, L: { LNH: H, LNL: Lo } };
  }
  return null;
}
try {
  const ny = nyParts(now), openNq = research.filter((x) => x.k === 'nq-open' && x.status === 'open');
  const ud = new Date(now * 1000), uMin = ud.getUTCHours() * 60 + ud.getUTCMinutes(), uWd = ud.getUTCDay(), asiaWin = uWd >= 1 && uWd <= 5 && uMin <= 200;
  if ((!['Sat', 'Sun'].includes(ny.wd) && ny.m >= 300 && ny.m <= 1000) || asiaWin || openNq.length) {
    // Yahoo's CME candles arrive 10 minutes late (probe 4 Nov: lag 600 s) and the newest one is still forming: drop it
    const bars = (await nq1m()).slice(0, -1);
    if (bars.length) nqLast = { price: +bars.at(-1).close.toFixed(2), at: bars.at(-1).time + 60 };   // shown as 'now' on the Active trades card (about 10 min late)
    for (const r of openNq) {
      const s = r.side === 'sell', r0 = Math.abs(r.entry - r.stop);
      for (const b of bars) {
        if (b.time <= r.checked) continue;
        if (s ? b.high >= r.stop : b.low <= r.stop) { r.status = 'loss'; r.R = -1; r.closed = b.time; break; }
        if (s ? b.low <= r.t1 : b.high >= r.t1) { r.status = 'win'; r.R = +(Math.abs(r.t1 - r.entry) / r0).toFixed(2); r.closed = b.time; break; }
        const p = nyParts(b.time);
        if (r.exitAt ? b.time >= r.exitAt : (p.d !== r.day || p.m >= 960)) { const R = +((s ? r.entry - b.open : b.open - r.entry) / r0).toFixed(2); r.status = R > 0 ? 'win' : R < 0 ? 'loss' : 'be'; r.R = R; r.closed = b.time; r.exit = r.exitLabel || (r.exitAt ? '07:00 UTC' : '16:00'); break; }
      }
      if (r.status === 'open' && bars.length) r.checked = bars.at(-1).time;
    }
    if (ny.m >= 570 && ny.m <= 720 && !research.some((x) => x.k === 'nq-open' && !x.session && x.day === ny.d)) {   // to 12:00 ET: the feed lags
      const g = nqOpenSignal(bars, ny.d);
      if (g) {   // the day's first signal: paper entry at the signal candle's close (as on the backtest), even though the feed shows it ~10 min late
        const r0 = Math.abs(g.entry - g.stop), t1 = g.entry + (g.sell ? -1.2 : 1.2) * r0;
        research.push({ id: `nq-open-${ny.d}`, market: 'nq', label: 'NQ', dec: 2, k: 'nq-open', name: 'NQ NY open sweep', day: ny.d, side: g.sell ? 'sell' : 'buy',
          entry: +g.entry.toFixed(2), stop: +g.stop.toFixed(2), t1: +t1.toFixed(2), rr: 1.2, opened: g.t + 60, filled: g.t + 60, checked: g.t + 60, status: 'open', R: null,
          seenAt: now, entrySeen: bars.length ? +bars.at(-1).close.toFixed(2) : null, level: g.level, levelPrice: +g.lv.toFixed(2), ext: +g.ext.toFixed(2), levels: Object.fromEntries(Object.entries(g.L).map(([k, v]) => [k, +v.toFixed(2)])),
          note: `Research (paper only): NQ swept the ${g.level} ${g.lv.toFixed(2)} after the New York open (extreme ${g.ext.toFixed(2)}) and closed back inside; ${g.sell ? 'sell' : 'buy'} ${g.entry.toFixed(2)}, stop ${g.stop.toFixed(2)}, target 1.2R ${t1.toFixed(2)}, out at 16:00.` });
      }
    }
    if (!['Sat', 'Sun'].includes(ny.wd) && ny.m >= 301 && ny.m <= 600 && !research.some((x) => x.id === `nq-london-${ny.d}`)) {   // seen up to ~35 min late (feed lag)
      const g = nqLondonSignal(bars, ny.d);
      if (g) {
        const r0 = Math.abs(g.entry - g.stop), t1 = g.entry + (g.sell ? -2 : 2) * r0;
        research.push({ id: `nq-london-${ny.d}`, market: 'nq', label: 'NQ', dec: 2, k: 'nq-open', session: 'london', name: 'NQ London sweep before NY', day: ny.d, side: g.sell ? 'sell' : 'buy',
          entry: +g.entry.toFixed(2), stop: +g.stop.toFixed(2), t1: +t1.toFixed(2), rr: 2, opened: g.t + 60, filled: g.t + 60, checked: g.t + 60, status: 'open', R: null, exitAt: g.t + (660 - g.m) * 60, exitLabel: '11:00 ET',
          seenAt: now, entrySeen: bars.length ? +bars.at(-1).close.toFixed(2) : null, level: g.level, levelPrice: +g.lv.toFixed(2), ext: +g.ext.toFixed(2), levels: Object.fromEntries(Object.entries(g.L).map(([k, v]) => [k, +v.toFixed(2)])),
          note: `Research (paper only): NQ swept the London ${g.sell ? 'high' : 'low'} ${g.lv.toFixed(2)} before New York (extreme ${g.ext.toFixed(2)}) and closed back inside; ${g.sell ? 'sell' : 'buy'} ${g.entry.toFixed(2)}, stop ${g.stop.toFixed(2)}, target 2R ${t1.toFixed(2)}, out at 11:00 ET.` });
      }
    }
    if (asiaWin) for (const A of NQ_ASIA) {
      const d0 = Math.floor(now / 86400) * 86400, t0 = d0 + A.at * 60, day = new Date(d0 * 1000).toISOString().slice(0, 10), id = `nq-${A.id}-${day}`;
      if (now < t0 + 60 || now > t0 + 150 * 60 || research.some((x) => x.id === id)) continue;   // the first hour, seen up to 90 min late (feed lag)
      const g = nqAsiaSignal(bars, t0);
      if (!g) continue;
      const r0 = Math.abs(g.entry - g.stop), t1 = g.entry + (g.sell ? -1.2 : 1.2) * r0;
      research.push({ id, market: 'nq', label: 'NQ', dec: 2, k: 'nq-open', session: A.id, name: A.name, day, side: g.sell ? 'sell' : 'buy',
        entry: +g.entry.toFixed(2), stop: +g.stop.toFixed(2), t1: +t1.toFixed(2), rr: 1.2, opened: g.t + 60, filled: g.t + 60, checked: g.t + 60, status: 'open', R: null, exitAt: d0 + 7 * 3600,
        seenAt: now, entrySeen: bars.length ? +bars.at(-1).close.toFixed(2) : null, level: g.level, levelPrice: +g.lv.toFixed(2), ext: +g.ext.toFixed(2), levels: Object.fromEntries(Object.entries(g.L).map(([k, v]) => [k, +v.toFixed(2)])),
        note: `Research (paper only): NQ swept the ${g.level} ${g.lv.toFixed(2)} after the ${A.id === 'tokyo' ? 'Tokyo' : 'Shanghai'} open (extreme ${g.ext.toFixed(2)}) and closed back inside; ${g.sell ? 'sell' : 'buy'} ${g.entry.toFixed(2)}, stop ${g.stop.toFixed(2)}, target 1.2R ${t1.toFixed(2)}, out at 07:00 UTC.` });
    }
  }
} catch (e) { snapshot.errors.nq = String(e.message || e); }
{ const done = research.filter((x) => x.k === 'cycle' && (x.status === 'win' || x.status === 'loss' || x.status === 'be')), R = done.reduce((a, x) => a + x.R, 0);
  snapshot.research = { cycle: { closed: done.length, wins: done.filter((x) => x.status === 'win').length, R: +R.toFixed(2), open: research.filter((x) => x.k === 'cycle' && x.status === 'open').length } };
  const rp = research.filter((x) => x.k === 'replica'), sum = (a) => { const d = a.filter((x) => x.status === 'win' || x.status === 'loss' || x.status === 'be');
    return { signals: a.length, closed: d.length, wins: d.filter((x) => x.status === 'win').length, R: +d.reduce((s, x) => s + x.R, 0).toFixed(2), open: a.filter((x) => x.status === 'open').length, pending: a.filter((x) => x.status === 'pending').length }; };
  const rpx = rp.filter((x) => x.market === 'xau');
  snapshot.research.replica = { all: sum(rpx), pass: sum(rpx.filter((x) => x.pass && x.v >= 2)), v5: sum(rpx.filter((x) => x.v5)), star: sum(rpx.filter((x) => x.star)) };
  // the method test on the other markets (paper, 2R, no spread): v5 signals per market and all together
  const oth = rp.filter((x) => x.market !== 'xau' && x.v5); snapshot.research.replicaX = { all: sum(oth), markets: Object.fromEntries([...new Set(oth.map((x) => x.market))].map((m) => [m, sum(oth.filter((x) => x.market === m))])) };
  snapshot.research.nq = sum(research.filter((x) => x.k === 'nq-open'));
  for (const sid of ['ny', 'london', 'tokyo', 'shanghai']) snapshot.research['nq_' + sid] = sum(research.filter((x) => x.k === 'nq-open' && (x.session || 'ny') === sid)); }
if (nqLast) snapshot.nqLast = nqLast;
// ─── Phone alerts (4 Nov): a push via ntfy.sh (free, no account) when a live trade or an NQ paper trade opens or closes.
// Subscribe in the ntfy app to the topic below (or set the repository secret NTFY_TOPIC to use your own). Only events from
// the last 15 min are sent, each once (ntfyO / ntfyC flags), so a restart never floods the phone with old trades.
{ const topic = process.env.NTFY_TOPIC || 'mosha-council-d200fdc484', fmt = (v, d) => (+v).toFixed(d != null ? d : 2), fR = (v) => `${v > 0 ? '+' : ''}${(+v).toFixed(2)}R`;
  const ev = [];
  for (const x of trades.filter((x) => !x.shadow).concat(research.filter((x) => x.k === 'nq-open'))) {
    const nm = `${x.label} ${x.k === 'nq-open' ? x.name + ' (paper)' : x.name}`;
    if (!x.ntfyO && x.status === 'open' && x.filled >= now - 900) { x.ntfyO = 1; ev.push({ title: `${x.side.toUpperCase()} ${nm}`, msg: `Entry ${fmt(x.entry, x.dec)}, stop ${fmt(x.stop, x.dec)}${x.tp1 != null ? `, 2R mark ${fmt(x.tp1, x.dec)}, then trailing` : `, target ${fmt(x.t1, x.dec)}`}${x.size && x.size !== 1 ? ` · ${x.size}× size` : ''}`, tags: x.side === 'sell' ? 'chart_with_downwards_trend' : 'chart_with_upwards_trend' }); }
    if (!x.ntfyC && x.R != null && x.closed && x.closed >= now - 900 && ['win', 'loss', 'be'].includes(x.status)) { x.ntfyC = 1; ev.push({ title: `${x.status === 'win' ? 'Win' : x.status === 'loss' ? 'Loss' : 'Break-even'} ${fR(x.R)} · ${nm}`, msg: `${x.side.toUpperCase()} from ${fmt(x.entry, x.dec)}${x.exit ? ` · ${x.exit}` : ''}`, tags: x.R > 0 ? 'white_check_mark' : x.R < 0 ? 'x' : 'heavy_minus_sign' }); }
  }
  for (const e of ev.slice(0, 8)) {
    try { await fetch(`https://ntfy.sh/${topic}`, { method: 'POST', body: e.msg, headers: { Title: e.title, Tags: e.tags, Click: 'https://vazxanana.github.io/macro-dashboard/market-structure.html#council' }, signal: AbortSignal.timeout(5000) }); }
    catch (err) { snapshot.errors.ntfy = String(err.message || err); }
  }
  if (ev.length) wr('trades.json', trades);
}
wr('research.json', research);
snapshot.lessons = lessons(trades, now);
wr('snapshot.json', snapshot);
const open = trades.filter((x) => x.status === 'open' || x.status === 'pending').length;
console.log(`Council run ${nowISO}: ${Object.keys(snapshot.markets).length} markets, ${Object.keys(snapshot.errors).length} errors, ${open} open/pending trades, ${trades.length} total.`);
if (Object.keys(snapshot.errors).length) console.log(snapshot.errors);
