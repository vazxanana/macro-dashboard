# US index CFDs into the Friday close: result

**Verdict: FAIL: Friday 14:00-15:55 US500 short: OOS −0.180R a trade net (n 474, month t −4.44); OOS t −4.44 < 2, in sample −0.152R, −0.313R at 2x cost, beats 2/40 placebo seeds.**

Pre-registered in `PREREGISTRATION.md` (committed before any figure was computed). Rule: every full-session NYSE Friday, short the US500 CFD at 14:00 New York, exit 15:55; stop 1.5 x the mean absolute 14:00-15:55 move of the 20 previous Fridays. Costs: 0.04 % of notional round trip (shown also at 0 and at 0.08 %), no financing. Data: OANDA mid M5 candles through the candle proxy, 1 Oct 2007 to 13 Nov 2026; the NYSE calendar stated in the pre-registration (half days and closures skipped). In sample first tradeable Friday → 2017-04-22, out of sample 2017-04-23 → 2026-11-13. Paper research only: nothing live changed.

## Pass bar (primary: US500, Friday)

| line | needed | result | met |
|---|---|---|---|
| 1 | OOS month-sum t ≥ 2, net of 0.04 % | −4.44 | no |
| 2 | in-sample net R a trade > 0 | −0.152 | no |
| 3 | OOS net R a trade > 0 at 2x cost | −0.313 | no |
| 4 | OOS net R beats ≥ 38 of 40 placebo seeds | 2 / 40 | no |

## Every market and group of days

R is the short's result in units of its stop distance. Friday is the tested rule (US500 decides; the others are reported only); Monday-Thursday and each weekday are the control.

