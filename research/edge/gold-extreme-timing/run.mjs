// gold-extreme-timing: does the HOUR in which a gold day made its high (low) tell anything about the next day, beyond the
// day's direction and gold's drift? (PREREGISTRATION.md, pushed first). Paper research only: nothing live reads this file.
//   node --use-env-proxy research/edge/gold-extreme-timing/run.mjs fetch <file.json.gz>   (OANDA mid H1 gold, keep outside git)
//   node research/edge/gold-extreme-timing/run.mjs <file.json.gz>                         (writes result.json)
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIN, nights } from '../../../council/fills.mjs';
import { nyOffsetH } from '../../../council/histdata.mjs';

export const P = { late: 4, minBars: 20, atrN: 14, stopAtr: 1.0, hold: 1, holdLong: 5, cost: 0.60 };
export const IS = ['2007-01-01', '2016-12-31'];
export const OOS = ['2017-01-01', '2026-10-31'];
const H = 3600;
export const windowOf = (d) => (d >= IS[0] && d <= IS[1] ? 'is' : d >= OOS[0] && d <= OOS[1] ? 'oos' : null);

// New York session date of an H1 candle: the date whose 17:00 New York close ends the session holding the candle
export const nyKey = (t) => new Date((t - nyOffsetH(t) * H + 7 * H) * 1000).toISOString().slice(0, 10);

