# Big-candle fade: the best target, chosen on 2005-14 and judged on 2015-26 (result, 24 Nov 2026)

**Verdict: FAIL. Chosen on 2005-14: no target at all, the stop or the 1-day limit ends the trade (+0.066R a trade after costs there). Judged on 2015-26 it makes +0.332R before costs and −0.107R after (n 54443, 5 % winners, month t -2.65), against −0.246R with the desk's 50 %: a better exit (+0.140R a trade, month t 3.68), and still a loss after costs. With hindsight the best of 2015-26 itself is the same, no target, −0.107R after costs. There is no sweet spot: the further the target, the smaller the loss, and no target makes the rule pay its costs.**

Paper research only, run once as pre-registered (`PREREGISTRATION.md`, pushed alone first); gate reproduced. Nothing live changed; the desk keeps its 50 % target.

| Target (share of the candle) | 2005-14 winners | 2005-14 before costs | 2005-14 after costs | 2015-26 winners | 2015-26 before costs | 2015-26 after costs (month t) |
|---|---|---|---|---|---|---|
| 50 % (the desk) | 32.7 % | +0.307R | −0.061R | 30.2 % | +0.193R | −0.246R (-20.3) |
| 60 % | 28.1 % | +0.333R | −0.036R | 25.9 % | +0.207R | −0.232R (-18.82) |
| 65 % | 26.2 % | +0.338R | −0.030R | 24.1 % | +0.213R | −0.226R (-17.8) |
| 70 % | 24.6 % | +0.347R | −0.022R | 22.6 % | +0.216R | −0.223R (-16.66) |
| 80 % | 21.8 % | +0.357R | −0.012R | 19.9 % | +0.219R | −0.220R (-14.77) |
| 90 % | 19.5 % | +0.355R | −0.014R | 18.0 % | +0.230R | −0.209R (-13.44) |
| 100 % | 17.7 % | +0.361R | −0.008R | 16.3 % | +0.228R | −0.211R (-13.21) |
| 110 % | 16.1 % | +0.350R | −0.018R | 14.9 % | +0.232R | −0.207R (-12.01) |
| 125 % | 14.3 % | +0.350R | −0.019R | 13.3 % | +0.241R | −0.198R (-10.89) |
| 150 % | 12.2 % | +0.360R | −0.009R | 11.4 % | +0.252R | −0.187R (-9.63) |
| 175 % | 10.8 % | +0.373R | +0.005R | 10.0 % | +0.264R | −0.175R (-8.45) |
| 200 % | 9.6 % | +0.375R | +0.006R | 8.9 % | +0.272R | −0.167R (-7.6) |
| 250 % | 8.2 % | +0.387R | +0.018R | 7.6 % | +0.300R | −0.139R (-5.37) |
| 300 % | 7.3 % | +0.403R | +0.035R | 6.7 % | +0.312R | −0.127R (-4.6) |
| none (stop or 1 day) **(chosen)** | 5.4 % | +0.434R | +0.066R | 5.0 % | +0.332R | −0.107R (-2.65) |

Trades: 47354 in 2005-14, 54443 in 2015-26. Costs: the shared table (assumed on five of the ten markets).

## By market: the target chosen on 2005-14, judged on 2015-26 (after costs)

| Market | Trades 2015-26 | Chosen target | 50 % (the desk) | Chosen target (month t) | Best with hindsight |
|---|---|---|---|---|---|
| xau | 4593 | 250 % | −0.348R | −0.210R (-2.8) | 300 %: −0.185R |
| xag (cost assumed) | 1257 | none (stop or 1 day) | −0.480R | −0.686R (-4.23) | 50 %: −0.480R |
| eurusd | 6232 | none (stop or 1 day) | −0.159R | +0.138R (1.34) | none (stop or 1 day): +0.138R |
| gbpusd | 6454 | 90 % | −0.163R | −0.074R (-1.68) | none (stop or 1 day): +0.060R |
| usdjpy | 5784 | none (stop or 1 day) | −0.287R | −0.189R (-1.83) | none (stop or 1 day): −0.189R |
| audusd | 6054 | 300 % | −0.222R | −0.138R (-1.87) | 300 %: −0.138R |
| nzdusd (cost assumed) | 5489 | 100 % | −0.247R | −0.193R (-4.24) | none (stop or 1 day): −0.082R |
| usdcad (cost assumed) | 6630 | 300 % | −0.258R | −0.139R (-1.82) | 300 %: −0.139R |
| usdchf (cost assumed) | 6230 | none (stop or 1 day) | −0.239R | −0.148R (-1.46) | 250 %: −0.146R |
| eurjpy (cost assumed) | 5720 | none (stop or 1 day) | −0.279R | −0.126R (-1.16) | 300 %: −0.120R |
