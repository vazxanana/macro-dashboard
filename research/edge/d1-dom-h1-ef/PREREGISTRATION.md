# Daily dominant zone, first return, H1 failed engulf with the zone (pre-registration)

Written 24 Nov 2026 and committed ALONE before any code of this study runs on real candles. Research only: nothing live
changes, nothing is placed, no rule is proposed, no council file is edited.

## Why

One combination of the desk's readings: a Daily dominant zone as the key level, and on price's FIRST return to it an H1
engulf of the OTHER side that fails (a later H1 close breaks through it) as the entry with the zone's side.

What is already tested near it, and why this is not a repeat:
- `grid6-dom-confirm` (2010-19): the dominant zone with confirmations `eg`, `bo`, `box`, `rej`; it had NO failed-engulf
  confirmation.
- `combo-grid-3` (2020 on, three markets): had a D1 > H1 chain with a failed-engulf trigger among 100,000s of cells, a
  different stop set and visit rule; `usdjpy-dom-ef` tested H4 > M15 on USD/JPY only (FAIL).
- `grid7-ltf-ef`, `eg-ef-choch-ladder`: the failed engulf with other key levels.
So the D1 zone with an H1 failed engulf, the stop past the extreme made at the zone, over 2005-2026 on five markets, is
untested as a fixed small study. This runs it once.

## Data (fixed)

OANDA mid 5-minute candles from the edgekit cache (read only, no network): xau, eurusd, gbpusd, usdjpy, audusd. Candles
loaded from 2004-01-01 for warm-up; a trade counts by its FILL time. Discovery = fills 2005-01-01 to 2014-12-31
(120 months), confirmation = fills 2015-01-01 to 2026-10-31 (142 months). Higher timeframes from `combo-grid-3`
`frames(M5)`: H1 = clock hours (UTC), D1 = 17:00 New York trading days. Exclusions: `combo-grid-2` `exclusions` (a trade
whose fill falls in a bad-data interval is dropped). Costs: `combo-grid-2` `COSTS` (round trip, price units; the desk's
demo figures for these five markets), charged once a trade as cost / risk in R.

## The rule (own words; imported code is not edited)

1. **Key level.** `combo-grid-3` `buildZones('dom', D1)` unchanged: two consecutive Daily candles of one colour, the second
   making a higher high and closing above the first's high (a buy zone; mirrored for a sell zone). The zone is the FIRST
   candle's body; its side is the candles' colour; it is known at the second candle's close; it ends at the first Daily
   close through its far side or after 120 Daily candles.
2. **First return.** The first H1 candle that STARTS at or after the zone is known and trades into it (a buy zone: low at
   or below the zone's top; a sell zone: high at or above its bottom), before the zone ends. Only this first visit is read:
   one trade at most per Daily zone.
3. **The visit window.** The touch candle and the H1 candles after it, W candles in all (a cell). The visit ends with no
   trade at the first H1 candle in it that closes beyond the zone's far side (buy zone: a close below its bottom), or that
   ends after the zone's own end.
4. **Trigger: an H1 failed engulf with the zone.** H1 engulf zones from `council/eg-methods.mjs` `zones(H1, '1h')`
   (its default: a coloured candle closing beyond the high / low of the last opposite-coloured candle at most 3 candles
   back; the zone is that base candle wick to wick; it FAILS at the first later H1 close through its far side, within the
   function's own 120-candle life). The trigger is an engulf of the side OPPOSITE to the Daily zone (a sell engulf at a
   buy zone) whose failing close falls on a candle of the visit window. The first such failing candle counts. Which
   opposite engulfs count is a cell:
   - `visit`: only an engulf COMPLETED on or after the touch candle (it formed during the return);
   - `any`: any opposite engulf, whenever it was completed.
5. **Entry.** Market, at the open of the first 5-minute candle that starts at or after the failing H1 candle's close.
6. **Stop.** Past the extreme made at the zone: the lowest low (buy; highest high for a sell) of the H1 candles from the
   touch candle through the failing candle, minus (plus) half the round-trip cost + 0.1 x ATR(14) of H1 at the failing
   candle. No trade when the fill is at or past the stop, or when the risk at the fill is under the round-trip cost. Every
   trade has its stop on the losing side (the run throws otherwise).
7. **Exit.** A fixed target of 1R, 2R or 3R from the fill (a cell), the stop, or a time limit of 10 days after the fill
   (out at the close of the 5-minute candle that reaches it). A candle that holds both the stop and the target is the
   stop; a candle that opens beyond the stop or the target exits at its open; the fill candle counts in full. Engine:
   `grid7-wide-fade` `exits` (imported). Trades may overlap; every signal is a trade. A trade not resolved by the end of
   the data is dropped and counted.

## Cells (2 x 2 x 3 = 12, all fixed here)

Engulf `visit` | `any`  x  window W = 12 | 24 H1 candles  x  target 1R | 2R | 3R. Named e.g. `visit W12 2R`.
The five markets are pooled in every cell. No other variant will be run on these years.

## The bar (judged AFTER costs)

Per cell: n >= 300 in EACH window; mean R after costs > 0 AND the t of calendar-month sums of after-cost R (every month
of the window, empty months 0) >= 2 in BOTH windows; and a Holm-adjusted one-sided p (from the confirmation month t)
< 0.05 over the 12 cells. Verdict: PASS = at least one cell clears all of it; INCONCLUSIVE = no cell passes and no cell
has n >= 300 in both windows; FAIL otherwise.

## Reported

Every cell: n, R a trade before and after costs with its month t in both windows, win rate, mean cost in R, Holm p;
the best cell by market (no verdict); the mirror beside (the same fills traded AGAINST the zone, the stop the same
distance on the other side, same targets in R; a control, no verdict); counts of zones, first returns, signals, dropped
trades; a cut test (signals known by five dates computed on candles cut there equal the full run's).

## No look-ahead

The zone is used only from its second candle's close; the touch, the opposite engulf and its failure are read on H1
candles closed by the decision time; the stop and ATR use candles up to the failing candle; the entry is the next 5-minute
open. `tests/d1-dom-h1-ef.test.mjs` checks this on seeded candles (cutting the series after a signal leaves it unchanged,
changing later prices does not change earlier signals) and that every signal's stop is on the losing side.
