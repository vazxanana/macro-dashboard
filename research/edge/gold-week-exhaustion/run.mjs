// Gold's week already stretched by mid-week, faded to the Friday close (pre-registered 14 Nov 2026, PREREGISTRATION.md,
// commit 0dd3a1efd): at the close of the week's 1st, 2nd or 3rd trading day, when the move from the week's open is at least
// 0.75 x the mean range of the 10 latest complete weeks, fade it from the next open to the week's last close; stop
// 1.5 x ATR(20). T1 both sides (primary), T2 buys, T3 sells; compared with the same side on the same entry weekday of every
// week. $0.60 a trade and long financing; t on calendar-month sums, Holm over three, 40 seeded placebos. Paper research only:
// nothing live reads this file.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

export const P = {
  AWR_N: 10, K: 0.75, MAX_POS: 2, ATR_N: 20, MULT: 1.5, SPREAD: 0.30, SLIP: 0.15, SEEDS: 40,
  IS: { from: '2007-01', to: '2016-12' }, OOS: { from: '2017-01', to: '2026-10' },
};
export const DATA_COMMIT = '67bac79eb';
export const PREREG_COMMIT = '0dd3a1efd';
const DIR = fileURLToPath(new URL('.', import.meta.url));

export const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export const toBars = (rows) => foldWeekend(rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })));
export const wday = (t) => new Date(t * 1000).getUTCDay();
// the Monday (UTC day start, unix seconds) of the calendar week holding t
export const weekKey = (t) => { const d = Math.floor(t / 86400) * 86400, w = wday(d); return d - ((w + 6) % 7) * 86400; };
export function monthsOf(w) {
  const out = []; let [y, m] = w.from.split('-').map(Number);
  const [ty, tm] = w.to.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } }
  return out;
}
export function atr(bars, i, n = P.ATR_N) {
  if (i < n) return null;
  let a = 0;
  for (let j = i - n + 1; j <= i; j++) a += Math.max(bars[j].high - bars[j].low, Math.abs(bars[j].high - bars[j - 1].close), Math.abs(bars[j].low - bars[j - 1].close));
  return a / n;
}
// weeks: [{ key, first, last, open, high, low }] (bar indices), and for every bar its week number and position in the week
export function weeks(bars) {
  const W = [], wk = [], pos = [];
  for (let i = 0; i < bars.length; i++) {
    const k = weekKey(bars[i].time);
    if (!W.length || W.at(-1).key !== k) W.push({ key: k, first: i, last: i, open: bars[i].open, high: bars[i].high, low: bars[i].low });
    const w = W.at(-1); w.last = i; w.high = Math.max(w.high, bars[i].high); w.low = Math.min(w.low, bars[i].low);
    wk.push(W.length - 1); pos.push(i - w.first);
  }
  return { W, wk, pos };
}
// mean range of the AWR_N weeks before week number k (reads none of week k)
export function awr(W, k, n = P.AWR_N) {
  if (k < n) return null;
  let s = 0; for (let j = k - n; j < k; j++) s += W[j].high - W[j].low;
  return s / n;
}
// signal at the close of day i: { side (fade), move, awr }; reads bars up to i only (and the week's first open)
export function eventAt(bars, i, wx = weeks(bars.slice(0, i + 1))) {
  const k = wx.wk[i], p = wx.pos[i];
  if (k == null || p > P.MAX_POS) return null;
  const A = awr(wx.W, k); if (!A) return null;
  const M = bars[i].close - wx.W[k].open;
  if (Math.abs(M) < P.K * A || M === 0) return null;
  return { side: -Math.sign(M), move: M, awr: A };
}
// the first signal day of each week whose next day is in the same week
export function events(bars) {
  const wx = weeks(bars), ev = []; let lastWeek = -1;
  for (let i = 0; i < bars.length - 1; i++) {
    const k = wx.wk[i]; if (k === lastWeek) continue;
    const e = eventAt(bars, i, wx); if (!e) continue;
    lastWeek = k;
    if (wx.wk[i + 1] !== k) continue;
    ev.push({ i, ...e });
  }
  return ev;
}

