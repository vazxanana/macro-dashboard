# Liquidity sweep, change of character, fair value gap (pre-registration)

Written 23 Nov 2026, before any run of this study. The standard public "smart money concepts" entry model, written as fixed
rules: the H4 structure gives the side, price sweeps a liquidity pool, M5 changes character leaving a fair value gap, and a
limit rests in that gap. Nothing in this repository has tested this exact chain (the ICT desk's iFVG model is a different,
separate edge and is not read here). Research only: nothing live changes whatever the result.

**Data**: OANDA mid 5-minute candles, `edgekit` cache: xau, eurusd, gbpusd, usdjpy, audusd. Signals 2010-01-01 to
2019-12-31 (candles from 2009 for warm-up). H1 and H4 = `edgekit.resample` (UTC buckets); trading days = `dailyNY`.
Costs = combo-grid-2 `COSTS` (round trip in price units); data-quality exclusions as grid 3 (a signal inside an excluded
interval is dropped). Discovery 2010-2014, confirmation 2015-2019.

## The rule (buy; a sell mirrors every step)

1. **Side**: `edgekit.structure(H4, 3).side` of the last H4 candle closed by the sweep candle's close is +1 (last H4 break
   of structure up). Side 0 or -1: no buy.
2. **Liquidity pools** below price, each alive from the moment it is known until a candle trades below it:
   - an H1 swing low (3 candles a side, `edgekit.swings(H1, 3)`), known at its confirmation close;
   - the Asia low: the lowest low of the M5 candles 00:00-07:00 UTC of the UTC day, known at 07:00 UTC, swept only on H1
     candles of that UTC day starting 07:00-20:00;
   - the previous day low: the low of the previous `dailyNY` trading day, known at that day's close, swept only during the
     next trading day.
3. **Sweep**: the first H1 candle that trades below an alive pool; it is a sweep when it CLOSES back above the pool level
   (a close below takes the pool with no signal). One signal per H1 candle and side (the pools it swept are recorded; the
   label is the first of: previous day low, Asia low, H1 swing low). Sweep extreme = the lowest M5 low inside that H1 candle.
4. **Change of character (CHoCH)**: from the M5 candle after the extreme, keep the most recent M5 swing high (2 candles a
   side, confirmed before the candle being read) made after the extreme and not yet closed above. The CHoCH is the first M5
   candle that closes above it AND closes at or after the sweep H1 candle's close (a close above it inside the sweep hour
   only uses that swing up). Window: 48 M5 candles after the sweep H1 candle's close. A close below the running extreme
   (the lowest low since the sweep candle) cancels.
5. **Fair value gap**: among M5 candle triples (k-2, k-1, k) with k after the extreme and at or before the CHoCH candle and
   low[k] > high[k-2], the most recent one whose 50 % level has not been traded to by any candle after k up to the CHoCH
   close. None: no trade. Gap = high[k-2] (bottom) to low[k] (top).
6. **Order** at the CHoCH close: a buy limit at the gap's 50 % (variant: its near edge = top); stop = the running extreme
   (lowest low from the sweep candle to the CHoCH candle) minus half the round-trip cost; the order lives 24 M5 candles
   (2 hours) and is cancelled by an M5 close below the stop (grid 3's `multi()`). A trade whose risk (entry - stop) is under
   one round-trip cost is skipped. Exit after 24 hours if neither stop nor target is reached. Fills, stops and exits by grid 3's
   `multi()` on M5 (the fill candle can only stop the trade). One order or position at a time per market and stream: a signal
   is skipped while the previous order of that stream is resting or its trade is open.
7. **Targets**: 2R (T1, T2); the opposite liquidity pool (T3) = the nearest of the previous day high and the alive H1 swing
   highs (3 a side, confirmed by the CHoCH close) above the entry that is at least 1R away and at most 10R away; none: no T3
   trade.
8. **Premium / discount (T2)**: the H4 dealing range = the most recent confirmed H4 swing high and swing low (3 a side) at
   the CHoCH close; a buy only when the entry is below its middle (a sell only above it).

## Placebo (the resting-limit control of `dom-placebo`)

For each real trade, at the same CHoCH close and on the same side, one M5 candle drawn with a seeded generator
(`edgekit.rng`, seed from the market name and stream) among the 24 M5 candles before the CHoCH candle with the trade's colour
(bullish for a buy) whose body's 50 % is below the CHoCH close and has not been traded to by a later candle up to the CHoCH
close. Limit at that body's 50 %, stop at the SAME price distance as the real trade, the same life, cap and skips; target 2R
(T1, T2) or the same R multiple as the real trade's opposite pool (T3). None: no placebo for that trade. The placebo trades
are their own stream with the same one-at-a-time rule.

## Tests (judged BEFORE costs, the owner's basis; after costs beside), pooled five markets

- **T1**: the base model, 50 % entry, 2R target.
- **T2**: T1 with the premium / discount filter.
- **T3**: the base model with the opposite-pool target.

Each test passes only if ALL hold: (a) mean R > 0 with calendar-month-sum t >= 2 in 2010-2014 AND in 2015-2019; (b) the
pooled 2010-2019 month-sum t's two-sided p, Holm-adjusted over the three tests, is under 0.05; (c) its mean R beats its
placebo's by Welch t >= 2 (per trade, 2010-2019). Verdict PASS if any test passes, FAIL if none; INCONCLUSIVE if a test has
fewer than 100 trades in either half.

Reported, not tested: per market; by session of the CHoCH (London 07-12, New York 12-17 UTC, other); by pool type; the
near-edge entry; the model without the H4 side (both sides of every sweep); after-cost figures. Nothing is tuned after the
run; a pass would be a before-cost tilt for a holdout test, never an edge by itself.
