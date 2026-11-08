// Council · LIT paper shadow stream (owner, 8 Nov 2026: "leave it as paper shadow or just LIT"). Pure functions, no I/O.
// The pre-registered PRIMARY of research/edge/lit (preregistration.md #596, RESULT.md #597: INCONCLUSIVE / not an edge at the skill's
// defaults) runs FORWARD as a paper shadow stream in council/trader.mjs (k 'lit', name 'LIT (paper shadow)') to build a forward
// record. Every record it makes is `shadow: true, blockedBy: ['owner-shadow']`: never live, never alerted, not our system.
// Detector: a verbatim port of research/edge/lit/run.mjs (series, accumulation, fbosCandidates, buildOrder) with NO behaviour change;
// tests/lit-shadow.test.mjs runs both over the same 2024-2025 OANDA gold 5m candles and asserts the same orders.
// The rule (bearish side; the long side is the exact mirror, prices negated): M15 sweep of an external level (completed session high,
// previous-day / previous-week high, the accumulation's own high, equal highs) by >= 1 tick inside LONDON [02:00, 05:00) or NY_AM
// [08:00, 12:00) New York, never the 09:30 bar, with >= 8 M15 bars of accumulation (range <= 3 ATR(14)) behind it and the level in the
// premium half of the running weekly range; FBOS = close back below the level within 3 bars, no two closes above, a vector (body >= 1.5 x
// the mean body of the 10 bars before: body-only, the cache has no volume) within +-2 bars; MX = the sweep's max high. M5 RBOS = the last
// confirmed M5 swing low before MX broken by WICK within 48 bars, before any break of MX, fast (<= 6 bars) or by a vector, not a grind,
// not flipped back; IDM POI = the last bullish candle before the displacement (kev's smallest-body fallback). Order: limit at the OB
// OPEN, stop MX + $0.30 + max(0.1 ATR(14, M5), $0.30), skip when the stop exceeds 0.08% of price, target the accumulation's low, skip at
// R:R <= 3, the order rests 24 M5 bars; break-even after two post-entry M5 swing breaks; day-end close; <= 1 London + 1 NY_AM trade a
// day, stop after a win or -1.5R; one pending / open order at a time.
import { spotClosed } from './fills.mjs';

// ─── pre-registered parameters (research/edge/lit/preregistration.md; the same values as run.mjs P) ───
export const P = {
  pivot: 2,                 // fractal pivot L = R = 2 (M15 narrative, M5 execution)
  vecMult: 1.5, vecN: 10,   // vector: body >= 1.5 x mean body of the preceding 10 bars (body-only: no volume in the cache)
  accMinBars: 8, accMaxBars: 96, accAtrMult: 3, atrN: 14,   // accumulation: >= 8 M15 bars, range <= 3 x ATR(14)
  eqTolAtr: 0.1, eqLookback: 96,                            // equal highs/lows: within 0.1 x ATR(14), within the last 96 M15 bars
  rejectBars: 3,            // close back inside within 3 bars (sweep bar counted)
  vecWindow: 2,             // >= 1 vector in [sweep - 2, rejection + 2]
  weekMinBars: 48,          // premium / discount against the running weekly range; the day's range while the week has < 48 M15 bars
  rbosWait: 48,             // the RBOS must come within 48 M5 bars of MX, before any break of MX
  rbosFast: 6,              // quality: break bar is a vector OR MX -> break <= 6 bars
  overlapShare: 0.5, overlapRatio: 0.7,   // reject if > 50% of the bars MX -> break overlap the previous bar's range by > 70%
  capFrac: 0.0008,          // skip if the stop exceeds 0.08% of price
  minRR: 3,                 // skip if R:R <= 3
  expiryBars: 24,           // the limit expires after 24 M5 bars, on a break of MX or on reaching the target
  beBreaks: 2,              // break-even after two post-entry M5 swing breaks
  dayCapR: -1.5,            // stop for the day after a win or at -1.5R; <= 1 London + 1 NY trade
};
export const VARIANT = { id: 'wick-open', trig: 'wick', entry: 'open' };   // the primary: RBOS by wick, entry at the OB candle's open
export const SESS_TRADE = ['LONDON', 'NY_AM'];
// the 17:00 New York hour (OANDA gold's daily halt), as the harness's inHalt
const etH = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' });
export const inHalt = (t) => +etH.format(new Date(t * 1000)) % 24 === 17;
// the market the stream trades (the harness's MARKETS.xau): OANDA spot gold, tick 0.01, stop = MX + spread + buffer
export const XAU = { key: 'xau', sym: 'xau', tick: 0.01, stopExtra: (atr5) => 0.30 + Math.max(0.1 * atr5, 0.30), skip: (t) => spotClosed(t) || inHalt(t) };
export const K = 'lit', NAME = 'LIT (paper shadow)', PAIR = 'M15 FBOS → M5 RBOS → OB limit', BLOCKED = ['owner-shadow'];
export const VALID_FOR = P.expiryBars * 300;   // the resting limit's life in seconds (24 M5 bars)
// how many closed 5m candles the detector wants: the current trading week plus the whole previous one (the previous-week level and
// the running weekly range), ~2,760 bars at a Friday close; 4,000 gives a margin. The Trader's own 5m feed has 720.
export const LOOKBACK_BARS = 4000;

