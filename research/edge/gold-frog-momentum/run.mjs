// gold-frog-momentum: gold's 60-day trend traded only when it was made of many small same-way days (information
// discreteness, "frog in the pan"), against the same trades without the condition. Pre-registered in PREREGISTRATION.md.
// Paper research only; stand-alone on gold; nothing live reads this file.
//   node research/edge/gold-frog-momentum/run.mjs        (reads council-data with git show, writes result.json)
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

export const P = { L: 60, idCut: -0.10, atrN: 20, stopAtr: 2, hold: 20, cost: 0.60, isFrom: '2007-01-01', isTo: '2016-12-31', oosFrom: '2017-01-01', seeds: 40 };
const DAY = 86400;
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);

// ISO week key of a unix time (UTC)
export function isoWeek(t) {
  const d = new Date(t * 1000); const wd = (d.getUTCDay() + 6) % 7;
  const th = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - wd + 3));
  const y = th.getUTCFullYear(); const j1 = Date.UTC(y, 0, 4);
  return y * 100 + 1 + Math.round((th - j1) / 864e5 / 7 - ((new Date(j1).getUTCDay() + 6) % 7 - 3) / 7);
}

// signal days: last candle of each ISO week with >= L earlier candles. Uses candles 0..i only.
export function signals(bars, p = P) {
  const out = [];
  for (let i = p.L; i < bars.length - 1; i++) {
    if (isoWeek(bars[i + 1].time) === isoWeek(bars[i].time)) continue;
    const c = bars[i].close; const R = c / bars[i - p.L].close - 1;
    if (!(R !== 0) || !Number.isFinite(R)) continue;
    let pos = 0, neg = 0;
    for (let k = i - p.L + 1; k <= i; k++) { const r = bars[k].close / bars[k - 1].close - 1; if (r > 0) pos++; else if (r < 0) neg++; }
    const s = Math.sign(R); const id = s * (neg - pos) / p.L;
    let tr = 0; for (let k = i - p.atrN + 1; k <= i; k++) tr += Math.max(bars[k].high, bars[k - 1].close) - Math.min(bars[k].low, bars[k - 1].close);
    out.push({ i, t: bars[i].time, side: s, R60: R, id: +id.toFixed(6), atr: tr / p.atrN, cont: id <= p.idCut + 1e-12 });
  }
  return out;
}

// one trade from signal s: entry at the open of i+1, stop 2 ATR, out at the close of the 20th candle
export function trade(bars, s, p = P, costMult = 1) {
  const e = s.i + 1; if (e >= bars.length) return null;
  const entry = bars[e].open; const risk = p.stopAtr * s.atr; const stop = entry - s.side * risk;
  let j = e, exit = null, why = 'time';
  for (; j < bars.length && j < e + p.hold; j++) {
    const b = bars[j];
    if (s.side > 0 ? b.open <= stop : b.open >= stop) { exit = b.open; why = 'stop'; break; }
    if (s.side > 0 ? b.low <= stop : b.high >= stop) { exit = stop; why = 'stop'; break; }
  }
  if (exit == null) { if (j < e + p.hold) return null; j = e + p.hold - 1; exit = bars[j].close; }
  const tIn = bars[e].time; const tOut = bars[j].time + DAY - 1;
  const n = s.side > 0 ? nights(tIn, tOut) : 0;
  const fin = s.side > 0 ? n * FIN.xau.long * entry : 0;
  const gross = s.side * (exit - entry) / risk;
  const net = gross - costMult * (p.cost + fin) / risk;
  return { sig: ymd(s.t), entryDay: ymd(tIn), exitDay: ymd(bars[j].time), e, x: j, side: s.side, entry, stop: +stop.toFixed(3), exit: +exit.toFixed(3), riskUsd: +risk.toFixed(3), why, nights: n, gross: +gross.toFixed(5), net: +net.toFixed(5), cont: s.cont, id: s.id };
}

// one stream, one position at a time
export function stream(bars, sigs, pick, p = P, costMult = 1) {
  const out = []; let free = 0;
  for (const s of sigs) {
    if (s.i + 1 < free || !pick(s)) continue;
    const tr = trade(bars, s, p, costMult); if (!tr) continue;
    out.push(tr); free = tr.x + 1;
  }
  return out;
}

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const sd = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
export function months(from, to) { const o = []; let [y, m] = from.split('-').map(Number); const [Y, M] = to.split('-').map(Number); while (y < Y || (y === Y && m <= M)) { o.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } } return o; }
export function monthT(trades, key, from, to) {
  const sum = Object.fromEntries(months(from, to).map((m) => [m, 0]));
  for (const t of trades) { const k = t.exitDay.slice(0, 7); if (k in sum) sum[k] += t[key]; }
  const v = Object.values(sum); const s = sd(v); return s ? mean(v) / (s / Math.sqrt(v.length)) : 0;
}
export function welch(a, b) { const va = sd(a) ** 2 / a.length, vb = sd(b) ** 2 / b.length; return va + vb > 0 ? (mean(a) - mean(b)) / Math.sqrt(va + vb) : 0; }
export function normSf(z) { // one-sided upper tail
  const t = 1 / (1 + 0.2316419 * Math.abs(z)); const d = 0.3989423 * Math.exp(-z * z / 2);
  const q = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z >= 0 ? q : 1 - q;
}
export function holm(ps) { const ix = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]); const out = Array(ps.length); let run = 0; ix.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, p * (ps.length - r))); out[i] = run; }); return out; }
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const r3 = (x) => +x.toFixed(3);
export function summary(trades, win, lastMonth) {
  const from = win === 'is' ? P.isFrom : P.oosFrom; const to = win === 'is' ? P.isTo.slice(0, 7) : lastMonth;
  const tr = trades.filter((t) => (win === 'is' ? t.entryDay >= P.isFrom && t.entryDay <= P.isTo : t.entryDay >= P.oosFrom));
  const g = tr.map((t) => t.gross), n = tr.map((t) => t.net);
  const stops = tr.map((t) => t.riskUsd).sort((a, b) => a - b);
  return { n: tr.length, buys: tr.filter((t) => t.side > 0).length, sells: tr.filter((t) => t.side < 0).length,
    gross: r3(mean(g)), net: r3(mean(n)), costR: r3(mean(g) - mean(n)), costShare: mean(g) ? r3((mean(g) - mean(n)) / Math.abs(mean(g))) : null,
    tNet: r3(monthT(tr, 'net', from, to)), tGross: r3(monthT(tr, 'gross', from, to)), stopMedianUsd: stops.length ? r3(stops[stops.length >> 1]) : null,
    win: tr.length ? r3(tr.filter((t) => t.net > 0).length / tr.length) : null, total: r3(n.reduce((a, b) => a + b, 0)) };
}

