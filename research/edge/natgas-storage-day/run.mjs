// Edge research · natgas-storage-day: the weekly US natural gas storage report (Thursday 10:30 New York) on NATGAS_USD.
// Primary (a): follow the first 30 minutes after the release, enter at 11:00, out at 14:30 New York, stop 1.5 x the 20-report
// mean |move| of that window. Reported only (b): the drift from the Wednesday 14:30 close to Thursday 10:25.
// PREREGISTRATION.md came first (pushed alone); nothing here changes its rules.
//   node --use-env-proxy research/edge/natgas-storage-day/fetch.mjs <dir>   OANDA mid M5 -> <dir>/natgas-5m.json.gz
//   node research/edge/natgas-storage-day/run.mjs <dir>                      -> result.json, RESULT.md (this folder)
// Keep <dir> out of git. Pure functions are exported for tests/natgas-storage-day.test.mjs.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { nyOffsetH } from '../../../council/histdata.mjs';

const H = 3600, D = 86400, M5 = 300;
export const COST = 0.005, STOP_K = 1.5, LOOK = 20, SEEDS = 40, NEED_BEAT = 38, T_MIN = 2;

// ---- calendar (the oil-wednesday holiday code, unchanged) --------------------------------------------------------------------
const ymd = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
const nth = (y, m, wd, n) => { const f = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); return 1 + ((wd - f + 7) % 7) + 7 * (n - 1); };
const last = (y, m, wd) => { const l = new Date(Date.UTC(y, m, 0)); return l.getUTCDate() - ((l.getUTCDay() - wd + 7) % 7); };
function observed(y, m, d) {
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const t = Date.UTC(y, m - 1, d) / 1000 + (wd === 6 ? -D : wd === 0 ? D : 0);
  return new Date(t * 1000).toISOString().slice(0, 10);
}
// US federal holidays (observed dates) of calendar year y, plus the Friday 31 Dec observance of next year's New Year's Day
export function holidays(y) {
  const s = new Set([observed(y, 1, 1), ymd(y, 1, nth(y, 1, 1, 3)), ymd(y, 2, nth(y, 2, 1, 3)), ymd(y, 5, last(y, 5, 1)),
    observed(y, 7, 4), ymd(y, 9, nth(y, 9, 1, 1)), ymd(y, 10, nth(y, 10, 1, 2)), observed(y, 11, 11), ymd(y, 11, nth(y, 11, 4, 4)),
    observed(y, 12, 25), observed(y + 1, 1, 1)]);
  if (y >= 2021) s.add(observed(y, 6, 19));
  return s;
}
const HC = new Map();
export const isHoliday = (iso) => { const y = +iso.slice(0, 4); for (const k of [y - 1, y]) { if (!HC.has(k)) HC.set(k, holidays(k)); if (HC.get(k).has(iso)) return true; } return false; };
// UTC seconds of a New York wall-clock time on the date iso
export function nyToUtc(iso, h, mi) {
  const [y, m, d] = iso.split('-').map(Number), base = Date.UTC(y, m - 1, d, h, mi) / 1000;
  return base + nyOffsetH(base + 5 * H) * H;
}
export const addDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * D * 1000).toISOString().slice(0, 10);
// One release per week (Monday iso): Thursday 10:30 New York, or { skip } when the week (Mon-Fri) holds a federal holiday
export function releaseOf(monday) {
  const wk = [0, 1, 2, 3, 4].map((k) => addDays(monday, k)), hol = wk.filter(isHoliday);
  if (hol.length) return { week: monday, skip: true, holiday: hol[0] };
  const th = addDays(monday, 3); return { week: monday, date: th, t: nyToUtc(th, 10, 30) };
}
export function releases(fromIso, toIso) {
  let mo = fromIso; while (new Date(mo + 'T00:00:00Z').getUTCDay() !== 1) mo = addDays(mo, 1);
  const out = []; for (; mo <= toIso; mo = addDays(mo, 7)) out.push(releaseOf(mo));
  return out;
}
// the clock times of one event on date iso: (a) and (b); b uses the day before (Wednesday for a Thursday)
export function timesOf(iso) {
  const prev = addDays(iso, -1);
  return { ref: nyToUtc(iso, 10, 30), sig: nyToUtc(iso, 11, 0), entry: nyToUtc(iso, 11, 0), exit: nyToUtc(iso, 14, 30),
    bEntry: nyToUtc(prev, 14, 30), bExit: nyToUtc(iso, 10, 25) };
}

