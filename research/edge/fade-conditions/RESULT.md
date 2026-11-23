# Where the fade tilt lives: two fade rules split by fixed conditions (result)

**Verdict: PASS. 5 of 10 primary tests pass before costs; strongest R1 hour: 20-23 minus 08-11 +0.153R a trade in 2015-26 (n 27,671 vs 32,643, Welch t 12.47, Holm p < 0.001; month-level t 10.30); after costs no level is positive in both windows.**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants.

## What was run

`grid7-wide-fade`'s cells `m15 none atr 2R all` (R1) and `h1 none ext 2R all` (R2), by its own code (imported): fade the
first structure break at the next 5-minute open, 2R target. Each trade is tagged at the break candle's close, from closed
candles only, by five fixed conditions: hour block (UTC), volatility regime (ATR14 / its 100-candle median), Daily trend
(20-day efficiency ratio band x with / against the 20-day direction), break-candle body / ATR, day of week. In discovery
(2005-14) the best and worst level of each split (n >= 300) were picked; in confirmation (2015 to Oct 2026) their difference
was tested once (Welch t, one-sided), Holm over the 10 primary tests. Ten markets pooled, OANDA mid 5-minute candles.
Costs beside: the demo figures for gold and the four majors; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy.

## Gate

- m15 none atr 2R all: discovery n 171,523 mean +0.054 (grid 171,523, +0.054); confirmation n 201,769 mean +0.042 (grid 201,769, +0.042): equal.
- h1 none ext 2R all: discovery n 43,062 mean +0.105 (grid 43,062, +0.105); confirmation n 50,178 mean +0.040 (grid 50,178, +0.040): equal.

## Primary tests

Best and worst level picked in discovery; the difference in confirmation is the test. Welch t on per-trade R; "month t" = t of
the per-month difference of mean R over months where both levels traded (trades overlap, so the per-trade t can overstate).

| Rule | Split | Best (disc) | Worst (disc) | Diff 05-14 (t) | Diff 15-26 (Welch t) | Holm p | Month t 15-26 | Diff after costs 15-26 | Pass |
|---|---|---|---|---:|---:|---:|---:|---:|---|
| m15 none atr 2R all | hour | 20-23 | 08-11 | +0.219 (17.58) | +0.153 (12.47) | 6.2e-35 | 10.30 | +0.110 | yes |
| m15 none atr 2R all | vol | low | high | +0.092 (9.86) | +0.055 (6.23) | 2.1e-9 | 4.95 | -0.039 | yes |
| m15 none atr 2R all | trend | mid-against | trend-with | +0.050 (3.40) | +0.019 (1.34) | 0.448 | -1.08 | +0.022 | no |
| m15 none atr 2R all | body | medium | large | +0.022 (2.88) | +0.008 (1.07) | 0.448 | 1.06 | +0.013 | no |
| m15 none atr 2R all | dow | Mon | Tue | +0.042 (3.92) | +0.033 (3.34) | 0.003 | 3.01 | +0.029 | yes |
| h1 none ext 2R all | hour | 20-23 | 08-11 | +0.378 (13.20) | +0.176 (6.19) | 2.5e-9 | 5.53 | +0.196 | yes |
| h1 none ext 2R all | vol | high | low | +0.033 (1.45) | +0.005 (0.25) | 0.804 | 0.36 | +0.111 | no |
| h1 none ext 2R all | trend | mid-against | trend-with | +0.066 (2.20) | -0.028 (-1.01) | 0.843 | -1.04 | -0.015 | no |
| h1 none ext 2R all | body | small | large | +0.111 (5.51) | +0.046 (2.60) | 0.028 | 2.34 | +0.049 | yes |
| h1 none ext 2R all | dow | Mon | Tue | +0.066 (3.09) | +0.025 (1.22) | 0.448 | 1.22 | +0.022 | no |

Passing: R1 hour; R1 vol; R1 dow; R2 hour; R2 body.

## Every level

R a trade before costs (month-sum t), win share, after costs beside; * = mean R > 0 in both windows, ** = and month t >= 2 in both.

### m15 none atr 2R all · hour

