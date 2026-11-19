// The gotobi calendar (Tokyo business days, gotobi days), shared by the spread reader of item 60 and the demo trade
// (council/gotobi.mjs, item 61). Moved out of the reader on 19 Nov 2026 so the trade never imports it; unchanged.
// ---- the Tokyo calendar, copied from research/edge/gotobi/run.mjs (branch gotobi, 14 Nov 2026; itself a copy of
// research/edge/turnaround-replicate/run.mjs). Copied, not imported: a council file never imports a research branch. -----------
const ymdU = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);   // m 1-12, d may overflow
const dowU = (s) => new Date(s + 'T12:00:00Z').getUTCDay();
export const addD = (s, n) => new Date(Date.parse(s + 'T12:00:00Z') + n * 86400e3).toISOString().slice(0, 10);
const nthMon = (y, m, n) => { const first = ymdU(y, m, 1); return addD(first, ((1 - dowU(first) + 7) % 7) + 7 * (n - 1)); };
const cache = new Map();
const memo = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };
// Japan's national holidays (the law as amended; the 2019-21 one-off moves), then the Tokyo Stock Exchange's own closed days
export function jpHolidays(y) {
  return memo('j' + y, () => {
    const s = new Set(), add = (d) => s.add(d);
    const vern = Math.floor(20.8431 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
    const aut = Math.floor(23.2488 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
    add(ymdU(y, 1, 1)); add(nthMon(y, 1, 2)); add(ymdU(y, 2, 11));
    if (y <= 2018) add(ymdU(y, 12, 23)); if (y >= 2020) add(ymdU(y, 2, 23));
    add(ymdU(y, 3, vern)); add(ymdU(y, 4, 29)); add(ymdU(y, 5, 3)); add(ymdU(y, 5, 4)); add(ymdU(y, 5, 5));
    add(y === 2020 ? '2020-07-23' : y === 2021 ? '2021-07-22' : nthMon(y, 7, 3));
    if (y >= 2016) add(y === 2020 ? '2020-08-10' : y === 2021 ? '2021-08-08' : ymdU(y, 8, 11));
    add(nthMon(y, 9, 3)); add(ymdU(y, 9, aut));
    add(y === 2020 ? '2020-07-24' : y === 2021 ? '2021-07-23' : nthMon(y, 10, 2));
    add(ymdU(y, 11, 3)); add(ymdU(y, 11, 23));
    if (y === 2019) { add('2019-05-01'); add('2019-10-22'); }
    const base = [...s].sort();
    for (const d of base) if (dowU(d) === 0) { let x = addD(d, 1); while (s.has(x)) x = addD(x, 1); s.add(x); }   // substitute
    for (const d of [...s].sort()) { const x = addD(d, 2); if (s.has(x) && !s.has(addD(d, 1)) && dowU(addD(d, 1)) !== 0) s.add(addD(d, 1)); } // citizen's
    return s;
  });
}
export function tseHolidays(y) {
  return memo('t' + y, () => { const s = new Set(jpHolidays(y)); for (const d of [ymdU(y, 1, 1), ymdU(y, 1, 2), ymdU(y, 1, 3), ymdU(y, 12, 31)]) s.add(d); return s; });
}
export const isTokyoBusinessDay = (ymd) => { const w = dowU(ymd); return w !== 0 && w !== 6 && !tseHolidays(+ymd.slice(0, 4)).has(ymd); };
export const prevBusinessDay = (ymd) => { let d = ymd; while (!isTokyoBusinessDay(d)) d = addD(d, -1); return d; };   // ymd itself if open
// the gotobi days of one month: 5, 10, 15, 20, 25 rolled back, plus the last business day; sorted, each once
export function gotobiOfMonth(y, m) {
  const s = new Set();
  for (const d of [5, 10, 15, 20, 25]) s.add(prevBusinessDay(ymdU(y, m, d)));
  s.add(prevBusinessDay(ymdU(y, m + 1, 0)));
  return [...s].sort();
}
// ---- end of the copy ------------------------------------------------------------------------------------------------------------
// a day is gotobi when its own month or the next one lists it (a 5th rolled back over the New Year can land in December)
export const isGotobi = (ymd) => { const y = +ymd.slice(0, 4), m = +ymd.slice(5, 7);
  return gotobiOfMonth(y, m).includes(ymd) || gotobiOfMonth(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1).includes(ymd); };

