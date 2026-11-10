# Mosha level reversal: pre-registration

Written and committed on 10 Nov 2026, before any number of this study was computed. Paper research only: no live rule,
size, filter or mirror setting is changed by this study, whatever it finds.

## Why

The owner, 10 Nov 2026, with nine chart screenshots of a gold sell taken that morning (sell 4120.42, stop 4128.92, target
4072.84, about 5.6R, target reached): **"This is how I was expecting Mosha to work."**

The live Mosha BO system (`council/trader.mjs`, user rule `mosha-bo`) is a different trade: H4 BO, then an H1 BO against it,
then an M15 BO back in the H4 direction, in the weekly direction only, limit at the broken M15 level, about 3R. It has
placed no live trade since it was switched on (4 Nov 2026) and could not have taken the owner's trade (wrong side, wrong
timeframe, weekly filter against).

The owner's trade, in the vocabulary of the owner's direction rule book (A-level = swing high, V-level = swing low, BO sell =
a close below the last V-level, external BO = the break of the last level formed BEFORE the tap of a higher-timeframe level):

1. Price taps an H4 key level (the H4 swing high at 4146.9).
2. On M5 price closes below the last V-level formed before the tap (external BO sell): direction is sell.
3. The next M5 BO sell leaves a small zone at its origin. Sell limit at the broken level, stop just above the zone.
4. Target: the H4 barrier on the other side (the H4 bullish engulf zone at 4060-4079).

This study writes that reading down as one mechanical rule and tests it. It is my reading of one example, not the owner's
full discretion: a failure of this rule is a failure of this reading.

## Data

- Spot gold, HistData M1 (`council-data research/candles/xau-histdata`, 2018-01 to 2026-10), converted to UTC with
  `council/histdata.mjs` (the one audited converter), loaded with `research/edge/gold-systems/data.mjs`.
- M5 and H4 candles are built from the M1 file in UTC buckets (H4 at 00, 04, 08, 12, 16, 20 UTC, as the council's feed).
- Fills, stops and targets are judged on M1 candles.
- Evaluation window: orders placed **2020-01-01 to 2026-10-31** (2018-19 is warm-up only). In sample = 2020-01-01 to
  2023-12-31. Out of sample = 2024-01-01 to 2026-10-31. No parameter is fitted on either part: every number below is fixed here.

## The rule (primary, "P"). Sells are written out; buys are the mirror image.

Constants: `W4 = 3` (H4 swing size), `W5 = 1` (M5 swing size), `TOL = 0.05 %` of the level, `PAD = $0.30`,
`BASE = 3` candles, `LEVEL_AGE = 30` days, `EPISODE = 24 h`, `VALID = 24 h`, `HOLD = 72 h`, `MIN_R0 = $1.00`,
`MIN_RR = 2`, `COST = $0.30` a round trip per unit.

1. **H4 key level.** An H4 candle whose high is not below the highs of the 3 candles before it and is above the highs of
   the 3 candles after it is an A-level. It exists from the close of the 3rd candle after it. It is live until an H4
   candle closes above it, or 30 days after it came to exist.
2. **Tap.** The first M5 candle whose high is at or above `level x (1 - TOL)` while the level is live starts an episode
   (one episode per level at a time). The episode's high is the highest M5 high since the tap.
3. **The V-level before the tap.** The most recent M5 swing low (a low not above the low before it and below the low after
   it: a three-candle swing) that already existed (the candle after it had closed) when the tap candle opened.
4. **External BO sell.** The first M5 candle that closes below that V-level, within 24 h of the tap. The episode is
   cancelled if an H4 candle closes above the level first.
5. **Entry BO.** After the external BO candle: the first M5 swing low whose own candle is at or after the external BO
   candle (V2), then the first M5 candle that closes below V2. It must come within 24 h of the external BO, and no M5
   high may exceed the episode's high in between (if one does, the episode is cancelled).
6. **Zone.** Bottom = V2. Top = the highest high of the entry-BO candle and the 3 M5 candles before it.
7. **Order.** Sell limit at V2. Stop = zone top + $0.30. Risk `r0 = stop - entry`; no order when `r0 < $1.00`.
   Valid 24 h from the close of the entry-BO candle. Placed at the close of the entry-BO candle. If the price at that
   close is already above the stop, no order.
8. **Target: the barrier.** An H4 bullish engulf is a green H4 candle that closes above the high of the red H4 candle
   before it. Its zone runs from the lower of the two lows to the red candle's high. A zone is live from the engulfing
   candle's close until an H4 candle closes below its bottom, for at most 30 days. The target is the TOP of the nearest live
   bullish engulf zone whose top is below the entry. No such zone, or a target under `2 x r0` away: no order.
9. **Fill and exit, on M1.** The order fills when an M1 high reaches the entry. If the target trades before the fill, the
   order is cancelled (missed). After the fill: stop when an M1 high reaches the stop (at the stop, or at the M1 open when
   it gaps past); target when an M1 low reaches the target; when both happen in one M1 candle the stop counts. Still open
   72 h after the fill: out at that M1 close. No break-even, no trail, no add.
10. **One at a time.** While an order rests or a position is open, no new order is placed (the episode that would have
    produced one is dropped). A level that produced an order is retired.
11. **Result.** `R = (entry - exit) / r0`, net `R - COST / r0`. Sensitivity at 2 x COST.

## One correction made before this file was committed

The first draft used an M5 swing of 3 candles a side. The implementation check on the owner's own trade (the council's
OANDA candles of 9-10 Nov 2026, the example the rule was read from) showed that draft did not find the trade: the low the
owner boxed before the tap (4125.6, 19:50 UTC on 9 Nov) is a three-candle pullback inside a fast rally, and a 3-a-side swing
skips it and falls back to 4101. `W5` was set to 1 (a three-candle swing), which reads the example as the owner drew it:
external BO at 00:30 UTC, V2 at 4121.6, entry BO at 02:30 UTC, stop above 4128.0, barrier top 4073.4 (the owner's own target
was 4072.84). That is the only change, it was made on the example alone, and no candle of the test file had been read.

