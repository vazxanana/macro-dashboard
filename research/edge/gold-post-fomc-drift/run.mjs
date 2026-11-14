// gold-post-fomc-drift: gold traded for two weeks the way it moved on the FOMC statement day, both sides, against the
// unconditional same-side trade after every meeting. Pre-registered in PREREGISTRATION.md.
// Paper research only; stand-alone on gold; nothing live reads this file.
//   node research/edge/gold-post-fomc-drift/run.mjs        (reads council-data with git show, writes result.json)
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';
import { HISTORY, EVENTS } from '../../../council/events.mjs';

export const P = { atrN: 20, stopAtr: 2, hold: 10, lag: 0, cost: 0.60, isFrom: '2007-01-01', isTo: '2016-12-31', oosFrom: '2017-01-01', seeds: 40 };
const DAY = 86400;
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);

// scheduled FOMC statement days: the list of branch gold-fomc-cycle dates.mjs (2007 from the Federal Reserve's meeting
// calendars; 2008-2021 as in fomc-even-week / pre-fomc-drift; 2022 on from council/events.mjs)
export const SOURCE = 'Federal Reserve FOMC meeting calendars (scheduled meetings): 2007 and 2008-2021 as in branch gold-fomc-cycle dates.mjs; 2022 on from council/events.mjs';
const NEW = ['2007-01-31', '2007-03-21', '2007-05-09', '2007-06-28', '2007-08-07', '2007-09-18', '2007-10-31', '2007-12-11'];
const OLD = {
  2008: ['01-30', '03-18', '04-30', '06-25', '08-05', '09-16', '10-29', '12-16'],
  2009: ['01-28', '03-18', '04-29', '06-24', '08-12', '09-23', '11-04', '12-16'],
  2010: ['01-27', '03-16', '04-28', '06-23', '08-10', '09-21', '11-03', '12-14'],
  2011: ['01-26', '03-15', '04-27', '06-22', '08-09', '09-21', '11-02', '12-13'],
  2012: ['01-25', '03-13', '04-25', '06-20', '08-01', '09-13', '10-24', '12-12'],
  2013: ['01-30', '03-20', '05-01', '06-19', '07-31', '09-18', '10-30', '12-18'],
  2014: ['01-29', '03-19', '04-30', '06-18', '07-30', '09-17', '10-29', '12-17'],
  2015: ['01-28', '03-18', '04-29', '06-17', '07-29', '09-17', '10-28', '12-16'],
  2016: ['01-27', '03-16', '04-27', '06-15', '07-27', '09-21', '11-02', '12-14'],
  2017: ['02-01', '03-15', '05-03', '06-14', '07-26', '09-20', '11-01', '12-13'],
  2018: ['01-31', '03-21', '05-02', '06-13', '08-01', '09-26', '11-08', '12-19'],
  2019: ['01-30', '03-20', '05-01', '06-19', '07-31', '09-18', '10-30', '12-11'],
  2020: ['01-29', '04-29', '06-10', '07-29', '09-16', '11-05', '12-16'],
  2021: ['01-27', '03-17', '04-28', '06-16', '07-28', '09-22', '11-03', '12-15'],
};
export const UNSCHEDULED = ['2007-08-10', '2007-08-17', '2008-01-22', '2008-10-08', '2010-05-09', '2020-03-03', '2020-03-15'];
const nyDate = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(t * 1000));
export function meetings() {
  const ds = [...NEW];
  for (const [y, list] of Object.entries(OLD)) for (const md of list) ds.push(`${y}-${md}`);
  for (const e of [...HISTORY, ...EVENTS]) if (e.type === 'FOMC') ds.push(e.local ? e.local.slice(0, 10) : nyDate(e.t));
  return [...new Set(ds)].sort();
}

// signals: one per meeting. Uses candles 0..d (+lag) only.
export function signals(bars, meets, p = P, unsched = UNSCHEDULED) {
  const ix = new Map(bars.map((b, i) => [ymd(b.time), i]));
  const uIx = unsched.map((u) => bars.findIndex((b) => ymd(b.time) >= u)).filter((k) => k >= 0);
  const out = [], drop = { noDay: 0, unscheduled: 0, data: 0, flat: 0 };
  for (const m of meets) {
    const d = ix.get(m); if (d == null) { drop.noDay++; continue; }
    const i = d + p.lag; // last candle read
    if (d < p.atrN + 1 || i + 1 + p.hold > bars.length) { drop.data++; continue; }
    if (uIx.some((k) => k >= d - 1 && k <= i + 1 + p.hold)) { drop.unscheduled++; continue; }
    const r = bars[i].close / bars[d - 1].close - 1;
    if (!(r !== 0)) { drop.flat++; continue; }
    let tr = 0; for (let k = i - p.atrN + 1; k <= i; k++) tr += Math.max(bars[k].high, bars[k - 1].close) - Math.min(bars[k].low, bars[k - 1].close);
    out.push({ meet: m, d, i, t: bars[i].time, side: Math.sign(r), r: +r.toFixed(6), atr: tr / p.atrN });
  }
  return { sigs: out, drop };
}

