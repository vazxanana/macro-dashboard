# Do the Equinox fades do better on range days? (result)

**Verdict: FAIL. 0 of 6 tests pass (gate met with one stated deviation); no range-day subset is positive after costs in either window (best F1 x M1: -0.123R a trade after costs in 2015-26, n 102,160, month t -21.50); largest range-minus-trend difference F3 x M1 +0.055R before costs (hour-stratified month t 2.84, placebo beaten 40 of 40).**

Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants.

## What was run

The three fades of the Equinox page by their own imported code: F1 Break fade (`grid7-wide-fade` m15 none atr 2R all), F2
Big-candle fade (`big-candle-fade` m15 k1.5 nobreak half), F3 Round-number fade (`round-number-breaks` fade other 2R). Each trade
is tagged at its signal candle's close, from closed candles only, by two range measures: M1 = 20-day efficiency ratio of the
closed 17:00 New York days (range < 0.2, trend > 0.4); M2 = the current day's range so far / the daily ATR14 (range < 0.5,
trend > 1.0). Ten markets, OANDA mid 5-minute candles; discovery 2005-14, confirmation 2015 to Oct 2026. A test passes only if the
range-day subset has n >= 200 a window, is positive AFTER costs in both windows with month-sum t >= 2 in confirmation after Holm
(six tests), beats the trend-day subset before costs (hour-stratified month t >= 2 in confirmation, positive in both), and beats
38 of 40 shuffles of the measure within market and year.
Costs: the parents' flat round trip; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy.

## Gate

- F1 m15 none atr 2R all: discovery n 171,515 +0.054 (parent 171,523, +0.054); confirmation n 201,769 +0.042 (parent 201,769, +0.042); after costs -0.118 (month t -28.34): confirmation equal, discovery 8 trades short.
- F2 m15 k1.5 nobreak half: discovery n 47,354 +0.307 (parent 47,354, +0.307); confirmation n 54,443 +0.193 (parent 54,443, +0.193); after costs -0.246 (month t -20.30): equal.
- F3 fade other 2R: discovery n 94,177 +0.102 (parent 94,188, +0.102); confirmation n 88,734 +0.051 (parent 88,734, +0.051); after costs -0.307 (month t -34.05): confirmation equal, discovery 11 trades short.

**Stated deviation from the pre-registration.** The gate asked for exact counts; F1 and F3 are 8 and 11 trades short in
discovery (of 171,523 and 94,188), with means equal to the third decimal and confirmation exact. Cause: the shared candle cache
starts on 2 January 2005 for the forex pairs, while the parents ran on a cache that began on 1 January 2004 (their result.json
`meta.first`), so the first swings of early 2005 are read from fewer candles. The pre-registration said a failed gate is
INCONCLUSIVE; the study is judged anyway because the code is the parents' own and the difference is under 0.02 % of one window,
and it is said here. Nothing else was changed after the run.

## The six tests

Range-day subset R a trade after costs (month-sum t); range minus trend before costs (hour-stratified month t).

| Test | range n 05-14 | net 05-14 (t) | range n 15-26 | net 15-26 (t) | Holm p | range-trend 05-14 (t) | range-trend 15-26 (t) | placebo beaten | checks n/net/t/diff/placebo | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| F1 x M1 | 84,642 | -0.082 (-10.71) | 102,160 | -0.123 (-21.50) | 1.000 | +0.014 (1.09) | -0.003 (-0.26) | 9 of 40 | y/n/n/n/n | no |
| F1 x M2 | 86,592 | -0.110 (-14.35) | 105,170 | -0.140 (-23.50) | 1.000 | -0.026 (-1.45) | +0.009 (0.46) | 30 of 40 | y/n/n/n/n | no |
| F2 x M1 | 23,254 | -0.048 (-2.68) | 27,123 | -0.260 (-16.77) | 1.000 | +0.015 (0.39) | -0.025 (-0.63) | 10 of 40 | y/n/n/n/n | no |
| F2 x M2 | 22,483 | -0.083 (-4.90) | 26,014 | -0.291 (-18.01) | 1.000 | -0.047 (-0.80) | -0.009 (-0.22) | 6 of 40 | y/n/n/n/n | no |
| F3 x M1 | 44,608 | -0.189 (-21.56) | 42,873 | -0.306 (-24.94) | 1.000 | +0.021 (0.93) | +0.055 (2.84) | 40 of 40 | y/n/n/y/y | no |
| F3 x M2 | 45,715 | -0.216 (-28.71) | 44,154 | -0.333 (-29.27) | 1.000 | +0.002 (0.07) | +0.071 (2.73) | 40 of 40 | y/n/n/y/y | no |

