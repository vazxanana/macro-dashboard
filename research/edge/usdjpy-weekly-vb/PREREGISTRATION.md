# Pre-registration: the weekly volatility breakout on USD/JPY

Written 24 Nov 2026, committed and pushed alone before any week of this rule is simulated on USD/JPY. Paper research only;
nothing live changes whatever the result.

## Why

`research/edge/gold-weekly-vol-breakout` tested the breakout one timeframe up on gold (week open ± k × the previous week's
range) and FAILED (T1 2017 → now +0.054R a trade net, n 396, month t 0.92). USD/JPY is the one forex market where the DAILY
rule (T1) holds: `fx-vol-breakout` (2016 → now +0.063R, t 2.50), `usdjpy-vol-breakout-early` (2005-15 +0.079R, t 2.95, PASS),
`usdjpy-vol-breakout-exec` (broker ticks, PASS). The question: does the same WEEKLY rule work on USD/JPY? A separate rule; no
claim carries over from either result. Dedupe: no study under `research/edge/` runs the weekly breakout on USD/JPY
(`fx-weekly-reversal`, `yield-fx-weekly` test other rules).

## Rule (copied, not re-written)

The weekly rule is imported from `research/edge/gold-weekly-vol-breakout/run.mjs` unchanged: `buildWeeks` (week = Monday's
UTC date, Sunday candles belong to the next Monday, trading window to the Friday 20:55 UTC candle, previous week's range =
high − low of all its candles), `weekSkip` (600-candle minimum for the week and the previous week), `wvbTrade` (buy stop at the
week's open O + k × the previous week's range, sell stop at O − k × it, first fill wins, the nearer level when one candle
trades both, a gap fills at the open, stop = O, fill and stop in one candle = the stop, out at the close of the Friday 20:55
candle). Only its gross R (`R`) is used; its gold cost and gold financing are NOT used.

- **T1 (the one test)**: k = 0.5, both sides.

## Data

OANDA mid USD/JPY M5 from the shared candle cache (`research/edge/_lib/edgekit.mjs` `load('usdjpy', '5m')`, 2005-01-02 →
2026-11-22), as rows `[t, o, h, l, c]`. Weeks keyed 2005-01-03 or later; the last complete week in the file is the last used.

## Costs (after costs = after both)

- Round trip: `fx-vol-breakout` `costPx('usdjpy', entry)` = 0.000045 × entry (the demo's commission) + 0.5 pip (0.005), as
  every USD/JPY breakout study; charged as cost / 1R.
- Financing: a weekly position is held over rollovers (Monday-Friday 22:00 UTC, Wednesday three: `council/fills.mjs`
  `nights`). ASSUMED, not measured: 1 % a year of the entry either side (0.01 / 365 × entry a rollover), as `tsmom-portfolio`
  charged forex; no interest differential is credited or charged. Before-financing figures are reported too.
- 2× costs (both doubled) reported.

## Windows

- Discovery 2005-01-03 → 2014-12-31 (weeks by their Monday date). Confirmation 2015-01-05 → the end of the data.
- Month t = t of calendar-month sums of net R, each trade in the month of its exit candle (the study's `monthT`).

## Control (placebo)

The gold study's placebo, unchanged: for every confirmation trade, a market entry in the same week at a random 5-minute candle
from the week's first candle to Thursday 20:55 UTC, side drawn with the test's own confirmation share of buys, stop at the real
trade's 1R distance, out at the week's exit or the stop (`marketTrade`), the same costs; 40 seeds (`rng`).

## Pass bar (all of them)

1. Net R a trade > 0 in discovery AND in confirmation (after costs and financing).
2. Confirmation month t ≥ 2; one-sided p from that t (`normP`), Holm over the one test (= p) < 0.05.
3. Confirmation n ≥ 200.
4. Confirmation net at 2× costs > 0.
5. The rule beats at least 38 of the 40 placebo means in confirmation.

## Descriptive (no verdict)

- Correlation with the daily USD/JPY T1 (`index-vol-breakout/original.mjs` `buildDays` / `daySkip` / `vbTrade`, k 0.5, charged
  with `fx-vol-breakout` `charge`): daily net R summed by the same Monday-keyed week, Pearson correlation with the weekly trade's
  net R over weeks where both traded; and of calendar-month sums over months where both traded. Each window and all.
- Buys / sells split; by year; skipped weeks.

Nothing is tuned after the run; no other k, side or market is looked at on these years.
