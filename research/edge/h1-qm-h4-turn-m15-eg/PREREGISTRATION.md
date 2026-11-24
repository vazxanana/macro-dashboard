# An H1 quasimodo at an H4 turn level, entered at the left shoulder after an M15 engulf (pre-registration)

Written 24 Nov 2026, committed ALONE before any run on real candles. Research only: nothing live reads it, nothing is placed,
no rule is proposed.

## Why

Two earlier studies tested a quasimodo (QM) reversal with other anchors: `barrier-qm-janda` (gold barrier, QM, the second break:
FAIL) and `trendline-qm` (H1 trendline break, retest, M15 QM: INCONCLUSIVE, too few). `grid6-qm-keylevel` (FAIL, 0 cells after
Holm) already ran an H1 QM that touched an H4 turn of the closes, entered at market or by a limit at the left shoulder placed
at once, on 2010-2019. What none of them has: the limit at the shoulder placed only AFTER a 15-minute engulf with the trade
has completed at the shoulder, and the 2005-2014 / 2015-2026 windows. That is the untested variation run here; the "limit at
once" entry is kept beside it as a control (the engulf is the only difference), not as the question.

## Data

OANDA mid 5-minute candles from the edgekit cache (`research/edge/_lib/edgekit.mjs` `load`), xau, eurusd, gbpusd, usdjpy,
audusd, 2004-01-01 to 2026-10-31 (2004 is warm-up; gold's candles start in March 2006). M15, H1 and H4 are UTC-aligned buckets
of the 5-minute candles (`resample`). Only closed candles are read. Costs: `edgekit` `COSTS` (round trip in price units, the
desk's demo figures: xau 0.30, eurusd 0.00006, gbpusd 0.00008, usdjpy 0.008, audusd 0.00006), the same for every year. A trade
that fills inside a bad interval of the data-quality audit (`combo-grid-2` `exclusions`) is dropped.

## Rules (a sell; a buy is the exact mirror)

1. **H4 turn level.** An H4 candle whose CLOSE is above the closes of the 2 H4 candles before it and the 2 after it is a peak
   of the closes. It is known at the close of the second candle after it. Its level is its close; it is BROKEN by the first
   later H4 candle that closes above that close.
2. **H1 quasimodo** (`edgekit` `qms(H1, 3)`, imported, not edited; swings 3 candles a side, used once confirmed): a swing low,
   a swing high (the LEFT SHOULDER), a higher swing low; price then trades above the shoulder (the highest high after it is
   the HEAD); then an H1 candle CLOSES below the higher low. That close is the break, at time ts.
3. **At the level.** Take the most recent H4 peak that was known by the open of the head's H1 candle and is not broken by ts
   (H4 candles closed by ts). The QM counts only when there is one and the head's high is at or above its level (the head
   reached the last unbroken H4 peak of the closes).
4. **Stop** = the head + half the round-trip cost. **Entry** = a sell limit at the left shoulder's price.
5. **The M15 engulf** (cells `eg`): the first 15-minute candle j that closes within 24 hours after ts and completes a sell
   engulf at the shoulder: j is a down candle; its base b is the most recent up candle before it, at most 3 candles back,
   starting at or after ts; j closes below b's low, and no candle between b and j closed below b's low or above b's high; the
   highest high of candles b..j is at or above the shoulder (it traded at the shoulder) and below the stop; j closes below
   the shoulder. If any 15-minute candle from ts to j has a high at or above the stop, the QM is void. The limit is placed at
   j's close and lives 12 hours.
6. **Control** (cells `now`): the same limit placed at ts (the break closes below the shoulder by construction), living 24 hours.
7. **Fill**: a 5-minute candle starting at or after the order time trades THROUGH the shoulder by half the round trip
   (high >= shoulder + cost / 2), filled at the shoulder, or at the open when it opens above it. On the fill candle only the
   stop counts. A fill at or past the stop is closed at once (0R before costs). A planned risk (stop - shoulder) under
   2 x the round trip is not taken.
8. **Exit**: target 2R or 3R from the fill (R = stop - fill); a candle that holds both the stop and the target is a stop; a
   candle that opens past the stop or the target exits at its open; otherwise out at the close of the 5-minute candle that
   closes 2 days after the fill. Every trade has its stop on the losing side of its fill (the run throws otherwise).
9. One QM gives at most one trade per cell. No one-position rule (trades may overlap).

## Cells (4, all fixed)

`eg 2R`, `eg 3R` (the question), `now 2R`, `now 3R` (the control). Five markets pooled. No other parameter is tried; nothing
changes after the first run.

## Windows

Discovery: fills 2005-01-01 to 2014-12-31 (120 calendar months). Confirmation: fills 2015-01-01 to 2026-10-31 (142 months).
Month sums of R by fill month; a month without a trade counts 0.

## Pass bar (AFTER costs)

A cell passes when, pooled: n >= 300 in each window; mean R after costs > 0 and the t of the calendar-month sums of R after
costs >= 2 in BOTH windows; and the Holm-adjusted one-sided p of its confirmation month t, over the 4 cells, is < 0.05.

- **PASS**: `eg 2R` or `eg 3R` passes.
- **INCONCLUSIVE**: neither `eg` cell has 300 trades in each window.
- **FAIL**: otherwise.

A pass would be a result on mid candles with assumed fills, never an edge by itself.

## Reported

For every cell and window: n, win rate, R a trade before and after costs, month t before and after costs, mean cost in R, the
Holm p; the same per market for the `eg` cells; `eg` minus `now` by window (descriptive); counts of QMs, QMs at a level,
engulfs found, orders, fills, voids and dropped trades; a cut test on eurusd (the setups known by three dates, computed on
candles cut there, must equal the full run's). An offline test on seeded candles checks no look-ahead and the stop side.
