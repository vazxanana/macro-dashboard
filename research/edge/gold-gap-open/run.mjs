// Gold's daily reopen gap (NDOG, 17:00 close -> 18:00 New York reopen): fade it in Asia (T1), follow it to 02:00 (T2), or its
// midpoint as a London target (T3). PREREGISTRATION.md was pushed alone before any trade was computed.
// A new stand-alone intraday rule, NOT a gate, exit, entry or size of the gold book (item 44 respected). Paper research only.
//   node --use-env-proxy research/edge/gold-gap-open/fetch.mjs <dir>   OANDA mid M5 gold from 2015-12-01 (cache outside git)
//   node research/edge/gold-gap-open/run.mjs <dir>                    the study -> result.json (+ prints the tables)
// Pure pieces are exported for tests/gold-gap-open.test.mjs.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { nights, FIN } from '../../../council/fills.mjs';
import { nyOffsetH } from '../../../council/histdata.mjs';
import { cmeShut } from '../../../ict/calendar.mjs';

export const M5 = 300, H = 3600, D = 86400, SPREAD = 0.30, SLIP = 0.15, LOOK = 20, SEEDS = 40;
export const ELIG = 0.05, STOP = 0.25, HOLE = 30 * 60;   // eligibility |gap| >= 0.05 x ATR; stop 0.25 x ATR; a hole > 30 min drops a trade
export const DATA_FROM = Date.parse('2015-12-01T00:00:00Z') / 1000;
export const WIN = { is: ['2016-01-04', '2020-12-31'], oos: ['2021-01-01', '2099-12-31'] };
export const TESTS = {
  T1: { name: 'Fade the gap in Asia (18:05 -> 02:00, target the 17:00 close)' , nMin: 60 },
  T2: { name: 'Follow the gap to 02:00 (18:05 -> 02:00, no target)', nMin: 60 },
  T3: { name: 'NDOG midpoint as a London magnet (03:00 -> 08:00, target the midpoint)', nMin: 30 },
};
// cost of one round trip: the spread, half a spread on the market entry, half a spread on a stop / time exit (a target is a limit)
export const costOf = (how, k = 1) => k * (SPREAD + SLIP + (how === 'target' ? 0 : SLIP));

export const ymd = (d) => new Date(d * D * 1000).toISOString().slice(0, 10);
export const dayNum = (s) => Date.parse(s + 'T00:00:00Z') / 1000 / D;
export const wday = (d) => new Date(d * D * 1000).getUTCDay();
// unix time of New York wall-clock hour h (fractional) on New York date d (days since 1970)
export const nyT = (d, h) => Math.round(d * D + h * H + nyOffsetH(d * D + 12 * H) * H);
// New York date of a unix time, and the trading-day key (a session from 18:00 belongs to the next New York date)
export const nyDate = (t) => Math.floor((t - nyOffsetH(t) * H) / D);
export const tradeKey = (t) => Math.floor((t - nyOffsetH(t) * H + 6 * H) / D);

