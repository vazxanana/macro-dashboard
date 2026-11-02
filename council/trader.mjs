// Council · Trader (+ daily statistical Coach)
// Runs every ~4 minutes in GitHub Actions: pulls candles for every market, runs the Mosha rules,
// paper-trades every Ready setup, manages open trades and writes everything to the data folder.
// Usage: node council/trader.mjs <dataDir>
import fs from 'node:fs';
import path from 'node:path';
import { msAnalyze, CFG, PAIRS, RETR, buildSetup, buildRetrace, setMarket } from './engine.mjs';
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
// How long an unfilled order waits, by the higher timeframe of its pair
const WAIT = { '1d': 5 * 86400, '4h': 2 * 86400, '1h': 12 * 3600, '15m': 3 * 3600 };
// Only fresh signals: the CF break must be at most this many lower-timeframe candles old
const FRESH = 12;
const MAX_OPEN = 2;   // live trades per market
const MAX_USD = 3;    // live gold/forex trades betting the same way on the US dollar (one USD move hits them all)
// +1 = the trade wins if the dollar rises, -1 if it falls, 0 = not a dollar pair (crypto is left out)
const usdDir = (M, side) => { if (M.group === 'Crypto') return 0; const [a, b] = M.label.split('/'), buy = side === 'buy' ? 1 : -1; return b === 'USD' ? -buy : a === 'USD' ? buy : 0; };
const SEC = Object.fromEntries(TFS.map(([id, , s]) => [id, s]));
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
function emptyFilter(fl) { return !fl.struct && !(fl.noSession || []).length && CONDS.every(([c]) => !fl[c]); }

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
];
config.userRules = config.userRules || [];
for (const u of USER_RULES) if (!config.userRules.includes(u.id)) { u.apply(config); config.userRules.push(u.id); config.history.push({ at: nowISO, by: 'user', change: u.change, why: u.why }); }
const state = Object.assign({ seen: {}, lastRun: 0 }, rd('state.json', {}));
let trades = rd('trades.json', []);
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

