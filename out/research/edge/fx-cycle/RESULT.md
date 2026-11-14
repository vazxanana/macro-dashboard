# The owner's market cycle as an entry on forex majors: result

**Verdict: FAIL.** Neither exit passed every pre-registered line. Exit A (target the H4 move's extreme): −0.135R a trade net on 2016-2026 (n 1892, monthly t −4.48). Exit B (fixed 2R): −0.089R (n 4677, monthly t −4.27).

Pre-registration: `PREREGISTRATION.md` (copied from `research/edge/index-cycle/PREREGISTRATION.md`, branch `index-cycle`; markets,
skip window and costs changed for forex). Paper research only: nothing live changed. Never call this rule an edge on forex.

## Pass bar

| Line | Exit A | Exit B |
|---|---|---|
| Decisive mean net R > 0 | no | no |
| Monthly t >= 2 | no | no |
| Holm p < 0.05 | yes | yes |
| Replication mean net R > 0 | no | no |
| Above the placebo 95th percentile | no | no |
| **Exit passes** | **no** | **no** |

The p is two-sided, as pre-registered: where the Holm line reads "yes" with a negative mean, the result is significant in the losing direction.

## Pooled results (five pairs, net of costs and financing)

| Exit | Window | n | Net R | Mean net R | Mean gross R | t (trades) | Months | t (monthly) | p | Holm p |
|---|---|---|---|---|---|---|---|---|---|---|
| A | 2016-now (decisive) | 1892 | −254.510 | −0.135 | −0.053 | −4.28 | 131 | −4.48 | < 0.0001 | < 0.0001 |
| A | 2010-2015 (replication) | 1065 | −133.380 | −0.125 | −0.054 | −3.01 | 72 | −3.50 | 0.0005 | |
| B | 2016-now (decisive) | 4677 | −416.140 | −0.089 | −0.018 | −4.69 | 131 | −4.27 | < 0.0001 | < 0.0001 |
| B | 2010-2015 (replication) | 2642 | −335.970 | −0.127 | −0.066 | −5.14 | 72 | −5.07 | < 0.0001 | |

## Placebo: random entries with the H4 bias, same market, direction, stop distance and target in R (40 seeds)

| Exit | Real decisive mean net R | Placebo median | Placebo 95th percentile |
|---|---|---|---|
| A | −0.135 | −0.086 | −0.031 |
| B | −0.089 | −0.079 | −0.042 |

Read: the entry after "the pullback finished" did worse than the median random entry with the same H4 bias for Exit A and worse for Exit B; waiting for the pullback to finish adds nothing over trading with the H4 bias, and trading with the bias alone loses after costs too.

## Per pair, decisive window (reported, never decisive)

| Exit | Pair | Signals 2008-now | n | Mean net R | t (monthly) | Replication n | Replication mean net R | Mean stop (pips) |
|---|---|---|---|---|---|---|---|---|
| A | eurusd | 1976 | 425 | −0.243 | −3.61 | 221 | −0.186 | 25.2 |
| A | gbpusd | 1973 | 423 | −0.146 | −2.16 | 227 | −0.010 | 37.27 |
| A | usdjpy | 1778 | 356 | −0.087 | −1.26 | 209 | −0.163 | 37.86 |
| A | audusd | 1839 | 361 | −0.046 | −0.61 | 193 | −0.116 | 22.47 |
| A | usdcad | 1892 | 327 | −0.127 | −1.57 | 215 | −0.156 | 28.14 |
| B | eurusd | 1976 | 985 | −0.161 | −3.90 | 543 | −0.165 | 33.02 |
| B | gbpusd | 1973 | 976 | −0.059 | −1.35 | 563 | −0.072 | 46.06 |
| B | usdjpy | 1778 | 894 | −0.104 | −2.44 | 484 | −0.128 | 45.38 |
| B | audusd | 1839 | 911 | −0.036 | −0.82 | 520 | −0.136 | 31.41 |
| B | usdcad | 1892 | 911 | −0.082 | −2.02 | 532 | −0.138 | 37.69 |

## By exit reason, decisive window

| Exit | Reason | n | Mean gross R | Mean net R |
|---|---|---|---|---|
| A | target | 581 | +1.752 | +1.687 |
| A | stop | 1173 | −1.000 | −1.089 |
| A | gap | 7 | −1.622 | −1.701 |
| A | time | 131 | +0.505 | +0.414 |
| B | target | 1161 | +2.000 | +1.937 |
| B | stop | 2692 | −1.000 | −1.075 |
| B | gap | 19 | −1.506 | −1.577 |
| B | time | 805 | +0.390 | +0.323 |

## Costs

Mean cost a trade in the decisive window: Exit A +0.082R, Exit B +0.071R (0.3 pip spread + 45 per million commission
a round trip, 0.5 pip a market fill, 0.004 % a rollover night). Twice the costs, decisive mean net R: Exit A −0.216R, Exit B −0.160R.
Financing is a flat assumption charged on both sides: **real carry is not measured** (it depends on each pair's rate gap and sign).

## By year of exit, decisive window (Exit A | Exit B, mean net R, n)

| Year | Exit A | Exit B |
|---|---|---|
| 2016 | −0.088 (180) | +0.042 (436) |
| 2017 | −0.019 (200) | −0.085 (432) |
| 2018 | −0.053 (175) | −0.123 (444) |
| 2019 | −0.139 (165) | +0.034 (420) |
| 2020 | −0.019 (171) | −0.054 (417) |
| 2021 | −0.192 (173) | −0.111 (441) |
| 2022 | −0.191 (177) | −0.111 (445) |
| 2023 | −0.212 (162) | −0.156 (427) |
| 2024 | −0.213 (174) | −0.152 (434) |
| 2025 | −0.238 (161) | −0.163 (415) |
| 2026 | −0.148 (154) | −0.099 (366) |

## Data

OANDA mid H1 candles through the site's candle proxy, kept out of git (`node --use-env-proxy fetch.mjs <dir>`, then `node run.mjs <dir>`):

- eurusd: 119399 candles, 2008-01-01T09:00 to 2026-11-13T20:00 UTC
- gbpusd: 119278 candles, 2008-01-01T18:00 to 2026-11-13T20:00 UTC
- usdjpy: 119319 candles, 2008-01-01T18:00 to 2026-11-13T20:00 UTC
- audusd: 119309 candles, 2008-01-01T18:00 to 2026-11-13T20:00 UTC
- usdcad: 119236 candles, 2008-01-01T18:00 to 2026-11-13T20:00 UTC

## What follows

A FAIL ends this reading on forex: no parameter will be varied after seeing the result (pre-registered). Not a council rule, not a filter; nothing live changed.
