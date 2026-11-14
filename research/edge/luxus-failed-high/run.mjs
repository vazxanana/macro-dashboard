// Edge research · luxus-failed-high (study 143): Luxus's lesson "10 nov Sell Gold" written as one mechanical rule. H4 and H1
// bullish (the last BO on each was a BO buy), M5 fails to make a new high (a lower swing high), then an M5 close below the previous
// swing low (the BO sell); sell limit at the return to the zone of the break, stop past it, target the next H4 swing low (Test 1)
// or 2R (Test 2); Test 3 is the mirror. Rule, assumptions and the pass bar: PREREGISTRATION.md (committed before this file).
// Data: OANDA spot gold M5 through the council's keyless proxy (research/edge/mosha-sweep/run.mjs fetch <dir>), cache outside git.
// Paper research for the owner only: nothing here trades, changes a live rule, or writes to the Mosha desk.
//   node --use-env-proxy research/edge/mosha-sweep/run.mjs fetch <dir>   -> <dir>/xau-5m.json.gz
//   CANDLES=<dir> node research/edge/luxus-failed-high/run.mjs run       -> result.json
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { swings } from '../mosha-level/run.mjs';
import { nights, FIN } from '../../../council/fills.mjs';

export const K = { W4: 3, W1: 1, W5: 1, PAD: 0.30, MIN_R0: 1.0, VALID: 24 * 3600, HOLD: 72 * 3600, LEVEL_AGE: 30 * 86400, MIN_RR_BARRIER: 1, FIXED_RR: 2,
  COST: 0.60, M5: 300, H1: 3600, H4: 14400, CTRL_UTC: 13 * 3600, ATR: 14, SEEDS: 40 };
const D = (y, m) => Date.UTC(y, m - 1, 1) / 1000;
export const WIN = { rep: [D(2007, 1), D(2020, 1)], is: [D(2020, 1), D(2024, 1)], oos: [D(2024, 1), D(2026, 11)] };
export const TESTS = { T1: { side: -1, target: 'barrier', label: 'Test 1 (primary): sell, target the next H4 swing low (barrier)' },
  T2: { side: -1, target: 'fixed', label: 'Test 2: sell, fixed 2R target' }, T3: { side: 1, target: 'barrier', label: 'Test 3: the mirror (buy), target the next H4 swing high (barrier)' } };

export const agg = (B, sec) => { const out = []; for (const b of B) { const k = Math.floor(b.time / sec) * sec, c = out.at(-1); if (!c || c.time !== k) out.push({ time: k, open: b.open, high: b.high, low: b.low, close: b.close }); else { if (b.high > c.high) c.high = b.high; if (b.low < c.low) c.low = b.low; c.close = b.close; } } return out; };
export const mirror = (B) => B.map((b) => ({ time: b.time, open: -b.open, high: -b.low, low: -b.high, close: -b.close }));

// BO events on one timeframe (his definitions, closed candles only): a close above the most recent existing, unbroken swing
// high = BO buy (+1); a close below the most recent existing, unbroken swing low = BO sell (-1). `at` = the candle's close time.
export function boEvents(B, w, sec) {
  const { hi, lo } = swings(B, w), ev = []; let h = -1, hb = true, l = -1, lb = true;
  for (let i = 0; i < B.length; i++) {
    const j = i - 1 - w; if (j >= 0) { if (hi[j]) { h = j; hb = false; } if (lo[j]) { l = j; lb = false; } }   // swing j exists once candle j+w has closed
    const up = !hb && B[i].close > B[h].high, dn = !lb && B[i].close < B[l].low;
    if (up) hb = true; if (dn) lb = true;
    if (up || dn) ev.push({ at: B[i].time + sec, side: up && dn ? 0 : up ? 1 : -1 });
  }
  return ev;
}
// state (side of the last BO closed at or before t) for increasing t
export function stateWalker(ev) { let k = -1; return (t) => { while (k + 1 < ev.length && ev[k + 1].at <= t) k++; return k < 0 ? 0 : ev[k].side; }; }

