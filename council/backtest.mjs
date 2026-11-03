// Council · Backtest: replay past candles through the same engine and rules the Trader uses,
// so the Coach can judge a setup on hundreds of historical trades instead of waiting days for live ones.
// Usage: node council/backtest.mjs <dataDir> [days=30]
// Data: Binance public market data (1m history) for crypto and gold (PAXG); for forex Kraken's trade history (the
// feed the live Trader uses; council/krakenhist.mjs), then Yahoo Finance (yahoo.mjs), then Dukascopy (duka.mjs).
// Entry styles: every signal also gets a twin entered at market (setup '<k>@mkt'), and resting orders that never fill
// are kept as 0R rows (fill = 0), so the Coach can compare the two entry styles signal by signal.
// Costs: every trade carries its spread in R (one spread per round trip: bid/ask), so results can be judged net.
// Writes <dataDir>/backtest.json: expectancy by setup, by condition, by reward:risk, by market, for three
// trade-management variants (no break-even, break-even at +1R, at +1.5R, the second target, and the +2R partial).
import fs from 'node:fs';
import path from 'node:path';
import { msAnalyze, CFG, PAIRS, RETR, buildSetup, buildRetrace, setMarket } from './engine.mjs';
import { dukaMinutes, dukaHours, dukaDays, dukaReset } from './duka.mjs';
import { yahooBars } from './yahoo.mjs';
import { krakenMinutes, krakenOHLC } from './krakenhist.mjs';
import { m15Choch, m15cFeat as m15cOf } from './choch.mjs';

