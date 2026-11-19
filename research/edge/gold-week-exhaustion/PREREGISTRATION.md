# Pre-registration: gold's week already stretched by mid-week, faded to the Friday close, 14 Nov 2026

Written and pushed alone, before any signal or trade of this rule was computed. Paper research only: nothing live reads it,
no rule, size, filter, stop, config or council member changes whatever the result.

## Question
Traders speak of a week's range "being used up": once gold has already moved, from the week's open, as far as a normal
week's whole range by Monday, Tuesday or Wednesday, the rest of the week is said to give some of it back. Does fading such a
stretched week, from the next day's open to the week's last close, make money net of costs, and more than the same side
taken on the same weekday of every week (the unconditional same-side baseline)?

A **stand-alone daily rule**, both-sided. It is not a gate, exit, entry or size change of the live gold book (Gold trend /
Gold daily engulf) and reads none of that book's 2006-17 positions (owner decision 44); the daily candles alone are used.
Not covered by an earlier study: `gold-shock-revert` fades or follows one extreme day (next day only); `gold-range-expansion`
trades the close of one wide day; `gold-capitulation` the year's largest 5-day move; `gold-week-raid` a raid of the previous
week's high / low; `gold-weekly-wick`, `gold-outside-week`, `gold-inside-week` read completed weekly candles;
`gold-autocorr-switch` follows or fades a 5-day move by autocorrelation. None measures the move inside the current calendar
week against a normal week's range, nor holds to the end of that week.

## Data (named before any result)
- One market: XAU/USD only. council-data `research/daily/xau.json` at commit `67bac79eb` (OANDA mid daily candles, UTC days,
  2006-03-20 to 2026-11-13), weekend stubs folded into the next weekday with `council/fills.mjs` `foldWeekend` (so Monday's
  open is the week's first price, the Sunday reopen).

## Rule
- A **week** = the trading days Monday to Friday of one calendar week (UTC). Week open `WO` = the open of the week's first
  day. Its range = highest high minus lowest low of its days.
- `AWR` (average weekly range) at a week = the mean range of the 10 latest COMPLETE weeks before it (no day of the current
  week is read).
- At the close of day i, when day i is the 1st, 2nd or 3rd trading day of its week (closed candles only):
  `M = close(i) - WO`. **Signal** when `|M| >= 0.75 x AWR`. Only the first signal day of a week counts.
- **Side** = fade: `-sign(M)` (sell a week already up 0.75 x AWR or more, buy a week already down as much).
- Entry at the open of day i+1, which must be in the same week (a signal on the week's last day gives no trade).
- **Stop** = 1.5 x ATR(20) at day i (true range, the 20 days ending at i) from the entry, every trade, on the losing side. A
  day that opens through the stop fills at its open, else a touch of the stop (low for a buy, high for a sell) fills at the
  stop. No target. **Exit** at the close of the week's last trading day (normally Friday), or at the stop. Holds 1 to 4
  trading days.
- At most one trade a week, so trades never overlap.

## Tests (three, Holm over the three)
- **T1 (primary, both-sided): the fade**, buys and sells.
- **T2: buys only** (T1's buy trades: weeks already down).
- **T3: sells only** (T1's sell trades: weeks already up).
- **Same-side baseline** (comparison and one pass condition, not a fourth test): for each entry weekday (Tuesday, Wednesday,
  Thursday) and each side, the same trade (entry at that weekday's open, same stop rule, out at the week's last close, same
  costs) taken in EVERY week of the window. The baseline net R of a test = the average, over its trades, of the mean net R of
  the baseline trades with the same side and entry weekday in the same window. The **excess** = the test's net R a trade
  minus that baseline; a Welch t (signal trades against the matching baseline trades) is reported.

## Costs
- $0.60 a round trip (spread $0.30 + $0.15 slippage each side).
- Buys pay overnight financing: `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a rollover, the demo broker's
  XAUUSD swap of 11 Nov 2026, `council/fills.mjs`) x entry price; sells pay and earn nothing.
- **Cost share of R**, measured on every day (no signal read): median 1.5 x ATR(20) is $28.0 in 2007-16 (median gold $1,223)
  and $35.9 in 2017-26 ($1,823). The $0.60 is 2.1 % / 1.7 % of R; four nights of financing on a buy about 2.6 % / 3.0 % of
  R. Median stop well over $10. The realised cost share of the test trades is reported.
- 2x costs = the round trip and the financing both doubled.

## Statistics and windows
- R a trade, 1R = the stop distance. Trades counted by EXIT month. In sample 2007-01 to 2016-12, out of sample 2017-01 to
  2026-10. t = mean / standard error of net R summed by calendar month, over EVERY calendar month of the window (months
  with no trade count as 0). One-sided p from t (normal), Holm over the three tests.
- **Placebo**: 40 seeds; each real trade is replaced by the baseline trade of a random week of the same window with the same
  side and the same entry weekday; the OOS net month t of each seed. The real t must beat more than 38 of the 40.
- **Pass** (each test on its own): OOS net month mean > 0 with t >= 2 and Holm p < 0.05; in-sample net month mean > 0; OOS
  mean still > 0 at 2x costs; more than 38 of 40 placebo seeds below the real OOS t; and the OOS excess over the same-side
  baseline > 0. The verdict is PASS only if T1 (the primary) passes; a pass of T2 or T3 alone is reported as such.
- Also reported (description, not tests): signal weeks per window, the trades by entry weekday, per-year net R, and the
  continuation side (the mirror of T1) for reading only.
- Nothing is changed after the run; if it fails, no variant (threshold, lookback, stop, hold) is tried here.
