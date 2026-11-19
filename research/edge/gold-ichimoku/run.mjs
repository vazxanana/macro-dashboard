// The standard Ichimoku Kinko Hyo signals (9 / 26 / 52, cloud shifted 26 forward) on gold (PREREGISTRATION.md, pushed first).
//   node research/edge/gold-ichimoku/run.mjs full <xau-h1.json>
// Daily candles: council-data research/daily/xau.json (git show origin/council-data, no network), weekends folded.
// H4 candles: built here from the OANDA mid H1 cache of the earlier gold studies (kept out of git), anchored to 17:00 New York.
// A stand-alone rule: it reads nothing of the live gold book and is never a gate, exit, entry or size of it.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { foldWeekend, nights, spotClosed, FIN } from '../../../council/fills.mjs';

export const P = { tenkan: 9, kijun: 26, spanB: 52, shift: 26, atr: 14, stopAtr: 2, cost: 0.6 };
export const WIN = { is: ['2008-01-01', '2016-12-31'], oos: ['2017-01-01', '2026-10-31'], h1: ['2017-01-01', '2021-12-31'], h2: ['2022-01-01', '2026-10-31'] };
const DAY = 86400, H4 = 14400;
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const r2 = (x, d = 3) => (Number.isFinite(x) ? +x.toFixed(d) : null);

// ---------- indicators (every value at candle i uses candles <= i only) ----------
function mid(bars, i, n) {
  if (i < n - 1) return null;
  let hi = -Infinity, lo = Infinity;
  for (let k = i - n + 1; k <= i; k++) { if (bars[k].high > hi) hi = bars[k].high; if (bars[k].low < lo) lo = bars[k].low; }
  return (hi + lo) / 2;
}
export function ichimoku(bars, p = P) {
  const T = bars.map((_, i) => mid(bars, i, p.tenkan)), K = bars.map((_, i) => mid(bars, i, p.kijun)), B = bars.map((_, i) => mid(bars, i, p.spanB));
  const A = bars.map((_, i) => (T[i] != null && K[i] != null ? (T[i] + K[i]) / 2 : null));
  // the cloud at candle i = Span A / Span B as computed on candle i - shift
  const top = bars.map((_, i) => { const j = i - p.shift; return j >= 0 && A[j] != null && B[j] != null ? Math.max(A[j], B[j]) : null; });
  const bot = bars.map((_, i) => { const j = i - p.shift; return j >= 0 && A[j] != null && B[j] != null ? Math.min(A[j], B[j]) : null; });
  return { tenkan: T, kijun: K, spanA: A, spanB: B, top, bot };
}
// Wilder ATR: the first value is the mean of the first n true ranges, then (prev * (n - 1) + tr) / n
export function atrW(bars, n = P.atr) {
  const out = bars.map(() => null); let a = null, s = 0;
  for (let i = 1; i < bars.length; i++) {
    const b = bars[i], pc = bars[i - 1].close, tr = Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc));
    if (i <= n) { s += tr; if (i === n) a = s / n; } else a = (a * (n - 1) + tr) / n;
    out[i] = a;
  }
  return out;
}