// one trade: entry at the open of i+1, stop 2 ATR, out at the close of the hold-th candle
export function trade(bars, s, side, p = P, costMult = 1) {
  const e = s.i + 1; if (e >= bars.length) return null;
  const entry = bars[e].open; const risk = p.stopAtr * s.atr; const stop = entry - side * risk;
  let j = e, exit = null, why = 'time';
  for (; j < bars.length && j < e + p.hold; j++) {
    const b = bars[j];
    if (side > 0 ? b.open <= stop : b.open >= stop) { exit = b.open; why = 'stop'; break; }
    if (side > 0 ? b.low <= stop : b.high >= stop) { exit = stop; why = 'stop'; break; }
  }
  if (exit == null) { if (j < e + p.hold) return null; j = e + p.hold - 1; exit = bars[j].close; }
  const tIn = bars[e].time; const tOut = bars[j].time + DAY - 1;
  const n = side > 0 ? nights(tIn, tOut) : 0;
  const fin = side > 0 ? n * FIN.xau.long * entry : 0;
  const gross = side * (exit - entry) / risk;
  const net = gross - costMult * (p.cost + fin) / risk;
  return { meet: s.meet, entryDay: ymd(tIn), exitDay: ymd(bars[j].time), e, x: j, side, r: s.r, entry, stop: +stop.toFixed(3), exit: +exit.toFixed(3), riskUsd: +risk.toFixed(3), why, nights: n, gross: +gross.toFixed(5), net: +net.toFixed(5) };
}
export const streamOf = (bars, sigs, sideOf, p = P, costMult = 1) => sigs.map((s) => trade(bars, s, sideOf(s), p, costMult)).filter(Boolean);

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const sd = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
export function months(from, to) { const o = []; let [y, m] = from.split('-').map(Number); const [Y, M] = to.split('-').map(Number); while (y < Y || (y === Y && m <= M)) { o.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } } return o; }
export function monthT(trades, key, from, to) {
  const sum = Object.fromEntries(months(from, to).map((m) => [m, 0]));
  for (const t of trades) { const k = t.exitDay.slice(0, 7); if (k in sum) sum[k] += t[key]; }
  const v = Object.values(sum); const s = sd(v); return s ? mean(v) / (s / Math.sqrt(v.length)) : 0;
}
export function normSf(z) { // one-sided upper tail
  const t = 1 / (1 + 0.2316419 * Math.abs(z)); const d = 0.3989423 * Math.exp(-z * z / 2);
  const q = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z >= 0 ? q : 1 - q;
}
export function holm(ps) { const ix = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]); const out = Array(ps.length); let run = 0; ix.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, p * (ps.length - r))); out[i] = run; }); return out; }
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const r3 = (x) => +x.toFixed(3);
const inWin = (t, win) => (win === 'is' ? t.entryDay >= P.isFrom && t.entryDay <= P.isTo : t.entryDay >= P.oosFrom);
export function summary(trades, win, lastMonth, key = 'net') {
  const from = win === 'is' ? P.isFrom : P.oosFrom; const to = win === 'is' ? P.isTo.slice(0, 7) : lastMonth;
  const tr = trades.filter((t) => inWin(t, win) && t.exitDay.slice(0, 7) <= to);
  const g = tr.map((t) => t.gross), n = tr.map((t) => t.net);
  const stops = tr.map((t) => t.riskUsd).sort((a, b) => a - b);
  return { n: tr.length, buys: tr.filter((t) => t.side > 0).length, sells: tr.filter((t) => t.side < 0).length,
    gross: r3(mean(g)), net: r3(mean(n)), costR: r3(mean(g) - mean(n)), costShare: mean(g) ? r3((mean(g) - mean(n)) / Math.abs(mean(g))) : null,
    tNet: r3(monthT(tr, key, from, to)), tGross: r3(monthT(tr, 'gross', from, to)), stopMedianUsd: stops.length ? r3(stops[stops.length >> 1]) : null,
    win: tr.length ? r3(tr.filter((t) => t.net > 0).length / tr.length) : null, total: r3(n.reduce((a, b) => a + b, 0)) };
}

// excess over the same-side baseline of the same window
export function excess(F, Lall, Sall, win) {
  const base = { 1: mean(Lall.filter((t) => inWin(t, win)).map((t) => t.net)), [-1]: mean(Sall.filter((t) => inWin(t, win)).map((t) => t.net)) };
  return F.filter((t) => inWin(t, win)).map((t) => ({ ...t, ex: t.net - base[t.side] }));
}

