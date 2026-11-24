# Lessons for the trading-research skill (from the fair-value-gap studies, 24 Nov 2026)

A section ready to paste into the trading-research skill. Sources: `research/edge/grid7-fvg-wide` and `research/edge/fvg-plus`
(both pre-registered, ten markets 2005-2026, plus eight unread markets for `fvg-plus`). Research only: nothing live changed.

---

## Before building a rule: lessons from the gap studies

### 1. Price the cost first
A before-cost tilt that comes from a small, fixed move in price does not grow with the stop. In `fvg-plus`, widening the stop
from 0.1 ATR to 1 ATR past the gap cut the round trip's share of 1R from about 0.2R to about 0.05R, but the gross gain
fell by about as much (H1 gaps: +0.046R -> +0.032R at 2R; Daily gaps about +0.01R). Check first: the rule's gross gain
in price against the market's round trip. Under about two round trips, no stop, filter, exit or higher timeframe will rescue
it. The fade, DOM-zone and fair-value-gap tilts all failed on this.

### 2. A random-band control for every zone
For each real zone, place a band of the same height and side at the same distance from price, 24-240 candles earlier, and
send it through the same entries, stops and exits. Judge the zone against the bands (Welch t in both windows), not against
zero. Gaps beat the bands by a little (Welch t 2-5 on H1 / H4 market entries); a zone that only beats zero is just
pull-back noise. Reusable on order blocks, engulf zones, dominant zones and barriers.

### 3. Rest limits with trade-through fills
A limit inside a small zone, filled only when price trades through it by half the round trip, lost 0.02R to 0.26R a trade
before costs on every gap timeframe, and so did the random bands: the candle that trades through the middle of a small zone
often reaches the stop in the same candle. Never believe a limit-entry edge filled on touch.

### 4. Structure filters do not pick better trades
"The gap's own timeframe structure agrees" and "the timeframe above agrees" added nothing to the gap entry (same R a trade
or worse, after costs, in both windows), as in every earlier filter study. Leave them out of new grids unless a study has
shown otherwise.

### 5. Where a small tilt can still help: rules that already pass with wide risk
An entry refinement worth a few hundredths of an R only survives costs on a rule whose risk unit is already wide (for
example the gold and USD/JPY volatility breakouts). Next test, not yet run: on the breakout's signal days, wait for the first
M15 close back inside an H1 gap the breakout left, and compare its fill against the breakout's own stop-order entry. It needs
its own pre-registration; it is a hypothesis, not a rule.

### 6. A lead, not a rule
After price closes through a gap (an inverse gap), trading against the old gap lost; the side-flipped check (back with the
old gap) was positive before costs in all 18 cells (16 clear the before-cost bar). Same family as the fade tilt. Not pre-registered as a cell: a lead
for a holdout test only.

### Numbers to remember
- `grid7-fvg-wide`: PASS before costs, 4 of 54 cells (best H1 market entry on large gaps, +0.035R a trade, n 52,659,
  month t 7.27, vs random bands Welch t 4.99), every one negative after costs (-0.02R to -0.11R).
- `fvg-plus`: FAIL, 0 of 36 cells after costs; best Daily gap, wide stop, 1R: +0.002R a trade after costs in 2015-26
  (n 5,315, t 0.12) and +0.005R on eight unread markets (n 8,164, t 0.39).
