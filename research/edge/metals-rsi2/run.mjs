// Edge research · metals-rsi2 (PREREGISTRATION.md, committed and pushed first).
// The frozen 2-day RSI pullback (rsi2-pullback.mjs = research/edge/rsi2-pullback/run.mjs of the rsi2-pullback branch, copied
// unchanged, sha256 pinned in tests/metals-rsi2.test.mjs) on OANDA gold and silver daily candles, weekend stubs folded.
// Close > SMA200 and RSI(2) < 10 -> buy the next open; out at the next open after the first close > SMA5; stop 3 x ATR(20).
// Net of a round trip ($0.30 gold, $0.03 silver) and gold-long financing (council/fills.mjs FIN x nights, silver at the same
// fraction of price). Decisive 2016-now, replication 2008-15.
// Item 44: a NEW stand-alone rule, not a gate, exit, entry or size of the gold book (Gold trend / Gold daily engulf); it reads
// none of that book's trades and is decided on 2016 -> now.
//   node run.mjs fetch <dir>   copies xau.json / xag.json out of council-data (git show, no network)
//   node run.mjs full <dir>    writes result.json next to this file
// Paper research: nothing here is read by the council, the mirror or the page.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as O from './rsi2-pullback.mjs';
import { foldWeekend, nights as finNights, FIN } from '../../../council/fills.mjs';

export const P = O.P;
export const RATE = FIN.xau.long; // of price, per rollover; silver is charged the same fraction of its price
export const MARKETS = { xau: { cost: 0.30, name: 'Gold (XAU/USD)' }, xag: { cost: 0.03, name: 'Silver (XAG/USD)' } };
export const WINDOWS = { A: ['2008-01-01', '2015-12-31'], B: ['2016-01-01', '2099-12-31'] };
const DAY = 86400, T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const r3 = (v) => (Number.isFinite(v) ? +v.toFixed(3) : null);
const r2 = (v) => (Number.isFinite(v) ? +v.toFixed(2) : null);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// rows [t, o, h, l, c, v] -> weekday candles with the weekend stubs folded into the next weekday (then the original's own filter)
export function prepare(rows) {
  const bars = rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })).sort((a, b) => a.time - b.time);
  return O.candles(foldWeekend(bars).map((b) => [b.time, b.open, b.high, b.low, b.close]));
}

// net of costs: round trip in price + financing nights x RATE x entry. Exit time for the rollovers: a day's open or stop = its
// 00:00 UTC; an exit at a day's close (end of data, a 0-day placebo hold) = the next 00:00 UTC.
export function net(tr, cost) {
  const out = tr.tOut + (tr.why === 'end' || tr.atClose ? DAY : 0);
  const nt = finNights(tr.tIn, out), fin = nt * RATE * tr.entry, pts = tr.exit - tr.entry - cost - fin;
  return { ...tr, nights: nt, fin, gross: (tr.exit - tr.entry) / tr.entry * 100, ret: pts / tr.entry * 100, R: pts / tr.risk, Rgross: (tr.exit - tr.entry) / tr.risk };
}

// the original's placebo trade generation, line for line, returning the raw trades (a 0-day hold exits at that day's close, as
// there: marked atClose for the financing clock). The test checks it against the copied placebo() under the copied net().
export function placeboTrades(D, real, from, to, seed) {
  const s200 = O.sma(D, P.SMA_LONG), lo = T(from), hi = T(to) + DAY - 1, R = O.rng(seed);
  const elig = []; for (let i = P.SMA_LONG; i < D.length - 1; i++) if (D[i].time >= lo && D[i].time <= hi && D[i].close > s200[i] && O.atr(D, i) > 0) elig.push(i);
  const out = [];
  for (const tr of real) {
    const i = elig[Math.floor(R() * elig.length)], e = i + 1, risk = P.STOP_ATR * O.atr(D, i), entry = D[e].open, stop = entry - risk;
    const jEnd = Math.min(D.length - 1, e + tr.hold);
    let j = jEnd, exit = D[jEnd].open, why = 'hold';
    if (tr.hold === 0) { exit = D[e].close; }
    for (let k = e; k < jEnd || (tr.hold === 0 && k === e); k++) { if (D[k].low <= stop) { j = k; exit = Math.min(D[k].open, stop); why = 'stop'; break; } if (tr.hold === 0) break; }
    out.push({ i: e, j, entry, exit, why, stop, risk, tIn: D[e].time, tOut: D[j].time, hold: j - e, atClose: tr.hold === 0 && why !== 'stop' });
  }
  return out;
}

