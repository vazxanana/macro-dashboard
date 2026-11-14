// The US dollar on the first trading days of a month (research/edge/fx-month-start, PREREGISTRATION.md). Paper research.
//   node run.mjs fetch <dir>   copies the council's daily candle cache of the seven pairs and spx500 out of the council-data
//                              branch (git show, no network) and freezes the demo broker's swaps into swaps.json beside this file
//   node run.mjs full <dir>    runs the study on <dir>/<key>.json and writes result.json + RESULT.md next to this file
// Basket, costs, financing and statistics follow the fx-us-holiday study (branch fx-us-holiday, copied, not imported); the hold
// is two candles here. Nothing here is tuned.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { foldWeekend } from '../../../council/fills.mjs';

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
  HOLD: 2, MID: [8, 19], IS: ['2005-01-01', '2014-12-31'], OOS: ['2015-01-01', '9999-12-31'], T_BAR: 2 };
export const ymdOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export const pipOf = (key) => (key.endsWith('jpy') ? 0.01 : 0.0001);

// --- statistics (fx-us-holiday) --------------------------------------------------------------------------------------------
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

// --- rates and swaps (fx-us-holiday) ---------------------------------------------------------------------------------------
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
// one leg held from bars[ke].close for `hold` candles, with a 1.5 x ATR(20) stop checked on each candle in turn
export function legHold(bars, ke, hold, leg, side, { costMult = 1, swaps = SWAPS, rates = RATES } = {}) {
  const a = atr(bars, ke); if (!a || !(a > 0) || ke + hold >= bars.length) return null;
  const entry = bars[ke].close, r0 = P.STOP_ATR * a, stop = entry - side * r0;
  let exit = null, kind = 'close', fin = 0, held = 0;
  for (let j = 1; j <= hold; j++) {
    const b = bars[ke + j]; held = j;
    fin += finNight(leg, side, entry, ymdOf(b.time), { markupMult: Math.max(1, costMult), swaps, rates }).frac * nightsOf(b.time);
    if (side > 0 ? b.open <= stop : b.open >= stop) { exit = b.open; kind = 'gap'; break; }
    if (side > 0 ? b.low <= stop : b.high >= stop) { exit = stop; kind = 'stop'; break; }
    exit = b.close;
  }
  const gross = side * (exit - entry) / entry;
  const cost = costMult * (P.SPREAD_PIP * pipOf(leg.key) / entry + P.COMM_RT);
  const net = gross - cost + fin, k2 = entry / r0;
  return { gross, cost, fin, net, grossR: gross * k2, netR: net * k2, kind, held };
}

