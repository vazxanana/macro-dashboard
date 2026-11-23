# Combination grid 4: is the before-cost tilt about the dominant zone, or about the entry? (pre-registration)

Written 23 Nov 2026, before any run on these years. Research only: nothing live changes.

## Why

Three combination grids (`research/edge/combo-grid`, `-2`, `-3`, all on 2020 to now) found one family that held before
costs: an H1 dominant zone touched on M5, a limit at the zone's near edge, no trigger, the stop past the zone's far side by
half the cost plus a quarter of the key timeframe's ATR(14) (grid 3's no-trigger entry `zedge` with the stop `zatr`). The
question here: is the tilt about the dominant zone, or about the entry itself (a limit at the edge of ANY zone with a stop
outside the noise)? If it is the entry, other zone kinds and chains should show it too; if it is the zone, only `dom` should.

## The rules (fixed; grid 3's engine, imported, never edited)

`research/edge/combo-grid-3/run.mjs`: `frames`, `buildZones`, `signalsFor` (no-trigger signals only, first and second touch
of a zone), `multi` (one pass, nine exits), the same per-signal construction as its `runMarket` for the `none` filter:
entry = a limit at the zone's near edge (`zedge`); stop = the far side -/+ (half the round-trip cost + 0.25 x ATR(14) of the
chain's key-level timeframe) (`zatr`); order life 12 candles of the touch timeframe; the risk at least 2 costs (at the order)
and at least 1 cost (at the fill); the opposite-zone (`opp`, default 2R) and the far H4 / D1 zone (`far`, only when 3R or
more) targets as in grid 3; time limit per key timeframe as in grid 3. Every trade has a stop on its losing side (a trade
without one is not built). Costs = `research/edge/combo-grid-2/run.mjs` `COSTS`; data-quality exclusions =
`exclusions()` of the same file (`research/edge/data-quality/quality.json`).

- Zone kinds (9): eg, egn, ef, dom, av, bar, qm, box, egb.
- Chains (11): 1d>4h, 1d>1h, 4h>1h, 4h>30m, 4h>15m, 1h>30m, 1h>15m, 1h>5m, 30m>15m, 30m>5m, 15m>5m.
- Exits (9): 1R, 2R, 3R, 4R, 6R, opp, trail (1R trail from +1R), far, eftrail.
- Filter: none only.

9 x 11 x 9 = 891 rules, on each of xau, eurusd, gbpusd, usdjpy, audusd and pooled: 5,346 cells.

## Data

OANDA mid 5-minute candles from the `edgekit` cache, 2009-03-01 (warm-up) to 2019-12-31; trades counted by fill time from
2010-01-01 to 2019-12-31. These years were read by none of the three grids. (The `dom-zone-holdout` study tests the single
H1 DOM rule on the same years; this grid does not use its result.)

## The bar (judged BEFORE costs, as the owner asked; after costs reported beside with the same bar)

Statistics on calendar-month sums of R (month t = mean / (sd / sqrt(months)), every month of the window counted, an empty
month as 0).

1. Discovery 2010-2014 (60 months): n >= 100, mean R a trade > 0, month t >= 2.
2. Confirmation 2015-2019 (60 months), discovery winners only: n >= 50, mean R > 0, month t >= 2, and a one-sided p of the
   confirmation month t (df 59) below 0.05 after Holm over every discovery winner with n >= 50 in confirmation.

Reported: the number of cells tested, discovery winners, raw confirmations (step 2 without Holm) against the count expected
by chance (discovery winners x 0.0228), Holm-confirmed cells; which zone kinds and chains carry the raw and Holm passes
(counts per kind and per chain, and the share of each kind's cells that pass); and the H1 DOM cell's own figures (1h>5m,
dom, zedge / zatr, all nine exits, every scope, both windows, before and after costs).

## Reading, fixed in advance

- If passes come from several zone kinds in rough proportion to their cells, the tilt is about the entry (a limit at a
  zone's edge with a stop outside the noise), not the dominant zone.
- If they come mostly or only from `dom`, the tilt is about the zone.
- If there are no more raw passes than chance and no Holm passes, the 2020-26 family does not repeat on these years.

Verdict: PASS = one or more Holm-confirmed cells before costs; FAIL = none; INCONCLUSIVE = fewer than 100 discovery cells
reach n >= 100. A pass is a before-cost tilt on untouched years, never an edge; after-cost figures say whether it pays its
costs.

## Checks

A cut test: one market's trades built on candles cut at a date equal the full run's trades whose time limit ends before that
date (no look-ahead). Offline test `tests/combo-grid-4.test.mjs` pins RESULT.md to result.json.
