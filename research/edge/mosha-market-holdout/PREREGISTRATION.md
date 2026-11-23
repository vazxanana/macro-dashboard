# The grid-6 cell on data the grid never read (pre-registration)

Written 23 Nov 2026, committed and pushed ALONE before any run of this study. Research only: nothing live reads it, nothing
is placed, no desk changes from it.

## Why

`research/edge/grid6-mosha-market` tested 69,120 cells on 2010-2019 and confirmed one after Holm, before costs: gold, ladder
M30 > M5, any break type, any CF place, a market entry at the CF close, the stop past the CF zone, a 1R exit, London fills,
with the Daily MSNR call: +0.114R a trade in 2010-14 (n 302, month t 2.16) and +0.225R in 2015-19 (n 290, month t 4.25, Holm
p 0.027). The grid as a whole found fewer discovery winners than chance (354 against about 369) and its placebo three times
as many, so this is most likely the lucky cell. This study asks it once, with no variant, on data the grid never read.

## The rule (exactly the grid's cell; no change, no tuning)

The grid's own code is imported and never edited: `frames`, `msnrCalls`, `storylines`, `entries`, `simulate`, `placebo`,
`sessionOf`, `CAP` of `research/edge/grid6-mosha-market/run.mjs`, `atr14` of `research/edge/grid5-mosha-cycle/run.mjs`.

- Ladder M30 > M5, break type `any` (edgekit `structure(bars, 3)`); BO = every M30 break event; VR = the first M5 break against
  it; CF = the next M5 break with it, not beyond the VR extreme; any CF place (no place condition).
- Entry `MKT`: market at the open of the first 5-minute candle after the CF candle's close.
- Stop `cfz`: past the CF zone's far side by 0.1 x ATR(14) of M5. Every trade has its stop on the losing side (else not built).
- Session London: the fill is at 07:00-11:59 UTC.
- MSNR `with`: the Daily MSNR call (`council/eg-methods.mjs` `direction()`, H4 working candles, D1 key levels) at the last H4
  candle closed by the CF close equals the trade's side.
- Exit: primary `1R` (target 1R; a candle holding stop and target is a stop; a gap past either exits at the open; out after
  1 day at the close). Secondary, reported only: the `trail` exit of the same trades (1R behind the best price from +1R), the
  grid's neighbour (+0.150R in 2010-14, +0.301R in 2015-19).
- A trade whose fill-to-exit span touches a `research/edge/data-quality/quality.json` exclusion is dropped (combo-grid-2
  `exclusions`). Costs: combo-grid-2 `COSTS` (round trip in price units); R after costs = R - cost / risk.

**Gate, before any holdout figure is read**: the same code on gold 2009 (warm-up) to 2019 must give the grid's figures for the
cell exactly: 2010-14 n 302, +0.1141R, month t 2.16; 2015-19 n 290, +0.2249R, month t 4.25 (month t over the grid's fixed
60-month calendars). If it does not, the study stops and says so.

## Data (OANDA mid 5-minute candles of the edgekit cache; M30, H4 and 17:00 New York days built from them)

- **Set A**: gold (xau), fills 2006-04-01 to 2009-12-31. OANDA gold starts in March 2006: the candles are read from their start
  (that month is the warm-up; the Daily MSNR call simply has no value until its own history exists, and such trades are not
  "with").
- **Set B**: silver (xag) and eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy, the cell's own rule with the
  market set changed, pooled; fills 2010-01-01 to 2019-12-31 (2009 warm-up). Costs are ASSUMED for every market of the set
  (no cost of these markets was measured for this rule; edgekit's figures, silver's and the holdout pairs' not measured on
  the demo account). Said plainly: the grid read the 5-minute candles of eurusd, gbpusd, usdjpy and audusd in 2010-2019 (this
  cell exists in their own per-market scope of the grid and was not a winner there); silver, nzdusd, usdcad, usdchf and eurjpy
  were never read by the grid.
- **Set C**: gold, fills 2020-01-01 to 2026-10-31 (the last complete month in the cache; 2019 warm-up). These years were read
  by other studies, never by grid 6. Reported with the same bar and named in the verdict sentence.

## Measures and the bar (judged BEFORE costs; after costs beside)

- Per set: n, mean R a trade, win rate, calendar-month sums (empty months count as 0, from the set's first to its last month),
  month-sum t; the same after costs.
- **Primary**: the 1R exit on set A and on set B pooled. A set passes when n >= 50, mean R > 0, month-sum t >= 2 and the
  Holm-adjusted one-sided p (from the month t, df = months - 1) over the two primary tests is under 0.05.
- **Verdict**: **PASS** = A and B both pass. **INCONCLUSIVE** = exactly one passes, or a set has fewer than 50 trades.
  **FAIL** = neither passes. Set C is judged with the plain bar (n >= 50, mean > 0, month t >= 2) and named in the verdict
  sentence ("repeated / not repeated on 2020 on"); it never turns a FAIL into a PASS.
- Reported beside, not part of the bar: the trail exit; per-market rows of set B; after-cost figures; the side-flipped placebo
  (the grid's `placebo`: the same fill moment and price, the other side, the stop and the VR target mirrored); a cut test
  (each set's markets cut at four moments: the cell's storylines known before a cut must equal the full run's).

A pass would be a before-cost tilt on new data, never an edge by itself: nothing changes on any desk, and any use would need
a forward record. No threshold, window or rule changes after the first run.
