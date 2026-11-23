# Next-candle engulf against the three-candle engulf, 2010-2019 (result)

**Verdict: FAIL. 0 of 3. Before costs in 2015-2019: plan next-candle −0.081R a trade (n 1663, month t -3.4), short method next-candle +0.002R (n 1464, t 0.04); next-candle minus three-candle at 2R −0.006R (Welch t -0.2).**

Run 2026-11-23 as pre-registered (`PREREGISTRATION.md`, pushed alone first). `council/eg-methods.mjs` `methodTrades` imported unchanged, run with
`span: 'next'` and with the default three-candle engulf, on OANDA mid 5-minute candles of xau, eurusd, gbpusd, usdjpy, audusd,
fills 2010-2019 (discovery 2010-14, confirmation 2015-19). Judged before costs; after costs (combo-grid-2 `COSTS`) beside.
Research only: nothing live changed.

## Tests (pooled five markets, before costs; Holm over three)

| Test | 2010-14 | 2015-19 | Placebo check (2015-19) | Holm p | Pass |
|---|---|---|---|---:|---|
| T1 plan, next-candle engulf (eg-plan-n), desk target 1R | −0.045R, n 1894, month t -2.04 | −0.081R, n 1663, month t -3.4 | flipped side +0.064R; real minus flipped −0.145R, Welch t -4.17 | 1 | no |
| T2 short method, next-candle engulf (eg-simple-n), desk target 4R | −0.036R, n 1738, month t -0.8 | +0.002R, n 1464, month t 0.04 | flipped side +0.093R; real minus flipped −0.090R, Welch t -1.19 | 1 | no |
| T3 next-candle minus three-candle, plan + short method, common 2R, pooled | −0.028R (n 3741 vs 8034), Welch t -1.01 | −0.006R (n 3324 vs 6290), Welch t -0.2 | n/a | 1 | no |

After costs: plan next-candle −0.124R a trade in 2015-19 (month t -5.23), short method next-candle −0.040R (t -0.68).
The next-candle engulf did not beat the three-candle one in either half, at the common 2R or at the desk targets (desk targets, 2015-19: −0.010R, Welch t -0.34).
Both readings are at or below zero before costs; the flipped-side placebo did at least as well as the real side in every stream, so
what is left is the resting limit with this stop, not the engulf's direction.

## Every stream (pooled, before costs; after costs in brackets)

| Stream | 2010-14 | 2015-19 | Target reached 2015-19 |
|---|---|---|---:|
| eg-plan@desk | −0.020 (n 5739, t -1.36) [−0.063] | −0.028 (n 4664, t -1.79) [−0.072] | 48.8 % |
| eg-simple@desk | −0.035 (n 5122, t -2.84) [−0.081] | −0.036 (n 4203, t -2.45) [−0.081] | 48.4 % |
| eg-plan-n@desk | −0.045 (n 1894, t -2.04) [−0.088] | −0.081 (n 1663, t -3.4) [−0.124] | 46.1 % |
| eg-simple-n@desk | −0.036 (n 1738, t -0.8) [−0.080] | +0.002 (n 1464, t 0.04) [−0.040] | 20.1 % |
| eg-plan@2R | −0.025 (n 4320, t -1.12) [−0.070] | −0.041 (n 3309, t -1.64) [−0.087] | 32.1 % |
| eg-simple@2R | −0.043 (n 3714, t -2.03) [−0.090] | −0.032 (n 2981, t -1.27) [−0.077] | 32.4 % |
| eg-plan-n@2R | −0.071 (n 1914, t -2.22) [−0.114] | −0.086 (n 1772, t -2.75) [−0.128] | 30.7 % |
| eg-simple-n@2R | −0.052 (n 1827, t -1.58) [−0.095] | +0.007 (n 1552, t 0.2) [−0.035] | 33.6 % |

## Per market, desk targets, before costs (R a trade, n, month t)

| Stream | Market | 2010-14 | 2015-19 | 2010-19 after costs |
|---|---|---|---|---:|
| eg-plan-n@desk | xau | −0.081, 509, -1.69 | −0.026, 421, -0.51 | −0.156 |
| eg-plan-n@desk | eurusd | −0.009, 353, -0.16 | −0.117, 311, -1.87 | −0.079 |
| eg-plan-n@desk | gbpusd | −0.043, 401, -1.13 | −0.073, 358, -1.31 | −0.084 |
| eg-plan-n@desk | usdjpy | −0.046, 264, -0.88 | −0.113, 318, -2.23 | −0.109 |
| eg-plan-n@desk | audusd | −0.031, 367, -0.61 | −0.098, 255, -1.8 | −0.079 |
| eg-simple-n@desk | xau | −0.057, 466, -0.66 | −0.076, 362, -0.66 | −0.166 |
| eg-simple-n@desk | eurusd | −0.033, 336, -0.3 | +0.229, 264, 1.72 | +0.063 |
| eg-simple-n@desk | gbpusd | +0.056, 355, 0.57 | +0.036, 333, 0.35 | +0.020 |
| eg-simple-n@desk | usdjpy | −0.038, 236, -0.28 | −0.082, 260, -0.83 | −0.088 |
| eg-simple-n@desk | audusd | −0.102, 345, -0.89 | −0.082, 245, -0.66 | −0.114 |
| eg-plan@desk | xau | −0.009, 1496, -0.36 | +0.001, 1291, 0.05 | −0.104 |
| eg-plan@desk | eurusd | +0.028, 1130, 1.17 | −0.069, 819, -1.83 | −0.033 |
| eg-plan@desk | gbpusd | −0.039, 1199, -1.44 | +0.001, 965, 0.02 | −0.048 |
| eg-plan@desk | usdjpy | −0.034, 767, -0.83 | −0.069, 887, -2.01 | −0.080 |
| eg-plan@desk | audusd | −0.050, 1147, -1.59 | −0.019, 702, -0.43 | −0.058 |
| eg-simple@desk | xau | −0.019, 1478, -0.85 | −0.021, 1164, -0.82 | −0.120 |
| eg-simple@desk | eurusd | −0.086, 948, -2.53 | −0.057, 701, -1.38 | −0.094 |
| eg-simple@desk | gbpusd | +0.036, 1019, 1.37 | −0.017, 960, -0.44 | −0.016 |
| eg-simple@desk | usdjpy | −0.058, 689, -1.34 | −0.066, 766, -1.81 | −0.089 |
| eg-simple@desk | audusd | −0.070, 988, -2.26 | −0.033, 612, -0.95 | −0.076 |

No market of the next-candle readings reaches month t 2 in both halves; the one positive confirmation figure of note (eurusd
short method next-candle, +0.229R, t 1.72) lost in 2010-14.

## Notes

- Left out: trades still open at the end of their year's chunk (5) and trades whose span touches a data-quality exclusion (65).
- The stop is 30 of each market's own pips (gold $3.00 at prices of $1,050-1,900 in these years), as the desk reads it today.
- The 2026 split that suggested this test was one year after the fact; on ten earlier years the difference is about zero
  (pooled 2010-19 at 2R −0.018R, Welch t -0.87). Not an edge, nothing to propose; the question is closed on these years.

Repeat: `EDGE_DATA=<cache> node research/edge/eg-span-holdout/run.mjs market <m> <dir>` for the five markets, then `… report <dir>`.
