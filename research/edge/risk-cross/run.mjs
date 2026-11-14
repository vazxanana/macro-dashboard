// Risk-cross study (pre-registered in PREREGISTRATION.md, 14 Nov 2026): AUD/JPY and NZD/JPY held long only while the S&P 500
// is above its 200-day average and calm (20-day realised volatility under its 1-year median). Paper research only.
//   node research/edge/risk-cross/run.mjs fetch <dir>   (git show from origin/council-data, no network)
//   node research/edge/risk-cross/run.mjs full <dir>    (writes result.json next to this file)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const KEYS = ['audjpy', 'nzdjpy', 'spx500'];
export const P = { sma: 200, rvN: 20, medN: 252, atrN: 20, atrK: 3 };
export const COST = { pip: 0.01, spread: 0.3, slip: 0.5, comm: 22.5e-6, fin: 0.004 / 100 };
export const WIN = { rep: ['2008-01-01', '2015-12-31'], dec: ['2016-01-01', null] };
export const SEEDS = 40;
const DAY = 86400;
const ts = (s) => Date.parse(s + 'T00:00:00Z') / 1000;

export const toBars = (j) => foldWeekend(j.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })));

// S&P state for each SPX day, from that day and earlier only: { time, up, calm }
export function spxState(spx) {
  const c = spx.map((b) => b.close), out = [], rv = [];
  for (let i = 0; i < spx.length; i++) {
    let up = null, calm = null, r = null;
    if (i >= P.sma - 1) { let s = 0; for (let k = i - P.sma + 1; k <= i; k++) s += c[k]; up = c[i] > s / P.sma; }
    if (i >= P.rvN) {
      const lr = []; for (let k = i - P.rvN + 1; k <= i; k++) lr.push(Math.log(c[k] / c[k - 1]));
      const m = lr.reduce((a, b) => a + b, 0) / lr.length; r = Math.sqrt(lr.reduce((a, b) => a + (b - m) ** 2, 0) / (lr.length - 1));
    }
    rv.push(r);
    if (r != null && rv.length >= P.medN && rv[rv.length - P.medN] != null) {
      const w = rv.slice(-P.medN).slice().sort((a, b) => a - b), med = (w[P.medN / 2 - 1] + w[P.medN / 2]) / 2;
      calm = r < med;
    }
    out.push({ time: spx[i].time, up, calm });
  }
  return out;
}

// the signal for each cross day: the latest SPX day with time <= the cross day's time
export function signalFor(bars, state, trendOnly = false) {
  const sig = []; let j = -1;
  for (const b of bars) {
    while (j + 1 < state.length && state[j + 1].time <= b.time) j++;
    const s = j >= 0 ? state[j] : null;
    sig.push(!!(s && s.up === true && (trendOnly || s.calm === true)));
  }
  return sig;
}

export function atr(bars, i, n = P.atrN) {
  if (i < n) return null;
  let s = 0; for (let k = i - n + 1; k <= i; k++) s += Math.max(bars[k].high - bars[k].low, Math.abs(bars[k].high - bars[k - 1].close), Math.abs(bars[k].low - bars[k - 1].close));
  return s / n;
}

// one held long from day e (bought at its open) with a fixed stop; exitAt = the day at whose open it is sold (null = none planned)
// returns { exitIdx, exit, how, held } where held counts days exposed
export function hold(bars, e, stop, exitAt) {
  for (let i = e; i < bars.length; i++) {
    const b = bars[i];
    if (i > e && b.open <= stop) return { exitIdx: i, exit: b.open, how: 'stop', held: i - e + (i === exitAt ? 0 : 1), gap: true };
    if (i === exitAt) return { exitIdx: i, exit: b.open, how: 'signal', held: i - e };
    if (b.low <= stop) return { exitIdx: i, exit: stop, how: 'stop', held: i - e + 1 };
  }
  const L = bars.length - 1;
  return { exitIdx: L, exit: bars[L].close, how: 'open', held: L - e + 1, endClose: true };
}

