// Pre-registered sessions for research/edge/open-run-breadth-2 (preregistration.md): cash opens, local time zone, local midnight.
// open = local minute of the session open; cost = primary all-in round trip in index points (×2 is the stress case).
import { partsIn } from '../open-run-breadth/lib.mjs';
export const MARKETS2 = {
  uk100: { name: 'FTSE', tz: 'Europe/London', open: 8 * 60, cost: 2.0, inst: 'UK100_GBP' },
  jp225: { name: 'Nikkei', tz: 'Asia/Tokyo', open: 9 * 60, cost: 18.0, inst: 'JP225_USD' },
  hk33: { name: 'HangSeng', tz: 'Asia/Hong_Kong', open: 9 * 60 + 30, cost: 14.0, inst: 'HK33_HKD' },
  au200: { name: 'ASX200', tz: 'Australia/Sydney', open: 10 * 60, cost: 4.0, inst: 'AU200_AUD' },
  eu50: { name: 'EuroStoxx', tz: 'Europe/Paris', open: 9 * 60, cost: 3.5, inst: 'EU50_EUR' },
  fr40: { name: 'CAC', tz: 'Europe/Paris', open: 9 * 60, cost: 2.2, inst: 'FR40_EUR' },
  us2000: { name: 'Russell', tz: 'America/New_York', open: 9 * 60 + 30, cost: 0.55, inst: 'US2000_USD' },
};
export const NEW = Object.keys(MARKETS2);

// unix seconds of 00:00 local on calendar day d, for any zone from UTC-12 to UTC+14 (#543's helper only covers America/Europe).
export function midnightIn2(tz, d) {
  const [y, mo, da] = d.split('-').map(Number);
  for (let h = -15; h <= 13; h++) { const t = Date.UTC(y, mo - 1, da, h) / 1000; const p = partsIn(tz, t); if (p.d === d && p.m === 0) return t; }
  throw new Error('no midnight ' + tz + ' ' + d);
}
