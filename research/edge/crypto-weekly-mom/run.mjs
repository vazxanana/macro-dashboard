// Weekly time-series momentum in crypto, out of sample (research/edge/crypto-weekly-mom). Paper research only.
// The rule, sizing, stop, costs, windows and pass bar are fixed in PREREGISTRATION.md (committed before this file).
// Usage (repo root, after `git fetch origin council-data`): node research/edge/crypto-weekly-mom/run.mjs
// Reads the Binance daily cache from origin/council-data with `git show` (or $CT_DATA/<SYM>_1d.json.gz), writes result.json.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { CFD_CRYPTO } from '../../../council/fills.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const DAY = 86400, WEEK = 7 * DAY;

export const P = {
  coins: { btc: 'BTCUSDT', eth: 'ETHUSDT', sol: 'SOLUSDT', xrp: 'XRPUSDT' },
  volTarget: 0.40, cap: 2, span: 30, minCandles: 60, atrN: 14, atrK: 3, cost: CFD_CRYPTO,
  // financing, % a year as a fraction (ctrader/symbols.json of 13 Nov 2026, swap type 1; XRP not offered: 15 % assumed)
  fin: { btc: { long: 0.15, short: 0.075 }, eth: { long: 0.15, short: 0.10 }, sol: { long: 0.15, short: 0.15 }, xrp: { long: 0.15, short: 0.15 } },
  windows: { early: ['2018-01-01', '2021-12-31'], decisive: ['2022-01-03', '2099-01-01'] },
  seeds: 40,
};
export const ts = (s) => Math.floor(Date.parse(s + 'T00:00:00Z') / 1000);
export const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);

export function loadCoin(sym) {
  const buf = process.env.CT_DATA ? fs.readFileSync(path.join(process.env.CT_DATA, `${sym}_1d.json.gz`))
    : execFileSync('git', ['show', `origin/council-data:research/candles/crypto1d/${sym}_1d.json.gz`], { maxBuffer: 1 << 28 });
  return JSON.parse(zlib.gunzipSync(buf)).map((x) => ({ time: x[0], open: +x[1], high: +x[2], low: +x[3], close: +x[4] }));
}

// annualised EWMA volatility through candle i (span 30: lambda = 1 - 2/31; seeded with the variance of the first 30 log returns)
export function ewmaVol(D, span = P.span) {
  const lam = 1 - 2 / (span + 1), out = new Array(D.length).fill(null);
  if (D.length <= span) return out;
  const r = D.map((b, i) => (i ? Math.log(b.close / D[i - 1].close) : 0));
  let v = 0; for (let i = 1; i <= span; i++) v += r[i] ** 2; v /= span;
  out[span] = Math.sqrt(v * 365);
  for (let i = span + 1; i < D.length; i++) { v = lam * v + (1 - lam) * r[i] ** 2; out[i] = Math.sqrt(v * 365); }
  return out;
}
// ATR(n): simple mean of the true range of candles i-n+1..i (closed candles only)
export function atr(D, i, n = P.atrN) {
  if (i < n) return null;
  let s = 0;
  for (let j = i - n + 1; j <= i; j++) s += Math.max(D[j].high - D[j].low, Math.abs(D[j].high - D[j - 1].close), Math.abs(D[j].low - D[j - 1].close));
  return s / n;
}
// the signal for the week opening on Monday candle iMon: Sunday close (iMon-1) over the previous Sunday close (iMon-8)
export function weekSignal(D, iMon) {
  if (iMon < 8 || D[iMon - 1].time !== D[iMon].time - DAY || D[iMon - 8].time !== D[iMon].time - 8 * DAY) return null;
  return D[iMon - 1].close / D[iMon - 8].close - 1;
}
export const sideOf = (sig, variant) => (sig > 0 ? 1 : sig < 0 && variant === 'V2' ? -1 : 0);
export const weightOf = (vol) => (vol > 0 ? Math.min(P.cap, P.volTarget / vol) : 0);

// one week held from the Monday open with a stop atrK x ATR away; out at the stop or at the next Monday open
export function simWeek(D, iMon, side, stopDist) {
  const entry = D[iMon].open, stop = entry - side * stopDist;
  for (let k = iMon; k < iMon + 7; k++) {
    const b = D[k];
    if (side > 0 && b.low <= stop) return { entry, stop, exit: Math.min(b.open, stop), nights: k - iMon, stopped: true };
    if (side < 0 && b.high >= stop) return { entry, stop, exit: Math.max(b.open, stop), nights: k - iMon, stopped: true };
  }
  return { entry, stop, exit: D[iMon + 7].open, nights: 7, stopped: false };
}

