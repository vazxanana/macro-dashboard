# Pre-registration: the Commodity Channel Index on gold's daily chart (14 Nov 2026)

Committed and pushed ALONE, before any return, trade or statistic of these rules was computed.

**Question.** Does the Commodity Channel Index (Lambert, 1980), an oscillator written for commodity futures, give a
tradeable signal on gold's daily chart, either as Lambert's trend entry (a push beyond +/-100) or as the common retail
fade (a return from beyond +/-100)?

**What this is not.** A stand-alone rule, tested on its own. It is **not** a gate, exit, entry, filter or size of the live
gold book (Gold trend + Gold daily engulf), and it reads nothing of it; it does not use that book's 2006-17 window or its
positions, so owner decision 44 is untouched. Paper research only: nothing live changes, and a pass would only be reported
to the owner, never applied.

**Dedupe.** No study, branch or backlog line names CCI or the Commodity Channel Index (searched `research/edge/*/` text,
`git branch -r`, and `research/proposals/2026-11-14-untested-backlog.md` on `untested-backlog`). Nearest relatives read:
`gold-macd` (MACD / 50-200 crosses), `gold-adx-trend`, `gold-daily-bollinger`, `gold-200d-stretch`, `gold-vol-breakout`,
`gold-tsmom`, `metals-rsi2`. CCI measures the typical price's distance from its 20-day mean in units of its mean absolute
deviation: a different statistic and different thresholds from all of them.

## Data (fixed before any result)

- Market: **spot gold only** (XAU/USD), OANDA mid daily candles, council-data `research/daily/xau.json`, read with
  `git show origin/council-data:research/daily/xau.json` (no network; the cache stays out of git). Rows start March 2006.
- Weekend candles folded into the next weekday with `council/fills.mjs` `foldWeekend`. Only complete days are used.
- Warm-up March 2006 to December 2006: no signal before 1 January 2007 is traded.

## The indicator

- Typical price TP = (high + low + close) / 3 of each folded day.
- CCI(20) on day i = (TP[i] - SMA20(TP)[i]) / (0.015 x MD[i]), MD = mean absolute deviation of the last 20 TP values from
  their mean (days i-19 .. i). Lambert's constant 0.015.
- ATR(14) = simple mean of the last 14 true ranges up to and including day i.
- Every signal is read on the CLOSE of day i and filled at the OPEN of day i+1. Nothing of day i+1 or later is read.

## The three tests (fixed before any result)

**Every trade carries a stop**: 2 x ATR(14) of the signal day from the entry price, never moved. A day that opens beyond
the stop fills at the open; otherwise the stop price. Stops are checked from the entry day on. One position at a time.

- **T1 (primary), Lambert trend, both sides.** CCI crosses above +100 (CCI[i-1] <= 100 < CCI[i]): buy. CCI crosses below
  -100 (CCI[i-1] >= -100 > CCI[i]): sell. Exit at the next open after CCI crosses back through 0 against the trade (long:
  CCI[i] < 0; short: CCI[i] > 0), or at the stop, or at the open after the 30th day held (time limit). An opposite entry
  signal while holding closes the trade and opens the new one at the same open (it cannot happen without the 0 cross first,
  except in the exit's own day; both are handled by "exit first, then entry").
- **T2, Lambert trend, long only.** T1's long trades alone (the same signals, exits and stop; shorts ignored).
- **T3, retail fade, both sides.** CCI crosses back below +100 from above (CCI[i-1] > 100 >= CCI[i]): sell. CCI crosses back
  above -100 from below (CCI[i-1] < -100 <= CCI[i]): buy. Exit at the next open after CCI crosses 0 (in the trade's favour:
  short exits when CCI[i] < 0, long when CCI[i] > 0), at the stop, or after 30 days.
- 1R = the stop distance. R = (exit - entry) x side / stop distance.

## Costs

- $0.60 an ounce a round trip on every trade, as 0.60 / stop distance in R. The **cost share** (cost and financing over
  gross R, OOS) is reported.
- Financing on buys: `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a rollover, the demo broker's XAUUSD swap of
  11 Nov 2026, `council/fills.mjs`) x entry / stop distance. Shorts are charged and credited nothing (`FIN.xau.short` = 0).
  Entries and open exits are stamped 00:00 UTC of the day; a stop inside a day 12:00 UTC.
- 2x costs: $1.20 and twice the financing.

## Windows

- **In sample (IS)**: entries 1 January 2007 to 31 December 2016. **Out of sample (OOS)**: 1 January 2017 to the last
  complete candle (early November 2026). OOS halves 2017-21 and 2022-end.

## Statistics

- Per test and window: n, win rate, R a trade gross and net, total net R, worst drawdown, median stop in dollars, median
  days held.
- **Month t**: net R summed by exit month over every calendar month of the window (empty months count 0); two-sided p.
- **Holm** over the three tests' OOS p-values.
- **Placebo, 40 seeds** (mulberry32, seeds 1-40), OOS only: the same number of trades, each on a uniformly random OOS day,
  keeping each real trade's SIDE, holding length and 2 x ATR stop, same costs. This is the **unconditional same-side
  baseline**: it holds the long / short mix and holding time fixed and removes only the CCI timing. The rule must beat at
  least 38 of 40 seeds.

## Pass bar (each test on its own; all must hold)

1. OOS net R a trade > 0, and OOS month t >= 2 with Holm-adjusted p < 0.05.
2. Net R a trade > 0 in sample (same sign) and in both OOS halves.
3. OOS net R a trade > 0 at 2x costs.
4. Beats at least 38 of 40 placebo seeds.
5. OOS n >= 30 and the median stop >= $10.

T1 is the primary test. The study PASSES if T1 passes every check. T2 and T3 passing alone are reported as secondary
findings, not as an edge, and would need their own pre-registration on other data. No live rule changes whatever the result.

## Deliverables

`run.mjs` (`fetch <dir>`, `full <dir>`), `RESULT.md`, `result.json`, `tests/gold-cci.test.mjs` (offline: CCI on hand-made
candles, no look-ahead, a stop on every trade, the report against result.json), rebuilt `out/`.
