// LIT (Liquidity Inducement Theory, Arctic / kev.futures, SKILL-v2.md) on OANDA 5-minute candles 2007-2026, pre-registered in
// preregistration.md (committed and merged before this ran). The "cleanest subset" the skill's §7 names: M15 manipulation (FBOS) of a
// session / previous-day / previous-week / accumulation / equal-highs level → M5 RBOS → limit at the IDM POI (the order block that
// caused the RBOS) → target the far extreme of the accumulation. Every parameter is §8's "(our default)" value; none was tuned.
// Deviation (data): the cache has no volume, so the vector rule is body-only (body >= 1.5 x the mean body of the preceding 10 bars).
//   node research/edge/lit/run.mjs <cacheDir> [result.json] [--smoke 2007]   (--smoke prints funnel counts for one year only, no R;
//   --only 2007 runs the whole pipeline on one year's files: the end-to-end code check on the 2007 warm-up year, counts read only)
// Trades of every set go to <cacheDir>/lit-trades.json (not in git); result.json keeps the primary set's trades.
// Paper research only: no live rule, config, trader, replay or site code changes. No candle is refetched.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { spotClosed } from '../../../council/fills.mjs';
import { inHalt, cmeShut } from '../../../ict/tracker.mjs';

const argv = process.argv.slice(2), flags = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { flags[argv[i].slice(2)] = argv[i + 1]; argv.splice(i, 2); i--; }
const [DIR, OUT = 'research/edge/lit/result.json'] = argv;
const SMOKE = flags.smoke ? +flags.smoke : 0, ONLY = flags.only ? +flags.only : 0;   // --only <year>: one year's files, full pipeline (code check)

// ─── pre-registered parameters (preregistration.md) ───
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
  divBars: 3, divNearAtr: 0.5, corrN: 20, corrMin: 0.3,     // XAG/XAU divergence (secondary): XAG sweeps within +-3 M15 bars, XAU holds within 0.5 ATR, corr veto < 0.3
  ctrlDraws: 1000, seed: 20261108, minN: 30,
};
export const WINDOWS = {
  A: { from: Date.UTC(2008, 0, 1) / 1000, to: Date.UTC(2018, 0, 1) / 1000, halves: [[2008, 2012], [2013, 2017]], label: '2008-17' },
  B: { from: Date.UTC(2018, 0, 1) / 1000, to: Date.UTC(2026, 10, 1) / 1000, halves: [[2018, 2021], [2022, 2026]], label: '2018-26' },
};
export const MARKETS = {
  xau: { sym: 'xau', label: 'XAUUSD (OANDA spot)', tick: 0.01, stopExtra: (atr5) => 0.30 + Math.max(0.1 * atr5, 0.30),
    cost: (p, market) => 0.30 + (market ? 0.15 : 0), skip: (t) => spotClosed(t) || inHalt(t), div: 'xag' },
  nas100: { sym: 'nas100', label: 'NAS100 (OANDA NAS100_USD CFD)', tick: 0.1, stopExtra: () => 1.0,
    cost: (p) => p * 0.0002 + 0.25, skip: (t) => inHalt(t) || cmeShut(t) },
};
export const MARKETS_DIV = { xag: { sym: 'xag', label: 'XAGUSD (OANDA spot)', tick: 0.001, skip: (t) => spotClosed(t) || inHalt(t) } };
export const VARIANTS = [
  { id: 'wick-open', trig: 'wick', entry: 'open', primary: true },
  { id: 'close-open', trig: 'close', entry: 'open' },
  { id: 'wick-mid', trig: 'wick', entry: 'mid' },
  { id: 'close-mid', trig: 'close', entry: 'mid' },
];
const SESS_TRADE = ['LONDON', 'NY_AM'];

// ─── New York time (bar start) ───
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