// ---------- signals ----------
// T1 / T3 cloud breakout: +1 buy, -1 sell, 0 none, at the close of candle i
export function cloudSignal(bars, ich, i) {
  const { tenkan: T, kijun: K, top, bot } = ich;
  if (i < 1 || top[i] == null || top[i - 1] == null || T[i] == null || K[i] == null) return 0;
  const c = bars[i].close, pc = bars[i - 1].close;
  if (c > top[i] && pc <= top[i - 1] && T[i] > K[i]) return 1;
  if (c < bot[i] && pc >= bot[i - 1] && T[i] < K[i]) return -1;
  return 0;
}
export function cloudExit(bars, ich, i, side) {
  if (ich.top[i] == null) return false;
  return side > 0 ? bars[i].close <= ich.top[i] : bars[i].close >= ich.bot[i];
}
// T2: Tenkan / Kijun cross; the cross direction (+1 / -1 / 0) and the signal (the cross with price on the same side of the cloud)
export function tkCross(ich, i) {
  const { tenkan: T, kijun: K } = ich;
  if (i < 1 || T[i] == null || K[i] == null || T[i - 1] == null || K[i - 1] == null) return 0;
  if (T[i] > K[i] && T[i - 1] <= K[i - 1]) return 1;
  if (T[i] < K[i] && T[i - 1] >= K[i - 1]) return -1;
  return 0;
}
export function tkSignal(bars, ich, i) {
  const x = tkCross(ich, i); if (!x || ich.top[i] == null) return 0;
  if (x > 0 && bars[i].close > ich.top[i]) return 1;
  if (x < 0 && bars[i].close < ich.bot[i]) return -1;
  return 0;
}
export const RULES = {
  cloud: { signal: cloudSignal, exit: cloudExit },
  tk: { signal: tkSignal, exit: (bars, ich, i, side) => tkCross(ich, i) === -side },
};

// ---------- costs ----------
export function costOf(side, entry, exit, entryT, exitT, r0, k = 1) {
  const move = side * (exit - entry), fin = side > 0 ? nights(entryT, exitT) * FIN.xau.long * entry * k : 0, cost = P.cost * k;
  return { gross: move / r0, net: (move - cost - fin) / r0, pct: (move - cost - fin) / entry * 100, pctGross: move / entry * 100, finR: fin / r0 };
}

// ---------- the trade loop: one position at a time, next-open fills, the stop on every candle from the entry candle ----------
export function simulate(bars, rule, len, p = P) {
  const ich = ichimoku(bars, p), atr = atrW(bars, p.atr), R = RULES[rule], trades = [];
  let pos = null, wantExit = false, want = null;
  const close = (k, px, exitT, why, hold) => {
    const c = costOf(pos.side, pos.entry, px, pos.entryT, exitT, pos.r0);
    const c2 = costOf(pos.side, pos.entry, px, pos.entryT, exitT, pos.r0, 2);
    trades.push({ side: pos.side, sigT: pos.sigT, entryT: pos.entryT, exitT, entry: pos.entry, exit: px, stop: pos.stop, r0: pos.r0, why, hold,
      gross: c.gross, net: c.net, net2: c2.net, pct: c.pct, pctGross: c.pctGross, finR: c.finR });
    pos = null;
  };
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    if (pos && wantExit) close(i, b.open, b.time, pos.exitWhy, i - pos.i0);
    wantExit = false;
    if (!pos && want) {
      const r0 = p.stopAtr * want.atr;
      pos = { side: want.side, entry: b.open, entryT: b.time, sigT: want.t, i0: i, r0, stop: b.open - want.side * r0 };
    }
    want = null;
    if (pos) {
      const s = pos.side, st = pos.stop;
      if (s > 0 ? b.open <= st : b.open >= st) close(i, b.open, b.time, 'stop', i - pos.i0);
      else if (s > 0 ? b.low <= st : b.high >= st) close(i, st, b.time + len, 'stop', i - pos.i0 + 1);
    }
    if (i === bars.length - 1) break; // nothing can be filled after the last candle
    if (pos && R.exit(bars, ich, i, pos.side)) { wantExit = true; pos.exitWhy = 'exit'; }
    const sg = R.signal(bars, ich, i);
    if (sg && atr[i] != null && (!pos || wantExit) && !(pos && pos.side === sg)) {
      want = { side: sg, atr: atr[i], t: b.time };
      if (pos) pos.exitWhy = 'reverse';
    }
  }
  return { trades, ich, atr, open: pos };
}