// ─── New York time (bar start) — as run.mjs ───
const nyFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
const offCache = new Map();
export function nyOff(t) {
  const k = Math.floor(t / 3600); let v = offCache.get(k);
  if (v === undefined) { const p = Object.fromEntries(nyFmt.formatToParts(new Date(k * 3600000)).map((x) => [x.type, x.value]));
    v = Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) / 1000 - k * 3600) / 3600); offCache.set(k, v); }
  return v;
}
// trading day starts 18:00 NY (day), labelled by the calendar day it mostly covers; week = the Mon..Fri labels (Sun 18:00 → Fri 17:00)
export function nyInfo(t) {
  const tl = t + nyOff(t) * 3600, h = Math.floor((tl % 86400) / 3600), m = Math.floor((tl % 3600) / 60);
  const day = Math.floor((tl - 18 * 3600) / 86400), label = day + 1, week = Math.floor((label + 3) / 7);
  const sess = h >= 18 || h < 1 ? 'ASIA' : h >= 2 && h < 5 ? 'LONDON' : h >= 8 && h < 12 ? 'NY_AM' : h >= 12 && h < 16 ? 'NY_PM' : null;
  return { h, m, day, week, sess, hm: h * 100 + m, year: new Date(label * 86400000).getUTCFullYear() };
}
// ─── data shaping ───
// the harness's load(): candles while spot is shut or in the 17:00 hour dropped, non-positive prices dropped, high / low widened to
// cover open and close. Accepts the cache rows [t, o, h, l, c] or the Trader's { time, open, high, low, close } candles.
export function cleanBars(rows, M = XAU) {
  const out = [];
  for (const r of rows) {
    const t = Array.isArray(r) ? r[0] : r.time, o = Array.isArray(r) ? r[1] : r.open, h = Array.isArray(r) ? r[2] : r.high, l = Array.isArray(r) ? r[3] : r.low, c = Array.isArray(r) ? r[4] : r.close;
    if (M.skip(t) || !(o > 0 && h > 0 && l > 0 && c > 0)) continue;
    out.push({ t, o, h: Math.max(h, o, c), l: Math.min(l, o, c), c });
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}
// M15 = 5m candles aggregated on UTC quarter-hours (the harness's agg15)
export function agg15(m5) {
  const out = []; let cur = null, key = null;
  for (const b of m5) { const k = Math.floor(b.t / 900); if (k !== key) { key = k; cur = { t: k * 900, o: b.o, h: b.h, l: b.l, c: b.c }; out.push(cur); } else { cur.h = Math.max(cur.h, b.h); cur.l = Math.min(cur.l, b.l); cur.c = b.c; } }
  return out;
}
// forward only: the 5m bars whose quarter-hour is complete (a later bar exists, or the quarter's last 5-minute slot is in), so the
// M15 series never ends on a half-built bar the harness would not have seen that way
export function completeQuarters(m5) {
  if (!m5.length) return m5;
  const lastK = Math.floor(m5.at(-1).t / 900), lastDone = m5.at(-1).t === (lastK + 1) * 900 - 300;
  return lastDone ? m5 : m5.filter((b) => Math.floor(b.t / 900) < lastK);
}
// a series with its derived arrays; mirror = true negates prices so the short-side logic trades the longs (the harness's series)
export function series(bars, mirror, tick) {
  const n = bars.length, o = new Float64Array(n), h = new Float64Array(n), l = new Float64Array(n), c = new Float64Array(n), t = new Float64Array(n);
  for (let i = 0; i < n; i++) { const b = bars[i]; t[i] = b.t; if (mirror) { o[i] = -b.o; h[i] = -b.l; l[i] = -b.h; c[i] = -b.c; } else { o[i] = b.o; h[i] = b.h; l[i] = b.l; c[i] = b.c; } }
  const body = new Float64Array(n), vec = new Uint8Array(n), atr = new Float64Array(n), pivH = new Uint8Array(n), pivL = new Uint8Array(n), tr = new Float64Array(n);
  let sumB = 0, sumTr = 0;
  for (let i = 0; i < n; i++) {
    body[i] = Math.abs(c[i] - o[i]);
    if (i >= P.vecN) { const mean = sumB / P.vecN; vec[i] = mean > 0 && body[i] >= P.vecMult * mean ? 1 : 0; sumB -= body[i - P.vecN]; }
    sumB += body[i];
    tr[i] = i ? Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1])) : h[i] - l[i];
    sumTr += tr[i]; if (i >= P.atrN) sumTr -= tr[i - P.atrN]; atr[i] = i >= P.atrN - 1 ? sumTr / P.atrN : NaN;
  }
  const L = P.pivot;
  for (let i = L; i < n - L; i++) {
    let ph = true, pl = true;
    for (let k = 1; k <= L && (ph || pl); k++) { if (!(h[i] > h[i - k] && h[i] >= h[i + k])) ph = false; if (!(l[i] < l[i - k] && l[i] <= l[i + k])) pl = false; }
    pivH[i] = ph ? 1 : 0; pivL[i] = pl ? 1 : 0;
  }
  const ny = bars.map((b) => nyInfo(b.t));
  return { n, t, o, h, l, c, body, vec, atr, pivH, pivL, ny, mirror, sign: mirror ? -1 : 1, tick };
}
const lowerBound = (arr, x) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < x) lo = m + 1; else hi = m; } return lo; };

