// research/edge/_lib/edgekit.mjs - the shared toolkit of the overnight edge studies (22-23 Nov 2026).
// Pure ES module, Node built-ins only. Research only: nothing live imports it, it places nothing and reads no council file.
//
// Candle cache (outside git): <EDGE_DATA>/<market>/<tf>-<year>.json.gz = [[t, o, h, l, c], ...] (t = candle start, unix
// seconds, UTC; OANDA mid candles read through the site's candle proxy), plus <EDGE_DATA>/INDEX.json. Default EDGE_DATA is
// the session scratchpad below; set the environment variable EDGE_DATA to read another copy.
// Markets: xau, eurusd, gbpusd, usdjpy, audusd. Timeframes: '1m' (where fetched, 2019 on; 23 Nov 2026), '5m' (2010 on), '1d' (2009 on, raw UTC days, Sunday stubs
// included: use dailyNY on 5m candles for trading days).
// Holdout (23 Nov 2026): the same five markets 2005-01-01 to 2009-12-31 (5m and 1d; OANDA's gold starts later, see
// INDEX.json), and HOLDOUT_MARKETS nzdusd, usdcad, usdchf, eurjpy, xag from 2005 to now (5m and 1d). Untouched by the
// studies of 22-23 Nov: judge anything new there. MARKETS stays the five read markets so earlier studies re-run alike.
//
// API (a bar is { t, o, h, l, c, e } with e = the moment it closes; every index below is into the array handed in):
//   DATA_DIR, MARKETS, HOLDOUT_MARKETS, HOLDOUT, COSTS, TF                     constants (COSTS: round trip in price units, the desk's demo figures)
//   load(market, tf, { from, to })                   bars from the cache, sorted, t in [from, to) (unix s or 'YYYY-MM-DD')
//   resample(bars, sec)                              UTC-aligned buckets (900 / 1800 / 3600 / 14400 ...), e = t + sec
//   dailyNY(bars)                                    17:00 New York trading days (weekend candles folded into Monday)
//   nyOffsetH(t)                                     New York offset from UTC in hours (4 summer, 5 winter)
//   closedBy(bars, t)  /  closedCount(bars, t)       the bars closed at moment t (b.e <= t) / how many
//   barAt(bars, t)                                   index of the bar holding moment t (b.t <= t < b.e), or -1
//   swings(bars, K)                                  confirmed swing highs / lows: { i, t, type 'H'|'L', price, ci, ct }
//   boxesClose(bars)                                 boxes from a breakout candle until a close outside
//   boxesHL(bars, K)                                 boxes between a swing low and a swing high, ended by a close outside
//   qms(bars, K)                                     QM (BO Structure) buys and sells with their zones
//   structure(bars, K)                               BO / ChoCh events and the side known at each candle
//   simulate(trade, bars, opts)                      one trade on finer candles: stop / target / time exits
//   stats(trades, opts)                              n, wins, meanR, tTrade, tMonth, by year, IS / OOS, max drawdown
//   tDist(t, df) / pFromT(t, df)                     Student-t two-sided p
//   holm(pvals)                                      Holm-adjusted p values (same order)
//   bootstrapMonths(trades, opts)                    month-block bootstrap of the mean monthly R (seeded)
//   rng(seed)                                        a small seeded random generator (mulberry32)
//
// No look-ahead: every output that names a candle index i depends only on candles 0..i (swings on 0..ci). The test
// tests/edgekit.test.mjs changes every later price and checks the earlier outputs do not move.
// Definitions are written here in plain words of this repository; they are readings, not tested rules.

import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';

export const DATA_DIR = process.env.EDGE_DATA || '/tmp/claude-0/-workspace-macro-dashboard/70c7c5c7-1744-58d1-abc7-8a850c1b63a7/scratchpad/edge-data';
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const HOLDOUT_MARKETS = ['nzdusd', 'usdcad', 'usdchf', 'eurjpy', 'xag'];
export const HOLDOUT = { early: { from: '2005-01-01', to: '2010-01-01', markets: MARKETS }, fresh: { from: '2005-01-01', markets: HOLDOUT_MARKETS } };
export const TF = { '1m': 60, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '4h': 14400, '1d': 86400 };
// Round-trip cost in price units per market: the desk's demo-account figures (spread + commission, rounded up), the same
// for every year. Studies may charge more; never less without a measured source.
export const COSTS = { xau: 0.30, eurusd: 0.00006, gbpusd: 0.00008, usdjpy: 0.008, audusd: 0.00006,
  // holdout markets: ASSUMED round trips (not measured on the demo account; 23 Nov 2026)
  nzdusd: 0.00007, usdcad: 0.00007, usdchf: 0.00007, eurjpy: 0.010, xag: 0.03 };