// mulberry32, for the placebo's random signs
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// the whole book, week by week. signFn(coin, iMon, sig) -> side (default: the rule's own)
export function book(data, variant, signFn = null) {
  const coins = Object.keys(data), idx = {}, vol = {};
  for (const c of coins) { idx[c] = new Map(data[c].map((b, i) => [b.time, i])); vol[c] = ewmaVol(data[c]); }
  const btc = data.btc, weeks = [], prevW = {};
  for (const b of btc) {
    if (new Date(b.time * 1000).getUTCDay() !== 1) continue;
    const T = b.time, avail = [];
    for (const c of coins) {
      const D = data[c], i = idx[c].get(T);
      if (i == null || i < P.minCandles || !idx[c].has(T + WEEK)) continue;
      const sig = weekSignal(D, i), v = vol[c][i - 1], a = atr(D, i - 1);
      if (sig == null || v == null || a == null) continue;
      avail.push({ c, i, sig, v, a });
    }
    if (!avail.length || !idx.btc.has(T + WEEK)) continue;
    const N = avail.length, row = { t: T, n: N, ret: 0, gross: 0, cost: 0, fin: 0, turnCost: 0, bh: 0, coins: {} };
    for (const x of avail) {
      const D = data[x.c], side = signFn ? signFn(x.c, x.i, x.sig) : sideOf(x.sig, variant), w = weightOf(x.v) / N;
      row.bh += (D[x.i + 7].open / D[x.i].open - 1) / N;
      let r = 0, g = 0, cost = 0, fin = 0, endW = 0, stopped = false;
      if (side !== 0) {
        const s = simWeek(D, x.i, side, P.atrK * x.a), raw = side * (s.exit / s.entry - 1);
        g = w * raw; cost = w * P.cost; fin = w * P.fin[x.c][side > 0 ? 'long' : 'short'] * s.nights / 365;
        r = g - cost - fin; stopped = s.stopped; endW = stopped ? 0 : side * w;
        if (stopped) row.turnCost += w * P.cost / 2;
      }
      // turnover-only cost (reported, not tested): half a round trip on the change of signed weight at the Monday open
      row.turnCost += Math.abs(side * w - (prevW[x.c] || 0)) * P.cost / 2;
      prevW[x.c] = endW;
      row.ret += r; row.gross += g; row.cost += cost; row.fin += fin;
      row.coins[x.c] = { side, w: +w.toFixed(4), r, g, stopped };
    }
    for (const c of coins) if (!avail.find((x) => x.c === c)) prevW[c] = 0;
    row.turnRet = row.gross - row.turnCost - row.fin;
    weeks.push(row);
  }
  return weeks;
}

// ── statistics ──
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const sd = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)) : 0; };
export const sharpe = (r) => (sd(r) > 0 ? (mean(r) / sd(r)) * Math.sqrt(52) : 0);
export function monthT(weeks, key = 'ret') {
  const m = new Map();
  for (const w of weeks) { const k = day(w.t).slice(0, 7); m.set(k, (m.get(k) || 0) + w[key]); }
  const s = [...m.values()];
  return { months: s.length, t: sd(s) > 0 ? mean(s) / (sd(s) / Math.sqrt(s.length)) : 0 };
}
export const phi = (z) => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };
export function holm(ps) {
  const o = ps.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p), adj = new Array(ps.length); let run = 0;
  o.forEach((x, k) => { run = Math.max(run, Math.min(1, x.p * (ps.length - k))); adj[x.i] = run; });
  return adj;
}
export function maxDD(r) { let eq = 1, pk = 1, dd = 0; for (const x of r) { eq *= 1 + x; pk = Math.max(pk, eq); dd = Math.min(dd, eq / pk - 1); } return dd; }
export function summary(weeks, key = 'ret') {
  const r = weeks.map((w) => w[key]), mt = monthT(weeks, key);
  return { weeks: r.length, ann: +(mean(r) * 52).toFixed(4), vol: +(sd(r) * Math.sqrt(52)).toFixed(4), sharpe: +sharpe(r).toFixed(3), monthT: +mt.t.toFixed(2), months: mt.months, maxDD: +maxDD(r).toFixed(4) };
}
export const inWin = (weeks, [a, b]) => weeks.filter((w) => w.t >= ts(a) && w.t <= ts(b));

