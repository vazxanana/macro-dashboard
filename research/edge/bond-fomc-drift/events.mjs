// Edge research · bond-fomc-drift: scheduled FOMC decision days, 2008 to 2026, with their New York statement time.
// A COPY (14 Nov 2026), never imported from another study or branch:
//   2008-2021 from research/edge/pre-fomc-drift/events.mjs (branch pre-fomc-drift), written there from the Federal Reserve's
//   FOMC meeting calendars (federalreserve.gov/monetarypolicy/fomccalendars.htm and the historical materials by year) without
//   reaching that site: dates from memory, to be checked against it; the release-minute check in run.mjs lists any without a
//   visible reaction (never used to drop one).
//   2022-2026 from council/events.mjs (HISTORY + RAW.FOMC), copied as fixed dates (tests/bond-fomc-drift.test.mjs compares).
// Statement time: 14:15 New York 2008-2012, 12:30 on the 2011-2012 press-conference meetings, 14:00 from January 2013.

export const SOURCE = 'Federal Reserve FOMC meeting calendars (federalreserve.gov), scheduled meetings only: 2008-2021 copied from the pre-fomc-drift study (from memory, to be checked there), 2022 on copied from council/events.mjs';

export const DATES = {
  2008: ['01-30', '03-18', '04-30', '06-25', '08-05', '09-16', '10-29', '12-16'],
  2009: ['01-28', '03-18', '04-29', '06-24', '08-12', '09-23', '11-04', '12-16'],
  2010: ['01-27', '03-16', '04-28', '06-23', '08-10', '09-21', '11-03', '12-14'],
  2011: ['01-26', '03-15', '04-27', '06-22', '08-09', '09-21', '11-02', '12-13'],
  2012: ['01-25', '03-13', '04-25', '06-20', '08-01', '09-13', '10-24', '12-12'],
  2013: ['01-30', '03-20', '05-01', '06-19', '07-31', '09-18', '10-30', '12-18'],
  2014: ['01-29', '03-19', '04-30', '06-18', '07-30', '09-17', '10-29', '12-17'],
  2015: ['01-28', '03-18', '04-29', '06-17', '07-29', '09-17', '10-28', '12-16'],
  2016: ['01-27', '03-16', '04-27', '06-15', '07-27', '09-21', '11-02', '12-14'],
  2017: ['02-01', '03-15', '05-03', '06-14', '07-26', '09-20', '11-01', '12-13'],
  2018: ['01-31', '03-21', '05-02', '06-13', '08-01', '09-26', '11-08', '12-19'],
  2019: ['01-30', '03-20', '05-01', '06-19', '07-31', '09-18', '10-30', '12-11'],
  2020: ['01-29', '04-29', '06-10', '07-29', '09-16', '11-05', '12-16'],   // the scheduled 17-18 Mar meeting was replaced by 15 Mar
  2021: ['01-27', '03-17', '04-28', '06-16', '07-28', '09-22', '11-03', '12-15'],
  2022: ['01-26', '03-16', '05-04', '06-15', '07-27', '09-21', '11-02', '12-14'],
  2023: ['02-01', '03-22', '05-03', '06-14', '07-26', '09-20', '11-01', '12-13'],
  2024: ['01-31', '03-20', '05-01', '06-12', '07-31', '09-18', '11-07', '12-18'],
  2025: ['01-29', '03-19', '05-07', '06-18', '07-30', '09-17', '10-29', '12-10'],
  2026: ['01-28', '03-18', '04-29', '06-17', '07-29', '09-16', '10-28', '12-09'],
};
// 2011-2012 meetings with a press conference: statement at 12:30 New York
export const PRESS_1230 = new Set(['2011-04-27', '2011-06-22', '2011-11-02', '2012-01-25', '2012-04-25', '2012-06-20', '2012-09-13', '2012-12-12']);
// unscheduled announcements: never events; no placebo day on them or within 5 calendar days after them
export const UNSCHEDULED = ['2008-01-22', '2008-10-08', '2010-05-09', '2020-03-03', '2020-03-15'];

export function clockOf(date) {
  if (date < '2013-01-01') return PRESS_1230.has(date) ? '12:30' : '14:15';
  return '14:00';
}
export function fomcDates() {
  const ds = [];
  for (const [y, list] of Object.entries(DATES)) for (const md of list) ds.push(`${y}-${md}`);
  return ds.sort();
}