// --- the calendar: basket days and month-start events ----------------------------------------------------------------------
// data = { key: folded bars }; returns per-pair date -> index maps and the sorted basket dates (UTC weekdays all seven share)
export function calendar(data) {
  const idx = Object.fromEntries(LEGS.map((l) => [l.key, new Map(data[l.key].map((b, i) => [ymdOf(b.time), i]))]));
  const dates = [...idx.eurusd.keys()].filter((d) => { const wd = new Date(d + 'T12:00:00Z').getUTCDay(); return wd >= 1 && wd <= 5 && LEGS.every((l) => idx[l.key].has(d)); }).sort();
  return { idx, dates };
}
// a window = entry date e and the next `hold` basket dates; valid when they follow e directly in every pair's file
export function windowAt(cal, data, pos, hold = P.HOLD) {
  const e = cal.dates[pos], nx = cal.dates.slice(pos + 1, pos + 1 + hold);
  if (nx.length < hold) return null;
  const ks = LEGS.map((l) => cal.idx[l.key].get(e));
  for (let j = 0; j < LEGS.length; j++) {
    const m = cal.idx[LEGS[j].key];
    for (let h = 0; h < hold; h++) if (m.get(nx[h]) !== ks[j] + h + 1) return null;
    if (ks[j] < P.ATR_N + 1) return null;
  }
  return { e, d: nx, ks };
}
// one event per month: E = the last basket day of month M, D1 / D2 the first two of M+1
export function monthEvents(cal, data) {
  const ev = [], skipped = [];
  for (let i = 0; i + 1 < cal.dates.length; i++) {
    const e = cal.dates[i], n = cal.dates[i + 1];
    if (e.slice(0, 7) === n.slice(0, 7)) continue;
    const w = windowAt(cal, data, i);
    if (!w || w.d[1].slice(0, 7) !== n.slice(0, 7)) { skipped.push(n.slice(0, 7)); continue; }
    ev.push({ ymd: w.d[0], e, d1: w.d[0], d2: w.d[1], ks: w.ks, pos: i });
  }
  return { events: ev, skipped };
}
// mid-month placebo candidates per yyyy-mm: entry day of month 8-19, both exit days in the same month, contiguous
export function midCandidates(cal, data) {
  const by = new Map();
  for (let i = 0; i < cal.dates.length; i++) {
    const e = cal.dates[i], dom = +e.slice(8, 10);
    if (dom < P.MID[0] || dom > P.MID[1]) continue;
    const w = windowAt(cal, data, i);
    if (!w || w.d.some((d) => d.slice(0, 7) !== e.slice(0, 7))) continue;
    const ym = e.slice(0, 7); if (!by.has(ym)) by.set(ym, []);
    by.get(ym).push({ ymd: e, e, ks: w.ks });
  }
  return by;
}
// the basket of a window, side s (+1 long USD), held `hold` candles
export function basket(data, w, s, opts = {}, hold = P.HOLD) {
  const legs = LEGS.map((l, j) => legHold(data[l.key], w.ks[j], hold, l, l.usd * s, opts));
  if (legs.some((x) => !x)) return null;
  const m = (f) => mean(legs.map(f));
  return { gross: m((x) => x.gross), net: m((x) => x.net), cost: m((x) => x.cost), fin: m((x) => x.fin), grossR: m((x) => x.grossR),
    netR: m((x) => x.netR), stops: legs.filter((x) => x.kind !== 'close').length, legs };
}
export function row(data, w, hold = P.HOLD) {
  const v = {};
  for (const s of [1, -1]) for (const c of [0, 1, 2]) { const b = basket(data, w, s, { costMult: c }, hold); if (!b) return null; v[`${s > 0 ? 'L' : 'S'}${c}`] = b; }
  return { ...w, ...v };
}
export const side = (r, s, c = 1) => r[`${s > 0 ? 'L' : 'S'}${c}`];
export const inWin = (ymd, w) => ymd >= w[0] && ymd <= w[1];
export const sideOf = (rows) => (rows.length && mean(rows.filter((r) => inWin(r.ymd, P.IS)).map((r) => r.L1.gross)) < 0 ? -1 : 1);

// the placebo: per seed, one mid-month window in every month that has an event; the seed learns its side in sample and
// its out-of-sample mean net R (base cost) on that side is recorded
export function placebo(eventMonths, cands, seeds = P.SEEDS) {
  const out = [];
  for (let k = 1; k <= seeds; k++) {
    const r = rng(k), xs = [];
    for (const ym of eventMonths) { const pool = cands.get(ym); if (!pool || !pool.length) continue; xs.push(pool[Math.floor(r() * pool.length)]); }
    const s = sideOf(xs), oos = xs.filter((x) => inWin(x.ymd, P.OOS));
    out.push({ seed: k, side: s, meanR: mean(oos.map((x) => side(x, s).netR)), n: oos.length });
  }
  return out;
}

// US equities over month M: last spx500 close dated in M-1 to the last close dated on or before E (and in M)
export function spxMonth(spx, e) {
  const m = e.slice(0, 7); let start = null, end = null;
  for (const b of spx) { const d = ymdOf(b.time); if (d.slice(0, 7) < m) start = b.close; else if (d <= e && d.slice(0, 7) === m) end = b.close; }
  return start && end ? end / start - 1 : null;
}

