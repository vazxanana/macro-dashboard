# Next-candle engulf against the three-candle engulf, on years the desks never read (pre-registration)

Written 23 Nov 2026, before any run of this study. On the desks' closed 2026 paper records the one consistent difference the
part-by-part split found (`research/proposals/2026-11-22-desks-keep-drop.md`) was that the NEXT-CANDLE engulf readings of the
Engulfing desk (kinds `eg-plan-n`, `eg-simple-n`) did better than the same methods with an engulf completed within three
candles (`eg-plan`, `eg-simple`). That split was found after the fact on one year. This study asks the same question once on
2010-2019, years no desk and no study of these readings has read.

**Code, unchanged**: `council/eg-methods.mjs` `methodTrades(B, { from, market, span })`, imported, never edited. Run twice per
market and stretch: `span: 'next'` (the base must be the candle right before the completing one, on every timeframe) and the
default (an engulf completed within `EG_SPAN` = 3 candles). Only the plan and the short method are tested (the direct entry
exists in the default run only; its records are dropped). Stop 30 of the market's own pips (`stopSize`), entry a limit at the
M5 engulf zone, the desk's own one-position rule per run.

**Targets**: (a) the desk's own targets, `RR` of `council/eg-methods.mjs` as of today (eg-plan 1R, eg-plan-n 1R, eg-simple 1R,
eg-simple-n 4R); (b) a common 2R for every kind. The target changes which trades the one-position rule lets through, so each
target is its own run (the `RR` table is set for the run and put back after it).

**Data**: OANDA mid 5-minute candles of the `edgekit` cache (`research/edge/_lib/edgekit.mjs`), xau, eurusd, gbpusd, usdjpy,
audusd; 15-minute, H1 and H4 candles built from them (UTC), Daily from the cache's UTC daily file (weekend candles folded, as the
method does). Trades by fill time 2010-01-01 to 2019-12-31. Discovery = fills 2010-2014, confirmation = fills 2015-2019.
Each calendar year is run as one chunk with candles from 1 Nov of the year before (warm-up) to 1 Mar of the year after (so a
trade filled in December can end), Daily candles from a year before; only fills inside the year are kept. A trade still open at
the chunk's last candle is left out and counted. Data-quality exclusions: combo-grid-2 `exclusions(market)`; a trade whose
fill-to-exit span touches an excluded interval is left out.

**Costs**: combo-grid-2 `COSTS` (round trip in price), as R = cost / opening risk (30 pips). Judged BEFORE costs (the owner's
basis); after costs reported beside every figure.

**Placebo (side flipped)**: for every trade, the same fill candle, the same entry price and the same stop distance and target
in R, on the opposite side, run with the same `outcome` rule (on the fill candle only the stop counts, stop first when a candle
holds both, a gap through the stop books the open). It tells a real direction from the effect of a resting limit with this
stop and target.

**Tests** (pooled five markets, desk targets, before costs; month-sum t = t of calendar-month sums of R, empty months 0):
- **T1, plan next-candle** (`eg-plan-n`): mean R > 0 with month-sum t >= 2 in discovery AND in confirmation.
- **T2, short method next-candle** (`eg-simple-n`): the same bar.
- **T3, next-candle minus three-candle**, plan and short method together, at the COMMON 2R target (so both have the same exit):
  mean R of the next-candle trades minus mean R of the three-candle trades > 0 with Welch t >= 2 in discovery AND in
  confirmation.
- For T1 and T2 also: the real stream minus its flipped placebo > 0 with Welch t >= 2 in confirmation (else the result is the
  resting limit, not the engulf's side).
- Holm over the three tests, on the one-sided p of each test's confirmation figure (month-sum t for T1 and T2, Welch t for T3).
  A test passes only when every condition above holds and its Holm p < 0.05. **PASS** = at least one test passes;
  **FAIL** = none; **INCONCLUSIVE** = a stream under 100 trades in either half.

**Reported, not tested**: per market and per half; the 2R rows of T1 / T2; the desk-target difference; after costs; the share
of trades reaching the target; the placebo's own figures; the number of trades left open or excluded.

**No look-ahead check**: a cut test on one market-year (the trades filled and ended before a cut are identical when every
later candle is replaced), in `tests/eg-span-holdout.test.mjs`.

**Reading**: a pass is a before-cost tilt on ten old years, not an edge; nothing live changes whatever the result. A fail closes
the question on these years: no other span, target or market is tried here.