export const TESTS = [
  { id: 'T1', name: 'The fade, both sides (primary)', sides: [1, -1] },
  { id: 'T2', name: 'Buys only (weeks already down)', sides: [1] },
  { id: 'T3', name: 'Sells only (weeks already up)', sides: [-1] },
];

// one trade: signal at the close of day i, entry at day i+1's open, out at the close of the week's last day or at the stop
export function trade(bars, i, side, { costX = 1, wx } = {}) {
  const e = i + 1; if (e >= bars.length) return null;
  const W = wx || weeks(bars), k = W.wk[i]; if (W.wk[e] !== k) return null;
  const last = W.W[k].last;
  const a = atr(bars, i); if (!a) return null;
  const entry = bars[e].open, dist = P.MULT * a, stop = entry - side * dist;
  let exit = bars[last].close, how = 'time', xi = last, exitTime = bars[last].time + 22 * 3600;
  for (let j = e; j <= last; j++) {
    const b = bars[j];
    if (j > e && (side > 0 ? b.open <= stop : b.open >= stop)) { exit = b.open; how = 'gap'; xi = j; exitTime = b.time; break; }
    if (side > 0 ? b.low <= stop : b.high >= stop) { exit = stop; how = 'stop'; xi = j; exitTime = b.time + 12 * 3600; break; }
  }
  const gross = side * (exit - entry) / dist;
  const costR = costX * (P.SPREAD + 2 * P.SLIP) / dist;
  const n = side > 0 ? nights(bars[e].time, exitTime) : 0;
  const finR = side > 0 ? costX * n * FIN.xau.long * entry / dist : 0;
  return { i, xi, side, ewd: wday(bars[e].time), day: new Date(bars[i].time * 1000).toISOString().slice(0, 10), exitMonth: ym(bars[xi].time),
    entry, stop, exit, dist, how, gross, costR, finR, nights: n, net: gross - costR - finR };
}
export function runTest(bars, evs, T, opt = {}) {
  const wx = opt.wx || weeks(bars), out = [];
  for (const e of evs) {
    const side = opt.flip ? -e.side : e.side;
    if (!T.sides.includes(side)) continue;
    const t = trade(bars, e.i, side, { ...opt, wx }); if (t) out.push(t);
  }
  return out;
}
// same-side baseline: every week, the trade entered at each day d (2nd trading day on) of the week, held to the week's end
export function baselineTrades(bars, side, wx = weeks(bars), opt = {}) {
  const out = [];
  for (let i = 0; i + 1 < bars.length; i++) {
    if (wx.wk[i + 1] !== wx.wk[i]) continue;
    const t = trade(bars, i, side, { ...opt, wx }); if (t) out.push(t);
  }
  return out;
}

// ─── statistics ───
const inWin = (t, w) => t.exitMonth >= w.from && t.exitMonth <= w.to;
export function monthly(trades, w, f = 'net') {
  const m = new Map(monthsOf(w).map((k) => [k, 0]));
  for (const t of trades) if (m.has(t.exitMonth)) m.set(t.exitMonth, m.get(t.exitMonth) + t[f]);
  return [...m.values()];
}
export function tstat(xs) {
  const n = xs.length; if (n < 2) return { n, mean: 0, t: 0, sd: 0 };
  const mean = xs.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  return { n, mean, sd, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : 0 };
}
function erfc(x) { // Abramowitz-Stegun 7.1.26
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807
    + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}
