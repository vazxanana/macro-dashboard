# The grid-5 rule on data the grid never read (pre-registration)

Written 23 Nov 2026, committed and pushed ALONE before any run of this study. Research only: nothing live reads it, nothing
is placed, no desk changes from it.

## Why

`research/edge/grid5-msnr-box` tested 11,625 cells on 2010-2019 and confirmed one rule (two exits of the same trades) after
Holm, before costs: +0.141R a trade in 2010-14 (n 297, month t 2.20) and +0.233R in 2015-19 (n 317, month t 4.40) at the 1R
exit. One cell of 11,625 is a hypothesis, not an edge. This study asks it once on data the grid never read, with no variant.

## The rule (exactly the grid's cell; no change, no tuning)

Pooled over the set's markets, every MSNR call state (`any`):

- **Key level**: a Daily engulf zone (`combo-grid-3` `buildZones('eg')` on the 17:00 New York trading days), serving its side
  from the close that makes it known until a Daily close through its far side or 120 Daily candles; touch = the first H1
  candle that trades into it, at most 2 visits a zone.
- **Box**: the first H1 box (`edgekit` `boxesHL(H1, 2)`: from a swing low to a swing high, 2 candles a side, ended by a close
  outside) that ends, within 24 H1 candles of the touch, with a close out WITH the zone's side (the event candle).
- **Trigger**: the first H1 structure break of that side (`edgekit` `structure(H1, 2)`) on the event candle or the 6 after it.
- **Time**: the trigger candle closes in New York hours, 12:00-16:59 UTC.
- **Entry**: market, the open of the first 5-minute candle at or after the trigger's close.
- **Stop**: past the box's other side by half the round trip; skipped when under 2 round trips from the trigger close, or a
  filled risk under one round trip. Every trade has its stop on the losing side (else the run stops with an error).
- **Exits**: primary `1R` (target 1R, stop first when one candle holds both, a gap past the stop exits at the open), secondary
  `trail` (the stop trails 1R behind the best price once +1R is reached); both out 2 days after the fill.
- Trades filling inside a `research/edge/data-quality/quality.json` exclusion are dropped (`combo-grid-3` `exclusions`).

The code is grid5-msnr-box's own: `signals`, `trade` and its constants are imported and the grid's per-signal step for this
one cell (stop, the 2-round-trip check, the opposite-zone target passed to `manage`) is copied line for line; nothing of the
grid is edited. **Gate before any holdout figure is read**: the same code on 2010-2019 must give the grid's pooled figures for
the cell (n 297 / 317, +0.1406R / +0.2330R at 1R); if it does not, the study stops and says so.

## Data (OANDA mid 5-minute candles, the edgekit cache; Daily, H1, H4 built from them)

- **Set A**: xau, eurusd, gbpusd, usdjpy, audusd, fills 2005-01-01 to 2009-12-31 (2004 warm-up; gold where OANDA has it).
- **Set B**: nzdusd, usdcad, usdchf, eurjpy, xag (`edgekit` `HOLDOUT_MARKETS`), fills 2010-01-01 to 2019-12-31 (2009 warm-up).
  Their round-trip costs are ASSUMED (not measured on the demo account).
- **Set C**: the five markets of set A, fills 2020-01-01 to the last complete month in the cache (2019 warm-up). These years
  were read by other studies but never by grid 5; reported with the same bar and stated in the verdict.

Costs: `combo-grid-2` `COSTS` (round trip in price units).

## Measures and the bar (judged BEFORE costs, the owner's view; after costs beside)

- Per set: n, mean R a trade, win rate, calendar-month sums (empty months count as 0, from the set's first to its last month),
  month-sum t; the same after costs (cost / risk taken off each trade).
- **Primary**: exit 1R on set A and set B. A set passes when n >= 50, mean R > 0 and month-sum t >= 2, and the Holm-adjusted
  one-sided p over the two primary tests (A, B) is under 0.05.
- **Verdict**: **PASS** = A and B both pass. **INCONCLUSIVE** = exactly one passes, or a set has fewer than 50 trades.
  **FAIL** = neither passes. Set C is judged with the same plain bar (n >= 50, mean > 0, month t >= 2) and its result is named
  in the verdict sentence ("repeated / not repeated on 2020 on"); it does not turn a FAIL into a PASS.
- Reported beside, not part of the bar: the trail exit on every set; per-market rows; after-cost figures; the side-flipped
  placebo (side flipped, stop mirrored around the trigger close at the same distance, the same fills and exits); a cut test
  (each set's markets cut at several moments: the cell's signals before each cut must equal the full run's).

A pass is a before-cost tilt on data the grid did not read, never an edge by itself: nothing changes on any desk, and any
use would need a forward record. No threshold, window or rule changes after the first run.
