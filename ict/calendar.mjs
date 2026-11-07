// CME Globex calendar for the ICT desk's markets (equity index futures NQ / ES / YM / RTY, COMEX gold GC), derived from the
// exchange's published rule set, no network, no data file. Any year works; the rules are the ones in force since 2022 (Juneteenth),
// and 2018-2027 is checked date by date in tests/ict-calendar.test.mjs.
//
// Regular week: Sunday 18:00 New York to Friday 17:00, with a daily maintenance halt 17:00-18:00 (inHalt in tracker.mjs).
// FULL holidays (no trading from the eve's 17:00 to the holiday's 18:00): New Year's Day (Sunday -> Monday; a Saturday New Year
//   is not observed on the Friday: 31 Dec 2021 traded normal hours), Good Friday (Thursday closes 17:00, no evening session;
//   the 45-minute jobs-report sessions of Good Friday 2021 / 2023 count as closed: there is no complete H1 candle in them),
//   Christmas Day (Saturday -> Friday, Sunday -> Monday).
// EARLY CLOSES (trading halts in the early afternoon and the 18:00 reopen is regular): Martin Luther King Day, Presidents' Day,
//   Memorial Day, Juneteenth (from 2022; Saturday -> Friday, Sunday -> Monday), Independence Day (observed the same way) and the
//   3rd of July whenever the 4th is a Tuesday to Friday, Labor Day, Thanksgiving Day, the day after Thanksgiving, Christmas Eve on a
//   weekday. The published halt is 13:00 New York for equity index futures (13:15 on the day after Thanksgiving and Christmas Eve;
//   COMEX metals 13:30 / 13:45). The desk treats every early-close day as shut from 13:00: the 12:00-13:00 candle is its last
//   complete H1 candle and no 15- or 30-minute stub is ever taken for an hourly candle. Christmas Eve's evening is closed by the
//   eve rule (Christmas is a full holiday). Columbus Day and Veterans Day trade regular hours (bond holidays only).
// CNBC prints flat candles (open = high = low = close) into every shut period, so the desk filters bars with cmeShut() rather
// than trusting the feed's clock.
const NY = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
// New York wall-clock parts of a unix time: { ymd: 'YYYY-MM-DD', wd: 'Mon'.., min: minutes since midnight, y: year }
export const nyParts = (t) => { const o = {}; for (const p of NY.formatToParts(new Date(t * 1000))) o[p.type] = p.value; return { ymd: `${o.year}-${o.month}-${o.day}`, wd: o.weekday, min: (+o.hour % 24) * 60 + +o.minute, y: +o.year }; };
export const REOPEN = 18 * 60, CLOSE = 17 * 60, EARLY = 13 * 60;   // New York minutes

const ymd = (y, m, d) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
const dow = (y, m, d) => new Date(Date.UTC(y, m, d)).getUTCDay();
const nthDow = (y, m, wd, n) => 1 + ((wd - dow(y, m, 1) + 7) % 7) + 7 * (n - 1);
const lastDow = (y, m, wd) => { const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); return last - ((dow(y, m, last) - wd + 7) % 7); };
// a fixed-date holiday observed on the nearest weekday: Saturday -> Friday (unless satToFri is false: not observed), Sunday -> Monday
const observed = (y, m, d, satToFri = true) => { const w = dow(y, m, d); return w === 6 ? (satToFri ? ymd(y, m, d - 1) : null) : w === 0 ? ymd(y, m, d + 1) : ymd(y, m, d); };
// Good Friday = Easter Sunday (Gregorian computus) - 2 days
export function goodFriday(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
    mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, mo - 1, da) - 2 * 86400e3).toISOString().slice(0, 10);
}
const YEARS = new Map();
// { full: Map ymd -> name, early: Map ymd -> { name, published: New York minutes of the published equity-index halt } }
export function cmeYear(y) {
  if (YEARS.has(y)) return YEARS.get(y);
  const full = new Map(), early = new Map();
  const ny = observed(y, 0, 1, false); if (ny) full.set(ny, "New Year's Day");
  full.set(goodFriday(y), 'Good Friday');
  full.set(observed(y, 11, 25), 'Christmas Day');
  const E = (k, name, published = EARLY) => { if (k && !full.has(k)) early.set(k, { name, published }); };
  E(ymd(y, 0, nthDow(y, 0, 1, 3)), 'Martin Luther King Day');
  E(ymd(y, 1, nthDow(y, 1, 1, 3)), "Presidents' Day");
  E(ymd(y, 4, lastDow(y, 4, 1)), 'Memorial Day');
  if (y >= 2022) E(observed(y, 5, 19), 'Juneteenth');
  if (dow(y, 6, 4) >= 2 && dow(y, 6, 4) <= 5) E(ymd(y, 6, 3), 'Independence Day eve');
  E(observed(y, 6, 4), 'Independence Day');
  E(ymd(y, 8, nthDow(y, 8, 1, 1)), 'Labor Day');
  const tg = nthDow(y, 10, 4, 4); E(ymd(y, 10, tg), 'Thanksgiving Day'); E(ymd(y, 10, tg + 1), 'Day after Thanksgiving', EARLY + 15);
  if (dow(y, 11, 24) >= 1 && dow(y, 11, 24) <= 5) E(ymd(y, 11, 24), 'Christmas Eve', EARLY + 15);
  const out = { full, early }; YEARS.set(y, out); return out;
}
// the kind of New York date 'YYYY-MM-DD': { kind: 'full' | 'early' | 'open', name, published } (weekends are 'open' here: use cmeShut)
export function dayInfo(day) {
  const Y = cmeYear(+day.slice(0, 4));
  if (Y.full.has(day)) return { kind: 'full', name: Y.full.get(day) };
  if (Y.early.has(day)) return { kind: 'early', ...Y.early.get(day) };
  return { kind: 'open' };
}
// is CME Globex shut at unix time t (equity index and metals)? weekend Fri 17:00 - Sun 18:00; a full holiday until its 18:00 reopen
// and its eve from 17:00; an early-close day from 13:00 until 18:00
export function cmeShut(t) {
  const p = nyParts(t);
  if (p.wd === 'Sat' || (p.wd === 'Fri' && p.min >= CLOSE) || (p.wd === 'Sun' && p.min < REOPEN)) return true;
  const d = dayInfo(p.ymd);
  if (d.kind === 'full' && p.min < REOPEN) return true;
  if (d.kind === 'early' && p.min >= EARLY && p.min < REOPEN) return true;
  return p.min >= CLOSE && dayInfo(nyParts(t + 86400).ymd).kind === 'full';
}
// the special days (full holidays and early closes) from New York date `from` for `days` days, oldest first: [{ day, kind, name }]
export function upcoming(t, days = 7) {
  const out = []; let p = nyParts(t);
  for (let i = 0; i < days; i++) { const d = dayInfo(p.ymd); if (d.kind !== 'open') out.push({ day: p.ymd, ...d }); p = nyParts(t + (i + 1) * 86400); }
  return out;
}
