// Edge research · rsi2-pullback (PREREGISTRATION.md, committed first).
// The 2-day RSI pullback on US index CFDs: close above SMA200 and RSI(2) < 10 -> buy the next open; out at the next open
// after the first close above SMA5; stop 3 x ATR(20) below the fill. Net of spread and financing. Windows 2008-15 | 2016-now.
//   node run.mjs fetch <dir>   copies the council's daily candles + macro/cache.json out of council-data (git show, no network)
//   node run.mjs full <dir>    writes result.json next to this file
// Paper research: nothing here is read by the council, the mirror or the page.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const P = { SMA_LONG: 200, SMA_EXIT: 5, RSI_N: 2, RSI_MAX: 10, ATR_N: 20, STOP_ATR: 3, FIN_ADD: 2.5, SEEDS: 40 };
export const MARKETS = { spx500: { cost: 1.0 }, nas100: { cost: 3.0 }, us30: { cost: 4.0 } };
export const WINDOWS = { A: ['2008-01-01', '2015-12-31'], B: ['2016-01-01', '2099-12-31'] };
const DAY = 86400, T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const r3 = (v) => (Number.isFinite(v) ? +v.toFixed(3) : null);
const r2 = (v) => (Number.isFinite(v) ? +v.toFixed(2) : null);

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
// Wilder RSI: seed = simple mean of the first n changes, then avg = (avg x (n-1) + change) / n
export function rsi(closes, n = P.RSI_N) {
  const out = new Array(closes.length).fill(null);
  let g = 0, l = 0;
  for (let i = 1; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1], up = Math.max(ch, 0), dn = Math.max(-ch, 0);
    if (i <= n) { g += up / n; l += dn / n; if (i < n) continue; }
    else { g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n; }
    out[i] = l === 0 ? (g === 0 ? 50 : 100) : 100 - 100 / (1 + g / l);
  }
  return out;
}
export function atr(D, i, n = P.ATR_N) {
  if (i < n) return null;
  let a = 0;
  for (let j = i - n + 1; j <= i; j++) a += Math.max(D[j].high - D[j].low, Math.abs(D[j].high - D[j - 1].close), Math.abs(D[j].low - D[j - 1].close));
  return a / n;
}
// calendar nights between the entry day and the exit day (Friday -> Monday = 3)
export const nights = (tIn, tOut) => Math.max(0, Math.round((tOut - tIn) / DAY));
// last rate dated on or before t (rates = [['YYYY-MM-DD', pct], …] sorted)
export function rateAt(rates, t) {
  const d = ymd(t); let v = null;
  for (const [k, x] of rates) { if (k <= d) v = x; else break; }
  return v;
}

// ── the rule. Returns trades { i, j, entry, exit, why, stop, risk, nights }; a signal on i fills at i+1's open. ──
export function simulate(D, { first = 0 } = {}) {
  const s200 = sma(D, P.SMA_LONG), s5 = sma(D, P.SMA_EXIT), rs = rsi(D.map((b) => b.close));
  const out = [];
  let pos = null;
  for (let i = Math.max(first, P.SMA_LONG); i < D.length; i++) {
    const b = D[i];
    if (pos && pos.exitNext) { out.push(close(pos, i, b.open, 'sma5')); pos = null; }
    if (pos) {
      if (b.low <= pos.stop) { out.push(close(pos, i, Math.min(b.open, pos.stop), 'stop')); pos = null; }
      else if (s5[i] != null && b.close > s5[i]) pos.exitNext = true;
    }
    if (!pos && i + 1 < D.length && s200[i] != null && rs[i] != null && b.close > s200[i] && rs[i] < P.RSI_MAX) {
      const A = atr(D, i);
      if (A > 0) {
        const n = D[i + 1], risk = P.STOP_ATR * A;
        pos = { i: i + 1, sig: i, entry: n.open, stop: n.open - risk, risk };
        // the entry day: stop, then the close against SMA5 (handled when the loop reaches i+1)
      }
    }
  }
  if (pos) { const L = D.length - 1; out.push(close(pos, L, D[L].close, 'end')); }
  return out;
  function close(p, j, px, why) { return { sig: p.sig, i: p.i, j, entry: p.entry, exit: px, why, stop: p.stop, risk: p.risk, tIn: D[p.i].time, tOut: D[j].time, hold: j - p.i }; }
}
// NOTE on the loop order: a position opened on day i+1 is checked on day i+1 itself (stop, then the close > SMA5),
// because the next iteration processes i+1 with pos set and pos.exitNext unset.

