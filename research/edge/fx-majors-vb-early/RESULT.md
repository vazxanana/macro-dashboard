# Gold's T1 breakout on the five other forex majors, 2005-2015 (20 Nov 2026)

Paper research only. Markets, rule, cost, window and pass bar were fixed in `PREREGISTRATION.md` (pushed alone before any candle of this window was fetched). Nothing live changed.

**Verdict: FAIL: T1 on five forex majors (no USD/JPY) pooled 2005-2015 +0.013R a trade net (n 10699, month t +0.93; gross +0.038R; 2x cost −0.013R; 2005-10 +0.025R, 2011-15 −0.002R; 40 of 40 placebos beaten); fails: bothHalves, t2, cost2x; markets clearing every check alone: none**

| Series | n | Win | Net R/trade | Gross R/trade | Net 2x cost | 2005-10 net | 2011-15 net | Month t | Holm p | Placebos beaten | Max DD R | All checks |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| pool | 10699 | 43.7 % | +0.013 | +0.038 | −0.013 | +0.025 | −0.002 | +0.93 | — | 40 of 40 | −132.3 | no |
| eurusd | 2128 | 44.7 % | +0.032 | +0.057 | +0.007 | +0.038 | +0.026 | +1.48 | 0.278 | 39 of 40 | −44.4 | no |
| gbpusd | 2133 | 43.9 % | +0.032 | +0.057 | +0.008 | +0.041 | +0.022 | +1.20 | 0.345 | 40 of 40 | −49.3 | no |
| audusd | 2163 | 44.4 % | −0.005 | +0.019 | −0.030 | +0.024 | −0.040 | −0.23 | 1.000 | 34 of 40 | −52.2 | no |
| usdcad | 2162 | 42.1 % | −0.045 | −0.017 | −0.073 | −0.032 | −0.061 | −2.01 | 1.000 | 6 of 40 | −112.9 | no |
| usdchf | 2113 | 43.4 % | +0.051 | +0.077 | +0.025 | +0.056 | +0.045 | +1.86 | 0.157 | 40 of 40 | −28.6 | no |

The pool is the one test (Holm is over the five markets only). Pool checks: bothHalves no, t2 no, cost2x no, placebo yes.

**Reading, as pre-registered.** The rule did not work on the other majors in 2005-15 either. USD/JPY's result stands alone among the six majors in both decades (with `yen-crosses-vol-breakout`: one market of eleven); its forward record (`usdjpy-vol-breakout-forward`) remains the judge. No market clears every check on its own.

Beside the verdict, reported and not a test: before costs the pool is +0.038R a trade and it beats 40 of 40 random-entry placebos, so the entry carried a small positive tilt in this decade (as on the yen crosses), strongest in 2005-10; it is smaller than a doubled cost and its month t is under 1, so nothing can be built on it.

Cost: commission 0.000045 of the entry + 0.5 pip a round trip (2x shown): today's demo cost charged on 2005-15, when retail spreads were wider, so net R here is if anything flattering. No financing (out at 21:00 UTC; nights counted: 0).

Data: OANDA mid M5, eurusd 2004-12-01 → 2016-01-07 (836036 candles, judged 2005-01-04 → 2015-12-31); gbpusd 2004-12-01 → 2016-01-07 (832303 candles, judged 2005-01-04 → 2015-12-31); audusd 2004-12-01 → 2016-01-07 (833010 candles, judged 2005-01-04 → 2015-12-31); usdcad 2004-12-01 → 2016-01-07 (827498 candles, judged 2005-01-04 → 2015-12-31); usdchf 2004-12-01 → 2016-01-07 (831118 candles, judged 2005-01-04 → 2015-12-31).
