# Filters on the H1 dominant-zone limit, 2010-2019 (pre-registration)

Written 23 Nov 2026, before any run on these years. The three combination grids (`research/edge/combo-grid`, `-2`, `-3`,
2020 to now) ended, judged before costs, on one family: an H1 dominant zone (two H1 candles of one colour, the second closing
beyond the first's extreme; zone = the first candle's body), touched on M5, a limit at the zone's near edge, no trigger, the
stop past the far side by half the cost + 0.25 x ATR(14) of H1 (grid 3's no-trigger `zedge/zatr` cell, filter `none`). Grid 3
also crossed it with 14 filters; this asks, on years no grid read, whether any of those filters picks the better trades.

## Rule (fixed; grid 3's engine unchanged)

The trades are exactly those of `research/edge/dom-zone-holdout/run.mjs` `trades()`: `combo-grid-3` `signalsFor(F, '1h',
'5m', 'dom')`, the no-trigger signals (first and second touch), a limit at the near edge from the touch candle's start, valid
12 five-minute candles, stop = far side -/+ (cost / 2 + 0.25 x ATR(14) of the last closed H1 candle), `multi()` exits, a
2-day limit. Primary exit: the 1R trailing stop from +1R (`trail`). Costs: `combo-grid-2` COSTS (via grid 3); data-quality
exclusions as grid 3.

## Filters (13, each known at the touch candle's start, computed exactly as `combo-grid-3` `runMarket`)

struct (H1 structure side), structUp (H4 structure side), msnr (the direction call), d1eg (last Daily engulf side), weekly
(last completed week's side), er20 (Daily 20-day efficiency ratio >= 0.2), er35 (>= 0.35), weeklyEr20 (both), london
(07-12 UTC), ny (12-17 UTC), sideways (the 2 H1 candles after the zone formed did not touch it), half (the near edge in the
trade's half of the H4 swing range), boConf (H1's last structure event is a BO with the trade).

## Data

OANDA mid 5-minute candles (`edgekit` cache, 2009 loaded as warm-up), xau eurusd gbpusd usdjpy audusd, trades filled
2010-01-01 to 2019-12-31, pooled. Halves: 2010-2014 and 2015-2019.

## Tests (judged BEFORE costs, as the owner asked; after costs reported beside)

For each filter: R a trade (trailing exit) of the kept trades minus the dropped trades > 0 with Welch t >= 2 in BOTH halves.
One-sided p of a filter = the larger of its two halves' one-sided p; Holm over the 13. A filter passes when both halves
qualify and its Holm p < 0.05. Reported beside: kept-only and dropped-only mean R and month-sum t, after-cost figures, the
1R / 2R / 4R exits, and per market. Reference: the unfiltered rule's own figures (mean R, month-sum t) in each half.

A pass is a before-cost difference between kept and dropped trades on untouched years, not an edge: the kept trades must
still show month-sum t >= 2 on their own, and the after-cost figure says whether they pay their costs. Welch t treats trades
as independent; same-day trades are not, so a pass is checked against the kept-only month-sum t before anything is read into it.
One run, no variants.
