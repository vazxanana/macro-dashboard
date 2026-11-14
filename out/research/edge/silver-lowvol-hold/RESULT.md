# Result: silver bought in its quiet stretches, held wide (gold-lowvol-hold replicated, 14 Nov 2026)

**Verdict: FAIL, 0 of 3: silver bought on quiet days for 20 days vs every-day buys -0.081R a trade out of sample (n 911, month t -0.71), -0.083R in sample; 1 of 40 placebos.**

gold-lowvol-hold's rule (branch `gold-lowvol-hold`: gold OOS excess +0.152R, t 1.14, in sample -0.084R, FAIL) run unchanged
on silver; only the market and its cost change. A stand-alone daily rule: no rule or position of the live gold book was read, tested or touched
(docs/owner-decisions.md item 44). Pre-registration: `PREREGISTRATION.md` (pushed alone before any figure). Code: `run.mjs`.
Every figure: `result.json`; this page is written by `run.mjs` from it. Nothing is an edge here; nothing live changed and no
proposal is written.

## Data and rule

Council-data `research/daily/xag.json` (OANDA mid spot silver, UTC daily candles, weekends folded into Monday with
`fills.mjs` `foldWeekend`), 2006-03-20 to 2026-11-13, 5370 trading days; first day with a full year of volatility 2007-04-04.
rv20 = sd of 20 daily log returns; pct = share of the 252 previous rv20 below today's; quiet = pct < 1/3, loud = pct >= 2/3.
Days by entry month: in sample 2007-01 to 2016-12 2536 (949 quiet, 829 loud), out of sample
2017-01 to 2026-10 2552 (921 quiet, 895 loud). Buy at the day's close, every qualifying day a trade
(overlapping), stop 3 x ATR(20) (a gap through it fills at the open), $0.06 a round trip ($0.03 spread + $0.015 slippage
a side, as silver-rates-shrug); **no financing**: `council/fills.mjs` has no silver rate (gold's 0.000148 of price a rollover is
charged only in the sensitivity table below). 2x costs = $0.12. Excess = a trade's net R minus the mean net R of
the same trade entered on every trading day of its year. t on calendar-month sums of the excess, Newey-West (lag 1 for 20 days,
3 for 60), one-sided, Holm over the three tests.

## The tests (R a trade)

| Test | Rule | Window | n | Months | Net R | Net t | Every-day net R | Excess | Month t (NW) | Plain t | Gross excess | Gross t | Net at 2x | Excess at 2x | Stops | Holm p | Placebo beaten | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | buy on a quiet day (rv20 in the lowest third of the past year), out after 20 days | in sample | 949 | 78 | -0.035 | -0.24 | +0.038 | -0.083 | -0.63 | -0.71 | -0.078 | -0.59 | -0.082 | -0.089 | 363 | | | |
| T1 | buy on a quiet day (rv20 in the lowest third of the past year), out after 20 days | out of sample | 911 | 72 | -0.005 | -0.04 | +0.102 | -0.081 | -0.71 | -0.71 | -0.076 | -0.66 | -0.055 | -0.087 | 326 | 1 | 1 | no |
| T2 | buy on a quiet day, out after 60 days (the wide exit) | in sample | 949 | 78 | +0.297 | 0.71 | +0.183 | +0.051 | 0.16 | 0.22 | +0.057 | 0.17 | +0.249 | +0.046 | 532 | | | |
| T2 | buy on a quiet day, out after 60 days (the wide exit) | out of sample | 882 | 70 | +0.170 | 0.48 | +0.353 | -0.076 | -0.26 | -0.33 | -0.071 | -0.24 | +0.119 | -0.082 | 527 | 1 | 3 | no |
| T3 | buy on a loud day (rv20 in the top third), out after 20 days (contrast) | in sample | 829 | 66 | +0.056 | 0.56 | +0.038 | +0.049 | 0.50 | 0.56 | +0.043 | 0.43 | +0.025 | +0.055 | 181 | | | |
| T3 | buy on a loud day (rv20 in the top third), out after 20 days (contrast) | out of sample | 895 | 66 | +0.153 | 1.06 | +0.102 | +0.009 | 0.07 | 0.08 | +0.003 | 0.02 | +0.120 | +0.014 | 203 | 1 | 20 | no |

Nights held a trade (out of sample): T1 23.32, T2 51.63, T3 24.99. Dropped because the exit is not on file yet: T1 10, T2 39, T3 0.

