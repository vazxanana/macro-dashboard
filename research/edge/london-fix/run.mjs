// Edge research · london-fix: on every London weekday, A = the move from 15:30 to 15:55 London (M5 opens). When |A| is over
// 1.5 x its 20-weekday median, T1 fades A from 16:05 to 17:00 London and T2 follows A from 15:55 to 16:05, both with a stop of
// 1 x |A|; six forex majors pooled, raw-spread costs plus slippage, net R. Two tests, Holm, a 40-seed placebo that moves the
// windows to another half-hour of the London afternoon (PREREGISTRATION.md).
//   node research/edge/london-fix/run.mjs <candleDir>   (<pair>-5m.json.gz; writes result.json and RESULT.md here)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---- London time ---------------------------------------------------------------------------------------------------------
export const addD = (s, n) => new Date(Date.parse(s + 'T12:00:00Z') + n * 86400e3).toISOString().slice(0, 10);
const dowU = (s) => new Date(s + 'T12:00:00Z').getUTCDay();
export const isWeekday = (s) => { const w = dowU(s); return w >= 1 && w <= 5; };
const LON = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
const offCache = new Map();
// London's offset from UTC in minutes on a date (read at 12:00 UTC: clocks change at 01:00 UTC, far from the afternoon)
export function londonOffsetMin(ymd) {
  if (!offCache.has(ymd)) {
    const [h, m] = LON.format(new Date(ymd + 'T12:00:00Z')).split(':').map(Number);
    offCache.set(ymd, (h * 60 + m) - 12 * 60);
  }
  return offCache.get(ymd);
}
// the UTC second of London wall-clock minute `min` (minutes after midnight) on London date ymd
export const londonT = (ymd, min) => Date.parse(ymd + 'T00:00:00Z') / 1000 + (min - londonOffsetMin(ymd)) * 60;
export const hm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// the windows of a fix at minute F (London): A from F-30 to F-5, T2 F-5 -> F+5, T1 F+5 -> F+60
export const FIX = 16 * 60;
export function windows(F) {
  return { a0: F - 30, a1: F - 5, T2: { entry: F - 5, exit: F + 5, side: 1 }, T1: { entry: F + 5, exit: F + 60, side: -1 } };
}
export const SLOTS = [12 * 60, 12 * 60 + 30, 13 * 60, 13 * 60 + 30, 14 * 60, 14 * 60 + 30, 15 * 60, 17 * 60, 17 * 60 + 30, 18 * 60];

