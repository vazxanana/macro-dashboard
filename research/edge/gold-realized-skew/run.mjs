// Gold's intraday realized skewness and the next week's return (pre-registered in PREREGISTRATION.md, pushed first).
//   node research/edge/gold-realized-skew/run.mjs <xau-5m.json.gz>   (the mosha-sweep fetch, [t, o, h, l, c] rows, kept out of git)
// Writes result.json next to this file. The pure pieces are exported for tests/gold-realized-skew.test.mjs.
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nyOffsetH } from '../../../council/histdata.mjs';
import { nights, FIN } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const P = { minBars: 120, minRet: 100, week: 5, look: 250, minLook: 200, lo: 0.2, hi: 0.8, atrN: 20, stopAtr: 1.5, hold: 5, cost: 0.6, fin: FIN.xau.long };
export const IS = [Date.UTC(2007, 0, 1) / 1000, Date.UTC(2017, 0, 1) / 1000];
export const OOS = [Date.UTC(2017, 0, 1) / 1000, Date.UTC(2026, 10, 1) / 1000];

// 17:00 New York trading day label (YYYY-MM-DD) of a candle start t
export const dayLabel = (t) => new Date((t - nyOffsetH(t) * 3600 + 7 * 3600) * 1000).toISOString().slice(0, 10);

// realized skewness of a list of log returns: sqrt(N) sum r^3 / (sum r^2)^1.5
export function rsk(r) {
  let s2 = 0, s3 = 0;
  for (const x of r) { s2 += x * x; s3 += x * x * x; }
  return s2 > 0 ? Math.sqrt(r.length) * s3 / Math.pow(s2, 1.5) : null;
}

// group candles into kept trading days: { d, a, b (bar indices, inclusive), o, h, l, c, rsk }
export function buildDays(bars, p = P) {
  const out = []; let a = 0;
  for (let i = 1; i <= bars.length; i++) {
    if (i < bars.length && dayLabel(bars[i][0]) === dayLabel(bars[a][0])) continue;
    const b = i - 1, n = b - a + 1;
    if (n >= p.minBars) {
      const r = [];
      for (let k = a + 1; k <= b; k++) if (bars[k][0] - bars[k - 1][0] === 300 && bars[k][4] > 0 && bars[k - 1][4] > 0) r.push(Math.log(bars[k][4] / bars[k - 1][4]));
      let h = -Infinity, l = Infinity; for (let k = a; k <= b; k++) { if (bars[k][2] > h) h = bars[k][2]; if (bars[k][3] < l) l = bars[k][3]; }
      if (r.length >= p.minRet) out.push({ d: dayLabel(bars[a][0]), a, b, o: bars[a][1], h, l, c: bars[b][4], rsk: rsk(r) });
    }
    a = i;
  }
  return out;
}

// weekly skew, its rank among the previous `look` values, ATR(20); each from day i and earlier only
export function features(days, p = P) {
  const ws = days.map((_, i) => i >= p.week - 1 ? days.slice(i - p.week + 1, i + 1).reduce((s, x) => s + x.rsk, 0) / p.week : null);
  return days.map((x, i) => {
    let rank = null;
    if (ws[i] != null) {
      const prev = ws.slice(Math.max(0, i - p.look), i).filter((v) => v != null);
      if (prev.length >= p.minLook) rank = prev.filter((v) => v < ws[i]).length / prev.length;
    }
    let atr = null;
    if (i >= p.atrN) { let s = 0; for (let k = i - p.atrN + 1; k <= i; k++) s += Math.max(days[k].h - days[k].l, Math.abs(days[k].h - days[k - 1].c), Math.abs(days[k].l - days[k - 1].c)); atr = s / p.atrN; }
    return { ws: ws[i], rank, atr };
  });
}

export const sideOf = (rank, p = P) => rank == null ? null : rank < p.lo ? 'buy' : rank > p.hi ? 'sell' : null;

