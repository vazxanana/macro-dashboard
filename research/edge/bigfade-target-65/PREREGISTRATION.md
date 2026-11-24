# Big-candle fade: the target at 65 % of the candle instead of 50 % (pre-registration, 24 Nov 2026)

Owner's question: "Instead of 50 % tp try 65 %". Written and pushed alone before any trade was run with the 65 % target.
Paper research only. The sister study `bigfade-target-125` moved the target by a share of the distance from the FILL; this one
moves it by a share of the CANDLE.

## The rule being varied
`big-candle-fade` cell **m15 k1.5 nobreak half** (the Equinox Big-candle fade desk), its `signals()` and the shared `exits()`
imported and not edited; the same ten markets, exclusions, cost table (`combo-grid-2` `COSTS`, assumed on five markets), 1-day
limit and windows (discovery 2005-01 to 2014-12, confirmation 2015-01 to 2026-10).

## The variant
The SAME trades (the desk's: taken only when the candle's 50 % is 1R or more from the fill; same fill and stop), with the
target at the candle's **65 % retracement**: from the candle's extreme (its high for a bullish candle) 65 % of its high-low
range back toward its other end. Stop first when one 5-minute candle holds both; a gap fills at the open.

## Gate
The 50 % target must reproduce the cell: 47,354 trades at +0.307R in discovery and 54,443 at +0.193R in confirmation.

## Test (one)
Per trade, D = R(65 % target) - R(50 % target). **Better** = mean of D above 0 with the t of its calendar-month sums 2 or more
in BOTH windows; **worse** = below 0 with t at or under -2 in both; otherwise no difference shown.

## Reported, not tested
Win rate and R a trade before and after costs at 50, 65, 80 and 100 % of the candle, per window and per market (80 and 100 are
context only).

## Reading, fixed before the result
The desk changes its target only if the 65 % target is better on the test AND the rule is above zero after costs with it.
These years were read when the rule was chosen, so even that would be a hypothesis for the paper record, never an edge.
Nothing live changes whatever the result.
