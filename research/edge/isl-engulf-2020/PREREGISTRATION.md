# ISL engulf zones against plain engulf zones, H4 and H1, 2020 to now (pre-registration)

Written 23 Nov 2026, before any run of this study. Research only: nothing live changes from it.

## The question

The owner's notes describe an engulf zone that only counts when it is "ISL-qualified": the engulfed (base) candle swept an
earlier candle's extreme first, and the move away from the zone broke structure twice before price came back. Does a limit at
such a zone do better than the same limit at every engulf zone, and does it pass the common bar on its own?

## Pieces (this repository's own words)

- **Plain engulf zone** = `research/edge/combo-grid/run.mjs` `egZones(L, 3)` unchanged: an engulf completed within three
  candles (`council/eg-methods.mjs` `engulfAt`), the base candle wick to wick, known from the close of the completing candle
  `i`, ending at the first close through its far side or after 120 candles.
- **ISL sweep, variant A (the primary reading)**: the candidate starts at the base candle. A buy candidate passes when its
  high is above the high of the candle before it; a sell candidate when its low is below the low of the candle before it. If the
  base fails, the candidate steps forward one candle, at most two steps, only to candles before the completing candle `i`
  (the first that passes is the zone, wick to wick). The completing candle must close beyond the chosen candidate (above its
  high for a buy, below its low for a sell). No candidate passes = not qualified.
- **ISL sweep, variant B (descriptive only)**: the move from the candle after the base up to the completing candle took the
  extreme of the candle before the base on the trade side (a buy: a high above that candle's high; a sell: a low below its low).
  The zone stays the base candle.
- **Two breaks**: A levels and V levels are turns of the closes, two candles a side (the combo grid's `av` reading), known at
  the close of the second candle after the turn. A level is broken by a wick: a later candle's high above an A level (low below
  a V level). From the completing candle on, the move away must wick-break two distinct, not yet broken levels on the trade side
  (A levels for a buy, V levels for a sell), each known before the candle that breaks it, while the zone stands (no close
  through its far side, inside its 120 candles). The zone is qualified at the close of the candle that makes the second break.
  Touches before that do not count (the notes' freshness: only a touch after the second break spends it).
- **ISL-qualified zone** = sweep (variant A, or B in the descriptive table) + two breaks.

## The trade (the same on every zone)

A limit at the near edge (a buy at the zone's top, a sell at its bottom), resting from the moment the zone is known (plain: the
close of the completing candle; qualified: the close of the second-break candle) until the zone ends; filled by the first
5-minute candle that reaches it (at the open when it opens past the entry); a 5-minute close past the stop before the fill
cancels it. Stop past the far side by half the round-trip cost. A zone risking under two round-trip costs is skipped. Exits,
each its own test: a fixed **2R** target, and a **trailing stop** 1R behind the best price from +1R. Time limit 5 days (H4)
and 2 days (H1), out at that close. Stop first when one 5-minute candle holds both; a gap through the stop exits at the open;
on the fill candle only the stop counts. The engine is the combo grid's `multi` (imported). Each zone is its own trade (no
one-at-a-time rule). Every trade has a stop on the losing side.

## Data, costs, windows

OANDA mid 5-minute candles of the edgekit cache, H4 and H1 built from them (UTC buckets). The 18 markets of
`combo-grid-2` `GRID_MARKETS` pooled (xau eurusd gbpusd usdjpy audusd nzdusd usdcad usdchf eurjpy xag gbpjpy eurgbp audjpy
cadjpy euraud nas100 spx500 de40; the last eight from 2019 only); candles from 2019-03-01 for warm-up, trades filled from
2020-01-01 to the last candle. Costs: `combo-grid-2` `COSTS` (price units, a round trip), R after costs = R - cost / risk.
Trades whose fill falls in a data-quality exclusion (`combo-grid-2` `exclusions`) are dropped. Discovery 2020-01 to 2023-12
(48 months), confirmation 2024-01 to the last month.

## Tests (four) and the bar

ISL-qualified (variant A + two breaks) on {H4, H1} x {2R, trail}, all markets pooled. A test PASSES only if: discovery n >= 100,
mean R after costs > 0, month-sum t >= 2 (calendar-month sums of R, months with no trade counted as 0); confirmation n >= 50,
mean R > 0, month-sum t >= 2 and a one-sided Holm-adjusted p < 0.05 over the four tests; confirmation mean R > 0 at twice the
cost. The study passes if any test passes.

Reported beside each test, not part of the bar: the same trade on every plain zone, and the difference qualified minus plain
(mean R after costs, Welch t on the trade Rs, discovery and confirmation; the two samples overlap in the zones they share, so
the t is descriptive). Descriptive only: gold alone, variant B, "two breaks without the sweep", qualified against the zones
not qualified, each market alone.

A cut test is run: the qualified orders (zone, time known, entry, stop) known before a cut must be the same when every candle
after the cut is removed.

## Honest limits, written before the run

2020-2026 has been read by many studies of engulf zones (the combination grids, desk-rigor, desk-partial); a pass here earns a
forward paper record, not a live rule. The notes leave open which candle is "the one before" (two readings, A and B) and what
a breakout is (a wick through a close turn is used, as the notes say). The notes' historical-reaction weighting and the
second-movement refinement inside a higher zone are not coded.
