# Dual momentum, gold against US stocks against cash: pre-registration

Written and committed **before** any return below was computed (13 Nov 2026). The rule, the data, the costs, the benchmarks,
the windows and the pass bar are fixed here; anything added later is labelled post hoc in `RESULT.md`.

Paper research only. Whatever the outcome, no live rule, size, filter, stop, config, cost constant or mirror setting changes;
a pass would at most lead to a written proposal for a paper shadow, for the owner.

## What this is, and what it is not

- **A stand-alone monthly allocation rule** between two risky assets and cash. It is **not** a test of the gold book (Gold
  trend + Gold daily engulf): it is not a gate, size, entry or exit of either system, it is never combined with them, and
  owner decision 44 ("no further gate, exit, entry or size is tested on this book's 2006-17 window") is not touched.
- Source: G. Antonacci (2014), *Dual Momentum Investing* (McGraw-Hill): each month hold whichever of two risky assets had
  the better 12-month return (relative momentum), but only if that return beats cash (absolute momentum); otherwise hold
  cash. His published samples use total-return indices and end before 2014, so the decisive window below (2016 on) is after
  the book.
- It follows four monthly timing studies of 13 Nov 2026 that failed (branches `sma10-timing`, `gold-tsmom`,
  `tsmom-portfolio`, `vol-managed`, not on main). Their cost and financing conventions are copied (not imported) here, so
  the four and this one are costed alike. This study is one more of the same family: read its result with that in mind.

## Data (seen before this file: only the first and last date of each file)

OANDA mid daily candles from council-data `research/daily/<key>.json` (`git show origin/council-data:...`, no network):
`spx500` (SPX500_USD, from March 2003) and `xau` (XAU_USD, from March 2006); both end 6 Nov 2026. The 2-year Treasury yield:
council-data `macro/cache.json` `score.fred.DGS2` (weekly, from January 2006), as-of (latest date on or before the day).
Saturday / Sunday candles are folded into the next weekday with `council/fills.mjs` `foldWeekend`.

**One calendar**: the two markets are put on the dates both have a candle. A candle of one market on a date the other lacks
is folded into that market's next common candle (first open, highest high, lowest low, last close), so no price move and
no stop touch is lost; a trailing one is dropped.

Limitation, said now: SPX500 is a **price** index (no dividends). Buy-and-hold and the 50/50 hold stocks more of the time
than the rule probably will, so missing dividends hurts them more and flatters the rule. A sensitivity run credits 1.8 % a
year while long SPX500 to every strategy; the verdict is read on the primary run without it.

## The rule

- **Month end** = the last common candle of a calendar month (the last month only once a later month has begun).
- **Signal** at month end i, for each asset, lookback L trading days (primary L = 252; pre-stated variant L = 126, the
  6-month lookback): `R = close[i] / close[i - L] - 1`, on common candles, closes at or before i only.
- **Relative**: the asset with the higher R. **Absolute**: hold it next month only if its R is above the **cash hurdle**;
  else flat. Cash hurdle = the 2Y yield's accrual over the lookback = mean of the DGS2 values dated in the L / 252 years up
  to the month-end date (inclusive), / 100, times L / 252 (12 months: the mean yield; 6 months: half of it).
- **Cash return while flat = 0** (no interest is credited). Stated: this understates the rule in flat months (a real account
  would earn something near the hurdle) and is the conservative choice.
- **Execution** at the OPEN of the first candle after the month end (never at the close that made the signal). Switching
  from one asset to the other sells one and buys the other at that open; staying in the same asset is no trade.
- **Catastrophe stop (every position has a stop)**: at each month end, for the position held into the next month,
  `stop = month-end close - 3 x ATR(20)` of that asset (mean true range of the 20 common candles ending at the month end).
  A position kept from the previous month takes the higher of its old stop and the new one (never loosened). Each day: if
  the open is at or below the stop the position exits at the open, else if the low reaches the stop it exits at the stop. A
  stopped position **stays flat until the next month end**, where the signal is read again.
- Size: one unit of notional (1x, unlevered); returns on that notional, compounded daily. Long only.

## Costs (all charged in the primary run, as in the four studies)

- **Spread** per entry and per exit (signal, switch or stop), a full stated spread each side: SPX500 0.5 point, gold $0.30.
- **Financing while long**, per rollover night (`council/fills.mjs` `nights`: Mon-Fri 22:00 UTC, Wednesday three), as a
  share of the day's close: gold `FIN.xau.long` (0.000148 a night, today's demo rate charged for every year); SPX500
  `(DGS2 + 2.5 %) / 365`, DGS2 floored at 0. A position held at a candle's close pays the nights to the next common candle.

## Benchmarks (same costs)

- **50/50**: half SPX500, half gold, rebalanced to 50/50 at the open of each month's first candle (weights drift within the
  month). Spread on entry at the window's first open (both legs) and, at each rebalance, on the traded share of each leg
  (|weight change| x spread / price). Financing on each leg. No stop (a reference series, not a council trade).
- **Buy-and-hold** of each asset: one spread at the first open, financing every night, no stop.

## Windows

- W1 check: 2008-01-01 to 2015-12-31. W2 decisive: 2016-01-01 to the last candle. The rule's state at a window's first
  candle comes from the last month end before it (earlier history is used only for the lookback, ATR and stop); a position
  held at the window start is bought at that first open (one spread), as the benchmarks are.

## Statistics

Daily returns, Sharpe = mean / sd x sqrt(252) (no risk-free rate subtracted, for every series alike), CAGR, maximum
drawdown on the compounded daily series, time in each asset, switches, stops.

**Paired 6-month block bootstrap** on W2: the window's calendar months are cut into overlapping 6-month blocks (a block
starts at any month with 6 months of data from it); blocks are drawn with replacement (seed 20261113, 2,000 draws) and
joined until the window's month count is reached (the last block cut); the SAME drawn months are used for the rule and the
50/50. P = share of draws where the rule's Sharpe is above the 50/50's.

## Pass bar (fixed)

A lookback passes when, all together:
1. W2: rule Sharpe > 50/50 Sharpe;
2. W2: Holm over the two lookbacks rejects for it, with p = 1 - P at a family level of 0.10 (sorted, the smaller p must be
   at or under 0.05, the larger at or under 0.10); for the primary alone this is at least P >= 0.9, as asked;
3. W2: the rule's maximum drawdown is not deeper than the 50/50's;
4. W1: rule Sharpe > 50/50 Sharpe (the same sign as W2).

**Verdict**: PASS if the 12-month lookback passes; "PASS (6-month only)" if only the variant passes, reported as weaker;
FAIL otherwise. Buy-and-hold of each asset is reported, not part of the bar. Never call it an edge without n and t: the
result also gives the number of months, positions and switches.

## Files

`run.mjs` (`fetch <dir>` = git show into a directory outside git; `full <dir>` = result.json), `result.json`, `RESULT.md`
(verdict first), `tests/dual-momentum.test.mjs` (offline).
