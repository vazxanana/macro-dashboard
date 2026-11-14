// The US dollar on the day before a US market holiday (research/edge/fx-us-holiday, PREREGISTRATION.md). Paper research.
//   node run.mjs fetch <dir>   copies the council's daily candle cache of the seven pairs out of the council-data branch (git show,
//                              no network) and freezes the demo broker's swaps into swaps.json beside this file
//   node run.mjs full <dir>    runs the study on <dir>/<key>.json and writes result.json + RESULT.md next to this file
// Basket, costs, financing and statistics follow the fx-weekday study (branch fx-weekday, copied, not imported); the holiday
// calendar is the pre-holiday study's dayKind on ict/calendar.mjs cmeYear (read only). Nothing here is tuned.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { foldWeekend } from '../../../council/fills.mjs';
import { cmeYear } from '../../../ict/calendar.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const readJ = (f) => JSON.parse(fs.readFileSync(path.join(HERE, f), 'utf8'));
export const RATES = readJ('rates.json');
export const SWAPS = fs.existsSync(path.join(HERE, 'swaps.json')) ? readJ('swaps.json') : null;

// the seven legs; usd = the pair side that is long the US dollar; base / quote currency for the rate gap
export const LEGS = [
  { ccy: 'eur', key: 'eurusd', sym: 'EURUSD', usd: -1, base: 'eur', quote: 'usd' },
  { ccy: 'gbp', key: 'gbpusd', sym: 'GBPUSD', usd: -1, base: 'gbp', quote: 'usd' },
  { ccy: 'aud', key: 'audusd', sym: 'AUDUSD', usd: -1, base: 'aud', quote: 'usd' },
  { ccy: 'nzd', key: 'nzdusd', sym: 'NZDUSD', usd: -1, base: 'nzd', quote: 'usd' },
  { ccy: 'jpy', key: 'usdjpy', sym: 'USDJPY', usd: 1, base: 'usd', quote: 'jpy' },
  { ccy: 'cad', key: 'usdcad', sym: 'USDCAD', usd: 1, base: 'usd', quote: 'cad' },
  { ccy: 'chf', key: 'usdchf', sym: 'USDCHF', usd: 1, base: 'usd', quote: 'chf' },
];
export const P = { ATR_N: 20, STOP_ATR: 1.5, SPREAD_PIP: 0.3, COMM_RT: 0.000045, MARKUP: 1.0, TRIPLE_WD: 3, SEEDS: 40, SEEDS_NEED: 38,
  IS: ['2005-01-03', '2014-12-31'], OOS: ['2015-01-01', '9999-12-31'], T_BAR: 2 };
export const ymdOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export const pipOf = (key) => (key.endsWith('jpy') ? 0.01 : 0.0001);

// --- the NYSE calendar (pre-holiday's dayKind) -----------------------------------------------------------------------------
export const SPECIAL = new Set(['2012-10-29', '2012-10-30', '2018-12-05', '2025-01-09']);
const NYSE_FROM_EARLY = new Set(['Martin Luther King Day', "Presidents' Day", 'Memorial Day', 'Juneteenth', 'Independence Day', 'Labor Day', 'Thanksgiving Day']);
const HALF = new Set(['Independence Day eve', 'Day after Thanksgiving', 'Christmas Eve']);
// 'weekend' | 'special' | 'holiday' | 'half' | 'open'
export function dayKind(ymd) {
  const wd = new Date(ymd + 'T12:00:00Z').getUTCDay();
  if (wd === 0 || wd === 6) return 'weekend';
  if (SPECIAL.has(ymd)) return 'special';
  const Y = cmeYear(+ymd.slice(0, 4));
  if (Y.full.has(ymd)) return 'holiday';
  const e = Y.early.get(ymd);
  if (e && NYSE_FROM_EARLY.has(e.name)) return 'holiday';
  if (e && HALF.has(e.name)) return 'half';
  return 'open';
}
export function holidayName(ymd) { const Y = cmeYear(+ymd.slice(0, 4)); return Y.full.get(ymd) || Y.early.get(ymd)?.name || null; }
export const isTradingDay = (ymd) => { const k = dayKind(ymd); return k === 'open' || k === 'half'; };
export const isHoliday = (ymd) => dayKind(ymd) === 'holiday';
const addD = (ymd, n) => new Date(Date.parse(ymd + 'T12:00:00Z') + n * 86400e3).toISOString().slice(0, 10);
// every holiday in [from, to] with its P (last NYSE trading day before) and A (first one after)
export function holidayEvents(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addD(d, 1)) {
    if (!isHoliday(d)) continue;
    let p = addD(d, -1); while (!isTradingDay(p)) p = addD(p, -1);
    let a = addD(d, 1); while (!isTradingDay(a)) a = addD(a, 1);
    out.push({ hol: d, name: holidayName(d), pre: p, post: a });
  }
  return out;
}