function main() {
  const data = {}; for (const [c, s] of Object.entries(P.coins)) data[c] = loadCoin(s);
  const R = { built: '2026-11-13', verdict: null, system: 'Weekly time-series momentum on BTC, ETH, SOL, XRP (Binance daily, CFD costs and financing)', prereg: 'PREREGISTRATION.md', data: {}, variants: {}, bh: {}, tests: {} };
  for (const c of Object.keys(data)) R.data[c] = { from: day(data[c][0].time), to: day(data[c].at(-1).time), candles: data[c].length };
  const decW = P.windows.decisive, early = P.windows.early;
  const bhWeeks = book(data, 'V1');
  const bh = (win) => summary(inWin(bhWeeks, win), 'bh');
  R.bh = { early: bh(early), decisive: bh(decW) };
  const ps = [];
  for (const v of ['V1', 'V2']) {
    const W = book(data, v), dec = inWin(W, decW), yrs = {};
    for (const w of W) { const y = day(w.t).slice(0, 4); (yrs[y] ||= []).push(w); }
    const coinRows = {};
    for (const c of Object.keys(data)) { const cw = dec.filter((w) => w.coins[c]).map((w) => ({ t: w.t, ret: w.coins[c].r })); coinRows[c] = summary(cw); }
    const placebo = [];
    for (let s = 1; s <= P.seeds; s++) {
      const rnd = rng(s), sign = () => (v === 'V1' ? (rnd() < 0.5 ? 1 : 0) : rnd() < 0.5 ? 1 : -1);
      placebo.push(+sharpe(inWin(book(data, v, sign), decW).map((w) => w.ret)).toFixed(3));
    }
    const S = summary(dec), beats = placebo.filter((x) => S.sharpe > x).length;
    const exposure = dec.length ? +(mean(dec.map((w) => Object.values(w.coins).filter((x) => x.side !== 0).length / w.n))).toFixed(3) : 0;
    R.variants[v] = {
      early: summary(inWin(W, early)), decisive: S, decisiveGross: summary(dec, 'gross'), decisiveTurnover: summary(dec, 'turnRet'),
      costs: { costPerYear: +(mean(dec.map((w) => w.cost)) * 52).toFixed(4), finPerYear: +(mean(dec.map((w) => w.fin)) * 52).toFixed(4) },
      exposure, stops: dec.reduce((s, w) => s + Object.values(w.coins).filter((x) => x.stopped).length, 0),
      positions: dec.reduce((s, w) => s + Object.values(w.coins).filter((x) => x.side !== 0).length, 0),
      byYear: Object.fromEntries(Object.entries(yrs).map(([y, a]) => [y, summary(a)])), byCoin: coinRows,
      placebo: { sharpes: placebo, beats, of: P.seeds, p95: [...placebo].sort((a, b) => a - b)[Math.ceil(0.95 * P.seeds) - 1] },
    };
    ps.push(1 - phi(S.monthT));
  }
  const adj = holm(ps);
  ['V1', 'V2'].forEach((v, k) => {
    const S = R.variants[v].decisive, pl = R.variants[v].placebo;
    const c = { beatsBH: S.sharpe > R.bh.decisive.sharpe, over05: S.sharpe > 0.5, t2: S.monthT >= 2, holm: adj[k] < 0.05, placebo: pl.beats >= 38 };
    R.tests[v] = { ...c, p: +ps[k].toFixed(4), pHolm: +adj[k].toFixed(4), pass: Object.values(c).every(Boolean) };
  });
  R.verdict = R.tests.V1.pass || R.tests.V2.pass ? 'PASS' : 'FAIL';
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  console.log(JSON.stringify({ verdict: R.verdict, bh: R.bh, V1: { ...R.variants.V1, byYear: undefined, placebo: { beats: R.variants.V1.placebo.beats, p95: R.variants.V1.placebo.p95 } }, V2: { ...R.variants.V2, byYear: undefined, placebo: { beats: R.variants.V2.placebo.beats, p95: R.variants.V2.placebo.p95 } }, tests: R.tests }, null, 1));
  for (const v of ['V1', 'V2']) console.log(v, Object.entries(R.variants[v].byYear).map(([y, s]) => `${y} ${s.ann} sh ${s.sharpe}`).join(' | '));
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
