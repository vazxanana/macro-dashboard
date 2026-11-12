// Council · Trader (+ daily statistical Coach)
// Runs every ~4 minutes in GitHub Actions: pulls candles for every market, runs the Mosha rules,
// paper-trades every Ready setup, manages open trades and writes everything to the data folder.
// Usage: node council/trader.mjs <dataDir>
import fs from 'node:fs';
import path from 'node:path';
import { msAnalyze, CFG, PAIRS, RETR, LBL, buildSetup, buildRetrace, setMarket } from './engine.mjs';
import { entryContext, startReview, watchReview, judge, newsNear, lessons } from './review.mjs';
import { m15cFeat } from './choch.mjs';
import { alertable, alertEvents, sendAlerts, when, NTFY_DEFAULT, proposalDigest, decayDigest, moshaArmed } from './alerts.mjs';
import { liveRuleSection, injectSection, coachChurnSection, CHURN_START, CHURN_END, deskSection, DESK_START, DESK_END, analystReviews, analystSections, fidelitySection, FID_START, FID_END, goldSystemsSection, GOLD_START, GOLD_END } from './analyst.mjs';
import { coachProposals, spotProposals, ictVariantVerdicts, coachCarry } from './proposals.mjs';
import { shrink, ebTau, shrunkClear, ruleState, sameRule, setRule, descRule, judgeTrial, ledgerStart, syncLedger, ledgerSection, LEDGER_START, LEDGER_END } from './coach.mjs';
import { buildDecay } from './decay.mjs';
import { recordVerdicts } from './digest.mjs';   // the shared verdict record (digest.json): decay statuses each 6-hour reading
import { buildBook } from './book.mjs';
import { buildExpect } from './expect.mjs';
import { buildForward, loadProtocol, stopSwitch } from './forward.mjs';
import { cleanBars, LTF_CLEAN } from './clean.mjs';
import { voidRoundedReplicas, historyCatchUp, voidM30Twins, voidExactTwins, recostCrypto } from './repairs.mjs';
import { recordOnce } from './dedupe.mjs';   // 12 Nov 2026 (owner approved): one order is recorded once
import { d1AdxFeat } from './adx.mjs';
// paper fills (8 Nov): costs (raw R + cost-adjusted Rnet), the stale-signal shadow stat, gap-aware stops (council/fills.mjs)
import { costModel, mirrorMaps, annotateCosts, costSummary, FIN, ownStream, driftR, backfillDrift, staleStats, stopFill, exitR, fillBarAmbiguous, spotSkip, foldWeekend, gegFresh, minStopDist, fillCheck, fillCheckText } from './fills.mjs';
// Mosha BO chain state between trades (8 Nov): snapshot.moshaBo.state, a pure walk of the BO events below (council/mosha.mjs)
import { moshaChain } from './mosha.mjs';
import { cycleTrades, cycleText, cycleBlockers } from './mosha-cycle.mjs';
import { SYMBOLS as BROKER_SYMBOLS } from './ctrader-mirror.mjs';
// feed source on every record + re-quote / cancel / re-base when a market's candle feed changes source (8 Nov, council/feed.mjs)
import { feedTag, requoteMarket, feedChangeText, feedDecision } from './feed.mjs';
import { newsFeat } from './events.mjs';
import { fetchDaily as regimeDaily, regimeOf, regimeShadow } from './regime.mjs';
import { litStep, cleanBars as litClean, LOOKBACK_BARS as LIT_BARS, K as LIT_K } from './lit.mjs';
import { readJson, writeAtomic } from './jsonio.mjs';

const DIR = process.argv[2] || 'data';
fs.mkdirSync(DIR, { recursive: true });
// (bug hunt 9 Nov) a file cut short by a kill mid-write (the live runner's 240-s child timeout, a cancelled job) read as "missing":
// trades.json came back [] and was written out empty, config.json as the defaults (the owner's rules gone). Writes are atomic now
// (temp file + rename), and a book file that exists but does not parse stops the round before anything is written; the
// council loop's datasync restores the last committed copy, the next round goes on from it.
const MUST_PARSE = new Set(['config.json', 'state.json', 'trades.json', 'research.json', 'coach.json']);
const rd = (f, d) => { const r = readJson(path.join(DIR, f), d);
  if (r.state === 'corrupt' && MUST_PARSE.has(f)) { console.error(`Trader stopped: ${f} does not parse (${r.error}); nothing written, restore it from council-data`); process.exit(1); }
  return r.value; };
const wr = (f, v) => writeAtomic(path.join(DIR, f), JSON.stringify(v, null, 1));

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
const OANDA_D1 = new Set(['xau', 'eurusd', 'gbpusd', 'audusd', 'usdcad', 'usdchf']), MD_BASE = process.env.MD_BASE || 'https://meridianx.dev/md/';   // D1 trend source for spot markets (7 Nov)
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

// Gold and forex candles from OANDA spot (owner delegated, 7 Nov): the same feed the site's charts and the D1 labels use,
// through the site's own /md/bars proxy. Kraken's forex books are thin: re-judged on spot candles, the live forex trades of
// 31 Oct - 7 Nov were -45.7R where Kraken's candles said +11.6R (research/spotcheck.json). 30m is built from 15m. The fast
// timeframes skip the CDN cache (it may serve a minute candle up to 3 min old); the slow ones may use it. null on any failure.
const OANDA_TF = { '1m': ['1m', 720, true], '5m': ['5m', 720, true], '15m': ['15m', 720, false], '1h': ['1h', 720, false], '4h': ['4h', 720, false], '1d': ['1d', 720, false] };
function agg30(b15) {
  const out = []; let cur = null;
  for (const b of b15) { const t = Math.floor(b.time / 1800) * 1800;
    if (!cur || cur.time !== t) { cur = { time: t, open: b.open, high: b.high, low: b.low, close: b.close }; out.push(cur); }
    else { cur.high = Math.max(cur.high, b.high); cur.low = Math.min(cur.low, b.low); cur.close = b.close; } }
  return out;
}
async function oandaBars(key, id, count = 0) {   // count: a longer read for one caller (LIT's lookback); the feeds keep their own n
  const [tf, n0, fresh] = id === '30m' ? ['15m', 1440, false] : OANDA_TF[id] || [], n = count || n0;
  if (!tf) return null;
  try {
    const r = await fetch(`${MD_BASE}bars?sym=${key}&tf=${tf}&n=${n}${fresh ? `&r=${Math.floor(Date.now() / 60000)}` : ''}`, { signal: AbortSignal.timeout(10000) });
    const j = r.ok ? await r.json() : null;
    if (!j || j.src !== 'OANDA' || !Array.isArray(j.bars) || j.bars.length < 100) return null;
    const bars = j.bars.map((b) => ({ time: +b.time, open: +b.open, high: +b.high, low: +b.low, close: +b.close }));
    return id === '30m' ? agg30(bars).slice(-720) : bars;
  } catch (e) { return null; }
}