// ---- candles -------------------------------------------------------------------------------------------------------------------
export function series(rows) {
  const s = { t: rows.map((r) => r[0]), o: rows.map((r) => r[1]), h: rows.map((r) => r[2]), l: rows.map((r) => r[3]), c: rows.map((r) => r[4]) };
  s.ix = new Map(s.t.map((t, i) => [t, i])); return s;
}
const openAt = (s, t) => { const i = s.ix.get(t); return i == null ? null : s.o[i]; };
const closeEnding = (s, t) => { const i = s.ix.get(t - M5); return i == null ? null : s.c[i]; };
// index of the last candle that ends at or before x and opens at or after `from`; null if none
function lastEndingBy(s, from, x) {
  for (let o = x - M5; o >= from; o -= M5) { const i = s.ix.get(o); if (i != null) return i; }
  return null;
}
// the window's raw move: entry open at tE, exit close of the candle ending at tX (else the last one ending before it)
export function windowMove(s, tE, tX) {
  const i = s.ix.get(tE); if (i == null) return null;
  const j = lastEndingBy(s, tE, tX); if (j == null) return null;
  return { entry: s.o[i], exit: s.c[j], i, j, move: s.c[j] - s.o[i] };
}
// manage a position from candle i through candle j (inclusive): stop first, a gap fills at the open
export function manage(s, i, j, side, stop) {
  let exit = s.c[j], how = 'time';
  for (let k = i; k <= j; k++) {
    if (side === 1 ? s.o[k] <= stop : s.o[k] >= stop) { exit = s.o[k]; how = 'gap'; break; }
    if (side === 1 ? s.l[k] <= stop : s.h[k] >= stop) { exit = stop; how = 'stop'; break; }
  }
  return { exit, how };
}

// ---- the rules ------------------------------------------------------------------------------------------------------------------
// events: [{ date }] in date order (one series: report days, or one placebo draw). Returns the trades of (a).
export function runA(s, events) {
  const moves = [], T = [], skipped = { noData: 0, warmup: 0, flat: 0 };
  for (const ev of events) {
    const tm = timesOf(ev.date), wm = windowMove(s, tm.entry, tm.exit);
    const prev = moves.slice(-LOOK);
    if (wm) moves.push(Math.abs(wm.move));
    const ref = openAt(s, tm.ref), sig = closeEnding(s, tm.sig);
    if (ref == null || sig == null || !wm) { skipped.noData++; continue; }
    if (prev.length < LOOK) { skipped.warmup++; continue; }
    if (sig === ref) { skipped.flat++; continue; }
    const A = prev.reduce((a, b) => a + b, 0) / LOOK, risk = STOP_K * A;
    if (!(risk > 0)) { skipped.noData++; continue; }
    const side = sig > ref ? 1 : -1, entry = wm.entry, stop = entry - side * risk, x = manage(s, wm.i, wm.j, side, stop);
    const R = ((x.exit - entry) * side) / risk;
    T.push({ date: ev.date, side, entry, stop: +stop.toFixed(5), exit: x.exit, how: x.how, risk, R, net: R - COST / risk, net2: R - (2 * COST) / risk,
      sigPct: 100 * (sig / ref - 1) });
  }
  return { T, skipped };
}
// (b), reported only: Wednesday 14:30 close -> Thursday 10:25 drift, and a walk-forward trade
export function runB(s, events) {
  const moves = [], T = [], drift = [];
  for (const ev of events) {
    const tm = timesOf(ev.date), wm = windowMove(s, tm.bEntry, tm.bExit), c0 = closeEnding(s, tm.bEntry), c1 = closeEnding(s, tm.bExit);
    if (c0 != null && c1 != null) drift.push({ date: ev.date, pct: 100 * (c1 / c0 - 1) });
    const prev = moves.slice(-LOOK);
    if (wm) moves.push(wm.move);
    if (!wm || prev.length < LOOK) continue;
    const mean = prev.reduce((a, b) => a + b, 0) / LOOK, A = prev.reduce((a, b) => a + Math.abs(b), 0) / LOOK;
    if (!(A > 0) || mean === 0) continue;
    const side = mean > 0 ? 1 : -1, risk = STOP_K * A, stop = wm.entry - side * risk, x = manage(s, wm.i, wm.j, side, stop);
    const R = ((x.exit - wm.entry) * side) / risk;
    T.push({ date: ev.date, side, R, net: R - COST / risk, net2: R - (2 * COST) / risk, how: x.how, risk });
  }
  return { T, drift };
}

