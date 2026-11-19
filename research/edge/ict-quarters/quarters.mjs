// Quarters of the week, month and year for an instant (ict-quarters study, 13 Nov 2026). Pure: no clock, no file, no network.
// The study's own reading of the time-in-quarters idea in the ICT rule book (section 10), in plain terms:
//   trading day : starts at 18:00 New York (the day's first six-hour quarter opens then), so a Sunday-evening or a
//                 Monday-evening candle belongs to the NEXT calendar day; New York daylight time from council/histdata.mjs.
//   week        : Q1 Monday, Q2 Tuesday, Q3 Wednesday, Q4 Thursday; Friday is apart ('F').
//   month       : weeks counted by their Monday. The days before the month's first Monday are the partial first week ('P',
//                 ignored); the week of the 1st-7th Monday is Q1, 8th-14th Q2, 15th-21st Q3, 22nd-28th Q4, a week whose
//                 Monday is the 29th-31st is apart ('X').
//   year        : calendar quarters of the trading day's month (Jan-Mar Q1 ... Oct-Dec Q4).
// The quarter the rule book names for the false move (the manipulation, the Judas swing) is Q2 in every cycle: FAVOURED.
import { nyOffsetH } from '../../../council/histdata.mjs';

export const FAVOURED = 2;

// the New York trading day of instant t (seconds): { y, m (1-12), d, dow (0 Sunday .. 6 Saturday) }
export function tradingDay(t) {
  const x = new Date((t - nyOffsetH(t) * 3600 + 6 * 3600) * 1000);
  return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate(), dow: x.getUTCDay() };
}
export function weekQ(t) { const { dow } = tradingDay(t); return dow >= 1 && dow <= 4 ? dow : dow === 5 ? 'F' : 'W'; }
export function monthQ(t) {
  const { d, dow } = tradingDay(t);
  if (dow === 0 || dow === 6) return 'W';
  const mon = d - (dow - 1);                 // date of this week's Monday (<= 0: it was in the month before)
  if (mon < 1) return 'P';
  const k = Math.floor((mon - 1) / 7) + 1;   // 1..5
  return k <= 4 ? k : 'X';
}
export function yearQ(t) { return Math.floor((tradingDay(t).m - 1) / 3) + 1; }
export const CYCLES = { week: weekQ, month: monthQ, year: yearQ };
// is the signal's sweep candle in the favoured quarter of this cycle?
export const favoured = (cycle, t) => CYCLES[cycle](t) === FAVOURED;