// H4 swing lows (the barriers for a sell), each with the time it exists and the time an H4 close goes below it
export function h4Lows(H4) {
  const { lo } = swings(H4, K.W4), L = [];
  for (let j = 0; j + K.W4 < H4.length; j++) if (lo[j]) L.push({ p: H4[j].low, born: H4[j + K.W4].time + K.H4, dead: Infinity, j });
  for (const x of L) for (let i = x.j + K.W4 + 1; i < H4.length && H4[i].time + K.H4 - x.born <= K.LEVEL_AGE + K.H4; i++) if (H4[i].close < x.p) { x.dead = H4[i].time + K.H4; break; }
  return L;
}
export function barrierOf(L, entry, r0, now) {   // the nearest live H4 swing low at least MIN_RR_BARRIER x r0 below the entry
  let best = null;
  for (let q = L.length - 1; q >= 0; q--) { const x = L[q]; if (x.born > now) continue; if (now - x.born > K.LEVEL_AGE) break; if (x.dead <= now) continue;
    if (x.p <= entry - K.MIN_RR_BARRIER * r0 && (best == null || x.p > best)) best = x.p; }
  return best;
}

// the detector, written for SELLS on candles M5 (oldest first). Buys: run it on mirror(M5) and negate the prices.
// Returns signals { i, placed, entry, stop, r0, barrier, atr } before the one-at-a-time rule, and the funnel.
export function detectSells(M5) {
  const n = M5.length, H1 = agg(M5, K.H1), H4 = agg(M5, K.H4), s4 = stateWalker(boEvents(H4, K.W4, K.H4)), s1 = stateWalker(boEvents(H1, K.W1, K.H1));
  const lows4 = h4Lows(H4), { hi, lo } = swings(M5, K.W5), funnel = { breaks: 0, trendOk: 0, failedHigh: 0, signals: 0, wrongSide: 0, small: 0 }, out = [];
  let A = -1, P = -1, runMax = -Infinity, L = -1, Lbroken = true, tr = 0; const atrQ = [];
  for (let i = 0; i < n; i++) {
    const b = M5[i], j = i - 1 - K.W5;
    if (j >= 0 && hi[j]) { P = A; A = j; runMax = -Infinity; if (P >= 0) for (let k = P + 1; k < i; k++) if (M5[k].high > runMax) runMax = M5[k].high; }
    if (j >= 0 && lo[j]) { L = j; Lbroken = false; }
    if (P >= 0 && b.high > runMax) runMax = b.high;
    const trv = i > 0 ? Math.max(b.high, M5[i - 1].close) - Math.min(b.low, M5[i - 1].close) : b.high - b.low; atrQ.push(trv); tr += trv; if (atrQ.length > K.ATR) tr -= atrQ.shift();
    if (L < 0 || Lbroken || !(b.close < M5[L].low)) continue;
    Lbroken = true; funnel.breaks++;
    const now = b.time + K.M5;
    if (!(P >= 0 && L > P && M5[A].high < M5[P].high && runMax <= M5[P].high)) continue;
    funnel.failedHigh++;
    if (s4(now) !== 1 || s1(now) !== 1) continue;
    funnel.trendOk++;
    const entry = M5[L].low, stop = +(b.high + K.PAD).toFixed(3), r0 = stop - entry;
    if (!(stop > entry)) { funnel.wrongSide++; continue; }
    if (r0 < K.MIN_R0) { funnel.small++; continue; }
    funnel.signals++;
    out.push({ i, placed: now, entry, stop, r0, barrier: barrierOf(lows4, entry, r0, now), atr: atrQ.length >= K.ATR ? tr / K.ATR : null });
  }
  return { signals: out, funnel, s4, s1, H4: H4.length, H1: H1.length };
}

// one limit order from its placement, side s (-1 sell, +1 buy), on real candles F: stop first in a candle that holds both
const lower = (F, t) => { let a = 0, b = F.length; while (a < b) { const m = (a + b) >> 1; if (F[m].time < t) a = m + 1; else b = m; } return a; };
export function simulate(F, o) {
  const s = o.side, n = F.length; let k = lower(F, o.placed), filled = null;
  const done = (t, px, exit) => ({ status: 'closed', filled, closed: t, exitPx: +px.toFixed(3), exit, R: (s * (px - o.entry)) / o.r0 });
  for (; k < n; k++) {
    const b = F[k];
    if (filled == null) {
      if (!o.market) {
        if (b.time >= o.placed + K.VALID) return { status: 'expired', closed: b.time };
        const touch = s < 0 ? b.high >= o.entry : b.low <= o.entry, tgt = s < 0 ? b.low <= o.target : b.high >= o.target;
        if (!touch) { if (tgt) return { status: 'missed', closed: b.time }; continue; }
        filled = b.time;
        if (s < 0 ? b.high >= o.stop : b.low <= o.stop) return done(b.time, s < 0 ? Math.max(o.stop, b.open) : Math.min(o.stop, b.open), 'stop');
        if (tgt) return { status: 'missed', closed: b.time, note: 'fill and target in one candle' };
        continue;
      }
      filled = o.placed;
    }
    if (s < 0 ? b.open >= o.stop : b.open <= o.stop) return done(b.time, b.open, 'stop (gap)');
    if (s < 0 ? b.high >= o.stop : b.low <= o.stop) return done(b.time, o.stop, 'stop');
    if (s < 0 ? b.low <= o.target : b.high >= o.target) return done(b.time, o.target, 'target');
    if (b.time + K.M5 >= filled + K.HOLD) return done(b.time, b.close, 'time');
  }
  return filled == null ? { status: 'expired', atEnd: true } : { ...done(F[n - 1].time, F[n - 1].close, 'end (marked)'), marked: true };
}
// costs in R: the round trip, plus financing on buys (council/fills.mjs nights x FIN.xau.long x entry / r0); c = cost multiple
export function costR(o, c = 1) {
  const fin = o.side > 0 ? nights(o.filled, o.closed) * FIN.xau.long * o.entry / o.r0 : 0;
  return c * (K.COST / o.r0 + fin);
}
const withCost = (o) => ({ ...o, net: o.R - costR(o, 1), net2: o.R - costR(o, 2), fin: o.side > 0 ? nights(o.filled, o.closed) : 0 });

