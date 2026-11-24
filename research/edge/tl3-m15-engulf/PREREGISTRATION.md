# H1 trendline, third touch, M15 engulf away from the line: pre-registration (24 Nov 2026)

Written before any code of this study exists and before any candle was read for these rules. Research only: nothing live
changes, no rule is proposed, no order code is touched. Every number below is fixed now and is not changed after the run.

## Why, and what is already known
The assigned combination: a straight H1 trendline through two confirmed swing points, entered on its THIRD touch when a
15-minute engulf closes away from the line, compared with the same engulf taken with no trendline at all.

Already tested in this repository (checked first):
- `trendline-qm` (gold, break / retest / M15 QM, 2010-26): INCONCLUSIVE, too rare, negative where it had trades.
- `tl-third-touch` (gold, third touch of a pullback line inside an H4 engulf zone, 2020-26): FAIL.
- `trendline-engulf-2020` rule A (third touch with an engulf on the line's OWN timeframe, H1 and H4, 18 markets,
  2020-26): FAIL (H1: -0.050R a trade after costs in 2024-26, n 4,024).

So the third touch with a same-timeframe engulf is already answered on 2020-26. This study is the nearest untested
variation, which is also the assigned one: the trigger one step lower (M15, so the stop is the touch itself, not an H1
candle), a longer line (at least 12 H1 candles between the two swings), the long windows 2005-14 / 2015-26, a second
exit at the last swing, and a control stream (every M15 engulf, no line) run through the same engine. I expect it to
lose after costs, like every trendline and engulf entry measured here so far.

## Data
- OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs` `load`), 2004-01-01 (warm-up) to
  2026-11-01, grouped to UTC M15 and H1 with `resample`. Read only, no network.
- Markets (5, pooled, equal weight a trade): xau, eurusd, gbpusd, usdjpy, audusd (gold's candles start in March 2006).
- A trade belongs to the window of its fill. **Discovery 2005-01-01 to 2014-12-31 (120 months); confirmation 2015-01-01
  to 2026-10-31 (142 months).**
- A trade whose fill falls in a bad interval of the data-quality audit is dropped (`exclusions` of `combo-grid-2`).
- Costs: `COSTS` of `research/edge/combo-grid-2/run.mjs` (round trip, price units; the demo's measured figures for these
  five markets, the same for every year), taken off each trade in R as cost / initial risk.

## Definitions (closed candles only)
- **ATR**: the simple mean of the last 14 true ranges up to and including the candle it is read at (H1 or M15).
- **Swings**: toolkit `swings(H1, 3)` (wicks, 3 candles a side), usable from the close of their confirmation candle.
- **Rising line (buys)**: each time an H1 swing low B is confirmed, the straight line through the swing low confirmed
  right before it (A) and B, by H1 candle index, extended right, accepted when B is higher than A, B is at least 12 H1
  candles after A, and no H1 candle from the one after A up to B's confirmation candle closed below the line. An accepted
  line replaces any rising line still standing. **Falling line (sells)**: the mirror through two swing highs, B lower
  than A, no close above it. At most one rising and one falling line stand at a time.
- **A line ends** at the first later H1 close through it (below a rising line), 150 H1 candles after B, when a newer
  accepted line replaces it, or when it is spent (below).
- **Line value for an M15 candle**: the line at the index of the H1 candle that holds that M15 candle.
- **Third touch** (A and B are the first two): the first M15 candle starting at or after the close of B's confirmation
  candle whose low is at or below the line + 0.10 x H1 ATR (read at B's confirmation candle); for a falling line, whose
  high is at or above the line - 0.10 x that ATR. One touch a line: the line is spent at this touch whatever follows.
- **Trigger**: the first M15 candle j, touch <= j <= touch + 3, that completes an engulf away from the line
  (`engulfAt(M15, j, 3)` of `council/eg-methods.mjs`: j closes beyond the high, for a buy, of the last candle of the other
  colour within the 3 candles before it; a rising line needs a buy engulf, a falling line a sell engulf). If any M15
  candle from the touch up to j closes through the line, or no engulf comes by touch + 3, there is no trade.
- **Entry**: market, at the open of the first 5-minute candle starting at or after the close of j.
- **Stop**: beyond the extreme of the M15 candles from the earlier of (the touch candle, the engulf's base candle) to j
  (the lowest low for a buy) by 0.10 x M15 ATR read at j. Every trade has its stop on the losing side of the fill; a fill
  at or past the stop is no trade; a trade whose initial risk is under 3 x the round-trip cost is skipped.
- **Exits** (two, on the same fill and stop): **2R**; **swing** = the most recent of the last 5 confirmed H1 swing highs
  (swing lows for a sell; confirmed by the start of candle j) that is at least 0.5R beyond the fill; none = no trade in
  the swing cell. Both: out at the close of the first 5-minute candle closing 48 hours or more after the fill. Stop first
  when one 5-minute candle holds stop and target; a 5-minute candle that opens past the stop or the target exits at its
  open. A trade still unresolved at the end of the data is not counted.
- Every signal is a trade (positions may overlap), as in the other pooled studies here.
- **Control (no trendline)**: EVERY M15 candle j that completes an engulf (`engulfAt(M15, j, 3)`, either side), entered,
  stopped (extreme of the candles from the engulf's base to j, same buffer, same 3 x cost skip) and exited exactly as above.

## Cells (4, fixed)
| Cell | Stream | Exit |
|---|---|---|
| line 2R | trendline third touch + M15 engulf | 2R |
| line swing | trendline third touch + M15 engulf | last H1 swing |
| control 2R | every M15 engulf | 2R |
| control swing | every M15 engulf | last H1 swing |

## Statistic and pass bar
Mean R a trade AFTER costs; t on calendar-month sums of after-cost R by fill month, every month of the window counted
(empty months zero). A cell passes only if all hold: n >= 300 in each window; mean R after costs > 0 and month t >= 2 in
discovery AND in confirmation; Holm-adjusted one-sided p < 0.05 over the four cells in confirmation.

## Verdict (from the two line cells)
- **PASS**: a line cell passes.
- **INCONCLUSIVE**: no line cell passes and both line cells have fewer than 300 trades in either window.
- **FAIL**: otherwise.
A control cell passing is reported and is not a verdict of this study.

## Reported
For every cell, each window: n, mean R before costs and after costs, month t before and after costs, win rate, mean cost
in R, Holm p. Line minus control (after costs, Welch t on trades) for each exit and window: does the line pick better
engulfs? The line cells by market and by side (descriptive). Counts: lines accepted, touched, cancelled by a close
through, without an engulf, dropped, skipped. A cut test: the signals known by a date computed on candles cut at that
date equal the full run's.

One run. No variant (other swing sizes, distances, tolerances, spans, targets, markets or years) is run after the result.
Results go in `RESULT.md` and `result.json`; this file is not edited after the first result except for a dated note.
