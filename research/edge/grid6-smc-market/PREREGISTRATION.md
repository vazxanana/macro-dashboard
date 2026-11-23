# Grid 6: smart-money combinations with market and trade-through entries (pre-registration)

Written 23 Nov 2026, before any run. Research only: nothing live changes, nothing is placed.

## Why

The two smart-money studies of 23 Nov (`smc-sweep-fvg`, `smc-ob-fvg`) each tested one standard reading and failed; both used
resting limits. Since then `dom-placebo` and `dom-trade-through` showed that a limit filled on a mere touch of a mid candle
earns about +0.05R by itself. This grid asks the wider question once, with honest fills: does ANY combination of a
higher-timeframe point of interest, a liquidity sweep, a lower-timeframe confirmation, the premium / discount side and the
session pick trades that make money before costs, on 2010-2019, with a market entry or a limit that fills only when price
trades through it?

## Data

OANDA mid 5-minute candles of xau, eurusd, gbpusd, usdjpy and audusd from the `edgekit` cache, 2009-01-01 (warm-up) to
2019-12-31; H1, H4 by `resample`, trading days by `dailyNY`, M15 by `resample`. A trade counts by its fill time,
2010-01-01 to 2019-12-31. Discovery 2010-2014 (60 months), confirmation 2015-2019 (60 months). Data-quality exclusions:
`research/edge/combo-grid-2/run.mjs` `exclusions()` (a signal or fill inside an excluded interval is dropped). Costs:
`research/edge/combo-grid-2/run.mjs` `COSTS` (round trip in price units).

Every reading below uses only candles CLOSED by the moment it is read. Every trade has a stop on its losing side.

## The pieces

**Signal moment.** A confirmation (below) on the M15 or M5 chart, side s (buy +1 / sell -1), at the close tc of its candle.
Everything else is read at tc.

**Point of interest (5).** A zone of side s on H4 or D1, formed (known) before tc, still alive at tc, that price traded into
during the 12 hours before tc (a 5-minute low at or below its top for a buy, a high at or above its bottom for a sell, after
the zone was known):
- `ob4`, `ob1d`: order block = `research/edge/smc-ob-fvg/run.mjs` `obZones` on H4 / D1 (the last opposite candle before the
  impulse of a structure break with a gap in the leg, wick to wick); alive until a close of its timeframe through the far
  side or 120 candles of its timeframe (`deathOf`).
- `fvg4`, `fvg1d`: fair-value gap on H4 / D1: candles k-1, k, k+1 with low[k+1] > high[k-1] (buy; sell mirrors); zone =
  the gap; known at the close of k+1; alive until a close through the far side or 120 candles.
- `eg1d`: the Daily engulf zone of `research/edge/combo-grid-3/run.mjs` `buildZones('eg', D1)` (alive while `at <= tc < end`).

**Liquidity (4).** A sweep of side s whose M15 candle closed in (tc - 12 h, tc]: an M15 candle that trades through the pool
level and closes back (below the level then a close above it, for a buy):
- `pd`: the previous trading day's low (high), live through the current trading day;
- `asia`: the low (high) of 00:00-07:00 UTC, live from 07:00 to 21:00 UTC that day;
- `eq`: relative equal lows (highs): two H1 swing lows (3 candles a side) within 0.1 x ATR(14) of the last closed trading
  day, neither traded through since; level = the lower of the two; live until traded through, at most 10 days;
- `none`: no sweep required.
A pool is used up by the first M15 candle that trades through it (sweep or not). The sweep's extreme = the lowest low
(highest high) of the 5-minute candles from the sweep candle's start to tc.

**Confirmation (6)** on M15 or M5 (`tf` x `kind`):
- `choch`: a change of character: `edgekit` `structure(chart, 3)` event of kind ChoCh in direction s;
- `ifvg`: a close through an opposite gap: a gap against s (three-candle, as above) formed within the last 48 candles of the
  chart, and the first close beyond its far side (above its top for a buy);