// ─── data ───
function load(M) {
  const files = fs.readdirSync(DIR).filter((f) => f.startsWith(M.sym + '-') && f.endsWith('.json.gz')).sort(), out = [];
  for (const f of files) {
    if ((SMOKE || ONLY) && !f.includes(`-${SMOKE || ONLY}.`)) continue;
    for (const [t, o, h, l, c] of JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, f))))) {
      if (M.skip(t) || !(o > 0 && h > 0 && l > 0 && c > 0)) continue;
      out.push({ t, o, h: Math.max(h, o, c), l: Math.min(l, o, c), c });
    }
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}
function agg15(m5) {
  const out = []; let cur = null, key = null;
  for (const b of m5) { const k = Math.floor(b.t / 900); if (k !== key) { key = k; cur = { t: k * 900, o: b.o, h: b.h, l: b.l, c: b.c }; out.push(cur); } else { cur.h = Math.max(cur.h, b.h); cur.l = Math.min(cur.l, b.l); cur.c = b.c; } }
  return out;
}
// a series with its derived arrays; mirror = true negates prices so the short-side logic trades the longs
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
function accumulation(S, i) {
  const { h, l, atr } = S;
  if (i < P.accMinBars + P.atrN) return null;
  const lim = P.accAtrMult * atr[i - 1]; let hi = -Infinity, lo = Infinity, best = 0, bh = 0, bl = 0;
  for (let nb = 1; nb <= P.accMaxBars && i - nb >= 0; nb++) { hi = Math.max(hi, h[i - nb]); lo = Math.min(lo, l[i - nb]); if (hi - lo > lim) break; if (nb >= P.accMinBars) { best = nb; bh = hi; bl = lo; } }
  return best ? { n: best, high: bh, low: bl } : null;
}