// --- statistics (fx-weekday) -----------------------------------------------------------------------------------------------
export const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
export const variance = (a) => { const m = mean(a); return a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1); };
export function welch(a, b) {
  if (a.length < 2 || b.length < 2) return { t: null, diff: null };
  const diff = mean(a) - mean(b), se = Math.sqrt(variance(a) / a.length + variance(b) / b.length);
  return { t: diff / se, diff };
}
export function tOne(a) { if (a.length < 2) return null; return mean(a) / Math.sqrt(variance(a) / a.length); }
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// calendar-month sums: per yyyy-mm the sum of the values; one-sample t over the months that have one
export function monthSums(rows, val) {
  const by = new Map(); for (const r of rows) by.set(r.ymd.slice(0, 7), (by.get(r.ymd.slice(0, 7)) || 0) + val(r));
  const s = [...by.values()]; return { t: tOne(s), months: s.length };
}

// --- rates and swaps (fx-weekday) ------------------------------------------------------------------------------------------
export function rateAt(ccy, ymd, rates = RATES) {
  const x = rates.decisions[ccy]; let r = x.from[1];
  for (const [d, v] of x.changes) { if (d <= ymd) r = v; else break; }
  return r;
}
export function finNight(leg, side, entry, ymd, { markupMult = 1, swaps = SWAPS, rates = RATES } = {}) {
  const sw = swaps && swaps.symbols && swaps.symbols[leg.sym];
  if (sw) { const pips = side > 0 ? sw.long : sw.short; return { frac: pips * 10 ** -sw.pipPosition / entry, src: 'broker' }; }
  const gap = rateAt(leg.base, ymd, rates) - rateAt(leg.quote, ymd, rates);
  return { frac: (side * gap - P.MARKUP * markupMult) / 100 / 365, src: 'rates' };
}
export const nightsOf = (t) => (new Date(t * 1000).getUTCDay() === P.TRIPLE_WD ? 3 : 1);

