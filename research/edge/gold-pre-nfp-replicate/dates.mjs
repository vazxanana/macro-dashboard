// Edge research · gold-pre-nfp-replicate: US payroll (Employment Situation) release dates 2006-2021, and the other releases
// used only to exclude a window. bls.gov, FRED and the web archive are refused by the build sandbox's proxy (14 Nov 2026), so
// payroll dates are DERIVED by the BLS rule below (PREREGISTRATION.md, "Payroll dates before 2022") and then checked on the
// OANDA M5 release minute in run.mjs. No date here is verified by a BLS page.
import { HISTORY, EVENTS } from '../../../council/events.mjs';

const pad = (n) => String(n).padStart(2, '0');
const DAY = 86400e3;
export const ymd = (ms) => { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };

// observed federal holidays that can fall on a release Friday: New Year's Day, Independence Day, Christmas
export function holidays(y) {
  const obs = (m, d) => { const t = Date.UTC(y, m, d), w = new Date(t).getUTCDay(); return ymd(w === 6 ? t - DAY : w === 0 ? t + DAY : t); };
  return new Set([obs(0, 1), obs(6, 4), obs(11, 25), ymd(Date.UTC(y + 1, 0, 1) - (new Date(Date.UTC(y + 1, 0, 1)).getUTCDay() === 6 ? DAY : 0))]);
}

// Release date of the report for month m (0-11) of year y, by the BLS rule:
// (1) reference week = the Sunday-Saturday week holding the 12th; release = the third Friday after that week ends;
// (2) a Friday on or before 3 January moves one week later; (3) a holiday Friday moves to the Thursday before.
export function derive(y, m) {
  const t12 = Date.UTC(y, m, 12), sat = t12 + (6 - new Date(t12).getUTCDay()) * DAY;
  let fri = sat + 20 * DAY;                                        // first Friday after the Saturday is +6 days, the third +20
  const f = new Date(fri);
  if (f.getUTCMonth() === 0 && f.getUTCDate() <= 3) fri += 7 * DAY;
  const d = ymd(fri);
  return holidays(new Date(fri).getUTCFullYear()).has(d) ? ymd(fri - DAY) : d;
}

// hand-written exceptions (October 2013 shutdown; from memory of the BLS notices, not fetched)
export const EXCEPTIONS = { '2013-09': '2013-10-22', '2013-10': '2013-11-08' };   // key = the report's month (YYYY-MM)

// every report month whose release falls from April 2006 to December 2021: [{ report, derived, d, why }]
export function payrolls(from = '2006-04-01', to = '2021-12-31') {
  const out = [];
  for (let y = 2006; y <= 2022; y++) for (let m = 0; m < 12; m++) {
    const key = `${y}-${pad(m + 1)}`, der = derive(y, m), d = EXCEPTIONS[key] || der;
    if (d >= from && d <= to) out.push({ report: key, derived: der, d, why: EXCEPTIONS[key] ? 'shutdown exception (memory)' : 'rule' });
  }
  return out;
}

// payrolls 2022 on, from the repository
export const councilNfp = () => [...HISTORY, ...EVENTS].filter((e) => e.type === 'NFP').map((e) => e.local.slice(0, 10)).sort();

// FOMC scheduled statement days 2008-2021: copied from research/edge/fomc-even-week/dates.mjs (branch; Federal Reserve calendars)
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
  2020: ['01-29', '04-29', '06-10', '07-29', '09-16', '11-05', '12-16'],
  2021: ['01-27', '03-17', '04-28', '06-16', '07-28', '09-22', '11-03', '12-15'],
  // 2006-2007: from memory of the Federal Reserve calendars, NOT verified
  2006: ['01-31', '03-28', '05-10', '06-29', '08-08', '09-20', '10-25', '12-12'],
  2007: ['01-31', '03-21', '05-09', '06-28', '08-07', '09-18', '10-31', '12-11'],
};
export const FOMC_OLD = Object.entries(OLD).flatMap(([y, l]) => l.map((md) => `${y}-${md}`)).sort();
// unscheduled announcements [date, New York time]; 2007-08-17 from memory, the rest from fomc-even-week's list (times from memory)
export const FOMC_UNSCHEDULED = [['2007-08-17', '08:15'], ['2008-01-22', '08:00'], ['2008-10-08', '07:00'], ['2010-05-09', '21:15'], ['2020-03-03', '10:00'], ['2020-03-15', '17:00']];

// CPI 2012-2017: research/edge/cpi-follow/events.mjs MEMORY (branch; written from memory there, NOT verified)
const y = (yr, md) => md.map((d) => `${yr}-${d}`);
export const CPI_MEMORY = [
  ...y(2012, ['01-19', '02-17', '03-16', '04-13', '05-15', '06-14', '07-17', '08-15', '09-14', '10-16', '11-15', '12-14']),
  ...y(2013, ['01-16', '02-21', '03-15', '04-16', '05-16', '06-18', '07-16', '08-15', '09-17', '10-30', '11-20', '12-17']),
  ...y(2014, ['01-16', '02-20', '03-18', '04-15', '05-15', '06-17', '07-22', '08-19', '09-17', '10-22', '11-20', '12-17']),
  ...y(2015, ['01-16', '02-26', '03-24', '04-17', '05-22', '06-18', '07-17', '08-19', '09-16', '10-15', '11-17', '12-15']),
  ...y(2016, ['01-20', '02-19', '03-16', '04-14', '05-17', '06-16', '07-15', '08-16', '09-16', '10-18', '11-17', '12-15']),
  ...y(2017, ['01-18', '02-15', '03-15', '04-14', '05-12', '06-14', '07-14', '08-11', '09-14', '10-13', '11-15', '12-13']),
];
// CPI 2018-2021: research/edge/event-reaction/build.mjs CPI_EARLY (BLS schedule), as gold-pre-cpi used it
export const CPI_EARLY = ['2018-01-12', '2018-02-14', '2018-03-13', '2018-04-11', '2018-05-10', '2018-06-12', '2018-07-12', '2018-08-10', '2018-09-13', '2018-10-11', '2018-11-14', '2018-12-12',
  '2019-01-11', '2019-02-13', '2019-03-12', '2019-04-10', '2019-05-10', '2019-06-12', '2019-07-11', '2019-08-13', '2019-09-12', '2019-10-10', '2019-11-13', '2019-12-11',
  '2020-01-14', '2020-02-13', '2020-03-11', '2020-04-10', '2020-05-12', '2020-06-10', '2020-07-14', '2020-08-12', '2020-09-11', '2020-10-13', '2020-11-12', '2020-12-10',
  '2021-01-13', '2021-02-10', '2021-03-10', '2021-04-13', '2021-05-12', '2021-06-10', '2021-07-13', '2021-08-11', '2021-09-14', '2021-10-13', '2021-11-10', '2021-12-10'];
