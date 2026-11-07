// High-impact economic calendar, 1 Aug 2025 - Dec 2026 (UTC), hardcoded from the official schedules. Free sources only, no
// network at run time: the faireconomy JSON the trader reads covers only the current week, so history lives here.
//
//   import { nearEvent, EVENTS } from './events.mjs';
//   nearEvent(ts, 60)              -> the nearest event within +-60 minutes of ts (unix seconds or ms), or null
//   nearEvent(ts, 30, { tier: 1 }) -> only CPI / NFP / FOMC / PCE
//   eventDay(ts)                   -> events of the same New York trading day (18:00 ET to 18:00 ET), [] if none
//
// Each event: { t (unix s, UTC), at (ISO), type, title, country, tier, src, approx? }. tier 1 = CPI, NFP, FOMC, PCE;
// tier 2 = ISM manufacturing / services, weekly jobless claims; cb = ECB and BoJ decisions.
// `scheduled: true` marks dates after 7 Nov 2026 (announced, not yet happened).
// Regenerate research/data/events.json with: node council/events.mjs > research/data/events.json
//
// Release times are each agency's fixed local time, converted to UTC with the zone rules of that date (DST handled):
// US data 08:30 New York (two BEA releases after the 2025 shutdown came at 10:00), ISM 10:00 New York, FOMC statement
// 14:00 New York, ECB decision 14:15 Frankfurt, BoJ statement ~12:00 Tokyo (the BoJ has no fixed minute; `approx: true`).

export const SOURCES = {
  CPI: 'BLS CPI release schedule, bls.gov/schedule/news_release/cpi.htm; 2025 shutdown changes: bls.gov/bls/2025-lapse-revised-release-dates.htm (Sep 2025 CPI moved to 24 Oct, Oct 2025 CPI not produced, Nov 2025 CPI on 18 Dec, Jan 2026 CPI moved 11 -> 13 Feb)',
  NFP: 'BLS Employment Situation schedule, bls.gov/schedule/news_release/empsit.htm and bls.gov/schedule/2026/; shutdown changes: bls.gov/bls/2025-lapse-revised-release-dates.htm (Sep 2025 report on 20 Nov, Oct 2025 cancelled, Nov 2025 on 16 Dec, Jan 2026 moved 6 -> 11 Feb)',
  FOMC: 'Federal Reserve FOMC meeting calendar, federalreserve.gov/monetarypolicy/fomccalendars.htm (statement 14:00 ET on the second day)',
  PCE: 'BEA Personal Income and Outlays release schedule, bea.gov/news/schedule, and BEA schedule notices of 7 and 15 Jan 2026 (Sep 2025 data 5 Dec 10:00, Oct+Nov 2025 data 22 Jan 10:00, Dec 2025 data 20 Feb, Jan 2026 data 13 Mar, Feb 2026 data 9 Apr)',
  ECB: 'ECB Governing Council monetary policy meeting schedule, ecb.europa.eu/press/calendars/mgcgc/html/index.en.html, and the ECB monetary policy statements of each date (decision 14:15 CET/CEST)',
  BOJ: 'Bank of Japan Monetary Policy Meetings schedule, boj.or.jp/en/mopo/mpmsche_minu/index.htm, and the BoJ minutes / statements of each meeting (statement time varies, ~12:00 JST)',
  ISM: 'ISM Report On Business release rules, ismworld.org rob-report-calendar: Manufacturing PMI on the first business day, Services PMI on the third business day, 10:00 ET (Jan 2026: 5 and 7 Jan per ISM\'s calendar). Rule-derived dates.',
  CLAIMS: 'US Department of Labor weekly Unemployment Insurance claims, every Thursday 08:30 ET (Wednesday when Thursday is a federal holiday); none published during the 1 Oct - 12 Nov 2025 shutdown. Rule-derived dates.',
};

