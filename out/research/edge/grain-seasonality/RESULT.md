**Verdict: PASS on the pre-registered bar, by one test of three, and thin.** T2 soybeans (short July to September) passes:
mean net R +0.520 a year on 2016-26 (8 of 11 years won, permutation p 0.01195, Holm p 0.03585) and +1.186 on 2003-15 (7 of 13).
T1 corn (+0.121 net on 2016-26, Holm p 0.2075) and T3 wheat (−0.343, Holm p 0.2075) fail. n is 11 years in the decisive window,
the per-year t of the soybean short is 1.38, and three of its eleven years were stopped at about −1R (2026 among them): a
candidate for the owner to look at, never an edge on its own.

# Grain seasonality: the pre-harvest decline as a short on OANDA CFDs (14 Nov 2026)

Paper research only. No live rule, size, filter, stop, config, market list or council member was changed, and no market was
added to any trading rule. The windows, stop, costs, tests and pass bar were committed alone, before any price was read
(`PREREGISTRATION.md`, commit b0848cd6). Anything not named there is marked post-hoc below.

## What was tested

The pre-harvest decline described in commodity trading texts and agricultural-economics work on seasonal prices: grain prices
carry a crop-risk premium into early summer and give it back into harvest. On OANDA mid daily candles of the council's cache
(`research/daily/corn|soybn|wheat|sugar.json`, March 2003 to 6 Nov 2026; weekend buckets folded into the next weekday):

- sell at the open of the window's first trading day; a fixed stop at entry + 3 x ATR(20) of the 20 weekday candles closed
  before entry; stopped at the stop (or at a gapped open, never better); otherwise out at the close of the window's last
  trading day; one trade a market a year; R = move / stop distance;
- T1 corn and T2 soybeans July to September, T3 wheat June to August; sugar July to September as a control, never judged;
- costs: 0.20 % of the entry price a round trip, and financing charged on the short at 3 % a year per rollover night
  (no measured spread or swap exists for these CFDs; both chosen to be conservative), also shown at 0 and at 2x;
- decisive sample 2016-26 (11 years), replication 2003-15 (13 years);
- p: the real mean against the same rule on the three-month window starting on any month, one start month drawn at random
  for every year (200,000 draws, seed 20261114), one-sided; Holm over T1-T3; a pass needs net R above 0 in both samples and
  a Holm-corrected decisive p under 0.05.

## The three tests and the control

| test | sample | years | won | stopped | mean gross R | mean net R (base) | t (per year) | permutation p | rank of 12 start months | placebo seeds at or above | Holm p |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 corn | decisive 2016-26 | 11 | 7 of 11 | 2 | +0.226 | +0.121 | 0.46 | 0.10375 | 2 of 12 | 5 of 40 | 0.2075 |
| T1 corn | replication 2003-15 | 13 | 6 of 13 | 7 | +0.545 | +0.463 | 0.87 | 0.04666 | 2 of 12 | 3 of 40 |  |
| T2 soybeans | decisive 2016-26 | 11 | 8 of 11 | 3 | +0.658 | +0.520 | 1.38 | 0.01195 | 1 of 12 | 2 of 40 | 0.03585 |
| T2 soybeans | replication 2003-15 | 13 | 7 of 13 | 6 | +1.298 | +1.186 | 1.83 | 0.00067 | 1 of 12 | 0 of 40 |  |
| T3 wheat | decisive 2016-26 | 11 | 3 of 11 | 7 | −0.273 | −0.343 | −0.95 | 0.20082 | 3 of 12 | 14 of 40 | 0.2075 |
| T3 wheat | replication 2003-15 | 13 | 6 of 13 | 6 | +0.211 | +0.127 | 0.33 | 0.13774 | 1 of 12 | 5 of 40 |  |
| control sugar | decisive 2016-26 | 11 | 2 of 11 | 8 | −0.527 | −0.618 | −2.33 | 0.93511 | 11 of 12 | 35 of 40 | not judged |
| control sugar | replication 2003-15 | 13 | 2 of 13 | 10 | +0.002 | −0.082 | −0.14 | 0.47201 | 5 of 12 | 16 of 40 |  |

