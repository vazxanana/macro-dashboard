# Trendline third touch and trendline break-and-retest, each with an engulf trigger: pre-registration (23 Nov 2026)

Written before any code of this study exists and before any candle was read for these rules. Research only: nothing live
changes, nothing is proposed until this has a result, and the owner decides any use. The rules are one school's trendline
entries in the owner's notes, written here in this repository's own words and made mechanical; every number below is fixed
now and is not changed after the run.

## Question
A straight trendline through two swing points, then (a) the third touch of the line with an engulf in the line's trend
direction, or (b) a close through the line, a retest of it and an engulf the other way: does either give trades that make
money after costs, pooled over 18 markets, on H4 and on H1?

## Data
- OANDA mid 5-minute candles from the shared toolkit cache (`research/edge/_lib/edgekit.mjs` `load`), loaded from
  2019-06-01 (warm-up) to the last cached candle, grouped to UTC H1 (3,600 s) and H4 (14,400 s) with `resample`.
- Markets (18, pooled with equal weight per trade): xau eurusd gbpusd usdjpy audusd nzdusd usdcad usdchf eurjpy xag gbpjpy
  eurgbp audjpy cadjpy euraud nas100 spx500 de40.
- Trades count from 2020-01-01. Discovery 2020-01-01 to 2023-12-31; confirmation 2024-01-01 to the last candle.
- Data quality: a trade whose fill falls in a bad interval of `research/edge/data-quality/quality.json` is dropped
  (`exclusions` of `research/edge/combo-grid-2/run.mjs`).
- Costs: the round trips of `COSTS` in `research/edge/combo-grid-2/run.mjs` (price units), taken off each trade in R as
  cost / initial risk.

## Definitions (each on the test's own timeframe, H4 or H1; closed candles only)
- **ATR**: the simple mean of the last 14 true ranges up to and including the candle it is read at.
- **Swings**: toolkit `swings(bars, 3)` (wicks, 3 candles a side), usable from their confirmation candle `ci`.
- **Falling line**: whenever a swing high B is confirmed, the line through the previous confirmed swing high A and B, when
  B is lower than A; **rising line**: the mirror through two swing lows, B higher than A. The line is the straight line
  through the two wick prices, by candle index, extended right.
  - Accepted only if B.i - A.i is 5 to 100 candles; the slope's size per candle is 0.02 to 0.50 x ATR (read at B's
    confirmation candle); and no candle from A.i + 1 to the confirmation candle closes beyond the line (above a falling
    line, below a rising line).
  - Several lines may be live at once. A line lives from its confirmation candle until it is broken (below), spent (below),
    or 150 candles after B.
- **Break**: the first candle after the confirmation candle that closes beyond the line (above a falling line, below a
  rising line). A broken line gives no third-touch setup; it may give a break-and-retest setup.

## Rule A: third touch (with the line's trend)
- **Touch**: the first candle after the confirmation candle whose wick reaches the line within 0.10 x ATR (a falling line:
  high >= line - 0.10 ATR; a rising line: low <= line + 0.10 ATR) and that does not close beyond it. One touch per line:
  the line is spent at that touch whatever follows.
- **Trigger**: an engulf in the line's trend direction (a falling line: a sell; a rising line: a buy) completed by candle j,
  touch <= j <= touch + 3, read with `engulfAt(candles, j, 3)` of `council/eg-methods.mjs` (the last candle of the other
  colour within 3 candles before j, and j closes beyond its low for a sell / its high for a buy), with its base candle at
  index >= touch - 3, and no candle from the touch to j closing beyond the line. The first such j is taken; none = no trade.
- **Entry**: market at the open of the first 5-minute candle starting at or after the close of j.
- **Stop**: beyond the extreme of the candles touch..j (the highest high for a sell, the lowest low for a buy) by 0.10 x ATR
  (read at j). Every trade has its stop on the losing side; a trade whose initial risk is under 3 x the round-trip cost is
  skipped.
- **Target**: 2R. **Time exit**: the close of the first 5-minute candle closing at or after 48 candles of the test's
  timeframe after the fill. Stop first when one 5-minute candle holds both. A 5-minute candle opening past the stop or
  target exits at its open.

## Rule B: break and retest (the reversal)
- **Break** as defined above: a close above a falling line gives a buy setup, a close below a rising line a sell setup.
  One setup per break.
- **Retest**: the first candle among the 12 after the break candle whose wick comes back to the line within 0.10 x ATR (read
  at the break candle): a buy: low <= line + 0.10 ATR. If, before the retest or before the trigger, any candle closes back
  beyond the line (a buy: a close below the line), the setup is cancelled.
- **Trigger**: an engulf in the setup's direction (`engulfAt(candles, j, 3)`), completed at retest <= j <= retest + 3, base
  candle at index >= retest - 3, every close from the retest to j on the setup's side of the line.
- **Entry, stop, target, time exit**: as Rule A (stop beyond the extreme of the candles retest..j by 0.10 x ATR).

## Streams
One position at a time per market and per test (a signal while the market's earlier trade of that test is still open is
skipped). Trades still open at the end of the file are not counted. Buys and sells together.

## Tests (four; Holm over these four on the confirmation one-sided month-sum p)
- **T1**: Rule A on H4. **T2**: Rule A on H1. **T3**: Rule B on H4. **T4**: Rule B on H1.
- Descriptive only (no test, no verdict): gold alone for each test; each test at 1R and 3R targets; by side; by year.

## Statistic and pass bar
Mean R a trade after costs; t of calendar-month sums of R (empty months counted as zero) over each window, trades placed by
their fill month. A test PASSES only if ALL hold:
- discovery: n >= 100, mean R > 0, month t >= 2;
- confirmation: n >= 50, mean R > 0, month t >= 2, Holm-adjusted one-sided p < 0.05;
- mean R > 0 at twice the cost in both windows.

## No look-ahead check
`run.mjs` recomputes the signals of gold and EUR/USD with every candle after a cut date (2023-06-15) removed; every signal
triggered before the cut must be identical. The test file repeats the check on seeded synthetic candles.

## Verdicts
- **PASS**: at least one test passes the bar.
- **INCONCLUSIVE**: none passes and the only line a test misses is a minimum n.
- **FAIL**: otherwise. No variant (other swing sizes, tolerances, slope limits, windows, targets, timeframes) will be run
  after the result.

Results go in `RESULT.md` and `result.json`; this file is not edited after the first result except to add a dated note.