const BUILDERS = PAIRS.map((p) => [p, buildSetup]).concat(RETR.map((p) => [p, buildRetrace]));
for (const [key, M] of Object.entries(MARKETS)) {
  try {
    const src = {};
    for (const [id, iv] of TFS) {
      const bars = await kraken(M.kraken, iv);
      await sleep(1100);
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

    // ─── Manage open trades on this market with the candles since the last check ───
    for (const tr of trades.filter((x) => x.market === key && (x.status === 'pending' || x.status === 'open'))) {
      const bars = (src['1m'].bars[0].time <= tr.checked ? src['1m'] : src['5m'].bars[0].time <= tr.checked ? src['5m'] : src['15m']).bars;
      const s = tr.side === 'sell';
      let exitBar = null;
      for (const b of bars) {
        if (b.time < tr.checked) continue;
        if (tr.status === 'pending') {
          if (s ? b.high >= tr.entry : b.low <= tr.entry) { tr.status = 'open'; tr.filled = b.time; }
          else if (s ? b.low <= tr.t1 : b.high >= tr.t1) { tr.status = 'missed'; tr.closed = b.time; tr.R = 0; break; }
          else continue;
        }
        const r0 = tr.r0 || (tr.r0 = Math.abs(tr.entry - tr.stop));
        if (s ? b.high >= tr.stop : b.low <= tr.stop) {
          if (tr.beMoved) { tr.status = 'be'; tr.R = 0; } else { tr.status = 'loss'; tr.R = -1; }
          tr.closed = b.time; exitBar = b; break;
        }
        if (s ? b.low <= tr.t1 : b.high >= tr.t1) { tr.status = 'win'; tr.closed = b.time; tr.R = tr.rr; exitBar = b; break; }
        // how far the trade went for (MFE) and against (MAE), in R: the Coach learns trade management from these
        tr.mfe = +Math.max(tr.mfe || 0, ((s ? tr.entry - b.low : b.high - tr.entry) / r0)).toFixed(2);
        tr.mae = +Math.max(tr.mae || 0, ((s ? b.high - tr.entry : tr.entry - b.low) / r0)).toFixed(2);
        // break-even rule from the Coach: once the trade is config.be R in profit, the stop moves to the entry
        // only on a candle that actually reached +be R: a trade that was past it before the rule existed and is now
        // back near the entry can't place a stop on the wrong side of price, so it waits until it gets there again
        if (config.be && !tr.beMoved && ((s ? tr.entry - b.low : b.high - tr.entry) / r0) >= config.be) { tr.stop = tr.entry; tr.beMoved = true; }
      }
      tr.checked = bars.at(-1).time;
      if (exitBar) startReview(tr, exitBar, key, NEWS);
      if (tr.status === 'pending' && now - tr.opened > (WAIT[tr.h] || 86400)) { tr.status = 'expired'; tr.closed = now; tr.R = 0; }
    }

    // ─── Review closed trades: keep watching price after the exit, then give a verdict (system error or market) ───
    for (const tr of trades.filter((x) => x.market === key && (x.status === 'win' || x.status === 'loss' || x.status === 'be') && (!x.pm || x.pm.phase === 'watch'))) {
      if (!tr.pm) { if (now - tr.closed > 7 * 86400) continue; startReview(tr, null, key, NEWS); }   // trades closed before reviews existed
      const bars = (src['1m'].bars[0].time <= tr.pm.checked ? src['1m'] : src['5m'].bars[0].time <= tr.pm.checked ? src['5m'] : src['15m']).bars;
      watchReview(tr, bars);
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
      const def = PAIRS.concat(RETR).find((p) => p.k === t.k), cfT = +String(t.sig).split('|')[2];
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
      // exposure: at most MAX_OPEN live trades per market, and never long and short the same market at once
      const live = trades.filter((x) => x.market === key && !x.shadow && (x.status === 'open' || x.status === 'pending'));
      if (live.length >= MAX_OPEN || live.some((x) => x.side !== (t.sell ? 'sell' : 'buy'))) blockedBy.push('exposure');
      // the same idea twice (another setup with the same stop and target, e.g. intraday and scalp sharing one M5 structure) doubles the risk: take it once
      const tick = Math.abs(t.entry) * 1e-5;
      if (live.some((x) => Math.abs(x.stop - t.stop) <= tick && Math.abs(x.t1 - t.t1) <= tick)) blockedBy.push('duplicate');
      const ud = usdDir(M, t.sell ? 'sell' : 'buy');
      if (ud && trades.filter((x) => !x.shadow && (x.status === 'open' || x.status === 'pending') && MARKETS[x.market] && usdDir(MARKETS[x.market], x.side) === ud).length >= (config.maxUsd || MAX_USD)) blockedBy.push('usd');
      const shadow = blockedBy.length > 0;
      const why = { paused: `paused until ${String(config.paused[t.k]).slice(0, 10)}`, minRR: `reward:risk ${(isFinite(rrNow) ? rrNow : 0).toFixed(2)} under ${config.minRR}`, d1: `rule: only ${f.d1} D1`, cf: `rule: only ${f.cf === 'choch' ? 'a CHoCH' : 'a continuation BO'} as the confirming break`, choch: `rule: ${f.choch === 'yes' ? 'needs' : 'no'} fresh M15/M5 CHoCH`, m15c: `rule: ${f.m15c === 'yes' ? 'needs' : 'no'} M15 CHoCH (the trader's) within the hour`, struct: `rule: only ${f.struct} structure`, session: `rule: not in ${feat.session}`, exposure: 'already 2 trades or an opposite trade open on this market', news: 'high-impact news within the hour', duplicate: 'same stop and target as a trade already open', usd: `already ${config.maxUsd || MAX_USD} trades betting the same way on the dollar`, market: `market paused until ${String(config.pausedMarkets[key]).slice(0, 10)}` };
      const h = def.h;
      const tr = { id: `${key}-${t.k}-${now}`, market: key, label: M.label, dec: M.dec, k: t.k, name: t.name, pair: t.pair, h, side: t.sell ? 'sell' : 'buy',
        entry: t.entry, stop: t.stop, t1: T1, rr: +(toT2 ? Math.abs(T1 - t.entry) / Math.abs(t.entry - t.stop) : t.rr).toFixed(2), buf: CFG.buf, opened: now, checked: now, status: 'pending', R: null, feat,
        shadow, blockedBy, note: shadow ? `Shadow (${blockedBy.map((b) => why[b]).join(', ')})` : t.next };
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
const DEF_KEYS = new Set(PAIRS.concat(RETR).map((p) => p.k));   // setups the Trader actually trades (research setups are only backtested)
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
snapshot.lessons = lessons(trades, now);
wr('snapshot.json', snapshot);
const open = trades.filter((x) => x.status === 'open' || x.status === 'pending').length;
console.log(`Council run ${nowISO}: ${Object.keys(snapshot.markets).length} markets, ${Object.keys(snapshot.errors).length} errors, ${open} open/pending trades, ${trades.length} total.`);
if (Object.keys(snapshot.errors).length) console.log(snapshot.errors);
