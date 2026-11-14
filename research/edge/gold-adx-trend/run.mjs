// Wilder's ADX / directional-movement trend rule on gold's daily chart (PREREGISTRATION.md, pushed first).
//   node research/edge/gold-adx-trend/run.mjs fetch <dir>   copies council-data research/daily/xau.json to <dir> (git show, no network)
//   node research/edge/gold-adx-trend/run.mjs full <dir>    runs the study and writes result.json next to this file
// A stand-alone rule: it does not read or change the gold book. Research only, nothing live.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { nights, FIN, foldWeekend } from '../../../council/fills.mjs';

export const P = { n: 14, adxMin: 25, atrN: 14, k: 2, cost: 0.60, warm: Date.UTC(2007, 0, 1) / 1000,
  isEnd: Date.UTC(2017, 0, 1) / 1000, half: Date.UTC(2022, 0, 1) / 1000, seeds: 40 };
export const TESTS = {
  T1: { name: 'ADX trend, long and short', ind: 'state', mode: 'sar', k: 2 },
  T2: { name: 'ADX trend, long only', ind: 'state', mode: 'long', k: 2 },
  T3: { name: 'DI cross stop-and-reverse', ind: 'cross', mode: 'sar', k: 2 },
};
const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);

// rows [t,o,h,l,c,v] -> folded weekday bars, complete days only (a row dated `now`'s day or later is dropped)
export function barsOf(rows, now = Date.now() / 1000) {
  const today = Math.floor(now / 86400) * 86400;
  const raw = rows.filter((r) => r[0] < today).map(([t, o, h, l, c]) => ({ time: t, open: o, high: h, low: l, close: c }))
    .sort((a, b) => a.time - b.time);
  return foldWeekend(raw);
}
export function atr(bars, n = P.atrN) {
  const out = new Array(bars.length).fill(null), tr = bars.map((b, i) => i === 0 ? b.high - b.low
    : Math.max(b.high - b.low, Math.abs(b.high - bars[i - 1].close), Math.abs(b.low - bars[i - 1].close)));
  for (let i = n; i < bars.length; i++) { let s = 0; for (let k = i - n + 1; k <= i; k++) s += tr[k]; out[i] = s / n; }
  return out;
}
// Wilder: +DI, -DI, ADX (null until defined). Index 0 has no previous bar, so the sums start at index 1.
export function dmi(bars, n = P.n) {
  const L = bars.length, pdi = new Array(L).fill(null), mdi = new Array(L).fill(null), adx = new Array(L).fill(null);
  let sTr = 0, sP = 0, sM = 0, cnt = 0, a = null;
  const dxs = [];
  for (let i = 1; i < L; i++) {
    const b = bars[i], q = bars[i - 1];
    const tr = Math.max(b.high - b.low, Math.abs(b.high - q.close), Math.abs(b.low - q.close));
    const up = b.high - q.high, dn = q.low - b.low;
    const pdm = up > dn && up > 0 ? up : 0, mdm = dn > up && dn > 0 ? dn : 0;
    cnt++;
    if (cnt <= n) { sTr += tr; sP += pdm; sM += mdm; if (cnt < n) continue; }
    else { sTr = sTr - sTr / n + tr; sP = sP - sP / n + pdm; sM = sM - sM / n + mdm; }
    const p = sTr > 0 ? 100 * sP / sTr : 0, m = sTr > 0 ? 100 * sM / sTr : 0;
    pdi[i] = p; mdi[i] = m;
    const dx = p + m > 0 ? 100 * Math.abs(p - m) / (p + m) : 0;
    if (a == null) { dxs.push(dx); if (dxs.length === n) { a = dxs.reduce((x, y) => x + y, 0) / n; adx[i] = a; } }
    else { a = (a * (n - 1) + dx) / n; adx[i] = a; }
  }
  return { pdi, mdi, adx };
}
// state on the close of day i: +1 / -1 / 0 (null while ADX is undefined)
export function states(bars, p = P) {
  const { pdi, mdi, adx } = dmi(bars, p.n);
  return bars.map((_, i) => (adx[i] == null ? null : adx[i] > p.adxMin ? (pdi[i] > mdi[i] ? 1 : mdi[i] > pdi[i] ? -1 : 0) : 0));
}
// cross on the close of day i: +1 up, -1 down, 0 none (reads A, B at i-1 and i only)
export function crosses(A, B) {
  return A.map((_, i) => {
    if (i === 0 || [A[i - 1], B[i - 1], A[i], B[i]].some((x) => x == null)) return 0;
    if (A[i - 1] <= B[i - 1] && A[i] > B[i]) return 1;
    if (A[i - 1] >= B[i - 1] && A[i] < B[i]) return -1;
    return 0;
  });
}
// per day: { enter: +1 / -1 / 0 (a new entry signal), want: the side an open position may keep (+1 / -1 / 0), null = no change }
export function signals(bars, ind, p = P) {
  if (ind === 'cross') { const d = dmi(bars, p.n); return crosses(d.pdi, d.mdi).map((s) => ({ enter: s, want: s || null })); }
  const st = states(bars, p);
  return st.map((s, i) => {
    const prev = i > 0 ? st[i - 1] : null;
    if (s == null || prev == null || s === prev) return { enter: 0, want: null };
    return { enter: s, want: s };
  });
}

