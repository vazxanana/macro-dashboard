# The dominant-zone limit on other key timeframes (pre-registration)

Written 23 Nov 2026, before any run on the test data. The three combination grids (`research/edge/combo-grid`, `-2`, `-3`,
2020 to now) ended on one family when judged before costs: an H1 dominant zone (two candles of one colour, the second closing
beyond the first's extreme; zone = the first candle's body), touched on M5, a limit at the zone's near edge, no trigger, a stop
past the far side by half the cost + 0.25 x ATR(14) of H1. `research/edge/dom-zone-holdout` tests that one chain on years no
grid read. This study asks a different question: **does the same rule hold when the key level is drawn on another timeframe?**

**Rule (fixed; the grid 3 engine unchanged, imported from `research/edge/combo-grid-3/run.mjs`)**: for each chain (key >
touch), `signalsFor(F, key, touch, 'dom')`, the no-trigger signals (first and second touch of the zone on the touch
timeframe), entry a limit at the zone's near edge from the touch candle's start, alive 12 touch-timeframe candles; stop = far
side -/+ (half the round-trip cost + 0.25 x ATR(14) of the KEY timeframe, from the last key candle closed at the touch);
skipped when the risk is under twice the cost. Fills and exits on M5 by the grid's `multi()`: on the fill candle only the stop
counts, stop first in one candle, a gap fills at the open. Time limit = combo-grid-3 `CAP`: D1 10 days, H4 5 days, H1 and
M30 2 days. Closed candles only (zones, ATR and touches are known when used; a cut test checks it).

**Chains**: T1 D1 > H1, T2 H4 > M15, T3 H1 > M5 (the found one, the reference), T4 M30 > M5.

**Data**: OANDA mid 5-minute candles (`edgekit` cache, `research/_lib/fetch-cache.mjs`), xau, eurusd, gbpusd, usdjpy, audusd,
fills from 2010-01-01 to 2019-12-31 (2009 read only to warm up zones and ATR). Every higher timeframe is built from the M5
candles (`frames`: D1 = New York days). Data-quality exclusions and costs: `research/edge/combo-grid-2/run.mjs` (`COSTS`,
`exclusions`). None of the grids read these years. T3 shares its data and rule with `dom-zone-holdout` T1 (run independently
here as the reference row).

**Tests (judged BEFORE costs, as the owner asked; after costs reported beside)**: each of T1-T4, trailing exit ('trail': the
1R trail from +1R), the five markets pooled: mean R a trade > 0 with month-sum t >= 2 in BOTH 2010-2014 and 2015-2019. One
one-sided p per test = the larger of the two halves' (df 59); Holm over the four. A chain passes only when both halves clear
the bar and its Holm p < 0.05.

**Reported, not judged**: the 2R exit (pooled, both halves), every chain per market (trail and 2R), and every figure after
costs (R less cost / risk a trade, month t). A pass is a before-cost tilt on untouched years, nothing more; the after-cost
figures say whether it could pay its costs. Never an edge without its n and t.

**Verdict wording**: PASS when every chain passes, FAIL when none does, else PARTIAL with the chains named.
