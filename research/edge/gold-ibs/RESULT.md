# Result: the internal bar strength (IBS) daily reversal on spot gold (14 Nov 2026)

**Verdict: FAIL.** 0 of 3 tests pass: buying gold after a close in the bottom 20 % of its day made +0.004R a trade net in 2017-26 (n 353, month t 0.18) and -0.034R in 2008-16; the short and the trend version fail too.

Pre-registered in PREREGISTRATION.md (pushed alone first, commit d6e5e5bf7). Paper research: nothing live changed and no
proposal follows. **Item 44**: a new stand-alone daily rule judged on 2017-26; it is not a gate, exit, entry or size of the gold
book (Gold trend / Gold daily engulf) and says nothing about it.

Rule: IBS = (close - low) / (high - low) of a 17:00 New York trading day built from OANDA mid H1 XAU_USD (`fetch.mjs`,
2006-03-20 to 2026-11-12, 5,351 days; `gold-drd-long` `days()`). Entry at the next day's first H1 open, stop 2 x ATR(20) of the
20 days ending at the signal day (checked on H1, a gap fills at the open), exit at the first close whose IBS crosses 0.5, else the
fifth day's close; one position at a time. Costs: $0.30 spread + $0.15 slippage on each of the two market orders ($0.60 a round
trip) and `council/fills.mjs` `FIN.xau.long` (0.000148 of price a 22:00 UTC rollover, Wednesday three) on longs; shorts pay and
earn nothing. t = calendar-month sums of net R (every month counts, 0 when nothing closed), Holm over three.

## Tests

| Test | Window | n | Gross R | Net R | Net R at 2x costs | Cost R | Financing R | Win % | Stops | Avg days held | Month t (net) | Month t (gross) | Worst drawdown R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 long, IBS < 0.2 (primary) | 2017-2026 | 353 | 0.024 | 0.004 | -0.016 | 0.014 | 0.006 | 60.91 | 25 | 1.71 | 0.18 | 1.06 | -8.12 |
| T1 long, IBS < 0.2 (primary) | 2008-2016 | 310 | -0.01 | -0.034 | -0.057 | 0.015 | 0.008 | 55.81 | 28 | 1.71 | -1.17 | -0.36 | -13.19 |
| T2 short, IBS > 0.8 | 2017-2026 | 442 | -0.063 | -0.077 | -0.091 | 0.014 | 0 | 50 | 54 | 1.89 | -3.2 | -2.64 | -42.76 |
| T2 short, IBS > 0.8 | 2008-2016 | 362 | -0.061 | -0.076 | -0.091 | 0.015 | 0 | 54.42 | 39 | 1.91 | -3.26 | -2.64 | -28.26 |
| T3 long, IBS < 0.2, close above SMA200 | 2017-2026 | 231 | 0.026 | 0.008 | -0.011 | 0.013 | 0.005 | 60.61 | 13 | 1.68 | 0.28 | 0.96 | -6.04 |
| T3 long, IBS < 0.2, close above SMA200 | 2008-2016 | 173 | -0.014 | -0.037 | -0.06 | 0.015 | 0.008 | 53.18 | 15 | 1.68 | -1.01 | -0.38 | -9.58 |

2017-2026 = out of sample (decisive, entries 2017-01-01 to 2026-10-31, 118 months); 2008-2016 = in sample (108 months).

## Checks (all five needed per test)

| Test | OOS n >= 100 | OOS net > 0, t >= 2, Holm p < 0.05 | In-sample net > 0 | OOS net > 0 at 2x costs | Beats >= 38 of 40 placebo means | One-sided p | Holm p | Pass |
|---|---|---|---|---|---|---|---|---|
| T1 | yes | no | no | no | no (13) | 0.4286 | 1 | fail |
| T2 | yes | no | no | no | no (7) | 0.9993 | 1 | fail |
| T3 | yes | no | no | no | no (12) | 0.3897 | 1 | fail |

## Placebo (each OOS trade moved to a random trading day of the same year, same side, same days held, same stop and costs; 40 seeds)

| Test | Rule net R | Seeds beaten | 5th pct | Median | 95th pct | Seed mean |
|---|---|---|---|---|---|---|
| T1 | +0.004 | 13 / 40 | -0.030 | +0.011 | +0.052 | +0.012 |
| T2 | -0.077 | 7 / 40 | -0.092 | -0.060 | -0.027 | -0.057 |
| T3 | +0.008 | 12 / 40 | -0.024 | +0.030 | +0.074 | +0.028 |

