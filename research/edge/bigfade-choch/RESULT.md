# Big-candle fade entered on a 1-minute or 30-second ChoCh (result, 24 Nov 2026)

**Verdict: FAIL. Waiting for a 1-minute ChoCh raises the win rate (70.4 % against 29.3 % at once, 2022-26, z 38.18). After costs it makes −0.138R a trade (n 2361, month t -9.33) against −0.212R at once (n 12634); the difference is +0.074R (Welch t 2.95, month t 3.16): still a loss after costs. In 2018-21: 68.3 % against 31.0 %, −0.182R against −0.257R. The 30-second ChoCh (gold and EUR/USD, 2024-26, context only): 64.6 % winners, −0.115R a trade after costs (n 1027) against 29.3 % and −0.152R at once.**

Paper research only, as pre-registered (`PREREGISTRATION.md`, pushed alone first). Run twice: the first run left out the desk's own rule that a risk under the round-trip cost is no trade (the entry at once then read −0.963R and −0.368R after costs); the rule was put in and this is the run that counts. Nothing live changed.

| | Signals | At once: trades | winners | planned R (median) | before costs | after costs | ChoCh: trades | winners | planned R (median) | before costs | after costs (month t) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1-minute ChoCh, 2018-21, five markets | 9518 | 9518 | 31.0 % | 2.76 | +0.198R | −0.257R | 1962 | 68.3 % | 0.41 | −0.021R | −0.182R (-10.6) |
| 1-minute ChoCh, 2022-26, five markets | 12634 | 12634 | 29.3 % | 3.08 | +0.196R | −0.212R | 2361 | 70.4 % | 0.38 | −0.007R | −0.138R (-9.33) |
|   xau, 2022-26 | 2387 | 2387 | 28.2 % | 3.1 | +0.143R | −0.230R | 413 | 72.9 % | 0.4 | +0.019R | −0.111R (-3.21) |
|   eurusd, 2022-26 | 2616 | 2616 | 30.5 % | 3.09 | +0.281R | −0.151R | 481 | 69.0 % | 0.36 | −0.031R | −0.164R (-5.12) |
|   gbpusd, 2022-26 | 2546 | 2546 | 30.4 % | 3.06 | +0.218R | −0.217R | 496 | 68.3 % | 0.39 | −0.023R | −0.158R (-5) |
|   usdjpy, 2022-26 | 2611 | 2611 | 27.2 % | 3.09 | +0.114R | −0.235R | 491 | 71.7 % | 0.38 | +0.004R | −0.105R (-3.29) |
|   audusd, 2022-26 | 2474 | 2474 | 30.4 % | 3.08 | +0.220R | −0.228R | 480 | 70.4 % | 0.39 | −0.003R | −0.149R (-5.11) |
| 30-second ChoCh, 2024-26, gold + EUR/USD (context) | 2929 | 2929 | 29.3 % | 3.15 | +0.227R | −0.152R | 1027 | 64.6 % | 0.61 | +0.028R | −0.115R (-4.94) |

Signals with no ChoCh trade, 2022-26: the stop level came first 8220, the 50 % came first 2039, no ChoCh in time 4, already past the target 10. R a signal after costs (no trade = 0): at once −0.212R, ChoCh −0.026R.

The ChoCh entry sells lower (buys higher) with its stop past everything since the candle, so its planned reward is smaller; cost in R is the round trip over each trade's own risk.
