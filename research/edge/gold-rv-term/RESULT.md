# Result: gold's realised-volatility term structure and its 60-day trend (14 Nov 2026)

**Verdict: FAIL, 0 of 2: the trend trade after a 5 / 60-day volatility compression beat the every-day trend trade by +0.060R out of sample (n 135, month t 0.76), +0.034R in sample.**

A stand-alone daily rule of its own: no rule or position of the live gold book was read, tested or touched
(docs/owner-decisions.md item 44). Pre-registration: `PREREGISTRATION.md` (pushed alone before any figure). Code: `run.mjs`.
Every figure: `result.json`; this page is written by `run.mjs` from it. Nothing is an edge here; nothing live changed and no
proposal is written.

## Data and rule

Council-data `research/daily/xau.json` (OANDA mid spot gold, UTC daily candles, weekends folded into the next weekday), 2006-03-20 to
2026-11-13, 5369 trading days. Ratio = sd of 5 / sd of 60 daily log close returns; side = sign(close - close 60 candles earlier). Entry at the next open, stop 2 x ATR(20) of the signal candle (a gap
through it fills at the open), out after 10 trading days, one position at a time per test, $0.60 a round trip and `FIN`
financing (0.000148 of price a rollover) on buys; 2x costs = $1.20 and twice the financing. Excess = net R minus the mean net R of
the every-day trend trade of the same side and signal year (overlapping, same rule). Windows by signal month: in sample 2007-01 to 2016-12
and out of sample 2017-01 to 2026-10. t on calendar-month sums of excess, one-sided, Holm over the two tests.

## The tests (R a trade)

| Test | Rule | Window | n | Excess net | Month t | Excess gross | Gross t | Net R | Net t | Gross R | Win % | Stops | Excess at 2x | Net at 2x | Median stop $ | Holm p | Placebo | Control | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | compression: RV5 / RV60 < 0.6, trade the 60-day trend | in sample | 154 | +0.034 | 0.42 | +0.036 | 0.44 | -0.025 | -0.29 | +0.024 | 42.86 | 55 | +0.032 | -0.074 | 36.64 | | | | |
| T1 | compression: RV5 / RV60 < 0.6, trade the 60-day trend | out of sample | 135 | +0.060 | 0.76 | +0.063 | 0.79 | +0.054 | 0.63 | +0.112 | 52.59 | 37 | +0.057 | -0.004 | 46.83 | 0.4496 | 31 of 40 | 36 of 40 | no |
| T2 | expansion: RV5 / RV60 > 1.2, trade the 60-day trend | in sample | 117 | +0.075 | 0.88 | +0.074 | 0.87 | +0.050 | 0.57 | +0.099 | 48.72 | 36 | +0.075 | +0.002 | 37.71 | | | | |
| T2 | expansion: RV5 / RV60 > 1.2, trade the 60-day trend | out of sample | 128 | -0.048 | -0.55 | -0.050 | -0.57 | +0.067 | 0.75 | +0.129 | 50 | 35 | -0.046 | +0.005 | 48.94 | 0.7097 | 18 of 40 | 7 of 40 | no |

Signals skipped because the previous trade of the same test was still open: T1 730, T2 772; dropped because the exit is not on file: T1 0, T2 0.

## The every-day baseline (overlapping, reference only)

| Window | Side | n | Net R | Gross R |
|---|---|---|---|---|
| in sample | buy | 1479 | +0.010 | +0.084 |
| in sample | sell | 1123 | -0.068 | -0.051 |
| out of sample | buy | 1674 | +0.143 | +0.226 |
| out of sample | sell | 878 | -0.117 | -0.101 |

## Checks (all must hold)

| Test | OOS excess > 0 | OOS month t >= 2 | Holm p < 0.05 | in sample > 0 | > 0 at 2x costs | >= 38 of 40 placebos | >= 38 of 40 controls |
|---|---|---|---|---|---|---|---|
| T1 | yes | no | no | yes | no | no | no |
| T2 | no | no | no | yes | no | no | no |

## Placebo and control (40 seeded draws each, out-of-sample mean excess)

Placebo: each out-of-sample rule trade replaced by the every-day trend trade of a random candle of the same year. Control: each
year's candles (relative moves) shuffled within the year, the path rebuilt and the whole rule run again: drift and volatility level kept,
the volatility clustering the ratio reads removed.

| Test | Rule excess | Placebo mean | min | max | beaten | Control mean | min | max | beaten |
|---|---|---|---|---|---|---|---|---|---|
| T1 | +0.060 | -0.011 | -0.195 | +0.130 | 31 | -0.008 | -0.124 | +0.081 | 36 |
| T2 | -0.048 | -0.023 | -0.162 | +0.212 | 18 | +0.007 | -0.232 | +0.136 | 7 |

## By side (reported, not judged)

| Test | Window | Side | n | Excess net | Month t | Net R |
|---|---|---|---|---|---|---|
| T1 | in sample | buy | 84 | -0.035 | -0.36 | -0.073 |
| T1 | in sample | sell | 70 | +0.116 | 0.86 | +0.033 |
| T1 | out of sample | buy | 81 | +0.005 | 0.05 | +0.129 |
| T1 | out of sample | sell | 54 | +0.141 | 1.27 | -0.059 |
| T2 | in sample | buy | 66 | +0.025 | 0.20 | +0.041 |
| T2 | in sample | sell | 51 | +0.139 | 1.13 | +0.063 |
| T2 | out of sample | buy | 92 | -0.061 | -0.57 | +0.103 |
| T2 | out of sample | sell | 36 | -0.013 | -0.10 | -0.024 |

## By year (excess net R a trade)

| Year | T1 n | T1 excess | T2 n | T2 excess |
|---|---|---|---|---|
| 2007 | 13 | -0.032 | 14 | -0.097 |
| 2008 | 20 | +0.067 | 15 | +0.042 |
| 2009 | 16 | -0.187 | 12 | +0.119 |
| 2010 | 15 | +0.260 | 11 | -0.157 |
| 2011 | 13 | -0.008 | 12 | -0.055 |
| 2012 | 17 | +0.092 | 6 | +0.746 |
| 2013 | 17 | +0.117 | 9 | +0.262 |
| 2014 | 14 | +0.040 | 17 | +0.076 |
| 2015 | 16 | +0.026 | 11 | +0.055 |
| 2016 | 13 | -0.084 | 10 | +0.171 |
| 2017 | 13 | +0.236 | 10 | -0.213 |
| 2018 | 15 | -0.134 | 14 | -0.007 |
| 2019 | 11 | +0.183 | 15 | -0.180 |
| 2020 | 18 | +0.282 | 12 | +0.188 |
| 2021 | 17 | -0.014 | 12 | -0.084 |
| 2022 | 11 | +0.306 | 17 | +0.106 |
| 2023 | 13 | -0.149 | 11 | +0.064 |
| 2024 | 12 | -0.089 | 13 | +0.072 |
| 2025 | 15 | +0.188 | 15 | -0.119 |
| 2026 | 10 | -0.304 | 9 | -0.457 |

## Reading

Not an edge. T1 fails: out-of-sample month t >= 2, Holm p < 0.05, excess and net R > 0 at 2x costs, 38 of 40 placebos, 38 of 40 shuffled-path controls. T2 fails: out-of-sample excess > 0, out-of-sample month t >= 2, Holm p < 0.05, excess and net R > 0 at 2x costs, 38 of 40 placebos, 38 of 40 shuffled-path controls. Against random days of the same year the compression trades' excess beat 31 of 40 draws, and against the shuffled paths 36 of 40. No proposal; nothing live changed.

