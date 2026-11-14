// gold-mtf-align: trade gold only while H1, H4 and D1 all sit on the same side of their EMA(20) (PREREGISTRATION.md, pushed first).
// A stand-alone research rule: never a gate, exit, entry or size of the live gold book; reads nothing of it.
// Usage: node research/edge/gold-mtf-align/run.mjs <xau-h1.json>   (rows [t, o, h, l, c], cache kept out of git)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { FIN, nights } from '../../../council/fills.mjs';
import { nyOffsetH } from '../../../council/histdata.mjs';

export const COST = 0.60;                       // $ a round trip
export const EMA_N = 20, ATR_N = 14, STOP_ATR = 2;
export const IS = { from: Date.UTC(2007, 0, 1) / 1000, to: Date.UTC(2017, 0, 1) / 1000 };
export const OOS = { from: Date.UTC(2017, 0, 1) / 1000, to: Date.UTC(2026, 10, 1) / 1000 };
export const TESTS = [
  { id: 'T1', name: 'both sides, exit when the agreement ends', longsOnly: false, exit: 'all' },
  { id: 'T2', name: 'buys only, exit when the agreement ends', longsOnly: true, exit: 'all' },
  { id: 'T3', name: 'both sides, exit when D1 turns', longsOnly: false, exit: 'd1' },
];
export const PLACEBO_N = 40;

// ---- 17:00 New York blocks: key = trading day x 6 + block; null on the weekend (Fri 17:00 - Sun 17:00 NY) --------------
export function blockOf(t) {
  const s = t - nyOffsetH(t) * 3600 - 17 * 3600;
  const day = Math.floor(s / 86400), wd = new Date(day * 86400 * 1000).getUTCDay();
  if (wd === 5 || wd === 6) return null;
  return day * 6 + Math.floor((s - day * 86400) / 14400);
}
const dayOf = (t) => { const k = blockOf(t); return k == null ? null : Math.floor(k / 6); };
// first whole hour at or after `from` whose candle would not belong to group `key` (keyOf); scans at most `max` hours
function endOf(from, key, keyOf, max) { let u = from; for (let k = 0; k < max && keyOf(u) === key; k++) u += 3600; return u; }
// a candle series of group `keyOf` from H1 rows; each carries closeT = the moment it is known to be closed
export function group(rows, keyOf, max) {
  const out = [];
  for (const r of rows) {
    const k = keyOf(r[0]), last = out[out.length - 1];
    if (last && last.key === k) { last.h = Math.max(last.h, r[2]); last.l = Math.min(last.l, r[3]); last.c = r[4]; last.lastT = r[0]; }
    else out.push({ key: k, t: r[0], o: r[1], h: r[2], l: r[3], c: r[4], lastT: r[0] });
  }
  for (const b of out) b.closeT = endOf(b.lastT + 3600, b.key, keyOf, max);
  return out;
}
export function ema(cl, n = EMA_N) {
  const out = new Array(cl.length).fill(null); let e = null, s = 0;
  for (let i = 0; i < cl.length; i++) {
    if (i < n) { s += cl[i]; if (i === n - 1) e = s / n; else continue; } else e = e + (2 / (n + 1)) * (cl[i] - e);
    out[i] = e;
  }
  return out;
}
export function atrW(b, n = ATR_N) {
  const out = new Array(b.length).fill(null); let a = null, s = 0;
  for (let i = 0; i < b.length; i++) {
    const tr = i === 0 ? b[i].h - b[i].l : Math.max(b[i].h - b[i].l, Math.abs(b[i].h - b[i - 1].c), Math.abs(b[i].l - b[i - 1].c));
    if (i < n) { s += tr; if (i === n - 1) a = s / n; else continue; } else a = (a * (n - 1) + tr) / n;
    out[i] = a;
  }
  return out;
}
const sgn = (c, e) => (e == null ? null : c > e ? 1 : c < e ? -1 : 0);

// per H1 close j: { s: agreement +1 / -1 / 0 (null before warm-up), d: D1 side, atr: last closed H4 ATR }
export function states(rows) {
  const h4 = group(rows, blockOf, 5), d1 = group(rows, dayOf, 26);
  const e1 = ema(rows.map((r) => r[4])), e4 = ema(h4.map((b) => b.c)), ed = ema(d1.map((b) => b.c)), a4 = atrW(h4);
  const out = []; let p4 = -1, pd = -1;
  for (let j = 0; j < rows.length; j++) {
    const ct = rows[j][0] + 3600;
    while (p4 + 1 < h4.length && h4[p4 + 1].closeT <= ct) p4++;
    while (pd + 1 < d1.length && d1[pd + 1].closeT <= ct) pd++;
    const x1 = sgn(rows[j][4], e1[j]), x4 = p4 < 0 ? null : sgn(h4[p4].c, e4[p4]), xd = pd < 0 ? null : sgn(d1[pd].c, ed[pd]);
    const s = x1 == null || x4 == null || xd == null ? null : x1 === 1 && x4 === 1 && xd === 1 ? 1 : x1 === -1 && x4 === -1 && xd === -1 ? -1 : 0;
    out.push({ s, d: xd, atr: p4 < 0 ? null : a4[p4] });
  }
  return out;
}

