// MeridianX Academy: candle data-quality checks (docs/academy/ARCHITECTURE.md section 4). Pure functions, no I/O, no network.
//
//   checkBars(bars, { tfSec, calendar, now })  ->  { status, issues, coverage, counts, span, bars, expected, missing }
//   summarize(bars, opt)                       ->  the same verdict, compact: counts, worst gaps, shifted weeks, a verdict per year
//   closedOnly(bars, tfSec, now)               ->  the series without a last bar that has not closed yet
//   isOpen / barExpected / CALENDARS           the session calendars;  usEuDstMismatch(t)  the weeks a European clock misleads
//
// bars = Bar[] ({ time, open, high, low, close }; time = bar OPEN, UTC seconds). The series is judged as it is given: it is
// NOT sorted or de-duplicated first, because disorder and duplicates are findings.
//
// Issue types (each issue = { type, time, ... }):
//   bad-ohlc        a price is not a finite number, high < low, or open / close lie outside [low, high]     (error)
//   duplicate       the same bar time appears again                                                        (error)
//   out-of-order    a bar time is earlier than the bar before it                                           (error)
//   misaligned      the bar time is not on the timeframe grid (UTC, or 17:00 New York for 4 h and above)   (error)
//   future          the bar opens after `now`                                                              (error)
//   gap             expected bars are missing between two bars (missing = how many the session calendar expects)
//   off-session     a bar exists where the calendar says the market is shut (wrong clock, or a bad feed)
//   flat            high = low (zero range): a stale quote
//   spike           range above SPIKE_K x the median range of the previous SPIKE_WIN bars
//   jump            open more than SPIKE_K x that median away from the previous close, with no gap in time between them
//   incomplete      the last bar had not closed by `now` (more than END_TOL of the bar was still to come): never treat it
//                   as a closed higher-timeframe bar
//   clock-shift     session alignment: in one week, on at least SHIFT_MIN_DAYS of Monday-Thursday, the daily break sits one
//                   hour away from where the calendar puts it (bars inside the break AND none in the hour next to it).
//                   shiftSec -3600 = the bar times run one hour EARLY (the break comes an hour early); +3600 = one hour late.
//                   Intraday series only (1 h and below), calendars with a daily break.
//
// Status (thresholds below, all documented, none tuned per market):
//   unreliable   any error, OR coverage < USABLE_COVERAGE, OR spikes + jumps above MAX_SPIKE_RATE of the bars,
//                OR off-session bars above MAX_OFFSESSION of the bars, OR flat bars above MAX_FLAT_UNRELIABLE of the bars,
//                OR clock-shifted weeks above MAX_SHIFT_WEEKS of the weeks
//   certified    no error, coverage >= CERT_COVERAGE, no gap longer than CERT_MAX_GAP_SEC of expected trading, no spike or
//                jump, flat bars <= MAX_FLAT_CERT of the bars, no off-session bar, no clock-shifted week, no incomplete last bar
//   usable       everything in between: fine for training and replay, with the issues shown
//
// The calendars know the weekly close, the daily break and the three days every venue shuts (Christmas, New Year, Good
// Friday). They do NOT know early closes around other US holidays, so those show as short gaps: that is why `certified`
// asks for 99.5% and not 100%.

export const THRESHOLDS = {
  CERT_COVERAGE: 0.995,          // share of expected bars present for `certified`
  USABLE_COVERAGE: 0.97,         // below this the series is `unreliable`
  CERT_MAX_GAP_SEC: 86400,       // a single hole of more than one day of expected trading blocks `certified`
  SPIKE_K: 12,                   // a range (or an open jump) above 12 x the rolling median range is an outlier
  SPIKE_WIN: 100,                // bars in the rolling median (at least SPIKE_MIN of them must exist)
  SPIKE_MIN: 30,
  MAX_SPIKE_RATE: 0.001,         // more than 1 outlier per 1,000 bars: `unreliable`
  MAX_OFFSESSION: 0.01,          // more than 1% of the bars outside the session calendar: `unreliable`. A feed that ignores
                                 // daylight saving puts 1 bar in 23 of half the year there (about 2%)
  SHIFT_MIN_DAYS: 3,             // Monday-Thursday days of one week that must show the same one-hour shift
  MAX_SHIFT_WEEKS: 0.10,         // more than 10% of the weeks on a shifted clock: `unreliable`
  MAX_FLAT_CERT: 0.001,          // flat bars allowed in a `certified` series
  MAX_FLAT_UNRELIABLE: 0.05,     // above 5% flat bars the feed is stale: `unreliable`
  END_TOL: 0.05,                 // the last bar counts as closed when at most 5% of it lies after `now`
};

