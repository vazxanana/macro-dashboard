// ICT desk replay (owner, 6 Nov 2026): the tracker's own H1 iFVG model run over the last ~7 months of CNBC futures
// candles (5m where CNBC still has them, H1 otherwise), so the desk calendar and stats have history before the live
// tracker started. Same signal code (signals() in tracker.mjs), entry at the inversion candle's close, stop 2 ticks
// beyond the sweep, 3R target with the 2R mark recorded, 48 h max, one trade per market at a time. Writes
// council-data ict/replay.json; every record carries replay: true. Never mixed with the council's data.
import fs from 'node:fs';
import path from 'node:path';
import { MARKETS, P, cnbcBars, agg, signals, letter } from './tracker.mjs';

const DATA = process.argv[2] || 'data/ict';
const FROM = Date.parse(process.argv[3] || '2026-04-01T00:00:00Z') / 1000;
const now = Math.floor(Date.now() / 1000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dedupe = (a) => { const m = new Map(); for (const b of a) m.set(b.time, b); return [...m.values()].sort((x, y) => x.time - y.time); };

async function history(M) {
  const warm = FROM - 40 * 86400; let m5 = [], h1 = [], used = null;
  for (const sym of M.cnbc) {
    m5 = []; h1 = [];
    for (let t = warm; t < now; t += 6 * 86400) {
      const to = Math.min(now + 300, t + 6 * 86400); let got = [];
      try { got = await cnbcBars(sym, '5M', t, to); } catch (e) { got = []; }
      if (got.length) m5 = m5.concat(got);
      else { try { h1 = h1.concat(await cnbcBars(sym, '1H', t, to)); } catch (e) { /* gap */ } }
      await sleep(350);
    }
    if (m5.length + h1.length > 500) { used = sym; break; }
  }
  if (!used) throw new Error(`no CNBC history for ${M.short}`);
  m5 = dedupe(m5); h1 = dedupe(h1);
  const H = dedupe(h1.filter((b) => !m5.length || b.time < m5[0].time).concat(agg(m5, 3600))).filter((b) => b.time + 3600 <= now);
  const D = (await cnbcBars(used, '1D', FROM - 500 * 86400, now + 86400)).filter((b) => b.time + 86400 <= now);
  return { sym: used, m5, H, D, m5from: m5.length ? m5[0].time : null };
}

function simulate(g, M, key, src) {
  const s = g.side, f = (v) => +(+v).toFixed(M.dec), entry = g.entry, r0 = g.r0, t1 = entry + s * P.rr * r0, t2 = entry + s * P.mark * r0, end = g.close + P.holdH * 3600;
  const bars = src.m5from != null && g.close >= src.m5from ? src.m5.filter((b) => b.time >= g.close && b.time < end) : src.H.filter((b) => b.time >= g.close && b.time < end);
  const step = src.m5from != null && g.close >= src.m5from ? 300 : 3600;
  let status = 'open', R = null, closed = null, exit = null, exitPx = null, mark2 = null, mfe = 0;
  for (const b of bars) {
    if (!mark2 && (s > 0 ? b.high >= t2 : b.low <= t2)) mark2 = b.time + step;
    mfe = Math.max(mfe, ((s > 0 ? b.high : -b.low) - s * entry) / r0);
    if (s > 0 ? b.low <= g.stop : b.high >= g.stop) { status = 'loss'; R = -1; closed = b.time + step; exit = 'stop'; exitPx = g.stop; break; }
    if (s > 0 ? b.high >= t1 : b.low <= t1) { status = 'win'; R = P.rr; closed = b.time + step; exit = 'target'; exitPx = t1; break; }
  }
  if (status === 'open' && end <= now && bars.length) { const last = bars.at(-1); R = +((s * (last.close - entry)) / r0).toFixed(2); status = R > 0 ? 'win' : R < 0 ? 'loss' : 'be'; closed = last.time + step; exit = 'time'; exitPx = last.close; }
  const R2 = closed ? (mark2 && mark2 <= closed ? 2 : R) : null;
  return { id: `${key}-${s > 0 ? 'b' : 's'}-${g.t}-r`, market: key, label: M.label, short: M.short, side: s > 0 ? 'buy' : 'sell', model: 'H1 iFVG reversal', replay: true, res: step === 300 ? '5m' : '1h',
    signalAt: g.close, signalPx: f(entry), entry: f(entry), stop: f(g.stop), r0: +r0.toFixed(M.dec + 1), t1: f(t1), t2: f(t2), opened: g.close, status, R, R2, closed, exit, exitPx: exitPx == null ? null : f(exitPx), mfe: +mfe.toFixed(2),
    sweep: { t: g.sweepT, level: f(g.swept) }, fvg: g.fvg.map(f), ih: g.ih == null ? null : f(g.ih), dol: g.dol == null ? null : f(g.dol), valid: g.valid, feat: g.feat, grade: { ...g.grade, letter: letter(g.grade.total) } };
}

const out = { at: new Date().toISOString(), from: new Date(FROM * 1000).toISOString().slice(0, 10), src: {}, errors: {}, trades: [] };
for (const [key, M] of Object.entries(MARKETS)) {
  try {
    const src = await history(M);
    out.src[key] = { sym: src.sym, h1: src.H.length, m5: src.m5.length, m5from: src.m5from ? new Date(src.m5from * 1000).toISOString().slice(0, 10) : null, d1: src.D.length };
    const sig = signals(src.H, src.D, 1, M.tick).concat(signals(src.H, src.D, -1, M.tick)).filter((g) => g.close >= FROM).sort((a, b) => a.close - b.close);
    let busyUntil = 0;
    for (const g of sig) { if (g.close < busyUntil) continue; const t = simulate(g, M, key, src); out.trades.push(t); busyUntil = t.closed || Infinity; }
    console.log(key, JSON.stringify(out.src[key]), 'signals', sig.length, 'trades', out.trades.filter((x) => x.market === key).length);
  } catch (e) { out.errors[key] = String(e.message || e); console.log(key, out.errors[key]); }
}
out.trades.sort((a, b) => a.opened - b.opened);
const C = out.trades.filter((x) => x.closed);
out.totals = { n: C.length, wins: C.filter((x) => x.R > 0).length, R: +C.reduce((a, x) => a + x.R, 0).toFixed(2), R2: +C.reduce((a, x) => a + (x.R2 ?? x.R), 0).toFixed(2) };
fs.mkdirSync(DATA, { recursive: true });
fs.writeFileSync(path.join(DATA, 'replay.json'), JSON.stringify(out));
console.log('totals', JSON.stringify(out.totals));
