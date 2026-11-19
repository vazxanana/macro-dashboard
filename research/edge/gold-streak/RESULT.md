# Result: after a run of daily closes one way, does gold revert or continue? (14 Nov 2026)

**Verdict: FAIL: 0 of 3 tests pass; buying after 3+ down closes made -0.028R a trade net in 2017-26 (n 215, month t -0.90) and selling after 3+ up closes -0.049R (n 349, t -1.82).**

Pre-registered in PREREGISTRATION.md (pushed alone first, commit 54e963173). The test ran once; nothing was changed after the
result. Paper research: nothing live changed and no proposal follows. **Item 44**: a new stand-alone daily rule judged on
2017-26; it is not a gate, exit, entry or size of the gold book (Gold trend / Gold daily engulf) and says nothing about it.

## Data and rule
OANDA mid daily XAU_USD, council-data `research/daily/xau.json` (`git show`, no network), 2006-03-20 to 2026-11-06, weekend
candles folded into the next weekday (`council/fills.mjs` `foldWeekend`): 5,364 trading days. A down streak = closes in a row
below the previous close ending at the signal day (an equal close ends it); up the mirror. Entry at the next day's open, stop
1.5 x ATR(14) (days ending at the signal day) on the losing side, gap fills at the open, out at the close of the last day held;
one position at a time per test. Costs: $0.60 a round trip and `FIN.xau.long` financing on buys (`nights` x 0.000148 of price);
sells pay nothing. t = calendar-month sums of net R (every month counts), one-sided, Holm over three. Placebo: the same OOS
trade days and holds with the side drawn at random, 40 seeds.

## Tests (R a trade; IS 2008-16, OOS 2017-01 to 2026-10)
| Test | IS n | IS gross | IS net | IS month t | OOS n | OOS gross | OOS net | OOS month t | Holm p | OOS 2x costs | OOS 2017-21 | OOS 2022-26 | Placebo beaten | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 buy after 3+ down closes, 1 day | 239 | +0.017 | -0.013 | -0.46 | 215 | 0.000 | -0.028 | -0.90 | 1 | -0.056 | -0.048 | -0.011 | 20 of 40 | no |
| T2 sell after 3+ up closes, 1 day | 323 | -0.029 | -0.050 | -2.10 | 349 | -0.029 | -0.049 | -1.82 | 1 | -0.069 | -0.051 | -0.047 | 9 of 40 | no |
| T3 buy after 4+ down closes, 3 days | 74 | -0.099 | -0.142 | -1.53 | 57 | -0.119 | -0.162 | -1.32 | 1 | -0.206 | -0.231 | -0.101 | 0 of 40 | no |

Baseline (buy every day's open, same stop, 1 day): OOS n 2,552, +0.028R gross (month t 3.02: gold's rise), -0.001R net
(t -0.11); IS -0.021R net (n 2,341). Against it, OOS net difference: T1 -0.027R (Welch t -0.91), T2 -0.048R (t -1.78),
T3 -0.161R (t -1.58). Placebo medians: T1 -0.028R, T2 -0.029R, T3 +0.042R.

## Reading
- No streak signal carries information on the next day or the next three. After three down closes the next day is no better than
  any day for a buyer before costs (0.000R out of sample against the baseline's +0.028R), so the "revert" idea has nothing
  to give; after three up closes a short loses about what gold's drift takes from any short, so "continue" (holding the long)
  is just the baseline.
- T3 (four or more down closes) is the worst: buyers after a long fall lost in both windows and both halves, and every random
  side draw of the same days did better (0 of 40 beaten): the falls continued slightly more often than they reverted, but a
  sell version was not pre-registered and is not tested here.
- Exits: almost all by time (T1 202 of 215, T2 322 of 349, T3 45 of 57); no gap exits. OOS costs: T1 3.8R spread + 2.2R
  financing, T2 6.8R, T3 1.0R + 1.5R.
- Not an edge, no proposal; nothing live changed.

## Files
`run.mjs` (`fetch <dir>`, then `full <dir>`; the candle copy stays out of git), `result.json` (every figure above, years,
placebo draws, checks), tests `tests/gold-streak.test.mjs`.
