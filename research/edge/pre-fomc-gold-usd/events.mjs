// Edge research · pre-fomc-gold-usd: scheduled FOMC statements, 2008 to now (list and code copied unchanged from the pre-fomc-drift branch; no cross-branch import).
// 2008-2021: the Federal Reserve's FOMC meeting calendars (federalreserve.gov, historical materials by year), last day of each
// SCHEDULED meeting; written here because the build sandbox cannot reach federalreserve.gov (checked by the release-minute
// test in run.mjs, never by price direction). 2022 on: the repository's own calendar, council/events.mjs (HISTORY + EVENTS).
// Statement time: 14:15 New York 2008-2012, 12:30 on the 2011-2012 press-conference meetings, 14:00 from January 2013.
import { HISTORY, EVENTS, zonedToUtc } from '../../../council/events.mjs';

export const SOURCE = 'Federal Reserve FOMC meeting calendars (federalreserve.gov/monetarypolicy/fomccalendars.htm and the historical materials by year), scheduled meetings only; 2022 on from council/events.mjs';

const OLD = {
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
// 2011-2012 meetings with a press conference: statement at 12:30 New York
export const PRESS_1230 = new Set(['2011-04-27', '2011-06-22', '2011-11-02', '2012-01-25', '2012-04-25', '2012-06-20', '2012-09-13', '2012-12-12']);
// unscheduled announcements: never events; no placebo date within 3 days of them either
export const UNSCHEDULED = ['2008-01-22', '2008-10-08', '2010-05-09', '2020-03-03', '2020-03-15'];

export function clockOf(date) {
  if (date < '2013-01-01') return PRESS_1230.has(date) ? '12:30' : '14:15';
  return '14:00';
}
const US = 'America/New_York';
export function fomcEvents(until = Date.UTC(2026, 10, 13) / 1000) {
  const ds = [];
  for (const [y, list] of Object.entries(OLD)) for (const md of list) ds.push(`${y}-${md}`);
  for (const e of [...HISTORY, ...EVENTS]) if (e.type === 'FOMC') ds.push(e.local ? e.local.slice(0, 10) : new Intl.DateTimeFormat('en-CA', { timeZone: US }).format(new Date(e.t * 1000)));
  const uniq = [...new Set(ds)].sort();
  return uniq.map((date) => { const at = clockOf(date); return { date, at, T: zonedToUtc(date, at, US) }; }).filter((e) => e.T < until);
}
export const ALL_ANNOUNCE = () => [...fomcEvents(Infinity).map((e) => e.date), ...UNSCHEDULED].sort();
