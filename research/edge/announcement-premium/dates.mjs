// Edge research · announcement-premium: the release dates (CPI, payrolls), the FOMC dates excluded, and the NYSE calendar.
// Every date carries its source. Pure: no network, no file reads; council/events.mjs and ict/calendar.mjs are imported.
// Lists copied from studies that live on branches (not on main) are copied, not imported, with the branch named.
import { HISTORY, EVENTS } from '../../../council/events.mjs';
import { cmeYear } from '../../../ict/calendar.mjs';

const ymdOf = (ms) => new Date(ms).toISOString().slice(0, 10);
const y = (yr, md) => md.map((d) => `${yr}-${d}`);
const councilType = (type) => [...HISTORY, ...EVENTS].filter((e) => e.type === type).map((e) => e.local.slice(0, 10));

// ─── CPI ───
// 2012-2017: branch cpi-follow, research/edge/cpi-follow/events.mjs `MEMORY` (written there from memory of the BLS archives,
// NOT verified against bls.gov). Only the dates that passed that study's pre-registered release-minute spike check (EUR/USD and
// USD/JPY, its RESULT.md line 7) are used: CPI_MEMORY_DROPPED lists the 18 it dropped, dropped here too.
export const CPI_MEMORY = [
  ...y(2012, ['01-19', '02-17', '03-16', '04-13', '05-15', '06-14', '07-17', '08-15', '09-14', '10-16', '11-15', '12-14']),
  ...y(2013, ['01-16', '02-21', '03-15', '04-16', '05-16', '06-18', '07-16', '08-15', '09-17', '10-30', '11-20', '12-17']),
  ...y(2014, ['01-16', '02-20', '03-18', '04-15', '05-15', '06-17', '07-22', '08-19', '09-17', '10-22', '11-20', '12-17']),
  ...y(2015, ['01-16', '02-26', '03-24', '04-17', '05-22', '06-18', '07-17', '08-19', '09-16', '10-15', '11-17', '12-15']),
  ...y(2016, ['01-20', '02-19', '03-16', '04-14', '05-17', '06-16', '07-15', '08-16', '09-16', '10-18', '11-17', '12-15']),
  ...y(2017, ['01-18', '02-15', '03-15', '04-14', '05-12', '06-14', '07-14', '08-11', '09-14', '10-13', '11-15', '12-13']),
];
export const CPI_MEMORY_DROPPED = ['2012-01-19', '2012-04-13', '2012-07-17', '2012-10-16', '2012-11-15', '2013-02-21', '2013-07-16',
  '2013-09-17', '2013-10-30', '2013-12-17', '2014-02-20', '2014-03-18', '2014-11-20', '2015-06-18', '2015-09-16', '2016-06-16',
  '2016-12-15', '2017-03-15'];
// 2018-2021: research/edge/event-reaction/build.mjs `CPI_EARLY` (BLS release schedules; that file is a script, so copied)
export const CPI_SCHEDULE_2018_21 = ['2018-01-12', '2018-02-14', '2018-03-13', '2018-04-11', '2018-05-10', '2018-06-12', '2018-07-12', '2018-08-10', '2018-09-13', '2018-10-11', '2018-11-14', '2018-12-12',
  '2019-01-11', '2019-02-13', '2019-03-12', '2019-04-10', '2019-05-10', '2019-06-12', '2019-07-11', '2019-08-13', '2019-09-12', '2019-10-10', '2019-11-13', '2019-12-11',
  '2020-01-14', '2020-02-13', '2020-03-11', '2020-04-10', '2020-05-12', '2020-06-10', '2020-07-14', '2020-08-12', '2020-09-11', '2020-10-13', '2020-11-12', '2020-12-10',
  '2021-01-13', '2021-02-10', '2021-03-10', '2021-04-13', '2021-05-12', '2021-06-10', '2021-07-13', '2021-08-11', '2021-09-14', '2021-10-13', '2021-11-10', '2021-12-10'];
// 2008-2011: none (cannot be written out reliably here; PREREGISTRATION.md). Those years are payrolls only.
export const CPI_FIRST_YEAR = 2012;

export function cpiDates() {
  const drop = new Set(CPI_MEMORY_DROPPED), out = [];
  for (const d of CPI_MEMORY) if (!drop.has(d)) out.push({ d, src: 'cpi-follow memory list, spike-checked there' });
  for (const d of CPI_SCHEDULE_2018_21) out.push({ d, src: 'BLS schedule (event-reaction CPI_EARLY)' });
  for (const d of councilType('CPI')) out.push({ d, src: 'council/events.mjs' });
  return uniq(out);
}