// costs of one round trip in price: spread + slippage + commission; and the financing charge (charged column)
export function costPx(entry, exit) { return COST.spread * COST.pip + 2 * COST.slip * COST.pip + COST.comm * (entry + exit); }
export function finPx(entry, tIn, tOut) { return COST.fin * entry * nights(tIn, tOut); }

function finish(bars, e, r0, stop, h, extra = {}) {
  const entry = bars[e].open, x = bars[h.exitIdx];
  const tOut = h.how === 'stop' && !h.gap ? x.time + DAY : (h.endClose ? x.time + DAY : x.time);
  const c = costPx(entry, h.exit), f = finPx(entry, bars[e].time, tOut);
  const R = (h.exit - entry) / r0;
  return { e, x: h.exitIdx, tIn: bars[e].time, tOut, entry, stop, r0, exit: h.exit, how: h.how, held: h.held, R,
    net0: R - c / r0, net: R - (c + f) / r0, costR: c / r0, finR: f / r0, nights: nights(bars[e].time, tOut), ...extra };
}

// the pre-registered rule: positions over the whole history
export function positions(bars, sig) {
  const out = []; let i = 1, locked = false;
  while (i < bars.length - 1) {
    if (!sig[i]) { locked = false; i++; continue; }
    if (sig[i - 1] || locked) { i++; continue; }          // only an off-to-on change, and not after a stop until off again
    const d = i, e = d + 1, a = atr(bars, d);
    if (a == null || a <= 0) { i++; continue; }
    const r0 = P.atrK * a, stop = bars[e].open - r0;
    let exitAt = null; for (let k = e; k < bars.length; k++) if (!sig[k]) { exitAt = k + 1; break; }
    if (exitAt != null && exitAt >= bars.length) exitAt = null;
    const h = hold(bars, e, stop, exitAt);
    out.push(finish(bars, e, r0, stop, h, { sigDay: bars[d].time }));
    if (h.how === 'stop') { locked = true; i = h.exitIdx; if (!sig[i]) locked = false; i++; }
    else i = h.exitIdx;   // signal exit at open of x: signal off at x-1; scan from x
  }
  return out;
}

const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const mon = (t) => iso(t).slice(0, 7);
export function monthsBetween(a, b) { const out = []; let [y, m] = a.split('-').map(Number); const [Y, M] = b.split('-').map(Number); while (y < Y || (y === Y && m <= M)) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } } return out; }
export const normCdf = (z) => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };
export function holm(ps) { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = Array(ps.length); let run = 0; o.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, p * (ps.length - k))); out[i] = run; }); return out; }

export function monthlyT(pos, key, fromMonth, toMonth) {
  const last = pos.reduce((m, p) => (mon(p.tOut) > m ? mon(p.tOut) : m), toMonth), ms = monthsBetween(fromMonth, last), sum = Object.fromEntries(ms.map((m) => [m, 0]));
  for (const p of pos) sum[mon(p.tOut)] += p[key];
  const v = ms.map((m) => sum[m]), n = v.length, mean = v.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  const t = sd > 0 ? mean / (sd / Math.sqrt(n)) : 0;
  return { months: n, mean, t, p: 1 - normCdf(t) };
}

// daily equity in R over the window's days, marked to the close
export function sharpe(bars, pos, i0, i1, key) {
  const last = Math.max(i1, ...pos.map((p) => p.x)), r = new Array(last - i0 + 1).fill(0);
  for (const p of pos) {
    const fr = key === 'net' ? p.finR : 0, half = p.costR / 2;
    for (let i = p.e; i <= p.x; i++) {
      const b = bars[i], prev = i === p.e ? p.entry : bars[i - 1].close;
      const v = (i === p.x ? p.exit : b.close) - prev;
      let d = v / p.r0; if (i === p.e) d -= half; if (i === p.x) d -= half + fr;
      if (i >= i0) r[i - i0] += d;
    }
  }
  const n = r.length, m = r.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1));
  return sd > 0 ? (m / sd) * Math.sqrt(252) : 0;
}

