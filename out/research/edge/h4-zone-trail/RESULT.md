# H4 engulf zone, stop past the zone, no target, trailed exit: result (22 Nov 2026)

**Verdict: FAIL.** The rule built from the best-looking part of each desk's 2026 records does not make money after costs on
2007-2019: the three markets pooled lose 0.027R a trade (6,253 trades, month-sum t -1.33). Before costs it is +0.014R a trade:
zero. Run once, as pre-registered (PREREGISTRATION.md); no variant is picked from the rows below.

| 2007-2019, after costs | Trades | Won | R a trade before costs | R a trade after | Total | Month t | 2007-13 | 2014-19 | At 2x costs |
|---|---|---|---|---|---|---|---|---|---|
| Pooled (primary) | 6,253 | 34 % | +0.014 | -0.027 | -169.4R | -1.33 | -0.052 | +0.002 | -0.068 |
| Gold | 2,068 | 36 % | +0.062 | +0.035 | +72.2R | 0.98 | +0.002 | +0.074 | +0.008 |
| EUR/USD | 2,093 | 34 % | -0.016 | -0.067 | -140.4R | -1.99 | -0.106 | -0.022 | -0.118 |
| GBP/USD | 2,092 | 33 % | -0.003 | -0.048 | -101.2R | -1.34 | -0.053 | -0.043 | -0.094 |

The pooled test fails every part of its bar but one half (net > 0, month t >= 2, both halves positive, positive at twice the
costs). No market counts (Holm p 0.98 / 1 / 1). Gold is positive in both halves but at t 0.98 it is not apart from luck, and
gold rose over the window. Worst pooled drawdown 265R. Exits: 3,997 stops, 352 gaps, 1,404 trailed stops, 500 time exits.

## Reported, no verdict
| Same window, pooled, after costs | Trades | R a trade | Month t |
|---|---|---|---|
| Buys | 3,122 | -0.040 | -1.34 |
| Sells | 3,131 | -0.015 | -0.52 |
| A fixed 2R target instead of the trail | 6,396 | -0.067 | -3.83 |
| Fills 17:00-24:00 UTC allowed | 6,336 | -0.034 | -1.73 |
| The any-number-of-candles engulf | 8,405 | -0.010 | -0.57 |

Two of the picks point the way the 2026 records did (the trail loses less than a fixed 2R target; skipping the late hours
loses a little less), but neither turns the rule positive.

## What it means
The parts that looked best on the desks' 2026 records were picked from about 200 comparisons; put together and run on
other years they give a rule that is zero before costs. The desks stay paper records of each method; this is not a
candidate for a forward record. The question is closed: do not test variants of this rule on 2007-2019.

Harness check before the run: on a made-up random market (no edge by construction) the same code gives -0.03R to +0.06R a
trade before costs over three seeds, so it is not biased. Limits: OANDA mid H1 candles (a stop and a new best price in one
candle is read as the stop), today's costs charged on every year. Three of the 6,253 trades filled at a gapped open nearer the stop than the smallest-risk rule allows (the rule is checked at the zone's edge); without them -0.029R a trade, t -1.43. To repeat: `fetch.mjs <dir>`, then `run.mjs <dir>`.
