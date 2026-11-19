# London-open range breakout on forex majors: result

**Verdict: FAIL: 0 of 3 variants pass. F1 FAIL (2020 on -0.05R a trade net, n 9875, t -2.28; 2016-19 -0.103R, n 5847); F2 FAIL (2020 on -0.075R a trade net, n 9875, t -5.36; 2016-19 -0.108R, n 5847); FADE FAIL (2020 on -0.808R a trade net, n 9739, t -22; 2016-19 -0.805R, n 5760)**

Pre-registered in PREREGISTRATION.md (committed before any trade was computed). Six pairs (eurusd, gbpusd, usdjpy, audusd, usdchf, eurjpy), OANDA mid M5,
decisive window 2020-01-01 to 2026-11-12, replication 2016-01-01 to 2019-12-31. Range = 07:00-08:00 London (UTC+1 in UK summer time),
days with a range under 0.25x or over 2x its 20-day median skipped. Costs: spread 0.3 pip + commission 22.5 USD per million a side (2 x 22.5e-6 x price a round trip) + 0.5 pip slippage per market or stop fill. t on calendar-month sums. Paper research only:
nothing live changed.

## Pooled, net of costs

| Variant | Window | n | Net R a trade | Gross R a trade | t (months) | Total net R | Win rate | Net at 2x costs |
|---|---|---|---|---|---|---|---|---|
| F1 | 2020 on | 9875 | −0.050 | +0.080 | -2.28 | −490.5 | 32.8 % | −0.179 |
| F1 | 2016-19 | 5847 | −0.103 | +0.031 | -3.15 | −604.3 | 31.2 % | −0.237 |
| F2 | 2020 on | 9875 | −0.075 | +0.040 | -5.36 | −739.9 | 42.6 % | −0.190 |
| F2 | 2016-19 | 5847 | −0.108 | +0.012 | -4.76 | −630.3 | 41.1 % | −0.228 |
| FADE | 2020 on | 9739 | −0.808 | +0.002 | -22.00 | −7866.7 | 21.4 % | −1.617 |
| FADE | 2016-19 | 5760 | −0.805 | +0.110 | -10.82 | −4636.9 | 23.6 % | −1.720 |

Median net R a trade, 2020 on: F1 −1.081, F2 −1.059, FADE −1.591. t of the gross (before costs) month sums, 2020 on: F1 3.74, F2 3.04, FADE 0.08; 2016-19: F1 0.96, F2 0.59, FADE 3.12.

Post-hoc, not judged (FADE: no minimum stop distance was pre-registered, so a few trades with a stop a fraction of a pip away divide the costs by almost nothing):

| Rows kept | Window | n | Net R a trade | Gross R a trade | t (months) |
|---|---|---|---|---|---|
| r0 >= 0.1 x range | 2020 on | 8989 | −0.722 | −0.006 | -22.01 |
| r0 >= 0.1 x range | 2016-19 | 5108 | −0.584 | +0.096 | -17.23 |
| r0 >= 0.25 x range | 2020 on | 1638 | −0.385 | +0.016 | -9.72 |
| r0 >= 0.25 x range | 2016-19 | 1207 | −0.402 | −0.008 | -7.57 |

## The pass bar

| Variant | Verdict | decisive net R a trade > 0 | decisive month-sum t >= 2 | 2016-19 net R a trade > 0 | Holm-adjusted p < 0.05 | beats the placebo 95th percentile | Holm p |
|---|---|---|---|---|---|---|---|
| F1 | FAIL | no | no | no | no | no | 1 |
| F2 | FAIL | no | no | no | no | no | 1 |
| FADE | FAIL | no | no | no | no | yes | 1 |

## Placebo (decisive window, 40 seeds: same pair, day, side and stop / target distance, random entry 08:00-11:55 London)

| Variant | Real net R a trade | Placebo mean | Placebo 95th pct | Placebo range |
|---|---|---|---|---|
| F1 | −0.050 | −0.039 | −0.026 | −0.055 to −0.025 |
| F2 | −0.075 | −0.063 | −0.054 | −0.084 to −0.050 |
| FADE | −0.808 | −0.906 | −0.867 | −0.937 to −0.844 |

## Per pair (net R a trade, n, t on months)

| Variant | Pair | 2020 on | n | t | 2016-19 | n | t |
|---|---|---|---|---|---|---|---|
| F1 | eurusd | −0.039 | 1670 | -0.88 | −0.180 | 983 | -3.13 |
| F1 | gbpusd | −0.044 | 1663 | -1.10 | +0.034 | 966 | 0.59 |
| F1 | usdjpy | −0.044 | 1584 | -0.95 | −0.118 | 955 | -1.99 |
| F1 | audusd | −0.096 | 1675 | -2.68 | −0.111 | 991 | -2.23 |
| F1 | usdchf | −0.087 | 1655 | -1.79 | −0.177 | 985 | -2.57 |
| F1 | eurjpy | +0.013 | 1628 | 0.28 | −0.066 | 967 | -1.10 |
| F2 | eurusd | −0.060 | 1670 | -1.97 | −0.178 | 983 | -4.71 |
| F2 | gbpusd | −0.049 | 1663 | -1.81 | +0.031 | 966 | 0.88 |
| F2 | usdjpy | −0.088 | 1584 | -2.86 | −0.136 | 955 | -3.88 |
| F2 | audusd | −0.103 | 1675 | -3.87 | −0.105 | 991 | -2.80 |
| F2 | usdchf | −0.117 | 1655 | -3.87 | −0.164 | 985 | -3.74 |
| F2 | eurjpy | −0.033 | 1628 | -1.05 | −0.093 | 967 | -2.28 |
| FADE | eurusd | −0.844 | 1650 | -13.80 | −0.567 | 973 | -6.93 |
| FADE | gbpusd | −0.705 | 1643 | -12.92 | −0.500 | 960 | -7.64 |
| FADE | usdjpy | −0.786 | 1557 | -11.13 | −0.995 | 924 | -4.57 |
| FADE | audusd | −0.939 | 1645 | -15.05 | −1.033 | 975 | -8.55 |
| FADE | usdchf | −0.893 | 1640 | -9.83 | −1.105 | 974 | -7.91 |
| FADE | eurjpy | −0.675 | 1604 | -11.93 | −0.631 | 954 | -7.71 |