## Every level

R a trade before costs (month-sum t), after costs (month-sum t), win share.

### F1 x M1

| Level | n 05-14 | R 05-14 (t) | net 05-14 (t) | n 15-26 | R 15-26 (t) | net 15-26 (t) | win 15-26 |
|---|---:|---:|---:|---:|---:|---:|---:|
| range | 84,642 | +0.058 (8.57) | -0.082 (-10.71) | 102,160 | +0.039 (8.46) | -0.123 (-21.50) | 35.0% |
| mid | 56,921 | +0.058 (8.70) | -0.085 (-11.24) | 67,526 | +0.051 (7.69) | -0.107 (-14.64) | 35.3% |
| trend | 28,640 | +0.035 (3.23) | -0.113 (-7.53) | 32,083 | +0.035 (4.24) | -0.124 (-11.92) | 34.8% |
| (no level) | 1,312 trades in both windows together | | | | | | |

### F1 x M2

| Level | n 05-14 | R 05-14 (t) | net 05-14 (t) | n 15-26 | R 15-26 (t) | net 15-26 (t) | win 15-26 |
|---|---:|---:|---:|---:|---:|---:|---:|
| range | 86,592 | +0.062 (9.11) | -0.110 (-14.35) | 105,170 | +0.045 (8.32) | -0.140 (-23.50) | 34.9% |
| mid | 61,711 | +0.022 (3.25) | -0.094 (-12.93) | 71,678 | +0.033 (5.28) | -0.104 (-16.60) | 34.9% |
| trend | 20,443 | +0.085 (7.29) | -0.013 (-1.09) | 23,009 | +0.048 (3.85) | -0.069 (-5.68) | 36.1% |
| (no level) | 4,681 trades in both windows together | | | | | | |

### F2 x M1

| Level | n 05-14 | R 05-14 (t) | net 05-14 (t) | n 15-26 | R 15-26 (t) | net 15-26 (t) | win 15-26 |
|---|---:|---:|---:|---:|---:|---:|---:|
| range | 23,254 | +0.323 (15.54) | -0.048 (-2.68) | 27,123 | +0.184 (12.37) | -0.260 (-16.77) | 30.1% |
| mid | 15,671 | +0.275 (12.54) | -0.096 (-4.52) | 18,384 | +0.197 (10.69) | -0.243 (-12.23) | 30.2% |
| trend | 8,037 | +0.328 (8.19) | -0.032 (-1.07) | 8,936 | +0.213 (8.29) | -0.213 (-8.06) | 30.5% |
| (no level) | 392 trades in both windows together | | | | | | |

### F2 x M2

| Level | n 05-14 | R 05-14 (t) | net 05-14 (t) | n 15-26 | R 15-26 (t) | net 15-26 (t) | win 15-26 |
|---|---:|---:|---:|---:|---:|---:|---:|
| range | 22,483 | +0.337 (18.63) | -0.083 (-4.90) | 26,014 | +0.205 (13.70) | -0.291 (-18.01) | 31.9% |
| mid | 18,144 | +0.239 (11.21) | -0.095 (-4.46) | 20,969 | +0.170 (9.52) | -0.233 (-13.23) | 28.9% |
| trend | 6,204 | +0.361 (9.10) | +0.075 (1.98) | 7,359 | +0.204 (6.77) | -0.135 (-4.93) | 27.8% |
| (no level) | 624 trades in both windows together | | | | | | |

### F3 x M1