// --- the study -------------------------------------------------------------------------------------------------------------
const r4 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1e4) / 1e4);
const pct = (x) => r4(x * 100);
function block(rows, s) {
  if (!rows.length) return { n: 0 };
  const B = (c) => rows.map((r) => side(r, s, c));
  const net = B(1).map((b) => b.netR), ms = monthSums(rows, (r) => side(r, s, 1).netR);
  let peak = 0, cum = 0, dd = 0; for (const x of net) { cum += x; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak); }
  return { n: rows.length, grossPctLongUsd: pct(mean(rows.map((r) => r.L1.gross))), grossR: r4(mean(B(1).map((b) => b.grossR))),
    netR: r4(mean(net)), t: r4(tOne(net)), monthT: r4(ms.t), months: ms.months,
    netR0: r4(mean(B(0).map((b) => b.netR))), netR2: r4(mean(B(2).map((b) => b.netR))), t2: r4(tOne(B(2).map((b) => b.netR))),
    costR: r4(mean(rows.map((r) => side(r, s, 1).grossR - side(r, s, 1).netR))),
    won: r4(net.filter((x) => x > 0).length / net.length), legStops: B(1).reduce((x, b) => x + b.stops, 0),
    totalR: r4(cum), worstDdR: r4(dd) };
}
export function study(data, spx) {
  const cal = calendar(data);
  const { events, skipped } = monthEvents(cal, data);
  const last = cal.dates.at(-1);
  const ev = events.filter((e) => e.ymd >= P.IS[0]).map((e) => { const r = row(data, e); return r && { ...r, spx: spxMonth(spx, e.e) }; }).filter(Boolean);
  const d1 = events.filter((e) => e.ymd >= P.IS[0]).map((e) => row(data, e, 1)).filter(Boolean);
  const cands = new Map([...midCandidates(cal, data)].map(([ym, xs]) => [ym, xs.map((w) => row(data, w)).filter(Boolean)]));
  const win = (xs, w) => xs.filter((r) => inWin(r.ymd, w));
  const sP = sideOf(ev), sD1 = sideOf(d1);
  const pIS = block(win(ev, P.IS), sP), pOOS = block(win(ev, P.OOS), sP);
  const dIS = block(win(d1, P.IS), sD1), dOOS = block(win(d1, P.OOS), sD1);
  // placebo
  const months = ev.map((r) => r.ymd.slice(0, 7));
  const pl = placebo(months, cands), real = pOOS.netR;
  const beat = pl.filter((x) => mean(win(ev, P.OOS).map((r) => side(r, sP).netR)) > x.meanR).length;
  const oosCand = [...cands.values()].flat().filter((r) => inWin(r.ymd, P.OOS));
  const welchT = welch(win(ev, P.OOS).map((r) => r.L1.gross), oosCand.map((r) => r.L1.gross)).t;
  // the equity split
  const split = {};
  for (const [name, f] of [['usUp', (r) => r.spx > 0], ['usDown', (r) => r.spx != null && r.spx <= 0]]) {
    const xs = ev.filter(f), s = sideOf(xs);
    split[name] = { side: s > 0 ? 'long USD' : 'short USD', inSample: block(win(xs, P.IS), s), outOfSample: block(win(xs, P.OOS), s) };
  }
  // by year and per leg, out of sample
  const byYear = {};
  for (const r of ev) { const y = r.ymd.slice(0, 4); (byYear[y] ||= []).push(side(r, sP).netR); }
  const perLeg = Object.fromEntries(LEGS.map((l, j) => [l.ccy, pct(mean(win(ev, P.OOS).map((r) => r.L1.legs[j].gross)))]));
  const T1 = pOOS.netR > 0 && pOOS.t >= P.T_BAR && pOOS.monthT >= P.T_BAR, T2 = pIS.netR > 0, T3 = pOOS.netR2 > 0, T4 = beat >= P.SEEDS_NEED;
  const verdict = T1 && T2 && T3 && T4 ? 'PASS' : 'FAIL';
  const finSrc = Object.fromEntries(LEGS.map((l) => [l.ccy, finNight(l, 1, 1, '2020-01-01').src]));
  return {
    built: '2026-11-14', study: 'fx-month-start', title: 'The US dollar on the first two trading days of a month',
    verdict, system: 'Research only (US dollar basket, seven pairs)', headline: null,
    data: { src: 'OANDA mid daily candles (UTC days, close 00:00 UTC = 19:00 / 20:00 New York), council-data research/daily/<key>.json (git show), weekend folded into Monday (council/fills.mjs foldWeekend); spx500 the same way for the reported split',
      first: cal.dates[0], last, basketDays: cal.dates.length, events: ev.length, skippedMonths: skipped.filter((m) => m >= P.IS[0].slice(0, 7)) },
    windows: { inSample: [ev.find((r) => inWin(r.ymd, P.IS))?.ymd, P.IS[1]], outOfSample: [P.OOS[0], win(ev, P.OOS).at(-1)?.ymd] },
    rule: { stopAtr: P.STOP_ATR, atrN: P.ATR_N, hold: 'close of the last basket day of the month to the close of the 2nd basket day of the next',
      side: sP > 0 ? 'long USD' : 'short USD', sideNote: 'the sign of the in-sample mean gross long-USD basket %, learned in sample and applied out of sample' },
    costs: { spreadPip: P.SPREAD_PIP, commissionRT: P.COMM_RT, note: 'one raw-spread round trip per leg; 2x doubles spread, commission and the rate markup; 0 = no spread, no commission (financing kept)' },
    financing: { source: finSrc, swapsAt: SWAPS?.at || null, markupPct: P.MARKUP, note: "today's broker swaps for EUR, GBP, AUD, CAD, CHF on every year; NZD and JPY from the fx-carry rate table less the markup; three nights on a Wednesday candle" },
    primary: { side: sP > 0 ? 'long USD' : 'short USD', inSample: pIS, outOfSample: pOOS, perLegGrossPctLongUsdOOS: perLeg,
      welchVsMidMonthT: r4(welchT), byYear: Object.fromEntries(Object.entries(byYear).map(([y, v]) => [y, { n: v.length, netR: r4(mean(v)) }])) },
    dayOne: { reportedOnly: true, side: sD1 > 0 ? 'long USD' : 'short USD', inSample: dIS, outOfSample: dOOS },
    equitySplit: { reportedOnly: true, note: 'Sign of the SPX500 CFD return over the month that ends at E; each group learns its own side in sample', ...split },
    placebo: { seeds: P.SEEDS, need: P.SEEDS_NEED, realNetR: real, beaten: beat, candidatesOOS: oosCand.length,
      seedNetR: pl.map((x) => r4(x.meanR)), seedSide: pl.map((x) => (x.side > 0 ? 'L' : 'S')).join('') },
    tests: { T1, T2, T3, T4 },
    trades: ev.map((r) => ({ ymd: r.ymd, entry: r.e, exit: r.d2, grossPctLongUsd: pct(r.L1.gross), netR: r4(side(r, sP).netR), stops: side(r, sP).stops, spxPct: pct(r.spx) })),
  };
}

