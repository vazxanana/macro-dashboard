# NAS100: gold's T1 volatility breakout on 2010-2015 at the demo's measured cost (20 Nov 2026)

Paper research only. The rule, cost, window and pass bar were fixed in `PREREGISTRATION.md` (pushed before any candle of the window was fetched). Nothing live changed.

**Verdict: FAIL: NAS100 T1 2010-2015 at the measured cost −0.011R a trade net (n 1110, month t −0.28; 2010-12 +0.004R, 2013-15 −0.026R; 30 of 40 placebos beaten); fails: pos, h2Pos, t2, cost2x, placebo**

| Window | n | Win | Net R/trade | Gross R/trade | Net at 2x cost | t (month sums) | Max DD R |
|---|---|---|---|---|---|---|---|
| 2010-2015 | 1110 | 43.5 % | −0.011 | +0.001 | −0.023 | −0.28 | −52.10 |
| 2010-2012 | 549 | 45.2 % | +0.004 | +0.016 | −0.007 | +0.08 | −24.16 |
| 2013-2015 | 561 | 41.9 % | −0.026 | −0.012 | −0.039 | −0.44 | −45.08 |
| 2012-2015 (reported) | 743 | 41.9 % | −0.034 | −0.021 | −0.047 | −0.68 | −51.12 |

Placebo (40 seeds, random entries, same costs): median −0.026R, 95th percentile +0.008R; the rule beats 30 of 40 (38 needed).

Checks: pos no, h1Pos yes, h2Pos no, t2 no, cost2x no, placebo no, n30 yes.

Cost: the NAS100 hour profile measured on the demo (probe of 2026-11-20T04:51:03.783Z), charged on every year. Data: OANDA mid M5 2009-12-01 → 2016-01-07, 417565 candles, 3.6 % flat.
