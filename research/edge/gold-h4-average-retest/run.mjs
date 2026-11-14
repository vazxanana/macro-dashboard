// Gold back at its rising (falling) 50-day average after a run away from it, on H4 (PREREGISTRATION.md, pushed first)
//   node --use-env-proxy research/edge/gold-h4-average-retest/run.mjs fetch <file.json.gz>   OANDA mid H4 XAU through /md/bars
//   node research/edge/gold-h4-average-retest/run.mjs full <file.json.gz>                     the three tests, writes result.json
// A new stand-alone rule judged on 2017-26; not a gate, exit, entry or size of the gold book (item 44). Keep the candles out of git.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { nights, FIN } from '../../../council/fills.mjs';

export const P = { maN: 300, atrN: 42, slopeN: 30, band: 1, prior: 3, priorN: 120, stopAtr: 3, hold: 30, cost: 0.60, minN: 100,
  isFrom: '2007-01-01', isTo: '2016-12-31', oosFrom: '2017-01-01', oosTo: '2026-10-31', half: '2022-01-01', seeds: 40, needBeat: 38, ctrlSeed0: 101, alpha: 0.05, tMin: 2 };
export const TESTS = [
  { id: 'T1', name: 'buy the return to a rising average (primary)', sides: [1] },
  { id: 'T2', name: 'sell the return to a falling average', sides: [-1] },
  { id: 'T3', name: 'both sides as one stream', sides: [1, -1] },
];
const H4 = 14400;
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const r3 = (v) => (v == null ? null : +v.toFixed(3));

export const toBars = (rows) => rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));

// SMA, ATR and d of every candle; each value reads only its own and earlier candles
export function indicators(bs) {
  const n = bs.length, S = new Array(n).fill(null), A = new Array(n).fill(null), d = new Array(n).fill(null);
  let s = 0, a = 0;
  const tr = bs.map((b, i) => (i ? Math.max(b.high, bs[i - 1].close) - Math.min(b.low, bs[i - 1].close) : b.high - b.low));
  for (let i = 0; i < n; i++) {
    s += bs[i].close; if (i >= P.maN) s -= bs[i - P.maN].close; if (i >= P.maN - 1) S[i] = s / P.maN;
    if (i >= 1) { a += tr[i]; if (i > P.atrN) a -= tr[i - P.atrN]; if (i >= P.atrN) A[i] = a / P.atrN; }
    if (S[i] != null && A[i] > 0) d[i] = (bs[i].close - S[i]) / A[i];
  }
  return { S, A, d };
}

// side of a signal at candle i (+1 buy, -1 sell, 0 none)
export function signalAt(I, i) {
  const { S, d } = I;
  if (i < P.priorN || i < P.slopeN || d[i] == null || d[i - 1] == null || S[i - P.slopeN] == null) return 0;
  for (const side of [1, -1]) {
    if (side * (S[i] - S[i - P.slopeN]) <= 0) continue;
    const di = side * d[i], dp = side * d[i - 1];
    if (!(dp > P.band && di <= P.band && di > -P.band)) continue;
    let mx = -Infinity;
    for (let k = i - P.priorN; k < i; k++) { if (d[k] == null) { mx = -Infinity; break; } mx = Math.max(mx, side * d[k]); }
    if (mx >= P.prior) return side;
  }
  return 0;
}
export const signals = (I, n) => { const out = []; for (let i = 0; i < n; i++) { const s = signalAt(I, i); if (s) out.push({ i, side: s }); } return out; };