| Level | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | win 15-26 | net 15-26 | cost R 15-26 | |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 00-03 | 27,351 | +0.034 (2.88) | -0.125 | 35,667 | +0.026 (2.62) | 34.2% | -0.157 | 0.183 | ** |
| 04-07 | 33,549 | +0.040 (4.03) | -0.128 | 39,924 | +0.016 (1.96) | 33.9% | -0.169 | 0.186 | * |
| 08-11 | 27,595 | -0.015 (-1.36) | -0.149 | 32,643 | +0.017 (1.78) | 33.9% | -0.125 | 0.141 |  |
| 12-15 | 32,796 | -0.002 (-0.17) | -0.118 | 39,185 | +0.001 (0.15) | 33.7% | -0.128 | 0.130 |  |
| 16-19 | 23,957 | +0.089 (7.41) | -0.029 | 26,679 | +0.063 (5.18) | 36.8% | -0.074 | 0.136 | ** |
| 20-23 | 26,275 | +0.204 (18.01) | +0.046 | 27,671 | +0.169 (14.09) | 39.3% | -0.015 | 0.184 | ** |

### m15 none atr 2R all · vol

| Level | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | win 15-26 | net 15-26 | cost R 15-26 | |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| low | 51,193 | +0.091 (11.09) | -0.098 | 59,840 | +0.067 (9.98) | 35.7% | -0.141 | 0.208 | ** |
| mid | 77,478 | +0.061 (9.14) | -0.070 | 93,780 | +0.042 (8.38) | 34.9% | -0.112 | 0.154 | ** |
| high | 42,843 | -0.001 (-0.17) | -0.110 | 48,149 | +0.012 (1.46) | 34.5% | -0.102 | 0.114 |  |

### m15 none atr 2R all · trend

| Level | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | win 15-26 | net 15-26 | cost R 15-26 | |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| range-with | 42,738 | +0.055 (6.69) | -0.084 | 51,393 | +0.032 (4.98) | 34.7% | -0.130 | 0.163 | ** |
| range-against | 42,558 | +0.061 (7.02) | -0.080 | 50,756 | +0.045 (6.89) | 35.2% | -0.117 | 0.162 | ** |
| mid-with | 28,701 | +0.046 (4.77) | -0.097 | 34,143 | +0.045 (5.61) | 35.1% | -0.115 | 0.160 | ** |
| mid-against | 28,503 | +0.071 (7.31) | -0.071 | 33,377 | +0.058 (5.75) | 35.5% | -0.100 | 0.157 | ** |
| trend-with | 14,412 | +0.021 (1.33) | -0.129 | 16,106 | +0.039 (3.42) | 34.9% | -0.122 | 0.161 | * |
| trend-against | 14,369 | +0.047 (3.22) | -0.098 | 15,977 | +0.031 (2.21) | 34.7% | -0.126 | 0.157 | ** |

### m15 none atr 2R all · body

| Level | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | win 15-26 | net 15-26 | cost R 15-26 | |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| small | 29,521 | +0.063 (6.15) | -0.078 | 38,532 | +0.046 (5.27) | 35.4% | -0.115 | 0.160 | ** |
| medium | 57,584 | +0.066 (9.29) | -0.071 | 72,018 | +0.046 (7.86) | 35.2% | -0.112 | 0.157 | ** |
| large | 84,418 | +0.043 (7.91) | -0.104 | 91,219 | +0.038 (7.28) | 34.8% | -0.125 | 0.163 | ** |

### m15 none atr 2R all · dow

| Level | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | win 15-26 | net 15-26 | cost R 15-26 | |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Mon | 39,947 | +0.078 (9.31) | -0.072 | 43,695 | +0.056 (6.59) | 35.2% | -0.110 | 0.166 | ** |
| Tue | 33,740 | +0.036 (3.25) | -0.106 | 40,634 | +0.023 (3.00) | 34.1% | -0.140 | 0.162 | ** |
| Wed | 33,799 | +0.040 (3.83) | -0.101 | 40,766 | +0.039 (4.67) | 34.6% | -0.120 | 0.159 | ** |
| Thu | 33,739 | +0.053 (5.25) | -0.086 | 40,184 | +0.038 (3.99) | 34.7% | -0.119 | 0.157 | ** |
| Fri | 30,278 | +0.060 (6.48) | -0.080 | 36,490 | +0.057 (6.04) | 36.9% | -0.101 | 0.158 | ** |

### h1 none ext 2R all · hour

