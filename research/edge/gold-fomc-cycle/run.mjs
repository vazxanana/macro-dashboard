// Edge research · gold-fomc-cycle: long gold in weeks 2, 4 and 6 of the FOMC cycle (T1) and short gold in weeks 1, 3 and 5
// (T2), on the council's daily gold candles, net of $0.60 a round trip and financing on buys. Rules, counting, costs, windows,
// placebo and pass bar: PREREGISTRATION.md (committed first, alone).
//   node research/edge/gold-fomc-cycle/run.mjs fetch <dir>               (council-data daily xau with git show, no network)
//   node research/edge/gold-fomc-cycle/run.mjs <dir> [<xau-5m.json.gz>]  (writes result.json and RESULT.md here)
// Pure pieces are exported for tests/gold-fomc-cycle.test.mjs. Paper research only: nothing live reads this.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { scheduled, NEW, UNSCHEDULED, SOURCE } from './dates.mjs';
import { nights, FIN } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86400;
export const P = Object.freeze({
  ATR: 20, K: 2, COST: 0.60, FINL: FIN.xau.long, HOLE: 5,
  IS: ['2007-01-01', '2017-01-01'], OOS: ['2017-01-01', '2026-11-01'],
  SEEDS: 40, SHIFT: [5, 20], NEED: 38, TBAR: 2,
  CHECK: { from: 18 * 3600, to: 19.5 * 3600, prior: 20, ratio: 1.5 },
});
export const WEEK = Object.freeze({ paper: (w) => [5 * w - 1, 5 * w + 3], brief: (w) => [5 * w, 5 * w + 4] });
export const TESTS = Object.freeze({
  T1: { name: 'long gold in weeks 2, 4, 6', weeks: [2, 4, 6], side: 'buy' },
  T2: { name: 'short gold in weeks 1, 3, 5', weeks: [1, 3, 5], side: 'sell' },
});
export const REPORTED = Object.freeze({
  allLong: { name: 'long gold in every week 1-6', weeks: [1, 2, 3, 4, 5, 6], side: 'buy' },
  oddLong: { name: 'long gold in weeks 1, 3, 5', weeks: [1, 3, 5], side: 'buy' },
});