const DIR = process.argv[2] || 'data', DAYS = +(process.argv[3] || 30);
const FAKE = !!process.env.BT_FAKE;   // offline self-test with a synthetic random walk
const MARKETS = {
  xau: { label: 'XAU/USD', name: 'Gold', group: 'Metals', sym: 'PAXGUSDT', dec: 1, spot: true },
  btc: { label: 'BTC/USD', name: 'Bitcoin', group: 'Crypto', sym: 'BTCUSDT', dec: 1 },
  eth: { label: 'ETH/USD', name: 'Ethereum', group: 'Crypto', sym: 'ETHUSDT', dec: 2 },
  sol: { label: 'SOL/USD', name: 'Solana', group: 'Crypto', sym: 'SOLUSDT', dec: 2 },
  xrp: { label: 'XRP/USD', name: 'XRP', group: 'Crypto', sym: 'XRPUSDT', dec: 4 },
  eurusd: { label: 'EUR/USD', name: 'Euro', group: 'Forex', duka: 'EURUSD', kraken: 'EURUSD', yahoo: 'EURUSD=X', dec: 5 },
  gbpusd: { label: 'GBP/USD', name: 'Pound', group: 'Forex', duka: 'GBPUSD', kraken: 'GBPUSD', yahoo: 'GBPUSD=X', dec: 5 },
  audusd: { label: 'AUD/USD', name: 'Aussie', group: 'Forex', duka: 'AUDUSD', kraken: 'AUDUSD', yahoo: 'AUDUSD=X', dec: 5 },
  usdcad: { label: 'USD/CAD', name: 'Loonie', group: 'Forex', duka: 'USDCAD', kraken: 'USDCAD', yahoo: 'USDCAD=X', dec: 5 },
  usdchf: { label: 'USD/CHF', name: 'Swissy', group: 'Forex', duka: 'USDCHF', kraken: 'USDCHF', yahoo: 'USDCHF=X', dec: 5 },
};
// research runs: BT_MARKETS=xau,btc replays only those markets (one Actions job per market)
if (process.env.BT_MARKETS) for (const k of Object.keys(MARKETS)) if (!process.env.BT_MARKETS.split(',').includes(k)) delete MARKETS[k];
const TFS = [['1d', '1d', 86400], ['4h', '4h', 14400], ['1h', '1h', 3600], ['30m', '30m', 1800], ['15m', '15m', 900], ['5m', '5m', 300], ['1m', '1m', 60]];
const SEC = Object.fromEntries(TFS.map(([id, , s]) => [id, s]));
const WAIT = { '1d': 5 * 86400, '4h': 2 * 86400, '1h': 12 * 3600, '15m': 3 * 3600 };
const FRESH = 12, WIN = 720, STEP = 300;
// trade management variants: [name, break-even level, hold to the second target, +2R partial]
// pt2: on a trade whose target is more than PARTIAL.over R away, bank PARTIAL.frac of it at +PARTIAL.at R and move the
// stop to the entry for the rest (the same rule as the Trader's config.partial)
const PARTIAL = { at: 2, over: 5, frac: 0.5 };
const VARIANTS = [['none', null, false, false], ['be1', 1, false, false], ['be15', 1.5, false, false], ['tp2', null, true, false], ['pt2', null, false, true], ['ts4', null, false, false, 4], ['ts8', null, false, false, 8], ['ts12', null, false, false, 12]];
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
  for (const host of ['https://data-api.binance.vision', 'https://api.binance.com']) {
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
function aggregate(m1, sec) {
  const out = []; let cur = null;
  for (const b of m1) {
    const t0 = Math.floor(b.time / sec) * sec;
    if (!cur || cur.time !== t0) { cur = { time: t0, open: b.open, high: b.high, low: b.low, close: b.close }; out.push(cur); }
    else { cur.high = Math.max(cur.high, b.high); cur.low = Math.min(cur.low, b.low); cur.close = b.close; }
  }
  return out;
}

// One trade, managed on 1m candles, under one break-even variant
function manage(v, tr, b) {
  if (v.done) return;
  const s = tr.side === 'sell', r0 = tr.r0;
  // after a partial: PARTIAL.frac is banked at +PARTIAL.at R, the rest rides to the target or back to the entry
  const bank = v.part ? PARTIAL.frac * PARTIAL.at : 0, rest = v.part ? 1 - PARTIAL.frac : 1;
  if (s ? b.high >= v.stop : b.low <= v.stop) { v.done = true; v.R = v.part ? bank : v.beMoved ? 0 : -1; v.closed = b.time; return; }
  const tgt = v.t2 && tr.t2 != null ? tr.t2 : tr.t1;
  if (s ? b.low <= tgt : b.high >= tgt) { v.done = true; v.R = bank + rest * (tgt === tr.t1 ? tr.rr : Math.abs(tgt - tr.entry) / r0); v.closed = b.time; return; }
  // research time stop: out at the candle's close once the trade has been open ts hours
  if (v.ts && tr.filled && b.time - tr.filled >= v.ts * 3600) { v.done = true; v.R = (s ? tr.entry - b.close : b.close - tr.entry) / r0; v.closed = b.time; return; }
  if (v.pt && !v.part && tr.rr > PARTIAL.over && ((s ? tr.entry - b.low : b.high - tr.entry) / r0) >= PARTIAL.at) { v.part = true; v.stop = tr.entry; v.beMoved = true; }
  if (v.be && !v.beMoved && ((s ? tr.entry - b.low : b.high - tr.entry) / r0) >= v.be) { v.stop = tr.entry; v.beMoved = true; }
}

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
// ─── Research: the Asia liquidity run (JeaFX notes, 2 Nov) ───
// Asia range = 00:00–07:00 UTC. Between 07:00 and 12:00 UTC (pre-London, early London): price sweeps the range high (low),
// then structure reverses (the 5m, or 1m for asia1, breaks the other way after the sweep) and price is back inside the range:
// sell (buy) at market, stop past the sweep extreme, target the opposite side of the Asian range. One per side per day.
function asiaRun(src, price, t, spr = 0) {
  const out = [], d = Math.floor(t / 86400) * 86400;
  if (t < d + 7 * 3600 || t >= d + 12 * 3600) return out;
  const b5 = src['5m'].bars, asia = b5.filter((b) => b.time >= d && b.time < d + 7 * 3600);
  if (asia.length < 60) return out;
  const AH = Math.max(...asia.map((b) => b.high)), AL = Math.min(...asia.map((b) => b.low)), rng = AH - AL;
  if (!(rng > 0)) return out;
  const after = b5.filter((b) => b.time >= d + 7 * 3600);
  for (const sell of [true, false]) {
    const sw = after.findIndex((b) => sell ? b.high > AH : b.low < AL);
    if (sw < 0) continue;
    const swT = after[sw].time, ext = after.slice(sw).reduce((m, b) => sell ? Math.max(m, b.high) : Math.min(m, b.low), sell ? -Infinity : Infinity);
    if (sell ? price >= AH : price <= AL) continue;   // not back inside the range yet
    for (const [k, tf] of [['asia', '5m'], ['asia1', '1m']]) {
      const A = src[tf].A, ll = A.last;
      if (!ll || ll.dir !== (sell ? -1 : 1) || src[tf].bars[ll.breakIdx].time <= swT) continue;
      const buf = Math.max(3 * spr, 0.05 * rng), stop = ext + (sell ? buf : -buf), t1 = sell ? AL : AH;
      const r = Math.abs(stop - price), rr = Math.abs(t1 - price) / r;
      if (!(r > 0) || rr < 1) continue;
      out.push({ k, sell, entry: price, stop, t1, t2: price + (sell ? -3 : 3) * r, rr, sig: `${k}|${d}|${sell ? 's' : 'b'}` });
    }
  }
  return out;
}

// ─── Research: the Daily Cycle (Liquidity Trading notes, 2 Nov) ───
// London (07:00–12:00 UTC) sets the bias: bullish when London's low came before its high and price is above the London open
// at 12:00 (bearish mirrored). In the New York open (12:00–15:00 UTC), when price retraces into 62–70% of the London leg
// (the OTE), buy (sell) at the 62% level, stop past the London low (high), target 3R; R_ts8 shows closing before day end.
function dailyCycle(src, price, t, spr = 0) {
  const out = [], d = Math.floor(t / 86400) * 86400;
  if (t < d + 12 * 3600 || t >= d + 15 * 3600) return out;
  const b5 = src['5m'].bars, ldn = b5.filter((b) => b.time >= d + 7 * 3600 && b.time < d + 12 * 3600);
  if (ldn.length < 50) return out;
  let hi = -Infinity, lo = Infinity, hiT = 0, loT = 0;
  for (const b of ldn) { if (b.high > hi) { hi = b.high; hiT = b.time; } if (b.low < lo) { lo = b.low; loT = b.time; } }
  const open = ldn[0].open, close = ldn[ldn.length - 1].close, leg = hi - lo;
  if (!(leg > 0)) return out;
  const bull = loT < hiT && close > open, bear = hiT < loT && close < open;
  if (!bull && !bear) return out;
  const ny = b5.filter((b) => b.time >= d + 12 * 3600);
  if (bull && ny.some((b) => b.low < lo)) return out;    // London low taken: the bias failed
  if (bear && ny.some((b) => b.high > hi)) return out;
  const e62 = bull ? hi - 0.62 * leg : lo + 0.62 * leg, e70 = bull ? hi - 0.70 * leg : lo + 0.70 * leg;
  if (bull ? !(price <= e62 && price >= e70) : !(price >= e62 && price <= e70)) return out;
  const buf = Math.max(3 * spr, 0.05 * leg), stop = bull ? lo - buf : hi + buf, r = Math.abs(price - stop);
  if (!(r > 0)) return out;
  out.push({ k: 'cycle', sell: bear, entry: price, stop, t1: price + (bull ? 3 : -3) * r, t2: bull ? hi : lo, rr: 3, sig: `cycle|${d}` });
  return out;
}

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
// Fair value gaps (imbalance): a 3-candle gap, bull when candle i-1's high is below candle i+1's low (bear the mirror). It counts
// until a later candle trades through its far side. fvgIn = an unfilled gap the trade's way, made in the last `look` closed
// candles, contains the price `lvl`; fvgSince = a gap the trade's way was made after time `since` (displacement after the CF).
// Bad prints: thin feeds (Kraken FX trades, stitched Yahoo/Dukascopy) carry the odd off-market tick that makes a 1,000-pip
// candle and a fake 160R trade. A wick longer than 50 times the median candle range of the last 100 candles is clipped to the
// body plus one median range; a candle whose body jumps 50 ranges away and comes straight back is flattened to the prior close.
// Forex (opts.wickK = 15) also clips a lone wick past 15 ranges that the next 3 candles never trade back into: on
// 3 Nov 10:12 one Kraken order spiked AUD/USD 35 pips for a minute (Yahoo saw nothing) and hit five stops. News spikes get revisited.
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
function fvgScan(bars, sell, look = 60) {
  const out = [], n = bars.length - 1;   // the last bar is still forming
  for (let i = Math.max(1, n - look); i < n - 1; i++) {
    const a = bars[i - 1], c = bars[i + 1];
    const lo = sell ? c.high : a.high, hi = sell ? a.low : c.low;
    if (!(hi > lo)) continue;
    let alive = true;
    for (let j = i + 2; j < n; j++) if (sell ? bars[j].high >= hi : bars[j].low <= lo) { alive = false; break; }
    out.push({ lo, hi, t: bars[i].time, alive });
  }
  return out;
}
// Key levels (quarter theory: .00/.25/.50/.75): a round step near 0.25% of price (EUR/USD 0.0025, gold 10, BTC 250)
function keyStep(price) { const raw = price * 0.0025, e = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / e; return (m < 1.6 ? 1 : m < 3.5 ? 2.5 : m < 7.5 ? 5 : 10) * e; }
function keyFeat(entry, stop) {
  const s = keyStep(entry), r = Math.abs(entry - stop), near = Math.round(entry / s) * s;
  const lo = Math.min(entry, stop), hi = Math.max(entry, stop), k = Math.ceil(lo / s) * s;
  return { kl: Math.abs(entry - near) <= 0.25 * r ? 'near' : 'far', klStop: k < hi && k > lo ? 'yes' : 'no' };
}
function structFeat(sell, l, src, at) {
  const dir = sell ? -1 : 1, lp = src[l], ll = lp && lp.A && lp.A.last;
  const cf = ll && ll.dir === dir && ll.structure ? 'choch' : 'bo';
  const choch = ['15m', '5m'].some((id) => { const s = src[id]; return s && s.A && s.A.events.some((e) => e.dir === dir && e.structure && at - s.bars[e.breakIdx].time <= FRESH * SEC[id]); }) ? 'yes' : 'no';
  return { cf, choch };
}
// typical spread (same model as the trade reviews): one spread is paid per round trip
const spreadOf = (M, price) => M.group === 'Forex' ? 0.0001 : M.spot ? 0.3 : price * 0.0002;
// research: the Mosha notes' barrier formula pairs H4 with M15 (the engine's swing uses H4 → H1)
const PAIRS_R = PAIRS.concat([{ k: 'swing15', name: 'Swing M15', h: '4h', l: '15m', e: 'M15 / M1', up: '1d' }]);
const BUILDERS = PAIRS_R.map((p) => [p, buildSetup]).concat(RETR.map((p) => [p, buildRetrace]));
const DEFS = PAIRS_R.concat(RETR);
const all = [], twins = [], unfilled = [], meta = { errors: {} };   // closed trades; their market-entry twins; resting orders that never filled
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
  try {
    const data = {};
    if (FAKE) {
      const m1 = fakeBars(startT - 760 * 86400, endT, key.length * 7919 + 1);
      for (const [id, , sec] of TFS) data[id] = id === '1m' ? m1.filter((b) => b.time >= startT - WIN * 60) : aggregate(m1, sec);
    } else if (M.duka) {
      // forex: every timeframe straight from Yahoo (1m only reaches back ~29.5 days, so the replay starts once
      // 720 1m candles exist); if Yahoo fails, Dukascopy's files: 1m (5m/15m/30m built from it), 1h monthly, 1d yearly
      let done = false;
      try {   // 1. Kraken trades → 1m (38 days, cached per day); 1h = Kraken's 720 hourly candles plus older hours from the trades; 4h/1d = Kraken OHLC
        const tr0 = Date.now(), K = await krakenMinutes(M.kraken, startT - 8 * 86400, endT, { cacheDir: process.env.DUKA_CACHE || null, budget: +(process.env.KRAKEN_BUDGET || 400) }), m1 = K.bars;
        if (m1.length < 5000) throw new Error(`only ${m1.length} 1m candles (${K.calls} calls, ${K.cached} days cached)`);
        meta.coverage = Object.assign(meta.coverage || {}, { [key]: new Date(K.from * 1000).toISOString().slice(0, 10) });
        const o60 = await krakenOHLC(M.kraken, 60), o240 = await krakenOHLC(M.kraken, 240), o1440 = await krakenOHLC(M.kraken, 1440);
        const firstH = o60.length ? o60[0].time : Infinity, h1 = aggregate(m1.filter((b) => b.time < firstH), 3600).concat(o60);
        Object.assign(data, { '1m': m1, '5m': aggregate(m1, 300), '15m': aggregate(m1, 900), '30m': aggregate(m1, 1800), '1h': h1, '4h': o240, '1d': o1440 });
        meta.source = Object.assign(meta.source || {}, { [key]: 'Kraken' });
        console.log(`${key}: Kraken 1m from ${meta.coverage[key]} (${K.cached} days cached, ${K.fetched} downloaded, ${K.calls} calls) → ${m1.length} 1m candles, ${h1.length} 1h, ${o240.length} 4h, ${o1440.length} 1d (${((Date.now() - tr0) / 1000).toFixed(0)}s)`);
        done = true;
      } catch (ke) { console.log(`${key}: Kraken history failed (${ke.message}); trying Yahoo`); }
      if (!done) try {
        const y = async (iv, back) => yahooBars(M.yahoo, iv, back, endT);
        const m1 = await y('1m', startT - WIN * 60);
        if (m1.length < 5000) throw new Error(`only ${m1.length} 1m candles`);
        const h1 = await y('60m', startT - (WIN + 2) * 3600);
        Object.assign(data, { '1m': m1, '5m': await y('5m', startT - (WIN + 2) * 300), '15m': await y('15m', startT - (WIN + 2) * 900), '30m': await y('30m', startT - (WIN + 2) * 1800),
          '1h': h1, '4h': aggregate(h1, 14400), '1d': await y('1d', startT - 1100 * 86400) });
        meta.source = Object.assign(meta.source || {}, { [key]: 'Yahoo' });
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
        meta.source = Object.assign(meta.source || {}, { [key]: 'Dukascopy' });
        console.log(`${key}: ${m1.length} 1m, ${h1.length} 1h, ${d1.length} 1d candles from Dukascopy`);
      }
    } else {
      for (const [id, iv, sec] of TFS) data[id] = await klines(M.sym, iv, startT - (WIN + 2) * sec, endT);
    }
    if (!FAKE) {
      const fx = Object.fromEntries(Object.entries(data).map(([id, arr]) => [id, cleanBars(arr, M.group === 'Forex' && ['1m', '5m', '15m', '30m'].includes(id) ? { wickK: 15 } : {})]).filter(([, n]) => n));
      if (Object.keys(fx).length) { meta.cleaned = Object.assign(meta.cleaned || {}, { [key]: fx }); console.log(`${key}: bad prints clipped`, fx); }
    }
    const m1 = data['1m'];
    setMarket(M);
    const ptr = Object.fromEntries(TFS.map(([id]) => [id, 0]));
    const seen = new Set(), open = [], touches = new Map();
    let i1 = 0, steps = 0;
    for (let t = startT; t <= endT; t += STEP) {
      // manage open trades on the 1m candles of the last step
      while (i1 < m1.length && m1[i1].time < t) {
        const b = m1[i1++];
        for (const tr of open) {
          if (tr.status === 'pending') {
            if (b.time < tr.opened) continue;
            const s = tr.side === 'sell';
            if (s ? b.high >= tr.entry : b.low <= tr.entry) { tr.status = 'open'; tr.filled = b.time; }
            else if (s ? b.low <= tr.t1 : b.high >= tr.t1) { tr.status = 'missed'; tr.ended = b.time; continue; }
            else { if (b.time - tr.opened > (WAIT[tr.h] || 86400)) { tr.status = 'expired'; tr.ended = b.time; } continue; }
          }
          if (tr.status !== 'open') continue;
          const s = tr.side === 'sell';
          tr.mfe = Math.max(tr.mfe, (s ? tr.entry - b.low : b.high - tr.entry) / tr.r0);
          for (const v of tr.v) manage(v, tr, b);
          if (tr.v.every((v) => v.done)) tr.status = 'closed';
        }
        for (let k = open.length - 1; k >= 0; k--) if (open[k].status !== 'pending' && open[k].status !== 'open') { const tr = open.splice(k, 1)[0]; if (tr.status === 'closed') (tr.twin ? twins : all).push(tr); else if (!tr.twin) { tr.v.forEach((v) => { v.R = 0; }); tr.cost = 0; unfilled.push(tr); } }
      }
      if (i1 < WIN) continue;
      // the Trader's view at time t: the last 720 closed candles of every timeframe plus the forming one
      const src = {};
      for (const [id, , sec] of TFS) {
        const arr = data[id]; let p = ptr[id];
        while (p < arr.length && arr[p].time + sec <= t) p++;
        ptr[id] = p;
        const bars = arr.slice(Math.max(0, p - (WIN - 1)), p);
        if (id !== '1m') {
          const f0 = Math.floor(t / sec) * sec; let f = null;
          for (let j = i1 - 1; j >= 0 && m1[j].time >= f0; j--) { const b = m1[j]; f = f ? { time: f0, open: b.open, high: Math.max(f.high, b.high), low: Math.min(f.low, b.low), close: f.close } : { time: f0, open: b.open, high: b.high, low: b.low, close: b.close }; }
          if (f) bars.push(f);
        }
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
        if (open.some((x) => x.k === st.k && x.side === side && Math.abs(x.t1 - st.t1) <= Math.abs(st.t1) * 1e-5)) continue;
        const def = DEFS.find((p) => p.k === st.k), cfT = +String(st.sig).split('|')[2];
        if (!cfT || t - cfT > FRESH * SEC[def.l]) continue;
        const feat = { d1: src['1d'].A.trend === (st.sell ? -1 : 1) ? 'with' : 'against', struct: st.retr == null ? 'n/a' : st.retr >= 0.5 ? 'main' : 'internal', session: sessionOf(t), ...structFeat(st.sell, def.l, src, t), m15c: m15cOf(src['15m'].bars, st.sell, t), m15c1: m15cOf(src['15m'].bars, st.sell, t, 1),
          h4: src['4h'].A.trend === (st.sell ? -1 : 1) ? 'with' : 'against', h1: src['1h'].A.trend === (st.sell ? -1 : 1) ? 'with' : 'against' };
        // features from the trader's notes (research): Janda = the lower timeframe printed a BO Structure and then a BO the same
        // way (two breaks, "breakout 2 times"); vrAge = how soon after the higher-timeframe VR the CF came ("a CF right after the
        // VR likely fails"); touch = which signal this is from the same higher-timeframe Origin (fresh zone = the first)
        try {
          const le = src[def.l].A.events, e1 = le[le.length - 1], e0 = le[le.length - 2];
          feat.janda = e1 && e0 && !e1.structure && e0.structure && e0.dir === e1.dir ? 'yes' : 'no';
          const he = src[def.h].A.last, hb = src[def.h].bars;
          feat.vrAge = !he || !he.vr ? 'novr' : (cfT - hb[he.vr.i].time) / SEC[def.h] <= 3 ? 'fast' : 'slow';
          const okey = String(st.sig).split('|').slice(0, 2).join('|'), nT = (touches.get(okey) || 0) + 1; touches.set(okey, nT);
          feat.touch = nT === 1 ? 'first' : nT === 2 ? 'second' : 'third+';
          // Photon's fractal chain (HTF trend → MTF CHoCH → LTF CHoCH): upTF = the timeframe above the setup's zone trends the
          // trade's way ("4H is bullish"); ltfChoch = the timeframe below the CF has since printed a CHoCH the same way
          // ("M1 CHoCH confirms the M15 higher low")
          if (st.align !== null && st.align !== undefined) feat.upTF = st.align ? 'with' : 'against';
          const below = { '1h': '15m', '15m': '1m', '5m': '1m' }[def.l];
          if (below && src[below]) { const bl = src[below].A.last, bb = src[below].bars;
            feat.ltfChoch = bl && bl.structure && bl.dir === (st.sell ? -1 : 1) && bb[bl.breakIdx].time >= cfT ? 'yes' : 'no'; }
          // imbalance and key levels (JeaFX, Liquidity Trading): fvgH = the entry sits in an unfilled HTF gap the trade's way;
          // fvgL = the confirming timeframe left a gap the trade's way after the CF (displacement); kl / klStop = key levels
          feat.fvgH = fvgScan(src[def.h].bars, st.sell).some((g) => g.alive && st.entry >= g.lo && st.entry <= g.hi) ? 'in' : 'out';
          feat.fvgL = fvgScan(src[def.l].bars, st.sell, 120).some((g) => g.t >= cfT) ? 'yes' : 'no';
          Object.assign(feat, keyFeat(st.entry, st.stop));
        } catch (e) {}
        const tr = { m: key, k: st.k, h: def.h, side, entry: st.entry, stop: st.stop, t1: st.t1, t2: st.t2 != null && (st.t2 - st.t1) * (st.sell ? -1 : 1) > 0 ? st.t2 : null, rr: st.rr, opened: t, status: 'pending', feat, mfe: 0 };
        if (st.sell ? price >= st.entry : price <= st.entry) {   // already through the entry: fill at market, like the Trader
          const r = Math.abs(price - st.stop), rw = (st.t1 - price) * (st.sell ? -1 : 1);
          if (!(r > 0) || (st.sell ? price >= st.stop : price <= st.stop) || rw <= 0) continue;
          tr.entry = price; tr.rr = rw / r; tr.status = 'open'; tr.filled = t;
        }
        tr.r0 = Math.abs(tr.entry - tr.stop); tr.cost = tr.r0 > 0 ? spreadOf(M, tr.entry) / tr.r0 : 0;
        if (!(tr.r0 > 0)) continue;
        tr.v = VARIANTS.map(([n, be, t2, pt, ts]) => ({ n, be, t2, pt, ts, stop: tr.stop, beMoved: false, done: false, R: null }));
        open.push(tr);
        // its twin entered at market at the signal (same stop and targets): the other entry style, for a fair comparison
        const tw = { ...tr, k: st.k + '@mkt', twin: true, mfe: 0 };
        if (tr.status === 'pending') {
          const r = Math.abs(price - st.stop), rw = (st.t1 - price) * (st.sell ? -1 : 1);
          if (!(r > 0) || (st.sell ? price >= st.stop : price <= st.stop) || rw <= 0) continue;
          Object.assign(tw, { entry: price, rr: rw / r, status: 'open', filled: t });
        }
        tw.r0 = Math.abs(tw.entry - tw.stop); tw.cost = tw.r0 > 0 ? spreadOf(M, tw.entry) / tw.r0 : 0;
        tw.v = VARIANTS.map(([n, be, t2, pt, ts]) => ({ n, be, t2, pt, ts, stop: tw.stop, beMoved: false, done: false, R: null }));
        open.push(tw);
      }
      for (const sw of sweepSetups(src, price, t, null, spreadOf(M, price)).concat(chochSetups(src, price, t, null, spreadOf(M, price)), asiaRun(src, price, t, spreadOf(M, price)), dailyCycle(src, price, t, spreadOf(M, price)))) {
        if (seen.has(sw.sig)) continue; seen.add(sw.sig);
        const side = sw.sell ? 'sell' : 'buy';
        if (open.some((x) => x.k === sw.k && x.side === side)) continue;   // one sweep trade per side at a time
        const tr = { m: key, k: sw.k, h: '1h', side, entry: sw.entry, stop: sw.stop, t1: sw.t1, t2: sw.t2 != null ? sw.t2 : null, rr: sw.rr, opened: t, filled: t, status: 'open', mfe: 0,
          feat: { d1: src['1d'].A.trend === (sw.sell ? -1 : 1) ? 'with' : 'against', struct: 'n/a', session: sessionOf(t), ...structFeat(sw.sell, '1m', src, t), m15c: m15cOf(src['15m'].bars, sw.sell, t), m15c1: m15cOf(src['15m'].bars, sw.sell, t, 1) } };
        tr.r0 = Math.abs(tr.entry - tr.stop); tr.cost = tr.r0 > 0 ? spreadOf(M, tr.entry) / tr.r0 : 0;
        tr.v = VARIANTS.map(([n, be, t2, pt, ts]) => ({ n, be, t2, pt, ts, stop: tr.stop, beMoved: false, done: false, R: null }));
        open.push(tr);
      }
    }
    for (const x of EX.filter((e) => e.market === key)) {
      for (const tr of all.concat(twins, unfilled, open).filter((v) => v.m === key && v.side === x.side && v.opened >= x.from - 2 * PAD && v.opened <= x.to + 2 * PAD))
        x.caught.push({ setup: tr.k, opened: tr.opened, entry: +tr.entry.toFixed(2), stop: +tr.stop.toFixed(2), target: +tr.t1.toFixed(2), rr: +tr.rr.toFixed(2), filled: !!tr.filled, R: tr.v[0].R == null ? null : +tr.v[0].R.toFixed(2), status: tr.status });
    }
    meta[key] = { steps, trades: all.filter((x) => x.m === key).length };
    console.log(`${key}: ${steps} steps, ${meta[key].trades} closed trades, ${((Date.now() - t0wall) / 1000).toFixed(0)}s`);
  } catch (e) { meta.errors[key] = String(e.message || e); console.log(`${key}: ${e.message || e}`); }
}