The rank is the real window's mean against the eleven other start months' means over the same years (1 = best). The placebo
is a random three-month-long window per year (40 seeds): placebo means on 2016-26 ran from −0.967 to +0.529 (corn), −0.845 to
+0.750 (soybeans), −0.990 to +0.046 (wheat), −0.885 to +0.922 (sugar). Every start month's mean is in `result.json`
(`startMonths`): on 2016-26 the soybean short is best from July (+0.520), then June (+0.272), August (+0.128) and March
(+0.108); every other start month loses. For corn May (+0.271) beats July (+0.121); for wheat every start month loses.

## Costs and financing at 0, base and 2x

| test | sample | net R, no costs (x0) | p | net R, base (x1) | p | net R, double (x2) | p |
|---|---|---|---|---|---|---|---|
| T1 corn | decisive | +0.226 | 0.1189 | +0.121 | 0.10375 | +0.015 | 0.08911 |
| T1 corn | replication | +0.545 | 0.05208 | +0.463 | 0.04666 | +0.381 | 0.04161 |
| T2 soybeans | decisive | +0.658 | 0.01328 | +0.520 | 0.01195 | +0.383 | 0.01098 |
| T2 soybeans | replication | +1.298 | 0.00075 | +1.186 | 0.00067 | +1.074 | 0.00061 |
| T3 wheat | decisive | −0.273 | 0.2152 | −0.343 | 0.20082 | −0.414 | 0.1873 |
| T3 wheat | replication | +0.211 | 0.14108 | +0.127 | 0.13774 | +0.042 | 0.1348 |
| control sugar | decisive | −0.527 | 0.9321 | −0.618 | 0.93511 | −0.708 | 0.93849 |
| control sugar | replication | +0.002 | 0.47856 | −0.082 | 0.47201 | −0.166 | 0.46518 |

The soybean pass does not depend on the cost model: the decisive p stays near 0.012 from no costs to double costs. Corn's
decisive mean nearly vanishes at double costs (+0.015).

## Contract rolls and gaps

The candles were used as they are (pre-registered). Candles whose open sits over 3 % or over 2 x ATR(20) from the previous
close were listed: corn 15, soybeans 4, wheat 24, sugar 9 in 23 years. They are not at a recurring date: they are a holiday
after 4 July 2021, the week of 24 February 2022, crop-report days and the like, so no yearly contract-switch step shows in
these series. Years whose test window holds such a gap, left out (pre-registered diagnostic): soybeans 2016-26 +0.464 a year
(10 years), 2003-15 +1.058 (12); corn +0.090 (9) and +0.463 (13); wheat −0.497 (9) and +0.228 (12).

Post-hoc diagnostic (not in the pre-registration): of the soybean short's +7.24R gross over 2016-26, +2.08R came from moves
between a close and the next open and +5.16R within the candles; on 2003-15 +4.95R of +16.87R. The result is not a roll
artefact.

## Every year

### T1 corn, July-September

