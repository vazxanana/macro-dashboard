# Pre-registration: the weekly-structure daily rejection rule (long and its mirror short) on 17 markets, 2020-now (23 Nov 2026)

Written and committed before any number of this rule on these 17 markets for 2020-now is computed.

## Why
The owner's notes call this gold rule their best tested one. Its gold record is already in the repository and is not new
evidence: `gold-drd-long` (FAIL: profitable out of its own sample on 2006-2022 but not better than buying every bullish-week
day, lift t 1.58), `gold-drd-er` (FAIL, a Daily-regime cut), `gold-drd-silver` (passed its trade-count bar, not robust on month
sums) and `gold-drd-pgm` (FAIL on platinum and palladium). The question here: does the plain rule, and its mirror sell, make
money after costs on the OTHER markets of the desk's candle cache in 2020-now, judged on calendar-month sums?

## Rule (gold-drd-long's functions, imported, never edited)
- **Days**: 17:00 New York trading days built from H1 candles (`days`, weekend hours dropped). H1 candles are the cache's OANDA
  mid 5-minute candles grouped into whole UTC hours.
- **Weekly structure** (`weeks`, `weekState`): weeks Monday-based on those days; 2-bar fractal weekly swing highs / lows
  (confirmed two weeks later); bullish after a weekly close above the last swing high, bearish after one below the last swing
  low, else unchanged. Read on the last COMPLETED week before the signal day.
- **Long (T1)**: weekly structure bullish; the signal day closes above the previous day's low and in the top 30 % of its own
  range. Buy the open of the next day's first H1 candle; stop under the signal day's low by a buffer; target 3R; out at the
  close of the 10th day after the signal day; stop first when one H1 candle holds both (`simulate`, a gap through the stop
  fills at the open).
- **Short (T2)**: the mirror: weekly structure bearish; the signal day closes below the previous day's high and in the bottom
  30 % of its range; sell the next day's first open; stop above the signal day's high by the buffer; 3R; 10 days.
- `signals(ds, wk, wst, 0.7, side)` and `simulate(..., 3, side)` of gold-drd-long give the signals and trades; only the stop is
  re-priced with the per-market buffer below (the imported code's fixed $0.30 buffer is gold's), as `gold-drd-pgm` did.
- Each signal is its own trade (overlapping positions allowed, as in every earlier study of this rule).
- A signal counts only when its 10th day is a complete day on file (no trade is booked on a truncated window).

## Per-market scaling (stated here, before any result)
- **Buffer**: 0.01 % of the signal day's low (long) or high (short). Gold's $0.30 on gold near $3,000 is that share; it is the
  rule `gold-drd-pgm` used.
- **Cost**: the desk's round-trip cost per market in price units, `COSTS` of `research/edge/combo-grid-2/run.mjs` (spread +
  commission of the demo account; assumed for the markets the demo was not measured on), charged on every trade as
  cost / risk in R. A 2x cost run doubles it.
- Trades whose fill falls in a bad-data interval of `research/edge/data-quality/quality.json` (`exclusions()`) are dropped.

## Markets and windows
The 17 markets of the cache other than gold: eurusd gbpusd usdjpy audusd nzdusd usdcad usdchf eurjpy xag gbpjpy eurgbp audjpy
cadjpy euraud nas100 spx500 de40. Candles loaded from 2019-01-01 (a year of warm-up for the weekly structure; eight of the
markets start in 2019), trades with an entry from 2020-01-01 to the last candle. Discovery 2020-2023 (entries), confirmation
2024-01-01 to now.

## Tests (two, Holm over the two)
- **T1**: longs pooled over the 17 markets. **T2**: shorts pooled over the 17 markets.
- Statistic: the t of the **calendar-month sums** of net R (all trades of all 17 markets summed by the month of their entry;
  months with no trade count as 0 between the first and last month), two-sided p from the t distribution.
- A test PASSES only if ALL of: discovery n >= 100, mean net R a trade > 0, month-sum t >= 2; confirmation n >= 50, mean net R a
  trade > 0, month-sum t >= 2 and its p Holm-adjusted over T1 and T2 < 0.05; mean net R a trade > 0 at 2x costs in discovery
  AND in confirmation.
- **Verdict**: PASS if at least one test passes; INCONCLUSIVE if neither passes and a test has too few trades for the bar; FAIL
  otherwise. A pass is a proposal to the owner, nothing more.

## Reported, not tested
Per market, longs and shorts: n, mean net R, total, month-sum t, win rate, at 2x cost, by window; the baseline (every day of
the same weekly side) and the lift as in gold-drd-long; year by year; the trade-count t. **Gold 2020-now** with the same columns
as a known in-sample row only (gold-drd-long already covers it), never part of a test. A cut test: the signals before a cut
must not change when every later candle is removed.

## Data
OANDA mid 5-minute candles of the desk's cache (`research/edge/_lib/edgekit.mjs` `load`), outside git. Nothing live changes
whatever the result.
