// gold-h4-supertrend: the standard Supertrend stop-and-reverse on gold's H4 chart (PREREGISTRATION.md, pushed first).
// A stand-alone research rule: never a gate, exit, entry or size of the live gold book; reads nothing of it.
// Usage: node research/edge/gold-h4-supertrend/run.mjs <xau-h1.json>   (rows [t, o, h, l, c], cache kept out of git)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { FIN, nights } from '../../../council/fills.mjs';
import { nyOffsetH } from '../../../council/histdata.mjs';

export const COST = 0.60;                       // $ a round trip
export const IS = { from: Date.UTC(2007, 0, 1) / 1000, to: Date.UTC(2017, 0, 1) / 1000 };
export const OOS = { from: Date.UTC(2017, 0, 1) / 1000, to: Date.UTC(2026, 10, 1) / 1000 };
export const TESTS = [
  { id: 'T1', name: 'both sides, ATR 10 x 3', P: 10, M: 3, longsOnly: false },
  { id: 'T2', name: 'buys only, ATR 10 x 3', P: 10, M: 3, longsOnly: true },
  { id: 'T3', name: 'both sides, ATR 10 x 4', P: 10, M: 4, longsOnly: false },
];
export const PLACEBO_N = 40;

// ---- H4 on 17:00 New York blocks ----------------------------------------------------------------------------------------
// key of an H1 candle: New York trading day (starting 17:00 NY) x 6 + block; null for the weekend (Fri 17:00 - Sun 17:00 NY)
export function blockOf(t) {
  const s = t - nyOffsetH(t) * 3600 - 17 * 3600;
  const day = Math.floor(s / 86400), wd = new Date(day * 86400 * 1000).getUTCDay();
  if (wd === 5 || wd === 6) return null;
  return day * 6 + Math.floor((s - day * 86400) / 14400);
}
// H1 rows -> { h4: [{ t, o, h, l, c, key }], h1: [[rows of that block]] }; the last block (maybe forming) is dropped
export function buildH4(rows) {
  const h4 = [], h1 = [];
  for (const r of rows) {
    const k = blockOf(r[0]);
    if (k == null) continue;
    const last = h4[h4.length - 1];
    if (last && last.key === k) { last.h = Math.max(last.h, r[2]); last.l = Math.min(last.l, r[3]); last.c = r[4]; h1[h1.length - 1].push(r); }
    else { h4.push({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4], key: k }); h1.push([r]); }
  }
  h4.pop(); h1.pop();
  return { h4, h1 };
}

// ---- Supertrend (Wilder ATR) --------------------------------------------------------------------------------------------
export function supertrend(h4, P, M) {
  const n = h4.length, atr = new Array(n).fill(null), line = new Array(n).fill(null), up = new Array(n).fill(null);
  let sum = 0, fu = null, fl = null;
  for (let i = 0; i < n; i++) {
    const b = h4[i], tr = i === 0 ? b.h - b.l : Math.max(b.h - b.l, Math.abs(b.h - h4[i - 1].c), Math.abs(b.l - h4[i - 1].c));
    if (i < P) { sum += tr; if (i === P - 1) atr[i] = sum / P; }
    else atr[i] = (atr[i - 1] * (P - 1) + tr) / P;
    if (atr[i] == null) continue;
    const hl2 = (b.h + b.l) / 2, bu = hl2 + M * atr[i], bl = hl2 - M * atr[i];
    if (fu == null) { fu = bu; fl = bl; up[i] = true; line[i] = fl; continue; }
    const pc = h4[i - 1].c, pfu = fu, pfl = fl;
    fl = bl > pfl || pc < pfl ? bl : pfl;
    fu = bu < pfu || pc > pfu ? bu : pfu;
    let u = up[i - 1];
    if (u && b.c < pfl) u = false; else if (!u && b.c > pfu) u = true;
    up[i] = u; line[i] = u ? fl : fu;
  }
  return { atr, line, up };
}
// flips: closed candle i whose close turned the trend; side of the new trend
export function flipsOf(st) {
  const out = [];
  for (let i = 1; i < st.up.length; i++) if (st.up[i] != null && st.up[i - 1] != null && st.up[i] !== st.up[i - 1]) out.push({ i, side: st.up[i] ? 'buy' : 'sell' });
  return out;
}