// net of costs: spread points a round trip, financing (DGS2 + 2.5 %) / 365 x entry per night
export function net(tr, cost, rates) {
  const rate = rateAt(rates, tr.tIn), nt = nights(tr.tIn, tr.tOut);
  const fin = nt * ((rate ?? 0) + P.FIN_ADD) / 100 / 365 * tr.entry;
  const pts = tr.exit - tr.entry - cost - fin;
  return { ...tr, nights: nt, rate, fin, gross: (tr.exit - tr.entry) / tr.entry * 100, ret: pts / tr.entry * 100, R: pts / tr.risk };
}

// ── statistics ──
export function tstat(xs) {
  const n = xs.length; if (n < 2) return null;
  const m = xs.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1));
  return sd > 0 ? m / (sd / Math.sqrt(n)) : null;
}
export function monthSums(trades, from, to) {
  const m = new Map();
  for (let d = new Date(from + 'T00:00:00Z'); ymd(d / 1000) <= to; d.setUTCMonth(d.getUTCMonth() + 1)) m.set(ymd(d / 1000).slice(0, 7), 0);
  for (const t of trades) { const k = ymd(t.tOut).slice(0, 7); if (m.has(k)) m.set(k, m.get(k) + t.ret); }
  return [...m.values()];
}
const normP = (t) => { // one-sided P(Z > t)
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
  const rets = tr.map((t) => t.ret), Rs = tr.map((t) => t.R), n = tr.length;
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  let eq = 0, pk = 0, dd = 0; for (const x of Rs) { eq += x; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  return {
    n, avgRet: r3(mean(rets)), avgGross: r3(mean(tr.map((t) => t.gross))), avgR: r3(mean(Rs)), totalR: r2(Rs.reduce((a, b) => a + b, 0)),
    wr: n ? r2(100 * tr.filter((t) => t.ret > 0).length / n) : null, tTrades: r2(tstat(rets)), tMonths: r2(tstat(monthSums(tr, from, to))),
    stops: tr.filter((t) => t.why === 'stop').length, avgHold: r2(mean(tr.map((t) => t.hold))), avgNights: r2(mean(tr.map((t) => t.nights))),
    finPct: r3(mean(tr.map((t) => t.fin / t.entry * 100))), ddR: r2(dd),
  };
}

// ── placebo: same count, same holds, random eligible days (close > SMA200), same stop and costs ──
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6D2B79F5) >>> 0; let x = s; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
export function placebo(D, real, cost, rates, from, to, seed) {
  const s200 = sma(D, P.SMA_LONG), lo = T(from), hi = T(to) + DAY - 1, R = rng(seed);
  const elig = []; for (let i = P.SMA_LONG; i < D.length - 1; i++) if (D[i].time >= lo && D[i].time <= hi && D[i].close > s200[i] && atr(D, i) > 0) elig.push(i);
  const out = [];
  for (const tr of real) {
    const i = elig[Math.floor(R() * elig.length)], e = i + 1, risk = P.STOP_ATR * atr(D, i), entry = D[e].open, stop = entry - risk;
    const jEnd = Math.min(D.length - 1, e + tr.hold);
    let j = jEnd, exit = D[jEnd].open, why = 'hold';
    if (tr.hold === 0) { exit = D[e].close; }
    for (let k = e; k < jEnd || (tr.hold === 0 && k === e); k++) { if (D[k].low <= stop) { j = k; exit = Math.min(D[k].open, stop); why = 'stop'; break; } if (tr.hold === 0) break; }
    out.push(net({ i: e, j, entry, exit, why, stop, risk, tIn: D[e].time, tOut: D[j].time, hold: j - e }, cost, rates));
  }
  return out.reduce((a, t) => a + t.ret, 0) / out.length;
}
export const pct = (xs, q) => { const s = [...xs].sort((a, b) => a - b), h = (s.length - 1) * q, f = Math.floor(h); return s[f] + (s[Math.min(f + 1, s.length - 1)] - s[f]) * (h - f); };

