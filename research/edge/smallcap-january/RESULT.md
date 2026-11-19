**Verdict: FAIL, 0 of 2.** Long US2000 against short SPX500 at the turn of the year lost after costs in both samples and both
windows: T1 (5th-to-last December day to the 10th January day) −0.100R a turn on 2016-26 (6 of 11 won, permutation p 0.218,
Holm p 0.435) and −0.095R on 2004-15; T2 (last December day to last January day) −0.304R on 2016-26 (6 of 11, p 0.449, Holm
p 0.449) and −0.061R on 2004-15. Before costs T1 is +0.06R a turn, about zero. n is 11 turns in the decisive sample, and the
effect was published over thirty years before it began: no small-cap January premium is visible on these CFDs.

# Small caps at the turn of the year: long US2000, short SPX500 on OANDA CFDs (14 Nov 2026)

Paper research only. No live rule, size, filter, stop, config, market list or council member was changed, and no market was
added to any trading rule. The windows, sizing, stops, costs, tests and pass bar were committed alone, before any price was
read (`PREREGISTRATION.md`, commit 73798fbd). Anything not named there is marked post-hoc below.

## What was tested

The turn-of-the-year (January) effect: small US stocks beating large ones in late December and January, linked to tax-loss
selling (Keim 1983, Reinganum 1983, Roll 1983), and later found much weaker after publication (for example Schwert 2003).
On OANDA mid daily CFD candles of the council's cache (`research/daily/us2000|spx500|nas100.json`, 24 March 2003 to 6 November
2026; weekend buckets folded into the next weekday):

- the pair: long US2000, short SPX500, entered at the close of the entry day; each leg's 1R = 3 x ATR(20) of its own candles
  (up to and including the entry candle); pair R = long-leg R + short-leg R;
- T1: entry at the close of the 5th-to-last US trading day of December, exit at the close of the 10th US trading day of
  January (14 US trading days held); T2: last US trading day of December to last US trading day of January (19 to 21 days);
  control C: the T1 window with NAS100 as the short leg (not judged);
- stops: per leg at 3 x ATR(20) (touch fills at the stop, a gapped open at the open, never better; a stopped leg is closed,
  the other stays on); a pair stop closes every open leg at a daily close where pair R is −1R or less (so a leg stopped at
  −1R also closes the other leg at that close unless it is in profit there);
- US trading days: weekdays less the NYSE's full closures, from `council/datacheck.mjs` `usHolidays` adjusted to the NYSE
  (MLK, Presidents', Memorial, Juneteenth from 2022, 4 July, Labor and Thanksgiving closed; 24 December and the day after
  Thanksgiving open; New Year on a Saturday closes nothing; special closures 11 Jun 2004, 2 Jan 2007, 29-30 Oct 2012,
  5 Dec 2018, 9 Jan 2025). No turn of the year had a data hole; a handful of days had a candle in one file only (`oneSided`);
- costs: a CFD round trip of 0.04 % of the entry price a leg, and financing on both legs at DGS2 + 2.5 % a year (DGS2 = the
  last weekly FRED value on or before the entry day from `macro/cache.json`; a fixed 4 % before 6 January 2006) per rollover
  night (`council/fills.mjs` `nights`), also shown at 0 and at 2x;
- decisive sample: turns whose window ends in 2016-2026 (11); replication: 2004-2015 (12, every earlier turn the data
  covers);
- p: the real mean against the same pair trade started at the close of every other US trading day of the December's
  calendar year and held the same number of US trading days, one start drawn per turn (200,000 draws, seed 20261114),
  one-sided; Holm over T1 and T2; a pass needs mean net R above 0 in both samples and a Holm-corrected decisive p under 0.05.

## The two tests and the control

