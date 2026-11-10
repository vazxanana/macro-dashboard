// HistData.com M1 time labels -> UTC. The one conversion every loader of the research candle files uses (council-data
// research/candles/*-histdata and research/candles/<PAIR>/). Pure: no I/O, no imports, no state. Nothing that trades reads it.
//
// The rule (certified by the pre-registered audit in research/edge/histdata-clock/, 10 Nov 2026):
//   labels from 2019 on   UTC-5, and UTC-4 while EUROPE is on summer time (last Sunday of March to last Sunday of October)
//   labels in 2018        New York wall-clock time (UTC-5, UTC-4 from the 2nd Sunday of March to the 1st Sunday of November)
// The two halves agree from 4 Nov 2018 to 10 Mar 2019, so no stamp depends on the switch date.
// Evidence: 4,755 of 4,755 decisive weeks against OANDA H1 (327 of 327 in the weeks the US and Europe are on different
// clocks), 2,191 of 2,195 release minutes (CPI, payrolls, FOMC), 11 symbols, 2018 to October 2026. See RESULT.md there for
// what is certified per symbol and year and what is not.
//
// The two readings this replaces, and how they were wrong:
//   "EST without daylight saving" (label + 5 h all year, what HistData documents): one hour LATE all of Europe's summer.
//   New York wall-clock time for every year: one hour EARLY from 2019 in the weeks the US is on daylight time and Europe
//   is not (2nd to last Sunday of March; last Sunday of October to 1st Sunday of November).
// Every change of the label clock falls on a Sunday before these markets reopen, so the label's own date decides the offset
// and no label is ambiguous. (The files repeat one identical hour of rows on the last Sunday of October, 2019 on: an export
// artefact. Loaders drop rows whose converted time repeats.)

const H = 3600;
const sunday = (y, m, n) => { const d = new Date(Date.UTC(y, m, 1)); return Date.UTC(y, m, 1 + ((7 - d.getUTCDay()) % 7) + 7 * (n - 1)) / 1000; };   // n-th Sunday of month m (0-11), 00:00
const lastSunday = (y, m) => { const d = new Date(Date.UTC(y, m + 1, 0)); return Date.UTC(y, m + 1, 0 - d.getUTCDay()) / 1000; };                    // last Sunday of month m, 00:00

export const NY_LABELS_BEFORE = 2019;   // labels of years before this are New York wall-clock time

// hours to add to a label to get UTC (4 or 5), from the label's own fields (month 1-12). Hour and minute do not matter.
export function histOffsetH(y, mo, d) {
  const L = Date.UTC(y, mo - 1, d) / 1000;
  const summer = y < NY_LABELS_BEFORE ? L >= sunday(y, 2, 2) && L < sunday(y, 10, 1) : L >= lastSunday(y, 2) && L < lastSunday(y, 9);
  return summer ? 4 : 5;
}
// label fields (month 1-12) -> UTC seconds
export function histToUtc(y, mo, d, h, mi) { return Date.UTC(y, mo - 1, d, h, mi) / 1000 + histOffsetH(y, mo, d) * H; }
// "YYYYMMDD HHMMSS..." (the first field of a HistData csv line, or the whole line) -> UTC seconds
export function histStampUtc(s) { return histToUtc(+s.slice(0, 4), +s.slice(4, 6), +s.slice(6, 8), +s.slice(9, 11), +s.slice(11, 13)); }

// For code that needs New York or European wall-clock time of a UTC instant (session filters, the 17:00 New York day).
// usDaylight: 2nd Sunday of March 07:00 UTC to 1st Sunday of November 06:00 UTC. euSummer: last Sunday of March 01:00 UTC
// to last Sunday of October 01:00 UTC.
export const usDaylight = (t) => { const y = new Date(t * 1000).getUTCFullYear(); return t >= sunday(y, 2, 2) + 7 * H && t < sunday(y, 10, 1) + 6 * H; };
export const euSummer = (t) => { const y = new Date(t * 1000).getUTCFullYear(); return t >= lastSunday(y, 2) + H && t < lastSunday(y, 9) + H; };
// hours New York is behind UTC at instant t (4 or 5)
export const nyOffsetH = (t) => (usDaylight(t) ? 4 : 5);

// The two older readings, kept ONLY for before / after comparisons and tests. Never use them to load data.
export function histStampFixedEst(s) { return Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(9, 11), +s.slice(11, 13)) / 1000 + 5 * H; }
export function histStampNewYork(s) {
  const y = +s.slice(0, 4), L = Date.UTC(y, +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(9, 11), +s.slice(11, 13)) / 1000;
  return L + (L >= sunday(y, 2, 2) + 2 * H && L < sunday(y, 10, 1) + 2 * H ? 4 : 5) * H;
}