const toSec = (x) => (x == null ? null : typeof x === 'number' ? x : Math.floor(Date.parse(x + (String(x).length <= 10 ? 'T00:00:00Z' : '')) / 1000));

// ---- loading -------------------------------------------------------------------------------------------------------
export function load(market, tf, { from, to, dir = DATA_DIR } = {}) {
  const a = toSec(from) ?? -Infinity, b = toSec(to) ?? Infinity;
  const sec = TF[tf];
  if (!sec) throw new Error('unknown timeframe ' + tf);
  const folder = path.join(dir, market);
  if (!fs.existsSync(folder)) throw new Error('no cache for ' + market + ' in ' + dir);
  const files = fs.readdirSync(folder).filter((f) => f.startsWith(tf + '-') && f.endsWith('.json.gz')).sort();
  const out = [];
  for (const f of files) {
    const y = +f.slice(tf.length + 1, tf.length + 5);
    if (Date.UTC(y + 1, 0, 1) / 1000 <= a || Date.UTC(y, 0, 1) / 1000 >= b) continue;
    const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(folder, f))).toString());
    for (const r of rows) if (r[0] >= a && r[0] < b) out.push({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4], e: r[0] + sec });
  }
  out.sort((p, q) => p.t - q.t);
  return out.filter((x, i) => i === 0 || x.t !== out[i - 1].t);
}

// ---- time ----------------------------------------------------------------------------------------------------------
function nthSunday(y, m, n) { // m 0-based; n-th Sunday, as a UTC day start
  const d = new Date(Date.UTC(y, m, 1)); const first = (7 - d.getUTCDay()) % 7;
  return Date.UTC(y, m, 1 + first + 7 * (n - 1)) / 1000;
}
export function nyOffsetH(t) { // US daylight time: from 2007 the 2nd Sunday of March 07:00 UTC to the 1st Sunday of November
  // 06:00 UTC; before 2007 the 1st Sunday of April 07:00 UTC to the last Sunday of October 06:00 UTC (review of 23 Nov 2026)
  const y = new Date(t * 1000).getUTCFullYear();
  const on = (y < 2007 ? nthSunday(y, 3, 1) : nthSunday(y, 2, 2)) + 7 * 3600;
  const off = (y < 2007 ? nthSunday(y, 10, 1) - 7 * 86400 : nthSunday(y, 10, 1)) + 6 * 3600;
  return t >= on && t < off ? 4 : 5;
}

export function resample(bars, sec) {
  const out = []; let cur = null;
  for (const b of bars) {
    const k = Math.floor(b.t / sec) * sec;
    if (!cur || cur.t !== k) { cur = { t: k, o: b.o, h: b.h, l: b.l, c: b.c, e: k + sec, n: 1 }; out.push(cur); }
    else { if (b.h > cur.h) cur.h = b.h; if (b.l < cur.l) cur.l = b.l; cur.c = b.c; cur.n++; }
  }
  return out;
}

// A trading day runs 17:00 New York to 17:00 New York; t = its start, e = its end. A candle dated Saturday or Sunday
// (the Sunday reopen is already Monday's day) is folded into the next Monday.
export function dailyNY(bars) {
  const out = []; let cur = null;
  for (const b of bars) {
    const off = nyOffsetH(b.t);
    let key = Math.floor((b.t - off * 3600 + 7 * 3600) / 86400); // the New York date the day ends on
    const wd = new Date(key * 86400e3).getUTCDay();
    if (wd === 6) key += 2; else if (wd === 0) key += 1;
    if (!cur || cur.key !== key) {
      const endOff = nyOffsetH(key * 86400 + 21 * 3600);
      const e = key * 86400 + 17 * 3600 + endOff * 3600;
      cur = { key, t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, e, n: 1 };
      out.push(cur);
    } else { if (b.h > cur.h) cur.h = b.h; if (b.l < cur.l) cur.l = b.l; cur.c = b.c; cur.n++; }
  }
  for (const d of out) { d.date = new Date(d.key * 86400e3).toISOString().slice(0, 10); delete d.key; }
  return out;
}

