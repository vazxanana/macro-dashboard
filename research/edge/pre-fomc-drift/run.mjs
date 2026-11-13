// Edge research · pre-fomc-drift: the pre-FOMC announcement drift (Lucca and Moench 2015) on the council's index feeds,
// out of sample, net of CFD costs. Rules, costs, windows, placebo and pass bar: PREREGISTRATION.md (committed first).
//   node --use-env-proxy research/edge/pre-fomc-drift/fetch.mjs <dir>     (OANDA M5 candles, kept out of git)
//   node research/edge/pre-fomc-drift/run.mjs <dir>                       (writes result.json and RESULT.md here)
// Pure pieces are exported for tests/pre-fomc-drift.test.mjs. Paper research only: nothing live reads this.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { zonedToUtc } from '../../../council/events.mjs';
import { nights } from '../../../council/fills.mjs';
import { nyOffsetH } from '../../../council/histdata.mjs';
import { fomcEvents, ALL_ANNOUNCE, SOURCE, UNSCHEDULED } from './events.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86400, M5 = 300, US = 'America/New_York';
const T0 = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
export const P = Object.freeze({
  K: 1.5, ATR: 14, HOLD: DAY, PRE: 300, LOOK: 3600,
  COST: Object.freeze({ spx500: 1.0, nas100: 2.0, xau: 0.5 }), FIN_YEAR: 0.06,
  WIN: Object.freeze({ A: [T0('2008-01-01'), T0('2016-01-01')], B: [T0('2016-01-01'), T0('2026-11-13')] }),
  SEEDS: 40, EXCL_DAYS: 3, HALF: 182, TRIES: 50, Q: 0.95,
});
export const MARKETS = ['spx500', 'nas100', 'xau'];

// ── times ──
// T = statement time (UTC); entry = the close of the M5 candle ending at T - 24 h, exit = the one ending at T - 5 min
export const timesOf = (T) => ({ tE: T - P.HOLD, tX: T - P.PRE });
export const nyDate = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: US }).format(new Date(t * 1000));

