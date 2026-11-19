# Pre-registration: does Monday tell the rest of gold's week? (14 Nov 2026)

Written and pushed alone, before any candle is read for this study. Paper research: nothing live changes. A new stand-alone
rule on spot gold; it is not a gate, exit, entry or size of the gold book (Gold trend / Gold daily engulf), reads none of its
positions, and says nothing about it (owner item 44).

## Question
After a large Monday move in gold, does the rest of the week (Tuesday to Friday) continue in the same direction **more than an
ordinary Tuesday-to-Friday position on the same side does**? The test is built to separate a signal from gold's upward drift:
every trade is scored against the same-side trade taken in every week of the same window.

No earlier study here tested it: `gold-weekday` traded single weekday sessions (Monday short, Friday long), `gold-weekly-open`
used the Sunday open as a level, `gold-first-week` the first week of the month, `fx-weekday` the dollar basket.

## Data (fixed now)
- Market: spot gold only, council-data `research/daily/xau.json` (OANDA mid, UTC days, read with `git show
  origin/council-data:…`, no network). No other market.
- Weekend candles are folded into the next weekday with `council/fills.mjs` `foldWeekend` (the Sunday stub belongs to Monday).
- Windows: in sample = weeks whose Monday is in 2007-2016; out of sample = 2017 to the last complete week before 1 Nov 2026.

## Rule
For each week with a Monday, Tuesday and Friday candle (folded days):
- ATR = mean true range of the 20 folded days before Monday (Monday not included).
- M = Monday close − the previous trading day's close (normally Friday; it includes the weekend gap).
- **Signal**: |M| >= 0.5 x ATR. Side d = sign(M) (follow Monday).
- Entry: Tuesday's open. Stop: 1.5 x ATR from the entry (every trade has a stop). No target.
- Exit: Friday's close (the last candle of the week). If Tuesday to Friday has fewer than the usual days (a holiday), out at the
  last day of the week.
- Stop on daily candles: if a day opens beyond the stop, filled at that open; else if the day's low (buy) / high (sell) touches
  the stop, filled at the stop. The day's close never matters before the stop is checked.
- R = d x (exit − entry) / (1.5 x ATR).
- **Baseline**: the identical trade (same entry, stop, exit, side) taken in EVERY eligible week of the window, buy side and sell
  side separately: b_long, b_short = mean net R a trade of those unconditional trades in that window.

## Costs
- $0.60 a round trip (spread + slippage on two market orders), in R as 0.60 / risk.
- Buys also pay overnight financing: `nights(entryTime, exitTime)` x `FIN.xau.long` x entry / risk (`council/fills.mjs`, today's
  demo rate used for every year). Sells pay and earn nothing.
- Reported: the cost share (cost R / |gross R|), the median stop in dollars (expected over $10), and every figure at 2x costs.

## Tests (Holm over three)
- **T1 (primary, both sides)**: every signal week, excess_i = net R_i − b_side (the window's own same-side baseline).
  Statistic: t of the calendar-month sums of excess (every calendar month in the window counts, zero when no trade).
- **T2**: buy signals only (Monday up), excess over b_long.
- **T3**: sell signals only (Monday down), excess over b_short.
Raw net R, gross R, n and month t of the raw net are reported beside each.

## Pass bar (decided now)
T1 passes only if all hold: out-of-sample excess month t >= 2 with Holm-adjusted p < 0.05 over the three tests; in-sample
excess of the same sign; out-of-sample raw net R a trade > 0 at 2x costs; and the out-of-sample excess t beats at least 38 of
the 40 placebos. T2 / T3 can only describe where an effect sits; they cannot pass the study alone.

## Placebo
40 seeded draws (mulberry32, seeds 1..40): in each, the same number of out-of-sample weeks as T1's signal weeks are drawn at
random from all eligible out-of-sample weeks, each given a random side with the same buy / sell split as T1, and scored by the
T1 statistic. Reported: the placebo t distribution and how many beat the real T1.

## What would not be done
No threshold, stop, exit or window is changed after the first run. A failed result is reported as failed; no variant is called
an edge. Nothing in `council/`, `ict/` or the page changes.