// [local date, 'HH:MM' local] per type. Dates checked against the official pages listed in SOURCES (see research/news-filter.md).
const US = 'America/New_York', FRA = 'Europe/Berlin', TYO = 'Asia/Tokyo';
const RAW = {
  CPI: { tz: US, title: 'CPI', country: 'USD', tier: 1, d: [
    '2025-08-12', '2025-09-11', '2025-10-24', '2025-12-18', '2026-01-13', '2026-02-13', '2026-03-11', '2026-04-10', '2026-05-12',
    '2026-06-10', '2026-07-14', '2026-08-12', '2026-09-11', '2026-10-14', '2026-11-10', '2026-12-10'], at: '08:30' },
  NFP: { tz: US, title: 'Non-Farm Payrolls (Employment Situation)', country: 'USD', tier: 1, d: [
    '2025-08-01', '2025-09-05', '2025-11-20', '2025-12-16', '2026-01-09', '2026-02-11', '2026-03-06', '2026-04-03', '2026-05-08',
    '2026-06-05', '2026-07-02', '2026-08-07', '2026-09-04', '2026-10-02', '2026-11-06', '2026-12-04'], at: '08:30' },
  FOMC: { tz: US, title: 'FOMC statement', country: 'USD', tier: 1, d: [
    '2025-09-17', '2025-10-29', '2025-12-10', '2026-01-28', '2026-03-18', '2026-04-29', '2026-06-17', '2026-07-29', '2026-09-16',
    '2026-10-28', '2026-12-09'], at: '14:00' },
  PCE: { tz: US, title: 'PCE (Personal Income and Outlays)', country: 'USD', tier: 1, d: [
    '2025-08-29', '2025-09-26', ['2025-12-05', '10:00'], ['2026-01-22', '10:00'], '2026-02-20', '2026-03-13', '2026-04-09', '2026-04-30',
    '2026-05-28', '2026-06-25', '2026-07-30', '2026-08-26', '2026-09-30', '2026-10-29', '2026-11-25', '2026-12-23'], at: '08:30' },
  ECB: { tz: FRA, title: 'ECB rate decision', country: 'EUR', tier: 'cb', d: [
    '2025-09-11', '2025-10-30', '2025-12-18', '2026-02-05', '2026-03-19', '2026-04-30', '2026-06-11', '2026-07-23', '2026-09-10',
    '2026-10-29'], at: '14:15' },
  BOJ: { tz: TYO, title: 'BoJ policy statement', country: 'JPY', tier: 'cb', approx: true, d: [
    '2025-07-31', '2025-09-19', '2025-10-30', '2025-12-19', '2026-01-23', '2026-03-19', '2026-04-28', '2026-06-16', '2026-07-31',
    '2026-09-18', '2026-10-30'], at: '12:00' },
};
const FROM = '2025-08-01', TO = '2026-12-31', LAST_SEEN = Date.UTC(2026, 10, 7, 23, 59) / 1000;   // dates after 7 Nov 2026 are scheduled

// US federal holidays in range (ISM business days, claims shifts)
const HOLIDAYS = new Set(['2025-09-01', '2025-10-13', '2025-11-11', '2025-11-27', '2025-12-25', '2026-01-01', '2026-01-19', '2026-02-16',
  '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-10-12', '2026-11-11', '2026-11-26', '2026-12-25']);
const ISM_FIXED = { '2026-01': ['2026-01-05', '2026-01-07'] };   // ISM's own calendar (January breaks the business-day rule)
const SHUTDOWN = ['2025-10-01', '2025-11-12'];                    // federal funding lapse: no DOL claims releases

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const isBiz = (d) => d.getUTCDay() % 6 !== 0 && !HOLIDAYS.has(ymd(d));
// local wall time in an IANA zone -> unix seconds (two passes settle the zone offset of that date)
export function zonedToUtc(date, hhmm, tz) {
  const [y, m, d] = date.split('-').map(Number), [H, M] = hhmm.split(':').map(Number), want = Date.UTC(y, m - 1, d, H, M);
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
  let t = want;
  for (let i = 0; i < 2; i++) { const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map((x) => [x.type, +x.value]));
    t += want - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute); }
  return t / 1000;
}

function build() {
  const out = [], push = (type, date, hhmm, tz, extra) => { const t = zonedToUtc(date, hhmm, tz);
    out.push({ t, at: new Date(t * 1000).toISOString().replace('.000', ''), type, ...extra, local: `${date} ${hhmm} ${tz}`, ...(t > LAST_SEEN ? { scheduled: true } : {}) }); };
  for (const [type, R] of Object.entries(RAW)) for (const x of R.d) { const [date, hhmm] = Array.isArray(x) ? x : [x, R.at];
    if (date >= FROM) push(type, date, hhmm, R.tz, { title: R.title, country: R.country, tier: R.tier, src: SOURCES[type], ...(R.approx ? { approx: true } : {}) }); }
  // ISM manufacturing (1st business day) and services (3rd business day), 10:00 ET
  for (let y = 2025, m = 7; y < 2027; m === 11 ? (y++, m = 0) : m++) {
    const key = `${y}-${pad(m + 1)}`, biz = [];
    for (let d = new Date(Date.UTC(y, m, 1)); biz.length < 3; d = new Date(d.getTime() + 864e5)) if (isBiz(d)) biz.push(ymd(d));
    const [mfg, svc] = ISM_FIXED[key] || [biz[0], biz[2]];
    push('ISM_M', mfg, '10:00', US, { title: 'ISM Manufacturing PMI', country: 'USD', tier: 2, src: SOURCES.ISM });
    push('ISM_S', svc, '10:00', US, { title: 'ISM Services PMI', country: 'USD', tier: 2, src: SOURCES.ISM });
  }
  // weekly jobless claims: Thursdays 08:30 ET, the Wednesday before when Thursday is a holiday, none during the shutdown
  for (let d = new Date(Date.UTC(2025, 7, 7)); ymd(d) <= TO; d = new Date(d.getTime() + 7 * 864e5)) {
    let day = ymd(d); if (HOLIDAYS.has(day)) day = ymd(new Date(d.getTime() - 864e5));
    if (day >= SHUTDOWN[0] && day <= SHUTDOWN[1]) continue;
    push('CLAIMS', day, '08:30', US, { title: 'Initial Jobless Claims', country: 'USD', tier: 2, src: SOURCES.CLAIMS });
  }
  return out.sort((a, b) => a.t - b.t || a.type.localeCompare(b.type));
}