export function maxDD(vals) { let c = 0, hi = 0, dd = 0; for (const v of vals) { c += v; hi = Math.max(hi, c); dd = Math.min(dd, c - hi); } return dd; }

export function summarize(bars, pos, w) {
  const a = ts(w[0]), b = w[1] ? ts(w[1]) + DAY - 1 : Infinity;
  const ps = pos.filter((p) => p.tIn >= a && p.tIn <= b);
  const i0 = bars.findIndex((x) => x.time >= a), i1 = w[1] ? bars.findLastIndex((x) => x.time <= b) : bars.length - 1;
  const days = i1 - i0 + 1, n = ps.length, held = ps.reduce((s, p) => s + p.held, 0);
  const col = (k) => { const s = ps.reduce((x, p) => x + p[k], 0); return { avg: n ? s / n : 0, total: s, win: n ? ps.filter((p) => p[k] > 0).length / n : 0, dd: maxDD(ps.map((p) => p[k])),
    month: monthlyT(ps, k, mon(bars[i0].time), mon(bars[i1].time)), sharpe: sharpe(bars, ps, i0, i1, k === 'net' ? 'net' : 'net0') }; };
  return { from: iso(bars[i0].time), to: iso(bars[i1].time), n, days, held, tim: held / days, stops: ps.filter((p) => p.how === 'stop').length,
    gross: { avg: n ? ps.reduce((s, p) => s + p.R, 0) / n : 0 }, zero: col('net0'), charged: col('net'), ps, i0, i1 };
}

export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// K intervals with the given held days, shuffled, inner gaps >= 1, inside days [i0, i1]: returns start indices with their lengths
export function placeboIntervals(durs, i0, i1, rnd) {
  const d = durs.slice(); for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  const K = d.length, N = i1 - i0 + 1, free = N - d.reduce((a, b) => a + b, 0) - Math.max(0, K - 1);
  if (free < 0) throw new Error('placebo: no room');
  const cuts = Array.from({ length: K }, () => Math.floor(rnd() * (free + 1))).sort((a, b) => a - b);
  const gaps = [cuts[0] ?? free]; for (let k = 1; k < K; k++) gaps.push(cuts[k] - cuts[k - 1] + 1);
  const out = []; let at = i0;
  for (let k = 0; k < K; k++) { at += gaps[k]; out.push({ s: at, d: d[k] }); at += d[k]; }
  return out;
}

export function placebo(bars, sm, seeds = SEEDS) {
  const durs = sm.ps.map((p) => p.held), vals = [];
  for (let s = 1; s <= seeds; s++) {
    const iv = placeboIntervals(durs, sm.i0, sm.i1, mulberry32(s)), ps = [];
    for (const { s: e, d } of iv) {
      const a = atr(bars, e - 1); const r0 = P.atrK * a, stop = bars[e].open - r0, exitAt = e + d < bars.length ? e + d : null;
      ps.push(finish(bars, e, r0, stop, hold(bars, e, stop, exitAt)));
    }
    vals.push({ seed: s, avg: ps.reduce((x, p) => x + p.net, 0) / ps.length, planned: iv.reduce((x, v) => x + v.d, 0), held: ps.reduce((x, p) => x + p.held, 0) });
  }
  const sorted = vals.map((v) => v.avg).sort((a, b) => a - b);
  return { seeds, p95: sorted[Math.ceil(0.95 * seeds) - 1], median: (sorted[seeds / 2 - 1] + sorted[seeds / 2]) / 2, planned: vals[0].planned, vals };
}