export const pOne = (t) => 0.5 * erfc(t / Math.SQRT2);
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = Array(ps.length); let run = 0;
  idx.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (ps.length - k) * p)); out[i] = run; });
  return out;
}
export function drawdown(xs) { let c = 0, pk = 0, dd = 0; for (const x of xs) { c += x; pk = Math.max(pk, c); dd = Math.min(dd, c - pk); } return dd; }
const r3 = (x) => Math.round(x * 1000) / 1000, r2 = (x) => Math.round(x * 100) / 100;
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const cell = (t) => `${t.side}:${t.ewd}`;
// the matched same-side baseline of a set of trades: per (side, entry weekday) the baseline cell's mean net R in the window;
// excess = mean(net - cell mean), its standard error from the trades' sd and each cell mean's error (Welch-type)
export function excessOf(inW, base, w) {
  const cells = new Map();
  for (const b of base) { if (!inWin(b, w)) continue; const c = cell(b); if (!cells.has(c)) cells.set(c, []); cells.get(c).push(b.net); }
  const stat = new Map([...cells].map(([c, xs]) => [c, tstat(xs)]));
  const use = inW.filter((t) => stat.has(cell(t)) && stat.get(cell(t)).n >= 2), n = use.length;
  if (n < 2) return { baseNet: 0, excess: 0, t: 0 };
  const bm = use.map((t) => stat.get(cell(t)).mean), d = use.map((t, k) => t.net - bm[k]);
  const ts = tstat(use.map((t) => t.net));
  const cnt = new Map(); for (const t of use) cnt.set(cell(t), (cnt.get(cell(t)) || 0) + 1);
  let v = ts.sd ** 2 / n; for (const [c, m] of cnt) { const s = stat.get(c); v += (m / n) ** 2 * (s.sd ** 2 / s.n); }
  const ex = d.reduce((a, b) => a + b, 0) / n;
  return { baseNet: r3(bm.reduce((a, b) => a + b, 0) / n), excess: r3(ex), t: r2(v > 0 ? ex / Math.sqrt(v) : 0) };
}
export function window(trades, w, trades2x, base) {
  const inW = trades.filter((t) => inWin(t, w)), n = inW.length;
  const net = monthly(trades, w, 'net'), gross = monthly(trades, w, 'gross'), tn = tstat(net), tg = tstat(gross);
  const per = (f) => (n ? inW.reduce((a, t) => a + t[f], 0) / n : 0);
  const o = { trades: n, buys: inW.filter((t) => t.side > 0).length, months: net.length, won: n ? r3(inW.filter((t) => t.net > 0).length / n) : 0,
    stopped: n ? r3(inW.filter((t) => t.how !== 'time').length / n) : 0, medStop: r2(median(inW.map((t) => t.dist))),
    grossR: r3(per('gross')), netR: r3(per('net')), costR: r3(per('costR')), finR: r3(per('finR')),
    monthGross: r3(tg.mean), monthGrossT: r2(tg.t), monthNet: r3(tn.mean), monthNetT: r2(tn.t),
    totalNet: r2(net.reduce((a, b) => a + b, 0)), worstDD: r2(drawdown(net)) };
  if (trades2x) { const t2 = tstat(monthly(trades2x, w, 'net')); o.x2Net = r3(t2.mean); o.x2T = r2(t2.t); }
  if (base) Object.assign(o, (({ baseNet, excess, t }) => ({ baseNet, excess, excessT: t }))(excessOf(inW, base, w)));
  return o;
}

// ─── placebo: each real trade replaced by the baseline trade of a random week, same window, side and entry weekday ───
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function placebo(real, base, seed) {
  const rng = mulberry32(seed), out = [], by = new Map();
  for (const b of base) { const w = inWin(b, P.OOS) ? 'o' : inWin(b, P.IS) ? 'i' : null; if (!w) continue; const k = w + cell(b); if (!by.has(k)) by.set(k, []); by.get(k).push(b); }
  for (const t of real) {
    const w = inWin(t, P.OOS) ? 'o' : inWin(t, P.IS) ? 'i' : null; if (!w) continue;
    const src = by.get(w + cell(t)); if (src && src.length) out.push(src[Math.floor(rng() * src.length)]);
  }
  return out;
}

