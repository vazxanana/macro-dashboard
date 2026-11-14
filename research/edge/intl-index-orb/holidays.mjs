// Copied unchanged from research/edge/local-preholiday/holidays.mjs (branch local-preholiday) for intl-index-orb.
// Edge research · local-preholiday: rule-based full-day exchange closures on weekdays, per exchange (PREREGISTRATION.md).
// Pure, no imports, no network. Dates are 'YYYY-MM-DD' strings (calendar dates of the exchange's own country).
// Each rule is named where it is applied. What is NOT modelled is said in PREREGISTRATION.md (HKEX lunar holidays, Xetra's
// early-2000s closures that later ended, unscheduled closures).

const pad = (n) => String(n).padStart(2, '0');
export const ymd = (y, m, d) => { const t = new Date(Date.UTC(y, m - 1, d)); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; };
export const weekday = (s) => new Date(s + 'T12:00:00Z').getUTCDay();          // 0 Sunday ... 6 Saturday
export const addDays = (s, n) => new Date(Date.parse(s + 'T12:00:00Z') + n * 86400e3).toISOString().slice(0, 10);
const isWeekend = (s) => { const w = weekday(s); return w === 0 || w === 6; };

// Easter Sunday, Gregorian calendar: the anonymous algorithm (Meeus / Jones / Butcher)
export function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return ymd(y, month, day);
}
// the n-th given weekday (0 Sunday ... 6 Saturday) of a month; n = -1 = the last one
export function nthWeekday(y, m, wd, n) {
  if (n > 0) { const first = weekday(ymd(y, m, 1)); return ymd(y, m, 1 + ((wd - first + 7) % 7) + 7 * (n - 1)); }
  const lastD = new Date(Date.UTC(y, m, 0)).getUTCDate(), last = weekday(ymd(y, m, lastD));
  return ymd(y, m, lastD - ((last - wd + 7) % 7));
}
// a fixed-date holiday on Saturday or Sunday moves to the next Monday (UK / Australian New Year, Australia Day)
const toMonday = (s) => { const w = weekday(s); return w === 6 ? addDays(s, 2) : w === 0 ? addDays(s, 1) : s; };
// a holiday on Sunday moves to Monday; Saturday is not replaced (Hong Kong general holidays)
const sundayToMonday = (s) => (weekday(s) === 0 ? addDays(s, 1) : s);
// Christmas and Boxing Day with the UK / Australian substitutes: 25 Dec on Saturday -> 27 and 28 Dec; on Sunday -> 26 and 27;
// 26 Dec on Saturday -> 28 Dec (Monday)
function christmasUK(y) {
  const c = ymd(y, 12, 25), w = weekday(c);
  if (w === 6) return [ymd(y, 12, 27), ymd(y, 12, 28)];
  if (w === 0) return [ymd(y, 12, 26), ymd(y, 12, 27)];
  if (w === 5) return [c, ymd(y, 12, 28)];
  return [c, ymd(y, 12, 26)];
}

