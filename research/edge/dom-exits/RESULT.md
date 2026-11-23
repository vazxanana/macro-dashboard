# Which exit suits the H1 dominant-zone limit, 2010-2019

**Verdict: PASS. Before costs the 2R exit made +0.053R a trade in 2010-14 (n 75,351, month t 8.33) and +0.045R in 2015-19 (n 75,703, t 6.41); no other exit beats 2R after Holm, and after costs every exit loses (2R -0.058R a trade).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed alone first) on OANDA mid 5-minute candles of gold, EUR/USD,
GBP/USD, USD/JPY and AUD/USD, trades filled 2010-01-01 to 2019-12-31: years none of the three combination grids read. The rule
is the grid 3 engine unchanged (H1 dominant zone, touched on M5, a limit at the near edge, stop past the far side by half the
cost + 0.25 x ATR(14) of H1, H1 time limit 2 days). Judged before costs, as the owner asked; after costs (combo-grid-2 `COSTS`)
beside. Research only: nothing live changed.

## T1: the 2R exit (the demo job's) before costs

| Window | n | R a trade before costs (month t) | after costs (month t) | Won |
|---|---:|---:|---:|---:|
| 2010-2014 | 75,351 | +0.053 (8.33) | -0.046 (-6.91) | 35 % |
| 2015-2019 | 75,703 | +0.045 (6.41) | -0.069 (-9.32) | 35 % |

Positive with month t >= 2 in both halves: **T1 passes.** The before-cost tilt seen on 2020-26 is there on 2010-19 too, about
the same size. After costs it loses in both halves: the cost is about 0.11R a trade (the median stop is a few round trips wide),
twice the tilt.

## T2: each exit against 2R, paired by trade (2010-2019, 120 months)

| Exit | Pooled R before costs (month t) | after costs | Minus 2R, a trade (month t) | Holm p | 2010-14 / 2015-19 difference | Beats 2R |
|---|---:|---:|---:|---:|---:|---|
| 1R | +0.046 (13.88) | -0.061 | -0.004 (-1.20) | 1 | -0.007 / 0.000 | no |
| **2R** | **+0.049 (10.36)** | **-0.058** | | | | |
| 3R | +0.049 (8.04) | -0.058 | -0.001 (-0.15) | 1 | +0.006 / -0.007 | no |
| 4R | +0.053 (7.36) | -0.054 | +0.003 (0.69) | 1 | +0.012 / -0.005 | no |
| 6R | +0.059 (6.58) | -0.048 | +0.010 (1.36) | 1 | +0.022 / -0.003 | no |
| Opposite zone | +0.052 (9.23) | -0.055 | +0.003 (0.86) | 1 | +0.007 / -0.001 | no |
| 1R trail from +1R | +0.055 (14.28) | -0.052 | +0.006 (1.87) | 0.45 | +0.006 / +0.005 | no |
| Far H4 / D1 target (n 37,268) | +0.014 (0.77) | -0.120 | -0.035 (-2.11) | 0.30 | -0.026 / -0.045 | no |
| M5 EF trail | +0.053 (12.11) | -0.054 | +0.003 (0.76) | 1 | +0.003 / +0.003 | no |
| 24 h hold | +0.083 (6.13) | -0.023 (-1.71) | +0.034 (2.76) | 0.060 | +0.047 / +0.021 | no |

**No exit beats 2R on the pre-registered bar.** The nearest is the 24-hour hold (no target, the same stop): +0.034R a trade
better, better in both halves, Holm p 0.060, and the least negative after costs (-0.023R, month t -1.71); on EUR/USD (+0.018R,
t 0.72) and USD/JPY (+0.014R, t 0.50) it is just above zero after costs, nowhere with t over 1. The 1R trail is better in both
halves by +0.006R (Holm p 0.45). The fixed targets from 1R to 6R are within 0.01R of each other: the tilt does not depend on the
target. The far target is the worst. A hypothesis for its own pre-registered test, not a finding: hold the position a day.

## Per market, 2010-2019 (R a trade, month t)

| Market | n | 2R before | 2R after | trail before | 24 h before | 24 h after |
|---|---:|---:|---:|---:|---:|---:|
| Gold | 27,967 | +0.033 (3.30) | -0.150 (-13.88) | +0.030 (3.06) | +0.078 (2.63) | -0.105 (-3.46) |
| EUR/USD | 30,514 | +0.044 (4.46) | -0.034 (-3.41) | +0.061 (7.48) | +0.097 (3.81) | +0.018 (0.72) |
| GBP/USD | 30,199 | +0.059 (5.82) | -0.024 (-2.31) | +0.057 (6.39) | +0.057 (2.09) | -0.026 (-0.94) |
| USD/JPY | 30,337 | +0.066 (5.80) | -0.049 (-4.04) | +0.066 (8.33) | +0.129 (4.48) | +0.014 (0.50) |
| AUD/USD | 32,037 | +0.043 (4.18) | -0.040 (-3.79) | +0.058 (6.09) | +0.057 (2.12) | -0.026 (-0.94) |

Every market is positive before costs with every exit (the far target apart on GBP/USD and AUD/USD); none is positive after costs with month t over 1.
Gold's cost ($0.30) is the largest share of its stops on these years (0.18R a trade).

## How many trades

About 11 trades a weekday per market (gold 10.6, EUR/USD 11.4, GBP/USD 11.3, USD/JPY 11.3, AUD/USD 12.0; 95th percentile 18-19
a day, the busiest 25-31), 56 a weekday for the five together (95th percentile 76). With the 2R exit, positions open at once:
per market at most 12-16; at an entry more than 3 were already open on 28-30 % of entries (the demo job's cap of 3 a market
would skip those). The five together: at most 39 open; at an entry more than 10 were open on 42 % of entries (the cap of 10 in
all binds often; 95th percentile 19). The demo job's record will hold a capped subset of these signals, not all of them.

## Checks

- Cut test: every market's trades read on candles cut at 18 May 2014 equal those of the whole series (every exit, to five
  decimals) for fills before 15 May 2014 (12,500-14,081 trades a market, all equal): no look-ahead.
- The 2R exit's own walk (used for its exit time) equals the engine's 2R result on every trade (the run stops otherwise).
- Every trade has its stop on the losing side; a stop gapped through fills at the open (worse than -1R).
- Data-quality exclusions applied; trades with a filled risk under one round trip are dropped (as the grids).

To repeat: candles with `research/edge/_lib/fetch-cache.mjs <m> 5m 2009 2019` (outside git), then for each market
`node --max-old-space-size=3500 research/edge/dom-exits/run.mjs market <m> <dir>` and `… cut <m> <dir>`, then `… report <dir>`.