// rows [t,o,h,l,c] -> usable New York days { key, bars, open, high, low, close, n, hiIdx, loIdx }
export function nyDays(rows, minBars = P.minBars) {
  const g = new Map();
  for (const [t, o, h, l, c] of rows) { const k = nyKey(t); if (!g.has(k)) g.set(k, []); g.get(k).push({ time: t, open: o, high: h, low: l, close: c }); }
  const out = [];
  for (const [key, bars] of [...g.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (bars.length < minBars) continue;
    bars.sort((a, b) => a.time - b.time);
    let hiIdx = 0, loIdx = 0;
    bars.forEach((b, i) => { if (b.high > bars[hiIdx].high) hiIdx = i; if (b.low < bars[loIdx].low) loIdx = i; });
    out.push({ key, bars, open: bars[0].open, high: bars[hiIdx].high, low: bars[loIdx].low, close: bars.at(-1).close, n: bars.length, hiIdx, loIdx });
  }
  return out;
}
// ATR14 ending at day i (true range against the previous usable day's close), null without 14 days
export function atrAt(d, i, n = P.atrN) {
  if (i < n) return null;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) s += Math.max(d[k].high - d[k].low, Math.abs(d[k].high - d[k - 1].close), Math.abs(d[k].low - d[k - 1].close));
  return s / n;
}
// the day's class from its own candles only (known at its 17:00 New York close)
export function classify(day, late = P.late) {
  const up = day.close > day.open, dn = day.close < day.open;
  if (up && day.hiIdx >= day.n - late) return { side: 'buy', kind: 'late' };
  if (dn && day.loIdx >= day.n - late) return { side: 'sell', kind: 'late' };
  if (up && day.hiIdx < late) return { side: 'buy', kind: 'early' };
  if (dn && day.loIdx < late) return { side: 'sell', kind: 'early' };
  return null;
}
export function signals(d, kind = 'late') {
  const out = [];
  for (let i = 0; i < d.length; i++) { const c = classify(d[i]); if (c && c.kind === kind) out.push({ i, side: c.side }); }
  return out;
}
// one trade: entry at the open of day e's first H1 candle, stop stopAtr x atr, out at the close of day e+hold-1 or the stop
export function trade(d, e, side, atr, hold = P.hold, costMul = 1) {
  if (!(atr > 0) || e + hold - 1 >= d.length) return null;
  const sell = side === 'sell', entry = d[e].bars[0].open, risk = P.stopAtr * atr, stop = sell ? entry + risk : entry - risk;
  let px = null, how = 'time', xt = null, first = true;
  outer: for (let k = e; k <= e + hold - 1; k++) for (const c of d[k].bars) {
    if (!first && (sell ? c.open >= stop : c.open <= stop)) { px = c.open; how = 'gap'; xt = c.time; break outer; }
    first = false;
    if (sell ? c.high >= stop : c.low <= stop) { px = stop; how = 'stop'; xt = c.time + H; break outer; }
  }
  const lastDay = d[e + hold - 1];
  if (px == null) { px = lastDay.close; xt = lastDay.bars.at(-1).time + H; }
  const gross = (sell ? entry - px : px - entry) / risk;
  const nn = sell ? 0 : nights(d[e].bars[0].time, xt);
  const cost = costMul * (P.cost + (sell ? 0 : nn * FIN.xau.long * entry)) / risk;
  return { e, side, key: d[e].key, entry, stop, risk, exitPx: px, how, xt, gross, cost, net: gross - cost, nights: nn };
}
// one position at a time: a signal is skipped while a trade is open (its entry day is before the open trade's exit)
export function ruleTrades(d, sigs, hold = P.hold, costMul = 1) {
  const out = []; let busyTo = -1;
  for (const s of sigs) {
    const e = s.i + 1;
    if (e <= busyTo) continue;
    const tr = trade(d, e, s.side, atrAt(d, s.i), hold, costMul);
    if (!tr || !windowOf(tr.key)) continue;
    out.push(tr); busyTo = e + hold - 1;
  }
  return out;
}
// baselines: B0 every usable day (both sides); B1 buys after up-close days, sells after down-close days
export function baseline(d, hold = P.hold, costMul = 1, mode = 'all') {
  const acc = {};
  for (let i = P.atrN; i + 1 < d.length; i++) {
    const day = d[i];
    for (const side of ['buy', 'sell']) {
      if (mode === 'dir' && !(side === 'buy' ? day.close > day.open : day.close < day.open)) continue;
      const tr = trade(d, i + 1, side, atrAt(d, i), hold, costMul); if (!tr) continue;
      const w = windowOf(tr.key); if (!w) continue;
      const k = w + ':' + side; (acc[k] ||= { n: 0, net: 0, gross: 0 }); acc[k].n++; acc[k].net += tr.net; acc[k].gross += tr.gross;
    }
  }
  const m = {};
  for (const [k, v] of Object.entries(acc)) m[k] = { n: v.n, net: v.net / v.n, gross: v.gross / v.n };
  return m;
}
// t on calendar-month sums, every month of the window counted (zeros included)
export function monthT(rows, win, val) {
  const [a, z] = win === 'is' ? IS : OOS, sums = new Map();
  for (let y = +a.slice(0, 4); y <= +z.slice(0, 4); y++) for (let m = 1; m <= 12; m++) {
    const k = `${y}-${String(m).padStart(2, '0')}`; if (k >= a.slice(0, 7) && k <= z.slice(0, 7)) sums.set(k, 0);
  }
  for (const r of rows) { const k = r.key.slice(0, 7); if (sums.has(k)) sums.set(k, sums.get(k) + val(r)); }
  const v = [...sums.values()], n = v.length, mu = v.reduce((s, x) => s + x, 0) / n;
  const sd = Math.sqrt(v.reduce((s, x) => s + (x - mu) ** 2, 0) / (n - 1));
  return { months: n, t: sd > 0 ? mu / (sd / Math.sqrt(n)) : 0 };
}
const erf = (x) => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
export const pTwo = (t) => 2 * (1 - 0.5 * (1 + erf(Math.abs(t) / Math.SQRT2)));
export function holm(ps) {
  const o = ps.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p), adj = Array(ps.length); let run = 0;
  o.forEach((x, r) => { run = Math.max(run, Math.min(1, (ps.length - r) * x.p)); adj[x.i] = run; });
  return adj;
}
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function pct(sorted, q) {
  if (!sorted.length) return null;
  const h = (sorted.length - 1) * q, lo = Math.floor(h), hi = Math.ceil(h);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (h - lo);
}