- `disp`: a displacement candle: body over 1.5 x ATR(14) of the confirmation chart, in direction s.

**Premium / discount (2).** `with`: the close at tc in the discount half (buy) / premium half (sell) of the range between
the latest H4 swing high and swing low (3 a side) confirmed by tc; `any`.

**Session (4)** by the UTC hour of tc: `lon` 07-12, `ny` 12-17, `other`, and `any`.

**Entry (2).**
- `mkt`: market at the open of the first 5-minute candle starting at or after tc.
- `lim50`: a limit at the 50 % of the most recent same-side gap of the confirmation chart formed within its last 24 candles
  up to tc, whose 50 % no later candle up to tc reached, on the near side of the tc close (below it for a buy). It fills
  only on a 5-minute candle that trades THROUGH the limit by half the round-trip cost (`dom-trade-through` `findFill`,
  rule 'through', threshold COSTS / 2), at the limit (or a better open); it lives 12 candles of the confirmation chart and
  is cancelled by a close past the stop. On the fill candle only the stop counts. No such gap: no limit trade.

**Stop (2).** `sweep`: past the sweep's extreme by half the round-trip cost (only with a liquidity sweep); `swing`: past the
extreme of the last 12 confirmation-chart candles up to tc by half the round-trip cost. The risk at the order (tc close or
the limit) must be at least 2 costs, at the fill at least 1 cost and positive, else no trade.

**Exit (5).** `1R`, `2R`, `3R` targets; `opp`: a target at the previous trading day's high (low for a sell), only when it is
1R or more beyond the fill (else that exit takes no trade); `trail`: no target, a stop trailed 1R behind the best price
from +1R. All with the stop, a 24-hour limit from the fill (exit at that candle's close), gaps at the open, a candle holding
both stop and target is a stop (`dom-trade-through` `manage`, copied from grid 3's `multi`).

Cells: 5 POI x 6 confirmations x 2 premium / discount x 4 sessions x 2 entries x 5 exits x (liquidity `none` with the swing
stop + 3 sweeps x 2 stops) = 16,800 per scope; scopes = pooled and each of the five markets: 100,800 cells. Trades are not
limited to one at a time (as the earlier grids); the month-sum t absorbs clustering within a month.

## The bar (judged BEFORE costs; after costs beside with the same bar)

Statistics on calendar-month sums of R (every month of the window counted, an empty month 0; t = mean / (sd / sqrt(60))).
1. Discovery 2010-2014: n >= 100, mean R a trade > 0, month t >= 2.
2. Confirmation 2015-2019, discovery winners with n >= 100 in confirmation: mean R > 0, month t >= 2, and the one-sided p of
   the confirmation month t (df 59) below 0.05 after Holm over every such discovery winner.

PASS = one or more cells confirmed after Holm; FAIL = none; INCONCLUSIVE = fewer than 100 cells reach n >= 100 in discovery.
Reported beside: cells tested, discovery winners, raw confirmations (step 2 without Holm) against the count expected by
chance (winners x 0.0228), which pieces the winners and confirmations come from, the after-cost bar, and the
**side-flipped placebo**: for every real trade, at the same tc, a market trade of the opposite side with the same stop
distance (from the next open), the same exits (its `opp` = the previous day's low for a flipped buy), run through the same
bar. If the placebo confirms about as many cells as the real grid, the pieces carry no direction.

A pass is a before-cost tilt on these years, never an edge; the after-cost figures say whether it pays its costs.

## Checks

A cut test on one market: the trades built on candles cut at 2015-01-01 equal the full run's trades whose order life and
time limit end before the cut. Offline test `tests/grid6-smc-market.test.mjs`: the cell count, pieces on hand-made candles,
no look-ahead on seeded candles, the bar on a hand-made accumulator, and RESULT.md pinned to result.json.
