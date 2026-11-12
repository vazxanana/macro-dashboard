// Council · Backtest: replay past candles through the same engine and rules the Trader uses,
// so the Coach can judge a setup on hundreds of historical trades instead of waiting days for live ones.
// Usage: node council/backtest.mjs <dataDir> [days=30]
// Data (7 Nov): gold and forex from OANDA spot, the feed the live Trader switched them to (oandaData below: 1m paged through the
// site's /md/bars proxy, 5m/15m/30m built from it, OANDA's own 1h/4h/1d; not cleaned and gold not shifted, as live); if OANDA
// can't be read, that whole market falls back to the Kraken path below. markets.source[key] = 'OANDA' or the fallback's feed.
// Crypto (and the gold/forex fallback): Kraken, the feed the live Trader trades on: its trade history built into 1m candles (cached per
// day, council/krakenhist.mjs) plus its own 1h/4h/1d candles. Gold is PAXGUSD shifted onto spot like the live Trader does
// (goldBasis below). Fallbacks: crypto and gold Binance (1m history; PAXGUSDT) until Kraken's cached history covers the
// whole window (the Kraken backfill workflow, council/krakenfill.mjs, fills that cache every 30 min; a coin switches to Kraken
// on the first replay after its cache covers the window); forex Yahoo Finance (yahoo.mjs), then Dukascopy (duka.mjs).
// markets.source says which feed each market used, markets.feeds each timeframe's (one feed per market, never a mix),
// markets.krakenCoverage how far the Kraken cache reaches (covers: true once the replay can use it), markets.fallback why not.
// Entry styles: every signal also gets a twin entered at market (setup '<k>@mkt'), and resting orders that never fill
// are kept as 0R rows (fill = 0), so the Coach can compare the two entry styles signal by signal.
// Costs: every trade carries its spread in R (one spread per round trip: bid/ask), so results can be judged net.
// Overnight financing (11 Nov 2026, owner approved): a long gold trade also carries `fin`, the Trader's own charge
// (council/fills.mjs financing: rollovers held through x the broker's rate x entry / r0) for the live exit (R_none), in its own
// column, so net = R_none - cost - fin. The other exit variants close at other times and are not charged here.
// Fills and exits (8 Nov): the Trader's rules, shared from council/fills.mjs (replayBar): a stop the candle opened beyond fills at
// the open (first, break-even and trailing stops), a limit fill + target in one candle is missed, candles while spot gold / forex
// is shut (Fri 17:00 - Sun 17:00 New York) are ignored.
// Writes <dataDir>/backtest.json: expectancy by setup, by condition, by reward:risk, by market, for three
// trade-management variants (no break-even, break-even at +1R, at +1.5R).
import fs from 'node:fs';
import path from 'node:path';
import { msAnalyze, CFG, PAIRS, RETR, buildSetup, buildRetrace, setMarket } from './engine.mjs';
import { dukaMinutes, dukaHours, dukaDays, dukaReset } from './duka.mjs';
import { yahooBars } from './yahoo.mjs';
import { krakenData as krakenLoad, krakenGap, basisSeries, aggregate } from './krakenhist.mjs';
import { m15Choch, m15cFeat as m15cOf } from './choch.mjs';
import { cleanBars, LTF_CLEAN } from './clean.mjs';
import { d1AdxFeat } from './adx.mjs';
import { spreadOf, costOf, spotClosed, spotSkip, replayBar, replayFin, FIN, minStopDist, fillCheck } from './fills.mjs';
import { newsFeat } from './events.mjs';

const DIR = process.argv[2] || 'data', DAYS = +(process.argv[3] || 30);
const ONLY = process.env.BT_MARKETS ? new Set(process.env.BT_MARKETS.split(',')) : null;   // local tests: BT_MARKETS=xau,eurusd
const FAKE = !!process.env.BT_FAKE;   // offline self-test with a synthetic random walk
const MARKETS = {
  xau: { label: 'XAU/USD', name: 'Gold', group: 'Metals', kraken: 'PAXGUSD', sym: 'PAXGUSDT', dec: 1, spot: true },
  btc: { label: 'BTC/USD', name: 'Bitcoin', group: 'Crypto', kraken: 'XBTUSD', sym: 'BTCUSDT', dec: 1 },
  eth: { label: 'ETH/USD', name: 'Ethereum', group: 'Crypto', kraken: 'ETHUSD', sym: 'ETHUSDT', dec: 2 },
  sol: { label: 'SOL/USD', name: 'Solana', group: 'Crypto', kraken: 'SOLUSD', sym: 'SOLUSDT', dec: 2 },
  xrp: { label: 'XRP/USD', name: 'XRP', group: 'Crypto', kraken: 'XRPUSD', sym: 'XRPUSDT', dec: 4 },
  eurusd: { label: 'EUR/USD', name: 'Euro', group: 'Forex', duka: 'EURUSD', kraken: 'EURUSD', yahoo: 'EURUSD=X', dec: 5 },
  gbpusd: { label: 'GBP/USD', name: 'Pound', group: 'Forex', duka: 'GBPUSD', kraken: 'GBPUSD', yahoo: 'GBPUSD=X', dec: 5 },
  audusd: { label: 'AUD/USD', name: 'Aussie', group: 'Forex', duka: 'AUDUSD', kraken: 'AUDUSD', yahoo: 'AUDUSD=X', dec: 5 },
  usdcad: { label: 'USD/CAD', name: 'Loonie', group: 'Forex', duka: 'USDCAD', kraken: 'USDCAD', yahoo: 'USDCAD=X', dec: 5 },
  usdchf: { label: 'USD/CHF', name: 'Swissy', group: 'Forex', duka: 'USDCHF', kraken: 'USDCHF', yahoo: 'USDCHF=X', dec: 5 },
};
const TFS = [['1d', '1d', 86400], ['4h', '4h', 14400], ['1h', '1h', 3600], ['30m', '30m', 1800], ['15m', '15m', 900], ['5m', '5m', 300], ['1m', '1m', 60]];
const SEC = Object.fromEntries(TFS.map(([id, , s]) => [id, s]));
const WAIT = { '1d': 5 * 86400, '4h': 2 * 86400, '1h': 12 * 3600, '15m': 3 * 3600 };
const FRESH = 12, WIN = 720, STEP = 300;
// trade management variants: [name, break-even level, hold to the second target, partial exit]
// pt1 (8 Nov, paper comparison only, never traded): half off at +1R, the rest's stop to the entry, then trailing 1R behind the
// best price with no target (cap 10R). The one exit that beat the live exit (engine target, no break-even) in both halves and on
// 4 of 6 markets of a 365-day OANDA replay of the Meridian rule-passing signals (research/meridian-exits.md); still negative
// there, so it is only recorded next to the live exit (column R_pt1) for the owner to judge forward.
const VARIANTS = [['none', null, false], ['be1', 1, false], ['be15', 1.5, false], ['tp2', null, true], ['pt1', null, false, { at: 1, trail: 1 }]];
const newVariants = (stop) => VARIANTS.map(([n, be, t2, pt]) => ({ n, be, t2, pt, stop, beMoved: false, done: false, R: null, size: 1, booked: 0, best: 0 }));
// D1 trend labels from OANDA spot for gold and forex (7 Nov), the same source the live trader and the site charts use, so the
// replay's "with / against D1" means the same thing as the live trades'. Only the label; the D1 candles stay as loaded.
const OANDA_D1 = new Set(['xau', 'eurusd', 'gbpusd', 'audusd', 'usdcad', 'usdchf']), MD_BASE = process.env.MD_BASE || 'https://meridianx.dev/md/';
async function oandaD1(key) { if (!OANDA_D1.has(key)) return null; try { const r = await fetch(`${MD_BASE}bars?sym=${key}&tf=1d&n=1500`, { signal: AbortSignal.timeout(15000) }); const j = r.ok ? await r.json() : null;
  return j && j.src === 'OANDA' && Array.isArray(j.bars) && j.bars.length > 300 ? j.bars.map((b) => ({ time: b.time, open: +b.open, high: +b.high, low: +b.low, close: +b.close })) : null; } catch (e) { return null; } }
