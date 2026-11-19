// Shanghai Gold Exchange closures for the Lunar New Year (Spring Festival) and Golden Week (National Day), 2008-2026
// (research/edge/gold-china-holidays, PREREGISTRATION.md). Beijing dates. first = the first WEEKDAY the SGE day session is shut,
// reopen = the first weekday it trades again. The SGE follows the State Council General Office's official holiday schedule of
// each year (published by the SGE each December as its holiday closure notice); make-up weekend working days never trade.
// src: 'notice' = the official schedule of that year as recalled from public knowledge; 'checked' = also checked on 14 Nov 2026
// against press reports of the SGE's own notice (see note). No year was dropped: none was uncertain. Pure data, no imports.
export const LNY = [
  { year: 2008, first: '2008-02-06', reopen: '2008-02-13', src: 'notice', note: 'holiday 6-12 Feb' },
  { year: 2009, first: '2009-01-26', reopen: '2009-02-02', src: 'notice', note: 'holiday 25-31 Jan (25 Jan a Sunday)' },
  { year: 2010, first: '2010-02-15', reopen: '2010-02-22', src: 'notice', note: 'holiday 13-19 Feb (Sat-Fri)' },
  { year: 2011, first: '2011-02-02', reopen: '2011-02-09', src: 'notice', note: 'holiday 2-8 Feb' },
  { year: 2012, first: '2012-01-23', reopen: '2012-01-30', src: 'notice', note: 'holiday 22-28 Jan (Sun-Sat)' },
  { year: 2013, first: '2013-02-11', reopen: '2013-02-18', src: 'notice', note: 'holiday 9-15 Feb (Sat-Fri)' },
  { year: 2014, first: '2014-01-31', reopen: '2014-02-07', src: 'notice', note: 'holiday 31 Jan-6 Feb; the eve, 30 Jan, was a working day' },
  { year: 2015, first: '2015-02-18', reopen: '2015-02-25', src: 'notice', note: 'holiday 18-24 Feb' },
  { year: 2016, first: '2016-02-08', reopen: '2016-02-15', src: 'notice', note: 'holiday 7-13 Feb (Sun-Sat)' },
  { year: 2017, first: '2017-01-27', reopen: '2017-02-03', src: 'notice', note: 'holiday 27 Jan-2 Feb' },
  { year: 2018, first: '2018-02-15', reopen: '2018-02-22', src: 'notice', note: 'holiday 15-21 Feb' },
  { year: 2019, first: '2019-02-04', reopen: '2019-02-11', src: 'notice', note: 'holiday 4-10 Feb' },
  { year: 2020, first: '2020-01-24', reopen: '2020-02-03', src: 'checked', note: 'holiday 24-30 Jan, extended to 2 Feb (virus); the central bank reopened the interbank gold market with the others on 3 Feb' },
  { year: 2021, first: '2021-02-11', reopen: '2021-02-18', src: 'notice', note: 'holiday 11-17 Feb' },
  { year: 2022, first: '2022-01-31', reopen: '2022-02-07', src: 'notice', note: 'holiday 31 Jan-6 Feb' },
  { year: 2023, first: '2023-01-23', reopen: '2023-01-30', src: 'notice', note: 'holiday 21-27 Jan (Sat-Fri)' },
  { year: 2024, first: '2024-02-12', reopen: '2024-02-19', src: 'checked', note: 'SGE shut 10-17 Feb; it traded on the eve, Fri 9 Feb (no night session), unlike the stock exchanges' },
  { year: 2025, first: '2025-01-28', reopen: '2025-02-05', src: 'notice', note: 'holiday 28 Jan-4 Feb (the eve official from 2025)' },
  { year: 2026, first: '2026-02-16', reopen: '2026-02-24', src: 'checked', note: 'SGE shut 15-23 Feb (Sun-Mon), no night session on Fri 13 Feb, open 24 Feb' },
];
export const GOLDEN = [
  { year: 2008, first: '2008-09-29', reopen: '2008-10-06', src: 'notice', note: 'holiday 29 Sep-5 Oct' },
  { year: 2009, first: '2009-10-01', reopen: '2009-10-09', src: 'notice', note: 'holiday 1-8 Oct with Mid-Autumn' },
  { year: 2010, first: '2010-10-01', reopen: '2010-10-08', src: 'notice', note: 'holiday 1-7 Oct' },
  { year: 2011, first: '2011-10-03', reopen: '2011-10-10', src: 'notice', note: 'holiday 1-7 Oct (Sat-Fri)' },
  { year: 2012, first: '2012-10-01', reopen: '2012-10-08', src: 'notice', note: 'holiday 30 Sep-7 Oct with Mid-Autumn' },
  { year: 2013, first: '2013-10-01', reopen: '2013-10-08', src: 'notice', note: 'holiday 1-7 Oct' },
  { year: 2014, first: '2014-10-01', reopen: '2014-10-08', src: 'notice', note: 'holiday 1-7 Oct' },
  { year: 2015, first: '2015-10-01', reopen: '2015-10-08', src: 'notice', note: 'holiday 1-7 Oct' },
  { year: 2016, first: '2016-10-03', reopen: '2016-10-10', src: 'notice', note: 'holiday 1-7 Oct (Sat-Fri)' },
  { year: 2017, first: '2017-10-02', reopen: '2017-10-09', src: 'notice', note: 'holiday 1-8 Oct with Mid-Autumn (Sun-Sun)' },
  { year: 2018, first: '2018-10-01', reopen: '2018-10-08', src: 'notice', note: 'holiday 1-7 Oct' },
  { year: 2019, first: '2019-10-01', reopen: '2019-10-08', src: 'notice', note: 'holiday 1-7 Oct' },
  { year: 2020, first: '2020-10-01', reopen: '2020-10-09', src: 'notice', note: 'holiday 1-8 Oct with Mid-Autumn' },
  { year: 2021, first: '2021-10-01', reopen: '2021-10-08', src: 'notice', note: 'holiday 1-7 Oct' },
  { year: 2022, first: '2022-10-03', reopen: '2022-10-10', src: 'notice', note: 'holiday 1-7 Oct (Sat-Fri)' },
  { year: 2023, first: '2023-09-29', reopen: '2023-10-09', src: 'notice', note: 'holiday 29 Sep-6 Oct with Mid-Autumn' },
  { year: 2024, first: '2024-10-01', reopen: '2024-10-08', src: 'notice', note: 'holiday 1-7 Oct' },
  { year: 2025, first: '2025-10-01', reopen: '2025-10-09', src: 'notice', note: 'holiday 1-8 Oct with Mid-Autumn' },
  { year: 2026, first: '2026-10-01', reopen: '2026-10-08', src: 'notice', note: 'holiday 1-7 Oct' },
];
export const DROPPED = []; // years left out for uncertain dates: none