## Checks of each test (all must hold)

| Test | OOS excess > 0, t >= 2 | Holm p < 0.05 | OOS net > 0 | in-sample excess > 0 | > 0 at 2x costs | >= 38 of 40 placebos |
|---|---|---|---|---|---|---|
| T1 | no | no | no | no | no | no |
| T2 | no | no | yes | yes | no | no |
| T3 | no | no | yes | yes | yes | no |

## Sensitivity: gold's financing rate per unit of price charged on silver (reported, not judged)

| Test | Window | n | Financing R a trade | Net R | Net t | Excess | Excess t (NW) | Net at 2x | Excess at 2x |
|---|---|---|---|---|---|---|---|---|---|
| T1 | in sample | 949 | +0.049 | -0.084 | -0.58 | -0.086 | -0.66 | -0.181 | -0.094 |
| T1 | out of sample | 911 | +0.059 | -0.064 | -0.48 | -0.086 | -0.75 | -0.174 | -0.096 |
| T2 | in sample | 949 | +0.108 | +0.188 | 0.46 | +0.049 | 0.15 | +0.033 | +0.041 |
| T2 | out of sample | 882 | +0.131 | +0.039 | 0.11 | -0.079 | -0.28 | -0.143 | -0.088 |
| T3 | in sample | 829 | +0.035 | +0.021 | 0.21 | +0.054 | 0.56 | -0.045 | +0.066 |
| T3 | out of sample | 895 | +0.042 | +0.111 | 0.77 | +0.015 | 0.12 | +0.035 | +0.027 |

## Placebo (40 seeded draws, out of sample)

Every out-of-sample rule trade replaced by the same buy entered on a random trading day of the same calendar year; statistic = mean excess.

| Test | Rule excess | Placebo mean | min | max | Seeds beaten |
|---|---|---|---|---|---|
| T1 | -0.081 | +0.003 | -0.087 | +0.095 | 1 of 40 |
| T2 | -0.076 | +0.016 | -0.098 | +0.135 | 3 of 40 |
| T3 | +0.009 | +0.004 | -0.079 | +0.086 | 20 of 40 |

## One position at a time (T1, reported, not judged)

| Window | n | Net R | Excess | Plain month t |
|---|---|---|---|---|
| in sample | 81 | -0.114 | -0.159 | -1.54 |
| out of sample | 77 | +0.115 | +0.085 | 0.55 |

## T1 by year (net R a trade)

| Year | n | Quiet-day buys | Every-day buys | Excess |
|---|---|---|---|---|
| 2007 | 104 | -0.356 | +0.091 | -0.446 |
| 2008 | 11 | -0.672 | -0.046 | -0.627 |
| 2009 | 142 | +0.319 | +0.254 | +0.064 |
| 2010 | 139 | +0.658 | +0.452 | +0.207 |
| 2011 | 23 | -0.683 | +0.243 | -0.926 |
| 2012 | 191 | +0.035 | +0.060 | -0.025 |
| 2013 | 69 | -0.864 | -0.348 | -0.516 |
| 2014 | 155 | -0.143 | -0.291 | +0.149 |
| 2015 | 74 | -0.517 | -0.264 | -0.253 |
| 2016 | 41 | +0.084 | +0.232 | -0.148 |
| 2017 | 160 | -0.081 | -0.089 | +0.008 |
| 2018 | 98 | -0.297 | -0.248 | -0.049 |
| 2019 | 72 | -0.057 | +0.170 | -0.227 |
| 2020 | 11 | +3.167 | +0.468 | +2.699 |
| 2021 | 179 | -0.242 | -0.155 | -0.086 |
| 2022 | 30 | -0.398 | -0.021 | -0.378 |
| 2023 | 135 | -0.334 | -0.154 | -0.180 |
| 2024 | 42 | +0.001 | +0.238 | -0.237 |
| 2025 | 140 | +0.891 | +1.024 | -0.133 |
| 2026 | 44 | -0.400 | -0.301 | -0.099 |

## Reading

Not an edge. T1 fails: out-of-sample excess > 0 with month t >= 2; Holm p < 0.05; out-of-sample net R > 0; in-sample excess > 0; net R and excess > 0 at 2x costs; 38 of 40 placebos. T2 and T3 fail too. On silver, as on gold, a quiet stretch picks no better moment to buy than any other day of the same year once the year's drift is taken out. No proposal; nothing live changed.

