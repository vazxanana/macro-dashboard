# Gold: the daily volatility breakout beside the supported gold book (descriptive)

A descriptive note. **No rule is tested, there is no pass or fail, and nothing live changes.** It is not a gate, exit, entry or size of the live gold book (owner decision 44 holds) and it is not a sizing proposal. The book's positions are its supported-book records, read through that study's own `positions()` / `bookStats()`; the breakout is the `gold-vol-breakout` T1 from `original.mjs`, a verbatim copy (sha256 in `result.json`). Any use of the breakout is the owner's decision (see the forward-record proposal on branch `gold-vol-breakout-proposal`). The plan was pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.

**Verdict: DESCRIPTIVE, no rule tested: 2007-17 the breakout and the gold book correlate −0.04 by month; side by side their worst drawdown is 59 % of the two drawdowns added**

## Window A: 2007-2017, the book's untouched window

2007-01-01 to 2017-12-31, 2870 weekdays, 11 years. Equal size: 1R a book unit, 1R a breakout trade.

| Record | n | Total R | R a year | Worst drawdown R (closed) | Longest under water (weekdays) | Positive months | Month-sum t |
|---|---|---|---|---|---|---|---|
| Book (Gold trend + Gold daily engulf), positions | 311 | +62.1 | +5.64 | 19.8 | 988 | 39 % of 132 | +1.74 |
| Breakout T1, trades | 2024 | +184.0 | +16.73 | 35.2 | 397 | 56 % of 132 | +2.91 |
| Both, side by side | 2335 | +246.1 | +22.37 | 32.4 | 406 | 62 % of 132 | +3.46 |

- Correlation of the two: daily −0.07, monthly −0.04.
- Combined worst drawdown ÷ (book drawdown + breakout drawdown) = 0.588 (32.4 ÷ (19.8 + 35.2)).
- Check: the book's month-sum t and drawdown here equal `bookStats`' own for this window (+1.74, 19.8R): yes.

## Window B: 2018 to 2026-10, built-on years for the book (description only)

2018-01-01 to 2026-10-31, 2305 weekdays, 8.83 years. Equal size: 1R a book unit, 1R a breakout trade.

| Record | n | Total R | R a year | Worst drawdown R (closed) | Longest under water (weekdays) | Positive months | Month-sum t |
|---|---|---|---|---|---|---|---|
| Book (Gold trend + Gold daily engulf), positions | 255 | +118.1 | +13.37 | 11.3 | 320 | 47 % of 106 | +3.04 |
| Breakout T1, trades | 1682 | +84.2 | +9.53 | 39.2 | 821 | 54 % of 106 | +1.65 |
| Both, side by side | 1937 | +202.3 | +22.90 | 40.8 | 498 | 57 % of 106 | +3.05 |

- Correlation of the two: daily −0.04, monthly +0.07.
- Combined worst drawdown ÷ (book drawdown + breakout drawdown) = 0.809 (40.8 ÷ (11.3 + 39.2)).
- Check: the book's month-sum t and drawdown here equal `bookStats`' own for this window (+3.04, 11.3R): yes.

## Reading

In 2007-17 the two records barely move together (daily −0.07, monthly −0.04): the book is a few long gold positions held for days to weeks, the breakout one intraday trade most weekdays, either side. Side by side at equal size the worst drawdown was 32.4R against 19.8R (book) and 35.2R (breakout) alone, 59 % of the two added; the longest stretch under water 406 weekdays against 988 and 397; month-sum t +3.46 against +1.74 and +2.91. In 2018-26 (built-on years for the book, description only) the correlation was daily −0.04, monthly +0.07, and the combined drawdown 81 % of the two added. At 1R each the breakout carries about 7 times as many trades as the book has positions, so it sets most of the combined figures; the combined month-sum t is a description of these two paths, not evidence of anything. These are two independent paper records laid side by side, not a test:the breakout's own evidence is its replication study (2007-15) and the original study (2016-26), the book's is supported-book (a FAIL on its t). Equal size is a reporting convention, not a weight; the figures change nothing in the book, its forward-test protocol or its stop lines, and they are not a sizing proposal.

## Data and method

- Book: Gold trend + Gold daily engulf from research/edge/supported-book/legs.json through its positions() / bookStats() (x1F1: $0.30 a unit, financing on every unit), net R a position booked on its close day, 1R a unit
- Breakout: gold-vol-breakout T1 (UTC open ± 0.5 x the previous folded day's range, stop at the open, out at 20:55 UTC) from original.mjs on OANDA mid M5 XAU/USD, $0.60 a round trip, net R a trade on its trade day, 1R a trade; 3740 trades 2006-11-02 → 2026-11-12
- Daily series on weekdays; the combined series is the plain sum. Drawdown, longest stretch under water, month-sum t and correlation are supported-book's own `drawdown`, `tOf` and `corr`.
- To repeat: `node research/edge/gold-vol-breakout-with-book/run.mjs <dir>` with `<dir>/xau-5m.json.gz` (OANDA mid M5 XAU/USD, the replication study's cache, kept out of git).
