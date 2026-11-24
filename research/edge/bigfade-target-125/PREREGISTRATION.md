# Big-candle fade: the target 25 % further than the candle's middle (pre-registration, 24 Nov 2026)

Owner's question: "Fade of a big M15 candle: what if we let the trade run 25 % extra of the distance between the entry and
the target?" Written and pushed alone before any trade was run with the longer target. Paper research only.

## The rule being varied
`big-candle-fade` cell **m15 k1.5 nobreak half** (the Equinox Big-candle fade desk): a closed M15 candle whose body is over
1.5 x ATR(14) and is not a structure break; fade it at the next 5-minute open, stop past its extreme by 0.1 x ATR, target the
candle's middle (taken only when that is 1R or more away), out after 1 day. Its `signals()` and the shared `exits()` are
imported and not edited; the same ten markets, exclusions, cost table (`combo-grid-2` `COSTS`, assumed on five markets) and
windows: discovery 2005-01 to 2014-12, confirmation 2015-01 to 2026-10.

## The variant
The SAME trades (same fill, same stop, same 1-day limit), with the target at **fill + 1.25 x (middle - fill)**: 25 % more
of the distance between the entry and the target. Stop first when one 5-minute candle holds both; a gap fills at the open.

## Gate
The unchanged target must reproduce the cell: 47,354 trades at +0.307R in discovery and 54,443 at +0.193R in confirmation
(before costs), or the run stops.

## Test (one)
Per trade, D = R(longer target) - R(candle's middle). The longer target is **better** when the mean of D is above 0 and the t
of its calendar-month sums is 2 or more in BOTH windows. It is **worse** when the mean is below 0 with t at or under -2 in
both. Anything else: no difference shown.

## Reported, not tested
Win rate and R a trade before and after costs for the target at 1.0, 1.25, 1.5 and 2.0 times the distance, per window and per
market. These extra multiples are context only: no verdict is taken from them.

## Reading, fixed before the result
The rule loses after costs with its own target (-0.246R a trade in 2015-26). A longer target can only matter to the desk if it
is better on the test AND the rule is above zero after costs with it; otherwise the desk's target stays the candle's middle.
These years were already read by `big-candle-fade` when the rule was chosen, so a pass is a hypothesis for the desk's paper
record, never an edge. Nothing live changes whatever the result.