Buying gold after a low close did no better than buying it on a random day of the same year for the same number of days.

## Before costs: the next day's close-to-close return (% a day), deciding nothing

| Window | After IBS < 0.2 | After IBS > 0.8 | Every day |
|---|---|---|---|
| 2008-2016 | -0.095 (n 382) | +0.107 (n 516) | +0.021 (n 2338) |
| 2017-2026 | +0.083 (n 452) | +0.093 (n 611) | +0.053 (n 2537) |

## By year (net R a trade, n; by entry year, 2026 runs to 12 Nov)

| Year | T1 | T2 | T3 |
|---|---|---|---|
| 2008 | -0.154 (33) | -0.123 (43) | -0.151 (19) |
| 2009 | +0.015 (38) | -0.161 (39) | +0.017 (37) |
| 2010 | +0.094 (35) | -0.102 (45) | +0.094 (35) |
| 2011 | -0.272 (26) | -0.070 (54) | -0.242 (25) |
| 2012 | +0.007 (27) | -0.076 (44) | -0.089 (15) |
| 2013 | -0.088 (39) | +0.018 (44) | -0.267 (3) |
| 2014 | +0.049 (36) | +0.033 (34) | -0.165 (8) |
| 2015 | -0.022 (36) | -0.075 (25) | +0.376 (2) |
| 2016 | +0.004 (40) | -0.128 (34) | +0.046 (29) |
| 2017 | +0.016 (36) | +0.040 (54) | +0.069 (19) |
| 2018 | -0.005 (37) | -0.001 (36) | -0.048 (13) |
| 2019 | +0.021 (36) | -0.133 (45) | +0.021 (36) |
| 2020 | +0.063 (34) | -0.267 (45) | +0.062 (33) |
| 2021 | -0.048 (38) | -0.019 (45) | -0.036 (10) |
| 2022 | -0.006 (43) | -0.046 (39) | -0.150 (16) |
| 2023 | -0.089 (40) | -0.117 (41) | -0.061 (35) |
| 2024 | +0.050 (31) | -0.097 (46) | +0.050 (31) |
| 2025 | +0.112 (23) | -0.176 (52) | +0.112 (23) |
| 2026 | -0.001 (36) | +0.069 (40) | -0.060 (15) |

## What this does and does not say

- **No test passed (0 of 3).** The primary long is flat after costs out of sample (+0.004R, t 0.18) and lost in sample
  (-0.034R, t -1.17); it does not beat random days of the same year (13 of 40 seeds). Requiring the close above its 200-day
  average (T3) changes nothing (+0.008R, t 0.28; in sample -0.037R).
- **Gold has no IBS reversal of the index kind.** On the indices (`index-ibs`) the day after a low close rose more than the
  average day in every window. On gold in 2008-16 it fell (-0.095 % against +0.021 % for every day) and in 2017-26 it rose about
  as much as after a HIGH close (+0.083 % against +0.093 %): no close-location effect in either window.
- **The short loses in both windows** (about -0.077R a trade, month t near -3.2, gross t -2.6): a strong close on gold is not
  followed by a fall within a day or two. Read the other way this looks like continuation, but that reading was not
  pre-registered and a high-close long is what `gold-drd-long` (FAIL out of its own sample) already tested: no claim is made.
- Costs are small here (0.014R a round trip plus 0.006R financing, because the stop is 2 x ATR), so costs are not why it fails:
  the gross figures are already near zero or negative.
- Limits, fixed before the results: one threshold pair (0.2 / 0.8), one exit (IBS crosses 0.5, at most five days), one stop
  (2 x ATR(20)), spot gold only. `nights` counts a fixed 22:00 UTC rollover, so a one-day hold pays a night in New York summer
  and none in winter. Other thresholds, holds or silver would need their own pre-registration on other data.

## To repeat
`node --use-env-proxy research/edge/gold-ibs/fetch.mjs <dir>` (OANDA H1 gold, keep out of git), then
`node research/edge/gold-ibs/run.mjs <dir>`. Test: `tests/gold-ibs.test.mjs`.