// ─── M15 narrative: levels, accumulation, FBOS candidates (short side; the mirrored series gives the longs) ───
// returns candidates { s, r, conf, L, kind, MX, accLow, accHigh, sess, t }; funnel counts in `fun`
export function fbosCandidates(S, fun) {
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

// ─── XAG / XAU divergence (secondary, gold only): XAG sweeps its comparable level with an FBOS, XAU holds (within 0.5 ATR, never beyond) ───
// the XAU candidate's MX = XAU's max high over the +-3 bar window; XAU's level = the same reference (that session's high, pd / pw high, the
// highest confirmed XAU pivot high of the last 96 bars for equal highs); target = XAU's own accumulation before the window
export function divCandidates(SX, SG, fun) {
  const gc = fbosCandidates(SG, { sweeps: 0, eqh: 0, inSession: 0, withAcc: 0, premium: 0, fbos: 0 });
  const out = [], { h, atr, ny, n, t: tX } = SX;
  for (const g of gc) {
    if (g.kind === 'acc') continue;
    const i = lowerBound(tX, SG.t[g.s]), r = Math.min(n - 1, lowerBound(tX, SG.t[g.r]));
    if (i >= n || i < P.corrN + 2 || g.s < P.corrN + 2) continue;
    let lvl = null;
    if (g.kind === 'pd' || g.kind === 'pw') { const key = g.kind === 'pd' ? 'day' : 'week', cur = ny[i][key]; let m = -Infinity; for (let k = i - 1; k >= 0 && ny[k][key] >= cur - 1; k--) if (ny[k][key] === cur - 1) m = Math.max(m, h[k]); if (m > -Infinity) lvl = m; }
    else if (g.kind === 'ASIA' || g.kind === 'LONDON' || g.kind === 'NY_AM') { let m = -Infinity; for (let k = i - 1; k >= 0 && ny[k].day === ny[i].day; k--) if (ny[k].sess === g.kind) m = Math.max(m, h[k]); if (m > -Infinity) lvl = m; }
    else { let best = null; for (let k = i - 3; k >= Math.max(0, i - P.eqLookback); k--) if (SX.pivH[k] && (best == null || h[k] > best)) best = h[k]; lvl = best; }
    if (lvl == null) continue;
    fun.divPairs++;
    const a = Math.max(0, i - P.divBars), bEnd = Math.min(n - 1, r + P.divBars);
    let mx = -Infinity; for (let k = a; k <= bEnd; k++) mx = Math.max(mx, h[k]);
    if (mx > lvl || mx < lvl - P.divNearAtr * atr[i]) { fun.divNoHold++; continue; }
    let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
    for (let k = 1; k <= P.corrN; k++) { const x = SX.c[i - k] / SX.c[i - k - 1] - 1, y = SG.c[g.s - k] / SG.c[g.s - k - 1] - 1; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; }
    const N = P.corrN, cov = sxy / N - (sx / N) * (sy / N), vx = sxx / N - (sx / N) ** 2, vy = syy / N - (sy / N) ** 2, corr = vx > 0 && vy > 0 ? cov / Math.sqrt(vx * vy) : 0;
    if (corr < P.corrMin) { fun.divCorrVeto++; continue; }
    const acc = accumulation(SX, a); if (!acc) { fun.divNoAcc++; continue; }
    if (!SESS_TRADE.includes(ny[i].sess) || ny[i].hm === 930) continue;
    const conf = Math.max(bEnd, Math.min(n - 1, lowerBound(tX, SG.t[g.conf])));
    out.push({ s: a, r: bEnd, conf, L: lvl, kind: 'div-' + g.kind, MX: mx, accLow: acc.low, accHigh: acc.high, accN: acc.n, sess: ny[i].sess, t: tX[a], corr: +corr.toFixed(2) });
    fun.fbos++;
  }
  return out;
}

// ─── M5 execution: RBOS → OB → order; returns the order or null (reason counted in fun) ───
export function buildOrder(S5, cd, M, variant, fun) {
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
  return { jA, entry, stop, target, risk, rr, MX, capOK, level: cd.kind, sess: cd.sess, tSig: cd.t, corr: cd.corr };
}

// the resting limit from bar jA: fill (1-tick trade-through, never on the 09:30 bar) or cancel; then the position
export function simulateOrder(S5, M, ord) {
  const { h, l, o, ny, n } = S5, { entry, stop, target, jA } = ord;
  for (let k = jA; k < Math.min(n, jA + P.expiryBars); k++) {
    if (ny[k].hm !== 930 && h[k] >= entry + S5.tick) {
      const fp = Math.max(entry, o[k]);
      if (h[k] >= stop) return finish(S5, M, ord, fp, k, stop, k, 'stop');          // entry then stop inside the fill bar: a loss
      if (l[k] <= target) return { filled: false, end: k, kind: 'ambiguous' };      // fill and target in one bar, order unknown: missed (fills.mjs)
      return managePosition(S5, M, ord, fp, k);
    }
    if (h[k] > ord.MX) return { filled: false, end: k, kind: 'mxBreak' };
    if (l[k] <= target) return { filled: false, end: k, kind: 'targetFirst' };
  }
  return { filled: false, end: Math.min(n - 1, jA + P.expiryBars - 1), kind: 'expired' };
}
// the position from the bar after the fill: stop first, then target; break-even after two post-entry swing breaks; closed at the day's last bar
export function managePosition(S5, M, ord, fp, k) {
  const { h, l, c, ny, n, pivL } = S5;
  let stop = ord.stop, breaks = 0, lastSwing = null;
  if (k + 1 >= n || ny[k + 1].day !== ny[k].day) return finish(S5, M, ord, fp, k, c[k], k, 'dayEnd');
  for (let q = k + 1; q < n; q++) {
    if (h[q] >= stop) return finish(S5, M, ord, fp, k, stop, q, stop === fp ? 'be' : 'stop');
    if (l[q] <= ord.target) return finish(S5, M, ord, fp, k, ord.target, q, 'target');
    if (q - P.pivot > k && pivL[q - P.pivot] && (lastSwing == null || l[q - P.pivot] < lastSwing)) lastSwing = l[q - P.pivot];
    if (lastSwing != null && l[q] < lastSwing) { breaks++; lastSwing = null; if (breaks >= P.beBreaks && stop > fp) stop = fp; }
    if (q + 1 >= n || ny[q + 1].day !== ny[q].day) return finish(S5, M, ord, fp, k, c[q], q, 'dayEnd');
  }
  return finish(S5, M, ord, fp, k, c[n - 1], n - 1, 'dataEnd');
}
function finish(S5, M, ord, fp, k, exitPx, q, kind) {
  const risk = ord.stop - fp, R = (fp - exitPx) / risk, cR = M.cost(Math.abs(fp), kind !== 'target') / risk;
  return { filled: true, k, exitIdx: q, end: q, t: S5.t[k], tExit: S5.t[q], fp: S5.sign * fp, exit: S5.sign * exitPx, risk, kind, R: +R.toFixed(4), cR: +cR.toFixed(4), Rnet: +(R - cR).toFixed(4), Rnet2: +(R - 2 * cR).toFixed(4) };
}

// ─── the trader: one pending / open order at a time, <= 1 London + 1 NY fill a trading day, stop after a win or at -1.5R ───
export function selectTrades(orders, ny) {
  orders.sort((a, b) => a.jA - b.jA || a.tSig - b.tSig);
  const taken = []; let busyUntil = -1; const dayState = new Map();
  for (const od of orders) {
    if (od.jA <= busyUntil) { od.why = 'busy'; continue; }
    const day = ny[od.jA].day, ds = dayState.get(day) || { fills: {}, R: 0, won: false };
    if (ds.won || ds.R <= P.dayCapR) { od.why = 'dayDone'; continue; }
    if (ds.fills[od.sess]) { od.why = 'sessionDone'; continue; }
    const sim = od.sim; busyUntil = sim.end;
    if (sim.filled) { ds.fills[od.sess] = 1; ds.R += sim.Rnet; if (sim.Rnet > 0) ds.won = true; taken.push(od); }
    dayState.set(day, ds);
  }
  return taken;
}

// ─── statistics ───
const mean = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const sd = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
export function stats(tr) {
  const n = tr.length, r = tr.map((x) => x.Rnet), g = tr.map((x) => x.R), r2 = tr.map((x) => x.Rnet2);
  if (!n) return { n: 0 };
  let eq = 0, peak = 0, dd = 0, streak = 0, worst = 0; for (const x of r) { eq += x; peak = Math.max(peak, eq); dd = Math.min(dd, eq - peak); streak = x < 0 ? streak + 1 : 0; worst = Math.max(worst, streak); }
  const years = new Set(tr.map((x) => x.year)).size || 1;
  return { n, win: +(tr.filter((x) => x.R > 0).length / n).toFixed(3), avgR: +mean(g).toFixed(3), exp: +mean(r).toFixed(3), t: +(sd(r) > 0 ? mean(r) / (sd(r) / Math.sqrt(n)) : 0).toFixed(2), total: +r.reduce((s, x) => s + x, 0).toFixed(1),
    exp2: +mean(r2).toFixed(3), total2: +r2.reduce((s, x) => s + x, 0).toFixed(1), maxDD: +dd.toFixed(1), streak: worst, perYear: +(n / years).toFixed(1), years };
}
const by = (tr, f) => { const m = {}; for (const x of tr) (m[f(x)] = m[f(x)] || []).push(x); return Object.fromEntries(Object.entries(m).sort().map(([k, v]) => [k, stats(v)])); };
const inWin = (x, W) => x.t >= W.from && x.t < W.to;

// mulberry32
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// the random-entry control: for each taken trade, a random M5 bar of the same year and session (never the 09:30 bar), entry at its close,
// the same stop (% of price) and target (R:R) distances, the same management, costs and day-end rules; `draws` x the whole set
export function controlDraws(trades, S5, M, pools, draws, rand) {
  const out = [];
  for (let d = 0; d < draws; d++) {
    const arr = new Float64Array(trades.length);
    for (let i = 0; i < trades.length; i++) {
      const tr = trades[i], pool = pools[tr.year + ':' + tr.sess];
      if (!pool || !pool.length) { arr[i] = NaN; continue; }
      const k = pool[Math.floor(rand() * pool.length)], fp = S5.c[k], risk = tr.riskFrac * Math.abs(fp);
      arr[i] = managePosition(S5, M, { stop: fp + risk, target: fp - tr.rr * risk }, fp, k).Rnet;
    }
    out.push(arr);
  }
  return out;
}
// margin = rule expectancy - control expectancy; CI: 1,000 draws, each a bootstrap resample of the rule trades against one control draw
function marginCI(idx, trades, ctrl, rand) {
  if (!idx.length) return null;
  const real = idx.map((i) => trades[i].Rnet), ms = [], cm = [];
  for (let d = 0; d < ctrl.length; d++) {
    let s = 0, n = 0; for (const i of idx) { const v = ctrl[d][i]; if (!Number.isNaN(v)) { s += v; n++; } }
    const cmean = n ? s / n : 0; cm.push(cmean);
    let rs = 0; for (let j = 0; j < real.length; j++) rs += real[Math.floor(rand() * real.length)];
    ms.push(rs / real.length - cmean);
  }
  ms.sort((a, b) => a - b); cm.sort((a, b) => a - b);
  const q = (a, p) => a[Math.min(a.length - 1, Math.floor(p * a.length))];
  return { ctrlExp: +mean(cm).toFixed(3), ctrlLo: +q(cm, 0.025).toFixed(3), ctrlHi: +q(cm, 0.975).toFixed(3), margin: +(mean(real) - mean(cm)).toFixed(3), lo: +q(ms, 0.025).toFixed(3), hi: +q(ms, 0.975).toFixed(3) };
}

// the pre-registered bar, one market, one trade set (net x1): in BOTH windows exp > 0 and t >= 2, both halves > 0, control margin CI
// lower bound > 0, x2 exp > 0; a window with n < 30 → INCONCLUSIVE (too few)
export function judge(W) {
  const reasons = []; let fail = false;
  for (const w of ['A', 'B']) {
    const s = W[w].all; if (!s || s.n < P.minN) { reasons.push(`${w}: too few (n ${s ? s.n : 0})`); continue; }
    const halves = Object.values(W[w].halves), m = W[w].ctrl;
    if (!(s.exp > 0)) { reasons.push(`${w}: expectancy ${s.exp} <= 0`); fail = true; } else if (s.t < 2) reasons.push(`${w}: t ${s.t} < 2`);
    if (halves.some((x) => !x.n || !(x.exp > 0))) { reasons.push(`${w}: a half is not positive`); fail = true; }
    if (!m || !(m.lo > 0)) { reasons.push(`${w}: control margin ${m ? `${m.margin} CI [${m.lo}, ${m.hi}]` : 'n/a'} does not exclude 0`); if (m && !(m.margin > 0)) fail = true; }
    if (!(s.exp2 > 0)) reasons.push(`${w}: x2 costs ${s.exp2} <= 0`);
  }
  return { verdict: !reasons.length ? 'PASS' : fail ? 'FAIL' : 'INCONCLUSIVE', reasons };
}

// ─── run ───
export function runMarket(key, M, div, allTrades) {
  const t0 = Date.now(), bars = load(M), m15bars = agg15(bars);
  const out = { label: M.label, m5: bars.length, m15: m15bars.length, from: new Date(bars[0].t * 1000).toISOString().slice(0, 10), to: new Date(bars.at(-1).t * 1000).toISOString().slice(0, 10), funnel: {}, sets: {} };
  const S5 = { short: series(bars, false, M.tick), long: series(bars, true, M.tick) }, S15 = { short: series(m15bars, false, M.tick), long: series(m15bars, true, M.tick) };
  let G15 = null;
  if (div) { const g15 = agg15(load(div)); G15 = { short: series(g15, false, div.tick), long: series(g15, true, div.tick) }; }
  const ny = S5.short.ny, pools = {};
  for (let k = 0; k < S5.short.n - 1; k++) { const q = ny[k]; if (SESS_TRADE.includes(q.sess) && q.hm !== 930) (pools[q.year + ':' + q.sess] = pools[q.year + ':' + q.sess] || []).push(k); }
  const rand = rng(P.seed);
  const setDefs = [{ id: 'std', div: false }]; if (div) setDefs.push({ id: 'div', div: true });
  for (const sd of setDefs) {
    const fun = { sweeps: 0, eqh: 0, inSession: 0, withAcc: 0, premium: 0, fbos: 0, divPairs: 0, divNoHold: 0, divCorrVeto: 0, divNoAcc: 0 }, cands = {};
    for (const dir of ['short', 'long']) {
      const c = sd.div ? divCandidates(S15[dir], G15[dir], fun) : fbosCandidates(S15[dir], fun);
      for (const cd of c) { cd.confEnd = S15[dir].t[cd.conf] + 900; cd.rEnd = S15[dir].t[cd.r] + 900; cd.dir = dir; }
      cands[dir] = c;
    }
    out.funnel[sd.id] = { ...fun, candShort: cands.short.length, candLong: cands.long.length };
    if (SMOKE) continue;
    for (const V of VARIANTS) {
      const vf = { noSwing: 0, mxBroken: 0, noRbos: 0, rbosSlow: 0, rbosOverlap: 0, rbosFlip: 0, noOb: 0, badGeom: 0, lowRR: 0, capped: 0, orders: 0 }, all = [];
      for (const dir of ['short', 'long']) for (const cd of cands[dir]) { const od = buildOrder(S5[dir], cd, M, V, vf); if (od) { od.dir = dir; od.sim = simulateOrder(S5[dir], M, od); all.push(od); } }
      const setOut = { set: sd.id, variant: V.id, primary: !!V.primary && sd.id === 'std', build: vf };
      for (const capMode of ['cap', 'uncapped']) {
        const orders = all.filter((od) => capMode === 'uncapped' || od.capOK).map((od) => ({ ...od }));
        const taken = selectTrades(orders, ny);
        const trades = taken.map((od) => { const s = od.sim, q = ny[s.k]; return { t: s.t, date: new Date(s.t * 1000).toISOString().slice(0, 16), dir: od.dir, sess: od.sess, level: od.level, year: q.year, entry: +s.fp.toFixed(3), exit: +s.exit.toFixed(3), riskFrac: od.risk / Math.abs(od.entry), rr: +od.rr.toFixed(2), kind: s.kind, R: s.R, cR: s.cR, Rnet: s.Rnet, Rnet2: s.Rnet2, hold: s.exitIdx - s.k, corr: od.corr }; });
        const ctrl = []; for (let d = 0; d < P.ctrlDraws; d++) ctrl.push(new Float64Array(trades.length));
        for (const dir of ['short', 'long']) {
          const idx = trades.map((x, i) => [x, i]).filter(([x]) => x.dir === dir); if (!idx.length) continue;
          const draws = controlDraws(idx.map(([x]) => x), S5[dir], M, pools, P.ctrlDraws, rand);
          for (let d = 0; d < P.ctrlDraws; d++) idx.forEach(([, i], j) => { ctrl[d][i] = draws[d][j]; });
        }
        const W = {};
        for (const [w, win] of Object.entries(WINDOWS)) {
          const idx = trades.map((x, i) => (inWin(x, win) ? i : -1)).filter((i) => i >= 0), tw = idx.map((i) => trades[i]);
          W[w] = { label: win.label, all: stats(tw), halves: Object.fromEntries(win.halves.map((hf) => [`${hf[0]}-${hf[1]}`, stats(tw.filter((x) => x.year >= hf[0] && x.year <= hf[1]))])),
            ctrl: marginCI(idx, trades, ctrl, rand), bySession: by(tw, (x) => x.sess), byDir: by(tw, (x) => x.dir), byYear: by(tw, (x) => x.year), byLevel: by(tw, (x) => x.level), byExit: by(tw, (x) => x.kind) };
          for (const sess of SESS_TRADE) if (W[w].bySession[sess]) W[w].bySession[sess].ctrl = marginCI(idx.filter((i) => trades[i].sess === sess), trades, ctrl, rand);
          for (const dir of ['short', 'long']) if (W[w].byDir[dir]) W[w].byDir[dir].ctrl = marginCI(idx.filter((i) => trades[i].dir === dir), trades, ctrl, rand);
        }
        setOut[capMode] = { orders: orders.length, filled: orders.filter((o) => o.sim.filled).length, taken: trades.length, unfilled: by(orders.filter((o) => !o.sim.filled && !o.why).map((o) => ({ ...o, Rnet: 0, R: 0, Rnet2: 0, year: 0, kind: o.sim.kind })), (x) => x.kind), all: stats(trades), windows: W, judge: judge(W) };
        const rows = trades.map((x) => ({ ...x, riskFrac: +x.riskFrac.toFixed(6) }));
        allTrades[`${key}:${sd.id}:${V.id}:${capMode}`] = rows;
        if (setOut.primary && capMode === 'cap') setOut.trades = rows;
      }
      out.sets[`${sd.id}:${V.id}`] = setOut;
      console.error(`${key} ${sd.id} ${V.id}: orders ${setOut.cap.orders} filled ${setOut.cap.filled} taken ${setOut.cap.taken} | uncapped orders ${setOut.uncapped.orders} taken ${setOut.uncapped.taken}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
  }
  out.seconds = +((Date.now() - t0) / 1000).toFixed(1);
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (!DIR) { console.error('usage: run.mjs <cacheDir> [result.json] [--smoke <year>]'); process.exit(1); }
  const res = { topic: 'lit', built: new Date().toISOString().slice(0, 10), at: new Date().toISOString(), params: P, windows: { A: WINDOWS.A.label, B: WINDOWS.B.label }, variants: VARIANTS.map((v) => v.id), markets: {} }, allTrades = {};
  for (const [key, M] of Object.entries(MARKETS)) res.markets[key] = runMarket(key, M, M.div ? MARKETS_DIV[M.div] : null, allTrades);
  if (SMOKE) { console.log(JSON.stringify(Object.fromEntries(Object.entries(res.markets).map(([k, m]) => [k, { m5: m.m5, m15: m.m15, from: m.from, to: m.to, funnel: m.funnel }])), null, 1)); process.exit(0); }
  const verdicts = {};
  for (const [key, m] of Object.entries(res.markets)) { const prim = Object.values(m.sets).find((s) => s.primary); verdicts[key] = prim ? prim.cap.judge : null; }
  res.primaryVerdicts = verdicts;
  const vs = Object.values(verdicts).map((v) => v && v.verdict);
  res.verdict = vs.includes('PASS') ? 'PASS' : vs.every((v) => v === 'FAIL') ? 'FAIL' : 'INCONCLUSIVE';
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
  fs.writeFileSync(path.join(DIR, 'lit-trades.json'), JSON.stringify(allTrades));
  console.error(`wrote ${OUT}: ${res.verdict} ${JSON.stringify(Object.fromEntries(Object.entries(verdicts).map(([k, v]) => [k, v && v.verdict])))}`);
}