| Level | n 05-14 | R 05-14 (t) | net 05-14 (t) | n 15-26 | R 15-26 (t) | net 15-26 (t) | win 15-26 |
|---|---:|---:|---:|---:|---:|---:|---:|
| range | 44,608 | +0.115 (11.57) | -0.189 (-21.56) | 42,873 | +0.059 (7.57) | -0.306 (-24.94) | 35.3% |
| mid | 31,850 | +0.097 (10.71) | -0.197 (-19.01) | 29,759 | +0.050 (6.02) | -0.309 (-23.22) | 35.1% |
| trend | 17,012 | +0.078 (5.76) | -0.202 (-11.25) | 16,102 | +0.030 (2.53) | -0.303 (-13.74) | 34.3% |
| (no level) | 707 trades in both windows together | | | | | | |

### F3 x M2

| Level | n 05-14 | R 05-14 (t) | net 05-14 (t) | n 15-26 | R 15-26 (t) | net 15-26 (t) | win 15-26 |
|---|---:|---:|---:|---:|---:|---:|---:|
| range | 45,715 | +0.109 (12.06) | -0.216 (-28.71) | 44,154 | +0.060 (8.17) | -0.333 (-29.27) | 35.3% |
| mid | 29,204 | +0.086 (7.73) | -0.190 (-18.03) | 26,885 | +0.044 (4.65) | -0.299 (-25.14) | 34.8% |
| trend | 17,389 | +0.098 (7.95) | -0.156 (-12.83) | 16,639 | +0.039 (2.85) | -0.255 (-18.76) | 34.9% |
| (no level) | 2,925 trades in both windows together | | | | | | |

## Per market

Range-day subsets positive after costs in both windows with n >= 200 in confirmation (descriptive, not tested; picking one after the fact proves nothing): none.

## Checks

- Cut test: 10 cuts on xau, eurusd: 287,634 F1 / F2 signals with both measures known by the cut dates, 0 missing or extra when the candles are cut there.
- Every trade has its stop on the losing side of the fill (the run throws otherwise); the parents' skips (past the stop, risk under the round-trip cost, unresolved, bad-data intervals) are kept.

| Market | from | F1 | F2 | F3 |
|---|---|---:|---:|---:|
| xau | 2006-03-19 | 35,212 | 7,798 | 20,251 |
| xag | 2006-03-19 | 23,331 | 2,084 | 6,135 |
| eurusd | 2005-01-02 | 39,524 | 11,830 | 17,995 |
| gbpusd | 2005-01-02 | 39,226 | 12,725 | 21,974 |
| usdjpy | 2005-01-02 | 38,596 | 10,438 | 20,501 |
| audusd | 2005-01-02 | 40,045 | 11,218 | 18,932 |
| nzdusd | 2005-01-02 | 39,723 | 10,604 | 17,610 |
| usdcad | 2005-01-02 | 39,914 | 12,609 | 16,824 |
| usdchf | 2005-01-02 | 39,173 | 11,767 | 14,494 |
| eurjpy | 2005-01-02 | 38,540 | 10,724 | 28,195 |

## What it means

A range day, read either as a low 20-day efficiency ratio or as a day that has not yet moved its normal range, does not turn
any of the three fades into a rule that pays after costs, and the before-cost tilt is not reliably larger on range days than on
trend days. The fades lose after costs whatever the regime. A before-cost tilt is not an edge. Nothing live changed; no rule is
proposed; no other cuts or measures on these years.

Two things worth knowing, neither a rule. (1) The Round-number fade's before-cost tilt is larger on range days than trend days in
2015-26 on both measures (ER20 +0.055R, hour-stratified month t 2.84; day range +0.071R, t 2.73; each beat
40 and 40 of 40 shuffles) but not in 2005-14 (t 0.93 and 0.07), and its range-day subset still
loses -0.306R and -0.333R a trade after costs: a before-cost tilt is not an edge.
(2) For the Break fade, quiet days so far are the WORST after costs (-0.140R, n 105,170) and days that have already
moved more than their ATR the least bad (-0.069R, n 23,009): the stop is 1 ATR of M15, so on a wide day the
fixed spread is a smaller share of the risk. That is cost arithmetic, not a market that fades better.
