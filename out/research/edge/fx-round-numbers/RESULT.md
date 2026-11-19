# Round numbers on forex majors (stall and break): result

**Verdict: FAIL: 0 of 2 rules pass. T1 FAIL (2016 on -0.12R a trade net, n 5966, t -8.4; 2006-15 -0.151R, n 7383); T2 FAIL (2016 on -0.112R a trade net, n 9341, t -9.75; 2006-15 -0.114R, n 11867)**

Pre-registered in PREREGISTRATION.md (committed and pushed before any candle was read). Four pairs (eurusd, gbpusd, audusd, usdjpy), OANDA mid M15,
decisive window 2016-01-01 to 2026-11-12, replication 2006-01-01 to 2015-12-31. Levels = multiples of 100 pips ("00"); control = the "50" grid;
placebo = the grid shifted by a random fraction of a step (40 seeds). Costs: spread 0.3 pip + commission 22.5 USD per million a side (2 x 22.5e-6 x price a round trip) + 0.5 pip slippage per market order (T2 entry, stop and time exits; none on the T1 limit entry or a target). t on calendar-month sums. Paper research only:
nothing live changed.

## The two rules, real "00" levels, pooled

| Rule | Window | n | Gross R a trade | Net R a trade | t (months, net) | t (months, gross) | Total net R | Win rate | Net at 2x costs | t at 2x |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 | 2016 on | 5966 | −0.045 | −0.120 | -8.40 | -3.31 | −715.9 | 45.4 % | −0.194 | -12.92 |
| T1 | 2006-15 | 7383 | −0.073 | −0.151 | -7.44 | -3.95 | −1112.2 | 43.7 % | −0.228 | -10.28 |
| T2 | 2016 on | 9341 | −0.043 | −0.112 | -9.75 | -3.92 | −1042.3 | 40.9 % | −0.181 | -14.81 |
| T2 | 2006-15 | 11867 | −0.047 | −0.114 | -11.07 | -4.98 | −1357.6 | 40.4 % | −0.181 | -15.96 |

T1: stall: limit at the first touch of a level untouched for 24 h, against the approach, stop and target 15 pips, out after 8 h. T2: break: first M15 close 5+ pips beyond a level it touched, market at the next open, stop 15 pips back past the level, target 1.5R, out after 8 h.

## The pass bar

| Rule | Verdict | decisive n >= 300 | decisive net R a trade > 0 | replication net R a trade > 0 | decisive month-sum t >= 2 | Holm-adjusted p < 0.05 | beats the placebo 95th percentile | p (one-sided) | Holm p |
|---|---|---|---|---|---|---|---|---|---|
| T1 | FAIL | yes | no | no | no | no | no | 1 | 1 |
| T2 | FAIL | yes | no | no | no | no | no | 1 | 1 |

## Control: the "50" levels (reported, not judged)

| Rule | Window | n | Gross R a trade | Net R a trade | t (months, net) |
|---|---|---|---|---|---|
| T1 | 2016 on | 5969 | −0.092 | −0.167 | -9.70 |
| T1 | 2006-15 | 7451 | −0.105 | −0.183 | -9.70 |
| T2 | 2016 on | 9311 | −0.003 | −0.072 | -6.86 |
| T2 | 2006-15 | 11837 | −0.037 | −0.104 | -10.26 |

## Placebo: the grid shifted by a random fraction of a step (decisive window, 40 seeds)

| Rule | Real net R a trade | Placebo mean | Placebo 95th pct | Placebo range | Real gross | Placebo gross mean | Placebo gross 95th pct | Real rank among 41 |
|---|---|---|---|---|---|---|---|---|
| T1 | −0.120 | −0.077 | −0.004 | −0.178 to −0.002 | −0.045 | −0.003 | +0.070 | 33 |
| T2 | −0.112 | −0.075 | −0.049 | −0.110 to −0.047 | −0.043 | −0.006 | +0.020 | 41 |

## Per pair (net R a trade, n, t on months)

| Rule | Pair | 2016 on | n | gross | t | 2006-15 | n | gross | t |
|---|---|---|---|---|---|---|---|---|---|
| T1 | eurusd | −0.160 | 1257 | −0.085 | -5.66 | −0.162 | 1956 | −0.083 | -5.62 |
| T1 | gbpusd | −0.106 | 1846 | −0.028 | -3.94 | −0.188 | 2273 | −0.099 | -6.14 |
| T1 | audusd | −0.054 | 1136 | +0.006 | -1.94 | −0.125 | 1647 | −0.060 | -4.36 |
| T1 | usdjpy | −0.149 | 1727 | −0.069 | -4.69 | −0.106 | 1507 | −0.036 | -3.14 |
| T2 | eurusd | −0.107 | 2036 | −0.036 | -4.43 | −0.113 | 3176 | −0.044 | -5.80 |
| T2 | gbpusd | −0.137 | 2850 | −0.066 | -6.85 | −0.119 | 3634 | −0.048 | -6.38 |
| T2 | audusd | −0.123 | 1767 | −0.058 | -5.82 | −0.107 | 2682 | −0.045 | -4.76 |
| T2 | usdjpy | −0.080 | 2688 | −0.012 | -3.43 | −0.118 | 2375 | −0.054 | -4.88 |

