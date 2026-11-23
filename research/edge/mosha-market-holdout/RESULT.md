# The grid-6 cell on data the grid never read (result)

**Verdict: FAIL. At 1R before costs: gold 2006-09 -0.005R a trade (n 217, month t -0.06), silver and eight pairs 2010-19 +0.017R (n 4875, t 1.17); gold 2020 on -0.052R (n 389, t -1.00), not repeated.**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first, commit ee38602). Research only:
nothing live changed, nothing is proposed.

## What was run

The one cell `research/edge/grid6-mosha-market` confirmed out of 69,120 (gold, M30 BO, M5 VR and CF from edgekit
`structure(bars, 3)`, any CF place, market entry at the next 5-minute open after the CF close, stop past the CF zone by 0.1 x
ATR(14) of M5, London fills 07:00-11:59 UTC, with the Daily MSNR call; 1R exit), unchanged: the grid's `frames`,
`msnrCalls`, `storylines`, `entries`, `simulate`, `placebo` imported, nothing of the grid edited. OANDA mid 5-minute candles
of the edgekit cache, the data-quality exclusions, `combo-grid-2` costs.

**Gate passed**: the same code on gold 2009-2019 gives the grid's figures exactly: 2010-14 n 302, +0.1141R, month t 2.16;
2015-19 n 290, +0.2249R, month t 4.25 (trail +0.1497R / +0.3009R). **Cut test**: each market of each set cut at 4 moments;
the ladder's storylines known before every cut are the same as in the full run (48 cuts, 0 missing, 0 extra). Every trade
has its stop on the losing side.

## The bar (before costs, the pre-registered judgement; after costs beside)

| Set | n | 1R exit, R a trade (month t) | won | after costs | trail exit (t) | trail after costs | placebo 1R |
|---|---:|---|---:|---|---|---|---|
| A: gold, Apr 2006 to 2009 | 217 | -0.005 (-0.06) | 50 % | -0.165 (-2.33) | +0.046 (0.49) | -0.114 | +0.005 (0.06) |
| B: xag + eight pairs, 2010-19 (costs assumed) | 4,875 | +0.017 (1.17) | 51 % | -0.097 (-6.27) | +0.043 (2.13) | -0.072 | -0.021 (-1.41) |
| C: gold, 2020 to Oct 2026 | 389 | -0.052 (-1.00) | 47 % | -0.123 (-2.40) | +0.019 (0.29) | -0.052 | +0.041 (0.80) |
| Grid window, gold 2010-19 (in sample) | 592 | +0.114 / +0.225 (2.16 / 4.25) | 56 / 61 % | +0.005 / +0.064 | +0.150 / +0.301 | | |

Holm over the two primary tests (A, B): adjusted one-sided p 0.53 (A) and 0.25 (B). Neither set passes; set C does not
repeat it. On its own years the cell won 56-61 % of 1R trades; on every new set it wins about half, as a rule with no
direction in it would, and its side-flipped placebo is no worse. The trail neighbour reaches t 2.13 on set B pooled before
costs, but it is secondary, it loses 0.072R a trade after costs, and it is flat on both gold sets.

## Set B by market (1R before costs, n, mean (month t), after costs; trail)

| Market | n | 1R (t) | 1R after costs | trail (t) |
|---|---:|---|---|---|
| xag | 548 | +0.103 (2.40) | -0.470 | +0.127 (2.14) |
| eurusd | 494 | -0.001 (-0.01) | -0.041 | +0.032 (0.53) |
| gbpusd | 474 | -0.035 (-0.73) | -0.079 | -0.028 (-0.47) |
| usdjpy | 593 | +0.108 (2.54) | +0.032 | +0.109 (2.27) |
| audusd | 545 | +0.031 (0.70) | -0.021 | +0.053 (1.00) |
| nzdusd | 583 | -0.006 (-0.14) | -0.068 | +0.016 (0.32) |
| usdcad | 551 | -0.037 (-0.83) | -0.097 | -0.041 (-0.76) |
| usdchf | 525 | -0.054 (-1.22) | -0.111 | -0.011 (-0.18) |
| eurjpy | 562 | +0.029 (0.80) | -0.025 | +0.111 (2.22) |

Silver and USD/JPY clear t 2 alone (picked after the run among nine rows, not tests). Silver's M5 stops are so small that its
assumed cost takes 0.57R a trade (-0.470R after costs). Four of the nine markets are negative before costs.

## Gold year by year (1R, R before / after costs)

2006 -1.0 / -8.8, 2007 +2.0 / -11.1, 2008 +10.0 / +3.3, 2009 -12.0 / -19.2; 2020 -10.0 / -13.8, 2021 +12.0 / +6.8, 2022
-11.0 / -15.1, 2023 -9.0 / -15.8, 2024 +7.0 / +2.7, 2025 +0.9 / -1.6, 2026 (to Oct) -10.0 / -10.9. Positive in all ten
years of the grid's window, positive in three of eleven years outside it.

## What it says

The grid's one confirmed cell does not hold on gold before or after the grid's window, nor pooled on silver and eight pairs.
It was the lucky cell of 69,120, as the grid's own counts (fewer discovery winners than chance, a placebo with three times as
many) already said. Context, not part of the bar: on gold the same trades with the call against the side, or in any session,
are flat too (A -0.027 / -0.028R, C +0.073 / -0.022R). Do not test variants of this cell on these years. Not an edge; nothing
changes on any desk. Set B's costs are assumed, not measured; the grid read the candles of eurusd, gbpusd, usdjpy and audusd
in 2010-2019 (silver, nzdusd, usdcad, usdchf and eurjpy are new to it).

Files: `run.mjs`, `result.json`; test `tests/mosha-market-holdout.test.mjs`. To repeat: fill the cache
(`research/edge/_lib/fetch-cache.mjs <m> 5m <year> <year>`), then `run.mjs market <gate|A|B|C> <m> <dir>`, `run.mjs cut …`,
`run.mjs report <dir>` (seconds a market).
