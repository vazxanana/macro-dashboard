// Council · Backtest: replay past candles through the same engine and rules the Trader uses,
// so the Coach can judge a setup on hundreds of historical trades instead of waiting days for live ones.
// Usage: node council/backtest.mjs <dataDir> [days=30]
// Data: Binance public market data (1m history) for crypto and gold (PAXG); for forex Kraken's trade history (the
// feed the live Trader uses; council/krakenhist.mjs), then Yahoo Finance (yahoo.mjs), then Dukascopy (duka.mjs).
// Entry styles: every signal also gets a twin entered at market (setup '<k>@mkt'), and resting orders that never fill
// are kept as 0R rows (fill = 0), so the Coach can compare the two entry styles signal by signal.
// Costs: every trade carries its spread in R (one spread per round trip: bid/ask), so results can be judged net.
// Writes <dataDir>/backtest.json: expectancy by setup, by condition, by reward:risk, by market, for three
// trade-management variants (no break-even, break-even at +1R, at +1.5R).
import fs from 'node:fs';
import path from 'node:path';
import { msAnalyze, CFG, PAIRS, RETR, buildSetup, buildRetrace, setMarket } from './engine.mjs';
import { dukaMinutes, dukaHours, dukaDays, dukaReset } from './duka.mjs';
import { yahooBars } from './yahoo.mjs';
import { krakenTrades, minuteCandles, krakenOHLC } from './krakenhist.mjs';

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
const TFS = [['1d', '1d', 86400], ['4h', '4h', 14400], ['1h', '1h', 3600], ['30m', '30m', 1800], ['15m', '15m', 900], ['5m', '5m', 300], ['1m', '1m', 60]];
const SEC = Object.fromEntries(TFS.map(([id, , s]) => [id, s]));
const WAIT = { '1d': 5 * 86400, '4h': 2 * 86400, '1h': 12 * 3600, '15m': 3 * 3600 };
const FRESH = 12, WIN = 720, STEP = 300;
// trade management variants: [name, break-even level, hold to the second target]
const VARIANTS = [['none', null, false], ['be1', 1, false], ['be15', 1.5, false], ['tp2', null, true]];
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
  if (s ? b.high >= v.stop : b.low <= v.stop) { v.done = true; v.R = v.beMoved ? 0 : -1; v.closed = b.time; return; }
  const tgt = v.t2 && tr.t2 != null ? tr.t2 : tr.t1;
  if (s ? b.low <= tgt : b.high >= tgt) { v.done = true; v.R = tgt === tr.t1 ? tr.rr : Math.abs(tgt - tr.entry) / r0; v.closed = b.time; return; }
  if (v.be && !v.beMoved && ((s ? tr.entry - b.low : b.high - tr.entry) / r0) >= v.be) { v.stop = tr.entry; v.beMoved = true; }
}

