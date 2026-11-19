// Gold: does the late New York session (13:30 -> 16:30 New York, after the COMEX settlement) predict the next Asian session
// (18:00 -> 02:00 New York)? PREREGISTRATION.md was pushed alone before any candle was fetched or any trade computed.
// A new stand-alone intraday rule, NOT a gate, exit, entry or size of the gold book (item 44 respected). Paper research only.
//   node --use-env-proxy research/edge/gold-late-ny/fetch.mjs <dir>   OANDA mid M15 gold from 2015-12-01 (cache outside git)
//   node research/edge/gold-late-ny/run.mjs <dir>                    the study -> result.json (+ prints the tables)
// Pure pieces are exported for tests/gold-late-ny.test.mjs.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { nights, FIN } from '../../../council/fills.mjs';
import { nyOffsetH } from '../../../council/histdata.mjs';
import { cmeShut } from '../../../ict/calendar.mjs';

export const M = 900, H = 3600, D = 86400, SPREAD = 0.30, SLIP = 0.15, LOOK = 20, SEEDS = 40;
export const COST = SPREAD + 2 * SLIP;   // $0.60 a round trip: the spread and half a spread on the entry and on the exit
export const SIG = { from: 13.5, to: 16.5 }, TRADE = { from: 18, to: 2 };   // New York hours
export const FIRST_SIGNAL = '2016-01-04';
export const WIN = { is: ['2016-01-04', '2020-12-31'], oos: ['2021-01-01', '2099-12-31'] };
export const TESTS = {
  T1: { name: 'Follow the late-NY move into Asia (every signal day)', dir: 1, min: 0 },
  T2: { name: 'Follow, sizeable late-NY moves only (|move| > 0.5x its 20-day mean size)', dir: 1, min: 0.5 },
  T3: { name: 'Fade the late-NY move in Asia (every signal day)', dir: -1, min: 0 },
};
export const N_MIN = 200;

