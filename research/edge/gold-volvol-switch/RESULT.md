# Result: gold's volatility trend picks the trade, breakout or reversal (14 Nov 2026)

**Verdict: FAIL, 0 of 3: the ATR-trend switch (breakout / reversal) made -0.118R a trade net out of sample (n 226, month t -1.75), -0.060R in sample; 3 of 40 placebos.**

A stand-alone, two-sided daily rule of its own: no rule or position of the live gold book was read, tested or touched
(docs/owner-decisions.md item 44). Pre-registration: `PREREGISTRATION.md` (pushed alone before any figure). Code: `run.mjs`.
Every figure: `result.json`; this page is written by `run.mjs` from it. Nothing is an edge here; nothing live changed and no
proposal is written.

## Data and rule

Council-data `research/daily/xau.json` (OANDA mid spot gold, UTC daily candles, weekends folded into Monday with
`fills.mjs` `foldWeekend`), 2006-03-20 to 2026-11-06, 5364 trading days. Regime: rising = ATR(20) > ATR(20) 10 candles earlier (rising on
48.9 % of in-sample days, 46.2 % out of sample). Breakout: close beyond the 20-candle high / low; reversal: new 5-day closing low -> buy, high -> sell.
Entry at the next open, stop 2 x ATR(20) of the signal candle (a gap through it fills at the open), out after 10 trading days, one position at
a time per test, $0.60 a round trip and `FIN` financing (0.000148 of price a rollover) on buys; 2x costs = $1.20 and
twice the financing. Windows by signal month: in sample 2007-01 to 2016-12, out of sample 2017-01 to 2026-10. t on calendar-month sums,
one-sided, Holm over the three tests.

## The tests (R a trade)

| Test | Rule | Window | n | Net R | Month t | Gross R | Gross t | Win % | Stops | Total net R | Net at 2x | Median stop $ | Cost share | Financing R | Holm p | Placebo beaten | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | the switch: breakout when ATR rises, reversal when it falls | in sample | 226 | -0.060 | -0.96 | -0.016 | -0.26 | 46.02 | 78 | -13.46 | -0.103 | 35.76 | 1.7 % | 0.026 | | | |
| T1 | the switch: breakout when ATR rises, reversal when it falls | out of sample | 226 | -0.118 | -1.75 | -0.073 | -1.08 | 39.38 | 79 | -26.76 | -0.164 | 45.90 | 1.5 % | 0.031 | 1 | 3 | no |
| T2 | breakout leg alone (rising ATR) | in sample | 78 | +0.011 | 0.09 | +0.060 | 0.52 | 51.28 | 27 | +0.86 | -0.039 | 36.27 | 1.7 % | 0.032 | | | |
| T2 | breakout leg alone (rising ATR) | out of sample | 73 | +0.120 | 0.94 | +0.179 | 1.37 | 43.84 | 15 | +8.74 | +0.061 | 46.65 | 1.4 % | 0.045 | 0.5277 | 37 | no |
| T3 | reversal leg alone (falling ATR) | in sample | 175 | -0.145 | -2.16 | -0.102 | -1.53 | 40 | 66 | -25.35 | -0.187 | 35.44 | 1.7 % | 0.025 | | | |
| T3 | reversal leg alone (falling ATR) | out of sample | 172 | -0.151 | -2.00 | -0.111 | -1.46 | 38.95 | 63 | -26.05 | -0.192 | 45.37 | 1.5 % | 0.026 | 1 | 7 | no |

Signals skipped because the previous trade of the same test was still open: T1 1213, T2 201, T3 966; dropped because the exit is not on file yet: T1 1, T2 0, T3 1. Cost share = $0.60 / stop, the mean over trades; financing R = mean over all trades (sells pay none).

## Checks of each test (all must hold)

| Test | OOS net > 0 | OOS month t >= 2 | Holm p < 0.05 | in sample > 0 | > 0 at 2x costs | >= 38 of 40 placebos |
|---|---|---|---|---|---|---|
| T1 | no | no | no | no | no | no |
| T2 | yes | no | no | yes | yes | no |
| T3 | no | no | no | no | no | no |