const dstr = (t) => new Date(t * 1000).toISOString().slice(0, 10);
// fold Saturday / Sunday candles into the next weekday: first weekend open, merged high / low, the weekday's own close
export function fold(rows) {
  const out = []; let w = null;
  for (const [t, o, h, l, c] of rows) {
    const wd = new Date(t * 1000).getUTCDay();
    if (wd === 0 || wd === 6) { w = w ? { o: w.o, h: Math.max(w.h, h), l: Math.min(w.l, l) } : { o, h, l }; continue; }
    out.push(w ? { t, d: dstr(t), o: w.o, h: Math.max(w.h, h), l: Math.min(w.l, l), c } : { t, d: dstr(t), o, h, l, c });
    w = null;
  }
  return out;
}
export function firstOnOrAfter(days, date) {
  let lo = 0, hi = days.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (days[m].d < date) lo = m + 1; else hi = m; }
  return lo;
}
// ATR(n) of the days up to and including index i (true range with the prior close); null if too few
export function atrAt(days, i, n = P.ATR) {
  if (i < n) return null;
  let s = 0;
  for (let j = i - n + 1; j <= i; j++) { const d = days[j], pc = days[j - 1].c; s += Math.max(d.h - d.l, Math.abs(d.h - pc), Math.abs(d.l - pc)); }
  return s / n;
}
// every usable week of every cycle: { meet, w, entry, start, end } (indices into days); dropped ones counted by reason
export function windows(days, meets, { count = 'paper', unsched = UNSCHEDULED } = {}) {
  const ban = new Set();
  for (const u of unsched) { const k = firstOnOrAfter(days, u); for (let j = k - 1; j <= k + 3; j++) ban.add(j); }
  const out = [], drop = { noDay0: [], cut: 0, data: 0, hole: 0, unscheduled: 0 };
  const ms = [...new Set(meets)].sort();
  for (let j = 0; j < ms.length; j++) {
    const i0 = firstOnOrAfter(days, ms[j]);
    if (i0 >= days.length || days[i0].d !== ms[j]) { drop.noDay0.push(ms[j]); continue; }
    const b = j + 1 < ms.length ? firstOnOrAfter(days, ms[j + 1]) - 1 : Infinity;   // day -1 of the next meeting
    for (const w of [1, 2, 3, 4, 5, 6]) {
      const [lo, hi] = WEEK[count](w), start = i0 + lo, end = i0 + hi, entry = start - 1;
      if (end >= b) { drop.cut++; continue; }
      if (end >= days.length) { drop.data++; continue; }
      let hole = false;
      for (let k = entry + 1; k <= end; k++) if (days[k].t - days[k - 1].t > P.HOLE * DAY) hole = true;
      if (hole) { drop.hole++; continue; }
      let bad = false;
      for (let k = entry; k <= end; k++) if (ban.has(k)) bad = true;
      if (bad) { drop.unscheduled++; continue; }
      out.push({ meet: ms[j], w, entry, start, end });
    }
  }
  return { list: out, drop };
}
// one week's trade: enter at the entry day's close, stop K x ATR(20) away, out at the end day's close or at the stop.
// R gross and net of $0.60 a round trip and, for a buy, nights x FIN.xau.long x entry (mult = cost multiplier)
export function trade(days, win, side, mult = 1) {
  const e = days[win.entry].c, A = atrAt(days, win.entry);
  if (!(A > 0)) return null;
  const risk = P.K * A, sg = side === 'buy' ? 1 : -1, stop = e - sg * risk;
  let exit = days[win.end].c, why = 'time', exitT = days[win.end].t + DAY;
  for (let k = win.start; k <= win.end; k++) {
    const d = days[k];
    const gap = sg > 0 ? d.o <= stop : d.o >= stop, hit = sg > 0 ? d.l <= stop : d.h >= stop;
    if (gap) { exit = d.o; why = 'gap'; exitT = d.t + DAY / 2; break; }
    if (hit) { exit = stop; why = 'stop'; exitT = d.t + DAY / 2; break; }
  }
  const entryT = days[win.entry].t + DAY, nN = sg > 0 ? nights(entryT, exitT) : 0;
  const gross = sg * (exit - e) / risk, cost = mult * (P.COST + nN * P.FINL * e) / risk;
  return { meet: win.meet, w: win.w, side, entryDate: days[win.entry].d, exitDate: dstr(exitT), entryPx: e, stop, exit, why, nights: nN, gross, cost, net: gross - cost };
}
export function streamTrades(days, meets, spec, opts = {}, mult = 1) {
  const { list, drop } = windows(days, meets, opts), trs = [];
  for (const w of list) if (spec.weeks.includes(w.w)) { const x = trade(days, w, spec.side, mult); if (x) trs.push(x); }
  return { trs, drop };
}
// ── statistics ──
export function stat(xs) {
  const n = xs.length; if (!n) return { n: 0, mean: null, sd: null, t: null };
  const mean = xs.reduce((a, x) => a + x, 0) / n, sd = n > 1 ? Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1)) : null;
  return { n, mean, sd, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : null };
}
export function monthSums(trs, key = 'net') {
  const m = new Map();
  for (const x of trs) m.set(x.exitDate.slice(0, 7), (m.get(x.exitDate.slice(0, 7)) || 0) + x[key]);
  return [...m.values()];
}
export function phi(x) {   // standard normal CDF (Abramowitz-Stegun 26.2.17)
  const t = 1 / (1 + 0.2316419 * Math.abs(x)), d = 0.3989422804014327 * Math.exp(-x * x / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), m = ps.length, adj = new Array(m);
  let run = 0;
  idx.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (m - r) * p)); adj[i] = run; });
  return adj;
}
export function rng(seed) {   // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// the scheduled calendar moved: every meeting by its own ±5..±20 trading days
export function shifted(days, meets, seed) {
  const r = rng(seed), [a, b] = P.SHIFT, vals = [];
  for (let s = a; s <= b; s++) vals.push(s, -s);
  const out = [];
  for (const m of meets) {
    const i0 = firstOnOrAfter(days, m); if (i0 >= days.length || days[i0].d !== m) continue;
    const k = i0 + vals[Math.floor(r() * vals.length)];
    if (k >= 0 && k < days.length) out.push(days[k].d);
  }
  return [...new Set(out)].sort();
}
// the release-window check of a date on M5 candles: largest 5-minute range 18:00-19:30 UTC against the median of that window
// over the 20 weekdays before
export function m5Check(m5, date) {
  const C = P.CHECK, d0 = Date.parse(date + 'T00:00:00Z') / 1000, by = new Map();
  for (const [t, , h, l] of m5) {
    if (t < d0 - 40 * DAY || t >= d0 + DAY) continue;
    const day = Math.floor(t / DAY) * DAY, s = t - day;
    if (s < C.from || s >= C.to) continue;
    by.set(day, Math.max(by.get(day) || 0, h - l));
  }
  const prior = [...by.keys()].filter((k) => k < d0 && ![0, 6].includes(new Date(k * 1000).getUTCDay())).sort((a, b) => b - a).slice(0, C.prior).map((k) => by.get(k)).sort((a, b) => a - b);
  const on = by.get(d0);
  if (on == null || prior.length < 10) return { date, ok: false, range: on ?? null, median: null, ratio: null, why: 'no candles' };
  const med = prior.length % 2 ? prior[(prior.length - 1) / 2] : (prior[prior.length / 2 - 1] + prior[prior.length / 2]) / 2;
  const ratio = on / med;
  return { date, ok: ratio >= C.ratio, range: r4(on, 2), median: r4(med, 3), ratio: r4(ratio, 2) };
}
const inWin = (x, w) => x.entryDate >= w[0] && x.entryDate < w[1];
const r4 = (x, d = 4) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d);
export function block(trs) {
  const s = stat(trs.map((x) => x.net)), g = stat(trs.map((x) => x.gross)), ms = stat(monthSums(trs)), mg = stat(monthSums(trs, 'gross'));
  return { n: s.n, netR: r4(s.mean), grossR: r4(g.mean), tNet: r4(ms.t, 2), tGross: r4(mg.t, 2), months: ms.n, sumNet: r4(trs.reduce((a, x) => a + x.net, 0), 2),
    win: s.n ? r4(trs.filter((x) => x.net > 0).length / s.n, 3) : null, stops: trs.filter((x) => x.why !== 'time').length, costR: s.n ? r4(trs.reduce((a, x) => a + x.cost, 0) / s.n) : null };
}
export function cycleD(evenLong, oddLong) {
  const by = new Map();
  for (const x of evenLong) { const c = by.get(x.meet) || { e: [], o: [] }; c.e.push(x.net); by.set(x.meet, c); }
  for (const x of oddLong) { const c = by.get(x.meet) || { e: [], o: [] }; c.o.push(x.net); by.set(x.meet, c); }
  const out = [];
  for (const [meet, c] of by) if (c.e.length && c.o.length) out.push({ meet, D: stat(c.e).mean - stat(c.o).mean });
  return out;
}

