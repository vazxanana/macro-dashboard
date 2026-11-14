// gold-tug-of-war: when gold's Asian hours and its London / New York hours pulled it opposite ways over 20 days, does gold
// follow Asia over the next week? (PREREGISTRATION.md, pushed first). Paper research only: nothing live reads this file.
//   node --use-env-proxy research/edge/gold-tug-of-war/run.mjs fetch <file.json.gz>   (OANDA mid H1 gold, keep outside git)
//   node research/edge/gold-tug-of-war/run.mjs <file.json.gz>                         (writes result.json)
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIN, nights } from '../../../council/fills.mjs';
import { nyOffsetH } from '../../../council/histdata.mjs';

export const P = { minBars: 20, atrN: 14, look: 20, med: 250, asiaEnd: 3, stopAtr: 2.0, hold: 5, holdLong: 10, cost: 0.60, draws: 40 };
export const IS = ['2007-01-01', '2016-12-31'];
export const OOS = ['2017-01-01', '2026-10-31'];
const H = 3600;
export const windowOf = (d) => (d >= IS[0] && d <= IS[1] ? 'is' : d >= OOS[0] && d <= OOS[1] ? 'oos' : null);

// New York session date of an H1 candle (the 17:00 New York close that ends its session) and its New York hour
export const nyKey = (t) => new Date((t - nyOffsetH(t) * H + 7 * H) * 1000).toISOString().slice(0, 10);
export const nyHour = (t) => new Date((t - nyOffsetH(t) * H) * 1000).getUTCHours();
export const isAsia = (t) => { const h = nyHour(t); return h >= 17 || h < P.asiaEnd; };

// rows [t,o,h,l,c] -> usable New York days { key, bars, open, high, low, close }
export function nyDays(rows, minBars = P.minBars) {
  const g = new Map();
  for (const [t, o, h, l, c] of rows) { const k = nyKey(t); if (!g.has(k)) g.set(k, []); g.get(k).push({ time: t, open: o, high: h, low: l, close: c }); }
  const out = [];
  for (const [key, bars] of [...g.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (bars.length < minBars) continue;
    bars.sort((a, b) => a.time - b.time);
    out.push({ key, bars, open: bars[0].open, high: Math.max(...bars.map((b) => b.high)), low: Math.min(...bars.map((b) => b.low)), close: bars.at(-1).close });
  }
  return out;
}
// the split of each day: A = Asian part (from the previous close), W = Western part; null when it cannot be split
export function splits(d) {
  return d.map((day, i) => {
    if (i === 0) return null;
    let last = null; for (const b of day.bars) if (isAsia(b.time)) last = b;
    if (!last || last === day.bars.at(-1)) return null;
    return { A: Math.log(last.close / d[i - 1].close), W: Math.log(day.close / last.close) };
  });
}
// day-by-day signal from the splits: { a, w, side } or null; known at day i's close (days i-look+1 .. i only)
export function signalSeries(sp, look = P.look) {
  const out = Array(sp.length).fill(null);
  for (let i = look; i < sp.length; i++) {
    let a = 0, w = 0, ok = true;
    for (let k = i - look + 1; k <= i; k++) { if (!sp[k]) { ok = false; break; } a += sp[k].A; w += sp[k].W; }
    if (ok) out[i] = { a, w, side: a * w < 0 ? (a > 0 ? 'buy' : 'sell') : null };
  }
  return out;
}
// T2's strength: |A20| at or above the median |A20| of the previous 250 days (past only)
export function strong(sig, i, n = P.med) {
  if (!sig[i]) return false;
  const xs = []; for (let j = Math.max(0, i - n); j < i; j++) if (sig[j]) xs.push(Math.abs(sig[j].a));
  if (xs.length < n / 2) return false;
  xs.sort((p, q) => p - q);
  return Math.abs(sig[i].a) >= xs[Math.floor(xs.length / 2)];
}
export function atrAt(d, i, n = P.atrN) {
  if (i < n) return null;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) s += Math.max(d[k].high - d[k].low, Math.abs(d[k].high - d[k - 1].close), Math.abs(d[k].low - d[k - 1].close));
  return s / n;
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
// one position at a time over a list of { i, side }
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
export const toSigs = (sig, keep = () => true) => sig.map((s, i) => (s && s.side && keep(i) ? { i, side: s.side } : null)).filter(Boolean);
// same-side baseline: mean net of the trade entered on every usable day of the window
export function baseline(d, hold = P.hold, costMul = 1) {
  const acc = {};
  for (let i = P.atrN; i + 1 < d.length; i++) for (const side of ['buy', 'sell']) {
    const tr = trade(d, i + 1, side, atrAt(d, i), hold, costMul); if (!tr) continue;
    const w = windowOf(tr.key); if (!w) continue;
    const k = w + ':' + side; (acc[k] ||= { n: 0, net: 0, gross: 0 }); acc[k].n++; acc[k].net += tr.net; acc[k].gross += tr.gross;
  }
  const m = {}; for (const [k, v] of Object.entries(acc)) m[k] = { n: v.n, net: v.net / v.n, gross: v.gross / v.n };
  return m;
}
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
// placebo: shuffle the signal series within each calendar year (Fisher-Yates)
export function shuffleByYear(sig, d, rnd) {
  const out = sig.slice(), byY = new Map();
  sig.forEach((_, i) => { const y = d[i].key.slice(0, 4); if (!byY.has(y)) byY.set(y, []); byY.get(y).push(i); });
  for (const idx of byY.values()) for (let k = idx.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); const a = idx[k], b = idx[j]; [out[a], out[b]] = [out[b], out[a]]; }
  return out;
}
// control: each day's Asian and Western parts swapped with probability one half
export const swapSplits = (sp, rnd) => sp.map((s) => (s && rnd() < 0.5 ? { A: s.W, W: s.A } : s));