// --- candles ---------------------------------------------------------------------------------------------------------------
export function fold(rows) { return foldWeekend(rows.map(([t, o, h, l, c]) => ({ time: t, open: o, high: h, low: l, close: c }))); }
export function atr(bars, i, n = P.ATR_N) {
  if (i < n) return null; let s = 0;
  for (let k = i - n + 1; k <= i; k++) { const b = bars[k], pc = bars[k - 1].close; s += Math.max(b.high, pc) - Math.min(b.low, pc); }
  return s / n;
}
// one leg's one-day position: entry at bars[k-1].close, exit at bars[k] close or its 1.5 x ATR stop
export function legDay(bars, k, leg, side, { costMult = 1, swaps = SWAPS, rates = RATES } = {}) {
  const a = atr(bars, k - 1); if (!a || !(a > 0)) return null;
  const b = bars[k], entry = bars[k - 1].close, r0 = P.STOP_ATR * a, stop = entry - side * r0;
  let exit = b.close, kind = 'close';
  if (side > 0 ? b.open <= stop : b.open >= stop) { exit = b.open; kind = 'gap'; }
  else if (side > 0 ? b.low <= stop : b.high >= stop) { exit = stop; kind = 'stop'; }
  const gross = side * (exit - entry) / entry;
  const cost = costMult * (P.SPREAD_PIP * pipOf(leg.key) / entry + P.COMM_RT);
  const f = finNight(leg, side, entry, ymdOf(b.time), { markupMult: Math.max(1, costMult), swaps, rates }), n = nightsOf(b.time);
  const fin = f.frac * n, net = gross - cost + fin, k2 = entry / r0;
  return { gross, cost, fin, net, grossR: gross * k2, netR: net * k2, kind, finSrc: f.src };
}
// basket days: the dates all seven pairs share, with the same previous candle date and an ATR
export function basketDays(data) {
  const idx = LEGS.map((l) => new Map(data[l.key].map((b, i) => [ymdOf(b.time), i])));
  const out = new Map(); let skipped = 0;
  for (let i = 1; i < data.eurusd.length; i++) {
    const ymd = ymdOf(data.eurusd[i].time), wd = new Date(data.eurusd[i].time * 1000).getUTCDay();
    if (wd < 1 || wd > 5) continue;
    const ks = idx.map((m) => m.get(ymd)); if (ks.some((k) => k == null || k < P.ATR_N + 1)) { skipped++; continue; }
    const prev = ks.map((k, j) => ymdOf(data[LEGS[j].key][k - 1].time));
    if (prev.some((p) => p !== prev[0])) { skipped++; continue; }
    out.set(ymd, { ymd, wd, t: data.eurusd[i].time, ks, entryYmd: prev[0] });
  }
  return { days: out, skipped };
}
// the basket on a day, side s (+1 long USD, -1 short USD)
export function basket(data, day, s, opts = {}) {
  const legs = LEGS.map((l, j) => legDay(data[l.key], day.ks[j], l, l.usd * s, opts));
  if (legs.some((x) => !x)) return null;
  const m = (f) => mean(legs.map(f));
  return { gross: m((x) => x.gross), net: m((x) => x.net), cost: m((x) => x.cost), fin: m((x) => x.fin), grossR: m((x) => x.grossR),
    netR: m((x) => x.netR), stops: legs.filter((x) => x.kind !== 'close').length, legs };
}
export const inWin = (ymd, w) => ymd >= w[0] && ymd <= w[1];
// every variant of a day, on both sides and three cost levels
export function dayRow(data, day) {
  const v = {};
  for (const s of [1, -1]) for (const c of [0, 1, 2]) { const b = basket(data, day, s, { costMult: c }); if (!b) return null; v[`${s > 0 ? 'L' : 'S'}${c}`] = b; }
  return { ymd: day.ymd, entryYmd: day.entryYmd, wd: day.wd, ...v };
}
const side = (r, s, c = 1) => r[`${s > 0 ? 'L' : 'S'}${c}`];

// the placebo: per seed, per OOS year, as many ordinary days as events that year, traded on side s; mean net R
export function placebo(events, ordinary, s, seeds = P.SEEDS) {
  const byYear = new Map(); for (const r of ordinary) { const y = r.ymd.slice(0, 4); if (!byYear.has(y)) byYear.set(y, []); byYear.get(y).push(r); }
  const need = new Map(); for (const e of events) { const y = e.ymd.slice(0, 4); need.set(y, (need.get(y) || 0) + 1); }
  const out = [];
  for (let k = 1; k <= seeds; k++) {
    const r = rng(k), xs = [];
    for (const [y, n] of [...need].sort()) { const pool = byYear.get(y) || []; for (let i = 0; i < n && pool.length; i++) xs.push(side(pool[Math.floor(r() * pool.length)], s).netR); }
    out.push({ seed: k, meanR: mean(xs), n: xs.length });
  }
  return out;
}