// ─── Research setup: liquidity sweep → VR → BO (the user's marked gold trade, 2 Nov) ───
// M30 wicks beyond a recent M30 swing high (low) and closes back inside it = the sweep; then M5 breaks structure the
// other way = the VR; then a fresh M1 BO the same way = the entry, at market. Target: the nearest still-valid opposing
// M30/H1 Origin. Two stops are tested as separate setups: past the M5 VR structure (sweep_vr) and past the sweep extreme (sweep_ext).
function atr(bars, n = 14) { const b = bars.slice(-n - 1); let s = 0; for (let i = 1; i < b.length; i++) s += Math.max(b[i].high - b[i].low, Math.abs(b[i].high - b[i - 1].close), Math.abs(b[i].low - b[i - 1].close)); return b.length > 1 ? s / (b.length - 1) : 0; }
function sweepSetups(src, price, t) {
  const out = [], B = src['30m'].bars, n = B.length, W = 3;
  if (n < 80) return out;
  for (const sell of [true, false]) {
    const sg = sell ? 1 : -1, hi = (b) => sell ? b.high : -b.low, cl = (b) => sell ? b.close : -b.close;
    // pivot highs (lows) of the last 60 closed M30 candles
    let sweep = null;
    for (let s = n - 2; s >= n - 13 && !sweep; s--) {          // a sweep in the last ~6 h (closed candles)
      for (let p = s - 3; p >= Math.max(W, n - 60); p--) {
        let piv = true; for (let k = 1; k <= W; k++) if (hi(B[p - k]) > hi(B[p]) || hi(B[p + k]) >= hi(B[p])) { piv = false; break; }
        if (!piv) continue;
        const P = hi(B[p]);
        let clean = true; for (let j = p + 1; j < s; j++) if (hi(B[j]) > P) { clean = false; break; }   // the first run above it is the sweep
        if (!clean) break;
        if (hi(B[s]) > P && cl(B[s]) < P) { sweep = { s, p, P, time: B[s].time }; }
        break;
      }
    }
    if (!sweep) continue;
    let failed = false, ext = -Infinity; for (let j = sweep.s; j < n; j++) { ext = Math.max(ext, hi(B[j])); if (j > sweep.s && cl(B[j]) > sweep.P) failed = true; }
    if (failed) continue;
    if (sell ? price >= sweep.P : price <= -sweep.P) continue;
    // M5 VR: an M5 break of structure the other way after the sweep, its Origin still valid
    const B5 = src['5m'].bars, e5 = src['5m'].A.events.find((e) => e.dir === -sg && B5[e.breakIdx].time >= sweep.time && e.endIdx === null);
    if (!e5) continue;
    // M1 BO the same way after the M5 VR, fresh
    const B1 = src['1m'].bars, ev1 = src['1m'].A.events.filter((e) => e.dir === -sg && B1[e.breakIdx].time >= B5[e5.breakIdx].time);
    const e1 = ev1[ev1.length - 1];
    if (!e1 || t - B1[e1.breakIdx].time > 12 * 60) continue;
    // target: nearest valid opposing Origin on M30 / H1 beyond the entry
    let t1 = null;
    for (const id of ['30m', '1h']) for (const e of src[id].A.events) {
      if (e.dir !== (sell ? 1 : -1) || e.endIdx !== null) continue;   // a sell targets the last valid buy Origin below, and vice versa
      const edge = sell ? e.top : e.bot;
      if (sell ? edge < price : edge > price) if (t1 === null || (sell ? edge > t1 : edge < t1)) t1 = edge;
    }
    if (t1 === null) {   // no valid Origin there: the other side of the M30 range before the sweep (~30 h; its liquidity)
      let lo = Infinity; for (let j = Math.max(0, n - 60); j <= sweep.s; j++) lo = Math.min(lo, sell ? B[j].low : -B[j].high);
      const edge = sell ? lo : -lo; if (sell ? edge < price : edge > price) t1 = edge;
    }
    if (t1 === null) continue;
    const buf = 0.1 * atr(B5), sweepExt = sell ? ext : -ext;
    const stops = { sweep_vr: sell ? e5.top + buf : e5.bot - buf, sweep_ext: sell ? sweepExt + buf : sweepExt - buf };
    for (const [k, stop] of Object.entries(stops)) {
      const r = (stop - price) * sg, rr = (price - t1) * sg / r;
      if (!(r > 0) || !(rr >= 1.2)) continue;
      out.push({ k, sell, entry: price, stop, t1, rr, sig: `${k}|${sell ? 's' : 'b'}|${B1[e1.breakIdx].time}|${sweep.time}` });
    }
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
// typical spread (same model as the trade reviews): one spread is paid per round trip
const spreadOf = (M, price) => M.group === 'Forex' ? 0.0001 : M.spot ? 0.3 : price * 0.0002;
const BUILDERS = PAIRS.map((p) => [p, buildSetup]).concat(RETR.map((p) => [p, buildRetrace]));
const DEFS = PAIRS.concat(RETR);
const all = [], twins = [], unfilled = [], meta = { errors: {} };   // closed trades; their market-entry twins; resting orders that never filled
const endT = Math.floor(Date.now() / 1000 / 60) * 60 - 60, startT = endT - DAYS * 86400;
const t0wall = Date.now();

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
      try {   // 1. Kraken trades → 1m (38 days); 1h = Kraken's 720 hourly candles plus older hours from the trades; 4h/1d = Kraken OHLC
        const tr0 = Date.now(), trades = await krakenTrades(M.kraken, startT - 8 * 86400, endT), m1 = minuteCandles(trades);
        if (m1.length < 5000) throw new Error(`only ${m1.length} 1m candles from ${trades.length} trades`);
        const o60 = await krakenOHLC(M.kraken, 60), o240 = await krakenOHLC(M.kraken, 240), o1440 = await krakenOHLC(M.kraken, 1440);
        const firstH = o60.length ? o60[0].time : Infinity, h1 = aggregate(m1.filter((b) => b.time < firstH), 3600).concat(o60);
        Object.assign(data, { '1m': m1, '5m': aggregate(m1, 300), '15m': aggregate(m1, 900), '30m': aggregate(m1, 1800), '1h': h1, '4h': o240, '1d': o1440 });
        meta.source = Object.assign(meta.source || {}, { [key]: 'Kraken' });
        console.log(`${key}: ${trades.length} Kraken trades → ${m1.length} 1m candles, ${h1.length} 1h, ${o240.length} 4h, ${o1440.length} 1d (${((Date.now() - tr0) / 1000).toFixed(0)}s)`);
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
    const m1 = data['1m'];
    setMarket(M);
    const ptr = Object.fromEntries(TFS.map(([id]) => [id, 0]));
    const seen = new Set(), open = [];
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
            else if (s ? b.low <= tr.t1 : b.high >= tr.t1) { tr.status = 'missed'; continue; }
            else { if (b.time - tr.opened > (WAIT[tr.h] || 86400)) tr.status = 'expired'; continue; }
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
      for (const [pr, fn] of BUILDERS) {
        let st; try { st = fn(pr, price, src); } catch (e) { st = null; }
        if (!st || st.state !== 'READY' || seen.has(st.sig)) continue;
        seen.add(st.sig);
        const side = st.sell ? 'sell' : 'buy';
        if (open.some((x) => x.k === st.k && x.side === side && Math.abs(x.t1 - st.t1) <= Math.abs(st.t1) * 1e-5)) continue;
        const def = DEFS.find((p) => p.k === st.k), cfT = +String(st.sig).split('|')[2];
        if (!cfT || t - cfT > FRESH * SEC[def.l]) continue;
        const feat = { d1: src['1d'].A.trend === (st.sell ? -1 : 1) ? 'with' : 'against', struct: st.retr == null ? 'n/a' : st.retr >= 0.5 ? 'main' : 'internal', session: sessionOf(t), ...structFeat(st.sell, def.l, src, t) };
        const tr = { m: key, k: st.k, h: def.h, side, entry: st.entry, stop: st.stop, t1: st.t1, t2: st.t2 != null && (st.t2 - st.t1) * (st.sell ? -1 : 1) > 0 ? st.t2 : null, rr: st.rr, opened: t, status: 'pending', feat, mfe: 0 };
        if (st.sell ? price >= st.entry : price <= st.entry) {   // already through the entry: fill at market, like the Trader
          const r = Math.abs(price - st.stop), rw = (st.t1 - price) * (st.sell ? -1 : 1);
          if (!(r > 0) || (st.sell ? price >= st.stop : price <= st.stop) || rw <= 0) continue;
          tr.entry = price; tr.rr = rw / r; tr.status = 'open'; tr.filled = t;
        }
        tr.r0 = Math.abs(tr.entry - tr.stop); tr.cost = tr.r0 > 0 ? spreadOf(M, tr.entry) / tr.r0 : 0;
        if (!(tr.r0 > 0)) continue;
        tr.v = VARIANTS.map(([n, be, t2]) => ({ n, be, t2, stop: tr.stop, beMoved: false, done: false, R: null }));
        open.push(tr);
        // its twin entered at market at the signal (same stop and targets): the other entry style, for a fair comparison
        const tw = { ...tr, k: st.k + '@mkt', twin: true, mfe: 0 };
        if (tr.status === 'pending') {
          const r = Math.abs(price - st.stop), rw = (st.t1 - price) * (st.sell ? -1 : 1);
          if (!(r > 0) || (st.sell ? price >= st.stop : price <= st.stop) || rw <= 0) continue;
          Object.assign(tw, { entry: price, rr: rw / r, status: 'open', filled: t });
        }
        tw.r0 = Math.abs(tw.entry - tw.stop); tw.cost = tw.r0 > 0 ? spreadOf(M, tw.entry) / tw.r0 : 0;
        tw.v = VARIANTS.map(([n, be, t2]) => ({ n, be, t2, stop: tw.stop, beMoved: false, done: false, R: null }));
        open.push(tw);
      }
      for (const sw of sweepSetups(src, price, t)) {
        if (seen.has(sw.sig)) continue; seen.add(sw.sig);
        const side = sw.sell ? 'sell' : 'buy';
        if (open.some((x) => x.k === sw.k && x.side === side)) continue;   // one sweep trade per side at a time
        const tr = { m: key, k: sw.k, h: '1h', side, entry: sw.entry, stop: sw.stop, t1: sw.t1, rr: sw.rr, opened: t, filled: t, status: 'open', mfe: 0,
          feat: { d1: src['1d'].A.trend === (sw.sell ? -1 : 1) ? 'with' : 'against', struct: 'n/a', session: sessionOf(t), ...structFeat(sw.sell, '1m', src, t) } };
        tr.r0 = Math.abs(tr.entry - tr.stop); tr.cost = tr.r0 > 0 ? spreadOf(M, tr.entry) / tr.r0 : 0;
        tr.v = VARIANTS.map(([n, be, t2]) => ({ n, be, t2, stop: tr.stop, beMoved: false, done: false, R: null }));
        open.push(tr);
      }
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
  trades: all.concat(twins, unfilled).map((x) => [x.m, x.k, x.side, x.opened, x.filled || null, +x.rr.toFixed(2), x.feat.d1, x.feat.struct, x.feat.session, ...x.v.map((v) => v.R == null ? null : +v.R.toFixed(2)), +x.mfe.toFixed(2), +x.cost.toFixed(3), x.status === 'closed' ? 1 : 0, x.feat.cf, x.feat.choch]),
  tradeCols: ['market', 'setup', 'side', 'opened', 'filled', 'rr', 'd1', 'struct', 'session', 'R_none', 'R_be1', 'R_be15', 'R_tp2', 'mfe', 'cost', 'fill', 'cf', 'choch'],
  twins: twins.length, unfilled: unfilled.length,
};
fs.writeFileSync(path.join(DIR, 'backtest.json'), JSON.stringify(out));
console.log(`\n${all.length} trades over ${DAYS} days (${((Date.now() - t0wall) / 1000).toFixed(0)}s)`);
console.log('overall', JSON.stringify(out.overall));
for (const [k, v] of Object.entries(out.bySetup)) console.log(k.padEnd(9), Object.entries(v).map(([n, s]) => `${n} n${s.n} wr${s.wr} exp${s.exp}`).join(' | '));
for (const [k, v] of Object.entries(out.byRR)) console.log('rr ' + k.padEnd(7), `n${v.none.n} exp${v.none.exp} be1 ${v.be1.exp}`);
for (const k of setups) { const a = all.filter((x) => x.k === k), m = (arr) => arr.length ? (arr.reduce((q, x) => q + x.v[0].R - x.cost, 0) / arr.length).toFixed(2) : '-';
  console.log(k.padEnd(9), 'net', m(a), '| CF choch', m(a.filter((x) => x.feat.cf === 'choch')), 'n' + a.filter((x) => x.feat.cf === 'choch').length, 'bo', m(a.filter((x) => x.feat.cf === 'bo')), '| M15/M5 CHoCH yes', m(a.filter((x) => x.feat.choch === 'yes')), 'n' + a.filter((x) => x.feat.choch === 'yes').length, 'no', m(a.filter((x) => x.feat.choch === 'no'))); }
for (const [k, c] of Object.entries(out.bySetupCond)) console.log(k.padEnd(9), 'd1', Object.entries(c.d1).map(([a, s]) => `${a}:n${s.none.n} ${s.none.exp}`).join(' '), '| struct', Object.entries(c.struct).map(([a, s]) => `${a}:n${s.none.n} ${s.none.exp}`).join(' '));