export function closedCount(bars, t) { // number of bars with e <= t (bars sorted by t, e increasing)
  let lo = 0, hi = bars.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (bars[m].e <= t) lo = m + 1; else hi = m; }
  return lo;
}
export const closedBy = (bars, t) => bars.slice(0, closedCount(bars, t));
export function barAt(bars, t) {
  let lo = 0, hi = bars.length - 1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (bars[m].t > t) hi = m - 1; else if (bars[m].e <= t) lo = m + 1; else return m; }
  return -1;
}

// ---- structure -----------------------------------------------------------------------------------------------------
// Swing high at i: its high is above the K highs before it and at or above the K after it (a low mirrors). Known at the
// close of candle ci = i + K.
export function swings(bars, K = 3) {
  const out = [];
  for (let i = K; i + K < bars.length; i++) {
    let hi = true, lo = true;
    for (let j = 1; j <= K && (hi || lo); j++) {
      if (!(bars[i].h > bars[i - j].h && bars[i].h >= bars[i + j].h)) hi = false;
      if (!(bars[i].l < bars[i - j].l && bars[i].l <= bars[i + j].l)) lo = false;
    }
    if (hi) out.push({ i, t: bars[i].t, type: 'H', price: bars[i].h, ci: i + K, ct: bars[i + K].e });
    if (lo) out.push({ i, t: bars[i].t, type: 'L', price: bars[i].l, ci: i + K, ct: bars[i + K].e });
  }
  return out;
}

// A box starts at a breakout candle (the first candle) and takes the high and low of every candle until one CLOSES above
// its high (break up) or below its low (break down); that candle ends the box and starts the next one.
// Each box: { s, e, hi, lo, dir (+1 / -1, 0 = still open), bi (break index), bt (break candle close time) }.
export function boxesClose(bars) {
  const out = []; if (!bars.length) return out;
  let box = { s: 0, e: 0, hi: bars[0].h, lo: bars[0].l, dir: 0, bi: -1, bt: null };
  for (let j = 1; j < bars.length; j++) {
    const b = bars[j];
    const dir = b.c > box.hi ? 1 : b.c < box.lo ? -1 : 0;
    if (dir) {
      box.dir = dir; box.bi = j; box.bt = b.e; out.push(box);
      box = { s: j, e: j, hi: b.h, lo: b.l, dir: 0, bi: -1, bt: null };
    } else { box.e = j; if (b.h > box.hi) box.hi = b.h; if (b.l < box.lo) box.lo = b.l; }
  }
  out.push(box);
  return out;
}

// A box between a swing low and a swing high: from the candle that confirms the later of the two, until a candle closes
// above the high (+1) or below the low (-1). The next box takes the next swing high and swing low both made after the
// later swing of the box before (boxes chain). Same on every timeframe.
// Each box: { hiI, loI, hi, lo, s (start index = later confirmation), dir, bi, bt }.
export function boxesHL(bars, K = 3) {
  const sw = swings(bars, K).sort((a, b) => a.ci - b.ci || a.i - b.i);
  const out = []; let after = -1, H = null, L = null, k = 0, box = null;
  for (let j = 0; j < bars.length; j++) {
    while (k < sw.length && sw[k].ci <= j) {
      const s = sw[k++];
      if (s.i <= after) continue;
      if (s.type === 'H') H = s; else L = s;
    }
    if (!box && H && L) { box = { hiI: H.i, loI: L.i, hi: H.price, lo: L.price, s: Math.max(H.ci, L.ci), dir: 0, bi: -1, bt: null }; continue; }
    if (box && j > box.s) {
      const c = bars[j].c, dir = c > box.hi ? 1 : c < box.lo ? -1 : 0;
      if (dir) {
        box.dir = dir; box.bi = j; box.bt = bars[j].e; out.push(box);
        after = Math.max(box.hiI, box.loI); box = null; H = null; L = null;
      }
    }
  }
  if (box) out.push(box);
  return out;
}

