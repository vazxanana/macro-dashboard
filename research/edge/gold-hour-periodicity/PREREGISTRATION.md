# Gold time-of-day periodicity (same block, same sign as its own last 20 days): pre-registration (14 Nov 2026)

Written and pushed alone, before any trade, block statistic or result of this rule was computed.

## Question

Equity research (Heston, Korajczyk and Sadka 2010, "Intraday patterns in the cross-section of stock returns", Journal of
Finance) found that the return of a stock in a given half-hour of the day tends to repeat in the SAME half-hour on the
following days, for weeks, while other half-hours carry no such memory. Applied to spot gold's own day: does the sign of
gold's return in one 4-hour block of the UTC day over the last 20 trading days predict the sign of that same block today,
after costs, and better than the same trades placed in another block of the same day?

A NEW stand-alone rule. It is not a gate, exit, entry or size of the live gold book (Gold trend and Gold daily engulf are
daily, long-only rules; this is intraday, both sides, flat every evening). It reads none of the book's records and none of
its 2006-17 positions (docs/owner-decisions.md item 44; candles of those years are used, as every gold study here does,
never the book's trades). Paper research only: nothing live changes and nothing here is read by the council, the mirror
or the page.

## Dedupe (done before writing this)

- `gold-session-drift` (branch, FAIL): fixed sessions of gold's day traded the same way every day (an unconditional drift
  per session). Here the side of each block changes with that block's own recent record; no fixed session sign.
- `gold-intraday-momentum`, `metals-intraday-momentum`, `intraday-momentum` (FAIL): the first part of a session's return
  predicting its last part ON THE SAME DAY. Here the predictor is the same block on EARLIER days (a lag of one day and more).
- `gold-us-asia`, `us-asia-lead`, `gold-asia-fade`, `gold-london-reversal` (FAIL): one session's move predicting the next
  session of the same night. Not same-block, not across days.
- `crypto-hour` (FAIL): fixed hours picked on a discovery window for bitcoin / ether. `timing` (FAIL): time windows as a
  filter of the engine setups. `fx-home-hours` (FX). None is the adaptive same-block persistence rule, none on gold.
- `gold-regime-switch`, `regime-switch` (FAIL): trend / range labels. `gold-tsmom` (FAIL): 12-month momentum of the
  whole series, not of a block of the day.
- The untested backlog (`research/proposals/2026-11-14-untested-backlog.md`, branch `untested-backlog`) does not list it.
  The scratchpad topic list carries no periodicity or same-hour study.

## Market set (fixed now)

Spot gold only: OANDA mid XAU/USD H1 candles through the candle proxy (`/md/bars?sym=xau&tf=1h`), March 2006 to
13 Nov 2026. No other market is run.

## Rule

- **Day and blocks.** A trading day is a UTC weekday (Monday to Friday). Five blocks of four UTC hours: B0 00-04, B1 04-08,
  B2 08-12, B3 12-16, B4 16-20. The hours 20-24 UTC (the 21:00 / 22:00 rollover, the Friday close and the Sunday reopen)
  are never traded and never read. A block on a day is COMPLETE when all four of its H1 candles exist; an incomplete block
  (holiday, missing data) is neither traded nor used as history.
- **Block return and range.** r = ln(close of its last H1 candle / open of its first); range = highest high minus lowest low
  of its four candles.
- **Block statistic.** For block b on day d: the last L complete occurrences of block b on days BEFORE d (never day d
  itself). m = mean of their r, s = their standard deviation, z = m / (s / sqrt(L)); A = mean of their ranges. All known at
  00:00 UTC of day d. No signal until L occurrences exist.
- **Side.** Buy when m > 0, sell when m < 0 (none at m = 0).
- **Trade.** Market at the open of the block's first H1 candle. Stop at entry minus (buy) / plus (sell) 1.0 x A: every trade
  has a stop. Out at the stop (filled at the stop, or at an H1 candle's open when it opens beyond the stop), else at the
  close of the block's last H1 candle. 1R = 1.0 x A. Never held past 20:00 UTC, so never over a rollover.
- **Costs.** $0.60 a round trip in price ($0.30 spread + $0.15 slippage in + $0.15 out, as the recent gold studies), taken
  off in R as 0.60 / A. Financing on buys = `nights(entry, exit)` x `FIN.xau.long` x entry / A (council/fills.mjs, the demo
  broker's 11 Nov 2026 swap); a block never crosses the rollover, so it is 0 by construction and reported as such. "2x
  costs" doubles both.

## Tests (three, Holm over the three)

- **T1 (primary): the strongest block.** Each day, the one block with the largest |z| among the five (ties: the earliest
  block), traded on the side of its m, L = 20. One trade a day.
- **T2: longer memory.** T1 with L = 60.
- **T3: every block.** All five blocks each day, each its own trade on the side of its own m, L = 20 (blocks of one day never
  overlap in time).

## Windows

In sample: trades entered 1 Jan 2007 to 31 Dec 2016. Out of sample (decisive): 1 Jan 2017 to 31 Oct 2026. Candles of 2006
are warm-up only.

## Statistics

- Per test and window: n, buys, mean gross R, mean net R, mean net R at 2x costs, win rate, total net R, worst drawdown,
  t on calendar-month sums of net R (and of gross R). One-sided p from the out-of-sample net month t; Holm over the three
  tests.
- **Placebo (40 seeded draws, the drift control).** Gold rose over most of both windows, so a rule whose side follows recent
  returns leans long and can look good on drift alone. The placebo keeps each trade's DAY and SIDE and moves it to another
  block: T1 / T2 draw one of the four other complete blocks of that day at random; T3 shuffles the five sides across the
  day's five blocks. Same stop rule (that block's own A), same costs. The rule must beat the placebo's 95th percentile of
  out-of-sample mean net R. A same-side, same-day trade in a random block is the unconditional baseline of the claim that
  the BLOCK matters.
- Also reported, not tested: out-of-sample buys and sells apart; the year-by-year net R; each block's share of T1's picks.

## Pass bar

T1 passes only if all of: out-of-sample net month t >= 2 and its Holm-adjusted p <= 0.05; in-sample mean net R > 0 (same
sign); out-of-sample mean net R > 0 at 2x costs; out-of-sample mean net R above the placebo's 95th percentile. T2 and T3
are judged by the same bar and reported; the verdict is T1's. A pass would be a paper finding only: no live rule, size or
filter changes without the owner (absolute rule 3).

## Files

`run.mjs` (fetch mode and the run), `RESULT.md`, `result.json`, `tests/gold-hour-periodicity.test.mjs`. Candles kept out of
git.
