// Edge research · vol-spike-rebound (PREREGISTRATION.md, committed first).
// Buy US index CFDs after a realised-volatility spike: RV5 > 2 x its 120-day median (past values only) and close < SMA20
// -> buy the next open; hold 5 (variant 10) trading days, out at that close; stop 3 x ATR(20) below the fill.
// Net of spread and financing. Windows 2008-15 | 2016-now (decisive). Pooled over SPX500, NAS100, US30; Holm over 2 holds.
//   node run.mjs fetch <dir>   copies the council's daily candles + macro/cache.json out of council-data (git show, no network)
//   node run.mjs full <dir>    writes result.json next to this file
// Paper research: nothing here is read by the council, the mirror or the page. Candle, stop, spread and financing code is a
// copy of research/edge/rsi2-pullback/run.mjs (not imported).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const P = { RV_N: 5, MED_N: 120, MULT: 2, SMA_N: 20, ATR_N: 20, STOP_ATR: 3, FIN_ADD: 2.5, SEEDS: 40, MIN_N: 40 };
export const HOLDS = [5, 10];
export const MARKETS = { spx500: { cost: 1.0 }, nas100: { cost: 3.0 }, us30: { cost: 4.0 } };
export const WINDOWS = { A: ['2008-01-01', '2015-12-31'], B: ['2016-01-01', '2099-12-31'] };
const DAY = 86400, T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const r3 = (v) => (Number.isFinite(v) ? +v.toFixed(3) : null);
const r2 = (v) => (Number.isFinite(v) ? +v.toFixed(2) : null);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// ── candles: rows [t, o, h, l, c, v] -> weekday candles ──
export function candles(rows) {
  return rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }))
    .filter((b) => { const d = new Date(b.time * 1000).getUTCDay(); return d !== 0 && d !== 6; })
    .sort((a, b) => a.time - b.time);
}

// ── indicators (each value at i reads candles 0..i only) ──
export function sma(D, n) {
  const out = new Array(D.length).fill(null); let s = 0;
  for (let i = 0; i < D.length; i++) { s += D[i].close; if (i >= n) s -= D[i - n].close; if (i >= n - 1) out[i] = s / n; }
  return out;
}
// RV(i): sample sd of the n log returns ending at i, x sqrt(252)
export function rv(D, n = P.RV_N) {
  const out = new Array(D.length).fill(null);
  for (let i = n; i < D.length; i++) {
    const r = []; for (let k = i - n + 1; k <= i; k++) r.push(Math.log(D[k].close / D[k - 1].close));
    const m = mean(r); out[i] = Math.sqrt(r.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1)) * Math.sqrt(252);
  }
  return out;
}
export function median(xs) { const s = [...xs].sort((a, b) => a - b), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; }
// MED(i): median of v(i-n) .. v(i-1): the values BEFORE i (null until all n exist)
export function pastMedian(v, n = P.MED_N) {
  const out = new Array(v.length).fill(null);
  for (let i = n; i < v.length; i++) { const w = v.slice(i - n, i); if (w.every((x) => x != null)) out[i] = median(w); }
  return out;
}
export function atr(D, i, n = P.ATR_N) {
  if (i < n) return null;
  let a = 0;
  for (let j = i - n + 1; j <= i; j++) a += Math.max(D[j].high - D[j].low, Math.abs(D[j].high - D[j - 1].close), Math.abs(D[j].low - D[j - 1].close));
  return a / n;
}
export const nights = (tIn, tOut) => Math.max(0, Math.round((tOut - tIn) / DAY));
export function rateAt(rates, t) {
  const d = ymd(t); let v = null;
  for (const [k, x] of rates) { if (k <= d) v = x; else break; }
  return v;
}
export function signals(D) {
  const v = rv(D), md = pastMedian(v), s20 = sma(D, P.SMA_N);
  return D.map((b, i) => v[i] != null && md[i] != null && s20[i] != null && v[i] > P.MULT * md[i] && b.close < s20[i]);
}

// one trade from fill index e: stop checked from the entry day, time exit at the close of e + hold - 1
export function hold(D, e, risk, H) {
  const entry = D[e].open, stop = entry - risk, last = Math.min(D.length - 1, e + H - 1);
  for (let k = e; k <= last; k++) if (D[k].low <= stop) return { j: k, exit: Math.min(D[k].open, stop), why: 'stop', stop, entry };
  return { j: last, exit: D[last].close, why: last === e + H - 1 ? 'time' : 'end', stop, entry };
}

// ── the rule. Trades { sig, i, j, entry, exit, why, stop, risk, tIn, tOut, hold } ──
export function simulate(D, H = 5) {
  const sig = signals(D), out = [];
  let flatFrom = 0; // first signal index allowed (a trade exiting at the close of j allows a signal on j)
  for (let i = 0; i + 1 < D.length; i++) {
    if (i < flatFrom || !sig[i]) continue;
    const A = atr(D, i); if (!(A > 0)) continue;
    const risk = P.STOP_ATR * A, e = i + 1, x = hold(D, e, risk, H);
    out.push({ sig: i, i: e, j: x.j, entry: x.entry, exit: x.exit, why: x.why, stop: x.stop, risk, tIn: D[e].time, tOut: D[x.j].time, hold: x.j - e + 1 });
    flatFrom = x.j;
  }
  return out;
}