// the orders of one test (side, target) from the signals, one order or position at a time
export function ordersOf(M5, test) {
  const T = TESTS[test], s = T.side, src = s < 0 ? M5 : mirror(M5), { signals, funnel } = detectSells(src), orders = []; let busyUntil = -Infinity, busy = 0, noBarrier = 0;
  for (const g of signals) {
    const rr = T.target === 'fixed' ? K.FIXED_RR : g.barrier == null ? null : (g.entry - g.barrier) / g.r0;
    if (rr == null) { noBarrier++; continue; }
    if (g.placed < busyUntil) { busy++; continue; }
    const sg = s < 0 ? 1 : -1;   // back to real prices
    const o = { side: s, placed: g.placed, entry: +(sg * g.entry).toFixed(3), stop: +(sg * g.stop).toFixed(3), r0: +g.r0.toFixed(3), rr: +rr.toFixed(3), atr: g.atr };
    o.target = +(o.entry + s * rr * o.r0).toFixed(3);
    const r = simulate(M5, o); Object.assign(o, r);
    busyUntil = r.closed ?? o.placed + K.VALID;
    orders.push(r.status === 'closed' ? withCost(o) : o);
  }
  return { orders, funnel: { ...funnel, noBarrier, busy } };
}

// ─── statistics ───
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const monthOf = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
// t on calendar-month sums (month of the close), empty months between the window's first month and its last (or the last close) = 0
export function monthT(tr, key, win) {
  if (!tr.length) return { months: 0, t: null };
  const m0 = monthOf(win[0]), m1 = Math.max(monthOf(win[1] - 1), ...tr.map((o) => monthOf(o.closed))), S = new Array(m1 - m0 + 1).fill(0);
  for (const o of tr) S[monthOf(o.closed) - m0] += o[key];
  const m = mean(S), sd = Math.sqrt(S.reduce((a, x) => a + (x - m) ** 2, 0) / (S.length - 1));
  return { months: S.length, t: sd > 0 ? +(m / (sd / Math.sqrt(S.length))).toFixed(2) : null };
}
export const pOf = (t) => { if (t == null) return 1; const x = t / Math.SQRT2, a = 1 / (1 + 0.3275911 * Math.abs(x)), e = 1 - (((((1.061405429 * a - 1.453152027) * a) + 1.421413741) * a - 0.284496736) * a + 0.254829592) * a * Math.exp(-x * x); return +(0.5 * (1 - Math.sign(x) * e)).toFixed(4); };
const r3 = (v) => +v.toFixed(3);
export function windowStat(orders, win) {
  const tr = orders.filter((o) => o.status === 'closed' && !o.marked && o.placed >= win[0] && o.placed < win[1]).sort((a, b) => a.closed - b.closed);
  const pl = orders.filter((o) => o.placed >= win[0] && o.placed < win[1]);
  if (!tr.length) return { n: 0, placed: pl.length };
  const w = tr.filter((o) => o.net > 0), gw = w.reduce((a, o) => a + o.net, 0), gl = -tr.filter((o) => o.net <= 0).reduce((a, o) => a + o.net, 0);
  let cum = 0, peak = 0, dd = 0; for (const o of tr) { cum += o.net; peak = Math.max(peak, cum); dd = Math.max(dd, peak - cum); }
  const exits = {}; for (const o of tr) { const k = o.exit.replace(' (gap)', ''); exits[k] = (exits[k] || 0) + 1; }
  return { n: tr.length, placed: pl.length, missed: pl.filter((o) => o.status === 'missed').length, expired: pl.filter((o) => o.status === 'expired').length,
    win: r3(w.length / tr.length), gross: r3(mean(tr.map((o) => o.R))), net: r3(mean(tr.map((o) => o.net))), net2: r3(mean(tr.map((o) => o.net2))), totalNet: +cum.toFixed(2),
    tGross: monthT(tr, 'R', win).t, tNet: monthT(tr, 'net', win).t, tNet2: monthT(tr, 'net2', win).t, months: monthT(tr, 'net', win).months,
    pf: gl > 0 ? +(gw / gl).toFixed(2) : null, maxDD: +dd.toFixed(2), medianR0: +[...tr.map((o) => o.r0)].sort((a, b) => a - b)[tr.length >> 1].toFixed(2),
    medianRR: +[...tr.map((o) => o.rr)].sort((a, b) => a - b)[tr.length >> 1].toFixed(2), exits };
}