## Variants (secondary; reported, labelled, never promoted on their own)

Each changes ONE thing in P:

- **W, wide stop**: zone top = the highest M5 high from V2's candle to the entry-BO candle (the whole origin).
- **T3, fixed target**: target `3 x r0` from the entry, no barrier needed.
- **F, first break**: the order is placed on the external BO itself (step 4): entry at the V-level before the tap, zone top
  = the highest high of the external-BO candle and the 3 candles before it; step 5 is skipped.
- **S, sells only** and **B, buys only**: P split by side (no extra test: a split of P).

Tests counted for multiple comparison: P, W, T3, F (four). Holm correction over those four p-values (one-sided, mean net
R > 0).

## Verdict (fixed here)

On P, net of cost, orders placed 2020-01-01 to 2026-10-31, filled trades only:

- **PASS**: out-of-sample n >= 30; mean net R > 0 in sample AND out of sample; at least two thirds of the out-of-sample
  calendar years with a trade are positive; whole-window t >= 2.0; and mean net R > 0 at 2 x COST.
- **FAIL**: whole-window mean net R <= 0, or out-of-sample mean net R <= 0.
- **INCONCLUSIVE**: anything else (including out-of-sample n < 30).

A variant is reported with the same statistics and its Holm-adjusted p. A variant that looks better than P is a
hypothesis for a new pre-registration, not a result.

Also reported, without a verdict: the funnel (levels, taps, external BOs, entry BOs, orders, fills, missed, expired), the
year table, sides, win rate, average winner and loser in R, profit factor, maximum drawdown in R, the share of orders
where the stop distance is under $3, and whether the detector finds the owner's trade of 10 Nov 2026 on the council's own
OANDA candles (an implementation check on the example the rule was read from, outside the test window's data file).

## What happens next

Nothing changes live on any outcome. On PASS the proposal to the owner is a paper shadow stream first. On FAIL or
INCONCLUSIVE the result is published and the owner decides whether to correct my reading and register a new version.
