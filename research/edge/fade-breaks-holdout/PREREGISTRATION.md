# Fading lower-timeframe breaks, on data the three grids never read (pre-registration)

Written 23 Nov 2026, committed and pushed ALONE before any holdout run of this study's rules. Research only: nothing live
reads it, nothing is placed, no desk changes from it.

## Why

In three grids of 23 Nov 2026 the side-flipped PLACEBO (the same signals traded the other way) did better before costs than
the real trades: `grid6-box-in-box` (placebo 22 cells confirmed after Holm, real 0), `grid6-mosha-market` (placebo 1,155
discovery winners against about 369 by chance, real 354) and `grid6-dom-confirm` (placebo 6 cells: fading a lower-timeframe
structure break inside a zone). The pattern points to a mean-reversion tilt: fading lower-timeframe breaks. Every placebo cell
lost after costs on 2010-2019. This study asks a small fixed set of faded rules once, unchanged, on data none of the three
grids read.

## How the rules were picked (fixed before any holdout figure; see "Disclosure" below)

Selection rule, written before the picks were listed: for each grid, the POOLED placebo cell (all five markets together; a
one-market cell cannot be judged on set B's markets) that passed both halves (n >= 100, mean R > 0 and month-sum t >= 2
before costs, in 2010-14 AND in 2015-19; no Holm), best by its 2015-19 month t. Had a grid none, the best pooled cell by
2010-19 month t with n >= 300 (not needed: every grid had some).

- grid6-box-in-box: its `result.json` lists the placebo cells that passed both halves (`placebo.rawList`, sorted by 2015-19 t).
- grid6-dom-confirm and grid6-mosha-market publish only their Holm passes, so their own `runMarket` (imported, unchanged) was
  run again on 2010-2019, the data they already read (`pick.mjs`; list in `picks.json`): 86 dominant-zone placebo cells and
  100 Mosha placebo cells passed both halves. The Mosha rerun equals the grid's published placebo baseline rows (96 of 96).
  The dominant-zone rerun equals its 2010-14 figures exactly and differs slightly in 2015-19 (the picked cell: n 3,870 against
  the grid's 3,865); the cause is being traced in the candle cache (the grid read a cache made on another machine; no code
  changed since) and is reported in RESULT.md. The same cell is the best both in the grid's own published passes and in the
  rerun, so the pick does not depend on it.

## The four rules (exact factor values; nothing tuned)

Every rule is traded on the FADED side (the placebo side of its grid). Side-flipped placebo as each grid defines it: the
side reversed at the same decision moment, the stop the same distance on the other side of the reference price, the same
fill rule, exits and costs. The un-faded (real) side is reported beside each, for contrast only.

