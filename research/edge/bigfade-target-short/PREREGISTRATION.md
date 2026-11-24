# Big-candle fade: a target nearer than 50 % of the candle (pre-registration, 24 Nov 2026)

Owner: "Check if less 50 %". Written and pushed alone before any target under 50 % was run. Paper research only.
`bigfade-target-sweep` found that from 50 % upward a further target only loses less; this asks the other side: does a NEARER
target, with more winners, do better?

## Trades
`bigfade-target-65`'s harness, imported and not edited: the desk's own trades (`big-candle-fade` m15 k1.5 nobreak, taken only
when the candle's 50 % is 1R or more from the fill), same fill, stop, 1-day limit, ten markets, exclusions and cost table.
Gate: the 50 % target reproduces 47,354 / +0.307R and 54,443 / +0.193R.

## Targets (8, fixed here)
The share of the candle's high-low range given back from its extreme: **50 (the desk), 45, 40, 35, 30, 25, 20, 10 %**.
A target the fill has already passed (the fill is beyond it on the winning side) closes the trade at the fill: 0R before
costs, the cost still charged.

## The choice and the test
1. **Choice**: the target with the highest mean R a trade AFTER costs in discovery (2005-01 to 2014-12), pooled.
2. **Judged** in confirmation (2015-01 to 2026-10) with that one target: (a) better than 50 % (paired per trade, t of
   calendar-month sums >= 2) and (b) the rule above zero after costs (mean > 0, month t >= 2). **PASS** needs both. If the
   choice is 50 % itself, no nearer target is better and the verdict is FAIL.

## Reported, not tested
The whole curve in both windows (winners, R before and after costs, the share of trades whose target was already passed at
the fill).

## Reading, fixed before the result
A nearer target earns less per winner against the same cost, so the expectation is that it is worse; the test is run because
the owner asked. The desk changes only on a PASS, and even then as a hypothesis for the paper record. Nothing live changes.