// one trade from a signal on day i: entry at day i+1's first open, out at day i+hold's last close, stop on 5m candles
export function trade(bars, days, feat, i, side, p = P, mult = 1) {
  const f = feat[i], e = days[i + 1], x = days[i + p.hold];
  if (!f || !f.atr || !e || !x) return null;
  const entry = bars[e.a][1], risk = p.stopAtr * f.atr, buy = side === 'buy', stop = buy ? entry - risk : entry + risk;
  let exitPx = bars[x.b][4], exitT = bars[x.b][0] + 300, how = 'time';
  for (let k = e.a; k <= x.b; k++) {
    const [t, o, , l] = bars[k], h = bars[k][2];
    if (buy ? o <= stop : o >= stop) { exitPx = o; exitT = t; how = 'gap'; break; }
    if (buy ? l <= stop : h >= stop) { exitPx = stop; exitT = t + 300; how = 'stop'; break; }
  }
  const gross = (buy ? exitPx - entry : entry - exitPx) / risk, entryT = bars[e.a][0];
  const nn = buy ? nights(entryT, exitT) : 0, cost = mult * (p.cost / risk + nn * p.fin * entry / risk);
  return { day: days[i].d, side, entryT, exitT, entry, stop, risk, exitPx, how, nights: nn, gross, net: gross - cost };
}

// the one-at-a-time stream of a rule over days whose ENTRY falls in [from, to)
export function stream(bars, days, feat, want, [from, to], p = P, mult = 1) {
  const out = []; let busy = -1;
  for (let i = 0; i + p.hold < days.length; i++) {
    if (i <= busy) continue;
    const s = sideOf(feat[i].rank, p); if (!s || !want.includes(s)) continue;
    const t0 = bars[days[i + 1].a][0]; if (t0 < from || t0 >= to) continue;
    const tr = trade(bars, days, feat, i, s, p, mult); if (!tr) continue;
    out.push(tr); busy = i + p.hold - 1; // day i+1 .. i+hold are held; a signal on day i+hold enters on day i+hold+1
  }
  return out;
}

