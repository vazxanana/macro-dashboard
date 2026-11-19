# Result: the Japanese fiscal year-end yen seasonal (14 Nov 2026)

**Verdict: FAIL**, 0 of 2 tests pass: USD/JPY did not fall in March before the Japanese fiscal year-end, and did not rise in the
first ten trading days of April any more than in an ordinary ten days of the year.

On the pre-registered bar (PREREGISTRATION.md, pushed before any number was computed) the March claim has the WRONG sign in both
windows: a short USD/JPY from 1 March to 29 March made -0.319R a year after costs and financing in 2016-2026 (-0.226R before
any cost) and -0.425R in 2005-2015; 4 of 11 and 3 of 11 years won. The April claim is -0.060R in 2016-2026 and +0.099R in
2005-2015, 6 of 11 years won in each. Permutation p (one window of the same length drawn from every other start day of each
year) 0.6926 and 0.7126, Holm-adjusted 1 and 1.

**Small n, said plainly.** One position per rule per year: 11 decisive years per test, each a single R between about -1.1 and
+1.3. With a yearly spread of about 0.7-0.8R, a true seasonal of +0.3R a year would give an expected t near 1.3; it would need
to be about +0.5R a year or more, every year, to clear the bar. A FAIL here is weak evidence against a small effect; it is strong
evidence against the claim as usually told (a reliable yen rally into the year-end), because the sign itself is wrong.

Data: council-data `research/daily/usdjpy.json` (EUR/JPY and AUD/JPY as a cross check; OANDA mid daily candles, UTC days,
weekends folded into Monday with `fills.mjs` `foldWeekend`), used from 1 January 2005 (the 2002-04 rows are placeholder prices,
volume 1-2) to 6 November 2026. Decisive: 2016-2026 (11 years each); replication: 2005-2015 (11 years each).

Positions: entry at the window's first open, exit at its last close; stop 3 x ATR(20) of the daily candles before the entry,
filled at the stop or at a gapping open (`fills.mjs` `stopFill`); R = signed move / stop distance. Costs (raw-spread model):
0.3 pip spread, 0.15 pip slippage a side, 22.5 USD per million a side: about 0.004R a position. Financing: `ctrader/symbols.json`
holds no yen pair, so the pre-registered assumed rate: the policy-rate differential of the fx-carry study's `rates.json` (the
month before the entry; approximate, from that study) minus a 0.5 % a year markup on every position. A March short paid
-0.089R a year on average in 2016-2026 (-0.270R in 2024), -0.043R in 2005-2015; an April long earned +0.023R and +0.010R.

## The two tests (USD/JPY, base cost)

| Test | Window | Years | Mean gross R | Mean net R | sd | t | Years won (net) | Stopped | Comparison mean | Permutation p | Offset rank |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 short, 1-29 March | 2016 - 2026 | 11 | -0.226 | -0.319 | 0.694 | -1.53 | 4 of 11 | 4 | -0.162 | 0.6926 | 85 of 159 |
| T1 | 2005 - 2015 | 11 | -0.378 | -0.425 | 0.748 | -1.88 | 3 of 11 | 5 | -0.045 | | |
| T2 long, first 10 days of April | 2016 - 2026 | 11 | -0.079 | -0.060 | 0.831 | -0.24 | 6 of 11 | 4 | +0.058 | 0.7126 | 152 of 193 |
| T2 | 2005 - 2015 | 11 | +0.093 | +0.099 | 0.579 | +0.57 | 6 of 11 | 0 | +0.024 | | |

"Comparison mean" = the mean net R of the same-length windows starting on every other trading day of the same year (no shared
day with the claimed window). Permutation: 20,000 draws, one comparison window per year drawn independently, p = share of draws
whose 11-year mean reaches the claimed one. Offset rank: the claimed 11-year mean against the same statistic for a window
starting on the k-th trading day of each year (offsets present in all 11 years), 1 = best.

| Bar | T1 | T2 |
|---|---|---|
| Mean net R > 0 in both windows | not met (-0.319, -0.425) | not met (-0.060 in 2016-26) |
| Holm-adjusted permutation p < 0.05 | 1, not met | 1, not met |
| **Pass** | **no** | **no** |

## Cost and financing sensitivity (USD/JPY, mean net R a year)

