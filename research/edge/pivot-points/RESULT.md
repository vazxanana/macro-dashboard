# Floor-trader pivot points as intraday support and resistance: result

**Verdict: FAIL: fading R1/S1 to P made -0.144R a trade net out of sample (n 11294, t -13.05; in sample -0.135R); placebo 95th pct -0.109R; 0 of 8 tests pass.**

Pre-registered in PREREGISTRATION.md (committed and pushed before any candle was read). Ten markets (spx500, nas100, us30, de40, uk100, eurusd, gbpusd, usdjpy, audusd, xag), OANDA mid M5;
in sample 2016-01-01 to 2020-12-31, out of sample 2021-01-01 to 2026-11-13. Levels from the prior day: the 17:00 New York day for forex and silver, the prior
cash session for indices (US 09:30-16:00 New York, DAX 09:00-17:30 Frankfurt, FTSE 08:00-16:30 London). Gold left out (item 44).
Costs: round trip forex 0.015 %, indices 0.04 %, silver 0.10 % of the entry price, in R by each trade's own risk; no financing (every trade is flat before its session ends). t on calendar-month sums; Holm over the eight tests; placebo = the whole ladder shifted by a random 0.3-0.7 x (R1 - P), 40 seeds.
Paper research only: nothing live changed.

## The eight tests

| Test | Window | n | Gross R a trade | Net R a trade | t (months, net) | t (months, gross) | Total net R | Win rate | Net at 2x costs |
|---|---|---|---|---|---|---|---|---|---|
| T1 all | in sample | 9277 | −0.010 | −0.135 | -9.71 | -0.75 | −1255.5 | 40.3 % | −0.260 |
| T1 all | out of sample | 11294 | −0.030 | −0.144 | -13.05 | -2.76 | −1630.0 | 39.9 % | −0.258 |
| T1 indices | in sample | 3818 | −0.021 | −0.175 | -8.52 | -1.09 | −667.2 | 40.3 % | −0.328 |
| T1 indices | out of sample | 4880 | −0.002 | −0.140 | -8.15 | -0.09 | −682.3 | 41.2 % | −0.278 |
| T1 forex | in sample | 4451 | +0.003 | −0.079 | -3.92 | 0.16 | −349.8 | 40.7 % | −0.160 |
| T1 forex | out of sample | 5154 | −0.049 | −0.133 | -7.86 | -2.90 | −683.9 | 39.2 % | −0.216 |
| T1 metals | in sample | 1008 | −0.030 | −0.237 | -6.43 | -0.81 | −238.5 | 38.3 % | −0.443 |
| T1 metals | out of sample | 1260 | −0.063 | −0.209 | -6.60 | -1.96 | −263.8 | 37.5 % | −0.356 |
| T2 all | in sample | 8359 | +0.071 | −0.156 | -8.12 | 3.84 | −1303.7 | 34.9 % | −0.383 |
| T2 all | out of sample | 10307 | +0.028 | −0.184 | -9.62 | 1.67 | −1893.9 | 33.0 % | −0.396 |
| T2 indices | in sample | 3378 | +0.126 | −0.142 | -4.21 | 3.85 | −481.0 | 37.4 % | −0.411 |
| T2 indices | out of sample | 4348 | +0.037 | −0.214 | -8.26 | 1.67 | −928.8 | 34.5 % | −0.464 |
| T2 forex | in sample | 4064 | +0.019 | −0.136 | -4.75 | 0.69 | −554.3 | 32.9 % | −0.292 |
| T2 forex | out of sample | 4801 | +0.009 | −0.152 | -5.54 | 0.34 | −729.8 | 31.8 % | −0.313 |
| T2 metals | in sample | 917 | +0.096 | −0.293 | -5.33 | 1.88 | −268.4 | 34.5 % | −0.682 |
| T2 metals | out of sample | 1158 | +0.073 | −0.203 | -3.74 | 1.43 | −235.3 | 32.7 % | −0.479 |

T1: fade: limit at the first touch of R1 (sell) or S1 (buy), stop 0.25 x ATR(14) past the level, target P, flat at session end. T2: break: first M5 close beyond R1 (buy) or S1 (sell), market at the next open, stop 0.1 x ATR(14) back past the level, target R2 / S2, flat at session end.

## The pass bar (T1 all = primary; the rest secondary)