## By year (net R a trade / total)

| Year | F1 | F2 | FADE |
|---|---|---|---|
| 2016 | −0.024 / −34.9 (n 1445) | −0.067 / −96.4 (n 1445) | −0.624 / −885.7 (n 1420) |
| 2017 | −0.069 / −101.6 (n 1468) | −0.020 / −28.8 (n 1468) | −0.673 / −974.5 (n 1447) |
| 2018 | −0.184 / −271.5 (n 1475) | −0.176 / −260.2 (n 1475) | −0.608 / −885.9 (n 1456) |
| 2019 | −0.135 / −196.3 (n 1459) | −0.168 / −244.9 (n 1459) | −1.316 / −1890.7 (n 1437) |
| 2020 | −0.021 / −30.1 (n 1415) | −0.057 / −80.6 (n 1415) | −0.910 / −1271.5 (n 1397) |
| 2021 | −0.098 / −145.8 (n 1486) | −0.071 / −105.5 (n 1486) | −0.825 / −1216.5 (n 1474) |
| 2022 | +0.024 / +34.5 (n 1439) | −0.009 / −13.3 (n 1439) | −0.483 / −686.8 (n 1423) |
| 2023 | −0.073 / −105.4 (n 1436) | −0.081 / −117.0 (n 1436) | −0.738 / −1050.8 (n 1424) |
| 2024 | −0.114 / −161.8 (n 1414) | −0.141 / −199.6 (n 1414) | −0.894 / −1242.0 (n 1389) |
| 2025 | −0.029 / −41.4 (n 1442) | −0.049 / −70.5 (n 1442) | −0.869 / −1232.4 (n 1418) |
| 2026 | −0.033 / −40.4 (n 1243) | −0.123 / −153.5 (n 1243) | −0.961 / −1166.8 (n 1214) |

## Exits, decisive window

- F1: stop 6123, time 3752
- F2: stop 5345, target 3652, time 878
- FADE: target 2088, stop 7650, time 1

## Days

| Pair | Candles | First | Last | Days with a range | Warm-up | Narrow | Wide | Kept |
|---|---|---|---|---|---|---|---|---|
| eurusd | 821744 | 2015-11-01 22:00 | 2026-11-12 23:55 | 2859 | 20 | 2 | 151 | 2686 |
| gbpusd | 821204 | 2015-11-01 22:00 | 2026-11-12 23:55 | 2859 | 20 | 4 | 175 | 2660 |
| usdjpy | 822120 | 2015-11-01 22:00 | 2026-11-12 23:55 | 2858 | 20 | 6 | 245 | 2587 |
| audusd | 818540 | 2015-11-01 22:00 | 2026-11-12 23:55 | 2857 | 20 | 4 | 128 | 2705 |
| usdchf | 813417 | 2015-11-01 22:00 | 2026-11-12 23:55 | 2857 | 20 | 3 | 167 | 2667 |
| eurjpy | 822238 | 2015-11-01 22:00 | 2026-11-12 23:55 | 2859 | 20 | 1 | 211 | 2627 |

## Reading (written after the run)

- **Follow (F1, F2) fails on costs, not on direction alone.** Before costs the London-open breakout made money in 2020 on
  (F1 +0.080R a trade, t 3.74 on gross month sums; F2 +0.040R, t 3.04), but not in 2016-19 (F1 +0.031R, t 0.96). The
  measured raw-spread costs (about 0.13R a trade at a typical 15-20 pip range) turn both negative in both windows
  (F1 −0.050R, t −2.28; F2 −0.075R, t −5.36). No pair passes alone; EUR/JPY F1 (+0.013R, t 0.28) is the only positive
  pair-window of 2020 on, and it lost in 2016-19. Both follow variants also sit BELOW their placebo (random entry
  08:00-11:55 London, same side and stop): the breakout entry is worse than a random entry on the same side, which says the
  pooled gross gain is the day's direction, not the breakout moment.
- **Fade fails outright.** Its stop (past the break candle's extreme + 0.1 x range) is a median 2.6 pips from the market
  entry in 2020 on (638 of 9,739 trades under 1 pip), so the costs alone are more than half a risk unit; before costs it is
  flat (+0.002R, t 0.08 in 2020 on) and the 2016-19 gross gain (+0.110R) disappears net (−0.805R). The pre-registration set
  no minimum stop distance, so tight-stop trades weigh heavily in R; the post-hoc tables without them (stop at least 0.1 or
  0.25 x the range away) are −0.38R to −0.72R a trade, t −7.6 to −22: the verdict does not rest on those rows. Its placebo
  line "beats" only because random entries with the same tight stop lose even more.
- Not an edge in any form tested. No proposal is written; nothing live changes. A further test would need a different,
  pre-registered rule (for example a wider stop and a session-long hold), not a tweak of these three.

To repeat: `node --use-env-proxy research/edge/fx-london-orb/run.mjs fetch <dir>` (candles outside git), then `node research/edge/fx-london-orb/run.mjs full <dir>`. Tests: `tests/fx-london-orb.test.mjs`.