export function study(bars) {
  const wx = weeks(bars), evs = events(bars);
  const base = [...baselineTrades(bars, 1, wx), ...baselineTrades(bars, -1, wx)];
  const evIn = (w) => evs.filter((e) => { const m = ym(bars[e.i].time); return m >= w.from && m <= w.to; });
  const evCount = {};
  for (const [k, w] of [['is', P.IS], ['oos', P.OOS]]) { const x = evIn(w); evCount[k] = { weeks: wx.W.filter((W) => { const m = ym(W.key); return m >= w.from && m <= w.to; }).length, signals: x.length, buys: x.filter((e) => e.side > 0).length }; }
  const tests = TESTS.map((T) => {
    const tr = runTest(bars, evs, T, { wx }), tr2 = runTest(bars, evs, T, { wx, costX: 2 });
    const is = window(tr, P.IS, null, base), oos = window(tr, P.OOS, tr2, base);
    const pl = [];
    for (let s = 1; s <= P.SEEDS; s++) pl.push(tstat(monthly(placebo(tr, base, s), P.OOS)).t);
    pl.sort((a, b) => a - b);
    const q = (p) => r2(pl[Math.min(pl.length - 1, Math.floor(p * pl.length))]);
    const years = {}, byDay = {};
    for (const t of tr) {
      if (t.exitMonth > P.OOS.to || t.exitMonth < P.IS.from) continue;
      const y = t.exitMonth.slice(0, 4); years[y] = years[y] || { n: 0, gross: 0, net: 0 }; years[y].n++; years[y].gross += t.gross; years[y].net += t.net;
      const d = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'][t.ewd]; byDay[d] = byDay[d] || { n: 0, net: 0 }; byDay[d].n++; byDay[d].net += t.net;
    }
    for (const y in years) { years[y].gross = r2(years[y].gross); years[y].net = r2(years[y].net); }
    for (const d in byDay) byDay[d].net = r2(byDay[d].net);
    return { id: T.id, name: T.name, is, oos, pOne: pOne(oos.monthNetT),
      placebo: { p5: q(0.05), p50: q(0.5), p95: q(0.95), max: r2(pl.at(-1)), below: pl.filter((x) => x < oos.monthNetT).length },
      years, byEntryDay: byDay,
      trades: tr.filter((t) => t.exitMonth >= P.IS.from && t.exitMonth <= P.OOS.to).map((t) => ({ day: t.day, side: t.side, exitMonth: t.exitMonth, how: t.how, stop: r2(t.dist), gross: r3(t.gross), net: r3(t.net) })) };
  });
  const hp = holm(tests.map((t) => t.pOne));
  tests.forEach((t, k) => {
    t.holmP = r3(hp[k]); t.pOne = r3(t.pOne);
    t.checks = { oosPositive: t.oos.monthNet > 0, oosT2: t.oos.monthNetT >= 2, holm05: hp[k] < 0.05, isSameSign: t.is.monthNet > 0,
      x2Positive: t.oos.x2Net > 0, abovePlacebo: t.placebo.below > 38, beatsBaseline: t.oos.excess > 0 };
    t.pass = Object.values(t.checks).every(Boolean);
  });
  const ws = (tr) => ({ is: window(tr, P.IS), oos: window(tr, P.OOS) });
  const cont = runTest(bars, evs, TESTS[0], { wx, flip: true });
  const baseline = { long: ws(base.filter((b) => b.side > 0)), short: ws(base.filter((b) => b.side < 0)), continuation: ws(cont) };
  return { days: bars.length, firstDay: new Date(bars[0].time * 1000).toISOString().slice(0, 10), lastDay: new Date(bars.at(-1).time * 1000).toISOString().slice(0, 10), events: evCount, tests, baseline };
}

const s = (x) => (x >= 0 ? '+' : '') + x;
export function verdictLine(res) {
  const [T1] = res.tests, pass = T1.pass;
  return `${pass ? 'PASS' : 'FAIL'}, ${res.tests.filter((t) => t.pass).length} of 3: fading a gold week stretched 0.75 weekly ranges by mid-week made ${s(T1.oos.netR)}R a trade net 2017-26 (n ${T1.oos.trades}, month t ${T1.oos.monthNetT.toFixed(2)}), ${s(T1.oos.excess)}R over the same-side baseline`;
}