| sample | year | entry day | exit day | entry | stop | exit | how | gross R | spread R | financing R | net R |
|---|---|---|---|---|---|---|---|---|---|---|---|
| dec | 2016 | 2016-07-01 | 2016-09-30 | 3.626 | 4.0092 | 3.296 | window | +0.861 | 0.019 | 0.072 | +0.771 |
| dec | 2017 | 2017-07-03 | 2017-09-29 | 3.753 | 3.9725 | 3.453 | window | +1.367 | 0.034 | 0.128 | +1.205 |
| dec | 2018 | 2018-07-02 | 2018-09-28 | 3.507 | 3.777 | 3.439 | window | +0.252 | 0.026 | 0.097 | +0.129 |
| dec | 2019 | 2019-07-01 | 2019-09-30 | 4.209 | 4.5968 | 3.794 | window | +1.070 | 0.022 | 0.082 | +0.966 |
| dec | 2020 | 2020-07-01 | 2020-08-31 | 3.336 | 3.5233 | 3.5233 | stop | −1.000 | 0.036 | 0.091 | −1.126 |
| dec | 2021 | 2021-07-01 | 2021-09-30 | 6.72 | 7.6522 | 5.638 | window | +1.161 | 0.014 | 0.055 | +1.092 |
| dec | 2022 | 2022-07-01 | 2022-09-30 | 6.596 | 7.2521 | 6.906 | window | −0.472 | 0.020 | 0.076 | −0.569 |
| dec | 2023 | 2023-07-03 | 2023-09-29 | 5.462 | 6.2268 | 4.96 | window | +0.656 | 0.014 | 0.053 | +0.589 |
| dec | 2024 | 2024-07-01 | 2024-09-30 | 3.955 | 4.2378 | 4.142 | window | −0.661 | 0.028 | 0.106 | −0.795 |
| dec | 2025 | 2025-07-01 | 2025-09-30 | 4.17 | 4.4391 | 4.101 | window | +0.256 | 0.031 | 0.117 | +0.108 |
| dec | 2026 | 2026-07-01 | 2026-07-07 | 4.057 | 4.3224 | 4.3224 | stop | −1.000 | 0.031 | 0.009 | −1.039 |
| rep | 2003 | 2003-07-01 | 2003-09-04 | 2.279 | 2.3987 | 2.3987 | stop | −1.000 | 0.038 | 0.106 | −1.144 |
| rep | 2004 | 2004-07-01 | 2004-09-30 | 2.565 | 2.7907 | 1.977 | window | +2.605 | 0.023 | 0.086 | +2.496 |
| rep | 2005 | 2005-07-01 | 2005-07-05 | 2.132 | 2.3339 | 2.3339 | stop | −1.000 | 0.021 | 0.003 | −1.024 |
| rep | 2006 | 2006-07-03 | 2006-07-11 | 2.374 | 2.5444 | 2.5444 | stop | −1.000 | 0.028 | 0.010 | −1.038 |
| rep | 2007 | 2007-07-02 | 2007-09-27 | 3.288 | 3.7268 | 3.7268 | stop | −1.000 | 0.015 | 0.055 | −1.070 |
| rep | 2008 | 2008-07-01 | 2008-09-30 | 7.125 | 7.928 | 4.887 | window | +2.787 | 0.018 | 0.067 | +2.702 |
| rep | 2009 | 2009-07-01 | 2009-09-30 | 3.464 | 3.8811 | 3.353 | window | +0.266 | 0.017 | 0.064 | +0.185 |
| rep | 2010 | 2010-07-01 | 2010-07-15 | 3.534 | 3.7965 | 3.7965 | stop | −1.000 | 0.027 | 0.017 | −1.044 |
| rep | 2011 | 2011-07-01 | 2011-07-13 | 6.287 | 7.2108 | 7.2108 | stop | −1.000 | 0.014 | 0.007 | −1.021 |
| rep | 2012 | 2012-07-02 | 2012-07-05 | 6.654 | 7.2727 | 7.2727 | stop | −1.000 | 0.022 | 0.005 | −1.027 |
| rep | 2013 | 2013-07-01 | 2013-09-30 | 6.206 | 6.7049 | 4.617 | window | +3.185 | 0.025 | 0.094 | +3.066 |
| rep | 2014 | 2014-07-01 | 2014-09-30 | 4.199 | 4.4609 | 3.158 | window | +3.975 | 0.032 | 0.121 | +3.821 |
| rep | 2015 | 2015-07-01 | 2015-09-30 | 4.14 | 4.4059 | 3.802 | window | +1.271 | 0.031 | 0.120 | +1.120 |

### T2 soybeans, July-September

