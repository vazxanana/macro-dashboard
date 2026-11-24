# Big-candle fade with the target 25 % further (result, 24 Nov 2026)

**Verdict: FAIL. The target 25 % further is better: +0.012R a trade against the candle's middle in 2015-26 (month t 2.02; 2005-14 +0.026R, t 4.16). With it the rule makes +0.205R a trade before costs and −0.235R after (n 54443, 26 % winners), against +0.193R and −0.246R with the candle's middle (30 % winners): still a loss after costs.**

Paper research only, run once as pre-registered (`PREREGISTRATION.md`, pushed alone first). Gate reproduced (47354 / 0.307R and 54443 / 0.193R). Nothing live changed; the desk's target stays the candle's middle.

| Window | Target | Trades | Winners | R a trade before costs (month t) | After costs (month t) |
|---|---|---|---|---|---|
| 2005-14 | candle's middle (the desk) | 47354 | 32.7 % | +0.307R (20.56) | −0.061R (-4.13) |
| 2005-14 | 1.25 x the distance | 47354 | 28.3 % | +0.333R (19.12) | −0.036R (-2.09) |
| 2005-14 | 1.5 x the distance | 47354 | 25.0 % | +0.349R (18.49) | −0.020R (-1.08) |
| 2005-14 | 2 x the distance | 47354 | 20.2 % | +0.366R (17.7) | −0.002R (-0.12) |
| 2015-26 | candle's middle (the desk) | 54443 | 30.2 % | +0.193R (17.68) | −0.246R (-20.3) |
| 2015-26 | 1.25 x the distance | 54443 | 26.0 % | +0.205R (17.57) | −0.235R (-18.78) |
| 2015-26 | 1.5 x the distance | 54443 | 22.9 % | +0.217R (17) | −0.222R (-16.27) |
| 2015-26 | 2 x the distance | 54443 | 18.5 % | +0.231R (14.87) | −0.209R (-13.03) |

Only the 1.25 row is tested; 1.5 and 2 are context. Costs: the shared table (assumed on five of the ten markets).

## By market, 2015-26, after costs

| Market | Trades | Candle's middle | 25 % further | Difference (month t) |
|---|---|---|---|---|
| xau | 4593 | −0.348R | −0.360R | −0.012R (-0.76) |
| xag (cost assumed) | 1257 | −0.480R | −0.499R | −0.019R (-0.69) |
| eurusd | 6232 | −0.159R | −0.154R | +0.006R (0.37) |
| gbpusd | 6454 | −0.163R | −0.150R | +0.013R (0.95) |
| usdjpy | 5784 | −0.287R | −0.278R | +0.009R (0.65) |
| audusd | 6054 | −0.222R | −0.214R | +0.008R (0.64) |
| nzdusd (cost assumed) | 5489 | −0.247R | −0.213R | +0.035R (2.56) |
| usdcad (cost assumed) | 6630 | −0.258R | −0.240R | +0.018R (1.32) |
| usdchf (cost assumed) | 6230 | −0.239R | −0.216R | +0.023R (1.58) |
| eurjpy (cost assumed) | 5720 | −0.279R | −0.272R | +0.007R (0.37) |
