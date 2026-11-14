// Edge research · turnaround-early-years: the frozen Turnaround Tuesday rule on the years before both studies' windows
// (PREREGISTRATION.md). The candle proxy serves no index candle before March 2003, so the years never used are about 4.7 and
// the pre-registered 5-year floor stops the study as NOT MEASURABLE. This file only (a) runs the gate (#862's study and #857's
// NAS100 R2 cell through the frozen code on candles cut to #862's start) and (b) counts, per market and year 2003-2007, the
// local trading days, the days with a close candle and the first possible entry. No price or return of 2003-2007 is used.
//   node research/edge/turnaround-early-years/run.mjs <candleDir>   (the files fetch.mjs wrote; writes result.json beside this file)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import * as F from './frozen.mjs';
import * as P from './replicate.mjs';

export const FROZEN_SHA256 = '74527d362f9d65c996cdd4df25abadbbc6b723b9aa49141d6a29c88b19693871';
export const REPLICATE_SHA256 = '61cb6424546a299e3fd8f626c72a1f2cc0ec1f57a422bc438e2a9d4c263d4b18';
export const FLOOR_YEARS = 5, END_EARLY = '2007-12-31', GATE_FROM = Date.parse('2007-10-01T00:00:00Z') / 1000;
// #862's published decisive figures (its RESULT.md / result.json) and #857's NAS100 R2 cell
export const GATE_862 = { pool: { n: 411, R: 0.052, t: 2.63, monthT: 1.69, months: 131 },
  markets: { us30: [55, 0.018], us2000: [93, 0.061], de40: [64, 0.054], eu50: [74, 0.024], uk100: [50, 0.036], jp225: [75, 0.103] } };
export const GATE_857 = { n: 81, R: 0.098, t: 2.33 };
export const ALL = ['spx500', 'nas100', 'us30', 'us2000', 'de40', 'eu50', 'uk100', 'jp225'];
const CAL = { spx500: { cal: 'nyse' }, nas100: { cal: 'nyse' } };
const ymdOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const r2 = (x) => +x.toFixed(2);

export function gate(bars, dgs2) {
  const cut = (b) => b.filter((x) => x[0] >= GATE_FROM);
  const six = Object.fromEntries(Object.keys(P.MARKETS).map((k) => [k, cut(bars[k])]));
  const S = P.study(six, dgs2), o = S.pool.oos;
  const mk = Object.fromEntries(Object.entries(S.markets).map(([k, m]) => [k, [m.oos.n, m.oos.R]]));
  const ok862 = o.n === GATE_862.pool.n && o.R === GATE_862.pool.R && o.t === GATE_862.pool.t && o.month.t === GATE_862.pool.monthT && o.month.months === GATE_862.pool.months
    && Object.entries(GATE_862.markets).every(([k, [n, R]]) => mk[k][0] === n && mk[k][1] === R);
  const T = F.study({ spx500: cut(bars.spx500), nas100: cut(bars.nas100) }, dgs2), c = T.cells['nas100-r2'].oos;
  const ok857 = c.n === GATE_857.n && c.R === GATE_857.R && c.t === GATE_857.t;
  return { ok: ok862 && ok857, ok862, ok857, got862: { pool: { n: o.n, R: o.R, t: o.t, monthT: o.month.t, months: o.month.months }, markets: mk }, got857: { n: c.n, R: c.R, t: c.t } };
}

// close of a local day (unix s of its close candle) for any of the eight markets
const closeOf = (k) => (CAL[k] || P.MARKETS[k]).cal === 'nyse' ? F.closeCandle : P.closeOfMarket(k);
const calOf = (k) => (CAL[k] || P.MARKETS[k]).cal;

// availability only: counts of days and close candles; the first possible entry = the first local trading day with 20
// completed days with closes before it (frozen atrAt needs D[k-20..k-1] and D[k-21]) and a close of its own
export function availability(k, bars) {
  const have = new Set(bars.map((b) => b[0]));
  const from = ymdOf(bars[0][0]);
  const days = P.localTradingDays(calOf(k), from, END_EARLY), co = closeOf(k);
  const hasClose = days.map((d) => have.has(co(d)));
  const byYear = {};
  days.forEach((d, i) => { const y = d.slice(0, 4); (byYear[y] ||= { days: 0, closes: 0 }).days++; if (hasClose[i]) byYear[y].closes++; });
  let first = null;
  for (let i = 21; i < days.length && !first; i++) { let ok = hasClose[i]; for (let j = i - 21; j < i && ok; j++) ok = hasClose[j]; if (ok) first = days[i]; }
  const years = first ? r2((Date.parse(END_EARLY + 'T12:00:00Z') - Date.parse(first + 'T12:00:00Z')) / 86400e3 / 365.25) : 0;
  const closes = hasClose.filter(Boolean).length;
  return { firstCandle: from, firstEntry: first, years, days: days.length, closes, byYear };
}

export function verdictOf(av, g) {
  if (!g.ok) return { verdict: 'NOT MEASURABLE', why: 'gate: #862 / #857 not reproduced', span: null };
  const span = Math.max(...Object.values(av).map((a) => a.years));
  if (span < FLOOR_YEARS) return { verdict: 'NOT MEASURABLE', why: `inconclusive: about ${span.toFixed(1)} years of candles before 2008, under the ${FLOOR_YEARS}-year floor`, span };
  return { verdict: 'RUN', why: 'span at or over the floor (not expected)', span };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candleDir>');
  const here = path.dirname(new URL(import.meta.url).pathname);
  const rates = JSON.parse(fs.readFileSync(path.join(here, 'rates.json'), 'utf8'));
  const bars = {};
  for (const k of ALL) bars[k] = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${k}-1h.json.gz`))));
  const g = gate(bars, rates.DGS2);
  const av = Object.fromEntries(ALL.map((k) => [k, availability(k, bars[k])]));
  const v = verdictOf(av, g);
  const out = { built: '2026-11-14', study: 'turnaround-early-years', title: 'Turnaround Tuesday on the years neither study used', verdict: v.verdict, why: v.why,
    span: v.span, floorYears: FLOOR_YEARS, window: { from: 'first possible entry', to: END_EARLY },
    frozen: { file: 'frozen.mjs', sha256: FROZEN_SHA256, replicate: 'replicate.mjs', replicateSha256: REPLICATE_SHA256 },
    gate: g, availability: av,
    fisher: { calendarDisjoint: null, note: 'no p on years the original never used: the hypothesis keeps none (multiple-testing-update reading unchanged)' },
    data: { src: 'OANDA mid H1 via the site candle proxy (fetch.mjs), 2003-01-01 to 2026-11-12; first candles as served; counts only for 2003-2007' } };
  fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(v.verdict, v.why, JSON.stringify(g));
  for (const [k, a] of Object.entries(av)) console.log(k, a.firstCandle, a.firstEntry, a.years, a.days, a.closes, JSON.stringify(a.byYear));
}
