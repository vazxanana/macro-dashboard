# Mosha retracement chain: pre-registration

Written and committed on 10 Nov 2026, before any number of this study was computed. Paper research only: no live rule,
size, filter or mirror setting is changed by this study, whatever it finds.

## Why

`research/edge/mosha-level/` tested my first reading of the owner's gold sell of 10 Nov 2026 (a tap of an H4 level, then
M5 breaks). It failed (−0.35R a trade, t −3.10). The owner then corrected the reading, the same day:

> "This is high time frame aligned: after a H4 we can look for H1 to know when the retracement or pullback starts, then we
> use M15 or M5 to trade that retracement or pullback."

So the trade is a chain, not a tap:

1. **H4 BO** sets the direction (the H4 leg).
2. **H1 BO the other way**: the retracement has started.
3. **M5 (or M15)** gives the entry to trade that retracement, toward the H4 barrier.

The live Mosha BO system shares steps 1 and 2 and then does the opposite: it waits for an M15 BO back in the H4 direction and
trades the end of the retracement. This study tests trading the retracement itself.

What I already know, said plainly: I have seen the mosha-level result on this same data. Nothing in this rule was chosen
from that result. Every piece is either the owner's sentence above, the owner's own trade (the example), or carried over
unchanged from the mosha-level pre-registration (zone, stop pad, barrier, cost, fills, window, verdict).

## Data, window, cost, fills

As `research/edge/mosha-level/PREREGISTRATION.md`: HistData spot gold M1 (clock per `council/histdata.mjs`), M5 / M15 / H1 /
H4 candles built from it in UTC buckets, fills and exits on M1, orders placed 2020-01-01 to 2026-10-31, in sample to
2023-12-31, out of sample from 2024-01-01, `COST = $0.30` a round trip, sensitivity at twice that.

## The rule (primary, "P"). Written for an H4 BO buy, so the trade is a SELL; the other side is the mirror image.

Constants: `W4 = 3` (H4 swing size), `W1 = 1` (H1 swing size: a three-candle swing), `BASE = 3` candles, `PAD = $0.30`,
`LEVEL_AGE = 30` days, `VALID = 24 h`, `HOLD = 72 h`, `MIN_R0 = $1.00`, `MIN_RR = 2`.

1. **H4 BO buy.** An H4 A-level is an H4 high not below the 3 highs before it and above the 3 highs after it; it exists from
   the close of the 3rd candle after it. An H4 candle that closes above the most recent existing A-level is an H4 BO buy
   (each level is broken once). H4 BO sells are the mirror image on V-levels.
2. **H1 BO sell: the retracement starts.** An H1 V-level is an H1 low not above the low before it and below the low after
   it; it exists from the close of the candle after it. An H1 candle that closes below the most recent V-level that existed
   when that candle opened is an H1 BO sell (each level is broken once).
3. **The chain.** At an H1 BO sell, look at the most recent H4 BO. If it is a BO buy and no H1 BO sell has been taken
   against it yet, this is the signal. Each H4 BO gives at most one signal: the first H1 BO against it, whether or not an
   order follows. If the most recent H4 BO is a sell, an H1 BO sell is not a retracement and nothing happens.
4. **Entry zone, on M5.** Among the M5 candles from the moment the H1 V-level came to exist to the close of the H1 BO
   candle, the first that closes below the level is the break candle. Zone top = the highest high of the break candle and
   the 3 M5 candles before it. (No such M5 candle: zone top = the high of the H1 BO candle.)
5. **Order.** Placed at the close of the H1 BO candle: sell limit at the broken H1 V-level, stop = zone top + $0.30. Risk
   `r0 = stop - entry`; no order when `r0 < $1.00`. Valid 24 h.
6. **Target: the barrier.** As in mosha-level: the top of the nearest live H4 bullish engulf zone below the entry (a green
   H4 candle closing above the high of the red candle before it; zone = the lower of the two lows up to the red candle's
   high; live from the engulfing candle's close until an H4 candle closes below its bottom, at most 30 days). No such zone,
   or a target under `2 x r0` away: no order.
7. **Fill and exit, on M1.** As in mosha-level: fill when an M1 high reaches the entry; cancelled if the target trades
   first; stop first when one candle holds both; a gap through the stop exits at the open; out at the M1 close 72 h after
   the fill. No break-even, no trail, no add.
8. **One at a time.** While an order rests or a position is open, a new signal places nothing (and its H4 BO is used up).
9. **Result.** `R = (entry - exit) / r0`, net `R - COST / r0`.

**Implementation check on the example, before the test file is read:** on the council's OANDA candles the rule must read the
owner's trade as: H4 BO buy at the close of the 16:00 UTC candle of 9 Nov (close 4136.5 above the A-level 4134.1), H1 BO
sell at the close of the 02:00 UTC candle of 10 Nov (close 4111.7 below the V-level 4121.6), M5 break candle 02:30 UTC,
sell limit 4121.6, stop about 4128.3, barrier target about 4073.4. The owner's own levels were 4120.42 / 4128.92 / 4072.84.

## Variants (secondary; reported, labelled, never promoted on their own). Each changes ONE thing in P.

- **M15, the entry zone on M15** ("M15 or M5"): step 4 with M15 candles (break candle and the 3 M15 candles before it).
- **A, aligned with the weekly direction**: P only when the trade's side equals the weekly structure's direction, read as
  the live Trader reads it (Monday-aligned weeks, `msAnalyze(weeks, 3)`, the last weekly BO on a closed week; here on the
  whole candle file, where the Trader reads about two years).
- **K, at an H4 key level**: P only when, in the 24 h before the H1 BO, an M5 high came within 0.05 % of (or above) an H4
  A-level that was live then (existing, under 30 days old, no H4 close above it). The mosha-level tap, as a filter.
- **T3, fixed target**: target `3 x r0`, no barrier needed.

Tests counted for multiple comparison: P, M15, A, K, T3 (five), Holm-corrected one-sided p (mean net R > 0). The report
also gives the Holm correction over all nine tests of the two Mosha studies of this day (four in mosha-level, five here).

## Verdict (fixed here; the same bar as mosha-level)

On P, net of cost, orders placed 2020-01-01 to 2026-10-31, filled trades only:

- **PASS**: out-of-sample n >= 30; mean net R > 0 in sample AND out of sample; at least two thirds of the out-of-sample
  calendar years with a trade are positive; whole-window t >= 2.0; and mean net R > 0 at twice the cost.
- **FAIL**: whole-window mean net R <= 0, or out-of-sample mean net R <= 0.
- **INCONCLUSIVE**: anything else.

A variant that looks better than P is a hypothesis for a new pre-registration, not a result.

## What happens next

Nothing changes live on any outcome. On PASS the proposal to the owner is a paper shadow stream next to the live Mosha BO.
On FAIL or INCONCLUSIVE the result is published as it is.
