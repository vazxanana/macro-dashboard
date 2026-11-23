# Today's best near-miss grid cells on data their grids never read (pre-registration)

Written 23 Nov 2026, committed and pushed ALONE before any run of this study. Research only: nothing live reads it, nothing
is placed, no desk changes from it. Template: `research/edge/msnr-box-holdout` (the same question for grid 5's one confirmed
cell; it FAILED).

## Why

Four of today's grids failed their own bar, each with a best cell that looked good in its confirmation half but did not
survive Holm across thousands of cells. A cell picked from thousands is a hypothesis, not an edge. This study asks each of the
four once, exactly as its grid defined it, on data the grid never read. No variant, no tuning, no other cell.

## The four cells (each EXACTLY as its grid defined it; the grid's code is imported, never edited)

The grid's own signal and trade functions are imported (`signals`, `trade`, `touchedToday`, `storylines`, `entries`,
`simulate`, `placebo`, `tradesOf`); the grid's per-signal step for this one cell is copied line for line where the grid keeps
it inside `runMarket` / `accumulate`. Only the date window changes (the grids' functions take `from` / `to`).

1. **S6, `grid6-session-range`**, pooled: the previous New York afternoon range (17-21 UTC), a sweep and reclaim in the New
   York window (12-17 UTC) traded against the sweep, a Daily key level of the trade's side touched today (`key yes`), the MSNR
   call with the trade, the last H1 box closed out against the trade, no confirmation, market entry, stop past the event's
   extreme + 0.1 Daily ATR, exit `trail`. Grid figures: 2010-14 n 253, +0.1571R; 2015-19 n 265, +0.2254R (month t 3.14).
2. **MC, `grid5-mosha-cycle`**, pooled: chain H4 > H1, CF on the same timeframe as the VR (`cftf same`), stage any, barrier
   any, back any, the CF zone clear of the VR (`inVR clear`), entry `MKT-cfz` (market at the CF close, stop past the CF
   zone's origin by 0.1 ATR), exit `2R`. Grid figures: 2010-14 n 162, +0.2189R; 2015-19 n 131, +0.1971R (month t 1.93).
3. **SD, `grid5-sd-eg`**: chain H4 zone > M15 trigger, visit any, trigger `ef`, stage `pull`, market entry, zone stop, exit
   `trail`. The grid's best was EUR/USD alone (2010-14 n 310, +0.3495R; 2015-19 n 288, +0.1781R, month t 1.72). **The test is
   the pooled cell over each set's markets**; EUR/USD alone is reported beside (it is in sets A and C only).
4. **CB, `grid5-cycle-box`**, pooled: chain H1 > M15, stage `move`, side `none` (no agreement required), event `false` (a
   false break of a swing box, traded back), market entry, ATR stop, exit `1R`. Grid figures: 2010-14 n 3,345, +0.0594R
   (month t 3.18); 2015-19 n 3,234, +0.0189R (t 1.00).

Every trade has its stop on the losing side (the run stops with an error otherwise). Trades filling inside a
`research/edge/data-quality/quality.json` exclusion are dropped where the grid dropped them (`combo-grid-2` `exclusions`; the
holdout markets have whatever the file lists for them, possibly none).

**Gate before any holdout figure is read**: the same code on 2010-2019 (each grid's own markets and window, 2009 warm-up)
must give each grid's figures above for that cell (n exact, mean within 0.001R) in both halves. A cell whose gate fails is
reported INCONCLUSIVE for that cell and not judged; its holdout figures are still shown but marked unreadable.

## Data (OANDA mid 5-minute candles of the edgekit cache; every higher frame built from them by the grids' own `frames`)

- **Set A**: xau, eurusd, gbpusd, usdjpy, audusd, fills 2005-01-01 to 2009-12-31 (2004 warm-up; gold where OANDA has it).
- **Set B**: nzdusd, usdcad, usdchf, eurjpy, xag (`edgekit` `HOLDOUT_MARKETS`), fills 2010-01-01 to 2019-12-31 (2009 warm-up).
  Their round-trip costs are ASSUMED (`edgekit` `COSTS`, not measured on the demo account).
- **Set C**: the five markets of set A, fills 2020-01-01 to 2026-10-31 (2019 warm-up). These years were read by other
  studies but never by these grids; reported beside, not part of the primary test.

Costs: `combo-grid-2` `COSTS` (round trip in price units), as each grid used.

## Measures and the bar (judged BEFORE costs, as the grids were; after costs beside)

- Per cell and set: n, mean R a trade, win rate, calendar-month sums (empty months count as 0, from the window's first to its
  last month), month-sum t; the same after costs (cost / risk taken off each trade).
- **Primary test, one per cell**: the trades of set A and set B together, month sums over 2005-01 to 2019-12 (180 months;
  set A's trades fall in 2005-09, set B's in 2010-19). A cell passes when n >= 100, mean R > 0, month-sum t >= 2 and the
  Holm-adjusted one-sided p over the FOUR primary tests is under 0.05.
- **Verdict of the study**: **PASS** = at least one cell passes its primary test and its gate. **FAIL** = no cell passes and
  every gate passed. **INCONCLUSIVE** = no cell passes but a gate failed, or a cell's pooled A+B has fewer than 100 trades.
  The verdict sentence names each cell's result. A pass is a before-cost tilt on unread data, never an edge by itself.
- Reported beside, not part of the bar: set A, set B and set C each alone with the plain bar (n >= 50, mean > 0, month t >= 2);
  per-market rows; after-cost figures; each grid's own side-flipped placebo for the same cell (S6: the side flipped, stop
  mirrored around the trigger close; MC: the grid's `placebo`, same fill, other side, stop and VR target mirrored; SD: the
  grid's `flip`, the zone traded the other way through the same steps; CB: the grid's `p`, market the other side at the same
  stop distance); SD on EUR/USD alone.
- **Cut test**: each set's markets cut at several moments; every cell trade that filled more than 6 days before a cut must be
  the same (fill time, side, R of the cell's exit) when the candles stop at the cut, and no extra such trade may appear.

No threshold, window, cell or rule changes after the first run. Nothing changes on any desk from this study.
