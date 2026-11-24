# Big-candle fade: where is the best target? Chosen on 2005-14, judged on 2015-26 (pre-registration, 24 Nov 2026)

Owner: "Find the sweet spot." Written and pushed alone before any target beyond the four already read (50, 65, 80, 100 % of
the candle) was run. Paper research only.

## Why a sweep needs a rule
`bigfade-target-125` and `bigfade-target-65` showed a longer target is a little better and the rule still loses after costs.
Picking the best of many targets on the same years would flatter it. So the target is CHOSEN on one window and JUDGED on the
other: the judged figure is out of sample for the choice.

## Trades
`bigfade-target-65`'s harness, imported and not edited (`big-candle-fade` cell m15 k1.5 nobreak; the desk's own trades: taken
only when the candle's 50 % is 1R or more from the fill; same fill, stop, 1-day limit, ten markets, exclusions and cost table).
Gate: the 50 % target reproduces 47,354 / +0.307R and 54,443 / +0.193R.

## Targets (15, fixed here)
The share of the candle's high-low range given back from its extreme: 50, 60, 65, 70, 80, 90, 100, 110, 125, 150, 175, 200,
250, 300 %, and **none** (no target: the stop or the 1-day limit ends the trade). Above 100 % the target lies beyond the
candle's other end.

## The choice and the test
1. **Choice**: the target with the highest mean R a trade AFTER costs in discovery (2005-01 to 2014-12), pooled.
2. **Judged** in confirmation (2015-01 to 2026-10) with that one target: (a) is it better than 50 % (paired per trade, t of
   calendar-month sums >= 2), and (b) is the rule above zero after costs (mean > 0 and month t >= 2).
   **PASS** needs both. (a) alone = a better exit on a losing rule.

## Reported, not tested
The whole curve in both windows (winners, R before and after costs, month t); the target that would have been best in
confirmation (hindsight, labelled so); per market, the discovery-chosen target and its confirmation result.

## Reading, fixed before the result
On a PASS the desk's paper target would be proposed to the owner as that share, as a hypothesis for the forward record, never
an edge. Without (b) the desk keeps 50 % and the answer is that no target makes this rule pay its costs. Either way this is
the last target study on these trades. Nothing live changes.