| sample | year | entry day | exit day | entry | stop | exit | how | gross R | spread R | financing R | net R |
|---|---|---|---|---|---|---|---|---|---|---|---|
| dec | 2016 | 2016-07-01 | 2016-09-30 | 11.76 | 12.6504 | 9.634 | window | +2.388 | 0.026 | 0.100 | +2.261 |
| dec | 2017 | 2017-07-03 | 2017-07-07 | 9.546 | 9.9315 | 9.9315 | stop | −1.000 | 0.050 | 0.014 | −1.064 |
| dec | 2018 | 2018-07-02 | 2018-09-28 | 8.6 | 9.1864 | 8.378 | window | +0.379 | 0.029 | 0.110 | +0.240 |
| dec | 2019 | 2019-07-01 | 2019-09-30 | 9.061 | 9.5246 | 8.953 | window | +0.233 | 0.039 | 0.148 | +0.046 |
| dec | 2020 | 2020-07-01 | 2020-08-17 | 8.818 | 9.1226 | 9.1226 | stop | −1.000 | 0.058 | 0.114 | −1.172 |
| dec | 2021 | 2021-07-01 | 2021-09-30 | 14.578 | 16.1316 | 12.755 | window | +1.173 | 0.019 | 0.071 | +1.084 |
| dec | 2022 | 2022-07-01 | 2022-09-30 | 16.754 | 17.9097 | 14.606 | window | +1.859 | 0.029 | 0.110 | +1.720 |
| dec | 2023 | 2023-07-03 | 2023-09-29 | 15.452 | 16.523 | 13.073 | window | +2.221 | 0.029 | 0.108 | +2.085 |
| dec | 2024 | 2024-07-01 | 2024-09-30 | 11.43 | 12.0042 | 10.698 | window | +1.275 | 0.040 | 0.151 | +1.084 |
| dec | 2025 | 2025-07-01 | 2025-09-30 | 10.207 | 10.6581 | 9.886 | window | +0.712 | 0.045 | 0.171 | +0.495 |
| dec | 2026 | 2026-07-01 | 2026-07-06 | 11.208 | 11.7201 | 11.7201 | stop | −1.000 | 0.044 | 0.011 | −1.055 |
| rep | 2003 | 2003-07-01 | 2003-09-22 | 6.135 | 6.4624 | 6.4624 | stop | −1.000 | 0.037 | 0.129 | −1.167 |
| rep | 2004 | 2004-07-01 | 2004-09-30 | 8.552 | 9.5115 | 5.309 | window | +3.380 | 0.018 | 0.067 | +3.294 |
| rep | 2005 | 2005-07-01 | 2005-07-14 | 6.531 | 7.2285 | 7.2285 | stop | −1.000 | 0.019 | 0.011 | −1.030 |
| rep | 2006 | 2006-07-03 | 2006-09-29 | 6.02 | 6.3317 | 5.412 | window | +1.951 | 0.039 | 0.144 | +1.768 |
| rep | 2007 | 2007-07-02 | 2007-07-13 | 8.505 | 9.1484 | 9.1484 | stop | −1.000 | 0.026 | 0.015 | −1.042 |
| rep | 2008 | 2008-07-01 | 2008-09-30 | 16.042 | 17.4603 | 10.537 | window | +3.882 | 0.023 | 0.086 | +3.773 |
| rep | 2009 | 2009-07-01 | 2009-09-30 | 12.257 | 13.2409 | 9.458 | window | +2.845 | 0.025 | 0.096 | +2.724 |
| rep | 2010 | 2010-07-01 | 2010-07-08 | 9.528 | 9.9684 | 9.9684 | stop | −1.000 | 0.043 | 0.014 | −1.057 |
| rep | 2011 | 2011-07-01 | 2011-07-13 | 13.083 | 13.8336 | 13.8336 | stop | −1.000 | 0.035 | 0.019 | −1.053 |
| rep | 2012 | 2012-07-02 | 2012-07-09 | 15.025 | 15.9951 | 15.9951 | stop | −1.000 | 0.031 | 0.010 | −1.041 |
| rep | 2013 | 2013-07-01 | 2013-09-30 | 15.085 | 15.7887 | 13.416 | window | +2.372 | 0.043 | 0.162 | +2.167 |
| rep | 2014 | 2014-07-01 | 2014-09-30 | 13.738 | 14.4685 | 9.59 | window | +5.678 | 0.038 | 0.142 | +5.498 |
| rep | 2015 | 2015-07-01 | 2015-09-30 | 10.56 | 11.1255 | 8.996 | window | +2.766 | 0.037 | 0.144 | +2.584 |