export function study(bars, p = P) {
  const meets = meetings();
  const { sigs, drop } = signals(bars, meets, p);
  const lb = new Date(bars[bars.length - 1].time * 1000); // the last complete month: the one before the last candle's
  const lastMonth = ym(Date.UTC(lb.getUTCFullYear(), lb.getUTCMonth(), 0) / 1000);
  const F = streamOf(bars, sigs, (s) => s.side, p), F2 = streamOf(bars, sigs, (s) => s.side, p, 2);
  const L = streamOf(bars, sigs, () => 1, p), S = streamOf(bars, sigs, () => -1, p), X = streamOf(bars, sigs, (s) => -s.side, p);
  const W = (a) => ({ is: summary(a, 'is', lastMonth), oos: summary(a, 'oos', lastMonth) });
  const res = { F: W(F), F2x: W(F2), longAll: W(L), shortAll: W(S), fade: W(X), Fbuys: W(F.filter((t) => t.side > 0)), Fsells: W(F.filter((t) => t.side < 0)) };
  const exIs = excess(F, L, S, 'is'), exOos = excess(F, L, S, 'oos');
  const exM = (a) => r3(mean(a.map((t) => t.ex)));
  const exT = (a, win) => r3(monthT(a, 'ex', win === 'is' ? p.isFrom : p.oosFrom, win === 'is' ? p.isTo.slice(0, 7) : lastMonth));
  // placebo: random sides at the follow stream's long share
  const share = sigs.filter((s) => s.side > 0).length / sigs.length;
  const plc = [];
  for (let seed = 1; seed <= p.seeds; seed++) {
    const rnd = mulberry32(seed); const lab = new Map(sigs.map((s) => [s.meet, rnd() < share ? 1 : -1]));
    plc.push(r3(mean(streamOf(bars, sigs, (s) => lab.get(s.meet), p).filter((t) => inWin(t, 'oos')).map((t) => t.net))));
  }
  const beaten = plc.filter((x) => res.F.oos.net > x).length;
  const t1 = res.F.oos.tNet, t2 = exT(exOos, 'oos');
  const [h1, h2] = holm([normSf(t1), normSf(t2)]);
  const T1 = { name: 'T1 follow the statement day, both sides', t: t1, tIs: res.F.is.tNet, holmP: r3(h1), beaten,
    pass: res.F.oos.net > 0 && t1 >= 2 && h1 < 0.05 && res.F.oos.n >= 30 && res.F.is.net > 0 && res.F2x.oos.net > 0 && beaten >= 38 };
  const T2 = { name: 'T2 follow minus the same-side baseline', exIs: exM(exIs), exOos: exM(exOos), tIs: exT(exIs, 'is'), t: t2, holmP: r3(h2), pass: exM(exOos) > 0 && t2 > 0 };
  const verdict = T1.pass && T2.pass ? 'PASS' : 'FAIL';
  const byYear = {}; for (const t of F) { const y = t.entryDay.slice(0, 4); (byYear[y] ||= { n: 0, net: 0 }); byYear[y].n++; byYear[y].net = r3(byYear[y].net + t.net); }
  const ctx = {};
  for (const [k, q] of [['hold 5', { ...p, hold: 5 }], ['hold 20', { ...p, hold: 20 }], ['read to D+1, entry D+2', { ...p, lag: 1 }]]) {
    const s2 = signals(bars, meets, q).sigs; const f = streamOf(bars, s2, (s) => s.side, q);
    ctx[k] = { is: summary(f, 'is', lastMonth), oos: summary(f, 'oos', lastMonth) };
  }
  return { p, source: SOURCE, first: ymd(bars[0].time), last: ymd(bars[bars.length - 1].time), lastMonth, candles: bars.length,
    meetings: meets.filter((m) => m >= '2007-01-01').length, signals: sigs.length, drop, longShare: r3(share),
    res, tests: { T1, T2 }, placebo: plc, verdict, byYear, context: ctx, trades: F.map(({ e, x, ...t }) => t) };
}

export function loadBars(raw) { return foldWeekend(raw.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }))); }

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const here = dirname(fileURLToPath(import.meta.url));
  const commit = execFileSync('git', ['rev-parse', '--short', 'origin/council-data']).toString().trim();
  const raw = JSON.parse(execFileSync('git', ['show', 'origin/council-data:research/daily/xau.json'], { maxBuffer: 1 << 28 }).toString());
  const r = study(loadBars(raw));
  r.data = { file: 'council-data research/daily/xau.json', commit, built: '2026-11-14' };
  writeFileSync(join(here, 'result.json'), JSON.stringify(r, null, 1) + '\n');
  const o = (x) => `n ${x.n} (${x.buys}/${x.sells}) gross ${x.gross} net ${x.net} t ${x.tNet} (${x.tGross}) stop$ ${x.stopMedianUsd} share ${x.costShare}`;
  for (const k of Object.keys(r.res)) console.log(k.padEnd(8), 'IS', o(r.res[k].is), '| OOS', o(r.res[k].oos));
  for (const k of Object.keys(r.context)) console.log(k.padEnd(8), 'IS', o(r.context[k].is), '| OOS', o(r.context[k].oos));
  console.log(JSON.stringify(r.tests), 'verdict', r.verdict, 'drop', JSON.stringify(r.drop), 'signals', r.signals, 'lastMonth', r.lastMonth);
  console.log('placebo', r.placebo.join(' '));
}
