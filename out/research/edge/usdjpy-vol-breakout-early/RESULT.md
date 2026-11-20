# USD/JPY: gold's T1 breakout on 2005-2015 (20 Nov 2026)

Paper research only. The follow-up `fx-vol-breakout` named: rule, cost, window and pass bar fixed in `PREREGISTRATION.md` before any candle of this window was fetched. Nothing live changed.

**Verdict: PASS: USD/JPY T1 2005-2015 +0.079R a trade net (n 2089, month t +2.95; gross +0.109R; halves +0.078R / +0.081R; 40 of 40 placebos beaten)**

| Window | n | Win | Net R/trade | Gross R/trade | Net 2x cost | Month t | Max DD R |
|---|---|---|---|---|---|---|---|
| 2005-01-04 → 2015-12-31 | 2089 | 44.7 % | +0.079 | +0.109 | +0.050 | +2.95 | −42.21 |
| → 2010 | 1149 | 46.3 % | +0.078 | +0.102 | +0.053 | +2.38 | −20.34 |
| 2011-2015 | 940 | 42.8 % | +0.081 | +0.116 | +0.047 | +1.82 | −31.83 |

Placebo (40 seeds): the rule beats 40 of 40 (38 needed). Checks: bothHalves yes, t2 yes, cost2x yes, placebo yes.

**Reading.** A PASS on years `fx-vol-breakout` never read: USD/JPY T1 is a candidate for a forward paper record (its own pre-registration), never a live rule without the owner. Limits: today's demo cost is charged on 2005-15 (spreads were wider then; the 2x-cost line is the check), OANDA mid candles, not the broker's ticks; drawdowns of 20-42R. Code note: the first run counted 0 trades because `fx-vol-breakout` `trades` keeps only 2016 → now days; this study loops over the window's days with the same `vbTrade`, `charge` and placebo calls.

Data: OANDA mid M5 usdjpy 2004-12-01 → 2016-01-07, 834318 candles. Cost: 0.000045 of the entry + 0.005 a round trip.
