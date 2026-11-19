# Pre-registration: after a run of daily closes one way, does gold revert or continue? (14 Nov 2026)

Written and pushed ALONE before any result was computed. Nothing below changes after the run.

**Item 44**: a new stand-alone daily rule, judged on 2017-26. It is not a gate, exit, entry or size of the live gold book
(Gold trend / Gold daily engulf), is never read as one and says nothing about it. Paper research only: nothing live changes,
and a PASS would only be written up as a proposal for the owner (absolute rule 3).

## Dedupe
No committed or branch study tests consecutive-close streaks on gold. Read first: `gold-ibs` (close in the bottom / top of the
day's range, FAIL), `gold-key-reversal` (20-day extreme + close against, FAIL), `gold-shock-revert` (one move over 2 x ATR,
FAIL), `gold-daily-turtle-soup` (failed 20-day break, FAIL). Each conditions on ONE day; none counts closes in a row. No
remote branch has "streak" or "consecutive" in its name, and the 14 Nov untested backlog does not list it.

## Data (one market, fixed now: spot gold only)
OANDA mid daily XAU_USD, council-data `research/daily/xau.json`, read with `git show origin/council-data:research/daily/xau.json`
(no network; the copy is kept out of git). Complete UTC days; Saturday / Sunday candles folded into the next weekday with
`council/fills.mjs` `foldWeekend`.

## Rule
- Down streak at day i = the number of days in a row ending at i whose close is BELOW the previous close (an equal close ends a
  streak); up streak the mirror. Known at the close of day i.
- ATR(14) at day i = mean true range of days i-13 .. i (all closed at the signal).
- Entry at the open of day i+1 (market). Stop 1.5 x ATR(14) from the entry on the losing side. Exit at the close of the last
  day held (day i+1 for a 1-day hold, day i+3 for a 3-day hold), or the stop: checked on the daily high / low, a gap through it
  on a later day fills at that day's open. One position at a time per test (a signal while a trade of that test is open is
  skipped).
- **T1**: down streak >= 3 -> BUY, hold 1 day.
- **T2**: up streak >= 3 -> SELL, hold 1 day.
- **T3**: down streak >= 4 -> BUY, hold 3 days.
- Baseline (comparison, not a test): BUY at every day's open, same stop and 1-day hold, every day (one at a time).

## Costs
$0.60 a round trip ($0.30 spread + $0.15 slippage on each of the two market orders), as gold-ibs / gold-key-reversal. Buys pay
financing: `council/fills.mjs` `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a 22:00 UTC rollover, Wednesday three;
the demo broker's XAUUSD swap of 11 Nov 2026) x entry / risk. Sells pay and earn nothing. Today's rate for every year.
2x costs = both the round trip and the financing doubled.

## Windows
In sample 2008-01-01 to 2016-12-31; out of sample 2017-01-01 to 2026-10-31 (by entry date). OOS halves: 2017-2021 and
2022-2026-10.

## Statistics
t = mean / standard error of CALENDAR-MONTH sums of net R (every month of the window counts, 0 when nothing closed). One-sided
p from that t (normal), Holm over the three tests (T1-T3).
Placebo: 40 seeds (1..40); each keeps a test's own OOS trade days and holds and draws the side of every trade at random (buy or
sell, 50/50, financing on the buys); the statistic is OOS net R a trade.

## Pass bar (per test; the study passes if any test passes)
1. OOS net R a trade > 0;
2. OOS month t >= 2 AND Holm-adjusted one-sided p <= 0.0228 (the p of t = 2);
3. net R a trade > 0 in sample AND in both OOS halves;
4. OOS net R a trade > 0 at 2x costs;
5. OOS net R a trade above at least 38 of the 40 placebo draws.

Also reported, not part of the bar: gross figures, the baseline, the OOS difference of each test to the baseline (Welch t on
trades), exits by kind, years.

Files: `run.mjs`, `result.json`, `RESULT.md`; tests `tests/gold-streak.test.mjs`.