// the accumulation ending at bar i-1: the longest run of >= 8 bars with range <= 3 x ATR(14) at i-1, or null
export function accumulation(S, i) {
  const { h, l, atr } = S;
  if (i < P.accMinBars + P.atrN) return null;
  const lim = P.accAtrMult * atr[i - 1]; let hi = -Infinity, lo = Infinity, best = 0, bh = 0, bl = 0;
  for (let nb = 1; nb <= P.accMaxBars && i - nb >= 0; nb++) { hi = Math.max(hi, h[i - nb]); lo = Math.min(lo, l[i - nb]); if (hi - lo > lim) break; if (nb >= P.accMinBars) { best = nb; bh = hi; bl = lo; } }
  return best ? { n: best, high: bh, low: bl } : null;
}
export const funnel = () => ({ sweeps: 0, eqh: 0, inSession: 0, withAcc: 0, premium: 0, fbos: 0 });
export const buildCounts = () => ({ noSwing: 0, mxBroken: 0, noRbos: 0, rbosSlow: 0, rbosOverlap: 0, rbosFlip: 0, noOb: 0, badGeom: 0, lowRR: 0, capped: 0, orders: 0 });

// ─── M15 narrative: levels, accumulation, FBOS candidates (short side; the mirrored series gives the longs) — as run.mjs ───
// returns candidates { s, r, conf, L, kind, MX, accLow, accHigh, accN, sess, t }; funnel counts in `fun`
export function fbosCandidates(S, fun = funnel()) {
  const out = [], { n, h, l, c, t, atr, vec, pivH, ny, tick } = S;
  let dayKey = null, weekKey = null, pd = null, pw = null, dayH = -Infinity, dayL = Infinity, wkH = -Infinity, wkL = Infinity, wkBars = 0;
  const sessHL = {}; let levels = []; const pending = [];
  const sessDone = (sess, hr) => sess === 'ASIA' ? hr >= 1 && hr < 18 : sess === 'LONDON' ? hr >= 5 && hr < 18 : sess === 'NY_AM' ? hr >= 12 && hr < 18 : false;
  // one bar of a candidate's life: 'drop', 'confirm' or null (still pending)
  const advance = (cd, i) => {
    if (cd.r == null) {
      if (i - cd.s >= P.rejectBars) return 'drop';
      cd.MX = Math.max(cd.MX, h[i]);
      if (c[i] < cd.L) cd.r = i; else if (++cd.above >= 2) return 'drop';
      if (cd.r == null) return null;
    } else if (h[i] > cd.MX) return 'drop';
    for (let j = Math.max(0, cd.s - P.vecWindow); j <= Math.min(i, cd.r + P.vecWindow); j++) if (vec[j]) { cd.conf = i; return 'confirm'; }
    return i >= cd.r + P.vecWindow ? 'drop' : null;
  };
  for (let i = 0; i < n; i++) {
    const q = ny[i];
    if (q.day !== dayKey) {   // new trading day: previous-day level, sessions reset
      if (dayKey !== null && dayH > -Infinity) pd = { h: dayH, l: dayL };
      dayKey = q.day; dayH = -Infinity; dayL = Infinity; for (const k in sessHL) delete sessHL[k];
      levels = levels.filter((x) => x.kind === 'pw' || x.kind === 'eqh');
      if (pd) levels.push({ kind: 'pd', price: pd.h, from: i, swept: false });
    }
    if (q.week !== weekKey) {  // new trading week: previous-week level
      if (weekKey !== null && wkH > -Infinity) pw = { h: wkH, l: wkL };
      weekKey = q.week; wkH = -Infinity; wkL = Infinity; wkBars = 0;
      levels = levels.filter((x) => x.kind !== 'pw'); if (pw) levels.push({ kind: 'pw', price: pw.h, from: i, swept: false });
    }
    for (const sess of ['ASIA', 'LONDON', 'NY_AM']) { const x = sessHL[sess]; if (x && !x.level && sessDone(sess, q.h)) { x.level = true; levels.push({ kind: sess, price: x.h, from: i, swept: false }); } }
    // equal highs: the pivot confirmed at this bar (bar i-2) paired with an earlier pivot within 0.1 ATR, nothing higher in between or since
    if (i >= P.pivot && pivH[i - P.pivot] && i >= P.atrN) {
      const p2 = i - P.pivot, tol = P.eqTolAtr * atr[i - 1];
      for (let p1 = p2 - 1; p1 >= Math.max(0, i - P.eqLookback); p1--) {
        if (!pivH[p1] || Math.abs(h[p1] - h[p2]) > tol) continue;
        const lvl = Math.max(h[p1], h[p2]); let ok = true;
        for (let k = p1 + 1; k < i && ok; k++) if (k !== p2 && h[k] > lvl) ok = false;
        if (ok && !levels.some((x) => x.kind === 'eqh' && Math.abs(x.price - lvl) <= tol)) { levels.push({ kind: 'eqh', price: lvl, from: i, swept: false }); fun.eqh++; }
        break;
      }
    }
    levels = levels.filter((x) => x.kind !== 'eqh' || i - x.from <= P.eqLookback);
    for (let k = pending.length - 1; k >= 0; k--) { const st = advance(pending[k], i); if (st === 'confirm') { out.push(pending[k]); fun.fbos++; } if (st) pending.splice(k, 1); }
    // the sweep bar: the first bar beyond a live level by >= 1 tick (the most external level when several go in one bar)
    let swept = null;
    for (const x of levels) if (!x.swept && h[i] >= x.price + tick) { x.swept = true; fun.sweeps++; if (!swept || x.price > swept.price) swept = x; }
    const acc = accumulation(S, i);
    if (acc && (!swept || acc.high > swept.price) && h[i] >= acc.high + tick) { swept = { kind: 'acc', price: acc.high }; fun.sweeps++; }
    if (swept && SESS_TRADE.includes(q.sess) && q.hm !== 930) {
      fun.inSession++;
      if (acc) {
        fun.withAcc++;
        // premium: the level sits in the upper half of the running weekly range through i-1 (the day's range while the week is young)
        const useWeek = wkBars >= P.weekMinBars && wkH > -Infinity, rh = useWeek ? wkH : dayH, rl = useWeek ? wkL : dayL;
        if (rh > -Infinity && rl < Infinity && swept.price >= (rh + rl) / 2) {
          fun.premium++;
          const cd = { s: i, r: null, conf: null, L: swept.price, kind: swept.kind, MX: -Infinity, accLow: acc.low, accHigh: acc.high, accN: acc.n, sess: q.sess, t: t[i], above: 0 };
          const st = advance(cd, i); if (st === 'confirm') { out.push(cd); fun.fbos++; } else if (!st) pending.push(cd);
        }
      }
    }
    // running ranges and session extremes, after the tests: the sweep bar is not part of its own reference range
    dayH = Math.max(dayH, h[i]); dayL = Math.min(dayL, l[i]); wkH = Math.max(wkH, h[i]); wkL = Math.min(wkL, l[i]); wkBars++;
    if (q.sess) { const x = sessHL[q.sess] || (sessHL[q.sess] = { h: -Infinity, l: Infinity, level: false }); x.h = Math.max(x.h, h[i]); x.l = Math.min(x.l, l[i]); }
  }
  return out;
}