const r3 = (x) => Math.round(x * 1000) / 1000, r2 = (x) => Math.round(x * 100) / 100;
function summary(trs, base, win) {
  const w = trs.filter((r) => windowOf(r.key) === win), n = w.length;
  const ex = (r) => r.net - base[win + ':' + r.side].net;
  const s = (f) => w.reduce((a, r) => a + f(r), 0);
  const stops = w.map((r) => r.risk).sort((a, b) => a - b);
  let cum = 0, peak = 0, dd = 0; for (const r of w) { cum += r.net; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak); }
  const side = (sd) => { const v = w.filter((r) => r.side === sd), m = v.length; return { n: m, net: m ? r3(v.reduce((a, r) => a + r.net, 0) / m) : null, excess: m ? r3(v.reduce((a, r) => a + ex(r), 0) / m) : null, base: r3(base[win + ':' + sd].net) }; };
  return {
    n, gross: r3(s((r) => r.gross) / n), net: r3(s((r) => r.net) / n), excess: r3(s(ex) / n), totalNet: r2(s((r) => r.net)),
    tGross: r2(monthT(w, win, (r) => r.gross).t), tNet: r2(monthT(w, win, (r) => r.net).t), tExcess: r2(monthT(w, win, ex).t),
    months: monthT(w, win, ex).months, win: r3(w.filter((r) => r.net > 0).length / n), dd: r2(dd),
    medianStop: r2(pct(stops, 0.5)), stopped: w.filter((r) => r.how !== 'time').length, buy: side('buy'), sell: side('sell'),
  };
}
const oosT = (d, sig, base) => r2(monthT(ruleTrades(d, toSigs(sig), P.hold).filter((r) => windowOf(r.key) === 'oos'), 'oos', (r) => r.net - base['oos:' + r.side].net).t);
const dist = (ts, actual) => { const s = [...ts].sort((a, b) => a - b); return { draws: ts.length, median: r2(pct(s, 0.5)), p95: r2(pct(s, 0.95)), max: s.at(-1), atLeastActual: ts.filter((x) => x >= actual).length, ts }; };

