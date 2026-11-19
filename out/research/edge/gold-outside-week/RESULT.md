# Result: gold's outside week with a strong close, followed for two weeks (14 Nov 2026)

**Verdict: FAIL, 0 of 3: following an outside week that closed in its outer third lost -0.065R a trade net in 2017-26 (n 42, month t -0.44) and -0.182R in 2007-16 (n 43).**

Pre-registered in `PREREGISTRATION.md` (pushed alone first, commit d52f7f809). The test ran once; nothing in the rule, costs or
bar was changed after the result. Paper research only: no live rule, size, filter, stop, config, cost constant or council member
changed, and no proposal follows. **Item 44**: a new stand-alone weekly rule judged on 2017-26; it is not a gate, exit, entry or
size of the gold book (Gold trend / Gold daily engulf), reads none of its positions and says nothing about it.

## Data and rule
OANDA mid daily XAU_USD, council-data `research/daily/xau.json` (`git show`, no network), 2006-03-20 to 2026-11-06, weekend
candles folded into the next weekday (`council/fills.mjs` `foldWeekend`): 5,364 trading days, 1,076 Monday-Friday weeks (the
file's last week dropped). Outside week = high above and low below the previous calendar week's, both weeks 4+ days; BUY when it
closed in the top third of its range, SELL in the bottom third (87 such weeks, 40 buys). Entry at the next week's first open,
stop $0.30 past the outside week's other extreme (gap fills at the open), out at the close of the 10th trading day (T2 5th,
T3 20th), one position at a time. Costs: $0.60 a round trip and `FIN.xau.long` financing on buys (`nights` x 0.000148 of
price); sells pay nothing. t = calendar-month sums of net R by entry month (every month counts, 0 with no trade), one-sided
normal p, Holm over three.

## Tests (R a trade; IS 2007-01 to 2016-12, OOS 2017-01 to 2026-10)
| Test | IS n | IS gross | IS net | IS month t | OOS n | OOS gross | OOS net | OOS t (gross) | OOS t (net) | Holm p | OOS 2x costs | OOS 2017-21 | OOS 2022-26 | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 10 days, both sides (primary) | 43 | -0.143 | -0.182 | -1.70 | 42 | -0.019 | -0.065 | -0.13 | -0.44 | 1.000 | -0.110 | -0.069 | -0.059 | no |
| T2 5 days, both sides | 43 | -0.071 | -0.099 | -1.22 | 42 | +0.045 | +0.015 | 0.46 | 0.15 | 1.000 | -0.016 | +0.087 | -0.074 | no |
| T3 20 days, both sides | 38 | -0.145 | -0.197 | -1.20 | 37 | -0.028 | -0.102 | -0.16 | -0.60 | 1.000 | -0.176 | -0.169 | -0.014 | no |

By side, T1 net: IS buys -0.203R, sells -0.165R; OOS buys +0.183R (n 20), sells -0.289R (n 22). The buys' gain out of sample
is gold's 2017-26 rise, not the pattern (next section).

## Baseline: strong-close weeks without the outside condition (descriptive)
Every 4+-day week closing in its outer third, same entry, stop, 10-day hold, costs, one at a time: IS n 246, +0.020R net
(month t 0.31); OOS n 222, -0.021R net (t -0.23), buys +0.171R (n 129), sells -0.286R (n 93). T1 against it (Welch t): IS
-0.182 vs +0.020 (t -1.64), OOS -0.065 vs -0.021 (t -0.27), OOS buys +0.183 vs +0.171 (t 0.04), OOS sells -0.289 vs -0.286
(t -0.02). **The outside condition adds nothing** to a plain strong-close week, which itself has no edge: what is left is
gold's drift (buys up, sells down) in 2017-26.

## Placebo
T1's 42 OOS signals with a random side, seeds 1..40: median -0.145R, best +0.340R; T1 (-0.065R) beats 26 of 40 (bar 38).

## Costs, stops, exits
Median stop $41.39 (IS) and $52.83 (OOS), all far over $10. OOS T1: spread and slippage 0.53R, financing 1.38R over 42 trades
(0.046R a trade, about 1.1 % of a median stop for the $0.60 alone); gross was already -0.80R, so costs deepen a loss rather than
erase a gain. Exits OOS: 13 stops, 0 gaps, 29 time exits.

## Reading
Gold's outside week, read as a strong weekly close, does not predict the next one to four weeks in either window, at any of
the three holds; the 5-day hold is near zero out of sample (+0.015R, t 0.15) and negative in sample. Not an edge. Nothing live
changed and no follow-up is proposed.

To repeat: `node research/edge/gold-outside-week/run.mjs fetch <dir>` (git show from `origin/council-data`, kept out of git),
then `… full <dir>`. Tests: `tests/gold-outside-week.test.mjs`.