// trading days (18:00 -> 17:00 New York) from M5 candles: Map key -> { o, h, l, c }; weekend keys dropped
export function tradingDays(bars) {
  const days = new Map();
  for (const b of bars) {
    const k = tradeKey(b.time), w = wday(k); if (w < 1 || w > 5) continue;
    const x = days.get(k);
    if (!x) days.set(k, { k, o: b.open, h: b.high, l: b.low, c: b.close });
    else { x.h = Math.max(x.h, b.high); x.l = Math.min(x.l, b.low); x.c = b.close; }
  }
  const keys = [...days.keys()].sort((a, b) => a - b), out = [];
  for (let i = 1; i < keys.length; i++) { const x = days.get(keys[i]), p = days.get(keys[i - 1]); out.push({ k: keys[i], tr: Math.max(x.h, p.c) - Math.min(x.l, p.c) }); }
  return out;
}
// ATR of evening d: mean true range of the LOOK trading days with key <= d (the day that ended 17:00 of d is the last)
export function atrOf(days, d) {
  let lo = 0, hi = days.length; while (lo < hi) { const m = (lo + hi) >> 1; if (days[m].k <= d) lo = m + 1; else hi = m; }
  if (lo < LOOK) return null;
  let s = 0; for (let i = lo - LOOK; i < lo; i++) s += days[i].tr; return s / LOOK;
}
// candles with time in [a, b), in order (bars sorted by time; idx = binary search start)
export function between(bars, a, b) {
  let lo = 0, hi = bars.length; while (lo < hi) { const m = (lo + hi) >> 1; if (bars[m].time < a) lo = m + 1; else hi = m; }
  const out = []; for (let i = lo; i < bars.length && bars[i].time < b; i++) out.push(bars[i]); return out;
}
// true when the candles cover [a, b) with no hole over HOLE (from a to the first, between candles, from the last to b)
export function covered(cs, a, b) {
  if (!cs.length) return false;
  if (cs[0].time - a > HOLE || b - (cs.at(-1).time + M5) > HOLE) return false;
  for (let i = 1; i < cs.length; i++) if (cs[i].time - cs[i - 1].time > HOLE) return false;
  return true;
}
// one trade: entry given, candles walked in order, stop first, a gap through the stop fills at the open, a target fills at the
// target (a limit), else out at the last candle's close
export function simulate(cs, side, entry, dist, target = null) {
  const stop = entry - side * dist; let exit = cs.at(-1).close, how = 'time';
  for (const b of cs) {
    if (side > 0 && b.low <= stop) { exit = Math.min(b.open, stop); how = 'stop'; break; }
    if (side < 0 && b.high >= stop) { exit = Math.max(b.open, stop); how = 'stop'; break; }
    if (target != null && (side > 0 ? b.high >= target : b.low <= target)) { exit = target; how = 'target'; break; }
  }
  return { entry, stop, target, exit, how, R: side * (exit - entry) / dist };
}
// every Monday-Thursday evening from `first` with its gap, ATR and the three tests' set-ups (no trade simulated here)
export function evenings(bars, first = WIN.is[0]) {
  const byTime = new Map(bars.map((b) => [b.time, b])), days = tradingDays(bars);
  const d0 = dayNum(first), d1 = nyDate(bars.at(-1).time) - 1;
  const skip = { shut: 0, noCandle: 0, look: 0 }, out = [];
  for (let d = d0; d <= d1; d++) {
    const w = wday(d); if (w < 1 || w > 4) continue;
    const t55 = nyT(d, 16 + 55 / 60), t18 = nyT(d, 18);
    if (cmeShut(t55) || cmeShut(t18)) { skip.shut++; continue; }
    const c = byTime.get(t55), r = between(bars, t18, t18 + 30 * 60)[0];
    if (!c || !r) { skip.noCandle++; continue; }
    const atr = atrOf(days, d); if (!atr) { skip.look++; continue; }
    const C = c.close, O = r.open, G = O - C;
    out.push({ d, C, O, G, atr, ratio: Math.abs(G) / atr, r, t18, t02: nyT(d + 1, 2), t03: nyT(d + 1, 3), t08: nyT(d + 1, 8), t12: nyT(d + 1, 12) });
  }
  return { evs: out, skip };
}
// the trade set-up of test k on evening e: { side, entry, dist, target, cs, t0, t1 } | { skip: reason }
export function setup(bars, e, k) {
  if (!(e.ratio >= ELIG)) return { skip: 'small' };
  const dist = STOP * e.atr, g = Math.sign(e.G), r = e.r;
  if (k === 'T1' || k === 'T2') {
    if (k === 'T1' && (g > 0 ? r.low <= e.C : r.high >= e.C)) return { skip: 'filledFirst' };
    if (k === 'T2' && (g > 0 ? r.close < e.C : r.close > e.C)) return { skip: 'closedBack' };
    const t0 = r.time + M5, cs = between(bars, t0, e.t02);
    if (!covered(cs, t0, e.t02)) return { skip: 'hole' };
    return k === 'T1' ? { side: -g, entry: r.close, dist, target: e.C, cs, t0, t1: e.t02 } : { side: g, entry: r.close, dist, target: null, cs, t0, t1: e.t02 };
  }
  // T3: the midpoint untouched from the reopen candle through the 02:55 candle, then toward it at the 03:00 open
  const Mid = (e.C + e.O) / 2, pre = between(bars, r.time, e.t03);
  if (!covered(pre, r.time, e.t03)) return { skip: 'hole' };
  if (pre.some((b) => b.low <= Mid && b.high >= Mid)) return { skip: 'touched' };
  const cs = between(bars, e.t03, e.t08);
  if (!cs.length || cs[0].time !== e.t03 || !covered(cs, e.t03, e.t08)) return { skip: 'hole' };
  const entry = cs[0].open; if (Math.abs(Mid - entry) < ELIG * e.atr) return { skip: 'near' };
  return { side: Math.sign(Mid - entry), entry, dist, target: Mid, cs, t0: e.t03, t1: e.t08 };
}
export function trade(s, d, k = 1) {
  const tr = simulate(s.cs, s.side, s.entry, s.dist, s.target);
  const nn = s.side > 0 ? nights(s.t0, s.cs.at(-1).time + M5) : 0, fin = nn * FIN.xau.long * tr.entry / s.dist;
  return { d, side: s.side, dist: s.dist, ...tr, nights: nn, fin, cost: costOf(tr.how), net: tr.R - costOf(tr.how, k) / s.dist - fin };
}

