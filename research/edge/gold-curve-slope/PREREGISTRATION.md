# Pre-registration: does the US yield curve's slope tell spot gold's next weeks? (14 Nov 2026)

Written and pushed ALONE before any number of this study was computed. Paper research only: a **stand-alone** gold rule, never
a gate, entry, exit or size of the live gold book, and it does not use that book's 2006-17 window or its positions (owner
decision 44). No live rule, size, filter, stop, config, cost constant or council member changes, whatever the result.

## Why (the economic reason, stated before the data)

A steepening Treasury curve (long yields rising against short ones) is the market pricing more inflation, a larger term premium
or fiscal worry, or a central bank expected to ease while long-run prices rise: each is a reason to hold a real asset that pays
no coupon. A flattening curve is the market pricing tighter policy and lower future inflation: a reason to hold the dollar and
short bonds instead of gold. The hypothesis: **after a large 4-week steepening gold rises over the next weeks, after a large
4-week flattening it falls**. Gold is traded both ways, so the test is not a bet on gold's rise.

Not a duplicate: `gold-bond-lead` (FAIL) traded gold after a large weekly move in ONE bond's price that gold lagged;
`macro-gold` read the 10-year real yield; `yield-fx-weekly` traded currencies. None read the SLOPE (the difference between a
long and a short yield) and none held for four weeks.

## Data (named before any result)

- council-data `research/daily/xau.json`, `usb02y.json`, `usb10y.json`, `usb30y.json` (OANDA mid daily candles, UTC days), read
  with `git show origin/council-data:…` (no network), weekends folded into Monday with `council/fills.mjs` `foldWeekend`. The
  bond keys are CFD PRICES of the 2-, 10- and 30-year Treasuries (a rising price = a falling yield). No other market is read.
- Yield-change proxy over 4 weeks: `dy = -ln(P_now / P_4w_ago) / D` with fixed, assumed modified durations D = 1.9 (2-year),
  8.0 (10-year), 17.0 (30-year). Durations move with the yield level; a fixed value only rescales one leg against the other and
  is stated as an assumption, not measured.
- Weekly points: gold's last candle of each Monday-based UTC week; both bonds must have a candle with that same day stamp. A
  hole of more than 14 days restarts the history.

## The rule

- Slope change over 4 weeks: `ds = dy_long - dy_2y` (positive = steepening). `z = ds / sd`, sd = the standard deviation of
  the 156 weekly values of `ds` BEFORE this week (only earlier data; fewer than 156 in one unbroken chain = no signal).
- z > +1: **long** gold. z < -1: **short** gold. Otherwise nothing.
- Entry at the open of gold's first candle after the signal week; out at the close of the Nth gold candle (N = the test's
  hold) or at the stop. **Every trade has a stop**: 2 x ATR(20) of gold's daily candles before the entry (= 1R); a gap through
  the stop fills at that candle's open; a candle touching the stop exits there (the stop is checked before the close).
- One position at a time: a signal while a trade is open is skipped.

## Costs

$0.60 a round trip ($0.30 spread + $0.15 slippage on each of the two market orders), plus on BUYS financing =
`nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a rollover, `council/fills.mjs`, the demo broker's long swap of
11 Nov 2026, today's rate charged every year) x entry price, in R. Shorts are credited nothing. The cost share is reported
(mean cost in R a trade, and total cost / total gross R where gross is positive). Median stop in dollars is reported; it is
expected to be well above $10 (2 x ATR(20) of gold).

## Tests (three, Holm over exactly these three)

| Test | Long leg | Hold | Sides |
|---|---|---|---|
| **T1 (primary)** | 30-year | 20 gold candles (about 4 weeks) | both |
| T2 | 10-year | 20 gold candles | both |
| T3 | 30-year | 5 gold candles (about 1 week) | both |

Windows: in sample = signals from the first with full history (expected 2007) to 2016-12-31; out of sample 2017-01-01 to
2026-10-31. Statistic: t of net R summed by calendar month of the exit (every month of the window counts, empty months as 0),
one-sided p from the normal, Holm over T1-T3 on the out-of-sample p.

## Baselines (reported, not tests)

- Unconditional same-side baseline: a long at every eligible signal week (same entry, stop, hold, one at a time) and a short at
  every eligible week, each net. The longs of T1 are compared with the all-weeks longs, the shorts with the all-weeks shorts.
- Gross figures beside every net figure.

## Placebo

40 seeded draws (seeds 1-40) per test on the out-of-sample window: the same number of signals with the same long / short
counts placed on randomly chosen eligible weeks, simulated with the same rule. Reported: how many placebo t are at or above the
real one.

## Pass bar (all on the out-of-sample window unless said)

A test passes only if: month-sum net t >= 2 AND Holm p < 0.05; in-sample net R a trade > 0; net R a trade > 0 at twice the costs;
n >= 30; and the real t beats at least 38 of the 40 placebo draws. **PASS** = T1 passes; **PARTIAL** = only T2 or T3 passes;
otherwise **FAIL**. A pass would be a lead to replicate, not an edge, and would change nothing live.

## Informational (no verdict)

- Bear steepening only (z > +1 AND the long yield rose over the 4 weeks), long, 20 candles, against the all-weeks longs.
- Year-by-year net R of T1.