const r3 = (x) => Math.round(x * 1000) / 1000, r2 = (x) => Math.round(x * 100) / 100;
const slim = (sm) => ({ from: sm.from, to: sm.to, n: sm.n, stops: sm.stops, days: sm.days, held: sm.held, timeInMarket: r3(sm.tim), grossAvg: r3(sm.gross.avg),
  ...Object.fromEntries(['zero', 'charged'].map((k) => [k, { avg: r3(sm[k].avg), total: r2(sm[k].total), win: r3(sm[k].win), dd: r2(sm[k].dd), months: sm[k].month.months, t: r2(sm[k].month.t), p: +sm[k].month.p.toFixed(4), sharpe: r2(sm[k].sharpe) }])) });

export function study(data) {
  const B = Object.fromEntries(KEYS.map((k) => [k, toBars(data[k])])), st = spxState(B.spx500);
  const defs = { T1: ['audjpy', false], T2: ['nzdjpy', false], T3: ['audjpy', true] }, rows = {};
  for (const [k, [m, tr]] of Object.entries(defs)) {
    const bars = B[m], pos = positions(bars, signalFor(bars, st, tr)), dec = summarize(bars, pos, WIN.dec), rep = summarize(bars, pos, WIN.rep), pl = placebo(bars, dec);
    rows[k] = { market: m, signal: tr ? 'trend only' : 'trend and calm', dec: slim(dec), rep: slim(rep), placebo: { seeds: pl.seeds, p95: r3(pl.p95), median: r3(pl.median), planned: pl.planned, held: dec.held, vals: pl.vals.map((v) => ({ seed: v.seed, avg: r3(v.avg), planned: v.planned })) },
      trades: dec.ps.concat(rep.ps).sort((a, b) => a.tIn - b.tIn).map((p) => ({ in: iso(p.tIn), out: iso(p.tOut), entry: p.entry, stop: +p.stop.toFixed(3), exit: +p.exit.toFixed(3), how: p.how, held: p.held, R: r3(p.R), net: r3(p.net), net0: r3(p.net0) })) };
  }
  const adj = holm(Object.values(rows).map((r) => r.dec.charged.p));
  Object.values(rows).forEach((r, i) => {
    const c = r.dec.charged, checks = { positive: c.avg > 0, t2: c.t >= 2, holm: adj[i] < 0.05, replication: r.rep.charged.avg > 0, placebo: c.avg > r.placebo.p95, n20: r.dec.n >= 20 };
    r.holmP = +adj[i].toFixed(4); r.checks = checks;
    r.verdict = !checks.n20 ? 'INCONCLUSIVE' : Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL';
  });
  const pass = (k) => rows[k].verdict === 'PASS';
  const verdict = pass('T1') || pass('T2') ? 'PASS' : pass('T3') ? 'TREND ONLY' : 'FAIL';
  return { built: '2026-11-14', data: { source: 'council-data research/daily (OANDA mid, UTC days, weekend folded)', branchAt: 'a70613a7c', last: rows.T1.dec.to },
    costs: { spreadPip: COST.spread, slipPipSide: COST.slip, commPerSide: COST.comm, finPerNight: COST.fin, swapListed: false, swapNote: 'ctrader/symbols.json lists no AUDJPY or NZDJPY; verdict on the 0.004 %/night charge column' },
    params: P, windows: WIN, rows, verdict };
}

const main = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (main) {
  const [cmd, dir] = process.argv.slice(2);
  if (!dir) { console.error('usage: run.mjs fetch|full <dir>'); process.exit(2); }
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    for (const k of KEYS) fs.writeFileSync(path.join(dir, k + '.json'), execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
    console.log('saved', KEYS.join(', '), 'to', dir);
  } else if (cmd === 'full') {
    const data = Object.fromEntries(KEYS.map((k) => [k, JSON.parse(fs.readFileSync(path.join(dir, k + '.json'), 'utf8'))]));
    const r = study(data);
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(r, null, 1) + '\n');
    for (const [k, x] of Object.entries(r.rows)) console.log(k, x.market, x.signal, JSON.stringify({ dec: x.dec, rep: x.rep, placebo: { p95: x.placebo.p95, median: x.placebo.median }, holmP: x.holmP, checks: x.checks, v: x.verdict }));
    console.log('verdict', r.verdict);
  }
}