// ---------- H4 from H1, anchored to 17:00 New York ----------
const nyFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
export function nyLocal(t) {
  const q = Object.fromEntries(nyFmt.formatToParts(new Date(t * 1000)).map((x) => [x.type, x.value]));
  return Date.UTC(+q.year, +q.month - 1, +q.day, +q.hour, +q.minute) / 1000;
}
export const h4Key = (t) => Math.floor((nyLocal(t) - 17 * 3600) / H4);
export function h4FromH1(h1) {
  const out = []; let cur = null, key = null;
  for (const b of h1) {
    if (spotClosed(b.time)) continue;
    const k = h4Key(b.time);
    if (k !== key) { if (cur) out.push(cur); cur = { time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, hours: 1 }; key = k; }
    else { cur.high = Math.max(cur.high, b.high); cur.low = Math.min(cur.low, b.low); cur.close = b.close; cur.hours++; }
  }
  if (cur) out.push(cur);
  return out;
}

// ---------- statistics ----------
function betacf(a, b, x) {
  let c = 1, d = 1 - (a + b) * x / (a + 1); d = 1 / (Math.abs(d) < 1e-30 ? 1e-30 : d); let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m; let aa = m * (b - m) * x / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d; d = 1 / (Math.abs(d) < 1e-30 ? 1e-30 : d); c = 1 + aa / c; c = Math.abs(c) < 1e-30 ? 1e-30 : c; h *= d * c;
    aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d; d = 1 / (Math.abs(d) < 1e-30 ? 1e-30 : d); c = 1 + aa / c; c = Math.abs(c) < 1e-30 ? 1e-30 : c; const del = d * c; h *= del;
    if (Math.abs(del - 1) < 1e-12) break;
  }
  return h;
}
function lgamma(x) { const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (const c of g) s += c / ++y; return -t + Math.log(2.5066282746310005 * s / x); }
function ibeta(a, b, x) { if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
// one-sided P(T >= t) for Student t with df degrees of freedom
export function pUpper(t, df) { if (!Number.isFinite(t) || df < 1) return 1; const x = df / (df + t * t), tail = 0.5 * ibeta(df / 2, 0.5, x); return t > 0 ? tail : 1 - tail; }
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = Array(ps.length); let run = 0;
  idx.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, p * (ps.length - r))); out[i] = run; });
  return out;
}
const monthOf = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
// t of calendar-month sums by exit month; every month from the window's first to its last (or the last exit) counted
export function monthT(trades, from, to, key = 'net') {
  const m0 = monthOf(Date.parse(from) / 1000); let m1 = monthOf(Date.parse(to) / 1000);
  for (const x of trades) m1 = Math.max(m1, monthOf(x.exitT));
  const s = Array(m1 - m0 + 1).fill(0); for (const x of trades) s[monthOf(x.exitT) - m0] += x[key];
  const n = s.length, mean = s.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  const t = sd > 0 ? mean / (sd / Math.sqrt(n)) : 0;
  return { months: n, t: r2(t, 2), p: r2(pUpper(t, n - 1), 4) };
}
export function dd(trades, key = 'net') { let eq = 0, pk = 0, m = 0; for (const x of [...trades].sort((a, b) => a.exitT - b.exitT)) { eq += x[key]; pk = Math.max(pk, eq); m = Math.min(m, eq - pk); } return r2(m, 2); }
export const inWin = (trades, [f, t]) => trades.filter((x) => ymd(x.entryT) >= f && ymd(x.entryT) <= t);
export function stats(T, win) {
  const n = T.length, sum = (k) => T.reduce((a, x) => a + x[k], 0);
  const mt = monthT(T, win[0], win[1]);
  return { n, wins: T.filter((x) => x.net > 0).length, grossR: r2(sum('gross'), 2), netR: r2(sum('net'), 2), net2R: r2(sum('net2'), 2),
    grossPer: r2(n ? sum('gross') / n : 0), netPer: r2(n ? sum('net') / n : 0), finR: r2(sum('finR'), 2), pct: r2(sum('pct'), 1), pctGross: r2(sum('pctGross'), 1),
    monthT: mt.t, months: mt.months, p: mt.p, tGross: monthT(T, win[0], win[1], 'gross').t, dd: dd(T),
    longs: T.filter((x) => x.side > 0).length, longR: r2(T.filter((x) => x.side > 0).reduce((a, x) => a + x.net, 0), 2),
    shorts: T.filter((x) => x.side < 0).length, shortR: r2(T.filter((x) => x.side < 0).reduce((a, x) => a + x.net, 0), 2),
    exits: Object.fromEntries(['stop', 'exit', 'reverse'].map((w) => [w, T.filter((x) => x.why === w).length])),
    medianHold: n ? [...T.map((x) => x.hold)].sort((a, b) => a - b)[Math.floor(n / 2)] : null };
}

