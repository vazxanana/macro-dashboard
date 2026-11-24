# Result: opening gaps as key levels, entered on an M15 engulf (24 Nov 2026)

**Verdict: FAIL. 0 of 4 cells pass; the best, weekly 2R, made -0.018R a trade after costs in 2015-26 (n 5250, month t -0.66; before costs +0.021R).**

Pre-registered in `PREREGISTRATION.md` (committed alone before any run). Written by `run.mjs` from `result.json`. Research only: nothing live changed, no rule is proposed.

## The rule, in short

A weekly gap (a closure of 40 hours or more) or a daily gap (across the 17:00 New York roll) larger than 0.1 x the Daily ATR(14) is a zone for the rest of its week. After an M15 candle wholly outside it, the first M15 candle that trades back into it opens a visit of 8 candles; the first engulf in the direction away from the gap (completed within 3 candles) is a market entry at the next 5-minute open, stop past the gap's far side by 0.1 x ATR(14) of M15, target 1R or 2R, out after 24 hours. OANDA mid 5-minute candles, xau, eurusd, gbpusd, usdjpy, audusd; costs of `combo-grid-2` charged on every trade; R in units of the trade's own risk.

## The four cells (five markets pooled)

| cell | n 2005-14 | won | R before costs | R after costs | month t after | n 2015-26 | won | R before costs | R after costs | month t before | month t after | Holm p | passes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| weekly 1R | 1751 | 49 % | -0.009 | -0.049 | -1.79 | 5250 | 49 % | -0.001 | -0.040 | -0.07 | -2.11 | 1.00 | no |
| weekly 2R | 1751 | 38 % | +0.002 | -0.037 | -1.09 | 5250 | 39 % | +0.021 | -0.018 | 0.77 | -0.66 | 1.00 | no |
| daily 1R | 115 | 49 % | -0.025 | -0.104 | -0.67 | 513 | 47 % | -0.064 | -0.114 | -1.29 | -2.24 | 1.00 | no (too few) |
| daily 2R | 115 | 37 % | +0.065 | -0.015 | -0.06 | 513 | 33 % | -0.095 | -0.145 | -1.27 | -1.88 | 1.00 | no (too few) |

Month t = the t of calendar-month sums of R (120 months in 2005-14, 142 in 2015-26, empty months as 0). Holm p: one-sided, from the confirmation month t after costs, over the four cells.

## By market (context only, no verdict)

**xau** (round trip 0.3)

| cell | n 2005-14 | won | R before costs | R after costs | month t after | n 2015-26 | won | R before costs | R after costs | month t before | month t after | Holm p | passes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| weekly 1R | 138 | 52 % | +0.039 | -0.063 | -0.68 | 773 | 51 % | +0.016 | -0.044 | 0.33 | -0.86 |  |  |
| weekly 2R | 138 | 41 % | +0.067 | -0.035 | -0.27 | 773 | 40 % | +0.017 | -0.042 | 0.24 | -0.56 |  |  |
| daily 1R | 97 | 43 % | -0.121 | -0.208 | -1.18 | 125 | 51 % | +0.037 | -0.006 | 0.41 | -0.06 |  |  |
| daily 2R | 97 | 34 % | -0.001 | -0.088 | -0.30 | 125 | 39 % | +0.108 | +0.065 | 0.80 | 0.48 |  |  |

**eurusd** (round trip 0.00006)

| cell | n 2005-14 | won | R before costs | R after costs | month t after | n 2015-26 | won | R before costs | R after costs | month t before | month t after | Holm p | passes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| weekly 1R | 363 | 43 % | -0.116 | -0.144 | -1.93 | 1059 | 47 % | -0.047 | -0.079 | -1.13 | -1.88 |  |  |
| weekly 2R | 363 | 29 % | -0.236 | -0.263 | -2.64 | 1059 | 37 % | -0.031 | -0.063 | -0.55 | -1.11 |  |  |
| daily 1R | 0 | n/a | n/a | n/a | n/a | 40 | 53 % | -0.008 | -0.058 | -0.04 | -0.31 |  |  |
| daily 2R | 0 | n/a | n/a | n/a | n/a | 40 | 33 % | -0.286 | -0.336 | -1.10 | -1.26 |  |  |