// ---- the engine: entries at the next H4 open, hard stop on H1 (tighter only), flip exit at the next H4 open ---------------
// flips [{ i, side }] at closed candle i; stopAt(i, side) = the hard-stop level read at the close of candle i
export function simulate(h4, h1, flips, stopAt, longsOnly = false) {
  const at = new Map(flips.map((f) => [f.i, f.side])), trades = [];
  let pos = null, pending = null;
  for (let j = 0; j < h4.length; j++) {
    const b = h4[j];
    if (pending) {
      if (pos) { trades.push(close(pos, b.o, b.t, 'flip')); pos = null; }
      const side = pending.side, st = stopAt(pending.i, side);
      if (!(longsOnly && side === 'sell') && Number.isFinite(st) && (side === 'buy' ? b.o > st : b.o < st))
        pos = { side, entry: b.o, entryT: b.t, stop: st, r0: Math.abs(b.o - st), sig: pending.i };
      pending = null;
    }
    if (pos) for (const r of h1[j]) {
      const s = pos.stop;
      if (pos.side === 'buy' ? r[3] <= s : r[2] >= s) {
        const gap = pos.side === 'buy' ? r[1] <= s : r[1] >= s;
        trades.push(close(pos, gap ? r[1] : s, r[0], 'stop')); pos = null; break;
      }
    }
    if (pos) { const s = stopAt(j, pos.side); if (Number.isFinite(s) && (pos.side === 'buy' ? s > pos.stop : s < pos.stop)) pos.stop = s; }
    if (at.has(j) && j + 1 < h4.length) {
      const side = at.get(j);
      if (!pos || pos.side !== side) pending = { i: j, side };
    }
  }
  return trades;   // a position still open at the end is not counted
}
function close(p, px, t, how) {
  const R = (p.side === 'buy' ? px - p.entry : p.entry - px) / p.r0;
  return { side: p.side, entryT: p.entryT, exitT: t, entry: p.entry, exit: px, r0: p.r0, how, R };
}
// costs in R: spread + financing on buys (k = cost multiple)
export function costR(tr, k = 1) {
  const fin = tr.side === 'buy' ? nights(tr.entryT, tr.exitT) * FIN.xau.long * tr.entry / tr.r0 : 0;
  return k * (COST / tr.r0 + fin);
}

