# Result: gold's daily three-candle gap, traded on its first retest (14 Nov 2026)

**Verdict: FAIL, 1 of 4 checks: buying or selling gold's first retest of a daily three-candle gap made +0.076R a trade net in 2017-26 (n 212, month t 0.97); in sample -0.050R (n 216, t -0.57).**

Pre-registered in `PREREGISTRATION.md` (pushed alone, before `run.mjs` existed). Paper research only; a stand-alone daily rule,
never a gate, exit, entry or size of the live gold book (Gold trend / Gold daily engulf), and none of that book's 2006-17
positions was read (item 44). Nothing live changed and no proposal follows. Not the ICT desk's rule; ICT is untouched.

Rule: OANDA mid H1 XAU_USD (2006-03-19 to 2026-11-13, 125,704 candles) grouped into 17:00 New York days
(`gold-drd-long` `days()`). A day whose low is above the high of two days earlier by at least 0.25 x ATR14 leaves a bullish gap
(a sell gap the mirror). The first H1 touch of the gap's near edge within 20 days fills a limit there (or the open beyond it);
stop 0.5 x ATR14 past the gap's far edge, target 2R, out at the close of the 10th day after the fill; trades risking under $10
are not taken. One position at a time. Net of $0.60 a round trip and, on buys, `nights` x `FIN.xau.long` (0.000148 of price a
rollover). t on calendar-month sums of net R by exit month; Holm over three; placebo of 40 seeded draws (seed 20261114).

Gaps found: 426 bullish, 295 bearish; 585 retested and traded as candidates, 0 opened past the stop on
the retest (no trade), 33 skipped for a risk under $10, the rest untouched within 20 days or at the data's end.

## Tests

| Test | Window | n (buy / sell) | Gross R | Net R | Net R at 2x costs | Spread R | Financing R | Cost share | Win % | Stop / target / time | Median stop $ | Median hold days | Month t (net) | Month t (gross) | Worst drawdown R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 both sides (primary) | 2007-16 | 216 (114 / 102) | 0.000 | -0.050 | -0.101 | 0.029 | 0.021 | 114.36 | 36.6 | 125 / 56 / 35 | 21.2 | 5.3 | -0.57 | 0.01 | -18.2 |
| T1 both sides (primary) | 2017-26 | 212 (129 / 83) | +0.139 | +0.076 | +0.012 | 0.024 | 0.039 | 0.46 | 42.9 | 109 / 58 / 45 | 27.2 | 6 | 0.97 | 1.76 | -14.2 |
| T2 buys only | 2007-16 | 132 (132 / 0) | +0.027 | -0.043 | -0.113 | 0.030 | 0.040 | 2.61 | 37.9 | 78 / 38 / 16 | 20.96 | 3.9 | -0.40 | 0.25 | -21.0 |
| T2 buys only | 2017-26 | 139 (139 / 0) | +0.234 | +0.148 | +0.061 | 0.024 | 0.063 | 0.37 | 45.3 | 71 / 44 / 24 | 27.57 | 5.1 | 1.28 | 1.99 | -16.9 |
| T3 sells only | 2007-16 | 113 (0 / 113) | -0.113 | -0.142 | -0.172 | 0.029 | 0.000 | n/a | 31 | 69 / 25 / 19 | 20.87 | 6.3 | -1.21 | -0.96 | -25.8 |
| T3 sells only | 2017-26 | 91 (0 / 91) | -0.067 | -0.091 | -0.115 | 0.024 | 0.000 | n/a | 37.4 | 50 / 17 / 24 | 27.42 | 7.3 | -0.83 | -0.61 | -12.3 |
| Baseline: buy every day at market, stop 1 ATR | 2007-16 | 525 (525 / 0) | +0.095 | +0.003 | -0.088 | 0.033 | 0.058 | 0.96 | 38.5 | 309 / 162 / 54 | 19.04 | 4.8 | 0.05 | 1.50 | -48.9 |
| Baseline: buy every day at market, stop 1 ATR | 2017-26 | 512 (512 / 0) | +0.198 | +0.107 | +0.016 | 0.028 | 0.063 | 0.46 | 42.6 | 278 / 173 / 61 | 23.99 | 4.6 | 1.67 | 3.07 | -25.0 |
| Baseline: sell every day at market, stop 1 ATR | 2007-16 | 529 (0 / 529) | -0.049 | -0.083 | -0.117 | 0.034 | 0.000 | n/a | 33.5 | 337 / 144 / 48 | 18.2 | 5 | -1.44 | -0.86 | -76.0 |
| Baseline: sell every day at market, stop 1 ATR | 2017-26 | 544 (0 / 544) | -0.188 | -0.215 | -0.242 | 0.027 | 0.000 | n/a | 29.4 | 363 / 121 / 60 | 24.37 | 4.3 | -3.53 | -3.10 | -129.9 |

Out-of-sample p (two-sided, normal) / Holm-adjusted: T1 0.33 / 0.66, T2 0.20 / 0.60, T3 0.41 / 0.66.
Cost share = (spread R + financing R) a trade / gross R a trade (n/a when gross is not positive).

## Against the same-side baseline

| Side | Window | Rule net R | Baseline net R | Difference |
|---|---|---|---|---|
| buy | 2007-16 | -0.043 | +0.003 | -0.046 |
| buy | 2017-26 | +0.148 | +0.107 | +0.041 |
| sell | 2007-16 | -0.142 | -0.083 | -0.059 |
| sell | 2017-26 | -0.091 | -0.215 | +0.124 |

## Reading (written after the results)

The gap adds nothing that holds in both windows. Before costs the both-sided stream was flat in 2007-16 (0.000R) and
+0.139R in 2017-26, the years gold rose most; its buys moved with buying gold on any day (difference to the buy
baseline -0.046R in sample, +0.041R out of sample) and its sells lost in both windows. The out-of-sample
month t 0.97 sits below the placebo's 95th percentile. Not an edge; no proposal is written and nothing live changes.

## Placebo

40 draws put T1's out-of-sample trades on random days with shuffled sides and the same risk in ATR units: month t median 0.08, 95th percentile (1.83); 10 of 40 draws at or above the rule's 0.97.

## Checks

1. Out-of-sample month t >= 2 and Holm p < 0.05: no (t 0.97, Holm p 0.66).
2. In-sample net R a trade > 0: no (-0.050R).
3. Out-of-sample net at 2x costs > 0: yes (+0.012R).
4. Above the placebo's 95th percentile: no.

## T1 by year (net R)

| Year | n | Net R |
|---|---|---|
| 2007 | 11 | -4.68 |
| 2008 | 24 | +1.12 |
| 2009 | 23 | -0.16 |
| 2010 | 25 | -12.61 |
| 2011 | 25 | +9.57 |
| 2012 | 22 | +6.72 |
| 2013 | 22 | -6.39 |
| 2014 | 22 | +3.52 |
| 2015 | 18 | +0.55 |
| 2016 | 24 | -8.46 |
| 2017 | 20 | +3.07 |
| 2018 | 13 | +1.92 |
| 2019 | 21 | -3.39 |
| 2020 | 25 | -5.07 |
| 2021 | 17 | +2.65 |
| 2022 | 22 | +4.13 |
| 2023 | 24 | +0.24 |
| 2024 | 25 | +0.41 |
| 2025 | 25 | +14.82 |
| 2026 | 20 | -2.75 |