// statistics
function betacf(a, b, x) { let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d; let h = d;
  for (let m = 1; m <= 300; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-12) break; } return h; }
function lgamma(z) { const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = z, y = z, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (const c of g) s += c / ++y; return -t + Math.log(2.5066282746310005 * s / x); }
function ibeta(a, b, x) { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
export function tCdf(t, df) { const x = df / (df + t * t), p = 0.5 * ibeta(df / 2, 0.5, x); return t >= 0 ? 1 - p : p; }
const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
// sums over every calendar month of [from, to] (0 for a month with no trade)
export function monthSums(T, from, to, key = 'net') {
  const m = new Map(); let [y, mo] = from.split('-').map(Number); const [y1, m1] = to.split('-').map(Number);
  while (y < y1 || (y === y1 && mo <= m1)) { m.set(`${y}-${String(mo).padStart(2, '0')}`, 0); if (++mo > 12) { mo = 1; y++; } }
  for (const x of T) { const k = ymd(x.d).slice(0, 7); if (m.has(k)) m.set(k, m.get(k) + x[key]); } return [...m.values()];
}
export function monthT(ms) { const n = ms.length, mm = mean(ms), sd = Math.sqrt(ms.reduce((a, b) => a + (b - mm) ** 2, 0) / (n - 1)); return sd > 0 ? mm / (sd / Math.sqrt(n)) : 0; }
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let run = 0;
  idx.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (ps.length - k) * p)); out[i] = run; }); return out;
}
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const r4 = (x) => Math.round(x * 1e4) / 1e4, r2 = (x) => Math.round(x * 100) / 100;
export function stats(T, T2x, from, to) {
  const n = T.length, s = T.reduce((a, x) => a + x.net, 0), g = T.reduce((a, x) => a + x.R, 0);
  let eq = 0, pk = 0, dd = 0; for (const x of T) { eq += x.net; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  const ms = monthSums(T, from, to), t = monthT(ms);
  const how = (h) => T.filter((x) => x.how === h).length;
  return { n, buys: T.filter((x) => x.side > 0).length, sells: T.filter((x) => x.side < 0).length,
    gross: r4(n ? g / n : 0), avg: r4(n ? s / n : 0), total: r2(s), avgX2: r4(mean(T2x.map((x) => x.net))), tX2: r2(monthT(monthSums(T2x, from, to))),
    wr: n ? Math.round(1000 * T.filter((x) => x.net > 0).length / n) / 10 : 0, exits: { stop: how('stop'), target: how('target'), time: how('time') }, dd: r2(dd),
    months: ms.length, tGross: r2(monthT(monthSums(T, from, to, 'R'))), t: r2(t), p: r4(1 - tCdf(t, ms.length - 1)),
    medStop: n ? r2([...T.map((x) => x.dist)].sort((a, b) => a - b)[Math.floor(n / 2)]) : 0, finR: r4(T.reduce((a, x) => a + x.fin, 0)) };
}
// random side per trade, the stop and (when the test has one) the target at the same distances on the drawn side
export function placebo(S, seeds = SEEDS) {
  const means = [];
  for (let s = 1; s <= seeds; s++) {
    const rnd = mulberry32(s); let sum = 0;
    for (const x of S) {
      const side = rnd() < 0.5 ? 1 : -1, tg = x.s.target == null ? null : x.s.entry + side * Math.abs(x.s.target - x.s.entry);
      sum += trade({ ...x.s, side, target: tg }, x.d).net;
    }
    means.push(S.length ? sum / S.length : 0);
  }
  const s = [...means].sort((a, b) => a - b), q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { seeds, p5: r4(q(0.05)), p50: r4(q(0.5)), p95: r4(q(0.95)) };
}
const inWin = (d, w) => { const s = ymd(d); return s >= w[0] && s <= w[1]; };

export function study(bars) {
  bars = bars.filter((b) => b.time >= DATA_FROM);
  const { evs, skip } = evenings(bars), last = ymd(evs.at(-1).d), win = { is: WIN.is, oos: [WIN.oos[0], last] };
  const res = { tests: {}, skip };
  for (const k of Object.keys(TESTS)) {
    const S = [], why = {};
    for (const e of evs) { const s = setup(bars, e, k); if (s.skip) why[s.skip] = (why[s.skip] || 0) + 1; else S.push({ d: e.d, s }); }
    res.tests[k] = { name: TESTS[k].name, skipped: why };
    for (const [w, [from, to]] of Object.entries(win)) {
      const Sw = S.filter((x) => inWin(x.d, [from, to])), T = Sw.map((x) => trade(x.s, x.d)), T2 = Sw.map((x) => trade(x.s, x.d, 2));
      res.tests[k][w] = { from, to, ...stats(T, T2, from, to), placebo: placebo(Sw) };
      if (w === 'oos') res.tests[k].years = Object.fromEntries([...new Set(T.map((x) => ymd(x.d).slice(0, 4)))].map((y) => {
        const Y = T.filter((x) => ymd(x.d).startsWith(y)); return [y, { n: Y.length, total: r2(Y.reduce((a, x) => a + x.net, 0)) }]; }));
      if (w === 'is') res.tests[k].yearsIS = Object.fromEntries([...new Set(T.map((x) => ymd(x.d).slice(0, 4)))].map((y) => {
        const Y = T.filter((x) => ymd(x.d).startsWith(y)); return [y, { n: Y.length, total: r2(Y.reduce((a, x) => a + x.net, 0)) }]; }));
    }
  }
  const ks = Object.keys(TESTS), adj = holm(ks.map((k) => res.tests[k].oos.p));
  ks.forEach((k, i) => {
    const t = res.tests[k], o = t.oos;
    t.holm = r4(adj[i]);
    t.lines = { oosNet: o.avg > 0, oosT2: o.t >= 2, holm: adj[i] < 0.05, isNet: t.is.avg > 0, x2: o.avgX2 > 0, n: o.n >= TESTS[k].nMin, placebo: o.avg > o.placebo.p95 };
    t.pass = Object.values(t.lines).every(Boolean);
  });
  res.verdict = ks.some((k) => res.tests[k].pass) ? 'PASS' : 'FAIL';
  // descriptive: gap sizes, prints inside the break, fills of the gap and the midpoint
  let inBreak = 0; for (const b of bars) { const m = Math.floor(((b.time - nyOffsetH(b.time) * H) % D + D) % D / 60); if (m >= 17 * 60 && m < 18 * 60 && b.time >= dayNum(WIN.is[0]) * D) inBreak++; }
  const desc = { evenings: evs.length, breakPrints: inBreak, byWindow: {} };
  for (const [w, wr] of Object.entries(win)) {
    const E = evs.filter((e) => inWin(e.d, wr)), el = E.filter((e) => e.ratio >= ELIG);
    const fill = (e, tEnd) => between(bars, e.r.time, tEnd).some((b) => b.low <= e.C && b.high >= e.C);
    const mid = (e, tEnd) => { const Mi = (e.C + e.O) / 2; return between(bars, e.r.time, tEnd).some((b) => b.low <= Mi && b.high >= Mi); };
    const share = (f) => el.length ? r4(el.filter(f).length / el.length) : null;
    const absG = E.map((e) => Math.abs(e.G)).sort((a, b) => a - b);
    desc.byWindow[w] = { evenings: E.length, zero: E.filter((e) => e.G === 0).length, withinSpread: E.filter((e) => Math.abs(e.G) <= SPREAD).length,
      medianGap: r2(absG[Math.floor(absG.length / 2)] || 0), elig05: el.length, elig10: E.filter((e) => e.ratio >= 0.1).length,
      filledBy02: share((e) => fill(e, e.t02)), filledBy12: share((e) => fill(e, e.t12)), midBy0255: share((e) => mid(e, e.t03)), midBy12: share((e) => mid(e, e.t12)) };
  }
  res.descriptive = desc;
  res.data = { candles: bars.length, from: new Date(bars[0].time * 1000).toISOString(), to: new Date(bars.at(-1).time * 1000).toISOString() };
  return res;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <dir with xau-5m.json.gz>');
  const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'xau-5m.json.gz'))));
  const bars = rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
  const res = study(bars);
  const plan = fs.readFileSync(new URL('./PREREGISTRATION.md', import.meta.url));
  const out = { study: 'gold-gap-open', built: new Date().toISOString().slice(0, 10), verdict: res.verdict,
    preregistration: (await import('node:crypto')).createHash('sha256').update(plan).digest('hex'),
    costs: { spread: SPREAD, slipPerMarketOrder: SLIP, roundTrip: costOf('stop'), roundTripTarget: costOf('target'), financing: FIN.xau.long },
    rule: { eligible: `|gap| >= ${ELIG} x ATR20`, stop: `${STOP} x ATR20`, windows: WIN }, ...res };
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
  for (const [k, t] of Object.entries(res.tests)) {
    console.log(k, t.name, 'pass', t.pass, 'holm', t.holm, JSON.stringify(t.lines), JSON.stringify(t.skipped));
    for (const w of ['is', 'oos']) { const x = t[w]; console.log(' ', w, `n ${x.n} b/s ${x.buys}/${x.sells} gross ${x.gross} net ${x.avg} x2 ${x.avgX2} tot ${x.total} tG ${x.tGross} t ${x.t} p ${x.p} wr ${x.wr} exits ${JSON.stringify(x.exits)} dd ${x.dd} med ${x.medStop} fin ${x.finR} plc ${JSON.stringify(x.placebo)}`); }
    console.log('  years IS', JSON.stringify(t.yearsIS), 'OOS', JSON.stringify(t.years));
  }
  console.log('verdict', res.verdict, JSON.stringify(res.skip), JSON.stringify(res.descriptive));
}
