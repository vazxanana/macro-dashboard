# Big-candle fade, only the trades whose cost is small against their risk (result, 24 Nov 2026)

**Verdict: FAIL. Keeping only trades whose cost is at most 10 % of their risk leaves 1794 of 54443 trades in 2015-26. They make +0.033R a trade before costs and −0.041R after (month t -1.37); in 2005-14 −0.040R after costs (n 3214, t -1.18); at twice the cost −0.115R. All trades: −0.246R after costs.**

Paper research only, run once as pre-registered (`PREREGISTRATION.md`, pushed alone first). Gate reproduced (47354 / 0.307R and 54443 / 0.193R). Nothing live changed.

| Trades | 2005-14 n | Before costs | After costs (month t) | 2015-26 n | Before costs | After costs (month t) |
|---|---|---|---|---|---|---|
| All (the desk) | 47354 | +0.307R | −0.061R (-4.13) | 54443 | +0.193R | −0.246R (-20.3) |
| **Kept: cost at most 10 % of the risk (the test)** | 3214 | +0.035R | −0.040R (-1.18) | 1794 | +0.033R | −0.041R (-1.37) |
| Dropped | 44140 | +0.327R | −0.063R (-4.19) | 52649 | +0.198R | −0.253R (-20.29) |

Average cost of a kept trade: 0.074R (all trades: 0.439R). Winners among the kept trades: 38.5 % in 2015-26.

## Context only (no verdict; no threshold is adopted from this)

| Cost at most | 2005-14 n | After costs (t) | 2015-26 n | After costs (t) | No target: 2005-14 after costs (t) | 2015-26 after costs (t) |
|---|---|---|---|---|---|---|
| 5 % of the risk | 366 | −0.019R (-0.28) | 228 | −0.215R (-2.65) | −0.077R (-0.65) | −0.208R (-1.34) |
| 10 % of the risk (the test) | 3214 | −0.040R (-1.18) | 1794 | −0.041R (-1.37) | −0.192R (-3.32) | +0.027R (0.3) |
| 15 % of the risk | 7985 | −0.050R (-1.8) | 4961 | −0.066R (-3.09) | −0.125R (-2.13) | −0.009R (-0.14) |
| 20 % of the risk | 13353 | −0.036R (-1.71) | 9280 | −0.093R (-5.73) | +0.004R (0.09) | +0.007R (0.13) |
| 30 % of the risk | 22765 | −0.028R (-1.58) | 18737 | −0.119R (-8.33) | +0.050R (1.12) | −0.075R (-1.9) |

## Kept trades by market, after costs

| Market | 2005-14 n | After costs (t) | 2015-26 n | After costs (t) |
|---|---|---|---|---|
| xau | 39 | +0.001R (0.01) | 298 | +0.143R (1.47) |
| xag (cost assumed) | 1 | +1.524R (1) | 25 | −0.120R (-0.5) |
| eurusd | 761 | −0.165R (-3.63) | 273 | +0.053R (0.57) |
| gbpusd | 588 | −0.063R (-1.16) | 253 | −0.064R (-0.83) |
| usdjpy | 162 | −0.069R (-0.67) | 272 | +0.020R (0.21) |
| audusd | 450 | +0.061R (0.96) | 125 | −0.224R (-2.07) |
| nzdusd (cost assumed) | 194 | −0.094R (-1.01) | 77 | −0.330R (-2.59) |
| usdcad (cost assumed) | 323 | +0.056R (0.75) | 211 | −0.185R (-2.13) |
| usdchf (cost assumed) | 353 | +0.019R (0.27) | 96 | −0.172R (-1.38) |
| eurjpy (cost assumed) | 343 | +0.026R (0.22) | 164 | −0.047R (-0.43) |

Costs: the shared table (assumed, not measured, on five of the ten markets). The 2015-26 window had been read by five studies of these trades before this one.
