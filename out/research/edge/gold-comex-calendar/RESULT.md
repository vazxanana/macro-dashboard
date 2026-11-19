# Result: spot gold around the COMEX gold calendar, options expiry and first notice (14 Nov 2026)

**Verdict: FAIL: shorting gold into options expiry lost -0.130R a trade net out of sample (n 118, month t -2.13), -0.014R in sample; 0 of 3 tests pass.**

A calendar study of its own: no rule of the live gold book was read, tested or touched (docs/owner-decisions.md item 44).
Pre-registration: `PREREGISTRATION.md` (pushed alone before any figure, commit `a795a46a7`). Calendar: `dates.mjs`. Code:
`run.mjs`. Every figure: `result.json`. Nothing is an edge here; nothing live changed and no proposal is written.

Data: council-data `research/daily/xau.json` (OANDA mid spot gold, UTC daily candles, weekends folded into Monday with
`fills.mjs` `foldWeekend`), 20 Mar 2006 to 6 Nov 2026. Events by entry month: in sample 2008-01 to 2016-12, out of sample
2017-01 to 2026-10; no event was dropped for a missing candle. Each trade enters and exits at a daily close, stop 2 x ATR(20),
costs $0.60 a round trip (the $0.30 gold spread plus half a spread of slippage on each market order), financing on longs only
(`FIN.xau.long`, 0.0148 % of price a rollover).

## The three tests (net R a trade; t on calendar-month sums; one-sided p in the lore's sign)

| Test | Side (lore) | Window | n | net R | t net | gross R | t gross | net at 2x costs | win % | stops | opposite side net (t) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 (primary): 5 business days into options expiry | short | 2017-26 | 118 | -0.130 | -2.13 | -0.116 | -1.91 | -0.144 | 44.07 | 23 | +0.081 (1.13) |
| T1 | short | 2008-16 | 108 | -0.014 | -0.21 | +0.001 | 0.02 | -0.030 | 50.93 | 19 | -0.148 (-2.16) |
| T2: expiry day to 5 business days after ("release") | long | 2017-26 | 118 | +0.050 | 0.67 | +0.104 | 1.39 | -0.005 | 53.39 | 21 | -0.101 (-1.53) |
| T2 | long | 2008-16 | 108 | -0.033 | -0.50 | +0.016 | 0.25 | -0.083 | 47.22 | 13 | -0.011 (-0.17) |
| T3: 5 business days into first notice (active months) | short | 2017-26 | 59 | -0.044 | -0.47 | -0.030 | -0.32 | -0.058 | 47.46 | 7 | +0.003 (0.04) |
| T3 | short | 2008-16 | 54 | +0.005 | 0.06 | +0.020 | 0.25 | -0.011 | 51.85 | 5 | -0.115 (-1.34) |

| Test | Holm p (out of sample) | Placebo seeds beaten (38 of 40 needed) | Placebo mean / max | Pass |
|---|---|---|---|---|
| T1 | 1.00 | 16 | -0.108 / +0.007 | no |
| T2 | 0.7551 | 11 | +0.070 / +0.195 | no |
| T3 | 1.00 | 29 | -0.096 / +0.089 | no |

Every test misses its bar: T1 and T3 lose out of sample in the lore's direction; T2 makes +0.050R a trade out of sample (t 0.67),
is negative at 2x costs and in sample, and beats only 11 of 40 random windows of the same months.

## Against the other windows (reported, not gating; gross log return, basis points, long sign)

| Test | Window | event windows | other windows | event bp | other bp | difference (Welch t) |
|---|---|---|---|---|---|---|
| T1 | 2017-26 | 118 | 2,355 | +29.32 | +24.71 | +4.61 (0.21) |
| T1 | 2008-16 | 108 | 2,161 | -7.70 | +7.43 | -15.12 (-0.57) |
| T2 | 2017-26 | 118 | 2,355 | +27.76 | +24.79 | +2.97 (0.15) |
| T2 | 2008-16 | 108 | 2,161 | -5.31 | +7.31 | -12.62 (-0.53) |
| T3 | 2017-26 | 59 | 1,176 | +5.07 | +27.80 | -22.73 (-0.88) |
| T3 | 2008-16 | 54 | 1,070 | +7.41 | -0.64 | +8.05 (0.26) |

T3 control (the same window into the month's last business day, active vs inactive months): 2017-26 active +5.07 bp vs inactive
-36.79 bp (difference +41.86, t 1.24, the wrong way for the lore); 2008-16 +7.41 vs +50.43 (-43.01, t -0.95). The sign flips
between windows: noise.

Reading: the five days into options expiry are no weaker than any other five days of the month (out of sample they rose a little
more), so a short there pays gold's 2017-26 uptrend; the "release" and the first-notice dip are not there either. In sample the
same windows lean the other way. No pinning-then-release pattern and no long-liquidation dip shows in spot gold's daily closes.

## The calendar, and what was not verified

`dates.mjs`: business days = weekdays outside the US exchange holidays of `council/datacheck.mjs` `usHolidays` (read only; full
closures plus the federal holidays among its early closes; the day after Thanksgiving and 24 December stay business days;
Juneteenth from 2022; a Saturday New Year not moved to 31 December). Options expiry = the 4th last business day of the month
before the option month, moved one business day earlier when that day is a Friday or the day before a holiday; first notice =
the last business day of the month before an active delivery month (Feb, Apr, Jun, Aug, Oct, Dec).

Checked by hand from the rule (the test pins them): options expiry 25 Nov 2024 (Thanksgiving 28 Nov), 26 Mar 2025, 24 Nov 2025,
25 Mar 2024 and 28 Mar 2016 (Good Friday weeks), 24 Sep 2026 (the Friday clause: the 4th last business day is Friday 25 Sep), 28 Dec 2021 (Christmas observed Friday 24 Dec); first notice 29 Nov 2024,
31 Jan 2025, 31 Mar 2016, 31 Dec 2025. **Not verified**: CME's published expiry calendar (cmegroup.com is not reachable from
the build sandbox), whether the Friday / pre-holiday clause applied in every year since 2008 (if it did not, some expiries move
one business day, inside a five-day window), and one-off closures (2007 Ford funeral, Hurricane Sandy 2012, 2018 Bush funeral),
which are not in the holiday list. Spot gold daily closes stand in for the futures; the study measures spot.

To repeat: `node research/edge/gold-comex-calendar/run.mjs` (reads council-data with `git show`, no network, writes no cache).
Tests: `tests/gold-comex-calendar.test.mjs`.