// ─── Config: the Coach's knobs, with their allowed ranges ───
const LIMITS = { buf: [0.10, 0.25], minRR: [1.2, 2.5], minRisk: [0.4, 1.2], maxUsd: [2, 4] };
const config = Object.assign({ buf: 0.15, minRR: 1.2, minRisk: 0.6, be: null, fresh: FRESH, newsGuard: false, maxUsd: MAX_USD, paused: {}, pausedMarkets: {}, filters: {}, history: [] }, rd('config.json', {}));
config.filters = config.filters || {};
const now = Math.floor(Date.now() / 1000), nowISO = new Date(now * 1000).toISOString();
// New York wall-clock parts of a unix time (used by the NQ research, the gold news veto and the MT5 feed). Declared here, before the
// market loop runs: on 5 Nov the veto read it from inside the loop while it was still declared further down (temporal dead zone),
// which threw on every replica signal and dropped the signal for that round.
const nyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' });
function nyParts(t) { const o = {}; for (const p of nyFmt.formatToParts(new Date(t * 1000))) o[p.type] = p.value; return { d: `${o.year}-${o.month}-${o.day}`, m: +o.hour * 60 + +o.minute, wd: o.weekday }; }
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
    why: 'The trader asked for a clean live record: the replica v5 is the system. The engine setups keep running as shadow trades for research.' },  // 4 Nov (night): the trader agreed: gold becomes research only. On 8 years of HistData spot gold (2019–2026, the live v5 code,
  // trailing exit, round stops, risk rules) the replica lost every year 2019–2025 (−312.5R over 4,484 trades, gross ≈ 0 before the
  // spread) and only 2026 was positive; DXY filters, session windows and Asian-range sweeps added nothing. No gold or engine setup
  // opens live paper trades any more; every replica signal is still recorded in research.json. The NQ New York open run is the system.
  { id: 'gold-shadow', apply: (c) => { c.replicaLive = []; c.focus = ['none']; },
    change: 'Gold research only (user): the gold replica and the engine setups stop opening live paper trades; NQ New York open run is the system',
    why: '8-year spot gold test: the replica lost every year 2019-2025 (-312.5R over 4,484 trades), only 2026 positive; the NQ New York open run held on 3 years of NQ futures and every newer sample.' },
  { id: 'mosha-bo', apply: (c) => { c.moshaBo = true; },
    change: "Gold: Mosha's breakout system (H4 BO → H1 BO against → M15 BO back → pullback limit at the broken level, stop past the M15 Origin, 3R) trades on paper next to the replica",
    why: 'From his post. Spot gold, causal: H4→H1→M15 2019-22 +7.5R (104 trades, 2R +11.5R), 2023-26 +15.1R (114, +0.13R a trade); the only Mosha setup tested that held over 8 years without the volatility gate.' },
  { id: 'gold-eg-barrier', apply: (c) => { c.goldEgBarrier = true; },
    change: 'Gold replica: a signal against the daily trend is still taken when its extreme sits at a live H1 engulfing barrier',
    why: "Owner: Mosha's edge is structure plus barriers (EG/OB). 2023-26 spot, gated v5, exit v2: signals at an H1 EG +0.293R a trade (151, both halves positive), at an OB -0.124R; pure-structure and barrier-only models lost. D1-with OR at-EG: 392 trades +71.9R, drawdown -15.8R vs D1-with alone 325 trades +63.8R. Mosha's 2 Nov sell started inside a fresh H1 bearish EG." },
  { id: 'gold-d1-with', apply: (c) => { c.goldD1With = true; },
    change: 'Gold replica trades live only in the daily trend direction (still against the H4 trend: a pullback entry)',
    why: 'Owner: judge gold on the last 4 years. 2023-26 spot, 1.5% gate, exit v2, risk rules: 602 trades +87.4R, worst drawdown -35.2R -> D1-with 325 trades +63.8R, drawdown -15.8R (+0.196R a trade). Chosen on 2023-24 (+8.1R vs -22.2R), held on 2025-26 (+55.7R). In 2019-22 the opposite held (D1-against better), so this is a last-4-years rule.' },
  { id: 'gold-vol-gate', apply: (c) => { c.replicaLive = ['xau']; c.goldVolMin = 1.5; },
    change: 'Gold replica trades live again, but only while gold is volatile: 20-day average daily range at least 1.5% of price; NQ stays the main system',
    why: '8-year spot gold split by volatility: the replica loses in calm gold every year (bottom fifth -0.21R a trade) and only pays in the top fifth (+0.05R, 6 of 8 years positive). With the risk rules and a 1.5% gate: 2019-2025 +18.9R instead of -312.5R, 2026 +43.2R. 2026 is the most volatile gold year in the sample (2.2% vs 0.9-1.5%), which is why the replica looked good this year.' },
  { id: 'pairs-live', apply: (c) => { c.replicaLive = Object.keys(MARKETS); c.pairsLiveAt = Math.floor(Date.now() / 1000); c.pairVolPct = 80; c.pairStopR = -10; },
    change: 'Council: the other pairs (forex and crypto) trade the replica live on paper next to gold, each with its own volatility gate (20-day range in the top fifth of its last 365 daily candles) and a kill switch at −10R',
    why: "Owner: include gold and the other pairs in the council. Same rules as gold (v5, daily trend or H1 engulfing barrier, trail from +2R, max 3 open, −1.5R daily stop); gold's 1.5% gate is replaced on the pairs by the same idea measured against each pair's own history. Replay 2019-26 says the method loses on the pairs (see README), so each pair stops trading live once its forward total reaches −10R." },
  { id: 'pairs-best', apply: (c) => { c.replicaLive = ['xau']; c.cryptoTrend = ['btc', 'eth', 'sol', 'xrp']; c.cryptoTrendStopR = -8; c.cryptoTrendAt = Math.floor(Date.now() / 1000); },
    change: 'Pairs, best settings (owner asked): crypto trades a daily trend system (55-day breakout, long only, 4 ATR trailing stop, out on a close under the 27-day low); forex stops trading live (research only)',
    why: "Walk-forward search on the pairs only. The replica: ~11,000 settings per pair, chosen on 2019-22 (forex) / 2022-23 (crypto): the 20 best on 7 of 9 pairs lost in the later years. Asia-range breakouts/fades and open sweeps lose on forex and crypto after costs. Daily trend-following on forex lost 2023-26 (0 of 5 pairs). Crypto daily trend (Binance 2017-2026, 0.8% round-trip cost), picked on 2018-21: 55-day breakout long-only with a 4 ATR trail +1.05R a trade, then 2022-26 +0.30R a trade with 8 of 10 coins positive; on the council's coins 2022-26 BTC +0.50R, ETH +0.39R, SOL +0.74R, XRP +1.29R a trade, worst drawdown 2-4R, ~3 trades a coin a year. Tight 2 ATR trails lose on every coin." },
  { id: 'gold-adaptive-gate', apply: (c) => { c.goldVolPct = 80; },
    change: "Gold replica: the volatility gate also opens when gold's 20-day range is in the top fifth of its own last year (as well as at 1.5% or more)",
    why: 'Owner: apply the research. Live config, spot gold, trail exit: fixed 1.5% 2019-22 +0.093R (214 trades) / 2023-26 +0.164R (443); 1.5% OR top-fifth +0.104R (341) / +0.192R (513): better in both halves with more trades. Tighter stops (0.5-0.85x) and fixed 2-4R targets were tested at the same time and did not beat the current stop and trail.' },
  { id: 'gold-4r', apply: (c) => { c.goldFixedR = 4; },
    change: 'Gold replica: fixed 4R target instead of the trail from +2R (stop unchanged, out after 48 h)',
    why: "Owner: judge gold on the last 2-3 years. 2023-26 spot, live gate and direction rules, signals: 4R +0.23R a trade (2023-24) / +0.20R (2025-26), +105R; trail +0.31R / +0.16R, +98R. 4R is better in the recent half and steadier across both; tighter stops lost in every combination." },
  { id: 'gold-no-eg', apply: (c) => { c.goldEgBarrier = false; },
    change: 'Gold replica: trades only with the daily trend; the H1 engulfing-barrier exception (a trade against the daily trend) is off',
    why: 'Owner: judge gold on 2023 onwards. With the 4R exit the exception loses every year: 2023 -5.6R (5), 2024 -4.6R (21), 2025 -2.8R (19), 2026 -2.1R (37), -15R over 82 trades, while daily-trend trades make +0.42R (2023-24) / +0.25R (2025-26) a trade. It only paid under the old trail exit in 2025-26 (+0.22R).' },
  { id: 'gold-top-be', apply: (c) => { c.goldVolMin = null; c.goldVolPct = 80; c.goldBeR = 2; },
    change: "Gold replica: trades only while gold's 20-day range is in the top fifth of its own last year (the 1.5% leg is dropped), and the stop moves to breakeven once a trade reaches +2R",
    why: 'Owner: more profit, less drawdown, judged on 2023 onwards. Spot gold with the live risk rules, 4R: current gate +111R, worst drawdown -25.1R (ratio 4.4); top fifth only +88R / -14.8R (6.0); top fifth + breakeven at +2R +93R / -11.7R (7.9), better than the current gate in both halves (2023-24 +37.9R vs +34.0R, 2025-26 +55.0R vs +54.4R). Trades at 1.5-2.4% volatility but below the top fifth made +0.02R a trade (168 trades); top-fifth trades +0.40R in both halves.' },
  { id: 'gold-add', apply: (c) => { c.goldAdd = { atR: 2, size: 1 }; c.goldRun = { atR: 4, trail: 1 }; },
    change: 'Gold replica: scale in and run winners. At +2R a second unit opens with the stop at the first entry; after +4R the whole position trails 1R behind the best price (cap 10R) instead of exiting at 4R',
    why: 'Owner: scale on profitable running trades and catch more of the move. Spot gold 2023-26, top-fifth gate, daily trend, breakeven at +2R, live risk rules: base 4R +93.0R / worst drawdown -11.7R (ratio 7.9); add 1.0 at +2R +157.6R / -17.4R (9.1); runner after 4R trailing 1R +103.8R / -12.4R (8.4); both +185.9R / -17.6R (10.6), better in both halves (2023-24 +73.9R vs +37.9R, 2025-26 +112.0R vs +55.0R) and every year. 23% of signals reach +4R; after that the median run before a 2R pullback is 5.4-6.7R.' },
  { id: 'nq-runner', apply: (c) => { c.nqRun = { atR: 2, trail: 1 }; },
    change: 'NQ New York open run: after +2R the stop trails 1R behind the best price (cap 10R) instead of exiting at 2R; still out at 11:00 ET',
    why: 'Owner: catch more of the move. Nasdaq cash 1m 2018-Oct 2026, live rule with the midnight-open filter, costs in: fixed 2R +7.4R (2018-22, n435, worst drawdown -23.4R) / +76.9R (2023-26, n275, -7.7R); runner +21.1R (-19.3R) / +93.7R (-7.9R), +0.048 and +0.341R a trade, better in both halves. Adding a unit at +1R was rejected (2018-22 -17R, drawdown -52R).' },
  { id: 'mosha-add', apply: (c) => { c.moshaBeR = 1.5; c.moshaAdd = { atR: 1.5, size: 1 }; c.moshaRun = { atR: 3, trail: 1 }; },
    change: 'Mosha BO system: at +1.5R the stop moves to breakeven and a second unit is added (stop at the first entry); after +3R the whole position trails 1R behind the best price (cap 10R) instead of exiting at 3R',
    why: 'Owner: scale on running trades, judged on 2023 onwards. Spot gold, weekly agrees, limit at the broken level, 101 fills: fixed 3R +6.3R (2023-24, n36) / +21.0R (2025-26, n65), worst drawdown -18.4R; add + runner +8.8R / +35.3R, drawdown -20.3R (return per unit of drawdown 2.2 vs 1.5). Still a forward test: the base system failed out of sample on other markets.' },
  { id: 'gold-news-veto', apply: (c) => { c.goldNewsVeto = [[505, 525]]; },
    change: 'Gold replica: no new entry between 08:25 and 08:45 ET on weekdays (the US data-release window); such signals are recorded as research',
    why: 'Spot gold 2023-26, top-fifth gate, daily trend, 4R with breakeven: the 5 signals that fired inside 08:25-08:45 ET all lost (-5.2R); with the risk rules the veto makes +95.7R vs +93.0R (2023-24 +40.0R vs +37.9R, 2025-26 +55.6R vs +55.0R), same worst drawdown. Gold absorbs US macro news within minutes and the release-minute spread is several times normal, so the window is skipped for entries only. The FOMC window (Wed 13:55-14:15 ET) had 3 entries, all positive, and is not vetoed.' },
  { id: 'crypto-add', apply: (c) => { c.cryptoAdd = { atR: 1, size: 1 }; },
    change: 'Crypto trend: scale in once. When a daily close is +1R (5 ATR) above the entry, a second unit buys at market with its own 5 ATR stop; it exits with the first trade on the channel-midpoint close',
    why: 'Owner: we leave money on the table in crypto, try scaling. Binance daily 2018-26, 0.8% costs, R on the first unit\'s 5 ATR risk: the live exit keeps 45% of each trade\'s best excursion and every other exit tested (10/20-day low, 3/4 ATR trails, partials) keeps less. One add at +1R: council coins 2023-26 +103.6R vs +61.6R with the worst drawdown -6.7R vs -5.5R (ratio 15.5 vs 11.3; 2023-24 +108.9R vs +62.1R at the same -5.5R drawdown, 2025-26 -5.3R vs -0.5R); the six other coins +169.9R vs +106.2R, ratio 8.9 vs 6.3. Adds at +0.5R, +2R, two adds and turtle-style pyramids raise drawdown faster than profit. Sizing guide: 0.5% on the first unit and 0.5% on the add (1% exposure on winners only).' },
  { id: 'gold-trend', apply: (c) => { c.goldTrend = { n: 20, k: 2 }; },
    change: 'Gold trend (new paper system): a daily close above the prior 20 daily highs buys gold at market on the next run; stop 2 x ATR(D1,14) below, lifted to (daily close - 2 ATR) on every closed day; no target, no time limit; one position',
    why: 'Owner supplied a 13-edge cTrader bot; its daily breakout was the one gold edge that held on our 8 years of spot gold 1m (0.42 cost): N20 trail 2 ATR +0.31R | +1.07R | +2.42R a trade in 2019-22 | 2023-24 | 2025-26 (n29/12/10, worst drawdown -4.4R | -1.4R | -0.9R), N10 and N55 and a 3 ATR trail all positive in every period, the mirrored short loses in every period. By year: 2019 +6.1R, 2020 +3.3, 2021 +0.5, 2022 -1.1, 2023 +4.0, 2024 +8.8, 2025 +19.4, 2026 +4.7. Long only: it rides the secular bull and caps each loss near -1R. Sizing guide 0.5% per trade.' },
  { id: 'gold-h4-trendline', apply: (c) => { c.goldTL = { n: 3, span: 120, n4: 2, pad: 0.3, hold: 96 }; },
    change: 'Gold H4 trendline (new paper system, buys only): a closed H4 candle above the falling line through the last two confirmed H4 pivot highs, while the H4 direction SOP (Malaysian SnR, Daily levels) reads up, buys at market; stop under the lowest low since the second anchor; after +2R the stop trails 1R behind the best price (cap 10R); out after 96 h; one trade per line, one position',
    why: 'Owner: find the best SOP timeframe for the trendline break, judged on 2023 onwards (halves 2023-24 | 2025-26). M15/M30 lose, H1 is flat, H4 is the only timeframe with profit: buys gated by the H4 direction +0.44R | +0.67R a trade (n54/49, worst drawdown -4.1R | -6.6R), positive every year (2023 +3.3, 2024 +20.5, 2025 +29.4, 2026 +3.5), robust to pivot width 2-4 and hold 48-240 h, entry 4 min late still +0.37 | +0.62. Sells are inconsistent (-4R | +5R) and are not traded. Two thirds of the trades fire while the gold trend system is flat, so it adds to it rather than doubling it.' },
  { id: 'gold-daily-engulf', apply: (c) => { c.goldEG = { k: 3, life: 20, hold: 240, sma: 20, pad: 0.3, maxOpen: 3 }; },
    change: 'Gold daily engulf (new paper system, buys only): a closed daily candle that body-closes above the HIGH of a red base candle (within 3 same-colour candles) makes an EG buy zone = the base candle\'s full range; while that close is above the 20-day average, a limit buy waits at the zone high for 20 days (cancelled by a daily close under the zone low); stop 0.3 under the zone low; after +2R the stop trails 1R behind the best price (cap 10R); out after 10 days; one trade per zone, at most 3 open',
    why: 'Owner supplied four school skills (engulfing EG/EF, Mosha storyline, PITCHOU and Zlankator Malaysian SnR). The engulf zone is the one codable rule that held on gold judged on 2023 onwards: D1 EG buys +0.33R | +0.68R a trade (n77/69, worst drawdown -9.8R | -6.3R), every year positive (2023 +6.2, 2024 +19.3, 2025 +34.1, 2026 +12.9), robust to the confirmation window (1-5 candles), zone life, hold and every trail tested; the 20-day-average gate keeps the profit and cuts the drawdown. Two thirds of the trades fire while the gold trend system is flat. H4 and H1 engulf zones lose in 2023-24, sells lose everywhere, the EF-reversal and the storyline Apex entries (DRD + H4 external breakout, 30-pip stop) are negative.' },
  { id: 'replica-msnr-size', apply: (c) => { c.replicaMsnrSize = { against: 1.5, with: 0.5 }; },
    change: 'Gold replica: position size 1.5 when the H4 Malaysian SnR direction is AGAINST the trade (the H4 pullback is still in progress, feat.msnr against) and 0.5 when it agrees; 1 when there is no direction; the add scales with it',
    why: 'Owner: find the best tweaks with all the info. The replica trades with the daily trend against the H4 trend; the Malaysian SnR direction (H4 external breakouts gated by tapped Daily levels, pivot width 5) says whether that H4 pullback is still on. Spot gold 2023-24 | 2025-26 with the live exits and risk rules: live +73.9R (DD -10.5) | +112.0R (DD -17.6); 1.5x against / 0.5x agrees +109.6R (DD -9.7) | +155.5R (DD -16.5), more profit and less drawdown in both halves; skipping the agreeing trades keeps most of the profit with half the drawdown (+72.7 / -6.5 | +99.5 / -10.3) but gives trades away; half size when against (the opposite tilt) loses in both halves. The same split had the same sign in 2019-22 when it was first measured on 5 Nov.' },
  { id: 'mosha-slow', apply: (c) => { c.moshaSlow = 12; },
    change: 'Mosha BO system: a chain whose pullback from the H1 VR extreme to the M15 CF took fewer than 12 H1 bars (a momentum arrival) is a shadow trade (blockedBy momentum), not a live one',
    why: 'Owner: judge on 2023 onwards and focus on gold. Mosha: "if price comes into our zone with momentum, risky". Gold H4-H1-M15 chains with the weekly agreeing, 3R, 2023-24 | 2025-26: all +6.3R (DD -10.5) | +21.0R (DD -17.4); slow arrivals (>= 12 H1 bars) +9.6R (DD -3.5) | +23.0R (DD -11.3), fast arrivals -3.3R | -2.0R; the split holds for thresholds 12-40 bars (fast is negative or near zero in every window). Recorded as feat.pull since 5 Nov; silver reversed it in 2019-26, which no longer counts for a gold-only rule.' },
  { id: 'gold-add-1.5', apply: (c) => { c.goldAdd = { atR: 1.5, size: 1 }; },
    change: 'Gold replica: the second unit now opens at +1.5R instead of +2R (stop at the first entry; breakeven of the first unit still at +2R; run after +4R unchanged)',
    why: 'Owner: apply the near-miss improvements. Spot gold 2023-24 | 2025-26, live risk rules and the MSNR size tilt: add at +2R +109.6R (DD -9.7) | +155.5R (DD -16.5); add at +1.5R +120.2R (DD -10.3) | +170.3R (DD -14.4). Add at +1R, breakeven at +1.5R, a later run or a half-size add are all worse.' },
  { id: 'gold-trend-add', apply: (c) => { c.goldTrendAdd = { atR: 1 }; },
    change: 'Gold trend: one add. When a closed daily candle is +1R (2 ATR at entry) above the entry, a second unit buys at market on the next run with the same ratcheting stop; it exits with the first unit',
    why: 'Owner: apply it. Spot gold 2023-24 | 2025-26, N20 with the 2 ATR trail: +9.9R (DD -2.0) | +24.1R (DD -1.0) without the add; +13.2R (DD -2.5) | +41.1R (DD -1.0) with it; N10 and N55 show the same gain. The add roughly doubles the 2025-26 result for half an R of extra early drawdown.' },
  { id: 'gold-trend-fast', apply: (c) => { c.goldTrendFast = { n: 5, k: 2 }; },
    change: 'Gold trend fast (new paper leg): the gold trend rule on the prior 5 daily highs instead of 20 (a daily close above them buys at market on the next run; stop 2 x ATR(D1,14), lifted to daily close - 2 ATR each closed day; one add at +1R); its own position next to the 20-day leg; sizing guide 0.25%',
    why: 'Owner goal: use all the skills to make the council more profitable with higher returns. Every skill rule was tested and none beat the live stack (research log 7 Nov); the gold book trades too rarely. Spot gold 1m, 0.30 cost, add at +1R: N5 alone +35.2R (2019-22, n43, DD -4.5) | +24.9R (2023-24, n22, DD -2.4) | +45.2R (2025-26, n18, DD -2.9), positive every year 2019-2026 (2022 +7.2, 2026 +9.7; Feb-Jun 2026 -2.3R over 4). Gold book in % of account (replica, trendline, engulf 0.25%, gold trend 0.5%): +39.3% DD -2.34% | +68.6% DD -6.21%; with N5 at 0.25%: +45.5% DD -2.61% | +79.9% DD -6.47% (return per drawdown 17.4 vs 16.8 | 12.3 vs 11.0). Judged on return per drawdown as a new leg, not as a rule change.' },
  { id: 'gold-momentum-pullback', apply: (c) => { c.goldMP = { mult: 1.5, top: 0.8, z1: 0.382, z2: 0.618, wait: 6, k: 2 }; },
    change: 'Gold momentum pullback (TEST since 6 Nov: recorded as shadow trades labelled test, not counted as a live system; both sides): a closed H1 candle whose range is at least 1.5x the average of the previous 14 H1 ranges and which closes in its top (buys) / bottom (sells) 20%, in the direction of the 20-day average, between 07:00 and 17:00 UTC; then the first M5 candle within 6 h that trades into the 38-62% pullback of that H1 candle and closes in the trade direction enters at market; stop 0.1 beyond the H1 candle; after +2R the stop trails 1R behind the best price (cap 10R); out after 8 h; cancelled if the stop is hit before the entry',
    why: 'Owner: find a good scalp for a raw-spread account. Every M1 and session scalp tested was zero before costs; this one is not. Spot gold 2023-24 | 2025-26 at 0.15 all-in cost: +0.105R | +0.171R a trade (n234/186, worst drawdown -9.1R | -9.5R), positive at 0.10, 0.20 and 0.30 cost, for range multiples 1.25-1.5, top 75-90%, pullback zones 23-50 / 38-62 / 50-79%, waits 3-6 h, 1.5R / 2R / 3R / trail; Feb-Jun 2026 bear window +2.8R. Without the 20-day direction it halves. Median stop 7.8 points, ~110 trades a year, entries 07-17 UTC.' },
  { id: 'mosha-bo-weekly', apply: (c) => { c.moshaBoWeekly = true; },
    change: "Mosha BO system: trades only in the weekly structure's direction (his \"Father\" timeframe); the M15 break no longer has to flip M15 structure",
    why: "From his multi-timeframe slides (father/mother/son). Spot gold 2019-26, H4->H1->M15, limit at the broken level, 3R, with the weekly direction computed the way the trader sees it live (Monday weeks built from the last 720 daily candles, swing size 3): weekly agrees 2019-22 +32.2R (87 trades, +0.37R a trade), 2023-26 +34.2R (99, +0.35R), 7 of 8 years positive, worst drawdown -18.4R; weekly against -28.3R / -15.8R. The previous flip-only rule: +7.5R / +15.1R. Caveat: the weekly filter did not help the other timeframe chains, so it is watched by the kill switch like everything else." },
  // 7 Nov (owner, 14:5x UTC): "focus on the council, improve the trading system for more results". Live sleeve: Scalp against the D1 trend,
  // outside Asia, on every market (the market focus no longer blocks it). Evidence: 30-day replay (backtest.json, 7 Nov) scalp + D1 against
  // +0.329R a trade over 500 (first half +0.24, second +0.42); D1 with -0.29R over 459. Forward shadows 1-7 Nov: scalp against +0.25R over 127.
  { id: 'scalp-against-live', apply: (c) => { c.focusSetups = ['scalp']; c.filters = c.filters || {}; const f = c.filters.scalp = c.filters.scalp || {};
      f.d1 = 'against'; f.src = { ...(f.src || {}), d1: 'user' }; f.noSession = [...new Set([...(f.noSession || []), 'asia'])]; },
    change: 'Scalp against D1, outside Asia, trades live on paper on every market (the market focus no longer blocks Scalp); the other engine setups stay shadow',
    why: '30-day replay: Scalp against the D1 trend +0.329R a trade over 500 trades, positive in both halves (+0.24 / +0.42); Scalp with D1 -0.29R over 459. Forward shadow trades 1-7 Nov agree: +0.25R over 127. Against D1 in Asia is flat (+0.03R over 562), so Asia stays out.' },
  // 7 Nov 19:xx UTC: the owner delegated the trading decisions ("you're the hedge fund manager"). The long-history research
  // overturned the 30-day replay that put Scalp live: it loses after costs in every year, market and regime tested. Scalp goes
  // back to shadow (its filters stay, its signals keep being recorded); open live Scalp trades run to their own exits.
  { id: 'scalp-shadow-research', apply: (c) => { c.focusSetups = (c.focusSetups || []).filter((k) => k !== 'scalp'); },
    change: 'Scalp back to shadow (owner delegated): no new live paper Scalp trades; signals still recorded as shadow',
    why: 'Live rule on HistData M1 2018-Oct 2026 (gold + 5 forex, live engine, 1 spread a trade): -0.187R a trade 2018-23 (n9,551), -0.229R 2024-26 (n4,532), negative every year and market (research/edge/regime); all 50 regime cells negative; no exit rescues it (research/edge/scalp-exits, best -0.18R); realistic costs -0.24 to -0.30R (research/edge/costs). The 30-day replay is -0.07R net now, and live forex results on spot candles were far worse than on Kraken (research/spotcheck.json).' },
  // 7 Nov, owner's decision: Swing goes to shadow. 10-year OANDA replay of the live engine (research/edge/meridian-swing, #481):
  // -0.095R a trade after one spread (n2,076, t -3.0), negative in both halves; no filter or exit of the 10 tested makes it
  // positive. Swing has not traded live since 2 Nov (focus); this keeps it shadow whatever the focus lists, signals still recorded.
  { id: 'swing-shadow-research', apply: (c) => { c.filters = c.filters || {}; const f = c.filters.swing = c.filters.swing || {}; f.off = true; (f.src = f.src || {}).off = 'user';
      c.focusSetups = (c.focusSetups || []).filter((k) => k !== 'swing'); },
    change: 'Swing to shadow (owner, 7 Nov): no live paper Swing trades; signals still recorded as shadow',
    why: '10-year OANDA replay of the live engine (gold + 5 forex, one spread a trade): -0.095R a trade, n2,076, t -3.0, negative in both halves; no filter or exit of 10 tested turns it positive (research/edge/meridian-swing). Owner chose shadow.' },
  // 7 Nov, owner's decision: crypto trend v3 to shadow. Decay study (research/edge/crypto-trend-decay, #508): +2.8R a trade
  // 2017-May 2025, but -0.13R over the 20 trades since Jun 2025 (t -0.56; Kraken candles from Mar 2025 -0.25R over 24); 2024-26
  // rests on one XRP run; fees are not the cause and the BTC 200-day regime does not explain the fade. New signals are recorded as
  // shadow trades (blockedBy 'owner-shadow'); trades already open run to their own exits. Undo: a new user rule clearing the flag.
  { id: 'crypto-trend-shadow', apply: (c) => { c.cryptoTrendShadow = true; },
    change: 'Crypto trend (BTC, ETH, SOL, XRP) to shadow (owner, 7 Nov): new breakouts are recorded as shadow trades, not live paper; open trades run to their exits',
    why: 'Decay study (#508): 2017-May 2025 strong (+2.8R a trade over 124 incl. the add), Jun 2025-Oct 2026 -0.13R a trade over 20 (t -0.56), Kraken candles from Mar 2025 -0.25R over 24. 2024-26 rests on one XRP run (without the top 5% +0.05R). Fees ~0.07R, not the cause; the BTC 200-day regime explains 2018/2022 but not the recent fade. About a 10% chance it is bad luck. Owner chose shadow.' },
  // 7 Nov, owner's decision: Gold trend fast (5-day) to shadow; Gold trend (20-day) stays live. 2006-17 out-of-sample test (#530):
  // the two legs' monthly R correlates 0.92 (one long-gold bet run twice); N20 has the better return per drawdown (6.8 vs 4.5).
  { id: 'gold-trend-fast-shadow', apply: (c) => { c.goldTrendFastShadow = true; },
    change: 'Gold trend fast (5-day breakout) to shadow (owner, 7 Nov): new breakouts recorded as shadow trades; Gold trend (20-day) stays live; open trades run to their exits',
    why: '2006-17 untouched test (#530): both legs regime-bound (N20 +0.49R, N5 +0.37R a position); monthly R correlation 0.92, so running both doubles one long-gold bet; N20 return per drawdown 6.8 vs 4.5. Owner kept N20 live.' },
  // 8 Nov, regime-switch study proposal (research/edge/regime-switch): every NQ New York open run trade is tagged with NAS100's 6-month
  // trend strength and the stream's own 365-day net R at entry (council/regime.mjs), and a paper shadow stream 'nyflip-trend'
  // (blockedBy 'regime-shadow') copies the trade only when |TS| >= 0.295. The live rule is untouched. Undo: a user rule clearing the flag.
  { id: 'nq-regime-shadow', apply: (c) => { c.nqRegimeShadow = { trendMin: 0.295 }; },
    change: 'NQ open run: regime tags (TREND, META) on every trade and a paper shadow stream "trend-on only" (|TS| >= 0.295); the live rule is unchanged',
    why: 'Regime study (2004-26, pre-registered): NQ/TREND is the one consistent split: second half ON +0.119R vs OFF -0.200R a trade (t 2.73, nominal; Bonferroni bar 2.83), right sign in every era, but in 2023-26 the skipped trades won (+0.23R over 41). A loss filter for dead regimes, not a regime detector: recorded as tags and a shadow so the forward record decides.' },
  // 8 Nov, owner ("leave it as paper shadow or just LIT"): the LIT edge study's pre-registered primary (research/edge/lit, #596 / #597:
  // INCONCLUSIVE, not an edge at the skill's defaults) runs forward on gold as a paper shadow stream, k 'lit' (council/lit.mjs), to
  // build a forward record. Every record is shadow (blockedBy 'owner-shadow'): never live, never alerted. Undo: a user rule clearing the flag.
  { id: 'lit-shadow', apply: (c) => { c.litShadow = true; },
    change: 'LIT (M15 FBOS → M5 RBOS → limit at the order block) runs on gold as a paper shadow stream "LIT (paper shadow)"; no live rule changes',
    why: 'LIT study (#597): INCONCLUSIVE, too few trades at the skill\'s defaults (27 gold fills in 19 years) and what fills loses; the owner keeps it as a paper shadow to build a forward record, not as a system.' },
  { id: 'mosha-cycle', apply: (c) => { c.moshaCycle = true; },
    change: "Gold: the Mosha cycle trades as a main paper system: H4 move, H1 ChoCh = the pullback starts, M15 / M5 trade the pullback (target the H4 50%), then the M15 / M5 ChoCh back with H4 (target the H4 extreme); limit at the broken level, stop past its origin",
    why: "Owner, 11 Nov: 'H4 move, H1 ChoCh tells pullback or retracement started, M15 / M5 to entry and target H4 or H1 … the ai should trade with the bot', chosen as a main system. Not a tested edge: the mechanical studies of this cycle (mosha-retrace break-even, mosha-cycle -0.22R) did not pass; this is the owner's call, judged on its forward record." },
  // 11 Nov, owner on the edge review's decisions (research/proposals/2026-11-11-edge-review.md): "yes anything that is better for the
  // system and that applies it". Three rules, nothing wider.
  // (1) The live paper book is Gold trend (20-day) and Gold daily engulf only. The gold replica, the momentum pullback (a test
  // shadow since 6 Nov), the NQ New York open run, the H4 trendline and Mosha BO become paper shadows: the same rule, the same
  // stop and the same loop, new trades recorded shadow: true, blockedBy 'owner-shadow' (never alerted, no futures ticket, not in
  // the MT5 feed). config.ownerShadow[k] = when it started. Trades already open as live stay live and run to their own exits.
  // Entries, filters, sizes, stops and exits are unchanged for all seven. Undo: a new user rule deleting a key of ownerShadow.
  { id: 'supported-book', apply: (c) => { const at = Math.floor(Date.now() / 1000); c.ownerShadow = { ...(c.ownerShadow || {}) }; for (const k of OWNER_SHADOW_K) if (!c.ownerShadow[k]) c.ownerShadow[k] = at; },
    change: 'Supported book (owner, 11 Nov): Gold trend (20-day) and Gold daily engulf stay live; Gold replica, Gold momentum pullback, NQ New York open run, Gold H4 trendline and Mosha BO become paper shadows (same rules and stops, recorded and managed, never alerted); trades already open run to their exits as live',
    why: 'Edge review of 11 Nov: no system has t 2 out of sample after costs; on untouched 2006-17 Gold trend +0.49R a position (n 75, t 1.77) and the daily engulf +0.19R (n 256, t 1.89) are the nearest, the H4 trendline +0.05R (t 0.83, +0.01R after financing), Mosha BO +0.14R (n 62, t 0.55), the replica -0.05R on 2017-22 (n 115), the momentum pullback -0.04R on 2018-22 (n 634), the NQ open run -0.02R on 2004-22 (n 1,560). The book of all of them made +4.3R a year with an 83R drawdown on 2006-17 and lost at doubled costs (research/edge/honest-book). The two-system book itself has not been run as a book. Owner: "yes anything that is better for the system and that applies it".' },
  // (2) Overnight financing is part of the paper cost (council/fills.mjs FIN, financing): a gold long pays 0.0148 % of its entry
  // price for every rollover it is held through. Every trade closed from this run on carries it in costR / Rnet (finR, nights);
  // trades closed before keep the cost they were stamped with. config.financingFrom = when it started.
  { id: 'count-financing', apply: (c) => { c.financingFrom = new Date().toISOString(); },
    change: 'Paper costs now include overnight financing on gold longs (0.0148% of price a rollover, three on Wednesday), for every trade closed from now on; earlier trades keep their recorded cost',
    why: 'trend-breadth Part A (11 Nov): the demo broker charges 5.903 pips a night on a long ounce of gold, about 5.3% a year, which no cost model counted: on untouched 2006-17 it takes Gold trend from +0.49R to +0.40R a position (t 1.77 to 1.49), the daily engulf from +0.19R to +0.14R and the H4 trendline from +0.05R to +0.01R, about 2.8R a year between them. Owner approved.' },
  // (3) The demo mirror stops OPENING copies of the replica's forex and crypto research paper trades on the Replica demo account
  // (council/ctrader-mirror.mjs reads config.mirrorReplica.markets). Gold replica copies and every other book are unchanged, and a
  // position already copied is managed to its close as before. Condition to look again, written here and in the config: the
  // forex and crypto replica paper trades closed since `since` number 200 or more and their total R before costs is above zero
  // (snapshot.mirrorReplica counts it every round; nothing resumes by itself, the owner decides). Off-switch: a user rule setting
  // c.mirrorReplica = null (every replica research trade is copied again).
  { id: 'replica-mirror-gold-only', apply: (c) => { c.mirrorReplica = { markets: ['xau'], since: Math.floor(Date.now() / 1000), until: { n: 200, grossR: 0, text: 'forex and crypto replica paper trades closed since the rule: 200 or more, total R before costs above zero; then the owner decides' } }; },
    change: 'Demo mirror: no new copies of the replica\'s forex and crypto paper trades on the Replica demo account until that stream is positive before costs over 200 trades; gold replica copies and positions already copied are unchanged',
    why: 'Edge review of 11 Nov: the replica\'s forward paper trades on ten markets since 3 Nov made -0.08R a trade before costs (n 568, t -1.3), and the Replica demo account fills 0.08R worse than paper on every copy (n 121, t 3.9). Owner approved.' },
];
config.userRules = config.userRules || [];
// supported-book (owner, 11 Nov 2026): the systems whose NEW trades are paper shadows; ownerSh(k) reads the config the rule wrote
const OWNER_SHADOW_K = ['replica', 'mosha-bo', 'gtl', 'gmp', 'nq-open'];
const ownerSh = (k) => !!(config.ownerShadow || {})[k];
for (const u of USER_RULES) if (!config.userRules.includes(u.id)) { u.apply(config); config.userRules.push(u.id); config.history.push({ at: nowISO, by: 'user', change: u.change, why: u.why }); }
// Forward-test protocol (owner, 12 Nov 2026: "Yes to all", docs/owner-decisions.md item 43 adopted): when the last reading of the
// forward tracker (coach.json forward, council/forward.mjs) reports a crossed stop line (S1-S4), Gold trend and Gold daily engulf
// join config.ownerShadow (their NEW trades are paper shadows; trades already open or pending run to their own exits with their
// stops), once, with a `by: 'user'` history line quoting the protocol, and one alert below. Never undone here; execution checks
// (E1-E5) never switch anything.
try { const sw = stopSwitch(config, (rd('coach.json', {}) || {}).forward, now); if (sw) console.log('forward-test protocol: stop line', sw.lines.join(', '), 'crossed: the book goes back to a paper shadow'); }
catch (e) { console.log('forward stop switch failed:', e.message); }
// Owner rules are never undone by the Coach (7 Nov). Normalise the older string form (gold-m30 stored src: 'user',
// since: '<iso>') into the per-field objects the Coach reads, and mark the owner's "Scalp outside Asia" session rule.
for (const fl of Object.values(config.filters || {})) {
  if (typeof fl.src === 'string') fl.src = Object.fromEntries(['d1', 'struct'].filter((c) => fl[c]).map((c) => [c, fl.src]));
  if (typeof fl.since === 'string') fl.since = Object.fromEntries(['d1', 'struct'].filter((c) => fl[c]).map((c) => [c, fl.since]));
}
if (config.userRules.includes('scalp-against-live') && config.filters.scalp && (config.filters.scalp.noSession || []).includes('asia')) (config.filters.scalp.src = config.filters.scalp.src || {})['session:asia'] = 'user';
const userOwned = (fl, key) => ((fl && fl.src) || {})[key] === 'user';
const state = Object.assign({ seen: {}, lastRun: 0 }, rd('state.json', {}));
let trades = rd('trades.json', []);
// Live-sleeve guard (7 Nov): a setup put live through focusSetups goes back to shadow on its own if its live paper trades since
// it went live lose 0.3R or more a trade over 20+ closed trades (the 1-3 Nov live Scalps lost -0.82R over 11 while the shadows made
// +0.35R, so the forward live record is the judge, not the replay). The owner can put it back with a new user rule.
for (const k of [...(config.focusSetups || [])]) {
  const h = (config.history || []).find((x) => x.by === 'user' && /trades live on paper on every market/.test(x.change || '') && new RegExp('^' + k, 'i').test(x.change || ''));
  const since = h ? Date.parse(h.at) / 1000 : 0;
  const L = trades.filter((x) => x.k === k && !x.shadow && x.opened >= since && (x.status === 'win' || x.status === 'loss' || x.status === 'be') && isFinite(x.R));
  const e = L.length ? L.reduce((a, x) => a + x.R, 0) / L.length : 0;
  if (L.length >= 20 && e <= -0.3) {
    config.focusSetups = config.focusSetups.filter((x) => x !== k); (config.sleeveStopped = config.sleeveStopped || {})[k] = nowISO;
    config.history.push({ at: nowISO, by: 'coach-guard', change: `${k}: back to shadow (live sleeve stopped)`, why: `${L.length} live trades since ${new Date(since * 1000).toISOString().slice(0, 10)} made ${e.toFixed(2)}R a trade (stop at -0.30R over 20+).` });
  }
}
// Owner's loss reviews (6 Nov): written from the page's Loss review card into reviews/losses.json. Reasons that match the
// trade reviews' own causes count in the lesson rules below; the rest are summarised per setup as rule ideas to test.
const OWNER_REV = (rd('reviews/losses.json', {}) || {}).reviews || {};
const OWNER_CAUSE = { hunt: 'hunt', noise: 'noise', late: 'late', news: 'news' };
// Analyst post-mortems of live losses (reviews/analyst.json, by: 'analyst'): their tags count only where the owner wrote no review
const ANALYST_REV = (rd('reviews/analyst.json', {}) || {}).reviews || {};
const ownTags = (x) => ((OWNER_REV[x.id] && !OWNER_REV[x.id].draft && OWNER_REV[x.id].tags) || (ANALYST_REV[x.id] && ANALYST_REV[x.id].tags) || []);
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
let research = rd('research.json', []);
// One-time data repairs (7 Nov, council/repairs.mjs): void the 4 Nov rounded-price replica signals; history catch-up lines;
// 8 Nov: the pre-dedupe m30m1 copies of Scalp entries get status 'duplicate' (research/edge/shadow-audit)
voidRoundedReplicas(research, config, nowISO); historyCatchUp(config, nowISO); voidM30Twins(trades, config, nowISO);
// 12 Nov 2026 (owner approved, "count duplicates once"): past exact duplicates (council/dedupe.mjs) get status 'duplicate'
voidExactTwins(trades, config, nowISO);
// 7 Nov: closed crypto trades re-costed under the CFD model (#568); annotateCosts below recomputes costR / Rnet this round
recostCrypto(trades, MARKETS, config, nowISO);
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
// H1 engulfing barriers (4 Nov, night: the owner's "barriers"): an H1 engulfing candle with a body of at least 0.5 H1 ATR(14)
// marks a zone — demand: from the lower low of the pair up to the engulfed candle's open; supply: from the engulfed candle's
// open up to the higher high. A zone lives until an H1 close passes its far side, or 10 days. Same rules as the research replay.
function h1EgZones(bars) {
  const B = bars, z = [];
  const tr = (i) => Math.max(B[i].high - B[i].low, Math.abs(B[i].high - B[i - 1].close), Math.abs(B[i].low - B[i - 1].close));
  for (let i = 1; i < B.length; i++) {
    let s = 0, k = 0; for (let j = Math.max(1, i - 13); j <= i; j++) { s += tr(j); k++; } const a = s / Math.max(k, 1);
    const p = B[i - 1], b = B[i];
    if (Math.abs(b.close - b.open) >= 0.5 * a) {
      if (p.close < p.open && b.close > b.open && b.close >= p.open && b.open <= p.close) z.push({ d: 1, top: p.open, bot: Math.min(p.low, b.low), t: b.time + 3600 });
      if (p.close > p.open && b.close < b.open && b.close <= p.open && b.open >= p.close) z.push({ d: -1, top: Math.max(p.high, b.high), bot: p.open, t: b.time + 3600 });
    }
    for (const q of z) if (!q.dead && q.t <= b.time && ((q.d === 1 && b.close < q.bot) || (q.d === -1 && b.close > q.top) || b.time - q.t > 10 * 86400)) q.dead = true;
  }
  const last = B.at(-1).time + 3600;
  return z.filter((q) => !q.dead && last - q.t <= 10 * 86400);
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
      out.push({ sell, ext, lvl, start, atr: atr15, tc: bars[iC].time, cc: bars[iC].close, L, eg, peg, star });
    }
  }
  return out;
}
let goldM1 = null;   // gold's 1-minute candles (spot-shifted), for the gold New York open run check after the NQ section
for (const [key, M] of Object.entries(MARKETS)) {
  try {
    const src = {}, tfs = M30_MARKETS.has(key) ? TFS_M30 : TFS;
    // gold/forex: every timeframe from OANDA spot, or (any one missing) every timeframe from Kraken, never a mix
    let feed = 'Kraken';
    if (OANDA_D1.has(key)) {
      const got = {}; for (const [id] of tfs) { got[id] = await oandaBars(key, id); if (!got[id]) break; }
      const ok = tfs.every(([id]) => got[id]);
      // hysteresis (8 Nov, council/feed.mjs feedDecision): a market on OANDA skips the round on one missed read instead of flipping
      // to Kraken and back (two re-quotes); it falls to Kraken only on the second miss in a row. state.feedMiss counts the misses.
      const FM = (state.feedMiss = state.feedMiss || {}), d = feedDecision({ oandaOk: ok, oandaMarket: true, prevFeed: ((state.feedLast || {})[key] || {}).feed || null, misses: FM[key] || 0 });
      FM[key] = d.misses;
      if (d.feed === 'skip') { (snapshot.feed = snapshot.feed || {})[key] = 'OANDA'; snapshot.errors['feed:' + key] = `OANDA not read this round (${d.misses} miss): ${M.label} skipped, feed kept, nothing re-quoted`; continue; }
      if (ok) { feed = 'OANDA'; for (const [id] of tfs) src[id] = { bars: got[id] }; }
    }
    (snapshot.feed = snapshot.feed || {})[key] = feed;
    const FEED = feedTag(feed);   // 'oanda' | 'kraken': written on every record this round creates
    if (feed === 'Kraken') for (const [id, iv] of tfs) {
      const bars = await kraken(M.kraken, iv);
      await sleep(1100);
      const nBad = cleanBars(bars, M.group === 'Forex' && LTF_CLEAN.has(id) ? { wickK: 15 } : {});
      if (nBad) { snapshot.cleaned = snapshot.cleaned || {}; (snapshot.cleaned[key] = snapshot.cleaned[key] || {})[id] = nBad; }
      src[id] = { bars };
    }
    const off = M.spot && feed === 'Kraken' ? basisFor(key, src['1m'].bars) : 0;   // OANDA gold is spot already
    for (const id of Object.keys(src)) {
      src[id].bars = src[id].bars.map((b) => ({ time: b.time, open: b.open + off, high: b.high + off, low: b.low + off, close: b.close + off }));
      src[id].A = msAnalyze(src[id].bars, 6);
    }
    // D1 trend from OANDA spot (owner 7 Nov): Kraken's PAXG daily candles (weekend candles, a different history window) kept gold
    // "up" since a 27 Jan 2026 break while spot broke down on 30 Oct, so the council's "with / against D1" disagreed with the charts.
    // Gold and forex now take the D1 trend (only the trend label; the D1 candles the systems trade on stay Kraken) from the same
    // OANDA feed the site charts use; if it can't be read, the Kraken trend stays. Replay check: against D1 +0.38R (OANDA labels).
    if (OANDA_D1.has(key)) { const kt = src['1d'].A.trend;
      try { const r = await fetch(`${MD_BASE}bars?sym=${key}&tf=1d&n=720`, { signal: AbortSignal.timeout(8000) }); const j = r.ok ? await r.json() : null;
        if (j && j.src === 'OANDA' && Array.isArray(j.bars) && j.bars.length > 200) { const ot = msAnalyze(j.bars.map((b) => ({ time: b.time, open: +b.open, high: +b.high, low: +b.low, close: +b.close })), 6).trend;
          if (ot === 1 || ot === -1) src['1d'].A.trend = ot; (snapshot.d1src = snapshot.d1src || {})[key] = { src: 'OANDA', trend: src['1d'].A.trend, kraken: kt }; }
        else (snapshot.d1src = snapshot.d1src || {})[key] = { src: 'Kraken', trend: kt, why: j && j.error ? String(j.error).slice(0, 80) : 'no OANDA bars' };
      } catch (e) { (snapshot.d1src = snapshot.d1src || {})[key] = { src: 'Kraken', trend: kt, why: String(e.message || e).slice(0, 80) }; } }
    const price = src['1m'].bars.at(-1).close;
    if (key === 'xau') goldM1 = src['1m'].bars;
    // feed change (8 Nov, council/feed.mjs): a record priced on one feed is never filled, stopped or targeted by the other feed's
    // candles. Pending orders priced on the previous feed are re-derived from the rule's own levels on this feed (Gold daily engulf)
    // or cancelled with the reason; open positions keep the fill and have stop / target / trail marks re-based by the basis measured
    // on the switch minute (state.feedLast = the previous round's last closed 1-minute candle, same frame as these bars). Every live
    // record gets its feed tag here; a switch is logged in state.feedChanges and shown in snapshot.errors / snapshot.feedChanges.
    { const FL = (state.feedLast = state.feedLast || {}), prev = FL[key], dpF = Math.max(2, (M.dec ?? 2) + 1);
      const q = requoteMarket({ trades, key, feed, src, price, now, dp: dpF, config, prev, oandaMarket: OANDA_D1.has(key) });
      if (q.from || (prev && prev.feed !== FEED)) {
        const c = { at: nowISO, market: key, label: M.label, from: q.from || prev.feed, to: FEED, basis: q.basis, rederived: q.rederived, cancelled: q.cancelled, rebased: q.rebased, kept: q.kept, ids: q.ids.slice(0, 20) };
        state.feedChanges = (state.feedChanges || []).concat([c]).slice(-50); snapshot.errors['feed:' + key] = feedChangeText(c);
      }
      const lc = src['1m'].bars.at(-2) || src['1m'].bars.at(-1); FL[key] = { feed: FEED, t: lc.time, close: lc.close }; }
    setMarket(M);
    const setups = BUILDERS.map(([pr, fn]) => { try { return fn(pr, price, src); } catch (e) { return null; } }).filter(Boolean);
    snapshot.markets[key] = {
      label: M.label, name: M.name, price, dec: M.dec,
      trend: Object.fromEntries(['1d', '4h', '1h'].map((k) => [k, src[k].A.trend])),
      setups: setups.map((t) => ({ k: t.k, name: t.name, pair: t.pair, side: t.sell ? 'sell' : 'buy', state: t.state, entry: t.entry, stop: t.stop, t1: t.t1, rr: +t.rr.toFixed(2), next: t.next, retrace: !!t.retrace })),
    };

    if (config.retireLegacy) for (const tr of trades.filter((x) => x.market === key && !x.shadow && !['replica', 'mosha-bo', 'mcycle', 'trend', 'gtrend', 'gtrend5', 'gtl', 'geg', 'gmp'].includes(x.k) && (x.status === 'open' || x.status === 'pending'))) {
      if (tr.status === 'pending') { tr.status = 'expired'; tr.R = 0; } else { const r0 = tr.r0 || Math.abs(tr.entry - tr.stop), R = +(((tr.side === 'sell' ? -1 : 1) * (price - tr.entry - (tr.feedBasis || 0))) / r0).toFixed(2); tr.R = R; tr.status = R > 0 ? 'win' : R < 0 ? 'loss' : 'be'; }
      tr.closed = now; tr.exit = 'retired';
    }
    // ─── Manage open trades on this market with the candles since the last check ───
    for (const tr of trades.filter((x) => x.market === key && (x.status === 'pending' || x.status === 'open'))) {
      const bars = (src['1m'].bars[0].time <= tr.checked ? src['1m'] : src['5m'].bars[0].time <= tr.checked ? src['5m'] : src['15m']).bars;
      const s = tr.side === 'sell', E = tr.entry + (tr.feedBasis || 0);   // E: the entry in this feed's frame (council/feed.mjs)
      let exitBar = null, next = bars.at(-1).time;
      // forex: leave the newest 3 one-minute candles for the next run, so a lone spike is judged (and clipped) before it can
      // fill, stop or target a trade
      const settle = M.group === 'Forex' && bars === src['1m'].bars ? bars.at(-1).time - 3 * 60 : Infinity;
      // missing candles (8 Nov): the check could not see the stretch before the oldest candle the feed still has; recorded, and the
      // first candle's open carries any gap (stopFill below)
      if (bars.length && tr.checked && bars[0].time - tr.checked > 900) tr.dataGap = (tr.dataGap || 0) + (bars[0].time - tr.checked);
      for (const b of bars) {
        if (b.time < tr.checked) continue;
        if (b.time > settle) { next = b.time; break; }
        // gold / forex (8 Nov): a candle while the spot market is shut (Kraken's PAXG fallback trades the weekend) never fills or stops a trade
        if (M.group !== 'Crypto' && spotSkip(b.time)) continue;   // 7 Nov: + the 17:00 New York rollover minutes (owner)
        if (tr.status === 'pending') {
          if (s ? b.high >= tr.entry : b.low <= tr.entry) {
            // 8 Nov: the fill candle also reached the target (not the stop) and did not open through the entry: which came first is
            // unknown, so it counts as missed (0R), never as a win
            if (fillBarAmbiguous(b, s, tr.entry, tr.stop, tr.t1)) { tr.status = 'missed'; tr.closed = b.time; tr.R = 0; tr.exit = 'fill and target in one candle'; break; }
            tr.status = 'open'; tr.filled = b.time; }
          else if (s ? b.low <= tr.t1 : b.high >= tr.t1) { tr.status = 'missed'; tr.closed = b.time; tr.R = 0; break; }
          else continue;
        }
        const r0 = tr.r0 || (tr.r0 = Math.abs(E - tr.stop));
        if (s ? b.high >= tr.stop : b.low <= tr.stop) {
          // 8 Nov: a candle that opens beyond the stop (weekend / news gap, missing candles) fills at its open, not at the stop
          const px = stopFill(b, s, tr.stop, b.time > tr.filled), gapped = px !== tr.stop;
          if (tr.trail && tr.trailMoved) { tr.R = exitR(s, E, px, r0); tr.status = tr.R > 0 ? 'win' : tr.R < 0 ? 'loss' : 'be'; tr.exit = 'trailing stop'; }
          else if (tr.beMoved) { tr.R = exitR(s, E, px, r0); tr.status = tr.R < 0 ? 'loss' : 'be'; } else { tr.status = 'loss'; tr.R = gapped ? exitR(s, E, px, r0) : -1; }
          if (gapped) tr.gapR = +((s ? px - tr.stop : tr.stop - px) / r0).toFixed(2);   // R lost beyond the stop
          tr.exitPx = px; tr.exitKind = 'stop'; tr.closed = b.time; exitBar = b; break;
        }
        if (s ? b.low <= tr.t1 : b.high >= tr.t1) { tr.status = 'win'; tr.closed = b.time; tr.R = tr.rr; tr.exitPx = tr.t1; tr.exitKind = 'target'; exitBar = b; break; }
        if (tr.maxHold && b.time >= tr.filled + tr.maxHold) { const R = +((s ? E - b.close : b.close - E) / r0).toFixed(2); tr.status = R > 0 ? 'win' : R < 0 ? 'loss' : 'be'; tr.R = R; tr.closed = b.time; tr.exit = `${tr.maxHold / 3600} h`; tr.exitPx = b.close; tr.exitKind = 'time'; exitBar = b; break; }
        // how far the trade went for (MFE) and against (MAE), in R: the Coach learns trade management from these
        tr.mfe = +Math.max(tr.mfe || 0, ((s ? E - b.low : b.high - E) / r0)).toFixed(2);
        tr.mae = +Math.max(tr.mae || 0, ((s ? b.high - E : E - b.low) / r0)).toFixed(2);
        // break-even rule from the Coach: once the trade is config.be R in profit, the stop moves to the entry
        // only on a candle that actually reached +be R: a trade that was past it before the rule existed and is now
        // back near the entry can't place a stop on the wrong side of price, so it waits until it gets there again
        // trailing stop (replica, 4 Nov): once the trade is trail[0] R in profit, the stop follows trail[1] R behind the best price
        if (tr.trail && tr.mfe >= tr.trail[0]) { const ns = E + (s ? -1 : 1) * (tr.mfe - tr.trail[1]) * r0; if (s ? ns < tr.stop : ns > tr.stop) { tr.stop = +ns.toFixed(Math.max(2, (tr.dec ?? 2) + 1)); tr.trailMoved = true; } }
        if (config.be && !tr.noBe && !tr.beMoved && (s ? E < tr.stop : E > tr.stop) && ((s ? E - b.low : b.high - E) / r0) >= config.be) { tr.stop = E; tr.beMoved = true; }
        // per-trade breakeven (gold replica, 5 Nov, gold-top-be): once the trade reaches +beAt R the stop moves to the entry
        // (9 Nov audit: both break-evens only ever tighten: a stop the trail already moved past the entry stays where it is)
        if (tr.beAt && !tr.beMoved && (s ? E < tr.stop : E > tr.stop) && ((s ? E - b.low : b.high - E) / r0) >= tr.beAt) { tr.stop = E; tr.beMoved = true; }
        // pyramid add (gold replica, 5 Nov, gold-add): at +addAt R a second unit opens at that level, stop at this trade's entry, same
        // target; its trail is this trade's trail re-expressed in its own R (parent [4,1] -> add [1,0.5]); size scales its R so
        // the add's 2R-wide stop counts as 2R of account risk. Adds don't count toward the max-3-open cap.
        if (tr.addAt && !tr.addDone && tr.status === 'open' && tr.mfe >= tr.addAt) {
          tr.addDone = true; const dp = Math.max(2, (tr.dec ?? 2) + 1), dir = s ? -1 : 1, ae = +(E + dir * tr.addAt * r0).toFixed(dp), rA = Math.abs(ae - E);
          if (rA > 0 && !trades.some((x) => x.id === `${tr.id}-add`)) trades.push({ id: `${tr.id}-add`, market: tr.market, label: tr.label, dec: tr.dec, k: tr.k, name: `${tr.name} add`, pair: tr.pair, h: tr.h, side: tr.side,
            entry: ae, stop: E, t1: tr.t1, rr: +(Math.abs(tr.t1 - ae) / rA).toFixed(2), trail: tr.trail ? [+((tr.trail[0] - tr.addAt) / tr.addAt).toFixed(3), +(tr.trail[1] / tr.addAt).toFixed(3)] : undefined,
            size: +(tr.addAt * (tr.size || 1)).toFixed(2), buf: tr.buf, opened: b.time, filled: b.time, checked: b.time, status: 'open', R: null, r0: rA, maxHold: Math.max(300, (tr.filled + (tr.maxHold || 48 * 3600)) - b.time), noBe: true, entryMode: 'market', addOf: tr.id, shadow: !!tr.shadow, blockedBy: tr.shadow ? (Array.isArray(tr.blockedBy) && tr.blockedBy.length ? tr.blockedBy.slice() : ['owner-shadow']) : [],
            feed: FEED, note: `${tr.name} add: the trade from ${E} reached +${tr.addAt}R, so a second unit ${tr.side === 'sell' ? 'sells' : 'buys'} ${ae} with the stop at the first entry ${E} (${tr.addAt}R of risk, counted as size ${tr.addAt}); ${tr.trail ? `after the first trade's +${tr.trail[0]}R both trail ${tr.trail[1]}R behind the best price` : `target ${tr.t1}`}; out with the first trade.` });
        }
      }
      tr.checked = exitBar ? bars.at(-1).time : next;
      // half-size trades (replica equity filter): the score counts R × size; rawR keeps the full-size result
      if (tr.size && tr.size !== 1 && tr.R != null && tr.rawR == null) { tr.rawR = tr.R; tr.R = +(tr.R * tr.size).toFixed(2); }
      if (exitBar) startReview(tr, exitBar, key, NEWS);
      if (tr.status === 'pending' && now - tr.opened > (tr.validFor || WAIT[tr.h] || 86400)) { tr.status = 'expired'; tr.closed = now; tr.R = 0; }
    }

    // ─── Review closed trades: keep watching price after the exit, then give a verdict (system error or market) ───
    for (const tr of trades.filter((x) => x.market === key && (x.status === 'win' || x.status === 'loss' || x.status === 'be') && (!x.pm || x.pm.phase === 'watch'))) {
      if (!tr.pm) { if (now - tr.closed > 7 * 86400) continue; startReview(tr, null, key, NEWS); }   // trades closed before reviews existed
      const bars = (src['1m'].bars[0].time <= tr.pm.checked ? src['1m'] : src['5m'].bars[0].time <= tr.pm.checked ? src['5m'] : src['15m']).bars;
      watchReview(tr, bars);
    }

    // ─── Research (paper only, research.json): manage open Daily Cycle trades, then look for today's signal ───
    for (const r of research.filter((x) => x.market === key && x.k === 'replica' && !x.void && (x.status === 'pending' || x.status === 'open'))) {
      const bars = (src['1m'].bars[0].time <= r.checked ? src['1m'] : src['5m'].bars[0].time <= r.checked ? src['5m'] : src['15m']).bars;
      const s = r.side === 'sell', r0 = Math.abs(r.entry - r.stop);
      for (const b of bars) {
        if (b.time < r.checked) continue;
        // 8 Nov (gold-fidelity): research rows follow the live fills rules too: no fill or exit on a candle while spot is shut
        // (weekend, 17:00 NY rollover minutes); a fill candle that also reached the target counts as missed, never as a win
        if (M.group !== 'Crypto' && spotSkip(b.time)) continue;
        if (r.status === 'pending') {
          if (s ? b.high >= r.entry : b.low <= r.entry) {
            if (fillBarAmbiguous(b, s, r.entry, r.stop, r.t1)) { r.status = 'missed'; r.R = 0; r.closed = b.time; r.exit = 'fill and target in one candle'; break; }
            r.status = 'open'; r.filled = b.time; }
          else if (s ? b.low <= r.t1 : b.high >= r.t1) { r.status = 'missed'; r.R = 0; r.closed = b.time; break; }
          else { if (b.time > r.validUntil) { r.status = 'expired'; r.R = 0; r.closed = b.time; break; } continue; }
        }
        if (s ? b.high >= r.stop : b.low <= r.stop) { const px = stopFill(b, s, r.stop, b.time > r.filled); r.status = 'loss'; r.R = px === r.stop ? -1 : exitR(s, r.entry, px, r0); r.closed = b.time; break; }
        if (s ? b.low <= r.t1 : b.high >= r.t1) { r.status = 'win'; r.R = +((Math.abs(r.t1 - r.entry)) / r0).toFixed(2); r.closed = b.time; break; }
        if (b.time >= r.filled + 48 * 3600) { const R = +((s ? r.entry - b.close : b.close - r.entry) / r0).toFixed(2); r.status = R > 0 ? 'win' : R < 0 ? 'loss' : 'be'; r.R = R; r.closed = b.time; r.exit = '48 h'; break; }
      }
      r.checked = bars.at(-1).time;
    }
    // 4 Nov: the replica runs unchanged on every market as research (paper, 2R): an out-of-sample test of the method itself.
    // Only gold trades it live (config.replicaLive). The 0.30 stop floor is in gold dollars, so other markets use 0.1 ATR alone.
    // Mosha breakout system (4 Nov, night; user rule mosha-bo), from his "All you need is this Breakout System" post:
    // 0. weekly structure in the trade's direction (user rule mosha-bo-weekly, 4 Nov; before it: the M15 BO had to flip M15)
    // 1. H4 BO (bias)  2. H1 BO the other way (the retracement), after it  3. M15 BO back in the H4 direction
    // 4. pullback entry: limit at the broken M15 level, stop past the M15 Origin, target 3R (his 1:2 or 1:3), valid 24 h,
    // out after 72 h. Spot gold, engine events causal: 2019-22 104 trades +7.5R (2R +11.5R), 2023-26 114 trades +15.1R
    // (+0.13R a trade), no volatility gate needed. Lower-timeframe chains (H1-M15-M5, M30-M15-M5) lost and are not used.
    // Crypto trend (5 Nov, user rule pairs-best; v3 since 5 Nov, shadow since 7 Nov): two slots per coin, the 55- and 100-day
    // breakouts, long only. Entry the first run after a daily close above the prior N daily highs (at market); catastrophe stop
    // 5 x ATR(20) below, fixed; out on a daily close under the ratcheting N-day channel midpoint (at market); one add at +1R.
    // (The v1 rule in the pairs-best history line, 4 ATR trail and the 27-day low, only manages trades opened before v3.)
    // A coin stops opening trend trades once its forward trend total reaches config.cryptoTrendStopR (−8R).
    if ((config.cryptoTrend || []).includes(key)) {
      try {
        const D = src['1d'].bars.slice(0, -1), n = D.length, last = D[n - 1];
        const tr = (i) => Math.max(D[i].high - D[i].low, Math.abs(D[i].high - D[i - 1].close), Math.abs(D[i].low - D[i - 1].close));
        const atrAt = (i) => { let a = 0; for (let j = i - 19; j <= i; j++) a += tr(j); return a / 20; };
        // v2 (5 Nov, loop): two slots per coin, the 55-day breakout (out under the 27-day low) and the 100-day breakout (out under
        // the 50-day low), both with a 5 ATR trail. Walk-forward (picked on 2018-21, judged on 2022-26, 10 coins, 0.8% costs):
        // 5 ATR beat 3.5/4/6 on 2018-21 and held (+0.40R vs +0.30R a trade); the pair made +96.5R over 186 (+0.52R) vs +40.0R
        // for the 55-day alone; council coins +52.3R over 70 (+0.75R), worst drawdown −7.9R. Older trades keep their own kATR.
        const SYSX = [{ sys: 55, x: 27, k: 5, id: 'trend' }, { sys: 100, x: 50, k: 5, id: 'trend100' }], A = atrAt(n - 1);
        const hiN = (N) => Math.max(...D.slice(n - 1 - N, n - 1).map((b) => b.high)), hi55 = hiN(55), lo27 = Math.min(...D.slice(n - 28, n - 1).map((b) => b.low));
        const mine = trades.filter((x) => x.k === 'trend' && x.market === key && !x.shadow), sh = !!config.cryptoTrendShadow;
        // shadow mode (crypto-trend-shadow): live and shadow trend trades are both managed here; one open trade per slot either way
        const mineAll = trades.filter((x) => x.k === 'trend' && x.market === key && (!x.shadow || (x.blockedBy || []).includes('owner-shadow')));
        const fwdR = mine.filter((x) => x.R != null && x.closed && x.opened >= (config.cryptoTrendAt || 0)).reduce((a, x) => a + x.R, 0);
        const stopped = config.cryptoTrendStopR != null && fwdR <= config.cryptoTrendStopR, dp = Math.max(2, (M.dec ?? 2) + 1);
        for (const S of SYSX) {
          const open = mineAll.find((x) => x.status === 'open' && !x.addOf && (x.sys || 55) === S.sys), xN = open ? (open.sys === 100 ? 50 : 27) : S.x;
          if (open) {
            for (const b of D.filter((b) => b.time > (open.lastD || open.filled - 86400) && b.time >= Math.floor(open.filled / 86400) * 86400)) {
              const i = D.indexOf(b); if (i < xN + 1) continue;
              open.best = Math.max(open.best || open.entry, b.close);
              if (open.exitRule === 'mid') {
                // v3: the channel midpoint of the system's own lookback ratchets up; a daily close under it exits at market
                const N = open.sys || 55, mid = (Math.max(...D.slice(i - N, i).map((x) => x.high)) + Math.min(...D.slice(i - N, i).map((x) => x.low))) / 2;
                open.midStop = +Math.max(open.midStop || 0, mid).toFixed(dp);
                if (b.close < open.midStop && i === n - 1) { const R = +((price - open.entry) / open.r0).toFixed(2); open.status = R > 0 ? 'win' : R < 0 ? 'loss' : 'be'; open.R = R; open.closed = now; open.exit = `${N}-day channel midpoint`;
                  // the add (crypto-add) leaves with the first trade, at its own R
                  for (const a of trades.filter((x) => x.addOf === open.id && x.status === 'open')) { const Ra = +((price - a.entry) / a.r0).toFixed(2); a.status = Ra > 0 ? 'win' : Ra < 0 ? 'loss' : 'be'; a.R = Ra; a.closed = now; a.exit = `${N}-day channel midpoint (with the first trade)`; } }
                // crypto-add (5 Nov): one add when a daily close is +atR R above the entry; same 5 ATR (at entry) stop under the add's own price
                else if (config.cryptoAdd && !open.addDone && i === n - 1 && b.close >= open.entry + config.cryptoAdd.atR * open.r0 && !trades.some((x) => x.id === `${open.id}-add`)) {
                  open.addDone = true; const ae = +price.toFixed(dp), rA = open.r0, st = +(ae - rA).toFixed(dp);
                  if (ae > open.entry && st > 0) trades.push({ id: `${open.id}-add`, market: key, label: M.label, dec: M.dec, k: 'trend', sys: open.sys, kATR: open.kATR, name: 'Crypto trend add', pair: open.pair, h: '1d', side: 'buy',
                    entry: ae, stop: st, t1: +(ae * 100).toFixed(2), rr: 99, trail: [1e6, 0], size: config.cryptoAdd.size, buf: CFG.buf, opened: now, filled: now, checked: now, status: 'open', R: null, r0: rA, noBe: true, entryMode: 'market', addOf: open.id, shadow: !!open.shadow, blockedBy: open.shadow ? ['owner-shadow'] : [],
                    feed: FEED, note: `Crypto trend add: the trade from ${open.entry} closed the day +${config.cryptoAdd.atR}R (5 ATR) higher, so a second unit buys ${ae} with its own catastrophe stop ${st} (5 ATR at entry); it exits with the first trade on a daily close under the channel midpoint ${open.midStop}.` });
                }
              } else {
                const ns = +(open.best - (open.kATR || 4) * atrAt(i)).toFixed(dp);
                if (ns > open.stop) { open.stop = ns; open.trailMoved = true; }
                const lx = Math.min(...D.slice(i - xN, i).map((x) => x.low));
                if (b.close < lx && i === n - 1) { const R = +((price - open.entry) / open.r0).toFixed(2); open.status = R > 0 ? 'win' : R < 0 ? 'loss' : 'be'; open.R = R; open.closed = now; open.exit = `${xN}-day low`; }
              }
              open.lastD = b.time;
            }
            continue;
          }
          // v3 (5 Nov, owner "apply everything"): exit on a daily close under the ratcheting midpoint of the N-day channel (Zarattini,
          // Pagani & Barbon 2025); the 5 ATR stop stays fixed as a catastrophe stop. 4 coins, 0.8% costs, equal notional, daily equity:
          // Sharpe 2018-21 1.67 vs 1.50, 2022-26 0.81 vs 0.58; worst drawdown -28% vs -39% and -21% vs -27% (lab/crypto_ens2.py).
          const hi = hiN(S.sys), id = `${key}-${S.id}-${last.time}`;
          const midNow = (hi + Math.min(...D.slice(n - 1 - S.sys, n - 1).map((b) => b.low))) / 2;
          if (last.close > hi && (sh || !stopped) && !trades.some((x) => x.id === id) && now - (last.time + 86400) < 86400) {
            const entry = +price.toFixed(dp), stop = +(entry - S.k * A).toFixed(dp), r0 = entry - stop;
            if (r0 > 0) trades.push({ id, market: key, label: M.label, dec: M.dec, k: 'trend', sys: S.sys, kATR: S.k, name: 'Crypto trend', pair: `D1 ${S.sys}-day breakout`, h: '1d', side: 'buy',
              entry, stop, t1: +(entry * 100).toFixed(2), rr: 99, trail: [1e6, 0], buf: CFG.buf, opened: now, filled: now, checked: now, status: 'open', R: null, r0, noBe: true, entryMode: 'market', lastD: last.time, best: last.close, drift: driftR('buy', last.close, entry, stop), exitRule: 'mid', midStop: +midNow.toFixed(dp),
              feat: { hi: +hi.toFixed(4), atr: +A.toFixed(4) }, shadow: sh, blockedBy: sh ? ['owner-shadow'] : [],
              feed: FEED, note: `Crypto trend: daily close ${last.close} above the ${S.sys}-day high ${+hi.toFixed(4)}. Buy at market, catastrophe stop ${S.k} ATR below (${stop}); out on a daily close under the ${S.sys}-day channel midpoint (now ${+midNow.toFixed(dp)}), which only ratchets up.` });
          }
        }
        const openT = trades.filter((x) => x.k === 'trend' && x.market === key && x.status === 'open');
        (snapshot.trend = snapshot.trend || {})[key] = { label: M.label, close: last.close, hi55: +hi55.toFixed(4), hi100: +hiN(100).toFixed(4), lo27: +lo27.toFixed(4), atr: +A.toFixed(4), open: openT.length > 0, nOpen: openT.length,
          stop: openT.length ? Math.max(...openT.map((x) => x.stop)) : null, midStop: openT.length ? Math.max(...openT.map((x) => x.midStop || 0)) || null : null, toBreakout: +((hi55 / price - 1) * 100).toFixed(2), n: mine.filter((x) => x.R != null).length, R: +fwdR.toFixed(2), stopped, shadow: sh };
      } catch (e) { snapshot.errors.trend = String(e.message || e); }
    }
    // Gold trend (5 Nov, user rule gold-trend): daily close above the prior N daily highs -> long at market on the next run; stop k x ATR(D1,14)
    // below, lifted to (daily close - k ATR) on each closed day (chandelier); no target, no time limit. Spot gold 2019-26: +0.31 | +1.07 | +2.42R a
    // trade (2019-22 | 2023-24 | 2025-26), shorts lose in every period, so long only. The general loop manages the stop hit.
    // Gold trend fast (7 Nov, user rule gold-trend-fast): the same rule on the prior 5 daily highs runs as its own leg (k 'gtrend5')
    for (const LEG of [{ cfg: config.goldTrend, k: 'gtrend', name: 'Gold trend', snap: 'goldTrend' }, { cfg: config.goldTrendFast, k: 'gtrend5', name: 'Gold trend fast', snap: 'goldTrendFast' }]) if (key === 'xau' && LEG.cfg) {
      try {
        const GT = LEG.cfg, D = src['1d'].bars.slice(0, -1), n = D.length, last = D[n - 1], dp = Math.max(2, (M.dec ?? 2) + 1);
        const tr14 = (i) => Math.max(D[i].high - D[i].low, Math.abs(D[i].high - D[i - 1].close), Math.abs(D[i].low - D[i - 1].close));
        const atr14 = (i) => { let a = 0; for (let j = i - 13; j <= i; j++) a += tr14(j); return a / 14; };
        // gold-trend-fast-shadow (owner, 7 Nov): the fast leg's new trades are shadow (blockedBy owner-shadow) and still managed here
        // forward-test protocol (owner, 12 Nov 2026): a crossed stop line puts gtrend in config.ownerShadow (stopSwitch): new trades shadow
        const sh = (LEG.k === 'gtrend5' && !!config.goldTrendFastShadow) || ownerSh(LEG.k);
        const open = trades.find((x) => x.k === LEG.k && x.market === key && (!x.shadow || (x.blockedBy || []).includes('owner-shadow')) && x.status === 'open');
        if (n > GT.n + 15) {
          if (open) {
            // one ratchet per newly closed daily candle
            const gAdd = trades.find((x) => x.addOf === open.id && x.status === 'open');
            if (last.time > (open.lastD || 0)) { const ns = +(last.close - GT.k * atr14(n - 1)).toFixed(dp); if (ns > open.stop) { open.stop = ns; open.trailMoved = true; } if (gAdd && ns > gAdd.stop) { gAdd.stop = ns; gAdd.trailMoved = true; } open.lastD = last.time;
              // gold-trend-add (6 Nov): one add at market when a closed daily candle is +atR R above the entry; same stop, exits with the first unit
              if (config.goldTrendAdd && !gAdd && !trades.some((x) => x.addOf === open.id) && last.close - (open.entry + (open.feedBasis || 0)) >= config.goldTrendAdd.atR * open.r0) {
                const ae = +price.toFixed(dp), rA = ae - open.stop;
                if (rA > 0) trades.push({ id: `${open.id}-add`, market: key, label: M.label, dec: M.dec, k: LEG.k, name: `${LEG.name} add`, pair: open.pair, h: '1d', side: 'buy',
                  entry: ae, stop: open.stop, t1: +(ae * 100).toFixed(2), rr: 99, trail: [1e6, 0], size: 1, buf: CFG.buf, opened: now, filled: now, checked: now, status: 'open', R: null, r0: rA, noBe: true, entryMode: 'market', addOf: open.id, shadow: !!open.shadow, blockedBy: open.shadow ? ['owner-shadow'] : [],
                  feed: FEED, note: `${LEG.name} add: daily close ${last.close} is +${config.goldTrendAdd.atR}R above the first entry ${open.entry}, so a second unit buys ${ae} with the same stop ${open.stop}; the stop keeps rising with the daily closes; out with the first unit.` });
              } }
          } else {
            const hi = Math.max(...D.slice(n - 1 - GT.n, n - 1).map((b) => b.high)), A = atr14(n - 1), id = `${key}-${LEG.k}-${last.time}`;
            if (last.close > hi && A > 0 && !trades.some((x) => x.id === id) && now - (last.time + 86400) < 86400) {
              const entry = +price.toFixed(dp), stop = +(entry - GT.k * A).toFixed(dp), r0 = entry - stop;
              if (r0 > 0) trades.push({ id, market: key, label: M.label, dec: M.dec, k: LEG.k, name: LEG.name, pair: `D1 ${GT.n}-day breakout`, h: '1d', side: 'buy',
                entry, stop, t1: +(entry * 100).toFixed(2), rr: 99, trail: [1e6, 0], buf: CFG.buf, opened: now, filled: now, checked: now, status: 'open', R: null, r0, noBe: true, entryMode: 'market', lastD: last.time, drift: driftR('buy', last.close, entry, stop),
                feat: { hi: +hi.toFixed(2), atr: +A.toFixed(2) }, shadow: sh, blockedBy: sh ? ['owner-shadow'] : [],
                feed: FEED, note: `${LEG.name}: daily close ${last.close} above the ${GT.n}-day high ${hi.toFixed(2)}. Buy at market, stop ${GT.k} x ATR(D1) below (${stop}); the stop rises to (daily close - ${GT.k} ATR) on every closed day; no target.` });
            }
          }
        }
        (snapshot[LEG.snap] = snapshot[LEG.snap] || {}).state = { hi20: n > GT.n ? +Math.max(...D.slice(n - 1 - GT.n, n - 1).map((b) => b.high)).toFixed(2) : null, lastClose: last && last.close, open: !!open, stop: open ? open.stop : null };
      } catch (e) { snapshot.errors[LEG.snap] = String(e.message || e); }
    }
    // LIT paper shadow stream (owner, 8 Nov; user rule lit-shadow): the pre-registered primary of research/edge/lit, forward on gold.
    // council/lit.mjs is the detector (a parity-tested port of the study's harness) and the gates (one order at a time, <= 1 London +
    // 1 NY_AM fill a day, stop after a win or -1.5R). The records are pending limits at the order block's open with the study's stop
    // and target, managed by the loop above (validFor 24 M5 bars, maxHold to 17:00 New York, re-stamped from the fill); the swing
    // break-even moves the stop here, like the gold trend ratchet. Lookback: the stream needs the whole previous trading week (the
    // previous-week level, the weekly range), so it reads ~4,000 closed 5m candles from the OANDA proxy once a round, only here.
    // Every record is shadow: true, blockedBy ['owner-shadow'] (never live, never alerted, not in the futures bridge or the Systems card).
    if (key === 'xau' && config.litShadow && feed === 'OANDA') {
      try {
        const raw = await oandaBars(key, '5m', LIT_BARS);
        if (!raw) throw new Error('LIT: OANDA 5m lookback not read this round');
        const bars = litClean(raw.filter((b) => !b.live && b.time + 300 <= now));
        const recs = trades.filter((x) => x.k === LIT_K && x.market === key);
        const st = litStep({ bars, recs, now, key, label: M.label, dec: M.dec, feed: FEED });
        for (const rec of st.push) if (rec.shadow === true && (rec.blockedBy || []).includes('owner-shadow')) trades.push(rec);
        snapshot.lit = { at: nowISO, bars: st.m5, m15: st.m15, last: st.last, orders: st.orders, placed: st.push.map((x) => x.id), skipped: st.skipped, held: st.held, be: st.be, funnel: st.funnel, build: st.build,
          open: recs.filter((x) => x.status === 'open').length, pending: recs.filter((x) => x.status === 'pending').length + st.push.length };
      } catch (e) { snapshot.errors.lit = String(e.message || e); }
    }
    if (key === 'xau' && config.goldTL) {
      try {
        const TL = config.goldTL, H = src['4h'].bars.slice(0, -1), D = src['1d'].bars.slice(0, -1), n = H.length, last = H[n - 1], dp = Math.max(2, (M.dec ?? 2) + 1);
        // supported-book (owner, 11 Nov): new trendline trades are paper shadows (blockedBy owner-shadow), one position as before
        const tlSh = ownerSh('gtl'), open = trades.find((x) => x.k === 'gtl' && x.market === key && ownStream(x) && (x.status === 'open' || x.status === 'pending'));
        // confirmed H4 pivot highs (half-width TL.n); the line runs through the last two when the second is lower
        const piv = []; for (let i = TL.n; i < n - TL.n; i++) { let ok = true; for (let k = i - TL.n; k <= i + TL.n && ok; k++) if (k !== i && H[k].high >= H[i].high) ok = false; if (ok) piv.push([i, H[i].high]); }
        let state = { line: null };
        if (piv.length >= 2) {
          const [a, pa] = piv[piv.length - 2], [b, pb] = piv[piv.length - 1];
          if (pb < pa && b - a <= TL.span && n - 1 > b + TL.n) {
            const slope = (pb - pa) / (b - a), lv = pa + slope * (n - 1 - a), id = `${key}-gtl-${H[a].time}-${H[b].time}`;
            state = { line: +lv.toFixed(2), a: H[a].time, b: H[b].time, lastClose: last.close, traded: trades.some((x) => x.id === id) };
            if (!open && last.close > lv && !state.traded && now - (last.time + 14400) < 3600) {
              const dir = msnrDirection(H, D, TL.n4, 2); state.dir = dir;
              if (dir === 1) {
                const entry = +price.toFixed(dp), lo = Math.min(...H.slice(b).map((x) => x.low)), stop = +(lo - TL.pad).toFixed(dp), r0 = entry - stop;
                if (r0 > 0) trades.push({ id, market: key, label: M.label, dec: M.dec, k: 'gtl', name: 'Gold H4 trendline', pair: 'H4 trendline break', h: '4h', side: 'buy',
                  entry, stop, t1: +(entry + 10 * r0).toFixed(dp), tp1: +(entry + 2 * r0).toFixed(dp), rr: 10, trail: [2, 1], buf: CFG.buf, opened: now, filled: now, checked: now, status: 'open', R: null, r0, maxHold: TL.hold * 3600, noBe: true, entryMode: 'market', drift: driftR('buy', last.close, entry, stop),
                  feat: { line: +lv.toFixed(2), anchors: [+pa.toFixed(2), +pb.toFixed(2)], lo: +lo.toFixed(2) }, shadow: tlSh, blockedBy: tlSh ? ['owner-shadow'] : [],
                  feed: FEED, note: `Gold H4 trendline: H4 close ${last.close} above the falling line ${lv.toFixed(2)} through the pivot highs ${pa.toFixed(2)} and ${pb.toFixed(2)}, H4 direction up (Malaysian SnR SOP). Buy at market, stop ${stop} under the low since the second anchor; after +2R (${(entry + 2 * r0).toFixed(2)}) the stop trails 1R behind the best price (cap 10R); out after ${TL.hold} h.` });
              } else { state.blocked = 'direction'; }
            }
          }
        }
        (snapshot.goldTL = snapshot.goldTL || {}).state = { ...state, open: !!open, stop: open ? open.stop : null, ...(tlSh ? { shadow: true } : {}) };
      } catch (e) { snapshot.errors.goldTL = String(e.message || e); }
    }
    if (key === 'xau' && config.goldEG) {
      try {
        // trading days (owner, 12 Nov 2026, fidelity fix, item 52; research/edge/gold-weekend): closed UTC days, the Sunday reopen stub
        // (and any Saturday / Sunday candle) folded into the next weekday; a signal is fresh for 24 h from the reopen after its day
        const EG = config.goldEG, D = foldWeekend(src['1d'].bars.filter((b) => b.time + 86400 <= now)), n = D.length, last = D[n - 1], dp = Math.max(2, (M.dec ?? 2) + 1);
        // forward-test protocol (owner, 12 Nov 2026): a crossed stop line puts geg in config.ownerShadow (stopSwitch): new orders are paper
        // shadows; the system's own orders (live, or shadow by the owner) keep the zone cancel and the cap as one stream
        const egSh = ownerSh('geg'), mine = trades.filter((x) => x.k === 'geg' && x.market === key && ownStream(x));
        // cancel waiting orders whose zone was body-closed through (EF) on a newly closed day
        for (const tr of mine.filter((x) => x.status === 'pending')) if (tr.zone && last.time > (tr.lastD || 0) && last.close < tr.zone[0]) { tr.status = 'expired'; tr.closed = now; tr.R = 0; tr.exit = 'zone failed'; }
        for (const tr of mine.filter((x) => x.status === 'pending')) tr.lastD = last.time;
        let state = { lastClose: last && last.close };
        if (n > EG.sma + EG.k + 2) {
          const sma = D.slice(n - EG.sma).reduce((a, b) => a + b.close, 0) / EG.sma, up = last.close > sma; state.sma = +sma.toFixed(2); state.up = up;
          // the newly closed candle as the confirming candle: green, closing above the HIGH of a red base candle within k candles, no opposite candle in between
          let base = null;
          if (last.close > last.open) for (let j = n - 2; j >= n - 1 - EG.k && j >= 0; j--) { const b = D[j]; if (b.open > b.close) { if (last.close > b.high) base = b; break; } if (b.close < b.open) break; }
          state.zone = base ? [base.low, base.high] : null;
          const id = base ? `${key}-geg-${base.time}` : null;
          const openCnt = mine.filter((x) => x.status === 'open' || x.status === 'pending').length;
          if (base && up && !trades.some((x) => x.id === id) && gegFresh(last.time, now) && openCnt < EG.maxOpen) {
            const entry = +base.high.toFixed(dp), stop = +(base.low - EG.pad).toFixed(dp), r0 = entry - stop;
            if (r0 > 0 && price > entry) trades.push({ id, market: key, label: M.label, dec: M.dec, k: 'geg', name: 'Gold daily engulf', pair: 'D1 engulf zone', h: '1d', side: 'buy',
              entry, stop, t1: +(entry + 10 * r0).toFixed(dp), tp1: +(entry + 2 * r0).toFixed(dp), rr: 10, trail: [2, 1], buf: CFG.buf, opened: now, checked: now, status: 'pending', R: null, r0, validFor: EG.life * 86400, maxHold: EG.hold * 3600, noBe: true, entryMode: 'limit',
              zone: [+base.low.toFixed(dp), +base.high.toFixed(dp)], lastD: last.time, feat: { sma: +sma.toFixed(2), conf: last.close }, shadow: egSh, blockedBy: egSh ? ['owner-shadow'] : [],
              feed: FEED, note: `Gold daily engulf: daily close ${last.close} above the high ${base.high} of the red candle of ${new Date(base.time * 1000).toISOString().slice(0, 10)} (zone ${base.low}-${base.high}), close above the ${EG.sma}-day average ${sma.toFixed(2)}. Limit buy at the zone high ${entry} for ${EG.life} days (cancelled by a daily close under ${base.low}); stop ${stop}; after +2R (${(entry + 2 * r0).toFixed(2)}) the stop trails 1R behind the best price (cap 10R); out ${EG.hold / 24} days after the fill.` });
          } else if (base && !up) state.blocked = 'below 20-day average';
        }
        (snapshot.goldEG = snapshot.goldEG || {}).state = { ...state, pending: mine.filter((x) => x.status === 'pending').map((x) => x.entry), open: mine.filter((x) => x.status === 'open').length };
      } catch (e) { snapshot.errors.goldEG = String(e.message || e); }
    }
    if (key === 'xau' && config.goldMP) {
      try {
        const MP = config.goldMP, H = src['1h'].bars.slice(0, -1), B5 = src['5m'].bars.slice(0, -1), D = src['1d'].bars.slice(0, -1), n = H.length, dp = Math.max(2, (M.dec ?? 2) + 1);
        const sma = D.length >= 20 ? D.slice(-20).reduce((a, b) => a + b.close, 0) / 20 : null, dDir = sma == null ? 0 : (D[D.length - 1].close > sma ? 1 : -1);
        const W = (state.goldMP = state.goldMP || { watch: [] });
        // 1. a new momentum H1 candle → a watch (zone, stop, side), kept in state.json until it triggers, stops out or expires
        if (n > 16) { const b = H[n - 1], tc = b.time + 3600, rg = b.high - b.low, avg = H.slice(n - 15, n - 1).reduce((a, x) => a + (x.high - x.low), 0) / 14, hr = new Date(tc * 1000).getUTCHours();
          if (rg >= MP.mult * avg && hr >= 7 && hr < 17 && !W.watch.some((w) => w.t === b.time) && now - tc < 2 * 3600) {
            const up = b.close > b.open && b.close - b.low >= MP.top * rg, dn = b.close < b.open && b.high - b.close >= MP.top * rg, d = up ? 1 : dn ? -1 : 0;
            if (d && d === dDir) W.watch.push(d > 0 ? { t: b.time, d, zhi: b.high - MP.z1 * rg, zlo: b.high - MP.z2 * rg, stop: b.low - 0.1, until: tc + MP.wait * 3600 } : { t: b.time, d, zlo: b.low + MP.z1 * rg, zhi: b.low + MP.z2 * rg, stop: b.high + 0.1, until: tc + MP.wait * 3600 });
          } }
        // 2. each watch: first closed M5 candle after the H1 close that trades into the zone and closes in the trade direction → market entry (if that close is recent)
        const keep = [];
        for (const w of W.watch) {
          let done = false;
          for (const c of B5) { if (c.time < w.t + 3600) continue; if (c.time + 300 > w.until) { done = true; break; }
            if (w.d > 0 ? c.low <= w.stop : c.high >= w.stop) { done = true; break; }
            const ok = w.d > 0 ? (c.low <= w.zhi && c.close > c.open && c.close >= w.zlo) : (c.high >= w.zlo && c.close < c.open && c.close <= w.zhi);
            if (ok) { done = true; const id = `${key}-gmp-${w.t}`;
              if (!trades.some((x) => x.id === id) && now - (c.time + 300) < 15 * 60) { const entry = +price.toFixed(dp), stop = +w.stop.toFixed(dp), r0 = Math.abs(entry - stop);
                if (r0 > 0.5 && (entry - stop) * w.d > 0) trades.push({ id, market: key, label: M.label, dec: M.dec, k: 'gmp', name: 'Gold momentum pullback', pair: 'H1 momentum → M5 pullback', h: '5m', side: w.d > 0 ? 'buy' : 'sell',
                  entry, stop, t1: +(entry + w.d * 10 * r0).toFixed(dp), tp1: +(entry + w.d * MP.k * r0).toFixed(dp), rr: 10, trail: [MP.k, 1], buf: CFG.buf, opened: now, filled: now, checked: now, status: 'open', R: null, r0, maxHold: 8 * 3600, noBe: true, entryMode: 'market', drift: driftR(w.d > 0 ? 'buy' : 'sell', c.close, entry, stop),
                  feat: { h1: w.t, zone: [+w.zlo.toFixed(2), +w.zhi.toFixed(2)], d1: dDir }, shadow: true, blockedBy: ['test'], test: true,   // owner 6 Nov: on test, tracked as a shadow trade labelled test
                  feed: FEED, note: `Gold momentum pullback: the H1 candle of ${new Date(w.t * 1000).toISOString().slice(11, 16)} UTC was a momentum candle with the 20-day trend; an M5 candle pulled back into ${w.zlo.toFixed(2)}-${w.zhi.toFixed(2)} and closed ${w.d > 0 ? 'up' : 'down'}. ${w.d > 0 ? 'Buy' : 'Sell'} at market, stop ${stop} beyond the H1 candle; after +${MP.k}R the stop trails 1R behind the best price (cap 10R); out after 8 h.` }); }
              break; } }
          if (!done && now < w.until) keep.push(w);
        }
        W.watch = keep.slice(-10);
        (snapshot.goldMP = snapshot.goldMP || {}).state = { d1: dDir, watching: W.watch.map((w) => ({ side: w.d > 0 ? 'buy' : 'sell', zone: [+w.zlo.toFixed(2), +w.zhi.toFixed(2)], until: w.until })), open: trades.filter((x) => x.k === 'gmp' && x.status === 'open').length, test: true };
      } catch (e) { snapshot.errors.goldMP = String(e.message || e); }
    }
    if (key === 'xau' && config.moshaBo) {
      const ev = (id, sec) => { const bb = src[id].bars; return src[id].A.events.filter((e) => e.breakIdx < bb.length - 1).map((e) => ({ t: bb[e.breakIdx].time + sec, dir: e.dir, level: e.level, top: e.top, bot: e.bot, flip: e.structure })); };
      try {
        const E3 = ev('15m', 900), E2 = ev('1h', 3600), E1 = ev('4h', 14400), e3 = E3.at(-1);
        const before = (E, t) => E.filter((e) => e.t <= t).at(-1);
        // weekly structure ("Father", user rule mosha-bo-weekly): Monday-aligned weeks built from about two years of daily candles,
        // swing size 3; the direction of the last weekly BO on a closed week. Research: that window replayed on spot gold 2019-26
        // kept +0.37R / +0.35R a trade (both halves) when it agrees, lost when it is against. The daily candles are spot gold
        // from CNBC (XAU=): PAXG's premium over spot drifts over the months, so its weekly swings break in other places (3 Nov:
        // spot closed the week through the weekly low, PAXG did not). CNBC matched the HistData spot weeks in 95 of 95 weeks
        // since January 2025. If CNBC fails, the market feed's daily candles stand in: OANDA spot since 7 Nov, else Kraken PAXG
        // (snapshot.goldW1Src says which: 'cnbc-spot', 'oanda' or 'paxg').
        let dly = src['1d'].bars;
        if (config.moshaBoWeekly) try {
          const ds = (t) => new Date(t * 1000).toISOString().slice(0, 10).replace(/-/g, '') + '000000';
          const r = await fetch(`https://ts-api.cnbc.com/harmony/app/bars/XAU=/1D/${ds(now - 720 * 86400)}/${ds(now + 86400)}/adjusted/EST5EDT.json`, { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
          const j = await r.json().catch(() => null), pb = (j && j.barData && j.barData.priceBars) || [];
          const cd = pb.map((b) => ({ time: Math.floor(+b.tradeTimeinMills / 86400000) * 86400, open: +b.open, high: +b.high, low: +b.low, close: +b.close })).filter((b) => [b.time, b.open, b.high, b.low, b.close].every((v) => isFinite(v) && v > 0));
          if (cd.length < 300) throw new Error(`CNBC XAU= daily: ${cd.length} candles (HTTP ${r.status})`);
          dly = cd.sort((a, b) => a.time - b.time); snapshot.goldW1Src = 'cnbc-spot';
        } catch (e) { snapshot.goldW1Src = feed === 'OANDA' ? 'oanda' : 'paxg'; snapshot.errors.goldW1 = String(e.message || e); }
        const wk = [];
        // Weeks run Monday 00:00 UTC. A feed's Sunday-dated candle (OANDA's 22:00 UTC Sunday open, Kraken's 24/7 day) is the
        // NEXT week's first session, not the previous week's last: folded backwards it moved the weekly close/low and flipped
        // the filter's fallback reading (gold-fidelity, 8 Nov: OANDA read bullish, CNBC spot bearish). CNBC has no Sunday bars.
        const weekOf = (t) => Math.floor((t + (new Date(t * 1000).getUTCDay() === 0 ? 86400 : 0) - 345600) / 604800) * 604800 + 345600;
        for (const b of dly) { const k = weekOf(b.time), c = wk.at(-1);
          if (!c || c.time !== k) wk.push({ time: k, open: b.open, high: b.high, low: b.low, close: b.close }); else { c.high = Math.max(c.high, b.high); c.low = Math.min(c.low, b.low); c.close = b.close; } }
        const wEv = msAnalyze(wk, 3).events.map((e) => ({ t: wk[e.breakIdx].time + 604800, dir: e.dir })).filter((e) => e.t <= now);
        const w1At = (t) => (before(wEv, t) || { dir: 0 }).dir;
        snapshot.goldW1 = w1At(now) || null;
        const okW = (e) => config.moshaBoWeekly ? w1At(e.t) === e.dir : e.flip;
        // where the chain stands now (status only, for the site): the last H4 BO, the H1 BO the other way after it, the M15 BO back
        snapshot.moshaBo = { state: { ...moshaChain(E1, E2, E3), w1: snapshot.goldW1, w1Src: snapshot.goldW1Src || null,
          open: trades.filter((x) => x.k === 'mosha-bo' && ownStream(x) && x.status === 'open').length, pending: trades.filter((x) => x.k === 'mosha-bo' && ownStream(x) && x.status === 'pending').length, ...(ownerSh('mosha-bo') ? { shadow: true } : {}) } };
        // 5 Nov (owner: record everything): a chain that fails the weekly filter, the 2-open cap or the price check is kept as a
        // shadow trade (managed the same way, not our system), so each filter's cost shows forward
        if (e3 && now - e3.t <= 3600) {
          const e2 = before(E2, e3.t), e1 = before(E1, e3.t), d = e3.dir, id = `xau-moshabo-${e3.t}`;
          if (e1 && e2 && e1.dir === d && e2.dir === -d && e2.t > e1.t && !trades.some((x) => x.id === id)) {
            const entry = +e3.level.toFixed(2), stop = +(d < 0 ? e3.top + 0.3 : e3.bot - 0.3).toFixed(2), r0 = Math.abs(entry - stop);
            const openBo = trades.filter((x) => x.k === 'mosha-bo' && ownStream(x) && (x.status === 'open' || x.status === 'pending')).length;
            // pull (5 Nov, forward-test field only): H1 bars from the VR extreme (the H1 leg's extreme after the H1 BO) to the M15 CF.
            // Research: on gold a slow pullback did better than a fast one in every period; since 6 Nov (mosha-slow) a pullback under config.moshaSlow H1 bars blocks the chain (shadow).
            let pull = null; try { const hb = src['1h'].bars, i2 = hb.findIndex((b) => b.time >= e2.t); let ext = d < 0 ? Infinity : -Infinity, iE = i2;
              for (let i = Math.max(0, i2); i < hb.length && hb[i].time < e3.t; i++) { if (d < 0 ? hb[i].low < ext : hb[i].high > ext) { ext = d < 0 ? hb[i].low : hb[i].high; iE = i; } }
              pull = i2 < 0 || !isFinite(ext) ? null : hb.filter((b) => b.time > hb[iE].time && b.time < e3.t).length; } catch (e) { pull = null; }
            const blk = [!okW(e3) && 'weekly', openBo >= 2 && 'cap', !(d < 0 ? price < stop : price > stop) && 'price', !!(config.moshaSlow && pull != null && pull < config.moshaSlow) && 'momentum', ownerSh('mosha-bo') && 'owner-shadow'].filter(Boolean);   // owner-shadow (11 Nov): every new chain is a paper shadow; alone in the list = the chain the rule takes
            if (r0 > 0.5) trades.push({ id, market: key, label: M.label, dec: M.dec, k: 'mosha-bo', name: 'Mosha BO system', pair: 'H4 → H1 → M15', h: '15m',
              side: d < 0 ? 'sell' : 'buy', entry, stop, t1: +(entry + d * 3 * r0).toFixed(2), rr: 3, buf: CFG.buf, opened: now, checked: now, status: 'pending', R: null, r0, validFor: 24 * 3600, maxHold: 72 * 3600, noBe: true, entryMode: 'limit',
              // mosha-add (5 Nov): breakeven and a second unit at +1.5R, after +3R trail 1R behind the best price (cap 10R)
              ...(config.moshaBeR ? { beAt: config.moshaBeR } : {}), ...(config.moshaAdd ? { addAt: config.moshaAdd.atR, addSize: config.moshaAdd.size } : {}),
              ...(config.moshaRun ? { t1: +(entry + d * 10 * r0).toFixed(2), rr: 10, tp1: +(entry + d * config.moshaRun.atR * r0).toFixed(2), trail: [config.moshaRun.atR, config.moshaRun.trail] } : {}),
              feat: { h4At: e1.t, h1At: e2.t, m15At: e3.t, w1: w1At(e3.t) === d ? 'with' : 'against', m15Flip: !!e3.flip, pull }, shadow: blk.length > 0, blockedBy: blk,
              feed: FEED, note: `Mosha BO system: ${config.moshaBoWeekly ? `weekly structure ${d < 0 ? 'bearish' : 'bullish'}, ` : ''}H4 BO ${d < 0 ? 'sell' : 'buy'}, then H1 BO ${d < 0 ? 'buy' : 'sell'} (retracement), then M15 BO ${d < 0 ? 'sell' : 'buy'} through ${entry}. Pullback limit at the broken M15 level ${entry}, stop past the M15 Origin ${stop}, ${config.moshaRun ? `from +${config.moshaRun.atR}R the stop trails ${config.moshaRun.trail}R behind the best price (cap 10R)` : `target 3R ${(entry + d * 3 * r0).toFixed(2)}`}; valid 24 h, out after 72 h.` });
          }
        }
      } catch (e) { snapshot.errors.moshaBo = String(e.message || e); }
    }
    // Mosha cycle (11 Nov 2026, owner; user rule mosha-cycle, council/mosha-cycle.mjs): H4 move, H1 ChoCh = the pullback starts,
    // M15 / M5 trade the pullback (target the H4 50%), then the M15 / M5 ChoCh back with H4 (target the H4 extreme). A main paper
    // system; a signal whose target is under 1R away, a second open trade of the same leg, or a limit already past its stop is a shadow,
    // and so is every new one while the owner lists 'mcycle' in config.ownerShadow (cycleBlockers; a trade already open stays live).
    if (key === 'xau' && config.moshaCycle) {
      const ev = (id, sec) => { const bb = src[id].bars; return src[id].A.events.filter((e) => e.breakIdx < bb.length - 1).map((e) => ({ t: bb[e.breakIdx].time + sec, dir: e.dir, level: e.level, top: e.top, bot: e.bot, flip: e.structure })); };
      try {
        const C = cycleTrades({ E4: ev('4h', 14400), E1: ev('1h', 3600), E15: ev('15m', 900), E5: ev('5m', 300), h1: src['1h'].bars.slice(0, -1) }, now);
        snapshot.moshaCycle = { state: C.state, text: cycleText(C.state), open: trades.filter((x) => x.k === 'mcycle' && ownStream(x) && (x.status === 'open' || x.status === 'pending')).length, ...(ownerSh('mcycle') ? { shadow: true } : {}) };
        for (const o of C.trades.filter((x) => x.fresh)) {
          const id = `xau-mcycle-${o.leg}-${o.h4.t}`; if (trades.some((x) => x.id === id)) continue;
          const d = o.side === 'sell' ? -1 : 1, blk = cycleBlockers(o, trades, price, ownerSh('mcycle'));   // owner-shadow (12 Nov): like Mosha BO; the cap reads the system's own stream
          const t1 = o.t1 != null && o.room ? o.t1 : +(o.entry + d * 2 * o.r0).toFixed(2);
          trades.push({ id, market: key, label: M.label, dec: M.dec, k: 'mcycle', name: o.leg === 'pull' ? 'Mosha cycle (pullback)' : 'Mosha cycle (main)', leg: o.leg,
            pair: `H4 → H1 ChoCh → ${o.tf === '5m' ? 'M5' : 'M15'}`, h: o.tf, side: o.side, entry: o.entry, stop: o.stop, t1, rr: o.room ? o.rr : 2, buf: 0.3,
            opened: now, checked: now, status: 'pending', R: null, r0: o.r0, validFor: 24 * 3600, maxHold: 72 * 3600, noBe: true, entryMode: 'limit',
            feat: { h4At: o.h4.t, chochAt: o.choch.t, trigAt: o.t, tf: o.tf, p50: o.p50, ext: o.ext, room: o.rr }, shadow: blk.length > 0, blockedBy: blk, feed: FEED,
            note: o.leg === 'pull'
              ? `Mosha cycle, pullback: H4 move ${d > 0 ? 'down' : 'up'} from ${o.h4.level}, H1 ChoCh at ${o.choch.level} (the pullback started), ${o.tf === '5m' ? 'M5' : 'M15'} BO ${o.side} through ${o.entry}. Limit at the broken level ${o.entry}, stop past its origin ${o.stop}, target the H4 50% ${o.p50} (${o.rr}R); valid 24 h, out after 72 h.`
              : `Mosha cycle, main: the pullback of the H4 move ${d < 0 ? 'down' : 'up'} is over: ${o.tf === '5m' ? 'M5' : 'M15'} ChoCh ${o.side} through ${o.entry} after the H1 ChoCh at ${o.choch.level}. Limit at the broken level ${o.entry}, stop past its origin ${o.stop}, target the H4 extreme ${o.ext} (${o.rr}R); valid 24 h, out after 72 h.` });
        }
      } catch (e) { snapshot.errors.moshaCycle = String(e.message || e); }
    }
    // volatility gate (4 Nov, user rule gold-vol-gate): 20-day average daily range as % of price, from the last 20 closed daily
    // bars. Since 5 Nov (gold-top-be) the fixed 1.5% leg (config.goldVolMin) is null and only the percentile gate below
    // (config.goldVolPct) decides; below the gate the replica's signals stay research (research/edge/param-drift).
    const dvb = src['1d'].bars.slice(-21, -1), volPct = dvb.length >= 15 ? dvb.reduce((a, b) => a + (b.high - b.low) / b.close * 100, 0) / dvb.length : null;
    if (key === 'xau') { snapshot.goldVol = volPct == null ? null : +volPct.toFixed(2); snapshot.goldVolMin = config.goldVolMin || null; }
    // pairs (4 Nov, user rule pairs-live): the gate is relative to each market's own history: today's 20-day range must be in the
    // top fifth (config.pairVolPct) of the 20-day ranges over its last 365 daily candles. Gold has its own percentile gate below.
    // A day's range counts at most 3x the median of the 20 days before it: a lone Kraken bad print (USD/CAD and USD/CHF, 3 Nov,
    // hundreds of pips for a minute) would otherwise inflate the 20-day range and open the gate. Gold keeps its raw ranges.
    let volGate = key === 'xau' ? config.goldVolMin || null : null, pairVol = volPct;
    if (key !== 'xau' && config.pairVolPct) {
      const db = src['1d'].bars.slice(0, -1), rr = db.map((b) => (b.high - b.low) / b.close * 100), cr = rr.slice(), ser = [];
      for (let i = 20; i < rr.length; i++) { const med = rr.slice(i - 20, i).sort((a, b) => a - b)[10]; cr[i] = Math.min(rr[i], 3 * med); }
      for (let i = 20; i <= cr.length; i++) ser.push(cr.slice(i - 20, i).reduce((a, v) => a + v, 0) / 20);
      pairVol = ser.length ? ser.at(-1) : null;
      const past = ser.slice(-367, -2).sort((a, b) => a - b);
      volGate = past.length >= 200 ? +past[Math.floor(config.pairVolPct / 100 * (past.length - 1))].toFixed(3) : Infinity;
    }
    // gold adaptive gate (5 Nov, user rule gold-adaptive-gate): live while the 20-day range is >= 1.5% OR in the top fifth
    // (config.goldVolPct) of gold's own 20-day ranges over the last 365 daily candles (raw ranges, as in the backtest).
    let goldP = null;
    if (key === 'xau' && config.goldVolPct) {
      const db = src['1d'].bars.slice(0, -1), rr = db.map((b) => (b.high - b.low) / b.close * 100), ser = [];
      for (let i = 20; i <= rr.length; i++) ser.push(rr.slice(i - 20, i).reduce((a, v) => a + v, 0) / 20);
      const past = ser.slice(-367, -2).sort((a, b) => a - b);
      goldP = past.length >= 200 ? +past[Math.floor(config.goldVolPct / 100 * (past.length - 1))].toFixed(3) : null;
      snapshot.goldVolP = goldP; snapshot.goldVolPn = past.length;
    }
    // gold gate: goldVolMin (fixed %) OR goldVolPct (own top fifth); since 5 Nov (gold-top-be) only the percentile leg is set
    const volOk = key === 'xau' ? (!config.goldVolMin && !config.goldVolPct) || (volPct != null && ((config.goldVolMin != null && volPct >= config.goldVolMin) || (goldP != null && volPct >= goldP))) : !config.pairVolPct || (pairVol != null && pairVol >= volGate);
    const pxr = (v) => +v.toFixed(Math.max(2, (M.dec ?? 2) + 1));   // price rounding by market (forex has 5 decimals)
    // pair kill switch (user rule pairs-live): a pair stops trading live once its live replica trades since the switch-on sum to
    // config.pairStopR (−10R); its signals stay research
    const pairLive = trades.filter((x) => x.k === 'replica' && x.market === key && ownStream(x) && x.R != null && x.closed && x.opened >= (config.pairsLiveAt || 0));
    const pairR = pairLive.reduce((a, x) => a + x.R, 0), pairStop = key !== 'xau' && config.pairStopR != null && pairR <= config.pairStopR;
    if (key !== 'xau') (snapshot.pairs = snapshot.pairs || {})[key] = { label: M.label, vol: pairVol == null ? null : +pairVol.toFixed(2), gate: isFinite(volGate) ? volGate : null, on: volOk && !pairStop && (config.replicaLive || []).includes(key), n: pairLive.length, R: +pairR.toFixed(2), stopped: pairStop };
    if (marketOpen(M, now)) {
      let sigs = []; try { sigs = replicaSignals(src); } catch (e) {}
      // closed H4 and D1 candles only (the last bar of each series is still forming)
      let msnrDir = 0; if (key === 'xau') try { msnrDir = msnrDirection(src['4h'].bars.slice(0, -1), src['1d'].bars.slice(0, -1)); } catch (e) { msnrDir = 0; }
      const msnrOf = (sell) => msnrDir === 0 ? 'none' : msnrDir === (sell ? -1 : 1) ? 'with' : 'against';
      for (const g of sigs) {
        const sig = `replica|${g.sell ? 's' : 'b'}|${g.tc}`;
        if (research.some((x) => x.market === key && x.sig === sig)) continue;
        // v2 (3 Nov): market entry at the CHoCH, target 2R; the filter = clear of live H1 Origins OR an M5 engulfing at the
        // extreme (150-day gold replay: +0.075R / +0.077R a trade in both halves, keeps all four of the trader's trades)
        const entry = price, buf = key === 'xau' ? Math.max(0.1 * g.atr, 0.3) : 0.1 * g.atr, stop0 = g.sell ? g.ext + buf : g.ext - buf, r00 = Math.abs(entry - stop0);
        if (!(r00 > 0) || (g.sell ? entry >= stop0 : entry <= stop0)) continue;
        // round-number stop (4 Nov, from the trader's XAUUSD price-action PDF and the New York Fed stop-cluster studies it cites):
        // a gold stop sitting within $2 in front of a $10 level moves to $0.50 past it, because stops cluster there and price
        // runs to the round number. Year replay of v5 + trailing (4 min entry lag): the 76 trades it changes gain +16.7R
        // (+0.22R each, paired t 1.8), both halves positive; every $10 setting tested ($1–3, 0.5–1.0 past) gains. The filter
        // below still judges the original stop, so the trades taken are unchanged.
        let stop = stop0;
        if (key === 'xau') { const rn = g.sell ? Math.ceil(stop0 / 10) * 10 : Math.floor(stop0 / 10) * 10; if (Math.abs(stop0 - rn) <= 2) stop = g.sell ? rn + 0.5 : rn - 0.5; }
        const r0 = Math.abs(entry - stop);
        const h1live = src['1h'].A.events.filter((e) => e.endIdx == null && e.top > e.bot), h1clear = !h1live.some((e) => entry <= e.top && entry >= e.bot);
        // v3: pass = clear of H1 Origins or the platform's ★ engulfing at the extreme; star = the ★ engulfing alone
        // v4: and a stop of at least one M15 ATR (tighter stops sit inside M15 noise: −0.04R / −0.13R a trade on the replay)
        const riskAtr = r00 / g.atr, pass = (h1clear || g.star) && riskAtr >= 1, t1 = entry + (g.sell ? -2 : 2) * r0;
        // v5 (4 Nov): live only against the H4 trend (Mosha N=6). Year replay with this code: v4 +81.5R over 1,020 trades (Jan-May
        // −11.2R), v5 +74.8R over 500 (Jan-May +26.2R), 9 of 11 months positive, max drawdown −23.6R vs −29.9R. The H4 split was
        // logged as a candidate on Jun-Nov data before Jan-May existed, so Jan-May is its out-of-sample test.
        // latency (4 Nov): entries come about 4 min after the CHoCH candle closes. Year replay of v5 + trailing + 0.30 spread: on time
        // +0.20R a trade, 4–5 min late +0.19–0.20R (+0.16R with 0.2 slippage), 8 min +0.17R, 10 min +0.14R. A limit order back at the
        // signal close was worse (+0.08R: it fills the losers). Live entries more than 8 min late are skipped (kept as research).
        const lag = now - g.tc - 300, stale = lag > 480;
        const drift = driftR(g.sell ? 'sell' : 'buy', g.cc, entry, stop0);   // stale-signal shadow stat (8 Nov): price vs the CHoCH close, in R
        const h4 = src['4h'].A.trend === (g.sell ? 1 : -1) ? 'against' : src['4h'].A.trend === (g.sell ? -1 : 1) ? 'with' : 'none', v5 = pass && h4 === 'against';
        research.push({ id: `${key}-replica-${now}-${g.sell ? 's' : 'b'}`, sig, market: key, label: M.label, dec: M.dec, k: 'replica', name: key === 'xau' ? 'Gold replica' : `${M.label} replica`, lag, side: g.sell ? 'sell' : 'buy',
          entry: pxr(entry), stop: pxr(stop), stop0: pxr(stop0), t1: pxr(t1), rr: 2, opened: now, filled: now, checked: now, status: 'open', R: null, v: 5, drift,
          pass, v5, h4, h1clear, msnr: msnrOf(g.sell), eg: g.eg, peg: g.peg, star: g.star, riskAtr: +riskAtr.toFixed(2), legStart: +g.start.toFixed(2), leg: g.L === 36 ? '3h' : '6h', ext: +g.ext.toFixed(2), chochLevel: +g.lvl.toFixed(2), d1: src['1d'].A.trend === (g.sell ? -1 : 1) ? 'with' : 'against', session: sessionOf(now),
          feed: FEED, note: `Research (paper only): gold replica v5${!pass ? '' : h4 !== 'against' ? ' (v4 passes; v5 skips it: H4 trend not against the trade)' : ''}${pass ? '' : riskAtr < 1 ? ' (filter fails: stop under one M15 ATR)' : ' (filter fails: inside a live H1 Origin, no ★ engulfing)'}. ${g.L === 36 ? '3 h' : '6 h'} leg to ${g.ext.toFixed(2)}, M5 CHoCH through ${g.lvl.toFixed(2)}${g.star ? ', ★ engulfing at structure at the extreme' : g.peg ? ', engulfing at the extreme (not at a level)' : ''}${h1clear ? ', clear of H1 Origins' : ''}; ${g.sell ? 'sell' : 'buy'} ${entry.toFixed(2)}, stop ${stop.toFixed(2)}, target 2R ${t1.toFixed(2)}.` });
        // live (config.replicaLive): every passing signal also trades on the live book, as on the replay (no slot limit),
        // at market, 2R target, out after 48 h, no break-even move
        // exit v2 (4 Nov, night): once +2R the stop trails 2R behind the best price (was +1.5R / 1R). 8-year spot gold, 1.5% gate,
        // risk rules: 2019-22 +13.8R -> +44.8R, 2023-26 +47.3R -> +87.4R; every wider setting tried (2-3R start, 2-3R behind,
        // 48-144 h) beat 1.5/1.0 in both halves, and the best on 2019-22 alone also beat it on 2023-26 (walk-forward).
        // exit v1 (4 Nov): no fixed 2R target; once +1.5R the stop trails 1R behind the best price (cap 10R, out after 48 h). Year replay
        // of v5: 2R +74.8R (Jan-Jun +0.08R / Jun-Nov +0.22R a trade) vs trailing +98.7R (+0.17R / +0.23R); every nearby setting beat 2R
        // risk cap (4 Nov): at most 3 replica trades open at once (3R at risk). Year replay: +101.5R vs +98.7R uncapped, both halves
        // slightly better, worst drawdown −20.8R vs −21.8R. A daily −2R stop was tested and rejected (−4.4R a year: the skipped trades won).
        const capped = trades.filter((x) => x.k === 'replica' && x.market === key && ownStream(x) && x.status === 'open' && !x.addOf).length >= 3;   // ownStream: the replica's own trades, live or (since 11 Nov) owner-shadow, so its risk rules keep reading its own record
        // risk (4 Nov, year replay: drawdown −20.8R → −14.2R, worst month −14.1R → −8.4R, profit +101.5R → +91.2R, both halves):
        // daily stop: no new replica trade once today's closed replica trades reach −1.5R (UTC day);
        // equity filter: half size while the replica's equity is below its own 50-trade average (seeded with the replay history)
        const liveRp = trades.filter((x) => x.k === 'replica' && x.market === key && ownStream(x) && x.R != null && x.closed);
        const dayR = liveRp.filter((x) => Math.floor(x.closed / 86400) === Math.floor(now / 86400)).reduce((a, x) => a + x.R, 0), dayStop = dayR <= -1.5;
        let size = 1;
        { const hist = rd('research/replay-2w.json', { trades: [] }).trades.filter((x) => x.market === key && x.k === 'replica' && x.R != null && x.closed < (liveRp.length ? Math.min(...liveRp.map((y) => y.opened)) : Infinity))
            .concat(liveRp.map((x) => ({ R: x.rawR != null ? x.rawR : x.R, closed: x.closed }))).sort((a, b) => a.closed - b.closed);
          if (hist.length > 50) { let e = 0; const eq = hist.map((x) => (e += x.R)); const avg = eq.slice(-50).reduce((a, v) => a + v, 0) / 50; if (eq.at(-1) < avg) size = 0.5; } }
        // replica-msnr-size (6 Nov): 1.5x while the H4 Malaysian SnR direction is still against the trade (pullback phase), 0.5x when it agrees
        if (key === 'xau' && config.replicaMsnrSize) { const m = msnrOf(g.sell); if (m === 'against') size *= config.replicaMsnrSize.against; else if (m === 'with') size *= config.replicaMsnrSize.with; }
        if (v5 && capped) research.at(-1).capped = true;
        if (v5 && dayStop) research.at(-1).dayStop = true;
        if (v5 && stale) research.at(-1).stale = true;
        if (volPct != null) research.at(-1).vol = +(key === 'xau' ? volPct : pairVol).toFixed(2);
        if (key !== 'xau' && isFinite(volGate)) research.at(-1).gate = volGate;
        if (v5 && !volOk) research.at(-1).calm = true;
        const d1w = src['1d'].A.trend === (g.sell ? -1 : 1);
        const egTol = key === 'xau' ? 1 : 0.1 * g.atr;   // $1 on gold; a tenth of an M15 ATR elsewhere
        let atEG = false; try { atEG = h1EgZones(src['1h'].bars.slice(0, -1).slice(-300)).some((q) => q.d === (g.sell ? -1 : 1) && stop0 >= q.bot - egTol && stop0 <= q.top + egTol); } catch (e) {}
        research.at(-1).atEG = atEG;
        const dirOk = !config.goldD1With || d1w || (config.goldEgBarrier && atEG);
        // gold-news-veto (5 Nov): no new gold replica entry inside the US 08:30 ET data window (08:25-08:45 ET, weekdays); the signal
        // is still recorded as research with news: true
        const nyNow = nyParts(now), newsVeto = key === 'xau' && !!config.goldNewsVeto && !['Sat', 'Sun'].includes(nyNow.wd) && config.goldNewsVeto.some(([a, b]) => nyNow.m >= a && nyNow.m <= b);
        if (v5 && newsVeto) research.at(-1).news = true;
        if (v5 && !dirOk) research.at(-1).d1Skip = true;
        if (v5 && pairStop) research.at(-1).pairStop = true;
        if (v5 && volOk && dirOk && !capped && !dayStop && !stale && !pairStop && !newsVeto && (config.replicaLive || []).includes(key)) trades.push({ id: `${key}-replica-${now}-${g.sell ? 's' : 'b'}`, market: key, label: M.label, dec: M.dec, k: 'replica', name: 'Replica', pair: 'M5 CHoCH', h: '5m', side: g.sell ? 'sell' : 'buy',
          entry: pxr(entry), stop: pxr(stop), t1: pxr(entry + (g.sell ? -10 : 10) * r0), tp1: pxr(t1), rr: 10, trail: [2.0, 2.0], size, buf: CFG.buf, opened: now, filled: now, checked: now, status: 'open', R: null, r0: Math.abs(pxr(entry) - pxr(stop)), maxHold: 48 * 3600, noBe: true, entryMode: 'market', lag, drift,
          ...(key === 'xau' && config.goldFixedR ? { t1: pxr(entry + (g.sell ? -1 : 1) * config.goldFixedR * Math.abs(pxr(entry) - pxr(stop))), rr: config.goldFixedR, trail: undefined, tp1: undefined } : {}),
          ...(key === 'xau' && config.goldBeR ? { beAt: config.goldBeR } : {}),
          // gold-add (5 Nov): after +goldRun.atR R the whole position trails goldRun.trail R behind the best price (cap 10R) instead of
          // a fixed target; at +goldAdd.atR R a second unit of goldAdd.size opens at market with the stop at this entry (see the loop)
          ...(key === 'xau' && config.goldRun ? { t1: pxr(entry + (g.sell ? -10 : 10) * Math.abs(pxr(entry) - pxr(stop))), rr: 10, trail: [config.goldRun.atR, config.goldRun.trail], runAfter: config.goldRun.atR } : {}),
          ...(key === 'xau' && config.goldAdd ? { addAt: config.goldAdd.atR, addSize: config.goldAdd.size } : {}),
          feat: { d1: src['1d'].A.trend === (g.sell ? -1 : 1) ? 'with' : 'against', h4, msnr: msnrOf(g.sell), session: sessionOf(now), star: g.star, h1clear, riskAtr: +riskAtr.toFixed(2), leg: g.L === 36 ? '3h' : '6h' }, shadow: ownerSh('replica'), blockedBy: ownerSh('replica') ? ['owner-shadow'] : [],   // supported-book (owner, 11 Nov): a paper shadow, same rule
          feed: FEED, note: `${key === 'xau' ? 'Gold' : M.label} replica (v5, against the H4 trend): ${g.L === 36 ? '3 h' : '6 h'} leg to ${g.ext.toFixed(2)}, M5 CHoCH through ${g.lvl.toFixed(2)}${g.star ? ', ★ engulfing at structure at the extreme' : g.peg ? ', engulfing at the extreme' : ''}${h1clear ? ', clear of H1 Origins' : ''}. ${g.sell ? 'Sell' : 'Buy'} at market, stop past the extreme; ${key === 'xau' && config.goldFixedR ? `${config.goldRun ? `after +${config.goldRun.atR}R the stop trails ${config.goldRun.trail}R behind the best price (cap 10R)` : `fixed target ${config.goldFixedR}R`}${config.goldBeR ? `, stop to breakeven at +${config.goldBeR}R` : ''}${config.goldAdd ? `, a second unit added at +${config.goldAdd.atR}R` : ''}` : `from +2R the stop trails 2R behind the best price (2R mark ${t1.toFixed(2)})`}, out after 48 h.` });
      }
    }
    for (const r of research.filter((x) => x.market === key && x.k !== 'replica' && x.status === 'open')) {
      const bars = (src['1m'].bars[0].time <= r.checked ? src['1m'] : src['5m'].bars[0].time <= r.checked ? src['5m'] : src['15m']).bars;
      const s = r.side === 'sell', r0 = Math.abs(r.entry - r.stop);
      for (const b of bars) {
        if (b.time < r.checked) continue;
        if (M.group !== 'Crypto' && spotSkip(b.time)) continue;   // 8 Nov: spot shut (weekend / rollover) decides nothing, as live
        if (s ? b.high >= r.stop : b.low <= r.stop) { const px = stopFill(b, s, r.stop, b.time > (r.filled || r.opened)); r.status = 'loss'; r.R = px === r.stop ? -1 : exitR(s, r.entry, px, r0); r.closed = b.time; break; }
        if (s ? b.low <= r.t1 : b.high >= r.t1) { r.status = 'win'; r.R = +((Math.abs(r.t1 - r.entry)) / r0).toFixed(2); r.closed = b.time; break; }
        if (b.time >= r.closeBy) { const R = +((s ? r.entry - b.close : b.close - r.entry) / r0).toFixed(2); r.status = R > 0 ? 'win' : R < 0 ? 'loss' : 'be'; r.R = R; r.closed = b.time; r.exit = r.exitLabel || '8 h'; break; }
      }
      r.checked = bars.at(-1).time;
    }
    if (M.group === 'Crypto') {
      let cyc = null; try { cyc = dailyCycle(src, price, now); } catch (e) {}
      if (cyc && !research.some((x) => x.market === key && x.k === 'cycle' && x.day === cyc.day)) {
        research.push({ id: `${key}-cycle-${now}`, market: key, label: M.label, dec: M.dec, k: 'cycle', name: 'Daily Cycle', side: cyc.sell ? 'sell' : 'buy',
          entry: cyc.entry, stop: cyc.stop, t1: cyc.t1, rr: 3, opened: now, filled: now, checked: now, status: 'open', R: null, closeBy: cyc.closeBy, day: cyc.day,
          londonHigh: cyc.londonHigh, londonLow: cyc.londonLow, d1: src['1d'].A.trend === (cyc.sell ? -1 : 1) ? 'with' : 'against',
          feed: FEED, note: `Research (paper only): London ${cyc.sell ? 'sold off' : 'rallied'} ${cyc.londonLow.toFixed(M.dec)}–${cyc.londonHigh.toFixed(M.dec)}; NY-open retracement into the 62–70% zone. Target 3R, out at 21:00 UTC.` });
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
      // Swing D1 ADX tag (paper sleeve "swing-adx", research/edge/regime): ADX(14) of the last closed daily candle and whether it sits
      // in the 19.4-29.2 band. A tag only: no filter, focus or Coach step reads it, so it changes no trade decision.
      if (t.k === 'swing') { try { Object.assign(feat, d1AdxFeat(src['1d'].bars, now)); } catch (e) {} }
      // News research tag (research/news-filter.md, paper only): tier-1 US release (CPI/NFP/FOMC/PCE) within +-120 min and the minutes to it.
      // A tag only: no filter, focus, guard or Coach step reads it, so it changes no trade decision.
      try { Object.assign(feat, newsFeat(now)); } catch (e) {}
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
      if (config.focus && config.focus.length && !config.focus.includes(key) && !(config.focusSetups || []).includes(t.k)) blockedBy.push('focus');   // focusSetups (7 Nov): setups that trade live on every market
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
        shadow, blockedBy, feed: FEED, note: shadow ? `Shadow (${blockedBy.map((b) => why[b]).join(', ')})` : blockedBy.length ? `${t.next} Taken under take-all; the rules would block it (${blockedBy.map((b) => why[b]).join(', ')}).` : t.next };
      // held to the second target: the first one is kept for the record, and the order stays valid until price reaches the Origin
      if (toT2) { tr.tp1 = t.t1; tr.target = 't2'; if (!shadow) tr.note += ` Holding to ${T1.toFixed(M.dec)}, ${t.retrace ? `the ${String(t.pair).split(' ')[0]} Origin` : 'the second target'} (${(config.targetBy || {})[t.k] === 'user' ? "the trader's rule" : 'backtest'}).`; }
      try { tr.ctx = entryContext(t, src, def, M, price); } catch (e) {}
      if (mkt) {
        // fill at the market price, never at a better level than was available
        if (mktEntry) tr.entryMode = 'market';
        // near-stop fills (12 Nov 2026, owner approved, docs/owner-decisions.md item 53): the engine's minimum stop is checked
        // again on the price we would really get; inside it, or past the stop / target, the order is not opened (never a trade:
        // no fill time, R 0, the stop untouched, the planned entry kept; the price it would have filled at is in fillPx)
        const floor = minStopDist(src[def.l].bars, spreadOf(M, price), CFG.minRisk), skip = fillCheck(tr.side, price, tr.stop, tr.t1, floor);
        if (skip) { tr.status = 'skipped'; tr.reason = skip; tr.fillPx = price; tr.minStop = +floor.toPrecision(5); tr.closed = now; tr.R = 0; tr.note = fillCheckText(skip, M, price, floor); }
        else {
          tr.entry = price; tr.status = 'open'; tr.filled = now; tr.r0 = Math.abs(price - tr.stop);
          tr.drift = driftR(tr.side, t.entry, price, t.stop);   // stale-signal shadow stat (8 Nov): fill vs the setup's planned entry, in R
          tr.rr = +(((tr.t1 - tr.entry) * (t.sell ? -1 : 1)) / tr.r0).toFixed(2);
        }
      }
      // m30m1 (M30 → M1) fires on the same M1 entry as the Scalp: the same trade recorded twice (6 Nov, 29 of 31). Keep one.
      if (t.k === 'm30m1' && trades.some((x) => x.market === key && x.k !== 'm30m1' && x.side === tr.side && x.opened === tr.opened && x.entry === tr.entry)) continue;
      // 12 Nov 2026 (owner approved, "count duplicates once"): two setups giving the SAME order this round (same market, side,
      // second, entry, stop and target; council/dedupe.mjs) record it once: the second (or the shadow one, when the other is
      // live) is kept with status 'duplicate' + dupOf, never managed, alerted, copied or counted. Other targets stay two trades.
      recordOnce(trades, tr, now);
      trades.push(tr);
    }
  } catch (e) { snapshot.errors[key] = String(e.message || e); }
}

// forget signatures older than 30 days, keep the last 3000 trades
for (const [sig, t] of Object.entries(state.seen)) if (now - t > 30 * 86400) delete state.seen[sig];
trades = trades.slice(-3000);
state.lastRun = now;
snapshot.feedChanges = (state.feedChanges || []).filter((c) => now - Date.parse(c.at) / 1000 < 7 * 86400);

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
  // rows still open at the end of the replay window (status 'open', R null) have no result yet: left out of every stat here
  const T = b.trades.map((r) => Object.fromEntries(b.tradeCols.map((c, i) => [c, r[i]]))).filter((t) => t.status !== 'open');
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
    if (fl[c] && (fl.src || {})[c] === 'backtest' && !cooling(k, c)) {   // 14-day hold (robustness audit: added and dropped 10 h apart)
      const kept = S[fl[c]], out = S[other(fl[c])];
      if (kept.n >= 15 && out.n >= 15 && out.e >= kept.e) { touched(k, c);
        change(`${k}: "only ${txt(fl[c])}" dropped (backtest)`, `${f2(kept.e)} each over ${kept.n}, the excluded side ${f2(out.e)} over ${out.n}: the filter no longer helps.`);
        delete fl[c]; if (fl.since) delete fl.since[c]; if (fl.src) delete fl.src[c];
      }
    }
    if (S[v1].n < 30 || S[v2].n < 30) continue;
    const win = S[v1].e > S[v2].e ? v1 : v2, lose = other(win), gap = btGapT(S[win], S[lose]);
    if (!(S[win].e >= 0.1 && S[lose].e <= -0.1 && gap >= 3 && S[win].h[0].e > S[lose].h[0].e && S[win].h[1].e > S[lose].h[1].e)) continue;
    const f = config.filters[k] = config.filters[k] || {};
    if (userOwned(f, c)) continue;   // the owner's rule stays until the owner changes it (Coach proposals can still flag it)
    if (f[c] === win && (f.src || {})[c] === 'backtest') continue;
    if (isLiveSetup(k) || cooling(k, c)) continue;   // live setups: the owner's call; a rule changed in the last 14 days stays
    touched(k, c);
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
    if ((config.be || null) !== want && knobGate('be', none.n)) {   // 14-day hold, shared with the statistical break-even steps
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
  if (losses.length >= 6 && gave.length >= 4 && gave.length / losses.length >= 0.25 && knobGate('be', losses.length)) {
    config.be = 1; config.beSince = nowISO;
    change('Break-even at +1R turned on', `${gave.length} of ${losses.length} recent losers (live and shadow) were +1R or more before turning around.`);
  }
}

// ─── Coach evidence (owner delegated, 7 Nov; research/edge/coach-learning) ───
// The old learning added a rule from trades that no condition had blocked and dropped it from the trades it had blocked
// (plus an automatic drop after 21 days), on 5-8 trades: rules flipped back and forth (m30m1 D1 rule 4 times in 2 days)
// and, over 150 days, picked trades no better than chance. Now both directions use the same sample (every closed signal of
// the setup, live and shadow, whatever blocked it), the same bar (30+ trades, |t| >= 2, the same sign in both halves of the
// sample) and a rule the Coach changed stays put for 14 days.
const COACH_MIN_N = 30, COACH_T = 2, COACH_COOL = 14 * 86400;
function solid(a, sign) {   // a: trades with R; sign +1 = clearly positive, -1 = clearly negative
  if (a.length < COACH_MIN_N) return false;
  const m = a.reduce((s, x) => s + x.R, 0) / a.length, sd = Math.sqrt(a.reduce((s, x) => s + (x.R - m) ** 2, 0) / (a.length - 1) || 0);
  if (!(sd > 0) || sign * m / (sd / Math.sqrt(a.length)) < COACH_T) return false;
  const o = a.slice().sort((x, y) => (x.closed || 0) - (y.closed || 0)), h = o.length >> 1;
  return [o.slice(0, h), o.slice(h)].every((p) => p.length && sign * (p.reduce((s, x) => s + x.R, 0) / p.length) > 0);
}
const coolKey = (k, f) => `${k}:${f}`;
function cooling(k, f) { if ((config.coachTrials || {})[coolKey(k, f)]) return true;   // a champion/challenger trial holds the rule
  const t = (config.coachChanged || {})[coolKey(k, f)]; return !!t && now - Date.parse(t) / 1000 < COACH_COOL; }
function touched(k, f) { (config.coachChanged = config.coachChanged || {})[coolKey(k, f)] = nowISO; }
// ─── Coach evolution (7 Nov, council/coach.mjs): shrunk expectancy on top of solid(), champion/challenger trials for the
// Coach's own filter rules, and the change ledger (coach.json ledger, analysis/latest.md). Live setups (focusSetups) and owner
// rules are never changed here: they stay the owner's call.
const isLiveSetup = (k) => (config.focusSetups || []).includes(k);
// Coach knobs (stop buffer, minimum stop, reward:risk, break-even, signal age, news guard, dollar cap): the robustness audit
// (research/robustness.md, 7 Nov) found 35 Coach changes on a median of 10 trades, 11 topics changed back and forth. A knob now
// moves only on COACH_MIN_N+ trades of evidence and at most once per COACH_COOL (14 days). Use as the LAST test of a change's
// condition: when it passes, the knob is marked as changed.
function knobGate(knob, n) { if (!(n >= COACH_MIN_N) || cooling('all', knob)) return false; touched('all', knob); return true; }
const clear = (a, sign, tau) => solid(a, sign) && shrunkClear(a, sign, tau);   // solid() is the floor, shrinkage the extra bar
// prior spread for the shrinkage, from every (setup x D1 / structure / session value) group of the sample: empirical Bayes
function coachTau(closedAll) {
  const g = {};
  for (const t of closedAll) if (isFinite(t.R) && t.feat) for (const fe of ['d1', 'struct', 'session']) { const v = t.feat[fe]; if (v && v !== 'n/a') (g[`${t.k}|${fe}|${v}`] = g[`${t.k}|${fe}|${v}`] || []).push(t); }
  return ebTau(Object.values(g));
}
const coachCj0 = rd('coach.json', {}), coachLedger = Array.isArray(coachCj0.ledger) ? coachCj0.ledger : [], coachNotes = [];
const CC_SLOT = nowISO.slice(0, 11) + String(Math.floor(+nowISO.slice(11, 13) / 6) * 6).padStart(2, '0');
let ledgerDirty = coachCj0.ledgerSlot !== CC_SLOT;
// a Coach filter change starts a trial: the challenger (new rule) is in force, the champion (old rule) runs as a shadow
function startTrial(k, fe, champion, challenger, sample, what, why, group, tau, rest) {
  const e = ledgerStart({ at: nowISO, k, fe, champion, challenger, what, why, sample, group, tau, rest });
  (config.coachTrials = config.coachTrials || {})[coolKey(k, fe)] = { id: e.id, k, fe, champion: e.champion, challenger: e.challenger, start: nowISO };
  coachLedger.push(e); ledgerDirty = true;
}
// judge the running trials (every 6 hours): keep the challenger, or put the champion back and log why
function judgeTrials(closedAll) {
  const T = config.coachTrials || {}, tau = coachTau(closedAll);
  for (const [key, tr] of Object.entries(T)) {
    const fl = config.filters[tr.k] || {}, e = coachLedger.find((x) => x.id === tr.id);
    let v = judgeTrial(tr, trades, now, tau);
    if (userOwned(fl, tr.fe)) v = { ...v, status: 'owner', why: 'The owner set this rule during the trial: the owner\'s rule stays.' };
    else if (isLiveSetup(tr.k)) v = { ...v, status: 'frozen', why: `${tr.k} trades live now: its rules change only with the owner's OK, so the trial ends with the rule as it is.` };
    else if (!sameRule(fl, tr.fe, tr.challenger)) v = { ...v, status: 'superseded', why: `Another step changed the rule during the trial (now: ${descRule(tr.fe, ruleState(fl, tr.fe))}).` };
    if (e) e.trial = { ...v, at: nowISO };
    if (v.status === 'running') continue;
    delete T[key];
    if (v.status === 'reverted') {
      setRule(config.filters[tr.k] = config.filters[tr.k] || {}, tr.fe, tr.champion, nowISO); touched(tr.k, tr.fe);
      const what = `${tr.k}: back to the champion rule (${descRule(tr.fe, tr.champion)})`;
      config.history.push({ at: nowISO, by: 'coach-trial', change: what, why: v.why, trial: tr.id });
      if (emptyFilter(config.filters[tr.k])) delete config.filters[tr.k];
      coachNotes.push(`${what}: ${v.why}`);
    } else coachNotes.push(`${tr.k}: trial ${v.status} (${descRule(tr.fe, tr.challenger)}): ${v.why}`);
  }
  if (!Object.keys(T).length) delete config.coachTrials;
}
function learnFilters(closedAll, change) {
  // ─── Self-evolution: learn filters from the conditions that lose (strict evidence, see solid()) ───
  const learnBy = {}, tau = coachTau(closedAll);
  for (const t of closedAll) if (isFinite(t.R)) (learnBy[t.k] = learnBy[t.k] || []).push(t);
  for (const [k, arr] of Object.entries(learnBy)) {
    if (arr.length < 2 * COACH_MIN_N || isLiveSetup(k)) continue;   // live setups: the owner's call (Coach proposals)
    const fl = config.filters[k] = config.filters[k] || {};
    for (const fe of ['d1', 'struct']) {
      if (fl[fe] || cooling(k, fe)) continue;
      const g = {}; arr.forEach((x) => { const v = x.feat && x.feat[fe]; if (v && v !== 'n/a') (g[v] = g[v] || []).push(x); });
      const vals = Object.entries(g).map(([v, a]) => ({ v, a, n: a.length, e: exp(a) }));
      const bad = vals.find((x) => clear(x.a, -1, tau)), good = vals.find((x) => x !== bad && x.n >= COACH_MIN_N && x.e > 0);
      if (bad && good) { fl[fe] = good.v; (fl.since = fl.since || {})[fe] = nowISO; touched(k, fe);
        const what = `${k}: only ${good.v} ${fe === 'd1' ? 'D1' : 'structure'}`, why = `${bad.v}: ${bad.e.toFixed(2)}R over ${bad.n} trades (clearly negative, both halves; shrunk ${shrink(bad.a, tau).post.toFixed(2)}R); ${good.v}: +${good.e.toFixed(2)}R over ${good.n}. Trial: the old rule runs as a shadow.`;
        change(what, why); startTrial(k, fe, null, good.v, arr, what, why, bad.a, tau, good.a); }
    }
    const gs = {}; arr.forEach((x) => { const v = x.feat && x.feat.session; if (v) (gs[v] = gs[v] || []).push(x); });
    for (const [v, a] of Object.entries(gs)) {
      if ((fl.noSession || []).includes(v) || cooling(k, 'session:' + v) || !clear(a, -1, tau)) continue;
      const rest = arr.filter((x) => !(x.feat && x.feat.session === v));
      if (rest.length >= COACH_MIN_N && exp(rest) > 0) { fl.noSession = (fl.noSession || []).concat(v); (fl.since = fl.since || {})['session:' + v] = nowISO; touched(k, 'session:' + v);
        const what = `${k}: skip the ${v} session`, why = `${exp(a).toFixed(2)}R over ${a.length} trades there (clearly negative, both halves; shrunk ${shrink(a, tau).post.toFixed(2)}R); +${exp(rest).toFixed(2)}R over ${rest.length} elsewhere. Trial: the old rule runs as a shadow.`;
        change(what, why); startTrial(k, 'session:' + v, false, true, arr, what, why, a, tau, rest); }
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

if (ledgerDirty && config.coachTrials) judgeTrials(trades.filter((x) => (x.status === 'win' || x.status === 'loss' || x.status === 'be') && now - x.closed < 30 * 86400));
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
    // (7 Nov) the 'win rate under 35%' triggers for a wider minimum stop / buffer are gone: this engine's targets sit 2-4R away,
    // so it normally wins 23-26% of trades and the trigger fired every night (minimum stop 0.6 -> 1.1 ATR in five nights).
    if (rs.wr > 0.6 && config.buf > LIMITS.buf[0] && knobGate('buf', rs.n)) { const v = +Math.max(LIMITS.buf[0], config.buf - 0.01).toFixed(2); change(`Stop buffer ${config.buf} → ${v} ATR`, `Win rate ${Math.round(rs.wr * 100)}% over ${rs.n} trades: a tighter stop gives more R.`); config.buf = v; }
  }
  const low = recent.filter((x) => x.rr < 1.5), ls = stat(low);
  if (ls.n >= 6 && ls.exp < 0 && config.minRR < 1.5 && knobGate('minRR', ls.n)) { change(`Minimum reward:risk ${config.minRR} → 1.5`, `Trades under 1.5R returned ${ls.exp}R each over ${ls.n} trades.`); config.minRR = 1.5; }
  learnFilters(closedAll, change);
  learnManagement(closedAll, change);
  // drop a rule only on the same strict evidence that adds one (solid(): 30+ trades, t >= 2, both halves, plus the shrunk
  // expectancy), never on a timer; a drop is a challenger too (the rule keeps running as the shadow champion)
  const dropTau = coachTau(closedAll);
  for (const [k, fl] of Object.entries(config.filters)) {
    if (isLiveSetup(k)) continue;   // live setups: the owner's call
    for (const fe of ['d1', 'struct']) {
      if (!fl[fe] || (fl.src || {})[fe] === 'backtest' || userOwned(fl, fe)) continue;   // owner rules stay until the owner changes them
      if (cooling(k, fe)) continue;
      // the side the rule keeps out, judged on every closed signal of the setup (live and shadow), as when it was added
      const sh = closedAll.filter((x) => x.k === k && isFinite(x.R) && x.feat && x.feat[fe] && x.feat[fe] !== 'n/a' && x.feat[fe] !== fl[fe]);
      if (clear(sh, 1, dropTau)) { touched(k, fe); const was = fl[fe], what = `${k}: dropped the ${fe === 'd1' ? 'D1' : 'structure'} rule`, why = `The side it kept out made +${exp(sh).toFixed(2)}R over ${sh.length} trades (clearly positive, both halves; shrunk +${shrink(sh, dropTau).post.toFixed(2)}R). Trial: the old rule runs as a shadow.`;
        change(what, why); delete fl[fe]; if (fl.since) delete fl.since[fe]; startTrial(k, fe, was, null, closedAll.filter((x) => x.k === k && isFinite(x.R)), what, why, sh, dropTau); }
    }
    for (const v of (fl.noSession || []).slice()) {
      if (userOwned(fl, 'session:' + v)) continue;
      if (cooling(k, 'session:' + v)) continue;
      const sh = closedAll.filter((x) => x.k === k && isFinite(x.R) && x.feat && x.feat.session === v);
      if (clear(sh, 1, dropTau)) { fl.noSession = fl.noSession.filter((x) => x !== v); if (fl.since) delete fl.since['session:' + v]; touched(k, 'session:' + v);
        const what = `${k}: trading the ${v} session again`, why = `Trades in that session made +${exp(sh).toFixed(2)}R over ${sh.length} (clearly positive, both halves; shrunk +${shrink(sh, dropTau).post.toFixed(2)}R). Trial: the old rule runs as a shadow.`;
        change(what, why); startTrial(k, 'session:' + v, true, false, closedAll.filter((x) => x.k === k && isFinite(x.R)), what, why, sh, dropTau); }
    }
    if (emptyFilter(fl)) delete config.filters[k];
  }
  // trade management: turn break-even on when 40%+ of recent losers had been +1R first; re-test it after 21 days
  const recentLoss = closed.filter((x) => x.status === 'loss' && now - x.closed < 14 * 86400);
  if (!config.be && recentLoss.length >= 8) {
    const gaveBack = recentLoss.filter((x) => (x.mfe || 0) >= 1).length;
    if (gaveBack / recentLoss.length >= 0.4 && knobGate('be', recentLoss.length)) { config.be = 1; config.beSince = nowISO; change('Break-even at +1R turned on', `${gaveBack} of ${recentLoss.length} recent losers were +1R or more before turning around.`); }
  } else if (config.be && config.beSince && now - Date.parse(config.beSince) / 1000 > 21 * 86400) {
    const bes = closed.filter((x) => x.status === 'be'), wins = closed.filter((x) => x.status === 'win');
    change('Break-even rule off for a re-test', `${bes.length} trades closed at break-even and ${wins.length} won over the last 30 days; testing without it.`);
    config.be = null; delete config.beSince;
  }
  // ─── Lessons from the trade reviews: act on system errors that keep repeating (live and shadow losses, last 14 days) ───
  const rl = trades.filter((x) => x.status === 'loss' && ((x.pm && x.pm.phase === 'done') || ownTags(x).length) && now - x.closed < 14 * 86400);
  const cnt = (c) => rl.filter((x) => (x.pm && (x.pm.cause === c || (x.pm.factors || []).includes(c))) || ownTags(x).some((t) => OWNER_CAUSE[t] === c)).length, share = (c) => rl.length ? cnt(c) / rl.length : 0;
  if (rl.length >= 6) {
    if (cnt('hunt') >= 3 && share('hunt') >= 0.3 && config.buf < LIMITS.buf[1] && knobGate('buf', rl.length)) { const v = +Math.min(LIMITS.buf[1], config.buf + 0.02).toFixed(2); change(`Stop buffer ${config.buf} → ${v} ATR`, `Reviews: ${cnt('hunt')} of ${rl.length} losses were stopped out and then went to the target (stop hunted).`); config.buf = v; }
    if (cnt('noise') >= 3 && config.minRisk < LIMITS.minRisk[1] && knobGate('minRisk', rl.length)) { const v = +Math.min(LIMITS.minRisk[1], config.minRisk + 0.1).toFixed(2); change(`Minimum stop ${config.minRisk} → ${v} ATR`, `Reviews: ${cnt('noise')} losses had a stop inside one normal candle.`); config.minRisk = v; }
    if (cnt('late') >= 3 && share('late') >= 0.3 && (config.fresh || FRESH) > 6 && knobGate('fresh', rl.length)) { const v = (config.fresh || FRESH) - 2; change(`Fresh signals only: ${config.fresh || FRESH} → ${v} candles`, `Reviews: ${cnt('late')} of ${rl.length} losses were late entries.`); config.fresh = v; }
    if (cnt('news') >= 3 && !config.newsGuard && knobGate('newsGuard', rl.length)) { config.newsGuard = true; config.newsSince = nowISO; change('News guard on', `Reviews: ${cnt('news')} losses came from high-impact news; no short-term trades from 15 min before to 45 min after news.`); }
  }
  // break-even that keeps costing wins: move it later
  const beR = trades.filter((x) => x.status === 'be' && x.pm && x.pm.phase === 'done' && now - x.closed < 14 * 86400);
  const beCost = beR.filter((x) => x.pm.cause === 'becost').length;
  if (config.be && config.be < 2 && beCost >= 3 && beCost > beR.length - beCost && knobGate('be', beR.length)) { change(`Break-even ${config.be}R → ${config.be + 0.5}R`, `Reviews: ${beCost} of ${beR.length} break-even exits then went on to the target.`); config.be = config.be + 0.5; }
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
    if (sh.length >= 5 && exp(sh) > 0.3 && cap < LIMITS.maxUsd[1] && knobGate('maxUsd', sh.length)) { config.maxUsd = cap + 1; change(`Dollar cap ${cap} → ${cap + 1} trades`, `Trades blocked only by the dollar cap made +${exp(sh).toFixed(2)}R over ${sh.length}.`); }
    else if (sh.length >= 5 && exp(sh) < -0.3 && fx.length >= 8 && exp(fx) < -0.3 && cap > LIMITS.maxUsd[0] && knobGate('maxUsd', sh.length)) { config.maxUsd = cap - 1; change(`Dollar cap ${cap} → ${cap - 1} trades`, `Gold/forex trades lost ${exp(fx).toFixed(2)}R each and the blocked ones would have lost too.`); }
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
  const prev = rd('coach.json', {});   // keep the owner-facing proposals, the ICT watch list (coachCarry) and the ledger between the daily runs
  wr('coach.json', { ...coachCarry(prev), decay: prev.decay, book: prev.book, expect: prev.expect, forward: prev.forward, ledger: prev.ledger, ledgerSlot: prev.ledgerSlot, ledgerSince: prev.ledgerSince, date: today, at: nowISO, stats, last14: rs, lessons: lessons(trades, now), fslot: nowISO.slice(0, 11) + String(Math.floor(+nowISO.slice(11, 13) / 6) * 6).padStart(2, '0'), notes: notes.length ? notes : ['No change today: not enough evidence to move a rule.'] });
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
// Coach change ledger (7 Nov): every Coach change from the history, the trials' progress and the 30-day results; every 6 hours
// or when a trial started or ended. Written to coach.json (ledger) and shown in analysis/latest.md.
if (ledgerDirty) {
  try {
    const cj = rd('coach.json', {}), pool = trades.filter((x) => DEF_KEYS.has(x.k) && (x.status === 'win' || x.status === 'loss' || x.status === 'be') && isFinite(x.R));
    cj.ledger = syncLedger(coachLedger, config.history, pool, now, { backfillBefore: cj.ledgerSince ? '' : nowISO });
    cj.ledgerSince = cj.ledgerSince || nowISO; cj.ledgerSlot = CC_SLOT;
    if (coachNotes.length) cj.notes = (cj.notes || []).filter((n) => !/^No change today/.test(n)).concat(coachNotes);
    wr('coach.json', cj);
  } catch (e) { console.log('coach ledger failed:', e.message); }
}
// Coach proposals (7 Nov): suggestions for the owner from the replay, for the setups trading live. Never applied here:
// live rules change only with the owner's OK. Recomputed when backtest.json, the live setups or any setup's rules change.
try {
  const b = rd('backtest.json', null), cj = rd('coach.json', {});
  // v2: promotion/demotion proposals read every setup's filters, so any rule change recomputes them
  // v3: plus the data-source proposal from the nightly spot check (research/spotcheck.json)
  const spot = rd('research/spotcheck.json', null);
  // v5: plus the ICT desk's paper filter variants (ict/replay.json); only 'ictFilter' verdicts are proposals, 'ictWatch' are kept as notes
  const ir = rd('ict/replay.json', null);
  const key = b && b.at ? 'v5|' + b.at + '|' + (spot && spot.at || '') + '|' + (ir && ir.at || '') + '|' + JSON.stringify(snapshot.feed || {}) + '|' + JSON.stringify([config.focusSetups || [], config.filters || {}]) : '';
  if (key && cj.proposalsKey !== key) {
    const iv = ictVariantVerdicts(ir, nowISO);
    cj.proposals = coachProposals(b, config, nowISO).concat(spotProposals(spot, nowISO, { feed: snapshot.feed || {} }), iv.filter((p) => p.kind === 'ictFilter'));
    cj.ictWatch = iv.filter((p) => p.kind === 'ictWatch'); cj.proposalsKey = key; cj.proposalsBt = b.at; wr('coach.json', cj);
  }
} catch (e) { console.log('coach proposals failed:', e.message); }
config.history = config.history.slice(-200);

// ─── Paper fills (8 Nov, council/fills.mjs): raw R stays in R; every closed trade also gets its cost in R (costR) and the
// cost-adjusted Rnet (Backtest costOf + slippage; broker spread from ctrader/symbols.json and the demo mirror's own fills once
// they exist). The stale-signal guard is a shadow stat only: snapshot.staleGuard counts the fills more than STALE_R from the
// signal's price and what they made. Nothing here changes an entry, a filter or R.
try {
  // every demo account's fills (12 Nov 2026): the forex copies sit on the shadow and replica accounts, not the council's mirror.json
  const mfiles = ['mirror.json', ...(((rd('ctrader/mirror-accounts.json', {}) || {}).groups || []).map((g) => g && g.file).filter((f) => typeof f === 'string' && /^mirror(-\d+)?\.json$/.test(f)))];
  const model = costModel(MARKETS, { symbols: BROKER_SYMBOLS, brokerInfo: rd('ctrader/symbols.json', null), mirrorMap: mirrorMaps([...new Set(mfiles)].map((f) => [f, rd('ctrader/' + f, null)])) });
  annotateCosts(trades, MARKETS, model); backfillDrift(trades);
  snapshot.costs = { model, ...costSummary(trades, MARKETS), financing: { from: config.financingFrom || null, perNight: Object.fromEntries(Object.entries(FIN).map(([k, v]) => [k, v.long])), asOf: FIN.xau.asOf, src: FIN.xau.src } };
  snapshot.staleGuard = staleStats(trades);
  const gaps = trades.filter((x) => x.gapR || x.dataGap);
  snapshot.fillChecks = { gapStops: gaps.filter((x) => x.gapR).length, gapR: +gaps.reduce((a, x) => a + (x.gapR || 0), 0).toFixed(2), dataGaps: gaps.filter((x) => x.dataGap).length,
    ambiguousFills: trades.filter((x) => x.exit === 'fill and target in one candle').length };
} catch (e) { snapshot.errors.fills = String(e.message || e); }

wr('config.json', config);
wr('state.json', state);
wr('trades.json', trades);
// ─── MT5 bridge feed (5 Nov): a flat CSV of our system's records for the CouncilBridge Expert Advisor (mt5/CouncilBridge.mq5).
// Our live systems only (gold replica, Mosha BO, crypto trend, with their adds) plus the NQ open run (research, 10-min-late feed,
// the EA mirrors it only if the owner turns that on); shadow trades never. Rows for the last 7 days so the EA can close what it holds.
try {
  const SYSK = ['replica', 'mosha-bo', 'mcycle', 'trend', 'gtrend', 'gtrend5', 'gtl', 'geg', 'gmp'], cut = now - 7 * 86400;
  const rows = trades.filter((x) => !x.shadow && SYSK.includes(x.k) && (x.status === 'open' || x.status === 'pending' || (x.closed || x.opened || 0) >= cut))
    .concat(research.filter((x) => x.k === 'nq-open' && x.session === 'nyflip' && (x.status === 'open' || (x.closed || x.opened || 0) >= cut)).filter((x) => !x.shadow).map((x) => ({ ...x, k: 'nq-open', market: 'nq' })));   // a shadow open run (owner, 11 Nov) is never in the feed
  const f = (v) => v == null || v === '' ? '' : typeof v === 'number' ? String(v) : String(v).replace(/[,\n"]/g, ' ');
  const head = ['id', 'market', 'k', 'side', 'status', 'entryMode', 'entry', 'stop', 't1', 'tp1', 'trail0', 'trail1', 'beAt', 'addOf', 'size', 'opened', 'filled', 'closed', 'validFor', 'maxHold', 'exitRule', 'midStop', 'exitAt', 'R', 'exit'];
  const lines = [`# council-bridge v1 generated ${now} ${new Date(now * 1000).toISOString()}`, head.join(',')].concat(rows.map((x) => [x.id, x.market, x.k, x.side, x.status, x.entryMode || (x.k === 'mosha-bo' ? 'limit' : 'market'), x.entry, x.stop, x.t1, x.tp1, x.trail ? x.trail[0] : '', x.trail ? x.trail[1] : '', x.beAt, x.addOf, x.size, x.opened, x.filled, x.closed, x.validFor, x.maxHold, x.exitRule, x.midStop, x.exitAt, x.R, x.exit].map(f).join(',')));
  fs.mkdirSync(path.join(DIR, 'mt5'), { recursive: true }); fs.writeFileSync(path.join(DIR, 'mt5', 'signals.csv'), lines.join('\n') + '\n');
} catch (e) { snapshot.errors.mt5 = String(e.message || e); }
research = research.slice(-2000);
// ─── Research (paper only): NQ New York open liquidity sweep (the trader's rule, 3 Nov) ───
// After the 9:30 New York open, price takes liquidity: it trades through the overnight (18:00–9:30 ET), previous-day
// (9:30–16:00) or pre-market (8:00–9:30) high or low. The first 1-minute candle that closes back inside the swept level, in
// the reversal's direction, within the first hour is the signal: trade the opposite way at market, stop 2 points past the
// sweep's extreme, target 1.2R, out at 16:00. One trade a day. Candles: Yahoo NQ=F (NQ futures, 1 minute).
// On 50 days of 5-minute and 21 days of 1-minute history it is about break-even (+0.02R / −0.06R a trade), so it runs on
// paper to build a forward record.
// (nyFmt / nyParts are declared near the top of the file: the replica's news veto uses them inside the market loop)
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
// v2 (4 Nov, the trader: "today's trade was a buy"): buys only, a sweep of the London LOW. 5-minute history at 2R: buys
// +0.47R a trade over 27 (both halves positive, t 1.6), sells −0.20R over 22; NQ drifts up, so swept lows pay and swept
// highs don't. The 1-minute history agrees (buys +0.22R over 12). Records: nq-london-<day>-b.
function nqLondonSignal(bars, today) {
  const B = bars.map((b) => ({ ...b, ...nyParts(b.time) })), L = B.filter((b) => b.d === today && b.m >= 120 && b.m < 300);
  if (L.length < 30) return null;
  const H = Math.max(...L.map((b) => b.high)), Lo = Math.min(...L.map((b) => b.low));
  let swH = false, swL = false, eH = -Infinity, eL = Infinity;
  for (const b of B.filter((b) => b.d === today && b.m >= 300 && b.m < 565)) {
    eH = Math.max(eH, b.high); eL = Math.min(eL, b.low);
    if (b.high > H) swH = true; if (b.low < Lo) swL = true;
    if (swL && b.close > Lo && b.close > b.open) return { sell: false, level: 'LNL', lv: Lo, ext: eL, stop: eL - 2, t: b.time, m: b.m, entry: b.close, L: { LNH: H, LNL: Lo } };
  }
  return null;
}
// The trader's swing sweep (4 Nov: "either a sweep of a low or a high"; their trade: the 03:30 ET swing low 28,308.5 swept at
// 07:55, buy 28,323 at 08:02, 2R into the New York open). M15 swing points of the day (2 candles each side, known once
// confirmed); between 05:00 and 09:25 ET, a sweep of one and a 1-minute close back past it within 15 min (candle the trade's
// way) → the reversal. Stop 2 points past the sweep's extreme, 2R, out at 11:00 ET. History: 1-minute, 17 days +0.46R a
// trade (n 20); 5-minute replay, 44 days −0.11R: unproven, paper only.
function nqSwingSignal(bars, today) {
  const D = bars.map((b) => ({ ...b, ...nyParts(b.time) })).filter((b) => b.d === today);
  if (D.length < 100) return null;
  const M = []; for (const b of D.filter((b) => b.m < 565)) { const t = Math.floor(b.time / 900) * 900, c = M.at(-1);
    if (!c || c.time !== t) M.push({ time: t, high: b.high, low: b.low }); else { c.high = Math.max(c.high, b.high); c.low = Math.min(c.low, b.low); } }
  const P = []; for (let i = 2; i < M.length - 2; i++) { const nb = [i - 2, i - 1, i + 1, i + 2];
    if (nb.every((j) => M[i].high > M[j].high)) P.push({ k: 'H', lv: M[i].high, at: M[i].time + 2700 });
    if (nb.every((j) => M[i].low < M[j].low)) P.push({ k: 'L', lv: M[i].low, at: M[i].time + 2700 }); }
  const live = new Map();
  for (const b of D.filter((b) => b.m >= 300 && b.m < 565)) {
    for (const p of P) { if (p.at > b.time) continue; const key = p.k + p.lv; if (live.has(key)) continue;
      if (p.k === 'L' && b.low < p.lv) live.set(key, { ...p, t: b.time, ext: b.low }); if (p.k === 'H' && b.high > p.lv) live.set(key, { ...p, t: b.time, ext: b.high }); }
    for (const v of live.values()) {
      v.ext = v.k === 'L' ? Math.min(v.ext, b.low) : Math.max(v.ext, b.high);
      if (b.time - v.t > 900) continue;
      if (v.k === 'L' && b.close > v.lv && b.close > b.open) return { sell: false, level: 'SWL', lv: v.lv, ext: v.ext, stop: v.ext - buf, t: b.time, m: b.m, entry: b.close, L: { SWL: v.lv } };
      if (v.k === 'H' && b.close < v.lv && b.close < b.open) return { sell: true, level: 'SWH', lv: v.lv, ext: v.ext, stop: v.ext + buf, t: b.time, m: b.m, entry: b.close, L: { SWH: v.lv } };
    }
  }
  return null;
}
// Open sweeps before New York (4 Nov, the trader: "NQ works mostly by sweeping the opens and trading the opposite way").
// The opening price of the midnight (00:00 ET), London (03:00) and 08:30 opens; in the 90 min after each, price runs at least
// 15 points through it and a 1-minute close comes back across it within 15 min of the first cross (candle the trade's way) →
// the other way. Stop 2 points past the extreme, 2R, out at 11:00 ET, one trade at a time. 1-minute history (Yahoo + CNBC,
// 11 Sep – 4 Nov, 39 days): 38 trades +15.3R, +0.40R a trade (t 1.7), September +11.7R and October +3.6R, buys and sells
// both positive. Shallow sweeps lose (every depth under 10 points negative across all opens) and New York 09:30 open
// sweeps lose (they tend to run, −0.45R a trade). The New York exclusion and the 15 points were chosen on this data: paper only.
const NQ_OPENS = [0, 180, 510];
// 4 Nov (evening): NQ focus. On the same 1-minute history (39 days) the setups scored: New York open flipped +0.73R a trade
// (27), open sweeps before New York +0.40R (38), London low sweep +0.23R (19, overlaps the open sweeps), swing sweep +0.15R
// (38, September −4.6R), New York open sweep (reversal) 0.00R (26), Tokyo −0.14R (30). Only the first two keep running;
// the others stay in the code, switched off here.
// 4 Nov (night): the trader's 3-year NQ futures file (1m, Dec 2022 – Dec 2025, never used to build the rules) settles it:
// New York open run 447 trades +62.3R, +0.14R a trade (t 2.15), 2023 +35.9R / 2024 +7.6R / 2025 +19.4R, both sides positive;
// open sweeps 352 trades −22.4R (−0.06R), 2023 and 2025 negative (London −17.6R). Only the New York open run stays on.
const NQ_ON = { ny: false, london: false, swing: false, opens: false, nyflip: true, asia: false, sd: true, p80: true };
// NQ opening-4H standard-deviation trackers (5 Nov, owner's indicator "NQ Opening 4H Candle High/Low"; research only, paper,
// not part of our system). The CME day's first 4H candle (18:00-22:00 ET): H, L, range rg; SD levels H + k·rg / L - k·rg.
// sd2ifvg: price reaches 2 SD ("2r"); an FVG the push left (in the 30 one-minute candles before) is inverted by a 1-minute close
//   through its far side within 60 min → fade at that close; stop 1 pt past the extreme since the touch; target 1 SD back.
//   History (nq4h/ifvg.py): NQ 2023-24 +0.068R, 2025 +0.162R, Nasdaq cash 2018-26 +0.040R a trade; Sep-Nov 2026 −0.078R (16).
// sd3mom: price reaches 3 SD → with the move at the level; stop 0.25 range back; target 4 SD. History (nq4h/sdx_*): NQ 2023-24
//   +0.32R, 2025 +0.41R, Nasdaq cash +0.19R a trade (t 2.4 / 1.6 / 2.5), chosen after seeing the data. One per side a session.
function nqSdSignals(bars, now) {
  const B = bars.map((b) => ({ ...b, ...nyParts(b.time) }));
  let i0 = -1; for (let i = B.length - 1; i >= 0; i--) if (B[i].m >= 1080 && B[i].m < 1085 && B[i].time <= now) { i0 = i; break; }
  if (i0 < 0) return [];
  const t0 = B[i0].time - (B[i0].m - 1080) * 60, S = B.filter((b) => b.time >= t0 && b.time < t0 + 22 * 3600);
  const orb = S.filter((b) => b.time < t0 + 4 * 3600); if (orb.length < 200) return [];
  const H = Math.max(...orb.map((b) => b.high)), L = Math.min(...orb.map((b) => b.low)), rg = H - L; if (!(rg > 0)) return [];
  const W = S.filter((b) => b.time >= t0 + 4 * 3600), day = nyParts(t0 + 8 * 3600).d, out = [], exitAt = t0 + 22 * 3600;
  for (const u of [true, false]) {
    const d = u ? 1 : -1, lv2 = u ? H + 2 * rg : L - 2 * rg, ti = W.findIndex((b) => u ? b.high >= lv2 : b.low <= lv2);
    if (ti >= 0) { let ext = u ? W[ti].high : W[ti].low;
      for (let i = ti; i < Math.min(W.length, ti + 60); i++) { const b = W[i]; ext = u ? Math.max(ext, b.high) : Math.min(ext, b.low); let hit = null;
        for (let j = Math.max(2, i - 30); j < i && !hit; j++) { const a = W[j - 2], c3 = W[j];
          if (u && a.high < c3.low && b.close < a.high && W[i - 1].close >= a.high) hit = true;
          if (!u && a.low > c3.high && b.close > a.low && W[i - 1].close <= a.low) hit = true; }
        if (hit) { const stop = u ? ext + 1 : ext - 1, t1 = u ? H + rg : L - rg;
          if ((t1 - b.close) * -d > 0) out.push({ kind: 'sd2ifvg', side: u ? 'sell' : 'buy', t: b.time, entry: b.close, stop, t1, H, L, rg, day, exitAt, lvl: lv2 }); break; } } }
    const lv3 = u ? H + 3 * rg : L - 3 * rg, tj = W.findIndex((b) => u ? b.high >= lv3 : b.low <= lv3);
    if (tj >= 0) { const b = W[tj], e = u ? Math.max(lv3, b.open) : Math.min(lv3, b.open);
      out.push({ kind: 'sd3mom', side: u ? 'buy' : 'sell', t: b.time - 60, entry: e, stop: e - d * 0.25 * rg, t1: u ? H + 4 * rg : L - 4 * rg, H, L, rg, day, exitAt, lvl: lv3 }); }
  }
  return out;
}
// NQ 80% rule (5 Nov, research only, paper; from the owner's video "Worlds BEST NQ Scalper Reveals His A+ Trading Strategy",
// auction market theory). Yesterday's value area = 70% of its 09:30-16:00 time-at-price (2-point bins, grown from the POC).
// Today opens outside it; 30 consecutive 1-minute closes back inside before 12:00 ET → trade toward the far edge; stop 0.03%
// past the extreme since the open; out 16:00 ET. Nasdaq cash 2018-22 +0.04R (n153), 2023-26 +0.05R (n106), t ~1: weak.
// (Corrected 5 Nov: the first backtest dropped trades still open at 16:00 and showed +0.10R / +0.12R.)
function nq80Signal(bars, today) {
  const B = bars.map((b) => ({ ...b, ...nyParts(b.time) })), pd = [...new Set(B.filter((b) => b.m >= 570 && b.m < 960 && b.d < today).map((b) => b.d))].sort().at(-1);
  if (!pd) return null;
  const P = B.filter((b) => b.d === pd && b.m >= 570 && b.m < 960), D = B.filter((b) => b.d === today && b.m >= 570 && b.m < 720);
  if (P.length < 300 || !D.length || D[0].m !== 570) return null;
  const tick = 2, cnt = new Map();
  for (const b of P) { const a = Math.floor(b.low / tick), z = Math.floor(b.high / tick); for (let k = a; k <= z; k++) cnt.set(k, (cnt.get(k) || 0) + 1 / (z - a + 1)); }
  const ks = [...cnt.keys()].sort((x, y) => x - y), tot = [...cnt.values()].reduce((a, v) => a + v, 0);
  let pi = 0; for (let i = 1; i < ks.length; i++) if (cnt.get(ks[i]) > cnt.get(ks[pi])) pi = i;
  let lo = pi, hi = pi, s = cnt.get(ks[pi]);
  while (s < 0.7 * tot) { const up = hi + 1 < ks.length ? cnt.get(ks[hi + 1]) : -1, dn = lo > 0 ? cnt.get(ks[lo - 1]) : -1; if (up >= dn) { hi++; s += up; } else { lo--; s += dn; } }
  const vl = ks[lo] * tick, vh = (ks[hi] + 1) * tick, O = D[0].open; if (O <= vh && O >= vl) return null;
  const sell = O > vh; let ext = O;
  for (let j = 0; j < D.length; j++) {
    const b = D[j]; ext = sell ? Math.max(ext, b.high) : Math.min(ext, b.low);
    if (j >= 29 && D.slice(j - 29, j + 1).every((x) => x.close > vl && x.close < vh)) {
      const e = b.close, stop = sell ? ext + 0.0003 * e : ext - 0.0003 * e, t1 = sell ? vl : vh;
      return (t1 - e) * (sell ? -1 : 1) > 0 ? { sell, t: b.time, entry: e, stop, t1, vl, vh, poc: ks[pi] * tick, open: O, pd } : null;
    }
  }
  return null;
}
// minPen below 1 is a fraction of the opening price (5 Nov: the 8-year backtest used 0.08%, ~20 points at NQ 25,000; the fixed 15
// points had drifted to 0.06%, the weaker end: +0.106R vs +0.119R, 2018-22 +0.005 vs +0.017R). The stop is always 2 points past
// the sweep extreme. 7 Nov (owner kept it): a 0.011%-of-price buffer was computed here but never used; the 2004-26 test (#511)
// found the fixed 2 points as good or better (2023-26 +0.318R vs +0.312R, 2004-22 -0.018R vs -0.060R), so the unused buffer is gone.
// Malaysian SnR direction SOP (owner's L3 session 2; research 5 Nov, ms/msnr_dir.py): working TF H4 with A/V pivot levels (half-width 5),
// BO buy = close above the last A-level, BO sell = close below the last V-level; Daily key levels = pivots (+-0.1 ATR), engulfing and
// DOM zones alive 90 days; a breakout switches the direction only when it is external (the broken level formed before the first tap
// of a Daily level on that side) and that level was tapped before the breakout candle. Recorded on gold replica records as feat.msnr
// (forward test only): on 2023-26 replica trades WITH the D1 trend but AGAINST this H4 direction (a confirmed pullback phase) made
// +172R at a -10.3R drawdown vs +186R / -17.6R for all of them; not a rule until the forward sample agrees.
function msnrDirection(H4, D, n4 = 5, nD = 2) {
  const Z = [];   // daily key levels: [known, side (+1 support-type / -1 resistance-type), lo, hi]
  const isPivH = (B, i, n) => { for (let k = i - n; k <= i + n; k++) if (k !== i && B[k].high >= B[i].high) return false; return true; };
  const isPivL = (B, i, n) => { for (let k = i - n; k <= i + n; k++) if (k !== i && B[k].low <= B[i].low) return false; return true; };
  const atr = (i) => { let s = 0, k = 0; for (let j = Math.max(0, i - 13); j <= i; j++) { s += D[j].high - D[j].low; k++; } return s / Math.max(1, k); };
  for (let i = nD; i < D.length - nD; i++) { const a = atr(i);
    if (isPivH(D, i, nD)) Z.push([D[i + nD].time + 86400, -1, D[i].high - 0.1 * a, D[i].high + 0.1 * a]);
    if (isPivL(D, i, nD)) Z.push([D[i + nD].time + 86400, 1, D[i].low - 0.1 * a, D[i].low + 0.1 * a]); }
  for (let i = 1; i < D.length; i++) { const p = D[i - 1], b = D[i], kn = b.time + 86400;
    if (p.close < p.open && b.close > b.open && b.close > p.open && b.open <= p.close) Z.push([kn, 1, Math.min(p.low, b.low), p.open]);
    if (p.close > p.open && b.close < b.open && b.close < p.open && b.open >= p.close) Z.push([kn, -1, p.open, Math.max(p.high, b.high)]);
    if (p.close > p.open && b.close > b.open && b.high > p.high && b.close > p.high) Z.push([kn, 1, Math.min(p.open, p.close), Math.max(p.open, p.close)]);
    if (p.close < p.open && b.close < b.open && b.low < p.low && b.close < p.low) Z.push([kn, -1, Math.min(p.open, p.close), Math.max(p.open, p.close)]); }
  Z.sort((a, b) => a[0] - b[0]);
  const A = [], V = [], lastTap = { 1: null, '-1': null }; let d = 0, zi = 0;
  for (let i = 0; i < H4.length; i++) {
    const b = H4[i], j = i - n4;
    if (j >= n4) { if (isPivH(H4, j, n4)) A.push([b.time, H4[j].high, j]); if (isPivL(H4, j, n4)) V.push([b.time, H4[j].low, j]); }
    while (zi < Z.length && Z[zi][0] <= b.time) zi++;
    for (let q = Math.max(0, zi - 400); q < zi; q++) { const z = Z[q]; if (b.time - z[0] > 90 * 86400) continue; if (b.low <= z[3] && b.high >= z[2]) lastTap[z[1]] = i; }
    if (d <= 0 && A.length) { const [, px, pj] = A[A.length - 1]; if (b.close > px) { const tap = lastTap[1]; if (tap != null && pj < tap && tap <= i) d = 1; } }
    else if (d >= 0 && V.length) { const [, px, pj] = V[V.length - 1]; if (b.close < px) { const tap = lastTap['-1']; if (tap != null && pj < tap && tap <= i) d = -1; } }
    if (d === 0 && A.length && V.length) { if (b.close > A[A.length - 1][1]) d = 1; else if (b.close < V[V.length - 1][1]) d = -1; }
  }
  return d;
}
function nqOpenSweep(bars, today, o, tFree, minPen = 15) {
  const D = bars.map((b) => ({ ...b, ...nyParts(b.time) })).filter((b) => b.d === today);
  const first = D.find((b) => b.m === o); if (!first) return null;
  const O = first.open, live = new Map();
  if (minPen < 1) minPen *= O;
  for (const b of D.filter((b) => b.m > o && b.m < o + 90 && b.time >= tFree)) {
    if (!live.has('L') && b.low < O) live.set('L', { t: b.time, ext: b.low });
    if (!live.has('H') && b.high > O) live.set('H', { t: b.time, ext: b.high });
    for (const [k, v] of live) {
      v.ext = k === 'L' ? Math.min(v.ext, b.low) : Math.max(v.ext, b.high);
      if (b.time - v.t > 900 || Math.abs(v.ext - O) < minPen) continue;
      if (k === 'L' && b.close > O && b.close > b.open) return { sell: false, lv: O, ext: v.ext, stop: v.ext - 2, t: b.time, m: b.m, entry: b.close };
      if (k === 'H' && b.close < O && b.close < b.open) return { sell: true, lv: O, ext: v.ext, stop: v.ext + 2, t: b.time, m: b.m, entry: b.close };
    }
  }
  return null;
}
try {
  const ny = nyParts(now), openNq = research.filter((x) => x.k === 'nq-open' && x.status === 'open');
  const ud = new Date(now * 1000), uMin = ud.getUTCHours() * 60 + ud.getUTCMinutes(), uWd = ud.getUTCDay(), asiaWin = uWd >= 1 && uWd <= 5 && uMin <= 200;
  const sdWin = NQ_ON.sd && ((!['Fri', 'Sat'].includes(ny.wd) && ny.m >= 1320) || (!['Sat', 'Sun'].includes(ny.wd) && ny.m < 960));
  if ((!['Sat', 'Sun'].includes(ny.wd) && ny.m >= 1 && ny.m <= 1000) || asiaWin || openNq.length || sdWin) {
    // Yahoo's CME candles arrive 10 minutes late (probe 4 Nov: lag 600 s) and the newest one is still forming: drop it
    const bars = (await nq1m()).slice(0, -1);
    if (bars.length) nqLast = { price: +bars.at(-1).close.toFixed(2), at: bars.at(-1).time + 60 };   // shown as 'now' on the Active trades card (about 10 min late)
    for (const r of openNq) {
      const s = r.side === 'sell', r0 = Math.abs(r.entry - r.stop);
      for (const b of bars) {
        if (b.time <= r.checked) continue;
        // time exit first (9 Nov audit): the trade leaves at the open of the first candle at / after its exit time, so that candle's
        // high and low (after the exit) can neither stop it nor reach the target
        const p = nyParts(b.time);
        if (r.exitAt ? b.time >= r.exitAt : (p.d !== r.day || p.m >= 960)) { const R = +((s ? r.entry - b.open : b.open - r.entry) / r0).toFixed(2); r.status = R > 0 ? 'win' : R < 0 ? 'loss' : 'be'; r.R = R; r.closed = b.time; r.exit = r.exitLabel || (r.exitAt ? '07:00 UTC' : '16:00'); break; }
        if (s ? b.high >= r.stop : b.low <= r.stop) { const px = stopFill(b, s, r.stop, b.time > (r.filled || r.opened || 0));   // 8 Nov: a gap fills at the open
          if (r.trailMoved) { const R = exitR(s, r.entry, px, r0); r.status = R > 0 ? 'win' : R < 0 ? 'loss' : 'be'; r.R = R; r.exit = 'trailing stop'; } else { r.status = 'loss'; r.R = px === r.stop ? -1 : exitR(s, r.entry, px, r0); }
          r.closed = b.time; break; }
        if (s ? b.low <= r.t1 : b.high >= r.t1) { r.status = 'win'; r.R = +(Math.abs(r.t1 - r.entry) / r0).toFixed(2); r.closed = b.time; break; }
        // runner (nq-runner, 5 Nov): once the trade is trail[0] R in profit the stop follows trail[1] R behind the best price
        r.mfe = +Math.max(r.mfe || 0, (s ? r.entry - b.low : b.high - r.entry) / r0).toFixed(2);
        if (r.trail && r.mfe >= r.trail[0]) { const ns = +(r.entry + (s ? -1 : 1) * (r.mfe - r.trail[1]) * r0).toFixed(2); if (s ? ns < r.stop : ns > r.stop) { r.stop = ns; r.trailMoved = true; } }
      }
      if (r.status === 'open' && bars.length) r.checked = bars.at(-1).time;
    }
    if (NQ_ON.ny && ny.m >= 570 && ny.m <= 720 && !research.some((x) => x.k === 'nq-open' && !x.session && x.day === ny.d)) {   // to 12:00 ET: the feed lags
      const g = nqOpenSignal(bars, ny.d);
      if (g) {   // the day's first signal: paper entry at the signal candle's close (as on the backtest), even though the feed shows it ~10 min late
        const r0 = Math.abs(g.entry - g.stop), t1 = g.entry + (g.sell ? -1.2 : 1.2) * r0;
        research.push({ id: `nq-open-${ny.d}`, market: 'nq', label: 'NQ', dec: 2, k: 'nq-open', name: 'NQ NY open sweep', day: ny.d, side: g.sell ? 'sell' : 'buy',
          entry: +g.entry.toFixed(2), stop: +g.stop.toFixed(2), t1: +t1.toFixed(2), rr: 1.2, opened: g.t + 60, filled: g.t + 60, checked: g.t + 60, status: 'open', R: null,
          seenAt: now, entrySeen: bars.length ? +bars.at(-1).close.toFixed(2) : null, level: g.level, levelPrice: +g.lv.toFixed(2), ext: +g.ext.toFixed(2), levels: Object.fromEntries(Object.entries(g.L).map(([k, v]) => [k, +v.toFixed(2)])),
          note: `Research (paper only): NQ swept the ${g.level} ${g.lv.toFixed(2)} after the New York open (extreme ${g.ext.toFixed(2)}) and closed back inside; ${g.sell ? 'sell' : 'buy'} ${g.entry.toFixed(2)}, stop ${g.stop.toFixed(2)}, target 1.2R ${t1.toFixed(2)}, out at 16:00.` });
      }
    }
    if (NQ_ON.london && !['Sat', 'Sun'].includes(ny.wd) && ny.m >= 301 && ny.m < 660 && !research.some((x) => x.id === `nq-london-${ny.d}-b`)) {   // the day's first signal, recorded until its 11:00 ET exit (feed lag, outages)
      const g = nqLondonSignal(bars, ny.d);
      if (g) {
        const r0 = Math.abs(g.entry - g.stop), t1 = g.entry + (g.sell ? -2 : 2) * r0;
        research.push({ id: `nq-london-${ny.d}-b`, market: 'nq', label: 'NQ', dec: 2, k: 'nq-open', session: 'london', name: 'NQ London low sweep (buy)', v: 2, day: ny.d, side: g.sell ? 'sell' : 'buy',
          entry: +g.entry.toFixed(2), stop: +g.stop.toFixed(2), t1: +t1.toFixed(2), rr: 2, opened: g.t + 60, filled: g.t + 60, checked: g.t + 60, status: 'open', R: null, exitAt: g.t + (660 - g.m) * 60, exitLabel: '11:00 ET',
          seenAt: now, entrySeen: bars.length ? +bars.at(-1).close.toFixed(2) : null, level: g.level, levelPrice: +g.lv.toFixed(2), ext: +g.ext.toFixed(2), levels: Object.fromEntries(Object.entries(g.L).map(([k, v]) => [k, +v.toFixed(2)])),
          note: `Research (paper only): NQ swept the London ${g.sell ? 'high' : 'low'} ${g.lv.toFixed(2)} before New York (extreme ${g.ext.toFixed(2)}) and closed back inside; ${g.sell ? 'sell' : 'buy'} ${g.entry.toFixed(2)}, stop ${g.stop.toFixed(2)}, target 2R ${t1.toFixed(2)}, out at 11:00 ET.` });
      }
    }
    if (NQ_ON.swing && !['Sat', 'Sun'].includes(ny.wd) && ny.m >= 301 && ny.m < 660 && !research.some((x) => x.id === `nq-swing-${ny.d}`)) {
      const g = nqSwingSignal(bars, ny.d);
      if (g) {
        const r0 = Math.abs(g.entry - g.stop), t1 = g.entry + (g.sell ? -2 : 2) * r0;
        research.push({ id: `nq-swing-${ny.d}`, market: 'nq', label: 'NQ', dec: 2, k: 'nq-open', session: 'swing', name: 'NQ swing sweep before NY', day: ny.d, side: g.sell ? 'sell' : 'buy',
          entry: +g.entry.toFixed(2), stop: +g.stop.toFixed(2), t1: +t1.toFixed(2), rr: 2, opened: g.t + 60, filled: g.t + 60, checked: g.t + 60, status: 'open', R: null, exitAt: g.t + (660 - g.m) * 60, exitLabel: '11:00 ET',
          seenAt: now, entrySeen: bars.length ? +bars.at(-1).close.toFixed(2) : null, level: g.level, levelPrice: +g.lv.toFixed(2), ext: +g.ext.toFixed(2), levels: Object.fromEntries(Object.entries(g.L).map(([k, v]) => [k, +v.toFixed(2)])),
          note: `Research (paper only): NQ swept the M15 swing ${g.sell ? 'high' : 'low'} ${g.lv.toFixed(2)} before New York (extreme ${g.ext.toFixed(2)}) and closed back ${g.sell ? 'below' : 'above'} within 15 min; ${g.sell ? 'sell' : 'buy'} ${g.entry.toFixed(2)}, stop ${g.stop.toFixed(2)}, target 2R ${t1.toFixed(2)}, out at 11:00 ET.` });
      }
    }
    // New York open, flipped (4 Nov): the same sweep of the 09:30 opening price (≥ 15 points, 1-minute close back across within
    // 15 min), but traded WITH the sweep: at New York the reclaim fails and the move runs. Stop the same distance on the other
    // side, 2R, out at 11:00 ET. 1-minute history: 27 trades +19.8R, +0.73R a trade (t 2.8), 67% wins, September +4.9R,
    // October +14.9R; every depth (0–30 points) and reclaim window (5–30 min) positive (+0.46 to +1.19R). Paper.
    if (NQ_ON.nyflip && !['Sat', 'Sun'].includes(ny.wd) && ny.m > 571 && ny.m < 660 && !research.some((x) => x.id === `nq-nyflip-${ny.d}`)) {
      const g = nqOpenSweep(bars, ny.d, 570, 0, 0.0008);
      // midnight-open filter (4 Nov, from the trader's NQ research report: "the New Day Open should be the next target"): only when
      // the 00:00 ET opening price lies ahead of the trade. 3-year futures file: ahead +0.22R a trade over 237 (every year positive),
      // behind +0.05R over 210 (2024 negative); outside the file (Dec–Mar cash index + Sep–Nov 2026): ahead +0.68R over 29, behind +0.19R over 32.
      const ndoBar = bars.find((b) => { const p = nyParts(b.time); return p.d === ny.d && p.m === 0; });
      const ndoOk = g && ndoBar && (ndoBar.open - g.entry) * (g.sell ? 1 : -1) > 0;
      // 5 Nov (owner: "record everything that fits the system"): a trigger the midnight-open filter skips is recorded too, as
      // session 'nyflip-x' (not our system), so the filter's cost/benefit shows forward. 4 Nov was one: +2R skipped.
      if (g && ndoBar && !ndoOk && !research.some((x) => x.id === `nq-nyflipx-${ny.d}`)) {
        const sell = !g.sell, r0 = Math.abs(g.entry - g.stop), stop = g.entry + (sell ? r0 : -r0), t1 = g.entry + (sell ? -2 : 2) * r0;
        research.push({ id: `nq-nyflipx-${ny.d}`, market: 'nq', label: 'NQ', dec: 2, k: 'nq-open', session: 'nyflip-x', name: 'NQ open run, midnight open behind (skipped)', day: ny.d, side: sell ? 'sell' : 'buy',
          entry: +g.entry.toFixed(2), stop: +stop.toFixed(2), t1: +t1.toFixed(2), rr: 2, opened: g.t + 60, filled: g.t + 60, checked: g.t + 60, status: 'open', R: null, exitAt: g.t + (660 - g.m) * 60,
          seenAt: now, level: 'OPEN', levelPrice: +g.lv.toFixed(2), ext: +g.ext.toFixed(2), ndo: +ndoBar.open.toFixed(2),
          note: `Research (paper only, not our system): the New York open run fired (${Math.abs(g.ext - g.lv).toFixed(1)} points through ${g.lv.toFixed(2)} and back) but the midnight open ${ndoBar.open.toFixed(2)} lies behind the trade, so the live rule skips it. Recorded to measure the filter.` });
      }
      if (g && ndoOk) {
        const sell = !g.sell, r0 = Math.abs(g.entry - g.stop), stop = g.entry + (sell ? r0 : -r0), t1 = g.entry + (sell ? -2 : 2) * r0;
        research.push({ id: `nq-nyflip-${ny.d}`, market: 'nq', label: 'NQ', dec: 2, k: 'nq-open', session: 'nyflip', name: 'NQ New York open run', day: ny.d, side: sell ? 'sell' : 'buy',
          entry: +g.entry.toFixed(2), stop: +stop.toFixed(2), t1: +t1.toFixed(2), rr: 2,
          ...(config.nqRun ? { t1: +(g.entry + (sell ? -10 : 10) * r0).toFixed(2), rr: 10, tp1: +t1.toFixed(2), trail: [config.nqRun.atR, config.nqRun.trail] } : {}), opened: g.t + 60, filled: g.t + 60, checked: g.t + 60, status: 'open', R: null, exitAt: g.t + (660 - g.m) * 60, exitLabel: '11:00 ET',
          seenAt: now, entrySeen: bars.length ? +bars.at(-1).close.toFixed(2) : null, level: 'OPEN', levelPrice: +g.lv.toFixed(2), ext: +g.ext.toFixed(2), ndo: +ndoBar.open.toFixed(2),
          note: `Research (paper only): NQ ran ${Math.abs(g.ext - g.lv).toFixed(1)} points through the New York open ${g.lv.toFixed(2)} and closed back across it; at New York that reclaim tends to fail, so ${sell ? 'sell' : 'buy'} ${g.entry.toFixed(2)} with the sweep, stop ${stop.toFixed(2)}, ${config.nqRun ? `after +${config.nqRun.atR}R (${t1.toFixed(2)}) the stop trails ${config.nqRun.trail}R behind the best price` : `target 2R ${t1.toFixed(2)}`}, out at 11:00 ET.` });
        // Regime tags (8 Nov, research/edge/regime-switch; council/regime.mjs): TREND = NAS100 6-month trend strength |TS| from OANDA
        // daily closes known before the entry, META = this stream's net R over the last 365 days; written on the trade only, the rule
        // above reads neither (tests/nq-regime.test.mjs pins it byte for byte). Shadow stream 'nyflip-trend' (user rule nq-regime-shadow):
        // a paper copy of the trade, taken only when |TS| >= 0.295, managed by the open-trade loop above like every other nq-open record.
        // supported-book (owner, 11 Nov 2026): the open run is a paper shadow. The push above is untouched (same signal, entry, stop and
        // exit); the record is only marked, so it is managed by the same loop and never alerted, ticketed or sent to the MT5 feed.
        if (ownerSh('nq-open')) Object.assign(research.find((x) => x.id === `nq-nyflip-${ny.d}`), { shadow: true, blockedBy: ['owner-shadow'] });
        try {
          const live = research.find((x) => x.id === `nq-nyflip-${ny.d}`), rows = await regimeDaily(MD_BASE);
          live.regime = regimeOf(rows, research, live.opened, config.nqRegimeShadow);
          if (!rows) snapshot.errors.nqRegime = 'no NAS100 daily candles: trend tag null, no trend shadow';
          const sh = regimeShadow(live, live.regime, config.nqRegimeShadow); if (sh) research.push(sh);
        } catch (e) { snapshot.errors.nqRegime = String(e.message || e); }
      }
    }
    if (NQ_ON.p80 && !['Sat', 'Sun'].includes(ny.wd) && ny.m > 600 && ny.m < 960 && !research.some((x) => x.id === `nq-80pct-${ny.d}`)) {
      const g = nq80Signal(bars, ny.d), r0 = g && Math.abs(g.entry - g.stop);
      if (g && r0 > 0) research.push({ id: `nq-80pct-${ny.d}`, market: 'nq', label: 'NQ', dec: 2, k: 'nq-open', session: '80pct', name: 'NQ 80% rule (value area)', day: ny.d, side: g.sell ? 'sell' : 'buy',
        entry: +g.entry.toFixed(2), stop: +g.stop.toFixed(2), t1: +g.t1.toFixed(2), rr: +(Math.abs(g.t1 - g.entry) / r0).toFixed(2), opened: g.t + 60, filled: g.t + 60, checked: g.t + 60, status: 'open', R: null,
        exitAt: g.t + 60 + (960 - nyParts(g.t).m - 1) * 60, exitLabel: '16:00 ET', seenAt: now, levels: { VAL: +g.vl.toFixed(2), VAH: +g.vh.toFixed(2), POC: +g.poc.toFixed(2), open: +g.open.toFixed(2) },
        note: `Research (paper only, not our system): NQ opened ${g.open.toFixed(2)} ${g.sell ? 'above' : 'below'} yesterday's value area ${g.vl.toFixed(2)}-${g.vh.toFixed(2)} (${g.pd}) and held back inside it for 30 minutes: ${g.sell ? 'sell' : 'buy'} ${g.entry.toFixed(2)} toward the far edge ${g.t1.toFixed(2)}, stop past the extreme ${g.stop.toFixed(2)}, out at 16:00 ET.` });
    }
    if (sdWin) for (const g of nqSdSignals(bars, now)) {
      const id = `nq-${g.kind}-${g.day}-${g.side}`; if (research.some((x) => x.id === id)) continue;
      const r0 = Math.abs(g.entry - g.stop); if (!(r0 > 0)) continue;
      research.push({ id, market: 'nq', label: 'NQ', dec: 2, k: 'nq-open', session: g.kind, name: g.kind === 'sd2ifvg' ? 'NQ 2 SD IFVG fade' : 'NQ 3 SD momentum', day: g.day, side: g.side,
        entry: +g.entry.toFixed(2), stop: +g.stop.toFixed(2), t1: +g.t1.toFixed(2), rr: +(Math.abs(g.t1 - g.entry) / r0).toFixed(2), opened: g.t + 60, filled: g.t + 60, checked: g.t + 60, status: 'open', R: null, exitAt: g.exitAt, exitLabel: '16:00 ET',
        seenAt: now, levels: { H4: +g.H.toFixed(2), L4: +g.L.toFixed(2), range: +g.rg.toFixed(2), level: +g.lvl.toFixed(2) },
        note: `Research (paper only, not our system): opening 4H candle ${g.L.toFixed(2)}-${g.H.toFixed(2)} (range ${g.rg.toFixed(2)}). ${g.kind === 'sd2ifvg' ? `Price reached the 2 SD line ${g.lvl.toFixed(2)} and a 1-minute IFVG formed: fade ${g.side} ${g.entry.toFixed(2)}, stop past the extreme ${g.stop.toFixed(2)}, target 1 SD ${g.t1.toFixed(2)}` : `Price reached 3 SD ${g.lvl.toFixed(2)}: ${g.side} with the move at ${g.entry.toFixed(2)}, stop 0.25 range ${g.stop.toFixed(2)}, target 4 SD ${g.t1.toFixed(2)}`}; out at 16:00 ET.` });
    }
    if (NQ_ON.opens && !['Sat', 'Sun'].includes(ny.wd) && ny.m >= 1 && ny.m < 660) for (const o of NQ_OPENS) {
      const id = `nq-opens-${ny.d}-${o}`, mine = research.filter((x) => x.session === 'opens' && x.day === ny.d);
      if (ny.m <= o || research.some((x) => x.id === id) || mine.some((x) => x.status === 'open')) continue;
      const g = nqOpenSweep(bars, ny.d, o, Math.max(0, ...mine.map((x) => x.closed || 0)));
      if (!g) continue;
      const r0 = Math.abs(g.entry - g.stop), t1 = g.entry + (g.sell ? -2 : 2) * r0, nm = o === 0 ? 'midnight' : o === 180 ? 'London' : '08:30';
      research.push({ id, market: 'nq', label: 'NQ', dec: 2, k: 'nq-open', session: 'opens', open: nm, name: `NQ ${nm} open sweep`, day: ny.d, side: g.sell ? 'sell' : 'buy',
        entry: +g.entry.toFixed(2), stop: +g.stop.toFixed(2), t1: +t1.toFixed(2), rr: 2, opened: g.t + 60, filled: g.t + 60, checked: g.t + 60, status: 'open', R: null, exitAt: g.t + (660 - g.m) * 60, exitLabel: '11:00 ET',
        seenAt: now, entrySeen: bars.length ? +bars.at(-1).close.toFixed(2) : null, level: 'OPEN', levelPrice: +g.lv.toFixed(2), ext: +g.ext.toFixed(2),
        note: `Research (paper only): NQ ran ${Math.abs(g.ext - g.lv).toFixed(1)} points through the ${nm} open ${g.lv.toFixed(2)} and closed back ${g.sell ? 'below' : 'above'} it within 15 min; ${g.sell ? 'sell' : 'buy'} ${g.entry.toFixed(2)}, stop ${g.stop.toFixed(2)}, target 2R ${t1.toFixed(2)}, out at 11:00 ET.` });
      break;
    }
    if (NQ_ON.asia && asiaWin) for (const A of NQ_ASIA) {
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
// Gold New York open run (4 Nov, research, paper): the NQ New York open run carried over to gold unchanged, depth scaled to
// price (15 NQ points ≈ 0.054%, stop buffer 2 points ≈ 0.007%). Gold 1-minute history Jan–Nov (227 days): 143 trades +18.1R,
// +0.13R a trade after a 0.30 spread, 7 of 11 months positive, but January–June +19.6R and June–November −1.5R; every depth
// and reclaim window positive (+0.02 to +0.40R). The other NQ open rules did not carry over (pre-NY reversals −0.12R over 301).
try {
  const gn = nyParts(now), id = `gold-nyrun-${gn.d}`;
  if (goldM1 && !['Sat', 'Sun'].includes(gn.wd) && gn.m > 571 && gn.m < 660 && !research.some((x) => x.id === id)) {
    const o0 = goldM1.find((b) => { const p = nyParts(b.time); return p.d === gn.d && p.m === 570; });
    const g = o0 && nqOpenSweep(goldM1, gn.d, 570, 0, o0.open * 0.054 / 100);
    if (g) {
      const bf = o0.open * 0.0072 / 100, st0 = g.sell ? g.ext + bf : g.ext - bf, r0 = Math.abs(g.entry - st0), sell = !g.sell, stop = g.entry + (sell ? r0 : -r0), t1 = g.entry + (sell ? -2 : 2) * r0;
      research.push({ id, market: 'xau', label: 'XAU/USD', dec: 2, k: 'gold-nyrun', name: 'Gold New York open run', day: gn.d, side: sell ? 'sell' : 'buy',
        entry: +g.entry.toFixed(2), stop: +stop.toFixed(2), t1: +t1.toFixed(2), rr: 2, opened: g.t + 60, filled: g.t + 60, checked: g.t + 60, status: 'open', R: null, closeBy: g.t + (660 - g.m) * 60, exitLabel: '11:00 ET',
        levelPrice: +g.lv.toFixed(2), ext: +g.ext.toFixed(2),
        note: `Research (paper only): gold ran ${Math.abs(g.ext - g.lv).toFixed(2)} through the New York open ${g.lv.toFixed(2)} and closed back across it; ${sell ? 'sell' : 'buy'} ${g.entry.toFixed(2)} with the sweep, stop ${stop.toFixed(2)}, target 2R ${t1.toFixed(2)}, out at 11:00 ET.` });
    }
  }
} catch (e) { snapshot.errors.goldNyrun = String(e.message || e); }
{ const done = research.filter((x) => x.k === 'cycle' && !x.void && (x.status === 'win' || x.status === 'loss' || x.status === 'be')), R = done.reduce((a, x) => a + x.R, 0);
  snapshot.research = { cycle: { closed: done.length, wins: done.filter((x) => x.status === 'win').length, R: +R.toFixed(2), open: research.filter((x) => x.k === 'cycle' && x.status === 'open').length } };
  const rp = research.filter((x) => x.k === 'replica' && !x.void), sum = (a) => { a = a.filter((x) => !x.void); const d = a.filter((x) => x.status === 'win' || x.status === 'loss' || x.status === 'be');
    return { signals: a.length, closed: d.length, wins: d.filter((x) => x.status === 'win').length, R: +d.reduce((s, x) => s + x.R, 0).toFixed(2), open: a.filter((x) => x.status === 'open').length, pending: a.filter((x) => x.status === 'pending').length }; };
  const rpx = rp.filter((x) => x.market === 'xau');
  snapshot.research.replica = { all: sum(rpx), pass: sum(rpx.filter((x) => x.pass && x.v >= 2)), v5: sum(rpx.filter((x) => x.v5)), star: sum(rpx.filter((x) => x.star)) };
  // the method test on the other markets (paper, 2R, no spread): v5 signals per market and all together
  const oth = rp.filter((x) => x.market !== 'xau' && x.v5); snapshot.research.replicaX = { all: sum(oth), markets: Object.fromEntries([...new Set(oth.map((x) => x.market))].map((m) => [m, sum(oth.filter((x) => x.market === m))])) };
  // replica-mirror-gold-only (owner, 11 Nov): the count the rule's condition is read on. Status only: nothing resumes by itself.
  if (config.mirrorReplica && Array.isArray(config.mirrorReplica.markets)) { const mr = config.mirrorReplica, u = mr.until || { n: 200, grossR: 0 };
    const a = sum(rp.filter((x) => !mr.markets.includes(x.market) && (x.closed || 0) >= (mr.since || 0)));
    snapshot.mirrorReplica = { markets: mr.markets, since: mr.since || null, closed: a.closed, grossR: a.R, need: u.n, met: a.closed >= u.n && a.R > u.grossR }; }
  snapshot.ownerShadow = config.ownerShadow || null;
  snapshot.research.nq = sum(research.filter((x) => x.k === 'nq-open'));
  snapshot.research.goldNyrun = sum(research.filter((x) => x.k === 'gold-nyrun'));
  for (const sid of ['ny', 'london', 'swing', 'opens', 'nyflip', 'nyflip-x', 'nyflip-trend', 'sd2ifvg', 'sd3mom', '80pct', 'tokyo', 'shanghai']) snapshot.research['nq_' + sid] = sum(research.filter((x) => x.k === 'nq-open' && (x.session || 'ny') === sid));
  // the regime tag of the latest tagged NQ open run trade (council/regime.mjs): what the page shows as the current switch state
  const lt = research.filter((x) => x.k === 'nq-open' && x.session === 'nyflip' && x.regime).at(-1); if (lt) snapshot.nqRegime = { ...lt.regime, trade: lt.id, day: lt.day }; }
if (nqLast) snapshot.nqLast = nqLast;
// ─── Phone alerts (4 Nov): a push via ntfy.sh (free, no account) when a live trade or an NQ paper trade opens or closes.
// Subscribe in the ntfy app to the topic below (or set the repository secret NTFY_TOPIC to use your own). Which events alert,
// the text and the sends live in council/alerts.mjs: each event is sent once (ntfyP / ntfyX / ntfyO / ntfyC flags) and only
// while recent, so a restart never floods the phone with old trades. COUNCIL_ALERTS=off (the Vercel dry run) sends nothing.
// An alert failure is recorded in snapshot.errors and never stops the round.
try { const ev = [], quiet = process.env.COUNCIL_ALERTS === 'off', topic = process.env.NTFY_TOPIC || NTFY_DEFAULT;
  // futures tickets (council/futures.mjs): gold → MGC, NQ → MNQ; the alert opens the contract's TradingView chart
  const futOpt = { account: +process.env.FUT_ACCOUNT || 10000, risk: +process.env.FUT_RISK || 0.25, basis: null };
  { const gs = rd('ict/snapshot.json', null), gc = gs && gs.markets && gs.markets.gc, xs = snapshot.markets && snapshot.markets.xau;
    if (gc && xs && gc.price && xs.price && now - Date.parse(gs.at) / 1000 < 3600 && Math.abs(gc.price - xs.price) < 60) futOpt.basis = +(gc.price - xs.price).toFixed(1); }
  const A = alertEvents(alertable(trades, research), now, futOpt); ev.push(...A.ev);
  if (A.errors.length) snapshot.errors.alerts = A.errors.slice(0, 3).join('; ');
  // the live-sleeve guard (above) put a setup back to shadow this round: its live alerts stop, so say so once
  for (const [k, at] of Object.entries(config.sleeveStopped || {})) if (at === nowISO) ev.push({ title: `Live sleeve stopped: ${k}`, msg: `The guard put ${k} back to shadow trades: no more live ${k} alerts until it is turned on again.\n${when(now)}`, tags: 'warning' });
  // Telegram (4 Nov): the same events to a Telegram chat. Needs the repository secret TELEGRAM_BOT_TOKEN (from @BotFather).
  // TELEGRAM_CHAT_ID is optional: without it the bot uses the first private chat that messaged it (send the bot /start),
  // remembered in state.tgChat, and says once that it is connected.
  const tgTok = quiet ? null : process.env.TELEGRAM_BOT_TOKEN;
  let tgChat = process.env.TELEGRAM_CHAT_ID || state.tgChat || null;
  if (tgTok && !tgChat) {
    try { const j = await (await fetch(`https://api.telegram.org/bot${tgTok}/getUpdates`, { signal: AbortSignal.timeout(8000) })).json();
      const m = (j.result || []).map((u) => u.message || u.edited_message).find((m) => m && m.chat && m.chat.type === 'private');
      if (m) { tgChat = state.tgChat = String(m.chat.id); wr('state.json', state); ev.unshift({ title: 'Mosha council connected', msg: 'Paper trade alerts (NQ New York open run, gold replica when gold is volatile) will arrive here.' }); } }
    catch (err) { snapshot.errors.telegram = 'getUpdates failed'; }
  }
  if (!quiet && ev.length) Object.assign(snapshot.errors, await sendAlerts(ev, { topic, tgTok, tgChat }));
  if (ev.length) wr('trades.json', trades);
  // Mosha BO heads-up (8 Nov, council/alerts.mjs moshaArmed): H4 BO + H1 retracement in place, one M15 BO from a trade; marked in state.moshaArmedSent once a channel took it
  try { const ma = quiet || !snapshot.moshaBo || ownerSh('mosha-bo') ? null : moshaArmed(snapshot.moshaBo.state, state.moshaArmedSent, now);
    if (ma) { const e = await sendAlerts([ma.ev], { topic, tgTok, tgChat }), tried = (topic ? 1 : 0) + (tgTok && tgChat ? 1 : 0);
      if (Object.keys(e).length < tried) { state.moshaArmedSent = ma.mark; wr('state.json', state); }
      for (const [c, m] of Object.entries(e)) snapshot.errors[`moshaArmed_${c}`] = m; }
  } catch (err) { snapshot.errors.moshaArmed = String(err.message || err); }
  // Forward-test protocol (12 Nov 2026): one alert when a crossed stop line sent the book back to a paper shadow (config.forwardStop,
  // written once by stopSwitch); marked in state.forwardStopSent once a channel took it, so a restart never resends
  try { const fs0 = config.forwardStop;
    if (!quiet && fs0 && fs0.alert && state.forwardStopSent !== fs0.at) { const e = await sendAlerts([fs0.alert], { topic, tgTok, tgChat }), tried = (topic ? 1 : 0) + (tgTok && tgChat ? 1 : 0);
      if (Object.keys(e).length < tried) { state.forwardStopSent = fs0.at; wr('state.json', state); }
      for (const [c, m] of Object.entries(e)) snapshot.errors[`forwardStop_${c}`] = m; }
  } catch (err) { snapshot.errors.forwardStop = String(err.message || err); }
  // Coach proposal digest (7 Nov, council/alerts.mjs): one message when the set of proposals changes, else at most a daily
  // reminder; marked in coach.json proposalsSent once a channel took it, so a restart never resends. Never applies anything.
  try { const cj = rd('coach.json', {}), dg = quiet ? null : proposalDigest(cj.proposals, cj.proposalsSent, now);
    if (dg) { const e = await sendAlerts([dg.ev], { topic, tgTok, tgChat }), tried = (topic ? 1 : 0) + (tgTok && tgChat ? 1 : 0);
      if (Object.keys(e).length < tried) { cj.proposalsSent = dg.mark; wr('coach.json', cj); }
      for (const [c, m] of Object.entries(e)) snapshot.errors[`digest_${c}`] = m; }
  } catch (err) { snapshot.errors.digest = String(err.message || err); }
} catch (err) { snapshot.errors.alerts = String(err.message || err); }
wr('research.json', research);
// Edge-decay monitor (8 Nov, council/decay.mjs): every live system's record after costs against its own backtest (rolling
// expectancy, CUSUM vs the backtest and vs zero, drawdown vs its worst) -> coach.json decay, every 6 hours. Status and alert
// only: it never changes a rule, a filter, a size or a trade; the owner decides (the daily digest names a decaying system).
try { const cj = rd('coach.json', {});
  if (!cj.decay || cj.decay.slot !== CC_SLOT) {
    cj.decay = { ...buildDecay({ trades, research, ictTrades: rd('ict/trades.json', []), replay: rd('research/replay-2w.json', null), ictReplay: rd('ict/replay.json', null) }, { now }), slot: CC_SLOT };
    // What to expect (8 Nov, council/expect.mjs): what the untouched-data studies say each live system should do (R a trade and
    // a year with bands, drawdown to plan for, trades until a verdict) and whether the forward record sits inside that band.
    // Expectations only: nothing here changes a rule either; the daily digest names a system only when it leaves its band.
    try { cj.expect = { ...buildExpect(cj.decay, { now }), slot: CC_SLOT }; } catch (e) { console.log('expectations failed:', e.message); }
    wr('coach.json', cj);
    // record the new statuses (and the robustness verdicts) in digest.json, the shared record the week report reads, so a
    // 6-hour reading never waits on the digest's evening window (council/digest.mjs recordVerdicts: writes only on a change)
    recordVerdicts(DIR, { robust: rd('research/robustness.json', null), decay: cj.decay, now }); }
  // same-round phone ping when the set of decaying live systems changes (council/alerts.mjs decayDigest); marked once a channel took it
  const dg = process.env.COUNCIL_ALERTS === 'off' ? null : decayDigest(cj.decay, cj.decaySent, now);
  if (dg) { const topic = process.env.NTFY_TOPIC || NTFY_DEFAULT, tgTok = process.env.TELEGRAM_BOT_TOKEN || null, tgChat = process.env.TELEGRAM_CHAT_ID || state.tgChat || null;
    const e = await sendAlerts([dg.ev], { topic, tgTok, tgChat }), tried = (topic ? 1 : 0) + (tgTok && tgChat ? 1 : 0);
    if (Object.keys(e).length < tried) { cj.decaySent = dg.mark; wr('coach.json', cj); }
    for (const [c, m] of Object.entries(e)) snapshot.errors[`decay_${c}`] = m; }
} catch (e) { console.log('decay monitor failed:', e.message); }
// Forward tracker (12 Nov, council/forward.mjs): the live paper book (Gold trend + Gold daily engulf) against the forward-test
// protocol of research/proposals/2026-11-12-path-to-live.md (bands, stop lines S1-S4, execution checks E1-E5 on the demo
// copies), on the decay monitor's 6-hour slot. Adopted by the owner on 12 Nov 2026 (decision 43): the reading changes nothing
// itself; a crossed stop line is acted on at the start of the next round (stopSwitch, above), a failed check is only reported.
// Its own slot check, so the first round after a deploy writes the first reading. Without the protocol file (a runner without
// research/) the last reading is kept, never overwritten by an error.
try { const cj = rd('coach.json', {}), pr = (!cj.forward || cj.forward.slot !== CC_SLOT) ? loadProtocol() : null;
  if (pr) { const ma = rd('ctrader/mirror-accounts.json', { groups: [] }), mirrors = (Array.isArray(ma && ma.groups) ? ma.groups : []).map((g) => ({ account: g.account, books: g.books || [], state: (rd('ctrader/' + g.file, {}) || {}).state || {} }));
    cj.forward = { ...buildForward({ trades, snapshot, mirrors, accounts: rd('ctrader/accounts.json', null), protocol: pr, prev: cj.forward }, { now }), slot: CC_SLOT };
    wr('coach.json', cj); }
} catch (e) { console.log('forward tracker failed:', e.message); }
// Book weights, paper comparison (8 Nov, council/book.mjs): the live book as traded against the portfolio-v2 proposal (equal
// risk per distinct idea, gold family capped at 40%, clean-half sizing) applied to the SAME closed trades -> coach.json book,
// every 6 hours. Paper comparison only: no live change; nothing here changes a rule, a size, a filter or a trade.
try { const cj = rd('coach.json', {});
  if (!cj.book || cj.book.slot !== CC_SLOT) {
    cj.book = { ...buildBook({ trades, research, ictTrades: rd('ict/trades.json', []), ictReplay: rd('ict/replay.json', null) }, { now }), slot: CC_SLOT };
    wr('coach.json', cj); }
} catch (e) { console.log('book comparison failed:', e.message); }
snapshot.lessons = lessons(trades, now);
// owner's loss reviews, per setup (30 days): reason counts, rule ideas, and reasons that repeat (3+ and a third of the
// reviewed losses of that setup) as candidates the twice-daily council check tests on the backtest before any rule changes
{
  const R = Object.values(OWNER_REV).filter((r) => r && !r.draft && r.k && now - (r.closed || r.at || 0) < 30 * 86400), byK = {};
  for (const r of R) { const b = (byK[r.k] = byK[r.k] || { n: 0, tags: {}, ideas: [] }); b.n++; (r.tags || []).forEach((t) => { b.tags[t] = (b.tags[t] || 0) + 1; }); if (r.lesson) b.ideas.push({ id: r.id, text: String(r.lesson).slice(0, 300), council: r.council || null }); }
  const candidates = [];
  for (const [k, b] of Object.entries(byK)) for (const [t, n] of Object.entries(b.tags)) if (n >= 3 && n / b.n >= 1 / 3 && !OWNER_CAUSE[t]) candidates.push({ k, tag: t, n, of: b.n });
  snapshot.ownerReviews = { n: R.length, byK, candidates, at: nowISO };
}
wr('snapshot.json', snapshot);
// Analyst report (reporting only): refresh the "Live Scalp rule check" block in analysis/latest.md, if the report is here
try { const fA = path.join(DIR, 'analysis', 'latest.md');
  if (fs.existsSync(fA)) { const md = fs.readFileSync(fA, 'utf8'), nx = injectSection(injectSection(md, liveRuleSection({ snapshot, config, backtest: rd('backtest.json', null), now })), coachChurnSection({ config, now }), CHURN_START, CHURN_END);
    const nx1 = injectSection(injectSection(nx, fidelitySection({ fid: rd('research/fidelity.json', null), now }), FID_START, FID_END), deskSection({ ict: rd('ict/trades.json', []), shadow: rd('ict/shadow.json', null), mirror: rd('ctrader/mirror.json', null), now }), DESK_START, DESK_END);
    const nx2 = injectSection(nx1, ledgerSection({ ledger: rd('coach.json', {}).ledger || [], trials: config.coachTrials || {}, now }), LEDGER_START, LEDGER_END);
    // 8 Nov: where the LIVE Meridian systems stand (the Scalp block above describes a shadow system since 7 Nov)
    const nx3 = injectSection(nx2, goldSystemsSection({ snapshot, config, trades, research, now }), GOLD_START, GOLD_END);
    if (nx3 !== md) fs.writeFileSync(fA, nx3); } } catch (e) { console.log('analyst section:', e.message); }
// Analyst post-mortems of live losses + the daily "What changed" block (reporting and review tags only)
try { const an = analystReviews({ trades, prev: ANALYST_REV, now }), fA = path.join(DIR, 'analysis', 'latest.md');
  if (an.changed) { fs.mkdirSync(path.join(DIR, 'reviews'), { recursive: true }); wr('reviews/analyst.json', { updated: nowISO, reviews: an.reviews }); }
  if (fs.existsSync(fA)) { const md = fs.readFileSync(fA, 'utf8'), nx = analystSections(md, { trades, reviews: an.reviews, owner: OWNER_REV, now }); if (nx !== md) fs.writeFileSync(fA, nx); }
} catch (e) { console.log('analyst post-mortems:', e.message); }
const open = trades.filter((x) => x.status === 'open' || x.status === 'pending').length;
console.log(`Council run ${nowISO}: ${Object.keys(snapshot.markets).length} markets, ${Object.keys(snapshot.errors).length} errors, ${open} open/pending trades, ${trades.length} total.`);
if (Object.keys(snapshot.errors).length) console.log(snapshot.errors);