| Level | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | win 15-26 | net 15-26 | cost R 15-26 | |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 00-03 | 6,744 | +0.089 (4.31) | -0.112 | 9,119 | +0.029 (1.63) | 34.4% | -0.214 | 0.243 | * |
| 04-07 | 8,856 | +0.097 (4.77) | -0.110 | 10,151 | +0.016 (0.98) | 33.9% | -0.240 | 0.257 | * |
| 08-11 | 8,343 | +0.022 (1.17) | -0.173 | 9,222 | +0.016 (0.84) | 33.9% | -0.224 | 0.240 | * |
| 12-15 | 10,049 | +0.041 (2.37) | -0.122 | 12,626 | +0.020 (1.29) | 34.5% | -0.175 | 0.195 | * |
| 16-19 | 4,924 | +0.164 (6.55) | -0.009 | 5,193 | +0.086 (3.84) | 36.3% | -0.135 | 0.221 | ** |
| 20-23 | 4,146 | +0.400 (14.30) | +0.199 | 3,867 | +0.192 (6.23) | 39.6% | -0.028 | 0.220 | ** |

### h1 none ext 2R all · vol

| Level | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | win 15-26 | net 15-26 | cost R 15-26 | |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| low | 10,769 | +0.081 (4.98) | -0.160 | 12,055 | +0.035 (2.56) | 34.5% | -0.241 | 0.276 | ** |
| mid | 25,626 | +0.113 (10.93) | -0.066 | 30,350 | +0.042 (4.03) | 34.9% | -0.183 | 0.225 | ** |
| high | 6,659 | +0.114 (5.55) | -0.031 | 7,773 | +0.040 (2.04) | 34.9% | -0.130 | 0.170 | ** |

### h1 none ext 2R all · trend

| Level | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | win 15-26 | net 15-26 | cost R 15-26 | |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| range-with | 10,747 | +0.100 (5.94) | -0.092 | 12,759 | +0.014 (0.99) | 33.9% | -0.219 | 0.233 | * |
| range-against | 10,663 | +0.106 (6.92) | -0.081 | 12,683 | +0.032 (2.41) | 34.5% | -0.199 | 0.231 | ** |
| mid-with | 7,326 | +0.097 (5.26) | -0.094 | 8,578 | +0.029 (1.68) | 34.4% | -0.205 | 0.234 | * |
| mid-against | 7,017 | +0.142 (7.05) | -0.042 | 8,162 | +0.065 (3.71) | 35.6% | -0.155 | 0.221 | ** |
| trend-with | 3,754 | +0.076 (2.86) | -0.117 | 4,120 | +0.093 (3.99) | 36.5% | -0.141 | 0.234 | ** |
| trend-against | 3,504 | +0.094 (3.17) | -0.091 | 3,874 | +0.071 (2.82) | 36.1% | -0.142 | 0.212 | ** |

### h1 none ext 2R all · body

| Level | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | win 15-26 | net 15-26 | cost R 15-26 | |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| small | 6,999 | +0.177 (9.40) | -0.017 | 8,979 | +0.062 (3.84) | 35.4% | -0.161 | 0.224 | ** |
| medium | 13,328 | +0.134 (10.31) | -0.056 | 16,507 | +0.064 (5.41) | 35.6% | -0.172 | 0.237 | ** |
| large | 22,735 | +0.066 (5.33) | -0.121 | 24,692 | +0.016 (1.34) | 34.1% | -0.210 | 0.226 | * |

### h1 none ext 2R all · dow

| Level | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | win 15-26 | net 15-26 | cost R 15-26 | |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Mon | 9,579 | +0.137 (7.99) | -0.069 | 10,101 | +0.072 (4.77) | 35.7% | -0.166 | 0.238 | ** |
| Tue | 8,701 | +0.071 (3.54) | -0.118 | 10,304 | +0.047 (2.74) | 34.9% | -0.188 | 0.235 | ** |
| Wed | 8,509 | +0.107 (4.78) | -0.078 | 10,472 | +0.014 (0.82) | 33.9% | -0.213 | 0.227 | * |
| Thu | 8,429 | +0.105 (5.85) | -0.075 | 9,821 | +0.031 (1.86) | 34.4% | -0.188 | 0.219 | * |
| Fri | 7,839 | +0.102 (5.27) | -0.082 | 9,480 | +0.037 (2.09) | 35.2% | -0.188 | 0.225 | ** |