// seeded random (mulberry32)
export const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// placebo: per window, as many market entries at random M5 closes as real trades, same side, each with one real trade's r0 and R target
export function placebo(M5, orders, test, seeds = K.SEEDS) {
  const s = TESTS[test].side, res = { oos: [], is: [] };
  for (let sd = 1; sd <= seeds; sd++) {
    const R = rng(1000 * sd + s + 7);
    for (const w of ['is', 'oos']) {
      const win = WIN[w], real = orders.filter((o) => o.status === 'closed' && !o.marked && o.placed >= win[0] && o.placed < win[1]);
      const a = lower(M5, win[0]), b = lower(M5, win[1]) - 1, nets = [];
      for (const r of real) {
        const i = a + Math.floor(R() * (b - a)), entry = M5[i].close, o = { side: s, market: true, placed: M5[i].time + K.M5, entry, r0: r.r0, stop: entry - s * r.r0, target: entry + s * r.rr * r.r0, rr: r.rr };
        const x = simulate(M5, o); if (x.status === 'closed' && !x.marked) nets.push(withCost({ ...o, ...x }).net);
      }
      res[w].push(r3(mean(nets)));
    }
  }
  return res;
}
// control: every weekday at the 13:00 UTC M5 close with the test's trend condition, same side, stop = median(r0/ATR) x ATR, target = median R
export function control(M5, orders, test) {
  const T = TESTS[test], s = T.side, src = s < 0 ? M5 : mirror(M5), H1 = agg(src, K.H1), H4 = agg(src, K.H4), s4 = stateWalker(boEvents(H4, K.W4, K.H4)), s1 = stateWalker(boEvents(H1, K.W1, K.H1));
  const tr = orders.filter((o) => o.status === 'closed' && o.atr > 0 && o.placed < WIN.oos[1]);
  if (!tr.length) return null;
  const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1], kAtr = med(tr.map((o) => o.r0 / o.atr)), rr = med(tr.map((o) => o.rr)), out = [];
  const q = []; let sum = 0;
  for (let i = 0; i < M5.length; i++) {
    const b = M5[i], trv = i > 0 ? Math.max(b.high, M5[i - 1].close) - Math.min(b.low, M5[i - 1].close) : b.high - b.low; q.push(trv); sum += trv; if (q.length > K.ATR) sum -= q.shift();
    const now = b.time + K.M5; if (now % 86400 !== K.CTRL_UTC) { s4(now); s1(now); continue; }
    const wd = new Date(now * 1000).getUTCDay(), st4 = s4(now), st1 = s1(now);
    if (wd === 0 || wd === 6 || q.length < K.ATR || st4 !== 1 || st1 !== 1) continue;
    const r0 = Math.max(K.MIN_R0, kAtr * sum / K.ATR), o = { side: s, market: true, placed: now, entry: b.close, r0, stop: b.close - s * r0, target: b.close + s * rr * r0, rr };
    const x = simulate(M5, o); if (x.status === 'closed') out.push(withCost({ ...o, ...x }));
  }
  return { kAtr: r3(kAtr), rr: r3(rr), rep: windowStat(out, WIN.rep), is: windowStat(out, WIN.is), oos: windowStat(out, WIN.oos) };
}

