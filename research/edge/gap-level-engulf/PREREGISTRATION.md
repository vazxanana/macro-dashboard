# Pre-registration: opening gaps as key levels, entered on an M15 engulf (24 Nov 2026)

Written and committed alone before `run.mjs` is run on any real candle. Research only: nothing live changes, no rule is
proposed, no order code is touched.

## Why

The weekly opening gap (the last price before the weekend to the first price after it) and the daily opening gap (across the
17:00 New York roll) are often drawn as key levels: price is expected to react when it comes back to the gap. The repository
has tested gaps as a fade or a follow at the reopen (`fx-weekend-gap` and its replications and `-exec`, `gold-weekend-gap`,
`index-weekend-gap`, `gold-gap-open`, `gap-fill`, `eu-gap-fade`, `weekend-gap-late-entry`), the weekly open as a level on gold
(`gold-weekly-open`), opening prices as levels (`fade-at-opens`), and whether an ICT A-setup's sweep ran into an open gap
(`ict-nwog`). None of them tested the combination here: the gap's RANGE as a zone, a return to it later in the week, and an M15
engulf away from it as the entry. That combination is untested, so it is run as assigned.

## Data

OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs` `load`), five markets: xau, eurusd, gbpusd,
usdjpy, audusd (gold's history starts March 2006). Costs: `research/edge/combo-grid-2/run.mjs` `COSTS` (round trip, price
units, the same for every year), charged on every trade. Mid candles: the spread at a reopen is not in them.

Windows by the fill time: **discovery 2005-01-01 to 2014-12-31**, **confirmation 2015-01-01 to 2026-10-31**.

## The rule (closed candles only)

**Gaps**, read on the 5-minute candles. A hole is the time between one candle's end and the next candle's start.
- **Weekly gap**: a hole of 40 hours or more (the weekend, or a longer closure). Range = from the close of the last candle
  before the hole to the open of the first candle after it.
- **Daily gap**: at a 17:00 New York roll that is not a weekly gap: the last candle ending at or within 30 minutes before the
  roll, and the first candle starting at or within 3 hours after it, the hole under 40 hours. Range = that close to that open.
  (A closure between 3 and 40 hours is neither kind.)
- **Size filter**: only a gap larger than 0.1 x the Daily ATR(14), the plain mean of the true range of the last 14 trading days
  (17:00 New York days, edgekit `dailyNY`) that had ended by the gap's opening candle. Fewer than 15 days of history: no gap.
- **Life**: from its opening candle until the start of the next hole of 40 hours or more (the rest of that week), both kinds.

**Return and entry**, on M15 candles (UTC 15-minute buckets of the 5-minute candles; the newest, possibly unfinished bucket
is never read). Gap range = [lo, hi].
1. **Armed**: a closed M15 candle wholly outside the range. Wholly above (low > hi) arms a BUY (the gap is support below);
   wholly below (high < lo) arms a SELL. The newest such candle decides the side.
2. **Visit**: the first later M15 candle that trades into the range (low <= hi and high >= lo) starts a visit of at most 8 M15
   candles, that candle included.
3. **Entry**: the first candle of the visit that completes an engulf in the armed direction (`council/eg-methods.mjs`
   `engulfAt`, imported, its span of 3: a candle closing beyond the high / low of the last candle of the other colour at most
   three candles back) and does not close beyond the gap's far side (a buy: close >= lo; a sell: close <= hi). A visit candle
   that closes beyond the far side before an entry ends the visit with no trade. One entry a visit at most; after a visit
   (trade or not) the gap must be armed again by a new candle wholly outside it. A gap may give several visits in its week.
4. **Order**: market at the open of the first 5-minute candle starting at or after the entry candle's close, and before the
   gap's life ends (else no trade). **Stop** past the gap's far side by 0.1 x ATR(14) of M15 (plain mean of the true range of
   the 14 M15 candles ending with the entry candle): a buy's stop = lo - buffer, a sell's = hi + buffer. Every trade has its
   stop on the losing side; a fill at or beyond the stop, or a risk not larger than the market's round-trip cost, is no trade.
5. **Exit**: target 1R or 2R from the fill (the two cells), the stop, or 24 hours after the fill (out at the close of the
   5-minute candle that reaches it). Stop first when one 5-minute candle holds stop and target; a candle that opens past the
   stop or the target exits at its open. Trades overlap freely.

## Cells (4, fixed here)

| cell | gap | target |
|---|---|---|
| weekly 1R | weekly | 1R |
| weekly 2R | weekly | 2R |
| daily 1R | daily | 1R |
| daily 2R | daily | 2R |

All five markets pooled in each cell. No other variant will be run; nothing is tuned after the first run.

## Pass bar

A cell passes when, in BOTH windows: n >= 300, mean R AFTER costs > 0, and the t of calendar-month sums of after-cost R
(every calendar month of the window from the first month a market has candles, empty months as 0) is at least 2; and its Holm-adjusted
one-sided p (from the confirmation month t, over the 4 cells) is under 0.05.

Verdict: **PASS** if any cell passes; **INCONCLUSIVE** if no cell reaches n >= 300 in both windows; otherwise **FAIL**.

## Reported

For every cell and window: n, win share, mean R before costs, mean R after costs, month t before and after costs, Holm p; the
same per market (context only, no verdict); how many gaps passed the size filter per market and kind, and how many gave a
trade. A seeded-candle test checks that signals do not change when later candles are cut or changed, and that every stop
is on the losing side.

Expected weakness, said before the run: on forex the 17:00 New York roll has no closure in these candles, so daily gaps over
0.1 x ATR will be rare outside gold; the daily cells may be too thin to judge.
