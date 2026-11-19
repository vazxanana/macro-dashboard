# Result: after a staircase of daily candles, does gold continue or turn? (14 Nov 2026)

**Verdict: FAIL: 0 of 3 tests pass; buying after 3+ days of higher highs and higher lows made +0.021R a trade net in 2017-26 (n 141, month t 0.27), no better than buying any day.**

Pre-registered in PREREGISTRATION.md (pushed alone first, commit e1746d33b). The test ran once; nothing was changed after the
result. Paper research: nothing live changed and no proposal follows. **Item 44**: a new stand-alone daily rule judged on
2017-26; it is not a gate, exit, entry or size of the gold book (Gold trend / Gold daily engulf) and says nothing about it.

## Data and rule
OANDA mid daily XAU_USD, council-data `research/daily/xau.json` (read from the branch, no network), 2006-03-20 to 2026-11-13,
weekend candles folded into the next weekday (`council/fills.mjs` `foldWeekend`): 5,369 trading days. An up step = a day with a
higher high AND a higher low than the day before; a down step the mirror; a staircase = steps in a row ending at the signal day.
Entry at the next day's open, stop 1.5 x ATR(14) on the losing side, gap fills at the open, out at the close of the third day
held; one position at a time per test. Costs: $0.60 a round trip and `FIN.xau.long` financing on buys (`nights` x 0.000148 of
price); sells pay nothing. t = calendar-month sums of net R (every month counts), one-sided, Holm over three. Excess = OOS net R
a trade minus the same side, stop and hold taken on every eligible day (Welch t). Placebo: as many random OOS entry days as the
test had, same side, stop and hold, 40 seeds.

## Tests (R a trade; IS 2007-16, OOS 2017-01 to 2026-10)
| Test | IS n | IS gross | IS net | IS month t | OOS n | OOS gross | OOS net | OOS month t | Holm p | OOS 2x costs | OOS excess | Excess t | Placebo beaten | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 buy after 3+ up steps (continuation), hold 3 days | 131 | -0.002 | -0.048 | -0.73 | 141 | +0.069 | +0.021 | 0.27 | 1 | -0.027 | -0.013 | -0.17 | 20 of 40 | no |
| T2 sell after 3+ down steps (continuation), hold 3 days | 100 | +0.039 | +0.017 | 0.20 | 86 | +0.034 | +0.016 | 0.24 | 1 | -0.003 | +0.112 | 1.44 | 33 of 40 | no |
| T3 buy after 3+ down steps (turn), hold 3 days | 106 | -0.004 | -0.047 | -0.65 | 93 | -0.034 | -0.079 | -1.11 | 1 | -0.124 | -0.113 | -1.50 | 6 of 40 | no |

Drift baselines (every eligible day, 3-day hold, one at a time): buy OOS n 892, +0.082R gross (month t 3.18: gold's rise),
+0.034R net (t 1.32), IS -0.016R net (n 921); sell OOS -0.097R net, IS -0.050R net. OOS halves (2017-21 | 2022-26): T1 -0.058R
(n 65) | +0.088R (n 76); T2 -0.118R (n 44) | +0.156R (n 42); T3 -0.028R (n 47) | -0.131R (n 46). Placebo medians: T1 +0.022R,
T2 -0.067R, T3 +0.029R.

## Reading
- A staircase up carries no information about the next three days: T1's OOS +0.021R a trade is gold's drift (the same buy on
  random days: median +0.022R; on every day +0.034R), and it lost in sample and at 2x costs.
- Selling a staircase down beat the every-day sell by +0.112R (Welch t 1.44) only because selling gold on any day lost -0.097R;
  on its own it made +0.016R (t 0.24), negative in 2017-21 and at 2x costs. Not a short edge.
- Buying the turn after a staircase down lost (-0.079R, t -1.11) and trailed the every-day buy and 34 of 40 placebo draws.
- With the closes-in-a-row study (`gold-streak`, FAIL), neither runs of closes nor runs of whole stepping candles say anything
  about gold's next days. Do not test longer staircases, other holds or filters on this data: that would be choosing after
  the result.