**gbpusd** (round trip 0.00008)

| cell | n 2005-14 | won | R before costs | R after costs | month t after | n 2015-26 | won | R before costs | R after costs | month t before | month t after | Holm p | passes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| weekly 1R | 382 | 51 % | +0.017 | -0.017 | -0.27 | 1143 | 50 % | +0.010 | -0.022 | 0.26 | -0.57 |  |  |
| weekly 2R | 382 | 40 % | +0.046 | +0.012 | 0.13 | 1143 | 38 % | +0.017 | -0.016 | 0.31 | -0.29 |  |  |
| daily 1R | 10 | 70 % | +0.400 | +0.378 | 1.00 | 83 | 42 % | -0.180 | -0.223 | -1.16 | -1.37 |  |  |
| daily 2R | 10 | 30 % | -0.231 | -0.253 | -1.00 | 83 | 23 % | -0.411 | -0.455 | -1.71 | -1.82 |  |  |

**usdjpy** (round trip 0.008)

| cell | n 2005-14 | won | R before costs | R after costs | month t after | n 2015-26 | won | R before costs | R after costs | month t before | month t after | Holm p | passes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| weekly 1R | 406 | 53 % | +0.047 | +0.004 | 0.07 | 1080 | 48 % | -0.018 | -0.055 | -0.42 | -1.21 |  |  |
| weekly 2R | 406 | 44 % | +0.136 | +0.093 | 1.12 | 1080 | 39 % | +0.034 | -0.003 | 0.54 | -0.05 |  |  |
| daily 1R | 4 | 75 % | +0.405 | +0.312 | 0.83 | 87 | 40 % | -0.148 | -0.207 | -1.01 | -1.35 |  |  |
| daily 2R | 4 | 75 % | +1.155 | +1.062 | 1.54 | 87 | 30 % | -0.076 | -0.135 | -0.42 | -0.71 |  |  |

**audusd** (round trip 0.00006)

| cell | n 2005-14 | won | R before costs | R after costs | month t after | n 2015-26 | won | R before costs | R after costs | month t before | month t after | Holm p | passes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| weekly 1R | 462 | 50 % | -0.011 | -0.042 | -0.62 | 1195 | 51 % | +0.033 | -0.005 | 0.82 | -0.13 |  |  |
| weekly 2R | 462 | 39 % | +0.016 | -0.015 | -0.17 | 1195 | 39 % | +0.060 | +0.022 | 1.03 | 0.38 |  |  |
| daily 1R | 4 | 100 % | +0.814 | +0.788 | 1.45 | 178 | 47 % | -0.052 | -0.107 | -0.67 | -1.39 |  |  |
| daily 2R | 4 | 100 % | +1.318 | +1.292 | 1.46 | 178 | 34 % | -0.057 | -0.111 | -0.53 | -1.03 |  |  |

## How many gaps

| market | weekly gaps over the filter | gave a trade | trades | daily gaps over the filter | gave a trade | trades |
|---|---|---|---|---|---|---|
| xau | 205 | 181 | 911 | 58 | 46 | 222 |
| eurusd | 287 | 264 | 1422 | 16 | 10 | 40 |
| gbpusd | 309 | 281 | 1525 | 40 | 34 | 93 |
| usdjpy | 318 | 287 | 1486 | 37 | 32 | 91 |
| audusd | 331 | 302 | 1657 | 72 | 59 | 182 |

## Limits

- Mid candles: the spread at and after a reopen is wider than the flat cost charged here (`fx-weekend-gap-exec` measured about 11 pips quoted at the Sunday reopen on the demo account). Entries here come later in the week, but a Sunday-evening entry is flattered.
- The cost is today's demo figure charged on every year.
- On forex these candles have no closure at the 17:00 New York roll, so a daily gap over the filter is rare outside gold; the daily cells are mostly gold.
- Trades overlap (several visits of one gap, several markets), so the per-trade count overstates the independent evidence; the month t is the figure to read.
- One run of the pre-registered rule; no variant was tried. Never call any cell an edge.