// ── candles: { t, o, h, l, c } typed arrays, t = candle start ──
export function toBars(rows) {
  const n = rows.length, b = { t: new Float64Array(n), o: new Float64Array(n), h: new Float64Array(n), l: new Float64Array(n), c: new Float64Array(n), n };
  rows.forEach((r, i) => { b.t[i] = r[0]; b.o[i] = r[1]; b.h[i] = r[2]; b.l[i] = r[3]; b.c[i] = r[4]; });
  return b;
}
// index of the last candle whose END (t + 5 min) is at or before `end` and within LOOK of it; -1 if none
export function lastEnding(b, end, look = P.LOOK) {
  let lo = 0, hi = b.n;   // first candle with t + M5 > end
  while (lo < hi) { const m = (lo + hi) >> 1; if (b.t[m] + M5 <= end) lo = m + 1; else hi = m; }
  const i = lo - 1;
  return i >= 0 && b.t[i] + M5 >= end - look ? i : -1;
}
// New York trading days (17:00 to 17:00 New York) built from the candles: { end, o, h, l, c }, end = the 17:00 that closes it
export function nyDays(b) {
  const out = []; let cur = null;
  for (let i = 0; i < b.n; i++) {
    const t = b.t[i], loc = t - nyOffsetH(t) * 3600, key = Math.floor((loc + 7 * 3600) / DAY);
    if (!cur || cur.key !== key) {
      if (cur) out.push(cur);
      const e0 = key * DAY + 17 * 3600;   // 17:00 local of that date, as if UTC; the New York offset of that moment added
      cur = { key, end: e0 + nyOffsetH(e0 + 5 * 3600) * 3600, o: b.o[i], h: b.h[i], l: b.l[i], c: b.c[i] };
    } else { if (b.h[i] > cur.h) cur.h = b.h[i]; if (b.l[i] < cur.l) cur.l = b.l[i]; cur.c = b.c[i]; }
  }
  if (cur) out.push(cur);
  return out;
}
// ATR(14) of the complete New York days that ended at or before t (true range with the prior day's close); null if too few
export function atrAt(days, t, n = P.ATR) {
  let lo = 0, hi = days.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (days[m].end <= t) lo = m + 1; else hi = m; }
  const k = lo;   // days[0..k-1] ended by t
  if (k < n + 1) return null;
  let s = 0;
  for (let j = k - n; j < k; j++) { const d = days[j], pc = days[j - 1].c; s += Math.max(d.h - d.l, Math.abs(d.h - pc), Math.abs(d.l - pc)); }
  return s / n;
}
// rollovers crossed: 22:00 UTC on a weekday; indices count Friday 3x, gold Wednesday 3x (council/fills.mjs nights)
export function rollovers(t, c, sym) {
  if (sym === 'xau') return nights(t, c);
  let n = 0;
  for (let d = Math.floor(t / DAY) * DAY + 22 * 3600; d < c; d += DAY) {
    if (d <= t) continue;
    const w = new Date(d * 1000).getUTCDay();
    if (w >= 1 && w <= 5) n += w === 5 ? 3 : 1;
  }
  return n;
}
// one trade: buy at the entry close, stop K x ATR under it, out at the exit close or at the stop (a gap at the open)
export function trade(b, days, T, sym) {
  const { tE, tX } = timesOf(T), iE = lastEnding(b, tE), iX = lastEnding(b, tX);
  if (iE < 0 || iX < 0 || iX <= iE) return { skip: iE < 0 ? 'no entry candle' : iX < 0 ? 'no exit candle' : 'no candle between' };
  const entryT = b.t[iE] + M5, A = atrAt(days, entryT);
  if (!(A > 0)) return { skip: 'no ATR' };
  const entry = b.c[iE], stop = entry - P.K * A, risk = entry - stop;
  let exit = b.c[iX], why = 'time', exitT = b.t[iX] + M5;
  for (let i = iE + 1; i <= iX; i++) {
    if (b.o[i] <= stop) { exit = b.o[i]; why = 'gap'; exitT = b.t[i]; break; }
    if (b.l[i] <= stop) { exit = stop; why = 'stop'; exitT = b.t[i] + M5; break; }
  }
  const nN = rollovers(entryT, exitT, sym), fin = nN * P.FIN_YEAR / 365 * entry, cost = P.COST[sym];
  const R = (exit - entry) / risk, costR = (cost + fin) / risk;
  return { T, entryT, exitT, entry, stop, risk, exit, why, R, costR, net: R - costR, nights: nN,
    pct: (exit - entry) / entry * 100, pctHold: (b.c[iX] - entry) / entry * 100 };
}