// placebo: per report week a random weekday (Mon-Fri) that is not the Thursday and not a holiday, same clock times
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function placeboDays(rel, seed) {
  const r = rng(seed), out = [];
  for (const x of rel) {
    if (x.skip) continue;
    const c = [0, 1, 2, 4].map((k) => addDays(x.week, k)).filter((d) => d !== x.date && !isHoliday(d));
    if (!c.length) continue;
    out.push({ date: c[Math.floor(r() * c.length)] });
  }
  return out;
}

// ---- statistics ---------------------------------------------------------------------------------------------------------------
export function stats(T, k = 'net') {
  const v = T.map((x) => x[k]), n = v.length; if (!n) return { n: 0 };
  const m = v.reduce((a, b) => a + b, 0) / n, sd = n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : 0;
  let eq = 0, pk = 0, dd = 0; for (const x of v) { eq += x; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  const ms = monthT(T, k);
  return { n, mean: +m.toFixed(4), tTrade: +(sd > 0 ? m / (sd / Math.sqrt(n)) : 0).toFixed(2), months: ms.n, tMonth: ms.t,
    total: +eq.toFixed(1), win: +(v.filter((x) => x > 0).length / n).toFixed(3), dd: +dd.toFixed(1) };
}
// t on calendar-month sums (months that hold a trade)
export function monthT(T, k = 'net') {
  const by = new Map(); for (const x of T) by.set(x.date.slice(0, 7), (by.get(x.date.slice(0, 7)) || 0) + x[k]);
  const v = [...by.values()], n = v.length; if (n < 2) return { n, t: 0 };
  const m = v.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1));
  return { n, t: +(sd > 0 ? m / (sd / Math.sqrt(n)) : 0).toFixed(2) };
}
export const split = (T, mid) => ({ IS: T.filter((x) => x.date < mid), OOS: T.filter((x) => x.date >= mid) });
export function judge(oos, oos2, is, beat) {
  const why = [];
  if (!(oos.mean > 0 && oos.tMonth >= T_MIN)) why.push(`out-of-sample month-sum t ${oos.tMonth} (needs >= ${T_MIN} with mean > 0)`);
  if (!(is.mean > 0)) why.push('in-sample mean net R not above 0');
  if (!(oos2.mean > 0)) why.push('out-of-sample mean not above 0 at 2x cost');
  if (!(beat >= NEED_BEAT)) why.push(`beats ${beat} of ${SEEDS} placebo means (needs ${NEED_BEAT})`);
  return { pass: !why.length, why };
}