// ---- the engine: entries / exits at the next H1 open, fixed stop checked on every H1 candle from the entry candle on ------
export function simulate(rows, st, { longsOnly = false, exit = 'all' } = {}) {
  const trades = []; let pos = null, pEntry = null, pExit = false;
  for (let j = 0; j < rows.length; j++) {
    const r = rows[j];
    if (pExit && pos) { trades.push(close(pos, r[1], r[0], 'rule', j)); pos = null; }
    pExit = false;
    if (pEntry && !pos) {
      const side = pEntry.side, a = st[pEntry.j].atr;
      if (a > 0) { const stop = side === 'buy' ? r[1] - STOP_ATR * a : r[1] + STOP_ATR * a; pos = { side, entry: r[1], entryT: r[0], stop, r0: STOP_ATR * a, ei: j }; }
    }
    pEntry = null;
    if (pos) {
      const s = pos.stop;
      if (pos.side === 'buy' ? r[3] <= s : r[2] >= s) {
        const gap = pos.side === 'buy' ? r[1] <= s : r[1] >= s;
        trades.push(close(pos, gap ? r[1] : s, r[0], 'stop', j)); pos = null;
      }
    }
    if (j + 1 >= rows.length) break;
    const cur = st[j], prev = j ? st[j - 1] : null, want = pos ? (pos.side === 'buy' ? 1 : -1) : 0;
    if (pos && (exit === 'all' ? cur.s !== want : cur.d != null && cur.d !== want)) pExit = true;
    const turned = cur.s === 1 || cur.s === -1 ? !prev || prev.s !== cur.s : false;
    if (turned && (!pos || pExit)) {
      const side = cur.s === 1 ? 'buy' : 'sell';
      if (!(longsOnly && side === 'sell')) pEntry = { j, side };
    }
  }
  return trades;   // a position still open at the end is not counted
}
function close(p, px, t, how, xi) {
  const R = (p.side === 'buy' ? px - p.entry : p.entry - px) / p.r0;
  return { side: p.side, entryT: p.entryT, exitT: t, entry: p.entry, exit: px, r0: p.r0, how, R, hold: xi - p.ei };
}
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
function corr(a, b) {
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
    stops: tr.filter((x) => x.how === 'stop').length, holdH: n ? r2(tr.reduce((p, x) => p + x.hold, 0) / n) : 0,
    buys: tr.filter((x) => x.side === 'buy').length, costR: n ? r3(sum((x) => costR(x)) / n) : 0,
  };
}

// ---- placebo: random entry candles, random side, hold drawn from the test's own OOS holds, the same stop -----------------
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function placebo(rows, st, win, count, holds, seed, longsOnly) {
  const pool = []; for (let j = 1; j < rows.length; j++) if (rows[j][0] >= win.from && rows[j][0] < win.to && st[j - 1].atr > 0) pool.push(j);
  const r = rng(seed), pick = [];
  for (let k = 0; k < count && pool.length; k++) { const i = Math.floor(r() * pool.length); pick.push({ j: pool[i], side: longsOnly || r() < 0.5 ? 'buy' : 'sell', hold: Math.max(1, holds[Math.floor(r() * holds.length)]) }); pool[i] = pool[pool.length - 1]; pool.pop(); }
  pick.sort((a, b) => a.j - b.j);
  const trades = []; let busy = -1;
  for (const p of pick) {
    if (p.j < busy) continue;
    const e = rows[p.j][1], a = st[p.j - 1].atr, stop = p.side === 'buy' ? e - STOP_ATR * a : e + STOP_ATR * a;
    const pos = { side: p.side, entry: e, entryT: rows[p.j][0], stop, r0: STOP_ATR * a, ei: p.j };
    const xi = Math.min(p.j + p.hold, rows.length - 1); let done = null;
    for (let j = p.j; j < xi; j++) {
      const c = rows[j];
      if (p.side === 'buy' ? c[3] <= stop : c[2] >= stop) { const gap = p.side === 'buy' ? c[1] <= stop : c[1] >= stop; done = close(pos, gap ? c[1] : stop, c[0], 'stop', j); break; }
    }
    if (!done) { if (xi <= p.j) continue; done = close(pos, rows[xi][1], rows[xi][0], 'rule', xi); }
    trades.push(done); busy = p.j + done.hold;
  }
  return trades;
}