export function net(tr, cost, rates) {
  const rate = rateAt(rates, tr.tIn), nt = nights(tr.tIn, tr.tOut);
  const fin = nt * ((rate ?? 0) + P.FIN_ADD) / 100 / 365 * tr.entry;
  const pts = tr.exit - tr.entry - cost - fin;
  return { ...tr, nights: nt, rate, fin, gross: (tr.exit - tr.entry) / tr.entry * 100, ret: pts / tr.entry * 100, R: pts / tr.risk };
}

// ── statistics ──
export function tstat(xs) {
  const n = xs.length; if (n < 2) return null;
  const m = mean(xs), sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1));
  return sd > 0 ? m / (sd / Math.sqrt(n)) : null;
}
export function monthSums(trades, from, to) {
  const m = new Map();
  for (let d = new Date(from + 'T00:00:00Z'); ymd(d / 1000) <= to; d.setUTCMonth(d.getUTCMonth() + 1)) m.set(ymd(d / 1000).slice(0, 7), 0);
  for (const t of trades) { const k = ymd(t.tOut).slice(0, 7); if (m.has(k)) m.set(k, m.get(k) + t.R); }
  return [...m.values()];
}
export const normP = (t) => { // one-sided P(Z > t)
  const z = Math.abs(t), k = 1 / (1 + 0.2316419 * z), d = 0.3989422804014327 * Math.exp(-z * z / 2);
  const p = d * k * (0.31938153 + k * (-0.356563782 + k * (1.781477937 + k * (-1.821255978 + k * 1.330274429))));
  return t >= 0 ? p : 1 - p;
};
export function holm(ps, alpha = 0.05) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = new Array(ps.length);
  let run = 0;
  idx.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, p * (ps.length - r))); adj[i] = run; });
  return adj.map((a) => ({ adj: a, pass: a < alpha }));
}
export function summary(tr, from, to) {
  const Rs = tr.map((t) => t.R), n = tr.length;
  let eq = 0, pk = 0, dd = 0; for (const x of [...tr].sort((a, b) => a.tOut - b.tOut).map((t) => t.R)) { eq += x; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  return {
    n, avgRet: r3(mean(tr.map((t) => t.ret))), avgGross: r3(mean(tr.map((t) => t.gross))), avgR: r3(mean(Rs)), totalR: r2(Rs.reduce((a, b) => a + b, 0)),
    wr: n ? r2(100 * tr.filter((t) => t.R > 0).length / n) : null, tTrades: r2(tstat(Rs)), tMonths: r2(tstat(monthSums(tr, from, to))),
    stops: tr.filter((t) => t.why === 'stop').length, avgNights: r2(mean(tr.map((t) => t.nights))), ddR: r2(dd),
  };
}

// ── random entries: same count per market, same hold, same stop and costs, uniform signal days in the window ──
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6D2B79F5) >>> 0; let x = s; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
export function randomTrades(D, count, H, cost, rates, from, to, R) {
  const lo = T(from), hi = T(to) + DAY - 1, elig = [];
  for (let i = P.ATR_N; i < D.length - 1; i++) if (D[i + 1].time >= lo && D[i + 1].time <= hi && atr(D, i) > 0) elig.push(i);
  const out = [];
  for (let c = 0; c < count; c++) {
    const i = elig[Math.floor(R() * elig.length)], risk = P.STOP_ATR * atr(D, i), x = hold(D, i + 1, risk, H);
    out.push(net({ i: i + 1, j: x.j, entry: x.entry, exit: x.exit, why: x.why, stop: x.stop, risk, tIn: D[i + 1].time, tOut: D[x.j].time, hold: x.j - i }, cost, rates));
  }
  return out;
}
export const pct = (xs, q) => { const s = [...xs].sort((a, b) => a - b), h = (s.length - 1) * q, f = Math.floor(h); return s[f] + (s[Math.min(f + 1, s.length - 1)] - s[f]) * (h - f); };