// Trade list. sig[i] is acted on at bars[i+1].open. mode 'sar' (long and short) or 'long' (long / flat).
export function simulate(bars, sig, { mode, k }, p = P) {
  const A = atr(bars, p.atrN), trades = [];
  let pos = null;
  const close = (exit, i, why, stopped) => {
    trades.push({ ...pos, exit, exitI: i, exitT: bars[i].time + (stopped && exit !== bars[i].open ? 43200 : 0), why, bars: i - pos.entryI });
    pos = null;
  };
  const open = (side, i) => {
    const a = A[i - 1]; if (!(a > 0)) return;
    const entry = bars[i].open, dist = k * a;
    pos = { side, entry, stop: entry - side * dist, dist, entryI: i, entryT: bars[i].time, k };
  };
  const none = { enter: 0, want: null };
  for (let i = 1; i < bars.length; i++) {
    const s = bars[i - 1].time >= p.warm ? sig[i - 1] : none;   // yesterday's close, acted on at today's open
    if (pos && s.want != null && s.want !== pos.side) close(bars[i].open, i, 'signal', false);
    if (!pos && s.enter && (s.enter > 0 || mode === 'sar')) open(s.enter, i);
    if (pos) {   // stop from the entry day on; a day opening beyond it fills at the open
      const b = bars[i];
      if (pos.side > 0 && b.low <= pos.stop) close(Math.min(b.open, pos.stop), i, 'stop', true);
      else if (pos.side < 0 && b.high >= pos.stop) close(Math.max(b.open, pos.stop), i, 'stop', true);
    }
  }
  if (pos) { const i = bars.length - 1; trades.push({ ...pos, exit: bars[i].close, exitI: i, exitT: bars[i].time + 79200, why: 'open', bars: i - pos.entryI }); }
  return trades;
}
// R of a trade: gross, cost, financing, net (costMul 1 or 2)
export function rOf(t, costMul = 1, p = P) {
  const gross = (t.exit - t.entry) * t.side / t.dist, cost = costMul * p.cost / t.dist;
  const nn = t.side > 0 ? nights(t.entryT, t.exitT) : 0;
  const fin = costMul * nn * (t.side > 0 ? FIN.xau.long : FIN.xau.short) * t.entry / t.dist;
  return { gross, cost, fin, nights: nn, net: gross - cost - fin };
}

// statistics
function lgamma(x) { const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5; tmp -= (x + 0.5) * Math.log(tmp); let s = 1.000000000190015; for (const c of g) s += c / ++y; return -tmp + Math.log(2.5066282746310005 * s / x); }
function betacf(a, b, x) { let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d; let h = d;
  for (let m = 1; m <= 200; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-12) break; }
  return h; }