// QM buy (BO Structure): swings ... H0, L1, H1 (a lower high, under H0), then price trades below L1 (support broken; the
// lowest low after H1 is the head), then a candle CLOSES above H1: that close is the QM buy. A sell mirrors it. A newer
// swing high that is not a lower high cancels a waiting buy (a newer higher low cancels a waiting sell).
// Each: { side +1 / -1, i (the breaking candle), t (its close), level (H1 / L1 broken), shoulder (L1 / H1 swept),
//         head, headI, zone { lo, hi } = from the head to the shoulder (the area a pullback is expected into) }.
export function qms(bars, K = 3) {
  const sw = swings(bars, K).sort((a, b) => a.ci - b.ci || a.i - b.i);
  const out = []; const hs = [], ls = []; let k = 0;
  const armed = { 1: null, '-1': null };
  for (let j = 0; j < bars.length; j++) {
    while (k < sw.length && sw[k].ci < j) {
      const s = sw[k++];
      (s.type === 'H' ? hs : ls).push(s);
      if (s.type === 'H' && hs.length >= 2) {
        const h1 = s, h0 = hs[hs.length - 2]; const l1 = [...ls].reverse().find((x) => x.i < h1.i && x.i > h0.i);
        armed[1] = h1.price < h0.price && l1 ? { level: h1.price, li: h1.i, shoulder: l1.price, head: Infinity, headI: -1, broke: false, from: h1.i } : null;
      }
      if (s.type === 'L' && ls.length >= 2) {
        const l1 = s, l0 = ls[ls.length - 2]; const h1 = [...hs].reverse().find((x) => x.i < l1.i && x.i > l0.i);
        armed[-1] = l1.price > l0.price && h1 ? { level: l1.price, li: l1.i, shoulder: h1.price, head: -Infinity, headI: -1, broke: false, from: l1.i } : null;
      }
    }
    const b = bars[j];
    const A = armed[1];
    if (A && j > A.li) {
      // the head may already be in the candles between the lower high and its confirmation
      if (A.headI < 0) for (let x = A.from + 1; x < j; x++) if (bars[x].l < A.head) { A.head = bars[x].l; A.headI = x; }
      if (b.l < A.head) { A.head = b.l; A.headI = j; }
      if (A.head < A.shoulder) A.broke = true;
      if (A.broke && b.c > A.level) {
        out.push({ side: 1, i: j, t: b.e, level: A.level, shoulder: A.shoulder, head: A.head, headI: A.headI, zone: { lo: A.head, hi: A.shoulder } });
        armed[1] = null;
      }
    }
    const S = armed[-1];
    if (S && j > S.li) {
      if (S.headI < 0) for (let x = S.from + 1; x < j; x++) if (bars[x].h > S.head) { S.head = bars[x].h; S.headI = x; }
      if (b.h > S.head) { S.head = b.h; S.headI = j; }
      if (S.head > S.shoulder) S.broke = true;
      if (S.broke && b.c < S.level) {
        out.push({ side: -1, i: j, t: b.e, level: S.level, shoulder: S.shoulder, head: S.head, headI: S.headI, zone: { lo: S.shoulder, hi: S.head } });
        armed[-1] = null;
      }
    }
  }
  return out;
}

// Structure: a close above the last confirmed swing high not yet broken is a break up; against the side held before it is
// a ChoCh, with it a BO (a close below the last swing low mirrors). side[i] = the side known after candle i closes
// (0 before the first break). Each level breaks once.
export function structure(bars, K = 3) {
  const sw = swings(bars, K).sort((a, b) => a.ci - b.ci || a.i - b.i);
  const events = []; const side = new Array(bars.length).fill(0);
  let H = null, L = null, s = 0, k = 0;
  for (let j = 0; j < bars.length; j++) {
    while (k < sw.length && sw[k].ci < j) { const x = sw[k++]; if (x.type === 'H') H = x; else L = x; }
    const c = bars[j].c;
    if (H && c > H.price) { events.push({ i: j, t: bars[j].e, dir: 1, kind: s === 1 ? 'BO' : 'ChoCh', level: H.price, from: H.i }); s = 1; H = null; }
    else if (L && c < L.price) { events.push({ i: j, t: bars[j].e, dir: -1, kind: s === -1 ? 'BO' : 'ChoCh', level: L.price, from: L.i }); s = -1; L = null; }
    side[j] = s;
  }
  return { events, side };
}