// Xetra (Frankfurt) and Eurex: New Year, Good Friday, Easter Monday, Labour Day 1 May, Christmas Eve, Christmas, 26 Dec,
// New Year's Eve; no weekend substitutes
function xetra(y) {
  const e = easter(y);
  return [ymd(y, 1, 1), addDays(e, -2), addDays(e, 1), ymd(y, 5, 1), ymd(y, 12, 24), ymd(y, 12, 25), ymd(y, 12, 26), ymd(y, 12, 31)];
}
// Euronext (Paris, Amsterdam): New Year, Good Friday, Easter Monday, 1 May, Christmas, 26 Dec; 24 and 31 Dec are early closes
// (trading days); no weekend substitutes
function euronext(y) {
  const e = easter(y);
  return [ymd(y, 1, 1), addDays(e, -2), addDays(e, 1), ymd(y, 5, 1), ymd(y, 12, 25), ymd(y, 12, 26)];
}
// LSE = the England and Wales bank holidays (Banking and Financial Dealings Act 1971 and the royal proclamations)
const UK_ONE_OFF = ['2002-06-03', '2011-04-29', '2012-06-05', '2022-06-03', '2022-09-19', '2023-05-08']; // jubilees, wedding, funeral, coronation
function lse(y) {
  const e = easter(y);
  const out = [toMonday(ymd(y, 1, 1)), addDays(e, -2), addDays(e, 1)];
  // early May bank holiday: first Monday of May; moved to Friday 8 May in 1995 and 2020 (VE Day anniversaries)
  out.push(y === 1995 || y === 2020 ? ymd(y, 5, 8) : nthWeekday(y, 5, 1, 1));
  // spring bank holiday: last Monday of May; moved for the jubilees of 2002, 2012, 2022
  out.push(({ 2002: '2002-06-04', 2012: '2012-06-04', 2022: '2022-06-02' })[y] || nthWeekday(y, 5, 1, -1));
  out.push(nthWeekday(y, 8, 1, -1));                                         // summer bank holiday: last Monday of August
  out.push(...christmasUK(y));
  out.push(...UK_ONE_OFF.filter((d) => +d.slice(0, 4) === y));
  return out;
}
// SIX Swiss Exchange: 1 and 2 Jan (Berchtoldstag), Good Friday, Easter Monday, Ascension (Easter + 39), Whit Monday (Easter + 50),
// Labour Day 1 May, Swiss National Day 1 Aug, 24, 25, 26 and 31 Dec
function six(y) {
  const e = easter(y);
  return [ymd(y, 1, 1), ymd(y, 1, 2), addDays(e, -2), addDays(e, 1), addDays(e, 39), addDays(e, 50), ymd(y, 5, 1), ymd(y, 8, 1),
    ymd(y, 12, 24), ymd(y, 12, 25), ymd(y, 12, 26), ymd(y, 12, 31)];
}
// ASX: New Year (weekend -> Monday), Australia Day 26 Jan (weekend -> Monday), Good Friday, Easter Monday, Anzac Day 25 Apr (no
// substitute), the King's / Queen's Birthday (second Monday of June), Christmas and Boxing Day with the UK substitutes
function asx(y) {
  const e = easter(y);
  return [toMonday(ymd(y, 1, 1)), toMonday(ymd(y, 1, 26)), addDays(e, -2), addDays(e, 1), ymd(y, 4, 25), nthWeekday(y, 6, 1, 2), ...christmasUK(y)];
}
// HKEX, partial (lunar and solar-term holidays dropped: Lunar New Year, Ching Ming, Buddha's Birthday, Tuen Ng, the day after
// Mid-Autumn, Chung Yeung): New Year, Good Friday, Easter Monday, Labour Day, HKSAR Establishment Day 1 Jul (from 1997), National
// Day 1 Oct, each to Monday when on a Sunday (no Saturday substitute); Christmas Day and the first weekday (not Sunday) after it;
// 25 Dec on Sunday -> 26 and 27 Dec
function hkex(y) {
  const e = easter(y);
  const out = [sundayToMonday(ymd(y, 1, 1)), addDays(e, -2), addDays(e, 1), sundayToMonday(ymd(y, 5, 1)), sundayToMonday(ymd(y, 7, 1)), sundayToMonday(ymd(y, 10, 1))];
  const c = ymd(y, 12, 25);
  if (weekday(c) === 0) out.push(ymd(y, 12, 26), ymd(y, 12, 27));
  else out.push(c, weekday(ymd(y, 12, 26)) === 0 ? ymd(y, 12, 27) : ymd(y, 12, 26));
  return out;
}
// Japan: the national holidays of the Public Holiday Law (with its changes by year), the substitute holiday and the citizens'
// holiday; JPX also closes 2 and 3 Jan and 31 Dec
export const equinox = (y, autumn) => Math.floor((autumn ? 23.2488 : 20.8431) + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4)); // 1980-2099
export function japanNational(y) {
  const H = new Set();
  const add = (s) => H.add(s);
  add(ymd(y, 1, 1));                                                          // New Year's Day
  add(y >= 2000 ? nthWeekday(y, 1, 1, 2) : ymd(y, 1, 15));                    // Coming of Age Day (2nd Monday from 2000)
  add(ymd(y, 2, 11));                                                         // National Foundation Day
  if (y >= 2020) add(ymd(y, 2, 23));                                          // Emperor's Birthday (Reiwa)
  add(ymd(y, 3, equinox(y, false)));                                          // Vernal Equinox Day
  add(ymd(y, 4, 29));                                                         // Greenery Day (to 2006) / Showa Day (2007 on)
  add(ymd(y, 5, 3)); add(ymd(y, 5, 4)); add(ymd(y, 5, 5));                    // Constitution, Greenery (citizens' to 2006), Children's
  if (y === 2020) add('2020-07-23'); else if (y === 2021) add('2021-07-22');  // Marine Day, Olympic moves
  else add(y >= 2003 ? nthWeekday(y, 7, 1, 3) : ymd(y, 7, 20));               // Marine Day (3rd Monday from 2003)
  if (y === 2020) add('2020-08-10'); else if (y === 2021) add('2021-08-08');  // Mountain Day, Olympic moves
  else if (y >= 2016) add(ymd(y, 8, 11));                                     // Mountain Day (from 2016)
  add(y >= 2003 ? nthWeekday(y, 9, 1, 3) : ymd(y, 9, 15));                    // Respect for the Aged Day (3rd Monday from 2003)
  add(ymd(y, 9, equinox(y, true)));                                           // Autumnal Equinox Day
  if (y === 2020) add('2020-07-24'); else if (y === 2021) add('2021-07-23');  // Sports Day, Olympic moves
  else add(y >= 2000 ? nthWeekday(y, 10, 1, 2) : ymd(y, 10, 10));             // Sports Day (2nd Monday from 2000)
  add(ymd(y, 11, 3)); add(ymd(y, 11, 23));                                    // Culture Day, Labour Thanksgiving Day
  if (y <= 2018) add(ymd(y, 12, 23));                                         // Emperor's Birthday (Heisei)
  if (y === 2019) ['2019-04-30', '2019-05-01', '2019-05-02', '2019-10-22'].forEach(add); // accession and enthronement
  // citizens' holiday: a day (not Sunday) between two national holidays
  for (const s of [...H]) {
    const mid = addDays(s, 1), nxt = addDays(s, 2);
    if (H.has(nxt) && !H.has(mid) && weekday(mid) !== 0) H.add(mid);
  }
  // substitute holiday: a holiday on a Sunday -> the next day that is not a holiday (Monday only before 2007)
  for (const s of [...H].sort()) {
    if (weekday(s) !== 0) continue;
    let d = addDays(s, 1);
    if (y >= 2007) while (H.has(d)) d = addDays(d, 1);
    H.add(d);
  }
  return [...H];
}
function jpx(y) { return [...japanNational(y), ymd(y, 1, 2), ymd(y, 1, 3), ymd(y, 12, 31)]; }

export const EXCHANGES = { xetra, euronext, lse, six, asx, hkex, jpx };
// full-day closures of an exchange on weekdays in one year, sorted, distinct
export function closures(ex, y) {
  const f = EXCHANGES[ex];
  if (!f) throw new Error('unknown exchange ' + ex);
  return [...new Set(f(y).filter((s) => +s.slice(0, 4) === y && !isWeekend(s)))].sort();
}
const CACHE = new Map();
export function isClosed(ex, s) {
  const key = ex + s.slice(0, 4);
  if (!CACHE.has(key)) CACHE.set(key, new Set(closures(ex, +s.slice(0, 4))));
  return CACHE.get(key).has(s);
}
export const isTradingDay = (ex, s) => !isWeekend(s) && !isClosed(ex, s);
