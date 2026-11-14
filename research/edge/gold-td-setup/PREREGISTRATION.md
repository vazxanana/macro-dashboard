# Pre-registration: does a completed nine-day "close below the close four days earlier" count mark a gold turn? (14 Nov 2026)

Written and pushed ALONE before any result was computed. Nothing below changes after the run.

**Item 44**: a new stand-alone daily rule, judged on 2017-26. It is not a gate, exit, entry or size of the live gold book
(Gold trend / Gold daily engulf), never reads its positions, is never read as one and says nothing about it. Paper research
only: nothing live changes, and a PASS would only be written up as a proposal for the owner (absolute rule 3).

## The idea
A well-known exhaustion count (the "TD setup" of the DeMark indicators): a buy setup is nine trading days in a row, each closing
BELOW the close four trading days earlier; a sell setup is the mirror. The claim is that a completed count marks an exhausted
move, so price turns (buy setup -> up, sell setup -> down) over the next few days.

## Dedupe
No committed or branch study counts closes against the close FOUR days earlier. Closest, read first: `gold-streak` (closes in a
row against the PREVIOUS close, FAIL: buy after 3+ down closes -0.028R net OOS, n 215, t -0.90), `gold-week-exhaustion`,
`gold-capitulation`, `gold-key-reversal`, `metals-rsi2` / `rsi2-*` (oscillator pullbacks). A nine-day count against the close
four days back allows up days inside the run, so its days differ from a streak's. No remote branch has "td", "demark" or
"sequential" in its name, and the 14 Nov untested backlog does not list it.

## Data (one market, fixed now: spot gold only)
OANDA mid daily XAU_USD, council-data `research/daily/xau.json` (from March 2006), read with
`git show origin/council-data:research/daily/xau.json` (no network; the copy is kept out of git). Complete UTC days; Saturday /
Sunday candles folded into the next weekday with `council/fills.mjs` `foldWeekend`.

## Rule
- Buy count at day i: if close[i] < close[i-4], count[i] = count[i-1] + 1 (counting from 0), else 0. Sell count the mirror
  (close[i] > close[i-4]). A setup COMPLETES at day i when its count equals exactly 9 (a count running on to 10, 11 … does not
  signal again; a new setup needs the count to restart from 0). Known at the close of day i.
- Perfected buy setup: completed buy setup whose day-8 or day-9 low is at or below both the day-6 and day-7 lows.
- ATR(14) at day i = mean true range of days i-13 .. i.
- Entry at the open of day i+1 (market). Stop 1.5 x ATR(14) from the entry on the losing side. Exit at the close of the last
  day held, or the stop: checked on the daily high / low, a gap through it on a later day fills at that day's open. One
  position at a time per test.
- **T1 (primary)**: completed buy setup -> BUY, hold 3 days.
- **T2**: completed sell setup -> SELL, hold 3 days.
- **T3**: perfected buy setup -> BUY, hold 5 days.
- Baselines (the same-side trade on every eligible day, one at a time, same stop and hold): BUY every day hold 3 (for T1), SELL
  every day hold 3 (for T2), BUY every day hold 5 (for T3). Excess = test net R a trade minus its baseline's, same window.

## Costs
$0.60 a round trip ($0.30 spread + $0.15 slippage on each market order), as gold-streak / gold-ibs. Buys pay financing:
`council/fills.mjs` `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a 22:00 UTC rollover, Wednesday three; the demo
broker's XAUUSD swap of 11 Nov 2026) x entry / risk. Sells pay and earn nothing. Today's rate for every year. 2x costs = both
doubled.

## Windows
In sample 2007-01-01 to 2016-12-31; out of sample 2017-01-01 to 2026-10-31 (by entry date). OOS halves 2017-2021 and
2022-2026-10.

## Statistics
t = mean / standard error of CALENDAR-MONTH sums of net R (every month of the window counts, 0 when nothing closed). One-sided
p from that t (normal), Holm over the three tests. Excess t: month sums of (net R - baseline mean net R of the window) per trade.
Placebo: 40 seeds (1..40); each keeps a test's own OOS trade days and holds and draws the side of every trade at random (50/50,
financing on the buys); the statistic is OOS net R a trade.

## Pass bar (per test; the study passes if any test passes)
1. OOS net R a trade > 0 AND above the same-side baseline's OOS net R a trade;
2. OOS month t >= 2 AND Holm-adjusted one-sided p <= 0.0228;
3. net R a trade > 0 in sample AND in both OOS halves;
4. OOS net R a trade > 0 at 2x costs;
5. OOS net R a trade above at least 38 of the 40 placebo draws.

Also reported: gross figures, the excess and its month t, the Welch t of test vs baseline trades, exits by kind, years, the
number of completed setups.

Files: `run.mjs`, `result.json`, `RESULT.md`; tests `tests/gold-td-setup.test.mjs`.