// ---- prices --------------------------------------------------------------------------------------------------------------
export function index(bars) { const m = new Map(); bars.forEach((b, i) => m.set(b[0], i)); return { bars, at: m }; }
export const EXIT_GRACE = 900;
export function openAt(ix, t) { const i = ix.at.get(t); return i == null ? null : { i, px: ix.bars[i][1] }; }
// open of the candle at t; else the close of the last candle before t that started <= 15 min before t
export function exitPx(ix, t) {
  const i = ix.at.get(t); if (i != null) return ix.bars[i][1];
  for (let k = 1; k <= EXIT_GRACE / 300; k++) { const j = ix.at.get(t - 300 * k); if (j != null) return ix.bars[j][4]; }
  return null;
}
export function moveA(ix, ymd, F = FIX) {
  const w = windows(F), a = openAt(ix, londonT(ymd, w.a0)), b = openAt(ix, londonT(ymd, w.a1));
  return a && b ? b.px - a.px : null;
}
const median = (a) => { const s = [...a].sort((p, q) => p - q), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
export const EVENT_K = 1.5, LOOKBACK = 20, MIN_LOOK = 15;
// reference = median |A| of the 20 weekdays strictly before `days[k]` (null when fewer than 15 have an A)
export function reference(aOf, days, k) {
  if (k < LOOKBACK) return null;
  const v = days.slice(k - LOOKBACK, k).map(aOf).filter((x) => x != null).map(Math.abs);
  return v.length >= MIN_LOOK ? median(v) : null;
}
export const isEvent = (A, ref) => A != null && ref != null && ref > 0 && Math.abs(A) > EVENT_K * ref;

// ---- costs ---------------------------------------------------------------------------------------------------------------
export const PAIRS = { eurusd: 'EUR/USD', gbpusd: 'GBP/USD', usdjpy: 'USD/JPY', audusd: 'AUD/USD', usdchf: 'USD/CHF', eurjpy: 'EUR/JPY' };
export const pipOf = (pair) => (pair.endsWith('jpy') ? 0.01 : 0.0001);
export const SPREAD_PIPS = 0.3, SLIP_PIPS = 0.5, COMMISSION = 22.5e-6;   // USD 22.5 per million a side
export const costPx = (pair, entry) => (SPREAD_PIPS + 2 * SLIP_PIPS) * pipOf(pair) + 2 * COMMISSION * entry;

// one trade of test `id` (T1 / T2) on day ymd, given A; null when a price is missing
export function trade(ix, pair, id, ymd, A, F = FIX) {
  const D = Math.abs(A); if (!(D > 0)) return null;
  const w = windows(F)[id], side = w.side * Math.sign(A);
  const entryT = londonT(ymd, w.entry), exitT = londonT(ymd, w.exit), e = openAt(ix, entryT), xp = exitPx(ix, exitT);
  if (!e || xp == null) return null;
  const stop = e.px - side * D;
  let out = xp, how = 'time';
  for (let i = e.i; i < ix.bars.length && ix.bars[i][0] < exitT; i++) {
    const [, o, h, l] = ix.bars[i];
    if (side > 0 ? o <= stop : o >= stop) { out = o; how = 'gap'; break; }
    if (side > 0 ? l <= stop : h >= stop) { out = stop; how = 'stop'; break; }
  }
  const R = side * (out - e.px) / D, cR = costPx(pair, e.px) / D;
  return { pair, day: ymd, side, entryT, exitT, entry: e.px, stop, D, exit: out, how, R, costR: cR, net: R - cR, net2: R - 2 * cR };
}

// every event trade of one pair at one slot: Map day -> { A, ref, T1, T2 }; plus counts
export function runSlot(bars, pair, days, F = FIX) {
  const ix = bars.at instanceof Map ? bars : index(bars), aMap = new Map();
  for (const d of days) aMap.set(d, moveA(ix, d, F));
  const aOf = (d) => aMap.get(d), ev = new Map(), counts = { noA: 0, events: 0, noTrade: { T1: 0, T2: 0 } };
  days.forEach((d, k) => {
    const A = aOf(d); if (A == null) { counts.noA++; return; }
    const ref = reference(aOf, days, k);
    if (!isEvent(A, ref)) return;
    counts.events++;
    const r = { A, ref };
    for (const id of ['T1', 'T2']) { r[id] = trade(ix, pair, id, d, A, F); if (!r[id]) counts.noTrade[id]++; }
    ev.set(d, r);
  });
  return { ev, counts };
}

// ---- statistics ----------------------------------------------------------------------------------------------------------
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
export function monthT(trades, key = 'net') {
  const m = new Map(); for (const t of trades) { const k = t.day.slice(0, 7); m.set(k, (m.get(k) || 0) + t[key]); }
  const v = [...m.values()]; if (v.length < 3) return { months: v.length, t: null };
  return { months: v.length, t: mean(v) / (sd(v) / Math.sqrt(v.length)) };
}
export function normCdf(z) {   // Abramowitz-Stegun 7.1.26
  const x = Math.abs(z) / Math.SQRT2, k = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}
const r4 = (v, d = 4) => Math.round(v * 10 ** d) / 10 ** d;
export function summary(trades, pip) {
  if (!trades.length) return { n: 0 };
  const net = trades.map((t) => t.net), mt = monthT(trades), mt2 = monthT(trades, 'net2');
  const out = {
    n: trades.length, netR: r4(mean(net)), grossR: r4(mean(trades.map((t) => t.R))), costR: r4(mean(trades.map((t) => t.costR))),
    net2R: r4(mean(trades.map((t) => t.net2))), totalR: r4(net.reduce((s, v) => s + v, 0), 2),
    months: mt.months, t: mt.t == null ? null : r4(mt.t, 2), t2: mt2.t == null ? null : r4(mt2.t, 2),
    tradeT: trades.length > 2 ? r4(mean(net) / (sd(net) / Math.sqrt(net.length)), 2) : null,
    win: r4(trades.filter((t) => t.net > 0).length / trades.length), stopShare: r4(trades.filter((t) => t.how !== 'time').length / trades.length),
  };
  if (pip) out.stopPips = r4(median(trades.map((t) => t.D)) / pip, 1);
  return out;
}
export function holm(ps, alpha = 0.05) {
  const o = ps.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p), ok = ps.map(() => false), adj = ps.map(() => 1);
  let run = 0, go = true;
  o.forEach(({ p, i }, k) => { run = Math.max(run, Math.min(1, p * (ps.length - k))); adj[i] = run; if (go && p <= alpha / (ps.length - k)) ok[i] = true; else go = false; });
  return { ok, adj };
}
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---- the study -----------------------------------------------------------------------------------------------------------
export const TESTS = [{ id: 'T1', name: 'Fade after the fix (16:05 -> 17:00 London, against A)' }, { id: 'T2', name: 'Follow into the fix (15:55 -> 16:05 London, with A)' }];
export const DECISIVE = ['2020-01-01', null], REPLICATION = ['2016-01-01', '2019-12-31'];
export const SEEDS = 40, P_RANK = 38, ALPHA = 0.05, T_BAR = 2;
export const inWin = (d, [a, b]) => d >= a && (b == null || d <= b);

