# Result: spot gold after a range-expansion day (14 Nov 2026)

**Verdict: FAIL, 0 of 3: buying or selling with a wide gold day's close for 5 days made +0.074R a trade net out of sample (n 102, month t 0.91), +0.250R in sample; 8 of 40 placebos.**

A stand-alone daily rule of its own: no rule or position of the live gold book was read, tested or touched
(docs/owner-decisions.md item 44). Pre-registration: `PREREGISTRATION.md` (pushed alone before any figure). Code: `run.mjs`.
Every figure: `result.json`; this page is written by `run.mjs` from it. Nothing is an edge here; nothing live changed and no
proposal is written.

## Data and rule

Council-data `research/daily/xau.json` (OANDA mid spot gold, UTC daily candles, weekends folded into Monday with
`fills.mjs` `foldWeekend`), 2006-03-20 to 2026-11-06, 5364 trading days. Event day D: range >= 1.75 x ATR(20) of the 20 candles before, close in the outer quarter (CL >= 0.75 up, <= 0.25 down).
Event days by entry month: in sample 2007-01 to 2016-12 143 (66 up, 77 down), out of sample
2017-01 to 2026-10 130 (67 up, 63 down). Entry at D's close, one position at a time per test, stop
2 x ATR(20) (a gap through it fills at the open), $0.60 a round trip and `FIN` financing (0.000148 of price a
rollover) on buys; 2x costs = $1.20 and twice the financing. t on calendar-month sums, one-sided, Holm over the three tests.

## The tests (net of costs, R a trade)

| Test | Rule | Window | n | Net R | Month t | Gross R | Gross t | Win % | Stops | Total R | Net at 2x | Holm p | Placebo beaten | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | continuation: with the close, D close -> D+5 close | in sample | 111 | +0.250 | 3.14 | +0.284 | 3.53 | 61.26 | 10 | +27.79 | +0.216 | | | |
| T1 | continuation: with the close, D close -> D+5 close | out of sample | 102 | +0.074 | 0.91 | +0.108 | 1.33 | 50.98 | 20 | +7.54 | +0.040 | 0.5469 | 8 | no |
| T2 | fade: against the close, D close -> D+1 close | in sample | 143 | -0.089 | -2.97 | -0.069 | -2.32 | 41.26 | 6 | -12.72 | -0.109 | | | |
| T2 | fade: against the close, D close -> D+1 close | out of sample | 130 | -0.034 | -0.86 | -0.016 | -0.40 | 47.69 | 8 | -4.36 | -0.052 | 1 | 25 | no |
| T3 | continuation: with the close, D close -> D+20 close | in sample | 75 | +0.264 | 1.68 | +0.341 | 2.13 | 48 | 24 | +19.78 | +0.187 | | | |
| T3 | continuation: with the close, D close -> D+20 close | out of sample | 78 | -0.006 | -0.04 | +0.074 | 0.47 | 39.74 | 40 | -0.48 | -0.086 | 1 | 0 | no |

Events skipped because the previous trade of the same test was still open: T1 60, T2 0, T3 119; dropped because the exit is not on file yet: T1 0, T2 0, T3 1.

## Checks of each test (all must hold)

| Test | OOS net > 0 | OOS month t >= 2 | Holm p < 0.05 | in sample > 0 | > 0 at 2x costs | >= 38 of 40 placebos |
|---|---|---|---|---|---|---|
| T1 | yes | no | no | yes | yes | no |
| T2 | no | no | no | no | no | no |
| T3 | no | no | no | yes | no | no |

## Placebo (40 seeded draws, out of sample)

Every out-of-sample trade replaced by one of the same side and hold entered on a random other day of the same calendar month.

| Test | Rule net R | Placebo mean | min | max | Seeds beaten |
|---|---|---|---|---|---|
| T1 | +0.074 | +0.141 | -0.030 | +0.371 | 8 of 40 |
| T2 | -0.034 | -0.053 | -0.144 | +0.035 | 25 of 40 |
| T3 | -0.006 | +0.367 | +0.082 | +0.586 | 0 of 40 |

## The opposite side (reported, not judged)

| Test | Window | n | Net R | Month t |
|---|---|---|---|---|
| T1 reversed | in sample | 116 | -0.253 | -4.27 |
| T1 reversed | out of sample | 104 | -0.175 | -1.98 |
| T2 reversed | in sample | 143 | +0.049 | 1.44 |
| T2 reversed | out of sample | 130 | -0.036 | -1.03 |
| T3 reversed | in sample | 95 | -0.362 | -3.53 |
| T3 reversed | out of sample | 86 | -0.272 | -1.84 |

## T1 by year (net R a trade)

| Year | n | Net R |
|---|---|---|
| 2007 | 12 | +0.279 |
| 2008 | 11 | +0.446 |
| 2009 | 11 | +0.213 |
| 2010 | 13 | +0.252 |
| 2011 | 10 | +0.041 |
| 2012 | 9 | +0.184 |
| 2013 | 16 | +0.236 |
| 2014 | 12 | -0.032 |
| 2015 | 8 | +0.438 |
| 2016 | 9 | +0.551 |
| 2017 | 5 | +0.329 |
| 2018 | 14 | -0.173 |
| 2019 | 11 | +0.007 |
| 2020 | 9 | -0.401 |
| 2021 | 8 | -0.056 |
| 2022 | 14 | +0.364 |
| 2023 | 11 | +0.357 |
| 2024 | 10 | +0.066 |
| 2025 | 12 | +0.020 |
| 2026 | 8 | +0.295 |

## Reading

Not an edge. T1 fails out-of-sample month t >= 2, Holm p < 0.05, 38 of 40 placebos. T2 and T3 fail too. The placebo says why the in-sample figure misleads: a trade of the same side entered on a random other day of the same month made +0.141R on average out of sample, more than the rule's +0.074R, so the wide day picks no better moment than any other day of the same month to trade that way (the placebo knows the month, so it is a hard comparison, as pre-registered). No proposal; nothing live changed.