| test | sample | turns | won | stopped (pair stop) | mean gross R | mean net R (base) | t (per year) | permutation p | rank of start offsets | placebo seeds at or above | Holm p |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | decisive 2016-26 | 11 | 6 of 11 | 4 (1) | +0.061 | −0.100 | −0.40 | 0.21754 | 53 of 250 | 11 of 40 | 0.43508 |
| T1 | replication 2004-15 | 12 | 5 of 12 | 4 (0) | +0.057 | −0.095 | −0.92 | 0.35442 | 66 of 177 | 6 of 40 |  |
| T2 | decisive 2016-26 | 11 | 6 of 11 | 8 (3) | −0.128 | −0.304 | −1.19 | 0.4494 | 119 of 250 | 19 of 40 | 0.4494 |
| T2 | replication 2004-15 | 12 | 6 of 12 | 9 (1) | +0.117 | −0.061 | −0.38 | 0.21092 | 50 of 177 | 3 of 40 |  |
| C | decisive 2016-26 | 11 | 7 of 11 | 4 (0) | +0.063 | −0.072 | −0.23 | 0.18478 | 34 of 250 | 9 of 40 | not judged |
| C | replication 2004-15 | 12 | 5 of 12 | 7 (0) | −0.019 | −0.141 | −0.86 | 0.5051 | 92 of 177 | 15 of 40 |  |

The rank places the real window among the start offsets counted back from the last US trading day of December (offset 1 =
that day; T1 is offset 5, T2 offset 1) that every turn of the sample has: 250 on 2016-26, 177 on 2004-15 (the 2004 turn's
null year, 2003, starts in March and needs 20 candles for its ATR). T1 sits 53rd of 250 on 2016-26, T2 119th. The best
offsets on 2016-26 are around 218-224 (starts in early February) for every pair: shown in `result.json` (`offsetBest`), not
tested, and of no meaning here. The placebo is a random start day of the same year per turn, same length (40 seeds).

## Costs and financing at 0, base and 2x

| test | sample | net R, no costs (x0) | p | net R, base (x1) | p | net R, double (x2) | p |
|---|---|---|---|---|---|---|---|
| T1 | decisive | +0.061 | 0.17978 | −0.100 | 0.21754 | −0.261 | 0.26278 |
| T1 | replication | +0.057 | 0.3097 | −0.095 | 0.35442 | −0.246 | 0.40345 |
| T2 | decisive | −0.128 | 0.43184 | −0.304 | 0.4494 | −0.480 | 0.46759 |
| T2 | replication | +0.117 | 0.20654 | −0.061 | 0.21092 | −0.239 | 0.21801 |
| C | decisive | +0.063 | 0.15543 | −0.072 | 0.18478 | −0.207 | 0.21804 |
| C | replication | −0.019 | 0.47555 | −0.141 | 0.5051 | −0.264 | 0.53558 |

No cost level changes the verdict: even with no costs at all T1's decisive p is 0.180 and T2's mean is negative on 2016-26.
Financing on both legs is the larger cost (about 0.03 to 0.47R a turn, more when rates are high); the spread is 0.01 to 0.04R.

## The legs, and two post-hoc diagnostics

Not in the pre-registration and never judged. "Relative return" is the plain % change of US2000 minus that of SPX500 (or
NAS100) from the entry close to the exit close, with no stops or sizing. "Pair stop only" is the same trade without the
per-leg stops, base costs.

| test | sample | placebo means, min to max | mean long-leg R | mean short-leg R | relative return, % (post-hoc) | years US2000 ahead (post-hoc) | pair stop only, mean net R (post-hoc) |
|---|---|---|---|---|---|---|---|
| T1 | decisive | −0.705 to +0.343 | +0.133 | −0.072 | +0.18 (t +0.18) | 5 of 11 | −0.281 |
| T1 | replication | −0.515 to +0.092 | +0.099 | −0.043 | −0.17 (t −0.32) | 6 of 12 | −0.221 |
| T2 | decisive | −0.761 to +0.138 | +0.134 | −0.262 | −0.44 (t −0.37) | 4 of 11 | −0.434 |
| T2 | replication | −0.576 to +0.092 | +0.022 | +0.095 | +0.35 (t +0.49) | 6 of 12 | −0.122 |
| C | decisive | −0.679 to +0.423 | +0.133 | −0.070 | +0.17 (t +0.15) | 6 of 11 | −0.193 |
| C | replication | −0.660 to +0.219 | +0.099 | −0.118 | −0.74 (t −1.62) | 3 of 12 | −0.241 |

Small caps did not beat large caps over these windows: US2000 finished ahead of SPX500 in 5 of 11 T1 windows and 4 of 11 T2
windows of 2016-26, and the mean relative return is within a fraction of a percent of zero with t under 0.5 for T1 and T2 (the control on 2004-15: −0.74 %, t −1.62, small caps behind).
Removing the per-leg stops makes every row worse, so the stops are not what lost the money. The per-leg stops do turn the
pair into a one-sided bet once a leg is stopped (2016, and 2022 in T2, turned a small-cap fall into a profit through the short leg):
the pre-registered design, reported as it is.