export function study(candles, firstDay, lastDay) {
  const days = []; for (let d = firstDay; d <= lastDay; d = addD(d, 1)) if (isWeekday(d)) days.push(d);
  const ixs = Object.fromEntries(Object.keys(candles).map((p) => [p, index(candles[p])]));
  const real = {}, slots = {};
  for (const p of Object.keys(candles)) {
    real[p] = runSlot(ixs[p], p, days, FIX);
    slots[p] = Object.fromEntries(SLOTS.map((F) => [F, runSlot(ixs[p], p, days, F).ev]));
  }
  const out = { tests: {}, counts: Object.fromEntries(Object.entries(real).map(([p, r]) => [p, r.counts])) }, ps = [];
  const decDays = days.filter((d) => inWin(d, DECISIVE));
  // placebo slot draws: one per seed and decisive day, shared by the two tests and the six pairs
  const draws = [];
  for (let s = 1; s <= SEEDS; s++) { const rnd = mulberry32(s); draws.push(decDays.map(() => SLOTS[Math.floor(rnd() * SLOTS.length)])); }
  for (const T of TESTS) {
    const all = Object.keys(candles).flatMap((p) => [...real[p].ev.values()].map((e) => e[T.id]).filter(Boolean));
    const dec = all.filter((t) => inWin(t.day, DECISIVE)), rep = all.filter((t) => inWin(t.day, REPLICATION));
    const plac = draws.map((slotOf) => {
      const tr = [];
      decDays.forEach((d, k) => { for (const p of Object.keys(candles)) { const e = slots[p][slotOf[k]].get(d); if (e && e[T.id]) tr.push(e[T.id]); } });
      return { n: tr.length, netR: mean(tr.map((t) => t.net)) };
    });
    const sorted = plac.map((x) => x.netR).sort((a, b) => a - b), p95 = sorted[P_RANK - 1];
    const sD = summary(dec), sR = summary(rep), p = sD.t == null ? 1 : 1 - normCdf(sD.t);
    ps.push(p);
    const byPair = {}, byYear = {}, bySlot = {};
    for (const pr of Object.keys(candles)) {
      const a = all.filter((t) => t.pair === pr);
      byPair[pr] = { decisive: summary(a.filter((t) => inWin(t.day, DECISIVE)), pipOf(pr)), replication: summary(a.filter((t) => inWin(t.day, REPLICATION)), pipOf(pr)) };
    }
    for (const t of all) if (t.day >= REPLICATION[0]) (byYear[t.day.slice(0, 4)] ||= []).push(t);
    for (const F of SLOTS) {
      const tr = Object.keys(candles).flatMap((pr) => [...slots[pr][F].values()].map((e) => e[T.id]).filter((t) => t && inWin(t.day, DECISIVE)));
      const s = summary(tr); bySlot[hm(F)] = { n: s.n, netR: s.netR, grossR: s.grossR, costR: s.costR, t: s.t };
    }
    out.tests[T.id] = {
      name: T.name, decisive: sD, replication: sR, pOneSided: r4(p),
      placebo: { seeds: SEEDS, rank: P_RANK, p95: r4(p95), median: r4(median(plac.map((x) => x.netR))), beats: plac.filter((x) => sD.netR > x.netR).length,
        nMedian: median(plac.map((x) => x.n)), values: plac.map((x) => r4(x.netR)) },
      bySlot, byPair,
      byYear: Object.fromEntries(Object.entries(byYear).sort().map(([y, a]) => { const s = summary(a); return [y, { n: s.n, netR: s.netR, totalR: s.totalR }]; })),
    };
  }
  const H = holm(ps, ALPHA);
  TESTS.forEach((T, i) => {
    const r = out.tests[T.id];
    r.holmP = r4(H.adj[i]);
    r.checks = {
      netPositive: r.decisive.netR > 0, monthT: r.decisive.t != null && r.decisive.t >= T_BAR,
      replicationSameSign: r.replication.netR > 0, holm: H.ok[i], placebo: r.decisive.netR > r.placebo.p95,
    };
    r.pass = Object.values(r.checks).every(Boolean);
  });
  out.days = { all: days.length, decisive: decDays.length, replication: days.filter((d) => inWin(d, REPLICATION)).length };
  out.passed = TESTS.filter((T) => out.tests[T.id].pass).map((T) => T.id);
  out.verdict = out.passed.length ? `PASS (${out.passed.join(', ')})` : 'FAIL';
  return out;
}