// ─── Stats ───
const stat = (arr, vi) => { const R = arr.map((x) => x.v[vi].R); const n = R.length, sum = R.reduce((a, b) => a + b, 0), w = R.filter((r) => r > 0).length;
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
  trades: all.concat(twins, unfilled).map((x) => [x.m, x.k, x.side, x.opened, x.filled || null, +x.rr.toFixed(2), x.feat.d1, x.feat.struct, x.feat.session, ...x.v.map((v) => v.R == null ? null : +v.R.toFixed(2)), +x.mfe.toFixed(2), +x.cost.toFixed(3), x.status === 'closed' ? 1 : 0, x.feat.cf, x.feat.choch, x.feat.m15c, x.feat.m15c1, x.feat.h4 || null, x.feat.h1 || null, x.v[0].closed || x.ended || null, x.h, x.feat.janda || null, x.feat.vrAge || null, x.feat.touch || null, x.feat.upTF || null, x.feat.ltfChoch || null, x.feat.fvgH || null, x.feat.fvgL || null, x.feat.kl || null, x.feat.klStop || null, x.v[3].closed || x.ended || null]),
  tradeCols: ['market', 'setup', 'side', 'opened', 'filled', 'rr', 'd1', 'struct', 'session', 'R_none', 'R_be1', 'R_be15', 'R_tp2', 'R_pt2', 'R_ts4', 'R_ts8', 'R_ts12', 'mfe', 'cost', 'fill', 'cf', 'choch', 'm15c', 'm15c1', 'h4', 'h1', 'closed', 'tf', 'janda', 'vrAge', 'touch', 'upTF', 'ltfChoch', 'fvgH', 'fvgL', 'kl', 'klStop', 'closedT2'],
  twins: twins.length, unfilled: unfilled.length,
  examples: EX.map((x) => ({ id: x.id, market: x.market, side: x.side, entry: x.entry, stop: x.stop, target: x.target, entryFrom: x.entryFrom, entryTo: x.entryTo,
    caught: x.caught, setups: x.setups.map(({ s, ...v }) => v), sweep: x.sweep.map(({ s, ...v }) => v), m15: x.m15.map(({ s, ...v }) => v) })),
};
fs.writeFileSync(path.join(DIR, 'backtest.json'), JSON.stringify(out));
console.log(`\n${all.length} trades over ${DAYS} days (${((Date.now() - t0wall) / 1000).toFixed(0)}s)`);
console.log('overall', JSON.stringify(out.overall));
for (const [k, v] of Object.entries(out.bySetup)) console.log(k.padEnd(9), Object.entries(v).map(([n, s]) => `${n} n${s.n} wr${s.wr} exp${s.exp}`).join(' | '));
for (const [k, v] of Object.entries(out.byRR)) console.log('rr ' + k.padEnd(7), `n${v.none.n} exp${v.none.exp} be1 ${v.be1.exp}`);
for (const k of setups) { const a = all.filter((x) => x.k === k), m = (arr) => arr.length ? (arr.reduce((q, x) => q + x.v[0].R - x.cost, 0) / arr.length).toFixed(2) : '-';
  console.log(k.padEnd(9), '| M15 CHoCH, 1-candle swing: yes', m(a.filter((x) => x.feat.m15c1 === 'yes')), 'n' + a.filter((x) => x.feat.m15c1 === 'yes').length, 'no', m(a.filter((x) => x.feat.m15c1 === 'no')));
  console.log(k.padEnd(9), '| trader\'s M15 CHoCH within 1 h: yes', m(a.filter((x) => x.feat.m15c === 'yes')), 'n' + a.filter((x) => x.feat.m15c === 'yes').length, 'no', m(a.filter((x) => x.feat.m15c === 'no')));
  console.log(k.padEnd(9), 'net', m(a), '| CF choch', m(a.filter((x) => x.feat.cf === 'choch')), 'n' + a.filter((x) => x.feat.cf === 'choch').length, 'bo', m(a.filter((x) => x.feat.cf === 'bo')), '| M15/M5 CHoCH yes', m(a.filter((x) => x.feat.choch === 'yes')), 'n' + a.filter((x) => x.feat.choch === 'yes').length, 'no', m(a.filter((x) => x.feat.choch === 'no'))); }