const sessionOf = (t) => { const h = new Date(t * 1000).getUTCHours(); return h < 7 ? 'asia' : h < 12 ? 'london' : h < 16 ? 'overlap' : h < 21 ? 'newyork' : 'late'; };
const marketOpen = (M, t) => { if (M.group === 'Crypto') return true; const d = new Date(t * 1000), wd = d.getUTCDay(), h = d.getUTCHours(); return !(wd === 6 || (wd === 0 && h < 23) || (wd === 5 && h >= 21)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { return d; } };

// Use the live Coach's stop settings so the replay trades what the Trader would trade today
const cfg = rd('config.json', {});
CFG.buf = Math.min(0.25, Math.max(0.10, +cfg.buf || 0.15));
CFG.minRisk = Math.min(1.2, Math.max(0.4, +cfg.minRisk || 0.6));

async function klines(sym, iv, start, end) {
  const out = [];
  for (const host of (process.env.BINANCE_HOSTS || 'https://data-api.binance.vision,https://api.binance.com').split(',')) {   // tests: a fake server
    out.length = 0;
    let from = start * 1000, ok = true;
    while (from < end * 1000) {
      let raw = null;
      for (let a = 0; a < 4 && !raw; a++) {
        try { const r = await fetch(`${host}/api/v3/klines?symbol=${sym}&interval=${iv}&startTime=${from}&endTime=${end * 1000}&limit=1000`); if (!r.ok) throw new Error(`HTTP ${r.status}`); raw = await r.json(); }
        catch (e) { if (a === 3) { ok = false; break; } await sleep(1000 * (a + 1)); }
      }
      if (!ok || !Array.isArray(raw)) { ok = false; break; }
      if (!raw.length) break;
      for (const k of raw) out.push({ time: k[0] / 1000, open: +k[1], high: +k[2], low: +k[3], close: +k[4] });
      from = raw[raw.length - 1][0] + 1;
      if (raw.length < 1000) break;
      await sleep(120);
    }
    if (ok && out.length) return out.slice();
  }
  throw new Error(`no klines for ${sym} ${iv}`);
}

function fakeBars(start, end, seed) {   // 1m random walk with trends, for the offline self-test
  let x = seed, px = 100, drift = 0; const out = [];
  const rnd = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
  for (let t = start; t < end; t += 60) {
    if (rnd() < 0.002) drift = (rnd() - 0.5) * 0.02;
    const o = px; px = Math.max(1, px + drift + (rnd() - 0.5) * 0.12);
    out.push({ time: t, open: o, high: Math.max(o, px) + rnd() * 0.05, low: Math.min(o, px) - rnd() * 0.05, close: px });
  }
  return out;
}
// Kraken history for one market (krakenhist.mjs krakenData): trades → 1m (whole UTC days, newest first, cached in DUKA_CACHE, which
// the Kraken backfill workflow fills between runs), 5m/15m/30m built from them; 1h = Kraken's 720 hourly candles plus older hours
// from the trades; 4h/1d = Kraken's own OHLC (the live Trader's candles)
const krakenData = (pair, from, budget) => krakenLoad(pair, from, endT, { cacheDir: process.env.DUKA_CACHE || null, budget });
// the feed a market was replayed on: markets.source[key] (one name) and markets.feeds[key] (where each timeframe came from). Every
// timeframe of a market comes from that one feed, never a mix; a market that changes feed between replays shows it here.
function setFeed(key, source, feeds) {
  (meta.source = meta.source || {})[key] = source;
  (meta.feeds = meta.feeds || {})[key] = feeds || Object.fromEntries(TFS.map(([id]) => [id, source]));
}
// Gold: the live Trader shifts every PAXG candle onto spot by one offset, the median of (spot quote - PAXG 1m close) over its
// last 2 hours of runs, keeping the last offset when no fresh quote comes (trader.mjs basisFor). The replay has no history of
// those spot quotes, so its samples are OANDA's spot H1 closes (the feed the site's charts and the D1 labels use) against the
// PAXG 1m close of the minute before each hour ends: same 2-hour median, same |offset| < 150 guard, same keep-the-last rule.
// Returns offAt(t) (the offset the Trader would have used at time t) or null when OANDA's H1 candles can't be read.
async function goldBasis(m1) {
  let H = null;
  try { const r = await fetch(`${MD_BASE}bars?sym=xau&tf=1h&from=${startT - 3 * 86400}&to=${endT}`, { signal: AbortSignal.timeout(15000) }); const j = r.ok ? await r.json() : null;
    H = j && j.src === 'OANDA' && Array.isArray(j.bars) ? j.bars.filter((b) => !b.live).map((b) => ({ time: +b.time, close: +b.close })) : null; } catch (e) { H = null; }
  return H && H.length ? basisSeries(H, m1) : null;
}
const shiftBar = (b, o) => ({ time: b.time, open: b.open + o, high: b.high + o, low: b.low + o, close: b.close + o });

// Gold and forex from OANDA spot (7 Nov), the feed the live Trader reads (trader.mjs oandaBars) through the site's /md/bars proxy:
// mid candles, finished ones only. One timeframe over [from, to), paged forward by from/to in windows of 4,999 candles (OANDA
// caps a call at 5,000), one call at a time with a short pause; any call that fails after 3 tries throws (the market then
// falls back to Kraken whole, never a mix).
async function oandaRange(key, tf, sec, from, to) {
  const m = new Map(); let calls = 0;
  for (let a = from; a < to;) {
    const b = Math.min(to, a + 4999 * sec);
    let j = null, err = null;
    for (let k = 0; k < 3 && !j; k++) {
      try { calls++; const r = await fetch(`${MD_BASE}bars?sym=${key}&tf=${tf}&from=${a}&to=${b}`, { signal: AbortSignal.timeout(20000) }); const x = r.ok ? await r.json() : null;
        if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; }
      catch (e) { err = String(e.message || e); }
      if (!j) await sleep(1500 * (k + 1));
    }
    if (!j) throw new Error(`OANDA ${tf} ${new Date(a * 1000).toISOString().slice(0, 16)}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, { time: +x.time, open: +x.open, high: +x.high, low: +x.low, close: +x.close });
    a = b;
    await sleep(250);   // polite to the proxy
  }
  const out = [...m.values()].sort((p, q) => p.time - q.time); out.calls = calls;
  return out;
}
// One market from OANDA: 1m for the replay window plus 22 days of warm-up (enough for ~720 30m candles, as the live Trader's
// 1,440 15m candles give it), 5m/15m/30m built from it; 1h/4h/1d OANDA's own candles (the live Trader's), deep enough for
// 720 closed candles before the window starts. ~18 calls a market for a 30-day replay.
async function oandaData(key) {
  const m1 = await oandaRange(key, '1m', 60, startT - 22 * 86400, endT);
  if (m1.length < 5000) throw new Error(`only ${m1.length} 1m candles`);
  const h1 = await oandaRange(key, '1h', 3600, startT - 60 * 86400, endT);
  const h4 = await oandaRange(key, '4h', 14400, startT - 200 * 86400, endT);
  const d1 = await oandaRange(key, '1d', 86400, startT - 1100 * 86400, endT);
  return { calls: m1.calls + h1.calls + h4.calls + d1.calls, data: { '1m': m1, '5m': aggregate(m1, 300), '15m': aggregate(m1, 900), '30m': aggregate(m1, 1800), '1h': h1, '4h': h4, '1d': d1 } };
}

// Trade management (pending fills, stops, targets, break-even and the paper pt1 exit) is replayBar / manageVariant in
// council/fills.mjs since 8 Nov: the Trader's own fill and exit rules (gapped stops fill at the open, a limit fill + target in one
// candle is missed, candles while spot gold / forex is shut are ignored), shared, not copied.

// ─── Research setup: liquidity sweep → VR → BO (the user's marked gold trade, 2 Nov) ───
// M30 wicks beyond a recent M30 swing high (low) and closes back inside it = the sweep; then M5 breaks structure the
// other way = the VR; then a fresh M1 BO the same way = the entry, at market. Target: the nearest still-valid opposing
// M30/H1 Origin. Two stops are tested as separate setups: past the M5 VR structure (sweep_vr) and past the sweep extreme (sweep_ext).
function atr(bars, n = 14) { const b = bars.slice(-n - 1); let s = 0; for (let i = 1; i < b.length; i++) s += Math.max(b[i].high - b[i].low, Math.abs(b[i].high - b[i - 1].close), Math.abs(b[i].low - b[i - 1].close)); return b.length > 1 ? s / (b.length - 1) : 0; }
// The trader's M15 CHoCH (2 Nov): "M15 CHoCH is a sign to enter: it tells when the trend is changing, or we move from
// pullback/retracement to continuation and vice versa". A CHoCH up: the M15 leg down from the last 12 h's high to the
// lowest low after it, then an M15 candle closes above the last lower high before that low (an M15 swing high, 2
// candles each side); a CHoCH down mirrors it. (The engine's VR confirmation only counts swings beyond the break
// level, so a straight drop like 2 Nov's 3,918 -> 3,905 -> 3,891 never confirms; its structure flip came only at the
// 13:30 breakout.) Enter at market within two M15 candles of that close, stop just past the low (high), target the
// nearest valid opposing M30/H1 Origin worth >= 1.2R. info (optional) gets each side's state, for the examples.
function chochSetups(src, price, t, info, spr = 0) {
  const out = [], B = src['15m'].bars;
  const hm = (i) => new Date(B[i].time * 1000).toISOString().slice(11, 16), f2 = (v) => +v.toFixed(2);
  const buf = Math.max(0.1 * atr(B), spr);
  for (const sell of [false, true]) {
    const sg = sell ? 1 : -1, side = sell ? 'sell' : 'buy', note = (v) => { if (info) info[side] = v; };
    const c = m15Choch(B, sell);
    if (!c) continue;
    if (!c.leg) { note(`no M15 leg ${sell ? 'up' : 'down'} of 2 ATR in the last 12 h`); continue; }
    const { iE, iP, iC, ext, lvl } = c;
    const what = `M15 ${sell ? 'high' : 'low'} ${f2(ext)} (${hm(iE)}), CHoCH level ${f2(lvl)}${iP >= 0 ? ` (${hm(iP)})` : ' (the leg start)'}`;
    if (iC < 0) { note(`${what}: no close through yet`); continue; }
    const tc = B[iC].time + 900;
    if (t - tc > 2 * 900) { note(`${what}: CHoCH ${sell ? 'down' : 'up'} at ${hm(iC)}, older than 2 candles`); continue; }
    const stop = ext + sg * buf, r = (stop - price) * sg;
    if (!(r > 0)) { note(`${what}: CHoCH at ${hm(iC)}, price beyond the stop`); continue; }
    const edges = [];
    for (const id of ['30m', '1h']) for (const e of src[id].A.events) {
      if (e.dir !== (sell ? 1 : -1) || e.endIdx !== null) continue;
      const edge = sell ? e.top : e.bot;
      if (sell ? edge < price : edge > price) edges.push(edge);
    }
    edges.sort((p, q) => (p - q) * -sg);
    const t1 = edges.find((edge) => (price - edge) * sg / r >= 1.2);
    if (t1 == null) { note(`${what}: CHoCH ${sell ? 'down' : 'up'} at ${hm(iC)}, no Origin worth 1.2R`); continue; }
    note(`${what}: CHoCH ${sell ? 'down' : 'up'} at ${hm(iC)} -> ${side} ${f2(price)}, stop ${f2(stop)}, target ${f2(t1)}`);
    out.push({ k: 'm15choch', sell, entry: price, stop, t1, rr: (price - t1) * sg / r, sig: `m15choch|${side}|${B[iC].time}` });
  }
  return out;
}

// why (optional): the stage each side reached, for the trader's examples (examples.json): which condition stopped it
function sweepSetups(src, price, t, why, spr = 0) {
  const out = [], B = src['30m'].bars, n = B.length, W = 3;
  if (n < 80) return out;
  for (const sell of [true, false]) {
    const sg = sell ? 1 : -1, hi = (b) => sell ? b.high : -b.low, cl = (b) => sell ? b.close : -b.close;
    const note = (stage, extra) => { if (why) why[sell ? 'sell' : 'buy'] = { stage, ...extra }; };
    // pivot highs (lows) of the last 60 closed M30 candles
    let sweep = null;
    for (let s = n - 2; s >= n - 13 && !sweep; s--) {          // a sweep in the last ~6 h (closed candles)
      for (let p = s - 3; p >= Math.max(W, n - 60); p--) {
        let piv = true; for (let k = 1; k <= W; k++) if (hi(B[p - k]) > hi(B[p]) || hi(B[p + k]) >= hi(B[p])) { piv = false; break; }
        if (!piv) continue;
        const P = hi(B[p]);
        let clean = true; for (let j = p + 1; j < s; j++) if (hi(B[j]) > P) { clean = false; break; }   // the first run above it is the sweep
        if (!clean) break;
        // the sweep: this candle trades beyond the swing and it, or one of the next two closed candles, closes back
        // inside (a 30-90 minute deviation still takes the liquidity; the 2 Nov low at 3,891 needed it)
        if (hi(B[s]) > P) { let r = -1; for (let j = s; j <= Math.min(s + 2, n - 2); j++) if (cl(B[j]) < P) { r = j; break; } if (r >= 0) sweep = { s, r, p, P, time: B[s].time }; }
        break;
      }
    }
    if (!sweep) { note('no M30 sweep in the last 6 h'); continue; }
    let failed = false, ext = -Infinity; for (let j = sweep.s; j < n; j++) { ext = Math.max(ext, hi(B[j])); if (j > sweep.r && cl(B[j]) > sweep.P) failed = true; }
    const lvl = sell ? sweep.P : -sweep.P;
    if (failed) { note('an M30 candle closed beyond the swept level', { level: lvl }); continue; }
    if (sell ? price >= sweep.P : price <= -sweep.P) { note('price back beyond the swept level', { level: lvl }); continue; }
    // M5 VR: an M5 break of structure the other way after the sweep, its Origin still valid
    const B5 = src['5m'].bars, e5 = src['5m'].A.events.find((e) => e.dir === -sg && B5[e.breakIdx].time >= sweep.time && e.endIdx === null);
    if (!e5) { note('swept, waiting for the M5 VR', { level: lvl }); continue; }
    // M1 BO the same way after the M5 VR, fresh
    const B1 = src['1m'].bars, ev1 = src['1m'].A.events.filter((e) => e.dir === -sg && B1[e.breakIdx].time >= B5[e5.breakIdx].time);
    const e1 = ev1[ev1.length - 1];
    if (!e1 || t - B1[e1.breakIdx].time > 12 * 60) { note(e1 ? 'M1 BO older than 12 min' : 'M5 VR in, waiting for the M1 BO', { level: lvl }); continue; }
    // target: nearest valid opposing Origin on M30 / H1 beyond the entry
    let t1 = null;
    for (const id of ['30m', '1h']) for (const e of src[id].A.events) {
      if (e.dir !== (sell ? 1 : -1) || e.endIdx !== null) continue;   // a sell targets the last valid buy Origin below, and vice versa
      const edge = sell ? e.top : e.bot;
      if (sell ? edge < price : edge > price) if (t1 === null || (sell ? edge > t1 : edge < t1)) t1 = edge;
    }
    // H1 Origins beyond price, nearest first: sweep_h1 takes the first one worth 1.2R with the tight stop (the trader's
    // long of 2 Nov went past the spent M30/H1 supply 1.3 points above the entry to the H1 Origin of the sell-off)
    const h1Edges = src['1h'].A.events.filter((e) => e.dir === (sell ? 1 : -1) && e.endIdx === null).map((e) => sell ? e.top : e.bot)
      .filter((edge) => sell ? edge < price : edge > price).sort((a, b) => (a - b) * -sg);
    if (t1 === null) {   // no valid Origin there: the other side of the M30 range before the sweep (~30 h; its liquidity)
      let lo = Infinity; for (let j = Math.max(0, n - 60); j <= sweep.s; j++) lo = Math.min(lo, sell ? B[j].low : -B[j].high);
      const edge = sell ? lo : -lo; if (sell ? edge < price : edge > price) t1 = edge;
    }
    if (t1 === null) { note('no target (no Origin or range edge beyond price)', { level: lvl }); continue; }
    const buf = 0.1 * atr(B5), sweepExt = sell ? ext : -ext;
    // stops: past the M5 VR structure; past the sweep extreme (the trader's short, 2 Nov); just past the M1 BO's
    // origin (the trader's long, 2 Nov: 3.9 points of risk for 16R), never inside the 0.1 ATR buffer
    const b1 = 0.1 * atr(B1), floor = Math.max(CFG.minRisk * atr(B1), 5 * spr);   // the engine's minimum stop
    let m1s = sell ? e1.top + b1 : e1.bot - b1; if ((m1s - price) * sg < floor) m1s = price + sg * floor;
    const stops = { sweep_vr: sell ? e5.top + buf : e5.bot - buf, sweep_ext: sell ? sweepExt + buf : sweepExt - buf, sweep_m1: m1s };
    const rM1 = (m1s - price) * sg, tH1 = rM1 > 0 ? h1Edges.find((edge) => (price - edge) * sg / rM1 >= 1.2) ?? null : null;
    const rrs = {}, plans = Object.entries(stops).map(([k, stop]) => [k, stop, t1]);
    if (tH1 !== null) plans.push(['sweep_h1', m1s, tH1]);   // the M1-origin stop, held to that H1 Origin
    for (const [k, stop, tg] of plans) {
      const r = (stop - price) * sg, rr = (price - tg) * sg / r;
      rrs[k] = +rr.toFixed(2);
      if (!(r > 0) || !(rr >= 1.2)) continue;
      out.push({ k, sell, entry: price, stop, t1: tg, rr, sig: `${k}|${sell ? 's' : 'b'}|${B1[e1.breakIdx].time}|${sweep.time}` });
    }
    note(out.some((x) => x.sell === sell) ? 'signal' : 'reward:risk under 1.2', { level: lvl, target: +t1.toFixed(5), targetH1: tH1 === null ? null : +tH1.toFixed(5), rr: rrs });
  }
  return out;
}

// market-structure conditions at a signal, exactly as the live Trader computes them (trader.mjs structFeat):
//   cf: the confirming lower-timeframe break is a CHoCH or a continuation BO; choch: a fresh M15/M5 CHoCH in the trade's direction
function structFeat(sell, l, src, at) {
  const dir = sell ? -1 : 1, lp = src[l], ll = lp && lp.A && lp.A.last;
  const cf = ll && ll.dir === dir && ll.structure ? 'choch' : 'bo';
  const choch = ['15m', '5m'].some((id) => { const s = src[id]; return s && s.A && s.A.events.some((e) => e.dir === dir && e.structure && at - s.bars[e.breakIdx].time <= FRESH * SEC[id]); }) ? 'yes' : 'no';
  return { cf, choch };
}
// spread and costs (spreadOf, FEE, costOf) live in council/fills.mjs since 8 Nov, shared with the Trader's paper fills
const BUILDERS = PAIRS.map((p) => [p, buildSetup]).concat(RETR.map((p) => [p, buildRetrace]));
const DEFS = PAIRS.concat(RETR);
const all = [], twins = [], unfilled = [], stillOpen = [], meta = { errors: {} };   // closed trades; their market-entry twins; resting orders that never filled;
// trades (and resting orders, twins included) still open when the replay window ends: written with status 'open' and null R, so the
// replay keeps every signal the live Trader would show, while every expectancy stat skips them (they have no result yet)
const endT = Math.floor(Date.now() / 1000 / 60) * 60 - 60, startT = endT - DAYS * 86400;
const t0wall = Date.now();
// the trader's marked trades (examples.json): for each one inside the replay, what every setup was doing in its entry
// window, why the sweep model did or didn't fire, and which signals (if any) the backtest took there
const EX = (() => { try { return JSON.parse(fs.readFileSync(new URL('./examples.json', import.meta.url))).trades || []; } catch (e) { return []; } })()
  .map((x) => ({ ...x, from: Date.parse(x.entryFrom) / 1000, to: Date.parse(x.entryTo) / 1000, setups: [], sweep: [], m15: [], caught: [] }))
  .filter((x) => x.from >= startT && x.to <= endT);
const PAD = 30 * 60;
// keep a running list of states, adding a row only when it changes
const pushChange = (arr, t, v, extra) => { const s = JSON.stringify(v); if (!arr.length || arr[arr.length - 1].s !== s) arr.push({ t, s, ...v, ...extra }); };

for (const [key, M] of Object.entries(MARKETS)) {
  if (ONLY && !ONLY.has(key)) continue;
  try {
    const data = {};
    // gold and forex: OANDA spot first, like the live Trader (every timeframe from OANDA, or the whole market from Kraken below)
    let oanda = false;
    if (!FAKE && OANDA_D1.has(key)) try {
      const tr0 = Date.now(), O = await oandaData(key);
      Object.assign(data, O.data); oanda = true;
      meta.coverage = Object.assign(meta.coverage || {}, { [key]: new Date(O.data['1m'][0].time * 1000).toISOString().slice(0, 10) });
      setFeed(key, 'OANDA');
      console.log(`${key}: OANDA 1m from ${meta.coverage[key]} (${O.calls} calls) → ${O.data['1m'].length} 1m candles, ${O.data['1h'].length} 1h, ${O.data['4h'].length} 4h, ${O.data['1d'].length} 1d (${((Date.now() - tr0) / 1000).toFixed(0)}s)`);
    } catch (oe) { console.log(`${key}: OANDA not used (${oe.message}); Kraken`); (meta.fallback = meta.fallback || {})[key] = `OANDA: ${String(oe.message || oe).slice(0, 200)}`; }
    if (oanda) { /* loaded above */ }
    else if (FAKE) {
      const m1 = fakeBars(startT - 760 * 86400, endT, key.length * 7919 + 1);
      for (const [id, , sec] of TFS) data[id] = id === '1m' ? m1.filter((b) => b.time >= startT - WIN * 60) : aggregate(m1, sec);
    } else if (M.duka) {
      // forex: every timeframe straight from Yahoo (1m only reaches back ~29.5 days, so the replay starts once
      // 720 1m candles exist); if Yahoo fails, Dukascopy's files: 1m (5m/15m/30m built from it), 1h monthly, 1d yearly
      let done = false;
      try {   // 1. Kraken trades → 1m (38 days, cached per day); 1h = Kraken's 720 hourly candles plus older hours from the trades; 4h/1d = Kraken OHLC
        const tr0 = Date.now(), { K, data: kd, feeds: kfeeds } = await krakenData(M.kraken, startT - 8 * 86400, +(process.env.KRAKEN_BUDGET || 400)), m1 = K.bars;
        if (m1.length < 5000) throw new Error(`only ${m1.length} 1m candles (${K.calls} calls, ${K.cached} days cached)`);
        meta.coverage = Object.assign(meta.coverage || {}, { [key]: new Date(K.from * 1000).toISOString().slice(0, 10) });
        Object.assign(data, kd);
        setFeed(key, 'Kraken', kfeeds);
        console.log(`${key}: Kraken 1m from ${meta.coverage[key]} (${K.cached} days cached, ${K.fetched} downloaded, ${K.calls} calls) → ${m1.length} 1m candles, ${kd['1h'].length} 1h, ${kd['4h'].length} 4h, ${kd['1d'].length} 1d (${((Date.now() - tr0) / 1000).toFixed(0)}s)`);
        done = true;
      } catch (ke) { console.log(`${key}: Kraken history failed (${ke.message}); trying Yahoo`); }
      if (!done) try {
        const y = async (iv, back) => yahooBars(M.yahoo, iv, back, endT);
        const m1 = await y('1m', startT - WIN * 60);
        if (m1.length < 5000) throw new Error(`only ${m1.length} 1m candles`);
        const h1 = await y('60m', startT - (WIN + 2) * 3600);
        Object.assign(data, { '1m': m1, '5m': await y('5m', startT - (WIN + 2) * 300), '15m': await y('15m', startT - (WIN + 2) * 900), '30m': await y('30m', startT - (WIN + 2) * 1800),
          '1h': h1, '4h': aggregate(h1, 14400), '1d': await y('1d', startT - 1100 * 86400) });
        setFeed(key, 'Yahoo', { '1m': 'Yahoo', '5m': 'Yahoo', '15m': 'Yahoo', '30m': 'Yahoo', '1h': 'Yahoo', '4h': 'Yahoo (from 1h)', '1d': 'Yahoo' });
        console.log(`${key}: ${m1.length} 1m, ${h1.length} 1h, ${data['1d'].length} 1d candles from Yahoo`);
      } catch (ye) {
        console.log(`${key}: Yahoo failed (${ye.message}); trying Dukascopy`);
        dukaReset();
        const m1 = await dukaMinutes(M.duka, startT - 8 * 86400, endT);
        if (m1.length < 5000) throw new Error(`Yahoo: ${ye.message}; Dukascopy: only ${m1.length} 1m candles`);
        let h1 = await dukaHours(M.duka, startT - 140 * 86400, endT);
        const lastH = h1.length ? h1.at(-1).time : 0;
        h1 = h1.concat(aggregate(m1.filter((b) => b.time >= lastH + 3600), 3600));
        let d1 = await dukaDays(M.duka, startT - 1100 * 86400, endT);
        const lastD = d1.length ? d1.at(-1).time : 0;
        d1 = d1.concat(aggregate(h1.filter((b) => b.time >= lastD + 86400), 86400));
        Object.assign(data, { '1m': m1, '5m': aggregate(m1, 300), '15m': aggregate(m1, 900), '30m': aggregate(m1, 1800), '1h': h1, '4h': aggregate(h1, 14400), '1d': d1 });
        setFeed(key, 'Dukascopy');
        console.log(`${key}: ${m1.length} 1m, ${h1.length} 1h, ${d1.length} 1d candles from Dukascopy`);
      }
    } else {
      // crypto and gold: Kraken (the live Trader's feed) as soon as its cached trade history covers the whole window (the
      // replay's first step needs 720 1m candles before the start; krakenGap). The Kraken backfill workflow (kraken-backfill.yml,
      // krakenfill.mjs) fills that cache every 30 min; this run tops it up with at most KRAKEN_BUDGET_CRYPTO calls per pair.
      // Until the cache covers the window, or if Kraken fails, the whole market is Binance, and markets.fallback says why.
      let done = false;
      if (M.kraken) try {
        const tr0 = Date.now(), need = startT - WIN * 60, { K, data: kd, feeds: kfeeds } = await krakenData(M.kraken, startT - 86400, +(process.env.KRAKEN_BUDGET_CRYPTO || 300));
        const cov = new Date(K.from * 1000).toISOString().slice(0, 10), gap = krakenGap(K, kd, need, 2 * WIN);
        (meta.krakenCoverage = meta.krakenCoverage || {})[key] = { from: cov, need: new Date(need * 1000).toISOString().slice(0, 16), covers: !gap, calls: K.calls, cached: K.cached, fetched: K.fetched };
        if (gap) throw new Error(gap);
        Object.assign(data, kd);
        meta.coverage = Object.assign(meta.coverage || {}, { [key]: cov });
        setFeed(key, 'Kraken', kfeeds);
        console.log(`${key}: Kraken ${M.kraken} 1m from ${cov} (${K.cached} days cached, ${K.fetched} downloaded, ${K.calls} calls) → ${kd['1m'].length} 1m candles, ${kd['1h'].length} 1h, ${kd['4h'].length} 4h, ${kd['1d'].length} 1d (${((Date.now() - tr0) / 1000).toFixed(0)}s)`);
        done = true;
      } catch (ke) { console.log(`${key}: Kraken history not used (${ke.message}); Binance ${M.sym}`); (meta.fallback = meta.fallback || {})[key] = String(ke.message || ke).slice(0, 200); }
      if (!done) {
        for (const [id, iv, sec] of TFS) data[id] = await klines(M.sym, iv, startT - (WIN + 2) * sec, endT);
        setFeed(key, 'Binance', Object.fromEntries(TFS.map(([id]) => [id, `Binance ${M.sym}`])));
      }
    }
    // bad prints: the same cleaner, timeframes and options the live Trader applies to its candles (clean.mjs), before any analysis;
    // like live, OANDA candles are not cleaned (live cleans only its Kraken candles)
    if (!oanda) for (const [id] of TFS) {
      const nBad = data[id] ? cleanBars(data[id], M.group === 'Forex' && LTF_CLEAN.has(id) ? { wickK: 15 } : {}) : 0;
      if (nBad) { const C = (meta.cleaned = meta.cleaned || {}); (C[key] = C[key] || {})[id] = nBad; }
    }
    const m1 = data['1m'];
    // research (BT_DUMP=<dir>): the 1m candles each trade is managed on, so exit variants can be replayed on the same fills
    if (process.env.BT_DUMP) fs.writeFileSync(path.join(process.env.BT_DUMP, `${key}-m1.json`), JSON.stringify(m1.map((b) => [b.time, b.open, b.high, b.low, b.close])));
    // gold onto spot (after cleaning, like the live Trader): offAt(t) is the offset the Trader would have used at step t
    let offAt = null;
    if (M.spot && oanda) meta.goldShift = { method: 'none: OANDA gold is spot', base: 'OANDA' };
    else if (M.spot && !FAKE) {
      offAt = await goldBasis(m1);
      meta.goldShift = offAt ? { method: 'OANDA spot H1 close - PAXG 1m close, 2 h median, last kept when stale (live: gold-api.com spot quotes each run)', base: (meta.source || {})[key], samples: offAt.samples, now: offAt(endT) }
        : { method: 'none: OANDA H1 candles unavailable, raw PAXG prices (same structure and signals; entry, stop and target prices sit at the PAXG premium over spot)', base: (meta.source || {})[key] };
    }
    // OANDA D1 trend per day (closed daily candles before that day, last 720), cached; null when OANDA can't be read
    const OD = await oandaD1(key), odCache = new Map(); meta.d1src = Object.assign(meta.d1src || {}, { [key]: OD ? 'OANDA' : 'feed' });
    const odTrend = (t) => { if (!OD) return null; const d = Math.floor(t / 86400) * 86400; if (odCache.has(d)) return odCache.get(d); const w = OD.filter((b) => b.time < d).slice(-720); const v = w.length > 100 ? msAnalyze(w, 6).trend : null; odCache.set(d, v); return v; };
    const d1T = (src, t) => { const o = odTrend(t); return o === 1 || o === -1 ? o : src['1d'].A.trend; };
    setMarket(M);
    const ptr = Object.fromEntries(TFS.map(([id]) => [id, 0]));
    const seen = new Set(), open = [];
    let i1 = 0, steps = 0;
    for (let t = startT; t <= endT; t += STEP) {
      // manage open trades on the 1m candles of the last step
      const off = offAt ? offAt(t) : 0;   // gold: the spot offset of this step (the live Trader manages on its run's shifted candles)
      while (i1 < m1.length && m1[i1].time < t) {
        const b = off ? shiftBar(m1[i1++], off) : m1[i1++];
        const shut = M.group !== 'Crypto' && spotSkip(b.time);   // gold / forex: a candle while spot is shut fills and stops nothing, as live
        for (const tr of open) replayBar(tr, b, { shut, wait: WAIT[tr.h] || 86400 });
        for (let k = open.length - 1; k >= 0; k--) if (open[k].status !== 'pending' && open[k].status !== 'open' && !(open[k].status === 'closed' && open[k].v.some((v) => !v.done))) { const tr = open.splice(k, 1)[0]; if (tr.status === 'closed') (tr.twin ? twins : all).push(tr); else if (!tr.twin) { tr.v.forEach((v) => { v.R = 0; }); tr.cost = 0; unfilled.push(tr); } }
      }
      if (i1 < WIN) continue;
      // the Trader's view at time t: the last 720 closed candles of every timeframe plus the forming one
      const src = {};
      for (const [id, , sec] of TFS) {
        const arr = data[id]; let p = ptr[id];
        while (p < arr.length && arr[p].time + sec <= t) p++;
        ptr[id] = p;
        let bars = arr.slice(Math.max(0, p - (WIN - 1)), p);
        if (id !== '1m') {
          const f0 = Math.floor(t / sec) * sec; let f = null;
          for (let j = i1 - 1; j >= 0 && m1[j].time >= f0; j--) { const b = m1[j]; f = f ? { time: f0, open: b.open, high: Math.max(f.high, b.high), low: Math.min(f.low, b.low), close: f.close } : { time: f0, open: b.open, high: b.high, low: b.low, close: b.close }; }
          if (f) bars.push(f);
        }
        if (off) bars = bars.map((b) => shiftBar(b, off));   // gold: every timeframe shifted by the one offset, as live
        if (bars.length < 60) { src.bad = true; break; }
        src[id] = { bars, A: msAnalyze(bars, 6) };
      }
      if (src.bad) continue;
      steps++;
      const price = src['1m'].bars.at(-1).close;
      if (!marketOpen(M, t)) continue;
      const exNow = EX.filter((x) => x.market === key && t >= x.from - PAD && t <= x.to + PAD);
      for (const x of exNow) {
        const st = BUILDERS.map(([pr, fn]) => { try { return fn(pr, price, src); } catch (e) { return null; } }).filter((v) => v && (v.sell ? 'sell' : 'buy') === x.side);
        pushChange(x.setups, t, { states: st.map((v) => `${v.k} ${v.state}`).join(', ') || 'none on this side' }, { price: +price.toFixed(2) });
        const why = {}; sweepSetups(src, price, t, why, spreadOf(M, price));
        pushChange(x.sweep, t, why[x.side] || { stage: 'n/a' });
        const info = {}; chochSetups(src, price, t, info, spreadOf(M, price));
        pushChange(x.m15, t, { state: info[x.side] || 'n/a' }, { price: +price.toFixed(2) });
      }
      for (const [pr, fn] of BUILDERS) {
        let st; try { st = fn(pr, price, src); } catch (e) { st = null; }
        if (!st || st.state !== 'READY' || seen.has(st.sig)) continue;
        seen.add(st.sig);
        const side = st.sell ? 'sell' : 'buy';
        if (open.some((x) => x.status !== 'closed' && x.k === st.k && x.side === side && Math.abs(x.t1 - st.t1) <= Math.abs(st.t1) * 1e-5)) continue;
        const def = DEFS.find((p) => p.k === st.k), cfT = +String(st.sig).split('|')[2];
        if (!cfT || t - cfT > FRESH * SEC[def.l]) continue;
        const feat = { d1: d1T(src, t) === (st.sell ? -1 : 1) ? 'with' : 'against', struct: st.retr == null ? 'n/a' : st.retr >= 0.5 ? 'main' : 'internal', session: sessionOf(t), ...structFeat(st.sell, def.l, src, t), m15c: m15cOf(src['15m'].bars, st.sell, t), m15c1: m15cOf(src['15m'].bars, st.sell, t, 1) };
        if (st.k === 'swing') { try { Object.assign(feat, d1AdxFeat(src['1d'].bars, t)); } catch (e) {} }   // tag only (paper sleeve swing-adx), as the live Trader
        try { Object.assign(feat, newsFeat(t)); } catch (e) {}   // news research tag (tier-1 US release within +-120 min), as the live Trader; no rule reads it
        const tr = { m: key, k: st.k, h: def.h, side, entry: st.entry, stop: st.stop, t1: st.t1, t2: st.t2 != null && (st.t2 - st.t1) * (st.sell ? -1 : 1) > 0 ? st.t2 : null, rr: st.rr, opened: t, status: 'pending', feat, mfe: 0 };
        // a market fill is judged as the Trader does (12 Nov 2026, owner approved, item 53): past the stop or target, or inside the
        // engine's minimum stop from the stop (fills.mjs fillCheck), the order is not opened
        const floor = minStopDist(src[def.l].bars, spreadOf(M, price), CFG.minRisk);
        if (st.sell ? price >= st.entry : price <= st.entry) {   // already through the entry: fill at market, like the Trader
          if (fillCheck(side, price, st.stop, st.t1, floor)) continue;
          const r = Math.abs(price - st.stop), rw = (st.t1 - price) * (st.sell ? -1 : 1);
          tr.entry = price; tr.rr = rw / r; tr.status = 'open'; tr.filled = t;
        }
        tr.r0 = Math.abs(tr.entry - tr.stop); tr.cost = tr.r0 > 0 ? costOf(M, tr.entry, tr.filled !== t) / tr.r0 : 0;   // filled at the signal = crossed the limit at market
        if (!(tr.r0 > 0)) continue;
        tr.v = newVariants(tr.stop);
        open.push(tr);
        // its twin entered at market at the signal (same stop and targets): the other entry style, for a fair comparison
        const tw = { ...tr, k: st.k + '@mkt', twin: true, mfe: 0 };
        if (tr.status === 'pending') {
          if (fillCheck(side, price, st.stop, st.t1, floor)) continue;
          const r = Math.abs(price - st.stop), rw = (st.t1 - price) * (st.sell ? -1 : 1);
          Object.assign(tw, { entry: price, rr: rw / r, status: 'open', filled: t });
        }
        tw.r0 = Math.abs(tw.entry - tw.stop); tw.cost = tw.r0 > 0 ? costOf(M, tw.entry, false) / tw.r0 : 0;
        tw.v = newVariants(tw.stop);
        open.push(tw);
      }
      for (const sw of sweepSetups(src, price, t, null, spreadOf(M, price)).concat(chochSetups(src, price, t, null, spreadOf(M, price)))) {
        if (seen.has(sw.sig)) continue; seen.add(sw.sig);
        const side = sw.sell ? 'sell' : 'buy';
        if (open.some((x) => x.status !== 'closed' && x.k === sw.k && x.side === side)) continue;   // one sweep trade per side at a time
        const tr = { m: key, k: sw.k, h: '1h', side, entry: sw.entry, stop: sw.stop, t1: sw.t1, rr: sw.rr, opened: t, filled: t, status: 'open', mfe: 0,
          feat: { d1: d1T(src, t) === (sw.sell ? -1 : 1) ? 'with' : 'against', struct: 'n/a', session: sessionOf(t), ...structFeat(sw.sell, '1m', src, t), m15c: m15cOf(src['15m'].bars, sw.sell, t), m15c1: m15cOf(src['15m'].bars, sw.sell, t, 1) } };
        tr.r0 = Math.abs(tr.entry - tr.stop); tr.cost = tr.r0 > 0 ? costOf(M, tr.entry, false) / tr.r0 : 0;
        tr.v = newVariants(tr.stop);
        open.push(tr);
      }
    }
    for (const x of EX.filter((e) => e.market === key)) {
      for (const tr of all.concat(twins, unfilled, open).filter((v) => v.m === key && v.side === x.side && v.opened >= x.from - 2 * PAD && v.opened <= x.to + 2 * PAD))
        x.caught.push({ setup: tr.k, opened: tr.opened, entry: +tr.entry.toFixed(2), stop: +tr.stop.toFixed(2), target: +tr.t1.toFixed(2), rr: +tr.rr.toFixed(2), filled: !!tr.filled, R: tr.v[0].R == null ? null : +tr.v[0].R.toFixed(2), status: tr.status });
    }
    for (const tr of open) if (tr.status === 'closed') (tr.twin ? twins : all).push(tr); else stillOpen.push(tr);   // closed with pt1 still running: R_pt1 null
    // fill checks (8 Nov, the Trader's snapshot.fillChecks): R_none stops filled at a gapped open and the R lost beyond them, and limit
    // orders missed because the fill candle also reached the target (live-style trades, twins left out)
    const mine = all.filter((x) => x.m === key), gs = mine.filter((x) => x.v[0].gapR);
    meta[key] = { steps, trades: mine.length, open: open.filter((x) => x.status !== 'closed').length,
      gapStops: gs.length, gapR: +gs.reduce((a, x) => a + x.v[0].gapR, 0).toFixed(2), fillTarget: unfilled.filter((x) => x.m === key && x.fillTarget).length };
    console.log(`${key}: ${steps} steps, ${meta[key].trades} closed trades (${meta[key].gapStops} gapped stops, ${meta[key].gapR}R past the stop; ${meta[key].fillTarget} fill+target misses), ${((Date.now() - t0wall) / 1000).toFixed(0)}s`);
  } catch (e) { meta.errors[key] = String(e.message || e); console.log(`${key}: ${e.message || e}`); }
}

// ─── Stats ───
// R_pt1 is null while that paper exit still runs: skipped
const stat = (arr, vi) => { const R = arr.map((x) => x.v[vi].R).filter((r) => r != null); const n = R.length, sum = R.reduce((a, b) => a + b, 0), w = R.filter((r) => r > 0).length;
  return { n, wr: n ? +(w / n).toFixed(3) : null, R: +sum.toFixed(2), exp: n ? +(sum / n).toFixed(3) : null }; };
const byVar = (arr) => Object.fromEntries(VARIANTS.map(([n], vi) => [n, stat(arr, vi)]));
const group = (arr, keyFn) => { const g = {}; for (const x of arr) { const k = keyFn(x); (g[k] = g[k] || []).push(x); } return Object.fromEntries(Object.entries(g).map(([k, a]) => [k, byVar(a)])); };
const rrBand = (x) => x.rr < 1.5 ? '<1.5' : x.rr < 2.5 ? '1.5-2.5' : x.rr < 4 ? '2.5-4' : '4+';
const setups = [...new Set(all.map((x) => x.k))];
const out = {
  at: new Date().toISOString(), days: DAYS, from: new Date(startT * 1000).toISOString(), to: new Date(endT * 1000).toISOString(), fake: FAKE,
  cfg: { buf: CFG.buf, minRisk: CFG.minRisk }, markets: meta, n: all.length,
  overall: byVar(all),
  bySetup: group(all, (x) => x.k),
  byMarket: group(all, (x) => x.m),
  byRR: group(all, rrBand),
  bySetupCond: Object.fromEntries(setups.map((k) => { const a = all.filter((x) => x.k === k); return [k, { d1: group(a, (x) => x.feat.d1), struct: group(a, (x) => x.feat.struct), session: group(a, (x) => x.feat.session), rr: group(a, rrBand) }]; })),
  // status (after m15c1; adx / adxBand follow it, so older column indexes hold): 'closed', 'unfilled' (a resting order that never filled, 0R) or 'open'
  // (still running at the end of the window: R columns null; fill 1 once its entry filled, 0 while the order still rests)
  trades: all.concat(twins, unfilled, stillOpen).map((x) => { const op = x.status === 'open' || x.status === 'pending', st = op ? 'open' : x.status === 'closed' ? 'closed' : 'unfilled';
    return [x.m, x.k, x.side, x.opened, x.filled || null, +x.rr.toFixed(2), x.feat.d1, x.feat.struct, x.feat.session, ...x.v.filter((v) => !v.pt).map((v) => op || v.R == null ? null : +v.R.toFixed(2)), +x.mfe.toFixed(2), +x.cost.toFixed(3), op ? (x.filled ? 1 : 0) : x.status === 'closed' ? 1 : 0, x.feat.cf, x.feat.choch, x.feat.m15c, x.feat.m15c1, st, x.feat.adx ?? null, x.feat.adxBand ?? null, x.feat.newsT1 ?? null, x.feat.newsMin ?? null, ...x.v.filter((v) => v.pt).map((v) => op || v.R == null ? null : +v.R.toFixed(2)), op ? null : +replayFin(x).toFixed(3)]; }),
  tradeCols: ['market', 'setup', 'side', 'opened', 'filled', 'rr', 'd1', 'struct', 'session', 'R_none', 'R_be1', 'R_be15', 'R_tp2', 'mfe', 'cost', 'fill', 'cf', 'choch', 'm15c', 'm15c1', 'status', 'adx', 'adxBand', 'newsT1', 'newsMin', 'R_pt1', 'fin'],   // adx / adxBand (Swing only: D1 ADX(14) tag, paper sleeve swing-adx), then newsT1 / newsMin (news research tag, council/events.mjs), then R_pt1 (paper exit comparison, research/meridian-exits.md), then fin (overnight financing of the R_none exit in R, gold longs; fills.mjs replayFin), appended last so older indexes hold
  twins: twins.length, unfilled: unfilled.length, open: stillOpen.length,
  financing: (() => { const a = all.map((x) => replayFin(x)).filter((f) => f > 0); return { rate: FIN.xau.long, asOf: FIN.xau.asOf, of: 'R_none', trades: a.length, R: +a.reduce((q, f) => q + f, 0).toFixed(2) }; })(),   // what overnight financing took from the live-style trades (column fin)
  examples: EX.map((x) => ({ id: x.id, market: x.market, side: x.side, entry: x.entry, stop: x.stop, target: x.target, entryFrom: x.entryFrom, entryTo: x.entryTo,
    caught: x.caught, setups: x.setups.map(({ s, ...v }) => v), sweep: x.sweep.map(({ s, ...v }) => v), m15: x.m15.map(({ s, ...v }) => v) })),
};
fs.writeFileSync(path.join(DIR, 'backtest.json'), JSON.stringify(out));
// research (BT_DUMP): every filled live-style trade (no market twins) with its levels, cost and the replay's own result, for exit studies
if (process.env.BT_DUMP) fs.writeFileSync(path.join(process.env.BT_DUMP, 'trades.json'), JSON.stringify({ from: out.from, to: out.to, source: meta.source, trades: all.concat(stillOpen.filter((x) => !x.twin && x.filled)).map((x) => ({
  m: x.m, k: x.k, side: x.side, entry: x.entry, stop: x.stop, t1: x.t1, t2: x.t2, rr: x.rr, opened: x.opened, filled: x.filled, r0: x.r0, cost: x.cost, fin: +replayFin(x).toFixed(3), closed: x.v[0].closed ?? null, feat: x.feat, status: x.status, R: Object.fromEntries(x.v.map((v) => [v.n, v.R])), gapR: Object.fromEntries(x.v.filter((v) => v.gapR).map((v) => [v.n, v.gapR])) })) }));
console.log(`\n${all.length} trades over ${DAYS} days (${((Date.now() - t0wall) / 1000).toFixed(0)}s)`);
console.log('overall', JSON.stringify(out.overall));
console.log(`financing (gold longs held over a rollover, R_none exit): ${out.financing.trades} trades, ${out.financing.R}R`);
for (const [k, v] of Object.entries(out.bySetup)) console.log(k.padEnd(9), Object.entries(v).map(([n, s]) => `${n} n${s.n} wr${s.wr} exp${s.exp}`).join(' | '));
for (const [k, v] of Object.entries(out.byRR)) console.log('rr ' + k.padEnd(7), `n${v.none.n} exp${v.none.exp} be1 ${v.be1.exp}`);
for (const k of setups) { const a = all.filter((x) => x.k === k), m = (arr) => arr.length ? (arr.reduce((q, x) => q + x.v[0].R - x.cost - replayFin(x), 0) / arr.length).toFixed(2) : '-';
  console.log(k.padEnd(9), '| M15 CHoCH, 1-candle swing: yes', m(a.filter((x) => x.feat.m15c1 === 'yes')), 'n' + a.filter((x) => x.feat.m15c1 === 'yes').length, 'no', m(a.filter((x) => x.feat.m15c1 === 'no')));
  console.log(k.padEnd(9), '| trader\'s M15 CHoCH within 1 h: yes', m(a.filter((x) => x.feat.m15c === 'yes')), 'n' + a.filter((x) => x.feat.m15c === 'yes').length, 'no', m(a.filter((x) => x.feat.m15c === 'no')));
  if (k === 'swing') console.log(k.padEnd(9), '| D1 ADX 19.4-29.2 (paper tag): in', m(a.filter((x) => x.feat.adxBand === true)), 'n' + a.filter((x) => x.feat.adxBand === true).length, 'out', m(a.filter((x) => x.feat.adxBand === false)), 'n' + a.filter((x) => x.feat.adxBand === false).length);
  console.log(k.padEnd(9), 'net', m(a), '| CF choch', m(a.filter((x) => x.feat.cf === 'choch')), 'n' + a.filter((x) => x.feat.cf === 'choch').length, 'bo', m(a.filter((x) => x.feat.cf === 'bo')), '| M15/M5 CHoCH yes', m(a.filter((x) => x.feat.choch === 'yes')), 'n' + a.filter((x) => x.feat.choch === 'yes').length, 'no', m(a.filter((x) => x.feat.choch === 'no'))); }
for (const x of out.examples) {
  const hm = (t) => new Date(t * 1000).toISOString().slice(11, 16);
  console.log(`\nexample ${x.id} (${x.side} ${x.entry}, stop ${x.stop}, target ${x.target}): ${x.caught.length ? x.caught.map((c) => `${c.setup} ${hm(c.opened)} ${c.entry}/${c.stop}/${c.target} R ${c.R}`).join('; ') : 'no signal from any setup'}`);
  for (const v of x.sweep) console.log(`  sweep ${hm(v.t)} ${v.stage}${v.level != null ? ` (level ${v.level})` : ''}${v.target != null ? ` target ${v.target} rr ${JSON.stringify(v.rr)}` : ''}`);
  for (const v of x.setups) console.log(`  setups ${hm(v.t)} @${v.price}: ${v.states}`);
  for (const v of x.m15) console.log(`  m15 ${hm(v.t)} @${v.price}: ${v.state}`);
}
for (const [k, c] of Object.entries(out.bySetupCond)) console.log(k.padEnd(9), 'd1', Object.entries(c.d1).map(([a, s]) => `${a}:n${s.none.n} ${s.none.exp}`).join(' '), '| struct', Object.entries(c.struct).map(([a, s]) => `${a}:n${s.none.n} ${s.none.exp}`).join(' '));