// --- the study -------------------------------------------------------------------------------------------------------------
const r4 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1e4) / 1e4);
const pct = (x) => r4(x * 100);
function block(rows, s) {
  if (!rows.length) return { n: 0 };
  const B = (c) => rows.map((r) => side(r, s, c));
  const net = B(1).map((b) => b.netR), ms = monthSums(rows, (r) => side(r, s, 1).netR);
  return { n: rows.length, grossPctLongUsd: pct(mean(rows.map((r) => r.L1.gross))), grossR: r4(mean(B(1).map((b) => b.grossR))),
    netR: r4(mean(net)), t: r4(tOne(net)), monthT: r4(ms.t), months: ms.months,
    netR0: r4(mean(B(0).map((b) => b.netR))), netR2: r4(mean(B(2).map((b) => b.netR))), t2: r4(tOne(B(2).map((b) => b.netR))),
    netPct: pct(mean(B(1).map((b) => b.net))), costR: r4(mean(rows.map((r) => side(r, s, 1).grossR - side(r, s, 1).netR))),
    won: r4(net.filter((x) => x > 0).length / net.length), legStops: B(1).reduce((x, b) => x + b.stops, 0),
    totalR: r4(net.reduce((x, y) => x + y, 0)) };
}
export function study(data) {
  const { days, skipped } = basketDays(data);
  const all = [...days.values()], first = all[0].ymd, last = all.at(-1).ymd;
  const rows = new Map(); for (const d of all) { const r = dayRow(data, d); if (r) rows.set(d.ymd, r); }
  const evs = holidayEvents(P.IS[0], last);
  // P and A sets, each traded once
  const pre = new Map(), post = new Map();
  for (const e of evs) { if (!pre.has(e.pre)) pre.set(e.pre, e); if (!post.has(e.post)) post.set(e.post, e); }
  const missing = { pre: [], post: [] };
  const pick = (m, key) => { const out = []; for (const [ymd, e] of m) { const r = rows.get(ymd); if (!r || ymd > last) { if (ymd <= last) missing[key].push(ymd); continue; } out.push({ ...r, hol: e.hol, name: e.name }); } return out; };
  const P_ = pick(pre, 'pre'), A_ = pick(post, 'post');
  const ordinary = [...rows.values()].filter((r) => isTradingDay(r.ymd) && !pre.has(r.ymd) && !post.has(r.ymd));
  const win = (xs, w) => xs.filter((r) => inWin(r.ymd, w));
  const sideOf = (xs) => (mean(win(xs, P.IS).map((r) => r.L1.gross)) >= 0 ? 1 : -1);
  const leg = (xs, w, s) => {
    const W = win(xs, w), O = win(ordinary, w);
    return { ...block(W, s), welchVsOrdinaryT: r4(welch(W.map((r) => r.L1.gross), O.map((r) => r.L1.gross)).t), ordinaryGrossPctLongUsd: pct(mean(O.map((r) => r.L1.gross))),
      perLegGrossPctLongUsd: Object.fromEntries(LEGS.map((l, j) => [l.ccy, pct(mean(W.map((r) => r.L1.legs[j].gross)))])) };
  };
  const sP = sideOf(P_), sA = sideOf(A_);
  const pIS = leg(P_, P.IS, sP), pOOS = leg(P_, P.OOS, sP), aIS = leg(A_, P.IS, sA), aOOS = leg(A_, P.OOS, sA);
  const oosP = win(P_, P.OOS), oosOrd = win(ordinary, P.OOS);
  const pl = placebo(oosP, oosOrd, sP), real = mean(oosP.map((r) => side(r, sP).netR));
  const beat = pl.filter((x) => real > x.meanR).length;
  const byType = (xs, s) => { const m = new Map(); for (const r of xs) { if (!m.has(r.name)) m.set(r.name, []); m.get(r.name).push(side(r, s).netR); }
    return [...m].map(([name, v]) => ({ name, n: v.length, netR: r4(mean(v)), t: r4(tOne(v)) })).sort((a, b) => a.name.localeCompare(b.name)); };
  const T1 = pOOS.netR > 0 && pOOS.t >= P.T_BAR && pOOS.monthT >= P.T_BAR, T2 = pIS.netR > 0, T3 = pOOS.netR2 > 0, T4 = beat >= P.SEEDS_NEED;
  const verdict = T1 && T2 && T3 && T4 ? 'PASS' : 'FAIL';
  const finSrc = Object.fromEntries(LEGS.map((l) => [l.ccy, finNight(l, 1, 1, '2020-01-01').src]));
  return {
    built: '2026-11-14', study: 'fx-us-holiday', title: 'The US dollar on the day before a US market holiday',
    verdict, system: 'Research only (US dollar basket, seven pairs)',
    headline: null,
    data: { src: 'OANDA mid daily candles (UTC days, close 00:00 UTC = 19:00 / 20:00 New York), council-data research/daily/<key>.json (git show), weekend folded into Monday (council/fills.mjs foldWeekend)',
      first, last, basketDays: rows.size, skipped, holidays: evs.length, missingPre: missing.pre, missingPost: missing.post },
    windows: { inSample: [P.IS[0], P.IS[1]], outOfSample: [P.OOS[0], last] },
    rule: { stopAtr: P.STOP_ATR, atrN: P.ATR_N, side: sP > 0 ? 'long USD' : 'short USD', sideNote: 'the sign of the in-sample mean gross long-USD basket % on pre-holiday days, applied out of sample',
      sideAfter: sA > 0 ? 'long USD' : 'short USD' },
    costs: { spreadPip: P.SPREAD_PIP, commissionRT: P.COMM_RT, note: 'one raw-spread round trip per leg; 2x doubles spread, commission and the rate markup; 0 = no spread, no commission (financing kept)' },
    financing: { source: finSrc, swapsAt: SWAPS?.at || null, markupPct: P.MARKUP, note: "today's broker swaps for EUR, GBP, AUD, CAD, CHF on every year; NZD and JPY from the fx-carry rate table less the markup; three nights on a Wednesday candle; holiday value-date days not modelled" },
    pre: { side: sP > 0 ? 'long USD' : 'short USD', inSample: pIS, outOfSample: pOOS, byTypeOutOfSample: byType(oosP, sP) },
    after: { reportedOnly: true, side: sA > 0 ? 'long USD' : 'short USD', inSample: aIS, outOfSample: aOOS },
    placebo: { seeds: P.SEEDS, need: P.SEEDS_NEED, realNetR: r4(real), beaten: beat, ordinaryDays: oosOrd.length, seedNetR: pl.map((x) => r4(x.meanR)) },
    tests: { T1, T2, T3, T4 },
    trades: oosP.concat(win(P_, P.IS)).sort((a, b) => a.ymd.localeCompare(b.ymd)).map((r) => ({ ymd: r.ymd, hol: r.hol, name: r.name, entry: r.entryYmd,
      grossPctLongUsd: pct(r.L1.gross), netR: r4(side(r, sP).netR), stops: side(r, sP).stops })),
  };
}

