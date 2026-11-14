// COMEX gold (GC / OG) calendar from the CME rule text (PREREGISTRATION.md). Pure; dates are 'YYYY-MM-DD' strings.
// Holidays come from council/datacheck.mjs usHolidays (read only): every 'closed' day, and every 'early' day that is a federal
// holiday (the day after Thanksgiving and 24 December are business days; Juneteenth only from 2022). A Saturday New Year is
// not moved to 31 December (usHolidays files it there; the exchanges stayed open).
import { usHolidays } from '../../../council/datacheck.mjs';

const iso = (y, m, d) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
const thanksFri = (y) => { for (let d = 22; d <= 28; d++) if (new Date(Date.UTC(y, 10, d)).getUTCDay() === 4) return iso(y, 10, d + 1); };
const HOL = new Map();
export function holidays(y) {
  if (HOL.has(y)) return HOL.get(y);
  const s = new Set();
  for (const [d, kind] of usHolidays(y)) {
    if (!d.startsWith(String(y))) continue;                       // a Saturday New Year observed on 31 Dec: not a closure
    if (kind === 'early' && (d === thanksFri(y) || d.endsWith('-12-24'))) continue;    // early closes, business days
    if (y < 2022 && /-06-(1[89]|20)$/.test(d) && kind === 'early') continue; // Juneteenth from 2022
    s.add(d);
  }
  HOL.set(y, s); return s;
}
export function isBiz(d) {
  const t = new Date(d + 'T00:00:00Z'), w = t.getUTCDay();
  return w !== 0 && w !== 6 && !holidays(t.getUTCFullYear()).has(d);
}
export function addBiz(d, n) {
  let t = Date.parse(d + 'T00:00:00Z'); const step = n >= 0 ? 1 : -1; let k = Math.abs(n);
  while (k > 0) { t += step * 86400e3; if (isBiz(new Date(t).toISOString().slice(0, 10))) k--; }
  return new Date(t).toISOString().slice(0, 10);
}
// business days of calendar month m (0-11) of year y, oldest first
export function bizDays(y, m) {
  const out = []; for (let d = 1; d <= 31; d++) { const s = iso(y, m, d); if (+s.slice(5, 7) !== m + 1) break; if (isBiz(s)) out.push(s); }
  return out;
}
const lastBiz = (y, m) => bizDays(y, m).at(-1);
// gold options expiry held in calendar month m of year y (the option month is m + 1): the 4th last business day; a Friday or
// the business day before a holiday moves it to the prior business day
export function optionsExpiry(y, m) {
  const B = bizDays(y, m); let d = B[B.length - 4];
  const next = new Date(Date.parse(d + 'T00:00:00Z') + 86400e3).toISOString().slice(0, 10);
  const fri = new Date(d + 'T00:00:00Z').getUTCDay() === 5, preHol = new Date(next + 'T00:00:00Z').getUTCDay() !== 6 && !isBiz(next);
  if (fri || preHol) d = addBiz(d, -1);
  return d;
}
// first notice day of an active delivery month (Feb, Apr, Jun, Aug, Oct, Dec): the last business day of the month before
export const ACTIVE = [1, 3, 5, 7, 9, 11];
export const firstNotice = (y, deliveryM) => deliveryM === 0 ? lastBiz(y - 1, 11) : lastBiz(y, deliveryM - 1);
// the month-end window's anchor for any month (FND when the next month is active)
export const monthLastBiz = lastBiz;
