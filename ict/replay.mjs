// ICT desk replay (owner, 6 Nov 2026): the tracker's own H1 iFVG model run over the year so far (from 1 Jan 2026) of CNBC futures
// candles (5m where CNBC still has them, H1 otherwise), so the desk calendar and stats have history before the live
// tracker started. Same signal code (signals() in tracker.mjs), entry at the inversion candle's close, stop 2 ticks
// beyond the sweep, 3R target with the 2R mark recorded, 48 h max, one trade per market at a time. Writes
// council-data ict/replay.json; every record carries replay: true. Never mixed with the council's data.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { MARKETS, P, cnbcBars, agg, signals, letter, isASetup, isAPlus } from './tracker.mjs';

const DATA = process.argv[2] || 'data/ict';
const FROM = Date.parse(process.argv[3] || '2026-01-01T00:00:00Z') / 1000;
const now = Math.floor(Date.now() / 1000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dedupe = (a) => { const m = new Map(); for (const b of a) m.set(b.time, b); return [...m.values()].sort((x, y) => x.time - y.time); };

async function history(M) {
  // Signals need H1 only: CNBC 1H over the whole period (10-day requests). 5m (2-day requests) is used only for exits where
  // CNBC still has it; H1 gaps are filled from 5m. Each request's candle count is logged so coverage can be checked.
  const warm = FROM - 40 * 86400;
  for (const sym of M.cnbc) {
    let h1 = [], m5 = [], log = [];
    for (let t = warm; t < now; t += 10 * 86400) {
      let got = []; try { got = await cnbcBars(sym, '1H', t, Math.min(now + 3600, t + 10 * 86400)); } catch (e) { got = []; }
      h1 = h1.concat(got); log.push(`1H ${new Date(t * 1000).toISOString().slice(0, 10)}:${got.length}`); await sleep(300);
    }
    for (let t = FROM; t < now; t += 2 * 86400) {
      let got = []; try { got = await cnbcBars(sym, '5M', t, Math.min(now + 300, t + 2 * 86400)); } catch (e) { got = []; }
      m5 = m5.concat(got); await sleep(250);
    }
    h1 = dedupe(h1); m5 = dedupe(m5);
    // CNBC keeps only ~6 months of intraday candles: fill the earlier part from the research probe's Dukascopy cash-index
    // 5m files (council-data research/candles/idx/), scaled to the futures level by the median ratio over the overlap
    const DUKA = { NQ: 'USATECHIDXUSD', ES: 'USA500IDXUSD', YM: 'USA30IDXUSD' }[M.short];
    if (DUKA && h1.length && h1[0].time > FROM) {
      let d5 = [];
      for (const y of [...new Set([warm, now].map((t) => new Date(t * 1000).getUTCFullYear()))]) {
        const f = path.join(DATA, '..', 'research', 'candles', 'idx', `${DUKA}_${y}.json.gz`);
        try { d5 = d5.concat(JSON.parse(zlib.gunzipSync(fs.readFileSync(f))).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }))); } catch (e) { /* not there yet */ }
      }
      d5 = dedupe(d5);
      if (d5.length) {
        const dh = agg(d5, 3600), byT = new Map(dh.map((b) => [b.time, b])), first = h1[0].time;
        const ratios = h1.filter((b) => b.time < first + 20 * 86400 && byT.has(b.time)).map((b) => b.close / byT.get(b.time).close).sort((a, b) => a - b);
        if (ratios.length >= 20) {
          const k = ratios[Math.floor(ratios.length / 2)], sc = (b) => ({ time: b.time, open: b.open * k, high: b.high * k, low: b.low * k, close: b.close * k });
          const fill = dh.filter((b) => b.time >= warm && b.time < first).map(sc);
          h1 = dedupe(fill.concat(h1)); m5 = dedupe(d5.filter((b) => b.time >= FROM && b.time < first).map(sc).concat(m5));
          log.push(`duka ${DUKA} fill ${fill.length} H1 before ${new Date(first * 1000).toISOString().slice(0, 10)}, scale ${k.toFixed(4)}`);
        } else log.push(`duka ${DUKA}: overlap too small (${ratios.length})`);
      }
    }
    console.log(M.short, sym, 'H1', h1.length, 'M5', m5.length, log.join(' '));
    if (h1.length + m5.length < 500) continue;
    const have = new Set(h1.map((b) => b.time)), H = dedupe(h1.concat(agg(m5, 3600).filter((b) => !have.has(b.time)))).filter((b) => b.time + 3600 <= now);
    const D = (await cnbcBars(sym, '1D', FROM - 500 * 86400, now + 86400)).filter((b) => b.time + 86400 <= now);
    // 5m counts as exit data from the first day with a near-full 5m session onwards
    const days = new Map(); for (const b of m5) { const d = Math.floor(b.time / 86400); days.set(d, (days.get(d) || 0) + 1); }
    const full = [...days.entries()].filter(([, n]) => n >= 200).map(([d]) => d).sort((a, b) => a - b);
    return { sym, m5, H, D, m5from: full.length ? full[0] * 86400 : null, m5days: new Set(full) };
  }
  throw new Error(`no CNBC history for ${M.short}`);
}