for (const x of out.examples) {
  const hm = (t) => new Date(t * 1000).toISOString().slice(11, 16);
  console.log(`\nexample ${x.id} (${x.side} ${x.entry}, stop ${x.stop}, target ${x.target}): ${x.caught.length ? x.caught.map((c) => `${c.setup} ${hm(c.opened)} ${c.entry}/${c.stop}/${c.target} R ${c.R}`).join('; ') : 'no signal from any setup'}`);
  for (const v of x.sweep) console.log(`  sweep ${hm(v.t)} ${v.stage}${v.level != null ? ` (level ${v.level})` : ''}${v.target != null ? ` target ${v.target} rr ${JSON.stringify(v.rr)}` : ''}`);
  for (const v of x.setups) console.log(`  setups ${hm(v.t)} @${v.price}: ${v.states}`);
  for (const v of x.m15) console.log(`  m15 ${hm(v.t)} @${v.price}: ${v.state}`);
}
for (const [k, c] of Object.entries(out.bySetupCond)) console.log(k.padEnd(9), 'd1', Object.entries(c.d1).map(([a, s]) => `${a}:n${s.none.n} ${s.none.exp}`).join(' '), '| struct', Object.entries(c.struct).map(([a, s]) => `${a}:n${s.none.n} ${s.none.exp}`).join(' '));