// one trade: signal at the close of candle i, entry at the open of i+1, stop 3 x ATR(i), out at the close of the 30th candle
export function trade(bs, I, i, side, costMult = 1) {
  const e = i + 1, atr = I.A[i];
  if (!(atr > 0) || e + P.hold - 1 >= bs.length) return null;
  const entry = bs[e].open, risk = P.stopAtr * atr, stop = entry - side * risk, last = e + P.hold - 1;
  let px = null, xi = last, why = 'time', xt = null;
  for (let j = e; j <= last; j++) {
    const b = bs[j];
    if (j > e && (side > 0 ? b.open <= stop : b.open >= stop)) { px = b.open; xi = j; why = 'gap'; xt = b.time; break; }
    if (side > 0 ? b.low <= stop : b.high >= stop) { px = stop; xi = j; why = 'stop'; xt = b.time + H4 / 2; break; }
  }
  if (px == null) { px = bs[last].close; xt = bs[last].time + H4; }
  const R = (px - entry) / risk * side, costR = P.cost * costMult / risk;
  const nn = side > 0 ? nights(bs[e].time, xt) : 0, finR = costMult * nn * FIN.xau.long * entry / risk;
  return { d: ymd(bs[e].time), si: i, ei: e, xi, side, entry, stop, exit: px, why, R, costR, nights: nn, finR, net: R - costR - finR };
}

export const inWin = (d, w) => d >= (w === 'is' ? P.isFrom : P.oosFrom) && d <= (w === 'is' ? P.isTo : P.oosTo);

// the same side entered at every candle of the window (overlap allowed): mean net R a trade
export function baseline(bs, I, side, w, costMult = 1) {
  let s = 0, n = 0;
  for (let i = 0; i < bs.length - 1; i++) {
    if (!inWin(ymd(bs[i + 1].time), w)) continue;
    const t = trade(bs, I, i, side, costMult); if (!t) continue;
    s += t.net; n++;
  }
  return { n, mean: n ? s / n : null };
}

export function monthSums(T, from, to, key = 'x') {
  const m = new Map();
  for (let y = +from.slice(0, 4), mo = +from.slice(5, 7); `${y}-${String(mo).padStart(2, '0')}` <= to.slice(0, 7); mo === 12 ? (y++, mo = 1) : mo++) m.set(`${y}-${String(mo).padStart(2, '0')}`, 0);
  for (const t of T) { const k = t.d.slice(0, 7); if (m.has(k)) m.set(k, m.get(k) + t[key]); }
  return [...m.values()];
}
export function tOf(xs) {
  const n = xs.length; if (n < 2) return null;
  const mu = xs.reduce((a, b) => a + b, 0) / n, v = xs.reduce((a, b) => a + (b - mu) ** 2, 0) / (n - 1);
  return v > 0 ? mu / Math.sqrt(v / n) : null;
}
const erf = (x) => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
export const pOne = (t) => (t == null ? 1 : 0.5 * (1 - erf(t / Math.SQRT2)));
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let run = 0;
  o.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (ps.length - k) * p)); out[i] = +run.toFixed(6); });
  return out;
}
export function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// rebuild a price path with the candles of each calendar year shuffled within that year (drift and volatility kept)
export function shuffledPath(bs, seed) {
  const rnd = mulberry32(seed), byY = new Map();
  const rel = bs.map((b, k) => (k ? { g: b.open / bs[k - 1].close, h: b.high / b.open, l: b.low / b.open, c: b.close / b.open } : null));
  for (let k = 1; k < bs.length; k++) { const y = new Date(bs[k].time * 1000).getUTCFullYear(); if (!byY.has(y)) byY.set(y, []); byY.get(y).push(k); }
  const pick = new Array(bs.length);
  for (const ks of byY.values()) { const p = ks.slice(); for (let a = p.length - 1; a > 0; a--) { const b = Math.floor(rnd() * (a + 1)); [p[a], p[b]] = [p[b], p[a]]; } ks.forEach((k, j) => { pick[k] = p[j]; }); }
  const out = [{ ...bs[0] }];
  for (let k = 1; k < bs.length; k++) { const r = rel[pick[k]], o = out[k - 1].close * r.g; out.push({ time: bs[k].time, open: o, high: o * r.h, low: o * r.l, close: o * r.c }); }
  return out;
}

