// HistData.com M1 clock → UTC (9 Nov 2026 data fix). The one conversion every loader of the council-data HistData files
// (research/candles/*histdata*, research/candles/<PAIR>/) uses; pure, no I/O.
//
// The files say "EST without daylight saving" (UTC−5 all year). The release spikes and the weekly opens say otherwise
// (research/edge/event-reaction preregistration Amendment 1; the 9 Nov clock audit over all 11 files, 2018-26):
//   * 2019 onward: UTC−5, and UTC−4 while Europe is on summer time (last Sunday of March → last Sunday of October, 01:00 UTC).
//     US CPI / NFP / jobless claims at 08:30 New York sit at file 08:30 in July but at file 07:30 in the weeks the US is on
//     daylight time and Europe is not (2nd Sunday of March → last Sunday of March; last Sunday of October → 1st Sunday of
//     November): CPI 2024-03-12, NFP 2024-11-01, FOMC 2022-11-02 / 2023-11-01. The FX Sunday open (17:00 New York) is at file
//     16:00 in those weeks (EURUSD, every year 2019-26).
//   * 2018: New York wall-clock time (EST / EDT): CPI 2018-03-13, NFP 2018-11-02 and the Sunday opens of 11 / 18 Mar and
//     28 Oct 2018 sit at New York time. The two rules agree from November 2018 to March 2019 (both UTC−5), so the switch
//     date does not matter.
// A fixed +5 h (the label) is one hour late every European summer (~7 months a year): session filters, kill zones, release
// windows and day closes all moved. New York local time (the 5 Nov convention) is wrong only in the ~4 mismatch weeks a year.
// All switches happen on a Sunday at 01:00-07:00 UTC, while every one of these markets is shut, so no stamp is ambiguous.

const H = 3600;
const lastSun = (y, m) => { const d = new Date(Date.UTC(y, m + 1, 0, 1)); d.setUTCDate(d.getUTCDate() - d.getUTCDay()); return d.getTime() / 1000; };   // 01:00 UTC
const nthSun = (y, m, n, hUtc) => { const d = new Date(Date.UTC(y, m, 1, hUtc)); d.setUTCDate(1 + ((7 - d.getUTCDay()) % 7) + 7 * (n - 1)); return d.getTime() / 1000; };
// the instant (UTC seconds) in Europe's summer time / New York's daylight time
export const euSummer = (t) => { const y = new Date(t * 1000).getUTCFullYear(); return t >= lastSun(y, 2) && t < lastSun(y, 9); };
export const usDaylight = (t) => { const y = new Date(t * 1000).getUTCFullYear(); return t >= nthSun(y, 2, 2, 7) && t < nthSun(y, 10, 1, 6); };
export const NY_RULE_UNTIL = Date.UTC(2019, 0, 1) / 1000;   // file stamps before this are New York time

// hours to add to a file stamp to get UTC (5 or 4), from the stamp's own fields
export function histOffsetH(y, mo, d, h = 12, mi = 0) {
  const t5 = Date.UTC(y, mo - 1, d, h, mi) / 1000 + 5 * H;   // the instant if the stamp were UTC−5
  return (t5 < NY_RULE_UNTIL ? usDaylight(t5 - H) : euSummer(t5 - H)) ? 4 : 5;
}
// file stamp fields (month 1-12) → UTC seconds
export function histToUtc(y, mo, d, h, mi) { return Date.UTC(y, mo - 1, d, h, mi) / 1000 + histOffsetH(y, mo, d, h, mi) * H; }
// "YYYYMMDD HHMMSS..." (the first field of a HistData csv line, or the whole line) → UTC seconds
export function histStampUtc(s) { return histToUtc(+s.slice(0, 4), +s.slice(4, 6), +s.slice(6, 8), +s.slice(9, 11), +s.slice(11, 13)); }
// the label's reading (fixed EST, +5 h), kept for before/after comparisons only
export function histStampFixedEst(s) { return Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(9, 11), +s.slice(11, 13)) / 1000 + 5 * H; }