## Every turn of the year

Prices are the CFD closes (mid). "how": `window` = out at the exit close, `leg` / `leg-gap` = that leg's 3 x ATR stop (at
the stop / at a gapped open), `pair` = closed by the pair stop at that close.

### T1: US2000 vs SPX500, 5th-last December day to 10th January day

| sample | turn | entry day | exit day | US days | DGS2 % | long entry → exit | long how | long R | short entry → exit | short how | short R | gross R | spread R | financing R | net R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| dec | 2016 | 2015-12-24 | 2016-01-15 | 14 | 0.97 | 1151.732 → 1093.5065 | leg | −1.000 | 2059.8 → 1882.2 | window | +1.832 | +0.832 | 0.016 | 0.069 | +0.747 |
| dec | 2017 | 2016-12-23 | 2017-01-17 | 14 | 1.22 | 1369.53 → 1353.919 | window | −0.276 | 2264.2 → 2266.6 | window | −0.048 | −0.324 | 0.028 | 0.164 | −0.516 |
| dec | 2018 | 2017-12-22 | 2018-01-16 | 14 | 1.91 | 1541.922 → 1575.676 | window | +0.557 | 2683.8 → 2742.66 | leg | −1.000 | −0.443 | 0.028 | 0.153 | −0.625 |
| dec | 2019 | 2018-12-24 | 2019-01-15 | 14 | 2.63 | 1262.673 → 1444.31 | window | +1.520 | 2340.6 → 2534.85 | leg | −1.000 | +0.520 | 0.009 | 0.055 | +0.456 |
| dec | 2020 | 2019-12-24 | 2020-01-15 (pair stop 2020-01-08) | 14 | 1.63 | 1678.085 → 1631.894 | leg | −1.000 | 3226.2 → 3262 | pair | −0.510 | −1.510 | 0.033 | 0.158 | −1.701 |
| dec | 2021 | 2020-12-24 | 2021-01-15 | 14 | 0.13 | 2002.34 → 2112.98 | window | +0.919 | 3704.6 → 3755.5 | window | −0.392 | +0.527 | 0.018 | 0.072 | +0.438 |
| dec | 2022 | 2021-12-27 | 2022-01-14 | 14 | 0.71 | 2261.057 → 2165.488 | window | −0.497 | 4791.3 → 4674.1 | window | +0.466 | −0.032 | 0.012 | 0.054 | −0.098 |
| dec | 2023 | 2022-12-23 | 2023-01-17 | 14 | 4.31 | 1758.086 → 1880.179 | window | +0.930 | 3843.3 → 3980.9 | window | −0.549 | +0.380 | 0.011 | 0.123 | +0.245 |
| dec | 2024 | 2023-12-22 | 2024-01-16 | 14 | 4.31 | 2033.97 → 1930.112 | window | −0.883 | 4757.2 → 4771.6 | window | −0.113 | −0.996 | 0.022 | 0.234 | −1.251 |
| dec | 2025 | 2024-12-24 | 2025-01-16 | 14 | 4.3 | 2262.63 → 2264.848 | window | +0.018 | 6055 → 5943.6 | window | +0.630 | +0.648 | 0.021 | 0.245 | +0.382 |
| dec | 2026 | 2025-12-24 | 2026-01-15 | 14 | 3.48 | 2549.98 → 2679.62 | window | +1.174 | 6939.7 → 6960.2 | window | −0.110 | +1.064 | 0.024 | 0.218 | +0.822 |
| rep | 2004 | 2003-12-24 | 2004-01-15 | 14 | 4 | 553.517 → 588.444 | window | +1.199 | 1095.6 → 1125.63 | leg | −1.000 | +0.199 | 0.022 | 0.146 | +0.031 |
| rep | 2005 | 2004-12-27 | 2005-01-14 | 14 | 4 | 647.248 → 621.3492 | leg | −1.000 | 1205.4 → 1181 | window | +0.728 | −0.272 | 0.024 | 0.177 | −0.473 |
| rep | 2006 | 2005-12-23 | 2006-01-17 | 14 | 4 | 685.514 → 699.939 | window | +0.534 | 1270.3 → 1278.2 | window | −0.254 | +0.280 | 0.026 | 0.271 | −0.017 |
| rep | 2007 | 2006-12-22 | 2007-01-17 | 14 | 4.71 | 778.355 → 786.611 | window | +0.256 | 1409.6 → 1429.5 | window | −0.556 | −0.299 | 0.025 | 0.326 | −0.651 |
| rep | 2008 | 2007-12-24 | 2008-01-15 | 14 | 3.19 | 793.59 → 738.6437 | leg | −1.000 | 1497 → 1368.4 | window | +1.668 | +0.668 | 0.014 | 0.096 | +0.559 |
| rep | 2009 | 2008-12-24 | 2009-01-15 | 14 | 0.74 | 472.603 → 463.813 | window | −0.106 | 869.3 → 848.1 | window | +0.182 | +0.077 | 0.005 | 0.026 | +0.046 |
| rep | 2010 | 2009-12-24 | 2010-01-15 | 14 | 0.82 | 635.726 → 639.05 | window | +0.092 | 1126.8 → 1135.6 | window | −0.203 | −0.111 | 0.017 | 0.087 | −0.216 |
| rep | 2011 | 2010-12-27 | 2011-01-14 | 14 | 0.67 | 790.391 → 806.369 | window | +0.494 | 1258 → 1293.4 | window | −0.917 | −0.423 | 0.023 | 0.099 | −0.545 |
| rep | 2012 | 2011-12-23 | 2012-01-17 | 14 | 0.28 | 745.772 → 764.805 | window | +0.280 | 1265.9 → 1296.1 | window | −0.367 | −0.087 | 0.011 | 0.046 | −0.143 |
| rep | 2013 | 2012-12-24 | 2013-01-15 | 14 | 0.26 | 844.613 → 884.838 | window | +1.232 | 1426.2 → 1471.4 | window | −0.897 | +0.335 | 0.022 | 0.090 | +0.223 |
| rep | 2014 | 2013-12-24 | 2014-01-15 | 14 | 0.37 | 1161.922 → 1171.132 | window | +0.213 | 1834 → 1847.2 | window | −0.291 | −0.078 | 0.027 | 0.127 | −0.232 |
| rep | 2015 | 2014-12-24 | 2015-01-15 | 14 | 0.67 | 1210.583 → 1149.7479 | leg | −1.000 | 2085.4 → 1984 | window | +1.396 | +0.396 | 0.019 | 0.093 | +0.283 |