function simulate(g, M, key, src) {
  const s = g.side, f = (v) => +(+v).toFixed(M.dec), entry = g.entry, r0 = g.r0, t2 = entry + s * P.mark * r0, end = g.close + P.holdH * 3600;
  const use5 = src.m5days && src.m5days.has(Math.floor(g.close / 86400)) && src.m5days.has(Math.floor((g.close + 86400) / 86400));
  const bars = use5 ? src.m5.filter((b) => b.time >= g.close && b.time < end) : src.H.filter((b) => b.time >= g.close && b.time < end);
  const step = use5 ? 300 : 3600;
  // same exit as the tracker: no fixed target; from +2R the stop trails 1.5R behind the best price (checked before the
  // candle's own new high moves it, i.e. conservatively); 48 h max
  let status = 'open', R = null, closed = null, exit = null, exitPx = null, mark2 = null, mfe = 0, stop = g.stop, moved = false;
  for (const b of bars) {
    if (!mark2 && (s > 0 ? b.high >= t2 : b.low <= t2)) mark2 = b.time + step;
    if (s > 0 ? b.low <= stop : b.high >= stop) { R = +((s * (stop - entry)) / r0).toFixed(2); status = R > 0.001 ? 'win' : R < -0.001 ? 'loss' : 'be'; closed = b.time + step; exit = moved ? 'trail' : 'stop'; exitPx = stop; break; }
    mfe = Math.max(mfe, ((s > 0 ? b.high : -b.low) - s * entry) / r0);
    if (mfe >= P.trail[0]) { const ns = entry + s * (mfe - P.trail[1]) * r0; if ((ns - stop) * s > 0) { stop = ns; moved = true; } }
  }
  if (status === 'open' && end <= now && bars.length) { const last = bars.at(-1); R = +((s * (last.close - entry)) / r0).toFixed(2); status = R > 0 ? 'win' : R < 0 ? 'loss' : 'be'; closed = last.time + step; exit = 'time'; exitPx = last.close; }
  const R2 = closed ? (mark2 && mark2 <= closed ? 2 : R) : null;
  // research: the next 72 H1 candles after the entry as [best, worst, close] in R (sign-adjusted), to study other exits offline
  const path = src.H.filter((b) => b.time >= g.close && b.time < g.close + 72 * 3600).map((b) => [+(((s > 0 ? b.high : -b.low) - s * entry) / r0).toFixed(2), +(((s > 0 ? b.low : -b.high) - s * entry) / r0).toFixed(2), +((s * (b.close - entry)) / r0).toFixed(2)]);
  return { id: `${key}-${s > 0 ? 'b' : 's'}-${g.t}-r`, market: key, label: M.label, short: M.short, side: s > 0 ? 'buy' : 'sell', model: 'H1 iFVG reversal', replay: true, res: step === 300 ? '5m' : '1h',
    signalAt: g.close, signalPx: f(entry), entry: f(entry), stop: f(g.stop), stop0: f(g.stop), r0: +r0.toFixed(M.dec + 1), t1: null, trail: P.trail, t2: f(t2), opened: g.close, status, R, R2, closed, exit, exitPx: exitPx == null ? null : f(exitPx), mfe: +mfe.toFixed(2), path,
    sweep: { t: g.sweepT, level: f(g.swept) }, fvg: g.fvg.map(f), ih: g.ih == null ? null : f(g.ih), dol: g.dol == null ? null : f(g.dol), valid: g.valid, feat: g.feat, grade: { ...g.grade, letter: letter(g.grade.total) } };
}

const out = { at: new Date().toISOString(), from: new Date(FROM * 1000).toISOString().slice(0, 10), src: {}, errors: {}, trades: [] };
for (const [key, M] of Object.entries(MARKETS)) {
  try {
    const src = await history(M);
    out.src[key] = { sym: src.sym, h1: src.H.length, m5: src.m5.length, m5from: src.m5from ? new Date(src.m5from * 1000).toISOString().slice(0, 10) : null, d1: src.D.length };
    const sig = signals(src.H, src.D, 1, M.tick).concat(signals(src.H, src.D, -1, M.tick)).filter((g) => g.close >= FROM).sort((a, b) => a.close - b.close);
    let busyAll = 0, busyA = 0;   // same rule as the tracker: an A-setup is only blocked by an open A-setup
    for (const g of sig) { const a = isASetup(g); if (g.close < (a ? busyA : busyAll)) continue; const t = simulate(g, M, key, src); t.aset = a; t.aplus = isAPlus(g); out.trades.push(t);
      const end = t.closed || Infinity; busyAll = Math.max(busyAll, end); if (a) busyA = end; }
    console.log(key, JSON.stringify(out.src[key]), 'signals', sig.length, 'trades', out.trades.filter((x) => x.market === key).length);
  } catch (e) { out.errors[key] = String(e.message || e); console.log(key, out.errors[key]); }
}
out.trades.sort((a, b) => a.opened - b.opened);
const C = out.trades.filter((x) => x.closed);
const CA = C.filter((x) => x.aset);
out.totalsA = { n: CA.length, wins: CA.filter((x) => x.R > 0).length, R: +CA.reduce((a, x) => a + x.R, 0).toFixed(2) };
out.totals = { n: C.length, wins: C.filter((x) => x.R > 0).length, R: +C.reduce((a, x) => a + x.R, 0).toFixed(2), R2: +C.reduce((a, x) => a + (x.R2 ?? x.R), 0).toFixed(2) };
fs.mkdirSync(DATA, { recursive: true });
fs.writeFileSync(path.join(DATA, 'replay.json'), JSON.stringify(out));
console.log('totals', JSON.stringify(out.totals));