Levels with mean R > 0 and month t >= 2 in both windows (descriptive, not tested): 32 of 46.
Levels positive AFTER costs in both windows: none.

## Per market, passing tests

Before costs (after costs in brackets); * = cost ASSUMED.

### R1 hour: 20-23 vs 08-11

| Market | best 05-14 | best 15-26 [net] | worst 05-14 | worst 15-26 [net] |
|---|---:|---:|---:|---:|
| xau | +0.243 (n 2,049) | +0.085 (n 2,133) [-0.144] | +0.006 (n 2,648) | +0.020 (n 3,340) [-0.159] |
| xag* | +0.123 (n 930) | +0.161 (n 986) [-0.398] | -0.053 (n 2,062) | +0.078 (n 2,277) [-0.465] |
| eurusd | +0.188 (n 2,821) | +0.138 (n 2,809) [-0.019] | -0.026 (n 2,876) | +0.005 (n 3,385) [-0.078] |
| gbpusd | +0.227 (n 2,783) | +0.174 (n 2,648) [+0.026] | +0.002 (n 2,921) | +0.015 (n 3,459) [-0.061] |
| usdjpy | +0.191 (n 3,120) | +0.107 (n 3,475) [-0.059] | -0.023 (n 2,777) | -0.046 (n 3,137) [-0.159] |
| audusd | +0.205 (n 3,135) | +0.194 (n 3,371) [+0.018] | -0.011 (n 2,838) | +0.013 (n 3,395) [-0.092] |
| nzdusd* | +0.131 (n 3,105) | +0.179 (n 3,431) [-0.008] | -0.005 (n 2,788) | +0.042 (n 3,434) [-0.087] |
| usdcad* | +0.302 (n 2,609) | +0.177 (n 2,771) [+0.044] | +0.107 (n 3,130) | +0.088 (n 3,582) [-0.018] |
| usdchf* | +0.219 (n 2,700) | +0.264 (n 2,659) [+0.082] | -0.046 (n 2,842) | -0.029 (n 3,377) [-0.141] |
| eurjpy* | +0.185 (n 3,023) | +0.197 (n 3,388) [+0.034] | -0.128 (n 2,713) | -0.010 (n 3,257) [-0.109] |

### R1 vol: low vs high

| Market | best 05-14 | best 15-26 [net] | worst 05-14 | worst 15-26 [net] |
|---|---:|---:|---:|---:|
| xau | +0.056 (n 4,958) | +0.013 (n 5,382) [-0.263] | +0.043 (n 4,324) | +0.005 (n 4,539) [-0.114] |
| xag* | +0.046 (n 1,941) | +0.017 (n 2,269) [-0.590] | -0.005 (n 4,179) | +0.033 (n 4,200) [-0.428] |
| eurusd | +0.088 (n 6,119) | +0.065 (n 7,583) [-0.108] | -0.009 (n 4,859) | +0.028 (n 5,975) [-0.039] |
| gbpusd | +0.149 (n 6,408) | +0.071 (n 7,583) [-0.099] | -0.049 (n 5,377) | +0.018 (n 6,203) [-0.047] |
| usdjpy | +0.046 (n 4,911) | +0.026 (n 5,913) [-0.152] | -0.016 (n 3,672) | -0.043 (n 4,074) [-0.124] |
| audusd | +0.065 (n 4,636) | +0.093 (n 5,624) [-0.083] | +0.012 (n 3,492) | +0.017 (n 3,933) [-0.061] |
| nzdusd* | +0.062 (n 4,698) | +0.076 (n 5,168) [-0.126] | +0.047 (n 3,428) | +0.016 (n 3,765) [-0.078] |
| usdcad* | +0.193 (n 6,340) | +0.089 (n 6,876) [-0.084] | +0.057 (n 5,160) | +0.031 (n 5,418) [-0.038] |
| usdchf* | +0.084 (n 6,443) | +0.080 (n 7,277) [-0.146] | -0.035 (n 4,822) | +0.015 (n 5,715) [-0.073] |
| eurjpy* | +0.039 (n 4,739) | +0.097 (n 6,165) [-0.078] | -0.054 (n 3,530) | -0.019 (n 4,327) [-0.100] |

### R1 dow: Mon vs Tue