// ---- trade simulation ----------------------------------------------------------------------------------------------
// trade: { side +1 / -1, entry, stop, target? (null = none), t (order time, unix s), type 'market' | 'limit',
//          expire? (unix s, limit only), maxHold? (seconds after the fill), id? }
// bars: finer candles { t, o, h, l, c, e }. opts: { cost (price units round trip, default 0) }.
// Rules: a market order fills at the open of the first candle starting at or after t; a limit fills only on a candle
// starting at or after t that trades to the entry (at the open when it opens past the entry), and on that candle only the
// stop can be hit; after it, a candle that opens past the stop exits at the open, past the target at the open; a candle
// that holds both stop and target is a stop; time exit at the close of the first candle closing at or after the deadline (fill time + maxHold).
// Returns { status 'win'|'loss'|'be'|'nofill'|'open'|'bad', fill, fillT, exit, exitT, reason, risk, R, Rnet, mfe, mae }.
export function simulate(trade, bars, opts = {}) {
  const { side, stop, target = null, t, type = 'market' } = trade;
  const cost = opts.cost || 0;
  const s = side > 0 ? 1 : -1;
  if (!(s * (trade.entry - stop) > 0) && type === 'limit') return { status: 'bad', reason: 'stop on the wrong side' };
  let i = 0; { let lo = 0, hi = bars.length; while (lo < hi) { const m = (lo + hi) >> 1; if (bars[m].t < t) lo = m + 1; else hi = m; } i = lo; }
  let fill = null, fillI = -1;
  if (type === 'market') { if (i < bars.length) { fill = bars[i].o; fillI = i; } }
  else {
    for (; i < bars.length; i++) {
      const b = bars[i];
      if (trade.expire != null && b.t >= trade.expire) break;
      if (s > 0 ? b.l <= trade.entry : b.h >= trade.entry) { fill = s > 0 ? Math.min(b.o, trade.entry) : Math.max(b.o, trade.entry); fillI = i; break; }
    }
  }
  if (fillI < 0) return { status: 'nofill', reason: 'no fill' };
  const risk = s * (fill - stop);
  let mfe = 0, mae = 0;
  if (!(risk > 0)) {
    if (type === 'market') return { status: 'bad', reason: 'price already past the stop', fill, fillT: bars[fillI].t };
    // a limit filled at an open already past the stop exits there at once
    return done(fill, bars[fillI].t, 'stop', Math.abs(trade.entry - stop));
  }
  const deadline = trade.maxHold != null ? bars[fillI].t + trade.maxHold : null;
  function done(px, at, reason, rk = risk) {
    const R = (s * (px - fill)) / rk; const Rnet = R - cost / rk;
    return { status: R > 1e-9 ? 'win' : R < -1e-9 ? 'loss' : 'be', fill, fillT: bars[fillI].t, exit: px, exitT: at, reason, risk: rk, R, Rnet, mfe, mae };
  }
  for (let j = fillI; j < bars.length; j++) {
    const b = bars[j], first = j === fillI;
    if (!first) {
      if (s * (b.o - stop) <= 0) return done(b.o, b.t, 'stop');
      if (target != null && s * (b.o - target) >= 0) return done(b.o, b.t, 'target');
    }
    const hitStop = s > 0 ? b.l <= stop : b.h >= stop;
    if (hitStop) return done(stop, b.e, 'stop');
    if (!(first && type === 'limit')) {
      const fav = s > 0 ? b.h : b.l, adv = s > 0 ? b.l : b.h;
      mfe = Math.max(mfe, (s * (fav - fill)) / risk); mae = Math.min(mae, (s * (adv - fill)) / risk);
      if (target != null && (s > 0 ? b.h >= target : b.l <= target)) return done(target, b.e, 'target');
    } else { mae = Math.min(mae, (s * ((s > 0 ? b.l : b.h) - fill)) / risk); }
    if (deadline != null && b.e >= deadline) return done(b.c, b.e, 'time');
  }
  const last = bars[bars.length - 1];
  return { status: 'open', fill, fillT: bars[fillI].t, exit: last.c, exitT: last.e, reason: 'end', risk, R: (s * (last.c - fill)) / risk, Rnet: null, mfe, mae };
}

// ---- statistics ----------------------------------------------------------------------------------------------------
function lgamma(x) { // Lanczos
  const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1; let a = c[0]; const tt = x + g + 0.5; for (let i = 1; i < 9; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(tt) - tt + Math.log(a);
}
function betacf(a, b, x) {
  let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - (qab * x) / qap; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d; let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m; let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d;
    const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-12) break;
  }
  return h;
}
function ibeta(a, b, x) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}
export function pFromT(t, df) { if (!Number.isFinite(t) || !(df > 0)) return null; return ibeta(df / 2, 0.5, df / (df + t * t)); }
export const tDist = pFromT;