// --- report ----------------------------------------------------------------------------------------------------------------
const f = (x, d = 3) => (x == null ? 'n/a' : (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d));
export function headline(R) {
  const o = R.primary.outOfSample;
  const why = R.verdict === 'PASS' ? 'passes every check' : `out of sample ${f(o.netR)}R a month (n ${o.n}, t ${f(o.t, 2)}), placebo ${R.placebo.beaten} of ${R.placebo.seeds}`;
  return `${R.verdict}: the dollar basket over the first two days of a month, ${R.primary.side} (learned 2005-14): ${why}.`;
}
export function report(R) {
  const o = [], pi = R.primary.inSample, po = R.primary.outOfSample, di = R.dayOne.inSample, dO = R.dayOne.outOfSample, PL = R.placebo, T = R.tests;
  o.push(`# Result: the US dollar on the first two trading days of a month (${R.built})`, '');
  o.push(`**Verdict: ${R.headline}**`, '');
  o.push(`Judged on the pre-registered bar (PREREGISTRATION.md, pushed before any candle was read). ` +
    `Out of sample ${R.windows.outOfSample[0]} to ${R.windows.outOfSample[1]}: ${f(po.netR)}R a month after costs (n ${po.n}, event t ${f(po.t, 2)}, month-sum t ${f(po.monthT, 2)}); ` +
    `in sample ${f(pi.netR)}R (n ${pi.n}); at 2x cost ${f(po.netR2)}R out of sample; above ${PL.beaten} of ${PL.seeds} placebo seeds. Nothing live changed${R.verdict === 'PASS' ? '' : ' and no proposal follows'}.`, '');
  o.push(`**The direction was learned in sample and only applied out of sample**: side **${R.primary.side}**, ${R.rule.sideNote} (in-sample gross long-USD basket ${f(pi.grossPctLongUsd, 4)} % a month). Choosing the side on the same years flatters the in-sample figure${pi.netR > 0 ? '' : ' (here it is negative all the same: the side follows the gross % of the basket, while R weights each leg by its stop distance and the short side has its own stops)'}; only the out-of-sample figures judge the rule.`, '');
  o.push(`Data: ${R.data.src}; basket days ${R.data.first} to ${R.data.last} (${R.data.basketDays}). ${R.data.events} month-start events from ${R.windows.inSample[0]}; months skipped (a pair missing a day or an extra candle in the window): ${R.data.skippedMonths.length ? R.data.skippedMonths.join(', ') : 'none'}. ` +
    `**The close is the UTC daily close (19:00 or 20:00 New York), not 17:00 New York**: no intraday forex history for all seven pairs since 2005 is on file. Holiday candles the broker prints (1 January) count as basket days. ` +
    `Stop 1.5 x ATR(20) daily on every leg, checked on each held candle. Costs: ${R.costs.spreadPip} pip spread + ${(R.costs.commissionRT * 100).toFixed(4)} % commission a round trip per leg (the demo's raw-spread account; its measured median spread is 0, so the 0.3 pip is conservative). Financing: broker swaps (frozen ${R.financing.swapsAt}) for EUR, GBP, AUD, CAD, CHF, today's swap for every year; the fx-carry study's approximate rate table less ${R.financing.markupPct} % for NZD and JPY.`, '');
  const rowM = (lab, x) => `| ${lab} | ${x.n} | ${f(x.grossPctLongUsd, 4)} | ${f(x.grossR)} | ${f(x.netR0)} | ${f(x.netR)} | ${f(x.netR2)} | ${f(x.t, 2)} | ${f(x.monthT, 2)} (${x.months}) | ${(x.won * 100).toFixed(1)} % | ${x.legStops} | ${f(x.totalR, 2)} | ${f(x.worstDdR, 2)} |`;
  const head = '| Window | n | gross % long USD | gross R (side) | net R cost 0 | net R base | net R 2x | event t | month-sum t (months) | won | leg stops | total R | worst DD R |';
  const sep = '|---|---|---|---|---|---|---|---|---|---|---|---|---|';
  o.push('## Primary: close of the month\'s last day to the close of the 2nd day (judged)', '', head, sep,
    rowM(`In sample ${R.windows.inSample[0]} to ${R.windows.inSample[1]}`, pi), rowM(`Out of sample ${R.windows.outOfSample[0]} to ${R.windows.outOfSample[1]}`, po), '');
  o.push('## Pass bar', '', '| Test | Holds |', '|---|---|',
    `| T1 out of sample net R > 0, event t >= 2 and month-sum t >= 2 | ${T.T1 ? 'yes' : 'no'} (${f(po.netR)}R, t ${f(po.t, 2)}, month t ${f(po.monthT, 2)}) |`,
    `| T2 in sample net R > 0 | ${T.T2 ? 'yes' : 'no'} (${f(pi.netR)}R) |`,
    `| T3 out of sample net R > 0 at 2x cost | ${T.T3 ? 'yes' : 'no'} (${f(po.netR2)}R) |`,
    `| T4 above at least ${PL.need} of ${PL.seeds} placebo seeds | ${T.T4 ? 'yes' : 'no'} (${PL.beaten} of ${PL.seeds}) |`, '');
  o.push('## Placebo', '', `${PL.seeds} seeds, each drawing one mid-month two-day window (entry on day 8 to 19 of the month) in every month that has an event, learning its own side from its in-sample windows and trading it out of sample with the same stop, costs and financing (${PL.candidatesOOS} out-of-sample candidate windows). The rule's ${f(PL.realNetR)}R is above ${PL.beaten} of them; seed means range ${f(Math.min(...PL.seedNetR))}R to ${f(Math.max(...PL.seedNetR))}R (sides learned: ${PL.seedSide}). Welch t of the events' gross long-USD basket % against all out-of-sample mid-month windows: ${f(R.primary.welchVsMidMonthT, 2)}.`, '');
  o.push('Per leg, out of sample, gross % long USD over the two days: ' + Object.entries(R.primary.perLegGrossPctLongUsdOOS).map(([k, v]) => `${k.toUpperCase()} ${f(v, 4)}`).join(', ') + '.', '');
  o.push('By year, net R a month on the rule\'s side: ' + Object.entries(R.primary.byYear).map(([y, v]) => `${y} ${f(v.netR, 2)}`).join(', ') + '.', '');
  o.push('## Day 1 alone (reported only)', '', `Close of the month's last day to the close of the first day of the new month; side ${R.dayOne.side}, learned in sample the same way.`, '', head, sep,
    rowM('In sample', di), rowM('Out of sample', dO), '');
  o.push('## After an up or down month for US equities (reported only)', '', `${R.equitySplit.note}.`, '',
    '| Group | side (learned in sample) | in sample n | in sample net R | out of sample n | out of sample net R | out of sample t |', '|---|---|---|---|---|---|---|');
  for (const [k, lab] of [['usUp', 'SPX500 up in the month'], ['usDown', 'SPX500 down in the month']]) {
    const g = R.equitySplit[k]; o.push(`| ${lab} | ${g.side} | ${g.inSample.n} | ${f(g.inSample.netR)} | ${g.outOfSample.n} | ${f(g.outOfSample.netR)} | ${f(g.outOfSample.t, 2)} |`);
  }
  o.push('', '## Reading', '');
  o.push('- One observation is one month (the seven legs of one basket are one bet, not seven); with one event a month the month-sum t equals the event t.');
  o.push('- The reported splits (day 1 alone, the equity-return groups) were fixed in advance as reported only. A group with a large figure picked from these looks is not evidence; it would need its own pre-registration on data not yet read.');
  { const u = R.equitySplit.usUp, d = R.equitySplit.usDown;
    o.push(`- The rebalancing story expects dollar selling at the turn after a month of US equity gains. The split learned ${u.side} after an up month and ${d.side} after a down month; out of sample ${f(u.outOfSample.netR)}R (n ${u.outOfSample.n}, t ${f(u.outOfSample.t, 2)}) and ${f(d.outOfSample.netR)}R (n ${d.outOfSample.n}, t ${f(d.outOfSample.t, 2)}): neither group reaches t 2, and the split was a reported look, not a test.`); }
  o.push('- The UTC close sits two or three hours after the 17:00 New York rollover; a test at the rollover or at a fix would need intraday candles since 2005 for all seven pairs.');
  o.push("- Today's broker swaps are charged on every past year; the NZD / JPY rate table is approximate. On a two-day hold financing is small next to the spread and commission.");
  o.push('- Paper only. Never call this an edge without its n and t.');
  o.push('', 'To repeat: `node research/edge/fx-month-start/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then `… full <dir>`. Test: `tests/fx-month-start.test.mjs`.');
  return o.join('\n') + '\n';
}