### T2: US2000 vs SPX500, last December day to last January day

| sample | turn | entry day | exit day | US days | DGS2 % | long entry → exit | long how | long R | short entry → exit | short how | short R | gross R | spread R | financing R | net R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| dec | 2016 | 2015-12-31 | 2016-01-29 | 19 | 1.03 | 1147.628 → 1088.3581 | leg | −1.000 | 2057.6 → 1935.6 | window | +1.237 | +0.237 | 0.016 | 0.070 | +0.152 |
| dec | 2017 | 2016-12-30 | 2017-01-31 (pair stop 2017-01-30) | 20 | 1.2 | 1357.363 → 1350.074 | pair | −0.129 | 2238.6 → 2288.235 | leg | −1.000 | −1.129 | 0.028 | 0.189 | −1.346 |
| dec | 2018 | 2017-12-29 | 2018-01-31 | 21 | 1.89 | 1530.628 → 1576.744 | window | +0.790 | 2666 → 2712.77 | leg | −1.000 | −0.210 | 0.033 | 0.145 | −0.389 |
| dec | 2019 | 2018-12-31 | 2019-01-31 | 21 | 2.52 | 1351.814 → 1500.251 | window | +1.157 | 2507 → 2703.4 | window | −0.905 | +0.251 | 0.009 | 0.100 | +0.142 |
| dec | 2020 | 2019-12-31 | 2020-01-31 (pair stop 2020-01-08) | 21 | 1.59 | 1672.13 → 1629.7511 | leg | −1.000 | 3236.4 → 3262 | pair | −0.407 | −1.407 | 0.036 | 0.102 | −1.545 |
| dec | 2021 | 2020-12-31 | 2021-01-29 | 19 | 0.13 | 1978.15 → 2063.926 | window | +0.682 | 3759.8 → 3705.1 | window | +0.428 | +1.111 | 0.018 | 0.094 | +0.998 |
| dec | 2022 | 2021-12-31 | 2022-01-31 | 20 | 0.73 | 2246.05 → 2085.6217 | leg | −1.000 | 4773.4 → 4501.1 | window | +1.346 | +0.346 | 0.015 | 0.084 | +0.247 |
| dec | 2023 | 2022-12-30 | 2023-01-31 | 20 | 4.41 | 1765.65 → 1929.604 | window | +1.357 | 3845.4 → 4076.64 | leg | −1.000 | +0.357 | 0.012 | 0.171 | +0.173 |
| dec | 2024 | 2023-12-29 | 2024-01-31 (pair stop 2024-01-18) | 21 | 4.23 | 2027.9 → 1915.8371 | leg | −1.000 | 4774.6 → 4787.1 | pair | −0.103 | −1.103 | 0.023 | 0.209 | −1.336 |
| dec | 2025 | 2024-12-31 | 2025-01-31 | 20 | 4.31 | 2234.93 → 2283.337 | window | +0.368 | 5899 → 6103.375 | leg | −1.000 | −0.632 | 0.018 | 0.234 | −0.885 |
| dec | 2026 | 2025-12-31 | 2026-01-30 | 20 | 3.46 | 2486.84 → 2619.2 | window | +1.250 | 6858 → 6942.8 | window | −0.477 | +0.774 | 0.025 | 0.304 | +0.445 |
| rep | 2004 | 2003-12-31 | 2004-01-30 | 20 | 4 | 556.853 → 580.086 | window | +0.791 | 1111.4 → 1141.805 | leg | −1.000 | −0.209 | 0.022 | 0.212 | −0.443 |
| rep | 2005 | 2004-12-31 | 2005-01-31 | 20 | 4 | 652.438 → 627.9043 | leg | −1.000 | 1208 → 1179.4 | window | +0.962 | −0.038 | 0.027 | 0.234 | −0.298 |
| rep | 2006 | 2005-12-30 | 2006-01-31 | 20 | 4 | 671.355 → 728.377 | window | +2.251 | 1247.2 → 1276.75 | leg | −1.000 | +1.251 | 0.027 | 0.179 | +1.044 |
| rep | 2007 | 2006-12-29 | 2007-01-31 | 20 | 4.82 | 787.774 → 799.533 | window | +0.390 | 1418.5 → 1437.1 | window | −0.582 | −0.192 | 0.028 | 0.467 | −0.687 |
| rep | 2008 | 2007-12-31 | 2008-01-31 | 21 | 3.12 | 763.62 → 710.9452 | leg | −1.000 | 1465.7 → 1370.1 | window | +1.351 | +0.351 | 0.014 | 0.123 | +0.214 |
| rep | 2009 | 2008-12-31 | 2009-01-30 | 20 | 0.89 | 495.434 → 445.965 | window | −0.641 | 896.1 → 828.5 | window | +0.650 | +0.009 | 0.006 | 0.042 | −0.039 |
| rep | 2010 | 2009-12-31 | 2010-01-29 | 19 | 1 | 627.838 → 600.841 | window | −0.877 | 1117.1 → 1071.5 | window | +1.194 | +0.316 | 0.020 | 0.138 | +0.159 |
| rep | 2011 | 2010-12-31 | 2011-01-31 (pair stop 2011-01-19) | 20 | 0.61 | 785.659 → 784.619 | pair | −0.040 | 1261.8 → 1290.615 | leg | −1.000 | −1.040 | 0.029 | 0.101 | −1.170 |
| rep | 2012 | 2011-12-30 | 2012-01-31 | 20 | 0.25 | 738.854 → 790.141 | window | +0.881 | 1258.9 → 1328.14 | leg | −1.000 | −0.119 | 0.012 | 0.064 | −0.195 |
| rep | 2013 | 2012-12-31 | 2013-01-31 | 21 | 0.27 | 850.281 → 903.988 | window | +1.507 | 1411.6 → 1466.83 | leg | −1.000 | +0.507 | 0.020 | 0.071 | +0.416 |
| rep | 2014 | 2013-12-31 | 2014-01-31 | 21 | 0.4 | 1165.575 → 1123.5088 | leg | −1.000 | 1847.2 → 1782.8 | window | +1.426 | +0.426 | 0.027 | 0.167 | +0.232 |
| rep | 2015 | 2014-12-31 | 2015-01-30 | 20 | 0.73 | 1215.844 → 1159.385 | leg | −1.000 | 2074.8 → 1993.8 | window | +1.136 | +0.136 | 0.020 | 0.085 | +0.031 |