// ─── M5 execution: RBOS → OB → order; returns the order or null (reason counted in fun) — as run.mjs ───
// cd needs confEnd / rEnd (the confirming and rejection M15 bars' close times): see candidates()
export function buildOrder(S5, cd, M, variant, fun = buildCounts()) {
  const { h, l, c, o, t, vec, pivL, atr, body, n } = S5;
  const j0 = lowerBound(t, cd.confEnd), sIdx = lowerBound(t, cd.t), rEnd = lowerBound(t, cd.rEnd);
  if (j0 >= n || sIdx >= rEnd) return null;
  let mxIdx = sIdx; for (let k = sIdx; k < rEnd; k++) if (h[k] > h[mxIdx]) mxIdx = k;
  const MX = h[mxIdx];
  let p = -1; for (let k = mxIdx - 1; k >= Math.max(0, mxIdx - 288); k--) if (pivL[k] && k + P.pivot < j0) { p = k; break; }   // last confirmed M5 swing low before MX
  if (p < 0) { fun.noSwing++; return null; }
  const level = l[p];
  let b = -1;
  for (let k = mxIdx + 1; k <= Math.min(n - 2, mxIdx + P.rbosWait); k++) {
    if (h[k] > MX) { fun.mxBroken++; return null; }
    if (variant.trig === 'wick' ? l[k] <= level : c[k] < level) { b = k; break; }
  }
  if (b < 0) { fun.noRbos++; return null; }
  if (!(vec[b] || b - mxIdx <= P.rbosFast)) { fun.rbosSlow++; return null; }
  let ov = 0, cnt = 0;
  for (let k = mxIdx + 1; k <= b; k++) { cnt++; const rng = h[k] - l[k], inter = Math.min(h[k], h[k - 1]) - Math.max(l[k], l[k - 1]); if (rng > 0 && inter / rng > P.overlapRatio) ov++; }
  if (cnt && ov / cnt > P.overlapShare) { fun.rbosOverlap++; return null; }
  if (c[b + 1] > level) { fun.rbosFlip++; return null; }
  // order block: the last bullish candle before the displacement (the first bearish vector bar in [MX, b], else the break bar itself)
  let d = b; for (let k = mxIdx; k <= b; k++) if (vec[k] && c[k] < o[k]) { d = k; break; }
  let ob = -1; for (let k = d - 1; k >= mxIdx; k--) if (c[k] > o[k]) { ob = k; break; }
  if (ob < 0) for (let k = Math.max(mxIdx, d - 3); k <= d - 1; k++) if (ob < 0 || body[k] < body[ob]) ob = k;   // kev's fallback: the smallest body
  if (ob < 0) { fun.noOb++; return null; }
  const jA = Math.max(j0, b + 2);
  if (jA >= n) return null;
  const entry = variant.entry === 'open' ? o[ob] : (h[ob] + l[ob]) / 2;
  const stop = MX + M.stopExtra(atr[jA - 1]), risk = stop - entry;
  if (!(risk > 0)) { fun.badGeom++; return null; }
  const target = cd.accLow, rr = (entry - target) / risk;
  if (!(rr > P.minRR)) { fun.lowRR++; return null; }
  const capOK = risk <= P.capFrac * Math.abs(entry);
  if (capOK) fun.orders++; else fun.capped++;
  return { jA, entry, stop, target, risk, rr, MX, capOK, level: cd.kind, sess: cd.sess, tSig: cd.t, corr: cd.corr,
    // forward-record extras (the harness keeps indices; the stream needs prices and times in the series' own sign)
    mxIdx, b, ob, rbosLevel: level, obBar: { t: t[ob], o: o[ob], h: h[ob], l: l[ob], c: c[ob] }, tJA: t[jA], tBreak: t[b], tMX: t[mxIdx] };
}