function ibeta(a, b, x) { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
export function pTwo(t, df) { if (!Number.isFinite(t) || df < 1) return 1; return ibeta(df / 2, 0.5, df / (df + t * t)); }
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let run = 0;
  idx.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (ps.length - r) * p)); out[i] = run; });
  return out;
}
// every calendar month from `from` to `to` (unix), sums of net by exit month
export function monthT(trades, from, to, key = 'net') {
  const months = []; const d = new Date(from * 1000); let y = d.getUTCFullYear(), m = d.getUTCMonth();
  const end = ym(to - 1);
  for (;;) { const s = `${y}-${String(m + 1).padStart(2, '0')}`; months.push(s); if (s >= end) break; m++; if (m > 11) { m = 0; y++; } }
  const sum = Object.fromEntries(months.map((s) => [s, 0]));
  for (const t of trades) { const s = ym(t.exitT); if (s in sum) sum[s] += t[key]; }
  const v = months.map((s) => sum[s]), n = v.length, mean = v.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  const t = sd > 0 ? mean / (sd / Math.sqrt(n)) : 0;
  return { months: n, t: +t.toFixed(3), p: +pTwo(t, n - 1).toFixed(5) };
}
const r4 = (x) => +x.toFixed(4);
export function summary(trades, from, to) {
  const n = trades.length, avg = (k) => (n ? trades.reduce((a, t) => a + t[k], 0) / n : 0);
  let eq = 0, hi = 0, dd = 0; for (const t of trades) { eq += t.net; hi = Math.max(hi, eq); dd = Math.min(dd, eq - hi); }
  return { n, win: n ? r4(trades.filter((t) => t.net > 0).length / n) : 0, gross: r4(avg('gross')), net: r4(avg('net')), net2: r4(avg('net2')),
    total: +trades.reduce((a, t) => a + t.net, 0).toFixed(2), maxDD: +dd.toFixed(2), stops: trades.filter((t) => t.why === 'stop').length,
    avgBars: +avg('bars').toFixed(1), ...monthT(trades, from, to) };
}
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// placebo: same count, sides, holding lengths and stop multiples, random OOS entry days; mean net R a trade
export function placebo(bars, real, seed, from, p = P) {
  const A = atr(bars, p.atrN), rnd = mulberry32(seed), first = bars.findIndex((b) => b.time >= from), last = bars.length - 1;
  let sum = 0, n = 0;
  for (const rt of real) {
    const len = Math.max(1, rt.bars), hi = last - len; if (hi <= first) continue;
    const i = first + Math.floor(rnd() * (hi - first + 1)), a = A[i - 1]; if (!(a > 0)) continue;
    const entry = bars[i].open, dist = rt.k * a, stop = entry - rt.side * dist;
    let exit = bars[i + len].open, j = i + len, stopped = false;
    for (let q = i; q < i + len; q++) { const b = bars[q];
      if (rt.side > 0 && b.low <= stop) { exit = Math.min(b.open, stop); j = q; stopped = true; break; }
      if (rt.side < 0 && b.high >= stop) { exit = Math.max(b.open, stop); j = q; stopped = true; break; } }
    const t = { side: rt.side, entry, dist, entryT: bars[i].time, exitT: bars[j].time + (stopped && exit !== bars[j].open ? 43200 : 0), exit };
    sum += rOf(t).net; n++;
  }
  return n ? sum / n : 0;
}
// buy-and-hold over a window: % change first open -> last close, less financing on every night, one ounce
export function buyHold(bars, from, to) {
  const w = bars.filter((b) => b.time >= from && b.time < to); if (!w.length) return null;
  // each night charged on that day's close, as a share of the first open
  const a = w[0], z = w[w.length - 1]; let nn = 0, fin = 0;
  for (let j = 0; j < w.length; j++) { const n1 = nights(w[j].time, j + 1 < w.length ? w[j + 1].time : z.time + 79200); nn += n1; fin += n1 * FIN.xau.long * w[j].close; }
  return { pct: +(((z.close - a.open - fin) / a.open) * 100).toFixed(2), gross: +((z.close / a.open - 1) * 100).toFixed(2), nights: nn };
}