### C: control: US2000 vs NAS100, the T1 window

| sample | turn | entry day | exit day | US days | DGS2 % | long entry → exit | long how | long R | short entry → exit | short how | short R | gross R | spread R | financing R | net R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| dec | 2016 | 2015-12-24 | 2016-01-15 | 14 | 0.97 | 1151.732 → 1093.5065 | leg | −1.000 | 4616.9 → 4149.6 | window | +2.022 | +1.022 | 0.016 | 0.066 | +0.940 |
| dec | 2017 | 2016-12-23 | 2017-01-17 | 14 | 1.22 | 1369.53 → 1353.919 | window | −0.276 | 4944.3 → 5041.6 | window | −0.611 | −0.887 | 0.022 | 0.130 | −1.039 |
| dec | 2018 | 2017-12-22 | 2018-01-16 | 14 | 1.91 | 1541.922 → 1575.676 | window | +0.557 | 6465.8 → 6676.655 | leg | −1.000 | −0.443 | 0.022 | 0.126 | −0.592 |
| dec | 2019 | 2018-12-24 | 2019-01-15 | 14 | 2.63 | 1262.673 → 1444.31 | window | +1.520 | 5871 → 6456.66 | leg | −1.000 | +0.520 | 0.008 | 0.052 | +0.459 |
| dec | 2020 | 2019-12-24 | 2020-01-15 | 14 | 1.63 | 1678.085 → 1631.894 | leg | −1.000 | 8710.4 → 8947.715 | leg | −1.000 | −2.000 | 0.029 | 0.140 | −2.170 |
| dec | 2021 | 2020-12-24 | 2021-01-15 | 14 | 0.13 | 2002.34 → 2112.98 | window | +0.919 | 12711.2 → 12774.7 | window | −0.121 | +0.798 | 0.016 | 0.065 | +0.717 |
| dec | 2022 | 2021-12-27 | 2022-01-14 | 14 | 0.71 | 2261.057 → 2165.488 | window | −0.497 | 16573.6 → 15633 | window | +0.815 | +0.318 | 0.010 | 0.046 | +0.261 |
| dec | 2023 | 2022-12-23 | 2023-01-17 | 14 | 4.31 | 1758.086 → 1880.179 | window | +0.930 | 10974.2 → 11523.2 | window | −0.606 | +0.323 | 0.010 | 0.109 | +0.203 |
| dec | 2024 | 2023-12-22 | 2024-01-16 | 14 | 4.31 | 2033.97 → 1930.112 | window | −0.883 | 16793.8 → 16858.4 | window | −0.104 | −0.987 | 0.018 | 0.190 | −1.195 |
| dec | 2025 | 2024-12-24 | 2025-01-16 | 14 | 4.3 | 2262.63 → 2264.848 | window | +0.018 | 21856.6 → 21103.4 | window | +0.766 | +0.784 | 0.016 | 0.189 | +0.579 |
| dec | 2026 | 2025-12-24 | 2026-01-15 | 14 | 3.48 | 2549.98 → 2679.62 | window | +1.174 | 25676.7 → 25609.4 | window | +0.070 | +1.244 | 0.020 | 0.180 | +1.044 |
| rep | 2004 | 2003-12-24 | 2004-01-15 | 14 | 4 | 553.517 → 588.444 | window | +1.199 | 1445.5 → 1518.85 | leg | −1.000 | +0.199 | 0.015 | 0.127 | +0.056 |
| rep | 2005 | 2004-12-27 | 2005-01-14 | 14 | 4 | 647.248 → 621.3492 | leg | −1.000 | 1607.3 → 1556.4 | window | +0.738 | −0.262 | 0.019 | 0.132 | −0.413 |
| rep | 2006 | 2005-12-23 | 2006-01-17 | 14 | 4 | 685.514 → 699.939 | window | +0.534 | 1684 → 1743.25 | leg | −1.000 | −0.466 | 0.022 | 0.180 | −0.668 |
| rep | 2007 | 2006-12-22 | 2007-01-17 | 14 | 4.71 | 778.355 → 786.611 | window | +0.256 | 1745 → 1824.275 | leg | −1.000 | −0.744 | 0.018 | 0.211 | −0.973 |
| rep | 2008 | 2007-12-24 | 2008-01-15 | 14 | 3.19 | 793.59 → 738.6437 | leg | −1.000 | 2126.9 → 1858.1 | window | +2.173 | +1.173 | 0.013 | 0.088 | +1.072 |
| rep | 2009 | 2008-12-24 | 2009-01-15 | 14 | 0.74 | 472.603 → 463.813 | window | −0.106 | 1180.5 → 1185.4 | window | −0.032 | −0.138 | 0.005 | 0.026 | −0.169 |
| rep | 2010 | 2009-12-24 | 2010-01-15 | 14 | 0.82 | 635.726 → 639.05 | window | +0.092 | 1870.2 → 1864.2 | window | +0.075 | +0.167 | 0.016 | 0.082 | +0.069 |
| rep | 2011 | 2010-12-27 | 2011-01-14 | 14 | 0.67 | 790.391 → 806.369 | window | +0.494 | 2232.9 → 2310.375 | leg | −1.000 | −0.506 | 0.021 | 0.090 | −0.617 |
| rep | 2012 | 2011-12-23 | 2012-01-17 | 14 | 0.28 | 745.772 → 764.805 | window | +0.280 | 2283.2 → 2396.2 | window | −0.732 | −0.452 | 0.010 | 0.045 | −0.507 |
| rep | 2013 | 2012-12-24 | 2013-01-15 | 14 | 0.26 | 844.613 → 884.838 | window | +1.232 | 2657.1 → 2723.6 | window | −0.592 | +0.640 | 0.020 | 0.082 | +0.538 |
| rep | 2014 | 2013-12-24 | 2014-01-15 | 14 | 0.37 | 1161.922 → 1171.132 | window | +0.213 | 3575.1 → 3604.8 | window | −0.308 | −0.095 | 0.026 | 0.121 | −0.241 |
| rep | 2015 | 2014-12-24 | 2015-01-15 | 14 | 0.67 | 1210.583 → 1149.7479 | leg | −1.000 | 4286.4 → 4069.4 | window | +1.262 | +0.262 | 0.018 | 0.086 | +0.158 |

