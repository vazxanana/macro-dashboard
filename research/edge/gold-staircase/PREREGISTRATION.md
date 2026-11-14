# Pre-registration: after a staircase of daily candles, does gold continue or turn? (14 Nov 2026)

Written and pushed ALONE before any result was computed. Nothing below changes after the run.

**Item 44**: a new stand-alone daily rule, judged on 2017-26. It is not a gate, exit, entry or size of the live gold book
(Gold trend / Gold daily engulf), is never read as one and says nothing about it. Paper research only: nothing live changes,
and a PASS would only be written up as a proposal for the owner (absolute rule 3).

## Dedupe
No committed or branch study tests a run of days that each make BOTH a higher high and a higher low (or both lower) than the
day before. Closest: `gold-streak` (branch, 14 Nov: closes in a row, FAIL), which counts closes only: a staircase day needs the
whole candle to step (high and low), a different and rarer condition that ignores where the day closes. Also read:
`gold-inside-day`, `gold-outside-week`, `gold-key-reversal`, `gold-range-expansion` (one candle each). No remote branch has
"stair", "higher" or "lower" in its name, and the 14 Nov untested backlog does not list it.

## Data (one market, fixed now: spot gold only)
OANDA mid daily XAU_USD, council-data `research/daily/xau.json`, read with `git show origin/council-data:research/daily/xau.json`
(no network; the copy is kept out of git, deleted after the run). Complete UTC days; Saturday / Sunday candles folded into the
next weekday with `council/fills.mjs` `foldWeekend`.

## Rule
- An UP step at day i: high(i) > high(i-1) AND low(i) > low(i-1). A DOWN step: high(i) < high(i-1) AND low(i) < low(i-1).
  Up staircase at day i = the number of up steps in a row ending at day i (any other day ends it); down the mirror. Known at
  the close of day i.
- ATR(14) at day i = mean true range of days i-13 .. i (all closed at the signal).
- Entry at the open of day i+1 (market). Stop 1.5 x ATR(14) from the entry on the losing side. Exit at the close of day i+3
  (3-day hold) or the stop: checked on the daily high / low, a gap through it on a later day fills at that day's open. One
  position at a time per test.
- **T1 (primary)**: up staircase >= 3 -> BUY, hold 3 days (continuation).
- **T2**: down staircase >= 3 -> SELL, hold 3 days (continuation).
- **T3**: down staircase >= 3 -> BUY, hold 3 days (exhaustion turn).
- Drift baseline per test: the SAME side, same stop and hold, entered on EVERY eligible day (every day with ATR history),
  one position at a time. Excess of a test = its OOS net R a trade minus that baseline's OOS net R a trade (Welch t on trades).

## Costs
$0.60 a round trip ($0.30 spread + $0.15 slippage on each of the two market orders). Buys pay financing:
`council/fills.mjs` `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a 22:00 UTC rollover, Wednesday three; the demo
broker's XAUUSD swap of 11 Nov 2026) x entry / risk. Sells pay and earn nothing. Today's rate for every year. 2x costs = both
doubled.

## Windows
In sample 2007-01-01 to 2016-12-31; out of sample 2017-01-01 to 2026-10-31 (by entry date). OOS halves: 2017-2021 and
2022-2026-10.

## Statistics
t = mean / standard error of CALENDAR-MONTH sums of net R (every month of the window counts, 0 when nothing closed). One-sided
p from that t (normal), Holm over the three tests.
Placebo (separates the signal from gold's drift): 40 seeds (1..40); each draws, for a test, as many OOS entry days as the test
had, at random from the eligible OOS days, and trades them with the test's side, stop and hold (one at a time); the statistic
is OOS net R a trade.

## Pass bar (per test; the study passes if any test passes)
1. OOS net R a trade > 0;
2. OOS month t >= 2 AND Holm-adjusted one-sided p <= 0.0228;
3. net R a trade > 0 in sample AND in both OOS halves;
4. OOS net R a trade > 0 at 2x costs;
5. OOS excess over the same-side every-day baseline > 0 with Welch t >= 2;
6. OOS net R a trade above at least 38 of the 40 placebo draws.

Also reported, not part of the bar: gross figures, exits by kind, years, the number of signals.

Files: `run.mjs`, `result.json`, `RESULT.md`; tests `tests/gold-staircase.test.mjs`.
