// Gold trend (N20 / N5, + add at +1R), Gold H4 trendline, Gold daily engulf on 2018-2026 spot gold M1, ported from the
// live blocks of council/trader.mjs (config.goldTrend / goldTrendFast / goldTrendAdd / goldTL / goldEG). Runs happen 4 min
// after each bar close (the live cron); market entries take the last M1 close at that moment; stops/targets on M1.
// Daily candles are UTC weekdays (live uses Kraken PAXG daily candles, which include weekend candles -- see RESULT.md).
import fs from 'node:fs';
import { buildContext, step, unitR, report, span, IS_END } from './core.mjs';
import { LIVE } from './live.mjs';

const OUT = process.env.OUT_DIR || '.';
const ctx = buildContext(), { m, bars, nClosed } = ctx, D = bars.d1, H4 = bars.h4;
const LAG = 240;
const rowsOf = (pos) => pos.filter((p) => p.status !== 'expired' && p.status !== 'missed').map((p) => { let g = 0, n = 0, c = 0; for (const x of p.legs) { const u = unitR(x); g += u.g; n += u.n; c = Math.max(c, x.closed); } return { t: p.filled, c, g, n }; });
const closeOut = (x) => { if (x.done) return; const k = m.n - 1; x.R = x.status === 'pending' ? 0 : (x.side < 0 ? x.entry - m.C[k] : m.C[k] - x.entry) / x.r0; x.closed = m.T[k]; x.done = true; if (x.status === 'pending') x.status = 'expired'; };

// ── Gold trend: daily close above the prior N highs -> buy next run; stop k ATR14; ratchet to close - k ATR each closed day; add at +1R ──
function goldTrend(N, kA = 2, add = true) {
  const tr14 = (i) => Math.max(D[i].high - D[i].low, Math.abs(D[i].high - D[i - 1].close), Math.abs(D[i].low - D[i - 1].close));
  const atr14 = (i) => { let a = 0; for (let j = i - 13; j <= i; j++) a += tr14(j); return a / 14; };
  const pos = []; let open = null, kPrev = 0;
  for (let n = N + 16; n <= D.length; n++) {
    const T = D[n - 1].time + 86400 + LAG, k0 = ctx.lb(T); if (k0 >= m.n) break;
    // manage legs up to this run
    if (open) for (const x of open.legs) for (let k = x.k; k < k0 && !x.done; k++) { step(x, m, k); x.k = k + 1; }
    if (open && open.legs.every((x) => x.done)) open = null;
    const last = D[n - 1], price = m.C[k0 - 1];
    if (open) {
      const ns = last.close - kA * atr14(n - 1);
      for (const x of open.legs) if (!x.done && ns > x.stop) { x.stop = ns; x.trailMoved = true; }
      if (add && open.legs.length === 1 && !open.done && last.close - open.entry >= 1 * open.r0) {
        const ae = price, rA = ae - open.stop;
        if (rA > 0) open.legs.push({ side: 1, entry: ae, stop: open.stop, t1: ae * 100, rr: 99, trail: [1e6, 0], trailMoved: open.trailMoved, size: 1, opened: T, filled: T, status: 'open', r0: rA, k: k0, k0 });
      }
    } else {
      const hi = Math.max(...D.slice(n - 1 - N, n - 1).map((b) => b.high)), A = atr14(n - 1);
      if (last.close > hi && A > 0) { const entry = price, stop = entry - kA * A, r0 = entry - stop;
        open = { side: 1, entry, stop, t1: entry * 100, rr: 99, trail: [1e6, 0], size: 1, opened: T, filled: T, status: 'open', r0, k: k0, k0 }; open.legs = [open]; pos.push(open); }
    }
    kPrev = k0;
  }
  if (open) for (const x of open.legs) { for (let k = x.k; k < m.n && !x.done; k++) step(x, m, k); closeOut(x); }
  return rowsOf(pos);
}