## What it means, and what it does not

- **No turn-of-the-year premium on these instruments.** Neither the late-December-to-mid-January window nor the classic
  January window made money after costs, in 2016-26 or in 2004-15, and the real windows rank in the middle of the
  same-length trades started on any other day of the year. Before costs both are near zero.
- **n is small.** One trade a year: 11 decisive and 12 replication turns a test. A real effect of a few tenths of an R a turn
  could hide in this noise (the per-year t of T1 is −0.40); the study can only say none is visible, not that none exists.
- **Not untouched, and long published.** The January effect was in print from 1983 and widely traded long before 2004.
  Both samples come after publication; this measures whether the published trade still pays on a CFD pair, which the
  later literature (for example Schwert 2003) already doubted.
- **What was measured.** Index CFDs: the Russell 2000 against the S&P 500 at daily closes. Not individual small stocks, not
  the smallest decile (where the original effect was strongest), not tax-loss losers, not futures or ETFs, not other countries.
- **Costs are assumptions.** The spread (0.04 % a round trip a leg) and financing (DGS2 + 2.5 % on both legs) are the
  pre-registered model, not the broker's measured figures; the verdict holds from no costs to double costs.
- **What it allows.** Nothing: not a candidate for a paper shadow. No market was added to any rule and nothing live changed.

## Related

- `research/edge/grain-seasonality` (another one-trade-a-year calendar study, same house style; this study copies its
  statistics code, it does not import it).
- The `ict-jan` branch is unrelated: despite the name it moves the ICT desk's replay start to 1 January 2026 and holds no
  January-effect study.

## Files

- `PREREGISTRATION.md` (committed first), `run.mjs` (`node run.mjs fetch <dir>` copies the three candle files and DGS2 out of
  the `council-data` branch with `git show`, no network; `node run.mjs full <dir>` writes `result.json`), `result.json`.
- Test: `tests/smallcap-january.test.mjs` (the NYSE calendar and window selection with holidays, the leg and pair stops, no
  look-ahead, Holm, this report against `result.json`).