const stat = (T, w, key = 'net') => {
  const n = T.length; if (!n) return { n: 0, mean: null, monthT: null, win: null };
  const m = monthSums(T, w === 'is' ? P.isFrom : P.oosFrom, w === 'is' ? P.isTo : P.oosTo, key);
  return { n, mean: r3(T.reduce((a, t) => a + t[key], 0) / n), monthT: r3(tOf(m)), win: r3(T.filter((t) => t.R > 0).length / n) };
};

// everything of one test on one path: trades per window with excess, baselines
export function evaluate(bs, I, test, costMult = 1, base = null) {
  const sig = signals(I, bs.length).filter((s) => test.sides.includes(s.side));
  const B = base || {};
  const out = {};
  for (const w of ['is', 'oos']) {
    for (const sd of test.sides) if (!B[`${w}${sd}`]) B[`${w}${sd}`] = baseline(bs, I, sd, w, costMult);
    const T = sig.map((s) => trade(bs, I, s.i, s.side, costMult)).filter((t) => t && inWin(t.d, w));
    for (const t of T) t.x = t.net - B[`${w}${t.side}`].mean;
    out[w] = T;
  }
  return { T: out, B };
}

// one position at a time (reported only)
export function oneAtATime(T) { const o = []; let busy = -1; for (const t of T) { if (t.ei <= busy) continue; o.push(t); busy = t.xi; } return o; }

function placebo(bs, I, T, B, seed) {
  const rnd = mulberry32(seed), cand = [];
  for (let i = 0; i < bs.length - 1; i++) if (inWin(ymd(bs[i + 1].time), 'oos')) cand.push(i);
  let s = 0, n = 0;
  for (const t of T) {
    let tr = null; for (let k = 0; k < 50 && !tr; k++) tr = trade(bs, I, cand[Math.floor(rnd() * cand.length)], t.side);
    if (tr) { s += tr.net - B[`oos${t.side}`].mean; n++; }
  }
  return n ? s / n : null;
}