// ── statistics ──
export function stat(xs) {
  const n = xs.length; if (!n) return { n: 0, mean: null, sd: null, t: null };
  const mean = xs.reduce((a, x) => a + x, 0) / n, sd = n > 1 ? Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1)) : null;
  return { n, mean, sd, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : null };
}
export function quantile(xs, q) {
  const s = xs.filter(Number.isFinite).slice().sort((a, b) => a - b); if (!s.length) return null;
  const x = (s.length - 1) * q, lo = Math.floor(x), hi = Math.ceil(x);
  return s[lo] + (s[hi] - s[lo]) * (x - lo);
}
export function rng(seed) {   // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const dnum = (s) => Date.parse(s + 'T00:00:00Z') / (DAY * 1000);
const dstr = (n) => new Date(n * DAY * 1000).toISOString().slice(0, 10);
// stand-in dates of one event: same weekday, within HALF days, inside the window, not within EXCL_DAYS of any announcement
export function standIns(ev, win, banned = ALL_ANNOUNCE()) {
  const d0 = dnum(ev.date), w = new Date(d0 * DAY * 1000).getUTCDay(), ban = banned.map(dnum), out = [];
  for (let d = d0 - P.HALF; d <= d0 + P.HALF; d++) {
    if (new Date(d * DAY * 1000).getUTCDay() !== w) continue;
    if (ban.some((x) => Math.abs(x - d) <= P.EXCL_DAYS)) continue;
    const T = zonedToUtc(dstr(d), ev.at, US);
    if (T < win[0] || T >= win[1]) continue;
    out.push({ date: dstr(d), at: ev.at, T });
  }
  return out;
}
export function placeboMeans(b, days, evs, win, sym, seeds = P.SEEDS) {
  const pools = evs.map((e) => standIns(e, win)), means = [], cache = new Map();
  const tr = (c) => { if (!cache.has(c.T)) cache.set(c.T, trade(b, days, c.T, sym)); return cache.get(c.T); };
  for (let s = 1; s <= seeds; s++) {
    const r = rng(s), xs = [];
    for (const pool of pools) {
      for (let k = 0; k < P.TRIES && pool.length; k++) { const x = tr(pool[Math.floor(r() * pool.length)]); if (!x.skip) { xs.push(x.net); break; } }
    }
    means.push(stat(xs).mean);
  }
  return means;
}
// release-minute check: range of the M5 candle starting at T against the median of that candle on weekdays within ±25 days
export function spike(b, ev) {
  const at = (T) => { const i = lastEnding(b, T + M5, 0); return i >= 0 && b.t[i] === T ? b.h[i] - b.l[i] : null; };
  const r0 = at(ev.T); if (r0 == null) return null;
  const xs = [];
  for (let d = dnum(ev.date) - 25; d <= dnum(ev.date) + 25; d++) {
    const w = new Date(d * DAY * 1000).getUTCDay(); if (w === 0 || w === 6 || d === dnum(ev.date)) continue;
    const r = at(zonedToUtc(dstr(d), ev.at, US)); if (r != null) xs.push(r);
  }
  const med = quantile(xs, 0.5);
  return med > 0 ? r0 / med : null;
}

export function judge(s, p95) {
  const checks = { positive: s.mean > 0, t2: s.t != null && s.t >= 2, beatsPlacebo: p95 != null && s.mean > p95 };
  return { ...checks, pass: checks.positive && checks.t2 && checks.beatsPlacebo };
}
export function verdictOf(spxB, nasB) {
  const pass = spxB.pass;
  return { pass, word: pass ? 'PASS' : 'FAIL', nas: nasB.pass ? 'confirms' : 'does not confirm' };
}

const r2 = (x, d = 3) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d);
function summarize(trs) {
  const net = stat(trs.map((x) => x.net)), gross = stat(trs.map((x) => x.R)), pct = stat(trs.map((x) => x.pctHold));
  const byYear = {};
  for (const x of trs) { const y = nyDate(x.T).slice(0, 4); (byYear[y] ||= []).push(x.net); }
  return { n: net.n, netR: r2(net.mean), t: r2(net.t, 2), sd: r2(net.sd), grossR: r2(gross.mean), grossT: r2(gross.t, 2),
    win: r2(trs.filter((x) => x.net > 0).length / (trs.length || 1), 3), stops: trs.filter((x) => x.why !== 'time').length,
    costR: r2(stat(trs.map((x) => x.costR)).mean), pctNoStop: r2(pct.mean, 4), pctNoStopT: r2(pct.t, 2),
    byYear: Object.fromEntries(Object.entries(byYear).map(([y, xs]) => [y, { n: xs.length, netR: r2(stat(xs).mean) }])) };
}