// --- report ----------------------------------------------------------------------------------------------------------------
const f = (x, d = 3) => (x == null ? 'n/a' : (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d));
export function headline(R) {
  const o = R.pre.outOfSample;
  return `${R.verdict === 'PASS' ? 'Passes' : 'Fails'}: the dollar basket on the day before a US holiday, ${R.pre.side} (learned 2005-14), makes ${f(o.netR)}R a holiday out of sample (n ${o.n}, t ${f(o.t, 2)}).`;
}
export function report(R) {
  const o = [], pi = R.pre.inSample, po = R.pre.outOfSample, ai = R.after.inSample, ao = R.after.outOfSample, PL = R.placebo, T = R.tests;
  o.push(`# Result: the US dollar on the day before a US market holiday (${R.built})`, '');
  o.push(`**Verdict: ${R.verdict}**: the ${R.pre.side} dollar basket on the day before a US holiday (side learned 2005-14) makes ${f(po.netR)}R a holiday out of sample (n ${po.n}, t ${f(po.t, 2)}).`, '');
  o.push(`Judged on the pre-registered bar (PREREGISTRATION.md, pushed before any candle was read). ` +
    `Out of sample ${R.windows.outOfSample[0]} to ${R.windows.outOfSample[1]}: ${f(po.netR)}R a holiday after costs (n ${po.n}, event t ${f(po.t, 2)}, month-sum t ${f(po.monthT, 2)}); ` +
    `in sample ${f(pi.netR)}R (n ${pi.n}); at 2x cost ${f(po.netR2)}R; above ${PL.beaten} of ${PL.seeds} placebo seeds. Nothing live changed${R.verdict === 'PASS' ? '' : ' and no proposal follows'}.`, '');
  o.push(`Data: ${R.data.src}; basket days ${R.data.first} to ${R.data.last} (${R.data.basketDays}; ${R.data.skipped} dates skipped where a pair lacked the day or its previous candle differed). ` +
    `${R.data.holidays} NYSE full holidays from ${R.windows.inSample[0]} (ict/calendar.mjs cmeYear, the pre-holiday study's dayKind); pre-holiday days without a basket candle: ${R.data.missingPre.length ? R.data.missingPre.join(', ') : 'none'}. ` +
    `**The close is the UTC daily close (19:00 or 20:00 New York), not 17:00 New York**: no intraday forex history for all seven pairs since 2005 is on file. ` +
    `Costs: ${R.costs.spreadPip} pip spread + ${(R.costs.commissionRT * 100).toFixed(4)} % commission a round trip per leg. Financing: broker swaps (frozen ${R.financing.swapsAt}) for EUR, GBP, AUD, CAD, CHF, today's swap for every year; the fx-carry study's approximate rate table less ${R.financing.markupPct} % for NZD and JPY; holiday value-date days not modelled.`, '');
  o.push(`Side: **${R.pre.side}**, ${R.rule.sideNote} (in-sample gross long-USD basket ${f(pi.grossPctLongUsd, 4)} % a holiday).`, '');
  const row = (lab, x) => `| ${lab} | ${x.n} | ${f(x.grossPctLongUsd, 4)} | ${f(x.grossR)} | ${f(x.netR0)} | ${f(x.netR)} | ${f(x.netR2)} | ${f(x.t, 2)} | ${f(x.monthT, 2)} (${x.months}) | ${(x.won * 100).toFixed(1)} % | ${x.legStops} | ${f(x.welchVsOrdinaryT, 2)} |`;
  o.push('## The pre-holiday day (judged)', '', '| Window | n | gross % long USD | gross R (side) | net R cost 0 | net R base | net R 2x | event t | month-sum t (months) | won | leg stops | Welch t vs ordinary days (gross) |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  o.push(row(`In sample ${R.windows.inSample[0]} to ${R.windows.inSample[1]}`, pi), row(`Out of sample ${R.windows.outOfSample[0]} to ${R.windows.outOfSample[1]}`, po), '');
  o.push('## Pass bar', '', '| Test | Holds |', '|---|---|',
    `| T1 out of sample net R > 0, event t >= 2 and month-sum t >= 2 | ${T.T1 ? 'yes' : 'no'} (${f(po.netR)}R, t ${f(po.t, 2)}, month t ${f(po.monthT, 2)}) |`,
    `| T2 in sample net R > 0 | ${T.T2 ? 'yes' : 'no'} (${f(pi.netR)}R) |`,
    `| T3 out of sample net R > 0 at 2x cost | ${T.T3 ? 'yes' : 'no'} (${f(po.netR2)}R) |`,
    `| T4 above at least ${PL.need} of ${PL.seeds} placebo seeds | ${T.T4 ? 'yes' : 'no'} (${PL.beaten} of ${PL.seeds}) |`, '');
  o.push('## Placebo', '', `${PL.seeds} seeds, each drawing as many ordinary out-of-sample days per year as the rule traded (from ${PL.ordinaryDays} ordinary days), traded on the same side with the same stop and costs. The rule's ${f(PL.realNetR)}R is above ${PL.beaten} of them; seed means range ${f(Math.min(...PL.seedNetR))}R to ${f(Math.max(...PL.seedNetR))}R.`, '');
  o.push('## Out of sample by holiday', '', '| Holiday | n | net R | t |', '|---|---|---|---|');
  for (const x of R.pre.byTypeOutOfSample) o.push(`| ${x.name} | ${x.n} | ${f(x.netR)} | ${f(x.t, 2)} |`);
  o.push('', 'Per leg, out of sample, gross % long USD a pre-holiday day: ' + Object.entries(po.perLegGrossPctLongUsd).map(([k, v]) => `${k.toUpperCase()} ${f(v, 4)}`).join(', ') + '.', '');
  o.push('## The day after the holiday (reported only)', '', `Side ${R.after.side}, learned in sample the same way.`, '',
    '| Window | n | gross % long USD | gross R (side) | net R cost 0 | net R base | net R 2x | event t | month-sum t (months) | won | leg stops | Welch t vs ordinary days (gross) |', '|---|---|---|---|---|---|---|---|---|---|---|---|',
    row('In sample', ai), row('Out of sample', ao), '');
  o.push('## Reading', '');
  o.push(`- The day after the holiday was pre-registered as reported only, and it is reported only: out of sample ${f(ao.netR)}R a holiday (n ${ao.n}, t ${f(ao.t, 2)}) on a side learned in a sample where it made ${f(ai.netR)}R (t ${f(ai.t, 2)}). A window with no in-sample support, picked from a second look, is not evidence; it would need its own pre-registration on data not yet read, and the 2015-now figures cannot be that data.`);
  o.push('- One observation is one holiday (the seven legs of one basket are one bet, not seven); about nine holidays a year.');
  o.push('- The UTC close sits two or three hours after the 17:00 New York rollover; a test at 17:00 New York would need intraday candles since 2005 for all seven pairs.');
  o.push("- Today's broker swaps are charged on every past year; the NZD / JPY rate table is approximate; the extra value days some brokers roll before a US holiday are not charged. On a one-day hold financing is small next to the spread and commission.");
  o.push('- Paper only. Never call this an edge without its n and t.');
  o.push('', 'To repeat: `node research/edge/fx-us-holiday/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then `… full <dir>`. Test: `tests/fx-us-holiday.test.mjs`.');
  return o.join('\n') + '\n';
}

// --- CLI -------------------------------------------------------------------------------------------------------------------
export function loadData(dir) { return Object.fromEntries(LEGS.map((l) => [l.key, fold(JSON.parse(fs.readFileSync(path.join(dir, `${l.key}.json`), 'utf8')).rows)])); }
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    for (const l of LEGS) fs.writeFileSync(path.join(dir, `${l.key}.json`), execFileSync('git', ['show', `origin/council-data:research/daily/${l.key}.json`], { maxBuffer: 1 << 28 }));
    const s = JSON.parse(execFileSync('git', ['show', 'origin/council-data:ctrader/symbols.json'], { maxBuffer: 1 << 28 }));
    const symbols = {};
    for (const l of LEGS) { const x = s.symbols?.[l.sym]; if (x?.swap && x.swap.type === 0) symbols[l.sym] = { long: x.swap.long, short: x.swap.short, rollover3Days: x.swap.rollover3Days, pipPosition: x.pipPosition, commissionRT: x.commissionRT }; }
    fs.writeFileSync(path.join(HERE, 'swaps.json'), JSON.stringify({ about: 'Demo broker swaps (pips a lot a night, type 0) copied from council-data ctrader/symbols.json by run.mjs fetch; pairs absent there use rates.json', at: s.at, broker: s.broker, symbols }, null, 1) + '\n');
    console.log('fetched into', dir, 'swaps for', Object.keys(symbols).join(' '));
  } else if (cmd === 'full') {
    const R = study(loadData(dir));
    R.headline = headline(R);
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
    console.log(R.verdict, JSON.stringify({ pre: R.pre, after: R.after.outOfSample, placebo: R.placebo.beaten, tests: R.tests }).slice(0, 3000));
  } else console.log('usage: node run.mjs fetch <dir> | full <dir>');
}