// ---------- placebo ----------
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shuffle(a, r) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
// n random signal candles in the window, the real sides and holding times shuffled, the same stop; returns net R total
export function placebo(bars, atr, real, win, len, seed) {
  const r = rng(seed), sides = shuffle(real.map((x) => x.side), r), holds = shuffle(real.map((x) => Math.max(1, x.hold)), r);
  const cand = []; for (let i = 0; i < bars.length - 1; i++) { const d = ymd(bars[i].time); if (d >= win[0] && d <= win[1] && atr[i] != null) cand.push(i); }
  let tot = 0, tot2 = 0;
  for (let k = 0; k < real.length; k++) {
    let i, h = holds[k], tries = 0;
    do { i = cand[Math.floor(r() * cand.length)]; tries++; } while (i + 1 + h >= bars.length && tries < 100);
    const side = sides[k], e = bars[i + 1], entry = e.open, r0 = P.stopAtr * atr[i], stop = entry - side * r0;
    let px = bars[i + 1 + h].open, exitT = bars[i + 1 + h].time;
    for (let j = i + 1; j <= i + h; j++) {
      const b = bars[j];
      if (j > i + 1 && (side > 0 ? b.open <= stop : b.open >= stop)) { px = b.open; exitT = b.time; break; }
      if (side > 0 ? b.low <= stop : b.high >= stop) { px = stop; exitT = b.time + len; break; }
    }
    const c = costOf(side, entry, px, e.time, exitT, r0); tot += c.net; tot2 += c.gross;
  }
  return { net: r2(tot, 2), gross: r2(tot2, 2) };
}

// ---------- buy-and-hold over a window: % of the first close, before and after the same financing ----------
export function hold(bars, [f, t]) {
  const w = bars.filter((b) => ymd(b.time) >= f && ymd(b.time) <= t); if (w.length < 2) return null;
  let fin = 0, pk = w[0].close, m = 0;
  for (let i = 1; i < w.length; i++) { fin += nights(w[i - 1].time, w[i].time) * FIN.xau.long * w[i - 1].close; pk = Math.max(pk, w[i].close); m = Math.min(m, (w[i].close - pk) / pk); }
  const mv = w.at(-1).close - w[0].close;
  return { from: ymd(w[0].time), to: ymd(w.at(-1).time), pct: r2(mv / w[0].close * 100, 1), pctFin: r2((mv - fin) / w[0].close * 100, 1), ddPct: r2(m * 100, 1) };
}