const r3 = (x) => Math.round(x * 1000) / 1000, r2 = (x) => Math.round(x * 100) / 100;
function summary(trs, base, win) {
  const w = trs.filter((r) => windowOf(r.key) === win), n = w.length;
  const ex = (r) => r.net - base[win + ':' + r.side].net;
  const s = (f) => w.reduce((a, r) => a + f(r), 0);
  const stops = w.map((r) => r.risk).sort((a, b) => a - b);
  let cum = 0, peak = 0, dd = 0; for (const r of w) { cum += r.net; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak); }
  const side = (sd) => { const v = w.filter((r) => r.side === sd), m = v.length; return { n: m, gross: m ? r3(v.reduce((a, r) => a + r.gross, 0) / m) : null, net: m ? r3(v.reduce((a, r) => a + r.net, 0) / m) : null, excess: m ? r3(v.reduce((a, r) => a + ex(r), 0) / m) : null, base: r3(base[win + ':' + sd].net) }; };
  return {
    n, gross: r3(s((r) => r.gross) / n), net: r3(s((r) => r.net) / n), excess: r3(s(ex) / n), totalNet: r2(s((r) => r.net)),
    tGross: r2(monthT(w, win, (r) => r.gross).t), tNet: r2(monthT(w, win, (r) => r.net).t), tExcess: r2(monthT(w, win, ex).t),
    months: monthT(w, win, ex).months, win: r3(w.filter((r) => r.net > 0).length / n), dd: r2(dd),
    medianStop: r2(pct(stops, 0.5)), costShare: r3(s((r) => r.cost) / s((r) => Math.abs(r.gross))), buy: side('buy'), sell: side('sell'),
  };
}

export function study(d) {
  const sigs = signals(d, 'late'), early = signals(d, 'early');
  const t1 = ruleTrades(d, sigs, P.hold), t5 = ruleTrades(d, sigs, P.holdLong), t1x2 = ruleTrades(d, sigs, P.hold, 2), te = ruleTrades(d, early, P.hold);
  const b0 = baseline(d, P.hold), b1 = baseline(d, P.hold, 1, 'dir'), b5 = baseline(d, P.holdLong), b0x2 = baseline(d, P.hold, 2);
  const S = {
    T1: { is: summary(t1, b0, 'is'), oos: summary(t1, b0, 'oos') },
    T2: { is: summary(t1, b1, 'is'), oos: summary(t1, b1, 'oos') },
    T3: { is: summary(t5, b5, 'is'), oos: summary(t5, b5, 'oos') },
    x2: { is: summary(t1x2, b0x2, 'is'), oos: summary(t1x2, b0x2, 'oos') },
    early: { is: summary(te, b0, 'is'), oos: summary(te, b0, 'oos') },
  };
  const tests = [
    { id: 'T1', what: 'late extreme, 1-day hold, excess over the every-day same-side baseline', t: S.T1.oos.tExcess, isMean: S.T1.is.excess },
    { id: 'T2', what: 'late extreme, 1-day hold, excess over the same-direction-day baseline', t: S.T2.oos.tExcess, isMean: S.T2.is.excess },
    { id: 'T3', what: 'late extreme, 5-day hold, excess over the every-day same-side baseline', t: S.T3.oos.tExcess, isMean: S.T3.is.excess },
  ];
  const adj = holm(tests.map((x) => pTwo(x.t)));
  tests.forEach((x, k) => { x.p = +pTwo(x.t).toFixed(4); x.holm = +adj[k].toFixed(4); });
  // placebo: same count and buy / sell mix of OOS trades on random OOS usable days
  const oosRule = t1.filter((r) => windowOf(r.key) === 'oos');
  const pool = []; for (let i = P.atrN; i + 1 < d.length; i++) if (windowOf(d[i + 1].key) === 'oos') pool.push(i);
  const plac = [];
  for (let seed = 1; seed <= 40; seed++) {
    const rnd = mulberry32(seed), rows = [];
    for (const r of oosRule) { const i = pool[Math.floor(rnd() * pool.length)]; const tr = trade(d, i + 1, r.side, atrAt(d, i), P.hold); if (tr) rows.push(tr); }
    plac.push(r2(monthT(rows, 'oos', (r) => r.net - b0['oos:' + r.side].net).t));
  }
  const ps = [...plac].sort((a, c) => a - c);
  const placebo = { draws: 40, median: pct(ps, 0.5), p95: r2(pct(ps, 0.95)), max: ps.at(-1), atLeastActual: plac.filter((x) => x >= S.T1.oos.tExcess).length, ts: plac };
  const T1 = tests[0];
  const pass = T1.t >= 2 && T1.holm < 0.05 && S.T1.is.excess > 0 && S.x2.oos.excess > 0;
  const years = {};
  for (const r of t1) { const y = r.key.slice(0, 4); (years[y] ||= { n: 0, net: 0, excess: 0 }); years[y].n++; years[y].net += r.net; years[y].excess += r.net - b0[windowOf(r.key) + ':' + r.side].net; }
  for (const y of Object.keys(years)) { years[y].net = r2(years[y].net); years[y].excess = r2(years[y].excess); }
  return { usableDays: d.length, signals: { late: sigs.length, early: early.length }, baseline: { b0, b1, b5, b0x2 }, S, tests, placebo, years, verdict: pass ? 'PASS' : 'FAIL' };
}