- **F1** (grid6-box-in-box, placebo cell): chain H1 -> M15 -> M5; trigger `out` (the M5 box from swing low to swing high, 2
  candles a side, closes out WITH the top H1 box's last close-out side); top position, middle close-out and bottom size any;
  session `other` (the M5 close-out candle closes outside 07:00-16:59 UTC); entry `mkt` (the next 5-minute open); stop `bot`
  (past the M5 box by half the round trip; skipped under 2 round trips from the close); exit `1R`; out 1 day after the fill.
  Faded = SELL after an up close-out, BUY after a down one, stop mirrored. Grid figures (2010-14 / 2015-19, before costs):
  +0.0453R (n 30,878, month t 5.99) / +0.0528R (n 29,572, t 6.30).
- **F2** (grid6-dom-confirm, placebo cell 5559): chain H1 > M5 (an H1 dominant zone from combo-grid-3 `buildZones('dom')`);
  visit 2 (the second touch); confirmation `bo` (the first M5 structure break, edgekit `structure(M5, 2)`, with the zone's
  side within 12 M5 candles of the touch, before a close beyond the zone's far side); Daily MSNR call any; session `other`
  (the confirmation candle closes outside 07:00-20:59 UTC); stop `swing` (the extreme from the touch to the confirmation, by
  half the round trip); exit `trail` (the stop trails 1R behind the best price once +1R is reached); out 2 days after the fill.
  Market at the next 5-minute open. Faded = against the zone's side, i.e. fading the M5 break. Grid figures: +0.0949R (n 3,821,
  t 4.10) / +0.076R (n 3,865, t 4.15) published; +0.0949R (n 3,821, t 4.10) / +0.075R (n 3,870, t 4.13) in the rerun.
- **F3** (grid6-mosha-market, placebo cell 6228): ladder H1 > M15 (BO on H1, VR and CF on M15, edgekit `structure(·, 3)`
  breaks, break type any); CF place `back` (price traded back to the H1 BO level between the VR and the CF); entry `MKT` (the
  next 5-minute open after the CF candle closes); stop `cfz` (past the CF zone by 0.1 x ATR14 of M15); exit `trail`; session
  any; Daily MSNR call any; out 2 days after the fill. Faded = against the BO / CF side. Grid figures (rerun, equal to the
  grid's code): +0.100R (n 3,168, t 4.30) / +0.079R (n 3,061, t 4.01).
- **F4** (plain, written here, not from a grid): an H1 box = edgekit `boxesHL(H1, 2)` (from a swing low to a swing high, 2
  candles a side), standing from the close of the H1 candle that completes it until the close of the H1 candle that closes
  outside it. The FIRST M5 structure break (edgekit `structure(M5, 3)`) whose break candle closes inside the standing box,
  after the box stands, is faded once per box: market at the next 5-minute open; stop past the break candle's extreme (its
  high when selling, its low when buying) by 0.1 x ATR14 of M5 at the break candle; target 1R (stop first when one candle holds
  both, a gap past either fills at the open); out at the close of the first 5-minute candle ending a day after the fill.
  Skipped when the stop is not on the losing side of the fill or the filled risk is under 2 round trips. The un-faded side
  (with the break, stop past the candle's other extreme by the same buffer) is reported beside.

Code: `run.mjs` (F1-F3 copy each grid's per-signal loop line for line, filtered to the cell, with the grid's own imported
functions; F4 written there), `report.mjs`. Trades filling inside a `research/edge/data-quality/quality.json` exclusion are
dropped (combo-grid-2 `exclusions`). Every trade has its stop on the losing side (else the run stops with an error).

**Gate, before any holdout figure is judged**: on 2010-2019 and the grids' five markets, F1-F3's faded trades must give the
grid figures above (n in each half, mean R to 4 decimals, month t to 2 decimals; F2 against the rerun on this cache, with the
difference to the published figures explained). A gate that fails makes the study INCONCLUSIVE and says why.

## Data (OANDA mid 5-minute candles, the edgekit cache; frames built from them)

- **Set A**: xau, eurusd, gbpusd, usdjpy, audusd, fills 2005-01-01 to 2009-12-31 (gold where OANDA has it).
- **Set B**: nzdusd, usdcad, usdchf, eurjpy, xag, fills 2010-01-01 to 2019-12-31. Their round-trip costs are ASSUMED
  (edgekit `COSTS`, not measured on the demo account).
- **Set C**: the five markets of set A, fills 2020-01-01 to 2026-10-31 (the last complete month). These years were read by
  other studies but not by the three grids; reported with the same bar, not part of the verdict.

Warm-up: each grid's own load window (box and Mosha rules: from 1 January of the year before; dominant zone and F4: 400 days
before to 15 days after). Costs: combo-grid-2 `COSTS` (round trip in price units).

## Measures and the bar (judged BEFORE costs, month-sum t; after costs beside)

- Per rule and set, pooled: n, mean R a trade, win share, calendar-month sums over every month of the set (empty months 0),
  month-sum t and its one-sided p; the same after costs (cost / risk off each trade). Per-market rows beside.
- **Primary tests**: 4 rules x sets A and B = 8. A test passes when n >= 50, mean R > 0, month-sum t >= 2 and the Holm-adjusted
  one-sided p over the 8 is under 0.05. **A rule passes when it passes on A AND on B.**
- **Verdict**: PASS = at least one rule passes on A and B. INCONCLUSIVE = no rule passes both, but some rule passes exactly one
  set (or the gate fails). FAIL = no rule passes on either set. Set C: the same plain bar (n >= 50, mean > 0, month t >= 2),
  named in RESULT.md; it never turns a FAIL into a PASS.
- Beside, not part of the bar: after-cost figures (the faded placebo cells all lost after costs on 2010-19); the un-faded side;
  per-market rows; a cut test (each rule's signals known a day before a cut are the same when the candles stop at the cut).

A pass is a before-cost tilt on unread data, never an edge by itself (it would still have to clear costs and a forward record).
No threshold, window, cell or rule changes after this file is pushed.

## Disclosure

Before this file was written, a smoke test of the code ran F1 and F4 once on usdjpy 2005-2009 (part of set A) and printed their
pooled figures. That was a mistake. It could not change the rules: F1 follows the selection rule on 2010-2019 and F4 is written
out in the task that set this study. It is stated here so the reader can weigh it. No other holdout figure was seen.