export function full(file) {
  const bs = toBars(JSON.parse(zlib.gunzipSync(fs.readFileSync(file))));
  const I = indicators(bs);
  const res = { study: 'gold-h4-average-retest', built: '2026-11-14', data: { src: 'OANDA mid H4 XAU_USD via /md/bars (UTC-aligned)', candles: bs.length, from: ymd(bs[0].time), to: ymd(bs.at(-1).time) }, params: P, tests: {} };
  const allSig = signals(I, bs.length);
  res.signals = { is: { buy: 0, sell: 0 }, oos: { buy: 0, sell: 0 } };
  for (const s of allSig) { const d = ymd(bs[s.i].time); for (const w of ['is', 'oos']) if (inWin(d, w)) res.signals[w][s.side > 0 ? 'buy' : 'sell']++; }
  const base = {};
  const ctrlPaths = [];
  for (let k = 0; k < P.seeds; k++) { const cb = shuffledPath(bs, P.ctrlSeed0 + k); ctrlPaths.push({ cb, cI: indicators(cb), base: {} }); }
  for (const test of TESTS) {
    const { T, B } = evaluate(bs, I, test, 1, base);
    const T2x = evaluate(bs, I, test, 2).T;
    const g = { name: test.name, baseline: {} };
    for (const sd of test.sides) for (const w of ['is', 'oos']) g.baseline[`${w}${sd > 0 ? 'Buy' : 'Sell'}`] = { n: B[`${w}${sd}`].n, mean: r3(B[`${w}${sd}`].mean) };
    for (const w of ['is', 'oos']) {
      g[w] = { excess: stat(T[w], w, 'x'), net: stat(T[w], w, 'net'), gross: stat(T[w], w, 'R') };
      g[w].excess.p = r3(pOne(tOf(monthSums(T[w], w === 'is' ? P.isFrom : P.oosFrom, w === 'is' ? P.isTo : P.oosTo, 'x'))));
      const one = oneAtATime(T[w]); g[w].oneAtATime = stat(one, w, 'net');
    }
    g.oos2x = stat(T2x.oos, 'oos', 'net');
    g.halves = { a: stat(T.oos.filter((t) => t.d < P.half), 'oos', 'net'), b: stat(T.oos.filter((t) => t.d >= P.half), 'oos', 'net') };
    g.why = Object.fromEntries(['stop', 'gap', 'time'].map((k) => [k, T.oos.filter((t) => t.why === k).length]));
    const ruleX = T.oos.length ? T.oos.reduce((a, t) => a + t.x, 0) / T.oos.length : null;
    const pl = []; for (let s = 1; s <= P.seeds; s++) pl.push(placebo(bs, I, T.oos, B, s));
    const ct = ctrlPaths.map((c) => { const e = evaluate(c.cb, c.cI, test, 1, c.base).T.oos; return e.length ? e.reduce((a, t) => a + t.x, 0) / e.length : null; });
    const sumr = (arr) => { const v = arr.filter((x) => x != null).sort((a, b) => a - b); return { beaten: ruleX == null ? 0 : v.filter((x) => ruleX > x).length, median: r3(v[Math.floor(v.length / 2)]), p5: r3(v[Math.floor(v.length * 0.05)]), p95: r3(v[Math.floor(v.length * 0.95)]), nMean: null }; };
    g.placebo = sumr(pl); g.control = sumr(ct);
    g.control.nMean = r3(ctrlPaths.reduce((a, c) => a + evaluate(c.cb, c.cI, test, 1, c.base).T.oos.length, 0) / P.seeds);
    g.trades = T.oos.map((t) => [t.d, t.side, r3(t.R), r3(t.net), t.why]);
    res.tests[test.id] = g;
    console.log(test.id, JSON.stringify({ is: g.is.excess, oos: g.oos.excess, net: g.oos.net, x2: g.oos2x, pl: g.placebo, ct: g.control }));
  }
  const adj = holm(TESTS.map((t) => res.tests[t.id].oos.excess.p));
  TESTS.forEach((t, k) => {
    const g = res.tests[t.id]; g.holmP = adj[k];
    g.checks = {
      n: g.oos.excess.n >= P.minN, excess: g.oos.excess.mean > 0 && g.oos.excess.monthT >= P.tMin && g.holmP <= P.alpha,
      net: g.oos.net.mean > 0, isSign: g.is.excess.mean > 0, cost2x: g.oos2x.mean > 0,
      placebo: g.placebo.beaten >= P.needBeat, control: g.control.beaten >= P.needBeat,
    };
    g.pass = Object.values(g.checks).every(Boolean);
  });
  res.passed = TESTS.filter((t) => res.tests[t.id].pass).map((t) => t.id);
  res.verdict = res.tests.T1.pass ? 'PASS' : 'FAIL';
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(res, null, 1) + '\n');
  console.log('verdict', res.verdict, 'passed', res.passed, 'holm', adj, 'signals', JSON.stringify(res.signals));
  return res;
}

async function fetchBars(out) {
  const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const FROM = Date.parse('2006-01-01T00:00:00Z') / 1000, END = Date.parse('2026-11-01T00:00:00Z') / 1000, m = new Map();
  for (let a = FROM; a < END;) {
    const b = Math.min(END, a + 4999 * H4); let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) {
      try { const r = await fetch(`${BASE}bars?sym=xau&tf=4h&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
        if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; }
      catch (e) { err = String(e.message || e); }
      if (!j) await sleep(2000 * (k + 1));
    }
    if (!j) throw new Error(err);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(200);
  }
  const bars = [...m.values()].sort((p, q) => p[0] - q[0]);
  fs.writeFileSync(out, zlib.gzipSync(JSON.stringify(bars)));
  console.log(bars.length, 'candles');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [mode, file] = process.argv.slice(2);
  if (mode === 'fetch') await fetchBars(file);
  else if (mode === 'full') full(file);
  else console.log('usage: run.mjs fetch|full <file.json.gz>');
}
