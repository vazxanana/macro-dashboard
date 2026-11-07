// Meridian exits: replays exit variants on the same fills the council replay (council/backtest.mjs) made.
// Stage 1 (per market): BT_DUMP=<dir>/<mkt> BT_MARKETS=<mkt> node council/backtest.mjs <dir>/<mkt> 365
//   writes <dir>/<mkt>/trades.json (every filled trade, live entry style, its levels, cost and the replay's own result)
//   and <dir>/<mkt>/<mkt>-m1.json (the 1m candles the replay managed the trades on: OANDA spot for gold/forex).
// Stage 2: node research/edge/meridian-exits/exits.mjs <dir> <out.json>
// Every variant manages the same fills on the same 1m candles, with backtest.mjs's conventions: on a candle that touches
// both, the stop counts first; a stop exits at the stop price; break-even and trailing stops move after the candle's checks
// (so on the next candle), as in trader.mjs. One cost per trade (backtest.mjs costOf, in R). Trades still open when the data
// ends are marked to market at the last close in every variant (so the comparison is paired on identical trades).
import fs from 'node:fs';
import path from 'node:path';

const DIR = process.argv[2], OUT = process.argv[3] || 'result.json';
const MKTS = ['xau', 'eurusd', 'gbpusd', 'audusd', 'usdcad', 'usdchf'];
// trail / time-stop timeframe per setup: one step above the entry trigger's own lower timeframe
const TF = { scalp: 300, rscalp: 300, intraday: 900, rintra: 900, swing: 3600, rswing: 3600, position: 14400 };
// the setup's higher (trigger) timeframe, for the time stop
const HTF = { scalp: 900, rscalp: 900, intraday: 3600, rintra: 3600, swing: 14400, rswing: 14400, position: 86400 };

function aggregate(m1, sec) {
  const out = []; let cur = null;
  for (const b of m1) {
    const t0 = Math.floor(b.time / sec) * sec;
    if (!cur || cur.time !== t0) { cur = { time: t0, open: b.open, high: b.high, low: b.low, close: b.close }; out.push(cur); }
    else { cur.high = Math.max(cur.high, b.high); cur.low = Math.min(cur.low, b.low); cur.close = b.close; }
  }
  return out;
}
// per timeframe: ATR(14) known at each candle's close, and swing pivots (2 candles each side) with the time they are confirmed
function prepTF(m1, sec) {
  const B = aggregate(m1, sec), atr = new Float64Array(B.length);
  let s = 0; const tr = B.map((b, i) => i ? Math.max(b.high - b.low, Math.abs(b.high - B[i - 1].close), Math.abs(b.low - B[i - 1].close)) : b.high - b.low);
  for (let i = 0; i < B.length; i++) { s += tr[i]; if (i >= 14) s -= tr[i - 14]; atr[i] = s / Math.min(i + 1, 14); }
  const lows = [], highs = [];   // {ct: confirmed at (close of the 2nd candle after), p}
  for (let i = 2; i < B.length - 2; i++) {
    const ct = B[i + 2].time + sec;
    if (B[i].low < B[i - 1].low && B[i].low < B[i - 2].low && B[i].low <= B[i + 1].low && B[i].low <= B[i + 2].low) lows.push({ ct, p: B[i].low, a: atr[i + 2] });
    if (B[i].high > B[i - 1].high && B[i].high > B[i - 2].high && B[i].high >= B[i + 1].high && B[i].high >= B[i + 2].high) highs.push({ ct, p: B[i].high, a: atr[i + 2] });
  }
  return { B, atr, lows, highs, sec };
}
const lb = (arr, t, key = 'time') => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m][key] < t) lo = m + 1; else hi = m; } return lo; };
// ATR of the trail timeframe from the last candle closed by time t
const atrAt = (P, t) => { const i = lb(P.B, t - P.sec + 1) - 1; return i >= 0 ? P.atr[i] : P.atr[0]; };

// The variants. Each returns gross R (before cost) for one trade walked over m1[i0..].
// ctx: { tr, m1, i0, P (trail TF data) }
const VARIANTS = {
  live: { label: 'engine target, no break-even (live)', fn: (c) => walk(c, {}) },
  be1: { label: 'break-even at +1R, engine target', fn: (c) => walk(c, { be: 1 }) },
  partial: { label: '50% off at +1R, rest: stop to entry, trails 1R behind best (no target, cap 10R)', fn: (c) => walk(c, { partial: 1, trailR: [1, 1], noTarget: true }) },
  r2: { label: 'fixed 2R target', fn: (c) => walk(c, { fixedR: 2 }) },
  r3: { label: 'fixed 3R target', fn: (c) => walk(c, { fixedR: 3 }) },
  struct: { label: 'from +1R stop trails the last confirmed swing of the trail TF, engine target kept', fn: (c) => walk(c, { struct: 1 }) },
  time: { label: 'time stop: out at market after 4 trigger-TF candles unless it reached +0.5R; engine target', fn: (c) => walk(c, { timeK: 4 }) },
  atr: { label: 'from +1R stop trails 2x ATR(14) of the trail TF behind best (no target, cap 10R)', fn: (c) => walk(c, { atrK: 2, noTarget: true }) },
};