// --- CLI -------------------------------------------------------------------------------------------------------------------
const readRows = (dir, key) => JSON.parse(fs.readFileSync(path.join(dir, `${key}.json`), 'utf8')).rows;
export function loadData(dir) { return Object.fromEntries(LEGS.map((l) => [l.key, fold(readRows(dir, l.key))])); }
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    for (const k of [...LEGS.map((l) => l.key), 'spx500']) fs.writeFileSync(path.join(dir, `${k}.json`), execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
    const s = JSON.parse(execFileSync('git', ['show', 'origin/council-data:ctrader/symbols.json'], { maxBuffer: 1 << 28 }));
    const symbols = {};
    for (const l of LEGS) { const x = s.symbols?.[l.sym]; if (x?.swap && x.swap.type === 0) symbols[l.sym] = { long: x.swap.long, short: x.swap.short, rollover3Days: x.swap.rollover3Days, pipPosition: x.pipPosition, commissionRT: x.commissionRT }; }
    fs.writeFileSync(path.join(HERE, 'swaps.json'), JSON.stringify({ about: 'Demo broker swaps (pips a lot a night, type 0) copied from council-data ctrader/symbols.json by run.mjs fetch; pairs absent there use rates.json', at: s.at, broker: s.broker, symbols }, null, 1) + '\n');
    console.log('fetched into', dir, 'swaps for', Object.keys(symbols).join(' '));
  } else if (cmd === 'full') {
    const R = study(loadData(dir), fold(readRows(dir, 'spx500')));
    R.headline = headline(R);
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
    const { trades, ...rest } = R;
    console.log(JSON.stringify(rest, null, 1).slice(0, 6000));
  } else console.log('usage: node run.mjs fetch <dir> | full <dir>');
}
