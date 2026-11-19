# Gold: the US cash-open hour that raids the overnight range and fails back inside

Paper research only. A new stand-alone intraday rule, **not a gate, exit, entry or size of the live gold book** (owner decision 44: none of the book's records read). Nothing live changed, no proposal. The rule, costs, windows, baseline, placebo and pass bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.

**Verdict: FAIL, 0 of 3: fading gold's failed 09:00 NY raid of the overnight range to its middle, 2017-26 −0.247R a trade net (n 615, month t −5.02, lift −0.009R); 2007-16 −0.214R**

## Tests (R of the entry-to-stop distance; t on calendar-month sums of net R)

| Test | Rule | Period | n | Win | Net R/trade | Gross R/trade | Net at 2x cost | Cost R/trade | Same-year baseline R | Lift R (t) | Total R | t (months) | Gross t | Stops / targets / time | Max DD R | Median stop $ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | fade the failed raid, target the overnight middle, out 16:00 NY | 2007-2016 | 569 | 42.7 % | −0.214 | +0.004 | −0.433 | +0.218 | −0.281 | +0.067 (+1.22) | −121.83 | −3.79 | +0.08 | 268 / 235 / 66 | −130.58 | 3.25 |
| T1 | fade the failed raid, target the overnight middle, out 16:00 NY | 2017 → 2026-10 | 615 | 43.9 % | −0.247 | −0.057 | −0.437 | +0.190 | −0.238 | −0.009 (−0.20) | −152.02 | −5.02 | −1.29 | 298 / 247 / 70 | −160.66 | 4.4 |
| T1 | fade the failed raid, target the overnight middle, out 16:00 NY | 2017-2021 | 321 | 45.8 % | −0.243 | −0.002 | −0.484 | +0.241 | −0.283 | +0.040 (+0.65) | −78.00 | −3.51 | −0.03 | 146 / 141 / 34 | −79.81 | 3.03 |
| T1 | fade the failed raid, target the overnight middle, out 16:00 NY | 2022 → 2026-10 | 294 | 41.8 % | −0.252 | −0.118 | −0.386 | +0.134 | −0.189 | −0.062 (−0.97) | −74.02 | −3.56 | −1.87 | 152 / 106 / 36 | −84.50 | 6.66 |
| T2 | fade the failed raid, no target, out 16:00 NY | 2007-2016 | 599 | 31.4 % | −0.204 | +0.009 | −0.416 | +0.212 | −0.180 | −0.024 (−0.32) | −122.00 | −2.78 | +0.12 | 321 / 0 / 278 | −138.44 | 3.35 |
| T2 | fade the failed raid, no target, out 16:00 NY | 2017 → 2026-10 | 653 | 37.4 % | −0.154 | +0.029 | −0.338 | +0.184 | −0.154 | +0.000 (−0.01) | −100.88 | −2.47 | +0.49 | 330 / 0 / 323 | −103.08 | 4.63 |
| T2 | fade the failed raid, no target, out 16:00 NY | 2017-2021 | 341 | 38.7 % | −0.153 | +0.080 | −0.386 | +0.233 | −0.203 | +0.049 (+0.61) | −52.24 | −1.77 | +0.99 | 163 / 0 / 178 | −63.02 | 3.19 |
| T2 | fade the failed raid, no target, out 16:00 NY | 2022 → 2026-10 | 312 | 35.9 % | −0.156 | −0.026 | −0.286 | +0.130 | −0.101 | −0.055 (−0.63) | −48.64 | −1.71 | −0.29 | 167 / 0 / 145 | −56.59 | 6.93 |
| T3 | follow the accepted break, no target, out 16:00 NY | 2007-2016 | 580 | 38.6 % | −0.095 | +0.014 | −0.205 | +0.109 | −0.098 | +0.003 (+0.05) | −55.20 | −1.91 | +0.29 | 194 / 0 / 386 | −59.91 | 6.58 |
| T3 | follow the accepted break, no target, out 16:00 NY | 2017 → 2026-10 | 593 | 40.5 % | −0.054 | +0.036 | −0.143 | +0.089 | −0.066 | +0.012 (+0.23) | −31.92 | −1.01 | +0.66 | 204 / 0 / 389 | −43.43 | 8.31 |
| T3 | follow the accepted break, no target, out 16:00 NY | 2017-2021 | 285 | 37.5 % | −0.124 | −0.005 | −0.243 | +0.119 | −0.097 | −0.026 (−0.35) | −35.28 | −1.63 | −0.06 | 100 / 0 / 185 | −38.60 | 6.13 |
| T3 | follow the accepted break, no target, out 16:00 NY | 2022 → 2026-10 | 308 | 43.2 % | +0.011 | +0.073 | −0.051 | +0.062 | −0.037 | +0.047 (+0.64) | +3.36 | +0.15 | +0.96 | 104 / 0 / 204 | −25.58 | 10.83 |

## Decision (out of sample, Holm over the three tests; T1 is the primary test)

| Test | p | Holm p | net > 0 | t ≥ 2 | Holm < 0.05 | 2007-16 > 0 | 2x cost > 0 | lift > 0 | placebos beaten (need 38 of 40) | n ≥ 100 both windows | pass |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | 1 | 1 | no | no | no | no | no | no | 16 | yes | **fail** |
| T2 | 0.993 | 1 | no | no | no | no | no | no | 23 | yes | **fail** |
| T3 | 0.844 | 1 | no | no | no | no | no | yes | 21 | yes | **fail** |

**Placebo** (each out-of-sample trade moved to a random eligible weekday of the same year: same side, stop and target distance, 10:00-16:00 New York, same cost; 40 seeds):

- T1: seed means −0.381 to −0.114R a trade, median −0.219, 95th percentile −0.149R.
- T2: seed means −0.342 to +0.410R a trade, median −0.158, 95th percentile −0.028R.
- T3: seed means −0.167 to +0.049R a trade, median −0.062, 95th percentile −0.001R.

## Buys and sells (net R a trade, n, month t)

| Test | Period | Buys | Sells |
|---|---|---|---|
| T1 | 2007-2016 | −0.090 (n 291, t −1.28; gross +0.121) | −0.344 (n 278, t −4.36; gross −0.118) |
| T1 | 2017 → 2026-10 | −0.163 (n 298, t −2.36; gross +0.004) | −0.326 (n 317, t −4.93; gross −0.115) |
| T2 | 2007-2016 | −0.049 (n 308, t −0.50; gross +0.157) | −0.368 (n 291, t −3.75; gross −0.148) |
| T2 | 2017 → 2026-10 | −0.069 (n 315, t −0.74; gross +0.095) | −0.234 (n 338, t −2.86; gross −0.032) |
| T3 | 2007-2016 | −0.152 (n 280, t −2.59; gross −0.039) | −0.042 (n 300, t −0.52; gross +0.064) |
| T3 | 2017 → 2026-10 | −0.068 (n 330, t −0.95; gross +0.025) | −0.036 (n 263, t −0.48; gross +0.048) |

Sessions without a trade, whole period: T1 noevent 3870, pastmid 68, data 11; T2 noevent 3870, data 11; T3 noevent 3949, data 11.

## By year (net R a trade, n)

| Year | T1 | T2 | T3 |
|---|---|---|---|
| 2007 | −0.411 (58) | −0.461 (60) | −0.069 (77) |
| 2008 | −0.140 (56) | +0.028 (58) | +0.124 (66) |
| 2009 | −0.298 (62) | −0.165 (64) | −0.168 (51) |
| 2010 | −0.444 (64) | −0.382 (66) | −0.147 (61) |
| 2011 | −0.471 (55) | −0.692 (58) | −0.230 (55) |
| 2012 | +0.057 (66) | +0.190 (74) | −0.131 (52) |
| 2013 | −0.330 (50) | −0.413 (50) | −0.229 (50) |
| 2014 | +0.085 (44) | −0.242 (48) | +0.188 (32) |
| 2015 | −0.081 (57) | −0.061 (58) | −0.106 (78) |
| 2016 | −0.067 (57) | +0.026 (63) | −0.126 (58) |
| 2017 | −0.401 (62) | −0.377 (67) | −0.153 (47) |
| 2018 | −0.462 (76) | −0.335 (80) | −0.070 (52) |
| 2019 | −0.132 (62) | +0.047 (65) | −0.070 (51) |
| 2020 | −0.048 (61) | −0.028 (66) | +0.036 (58) |
| 2021 | −0.115 (60) | −0.022 (63) | −0.299 (77) |
| 2022 | −0.426 (59) | −0.230 (62) | +0.166 (57) |
| 2023 | −0.025 (60) | +0.198 (69) | −0.071 (73) |
| 2024 | −0.281 (75) | −0.222 (76) | +0.007 (65) |
| 2025 | −0.517 (49) | −0.442 (52) | +0.046 (68) |
| 2026 | −0.019 (51) | −0.154 (53) | −0.100 (45) |

## Reading

No test passes the pre-registered bar. Out of sample: T1 −0.247R (n 615, t −5.02, gross −0.057R, lift −0.009R; 2007-16 −0.214R; failed: netPos, t2, holm, isPos, cost2x, lift, placebo); T2 −0.154R (n 653, t −2.47, gross +0.029R, lift +0.000R; 2007-16 −0.204R; failed: netPos, t2, holm, isPos, cost2x, lift, placebo); T3 −0.054R (n 593, t −1.01, gross +0.036R, lift +0.012R; 2007-16 −0.095R; failed: netPos, t2, holm, isPos, cost2x, placebo). Costs take 0.190R a trade on T1 at a median stop of $4.4. Buys −0.163R (n 298) and sells −0.326R (n 317) out of sample on T1. Placebo seeds beaten: T1 16, T2 23, T3 21 of 40. Not an edge; nothing live changes and no proposal is written.

## Data and method

- OANDA mid XAU/USD H1 (keyless candle proxy), 5133 New York weekday sessions 2007-01-02 → 2026-10-30, New York time by the US daylight rule since 2007
- Rule: New York weekdays; overnight = H1 candles 18:00 NY the evening before to the 08:00 NY candle (10+); raid candle = 09:00 NY; T1: it trades through exactly one end and closes back inside: fade at the 10:00 NY open, stop $0.30 beyond its extreme, target the overnight middle (no trade if the entry is already past it), out 16:00 NY; T2: the same with no target; T3: it closes beyond the end: follow at the 10:00 open, stop $0.30 beyond its other extreme, out 16:00 NY; stop first, a gap through the stop fills at the open; one trade a day
- Costs: $0.60 a round trip per ounce (spread and slippage), 2x reported; financing on buys by `council/fills.mjs` `nights` x `FIN.xau.long` (0.000148 of price a rollover): charged on 3609 test trades, total 0R: every exit is at or before 16:00 New York, before the rollover.
- To repeat: `node --use-env-proxy research/edge/gold-ny-open-overnight-fail/run.mjs fetch <xau-1h.json.gz>` (OANDA mid H1, kept out of git), then `node research/edge/gold-ny-open-overnight-fail/run.mjs <xau-1h.json.gz>`.
