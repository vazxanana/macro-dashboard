# The Mosha sequence entries with the weekly side and a trending Daily

**Verdict: FAIL. 0 of 2: weekly agrees and er20 >= 0.2 made −0.249R a trade after costs in 2020-2023 (n 224, month t -1.35) and −0.012R from 2024 (n 168, month t -0.06); the rest −0.318R and −0.013R.**

Built 2026-11-23. Pre-registered (PREREGISTRATION.md, committed before any trade was computed). Paper research only: nothing live changed. Window B runs to 2026-11-22. Population: the sequence's EG entry (sop-… and sop-i-… records), gold, EUR/USD, GBP/USD pooled; 1484 trades, 0 without both tags (left out of both sides).

## The two tests

| Test | Window | n | win % | PF | R before costs | R after costs | month t | total R | rest n | rest R after costs | difference | Welch t |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F1 | 2020-2023 | 224 | 21 | 0.72 | −0.142 | −0.249 | -1.35 | -55.89 | 633 | −0.318 | +0.068 | 0.39 |
| F1 | 2024 on | 168 | 20.2 | 0.99 | +0.131 | −0.012 | -0.06 | -1.94 | 459 | −0.013 | +0.001 | 0 |
| F2 | 2020-2023 | 89 | 19.1 | 0.61 | −0.242 | −0.354 | -1.53 | -31.55 | 768 | −0.293 | −0.061 | -0.29 |
| F2 | 2024 on | 84 | 19 | 1.13 | +0.256 | +0.122 | 0.38 | 10.25 | 543 | −0.033 | +0.155 | 0.43 |

| Test | p (larger of the windows, one-sided) | Holm p | Checks | Verdict |
|---|---|---|---|---|
| F1: weekly side agrees AND er20 >= 0.2 (primary) | 0.9115 | 1 | n100 yes, positiveA no, positiveB no, betterThanRestA yes, betterThanRestB yes, holm no | FAIL |
| F2: weekly side agrees AND er20 >= 0.35 (secondary) | 0.937 | 1 | n100 no, positiveA no, positiveB no, betterThanRestA no, betterThanRestB yes, holm no | FAIL (too few to judge) |

F2 against the F1 trades that are not in F2 (0.2 <= er20 < 0.35): 2020-2023 −0.174R a trade (Welch t -0.6; the middle group n 135, −0.180R), from 2024 +0.267R (t 0.62; n 84, −0.145R).

Every sequence entry (no filter): 2020-2023 n 857, −0.300R after costs (month t -3.59, PF 0.67); from 2024 n 627, −0.012R (month t -0.11, PF 0.99).

## Each condition alone (reported, no verdict)

| Condition | Window | n | win % | PF | R before costs | R after costs | month t | total R |
|---|---|---|---|---|---|---|---|---|
| weeklyAgrees | 2020-2023 | 428 | 20.6 | 0.75 | −0.118 | −0.220 | -1.57 | -93.94 |
| weeklyAgrees | 2024 on | 341 | 18.5 | 0.91 | +0.045 | −0.087 | -0.61 | -29.71 |
| er20AtLeast0.2 | 2020-2023 | 438 | 21 | 0.72 | −0.133 | −0.243 | -2.21 | -106.62 |
| er20AtLeast0.2 | 2024 on | 308 | 21.8 | 1.09 | +0.215 | +0.081 | 0.5 | 25 |
| er20AtLeast0.35 | 2020-2023 | 179 | 20.1 | 0.68 | −0.173 | −0.287 | -1.97 | -51.44 |
| er20AtLeast0.35 | 2024 on | 141 | 22 | 1.4 | +0.485 | +0.355 | 1 | 50.08 |

## F1 by market (reported; USD/JPY and AUD/USD never in the verdict)

| Market | Window | F1 n | F1 R after costs | month t | rest n | rest R | F2 n | F2 R after costs |
|---|---|---|---|---|---|---|---|---|
| xau | 2020-2023 | 64 | −0.360 | -1.54 | 207 | −0.453 | 26 | −0.324 |
| xau | 2024 on | 40 | +1.024 | 1.65 | 145 | −0.134 | 26 | +1.713 |
| eurusd | 2020-2023 | 74 | −0.184 | -0.53 | 219 | −0.190 | 35 | −0.582 |
| eurusd | 2024 on | 62 | −0.051 | -0.13 | 137 | −0.142 | 27 | −0.346 |
| gbpusd | 2020-2023 | 86 | −0.223 | -0.86 | 207 | −0.318 | 28 | −0.099 |
| gbpusd | 2024 on | 66 | −0.602 | -3.25 | 177 | +0.187 | 31 | −0.805 |
| usdjpy (reported) | 2020-2023 | 81 | −0.003 | -0.01 | 197 | −0.471 | 42 | −0.034 |
| usdjpy (reported) | 2024 on | 52 | −0.634 | -2.54 | 160 | +0.725 | 27 | −0.662 |
| audusd (reported) | 2020-2023 | 104 | −0.119 | -0.59 | 265 | −0.296 | 39 | −0.211 |
| audusd (reported) | 2024 on | 50 | −0.087 | -0.19 | 177 | −0.162 | 21 | −0.260 |

## F1 by ladder step (the BO's timeframe; primary markets)

| BO on | Window | F1 n | F1 R after costs | rest n | rest R |
|---|---|---|---|---|---|
| 1d | 2020-2023 | 4 | −1.046 | 53 | −0.397 |
| 1d | 2024 on | 0 | n/a | 58 | −0.260 |
| 4h | 2020-2023 | 42 | −0.545 | 100 | −0.294 |
| 4h | 2024 on | 37 | −0.381 | 80 | +0.053 |
| 1h | 2020-2023 | 29 | −0.092 | 48 | −0.295 |
| 1h | 2024 on | 14 | +0.069 | 31 | −0.275 |
| 30m | 2020-2023 | 68 | −0.209 | 166 | −0.297 |
| 30m | 2024 on | 55 | +0.047 | 123 | +0.099 |
| 15m | 2020-2023 | 81 | −0.148 | 266 | −0.327 |
| 15m | 2024 on | 62 | +0.139 | 167 | +0.008 |

## What it means

Neither test passed. The two conditions are not made a filter on the Mosha desk and are not looked at again on these years. The figure quoted in the owner's notes is not reproduced by the desk's own reading of this entry on these candles; what a person adds by choosing which setups to take is not in any rule.

Limits: OANDA mid candles; no one-minute history (an M5 VR's CF is read on M5, as the desk does when M1 is missing); costs as desk-rigor, today's for every year, no financing; R as the desk books it (stop first when one candle holds both). 2020-2025 was read by desk-rigor and 2026 by the desk's own records.