### T3 wheat, June-August

| sample | year | entry day | exit day | entry | stop | exit | how | gross R | spread R | financing R | net R |
|---|---|---|---|---|---|---|---|---|---|---|---|
| dec | 2016 | 2016-06-01 | 2016-06-03 | 4.598 | 4.9043 | 4.9043 | stop | −1.000 | 0.030 | 0.006 | −1.036 |
| dec | 2017 | 2017-06-01 | 2017-06-08 | 4.167 | 4.4218 | 4.4218 | stop | −1.000 | 0.033 | 0.011 | −1.043 |
| dec | 2018 | 2018-06-01 | 2018-08-02 | 5.15 | 5.5906 | 5.5906 | stop | −1.000 | 0.023 | 0.061 | −1.084 |
| dec | 2019 | 2019-06-03 | 2019-08-30 | 5.018 | 5.5325 | 4.572 | window | +0.867 | 0.020 | 0.073 | +0.774 |
| dec | 2020 | 2020-06-01 | 2020-08-31 | 5.204 | 5.5364 | 5.426 | window | −0.668 | 0.031 | 0.118 | −0.818 |
| dec | 2021 | 2021-06-01 | 2021-08-12 | 6.719 | 7.4478 | 7.4478 | stop | −1.000 | 0.018 | 0.057 | −1.075 |
| dec | 2022 | 2022-06-01 | 2022-08-31 | 10.882 | 12.364 | 8.147 | window | +1.845 | 0.015 | 0.057 | +1.774 |
| dec | 2023 | 2023-06-01 | 2023-06-15 | 5.875 | 6.5559 | 6.5559 | stop | −1.000 | 0.017 | 0.011 | −1.028 |
| dec | 2024 | 2024-06-03 | 2024-08-30 | 6.738 | 7.499 | 5.248 | window | +1.958 | 0.018 | 0.066 | +1.874 |
| dec | 2025 | 2025-06-02 | 2025-06-18 | 5.268 | 5.6301 | 5.6301 | stop | −1.000 | 0.029 | 0.023 | −1.052 |
| dec | 2026 | 2026-06-01 | 2026-07-15 | 6.041 | 6.622 | 6.622 | stop | −1.000 | 0.021 | 0.040 | −1.061 |
| rep | 2003 | 2003-06-02 | 2003-08-01 | 3.208 | 3.4852 | 3.4852 | stop | −1.000 | 0.023 | 0.060 | −1.083 |
| rep | 2004 | 2004-06-01 | 2004-08-31 | 3.606 | 3.9136 | 3.088 | window | +1.684 | 0.023 | 0.089 | +1.572 |
| rep | 2005 | 2005-06-01 | 2005-08-31 | 3.251 | 3.5015 | 3.014 | window | +0.946 | 0.026 | 0.100 | +0.820 |
| rep | 2006 | 2006-06-01 | 2006-08-31 | 3.88 | 4.2368 | 3.997 | window | −0.328 | 0.022 | 0.082 | −0.432 |
| rep | 2007 | 2007-06-01 | 2007-06-11 | 5.129 | 5.4894 | 5.4894 | stop | −1.000 | 0.028 | 0.011 | −1.039 |
| rep | 2008 | 2008-06-02 | 2008-06-09 | 7.526 | 8.2716 | 8.2716 | stop | −1.000 | 0.020 | 0.007 | −1.027 |
| rep | 2009 | 2009-06-01 | 2009-08-31 | 6.294 | 6.8137 | 4.661 | window | +3.142 | 0.024 | 0.092 | +3.026 |
| rep | 2010 | 2010-06-01 | 2010-07-02 | 4.533 | 4.8675 | 4.8675 | stop | −1.000 | 0.027 | 0.038 | −1.065 |
| rep | 2011 | 2011-06-01 | 2011-08-31 | 7.602 | 8.5029 | 7.403 | window | +0.221 | 0.017 | 0.065 | +0.139 |
| rep | 2012 | 2012-06-01 | 2012-06-25 | 6.398 | 6.9879 | 6.9879 | stop | −1.000 | 0.022 | 0.021 | −1.042 |
| rep | 2013 | 2013-06-03 | 2013-08-30 | 7.072 | 7.5419 | 6.396 | window | +1.438 | 0.030 | 0.113 | +1.296 |
| rep | 2014 | 2014-06-02 | 2014-08-29 | 6.224 | 6.6666 | 5.498 | window | +1.640 | 0.028 | 0.105 | +1.507 |
| rep | 2015 | 2015-06-01 | 2015-06-03 | 4.79 | 5.2586 | 5.2586 | stop | −1.000 | 0.020 | 0.004 | −1.025 |