export function run(dir) {
  const evs = fomcEvents();
  const out = { study: 'pre-fomc-drift', built: '2026-11-13', preregistration: 'research/edge/pre-fomc-drift/PREREGISTRATION.md', source: SOURCE,
    unscheduledExcluded: UNSCHEDULED, rule: 'buy at the close of the M5 candle ending 24 h before the scheduled FOMC statement, exit at the close of the one ending 5 min before it; stop entry - 1.5 x ATR(14) of New York days; long only',
    costs: { points: P.COST, financingYear: P.FIN_YEAR }, events: evs.length, markets: {} };
  for (const sym of MARKETS) {
    const b = toBars(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${sym}-5m.json.gz`))))), days = nyDays(b);
    const m = { candles: b.n, from: new Date(b.t[0] * 1000).toISOString().slice(0, 10), to: new Date(b.t[b.n - 1] * 1000).toISOString().slice(0, 10), windows: {} };
    if (sym === 'spx500') {
      const sp = evs.map((e) => ({ date: e.date, ratio: r2(spike(b, e), 2) }));
      out.spikeCheck = { median: r2(quantile(sp.map((x) => x.ratio).filter((x) => x != null), 0.5), 2), noSpike: sp.filter((x) => x.ratio != null && x.ratio < 1).map((x) => x.date), noCandle: sp.filter((x) => x.ratio == null).map((x) => x.date) };
    }
    for (const [w, win] of Object.entries(P.WIN)) {
      const we = evs.filter((e) => e.T >= win[0] && e.T < win[1]), trs = [], skipped = [];
      for (const e of we) { const x = trade(b, days, e.T, sym); if (x.skip) skipped.push({ date: e.date, why: x.skip }); else trs.push({ ...x, date: e.date }); }
      const s = summarize(trs), pm = placeboMeans(b, days, we, win, sym);
      const p95 = quantile(pm, P.Q);
      m.windows[w] = { events: we.length, skipped, ...s, placebo: { seeds: pm.length, mean: r2(stat(pm).mean), p95: r2(p95), max: r2(Math.max(...pm)), beaten: pm.filter((x) => s.netR > x).length },
        judged: sym !== 'xau', ...judge({ mean: stat(trs.map((x) => x.net)).mean, t: stat(trs.map((x) => x.net)).t }, p95),
        trades: trs.map((x) => ({ date: x.date, entry: r2(x.entry, 2), stop: r2(x.stop, 2), exit: r2(x.exit, 2), why: x.why, R: r2(x.R), net: r2(x.net) })) };
    }
    out.markets[sym] = m;
  }
  const v = verdictOf(out.markets.spx500.windows.B, out.markets.nas100.windows.B);
  out.verdict = v.word; out.nas100 = v.nas;
  return out;
}

const f = (x, d = 3) => (x == null ? 'n/a' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d));
const NAME = { spx500: 'SPX500', nas100: 'NAS100', xau: 'XAU/USD (descriptive)' };
export function report(r) {
  const S = r.markets.spx500.windows.B, N = r.markets.nas100.windows.B;
  const L = [];
  L.push('# The pre-FOMC announcement drift, out of sample: result', '');
  L.push(`**Verdict: ${r.verdict}.** SPX500, 2016 → now (the window that decides): n ${S.n}, ${f(S.netR)}R a trade net of costs, t ${f(S.t, 2)}; ` +
    `the 40-seed placebo's 95th percentile is ${f(S.placebo.p95)}R (the FOMC windows beat ${S.placebo.beaten} of 40 seeds). ` +
    `NAS100 ${r.nas100} it: n ${N.n}, ${f(N.netR)}R, t ${f(N.t, 2)}, placebo 95th percentile ${f(N.placebo.p95)}R.`, '');
  L.push(`Pre-registered in \`PREREGISTRATION.md\` (committed before any candle was fetched). Events: ${r.events} scheduled FOMC statements, 2008 to October 2026 (${r.source}); unscheduled ${r.unscheduledExcluded.join(', ')} excluded. Rule: ${r.rule}. Costs: round trip SPX500 1.0 point, NAS100 2.0 points, XAU/USD $0.50, plus 6 % a year financing per rollover. Data: OANDA mid M5 candles through the candle proxy.`, '');
  L.push('## Per market and window', '', '| market | window | n | net R a trade | t | gross R | win | stops | placebo 95th pct | beats seeds | pass |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const sym of MARKETS) for (const w of ['A', 'B']) {
    const x = r.markets[sym].windows[w];
    L.push(`| ${NAME[sym]} | ${w === 'A' ? '2008-2015' : '2016 → now'} | ${x.n} | ${f(x.netR)} | ${f(x.t, 2)} | ${f(x.grossR)} | ${(x.win * 100).toFixed(0)} % | ${x.stops} | ${f(x.placebo.p95)} | ${x.placebo.beaten} / 40 | ${sym === 'xau' || w === 'A' ? 'not judged' : x.pass ? 'yes' : 'no'} |`);
  }
  L.push('', 'Window A (2008-2015) and gold are descriptive, as pre-registered. "pass" = mean net R > 0, t ≥ 2 and above the placebo 95th percentile.', '');
  L.push('## The paper\'s own measure (descriptive)', '', 'Mean % change from the entry to the exit close, no stop, no costs:', '');
  for (const sym of MARKETS) L.push(`- ${NAME[sym]}: 2008-2015 ${f(r.markets[sym].windows.A.pctNoStop, 4)} % (t ${f(r.markets[sym].windows.A.pctNoStopT, 2)}); 2016 → now ${f(r.markets[sym].windows.B.pctNoStop, 4)} % (t ${f(r.markets[sym].windows.B.pctNoStopT, 2)}).`);
  L.push('', '## By year, SPX500 (net R a trade, n)', '');
  const yrs = { ...r.markets.spx500.windows.A.byYear, ...r.markets.spx500.windows.B.byYear };
  L.push(Object.entries(yrs).map(([y, x]) => `${y} ${f(x.netR, 2)} (${x.n})`).join(' · '), '');
  L.push('## Event list check', '', `Release-minute range of SPX500 against the same minute on nearby weekdays: median ${r.spikeCheck.median}x. Below 1x (listed, not dropped): ${r.spikeCheck.noSpike.join(', ') || 'none'}. No candle at the release minute: ${r.spikeCheck.noCandle.join(', ') || 'none'}.`, '');
  L.push('## What this means', '');
  if (r.verdict === 'PASS') L.push('The drift is present after costs in the deciding window. This is a hypothesis for a forward paper shadow only; see `research/proposals/2026-11-13-pre-fomc.md`. Nothing live changed.');
  else {
    L.push('The pre-registered bar is not met on SPX500 in 2016 → now, so this is not an edge on the council\'s feeds after costs. No proposal is written and nothing live changed. The figures above are the record; any other version of the rule (another hold, another market, a filter) would need its own pre-registration on data not used here.', '');
    L.push(`What the placebo shows: random 24-hour long windows on the same weekdays, away from FOMC days, made ${f(S.placebo.mean)}R a trade on SPX500 and ${f(N.placebo.mean)}R on NAS100 on average across the 40 seeds in 2016 → now (an index long over any 24 hours earns the index's own drift). The FOMC windows sit at ${S.placebo.beaten} and ${N.placebo.beaten} of 40 seeds: whatever the paper's measure (above) shows before costs, after costs the pre-FOMC hours do not clear the placebo\'s 95th percentile on either index (the index drift, not an FOMC effect, is most of what the rule earns).`);
  }
  L.push('', 'To repeat: `node --use-env-proxy research/edge/pre-fomc-drift/fetch.mjs <dir>`, then `node research/edge/pre-fomc-drift/run.mjs <dir>`. Tests: `tests/pre-fomc-drift.test.mjs`.', '');
  return L.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candle dir>');
  const r = run(dir);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(r, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(r));
  for (const sym of MARKETS) for (const w of ['A', 'B']) { const x = r.markets[sym].windows[w]; console.log(sym, w, x.n, x.netR, x.t, 'p95', x.placebo.p95, x.pass); }
  console.log('verdict', r.verdict, 'nas', r.nas100);
}