## By year (net R a trade / total, real levels)

| Year | T1 | T2 |
|---|---|---|
| 2006 | −0.184 / −112.7 (n 611) | −0.100 / −98.2 (n 977) |
| 2007 | −0.117 / −76.0 (n 651) | −0.104 / −104.6 (n 1010) |
| 2008 | −0.314 / −360.3 (n 1146) | −0.091 / −167.5 (n 1848) |
| 2009 | −0.125 / −128.2 (n 1022) | −0.138 / −231.6 (n 1672) |
| 2010 | −0.174 / −141.0 (n 812) | −0.174 / −233.7 (n 1346) |
| 2011 | −0.112 / −88.3 (n 790) | −0.135 / −175.9 (n 1301) |
| 2012 | −0.106 / −57.7 (n 546) | −0.104 / −89.6 (n 858) |
| 2013 | −0.058 / −36.6 (n 633) | −0.059 / −60.5 (n 1020) |
| 2014 | −0.044 / −22.2 (n 504) | −0.108 / −80.8 (n 750) |
| 2015 | −0.134 / −89.2 (n 668) | −0.106 / −115.3 (n 1085) |
| 2016 | −0.183 / −129.9 (n 708) | −0.137 / −154.1 (n 1122) |
| 2017 | −0.095 / −47.2 (n 499) | −0.128 / −102.4 (n 799) |
| 2018 | −0.087 / −43.6 (n 502) | −0.103 / −85.5 (n 827) |
| 2019 | −0.080 / −32.3 (n 405) | −0.110 / −65.0 (n 589) |
| 2020 | −0.088 / −51.3 (n 580) | −0.119 / −107.3 (n 904) |
| 2021 | −0.055 / −24.0 (n 437) | −0.111 / −71.9 (n 647) |
| 2022 | −0.132 / −94.7 (n 716) | −0.115 / −134.3 (n 1168) |
| 2023 | −0.145 / −85.8 (n 591) | −0.079 / −71.2 (n 903) |
| 2024 | −0.162 / −85.5 (n 526) | −0.048 / −37.6 (n 787) |
| 2025 | −0.094 / −55.9 (n 597) | −0.149 / −140.3 (n 939) |
| 2026 | −0.162 / −65.8 (n 405) | −0.111 / −72.7 (n 656) |

## Exits, decisive window

- T1: target 2528, stop 3084, time 354; median r0 15 pips
- T2: target 2171, stop 4181, time 2989; median r0 23.4 pips
- T2 breaks where one candle broke a level up and another down (both taken, as pre-registered): 0.

## Data

| Pair | Candles | First | Last |
|---|---|---|---|
| eurusd | 526799 | 2005-12-01 00:00 | 2026-11-13 21:45 |
| gbpusd | 526324 | 2005-12-01 00:00 | 2026-11-13 21:45 |
| audusd | 526282 | 2005-12-01 00:00 | 2026-11-13 21:45 |
| usdjpy | 526594 | 2005-12-01 00:00 | 2026-11-13 21:45 |

## What it means, and what it does not

- **Neither rule makes money, in either window, before or after costs.** Both lose before costs too (gross −0.04 to −0.07R a
  trade, month-sum t of the gross −3.3 to −5.0), so cheaper execution would not rescue them; at twice the costs they lose more.
  Every pair and every year from 2006 is negative for both rules.
- **The real "00" levels are worse than a random grid, for fading AND for following.** Against the 40 shifted grids the real
  levels rank 33rd of 41 for T1 and last (41st of 41) for T2; before costs the shifted grids are close to zero on average
  (−0.003R and −0.006R a trade) while the real levels lose about 0.04R. The "50" control sits between the two (T1 worse, T2 better
  than "00"). So round numbers are not neutral prices on these candles, but the difference is that a trade placed at them, in
  either direction, is stopped out more often (more two-sided movement around the level), not that one side of the order-flow
  story pays. That is a description of these two fixed rules, not a tested effect.
- **No proposal follows.** Nothing is offered as a paper shadow. A different reading of the papers (other stop sizes, other
  levels such as "20 / 80", the order book itself) would need its own pre-registration; this study does not license tuning
  these two rules on the same candles.
- What it does not test: whether take-profit or stop-loss orders really cluster at round numbers today (no order-book data is
  read), other markets, or a trader choosing which round number to trade. T1 counts only the stop in its fill candle (the
  order of prices inside one M15 candle is unknown); the placebo carries the same rule, so the comparison with the shifted
  grids is like for like.

To repeat: `node --use-env-proxy research/edge/fx-round-numbers/run.mjs fetch <dir>` (candles outside git), then `node research/edge/fx-round-numbers/run.mjs full <dir>`. Tests: `tests/fx-round-numbers.test.mjs`.
