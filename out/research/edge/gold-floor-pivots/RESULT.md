# Gold floor pivots as intraday support and resistance: result (14 Nov 2026)

**Verdict: FAIL: fading R1/S1 made −0.151R a trade net out of sample (n 796, month t −3.83); 0 of 3 tests pass.**

Pre-registered in PREREGISTRATION.md (pushed before any candle was read). OANDA mid M5 gold, 2016-01-01 to 2026-11-13 (2806 trading days); in sample 2016-20, out of sample 2021 to 2026-11-13. Levels from the previous folded UTC day (P = (H+L+C)/3, R1 = 2P - L, S1 = 2P - H), ATR20 of folded days, trading window 07:00-20:00 UTC, a level used only when 0.1 x ATR or more from the 07:00 open, one trade per test a day. Costs $0.60 a round trip in R of each trade's own risk; financing on buys over a rollover is counted and is 0 (every trade is flat by 20:00 UTC). t on calendar-month sums of net R, Holm over the three tests; placebo = the ladder shifted each day by a random 0.3-0.7 x ATR, 40 seeds.

A stand-alone rule: never a gate, exit, entry or size of the live gold book, and nothing live changed.

## The three tests

| Test | Window | n | Gross R a trade | Net R a trade | Net at 2x costs | t months (net) | t months (gross) | Total net R | Win rate | Stop / target / time |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 fade R1 / S1 to P | in sample | 693 | −0.011 | −0.169 | −0.327 | −4.17 | −0.28 | -117.05 | 39.83 % | 347 / 163 / 183 |
| T1 fade R1 / S1 to P | out of sample | 796 | −0.071 | −0.151 | −0.231 | −3.83 | −1.84 | -120.36 | 39.82 % | 406 / 190 / 200 |
| T2 break of R1 / S1, held to 20:00 | in sample | 627 | +0.074 | −0.061 | −0.195 | −1.44 | 1.77 | -38.04 | 38.6 % | 275 / 0 / 352 |
| T2 break of R1 / S1, held to 20:00 | out of sample | 744 | +0.018 | −0.050 | −0.119 | −1.03 | 0.37 | -37.5 | 39.38 % | 323 / 0 / 421 |
| T3 bounce off P to R1 / S1 | in sample | 504 | +0.028 | −0.169 | −0.366 | −2.60 | 0.45 | -85.15 | 36.9 % | 287 / 89 / 128 |
| T3 bounce off P to R1 / S1 | out of sample | 596 | +0.023 | −0.081 | −0.185 | −1.48 | 0.43 | -48.18 | 36.58 % | 329 / 116 / 151 |

## By side (net R a trade, n)

| Test | IS buy | IS sell | OOS buy | OOS sell |
|---|---|---|---|---|
| T1 | −0.199 (348) | −0.138 (345) | −0.196 (389) | −0.109 (407) |
| T2 | −0.012 (321) | −0.112 (306) | −0.079 (378) | −0.021 (366) |
| T3 | −0.094 (253) | −0.245 (251) | −0.057 (310) | −0.107 (286) |

## The pass bar

| Test | OOS net > 0 | t >= 2 and Holm p < 0.05 | IS net > 0 | 2x costs > 0 | beats >= 38 of 40 placebos | OOS n >= 30 | p (one-sided) | Holm p | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| T1 | no | no | no | no | no | yes | 0.9999 | 1 | FAIL |
| T2 | no | no | no | no | no | yes | 0.8464 | 1 | FAIL |
| T3 | no | no | no | no | no | yes | 0.9283 | 1 | FAIL |

## Placebo (out of sample, 40 seeds)

| Test | Real net | Placebo mean | Placebo 95th pct | Placebo range | Real gross | Placebo gross mean | Placebos beaten |
|---|---|---|---|---|---|---|---|
| T1 | −0.151 | −0.097 | −0.015 | −0.184 to −0.012 | −0.071 | −0.015 | 6 of 40 |
| T2 | −0.050 | −0.009 | +0.073 | −0.098 to +0.152 | +0.018 | +0.063 | 10 of 40 |
| T3 | −0.081 | −0.081 | +0.013 | −0.227 to +0.026 | +0.023 | +0.020 | 19 of 40 |

## Reading

- T1 fade R1 / S1 to P: out of sample −0.071R gross, −0.151R net a trade (n 796, month t −3.83); in sample −0.169R net (n 693). The real ladder beats 6 of 40 shifted ladders (placebo mean −0.097R).
- T2 break of R1 / S1, held to 20:00: out of sample +0.018R gross, −0.050R net a trade (n 744, month t −1.03); in sample −0.061R net (n 627). The real ladder beats 10 of 40 shifted ladders (placebo mean −0.009R).
- T3 bounce off P to R1 / S1: out of sample +0.023R gross, −0.081R net a trade (n 596, month t −1.48); in sample −0.169R net (n 504). The real ladder beats 19 of 40 shifted ladders (placebo mean −0.081R).
- Not an edge. The levels are neither a fade nor a break worth trading on gold after costs; nothing is proposed and nothing live changed.

To repeat: build the M5 cache (rows [t, o, h, l, c, v] from the site candle proxy, gzip JSON, outside git), then `node research/edge/gold-floor-pivots/run.mjs <cache>`. Tests: `tests/gold-floor-pivots.test.mjs`.