| Test | Verdict | OOS n >= 300 | OOS net > 0 | OOS month t >= 2 | Holm p < 0.05 | IS net > 0 | OOS net at 2x costs > 0 | above placebo 95th pct | p (one-sided) | Holm p |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 all | FAIL | yes | no | no | no | no | no | no | 1 | 1 |
| T1 indices | FAIL | yes | no | no | no | no | no | no | 1 | 1 |
| T1 forex | FAIL | yes | no | no | no | no | no | no | 1 | 1 |
| T1 metals | FAIL | yes | no | no | no | no | no | no | 1 | 1 |
| T2 all | FAIL | yes | no | no | no | no | no | yes | 1 | 1 |
| T2 indices | FAIL | yes | no | no | no | no | no | no | 1 | 1 |
| T2 forex | FAIL | yes | no | no | no | no | no | no | 1 | 1 |
| T2 metals | FAIL | yes | no | no | no | no | no | yes | 0.99991 | 1 |

## Placebo: ladder shifted by 0.3-0.7 x (R1 - P), out of sample, 40 seeds

| Test | Real net R a trade | Placebo mean | Placebo 95th pct | Placebo range | Real gross | Placebo gross mean | Real rank among 41 |
|---|---|---|---|---|---|---|---|
| T1 all | −0.144 | −0.123 | −0.109 | −0.147 to −0.104 | −0.030 | −0.011 | 39 |
| T1 indices | −0.140 | −0.154 | −0.132 | −0.184 to −0.126 | −0.002 | −0.016 | 8 |
| T1 forex | −0.133 | −0.095 | −0.074 | −0.125 to −0.072 | −0.049 | −0.012 | 41 |
| T1 metals | −0.209 | −0.136 | −0.086 | −0.187 to −0.061 | −0.063 | +0.010 | 41 |
| T2 all | −0.184 | −0.200 | −0.184 | −0.228 to −0.180 | +0.028 | +0.012 | 3 |
| T2 indices | −0.214 | −0.219 | −0.191 | −0.263 to −0.182 | +0.037 | +0.032 | 21 |
| T2 forex | −0.152 | −0.165 | −0.135 | −0.226 to −0.121 | +0.009 | +0.001 | 13 |
| T2 metals | −0.203 | −0.291 | −0.233 | −0.350 to −0.217 | +0.073 | −0.005 | 1 |

## Per market (net R a trade, n, t on months)

| Rule | Market | IS net | n | IS gross | t | OOS net | n | OOS gross | t |
|---|---|---|---|---|---|---|---|---|---|
| T1 | spx500 | −0.172 | 696 | +0.008 | -4.36 | −0.189 | 952 | −0.045 | -5.68 |
| T1 | nas100 | −0.159 | 772 | −0.027 | -3.74 | −0.115 | 952 | −0.012 | -3.17 |
| T1 | us30 | −0.205 | 720 | −0.024 | -5.72 | −0.132 | 1027 | +0.015 | -3.33 |
| T1 | de40 | −0.155 | 805 | −0.029 | -3.99 | −0.150 | 972 | −0.016 | -4.32 |
| T1 | uk100 | −0.185 | 825 | −0.030 | -4.94 | −0.115 | 977 | +0.048 | -3.23 |
| T1 | eurusd | −0.083 | 1117 | +0.011 | -2.47 | −0.126 | 1306 | −0.029 | -3.68 |
| T1 | gbpusd | −0.098 | 1120 | −0.025 | -2.49 | −0.106 | 1290 | −0.019 | -3.48 |
| T1 | usdjpy | −0.094 | 1093 | −0.003 | -2.86 | −0.190 | 1252 | −0.107 | -6.50 |
| T1 | audusd | −0.040 | 1121 | +0.031 | -1.05 | −0.111 | 1306 | −0.044 | -3.58 |
| T1 | xag | −0.237 | 1008 | −0.030 | -6.43 | −0.209 | 1260 | −0.063 | -6.60 |
| T2 | spx500 | −0.130 | 614 | +0.193 | -1.96 | −0.123 | 848 | +0.135 | -2.63 |
| T2 | nas100 | −0.082 | 667 | +0.146 | -1.38 | −0.058 | 818 | +0.123 | -1.37 |
| T2 | us30 | −0.185 | 634 | +0.125 | -2.61 | −0.304 | 921 | −0.042 | -6.58 |
| T2 | de40 | −0.159 | 713 | +0.059 | -2.73 | −0.156 | 882 | +0.089 | -2.77 |
| T2 | uk100 | −0.154 | 750 | +0.118 | -2.13 | −0.408 | 879 | −0.105 | -6.48 |
| T2 | eurusd | −0.109 | 1008 | +0.065 | -2.07 | −0.164 | 1196 | +0.021 | -3.47 |
| T2 | gbpusd | −0.076 | 1010 | +0.061 | -1.40 | −0.211 | 1219 | −0.041 | -3.84 |
| T2 | usdjpy | −0.165 | 1010 | +0.010 | -3.69 | −0.065 | 1162 | +0.094 | -1.34 |
| T2 | audusd | −0.194 | 1036 | −0.059 | -3.88 | −0.164 | 1224 | −0.033 | -3.90 |
| T2 | xag | −0.293 | 917 | +0.096 | -5.33 | −0.203 | 1158 | +0.073 | -3.74 |