// ---------- the run ----------
export function readDaily() {
  const j = JSON.parse(execFileSync('git', ['show', 'origin/council-data:research/daily/xau.json'], { maxBuffer: 64 << 20 }).toString());
  return foldWeekend(j.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })));
}
export function runTest(bars, rule, len, win = WIN) {
  const sim = simulate(bars, rule, len);
  const T = sim.trades, is = inWin(T, win.is), oos = inWin(T, win.oos);
  const pl = Array.from({ length: 40 }, (_, s) => placebo(bars, sim.atr, oos, win.oos, len, 1000 + s));
  const o = stats(oos, win.oos);
  const years = {};
  for (let y = 2008; y <= 2026; y++) { const tt = inWin(T, [`${y}-01-01`, `${y}-12-31`]); years[y] = { n: tt.length, netR: r2(tt.reduce((a, x) => a + x.net, 0), 2) }; }
  return { trades: T, is: stats(is, win.is), oos: o, halves: { a: stats(inWin(T, win.h1), win.h1), b: stats(inWin(T, win.h2), win.h2) },
    placebo: { net: pl.map((x) => x.net), beaten: pl.filter((x) => o.netR > x.net).length, median: [...pl.map((x) => x.net)].sort((a, b) => a - b)[20] }, years };
}

function full(h1Path) {
  const daily = readDaily();
  const h1 = JSON.parse(fs.readFileSync(h1Path, 'utf8')).map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
  const h4 = h4FromH1(h1);
  const tests = { T1: runTest(daily, 'cloud', DAY), T2: runTest(daily, 'tk', DAY), T3: runTest(h4, 'cloud', H4) };
  const names = Object.keys(tests), adj = holm(names.map((k) => tests[k].oos.p));
  const out = { built: '2026-11-14', rule: 'Ichimoku 9 / 26 / 52, cloud shifted 26 forward; stop 2 x ATR(14) Wilder; next-open fills; one position at a time',
    costs: { roundTrip: P.cost, financingLong: FIN.xau.long, financingSrc: FIN.xau.src },
    data: { daily: { from: ymd(daily[0].time), to: ymd(daily.at(-1).time), candles: daily.length, src: 'council-data research/daily/xau.json (OANDA mid), weekends folded' },
      h4: { from: ymd(h4[0].time), to: ymd(h4.at(-1).time), candles: h4.length, hours: Object.fromEntries([1, 2, 3, 4].map((h) => [h, h4.filter((b) => b.hours === h).length])), src: 'OANDA mid H1 cache, H4 anchored to 17:00 New York, spot-shut hours dropped' } },
    windows: WIN, tests: {}, hold: { is: hold(daily, WIN.is), oos: hold(daily, WIN.oos), h1: hold(daily, WIN.h1), h2: hold(daily, WIN.h2) } };
  names.forEach((k, i) => {
    const t = tests[k], o = t.oos;
    const checks = { oosNet: o.netR > 0, tHolm: o.monthT >= 2 && adj[i] < 0.05, isSameSign: t.is.netR > 0,
      bothHalves: t.halves.a.netR > 0 && t.halves.b.netR > 0, costs2x: o.net2R > 0, placebo: t.placebo.beaten >= 38, n: o.n >= 30 };
    out.tests[k] = { tf: k === 'T3' ? 'H4' : 'D1', rule: k === 'T2' ? 'TK cross with the cloud' : 'cloud breakout', is: t.is, oos: o, halves: t.halves,
      holmP: r2(adj[i], 4), placebo: t.placebo, years: t.years, checks, pass: Object.values(checks).every(Boolean) };
  });
  const passed = names.filter((k) => out.tests[k].pass);
  out.verdict = passed.length ? 'PASS' : 'FAIL'; out.passed = passed;
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
  for (const k of names) { const x = out.tests[k]; console.log(`\n${k} ${x.tf} ${x.rule}`); console.log(' IS ', JSON.stringify(x.is)); console.log(' OOS', JSON.stringify(x.oos));
    console.log(' halves', x.halves.a.netR, x.halves.a.n, '|', x.halves.b.netR, x.halves.b.n, ' holm', x.holmP, ' placebo beaten', x.placebo.beaten, 'median', x.placebo.median); console.log(' checks', JSON.stringify(x.checks)); }
  console.log('\nhold', JSON.stringify(out.hold)); console.log('verdict', out.verdict, passed);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, p] = process.argv.slice(2);
  if (cmd === 'full') full(p); else console.log('usage: run.mjs full <xau-h1.json>');
}