const fmt = (v, d = 3) => v == null ? 'n/a' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d);
export function report(res) {
  const L = [], T = res.tests, ids = TESTS.map((x) => x.id), yn = (b) => (b ? 'yes' : 'no');
  L.push('# London fix: the run into the 16:00 WM/Reuters fix on six forex majors, and the fade after it', '');
  L.push(`**Verdict: ${res.verdict}.** ${res.passed.length ? `${res.passed.join(', ')} met all five pre-registered conditions.` : `Neither test met the pre-registered bar (${ids.map((k) => `${k} ${fmt(T[k].decisive.netR)}R a trade net, n ${T[k].decisive.n}, month t ${fmt(T[k].decisive.t, 2)}`).join('; ')}, 2020-now, six pairs pooled).`} Pre-registered in PREREGISTRATION.md (first commit of the branch), OANDA mid M5, net of the raw-spread cost model plus 0.5 pip slippage a side. Paper research only; nothing live changed.`, '');
  L.push('## Results, six pairs pooled', '');
  L.push('| Test | Window | n | Net R a trade | Gross R a trade | Cost R | Net R at 2 x cost | Total net R | Month t | Month t at 2 x cost | Months | Win % | Stopped % |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const k of ids) for (const [w, s] of [['2020-now', T[k].decisive], ['2016-19', T[k].replication]])
    L.push(`| ${k} | ${w} | ${s.n} | ${fmt(s.netR)} | ${fmt(s.grossR)} | ${s.costR.toFixed(3)} | ${fmt(s.net2R)} | ${fmt(s.totalR, 1)} | ${fmt(s.t, 2)} | ${fmt(s.t2, 2)} | ${s.months} | ${(s.win * 100).toFixed(1)} | ${(s.stopShare * 100).toFixed(1)} |`);
  L.push('', '## The five conditions', '');
  L.push('| Test | Net R > 0 | Month t >= 2 | 2016-19 same sign | Holm (adj. p) | Placebo 95th pct (net R) | Beats placebo | Pass |');
  L.push('|---|---|---|---|---|---|---|---|');
  for (const k of ids) { const c = T[k].checks; L.push(`| ${k} | ${yn(c.netPositive)} | ${yn(c.monthT)} | ${yn(c.replicationSameSign)} | ${yn(c.holm)} (${T[k].holmP}) | ${fmt(T[k].placebo.p95)} | ${yn(c.placebo)} (above ${T[k].placebo.beats} of 40) | ${T[k].pass ? 'PASS' : 'fail'} |`); }
  L.push('', '## By pair (information, not tests)', '');
  L.push('| Test | Pair | Window | n | Net R a trade | Gross R a trade | Cost R | Month t | Median stop (pips) |');
  L.push('|---|---|---|---|---|---|---|---|---|');
  for (const k of ids) for (const [p, v] of Object.entries(T[k].byPair)) for (const [w, s] of [['2020-now', v.decisive], ['2016-19', v.replication]])
    L.push(`| ${k} | ${PAIRS[p]} | ${w} | ${s.n} | ${fmt(s.netR)} | ${fmt(s.grossR)} | ${s.costR.toFixed(3)} | ${fmt(s.t, 2)} | ${s.stopPips.toFixed(1)} |`);
  L.push('', '## Placebo: the same windows at other half-hours of the London afternoon (2020-now)', '');
  L.push('Each of 40 seeds draws one slot a day from the ten listed below and runs the identical rule there. The slot columns show each slot on its own (net R a trade, month t).', '');
  L.push(`| Test | Placebo median net R | Placebo 95th pct (38th of 40) | Real (16:00) net R | ${SLOTS.map(hm).join(' | ')} |`);
  L.push(`|---|---|---|---|${SLOTS.map(() => '---').join('|')}|`);
  for (const k of ids) L.push(`| ${k} | ${fmt(T[k].placebo.median)} | ${fmt(T[k].placebo.p95)} | ${fmt(T[k].decisive.netR)} | ${SLOTS.map((F) => `${fmt(T[k].bySlot[hm(F)].netR)} (t ${fmt(T[k].bySlot[hm(F)].t, 1)})`).join(' | ')} |`);
  L.push('', '## By year (pooled net R total)', '');
  const years = [...new Set(ids.flatMap((k) => Object.keys(T[k].byYear)))].sort();
  L.push(`| Test | ${years.join(' | ')} |`, `|---|${years.map(() => '---').join('|')}|`);
  for (const k of ids) L.push(`| ${k} | ${years.map((y) => (T[k].byYear[y] ? fmt(T[k].byYear[y].totalR, 1) : '')).join(' | ')} |`);
  L.push('', '## Notes', '');
  for (const n of res.notes || []) L.push(`- ${n}`);
  return L.join('\n') + '\n';
}

function NOTES(o) {
  const T = o.tests, n = [];
  n.push(`Data: OANDA mid M5 of the six pairs from ${o.data.firstCandle} to ${o.data.lastDay} (the fx-london-orb study's files, kept outside git). Weekdays: ${o.days.decisive} in 2020-now, ${o.days.replication} in 2016-19. Days with no A (a 15:30 or 15:55 candle missing) by pair: ${Object.entries(o.counts).map(([p, c]) => `${PAIRS[p]} ${c.noA}`).join(', ')}; events with no trade (an entry or exit candle missing): ${Object.entries(o.counts).map(([p, c]) => `${PAIRS[p]} ${c.noTrade.T1}/${c.noTrade.T2}`).join(', ')} (T1/T2).`);
  n.push('London time from Intl (Europe/London): 15:30 London is 15:30 UTC in winter and 14:30 UTC on British summer time. The windows never touch the 17:00 New York rollover (22:00 London), so no financing is charged.');
  n.push('Costs a round trip: 0.3 pip spread + 2 x 0.5 pip slippage + 2 x USD 22.5 per million (about 0.5 pip on EUR/USD), about 1.8 pips; in R that is divided by |A|, the stop. The 0.3 pip spread was measured on the USD majors and is used unmeasured for EUR/JPY.');
  n.push('The month t is on calendar-month sums of pooled net R; the trade t (`tradeT` in result.json) treats every trade as independent and is shown for information only. Six pairs on one day are correlated (the dollar), which the month sums absorb.');
  for (const k of Object.keys(T)) {
    const r = T[k];
    n.push(`${k} before costs: ${fmt(r.decisive.grossR)}R a trade on 2020-now and ${fmt(r.replication.grossR)}R on 2016-19; the cost is ${r.decisive.costR.toFixed(3)}R a trade on average because the stop is only |A| (median ${Object.values(r.byPair).map((v) => v.decisive.stopPips).join(' / ')} pips by pair, in the order of the pair table).`);
  }
  const sl = (k) => Object.values(T[k].bySlot);
  n.push(`Placebo: both tests clear the placebo's 95th percentile (T1 above ${T.T1.placebo.beats} of 40, T2 above ${T.T2.placebo.beats} of 40) while losing, so the 16:00 windows lose LESS than the same rule at other afternoon half-hours, not that they make money. Before costs the ten placebo slots (12:00 to 18:00, in order) make ${sl('T1').map((v) => fmt(v.grossR)).join(' / ')}R (T1) and ${sl('T2').map((v) => fmt(v.grossR)).join(' / ')}R (T2), with a cost of ${sl('T1').map((v) => v.costR.toFixed(2)).join(' / ')}R a trade against ${T.T1.decisive.costR.toFixed(3)}R at the fix: |A| is larger into 16:00, so the same pip cost is fewer R there. Read after the verdict, not part of it.`);
  return n;
}

async function main() {
  const [dir] = process.argv.slice(2);
  if (!dir) throw new Error('usage: node run.mjs <candleDir>');
  const candles = {};
  for (const p of Object.keys(PAIRS)) candles[p] = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${p}-5m.json.gz`))));
  const firstT = Math.max(...Object.values(candles).map((b) => b[0][0])), lastT = Math.min(...Object.values(candles).map((b) => b.at(-1)[0]));
  const firstDay = addD(new Date(firstT * 1000).toISOString().slice(0, 10), 1), lastDay = new Date(lastT * 1000).toISOString().slice(0, 10);
  const res = study(candles, firstDay, lastDay);
  const out = {
    study: 'london-fix', built: '2026-11-14', verdict: res.verdict, passed: res.passed,
    rule: 'Every London weekday: A = open of the 15:55 London M5 candle minus open of the 15:30 one. Event: |A| > 1.5 x the median |A| of the 20 previous weekdays (15 or more with an A). T1 fade: enter against A at 16:05 London, stop |A| beyond, out at 17:00 London. T2 follow: enter with A at 15:55, stop |A|, out at 16:05. Six majors pooled. Net of 0.3 pip spread, USD 22.5 per million a side and 0.5 pip slippage a side.',
    data: { source: 'OANDA mid M5 through the /md/bars proxy (the fx-london-orb files)', firstCandle: new Date(firstT * 1000).toISOString().slice(0, 10), firstDay, lastDay },
    windows: { decisive: [DECISIVE[0], lastDay], replication: REPLICATION },
    costs: { spreadPips: SPREAD_PIPS, slipPipsASide: SLIP_PIPS, commissionPerMillionASide: COMMISSION * 1e6 },
    bar: { netR: '> 0', monthT: T_BAR, replication: 'same sign', holm: { tests: 2, alpha: ALPHA }, placebo: { seeds: SEEDS, rank: P_RANK, slots: SLOTS.map(hm) } },
    days: res.days, counts: res.counts, tests: res.tests,
  };
  out.notes = NOTES(out);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(out));
  for (const [k, r] of Object.entries(res.tests)) console.log(k, JSON.stringify(r.decisive), JSON.stringify(r.replication), 'p95', r.placebo.p95, r.checks, r.pass);
  console.log(res.verdict);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