// ── the study ──
export function study(data, rates) {
  const Ds = Object.fromEntries(Object.keys(MARKETS).map((k) => [k, candles(data[k].rows)]));
  const lastDay = ymd(Math.min(...Object.values(Ds).map((D) => D.at(-1).time)));
  const win = (w) => [WINDOWS[w][0], WINDOWS[w][1] > lastDay ? lastDay : WINDOWS[w][1]];
  const inW = (t, [from, to]) => t.tIn >= T(from) && t.tIn <= T(to) + DAY - 1;
  const holds = {}, ps = [];
  for (const H of HOLDS) {
    const per = {}, pool = { A: [], B: [] };
    for (const [k, m] of Object.entries(MARKETS)) {
      const all = simulate(Ds[k], H).map((t) => net(t, m.cost, rates));
      per[k] = {};
      for (const w of ['A', 'B']) { const tr = all.filter((t) => inW(t, win(w))); pool[w].push(...tr); per[k][w] = { from: win(w)[0], to: win(w)[1], ...summary(tr, ...win(w)) }; }
      per[k].years = byYear(all);
    }
    const A = { from: win('A')[0], to: win('A')[1], ...summary(pool.A, ...win('A')) };
    const B = { from: win('B')[0], to: win('B')[1], ...summary(pool.B, ...win('B')) };
    B.p = +normP(tstat(pool.B.map((t) => t.R)) ?? 0).toFixed(4);
    ps.push(B.p);
    const seeds = [...Array(P.SEEDS)].map((_, s) => {
      const R = rng(1000 * H + s + 1), tr = [];
      for (const [k, m] of Object.entries(MARKETS)) tr.push(...randomTrades(Ds[k], per[k].B.n, H, m.cost, rates, ...win('B'), R));
      return mean(tr.map((t) => t.R));
    });
    B.random = { seeds: P.SEEDS, mean: r3(mean(seeds)), p95: r3(pct(seeds, 0.95)), above: seeds.filter((x) => B.avgR > x).length };
    // post-hoc diagnostic (not part of the bar): the three indices often signal in the same week, so pooled trades are
    // not independent. Sum net R by the entry's 7-day block and take t over those clusters.
    const cl = new Map(); for (const t of pool.B) { const k = Math.floor((t.tIn - 4 * DAY) / (7 * DAY)); cl.set(k, (cl.get(k) || 0) + t.R); }
    B.clusters = { by: 'entry week', n: cl.size, t: r2(tstat([...cl.values()])) };
    holds[H] = { A, B, markets: per };
  }
  const h = holm(ps);
  let any = false;
  HOLDS.forEach((H, i) => {
    const { A, B } = holds[H];
    B.holmP = +h[i].adj.toFixed(4);
    holds[H].checks = { n: B.n >= P.MIN_N, positive: B.avgR > 0, t: B.tTrades >= 2, holm: h[i].pass, sameSignA: A.avgR > 0 };
    holds[H].pass = Object.values(holds[H].checks).every(Boolean);
    holds[H].underRandom95 = B.avgR <= B.random.p95;
    any = any || holds[H].pass;
  });
  return { verdict: any ? 'PASS' : 'FAIL', lastDay, holds, data: Object.fromEntries(Object.entries(Ds).map(([k, D]) => [k, { from: ymd(D[0].time), to: ymd(D.at(-1).time), days: D.length }])) };
}
function byYear(tr) {
  const y = {};
  for (const t of tr) { const k = ymd(t.tIn).slice(0, 4); (y[k] ||= []).push(t); }
  return Object.fromEntries(Object.entries(y).map(([k, v]) => [k, { n: v.length, sumR: r2(v.reduce((a, t) => a + t.R, 0)) }]));
}

// ── CLI ──
const HERE = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, dir] = process.argv.slice(2);
  if (!dir) { console.error('usage: node run.mjs fetch|full <dir>'); process.exit(2); }
  if (mode === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    const show = (p) => execFileSync('git', ['show', `origin/council-data:${p}`], { cwd: HERE, maxBuffer: 1 << 28 });
    for (const k of Object.keys(MARKETS)) fs.writeFileSync(path.join(dir, k + '.json'), show(`research/daily/${k}.json`));
    fs.writeFileSync(path.join(dir, 'cache.json'), show('macro/cache.json'));
    console.log('fetched into', dir);
  } else if (mode === 'full') {
    const data = Object.fromEntries(Object.keys(MARKETS).map((k) => [k, JSON.parse(fs.readFileSync(path.join(dir, k + '.json')))]));
    const rates = JSON.parse(fs.readFileSync(path.join(dir, 'cache.json'))).score.fred.DGS2;
    const r = study(data, rates);
    const out = {
      built: '2026-11-13', title: 'Buy US index CFDs after a realised-volatility spike', verdict: r.verdict,
      system: 'Long when 5-day realised vol > 2 x its prior 120-day median and close < SMA20 (OANDA daily close), fill next open; hold 5 (variant 10) trading days to the close; stop 3 x ATR(20)',
      costs: { spreadPoints: Object.fromEntries(Object.entries(MARKETS).map(([k, m]) => [k, m.cost])), financing: 'DGS2 + 2.5 % a year, per calendar night' },
      src: 'OANDA mid daily candles, council-data research/daily/<key>.json; DGS2 from council-data macro/cache.json',
      windows: WINDOWS, data: r.data, holds: r.holds,
    };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    for (const H of HOLDS) { const x = r.holds[H]; console.log(H, JSON.stringify({ A: x.A, B: x.B, checks: x.checks })); }
    console.log(r.verdict);
  }
}
