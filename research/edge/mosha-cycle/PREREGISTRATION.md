# Mosha cycle, second half (the buy at the barrier): pre-registration

Written and committed on 10 Nov 2026, before any number of this study was computed. Paper research only: no live rule,
size, filter or mirror setting is changed by this study, whatever it finds.

## Why

`research/edge/mosha-retrace/` tested the first half of the owner's Mosha trade: after an H4 BO, the first H1 BO the other
way starts a retracement, traded on M5 into the H4 barrier. Break-even (+0.02R a trade, t 0.17).

The owner then answered three questions about the method (10 Nov 2026):

- "High time frame aligned" means **top-down order only**: H4, then H1, then M15 or M5. No Daily or Weekly condition and no
  level requirement.
- The entry zone is **the zone of the break**, entered on the first return to it.
- When the retracement reaches the H4 barrier: **"Close, then buy with H4."** The buy at the barrier is the main trade.

The first two confirm the mosha-retrace rule as the owner's first half. The third names a trade that has not been tested:
the continuation from the barrier. The live Mosha BO system also trades back with the H4 after an H1 retracement, but it
does not wait for the barrier, enters on M15 and only in the weekly direction.

What I already know, said plainly: I have seen the mosha-level and mosha-retrace results on this same data (nine tests
today). Nothing in this rule was chosen from them. The entry is the same mechanism the owner confirmed for the first half,
turned around; the barrier is the same zone; data, cost, fills, window and verdict are carried over unchanged.

## Data, window, cost, fills

As `research/edge/mosha-level/PREREGISTRATION.md`: HistData spot gold M1 (clock per `council/histdata.mjs`), M5 / M15 / H1 /
H4 candles built from it in UTC buckets, fills and exits on M1, orders placed 2020-01-01 to 2026-10-31, in sample to
2023-12-31, out of sample from 2024-01-01, `COST = $0.30` a round trip, sensitivity at twice that.

## The rule (primary, "P"). Written for an H4 BO buy, so the trade is a BUY; the other side is the mirror image.

Constants: `W4 = 3`, `W1 = 1`, `BASE = 3` candles, `PAD = $0.30`, `LEVEL_AGE = 30` days, `WAIT = 72 h`, `VALID = 24 h`,
`HOLD = 72 h`, `MIN_R0 = $1.00`, `MIN_RR = 2`. H4 and H1 BOs and the barrier are defined exactly as in mosha-retrace.

1. **H4 BO buy**, then **the first H1 BO sell after it** (the retracement has started), as in mosha-retrace steps 1 to 3.
2. **The barrier** is fixed at that H1 BO: the nearest live H4 bullish engulf zone whose top is below the broken H1 level
   (the zone mosha-retrace uses as its target). No such zone: the cycle ends.
3. **The retracement reaches the barrier:** the first M5 candle after the H1 BO sell whose low is at or below the zone's
   top. The cycle ends without a trade if, before that, an H4 candle closes below the zone's bottom, a newer H4 BO (either
   side) prints, or the zone is more than 30 days old.
4. **H1 BO buy: back with the H4.** The first H1 candle that closes after the tap and is an H1 BO buy (a close above the
   most recent H1 swing high that existed when the candle opened), within 72 h of the tap. The cycle ends without a trade
   if, before that, an H4 candle closes below the zone's bottom or an H4 BO sell prints.
5. **Entry zone, on M5** (the zone of the break): among the M5 candles from the moment that H1 swing high came to exist to
   the close of the H1 BO candle, the first that closes above the level is the break candle. Zone bottom = the lowest low of
   the break candle and the 3 M5 candles before it. (No such M5 candle: the low of the H1 BO candle.)
6. **Order.** Placed at the close of the H1 BO candle: buy limit at the broken H1 level, stop = zone bottom − $0.30. Risk
   `r0 = entry − stop`; no order when `r0 < $1.00`. Valid 24 h.
7. **Target: the high the retracement came from.** The highest M5 high between the close of the H4 BO candle and the tap.
   A target under `2 x r0` away: no order.
8. **Fill and exit, on M1**, as in mosha-level: fill when an M1 low reaches the entry; cancelled if the target trades
   first; stop first when one candle holds both; a gap through the stop exits at the open; out at the M1 close 72 h after
   the fill. No break-even, no trail, no add.
9. **One cycle per H4 BO, one order or position at a time** in this stream.
10. **Result.** `R = (exit − entry) / r0`, net `R − COST / r0`.

**Implementation check on the example, before the test file is read:** on the council's OANDA candles the rule must show
the owner's cycle of 9-10 Nov as: H4 BO buy at 20:00 UTC on 9 Nov, H1 BO sell at 03:00 UTC on 10 Nov, barrier top about
4073.4, tapped late in the morning of 10 Nov (UTC), and from then a buy armed only once an H1 BO buy prints.

## Variants (secondary; reported, labelled, never promoted on their own). Each changes ONE thing in P.

- **Z, stop under the barrier**: stop = the barrier zone's bottom − $0.30 (a wide, structural stop) instead of the M5 base.
- **M15, the entry zone on M15**: step 5 with M15 candles.
- **T3, fixed target**: target `3 x r0`.

Tests counted for multiple comparison: P, Z, M15, T3 (four), Holm-corrected one-sided p (mean net R > 0). The report also
gives the Holm correction over all thirteen tests of the three Mosha studies of this day.

Also reported, without a test or a verdict: the whole cycle as the owner trades it, that is the mosha-retrace primary and
this primary added together on one timeline (the retracement trade, then the buy at the barrier).

## Verdict (fixed here; the same bar as mosha-level and mosha-retrace)

On P, net of cost, orders placed 2020-01-01 to 2026-10-31, filled trades only:

- **PASS**: out-of-sample n >= 30; mean net R > 0 in sample AND out of sample; at least two thirds of the out-of-sample
  calendar years with a trade are positive; whole-window t >= 2.0; and mean net R > 0 at twice the cost.
- **FAIL**: whole-window mean net R <= 0, or out-of-sample mean net R <= 0.
- **INCONCLUSIVE**: anything else.

## What happens next

Nothing changes live on any outcome. On PASS the proposal to the owner is a paper shadow stream next to the live Mosha BO.
On FAIL or INCONCLUSIVE the result is published as it is.