async function fetchH1(out) {
  const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
  const FROM = T('2006-01-01'), END = T('2026-11-01'), sleep = (ms) => new Promise((r) => setTimeout(r, ms)), m = new Map();
  for (let a = FROM; a < END;) {
    const b = Math.min(END, a + 4999 * H); let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) {
      try { const r = await fetch(`${BASE}bars?sym=xau&tf=1h&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
        if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; }
      catch (e) { err = String(e.message || e); }
      if (!j) await sleep(2000 * (k + 1));
    }
    if (!j) throw new Error(`${new Date(a * 1000).toISOString()}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(150);
  }
  const bars = [...m.values()].sort((p, q) => p[0] - q[0]);
  fs.writeFileSync(out, zlib.gzipSync(JSON.stringify(bars)));
  console.log(`${bars.length} H1 candles ${new Date(bars[0][0] * 1000).toISOString()} → ${new Date(bars.at(-1)[0] * 1000).toISOString()}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [a, b] = process.argv.slice(2);
  if (a === 'fetch') await fetchH1(b);
  else {
    const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(a)).toString()).filter((r) => r[0] < Date.parse('2026-11-01T00:00:00Z') / 1000);
    const d = nyDays(rows), res = study(d);
    const rnd = (o) => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'number' ? Math.round(v * 10000) / 10000 : v)));
    const out = { study: 'gold-extreme-timing', built: '2026-11-14', verdict: res.verdict,
      data: { src: 'OANDA mid H1 XAU/USD via the candle proxy (/md/bars), New York 17:00 days', from: d[0].key, to: d.at(-1).key, h1: rows.length },
      params: P, windows: { is: IS, oos: OOS }, costs: { roundTrip: P.cost, finLong: FIN.xau.long, finSrc: FIN.src }, ...rnd(res) };
    fs.writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'result.json'), JSON.stringify(out, null, 1) + '\n');
    console.log(JSON.stringify({ verdict: out.verdict, signals: out.signals, tests: out.tests, placebo: { ...out.placebo, ts: undefined },
      T1: out.S.T1, T2is: out.S.T2.is.excess, T2oos: out.S.T2.oos, T3: [out.S.T3.is, out.S.T3.oos].map((x) => [x.n, x.excess, x.tExcess]), x2: out.S.x2.oos.excess,
      early: [out.S.early.is, out.S.early.oos].map((x) => [x.n, x.excess, x.tExcess]), base: out.baseline.b0 }, null, 1));
  }
}