// ── New York clock (the session calendars are defined in New York wall-clock time, daylight saving included) ──
const nyFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', weekday: 'short' });
const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const hourCache = new Map();
// { y, mo, d, dow, min (minute of the New York day), off (seconds to ADD to UTC for New York wall-clock) } of a UTC second
export function nyClock(t) {
  const hk = Math.floor(t / 3600); let c = hourCache.get(hk);
  if (!c) {
    const o = {}; for (const p of nyFmt.formatToParts(new Date(hk * 3600000))) o[p.type] = p.value;
    const local = Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour) / 1000;
    c = { y: +o.year, mo: +o.month, d: +o.day, dow: DOW[o.weekday], h: +o.hour, off: local - hk * 3600 };
    if (hourCache.size > 400000) hourCache.clear(); hourCache.set(hk, c);
  }
  return { y: c.y, mo: c.mo, d: c.d, dow: c.dow, min: c.h * 60 + Math.floor((t - hk * 3600) / 60), off: c.off };
}
// Good Friday of year y as 'MM-DD' (anonymous Gregorian computus for Easter Sunday, minus two days)
export function goodFriday(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, mo - 1, da - 2)).toISOString().slice(5, 10);
}

// Session calendars. Minutes are minutes of the New York day. A trading day ("session") runs from `open` of the evening
// before to `close`; the market is shut from `close` to `open` every day, from Friday's close to Sunday's open, and for the
// whole session of a holiday (25 Dec, 1 Jan, Good Friday). A calendar with `window` is open only inside that window of
// minutes on Monday to Friday (holidays excepted).
export const CALENDARS = {
  // spot gold (HistData XAUUSD, OANDA XAU_USD): Sunday 18:00 to Friday 17:00, daily break 17:00-18:00
  xau: { name: 'spot gold: Sun 18:00 - Fri 17:00 New York, daily break 17:00-18:00', open: 1080, close: 1020 },
  // Nasdaq-100 CFD on OANDA (NAS100_USD): the same week as gold
  nas100: { name: 'NAS100 CFD: Sun 18:00 - Fri 17:00 New York, daily break 17:00-18:00', open: 1080, close: 1020 },
  // Nasdaq-100 cash CFD in the HistData files (NSXUSD): shuts at 16:15 New York
  'nas100-histdata': { name: 'NSXUSD (HistData): Sun 18:00 - Fri 16:15 New York, daily break 16:15-18:00', open: 1080, close: 975 },
  // only the New York cash-open window of each trading day (what the NQ open-run rule reads): 09:30-11:00 New York
  'ny-open-window': { name: 'weekdays 09:30-11:00 New York', window: [570, 660] },
  // no calendar: every bar is expected (crypto, or when the venue is unknown)
  always: { name: '24 / 7', open: 0, close: 1440, always: true },
};
const pad2 = (x) => String(x).padStart(2, '0');
const isHoliday = (c) => { const md = `${pad2(c.mo)}-${pad2(c.d)}`; return md === '12-25' || md === '01-01' || md === goodFriday(c.y); };
// Is the market open during the minute that starts at t?
export function isOpen(calendar, t) {
  const cal = typeof calendar === 'string' ? CALENDARS[calendar] : calendar;
  if (!cal) throw new Error('unknown calendar ' + calendar);
  if (cal.always) return true;
  const c = nyClock(t);
  if (cal.window) return c.dow >= 1 && c.dow <= 5 && c.min >= cal.window[0] && c.min < cal.window[1] && !isHoliday(c);
  const evening = c.min >= cal.open;                                  // from the evening open the minute belongs to tomorrow's session
  if (!evening && c.min >= cal.close) return false;                   // the daily break
  const sd = evening ? nyClock(t + 86400 - (c.min - cal.open) * 60) : c;   // the session's calendar day
  if (sd.dow === 6 || sd.dow === 0) return false;                     // Saturday and Sunday sessions do not exist
  return !isHoliday(sd);
}
// Is a bar that opens at t expected? Yes when the market is open at any 15-minute sample inside it.
export function barExpected(calendar, t, tfSec) {
  const st = Math.min(tfSec, 900);
  for (let s = t; s < t + tfSec; s += st) if (isOpen(calendar, s)) return true;
  return false;
}
// On the grid: a multiple of the timeframe in UTC, or (4 h and above) counted from 17:00 New York, the usual FX day start
export function isAligned(t, tfSec) {
  if (!Number.isFinite(t) || t !== Math.floor(t)) return false;
  if (t % tfSec === 0) return true;
  if (tfSec < 14400) return false;
  return (t + nyClock(t).off - 17 * 3600) % tfSec === 0;
}

