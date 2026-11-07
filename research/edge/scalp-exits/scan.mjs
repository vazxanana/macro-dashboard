// Stage 1: replay the live engine's Scalp (M15 -> M1) every 5 minutes on multi-year histdata M1 and record every READY signal.
//   node research/edge/scalp-exits/scan.mjs <dataDir> <market> <fromISO> <toISO> <out.json>
// Same engine (council/engine.mjs buildSetup + msAnalyze), the same 720-candle views as backtest.mjs (closed candles plus
// the forming one for M15; closed M1), the live config (buf 0.15, minRisk 1.1, fresh 12), bad-print cleaner (clean.mjs).
// The stop is recorded for three stop buffers (0.10 / 0.15 / 0.25 ATR) from the same analysis. The same-idea dedupe
// (same setup, side and target while one is open or pending) uses the live management with the engine target.
import fs from 'node:fs';
import { msAnalyze, CFG, PAIRS, buildSetup, setMarket } from '../../../council/engine.mjs';
import { cleanBars } from '../../../council/clean.mjs';
import { MARKETS, loadClean, aggregate, atrOf, lowerBound, sessionOf, marketOpen } from './lib.mjs';

const [dir, key, fromS, toS, outF] = process.argv.slice(2);
const M = MARKETS[key];
const WIN = 720, STEP = 300, FRESH = 12, WAIT15 = 3 * 3600;
CFG.minRisk = 1.1; CFG.minRR = 1.2;   // live config.json (7 Nov): buf 0.15, minRisk 1.1, minRR 1.2
const BUFS = [0.10, 0.15, 0.25];
const pr = PAIRS.find((p) => p.k === 'scalp');

const t0w = Date.now();
const m1 = loadClean(dir, key, cleanBars);   // histdata M1 through clean.mjs (forex: lone-wick rule), cached
const forex = M.group === 'Forex';
const m15 = aggregate(m1, 900); cleanBars(m15, forex ? { wickK: 15 } : {});
const d1 = aggregate(m1, 86400, 7200);   // trading day rolls at 22:00 UTC (NY close)
console.log(`${key}: ${m1.length} M1, ${m15.length} M15, ${d1.length} D1 loaded in ${((Date.now() - t0w) / 1000).toFixed(0)}s`);
setMarket({ dec: M.dec, group: M.group, spot: !!M.spot });

const dCache = new Map();
function d1Trend(t) {
  const d = Math.floor((t + 7200) / 86400) * 86400 - 7200;
  if (dCache.has(d)) return dCache.get(d);
  const k = lowerBound(d1, d), w = d1.slice(Math.max(0, k - 720), k);
  const v = w.length > 100 ? msAnalyze(w, 6).trend : null;
  dCache.set(d, v); return v;
}
// live management with the engine target, only to know when an idea stops being open/pending (dedupe)
function closeTime(tr, from) {
  const s = tr.side === 'sell'; let st = tr.status;
  for (let i = from; i < m1.length; i++) {
    const b = m1[i];
    if (st === 'pending') {
      if (s ? b.high >= tr.entry : b.low <= tr.entry) st = 'open';
      else if (s ? b.low <= tr.t1 : b.high >= tr.t1) return b.time;
      else { if (b.time - tr.opened > WAIT15) return b.time; continue; }
    }
    if (s ? b.high >= tr.stop : b.low <= tr.stop) return b.time;
    if (s ? b.low <= tr.t1 : b.high >= tr.t1) return b.time;
  }
  return Infinity;
}

