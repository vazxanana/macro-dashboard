// US CPI release dates for the cpi-follow study (08:30 New York). Three sources, kept apart so the report can say which is which.
//
// MEMORY: 2012-2017, written from memory of the BLS CPI release schedule (bls.gov/schedule/news_release/cpi.htm archives were
// not reachable from the build sandbox). NOT verified against bls.gov: each date is used only if it passes the spike check in
// run.mjs (PREREGISTRATION.md, "Events"), and the list still needs a spot-check by hand. A failed date is dropped, never moved.
// SCHEDULE_2018_21: copied from research/edge/event-reaction/build.mjs `CPI_EARLY` (BLS archives; that file is a script, not a
// module, so the list is copied, not imported). 2022 on: council/events.mjs HISTORY + EVENTS (type CPI), read by run.mjs.
import { HISTORY, EVENTS } from '../../../council/events.mjs';

const y = (yr, md) => md.map((d) => `${yr}-${d}`);
export const MEMORY = [
  ...y(2012, ['01-19', '02-17', '03-16', '04-13', '05-15', '06-14', '07-17', '08-15', '09-14', '10-16', '11-15', '12-14']),
  ...y(2013, ['01-16', '02-21', '03-15', '04-16', '05-16', '06-18', '07-16', '08-15', '09-17', '10-30', '11-20', '12-17']),
  ...y(2014, ['01-16', '02-20', '03-18', '04-15', '05-15', '06-17', '07-22', '08-19', '09-17', '10-22', '11-20', '12-17']),
  ...y(2015, ['01-16', '02-26', '03-24', '04-17', '05-22', '06-18', '07-17', '08-19', '09-16', '10-15', '11-17', '12-15']),
  ...y(2016, ['01-20', '02-19', '03-16', '04-14', '05-17', '06-16', '07-15', '08-16', '09-16', '10-18', '11-17', '12-15']),
  ...y(2017, ['01-18', '02-15', '03-15', '04-14', '05-12', '06-14', '07-14', '08-11', '09-14', '10-13', '11-15', '12-13']),
];
export const SCHEDULE_2018_21 = ['2018-01-12', '2018-02-14', '2018-03-13', '2018-04-11', '2018-05-10', '2018-06-12', '2018-07-12', '2018-08-10', '2018-09-13', '2018-10-11', '2018-11-14', '2018-12-12',
  '2019-01-11', '2019-02-13', '2019-03-12', '2019-04-10', '2019-05-10', '2019-06-12', '2019-07-11', '2019-08-13', '2019-09-12', '2019-10-10', '2019-11-13', '2019-12-11',
  '2020-01-14', '2020-02-13', '2020-03-11', '2020-04-10', '2020-05-12', '2020-06-10', '2020-07-14', '2020-08-12', '2020-09-11', '2020-10-13', '2020-11-12', '2020-12-10',
  '2021-01-13', '2021-02-10', '2021-03-10', '2021-04-13', '2021-05-12', '2021-06-10', '2021-07-13', '2021-08-11', '2021-09-14', '2021-10-13', '2021-11-10', '2021-12-10'];

// 2022 on, from council/events.mjs; the release must have happened before `nowSec` (scheduled dates after it are skipped)
export function councilCpi(nowSec) {
  return [...HISTORY, ...EVENTS].filter((e) => e.type === 'CPI' && e.t + 8 * 3600 < nowSec).map((e) => e.local.slice(0, 10)).sort();
}

// every CPI date with its source: [{ d, src }]
export function cpiDates(nowSec) {
  const out = [...MEMORY.map((d) => ({ d, src: 'memory' })), ...SCHEDULE_2018_21.map((d) => ({ d, src: 'schedule' })),
    ...councilCpi(nowSec).map((d) => ({ d, src: 'council/events.mjs' }))];
  const seen = new Set(); return out.filter((x) => (seen.has(x.d) ? false : (seen.add(x.d), true))).sort((a, b) => a.d.localeCompare(b.d));
}