// ---- the whole study ------------------------------------------------------------------------------------------------------------
export function loadRows(dir) { return JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'natgas-5m.json.gz')))); }
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export function analyse(rows) {
  const s = series(rows), first = iso(s.t[0]), lastD = iso(s.t.at(-1)), mid = iso(Math.floor((s.t[0] + s.t.at(-1)) / 2));
  const rel = releases(first, addDays(lastD, -1)).filter((x) => x.skip || x.date <= lastD), ev = rel.filter((x) => !x.skip);
  const { T, skipped } = runA(s, ev), w = split(T, mid);
  const S = (X) => ({ gross: stats(X, 'R'), net: stats(X), x2: stats(X, 'net2') });
  const plac = []; for (let k = 1; k <= SEEDS; k++) plac.push(stats(split(runA(s, placeboDays(rel, k)).T, mid).OOS).mean ?? 0);
  const res = { study: 'natgas-storage-day', title: 'The weekly US natural gas storage report on NATGAS_USD: drift after the first half hour',
    preregistration: 'research/edge/natgas-storage-day/PREREGISTRATION.md', built: '2026-11-14',
    data: { src: 'OANDA mid M5 NATGAS_USD via the site proxy', from: first, to: lastD, candles: rows.length, midpoint: mid },
    calendar: { weeks: rel.length, holidayWeeksSkipped: rel.filter((x) => x.skip).length, reports: ev.length },
    params: { cost: COST, stopK: STOP_K, lookback: LOOK, seeds: SEEDS, needBeat: NEED_BEAT, tMin: T_MIN, window: 'signal 10:30-11:00, entry 11:00, exit 14:30 New York' },
    primary: { skipped, IS: S(w.IS), OOS: S(w.OOS), all: S(T),
      sides: Object.fromEntries(['IS', 'OOS'].map((h) => [h, { buy: stats(w[h].filter((x) => x.side === 1)), sell: stats(w[h].filter((x) => x.side === -1)) }])),
      exits: Object.fromEntries(['stop', 'gap', 'time'].map((h) => [h, T.filter((x) => x.how === h).length])),
      medianRisk: +[...T.map((x) => x.risk)].sort((a, b) => a - b)[Math.floor(T.length / 2)].toFixed(4),
      years: {}, placebo: { means: plac.map((x) => +x.toFixed(4)) } } };
  const p = res.primary, oosMean = p.OOS.net.mean;
  p.placebo.beat = plac.filter((x) => oosMean > x).length;
  const ps = [...plac].sort((a, b) => a - b); p.placebo.min = +ps[0].toFixed(4); p.placebo.median = +((ps[19] + ps[20]) / 2).toFixed(4); p.placebo.max = +ps.at(-1).toFixed(4);
  for (const x of T) { const y = x.date.slice(0, 4); (p.years[y] ||= []).push(x); }
  for (const y of Object.keys(p.years)) p.years[y] = stats(p.years[y]);
  p.verdict = judge(p.OOS.net, p.OOS.x2, p.IS.net, p.placebo.beat);
  res.verdict = p.verdict.pass ? 'PASS' : 'FAIL';
  const b = runB(s, ev), bw = split(b.T, mid), dw = split(b.drift, mid), dS = (X) => ({ ...stats(X, 'pct'), mean: +(X.reduce((a, x) => a + x.pct, 0) / (X.length || 1)).toFixed(4) });
  res.reportedB = { drift: { IS: dS(dw.IS), OOS: dS(dw.OOS) }, trade: { IS: S(bw.IS), OOS: S(bw.OOS) } };
  res.headline = `${res.verdict}: following the first half hour after the storage report, ${f2(p.OOS.net.mean)}R a trade net out of sample (n ${p.OOS.net.n}, month-sum t ${p.OOS.net.tMonth}); in sample ${f2(p.IS.net.mean)}R (n ${p.IS.net.n}); beats ${p.placebo.beat} of 40 placebo means`;
  return res;
}

