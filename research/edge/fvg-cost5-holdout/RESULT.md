# FVG return with a cost of at most 5 % of the risk, on eight unread markets (result, 24 Nov 2026)

**Verdict: FAIL. The low-cost hint did not hold on eight unread markets. The FVG return kept where cost is at most 5 % of risk made +0.043R a trade before costs and +0.014R after (n 7074, 2020-26, month t 0.89); 2020-22 +0.055R, 2023-26 −0.017R; at twice the cost −0.015R.**

Paper research only, run once as pre-registered (`PREREGISTRATION.md`, pushed alone first). Nothing live changed. Costs are ASSUMED on all eight markets.

| Trades, 2020-26 | n | Winners | Before costs | After costs | Month t |
|---|---|---|---|---|---|
| **Kept: cost at most 5 % of risk (the test)** | 7074 | 52.2 % | +0.043R | +0.014R | 0.89 |
| the same, 2020-22 | 3051 | 54.1 % | +0.085R | +0.055R | 2.46 |
| the same, 2023-26 | 4023 | 50.8 % | +0.012R | −0.017R | -0.79 |
| the same at twice the cost | 7074 | 52.2 % | +0.043R | −0.015R | -0.95 |
| context: cost at most 10 % | 14208 | 51.5 % | +0.030R | −0.021R | -2.32 |
| context: all trades of the cell | 25132 | 51.0 % | +0.020R | −0.103R | -12.55 |

## Kept trades by market (context)

| Market | Median H1 gap 2019 (x ATR) | All n | All after costs | Kept n | Kept after costs (t) |
|---|---|---|---|---|---|
| gbpjpy | 0.263 | 3281 | −0.126R | 607 | −0.015R (-0.39) |
| audjpy | 0.295 | 3179 | −0.110R | 484 | −0.017R (-0.36) |
| cadjpy | 0.297 | 3200 | −0.129R | 394 | −0.023R (-0.53) |
| eurgbp | 0.266 | 2744 | −0.220R | 128 | +0.007R (0.07) |
| euraud | 0.284 | 3233 | −0.098R | 434 | −0.017R (-0.31) |
| nas100 | 0.286 | 3293 | −0.031R | 2244 | +0.034R (1.56) |
| spx500 | 0.31 | 3226 | −0.089R | 1346 | +0.010R (0.41) |
| de40 | 0.312 | 2976 | −0.034R | 1437 | +0.030R (1.09) |
