# Pre-registration: month-end rebalancing flow between equities and gold (14 Nov 2026)

Written and pushed alone, before any candle is read for this study. Paper research: nothing live changes. A new stand-alone
rule on spot gold; it is not a gate, exit, entry or size of the gold book (Gold trend / Gold daily engulf), reads none of its
positions, and says nothing about it (owner item 44).

## Question
Portfolios that hold gold beside equities at fixed weights rebalance near the end of the month: when equities outran gold over
the month they buy gold back, when gold outran equities they sell it. Does gold's last three trading days of the month move
against the month's relative performance **more than an ordinary month-end position on the same side does**? The test is
built to separate a signal from gold's upward drift: every trade is scored against the same-side month-end trade taken in
every month of the same window.

No earlier study here tested it: `rebalance-flow` traded the equity indices themselves (SPX500 / NAS100, FAIL 0 of 4),
`bond-month-end` the Treasury CFDs, `gold-turn-of-month` / `gold-first-week` / `gold-quarter-end` the calendar alone with no
cross-asset signal, `gold-spx-rs` relative strength as momentum (not a month-end flow).

## Data (fixed now)
- Markets: spot gold (traded) and the S&P 500 CFD (signal only), council-data `research/daily/xau.json` and
  `research/daily/spx500.json` (OANDA mid, UTC days), read with `git show origin/council-data:…`, no network. No other market.
- Gold weekend candles are folded into the next weekday with `council/fills.mjs` `foldWeekend`; the S&P series is read on the
  same folded calendar (its close on or before each gold day).
- Months are calendar months of gold's folded trading days. In sample = months 2007-2016; out of sample = January 2017 to
  October 2026.

## Rule
For each month with at least 10 gold trading days, and a previous month on file:
- Days are numbered from the end: TD-1 = the month's last gold trading day, TD-3 the third-last, TD-4 the fourth-last.
- Signal, known at the close of TD-4: D = ln(gold close TD-4 / gold close of the previous month's last day)
  − ln(S&P close TD-4 / S&P close of the previous month's last day). The S&P close used is its last close at or before that
  gold day's date.
- **Side** d = −sign(D): equities outran gold → buy gold; gold outran equities → sell gold. D = 0 → no trade.
- Entry: TD-3's open. Stop: 1.5 x ATR from the entry (every trade has a stop), ATR = mean true range of the 20 folded days
  before TD-3. No target. Exit: TD-1's close.
- Stop on daily candles: if a day opens beyond the stop, filled at that open; else if the day's low (buy) / high (sell) touches
  the stop, filled at the stop.
- R = d x (exit − entry) / (1.5 x ATR).
- **Baseline**: the identical TD-3-open to TD-1-close trade with the same stop rule taken in EVERY eligible month of the window,
  buy side and sell side separately: b_long, b_short = mean net R a trade of those unconditional trades in that window.

## Costs
- $0.60 a round trip, in R as 0.60 / risk.
- Buys also pay overnight financing: `nights(entryTime, exitTime)` x `FIN.xau.long` x entry / risk (`council/fills.mjs`, today's
  demo rate used for every year). Sells pay and earn nothing.
- Reported: the cost share, the median stop in dollars, and every figure at 2x costs.

## Tests (Holm over three)
- **T1 (primary, both sides)**: every month with a signal, excess_i = net R_i − b_side (the window's own same-side baseline).
  Statistic: t of the calendar-month sums of excess (every calendar month in the window counts, zero when no trade).
- **T2**: the large gaps only, |D| >= 0.04 (four percent), same excess statistic.
- **T3**: buy side only (equities outran gold), excess over b_long.
Raw net R, gross R, n and month t of the raw net are reported beside each.

## Pass bar (decided now)
T1 passes only if all hold: out-of-sample excess month t >= 2 with Holm-adjusted p < 0.05 over the three tests; in-sample
excess of the same sign; out-of-sample raw net R a trade > 0 at 2x costs; and the out-of-sample excess t beats at least 38 of
the 40 placebos. T2 / T3 can only describe where an effect sits; they cannot pass the study alone.

## Placebo
40 seeded draws (mulberry32, seeds 1..40): in each, every out-of-sample month keeps its trade but its side is drawn at random
with the same buy / sell split as T1, scored by the T1 statistic. Reported: the placebo t distribution and how many the real
T1 beats.

## What would not be done
No threshold, window, stop, exit or market is changed after the first run. A failed result is reported as failed; no variant is
called an edge. Nothing in `council/`, `ict/` or the page changes.