## Placebo (40 seeded draws, out of sample)

Every candle's regime label replaced by a random one (rising with probability 0.476, the whole file's share), the same rule run.

| Test | Rule net R | Placebo mean | min | max | Seeds beaten |
|---|---|---|---|---|---|
| T1 | -0.118 | -0.052 | -0.157 | +0.053 | 3 of 40 |
| T2 | +0.120 | +0.042 | -0.099 | +0.130 | 37 of 40 |
| T3 | -0.151 | -0.097 | -0.186 | +0.006 | 7 of 40 |

## T1 inside: by leg and by side

| Window | Part | n | Net R | Month t | Gross R |
|---|---|---|---|---|---|
| in sample | breakout leg | 64 | +0.043 | 0.34 | +0.092 |
| in sample | reversal leg | 162 | -0.100 | -1.45 | -0.059 |
| in sample | buys | 105 | +0.002 | 0.02 | +0.075 |
| in sample | sells | 121 | -0.113 | -1.47 | -0.095 |
| out of sample | breakout leg | 62 | +0.005 | 0.04 | +0.063 |
| out of sample | reversal leg | 164 | -0.165 | -2.16 | -0.124 |
| out of sample | buys | 96 | +0.056 | 0.52 | +0.143 |
| out of sample | sells | 130 | -0.248 | -2.81 | -0.233 |

## Baselines (reported, not judged): the same trades without the regime, and the inverted switch

| Stream | Window | n | Net R | Month t | Gross R | Net at 2x |
|---|---|---|---|---|---|---|
| inverted switch (reversal when ATR rises, breakout when it falls) | in sample | 225 | +0.027 | 0.39 | +0.069 | -0.016 |
| inverted switch (reversal when ATR rises, breakout when it falls) | out of sample | 213 | -0.012 | -0.15 | +0.039 | -0.063 |
| every breakout signal, no regime | in sample | 136 | +0.036 | 0.43 | +0.088 | -0.015 |
| every breakout signal, no regime | out of sample | 133 | +0.063 | 0.63 | +0.125 | +0.001 |
| every reversal signal, no regime | in sample | 288 | -0.110 | -1.98 | -0.070 | -0.149 |
| every reversal signal, no regime | out of sample | 288 | -0.084 | -1.41 | -0.041 | -0.128 |

## T1 by year (net R a trade)

| Year | n | Net R |
|---|---|---|
| 2007 | 21 | -0.074 |
| 2008 | 24 | +0.250 |
| 2009 | 19 | +0.190 |
| 2010 | 22 | +0.109 |
| 2011 | 25 | -0.158 |
| 2012 | 24 | -0.344 |
| 2013 | 22 | -0.151 |
| 2014 | 24 | -0.337 |
| 2015 | 24 | +0.004 |
| 2016 | 21 | -0.019 |
| 2017 | 25 | -0.081 |
| 2018 | 20 | -0.088 |
| 2019 | 22 | +0.100 |
| 2020 | 25 | -0.542 |
| 2021 | 23 | +0.067 |
| 2022 | 23 | -0.359 |
| 2023 | 27 | -0.362 |
| 2024 | 22 | -0.091 |
| 2025 | 23 | +0.270 |
| 2026 | 16 | +0.041 |

## Reading

Not an edge. T1 fails out-of-sample net R > 0, out-of-sample month t >= 2, Holm p < 0.05, in-sample net R > 0, net R > 0 at 2x costs, 38 of 40 placebos. T2 and T3 fail too. The placebo (random regime labels on the same signals) made -0.052R a trade on average out of sample against the rule's -0.118R: whether the 20-day ATR is rising or falling does not pick the better of the two trades by more than chance. The reversal leg (T3) lost in both windows (month t -2.16 in sample, -2.00 out of sample, the wrong way for the rule), and every reversal signal without the regime lost too: over ten days gold did not give back a new 5-day closing extreme. The breakout leg (T2) fails out-of-sample month t >= 2, Holm p < 0.05, 38 of 40 placebos, and the same breakouts without the regime made +0.063R (month t 0.63) out of sample. No proposal; nothing live changed.