const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export function monthSums(trs, from, key = 'net') {
  if (!trs.length) return [];
  const m = new Map(); let d = new Date(from * 1000); const last = ym(Math.max(...trs.map((x) => x.exitT)));
  for (;;) { const k = d.toISOString().slice(0, 7); m.set(k, 0); if (k >= last) break; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)); }
  for (const x of trs) m.set(ym(x.exitT), (m.get(ym(x.exitT)) || 0) + x[key]);
  return [...m.values()];
}
export function tStat(v) {
  const n = v.length; if (n < 2) return null;
  const mu = v.reduce((s, x) => s + x, 0) / n, sd = Math.sqrt(v.reduce((s, x) => s + (x - mu) ** 2, 0) / (n - 1));
  return sd > 0 ? mu / (sd / Math.sqrt(n)) : null;
}
const erf = (x) => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
export const pOne = (t) => t == null ? 1 : 0.5 * (1 - erf(t / Math.SQRT2));
// Holm step-down adjusted p (monotone)
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = Array(ps.length); let run = 0;
  o.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, p * (ps.length - r))); adj[i] = run; });
  return adj;
}
export function stats(trs, from) {
  const r3 = (v) => v == null ? null : Math.round(v * 1000) / 1000, r2 = (v) => v == null ? null : Math.round(v * 100) / 100;
  const n = trs.length, sum = (k) => trs.reduce((s, x) => s + x[k], 0);
  let eq = 0, pk = 0, dd = 0; for (const x of [...trs].sort((a, b) => a.exitT - b.exitT)) { eq += x.net; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  return { n, buys: trs.filter((x) => x.side === 'buy').length, sells: trs.filter((x) => x.side === 'sell').length,
    gross: r3(n ? sum('gross') / n : null), net: r3(n ? sum('net') / n : null), totalNet: r2(sum('net')),
    win: r2(n ? 100 * trs.filter((x) => x.net > 0).length / n : null), months: monthSums(trs, from).length,
    tGross: r2(tStat(monthSums(trs, from, 'gross'))), tNet: r2(tStat(monthSums(trs, from, 'net'))), dd: r2(dd),
    nights: r2(n ? sum('nights') / n : null), stops: trs.filter((x) => x.how !== 'time').length };
}
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

if (process.argv[2] && import.meta.url === `file://${process.argv[1]}`) {
  const bars = JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[2])));
  const days = buildDays(bars), feat = features(days);
  const run = (want, win, p = P, mult = 1) => stream(bars, days, feat, want, win, p, mult);
  const tests = { T1: ['buy', 'sell'], T2: ['buy'], T3: ['sell'] }, rows = {};
  for (const [k, want] of Object.entries(tests)) rows[k] = { is: stats(run(want, IS), IS[0]), oos: stats(run(want, OOS), OOS[0]), oos2x: stats(run(want, OOS, P, 2), OOS[0]) };
  const adj = holm(Object.keys(tests).map((k) => pOne(rows[k].oos.tNet)));
  Object.keys(tests).forEach((k, i) => { rows[k].pOne = Math.round(pOne(rows[k].oos.tNet) * 10000) / 10000; rows[k].pHolm = Math.round(adj[i] * 10000) / 10000; });
  // placebo: the T1 OOS count and side mix on random OOS days
  const t1 = run(tests.T1, OOS), oosDays = days.map((_, i) => i).filter((i) => i + P.hold < days.length && feat[i].atr && bars[days[i + 1].a][0] >= OOS[0] && bars[days[i + 1].a][0] < OOS[1]);
  const sides = t1.map((x) => x.side), plac = [];
  for (let s = 1; s <= 40; s++) {
    const rnd = mulberry32(s), pool = oosDays.slice();
    for (let j = pool.length - 1; j > 0; j--) { const k = Math.floor(rnd() * (j + 1)); [pool[j], pool[k]] = [pool[k], pool[j]]; }
    const sd = sides.slice(); for (let j = sd.length - 1; j > 0; j--) { const k = Math.floor(rnd() * (j + 1)); [sd[j], sd[k]] = [sd[k], sd[j]]; }
    const trs = sd.map((side, j) => trade(bars, days, feat, pool[j], side)).filter(Boolean);
    plac.push(trs.reduce((a, x) => a + x.net, 0) / trs.length);
  }
  const ps = plac.slice().sort((a, b) => a - b), real = rows.T1.oos.net;
  const placebo = { draws: 40, mean: +(ps.reduce((a, b) => a + b, 0) / 40).toFixed(3), p95: +ps[Math.floor(0.95 * 39)].toFixed(3), beats: ps.filter((v) => v < real).length };
  // reported only: by year (T1, both windows) and thresholds 0.10 / 0.90
  const all = run(tests.T1, [IS[0], OOS[1]]), byYear = {};
  for (const x of all) { const y = new Date(x.entryT * 1000).getUTCFullYear(); (byYear[y] ||= { n: 0, net: 0 }); byYear[y].n++; byYear[y].net += x.net; }
  for (const y in byYear) byYear[y].net = Math.round(byYear[y].net * 100) / 100;
  const P10 = { ...P, lo: 0.1, hi: 0.9 }, t10 = { is: stats(run(tests.T1, IS, P10), IS[0]), oos: stats(run(tests.T1, OOS, P10), OOS[0]) };
  // added after the result, context only (not a test): a 5-day buy entered on EVERY window day, same stop, exit and costs
  const every = (win) => { const t = oosDays.concat(days.map((_, i) => i).filter((i) => i + P.hold < days.length && feat[i].atr && bars[days[i + 1].a][0] >= IS[0] && bars[days[i + 1].a][0] < IS[1])).filter((i) => { const t0 = bars[days[i + 1].a][0]; return t0 >= win[0] && t0 < win[1]; }).map((i) => trade(bars, days, feat, i, 'buy')).filter(Boolean); return { n: t.length, gross: +(t.reduce((a, x) => a + x.gross, 0) / t.length).toFixed(3), net: +(t.reduce((a, x) => a + x.net, 0) / t.length).toFixed(3) }; };
  const buyEvery = { is: every(IS), oos: every(OOS) };
  const o = rows.T1.oos, checks = { tOos: o.tNet != null && o.tNet >= 2 && rows.T1.pHolm < 0.05, sameSign: Math.sign(rows.T1.is.net) === Math.sign(o.net) && o.net !== 0, twoX: rows.T1.oos2x.net > 0 };
  const verdict = checks.tOos && checks.sameSign && checks.twoX ? 'PASS' : 'FAIL';
  const out = { study: 'gold-realized-skew', built: '2026-11-14', verdict, checks, params: P, data: { from: days[0].d, to: days.at(-1).d, days: days.length, candles: bars.length },
    windows: { is: '2007-01-01..2016-12-31', oos: '2017-01-01..2026-10-31' }, rows, placebo, byYear, thresholds10: t10, buyEvery };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify({ verdict, checks, rows, placebo, t10 }, null, 1));
}