// ─── Payrolls (Employment Situation) ───
// January 2008 to December 2021: the BLS rule pre-registered by branch nfp-follow (research/edge/nfp-follow/run.mjs
// blsRuleDate / blsDate, copied). The reference week = the Sunday-Saturday week containing the 12th of the reference month; the
// release is the third Friday after that Saturday. nfp-follow used it from 2010; 2008-2009 extend the same rule.
export function blsRuleDate(yr, m) { const d12 = Date.UTC(yr, m - 1, 12), dow = new Date(d12).getUTCDay(), sat = d12 + (6 - dow) * 86400e3; return ymdOf(sat + 20 * 86400e3); }
export const SHUTDOWN = { '2013-10-04': '2013-10-22', '2013-11-01': '2013-11-08' };
export function blsDate(yr, m) {
  const d = blsRuleDate(yr, m); if (SHUTDOWN[d]) return SHUTDOWN[d];
  const [Y, M, D] = d.split('-').map(Number), t = Date.UTC(Y, M - 1, D);
  if (M === 1 && D <= 3) return ymdOf(t + 7 * 86400e3);                                        // January: one week later
  const jul4 = new Date(Date.UTC(Y, 6, 4)).getUTCDay(), hol = jul4 === 6 ? 3 : jul4 === 0 ? 5 : 4;   // observed 4 July
  if (M === 7 && D === hol) return ymdOf(t - 86400e3);                                          // the Thursday before
  return d;
}
// the release dates of the rule: releases in January 2008 (reference month December 2007) to December 2021
export function nfpRuleDates() {
  const out = [];
  for (let yr = 2007; yr <= 2021; yr++) for (let m = 1; m <= 12; m++) { const d = blsDate(yr, m); if (d >= '2008-01-01' && d <= '2021-12-31') out.push(d); }
  return [...new Set(out)].sort();
}
export function nfpDates() {
  const out = nfpRuleDates().map((d) => ({ d, src: d < '2010-01-01' ? 'BLS rule (nfp-follow), extended to 2008-09' : 'BLS rule (nfp-follow)' }));
  for (const d of councilType('NFP')) out.push({ d, src: 'council/events.mjs' });
  return uniq(out);
}

// ─── FOMC (excluded) ───
// 2008-2021: branch pre-fomc-drift, research/edge/pre-fomc-drift/events.mjs `OLD` (Federal Reserve meeting calendars, last day of
// each scheduled meeting, written there from memory and release-minute checked) and its UNSCHEDULED list; 2022 on council/events.mjs.
const FOMC_OLD = {
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
};
export const FOMC_UNSCHEDULED = ['2008-01-22', '2008-10-08', '2010-05-09', '2020-03-03', '2020-03-15'];
export function fomcDates() {
  const ds = [];
  for (const [yr, list] of Object.entries(FOMC_OLD)) for (const md of list) ds.push(`${yr}-${md}`);
  return [...new Set([...ds, ...councilType('FOMC'), ...FOMC_UNSCHEDULED])].sort();
}

// ─── NYSE trading days (the turnaround-tuesday / pre-holiday convention, copied) ───
export const SPECIAL = new Set(['2012-10-29', '2012-10-30', '2018-12-05', '2025-01-09']);
const NYSE_FROM_EARLY = new Set(['Martin Luther King Day', "Presidents' Day", 'Memorial Day', 'Juneteenth', 'Independence Day', 'Labor Day', 'Thanksgiving Day']);
export function dayKind(ymd) {
  const wd = new Date(ymd + 'T12:00:00Z').getUTCDay();
  if (wd === 0 || wd === 6) return 'weekend';
  if (SPECIAL.has(ymd)) return 'special';
  const Y = cmeYear(+ymd.slice(0, 4));
  if (Y.full.has(ymd)) return 'holiday';
  const e = Y.early.get(ymd);
  if (e && NYSE_FROM_EARLY.has(e.name)) return 'holiday';
  return 'open';
}
export const isTradingDay = (ymd) => dayKind(ymd) === 'open';

// ─── the release days the study uses ───
function uniq(rows) { const m = new Map(); for (const r of rows) if (!m.has(r.d)) m.set(r.d, r); return [...m.values()].sort((a, b) => a.d.localeCompare(b.d)); }

// { days: [{ d, types: ['CPI'|'NFP'], src }], dropped: [{ d, why }] } for releases from `from` to `until` (inclusive)
export function releaseDays(from, until) {
  const fomc = new Set(fomcDates()), by = new Map(), dropped = [];
  for (const [type, rows] of [['CPI', cpiDates()], ['NFP', nfpDates()]]) for (const r of rows) {
    if (r.d < from || r.d > until) continue;
    const x = by.get(r.d) || { d: r.d, types: [], src: [] }; x.types.push(type); x.src.push(`${type}: ${r.src}`); by.set(r.d, x);
  }
  const days = [];
  for (const x of [...by.values()].sort((a, b) => a.d.localeCompare(b.d))) {
    const k = dayKind(x.d);
    if (k !== 'open') { dropped.push({ d: x.d, types: x.types, why: `not a NYSE trading day (${k})` }); continue; }
    if (fomc.has(x.d)) { dropped.push({ d: x.d, types: x.types, why: 'FOMC day' }); continue; }
    days.push(x);
  }
  return { days, dropped };
}
