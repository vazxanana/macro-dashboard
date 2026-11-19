# Result: US equity index pairs, log-spread z-score mean reversion (14 Nov 2026)

**Verdict: FAIL, 0 of 2 pairs: fading a 2-sd stretch of the US index spreads is not an edge after costs.** Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (committed alone and pushed first). US2000 / NAS100: -0.775R a trade net on 2016-now (n 71, month-sum t -2.01), -0.641R on 2009-15 (n 41); SPX500 / US30: -0.846R a trade net on 2016-now (n 71, month-sum t -2.21), -1.227R on 2009-15 (n 42). Nothing live changed.

Data: OANDA mid daily US2000_USD, NAS100_USD, SPX500_USD, US30_USD, council-data research/daily/*.json; weekend stubs folded with `foldWeekend`, legs joined on common days (US2000 / NAS100 6114 days, 2003-03-24 to 2026-11-06; SPX500 / US30 6101 days, 2003-03-24 to 2026-11-06). 2-year yield for financing: FRED DGS2 from council-data macro/cache.json (score.fred weekly + fred daily), rates.json, 2006-01-06 to 2026-11-13. Rule: beta = OLS slope of ln(A) on ln(B) over the last 250 closes, z of the spread over 60 closes with that beta; z > 2 shorts the spread, z < -2 buys it, at the next open; exit at z crossing 0, at the pair's stop (z ±3.5, checked at the open and the close; 1R = entry to the 3.5 level) or after 20 days; one position at a time. Costs: both legs' spreads (US2000 0.4, NAS100 3, SPX500 1, US30 4 points a round trip) and financing on both legs (long leg 2Y + 2.5 %, short leg max(0, 2.5 % - 2Y), a year, per rollover night).

| Pair | Window | n | Net R a trade | Gross | Spread cost | Financing | Win % | PF | Month-sum t | p (one-sided) | Holm p | Worst drawdown |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| P1 US2000 / NAS100 | 2016-now (decisive) | 71 | -0.775 | -0.555 | +0.037 | +0.183 | 45.07 | 0.41 | -2.01 | 0.9778 | 1 | -55.01R |
| P1 US2000 / NAS100 | 2009-15 | 41 | -0.641 | -0.380 | +0.087 | +0.174 | 41.46 | 0.37 | -2.41 | - | - | -27.31R |
| P2 SPX500 / US30 | 2016-now (decisive) | 71 | -0.846 | -0.216 | +0.083 | +0.548 | 38.03 | 0.45 | -2.21 | 0.9865 | 1 | -66.76R |
| P2 SPX500 / US30 | 2009-15 | 42 | -1.227 | -0.361 | +0.219 | +0.648 | 42.86 | 0.29 | -1.81 | - | - | -54.33R |

## Against the bar

- **P1 US2000 / NAS100**: fail. Net R a trade > 0: no (-0.775); month-sum t >= 2: no (-2.01); Holm p < 0.05: no (1); same sign on 2009-15: no (-0.641); above the placebo's 95th percentile: no (+0.087).
- **P2 SPX500 / US30**: fail. Net R a trade > 0: no (-0.846); month-sum t >= 2: no (-2.21); Holm p < 0.05: no (1); same sign on 2009-15: no (-1.227); above the placebo's 95th percentile: no (+0.094).

## Placebo: random entries, the real side mix, the same exits (decisive window, 40 seeded draws each)

| Pair | Real net R a trade | Draws median | 5th pct | 95th pct | Draws >= real |
|---|---|---|---|---|---|
| P1 US2000 / NAS100 | -0.775 | -0.158 | -0.416 | +0.087 | 38 of 40 |
| P2 SPX500 / US30 | -0.846 | -0.210 | -0.520 | +0.094 | 40 of 40 |

## Also reported, not judged

- **P1 US2000 / NAS100**: exits on 2016-now time 44, stop 12, mean 15; sides 32 short spread / 39 long spread; worst single trade -11.209R; signals skipped (entry open already past the stop or the mean) 20 on 2016-now, 1 on 2009-15; |z| at the signal median 2.22, 9 of 71 signals at |z| >= 3 (an entry near the 3.5 level has a small 1R, so its costs and any gap past the stop weigh many R: the worst trades); 1R median 1.91 % of leg A's notional; beta at the decisive trades median 0.65 (0.04 to 1.89); with financing off, net R a trade -0.592 on 2016-now and -0.466 on 2009-15.
- **P2 SPX500 / US30**: exits on 2016-now time 38, stop 8, mean 23, stop-gap 2; sides 44 short spread / 27 long spread; worst single trade -12.143R; signals skipped (entry open already past the stop or the mean) 14 on 2016-now, 3 on 2009-15; |z| at the signal median 2.25, 6 of 71 signals at |z| >= 3 (an entry near the 3.5 level has a small 1R, so its costs and any gap past the stop weigh many R: the worst trades); 1R median 0.83 % of leg A's notional; beta at the decisive trades median 1.05 (0.72 to 1.77); with financing off, net R a trade -0.299 on 2016-now and -0.579 on 2009-15.

## What it means

No pair clears the pre-registered bar: betting on the return of a 2-sd stretch of these US index spreads to their 60-day mean is not a tradeable edge after both legs' spreads and financing on this data. Both pairs lose before any cost too (gross R a trade below 0 in both windows) and do worse than random entries with the same exits: on this data a 2-sd stretch of these spreads tended to run further rather than come back within 20 days. It is not a council rule, no proposal is written and nothing live changed. Never call it an edge; another threshold, window, hedge ratio, stop or exit would need its own pre-registration on other data.

Stated limits: the pair's stop is checked at the open and the close only (two prices of the spread a day), so a stop exit fills beyond the 3.5 level and can lose more than 1R; spreads are stated, not measured, and no slippage or commission is added; financing uses the 2-year yield of the entry day for the whole trade and the repository's `nights` count (Wednesday three), which may differ from an index CFD's own triple day.

To repeat: `node research/edge/index-pair/run.mjs fetch <dir>` (git show from origin/council-data, no network; candles kept out of git, `rates.json` written here), then `node research/edge/index-pair/run.mjs full <dir>`. Tests: `tests/index-pair.test.mjs`.