// ─── the whole detector on one market's closed 5m candles: both directions, the primary variant, every order (capped flag kept) ───
// bars: cleanBars() output. Returns { orders, funnel, build, m5, m15 }; each order carries dir ('short' | 'long'), the sign-corrected
// prices (entry, stop, target, MX, rbosLevel, accLow / accHigh, obBar) and the times tSig (M15 sweep bar), tMX, tBreak, tJA (order bar).
export function detect(bars, M = XAU, variant = VARIANT, { m15bars = null } = {}) {
  const m15 = m15bars || agg15(bars), fun = funnel(), bc = buildCounts(), orders = [];
  for (const dir of ['short', 'long']) {
    const mirror = dir === 'long', S15 = series(m15, mirror, M.tick), S5 = series(bars, mirror, M.tick), sg = S15.sign;
    const cands = fbosCandidates(S15, fun);
    for (const cd of cands) { cd.confEnd = S15.t[cd.conf] + 900; cd.rEnd = S15.t[cd.r] + 900; cd.dir = dir; }
    for (const cd of cands) {
      const od = buildOrder(S5, cd, M, variant, bc); if (!od) continue;
      orders.push({ dir, sess: od.sess, level: od.level, capOK: od.capOK, rr: od.rr, risk: od.risk, jA: od.jA, tSig: od.tSig, tMX: od.tMX, tBreak: od.tBreak, tJA: od.tJA,
        entry: sg * od.entry, stop: sg * od.stop, target: sg * od.target, MX: sg * od.MX, rbosLevel: sg * od.rbosLevel, L: sg * cd.L,
        accLow: sg * cd.accLow, accHigh: sg * cd.accHigh, accN: cd.accN, obBar: { t: od.obBar.t, o: sg * od.obBar.o, c: sg * od.obBar.c, h: sg * (mirror ? od.obBar.l : od.obBar.h), l: sg * (mirror ? od.obBar.h : od.obBar.l) } });
    }
  }
  orders.sort((a, b) => a.jA - b.jA || a.tSig - b.tSig);
  return { orders, funnel: fun, build: bc, m5: bars.length, m15: m15.length };
}