| Test | Window | 0 (no cost, no financing) | Base | 2x |
|---|---|---|---|---|
| T1 | 2016 - 2026 | -0.226 (p 0.6838, 5 won) | -0.319 (p 0.6926, 4 won) | -0.412 (p 0.7016, 2 won) |
| T1 | 2005 - 2015 | -0.378 | -0.425 | -0.472 |
| T2 | 2016 - 2026 | -0.079 (p 0.7084) | -0.060 (p 0.7126) | -0.041 (p 0.7164) |
| T2 | 2005 - 2015 | +0.093 | +0.099 | +0.106 |

Costs do not decide anything: the March short loses before any cost, and the April long gains a little from carry (it is
long the higher-yielding dollar) but stays negative in the decisive window at every level.

## Placebo (40 random calendar starts, USD/JPY, the same statistic, 2,000 permutation draws, bar 1-2 without Holm)

| Kind | Placebo rules that would pass | Claimed rule's rank among the 40 placebo 11-year means |
|---|---|---|
| T1-like (short, the March window's length) | 6 of 40 | 22 of 41 |
| T2-like (long, 10 days) | 0 of 40 | 32 of 41 |

The six passing placebo shorts all start between 4 and 30 July (seeds 1, 13, 22, 25, 33, 34): short USD/JPY from early or late
July made +0.24R to +0.70R a year in 2016-26 and was positive in 2005-15. That is an observation found by a placebo draw, not a
tested claim: nothing was pre-registered about July, the six draws are one stretch of the calendar seen six times, and it would
need its own pre-registration on other data. What it does show: about 15 % of random fixed dates clear this study's bar on 11
years, three times the nominal 5 %, so a March PASS would itself have been modest evidence. The permutation treats the windows
of a year as exchangeable; real calendar effects in other months (and the 2024 carry unwind, which falls in July-August) break
that, which is why the placebo is reported beside it.

## Year by year (USD/JPY; EUR/JPY and AUD/JPY net R as a cross check, same side)

"Rank in the year" = the claimed window's net R among that year's comparison windows (1 = best). Financing is the assumed rate.
2026's comparison windows are only those complete by 6 November 2026.

### T1, short, first trading day on/after 1 March to the last on/before 29 March

| Year | Window | Days | Gross R | Cost R | Financing R | Net R | Exit | Rank in the year | EUR/JPY net R | AUD/JPY net R |
|---|---|---|---|---|---|---|---|---|---|---|
| 2005 | 03-01 to 03-29 | 21 | -1.000 | -0.004 | -0.086 | -1.090 | stop | 160 of 200 | -0.358 | -0.324 |
| 2006 | 03-01 to 03-29 | 21 | -1.000 | -0.004 | -0.056 | -1.060 | stop | 149 of 220 | -1.016 (stop) | +1.017 |
| 2007 | 03-01 to 03-29 | 21 | +0.230 | -0.004 | -0.178 | +0.048 | close | 106 of 221 | -0.180 | -0.895 |
| 2008 | 03-03 to 03-28 | 20 | +1.373 | -0.003 | -0.070 | +1.299 | close | 15 of 224 | +0.081 | +1.227 |
| 2009 | 03-02 to 03-27 | 20 | -0.069 | -0.002 | -0.008 | -0.079 | close | 147 of 223 | -1.014 (stop) | -1.024 (stop) |
| 2010 | 03-01 to 03-29 | 21 | -1.000 | -0.003 | -0.011 | -1.015 | stop | 212 of 220 | -0.632 | -1.054 (stop) |
| 2011 | 03-01 to 03-29 | 21 | -0.334 | -0.005 | -0.020 | -0.359 | close | 174 of 220 | -1.024 (stop) | -0.951 |
| 2012 | 03-01 to 03-29 | 21 | -1.000 | -0.005 | -0.009 | -1.014 | stop | 134 of 220 | -0.340 | +0.524 |
| 2013 | 03-01 to 03-29 | 21 | -1.000 | -0.003 | -0.003 | -1.005 | stop | 132 of 220 | +0.015 | -1.018 (stop) |
| 2014 | 03-03 to 03-28 | 20 | -0.563 | -0.004 | -0.018 | -0.586 | close | 126 of 223 | -1.006 (stop) | -1.017 (stop) |
| 2015 | 03-02 to 03-27 | 20 | +0.210 | -0.004 | -0.018 | +0.188 | close | 81 of 222 | +0.877 | +0.286 |
| 2016 | 03-01 to 03-29 | 21 | -0.055 | -0.002 | -0.019 | -0.076 | close | 89 of 220 | -1.006 (stop) | -1.015 (stop) |
| 2017 | 03-01 to 03-29 | 21 | +0.631 | -0.004 | -0.038 | +0.589 | close | 59 of 220 | -1.007 (stop) | +0.429 |
| 2018 | 03-01 to 03-29 | 21 | +0.049 | -0.004 | -0.058 | -0.013 | close | 87 of 221 | -0.267 | +0.269 |
| 2019 | 03-01 to 03-29 | 21 | +0.335 | -0.007 | -0.166 | +0.162 | close | 72 of 221 | +1.093 | +0.131 |
| 2020 | 03-02 to 03-27 | 20 | -1.000 | -0.005 | -0.060 | -1.065 | stop | 214 of 223 | -0.603 | +1.148 |
| 2021 | 03-01 to 03-29 | 21 | -1.000 | -0.007 | -0.008 | -1.014 | stop | 143 of 220 | -1.010 (stop) | -1.014 (stop) |
| 2022 | 03-01 to 03-29 | 21 | -1.000 | -0.006 | -0.013 | -1.019 | stop | 158 of 220 | -1.006 (stop) | -1.014 (stop) |
| 2023 | 03-01 to 03-29 | 21 | +0.866 | -0.003 | -0.138 | +0.725 | close | 29 of 220 | +0.025 | +1.060 |
| 2024 | 03-01 to 03-29 | 21 | -0.498 | -0.005 | -0.270 | -0.773 | close | 109 of 222 | -1.172 (stop) | -1.177 (stop) |
| 2025 | 03-03 to 03-28 | 20 | +0.187 | -0.003 | -0.106 | +0.079 | close | 58 of 223 | -1.030 (stop) | -0.249 |
| 2026 | 03-02 to 03-27 | 20 | -1.000 | -0.003 | -0.103 | -1.106 | stop | 145 of 165 | -0.256 | -1.035 (stop) |

### T2, long, the first 10 trading days of April

| Year | Window | Days | Gross R | Cost R | Financing R | Net R | Exit | Rank in the year | EUR/JPY net R | AUD/JPY net R |
|---|---|---|---|---|---|---|---|---|---|---|
| 2005 | 04-01 to 04-14 | 10 | +0.355 | -0.004 | +0.038 | +0.389 | close | 106 of 222 | -0.179 | +0.211 |
| 2006 | 04-03 to 04-14 | 10 | +0.305 | -0.004 | +0.055 | +0.357 | close | 99 of 242 | +0.320 | +0.823 |
| 2007 | 04-02 to 04-13 | 10 | +0.423 | -0.003 | +0.048 | +0.468 | close | 69 of 243 | +0.838 | +1.064 |
| 2008 | 04-01 to 04-14 | 10 | +0.247 | -0.002 | +0.009 | +0.254 | close | 62 of 244 | +0.417 | +0.389 |
| 2009 | 04-01 to 04-14 | 10 | -0.058 | -0.002 | -0.003 | -0.064 | close | 116 of 243 | -0.043 | +0.519 |
| 2010 | 04-01 to 04-14 | 10 | -0.082 | -0.004 | -0.007 | -0.093 | close | 97 of 242 | +0.197 | +0.497 |
| 2011 | 04-01 to 04-14 | 10 | +0.077 | -0.003 | -0.004 | +0.070 | close | 79 of 242 | +0.607 | +0.488 |
| 2012 | 04-02 to 04-13 | 10 | -0.784 | -0.004 | -0.005 | -0.793 | close | 222 of 242 | -1.004 (stop) | -0.444 |
| 2013 | 04-01 to 04-12 | 10 | +1.354 | -0.003 | -0.005 | +1.346 | close | 6 of 242 | +1.586 | +1.530 |
| 2014 | 04-01 to 04-14 | 10 | -0.621 | -0.005 | -0.008 | -0.634 | close | 210 of 243 | -0.391 | +0.105 |
| 2015 | 04-01 to 04-14 | 10 | -0.196 | -0.004 | -0.007 | -0.208 | close | 163 of 242 | -0.335 | -0.117 |
| 2016 | 04-01 to 04-14 | 10 | -1.000 | -0.004 | 0.000 | -1.004 | stop | 211 of 242 | -1.009 (stop) | -0.996 (stop) |
| 2017 | 04-03 to 04-14 | 10 | -1.000 | -0.004 | +0.007 | -0.997 | stop | 220 of 242 | -1.015 (stop) | -0.994 (stop) |
| 2018 | 04-02 to 04-13 | 10 | +0.472 | -0.005 | +0.020 | +0.487 | close | 48 of 243 | +0.394 | +0.574 |
| 2019 | 04-01 to 04-12 | 10 | +0.581 | -0.006 | +0.046 | +0.621 | close | 31 of 243 | +0.752 | +0.708 |
| 2020 | 04-01 to 04-14 | 10 | -0.064 | -0.002 | -0.002 | -0.067 | close | 111 of 243 | -0.171 | +0.432 |
| 2021 | 04-01 to 04-14 | 10 | -1.000 | -0.006 | -0.005 | -1.011 | stop | 239 of 242 | +0.247 | -0.004 |
| 2022 | 04-01 to 04-14 | 10 | +1.311 | -0.003 | 0.000 | +1.307 | close | 23 of 242 | +0.332 | +0.610 |
| 2023 | 04-03 to 04-14 | 10 | +0.085 | -0.002 | +0.041 | +0.123 | close | 151 of 242 | +0.420 | +0.164 |
| 2024 | 04-01 to 04-12 | 10 | +0.682 | -0.004 | +0.089 | +0.767 | close | 60 of 244 | +0.008 | +0.248 |
| 2025 | 04-01 to 04-14 | 10 | -1.000 | -0.003 | +0.017 | -0.986 | stop | 242 of 243 | +0.044 | -0.992 (stop) |
| 2026 | 04-01 to 04-14 | 10 | +0.063 | -0.004 | +0.043 | +0.102 | close | 123 of 195 | +1.323 | +1.064 |

## Cross check (not judged): EUR/JPY and AUD/JPY, same windows and sides, base cost

| Test | Pair | 2016-2026 mean net R | t | Won | Permutation p | 2005-2015 mean net R | Won |
|---|---|---|---|---|---|---|---|
| T1 short March | EUR/JPY | -0.567 | -2.76 | 2 of 11 | 0.9738 | -0.418 | 3 of 11 |
| T1 short March | AUD/JPY | -0.224 | -0.84 | 5 of 11 | 0.5971 | -0.294 | 4 of 11 |
| T2 long April | EUR/JPY | +0.120 | +0.58 | 8 of 11 | 0.2907 | +0.183 | 6 of 11 |
| T2 long April | AUD/JPY | +0.074 | +0.33 | 7 of 11 | 0.4034 | +0.460 | 9 of 11 |

The crosses say the same: the yen did not strengthen in March (EUR/JPY's March short is the worst stream of the study, the
lowest of all 159 same-offset windows in 2016-26); April leans the claimed way on the crosses (AUD/JPY +0.460R, t 2.79, in
2005-15) but not in the decisive window, and not on USD/JPY. Reported, not judged: picking the cross that looks best after the
fact is not evidence.

## What it says, and what it does not
- **March is not a yen month on these data.** A short USD/JPY into the fiscal year-end lost in 7 of 11 decisive years and 8 of
  11 earlier years, stopped out 9 times in 22 Marches (2020, 2021, 2022 and 2026 among them). Before costs it still lost
  (-0.226R and -0.378R). The repatriation story may be real as a flow; if so, it is priced in, offset by other March flows, or
  happens before 1 March.
- **April is an ordinary ten days.** +0.099R a year in 2005-15, -0.060R in 2016-26, ranked 152nd of 193 same-offset windows;
  2016, 2017, 2021 and 2025 were stopped (2025: the April tariff shock, 242nd of 243 that year).
- **Small n.** 11 trades per test per window. This rules out a large, regular seasonal; it cannot rule out a small one, and a
  different exit day (31 March, mid-March) was not tested and should not be tried on these years after seeing this.
- **Financing is assumed** (no yen pair in the demo broker's symbol file): the policy-rate gap of the fx-carry study plus 0.5 %
  a year; it moves the March result by about 0.09R a year, not the verdict.
- Nothing here is a filter, rule or size for any council system, nothing live changed, and the July observation of the placebo
  is not a finding.

To repeat: `node research/edge/jp-fiscal-yearend/run.mjs fetch <dir>` (git show from council-data and the fx-carry branch, no
network), then `node research/edge/jp-fiscal-yearend/run.mjs full <dir>`. Tests: `tests/jp-fiscal-yearend.test.mjs`.