// Europe's summer time runs from 01:00 UTC on the last Sunday of March to 01:00 UTC on the last Sunday of October
export function euSummer(t) {
  const y = new Date(t * 1000).getUTCFullYear(), lastSun = (mo) => { const d = new Date(Date.UTC(y, mo, 0)); return Date.UTC(y, mo - 1, d.getUTCDate() - d.getUTCDay(), 1) / 1000; };
  return t >= lastSun(3) && t < lastSun(10);
}
// True in the weeks when New York is on daylight time and Europe is not (about three weeks in March, one around 1 November).
// A feed stamped on a European server clock and read as New York time is one hour off exactly then.
export const usEuDstMismatch = (t) => (nyClock(t).off === -4 * 3600) !== euSummer(t);

const median = (a) => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };

export function checkBars(bars, { tfSec, calendar = 'always', now = Date.now() / 1000 } = {}) {
  if (!Array.isArray(bars)) throw new Error('checkBars: bars must be an array');
  if (!(tfSec > 0)) throw new Error('checkBars: tfSec is required');
  const T = THRESHOLDS, issues = [], seen = new Set(), win = [];
  let inSession = 0, missing = 0, maxGapSec = 0, prev = null, from = Infinity, to = -Infinity;
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i] || {}, t = b.time;
    const fin = [b.open, b.high, b.low, b.close].every(Number.isFinite);
    if (!Number.isFinite(t)) { issues.push({ type: 'bad-ohlc', time: t ?? null, why: 'no time' }); continue; }
    if (!fin || b.high < b.low || b.high < Math.max(b.open, b.close) || b.low > Math.min(b.open, b.close)) issues.push({ type: 'bad-ohlc', time: t });
    else if (b.high === b.low) issues.push({ type: 'flat', time: t });
    if (seen.has(t)) { issues.push({ type: 'duplicate', time: t }); continue; }
    seen.add(t); if (t < from) from = t; if (t > to) to = t;
    if (prev && t < prev.time) { issues.push({ type: 'out-of-order', time: t, after: prev.time }); continue; }
    if (!isAligned(t, tfSec)) issues.push({ type: 'misaligned', time: t });
    if (t > now) issues.push({ type: 'future', time: t });
    if (barExpected(calendar, t, tfSec)) inSession++; else issues.push({ type: 'off-session', time: t });
    if (prev && t - prev.time > tfSec) {                              // walk the hole on the series' own grid
      let miss = 0, first = null;
      for (let s = prev.time + tfSec; s < t; s += tfSec) if (barExpected(calendar, s, tfSec)) { miss++; if (first == null) first = s; }
      if (miss) { missing += miss; maxGapSec = Math.max(maxGapSec, miss * tfSec); issues.push({ type: 'gap', time: first, to: t, missing: miss }); }
    }
    if (fin) {
      const rg = b.high - b.low;
      if (win.length >= T.SPIKE_MIN) {
        const md = median(win);
        if (md > 0 && rg > T.SPIKE_K * md) issues.push({ type: 'spike', time: t, range: rg, median: md });
        if (md > 0 && prev && t - prev.time === tfSec && Number.isFinite(prev.close) && Math.abs(b.open - prev.close) > T.SPIKE_K * md) issues.push({ type: 'jump', time: t, from: prev.close, to: b.open, median: md });
      }
      win.push(rg); if (win.length > T.SPIKE_WIN) win.shift();
    }
    prev = b;
  }
  if (prev && prev.time <= now && prev.time + tfSec - now > T.END_TOL * tfSec) issues.push({ type: 'incomplete', time: prev.time, closes: prev.time + tfSec, now });

  // session alignment: where does the daily break really sit? (Monday-Thursday: the days with a break after them)
  const cal = typeof calendar === 'string' ? CALENDARS[calendar] : calendar; let weeks = 0;
  if (cal && !cal.always && !cal.window && tfSec <= 3600 && seen.size) {
    const has = (a, b) => { for (let s = Math.ceil(a / tfSec) * tfSec; s < b; s += tfSec) if (seen.has(s)) return true; return false; };
    const W = new Map();
    for (let day = Math.floor(from / 86400) * 86400; day <= to; day += 86400) {
      const c = nyClock(day + 43200); if (c.dow < 1 || c.dow > 4 || isHoliday(c) || isHoliday(nyClock(day + 43200 + 86400))) continue;
      const midnight = day + 43200 - c.min * 60, closeT = midnight + cal.close * 60, openT = midnight + cal.open * 60;
      if (!has(midnight, closeT)) continue;                               // no data that day at all
      const late = !has(closeT - 3600, closeT), brk = has(closeT, openT), early = !has(openT, openT + 3600);
      const wk = midnight - (c.dow - 1) * 86400; let w = W.get(wk); if (!w) { w = { m: 0, p: 0 }; W.set(wk, w); }
      if (brk && late && !early) w.m++; else if (brk && early && !late) w.p++;
    }
    weeks = W.size;
    for (const [wk, w] of W) for (const [k, sh] of [['m', -3600], ['p', 3600]]) if (w[k] >= T.SHIFT_MIN_DAYS) issues.push({ type: 'clock-shift', time: wk, to: wk + 5 * 86400, shiftSec: sh, days: w[k] });
  }

  const counts = {}; for (const x of issues) counts[x.type] = (counts[x.type] || 0) + 1;
  const n = bars.length, expected = inSession + missing, coverage = expected ? inSession / expected : 0;
  const c = (k) => counts[k] || 0, rate = (k) => (n ? c(k) / n : 0);
  const errors = c('bad-ohlc') + c('duplicate') + c('out-of-order') + c('misaligned') + c('future');
  let status;
  if (!n || errors || coverage < T.USABLE_COVERAGE || (c('spike') + c('jump')) / n > T.MAX_SPIKE_RATE || rate('off-session') > T.MAX_OFFSESSION || rate('flat') > T.MAX_FLAT_UNRELIABLE
    || (weeks && c('clock-shift') / weeks > T.MAX_SHIFT_WEEKS)) status = 'unreliable';
  else if (coverage >= T.CERT_COVERAGE && maxGapSec <= T.CERT_MAX_GAP_SEC && !c('spike') && !c('jump') && rate('flat') <= T.MAX_FLAT_CERT && !c('off-session') && !c('clock-shift') && !c('incomplete')) status = 'certified';
  else status = 'usable';
  return { status, issues, coverage: Math.round(coverage * 1e5) / 1e5, counts, bars: n, expected, missing, maxGapSec, span: n && from <= to ? { from, to } : null };
}

