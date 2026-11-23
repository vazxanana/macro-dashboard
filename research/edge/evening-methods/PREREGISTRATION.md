# Evening methods: do the owner's methods work in the 20-23 UTC window where the plain fade sits? (pre-registration, 23 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

`research/edge/fade-conditions` and `research/edge/fade-hour-check` found that the plain fade of the first M15 structure break
(grid7-wide-fade cell `m15 none atr 2R all`) carries most of its before-cost tilt when the break candle starts 20:00-23:59 UTC,
and that it is not only the rollover hours. The owner's own methods, read wide on ten markets, all failed overall
(`grid7-wide-core`, `grid7-ltf-ef`, `grid7-box-fade`, `grid7-mosha-fade`, `sd-flip-wide`). This study asks one question per
method: does the method do better in the evening window than in the day, is it positive there by itself, and does it beat the
plain fade in the same window? Every reading below is fixed now, from the source studies' own code (imported, never edited);
nothing is picked after the run.

## Data

- OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs`, `EDGE_DATA`), loaded from 2004-01-01.
- Markets (10): xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy.
- Exclusions: `combo-grid-2` `exclusions(market)`; a trade whose fill falls in a bad interval is dropped.
- Costs: `combo-grid-2` `COSTS` (one flat round trip a market, in price); a trade whose risk is under one round trip is skipped
  (as each source study does). Costs for xag, nzdusd, usdcad, usdchf, eurjpy are ASSUMED, not measured. R is judged BEFORE
  costs (as the grid7 studies); the after-cost R a trade and month t are reported beside every figure.
- Windows by fill time: **A = 2005-01-01 to 2014-12-31**, **B = 2015-01-01 to 2026-10-31** (grid7-wide-core `FROM`, `SPLIT`,
  `TO`). Month sums count every calendar month of the window, an empty month as 0.

## The readings (one fixed reading each, every exit a 2R target so all are on the same footing as the plain fade)

Entry at the open of the first 5-minute candle after the signal candle closes; stop as the source study sets it, always on the
losing side (the run throws otherwise); 2R target; stop first when one 5-minute candle holds both; out at the source study's time
cap. Signals use closed candles only.

| # | Reading | Source (imported) | Signal candle |
|---|---|---|---|
| R1 | Engulf zone first touch + M15 break, traded WITH | grid7-wide-core `signals`, family eg, level 4h, trigger break | the M15 break candle |
| R2 | The same signal FADED | the same; the mirrored twin (other side, stop at the same distance), as the source's placebo | the same |
| R3 | Failed engulf on M15 | grid7-ltf-ef `signals`, kind ef, M15, failed within 12 candles, no context | the M15 candle that fails it |
| R4 | M15 box close-out, WITH | grid7-box-fade `boxEvents` on M15, close-out, stop past the box's other side | the close-out candle |
| R5 | M15 box close-out, FADED | the same event, the source's fade (stop past the close-out candle's extreme) | the close-out candle |
| R6 | Mosha CF, M30>M5, WITH | grid7-mosha-fade `storyTrades` side with, on grid6-mosha-market `storylines` 'any' | the M5 CF candle |
| R7 | Mosha CF, M30>M5, FADED | the same, side fade | the M5 CF candle |
| R8 | Mosha CF, H1>M15, WITH | the same ladder H1>M15 | the M15 CF candle |
| R9 | Mosha CF, H1>M15, FADED | the same, side fade | the M15 CF candle |
| R10 | Supply / demand or engulf zone flipped, near (distance under 1 ATR), 4h, entry on an M15 close inside | sd-flip-wide `signals`, stream real, both families deduplicated as the source's "both" key | the M15 entry candle |
| C | The plain fade (control) | fade-hour-check `runSeries` (grid7-wide-fade `m15 none atr 2R all`) | the M15 break candle |

## The hour split

The UTC hour at which the signal candle STARTS: **evening** = 20, 21, 22, 23; **day** = 07 to 16 (07:00-16:59, London and New
York as grid7-wide-fade's sessions); **other** = 00-06 and 17-19. 11 rows x 3 buckets = 33 cells, each read in windows A and B.

## The primary question (one per method reading, R1-R10: 10 tests)

A reading PASSES when, before costs, all of:
1. evening minus day: per-trade Welch t >= 2 in A AND in B;
2. the evening cell itself: n >= 300, mean R > 0 and month-sum t >= 2 in A AND in B;
3. evening reading minus evening plain fade (C): per-trade Welch t >= 2 in A AND in B;
4. Holm over the 10 tests at 0.05, each test's p = the one-sided p of the WEAKEST of its six t figures (normal approximation
   for Welch, Student t with months - 1 degrees of freedom for month sums).

Verdict: PASS if at least one reading passes; FAIL if none; INCONCLUSIVE if no reading has n >= 300 in the evening in both
windows. Per-market rows (evening, before and after costs) are reported for any reading that passes. Every cell is reported.
Trades overlap, so per-trade Welch t can overstate; that is said beside it.

## Checks

- Gate: the plain fade control reproduces fade-hour-check's figures (grid7-wide-fade m15 none atr 2R all, n and mean in A and B).
- Cut test: on two markets, the signals known by five dates computed on candles cut there equal the full run's (source
  studies' own cut tests already cover their signal functions; this run re-checks the hour assignment and the trade list).
- Every trade has its stop on the losing side.

## What it will not say

Not an edge: a before-cost reading of where the methods' trades sit by hour. After costs the plain fade itself is negative in
the evening (fade-hour-check). No variant, exit or hour window is tried after the run.
