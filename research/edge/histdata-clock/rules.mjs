// HistData clock audit: the four candidate rules (PREREGISTRATION.md), on LABEL seconds: the file's time label read as if
// it were UTC. Each returns the hours to add to the label to get UTC. Pure; imported by run.mjs and by the test that
// compares the shared converter (council/histdata.mjs) with the rule the audit certified.
const sunday = (y, m, n) => { const d = new Date(Date.UTC(y, m, 1)); return Date.UTC(y, m, 1 + ((7 - d.getUTCDay()) % 7) + 7 * (n - 1)) / 1000; };   // n-th Sunday of month m (0-11), 00:00
const lastSunday = (y, m) => { const d = new Date(Date.UTC(y, m + 1, 0)); return Date.UTC(y, m + 1, 0 - d.getUTCDay()) / 1000; };                    // last Sunday of month m, 00:00
export const yearOf = (L) => new Date(L * 1000).getUTCFullYear();
// the label's date is inside US daylight time (2nd Sunday of March to 1st Sunday of November) / Europe's summer time (last
// Sunday of March to last Sunday of October). The boundary is the Sunday's 00:00 label: these markets are shut then.
export const usDst = (L) => { const y = yearOf(L); return L >= sunday(y, 2, 2) && L < sunday(y, 10, 1); };
export const euDst = (L) => { const y = yearOf(L); return L >= lastSunday(y, 2) && L < lastSunday(y, 9); };
export const RULES = {
  R1: { name: 'fixed', off: () => 5 },
  R2: { name: 'new-york', off: (L) => (usDst(L) ? 4 : 5) },
  R3: { name: 'europe', off: (L) => (euDst(L) ? 4 : 5) },
  R4: { name: 'hybrid', off: (L) => (yearOf(L) < 2019 ? (usDst(L) ? 4 : 5) : (euDst(L) ? 4 : 5)) },
};
// the label lies in a mismatch window: the US on daylight time and Europe not
export const mismatch = (L) => usDst(L) !== euDst(L);
// the four change Sundays of a year (00:00 label)
export const changeSundays = (y) => [['US spring', sunday(y, 2, 2)], ['EU spring', lastSunday(y, 2)], ['EU autumn', lastSunday(y, 9)], ['US autumn', sunday(y, 10, 1)]];