export function study(bars, p = P) {
  const sigs = signals(bars, p);
  const lastMonth = ym(bars[bars.length - 1].time);
  const C = stream(bars, sigs, (s) => s.cont, p), D = stream(bars, sigs, (s) => !s.cont, p), B = stream(bars, sigs, () => true, p);
  const C2 = stream(bars, sigs, (s) => s.cont, p, 2);
  const oos = (a) => a.filter((t) => t.entryDay >= p.oosFrom), ins = (a) => a.filter((t) => t.entryDay >= p.isFrom && t.entryDay <= p.isTo);
  const sideSum = (a, side) => summary(a.filter((t) => t.side === side), 'oos', lastMonth);
  const S = (a) => ({ is: summary(a, 'is', lastMonth), oos: summary(a, 'oos', lastMonth) });
  const res = { C: S(C), D: S(D), B: S(B), C2x: S(C2) };
  // placebo: random continuous labels at the sample's share
  const share = sigs.filter((s) => s.cont).length / sigs.length;
  const plc = [];
  for (let seed = 1; seed <= p.seeds; seed++) {
    const rnd = mulberry32(seed); const lab = new Map(sigs.map((s) => [s.i, rnd() < share]));
    plc.push(r3(mean(oos(stream(bars, sigs, (s) => lab.get(s.i), p)).map((t) => t.net))));
  }
  const beaten = plc.filter((x) => res.C.oos.net > x).length;
  const t1 = res.C.oos.tNet, t2 = r3(welch(oos(C).map((t) => t.net), oos(D).map((t) => t.net)));
  const t2is = r3(welch(ins(C).map((t) => t.net), ins(D).map((t) => t.net)));
  const [h1, h2] = holm([normSf(t1), normSf(t2)]);
  const diffOos = r3(res.C.oos.net - res.D.oos.net), diffIs = r3(res.C.is.net - res.D.is.net);
  const T1 = { name: 'T1 continuous moves, both sides', t: t1, holmP: r3(h1), beaten, pass: res.C.oos.net > 0 && t1 >= 2 && h1 < 0.05 && res.C.is.net > 0 && res.C2x.oos.net > 0 && res.C.oos.n >= 30 && beaten >= 38 };
  const T2 = { name: 'T2 continuous minus discrete', diffIs, diffOos, tIs: t2is, t: t2, holmP: r3(h2), pass: diffOos > 0 && t2 >= 2 && h2 < 0.05 && diffIs > 0 };
  const byYear = {}; for (const t of C) { const y = t.entryDay.slice(0, 4); (byYear[y] ||= { n: 0, net: 0 }); byYear[y].n++; byYear[y].net = r3(byYear[y].net + t.net); }
  const ctx = {};
  for (const cut of [-0.2, 0]) { const q = { ...p, idCut: cut }; const s2 = signals(bars, q); ctx[`idCut ${cut}`] = summary(stream(bars, s2, (s) => s.cont, q), 'oos', lastMonth); }
  const verdict = T1.pass ? (T2.pass ? 'PASS' : 'PASS (not credited to the condition)') : (T2.pass ? 'PARTIAL' : 'FAIL');
  return { p, first: ymd(bars[0].time), last: ymd(bars[bars.length - 1].time), candles: bars.length, signals: sigs.length, contShare: r3(share),
    res, sides: { C: { buys: sideSum(C, 1), sells: sideSum(C, -1) }, B: { buys: sideSum(B, 1), sells: sideSum(B, -1) } },
    tests: { T1, T2 }, placebo: plc, verdict, byYear, context: ctx, trades: { C: C.map(({ e, x, ...t }) => t) } };
}

export function loadBars(raw) { return foldWeekend(raw.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }))); }

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const here = dirname(fileURLToPath(import.meta.url));
  const commit = execFileSync('git', ['rev-parse', '--short', 'origin/council-data']).toString().trim();
  const raw = JSON.parse(execFileSync('git', ['show', 'origin/council-data:research/daily/xau.json'], { maxBuffer: 1 << 28 }).toString());
  const r = study(loadBars(raw));
  r.data = { file: 'council-data research/daily/xau.json', commit, built: '2026-11-14' };
  writeFileSync(join(here, 'result.json'), JSON.stringify(r, null, 1) + '\n');
  const o = (x) => `n ${x.n} gross ${x.gross} net ${x.net} t ${x.tNet} (${x.tGross}) stop$ ${x.stopMedianUsd}`;
  for (const k of ['C', 'D', 'B', 'C2x']) console.log(k, 'IS', o(r.res[k].is), '| OOS', o(r.res[k].oos));
  console.log(JSON.stringify(r.tests), 'verdict', r.verdict, 'share', r.contShare);
}
