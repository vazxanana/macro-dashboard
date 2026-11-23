# The MSNR direction call as a filter: WITH the call against AGAINST it (pre-registration, 23 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

The desk's direction call (`council/eg-methods.mjs` `direction()`: the side switches only when a key level of the timeframe above
was tapped and the working chart then closes beyond its last turn of the closes that stood before the tap) is meant to be the
bias every entry takes. The earlier grids read it only as one extra condition inside large grids (`combo-grid-3`,
`grid7-wide-core`'s "+MSNR" cells) and it never stood out. This study asks the one question directly, with 22 years of ten
markets: for plain triggers, do the trades taken WITH the call do better than the same triggers taken AGAINST it?

## Data

- OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs`, filled with `fetch-cache.mjs`), loaded
  from 2004-01-01 for warm-up. Markets (10): xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy (each
  from where OANDA's history starts).
- Timeframes from the 5-minute candles with `combo-grid-3`'s `frames` (imported, unchanged): 15m, 1h, 4h (UTC buckets), 1d
  (17:00 New York days), 1w (weeks of those days starting Monday).
- Exclusions: `combo-grid-2`'s `exclusions(market)` (the data-quality audit's bad intervals); a trade whose fill falls in one is
  dropped.
- Windows by fill time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31**
  (142 months). Month sums count every calendar month of the window, an empty month as 0.

## The call (three ladders)

`direction(work, keyOf, htfSec)` imported from `council/eg-methods.mjs`, unchanged, on the working chart with key levels from the
timeframe above (`keyOf` = the start of the key-timeframe candle holding the working candle, as `grid7-wide-core`'s
`dailyCalls`):

| Ladder | Working chart | Key levels | Trigger chart (two steps under the working chart) | Time limit of a trade |
|---|---|---|---|---|
| D1 | 1d | 1w | 1h | 2 days |
| H4 | 4h | 1d | 15m | 1 day |
| H1 | 1h | 4h | 5m | 8 hours |

The call at a trigger is `call[i]` of the last working candle CLOSED by the trigger candle's close (0 before the first switch:
those triggers are in neither side). **Call age** = working candles since the switch that set it (`i - events[last[i]].i`).

## The triggers (on the trigger chart, closed candles only)

- **break**: `edgekit` `structure(T, 3)`: a close beyond the last confirmed swing (3 a side). Swing point of the trade = the
  extreme from the broken swing's candle to the break candle (as `grid7-wide-core`).
- **box**: `edgekit` `boxesHL(T, 2)`: the box from a swing low to a swing high (2 a side) closed out by a candle; swing point =
  the box's other side (its low for a break up).
- **engulf**: `council/eg-methods.mjs` `zones(T, tf, 3)` (imported): a candle closes beyond the high (low) of the last candle of
  the other colour, at most 3 candles back, first such close only; swing point = the lowest low (highest high) from the base
  candle to the completing candle.

Each trigger is taken in its own direction d.

## The trade

Market entry at the open of the first 5-minute candle starting at or after the trigger candle's close. Stop = the swing point moved
0.1 x ATR(14) of the trigger chart (at the trigger candle) further against d. Exits: **1R** and **2R** targets (two cells), stop first when one
5-minute candle holds both, a candle that opens past a level exits at its open, at the close of the 5-minute candle reaching the
time limit otherwise. A fill at or past the stop, or a risk under the market's round trip, is no trade (the same for every
cell). Every trade has its stop on the losing side of the fill (the run stops if not).

**Side**: WITH = d equals the call; AGAINST = d is the opposite of the call.

**Fade** (reported, not judged): the same trigger entered against d at the same fill; stop = the trigger candle's extreme (its
high after a break up) + 0.1 ATR; 1R / 2R; split the same way by whether the FADE's side equals the call.

## The 18 judged cells and the bar

Cells = 3 ladders x 3 triggers x 2 exits. For each cell, a pass needs ALL of:

1. n >= 300 trades on each side in each window.
2. mean R WITH minus mean R AGAINST > 0 with **Welch t >= 2 in BOTH windows** (trade level).
3. The month series "mean R WITH minus mean R AGAINST" (months holding both sides) has **month t >= 2 in BOTH windows**
   (guards against trades of one month leaning on each other).
4. **Holm**-adjusted one-sided p (from the confirmation Welch t) < 0.05 over the 18 cells.

Judged BEFORE costs. **Verdict**: PASS if at least one cell passes; INCONCLUSIVE if fewer than 9 of the 18 cells reach bar 1;
FAIL otherwise.

## Reported beside, not judged

- Each side's own mean R and calendar-month-sum t, before and after costs, per window.
- Call age: per market and ladder, the median age of the signals (all triggers, call not 0) whose fill is in the discovery
  window, computed from the signals before any outcome is read; each side split young (age under or at the median) / old;
  mean R and Welch t of WITH against AGAINST in each half.
- The fade of each trigger split by the call (with / against), as above (`research/edge/grid7-wide-fade` found fading breaks
  had a before-cost tilt: does the call change it?).
- Per market figures of the best cell.

## Costs

`combo-grid-2`'s `COSTS` (imported): the demo account's measured round trips for xau, eurusd, gbpusd, usdjpy, audusd;
**ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy. After-cost figures are shown beside, never judged.

## Checks

- Cut test: on 5 dates per market for 2 markets, signals (with their call and age) known by the date, computed on candles cut
  there, equal the full run's.
- One run, no variants. Nothing is called an edge without n and t; a passing cell would be a candidate for a forward record and
  an owner decision only.