## By year, all markets (net R a trade / total net R, n)

| Year | T1 | T2 |
|---|---|---|
| 2016 | −0.096 / −182.4 (n 1900) | −0.140 / −237.9 (n 1699) |
| 2017 | −0.141 / −259.2 (n 1841) | −0.176 / −283.8 (n 1611) |
| 2018 | −0.147 / −280.5 (n 1914) | −0.147 / −255.3 (n 1733) |
| 2019 | −0.158 / −291.0 (n 1846) | −0.205 / −343.0 (n 1677) |
| 2020 | −0.136 / −242.4 (n 1776) | −0.112 / −183.6 (n 1639) |
| 2021 | −0.158 / −304.5 (n 1921) | −0.210 / −363.1 (n 1731) |
| 2022 | −0.119 / −227.8 (n 1921) | −0.079 / −141.0 (n 1777) |
| 2023 | −0.145 / −290.7 (n 2010) | −0.203 / −374.7 (n 1843) |
| 2024 | −0.144 / −275.1 (n 1904) | −0.228 / −393.6 (n 1724) |
| 2025 | −0.140 / −265.9 (n 1896) | −0.210 / −362.5 (n 1725) |
| 2026 | −0.162 / −265.9 (n 1642) | −0.172 / −259.0 (n 1507) |

## Exits, out of sample

- T1: stop 5779, target 3071, time 2444
- T2: target 2715, stop 6510, time 1082

## Data

| Market | Candles | First | Last | Valid sessions |
|---|---|---|---|---|
| spx500 | 759523 | 2015-11-01 23:00 | 2026-11-13 21:55 | 2750 |
| nas100 | 776795 | 2015-11-01 23:00 | 2026-11-13 21:55 | 2751 |
| us30 | 776551 | 2015-11-01 23:00 | 2026-11-13 21:55 | 2750 |
| de40 | 618809 | 2015-11-02 07:00 | 2026-11-13 20:55 | 2800 |
| uk100 | 661084 | 2015-11-02 01:00 | 2026-11-13 20:55 | 2766 |
| eurusd | 822008 | 2015-11-01 22:00 | 2026-11-13 21:55 | 2861 |
| gbpusd | 821468 | 2015-11-01 22:00 | 2026-11-13 21:55 | 2861 |
| usdjpy | 822384 | 2015-11-01 22:00 | 2026-11-13 21:55 | 2861 |
| audusd | 818804 | 2015-11-01 22:00 | 2026-11-13 21:55 | 2858 |
| xag | 767225 | 2015-11-01 23:00 | 2026-11-13 21:55 | 2786 |

## Reading

- **Fade (T1, primary)**: gross R a trade is about zero in both windows (−0.010R in sample, −0.030R out of sample) and the real
  pivots rank 39th of 41 against the shifted ladders: price does not reverse at R1 / S1 more than at any nearby price. After
  costs every pool loses (out of sample −0.144R a trade, t −13.05). The cost is large in R because the fade's stop is only a
  quarter of a daily ATR.
- **Break (T2)**: before costs the break made a little (all markets +0.071R in sample, t 3.84; +0.028R out of sample, t 1.67),
  about what any intraday breakout earns; the real levels are not clearly better than the placebo's (rank 3 of 41 for all
  markets, 21 for indices). After costs it loses in every pool and window. Silver's T2 is above its placebo but loses −0.203R
  a trade net out of sample.
- Not an edge in either direction. Nothing live changed; no proposal is written.

To repeat: `node --use-env-proxy research/edge/pivot-points/run.mjs fetch <dir>` (candles outside git), then `node research/edge/pivot-points/run.mjs full <dir>`. Tests: `tests/pivot-points.test.mjs`.