function walk({ tr, m1, i0, P }, o) {
  const s = tr.side === 'sell', sg = s ? -1 : 1, e = tr.entry, r0 = tr.r0;
  let stop = tr.stop, best = 0, booked = 0, size = 1, beMoved = false;
  const tgt = o.noTarget ? e + sg * 10 * r0 : o.fixedR ? e + sg * o.fixedR * r0 : tr.t1;
  const tStop = o.timeK ? tr.filled + o.timeK * HTF[tr.k] : Infinity;
  let sp = 0;   // pointer into the confirmed pivots
  const piv = s ? P.highs : P.lows;
  for (let i = i0; i < m1.length; i++) {
    const b = m1[i];
    const fav = s ? (e - b[3]) / r0 : (b[2] - e) / r0;   // this candle's best move for the trade, in R
    // stop first
    if (s ? b[2] >= stop : b[3] <= stop) return booked + size * ((stop - e) * sg / r0);
    // partial at +1R
    if (o.partial && size === 1 && fav >= o.partial) { booked += 0.5 * o.partial; size = 0.5; }
    // target
    if (s ? b[3] <= tgt : b[2] >= tgt) return booked + size * ((tgt - e) * sg / r0);
    // time stop at the close of the candle that reaches it
    if (b[0] + 60 > tStop && best < 0.5) return booked + size * ((b[4] - e) * sg / r0);
    best = Math.max(best, fav);
    // management after the checks (takes effect from the next candle)
    if (o.be && !beMoved && fav >= o.be) { if ((stop - e) * sg < 0) stop = e; beMoved = true; }
    if (o.partial && size < 1) {
      if ((stop - e) * sg < 0) stop = e;
      const ns = e + sg * (best - o.trailR[1]) * r0; if ((ns - stop) * sg > 0) stop = ns;
    }
    if (o.struct && best >= o.struct) {
      const tNow = b[0] + 60;
      while (sp < piv.length && piv[sp].ct <= tNow) sp++;
      // the last confirmed swing on the trade's side of price, a 0.1 ATR buffer beyond it
      for (let k = sp - 1; k >= 0 && k >= sp - 50; k--) {
        const ns = piv[k].p - sg * 0.1 * piv[k].a;
        if ((b[4] - ns) * sg > 0) { if ((ns - stop) * sg > 0) stop = ns; break; }
      }
    }
    if (o.atrK && best >= 1) { const ns = e + sg * best * r0 - sg * o.atrK * atrAt(P, b[0] + 60); if ((ns - stop) * sg > 0) stop = ns; }
  }
  const last = m1[m1.length - 1];
  return booked + size * ((last[4] - e) * sg / r0);   // still open at the end: marked to market
}

// ─── run ───
const rows = [], checks = { n: 0, same: 0, diff: [] };
let from = null, to = null;
for (const mk of MKTS) {
  const d = path.join(DIR, mk); if (!fs.existsSync(path.join(d, 'trades.json'))) { console.log(mk, 'missing'); continue; }
  const T = JSON.parse(fs.readFileSync(path.join(d, 'trades.json'))), raw = JSON.parse(fs.readFileSync(path.join(d, `${mk}-m1.json`)));
  from = T.from; to = T.to;
  const m1 = raw, m1o = raw.map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] }));
  const Ps = {}; for (const sec of new Set(Object.values(TF))) Ps[sec] = prepTF(m1o, sec);
  for (const tr of T.trades) {
    if (!(tr.k in TF) || !tr.filled || !(tr.r0 > 0)) continue;
    const i0 = lb(m1o, tr.filled);
    const ctx = { tr, m1, i0, P: Ps[TF[tr.k]] };
    const R = Object.fromEntries(Object.entries(VARIANTS).map(([n, v]) => [n, v.fn(ctx)]));
    if (tr.status === 'closed' && tr.R && tr.R.none != null) { checks.n++; if (Math.abs(R.live - tr.R.none) < 1e-6) checks.same++; else if (checks.diff.length < 10) checks.diff.push([tr.m, tr.k, tr.filled, tr.R.none, R.live]); }
    rows.push({ m: tr.m, k: tr.k, side: tr.side, t: tr.filled, cost: tr.cost, rr: tr.rr, feat: tr.feat, open: tr.status !== 'closed', R });
  }
  console.log(mk, T.trades.length, 'trades');
}
console.log('baseline check: replay R_none reproduced on', checks.same, 'of', checks.n, checks.diff);
fs.writeFileSync(OUT, JSON.stringify({ from, to, variants: Object.fromEntries(Object.entries(VARIANTS).map(([k, v]) => [k, v.label])), checks, rows }));