export function run(dir, m5file) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, 'xau.json'), 'utf8')), days = fold(j.rows);
  // the new 2006-07 dates, checked on M5 before use
  let check = null, failed = [];
  if (m5file) {
    const m5 = JSON.parse(zlib.gunzipSync(fs.readFileSync(m5file)).toString());
    check = NEW.map((d) => m5Check(m5, d));
    failed = check.filter((c) => !c.ok).map((c) => c.date);
  } else failed = []; // no M5 file: reported as not checked
  const meets = scheduled(failed), meetsAll = scheduled([]);
  const out = { study: 'gold-fomc-cycle', built: '2026-11-14', preregistration: 'research/edge/gold-fomc-cycle/PREREGISTRATION.md',
    source: SOURCE, meetings: meets.length, firstMeeting: meets[0], unscheduled: UNSCHEDULED, newDateCheck: check, newDatesDropped: failed,
    data: { file: 'council-data research/daily/xau.json (OANDA mid, UTC days, weekends folded)', from: days[0].d, to: days[days.length - 1].d, updated: j.updated },
    rule: 'week w = days 5w-1..5w+3 after the scheduled statement day; enter at the close before the week, stop 2 x ATR(20), out at the close of its last day or at the stop; T1 long weeks 2, 4, 6; T2 short weeks 1, 3, 5; week 0 not used',
    costs: { roundTrip: P.COST, financingLongPerNight: P.FINL, financingSrc: FIN.xau.src }, units: 'R (risk = 2 x ATR(20))', windowsBy: 'entry date', tests: {}, reported: {} };
  const all = { ...TESTS, ...REPORTED }, base = {};
  for (const [k, spec] of Object.entries(all)) {
    const b = streamTrades(days, meets, spec), x2 = streamTrades(days, meets, spec, {}, 2), s1 = streamTrades(days, meets, spec, { count: 'brief' }), s2 = streamTrades(days, meets, spec, { unsched: [] });
    base[k] = b.trs;
    const o = { name: spec.name, side: spec.side, weeks: spec.weeks };
    for (const [wk, w] of [['IS', P.IS], ['OOS', P.OOS]]) {
      const pick = (t) => t.filter((x) => inWin(x, w));
      o[wk] = { ...block(pick(b.trs)), x2: block(pick(x2.trs)), S1: block(pick(s1.trs)), S2: block(pick(s2.trs)) };
    }
    const yr = {};
    for (const x of b.trs) if (x.entryDate >= P.IS[0] && x.entryDate < P.OOS[1]) { const y = x.entryDate.slice(0, 4); yr[y] = (yr[y] || 0) + x.net; }
    o.byYear = Object.fromEntries(Object.entries(yr).map(([y, v]) => [y, r4(v, 2)]));
    if (k === 'T1') o.drop = b.drop;
    (TESTS[k] ? out.tests : out.reported)[k] = o;
  }
  for (const [wk, w] of [['IS', P.IS], ['OOS', P.OOS]]) {
    const pick = (t) => t.filter((x) => inWin(x, w)), D = stat(cycleD(pick(base.T1), pick(base.oddLong)).map((x) => x.D));
    out.reported['D_' + wk] = { what: 'per cycle: mean net R of the even-week longs minus that of the odd-week longs', cycles: D.n, D: r4(D.mean), t: r4(D.t, 2) };
  }
  // reported only: the nine 2006-07 dates all kept, whatever the M5 check said (IS only: the OOS calendar is the same)
  out.reported.keepNew = Object.fromEntries(Object.entries(TESTS).map(([k, spec]) => [k, block(streamTrades(days, meetsAll, spec).trs.filter((x) => inWin(x, P.IS)))]));
  const keys = Object.keys(TESTS), ps = keys.map((k) => { const t = out.tests[k].OOS.tNet; return t == null ? 1 : 1 - phi(t); }), adj = holm(ps);
  keys.forEach((k, i) => { out.tests[k].OOS.p = r4(ps[i], 5); out.tests[k].OOS.pHolm = r4(adj[i], 5); });
  // placebo: moved calendars, the same streams, OOS net month-sum t
  const pl = Object.fromEntries(keys.map((k) => [k, []]));
  for (let seed = 1; seed <= P.SEEDS; seed++) {
    const sm = shifted(days, meets, seed);
    for (const k of keys) pl[k].push(block(streamTrades(days, sm, TESTS[k]).trs.filter((x) => inWin(x, P.OOS))).tNet);
  }
  const crit = 1 - phi(P.TBAR);
  out.pHolmBar = r4(crit, 5);
  out.placebo = {};
  out.checks = {};
  for (const k of keys) {
    const T = out.tests[k], real = T.OOS.tNet, beaten = pl[k].filter((x) => real > x).length;
    out.placebo[k] = { seeds: P.SEEDS, shift: P.SHIFT, t: pl[k], mean: r4(stat(pl[k]).mean, 2), max: r4(Math.max(...pl[k]), 2), beaten };
    out.checks[k] = { oos: T.OOS.netR > 0 && T.OOS.pHolm <= crit, isSign: T.IS.netR > 0, x2: T.OOS.x2.netR > 0, placebo: beaten >= P.NEED };
    T.pass = Object.values(out.checks[k]).every(Boolean);
  }
  out.verdict = keys.some((k) => out.tests[k].pass) ? 'PASS' : 'FAIL';
  return out;
}