const f2 = (x, d = 3) => (x == null ? 'n/a' : (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d));
export function report(res) {
  const p = res.primary, L = [], v = p.verdict;
  L.push('# Result: the weekly US natural gas storage report, drift after the first half hour (natgas-storage-day)', '');
  L.push(`**Verdict: ${res.verdict}, ${4 - v.why.length} of 4 checks hold: ${v.pass ? 'following the first half hour after the storage report passes the pre-registered bar' : 'following the first half hour after the storage report is not an edge on natural gas'}.** ${v.pass ? '' : 'Failed: ' + v.why.join('; ') + '. '}` +
    `Out of sample ${f2(p.OOS.net.mean)}R a trade net (n ${p.OOS.net.n}, month-sum t ${p.OOS.net.tMonth} over ${p.OOS.net.months} months), at 2x cost ${f2(p.OOS.x2.mean)}R; in sample ${f2(p.IS.net.mean)}R (n ${p.IS.net.n}, month-sum t ${p.IS.net.tMonth}); beats ${p.placebo.beat} of 40 placebo means.`, '');
  L.push(`Pre-registered in PREREGISTRATION.md (pushed alone first). Data: ${res.data.src}, ${res.data.from} to ${res.data.to}, ${res.data.candles} candles; in sample before ${res.data.midpoint}, out of sample from it. ` +
    `Schedule: Thursday 10:30 New York from the rule; ${res.calendar.weeks} weeks, ${res.calendar.holidayWeeksSkipped} holiday weeks left out, ${res.calendar.reports} report days; ` +
    `not traded: ${p.skipped.warmup} warm-up (the first 20 build the stop), ${p.skipped.noData} without the candles, ${p.skipped.flat} flat first half hour. ` +
    `Stop 1.5 x the 20-report mean |11:00 to 14:30 move|; cost $${COST} a round trip; no overnight. Research only: nothing live changed.`, '');
  L.push('## Primary (a): follow the first half hour, 11:00 to 14:30 New York', '');
  L.push('| Window | n | net R a trade | t (trades) | t (month sums) | months | win | total R | worst DD | cost 0 R a trade | x2 cost R a trade |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const h of ['IS', 'OOS', 'all']) { const x = p[h]; L.push(`| ${h === 'IS' ? 'in sample' : h === 'OOS' ? 'out of sample' : 'whole'} | ${x.net.n} | ${f2(x.net.mean)} | ${x.net.tTrade} | ${x.net.tMonth} | ${x.net.months} | ${x.net.win} | ${x.net.total} | ${x.net.dd} | ${f2(x.gross.mean)} | ${f2(x.x2.mean)} |`); }
  L.push('', '## Checks', '');
  L.push(`1. Out-of-sample month-sum t >= 2 net: ${p.OOS.net.tMonth} (${p.OOS.net.mean > 0 && p.OOS.net.tMonth >= T_MIN ? 'holds' : 'fails'}).`);
  L.push(`2. In-sample mean net > 0: ${f2(p.IS.net.mean)} (${p.IS.net.mean > 0 ? 'holds' : 'fails'}).`);
  L.push(`3. Out-of-sample mean > 0 at 2x cost: ${f2(p.OOS.x2.mean)} (${p.OOS.x2.mean > 0 ? 'holds' : 'fails'}).`);
  L.push(`4. Beats >= 38 of 40 placebo means: ${p.placebo.beat} (${p.placebo.beat >= NEED_BEAT ? 'holds' : 'fails'}); placebo out-of-sample means ${f2(p.placebo.min)} to ${f2(p.placebo.max)}R (median ${f2(p.placebo.median)}).`);
  L.push('', '## Detail (reported, not tested)', '');
  for (const h of ['IS', 'OOS']) { const x = p.sides[h]; L.push(`- ${h === 'IS' ? 'In sample' : 'Out of sample'}: buys ${f2(x.buy.mean)}R (n ${x.buy.n}), sells ${f2(x.sell.mean)}R (n ${x.sell.n}).`); }
  L.push(`- Exits: stop ${p.exits.stop}, gap ${p.exits.gap}, time ${p.exits.time}; median risk $${p.medianRisk}.`);
  L.push('', '| Year | n | net R a trade | total R |', '|---|---|---|---|');
  for (const [y, x] of Object.entries(p.years)) L.push(`| ${y} | ${x.n} | ${f2(x.mean)} | ${x.total} |`);
  const b = res.reportedB;
  L.push('', '## Reported only (b): Wednesday 14:30 close to Thursday 10:25', '');
  L.push(`- Drift: in sample ${f2(b.drift.IS.mean, 4)} % (n ${b.drift.IS.n}, month-sum t ${b.drift.IS.tMonth}); out of sample ${f2(b.drift.OOS.mean, 4)} % (n ${b.drift.OOS.n}, month-sum t ${b.drift.OOS.tMonth}).`);
  L.push(`- Walk-forward trade (side from the 20 previous reports, spread only, no financing): in sample ${f2(b.trade.IS.net.mean)}R net (n ${b.trade.IS.net.n}, month-sum t ${b.trade.IS.net.tMonth}); out of sample ${f2(b.trade.OOS.net.mean)}R (n ${b.trade.OOS.net.n}, month-sum t ${b.trade.OOS.net.tMonth}); 2x cost ${f2(b.trade.OOS.x2.mean)}R.`);
  L.push('', '## Reading', '', res.verdict === 'PASS'
    ? 'All four checks hold. This is only a proposal to the owner for a paper shadow stream (every trade with its stop); nothing live changed, and a forward paper record is still needed before calling it an edge.'
    : `Never call this an edge. Before any cost the rule is flat (in sample ${f2(p.IS.gross.mean)}R, out of sample ${f2(p.OOS.gross.mean)}R a trade), so the first half hour after the report says nothing about the move to the settlement; the $${COST} spread on a median risk of $${p.medianRisk} is the loss. No proposal is written and nothing live changed. (b) is a description and cannot pass or fail the study. Not tested: consensus surprises (no consensus data), holiday-week releases, other exits.`, '');
  return L.join('\n');
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2];
  if (!dir) throw new Error('usage: run.mjs <dir>');
  const res = analyse(loadRows(dir));
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(res));
  console.log(report(res).split('\n').slice(0, 3).join('\n'));
}