function moments(xs) {
  const n = xs.length; if (!n) return { n: 0, mean: null, sd: null, t: null, p: null };
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : null;
  const t = sd > 0 ? mean / (sd / Math.sqrt(n)) : null;
  return { n, mean, sd, t, p: t == null ? null : pFromT(t, n - 1) };
}
const monthKey = (t) => new Date(t * 1000).toISOString().slice(0, 7);
function monthSums(trades, key, timeKey) {
  const m = new Map(); for (const x of trades) { const k = monthKey(x[timeKey]); m.set(k, (m.get(k) || 0) + x[key]); }
  if (!m.size) return [];
  const ks = [...m.keys()].sort(); const [y0, m0] = ks[0].split('-').map(Number), [y1, m1] = ks[ks.length - 1].split('-').map(Number);
  const out = []; for (let y = y0, mo = m0; y < y1 || (y === y1 && mo <= m1); mo === 12 ? (y++, (mo = 1)) : mo++) {
    const k = `${y}-${String(mo).padStart(2, '0')}`; out.push([k, m.get(k) || 0]); }
  return out;
}
// trades: [{ R | Rnet, exitT | t }]. opts: { key ('Rnet' when the trades carry it, else 'R'), time ('exitT', else 't'),
// isTo 2024 (IS = before 2024-01-01, from 2020 unless isFrom given), isFrom 2020 }.
export function stats(trades, opts = {}) {
  const key = opts.key || (trades.some((x) => x.Rnet != null) ? 'Rnet' : 'R');
  const time = opts.time || (trades.some((x) => x.exitT != null) ? 'exitT' : 't');
  const xs = trades.filter((x) => Number.isFinite(x[key]) && x[time] != null).sort((a, b) => a[time] - b[time]);
  const one = (arr) => {
    const m = moments(arr.map((x) => x[key])); const ms = monthSums(arr, key, time).map((x) => x[1]); const mm = moments(ms);
    let cum = 0, peak = 0, dd = 0; for (const x of arr) { cum += x[key]; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak); }
    return { n: m.n, wins: arr.filter((x) => x[key] > 0).length, total: arr.reduce((a, x) => a + x[key], 0), meanR: m.mean, sd: m.sd,
      tTrade: m.t, pTrade: m.p, months: mm.n, tMonth: mm.t, pMonth: mm.p, maxDD: dd };
  };
  const isFrom = Date.UTC(opts.isFrom ?? 2020, 0, 1) / 1000, isTo = Date.UTC(opts.isTo ?? 2024, 0, 1) / 1000;
  const byYear = {}; for (const x of xs) { const y = new Date(x[time] * 1000).getUTCFullYear(); (byYear[y] ||= []).push(x); }
  for (const y of Object.keys(byYear)) { const s = one(byYear[y]); byYear[y] = { n: s.n, total: s.total, meanR: s.meanR }; }
  return { key, ...one(xs), byYear, IS: one(xs.filter((x) => x[time] >= isFrom && x[time] < isTo)), OOS: one(xs.filter((x) => x[time] >= isTo)),
    before: one(xs.filter((x) => x[time] < isFrom)) };
}

export function holm(pvals) {
  const idx = pvals.map((p, i) => [p ?? 1, i]).sort((a, b) => a[0] - b[0]); const m = idx.length; const out = new Array(m); let run = 0;
  idx.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (m - r) * p)); out[i] = run; });
  return out;
}

export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// Resample whole calendar months (empty months included as 0) with replacement; the mean monthly R of each draw.
export function bootstrapMonths(trades, { key, time, draws = 5000, seed = 7, q = [0.05, 0.5, 0.95] } = {}) {
  key = key || (trades.some((x) => x.Rnet != null) ? 'Rnet' : 'R'); time = time || (trades.some((x) => x.exitT != null) ? 'exitT' : 't');
  const ms = monthSums(trades.filter((x) => Number.isFinite(x[key])), key, time).map((x) => x[1]);
  if (!ms.length) return null; const r = rng(seed); const means = [];
  for (let d = 0; d < draws; d++) { let s = 0; for (let i = 0; i < ms.length; i++) s += ms[Math.floor(r() * ms.length)]; means.push(s / ms.length); }
  means.sort((a, b) => a - b);
  return { months: ms.length, mean: ms.reduce((a, b) => a + b, 0) / ms.length, q: Object.fromEntries(q.map((p) => [p, means[Math.min(draws - 1, Math.floor(p * draws))]])),
    pBelow0: means.filter((x) => x <= 0).length / draws };
}
