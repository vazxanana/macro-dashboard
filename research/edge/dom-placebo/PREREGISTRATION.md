# Is it the dominant zone, or any candle body? (pre-registration)

Written 23 Nov 2026, before any run of this study. The three combination grids (`research/edge/combo-grid`, `-2`, `-3`) ended,
before costs, on one family: an H1 dominant zone (two H1 candles of one colour, the second closing beyond the first's extreme;
zone = the first candle's body), touched on M5, a limit at the zone's near edge, no trigger, stop past the far side by half the
cost + 0.25 x ATR(14) of H1. This study asks whether the DOMINANT pattern matters, or whether the same limit at the body of ANY
recent H1 candle gives the same before-cost tilt (a mechanical effect of buying the top of a bullish body / selling the bottom
of a bearish one with that stop).

**Data**: OANDA mid 5-minute candles, `edgekit` cache: xau, eurusd, gbpusd, usdjpy, audusd, trades 2010-01-01 to 2019-12-31
(candles from 2009 for warm-up). Costs = combo-grid-2 `COSTS`; data-quality exclusions as grid 3. These years are also the
Set A of `dom-zone-holdout` (same rule for the real stream): this study is a control, not a second holdout.

**Streams** (all through grid 3's `signalsFor(F, '1h', '5m', kind)` no-trigger signals, first and second touch, and the exact
trade of `dom-zone-holdout/run.mjs` `trades()`: entry a limit at the zone's near edge from the touch candle, 12 M5 candles to
fill, stop = far side -/+ (cost / 2 + 0.25 x ATR(14) of the last closed H1), the same cost-based skips, grid 3's `multi()`):
- **DOM**: `buildZones('dom')`, unchanged.
- **C1, random same-colour body**: for each DOM zone completed by H1 candle i, one H1 candle drawn with a seeded generator
  (mulberry32, seed from the market name, `edgekit.rng`) among candles i-24 .. i-2 of the DOM's colour (the DOM's own first
  candle i-1 and the completing candle i excluded); zone = that candle's body, the DOM's side, known at the DOM's completion
  (`at` = candle i's close), ended by an H1 close through its far side or 120 H1 candles after i (the grid's rule). No such
  candle: no C1 zone for that DOM. Seed 1 is primary; seeds 2-5 are reported only.
- **C2, any candle**: every closed H1 candle with a body; side = its colour, zone = its body, known at its close, the same end rule.

**Exits**: primary the 1R trailing stop from +1R (grid 3's 'trail'); 2R reported beside it.

**Tests (judged BEFORE costs, the owner's basis; after costs reported beside), pooled five markets, trail exit, 2010-2019**:
- T1: mean R of DOM minus mean R of C1 > 0, Welch t (per trade) >= 2.
- T2: mean R of DOM minus mean R of C2 > 0, Welch t >= 2.
- T3: DOM alone: mean R > 0 with calendar-month-sum t >= 2.
Holm over the three one-sided p values; a test passes when its condition holds and its Holm p < 0.05. Reported: per-market rows,
the halves 2010-14 and 2015-19, the 2R exit, the C1 seeds 2-5, the month-sum t of the per-month difference.

**Reading**: T3 passing with T1 and T2 failing means the tilt is a property of any body limit with this stop, not of the
dominant pattern. Nothing live changes whatever the result; a pass is a before-cost tilt, never an edge by itself.
