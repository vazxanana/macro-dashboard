# The dominant-zone limit on other key timeframes (result)

**Verdict: PARTIAL. Mixed: before costs H4 > M15 (+0.055R a trade, n 39,617, halves t 5.47 / 4.66), H1 > M5 (+0.055R, n 151,045, t 12.13 / 8.45) and M30 > M5 (+0.036R, n 286,612, t 7.74 / 9.70) clear the bar on 2010-2019 and D1 > H1 misses it (+0.039R, n 7,015, t 1.34 / 1.91); after costs only D1 > H1 is above zero (+0.019R, t under 1) and H4 > M15 is flat (−0.003R).**

Run 23 Nov 2026 on the pre-registration committed alone first (`PREREGISTRATION.md`, ad2d393). Five markets (gold, EUR/USD,
GBP/USD, USD/JPY, AUD/USD), OANDA mid 5-minute candles, fills 2010-01-01 to 2019-12-31, years none of the combination grids
read. The rule and engine are combo-grid-3's unchanged (`signalsFor`, `multi`); costs and data-quality exclusions combo-grid-2's.
Judged before costs (the owner's basis); after costs beside. t = month-sum t; "halves" = 2010-2014 / 2015-2019.

## The four tests (trailing exit, pooled, before costs)

| Test | Chain | 2010-14: n, R a trade, t | 2015-19: n, R a trade, t | Holm p | Bar | After costs 2010-14 / 2015-19 (t) |
|---|---|---|---|---|---|---|
| T1 | D1 > H1 | 3,449, +0.034, 1.34 | 3,566, +0.045, 1.91 | 0.093 | missed | +0.015 (0.60) / +0.022 (0.95) |
| T2 | H4 > M15 | 19,856, +0.057, 5.47 | 19,761, +0.054, 4.66 | < 0.001 | passed | +0.003 (0.28) / −0.009 (−0.74) |
| T3 | H1 > M5 (reference) | 75,351, +0.059, 12.13 | 75,694, +0.050, 8.45 | < 0.001 | passed | −0.040 (−7.07) / −0.064 (−10.37) |
| T4 | M30 > M5 | 143,993, +0.034, 7.74 | 142,619, +0.039, 9.70 | < 0.001 | passed | −0.094 (−17.01) / −0.107 (−21.48) |

## The 2R exit (reported, pooled, before costs)

| Chain | 2010-14: R a trade, t | 2015-19: R a trade, t | All, after costs (t) |
|---|---|---|---|
| D1 > H1 | +0.030, 0.99 | +0.010, 0.34 | −0.001 (−0.04) |
| H4 > M15 | +0.043, 3.40 | +0.048, 3.90 | −0.013 (−1.39) |
| H1 > M5 | +0.053, 8.33 | +0.045, 6.34 | −0.058 (−11.31) |
| M30 > M5 | +0.027, 5.87 | +0.023, 4.15 | −0.112 (−25.44) |

## Per market, trailing exit, 2010-2019 (R a trade before costs with month t; after costs)

| Market | D1 > H1 | H4 > M15 | H1 > M5 | M30 > M5 |
|---|---|---|---|---|
| Gold | +0.046 (1.18); +0.010 | +0.049 (2.78); −0.054 | +0.030 (3.06); −0.153 | +0.019 (2.82); −0.205 |
| EUR/USD | +0.043 (1.04); +0.030 | +0.053 (3.32); +0.012 | +0.061 (7.48); −0.018 | +0.044 (6.49); −0.060 |
| GBP/USD | +0.024 (0.70); +0.009 | +0.048 (2.85); +0.003 | +0.057 (6.35); −0.026 | +0.027 (4.85); −0.086 |
| USD/JPY | +0.051 (1.24); +0.027 | +0.078 (4.58); +0.016 | +0.066 (8.31); −0.048 | +0.051 (8.27); −0.097 |
| AUD/USD | +0.035 (0.83); +0.017 | +0.050 (3.37); +0.006 | +0.058 (6.08); −0.024 | +0.039 (5.77); −0.069 |

## What it says

- Before costs the tilt the grids found on H1 > M5 is there on 2010-2019 too, in both halves and in all five markets, and it
  carries to H4 > M15 and M30 > M5 (every market positive on every one of these three chains). D1 > H1 is positive in every
  market and both halves but has too few trades to clear t 2.
- The tilt is small, about +0.03 to +0.06R a trade, and cost decides it: the lower the key timeframe, the smaller the stop and
  the larger the cost in R. After costs H1 > M5 and M30 > M5 lose clearly; H4 > M15 is about zero (+0.012 to +0.016R on
  EUR/USD and USD/JPY, −0.054R on gold); only D1 > H1 stays positive, with t under 1.
- So the pre-registered answer is PARTIAL (three of four chains pass the before-cost bar). It is a before-cost tilt on untouched
  years, not a tradable rule at these costs and not an edge. The chains overlap: the same price action gives many zones and
  trades at once, so the trades are far from independent (the month-sum t only partly allows for that).
- The only chain where costs do not swamp it is the slowest one (D1 > H1), which is also the one with too few trades to judge.
  A next test there would need more years or markets and its own pre-registration; nothing here changes a desk or a live rule.

## Checks

- Cut test (`run.mjs cut <market>`): the planned orders (zone, touch time, side, entry, stop) known before three cuts of 2014
  equal those of the series cut there: 12,144 orders on EUR/USD and 11,367 on gold, 0 mismatches (`result.json` `cut`).
  `tests/dom-timeframes.test.mjs` repeats it on seeded candles.
- Every order has its stop on the losing side (risk at least twice the cost, else skipped).
- T3 uses the same rule and data as `research/edge/dom-zone-holdout` T1; it was run here independently as the reference row.

To repeat: `EDGE_DATA=<dir> node --use-env-proxy research/edge/_lib/fetch-cache.mjs <market> 5m 2009 2019` for the five markets,
then `node --max-old-space-size=6000 research/edge/dom-timeframes/run.mjs market <market> <out>` for each, `… cut <market>`, and
`… report <out>`.
