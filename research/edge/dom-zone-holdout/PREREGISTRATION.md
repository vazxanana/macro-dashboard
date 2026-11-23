# The H1 dominant-zone limit on years no grid read (pre-registration)

Written 23 Nov 2026, before any run on these years. The three combination grids (`research/edge/combo-grid`, `-2`, `-3`,
2020 to now) all ended on one family when judged before costs (the owner asked for the before-cost judgement): an H1
dominant zone (two H1 candles of one colour, the second closing beyond the first's extreme; zone = the first candle's body),
touched on M5, a limit at the zone's near edge, no trigger, no filter. Grid 3's best cells add a stop past the zone's far side
by a quarter of the H1 ATR(14) plus half the cost. It is a hypothesis picked from millions of cells on 2020-26; this tests it
once on data none of the grids read.

**Rule (fixed, the grid 3 engine unchanged)**: `research/edge/combo-grid-3/run.mjs` signalsFor(F, '1h', '5m', 'dom'), the
no-trigger signals (first and second touch), entry a limit at the near edge, stop = far side -/+ (half the cost + 0.25 x
ATR(14) of H1), the grid's multi() exits. Primary exit: the 1R trailing stop from +1R ('trail'), the best-tested pooled
exit of grid 3; also reported: 1R, 2R, 3R, 4R.

**Data**: OANDA mid 5-minute candles, `edgekit` cache: xau, eurusd, gbpusd, usdjpy, audusd 2010-01-01 to 2019-12-31 (Set A);
the same five 2005-2009 and nzdusd, usdcad, usdchf, eurjpy, xag 2005-2019 (Set B, `edgekit.HOLDOUT`). Costs = combo-grid-2
COSTS.

**Tests (judged BEFORE costs, as the owner asked; after costs reported beside)**: T1 Set A pooled, trailing exit: mean R > 0
with month-sum t >= 2 in BOTH 2010-2014 and 2015-2019. T2 Set B pooled, trailing exit: mean R > 0 with month t >= 2 over
2005-2019. T3 gold alone, 4R (grid 3's best gold cell), 2010-2019: mean R > 0, month t >= 2. Holm over T1-T3. A pass is a
before-cost tilt on untouched data, nothing more: after-cost figures say whether it could pay its costs.