export function holm(ps) {   // ps: { name: p } -> adjusted
  const e = Object.entries(ps).sort((a, b) => a[1] - b[1]), out = {}; let top = 0;
  e.forEach(([k, p], i) => { top = Math.max(top, Math.min(1, p * (e.length - i))); out[k] = +top.toFixed(4); });
  return out;
}
export function verdictOf(S, pHolm) {
  const tests = { 'out-of-sample n >= 30': S.oos.n >= 30, 'out-of-sample net month-sum t >= 2': S.oos.tNet != null && S.oos.tNet >= 2, 'Holm-adjusted p < 0.05': pHolm < 0.05,
    'in-sample net mean > 0 (same sign)': S.is.n > 0 && S.is.net > 0, 'out-of-sample mean > 0 at 2x costs': S.oos.n > 0 && S.oos.net2 > 0 };
  return { verdict: Object.values(tests).every(Boolean) ? 'PASS' : S.oos.n < 30 ? 'INCONCLUSIVE' : 'FAIL', tests };
}

// ─── run ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODE = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ? process.argv[2] : null;
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');
if (MODE === 'run') {
  const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(process.env.CANDLES, 'xau-5m.json.gz'))));
  const M5 = rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
  console.error(`M5 ${M5.length} (${iso(M5[0].time)} → ${iso(M5.at(-1).time)})`);
  const out = { topic: 'luxus-failed-high', built: '2026-11-14', at: new Date().toISOString(),
    system: 'Luxus failed high: H4 and H1 bullish (last BO a buy), M5 lower swing high, then M5 close below the previous swing low; sell limit at the zone of the break; spot gold OANDA M5',
    windows: { rep: '2007-01 to 2019-12', is: '2020-01 to 2023-12', oos: '2024-01 to 2026-10' }, params: { ...K, FIN_LONG: FIN.xau.long }, candles: { m5: M5.length, from: iso(M5[0].time), to: iso(M5.at(-1).time) }, tests: {} };
  const keep = {};
  for (const k of Object.keys(TESTS)) {
    const { orders, funnel } = ordersOf(M5, k); keep[k] = orders;
    out.tests[k] = { rule: TESTS[k].label, funnel, rep: windowStat(orders, WIN.rep), is: windowStat(orders, WIN.is), oos: windowStat(orders, WIN.oos) };
    out.tests[k].p = pOf(out.tests[k].oos.tNet);
    console.error(k, JSON.stringify(funnel), 'IS', JSON.stringify(out.tests[k].is), 'OOS', JSON.stringify(out.tests[k].oos));
  }
  const ph = holm(Object.fromEntries(Object.keys(TESTS).map((k) => [k, out.tests[k].p])));
  for (const k of Object.keys(TESTS)) {
    const T = out.tests[k]; T.pHolm = ph[k]; T.primary = verdictOf(T, ph[k]);
    const pl = placebo(M5, keep[k], k); T.placebo = { seeds: K.SEEDS, oosMeans: pl.oos, isMeans: pl.is, oosShareAtOrAbove: T.oos.n ? r3(pl.oos.filter((m) => m >= T.oos.net).length / pl.oos.length) : null, oosMedian: r3([...pl.oos].sort((a, b) => a - b)[pl.oos.length >> 1]) };
    T.control = control(M5, keep[k], k);
    console.error(k, 'placebo', JSON.stringify(T.placebo.oosShareAtOrAbove), 'control', JSON.stringify(T.control && { is: T.control.is.net, oos: T.control.oos.net }));
  }
  const P = out.tests.T1, sg = (x) => (x == null ? 'n/a' : `${x >= 0 ? '+' : ''}${x}`);
  out.primary = P.primary;
  out.verdict = `${P.primary.verdict}: Test 1 (primary) ${sg(P.oos.net)}R a trade net out of sample (n ${P.oos.n}, month-sum t ${P.oos.tNet}, Holm p ${P.pHolm}); in sample ${sg(P.is.net)}R (n ${P.is.n}, t ${P.is.tNet})`;
  out.candidates = Object.keys(TESTS).map((k) => ({ rule: TESTS[k].label, verdict: out.tests[k].primary.verdict, is: out.tests[k].is, oos: out.tests[k].oos, rep: out.tests[k].rep }));
  out.trades = keep.T1.filter((o) => o.status === 'closed' && !o.marked && o.placed >= WIN.is[0] && o.placed < WIN.oos[1]).sort((a, b) => a.closed - b.closed).map((o) => ({ d: new Date(o.closed * 1000).toISOString().slice(0, 10), side: 'sell', R: +o.net.toFixed(4) }));
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  if (process.env.OUT_DIR) { fs.mkdirSync(process.env.OUT_DIR, { recursive: true }); fs.writeFileSync(path.join(process.env.OUT_DIR, 'orders.json'), JSON.stringify(keep)); }
  console.error(out.verdict);
}