// ─── the forward stream's records ───
export const recordId = (key, od) => `${key}-lit-${od.dir === 'short' ? 's' : 'b'}-${od.tJA}`;
const f = (x, d = 2) => (+x).toFixed(d);
const levelName = (k) => ({ pd: "the previous day's", pw: "the previous week's", acc: "the accumulation's own", eqh: 'equal', ASIA: "the Asia session's", LONDON: "the London session's", NY_AM: "the New York morning's" })[k] || k;
// 17:00 New York of the trading day that holds t, in unix seconds (the day's last M5 bar closes then)
export function dayEnd(t) { const q = nyInfo(t), local = (q.day + 1) * 86400 + 17 * 3600, u0 = local - nyOff(t) * 3600; return local - nyOff(u0) * 3600; }
// The Trader record for an order the detector would place (the harness's resting limit from bar jA). Shadow always: never live.
// Management is the Trader's own loop: a pending limit at the OB open (entryMode 'limit'), the stop, t1 = target, validFor = 24 M5 bars,
// maxHold to 17:00 New York (re-stamped from the fill by dayEndHold once filled), noBe (the Coach's R-based break-even is not the rule;
// the swing break-even is applied by swingBreaks each round). Deviations from the harness are stated in the note.
export function litRecord(od, { key = 'xau', label = 'XAU/USD', dec = 1, feed = undefined, M = XAU } = {}) {
  const dp = Math.max(2, (dec ?? 2) + 1), sell = od.dir === 'short', entry = +f(od.entry, dp), stop = +f(od.stop, dp), t1 = +f(od.target, dp), r0 = Math.abs(entry - stop), end = dayEnd(od.tJA);
  const q = nyInfo(od.tSig), hhmm = `${String(q.h).padStart(2, '0')}:${String(q.m).padStart(2, '0')}`;
  const note = `LIT (paper shadow, owner-shadow, never live): the ${hhmm} New York M15 bar swept ${levelName(od.level)} ${sell ? 'high' : 'low'} ${f(od.L, dp)} in ${od.sess === 'LONDON' ? 'London' : 'the New York morning'}`
    + ` after ${od.accN} M15 bars of accumulation (${f(od.accLow, dp)}-${f(od.accHigh, dp)}) and closed back ${sell ? 'below' : 'above'} it (FBOS); MX ${f(od.MX, dp)}. M5 then broke the last swing ${sell ? 'low' : 'high'} ${f(od.rbosLevel, dp)} by wick (RBOS).`
    + ` ${sell ? 'Sell' : 'Buy'} limit at the order block's open ${entry} (the last ${sell ? 'bullish' : 'bearish'} M5 candle before the displacement, ${f(od.obBar.l, dp)}-${f(od.obBar.h, dp)}), stop ${stop} (MX + spread + buffer, ${f(od.risk / Math.abs(od.entry) * 100, 3)}% of price), target the accumulation's ${sell ? 'low' : 'high'} ${t1} (${f(od.rr, 1)}R).`
    + ` Rests ${P.expiryBars} M5 bars; out at 17:00 New York; break-even after two post-entry M5 swing breaks (applied by the Trader's round after the second break, not on its bar). Paper deviations from the harness: fills at the limit on any touch (the study needed a 1-tick trade-through and filled at the open when a bar opened through), and the 09:30 candle can fill here.`;
  return { id: recordId(key, od), market: key, label, dec, k: K, name: NAME, pair: PAIR, h: '5m', side: sell ? 'sell' : 'buy',
    entry, stop, t1, rr: +f(od.rr, 2), opened: od.tJA, checked: od.tJA, status: 'pending', R: null, r0: +f(r0, dp), validFor: VALID_FOR, maxHold: Math.max(300, end - 60 - od.tJA), noBe: true, entryMode: 'limit',
    shadow: true, blockedBy: BLOCKED.slice(), ...(feed ? { feed } : {}),
    feat: { sess: od.sess, level: od.level, L: +f(od.L, dp), MX: +f(od.MX, dp), rbos: +f(od.rbosLevel, dp), accN: od.accN, accLow: +f(od.accLow, dp), accHigh: +f(od.accHigh, dp), riskPct: +f(od.risk / Math.abs(od.entry) * 100, 4) },
    lit: { sig: od.tSig, mx: od.tMX, brk: od.tBreak, ob: od.obBar.t, dayEnd: end, sess: od.sess, dir: od.dir }, note };
}
// once filled, the time exit is measured from the fill: hold to 17:00 New York (the loop closes on the first candle at or after
// filled + maxHold, so one minute early on 1-minute candles: the 16:59 candle closes at 17:00)
export function dayEndHold(tr) {
  if (tr.status !== 'open' || !tr.filled || !tr.lit || !tr.lit.dayEnd) return false;
  const want = Math.max(60, tr.lit.dayEnd - 60 - tr.filled);
  if (tr.maxHold === want) return false;
  tr.maxHold = want; return true;
}