export const ymd = (d) => new Date(d * D * 1000).toISOString().slice(0, 10);
export const dayNum = (s) => Date.parse(s + 'T00:00:00Z') / 1000 / D;
export const wday = (d) => new Date(d * D * 1000).getUTCDay();
// unix time of New York wall-clock hour h (fractional) on New York date d (days since 1970)
export const nyT = (d, h) => Math.round(d * D + h * H + nyOffsetH(d * D + 12 * H) * H);
// the late-NY signal of New York date d: { d, a, b, open, close, move } | { skip }
export function signalOf(byTime, d) {
  const w = wday(d); if (w < 1 || w > 5) return { skip: 'weekend' };
  const a = nyT(d, SIG.from), b = nyT(d, SIG.to);
  for (let t = a; t < b; t += M) if (cmeShut(t)) return { skip: 'shut' };
  const ca = byTime.get(a), cb = byTime.get(b - M); if (!ca || !cb) return { skip: 'noSignal' };
  const move = cb.close - ca.open; if (move === 0) return { skip: 'flat' };
  return { d, a, b, open: ca.open, close: cb.close, move };
}
// the trade window that follows signal day d: 18:00 New York of the next session to 02:00 the day after (Friday -> Sunday)
export function windowOf(byTime, d) {
  const e = wday(d) === 5 ? d + 2 : d, t0 = nyT(e, TRADE.from), t1 = nyT(e + 1, TRADE.to);
  if (cmeShut(t0)) return { skip: 'shut' };
  if (!byTime.get(t0) || !byTime.get(t1 - M)) return { skip: 'noWindow' };
  const cs = []; for (let t = t0; t < t1; t += M) { const c = byTime.get(t); if (c) cs.push(c); }
  let hi = -Infinity, lo = Infinity; for (const c of cs) { hi = Math.max(hi, c.high); lo = Math.min(lo, c.low); }
  return { t0, t1, cs, range: hi - lo };
}
// one trade: market in at the first candle's open, stop first, a gap through fills at the open, out at the last close
export function simulate(cs, side, dist) {
  const entry = cs[0].open, stop = entry - side * dist; let exit = cs.at(-1).close, how = 'time';
  for (const b of cs) {
    if (side > 0 && b.low <= stop) { exit = Math.min(b.open, stop); how = 'stop'; break; }
    if (side < 0 && b.high >= stop) { exit = Math.max(b.open, stop); how = 'stop'; break; }
  }
  return { entry, stop, exit, how, R: side * (exit - entry) / dist };
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
// every signal day from FIRST_SIGNAL with its move, the 20-day mean size, the stop distance and the trade window's candles.
// Only what ended before the entry is read for the means (past signals; windows that ended at or before the entry).
export function candidates(bars, first = FIRST_SIGNAL) {
  const byTime = new Map(bars.map((b) => [b.time, b]));
  const d0 = Math.floor(bars[0].time / D), d1 = Math.floor(bars.at(-1).time / D) - 1, f = dayNum(first);
  const sigs = [], wins = [], out = [], skip = { weekend: 0, shut: 0, noSignal: 0, flat: 0, noWindow: 0, look: 0 };
  for (let d = d0; d <= d1; d++) {
    const s = signalOf(byTime, d), w = s.skip ? null : windowOf(byTime, d);
    if (d >= f && wday(d) >= 1 && wday(d) <= 5) {
      if (s.skip) skip[s.skip]++;
      else if (w.skip) skip[w.skip]++;
      else {
        const pastS = sigs.slice(-LOOK), pastW = wins.filter((x) => x.t1 <= w.t0).slice(-LOOK);
        if (pastS.length < LOOK || pastW.length < LOOK) skip.look++;
        else {
          const size = mean(pastS.map((x) => Math.abs(x.move))), dist = mean(pastW.map((x) => x.range));
          const between = w.cs[0].open - s.close, ret = w.cs.at(-1).close - w.cs[0].open;
          out.push({ d, move: s.move, size, ratio: Math.abs(s.move) / size, dist, cs: w.cs, t0: w.t0, t1: w.t1, between, ret });
        }
      }
    }
    if (!s.skip) sigs.push(s);
    // a window enters the stop history whatever its signal did (a window only needs its own candles and an open market)
    const ww = s.skip ? windowOf(byTime, d) : w;
    if (wday(d) >= 1 && wday(d) <= 5 && ww && !ww.skip) wins.push({ t0: ww.t0, t1: ww.t1, range: ww.range });
  }
  return { cands: out, skip, signals: sigs.length, windows: wins.length };
}
export function trades(cands, te, cost = COST) {
  const out = [];
  for (const c of cands) {
    if (!(c.ratio > te.min)) continue;
    const side = te.dir * Math.sign(c.move), tr = simulate(c.cs, side, c.dist);
    const nn = side > 0 ? nights(c.t0, c.t1) : 0, fin = nn * FIN.xau.long * tr.entry / c.dist;
    out.push({ d: c.d, side, dist: c.dist, ...tr, nights: nn, fin, net: tr.R - cost / c.dist - fin });
  }
  return out;
}
// Student t CDF (regularized incomplete beta, continued fraction)
function betacf(a, b, x) { let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d; let h = d;
  for (let m = 1; m <= 300; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-12) break; } return h; }
