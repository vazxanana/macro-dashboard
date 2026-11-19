# Result: spot gold's first week follows the previous month (14 Nov 2026)

**Verdict: FAIL, 0 of 3: following last month's sign over gold's first 5 days beat the same-year same-side trade by +0.006R out of sample (n 118, month t 0.07), -0.102R in sample; 22 of 40 placebos.**

A calendar study of its own: no rule or position of the live gold book was read, tested or touched (the reading is in the
pre-registration). Pre-registration: `PREREGISTRATION.md` (pushed alone before any figure, commit `eaf057915`). Code:
`run.mjs`. Every figure: `result.json`. Nothing is an edge here; nothing live changed and no proposal is written.

Data: council-data `research/daily/xau.json` (OANDA mid spot gold, UTC daily candles, weekends folded into Monday with
`fills.mjs` `foldWeekend`), 20 Mar 2006 to 13 Nov 2026 (5,369 candles), read with `git show` (no cache written). Events by
entry month (the month's last trading day, TD-1): in sample 2007-01 to 2016-12 (120), out of sample 2017-01 to 2026-10
(118); none dropped. Side = sign of the calendar month's close-to-close return up to TD-1. Every trade enters and exits at
a daily close, stop 2 x ATR(20), $0.60 a round trip, financing on buys only (`FIN.xau.long`, 0.0148 % of price a rollover).
Excess = net R minus the mean net R of the same-side trade of the same hold entered on every candle of the same calendar
year (the baseline).

## The three tests (R a trade; t on calendar-month sums; one-sided p for excess > 0)

| Test | Window | n | excess R | t excess | net R | t net | gross R | t gross | baseline | excess at 2x costs | win % | stops | buys / sells | opposite side excess (t) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 (primary): TD-1 close to TD+5 close | 2017-26 | 118 | +0.006 | 0.07 | +0.026 | 0.32 | +0.062 | 0.75 | +0.021 | +0.005 | 47.46 | 26 | 66 / 52 | +0.038 (0.56) |
| T1 | 2007-16 | 120 | -0.102 | -1.65 | -0.106 | -1.64 | -0.072 | -1.11 | -0.004 | -0.102 | 42.50 | 27 | 63 / 57 | +0.062 (0.94) |
| T2: TD-1 close to TD+3 close | 2017-26 | 118 | +0.043 | 0.75 | +0.048 | 0.83 | +0.078 | 1.32 | +0.006 | +0.041 | 54.24 | 10 | 66 / 52 | -0.048 (-0.92) |
| T2 | 2007-16 | 120 | -0.092 | -1.74 | -0.098 | -1.83 | -0.069 | -1.28 | -0.006 | -0.094 | 45.00 | 15 | 63 / 57 | +0.092 (1.61) |
| T3: TD-1 close to TD+10 close | 2017-26 | 118 | -0.023 | -0.25 | +0.025 | 0.26 | +0.077 | 0.78 | +0.048 | -0.021 | 50.00 | 39 | 66 / 52 | -0.050 (-0.62) |
| T3 | 2007-16 | 120 | -0.054 | -0.55 | -0.047 | -0.46 | +0.000 | 0.00 | +0.007 | -0.053 | 40.83 | 44 | 63 / 57 | +0.186 (2.02) |

| Test | one-sided p (2017-26) | Holm p | Placebo seeds beaten (38 of 40 needed) | Placebo mean / max | Checks missed |
|---|---|---|---|---|---|
| T1 | 0.4728 | 0.9456 | 22 | -0.012 / +0.115 | oosT2, holm, isSameSign, placebo |
| T2 | 0.2276 | 0.6828 | 31 | -0.007 / +0.083 | oosT2, holm, isSameSign, placebo |
| T3 | 0.5987 | 0.9456 | 15 | +0.003 / +0.180 | oosExcessPos, oosT2, holm, isSameSign, cost2x, placebo |

The placebo puts each out-of-sample event on a random other candle of the same calendar month, side = sign of the
21-candle return up to it (the same "last month's direction" rule without the turn of the month), same hold, excess against
the same baseline.

## Reading

- **No test passes; the primary is noise.** Out of sample the first five days in last month's direction made +0.006R a
  trade more than the same-side trade on any day of the year (t 0.07); in sample they made -0.102R less (t -1.65). The same
  rule on a random day of the same month does as well (22 of 40 seeds below it).
- **Buys and sells apart (T1, not gating)**: after an up month the buy made +0.143R net (n 66, t 1.10) out of sample, but
  only +0.047R over the year's buy baseline (t 0.37): that is gold's rise in 2017-26, not the turn of the month. After a down
  month the sell lost -0.122R net (n 52) out of sample and -0.234R (n 57, t -2.89) in sample: fading a down month at the turn
  looked better in sample (T3's opposite side +0.186R, t 2.02, in sample) and is gone out of sample (-0.050R, t -0.62). That
  is a reading after the fact, not a finding.
- By year (T1 excess): positive in 7 of 20 years; the largest are 2019 (+0.497R) and 2012 (+0.231R), the worst 2015
  (-0.407R) and 2020 (-0.397R).
- With `gold-turn-of-month` (fixed long windows, FAIL) and the month-end fades (`gold-quarter-end`, `gold-rebalance-flow`,
  FAIL), the turn of the month on gold has now been read three ways on daily candles; none holds after costs.

Not done: an intraday entry (the first London or New York hour of the month), other metals, a size or gate on anything
live. A further test of this calendar on gold would need its own pre-registration and should expect the same answer.