// ─── the trader's gates (the harness's selectTrades), on the stream's own records ───
// one pending / open order at a time; <= 1 London fill + 1 NY_AM fill per trading day; no new order on a day after a net win or once the
// day's net R <= -1.5R (Rnet when the Trader has costed the trade, else R). recs: this market's LIT records. Returns the reason or null.
export function blockedWhy(recs, od) {
  const tJA = od.tJA;
  if (recs.some((x) => x.status === 'pending' || x.status === 'open' || (x.opened <= tJA && (x.closed || 0) >= tJA))) return 'busy';
  const day = nyInfo(tJA).day, ds = { fills: {}, R: 0, won: false };
  for (const x of recs) {
    if (!x.filled || nyInfo(x.filled).day !== day) continue;
    if (x.lit && x.lit.sess) ds.fills[x.lit.sess] = 1;
    if (['win', 'loss', 'be'].includes(x.status)) { const r = Number.isFinite(x.Rnet) ? x.Rnet : x.R; if (Number.isFinite(r)) { ds.R += r; if (r > 0) ds.won = true; } }
  }
  if (ds.won || ds.R <= P.dayCapR) return 'dayDone';
  if (ds.fills[od.sess]) return 'sessionDone';
  return null;
}
// One Trader round for one market (pure: returns the records to push, mutates only LIT records for the day-end hold and the
// break-even). bars: closed, cleaned 5m candles (cleanBars); recs: this market's LIT records (any status); now: the run clock.
// A new order is placed when its order bar is within the resting life (the harness's order would otherwise have expired), it is not
// already recorded and the gates allow it; later orders of the same round see the ones placed before them (one at a time).
export function litStep({ bars, recs, now, key = 'xau', label = 'XAU/USD', dec = 1, feed = undefined, M = XAU }) {
  const m5 = bars, m15 = agg15(completeQuarters(m5)), det = detect(m5, M, VARIANT, { m15bars: m15 });
  const push = [], skipped = [], all = recs.slice();
  for (const od of det.orders) {
    if (!od.capOK) continue;
    if (now - od.tJA > VALID_FOR) continue;   // the order's life is over: nothing to record (a long gap between rounds)
    const id = recordId(key, od);
    if (all.some((x) => x.id === id)) continue;
    const why = blockedWhy(all, od);
    if (why) { skipped.push({ id, why }); continue; }
    const rec = litRecord(od, { key, label, dec, feed, M });
    push.push(rec); all.push(rec);
  }
  let held = 0, be = 0;
  for (const tr of recs) {
    if (tr.status !== 'open') continue;
    if (dayEndHold(tr)) held++;
    if (swingBreakEven(tr, m5)) be++;
  }
  return { push, skipped, held, be, orders: det.orders.length, funnel: det.funnel, build: det.build, m5: det.m5, m15: det.m15, last: m5.length ? m5.at(-1).t : null };
}