function fmt(x) { return (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(3); }
function fmtT(x) { return (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(2); }
export function report(res) {
  const L = [];
  L.push('# Gold\'s week already stretched by mid-week, faded to the Friday close: result (14 Nov 2026)', '');
  L.push(`**Verdict: ${verdictLine(res)}.**`, '');
  L.push(`Paper research only. No live rule, size, filter, council member or page changed. Rule, costs, windows, the three tests, the same-side baseline and the placebo were fixed in \`PREREGISTRATION.md\`, pushed alone (${PREREG_COMMIT}) before any signal or trade was computed. Data: council-data \`research/daily/xau.json\` at \`${DATA_COMMIT}\`, OANDA mid daily candles, weekend stubs folded into the next weekday; ${res.days} trading days from ${res.firstDay} to ${res.lastDay}. Signal weeks (a move from the week's open of at least 0.75 x the mean range of the 10 previous weeks by the close of the 1st, 2nd or 3rd trading day): 2007-16 ${res.events.is.signals} of ${res.events.is.weeks} weeks (${res.events.is.buys} buys), 2017-26 ${res.events.oos.signals} of ${res.events.oos.weeks} (${res.events.oos.buys} buys). A stand-alone rule, not a gate, exit, entry or size of the gold book, and none of its 2006-17 positions is read (owner decision 44); not an edge without n and t.`, '');
  L.push('## The three tests (R a trade, 1R = the stop distance, 1.5 x ATR(20), held to the week\'s last close; monthly sums of net R on every calendar month of the window, by exit month)', '');
  L.push('| Test | Window | Trades (buys) | Won | Stopped | Median stop $ | Gross R | Cost R | Financing R | Net R | Same-side baseline net R | Excess R (t) | Month net (t) | Month gross t | Total net R | Worst DD R | OOS at 2x costs (t) | One-sided p | Holm p | Pass |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  const row = (w, lab, last, t) => `| ${lab} | ${last ? 'OOS 2017-01 to 2026-10' : 'IS 2007-01 to 2016-12'} | ${w.trades} (${w.buys}) | ${(w.won * 100).toFixed(0)}% | ${(w.stopped * 100).toFixed(0)}% | ${w.medStop.toFixed(2)} | ${fmt(w.grossR)} | ${fmt(w.costR)} | ${fmt(w.finR)} | ${fmt(w.netR)} | ${w.baseNet != null ? fmt(w.baseNet) : ''} | ${w.excess != null ? `${fmt(w.excess)} (${fmtT(w.excessT)})` : ''} | ${fmt(w.monthNet)} (${fmtT(w.monthNetT)}) | ${fmtT(w.monthGrossT)} | ${fmtT(w.totalNet)} | ${fmtT(w.worstDD)} | ${last && t ? `${fmt(w.x2Net)} (${fmtT(w.x2T)})` : ''} | ${last && t ? t.pOne.toFixed(3) : ''} | ${last && t ? t.holmP.toFixed(3) : ''} | ${last && t ? (t.pass ? 'yes' : 'no') : ''} |`;
  for (const t of res.tests) L.push(row(t.is, `${t.id} ${t.name}`, false, t), row(t.oos, '', true, t));
  for (const [k, lab] of [['long', 'Long on every Tue-Fri entry day to the week\'s end (baseline pool, overlapping, not a test)'], ['short', 'Short on every Tue-Fri entry day to the week\'s end (baseline pool, overlapping, not a test)'], ['continuation', 'Continuation: T1\'s signals followed instead of faded (reading only, not a test)']]) L.push(row(res.baseline[k].is, lab, false), row(res.baseline[k].oos, '', true));
  L.push('', 'The baseline pool rows overlap (up to four entries a week on the same side), so their month t is not a test statistic; they are the source of each test\'s matched baseline (same side, same entry weekday, same window).', '');
  L.push('Pass bar (pre-registered, each test on its own, Holm over three; the verdict follows T1): OOS net month mean > 0 with t >= 2 and Holm p < 0.05, the in-sample mean > 0, the OOS mean > 0 at 2x costs and financing, more than 38 of 40 placebo seeds below the real OOS t, and the OOS excess over the same-side baseline > 0.', '');
  L.push('| Check | ' + res.tests.map((t) => t.id).join(' | ') + ' |', '|---|' + res.tests.map(() => '---').join('|') + '|');
  for (const k of Object.keys(res.tests[0].checks)) L.push(`| ${k} | ` + res.tests.map((t) => (t.checks[k] ? 'yes' : 'no')).join(' | ') + ' |');
  L.push('', '## Placebo (40 seeds: each real trade replaced by the same-side, same-entry-weekday trade of a random week of the same window; OOS net month t)', '');
  L.push('| Test | p5 | p50 | p95 | max | Real | Seeds below the real |', '|---|---|---|---|---|---|---|');
  for (const t of res.tests) L.push(`| ${t.id} | ${fmtT(t.placebo.p5)} | ${fmtT(t.placebo.p50)} | ${fmtT(t.placebo.p95)} | ${fmtT(t.placebo.max)} | ${fmtT(t.oos.monthNetT)} | ${t.placebo.below} of 40 |`);
  L.push('', '## T1 by entry weekday, 2007-26 (sum of net R)', '');
  L.push('| Entry day | Trades | Net R |', '|---|---|---|');
  for (const d of ['Tue', 'Wed', 'Thu', 'Fri']) { const x = res.tests[0].byEntryDay[d]; if (x) L.push(`| ${d} | ${x.n} | ${fmtT(x.net)} |`); }
  L.push('', '## Per year (sum of net R by exit year)', '');
  const ys = [...new Set(res.tests.flatMap((t) => Object.keys(t.years)))].sort();
  L.push('| Year | ' + res.tests.map((t) => `${t.id} n | ${t.id} net`).join(' | ') + ' |', '|---|' + res.tests.map(() => '---|---').join('|') + '|');
  for (const y of ys) L.push(`| ${y} | ` + res.tests.map((t) => (t.years[y] ? `${t.years[y].n} | ${fmtT(t.years[y].net)}` : '0 | 0')).join(' | ') + ' |');
  L.push('', '## Reading', '');
  return L;
}

// written after the run; the figures it quotes are checked against result.json by tests/gold-week-exhaustion.test.mjs
export const READING = [
  '- **The fade does nothing.** Out of sample T1 made −0.014R a trade net (n 76, month t −0.17; +0.009R gross), in sample −0.066R (n 64, month t −0.77); 19 of 40 placebo seeds sit below it. Costs are not the reason: the round trip took 0.015R and financing 0.008R a trade out of sample (median stop $46.85), against a gross result of about zero.',
  '- **Against the same-side baseline it is noise either way.** Out of sample the matched baseline (same side, same entry weekday, every week) made −0.031R, so T1 is +0.017R above it (t 0.20); in sample −0.042R below it (t −0.46). The buys after a down week (T2) made −0.023R net out of sample against +0.062R for buying the same weekday of every week (excess −0.085R, t −0.69): a stretched down week is, if anything, a worse week to buy than an ordinary one. The sells after an up week (T3) lost less than selling every week (−0.008R against −0.099R, excess +0.091R, t 0.77), which is gold\'s rise showing on the baseline, not a signal.',
  '- Following the stretched week instead (the mirror, reading only) lost too: −0.038R out of sample (n 76) and −0.080R in sample. A week that has already travelled a normal week\'s range by mid-week neither gives it back nor extends it in any measurable way on 2007-26 daily candles.',
  '- Nothing proposed. Not an edge, not a gate on the gold book; nothing live changed. No variant (threshold, lookback, stop, hold) is tried here.',
];

export function load(file) {
  const txt = file ? fs.readFileSync(file, 'utf8') : execFileSync('git', ['show', `${DATA_COMMIT}:research/daily/xau.json`], { encoding: 'utf8', maxBuffer: 64e6 });
  return toBars(JSON.parse(txt).rows);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const bars = load(process.argv[2]);
  const res = study(bars);
  const out = { study: 'gold-week-exhaustion', built: '2026-11-14', dataCommit: DATA_COMMIT, preregCommit: PREREG_COMMIT, params: P, fin: FIN.xau.long,
    verdict: res.tests[0].pass ? 'PASS' : 'FAIL', headline: verdictLine(res), ...res };
  fs.writeFileSync(DIR + 'result.json', JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(DIR + 'RESULT.md', [...report(res), ...READING].join('\n') + '\n');
  console.log(verdictLine(res), verdictLine(res).length);
  console.log('events', JSON.stringify(res.events));
  for (const t of res.tests) console.log(t.id, JSON.stringify(t.is), '\n  ', JSON.stringify(t.oos), t.holmP, JSON.stringify(t.placebo), JSON.stringify(t.byEntryDay));
  for (const k in res.baseline) console.log('BL', k, JSON.stringify(res.baseline[k]));
}
