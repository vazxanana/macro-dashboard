// Edge research (ict-concepts): three ICT entry concepts the desk does not trade, as objective rules on closed H1 candles
// (and closed daily candles for context). Rules were fixed from the ICT skill before any result was looked at:
//  eqts  - turtle soup at relative equal lows/highs (skill §1 EQH/EQL, §5): two or more unswept confirmed H1 pivot lows within
//          0.1x the daily ATR form a pool; an H1 candle trades below the whole pool and, within 3 candles, an H1 candle closes
//          back above the pool -> buy at that close, stop 2 ticks under the lowest low since the sweep. Sells mirror.
//  lbh   - "lows that broke highs" (skill §5): when an H1 candle CLOSES above the last confirmed H1 swing high, the lowest low of
//          the leg from that swing high to the break is the stop pool; within 96 H1 candles an H1 candle trades below it and,
//          within 3 candles, closes back above it -> buy at that close, stop 2 ticks under the lowest low since the sweep.
//  gap   - NWOG / NDOG fill (skill §1): the first H1 candle after a session break of >= 2 h (the 17:00 ET halt = NDOG, the
//          weekend = NWOG) opens >= 0.1x the daily ATR away from the prior close; if that candle has not filled the gap, enter at
//          its close toward the fill, stop 2 ticks beyond its extreme, target = the prior close, out after 36 H1 candles.
// eqts and lbh are tested raw and with the skill's LTP filter (§5 + §12: daily bias WITH the trade = prior daily close vs its
// 50-day average, and the entry in the discount half (buys) / premium half (sells) of the last 20 daily candles' range).
// All risks are capped at 0.75x the daily ATR (the A-rule's cap). Signals return the same shape as tracker signals() so that
// replay.mjs simulate() can run the desk's live exit on them unchanged.
import { P } from '../../../ict/tracker.mjs';

export const C = { tol: 0.1, reclaim: 3, cap: 0.75, gapMin: 0.1, gapBreak: 7200 };
const mir = (side) => (side > 0 ? (b) => b : (b) => ({ time: b.time, open: -b.open, high: -b.low, low: -b.high, close: -b.close }));

// daily context at an H1 close t (mirrored space): ATR14, 50-day bias, premium/discount of price x in the 20-day range
function dctx(Dm, Draw, t, x) {
  const di = Draw.findLastIndex((d) => d.time + 86400 <= t);
  if (di < 50) return null;
  const atrD = Dm.slice(di - 13, di + 1).reduce((a, d) => a + (d.high - d.low), 0) / 14;
  const sma = Dm.slice(di - 49, di + 1).reduce((a, d) => a + d.close, 0) / 50;
  const R = Dm.slice(di - 19, di + 1), hi = Math.max(...R.map((d) => d.high)), lw = Math.min(...R.map((d) => d.low));
  return { atrD, bias: Dm[di].close > sma ? 'with' : 'against', pd: +((x - lw) / (hi - lw)).toFixed(3) };
}
const ictOk = (g) => g.feat.bias === 'with' && g.feat.pd != null && g.feat.pd < 0.5;
// 'floor' variants (added after the first run showed 0.005x-ATR stops on stub candles): the A-rule's own stop band, 0.3-0.75x ATR
export const FLOOR = 0.3;
const floorOk = (g) => g.feat.atrR >= FLOOR;
export const FILTERS = { raw: () => true, ict: ictOk, floor: floorOk, 'ict+floor': (g) => ictOk(g) && floorOk(g) };

// the shared turtle-soup reclaim: from sweep candle s, the first close back above level L within C.reclaim candles
function reclaim(H, s, L, tick) {
  let lo = Infinity;
  for (let c = s; c < Math.min(s + C.reclaim, H.length); c++) { lo = Math.min(lo, H[c].low); if (H[c].close > L) return { c, lo, stop: lo - 2 * tick }; }
  return null;
}
function emit(model, side, H, Hraw, Dm, D, s, r, extra) {
  const e = H[r.c].close, r0 = e - r.stop, ctx = dctx(Dm, D, Hraw[r.c].time + 3600, e);
  if (!ctx || r0 <= 0 || r0 > C.cap * ctx.atrD) return null;
  return { model, side, t: Hraw[r.c].time, close: Hraw[r.c].time + 3600, sweepT: Hraw[s].time, swept: side * extra.level, fvg: [], entry: side * e, stop: side * r.stop, r0,
    ih: null, dol: null, valid: true, feat: { atrR: +(r0 / ctx.atrD).toFixed(3), bias: ctx.bias, pd: ctx.pd, speed: r.c - s, ...extra.feat }, grade: { strength: 0, speed: 0, rr: 0, total: 0 } };
}