function lgamma(z) { const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = z, y = z, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (const c of g) s += c / ++y; return -t + Math.log(2.5066282746310005 * s / x); }
function ibeta(a, b, x) { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
export function tCdf(t, df) { const x = df / (df + t * t), p = 0.5 * ibeta(df / 2, 0.5, x); return t >= 0 ? 1 - p : p; }
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
export function stats(T, from, to) {
  const n = T.length, s = T.reduce((a, x) => a + x.net, 0), g = T.reduce((a, x) => a + x.R, 0);
  let eq = 0, pk = 0, dd = 0; for (const x of T) { eq += x.net; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  const ms = monthSums(T, from, to), t = monthT(ms), tg = monthT(monthSums(T, from, to, 'R'));
  const x2 = T.map((x) => ({ d: x.d, net: x.net - COST / x.dist })), t2 = monthT(monthSums(x2, from, to));
  return { n, buys: T.filter((x) => x.side > 0).length, sells: T.filter((x) => x.side < 0).length,
    gross: r4(g / n), avg: r4(s / n), total: r2(s), avgX2: r4(mean(x2.map((x) => x.net))), tX2: r2(t2),
    wr: Math.round(1000 * T.filter((x) => x.net > 0).length / n) / 10, stopped: T.filter((x) => x.how === 'stop').length, dd: r2(dd),
    months: ms.length, tGross: r2(tg), t: r2(t), p: r4(1 - tCdf(t, ms.length - 1)),
    medStop: r2([...T.map((x) => x.dist)].sort((a, b) => a - b)[Math.floor(n / 2)]), finR: r4(T.reduce((a, x) => a + x.fin, 0)) };
}
export function placebo(T, seeds = SEEDS) {
  const means = [];
  for (let s = 1; s <= seeds; s++) {
    const rnd = mulberry32(s); let sum = 0;
    for (const x of T) { const side = rnd() < 0.5 ? 1 : -1, tr = simulate(x.cs, side, x.dist), nn = side > 0 ? nights(x.t0, x.t1) : 0;
      sum += tr.R - COST / x.dist - nn * FIN.xau.long * tr.entry / x.dist; }
    means.push(sum / T.length);
  }
  const s = [...means].sort((a, b) => a - b), q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { seeds, p5: r4(q(0.05)), p50: r4(q(0.5)), p95: r4(q(0.95)), means };
}
const corr = (x, y) => { const mx = mean(x), my = mean(y); let a = 0, b = 0, c = 0; for (let i = 0; i < x.length; i++) { a += (x[i] - mx) * (y[i] - my); b += (x[i] - mx) ** 2; c += (y[i] - my) ** 2; } return a / Math.sqrt(b * c); };
const inWin = (d, w) => { const s = ymd(d); return s >= w[0] && s <= w[1]; };

export function study(bars) {
  const { cands, skip, signals, windows } = candidates(bars), last = ymd(cands.at(-1).d), res = { tests: {} };
  const win = { is: WIN.is, oos: [WIN.oos[0], last] };
  for (const [k, te] of Object.entries(TESTS)) {
    const all = trades(cands, te), byD = new Map(cands.map((c) => [c.d, c])); res.tests[k] = { name: te.name };
    for (const [w, [from, to]] of Object.entries(win)) {
      const T = all.filter((x) => inWin(x.d, [from, to])), st = stats(T, from, to);
      const pl = placebo(T.map((x) => ({ ...x, cs: byD.get(x.d).cs, t0: byD.get(x.d).t0, t1: byD.get(x.d).t1 })));
      st.placebo = { seeds: pl.seeds, p5: pl.p5, p50: pl.p50, p95: pl.p95, beats: pl.means.filter((m) => st.avg > m).length };
      res.tests[k][w] = st;
    }
  }
  const ks = Object.keys(TESTS), adj = holm(ks.map((k) => res.tests[k].oos.p));
  ks.forEach((k, i) => { const x = res.tests[k], o = x.oos;
    x.holm = r4(adj[i]);
    x.checks = { oosNet: o.avg > 0, oosT: o.t >= 2, holm: adj[i] < 0.05, isSame: x.is.avg > 0, x2: o.avgX2 > 0, n: o.n >= N_MIN };
    x.pass = Object.values(x.checks).every(Boolean); });
  const desc = {};
  for (const [w, ww] of Object.entries(win)) {
    const C = cands.filter((c) => inWin(c.d, ww)), mv = C.map((c) => c.move);
    desc[w] = { n: C.length, corrWindow: r4(corr(mv, C.map((c) => c.ret))), corrBetween: r4(corr(mv, C.map((c) => c.between))) };
  }
  const T1 = trades(cands, TESTS.T1), byWd = {};
  for (const [i, nm] of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].entries()) { const x = T1.filter((t) => wday(t.d) === i + 1);
    byWd[nm] = { n: x.length, gross: r4(mean(x.map((t) => t.R))), net: r4(mean(x.map((t) => t.net))) }; }
  desc.T1byWeekday = byWd;
  const passed = ks.filter((k) => res.tests[k].pass);
  Object.assign(res, { built: new Date().toISOString().slice(0, 10), data: { src: 'OANDA mid M15 XAU/USD via /md/bars', first: ymd(Math.floor(bars[0].time / D)), last: ymd(Math.floor(bars.at(-1).time / D)), candles: bars.length },
    signals, windows, candidates: cands.length, skip, windowDates: win, cost: { spread: SPREAD, slip: SLIP, roundTrip: COST, financing: FIN.xau.long, financingSrc: FIN.xau.src },
    descriptive: desc, passed, verdict: passed.length ? `PASS: ${passed.join(', ')}` : 'FAIL: 0 of 3 tests pass' });
  return res;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <dir with xau-15m.json.gz>');
  const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'xau-15m.json.gz'))));
  const bars = rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
  const res = study(bars);
  fs.writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'result.json'), JSON.stringify(res, null, 1) + '\n');
  console.log(JSON.stringify(res, null, 1));
}