| Market | best 05-14 | best 15-26 [net] | worst 05-14 | worst 15-26 [net] |
|---|---:|---:|---:|---:|
| xau | +0.064 (n 3,334) | -0.028 (n 4,151) [-0.224] | -0.038 (n 3,049) | +0.006 (n 4,044) [-0.192] |
| xag* | -0.024 (n 2,151) | +0.075 (n 2,712) [-0.458] | -0.001 (n 2,110) | +0.098 (n 2,564) [-0.425] |
| eurusd | +0.071 (n 4,306) | +0.063 (n 4,599) [-0.058] | +0.059 (n 3,570) | +0.027 (n 4,258) [-0.094] |
| gbpusd | +0.095 (n 4,300) | +0.063 (n 4,522) [-0.055] | +0.064 (n 3,588) | +0.012 (n 4,232) [-0.106] |
| usdjpy | +0.077 (n 4,242) | +0.017 (n 4,612) [-0.121] | +0.057 (n 3,503) | -0.021 (n 4,218) [-0.151] |
| audusd | +0.070 (n 4,487) | +0.078 (n 4,723) [-0.057] | +0.045 (n 3,696) | +0.003 (n 4,380) [-0.120] |
| nzdusd* | +0.070 (n 4,342) | +0.078 (n 4,720) [-0.079] | +0.038 (n 3,671) | +0.025 (n 4,285) [-0.120] |
| usdcad* | +0.149 (n 4,239) | +0.049 (n 4,523) [-0.075] | +0.107 (n 3,586) | +0.069 (n 4,293) [-0.053] |
| usdchf* | +0.088 (n 4,296) | +0.102 (n 4,509) [-0.055] | +0.028 (n 3,496) | +0.038 (n 4,258) [-0.122] |
| eurjpy* | +0.066 (n 4,250) | +0.060 (n 4,624) [-0.073] | -0.025 (n 3,471) | -0.003 (n 4,102) [-0.130] |

### R2 hour: 20-23 vs 08-11

| Market | best 05-14 | best 15-26 [net] | worst 05-14 | worst 15-26 [net] |
|---|---:|---:|---:|---:|
| xau | +0.368 (n 240) | +0.288 (n 303) [+0.070] | +0.051 (n 761) | -0.090 (n 863) [-0.374] |
| xag* | +0.297 (n 143) | +0.242 (n 138) [-0.161] | -0.068 (n 437) | +0.030 (n 394) [-0.515] |
| eurusd | +0.465 (n 399) | +0.174 (n 355) [-0.013] | +0.064 (n 951) | +0.051 (n 1,088) [-0.128] |
| gbpusd | +0.408 (n 399) | +0.218 (n 338) [+0.029] | +0.062 (n 1,044) | -0.024 (n 1,226) [-0.193] |
| usdjpy | +0.302 (n 527) | +0.025 (n 530) [-0.172] | -0.002 (n 736) | -0.026 (n 782) [-0.244] |
| audusd | +0.476 (n 580) | +0.206 (n 474) [-0.022] | +0.003 (n 786) | +0.088 (n 836) [-0.135] |
| nzdusd* | +0.240 (n 647) | +0.132 (n 581) [-0.110] | +0.070 (n 805) | +0.081 (n 838) [-0.195] |
| usdcad* | +0.616 (n 331) | +0.421 (n 353) [+0.219] | +0.140 (n 1,023) | +0.064 (n 1,038) [-0.190] |
| usdchf* | +0.541 (n 339) | +0.158 (n 275) [-0.098] | -0.050 (n 918) | -0.047 (n 1,120) [-0.308] |
| eurjpy* | +0.376 (n 541) | +0.203 (n 520) [+0.002] | -0.118 (n 882) | +0.047 (n 1,037) [-0.152] |

### R2 body: small vs large

