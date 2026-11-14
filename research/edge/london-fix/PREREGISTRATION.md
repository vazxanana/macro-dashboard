# London fix: the run into the 16:00 WM/Reuters fix on forex majors, and whether it reverses (pre-registration)

Written and pushed on 14 Nov 2026 before any trade of this rule was computed. Nothing below may change after the first result;
anything found later is reported as found later, never folded into the verdict.

## The idea (a published effect, not one found here)

The WM/Reuters benchmark rates are fixed over a short window around 16:00 London time. Banks that took fixing orders buy or
sell into that window, so price is said to run in one direction in the minutes before the fix and partly give it back after
it. This study asks, on EVERY London weekday (not month-ends: that was `fx-month-end`, branch `fx-month-end`; not the Tokyo
fix: that was `gotobi`), whether a large pre-fix run (a) carries on into the fix and (b) reverses after it, after costs, on
OANDA prices, as two mechanical trades that always carry a stop.

## Clock

All times are **London time** (Europe/London: GMT in winter, BST = UTC+1 from the last Sunday of March to the last Sunday of
October). A London wall-clock time on a London date is turned into a UTC instant with `Intl` for Europe/London (the offset is
read for that date; 15:30 London is 15:30 UTC in winter and 14:30 UTC in summer). The candles are OANDA M5 stamped at their
opening second in UTC. The weeks in March and October / November when the US and UK change clocks on different dates need no
special case: only London time is used.

- **Price at a time X** = the open of the M5 candle that starts at X. A trade whose entry candle is missing is not taken. An exit
  whose candle is missing uses the close of the last candle before X if that candle started 15 minutes or less before X; else
  the day has no trade ("no data", counted).
- **Day**: a London weekday (Monday to Friday by the London date). No holiday calendar: a day with missing candles has no
  window and no trade.

## The window and the event

- **A (the pre-fix run)** = price at 15:55 minus price at 15:30 London, i.e. the open of the 15:55 candle minus the open of the
  15:30 candle. Both candles must exist, else the day has no A.
- **Reference** = the median of |A| over the 20 London weekdays strictly before the day (every weekday, event or not). At least
  15 of those 20 must have an A, else no trade. Nothing on or after the day enters the reference (no look-ahead).
- **Event**: |A| > 1.5 x the reference, and the reference > 0. Direction of A: up if A > 0, down if A < 0.
- **D** (the stop distance of both tests) = |A| of that day.

## The two tests

- **T1, fade after the fix**: at 16:05 London enter AGAINST A (A up: sell; A down: buy) at the open of the 16:05 candle. Stop
  1 x D beyond the entry (sell: entry + D; buy: entry - D). Exit at 17:00 London (the open of the 17:00 candle).
- **T2, follow into the fix**: at 15:55 London enter WITH A (A up: buy; A down: sell) at the open of the 15:55 candle. Stop
  1 x D (buy: entry - D; sell: entry + D). Exit at 16:05 London (the open of the 16:05 candle).
- **Management**: M5 candles from the entry candle through the last candle that starts before the exit time. A buy is stopped
  when a candle's low reaches the stop (a sell: its high): filled at the stop, or at that candle's open when the open is
  already past it (a gap). No target, no break-even. Otherwise out at the exit price. Every trade has its stop. No position is
  held across the 17:00 New York rollover, so no financing is charged.
- **R** = side x (exit - entry) / D.

## Pairs

EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CHF, EUR/JPY. A pip is 0.0001, and 0.01 for the two yen pairs. Each test pools the
six pairs' trades; per-pair figures are reported for information and are not tests.

## Costs

Prices are OANDA mid, so a round trip pays one spread. The measured raw-spread model of CLAUDE.md "Forex spreads": 0.3 pip spread
a round trip, plus a commission of USD 22.5 per million of USD notional a side, plus 0.5 pip of slippage a side. The commission
a side in the quote currency is 22.5e-6 x the pair's price per unit for every one of the six pairs (EUR/USD, GBP/USD, AUD/USD:
notional in USD = units x price; USD/JPY, USD/CHF: notional = units; EUR/JPY: notional = units x EUR/USD, and EUR/USD x USD/JPY
= EUR/JPY). Cost in price = 0.3 pip + 2 x 0.5 pip + 2 x 22.5e-6 x entry; net R = R - cost / D. The 0.3 pip spread was measured
on the USD majors, not on EUR/JPY; it is used for EUR/JPY as stated, not measured. A second column reports net R at twice the
cost (R - 2 x cost / D); it is not part of the bar.

## Data

OANDA mid M5 candles of the six pairs from 1 Nov 2015 to 12 Nov 2026 (the files fetched for the `fx-london-orb` study through
the site's keyless candle proxy), kept outside git.

## Windows

- **Decisive**: 2020-01-01 to the last day on file (12 Nov 2026).
- **Replication**: 2016-01-01 to 2019-12-31.

## The pass bar

Two tests, T1 and T2, each on the six pairs pooled. A test PASSES only if all of these hold:

1. Decisive window: pooled net R a trade > 0.
2. Decisive window: t >= 2 on calendar-month sums of pooled net R (months with at least one trade; t = mean / (sd / sqrt n)).
3. Replication window: pooled net R a trade > 0 (same sign).
4. Holm over the two tests at a family-wise 0.05, on the one-sided p of the decisive month-sum t (normal approximation).
5. Placebo: 40 seeds (1-40, a seeded mulberry32). The fix time F = 16:00 is moved to another half-hour of the London afternoon:
   F in {12:00, 12:30, 13:00, 13:30, 14:00, 14:30, 15:00, 17:00, 17:30, 18:00} (15:30, 16:00 and 16:30 are left out because
   their windows would hold the fix). Every window keeps its place relative to F: A from F-30 to F-5 min, T2 from F-5 to F+5,
   T1 from F+5 to F+60, the reference the median of the same slot's |A| over the 20 previous weekdays, the same 1.5 x event
   filter, stops and costs. For each seed and each decisive-window day one slot is drawn (the same slot for the six pairs that
   day), the test is run on every pair that has an event at that slot, and the pooled net R a trade is recorded. The test's net
   R a trade must be above the 95th percentile of the 40 = the 38th of the 40 sorted from lowest.

**Verdict**: PASS if at least one test passes all five; it names which. FAIL otherwise. Either way the report gives n, net R a
trade, gross R a trade and month-sum t for each test, window and pair, the placebo distribution, the 2 x cost figures, the
stop-out share and the days lost to missing data. A PASS would be written up as a proposal for the owner, never as a live rule.
