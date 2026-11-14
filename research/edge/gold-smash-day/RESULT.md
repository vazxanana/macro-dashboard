# Result: the smash-day reversal on spot gold, against the same order on every day (14 Nov 2026)

**Verdict: FAIL: 0 of 3 pass; the buy-stop after a close below the prior low did worse than the same order after every day: -0.206R excess a trade net in 2017-26 (n 93, month t -1.91), -0.155R in 2007-16.**

Pre-registered in PREREGISTRATION.md (pushed alone first, commit 083102371). Paper research: nothing live changed and no
proposal follows. **Item 44**: a new stand-alone daily rule judged on 2017-26; it is not a gate, exit, entry or size of the gold
book (Gold trend / Gold daily engulf), reads none of its trades and says nothing about it.

Rule: council-data `research/daily/xau.json` (OANDA mid, UTC days, 2006-03-20 to 2026-11-13, 5,369 days after folding weekend
candles into the next weekday with `council/fills.mjs` `foldWeekend`). A bearish smash = a close below the previous day's low;
the trade is a buy-stop at its high + $0.10 on the next day only (fill = the open if it gaps above), stop $0.30 under the smash
day's low, at least 0.5 x ATR(20) from the fill; if the entry day also reaches the stop it counts as stopped that day (daily
candles cannot order it); otherwise a gap through the stop fills at the open, else out at the close of the third day. Short:
the mirror after a close above the previous high. One position at a time. **The baseline** is the same order after EVERY day
(no smash condition), so the primary test is the smash condition's excess over gold's drift and over the stop-entry mechanics.
Costs: $0.60 a round trip and `FIN.xau.long` (0.000148 of price a rollover) on longs; 2x costs doubles both. t = calendar-month
sums (every month counts, 0 when nothing closed), one-sided p, Holm over three; placebo = 40 seeded draws of the same order
after a random day of the same year.

## The three tests

| Test | Window | n | Gross R | Net R | Tested mean | Month t (tested) | Month t (gross) | 2x costs | Holm p | Placebo beaten |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 long after bearish smash, excess (primary) | 2007-16 | 94 | -0.132 | -0.204 | **-0.155** | -1.43 | -1.22 | -0.147 | | |
| | **2017-26** | **93** | -0.145 | -0.217 | **-0.206** | **-1.91** | -1.35 | -0.197 | 1.00 | 2 of 40 |
| T2 short after bullish smash, excess | 2007-16 | 132 | -0.338 | -0.378 | -0.292 | -3.06 | -3.50 | -0.292 | | |
| | 2017-26 | 151 | -0.362 | -0.395 | -0.186 | -2.45 | -4.59 | -0.185 | 1.00 | 0 of 40 |
| T3 long after bearish smash, absolute net R | 2007-16 | 94 | -0.132 | -0.204 | -0.204 | -1.85 | -1.22 | -0.276 | | |
| | 2017-26 | 93 | -0.145 | -0.217 | -0.217 | -2.00 | -1.35 | -0.288 | 1.00 | 2 of 40 |

"Tested mean" is the excess net R for T1 / T2 (net R minus the baseline's mean net R in the same window) and the net R for T3.
Placebo seed means (2017-26): T1 5th / 50th / 95th percentile -0.244 / -0.059 / +0.122; T2 -0.140 / -0.029 / +0.100;
T3 -0.255 / -0.070 / +0.111. The rule sits at or below the bottom of the placebo in all three.

## The baselines (the same order after every day)

| Side | Window | n | Gross R | Net R | 2x costs | Month t |
|---|---|---|---|---|---|---|
| Long | 2007-16 | 1,240 | +0.031 | -0.049 | -0.129 | -1.22 |
| Long | 2017-26 | 1,280 | +0.069 | -0.011 | -0.091 | -0.21 |
| Short | 2007-16 | 1,110 | -0.046 | -0.086 | -0.127 | -1.83 |
| Short | 2017-26 | 1,132 | -0.175 | -0.209 | -0.242 | -5.54 |

## What it means
- Every check of the pass bar fails for all three tests: no test is positive in either window. The smash condition makes the
  stop entry WORSE than placing it after any day: in both windows the trade against a day that closed beyond the previous
  extreme lost more than the plain order (T1 excess -0.155R / -0.206R, T2 -0.292R / -0.186R). On gold a close beyond the
  previous day's extreme is followed by more of the same rather than a trap; the reversal entry is caught by it, a third of the
  long trades and two fifths of the short ones stopped on the entry day itself (T1 2017-26: 32 of 93; T2: 59 of 151).
- Before costs the long rule is already negative in both windows (-0.132R, -0.145R), so costs are not the cause.
- By year (T1 excess) only 2009-11, 2020-21 and 2025 are positive; 14 of 20 years negative.
- The placebo says the same: the rule's mean is below 38 or more of the 40 random-day means in every test, the wrong tail.
- Not an edge, not a filter, not a hint for the opposite trade: the opposite (following the smash) was not pre-registered and
  would need its own study on other data. n 93 out of sample is under the 100 the brief prefers; the pass bar's 60 was met.

## Files
- `run.mjs` (the study; pure pieces exported), `result.json` (every figure above, by year), `PREREGISTRATION.md`.
- To repeat: `git show origin/council-data:research/daily/xau.json > <dir>/xau.json`, then
  `node research/edge/gold-smash-day/run.mjs <dir>` (the cache stays out of git).
- Test: `tests/gold-smash-day.test.mjs`.
