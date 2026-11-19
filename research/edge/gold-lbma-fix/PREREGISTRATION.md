# Gold LBMA auctions: does gold run into the PM auction and fade after it? (pre-registration)

Written and pushed on 14 Nov 2026 before any trade of this rule was computed. Nothing below may change after the first result;
anything found later is reported as found later, never folded into the verdict.

## The idea (a published effect, not one found here)

The LBMA Gold Price is set in two electronic auctions a London business day, at 10:30 (AM) and 15:00 (PM) London time. Like the
forex WM/Reuters 16:00 fix (tested here as `london-fix`, branch `london-fix`, FAIL; and `wmr-fix-reversal`), dealers who take
benchmark orders are said to trade into the auction, so price would run in one direction before it and partly give it back
after. No study in this repository has tested the gold auctions (no branch or folder covers them on 14 Nov 2026). This study
asks whether, on spot gold, (a) the move into the PM auction carries on through it and (b) the move into it reverses after it,
after costs, as two mechanical trades that always carry a stop.

This is a new standalone intraday rule on spot gold, not a gate, exit, entry or size of the gold book (Gold trend, Gold daily
engulf), and it uses 2016 onward only, outside the book's 2006-17 window (owner decision 44 does not apply).

## Clock

All times are **London time** (Europe/London: GMT in winter, BST = UTC+1 from the last Sunday of March to the last Sunday of
October). A London wall-clock time on a London date is turned into a UTC instant with `Intl` for Europe/London (the offset is read
for that date at 12:00 UTC; 15:00 London is 15:00 UTC in winter and 14:00 UTC in summer). The candles are OANDA M5, stamped at
their opening second in UTC by OANDA itself, so the HistData clock question (CLAUDE.md "Research candle clock") does not arise.
The weeks when the US and UK change clocks on different dates need no special case: only London time is used.

- **Price at a time X** = the open of the M5 candle that starts at X.
- **Close of the candle at X** = the close of the M5 candle that starts at X (it ends at X + 5 minutes).

## Days

A London weekday (Monday to Friday by the London date), skipping:

- **England and Wales bank holidays** (no LBMA auction): New Year's Day, Good Friday, Easter Monday, the early May and spring
  bank holidays, the summer bank holiday, Christmas Day and Boxing Day with their substitute days, and the moved / extra days
  2016-2026 (8 May 2020 instead of 4 May; 2 and 3 June 2022 instead of 30 May; 19 Sep 2022; 8 May 2023). The list is written
  out in `run.mjs` and checked in the test.
- **24 and 31 December** (the PM auction is not held; the AM one is, so these days are skipped for PM tests only).
- **A day with a gap**: for an auction's tests, every M5 candle from the window's first time to its last must exist with no
  step of more than 15 minutes between consecutive candle starts, and every candle the rule reads must exist. PM window:
  13:30 to 16:30 London (13:30 candle through the 16:30 candle); AM window: 09:00 to 12:00. A day failing the check has no
  trade for that auction (counted as "gap").

## The two tests (PM auction, 15:00 London)

- **T1, run-in through the auction**: M = price at 14:55 minus price at 13:30. M > 0: buy; M < 0: sell; M = 0: no trade. Enter at
  the price at 14:55 (the open of the 14:55 candle). Stop **3 x ATR(14) of M5**, where ATR(14) = the simple mean of the true
  ranges of the 14 M5 candles that ended at or before 14:55 (the candles starting 13:45 to 14:50; each true range uses the
  previous candle's close). Exit at the price at 15:05 (the open of the 15:05 candle). So the trade holds the 14:55 and 15:00
  candles (the auction minutes). R distance D = 3 x ATR.
- **T2, fade after the auction**: M = price at 15:00 minus price at 13:30. M > 0: sell; M < 0: buy; M = 0: no trade. Enter at
  the close of the 15:00 candle (15:05). Stop = the 15:00 candle's high + $0.30 for a sell, its low - $0.30 for a buy. Exit at
  the price at 16:30. R distance D = |entry - stop| (at least $0.30).
- **Management**: the M5 candles from the entry time through the last candle that starts before the exit time. A buy is stopped
  when a candle's low reaches the stop (a sell: its high), filled at the stop, or at the candle's open when the open is already
  past it (a gap). No target, no break-even. Otherwise out at the exit price. Every trade has its stop. Nothing is held across
  the 17:00 New York rollover, so no financing is charged.
- **R** = side x (exit - entry) / D.

## Costs

Prices are OANDA mid, so a round trip pays one spread. The repository's measured gold model (`council/fills.mjs` `costModel`,
CLAUDE.md "Forex spreads: a raw-spread account, measured"; council-data `ctrader/symbols.json` XAUUSD on 14 Nov 2026):
median quoted spread **$0.07** (`spreadTypical`, n 110 reads outside the rollover), commission `commissionRT` **0.000024 x price**
a round trip (USD 12 per million a side), plus half a spread of slippage on each of the two market orders (`SLIP_SPREADS` 0.5:
2 x $0.035). Cost in price = $0.07 + $0.07 + 0.000024 x entry, i.e. about $0.17 at $1,300 gold and $0.23 at $3,900; net R = R -
cost / D. Today's spread in dollars is used for every year (it was not measured before Nov 2026). A second column reports net
R at twice the cost.

## Data

OANDA mid M5 XAU/USD through the site's keyless candle proxy (`/md/bars?sym=xau&tf=5m`, `node --use-env-proxy`), from 1 Dec 2015
(warm-up) to the last complete day fetched (13 Nov 2026), kept outside git.

## Windows

- **In sample**: 2016-01-01 to 2020-12-31.
- **Out of sample (decisive)**: 2021-01-01 to the last day on file.

## The pass bar

Two tests, T1 and T2 (PM auction). A test PASSES only if all of these hold:

1. Net R a trade > 0 in sample AND out of sample.
2. Out of sample: t >= 2 on calendar-month sums of net R (months with at least one trade; t = mean / (sd / sqrt n)).
3. Net R a trade at twice the cost > 0 in both windows.
4. Holm over the two tests: the one-sided p of the out-of-sample month t (normal approximation) is below 0.05 after Holm.

**Verdict**: PASS if at least one test passes (named), FAIL if none does and both have at least 100 out-of-sample trades,
NOT MEASURABLE (inconclusive: …) if a test has fewer than 100 out-of-sample trades and did not pass. Nothing is called an
edge without its n and t.

## Reported only (not part of the verdict)

- **AM auction (10:30)**: the same two designs shifted by -4 h 30 min (T1: M from 09:00 to 10:25, enter 10:25, exit 10:35, stop
  3 x ATR(14); T2: M from 09:00 to 10:30, enter at the close of the 10:30 candle, stop its extreme + $0.30, exit 12:00), the
  AM window's gap check, and 24 / 31 December kept.
- By year and by London day of week, for the PM tests.
- **Placebo**: 40 seeded runs (mulberry32, seeds 1 to 40). Each seed draws one anchor minute F (a multiple of 5) uniformly from
  the London minutes where the whole design window F - 90 to F + 90 lies between 01:30 and 21:00 and does not touch 13:00 to
  16:30 (so F in 03:00-11:30 or 18:00-19:30), and runs T1 and T2 with every time shifted by F - 15:00, the same holding lengths,
  stops, costs, gap check and days. Reported: each test's out-of-sample net R a trade against the 40 placebo values (rank), and
  the share of placebo runs with month t >= 2. Context only.

## Not done

No other market, no filter on the size of M, no target, no news filter (13:30 London is often a US data release; that is part
of the window as written). No change to any live rule, config, council member or the gold book.
