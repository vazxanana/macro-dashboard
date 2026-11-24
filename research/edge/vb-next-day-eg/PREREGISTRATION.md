# The day after a winning volatility breakout: the first pullback into a fresh H1 engulf zone (pre-registration)

Written 24 Nov 2026, committed alone before any run on real candles. Research only: nothing live changes, no rule is
proposed, no order code is touched. One run, no variants.

## Why

The volatility breakout T1 (gold, USD/JPY) is the one family of the repository that holds at measured costs. Two studies
looked at what follows a breakout on the SAME day and failed: `vb-pullback-fade` (the M15 break fade split by the day's
breakout: WITH-breakout fades -0.088R after costs, FAIL) and `vb-reentry` (the same side again after a stop-out: +0.009R,
FAIL). Neither looked at the NEXT day, and neither used an engulf zone as the place to enter. This study asks one question:
after a day whose T1 breakout filled and closed in profit, does the next trading day continue in that direction from the
first pullback into a fresh H1 engulf zone of the breakout's side?

## Data

OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs` `load`), read only, no network.
Markets: xau, usdjpy, eurusd, gbpusd. H1 candles are the 5-minute candles grouped into UTC hours (`edgekit` `resample`).
Bad-data intervals of `combo-grid-2` `exclusions` are dropped by fill time.

## The rule (every part fixed)

1. **Breakout day D.** The T1 studies' own code, imported and not edited (`index-vol-breakout/original.mjs` `buildDays`,
   `daySkip`, `vbTrade`): k 0.5, both sides, stop at the day's open, out at 21:00 UTC. D qualifies when the breakout
   filled and its result BEFORE costs is above zero (R > 0). Its side S (+1 buy, -1 sell) and fill candle are kept.
2. **Next day N.** The next tradable weekday of `buildDays` after D (not skipped by `daySkip`), at most 4 calendar days
   later (so a Friday pairs with Monday; a longer gap is no pair).
3. **Zones.** H1 engulf zones of side S from `council/eg-methods.mjs` `zones` (imported; its default span of 3 candles;
   only the fields `dir`, `top`, `bot`, `at`, `i` are read, never its look-ahead fields `touch` / `fail` / `end`). A zone
   is a candidate when it became known (`at` = the close of its completing H1 candle) after the close of the breakout's
   5-minute fill candle and before 21:00 UTC of day N.
4. **Fresh.** Walking the 5-minute candles from the breakout's fill onward: a zone is live from the first 5-minute candle
   that starts at or after its `at`. A live zone that a 5-minute candle trades into (a buy zone: low <= top; a sell zone:
   high >= bottom) BEFORE 00:00 UTC of day N is spent and never used.
5. **Entry.** On day N, from 00:00 to 20:55 UTC (candle starts), the FIRST 5-minute candle that trades into any live zone
   is the fill: a resting limit at the zone's near edge (buy: the top; sell: the bottom); with several zones reached by
   that candle, the one nearest the price before it (buy: the highest top). A candle that opens beyond the edge fills at
   its open. One trade a day N at most; after the first fill (or a refused one) the day is done.
6. **Stop.** Past the zone's far edge by 0.1 x the H1 ATR(14) at the zone's completing candle (simple mean of the true
   range of the 14 H1 candles ending with it). No trade when the fill is not on the right side of the stop, or when the
   risk is smaller than the round-trip cost.
7. **Exit.** Target at 1R or 2R (the two cells); the stop; else the close of the last 5-minute candle before 21:00 UTC of
   day N. On the fill candle only the stop counts. Later, a candle that opens beyond the stop exits at its open, a candle
   holding both stop and target is a stop.
8. **Costs** (round trip, price units, charged as cost / risk): gold 0.30 and USD/JPY 0.008 (the desk's demo-account
   figures, rounded up; the same for every year), EUR/USD 0.00006 and GBP/USD 0.00008 (the shared figures of
   `edgekit` `COSTS`). No financing (no trade is held overnight).

## Cells (10)

Each of the four markets x target 1R / 2R (8 cells), and the four markets pooled x 1R / 2R (2 cells).

## Windows

By fill time: discovery 2005-01-01 .. 2014-12-31, confirmation 2015-01-01 .. 2026-10-31 (gold's candles start in 2006).
Both windows were read before by the T1 studies for the breakout itself; the next-day trades are new.

## Pass bar

Per cell: n >= 300 in each window, mean R AFTER costs > 0 with the t of calendar-month sums (months without a trade count
as 0) >= 2 in BOTH windows, and a Holm-adjusted one-sided p < 0.05 over the 10 cells in confirmation.
Verdict PASS when at least one cell passes; INCONCLUSIVE when no cell passes and no cell has n >= 300 in both windows;
else FAIL.

## Reported (not judged)

Before-cost and after-cost R, month t, win rate and mean cost in R for every cell and window; the funnel (breakout days,
winning days, pairs, pairs with a candidate zone, fills, refused); a control: the same rule on the day after a breakout
that filled and did NOT close in profit (side = that breakout's side); a cut test (the trades known at a date, computed on
candles cut there, equal the full run's).
