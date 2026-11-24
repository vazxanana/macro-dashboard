# Big-candle fade with the target at 65 % of the candle (result, 24 Nov 2026)

**Verdict: FAIL. The 65 % target is better: +0.020R a trade against the 50 % target in 2015-26 (month t 2.92; 2005-14 +0.031R, t 4.44). With it the rule makes +0.213R a trade before costs and −0.226R after (n 54443, 24 % winners), against +0.193R and −0.246R with the 50 % target (30 % winners): still a loss after costs.**

Paper research only, run once as pre-registered (`PREREGISTRATION.md`, pushed alone first). Gate reproduced (47354 / 0.307R and 54443 / 0.193R). Nothing live changed; the desk's target stays the candle's 50 %.

| Window | Target | Trades | Winners | R a trade before costs (month t) | After costs (month t) |
|---|---|---|---|---|---|
| 2005-14 | 50 % of the candle (the desk) | 47354 | 32.7 % | +0.307R (20.56) | −0.061R (-4.13) |
| 2005-14 | 65 % of the candle | 47354 | 26.2 % | +0.338R (19.11) | −0.030R (-1.75) |
| 2005-14 | 80 % of the candle | 47354 | 21.8 % | +0.357R (18.39) | −0.012R (-0.65) |
| 2005-14 | 100 % of the candle | 47354 | 17.7 % | +0.361R (16.81) | −0.008R (-0.4) |
| 2015-26 | 50 % of the candle (the desk) | 54443 | 30.2 % | +0.193R (17.68) | −0.246R (-20.3) |
| 2015-26 | 65 % of the candle | 54443 | 24.1 % | +0.213R (17.85) | −0.226R (-17.8) |
| 2015-26 | 80 % of the candle | 54443 | 19.9 % | +0.219R (15.62) | −0.220R (-14.77) |
| 2015-26 | 100 % of the candle | 54443 | 16.3 % | +0.228R (14.77) | −0.211R (-13.21) |

Only the 65 % row is tested; 80 % and 100 % are context. Costs: the shared table (assumed on five of the ten markets).

## By market, 2015-26, after costs

| Market | Trades | 50 % target | 65 % target | Difference (month t) |
|---|---|---|---|---|
| xau | 4593 | −0.348R | −0.342R | +0.006R (0.35) |
| xag (cost assumed) | 1257 | −0.480R | −0.515R | −0.034R (-1.04) |
| eurusd | 6232 | −0.159R | −0.145R | +0.014R (0.83) |
| gbpusd | 6454 | −0.163R | −0.135R | +0.028R (1.68) |
| usdjpy | 5784 | −0.287R | −0.283R | +0.004R (0.27) |
| audusd | 6054 | −0.222R | −0.222R | +0.000R (0) |
| nzdusd (cost assumed) | 5489 | −0.247R | −0.188R | +0.059R (3.85) |
| usdcad (cost assumed) | 6630 | −0.258R | −0.238R | +0.020R (1.35) |
| usdchf (cost assumed) | 6230 | −0.239R | −0.210R | +0.030R (1.65) |
| eurjpy (cost assumed) | 5720 | −0.279R | −0.252R | +0.027R (1.32) |