| market | days | window | trades | months | gross R | net R | net R at 2x | t (month sums, net) | t gross | cost R | win | stopped | total net R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| US500 | Friday | in sample | 450 | 111 | −0.041 | −0.152 | −0.263 | −3.60 | −0.98 | 0.111 | 35.6 % | 95 | −68.4 |
| US500 | Friday | out of sample | 474 | 116 | −0.048 | −0.180 | −0.313 | −4.44 | −1.20 | 0.132 | 34.6 % | 113 | −85.4 |
| US500 | Monday-Thursday | in sample | 1891 | 114 | −0.012 | −0.121 | −0.230 | −6.02 | −0.60 | 0.109 | 38.8 % | 428 | −229.1 |
| US500 | Monday-Thursday | out of sample | 1909 | 116 | +0.032 | −0.096 | −0.224 | −3.91 | +1.35 | 0.128 | 38.7 % | 389 | −183.4 |
| US500 | Monday | in sample | 430 | 110 | +0.013 | −0.103 | −0.218 | −2.59 | +0.32 | 0.115 | 40.5 % | 94 | −44.2 |
| US500 | Monday | out of sample | 447 | 116 | +0.081 | −0.061 | −0.203 | −1.09 | +1.44 | 0.142 | 39.4 % | 92 | −27.3 |
| US500 | Tuesday | in sample | 471 | 110 | −0.048 | −0.157 | −0.266 | −4.27 | −1.28 | 0.109 | 36.9 % | 106 | −73.8 |
| US500 | Tuesday | out of sample | 492 | 116 | −0.015 | −0.150 | −0.284 | −3.91 | −0.42 | 0.134 | 38.2 % | 114 | −73.6 |
| US500 | Wednesday | in sample | 471 | 111 | +0.057 | −0.032 | −0.120 | −0.78 | +1.43 | 0.088 | 41.0 % | 83 | −14.9 |
| US500 | Wednesday | out of sample | 488 | 116 | +0.041 | −0.066 | −0.174 | −1.37 | +0.86 | 0.107 | 37.1 % | 96 | −32.4 |
| US500 | Thursday | in sample | 459 | 111 | −0.009 | −0.119 | −0.229 | −2.83 | −0.21 | 0.111 | 38.3 % | 101 | −54.6 |
| US500 | Thursday | out of sample | 482 | 116 | +0.040 | −0.075 | −0.191 | −1.49 | +0.80 | 0.116 | 38.2 % | 103 | −36.3 |
| NAS100 | Friday | in sample | 450 | 111 | −0.006 | −0.109 | −0.212 | −2.52 | −0.13 | 0.103 | 38.9 % | 95 | −49.0 |
| NAS100 | Friday | out of sample | 474 | 116 | −0.040 | −0.150 | −0.260 | −3.65 | −0.98 | 0.110 | 35.6 % | 121 | −71.0 |
| NAS100 | Monday-Thursday | in sample | 1891 | 114 | −0.022 | −0.120 | −0.218 | −5.86 | −1.12 | 0.098 | 39.5 % | 450 | −227.0 |
| NAS100 | Monday-Thursday | out of sample | 1908 | 116 | +0.009 | −0.093 | −0.194 | −3.82 | +0.37 | 0.101 | 39.1 % | 424 | −177.3 |
| NAS100 | Monday | in sample | 430 | 110 | −0.033 | −0.133 | −0.233 | −3.40 | −0.85 | 0.100 | 41.6 % | 93 | −57.0 |
| NAS100 | Monday | out of sample | 447 | 116 | +0.013 | −0.101 | −0.215 | −1.91 | +0.24 | 0.114 | 38.3 % | 102 | −45.1 |
| NAS100 | Tuesday | in sample | 471 | 110 | −0.053 | −0.148 | −0.244 | −3.71 | −1.30 | 0.096 | 37.6 % | 107 | −69.9 |
| NAS100 | Tuesday | out of sample | 492 | 116 | −0.039 | −0.146 | −0.254 | −3.81 | −1.05 | 0.107 | 37.4 % | 125 | −72.0 |
| NAS100 | Wednesday | in sample | 471 | 111 | +0.023 | −0.058 | −0.139 | −1.43 | +0.57 | 0.081 | 40.3 % | 95 | −27.4 |
| NAS100 | Wednesday | out of sample | 487 | 116 | −0.007 | −0.092 | −0.176 | −2.05 | −0.17 | 0.084 | 38.0 % | 99 | −44.6 |
| NAS100 | Thursday | in sample | 459 | 111 | −0.021 | −0.124 | −0.227 | −3.01 | −0.53 | 0.103 | 37.9 % | 107 | −57.1 |
| NAS100 | Thursday | out of sample | 482 | 116 | +0.037 | −0.059 | −0.155 | −1.18 | +0.75 | 0.096 | 39.2 % | 108 | −28.4 |
| US30 | Friday | in sample | 450 | 111 | −0.054 | −0.179 | −0.305 | −4.50 | −1.36 | 0.126 | 33.6 % | 107 | −80.7 |
| US30 | Friday | out of sample | 474 | 116 | −0.081 | −0.222 | −0.363 | −5.34 | −1.99 | 0.141 | 32.9 % | 126 | −105.1 |
| US30 | Monday-Thursday | in sample | 1891 | 114 | −0.003 | −0.128 | −0.252 | −6.02 | −0.14 | 0.125 | 39.8 % | 438 | −241.4 |
| US30 | Monday-Thursday | out of sample | 1910 | 116 | +0.018 | −0.117 | −0.253 | −4.75 | +0.76 | 0.135 | 38.1 % | 414 | −224.0 |
| US30 | Monday | in sample | 430 | 110 | +0.002 | −0.129 | −0.260 | −3.39 | +0.06 | 0.131 | 41.2 % | 100 | −55.5 |
| US30 | Monday | out of sample | 448 | 116 | +0.060 | −0.094 | −0.249 | −1.48 | +0.95 | 0.155 | 35.7 % | 95 | −42.1 |
| US30 | Tuesday | in sample | 471 | 110 | −0.034 | −0.159 | −0.283 | −4.19 | −0.90 | 0.124 | 38.6 % | 113 | −74.8 |
| US30 | Tuesday | out of sample | 492 | 116 | −0.031 | −0.180 | −0.329 | −4.47 | −0.81 | 0.149 | 38.2 % | 114 | −88.5 |
| US30 | Wednesday | in sample | 471 | 111 | +0.089 | −0.011 | −0.111 | −0.27 | +2.21 | 0.100 | 42.9 % | 79 | −5.2 |
| US30 | Wednesday | out of sample | 488 | 116 | +0.037 | −0.075 | −0.186 | −1.54 | +0.78 | 0.112 | 37.9 % | 102 | −36.4 |
| US30 | Thursday | in sample | 459 | 111 | +0.006 | −0.117 | −0.240 | −2.73 | +0.15 | 0.123 | 38.1 % | 104 | −53.7 |
| US30 | Thursday | out of sample | 482 | 116 | +0.034 | −0.091 | −0.217 | −1.88 | +0.70 | 0.126 | 37.3 % | 108 | −44.1 |
| US2000 | Friday | in sample | 445 | 110 | −0.074 | −0.166 | −0.257 | −4.06 | −1.82 | 0.092 | 36.2 % | 104 | −73.7 |
| US2000 | Friday | out of sample | 474 | 116 | −0.050 | −0.153 | −0.255 | −4.19 | −1.37 | 0.102 | 37.5 % | 116 | −72.4 |
| US2000 | Monday-Thursday | in sample | 1890 | 114 | −0.005 | −0.087 | −0.169 | −4.50 | −0.26 | 0.082 | 41.9 % | 421 | −164.5 |
| US2000 | Monday-Thursday | out of sample | 1908 | 116 | +0.053 | −0.039 | −0.130 | −1.55 | +2.12 | 0.091 | 42.6 % | 390 | −74.0 |
| US2000 | Monday | in sample | 431 | 110 | +0.002 | −0.084 | −0.171 | −2.15 | +0.06 | 0.086 | 42.9 % | 94 | −36.2 |
| US2000 | Monday | out of sample | 447 | 116 | +0.070 | −0.026 | −0.123 | −0.54 | +1.42 | 0.097 | 43.0 % | 84 | −11.8 |
| US2000 | Tuesday | in sample | 471 | 110 | −0.036 | −0.118 | −0.200 | −3.15 | −0.97 | 0.082 | 41.4 % | 106 | −55.7 |
| US2000 | Tuesday | out of sample | 492 | 116 | +0.010 | −0.085 | −0.181 | −2.13 | +0.26 | 0.096 | 43.1 % | 114 | −41.9 |
| US2000 | Wednesday | in sample | 470 | 111 | +0.044 | −0.023 | −0.091 | −0.56 | +1.06 | 0.068 | 43.0 % | 95 | −11.0 |
| US2000 | Wednesday | out of sample | 487 | 116 | +0.090 | +0.016 | −0.058 | +0.32 | +1.78 | 0.074 | 42.3 % | 97 | +7.8 |
| US2000 | Thursday | in sample | 458 | 111 | −0.013 | −0.100 | −0.187 | −2.24 | −0.29 | 0.087 | 40.8 % | 100 | −45.6 |
| US2000 | Thursday | out of sample | 482 | 116 | +0.032 | −0.060 | −0.152 | −1.30 | +0.70 | 0.092 | 40.0 % | 108 | −28.9 |