export const EVENTS = Object.freeze(build().map((e) => Object.freeze(e)));
export const TYPES = ['CPI', 'NFP', 'FOMC', 'PCE', 'ISM_M', 'ISM_S', 'CLAIMS', 'ECB', 'BOJ'];

const RANK = { 1: 0, cb: 1, 2: 2 };
const sec = (ts) => (ts instanceof Date ? ts.getTime() / 1000 : ts > 1e11 ? ts / 1000 : ts);
// opts: { tier: 1 | 2 | 'cb' | [..], type: 'CPI' | [..], country: 'USD' | [..], events: custom list }
const arr = (v) => (v == null ? null : Array.isArray(v) ? v : [v]);
function pick(opts = {}) {
  const tier = arr(opts.tier), type = arr(opts.type), country = arr(opts.country), list = opts.events || EVENTS;
  return tier || type || country ? list.filter((e) => (!tier || tier.includes(e.tier)) && (!type || type.includes(e.type)) && (!country || country.includes(e.country))) : list;
}

// Nearest event within +-windowMin minutes of ts, as { ...event, minutes } (minutes = ts - event, negative = before it), or null.
export function nearEvent(ts, windowMin = 60, opts = {}) {
  const t = sec(ts); if (!Number.isFinite(t)) return null;
  const list = pick(opts), w = windowMin * 60;
  let lo = 0, hi = list.length;   // first event at or after t - w (lists are sorted by time)
  while (lo < hi) { const mid = (lo + hi) >> 1; if (list[mid].t < t - w) lo = mid + 1; else hi = mid; }
  let best = null;   // nearest; at the same time (e.g. claims and PCE at 08:30) the bigger release wins: tier 1, then cb, then 2
  for (let i = lo; i < list.length && list[i].t <= t + w; i++) { const e = list[i], d = Math.abs(e.t - t) - (best ? Math.abs(best.t - t) : Infinity);
    if (d < 0 || (d === 0 && RANK[e.tier] < RANK[best.tier])) best = e; }
  return best ? { ...best, minutes: Math.round((t - best.t) / 6) / 10 } : null;
}

// New York trading day (18:00 ET opens the next day) of ts, as 'YYYY-MM-DD'
const NY = new Intl.DateTimeFormat('en-CA', { timeZone: US, year: 'numeric', month: '2-digit', day: '2-digit' });
export const tradingDay = (ts) => NY.format(new Date((sec(ts) + 6 * 3600) * 1000));
// every event in the same New York trading day as ts
export function eventDay(ts, opts = {}) { const d = tradingDay(ts); return pick(opts).filter((e) => tradingDay(e.t) === d); }
// events whose time falls inside [from, to] (a trade held through news)
export function eventsBetween(from, to, opts = {}) { const a = sec(from), b = sec(to); return pick(opts).filter((e) => e.t >= a && e.t <= b); }

// Meridian research tag (paper only, research/news-filter.md): the tier-1 US release (CPI / NFP / FOMC / PCE) within +-120 min of
// the entry, and the signed minutes to it. No rule, filter or Coach step reads it.
export const NEWS_TAG = { windowMin: 120, tier: 1 };
export function newsFeat(ts) { const e = nearEvent(ts, NEWS_TAG.windowMin, { tier: NEWS_TAG.tier }); return { newsT1: e ? e.type : null, newsMin: e ? e.minutes : null }; }

if (process.argv[1] && process.argv[1].endsWith('events.mjs')) {
  const counts = {}; for (const e of EVENTS) counts[e.type] = (counts[e.type] || 0) + 1;
  process.stdout.write(JSON.stringify({ note: 'High-impact economic calendar (UTC), generated by council/events.mjs from hardcoded official schedules; see that file and research/news-filter.md. scheduled: true = after 7 Nov 2026.',
    from: FROM, to: TO, generated: 'node council/events.mjs > research/data/events.json', counts, sources: SOURCES, events: EVENTS }, null, 1) + '\n');
}