### control sugar, July-September

| sample | year | entry day | exit day | entry | stop | exit | how | gross R | spread R | financing R | net R |
|---|---|---|---|---|---|---|---|---|---|---|---|
| dec | 2016 | 2016-07-01 | 2016-09-22 | 0.2035 | 0.2227 | 0.2228 | stop-gap | −1.004 | 0.021 | 0.072 | −1.097 |
| dec | 2017 | 2017-07-03 | 2017-07-31 | 0.1358 | 0.1478 | 0.1478 | stop | −1.000 | 0.023 | 0.027 | −1.050 |
| dec | 2018 | 2018-07-02 | 2018-09-28 | 0.1194 | 0.1298 | 0.1027 | window | +1.608 | 0.023 | 0.086 | +1.499 |
| dec | 2019 | 2019-07-01 | 2019-09-30 | 0.1233 | 0.1302 | 0.1185 | window | +0.691 | 0.036 | 0.135 | +0.521 |
| dec | 2020 | 2020-07-01 | 2020-08-06 | 0.1191 | 0.1287 | 0.1287 | stop | −1.000 | 0.025 | 0.040 | −1.065 |
| dec | 2021 | 2021-07-01 | 2021-08-10 | 0.1787 | 0.1914 | 0.1914 | stop | −1.000 | 0.028 | 0.045 | −1.073 |
| dec | 2022 | 2022-07-01 | 2022-07-18 | 0.1827 | 0.193 | 0.193 | stop | −1.000 | 0.035 | 0.023 | −1.058 |
| dec | 2023 | 2023-07-03 | 2023-07-24 | 0.2342 | 0.2567 | 0.2567 | stop | −1.000 | 0.021 | 0.019 | −1.040 |
| dec | 2024 | 2024-07-01 | 2024-09-20 | 0.2036 | 0.218 | 0.2189 | stop-gap | −1.066 | 0.028 | 0.097 | −1.191 |
| dec | 2025 | 2025-07-01 | 2025-09-30 | 0.1596 | 0.1712 | 0.1599 | window | −0.027 | 0.027 | 0.104 | −0.159 |
| dec | 2026 | 2026-07-01 | 2026-08-07 | 0.1439 | 0.1534 | 0.1534 | stop | −1.000 | 0.030 | 0.050 | −1.080 |
| rep | 2003 | 2003-07-01 | 2003-07-18 | 0.0641 | 0.0693 | 0.0693 | stop | −1.000 | 0.025 | 0.020 | −1.045 |
| rep | 2004 | 2004-07-01 | 2004-07-12 | 0.0711 | 0.0776 | 0.0776 | stop | −1.000 | 0.022 | 0.009 | −1.031 |
| rep | 2005 | 2005-07-01 | 2005-07-21 | 0.0924 | 0.0967 | 0.0967 | stop | −1.000 | 0.042 | 0.036 | −1.078 |
| rep | 2006 | 2006-07-03 | 2006-09-29 | 0.1616 | 0.1704 | 0.111 | window | +5.735 | 0.037 | 0.137 | +5.561 |
| rep | 2007 | 2007-07-02 | 2007-07-19 | 0.0916 | 0.1008 | 0.1008 | stop | −1.000 | 0.020 | 0.016 | −1.036 |
| rep | 2008 | 2008-07-01 | 2008-08-01 | 0.1182 | 0.1323 | 0.1323 | stop | −1.000 | 0.017 | 0.023 | −1.040 |
| rep | 2009 | 2009-07-01 | 2009-08-03 | 0.17 | 0.1839 | 0.1839 | stop | −1.000 | 0.025 | 0.034 | −1.059 |
| rep | 2010 | 2010-07-01 | 2010-07-22 | 0.1618 | 0.1803 | 0.1803 | stop | −1.000 | 0.017 | 0.016 | −1.033 |
| rep | 2011 | 2011-07-01 | 2011-07-07 | 0.2702 | 0.2989 | 0.2989 | stop | −1.000 | 0.019 | 0.005 | −1.024 |
| rep | 2012 | 2012-07-02 | 2012-07-19 | 0.2177 | 0.2374 | 0.2374 | stop | −1.000 | 0.022 | 0.018 | −1.040 |
| rep | 2013 | 2013-07-01 | 2013-09-25 | 0.1672 | 0.1762 | 0.1762 | stop | −1.000 | 0.037 | 0.136 | −1.173 |
| rep | 2014 | 2014-07-01 | 2014-09-30 | 0.1721 | 0.1797 | 0.14 | window | +4.199 | 0.045 | 0.170 | +3.984 |
| rep | 2015 | 2015-07-01 | 2015-09-30 | 0.1208 | 0.1288 | 0.1201 | window | +0.094 | 0.030 | 0.117 | −0.053 |


