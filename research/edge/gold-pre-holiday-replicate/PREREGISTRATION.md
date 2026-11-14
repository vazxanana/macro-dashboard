# Pre-registration: does the gold pre-holiday long replicate on other data?

Written 14 Nov 2026, before any return of this study was computed. Only the shapes of the two candle files were looked at
(first and last time stamp, field order). A replication of `gold-pre-holiday` (branch `gold-pre-holiday`, PR #1070), whose
T1 (long gold on the last 17:00 New York trading day before an NYSE holiday) and T2 (the last two days) passed its bar on
OANDA mid H1 XAU/USD: T1 +0.133R net out of sample 2017-26 (n 92, t 2.35, Holm p 0.021, 40 of 40 placebos), T2 +0.216R
(t 2.53). That result is fragile: the in-sample years 2007-16 are weak (T1 +0.034R, t 0.52), the out-of-sample figure sits in
2017-21, and without Christmas T1 is t 1.74. This study is a calendar check, **not** a gate, entry, exit or size of any
gold-book system (owner item 44). Nothing live changes whatever the result.

## What cannot be independent, said first
R1 and R2 below read the same holidays and the same years as the original, on gold. XAU/EUR is gold divided by EUR/USD: on a
day gold rises in dollars it nearly always rises in euros. HistData XAU/USD is the same market from another feed. So a pass on
R1 or R2 shows the original's figure is not an artefact of one feed or of the dollar's own holiday moves; it is **not** new
evidence that the effect exists. The only independent test is R3: holidays that have not happened yet, judged later by a line
written here, with nothing computed now.

## The rule: the original's code, unchanged
`original.mjs` = the original's `run.mjs`, byte for byte (sha256
`8b5586c0302b99e8949ff1cde11be7345f541063f7e25d2df860d86463c62825`, pinned in the test). From it, imported and not edited:
`holidays` (NYSE full holidays from `ict/calendar.mjs` `cmeYear`), `buildDays` (17:00 New York days, `gold-drd-long` `nyDay`),
`atrBefore`, `trade` (long at the day's first H1 open, out at the last H1 close, stop 1.0 x ATR(14) of the days before the entry
day checked on H1, a gap fills at the open, 1R = that ATR, financing `nights` x `FIN.xau.long` x entry), `eventDays`, `st`,
`welch`, `pOne`, `holm`, `rng`, `summary`. T1 = `eventDays().pre1` open to close; T2 = `pre2` open to `pre1` close. T3 (the
mirror) is not re-run. The only things this study adds are the candle loaders, the cost per feed and the windows below.

## R1: gold priced in euros
- Data: OANDA mid M5 XAU/EUR, 18 Mar 2006 to Nov 2026 (a cache outside git, fetched through the site's candle proxy), grouped
  into H1 candles on UTC hour boundaries (OANDA's own H1 alignment), then 17:00 New York days by the original's `buildDays`.
- Holidays judged: 2007 to 31 Oct 2026. Halves: 2007-2016 and 2017 to Oct 2026 (the original's windows).
- Cost: 0.016 % of the entry price a round trip (spread + slippage, assumed: about gold's $0.60 at $3,750), passed to the
  original's `trade` as `cost` = 0.00016 x the entry day's open. Financing: the original's `FIN.xau.long` (0.000148 of price a
  rollover, the demo broker's XAU/USD rate of 11 Nov 2026, `council/fills.mjs`), assumed for XAU/EUR too (no XAU/EUR rate is
  measured in the repository). 2x costs = both doubled.
- Reported, not judged: the correlation (Pearson, per holiday) of R1's net R with the original's XAU/USD net R on the same
  holidays (the original's committed `result.json` trades), and the same for raw % moves.

## R2: a second XAU/USD feed
- Data: HistData XAU/USD M1 (bid), council-data `research/candles/xau-histdata/*.csv.gz` (read with `git show`, no network),
  every label converted to UTC by `council/histdata.mjs` `histStampUtc` only (no other conversion), a repeated converted
  minute dropped, grouped into H1 candles on UTC hour boundaries, then the original's `buildDays`. The files start in 2018.
- Holidays judged: those whose events have candles, 2018 to 31 Oct 2026 (the original's out-of-sample years only).
  Halves: 2018-2021 and 2022 to Oct 2026.
- Cost: the original's $0.60 an ounce a round trip and its financing.
- Reported, not judged: per-holiday agreement with the original's OANDA trades (sign and correlation of net R).

## Statistics and the bar (per test; four tests: R1-T1, R1-T2, R2-T1, R2-T2)
- t per event on the judged window (one observation a holiday, mean net R / (sd / sqrt n)), one-sided p (Student t, n − 1
  degrees of freedom), Holm over the four tests. Month-sum t reported beside it, not judged.
- **Pass (each test)**: whole-window net t >= 2 and Holm-adjusted one-sided p < 0.05; net mean positive in BOTH halves;
  whole-window net mean positive at 2x costs; whole-window net mean above at least 38 of 40 placebo means.
- **Placebo**: 40 seeds (1..40, the original's `rng`); each draws, per judged year, as many ordinary days as the test has
  events that year from ordinary trading days (not a holiday, not within the two trading days before or the day after one;
  T2: an ordinary day followed by an ordinary day at most 4 calendar days later), traded the same way.
- A trade is skipped (and counted) when its days have no candle or fewer than 14 earlier days exist for the ATR.
- **Verdict**: PASS only if at least one of the four tests meets every condition; the verdict line names which. Anything
  else is FAIL. Whatever the verdict, it is read under "What cannot be independent" above.

## R3: the forward check (nothing computed now)
The next twelve months of NYSE full holidays from `ict/calendar.mjs` `cmeYear` (15 Nov 2026 to 14 Nov 2027), with the same
exclusions as the original (3 July, the day after Thanksgiving and Christmas Eve are trading days):

| # | Holiday | Date |
|---|---|---|
| 1 | Thanksgiving Day | 2026-11-26 |
| 2 | Christmas Day | 2026-12-25 |
| 3 | New Year's Day | 2027-01-01 |
| 4 | Martin Luther King Day | 2027-01-18 |
| 5 | Presidents' Day | 2027-02-15 |
| 6 | Good Friday | 2027-03-26 |
| 7 | Memorial Day | 2027-05-31 |
| 8 | Juneteenth | 2027-06-18 |
| 9 | Independence Day | 2027-07-05 |
| 10 | Labor Day | 2027-09-06 |

Pass line for a future reader (fixed now): run the original's T1, unchanged (`original.mjs`, same sha256), on OANDA mid H1
XAU/USD for exactly these ten events, net of its costs: **T1 passes the forward check if its mean net R over the ten events
is above 0.** T2 is reported beside it, not judged. Ten events cannot give a t worth judging (a +0.133R mean with the
original's spread is about t 0.8); the line only asks whether the sign holds on data nobody had seen. A fail sends the
original's T1 back to "not shown"; a pass is one more year of the same sign, not a proven edge.
