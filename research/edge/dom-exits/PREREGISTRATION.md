# Which exit suits the H1 dominant-zone limit, on 2010-2019 (pre-registration)

Written 23 Nov 2026, before any run on these years. Research only: nothing live changes.

The three combination grids (`research/edge/combo-grid`, `-2`, `-3`, 2020 to now) ended, before costs, on one family: an H1
dominant zone (two H1 candles of one colour, the second closing beyond the first's extreme; zone = the first candle's body),
touched on M5, a limit at the zone's near edge, no trigger, the stop past the far side by half the cost + 0.25 x ATR(14) of H1.
The demo job (`council/dom-demo.mjs`) trades it with a 2R target. This asks, on years no grid read, which exit suits it.

**Rule (fixed, the grid 3 engine imported unchanged)**: `research/edge/combo-grid-3/run.mjs` `signalsFor(F, '1h', '5m', 'dom')`,
the no-trigger signals (first and second touch of a zone), entry a limit at the zone's near edge from the touch candle's start
(12 M5 candles to fill), stop = far side -/+ (half the cost + 0.25 x ATR(14) of H1 closed by the touch), the planned risk at least
2 round trips, a filled risk at least one round trip, `multi()` for the exits with the grid's H1 time limit (2 days) and its inputs
for the opposite zone (nearest standing opposite dominant zone, 1R or more, else 2R), the far target (nearest standing H4 / D1
engulf or failed-engulf zone 3R or more away, else none) and the M5 EF trail. Same as `dom-zone-holdout`'s rule, with those three
inputs as the grid ran them.

**Exits (ten)**: 1R, 2R, 3R, 4R, 6R, the opposite zone, the 1R trailing stop from +1R, the far target (only trades that have one),
the M5 EF trail, and a time exit at 24 h (no target; out at the close of the first M5 candle ending 24 h or more after the fill
candle's start; the stop as the others; on the fill candle only the stop counts). Every exit that has not ended at 2 days closes
at that candle's close.

**Data**: OANDA mid 5-minute candles, `edgekit` cache, xau, eurusd, gbpusd, usdjpy, audusd; trades filled 2010-01-01 to
2019-12-31 (warm-up from 2009); the data-quality exclusions; costs = combo-grid-2 `COSTS` (R after costs = R - cost / risk).

**Tests (judged BEFORE costs, as the owner asked; after costs reported beside)**:
- **T1**: 2R, pooled: mean R > 0 with calendar-month-sum t >= 2 in BOTH 2010-2014 and 2015-2019.
- **T2**: for each of the nine other exits, the paired difference (exit R - 2R R of the same trade; the far target on the trades
  that have one), summed by calendar month over 2010-2019, t on the month sums, two-sided p, Holm over the nine. An exit
  **beats 2R** when its difference is > 0, its Holm p < 0.05, and its month-sum difference is > 0 in both 2010-2014 and
  2015-2019. (A paired difference is the same before and after costs: both legs pay one round trip.)
- Reported, no verdict: every exit per market and per half, before and after costs; trades a day per market (mean per weekday,
  95th percentile and largest), and positions open at once with the 2R exit (per market and the five together), against the
  demo job's caps of 3 a market and 10 in all.

**Verdict**: PASS when T1 passes (the paper verdict names the exit that beats 2R, if any); FAIL otherwise. A pass is a
before-cost tilt on untouched years, not an edge after costs.