// ─── break-even after two post-entry M5 swing breaks (the harness's managePosition, from the bar after the fill bar) ───
// counts the breaks on the closed 5m candles after the fill bar: a post-entry pivot (L = R = 2, confirmed two bars later) is tracked
// (a new one replaces it only when it is further along), a later bar beyond it is a break. Returns { breaks, at } (at = the second break's bar).
export function swingBreaks(bars, sell, filled) {
  const S = series(bars, !sell, XAU.tick), { n, l, pivL, t } = S, fillBar = Math.floor(filled / 300) * 300;
  let k = -1; for (let i = 0; i < n; i++) if (t[i] <= fillBar) k = i; else break;
  let breaks = 0, lastSwing = null, at = null;
  for (let q = k + 1; q < n; q++) {
    if (q - P.pivot > k && pivL[q - P.pivot] && (lastSwing == null || l[q - P.pivot] < lastSwing)) lastSwing = l[q - P.pivot];
    if (lastSwing != null && l[q] < lastSwing) { breaks++; lastSwing = null; if (breaks === P.beBreaks) at = t[q]; }
  }
  return { breaks, at };
}
// move an open LIT record's stop to its entry once two post-entry swing breaks have printed (never back out, never past a better stop)
export function swingBreakEven(tr, bars) {
  if (tr.status !== 'open' || !tr.filled || tr.beMoved || tr.k !== K) return false;
  const sell = tr.side === 'sell', E = tr.entry + (tr.feedBasis || 0), sb = swingBreaks(bars, sell, tr.filled);
  if (sb.breaks < P.beBreaks) return false;
  if (sell ? tr.stop <= E : tr.stop >= E) return false;
  tr.stop = E; tr.beMoved = true; tr.beSwing = sb.at; return true;
}
