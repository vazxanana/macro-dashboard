// Edge research · fomc-even-week: scheduled FOMC statement days, 2008 to now.
// 2008-2021: copied from research/edge/pre-fomc-drift/events.mjs (branch pre-fomc-drift), written there from the Federal Reserve's
// FOMC meeting calendars (federalreserve.gov/monetarypolicy/fomccalendars.htm and the historical materials by year), last day of each
// SCHEDULED meeting; that study checked them by the release-minute range on SPX500 M5. federalreserve.gov is not reachable from the
// build sandbox. 2022 on: the repository's own calendar, council/events.mjs (HISTORY + EVENTS).
import { HISTORY, EVENTS } from '../../../council/events.mjs';

export const SOURCE = 'Federal Reserve FOMC meeting calendars (scheduled meetings), 2008-2021 as in research/edge/pre-fomc-drift/events.mjs; 2022 on from council/events.mjs';

export const OLD = {
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
};
// unscheduled announcements: never start a cycle; windows touching their days -1..+3 are dropped in the primary test
export const UNSCHEDULED = ['2008-01-22', '2008-10-08', '2010-05-09', '2020-03-03', '2020-03-15'];

const nyDate = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(t * 1000));
export function fromEvents() {
  return [...new Set([...HISTORY, ...EVENTS].filter((e) => e.type === 'FOMC').map((e) => (e.local ? e.local.slice(0, 10) : nyDate(e.t))))].sort();
}
export function scheduled() {
  const ds = [];
  for (const [y, list] of Object.entries(OLD)) for (const md of list) ds.push(`${y}-${md}`);
  return [...new Set([...ds, ...fromEvents()])].sort();
}