## What it means, and what it does not

- **One of three passes.** The published idea, taken as written, holds on these prices for soybeans only. Corn has the
  right sign in both samples but is far from the bar (its best start month on 2016-26 is May, not July); wheat's June to
  August short loses on 2016-26 (7 of 11 years stopped) and so does every other start month: wheat simply rose against a
  3-ATR short most summers. The sugar control (no harvest story) loses in the same months.
- **n is small.** One trade a year: 11 decisive years, 13 replication years. The per-year t of the soybean short is 1.38 on
  2016-26 and 1.83 on 2003-15; the permutation p is strong because July is the best start month in both samples, not because
  each year is reliable. Three of eleven decisive years were stopped (2017, 2020, 2026), each about −1R in days.
- **Not untouched.** The soybean pre-harvest decline has been in print for decades, so the 2003-15 years are likely part of
  what its authors saw; 2016-26 is the honest sample, and 11 years cannot prove an edge.
- **Costs are assumptions.** The spread (0.20 %) and the financing charge (3 % a year) are conservative guesses; the broker's
  real figures for these CFDs were not measured. The verdict holds from 0 to 2x.
- **What a pass allows.** By the pre-registration, a candidate for a paper shadow the owner decides on, with these n and p
  beside it. Nothing live changed; no market was added to any rule. A forward record would add one trade a year.

## Files

- `PREREGISTRATION.md` (committed first), `run.mjs` (`node run.mjs fetch <dir>` copies the four candle files out of the
  `council-data` branch with `git show`, no network; `node run.mjs full <dir>` writes `result.json`), `result.json`.
- Test: `tests/grain-seasonality.test.mjs` (window selection, the stop, no look-ahead, the permutation p and Holm, this report
  against `result.json`).