export function loadRows(file) {
  return JSON.parse(readFileSync(file, 'utf8')).filter((r) => blockOf(r[0]) != null).sort((a, b) => a[0] - b[0]);
}

function main(file) {
  const rows = loadRows(file), st = states(rows);
  const me = new Map(); for (const r of rows) me.set(monthOf(r[0]), r[4]);
  const bh = (win) => { const m0 = monthOf(win.from), m1 = monthOf(win.to - 1), out = []; for (let m = m0; m <= m1; m++) { const a = me.get(m - 1), b = me.get(m); out.push(a && b ? 100 * (b / a - 1) : 0); } return out; };
  const res = {}, years = {};
  for (const T of TESTS) {
    const trades = simulate(rows, st, T), isS = summary(trades, IS), oosS = summary(trades, OOS);
    const net = (x) => x.R - costR(x), inW = (w) => trades.filter((x) => x.entryT >= w.from && x.entryT < w.to);
    const holds = inW(OOS).map((x) => x.hold);
    const pl = []; for (let s = 1; s <= PLACEBO_N; s++) pl.push(summary(placebo(rows, st, OOS, oosS.n, holds, s, T.longsOnly), OOS).tNet);
    const corrOf = (w) => { const m = monthSums(inW(w), w, net), b = bh(w); return r2(corr(m.slice(0, b.length), b)); };
    const legs = {};
    if (!T.longsOnly) for (const side of ['buy', 'sell']) for (const [k, w] of [['is', IS], ['oos', OOS]]) legs[`${side}_${k}`] = summary(trades.filter((x) => x.side === side), w);
    const by = {};
    for (const x of trades) { const y = new Date(x.entryT * 1000).getUTCFullYear(); if (y < 2007) continue; (by[y] ||= { n: 0, gross: 0, net: 0 }); by[y].n++; by[y].gross += x.R; by[y].net += net(x); }
    for (const y in by) { by[y].gross = r2(by[y].gross); by[y].net = r2(by[y].net); }
    years[T.id] = by;
    const sorted = [...pl].sort((a, b) => a - b);
    res[T.id] = { ...T, is: isS, oos: oosS, corrBH: { is: corrOf(IS), oos: corrOf(OOS) }, legs,
      placebo: { tNet: pl, beaten: pl.filter((p) => oosS.tNet > p).length, median: r2((sorted[19] + sorted[20]) / 2) } };
  }
  const ps = TESTS.map((T) => pTwo(res[T.id].oos.tNet)), adj = holm(ps);
  TESTS.forEach((T, k) => {
    const r = res[T.id]; r.p = r3(ps[k]); r.holm = r3(adj[k]);
    r.checks = { tOOS: r.oos.tNet >= 2 && adj[k] < 0.05, isSameSign: r.is.totalNet > 0 && r.oos.totalNet > 0, cost2x: r.oos.total2x > 0, placebo: r.placebo.beaten >= 38 };
    r.pass = Object.values(r.checks).every(Boolean);
  });
  const passed = TESTS.filter((T) => res[T.id].pass).map((T) => T.id);
  const share = (v) => r2(100 * st.filter((x) => x.s === v).length / st.filter((x) => x.s != null).length);
  const out = {
    built: '2026-11-14', study: 'gold-mtf-align',
    verdict: passed.length ? `PASS: ${passed.join(', ')}` : `FAIL, 0 of ${TESTS.length}`,
    data: { from: new Date(rows[0][0] * 1000).toISOString().slice(0, 10), to: new Date(rows[rows.length - 1][0] * 1000).toISOString().slice(0, 10), h1: rows.length, src: 'OANDA mid XAU/USD H1 via the site proxy (cache outside git), weekend hours dropped' },
    stateShare: { up: share(1), down: share(-1), mixed: share(0) },
    windows: { is: '2007-01 to 2016-12 (entries)', oos: '2017-01 to 2026-10 (entries)' },
    costs: { roundTrip: COST, financing: FIN.xau.long, financingSrc: FIN.xau.src },
    tests: res, years,
  };
  writeFileSync(join(dirname(fileURLToPath(import.meta.url)), 'result.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify(out.stateShare));
  for (const T of TESTS) { const r = res[T.id]; console.log(T.id, JSON.stringify({ is: r.is, oos: r.oos, holm: r.holm, corr: r.corrBH, placebo: [r.placebo.beaten, r.placebo.median], checks: r.checks, legs: Object.fromEntries(Object.entries(r.legs).map(([k, v]) => [k, [v.n, v.gross, v.net, v.tNet]])) })); }
  console.log(out.verdict);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv[2]);
