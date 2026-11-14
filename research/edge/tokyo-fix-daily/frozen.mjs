// Edge research · gotobi: on Japanese settlement days (5th, 10th, 15th, 20th, 25th and the month's last Tokyo business day,
// rolled back to the previous Tokyo business day), buy USD/JPY at 07:00 Tokyo and sell at the 09:55 fix (long leg), and sell
// at the fix and buy back at 15:00 Tokyo (fade leg); the same on EUR/JPY. Stop 1.5 x the 20-day median of the window's move,
// raw-spread costs plus slippage, net R. Four tests, Holm, a 40-seed placebo of non-gotobi days (PREREGISTRATION.md).
//   node research/edge/gotobi/run.mjs <candleDir>   (the files fetch.mjs wrote; writes result.json and RESULT.md here)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---- the Tokyo calendar, copied from research/edge/turnaround-replicate/run.mjs (branch turnaround-replicate) --------------
const ymdU = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);   // m 1-12, d may overflow
const dowU = (s) => new Date(s + 'T12:00:00Z').getUTCDay();
export const addD = (s, n) => new Date(Date.parse(s + 'T12:00:00Z') + n * 86400e3).toISOString().slice(0, 10);
const nthMon = (y, m, n) => { const first = ymdU(y, m, 1); return addD(first, ((1 - dowU(first) + 7) % 7) + 7 * (n - 1)); };
const cache = new Map();
const memo = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };
// Japan's national holidays (the law as amended; the 2019-21 one-off moves), then the Tokyo Stock Exchange's own closed days
export function jpHolidays(y) {
  return memo('j' + y, () => {
    const s = new Set(), add = (d) => s.add(d);
    const vern = Math.floor(20.8431 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
    const aut = Math.floor(23.2488 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
    add(ymdU(y, 1, 1)); add(nthMon(y, 1, 2)); add(ymdU(y, 2, 11));
    if (y <= 2018) add(ymdU(y, 12, 23)); if (y >= 2020) add(ymdU(y, 2, 23));
    add(ymdU(y, 3, vern)); add(ymdU(y, 4, 29)); add(ymdU(y, 5, 3)); add(ymdU(y, 5, 4)); add(ymdU(y, 5, 5));
    add(y === 2020 ? '2020-07-23' : y === 2021 ? '2021-07-22' : nthMon(y, 7, 3));
    if (y >= 2016) add(y === 2020 ? '2020-08-10' : y === 2021 ? '2021-08-08' : ymdU(y, 8, 11));
    add(nthMon(y, 9, 3)); add(ymdU(y, 9, aut));
    add(y === 2020 ? '2020-07-24' : y === 2021 ? '2021-07-23' : nthMon(y, 10, 2));
    add(ymdU(y, 11, 3)); add(ymdU(y, 11, 23));
    if (y === 2019) { add('2019-05-01'); add('2019-10-22'); }
    const base = [...s].sort();
    for (const d of base) if (dowU(d) === 0) { let x = addD(d, 1); while (s.has(x)) x = addD(x, 1); s.add(x); }   // substitute
    for (const d of [...s].sort()) { const x = addD(d, 2); if (s.has(x) && !s.has(addD(d, 1)) && dowU(addD(d, 1)) !== 0) s.add(addD(d, 1)); } // citizen's
    return s;
  });
}
export function tseHolidays(y) {
  return memo('t' + y, () => { const s = new Set(jpHolidays(y)); for (const d of [ymdU(y, 1, 1), ymdU(y, 1, 2), ymdU(y, 1, 3), ymdU(y, 12, 31)]) s.add(d); return s; });
}
// ---- end of the copy ---------------------------------------------------------------------------------------------------------

export const isTokyoBusinessDay = (ymd) => { const w = dowU(ymd); return w !== 0 && w !== 6 && !tseHolidays(+ymd.slice(0, 4)).has(ymd); };
export const prevBusinessDay = (ymd) => { let d = ymd; while (!isTokyoBusinessDay(d)) d = addD(d, -1); return d; };   // ymd itself if open

// the gotobi days of one month: 5, 10, 15, 20, 25 rolled back, plus the last business day; sorted, each once
export function gotobiOfMonth(y, m) {
  const s = new Set();
  for (const d of [5, 10, 15, 20, 25]) s.add(prevBusinessDay(ymdU(y, m, d)));
  s.add(prevBusinessDay(ymdU(y, m + 1, 0)));
  return [...s].sort();
}
export function gotobiSet(fromY, toY) {
  const s = new Set();
  for (let y = fromY; y <= toY; y++) for (let m = 1; m <= 12; m++) for (const d of gotobiOfMonth(y, m)) s.add(d);
  return s;
}

// ---- times (UTC) ------------------------------------------------------------------------------------------------------------
const NYH = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' });
export const nyHour = (t) => +NYH.format(new Date(t * 1000));
export const LEGS = {
  long: { side: 1, name: 'Long into the fix (07:00 -> 09:55 Tokyo)' },
  fade: { side: -1, name: 'Fade after the fix (09:55 -> 15:00 Tokyo)' },
};
// entry and exit times of a leg for the trade day `ymd` (the Tokyo date); the long entry moves to 22:05 UTC when 22:00 UTC is
// 17:00 New York (the rollover, New York standard time)
export function legTimes(leg, ymd) {
  const day0 = Date.parse(ymd + 'T00:00:00Z') / 1000;
  if (leg === 'long') {
    let entry = day0 - 2 * 3600;                       // 22:00 UTC the day before = 07:00 Tokyo
    if (nyHour(entry) === 17) entry += 300;            // rollover: 22:05 UTC
    return { entry, exit: day0 + 55 * 60 };            // 00:55 UTC = 09:55 Tokyo
  }
  return { entry: day0 + 55 * 60, exit: day0 + 6 * 3600 };   // 09:55 -> 15:00 Tokyo
}

// ---- prices --------------------------------------------------------------------------------------------------------------
export function index(bars) { const m = new Map(); bars.forEach((b, i) => m.set(b[0], i)); return { bars, at: m }; }
export const EXIT_GRACE = 900;
export function entryPx(ix, t) { const i = ix.at.get(t); return i == null ? null : { i, px: ix.bars[i][1] }; }
// open of the candle at t; else the close of the last candle before t that started <= 15 min before t
export function exitPx(ix, t) {
  const i = ix.at.get(t); if (i != null) return ix.bars[i][1];
  for (let k = 1; k <= EXIT_GRACE / 300; k++) { const j = ix.at.get(t - 300 * k); if (j != null) return ix.bars[j][4]; }
  return null;
}
export function windowMove(ix, leg, ymd) {
  const { entry, exit } = legTimes(leg, ymd), e = entryPx(ix, entry), x = exitPx(ix, exit);
  return e && x != null ? x - e.px : null;
}
const median = (a) => { const s = [...a].sort((p, q) => p - q), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
export const STOP_K = 1.5, LOOKBACK = 20, MIN_LOOK = 15;
// D from the 20 Tokyo business days strictly before ymd (null when fewer than 15 have the window)
export function stopDist(moveOf, ymd) {
  const prev = []; let d = addD(ymd, -1);
  while (prev.length < LOOKBACK) { if (isTokyoBusinessDay(d)) prev.push(d); d = addD(d, -1); }
  const mv = prev.map(moveOf).filter((v) => v != null).map(Math.abs);
  return mv.length >= MIN_LOOK ? STOP_K * median(mv) : null;
}

// ---- costs ---------------------------------------------------------------------------------------------------------------
export const PIP = 0.01, SPREAD_PIPS = 0.3, SLIP_PIPS = 0.5, COMMISSION = 22.5e-6;   // USD 22.5 per million a side
export const costPx = (entry) => SPREAD_PIPS * PIP + 2 * SLIP_PIPS * PIP + 2 * COMMISSION * entry;

// one trade; null when the day has no trade
export function trade(ix, leg, ymd, D) {
  if (!(D > 0)) return null;
  const { entry, exit } = legTimes(leg, ymd), e = entryPx(ix, entry), xp = exitPx(ix, exit);
  if (!e || xp == null) return null;
  const side = LEGS[leg].side, stop = e.px - side * D;
  let out = xp, how = 'time';
  for (let i = e.i; i < ix.bars.length && ix.bars[i][0] < exit; i++) {
    const [, o, h, l] = ix.bars[i];
    if (side > 0 ? o <= stop : o >= stop) { out = o; how = 'gap'; break; }
    if (side > 0 ? l <= stop : h >= stop) { out = stop; how = 'stop'; break; }
  }
  const R = side * (out - e.px) / D, cR = costPx(e.px) / D;
  return { day: ymd, entryT: entry, exitT: exit, entry: e.px, stop, D, exit: out, how, R, costR: cR, net: R - cR };
}

// ---- statistics ----------------------------------------------------------------------------------------------------------
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
export function monthT(trades) {
  const m = new Map(); for (const t of trades) { const k = t.day.slice(0, 7); m.set(k, (m.get(k) || 0) + t.net); }
  const v = [...m.values()]; if (v.length < 3) return { months: v.length, t: null };
  return { months: v.length, t: mean(v) / (sd(v) / Math.sqrt(v.length)) };
}
export function normCdf(z) {   // Abramowitz-Stegun 7.1.26
  const x = Math.abs(z) / Math.SQRT2, k = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}
export function summary(trades) {
  if (!trades.length) return { n: 0 };
  const net = trades.map((t) => t.net), mt = monthT(trades), r = (v, d = 3) => Math.round(v * 10 ** d) / 10 ** d;
  return {
    n: trades.length, netR: r(mean(net), 4), grossR: r(mean(trades.map((t) => t.R)), 4), costR: r(mean(trades.map((t) => t.costR)), 4),
    totalR: r(net.reduce((s, v) => s + v, 0), 2), tradeT: r(mean(net) / (sd(net) / Math.sqrt(net.length)), 2),
    months: mt.months, t: mt.t == null ? null : r(mt.t, 2), win: r(trades.filter((t) => t.net > 0).length / trades.length, 4),
    stopShare: r(trades.filter((t) => t.how !== 'time').length / trades.length, 4),
    stopPips: r(median(trades.map((t) => t.D)) / PIP, 1),
  };
}
export function holm(ps, alpha = 0.05) {
  const o = ps.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p), ok = ps.map(() => false), adj = ps.map(() => 1);
  let run = 0, go = true;
  o.forEach(({ p, i }, k) => { run = Math.max(run, Math.min(1, p * (ps.length - k))); adj[i] = run; if (go && p <= alpha / (ps.length - k)) ok[i] = true; else go = false; });
  return { ok, adj };
}
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function draw(pool, n, seed) {
  const a = [...pool], rnd = mulberry32(seed);
  for (let i = 0; i < n && i < a.length; i++) { const j = i + Math.floor(rnd() * (a.length - i)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}

// ---- the study -----------------------------------------------------------------------------------------------------------
export const PAIRS = { usdjpy: 'USD/JPY', eurjpy: 'EUR/JPY' };
export const TESTS = [
  { id: 'T1', pair: 'usdjpy', leg: 'long' }, { id: 'T2', pair: 'usdjpy', leg: 'fade' },
  { id: 'T3', pair: 'eurjpy', leg: 'long' }, { id: 'T4', pair: 'eurjpy', leg: 'fade' },
];
export const DECISIVE = ['2016-01-01', null], REPLICATION = ['2010-01-01', '2015-12-31'];
export const SEEDS = 40, P_RANK = 38, ALPHA = 0.05, T_BAR = 2;
const inWin = (d, [a, b]) => d >= a && (b == null || d <= b);

export function runPair(bars, leg, lastDay) {
  const ix = index(bars), moves = new Map();
  const moveOf = (d) => { if (!moves.has(d)) moves.set(d, windowMove(ix, leg, d)); return moves.get(d); };
  const G = gotobiSet(2009, +lastDay.slice(0, 4)), days = [];
  for (let d = REPLICATION[0]; d <= lastDay; d = addD(d, 1)) if (isTokyoBusinessDay(d)) days.push(d);
  const all = new Map(); let noData = { gotobi: 0, other: 0 };
  for (const d of days) {
    const t = trade(ix, leg, d, stopDist(moveOf, d));
    if (t) all.set(d, t); else noData[G.has(d) ? 'gotobi' : 'other']++;
  }
  return { G, days, all, noData };
}

export function study(candles, lastDay) {
  const out = { tests: {} }, ps = [];
  for (const T of TESTS) {
    const { G, days, all, noData } = runPair(candles[T.pair], T.leg, lastDay);
    const got = [...all.values()].filter((t) => G.has(t.day));
    const dec = got.filter((t) => inWin(t.day, DECISIVE)), rep = got.filter((t) => inWin(t.day, REPLICATION));
    const pool = [...all.values()].filter((t) => !G.has(t.day) && inWin(t.day, DECISIVE));
    const plac = [];
    for (let s = 1; s <= SEEDS; s++) plac.push(mean(draw(pool, dec.length, s).map((t) => t.net)));
    const sorted = [...plac].sort((a, b) => a - b), p95 = sorted[P_RANK - 1];
    const sD = summary(dec), sR = summary(rep), p = sD.t == null ? 1 : 1 - normCdf(sD.t);
    ps.push(p);
    const byYear = {};
    for (const t of got) { const y = t.day.slice(0, 4); (byYear[y] ||= []).push(t); }
    out.tests[T.id] = {
      pair: PAIRS[T.pair], leg: T.leg, legName: LEGS[T.leg].name,
      gotobiDays: { decisive: days.filter((d) => G.has(d) && inWin(d, DECISIVE)).length, replication: days.filter((d) => G.has(d) && inWin(d, REPLICATION)).length },
      noData, decisive: sD, replication: sR, pOneSided: Math.round(p * 1e4) / 1e4,
      placebo: { seeds: SEEDS, poolDays: pool.length, n: dec.length, p95: Math.round(p95 * 1e4) / 1e4, rank: P_RANK, median: Math.round(median(plac) * 1e4) / 1e4, beats: plac.filter((v) => sD.netR > v).length, values: plac.map((v) => Math.round(v * 1e4) / 1e4) },
      allDays: { decisive: summary(pool), note: 'every non-gotobi Tokyo business day of the decisive window, same leg' },
      byYear: Object.fromEntries(Object.entries(byYear).map(([y, a]) => { const s = summary(a); return [y, { n: s.n, netR: s.netR, totalR: s.totalR }]; })),
    };
  }
  const H = holm(ps, ALPHA);
  TESTS.forEach((T, i) => {
    const r = out.tests[T.id];
    r.holmP = Math.round(H.adj[i] * 1e4) / 1e4;
    r.checks = {
      netPositive: r.decisive.netR > 0, monthT: r.decisive.t != null && r.decisive.t >= T_BAR,
      replicationSameSign: r.replication.netR > 0, holm: H.ok[i], placebo: r.decisive.netR > r.placebo.p95,
    };
    r.pass = Object.values(r.checks).every(Boolean);
  });
  const passed = TESTS.filter((T) => out.tests[T.id].pass).map((T) => T.id);
  out.passed = passed;
  out.verdict = passed.length ? `PASS (${passed.join(', ')})` : 'FAIL';
  return out;
}

const fmt = (v, d = 3) => v == null ? 'n/a' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d);
export function report(res) {
  const L = [], T = res.tests;
  const ids = TESTS.map((x) => x.id);
  const passN = res.passed.length;
  L.push('# Gotobi: USD/JPY and EUR/JPY into the 09:55 Tokyo fix on settlement days, and the fade after it', '');
  L.push(`**Verdict: ${res.verdict}.** ${passN ? `${res.passed.join(', ')} met all five pre-registered conditions.` : `None of the four tests met the pre-registered bar (${ids.map((k) => `${k} ${T[k].pair} ${T[k].leg} ${fmt(T[k].decisive.netR)}R a trade net, month t ${fmt(T[k].decisive.t, 2)}`).join('; ')}, 2016-now).`} Pre-registered in PREREGISTRATION.md (first commit of the branch), OANDA mid M5, net of the raw-spread cost model plus 0.5 pip slippage a side. Paper research only; nothing live changed.`, '');
  L.push('## Results', '');
  L.push('| Test | Pair | Leg | Window | n | Net R a trade | Gross R a trade | Cost R | Total net R | Month t | Months | Win % | Stopped % | Median stop (pips) |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const k of ids) for (const [w, s] of [['2016-now', T[k].decisive], ['2010-15', T[k].replication]])
    L.push(`| ${k} | ${T[k].pair} | ${T[k].leg} | ${w} | ${s.n} | ${fmt(s.netR)} | ${fmt(s.grossR)} | ${s.costR.toFixed(3)} | ${fmt(s.totalR, 1)} | ${fmt(s.t, 2)} | ${s.months} | ${(s.win * 100).toFixed(1)} | ${(s.stopShare * 100).toFixed(1)} | ${s.stopPips} |`);
  L.push('', '## The five conditions', '');
  L.push('| Test | Net R > 0 | Month t >= 2 | 2010-15 same sign | Holm (adj. p) | Placebo 95th pct (net R) | Beats placebo | Pass |');
  L.push('|---|---|---|---|---|---|---|---|');
  const yn = (b) => (b ? 'yes' : 'no');
  for (const k of ids) { const c = T[k].checks; L.push(`| ${k} | ${yn(c.netPositive)} | ${yn(c.monthT)} | ${yn(c.replicationSameSign)} | ${yn(c.holm)} (${T[k].holmP}) | ${fmt(T[k].placebo.p95)} | ${yn(c.placebo)} (above ${T[k].placebo.beats} of 40) | ${T[k].pass ? 'PASS' : 'fail'} |`); }
  L.push('', '## Placebo and every other day', '');
  L.push('Each placebo seed draws as many non-gotobi Tokyo business days of 2016-now as the test has trades and runs the identical leg. "Every other day" is the leg on all of them.', '');
  L.push('| Test | Placebo median net R | Placebo 95th pct (38th of 40) | Every non-gotobi day: n | net R | month t |');
  L.push('|---|---|---|---|---|---|');
  for (const k of ids) { const a = T[k].allDays.decisive; L.push(`| ${k} | ${fmt(T[k].placebo.median)} | ${fmt(T[k].placebo.p95)} | ${a.n} | ${fmt(a.netR)} | ${fmt(a.t, 2)} |`); }
  L.push('', '## By year (net R total, gotobi trades)', '');
  const years = [...new Set(ids.flatMap((k) => Object.keys(T[k].byYear)))].sort();
  L.push(`| Test | ${years.join(' | ')} |`, `|---|${years.map(() => '---').join('|')}|`);
  for (const k of ids) L.push(`| ${k} | ${years.map((y) => (T[k].byYear[y] ? fmt(T[k].byYear[y].totalR, 1) : '')).join(' | ')} |`);
  L.push('', '## Notes', '');
  for (const n of res.notes || []) L.push(`- ${n}`);
  return L.join('\n') + '\n';
}

async function main() {
  const [dir] = process.argv.slice(2);
  if (!dir) throw new Error('usage: node run.mjs <candleDir>');
  const candles = {};
  for (const p of Object.keys(PAIRS)) candles[p] = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${p}-5m.json.gz`))));
  const lastT = Math.min(...Object.values(candles).map((b) => b.at(-1)[0]));
  const lastDay = addD(new Date(lastT * 1000).toISOString().slice(0, 10), -1);   // the last whole day on file
  const res = study(candles, lastDay);
  const first = Object.fromEntries(Object.entries(candles).map(([p, b]) => [p, new Date(b[0][0] * 1000).toISOString().slice(0, 10)]));
  const out = {
    study: 'gotobi', built: '2026-11-14', verdict: res.verdict, passed: res.passed,
    rule: 'Gotobi days (5, 10, 15, 20, 25 and the last Tokyo business day, rolled back to the previous Tokyo business day). Long: buy 22:00 UTC the day before (22:05 when that is the New York 17:00 rollover), sell 00:55 UTC. Fade: sell 00:55 UTC, buy 06:00 UTC. Stop 1.5 x the 20-business-day median of the same window\'s absolute move. Net of 0.3 pip spread, USD 22.5 per million a side and 0.5 pip slippage a side.',
    data: { source: 'OANDA mid M5 through the /md/bars proxy', first, lastDay },
    windows: { decisive: [DECISIVE[0], lastDay], replication: REPLICATION },
    costs: { spreadPips: SPREAD_PIPS, slipPipsASide: SLIP_PIPS, commissionPerMillionASide: COMMISSION * 1e6, pip: PIP },
    bar: { netR: '> 0', monthT: T_BAR, replication: 'same sign', holm: { tests: 4, alpha: ALPHA }, placebo: { seeds: SEEDS, rank: P_RANK } },
    tests: res.tests,
  };
  out.notes = NOTES(out);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(out));
  for (const [k, r] of Object.entries(res.tests)) console.log(k, r.pair, r.leg, JSON.stringify(r.decisive), JSON.stringify(r.replication), 'p95', r.placebo.p95, r.pass);
  console.log(res.verdict);
}

// notes for the report, read from the numbers
function NOTES(o) {
  const T = o.tests, n = [];
  n.push(`Data: OANDA mid M5, USD/JPY from ${o.data.first.usdjpy}, EUR/JPY from ${o.data.first.eurjpy}, through ${o.data.lastDay}. Gotobi trades lost to missing candles: ${Object.keys(T).map((k) => `${k} ${T[k].noData.gotobi}`).join(', ')} (of ${T.T1.gotobiDays.decisive + T.T1.gotobiDays.replication} gotobi days in both windows).`);
  n.push('The long entry is 22:05 UTC whenever 22:00 UTC is 17:00 New York (New York standard time, about November to March), the rollover gap; 22:00 UTC otherwise. No position is held across a rollover, so no financing is charged.');
  n.push('Costs per round trip: 0.3 pip spread + 2 x 0.5 pip slippage + 2 x USD 22.5 per million (about 0.7 pip at 150 yen), so about 2 pips; the cost in R is that divided by the stop distance D. The 0.3 pip spread is the USD/JPY-style raw-spread figure, used unmeasured for EUR/JPY.');
  n.push('The month t is on calendar-month sums of net R; the trade t in result.json (`tradeT`) treats the about six trades of a month as independent and is shown for information only.');
  n.push('The placebo 95th percentiles are below zero because the same windows on ordinary days lose about their cost (the "every non-gotobi day" column): the placebo asks whether gotobi days beat ordinary days, the other conditions whether they beat zero.');
  for (const [k, r] of Object.entries(T)) {
    if (!r.pass) continue;
    const ys = Object.entries(r.byYear), dec = ys.filter(([y]) => y >= '2016'), rep = ys.filter(([y]) => y < '2016');
    const x2 = r.decisive.grossR - 2 * r.decisive.costR;
    n.push(`Read after the verdict, not part of it (${k}): positive in ${dec.filter(([, v]) => v.totalR > 0).length} of ${dec.length} years of 2016-now and ${rep.filter(([, v]) => v.totalR > 0).length} of ${rep.length} of 2010-15; at twice the costs it would make ${(x2 >= 0 ? '+' : '−') + Math.abs(x2).toFixed(3)}R a trade on 2016-now. The other three tests did not pass and are not evidence for it.`);
  }
  return n;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