const startT = Math.max(Date.parse(fromS) / 1000, m1[0].time + 30 * 86400), endT = Math.min(Date.parse(toS) / 1000, m1[m1.length - 1].time);
const seen = new Set(), ideas = [], sigs = [];
let p1 = 0, p15 = 0, steps = 0;
// skip hours where a live Scalp can't be taken (asia, overlap) except the 15 minutes before a tradeable session starts, so a
// signal first seen there is still marked as seen (its freshness window is 12 minutes)
const wanted = (t) => { const d = new Date(t * 1000), m = d.getUTCHours() * 60 + d.getUTCMinutes(); return !((m < 7 * 60 - 15) || (m >= 12 * 60 && m < 16 * 60 - 15)); };
for (let t = Math.ceil(startT / STEP) * STEP; t <= endT; t += STEP) {
  if (!marketOpen(t) || !wanted(t)) continue;
  while (p1 < m1.length && m1[p1].time + 60 <= t) p1++;
  while (p15 < m15.length && m15[p15].time + 900 <= t) p15++;
  if (p1 < WIN) continue;
  if (m1[p1 - 1].time < t - 30 * 60) continue;   // feed gap (holiday): the trader would see stale candles
  const b1 = m1.slice(p1 - WIN, p1);
  const b15 = m15.slice(Math.max(0, p15 - (WIN - 1)), p15);
  const f0 = Math.floor(t / 900) * 900; let fb = null;
  for (let j = p1 - 1; j >= 0 && m1[j].time >= f0; j--) { const b = m1[j]; fb = fb ? { time: f0, open: b.open, high: Math.max(fb.high, b.high), low: Math.min(fb.low, b.low), close: fb.close } : { time: f0, open: b.open, high: b.high, low: b.low, close: b.close }; }
  if (fb) b15.push(fb);
  if (b15.length < 60) continue;
  steps++;
  const src = { '15m': { bars: b15, A: msAnalyze(b15, 6) }, '1m': { bars: b1, A: msAnalyze(b1, 6) } };
  const price = b1[b1.length - 1].close;
  CFG.buf = 0.15;
  let st; try { st = buildSetup(pr, price, src); } catch (e) { st = null; }
  if (!st || st.state !== 'READY' || seen.has(st.sig)) continue;
  seen.add(st.sig);
  const side = st.sell ? 'sell' : 'buy', sg = st.sell ? -1 : 1;
  if (ideas.some((x) => x.side === side && x.until > t && Math.abs(x.t1 - st.t1) <= Math.abs(st.t1) * 1e-5)) continue;
  const cfT = +String(st.sig).split('|')[2];
  if (!cfT || t - cfT > FRESH * 60) continue;
  const ll = src['1m'].A.last, d1t = d1Trend(t);
  const per = {};
  for (const bf of BUFS) {
    CFG.buf = bf; let v; try { v = buildSetup(pr, price, src); } catch (e) { v = null; }
    if (v && v.state === 'READY') per[bf] = { stop: v.stop, t1: v.t1, t2: v.t2, rr: v.rr };
  }
  CFG.buf = 0.15;
  const rec = { m: key, t, side, sig: st.sig, cfT, price, entry: st.entry, stop: st.stop, t1: st.t1, rr: st.rr, llTop: ll.top, llBot: ll.bot, llLevel: ll.level,
    atr1: atrOf(b1), atr15: atrOf(b15), d1: d1t == null ? null : d1t === sg ? 'with' : 'against', session: sessionOf(t), retr: st.retr, per };
  sigs.push(rec);
  // the idea stays open/pending under live management (engine target, buf 0.15): limit at the entry or market when through
  const mkt = st.sell ? price >= st.entry : price <= st.entry;
  const tr = { side, entry: mkt ? price : st.entry, stop: st.stop, t1: st.t1, status: mkt ? 'open' : 'pending', opened: t };
  const bad = mkt && ((st.sell ? price >= st.stop : price <= st.stop) || (st.t1 - price) * sg <= 0);
  ideas.push({ side, t1: st.t1, until: bad ? t : closeTime(tr, lowerBound(m1, t)) });
  if (ideas.length > 50) ideas.splice(0, ideas.length - 50);
}
fs.writeFileSync(outF, JSON.stringify({ key, from: startT, to: endT, steps, sigs }));
console.log(`${key} ${fromS}..${toS}: ${steps} steps, ${sigs.length} signals, ${((Date.now() - t0w) / 1000).toFixed(0)}s`);