| Market | best 05-14 | best 15-26 [net] | worst 05-14 | worst 15-26 [net] |
|---|---:|---:|---:|---:|
| xau | +0.115 (n 566) | +0.034 (n 835) [-0.220] | +0.045 (n 2,065) | -0.001 (n 2,411) [-0.248] |
| xag* | +0.178 (n 301) | +0.025 (n 442) [-0.467] | +0.045 (n 1,359) | +0.062 (n 1,405) [-0.423] |
| eurusd | +0.143 (n 672) | +0.151 (n 914) [-0.037] | +0.045 (n 2,677) | +0.053 (n 2,779) [-0.121] |
| gbpusd | +0.211 (n 711) | +0.062 (n 993) [-0.127] | +0.066 (n 2,641) | +0.016 (n 2,789) [-0.159] |
| usdjpy | +0.128 (n 736) | +0.063 (n 818) [-0.126] | +0.085 (n 2,357) | -0.092 (n 2,648) [-0.282] |
| audusd | +0.211 (n 814) | +0.070 (n 955) [-0.122] | +0.029 (n 2,268) | +0.052 (n 2,559) [-0.152] |
| nzdusd* | +0.153 (n 860) | +0.052 (n 938) [-0.174] | +0.146 (n 2,141) | +0.055 (n 2,429) [-0.194] |
| usdcad* | +0.240 (n 793) | +0.106 (n 1,057) [-0.089] | +0.154 (n 2,414) | +0.038 (n 2,615) [-0.172] |
| usdchf* | +0.307 (n 764) | +0.010 (n 1,063) [-0.243] | +0.040 (n 2,556) | +0.011 (n 2,500) [-0.240] |
| eurjpy* | +0.068 (n 782) | +0.033 (n 964) [-0.166] | -0.002 (n 2,257) | -0.012 (n 2,557) [-0.217] |

## Checks

- Cut test: 10 cuts on xau, eurusd: 249,883 signals with their five condition levels known by the cut dates, 0 missing or extra when the candles are cut there.
- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill past the stop and a risk under the round-trip cost are no trades; a trade the grid could not resolve is dropped, as in the grid.
- Exclusions: the data-quality audit's bad intervals (`combo-grid-2` `exclusions`).

| Market | candles from | signals (both rules) | kept trades | dropped (bad data) | past the stop | risk under cost | unresolved | no level: hour / vol / trend / body / dow |
|---|---|---:|---:|---:|---:|---:|---:|---|
| xau | 2006-03-19 | 44,349 | 43,722 | 4 | 23 | 598 | 2 | 0 / 9 / 149 / 0 / 2 |
| xag | 2006-03-19 | 44,574 | 28,235 | 92 | 54 | 16,192 | 1 | 0 / 4 / 58 / 0 / 0 |
| eurusd | 2004-01-01 | 49,724 | 49,580 | 24 | 10 | 53 | 1 | 0 / 4 / 10 / 0 / 7 |
| gbpusd | 2004-01-01 | 49,435 | 49,251 | 57 | 12 | 57 | 2 | 0 / 0 / 0 / 0 / 4 |
| usdjpy | 2004-01-01 | 48,700 | 48,479 | 39 | 13 | 108 | 1 | 0 / 0 / 7 / 0 / 2 |
| audusd | 2004-01-01 | 50,388 | 50,209 | 34 | 17 | 74 | 0 | 0 / 0 / 20 / 0 / 2 |
| nzdusd | 2004-01-01 | 49,832 | 49,668 | 1 | 24 | 86 | 1 | 0 / 0 / 23 / 0 / 1 |
| usdcad | 2004-01-01 | 50,174 | 49,939 | 52 | 16 | 96 | 1 | 0 / 0 / 19 / 0 / 1 |
| usdchf | 2004-01-01 | 49,243 | 48,942 | 52 | 18 | 168 | 1 | 0 / 0 / 26 / 0 / 4 |
| eurjpy | 2004-01-01 | 48,668 | 48,507 | 3 | 16 | 74 | 2 | 0 / 0 / 0 / 0 / 2 |

## What it means

5 of the 10 fixed comparisons hold out of sample: the before-cost fade tilt is larger under one condition than another,
with the level chosen on 2005-14 and confirmed on 2015-26. That says where the tilt sits, nothing more. The after-cost column
shows that no level is positive after costs in both windows.
Not an edge, nothing adopted, no live change. No other cut points or splits on these years.

**Read the hour result with care.** The 20-23 UTC block holds the 17:00 New York rollover and the thin hours after it, where
the quoted spread is several times its daytime width. The after-cost figures here charge ONE flat round trip a market at every
hour (the demo's daytime figure, or an assumed one), so they understate the cost exactly where the tilt is largest; and a
fade of the mid quote that "reverses" in those hours is what a widening and narrowing spread looks like, not a move a taker
can capture. The volatility, Monday and small-body results are smaller tilts of the same before-cost kind. Any follow-up
needs the broker's own bid / ask by hour (the tick probe) and its own pre-registration.