// ---- statistics ---------------------------------------------------------------------------------------------------------
export const monthOf = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
export function monthSums(trades, win, val) {
  const m0 = monthOf(win.from), last = Math.max(monthOf(win.to - 1), ...trades.map((x) => monthOf(x.exitT)));
  const s = new Array(last - m0 + 1).fill(0);
  for (const x of trades) s[monthOf(x.exitT) - m0] += val(x);
  return s;
}
export function tStat(a) {
  const n = a.length; if (n < 2) return 0;
  const m = a.reduce((p, q) => p + q, 0) / n, v = a.reduce((p, q) => p + (q - m) ** 2, 0) / (n - 1);
  return v > 0 ? m / Math.sqrt(v / n) : 0;
}
const erf = (x) => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
export const pTwo = (t) => 1 - erf(Math.abs(t) / Math.SQRT2);
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = new Array(ps.length); let run = 0;
  o.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (ps.length - k) * p)); adj[i] = run; });
  return adj;
}
export function maxDD(trades, val) {
  let eq = 0, pk = 0, dd = 0;
  for (const x of [...trades].sort((a, b) => a.exitT - b.exitT)) { eq += val(x); pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  return dd;
}
const r3 = (x) => Math.round(x * 1000) / 1000, r2 = (x) => Math.round(x * 100) / 100;
export function corr(a, b) {
  const n = Math.min(a.length, b.length); if (n < 3) return null;
  const ma = a.slice(0, n).reduce((p, q) => p + q, 0) / n, mb = b.slice(0, n).reduce((p, q) => p + q, 0) / n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : null;
}
export function summary(trades, win) {
  const tr = trades.filter((x) => x.entryT >= win.from && x.entryT < win.to);
  const g = (x) => x.R, net = (x) => x.R - costR(x), net2 = (x) => x.R - costR(x, 2), sum = (f) => tr.reduce((p, x) => p + f(x), 0);
  const n = tr.length;
  return {
    n, win: n ? r2(100 * tr.filter((x) => net(x) > 0).length / n) : 0,
    gross: n ? r3(sum(g) / n) : 0, net: n ? r3(sum(net) / n) : 0, net2x: n ? r3(sum(net2) / n) : 0,
    totalGross: r2(sum(g)), totalNet: r2(sum(net)), total2x: r2(sum(net2)),
    tGross: r2(tStat(monthSums(tr, win, g))), tNet: r2(tStat(monthSums(tr, win, net))), t2x: r2(tStat(monthSums(tr, win, net2))),
    months: monthSums(tr, win, net).length, dd: r2(maxDD(tr, net)),
    stops: tr.filter((x) => x.how === 'stop').length, holdH: n ? r2(tr.reduce((p, x) => p + (x.exitT - x.entryT), 0) / n / 3600) : 0,
    buys: tr.filter((x) => x.side === 'buy').length,
  };
}

// ---- placebo: random flip candles, same count, alternating sides, stop close -/+ (M + 1) x ATR trailed tighter -----------
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function placeboFlips(h4, win, count, seed) {
  const pool = []; for (let i = 0; i < h4.length - 1; i++) if (h4[i].t >= win.from && h4[i].t < win.to) pool.push(i);
  const r = rng(seed), pick = [];
  for (let k = 0; k < count && pool.length; k++) { const j = Math.floor(r() * pool.length); pick.push(pool[j]); pool[j] = pool[pool.length - 1]; pool.pop(); }
  pick.sort((a, b) => a - b);
  let side = r() < 0.5 ? 'buy' : 'sell';
  return pick.map((i) => { const f = { i, side }; side = side === 'buy' ? 'sell' : 'buy'; return f; });
}

export function runTest(h4, h1, T) {
  const st = supertrend(h4, T.P, T.M), flips = flipsOf(st);
  const stopAt = (i, side) => st.line[i] == null ? NaN : side === 'buy' ? st.line[i] - st.atr[i] : st.line[i] + st.atr[i];
  const trades = simulate(h4, h1, flips, stopAt, T.longsOnly);
  const oosFlips = flips.filter((f) => h4[f.i].t >= OOS.from && h4[f.i].t < OOS.to).length;
  const pStop = (i, side) => st.atr[i] == null ? NaN : side === 'buy' ? h4[i].c - (T.M + 1) * st.atr[i] : h4[i].c + (T.M + 1) * st.atr[i];
  const placebo = [];
  for (let s = 1; s <= PLACEBO_N; s++) placebo.push(summary(simulate(h4, h1, placeboFlips(h4, OOS, oosFlips, s), pStop, T.longsOnly), OOS).tNet);
  return { trades, flips, oosFlips, placebo };
}

function main(file) {
  const rows = JSON.parse(readFileSync(file, 'utf8'));
  const { h4, h1 } = buildH4(rows);
  // buy-and-hold: gold's month-end close change, % a month
  const me = new Map(); for (const b of h4) me.set(monthOf(b.t), b.c);
  const bh = (win) => { const m0 = monthOf(win.from), m1 = monthOf(win.to - 1), out = []; for (let m = m0; m <= m1; m++) { const a = me.get(m - 1), b = me.get(m); out.push(a && b ? 100 * (b / a - 1) : 0); } return out; };
  const res = {}, years = {};
  for (const T of TESTS) {
    const { trades, oosFlips, placebo } = runTest(h4, h1, T);
    const isS = summary(trades, IS), oosS = summary(trades, OOS);
    const net = (x) => x.R - costR(x);
    const inW = (w) => trades.filter((x) => x.entryT >= w.from && x.entryT < w.to);
    const corrOf = (w) => { const m = monthSums(inW(w), w, net), b = bh(w); return r2(corr(m.slice(0, b.length), b)); };
    const legs = {};
    if (!T.longsOnly) for (const side of ['buy', 'sell']) for (const [k, w] of [['is', IS], ['oos', OOS]]) legs[`${side}_${k}`] = summary(trades.filter((x) => x.side === side), w);
    const by = {};
    for (const x of trades) { const y = new Date(x.entryT * 1000).getUTCFullYear(); if (y < 2007) continue; (by[y] ||= { n: 0, gross: 0, net: 0 }); by[y].n++; by[y].gross += x.R; by[y].net += net(x); }
    for (const y in by) { by[y].gross = r2(by[y].gross); by[y].net = r2(by[y].net); }
    years[T.id] = by;
    res[T.id] = { ...T, is: isS, oos: oosS, oosFlips, corrBH: { is: corrOf(IS), oos: corrOf(OOS) }, legs,
      placebo: { tNet: placebo, beaten: placebo.filter((p) => oosS.tNet > p).length, median: r2([...placebo].sort((a, b) => a - b)[20]) } };
  }
  const ps = TESTS.map((T) => pTwo(res[T.id].oos.tNet)), adj = holm(ps);
  TESTS.forEach((T, k) => {
    const r = res[T.id]; r.p = r3(ps[k]); r.holm = r3(adj[k]);
    r.checks = { tOOS: r.oos.tNet >= 2 && adj[k] < 0.05, isSameSign: r.is.totalNet > 0 && r.oos.totalNet > 0, cost2x: r.oos.total2x > 0, placebo: r.placebo.beaten >= 38 };
    r.pass = Object.values(r.checks).every(Boolean);
  });
  const passed = TESTS.filter((T) => res[T.id].pass).map((T) => T.id);
  const out = {
    built: '2026-11-14', study: 'gold-h4-supertrend',
    verdict: passed.length ? `PASS: ${passed.join(', ')}` : `FAIL, 0 of ${TESTS.length}`,
    data: { from: new Date(rows[0][0] * 1000).toISOString().slice(0, 10), to: new Date(rows[rows.length - 1][0] * 1000).toISOString().slice(0, 10), h1: rows.length, h4: h4.length, src: 'OANDA mid XAU/USD H1 via the site proxy (cache outside git)' },
    windows: { is: '2007-01 to 2016-12 (entries)', oos: '2017-01 to 2026-10 (entries)' },
    costs: { roundTrip: COST, financing: FIN.xau.long, financingSrc: FIN.xau.src },
    tests: res, years,
  };
  writeFileSync(join(dirname(fileURLToPath(import.meta.url)), 'result.json'), JSON.stringify(out, null, 1) + '\n');
  for (const T of TESTS) { const r = res[T.id]; console.log(T.id, JSON.stringify({ is: r.is, oos: r.oos, holm: r.holm, corr: r.corrBH, placebo: [r.placebo.beaten, r.placebo.median], checks: r.checks })); }
  console.log(out.verdict);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv[2]);