export function study(bars, p = P) {
  const end = bars[bars.length - 1].time + 86400, out = { tests: {} }, ps = [];
  for (const [id, T] of Object.entries(TESTS)) {
    const trades = simulate(bars, signals(bars, T.ind, p), T, p).map((t) => { const r = rOf(t, 1, p), r2 = rOf(t, 2, p);
      return { ...t, gross: r.gross, cost: r.cost, fin: r.fin, nights: r.nights, net: r.net, net2: r2.net }; });
    const IS = trades.filter((t) => t.entryT >= p.warm && t.entryT < p.isEnd), OOS = trades.filter((t) => t.entryT >= p.isEnd);
    const h1 = OOS.filter((t) => t.entryT < p.half), h2 = OOS.filter((t) => t.entryT >= p.half);
    const pl = []; for (let s = 1; s <= p.seeds; s++) pl.push(r4(placebo(bars, OOS, s, p.isEnd, p)));
    const o = summary(OOS, p.isEnd, end);
    const pctSum = (L) => +(L.reduce((a, t) => a + t.net * t.dist / t.entry, 0) * 100).toFixed(2);
    const inMkt = (L, from, to) => +(L.reduce((a, t) => a + t.bars, 0) / bars.filter((b) => b.time >= from && b.time < to).length).toFixed(3);
    out.tests[id] = { ...T, IS: summary(IS, p.warm, p.isEnd), OOS: o, oosH1: summary(h1, p.isEnd, p.half), oosH2: summary(h2, p.half, end),
      placebo: { seeds: pl, beaten: pl.filter((x) => o.net > x).length, median: r4([...pl].sort((a, b) => a - b)[Math.floor(pl.length / 2)]) },
      pctNet: { IS: pctSum(IS), OOS: pctSum(OOS) }, inMarket: { IS: inMkt(IS, p.warm, p.isEnd), OOS: inMkt(OOS, p.isEnd, end) },
      openAtEnd: trades.filter((t) => t.why === 'open').length,
      trades: OOS.map((t) => [new Date(t.entryT * 1000).toISOString().slice(0, 10), t.side, +t.entry.toFixed(2), +t.dist.toFixed(2), +t.exit.toFixed(2), t.why, +t.net.toFixed(3)]) };
    ps.push(o.p);
  }
  const adj = holm(ps);
  Object.keys(TESTS).forEach((id, i) => {
    const x = out.tests[id]; x.holmP = +adj[i].toFixed(5);
    const checks = { oosNet: x.OOS.net > 0, monthT: x.OOS.t >= 2 && x.holmP < 0.05, isSign: x.IS.net > 0,
      costs2x: x.OOS.net2 > 0, placebo: x.placebo.beaten >= 38, n: x.OOS.n >= 30 };
    x.checks = checks; x.pass = Object.values(checks).every(Boolean); x.descriptive = x.OOS.n < 30;
  });
  out.buyHold = { IS: buyHold(bars, p.warm, p.isEnd), OOS: buyHold(bars, p.isEnd, end) };
  out.window = { is: '2007-01-01..2016-12-31', oos: `2017-01-01..${new Date((end - 86400) * 1000).toISOString().slice(0, 10)}`, candles: bars.length };
  out.pass = Object.values(out.tests).some((x) => x.pass);
  return out;
}

const here = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'xau.json'), execFileSync('git', ['show', 'origin/council-data:research/daily/xau.json'], { maxBuffer: 1 << 26 }));
    console.log('wrote', path.join(dir, 'xau.json'));
  } else if (cmd === 'full') {
    const f = JSON.parse(fs.readFileSync(path.join(dir, 'xau.json'), 'utf8'));
    const bars = barsOf(f.rows, Date.parse(f.updated) / 1000 + 86400);
    const r = study(bars);
    const res = { topic: 'gold-adx-trend', built: '2026-11-14', data: `council-data research/daily/xau.json (${f.src}, updated ${f.updated})`,
      verdict: r.pass ? 'PASS' : 'FAIL', ...r };
    fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(res, null, 1) + '\n');
    for (const [id, x] of Object.entries(r.tests)) console.log(id, x.name, 'IS', JSON.stringify(x.IS), '\nOOS', JSON.stringify(x.OOS), '\nH1', x.oosH1.net, 'H2', x.oosH2.net,
      'holm', x.holmP, 'placebo', x.placebo.beaten, 'med', x.placebo.median, 'pct', JSON.stringify(x.pctNet), JSON.stringify(x.inMarket), 'pass', x.pass, JSON.stringify(x.checks));
    console.log('BH', JSON.stringify(r.buyHold), r.window, 'verdict', res.verdict);
  } else console.log('usage: run.mjs fetch|full <dir>');
}
