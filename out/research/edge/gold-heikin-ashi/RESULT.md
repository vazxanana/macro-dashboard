# Result: gold's daily Heikin-Ashi colour flip after a run, both sides (14 Nov 2026)

**Verdict: FAIL: following a daily Heikin-Ashi flip after a 3+ day run made -0.028R a trade net in 2017-26 (n 222, month t -0.70); 0 of 3 tests pass.**

Pre-registered in PREREGISTRATION.md (pushed alone first, commit c2595efac). The test ran once; nothing was changed after the
result. Paper research: nothing live changed and no proposal follows. **Item 44**: a new stand-alone daily rule judged on
2017-26; it is not a gate, exit, entry or size of the gold book (Gold trend / Gold daily engulf), reads none of its positions and
says nothing about it.

## Data and rule
OANDA mid daily XAU_USD, council-data `research/daily/xau.json` (`git show`, no network), 2006-03-20 to 2026-11-06, weekend
candles folded into the next weekday (`council/fills.mjs` `foldWeekend`): 5,364 trading days. Heikin-Ashi close = (O+H+L+C)/4,
open = the mean of the previous Heikin-Ashi open and close; colour green / red by close against open. A flip = a day whose colour
is the opposite of the previous day's, that previous run being at least K days long; the trade follows the new colour. Entry at
the next day's open, stop 2 x ATR(14) on the losing side (never moved), exit at the next open after the first day of the
opposite colour (T1, T2; out after 20 days at the latest) or at the close of the 10th day (T3); gap fills at the open; one
position at a time per test. Costs: $0.60 a round trip and `FIN.xau.long` financing on buys (`nights` x 0.000148 of price);
sells pay nothing. t = calendar-month sums of net R (every month counts), one-sided, Holm over three. Placebo: the same OOS
entry days with the side drawn at random, 40 seeds.

## Tests (R a trade; IS 2007-16, OOS 2017-01 to 2026-10)
| Test | IS n | IS gross | IS net | IS month t | OOS n | OOS gross | OOS net | OOS month t | Holm p | OOS 2x costs | OOS 2017-21 | OOS 2022-26 | Placebo beaten | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 K 3, colour exit (primary) | 233 | +0.052 | +0.023 | 0.46 | 222 | -0.001 | -0.028 | -0.70 | 1 | -0.055 | -0.071 | +0.020 | 14 of 40 | no |
| T2 K 5, colour exit | 164 | -0.018 | -0.048 | -0.90 | 148 | +0.068 | +0.033 | 0.59 | 0.837 | -0.002 | -0.029 | +0.097 | 36 of 40 | no |
| T3 K 3, 10-day hold | 205 | +0.036 | -0.005 | -0.07 | 196 | -0.031 | -0.075 | -1.09 | 1 | -0.118 | -0.107 | -0.036 | 6 of 40 | no |

Cost share of R, OOS (stated in advance at about 0.03-0.05R): T1 0.027R a trade (0.014R round trip, 0.013R financing), T2
0.035R, T3 0.044R. Median stop $48.10 (T1; smallest $18.71), median hold 4 days (T1, T2) and 10 days (T3). T1's OOS exits: 218
by colour, 4 by the stop.

Buys and sells apart, OOS net, against the unconditional same-side baseline (every day's open, same stop, 10-day hold; buys n
295, +0.097R net, month t 1.59, +0.180R gross with t 2.90: gold's rise; sells n 323, -0.195R net, t -3.43):
- T1 buys n 81, +0.038R (vs the buy baseline -0.059R, Welch t -0.58); sells n 141, -0.066R (vs the sell baseline +0.130R, t 1.97).
- T2 buys n 70, +0.137R (+0.039R, t 0.32); sells n 78, -0.060R (+0.135R, t 1.75).
- T3 buys n 80, +0.062R (-0.035R, t -0.30); sells n 116, -0.169R (+0.026R, t 0.25).

## Reading
- The flip carries no information about gold's next days. Before costs T1 is flat out of sample (-0.001R a trade), T3 negative;
  the side drawn at random does as well or better than the flip in 14 and 6 of 40 placebo draws (median -0.022R and -0.013R).
- What a flip's buys earn is gold's rise, not the flip: they do no better than buying any day (T1 -0.059R, T3 -0.035R against
  the baseline). The flip's sells lose less than selling any day (Welch t 1.97 for T1) only because the colour exit cuts them
  short within about four days, while the baseline sell holds ten days against a rising market: a property of the exit, not of
  the signal, and still a loss.
- T2 (5+ day runs) is the one positive OOS figure (+0.033R, t 0.59), lost money in sample (-0.048R), turns negative at 2x costs
  and lies inside the placebo's range (36 of 40, below the 38 needed). Not a finding; its 2022-26 half (+0.097R) is gold's
  2024-26 trend.
- Costs are small here (0.03-0.04R a trade on a $48 median stop), so the failure is not the cost: there is no gross edge.

Not an edge, never call it one; no council rule, filter or proposal follows. Files: `run.mjs` (`fetch <dir>`, `full <dir>`),
`result.json`; tests `tests/gold-heikin-ashi.test.mjs`.