export function eqts(Hraw, D, side, tick) {
  const H = Hraw.map(mir(side)), Dm = D.map(mir(side)), n = P.piv, N = H.length, out = [];
  const isPL = (j) => j >= n && j + n < N && H.slice(j - n, j + n + 1).every((b) => b.low >= H[j].low);
  let act = [], next = 0;
  for (let i = n; i < N; i++) {
    const j = i - n; if (j >= 0 && isPL(j)) act.push(j);
    act = act.filter((k) => i - k <= P.look);
    const swept = act.filter((k) => H[i].low < H[k].low); if (!swept.length) continue;
    act = act.filter((k) => H[i].low >= H[k].low);
    if (i < next) continue;
    const ctx = dctx(Dm, D, Hraw[i].time + 3600, H[i].close); if (!ctx) continue;
    const tol = C.tol * ctx.atrD, eq = swept.filter((a) => swept.some((b) => b !== a && Math.abs(H[a].low - H[b].low) <= tol));
    if (eq.length < 2) continue;
    const L = Math.min(...eq.map((k) => H[k].low)), r = reclaim(H, i, L, tick); if (!r) continue;
    const g = emit('eqts', side, H, Hraw, Dm, D, i, r, { level: L, feat: { pool: eq.length } }); if (g) out.push(g);
    next = r.c + 1;
  }
  return out;
}

export function lbh(Hraw, D, side, tick) {
  const H = Hraw.map(mir(side)), Dm = D.map(mir(side)), n = P.piv, N = H.length, out = [];
  const isPH = (j) => j >= n && j + n < N && H.slice(j - n, j + n + 1).every((b) => b.high <= H[j].high);
  let ph = null, lv = [], next = 0;
  for (let i = n; i < N; i++) {
    const j = i - n; if (j >= 0 && isPH(j)) ph = j;   // the latest confirmed swing high
    lv = lv.filter((x) => i - x.born <= P.look);
    // sweep of a pool made earlier (the candle that makes a level cannot also sweep it)
    const swept = lv.filter((x) => H[i].low < x.L);
    if (swept.length) {
      lv = lv.filter((x) => H[i].low >= x.L);
      const x = swept.reduce((a, b) => (b.born > a.born ? b : a));
      if (i >= next) {
        const r = reclaim(H, i, x.L, tick);
        if (r) { const g = emit('lbh', side, H, Hraw, Dm, D, i, r, { level: x.L, feat: { age: i - x.born } }); if (g) out.push(g); next = r.c + 1; }
      }
    }
    // break: this candle closes above the latest unbroken swing high -> the leg's low is the "low that broke the high"
    if (ph != null && H[i].close > H[ph].high) {
      let L = Infinity; for (let k = ph; k <= i; k++) L = Math.min(L, H[k].low);
      lv.push({ L, born: i }); ph = null;
    }
  }
  return out;
}

// opening gaps (both sides at once: the side is the fill direction)
export function gaps(Hraw, D, tick) {
  const out = [];
  for (let i = 1; i < Hraw.length; i++) {
    const dt = Hraw[i].time - Hraw[i - 1].time; if (dt < C.gapBreak) continue;
    const pc = Hraw[i - 1].close, b = Hraw[i], g = b.open - pc, side = g > 0 ? -1 : 1;
    const ctx = dctx(D.map(mir(side)), D, b.time, side * b.close); if (!ctx || Math.abs(g) < C.gapMin * ctx.atrD) continue;
    if (side < 0 ? b.low <= pc : b.high >= pc) continue;   // filled inside the first candle: nothing left to trade at its close
    const entry = b.close, stop = side > 0 ? b.low - 2 * tick : b.high + 2 * tick, r0 = Math.abs(entry - stop);
    if (r0 <= 0 || r0 > C.cap * ctx.atrD) continue;
    out.push({ model: dt > 86400 ? 'nwog' : 'ndog', side, t: b.time, close: b.time + 3600, entry, stop, target: pc, r0, gapAtr: +(Math.abs(g) / ctx.atrD).toFixed(3),
      feat: { atrR: +(r0 / ctx.atrD).toFixed(3), bias: ctx.bias, pd: ctx.pd } });
  }
  return out;
}
