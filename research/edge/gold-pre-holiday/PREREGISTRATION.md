# Pre-registration: does spot gold drift up into US market holidays?

Written 14 Nov 2026, before any return of this study was computed (the holiday dates below were listed from the calendar code
alone). A standalone calendar study: **not** a gate, entry, exit or size of any gold-book system (owner item 44). Nothing live
changes whatever the result; a pass would only become a proposal for the owner.

## Why, and what is already known (dedupe)
The pre-holiday effect is documented for equities. Studies already on branches, read before this one:
- `pre-holiday` (#845): US indices, the day before an NYSE holiday: FAIL (2016-26 pooled +0.023R, t 1.02).
- `local-preholiday`: nine non-US indices on their own holidays: FAIL (pooled OOS Welch t 1.01).
- `fx-us-holiday` (#975): the dollar basket the day before a US holiday: FAIL (+0.015R, t 0.53).
- `post-holiday-metals` (#984): SHORT gold and silver on the day AFTER a US holiday, UTC days: FAIL, the sign was the other
  way (gold alone, short, −0.088R net, n 186, t −2.49 on 2006-26; i.e. gold rose on the day after).
- `gold-china-holidays`: gold around Shanghai Gold Exchange holidays: FAIL.
No study has read gold on the day(s) BEFORE a US holiday. **T3 below (long the first day after) is not independent**: its
direction was seen in `post-holiday-metals` on the same years (on UTC days, not 17:00 New York days). It is run because it was
asked as the mirror, and even a pass on T3 would be read as a second look at data already seen, never as new evidence.

## Data
- OANDA mid H1 XAU/USD, March 2006 to November 2026 (a cache outside git; fetched through the site's candle proxy).
- Trading days end at 17:00 New York (daylight saving handled by the New York time zone); weekend hours dropped
  (`research/edge/gold-drd-long/run.mjs` `nyDay`, imported). A day is named by the New York date on which it ends.

## Holidays (fixed before any return)
US market (NYSE) full holidays from `ict/calendar.mjs` `cmeYear` (imported read-only): its full holidays (New Year's Day,
not observed on a Saturday; Good Friday; Christmas Day observed) plus its early-close days that are NYSE holidays (Martin
Luther King Day, Presidents' Day, Memorial Day, Juneteenth from 2022, Independence Day observed, Labor Day, Thanksgiving Day).
Left out: its other early-close days (3 July, the day after Thanksgiving, Christmas Eve: trading days here) and one-off NYSE
closures (funerals, storms). 2006-2026: 9 a year (8 in 2011, 10 from 2023), 192 in all, listed by `holidays()` in `run.mjs`.

## The trades (all long, every trade has a stop)
- **T1**: the last trading day before a holiday (the last day ending before the holiday's date that is not itself a holiday).
  Buy at its open (the first H1 candle of the day, 17:00/18:00 New York the evening before), sell at its close (the last H1
  candle's close: 17:00 New York, or the early close where the session ends early).
- **T2**: the two last trading days before a holiday: buy at the open of the second-to-last, sell at the close of the last.
- **T3** (the mirror): the first trading day after the holiday (not a holiday itself), long, open to close.
- Stop: entry − 1.0 × ATR(14) of the 17:00 New York daily candles completed before the entry day (true range, simple mean).
  Checked on every H1 candle of the hold: an open at or below the stop exits at that open (gap); else a low at or below the
  stop exits at the stop. 1R = that ATR.
- Costs: $0.60 an ounce a round trip (spread + slippage), and financing on every long: `council/fills.mjs` `nights(entry, exit)`
  × `FIN.xau.long` (0.000148 of price a rollover, the demo broker's rate of 11 Nov 2026, today's rate for every year) × entry,
  in R. 2x costs = both doubled.
- A trade is skipped (and counted as skipped) if its days have no candle or fewer than 14 earlier days exist for the ATR.

## Windows, statistics, the bar
- In sample: holidays in 2007-2016. Out of sample: 2017 to October 2026. (2006 holidays and November 2026 are not judged.)
- n is about 9 a year, so t is **per event**: mean net R / (sd / sqrt n), one observation a holiday (no overlap between
  holidays). Month-sum t is reported beside it, not judged.
- Holm over the three tests (T1, T2, T3) on the one-sided OOS p values (Student t, n − 1 degrees of freedom).
- **Pass (each test)**: OOS net t >= 2 and Holm-adjusted one-sided p < 0.05; the in-sample net mean of the same sign
  (positive); OOS net mean still positive at 2x costs; the OOS net mean above at least 38 of 40 placebo means.
- **Placebo**: 40 seeds (1..40, a fixed generator); each draws, per OOS year, as many ordinary days as the test has events that
  year, from ordinary trading days (not a holiday, not within two trading days before or one after a holiday), and trades them
  the same way (T2: the drawn day and the day after it, both ordinary). Its mean net R is compared with the test's.
- Reported, not judged: gross and net per window, by holiday, by year, at 2x costs, stops hit, and the same one-day long
  on every ordinary day (mean and Welch t of pre-holiday minus ordinary).
- Verdict: PASS only if a test meets every condition. Anything else is FAIL.