export function summary(tr, from, to) {
  const Rs = tr.map((t) => t.R), n = tr.length;
  let eq = 0, pk = 0, dd = 0; for (const x of [...tr].sort((a, b) => a.tOut - b.tOut).map((t) => t.R)) { eq += x; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  return {
    n, avgR: r3(mean(Rs)), avgRgross: r3(mean(tr.map((t) => t.Rgross))), totalR: r2(Rs.reduce((a, b) => a + b, 0)),
    avgRet: r3(mean(tr.map((t) => t.ret))), wr: n ? r2(100 * tr.filter((t) => t.R > 0).length / n) : null,
    tTrades: r2(O.tstat(Rs)), tMonths: r2(O.tstat(monthSumsR(tr, from, to))),
    stops: tr.filter((t) => t.why === 'stop').length, avgHold: r2(mean(tr.map((t) => t.hold))), avgNights: r2(mean(tr.map((t) => t.nights))),
    finR: r3(mean(tr.map((t) => t.fin / t.risk))), costR: r3(mean(tr.map((t) => t.Rgross - t.R))), ddR: r2(dd),
  };
}
// calendar-month sums of net R (every month of the window, 0 where nothing closed; a trade's month is its exit month)
export const monthSumsR = (tr, from, to) => O.monthSums(tr.map((t) => ({ tOut: t.tOut, ret: t.R })), from, to);

export function study(data) {
  const D = {}, all = {}, markets = {}, pooled = {};
  let end = '0000';
  for (const [k, m] of Object.entries(MARKETS)) {
    D[k] = prepare(data[k].rows);
    all[k] = O.simulate(D[k]).map((t) => net(t, m.cost));
    if (ymd(D[k].at(-1).time) > end) end = ymd(D[k].at(-1).time);
  }
  const span = (w) => { const [from, to0] = WINDOWS[w]; return [from, to0 > end ? end : to0]; };
  const inW = (t, from, to) => t.tIn >= T(from) && t.tIn <= T(to) + DAY - 1;
  for (const [k, m] of Object.entries(MARKETS)) {
    markets[k] = { name: m.name, cost: m.cost, data: { from: ymd(D[k][0].time), to: ymd(D[k].at(-1).time), days: D[k].length } };
    for (const w of Object.keys(WINDOWS)) { const [from, to] = span(w); markets[k][w] = { from, to, ...summary(all[k].filter((t) => inW(t, from, to)), from, to) }; }
    markets[k].years = byYear(all[k]);
  }
  for (const w of Object.keys(WINDOWS)) {
    const [from, to] = span(w);
    pooled[w] = { from, to, ...summary(Object.values(all).flat().filter((t) => inW(t, from, to)), from, to) };
  }
  // placebo, window B, pooled per seed
  const [fB, tB] = span('B'), seeds = [];
  for (let s = 1; s <= P.SEEDS; s++) {
    const tr = Object.entries(MARKETS).flatMap(([k, m]) => placeboTrades(D[k], all[k].filter((t) => inW(t, fB, tB)), fB, tB, s).map((t) => net(t, m.cost)));
    seeds.push(mean(tr.map((t) => t.R)));
  }
  const placebo = { seeds: P.SEEDS, mean: r3(mean(seeds)), p95: r3(O.pct(seeds, 0.95)), max: r3(Math.max(...seeds)), means: seeds.map(r3) };
  const B = pooled.B, checks = {
    pooledPositive: B.avgR > 0,
    tMonths: B.tMonths >= 2,
    sameSignA: pooled.A.avgR > 0,
    bothPositive: Object.keys(MARKETS).every((k) => markets[k].B.avgR > 0),
    placebo: B.avgR > O.pct(seeds, 0.95),
  };
  return { verdict: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL', checks, pooled, placebo, markets, overlap: overlap(all, fB, tB) };
}
// how many window-B entries of gold fall on a day silver also entered (the two metals move together)
function overlap(all, from, to) {
  const d = (k) => new Set(all[k].filter((t) => t.tIn >= T(from) && t.tIn <= T(to) + DAY - 1).map((t) => t.tIn));
  const g = d('xau'), s = d('xag');
  return { xau: g.size, xag: s.size, sameDay: [...g].filter((x) => s.has(x)).length };
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
    for (const k of Object.keys(MARKETS)) fs.writeFileSync(path.join(dir, k + '.json'), execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { cwd: HERE, maxBuffer: 1 << 28 }));
    console.log('fetched into', dir);
  } else if (mode === 'full') {
    const data = Object.fromEntries(Object.keys(MARKETS).map((k) => [k, JSON.parse(fs.readFileSync(path.join(dir, k + '.json')))]));
    const r = study(data);
    const out = {
      built: '2026-11-13', title: 'The frozen 2-day RSI pullback on gold and silver', verdict: r.verdict,
      system: 'Long when close > SMA200 and Wilder RSI(2) < 10 (OANDA daily close, weekend stubs folded), fill next open; exit next open after the first close > SMA5; stop 3 x ATR(20). A new stand-alone rule, not part of the gold book (item 44).',
      rule: 'research/edge/rsi2-pullback/run.mjs of the rsi2-pullback branch, copied unchanged as rsi2-pullback.mjs',
      costs: { roundTrip: { xau: 0.30, xag: 0.03 }, financingPerNight: RATE, financing: 'council/fills.mjs nights x FIN.xau.long x entry; silver at the same fraction of price' },
      src: 'OANDA mid daily candles, council-data research/daily/xau.json and xag.json',
      windows: WINDOWS, checks: r.checks, pooled: r.pooled, placebo: r.placebo, overlap: r.overlap, markets: r.markets,
    };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    console.log(JSON.stringify({ verdict: r.verdict, checks: r.checks, pooled: r.pooled, placebo: { ...r.placebo, means: undefined }, overlap: r.overlap, xau: { A: r.markets.xau.A, B: r.markets.xau.B }, xag: { A: r.markets.xag.A, B: r.markets.xag.B } }, null, 1));
  }
}