const f = (x, d = 3) => (x == null ? 'n/a' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d));
export function headline(r) {
  const a = r.tests.T1, b = r.tests.T2;
  const why = `T1 even-week long OOS ${f(a.OOS.netR)}R net (n ${a.OOS.n}, month t ${f(a.OOS.tNet, 2)}, Holm p ${a.OOS.pHolm}) but IS ${f(a.IS.netR)}R; T2 odd-week short OOS ${f(b.OOS.netR)}R (t ${f(b.OOS.tNet, 2)})`;
  return `**Verdict: ${r.verdict}, ${r.verdict === 'PASS' ? 'a lead, not an edge: ' : ''}${why}.**`;
}
export function report(r) {
  const L = [], T = r.tests;
  L.push('# Gold over the FOMC cycle: long weeks 2, 4, 6 and short weeks 1, 3, 5 after a meeting: result', '');
  L.push(headline(r), '');
  L.push(`Pre-registered in \`PREREGISTRATION.md\` (committed and pushed alone before \`run.mjs\` existed). Research only: no live rule, size, filter, stop or config changed; not a gate, exit, entry or size of the live gold book (item 44); ICT untouched. Topic: candidate 1 of \`research/proposals/2026-11-14-untested-backlog.md\` (the FOMC cycle; the index version \`fomc-even-week\` failed) carried to spot gold, where no study had read it.`, '');
  L.push(`Data: ${r.data.file}, ${r.data.from} → ${r.data.to}. Meetings: ${r.meetings} scheduled statements from ${r.firstMeeting} (${r.source}); unscheduled ${r.unscheduled.join(', ')} never start a cycle and weeks touching their days −1..+3 are dropped. Rule: ${r.rule}. Costs: $${P.COST.toFixed(2)} a round trip, and on buys ${r.costs.financingLongPerNight} of price a rollover (\`council/fills.mjs\` \`FIN.xau.long\`, today's demo rate for every year; \`nights\`, Wednesday three); sells pay nothing. Windows by entry date: IS 2007-2016, OOS 2017 → Oct 2026. t on calendar-month sums of net R; Holm over T1 and T2 (bar p ≤ ${r.pHolmBar}).`, '');
  if (r.newDateCheck) L.push(`New 2006-07 dates checked on OANDA M5 (largest 5-minute range 18:00-19:30 UTC against the median of the 20 weekdays before, ≥ 1.5 needed): ${r.newDateCheck.map((c) => `${c.date} ${c.ratio ?? 'n/a'}${c.ok ? '' : ' (dropped)'}`).join(', ')}.`, '');
  L.push('## The tests', '', '| test | window | n | net R a trade | gross R | month-sum t net | t gross | net at 2x costs | t 2x | win % | stops | cost R a trade | Holm p | placebo beaten |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const k of Object.keys(T)) for (const w of ['IS', 'OOS']) {
    const x = T[k][w];
    L.push(`| ${k} ${T[k].name} | ${w === 'IS' ? '2007-2016' : '2017 → Oct 2026'} | ${x.n} | ${f(x.netR)} | ${f(x.grossR)} | ${f(x.tNet, 2)} | ${f(x.tGross, 2)} | ${f(x.x2.netR)} | ${f(x.x2.tNet, 2)} | ${x.win == null ? 'n/a' : (x.win * 100).toFixed(1)} | ${x.stops} | ${f(x.costR)} | ${w === 'OOS' ? x.pHolm : '·'} | ${w === 'OOS' ? `${r.placebo[k].beaten} of 40` : '·'} |`);
  }
  L.push('');
  for (const k of Object.keys(T)) L.push(`- ${k} checks: ` + Object.entries(r.checks[k]).map(([c, v]) => `${c} ${v ? 'met' : 'not met'}`).join(' · ') + `. Placebo OOS month t: mean ${f(r.placebo[k].mean, 2)}, max ${f(r.placebo[k].max, 2)}.`);
  L.push('', '## Reported, not judged', '');
  for (const k of ['allLong', 'oddLong']) { const x = r.reported[k]; L.push(`- ${x.name}: IS ${f(x.IS.netR)}R (n ${x.IS.n}, t ${f(x.IS.tNet, 2)}), OOS ${f(x.OOS.netR)}R (n ${x.OOS.n}, t ${f(x.OOS.tNet, 2)}).`); }
  L.push(`- Even minus odd weeks, long, per cycle (D, net R a trade): IS ${f(r.reported.D_IS.D)} (${r.reported.D_IS.cycles} cycles, t ${f(r.reported.D_IS.t, 2)}), OOS ${f(r.reported.D_OOS.D)} (${r.reported.D_OOS.cycles} cycles, t ${f(r.reported.D_OOS.t, 2)}).`);
  L.push(`- IS with all nine 2006-07 dates kept (the check dropped ${r.newDatesDropped.length}): T1 ${f(r.reported.keepNew.T1.netR)}R (n ${r.reported.keepNew.T1.n}, t ${f(r.reported.keepNew.T1.tNet, 2)}), T2 ${f(r.reported.keepNew.T2.netR)}R (n ${r.reported.keepNew.T2.n}, t ${f(r.reported.keepNew.T2.tNet, 2)}).`);
  for (const k of Object.keys(T)) { const o = T[k].OOS, i = T[k].IS; L.push(`- ${k} sensitivity: S1, week w = days 5w..5w+4: IS ${f(i.S1.netR)} (t ${f(i.S1.tNet, 2)}), OOS ${f(o.S1.netR)} (t ${f(o.S1.tNet, 2)}); S2, unscheduled not excluded: IS ${f(i.S2.netR)} (t ${f(i.S2.tNet, 2)}), OOS ${f(o.S2.netR)} (t ${f(o.S2.tNet, 2)}).`); }
  L.push('', '## By year (sum of net R, by entry year)', '');
  for (const k of Object.keys(T)) L.push(`- ${k}: ` + Object.entries(T[k].byYear).map(([y, v]) => `${y} ${f(v, 1)}`).join(' · '));
  const dr = T.T1.drop;
  L.push('', '## Weeks dropped (all weeks, whole file)', '', `No candle on the statement day: ${dr.noDay0.join(', ') || 'none'}. Cut by the next meeting: ${dr.cut}. Past the data: ${dr.data}. Holes: ${dr.hole}. Unscheduled: ${dr.unscheduled}.`, '');
  L.push('## What this means', '');
  if (r.verdict === 'PASS') L.push('A test met every line of the pre-registered bar. It is a lead to replicate on years and markets it did not use (silver, an earlier window), not an edge; no proposal follows from this study and nothing live changed.');
  else {
    const a = r.tests.T1;
    L.push(`Neither test meets the pre-registered bar. T1 comes closest and is said plainly: out of sample the even-week long made ${f(a.OOS.netR)}R a trade after costs (month-sum t ${f(a.OOS.tNet, 2)}, above ${r.placebo.T1.beaten} of 40 moved calendars, positive at twice the cost), but its Holm-adjusted p (${a.OOS.pHolm}) is just over the bar (${r.pHolmBar}) and in sample it lost ${f(a.IS.netR)}R a trade (t ${f(a.IS.tNet, 2)}), so the sign does not hold across the two windows. A rule that loses for ten years and wins for the next ten, in a decade when gold itself rose, is not evidence of an FOMC-cycle effect; the odd-week short lost in both windows. This closes the gold version of backlog candidate 1. No proposal is written and nothing live changed. Re-reading the same 2017-26 weeks with another counting, week 0 or a filter would be a re-fit of this result; any other version needs its own pre-registration on data not used here.`);
  }
  L.push('', 'To repeat: `node research/edge/gold-fomc-cycle/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then `node research/edge/gold-fomc-cycle/run.mjs <dir> <xau-5m.json.gz>` (the M5 file only checks the 2006-07 dates; OANDA through `/md/bars`, kept out of git). Tests: `tests/gold-fomc-cycle.test.mjs`.', '');
  return L.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [a, b] = process.argv.slice(2);
  if (a === 'fetch') {
    if (!b) throw new Error('usage: node run.mjs fetch <dir>');
    fs.mkdirSync(b, { recursive: true });
    fs.writeFileSync(path.join(b, 'xau.json'), execFileSync('git', ['show', 'origin/council-data:research/daily/xau.json'], { maxBuffer: 1 << 28 }));
    console.log('saved xau.json to', b);
  } else {
    if (!a) throw new Error('usage: node run.mjs <dir> [<xau-5m.json.gz>]');
    const r = run(a, b);
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(r, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(r));
    console.log(JSON.stringify(r.newDateCheck));
    for (const k of Object.keys(r.tests)) for (const w of ['IS', 'OOS']) { const x = r.tests[k][w]; console.log(k, w, x.n, x.netR, x.grossR, x.tNet, x.tGross, 'x2', x.x2.netR, w === 'OOS' ? x.pHolm : ''); }
    console.log(r.placebo.T1.beaten, r.placebo.T2.beaten, r.checks, r.verdict);
    console.log(headline(r).length, headline(r));
  }
}