// The closed part of a higher-timeframe series: drops a last bar that had not closed by `now` (same tolerance as the check)
export function closedOnly(bars, tfSec, now = Date.now() / 1000) {
  const out = bars.slice();
  while (out.length && out[out.length - 1].time + tfSec - now > THRESHOLDS.END_TOL * tfSec) out.pop();
  return out;
}

// A compact report for a long series: the whole-series verdict, the issue counts, the worst gaps and a verdict per year.
export function summarize(bars, opt) {
  const all = checkBars(bars, opt), byYear = {};
  const yr = (t) => new Date(t * 1000).getUTCFullYear();
  const groups = new Map(); for (const b of bars) { const y = yr(b.time); if (!groups.has(y)) groups.set(y, []); groups.get(y).push(b); }
  for (const [y, g] of groups) { const r = checkBars(g, { ...opt, now: Infinity }); byYear[y] = { status: r.status, bars: r.bars, coverage: r.coverage, missing: r.missing, counts: r.counts }; }
  const worstGaps = all.issues.filter((x) => x.type === 'gap').sort((a, b) => b.missing - a.missing).slice(0, 8).map((x) => ({ from: x.time, to: x.to, missing: x.missing }));
  const clockShift = all.issues.filter((x) => x.type === 'clock-shift').map((x) => ({ week: new Date(x.time * 1000).toISOString().slice(0, 10), shiftSec: x.shiftSec, days: x.days }));
  return { status: all.status, coverage: all.coverage, bars: all.bars, expected: all.expected, missing: all.missing, maxGapSec: all.maxGapSec, span: all.span, counts: all.counts, worstGaps, clockShift, byYear };
}