// ── H4 trendline (buys): close above the falling line through the last two confirmed pivot highs; MSNR H4 direction up ──
function goldTL(TL = { n: 3, span: 120, n4: 2, pad: 0.3, hold: 96 }, useDir = true) {
  const pos = [], traded = new Set(); let open = null;
  for (let nh = 30; nh <= H4.length; nh++) {
    const last = H4[nh - 1], T = last.time + 14400 + LAG, k0 = ctx.lb(T); if (k0 >= m.n) break;
    if (m.T[k0] - T > 3600) { /* live: the run must come within 1 h of the close */ }
    if (open) { for (let k = open.k; k < k0 && !open.done; k++) { step(open, m, k); open.k = k + 1; } if (open.done) open = null; }
    if (open || m.T[k0] - T >= 3600) continue;
    const H = H4.slice(Math.max(0, nh - 720), nh), n = H.length;
    // live: confirmed pivot highs for i in [n, n - n) -- the last two (scanned backwards, same result)
    const piv = [];
    for (let i = n - TL.n - 1; i >= TL.n && piv.length < 2; i--) {
      let ok = true; for (let q = i - TL.n; q <= i + TL.n && ok; q++) if (q !== i && H[q].high >= H[i].high) ok = false;
      if (ok) piv.push(i);
    }
    if (piv.length < 2) continue;
    const b = piv[0], a = piv[1], pb = H[b].high, pa = H[a].high;
    if (!(pb < pa && b - a <= TL.span && n - 1 > b + TL.n)) continue;
    const lv = pa + (pb - pa) / (b - a) * (n - 1 - a), id = `${H[a].time}-${H[b].time}`;
    if (!(last.close > lv) || traded.has(id)) continue;
    if (useDir) { const nd = nClosed('d1', T); const dir = LIVE.msnrDirection(H, D.slice(Math.max(0, nd - 720), nd), TL.n4, 2); if (dir !== 1) continue; }
    const price = m.C[k0 - 1], lo = Math.min(...H.slice(b).map((x) => x.low)), stop = lo - TL.pad, r0 = price - stop;
    if (!(r0 > 0)) continue;
    traded.add(id);
    open = { side: 1, entry: price, stop, t1: price + 10 * r0, rr: 10, trail: [2, 1], size: 1, opened: T, filled: T, status: 'open', r0, maxHold: TL.hold * 3600, k: k0, k0 };
    open.legs = [open]; pos.push(open);
  }
  if (open) { for (let k = open.k; k < m.n && !open.done; k++) step(open, m, k); closeOut(open); }
  return rowsOf(pos);
}

// ── Daily engulf (buys): green close above the high of the nearest red candle within k; close > SMA20; limit at the zone high ──
function goldEG(EG = { k: 3, life: 20, hold: 240, sma: 20, pad: 0.3, maxOpen: 3 }, useSma = true) {
  const pos = [], live = [], ids = new Set();
  for (let n = EG.sma + EG.k + 3; n <= D.length; n++) {
    const last = D[n - 1], T = last.time + 86400 + LAG, k0 = ctx.lb(T); if (k0 >= m.n) break;
    for (const x of live) for (let k = x.k; k < k0 && !x.done; k++) { step(x, m, k); x.k = k + 1; }
    // cancel pending orders on a daily close under the zone low
    for (const x of live) if (!x.done && x.status === 'pending' && last.close < x.zlo) { x.status = 'expired'; x.R = 0; x.done = true; x.closed = T; }
    for (let q = live.length - 1; q >= 0; q--) if (live[q].done) live.splice(q, 1);
    const sma = D.slice(n - EG.sma, n).reduce((a, b) => a + b.close, 0) / EG.sma, up = last.close > sma;
    let base = null;
    if (last.close > last.open) for (let j = n - 2; j >= n - 1 - EG.k && j >= 0; j--) { const b = D[j]; if (b.open > b.close) { if (last.close > b.high) base = b; break; } }
    if (!base || (useSma && !up) || ids.has(base.time) || live.length >= EG.maxOpen) continue;
    const price = m.C[k0 - 1], entry = base.high, stop = base.low - EG.pad, r0 = entry - stop;
    if (!(r0 > 0 && price > entry)) continue;
    ids.add(base.time);
    const tr = { side: 1, entry, stop, t1: entry + 10 * r0, rr: 10, trail: [2, 1], size: 1, opened: T, status: 'pending', expireAt: T + EG.life * 86400, r0, maxHold: EG.hold * 3600, k: k0, k0, zlo: base.low };
    tr.legs = [tr]; live.push(tr); pos.push(tr);
  }
  for (const x of live) { for (let k = x.k; k < m.n && !x.done; k++) step(x, m, k); closeOut(x); }
  return rowsOf(pos);
}

const RES = { variants: {} };
const put = (k, rows, extra = {}) => { RES.variants[k] = { ...extra, ...report(rows), s2019_22: span(rows, 2019, 2022), s2023_24: span(rows, 2023, 2024), s2025_26: span(rows, 2025, 2026) }; console.error(k, JSON.stringify({ is: RES.variants[k].is, oos: RES.variants[k].oos })); };
put('trend_N20_add', goldTrend(20, 2, true), { rule: 'live goldTrend + goldTrendAdd' });
put('trend_N20_noAdd', goldTrend(20, 2, false));
put('trend_N5_add', goldTrend(5, 2, true), { rule: 'live goldTrendFast + add' });
put('trend_N5_noAdd', goldTrend(5, 2, false));
put('tl_live', goldTL(), { rule: 'live goldTL' });
put('tl_noDir', goldTL(undefined, false));
put('eg_live', goldEG(), { rule: 'live goldEG' });
put('eg_noSma', goldEG(undefined, false));
fs.writeFileSync(`${OUT}/daily.json`, JSON.stringify(RES, null, 1));
