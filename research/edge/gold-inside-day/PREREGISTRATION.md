# Pre-registration: the daily inside-day breakout on spot gold (14 Nov 2026)

Written and committed alone, before any trade of this study was computed. Paper research: nothing here is read by the council,
the mirror or the page, and no live rule changes whatever the verdict.

**Item 44 (docs/owner-decisions.md).** This is a new stand-alone rule, judged on its own trades. It is NOT a gate, exit, entry
or size of the supported gold book (Gold trend, Gold daily engulf); nothing of the book's positions or record is read.

## Dedupe (read before writing this)
- `nr7-breakout` (branch `nr7-breakout`, FAIL): the narrowest day of seven, next-day bracket, stop the other side, H1 path, six
  markets including gold, exits at the close of the day after entry or 2R. Its pre-registration, run.mjs and RESULT.md never
  test an inside day nor "NR7 + inside". An NR7 day need not be inside and an inside day need not be NR7: a different trigger.
- `gold-inside-week` (branch, FAIL): the WEEKLY inside week, NR4 week and Monday range. Weekly bars, not daily.
- `gold-squeeze` (branch, FAIL): Bollinger-inside-Keltner release on H4 / D1. Not a prior-bar containment.
- `gold-vol-breakout` / `gold-vol-breakout-replicate` (branches): the UTC open +/- 0.5 x the prior day's range, every day. No
  inside-day condition.
- `research/proposals/2026-11-14-untested-backlog.md` (branch `untested-backlog`): no inside-day rule.
So the daily inside-day breakout on gold is untested here.

## The question
Does a daily inside day on spot gold (its high below the previous day's high, its low above the previous day's low) lead to a
breakout the next day that pays after costs?

## Data (fixed here)
- OANDA mid XAU/USD M5 candles `[t, o, h, l, c]`, November 2006 to 13 Nov 2026, fetched earlier through the candle proxy and
  kept outside git (`xau-5m.json.gz`, path given on the command line).
- **Daily candles are built from these same M5 candles**, so the levels and the walked path are one feed: each UTC day =
  first open, highest high, lowest low, last close of the M5 candles opened that day; then folded with `council/fills.mjs`
  `foldWeekend` (imported): the Sunday reopen stub is part of Monday, Saturday candles too. (council-data
  `research/daily/xau.json` is not used for levels; the run reports how many folded days differ from it by more than $0.05 in
  high or low, as a check only.)
- A **full day** has at least 120 M5 candles (10 hours) after folding. The inside day, the day before it and the order day must
  all be full: a thin holiday candle (25 Dec, 1 Jan, half days) is never a signal or a trade day. (Chosen before any result
  of this study; the reason is the NR7 study's post-hoc note on holiday candles.)

## Windows (fixed here)
- Assigned by the ORDER day (the day after the inside day). In sample: 2008-01-01 to 2016-12-31. Out of sample (decisive):
  2017-01-01 to the last full day on file (13 Nov 2026). 2006-11 to 2007 is warm-up only (ATR look-back).

## The rule (no parameter is chosen by the data)
- **Inside day** D: high(D) < high(D-1) and low(D) > low(D-1), D and D-1 consecutive folded trading days, both full.
- **Order day** E = the next folded trading day (full). OCO stop orders: buy stop at high(D), sell stop at low(D). They are live
  from E's first M5 candle (for a Monday: the Sunday reopen) until the M5 candle that opens at 21:00 UTC; the first one traded
  wins, the other is cancelled; no fill by 21:00 UTC = no trade (counted).
- **Every trade has a stop: the opposite side of the inside day** (a buy's stop at low(D), a sell's at high(D)), never moved.
  1R = |fill - stop|.
- Path on M5: a candle that opens beyond a level fills at its open (gap, the worse price); else at the level. **In the fill
  candle the stop is checked: if that candle also reaches the stop, the trade is stopped (a full loss).** A candle that reaches
  both the buy and the sell level is booked that way too. After the fill candle, a candle reaching the stop exits at the stop,
  or at its open when it opens beyond (gap).
- **T1 (primary)**: exit at the close of the last M5 candle that opens before 21:00 UTC on day E (or the stop).
- **T2**: target fill +/- 1R. Checked from the candle after the fill; a candle holding both stop and target is the stop; a
  candle opening beyond the target exits at its open. Else as T1.
- **T3**: T1 only when the inside day is tight: range(D) = high(D) - low(D) < 0.6 x ATR14(D), ATR14(D) = the mean true range
  of the 14 folded days ending with D (true range uses the previous folded day's close).
- One position at a time is automatic (every trade closes on its order day before the next order day starts).

## Costs (in R of each trade)
- $0.60 a round trip ($0.30 spread plus $0.15 slippage on the entry and on the exit, as `gold-inside-week`), on every trade
  including a fill-candle stop. 2x costs = $1.20.
- Financing on buys: `nights(fill time, exit time)` x `FIN.xau.long` (0.000148 a rollover, the demo broker's XAUUSD swap of
  11 Nov 2026, `council/fills.mjs`, applied to every year) x fill / risk. With the 21:00 UTC exit almost no trade crosses a
  rollover; it is computed anyway. Sells pay and receive nothing.

## Statistics and the bar
- Per test and window: n, gross and net R a trade, net at 2x costs, total net R, win rate, worst drawdown, t on calendar-month
  sums of net R by exit month (every month of the window counted, 0 where none), one-sided p.
- Holm over the three tests' out-of-sample one-sided p values (alpha 0.05).
- Placebo, 40 seeds (mulberry32, seeds 1-40), out-of-sample window: the same rule on random NON-inside full days (with a full
  next day) of the window, drawn with replacement, as many draws as the test's real out-of-sample signals; for T3 the pool is
  the non-inside days that also meet the 0.6 x ATR14 condition. Same orders, stop, exit and costs. A seed is beaten when the
  real out-of-sample net R a trade is above that seed's mean.
- **A test passes only with all of**: out-of-sample net R > 0; out-of-sample month t >= 2 and Holm significant; in-sample net
  R > 0 (positive in both halves: in sample and out of sample); out-of-sample net at 2x costs > 0; beats at least 38 of the 40
  placebo seeds; out-of-sample n >= 30. Verdict = how many of 3 pass; T1 is the primary. A pass is a paper candidate for the
  owner, never a live rule.

## Reported, not judged
Buys vs sells, by year, fill-candle stops, unfilled signals, the two halves of the out-of-sample window (2017-21, 2022 on).
Anything looked at after the results is labelled post hoc.