export function study(d) {
  const sp = splits(d), sig = signalSeries(sp);
  const s1 = toSigs(sig), s2 = toSigs(sig, (i) => strong(sig, i));
  const t1 = ruleTrades(d, s1, P.hold), t2 = ruleTrades(d, s2, P.hold), t3 = ruleTrades(d, s1, P.holdLong), t1x2 = ruleTrades(d, s1, P.hold, 2);
  const b5 = baseline(d, P.hold), b10 = baseline(d, P.holdLong), b5x2 = baseline(d, P.hold, 2);
  const S = {
    T1: { is: summary(t1, b5, 'is'), oos: summary(t1, b5, 'oos') },
    T2: { is: summary(t2, b5, 'is'), oos: summary(t2, b5, 'oos') },
    T3: { is: summary(t3, b10, 'is'), oos: summary(t3, b10, 'oos') },
    x2: { is: summary(t1x2, b5x2, 'is'), oos: summary(t1x2, b5x2, 'oos') },
  };
  const tests = [
    { id: 'T1', what: 'Asia and the West disagree over 20 days, follow Asia, 5-day hold', t: S.T1.oos.tExcess, isMean: S.T1.is.excess },
    { id: 'T2', what: 'T1 when |Asia 20-day| is at or above its 250-day median, 5-day hold', t: S.T2.oos.tExcess, isMean: S.T2.is.excess },
    { id: 'T3', what: 'T1 signal, 10-day hold', t: S.T3.oos.tExcess, isMean: S.T3.is.excess },
  ];
  const adj = holm(tests.map((x) => pTwo(x.t)));
  tests.forEach((x, k) => { x.p = +pTwo(x.t).toFixed(4); x.holm = +adj[k].toFixed(4); });
  const actual = S.T1.oos.tExcess, pl = [], ct = [];
  for (let seed = 1; seed <= P.draws; seed++) {
    pl.push(oosT(d, shuffleByYear(sig, d, mulberry32(seed)), b5));
    ct.push(oosT(d, signalSeries(swapSplits(sp, mulberry32(1000 + seed))), b5));
  }
  const placebo = dist(pl, actual), control = dist(ct, actual);
  const checks = {
    tAtLeast2: actual >= 2, holm: tests[0].holm < 0.05, isSameSign: S.T1.is.excess > 0,
    netPositive: S.T1.oos.net > 0, net2x: S.x2.oos.net > 0, abovePlacebo: actual > placebo.p95, aboveControl: actual > control.p95,
  };
  const pass = Object.values(checks).every(Boolean);
  const years = {};
  for (const r of t1) { const y = r.key.slice(0, 4); (years[y] ||= { n: 0, net: 0, excess: 0 }); years[y].n++; years[y].net += r.net; years[y].excess += r.net - b5[windowOf(r.key) + ':' + r.side].net; }
  for (const y of Object.keys(years)) { years[y].net = r2(years[y].net); years[y].excess = r2(years[y].excess); }
  const signalDays = { is: 0, oos: 0 };
  sig.forEach((s, i) => { if (s && s.side && i + 1 < d.length) { const w = windowOf(d[i + 1].key); if (w) signalDays[w]++; } });
  return { usableDays: d.length, splitDays: sp.filter(Boolean).length, signalDays, baseline: { b5, b10, b5x2 }, S, tests, placebo, control, checks, years, verdict: pass ? 'PASS' : 'FAIL' };
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
    const out = { study: 'gold-tug-of-war', built: '2026-11-14', verdict: res.verdict,
      data: { src: 'OANDA mid H1 XAU/USD via the candle proxy (/md/bars), New York 17:00 days', from: d[0].key, to: d.at(-1).key, h1: rows.length },
      params: P, windows: { is: IS, oos: OOS }, costs: { roundTrip: P.cost, finLong: FIN.xau.long, finSrc: FIN.src }, ...rnd(res) };
    fs.writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'result.json'), JSON.stringify(out, null, 1) + '\n');
    const sm = (x) => ({ n: x.n, gross: x.gross, net: x.net, excess: x.excess, tNet: x.tNet, tExcess: x.tExcess, buy: x.buy.n, sell: x.sell.n });
    console.log(JSON.stringify({ verdict: out.verdict, signalDays: out.signalDays, tests: out.tests, checks: out.checks,
      placebo: { ...out.placebo, ts: undefined }, control: { ...out.control, ts: undefined },
      T: Object.fromEntries(['T1', 'T2', 'T3', 'x2'].map((k) => [k, { is: sm(out.S[k].is), oos: sm(out.S[k].oos) }])), base: out.baseline.b5 }, null, 1));
  }
}