// ── the study ──
export function study(data, rates) {
  const markets = {}, ps = [];
  for (const [k, m] of Object.entries(MARKETS)) {
    const D = candles(data[k].rows), all = simulate(D).map((t) => net(t, m.cost, rates));
    const win = {};
    for (const [w, [from, to0]] of Object.entries(WINDOWS)) {
      const to = to0 > ymd(D.at(-1).time) ? ymd(D.at(-1).time) : to0;
      const tr = all.filter((t) => t.tIn >= T(from) && t.tIn <= T(to) + DAY - 1);
      win[w] = { from, to, ...summary(tr, from, to) };
      if (w === 'B') {
        const seeds = [...Array(P.SEEDS)].map((_, s) => placebo(D, tr, m.cost, rates, from, to, s + 1));
        win.B.placebo = { seeds: P.SEEDS, mean: r3(seeds.reduce((a, b) => a + b, 0) / seeds.length), p95: r3(pct(seeds, 0.95)) };
        win.B.p = +normP(tstat(tr.map((t) => t.ret)) ?? 0).toFixed(4);
        ps.push(win.B.p);
      }
    }
    markets[k] = { cost: m.cost, data: { from: ymd(D[0].time), to: ymd(D.at(-1).time), days: D.length }, ...win, years: byYear(all) };
  }
  const h = holm(ps);
  let any = false;
  Object.values(markets).forEach((m, i) => {
    const B = m.B;
    m.checks = { positive: B.avgRet > 0, tTrades: B.tTrades >= 2, tMonths: B.tMonths >= 2, placebo: B.avgRet > B.placebo.p95, holm: h[i].pass };
    m.holmP = +h[i].adj.toFixed(4);
    m.pass = Object.values(m.checks).every(Boolean);
    any = any || m.pass;
  });
  return { verdict: any ? 'PASS' : 'FAIL', markets };
}
function byYear(tr) {
  const y = {};
  for (const t of tr) { const k = ymd(t.tIn).slice(0, 4); (y[k] ||= []).push(t); }
  return Object.fromEntries(Object.entries(y).map(([k, v]) => [k, { n: v.length, sumRet: r2(v.reduce((a, t) => a + t.ret, 0)), sumR: r2(v.reduce((a, t) => a + t.R, 0)) }]));
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
      built: '2026-11-13', title: 'The 2-day RSI pullback on US index CFDs, out of the book\'s sample', verdict: r.verdict,
      system: 'Long when close > SMA200 and Wilder RSI(2) < 10 (OANDA daily close), fill next open; exit next open after the first close > SMA5; stop 3 x ATR(20)',
      costs: { spreadPoints: Object.fromEntries(Object.entries(MARKETS).map(([k, m]) => [k, m.cost])), financing: 'DGS2 + 2.5 % a year, per calendar night' },
      src: 'OANDA mid daily candles, council-data research/daily/<key>.json; DGS2 from council-data macro/cache.json',
      windows: WINDOWS, markets: r.markets,
    };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    console.log(JSON.stringify(Object.fromEntries(Object.entries(r.markets).map(([k, m]) => [k, { A: m.A, B: m.B, checks: m.checks, holmP: m.holmP }])), null, 1), r.verdict);
  }
}