## Placebo (US500, out of sample)

40 seeds: 474 random out-of-sample Monday-Thursday days each, the same 14:00-15:55 short with the Monday-Thursday stop and the same cost. Placebo mean −0.105R, 95th percentile −0.049R, max −0.036R; the Friday short (−0.180R) beats 2 of 40.

## US500 Friday short by year (descriptive)

| year | n | gross R | net R | total net R |
|---|---|---|---|---|
| 2008 | 41 | −0.053 | −0.108 | −4.4 |
| 2009 | 48 | −0.171 | −0.243 | −11.7 |
| 2010 | 49 | −0.161 | −0.240 | −11.8 |
| 2011 | 50 | +0.157 | +0.051 | +2.5 |
| 2012 | 50 | +0.085 | −0.040 | −2.0 |
| 2013 | 50 | −0.187 | −0.329 | −16.4 |
| 2014 | 49 | +0.084 | −0.057 | −2.8 |
| 2015 | 48 | +0.055 | −0.047 | −2.3 |
| 2016 | 50 | −0.145 | −0.280 | −14.0 |
| 2017 | 50 | −0.164 | −0.456 | −22.8 |
| 2018 | 50 | −0.055 | −0.186 | −9.3 |
| 2019 | 50 | +0.055 | −0.069 | −3.5 |
| 2020 | 48 | −0.264 | −0.348 | −16.7 |
| 2021 | 49 | −0.108 | −0.239 | −11.7 |
| 2022 | 50 | −0.169 | −0.239 | −12.0 |
| 2023 | 50 | −0.031 | −0.126 | −6.3 |
| 2024 | 50 | −0.019 | −0.169 | −8.5 |
| 2025 | 49 | +0.113 | −0.014 | −0.7 |
| 2026 | 43 | +0.151 | +0.011 | +0.5 |

## Days left out

- US500: 7 eligible days without a price at 14:00 or 15:55 New York; the first 20 days of each group are the stop warm-up.
- NAS100: 8 eligible days without a price at 14:00 or 15:55 New York; the first 20 days of each group are the stop warm-up.
- US30: 6 eligible days without a price at 14:00 or 15:55 New York; the first 20 days of each group are the stop warm-up.
- US2000: 14 eligible days without a price at 14:00 or 15:55 New York; the first 20 days of each group are the stop warm-up.

## Reading

The pre-registered bar was not met. Shorting US index CFDs into the Friday close is not an edge on these feeds after costs; no proposal is written and nothing live changes. Never call it an edge.

Descriptive, decides nothing: before any cost the Friday short makes, in R a trade (in sample / out of sample): US500 −0.041 / −0.048; NAS100 −0.006 / −0.040; US30 −0.054 / −0.081; US2000 −0.074 / −0.050. A negative figure means the index tended to rise, not fall, from 14:00 to 15:55 on a Friday; every Friday t before costs is inside ±2 (US30 out of sample −1.99 is the largest). The cost of the round trip (about 0.1R a trade at this stop) is what makes every group of days lose, Friday or not.

To repeat: `node --use-env-proxy research/edge/index-friday-pm/fetch.mjs <dir>`, then `node research/edge/index-friday-pm/run.mjs <dir>`. Test: `tests/index-friday-pm.test.mjs`.
